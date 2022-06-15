import path from 'node:path';
import {ghostUrl} from './config.js';

export function getGhostUrl(urlPath: string, hash = ''): string {
	const base = new URL(ghostUrl);
	base.pathname = path.resolve(base.pathname, urlPath);
	base.hash = hash;

	return base.toString();
}
