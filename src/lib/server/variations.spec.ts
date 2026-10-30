import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	figureStartPositions,
	lessonFigures,
	links,
	recordings,
	routines,
	routineSteps,
	routineStepOptions,
	sets,
	spotLinks,
	videoSpots
} from './db/schema';
import {
	addFigureExercise,
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom,
	createVariationIn,
	figureLabels,
	isLastVariation,
	listFigures,
	listFiguresForCall,
	listVersions,
	moveVariation,
	renameFigure,
	updateVariation
} from './figures';
import { addLessonVideo, archiveLesson, createLesson, linkFigure } from './lessons';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
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

describe('createVariationIn', () => {
	it('makes a blank variation in an existing figure', () => {
		seedPositions(db);
		const pos = listPositions(db, 'salsa');
		const { figure: sibling, group } = fig();
		setFigureShape(db, sibling.id, {
			startIds: [pos[0].id],
			endId: pos[1].id,
			startCount: 3,
			lengthCounts: 4
		});
		const made = createVariationIn(db, group.id, {
			...input('Doble', { partner: 'solo' }),
			notes: 'Two turns'
		})!;
		expect(made.id).not.toBe(sibling.id);
		expect(made).toMatchObject({
			groupId: group.id,
			dance: 'salsa',
			name: 'Doble',
			partner: 'solo',
			styleTag: 'salsa',
			notes: 'Two turns',
			endPositionId: null,
			startCount: 1,
			lengthCounts: 8,
			parentId: null
		});
		expect(
			db.select().from(figureStartPositions).where(eq(figureStartPositions.figureId, made.id)).all()
		).toEqual([]);
		expect(db.select().from(exercises).where(eq(exercises.figureId, made.id)).all()).toEqual([]);
		expect(figureLabels(db, 'salsa').get(made.id)).toBe('Enchufla · Doble');
	});

	it('refuses a taken name, an archived group, and another dance’s style', () => {
		const { figure, group } = fig();
		expect(createVariationIn(db, group.id, input(' basic '))).toBeNull();
		expect(createVariationIn(db, group.id, input('  '))).toBeNull();
		expect(createVariationIn(db, group.id, input('Doble', { style: 'dominican' }))).toBeNull();
		expect(createVariationIn(db, 9999, input('Doble'))).toBeNull();
		archiveVariation(db, figure.id, 1);
		expect(createVariationIn(db, group.id, input('Doble'))).toBeNull();
		expect(db.select().from(figures).all()).toHaveLength(1);
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
				firstVariationId: figure.id,
				hasSection: false,
				hasLesson: false
			}
		]);
	});

	describe('section and lesson links', () => {
		const flags = () =>
			Object.fromEntries(
				listFigures(db, 'salsa', {}).map((f) => [f.name, [f.hasSection, f.hasLesson]])
			);
		const lessonVideo = (lessonId: number) =>
			addLessonVideo(db, { lessonId, file: `${lessonId}.mp4`, mime: 'video/mp4', sizeBytes: 1 }).id;
		const section = (owner: { lessonVideoId: number } | { recordingId: number }) =>
			addSpot(db, owner, { startMs: 0, endMs: 1000, label: null })!.id;

		it('says a figure has a section when any variation is linked to one, on a recording too', () => {
			const { figure } = fig();
			const doble = createVariationFrom(db, figure.id, 'Doble')!;
			fig('Setenta');
			const rec = addRecording(db, {
				figureId: figure.id,
				file: 'r.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			linkSpot(db, section({ recordingId: rec.id }), { figureId: doble.id });

			expect(flags()).toEqual({ Enchufla: [true, false], Setenta: [false, false] });
		});

		it('says a figure has a lesson when a live lesson reaches it, by hand or through a section', () => {
			const { figure: enchufla } = fig();
			const { figure: setenta } = fig('Setenta');
			const { figure: vacilala } = fig('Vacilala');
			const lesson = createLesson(db, 'salsa', {
				lessonDay: '2026-10-28',
				title: 'Class',
				notes: null
			}).lesson;
			const gone = createLesson(db, 'salsa', {
				lessonDay: '2026-10-21',
				title: 'Old class',
				notes: null
			}).lesson;
			linkFigure(db, lesson.id, enchufla.id);
			linkSpot(db, section({ lessonVideoId: lessonVideo(lesson.id) }), { figureId: setenta.id });
			linkFigure(db, gone.id, vacilala.id);
			archiveLesson(db, gone.id, 1000);

			expect(flags()).toEqual({
				Enchufla: [false, true],
				Setenta: [true, true],
				Vacilala: [false, false]
			});
		});

		it('filters to the figures missing either link', () => {
			const { figure: enchufla } = fig();
			fig('Setenta');
			const lesson = createLesson(db, 'salsa', {
				lessonDay: '2026-10-28',
				title: 'Class',
				notes: null
			}).lesson;
			linkSpot(db, section({ lessonVideoId: lessonVideo(lesson.id) }), {
				figureId: enchufla.id
			});

			expect(listFigures(db, 'salsa', { unlinked: true }).map((f) => f.name)).toEqual(['Setenta']);
		});
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

describe('moveVariation', () => {
	it('moves into another figure and takes everything with it', () => {
		const a = fig('Enchufla', 'Doble');
		const b = fig('Setenta', 'Basic');
		createVariationFrom(db, a.figure.id, 'Simple'); // keeps Enchufla alive
		const id = a.figure.id;
		const rec = addRecording(db, {
			figureId: id,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		const lesson = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'L', notes: null })
			.lesson.id;
		const spot = db
			.insert(videoSpots)
			.values({ recordingId: rec.id, startMs: 0, endMs: 1000 })
			.returning()
			.get();
		const sl = db.insert(spotLinks).values({ spotId: spot.id, figureId: id }).returning().get();
		const link = db
			.insert(links)
			.values({ figureId: id, url: 'https://example.com' })
			.returning()
			.get();
		db.insert(lessonFigures).values({ lessonId: lesson, figureId: id }).run();
		const ex = addFigureExercise(db, id)!;
		db.insert(sets).values({ exerciseId: ex.id, doneAt: 1 }).run();
		const r = db.insert(routines).values({ name: 'R' }).returning().get();
		const step = db.insert(routineSteps).values({ routineId: r.id, position: 0 }).returning().get();
		db.insert(routineStepOptions).values({ stepId: step.id, figureId: id }).run();

		expect(moveVariation(db, id, { groupId: b.group.id })).toEqual({
			ok: true,
			groupId: b.group.id,
			figureRemoved: false
		});

		expect(db.select().from(figures).where(eq(figures.id, id)).get()!.groupId).toBe(b.group.id);
		expect(db.select().from(recordings).get()!.figureId).toBe(id);
		expect(db.select().from(spotLinks).where(eq(spotLinks.id, sl.id)).get()!.figureId).toBe(id);
		expect(db.select().from(links).where(eq(links.id, link.id)).get()!.figureId).toBe(id);
		expect(db.select().from(lessonFigures).get()!.figureId).toBe(id);
		expect(db.select().from(routineStepOptions).get()!.figureId).toBe(id);
		const exNow = db.select().from(exercises).where(eq(exercises.id, ex.id)).get()!;
		expect(exNow.figureId).toBe(id);
		expect(exNow.name).toBe('Setenta · Doble');
		expect(db.select().from(sets).get()!.exerciseId).toBe(ex.id);
	});

	it('makes a new figure', () => {
		const a = fig('Enchufla', 'Doble');
		createVariationFrom(db, a.figure.id, 'Simple');
		const res = moveVariation(db, a.figure.id, { newFigure: ' Enchufla Doble ' });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const group = db.select().from(figureGroups).where(eq(figureGroups.id, res.groupId)).get()!;
		expect(group.dance).toBe('salsa');
		expect(group.name).toBe('Enchufla Doble');
		const moved = db.select().from(figures).where(eq(figures.id, a.figure.id)).get()!;
		expect(moved.groupId).toBe(group.id);
		expect(moved.name).toBe('Doble');
	});

	it('removes the figure it leaves when it was the last', () => {
		const a = fig('Enchufla', 'Doble');
		const res = moveVariation(db, a.figure.id, { newFigure: 'Other' });
		expect(res).toMatchObject({ ok: true, figureRemoved: true });
		expect(getGroupRow(a.group.id).archivedAt).not.toBeNull();

		const b = fig('Setenta', 'Basic');
		createVariationFrom(db, b.figure.id, 'Simple');
		expect(moveVariation(db, b.figure.id, { newFigure: 'Setenta 2' })).toMatchObject({
			ok: true,
			figureRemoved: false
		});
		expect(getGroupRow(b.group.id).archivedAt).toBeNull();
	});

	it('refuses its own figure', () => {
		const a = fig();
		expect(moveVariation(db, a.figure.id, { groupId: a.group.id })).toEqual({
			ok: false,
			reason: 'same-figure'
		});
		expect(getGroupRow(a.group.id).archivedAt).toBeNull();
	});

	it('refuses a taken variation name', () => {
		const a = fig('Enchufla', 'Doble');
		const b = fig('Setenta', 'doble');
		expect(moveVariation(db, a.figure.id, { groupId: b.group.id })).toEqual({
			ok: false,
			reason: 'name-taken'
		});
		expect(db.select().from(figures).where(eq(figures.id, a.figure.id)).get()!.groupId).toBe(
			a.group.id
		);
	});

	it('renames on the way in', () => {
		const a = fig('Enchufla', 'Doble');
		createVariationFrom(db, a.figure.id, 'Simple');
		const b = fig('Setenta', 'doble');
		const ex = addFigureExercise(db, a.figure.id)!;
		expect(moveVariation(db, a.figure.id, { groupId: b.group.id })).toEqual({
			ok: false,
			reason: 'name-taken'
		});
		expect(moveVariation(db, a.figure.id, { groupId: b.group.id, name: ' Doble 2 ' })).toEqual({
			ok: true,
			groupId: b.group.id,
			figureRemoved: false
		});
		const row = db.select().from(figures).where(eq(figures.id, a.figure.id)).get()!;
		expect([row.groupId, row.name]).toEqual([b.group.id, 'Doble 2']);
		expect(db.select().from(exercises).where(eq(exercises.id, ex.id)).get()!.name).toBe(
			'Setenta · Doble 2'
		);
	});

	it('refuses a new name that is taken in the target', () => {
		const a = fig('Enchufla', 'Doble');
		const b = fig('Setenta', 'Basic');
		createVariationFrom(db, b.figure.id, 'Simple');
		expect(moveVariation(db, a.figure.id, { groupId: b.group.id, name: ' simple ' })).toEqual({
			ok: false,
			reason: 'name-taken'
		});
		const row = db.select().from(figures).where(eq(figures.id, a.figure.id)).get()!;
		expect([row.groupId, row.name]).toEqual([a.group.id, 'Doble']);
	});

	it('refuses a taken or empty figure name', () => {
		const a = fig('Enchufla', 'Doble');
		fig('Setenta', 'Basic');
		const taken = { ok: false, reason: 'figure-name-taken' };
		expect(moveVariation(db, a.figure.id, { newFigure: ' setenta ' })).toEqual(taken);
		expect(moveVariation(db, a.figure.id, { newFigure: '  ' })).toEqual(taken);
		expect(db.select().from(figureGroups).all()).toHaveLength(2);
		expect(getGroupRow(a.group.id).archivedAt).toBeNull();
	});

	it('refuses a group of another dance, an archived one, and a gone variation', () => {
		const a = fig('Enchufla', 'Doble');
		const bach = fig('Enchufla', 'Doble', 'bachata');
		expect(moveVariation(db, a.figure.id, { groupId: bach.group.id })).toEqual({
			ok: false,
			reason: 'gone'
		});
		const dead = fig('Dead', 'Basic');
		archiveVariation(db, dead.figure.id, 1);
		expect(moveVariation(db, a.figure.id, { groupId: dead.group.id })).toMatchObject({
			ok: false,
			reason: 'gone'
		});
		expect(moveVariation(db, dead.figure.id, { newFigure: 'X' })).toMatchObject({
			ok: false,
			reason: 'gone'
		});
		expect(moveVariation(db, a.figure.id, { groupId: 9999 })).toMatchObject({ reason: 'gone' });
		expect(db.select().from(figures).where(eq(figures.id, a.figure.id)).get()!.groupId).toBe(
			a.group.id
		);
	});
});

describe('archiveVariation', () => {
	it('archives its exercise and, when last, its figure', () => {
		const a = fig();
		const ex = addFigureExercise(db, a.figure.id)!;
		expect(isLastVariation(db, a.figure.id)).toBe(true);
		expect(archiveVariation(db, a.figure.id, 5)).toEqual({ figureRemoved: true });
		expect(db.select().from(exercises).where(eq(exercises.id, ex.id)).get()!.archivedAt).toBe(5);
		expect(getGroupRow(a.group.id).archivedAt).toBe(5);
		expect(archiveVariation(db, a.figure.id, 6)).toBeNull();
		expect(archiveVariation(db, 9999, 6)).toBeNull();
	});

	it('keeps the figure while a sibling is left', () => {
		const a = fig();
		const v2 = createVariationFrom(db, a.figure.id, 'Doble')!;
		expect(isLastVariation(db, a.figure.id)).toBe(false);
		expect(archiveVariation(db, v2.id, 5)).toEqual({ figureRemoved: false });
		expect(getGroupRow(a.group.id).archivedAt).toBeNull();
		expect(isLastVariation(db, a.figure.id)).toBe(true);
	});
});

describe('figure groups stay consistent', () => {
	it('never leaves a live variation in an archived figure', () => {
		const a = fig('A', 'One');
		const a2 = createVariationFrom(db, a.figure.id, 'Two')!;
		const b = fig('B', 'One');
		const c = fig('C', 'Three');
		moveVariation(db, a2.id, { groupId: b.group.id });
		moveVariation(db, a.figure.id, { groupId: c.group.id }); // A now empty
		archiveVariation(db, b.figure.id, 10);
		moveVariation(db, c.figure.id, { newFigure: 'D' });
		archiveVariation(db, a2.id, 11);
		const bad = db
			.select({ id: figures.id })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(and(isNull(figures.archivedAt), isNotNull(figureGroups.archivedAt)))
			.all();
		expect(bad).toEqual([]);
	});
});

function getGroupRow(id: number) {
	return db.select().from(figureGroups).where(eq(figureGroups.id, id)).get()!;
}
