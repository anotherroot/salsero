import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonFigures,
	lessonVideos,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	spotLinks,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { archiveVariation, createFigure, restoreVariation } from '../figures';
import {
	archiveRoutine,
	createRoutine,
	deleteSlots,
	duplicateRoutine,
	restoreRoutine,
	removeOption
} from '../routines';
import {
	archiveLesson,
	createLesson,
	getLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson,
	unlinkFigure
} from '../lessons';
import { archiveExercise, restoreDrill } from '../exercises';
import { unlinkSpot } from '../spot-links';
import { addLesson, reconcileEntries } from '../entries';
import { crossRefs } from '../integrity';
import type { Space } from '../scope';
import { T1_SALSA, U2_SALSA } from '../test-walls';
import { cloneTx } from './clone';
import { geneOf } from './genes';
import { rescueUsed } from './rescue';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

let db: Db;

beforeEach(fresh);

function fresh() {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
}

const figure = (space: Space, move: string, name = 'Basic') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const routine = (space: Space, name: string) =>
	createRoutine(db, space, { name, notes: null }).routine.id;
const lesson = (space: Space, title: string) =>
	createLesson(db, space, { lessonDay: '2026-11-01', title, notes: null }).lesson.id;
const drill = (owner: { userId: string } | { teamId: number }, name: string) =>
	db
		.insert(exercises)
		.values({ name, dance: 'salsa', source: 'custom', ...owner })
		.returning()
		.get().id;
/** A published group lesson. */
function published(title: string, link: (id: number) => void = () => {}) {
	const id = lesson(T1_SALSA, title);
	link(id);
	expect(publishLesson(db, T1_SALSA, id, T)).toBe(true);
	return id;
}
/** A slot of figure options at `position`; its step id. */
function slot(routineId: number, position: number, figureIds: number[]) {
	const step = db.insert(routineSteps).values({ routineId, position }).returning().get().id;
	for (const figureId of figureIds)
		db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
	return step;
}
const embed = (routineId: number, position: number, childRoutineId: number) =>
	db.insert(routineSteps).values({ routineId, position, childRoutineId }).returning().get().id;
