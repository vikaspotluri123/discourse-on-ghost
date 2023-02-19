import {type Handler, type Request, type Response} from 'express';
import {inject} from '../lib/injector.js';
import {Queue} from '../lib/queue.js';
import {DiscourseSyncService} from '../services/discourse-sync.js';
import {GhostService} from '../services/ghost.js';
import {MemberSyncService} from '../services/member-sync.js';
import {type SsoMethod} from '../types/config.js';
import {Logger} from '../types/logger.js';

type Controllers = [syncTiers: Handler, clearCaches: Handler];

const MINIMUM_SYNC_WAIT = 60_000; // 1 Minute

export class AdminController {
	private readonly _logger = inject(Logger);
	private readonly _discourse = inject(DiscourseSyncService);
	private readonly _member = inject(MemberSyncService);
	private readonly _ghost = inject(GhostService);
	private _lastSync = 0;
	private readonly _queue = new Queue(300);

	constructor() {
		this.syncTiers = this.syncTiers.bind(this);
		this._syncTiers = this._syncTiers.bind(this);
		this.clearCaches = this.clearCaches.bind(this);
	}

	never(_: Request, response: Response) {
		response.status(501).json({error: 'DoG Administration is not available for JWT SSO'});
	}

	get(ssoMethod: SsoMethod): Controllers {
		if (ssoMethod === 'jwt') {
			return [this.never, this.never];
		}

		return [this.syncTiers, this.clearCaches];
	}

	private async clearCaches(request: Request, response: Response) {
		if (!await this._assertLoggedIn(request, response)) {
			return;
		}

		this._member.resetKnownGroups();
		response.status(200).json({message: 'Caches cleared'});
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
