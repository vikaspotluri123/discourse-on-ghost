// @ts-check
import {readFile} from 'node:fs/promises';
import {expect} from 'chai';
import {describe, it} from 'mocha';
import {AUTO_CHECKER_FILE, createAutoCheckerFile} from '../../scripts/document-checks.js';
import {checks} from '../../dist/checks/index.js';

describe('Unit > Checks Documentation', function () {
	it('Is up to date', async function () {
		const actual = await readFile(AUTO_CHECKER_FILE, 'utf8');
		expect(createAutoCheckerFile(checks), 'Docs are out of sync, run ./scripts/document-checks.js').to.equal(actual);
	});
});
