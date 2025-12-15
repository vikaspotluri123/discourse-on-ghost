/* eslint-disable no-console */

import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import {
	red, green, yellow, cyan,
} from 'yoctocolors';
import {
	type CheckGroup, type DiffFailure, type StatusReporter, checks,
} from '../checks/index.js';
import {deferGetConfig} from '../services/config.js';
import {bootstrapInjector} from '../services/dependency-injection.js';
import {core, envToConfigMapping} from './shared-node.js';

loadEnv();

const config = bootstrapInjector(core, deferGetConfig(process.env, envToConfigMapping));

if (!config) {
	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

interface InternalCheckStatus {
	name: string;
	status: InternalCheckStatus[] | CheckStatusReporter;
}

class CheckStatusReporter implements StatusReporter {
	readonly pass: (message?: string) => void;
	readonly fail: (message: string | undefined | {expected: string; actual: string}) => void;
	readonly warn: (message?: string) => void;
	readonly skip: (message?: string) => void;

	private statusMessage = '';
	private statusPrefix = '';
	private _status?: 'pass' | 'fail' | 'skip' | 'warn';
	private readonly _errors: string[] = [];

	get value() {
		return this._status ?? 'fail';
	}

	constructor(public readonly name: string) {
		this.pass = this._createStatusMethod('pass', green('✓'));
		this.fail = this._createStatusMethod('fail', red('✗'));
		this.warn = this._createStatusMethod('warn', cyan('⚠'));
		this.skip = this._createStatusMethod('skip', yellow('○'));
	}

	assert() {
		if (!this._status) {
			this._errors.push('One of reporter#{pass,fail,skip} must be called in the check');
			this.fail('No status');
		}
	}

	get errors(): readonly string[] {
		return this._errors;
	}

	toString(indent: number) {
		let {statusMessage} = this;
		if (statusMessage) {
			if (statusMessage.includes('\n')) {
				const indentedNewLine = '\n' + ' '.repeat(indent * 2);
				statusMessage = ':' + statusMessage.replaceAll('\n', indentedNewLine);
			} else {
				statusMessage = ` - ${statusMessage}`;
			}
		}

		return `${this.statusPrefix} ${this.name}${statusMessage}`;
	}

	private _createStatusMethod(status: CheckStatusReporter['_status'] & {}, prefix: string) {
		return (message: string | DiffFailure = '') => {
			if (this._status) {
				const message = this.statusMessage ? ` (${this.statusMessage})` : '';
				this._errors.push(`Dropped ${this._status}${message} for ${status}`);
			}

			this._status = status;
			this.statusPrefix = prefix;
			this.statusMessage = this._serializeMessage(message);
		};
	}

	private _serializeMessage(message: string | DiffFailure) {
		if (typeof message === 'string') {
			return message;
		}

		const {expected, actual} = message;

		// Note: the extra space after `current` is intentional to align the prefixes
		return `\nExpected: ${expected}\nCurrent:  ${actual}`;
	}
}

async function runCheckGroup(group: CheckGroup, indent = 1) {
	const statuses: InternalCheckStatus[] = [];
	for (const check of group.children) {
		if ('children' in check) {
			statuses.push({
				name: check.name,
				// eslint-disable-next-line no-await-in-loop
				status: await runCheckGroup(check, indent + 1),
			});

			continue;
		}

		const reporter = new CheckStatusReporter(check.name);
		statuses.push({name: check.name, status: reporter});

		const skipMessage = check.skip?.();
		if (skipMessage) {
			reporter.skip(skipMessage);
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		await check.run(reporter);
		reporter.assert();
	}

	return statuses;
}

function serializeInternalCheckStatus(
	result: InternalCheckStatus[] | InternalCheckStatus,
	indent = 0,
	// eslint-disable-next-line unicorn/no-object-as-default-parameter
	summary: {
		pass: number;
		fail: number;
		warn: number;
		skip: number;
	} = {
		pass: 0, fail: 0, warn: 0, skip: 0,
	},
) {
	const spaces = ' '.repeat(indent * 2);
	if (Array.isArray(result)) {
		for (const singleStatus of result) {
			serializeInternalCheckStatus(singleStatus, indent + 1, summary);
		}

		return summary;
	}

	if (result.status instanceof CheckStatusReporter) {
		// Extra indent because it's a sub-message of a check
		console.log(spaces + result.status.toString(indent + 2));
		summary[result.status.value] += 1;
	} else {
		console.log(spaces + result.name);
		serializeInternalCheckStatus(result.status, indent + 1, summary);
	}

	return summary;
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void runCheckGroup({name: 'root', children: checks}).then(status => {
	const {pass, fail, skip} = serializeInternalCheckStatus(status);
	const passes = green(`${pass} passing`);
	const fails = red(`${fail} failing`);
	const warns = cyan(fail === 1 ? `${fail} warning` : `${fail} warnings`);
	const skips = yellow(`${skip} skipped`);

	console.log(`\n\nConfiguration check completed with ${passes}, ${warns}, ${fails}, and ${skips}`);
	console.log('For more information, refer to the checker docs at https://github.vikaspotluri.me/discourse-on-ghost/configuration/checker/');

	if (fail === 0) {
		console.log(green('Everything looks good!'));
	} else {
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
});
