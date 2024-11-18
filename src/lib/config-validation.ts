import {Logger} from '../types/logger.js';
import {inject} from './injector.js';

class ConfigValidationError extends Error {
	// eslint-disable-next-line @typescript-eslint/class-literal-property-style
	readonly hideStack = true;
	readonly suggestion: string | undefined;
	readonly help: string | undefined;
	readonly context: string | undefined;

	constructor(keyName: string, suggestion?: string, context?: string) {
		super(`${keyName} is not valid`);
		this.context = context;
		this.suggestion = suggestion;
		this.help = suggestion ? `Suggestion: ${suggestion}` : undefined;
	}
}

function coerceToBoolean(envValue: string | undefined, defaultValue: boolean): boolean {
	if (envValue === undefined || envValue === '') {
		return defaultValue;
	}

	return envValue.toLowerCase() === 'true' || envValue === '1';
}

function coerceToNumber(candidate: unknown, {min, max}: {min?: number; max?: number}): number {
	const coerced = Number(candidate);

	if (Number.isNaN(coerced)) {
		const lessThan = typeof min === 'number' ? `greater than ${min}` : '';
		const greaterThan = typeof max === 'number' ? `less than ${max}` : '';
		const final = lessThan && greaterThan ? `between ${min!} and ${max!}` : lessThan || greaterThan;
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
				throw new ConfigValidationError(this.key, this._suggestion?.(), 'This is a required variable');
			}

			return this._transformer?.(this._default.toString()) ?? this._default;
		}

		if (this._values) {
			if (!this._values.includes(value)) {
				const values = this._values.join(', ');
				throw new ConfigValidationError(this.key, '', `Must be ${values}`);
			}

			// @ts-expect-error values() can only be called when the value is a string
			return this._transformer?.(value) ?? value;
		}

		if (this._mustBeUrl) {
			try {
				new URL(value); // eslint-disable-line no-new
			} catch {
				throw new ConfigValidationError(this.key, '', 'Must be a URL');
			}
		}

		if (this._test && !this._test.test(value)) {
			const match = this._test.toString();
			throw new ConfigValidationError(this.key, this._suggestion?.(), `Must match ${match}`);
		}

		const transformed = this._transformer?.(value) ?? value;

		if (this._disallowed?.includes(transformed as Value)) {
			throw new ConfigValidationError(this.key, this._suggestion?.(), `Cannot be ${value}`);
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
		let failures = 0;

		const internalKeys = new Set(Object.keys(this._internalToExternalKeyMap));
		const suggestions = [];

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
				if (error instanceof ConfigValidationError) {
					this.logger.error(error);
					if (error.suggestion) {
						suggestions.push(`${externalKey}="${error.suggestion}"`);
					}
				} else if (error instanceof Error) {
					this.logger.error(new ConfigValidationError(validator.key, '', error.message));
				}

				failures++;
			}
		}

		if (internalKeys.size > 0) {
			const missingKeys = [...internalKeys].join(', ');
			throw new Error(`Some configuration options haven't been validated: ${missingKeys}`);
		}

		if (failures > 0) {
			const keys = failures === 1 ? 'key was' : 'keys were';
			this.logger.error(`${failures} config ${keys} were invalid, unable to continue`);

			if (suggestions.length > 0) {
				const suggestion = suggestions.length === 1 ? 'Suggestion' : 'Suggestions';
				this.logger.info(`${suggestion}:\n\n${suggestions.join('\n')}\n`);
			}

			return;
		}

		return config;
	}
}
