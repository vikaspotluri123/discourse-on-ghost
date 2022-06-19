import {RoutingManager} from '../routing.js';
import {GhostWebhookController} from '../controllers/ghost-webhook.js';
import {DiscourseService} from '../services/discourse.js';
import {createFetch} from '../lib/request.js';
import {MemberSyncService} from '../services/member-sync.js';
import {GhostService} from '../services/ghost.js';
import {SSOController} from '../controllers/sso.js';
import {Configuration} from '../types/config.js';

export function getRoutingManager(config: Configuration) {
	const ghostService = new GhostService(config, createFetch);
	const discourseService = new DiscourseService(config, createFetch);
	const memberSyncService = new MemberSyncService(discourseService, ghostService);
	const webhookController = new GhostWebhookController(discourseService, memberSyncService);
	const ssoController = new SSOController(config, ghostService);
	return new RoutingManager(config, webhookController, ssoController);
}
