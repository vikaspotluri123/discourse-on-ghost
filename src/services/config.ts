import {ConfigValidator} from '../lib/config-validation.js';
import {IsomorphicCore} from '../types/isomorph.js';
import {uResolve} from '../lib/u-resolve.js';
import {type SsoMethod, type Configuration as RawConfiguration} from '../types/config.js';
import {type Dependency, inject} from '../lib/injector.js';
import {Logger} from '../types/logger.js';

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

	const jwtGhostSSOPathFallback = mapping.obscureGhostSSOPath ? '' : '/sso/';

	return validator.add(
		validator.for('hostname').optional('127.0.0.1'),
		validator.for('port').optional(3286).numeric({min: 0, max: 65_535}),
		validator.for('ghostUrl').url(),
		validator.for('ghostAdminUrl').url().optional(null!),
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
		validator.for('ssoMethod').optional('session')
			.enum('session', 'jwt', /** deprecated: */ 'secure', 'obscure')
			.transforms(value => {
				if (value === 'secure' || value === 'obscure') {
					const logger = inject(Logger);
					const replacement: SsoMethod = value === 'secure' ? 'session' : 'jwt';
					const envKey = mapping.ssoMethod;
					logger.warn(`Config: ${envKey} type "${value}" is deprecated in favor of "${replacement}" and will be removed in a future version.`);
					return replacement;
				}

				// The if statement handles the invalid parts of the enum
				return value as SsoMethod;
			}),
		validator.for('noAuthRedirect').optional('').url(),
		validator.for('jwtGhostSSOPath')
			// Empty string as a default to allow obscureGhostSSOPath to be the fallback until it's removed
			.optional(jwtGhostSSOPathFallback /** review when removing obscureGhostSSOPath */)
			.transforms(value => {
				// REMOVE THIS BLOCK WHEN obscureGhostSSOPath IS REMOVED
				if (value === '') {
					return value;
				}

				if (!/^\/[a-z\d-_/]+\/$/.test(value)) {
					throw new Error(`${value} is not an absolute path`);
				}

				return value;
			}),
		validator.for('obscureGhostSSOPath').optional('/sso/').transforms(value => {
			if (value === '/sso/') {
				return value;
			}

			const obscureKey = mapping.obscureGhostSSOPath;
			const jwtKey = mapping.jwtGhostSSOPath;
			const logger = inject(Logger);

			logger.warn(`${obscureKey} is deprecated in favor of ${jwtKey} and will be removed in a future version.`);
			logger.warn('Note: you will have to make changes to your SSO page. Please review the release notes.');
			if (!/^\/[a-z\d-_/]+\/$/.test(value)) {
				throw new Error(`${value} is not an absolute path`);
			}

			return value;
		}),
	).finalize();
}

export const deferGetConfig = (...args: Parameters<typeof getConfig>) => () => getConfig(...args);
