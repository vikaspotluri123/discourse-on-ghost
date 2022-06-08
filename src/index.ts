import express from 'express';
import logging from '@tryghost/logging';
import * as config from './services/config.js';
import {sayHello} from './controllers/hello-world.js';
import {logRequest} from './controllers/middleware.js';

export const app = express();

app.use(logRequest);
app.get('*', sayHello);

app.listen(config.port, config.hostname, () => {
	logging.info(`Listening on http://${config.hostname}:${config.port}`);
});
