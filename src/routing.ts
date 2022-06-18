import path from 'node:path';
import {Application, NextFunction, Request, Response, json, Handler} from 'express';
import logging from '@tryghost/logging';
import {config} from './services/config.js';
import {obscurelyAuthorizeUser, securelyAuthorizeUser} from './controllers/sso.js';
import {memberRemovedAnonymize, memberRemovedDelete, memberRemovedSuspend, memberRemovedSync, memberUpdated} from './controllers/ghost-webhook.js';

const {
	mountedBasePath, enableGhostWebhooks, ghostMemberDeletedRoute, ghostMemberUpdatedRoute, ghostMemberDeleteDiscourseAction: deleteAction,
	ssoMethod,
} = config;

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

function getDeleteHandler(): Handler | undefined {
	if (deleteAction === 'anonymize') {
		return memberRemovedAnonymize;
	}

	if (deleteAction === 'suspend') {
		return memberRemovedSuspend;
	}

	if (deleteAction === 'sync') {
		return memberRemovedSync;
	}

	if (deleteAction === 'delete') {
		return memberRemovedDelete;
	}

	return undefined;
}

export function addRoutes(app: Application, includeCommon = false): void {
	app.get(route('sso'), ssoMethod === 'secure' ? securelyAuthorizeUser : obscurelyAuthorizeUser);

	if (enableGhostWebhooks) {
		const fullMemberUpdatedRoute = route(`hook/${ghostMemberUpdatedRoute}`);
		const fullMemberDeletedRoute = route(`hook/${ghostMemberDeletedRoute}`);
		const deleteHandler = getDeleteHandler();
		const jsonParser = json();

		app.post(fullMemberUpdatedRoute, jsonParser, memberUpdated);

		if (deleteHandler) {
			app.post(fullMemberDeletedRoute, jsonParser, deleteHandler);
		}

		logging.info(''
			+ 'Webhooks Mounted:\n'
			+ ` - Member Updated @ ${fullMemberUpdatedRoute}`
			+ (deleteHandler ? '\n - Member Deleted @ ' + fullMemberDeletedRoute : ''),
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
