import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, figures } from './db/schema';
import {
	archiveFigure,
	createFigure,
	createVariation,
	figureLabels,
	listFigures,
	listFiguresForCall,
	listVariations,
	listVersions,
	updateFigure,
	updateVariation
} from './figures';
import { buildGraph, setFigureShape, taggedFigures } from './graph';
import { createLesson, linkFigure, listLinkableFigures } from './lessons';
import { listPositions, seedPositions } from './positions';
import { addFigureSlot, addOption, createRoutine, routineSlots } from './routines';
import { practicePayload } from './practice-content';
import { positionCounts } from '$lib/graph/graph';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

/** A base figure of one dance, with its exercise. */
const base = (name = 'Enchufla', dance: 'salsa' | 'bachata' = 'salsa') =>
	createFigure(db, dance, {
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null
	})!.figure;

describe('figures.parent_id', () => {
	it('is null on a figure and points at the figure on a variation row', () => {
		const parent = base();
		expect(parent.parentId).toBeNull();
		const row = db
			.insert(figures)
			.values({ name: 'Doble', dance: 'salsa', parentId: parent.id })
			.returning()
			.get();
		expect(db.select().from(figures).where(eq(figures.id, row.id)).get()?.parentId).toBe(parent.id);
	});
});

describe('createVariation', () => {
	it('makes a figure row under its figure, of its dance, with no exercise', () => {
		const parent = base('Basico', 'bachata');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: 'Two turns' })!;
		expect(v).toMatchObject({
			parentId: parent.id,
			dance: 'bachata',
			name: 'Doble',
			notes: 'Two turns',
			startCount: null,
			lengthCounts: null,
			endPositionId: null
		});
		expect(db.select().from(exercises).where(eq(exercises.figureId, v.id)).all()).toEqual([]);
	});

	it('refuses a variation of a variation — one level only', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(createVariation(db, v.id, { name: 'Triple', notes: null })).toBeNull();
	});

	it('refuses a figure that is archived or gone', () => {
		const parent = base();
		archiveFigure(db, parent.id, 1000);
		expect(createVariation(db, parent.id, { name: 'Doble', notes: null })).toBeNull();
		expect(createVariation(db, 9999, { name: 'Doble', notes: null })).toBeNull();
	});

	it('refuses a name a sibling already uses, ignoring case', () => {
		const parent = base();
		createVariation(db, parent.id, { name: 'Doble', notes: null });
		expect(createVariation(db, parent.id, { name: 'DOBLE', notes: null })).toBeNull();
	});

	it('allows the same name under a different figure, and again once the first is archived', () => {
		const a = base('Enchufla');
		const b = base('Setenta');
		const first = createVariation(db, a.id, { name: 'Doble', notes: null })!;
		expect(createVariation(db, b.id, { name: 'Doble', notes: null })).not.toBeNull();
		archiveFigure(db, first.id, 1000);
		expect(createVariation(db, a.id, { name: 'Doble', notes: null })).not.toBeNull();
	});
});

describe('updateVariation', () => {
	it('renames a variation and changes its directions', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(updateVariation(db, v.id, { name: 'Double', notes: 'Spot' })).toMatchObject({
			name: 'Double',
			notes: 'Spot'
		});
	});

	it('keeps its own name, and refuses a sibling’s', () => {
		const parent = base();
		const a = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		createVariation(db, parent.id, { name: 'Con giro', notes: null });
		expect(updateVariation(db, a.id, { name: 'Doble', notes: 'x' })).not.toBeNull();
		expect(updateVariation(db, a.id, { name: 'con giro', notes: null })).toBeNull();
	});

	it('refuses a base figure — that is updateFigure’s job', () => {
		expect(updateVariation(db, base().id, { name: 'X', notes: null })).toBeNull();
	});
});

describe('updateFigure', () => {
	it('refuses a variation — partner, style and call text are the figure’s', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(
			updateFigure(db, v.id, {
				name: 'X',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})
		).toBeNull();
	});
});

