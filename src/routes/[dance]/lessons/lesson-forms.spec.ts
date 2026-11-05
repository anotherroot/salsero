/**
 * The New lesson sheet's, the lesson page's Edit and its four "from this
 * lesson" sheets' refusals: each names the field it is about and hands back
 * everything that was typed. `getDb()` is mocked per test, as in
 * `moves-forms.spec.ts`; nothing opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA } from '$lib/server/test-walls';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createLesson, getLesson, listLessons } from '$lib/server/lessons';
import { createFigure } from '$lib/server/figures';
import { eq } from 'drizzle-orm';
import { exercises } from '$lib/server/db/schema';
import { localDay } from '$lib/day/day';
import { actions as listActions } from './+page.server';
import { actions as lessonActions } from './[id]/+page.server';

const ZONE = 'Europe/Ljubljana';
const USER = { id: 'u1', email: 'u@example.com', timezone: ZONE };

function post(dance: string, fields: Record<string, string>, id?: number) {
	return {
		params: id === undefined ? { dance } : { dance, id: String(id) },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		cookies: { get: () => undefined, delete: () => {} },
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

describe('New lesson', () => {
	it('puts a blank title under Title, keeping the day and notes', async () => {
		const result = await call(
			listActions.create,
			post('salsa', { title: ' ', notes: 'Slow on 4', everyDays: '3', lessonDay: '2026-01-05' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'create',
				field: 'title',
				message: 'Give it a title (up to 200 characters).',
				notes: 'Slow on 4',
				lessonDay: '2026-01-05'
			}
		});
		expect(listLessons(db, U1_SALSA)).toEqual([]);
	});

	it('puts a day in the future under Day of the class, in bachata too', async () => {
		const future = localDay(Date.now() + 2 * 86_400_000, ZONE);
		const result = await call(
			listActions.create,
			post('bachata', { title: 'Sensual footwork', notes: '', everyDays: '3', lessonDay: future })
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				field: 'lessonDay',
				message: 'That day is in the future.',
				title: 'Sensual footwork',
				lessonDay: future
			}
		});
	});

	it('puts a day that is not a day under Day of the class', async () => {
		const result = await call(
			listActions.create,
			post('salsa', { title: 'Rueda', notes: '', everyDays: '3', lessonDay: '' })
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'lessonDay', message: 'Pick the day of the class.' }
		});
	});

	it('puts notes over 2000 characters under Notes', async () => {
		const result = await call(
			listActions.create,
			post('salsa', {
				title: 'Rueda',
				notes: 'x'.repeat(2001),
				everyDays: '3',
				lessonDay: '2026-01-05'
			})
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Notes are up to 2000 characters.', title: 'Rueda' }
		});
	});

	it('asks no frequency: a post without everyDays creates the lesson with the default', async () => {
		await call(
			listActions.create,
			post('salsa', { title: 'Rueda', notes: '', lessonDay: '2026-01-05' })
		).catch(() => {});
		expect(listLessons(db, U1_SALSA)).toHaveLength(1);
		expect(db.select().from(exercises).where(eq(exercises.source, 'lesson')).get()).toMatchObject({
			everyDays: 3
		});
	});

	it('ignores a posted everyDays: the first gap is the default either way', async () => {
		await call(
			listActions.create,
			post('salsa', { title: 'Rueda', notes: '', everyDays: '14', lessonDay: '2026-01-05' })
		).catch(() => {});
		expect(db.select().from(exercises).where(eq(exercises.source, 'lesson')).get()).toMatchObject({
			everyDays: 3
		});
	});

	it('creates the lesson and goes to its page', async () => {
		let thrown: unknown;
		try {
			await call(
				listActions.create,
				post('salsa', { title: 'Rueda', notes: '', everyDays: '3', lessonDay: '2026-01-05' })
			);
		} catch (e) {
			thrown = e;
		}
		const [lesson] = listLessons(db, U1_SALSA);
		expect(thrown).toMatchObject({ status: 303, location: `/salsa/lessons/${lesson.id}` });
	});
});

describe('Edit lesson', () => {
	const made = () =>
		createLesson(db, U1_SALSA, { lessonDay: '2026-01-05', title: 'Rueda', notes: null }, 3).lesson
			.id;
	const edit = (id: number, fields: Record<string, string>) =>
		call(lessonActions.update, post('salsa', fields, id));

	it('puts a blank title under Title, keeping what was typed', async () => {
		const id = made();
		const result = await edit(id, { title: '  ', notes: 'Slow on 4', lessonDay: '2026-01-06' });
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'update',
				field: 'title',
				message: 'Give it a title (up to 200 characters).',
				notes: 'Slow on 4',
				lessonDay: '2026-01-06'
			}
		});
		expect(getLesson(db, id, 'u1')?.lesson).toMatchObject({
			title: 'Rueda',
			lessonDay: '2026-01-05'
		});
	});

	it('puts a day after today under Day of the class', async () => {
		const id = made();
		const future = localDay(Date.now() + 2 * 86_400_000, ZONE);
		const result = await edit(id, { title: 'Rueda', notes: '', lessonDay: future });
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'update',
				field: 'lessonDay',
				message: 'That day is in the future.',
				title: 'Rueda'
			}
		});
	});

	it('puts a day that is not a day under Day of the class', async () => {
		const result = await edit(made(), { title: 'Rueda', notes: '', lessonDay: 'soon' });
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'lessonDay', message: 'Pick the day of the class.' }
		});
	});

	it('puts notes over 2000 characters under Notes', async () => {
		const result = await edit(made(), {
			title: 'Rueda',
			notes: 'x'.repeat(2001),
			lessonDay: '2026-01-05'
		});
		expect(result).toMatchObject({
			status: 400,
			data: { action: 'update', field: 'notes', message: 'Notes are up to 2000 characters.' }
		});
	});

	it('saves a valid edit', async () => {
		const id = made();
		const result = await edit(id, {
			title: 'Rueda · enchufla',
			notes: 'Left hand low on 3',
			lessonDay: '2026-01-04'
		});
		expect(result).toEqual({ action: 'update', ok: true });
		expect(getLesson(db, id, 'u1')?.lesson).toMatchObject({
			title: 'Rueda · enchufla',
			notes: 'Left hand low on 3',
			lessonDay: '2026-01-04'
		});
	});
});

describe('From this lesson', () => {
	const lesson = () =>
		createLesson(db, U1_SALSA, { lessonDay: '2026-01-05', title: 'Rueda', notes: null }, 3).lesson
			.id;
	const figure = {
		figureName: 'Enchufla',
		name: 'Doble',
		partner: 'partner',
		style: 'salsa',
		notes: 'Turn her on 5.'
	};
	const madeFigure = () =>
		createFigure(db, U1_SALSA, { ...figure, partner: 'partner', style: 'salsa', notes: null })!;

	it('puts a missing figure name under Figure name, keeping what was typed', async () => {
		const result = await call(
			lessonActions.newFigure,
			post('salsa', { ...figure, figureName: ' ' }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'newFigure',
				field: 'figureName',
				message: 'Give the move a name (up to 200 characters).',
				name: 'Doble',
				notes: 'Turn her on 5.'
			}
		});
	});

	it('puts a missing variation name under Variation name', async () => {
		const result = await call(
			lessonActions.newFigure,
			post('salsa', { ...figure, name: '' }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				field: 'name',
				message: 'Give the figure a name (up to 200 characters).',
				figureName: 'Enchufla'
			}
		});
	});

	it('puts notes over 2000 characters under Notes', async () => {
		const result = await call(
			lessonActions.newFigure,
			post('salsa', { ...figure, notes: 'x'.repeat(2001) }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Notes are up to 2000 characters.' }
		});
	});

	it('refuses a style from the other dance without naming a field', async () => {
		const result = (await call(
			lessonActions.newFigure,
			post('salsa', { ...figure, style: 'sensual' }, lesson())
		)) as { status: number; data: Record<string, unknown> };
		expect(result.status).toBe(400);
		expect(result.data.message).toBe('Pick how it is danced and its style.');
		expect(result.data).not.toHaveProperty('field');
		expect(result.data).toMatchObject({ figureName: 'Enchufla', name: 'Doble' });
	});

	it('puts a taken figure name under Figure name, the message unchanged', async () => {
		madeFigure();
		const result = await call(lessonActions.newFigure, post('salsa', figure, lesson()));
		expect(result).toMatchObject({
			status: 400,
			data: {
				field: 'figureName',
				message: "There's already a move called Enchufla.",
				figureName: 'Enchufla',
				name: 'Doble',
				notes: 'Turn her on 5.'
			}
		});
	});

	it('puts a missing figure under Figure in Variation of a figure', async () => {
		const result = await call(
			lessonActions.newVariation,
			post('salsa', { groupId: '', name: 'Doble', partner: 'partner', style: 'salsa' }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: { action: 'newVariation', field: 'groupId', message: 'Pick a move.', name: 'Doble' }
		});
	});

	it('puts a missing variation name under Variation name in Variation of a figure', async () => {
		const result = await call(
			lessonActions.newVariation,
			post(
				'salsa',
				{ groupId: String(madeFigure().group.id), name: '', partner: 'partner', style: 'salsa' },
				lesson()
			)
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Give the figure a name (up to 200 characters).' }
		});
	});

	it('puts a taken variation name under Variation name, the message unchanged', async () => {
		const groupId = String(madeFigure().group.id);
		const result = await call(
			lessonActions.newVariation,
			post(
				'salsa',
				{ groupId, name: 'Doble', partner: 'partner', style: 'salsa', notes: 'Hold' },
				lesson()
			)
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				field: 'name',
				message: 'Enchufla already has a figure called Doble. Rename one first.',
				groupId,
				notes: 'Hold'
			}
		});
	});

	it('refuses a partner that is not offered without naming a field', async () => {
		const result = (await call(
			lessonActions.newVariation,
			post(
				'salsa',
				{ groupId: String(madeFigure().group.id), name: 'Simple', partner: 'x', style: 'salsa' },
				lesson()
			)
		)) as { status: number; data: Record<string, unknown> };
		expect(result.status).toBe(400);
		expect(result.data.message).toBe('Pick how it is danced and its style.');
		expect(result.data).not.toHaveProperty('field');
	});

	it('puts a blank exercise name under Name, keeping the notes', async () => {
		const result = await call(
			lessonActions.newExercise,
			post('salsa', { name: ' ', everyDays: '3', notes: 'Spot the wall' }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'newExercise',
				field: 'name',
				message: 'Give it a name (up to 200 characters).',
				notes: 'Spot the wall'
			}
		});
	});

	it('makes an exercise without asking how often, with the default first gap', async () => {
		const result = await call(
			lessonActions.newExercise,
			post('salsa', { name: 'Spins', notes: '' }, lesson())
		);
		expect(result).toMatchObject({ action: 'newExercise', ok: true });
		expect(db.select().from(exercises).where(eq(exercises.name, 'Spins')).get()).toMatchObject({
			everyDays: 3
		});
	});

	it('puts a blank routine name under Name', async () => {
		const result = await call(
			lessonActions.newRoutine,
			post('salsa', { name: '', everyDays: '3', notes: 'Rueda calls' }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'newRoutine',
				field: 'name',
				message: 'Give the routine a name (up to 200 characters).',
				notes: 'Rueda calls'
			}
		});
	});

	it('puts routine notes over 2000 characters under Notes', async () => {
		const result = await call(
			lessonActions.newRoutine,
			post('salsa', { name: 'Rueda', everyDays: '3', notes: 'x'.repeat(2001) }, lesson())
		);
		expect(result).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Notes are up to 2000 characters.', name: 'Rueda' }
		});
	});
});
