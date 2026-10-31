/**
 * The New lesson sheet's and the lesson page's Edit refusals: each names the
 * field it is about and hands back everything that was typed. `getDb()` is mocked per test, as in
 * `moves-forms.spec.ts`; nothing opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createLesson, getLesson, listLessons } from '$lib/server/lessons';
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
		expect(listLessons(db, 'salsa')).toEqual([]);
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

	it('refuses a frequency that is not offered without naming a field', async () => {
		const result = (await call(
			listActions.create,
			post('salsa', { title: 'Rueda', notes: '', everyDays: '5', lessonDay: '2026-01-05' })
		)) as { status: number; data: Record<string, unknown> };
		expect(result.status).toBe(400);
		expect(result.data.message).toBe('Pick how often to go over it.');
		expect(result.data).not.toHaveProperty('field');
		expect(result.data).toMatchObject({ title: 'Rueda', lessonDay: '2026-01-05' });
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
		const [lesson] = listLessons(db, 'salsa');
		expect(thrown).toMatchObject({ status: 303, location: `/salsa/lessons/${lesson.id}` });
	});
});

describe('Edit lesson', () => {
	const made = () =>
		createLesson(db, 'salsa', { lessonDay: '2026-01-05', title: 'Rueda', notes: null }, 3).lesson
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
		expect(getLesson(db, id)?.lesson).toMatchObject({ title: 'Rueda', lessonDay: '2026-01-05' });
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
		expect(getLesson(db, id)?.lesson).toMatchObject({
			title: 'Rueda · enchufla',
			notes: 'Left hand low on 3',
			lessonDay: '2026-01-04'
		});
	});
});
