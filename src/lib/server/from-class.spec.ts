import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { addLesson, entryFor } from './entries';
import { createCustomExercise } from './exercises';
import { createLesson, linkExercise, publishLesson } from './lessons';
import { fromClassOf } from './from-class';
import { T1_SALSA } from './test-walls';

let db: Db;
let lessonId: number;
let drillId: number;
const none = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

beforeEach(() => {
	db = openDb(':memory:');
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tue', notes: null })
		.lesson.id;
	drillId = createCustomExercise(db, T1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
	linkExercise(db, lessonId, drillId, 'u1');
	publishLesson(db, T1_SALSA, lessonId, 3);
});

const row = (id: number) => {
	const r = db.select().from(exercises).where(eq(exercises.id, id)).get()!;
	return { id: r.id, teamId: r.teamId, lessonId: r.lessonId, drillId: r.drillId };
};

describe('fromClassOf', () => {
	it('is null for a person with no route to anything', () => {
		const mine = createCustomExercise(
			db,
			{ userId: 'u2', dance: 'salsa' },
			{
				name: 'Own',
				everyDays: 3,
				notes: null
			}
		);
		expect(fromClassOf(db, 'u2', row(mine.id))).toBeNull();
	});

	it('a lesson review is from its own lesson', () => {
		addLesson(db, 'u2', lessonId, { ...none, lesson: true }, 10);
		const review = entryFor(db, 'u2', { lessonId })!;
		expect(fromClassOf(db, 'u2', row(review.id))).toEqual({ lessonId, day: '2026-11-03' });
	});

	it('an added drill entry (own row, no lesson id) is from the lesson that holds the drill', () => {
		addLesson(db, 'u2', lessonId, { ...none, drillIds: [drillId] }, 10);
		const mine = entryFor(db, 'u2', { drillId })!;
		expect(mine.lessonId).toBeNull();
		expect(fromClassOf(db, 'u2', row(mine.id))).toEqual({ lessonId, day: '2026-11-03' });
	});

	it('the group drill itself resolves with and without an entry', () => {
		// Without an entry: the lesson the person may add.
		expect(fromClassOf(db, 'u2', row(drillId))).toEqual({ lessonId, day: '2026-11-03' });
		// With an entry (the route's `added` side).
		addLesson(db, 'u2', lessonId, { ...none, drillIds: [drillId] }, 10);
		expect(entryFor(db, 'u2', { drillId })).not.toBeNull();
		expect(fromClassOf(db, 'u2', row(drillId))).toEqual({ lessonId, day: '2026-11-03' });
	});
});
