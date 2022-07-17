import {GhostTier} from '../types/ghost.js';
import {Queue} from '../lib/queue.js';
import {Logger} from '../types/logger.js';
import {inject} from '../lib/injector.js';
import {GhostService} from './ghost.js';
import {DiscourseService, getNiceName, getSlug} from './discourse.js';

type Queable = 'syncGroups' | 'setDiscourseGroupsFromTiers' | 'deleteDiscourseUser' | 'anonymizeDiscourseUser' | 'suspendDiscourseUser';

export class MemberSyncService {
	private readonly logger = inject(Logger);
	private readonly _discourseService = inject(DiscourseService);
	private readonly _ghostService = inject(GhostService);
	private readonly _queue = new Queue();
	private readonly _knownGroups = new Set<string>();

	constructor() {
		this.syncGroups = this.syncGroups.bind(this);
		this.setDiscourseGroupsFromTiers = this.setDiscourseGroupsFromTiers.bind(this);
		this.deleteDiscourseUser = this.deleteDiscourseUser.bind(this);
		this.anonymizeDiscourseUser = this.anonymizeDiscourseUser.bind(this);
		this.suspendDiscourseUser = this.suspendDiscourseUser.bind(this);
	}

	resetKnownGroups() {
		this._knownGroups.clear();
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

		const success = await this._discourseService.setMemberGroups(uuid, mappedGroups);

		if (!success) {
			if (tiers.length === 0) {
				this.logger.info(`Member ${uuid} belongs to no tiers`);
				return false;
			}

			return Promise.all(mappedGroups.map(async ({name, niceName}) => this.maybeCreateGroup(name, niceName)));
		}

		for (const group of success) {
			if (group.success) {
				this._knownGroups.add(group.name);
			}
		}

		return success;
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

	private async maybeCreateGroup(name: string, fullName: string) {
		if (this._knownGroups.has(name)) {
			this.logger.info(`Not creating group ${name}`);
			return true;
		}

		this.logger.info(`Attempting to create group ${name}/${fullName}`);
		try {
			await this._discourseService.idempotentlyCreateGroup(name, fullName);
			this._knownGroups.add(name);
			return true;
		} catch {
			return false;
		}
	}
}
