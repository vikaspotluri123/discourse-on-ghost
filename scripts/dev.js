// @ts-check
/* eslint-disable no-console */
/* eslint-disable unicorn/no-process-exit */
import process from 'node:process';
import glob from 'glob';
import {build} from 'esbuild';
import nodemon from 'nodemon';

const disableWatch = 'NO_WATCH' in process.env;

await build({
	entryPoints: glob.sync('./src/**/*.ts'),
	target: 'node16',
	platform: 'node',
	format: 'esm',
	outdir: './dist',
	treeShaking: true,
});

if (disableWatch) {
	process.exit();
}

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
