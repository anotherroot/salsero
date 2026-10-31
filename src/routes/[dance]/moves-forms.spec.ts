/**
 * The Moves sheets' refusals: each names the field it is about, so the sheet
 * can show it under that field, and hands back everything that was typed.
 *
 * Like `dance-wall.spec.ts`, the actions reach the database through `getDb()`,
 * which is mocked: each test gets its own `openDb(':memory:')` and nothing
 * ever opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { listRoutines } from '$lib/server/routines';
import { createFigure } from '$lib/server/figures';
import { actions as routineListActions } from './routines/+page.server';
import { actions as figureListActions } from './figures/+page.server';
import { actions as positionActions } from './positions/+page.server';
import { archivePosition, getPosition, listPositions, seedPositions } from '$lib/server/positions';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string>, id = '') {
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const call = (action: unknown, event: ReturnType<typeof post>) => (action as Invoke)(event);

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});

describe('New routine', () => {
	it('refuses a routine without a name under the Name field, keeping the notes', async () => {
		const result = await call(
			routineListActions.create,
			post('salsa', { name: ' ', notes: 'For Fridays' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				field: 'name',
				message: 'Give the routine a name (up to 200 characters).',
				notes: 'For Fridays'
			}
		});
		expect(listRoutines(db, 'salsa')).toEqual([]);
	});

	it('refuses notes that are too long under the Notes field, keeping the name', async () => {
		const result = await call(
			routineListActions.create,
			post('bachata', { name: 'Wave combo', notes: 'x'.repeat(2001) })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Notes are up to 2000 characters.', name: 'Wave combo' }
		});
	});

	it('creates the routine and goes to its page', async () => {
		await expect(
			call(routineListActions.create, post('bachata', { name: 'Wave combo', notes: '' }))
		).rejects.toMatchObject({ status: 303 });
		expect(listRoutines(db, 'bachata').map((r) => r.name)).toEqual(['Wave combo']);
	});
});

describe('New figure', () => {
	const fields = {
		figureName: 'Hammerlock',
		name: 'From closed',
		partner: 'partner',
		style: 'sensual',
		notes: 'Lead the turn early, on 1.'
	};

	it('puts a taken figure name under Figure name, in bachata too, keeping every field', async () => {
		createFigure(db, 'bachata', {
			figureName: 'Hammerlock',
			name: 'Basic',
			partner: 'partner',
			style: 'sensual',
			notes: null
		});
		expect(await call(figureListActions.create, post('bachata', fields))).toMatchObject({
			status: 400,
			data: {
				field: 'figureName',
				message: "There's already a figure called Hammerlock.",
				figureName: 'Hammerlock',
				name: 'From closed',
				notes: 'Lead the turn early, on 1.'
			}
		});
	});

	it('puts a missing variation name under Variation name', async () => {
		expect(
			await call(figureListActions.create, post('bachata', { ...fields, name: '' }))
		).toMatchObject({
			status: 400,
			data: {
				field: 'name',
				message: 'Give the variation a name (up to 200 characters).',
				figureName: 'Hammerlock'
			}
		});
	});

	it('puts a missing figure name under Figure name', async () => {
		expect(
			await call(figureListActions.create, post('bachata', { ...fields, figureName: '' }))
		).toMatchObject({
			status: 400,
			data: {
				field: 'figureName',
				message: 'Give the figure a name (up to 200 characters).',
				name: 'From closed'
			}
		});
	});

	it('puts too-long notes under Notes', async () => {
		expect(
			await call(figureListActions.create, post('bachata', { ...fields, notes: 'x'.repeat(2001) }))
		).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Notes are up to 2000 characters.' }
		});
	});

	it('refuses a style from the other dance without naming a field', async () => {
		const result = (await call(
			figureListActions.create,
			post('bachata', { ...fields, style: 'son' })
		)) as { status: number; data: Record<string, unknown> };
		expect(result.status).toBe(400);
		expect(result.data.message).toBe('Pick how it is danced and its style.');
		expect(result.data).not.toHaveProperty('field');
	});
});

describe('Positions', () => {
	beforeEach(() => seedPositions(db));

	it('restores a removed position', async () => {
		const row = listPositions(db, 'salsa').find((p) => !p.neutral)!;
		archivePosition(db, row.id, 1);
		expect(await call(positionActions.restore, post('salsa', { id: String(row.id) }))).toEqual({
			action: 'restore',
			ok: true
		});
		expect(getPosition(db, row.id)!.archivedAt).toBeNull();
	});

	it('answers ok when there was nothing to restore', async () => {
		const row = listPositions(db, 'salsa')[0];
		expect(await call(positionActions.restore, post('salsa', { id: String(row.id) }))).toEqual({
			action: 'restore',
			ok: true
		});
	});

	it("refuses to restore the other dance's position", async () => {
		const row = listPositions(db, 'bachata').find((p) => !p.neutral)!;
		archivePosition(db, row.id, 1);
		await expect(
			call(positionActions.restore, post('salsa', { id: String(row.id) }))
		).rejects.toMatchObject({ status: 404 });
		expect(getPosition(db, row.id)!.archivedAt).toBe(1);
	});

	it('puts a taken position name under Name', async () => {
		expect(await call(positionActions.create, post('bachata', { name: 'Shadow' }))).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'That position already exists.' }
		});
	});

	it('puts a missing name under Name on create and on rename', async () => {
		expect(await call(positionActions.create, post('salsa', { name: ' ' }))).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Give the position a name.' }
		});
		const row = listPositions(db, 'salsa')[0];
		expect(
			await call(positionActions.rename, post('salsa', { id: String(row.id), name: '' }))
		).toMatchObject({ status: 400, data: { field: 'name', message: 'Give the position a name.' } });
	});
});
