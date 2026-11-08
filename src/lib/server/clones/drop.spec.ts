/**
 * Drop my copy (board C5): u2's own copy of a class's thing goes, and u2 is
 * back on a version they read: their routines, links and practice move onto
 * it (practice only when it can follow, R8: a group's figure, routine or
 * drill needs a lesson they added that holds it), and the copy is archived.
 * Salsa Tuesdays (T1, u1's) and Rueda club (T2, u3's); u2 is in both. Files
 * are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonAdds,
	lessons,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	songs,
	teamMembers,
	users
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { createFigure, restoreVariation, updateVariation } from '../figures';
import { createRoutine } from '../routines';
import { createLesson, linkExercise, linkFigure, linkRoutine, publishLesson } from '../lessons';
import { createCustomExercise } from '../exercises';
import { addLesson } from '../entries';
import { createSongFromUpload, storeAnalysis } from '../songs';
import { shareSong } from '../song-share';
import { crossRefs } from '../integrity';
import type { Space, TeamSpace } from '../scope';
import { NO_FILES, T1_SALSA, T2_SALSA, U2_SALSA } from '../test-walls';
import type { CloneKind } from '$lib/types';
import { cloneInto } from './clone';
import { makeMine } from './edit';
import { dropCopy, dropOptions } from './drop';
import { runInLocale } from '../i18n-request';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const LATER = NOW + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
const ROOMY = 1024 ** 4;
const T2: TeamSpace = T2_SALSA;

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u3', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u2', 2, T);
	// Ana edits Rueda club too: she copies Salsa Tuesdays' Setenta there.
	joinTeam(db, 'u1', 2, T);
	setRole(db, 2, 'u1', 'editor', T);
});

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
function published(space: TeamSpace, title: string, link: (id: number) => void = () => {}) {
	const id = createLesson(db, space, { lessonDay: '2026-11-01', title, notes: null }).lesson.id;
	link(id);
	expect(publishLesson(db, space, id, T)).toBe(true);
	return id;
}
function slot(routineId: number, position: number, figureIds: number[]) {
	const step = db.insert(routineSteps).values({ routineId, position }).returning().get().id;
	for (const figureId of figureIds)
		db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
	return step;
}
const optionsOf = (stepId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all()
		.map((r) => r.f);
const figureRow = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const exerciseRow = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;
const setsOf = (exerciseId: number) =>
	db.select().from(sets).where(eq(sets.exerciseId, exerciseId)).all();
/** u2's live exercises: what Today shows (a figure's practice, with `figures`). */
const liveOfU2 = (only?: 'figures') =>
	db
		.select()
		.from(exercises)
		.where(
			and(
				eq(exercises.userId, 'u2'),
				isNull(exercises.archivedAt),
				only ? isNotNull(exercises.figureId) : undefined
			)
		)
		.all();
const addsOf = (userId: string) =>
	db
		.select({ id: lessonAdds.lessonId })
		.from(lessonAdds)
		.where(eq(lessonAdds.userId, userId))
		.all()
		.map((r) => r.id);

async function mine(kind: CloneKind, id: number, now = NOW) {
	const res = await makeMine(db, U2_SALSA, kind, id, NO_FILES, now, ROOMY);
	if (!res.ok) throw new Error(`make it mine refused: ${res.reason}`);
	return res;
}

/**
 * T1's Setenta · Básico (F1) in Week 4, which u2 added practising it (one
 * set). u2's Week 4 loop has a slot holding it. u2 made it theirs (C) and
 * rewrote its notes.
 */
async function copied() {
	const F1 = figure(T1_SALSA, 'Setenta');
	const L4 = published(T1_SALSA, 'Week 4', (id) => linkFigure(db, id, F1, 'u1'));
	expect(addLesson(db, 'u2', L4, { ...NONE, figureIds: [F1] }, T)).toBe(true);
	const entry = db
		.select()
		.from(exercises)
		.where(and(eq(exercises.userId, 'u2'), eq(exercises.figureId, F1)))
		.get()!;
	db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();
	const P = createRoutine(db, U2_SALSA, { name: 'Week 4 loop', notes: null }).routine.id;
	const step = slot(P, 1, [F1]);
	const C = (await mine('figure', F1)).id;
	updateVariation(db, C, { name: 'Básico', ...shape, notes: 'Hips first' });
	expect(optionsOf(step)).toEqual([C]);
	expect(exerciseRow(entry.id).figureId).toBe(C);
	return { F1, L4, P, step, entry, C };
}

