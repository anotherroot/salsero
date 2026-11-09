#!/usr/bin/env node
// The device bundle's own check (offline phase 2), run by `npm run build` after
// `vite build -c vite.device.config.ts`: the version directory is there, it
// holds one SQLite WASM and no `sqlite3-worker1*` (the spike shipped both by
// accident), and the whole of it stays under 1.5 MB gzipped.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 1.5 * 1024 * 1024;
const VERSION_JSON = 'build/client/_app/version.json';

function fail(message) {
	console.error(`[device build] ${message}`);
	process.exit(1);
}

if (!existsSync(VERSION_JSON)) fail(`no device build: ${VERSION_JSON} is missing`);
const { version } = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
const dir = `build/client/_device/${version}`;
if (!existsSync(dir)) fail(`no device build: ${dir} is missing`);

const files = readdirSync(dir, { recursive: true, withFileTypes: true })
	.filter((d) => d.isFile())
	.map((d) => join(d.parentPath, d.name));

const worker1 = files.filter((f) => /(^|\/)sqlite3-worker1/.test(f));
if (worker1.length) fail(`sqlite3-worker1 is in the bundle: ${worker1.join(', ')}`);
const wasm = files.filter((f) => f.endsWith('.wasm'));
if (wasm.length !== 1) fail(`expected one .wasm, found ${wasm.length}: ${wasm.join(', ')}`);
if (!files.includes(join(dir, 'worker.js'))) fail(`no worker.js in ${dir}`);

const total = files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.info(`[device build] ${dir}: ${files.length} files, ${mb(total)} MB gzipped`);
if (total > LIMIT) fail(`${mb(total)} MB gzipped is over the ${mb(LIMIT)} MB limit`);
