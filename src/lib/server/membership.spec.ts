/**
 * Changing who is in a group reconciles that person's entries in the same
 * transaction (R9): what they no longer reach goes off Today. Leaving and
 * being removed keep copies first (`keepFromTeam`): leaving keeps what the
 * person chose, removal everything; their practice follows onto the copies.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figures,
	lessonAdds,
	lessons,
	routines,
	routineStepOptions,
	routineSteps,
	teamMembers
} from './db/schema';
import { createTeam, joinTeam, roleOf } from './teams';
import { leaveTeam, removeMember, setRole } from './membership';
import { createLesson, linkExercise, linkFigure, linkRoutine, publishLesson } from './lessons';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { addLesson, entryFor } from './entries';
import { addRecording, createFigure } from './figures';
import { crossRefs } from './integrity';
import type { CloneFileKind, CloneFiles } from './clones/files';
import { geneOf } from './clones/genes';
import { T1_SALSA, U2_SALSA } from './test-walls';

let db: Db;
let published: number;
let draft: number;
let routine: number;
let drill: number;
let figure: number;
let mine: number;

/** A fake `CloneFiles`: a new name is `copy-<file>`, and every link is recorded. */
function fakeFiles() {
	const linked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return `copy-${file}`;
		},
		async unlink() {}
	};
	return { files, linked };
}

/** An entry made by hand, the way an editor practising a draft's routine has one. */
function entryOn(userId: string, routineId: number) {
	return db
		.insert(exercises)
		.values({ name: 'Show', source: 'routine', routineId, dance: 'salsa', userId })
		.returning()
		.get().id;
}
const archivedAt = (id: number) =>
	db.select({ a: exercises.archivedAt }).from(exercises).where(eq(exercises.id, id)).get()!.a;

/** A person's own rows of one table. */
const own = (t: typeof figures | typeof lessons | typeof routines, userId = 'u2') =>
	db
		.select()
		.from(t)
		.where(and(eq(t.userId, userId), isNull(t.teamId)))
		.all();
const optionsOf = (routineId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.where(eq(routineSteps.routineId, routineId))
		.all()
		.map((r) => r.f);
const membership = (userId: string) =>
	db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).all();

beforeEach(() => {
	db = openDb(':memory:');
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor', 3);
	published = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'P', notes: null })
		.lesson.id;
	draft = createLesson(db, T1_SALSA, { lessonDay: '2026-11-02', title: 'D', notes: null }).lesson
		.id;
	drill = createCustomExercise(db, T1_SALSA, { name: 'Drill', everyDays: 3, notes: null }).id;
	linkExercise(db, published, drill, 'u1');
	routine = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
	linkRoutine(db, draft, routine, 'u1');
	// A group figure with a recording in the published lesson, and u2's own
	// routine with a slot of it.
	figure = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Doble',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	addRecording(
		db,
		{
			figureId: figure,
			file: 'f.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		},
		'u1'
	);
	linkFigure(db, published, figure, 'u1');
	publishLesson(db, T1_SALSA, published, 4);
	addLesson(
		db,
		'u2',
		published,
		{ lesson: true, routineIds: [], drillIds: [drill], figureIds: [] },
		5
	);
	mine = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null }).routine.id;
	const step = db
		.insert(routineSteps)
		.values({ routineId: mine, position: 0 })
		.returning()
		.get().id;
	db.insert(routineStepOptions).values({ stepId: step, figureId: figure }).run();
});

