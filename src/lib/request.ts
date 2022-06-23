import type {RequestInfo, RequestInit, Response} from 'node-fetch';
import {IsomporphicCore} from '../types/isomorph.js';

type WrappedFetch = (url: RequestInfo, options?: RequestInit, context?: Record<string, string>) => Promise<Response>;

export type FetchInjector = (serviceName: string, enableLogging: boolean) => WrappedFetch;

export function createFetchInjector({fetch, logger}: IsomporphicCore) {
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
