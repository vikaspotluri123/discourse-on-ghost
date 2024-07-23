import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import {deferGetConfig} from '../services/config.js';
import {bootstrapInjector} from '../services/dependency-injection.js';
import {inject} from '../lib/injector.js';
import {DiscourseSyncService} from '../services/discourse-sync.js';
import {core, envToConfigMapping} from './shared-node.js';

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const discourseSyncService = inject(DiscourseSyncService);

void discourseSyncService.syncTiersToGroups(false)
	.catch((error: unknown) => { // eslint-disable-line unicorn/prefer-top-level-await
		core.logger.error('Failed syncing tiers:');
		core.logger.error((error as {message?: string})?.message ?? String(error));
		core.logger.debug(error);
	});
