// @ts-check
/* eslint-disable no-console */
/* eslint-disable unicorn/no-process-exit */
import process from 'node:process';
import glob from 'glob';
import {context} from 'esbuild';
import nodemon from 'nodemon';

const disableWatch = 'NO_WATCH' in process.env;

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

const watcher = nodemon({
	script: 'dist/index.js',
	watch: ['dist'],
	delay: 0.01,
});

watcher.once('start', () => {
	console.log('Watching for changes...');
}).on('quit', () => {
	console.log('Exiting...');
	process.exit();
}).on('restart', () => {
	console.log('Restarted');
});
