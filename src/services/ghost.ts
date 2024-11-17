import {type JsonWebKey, createPublicKey} from 'node:crypto';
import GhostAdminApi from '@tryghost/admin-api';
import getToken from '@tryghost/admin-api/lib/token.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import jsonwebtoken, {type GetPublicKeyOrSecret} from 'jsonwebtoken';
import type {RequestInit} from 'node-fetch';
import type {GhostMemberWithSubscriptions, GhostMemberWithTiers, GhostTier} from '../types/ghost.js';
import {isObject} from '../lib/is-object.js';
import {FetchInjectionToken} from '../lib/request.js';
import {JSON_MIME_TYPE} from '../lib/constants.js';
import {uResolve} from '../lib/u-resolve.js';
import {Configuration} from '../types/config.js';
import {type Dependency, inject} from '../lib/injector.js';

function simplifyJwk(key: JsonWebKey) {
	return {
		kid: key.kid as string,
		pem: createPublicKey({format: 'jwk', key}).export({type: 'pkcs1', format: 'pem'}).toString(),
	};
}

type Fetch = ReturnType<Dependency<typeof FetchInjectionToken>>;

type GhostFetchCreator = (
	fetch: Fetch
) => ConstructorParameters<typeof GhostAdminApi>[0]['makeRequest'];

interface StaffUsers {
	users: Array<{
		roles: Array<{
			name: string;
		}>;
	}>;
}

/**
 * Used to type a JSON response, in conjunction with {@link assertNoErrors}
 */
interface PossibleErrors {
	errors?: unknown;
}

/**
 * @param errors - The `errors` property from a Ghost API response
 * @param errorContext - Answer to fill in the blank - `Failed to ___`
 *
 * @description Ensures the `errors` property of a Ghost response is empty
 * @example ```typescript
 *  const {[dataType], errors} = await response.json() as ResponseType & PossibleErrors
 *  assertNoErrors(errors, 'Read [dataType]');
 *  return [dataType];
 * ```
 */
function assertNoErrors(errors: unknown, errorContext: string) {
	if (errors && Array.isArray(errors) && errors.length > 0) {
		const errorMessage = (errors[0] as Record<string, string>)?.message ?? JSON.stringify(errors);
		throw new Error(`Failed to ${errorContext}: ${errorMessage}`);
	}
}

const createMakeRequest: GhostFetchCreator = fetch => async ({url, method, headers, params, data}) => {
	if (params && Object.keys(params).length > 0) {
		const parsedUrl = new URL(url);
		parsedUrl.search = new URLSearchParams(params).toString();
		url = parsedUrl.toString();
	}

	const options: RequestInit = {
		method,
		headers,
	};

	if (data && Object.keys(data).length > 0) {
		options.body = JSON.stringify(data);
	}

	const response = await fetch(url, options);

	if (!response.ok) {
		const error = new Error('Unable to make request') as unknown as Record<string, unknown>;

		try {
			error.response = {
				status: response.status,
				data: await response.json(),
			};
		} finally {
			throw error as unknown as Error; // eslint-disable-line no-unsafe-finally
		}
	}

	return response.json();
};

export class GhostService {
	protected readonly _fetch: Fetch;
	private readonly _api: ReturnType<typeof GhostAdminApi>;
	private readonly _publicUrl: string;
	private readonly _adminUrl: string;
	private readonly _apiKey: string;
	private _ghostMembersPublicKeys: Array<{kid?: string; pem: string}> | undefined;
	private readonly _jwtIssuer: string;

	constructor() {
		const config = inject(Configuration);
		this._fetch = inject(FetchInjectionToken)('ghost', config.logGhostRequests);
		this._publicUrl = config.ghostUrl;
		this._adminUrl = config.ghostAdminUrl ?? config.ghostUrl;
		this._apiKey = config.ghostApiKey;
		this._jwtIssuer = this.resolvePublic('/members/api');
		this._api = new GhostAdminApi({
			url: this._adminUrl,
			key: config.ghostApiKey,
			version: 'v5.0',
			makeRequest: createMakeRequest(this._fetch),
		});
	}

