import fetch, {RequestInfo, RequestInit, Response} from 'node-fetch';
import logging from '@tryghost/logging';

export function createFetch(serviceName: string, enableLogging: boolean): (url: RequestInfo, options?: RequestInit, context?: Record<string, string>) => Promise<Response> {
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
			logging.info(`[${serviceName}:fetch${serializedContext}] ${method} ${url}${additionalInformation} in ${duration}ms`);
		}
	};
}
