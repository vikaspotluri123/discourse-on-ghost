import {uResolve} from './lib/u-resolve.js';
import {Application, NextFunction, Request, Response, json} from 'express';
import logging from '@tryghost/logging';
import {config} from './services/config.js';
import {SSOController, ssoController} from './controllers/sso.js';
import {GhostWebhookController, ghostWebhookController} from './controllers/ghost-webhook.js';
import {Configuration} from './types/config.js';

function lazyJson(payload: Record<string, unknown>, statusCode = 200) {
	return (_: Request, response: Response) => {
		response
			.status(statusCode)
			.setHeader('Content-Type', 'application/json')
			.send(JSON.stringify(payload))
			.end();
	};
}

export class RoutingManager {
	constructor(
		private readonly config: Configuration,
		private readonly ghostWebhookController: GhostWebhookController,
		private readonly sso: SSOController,
	) {}

	resolve(route: string) {
		return uResolve(this.config.mountedBasePath, route.replace(/^\//, ''));
	}

	addCoreRoutes(app: Application) {
		app.get(this.resolve('sso'), this.sso.controllerFor(this.config.ssoMethod));

		if (this.config.enableGhostWebhooks) {
			this.addGhostWebhookRoutes(app);
		}
	}

	addAllRoutes(app: Application) {
		this.addCoreRoutes(app);
		const sendError = lazyJson({error: 'Something went wrong. Unable to complete request.'}, 500);
		app.get(this.resolve('/health'), lazyJson({message: 'Howdy!'}));
		app.use(lazyJson({error: 'Not Found'}, 404));
		app.use((error: unknown, request: Request, response: Response, ___: NextFunction) => {
			logging.error(error);
			sendError(request, response);
		});
	}

	private addGhostWebhookRoutes(app: Application) {
		const {
			ghostMemberDeletedRoute, ghostMemberUpdatedRoute, ghostMemberDeleteDiscourseAction: deleteAction,
		} = this.config;

		const fullMemberUpdatedRoute = this.resolve(`hook/${ghostMemberUpdatedRoute}`);
		const fullMemberDeletedRoute = this.resolve(`hook/${ghostMemberDeletedRoute}`);
		const deleteHandler = this.ghostWebhookController.deleteController(deleteAction);
		const jsonParser = json();

		app.post(fullMemberUpdatedRoute, jsonParser, this.ghostWebhookController.memberUpdated);

		if (deleteHandler) {
			app.post(fullMemberDeletedRoute, jsonParser, deleteHandler);
		}

		logging.info(''
			+ 'Webhooks Mounted:\n'
			+ ` - Member Updated @ ${fullMemberUpdatedRoute}`
			+ (deleteHandler ? '\n - Member Deleted @ ' + fullMemberDeletedRoute : ''),
		);
	}
}

export const routingManager = new RoutingManager(config, ghostWebhookController, ssoController);
