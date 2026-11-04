import { describe, expect, it } from 'vitest';
import { follows } from '$lib/graph/graph';
import { openDb, type Db } from './db';
import { eq } from 'drizzle-orm';
import {
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	positions
} from './db/schema';
import { archiveVariation, createFigure, createVariationFrom } from './figures';
import {
	buildGraph,
	canonicalOf,
	figurePositions,
	graphFor,
	setFigureShape,
	taggedFigures
} from './graph';
import { listPositions } from './positions';
import { addPosition, seedPositions } from './test-positions';
import { T1_SALSA, U1_SALSA, U1_BACHATA, U2_SALSA } from '$lib/server/test-walls';
import { createTeam, joinTeam } from './teams';
import { createLesson, linkFigure, publishLesson } from './lessons';
import { addLesson } from './entries';

const figureInput = (name: string) => ({
	figureName: name,
	name: 'Basic',
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
	it('gives an untagged figure no starts and no ends, so it connects to everything', () => {
		const { db } = setup();
		createFigure(db, U1_SALSA, figureInput('enchufla'));
		createFigure(db, U1_SALSA, figureInput('dile que no'));
		const g = buildGraph(db, U1_SALSA);

		expect(g.figures).toHaveLength(2);
		expect(g.figures[0]).toMatchObject({ starts: [], ends: [] });
		expect(follows(g, g.figures[0].id)).toHaveLength(2);
	});

	it('reads every end row: a figure with two ends has two', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		db.insert(figureEndPositions)
			.values([
				{ figureId: made.figure.id, positionId: pos('closed') },
				{ figureId: made.figure.id, positionId: pos('open-two') }
			])
			.run();
		const node = buildGraph(db, U1_SALSA).figures[0];
		expect([...node.ends].sort((a, b) => a - b)).toEqual(
			[pos('closed'), pos('open-two')].sort((a, b) => a - b)
		);
	});

	it('drops a tag to an archived position: the side reads as no position', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		setFigureShape(db, made.figure.id, shape([pos('closed')], [pos('cross-hand')]));
		db.update(positions)
			.set({ archivedAt: 1 })
			.where(eq(positions.id, pos('cross-hand')))
			.run();
		const g = buildGraph(db, U1_SALSA);
		expect(g.figures[0]).toMatchObject({ starts: [pos('closed')], ends: [] });
		expect(g.positions.some((p) => p.id === pos('cross-hand'))).toBe(false);
	});

	it('names each live position once, from its own row', () => {
		const { db, pos } = setup();
		const g = buildGraph(db, U1_SALSA);
		expect(g.positions).toHaveLength(10);
		expect(g.positions.find((p) => p.id === pos('closed'))).toEqual({
			id: pos('closed'),
			name: 'Cerrada',
			styleTag: null
		});
	});

	it("leaves out another person's positions and tags to them", () => {
		const { db } = setup();
		const theirs = addPosition(db, U2_SALSA, 'Theirs');
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		// Written past `writeFigureShape`, which refuses it: the graph must not trust a stray row.
		db.insert(figureStartPositions).values({ figureId: made.figure.id, positionId: theirs }).run();
		const g = buildGraph(db, U1_SALSA);
		expect(g.figures[0].starts).toEqual([]);
		expect(g.positions.some((p) => p.id === theirs)).toBe(false);
	});

	it('is walled by dance', () => {
		const { db } = setup();
		createFigure(db, U1_SALSA, figureInput('enchufla'));
		createFigure(db, U1_BACHATA, { ...figureInput('basico'), style: 'dominican' });
		expect(buildGraph(db, U1_SALSA).figures).toHaveLength(1);
		expect(buildGraph(db, U1_BACHATA).figures).toHaveLength(1);
	});

	it('leaves out archived figures', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		archiveVariation(db, made.figure.id, Date.now());
		expect(buildGraph(db, U1_SALSA).figures).toEqual([]);
	});
});

