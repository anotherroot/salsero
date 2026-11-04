import { beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq, sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	lessonAdds,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	recordings,
	routineStepOptions,
	routineSteps,
	sets,
	songDrops,
	spotLinks,
	twins,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { createFigure } from '../figures';
import { createRoutine } from '../routines';
import { createLesson, publishLesson } from '../lessons';
import { createSongFromUrl } from '../songs';
import { seedPositions } from '../test-positions';
import type { Space, Wall } from '../scope';
import { T1_SALSA, U2_SALSA } from '../test-walls';
import { repoint, repointPreview } from './repoint';
import { cloneInto } from './clone';
import type { CloneFiles } from './files';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const U3_SALSA: Wall = { userId: 'u3', dance: 'salsa' };
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const ALL = { entries: true };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	seedPositions(db);
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
});

const figure = (space: Space, move: string, name: string) =>
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
const song = (space: Space, title: string) =>
	createSongFromUrl(db, space, { url: `https://youtu.be/${title}`, title, style: 'salsa' }, T).id;

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
		.map((r) => r.f)
		.sort();
const childOf = (stepId: number) =>
	db.select().from(routineSteps).where(eq(routineSteps.id, stepId)).get()!.childRoutineId;

/** A section (0–1 s) on a new lesson video of the lesson, or a new recording of the figure. */
function section(parent: { lessonId: number } | { figureId: number }) {
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
const linkSpot = (spotId: number, target: { figureId: number } | { exerciseId: number }) =>
	db
		.insert(spotLinks)
		.values({ spotId, ...target })
		.run();
const spotTargets = (spotId: number) =>
	db
		.select({ f: spotLinks.figureId, e: spotLinks.exerciseId })
		.from(spotLinks)
		.where(eq(spotLinks.spotId, spotId))
		.all();

/** A person's practice entry (or own exercise) on a target. */
function entry(
	userId: string,
	values: Partial<typeof exercises.$inferInsert> & {
		source: (typeof exercises.$inferInsert)['source'];
	}
) {
	return db
		.insert(exercises)
		.values({ name: 'entry', dance: 'salsa', userId, ...values })
		.returning()
		.get().id;
}
const exerciseOf = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;
const ownExercise = (
	col: 'figureId' | 'routineId' | 'lessonId' | 'drillId',
	userId: string,
	id: number
) =>
	db
		.select()
		.from(exercises)
		.where(and(eq(exercises[col], id), eq(exercises.userId, userId)))
		.get();
const logSets = (exerciseId: number, n: number) => {
	for (let i = 0; i < n; i++)
		db.insert(sets)
			.values({ exerciseId, doneAt: T - i * 1000 })
			.run();
};
const setCount = (exerciseId: number) =>
	db.select().from(sets).where(eq(sets.exerciseId, exerciseId)).all().length;

describe('repoint: a figure', () => {
	it("moves a personal routine's option to the target", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = routine(U2_SALSA, 'Warm-up');
		const step = slot(r, 0, [g]);
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(optionsOf(step)).toEqual([p]);
		expect(report.routines).toEqual([{ id: r, name: 'Warm-up' }]);
	});

	it('a slot already holding the target keeps one option row', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = routine(U2_SALSA, 'Warm-up');
		const step = slot(r, 0, [g, p]);
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(optionsOf(step)).toEqual([p]);
		expect(report.routines).toEqual([{ id: r, name: 'Warm-up' }]);
	});

	it("moves the person's own lesson link, and keeps one row on a clash", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const a = lesson(U2_SALSA, 'Monday');
		const b = lesson(U2_SALSA, 'Friday');
		db.insert(lessonFigures).values({ lessonId: a, figureId: g }).run();
		db.insert(lessonFigures)
			.values([
				{ lessonId: b, figureId: g },
				{ lessonId: b, figureId: p }
			])
			.run();
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		const linked = (l: number) =>
			db
				.select({ f: lessonFigures.figureId })
				.from(lessonFigures)
				.where(eq(lessonFigures.lessonId, l))
				.all()
				.map((r) => r.f);
		expect(linked(a)).toEqual([p]);
		expect(linked(b)).toEqual([p]);
		expect(report.lessons).toEqual([
			{ id: b, title: 'Friday' },
			{ id: a, title: 'Monday' }
		]);
	});

	it("moves the section links on the person's videos, and keeps one on a clash", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const other = figure(U2_SALSA, 'Setenta', 'Basic');
		const onLesson = section({ lessonId: lesson(U2_SALSA, 'Monday') });
		const onRecording = section({ figureId: other });
		linkSpot(onLesson, { figureId: g });
		linkSpot(onRecording, { figureId: g });
		linkSpot(onRecording, { figureId: p });
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(spotTargets(onLesson)).toEqual([{ f: p, e: null }]);
		expect(spotTargets(onRecording)).toEqual([{ f: p, e: null }]);
		expect(report.sections).toBe(2);
	});

	it('merges entries: the sets of both end on one exercise, the other is archived', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Mine');
		const onG = entry('u2', { source: 'figure', figureId: g });
		const onP = entry('u2', { source: 'figure', figureId: p });
		logSets(onG, 2);
		logSets(onP, 1);
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(setCount(onP)).toBe(3);
		expect(setCount(onG)).toBe(0);
		expect(exerciseOf(onG).archivedAt).toBe(NOW);
		expect(exerciseOf(onP).archivedAt).toBeNull();
		expect(report.entries).toBe(1);
	});

	it('a live entry merged into an archived one brings that one back', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Mine');
		const onG = entry('u2', { source: 'figure', figureId: g, everyDays: 2 });
		const onP = entry('u2', { source: 'figure', figureId: p, archivedAt: T });
		logSets(onG, 1);
		repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(exerciseOf(onP)).toMatchObject({ archivedAt: null, everyDays: 2 });
		expect(exerciseOf(onG).archivedAt).toBe(NOW);
		expect(setCount(onP)).toBe(1);
	});

	it('moves an entry when there is none on the target, renamed to it', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Mine');
		const onG = entry('u2', { source: 'figure', figureId: g, name: 'Enchufla · Doble' });
		logSets(onG, 2);
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(exerciseOf(onG)).toMatchObject({
			figureId: p,
			name: 'Enchufla · Mine',
			archivedAt: null
		});
		expect(setCount(onG)).toBe(2);
		expect(report.entries).toBe(1);
	});

	it('entries:false leaves practice where it is', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Mine');
		const onG = entry('u2', { source: 'figure', figureId: g });
		logSets(onG, 2);
		const r = routine(U2_SALSA, 'Warm-up');
		const step = slot(r, 0, [g]);
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, { entries: false }, NOW);
		expect(exerciseOf(onG)).toMatchObject({ figureId: g, archivedAt: null });
		expect(setCount(onG)).toBe(2);
		expect(optionsOf(step)).toEqual([p]);
		expect(report.entries).toBe(0);
	});

	it("leaves a group routine's option on the source untouched", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const groupStep = slot(routine(T1_SALSA, 'Class'), 0, [g]);
		const groupLesson = lesson(T1_SALSA, 'Class');
		db.insert(lessonFigures).values({ lessonId: groupLesson, figureId: g }).run();
		const groupSpot = section({ lessonId: groupLesson });
		linkSpot(groupSpot, { figureId: g });
		const report = repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(optionsOf(groupStep)).toEqual([g]);
		expect(spotTargets(groupSpot)).toEqual([{ f: g, e: null }]);
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, groupLesson)).all()
		).toHaveLength(1);
		expect(report).toEqual({
			routines: [],
			lessons: [],
			sections: 0,
			entries: 0,
			twins: 0,
			figures: []
		});
	});

	it("leaves u3's routine, lesson, section, entry and twins on the source untouched", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const step = slot(routine(U3_SALSA, 'Hers'), 0, [g]);
		const hers = lesson(U3_SALSA, 'Hers');
		db.insert(lessonFigures).values({ lessonId: hers, figureId: g }).run();
		const spot = section({ lessonId: hers });
		linkSpot(spot, { figureId: g });
		const onG = entry('u3', { source: 'figure', figureId: g });
		db.insert(twins).values({ userId: 'u3', kind: 'figure', setId: 's', itemId: g }).run();
		repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(optionsOf(step)).toEqual([g]);
		expect(spotTargets(spot)).toEqual([{ f: g, e: null }]);
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, hers)).get()?.figureId
		).toBe(g);
		expect(exerciseOf(onG)).toMatchObject({ figureId: g, archivedAt: null });
		expect(db.select().from(twins).where(eq(twins.userId, 'u3')).get()?.itemId).toBe(g);
	});

	it("moves the person's twin row; on a clash the sets join and no lone row is left", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const x = figure(U2_SALSA, 'Setenta', 'Basic');
		const y = figure(U2_SALSA, 'Dile que no', 'Basic');
		db.insert(twins)
			.values([
				{ userId: 'u2', kind: 'figure', setId: 'a', itemId: g },
				{ userId: 'u2', kind: 'figure', setId: 'a', itemId: x }
			])
			.run();
		expect(repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW).twins).toBe(1);
		const rows = () =>
			db
				.select({ set: twins.setId, item: twins.itemId })
				.from(twins)
				.where(eq(twins.userId, 'u2'))
				.all()
				.sort((m, n) => m.item - n.item);
		expect(rows()).toEqual(
			[
				{ set: 'a', item: p },
				{ set: 'a', item: x }
			].sort((m, n) => m.item - n.item)
		);

		// p is now in set a; y twins with a new figure q that p moves to.
		const q = figure(U2_SALSA, 'Sombrero', 'Basic');
		db.insert(twins)
			.values([
				{ userId: 'u2', kind: 'figure', setId: 'b', itemId: q },
				{ userId: 'u2', kind: 'figure', setId: 'b', itemId: y }
			])
			.run();
		repoint(db, 'u2', 'salsa', 'figure', p, q, ALL, NOW);
		const after = rows();
		expect(after.map((r) => r.item).sort((m, n) => m - n)).toEqual([x, y, q].sort((m, n) => m - n));
		expect(new Set(after.map((r) => r.set)).size).toBe(1);

		// A set of two whose other member is the target ends empty, not with a lone row.
		db.delete(twins).run();
		db.insert(twins)
			.values([
				{ userId: 'u2', kind: 'figure', setId: 'c', itemId: g },
				{ userId: 'u2', kind: 'figure', setId: 'c', itemId: p }
			])
			.run();
		repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(rows()).toEqual([]);
	});
});

