// @ts-check
/* eslint-disable no-console */
/* eslint-disable unicorn/no-process-exit */
import process, {argv} from 'node:process';
import {existsSync} from 'node:fs';
import { glob } from 'glob';
import {context} from 'esbuild';

const disableWatch = 'NO_WATCH' in process.env;
const target = argv[2] ?? 'node';

const esbuilder = await context({
	entryPoints: glob.sync('./src/**/*.ts'),
	target: 'node16',
	platform: 'node',
	format: 'esm',
	outdir: './dist',
	treeShaking: true,
	sourcemap: true,
});

if (disableWatch) {
	await esbuilder.rebuild();
	process.exit();
}

await esbuilder.watch();

const script = `dist/targets/${target}.js`;

if (!existsSync(script)) {
	console.error(`Unknown target "${target}"`);
	process.exit(1);
}

console.log(`Watching and ready to run ${script}...`);

// Suggestion: run `nodemon dist/targets/node.js` from CLI or package.json instead
