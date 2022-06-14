type Unsubscriber = () => void;

export class Semaphore {
	private _activeCount = 0;
	private readonly _queue: Array<(unsubscribe: Unsubscriber) => unknown> = [];

	constructor(private readonly _maximum: number, private readonly _delay = 150) {}

	acquire() {
		if (this._activeCount === this._maximum) {
			const response = new Promise<Unsubscriber>(resolve => {
				this._queue.push(resolve);
			});

			return response;
		}

		this._activeCount++;
		return this._release;
	}

	private readonly _release = () => {
		this._activeCount--;

		if (this._queue.length > 0) {
			setTimeout(this._queue.shift()!, this._delay, this._release);
		}
	};
}

export async function withSemaphore<
	Func extends (...args: any[]) => Promise<any>,
>(semaphore: Semaphore, fn: Func, ...args: Parameters<Func>): Promise<ReturnType<Func>> {
	const unsubscribe = await semaphore.acquire();
	try {
		return await fn(...args); // eslint-disable-line @typescript-eslint/no-unsafe-return
	} finally {
		unsubscribe();
	}
}
