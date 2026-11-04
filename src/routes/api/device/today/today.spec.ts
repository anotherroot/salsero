/**
 * The Android reminder's count: what is due for the person asking, their own
 * exercises and their entries on a group's things, never another member's
 * entries for the same group things. The database is mocked (see CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import { createCustomExercise } from '$lib/server/exercises';
import { addLesson } from '$lib/server/entries';
import { createLesson, linkExercise } from '$lib/server/lessons';
import { createTeam, joinTeam } from '$lib/server/teams';
import { U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { GET } from './+server';

const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: true };
const U2 = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	if (!made.ok) throw new Error('team expected');
	joinTeam(db, 'u2', made.teamId, 2);
	const T = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
	const P = createLesson(db, T, { lessonDay: '2026-11-01', title: 'Class', notes: null }).lesson.id;
	const drill = createCustomExercise(db, T, { name: 'Group shines', everyDays: 3, notes: null }).id;
	linkExercise(db, P, drill, 'u1');
	db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, P)).run();
	// Both add the lesson's drill; only u2 adds the review. Each has one of their own.
	addLesson(db, 'u1', P, { lesson: false, routineIds: [], drillIds: [drill], figureIds: [] }, 2);
	addLesson(db, 'u2', P, { lesson: true, routineIds: [], drillIds: [drill], figureIds: [] }, 2);
	createCustomExercise(db, U1_SALSA, { name: 'u1 own', everyDays: 1, notes: null });
	createCustomExercise(db, U2_SALSA, { name: 'u2 own', everyDays: 1, notes: null });
});

const due = async (user: typeof U1) => {
	const res = await (GET as unknown as (e: unknown) => Response | Promise<Response>)({
		locals: { user }
	});
	return ((await res.json()) as Record<string, { due: string[] }>).salsa.due.sort();
};

describe('GET /api/device/today', () => {
	// Catches: another member's entry for the same group drill counted, or a group's own drill row.
	it('counts the asker’s own exercises and entries only', async () => {
		expect(await due(U2)).toEqual(['Group shines', 'Review: Class', 'u2 own']);
		expect(await due(U1)).toEqual(['Group shines', 'u1 own']);
	});

	it('is a 401 without a person', () => {
		expect(() => (GET as unknown as (e: unknown) => unknown)({ locals: { user: null } })).toThrow(
			expect.objectContaining({ status: 401 })
		);
	});
});
