const encoder = new TextEncoder();

// Pulled from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
type Format = 'raw' | 'pkcs8' | 'spki' | 'jwk';
type Usage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey';
type KeyData = ArrayBufferView | DataView; // Partial - TypedArray is not available
type Algorithm = {
	name: 'AES-CTR' | 'AES-CBC' | 'AES-GCM' | 'AES-KW';
} | {
	name: 'HMAC';
	hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
};

type CryptoKey = symbol; // CryptoKey is a pretty complex type that's not worth fully defining

export interface WebCrypto {
	getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
	subtle: {
		// eslint-disable-next-line max-params
		importKey: (format: Format, keyData: KeyData, algorithm: Algorithm, extractable: boolean, keyUsages: Usage[]) => Promise<CryptoKey>;
		verify: (algorithm: 'HMAC', key: CryptoKey, signature: ArrayBuffer, data: ArrayBufferView) => Promise<boolean>;
		sign: (algorithm: 'HMAC', key: CryptoKey, data: ArrayBufferView) => Promise<ArrayBuffer>;
	};
}

export function toHex(buffer: Uint8Array): string {
	let response = '';
	for (const element of buffer) {
		response += element.toString(16).padStart(2, '0');
	}

	return response;
}

export function fromHex(source: string) {
	const container = new Uint8Array(source.length / 2);
	for (let i = 0; i < source.length; i += 2) {
		container[i / 2] = Number.parseInt(source.slice(i, i + 2), 16);
	}

	return container.buffer;
}

export class CryptoService {
	constructor(private readonly crypto: WebCrypto) {}

	getRandomHex(length: number) {
		const container = new Uint8Array(length);
		this.crypto.getRandomValues(container);

		return toHex(container);
	}

	async secretToKey(secret: string) {
		return this.crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify', 'sign']);
	}

	async verify(key: CryptoKey, hexSignature: string, data: string) {
		return this.crypto.subtle.verify('HMAC', key, fromHex(hexSignature), encoder.encode(data));
	}

	async sign(key: CryptoKey, data: string) {
		const raw = await this.crypto.subtle.sign('HMAC', key, encoder.encode(data));
		return toHex(new Uint8Array(raw));
	}
}
