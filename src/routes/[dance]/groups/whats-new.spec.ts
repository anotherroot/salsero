/** Where "new" shows: the Groups dot, a group's pill, a lesson's marker. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { lessons, opens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson } from '$lib/server/lessons';
import { T1_SALSA } from '$lib/server/test-walls';
import { load as layoutLoad } from '../+layout.server';
import { load as listLoad } from './+page.server';
import { load as pageLoad } from './[id]/+page.server';

let db: Db;
let lessonId: number;

const locals = {
	user: { id: 'u2', timezone: 'Europe/Ljubljana', role: 'user' }
} as unknown as App.Locals;
const cookies = { get: () => undefined, set: () => {}, delete: () => {} } as unknown as Cookies;
const run = (fn: unknown, params: Record<string, string>, path = '/salsa/groups') =>
	(fn as (e: unknown) => unknown)({
		params,
		locals,
		cookies,
		url: new URL(`http://x${path}`)
	}) as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
	lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null }).lesson
		.id;
	db.update(lessons).set({ publishedAt: 5 }).where(eq(lessons.id, lessonId)).run();
});

describe('new in a person’s groups', () => {
	it('shows on the list, the group page and the layout', async () => {
		const list = await run(listLoad, { dance: 'salsa' });
		expect(list.teams[0].newCount).toBe(1);
		const page = await run(pageLoad, { dance: 'salsa', id: '1' }, '/salsa/groups/1');
		expect(page.lessons.find((l: { id: number }) => l.id === lessonId).isNew).toBe(true);
		expect((await run(layoutLoad, { dance: 'salsa' })).groupsNew).toBe(true);
	});

	it('does not count the lesson being opened, and clears once opened', async () => {
		const path = `/salsa/lessons/${lessonId}`;
		expect((await run(layoutLoad, { dance: 'salsa' }, path)).groupsNew).toBe(false);
		db.insert(opens).values({ userId: 'u2', kind: 'lesson', itemId: lessonId, openedAt: 9 }).run();
		expect((await run(listLoad, { dance: 'salsa' })).teams[0].newCount).toBe(0);
	});
});
