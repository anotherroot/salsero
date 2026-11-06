/** The History page: its editors' and owner's only, one group's things only, and Restore. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { createLesson, getLessonRow, updateLesson } from '$lib/server/lessons';
import { createCustomExercise } from '$lib/server/exercises';
import { history } from '$lib/server/changes';
import { createPosition, updatePosition } from '$lib/server/positions';
import type { PositionInput } from '$lib/types';
import { createSongFromUpload, storeAnalysis } from '$lib/server/songs';
import { deleteGroupSong, shareSong } from '$lib/server/song-share';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import { actions, load } from './[id]/history/[kind]/[rootId]/+page.server';
import { load as lessonLoad } from '../lessons/[id]/+page.server';

let db: Db;
let lesson: number;

const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC', dance: 'salsa' });
const ev = (uid: string, kind = 'lesson', rootId = lesson, request?: Request) =>
	({
		params: { dance: 'salsa', id: '1', kind, rootId: String(rootId) },
		locals: { user: user(uid) },
		request
	}) as never;
const post = (fields: Record<string, string>) =>
	new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		return { status: (e as { status?: number }).status };
	}
}
type Loaded = { changes: { id: number; line: string; restorable: boolean }[] };

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok || made.teamId !== 1) throw new Error('setup');
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	joinTeam(db, 'u3', 1, 3);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: 'old' }).lesson
		.id;
	updateLesson(
		db,
		lesson,
		{ lessonDay: '2026-11-01', title: 'C', notes: 'new' },
		'u2',
		Date.now() + 1_000
	);
});

describe('History', () => {
	it('shows an editor the lines, newest first, with Restore on text', async () => {
		const { value } = await run(() => load(ev('u2')));
		const data = value as Loaded;
		expect(data.changes.map((c) => c.line)).toEqual([
			'Luka · changed the notes',
			'Ana · made the lesson'
		]);
		expect(data.changes.map((c) => c.restorable)).toEqual([true, false]);
	});

	it('is a 404 for a member, an outsider, another group’s thing and a person’s own', async () => {
		expect(await run(() => load(ev('u3')))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u9')))).toEqual({ status: 404 });
		const own = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Mine', notes: null })
			.lesson.id;
		expect(await run(() => load(ev('u1', 'lesson', own)))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u1', 'team', 1)))).toEqual({ status: 404 });
		const drill = createCustomExercise(db, T1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		expect((await run(() => load(ev('u1', 'drill', drill)))).value).toBeTruthy();
		// The drill's id under another kind is not the drill.
		expect(await run(() => load(ev('u1', 'routine', drill)))).toEqual({ status: 404 });
	});

	it('restores, and refuses with who when the text changed since', async () => {
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		updateLesson(
			db,
			lesson,
			{ lessonDay: '2026-11-01', title: 'C', notes: 'newer' },
			'u1',
			Date.now() + 2_000
		);
		const refused = await run(() =>
			actions.restore!(ev('u2', 'lesson', lesson, post({ changeId: String(change.id) })))
		);
		expect(refused.value).toMatchObject({ status: 409 });
		expect(getLessonRow(db, lesson)!.notes).toBe('newer');

		const latest = history(db, 1, 'lesson', lesson)[0];
		const done = await run(() =>
			actions.restore!(ev('u2', 'lesson', lesson, post({ changeId: String(latest.id) })))
		);
		expect(done.value).toMatchObject({ ok: true });
		expect(getLessonRow(db, lesson)!.notes).toBe('new');
	});

	it('refuses a member’s Restore as the stranger’s 404', async () => {
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		const res = await run(() =>
			actions.restore!(ev('u3', 'lesson', lesson, post({ changeId: String(change.id) })))
		);
		expect(res).toEqual({ status: 404 });
		expect(getLessonRow(db, lesson)!.notes).toBe('new');
	});
});

describe('Edited by', () => {
	const page = (uid: string) =>
		lessonLoad({
			params: { dance: 'salsa', id: String(lesson) },
			locals: { user: user(uid) },
			url: new URL(`http://localhost/salsa/lessons/${lesson}`)
		} as never) as unknown as { edited: string | null; historyHref: string | null };

	it('names the last change to the lesson, and links History for its editors only', () => {
		updateLesson(db, lesson, { lessonDay: '2026-11-01', title: 'C', notes: 'x' }, 'u2', Date.now());
		expect(page('u1').edited).toBe('Edited by Luka · just now');
		expect(page('u1').historyHref).toBe(`/salsa/groups/1/history/lesson/${lesson}`);
	});

	it('is nothing on a person’s own lesson', () => {
		lesson = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Mine', notes: null })
			.lesson.id;
		expect(page('u1')).toMatchObject({ edited: null, historyHref: null });
	});
});

describe('a class song’s History', () => {
	type SongHistory = {
		root: { kind: string; title: string; href: string };
		changes: { line: string; inDeleted: boolean }[];
	};

	it('lists its changes for an editor, and a delete is on Recently deleted', async () => {
		const song = createSongFromUpload(
			db,
			T1_SALSA,
			{
				file: '00000000-0000-4000-8000-0000000000d1.mp3',
				mime: 'audio/mpeg',
				title: 'Chan Chan',
				style: 'salsa'
			},
			Date.now()
		).id;
		storeAnalysis(db, song, { beats: [0.5, 1, 1.5], downbeats: [0.5], durationS: 90 });
		shareSong(db, T1_SALSA, song, Date.now() + 1_000);
		deleteGroupSong(db, T1_SALSA, song, Date.now() + 2_000);
		const { value } = await run(() => load(ev('u2', 'song', song)));
		const data = value as SongHistory;
		expect(data.root).toMatchObject({
			kind: 'song',
			title: 'Chan Chan',
			href: `/salsa/songs/${song}`
		});
		expect(data.changes.map((c) => c.inDeleted)).toEqual([true, false, false]);
		expect(await run(() => load(ev('u3', 'song', song)))).toEqual({ status: 404 });
	});
});

describe('History of a position', () => {
	const input = (name: string, notes: string | null = null): PositionInput => ({
		name,
		styleTag: 'salsa',
		hold: { hands: 'two', crossed: true, facing: 'face', frame: 'closed' },
		notes,
		pictureSpotId: null
	});

	it('serves a group position to an editor, names it, and 404s for others', async () => {
		const id = (createPosition(db, T1_SALSA, input('Cerrada'), 1) as { id: number }).id;
		updatePosition(db, id, input('Cerrada', 'closed hold'), { actorId: 'u2', now: Date.now() + 5 });
		const { value } = await run(() => load(ev('u2', 'position', id)));
		const data = value as Loaded & { root: { title: string; href: string } };
		expect(data.root).toMatchObject({ title: 'Cerrada', href: `/salsa/positions/${id}` });
		expect(data.changes.map((c) => c.line)).toEqual([
			'Luka · changed the notes',
			'Ana · made the position'
		]);
		expect(await run(() => load(ev('u3', 'position', id)))).toEqual({ status: 404 });
		const own = (createPosition(db, U1_SALSA, input('Mine'), 1) as { id: number }).id;
		expect(await run(() => load(ev('u1', 'position', own)))).toEqual({ status: 404 });
		createTeam(db, 'u3', 'salsa', 'Other', 2);
		const theirs = (
			createPosition(db, { dance: 'salsa', teamId: 2, actorId: 'u3' }, input('Theirs'), 1) as {
				id: number;
			}
		).id;
		expect(await run(() => load(ev('u1', 'position', theirs)))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u1', 'routine', id)))).toEqual({ status: 404 });
	});
});
