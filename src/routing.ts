import path from 'node:path';
import {Application, NextFunction, Request, Response, json} from 'express';
import logging from '@tryghost/logging';
import {
	mountedBasePath, enableGhostWebhooks, ghostMemberCreatedRoute, ghostMemberDeletedRoute, ghostMemberUpdatedRoute,
} from './services/config.js';
import {securelyAuthorizeUser} from './controllers/sso.js';

export function route(routePath: string): string {
	return path.resolve(mountedBasePath, routePath.replace(/^\//, ''));
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

	if (enableGhostWebhooks) {
		const handler = (request: Request, response: Response) => {
			// @todo
			response.status(204).end();
		};

		const fullMemberCreatedRoute = route(`hook/${ghostMemberCreatedRoute}`);
		const fullMemberUpdatedRoute = route(`hook/${ghostMemberUpdatedRoute}`);
		const fullMemberDeletedRoute = route(`hook/${ghostMemberDeletedRoute}`);

		app.post(fullMemberCreatedRoute, json(), handler);
		app.post(fullMemberUpdatedRoute, json(), handler);
		app.post(fullMemberDeletedRoute, json(), handler);
		logging.info(''
			+ 'Webhooks Mounted:\n'
			+ ` - Member Created @ ${fullMemberCreatedRoute}\n`
			+ ` - Member Updated @ ${fullMemberUpdatedRoute}\n`
			+ ` - Member Deleted @ ${fullMemberDeletedRoute}`,
		);
	}

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
