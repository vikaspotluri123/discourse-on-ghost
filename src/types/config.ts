import {createInjectionToken} from '../lib/injector.js';

export type DeleteAction = 'none' | 'sync' | 'suspend' | 'anonymize' | 'delete';

export type SsoMethod = 'session' | 'jwt';

export type ConfigurationType = { // eslint-disable-line @typescript-eslint/consistent-type-definitions
	hostname: string;
	port: number;
	discourseSecret: string;
	discourseUrl: string; /* Specifically: url */
	discourseApiKey: string;
	discourseApiUser: string;
	ghostUrl: string; /* Specifically: url */
	ghostAdminUrl: string; /* Specifically: url */
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
	/** @deprecated */
	obscureGhostSSOPath: string;
	jwtGhostSSOPath: string;
};

export const Configuration = createInjectionToken<ConfigurationType>('Configuration');
