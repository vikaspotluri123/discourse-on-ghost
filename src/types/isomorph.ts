import type fetch from 'node-fetch';
import {CryptoService} from '../services/crypto.js';
import {Logger} from './logger.js';

export interface IsomporphicCore {
	fetch: typeof fetch;
	crypto: CryptoService;
	logger: Logger;
	encoding: {
		atob: (text: string) => string;
		btoa: (binary: string) => string;
	};
}
