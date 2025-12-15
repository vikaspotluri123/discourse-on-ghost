// @ts-check
import sinon from 'sinon';
import {afterEach} from 'mocha';
import {Logger} from '../../dist/types/logger.js';
import {testInjector} from './injector.js';

/** @type {Record<'info' | 'warn' | 'error', sinon.SinonStub> | null} */
let _loggingStub;
afterEach(function () {
	_loggingStub = null;
});

export const loggingStub = () => _loggingStub;

export function stubLogging() {
	if (_loggingStub) {
		throw new Error('Logger is already stubbed, cannot stub it again');
	}

	_loggingStub = {
		error: sinon.stub(),
		warn: sinon.stub(),
		info: sinon.stub(),
	};

	// @ts-expect-error
	testInjector.set(Logger, _loggingStub);
	return _loggingStub;
}
