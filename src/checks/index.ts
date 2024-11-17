import {checkDiscourseApiKey, discourseSettingsChecks} from './discourse.js';
import {checkGhostApiKey, checkGhostSsoUrl} from './ghost.js';

export interface DiffFailure {
	expected: string;
	actual: string;
}

export interface StatusReporter {
	pass(message?: string): void;
	fail(message?: string | undefined | DiffFailure): void;
	skip(message?: string): void;
}

export interface CheckGroup {
	name: string;
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
		description: 'Check if the API key is valid',
		run: checkDiscourseApiKey,
	}, {
		name: 'Connect Settings',
		children: discourseSettingsChecks('connect'),
	}, {
		name: 'General Settings',
		children: discourseSettingsChecks('general'),
	}],
}, {
	name: 'Ghost',
	children: [{
		name: 'API Key',
		description: 'Check if the API key is valid',
		run: checkGhostApiKey,
	}, {
		name: 'SSO Page',
		description: 'Check if the SSO page is valid',
		run: checkGhostSsoUrl,
	}],
}];
