/**
 * The listening page grades taps against a song's count, so it opens only on a
 * song a person counted, in the URL's dance. The db is mocked as in
 * `dance-wall.spec.ts`: `getDb()` never sees a `process.env` set here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_BACHATA, U1_SALSA } from '$lib/server/test-walls';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createSongFromUpload, setAnchors, storeAnalysis } from '$lib/server/songs';
import type { Wall } from '$lib/server/scope';
import { load } from './+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
const threw404 = expect.objectContaining({ status: 404 });

function open(dance: string, id: number) {
	return (load as unknown as (e: unknown) => Record<string, unknown>)({
		params: { dance, id: String(id) },
		url: new URL(`http://localhost/${dance}/songs/${id}/listen`),
		locals: { user: { ...USER, dance } }
	});
}

let db: Db;

function song(wall: Wall, counted: boolean): number {
	const s = createSongFromUpload(db, wall, {
		file: `${wall.dance}-${counted}.mp3`,
		mime: 'audio/mpeg',
		title: 'Chan Chan',
		style: wall.dance === 'salsa' ? 'salsa' : 'sensual'
	});
	storeAnalysis(db, s.id, {
		beats: Array.from({ length: 64 }, (_, i) => i * 0.5),
		downbeats: [0],
		durationS: 32
	});
	if (counted) setAnchors(db, s.id, [0], wall);
	return s.id;
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});

describe('the listening page', () => {
	it('opens on a song a person counted, with its grid', () => {
		const id = song(U1_SALSA, true);
		const data = open('salsa', id);
		expect(data.song).toMatchObject({ id, title: 'Chan Chan' });
		expect((data.grid as { beats: number[] }).beats).toHaveLength(64);
		expect((data.grid as { counts: number[] }).counts.slice(0, 8)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8
		]);
	});

	it('refuses a song only the computer counted', () => {
		const id = song(U1_SALSA, false);
		expect(() => open('salsa', id)).toThrow(threw404);
	});

	it("refuses another dance's song", () => {
		const id = song(U1_BACHATA, true);
		expect(() => open('salsa', id)).toThrow(threw404);
	});
});