describe('repoint: a routine', () => {
	it('moves embeds, lesson links and the entry (merged into the target’s own exercise)', () => {
		const g = routine(T1_SALSA, 'Class routine');
		const p = routine(U2_SALSA, 'My routine');
		const mine = routine(U2_SALSA, 'Social');
		const step = embed(mine, 0, g);
		const groupStep = embed(routine(T1_SALSA, 'Other'), 0, g);
		const l = lesson(U2_SALSA, 'Monday');
		db.insert(lessonRoutines).values({ lessonId: l, routineId: g }).run();
		const onG = entry('u2', { source: 'routine', routineId: g });
		logSets(onG, 2);
		const own = ownExercise('routineId', 'u2', p)!;
		const report = repoint(db, 'u2', 'salsa', 'routine', g, p, ALL, NOW);
		expect(childOf(step)).toBe(p);
		expect(childOf(groupStep)).toBe(g);
		expect(
			db.select().from(lessonRoutines).where(eq(lessonRoutines.lessonId, l)).get()?.routineId
		).toBe(p);
		expect(setCount(own.id)).toBe(2);
		expect(exerciseOf(onG).archivedAt).toBe(NOW);
		expect(report).toEqual({
			routines: [{ id: mine, name: 'Social' }],
			lessons: [{ id: l, title: 'Monday' }],
			sections: 0,
			entries: 1,
			twins: 0,
			figures: []
		});
	});
});

