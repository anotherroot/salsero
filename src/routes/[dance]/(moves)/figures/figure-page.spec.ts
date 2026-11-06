/**
 * What a group's figure page shows a member: where they got it, their own
 * routines that use it, their own sections linked to it. `getDb()` is mocked
 * as in `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA } from '$lib/server/test-walls';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createFigure } from '$lib/server/figures';
import { addFigureSlot, createRoutine, createRoutineFromFigures } from '$lib/server/routines';
import { createTeam, joinTeam } from '$lib/server/teams';
import { addLessonVideo, createLesson, linkFigure, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import { addSpot } from '$lib/server/spots';
import { linkSpot } from '$lib/server/spot-links';
import * as figurePage from './[id]/+page.server';

const T = 1_790_000_000_000;
const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
const user = (id: string) => ({
	id,
	email: `${id}@example.com`,
	timezone: 'Europe/Ljubljana',
	dance: 'salsa'
});

type Data = {
	fromLesson: string | null;
	team: { id: number; name: string } | null;
	myRoutines: { id: number; name: string }[];
	routines: { id: number; name: string }[];
	variation: { sections: { spot: { id: number } }[] };
};
const loadAs = (id: string, figure: number, cookie?: string) =>
	(figurePage.load as unknown as (e: unknown) => Data)({
		params: { dance: 'salsa', id: String(figure) },
		url: new URL('http://localhost/'),
		locals: { user: user(id) },
		cookies: { get: (n: string) => (n === 'group_salsa' ? cookie : undefined), delete: () => {} }
	});

let db: Db;
let F: number;
let mine: number;
let section: number;
let L: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u5', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u1', 1, T);
	F = createFigure(db, EVA, {
		figureName: 'Setenta',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'Week 6', notes: null }).lesson.id;
	linkFigure(db, L, F, 'u5');
	publishLesson(db, EVA, L, T);
	addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

	// The group's own routine uses it too; u1's own routine and section as well.
	createRoutineFromFigures(db, EVA, { name: 'Club routine', notes: null }, [F]);
	mine = createRoutine(db, U1_SALSA, { name: 'Mixed', notes: null }).routine.id;
	addFigureSlot(db, mine, F);
	const own = createLesson(db, U1_SALSA, { lessonDay: '2026-11-04', title: 'Mine', notes: null })
		.lesson.id;
	const video = addLessonVideo(db, {
		lessonId: own,
		file: 'm.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 2000, label: 'Mine' })!.id;
	linkSpot(db, 'u1', section, { figureId: F });
});

describe('a group’s figure page', () => {
	it('tells a member where they got it, with their own routines and sections', () => {
		const data = loadAs('u1', F);
		expect(data.fromLesson).toBe('Week 6');
		expect(data.team).toEqual({ id: 1, name: 'Salsa Tuesdays' });
		expect(data.myRoutines.map((r) => r.id)).toEqual([mine]);
		expect(data.variation.sections.map((s) => s.spot.id)).toContain(section);
		// The group's own list stays the group's.
		expect(data.routines.map((r) => r.name)).toEqual([]);
	});

	it('shows the owner none of it', () => {
		const data = loadAs('u5', F);
		expect(data.fromLesson).toBeNull();
		expect(data.myRoutines).toEqual([]);
		expect(data.variation.sections.map((s) => s.spot.id)).not.toContain(section);
	});

	it('shows an editor their own section and routine outside group mode, not in the group’s mode', () => {
		const E = { id: 'u5', dance: 'salsa' as const };
		const wall = { userId: E.id, dance: E.dance };
		const routine = createRoutine(db, wall, { name: 'Eva’s own', notes: null }).routine.id;
		addLesson(db, 'u5', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);
		addFigureSlot(db, routine, F);
		const own = createLesson(db, wall, { lessonDay: '2026-11-04', title: 'Mine', notes: null })
			.lesson.id;
		const video = addLessonVideo(db, {
			lessonId: own,
			file: 'e.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const spot = addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 1000, label: 'E' })!.id;
		linkSpot(db, 'u5', spot, { figureId: F });
		const ids = (d: Data) => d.variation.sections.map((x) => x.spot.id);
		const outside = loadAs('u5', F);
		expect(ids(outside)).toContain(spot);
		expect(outside.myRoutines.map((r) => r.id)).toEqual([routine]);
		const inMode = loadAs('u5', F, '1');
		expect(ids(inMode)).not.toContain(spot);
		expect(inMode.myRoutines).toEqual([]);
	});
});
