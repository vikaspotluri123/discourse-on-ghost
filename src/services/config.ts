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
}

config();
let success = true;
const {DOG_HOSTNAME, DOG_PORT, DOG_GHOST_URL, DOG_DISCOURSE_SHARED_SECRET} = process.env as IConfig;

const messages = {
	missingHostname: 'Missing required environment variable: DOG_HOSTNAME',
	missingPort: 'Missing required environment variable: DOG_PORT',
	invalidPort: 'Invalid required environment variable: DOG_PORT must be a number',
	missingGhostUrl: 'Missing required environment variable: DOG_GHOST_URL',
	invalidGhostUrl: 'Invalid required environment variable: DOG_GHOST_URL must be a valid URL',
	missingSharedSecret: 'Missing required environment variable: DOG_DISCOURSE_SHARED_SECRET',
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

let parsedGhostUrl: URL;

if (DOG_GHOST_URL) {
	try {
		parsedGhostUrl = new URL(DOG_GHOST_URL);
		parsedGhostUrl.pathname = path.resolve(parsedGhostUrl.pathname, './ghost/api/external_discourse_on_ghost');
	} catch {
		logging.error(new errors.InternalServerError({message: messages.invalidGhostUrl}));
		success = false;
	}
} else {
	logging.error(new errors.InternalServerError({message: messages.missingGhostUrl}));
	success = false;
}

if (!success) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

export const hostname = DOG_HOSTNAME!;
export const port = Number(DOG_PORT!);
export const discourseSecret = DOG_DISCOURSE_SHARED_SECRET!;
export const ghostUrl = parsedGhostUrl!.toString();
export const basePath = parsedGhostUrl!.pathname;
