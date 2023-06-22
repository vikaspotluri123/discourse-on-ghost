import sinon from 'sinon';
import {expect} from 'chai';
import {SSOController} from '../../../dist/controllers/sso.js';

describe('Unit > Controllers > SSO', function () {
	/** @type {SSOController} */
	let controller;

	before(function () {
		controller = new SSOController();
	});

	it('session mode includes query parameters when redirecting', async function () {
		const redirect = sinon.stub();
		await controller.sessionUserAuth({
			query: {
				sso: '__sso__',
				sig: '__sig__',
			},
			headers: {},
		}, {redirect});

		expect(redirect.calledOnce).to.be.true;
		expect(redirect.args[0][0]).to.equal('http://ghost.local/?sso=__sso__&sig=__sig__#/portal/account');
	});

	it('jwt mode includes query params when redirecting', async function () {
		const redirect = sinon.stub();
		await controller.jwtUserAuth({
			query: {
				sso: '__sso__',
				sig: '__sig__',
			},
			headers: {},
		}, {setHeader: sinon.stub(), redirect});

		expect(redirect.calledOnce).to.be.true;
		expect(redirect.args[0][0]).to.equal(302);
		expect(redirect.args[0][1]).to.equal('http://ghost.local/?sso=__sso__&sig=__sig__');
	});
});
