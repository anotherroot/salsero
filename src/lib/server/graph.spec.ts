import { describe, expect, it } from 'vitest';
import { follows, startsOf } from '$lib/graph/graph';
import { openDb, type Db } from './db';
import { figureStartPositions } from './db/schema';
import { archiveFigure, createFigure } from './figures';
import { buildGraph, figurePositions, setFigurePositions } from './graph';
import { listPositions, seedPositions } from './positions';

const figureInput = (name: string) => ({
	name,
	partner: 'partner' as const,
	style: 'salsa',
	notes: null,
	callable: true,
	callText: null
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

	it('includes a non-callable figure, so the player pool is always a subset', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', { ...figureInput('solo drill'), callable: false })!;
		expect(buildGraph(db, 'salsa').figures.map((f) => f.id)).toContain(made.figure.id);
	});
});

describe('setFigurePositions', () => {
	it('stores many starts, one end and a length, and reads them back', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(
			setFigurePositions(
				db,
				made.figure.id,
				[pos('open-two'), pos('cross-hand')],
				pos('hammerlock-r'),
				2
			)
		).toBe(true);

		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('open-two'), pos('cross-hand')].sort((a, b) => a - b),
			endId: pos('hammerlock-r')
		});
		const g = buildGraph(db, 'salsa');
		expect(g.figures[0].eights).toBe(2);
		expect(g.figures[0].end).toBe(pos('hammerlock-r'));
	});

	it('replaces the starts rather than adding to them', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		setFigurePositions(db, made.figure.id, [pos('open-two'), pos('cross-hand')], null, 1);
		setFigurePositions(db, made.figure.id, [pos('closed')], null, 1);
		expect(figurePositions(db, made.figure.id).startIds).toEqual([pos('closed')]);
	});

	it('refuses a position from the other dance, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;

		expect(setFigurePositions(db, made.figure.id, [bachataShadow.id], null, 1)).toBe(false);
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], bachataShadow.id, 1)).toBe(
			false
		);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endId: null });
	});

	it('refuses a length outside 1-8 and a missing figure', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], null, 0)).toBe(false);
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], null, 9)).toBe(false);
		expect(setFigurePositions(db, 9999, [pos('open-two')], null, 1)).toBe(false);
	});

	it('rejects a duplicate (figure, position) row at the database level', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const row = { figureId: made.figure.id, positionId: pos('open-two') };
		db.insert(figureStartPositions).values(row).run();
		// The composite primary key is the backstop for the de-duplication
		// `setFigurePositions` does in code. Nothing else in the suite reaches it.
		expect(() => db.insert(figureStartPositions).values(row).run()).toThrow();
	});

	it('de-duplicates a repeated start position rather than throwing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const open = pos('open-two');
		expect(setFigurePositions(db, made.figure.id, [open, open], null, 1)).toBe(true);
		expect(figurePositions(db, made.figure.id).startIds).toEqual([open]);
	});
});
