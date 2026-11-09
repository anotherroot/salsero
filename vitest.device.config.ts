// the whole vitest suite with better-sqlite3 swapped for the SQLite WASM shim.
// The base config's `projects` would each extend vite.config.ts and lose the alias,
// so this config drops them and names the one project's include itself.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

process.env.DEVICE_SQLITE = '1';
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
	...base,
	resolve: { alias: { 'better-sqlite3': here('./src/device/sqlite-shim.ts') } },
	test: {
		expect: { requireAssertions: true },
		testTimeout: 30_000,
		hookTimeout: 30_000,
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
		setupFiles: [here('./src/device/vitest-setup.ts')],
		server: { deps: { inline: ['drizzle-orm'] } }
	}
});
