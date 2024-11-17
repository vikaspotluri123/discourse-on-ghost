import {type Response} from 'node-fetch';
import {DiscourseService} from '../services/discourse.js';
import {Configuration} from '../types/config.js';
import {inject} from '../lib/injector.js';
import {type StatusReporter, type Check} from './index.js';

type RawDiscourseSettings = Record<string, string>;

interface DiscourseSetting {
	name: string;
	description: string;
	category: 'connect' | 'general';
	value: string;
}

export const DISCOURSE_SETTINGS: DiscourseSetting[] = [{
	name: 'enable_discourse_connect',
	description: 'Configures Discourse to use DoG for logging users in',
	category: 'connect',
	value: 'true',
}, {
	name: 'discourse_connect_url',
	description: 'Configures the DoG URL for Discourse Connect',
	category: 'connect',
	get value() {
		return new URL('ghost/api/external_discourse_on_ghost/sso', inject(Configuration).ghostAdminUrl).href;
	},
}, {
	name: 'discourse_connect_secret',
	description: 'Configures the shared secret between Discourse and DoG',
	category: 'connect',
	get value() {
		return inject(Configuration).discourseSecret;
	},
}, {
	name: 'auth_overrides_name',
	description: 'Configures Discourse to only use the Member\'s name from Ghost',
	category: 'general',
	value: 'true',
}, {
	name: 'auth_overrides_email',
	description: 'Configures Discourse to only use the Member\'s email from Ghost',
	category: 'general',
	value: 'true',
}, {
	name: 'discourse_connect_overrides_avatar',
	description: 'Configures Discourse to only use the Member\'s avatar from Ghost',
	category: 'general',
	value: 'true',
}];

class DiscourseChecksService extends DiscourseService {
	public apiKeyError: string | false | undefined = undefined;
	private _cachedSiteSettings: RawDiscourseSettings | undefined;

	async getApiKeyIssue() {
		if (this.apiKeyError) {
			return this.apiKeyError;
		}

		let response: Response;
		try {
			response = await this._fetch(this.resolve('/session/current.json'), this.getHeaders());
		} catch {
			this.apiKeyError = 'request to Discourse failed';
			return this.apiKeyError;
		}

		if (response.status === 403) {
			this.apiKeyError = 'Invalid API key';
			return this.apiKeyError;
		}

		if (!response.ok) {
			this.apiKeyError = `Unexpected response (${response.status})`;
			return this.apiKeyError;
		}

		const contentType = response.headers.get('content-type') ?? '[missing]';
		if (!contentType.includes('application/json')) {
			this.apiKeyError = `Unexpected content type (${contentType})`;
			return this.apiKeyError;
		}

		await response.text();
		this.apiKeyError = false;
		return this.apiKeyError;
	}

	async getSiteSettings(): Promise<RawDiscourseSettings | null> { // eslint-disable-line @typescript-eslint/ban-types
		if (this.apiKeyError) {
			return null;
		}

		if (this._cachedSiteSettings) {
			return this._cachedSiteSettings;
		}

		const response = await this._fetch(this.resolve('/admin/site_settings.json'), this.getHeaders());

		const apiResponse = await response.json() as {
			site_settings: Array<{setting: string; value: string}>;
		};

		const settings: RawDiscourseSettings = {};
		for (const {setting: key, value} of apiResponse.site_settings) {
			settings[key] = value;
		}

		this._cachedSiteSettings = settings;
		return settings;
	}

	async getSetting(name: string): Promise<string | undefined> {
		const siteSettings = await this.getSiteSettings();

		if (siteSettings === null) {
			throw new Error('Unable to get site settings');
		}

		return siteSettings[name];
	}
}

async function checkDiscourseSetting(
	{pass, fail, warn, skip}: StatusReporter,
	name: string,
	value: string,
	fatal: boolean,
) {
	const noPass = fatal ? fail : warn;
	const discourseService = inject(DiscourseChecksService);
	if (discourseService.apiKeyError) {
		skip('API not available');
		return;
	}

	const setting = await discourseService.getSetting(name);
	if (setting === undefined) {
		noPass('Not set');
		return;
	}

	if (setting !== value) {
		noPass({expected: value, actual: setting});
		return;
	}

	pass();
}

function createDiscourseSettingCheck(setting: DiscourseSetting, fatal: boolean): Check {
	return {
		name: setting.name,
		description: setting.description,
		// eslint-disable-next-line @typescript-eslint/promise-function-async
		run: report => checkDiscourseSetting(report, setting.name, setting.value, fatal),
	};
}

export async function checkDiscourseApiKey({pass, fail}: StatusReporter) {
	const discourseService = inject(DiscourseChecksService);
	const apiKeyIssue = await discourseService.getApiKeyIssue();
	if (!apiKeyIssue) {
		pass();
		return;
	}

	fail(apiKeyIssue);
}

export const discourseSettingsChecks = (category: 'general' | 'connect') => DISCOURSE_SETTINGS
	.filter(setting => setting.category === category)
	.map(setting => createDiscourseSettingCheck(setting, category === 'connect'));
