import {Buffer} from 'node:buffer';
import {randomFillSync} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {config} from 'dotenv';
import logging from '@tryghost/logging';
import errors from '@tryghost/errors';

interface IConfig {
	DOG_HOSTNAME?: string;
	DOG_PORT?: string;
	DOG_GHOST_URL?: string;
	DOG_DISCOURSE_SHARED_SECRET?: string;
	DOG_GHOST_ADMIN_TOKEN?: string;
	DOG_DISCOURSE_URL?: string;
	DOG_DISCOURSE_API_KEY?: string;
	DOG_DISCOURSE_API_USER?: string;
	DOG_LOG_DISCOURSE_REQUESTS?: string;
	DOG_LOG_GHOST_REQUESTS?: string;
	DOG_GHOST_MEMBER_WEBHOOKS_ENABLED?: string;
	DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID?: string;
	DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID?: string;
	DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID?: string;
}

config();
let success = true;
const {
	DOG_HOSTNAME, DOG_PORT,
	DOG_GHOST_URL,
	DOG_DISCOURSE_SHARED_SECRET,
	DOG_GHOST_ADMIN_TOKEN,
	DOG_DISCOURSE_API_KEY, DOG_DISCOURSE_URL, DOG_DISCOURSE_API_USER,
	DOG_LOG_DISCOURSE_REQUESTS, DOG_LOG_GHOST_REQUESTS,
	DOG_GHOST_MEMBER_WEBHOOKS_ENABLED,
	DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID, DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID, DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID,
} = process.env as IConfig;

const HEX_24 = /^[\da-f]{24}$/;
const EXAMPLE_HEX_24 = 'BAFF1EDBEADEDCAFEBABB1ED';

const messages = {
	missingHostname: 'Missing required environment variable: DOG_HOSTNAME',
	missingPort: 'Missing required environment variable: DOG_PORT',
	invalidPort: 'Invalid required environment variable: DOG_PORT must be a number',
	missingGhostUrl: 'Missing required environment variable: DOG_GHOST_URL',
	invalidGhostUrl: 'Invalid required environment variable: DOG_GHOST_URL must be a valid URL',
	missingSharedSecret: 'Missing required environment variable: DOG_DISCOURSE_SHARED_SECRET',
	missingGhostAdminApiKey: 'Missing required environment variable: DOG_GHOST_ADMIN_TOKEN',
	invalidGhostAdminApiKey: 'Invalid required environment variable: DOG_GHOST_ADMIN_TOKEN must match [\\da-f]{24}:[\\da-f]{64}',
	missingDiscourseUrl: 'Missing required environment variable: DOG_DISCOURSE_URL',
	invalidDiscourseUrl: 'Invalid required environment variable: DOG_DISCOURSE_URL must be a valid URL',
	missingDiscourseApiKey: 'Missing required environment variable: DOG_DISCOURSE_API_KEY',
	invalidDiscourseApiKey: 'Invalid required environment variable: DOG_DISCOURSE_API_KEY must match [\\da-f]{64}',
	missingGhostMemberWebhookId: (type: string) =>
		`Missing required environment variable: DOG_GHOST_MEMBER_${type.toUpperCase()}_WEBHOOK_ID`,
	invalidGhostMemberWebhookId: (type: string) =>
		`Invalid required environment variable: DOG_GHOST_MEMBER_${type.toUpperCase()}_WEBHOOK_ID must match [\\da-f]{24} `
		+ `and not be the example (${EXAMPLE_HEX_24}). Try ${randomFillSync(Buffer.alloc(12)).toString('hex')}`,
};

if (!DOG_HOSTNAME) {
	logging.error(new errors.InternalServerError({message: messages.missingHostname}));
	success = false;
}

if (!DOG_PORT) {
	logging.error(new errors.InternalServerError({message: messages.missingPort}));
	success = false;
}

