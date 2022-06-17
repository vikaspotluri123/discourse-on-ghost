import {NextFunction, Request, Response} from 'express';
import logging from '@tryghost/logging';
import errors from '@tryghost/errors';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import {memberSyncQueue, syncMemberGroups, setDiscourseGroupsFromGhostTiers as setGroups} from '../services/member-sync.js';
import {anonymizeExternalUser, deleteExternalUser, suspendExternalUser} from '../services/discourse.js';

type SafeMemberRemoved = MemberRemoved['member']['previous'] & {id: string};

const wrapRemoveOption = (handle: (payload: SafeMemberRemoved) => Parameters<typeof memberSyncQueue['add']>) =>
	(request: Request, response: Response, next: NextFunction) => {
		logging.info('Processing member removed event');
		const body: MemberRemoved = request.body as unknown as MemberRemoved;

		if (!body.member?.previous.id) {
			next(new errors.BadRequestError({message: 'Missing member ID'}));
			return;
		}

		void memberSyncQueue.add(...handle(body.member.previous as SafeMemberRemoved));
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
	if (memberSyncQueue.has(id)) {
		response.status(202).json({message: 'Syncing member'});
		return;
	}

	if (!tiers) {
		void memberSyncQueue.add(id, syncMemberGroups, id);
		response.status(202).json({message: 'Syncing member'});
		return;
	}

	void memberSyncQueue.add(id, setGroups, uuid, tiers);
	response.status(202).json({message: 'Syncing member'});
}

export const memberRemovedSync = wrapRemoveOption(member => [member.id, setGroups, member.uuid, []]);
export const memberRemovedSuspend = wrapRemoveOption(member => [member.id, suspendExternalUser, member.uuid]);
export const memberRemovedAnonymize = wrapRemoveOption(member => [member.id, anonymizeExternalUser, member.uuid]);
export const memberRemovedDelete = wrapRemoveOption(member => [member.id, deleteExternalUser, member.uuid]);
