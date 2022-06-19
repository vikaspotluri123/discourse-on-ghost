import {ConfigValidator} from '../lib/config-validation.js';
import {uResolve} from '../lib/u-resolve.js';
import {Configuration} from '../types/config.js';
import {Logger} from '../types/logger.js';
import {WebCrypto, getRandomHex as coreRandom} from './crypto.js';

const HEX_24 = /^[\da-f]{24}$/;
const EXAMPLE_HEX_24 = 'BAFF1EDBEADEDCAFEBABB1ED';

export function getConfig(
	logger: Logger,
	crypto: WebCrypto,
	rawConfig: Record<string, string | undefined>,
	mapping: Record<keyof Configuration, string>,
) {
	const validator = new ConfigValidator<Configuration>(logger, rawConfig, mapping);
	const getRandomHex = () => coreRandom(crypto, 12);

	const getMountedUrl = (value: string) => {
		const parsed = new URL(value);
		parsed.pathname = uResolve(parsed.pathname, './ghost/api/external_discourse_on_ghost');
		return parsed;
	};

	return validator.add(
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
}
