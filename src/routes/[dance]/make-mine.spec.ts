/**
 * Edit makes it yours, through the item pages: a reader's load offers Make it
 * mine (an editor's does not), the `makeMine` action opens the copy, a lesson
 * that does not fit is refused 413 with Ask for more, and the old `copy`
 * actions are gone (ruling 12). The database is in memory and the files are
 * fakes: nothing touches `$DATA_DIR`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
vi.mock('$lib/server/clones/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/clones/files')>(
		'$lib/server/clones/files'
	);
	const { NO_FILES } =
		await vi.importActual<typeof import('$lib/server/test-walls')>('$lib/server/test-walls');
	return { ...actual, realCloneFiles: () => NO_FILES };
});
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => 1024 ** 4 };
});

import type { Cookies } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import {
	exercises,
	figures,
	lessons,
	routineStepOptions,
	routineSteps,
	users
} from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { createFigure } from '$lib/server/figures';
import { createRoutine } from '$lib/server/routines';
import { createCustomExercise } from '$lib/server/exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from '$lib/server/lessons';
import { cloneInto } from '$lib/server/clones/clone';
import { NO_FILES, T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import type { Space } from '$lib/server/scope';
import * as figurePage from './(moves)/figures/[id]/+page.server';
import * as routinePage from './(moves)/routines/[id]/+page.server';
import * as exercisePage from './(today)/exercises/[id]/+page.server';
import * as lessonPage from './lessons/[id]/+page.server';
import * as songPage from './songs/[id]/+page.server';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
let db: Db;

function jar(group?: number): Cookies {
	return {
		get: (n: string) => (n === groupCookie('salsa') && group ? String(group) : undefined),
		set: () => {},
		delete: () => {}
	} as unknown as Cookies;
}
const ev = (uid: string, id: number, group?: number) =>
	({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC' } },
		cookies: jar(group),
		url: new URL(`http://localhost/salsa/x/${id}`),
		request: new Request('http://localhost/x', { method: 'POST', body: new URLSearchParams() })
	}) as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = Record<string, any>;
/** An action's or load's answer, or what it threw (a redirect, an error). */
async function run(fn: unknown, e: unknown): Promise<Answer> {
	try {
		return (await (fn as (e: unknown) => unknown)(e)) as Answer;
	} catch (thrown) {
		return thrown as Answer;
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2', 'u3', 'u4'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
	setRole(db, 1, 'u3', 'editor');
});

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
function published(link: (id: number) => void) {
	const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 4', notes: null })
		.lesson.id;
	link(id);
	publishLesson(db, T1_SALSA, id, T);
	return id;
}

describe('the figure page', () => {
	function setup() {
		const F = figure(T1_SALSA, 'Setenta');
		const L = published((id) => linkFigure(db, id, F, 'u1'));
		const P = createRoutine(db, U2_SALSA, { name: 'Week 4 loop', notes: null }).routine.id;
		const step = db.insert(routineSteps).values({ routineId: P, position: 1 }).returning().get().id;
		db.insert(routineStepOptions).values({ stepId: step, figureId: F }).run();
		return { F, L, P, step };
	}

	it('offers a reader Make it mine, with what switches; an editor edits as before', async () => {
		const { F, P } = setup();
		const page = await run(figurePage.load, ev('u2', F));
		expect(page.makeMine).toEqual({
			kind: 'figure',
			label: 'Setenta · Básico',
			team: 'Salsa Tuesdays',
			repoint: {
				routines: [{ id: P, name: 'Week 4 loop' }],
				lessons: [],
				sections: 0,
				entries: 0,
				figures: []
			},
			practised: false,
			bytes: 0,
			existing: null
		});
		expect((await run(figurePage.load, ev('u3', F))).makeMine).toBeNull();
		expect((await run(figurePage.load, ev('u1', F))).makeMine).toBeNull();
	});

	it('Make it mine opens the copy, the routine on it', async () => {
		const { F, step } = setup();
		const res = await run(figurePage.actions.makeMine, ev('u2', F));
		const copy = db
			.select()
			.from(figures)
			.where(and(eq(figures.clonedFrom, F), eq(figures.userId, 'u2')))
			.get()!;
		expect(res).toMatchObject({ status: 303, location: `/salsa/figures/${copy.id}` });
		const option = db
			.select()
			.from(routineStepOptions)
			.where(eq(routineStepOptions.stepId, step))
			.get()!;
		expect(option.figureId).toBe(copy.id);
		// The copy's page is the person's own: Edit edits it.
		const page = await run(figurePage.load, ev('u2', copy.id));
		expect(page).toMatchObject({ canEdit: true, makeMine: null });
	});

	it('is the missing figure’s 404 for an outsider and for an editor', async () => {
		const { F } = setup();
		expect((await run(figurePage.actions.makeMine, ev('u4', F))).status).toBe(404);
		expect((await run(figurePage.actions.makeMine, ev('u3', F))).status).toBe(404);
		expect(db.select().from(figures).all()).toHaveLength(1);
	});
});

