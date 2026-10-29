import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, figureGroups, figures, lessonFigures, spotLinks } from './db/schema';
import { addRecording, createFigure, createVariationFrom, getGroup } from './figures';
import { addLessonVideo, createLesson, getLesson, linkExercise, linkFigure } from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkSpot, SpotLinkError, unlinkFromSection } from './spot-links';
import { createAndLink, linkOptions } from './link-popup';

let db: Db;
let lessonId: number;
let basic: number;
let doble: number;
let enchufla: number;
let drill: number;
let section: number;
let other: number;
let point: number;
let recSection: number;

const fig = (
	dance: 'salsa' | 'bachata',
	figureName: string,
	partner: 'partner' | 'solo' = 'partner'
) =>
	createFigure(db, dance, {
		figureName,
		name: 'Basic',
		partner,
		style: dance === 'salsa' ? 'son' : 'sensual',
		notes: null
	})!.figure;

beforeEach(() => {
	db = openDb(':memory:');
	const b = fig('salsa', 'Enchufla', 'solo');
	basic = b.id;
	enchufla = b.groupId!;
	doble = createVariationFrom(db, basic, 'Doble')!.id;
	fig('salsa', 'Setenta');
	fig('bachata', 'Paseo');
	drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null }).id;
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
		.lesson.id;
	const videoId = addLessonVideo(db, {
		lessonId,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(
		db,
		{ lessonVideoId: videoId },
		{ startMs: 42000, endMs: 55000, label: 'X' }
	)!.id;
	other = addSpot(
		db,
		{ lessonVideoId: videoId },
		{ startMs: 60000, endMs: 65000, label: null }
	)!.id;
	point = addSpot(db, { lessonVideoId: videoId }, { startMs: 1000, endMs: null, label: null })!.id;
	const recordingId = addRecording(db, {
		figureId: basic,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 1,
		note: null
	}).id;
	recSection = addSpot(db, { recordingId }, { startMs: 0, endMs: 3000, label: null })!.id;
});

const labels = (xs: { label: string }[]) => xs.map((x) => x.label);

describe('linkOptions', () => {
	it("gives a lesson video's section its lesson, the lesson's variations first", () => {
		linkFigure(db, lessonId, basic);
		const o = linkOptions(db, section, 'salsa')!;
		expect(o.dance).toBe('salsa');
		expect(o.spot).toEqual({ id: section, startMs: 42000, endMs: 55000, label: 'X' });
		expect(o.context).toEqual({ kind: 'lesson', lessonId, title: 'Cubana' });
		expect(o.linked).toEqual([]);
		expect(labels(o.near)).toEqual(['Enchufla · Basic']);
		expect(labels(o.other)).toEqual(['Clave', 'Enchufla · Doble', 'Setenta · Basic']);
		expect(o.other.find((x) => x.label === 'Clave')).toEqual({
			target: { exerciseId: drill },
			label: 'Clave',
			drill: true
		});
		expect(o.figures[0]).toEqual({
			groupId: enchufla,
			name: 'Enchufla',
			variations: ['Basic', 'Doble'],
			near: true
		});
		expect(o.figures.map((f) => f.name)).toEqual(['Enchufla', 'Setenta']);
		expect(o.defaults).toEqual({ partner: 'partner', style: 'salsa' });
	});

	it('moves a linked target to Linked, marking whether it is also linked by hand', () => {
		linkSpot(db, section, { figureId: doble });
		let o = linkOptions(db, section, 'salsa')!;
		expect(o.linked).toEqual([
			{
				linkId: expect.any(Number),
				target: { figureId: doble },
				label: 'Enchufla · Doble',
				drill: false,
				archived: false,
				alsoByHand: false
			}
		]);
		expect(labels([...o.near, ...o.other])).not.toContain('Enchufla · Doble');
		linkFigure(db, lessonId, doble);
		o = linkOptions(db, section, 'salsa')!;
		expect(o.linked[0].alsoByHand).toBe(true);
	});

	it("puts what another section of the lesson links among the lesson's own", () => {
		linkSpot(db, other, { exerciseId: drill });
		expect(labels(linkOptions(db, section, 'salsa')!.near)).toEqual(['Clave']);
	});

	it("gives a recording's section its figure's variations first", () => {
		const o = linkOptions(db, recSection, 'salsa')!;
		expect(o.context).toEqual({ kind: 'recording', groupId: enchufla, figure: 'Enchufla' });
		expect(labels(o.near)).toEqual(['Enchufla · Basic', 'Enchufla · Doble']);
		expect(o.figures[0]).toMatchObject({ groupId: enchufla, near: true });
	});

	it('is null for a point or a missing spot', () => {
		expect(linkOptions(db, point, 'salsa')).toBeNull();
		expect(linkOptions(db, 9999, 'salsa')).toBeNull();
	});
});

