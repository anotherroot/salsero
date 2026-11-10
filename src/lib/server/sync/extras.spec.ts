import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const fakes = vi.hoisted(() => ({ pending: 0, grants: 0, release: null as unknown }));
vi.mock('$lib/server/ai-queue/store', () => ({ pendingCount: () => fakes.pending }));
vi.mock('$lib/server/oauth/store', () => ({
	listGrants: () => Array.from({ length: fakes.grants }, (_, i) => ({ id: i }))
}));
vi.mock('$lib/server/releases', () => ({ currentRelease: () => fakes.release }));

import { openDb, type Db } from '$lib/server/db';
import { makeClass, CLASS_ED } from '$lib/server/test-class';
import { createImport, storeImportItems } from '$lib/server/song-imports';
import { serverExtras } from './extras';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	makeClass(db);
	db.run(sql`UPDATE users SET dance = 'salsa'`);
	Object.assign(fakes, { pending: 0, grants: 0, release: null });
});

function readyImport(space: Parameters<typeof createImport>[1], url: string): number {
	const imp = createImport(db, space, { url, kind: 'youtube-playlist' });
	storeImportItems(db, imp.id, {
		name: 'List',
		items: [{ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', title: 'One' }],
		truncated: false
	});
	return imp.id;
}

describe('serverExtras', () => {
	it('is empty for a person with nothing waiting', () => {
		expect(serverExtras(db, 'u4')).toEqual({
			musicToPick: false,
			aiPending: 0,
			aiConnected: false,
			release: null,
			imports: { own: [], teams: {} }
		});
	});

	it("carries the Music dot, the AI count and the group's imports", () => {
		readyImport({ dance: 'salsa', userId: 'u2' }, 'https://www.youtube.com/playlist?list=A');
		const team = readyImport(CLASS_ED, 'https://www.youtube.com/playlist?list=B');
		fakes.pending = 2;
		fakes.grants = 1;
		const x = serverExtras(db, 'u2');
		expect(x.musicToPick).toBe(true);
		expect(x.aiPending).toBe(2);
		expect(x.aiConnected).toBe(true);
		// Own view: own lists, then the ready lists of the groups they edit.
		expect(x.imports.own.map((r) => r.id)).toHaveLength(2);
		// Group view: the group's own lists.
		expect(x.imports.teams['1'].map((r) => r.id)).toEqual([team]);
	});

	it('never carries a group the person does not edit', () => {
		readyImport(CLASS_ED, 'https://www.youtube.com/playlist?list=B');
		// Maja is a member, not an editor: no group view, nothing to pick.
		const x = serverExtras(db, 'u3');
		expect(x.imports.teams).toEqual({});
		expect(x.musicToPick).toBe(false);
	});

	it("carries the dance's current release", () => {
		fakes.release = {
			versionCode: 9,
			versionName: '1.8',
			minVersionCode: 1,
			sha256: 'x',
			size: 1,
			commit: 'c'
		};
		expect(serverExtras(db, 'u1').release).toEqual(fakes.release);
	});
});
