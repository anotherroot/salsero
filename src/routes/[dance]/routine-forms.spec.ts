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
import * as routinePage from './(moves)/routines/[id]/+page.server';
import { load as listsLoad } from './(moves)/+layout.server';

/** The Routines list is the layout's. */
const routinesList = {
	load: (e: unknown) =>
		(listsLoad as unknown as (e: unknown) => { lists: { routines: unknown } })({
			...(e as object),
			depends: () => {}
		}).lists.routines
};
import * as playerPage from './player/+page.server';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkFigure, linkRoutine, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import { setFigureShape } from '$lib/server/graph';
import { addPosition } from '$lib/server/test-positions';
import { danceable, factsOf } from '$lib/routines/page';
import type { RowEdges } from '$lib/routines/routines';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana', dance: 'salsa' };

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

describe('positions are optional in routines', () => {
	const T = 1_790_000_000_000;
	type Loaded = {
		positions: { id: number; name: string }[];
		starts: number[];
		ends: number[];
		loops: boolean;
		breaks: number[];
		positionSeams: { after: number; next: number }[];
		timingSeams: unknown[];
		edges: RowEdges[];
	};
	const loadRoutine = (id: number) =>
		(routinePage.load as unknown as (e: unknown) => Loaded)({
			params: { dance: 'salsa', id: String(id) },
			locals: { user: USER },
			url: new URL(`http://localhost/salsa/routines/${id}`),
			cookies: { get: () => undefined }
		});
	const loadList = () =>
		(
			routinesList.load as unknown as (e: unknown) => {
				routines: { id: number; breaks: number; loops: boolean }[];
			}
		)({
			params: { dance: 'salsa' },
			locals: { user: USER },
			cookies: { get: () => undefined }
		});
	/** The facts line as the page words it: names from the graph, nothing for an empty side. */
	const factsLine = (d: Loaded) => {
		const name = new Map(d.positions.map((p) => [p.id, p.name]));
		const names = (ids: number[]) => ids.flatMap((id) => (name.has(id) ? [name.get(id)!] : []));
		return factsOf(names(d.starts), names(d.ends));
	};
	const mine = (figureName: string) =>
		createFigure(db, U1_SALSA, {
			figureName,
			name: 'Basic',
			partner: 'partner',
			notes: null,
			style: 'salsa'
		})!.figure.id;

	it('a routine of untagged figures: no breaks, no seams, loops by its counts, no hand fact', () => {
		// `r` (beforeEach): Enchufla and Setenta, untagged, each 1 → 1.
		const d = loadRoutine(r);
		expect(d.breaks).toEqual([]);
		expect(d.positionSeams).toEqual([]);
		expect(d.timingSeams).toEqual([]);
		expect(d.starts).toEqual([]);
		expect(d.ends).toEqual([]);
		expect(d.loops).toBe(true);
		expect(factsLine(d)).toBeNull();
		// Practise is offered: danceable by its counts.
		expect(danceable(d.edges)).toBe(true);
		expect(loadList().routines.find((x) => x.id === r)).toMatchObject({ breaks: 0, loops: true });

		// The counts alone decide whether it loops: a half (1 → 5) alone does not…
		const half = mine('Half');
		setFigureShape(db, half, { startIds: [], endIds: [], startCount: 1, lengthCounts: 4 });
		const other = mine('Other half');
		setFigureShape(db, other, { startIds: [], endIds: [], startCount: 5, lengthCounts: 4 });
		const one = createRoutineFromFigures(db, U1_SALSA, { name: 'Half', notes: null }, [half])!
			.routine.id;
		expect(loadRoutine(one)).toMatchObject({ loops: false, breaks: [], positionSeams: [] });
		expect(danceable(loadRoutine(one).edges)).toBe(true);
		// …and with the other half (5 → 1) it does, still with no position anywhere.
		const both = createRoutineFromFigures(db, U1_SALSA, { name: 'Both', notes: null }, [
			half,
			other
		])!.routine.id;
		expect(loadRoutine(both)).toMatchObject({ loops: true, breaks: [], positionSeams: [] });
	});

	it('a tagged routine still states its hands', () => {
		const open = addPosition(db, U1_SALSA, 'Abierta');
		const closed = addPosition(db, U1_SALSA, 'Cerrada');
		const x = mine('Dile que no');
		setFigureShape(db, x, { startIds: [closed], endIds: [open], startCount: 1, lengthCounts: 8 });
		const p = createRoutineFromFigures(db, U1_SALSA, { name: 'Tagged', notes: null }, [x])!.routine
			.id;
		const d = loadRoutine(p);
		expect(factsLine(d)).toEqual({ from: 'Cerrada', to: 'Abierta' });
		// It ends in Abierta and starts in Cerrada: the loop back breaks in the hands.
		expect(d.loops).toBe(false);
	});

	it('a person’s figure and a group’s figure of one family: no break', () => {
		const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
		createTeam(db, 'u5', 'salsa', 'Rueda club', T);
		joinTeam(db, 'u1', 1, T);
		// One gene per family: u1's and the group's Cerrada are one hold, as are their Abiertas.
		const myOpen = addPosition(db, U1_SALSA, 'Abierta', { geneId: 'g-open' });
		const myClosed = addPosition(db, U1_SALSA, 'Cerrada', { geneId: 'g-closed' });
		const theirOpen = addPosition(db, EVA, 'Abierta', { geneId: 'g-open' });
		const theirClosed = addPosition(db, EVA, 'Cerrada', { geneId: 'g-closed' });
		// A group position of no family: the control that a break still shows.
		const theirShadow = addPosition(db, EVA, 'Sombra');
		const groupFigure = (figureName: string, starts: number[], ends: number[]) => {
			const id = createFigure(db, EVA, {
				figureName,
				name: 'Doble',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.figure.id;
			expect(
				setFigureShape(
					db,
					id,
					{ startIds: starts, endIds: ends, startCount: 1, lengthCounts: 8 },
					'u5'
				)
			).toBe(true);
			return id;
		};
		const F = groupFigure('Vacilala', [theirClosed], [theirOpen]);
		const H = groupFigure('Sombra', [theirShadow], [theirOpen]);
		const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
			.id;
		linkFigure(db, L, F, 'u5');
		linkFigure(db, L, H, 'u5');
		publishLesson(db, EVA, L, T);
		addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

		const X = mine('Dile que no');
		setFigureShape(db, X, {
			startIds: [myOpen],
			endIds: [myClosed],
			startCount: 1,
			lengthCounts: 8
		});
		// X ends in u1's Cerrada, F starts in the group's: one family, no break; F ends in the
		// group's Abierta and X starts in u1's: it loops.
		const P = createRoutine(db, U1_SALSA, { name: 'Mixed', notes: null }).routine.id;
		expect(addFigureSlot(db, P, X)).not.toBeNull();
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		const d = loadRoutine(P);
		expect(d.breaks).toEqual([]);
		expect(d.positionSeams).toEqual([]);
		expect(d.loops).toBe(true);
		expect(factsLine(d)).toEqual({ from: 'Abierta', to: 'Abierta' });
		expect(loadList().routines.find((x) => x.id === P)).toMatchObject({ breaks: 0, loops: true });

		// The control: H starts in a group hold of no family, so X → H breaks.
		const Q = createRoutine(db, U1_SALSA, { name: 'Broken', notes: null }).routine.id;
		addFigureSlot(db, Q, X);
		addFigureSlot(db, Q, H);
		// (A break is indexed by the slot it leaves.)
		expect(loadRoutine(Q).breaks).toEqual([0]);
		expect(loadRoutine(Q).positionSeams).toEqual([{ after: 0, next: 1 }]);
	});

	it('a member reading a group’s routine is told only its own figures’ position names', () => {
		const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
		createTeam(db, 'u5', 'salsa', 'Rueda club', T);
		joinTeam(db, 'u1', 1, T);
		const open = addPosition(db, EVA, 'Abierta');
		const closed = addPosition(db, EVA, 'Cerrada');
		const secret = addPosition(db, EVA, 'Secreta');
		const fig = (figureName: string, starts: number[], ends: number[]) => {
			const id = createFigure(db, EVA, {
				figureName,
				name: 'Doble',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.figure.id;
			setFigureShape(
				db,
				id,
				{ startIds: starts, endIds: ends, startCount: 1, lengthCounts: 8 },
				'u5'
			);
			return id;
		};
		const G = fig('Vacilala', [closed], [open]);
		// Only a draft holds this one: its position's name must not reach the member.
		fig('Borrador', [secret], [secret]);
		const R = createRoutineFromFigures(db, EVA, { name: 'Club routine', notes: null }, [G])!.routine
			.id;
		const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
			.id;
		linkRoutine(db, L, R, 'u5');
		publishLesson(db, EVA, L, T);

		const d = loadRoutine(R);
		expect(d.positions.map((p) => p.name).sort()).toEqual(['Abierta', 'Cerrada']);
		expect(factsLine(d)).toEqual({ from: 'Cerrada', to: 'Abierta' });

		// The member's player walks the same routine: its graph names no draft's hold either.
		const opened = (
			playerPage.load as unknown as (e: unknown) => {
				graph: { figures: { id: number }[]; positions: { name: string }[] };
			}
		)({
			params: { dance: 'salsa' },
			url: new URL(`http://localhost/salsa/player?routine=${R}`),
			locals: { user: USER }
		});
		expect(opened.graph.figures.map((f) => f.id)).toEqual([G]);
		expect(opened.graph.positions.map((p) => p.name).sort()).toEqual(['Abierta', 'Cerrada']);
		expect(opened.graph).not.toHaveProperty('canon');
	});
});