	getAuthHeader() {
		return `Ghost ${getToken(this._apiKey, '/admin')}`;
	}

	readonly _getKey: GetPublicKeyOrSecret = async ({kid}, callback) => {
		if (!this._ghostMembersPublicKeys) {
			await this._getJwtKeys();
		}

		if (!kid) {
			callback(new Error('No kid'));
			return;
		}

		const key = this._ghostMembersPublicKeys!.find(key => key.kid === kid);
		if (!key) {
			callback(new Error('Unable to find key with kid'));
			return;
		}

		callback(null, key.pem);
	};

	resolvePublic(urlPath: string, hash = '', query?: Record<string, string>): string {
		return this._urlResolve(this._publicUrl, urlPath, hash, query);
	}

	resolveAdmin(urlPath: string, hash = '', query?: Record<string, string>) {
		return this._urlResolve(this._adminUrl, urlPath, hash, query);
	}

	// eslint-disable-next-line @typescript-eslint/promise-function-async
	decodeMemberJwt(jwt: string) {
		return new Promise<{success: true; payload: string} | {success: false; error: unknown}>(resolve => {
			jsonwebtoken.verify(jwt, this._getKey, {algorithms: ['RS512'], issuer: this._jwtIssuer}, (error, payload) => {
				// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
				if (error || !payload) {
					resolve({success: false, error});
					return;
				}

				resolve({success: true, payload: payload.sub as string});
			});
		});
	}

	async getMember(id: string): Promise<GhostMemberWithTiers | false> {
		try {
			return await this._api.members.read({id}, {include: 'tiers'}) as unknown as GhostMemberWithTiers;
		} catch (error: unknown) {
			if (isObject(error) && error.type === 'NotFoundError') {
				return false;
			}

			throw error;
		}
	}

	async getMemberByEmail(email: string): Promise<GhostMemberWithSubscriptions | false> {
		try {
			const response = await this._api.members.browse({filter: `email:${email}`});
			if (response?.length !== 1) {
				return false;
			}

			return response[0] as unknown as GhostMemberWithSubscriptions;
		} catch (error: unknown) {
			if (isObject(error) && error.type === 'NotFoundError') {
				return false;
			}

			throw error;
		}
	}

	async getTiers(): Promise<GhostTier[]> {
		const headers = {
			authorization: this.getAuthHeader(),
			accept: JSON_MIME_TYPE,
		};

		const response = await this._fetch(this.resolveAdmin('/ghost/api/admin/tiers'), {headers});

		const {tiers, errors} = await response.json() as {tiers: GhostTier[]} & PossibleErrors;
		assertNoErrors(errors, 'get tiers');

		return tiers;
	}

	async authenticateStaffFromCookie(cookie: string) {
		const response = await this._fetch(this.resolveAdmin('/ghost/api/admin/users/me/', '', {include: 'roles'}), {
			headers: {cookie},
		});

		if (!response.ok) {
			return false;
		}

		const {users, errors} = await response.json() as StaffUsers & PossibleErrors;
		assertNoErrors(errors, 'authenticate staff from cookie');

		return users[0].roles.some(role => role.name === 'Owner' || role.name === 'Administrator');
	}

	private _urlResolve(url: string, urlPath: string, hash = '', query?: Record<string, string>): string {
		const base = new URL(url);
		base.pathname = uResolve(base.pathname, urlPath);
		base.hash = hash;

		if (query) {
			for (const [key, value] of Object.entries(query)) {
				base.searchParams.set(key, value);
			}
		}

		return base.toString();
	}

	private async _getJwtKeys() {
		const endpoint = this.resolvePublic('/members/.well-known/jwks.json');
		const response = await this._fetch(endpoint);
		const {keys} = await response.json() as {keys: JsonWebKey[]};

		// eslint-disable-next-line unicorn/no-array-callback-reference
		this._ghostMembersPublicKeys = keys.map(simplifyJwk);
	}
}
