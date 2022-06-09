import path from 'node:path';
import {Application} from 'express';
import {basePath} from './services/config.js';
import {securelyAuthorizeUser} from './controllers/sso.js';

export function route(routePath: string): string {
	return path.resolve(basePath, routePath);
}

export function addRoutes(app: Application) {
	app.get(route('sso'), securelyAuthorizeUser);
}