describe('createAndLink', () => {
	it('makes a variation in the figure, copying partner and style from its first, and links it', () => {
		const linkId = createAndLink(db, section, {
			kind: 'variation',
			groupId: enchufla,
			name: 'Triple'
		});
		const made = db.select().from(figures).where(eq(figures.name, 'Triple')).get()!;
		expect(made).toMatchObject({
			groupId: enchufla,
			partner: 'solo',
			styleTag: 'son',
			notes: null
		});
		expect(db.select().from(spotLinks).where(eq(spotLinks.id, linkId)).get()).toMatchObject({
			spotId: section,
			figureId: made.id
		});
		expect(getLesson(db, lessonId)!.figures).toEqual([
			expect.objectContaining({ id: made.id, byHand: false })
		]);
	});

	it('makes a figure with its first variation, and links it', () => {
		createAndLink(db, section, {
			kind: 'figure',
			figureName: 'Sombrero',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa'
		});
		expect(labels(linkOptions(db, section, 'salsa')!.linked)).toEqual(['Sombrero · Basic']);
	});

	it('makes a drill, and links it', () => {
		createAndLink(db, section, { kind: 'drill', name: 'Arm styling', everyDays: 7 });
		const made = db.select().from(exercises).where(eq(exercises.name, 'Arm styling')).get()!;
		expect(made).toMatchObject({ source: 'custom', everyDays: 7, dance: 'salsa' });
		expect(labels(linkOptions(db, section, 'salsa')!.linked)).toEqual(['Arm styling']);
	});

	it.each([
		[{ kind: 'variation', groupId: 0, name: 'Doble' }, 'Enchufla already has a Doble.'],
		[
			{
				kind: 'figure',
				figureName: ' enchufla ',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa'
			},
			"There's already a figure called enchufla."
		],
		[
			{
				kind: 'figure',
				figureName: 'Sombrero',
				name: 'Basic',
				partner: 'partner',
				style: 'sensual'
			},
			'That style does not belong to this dance.'
		],
		[{ kind: 'drill', name: 'Arm', everyDays: 5 }, 'Pick how often.'],
		[{ kind: 'drill', name: '  ', everyDays: 3 }, 'Give it a name.']
	] as const)('refuses %o', (create, message) => {
		const c = create.kind === 'variation' ? { ...create, groupId: enchufla } : create;
		expect(() => createAndLink(db, section, c)).toThrow(new SpotLinkError(message));
	});

	it('leaves nothing behind when the link fails', () => {
		const figuresBefore = db.select().from(figures).all().length;
		const groupsBefore = db.select().from(figureGroups).all().length;
		expect(() =>
			createAndLink(db, point, {
				kind: 'figure',
				figureName: 'Sombrero',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa'
			})
		).toThrow(SpotLinkError);
		expect(db.select().from(figures).all()).toHaveLength(figuresBefore);
		expect(db.select().from(figureGroups).all()).toHaveLength(groupsBefore);
		expect(() => createAndLink(db, point, { kind: 'drill', name: 'Arm', everyDays: 3 })).toThrow(
			SpotLinkError
		);
		expect(db.select().from(exercises).where(eq(exercises.name, 'Arm')).all()).toEqual([]);
	});

	it("refuses another dance's figure and adds no variation to it", () => {
		const paseo = db.select().from(figureGroups).where(eq(figureGroups.name, 'Paseo')).get()!;
		const before = db.select().from(figures).all().length;
		expect(() =>
			createAndLink(db, section, { kind: 'variation', groupId: paseo.id, name: 'Nuevo' })
		).toThrow(SpotLinkError);
		expect(db.select().from(figures).all()).toHaveLength(before);
		expect(getGroup(db, paseo.id)!.archivedAt).toBeNull();
	});
});

describe('unlinkFromSection', () => {
	it('keeps the hand link unless asked', () => {
		linkFigure(db, lessonId, doble);
		const link = linkSpot(db, section, { figureId: doble });
		expect(unlinkFromSection(db, section, link, false)).toBe(true);
		expect(db.select().from(lessonFigures).all()).toHaveLength(1);
		expect(db.select().from(spotLinks).all()).toHaveLength(0);
	});

	it('removes the hand link too when asked', () => {
		linkFigure(db, lessonId, doble);
		linkExercise(db, lessonId, drill);
		const link = linkSpot(db, section, { figureId: doble });
		const drillLink = linkSpot(db, section, { exerciseId: drill });
		expect(unlinkFromSection(db, section, link, true)).toBe(true);
		expect(unlinkFromSection(db, section, drillLink, true)).toBe(true);
		expect(getLesson(db, lessonId)!.figures).toEqual([]);
		expect(getLesson(db, lessonId)!.exercises).toEqual([]);
	});

	it("refuses another spot's link and deletes nothing", () => {
		const link = linkSpot(db, other, { figureId: doble });
		expect(unlinkFromSection(db, section, link, true)).toBe(false);
		expect(db.select().from(spotLinks).all()).toHaveLength(1);
	});
});
