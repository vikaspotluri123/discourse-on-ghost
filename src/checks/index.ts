import {checkDiscourseApiKey, discourseSettingsChecks} from './discourse.js';
import {checkGhostApiKey, checkGhostSsoUrl} from './ghost.js';

export interface DiffFailure {
	expected: string;
	actual: string;
}

export interface StatusReporter {
	pass(message?: string): void;
	warn(message?: string | undefined | DiffFailure): void;
	fail(message?: string | undefined | DiffFailure): void;
	skip(message?: string): void;
}

export interface CheckGroup {
	name: string;
	description?: string;
	children: Array<Check | CheckGroup>;
}

export interface Check {
	name: string;
	description: string;
	run: (reportStatus: StatusReporter) => unknown;
	skip?: () => string | false;
}

export const checks: CheckGroup[] = [{
	name: 'Discourse',
	children: [{
		name: 'API Key',
		description: 'Verifies that Discourse is functional and the API key is valid.',
		run: checkDiscourseApiKey,
	}, {
		name: 'Connect Settings',
		description: 'Group of checks to verify Discourse Connect related settings.',
		children: discourseSettingsChecks('connect'),
	}, {
		name: 'General Settings',
		children: discourseSettingsChecks('general'),
	}],
}, {
	name: 'Ghost',
	children: [{
		name: 'API Key',
		description: 'Verifies that Discourse Connect is enabled, which is required for DoG to serve as the SSO provider.',
		run: checkGhostApiKey,
	}, {
		name: 'SSO Page',
		description: 'For session auth, verifies that the SSO page is exists and is accessible.',
		run: checkGhostSsoUrl,
	}],
}];
