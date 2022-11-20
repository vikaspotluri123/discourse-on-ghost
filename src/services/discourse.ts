import type {RequestInit} from 'node-fetch';
import errors from '@tryghost/errors';
import {FetchInjectionToken} from '../lib/request.js';
import {Semaphore, withSemaphore} from '../lib/semaphore.js';
import {type DiscourseGroup, type MinimalGroup} from '../types/discourse.js';
import {JSON_MIME_TYPE} from '../lib/constants.js';
import {uResolve} from '../lib/u-resolve.js';
import {Configuration} from '../types/config.js';
import {Logger} from '../types/logger.js';
import {type Dependency, inject} from '../lib/injector.js';

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

interface CreateGroup {
	created: boolean;
	group: DiscourseGroup;
}

interface InternalGroup {
	id: number;
	name: string;
}

export class DiscourseService {
	readonly logger = inject(Logger);
	private readonly _requestSemaphore: Semaphore;
	private readonly _endpoint: string;
	private readonly _apiKey: string;
	private readonly _apiUser: string;
	private readonly _fetch: ReturnType<Dependency<typeof FetchInjectionToken>>;

	constructor() {
		const config = inject(Configuration);
		this._requestSemaphore = new Semaphore(DEFAULT_MAX_DISCOURSE_REQUEST_CONCURRENCY);
		this._endpoint = config.discourseUrl;
		this._apiKey = config.discourseApiKey;
		this._apiUser = config.discourseApiUser;
		this._fetch = inject(FetchInjectionToken)('discourse', config.logDiscourseRequests);

		this.addMemberToGroup = this.addMemberToGroup.bind(this);
		this.removeMemberFromGroup = this.removeMemberFromGroup.bind(this);
	}

	resolve(urlPath: string, query: Record<string, string> = {}): string {
		const base = new URL(this._endpoint);
		base.pathname = uResolve(base.pathname, urlPath);
		base.search = new URLSearchParams(query).toString();

		return base.toString();
	}

	getHeaders(includeContentType = false) {
		const fetchOptions: RequestInit = {
			headers: {
				accept: JSON_MIME_TYPE,
				'Api-Key': this._apiKey,
				'Api-Username': this._apiUser,
			},
		};

		if (includeContentType) {
			(fetchOptions.headers as Record<string, string>)['Content-Type'] = JSON_MIME_TYPE;
		}

		return fetchOptions;
	}

