/** The Music dot: a pasted playlist read and waiting to be picked. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createTeam, joinTeam } from '$lib/server/teams';
import {
	addFromImport,
	createImport,
	dismissImport,
	storeImportItems
} from '$lib/server/song-imports';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import type { Space } from '$lib/server/scope';
import { load as layoutLoad } from '../+layout.server';

let db: Db;
const cookies = { get: () => undefined, set: () => {}, delete: () => {} } as unknown as Cookies;
const dotFor = async (id: string) =>
	(
		(await (layoutLoad as unknown as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			locals: { user: { id, timezone: 'Europe/Ljubljana', dance: 'salsa', role: 'user' } },
			cookies,
			url: new URL('http://x/salsa/songs')
		})) as { musicToPick: boolean }
	).musicToPick;

function list(space: Space, read = true) {
	const id = createImport(db, space, {
		url: 'https://www.youtube.com/playlist?list=PL1',
		kind: 'youtube-playlist'
	}).id;
	if (read)
		storeImportItems(db, id, {
			name: 'Clase',
			items: [{ title: 'Uno', artist: null, durationS: 200, url: 'https://youtu.be/x1' }],
			truncated: false
		});
	return id;
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
});

describe('the Music dot', () => {
	it('shows while a read list of mine waits, and goes once added or dismissed', async () => {
		expect(await dotFor('u1')).toBe(false);
		list(U1_SALSA, false);
		expect(await dotFor('u1')).toBe(false);
		const a = list(U1_SALSA);
		expect(await dotFor('u1')).toBe(true);
		addFromImport(db, U1_SALSA, a, [{ i: 0, title: 'Uno', artist: null, style: 'salsa' }]);
		expect(await dotFor('u1')).toBe(false);
		const b = list(U1_SALSA);
		dismissImport(db, b);
		expect(await dotFor('u1')).toBe(false);
	});

	it("shows a group's list to its editor, never to a member", async () => {
		list(T1_SALSA);
		expect(await dotFor('u1')).toBe(true);
		expect(await dotFor('u2')).toBe(false);
	});
});
