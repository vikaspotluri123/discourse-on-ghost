// Used to proxy requests from Ghost to DoG
import {homedir} from 'node:os';
import process from 'node:process';
import fetch from 'node-fetch';
import type {Application, Request, Response} from 'express';

export async function load(dogHome: string, app: Application) {
	const currentCwd = process.cwd();
	process.chdir(dogHome.replace('~', homedir())); // Set the CWD so dotenv can pick up the config
	const {config: {hostname, port, mountedBasePath}} = await import('../services/config.js');
	process.chdir(currentCwd);

	console.log('DoG proxy enabled for', mountedBasePath); // eslint-disable-line no-console

	app.use(mountedBasePath, (request: Request, response: Response) => {
		console.log(`Proxying ${request.method} ${request.originalUrl} to DoG`); // eslint-disable-line no-console
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
			console.error(error); // eslint-disable-line no-console
			response.status(500).send(error?.message ?? 'Unknown error');
		});
	});
}
