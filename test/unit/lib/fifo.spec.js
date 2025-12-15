// @ts-check
import {expect} from 'chai';
import {beforeEach, describe, it} from 'mocha';
import {Fifo} from '../../../dist/lib/fifo.js';

class FifoTest extends Fifo {
	get count() {
		return this.lookupStore.size;
	}

	toArray() {
		if (this.head === this.tail && !this.full) {
			return [];
		}

		const {sizeStore, head, tail} = this;
		const response = [];
		let notTouched = true;

		for (let i = head; notTouched || i !== tail; i = (i + 1) % sizeStore.length) {
			notTouched = false;
			response.push(sizeStore[i]);
		}

		return response;
	}
}

/**
 * @param {FifoTest} queue
 * @param {number[]} expected
 */
function expectQueueItems(queue, expected) {
	expect(queue.toArray()).to.deep.equal(expected);
	expect(queue.count).to.equal(expected.length);
}

describe('Fifo', function () {
	/** @type {FifoTest} */
	let fifo;

	beforeEach(function () {
		fifo = new FifoTest(3);
	});

	it('add', function () {
		expect(fifo.add(1)).to.equal(true);
		expect(fifo.add(1), 'Should not add duplicates').to.equal(false);

		expectQueueItems(fifo, [1]);

		expect(fifo.add(2)).to.equal(true);
		expect(fifo.add(2), 'Should not add duplicates').to.equal(false);
		expect(fifo.add(3)).to.equal(true);
		expect(fifo.add(4), 'Should drop old items').to.equal(true);
		expect(fifo.add(5), 'Should drop old items').to.equal(true);
		expect(fifo.add(1), 'Dropped items can be added again').to.equal(true);

		expectQueueItems(fifo, [4, 5, 1]);
	});
});