	async idempotentlyCreateGroup(name: string, fullName: string): Promise<CreateGroup> {
		const checkUrl = this.resolve(`/groups/${name}.json`);
		const options = this.getHeaders(true);

		const possibleGroup = await this._fetch(checkUrl, options);

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

		const creationResponse = await this._fetch(this.resolve('/admin/groups/'), {
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

		this.logger.error(error);

		throw error;
	}

	async deleteGroup(id: number): Promise<void> {
		const url = this.resolve(`/admin/groups/${id}.json`);
		const options = this.getHeaders();
		options.method = 'DELETE';

		const response = await this._fetch(url, options);

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

	async getAllGroups(): Promise<DiscourseGroup[]> {
		const url = this.resolve('/groups.json');
		const options = this.getHeaders(true);

		const response = await this._fetch(url, options);
		const {groups} = await response.json() as {groups: DiscourseGroup[]};

		return groups;
	}

	async getMember(uuid: string): Promise < {id: number; groups: InternalGroup[]; username: string} | undefined > {
		const url = this.resolve(`/u/by-external/${uuid}.json`);
		const options = this.getHeaders();

		const response = await this._fetch(url, options);

		if (response.ok) {
			const {user} = await response.json() as {user: {id: number; groups: InternalGroup[]; username: string}};
			return {
				id: user.id,
				username: user.username,
				groups: user.groups.map(({id, name}) => ({id, name})),
			};
		}

		if (response.status === 404) {
			this.logger.error(`Unable to get member ${uuid} - member not found`);
		} else {
			this.logger.error(new errors.InternalServerError({
				message: `Unable to get member ${uuid} - response is not ok`,
				statusCode: response.status,
				errorDetails: await response.json(),
			}));
		}

		return undefined;
	}

	async addMemberToGroup(discourseId: number, name: string, niceName: string) {
		const {group: {id}} = await this.idempotentlyCreateGroup(name, niceName);
		const url = this.resolve(`/groups/${id}/members.json`);
		const options = this.getHeaders(true);
		const response = await this._fetch(url, {
			method: 'PUT',
			body: JSON.stringify({user_ids: discourseId, notify_users: false}),
			...options,
		}, {discourseId: discourseId.toString()});

		if (!response.ok) {
			this.logger.error(new errors.InternalServerError({
				message: `Unable to add user ${discourseId} to group ${name} - response is not ok`,
				errorDetails: await response.json(),
			}));

			return false;
		}

		const body = await response.json() as {errors?: string[]};

		return !body.errors || body.errors.length === 0;
	}

	async removeMemberFromGroup(discourseId: number, name: string) {
		const lookupResponse = await this._fetch(this.resolve(`/groups/${name}.json`), this.getHeaders());
		if (!lookupResponse.ok) {
			await lookupResponse.text();
			return false;
		}

		const {group: {id}} = await lookupResponse.json() as {group: DiscourseGroup};

		const deleteUrl = this.resolve(`/groups/${id}/members.json`);
		const response = await this._fetch(deleteUrl, {
			method: 'DELETE',
			body: JSON.stringify({user_id: discourseId}),
			...this.getHeaders(true),
		}, {discourseId: discourseId.toString()});

		const body = await response.json() as {errors?: string[]};

		if (!response.ok) {
			this.logger.error(new errors.InternalServerError({
				message: `Unable to remove user ${discourseId} from group ${name} - response is not ok`,
				errorDetails: body,
			}));

			return response.ok;
		}

		return !body.errors || body.errors.length === 0;
	}

	async setMemberGroups(uuid: string, groups: MinimalGroup[]) {
		const member = await this.getMember(uuid);
		const changes: Array<{name: string; type: 'added' | 'removed'; success: boolean}> = [];
		const requestedGroups = new Map<string, string>();

		if (!member) {
		// There's no need to throw an error here because either the user deleted their account, or just created their
		// account. When they SSO with Discourse after creating an account, the group list will be set
			this.logger.info(`Unable to set groups for member ${uuid}`);
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
			unsettledResults.push(withSemaphore(this._requestSemaphore, this.removeMemberFromGroup, id, name));
			changes.push({type: 'removed', name, success: true});
		}

		for (const [name, niceName] of requestedGroups.entries()) {
			unsettledResults.push(withSemaphore(this._requestSemaphore, this.addMemberToGroup, id, name, niceName));
			changes.push({type: 'added', name, success: true});
		}

		const settledResults = await Promise.allSettled(unsettledResults);
		for (const [index, {status}] of settledResults.entries()) {
			changes[index].success = status === 'fulfilled';
		}

		return changes;
	}

	async anonymizeExternalUser(uuid: string) {
		const user = await this.getMember(uuid);

		if (!user) {
			return false;
		}

		const {id, username} = user;
		const url = this.resolve(`/admin/users/${id}/anonymize.json`);
		const options = this.getHeaders();
		options.method = 'PUT';
		const response = await this._fetch(url, options, {username});

		if (!response.ok) {
			this.logger.error(new errors.InternalServerError({
				message: `Unable to anonymize user ${id} - response is not ok`,
				errorDetails: await response.json(),
			}));

			return false;
		}

		const {success, username: newUsername} = await response.json() as {success: string; username: string};

		if (success.toLowerCase() !== 'ok') {
			this.logger.info(`Unable to anonymize ${username} - success is "${success}"`);
			return false;
		}

		this.logger.info(`Anonymized ${username} (${uuid}) to ${newUsername}`);
		return true;
	}

	async suspendExternalUser(uuid: string) {
		const user = await this.getMember(uuid);

		if (!user) {
			return false;
		}

		const {id, username} = user;
		const url = this.resolve(`/admin/users/${id}/suspend.json`);
		const today = new Date();
		const tenYearsFromToday = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate());
		const [suspendUntil] = tenYearsFromToday.toISOString().split('T');

		const response = await this._fetch(url, {
			method: 'PUT',
			body: JSON.stringify({
				suspend_until: suspendUntil,
				reason: 'Membership was deleted',
			}),
			...this.getHeaders(true),
		}, {username});

		if (!response.ok) {
		// CASE: User is already suspended
			if (response.status === 409) {
				await response.text();
				return true;
			}

			this.logger.error(new errors.InternalServerError({
				message: `Unable to suspend ${username} - response is not ok`,
				errorDetails: await response.json(),
			}));

			return false;
		}

		const body = await response.json() as {suspension?: unknown};

		this.logger.info(`Suspended ${username} (${uuid})`);
		return 'suspension' in body;
	}

	async deleteExternalUser(uuid: string) {
		const user = await this.getMember(uuid);

		if (!user) {
			this.logger.info(`No need to delete ${uuid} - user not found`);
			return true;
		}

		const {id, username} = user;
		const url = this.resolve(`/admin/users/${id}.json`);
		const response = await this._fetch(url, {
			method: 'DELETE',
			body: JSON.stringify({
				delete_posts: true,
				block_email: false,
				block_urls: false,
				block_ip: false,
			}),
			...this.getHeaders(true),
		}, {username});

		if (!response.ok) {
			this.logger.error(new errors.InternalServerError({
				message: `Unable to delete user ${username} - response is not ok`,
				errorDetails: await response.json(),
			}));

			return false;
		}

		this.logger.info(`Deleted ${username} (${uuid})`);
		return true;
	}
}
