import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import {getMember} from './ghost.js';
import {getNiceName, getSlug, setMemberGroups} from './discourse.js';

export async function syncMemberGroups(ghostId: string) {
	const user = await getMember(ghostId);

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

	return setMemberGroups(uuid, mappedGroups);
}

export const memberSyncQueue = new Queue();
