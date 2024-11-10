// @ts-check
import {__test} from '../../dist/lib/injector.js';

const {instances: injectorState} = __test;
const overrides = new Map();

afterEach(restore);

function restore() {
	for (const [token, previousValue] of overrides.entries()) {
		if (previousValue) {
			injectorState.set(token, previousValue);
		}
	}

	overrides.clear();
}

export const testInjector = {
	/** @type {typeof import('../../src/lib/injector.js')['bootstrapInjection']} */
	set(token, value) {
		if (!overrides.has(token)) {
			overrides.set(token, injectorState.get(token));
		}

		injectorState.set(token, value);
	},
	restore,
};
