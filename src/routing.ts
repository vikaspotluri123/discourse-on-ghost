import {type Application, type NextFunction, type Request, type Response, json} from 'express';
import {uResolve} from './lib/u-resolve.js';
import {SSOController} from './controllers/sso.js';
import {GhostWebhookController} from './controllers/ghost-webhook.js';
import {Configuration} from './types/config.js';
import {Logger} from './types/logger.js';
import {AdminController} from './controllers/admin.js';
import {inject} from './lib/injector.js';

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
	private readonly logger = inject(Logger);
	private readonly config = inject(Configuration);
	private readonly ghostWebhookController = inject(GhostWebhookController);
	private readonly sso = inject(SSOController);
	private readonly adminController = inject(AdminController);

	resolve(route: string) {
		return uResolve(this.config.mountedBasePath, route.replace(/^\//, ''));
	}

	addCoreRoutes(app: Application) {
		app.get(this.resolve('sso'), this.sso.controllerFor(this.config.ssoMethod));

		if (this.config.enableGhostWebhooks) {
			this.addGhostWebhookRoutes(app);
		}

		this.addAdminRoutes(app);
	}

	addAllRoutes(app: Application) {
		this.addCoreRoutes(app);
		const sendError = lazyJson({error: 'Something went wrong. Unable to complete request.'}, 500);
		app.get(this.resolve('/health'), lazyJson({message: 'Howdy!'}));
		app.use(lazyJson({error: 'Not Found'}, 404));
		app.use((error: unknown, request: Request, response: Response, ___: NextFunction) => {
			this.logger.error(error);
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

		const domain = this.config.ssoMethod === 'session' ? this.config.ghostUrl : '';

		this.logger.info(''
			+ 'Webhooks Mounted:\n'
			+ ` - Member Updated @ ${domain}${fullMemberUpdatedRoute}`
			+ (deleteHandler ? '\n - Member Deleted @ ' + domain + fullMemberDeletedRoute : ''),
		);
	}

	private addAdminRoutes(app: Application) {
		const [syncTiers, clearCaches] = this.adminController.get(this.config.ssoMethod);
		app.get(this.resolve('admin/sync-tiers'), syncTiers);
		app.get(this.resolve('admin/clear-caches'), clearCaches);
	}
}
