import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises } from './db/schema';
import { entryFor } from './entries';
import { addFigureExercise, archiveVariation, createFigure, getFigure } from './figures';
import { archiveLesson, createLesson, getLesson, linkFigure } from './lessons';
import { archiveRoutine, createRoutine } from './routines';
import { T1_SALSA, U1_SALSA } from './test-walls';

// Team T1 has a lesson, a routine, a variation and a drill; u1 and u2 each
// practise every one of them with their own entry (different `everyDays`).

let db: Db;
let lessonId: number;
let routineId: number;
let figureId: number;
let drillId: number;

function entry(userId: string, source: 'lesson' | 'routine' | 'figure' | 'added', target: number) {
	const everyDays = userId === 'u1' ? 2 : userId === 'u2' ? 5 : 9;
	const column = {
		lesson: { lessonId: target },
		routine: { routineId: target },
		figure: { figureId: target },
		added: { drillId: target }
	}[source];
	return db
		.insert(exercises)
		.values({ name: `${source} ${userId}`, source, dance: 'salsa', userId, everyDays, ...column })
		.returning()
		.get();
}

beforeEach(() => {
	db = openDb(':memory:');
	lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-09-22', title: 'Class', notes: null })
		.lesson.id;
	routineId = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
	figureId = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	drillId = db
		.insert(exercises)
		.values({ name: 'Drill', source: 'custom', dance: 'salsa', teamId: 1 })
		.returning()
		.get().id;
	for (const u of ['u1', 'u2']) {
		entry(u, 'lesson', lessonId);
		entry(u, 'routine', routineId);
		entry(u, 'figure', figureId);
		entry(u, 'added', drillId);
	}
	linkFigure(db, lessonId, figureId);
});

describe('entryFor', () => {
	// Catches: dropping the userId condition returns whichever entry came first.
	it('returns only the asked person’s entry for every kind of target', () => {
		for (const target of [{ lessonId }, { routineId }, { figureId }, { drillId }]) {
			expect(entryFor(db, 'u2', target)).toMatchObject({ userId: 'u2', everyDays: 5 });
			expect(entryFor(db, 'u1', target)).toMatchObject({ userId: 'u1', everyDays: 2 });
			expect(entryFor(db, 'u3', target)).toBeNull();
		}
	});
});

describe('getLesson', () => {
	// Catches: a lesson page showing u1's settings to u2.
	it('shows the viewer’s own review entry', () => {
		expect(getLesson(db, lessonId, 'u2')!.exercise!.everyDays).toBe(5);
		expect(getLesson(db, lessonId, 'u1')!.exercise!.everyDays).toBe(2);
		expect(getLesson(db, lessonId, 'u3')!.exercise).toBeNull();
	});

	// Catches: the figure's leftJoin without the person duplicating the figure row.
	it('holds one row per figure, with the viewer’s exerciseId', () => {
		const mine = entryFor(db, 'u2', { figureId })!;
		const rows = getLesson(db, lessonId, 'u2')!.figures;
		expect(rows).toHaveLength(1);
		expect(rows[0].exerciseId).toBe(mine.id);
		expect(getLesson(db, lessonId, 'u3')!.figures[0].exerciseId).toBeNull();
	});
});

describe('getFigure', () => {
	// Catches: the figure page showing someone else's practice.
	it('returns the viewer’s entry', () => {
		expect(getFigure(db, figureId, 'u1')!.exercise!.userId).toBe('u1');
		expect(getFigure(db, figureId, 'u2')!.exercise!.everyDays).toBe(5);
	});
});

describe('addFigureExercise', () => {
	// Catches: "someone already has one" refusing a second person, or the entry copying figure.userId.
	it('lets a second person add theirs on a group figure, owned by them', () => {
		const other = createFigure(db, T1_SALSA, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const first = addFigureExercise(db, 'u1', other)!;
		const second = addFigureExercise(db, 'u2', other)!;
		expect(first.userId).toBe('u1');
		expect(second.userId).toBe('u2');
		expect(second.id).not.toBe(first.id);
		expect(addFigureExercise(db, 'u2', other)).toBeNull();
	});

	// Catches: inserting a second row instead of reviving the archived one (and its sets).
	it('unarchives the person’s archived entry instead of inserting', () => {
		const mine = entryFor(db, 'u1', { figureId })!;
		db.update(exercises).set({ archivedAt: 5 }).where(eq(exercises.id, mine.id)).run();
		const back = addFigureExercise(db, 'u1', figureId)!;
		expect(back.id).toBe(mine.id);
		expect(back.archivedAt).toBeNull();
		expect(db.select().from(exercises).where(eq(exercises.figureId, figureId)).all()).toHaveLength(
			2
		);
	});

	// Catches: handing a person an entry on someone else's personal figure.
	it('refuses another person’s own figure', () => {
		const theirs = createFigure(db, U1_SALSA, {
			figureName: 'Mine',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(addFigureExercise(db, 'u2', theirs)).toBeNull();
		expect(addFigureExercise(db, 'u1', theirs)!.userId).toBe('u1');
	});
});

describe('archive cascades', () => {
	// Catches: the cascade re-stamping an already archived entry, which Restore would then revive.
	it('keeps an earlier archivedAt on an entry removed before the lesson', () => {
		const u3 = entry('u3', 'lesson', lessonId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		expect(archiveLesson(db, lessonId, 2000)).toBe(true);
		expect(entryFor(db, 'u3', { lessonId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u1', { lessonId })!.archivedAt).toBe(2000);
	});

	it('does the same for a routine', () => {
		const u3 = entry('u3', 'routine', routineId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		archiveRoutine(db, routineId, 2000);
		expect(entryFor(db, 'u3', { routineId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u2', { routineId })!.archivedAt).toBe(2000);
	});

	it('does the same for a variation', () => {
		const u3 = entry('u3', 'figure', figureId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		archiveVariation(db, figureId, 2000);
		expect(entryFor(db, 'u3', { figureId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u1', { figureId })!.archivedAt).toBe(2000);
	});
});
