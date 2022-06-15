import {getMember} from './ghost.js';
import {setMemberGroups} from './discourse.js';

export async function syncMemberGroups(ghostId: string) {
	const user = await getMember(ghostId);

	if (!user) {
		return false;
	}

	return setMemberGroups(user.uuid, user.tiers.map(tier => ({
		name: `tier_${tier.slug}`,
		niceName: `${tier.name} Tier`,
	})));
}
