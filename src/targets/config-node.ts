import {Buffer} from 'node:buffer';
import {randomFillSync} from 'node:crypto';
import {Configuration} from '../types/config.js';

export const getRandomHex = () => randomFillSync(Buffer.alloc(12)).toString('hex');

export const envToConfigMapping: Record<keyof Configuration, string> = {
	hostname: 'DOG_HOSTNAME',
	port: 'DOG_PORT',
	discourseSecret: 'DOG_DISCOURSE_SHARED_SECRET',
	discourseUrl: 'DOG_DISCOURSE_URL',
	discourseApiKey: 'DOG_DISCOURSE_API_KEY',
	discourseApiUser: 'DOG_DISCOURSE_API_USER',
	ghostUrl: 'DOG_GHOST_URL',
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
} as const;
