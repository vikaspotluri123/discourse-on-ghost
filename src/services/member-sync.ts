import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import {Logger} from '../types/logger.js';
import type {GhostService} from './ghost.js';
import {getNiceName, getSlug, type DiscourseService} from './discourse.js';

type Queable = 'syncGroups' | 'setDiscourseGroupsFromTiers' | 'deleteDiscourseUser' | 'anonymizeDiscourseUser' | 'suspendDiscourseUser';

export class MemberSyncService {
	private readonly _queue = new Queue(this.logger);

	constructor(
		readonly logger: Logger,
		readonly _discourseService: DiscourseService,
		readonly _ghostService: GhostService,
	) {
		this.syncGroups = this.syncGroups.bind(this);
		this.setDiscourseGroupsFromTiers = this.setDiscourseGroupsFromTiers.bind(this);
		this.deleteDiscourseUser = this.deleteDiscourseUser.bind(this);
		this.anonymizeDiscourseUser = this.anonymizeDiscourseUser.bind(this);
		this.suspendDiscourseUser = this.suspendDiscourseUser.bind(this);
	}

	async syncGroups(ghostId: string) {
		const user = await this._ghostService.getMember(ghostId);

		if (!user) {
			return false;
		}

		return this.setDiscourseGroupsFromTiers(user.uuid, user.tiers);
	}

	async setDiscourseGroupsFromTiers(uuid: string, tiers: GhostTier[]) {
		const mappedGroups = tiers.map(tier => ({
			name: getSlug(tier.slug),
			niceName: getNiceName(tier.name),
		}));

		return this._discourseService.setMemberGroups(uuid, mappedGroups);
	}

	async deleteDiscourseUser(uuid: string) {
		return this._discourseService.deleteExternalUser(uuid);
	}

	async anonymizeDiscourseUser(uuid: string) {
		return this._discourseService.anonymizeExternalUser(uuid);
	}

	async suspendDiscourseUser(uuid: string) {
		return this._discourseService.suspendExternalUser(uuid);
	}

	has(id: string) {
		return this._queue.has(id);
	}

	queue<T extends Queable>(id: string, action: T, ...args: Parameters<MemberSyncService[T]>) {
		void this._queue.add(id, this[action], ...args);
	}
}
