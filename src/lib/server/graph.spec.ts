import { describe, expect, it } from 'vitest';
import { follows, startsOf } from '$lib/graph/graph';
import { openDb, type Db } from './db';
import { eq } from 'drizzle-orm';
import { figures, figureStartPositions } from './db/schema';
import { archiveFigure, createFigure } from './figures';
import { buildGraph, figurePositions, setFigureShape } from './graph';
import { archivePosition, listPositions, seedPositions } from './positions';

const figureInput = (name: string) => ({
	name,
	partner: 'partner' as const,
	style: 'salsa',
	notes: null
});

function setup(): { db: Db; pos: (slug: string) => number } {
	const db = openDb(':memory:');
	seedPositions(db);
	const all = listPositions(db, 'salsa');
	return {
		db,
		pos: (slug) => {
			const found = all.find((p) => p.slug === slug);
			if (!found) throw new Error(`no seeded position ${slug}`);
			return found.id;
		}
	};
}

describe('buildGraph', () => {
	it('uses the dance neutral, so an untagged figure connects to everything', () => {
		const { db, pos } = setup();
		createFigure(db, 'salsa', figureInput('enchufla'));
		createFigure(db, 'salsa', figureInput('dile que no'));
		const g = buildGraph(db, 'salsa');

		expect(g.neutral).toBe(pos('open-two'));
		expect(g.figures).toHaveLength(2);
		expect(startsOf(g, g.figures[0])).toEqual([pos('open-two')]);
		expect(follows(g, g.figures[0].id)).toHaveLength(2);
	});

	it('is walled by dance', () => {
		const { db } = setup();
		createFigure(db, 'salsa', figureInput('enchufla'));
		createFigure(db, 'bachata', { ...figureInput('basico'), style: 'dominican' });
		expect(buildGraph(db, 'salsa').figures).toHaveLength(1);
		expect(buildGraph(db, 'bachata').figures).toHaveLength(1);
	});

	it('leaves out archived figures', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		archiveFigure(db, made.figure.id, Date.now());
		expect(buildGraph(db, 'salsa').figures).toEqual([]);
	});
});

/** A shape with neutral timing, so each test only states what it is about. */
const shape = (
	startIds: number[],
	endId: number | null,
	timing: { startCount?: number; lengthCounts?: number } = {}
) => ({ startIds, endId, startCount: 1, lengthCounts: 8, ...timing });

describe('setFigureShape', () => {
	it('stores starts, end and timing, and the graph reads them back', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(
			setFigureShape(
				db,
				made.figure.id,
				shape([pos('open-two'), pos('cross-hand')], pos('hammerlock-r'), {
					startCount: 5,
					lengthCounts: 12
				})
			)
		).toBe(true);

		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('open-two'), pos('cross-hand')].sort((a, b) => a - b),
			endId: pos('hammerlock-r')
		});
		const g = buildGraph(db, 'salsa');
		expect(g.figures[0]).toMatchObject({ start: 5, length: 12, end: pos('hammerlock-r') });
	});

	it('replaces the starts rather than adding to them', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		setFigureShape(db, made.figure.id, shape([pos('open-two'), pos('cross-hand')], null));
		setFigureShape(db, made.figure.id, shape([pos('closed')], null));
		expect(figurePositions(db, made.figure.id).startIds).toEqual([pos('closed')]);
	});

	it('refuses a position from the other dance, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;

		expect(setFigureShape(db, made.figure.id, shape([bachataShadow.id], null))).toBe(false);
		expect(
			setFigureShape(
				db,
				made.figure.id,
				shape([pos('open-two')], bachataShadow.id, { startCount: 5 })
			)
		).toBe(false);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endId: null });
		// The timing half of the refused write did not land either.
		expect(buildGraph(db, 'salsa').figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('refuses timing out of range and a missing figure, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const id = made.figure.id;
		const open = [pos('open-two')];
		expect(setFigureShape(db, id, shape(open, null, { startCount: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { startCount: 9 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { startCount: 1.5 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { lengthCounts: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { lengthCounts: 65 }))).toBe(false);
		expect(setFigureShape(db, 9999, shape(open, null))).toBe(false);
		expect(figurePositions(db, id).startIds).toEqual([]);
	});

	it('rejects a duplicate (figure, position) row at the database level', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const row = { figureId: made.figure.id, positionId: pos('open-two') };
		db.insert(figureStartPositions).values(row).run();
		// The composite primary key is the backstop for the de-duplication
		// `setFigureShape` does in code. Nothing else in the suite reaches it.
		expect(() => db.insert(figureStartPositions).values(row).run()).toThrow();
	});

	it('de-duplicates a repeated start position rather than throwing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const open = pos('open-two');
		expect(setFigureShape(db, made.figure.id, shape([open, open], null))).toBe(true);
		expect(figurePositions(db, made.figure.id).startIds).toEqual([open]);
	});

	it('keeps a tag pointing at a position after it is archived', () => {
		// The authority spec: "An archived position stays referenced by the
		// figures tagged with it, so history and existing routines keep meaning."
		// A page round-trip re-posts the SAME ids on every save, archived or not,
		// so this is what that save must not lose.
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const crossHand = pos('cross-hand'); // not the neutral row, so it can be archived
		expect(setFigureShape(db, made.figure.id, shape([crossHand], crossHand))).toBe(true);
		expect(archivePosition(db, crossHand, Date.now())).toBe(true);
		expect(setFigureShape(db, made.figure.id, shape([crossHand], crossHand))).toBe(true);
		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [crossHand],
			endId: crossHand
		});
	});
});

describe('timing defaults', () => {
	it('stores a new figure as 8 counts, and reads a null start as 1', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		expect(made.figure.lengthCounts).toBe(8);
		expect(made.figure.startCount).toBeNull();
		expect(buildGraph(db, 'salsa').figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('reads a null length as 8 — a row the backfill or createFigure never touched', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		db.update(figures).set({ lengthCounts: null }).where(eq(figures.id, made.figure.id)).run();
		expect(buildGraph(db, 'salsa').figures[0].length).toBe(8);
	});
});
