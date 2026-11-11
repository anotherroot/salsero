import { describe, expect, it } from 'vitest';
import { countsOf, follows, taggedCount } from '$lib/graph/graph';
import { openDb, type Db } from './db';
import { eq } from 'drizzle-orm';
import {
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	lessonPositions,
	positions,
	teamChanges,
	twins
} from './db/schema';
import { archiveVariation, createFigure, createVariationFrom } from './figures';
import { buildGraph, canonicalOf, figurePositions, graphFor, setFigureShape } from './graph';
import { listPositions } from './positions';
import { addPosition, insertFixturePositions } from './test-positions';
import { T1_SALSA, U1_SALSA, U1_BACHATA, U2_SALSA } from '$lib/server/test-walls';
import { createTeam, joinTeam } from './teams';
import { createLesson, linkFigure, publishLesson } from './lessons';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import { markTwins, separate } from './twins';
import { addFigureSlot, createRoutine, routineShapes } from './routines';
import { breaks } from '$lib/routines/routines';

const figureInput = (name: string) => ({
	figureName: name,
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa',
	notes: null
});

function setup(): { db: Db; pos: (slug: string) => number } {
	const db = openDb(':memory:');
	insertFixturePositions(db);
	const all = listPositions(db, U1_SALSA);
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
			styleTag: null,
			twins: false
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
			{ id: mine, name: 'Cerrada', styleTag: null, twins: false }
		]);
	});

	it('…but two Cerradas of different genes are not', () => {
		const { db, F, M, theirs } = family(false);
		const g = graphFor(db, U2_SALSA);
		expect(follows(g, M)).not.toContain(F);
		expect(canonicalOf(g, theirs)).toBe(theirs);
	});

	it('two twinned positions of different families are one (ruling 16)', () => {
		const { db, F, M, mine, theirs } = family(false);
		expect(markTwins(db, U2_SALSA, 'position', [mine, theirs])).toBe(true);
		const g = graphFor(db, U2_SALSA);
		expect(follows(g, M)).toContain(F);
		// The person's own member stands for the pair, though the group's id is lower.
		expect(theirs).toBeLessThan(mine);
		expect(canonicalOf(g, theirs)).toBe(mine);
		expect(g.figures.find((f) => f.id === F)!.starts).toEqual([mine]);
		expect(g.positions.filter((p) => p.id === mine || p.id === theirs)).toEqual([
			{ id: mine, name: 'Cerrada', styleTag: null, twins: true }
		]);
		expect(g.twinned.get(mine)).toEqual([theirs, mine]);

		// Separate: two positions again, and M no longer leads into F.
		expect(separate(db, U2_SALSA, 'position', theirs)).toBe(true);
		const apart = graphFor(db, U2_SALSA);
		expect(follows(apart, M)).not.toContain(F);
		expect(canonicalOf(apart, theirs)).toBe(theirs);
		expect(apart.positions.every((p) => !p.twins)).toBe(true);
		expect(apart.twinned.size).toBe(0);
	});

	it('a routine over twinned positions has no break; separating them brings it back', () => {
		const { db, F, M, mine, theirs } = family(false);
		const R = createRoutine(db, U2_SALSA, { name: 'Friday', notes: null }).routine.id;
		expect(addFigureSlot(db, R, M)).not.toBeNull();
		expect(addFigureSlot(db, R, F)).not.toBeNull();
		const shape = () => routineShapes(db, U2_SALSA).get(R)!;
		expect(breaks(graphFor(db, U2_SALSA), shape())).toEqual([0]);
		expect(markTwins(db, U2_SALSA, 'position', [mine, theirs])).toBe(true);
		expect(breaks(graphFor(db, U2_SALSA), shape())).toEqual([]);
		expect(separate(db, U2_SALSA, 'position', mine)).toBe(true);
		expect(breaks(graphFor(db, U2_SALSA), shape())).toEqual([0]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('twin sets sharing a family merge whole, under the lowest id without a member of its own', () => {
		const db = openDb(':memory:');
		const a = addPosition(db, U1_SALSA, 'A', { geneId: 'g' });
		const b = addPosition(db, U1_SALSA, 'B');
		const c = addPosition(db, U1_SALSA, 'C');
		const a2 = addPosition(db, { userId: 'u3', dance: 'salsa' }, 'A too', { geneId: 'g' });
		// u2 may use all four; a is b's twin, and a's family member a2 is c's.
		twinRaw(db, 'u2', [b, a], 's1');
		twinRaw(db, 'u2', [a2, c], 's2');
		const g = buildGraph(db, U2_SALSA, { positions: new Set([a, b, c, a2]) });
		expect([a, b, c, a2].map((id) => canonicalOf(g, id))).toEqual([a, a, a, a]);
		expect(g.positions).toEqual([{ id: a, name: 'A', styleTag: null, twins: true }]);
		// u1's own graph never reads u2's twins.
		expect(buildGraph(db, U1_SALSA).positions.every((p) => !p.twins)).toBe(true);
	});

	it('a twinned node stands for every member of its families, ticked or not', () => {
		const db = openDb(':memory:');
		const a = addPosition(db, U1_SALSA, 'A');
		const b = addPosition(db, U1_SALSA, 'B', { geneId: 'gb' });
		// b's family member in another place: never ticked in Same as…, still one with b.
		const b2 = addPosition(db, { userId: 'u3', dance: 'salsa' }, 'B too', { geneId: 'gb' });
		twinRaw(db, 'u2', [a, b], 's1');
		const g = buildGraph(db, U2_SALSA, { positions: new Set([a, b, b2]) });
		expect([a, b, b2].map((id) => canonicalOf(g, id))).toEqual([a, a, a]);
		expect(g.twinned.get(a)).toEqual([a, b, b2]);
	});

	it("a group's space ignores twins", () => {
		const { db, mine, theirs } = family(false);
		const open = addPosition(db, T1_SALSA, 'Open');
		twinRaw(db, 'u1', [theirs, open], 's1');
		expect(markTwins(db, U2_SALSA, 'position', [mine, theirs])).toBe(true);
		const g = graphFor(db, T1_SALSA);
		expect(canonicalOf(g, open)).toBe(open);
		expect(canonicalOf(g, theirs)).toBe(theirs);
		expect(g.positions.every((p) => !p.twins)).toBe(true);
		expect(g.twinned.size).toBe(0);
	});

	it('without a member of its own, the lowest id of the family stands for it', () => {
		const db = openDb(':memory:');
		const a = addPosition(db, U1_SALSA, 'A', { geneId: 'g' });
		const g = buildGraph(db, U2_SALSA, { positions: new Set([a]) });
		expect(canonicalOf(g, a)).toBe(a);
		expect(g.positions.map((p) => p.id)).toEqual([a]);
	});
});

/** Twins written straight to the table: one of a person's sets of position ids. */
function twinRaw(db: Db, userId: string, ids: number[], setId: string) {
	for (const itemId of ids)
		db.insert(twins).values({ userId, kind: 'position', setId, itemId }).run();
}

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
		const bachataShadow = listPositions(db, U1_BACHATA).find((p) => p.slug === 'shadow')!;

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

describe('a person tags with the group positions they may use (ruling 15)', () => {
	const T = 1_790_000_000_000;
	const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

	/**
	 * Salsa Tuesdays: F starts in the group's Open and is in published lesson L,
	 * which u2 added; L links Sombra by hand. Draft is a group position only an
	 * unpublished lesson links. M is u2's own figure.
	 */
	function usable() {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		joinTeam(db, 'u2', 1, T);
		const open = addPosition(db, T1_SALSA, 'Open');
		const sombra = addPosition(db, T1_SALSA, 'Sombra');
		const draft = addPosition(db, T1_SALSA, 'Draft');
		const F = createFigure(db, T1_SALSA, figureInput('Enchufla'))!.figure.id;
		expect(setFigureShape(db, F, shape([open], []), 'u1')).toBe(true);
		const lesson = (title: string) =>
			createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title, notes: null }).lesson.id;
		const L = lesson('W1');
		linkFigure(db, L, F, 'u1');
		db.insert(lessonPositions).values({ lessonId: L, positionId: sombra }).run();
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		expect(addLesson(db, 'u2', L, NONE, T)).toBe(true);
		db.insert(lessonPositions)
			.values({ lessonId: lesson('Draft'), positionId: draft })
			.run();
		const M = createFigure(db, U2_SALSA, figureInput('Mine'))!.figure.id;
		return { db, F, M, open, sombra, draft };
	}

	it('accepts a usable group position on a person’s figure, and the graph reads it', () => {
		const { db, F, M, open } = usable();
		expect(setFigureShape(db, M, shape([], [open]))).toBe(true);
		expect(figurePositions(db, M)).toEqual({ startIds: [], endIds: [open] });
		expect(follows(graphFor(db, U2_SALSA), M)).toContain(F);
		expect(crossRefs(db)).toEqual([]);
	});

	it('replaces a usable group tag like an own one', () => {
		const { db, M, open, sombra } = usable();
		expect(setFigureShape(db, M, shape([open], [open]))).toBe(true);
		expect(setFigureShape(db, M, shape([sombra], []))).toBe(true);
		expect(figurePositions(db, M)).toEqual({ startIds: [sombra], endIds: [] });
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a group position the person may not use, writing nothing', () => {
		const { db, M, open, draft } = usable();
		expect(setFigureShape(db, M, shape([open], [draft]))).toBe(false);
		expect(figurePositions(db, M)).toEqual({ startIds: [], endIds: [] });
		const outsider = createFigure(db, { userId: 'u3', dance: 'salsa' }, figureInput('X'))!.figure
			.id;
		expect(setFigureShape(db, outsider, shape([open], []))).toBe(false);
	});

	it('graphFor holds every usable group position, a hand-linked one too', () => {
		const { db, open, sombra, draft } = usable();
		const ids = graphFor(db, U2_SALSA).positions.map((p) => p.id);
		expect(ids).toEqual(expect.arrayContaining([open, sombra]));
		expect(ids).not.toContain(draft);
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

	it('taggedCount over a space graph counts variations, either side tagged', () => {
		const { db, pos } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('enchufla'))!;
		const other = createVariationFrom(db, made.figure.id, 'Doble')!;
		const third = createVariationFrom(db, made.figure.id, 'Triple')!;
		setFigureShape(db, other.id, shape([], []));
		setFigureShape(db, made.figure.id, shape([pos('closed')], []));
		setFigureShape(db, third.id, shape([], [pos('closed')]));
		expect(taggedCount(buildGraph(db, U1_SALSA))).toEqual({ done: 2, total: 3 });
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

describe('start sets and free length', () => {
	it('reads a figure nobody changed as one start, fixed length', () => {
		const { db } = setup();
		createFigure(db, U1_SALSA, figureInput('enchufla'));
		const f = buildGraph(db, U1_SALSA).figures[0];
		expect(countsOf(f)).toEqual([1]);
		expect(f.free ?? false).toBe(false);
	});

	it('reads the start mask and the free length', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('basic'))!;
		db.update(figures)
			.set({ startCounts: 0b10001, lengthFree: 1 })
			.where(eq(figures.id, made.figure.id))
			.run();
		const f = buildGraph(db, U1_SALSA).figures[0];
		expect(countsOf(f)).toEqual([1, 5]);
		expect(f.start).toBe(1);
		expect(f.free).toBe(true);
	});
});

describe('setFigureShape: start sets and a length set in the routine (spec 2026-11-11)', () => {
	const row = (db: Db, id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;

	it('saves the counts a figure can start on, the lowest as its usual start', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('basic'))!;
		expect(setFigureShape(db, made.figure.id, { ...shape([], []), startCounts: [5, 1] })).toBe(
			true
		);
		const f = buildGraph(db, U1_SALSA).figures[0];
		expect(countsOf(f)).toEqual([1, 5]);
		expect(row(db, made.figure.id)).toMatchObject({ startCount: 1, startCounts: 17 });
	});

	it('keeps one count as before: no mask', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('basic'))!;
		expect(setFigureShape(db, made.figure.id, { ...shape([], []), startCounts: [3] })).toBe(true);
		expect(row(db, made.figure.id)).toMatchObject({ startCount: 3, startCounts: null });
	});

	it('refuses an empty set or a count off the eight', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('basic'))!;
		expect(setFigureShape(db, made.figure.id, { ...shape([], []), startCounts: [] })).toBe(false);
		expect(setFigureShape(db, made.figure.id, { ...shape([], []), startCounts: [9] })).toBe(false);
	});

	it('saves You choose, and an older page that sends neither keeps both', () => {
		const { db } = setup();
		const made = createFigure(db, U1_SALSA, figureInput('walk'))!;
		const id = made.figure.id;
		setFigureShape(db, id, { ...shape([], []), startCounts: [1, 5], lengthFree: true });
		expect(buildGraph(db, U1_SALSA).figures[0].free).toBe(true);
		// An older open page posts one start count and nothing else.
		expect(setFigureShape(db, id, shape([], [], { startCount: 1, lengthCounts: 8 }))).toBe(true);
		expect(row(db, id)).toMatchObject({ startCount: 1, startCounts: 17, lengthFree: 1 });
		setFigureShape(db, id, { ...shape([], []), startCounts: [1], lengthFree: false });
		expect(row(db, id)).toMatchObject({ startCounts: null, lengthFree: null });
	});
});

describe('History of a start set (spec 2026-11-11)', () => {
	it('logs turning You choose on in a group', () => {
		const { db } = setup();
		createTeam(db, 'u1', 'salsa', 'G', 1);
		const made = createFigure(db, T1_SALSA, figureInput('walk'))!;
		const before = db.select().from(teamChanges).all().length;
		expect(setFigureShape(db, made.figure.id, { ...shape([], []), lengthFree: true }, 'u1')).toBe(
			true
		);
		const rows = db.select().from(teamChanges).all();
		expect(rows.length).toBe(before + 1);
		expect(rows[rows.length - 1].subject).toBe('lengthFree');
	});
});