/** Rueda club's copy of Setenta · Básico (F2), in its published Week 2, which u2 did not add. */
async function inRuedaClub(F1: number) {
	const r = await cloneInto(
		db,
		{ kind: 'figure', id: F1, into: T2, recordings: false },
		NO_FILES,
		T
	);
	if (!r.ok) throw new Error(r.reason);
	const L2 = published(T2, 'Week 2', (id) => linkFigure(db, id, r.id, 'u1'));
	return { F2: r.id, L2 };
}

describe('dropOptions', () => {
	it('a copy with no practice to carry offers no lesson to add', async () => {
		const F1 = figure(T1_SALSA, 'Setenta');
		published(T1_SALSA, 'Week 4', (id) => linkFigure(db, id, F1, 'u1'));
		// u2 reads Week 4 without adding it, and never practised the figure.
		const C = (await mine('figure', F1)).id;
		const o = dropOptions(db, U2_SALSA, 'figure', C)!;
		expect(o.choices).toMatchObject([{ id: F1, practiceFollows: true, addLesson: null }]);
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toEqual({ ok: true, toId: F1 });
		expect(addsOf('u2')).toEqual([]);
	});

	it('a drill copy always has practice: it is its own exercise', async () => {
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const L = published(T1_SALSA, 'Week 6', (id) => linkExercise(db, id, D, 'u1'));
		const copy = (await mine('drill', D)).id;
		const o = dropOptions(db, U2_SALSA, 'drill', copy)!;
		expect(o.choices).toMatchObject([
			{ id: D, practiceFollows: false, addLesson: { id: L, title: 'Week 6' } }
		]);
	});

	it('one choice: the class’s version, and what only yours has', async () => {
		const { F1, C } = await copied();
		const o = dropOptions(db, U2_SALSA, 'figure', C)!;
		expect(o.choices).toHaveLength(1);
		expect(o.choices[0]).toMatchObject({
			id: F1,
			place: { kind: 'team', teamId: 1, name: 'Salsa Tuesdays' },
			label: 'Setenta · Básico',
			access: 'read',
			clonedFrom: true,
			practiceFollows: true,
			addLesson: null
		});
		expect(o.preselected).toBe(F1);
		expect(o.onlyInMine).toEqual(['Notes']);
		expect(o.sendable).toEqual([]);
	});

	it('several: the one copied from preselected; one no added lesson holds offers its lesson', async () => {
		const { F1, C } = await copied();
		const { F2, L2 } = await inRuedaClub(F1);
		const o = dropOptions(db, U2_SALSA, 'figure', C)!;
		expect(o.choices.map((c) => c.id)).toEqual([F1, F2]);
		expect(o.preselected).toBe(F1);
		expect(o.choices[1]).toMatchObject({
			id: F2,
			place: { kind: 'team', teamId: 2, name: 'Rueda club' },
			clonedFrom: false,
			practiceFollows: false,
			addLesson: { id: L2, title: 'Week 2' },
			onlyInMine: ['Notes']
		});
	});

	it('the one copied from, unreadable, leaves the first by group name preselected', async () => {
		const { F1, L4, C } = await copied();
		const { F2 } = await inRuedaClub(F1);
		// T1's Week 4 is unpublished: u2 reads F1 no more.
		db.update(lessons).set({ publishedAt: null }).where(eq(lessons.id, L4)).run();
		const o = dropOptions(db, U2_SALSA, 'figure', C)!;
		expect(o.choices.map((c) => c.id)).toEqual([F2]);
		expect(o.preselected).toBe(F2);
	});

	it('a choice the person edits is sendable', async () => {
		const { F1, C } = await copied();
		setRole(db, 1, 'u2', 'editor', T);
		const o = dropOptions(db, U2_SALSA, 'figure', C)!;
		expect(o.sendable).toEqual([F1]);
		expect(o.choices[0].access).toBe('edit');
	});

	it('null when no other version is readable (after leaving), and for a row not yours', async () => {
		const { F1, C } = await copied();
		expect(dropOptions(db, U2_SALSA, 'figure', F1)).toBeNull();
		expect(dropOptions(db, { userId: 'u1', dance: 'salsa' }, 'figure', C)).toBeNull();
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, 'u2')))
			.run();
		expect(dropOptions(db, U2_SALSA, 'figure', C)).toBeNull();
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toMatchObject({ ok: false });
		expect(figureRow(C).archivedAt).toBeNull();
	});

	it('null for a copy already archived', async () => {
		const { F1, C } = await copied();
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toEqual({ ok: true, toId: F1 });
		expect(dropOptions(db, U2_SALSA, 'figure', C)).toBeNull();
	});
});

