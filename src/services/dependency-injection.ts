import {RoutingManager} from '../routing.js';
import {GhostWebhookController} from '../controllers/ghost-webhook.js';
import {DiscourseService} from '../services/discourse.js';
import {createFetchInjector} from '../lib/request.js';
import {IsomporphicCore} from '../types/isomorph.js';
import {MemberSyncService} from '../services/member-sync.js';
import {GhostService} from '../services/ghost.js';
import {SSOController} from '../controllers/sso.js';
import {Configuration} from '../types/config.js';
import {AdminController} from '../controllers/admin.js';
import {DiscourseSyncService} from './discourse-sync.js';

export function getRoutingManager(core: IsomporphicCore, config: Configuration): RoutingManager {
	const fetchInjector = createFetchInjector(core);
	const ghostService = new GhostService(config, fetchInjector);
	const discourseService = new DiscourseService(core.logger, config, fetchInjector);
	const discourseSyncService = new DiscourseSyncService(core.logger, discourseService, ghostService);
	const memberSyncService = new MemberSyncService(core.logger, discourseService, ghostService);
	const adminController = new AdminController(core.logger, discourseSyncService, memberSyncService, ghostService);
	const webhookController = new GhostWebhookController(core.logger, memberSyncService);
	const ssoController = new SSOController(config, core, ghostService);
	return new RoutingManager(core.logger, config, webhookController, ssoController, adminController);
}
