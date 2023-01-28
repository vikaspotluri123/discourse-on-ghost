import {createInjectionToken} from '../lib/injector.js';

export type DeleteAction = 'none' | 'sync' | 'suspend' | 'anonymize' | 'delete';

export type SsoMethod = 'secure' | 'obscure';

export type ConfigurationType = { // eslint-disable-line @typescript-eslint/consistent-type-definitions
	hostname: string;
	port: number;
	discourseSecret: string;
	discourseUrl: string; /* Specifically: url */
	discourseApiKey: string;
	discourseApiUser: string;
	ghostUrl: string; /* Specifically: url */
	mountedPublicUrl: string;
	mountedBasePath: string; /* Specifically: path */
	ghostApiKey: string;
	logDiscourseRequests: boolean;
	logGhostRequests: boolean;
	enableGhostWebhooks: boolean;
	ghostMemberUpdatedRoute: string;
	ghostMemberDeletedRoute: string;
	ghostMemberDeleteDiscourseAction: DeleteAction;
	ssoMethod: SsoMethod;
	noAuthRedirect: string;
	obscureGhostSSOPath: string;
};

export const Configuration = createInjectionToken<ConfigurationType>('Configuration');
