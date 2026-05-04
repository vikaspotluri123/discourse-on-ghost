// @ts-check
import {expect} from 'chai';
import {parseResponseAs, parseResponseErrorDetails} from '../../../dist/services/discourse.js';

describe('Unit > Services > Discourse', function () {
	describe('parseResponseAs', function () {
		it('returns JSON response bodies', async function () {
			const response = {
				text: async () => '{"success":true}',
			};

			expect(await parseResponseAs(response)).to.deep.equal({success: true});
		});

		it('throws when an expected JSON body is not valid JSON', async function () {
			const response = {
				text: async () => 'Slow down, you are making too many requests.',
			};

			try {
				await parseResponseAs(response);
				throw new Error('Expected parseResponseAs to throw');
			} catch (error) {
				expect(error.message).to.equal('Unable to parse Discourse response body as JSON');
				expect(error.errorDetails.body).to.equal('Slow down, you are making too many requests.');
			}
		});
	});

	describe('parseResponseErrorDetails', function () {
		it('returns non-JSON response bodies as error details', async function () {
			const response = {
				text: async () => 'Slow down, you are making too many requests.',
			};

			expect(await parseResponseErrorDetails(response)).to.deep.equal({body: 'Slow down, you are making too many requests.'});
		});
	});
});
