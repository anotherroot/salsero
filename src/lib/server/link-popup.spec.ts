import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, figureGroups, figures, lessonFigures, spotLinks } from './db/schema';
import { addRecording, createFigure, createVariationFrom, getGroup } from './figures';
import {
	addLessonVideo,
	createLesson,
	getLesson,
	linkExercise,
	linkFigure,
	publishLesson
} from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkSpot, SpotLinkError, unlinkFromSection } from './spot-links';
import { createAndLink, createAndLinkIn, linkOptions, linkOptionsFor } from './link-popup';
import { createTeam, joinTeam } from './teams';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';

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
	createFigure(
		db,
		{ userId: 'u1', dance },
		{
			figureName,
			name: 'Basic',
			partner,
			style: dance === 'salsa' ? 'son' : 'sensual',
			notes: null
		}
	)!.figure;

beforeEach(() => {
	db = openDb(':memory:');
	const b = fig('salsa', 'Enchufla', 'solo');
	basic = b.id;
	enchufla = b.groupId!;
	doble = createVariationFrom(db, basic, 'Doble')!.id;
	fig('salsa', 'Setenta');
	fig('bachata', 'Paseo');
	drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
	lessonId = createLesson(db, U1_SALSA, { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
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
		expect(o.nearTitle).toBe('In this lesson');
		expect(labels(o.near)).toEqual(['Enchufla · Basic', 'Enchufla · Doble']);
		expect(labels(o.figures)).toEqual(['Setenta · Basic']);
		expect(o.drills).toEqual([
			{
				target: { exerciseId: drill },
				label: 'Clave',
				drill: true,
				figure: null,
				name: 'Clave',
				everyDays: 3,
				linked: false
			}
		]);
		expect(o.figureChoices[0]).toEqual({
			groupId: enchufla,
			name: 'Enchufla',
			variations: ['Basic', 'Doble'],
			near: true
		});
		expect(o.figureChoices.map((f) => f.name)).toEqual(['Enchufla', 'Setenta']);
		expect(o.defaults).toEqual({ partner: 'partner', style: 'salsa' });
	});

	it('moves a linked target to Linked, marking whether it is also linked by hand', () => {
		linkSpot(db, 'u1', section, { figureId: doble });
		let o = linkOptions(db, section, 'salsa')!;
		expect(o.linked).toEqual([
			{
				linkId: expect.any(Number),
				target: { figureId: doble },
				label: 'Enchufla · Doble',
				drill: false,
				figure: 'Enchufla',
				name: 'Doble',
				everyDays: null,
				linked: true,
				archived: false,
				alsoByHand: false
			}
		]);
		linkFigure(db, lessonId, doble);
		o = linkOptions(db, section, 'salsa')!;
		expect(o.linked[0].alsoByHand).toBe(true);
	});

	it("puts what another section of the lesson links among the lesson's own", () => {
		linkSpot(db, 'u1', other, { exerciseId: drill });
		expect(labels(linkOptions(db, section, 'salsa')!.near)).toEqual(['Clave']);
		expect(linkOptions(db, section, 'salsa')!.near[0].linked).toBe(false);
	});

	it("gives a recording's section its figure's variations first", () => {
		const o = linkOptions(db, recSection, 'salsa')!;
		expect(o.context).toEqual({ kind: 'recording', groupId: enchufla, figure: 'Enchufla' });
		expect(o.nearTitle).toBe('This figure');
		expect(labels(o.near)).toEqual(['Enchufla · Basic', 'Enchufla · Doble']);
		expect(o.figureChoices[0]).toMatchObject({ groupId: enchufla, near: true });
	});

	it('lesson: near holds every live variation of each figure the lesson teaches, by hand or through sections, and the lesson drills', () => {
		linkFigure(db, lessonId, basic);
		linkExercise(db, lessonId, drill);
		const o = linkOptions(db, section, 'salsa')!;
		expect(labels(o.near)).toEqual(['Enchufla · Basic', 'Enchufla · Doble', 'Clave']);
		// Through a section of the lesson's other clip.
		const via = linkOptions(db, other, 'salsa')!;
		expect(labels(via.near)).toEqual(labels(o.near));
	});

	it('lesson: a figure taught only through another section still widens near to all its variations', () => {
		// No linkFigure: the lesson reaches Basic only through a section's link.
		linkSpot(db, 'u1', other, { figureId: basic });
		const o = linkOptions(db, section, 'salsa')!;
		expect(labels(o.near)).toEqual(['Enchufla · Basic', 'Enchufla · Doble']);
		expect(labels(o.figures)).toEqual(['Setenta · Basic']);
	});

	it('a target already linked to the section is listed with linked true, not left out', () => {
		linkFigure(db, lessonId, basic);
		linkSpot(db, 'u1', section, { figureId: doble });
		linkSpot(db, 'u1', section, { exerciseId: drill });
		const o = linkOptions(db, section, 'salsa')!;
		expect(o.near.map((x) => [x.label, x.linked])).toEqual([
			['Enchufla · Basic', false],
			['Enchufla · Doble', true],
			['Clave', true]
		]);
	});

	it('figures and drills hold the rest; nothing appears twice', () => {
		linkFigure(db, lessonId, basic);
		const o = linkOptions(db, section, 'salsa')!;
		expect(labels(o.figures)).toEqual(['Setenta · Basic']);
		expect(labels(o.drills)).toEqual(['Clave']);
		const all = [...o.near, ...o.figures, ...o.drills].map((x) => JSON.stringify(x.target));
		expect(new Set(all).size).toBe(all.length);
	});

	it('figureChoices lists near figures first', () => {
		const setenta = linkOptions(db, section, 'salsa')!.figureChoices.find(
			(f) => f.name === 'Setenta'
		)!;
		linkFigure(
			db,
			lessonId,
			db.select().from(figures).where(eq(figures.groupId, setenta.groupId)).get()!.id
		);
		const o = linkOptions(db, section, 'salsa')!;
		expect(o.figureChoices.map((f) => [f.name, f.near])).toEqual([
			['Setenta', true],
			['Enchufla', false]
		]);
	});

	it('is null for a point or a missing spot', () => {
		expect(linkOptions(db, point, 'salsa')).toBeNull();
		expect(linkOptions(db, 9999, 'salsa')).toBeNull();
	});
});

