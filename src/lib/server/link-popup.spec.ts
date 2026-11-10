import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figureEndPositions,
	figureGroups,
	figureStartPositions,
	figures,
	lessonFigures,
	lessonPositions,
	positions,
	spotLinks,
	spotPositionLinks,
	type PositionRow
} from './db/schema';
import { addRecording, createFigure, createVariationFrom, getGroup } from './figures';
import {
	addLessonVideo,
	createLesson,
	getLesson,
	linkExercise,
	linkFigure,
	linkPosition,
	publishLesson
} from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkSpot, SpotLinkError, unlinkFromSection } from './spot-links';
import {
	createAndLink,
	createAndLinkIn,
	linkOptions,
	linkOptionsFor,
	parseLinkBody
} from './link-popup';
import { archivePosition, createPosition } from './positions';
import { linkSpotToPosition, unlinkSpotFromPosition } from './position-links';
import { history } from './changes';
import type { Space } from './scope';
import type { LinkOptions } from '$lib/types';
import { createTeam, joinTeam } from './teams';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import { T1_SALSA, U1_BACHATA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { withLocale } from '$lib/i18n/current';

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
				linked: false
			}
		]);
		expect(o.figureChoices[0]).toEqual({
			groupId: enchufla,
			name: 'Enchufla',
			variations: ['Basic', 'Doble'],
			near: true,
			partner: 'solo',
			style: 'son'
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

	it('is null for a missing spot', () => {
		expect(linkOptions(db, 9999, 'salsa')).toBeNull();
	});
});