describe('dropCopy: a figure', () => {
	it('one choice: the routine and the practice go back to the class’s; the copy is archived', async () => {
		const { F1, step, entry, C } = await copied();
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toEqual({ ok: true, toId: F1 });
		expect(optionsOf(step)).toEqual([F1]);
		expect(exerciseRow(entry.id)).toMatchObject({ figureId: F1, archivedAt: null });
		expect(setsOf(entry.id)).toHaveLength(1);
		expect(figureRow(C).archivedAt).toBe(LATER);
		expect(liveOfU2('figures').map((e) => e.id)).toEqual([entry.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('to a version no added lesson holds: the routine moves, practice stays with the archived copy', async () => {
		const { F1, step, entry, C } = await copied();
		const { F2, L2 } = await inRuedaClub(F1);
		expect(dropCopy(db, U2_SALSA, 'figure', C, F2, {}, LATER)).toEqual({ ok: true, toId: F2 });
		expect(optionsOf(step)).toEqual([F2]);
		expect(exerciseRow(entry.id)).toMatchObject({ figureId: C, archivedAt: LATER });
		expect(setsOf(entry.id)).toHaveLength(1);
		expect(figureRow(C).archivedAt).toBe(LATER);
		expect(addsOf('u2')).not.toContain(L2);
		expect(crossRefs(db)).toEqual([]);
	});

	it('with Add Week 2 too: the lesson is added and the practice follows', async () => {
		const { F1, entry, C } = await copied();
		const { F2, L2 } = await inRuedaClub(F1);
		expect(dropCopy(db, U2_SALSA, 'figure', C, F2, { addLessonId: L2 }, LATER)).toEqual({
			ok: true,
			toId: F2
		});
		expect(addsOf('u2')).toContain(L2);
		expect(exerciseRow(entry.id)).toMatchObject({ figureId: F2, archivedAt: null });
		expect(setsOf(entry.id)).toHaveLength(1);
		expect(liveOfU2('figures').map((e) => e.id)).toEqual([entry.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a lesson that is not the choice’s, and a version not offered, changing nothing', async () => {
		const { F1, L4, C } = await copied();
		const { F2 } = await inRuedaClub(F1);
		expect(dropCopy(db, U2_SALSA, 'figure', C, F2, { addLessonId: L4 }, LATER)).toMatchObject({
			ok: false
		});
		expect(dropCopy(db, U2_SALSA, 'figure', C, C, {}, LATER)).toMatchObject({ ok: false });
		// Composed in the request: the reader's language.
		expect(runInLocale('sl', () => dropCopy(db, U2_SALSA, 'figure', C, C, {}, LATER))).toEqual({
			ok: false,
			message: 'Te kopije ni več mogoče uporabiti. Naložite znova in izberite še enkrat.'
		});
		expect(figureRow(C).archivedAt).toBeNull();
	});

	it('Edit after Drop brings the same copy back, practice and all (Review Focus 4)', async () => {
		const { F1, step, entry, C } = await copied();
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toMatchObject({ ok: true });
		const again = await makeMine(db, U2_SALSA, 'figure', F1, NO_FILES, LATER + 1000, ROOMY);
		expect(again).toMatchObject({ ok: true, id: C, archived: true });
		expect(figureRow(C)).toMatchObject({ archivedAt: null, notes: 'Hips first' });
		expect(optionsOf(step)).toEqual([C]);
		expect(exerciseRow(entry.id)).toMatchObject({ figureId: C, archivedAt: null });
		expect(liveOfU2('figures').map((e) => e.id)).toEqual([entry.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a merged practice is not brought back by a restore of the copy (no double Today)', async () => {
		const { F1, entry, C } = await copied();
		// An old entry of u2's on F1, removed: the copy's practice merges into it.
		const { id: _id, ...fields } = exerciseRow(entry.id);
		void _id;
		const old = db
			.insert(exercises)
			.values({ ...fields, figureId: F1, archivedAt: T })
			.returning()
			.get().id;
		expect(dropCopy(db, U2_SALSA, 'figure', C, F1, {}, LATER)).toMatchObject({ ok: true });
		expect(exerciseRow(old)).toMatchObject({ figureId: F1, archivedAt: null });
		expect(setsOf(old)).toHaveLength(1);
		expect(exerciseRow(entry.id)).toMatchObject({ figureId: C, archivedAt: LATER - 1 });
		expect(restoreVariation(db, U2_SALSA, C, LATER + 1000)).toMatchObject({ ok: true });
		expect(liveOfU2('figures').map((e) => e.id)).toEqual([old]);
	});
});

describe('dropCopy: the other kinds', () => {
	it('a lesson: back on the group’s lesson, which is added', async () => {
		const L = published(T1_SALSA, 'Week 4');
		const mineL = (await mine('lesson', L)).id;
		expect(addsOf('u2')).not.toContain(L);
		const o = dropOptions(db, U2_SALSA, 'lesson', mineL)!;
		expect(o.choices).toMatchObject([{ id: L, practiceFollows: true, addLesson: null }]);
		expect(dropCopy(db, U2_SALSA, 'lesson', mineL, L, {}, LATER)).toEqual({ ok: true, toId: L });
		expect(addsOf('u2')).toContain(L);
		expect(db.select().from(lessons).where(eq(lessons.id, mineL)).get()!.archivedAt).toBe(LATER);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a routine: the person’s practice follows when an added lesson holds it', async () => {
		const R = createRoutine(db, T1_SALSA, { name: 'Shines loop', notes: null }).routine.id;
		const L = published(T1_SALSA, 'Week 5', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, routineIds: [R] }, T)).toBe(true);
		const copy = (await mine('routine', R)).id;
		const practice = (routineId: number) => liveOfU2().filter((e) => e.routineId === routineId);
		expect(practice(copy)).toHaveLength(1);
		expect(dropCopy(db, U2_SALSA, 'routine', copy, R, {}, LATER)).toMatchObject({ ok: true });
		expect(practice(copy)).toEqual([]);
		expect(practice(R)).toHaveLength(1);
		expect(db.select().from(routines).where(eq(routines.id, copy)).get()!.archivedAt).toBe(LATER);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a drill: its sets go onto the person’s entry for the group’s', async () => {
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const L = published(T1_SALSA, 'Week 6', (id) => linkExercise(db, id, D, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, drillIds: [D] }, T)).toBe(true);
		const copy = (await mine('drill', D)).id;
		db.insert(sets).values({ exerciseId: copy, doneAt: NOW }).run();
		expect(dropCopy(db, U2_SALSA, 'drill', copy, D, {}, LATER)).toMatchObject({ ok: true });
		expect(exerciseRow(copy).archivedAt).toBe(LATER);
		const live = liveOfU2();
		expect(live).toHaveLength(1);
		expect(live[0]).toMatchObject({ drillId: D, source: 'added' });
		expect(setsOf(live[0].id).length).toBeGreaterThanOrEqual(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a song: picks go back to the class’s song; the copy is archived (no restore: Edit says so)', async () => {
		const S = createSongFromUpload(
			db,
			T1_SALSA,
			{
				file: '00000000-0000-4000-8000-0000000000c1.mp3',
				mime: 'audio/mpeg',
				title: 'Chan Chan',
				style: 'salsa',
				sizeBytes: 1000
			},
			T
		).id;
		storeAnalysis(db, S, { beats: [0.5, 1, 1.5, 2], downbeats: [0.5], durationS: 90 });
		expect(shareSong(db, T1_SALSA, S, T)).toBe(true);
		const pick = createCustomExercise(db, U2_SALSA, {
			name: 'Basics',
			everyDays: 1,
			notes: null
		}).id;
		db.update(exercises).set({ songId: S }).where(eq(exercises.id, pick)).run();
		const copy = (await mine('song', S)).id;
		expect(exerciseRow(pick).songId).toBe(copy);
		expect(dropCopy(db, U2_SALSA, 'song', copy, S, {}, LATER)).toMatchObject({ ok: true });
		expect(exerciseRow(pick).songId).toBe(S);
		expect(db.select().from(songs).where(eq(songs.id, copy)).get()!.archivedAt).toBe(LATER);
		expect(await makeMine(db, U2_SALSA, 'song', S, NO_FILES, LATER + 1, ROOMY)).toMatchObject({
			ok: false,
			reason: 'archived'
		});
	});
});
