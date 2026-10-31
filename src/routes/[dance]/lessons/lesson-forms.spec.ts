/**
 * The New lesson sheet's refusals: each names the field it is about and hands
 * back everything that was typed. `getDb()` is mocked per test, as in
 * `moves-forms.spec.ts`; nothing opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { listLessons } from '$lib/server/lessons';
import { localDay } from '$lib/day/day';
import { actions as listActions } from './+page.server';

const ZONE = 'Europe/Ljubljana';
const USER = { id: 'u1', email: 'u@example.com', timezone: ZONE };

function post(dance: string, fields: Record<string, string>) {
	return {
		params: { dance },
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
