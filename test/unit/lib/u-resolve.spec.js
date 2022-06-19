// @ts-check

import {expect} from 'chai';
import {uResolve} from '../../../dist/lib/u-resolve.js';

describe('Unit > Lib > MicroResolver', function () {
	it('No base path', function () {
		expect(uResolve('', '/path/a')).to.equal('/path/a');
		expect(uResolve('/', '/path/a')).to.equal('/path/a');
	});

	it('With base path', function () {
		expect(uResolve('/base/path', '/path/a')).to.equal('/base/path/path/a');
	});

	it('With relative second path', function () {
		expect(uResolve('/base/path', 'path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/base/path', './path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/base/path', '.path/a')).to.equal('/base/path/.path/a');
		expect(uResolve('/', './path/a')).to.equal('/path/a');
	});

	it('Does not deal with traversal', function () {
		expect(() => uResolve('/base/path', '../path/a')).to.throw(/Invalid relative/);
		expect(() => uResolve('../base/path', '/path/a')).to.throw(/Invalid base/);
	});

	it('URL Path resolution', function () {
		const startingPoint = new URL('https://example.com/this/is/the/root');

		expect(uResolve(startingPoint.pathname, './and/this/is/the/path'))
			.to.equal('/this/is/the/root/and/this/is/the/path');
	});

	it('Removes duplicate slashes', function () {
		expect(uResolve('/base/path', '//path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/base/path', '///path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/base//path', '/path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/base///path', '/path/a')).to.equal('/base/path/path/a');
		expect(uResolve('/', '/path/a')).to.equal('/path/a');
	});
});
