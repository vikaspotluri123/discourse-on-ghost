import {type Response} from 'node-fetch';
import {JSON_MIME_TYPE} from '../lib/constants.js';
import {GhostService} from '../services/ghost.js';
import {inject} from '../lib/injector.js';
import {Configuration} from '../types/config.js';
import {type StatusReporter} from './index.js';

class GhostChecksService extends GhostService {
	public apiKeyError: string | false | undefined = undefined;

	async getApiKeyIssue() {
		if (this.apiKeyError) {
			return this.apiKeyError;
		}

		let response: Response;
		try {
			const headers = {
				authorization: this.getAuthHeader(),
				contentType: JSON_MIME_TYPE,
			};

			response = await this._fetch(this.resolveAdmin('/ghost/api/admin/config/'), {headers});
		} catch {
			this.apiKeyError = 'request to Ghost failed';
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

	async checkNoAuthRedirect(url: string) {
		const response = await this._fetch(url);
		return response.ok;
	}
}

export async function checkGhostApiKey({pass, fail}: StatusReporter) {
	const ghostService = inject(GhostChecksService);
	const apiKeyIssue = await ghostService.getApiKeyIssue();
	if (!apiKeyIssue) {
		pass();
		return;
	}

	fail(apiKeyIssue);
}

export async function checkGhostSsoUrl({pass, fail, skip}: StatusReporter) {
	const config = inject(Configuration);
	if (config.ssoMethod === 'jwt') {
		skip('N/A for session-based authentication');
		return;
	}

	if (!config.noAuthRedirect) {
		skip('Default page used');
		return;
	}

	if (await inject(GhostChecksService).checkNoAuthRedirect(config.noAuthRedirect)) {
		pass();
	}

	fail();
}
