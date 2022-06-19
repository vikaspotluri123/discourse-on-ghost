import {Buffer} from 'node:buffer';
import {Request, Response} from 'express';
import fetch from 'node-fetch';
import type {GhostService} from '../services/ghost.js';
import {GhostMemberWithSubscriptions} from '../types/ghost.js';
import {DiscourseSSOResponse} from '../types/discourse.js';
import {getSlug} from '../services/discourse.js';
import {Configuration} from '../types/config.js';
import {secretToKey, sign, verify, WebCrypto} from '../services/crypto.js';

const enum MemberError {
	NotLoggedIn = 'NotLoggedIn',
	InternalError = 'InternalError',
}

export class SSOController {
	private readonly key: ReturnType<typeof secretToKey>;
	private readonly _login: string;

	constructor(config: Configuration, private readonly crypto: WebCrypto, private readonly _ghostService: GhostService) {
		this._login = config.noAuthRedirect ?? _ghostService.resolve('/', '#/portal/account');
		this.key = secretToKey(crypto, config.discourseSecret);
	}

	controllerFor(ssoMethod: Configuration['ssoMethod']) {
		if (ssoMethod === 'obscure') {
			return this.obscurelyAuthorizeUser;
		}

		return this.securelyAuthorizeUser;
	}

	async getMemberWithCookie(cookie: string): Promise<GhostMemberWithSubscriptions | MemberError> {
		const proxyResponse = await fetch(this._ghostService.resolve('/members/api/member'), {
			headers: {cookie},
		});

		if (proxyResponse.status === 204) {
			return MemberError.NotLoggedIn;
		}

		if (proxyResponse.status !== 200) {
			return MemberError.InternalError;
		}

		return proxyResponse.json() as Promise<GhostMemberWithSubscriptions>;
	}

	async securelyAuthorizeUser(request: Request, response: Response) {
		const {sso, sig} = request.query;
		const {cookie} = request.headers;

		if (!sso || !sig || Array.isArray(sso) || Array.isArray(sig) || typeof sso !== 'string' || typeof sig !== 'string') {
			response.status(400).json({message: 'SSO and signature are required and must not be arrays'});
			return;
		}

		if (!cookie) {
			response.redirect(this._login);
			return;
		}

		const rawDiscoursePayload = await this.decodeDiscoursePayload(sso, sig);

		if (!rawDiscoursePayload) {
			response.status(400).json({message: 'Unable to verify signature'});
			return;
		}

		const memberResponse = await this.getMemberWithCookie(cookie);

		if (memberResponse === MemberError.NotLoggedIn) {
			response.redirect(this._login);
			return;
		}

		if (memberResponse === MemberError.InternalError) {
			response.status(500).json({error: 'Unable to get your member information'});
			return;
		}

		const discourseRedirect = rawDiscoursePayload.get('return_sso_url')!;
		const memberPayload = this.convertGhostMemberToDiscourseSSO(memberResponse, rawDiscoursePayload.get('nonce')!);

		response.redirect(await this.addEncodedPayloadToDiscourseReturnUrl(memberPayload, discourseRedirect));
	}

	async obscurelyAuthorizeUser(request: Request, response: Response) {
		const {sso, sig, email, uuid} = request.query;

		if (!sso || !sig || Array.isArray(sso) || Array.isArray(sig) || typeof sso !== 'string' || typeof sig !== 'string') {
			response.status(400).json({message: 'SSO and signature are required and must not be arrays'});
			return;
		}

		if (
			!email || !uuid
			|| Array.isArray(email) || Array.isArray(uuid)
			|| typeof email !== 'string' || typeof uuid !== 'string'
		) {
			response.status(400).json({message: 'Email and UUID are required and must not be arrays'});
			return;
		}

		const rawDiscoursePayload = await this.decodeDiscoursePayload(sso, sig);

		if (!rawDiscoursePayload) {
			response.status(400).json({message: 'Unable to verify signature'});
			return;
		}

		const member = await this._ghostService.getMemberByUuid(uuid);

		if (!member || member.email !== email) {
			response.status(404).json({message: 'Unable to authenticate member'});
			return;
		}

		const discourseRedirect = rawDiscoursePayload.get('return_sso_url')!;
		const memberPayload = this.convertGhostMemberToDiscourseSSO(member, rawDiscoursePayload.get('nonce')!);

		response.redirect(await this.addEncodedPayloadToDiscourseReturnUrl(memberPayload, discourseRedirect));
	}

	private async addEncodedPayloadToDiscourseReturnUrl(payload: DiscourseSSOResponse, urlBase: string) {
		// @ts-expect-error all values of DiscourseSSOResponse are strings
		const typeSafePayload = payload as Record<string, string>;
		const encodedPayload = Buffer.from(new URLSearchParams(typeSafePayload).toString(), 'utf8')
			.toString('base64');

		const key = await this.key;

		const parsedUrl = new URL(urlBase);
		parsedUrl.searchParams.set('sso', encodedPayload);
		parsedUrl.searchParams.set('sig', await sign(this.crypto, key, encodedPayload));
		return parsedUrl.toString();
	}

	private async decodeDiscoursePayload(encodedPayload: string, hexSignature: string): Promise<URLSearchParams | false> {
		if (!await verify(this.crypto, await this.key, hexSignature, encodedPayload)) {
			return false;
		}

		const payload = Buffer.from(encodedPayload, 'base64').toString('binary');
		return new URLSearchParams(payload);
	}

	private convertGhostMemberToDiscourseSSO(member: GhostMemberWithSubscriptions, nonce: string): DiscourseSSOResponse {
		const {email, uuid, name, avatar_image, subscriptions} = member;

		const memberPayload: DiscourseSSOResponse = {
			nonce,
			email,
			external_id: uuid,
			avatar_url: avatar_image,
		};

		if (name) {
			memberPayload.name = name;
		}

		if (subscriptions?.length > 0) {
			// NOTE: if the group doesn't exist, Discourse won't create it. The likeliness of a new user SSOing with Discourse,
			// and being the first person to be part of the tier is really low, and if that happens, they can re-auth after
			// the group is manually created.
			memberPayload.add_groups = subscriptions
				.map(({tier: {slug}}) => getSlug(slug))
				.join(',');
		}

		return memberPayload;
	}
}
