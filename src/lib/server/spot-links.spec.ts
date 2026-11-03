import { beforeEach, describe, expect, it } from 'vitest';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises } from './db/schema';
import {
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom,
	listFigures
} from './figures';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from './lessons';
import { createTeam, joinTeam } from './teams';
import { leaveTeam } from './membership';
import { createRoutineFromFigures } from './routines';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import type { Space } from './scope';
import { createCustomExercise } from './exercises';
import { addSpot, listSpots } from './spots';
import {
	assertUnlinked,
	getSpotLink,
	linkableSections,
	linkChips,
	linksBlocking,
	linkInSpace,
	linkSpot,
	SpotLinkedError,
	SpotLinkError,
	sectionsFor,
	targetFrom,
	unlinkSpot,
	videoSections
} from './spot-links';

const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

let db: Db;
let lessonId: number;
let figureId: number;
let doble: number;
let drill: number;
let lessonVideoId: number;
let section: number;
let point: number;

const fig = (dance: 'salsa' | 'bachata', figureName: string) =>
	createFigure(
		db,
		{ userId: 'u1', dance },
		{
			figureName,
			name: 'Basic',
			partner: 'partner',
			style: dance === 'salsa' ? 'salsa' : 'sensual',
			notes: null
		}
	)!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
	figureId = fig('salsa', 'Enchufla');
	doble = createVariationFrom(db, figureId, 'Doble')!.id;
	drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
	lessonId = createLesson(db, U1_SALSA, { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
		.lesson.id;
	lessonVideoId = addLessonVideo(db, {
		lessonId,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(db, { lessonVideoId }, { startMs: 1000, endMs: 4000, label: 'Enchufla' })!.id;
	point = addSpot(db, { lessonVideoId }, { startMs: 500, endMs: null, label: null })!.id;
});

describe('targetFrom', () => {
	it('reads figure:<id> and exercise:<id>', () => {
		expect(targetFrom('figure:12')).toEqual({ figureId: 12 });
		expect(targetFrom('exercise:5')).toEqual({ exerciseId: 5 });
	});
	it.each([undefined, '', 'figure:', 'figure:0', 'routine:3', 'figure:1.5', 'figure:-2'])(
		'refuses %s',
		(raw) => expect(targetFrom(raw)).toBeNull()
	);
});

describe('linkSpot', () => {
	it('links a section to a figure, a variation and a drill', () => {
		linkSpot(db, 'u1', section, { figureId });
		linkSpot(db, 'u1', section, { figureId: doble });
		linkSpot(db, 'u1', section, { exerciseId: drill });
		expect(
			linkChips(db, [section])
				.get(section)!
				.map((c) => c.label)
		).toEqual(['Clave', 'Enchufla · Basic', 'Enchufla · Doble']);
	});
	it('a chip reads the label', () => {
		linkSpot(db, 'u1', section, { figureId: doble });
		expect(
			linkChips(db, [section])
				.get(section)!
				.map((c) => c.label)
		).toEqual(['Enchufla · Doble']);
	});
	it('refuses a point', () => {
		expect(() => linkSpot(db, 'u1', point, { figureId })).toThrow(SpotLinkError);
	});
	it('refuses a target of the other dance', () => {
		const bachata = fig('bachata', 'Paseo');
		expect(() => linkSpot(db, 'u1', section, { figureId: bachata })).toThrow(/dance/);
	});
	it('refuses an exercise that is not a drill', () => {
		const review = db.select().from(exercises).where(eq(exercises.lessonId, lessonId)).get()!;
		expect(() => linkSpot(db, 'u1', section, { exerciseId: review.id })).toThrow(/drill/);
	});
	it('refuses the same pair twice with a 409', () => {
		linkSpot(db, 'u1', section, { figureId });
		try {
			linkSpot(db, 'u1', section, { figureId });
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(SpotLinkError);
			expect((e as SpotLinkError).status).toBe(409);
		}
	});
	it('refuses a missing spot or target', () => {
		expect(() => linkSpot(db, 'u1', 999, { figureId })).toThrow(SpotLinkError);
		expect(() => linkSpot(db, 'u1', section, { figureId: 999 })).toThrow(SpotLinkError);
		expect(() => linkSpot(db, 'u1', section, { exerciseId: 999 })).toThrow(SpotLinkError);
	});
});

describe('unlinkSpot', () => {
	it('is scoped to its target', () => {
		const id = linkSpot(db, 'u1', section, { figureId });
		expect(unlinkSpot(db, id, { figureId: doble })).toBe(false);
		expect(getSpotLink(db, id)).toEqual({ id, spotId: section, target: { figureId } });
		expect(unlinkSpot(db, id, { figureId })).toBe(true);
		expect(getSpotLink(db, id)).toBeNull();
	});
	it('leaves the section’s other links', () => {
		const a = linkSpot(db, 'u1', section, { figureId });
		linkSpot(db, 'u1', section, { exerciseId: drill });
		unlinkSpot(db, a, { figureId });
		expect(linksBlocking(db, { spotId: section })).toEqual(['Clave']);
	});
});

describe('linksBlocking', () => {
	it('names the targets of a spot and of a whole video, archived marked', () => {
		linkSpot(db, 'u1', section, { figureId: doble });
		archiveVariation(db, doble, Date.now());
		expect(linksBlocking(db, { spotId: section })).toEqual(['Enchufla · Doble (archived)']);
		expect(linksBlocking(db, { lessonVideoId })).toEqual(['Enchufla · Doble (archived)']);
		expect(() => assertUnlinked(db, { lessonVideoId })).toThrow(SpotLinkedError);
		expect(() => assertUnlinked(db, { lessonVideoId })).toThrow(
			'Linked to Enchufla · Doble (archived) — unlink it first.'
		);
	});
	it('is empty when nothing links', () => {
		expect(linksBlocking(db, { lessonVideoId })).toEqual([]);
		expect(() => assertUnlinked(db, { spotId: section })).not.toThrow();
	});
	it('covers recordings too', () => {
		const rec = addRecording(db, {
			figureId,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		const s = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: null })!.id;
		linkSpot(db, 'u1', s, { exerciseId: drill });
		expect(linksBlocking(db, { recordingId: rec })).toEqual(['Clave']);
	});
});

describe('reads', () => {
	const video = (title: string, lessonDay: string, file: string) => {
		const id = createLesson(db, U1_SALSA, { lessonDay, title, notes: null }).lesson.id;
		return addLessonVideo(db, { lessonId: id, file, mime: 'video/mp4', sizeBytes: 1 }).id;
	};

	it('sectionsFor is per version, with its video', () => {
		linkSpot(db, 'u1', section, { figureId: doble });
		expect(sectionsFor(db, { figureId })).toEqual([]);
		const cards = sectionsFor(db, { figureId: doble });
		expect(cards).toEqual([
			{
				linkId: expect.any(Number),
				spot: {
					id: section,
					startMs: 1000,
					endMs: 4000,
					label: 'Enchufla',
					linkedTo: ['Enchufla · Doble']
				},
				video: {
					owner: { lessonVideoId },
					src: '/lesson-videos/l.mp4',
					from: { kind: 'lesson', lessonId, title: 'Cubana', lessonDay: '2026-10-12' }
				}
			}
		]);
	});

	it('sectionsFor reaches a recording, labelled by its figure', () => {
		const rec = addRecording(db, {
			figureId: doble,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		const s = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: null })!.id;
		linkSpot(db, 'u1', s, { exerciseId: drill });
		expect(sectionsFor(db, { exerciseId: drill }).map((c) => c.video)).toEqual([
			{
				owner: { recordingId: rec },
				src: '/recordings/r.mp4',
				from: { kind: 'recording', figure: 'Enchufla · Doble' }
			}
		]);
	});

	it('linkableSections puts taught-here first, leaves out points', () => {
		const later = video('Later', '2026-10-14', 'm.mp4');
		const s2 = addSpot(db, { lessonVideoId: later }, { startMs: 0, endMs: 500, label: null })!.id;
		linkFigure(db, lessonId, doble);
		const groups = linkableSections(db, { figureId: doble });
		expect(groups.map((g) => [g.video.src, g.taughtHere])).toEqual([
			['/lesson-videos/l.mp4', true],
			['/lesson-videos/m.mp4', false]
		]);
		expect(groups[0].sections.map((s) => s.id)).toEqual([section]);
		linkSpot(db, 'u1', s2, { figureId: doble });
		const after = linkableSections(db, { figureId: doble });
		// Linking its section makes the lesson of m.mp4 teach the figure too.
		expect(after.map((g) => g.video.src).sort()).toEqual([
			'/lesson-videos/l.mp4',
			'/lesson-videos/m.mp4'
		]);
		const m = after.find((g) => g.video.src === '/lesson-videos/m.mp4')!;
		expect(m.sections.map((x) => [x.id, x.linked])).toEqual([[s2, true]]);
	});

	it('linkableSections includes a section already linked to the target, flagged linked', () => {
		linkSpot(db, 'u1', section, { figureId: doble });
		const sections = linkableSections(db, { figureId: doble }).flatMap((g) => g.sections);
		expect(sections.find((s) => s.id === section)?.linked).toBe(true);
		expect(sections.filter((s) => s.id !== section).every((s) => s.linked === false)).toBe(true);
	});

	it('linkableSections for a drill: videos of lessons that link the drill are taughtHere', () => {
		linkExercise(db, lessonId, drill);
		const groups = linkableSections(db, { exerciseId: drill });
		expect(groups.find((g) => g.video.src === '/lesson-videos/l.mp4')?.taughtHere).toBe(true);
	});

	it('linkableSections lists recordings in figure-name order, not variation-name order', () => {
		const rec = (id: number, file: string) => {
			const r = addRecording(db, {
				figureId: id,
				file,
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			addSpot(db, { recordingId: r.id }, { startMs: 0, endMs: 500, label: null });
		};
		const zebra = fig('salsa', 'Zebra');
		const aardvark = fig('salsa', 'Aardvark');
		// Both variations are "Basic": only the figure's name can order them.
		rec(zebra, 'z.mp4');
		rec(aardvark, 'a.mp4');
		expect(linkableSections(db, { exerciseId: drill }).map((g) => g.video.src)).toEqual([
			'/lesson-videos/l.mp4',
			'/recordings/a.mp4',
			'/recordings/z.mp4'
		]);
	});

	it('a variation\u2019s lessons are its own', () => {
		// Cubana teaches only the sibling: its section is not this variation\u2019s "here".
		linkFigure(db, lessonId, figureId);
		const groups = linkableSections(db, { figureId: doble });
		expect(groups.map((g) => g.taughtHere)).toEqual([false]);
	});

	it('linkableSections counts a drill as taught where a lesson links it', () => {
		const later = video('Later', '2026-10-14', 'm.mp4');
		addSpot(db, { lessonVideoId: later }, { startMs: 0, endMs: 500, label: null });
		linkExercise(db, lessonId, drill);
		expect(linkableSections(db, { exerciseId: drill }).map((g) => g.taughtHere)).toEqual([
			true,
			false
		]);
	});

	it('linkableSections stays in the dance', () => {
		const bachata = fig('bachata', 'Paseo');
		expect(linkableSections(db, { figureId: bachata })).toEqual([]);
	});

	it('videoSections lists sections with chips, archived flagged', () => {
		linkSpot(db, 'u1', section, { exerciseId: drill });
		linkSpot(db, 'u1', section, { figureId: doble });
		archiveVariation(db, doble, Date.now());
		expect(videoSections(db, { lessonVideoId })).toEqual([
			{
				id: section,
				startMs: 1000,
				endMs: 4000,
				label: 'Enchufla',
				links: [
					{ id: expect.any(Number), label: 'Clave', archived: false },
					{ id: expect.any(Number), label: 'Enchufla · Doble', archived: true }
				]
			}
		]);
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

	it("refuses to link a group's section to a person's figure or drill", () => {
		const s = teamSection();
		expect(() => linkInSpace(db, T1_SALSA, s, { figureId })).toThrow('No such figure.');
		expect(() => linkInSpace(db, T1_SALSA, s, { exerciseId: drill })).toThrow('No such exercise.');
		// …and a person's section to the group's figure.
		const theirs = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(() => linkInSpace(db, U1_SALSA, section, { figureId: theirs })).toThrow(
			'No such figure.'
		);
		expect(linkInSpace(db, T1_SALSA, s, { figureId: theirs })).toBeGreaterThan(0);
	});

	it("answers a group's section as missing to a person, until access says who may edit", () => {
		const s = teamSection();
		expect(() => linkSpot(db, 'u1', s, { figureId })).toThrow('No such section.');
	});
});

describe("a person's own section and what their groups gave them", () => {
	/**
	 * Salsa Tuesdays (u1's): figure F and drill D in published lesson L, which
	 * u2 added; H in published L2, which u2 did not add. Rueda club (u3's, u2
	 * not in it): X. u2's own lesson with a video and a section.
	 */
	function given() {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		if (!made.ok) throw new Error('team expected');
		const T = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', made.teamId, 1);
		const groupFig = (space: Space, figureName: string) =>
			createFigure(db, space, {
				figureName,
				name: 'Basic',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.figure.id;
		const F = groupFig(T, 'Setenta');
		const H = groupFig(T, 'Sombrero');
		const D = createCustomExercise(db, T, { name: 'Shines', everyDays: 3, notes: null }).id;
		const L = createLesson(db, T, { lessonDay: '2026-11-03', title: 'Week 1', notes: null }).lesson
			.id;
		expect(linkFigure(db, L, F, 'u1')).toBe(true);
		expect(linkExercise(db, L, D, 'u1')).toBe(true);
		const L2 = createLesson(db, T, { lessonDay: '2026-11-03', title: 'Week 2', notes: null }).lesson
			.id;
		expect(linkFigure(db, L2, H, 'u1')).toBe(true);
		expect(publishLesson(db, T, L, 1)).toBe(true);
		expect(publishLesson(db, T, L2, 1)).toBe(true);
		expect(addLesson(db, 'u2', L, NONE, 2)).toBe(true);
		const rueda = createTeam(db, 'u3', 'salsa', 'Rueda club', 1);
		if (!rueda.ok) throw new Error('team expected');
		const X = groupFig({ dance: 'salsa', teamId: rueda.teamId, actorId: 'u3' }, 'Dile que no');

		// The group's own section on L's video, linked to F.
		const groupVideo = addLessonVideo(
			db,
			{ lessonId: L, file: 'g.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const groupSection = addSpot(
			db,
			{ lessonVideoId: groupVideo },
			{ startMs: 0, endMs: 2000, label: 'Class' },
			'u1'
		)!.id;
		linkInSpace(db, T, groupSection, { figureId: F });

		const mine = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-04',
			title: 'My notes',
			notes: null
		}).lesson.id;
		const myVideo = addLessonVideo(db, {
			lessonId: mine,
			file: 'm.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const mySection = addSpot(
			db,
			{ lessonVideoId: myVideo },
			{ startMs: 500, endMs: 3000, label: 'Mine' }
		)!.id;
		const myFigure = groupFig(U2_SALSA, 'Enchufla');
		return { T, F, H, D, X, L, groupSection, mine, myVideo, mySection, myFigure };
	}

	it('links it to a figure or drill they may use, and the link reads back', () => {
		const { F, D, mySection } = given();
		const id = linkSpot(db, 'u2', mySection, { figureId: F });
		expect(id).toBeGreaterThan(0);
		expect(getSpotLink(db, id)).toEqual({ id, spotId: mySection, target: { figureId: F } });
		expect(linkSpot(db, 'u2', mySection, { exerciseId: D })).toBeGreaterThan(0);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a figure of a group they are not in, and one they read but were not given', () => {
		const { H, X, mySection } = given();
		expect(() => linkSpot(db, 'u2', mySection, { figureId: X })).toThrow('No such figure.');
		// H is in a published lesson u2 reads as a member, but u2 never added it.
		expect(() => linkSpot(db, 'u2', mySection, { figureId: H })).toThrow('No such figure.');
		expect(crossRefs(db)).toEqual([]);
	});

	it("still refuses a group's section a person's figure", () => {
		const { T, groupSection, myFigure } = given();
		expect(() => linkInSpace(db, T, groupSection, { figureId: myFigure })).toThrow(
			'No such figure.'
		);
	});

	it('sectionsFor a group figure shows the person their own sections, after the group’s', () => {
		const { F, groupSection, mySection, myVideo } = given();
		linkSpot(db, 'u2', mySection, { figureId: F });
		expect(sectionsFor(db, { figureId: F }).map((c) => c.spot.id)).toEqual([groupSection]);
		const cards = sectionsFor(db, { figureId: F }, undefined, 'u2');
		expect(cards.map((c) => c.spot.id)).toEqual([groupSection, mySection]);
		expect(cards[1].video.owner).toEqual({ lessonVideoId: myVideo });
		expect(cards[1].spot.linkedTo).toEqual(['Setenta · Basic']);
		// Someone else's own sections never show, and the group's editor sees no one's.
		expect(sectionsFor(db, { figureId: F }, undefined, 'u1').map((c) => c.spot.id)).toEqual([
			groupSection
		]);
		// linkableSections offers only the target's own space, as before.
		const offered = linkableSections(db, { figureId: F }).flatMap((g) =>
			g.sections.map((s) => s.id)
		);
		expect(offered).toEqual([groupSection]);
	});

	it('a chip on the person’s own section names a group target only while they may use it', () => {
		const { F, L, mySection, myVideo, myFigure } = given();
		linkSpot(db, 'u2', mySection, { figureId: F });
		linkSpot(db, 'u2', mySection, { figureId: myFigure });
		const chips = () => sectionsFor(db, { figureId: myFigure }).map((c) => c.spot.linkedTo);
		const lessonChips = () =>
			videoSections(db, { lessonVideoId: myVideo }).map((s) => s.links.map((l) => l.label));
		// The full-screen player's spot list (GET /api/video-spots).
		const playerChips = () =>
			listSpots(db, { lessonVideoId: myVideo }).find((s) => s.id === mySection)!.linkedTo;
		expect(chips()).toEqual([['Enchufla · Basic', 'Setenta · Basic']]);
		expect(lessonChips()).toEqual([['Enchufla · Basic', 'Setenta · Basic']]);
		expect(playerChips()).toEqual(['Enchufla · Basic', 'Setenta · Basic']);
		// L archived: u2 reads F no more, so its name leaves u2's own lists (the
		// link itself is for the rescue to deal with). It still blocks a delete.
		archiveLesson(db, L, 3, 'u1');
		expect(chips()).toEqual([['Enchufla · Basic']]);
		expect(lessonChips()).toEqual([['Enchufla · Basic']]);
		expect(playerChips()).toEqual(['Enchufla · Basic']);
		expect(linksBlocking(db, { spotId: mySection })).toEqual([
			'Enchufla · Basic',
			'Setenta · Basic'
		]);
	});

	it("a member's own links leave the group's Moves list as it was", () => {
		const { T, L, mySection, myFigure } = given();
		// G is in the slots of routine R on L: u2 may use it, and no group
		// section or lesson links it.
		const G = createFigure(db, T, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const R = createRoutineFromFigures(db, T, { name: 'Class routine', notes: null }, [G])!.routine
			.id;
		expect(linkRoutine(db, L, R, 'u1')).toBe(true);
		const flags = () =>
			listFigures(db, T)
				.flatMap((m) => m.figures)
				.filter((v) => v.id === G)
				.map((v) => [v.hasSection, v.hasLesson]);
		expect(flags()).toEqual([[false, false]]);
		// u2 links G from a section of their own lesson video and of their own recording.
		linkSpot(db, 'u2', mySection, { figureId: G });
		const rec = addRecording(db, {
			figureId: myFigure,
			file: 'r2.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		const onRec = addSpot(db, { recordingId: rec.id }, { startMs: 0, endMs: 900, label: null })!;
		linkSpot(db, 'u2', onRec.id, { figureId: G });
		// The teacher's "No section" and Not linked still see G as unlinked.
		expect(flags()).toEqual([[false, false]]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a figure reached only through a draft lesson, and one of a group they left', () => {
		const { T, F, mySection } = given();
		const K = createFigure(db, T, {
			figureName: 'Vacilala',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const draft = createLesson(db, T, { lessonDay: '2026-11-05', title: 'Draft', notes: null })
			.lesson.id;
		expect(linkFigure(db, draft, K, 'u1')).toBe(true);
		expect(addLesson(db, 'u2', draft, NONE, 3)).toBe(false);
		expect(() => linkSpot(db, 'u2', mySection, { figureId: K })).toThrow('No such figure.');
		expect(leaveTeam(db, T.teamId, 'u2', 4)).toBe('left');
		expect(() => linkSpot(db, 'u2', mySection, { figureId: F })).toThrow('No such figure.');
	});
});