describe('createAndLink', () => {
	it('makes a variation in the figure, copying partner and style from its first, and links it', () => {
		const linkId = createAndLink(db, 'u1', section, {
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
		expect(getLesson(db, lessonId, 'u1')!.figures).toEqual([
			expect.objectContaining({ id: made.id, byHand: false })
		]);
	});

	it('makes a figure with its first variation, and links it', () => {
		createAndLink(db, 'u1', section, {
			kind: 'figure',
			figureName: 'Sombrero',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa'
		});
		expect(labels(linkOptions(db, section, 'salsa')!.linked)).toEqual(['Sombrero · Basic']);
	});

	it('makes a drill, and links it', () => {
		createAndLink(db, 'u1', section, { kind: 'drill', name: 'Arm styling', everyDays: 7 });
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
			"There's already a move called enchufla."
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
		expect(() => createAndLink(db, 'u1', section, c)).toThrow(
			expect.objectContaining({ message, status: 400 })
		);
	});

	it.each([
		[{ kind: 'variation', groupId: 0, name: ' ' }, 'name'],
		[{ kind: 'variation', groupId: -1, name: 'Nuevo' }, 'groupId'],
		[{ kind: 'variation', groupId: 0, name: 'Doble' }, 'name'],
		[
			{ kind: 'figure', figureName: ' ', name: 'Basic', partner: 'partner', style: 'salsa' },
			'figureName'
		],
		[
			{ kind: 'figure', figureName: 'Enchufla', name: 'Basic', partner: 'partner', style: 'salsa' },
			'figureName'
		],
		[
			{ kind: 'figure', figureName: 'Sombrero', name: ' ', partner: 'partner', style: 'salsa' },
			'name'
		],
		[
			{
				kind: 'figure',
				figureName: 'Sombrero',
				name: 'Basic',
				partner: 'partner',
				style: 'sensual'
			},
			'style'
		],
		[{ kind: 'drill', name: 'Arm', everyDays: 5 }, 'everyDays'],
		[{ kind: 'drill', name: '', everyDays: 3 }, 'name']
	] as const)('names the field of a refusal of %o', (create, field) => {
		// groupId 0 is Enchufla; -1 is Paseo, a figure of the other dance.
		const paseo = db.select().from(figureGroups).where(eq(figureGroups.name, 'Paseo')).get()!;
		const c =
			create.kind === 'variation'
				? { ...create, groupId: create.groupId === 0 ? enchufla : paseo.id }
				: create;
		expect(() => createAndLink(db, 'u1', section, c)).toThrow(expect.objectContaining({ field }));
	});

	it('names no field when the section is the problem', () => {
		const thrown = (() => {
			try {
				createAndLink(db, 'u1', point, { kind: 'drill', name: 'Arm', everyDays: 3 });
			} catch (e) {
				return e;
			}
		})();
		expect(thrown).toBeInstanceOf(SpotLinkError);
		expect((thrown as SpotLinkError).field).toBeUndefined();
	});

	it('leaves nothing behind when the link fails', () => {
		const figuresBefore = db.select().from(figures).all().length;
		const groupsBefore = db.select().from(figureGroups).all().length;
		expect(() =>
			createAndLink(db, 'u1', point, {
				kind: 'figure',
				figureName: 'Sombrero',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa'
			})
		).toThrow(SpotLinkError);
		expect(db.select().from(figures).all()).toHaveLength(figuresBefore);
		expect(db.select().from(figureGroups).all()).toHaveLength(groupsBefore);
		expect(() =>
			createAndLink(db, 'u1', point, { kind: 'drill', name: 'Arm', everyDays: 3 })
		).toThrow(SpotLinkError);
		expect(db.select().from(exercises).where(eq(exercises.name, 'Arm')).all()).toEqual([]);
	});

	it("refuses another dance's figure and adds no variation to it", () => {
		const paseo = db.select().from(figureGroups).where(eq(figureGroups.name, 'Paseo')).get()!;
		const before = db.select().from(figures).all().length;
		expect(() =>
			createAndLink(db, 'u1', section, { kind: 'variation', groupId: paseo.id, name: 'Nuevo' })
		).toThrow(SpotLinkError);
		expect(db.select().from(figures).all()).toHaveLength(before);
		expect(getGroup(db, paseo.id)!.archivedAt).toBeNull();
	});
});

describe('unlinkFromSection', () => {
	it('keeps the hand link unless asked', () => {
		linkFigure(db, lessonId, doble);
		const link = linkSpot(db, 'u1', section, { figureId: doble });
		expect(unlinkFromSection(db, section, link, false)).toBe(true);
		expect(db.select().from(lessonFigures).all()).toHaveLength(1);
		expect(db.select().from(spotLinks).all()).toHaveLength(0);
	});

	it('removes the hand link too when asked', () => {
		linkFigure(db, lessonId, doble);
		linkExercise(db, lessonId, drill);
		const link = linkSpot(db, 'u1', section, { figureId: doble });
		const drillLink = linkSpot(db, 'u1', section, { exerciseId: drill });
		expect(unlinkFromSection(db, section, link, true)).toBe(true);
		expect(unlinkFromSection(db, section, drillLink, true)).toBe(true);
		expect(getLesson(db, lessonId, 'u1')!.figures).toEqual([]);
		expect(getLesson(db, lessonId, 'u1')!.exercises).toEqual([]);
	});

	it("refuses another spot's link and deletes nothing", () => {
		const link = linkSpot(db, 'u1', other, { figureId: doble });
		expect(unlinkFromSection(db, section, link, true)).toBe(false);
		expect(db.select().from(spotLinks).all()).toHaveLength(1);
	});
});

describe('in a group', () => {
	function teamSection() {
		const teamLesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-10-12',
			title: 'Group class',
			notes: null
		}).lesson.id;
		const video = addLessonVideo(
			db,
			{
				lessonId: teamLesson,
				file: 't.mp4',
				mime: 'video/mp4',
				sizeBytes: 1
			},
			'u1'
		).id;
		return addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 2000, label: null }, 'u1')!
			.id;
	}

	it("offers a group's section only the group's figures and drills", () => {
		const s = teamSection();
		createFigure(db, T1_SALSA, {
			figureName: 'Group figure',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		});
		createCustomExercise(db, T1_SALSA, { name: 'Group drill', everyDays: 3, notes: null });
		const options = linkOptions(db, s, 'salsa')!;
		expect(labels([...options.near, ...options.figures, ...options.drills])).toEqual([
			'Group figure · Basic',
			'Group drill'
		]);
		expect(options.figureChoices.map((f) => f.name)).toEqual(['Group figure']);
	});

	it("makes what it links in the group, and refuses a person's figure", () => {
		const s = teamSection();
		createAndLinkIn(db, T1_SALSA, s, {
			kind: 'figure',
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa'
		});
		createAndLinkIn(db, T1_SALSA, s, { kind: 'drill', name: 'Clave', everyDays: 3 });
		const made = db.select().from(figureGroups).where(eq(figureGroups.teamId, 1)).all();
		expect(made.map((g) => g.name)).toEqual(['Enchufla']);
		expect(db.select().from(exercises).where(eq(exercises.teamId, 1)).get()).toMatchObject({
			name: 'Clave',
			userId: null,
			songId: null
		});
		expect(() =>
			createAndLinkIn(db, T1_SALSA, s, { kind: 'variation', groupId: enchufla, name: 'Triple' })
		).toThrow('No such move.');
		// A person reaching a group's section by id is answered as missing.
		expect(() =>
			createAndLink(db, 'u1', s, { kind: 'drill', name: 'Other', everyDays: 3 })
		).toThrow('No such section.');
	});
});

