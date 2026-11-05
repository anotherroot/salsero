/**
 * Twins for routines, lessons and songs (board C7, Task 33): each list shows a
 * set once with the "Twins" chip, each page has a tab per twin and Same as…,
 * the pickers fold, and group mode folds nothing. `getDb()` is mocked as in
 * `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { songs, users } from '$lib/server/db/schema';
import { createRoutine } from '$lib/server/routines';
import { createTeam, joinTeam } from '$lib/server/teams';
import {
	createLesson,
	linkRoutine,
	listLinkableRoutines,
	publishLesson
} from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import { createSongFromUpload } from '$lib/server/songs';
import { shareSong } from '$lib/server/song-share';
import { markTwins, twinCandidates } from '$lib/server/twins';
import { U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import { eq } from 'drizzle-orm';
import { load as layoutLoad } from './(moves)/+layout.server';

/** The Routines list is the layout's. */
const routinesLoad = (e: unknown) =>
	(layoutLoad as unknown as (e: unknown) => { lists: { routines: unknown } })({
		...(e as object),
		depends: () => {}
	}).lists.routines;
import {
	load as routineLoad,
	actions as routineActions
} from './(moves)/routines/[id]/+page.server';
import { load as lessonsLoad } from './lessons/+page.server';
import { load as lessonLoad } from './lessons/[id]/+page.server';
import { load as songsLoad } from './songs/+layout.server';
import { load as songLoad } from './songs/[id]/+page.server';

const T = 1_790_000_000_000;
const TUE = { teamId: 1, actorId: 'u1', dance: 'salsa' } as const;
const user = (id: string) => ({ id, email: `${id}@example.com`, timezone: 'Europe/Ljubljana' });
const cookies = (mode?: string) => ({
	get: (n: string) => (n === groupCookie('salsa') ? mode : undefined),
	set: () => {},
	delete: () => {}
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (fn: any, id: string, extra: Loose = {}, mode?: string): Loose =>
	fn({
		params: { dance: 'salsa', ...(extra.id ? { id: String(extra.id) } : {}) },
		url: new URL('http://localhost/'),
		locals: { user: user(id) },
		cookies: cookies(mode),
		depends: () => {},
		...(extra.request ? { request: extra.request } : {})
	});

let db: Db;
const r = {} as Record<'mine' | 'theirs' | 'other', number>;
const l = {} as Record<'mine' | 'theirs' | 'other', number>;
const s = {} as Record<'mine' | 'theirs' | 'other', number>;

const song = (space: Parameters<typeof createSongFromUpload>[1], title: string) => {
	const made = createSongFromUpload(db, space, {
		file: `${title}.mp3`,
		mime: 'audio/mpeg',
		title,
		style: 'salsa'
	});
	db.update(songs).set({ status: 'ready' }).where(eq(songs.id, made.id)).run();
	return made.id;
};

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);

	// The group: lesson "Week 6" teaching the routine "Warmup", and a class song.
	r.theirs = createRoutine(db, TUE, { name: 'Warmup', notes: null }).routine.id;
	r.mine = createRoutine(db, U2_SALSA, { name: 'Warmup flow', notes: null }).routine.id;
	r.other = createRoutine(db, U2_SALSA, { name: 'Closer', notes: null }).routine.id;
	l.theirs = createLesson(db, TUE, {
		lessonDay: '2026-11-03',
		title: 'Week 6',
		notes: null
	}).lesson.id;
	linkRoutine(db, l.theirs, r.theirs, 'u1');
	publishLesson(db, TUE, l.theirs, T);
	addLesson(
		db,
		'u2',
		l.theirs,
		{ lesson: true, routineIds: [r.theirs], drillIds: [], figureIds: [] },
		T
	);
	l.mine = createLesson(db, U2_SALSA, {
		lessonDay: '2026-11-01',
		title: 'Week 6 notes',
		notes: null
	}).lesson.id;
	l.other = createLesson(db, U2_SALSA, {
		lessonDay: '2026-10-20',
		title: 'Other',
		notes: null
	}).lesson.id;
	s.theirs = song(TUE, 'Quimbara (class)');
	shareSong(db, TUE, s.theirs, T);
	s.mine = song(U2_SALSA, 'Quimbara');
	s.other = song(U2_SALSA, 'Oye como va');

	expect(markTwins(db, U2_SALSA, 'routine', [r.mine, r.theirs])).toBe(true);
	expect(markTwins(db, U2_SALSA, 'lesson', [l.mine, l.theirs])).toBe(true);
	expect(markTwins(db, U2_SALSA, 'song', [s.mine, s.theirs])).toBe(true);
});

