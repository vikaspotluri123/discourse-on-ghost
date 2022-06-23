import {NextFunction, Request, Response} from 'express';
import errors from '@tryghost/errors';
import {Configuration} from '../types/config.js';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import type {MemberSyncService} from '../services/member-sync.js';
import {Logger} from '../types/logger.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};
type DeleteHandler = (payload: SafeMemberRemoved) => Parameters<MemberSyncService['queue']>;

export class GhostWebhookController {
	constructor(
		private readonly logger: Logger,
		private readonly _memberSyncService: MemberSyncService,
	) {}

	memberUpdated = (request: Request, response: Response, next: NextFunction) => {
		this.logger.info('Processing member updated event');
		const body: MemberUpdated = request.body as unknown as MemberUpdated;

		if (!body.member?.current.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		const {id, uuid, tiers} = body.member.current;
		if (this._memberSyncService.has(id)) {
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		if (!tiers) {
			this._memberSyncService.queue(id, 'syncGroups', id);
			response.status(202).json({message: 'Syncing member'});
			return;
		}

		this._memberSyncService.queue(id, 'setDiscourseGroupsFromTiers', uuid, tiers);
		response.status(202).json({message: 'Syncing member'});
	};

	deleteController(deleteAction: Configuration['ghostMemberDeleteDiscourseAction']) {
		if (deleteAction === 'anonymize') {
			return this.createWrappedDeleteHandler(member => [member.id, 'anonymizeDiscourseUser', member.uuid]);
		}

		if (deleteAction === 'suspend') {
			return this.createWrappedDeleteHandler(member => [member.id, 'suspendDiscourseUser', member.uuid]);
		}

		if (deleteAction === 'sync') {
			return this.createWrappedDeleteHandler(member => [member.id, 'setDiscourseGroupsFromTiers', member.uuid, []]);
		}

		if (deleteAction === 'delete') {
			return this.createWrappedDeleteHandler(member => [member.id, 'deleteDiscourseUser', member.uuid]);
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

			// @ts-expect-error Handler returns Parameters<queue> which is what we're calling `queue` with
			this._memberSyncService.queue(...handler(body.member.previous as SafeMemberRemoved));
			response.status(202).json({message: 'Syncing member'});
		};
	}
}
