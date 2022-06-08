// Based on https://github.com/TryGhost/gscan/blob/b91d2ff2072ec0f8a/app/middlewares/log-request.js
import {v1 as uuid} from 'uuid';
import logging from '@tryghost/logging';
import {NextFunction, Request, Response} from 'express';

export function logRequest(_request: Request, _response: Response, next: NextFunction) {
	const startTime = Date.now();
	const requestId = uuid();

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
			logging.error({req: request, res: response, err: request.err});
		} else {
			logging.info({req: request, res: response});
		}

		response.removeListener('finish', logResponse);
		response.removeListener('close', logResponse);
	}

	response.on('finish', logResponse);
	response.on('close', logResponse);
	next();
}