describe('the routine and drill pages', () => {
	it('a group routine: Make it mine opens the copy', async () => {
		const R = createRoutine(db, T1_SALSA, { name: 'Class routine', notes: null }).routine.id;
		published((id) => linkRoutine(db, id, R, 'u1'));
		expect((await run(routinePage.load, ev('u2', R))).makeMine).toMatchObject({
			kind: 'routine',
			label: 'Class routine'
		});
		expect((await run(routinePage.load, ev('u3', R))).makeMine).toBeNull();
		const res = await run(routinePage.actions.makeMine, ev('u2', R));
		expect(res.status).toBe(303);
		expect(res.location).toMatch(/^\/salsa\/routines\/\d+$/);
		expect(res.location).not.toBe(`/salsa/routines/${R}`);
	});

	it('a group drill: Make it mine opens the copy', async () => {
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		published((id) => linkExercise(db, id, D, 'u1'));
		expect((await run(exercisePage.load, ev('u2', D))).makeMine).toMatchObject({
			kind: 'drill',
			label: 'Shines'
		});
		expect((await run(exercisePage.load, ev('u3', D))).makeMine).toBeNull();
		const res = await run(exercisePage.actions.makeMine, ev('u2', D));
		const copy = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.clonedFrom, D), eq(exercises.userId, 'u2')))
			.get()!;
		expect(res).toMatchObject({ status: 303, location: `/salsa/exercises/${copy.id}` });
	});
});

describe('the lesson page', () => {
	const VIDEO = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
	function videoLesson() {
		return published((id) =>
			addLessonVideo(db, { lessonId: id, file: VIDEO, mime: 'video/mp4', sizeBytes: 5 }, 'u1')
		);
	}

	it('has no Make my own copy any more: Edit is Make it mine', async () => {
		const L = videoLesson();
		const page = await run(lessonPage.load, ev('u2', L));
		expect(page).not.toHaveProperty('copy');
		expect(page.makeMine).toMatchObject({ kind: 'lesson', label: 'Week 4', bytes: 5 });
		expect(lessonPage.actions).not.toHaveProperty('copy');
		expect(songPage.actions).not.toHaveProperty('copy');
	});

	it('Make it mine opens the copy', async () => {
		const L = videoLesson();
		const res = await run(lessonPage.actions.makeMine, ev('u2', L));
		const copy = db.select().from(lessons).where(eq(lessons.userId, 'u2')).get()!;
		expect(res).toMatchObject({ status: 303, location: `/salsa/lessons/${copy.id}` });
	});

	it('at the person’s limit: 413, Ask for more, nothing made', async () => {
		const L = videoLesson();
		db.update(users).set({ storageLimitBytes: 4 }).where(eq(users.id, 'u2')).run();
		const res = await run(lessonPage.actions.makeMine, ev('u2', L));
		expect(res).toMatchObject({
			status: 413,
			data: { action: 'makeMine', askForMore: true, message: expect.stringContaining('you use') }
		});
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toEqual([]);
	});

	it('in the group’s own group mode, link cards open the group’s rows, not the editor’s copies', async () => {
		const F = figure(T1_SALSA, 'Setenta');
		const L = published((id) => linkFigure(db, id, F, 'u1'));
		const made = await cloneInto(
			db,
			{ kind: 'figure', id: F, into: { userId: 'u3', dance: 'salsa' }, recordings: false },
			NO_FILES,
			T
		);
		const mineId = (made as { id: number }).id;
		const card = async (group?: number) =>
			(
				(await run(lessonPage.load, ev('u3', L, group))).figures as {
					id: number;
					mineId: number | null;
				}[]
			).find((f) => f.id === F)!.mineId;
		expect(await card()).toBe(mineId);
		expect(await card(1)).toBeNull();
	});
});
