export class Fifo<T> {
	protected sizeStore: T[];
	protected head = 0;
	protected tail = 0;
	protected full = false;
	protected readonly lookupStore = new Set();

	constructor(capacity: number) {
		this.sizeStore = Array.from({length: capacity});
	}

	/**
	 * Adds an item
	 * @param item - the item to add
	 * @returns if the item was added to the store
	 */
	add(item: T): boolean {
		if (this.lookupStore.has(item)) {
			return false;
		}

		if (this.full) {
			this._pop();
		}

		this.sizeStore[this.tail] = item;
		this.lookupStore.add(item);
		this.tail = (this.tail + 1) % this.sizeStore.length;
		this.full = this.tail === this.head;

		return true;
	}

	/**
	 * Removes the first element from the store
	 */
	private _pop(): T | undefined {
		if (this.head === this.tail && !this.full) {
			return undefined;
		}

		this.full = false;
		const item = this.sizeStore[this.head];
		this.head = (this.head + 1) % this.sizeStore.length;
		this.lookupStore.delete(item);
		return item;
	}
}
