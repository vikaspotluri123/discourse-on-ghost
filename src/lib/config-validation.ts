import {Logger} from '../types/logger.js';
import {inject} from './injector.js';

function coerceToBoolean(envVar: string | undefined, defaultValue: boolean): boolean {
	if (envVar === undefined || envVar === '') {
		return defaultValue;
	}

	return envVar.toLowerCase() === 'true' || envVar === '1';
}

function coerceToNumber(candidate: unknown, {min, max}: {min?: number; max?: number}): number {
	const coerced = Number(candidate);

	if (Number.isNaN(coerced)) {
		const lessThan = typeof min === 'number' ? `greater than ${min}` : '';
		const greaterThan = typeof max === 'number' ? `less than ${max}` : '';
		const final = lessThan && greaterThan ? `between ${lessThan} and ${greaterThan}` : lessThan || greaterThan;
		const safeCandidate = String(candidate);
		throw new Error(`${safeCandidate} is not a valid number${final ? ` ${final}` : ''}`);
	}

	if (typeof min === 'number' && coerced < min) {
		throw new Error(`${coerced} must be greater than ${min}`);
	}

	if (typeof max === 'number' && coerced > max) {
		throw new Error(`${coerced} must be less than ${max}`);
	}

	return coerced;
}

const required = Symbol('required');

type MustBeBoolean = 'boolean() can only be used when the value is a boolean';
type MustBeString = 'url() can only be used when the value is a string';
type MustBeNumber = 'number() can only be used when the value is a number';

export class ConfigKeyValidator<
	Key extends string,
	Value extends string | number | boolean,
> {
	private _test?: RegExp;
	private _mustBeUrl = false;
	private _default: Value | typeof required = required;
	private _transformer?: (value: string) => Value;
	private _suggestion?: () => string;
	private _values?: string[];
	private _disallowed?: Value[];

	constructor(public readonly key: Key, private readonly value: string | undefined) {}

	optional(fallback: Value) {
		this._default = fallback;
		return this;
	}

	matches(regex: RegExp) {
		this._test = regex;
		return this;
	}

	transforms(transform: (value: string) => Value) {
		this._transformer = transform;
		return this;
	}

	enum(...values: string[]): Value extends string ? this : MustBeString {
		this._values = values;
		// @ts-expect-error The method return type ensures value will always be string
		return this;
	}

	boolean(defaultValue: boolean): Value extends boolean ? this : MustBeBoolean {
		// @ts-expect-error The method return type ensures value will always be boolean
		this._transformer = t => coerceToBoolean(t, defaultValue);
		// @ts-expect-error The method return type ensures value will always be boolean
		return this;
	}

	numeric(options: Parameters<typeof coerceToNumber>[1] = {}): Value extends number ? this : MustBeNumber {
		// @ts-expect-error The method return type ensures value will always be number
		this._transformer = candidate => coerceToNumber(candidate, options);
		// @ts-expect-error The method return type ensures value will always be number
		return this;
	}

	url(): Value extends string ? this : MustBeString {
		this._mustBeUrl = true;
		// @ts-expect-error The method return type ensures value will always be boolean
		return this;
	}

	not(value: Value) {
		this._disallowed = [value];
		return this;
	}

	suggests(suggestion: () => string) {
		this._suggestion = suggestion;
		return this;
	}

	coerce(): Value {
		const {value} = this;

		if (!value) {
			if (this._default === required) {
				const suffix = this._suggestion ? `. Try ${this._suggestion()}` : '';
				throw new Error(`Missing required configuration: ${this.key}${suffix}`);
			}

			return this._transformer?.(this._default.toString()) ?? this._default;
		}

		if (this._values) {
			if (!this._values.includes(value)) {
				const values = this._values.join(', ');
				throw new Error(`Invalid configuration: ${this.key} must be one of ${values}`);
			}

			// @ts-expect-error values() can only be called when the value is a string
			return this._transformer?.(value) ?? value;
		}

		if (this._mustBeUrl) {
			try {
				new URL(value); // eslint-disable-line no-new
			} catch {
				throw new Error(`Invalid configuration: ${this.key} must be a URL`);
			}
		}

		if (this._test && !this._test.test(value)) {
			const match = this._test.toString();
			const suffix = this._suggestion ? `. Try ${this._suggestion()}` : '';
			throw new Error(`Invalid configuration: ${this.key} must match ${match}${suffix}`);
		}

		const transformed = this._transformer?.(value) ?? value;

		if (this._disallowed?.includes(transformed as Value)) {
			const suffix = this._suggestion ? `. Try ${this._suggestion()}` : '';
			throw new Error(`Invalid configuration: ${this.key} cannot be ${value}${suffix}`);
		}

		return transformed as Value;
	}
}

export class ConfigValidator<
	FinalShape extends Record<string, string | boolean | number>,
> {
	private readonly logger = inject(Logger);
	private readonly _keys: Array<ConfigKeyValidator<string, FinalShape[string]>> = [];
	private readonly _externalToInternalKeyMap: Record<string, Array<keyof FinalShape>> = {};

	constructor(
		private readonly _unsafeConfig: Record<string, string | undefined>,
		private readonly _internalToExternalKeyMap: Record<keyof FinalShape, string>,
	) {}

	for<Key extends keyof FinalShape>(key: Key) {
		const externalKey = this._internalToExternalKeyMap[key];
		this._externalToInternalKeyMap[externalKey] ??= [];

		if (!this._externalToInternalKeyMap[externalKey].includes(key)) {
			this._externalToInternalKeyMap[externalKey].push(key);
		}

		const value = this._unsafeConfig[externalKey];
		return new ConfigKeyValidator<(typeof this._internalToExternalKeyMap)[Key], FinalShape[Key]>(externalKey, value);
	}

	add(...things: typeof this._keys) {
		this._keys.push(...things);
		return this;
	}

	finalize(): FinalShape | undefined {
		// @ts-expect-error due to the external to internal config map, we can know
		// that all the config keys will be specified
		const config: FinalShape = {};
		let successful = true;

		const internalKeys = new Set(Object.keys(this._internalToExternalKeyMap));

		for (const validator of this._keys) {
			const {key: externalKey} = validator;
			const internalKey = this._externalToInternalKeyMap[externalKey]?.shift();

			if (!internalKey) {
				throw new Error(`No internal mapping for external config key: ${externalKey}`);
			}

			internalKeys.delete(internalKey as string);
			try {
				config[internalKey] = validator.coerce();
			} catch (error: unknown) {
				this.logger.error(error);
				successful = false;
			}
		}

		if (internalKeys.size > 0) {
			const missingKeys = [...internalKeys].join(', ');
			throw new Error(`Some configuration options haven't been validated: ${missingKeys}`);
		}

		if (!successful) {
			return;
		}

		return config;
	}
}
