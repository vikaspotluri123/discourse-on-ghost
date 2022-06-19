const encoder = new TextEncoder();

// Pulled from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
type Format = 'raw' | 'pkcs8' | 'spki' | 'jwk';
type Usage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey';
type KeyData = ArrayBufferView | DataView | JsonWebKey; // Partial - TypedArray is not available
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
		importKey: (format: Format, keyData: KeyData, algorithm: Algorithm, extractable: boolean, keyUsages: Usage[]) => Promise<CryptoKey>;
		verify: (algorithm: 'HMAC', key: CryptoKey, signature: ArrayBuffer, data: ArrayBuffer) => Promise<boolean>;
		sign: (algorithm: 'HMAC', key: CryptoKey, data: ArrayBuffer) => Promise<ArrayBuffer>;
	};
}

export function toHex(buffer: ArrayBuffer): string {
	const container = new Uint8Array(buffer);
	let response = '';
	for (const element of container) {
		response += element.toString(16);
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

export function getRandomHex(crypto: WebCrypto, length: number) {
	const container = new Uint8Array(length);
	crypto.getRandomValues(container);

	return toHex(container);
}

export async function secretToKey(crypto: WebCrypto, secret: string) {
	return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify', 'sign']);
}

export async function verify(crypto: WebCrypto, key: CryptoKey, hexSignature: string, data: string) {
	return crypto.subtle.verify('HMAC', key, fromHex(hexSignature), encoder.encode(data));
}

export async function sign(crypto: WebCrypto, key: CryptoKey, data: string) {
	const raw = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	return toHex(raw);
}