describe('createAndLink', () => {
	it('makes a variation danced and styled as asked', () => {
		createAndLink(db, 'u1', section, {
			kind: 'variation',
			groupId: enchufla,
			name: 'Triple',
			partner: 'partner',
			style: 'salsa'
		});
		const made = db.select().from(figures).where(eq(figures.name, 'Triple')).get()!;
		expect(made).toMatchObject({ groupId: enchufla, partner: 'partner', styleTag: 'salsa' });
	});

	it("refuses a variation's style from another dance, under Style, making nothing", () => {
		expect(() =>
			createAndLink(db, 'u1', section, {
				kind: 'variation',
				groupId: enchufla,
				name: 'Triple',
				partner: 'partner',
				style: 'sensual'
			})
		).toThrow(expect.objectContaining({ field: 'style' }));
		expect(db.select().from(figures).where(eq(figures.name, 'Triple')).get()).toBeUndefined();
	});

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
		createAndLink(db, 'u1', section, { kind: 'drill', name: 'Arm styling' });
		const made = db.select().from(exercises).where(eq(exercises.name, 'Arm styling')).get()!;
		expect(made).toMatchObject({ source: 'custom', everyDays: 3, dance: 'salsa' });
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
		[{ kind: 'drill', name: '  ' }, 'Give it a name.']
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
		[{ kind: 'drill', name: '' }, 'name']
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
				createAndLink(db, 'u1', point, { kind: 'drill', name: 'Arm' });
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
		expect(() => createAndLink(db, 'u1', point, { kind: 'drill', name: 'Arm' })).toThrow(
			SpotLinkError
		);
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
		createAndLinkIn(db, T1_SALSA, s, { kind: 'drill', name: 'Clave' });
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
		expect(() => createAndLink(db, 'u1', s, { kind: 'drill', name: 'Other' })).toThrow(
			'No such section.'
		);
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

describe('positions in the Link popup (ruling 10)', () => {
	const hold = { hands: 'two', crossed: true, facing: 'face', frame: null } as const;
	const make = (space: Space, name: string, styleTag: string | null = 'salsa') =>
		(
			createPosition(
				db,
				space,
				{ name, styleTag, hold, notes: null, pictureSpotId: null },
				1
			) as PositionRow
		).id;
	const position = (o: LinkOptions, id: number) =>
		[...o.near, ...o.positions].find((x) => 'positionId' in x.target && x.target.positionId === id);

	it("offers a point the space's live positions of its dance, and nothing else", () => {
		const cerrada = make(U1_SALSA, 'Cerrada');
		const abierta = make(U1_SALSA, 'Abierta', null);
		const gone = make(U1_SALSA, 'Gone');
		archivePosition(db, gone, 2);
		make(U1_BACHATA, 'Close');
		make(U2_SALSA, 'Theirs');
		const o = linkOptions(db, point, 'salsa')!;
		expect(o.spot).toEqual({ id: point, startMs: 1000, endMs: null, label: null });
		expect(o.figures).toEqual([]);
		expect(o.drills).toEqual([]);
		expect(o.figureChoices).toEqual([]);
		expect(o.near).toEqual([]);
		expect(o.positions).toEqual([
			{
				target: { positionId: cerrada },
				label: 'Cerrada',
				drill: false,
				figure: null,
				name: 'Cerrada',
				linked: false,
				hold: { hands: 'two', crossed: true, facing: 'face', frame: null }
			},
			expect.objectContaining({ target: { positionId: abierta }, label: 'Abierta' })
		]);
	});

	it("offers a section figures, drills and positions, the lesson's positions near", () => {
		const cerrada = make(U1_SALSA, 'Cerrada');
		const hammer = make(U1_SALSA, 'Hammerlock');
		const cross = make(U1_SALSA, 'Cross');
		expect(linkPosition(db, lessonId, hammer)).toBe(true);
		linkSpotToPosition(db, 'u1', other, cross);
		const o = linkOptions(db, section, 'salsa')!;
		expect(labels(o.figures)).toEqual(['Enchufla · Basic', 'Enchufla · Doble', 'Setenta · Basic']);
		expect(labels(o.drills)).toEqual(['Clave']);
		expect(labels(o.near)).toEqual(['Cross', 'Hammerlock']);
		expect(labels(o.positions)).toEqual(['Cerrada']);
		expect(position(o, cerrada)?.linked).toBe(false);
	});

	it("puts a recording's figure's own positions near", () => {
		const start = make(U1_SALSA, 'Cerrada');
		const end = make(U1_SALSA, 'Hammerlock');
		make(U1_SALSA, 'Abierta');
		db.insert(figureStartPositions)
			.values({ figureId: basic, positionId: start, createdAt: 1 })
			.run();
		db.insert(figureEndPositions).values({ figureId: basic, positionId: end, createdAt: 1 }).run();
		const o = linkOptions(db, recSection, 'salsa')!;
		expect(labels(o.near)).toEqual([
			'Enchufla · Basic',
			'Enchufla · Doble',
			'Cerrada',
			'Hammerlock'
		]);
		expect(labels(o.positions)).toEqual(['Abierta']);
	});

	it('lists a linked position with its kind, flagged when the lesson has it by hand', () => {
		const cerrada = make(U1_SALSA, 'Cerrada');
		linkPosition(db, lessonId, cerrada);
		const linkId = linkSpotToPosition(db, 'u1', point, cerrada);
		const o = linkOptions(db, point, 'salsa')!;
		expect(o.linked).toEqual([
			{
				linkId,
				target: { positionId: cerrada },
				label: 'Cerrada',
				drill: false,
				figure: null,
				name: 'Cerrada',
				linked: true,
				hold: { hands: 'two', crossed: true, facing: 'face', frame: null },
				archived: false,
				alsoByHand: true
			}
		]);
		expect(position(o, cerrada)?.linked).toBe(true);
		archivePosition(db, cerrada, 5);
		expect(linkOptions(db, point, 'salsa')!.linked[0]).toMatchObject({ archived: true });
	});

	it('creates a position in the spot’s space and links it, on a point or a section', () => {
		createAndLink(db, 'u1', point, { kind: 'position', name: ' Cerrada ', styleTag: 'son' });
		const made = db.select().from(positions).get()!;
		expect(made).toMatchObject({
			name: 'Cerrada',
			styleTag: 'son',
			userId: 'u1',
			teamId: null,
			dance: 'salsa'
		});
		expect(db.select().from(spotPositionLinks).all()).toMatchObject([
			{ spotId: point, positionId: made.id }
		]);
		createAndLink(db, 'u1', section, { kind: 'position', name: 'Abierta', styleTag: null });
		expect(linkOptions(db, section, 'salsa')!.linked.map((l) => l.label)).toEqual(['Abierta']);
	});

	it('refuses a taken name under Name and leaves nothing behind', () => {
		make(U1_SALSA, 'Cerrada');
		let thrown: unknown;
		try {
			createAndLink(db, 'u1', point, { kind: 'position', name: 'cerrada', styleTag: null });
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toBeInstanceOf(SpotLinkError);
		expect(thrown).toMatchObject({
			message: 'You already have a position called cerrada.',
			field: 'name',
			status: 400
		});
		expect(db.select().from(positions).all()).toHaveLength(1);
		expect(db.select().from(spotPositionLinks).all()).toEqual([]);
	});

	it('refuses a type of another dance under Style, making nothing', () => {
		expect(() =>
			createAndLink(db, 'u1', point, { kind: 'position', name: 'X', styleTag: 'sensual' })
		).toThrow(expect.objectContaining({ field: 'style' }));
		expect(db.select().from(positions).all()).toEqual([]);
	});

	it('refuses to make a figure, move or drill for a point, before writing anything', () => {
		const before = db.select().from(figures).all().length;
		const drillsBefore = db.select().from(exercises).all().length;
		expect(() => createAndLink(db, 'u1', point, { kind: 'drill', name: 'Clave 2' })).toThrow(
			'A point links positions only.'
		);
		expect(() =>
			createAndLink(db, 'u1', point, {
				kind: 'figure',
				figureName: 'Sombrero',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa'
			})
		).toThrow('A point links positions only.');
		expect(db.select().from(exercises).all()).toHaveLength(drillsBefore);
		expect(db.select().from(figures).all()).toHaveLength(before);
	});

	it("a group's spot: only the group's positions, and a create makes the group's, logged", () => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		if (!made.ok) throw new Error('team expected');
		const Ts = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
		make(U1_SALSA, 'Mine');
		const theirs = make(Ts, 'Group hold');
		const L = createLesson(db, Ts, { lessonDay: '2026-11-03', title: 'Week 1', notes: null }).lesson
			.id;
		const v = addLessonVideo(
			db,
			{ lessonId: L, file: 'g.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const p = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: null, label: null }, 'u1')!.id;
		const o = linkOptionsFor(db, p, 'u1')!;
		expect(o.positions.map((x) => x.target)).toEqual([{ positionId: theirs }]);
		expect(o.positions[0].team).toBeUndefined();
		createAndLink(db, 'u1', p, { kind: 'position', name: 'Cerrada', styleTag: null });
		const row = db.select().from(positions).where(eq(positions.name, 'Cerrada')).get()!;
		expect(row).toMatchObject({ teamId: made.teamId, userId: null });
		expect(history(db, made.teamId, 'position', row.id).map((h) => h.verb)).toEqual(['add']);
		expect(crossRefs(db)).toEqual([]);
	});

	it("a person's own spot: a group's position they may use, tagged with its group", () => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		if (!made.ok) throw new Error('team expected');
		const Ts = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', made.teamId, 1);
		const used = make(Ts, 'Hammerlock');
		make(Ts, 'Draft only');
		const L = createLesson(db, Ts, { lessonDay: '2026-11-03', title: 'Week 1', notes: null }).lesson
			.id;
		expect(linkPosition(db, L, used, 'u1')).toBe(true);
		publishLesson(db, Ts, L, 1);
		addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, 2);
		const mine = createLesson(db, U2_SALSA, { lessonDay: '2026-11-04', title: 'Mine', notes: null })
			.lesson.id;
		const v = addLessonVideo(db, {
			lessonId: mine,
			file: 'm.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const p = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: null, label: null })!.id;
		const o = linkOptionsFor(db, p, 'u2')!;
		expect(o.positions).toMatchObject([
			{
				target: { positionId: used },
				label: 'Hammerlock',
				team: { id: made.teamId, name: 'Salsa Tuesdays' }
			}
		]);
		linkSpotToPosition(db, 'u2', p, used);
		expect(linkOptionsFor(db, p, 'u2')!.linked).toMatchObject([
			{ target: { positionId: used }, team: { name: 'Salsa Tuesdays' } }
		]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('unlinks a position link by its own id, never a figure link with the same number', () => {
		const cerrada = make(U1_SALSA, 'Cerrada');
		const fLink = linkSpot(db, 'u1', section, { figureId: basic });
		const pLink = linkSpotToPosition(db, 'u1', section, cerrada);
		expect(pLink).toBe(fLink); // both tables start at 1
		expect(unlinkSpotFromPosition(db, pLink, 3, undefined, { spotId: section })).toBe(true);
		expect(db.select().from(spotLinks).all()).toHaveLength(1);
		expect(db.select().from(spotPositionLinks).all()).toEqual([]);
	});

	it("refuses another spot's position link, and takes the lesson's hand link only when asked", () => {
		const cerrada = make(U1_SALSA, 'Cerrada');
		linkPosition(db, lessonId, cerrada);
		const elsewhere = linkSpotToPosition(db, 'u1', other, cerrada);
		expect(unlinkSpotFromPosition(db, elsewhere, 3, undefined, { spotId: section })).toBe(false);
		expect(db.select().from(spotPositionLinks).all()).toHaveLength(1);
		const here = linkSpotToPosition(db, 'u1', point, cerrada);
		expect(unlinkSpotFromPosition(db, here, 3, undefined, { spotId: point })).toBe(true);
		expect(db.select().from(lessonPositions).all()).toHaveLength(1);
		const again = linkSpotToPosition(db, 'u1', point, cerrada);
		expect(
			unlinkSpotFromPosition(db, again, 4, undefined, { spotId: point, alsoLesson: true })
		).toBe(true);
		expect(db.select().from(lessonPositions).all()).toEqual([]);
		expect(db.select().from(spotPositionLinks).all()).toHaveLength(1);
	});
});

describe('parseLinkBody', () => {
	it('reads a position target and a position create', () => {
		expect(parseLinkBody({ target: { positionId: 4 } })).toEqual({ target: { positionId: 4 } });
		expect(
			parseLinkBody({ create: { kind: 'position', name: 'Cerrada', styleTag: 'son' } })
		).toEqual({ create: { kind: 'position', name: 'Cerrada', styleTag: 'son' } });
		expect(
			parseLinkBody({ create: { kind: 'position', name: 'Cerrada', styleTag: null } })
		).toEqual({ create: { kind: 'position', name: 'Cerrada', styleTag: null } });
	});
	it('reads a variation create, with or without Danced and Style', () => {
		expect(parseLinkBody({ create: { kind: 'variation', groupId: 3, name: 'Triple' } })).toEqual({
			create: { kind: 'variation', groupId: 3, name: 'Triple' }
		});
		expect(
			parseLinkBody({
				create: { kind: 'variation', groupId: 3, name: 'Triple', partner: 'solo', style: 'son' }
			})
		).toEqual({
			create: { kind: 'variation', groupId: 3, name: 'Triple', partner: 'solo', style: 'son' }
		});
	});
	it.each([
		{ create: { kind: 'variation', groupId: 3, name: 'T', partner: 'duo', style: 'son' } },
		{ create: { kind: 'variation', groupId: 3, name: 'T', partner: 'solo', style: 4 } },
		{ create: { kind: 'variation', groupId: 3, name: 'T', partner: 'solo' } },
		{ target: { positionId: 0 } },
		{ target: { positionId: 'x' } },
		{ create: { kind: 'position', name: 5, styleTag: null } },
		{ create: { kind: 'position', name: 'X', styleTag: 3 } },
		{ create: { kind: 'position', name: 'X' } }
	])('refuses %o', (body) => {
		expect(parseLinkBody(body)).toBeNull();
	});
});

describe('the Link popup’s server words in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('titles the near group by where the section is', () => {
		expect(sl(() => linkOptions(db, section, 'salsa')!.nearTitle)).toBe('V tej lekciji');
		expect(sl(() => linkOptions(db, recSection, 'salsa')!.nearTitle)).toBe('Ta figura');
	});
	it.each([
		[
			{ kind: 'variation', groupId: 0, name: 'Doble' },
			'Figura s tem imenom že obstaja: Enchufla · Doble.'
		],
		[
			{ kind: 'figure', figureName: 'Enchufla', name: 'Basic', partner: 'partner', style: 'salsa' },
			'Gib s tem imenom že obstaja: Enchufla.'
		],
		[
			{ kind: 'figure', figureName: 'Sombrero', name: 'Basic', partner: 'partner', style: 'x' },
			'Ta slog ne spada k temu plesu.'
		],
		[{ kind: 'drill', name: ' ' }, 'Vpišite ime.']
	] as const)('refuses %o in Slovenian', (create, message) => {
		const c = create.kind === 'variation' ? { ...create, groupId: enchufla } : create;
		expect(() => sl(() => createAndLink(db, 'u1', section, c))).toThrow(
			expect.objectContaining({ message })
		);
	});
	it('refuses a point anything but a position, and a missing section', () => {
		expect(() => sl(() => createAndLink(db, 'u1', point, { kind: 'drill', name: 'Arm' }))).toThrow(
			'Točko lahko povežete le s položaji.'
		);
		expect(() => sl(() => createAndLink(db, 'u1', 9999, { kind: 'drill', name: 'Arm' }))).toThrow(
			'Tega odseka ni.'
		);
	});
});

describe('the spot’s group (link from other places)', () => {
	it('a group video’s options name the group; a person’s own name none', () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null })
			.lesson.id;
		const v = addLessonVideo(
			db,
			{ lessonId: L, file: 'g.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const s = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: 1000, label: null }, 'u1')!.id;
		expect(linkOptions(db, s, 'salsa')!.team).toEqual({ id: 1, name: 'Salsa Tuesdays' });
		expect(linkOptions(db, section, 'salsa')!.team).toBeNull();
	});
});
