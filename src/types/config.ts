export type DeleteAction = 'none' | 'sync' | 'suspend' | 'anonymize' | 'delete';

export type SsoMethod = 'secure' | 'obscure';

export type Configuration = {
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
};