if (Number.isNaN(Number(DOG_PORT)) || Number(DOG_PORT) < 0 || Number(DOG_PORT) > 65_535) {
	logging.error(new errors.InternalServerError({message: messages.invalidPort}));
	success = false;
}

if (!DOG_DISCOURSE_SHARED_SECRET) {
	logging.error(new errors.InternalServerError({message: messages.missingSharedSecret}));
	success = false;
}

if (DOG_GHOST_ADMIN_TOKEN) {
	if (!/^[\da-f]{24}:[\da-f]{64}$/.test(DOG_GHOST_ADMIN_TOKEN)) {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostAdminApiKey}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostAdminApiKey}));
	success = false;
}

if (DOG_DISCOURSE_URL) {
	try {
		// We're only checking that the URL is valid, and the constructor will throw if it's not.
		new URL(DOG_DISCOURSE_URL); // eslint-disable-line no-new
	} catch {
		logging.error(new errors.InternalServerError({message: messages.invalidDiscourseUrl}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingDiscourseUrl}));
	success = false;
}

if (DOG_DISCOURSE_API_KEY) {
	if (!/^[\da-f]{64}$/.test(DOG_DISCOURSE_API_KEY)) {
		logging.error(new errors.InternalServerError({message: messages.invalidDiscourseApiKey}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingDiscourseApiKey}));
	success = false;
}

let parsedMountUrl: URL;

if (DOG_GHOST_URL) {
	try {
		parsedMountUrl = new URL(DOG_GHOST_URL);
		parsedMountUrl.pathname = path.resolve(parsedMountUrl.pathname, './ghost/api/external_discourse_on_ghost');
	} catch {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostUrl}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostUrl}));
	success = false;
}

if (DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID) {
	if (!HEX_24.test(DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID) || DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID === EXAMPLE_HEX_24) {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostMemberWebhookId('created')}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostMemberWebhookId('created')}));
}

if (DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID) {
	if (!HEX_24.test(DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID) || DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID === EXAMPLE_HEX_24) {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostMemberWebhookId('created')}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostMemberWebhookId('created')}));
}

if (DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID) {
	if (!HEX_24.test(DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID) || DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID === EXAMPLE_HEX_24) {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostMemberWebhookId('created')}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostMemberWebhookId('created')}));
}

if (!success) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

function coerceEnvToBoolean(envVar: string | undefined, defaultValue: boolean): boolean {
	if (envVar === undefined || envVar === '') {
		return defaultValue;
	}

	return envVar === 'true' || envVar === '1';
}

export const hostname = DOG_HOSTNAME!;
export const port = Number(DOG_PORT!);
export const discourseSecret = DOG_DISCOURSE_SHARED_SECRET!;
export const discourseUrl = DOG_DISCOURSE_URL!;
export const discourseApiKey = DOG_DISCOURSE_API_KEY!;
export const discourseApiUser = DOG_DISCOURSE_API_USER ?? 'system';
export const ghostUrl = DOG_GHOST_URL!;
export const mountedPublicUrl = parsedMountUrl!.toString();
export const mountedBasePath = parsedMountUrl!.pathname;
export const ghostApiKey = DOG_GHOST_ADMIN_TOKEN!;
export const logDiscourseRequests = coerceEnvToBoolean(DOG_LOG_DISCOURSE_REQUESTS, false);
export const logGhostRequests = coerceEnvToBoolean(DOG_LOG_GHOST_REQUESTS, false);
export const enableGhostWebhooks = coerceEnvToBoolean(DOG_GHOST_MEMBER_WEBHOOKS_ENABLED, false);
export const ghostMemberCreatedRoute = DOG_GHOST_MEMBER_CREATED_WEBHOOK_ID!;
export const ghostMemberUpdatedRoute = DOG_GHOST_MEMBER_UPDATED_WEBHOOK_ID!;
export const ghostMemberDeletedRoute = DOG_GHOST_MEMBER_DELETED_WEBHOOK_ID!;
