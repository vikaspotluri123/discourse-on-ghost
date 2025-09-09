import process from 'node:process';
import { config as loadEnv } from 'dotenv';
import express, { type Request, type Response } from 'express';
import { deferGetConfig } from '../services/config.js';
import { useRequestLogging } from '../controllers/middleware.js';
import { bootstrapInjector } from '../services/dependency-injection.js';
import { RoutingManager } from '../routing.js';
import { core, envToConfigMapping } from './shared-node.js';
import crypto from 'crypto';

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

//
// ✅ Define the SSO handler function BEFORE using it
//
const discourseSSOHandler = async (req: Request, res: Response): Promise<void> => {
	const sso = req.query.sso as string;
	const sig = req.query.sig as string;

	if (!sso || !sig) {
		res.status(400).send('Missing sso or sig');
		return;
	}

	const hmac = crypto
		.createHmac('sha256', process.env.SSO_SECRET!)
		.update(sso)
		.digest('hex');

	if (hmac !== sig) {
		res.status(403).send('Invalid SSO signature');
		return;
	}

	const decoded = Buffer.from(sso, 'base64').toString('utf8');
	console.log('🔐 SSO Payload:', decoded);

	res.status(200).send('✅ SSO Signature Valid!');
};

//
// ✅ Register the route AFTER it's defined
//
app.get('/discourse/sso', discourseSSOHandler);

app.listen(config.port, '0.0.0.0', () => {
	core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
