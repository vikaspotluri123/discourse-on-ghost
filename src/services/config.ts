import {ConfigValidator} from '../lib/config-validation.js';
import {IsomorphicCore} from '../types/isomorph.js';
import {uResolve} from '../lib/u-resolve.js';
import {type Configuration as RawConfiguration} from '../types/config.js';
import {type Dependency, inject} from '../lib/injector.js';

type Config = Dependency<typeof RawConfiguration>;

const HEX_24 = /^[\da-f]{24}$/;
const EXAMPLE_HEX_24 = 'BAFF1EDBEADEDCAFEBABB1ED';

export function getConfig(
	rawConfig: Record<string, string | undefined>,
	mapping: Record<keyof Config, string>,
) {
	const {crypto} = inject(IsomorphicCore);
	const validator = new ConfigValidator<Config>(rawConfig, mapping);
	const getRandomHex = () => crypto.getRandomHex(12);
	const getDiscourseSecret = () => crypto.getRandomHex(32);

	const getMountedUrl = (value: string) => {
		const parsed = new URL(value);
		parsed.pathname = uResolve(parsed.pathname, './ghost/api/external_discourse_on_ghost');
		return parsed;
	};

	return validator.add(
		validator.for('hostname').optional('127.0.0.1'),
		validator.for('port').optional(3286).numeric({min: 0, max: 65_535}),
		validator.for('ghostUrl').url(),
		validator.for('discourseSecret').suggests(getDiscourseSecret),
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
		validator.for('mountedPublicUrl').url().transforms(value => getMountedUrl(value).toString()),
		validator.for('mountedBasePath').url().transforms(value => getMountedUrl(value).pathname),
		validator.for('ssoMethod').optional('secure').enum('secure', 'obscure'),
		validator.for('noAuthRedirect').optional('').url(),
		validator.for('obscureGhostSSOPath').optional('/sso/').transforms(value => {
			if (!/^\/[a-z\d-_/]+\/$/.test(value)) {
				throw new Error(`${value} is not an absolute path`);
			}

			return value;
		}),
	).finalize();
}

export const deferGetConfig = (...args: Parameters<typeof getConfig>) => () => getConfig(...args);
