import {CryptoService} from '../services/crypto.js';
import {Logger} from './logger.js';

export interface IsomporphicCore {
	crypto: CryptoService;
	logger: Logger;
	encoding: {
		atob: (text: string) => string;
		btoa: (binary: string) => string;
	};
}
