/**
 * Changing who is in a group reconciles that person's entries in the same
 * transaction (R9): what they no longer reach goes off Today, what their
 * added lessons still hold stays.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, lessonAdds } from './db/schema';
import { createTeam, joinTeam, roleOf } from './teams';
import { leaveTeam, removeMember, setRole } from './membership';
import { createLesson, linkExercise, linkRoutine, publishLesson } from './lessons';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { addLesson, entryFor } from './entries';
import { T1_SALSA } from './test-walls';

let db: Db;
let published: number;
let draft: number;
let routine: number;
let drill: number;

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
	publishLesson(db, T1_SALSA, published, 4);
	addLesson(
		db,
		'u2',
		published,
		{ lesson: true, routineIds: [], drillIds: [drill], figureIds: [] },
		5
	);
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

	it('a leaver keeps their added lessons’ entries live, and loses the rest', () => {
		const onDraft = entryOn('u2', routine);
		expect(leaveTeam(db, 1, 'u2', 100)).toBe('left');
		expect(roleOf(db, 'u2', 1)).toBeNull();
		expect(archivedAt(onDraft)).toBe(100);
		expect(archivedAt(entryFor(db, 'u2', { drillId: drill })!.id)).toBeNull();
		expect(db.select().from(lessonAdds).all()).toHaveLength(1);
	});

	it('a removed member is the same, and nobody else’s entries move', () => {
		const onDraft = entryOn('u2', routine);
		const ownersDraft = entryOn('u1', routine);
		expect(removeMember(db, 1, 'u2', 100)).toBe(true);
		expect(archivedAt(onDraft)).toBe(100);
		expect(archivedAt(entryFor(db, 'u2', { lessonId: published })!.id)).toBeNull();
		expect(archivedAt(ownersDraft)).toBeNull();
	});

	it('the owner can neither leave nor be removed, and nothing is reconciled', () => {
		const ownersDraft = entryOn('u1', routine);
		expect(leaveTeam(db, 1, 'u1', 100)).toBe('owner');
		expect(removeMember(db, 1, 'u1', 100)).toBe(false);
		expect(setRole(db, 1, 'u1', 'member', 100)).toBe(false);
		expect(archivedAt(ownersDraft)).toBeNull();
	});
});
