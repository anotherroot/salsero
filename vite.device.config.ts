/*
 * The device worker's bundle (offline phase 2): src/device/worker.ts with
 * SvelteKit's built server (.svelte-kit/output/server) inside it, Node's
 * built-ins swapped for small stubs and better-sqlite3 for the SQLite WASM
 * shim. Runs after `vite build` (`npm run build`), and writes to
 * build/client/_device/<version>/ beside the build it belongs to:
 *   worker.js, its chunks, sqlite3.wasm, and files.json (what the service
 *   worker precaches, so an offline reload can still start the worker).
 * scripts/check-device-build.mjs checks the result.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const stub = (name: string) => here(`./src/device/node-stubs/${name}.ts`);

const VERSION_JSON = here('./.svelte-kit/output/client/_app/version.json');
if (!existsSync(VERSION_JSON)) throw new Error(`run vite build first: ${VERSION_JSON} is missing`);
const version: string = JSON.parse(readFileSync(VERSION_JSON, 'utf8')).version;
const OUT = here(`./build/client/_device/${version}`);
const SQLITE_DIST = here('./node_modules/@sqlite.org/sqlite-wasm/dist/');

/**
 * sqlite-wasm points at three files beside itself with `new URL('…',
 * import.meta.url)`: sqlite3.wasm, and the workers of two APIs the device does
 * not use (`sqlite3-worker1` for the Worker1 promiser, the "opfs" VFS's async
 * proxy). Vite would bundle each: the WASM inlined as a data: URL (library
 * mode always inlines) and each worker as a file of its own. The device needs
 * none of that: the WASM is copied beside worker.js once, and `locateFile`
 * finds it there. So the URLs are left to the browser, unbundled.
 */
function sqliteUrlsUnbundled(): Plugin {
	return {
		name: 'device-sqlite-urls-unbundled',
		enforce: 'pre',
		transform(code, id) {
			if (!id.startsWith(SQLITE_DIST) || !id.endsWith('index.mjs')) return null;
			const out = code.replace(
				/new URL\(("[^"]+"), import\.meta\.url\)/g,
				'new URL($1, String(import.meta.url))'
			);
			const left = out.match(/new URL\("[^"]+", import\.meta\.url\)/g);
			if (left) throw new Error(`sqlite-wasm: unhandled ${left.join(', ')}`);
			if (out === code) throw new Error('sqlite-wasm: no new URL(…, import.meta.url) found');
			return { code: out, map: null };
		}
	};
}

/** sqlite3.wasm beside worker.js, then files.json: every file in the version directory. */
function deviceFiles(): Plugin {
	return {
		name: 'device-files',
		closeBundle() {
			copyFileSync(join(SQLITE_DIST, 'sqlite3.wasm'), join(OUT, 'sqlite3.wasm'));
			const files = readdirSync(OUT, { recursive: true, withFileTypes: true })
				.filter((d) => d.isFile() && d.name !== 'files.json')
				.map((d) => `/_device/${version}/${relative(OUT, join(d.parentPath, d.name))}`)
				.sort();
			writeFileSync(join(OUT, 'files.json'), JSON.stringify(files));
		}
	};
}

export default defineConfig({
	configFile: false,
	// Plain Vite: none of vite.config.ts (no SvelteKit plugin; the server is already built).
	publicDir: false,
	resolve: {
		conditions: ['browser', 'module', 'import', 'default'],
		alias: [
			{ find: /^\$lib\//, replacement: here('./src/lib/') },
			{ find: /^better-sqlite3$/, replacement: here('./src/device/sqlite-shim.ts') },
			// `migrateDevice` brings the copy up to date before the server opens it.
			{ find: /^drizzle-orm\/better-sqlite3\/migrator$/, replacement: stub('migrator') },
			{ find: /^(node:)?fs(\/promises)?$/, replacement: stub('fs') },
			{ find: /^(node:)?path$/, replacement: stub('path') },
			{ find: /^(node:)?crypto$/, replacement: stub('crypto') },
			{ find: /^(node:)?async_hooks$/, replacement: stub('async-hooks') },
			{
				find: /^(node:)?(os|stream|stream\/promises|stream\/web|util|url)$/,
				replacement: stub('misc')
			}
		]
	},
	define: { 'process.env.NODE_ENV': '"production"' },
	plugins: [sqliteUrlsUnbundled(), deviceFiles()],
	build: {
		outDir: OUT,
		emptyOutDir: true,
		target: 'es2022',
		minify: true,
		// Never inline an asset as a data: URL beside its file (library mode ignores it;
		// sqliteUrlsUnbundled is what keeps the WASM out).
		assetsInlineLimit: 0,
		copyPublicDir: false,
		reportCompressedSize: false,
		// Library mode keeps whitespace for a library's consumers to minify; nobody
		// minifies after this, so minify fully.
		rolldownOptions: { output: { minify: true } },
		lib: {
			entry: here('./src/device/worker.ts'),
			formats: ['es'],
			fileName: () => 'worker.js'
		}
	}
});
