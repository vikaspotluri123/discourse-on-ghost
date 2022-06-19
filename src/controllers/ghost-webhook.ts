import {NextFunction, Request, Response} from 'express';
import logging from '@tryghost/logging';
import errors from '@tryghost/errors';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import {memberSyncService} from '../services/member-sync.js';
import {discourseService as ds} from '../services/discourse.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};

const wrapRemoveOption = (handle: (payload: SafeMemberRemoved) => Parameters<typeof memberSyncService.queue['add']>) =>
	(request: Request, response: Response, next: NextFunction) => {
		logging.info('Processing member removed event');
		const body: MemberRemoved = request.body as unknown as MemberRemoved;

		if (!body.member?.previous.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		void memberSyncService.queue.add(...handle(body.member.previous as SafeMemberRemoved));
		response.status(202).json({message: 'Syncing member'});
	};

export function memberUpdated(request: Request, response: Response, next: NextFunction) {
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

export const memberRemovedSync = wrapRemoveOption(member =>
	[member.id, memberSyncService.setDiscourseGroupsFromTiers, member.uuid, []],
);
export const memberRemovedSuspend = wrapRemoveOption(member => [member.id, ds.suspendExternalUser, member.uuid]);
export const memberRemovedAnonymize = wrapRemoveOption(member => [member.id, ds.anonymizeExternalUser, member.uuid]);
export const memberRemovedDelete = wrapRemoveOption(member => [member.id, ds.deleteExternalUser, member.uuid]);
