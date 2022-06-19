// Used to proxy requests from Ghost to DoG
import {homedir} from 'node:os';
import process from 'node:process';
import {webcrypto} from 'node:crypto';
import fetch from 'node-fetch';
import type {Application, Request, Response} from 'express';
import type {Logger} from '../types/logger.js';
import {CryptoService, WebCrypto} from '../services/crypto.js';

export async function load(dogHome: string, app: Application) {
	const currentCwd = process.cwd();
	const logger: Logger = console;
	const requestedCwd = dogHome.replace('~', homedir());
	process.chdir(requestedCwd); // Set the CWD so dotenv can pick up the config
	const {getConfig} = await import('../services/config.js');
	const {envToConfigMapping} = await import('../targets/config-node.js');
	process.chdir(currentCwd);

	const crypto = new CryptoService(webcrypto as unknown as WebCrypto);

	const config = getConfig(logger, crypto, process.env, envToConfigMapping);

	if (!config) {
		logger.info('Failed loading DoG config. CWD:' + requestedCwd);
		return;
	}

	const {hostname, port, mountedBasePath} = config;

	logger.info('DoG proxy enabled for', mountedBasePath);

	app.use(mountedBasePath, (request: Request, response: Response) => {
		logger.info(`Proxying ${request.method} ${request.originalUrl} to DoG`);
		void fetch(`http://${hostname}:${port}${request.originalUrl}`, {
			method: request.method,
			headers: request.headers as Record<string, string>,
			body: request.body, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
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