describe('archiving', () => {
	it('archives a figure’s variations with it', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		archiveFigure(db, parent.id, 1000);
		expect(db.select().from(figures).where(eq(figures.id, v.id)).get()?.archivedAt).toBe(1000);
	});

	it('archives a variation alone, leaving its figure and siblings', () => {
		const parent = base();
		const a = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const b = createVariation(db, parent.id, { name: 'Con giro', notes: null })!;
		expect(archiveFigure(db, a.id, 1000)).toBe(true);
		expect(listVariations(db, parent.id).map((v) => v.id)).toEqual([b.id]);
		expect(db.select().from(figures).where(eq(figures.id, parent.id)).get()?.archivedAt).toBeNull();
	});
});

describe('setFigureShape and "same as Basic"', () => {
	const shape = (startCount: number | null, lengthCounts: number | null) => ({
		startIds: [],
		endId: null,
		startCount,
		lengthCounts
	});

	it('stores null timing on a variation — the figure’s is used', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(setFigureShape(db, v.id, shape(null, 12))).toBe(true);
		const row = db.select().from(figures).where(eq(figures.id, v.id)).get()!;
		expect([row.startCount, row.lengthCounts]).toEqual([null, 12]);
	});

	it('refuses null timing on a figure, which has nothing to inherit from', () => {
		const parent = base();
		expect(setFigureShape(db, parent.id, shape(null, 8))).toBe(false);
		expect(setFigureShape(db, parent.id, shape(1, null))).toBe(false);
	});
});

describe('variations are not figures, for every list', () => {
	const setup = () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		return { parent, v };
	};

	it('leaves them out of the library', () => {
		const { parent } = setup();
		expect(listFigures(db, 'salsa').map((f) => f.id)).toEqual([parent.id]);
	});

	it('leaves them out of the lesson picker, and refuses one posted by hand', () => {
		const { parent, v } = setup();
		const { lesson } = createLesson(db, 'salsa', {
			lessonDay: '2026-09-22',
			title: 'Class',
			notes: null
		});
		expect(listLinkableFigures(db, lesson.id).map((f) => f.id)).toEqual([parent.id]);
		expect(linkFigure(db, lesson.id, v.id)).toBe(false);
	});

	it('leaves them out of the tagged count', () => {
		seedPositions(db);
		const { v } = setup();
		const hammer = listPositions(db, 'salsa').find((p) => p.slug === 'hammerlock-r')!;
		setFigureShape(db, v.id, {
			startIds: [],
			endId: hammer.id,
			startCount: null,
			lengthCounts: null
		});
		expect(taggedFigures(db, 'salsa')).toEqual({ done: 0, total: 1 });
	});
});

describe('buildGraph fills a variation from its figure', () => {
	it('reads an untouched variation exactly as its figure', () => {
		seedPositions(db);
		const [open, cross, hammer] = ['open-two', 'cross-hand', 'hammerlock-r'].map(
			(slug) => listPositions(db, 'salsa').find((p) => p.slug === slug)!.id
		);
		const parent = base();
		setFigureShape(db, parent.id, {
			startIds: [open, cross],
			endId: hammer,
			startCount: 5,
			lengthCounts: 12
		});
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const node = buildGraph(db, 'salsa').figures.find((f) => f.id === v.id)!;
		expect({ ...node, starts: [...node.starts].sort((a, b) => a - b) }).toEqual({
			id: v.id,
			starts: [open, cross].sort((a, b) => a - b),
			end: hammer,
			start: 5,
			length: 12
		});
	});

	it('lets a variation override each field on its own', () => {
		seedPositions(db);
		const closed = listPositions(db, 'salsa').find((p) => p.slug === 'closed')!.id;
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		setFigureShape(db, v.id, {
			startIds: [closed],
			endId: null,
			startCount: null,
			lengthCounts: 16
		});
		const node = buildGraph(db, 'salsa').figures.find((f) => f.id === v.id)!;
		expect(node).toMatchObject({ starts: [closed], end: null, start: 1, length: 16 });
	});

	it('leaves out a variation whose figure is archived', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		// Only the parent, as a hand-edited row would be — archiveFigure takes both.
		db.update(figures).set({ archivedAt: 1 }).where(eq(figures.id, parent.id)).run();
		expect(buildGraph(db, 'salsa').figures.map((f) => f.id)).not.toContain(v.id);
	});

	it('counts a variation in the gap report — it is a real way out of a hold', () => {
		seedPositions(db);
		const hammer = listPositions(db, 'salsa').find((p) => p.slug === 'hammerlock-r')!.id;
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		setFigureShape(db, v.id, {
			startIds: [],
			endId: hammer,
			startCount: null,
			lengthCounts: null
		});
		const [counts] = positionCounts(buildGraph(db, 'salsa'), [hammer]);
		expect(counts.inCount).toBe(1);
	});
});

