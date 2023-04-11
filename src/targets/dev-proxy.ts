// Used to proxy requests from Ghost to DoG
import {homedir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type {Application, Request, Response} from 'express';
import type {Logger} from '../types/logger.js';
import {type Dependency} from '../lib/injector.js';

export async function load(dogHome: string, app: Application) {
	const logger: Dependency<typeof Logger> = console;
	const requestedCwd = dogHome.replace('~', homedir());
	const {config: loadEnv} = await import('dotenv');
	loadEnv({path: path.resolve(requestedCwd, '.env')});

	const {getConfig} = await import('../services/config.js');
	const {core, envToConfigMapping} = await import('./shared-node.js');
	const {json} = await import('express');

	core.logger = logger;

	const config = getConfig(process.env, envToConfigMapping);

	if (!config) {
		logger.info('Failed loading DoG config. CWD:' + requestedCwd);
		return;
	}

	const {hostname, port, mountedBasePath} = config;

	logger.info('DoG proxy enabled for', mountedBasePath);

	app.use(mountedBasePath, json(), (request: Request, response: Response) => {
		logger.info(`Proxying ${request.method} ${request.originalUrl} to DoG`);
		const body
			= request.method !== 'GET' && request.method !== 'HEAD' && Object.keys(request.body as Record<any, any>).length > 0
				? JSON.stringify(request.body)
				: undefined;
		void core.fetch(`http://${hostname}:${port}${request.originalUrl}`, {
			method: request.method,
			headers: request.headers as Record<string, string>,
			body,
		}).then(proxyResponse => { // eslint-disable-line @typescript-eslint/promise-function-async
			response.status(proxyResponse.status);

			for (const [name, value] of proxyResponse.headers.entries()) {
				response.setHeader(name, value);
			}

			return proxyResponse.text();
		}).then(body => {
			response.send(body);
		}).catch(error => {
			logger.error(error);
			response.status(500).send(error?.message ?? 'Unknown error');
		});
	});
}
