/** The player's Save set: a face is required, like every other log. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA } from '$lib/server/test-walls';
import { runInLocale } from '$lib/server/i18n-request';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sets } from '$lib/server/db/schema';
import { createCustomExercise } from '$lib/server/exercises';
import { actions } from './+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana', dance: 'salsa' };

let db: Db;
let drillId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	drillId = createCustomExercise(db, U1_SALSA, {
		name: 'Son switch',
		everyDays: 2,
		notes: null
	}).id;
});

function save(fields: Record<string, string>) {
	const event = {
		params: { dance: 'salsa' },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ exerciseId: String(drillId), durationS: '120', ...fields })
		}),
		locals: { user: USER } as App.Locals
	};
	return (actions.save as (e: typeof event) => Promise<unknown>)(event);
}

describe('player save', () => {
	it('refuses a run without a face, storing nothing', async () => {
		const res = (await save({})) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('Pick how it went');
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('refuses in the reader’s language', async () => {
		const face = (await runInLocale('sl', () => save({}))) as { data: { message: string } };
		expect(face.data.message).toBe('Izberite, kako je šlo');
		const long = (await runInLocale('sl', () => save({ rating: '4', note: 'x'.repeat(2001) }))) as {
			data: { message: string };
		};
		expect(long.data.message).toBe('Opomba je predolga: največ 2000 znakov.');
		const bad = (await runInLocale('sl', () => save({ rating: '4', durationS: 'x' }))) as {
			data: { message: string };
		};
		expect(bad.data.message).toBe('Tega vadenja ni bilo mogoče shraniti.');
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('stores the rating a face writes, then redirects', async () => {
		await expect(save({ rating: '4' })).rejects.toMatchObject({ status: 303 });
		expect(db.select().from(sets).all()).toMatchObject([{ rating: 4 }]);
	});

	it('redirects to Today with the new set in ?logged, for the Undo toast', async () => {
		const err = await save({ rating: '4' }).catch((e) => e);
		const [row] = db.select().from(sets).all();
		expect(err).toMatchObject({ status: 303, location: `/salsa?logged=${row.id}` });
	});
});
