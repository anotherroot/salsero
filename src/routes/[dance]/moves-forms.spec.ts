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
import { actions as routineListActions } from './routines/+page.server';

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
