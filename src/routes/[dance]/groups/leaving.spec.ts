/**
 * Leaving, being removed, a deleted group, through the routes: a former
 * member keeps copies of what they had (Keep everything, until the leave
 * sheet offers the choice), theirs to edit, and the group's rows are gone for
 * them; someone who left before Keep still reads their added lesson, with its
 * banner, until the boot pass settles them; a deleted group's lessons say
 * when it goes; once purged, Today's past days name the kept copies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { and, eq, isNull } from 'drizzle-orm';
import { exercises, lessons, sets, teamMembers, users } from '$lib/server/db/schema';
import { crossRefs } from '$lib/server/integrity';
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

/** u's own lessons: what Keep gave them. */
const ownLessons = (uid: string) =>
	db
		.select()
		.from(lessons)
		.where(and(eq(lessons.userId, uid), isNull(lessons.teamId)))
		.all();

describe('after leaving', () => {
	beforeEach(async () => {
		const left = await run(() => groupActions.leave!(ev('u2', { id: '1' })));
		expect(left.status).toBe(303);
	});

	it('they keep a copy of the added lesson, theirs to edit; the group’s is gone for them', async () => {
		const [copy] = ownLessons('u2');
		expect(copy.title).toBe('Tue 3 Nov');
		expect((await lessonPage('u2', copy.id)).value).toMatchObject({ canEdit: true, notice: null });
		expect((await lessonPage('u2', lesson)).status).toBe(404);
	});

	it('the group page is gone, and a lesson they had not added is too', async () => {
		expect((await run(() => groupLoad(ev('u2', { id: '1' })))).status).toBe(404);
		expect((await lessonPage('u2', draft)).status).toBe(404);
	});

	it('their practice stays on Today, on the copies', () => {
		const live = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), isNull(exercises.archivedAt)))
			.all();
		expect(live.some((x) => x.lessonId === lesson)).toBe(false);
		expect(live.some((x) => x.lessonId === ownLessons('u2')[0].id)).toBe(true);
		expect(live.some((x) => x.drillId === drill)).toBe(false);
		expect(live.some((x) => x.source === 'custom' && x.name === 'Drill' && x.teamId === null)).toBe(
			true
		);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('after being removed', () => {
	it('is the same as leaving with everything kept', async () => {
		const removed = await run(() =>
			peopleActions.remove!(ev('u1', { id: '1' }, { request: post({ userId: 'u3' }) }))
		);
		expect(removed.value).toMatchObject({ ok: true });
		const [copy] = ownLessons('u3');
		expect((await lessonPage('u3', copy.id)).value).toMatchObject({ canEdit: true });
		expect((await lessonPage('u3', lesson)).status).toBe(404);
		expect((await run(() => groupLoad(ev('u3', { id: '1' })))).status).toBe(404);
		// Nothing of u3's practice is left live on the group's drill.
		const onGroup = entryFor(db, 'u3', { drillId: drill });
		expect(!onGroup || onGroup.archivedAt !== null).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('someone who left before Keep', () => {
	it('reads the added lesson read-only, with the banner and Make my own copy, until settled', async () => {
		// The row went, the add stayed: how leaving worked before Keep.
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, 'u2')))
			.run();
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

	it('once purged, Today’s past day names what was logged: the copies the purge kept', async () => {
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
			await purgeTeams(db, T + 31 * DAY, {
				lessonVideos: '/nowhere',
				recordings: '/nowhere',
				audio: '/nowhere'
			})
		).toBe(1);
		expect((await lessonPage('u2', lesson)).status).toBe(404);

		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(T + 31 * DAY);
		const today = (await todayLoad(
			ev('u2', {}, { url: new URL('http://localhost/salsa?day=2026-11-03') })
		)) as { daySets: Parameters<typeof pastGroups>[0] };
		expect(pastGroups(today.daySets).map((g) => g.name)).toEqual(['Review: Tue 3 Nov', 'Drill']);
	});
});
