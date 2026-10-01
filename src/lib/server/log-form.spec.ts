/**
 * The one logging path every popup posts to. Tested through the real function
 * with the app's `getDb()` mocked, for the reason `dance-wall.spec.ts` gives:
 * `$env/dynamic/private` does not see a `process.env` write from a test, so
 * mocking the module is the only way to be sure the real database is never
 * opened.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sets } from '$lib/server/db/schema';
import { createCustomExercise, getSet, logSet } from '$lib/server/exercises';
import { addFigureExercise, createFigure } from '$lib/server/figures';
import { noonOf } from '$lib/day/day';
import { deleteSetFrom, logSetFrom } from './log-form';

const TZ = 'Europe/Ljubljana';
const USER = { id: 'u1', email: 'u@example.com', timezone: TZ };

function post(dance: string, fields: Record<string, string>) {
	return {
		params: { dance },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER } as App.Locals
	};
}

let db: Db;
let figureExerciseId: number;
let drillId: number;
let bachataDrillId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	figureExerciseId = addFigureExercise(
		db,
		createFigure(db, 'salsa', {
			name: 'Enchufla',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id
	)!.id;
	drillId = createCustomExercise(db, 'salsa', { name: 'Son switch', everyDays: 2, notes: null }).id;
	bachataDrillId = createCustomExercise(db, 'bachata', {
		name: 'Hips',
		everyDays: 2,
		notes: null
	}).id;
});

const only = () => {
	const all = db.select().from(sets).all();
	expect(all).toHaveLength(1);
	return all[0];
};

describe('logSetFrom', () => {
	it('prefers exact seconds over minutes, keeps the run, and drops fields a figure lacks', async () => {
		await logSetFrom(
			post('salsa', {
				exerciseId: String(figureExerciseId),
				durationMin: '9',
				durationS: '512',
				reps: '20',
				rating: '4',
				note: 'Clean on the 5',
				run: '{"source":"count"}'
			})
		);
		expect(only()).toMatchObject({
			durationS: 512,
			reps: null,
			rating: 4,
			note: 'Clean on the 5',
			playerJson: '{"source":"count"}'
		});
	});

	it('keeps reps on a drill, and minutes when no exact seconds came', async () => {
		await logSetFrom(post('salsa', { exerciseId: String(drillId), durationMin: '5', reps: '30' }));
		expect(only()).toMatchObject({ durationS: 300, reps: 30 });
	});

	it('back-fills a past day at noon, without a player run', async () => {
		await logSetFrom(
			post('salsa', { exerciseId: String(drillId), day: '2020-01-01', run: '{"source":"count"}' })
		);
		expect(only()).toMatchObject({ doneAt: noonOf('2020-01-01', TZ), playerJson: null });
	});

	it('drops an overlong run rather than failing the set', async () => {
		await logSetFrom(post('salsa', { exerciseId: String(drillId), run: 'x'.repeat(4001) }));
		expect(only().playerJson).toBeNull();
	});

	it('refuses a bad rating with a message, storing nothing', async () => {
		const res = (await logSetFrom(post('salsa', { exerciseId: String(drillId), rating: '9' }))) as {
			status: number;
		};
		expect(res.status).toBe(400);
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('refuses an exercise of the other dance with a 404, storing nothing', async () => {
		await expect(
			logSetFrom(post('salsa', { exerciseId: String(bachataDrillId) }))
		).rejects.toMatchObject({
			status: 404
		});
		expect(db.select().from(sets).all()).toHaveLength(0);
	});
});

describe('deleteSetFrom', () => {
	it('deletes its own dance’s set and refuses the other’s', async () => {
		const mine = logSet(db, {
			exerciseId: drillId,
			doneAt: 1,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		const theirs = logSet(db, {
			exerciseId: bachataDrillId,
			doneAt: 1,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		await deleteSetFrom(post('salsa', { setId: String(mine.id) }));
		expect(getSet(db, mine.id)).toBeNull();
		await expect(deleteSetFrom(post('salsa', { setId: String(theirs.id) }))).rejects.toMatchObject({
			status: 404
		});
		expect(getSet(db, theirs.id)).not.toBeNull();
	});
});
