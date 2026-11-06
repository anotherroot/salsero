/**
 * The Moves sheets' refusals: each names the field it is about, so the sheet
 * can show it under that field, and hands back everything that was typed.
 *
 * Like `dance-wall.spec.ts`, the actions reach the database through `getDb()`,
 * which is mocked: each test gets its own `openDb(':memory:')` and nothing
 * ever opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_BACHATA, U1_SALSA } from '$lib/server/test-walls';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { listRoutines } from '$lib/server/routines';
import { createFigure, createVariationIn } from '$lib/server/figures';
import { actions as routineListActions } from './(moves)/routines/+page.server';
import { actions as figureListActions } from './(moves)/figures/+page.server';
import { load as layoutLoad } from './(moves)/+layout.server';
import { figuresView, type FiguresLists } from '$lib/moves/filter';

/** The Figures list as the page shows it: the layout's unfiltered lists through the pure view. */
const figureListLoad = (e: unknown) => {
	const l = (layoutLoad as unknown as (e: unknown) => { lists: { figures: FiguresLists } })({
		...(e as object),
		depends: () => {}
	}).lists.figures;
	return { ...l, ...figuresView(l, { q: '' }) };
};
import { actions as coverageActions } from './(moves)/coverage/+page.server';

const USER = {
	id: 'u1',
	email: 'u@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'salsa',
	isAdmin: true
};

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string>, id = '') {
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user: { ...USER, dance } }
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
		expect(listRoutines(db, U1_SALSA)).toEqual([]);
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
		expect(listRoutines(db, U1_BACHATA).map((r) => r.name)).toEqual(['Wave combo']);
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
		createFigure(db, U1_BACHATA, {
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
				message: "There's already a move called Hammerlock.",
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
				message: 'Give the figure a name (up to 200 characters).',
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
				message: 'Give the move a name (up to 200 characters).',
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

describe('Coverage: make routine', () => {
	it('puts a missing routine name under Name, keeping the picks to resubmit', async () => {
		const result = await call(coverageActions.create, post('salsa', { name: ' ', figureIds: '1' }));
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Give the routine a name (up to 200 characters).' }
		});
	});

	it('asks for a pick without naming a field', async () => {
		const result = (await call(coverageActions.create, post('salsa', { name: 'Combo' }))) as {
			data: { field?: string; message: string };
		};
		expect(result.data.message).toBe('Pick at least one figure.');
		expect(result.data.field).toBeUndefined();
	});
});

describe('the Figures load', () => {
	it('returns moves with their figures', () => {
		createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		});
		type Data = { figures: { name: string; figures: { label: string }[] }[] };
		const data = (figureListLoad as unknown as (e: unknown) => Data)({
			params: { dance: 'salsa' },
			url: new URL('http://localhost/salsa/figures'),
			cookies: { get: () => undefined, delete: () => {} },
			locals: { user: USER }
		});
		expect(data.figures[0].name).toBe('Enchufla');
		expect(data.figures[0].figures[0].label).toBe('Enchufla · Doble');
	});
});

describe('the Figures list, Not linked chip', () => {
	it('counts figures, not the moves holding them', async () => {
		const made = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		createVariationIn(db, made.group.id, {
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		});
		const data = (await (figureListLoad as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			url: new URL('http://localhost/salsa/figures'),
			cookies: { get: () => undefined, delete: () => {} },
			locals: { user: USER }
		})) as { unlinked: number };
		expect(data.unlinked).toBe(2);
	});
});
