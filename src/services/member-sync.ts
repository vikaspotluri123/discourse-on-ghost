import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import {getMember} from './ghost.js';
import {DEFAULT_GROUP_PREFIX, setMemberGroups} from './discourse.js';

export async function syncMemberGroups(ghostId: string) {
	const user = await getMember(ghostId);

	if (!user) {
		return false;
	}

	return setDiscourseGroupsFromGhostTiers(user.uuid, user.tiers);
}

export async function setDiscourseGroupsFromGhostTiers(uuid: string, tiers: GhostTier[]) {
	const mappedGroups = tiers.map(tier => ({
		name: `${DEFAULT_GROUP_PREFIX}${tier.slug}`,
		niceName: `${tier.name} Tier`,
	}));

	return setMemberGroups(uuid, mappedGroups);
}

export const memberSyncQueue = new Queue();