describe('labels and versions', () => {
	it('shows a variation as "figure · variation", archived ones included', () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		archiveFigure(db, v.id, 1000);
		expect(figureLabels(db, 'salsa').get(v.id)).toBe('Enchufla · Doble');
		expect(figureLabels(db, 'salsa').get(parent.id)).toBe('Enchufla');
	});

	it('lists each figure followed by its live variations', () => {
		const a = base('Setenta');
		const b = base('Enchufla');
		const d = createVariation(db, b.id, { name: 'Doble', notes: null })!;
		const gone = createVariation(db, b.id, { name: 'Old', notes: null })!;
		archiveFigure(db, gone.id, 1000);
		expect(listVersions(db, 'salsa')).toEqual([
			{ id: b.id, parentId: null, name: 'Enchufla', label: 'Enchufla' },
			{ id: d.id, parentId: b.id, name: 'Doble', label: 'Enchufla · Doble' },
			{ id: a.id, parentId: null, name: 'Setenta', label: 'Setenta' }
		]);
	});

	it('names a routine’s variation on screen and says its figure’s name', () => {
		const parent = createFigure(db, 'salsa', {
			name: 'Enchufla',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure;
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		expect(listFiguresForCall(db, 'salsa', [v.id])).toMatchObject([
			{ id: v.id, name: 'Enchufla · Doble', say: 'Enchufla' }
		]);
	});

	it('names a variation in a routine’s practice panel', () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		addFigureSlot(db, routine.id, v.id);
		const content = practicePayload(db, exercise, 'Europe/Ljubljana', Date.now()).content;
		expect(content.type === 'routine' && content.slots[0].names).toEqual(['Enchufla · Doble']);
	});
});

describe('routines see a variation’s inherited landing', () => {
	it('accepts a variation that lands where its figure does as an alternative to it', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const step = addFigureSlot(db, routine.id, parent.id)!;
		expect(addOption(db, step, v.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds.sort()).toEqual([parent.id, v.id].sort());
	});

	it('refuses one whose own length leaves the next figure on another count', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Corta', notes: null })!;
		setFigureShape(db, v.id, { startIds: [], endId: null, startCount: null, lengthCounts: 4 });
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const step = addFigureSlot(db, routine.id, parent.id)!;
		expect(addOption(db, step, v.id)).toBe(false);
	});

	it('refuses a variation whose inherited end differs from the slot’s', () => {
		// The row itself has a null end, so reading the ROW would call it neutral
		// and accept it; only the graph knows it ends where its figure does.
		seedPositions(db);
		const hammer = listPositions(db, 'salsa').find((p) => p.slug === 'hammerlock-r')!.id;
		const tagged = base('Sombrero');
		setFigureShape(db, tagged.id, { startIds: [], endId: hammer, startCount: 1, lengthCounts: 8 });
		const v = createVariation(db, tagged.id, { name: 'Doble', notes: null })!;
		const plain = base('Enchufla');
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const step = addFigureSlot(db, routine.id, plain.id)!;
		expect(addOption(db, step, v.id)).toBe(false);
	});
});
