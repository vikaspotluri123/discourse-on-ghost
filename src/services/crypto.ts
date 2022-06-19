export interface WebCrypto {
	getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
}

export function getRandomHex(crypto: WebCrypto, length: number) {
	const container = new Uint8Array(length);
	crypto.getRandomValues(container);

	let response = '';
	for (const element of container) {
		response += element.toString(16);
	}

	return response;
}
