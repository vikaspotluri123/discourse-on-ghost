import {Logger} from '../types/logger.js';
import {inject} from './injector.js';
import {Semaphore} from './semaphore.js';

export class Queue {
	private readonly logger = inject(Logger);
	private readonly _semaphore: Semaphore;
	private readonly _jobs = new Set<string>();
	private _jobId = 0;

	constructor(delay = 1000) {
		this._semaphore = new Semaphore(1, delay);
	}

	async add<Func extends (...args: any[]) => any>(
		name: string, func: Func, ...args: Parameters<Func>
	): Promise<ReturnType<Func>> {
		this._jobs.add(name);
		this._jobId++;
		const unsubscribe = await this._semaphore.acquire();
		const functionName = (func.name || '<anonymous>').replace('bound ', '');
		const jobs = this._jobs.size === 1 ? 'job' : 'jobs';
		this.logger.info(`Running job ${this._jobId} (${functionName}). ${this._jobs.size} ${jobs} in queue.`);

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
