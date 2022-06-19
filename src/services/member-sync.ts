import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import type {GhostService} from './ghost.js';
import {getNiceName, getSlug, type DiscourseService} from './discourse.js';

export class MemberSyncService {
	public readonly queue = new Queue();

	constructor(
		readonly _discourseService: DiscourseService,
		readonly _ghostService: GhostService,
	) {}

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
}
