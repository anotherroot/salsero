/**
 * The routine page's Make routine refusals: a missing name belongs under the
 * Name field; a run that cannot become a routine is the sheet's banner.
 * `getDb()` is mocked, as in `dance-wall.spec.ts`.
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
import {
	addChildSlot,
	addFigureSlot,
	createRoutine,
	createRoutineFromFigures,
	getRoutine,
	routineSlots
} from '$lib/server/routines';
import * as routinePage from './routines/[id]/+page.server';
import * as routinesList from './routines/+page.server';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkFigure, linkRoutine, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';

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
	r = createRoutine(db, U1_SALSA, { name: 'Friday', notes: null }).routine.id;
	other = createRoutine(db, U1_SALSA, { name: 'Other', notes: null }).routine.id;
	const make = (figureName: string) =>
		createFigure(db, U1_SALSA, {
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

describe('a personal routine that uses a group’s figure and routine', () => {
	const T = 1_790_000_000_000;
	/** Eva's group; u1 is a member and added the published lesson that links F and R (options G). */
	const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
	type RoutineData = {
		labels: Record<number, string>;
		groupFigures: Record<number, { team: string; name: string }>;
		candidates: { kind: string; id: number }[];
		childSlots: Record<number, number>;
		edges: { starts: number[] }[];
	};
	const loadRoutine = (id: number) =>
		(routinePage.load as unknown as (e: unknown) => RoutineData)({
			params: { dance: 'salsa', id: String(id) },
			locals: { user: USER },
			url: new URL(`http://localhost/salsa/routines/${id}`)
		});
	const loadList = () =>
		(
			routinesList.load as unknown as (e: unknown) => {
				routines: { id: number; breaks: number }[];
			}
		)({
			params: { dance: 'salsa' },
			locals: { user: USER },
			cookies: { get: () => undefined }
		});

	it('names the group’s figure, offers the group’s routine, and counts no false break', () => {
		createTeam(db, 'u5', 'salsa', 'Rueda club', T);
		joinTeam(db, 'u1', 1, T);
		const fig = (figureName: string) =>
			createFigure(db, EVA, {
				figureName,
				name: 'Doble',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.figure.id;
		const F = fig('Dile que no');
		const G = fig('Vacilala');
		const R = createRoutineFromFigures(db, EVA, { name: 'Club routine', notes: null }, [G])!.routine
			.id;
		const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
			.id;
		linkFigure(db, L, F, 'u5');
		linkRoutine(db, L, R, 'u5');
		publishLesson(db, EVA, L, T);
		addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

		const P = createRoutine(db, U1_SALSA, { name: 'Mixed', notes: null }).routine.id;
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		const data = loadRoutine(P);
		expect(data.labels[F]).toBe('Dile que no · Doble');
		expect(data.groupFigures).toEqual({ [F]: { team: 'Rueda club', name: 'Dile que no' } });
		expect(data.candidates).toContainEqual(expect.objectContaining({ kind: 'routine', id: R }));
		// Untagged figures fit anywhere: two in a row never break.
		expect(loadList().routines.find((r) => r.id === P)?.breaks).toBe(0);

		expect(addChildSlot(db, P, R)).not.toBeNull();
		expect(loadRoutine(P).childSlots[R]).toBe(1);
	});
});
