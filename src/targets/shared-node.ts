import {Buffer} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import fetch from 'node-fetch';
import logging from '@tryghost/logging';
import {CryptoService, type WebCrypto} from '../services/crypto.js';
import {type Configuration} from '../types/config.js';
import {type IsomorphicCore} from '../types/isomorph.js';
import type {Dependency} from '../lib/injector.js';

export const envToConfigMapping: Record<keyof Dependency<typeof Configuration>, string> = {
	hostname: 'DOG_HOSTNAME',
	port: 'DOG_PORT',
	discourseSecret: 'DOG_DISCOURSE_SHARED_SECRET',
	discourseUrl: 'DOG_DISCOURSE_URL',
	discourseApiKey: 'DOG_DISCOURSE_API_KEY',
	discourseApiUser: 'DOG_DISCOURSE_API_USER',
	ghostUrl: 'DOG_GHOST_URL',
	ghostAdminUrl: 'DOG_GHOST_ADMIN_URL',
	mountedPublicUrl: 'DOG_GHOST_URL',
	mountedBasePath: 'DOG_GHOST_URL',
	ghostApiKey: 'DOG_GHOST_ADMIN_TOKEN',
	logDiscourseRequests: 'DOG_LOG_DISCOURSE_REQUESTS',
	logGhostRequests: 'DOG_LOG_GHOST_REQUESTS',
	enableGhostWebhooks: 'DOG_GHOST_MEMBER_WEBHOOKS_ENABLED',
	ghostMemberUpdatedRoute: 'DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID',
	ghostMemberDeletedRoute: 'DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID',
	ghostMemberDeleteDiscourseAction: 'DOG_GHOST_MEMBER_DELETE_DISCOURSE_ACTION',
	ssoMethod: 'DOG_DISCOURSE_SSO_TYPE',
	noAuthRedirect: 'DOG_SSO_NO_AUTH_REDIRECT',
	/** @deprecated */
	obscureGhostSSOPath: 'DOG_OBSCURE_GHOST_SSO_PAGE',
	jwtGhostSSOPath: 'DOG_JWT_GHOST_SSO_PAGE',
} as const;

export const core: Dependency<typeof IsomorphicCore> = {
	fetch,
	crypto: new CryptoService(webcrypto as unknown as WebCrypto),
	logger: logging,
	encoding: {
		atob: (text: string) => Buffer.from(text, 'base64').toString('utf8'),
		btoa: (binary: string) => Buffer.from(binary, 'utf8').toString('base64'),
	},
};