describe('membership changes reconcile the person’s entries', () => {
	it('a demoted editor loses their entry on a draft’s routine, keeps their added lesson’s', () => {
		const onDraft = entryOn('u2', routine);
		expect(setRole(db, 1, 'u2', 'member', 100)).toBe(true);
		expect(archivedAt(onDraft)).toBe(100);
		expect(archivedAt(entryFor(db, 'u2', { drillId: drill })!.id)).toBeNull();
		expect(archivedAt(entryFor(db, 'u2', { lessonId: published })!.id)).toBeNull();
	});

	it('promoting reconciles nothing', () => {
		setRole(db, 1, 'u2', 'member', 100);
		const onDraft = entryOn('u2', routine);
		expect(setRole(db, 1, 'u2', 'editor', 200)).toBe(true);
		expect(archivedAt(onDraft)).toBeNull();
	});

	it('a leaver who keeps only what their routines use gets that figure; the rest goes off Today', async () => {
		const onDraft = entryOn('u2', routine);
		const f = fakeFiles();
		expect(await leaveTeam(db, 1, 'u2', { mode: 'used' }, f.files, 100)).toBe('left');
		expect(roleOf(db, 'u2', 1)).toBeNull();
		expect(membership('u2')).toEqual([]);

		// Only the figure u2's routine uses is copied, with its recording.
		const copies = own(figures);
		expect(copies).toHaveLength(1);
		expect(copies[0].geneId).toBe(geneOf(db, 'figure', figure));
		expect(optionsOf(mine)).toEqual([copies[0].id]);
		expect(f.linked).toEqual([['recording', 'f.mp4']]);
		expect(own(lessons)).toEqual([]);

		// What was not kept goes off Today, and the adds go.
		expect(archivedAt(onDraft)).toBe(100);
		expect(archivedAt(entryFor(db, 'u2', { drillId: drill })!.id)).toBe(100);
		expect(archivedAt(entryFor(db, 'u2', { lessonId: published })!.id)).toBe(100);
		expect(db.select().from(lessonAdds).all()).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a removed member keeps everything, and nobody else’s entries move', async () => {
		entryOn('u2', routine);
		const ownersDraft = entryOn('u1', routine);
		const f = fakeFiles();
		expect(await removeMember(db, 1, 'u2', f.files, 100)).toBe(true);
		expect(membership('u2')).toEqual([]);

		// The added lesson and what it holds, and the draft's routine u2 practised.
		const [lesson] = own(lessons);
		expect(lesson.geneId).toBe(geneOf(db, 'lesson', published));
		expect(own(figures).map((r) => r.geneId)).toEqual([geneOf(db, 'figure', figure)]);
		const [routineCopy] = own(routines).filter((r) => r.id !== mine);
		expect(routineCopy.geneId).toBe(geneOf(db, 'routine', routine));
		expect(f.linked).toEqual([['recording', 'f.mp4']]);

		// u2's practice is on the copies, still live; nothing of it on the group's rows.
		type Col = typeof exercises.lessonId | typeof exercises.routineId | typeof exercises.drillId;
		const live = (col: Col, id: number) =>
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), eq(col, id), isNull(exercises.archivedAt)))
				.all();
		expect(live(exercises.lessonId, lesson.id)).toHaveLength(1);
		expect(live(exercises.routineId, routineCopy.id)).toHaveLength(1);
		expect(live(exercises.lessonId, published)).toEqual([]);
		expect(live(exercises.routineId, routine)).toEqual([]);
		expect(live(exercises.drillId, drill)).toEqual([]);

		expect(archivedAt(ownersDraft)).toBeNull();
		expect(db.select().from(lessonAdds).all()).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('the owner can neither leave nor be removed, and nothing is kept or reconciled', async () => {
		const ownersDraft = entryOn('u1', routine);
		const f = fakeFiles();
		expect(await leaveTeam(db, 1, 'u1', { mode: 'all' }, f.files, 100)).toBe('owner');
		expect(await removeMember(db, 1, 'u1', f.files, 100)).toBe(false);
		expect(setRole(db, 1, 'u1', 'member', 100)).toBe(false);
		expect(archivedAt(ownersDraft)).toBeNull();
		expect(f.linked).toEqual([]);
		expect(own(routines, 'u1')).toEqual([]);
		expect(roleOf(db, 'u1', 1)).toBe('owner');
	});

	it('someone not in the group is neither removed nor given anything', async () => {
		const f = fakeFiles();
		expect(await removeMember(db, 1, 'u9', f.files, 100)).toBe(false);
		expect(await leaveTeam(db, 1, 'u9', { mode: 'all' }, f.files, 100)).toBe('left');
		expect(f.linked).toEqual([]);
		expect(own(figures, 'u9')).toEqual([]);
	});
});
