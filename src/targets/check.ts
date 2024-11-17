/* eslint-disable no-console */

import process from 'node:process';
import {config as loadEnv} from 'dotenv';
import {red, green, yellow} from 'yoctocolors';
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
	readonly skip: (message?: string) => void;

	private statusMessage = '';
	private statusPrefix = '';
	private status?: 'pass' | 'fail' | 'skip';
	private readonly _errors: string[] = [];

	constructor(public readonly name: string) {
		this.pass = this._createStatusMethod('pass', green('✓'));
		this.fail = this._createStatusMethod('fail', red('✗'));
		this.skip = this._createStatusMethod('skip', yellow('○'));
	}

	assert() {
		if (!this.status) {
			this._errors.push('One of reporter#{pass,fail,skip} must be called in the check');
			this.fail('No status');
		}
	}

	get errors(): readonly string[] {
		return this._errors;
	}

	toString(indent: number) {
		let statusMessage = this.statusMessage;
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

	// eslint-disable-next-line @typescript-eslint/ban-types
	private _createStatusMethod(status: CheckStatusReporter['status'] & {}, prefix: string) {
		return (message: string | DiffFailure = '') => {
			if (this.status) {
				const message = this.statusMessage ? ` (${this.statusMessage})` : '';
				this._errors.push(`Dropped ${this.status}${message} for ${status}`);
			}

			this.status = status;
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

function serializeInternalCheckStatus(status: InternalCheckStatus[] | InternalCheckStatus, indent = 0) {
	const spaces = ' '.repeat(indent * 2);
	if (Array.isArray(status)) {
		for (const singleStatus of status) {
			serializeInternalCheckStatus(singleStatus, indent + 1);
		}

		return;
	}

	if (status.status instanceof CheckStatusReporter) {
		// Extra indent because it's a sub-message of a check
		console.log(spaces + status.status.toString(indent + 2));
	} else {
		console.log(spaces + status.name);
		serializeInternalCheckStatus(status.status, indent + 1);
	}
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void runCheckGroup({name: 'root', children: checks}).then(status => {
	serializeInternalCheckStatus(status);
});
