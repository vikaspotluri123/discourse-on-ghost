import path from 'node:path';
import {Application, NextFunction, Request, Response} from 'express';
import logging from '@tryghost/logging';
import {mountedBasePath} from './services/config.js';
import {securelyAuthorizeUser} from './controllers/sso.js';

export function route(routePath: string): string {
	return path.resolve(mountedBasePath, routePath);
}

function lazyJson(payload: Record<string, unknown>, statusCode = 200) {
	return (_: Request, response: Response) => {
		response
			.status(statusCode)
			.setHeader('Content-Type', 'application/json')
			.send(JSON.stringify(payload))
			.end();
	};
}

export function addRoutes(app: Application, includeCommon = false): void {
	app.get(route('sso'), securelyAuthorizeUser);

	if (includeCommon) {
		const sendError = lazyJson({error: 'Something went wrong. Unable to complete request.'}, 500);
		app.get(route('/health'), lazyJson({message: 'Howdy!'}));
		app.use(lazyJson({error: 'Not Found'}, 404));
		app.use((error: unknown, request: Request, response: Response, ___: NextFunction) => {
			logging.error(error);
			sendError(request, response);
		});
	}
}
