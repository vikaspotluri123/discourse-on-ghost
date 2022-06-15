import {Buffer} from 'node:buffer';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {Request, Response} from 'express';
import fetch from 'node-fetch';
import {getGhostUrl} from '../services/ghost-url.js';
import {discourseSecret} from '../services/config.js';
import {GhostMember} from '../types/ghost.js';

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

function addEncodedPayloadToDiscourseReturnUrl(payload: Record<string, string>, secret: string, urlBase: string) {
	const encodedPayload = Buffer.from(new URLSearchParams(payload).toString(), 'utf8')
		.toString('base64');

	const signature = createHmac('sha256', secret)
		.update(encodedPayload)
		.digest('hex');

	const parsedUrl = new URL(urlBase);
	parsedUrl.searchParams.set('sso', encodedPayload);
	parsedUrl.searchParams.set('sig', signature);
	return parsedUrl.toString();
}

async function getMember(cookie: string): Promise<GhostMember | MemberError> {
	const proxyResponse = await fetch(MEMBERS_WHOAMI_ENDPOINT, {
		headers: {cookie},
	});

	if (proxyResponse.status === 204) {
		return MemberError.NotLoggedIn;
	}

	if (proxyResponse.status !== 200) {
		return MemberError.InternalError;
	}

	return proxyResponse.json() as Promise<GhostMember>;
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
	const {email, uuid, name, avatar_image} = memberResponse;

	const memberPayload: Record<string, string> = {
		nonce,
		email,
		external_id: uuid,
		avatar_url: avatar_image,
	};

	if (name) {
		memberPayload.name = name;
	}

	response.redirect(addEncodedPayloadToDiscourseReturnUrl(memberPayload, discourseSecret, discourseRedirect));
}
