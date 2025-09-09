import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import express from 'express';
import {deferGetConfig} from '../services/config.js';
import {useRequestLogging} from '../controllers/middleware.js';
import {bootstrapInjector} from '../services/dependency-injection.js';
import {RoutingManager} from '../routing.js';
import {core, envToConfigMapping} from './shared-node.js';

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

const routingManager = new RoutingManager();
export const app = express();
app.disable('x-powered-by');

app.use(useRequestLogging());

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/', (_req, res) => {
  res.status(200).send('✨ Discourse-on-Ghost is live ✨');
});

routingManager.addAllRoutes(app);

app.listen(config.port, '0.0.0.0', () => {
	core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
