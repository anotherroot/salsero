/**
 * Device first (2026-11-10): a page the device draws online must not read a
 * table that never reaches a device, or the fact goes quietly missing online.
 * Every `+page.server.ts` / `+layout.server.ts` of a route the device draws
 * imports none of the known server-only readers, unless it is listed in
 * ALLOWED with the reason it is safe (it reads the pull's extras on the
 * device, or calls it only in an action). A new server-only reader goes in
 * SERVER_ONLY_READS; a new page needing one goes to the extras
 * (`src/lib/server/sync/extras.ts`), NETWORK_FIRST_PAGES or NETWORK_PAGES.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NETWORK_FIRST_PAGES, NETWORK_PAGES } from './routes';

/** Readers of `NEVER_SYNCED` tables (or the server's disk), by module. */
const SERVER_ONLY_READS: Record<string, string[]> = {
	'$lib/server/song-imports': ['listImports', 'groupImportsToPick', 'importsWaiting', 'itemsOf'],
	'$lib/server/ai-queue/store': ['pendingCount'],
	'$lib/server/ai-queue/view': ['*'],
	'$lib/server/oauth/store': ['listGrants'],
	'$lib/server/devices': ['listDevices'],
	'$lib/server/storage': ['storageOf', 'listStorageItems', 'freeDisk'],
	'$lib/server/releases': ['currentRelease'],
	'$lib/server/app-seen': ['*'],
	'$lib/server/trash': ['listTrash'],
	'$lib/server/invites': ['listInvites']
};

/** File (from src/routes) → the names it may import, and why. */
const ALLOWED: Record<string, { names: string[]; why: string }> = {
	'/+layout.server.ts': { names: ['currentRelease'], why: 'reads extras.release on the device' },
	'/[dance]/+layout.server.ts': {
		names: ['importsWaiting', 'pendingCount', 'listGrants'],
		why: 'reads the extras on the device'
	},
	'/[dance]/songs/+layout.server.ts': {
		names: ['listImports', 'groupImportsToPick'],
		why: 'reads extras.imports on the device'
	},
	'/[dance]/(moves)/figures/[id]/+page.server.ts': {
		names: ['freeDisk'],
		why: 'actions only: uploads, network-only'
	},
	'/[dance]/lessons/[id]/+page.server.ts': {
		names: ['freeDisk'],
		why: 'actions only: Save video from YouTube and its retry'
	}
};

function loadFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = `${dir}/${e.name}`;
		if (e.isDirectory()) return loadFiles(p);
		return e.name === '+page.server.ts' || e.name === '+layout.server.ts' ? [p] : [];
	});
}

const routeOf = (file: string) =>
	file.replace(/^src\/routes/, '').replace(/\/\+(page|layout)\.server\.ts$/, '') || '/';

const notDrawn = new Set([...NETWORK_PAGES, ...NETWORK_FIRST_PAGES]);

/** The names a source imports from `module`. */
function importsFrom(src: string, module: string): string[] {
	const re = new RegExp(
		`import\\s*\\{([^}]*)\\}\\s*from\\s*'${module.replace(/[$/]/g, '\\$&')}'`,
		'g'
	);
	return [...src.matchAll(re)].flatMap((m) =>
		m[1]
			.split(',')
			.map((s) => s.trim().replace(/^type\s+/, ''))
			.filter(Boolean)
	);
}

describe('device-drawn loads read no server-only table', () => {
	const files = loadFiles('src/routes');

	it('finds the route files', () => expect(files.length).toBeGreaterThan(30));

	for (const file of files) {
		const route = routeOf(file);
		if (notDrawn.has(route)) continue;
		it(route, () => {
			const src = readFileSync(file, 'utf8');
			const key = file.replace(/^src\/routes/, '');
			const allowed = ALLOWED[key]?.names ?? [];
			const found = Object.entries(SERVER_ONLY_READS).flatMap(([module, names]) =>
				importsFrom(src, module).filter(
					(n) => (names.includes('*') || names.includes(n)) && !allowed.includes(n)
				)
			);
			expect(found, `${file} reads a server-only table`).toEqual([]);
		});
	}

	it('allows only files that exist', () => {
		for (const key of Object.keys(ALLOWED)) {
			expect(files, key).toContain('src/routes' + key);
		}
	});
});
