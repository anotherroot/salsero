/**
 * The Routines list shows the routines of lessons the person added, under
 * their group. `getDb()` is mocked, as in `dance-wall.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import { addLesson } from '$lib/server/entries';
import { createLesson, linkRoutine } from '$lib/server/lessons';
import { createRoutine } from '$lib/server/routines';
import { createTeam, joinTeam } from '$lib/server/teams';
import { T1_SALSA } from '$lib/server/test-walls';
import { load } from './+page.server';

describe('Routines page', () => {
	it('shows a routine from an added lesson under its group', async () => {
		const db = openDb(':memory:');
		handle.db = db;
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		joinTeam(db, 'u2', 1, 2);
		const R = createRoutine(db, T1_SALSA, { name: 'Group routine', notes: null }).routine;
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'L',
			notes: null
		}).lesson;
		linkRoutine(db, lesson.id, R.id, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson.id)).run();
		addLesson(
			db,
			'u2',
			lesson.id,
			{ lesson: true, routineIds: [], drillIds: [], figureIds: [] },
			5
		);

		const data = (await load({
			params: { dance: 'salsa' },
			cookies: { get: () => undefined, delete: () => {} },
			locals: { user: { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana' } }
		} as never)) as { routines: unknown[]; groups: { routines: { id: number }[] }[] };
		expect(data.routines).toEqual([]);
		expect(data.groups[0].routines[0].id).toBe(R.id);
	});
});
