import process from 'node:process';
import { config as loadEnv } from 'dotenv';
import express, { type Request, type Response } from 'express';
import { deferGetConfig } from '../services/config.js';
import { useRequestLogging } from '../controllers/middleware.js';
import { bootstrapInjector } from '../services/dependency-injection.js';
import { RoutingManager } from '../routing.js';
import { core, envToConfigMapping } from './shared-node.js';
import crypto from 'crypto';
import axios from 'axios';

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));

if (!config) {
	process.exit(1);
}

const routingManager = new RoutingManager();
export const app = express();
app.disable('x-powered-by');
app.use(useRequestLogging());

// ✅ Health check & landing routes
app.get('/health', (_req, res) => {
	res.status(200).send('OK');
});

app.get('/', (_req, res) => {
	res.status(200).send('✨ Discourse-on-Ghost is live ✨');
});

// ✅ SSO route FIRST — before mounting all other routes
app.get('/discourse/sso', async (req: Request, res: Response): Promise<void> => {
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
	const params = new URLSearchParams(decoded);
	const nonce = params.get('nonce');
	const email = params.get('email');

	if (!nonce || !email) {
		res.status(400).send('Invalid SSO payload: missing nonce or email');
		return;
	}

	try {
		const ghostResp = await axios.get(`${process.env.GHOST_URL}/ghost/api/admin/members/`, {
			headers: {
				Authorization: `Ghost ${process.env.GHOST_ADMIN_API_KEY}`
			},
			params: {
				filter: `email:'${email}'`
			}
		});

		const user = ghostResp.data.members?.[0];
		if (!user) {
			res.status(404).send('User not found in Ghost');
			return;
		}

		const payload = new URLSearchParams({
			nonce,
			email: user.email,
			external_id: user.id,
			username: user.name || user.email.split('@')[0],
			name: user.name || ''
		});

		const base64Payload = Buffer.from(payload.toString()).toString('base64');
		const returnSig = crypto
			.createHmac('sha256', process.env.SSO_SECRET!)
			.update(base64Payload)
			.digest('hex');

		const redirectURL = `${process.env.DISCOURSE_URL}/session/sso_login?sso=${encodeURIComponent(base64Payload)}&sig=${returnSig}`;

		console.log('✅ Redirecting to:', redirectURL);
		res.redirect(redirectURL);
	} catch (err) {
		console.error('❌ Ghost lookup failed:', err);
		res.status(500).send('Ghost lookup failed');
	}
});

// ✅ Mount dynamic app routes after custom SSO route
routingManager.addAllRoutes(app);

app.listen(config.port, '0.0.0.0', () => {
	core.logger.info(`Listening on http://0.0.0.0:${config.port}`);
});
