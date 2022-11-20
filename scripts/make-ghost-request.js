#! /usr/bin/env node
// @ts-check
import process from 'node:process';
import fetch from 'node-fetch';
import getToken from '@tryghost/admin-api/lib/token.js';

/**
 * @param {string} url
 * @param {string} key
 */
export async function _debugMakeGhostApiRequest(url, key) {
	/* eslint-disable no-console */
	const response = await fetch(url, {
		headers: {
			authorization: `Ghost ${getToken(key, '/admin')}`,
		},
	});

	if (!response.ok) {
		console.log(response.status);
		console.log(await response.text());
		return;
	}

	console.log(JSON.stringify(await response.json(), null, 2));
	/* eslint-enable no-console */
}

if (process.argv[2] && process.argv[3]) {
	_debugMakeGhostApiRequest(process.argv[2], process.argv[3]); // eslint-disable-line unicorn/prefer-top-level-await
}