describe('repoint: a drill', () => {
	it('from a group drill to a personal one: sets move onto the drill, the entry is archived', () => {
		const g = drill({ teamId: 1 }, 'Spins');
		const p = drill({ userId: 'u2' }, 'Spins');
		const onG = entry('u2', { source: 'added', drillId: g });
		logSets(onG, 3);
		const l = lesson(U2_SALSA, 'Monday');
		db.insert(lessonExercises).values({ lessonId: l, exerciseId: g }).run();
		const spot = section({ lessonId: l });
		linkSpot(spot, { exerciseId: g });
		const report = repoint(db, 'u2', 'salsa', 'drill', g, p, ALL, NOW);
		expect(setCount(p)).toBe(3);
		expect(exerciseOf(onG).archivedAt).toBe(NOW);
		expect(
			db.select().from(lessonExercises).where(eq(lessonExercises.lessonId, l)).get()?.exerciseId
		).toBe(p);
		expect(spotTargets(spot)).toEqual([{ f: null, e: p }]);
		expect(report).toEqual({
			routines: [],
			lessons: [{ id: l, title: 'Monday' }],
			sections: 1,
			entries: 1,
			twins: 0,
			figures: []
		});
	});

	it('from a personal drill to a group one: an entry is made and the sets move to it', () => {
		const g = drill({ teamId: 1 }, 'Spins');
		const p = drill({ userId: 'u2' }, 'My spins');
		db.update(exercises)
			.set({ everyDays: 5, countBpm: 90, practiceMode: 'count' })
			.where(eq(exercises.id, p))
			.run();
		logSets(p, 2);
		const report = repoint(db, 'u2', 'salsa', 'drill', p, g, ALL, NOW);
		const made = ownExercise('drillId', 'u2', g)!;
		expect(made).toMatchObject({
			source: 'added',
			name: 'Spins',
			archivedAt: null,
			teamId: null,
			everyDays: 5,
			countBpm: 90,
			practiceMode: 'count'
		});
		expect(setCount(made.id)).toBe(2);
		expect(setCount(p)).toBe(0);
		expect(report.entries).toBe(1);
	});

	it('from a personal drill to a group one: an archived entry is brought back', () => {
		const g = drill({ teamId: 1 }, 'Spins');
		const p = drill({ userId: 'u2' }, 'My spins');
		const old = entry('u2', { source: 'added', drillId: g, archivedAt: T });
		logSets(old, 1);
		logSets(p, 2);
		repoint(db, 'u2', 'salsa', 'drill', p, g, ALL, NOW);
		expect(exerciseOf(old).archivedAt).toBeNull();
		expect(setCount(old)).toBe(3);
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.drillId, g), eq(exercises.userId, 'u2')))
				.all()
		).toHaveLength(1);
	});

	it('entries:false leaves the practice in both directions', () => {
		const g = drill({ teamId: 1 }, 'Spins');
		const p = drill({ userId: 'u2' }, 'My spins');
		const onG = entry('u2', { source: 'added', drillId: g });
		logSets(onG, 1);
		logSets(p, 2);
		expect(repoint(db, 'u2', 'salsa', 'drill', g, p, { entries: false }, NOW).entries).toBe(0);
		expect(repoint(db, 'u2', 'salsa', 'drill', p, g, { entries: false }, NOW).entries).toBe(0);
		expect(setCount(onG)).toBe(1);
		expect(setCount(p)).toBe(2);
		expect(exerciseOf(onG).archivedAt).toBeNull();
	});
});

