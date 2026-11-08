/**
 * A pasted playlist (`song_imports`): read by the worker into a pick list,
 * never downloaded by itself. Owned like a root row; a group's is its editors'.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { songImports, songs, users } from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { archiveSong, claimJob, createSongFromUrl, LEASE_MS, MAX_ATTEMPTS } from './songs';
import { teamChanges } from './db/schema';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';
import {
	claimImportJob,
	createImport,
	dismissImport,
	failImportJob,
	getImport,
	groupImportsToPick,
	importsWaiting,
	listImports,
	MAX_IMPORT_ITEMS,
	addFromImport,
	pickItems,
	retryImport,
	storeImportItems
} from './song-imports';

const T = 1_800_000_000_000;
const SP_LIST = 'https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W';
const YT_LIST = 'https://www.youtube.com/playlist?list=PLo1L1g';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', dance: 'salsa' })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
});

const item = (n: number, url = `https://www.youtube.com/watch?v=vid${n}`) => ({
	title: `Song ${n}`,
	artist: `Artist ${n}`,
	durationS: 200 + n,
	url
});
const make = (space: Space = U1_SALSA, url = SP_LIST, now = T) =>
	createImport(db, space, { url, kind: 'spotify-playlist' }, now);
const ready = (space: Space = U1_SALSA) => {
	const imp = make(space);
	expect(
		storeImportItems(db, imp.id, { name: 'Salsa clásica', items: [item(1)], truncated: false })
	).toBe('stored');
	return imp.id;
};

describe('song imports', () => {
	it('creates a reading import in the space and no song', () => {
		const mine = make();
		expect(mine).toMatchObject({ status: 'reading', userId: 'u1', teamId: null, dance: 'salsa' });
		const group = make(T1_SALSA);
		expect(group).toMatchObject({ teamId: 1, userId: null });
		expect(db.select().from(songs).all()).toEqual([]);
		expect(claimJob(db, T)).toBeNull();
	});

	it("claims the oldest reading import with the songs' lease", () => {
		const a = make(U1_SALSA, SP_LIST, T);
		const b = make(U1_SALSA, YT_LIST, T + 1);
		expect(claimImportJob(db, T + 2)).toEqual({ id: a.id, url: SP_LIST });
		expect(getImport(db, a.id)?.attempts).toBe(1);
		expect(claimImportJob(db, T + 3)?.id).toBe(b.id);
		expect(claimImportJob(db, T + 4)).toBeNull();
		expect(claimImportJob(db, T + 2 + LEASE_MS + 1)?.id).toBe(a.id);
		db.update(songImports).set({ attempts: MAX_ATTEMPTS }).where(eq(songImports.id, b.id)).run();
		const later = T + 10 * LEASE_MS;
		claimImportJob(db, later);
		expect(getImport(db, b.id)).toMatchObject({
			status: 'failed',
			error: `Gave up after ${MAX_ATTEMPTS} attempts.`
		});
		const c = make(U1_SALSA, YT_LIST, later);
		dismissImport(db, c.id, later);
		expect(claimImportJob(db, later + 1)?.id).not.toBe(c.id);
	});

	it('stores the items once, cleaned', () => {
		const imp = make();
		claimImportJob(db, T);
		const items = [
			{ ...item(1, 'https://youtu.be/vid1'), title: 'x'.repeat(250) },
			item(2, 'https://open.spotify.com/track/abc?si=1'),
			{ ...item(3), artist: null },
			item(4, 'https://vimeo.com/1'),
			{ ...item(5), title: '' }
		];
		expect(storeImportItems(db, imp.id, { name: 'Salsa clásica', items, truncated: true })).toBe(
			'stored'
		);
		const row = getImport(db, imp.id)!;
		expect(row).toMatchObject({
			status: 'ready',
			claimedAt: null,
			name: 'Salsa clásica',
			truncated: 1
		});
		const kept = JSON.parse(row.itemsJson!);
		expect(kept.map((i: { url: string }) => i.url)).toEqual([
			'https://www.youtube.com/watch?v=vid1',
			'https://open.spotify.com/track/abc',
			'https://www.youtube.com/watch?v=vid3'
		]);
		expect(kept[0].title).toHaveLength(200);
		expect(kept[2].artist).toBeNull();
		// Once stored, a second report is late.
		expect(storeImportItems(db, imp.id, { name: 'x', items: [item(1)], truncated: false })).toBe(
			'gone'
		);
	});

	it('refuses bad reports and fails a list with no songs', () => {
		const imp = make();
		const many = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => item(i));
		expect(storeImportItems(db, imp.id, { name: 'x', items: many, truncated: false })).toBe('bad');
		expect(storeImportItems(db, imp.id, { name: 'x', items: 'nope', truncated: false })).toBe(
			'bad'
		);
		expect(getImport(db, imp.id)?.status).toBe('reading');
		expect(
			storeImportItems(db, imp.id, {
				name: 'x',
				items: [item(1, 'https://vimeo.com/1')],
				truncated: false
			})
		).toBe('stored');
		expect(getImport(db, imp.id)).toMatchObject({
			status: 'failed',
			error: 'No songs found in this list.'
		});
		const gone = make();
		dismissImport(db, gone.id, T);
		expect(storeImportItems(db, gone.id, { name: 'x', items: [item(1)], truncated: false })).toBe(
			'gone'
		);
	});

	it('fails, retries and dismisses like a song', () => {
		const imp = make();
		claimImportJob(db, T);
		failImportJob(db, imp.id, 'HTTP 429', false);
		expect(getImport(db, imp.id)).toMatchObject({ status: 'reading', error: 'HTTP 429' });
		failImportJob(db, imp.id, 'Private playlist', true);
		expect(getImport(db, imp.id)).toMatchObject({ status: 'failed', error: 'Private playlist' });
		expect(retryImport(db, imp.id)).toBe(true);
		expect(getImport(db, imp.id)).toMatchObject({ status: 'reading', attempts: 0, error: null });
		const r = ready();
		expect(retryImport(db, r)).toBe(false);
		expect(dismissImport(db, imp.id, T)).toBe(true);
		expect(getImport(db, imp.id)?.dismissedAt).toBe(T);
		expect(dismissImport(db, imp.id, T)).toBe(false);
	});

	it('lists what Music shows', () => {
		const reading = make(U1_SALSA, SP_LIST, T);
		const r = ready();
		const gone = make(U1_SALSA, YT_LIST, T + 5);
		dismissImport(db, gone.id, T + 6);
		const groups = make(T1_SALSA);
		const rows = listImports(db, U1_SALSA);
		expect(rows.map((x) => x.id)).toEqual([r, reading.id]);
		expect(rows[0]).toMatchObject({
			status: 'ready',
			count: 1,
			name: 'Salsa clásica',
			group: null
		});
		expect(listImports(db, T1_SALSA).map((x) => x.id)).toEqual([groups.id]);
	});

	it('the dot: a ready import the person may pick', () => {
		expect(importsWaiting(db, 'u1', 'salsa')).toBe(false);
		make();
		expect(importsWaiting(db, 'u1', 'salsa')).toBe(false);
		const mine = ready();
		expect(importsWaiting(db, 'u1', 'salsa')).toBe(true);
		dismissImport(db, mine, T);
		expect(importsWaiting(db, 'u1', 'salsa')).toBe(false);

		joinTeam(db, 'u2', 1, T);
		joinTeam(db, 'u3', 1, T);
		setRole(db, 1, 'u3', 'editor', T);
		ready(T1_SALSA);
		expect(importsWaiting(db, 'u1', 'salsa')).toBe(true);
		expect(importsWaiting(db, 'u3', 'salsa')).toBe(true);
		expect(importsWaiting(db, 'u2', 'salsa')).toBe(false);
		expect(importsWaiting(db, 'u1', 'bachata')).toBe(false);
		expect(groupImportsToPick(db, 'u3', 'salsa')).toEqual([
			expect.objectContaining({ group: { id: 1, name: 'Salsa Tuesdays' }, status: 'ready' })
		]);
		expect(groupImportsToPick(db, 'u2', 'salsa')).toEqual([]);
		expect(listImports(db, U2_SALSA)).toEqual([]);
		deleteTeam(db, 1, 'u1', T);
		expect(importsWaiting(db, 'u3', 'salsa')).toBe(false);
	});
});

describe('Add from a pick list', () => {
	const TRACK = 'https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO';
	function readyOf(space: Space, items: ReturnType<typeof item>[]) {
		const imp = make(space);
		storeImportItems(db, imp.id, { name: 'Clase', items, truncated: false });
		return getImport(db, imp.id)!;
	}

	it('marks a song already in the space by its link', () => {
		const imp = readyOf(U1_SALSA, [item(1, TRACK), item(2), item(3)]);
		createSongFromUrl(db, U1_SALSA, { url: `${TRACK}?si=abc`, title: 'x', style: 'salsa' }, T);
		const yt = createSongFromUrl(
			db,
			U1_SALSA,
			{ url: 'https://youtu.be/zzz', title: 'y', style: 'salsa' },
			T
		);
		db.update(songs).set({ audioUrl: 'https://youtu.be/vid2' }).where(eq(songs.id, yt.id)).run();
		expect(pickItems(db, imp).map((p) => [p.i, p.already])).toEqual([
			[0, true],
			[1, true],
			[2, false]
		]);
		// Another person's or an archived song is not "already added" here.
		const other = readyOf(U2_SALSA, [item(1, TRACK)]);
		expect(pickItems(db, other)[0].already).toBe(false);
		archiveSong(db, yt.id, T);
		expect(pickItems(db, imp)[1].already).toBe(false);
	});

	it('adds the picks as songs, once', () => {
		const imp = readyOf(T1_SALSA, [item(1), item(2), item(3, TRACK)]);
		const before = db.select().from(teamChanges).all().length;
		const r = addFromImport(
			db,
			T1_SALSA,
			imp.id,
			[
				{ i: 0, title: 'Uno', artist: 'A', style: 'son' },
				{ i: 1, title: 'Dos', artist: null, style: 'salsa' },
				{ i: 2, title: 'Tres', artist: 'C', style: 'salsa' }
			],
			T
		);
		if (!r.ok) throw new Error('expected ok');
		expect(new Set(r.songIds).size).toBe(3);
		const made = db.select().from(songs).all();
		expect(made).toHaveLength(3);
		expect(made[0]).toMatchObject({
			status: 'waiting_download',
			teamId: 1,
			userId: null,
			sharedAt: null,
			title: 'Uno',
			artist: 'A',
			style: 'son',
			sourceUrl: 'https://www.youtube.com/watch?v=vid1'
		});
		expect(made[2].sourceUrl).toBe(TRACK);
		const logged = db.select().from(teamChanges).all().slice(before);
		expect(logged.map((l) => l.verb)).toEqual(['add', 'add', 'add']);
		expect(getImport(db, imp.id)?.addedAt).toBe(T);
		expect(
			addFromImport(db, T1_SALSA, imp.id, [{ i: 0, title: 'x', artist: null, style: 'salsa' }], T)
		).toEqual({
			ok: false,
			reason: 'gone'
		});
		expect(db.select().from(songs).all()).toHaveLength(3);
	});

	it('refuses a dismissed list and an empty pick', () => {
		const imp = readyOf(U1_SALSA, [item(1)]);
		expect(addFromImport(db, U1_SALSA, imp.id, [], T)).toEqual({ ok: false, reason: 'empty' });
		dismissImport(db, imp.id, T);
		expect(
			addFromImport(db, U1_SALSA, imp.id, [{ i: 0, title: 'x', artist: null, style: 'salsa' }], T)
		).toEqual({ ok: false, reason: 'gone' });
		expect(db.select().from(songs).all()).toEqual([]);
	});
});
