/**
 * Twins show as one (board C7 p3): the Figures tab folds a person's twin sets,
 * the figure page has a tab per twin, and group mode folds nothing. `getDb()`
 * is mocked as in `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createFigure, createVariationIn } from '$lib/server/figures';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { createLesson, linkFigure, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import { markTwins } from '$lib/server/twins';
import { U2_SALSA } from '$lib/server/test-walls';
import { cloneSubtitle } from '$lib/clones/view';
import { groupCookie } from '$lib/teams/mode';
import { load as layoutLoad } from '../+layout.server';
import { figuresView, type FiguresLists } from '$lib/moves/filter';
import { load as figureLoad } from './[id]/+page.server';

const T = 1_790_000_000_000;
const TUE = { teamId: 1, actorId: 'u1', dance: 'salsa' } as const;
const RUEDA = { teamId: 2, actorId: 'u1', dance: 'salsa' } as const;
const user = (id: string) => ({ id, email: `${id}@example.com`, timezone: 'Europe/Ljubljana' });
const cookies = (mode?: string) => ({
	get: (n: string) => (n === groupCookie('salsa') ? mode : undefined),
	set: () => {},
	delete: () => {}
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
/** The Figures list as the page shows it: the layout's unfiltered list through the pure view. */
const listAs = (id: string, mode?: string): Loose => {
	const l = (layoutLoad as unknown as (e: unknown) => { lists: { figures: FiguresLists } })({
		params: { dance: 'salsa' },
		url: new URL('http://localhost/salsa/figures'),
		locals: { user: user(id) },
		cookies: cookies(mode),
		depends: () => {}
	}).lists.figures;
	return { ...l, ...figuresView(l, { q: '' }) };
};
const pageAs = (id: string, figure: number, mode?: string) =>
	(figureLoad as unknown as (e: unknown) => Loose)({
		params: { dance: 'salsa', id: String(figure) },
		url: new URL('http://localhost/'),
		locals: { user: user(id) },
		cookies: cookies(mode)
	});

let db: Db;
const f = {} as Record<'doble' | 'basica' | 'tueBasica' | 'sombrero' | 'ruedaDoble', number>;

const make = (space: Parameters<typeof createFigure>[1], figureName: string, name: string) =>
	createFigure(db, space, { figureName, name, partner: 'partner', style: 'salsa', notes: null })!;

/** A published lesson of the group, teaching these, that u2 added. */
const teach = (space: typeof TUE | typeof RUEDA, ids: number[]) => {
	const l = createLesson(db, space, { lessonDay: '2026-11-03', title: 'Week', notes: null }).lesson
		.id;
	for (const id of ids) linkFigure(db, l, id, 'u1');
	publishLesson(db, space, l, T);
	addLesson(db, 'u2', l, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);
};

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u1', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u2', 2, T);
	setRole(db, 1, 'u2', 'editor');

	// Board C7 p3: u2's Enchufla (Doble, Básica); Salsa Tuesdays' Enchufla
	// (Básica) and Sombrero; Rueda club's Enchufla (Doble).
	const mine = make(U2_SALSA, 'Enchufla', 'Doble');
	f.doble = mine.figure.id;
	f.basica = createVariationIn(db, mine.group.id, {
		name: 'Básica',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.id;
	f.tueBasica = make(TUE, 'Enchufla', 'Básica').figure.id;
	f.sombrero = make(TUE, 'Sombrero', 'Basic').figure.id;
	f.ruedaDoble = make(RUEDA, 'Enchufla', 'Doble').figure.id;
	teach(TUE, [f.tueBasica, f.sombrero]);
	teach(RUEDA, [f.ruedaDoble]);
	expect(markTwins(db, U2_SALSA, 'figure', [f.doble, f.ruedaDoble])).toBe(true);
	expect(markTwins(db, U2_SALSA, 'figure', [f.basica, f.tueBasica])).toBe(true);
});

const shape = (moves: Loose[]) =>
	moves.map((m) => [m.name, m.figures.map((x: Loose) => x.id), m.also]);

describe('the Figures tab folds twins', () => {
	it('board C7 p3: your move says where else it is, the groups keep the rest', () => {
		// The groups in the order the tab shows them: by name.
		const data = listAs('u2');
		expect(shape(data.figures)).toEqual([
			['Enchufla', [f.doble, f.basica], ['Rueda club', 'Salsa Tuesdays']]
		]);
		expect(data.groups.map((g: Loose) => [g.team.name, shape(g.moves)])).toEqual([
			['Salsa Tuesdays', [['Sombrero', [f.sombrero], []]]]
		]);
		expect([...data.twinned].sort()).toEqual([f.doble, f.basica].sort());
	});

	it('in group mode folds nothing: the group’s own figures, no chip', () => {
		const data = listAs('u2', '1');
		expect(shape(data.figures)).toEqual([
			['Enchufla', [f.tueBasica], []],
			['Sombrero', [f.sombrero], []]
		]);
		expect(data.twinned).toEqual([]);
	});
});

describe('the figure page of a twin', () => {
	it('two twins: three tabs, and "Twins · 3 versions"', () => {
		expect(markTwins(db, U2_SALSA, 'figure', [f.basica, f.sombrero])).toBe(true);
		const data = pageAs('u2', f.basica);
		expect(data.sources.map((s: Loose) => [s.id, s.label, s.relation, s.status])).toEqual([
			[f.basica, 'Yours', 'self', null],
			[f.tueBasica, 'Salsa Tuesdays', 'twin', null],
			[f.sombrero, 'Salsa Tuesdays 2', 'twin', null]
		]);
		expect(cloneSubtitle(data.cloneLine)).toBe('Twins · 3 versions');
	});

	it('in group mode the group’s figure has no twin tab and no Same as…', () => {
		expect(pageAs('u2', f.tueBasica).sources).toHaveLength(2);
		const data = pageAs('u2', f.tueBasica, '1');
		expect(data.sources).toEqual([]);
		expect(data.sameAs).toBeNull();
		expect(data.cloneLine.twins).toBe(0);
	});
});

describe('the routine picker', () => {
	it('offers a twin set once, as yours, with the twin behind it', async () => {
		const { createRoutine } = await import('$lib/server/routines');
		const { load: routineLoad } = await import('../routines/[id]/+page.server');
		const r = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null }).routine.id;
		const data = (routineLoad as unknown as (e: unknown) => Loose)({
			params: { dance: 'salsa', id: String(r) },
			url: new URL('http://localhost/'),
			locals: { user: user('u2') },
			cookies: cookies()
		});
		const ids = data.candidates.map((c: Loose) => c.id);
		expect(ids).toEqual(expect.arrayContaining([f.doble, f.basica, f.sombrero]));
		expect(ids).not.toContain(f.ruedaDoble);
		expect(ids).not.toContain(f.tueBasica);
		const doble = data.candidates.find((c: Loose) => c.id === f.doble);
		expect(doble.twins.map((t: Loose) => t.id)).toEqual([f.ruedaDoble]);
	});
});
