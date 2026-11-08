/**
 * The one logging path every popup posts to. Tested through the real function
 * with the app's `getDb()` mocked, for the reason `dance-wall.spec.ts` gives:
 * `$env/dynamic/private` does not see a `process.env` write from a test, so
 * mocking the module is the only way to be sure the real database is never
 * opened.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA, U1_BACHATA } from '$lib/server/test-walls';

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
import { STEPS } from '$lib/schedule/schedule';
import { makeClass } from '$lib/server/test-class';
import {
	deleteDayFrom,
	deleteSetFrom,
	logSetFrom,
	parseSetSnapshot,
	parseSetSnapshots,
	restoreDayFrom,
	restoreSetFrom,
	saveDoneFrom,
	undoDoneFrom
} from './log-form';

const TZ = 'Europe/Ljubljana';
const USER = { id: 'u1', email: 'u@example.com', timezone: TZ, dance: 'salsa' };

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
const DRILL_EVERY_DAYS = 2;
let bachataDrillId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	figureExerciseId = addFigureExercise(
		db,
		'u1',
		createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id
	)!.id;
	drillId = createCustomExercise(db, U1_SALSA, {
		name: 'Son switch',
		everyDays: DRILL_EVERY_DAYS,
		notes: null
	}).id;
	bachataDrillId = createCustomExercise(db, U1_BACHATA, {
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

	it('a second log the same day updates the one row, and answers with the Undo snapshot', async () => {
		const first = (await logSetFrom(
			post('salsa', { exerciseId: String(drillId), durationS: '240', rating: '2', note: 'a' })
		)) as { setId: number; before: string | null };
		expect(first.before).toBeNull();
		const second = (await logSetFrom(
			post('salsa', { exerciseId: String(drillId), durationS: '60', rating: '4' })
		)) as { setId: number; before: string | null };
		expect(second.setId).toBe(first.setId);
		expect(JSON.parse(second.before!)).toMatchObject({ durationS: 240, rating: 2, note: 'a' });
		expect(only()).toMatchObject({ durationS: 300, rating: 4, note: null });
	});

	it('keeps reps on a drill, and minutes when no exact seconds came', async () => {
		await logSetFrom(
			post('salsa', { exerciseId: String(drillId), durationMin: '5', reps: '30', rating: '2' })
		);
		expect(only()).toMatchObject({ durationS: 300, reps: 30 });
	});

	it('back-fills a past day at noon, without a player run', async () => {
		await logSetFrom(
			post('salsa', {
				exerciseId: String(drillId),
				day: '2020-01-01',
				rating: '1',
				run: '{"source":"count"}'
			})
		);
		expect(only()).toMatchObject({ doneAt: noonOf('2020-01-01', TZ), playerJson: null });
	});

	it('drops an overlong run rather than failing the set', async () => {
		await logSetFrom(
			post('salsa', { exerciseId: String(drillId), rating: '4', run: 'x'.repeat(4001) })
		);
		expect(only().playerJson).toBeNull();
	});

	it('refuses a bad rating with a message, storing nothing', async () => {
		const res = (await logSetFrom(post('salsa', { exerciseId: String(drillId), rating: '9' }))) as {
			status: number;
		};
		expect(res.status).toBe(400);
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('refuses a set without a face, storing nothing', async () => {
		const res = (await logSetFrom(post('salsa', { exerciseId: String(drillId) }))) as {
			status: number;
			data: { message: string };
		};
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('Pick how it went');
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('stores the rating a face writes', async () => {
		await logSetFrom(post('salsa', { exerciseId: String(drillId), rating: '5' }));
		expect(only().rating).toBe(5);
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

describe('deleteSetFrom, a set already gone', () => {
	it('answers with a 404 failure and does not throw', async () => {
		const res = await deleteSetFrom(post('salsa', { setId: '999999' }));
		expect(res).toMatchObject({ status: 404, data: { action: 'deleteSet' } });
	});
});

describe('deleteSetFrom and restoreSetFrom', () => {
	it('hands back what it deleted, and Undo puts it back on its own day', async () => {
		const wed = noonOf('2026-10-28', TZ);
		const s = logSet(db, {
			exerciseId: drillId,
			doneAt: wed,
			durationS: 720,
			reps: 20,
			rating: 2,
			note: 'warm-up',
			playerJson: '{"bpm":180}'
		});
		const res = await deleteSetFrom(post('salsa', { setId: String(s.id) }));
		expect(getSet(db, s.id)).toBeNull();
		const snapshot = (res as { snapshot: string }).snapshot;
		await restoreSetFrom(post('salsa', { snapshot }));
		const back = db.select().from(sets).all();
		expect(back).toHaveLength(1);
		expect(back[0]).toMatchObject({
			exerciseId: drillId,
			doneAt: wed,
			durationS: 720,
			reps: 20,
			rating: 2,
			note: 'warm-up',
			playerJson: '{"bpm":180}'
		});
	});
	it('refuses a malformed snapshot and inserts nothing', async () => {
		const res = await restoreSetFrom(post('salsa', { snapshot: 'not json' }));
		expect(res).toMatchObject({ status: 400 });
		expect(db.select().from(sets).all()).toHaveLength(0);
	});
});

describe('parseSetSnapshot', () => {
	const ok = {
		exerciseId: 1,
		doneAt: 1_000,
		durationS: null,
		reps: null,
		rating: 4,
		note: null,
		playerJson: null
	};
	it('reads a whole snapshot', () =>
		expect(parseSetSnapshot(JSON.stringify(ok), 2_000)).toEqual(ok));
	it('ignores an extra id key', () =>
		expect(parseSetSnapshot(JSON.stringify({ ...ok, id: 5 }), 2_000)).toEqual(ok));
	it.each([
		['a rating of 6', { ...ok, rating: 6 }],
		['a set in the future', { ...ok, doneAt: 10_000_000 }],
		['no exercise', { ...ok, exerciseId: undefined }],
		['a fractional duration', { ...ok, durationS: 1.5 }],
		['an overlong note', { ...ok, note: 'x'.repeat(2001) }],
		['an overlong run', { ...ok, playerJson: 'x'.repeat(4001) }]
	])('refuses %s', (_, v) => expect(parseSetSnapshot(JSON.stringify(v), 2_000)).toBeNull());
});

describe('saveDoneFrom', () => {
	it('stores the day, with no before and the gap the face earned', async () => {
		const res = await saveDoneFrom(
			post('salsa', { exerciseId: String(drillId), durationS: '252', rating: '4', note: 'ok' })
		);
		expect(res).toMatchObject({
			action: 'done',
			ok: true,
			before: null,
			backDays: Math.max(STEPS.gotit.floor, DRILL_EVERY_DAYS)
		});
		expect(only()).toMatchObject({ durationS: 252, rating: 4, note: 'ok' });
	});

	it('stores no face for a fixed rhythm, whatever was posted', async () => {
		const fixed = createCustomExercise(db, U1_SALSA, {
			name: 'Fixed',
			notes: null,
			comesBack: { kind: 'every', days: 2 }
		}).id;
		const res = await saveDoneFrom(post('salsa', { exerciseId: String(fixed), rating: '5' }));
		expect(res).toMatchObject({ ok: true, backDays: 2 });
		expect(only().rating).toBeNull();
	});

	it('refuses a by-how-it-went exercise without a face, storing nothing', async () => {
		const res = await saveDoneFrom(post('salsa', { exerciseId: String(drillId) }));
		expect(res).toMatchObject({
			status: 400,
			data: { action: 'done', message: 'Pick how it went' }
		});
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('backfills a past day at noon with no time and no run', async () => {
		const res = await saveDoneFrom(
			post('salsa', {
				exerciseId: String(drillId),
				day: '2026-11-05',
				rating: '3',
				durationS: '90',
				run: '{"x":1}'
			})
		);
		expect(res).toMatchObject({ ok: true, backDays: null });
		expect(only()).toMatchObject({
			doneAt: noonOf('2026-11-05', TZ),
			durationS: null,
			playerJson: null
		});
	});

	it('a second save the same day keeps one row, and Undo restores the first', async () => {
		await saveDoneFrom(post('salsa', { exerciseId: String(drillId), rating: '3', note: 'a' }));
		const first = only();
		const res = (await saveDoneFrom(
			post('salsa', { exerciseId: String(drillId), rating: '4', note: 'b' })
		)) as { setId: number; before: string };
		expect(only()).toMatchObject({ rating: 4, note: 'b' });
		const undo = await undoDoneFrom(
			post('salsa', { setId: String(res.setId), before: res.before })
		);
		expect(undo).toMatchObject({ action: 'undoDone', ok: true });
		expect(only()).toMatchObject({ id: first.id, rating: 3, note: 'a' });
	});

	it('refuses the group drill itself, not a member entry, with a 404', async () => {
		const c = makeClass(db);
		const ev = post('salsa', { exerciseId: String(c.drill), rating: '4' });
		ev.locals = { user: { ...USER, id: 'u3' } } as App.Locals;
		await expect(saveDoneFrom(ev)).rejects.toMatchObject({ status: 404 });
		expect(db.select().from(sets).all()).toHaveLength(0);
	});
});

describe('undoDoneFrom', () => {
	it('refuses a before of another exercise, leaving the row', async () => {
		await saveDoneFrom(post('salsa', { exerciseId: String(drillId), rating: '3' }));
		const row = only();
		const forged = JSON.stringify({
			exerciseId: figureExerciseId,
			doneAt: 1000,
			durationS: null,
			reps: null,
			rating: 1,
			note: null,
			playerJson: null
		});
		const res = await undoDoneFrom(post('salsa', { setId: String(row.id), before: forged }));
		expect(res).toMatchObject({
			status: 400,
			data: { action: 'undoDone', message: 'Could not undo that. Try again.' }
		});
		expect(only()).toEqual(row);
	});

	it('refuses a same-exercise before from another day, leaving the row', async () => {
		await saveDoneFrom(post('salsa', { exerciseId: String(drillId), rating: '3' }));
		const row = only();
		const other = JSON.stringify({
			exerciseId: drillId,
			doneAt: noonOf('2026-10-01', TZ),
			durationS: null,
			reps: null,
			rating: 1,
			note: null,
			playerJson: null
		});
		const res = await undoDoneFrom(post('salsa', { setId: String(row.id), before: other }));
		expect(res).toMatchObject({ status: 400, data: { action: 'undoDone' } });
		expect(only()).toEqual(row);
	});

	it('is a 404 for a set of another person, leaving it', async () => {
		const c = makeClass(db);
		const s = logSet(db, {
			exerciseId: c.entry,
			doneAt: Date.now(),
			durationS: null,
			reps: null,
			rating: 3,
			note: null,
			playerJson: null
		});
		await expect(
			undoDoneFrom(post('salsa', { setId: String(s.id), before: '' }))
		).rejects.toMatchObject({ status: 404 });
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it('deletes the day when before is empty', async () => {
		const res = (await saveDoneFrom(
			post('salsa', { exerciseId: String(drillId), rating: '3' })
		)) as { setId: number };
		await undoDoneFrom(post('salsa', { setId: String(res.setId), before: '' }));
		expect(db.select().from(sets).all()).toHaveLength(0);
	});
});

describe('deleteDayFrom and restoreDayFrom', () => {
	it('hands back the day’s rows and Undo puts them all back', async () => {
		const day = '2026-10-28';
		for (const [h, rating] of [
			[0, 2],
			[3, 4]
		]) {
			logSet(db, {
				exerciseId: drillId,
				doneAt: noonOf(day, TZ) + h * 3_600_000,
				durationS: 60,
				reps: null,
				rating,
				note: null,
				playerJson: null
			});
		}
		const before = db.select().from(sets).all();
		const res = (await deleteDayFrom(post('salsa', { exerciseId: String(drillId), day }))) as {
			ok: true;
			snapshots: string;
		};
		expect(res).toMatchObject({ action: 'deleteDay', ok: true });
		expect(db.select().from(sets).all()).toHaveLength(0);
		await restoreDayFrom(post('salsa', { snapshots: res.snapshots }));
		expect(
			db
				.select()
				.from(sets)
				.all()
				.map((r) => [r.doneAt, r.rating])
		).toEqual(before.map((r) => [r.doneAt, r.rating]));
	});

	it('refuses another dance’s exercise, and a bad day', async () => {
		await expect(
			deleteDayFrom(post('salsa', { exerciseId: String(bachataDrillId), day: '2026-10-28' }))
		).rejects.toMatchObject({ status: 404 });
		const res = await deleteDayFrom(post('salsa', { exerciseId: String(drillId), day: 'nope' }));
		expect(res).toMatchObject({ status: 400, data: { action: 'deleteDay' } });
	});

	const U2 = { ...USER, id: 'u2' };
	const day = '2026-10-28';
	const snapOf = (exerciseId: number, hour = 12) =>
		JSON.stringify([
			{
				exerciseId,
				doneAt: noonOf(day, TZ) + (hour - 12) * 3_600_000,
				durationS: 60,
				reps: null,
				rating: 3,
				note: null,
				playerJson: null
			}
		]);
	const asU2 = (fields: Record<string, string>) => {
		const ev = post('salsa', fields);
		ev.locals = { user: U2 } as App.Locals;
		return ev;
	};

	it('refuses another person’s snapshots with a 404, writing nothing', async () => {
		makeClass(db);
		await expect(restoreDayFrom(asU2({ snapshots: snapOf(drillId) }))).rejects.toMatchObject({
			status: 404
		});
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('refuses a group drill’s snapshots with a 404, writing nothing', async () => {
		const c = makeClass(db);
		const ev = post('salsa', { snapshots: snapOf(c.drill) });
		ev.locals = { user: { ...USER, id: 'u3' } } as App.Locals;
		await expect(restoreDayFrom(ev)).rejects.toMatchObject({ status: 404 });
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('deleteDayFrom on another person’s exercise is a 404, deleting nothing', async () => {
		makeClass(db);
		logSet(db, {
			exerciseId: drillId,
			doneAt: noonOf(day, TZ),
			durationS: null,
			reps: null,
			rating: 3,
			note: null,
			playerJson: null
		});
		await expect(deleteDayFrom(asU2({ exerciseId: String(drillId), day }))).rejects.toMatchObject({
			status: 404
		});
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it('refuses a restore when the day already has a row, inserting nothing', async () => {
		const snapshots = snapOf(drillId);
		await restoreDayFrom(post('salsa', { snapshots }));
		expect(db.select().from(sets).all()).toHaveLength(1);
		const again = await restoreDayFrom(post('salsa', { snapshots }));
		expect(again).toMatchObject({
			status: 400,
			data: { action: 'restoreDay', message: 'That day could not be put back.' }
		});
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it('refuses a restore after a new save that day, keeping the new save', async () => {
		const snapshots = snapOf(drillId, 9);
		logSet(db, {
			exerciseId: drillId,
			doneAt: noonOf(day, TZ),
			durationS: null,
			reps: null,
			rating: 5,
			note: 'new',
			playerJson: null
		});
		const res = await restoreDayFrom(post('salsa', { snapshots }));
		expect(res).toMatchObject({ status: 400, data: { action: 'restoreDay' } });
		expect(db.select().from(sets).all()).toMatchObject([{ rating: 5, note: 'new' }]);
	});

	it('refuses malformed snapshots, storing nothing', async () => {
		const res = await restoreDayFrom(post('salsa', { snapshots: 'nope' }));
		expect(res).toMatchObject({
			status: 400,
			data: { action: 'restoreDay', message: 'That day could not be put back.' }
		});
	});
});

describe('parseSetSnapshots', () => {
	const ok = {
		exerciseId: 1,
		doneAt: 1_000,
		durationS: null,
		reps: null,
		rating: 4,
		note: null,
		playerJson: null
	};
	it('reads a list of one exercise', () =>
		expect(parseSetSnapshots(JSON.stringify([ok, { ...ok, doneAt: 5 }]), 2_000)).toHaveLength(2));
	it.each([
		['not json', 'nope'],
		['not a list', JSON.stringify(ok)],
		['an empty list', '[]'],
		['two exercises', JSON.stringify([ok, { ...ok, exerciseId: 2 }])],
		['one bad row', JSON.stringify([ok, { ...ok, rating: 9 }])]
	])('refuses %s', (_, raw) => expect(parseSetSnapshots(raw, 2_000)).toBeNull());
});