describe("the Link popup on a person's own video", () => {
	/**
	 * Salsa Tuesdays (u1's, u2 a member): F (Setenta) and drill D in published
	 * lesson L, which u2 added; H only in published L2. u2's own lesson
	 * "My notes" with a video and a section, and u2's own Enchufla.
	 */
	function given() {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		if (!made.ok) throw new Error('team expected');
		const team = { id: made.teamId, name: 'Salsa Tuesdays' };
		const T = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', made.teamId, 1);
		const input = (figureName: string) => ({
			figureName,
			name: 'Basic',
			partner: 'partner' as const,
			style: 'salsa',
			notes: null
		});
		const F = createFigure(db, T, input('Setenta'))!.figure.id;
		const H = createFigure(db, T, input('Sombrero'))!.figure.id;
		const D = createCustomExercise(db, T, { name: 'Shines', everyDays: 3, notes: null }).id;
		const L = createLesson(db, T, { lessonDay: '2026-11-03', title: 'Week 1', notes: null }).lesson
			.id;
		expect(linkFigure(db, L, F, 'u1')).toBe(true);
		expect(linkExercise(db, L, D, 'u1')).toBe(true);
		const L2 = createLesson(db, T, { lessonDay: '2026-11-03', title: 'Week 2', notes: null }).lesson
			.id;
		expect(linkFigure(db, L2, H, 'u1')).toBe(true);
		publishLesson(db, T, L, 1);
		publishLesson(db, T, L2, 1);
		expect(
			addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, 2)
		).toBe(true);
		const own = createFigure(db, U2_SALSA, input('Enchufla'))!.figure.id;
		const mine = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-04',
			title: 'My notes',
			notes: null
		}).lesson.id;
		const video = addLessonVideo(db, {
			lessonId: mine,
			file: 'm.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const mySection = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 3000, label: null }
		)!.id;
		return { team, T, F, H, D, L, own, mine, mySection };
	}

	it('offers the group figures and drills they may use, tagged with the group', () => {
		const { team, F, H, D, own, mySection } = given();
		const o = linkOptionsFor(db, mySection, 'u2')!;
		const all = [...o.near, ...o.figures, ...o.drills];
		const tagged = (target: object) =>
			all.find((x) => JSON.stringify(x.target) === JSON.stringify(target));
		expect(tagged({ figureId: F })).toMatchObject({ label: 'Setenta · Basic', team });
		expect(tagged({ figureId: own })?.team).toBeUndefined();
		expect(tagged({ exerciseId: D })).toMatchObject({ label: 'Shines', drill: true, team });
		expect(tagged({ figureId: H })).toBeUndefined();
		// New variation / New figure still make the person's own only.
		expect(o.figureChoices.map((f) => f.name)).toEqual(['Enchufla']);
	});

	it('links one, shows it as linked with its group, and keeps the walls whole', () => {
		const { team, F, mySection } = given();
		const res = linkOptionsFor(db, mySection, 'u2')!;
		expect(res.figures.find((x) => 'figureId' in x.target && x.target.figureId === F)?.linked).toBe(
			false
		);
		expect(linkSpot(db, 'u2', mySection, { figureId: F })).toBeGreaterThan(0);
		const o = linkOptionsFor(db, mySection, 'u2')!;
		expect(o.linked).toMatchObject([{ target: { figureId: F }, label: 'Setenta · Basic', team }]);
		expect(crossRefs(db)).toEqual([]);
	});

	it("a group's section is offered only the group's own, as before", () => {
		const { T, L, F, own } = given();
		const gv = addLessonVideo(
			db,
			{ lessonId: L, file: 'g.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const s = addSpot(db, { lessonVideoId: gv }, { startMs: 0, endMs: 9, label: null }, 'u1')!.id;
		const o = linkOptionsFor(db, s, 'u1')!;
		const all = [...o.near, ...o.figures, ...o.drills];
		expect(all.some((x) => 'figureId' in x.target && x.target.figureId === F)).toBe(true);
		expect(all.some((x) => 'figureId' in x.target && x.target.figureId === own)).toBe(false);
		expect(all.every((x) => x.team === undefined)).toBe(true);
		expect(T.teamId).toBe(1);
	});
});
