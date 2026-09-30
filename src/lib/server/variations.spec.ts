import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, figures } from './db/schema';
import {
	archiveFigure,
	createFigure,
	createVariation,
	listCallableFigures,
	listFigures,
	listVariations,
	updateFigure,
	updateVariation
} from './figures';
import { setFigureShape, taggedFigures } from './graph';
import { createLesson, linkFigure, listLinkableFigures } from './lessons';
import { listPositions, seedPositions } from './positions';

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
		notes: null,
		callable: true,
		callText: null
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
				notes: null,
				callable: true,
				callText: null
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

	it('leaves them out of the drill’s pool', () => {
		const { parent } = setup();
		expect(listCallableFigures(db, 'salsa').map((f) => f.id)).toEqual([parent.id]);
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
