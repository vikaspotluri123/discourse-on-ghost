import express from 'express';
import logging from '@tryghost/logging';
import {config} from './services/config.js';
import {logRequest} from './controllers/middleware.js';
import {addRoutes} from './routing.js';

export const app = express();

app.use(logRequest);
addRoutes(app, true);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