describe('positions compared by family', () => {
	const T = 1_790_000_000_000;
	const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

	/**
	 * u2 added Salsa Tuesdays' published lesson, which links the group's
	 * figure F; u2's own figure M ends in u2's Cerrada, F starts in the
	 * group's. `sameGene` says whether the two Cerradas are one family.
	 */
	function family(sameGene: boolean) {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		joinTeam(db, 'u2', 1, T);
		const theirs = addPosition(db, T1_SALSA, 'Closed', { geneId: 'g' });
		const mine = addPosition(db, U2_SALSA, 'Cerrada', { geneId: sameGene ? 'g' : 'h' });
		const F = createFigure(db, T1_SALSA, figureInput('Enchufla'))!.figure.id;
		expect(setFigureShape(db, F, shape([theirs], []), 'u1')).toBe(true);
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'W1', notes: null })
			.lesson.id;
		linkFigure(db, L, F, 'u1');
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		expect(addLesson(db, 'u2', L, NONE, T)).toBe(true);
		const M = createFigure(db, U2_SALSA, figureInput('Mine'))!.figure.id;
		expect(setFigureShape(db, M, shape([], [mine]))).toBe(true);
		return { db, F, M, mine, theirs };
	}

	it("a person's Cerrada and a group's Cerrada of one gene are one position", () => {
		const { db, F, M, mine, theirs } = family(true);
		const g = graphFor(db, U2_SALSA);
		expect(follows(g, M)).toContain(F);
		// The canonical id is the person's own member, named from their row.
		expect(g.figures.find((f) => f.id === F)!.starts).toEqual([mine]);
		expect(canonicalOf(g, theirs)).toBe(mine);
		expect(g.positions.filter((p) => p.id === mine || p.id === theirs)).toEqual([
			{ id: mine, name: 'Cerrada', styleTag: null }
		]);
	});

	it('…but two Cerradas of different genes are not', () => {
		const { db, F, M, theirs } = family(false);
		const g = graphFor(db, U2_SALSA);
		expect(follows(g, M)).not.toContain(F);
		expect(canonicalOf(g, theirs)).toBe(theirs);
	});

	it('without a member of its own, the lowest id of the family stands for it', () => {
		const db = openDb(':memory:');
		const a = addPosition(db, U1_SALSA, 'A', { geneId: 'g' });
		const g = buildGraph(db, U2_SALSA, { positions: new Set([a]) });
		expect(canonicalOf(g, a)).toBe(a);
		expect(g.positions.map((p) => p.id)).toEqual([a]);
	});
});

/** A shape with the default timing, so each test only states what it is about. */
const shape = (
	startIds: number[],
	endIds: number[],
	timing: { startCount?: number; lengthCounts?: number } = {}
) => ({ startIds, endIds, startCount: 1, lengthCounts: 8, ...timing });

describe('setFigureShape', () => {
	it('stores starts, ends and timing, and the graph reads them back', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		expect(
			setFigureShape(
				db,
				made.figure.id,
				shape([pos('open-two'), pos('cross-hand')], [pos('hammerlock-r')], {
					startCount: 5,
					lengthCounts: 12
				})
			)
		).toBe(true);

		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('open-two'), pos('cross-hand')].sort((a, b) => a - b),
			endIds: [pos('hammerlock-r')]
		});
		const g = buildGraph(db, U1_SALSA);
		expect(g.figures[0]).toMatchObject({ start: 5, length: 12, ends: [pos('hammerlock-r')] });
	});

	it('stores any number of ends, one row each', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const [a, b] = [pos('closed'), pos('open-two')];
		expect(setFigureShape(db, made.figure.id, shape([], [a, b]))).toBe(true);
		const rows = db
			.select()
			.from(figureEndPositions)
			.where(eq(figureEndPositions.figureId, made.figure.id))
			.all();
		expect(rows.map((r) => r.positionId).sort((x, y) => x - y)).toEqual(
			[a, b].sort((x, y) => x - y)
		);
	});

	it('replaces the starts and ends rather than adding to them', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		setFigureShape(
			db,
			made.figure.id,
			shape([pos('open-two'), pos('cross-hand')], [pos('open-two'), pos('closed')])
		);
		setFigureShape(db, made.figure.id, shape([pos('closed')], [pos('caida')]));
		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('closed')],
			endIds: [pos('caida')]
		});
	});

	it('refuses a position from the other dance, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;

		expect(setFigureShape(db, made.figure.id, shape([bachataShadow.id], []))).toBe(false);
		expect(
			setFigureShape(
				db,
				made.figure.id,
				shape([pos('open-two')], [bachataShadow.id], { startCount: 5 })
			)
		).toBe(false);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endIds: [] });
		// The timing half of the refused write did not land either.
		expect(buildGraph(db, U1_SALSA).figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('refuses a position of another person, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const theirs = addPosition(db, U2_SALSA, 'Theirs');
		expect(setFigureShape(db, made.figure.id, shape([pos('closed')], [theirs]))).toBe(false);
		expect(setFigureShape(db, made.figure.id, shape([theirs], []))).toBe(false);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endIds: [] });
	});

	it("refuses a group's figure tagged with a person's position", () => {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		const mine = addPosition(db, U1_SALSA, 'Mine');
		const ours = addPosition(db, T1_SALSA, 'Ours');
		const F = createFigure(db, T1_SALSA, figureInput('Enchufla'))!.figure.id;
		expect(setFigureShape(db, F, shape([mine], []), 'u1')).toBe(false);
		expect(setFigureShape(db, F, shape([], [mine]), 'u1')).toBe(false);
		expect(setFigureShape(db, F, shape([ours], [ours]), 'u1')).toBe(true);
	});

	it('refuses an archived position it is not already tagged with', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		db.update(positions)
			.set({ archivedAt: 1 })
			.where(eq(positions.id, pos('caida')))
			.run();
		expect(setFigureShape(db, made.figure.id, shape([pos('caida')], []))).toBe(false);
	});

	it('refuses timing out of range and a missing figure, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const id = made.figure.id;
		const open = [pos('open-two')];
		expect(setFigureShape(db, id, shape(open, [], { startCount: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, [], { startCount: 9 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, [], { startCount: 1.5 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, [], { lengthCounts: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, [], { lengthCounts: 65 }))).toBe(false);
		expect(setFigureShape(db, 9999, shape(open, []))).toBe(false);
		expect(figurePositions(db, id).startIds).toEqual([]);
	});

	it('rejects a duplicate (figure, position) row at the database level', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const row = { figureId: made.figure.id, positionId: pos('open-two') };
		db.insert(figureStartPositions).values(row).run();
		// The composite primary key is the backstop for the de-duplication
		// `setFigureShape` does in code. Nothing else in the suite reaches it.
		expect(() => db.insert(figureStartPositions).values(row).run()).toThrow();
		db.insert(figureEndPositions).values(row).run();
		expect(() => db.insert(figureEndPositions).values(row).run()).toThrow();
	});

	it('de-duplicates a repeated position rather than throwing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const open = pos('open-two');
		expect(setFigureShape(db, made.figure.id, shape([open, open], [open, open]))).toBe(true);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [open], endIds: [open] });
	});

	it('keeps a tag to an archived position when a save sends only live ones (ruling 4)', () => {
		// The edit form cannot show an archived position, so saving must not drop it.
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('sombrero'))!;
		const crossHand = pos('cross-hand');
		expect(setFigureShape(db, made.figure.id, shape([crossHand], [crossHand]))).toBe(true);
		db.update(positions).set({ archivedAt: 1 }).where(eq(positions.id, crossHand)).run();
		expect(setFigureShape(db, made.figure.id, shape([pos('closed')], [pos('caida')]))).toBe(true);
		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('closed'), crossHand].sort((a, b) => a - b),
			endIds: [pos('caida'), crossHand].sort((a, b) => a - b)
		});
		// An older page that posts the archived id back is not refused for it.
		expect(setFigureShape(db, made.figure.id, shape([crossHand], [crossHand]))).toBe(true);
		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [crossHand],
			endIds: [crossHand]
		});
	});
});

