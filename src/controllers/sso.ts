import {Buffer} from 'node:buffer';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {Request, Response} from 'express';
import fetch from 'node-fetch';
import {ghostService, GhostService} from '../services/ghost.js';
import {GhostMemberWithSubscriptions} from '../types/ghost.js';
import {DiscourseSSOResponse} from '../types/discourse.js';
import {getSlug} from '../services/discourse.js';
import {Configuration} from '../types/config.js';
import {config} from '../services/config.js';

const enum MemberError {
	NotLoggedIn = 'NotLoggedIn',
	InternalError = 'InternalError',
}

export class SSOController {
	private readonly _secret: string;
	private readonly _login: string;

	constructor(config: Configuration, private readonly _ghostService: GhostService) {
		this._secret = config.discourseSecret;
		this._login = config.noAuthRedirect ?? _ghostService.resolve('/', '#/portal/account');
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

		const rawDiscoursePayload = this.decodeDiscoursePayload(sso, sig);

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

		response.redirect(this.addEncodedPayloadToDiscourseReturnUrl(memberPayload, this._secret, discourseRedirect));
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

		const rawDiscoursePayload = this.decodeDiscoursePayload(sso, sig);

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

		response.redirect(this.addEncodedPayloadToDiscourseReturnUrl(memberPayload, this._secret, discourseRedirect));
	}

	private addEncodedPayloadToDiscourseReturnUrl(payload: DiscourseSSOResponse, secret: string, urlBase: string) {
		// @ts-expect-error all values of DiscourseSSOResponse are strings
		const typeSafePayload = payload as Record<string, string>;
		const encodedPayload = Buffer.from(new URLSearchParams(typeSafePayload).toString(), 'utf8')
			.toString('base64');

		const signature = createHmac('sha256', secret)
			.update(encodedPayload)
			.digest('hex');

		const parsedUrl = new URL(urlBase);
		parsedUrl.searchParams.set('sso', encodedPayload);
		parsedUrl.searchParams.set('sig', signature);
		return parsedUrl.toString();
	}

	private decodeDiscoursePayload(encodedPayload: string, signature: string): URLSearchParams | false {
		const payload = Buffer.from(encodedPayload, 'base64').toString('utf8');
		const expectedSignature = createHmac('sha256', this._secret)
			.update(encodedPayload)
			.digest();

		if (!timingSafeEqual(Buffer.from(signature, 'hex'), expectedSignature)) {
			return false;
		}

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

export const ssoController = new SSOController(config, ghostService);
