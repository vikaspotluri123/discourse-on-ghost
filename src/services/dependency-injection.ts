import {createFetchInjector, FetchInjectionToken} from '../lib/request.js';
import {IsomorphicCore} from '../types/isomorph.js';
import {Configuration} from '../types/config.js';
import {bootstrapInjection, type Dependency} from '../lib/injector.js';
import {Logger} from '../types/logger.js';

export function bootstrapInjector(
	core: Dependency<typeof IsomorphicCore>,
	getConfig: () => Dependency<typeof Configuration> | undefined,
) {
	bootstrapInjection(IsomorphicCore, core);
	bootstrapInjection(Logger, core.logger);
	const config = getConfig();
	bootstrapInjection(Configuration, config);
	bootstrapInjection(FetchInjectionToken, createFetchInjector());

	return config;
}
