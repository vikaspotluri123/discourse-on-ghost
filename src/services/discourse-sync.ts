import logging from '@tryghost/logging';
import {DEFAULT_GROUP_PREFIX, getNiceName, getSlug, type DiscourseService} from './discourse.js';
import type {GhostService} from './ghost.js';

const LOG_PREFIX = '[discourse:sync]';

export class DiscourseSyncService {
	constructor(
		readonly _discourseService: DiscourseService,
		readonly _ghostService: GhostService,
	) {}

	async syncTiersToGroups(removeUnmappedTiers = false) {
		const tiers = await this._ghostService.getTiers();
		const rawGroups = await this._discourseService.getAllGroups();
		const groups = new Map<string, number>();

		for (const group of rawGroups) {
			if (group.automatic || !group.name.toLowerCase().startsWith(DEFAULT_GROUP_PREFIX)) {
				continue;
			}

			groups.set(group.name, group.id);
		}

		const work = [];

		for (const tier of tiers) {
			const groupSlug = getSlug(tier.slug);
			if (groups.has(groupSlug)) {
				groups.delete(groupSlug);
			} else {
				work.push(this._discourseService.idempotentlyCreateGroup(groupSlug, getNiceName(tier.name))
					.then(({created}) => {
						if (created) {
							logging.info(`${LOG_PREFIX} Created group ${groupSlug}`);
						}
					})
					.catch((error: unknown) => {
						logging.error({
							message: `${LOG_PREFIX} Unable to create group ${groupSlug}`,
							err: error,
						});
					}),
				);
			}
		}

		if (removeUnmappedTiers) {
			for (const [name, id] of groups.entries()) {
				work.push(this._discourseService.deleteGroup(id)
					.then(() => {
						logging.info(`${LOG_PREFIX} Deleted group ${name} (${id})`);
					})
					.catch((error: unknown) => {
						logging.error({
							message: `${LOG_PREFIX} Unable to delete group ${name} (${id})`,
							err: error,
						});
					}),
				);
			}
		} else {
			logging.info(`${LOG_PREFIX} Not removing unmapped groups: ${Array.from(groups.keys()).join(', ')}`);
		}

		await Promise.all(work);

		if (work.length === 0) {
			logging.info(`${LOG_PREFIX} Nothing to do here 🧹`);
		}
	}
}
