import path from 'node:path';
import GhostAdminApi from '@tryghost/admin-api';
import {GhostMemberWithTiers} from '../types/ghost.js';
import {isObject} from '../lib/is-object.js';
import {ghostUrl, ghostApiKey} from './config.js';

const adminApi = new GhostAdminApi({
	url: ghostUrl,
	key: ghostApiKey,
	version: 'v5.0',
});

export function getGhostUrl(urlPath: string, hash = ''): string {
	const base = new URL(ghostUrl);
	base.pathname = path.resolve(base.pathname, urlPath);
	base.hash = hash;

	return base.toString();
}

export async function getMember(id: string): Promise<GhostMemberWithTiers | false> {
	try {
		return await adminApi.members.read({id}, {include: 'tiers'}) as unknown as GhostMemberWithTiers;
	} catch (error: unknown) {
		if (isObject(error) && error.type === 'NotFoundError') {
			return false;
		}

		throw error;
	}
}