const optionsOf = (stepId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all()
		.map((r) => r.f);
const childOf = (stepId: number) =>
	db.select().from(routineSteps).where(eq(routineSteps.id, stepId)).get()!.childRoutineId!;
const figureRow = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const routineRow = (id: number) => db.select().from(routines).where(eq(routines.id, id)).get()!;
const exerciseRow = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;
const u2Figures = () =>
	db
		.select({ id: figures.id })
		.from(figures)
		.where(and(eq(figures.userId, 'u2'), isNull(figures.teamId)))
		.all().length;

/** A section (0–1 s) on a new recording of the figure, or a new video of the lesson. */
function section(parent: { figureId: number } | { lessonId: number }) {
	const n = Math.random().toString(36).slice(2);
	const owner =
		'lessonId' in parent
			? {
					lessonVideoId: db
						.insert(lessonVideos)
						.values({
							lessonId: parent.lessonId,
							file: `${n}.mp4`,
							mime: 'video/mp4',
							sizeBytes: 1
						})
						.returning()
						.get().id
				}
			: {
					recordingId: db
						.insert(recordings)
						.values({
							figureId: parent.figureId,
							file: `${n}.mp4`,
							mime: 'video/mp4',
							kind: 'video',
							sizeBytes: 1
						})
						.returning()
						.get().id
				};
	return db
		.insert(videoSpots)
		.values({ ...owner, startMs: 0, endMs: 1000 })
		.returning()
		.get().id;
}
const link = (spotId: number, target: { figureId: number } | { exerciseId: number }) =>
	db
		.insert(spotLinks)
		.values({ spotId, ...target })
		.returning()
		.get().id;
const linkOf = (id: number) => db.select().from(spotLinks).where(eq(spotLinks.id, id)).get()!;

/** u2 is the person whose own rows use the group's; this is the copy u2 got of `sourceId`. */
function copyOf(kind: 'figure' | 'routine' | 'drill', id: number) {
	const t = kind === 'figure' ? figures : kind === 'routine' ? routines : exercises;
	const row = db
		.select()
		.from(t)
		.where(and(eq(t.clonedFrom, id), eq(t.userId, 'u2')))
		.get();
	expect(row, `u2's copy of ${kind} ${id}`).toBeDefined();
	return row!;
}

/** Group figure F in published lesson L; u2's routine P has a slot holding F. */
function figureInRoutine() {
	const F = figure(T1_SALSA, 'Enchufla');
	const L = published('Week 1', (id) => linkFigure(db, id, F, 'u1'));
	const P = routine(U2_SALSA, 'My routine');
	const step = slot(P, 1, [F]);
	expect(crossRefs(db)).toEqual([]);
	return { F, L, P, step };
}

describe('rescueUsed: the shrink paths', () => {
	it('archiveVariation: u2’s routine and practice move to u2’s copy, with the sets', () => {
		const { F, L, step } = figureInRoutine();
		expect(addLesson(db, 'u2', L, { ...NONE, figureIds: [F] }, T)).toBe(true);
		const entry = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.figureId, F)))
			.get()!;
		db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();

		expect(archiveVariation(db, F, NOW, 'u1')).not.toBeNull();

		const copy = copyOf('figure', F);
		expect(copy.archivedAt).toBeNull();
		expect(copy.geneId).toBe(geneOf(db, 'figure', F));
		expect(optionsOf(step)).toEqual([copy.id]);
		// The entry is on the copy, live, with its sets: practice continues.
		const moved = exerciseRow(entry.id);
		expect(moved.figureId).toBe(copy.id);
		expect(moved.archivedAt).toBeNull();
		expect(db.select().from(sets).where(eq(sets.exerciseId, entry.id)).all()).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('restoring the figure afterwards does not undo u2’s copy', () => {
		const { F, L, step } = figureInRoutine();
		addLesson(db, 'u2', L, { ...NONE, figureIds: [F] }, T);
		archiveVariation(db, F, NOW, 'u1');
		const copy = copyOf('figure', F);
		expect(restoreVariation(db, T1_SALSA, F, NOW + 1)).toEqual({ ok: true });
		// The copy is u2's now; the group's figure comes back as the group's.
		expect(optionsOf(step)).toEqual([copy.id]);
		expect(figureRow(copy.id).archivedAt).toBeNull();
		const entry = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.figureId, copy.id)))
			.get();
		expect(entry?.archivedAt).toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});

	it('unlinkFigure from the only lesson that reached it', () => {
		const { F, L, step } = figureInRoutine();
		expect(unlinkFigure(db, L, F, false, NOW, 'u1')).toBe(true);
		expect(optionsOf(step)).toEqual([copyOf('figure', F).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('archiveLesson of that lesson', () => {
		const { F, L, step } = figureInRoutine();
		expect(archiveLesson(db, L, NOW, 'u1')).toBe(true);
		expect(optionsOf(step)).toEqual([copyOf('figure', F).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('archiveRoutine of a group routine u2’s routine embeds: the copy comes with its figures', () => {
		const G = figure(T1_SALSA, 'Setenta');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [G]);
		published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const Q = routine(U2_SALSA, 'Embeds');
		const step = embed(Q, 1, R);
		expect(crossRefs(db)).toEqual([]);

		expect(archiveRoutine(db, R, NOW, 'u1')).toBe(true);

		const copy = copyOf('routine', R);
		expect(childOf(step)).toBe(copy.id);
		// The copy's own exercise waits off Today: u2 never practised R.
		const own = db.select().from(exercises).where(eq(exercises.routineId, copy.id)).get()!;
		expect(own.active).toBe(false);
		const inner = db
			.select({ f: routineStepOptions.figureId })
			.from(routineStepOptions)
			.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
			.where(eq(routineSteps.routineId, copy.id))
			.all();
		expect(inner.map((r) => figureRow(r.f).userId)).toEqual(['u2']);
		expect(inner[0].f).toBe(copyOf('figure', G).id);
		expect(crossRefs(db)).toEqual([]);
	});

	it('removeOption on a group routine that was the only way u2 reached F', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const H = figure(T1_SALSA, 'Sombrero');
		const R = routine(T1_SALSA, 'Class routine');
		const rStep = slot(R, 1, [H, F]);
		published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const P = routine(U2_SALSA, 'Mine');
		const step = slot(P, 1, [F]);
		expect(crossRefs(db)).toEqual([]);

		expect(removeOption(db, rStep, F, NOW, 'u1')).toBe(true);
		expect(optionsOf(step)).toEqual([copyOf('figure', F).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('deleteSlots on a group routine that was the only way u2 reached F', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const H = figure(T1_SALSA, 'Sombrero');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [H]);
		const rStep = slot(R, 2, [F]);
		published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const P = routine(U2_SALSA, 'Mine');
		const step = slot(P, 1, [F]);

		expect(deleteSlots(db, R, [rStep], NOW, 'u1')).not.toBeNull();
		expect(optionsOf(step)).toEqual([copyOf('figure', F).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('archiveExercise of a group drill u2’s section links: u2 gets the drill, paused', () => {
		const D = drill({ teamId: 1 }, 'Spins');
		published('Week 1', (id) => linkExercise(db, id, D, 'u1'));
		const mine = figure(U2_SALSA, 'Mine');
		const own = link(section({ figureId: mine }), { exerciseId: D });
		expect(crossRefs(db)).toEqual([]);

		expect(archiveExercise(db, D, NOW, 'u1')).toBe(true);

		const copy = copyOf('drill', D);
		expect(linkOf(own).exerciseId).toBe(copy.id);
		expect(copy.archivedAt).toBeNull();
		// u2 never practised it: the copy waits, off Today, until u2 turns it on.
		expect(exerciseRow(copy.id).active).toBe(false);
		expect(crossRefs(db)).toEqual([]);
	});

	it('archiveExercise of a group drill u2 practises and links: the practice goes on the copy', () => {
		const D = drill({ teamId: 1 }, 'Spins');
		const L = published('Week 1', (id) => linkExercise(db, id, D, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, drillIds: [D] }, T)).toBe(true);
		const entry = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.drillId, D)))
			.get()!;
		db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();
		const mine = lesson(U2_SALSA, 'My notes');
		const own = link(section({ lessonId: mine }), { exerciseId: D });

		archiveExercise(db, D, NOW, 'u1');

		const copy = copyOf('drill', D);
		expect(linkOf(own).exerciseId).toBe(copy.id);
		expect(exerciseRow(copy.id).active).toBe(true);
		expect(copy.archivedAt).toBeNull();
		expect(db.select().from(sets).where(eq(sets.exerciseId, copy.id)).all()).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('unlinkSpot that took a drill out of reach', () => {
		const D = drill({ teamId: 1 }, 'Spins');
		const L = published('Week 1');
		const groupLink = link(section({ lessonId: L }), { exerciseId: D });
		const mine = figure(U2_SALSA, 'Mine');
		const own = link(section({ figureId: mine }), { exerciseId: D });
		expect(crossRefs(db)).toEqual([]);

		expect(unlinkSpot(db, groupLink, { exerciseId: D }, NOW, 'u1')).toBe(true);
		expect(linkOf(own).exerciseId).toBe(copyOf('drill', D).id);
		expect(crossRefs(db)).toEqual([]);
	});

	it('setRole: u2 made a member while u2’s routine used a draft-only group figure', () => {
		expect(setRole(db, 1, 'u2', 'editor', T)).toBe(true);
		const Z = figure(T1_SALSA, 'Draft move');
		const P = routine(U2_SALSA, 'Mine');
		const step = slot(P, 1, [Z]);
		expect(crossRefs(db)).toEqual([]);

		expect(setRole(db, 1, 'u2', 'member', NOW)).toBe(true);
		expect(optionsOf(step)).toEqual([copyOf('figure', Z).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a hand link of u2’s own lesson: the lesson page lists the copy, not the group’s figure', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const L = published('Week 1', (id) => linkFigure(db, id, F, 'u1'));
		const mine = lesson(U2_SALSA, 'My notes');
		db.insert(lessonFigures).values({ lessonId: mine, figureId: F }).run();
		expect(crossRefs(db)).toEqual([]);

		archiveLesson(db, L, NOW, 'u1');

		const copy = copyOf('figure', F);
		expect(getLesson(db, mine, 'u2')!.figures.map((f) => f.id)).toEqual([copy.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('duplicating a rescued routine points the duplicate at the copy', () => {
		const { F, L, P } = figureInRoutine();
		archiveLesson(db, L, NOW, 'u1');
		const dup = duplicateRoutine(db, P);
		expect(dup).not.toBeNull();
		const options = db
			.select({ f: routineStepOptions.figureId })
			.from(routineStepOptions)
			.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
			.where(eq(routineSteps.routineId, dup!.id))
			.all();
		expect(options.map((o) => o.f)).toEqual([copyOf('figure', F).id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an embed of a group routine the group has since nested keeps its shape on the copy', () => {
		const G = figure(T1_SALSA, 'Setenta');
		const C = routine(T1_SALSA, 'Inner');
		slot(C, 1, [G]);
		const R = routine(T1_SALSA, 'Outer');
		published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const Q = routine(U2_SALSA, 'Embeds');
		const step = embed(Q, 1, R);
		// The group nests C into R after u2 embedded R (ruling of Task 13).
		embed(R, 1, C);
		expect(crossRefs(db)).toEqual([]);

		archiveRoutine(db, R, NOW, 'u1');

		const copy = copyOf('routine', R);
		expect(childOf(step)).toBe(copy.id);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('rescueUsed: what it leaves alone, and what it reuses', () => {
	it('archiving a figure u2 only reads (no own row uses it) makes no copy', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const L = published('Week 1', (id) => linkFigure(db, id, F, 'u1'));
		addLesson(db, 'u2', L, { ...NONE, figureIds: [F] }, T);
		archiveVariation(db, F, NOW, 'u1');
		expect(u2Figures()).toBe(0);
		// The entry leaves Today, as before.
		const entry = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.figureId, F)))
			.get()!;
		expect(entry.archivedAt).toBe(NOW);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a target u2 still reads is left alone', () => {
		const { F, L, step } = figureInRoutine();
		published('Week 2', (id) => linkFigure(db, id, F, 'u1'));
		unlinkFigure(db, L, F, false, NOW, 'u1');
		expect(optionsOf(step)).toEqual([F]);
		expect(u2Figures()).toBe(0);
		expect(rescueUsed(db, 1, NOW)).toBe(0);
	});

	it('an editor’s own rows on the group’s archived figure stay: editors read it', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const P = routine({ userId: 'u1', dance: 'salsa' }, 'Teacher’s own');
		const step = slot(P, 1, [F]);
		archiveVariation(db, F, NOW, 'u1');
		expect(optionsOf(step)).toEqual([F]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('u2’s copy already there (live or archived) is re-pointed to, with no new clone', () => {
		for (const archived of [false, true]) {
			fresh();
			const { F, L, step } = figureInRoutine();
			const made = cloneTx(
				db,
				{ kind: 'figure', id: F, into: U2_SALSA, recordings: false },
				new Map(),
				T
			);
			expect(made.ok).toBe(true);
			const mine = (made as { id: number }).id;
			if (archived) db.update(figures).set({ archivedAt: T }).where(eq(figures.id, mine)).run();
			expect(u2Figures()).toBe(1);

			archiveLesson(db, L, NOW, 'u1');

			expect(optionsOf(step)).toEqual([mine]);
			expect(u2Figures()).toBe(1);
			expect(crossRefs(db)).toEqual([]);
		}
	});

	it('u2’s archived copy of a drill comes back, paused, to hold the link', () => {
		const D = drill({ teamId: 1 }, 'Spins');
		const L = published('Week 1', (id) => linkExercise(db, id, D, 'u1'));
		const own = link(section({ figureId: figure(U2_SALSA, 'Mine') }), { exerciseId: D });
		const made = cloneTx(
			db,
			{ kind: 'drill', id: D, into: U2_SALSA, recordings: false },
			new Map(),
			T
		) as { id: number };
		db.update(exercises).set({ archivedAt: T }).where(eq(exercises.id, made.id)).run();

		archiveLesson(db, L, NOW, 'u1');

		expect(linkOf(own).exerciseId).toBe(made.id);
		expect(exerciseRow(made.id).archivedAt).toBeNull();
		expect(exerciseRow(made.id).active).toBe(false);
		expect(crossRefs(db)).toEqual([]);
	});

	it('counts what it cloned, and only for the person asked about', () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const L = published('Week 1', (id) => linkFigure(db, id, F, 'u1'));
		const P = routine(U2_SALSA, 'Mine');
		const step = slot(P, 1, [F]);
		// Unlinked straight in the table, so nothing has rescued yet.
		db.delete(lessonFigures).where(eq(lessonFigures.lessonId, L)).run();
		expect(rescueUsed(db, 1, NOW, 'u3')).toBe(0);
		expect(optionsOf(step)).toEqual([F]);
		expect(rescueUsed(db, 1, NOW, 'u2')).toBe(1);
		expect(optionsOf(step)).not.toEqual([F]);
		expect(rescueUsed(db, 1, NOW)).toBe(0);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an archived own routine is rescued too', () => {
		const { F, L, P, step } = figureInRoutine();
		db.update(routines).set({ archivedAt: T }).where(eq(routines.id, P)).run();
		archiveLesson(db, L, NOW, 'u1');
		expect(optionsOf(step)).toEqual([copyOf('figure', F).id]);
		expect(routineRow(P).archivedAt).toBe(T);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('rescueUsed and a later restore: one practice per family', () => {
	/** u2's live exercises on any of these figures, routines or drills (a drill counts itself). */
	const live = (col: 'figureId' | 'routineId' | 'drillId', ids: number[]) =>
		db
			.select({ id: exercises.id })
			.from(exercises)
			.where(
				and(
					eq(exercises.userId, 'u2'),
					isNull(exercises.archivedAt),
					col === 'drillId'
						? or(inArray(exercises.drillId, ids), inArray(exercises.id, ids))
						: inArray(exercises[col], ids)
				)
			)
			.all().length;

	it('archiveRoutine, then restoreRoutine: the practice is on the copy only', () => {
		const G = figure(T1_SALSA, 'Setenta');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [G]);
		const L = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, routineIds: [R] }, T)).toBe(true);
		embed(routine(U2_SALSA, 'Embeds'), 1, R);

		archiveRoutine(db, R, NOW, 'u1');
		const copy = copyOf('routine', R);
		expect(live('routineId', [R, copy.id])).toBe(1);
		expect(restoreRoutine(db, T1_SALSA, R, NOW + 1)).toEqual({ ok: true });
		expect(live('routineId', [R, copy.id])).toBe(1);
		expect(live('routineId', [copy.id])).toBe(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('archiveExercise, then restoreDrill: the practice is on the copy only', () => {
		const D = drill({ teamId: 1 }, 'Spins');
		const L = published('Week 1', (id) => linkExercise(db, id, D, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, drillIds: [D] }, T)).toBe(true);
		link(section({ figureId: figure(U2_SALSA, 'Mine') }), { exerciseId: D });

		archiveExercise(db, D, NOW, 'u1');
		const copy = copyOf('drill', D);
		expect(live('drillId', [D, copy.id])).toBe(1);
		expect(restoreDrill(db, T1_SALSA, D, NOW + 1)).toEqual({ ok: true });
		expect(live('drillId', [D, copy.id])).toBe(1);
		expect(live('drillId', [copy.id])).toBe(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an archived own copy of a practised figure comes back to hold the routine and the entry', () => {
		const { F, L, step } = figureInRoutine();
		expect(addLesson(db, 'u2', L, { ...NONE, figureIds: [F] }, T)).toBe(true);
		const mine = (
			cloneTx(db, { kind: 'figure', id: F, into: U2_SALSA, recordings: false }, new Map(), T) as {
				id: number;
			}
		).id;
		expect(archiveVariation(db, mine, T + 1, 'u2')).not.toBeNull();

		archiveVariation(db, F, NOW, 'u1');

		expect(optionsOf(step)).toEqual([mine]);
		expect(figureRow(mine).archivedAt).toBeNull();
		expect(live('figureId', [F, mine])).toBe(1);
		expect(live('figureId', [mine])).toBe(1);
		expect(u2Figures()).toBe(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an archived own copy of a routine comes back paused when nobody practises it', () => {
		const G = figure(T1_SALSA, 'Setenta');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [G]);
		const L = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const step = embed(routine(U2_SALSA, 'Embeds'), 1, R);
		const mine = (
			cloneTx(db, { kind: 'routine', id: R, into: U2_SALSA, recordings: false }, new Map(), T) as {
				id: number;
			}
		).id;
		expect(archiveRoutine(db, mine, T + 1)).toBe(true);

		archiveLesson(db, L, NOW, 'u1');

		expect(childOf(step)).toBe(mine);
		expect(routineRow(mine).archivedAt).toBeNull();
		const own = db.select().from(exercises).where(eq(exercises.routineId, mine)).get()!;
		expect(own.archivedAt).toBeNull();
		expect(own.active).toBe(false);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a copy that embeds its own source never comes to embed itself', () => {
		const G = figure(T1_SALSA, 'Setenta');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [G]);
		const L = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		const mine = (
			cloneTx(db, { kind: 'routine', id: R, into: U2_SALSA, recordings: false }, new Map(), T) as {
				id: number;
			}
		).id;
		const step = embed(mine, 5, R);
		const other = embed(routine(U2_SALSA, 'Embeds'), 1, R);

		archiveLesson(db, L, NOW, 'u1');

		// u2's other routine follows the copy; the copy's own slot is left as it was.
		expect(childOf(other)).toBe(mine);
		expect(childOf(step)).toBe(R);
		const selfEmbeds = db
			.select()
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, mine), eq(routineSteps.childRoutineId, mine)))
			.all();
		expect(selfEmbeds).toEqual([]);
	});
});

describe('rescueUsed at size', () => {
	/** Statements prepared during `fn` (drizzle prepares each query it runs). */
	function queries(fn: () => void): number {
		const client = (db as unknown as { $client: { prepare: (s: string) => unknown } }).$client;
		const prepare = client.prepare.bind(client);
		let n = 0;
		client.prepare = (s: string) => {
			n++;
			return prepare(s);
		};
		try {
			fn();
		} finally {
			client.prepare = prepare;
		}
		return n;
	}

	/** Fifty published lessons; `people` members each with a routine using a figure they read. */
	function build(people: number): void {
		const shared: number[] = [];
		for (let i = 0; i < 50; i++) {
			const F = figure(T1_SALSA, `Move ${i}`);
			shared.push(F);
			published(`L${i}`, (id) => linkFigure(db, id, F, 'u1'));
		}
		for (let p = 0; p < people; p++) {
			const id = `m${p}`;
			db.insert(users)
				.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: 'M' })
				.run();
			joinTeam(db, id, 1, T);
			const P = routine({ userId: id, dance: 'salsa' }, 'Mine');
			slot(P, 1, [shared[p % 50]]);
		}
	}

	it('nothing pointing in costs one query; many people share one reach', () => {
		build(0);
		expect(queries(() => rescueUsed(db, 1, NOW))).toBe(1);

		fresh();
		build(2);
		const two = queries(() => rescueUsed(db, 1, NOW));
		fresh();
		build(20);
		const twenty = queries(() => rescueUsed(db, 1, NOW));
		// One role read per person on top of one shared reach: the reach is not per person.
		expect(twenty - two).toBe(18);
		expect(crossRefs(db)).toEqual([]);
		// Measured 2026-11-04: 60 queries for two people, 78 for twenty (the
		// published reach of fifty lessons is most of it), about 10 ms; the whole
		// reconcile 82.
		expect(queries(() => reconcileEntries(db, 1, NOW)) - twenty).toBeLessThan(10);

		rescueUsed(db, 1, NOW); // warm
		const runs = Array.from({ length: 5 }, () => {
			const t = performance.now();
			expect(rescueUsed(db, 1, NOW)).toBe(0);
			return performance.now() - t;
		}).sort((a, b) => a - b);
		expect(runs.at(-1)!).toBeLessThan(200);
	});
});
