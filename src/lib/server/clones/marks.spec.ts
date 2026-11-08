/** Marks: what a copy held (a hash per field) after its last save or flow. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { appFlags, cloneMarks, figures, users } from '../db/schema';
import { createTeam } from '../teams';
import { createFigure } from '../figures';
import { NO_FILES, T1_SALSA, U1_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import { flatOf } from './trees';
import { hashValue } from './pairs';
import { markFamilies, markNow, readMark } from './marks';

/** A row whose flat cannot be read: `flatOf` throws for it (a bad row on the live data). */
const bad = vi.hoisted(() => ({ id: null as number | null }));
vi.mock('./trees', async (real) => {
	const trees = await real<typeof import('./trees')>();
	return {
		...trees,
		flatOf: (...args: Parameters<typeof trees.flatOf>) => {
			if (args[2] === bad.id) throw new Error('unreadable row');
			return trees.flatOf(...args);
		}
	};
});

const T = Date.UTC(2026, 10, 7, 12);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

beforeEach(() => {
	bad.id = null;
	db = openDb(':memory:');
	db.insert(users)
		.values([{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' }])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
});

const figure = (space: typeof U1_SALSA | typeof T1_SALSA, move: string) =>
	createFigure(db, space, { figureName: move, name: 'Basic', ...shape })!.figure.id;

function expected(kind: 'figure', id: number) {
	const flat = flatOf(db, kind, id);
	return Object.fromEntries(Object.entries(flat).map(([k, f]) => [k, hashValue(f.value)]));
}

describe('marks', () => {
	it('markNow then readMark returns a hash per field of the flat', () => {
		const id = figure(U1_SALSA, 'Enchufla');
		expect(readMark(db, 'figure', id)).toBeNull();
		markNow(db, 'figure', id, T);
		const mark = readMark(db, 'figure', id)!;
		expect(Object.keys(mark).length).toBeGreaterThan(0);
		expect(mark).toEqual(expected('figure', id));
	});

	it('markNow replaces an older mark', () => {
		const id = figure(U1_SALSA, 'Enchufla');
		markNow(db, 'figure', id, T);
		db.update(figures).set({ notes: 'new' }).where(eq(figures.id, id)).run();
		markNow(db, 'figure', id, T + 1);
		expect(readMark(db, 'figure', id)).toEqual(expected('figure', id));
		expect(db.select().from(cloneMarks).all()).toHaveLength(1);
	});

	it('markFamilies marks the members of a copied figure, not a lone one, once', async () => {
		const src = figure(U1_SALSA, 'Enchufla');
		const lone = figure(U1_SALSA, 'Setenta');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src, into: T1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('clone failed');
		db.delete(cloneMarks).run();
		expect(markFamilies(db, T)).toEqual({ ran: true, marked: 2 });
		expect(readMark(db, 'figure', src)).toEqual(expected('figure', src));
		expect(readMark(db, 'figure', r.id)).toEqual(expected('figure', r.id));
		expect(readMark(db, 'figure', lone)).toBeNull();
		expect(markFamilies(db, T)).toEqual({ ran: false, marked: 0 });
	});

	it('markFamilies skips a row it cannot read, marks the others and sets the flag', async () => {
		const src = figure(U1_SALSA, 'Enchufla');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src, into: T1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('clone failed');
		db.delete(cloneMarks).run();
		bad.id = src;
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			expect(markFamilies(db, T)).toEqual({ ran: true, marked: 1 });
			expect(errors).toHaveBeenCalledWith(expect.stringContaining(`figure ${src}`));
		} finally {
			errors.mockRestore();
		}
		expect(readMark(db, 'figure', src)).toBeNull();
		bad.id = null;
		expect(readMark(db, 'figure', r.id)).toEqual(expected('figure', r.id));
		expect(db.select().from(appFlags).where(eq(appFlags.key, 'clone-marks-1')).get()).toBeDefined();
	});

	it('cloneInto marks the source and the copy', async () => {
		const src = figure(U1_SALSA, 'Enchufla');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src, into: T1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('clone failed');
		expect(readMark(db, 'figure', src)).toEqual(expected('figure', src));
		expect(readMark(db, 'figure', r.id)).toEqual(expected('figure', r.id));
	});
});
