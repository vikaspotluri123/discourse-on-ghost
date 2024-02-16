type Class<T> = new(...arguments_: any[]) => T;

// eslint-disable-next-line @typescript-eslint/ban-types
interface InjectionToken<T> extends Symbol {
	$TokenName: T;
}

type Token<TokenType> = Class<TokenType> | InjectionToken<TokenType>;

const instances = new Map<Class<any> | InjectionToken<unknown>, unknown>();

const currentlyInjecting = Symbol('injecting');

export type Dependency<T> = T extends Token<infer U> ? U : never;

export function inject<Dependency>(token: Token<Dependency>): Dependency {
	const singleton = instances.get(token) as Dependency | symbol;

	if (singleton === currentlyInjecting) {
		throw new Error('Cyclical dependency injection detected');
	}

	if (singleton) {
		return singleton as Dependency;
	}

	if (typeof token === 'symbol' || token instanceof Symbol) {
		const tokenName = String(token).slice(7, -1);
		throw new TypeError(`Cannot inject "${tokenName}": InjectionTokens must be bootstrapped`);
	}

	instances.set(token, currentlyInjecting);
	const instance = new token(); // eslint-disable-line new-cap
	instances.set(token, instance);
	return instance;
}

export function bootstrapInjection<Dependency>(token: Token<Dependency>, instance: Dependency) {
	instances.set(token, instance);
}

export function createInjectionToken<T>(description: string): InjectionToken<T> {
	return Symbol(description) as unknown as InjectionToken<T>;
}
