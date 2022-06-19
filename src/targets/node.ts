import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import express from 'express';
import logging from '@tryghost/logging';
import {getConfig} from '../services/config.js';
import {logRequest} from '../controllers/middleware.js';
import {getRoutingManager} from '../services/dependency-injection.js';
import {envToConfigMapping, getRandomHex} from './config-node.js';

loadEnv();

const config = getConfig(process.env, envToConfigMapping, getRandomHex);

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = getRoutingManager(config);

export const app = express();

app.use(logRequest);
routingManager.addAllRoutes(app);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
