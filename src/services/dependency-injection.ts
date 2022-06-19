import {RoutingManager} from '../routing.js';
import {GhostWebhookController} from '../controllers/ghost-webhook.js';
import {DiscourseService} from '../services/discourse.js';
import {createFetchInjector} from '../lib/request.js';
import {MemberSyncService} from '../services/member-sync.js';
import {GhostService} from '../services/ghost.js';
import {SSOController} from '../controllers/sso.js';
import {Configuration} from '../types/config.js';
import {Logger} from '../types/logger.js';
import {WebCrypto} from './crypto.js';

export function getRoutingManager(logger: Logger, config: Configuration, crypto: WebCrypto) {
	const fetchInjector = createFetchInjector(logger);
	const ghostService = new GhostService(config, fetchInjector);
	const discourseService = new DiscourseService(logger, config, fetchInjector);
	const memberSyncService = new MemberSyncService(logger, discourseService, ghostService);
	const webhookController = new GhostWebhookController(logger, discourseService, memberSyncService);
	const ssoController = new SSOController(config, crypto, ghostService);
	return new RoutingManager(logger, config, webhookController, ssoController);
}