describe('Routines', () => {
	it('a twin set is one row, yours, with the chip; the group loses its section', async () => {
		const data = await run(routinesLoad, 'u2');
		expect(data.routines.map((x: Loose) => x.id).sort()).toEqual([r.mine, r.other].sort());
		expect(data.groups).toEqual([]);
		expect(data.twinned).toEqual([r.mine]);
	});

	it('group mode folds nothing', async () => {
		const data = await run(routinesLoad, 'u1', {}, '1');
		expect(data.twinned).toEqual([]);
	});

	it('the page has a tab per twin, Same as… offers the others, and Separate unmarks', async () => {
		const page = await run(routineLoad, 'u2', { id: r.mine });
		expect(page.sources.map((x: Loose) => [x.id, x.relation])).toEqual([
			[r.mine, 'self'],
			[r.theirs, 'twin']
		]);
		expect(page.sameAs.kind).toBe('routine');
		expect(page.sameAs.candidates.map((c: Loose) => [c.id, c.ticked]).sort()).toEqual(
			[
				[r.other, false],
				[r.theirs, true]
			].sort()
		);
		await run(routineActions.separate, 'u2', { id: r.mine });
		const after = await run(routineLoad, 'u2', { id: r.mine });
		expect(after.sources).toEqual([]);
		expect((await run(routinesLoad, 'u2')).groups).toHaveLength(1);
	});

	it('Same as… refuses an id it did not offer, changing nothing', async () => {
		// Another person's private routine, and the group's draft-only routine: neither is a candidate.
		const private1 = createRoutine(
			db,
			{ userId: 'u1', dance: 'salsa' },
			{ name: 'Ana’s', notes: null }
		).routine.id;
		const draft = createRoutine(db, TUE, { name: 'Unpublished', notes: null }).routine.id;
		for (const twin of [private1, draft]) {
			const form = new FormData();
			form.append('twin', String(twin));
			const res = await run(routineActions.sameAs, 'u2', {
				id: r.mine,
				request: new Request('http://localhost/', { method: 'POST', body: form })
			});
			expect(res.status).toBe(400);
			expect(res.data.action).toBe('sameAs');
		}
		const page = await run(routineLoad, 'u2', { id: r.mine });
		expect(page.sources.map((x: Loose) => [x.id, x.relation])).toEqual([
			[r.mine, 'self'],
			[r.theirs, 'twin']
		]);
	});

	it('the embed picker offers a set once, saying which is used', async () => {
		const page = await run(routineLoad, 'u2', { id: r.other });
		const rows = page.candidates.filter((c: Loose) => c.kind === 'routine');
		expect(rows.map((c: Loose) => c.id)).toEqual([r.mine]);
		expect(rows[0].twins.map((t: Loose) => [t.id, t.name])).toEqual([[r.theirs, 'Warmup']]);
	});

	it('a group workspace page shows no twins', async () => {
		const page = await run(routineLoad, 'u1', { id: r.theirs }, '1');
		expect(page.sameAs).toBeNull();
	});
});

describe('Lessons', () => {
	it('"Week 6 notes" and the group’s "Week 6" are one row: yours, with the chip', async () => {
		const data = await run(lessonsLoad, 'u2');
		const rows = data.lessons.filter((x: Loose) => [l.mine, l.theirs].includes(x.id));
		expect(rows.map((x: Loose) => [x.id, x.title, x.twinned])).toEqual([
			[l.mine, 'Week 6 notes', true]
		]);
		// Dated by the newest member's day.
		expect(rows[0].lessonDay).toBe('2026-11-03');
		expect(data.lessons.find((x: Loose) => x.id === l.other).twinned).toBeUndefined();
	});

	it('the page has a tab per twin and Same as… offers the other lessons', async () => {
		const page = await run(lessonLoad, 'u2', { id: l.mine });
		expect(page.sources.map((x: Loose) => x.relation)).toEqual(['self', 'twin']);
		expect(page.sameAs.candidates.map((c: Loose) => c.id).sort()).toEqual(
			[l.other, l.theirs].sort()
		);
	});

	it('the routine picker folds a set and marks it linked when any of it is', () => {
		const rows = listLinkableRoutines(db, l.mine);
		expect(rows.map((x) => x.id).sort()).toEqual([r.mine, r.other].sort());
		expect(rows.find((x) => x.id === r.mine)?.twins?.map((t) => t.id)).toEqual([r.theirs]);
	});
});

describe('Music', () => {
	it('a song set is one row, yours, with the chip; the class section loses its row', async () => {
		const data = await run(songsLoad, 'u2');
		expect(data.songs.map((x: Loose) => x.id).sort()).toEqual([s.mine, s.other].sort());
		expect(data.groups).toEqual([]);
		expect(data.twinned).toEqual([s.mine]);
	});

	it('group mode folds nothing', async () => {
		const data = await run(songsLoad, 'u1', {}, '1');
		expect(data.twinned).toEqual([]);
	});

	it('the page has a tab per twin and Same as… offers the others', async () => {
		const page = await run(songLoad, 'u2', { id: s.mine });
		expect(page.sources.map((x: Loose) => x.relation)).toEqual(['self', 'twin']);
		expect(page.sameAs.candidates.map((c: Loose) => c.id).sort()).toEqual(
			[s.other, s.theirs].sort()
		);
	});
});

describe('twinCandidates', () => {
	it('leaves out the page’s own row and any group row your copy shadows', () => {
		const ids = twinCandidates(db, U2_SALSA, 'routine', r.other).map((c) => c.id);
		expect(ids.sort()).toEqual([r.mine, r.theirs].sort());
		expect(
			twinCandidates(db, U2_SALSA, 'routine', r.other).find((c) => c.id === r.theirs)?.place
		).toEqual({
			kind: 'team',
			teamId: 1,
			name: 'Salsa Tuesdays'
		});
	});
});
