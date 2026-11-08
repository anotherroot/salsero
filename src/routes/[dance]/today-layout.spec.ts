/**
 * Today's list is the (today) layout's load, and it must never read `url`:
 * SvelteKit reruns a load that read it on every change of the URL, so opening
 * an exercise, a session's flag or a past day would reload the whole list
 * beside it. The page's load is the one that reads `?day=`.
 *
 * Like `dance-wall.spec.ts`, `getDb()` is mocked: each test gets its own
 * `openDb(':memory:')` and nothing ever opens the real database.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb } from '$lib/server/db';
import { createCustomExercise, logSet } from '$lib/server/exercises';
import { localDay, noonOf, shiftDay } from '$lib/day/day';
import { U1_SALSA } from '$lib/server/test-walls';
import { load } from './(today)/+layout.server';

const USER = {
	id: 'u1',
	email: 'u@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'salsa',
	isAdmin: true
};

beforeEach(() => {
	handle.db = openDb(':memory:');
});

describe("Today's layout load", () => {
	it('loads the list without reading the URL', () => {
		createCustomExercise(handle.db as never, U1_SALSA, {
			name: 'Clave',
			everyDays: 2,
			notes: null
		});
		const read: string[] = [];
		const event = new Proxy(
			{ params: { dance: 'salsa' }, locals: { user: USER }, depends: () => {} },
			{
				get(target, key) {
					read.push(String(key));
					if (key === 'url') throw new Error('the layout load read url');
					return Reflect.get(target, key);
				}
			}
		);
		const data = (load as unknown as (e: unknown) => { list: { day: { rows: unknown[] } } })(event);
		expect(data.list.day.rows).toHaveLength(1);
		expect(read).not.toContain('url');
		expect(read).not.toContain('route');
	});

	it("names what reloads it, and the phone's fresh visit reloads that", () => {
		const names: string[] = [];
		(load as unknown as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			locals: { user: USER },
			depends: (...ids: string[]) => names.push(...ids)
		});
		expect(names).toEqual(['today:list']);
		// Back from an exercise on the phone: the list page's own load used to run.
		expect(readFileSync('src/routes/[dance]/(today)/+layout.svelte', 'utf8')).toContain(
			"invalidate('today:list')"
		);
	});
});

describe("Today's day", () => {
	const loadAs = () =>
		(
			load as unknown as (e: unknown) => {
				list: { day: { rows: { kind: string }[]; total: number; left: number; showNext: boolean } };
			}
		)({ params: { dance: 'salsa' }, locals: { user: USER }, depends: () => {} });

	it('shows the daily number of the due ones: 5 rows for 7 due', () => {
		for (let i = 1; i <= 7; i++)
			createCustomExercise(handle.db as never, U1_SALSA, {
				name: `E${i}`,
				everyDays: 3,
				notes: null
			});
		const { day } = loadAs().list;
		expect(day.rows).toHaveLength(5);
		expect(day.rows.every((r) => r.kind === 'todo')).toBe(true);
		expect(day.total).toBe(5);
		expect(day.left).toBe(5);
		expect(day.showNext).toBe(false);
	});
});

describe('Coming up (the layout load)', () => {
	const loadComing = () =>
		(
			load as unknown as (e: unknown) => {
				list: { coming: { key: string; rows: { exercise: { name: string }; state: string }[] }[] };
			}
		)({ params: { dance: 'salsa' }, locals: { user: USER }, depends: () => {} });

	it('puts what is due past the daily number in Waiting', () => {
		for (let i = 1; i <= 7; i++)
			createCustomExercise(handle.db as never, U1_SALSA, {
				name: `E${i}`,
				everyDays: 3,
				notes: null
			});
		const { coming } = loadComing().list;
		expect(coming[0].key).toBe('waiting');
		expect(coming[0].rows).toHaveLength(2);
		expect(coming[0].rows.every((r) => r.state === 'add')).toBe(true);
	});

	it('is empty with no exercise', () => {
		expect(loadComing().list.coming).toEqual([]);
	});
});

describe("Today's time estimate (the layout load)", () => {
	const estimate = () =>
		(load as unknown as (e: unknown) => { list: { estimateS: number | null } })({
			params: { dance: 'salsa' },
			locals: { user: USER },
			depends: () => {}
		}).list.estimateS;
	const everyDay = (name: string) =>
		createCustomExercise(handle.db as never, U1_SALSA, {
			name,
			notes: null,
			comesBack: { kind: 'every', days: 1 }
		});

	it('adds up the typical time of what is still to walk', () => {
		const e = everyDay('Timed');
		logSet(handle.db as never, {
			exerciseId: e.id,
			doneAt: noonOf(shiftDay(localDay(Date.now(), USER.timezone), -1), USER.timezone),
			durationS: 600,
			reps: null,
			rating: null,
			playerJson: null
		});
		expect(estimate()).toBe(600);
	});
	it('is null when nothing to walk was ever timed', () => {
		everyDay('Never timed');
		expect(estimate()).toBeNull();
	});
});
