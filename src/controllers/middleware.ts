// Based on https://github.com/TryGhost/gscan/blob/b91d2ff2072ec0f8a/app/middlewares/log-request.js
import {type NextFunction, type Request, type Response} from 'express';
import {IsomorphicCore} from '../types/isomorph.js';
import {Logger} from '../types/logger.js';
import {inject} from '../lib/injector.js';

export function useRequestLogging() {
	const {randomUUID} = inject(IsomorphicCore);
	const logger = inject(Logger);
	return function logRequest(_request: Request, _response: Response, next: NextFunction) {
		const startTime = Date.now();
		const requestId = randomUUID();

		const request = _request as Request & {
			requestId: string;
			err: unknown;
		};

		const response = _response as Response & {
			responseTime: string;
		};

		function logResponse() {
			response.responseTime = `${Date.now() - startTime}ms`;
			request.requestId = requestId;

			if (request.err) {
				logger.error({req: request, res: response, err: request.err});
			} else {
				logger.info({req: request, res: response});
			}

			response.removeListener('finish', logResponse);
			response.removeListener('close', logResponse);
		}

		response.on('finish', logResponse);
		response.on('close', logResponse);
		next();
	};
}
