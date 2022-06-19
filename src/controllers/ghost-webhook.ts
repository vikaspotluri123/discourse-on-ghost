import {NextFunction, Request, Response} from 'express';
import errors from '@tryghost/errors';
import {Configuration} from '../types/config.js';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import type {MemberSyncService} from '../services/member-sync.js';
import type {DiscourseService} from '../services/discourse.js';
import {Logger} from '../types/logger.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};
type DeleteHandler = (payload: SafeMemberRemoved) => Parameters<MemberSyncService['queue']['add']>;

export class GhostWebhookController {
	constructor(
		private readonly logger: Logger,
		private readonly _discourseService: DiscourseService,
		private readonly _memberSyncService: MemberSyncService,
	) {}

	memberUpdated(request: Request, response: Response, next: NextFunction) {
		this.logger.info('Processing member updated event');
		const body: MemberUpdated = request.body as unknown as MemberUpdated;

		if (!body.member?.current.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		const {id, uuid, tiers} = body.member.current;
		if (this._memberSyncService.queue.has(id)) {
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		if (!tiers) {
			void this._memberSyncService.queue.add(id, this._memberSyncService.syncGroups, id);
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		void this._memberSyncService.queue.add(id, this._memberSyncService.setDiscourseGroupsFromTiers, uuid, tiers);
		response.status(202).json({message: 'Syncing member'});
	}

	deleteController(deleteAction: Configuration['ghostMemberDeleteDiscourseAction']) {
		if (deleteAction === 'anonymize') {
			return this.createWrappedDeleteHandler(
				member => [member.id, this._discourseService.anonymizeExternalUser, member.uuid],
			);
		}

		if (deleteAction === 'suspend') {
			return this.createWrappedDeleteHandler(
				member => [member.id, this._discourseService.suspendExternalUser, member.uuid],
			);
		}

		if (deleteAction === 'sync') {
			return this.createWrappedDeleteHandler(
				member => [member.id, this._memberSyncService.setDiscourseGroupsFromTiers, member.uuid, []],
			);
		}

		if (deleteAction === 'delete') {
			return this.createWrappedDeleteHandler(
				member => [member.id, this._discourseService.deleteExternalUser, member.uuid],
			);
		}

		return undefined;
	}

	private createWrappedDeleteHandler(handler: DeleteHandler) {
		return (request: Request, response: Response, next: NextFunction) => {
			this.logger.info('Processing member removed event');
			const body: MemberRemoved = request.body as unknown as MemberRemoved;

			if (!body.member?.previous.id) {
				next(new errors.BadRequestError({message: 'Missing member ID'}));
				return;
			}

			void this._memberSyncService.queue.add(...handler(body.member.previous as SafeMemberRemoved));
			response.status(202).json({message: 'Syncing member'});
		};
	}
}