describe('repoint: a song', () => {
	it("moves the person's song picks and drops their song drops for the source", () => {
		const g = song(T1_SALSA, 'Class song');
		const p = song(U2_SALSA, 'My song');
		const mine = drill({ userId: 'u2' }, 'Shines');
		db.update(exercises)
			.set({ songId: g, practiceMode: 'song' })
			.where(eq(exercises.id, mine))
			.run();
		const dropped = drill({ userId: 'u2' }, 'Turns');
		db.insert(songDrops).values({ exerciseId: dropped, songId: g, droppedAt: T }).run();
		const hers = drill({ userId: 'u3' }, 'Hers');
		db.update(exercises)
			.set({ songId: g, practiceMode: 'song' })
			.where(eq(exercises.id, hers))
			.run();
		db.insert(songDrops).values({ exerciseId: hers, songId: g, droppedAt: T }).run();
		const report = repoint(db, 'u2', 'salsa', 'song', g, p, ALL, NOW);
		expect(exerciseOf(mine).songId).toBe(p);
		expect(exerciseOf(hers).songId).toBe(g);
		expect(db.select().from(songDrops).all()).toEqual([
			{ exerciseId: hers, songId: g, droppedAt: T }
		]);
		expect(report.entries).toBe(1);
	});
});

describe('repoint: a lesson', () => {
	it('merges the entry into the target’s and adds the target once with addLesson', () => {
		const g = lesson(T1_SALSA, 'Class');
		publishLesson(db, T1_SALSA, g, T);
		const p = lesson(U2_SALSA, 'My notes');
		const own = ownExercise('lessonId', 'u2', p)!;
		logSets(own.id, 2);
		db.insert(twins)
			.values([
				{ userId: 'u2', kind: 'lesson', setId: 's', itemId: p },
				{ userId: 'u2', kind: 'lesson', setId: 's', itemId: lesson(U2_SALSA, 'Other') }
			])
			.run();
		const report = repoint(
			db,
			'u2',
			'salsa',
			'lesson',
			p,
			g,
			{ entries: true, addLesson: true },
			NOW
		);
		const onG = ownExercise('lessonId', 'u2', g)!;
		expect(onG).toMatchObject({ id: own.id, name: 'Review: Class', archivedAt: null });
		expect(setCount(own.id)).toBe(2);
		expect(db.select().from(lessonAdds).all()).toEqual([
			{ userId: 'u2', lessonId: g, addedAt: NOW, seenAt: NOW }
		]);
		expect(report).toEqual({
			routines: [],
			lessons: [],
			sections: 0,
			entries: 1,
			twins: 1,
			figures: []
		});

		const again = lesson(U2_SALSA, 'More notes');
		repoint(db, 'u2', 'salsa', 'lesson', again, g, { entries: true, addLesson: true }, NOW + 5);
		expect(db.select().from(lessonAdds).all()).toEqual([
			{ userId: 'u2', lessonId: g, addedAt: NOW, seenAt: NOW }
		]);
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.lessonId, g), eq(exercises.userId, 'u2')))
				.all()
		).toHaveLength(1);
	});

	it('addLesson goes through Add: a draft group lesson is not added', () => {
		const g = lesson(T1_SALSA, 'Draft');
		const p = lesson(U2_SALSA, 'My notes');
		repoint(db, 'u2', 'salsa', 'lesson', p, g, { entries: true, addLesson: true }, NOW);
		expect(db.select().from(lessonAdds).all()).toEqual([]);
	});
});

