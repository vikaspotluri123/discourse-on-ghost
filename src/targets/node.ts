import process from 'node:process';
import {Buffer} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {config as loadEnv} from 'dotenv';
import express from 'express';
import logging from '@tryghost/logging';
import {getConfig} from '../services/config.js';
import {useRequestLogging} from '../controllers/middleware.js';
import {getRoutingManager} from '../services/dependency-injection.js';
import {CryptoService, WebCrypto} from '../services/crypto.js';
import {IsomporphicCore} from '../types/isomorph.js';
import {envToConfigMapping} from './config-node.js';

loadEnv();

const core: IsomporphicCore = {
	crypto: new CryptoService(webcrypto as unknown as WebCrypto),
	logger: logging,
	encoding: {
		atob: (text: string) => Buffer.from(text, 'base64').toString('utf8'),
		btoa: (binary: string) => Buffer.from(binary, 'utf8').toString('base64'),
	},
};

const config = getConfig(core, process.env, envToConfigMapping);

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = getRoutingManager(core, config);

export const app = express();

app.use(useRequestLogging(logging));
routingManager.addAllRoutes(app);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
