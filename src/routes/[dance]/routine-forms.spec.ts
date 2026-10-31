/**
 * The routine page's Make routine refusals: a missing name belongs under the
 * Name field; a run that cannot become a routine is the sheet's banner.
 * `getDb()` is mocked, as in `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createFigure } from '$lib/server/figures';
import {
	addChildSlot,
	addFigureSlot,
	createRoutine,
	getRoutine,
	routineSlots
} from '$lib/server/routines';
import * as routinePage from './routines/[id]/+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

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
let r: number;
let a: number;
let other: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	r = createRoutine(db, 'salsa', { name: 'Friday', notes: null }).routine.id;
	other = createRoutine(db, 'salsa', { name: 'Other', notes: null }).routine.id;
	const make = (figureName: string) =>
		createFigure(db, 'salsa', {
			figureName,
			name: 'Basic',
			partner: 'partner',
			notes: null,
			style: 'salsa'
		})!.figure.id;
	a = addFigureSlot(db, r, make('Enchufla'))!;
	addFigureSlot(db, r, make('Setenta'));
});

describe('Make routine', () => {
	it('puts a nameless Make routine under its Name', async () => {
		expect(
			await call(
				routinePage.actions.extract,
				post('salsa', { stepIds: String(a), name: ' ' }, String(r))
			)
		).toMatchObject({
			status: 400,
			data: {
				action: 'extract',
				field: 'name',
				message: 'Give the new routine a name (up to 200 characters).'
			}
		});
		expect(routineSlots(db, r)).toHaveLength(2);
	});

	it('refuses a run that cannot become a routine as the sheet’s banner', async () => {
		addChildSlot(db, other, r); // r is now embedded, so it cannot embed a new routine
		const result = (await call(
			routinePage.actions.extract,
			post('salsa', { stepIds: String(a), name: 'Opener' }, String(r))
		)) as { status: number; data: Record<string, unknown> };
		expect(result).toMatchObject({ status: 400, data: { action: 'extract' } });
		expect(result.data).not.toHaveProperty('field');
	});
});

describe('Edit routine', () => {
	it('puts a nameless rename under Name and keeps the notes typed', async () => {
		expect(
			await call(
				routinePage.actions.rename,
				post('salsa', { name: ' ', notes: 'Fridays' }, String(r))
			)
		).toMatchObject({
			status: 400,
			data: {
				action: 'rename',
				field: 'name',
				message: 'Give the routine a name (up to 200 characters).',
				notes: 'Fridays'
			}
		});
		expect(getRoutine(db, r)?.name).toBe('Friday');
	});

	it('puts overlong notes under Notes', async () => {
		expect(
			await call(
				routinePage.actions.rename,
				post('salsa', { name: 'Friday', notes: 'x'.repeat(2001) }, String(r))
			)
		).toMatchObject({
			status: 400,
			data: { action: 'rename', field: 'notes', message: 'Notes are up to 2000 characters.' }
		});
	});

	it('saves a good rename', async () => {
		expect(
			await call(
				routinePage.actions.rename,
				post('salsa', { name: 'Saturday', notes: 'Fridays' }, String(r))
			)
		).toEqual({ ok: true });
		expect(getRoutine(db, r)?.name).toBe('Saturday');
	});
});
