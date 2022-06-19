import {NextFunction, Request, Response} from 'express';
import logging from '@tryghost/logging';
import errors from '@tryghost/errors';
import {Configuration} from '../types/config.js';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import {MemberSyncService, memberSyncService} from '../services/member-sync.js';
import {DiscourseService, discourseService} from '../services/discourse.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};
type DeleteHandler = (payload: SafeMemberRemoved) => Parameters<typeof memberSyncService.queue['add']>;

export class GhostWebhookController {
	constructor(
		private readonly _discourseService: DiscourseService,
		private readonly _memberSyncService: MemberSyncService,
	) {}

	memberUpdated(request: Request, response: Response, next: NextFunction) {
		logging.info('Processing member updated event');
		const body: MemberUpdated = request.body as unknown as MemberUpdated;

		if (!body.member?.current.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		const {id, uuid, tiers} = body.member.current;
		if (memberSyncService.queue.has(id)) {
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		if (!tiers) {
			void memberSyncService.queue.add(id, memberSyncService.syncGroups, id);
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		void memberSyncService.queue.add(id, memberSyncService.setDiscourseGroupsFromTiers, uuid, tiers);
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
			logging.info('Processing member removed event');
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

export const ghostWebhookController = new GhostWebhookController(discourseService, memberSyncService);
