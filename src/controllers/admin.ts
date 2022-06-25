import {Handler, Request, Response} from 'express';
import {Queue} from '../lib/queue.js';
import {DiscourseSyncService} from '../services/discourse-sync.js';
import {GhostService} from '../services/ghost.js';
import {SsoMethod} from '../types/config.js';
import {Logger} from '../types/logger.js';

type Controllers = [syncTiers: Handler];

const MINIMUM_SYNC_WAIT = 60_000; // 1 Minute

export class AdminController {
	private _lastSync = 0;
	private readonly _queue = new Queue(this._logger, 300);

	constructor(
		private readonly _logger: Logger,
		private readonly _discourse: DiscourseSyncService,
		private readonly _ghost: GhostService,
	) {
		this.syncTiers = this.syncTiers.bind(this);
		this._syncTiers = this._syncTiers.bind(this);
	}

	never(_: Request, response: Response) {
		response.status(501).json({error: 'DoG Administration is not available for obscure SSO'});
	}

	get(ssoMethod: SsoMethod): Controllers {
		if (ssoMethod === 'obscure') {
			return [this.never];
		}

		return [this.syncTiers];
	}

	private async syncTiers(request: Request, response: Response) {
		if (!await this._assertLoggedIn(request, response)) {
			return;
		}

		if (this._lastSync + MINIMUM_SYNC_WAIT > Date.now()) {
			response.status(429).json({error: 'A sync request recently occurred. Please wait before trying again'});
			return;
		}

		if (this._queue.has('syncTiers')) {
			response.status(200).json({message: 'Syncing Tiers'});
			return;
		}

		const removeUnmappedTiers = request.query.removeUnmappedTiers === 'true';
		void this._queue.add('syncTiers', this._syncTiers, removeUnmappedTiers);
		response.status(200).json({
			message: `Syncing tiers (${removeUnmappedTiers ? '' : 'not'} removing unmapped tiers)`,
		});
	}

	private async _syncTiers(removeUnmappedTiers: boolean) {
		this._lastSync = Date.now();

		try {
			await this._discourse.syncTiersToGroups(removeUnmappedTiers);
		} finally {
			this._lastSync = Date.now();
		}
	}

	private _authError(response: Response, error = 'You must be logged in to access this resource') {
		response.status(401).json({error});
		return false;
	}

	private async _assertLoggedIn(request: Request, response: Response) {
		try {
			const {cookie} = request.headers;
			if (!cookie?.includes('ghost-admin-api-session')) {
				return this._authError(response);
			}

			const user = await this._ghost.authenticateStaffFromCookie(cookie);

			if (!user) {
				return this._authError(response);
			}

			return true;
		} catch (error: unknown) {
			this._logger.error(error);
			return this._authError(response, 'Unable to determine authenticated user');
		}
	}
}