describe('a variation stands on its own', () => {
	it("a variation's graph node is its own values", () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		setFigureShape(
			db,
			made.figure.id,
			shape([pos('closed')], [pos('hammerlock-r')], { startCount: 5 })
		);
		const other = createVariationFrom(db, made.figure.id, 'Doble')!;
		// The copy carries the source's shape, ends included.
		expect(figurePositions(db, other.id)).toEqual({
			startIds: [pos('closed')],
			endIds: [pos('hammerlock-r')]
		});
		// Clear it so the sibling is blank.
		setFigureShape(db, other.id, shape([], []));
		const g = buildGraph(db, U1_SALSA);
		const node = g.figures.find((f) => f.id === other.id)!;
		expect(node).toMatchObject({ starts: [], ends: [], start: 1, length: 8 });
		expect(g.figures.find((f) => f.id === made.figure.id)!.starts).toEqual([pos('closed')]);
	});

	it('leaves out a live variation whose group is archived', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		db.update(figureGroups).set({ archivedAt: 1 }).where(eq(figureGroups.id, made.group.id)).run();
		expect(buildGraph(db, U1_SALSA).figures).toEqual([]);
	});

	it('taggedFigures counts variations, either side tagged', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		const other = createVariationFrom(db, made.figure.id, 'Doble')!;
		const third = createVariationFrom(db, made.figure.id, 'Triple')!;
		setFigureShape(db, other.id, shape([], []));
		setFigureShape(db, made.figure.id, shape([pos('closed')], []));
		setFigureShape(db, third.id, shape([], [pos('closed')]));
		expect(taggedFigures(db, U1_SALSA)).toEqual({ done: 2, total: 3 });
	});

	it('taggedFigures leaves out a live variation whose group is archived', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		createFigure(db, U1_SALSA, figureInput('sombrero'));
		db.update(figureGroups).set({ archivedAt: 1 }).where(eq(figureGroups.id, made.group.id)).run();
		expect(taggedFigures(db, U1_SALSA)).toEqual({ done: 0, total: 1 });
	});

	it('orders nodes by figure name, then variation name', () => {
		const { db } = setup();
		const zeta = createFigure(db, U1_SALSA, figureInput('Zeta'))!;
		const alpha = createFigure(db, U1_SALSA, figureInput('Alpha'))!;
		const alpha2 = createVariationFrom(db, alpha.figure.id, 'Aaa')!;
		expect(buildGraph(db, U1_SALSA).figures.map((f) => f.id)).toEqual([
			alpha2.id,
			alpha.figure.id,
			zeta.figure.id
		]);
	});
});

describe('timing defaults', () => {
	it('stores a new figure as start 1, 8 counts', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		expect(made.figure.lengthCounts).toBe(8);
		expect(made.figure.startCount).toBe(1);
		expect(buildGraph(db, U1_SALSA).figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('reads a null length as 8 — a row the backfill or createFigure never touched', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		db.update(figures).set({ lengthCounts: null }).where(eq(figures.id, made.figure.id)).run();
		expect(buildGraph(db, U1_SALSA).figures[0].length).toBe(8);
	});
});
