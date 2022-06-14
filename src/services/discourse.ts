import path from 'node:path';
import fetch, {type RequestInit} from 'node-fetch';
import errors from '@tryghost/errors';
import logging from '@tryghost/logging';
import {Semaphore, withSemaphore} from '../lib/semaphore.js';
import {discourseApiKey, discourseApiUser, discourseUrl} from './config.js';

const JSON_MIME_TYPE = 'application/json';

export const DEFAULT_MAX_DISCOURSE_REQUEST_CONCURRENCY = 3;
export const DEFAULT_GROUP_MENTIONABLE_LEVEL = 3;
export const DEFAULT_GROUP_VISIBILITY_LEVEL = 2;
export const DEFAULT_GROUP_MEMBERS_VISIBILITY_LEVEL = 2;
export const DEFAULT_GROUP_PREFIX = 'tier_';

const requestSemaphore = new Semaphore(DEFAULT_MAX_DISCOURSE_REQUEST_CONCURRENCY);

interface DiscourseGroup {
	id: number;
	name: string;
	full_name: string;
	automatic: boolean;
	mentionable_level: number;
	visibility_level: number;
	members_visibility_level: number;
}

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
	const checkUrl = getDiscourseUrl(`/groups/${name}.json`, {group_name: name});
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
	});

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

interface InternalGroup {
	id: number;
	name: string;
}

export async function getMemberGroups(uuid: string): Promise<{id: number; groups: InternalGroup[]}> {
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

	return {id: -1, groups: []};
}

export async function addMemberToGroup(discourseId: number, name: string, niceName: string) {
	const {group: {id}} = await idempotentlyCreateGroup(name, niceName);
	const url = getDiscourseUrl(`/groups/${id}/members.json`);
	const options = getDiscourseHeaders(true);
	const response = await fetch(url, {
		method: 'PUT',
		body: JSON.stringify({user_ids: discourseId, notify_users: false}),
		...options,
	});

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
	});

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

export async function setMemberGroups(uuid: string, groups: Array<{name: string; niceName: string}>) {
	const {id, groups: currentGroups} = await getMemberGroups(uuid);
	const changes: Array<{name: string; type: 'added' | 'removed'; success: boolean}> = [];
	const requestedGroups = new Map<string, string>();

	if (id === -1) {
		throw new errors.NotFoundError({message: `Unable to map ${uuid} to Discourse`});
	}

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
