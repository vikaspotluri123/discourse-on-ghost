import {Buffer} from 'node:buffer';
import {randomFillSync} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import {Configuration} from '../types/config.js';
import {ConfigValidator} from '../lib/config-validation.js';

loadEnv();

const HEX_24 = /^[\da-f]{24}$/;
const EXAMPLE_HEX_24 = 'BAFF1EDBEADEDCAFEBABB1ED';
const getRandomHex = () => randomFillSync(Buffer.alloc(12)).toString('hex');

const envToConfigMapping: Record<keyof Configuration, string> = {
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

const validator = new ConfigValidator<Configuration>(process.env, envToConfigMapping);

const getMountedUrl = (value: string) => {
	const parsed = new URL(value);
	parsed.pathname = path.resolve(parsed.pathname, './ghost/api/external_discourse_on_ghost');
	return parsed;
};

const possibleConfig = validator.add(
	validator.for('hostname').optional('127.0.0.1'),
	validator.for('port').optional(3286).numeric({min: 0, max: 65_535}),
	validator.for('ghostUrl').url(),
	validator.for('discourseSecret'),
	validator.for('ghostApiKey').matches(/^[\da-f]{24}:[\da-f]{64}$/),
	validator.for('discourseUrl').url(),
	validator.for('discourseApiKey').matches(/^[\da-f]{64}$/),
	validator.for('discourseApiUser').optional('system'),
	validator.for('logDiscourseRequests').boolean(false),
	validator.for('logGhostRequests').boolean(false),
	validator.for('enableGhostWebhooks').boolean(false),
	validator.for('ghostMemberUpdatedRoute').matches(HEX_24).not(EXAMPLE_HEX_24).suggests(getRandomHex),
	validator.for('ghostMemberDeletedRoute').matches(HEX_24).not(EXAMPLE_HEX_24).suggests(getRandomHex),
	validator.for('ghostMemberDeleteDiscourseAction')
		.enum('none', 'sync', 'suspend', 'anonymize', 'delete'),
	validator.for('mountedPublicUrl').url().transforms(value => getMountedUrl(value).pathname),
	validator.for('mountedBasePath').url().transforms(value => getMountedUrl(value).toString()),
	validator.for('ssoMethod').optional('secure').enum('secure', 'obscure'),
	validator.for('noAuthRedirect').optional('').url(),
).finalize();

if (!possibleConfig) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

export const config = possibleConfig;
