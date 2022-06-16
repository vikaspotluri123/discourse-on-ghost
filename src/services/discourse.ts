import path from 'node:path';
import {type RequestInit} from 'node-fetch';
import errors from '@tryghost/errors';
import logging from '@tryghost/logging';
import {createFetch} from '../lib/request.js';
import {Semaphore, withSemaphore} from '../lib/semaphore.js';
import {DiscourseGroup, MinimalGroup} from '../types/discourse.js';
import {JSON_MIME_TYPE} from '../lib/constants.js';
import {discourseApiKey, discourseApiUser, discourseUrl, logDiscourseRequests} from './config.js';

const fetch = createFetch('discourse', logDiscourseRequests);

export const DEFAULT_MAX_DISCOURSE_REQUEST_CONCURRENCY = 3;
export const DEFAULT_GROUP_MENTIONABLE_LEVEL = 3;
export const DEFAULT_GROUP_VISIBILITY_LEVEL = 2;
export const DEFAULT_GROUP_MEMBERS_VISIBILITY_LEVEL = 2;
export const DEFAULT_GROUP_PREFIX = 'tier_';
export const DEFAULT_GROUP_NAME_SUFFIX = ' Tier';

export function getNiceName(ghostTierName: string) {
	return `${ghostTierName}${DEFAULT_GROUP_NAME_SUFFIX}`;
}

export function getSlug(ghostTierSlug: string) {
	return `${DEFAULT_GROUP_PREFIX}${ghostTierSlug}`;
}

const requestSemaphore = new Semaphore(DEFAULT_MAX_DISCOURSE_REQUEST_CONCURRENCY);

export function getDiscourseUrl(urlPath: string, query: Record<string, string> = {}): string {
	const base = new URL(discourseUrl);
	base.pathname = path.resolve(base.pathname, urlPath);
	base.search = new URLSearchParams(query).toString();

	return base.toString();
}

export function getDiscourseHeaders(includeContentType = false) {
	const fetchOptions: RequestInit = {
		headers: {
			accept: JSON_MIME_TYPE,
			'Api-Key': discourseApiKey,
			'Api-Username': discourseApiUser,
		},
	};

	if (includeContentType) {
		(fetchOptions.headers as Record<string, string>)['Content-Type'] = JSON_MIME_TYPE;
	}

	return fetchOptions;
}

interface CreateGroup {
	created: boolean;
	group: DiscourseGroup;
}

export async function idempotentlyCreateGroup(name: string, fullName: string): Promise<CreateGroup> {
	const checkUrl = getDiscourseUrl(`/groups/${name}.json`);
	const options = getDiscourseHeaders(true);

	const possibleGroup = await fetch(checkUrl, options);

	if (possibleGroup.ok) {
		const {group} = await possibleGroup.json() as {group: DiscourseGroup};
		return {
			created: false,
			group,
		};
	}

	const group: Omit<DiscourseGroup, 'id'> = {
		name,
		full_name: fullName,
		automatic: false,
		mentionable_level: DEFAULT_GROUP_MENTIONABLE_LEVEL,
		visibility_level: DEFAULT_GROUP_VISIBILITY_LEVEL,
		members_visibility_level: DEFAULT_GROUP_MEMBERS_VISIBILITY_LEVEL,
	};

	const creationResponse = await fetch(getDiscourseUrl('/admin/groups/'), {
		method: 'POST',
		body: JSON.stringify(group),
		...options,
	}, {name, fullName});

	if (creationResponse.ok) {
		const {basic_group: group} = await creationResponse.json() as {basic_group: DiscourseGroup};
		return {
			created: true,
			group,
		};
	}

	const error = new errors.InternalServerError({
		message: `Unable to create group ${name} - response is not ok`,
		errorDetails: await creationResponse.json(),
	});

	logging.error(error);

	throw error;
}

export async function deleteGroup(id: number): Promise<void> {
	const url = getDiscourseUrl(`/admin/groups/${id}.json`);
	const options = getDiscourseHeaders();
	options.method = 'DELETE';

	const response = await fetch(url, options);

	if (!response.ok) {
		throw new errors.InternalServerError({
			message: `Unable to delete group ${id} - response is not ok`,
			errorDetails: await response.json(),
		});
	}

	const body = await response.json() as {success?: string};

	if (!body.success) {
		throw new errors.InternalServerError({
			message: `Unable to delete group ${id} - response does not contain "success" property`,
			errorDetails: body,
		});
	}
}

