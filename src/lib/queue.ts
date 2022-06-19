import {Logger} from '../types/logger.js';
import {Semaphore} from './semaphore.js';

export class Queue {
	private readonly _semaphore: Semaphore;
	private readonly _jobs = new Set<string>();
	private _jobId = 0;

	constructor(private readonly logger: Logger, delay = 1000) {
		this._semaphore = new Semaphore(1, delay);
	}

	async add<Func extends (...args: any[]) => any>(
		name: string, func: Func, ...args: Parameters<Func>
	): Promise<ReturnType<Func>> {
		this._jobs.add(name);
		this._jobId++;
		const unsubscribe = await this._semaphore.acquire();
		this.logger.info(`Running job ${this._jobId} (${func.name ?? '<anonymous>'}). ${this._jobs.size} jobs in queue.`);

		try {
			// We want to immediately remove the job from the list of jobs in case
			// something happens that causes the job to be re-queued. (e.g. an event)
			this._jobs.delete(name);
			return await Promise.resolve(func(...args)); // eslint-disable-line @typescript-eslint/no-unsafe-return
		} finally {
			unsubscribe();
		}
	}

	has(name: string) {
		return this._jobs.has(name);
	}

	get count() {
		return this._jobs;
	}
}
