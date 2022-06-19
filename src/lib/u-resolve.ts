export function uResolve(basePath: string, relativePath: string) {
	if (basePath.includes('..')) {
		throw new Error('Invalid base path');
	}

	if (relativePath.includes('..')) {
		throw new Error('Invalid relative path');
	}

	if (basePath === '/') {
		basePath = '';
	}

	const root = (basePath ?? '').replace(/(\/|\\)+/g, '/');
	const relative = relativePath
		.replace(/(\/|\\)+/g, '/') // Remove multiple slashes + convert backslashes to forward slashes
		.replace(/^\.\//, '') // Remove leading ./
		.replace(/^\//, ''); // Remove leading slash

	return `${root}/${relative}`;
}