export async function getAllGroups(): Promise<DiscourseGroup[]> {
	const url = getDiscourseUrl('/groups.json');
	const options = getDiscourseHeaders(true);

	const response = await fetch(url, options);
	const {groups} = await response.json() as {groups: DiscourseGroup[]};

	return groups;
}

interface InternalGroup {
	id: number;
	name: string;
}

export async function getMember(uuid: string): Promise<{id: number; groups: InternalGroup[]} | undefined> {
	const url = getDiscourseUrl(`/u/by-external/${uuid}.json`);
	const options = getDiscourseHeaders();

	const response = await fetch(url, options);

	if (response.ok) {
		const {user} = await response.json() as {user: {id: number; groups: InternalGroup[]}};
		return {
			id: user.id,
			groups: user.groups.map(({id, name}) => ({id, name})),
		};
	}

	logging.error(new errors.InternalServerError({
		message: `Unable to get member groups for ${uuid} - response is not ok`,
		errorDetails: await response.json(),
	}));

	return undefined;
}

export async function addMemberToGroup(discourseId: number, name: string, niceName: string) {
	const {group: {id}} = await idempotentlyCreateGroup(name, niceName);
	const url = getDiscourseUrl(`/groups/${id}/members.json`);
	const options = getDiscourseHeaders(true);
	const response = await fetch(url, {
		method: 'PUT',
		body: JSON.stringify({user_ids: discourseId, notify_users: false}),
		...options,
	}, {discourseId: discourseId.toString()});

	if (!response.ok) {
		logging.error(new errors.InternalServerError({
			message: `Unable to add user ${discourseId} to group ${name} - response is not ok`,
			errorDetails: await response.json(),
		}));

		return false;
	}

	const body = await response.json() as {errors?: string[]};

	return !body.errors || body.errors.length === 0;
}

export async function removeMemberFromGroup(discourseId: number, name: string) {
	const lookupResponse = await fetch(getDiscourseUrl(`/groups/${name}.json`), getDiscourseHeaders());
	if (!lookupResponse.ok) {
		await lookupResponse.text();
		return false;
	}

	const {group: {id}} = await lookupResponse.json() as {group: DiscourseGroup};

	const deleteUrl = getDiscourseUrl(`/groups/${id}/members.json`);
	const response = await fetch(deleteUrl, {
		method: 'DELETE',
		body: JSON.stringify({user_id: discourseId}),
		...getDiscourseHeaders(true),
	}, {discourseId: discourseId.toString()});

	const body = await response.json() as {errors?: string[]};

	if (!response.ok) {
		logging.error(new errors.InternalServerError({
			message: `Unable to remove user ${discourseId} from group ${name} - response is not ok`,
			errorDetails: body,
		}));

		return response.ok;
	}

	return !body.errors || body.errors.length === 0;
}

export async function setMemberGroups(uuid: string, groups: MinimalGroup[]) {
	const member = await getMember(uuid);
	const changes: Array<{name: string; type: 'added' | 'removed'; success: boolean}> = [];
	const requestedGroups = new Map<string, string>();

	if (!member) {
		// There's no need to throw an error here because either the user deleted their account, or just created their
		// account. When they SSO with Discourse after creating an account, the group list will be set
		logging.info(`Unable to set groups for ${uuid} - user not found`);
		return false;
	}

	const {id, groups: currentGroups} = member;

	for (const group of groups) {
		requestedGroups.set(group.name, group.niceName);
	}

	const groupsToRemove = currentGroups.filter(({name}) => {
		if (!name.startsWith(DEFAULT_GROUP_PREFIX)) {
			return false;
		}

		if (requestedGroups.has(name)) {
			requestedGroups.delete(name);
			return false;
		}

		return true;
	});

	const unsettledResults = [];

	for (const {name} of groupsToRemove) {
		unsettledResults.push(withSemaphore(requestSemaphore, removeMemberFromGroup, id, name));
		changes.push({type: 'removed', name, success: true});
	}

	for (const [name, niceName] of requestedGroups.entries()) {
		unsettledResults.push(withSemaphore(requestSemaphore, addMemberToGroup, id, name, niceName));
		changes.push({type: 'added', name, success: true});
	}

	const settledResults = await Promise.allSettled(unsettledResults);
	for (const [index, {status}] of settledResults.entries()) {
		changes[index].success = status === 'fulfilled';
	}

	return changes;
}
