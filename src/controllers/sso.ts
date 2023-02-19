import {type Request, type Response} from 'express';
import {GhostService} from '../services/ghost.js';
import {type GhostMemberWithSubscriptions} from '../types/ghost.js';
import {type DiscourseSSOResponse} from '../types/discourse.js';
import {getSlug} from '../services/discourse.js';
import {Configuration} from '../types/config.js';
import {type CryptoService} from '../services/crypto.js';
import {IsomorphicCore} from '../types/isomorph.js';
import {type Dependency, inject} from '../lib/injector.js';

const enum MemberError {
	NotLoggedIn = 'NotLoggedIn',
	InternalError = 'InternalError',
}

export class SSOController {
	private readonly core = inject(IsomorphicCore);
	private readonly _ghostService = inject(GhostService);
	private readonly key: ReturnType<CryptoService['secretToKey']>;
	private readonly _login: string;
	private readonly _obscureRedirect: string;

	constructor() {
		const config = inject(Configuration);
		// Don't use nullish coalescing here since the default value for `noAuthRedirect` is an empty string
		this._login = config.noAuthRedirect || this._ghostService.resolvePublic('/', '#/portal/account');

		// The prefixed period is to make the absolute URL relative.
		this._obscureRedirect = new URL(`.${config.obscureGhostSSOPath}`, config.ghostUrl).href;
		this.key = this.core.crypto.secretToKey(config.discourseSecret);
	}

	controllerFor(ssoMethod: Dependency<typeof Configuration>['ssoMethod']) {
		if (ssoMethod === 'obscure') {
			return this.obscurelyAuthorizeUser.bind(this);
		}

		return this.securelyAuthorizeUser.bind(this);
	}

	async getMemberWithCookie(cookie: string): Promise<GhostMemberWithSubscriptions | MemberError> {
		const proxyResponse = await this.core.fetch(this._ghostService.resolvePublic('/members/api/member'), {
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

		if (memberResponse === MemberError.NotLoggedIn || !memberResponse) {
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
		const {sso, sig, obscure} = request.query;

		if (!sso || !sig || Array.isArray(sso) || Array.isArray(sig) || typeof sso !== 'string' || typeof sig !== 'string') {
			if (!obscure) {
				response.redirect(302, this._obscureRedirect + '?error=direct_access');
				return;
			}

			response.status(400).json({message: 'Client Error: SSO and signature are required and must not be arrays'});
			return;
		}

		if (!obscure) {
			const next = new URL(this._obscureRedirect);
			next.searchParams.set('sso', sso);
			next.searchParams.set('sig', sig);
			response.redirect(302, next.href);
			return;
		}

		if (!request.headers.authorization?.startsWith('GhostMember ')) {
			response.status(401).json({message: 'Client Error: Missing JWT to prove membership'});
			return;
		}

		const jwt = request.headers.authorization.split('GhostMember ').pop()!.trim();
		const decodedJwt = await this._ghostService.decodeMemberJwt(jwt);

		if (!decodedJwt.success) {
			const context = decodedJwt.error instanceof Error ? `\nContext: ${decodedJwt.error.message}` : '';
			response.status(401).json({message: 'Client Error: Invalid JWT provided to prove membership' + context});
			return;
		}

		const rawDiscoursePayload = await this.decodeDiscoursePayload(sso, sig);

		if (!rawDiscoursePayload) {
			response.status(400).json({message: 'Unable to verify signature'});
			return;
		}

		const email = decodedJwt.payload;
		const member = await this._ghostService.getMemberByEmail(email);

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
		const encodedPayload = this.core.encoding.btoa(new URLSearchParams(typeSafePayload).toString());

		const key = await this.key;

		const parsedUrl = new URL(urlBase);
		parsedUrl.searchParams.set('sso', encodedPayload);
		parsedUrl.searchParams.set('sig', await this.core.crypto.sign(key, encodedPayload));
		return parsedUrl.toString();
	}

	private async decodeDiscoursePayload(encodedPayload: string, hexSignature: string): Promise<URLSearchParams | false> {
		if (!await this.core.crypto.verify(await this.key, hexSignature, encodedPayload)) {
			return false;
		}

		const payload = this.core.encoding.atob(encodedPayload);
		return new URLSearchParams(payload);
	}

	private convertGhostMemberToDiscourseSSO(member: GhostMemberWithSubscriptions, nonce: string): DiscourseSSOResponse {
		const {email, uuid, name, avatar_image, subscriptions} = member;

		const parsedAvatar = new URL(avatar_image);

		if (parsedAvatar.hostname.endsWith('gravatar.com')) {
			// @see https://en.gravatar.com/site/implement/images/#default-image
			const invalidDefaultType = 'blank';
			const defaultReplacement = 'identicon';
			if (parsedAvatar.searchParams.get('d')?.toLowerCase() === invalidDefaultType) {
				parsedAvatar.searchParams.set('d', defaultReplacement);
			}

			if (parsedAvatar.searchParams.get('default')?.toLowerCase() === invalidDefaultType) {
				parsedAvatar.searchParams.set('default', defaultReplacement);
			}
		}

		const memberPayload: DiscourseSSOResponse = {
			nonce,
			email,
			external_id: uuid,
			avatar_url: parsedAvatar.toString(),
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