describe('repoint: what the review ruled', () => {
	const mainFirst = (stepId: number) =>
		db
			.select({ f: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(eq(routineStepOptions.stepId, stepId))
			.orderBy(asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`)
			.all()
			.map((r) => r.f);

	it("an option clash keeps the slot's main figure", () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const x = figure(U2_SALSA, 'Setenta', 'Basic');
		const r = routine(U2_SALSA, 'Warm-up');
		const gMain = slot(r, 0, [g, x, p]);
		const pMain = slot(r, 1, [p, x, g]);
		repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW);
		expect(mainFirst(gMain)).toEqual([p, x]);
		expect(mainFirst(pMain)).toEqual([p, x]);
	});

	it('an embed that would put the target in itself is skipped (the target then nests)', () => {
		const g = routine(T1_SALSA, 'Class routine');
		const p = routine(U2_SALSA, 'My routine');
		const other = routine(U2_SALSA, 'Social');
		const inP = embed(p, 0, g);
		const inOther = embed(other, 0, g);
		const report = repoint(db, 'u2', 'salsa', 'routine', g, p, ALL, NOW);
		expect(childOf(inP)).toBe(g);
		expect(childOf(inOther)).toBe(g);
		expect(report.routines).toEqual([]);
	});

	it('no embed moves onto a target that embeds a routine itself', () => {
		const g = routine(T1_SALSA, 'Class routine');
		const p = routine(U2_SALSA, 'My routine');
		embed(p, 0, routine(U2_SALSA, 'Inner'));
		const step = embed(routine(U2_SALSA, 'Social'), 0, g);
		const report = repoint(db, 'u2', 'salsa', 'routine', g, p, ALL, NOW);
		expect(childOf(step)).toBe(g);
		expect(report.routines).toEqual([]);
	});

	it('a group drill onto an archived personal drill is refused, nothing written', () => {
		const g = drill({ teamId: 1 }, 'Spins');
		const p = drill({ userId: 'u2' }, 'Spins');
		db.update(exercises).set({ archivedAt: T }).where(eq(exercises.id, p)).run();
		const onG = entry('u2', { source: 'added', drillId: g });
		logSets(onG, 1);
		expect(() => repoint(db, 'u2', 'salsa', 'drill', g, p, ALL, NOW)).toThrow();
		expect(exerciseOf(onG).archivedAt).toBeNull();
		expect(setCount(onG)).toBe(1);
	});

	describe('copy, then re-point: the live practice wins', () => {
		const files: CloneFiles = {
			async link(_kind, file) {
				return `copy-${file}`;
			},
			async unlink() {}
		};
		const copy = async (kind: 'routine' | 'drill', id: number) => {
			const made = await cloneInto(
				db,
				{ kind, id, into: U2_SALSA, recordings: false },
				files,
				NOW,
				Number.POSITIVE_INFINITY,
				{ trusted: true }
			);
			if (!made.ok) throw new Error('no copy');
			return made.id;
		};

		it('a group routine: the paused copy takes over the live entry', async () => {
			const g = routine(T1_SALSA, 'Class routine');
			const onG = entry('u2', { source: 'routine', routineId: g, everyDays: 2 });
			logSets(onG, 3);
			const c = await copy('routine', g);
			const own = ownExercise('routineId', 'u2', c)!;
			expect(own.active).toBe(false);
			repoint(db, 'u2', 'salsa', 'routine', g, c, ALL, NOW);
			expect(exerciseOf(own.id)).toMatchObject({ active: true, everyDays: 2, archivedAt: null });
			expect(setCount(own.id)).toBe(3);
			expect(exerciseOf(onG).archivedAt).toBe(NOW);
		});

		it('a group drill: the paused copy takes over the live entry', async () => {
			const g = drill({ teamId: 1 }, 'Spins');
			const onG = entry('u2', { source: 'added', drillId: g, everyDays: 2 });
			logSets(onG, 3);
			const c = await copy('drill', g);
			expect(exerciseOf(c).active).toBe(false);
			repoint(db, 'u2', 'salsa', 'drill', g, c, ALL, NOW);
			expect(exerciseOf(c)).toMatchObject({ active: true, everyDays: 2, archivedAt: null });
			expect(setCount(c)).toBe(3);
			expect(exerciseOf(onG).archivedAt).toBe(NOW);
		});
	});
});

describe('repointPreview', () => {
	it('equals the report of a following repoint', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const p = figure(U2_SALSA, 'Enchufla', 'Doble');
		const r1 = routine(U2_SALSA, 'B routine');
		const r2 = routine(U2_SALSA, 'A routine');
		slot(r1, 0, [g]);
		slot(r1, 1, [g, p]);
		slot(r2, 0, [g]);
		slot(routine(T1_SALSA, 'Class'), 0, [g]);
		const l = lesson(U2_SALSA, 'Monday');
		db.insert(lessonFigures).values({ lessonId: l, figureId: g }).run();
		linkSpot(section({ lessonId: l }), { figureId: g });
		linkSpot(section({ figureId: p }), { figureId: g });
		const onG = entry('u2', { source: 'figure', figureId: g });
		logSets(onG, 1);
		db.insert(twins).values({ userId: 'u2', kind: 'figure', setId: 's', itemId: g }).run();
		const preview = repointPreview(db, 'u2', 'salsa', 'figure', g);
		expect(preview).toEqual({
			routines: [
				{ id: r2, name: 'A routine' },
				{ id: r1, name: 'B routine' }
			],
			lessons: [{ id: l, title: 'Monday' }],
			sections: 2,
			entries: 1,
			twins: 1,
			figures: []
		});
		expect(repoint(db, 'u2', 'salsa', 'figure', g, p, ALL, NOW)).toEqual(preview);
		expect(repointPreview(db, 'u2', 'salsa', 'figure', g)).toEqual({
			routines: [],
			lessons: [],
			sections: 0,
			entries: 0,
			twins: 0,
			figures: []
		});
	});

	it('reads only', () => {
		const g = figure(T1_SALSA, 'Enchufla', 'Doble');
		const step = slot(routine(U2_SALSA, 'Mine'), 0, [g]);
		repointPreview(db, 'u2', 'salsa', 'figure', g);
		expect(optionsOf(step)).toEqual([g]);
	});
});
