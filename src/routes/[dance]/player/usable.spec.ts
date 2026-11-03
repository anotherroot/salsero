/**
 * The player walks a person's own routine that uses a group's figure (clones
 * Task 13): the figure is on the person's graph and the voice has its name.
 * `getDb()` is mocked, as in `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { createFigure } from '$lib/server/figures';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkFigure, linkRoutine, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import {
	addChildSlot,
	addFigureSlot,
	createRoutine,
	createRoutineFromFigures
} from '$lib/server/routines';
import * as playerPage from './+page.server';

const T = 1_790_000_000_000;
const U2 = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana' };

type PlayerData = {
	routine: { id: number; shape: { slots: unknown[] }; figureIds: number[] } | null;
	callNames: { id: number; name: string; say: string }[];
	graph: { figures: { id: number }[] };
};
const player = (query: string) =>
	(playerPage.load as unknown as (e: unknown) => PlayerData)({
		params: { dance: 'salsa' },
		url: new URL(`http://localhost/salsa/player?${query}`),
		locals: { user: U2 }
	});

let db: Db;
let F: number;
let G: number;
let R: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	const fig = (figureName: string) =>
		createFigure(db, T1_SALSA, {
			figureName,
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
	F = fig('Enchufla');
	G = fig('Setenta');
	R = createRoutineFromFigures(db, T1_SALSA, { name: 'Class routine', notes: null }, [G])!.routine
		.id;
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
		.id;
	linkFigure(db, L, F, 'u1');
	linkRoutine(db, L, R, 'u1');
	publishLesson(db, T1_SALSA, L, T);
	addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);
});

describe('the player and a group’s figure in a personal routine', () => {
	it('calls the group’s figure by name', () => {
		const P = createRoutine(db, U2_SALSA, { name: 'Friday', notes: null }).routine.id;
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		const data = player(`routine=${P}`);
		expect(data.routine).toMatchObject({ id: P, figureIds: [F] });
		expect(data.callNames).toEqual([{ id: F, name: 'Enchufla · Doble', say: 'Enchufla' }]);
		expect(data.graph.figures.map((f) => f.id)).toContain(F);
	});

	it('walks an embedded group routine', () => {
		const P = createRoutine(db, U2_SALSA, { name: 'Friday', notes: null }).routine.id;
		expect(addChildSlot(db, P, R)).not.toBeNull();
		const data = player(`routine=${P}`);
		expect(data.routine?.figureIds).toEqual([G]);
		expect(data.callNames.map((c) => c.id)).toEqual([G]);
		expect(data.graph.figures.map((f) => f.id)).toContain(G);
	});
});
