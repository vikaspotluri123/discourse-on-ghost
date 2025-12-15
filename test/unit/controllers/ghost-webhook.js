// @ts-check
import {createHmac} from 'node:crypto';
import sinon from 'sinon';
import {expect} from 'chai';
import {describe, it} from 'mocha';
import {GhostWebhookController} from '../../../dist/controllers/ghost-webhook.js';
import {testInjector} from '../../utils/injector.js';
import {Configuration} from '../../../dist/types/config.js';
import {stubLogging} from '../../utils/logger.js';

/**
 * @typedef {import('../../../src/types/config.js').ConfigurationType} Config
 */

/**
 * @param {Partial<Config>} [config]
 */
function createGhostWebhookController(config) {
	if (config) {
		// @ts-expect-error debug this later
		testInjector.set(Configuration, config);
	}

	return new GhostWebhookController();
}

function sign(message, key) {
	return createHmac('sha256', key)
		.update(message)
		.digest('hex');
}

describe('Unit > Controllers > GhostWebhook', function () {
	describe('Webhook Verification', function () {
		it('not verified', async function () {
			const logger = stubLogging();
			let readSignatureHeader = false;

			const request = {
				body: {},
				headers: {
					get 'x-ghost-signature'() {
						readSignatureHeader = true;
						return '';
					},
				},
			};

			const controller = createGhostWebhookController();
			const next = sinon.stub();
			await controller.deleteController('sync')?.(request, {}, next);
			await controller.memberUpdated(request, {}, next);

			expect(readSignatureHeader).to.equal(false);
			expect(next.callCount).to.equal(2);
			expect(next.args[0][0].message).to.equal('Missing member ID');
			expect(next.args[1][0].message).to.equal('Missing member ID');
			expect(logger.error.called).to.be.false;
		});

		it('v1', async function () {
			const logger = stubLogging();
			const updatedSecret = 'ghostMemberUpdatedSecret';
			const deletedSecret = 'ghostMemberDeletedSecret';
			let timestamp = Date.now();
			const body = {hello: 'world'};
			let signatureHeaderReadCount = 0;

			const request = secret => ({
				body,
				headers: {
					get 'x-ghost-signature'() {
						signatureHeaderReadCount++;
						return `sha256=${sign(JSON.stringify(body), secret)}, t=${timestamp}`;
					},
				},
			});

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '1',
				ghostMemberUpdatedSecret: updatedSecret,
				ghostMemberDeletedSecret: deletedSecret,
			});

			const next = sinon.stub();
			await controller.deleteController('sync')?.(request(deletedSecret), {}, next);
			// Bypass replay checker
			timestamp++;
			await controller.memberUpdated(request(updatedSecret), {}, next);

			expect(signatureHeaderReadCount).to.equal(2);
			expect(next.callCount).to.equal(2);
			expect(next.args[0][0].message).to.equal('Missing member ID');
			expect(next.args[1][0].message).to.equal('Missing member ID');
			expect(logger.error.called).to.be.false;
		});

		it('v2', async function () {
			const logger = stubLogging();
			const updatedSecret = 'ghostMemberUpdatedSecret';
			const deletedSecret = 'ghostMemberDeletedSecret';
			let timestamp = Date.now();
			const body = {hello: 'world'};
			let signatureHeaderReadCount = 0;

			const request = secret => ({
				body,
				headers: {
					get 'x-ghost-signature'() {
						signatureHeaderReadCount++;
						return `sha256=${sign(JSON.stringify(body) + timestamp, secret)}, t=${timestamp}`;
					},
				},
			});

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '2',
				ghostMemberUpdatedSecret: updatedSecret,
				ghostMemberDeletedSecret: deletedSecret,
			});

			const next = sinon.stub();
			await controller.deleteController('sync')?.(request(deletedSecret), {}, next);
			// Bypass replay checker
			timestamp++;
			await controller.memberUpdated(request(updatedSecret), {}, next);

			expect(signatureHeaderReadCount).to.equal(2);
			expect(next.callCount).to.equal(2);
			expect(next.args[0][0].message).to.equal('Missing member ID');
			expect(next.args[1][0].message).to.equal('Missing member ID');
			expect(logger.error.called).to.be.false;
		});

		it('invalid secrets', async function () {
			const logger = stubLogging();
			const updatedSecret = 'ghostMemberUpdatedSecret';
			const deletedSecret = 'ghostMemberDeletedSecret';
			let timestamp = Date.now();
			const body = {hello: 'world'};
			let signatureHeaderReadCount = 0;

			const request = secret => ({
				body,
				headers: {
					get 'x-ghost-signature'() {
						signatureHeaderReadCount++;
						return `sha256=${sign(JSON.stringify(body), secret)}, t=${timestamp}`;
					},
				},
			});

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '1',
				ghostMemberUpdatedSecret: updatedSecret,
				ghostMemberDeletedSecret: deletedSecret,
			});

			const status = sinon.stub();
			const json = sinon.stub();
			const next = sinon.stub();
			const response = {status, json};
			status.returns(response);
			await controller.deleteController('sync')?.(request(updatedSecret), response, next);
			// Bypass replay checker
			timestamp++;
			await controller.memberUpdated(request(deletedSecret), response, next);

			expect(signatureHeaderReadCount).to.equal(2);
			expect(status.args).to.deep.equal([[400], [400]]);
			expect(json.args).to.deep.equal([
				[{message: 'Invalid signature'}],
				[{message: 'Invalid signature'}],
			]);
			expect(logger.error.called).to.be.false;
		});

		it('missing signature', async function () {
			const logger = stubLogging();
			/* eslint-disable no-await-in-loop */
			for (const version of ['1', '2']) {
				let signatureHeaderReadCount = 0;

				const request = {
					body: {hello: 'world'},
					headers: {
						get 'x-ghost-signature'() {
							signatureHeaderReadCount++;
							return undefined;
						},
					},
				};

				const controller = createGhostWebhookController({
					// @ts-expect-error test scenarios
					ghostWebhooksSecretVersion: version,
					ghostMemberUpdatedSecret: 'a',
					ghostMemberDeletedSecret: 'b',
				});

				const status = sinon.stub();
				const json = sinon.stub();
				const next = sinon.stub();
				const response = {status, json};
				status.returns(response);
				await controller.deleteController('sync')?.(request, response, next);
				await controller.memberUpdated(request, response, next);

				expect(signatureHeaderReadCount).to.equal(2);
				expect(status.args).to.deep.equal([[400], [400]]);
				expect(json.args).to.deep.equal([
					[{message: 'Missing signature'}],
					[{message: 'Missing signature'}],
				]);
				expect(logger.error.called).to.be.false;
			}
			/* eslint-enable no-await-in-loop */
		});

		it('invalid signature', async function () {
			const logger = stubLogging();
			const body = {hello: 'world'};
			const secret = 'deleted_secret';

			const request = {
				body,
				headers: {
					'x-ghost-signature': sign(JSON.stringify(body), secret),
				},
			};

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '1',
				ghostMemberDeletedSecret: secret,
			});

			const status = sinon.stub();
			const json = sinon.stub();
			const next = sinon.stub();
			const response = {status, json, end: sinon.stub()};
			status.returns(response);
			await controller.deleteController('sync')?.(request, response, next);

			expect(status.args).to.deep.equal([[400]]);
			expect(json.args).to.deep.equal([[{message: 'Invalid signature'}]]);
			expect(logger.error.called).to.be.false;
		});

		it('incorrect configuration', async function () {
			const logger = stubLogging();
			let signatureHeaderReadCount = 0;

			const request = {
				body: {hello: 'world'},
				headers: {
					get 'x-ghost-signature'() {
						signatureHeaderReadCount++;
						return `sha256=abcd, t=${signatureHeaderReadCount}`;
					},
				},
			};

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '0',
				ghostMemberUpdatedSecret: 'a',
				ghostMemberDeletedSecret: 'b',
			});

			const status = sinon.stub();
			const json = sinon.stub();
			const next = sinon.stub();
			const response = {status, json, end: sinon.stub()};
			status.returns(response);
			await controller.deleteController('sync')?.(request, response, next);
			await controller.memberUpdated(request, response, next);

			expect(signatureHeaderReadCount).to.equal(2);
			expect(status.args).to.deep.equal([[500], [500]]);
			expect(json.args).to.deep.equal([
				[{message: 'Invalid server configuration'}],
				[{message: 'Invalid server configuration'}],
			]);
			expect(logger.error.calledTwice).to.be.true;
		});

		it('replays', async function () {
			const logger = stubLogging();
			const body = {hello: 'world'};
			const secret = 'deleted_secret';

			const request = {
				body,
				headers: {
					'x-ghost-signature': `sha256=${sign(JSON.stringify(body), secret)}, t=1234`,
				},
			};

			const controller = createGhostWebhookController({
				ghostWebhooksSecretVersion: '1',
				ghostMemberDeletedSecret: secret,
			});

			const status = sinon.stub();
			const json = sinon.stub();
			const next = sinon.stub();
			const response = {status, json, end: sinon.stub()};
			status.returns(response);
			await controller.deleteController('sync')?.(request, response, next);
			await controller.deleteController('sync')?.(request, response, next);

			// First request
			expect(next.args[0][0].message).to.equal('Missing member ID');
			// Second request
			expect(status.args).to.deep.equal([[204]]);
			expect(logger.error.called).to.be.false;
		});
	});
});
