/**
 * The dance wall, tested where it is actually reachable: the actions.
 *
 * Every id in a form body is just a number, so a POST to `/salsa` can carry a
 * bachata exercise or set id. These tests call the real action functions with
 * the other dance's ids and assert a 404 AND that the row is untouched — the
 * second half is the point, because the failure mode being guarded against is
 * one that mutated and then reported a friendly message.
 *
 * The actions reach the database through `getDb()`, so `DATABASE_PATH` is
 * pointed at an in-memory database before the modules are imported; the import
 * is dynamic for that reason, and for that reason only.
 */
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_PATH = ':memory:';

const { getDb } = await import('$lib/server/db');
const { createFigure } = await import('$lib/server/figures');
const { archiveExercise, createCustomExercise, getExercise, getSet, logSet } =
	await import('$lib/server/exercises');
const { exercises, sets } = await import('$lib/server/db/schema');
const todayActions = (await import('./+page.server')).actions;
const playerActions = (await import('./player/+page.server')).actions;

const db = getDb();

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string>) {
	return {
		params: { dance },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' } }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const call = (action: unknown, event: ReturnType<typeof post>) => (action as Invoke)(event);

const figureInput = {
	name: 'Dile que no',
	partner: 'partner' as const,
	notes: null,
	callable: true,
	callText: null
};

let salsaExerciseId: number;
let bachataExerciseId: number;
let bachataCustomId: number;
let bachataSetId: number;

beforeEach(() => {
	// One database for the whole file (the singleton is opened once), so each
	// test starts from a clean pair of dances rather than the last one's rows.
	db.delete(sets).run();
	db.delete(exercises).run();

	salsaExerciseId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.exercise.id;
	bachataExerciseId = createFigure(db, 'bachata', {
		...figureInput,
		name: 'Basico',
		style: 'sensual'
	})!.exercise.id;
	bachataCustomId = createCustomExercise(db, 'bachata', {
		name: 'Hip drills',
		everyDays: 3,
		notes: null
	}).id;
	bachataSetId = logSet(db, {
		exerciseId: bachataExerciseId,
		doneAt: 1_000,
		durationS: null,
		reps: null,
		rating: null,
		note: null,
		playerJson: null
	}).id;
});

const is404 = (thrown: unknown) => expect(thrown).toMatchObject({ status: 404 });

describe("Today refuses the other dance's rows", () => {
	it('will not log a set on an exercise from the other dance', async () => {
		await call(
			todayActions.log,
			post('salsa', {
				exerciseId: String(bachataExerciseId),
				durationMin: '',
				reps: '',
				rating: '',
				note: '',
				day: ''
			})
		).then(() => expect.unreachable('the cross-dance log should have thrown'), is404);
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it('will not delete a set that belongs to the other dance', async () => {
		await call(todayActions.deleteSet, post('salsa', { setId: String(bachataSetId) })).then(
			() => expect.unreachable('the cross-dance delete should have thrown'),
			is404
		);
		expect(getSet(db, bachataSetId)).not.toBeNull();
	});

	it('will not archive an exercise from the other dance', async () => {
		await call(todayActions.archiveExercise, post('salsa', { id: String(bachataCustomId) })).then(
			() => expect.unreachable('the cross-dance archive should have thrown'),
			is404
		);
		expect(getExercise(db, bachataCustomId)?.archivedAt).toBeNull();
	});

	it('will not edit an exercise from the other dance', async () => {
		await call(
			todayActions.updateExercise,
			post('salsa', {
				id: String(bachataCustomId),
				name: 'Renamed by the wrong dance',
				everyDays: '7',
				notes: '',
				practiceMode: 'none',
				songId: '',
				countBpm: '',
				active: 'on'
			})
		).then(() => expect.unreachable('the cross-dance edit should have thrown'), is404);
		expect(getExercise(db, bachataCustomId)?.name).toBe('Hip drills');
	});

	it('still acts on its own dance', async () => {
		const salsaSet = logSet(db, {
			exerciseId: salsaExerciseId,
			doneAt: 2_000,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		await call(todayActions.deleteSet, post('salsa', { setId: String(salsaSet.id) }));
		expect(getSet(db, salsaSet.id)).toBeNull();
	});
});

describe("the player refuses the other dance's exercise", () => {
	it('will not save a run against an exercise from the other dance', async () => {
		await call(
			playerActions.save,
			post('salsa', {
				exerciseId: String(bachataExerciseId),
				durationS: '120',
				rating: '4',
				note: '',
				run: ''
			})
		).then(() => expect.unreachable('the cross-dance save should have thrown'), is404);
		// Only the seeded set: the run was never logged.
		expect(db.select().from(sets).all()).toHaveLength(1);
	});
});

describe('the guard leaves the friendly failures alone', () => {
	it('still refuses to archive a figure exercise, with the message that explains why', async () => {
		const res = (await call(
			todayActions.archiveExercise,
			post('bachata', { id: String(bachataExerciseId) })
		)) as { status: number; data: { message: string } };
		expect(res.data.message).toContain('Archive a figure from its page');
		expect(archiveExercise(db, bachataCustomId, 1)).toBe(true);
	});
});
