import type {RequestInfo, RequestInit, Response} from 'node-fetch';
import {IsomorphicCore} from '../types/isomorph.js';
import {createInjectionToken, inject} from './injector.js';

type WrappedFetch = (url: RequestInfo, options?: RequestInit, context?: Record<string, string>) => Promise<Response>;

type FetchInjector = (serviceName: string, enableLogging: boolean) => WrappedFetch;

export function createFetchInjector() {
	const {fetch, logger} = inject(IsomorphicCore);
	return (serviceName: string, enableLogging: boolean): WrappedFetch => {
		if (!enableLogging) {
			return fetch;
		}

		return async (request: RequestInfo, options?: RequestInit, context?: Record<string, string>) => {
			const start = Date.now();
			let response: Response;
			try {
				response = await fetch(request, options);

				return response;
			} finally {
				const additionalInformation = response!
					? ` ${response.status}(${response.statusText})`
					: '';

				const method = options?.method?.toUpperCase() ?? 'GET';
				const url = typeof request === 'string' ? request : request.url;
				const duration = Date.now() - start;
				const serializedContext = context ? `@${new URLSearchParams(context).toString()}` : '';
				logger.info(`[${serviceName}:fetch${serializedContext}] ${method} ${url}${additionalInformation} in ${duration}ms`);
			}
		};
	};
}

export const FetchInjectionToken = createInjectionToken<FetchInjector>('createFetchInjector');
