import {NextFunction, Request, Response} from 'express';
import logging from '@tryghost/logging';
import errors from '@tryghost/errors';
import {MemberRemoved, MemberUpdated} from '../types/ghost.js';
import {memberSyncQueue, syncMemberGroups, setDiscourseGroupsFromGhostTiers} from '../services/member-sync.js';

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

	void memberSyncQueue.add(id, setDiscourseGroupsFromGhostTiers, uuid, tiers);
	response.status(202).json({message: 'Syncing member'});
}

export function memberRemoved(request: Request, response: Response, next: NextFunction) {
	logging.info('Processing member removed event');
	const body: MemberRemoved = request.body as unknown as MemberRemoved;

	if (!body.member?.previous.id) {
		next(new errors.BadRequestError({message: 'Missing member ID'}));
		return;
	}

	void memberSyncQueue.add(body.member.previous.id, setDiscourseGroupsFromGhostTiers, body.member.previous.uuid, []);
	response.status(202).json({message: 'Syncing member'});
}
