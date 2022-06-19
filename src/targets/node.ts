import process from 'node:process';
import {webcrypto} from 'node:crypto';
import {config as loadEnv} from 'dotenv';
import express from 'express';
import logging from '@tryghost/logging';
import {getConfig} from '../services/config.js';
import {useRequestLogging} from '../controllers/middleware.js';
import {getRoutingManager} from '../services/dependency-injection.js';
import {WebCrypto} from '../services/crypto.js';
import {envToConfigMapping} from './config-node.js';

loadEnv();

// @ts-expect-error node is able to getRandomValues but types aren't properly configured
const coercedWebcrypto: WebCrypto = webcrypto;

const config = getConfig(logging, coercedWebcrypto, process.env, envToConfigMapping);

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = getRoutingManager(logging, config);

export const app = express();

app.use(useRequestLogging(logging));
routingManager.addAllRoutes(app);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
