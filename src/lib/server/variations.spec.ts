import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figures,
	figureStartPositions,
	lessonFigures,
	links,
	recordings
} from './db/schema';
import {
	addFigureExercise,
	addRecording,
	createFigure,
	createVariationFrom,
	figureLabels,
	listFigures,
	listFiguresForCall,
	listVersions,
	renameFigure,
	updateVariation
} from './figures';
import { createLesson, linkFigure } from './lessons';
import { listPositions, seedPositions } from './positions';
import { setFigureShape } from './graph';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const fig = (figureName = 'Enchufla', name = 'Basic', dance: 'salsa' | 'bachata' = 'salsa') =>
	createFigure(db, dance, {
		figureName,
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null
	})!;

const input = (
	name: string,
	over: Partial<{ partner: 'partner' | 'solo'; style: string }> = {}
) => ({
	name,
	partner: over.partner ?? ('partner' as const),
	style: over.style ?? 'salsa',
	notes: null
});

describe('createFigure', () => {
	it('makes a group and its first variation', () => {
		const { figure, group } = fig();
		expect(figure.groupId).toBe(group.id);
		expect(group.name).toBe('Enchufla');
		expect(figure.name).toBe('Basic');
		expect(figure.startCount).toBe(1);
		expect(figure.lengthCounts).toBe(8);
	});

	it('refuses a taken figure name in the same dance', () => {
		fig();
		expect(createFigure(db, 'salsa', { figureName: 'enchufla ', ...input('Basic') })).toBeNull();
		expect(fig('Enchufla', 'Basic', 'bachata')).not.toBeNull();
	});
});

describe('createVariationFrom', () => {
	it('copies the shape and nothing else', () => {
		seedPositions(db);
		const pos = listPositions(db, 'salsa');
		const src = fig().figure;
		db.update(figures)
			.set({ notes: 'Two turns', partner: 'solo' })
			.where(eq(figures.id, src.id))
			.run();
		setFigureShape(db, src.id, {
			startIds: [pos[0].id],
			endId: pos[1].id,
			startCount: 3,
			lengthCounts: 4
		});
		addRecording(db, {
			figureId: src.id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		db.insert(links).values({ figureId: src.id, url: 'https://example.com' }).run();
		const { lesson } = createLesson(db, 'salsa', {
			lessonDay: '2026-09-20',
			title: 'L',
			notes: null
		});
		expect(linkFigure(db, lesson.id, src.id)).toBe(true);
		addFigureExercise(db, src.id);

		const before = db.select().from(figures).where(eq(figures.id, src.id)).get()!;
		const copy = createVariationFrom(db, src.id, 'Doble')!;
		expect(copy.id).not.toBe(src.id);
		expect(copy.groupId).toBe(before.groupId);
		expect(copy).toMatchObject({
			name: 'Doble',
			partner: 'solo',
			styleTag: before.styleTag,
			notes: 'Two turns',
			endPositionId: pos[1].id,
			startCount: 3,
			lengthCounts: 4
		});
		expect(
			db
				.select()
				.from(figureStartPositions)
				.where(eq(figureStartPositions.figureId, copy.id))
				.all()
				.map((r) => r.positionId)
		).toEqual([pos[0].id]);
		expect(db.select().from(recordings).where(eq(recordings.figureId, copy.id)).all()).toEqual([]);
		expect(db.select().from(links).where(eq(links.figureId, copy.id)).all()).toEqual([]);
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.figureId, copy.id)).all()
		).toEqual([]);
		expect(db.select().from(exercises).where(eq(exercises.figureId, copy.id)).all()).toEqual([]);
	});

	it('refuses a taken name', () => {
		const { figure } = fig();
		expect(createVariationFrom(db, figure.id, 'basic')).toBeNull();
	});
});

describe('updateVariation', () => {
	it('renames its exercise to the label', () => {
		const { figure } = fig();
		const ex = addFigureExercise(db, figure.id)!;
		expect(updateVariation(db, figure.id, input('Doble'))!.name).toBe('Doble');
		expect(db.select().from(exercises).where(eq(exercises.id, ex.id)).get()!.name).toBe(
			'Enchufla · Doble'
		);
	});

	it('refuses a sibling’s name and another dance’s style', () => {
		const { figure } = fig();
		const other = createVariationFrom(db, figure.id, 'Doble')!;
		expect(updateVariation(db, other.id, input('basic'))).toBeNull();
		expect(updateVariation(db, other.id, input('Doble', { style: 'dominican' }))).toBeNull();
		expect(db.select().from(figures).where(eq(figures.id, other.id)).get()).toEqual(other);
	});
});

describe('renameFigure', () => {
	it('renames every exercise of the figure', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		const e1 = addFigureExercise(db, figure.id)!;
		const e2 = addFigureExercise(db, v2.id)!;
		expect(renameFigure(db, figure.groupId!, 'Setenta')).toBe(true);
		const name = (id: number) =>
			db.select().from(exercises).where(eq(exercises.id, id)).get()!.name;
		expect(name(e1.id)).toBe('Setenta · Basic');
		expect(name(e2.id)).toBe('Setenta · Doble');
	});

	it('refuses another figure’s name', () => {
		fig('Setenta');
		const { figure } = fig();
		expect(renameFigure(db, figure.groupId!, ' setenta')).toBe(false);
	});

	it('allows its own name in another case', () => {
		const { figure } = fig();
		expect(renameFigure(db, figure.groupId!, 'ENCHUFLA')).toBe(true);
	});
});

describe('labels and lists', () => {
	it('figureLabels always shows both names', () => {
		const { figure } = fig('Setenta');
		expect(figureLabels(db, 'salsa').get(figure.id)).toBe('Setenta · Basic');
	});

	it('listFigures is one row per figure', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		const gone = createVariationFrom(db, figure.id, 'Old')!;
		db.update(figures).set({ archivedAt: 1000 }).where(eq(figures.id, gone.id)).run();
		addRecording(db, {
			figureId: v2.id,
			file: 'b.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		expect(listFigures(db, 'salsa', {})).toEqual([
			{
				id: figure.groupId,
				name: 'Enchufla',
				variations: 2,
				recordings: 1,
				firstVariationId: figure.id
			}
		]);
	});

	it('listFigures filters by any variation', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		fig('Setenta');
		updateVariation(db, v2.id, input('Doble', { partner: 'solo' }));
		expect(listFigures(db, 'salsa', { q: 'doble' }).map((f) => f.name)).toEqual(['Enchufla']);
		expect(listFigures(db, 'salsa', { partner: 'solo' }).map((f) => f.name)).toEqual(['Enchufla']);
	});

	it('listVersions lists variations with their figure', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		expect(listVersions(db, 'salsa')).toEqual([
			{
				id: figure.id,
				groupId: figure.groupId,
				figure: 'Enchufla',
				name: 'Basic',
				label: 'Enchufla · Basic'
			},
			{
				id: v2.id,
				groupId: figure.groupId,
				figure: 'Enchufla',
				name: 'Doble',
				label: 'Enchufla · Doble'
			}
		]);
	});

	it('listFiguresForCall says the figure name', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		expect(listFiguresForCall(db, 'salsa', [v2.id])).toEqual([
			{ id: v2.id, name: 'Enchufla · Doble', say: 'Enchufla' }
		]);
	});
});

describe('addFigureExercise', () => {
	it('works on any variation and names it with the label', () => {
		const { figure } = fig();
		const v2 = createVariationFrom(db, figure.id, 'Doble')!;
		expect(addFigureExercise(db, v2.id)!.name).toBe('Enchufla · Doble');
	});
});
