import {Buffer} from 'node:buffer';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {Request, Response} from 'express';
import fetch from 'node-fetch';
import {getGhostUrl} from '../services/ghost.js';
import {discourseSecret} from '../services/config.js';
import {GhostMember, GhostMemberWithSubscriptions} from '../types/ghost.js';
import {DiscourseSSOResponse} from '../types/discourse.js';
import {DEFAULT_GROUP_PREFIX} from '../services/discourse.js';

const NOT_LOGGED_IN_ENDPOINT = getGhostUrl('/', '#/portal/account');
const MEMBERS_WHOAMI_ENDPOINT = getGhostUrl('/members/api/member');

const enum MemberError {
	NotLoggedIn = 'NotLoggedIn',
	InternalError = 'InternalError',
}

function getDiscoursePayload(encodedPayload: string, signature: string): URLSearchParams | false {
	const payload = Buffer.from(encodedPayload, 'base64').toString('utf8');
	const expectedSignature = createHmac('sha256', discourseSecret)
		.update(encodedPayload)
		.digest();

	if (!timingSafeEqual(Buffer.from(signature, 'hex'), expectedSignature)) {
		return false;
	}

	return new URLSearchParams(payload);
}

function addEncodedPayloadToDiscourseReturnUrl(payload: DiscourseSSOResponse, secret: string, urlBase: string) {
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

async function getMember(cookie: string): Promise<GhostMemberWithSubscriptions | MemberError> {
	const proxyResponse = await fetch(MEMBERS_WHOAMI_ENDPOINT, {
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

export async function securelyAuthorizeUser(request: Request, response: Response) {
	const {sso, sig} = request.query;
	const {cookie} = request.headers;

	if (!sso || !sig || Array.isArray(sso) || Array.isArray(sig) || typeof sso !== 'string' || typeof sig !== 'string') {
		response.status(400).json({message: 'SSO and signature are required and must not be arrays'});
		return;
	}

	if (!cookie) {
		response.redirect(NOT_LOGGED_IN_ENDPOINT);
		return;
	}

	const rawDiscoursePayload = getDiscoursePayload(sso, sig);

	if (!rawDiscoursePayload) {
		response.status(400).json({message: 'Unable to verify signature'});
		return;
	}

	const memberResponse = await getMember(cookie);

	if (memberResponse === MemberError.NotLoggedIn) {
		response.redirect(NOT_LOGGED_IN_ENDPOINT);
		return;
	}

	if (memberResponse === MemberError.InternalError) {
		response.status(500).json({error: 'Unable to get your member information'});
		return;
	}

	const nonce = rawDiscoursePayload.get('nonce')!;
	const discourseRedirect = rawDiscoursePayload.get('return_sso_url')!;
	const {email, uuid, name, avatar_image, subscriptions} = memberResponse;

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
			.map(({tier: {slug}}) => `${DEFAULT_GROUP_PREFIX}${slug}`)
			.join(',');
	}

	response.redirect(addEncodedPayloadToDiscourseReturnUrl(memberPayload, discourseSecret, discourseRedirect));
}
