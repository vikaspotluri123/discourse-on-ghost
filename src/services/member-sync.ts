import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import {ghostService} from './ghost.js';
import {getNiceName, getSlug, discourseService} from './discourse.js';

export async function syncMemberGroups(ghostId: string) {
	const user = await ghostService.getMember(ghostId);

	if (!user) {
		return false;
	}

	return setDiscourseGroupsFromGhostTiers(user.uuid, user.tiers);
}

export async function setDiscourseGroupsFromGhostTiers(uuid: string, tiers: GhostTier[]) {
	const mappedGroups = tiers.map(tier => ({
		name: getSlug(tier.slug),
		niceName: getNiceName(tier.name),
	}));

	return discourseService.setMemberGroups(uuid, mappedGroups);
}

export const memberSyncQueue = new Queue();
