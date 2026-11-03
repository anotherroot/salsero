/**
 * Leaving, being removed, a deleted group, through the routes: a former
 * member's added lesson stays, read-only, with its banner; the group page is
 * gone for them; a deleted group's lessons say when it goes; once purged,
 * Today's past days still name what was logged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sets, users } from '$lib/server/db/schema';
import { createTeam, deleteTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkExercise, publishLesson } from '$lib/server/lessons';
import { createCustomExercise } from '$lib/server/exercises';
import { addLesson, entryFor } from '$lib/server/entries';
import { purgeTeams } from '$lib/server/team-purge';
import { pastGroups } from '$lib/exercises/today';
import { T1_SALSA } from '$lib/server/test-walls';
import { actions as groupActions, load as groupLoad } from './[id]/+page.server';
import { actions as peopleActions } from './[id]/people/+page.server';
import { load as lessonLoad } from '../lessons/[id]/+page.server';
import { load as todayLoad } from '../+page.server';

let db: Db;
let lesson: number;
let draft: number;
let drill: number;

const DAY = 24 * 60 * 60 * 1000;
const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC' });
const ev = (uid: string, params: Record<string, string>, extra: Record<string, unknown> = {}) =>
	({
		params: { dance: 'salsa', ...params },
		locals: { user: user(uid) },
		url: new URL('http://localhost/salsa'),
		...extra
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
type LessonData = {
	canEdit: boolean;
	notice: { tone: string; text: string; action: string } | null;
};
const lessonPage = async (uid: string, id: number) =>
	run(() => lessonLoad(ev(uid, { id: String(id) })) as LessonData);

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
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tue 3 Nov', notes: null })
		.lesson.id;
	draft = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Draft', notes: null })
		.lesson.id;
	drill = createCustomExercise(db, T1_SALSA, { name: 'Drill', everyDays: 3, notes: null }).id;
	linkExercise(db, lesson, drill, 'u1');
	publishLesson(db, T1_SALSA, lesson, 3);
	for (const u of ['u2', 'u3']) {
		addLesson(db, u, lesson, { lesson: true, routineIds: [], drillIds: [drill], figureIds: [] }, 4);
	}
});

afterEach(() => vi.useRealTimers());

describe('a member reading a lesson of a live group', () => {
	it('has no banner', async () => {
		const page = await lessonPage('u2', lesson);
		expect(page.value).toMatchObject({ canEdit: false, notice: null });
	});
});

describe('after leaving', () => {
	beforeEach(async () => {
		const left = await run(() => groupActions.leave!(ev('u2', { id: '1' })));
		expect(left.status).toBe(303);
	});

	it('the added lesson loads read-only, with the banner and Make my own copy', async () => {
		const page = await lessonPage('u2', lesson);
		expect(page.value).toMatchObject({
			canEdit: false,
			notice: {
				tone: 'info',
				text: 'You left Salsa nadaljevalna · read-only',
				action: 'Make my own copy'
			}
		});
	});

	it('the group page is gone, and a lesson they had not added is too', async () => {
		expect((await run(() => groupLoad(ev('u2', { id: '1' })))).status).toBe(404);
		expect((await lessonPage('u2', draft)).status).toBe(404);
	});

	it('their entries for the added lesson stay on Today', () => {
		expect(entryFor(db, 'u2', { lessonId: lesson })!.archivedAt).toBeNull();
		expect(entryFor(db, 'u2', { drillId: drill })!.archivedAt).toBeNull();
	});
});

describe('after being removed', () => {
	it('is the same as leaving', async () => {
		const removed = await run(() =>
			peopleActions.remove!(ev('u1', { id: '1' }, { request: post({ userId: 'u3' }) }))
		);
		expect(removed.value).toMatchObject({ ok: true });
		expect((await lessonPage('u3', lesson)).value).toMatchObject({
			canEdit: false,
			notice: { text: 'You left Salsa nadaljevalna · read-only' }
		});
		expect((await run(() => groupLoad(ev('u3', { id: '1' })))).status).toBe(404);
		expect(entryFor(db, 'u3', { drillId: drill })!.archivedAt).toBeNull();
	});
});

describe('a deleted group', () => {
	// Tue 3 Nov, in the evening: it goes for good 30 days on, on 3 Dec.
	const T = Date.UTC(2026, 10, 3, 20);

	it('tells its members, and its owner, the day it goes', async () => {
		deleteTeam(db, 1, 'u1', T);
		for (const uid of ['u2', 'u1']) {
			expect((await lessonPage(uid, lesson)).value).toMatchObject({
				canEdit: false,
				notice: { tone: 'warning', text: 'Salsa nadaljevalna is being deleted on 3 Dec' }
			});
		}
	});

	it('once purged, Today’s past day still names what was logged', async () => {
		const entry = entryFor(db, 'u2', { lessonId: lesson })!.id;
		const drillEntry = entryFor(db, 'u2', { drillId: drill })!.id;
		db.insert(sets)
			.values({ exerciseId: entry, doneAt: Date.UTC(2026, 10, 3, 12) })
			.run();
		db.insert(sets)
			.values({ exerciseId: drillEntry, doneAt: Date.UTC(2026, 10, 3, 13) })
			.run();
		deleteTeam(db, 1, 'u1', T);
		expect(
			await purgeTeams(db, T + 31 * DAY, { lessonVideos: '/nowhere', recordings: '/nowhere' })
		).toBe(1);
		expect((await lessonPage('u2', lesson)).status).toBe(404);

		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(T + 31 * DAY);
		const today = (await todayLoad(
			ev('u2', {}, { url: new URL('http://localhost/salsa?day=2026-11-03') })
		)) as { daySets: Parameters<typeof pastGroups>[0] };
		expect(pastGroups(today.daySets).map((g) => g.name)).toEqual([
			'Tue 3 Nov · Salsa nadaljevalna (deleted)',
			'Drill · Salsa nadaljevalna (deleted)'
		]);
	});
});
