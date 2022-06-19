import process from 'node:process';
import {webcrypto} from 'node:crypto';
import {config as loadEnv} from 'dotenv';
import express from 'express';
import logging from '@tryghost/logging';
import {getConfig} from '../services/config.js';
import {useRequestLogging} from '../controllers/middleware.js';
import {getRoutingManager} from '../services/dependency-injection.js';
import {CryptoService, WebCrypto} from '../services/crypto.js';
import {envToConfigMapping} from './config-node.js';

loadEnv();

const cryptoService = new CryptoService(webcrypto as unknown as WebCrypto);

const config = getConfig(logging, cryptoService, process.env, envToConfigMapping);

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = getRoutingManager(logging, config, cryptoService);

export const app = express();

app.use(useRequestLogging(logging));
routingManager.addAllRoutes(app);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
