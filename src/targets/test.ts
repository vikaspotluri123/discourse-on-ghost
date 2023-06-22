import {bootstrapInjector} from '../services/dependency-injection.js';
import type {ConfigurationType} from '../types/config.js';
import {core} from './shared-node.js';

const testConfig: ConfigurationType = {
	discourseApiKey: '',
	discourseApiUser: '',
	discourseSecret: '',
	discourseUrl: '',
	enableGhostWebhooks: false,
	ghostAdminUrl: 'http://ghost.local',
	ghostApiKey: 'abcdefabcdefabcdefabcdef:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
	ghostMemberDeleteDiscourseAction: 'none',
	ghostMemberDeletedRoute: '',
	ghostMemberUpdatedRoute: '',
	ghostUrl: 'http://ghost.local',
	hostname: '',
	jwtGhostSSOPath: '',
	logDiscourseRequests: false,
	logGhostRequests: false,
	mountedBasePath: '',
	mountedPublicUrl: '',
	noAuthRedirect: '',
	port: 0,
	ssoMethod: 'session',
	obscureGhostSSOPath: '',
};

bootstrapInjector(core, () => testConfig);
