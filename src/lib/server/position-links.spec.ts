/**
 * Sections and points linked to positions (ruling 10), what they block, the
 * picture they may be, the lessons they put a position on, and a group's
 * unlink in Recently deleted (ruling 11).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { lessonPositions, positions, spotPositionLinks, teamTrash, videoSpots } from './db/schema';
import {
	addLessonVideo,
	createLesson,
	deleteLessonVideo,
	getLesson,
	linkPosition,
	publishLesson
} from './lessons';
import { addRecording, createFigure, deleteRecording } from './figures';
import { addSpot, deleteSpot, listSpots } from './spots';
import { createPosition, archivePosition } from './positions';
import { createTeam, joinTeam } from './teams';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import { lessonsReaching, viaSections } from './lesson-links';
import { linksBlocking, SpotLinkedError, SpotLinkError } from './spot-links';
import { listTrash, restoreTrash } from './trash';
import { history } from './changes';
import {
	linkableSpots,
	linkSpotToPosition,
	positionTaughtIn,
	spotsOfPosition,
	unlinkSpotFromPosition
} from './position-links';
import type { PositionRow } from './db/schema';
import type { PositionInput } from '$lib/types';
import type { Space, TeamSpace } from './scope';
import { U1_BACHATA, U1_SALSA, U2_SALSA } from './test-walls';

const T = Date.UTC(2026, 10, 4, 12);

let db: Db;
let lesson: number;
let video: number;
let section: number;
let point: number;
let cerrada: number;

const input = (name: string): PositionInput => ({
	name,
	styleTag: 'salsa',
	hold: { hands: 'two', crossed: null, facing: 'face', frame: 'closed' },
	notes: null,
	pictureSpotId: null
});
const position = (space: Space, name: string) =>
	(createPosition(db, space, input(name), T) as PositionRow).id;

beforeEach(() => {
	db = openDb(':memory:');
	lesson = createLesson(db, U1_SALSA, { lessonDay: '2026-11-03', title: 'Cubana', notes: null })
		.lesson.id;
	video = addLessonVideo(db, {
		lessonId: lesson,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 1000, endMs: 4000, label: 'Cross' }
	)!.id;
	point = addSpot(db, { lessonVideoId: video }, { startMs: 72_000, endMs: null, label: null })!.id;
	cerrada = position(U1_SALSA, 'Cerrada');
});

describe('a person’s spots list their positions', () => {
	it('names a linked position in linkedTo, sorted with the rest', () => {
		linkSpotToPosition(db, 'u1', point, cerrada, T);
		expect(listSpots(db, { lessonVideoId: video }).map((s) => [s.id, s.linkedTo])).toEqual([
			[section, []],
			[point, ['Cerrada']]
		]);
	});
});

describe('linkSpotToPosition', () => {
	it('links a section and a point, and the position lists both', () => {
		const a = linkSpotToPosition(db, 'u1', section, cerrada, T);
		const b = linkSpotToPosition(db, 'u1', point, cerrada, T);
		expect(a).toBeGreaterThan(0);
		expect(b).toBeGreaterThan(a);
		const spots = spotsOfPosition(db, cerrada);
		expect(spots.map((s) => [s.linkId, s.spot.id, s.point])).toEqual([
			[a, section, false],
			[b, point, true]
		]);
		expect(spots[0].video.from).toMatchObject({ kind: 'lesson', lessonId: lesson });
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses the same pair twice with a 409', () => {
		linkSpotToPosition(db, 'u1', point, cerrada, T);
		try {
			linkSpotToPosition(db, 'u1', point, cerrada, T);
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(SpotLinkError);
			expect((e as SpotLinkError).message).toBe('Already linked.');
			expect((e as SpotLinkError).status).toBe(409);
		}
	});

	it('refuses a missing spot, a missing, archived, other-dance or other person’s position', () => {
		expect(() => linkSpotToPosition(db, 'u1', 999, cerrada, T)).toThrow('No such section.');
		expect(() => linkSpotToPosition(db, 'u2', section, cerrada, T)).toThrow('No such section.');
		expect(() => linkSpotToPosition(db, 'u1', section, 999, T)).toThrow('No such position.');
		const theirs = position(U2_SALSA, 'Abierta');
		expect(() => linkSpotToPosition(db, 'u1', section, theirs, T)).toThrow('No such position.');
		const bachata = position(U1_BACHATA, 'Abierta');
		expect(() => linkSpotToPosition(db, 'u1', section, bachata, T)).toThrow(SpotLinkError);
		archivePosition(db, cerrada, T);
		expect(() => linkSpotToPosition(db, 'u1', section, cerrada, T)).toThrow('No such position.');
		expect(db.select().from(spotPositionLinks).all()).toEqual([]);
	});

	it('linkableSpots offers every section and point of the owner’s videos, marking the linked', () => {
		linkSpotToPosition(db, 'u1', point, cerrada, T);
		const [group] = linkableSpots(db, cerrada);
		expect(group.video.owner).toEqual({ lessonVideoId: video });
		expect(group.sections.map((s) => [s.id, s.endMs, s.linked])).toEqual([
			[section, 4000, false],
			[point, null, true]
		]);
	});
});

describe('a linked spot refuses to go', () => {
	it('names the position until it is unlinked', () => {
		const link = linkSpotToPosition(db, 'u1', point, cerrada, T);
		expect(linksBlocking(db, { spotId: point })).toEqual(['Position · Cerrada']);
		expect(() => deleteSpot(db, point)).toThrow(SpotLinkedError);
		expect(() => deleteSpot(db, point)).toThrow('Linked to Position · Cerrada — unlink it first.');
		expect(() => deleteLessonVideo(db, video)).toThrow(SpotLinkedError);
		archivePosition(db, cerrada, T);
		expect(linksBlocking(db, { lessonVideoId: video })).toEqual(['Position · Cerrada (archived)']);
		expect(unlinkSpotFromPosition(db, link, T)).toBe(true);
		expect(unlinkSpotFromPosition(db, link, T)).toBe(false);
		expect(linksBlocking(db, { spotId: point })).toEqual([]);
		expect(deleteSpot(db, point)).toEqual({ trashId: null });
	});

	it('a recording’s point too', () => {
		const figure = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const rec = addRecording(db, {
			figureId: figure,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		const p = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: null, label: null })!.id;
		linkSpotToPosition(db, 'u1', p, cerrada, T);
		expect(() => deleteRecording(db, rec)).toThrow(
			'Linked to Position · Cerrada — unlink it first.'
		);
		expect(
			spotsOfPosition(db, cerrada).map((s) => [s.spot.id, s.point, s.video.from.kind])
		).toEqual([[p, true, 'recording']]);
	});

	it('the picture point: unlink, delete, and the picture is gone', () => {
		const link = linkSpotToPosition(db, 'u1', point, cerrada, T);
		db.update(positions).set({ pictureSpotId: point }).where(eq(positions.id, cerrada)).run();
		const picture = () =>
			db
				.select({ p: positions.pictureSpotId })
				.from(positions)
				.where(eq(positions.id, cerrada))
				.get()!.p;
		expect(() => deleteSpot(db, point)).toThrow(SpotLinkedError);
		expect(picture()).toBe(point);
		unlinkSpotFromPosition(db, link, T);
		expect(deleteSpot(db, point)).not.toBeNull();
		expect(picture()).toBeNull();
	});

	it('a video or recording delete clears the pictures of its points', () => {
		db.update(positions).set({ pictureSpotId: point }).where(eq(positions.id, cerrada)).run();
		deleteLessonVideo(db, video);
		expect(db.select().from(positions).get()!.pictureSpotId).toBeNull();
	});
});

describe('a lesson reaches a position through its video', () => {
	it('a point counts as "via section"', () => {
		linkSpotToPosition(db, 'u1', point, cerrada, T);
		const via = viaSections(db, lesson).positions.get(cerrada)!;
		expect(via).toEqual([{ spotId: point, startMs: 72_000, endMs: null, label: null }]);
		expect(lessonsReaching(db, { positionId: cerrada })).toEqual([lesson]);
		expect(positionTaughtIn(db, U1_SALSA, cerrada)).toEqual([
			{
				id: lesson,
				title: 'Cubana',
				lessonDay: '2026-11-03',
				teamName: null,
				byHand: false,
				via: true
			}
		]);
		expect(getLesson(db, lesson, 'u1')!.positions).toMatchObject([
			{ id: cerrada, name: 'Cerrada', byHand: false, viaSections: via, mineId: null, teamId: null }
		]);
	});

	it('positionTaughtIn lists only the space’s live lessons, newest first', () => {
		const later = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-10',
			title: 'Next',
			notes: null
		}).lesson.id;
		const v2 = addLessonVideo(db, { lessonId: later, file: 'n.mp4', mime: 'v', sizeBytes: 1 }).id;
		const s2 = addSpot(db, { lessonVideoId: v2 }, { startMs: 0, endMs: 900, label: null })!.id;
		linkSpotToPosition(db, 'u1', point, cerrada, T);
		linkSpotToPosition(db, 'u1', s2, cerrada, T);
		expect(positionTaughtIn(db, U1_SALSA, cerrada).map((l) => l.id)).toEqual([later, lesson]);
		expect(positionTaughtIn(db, U2_SALSA, cerrada)).toEqual([]);
	});
});

describe('in a group', () => {
	let G: TeamSpace;
	let groupLesson: number;
	let groupPoint: number;
	let groupPos: number;

	beforeEach(() => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		if (!made.ok) throw new Error('team expected');
		G = { dance: 'salsa', teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', made.teamId, 1);
		groupLesson = createLesson(db, G, { lessonDay: '2026-11-03', title: 'Week 1', notes: null })
			.lesson.id;
		const v = addLessonVideo(
			db,
			{ lessonId: groupLesson, file: 'g.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		groupPoint = addSpot(
			db,
			{ lessonVideoId: v },
			{ startMs: 5000, endMs: null, label: 'Hold' },
			'u1'
		)!.id;
		groupPos = position(G, 'Hammerlock');
	});

	it('links only its own positions; a person’s section links a group position they may use', () => {
		expect(() => linkSpotToPosition(db, 'u1', groupPoint, cerrada, T)).toThrow('No such position.');
		expect(() => linkSpotToPosition(db, 'u1', section, groupPos, T)).toThrow('No such position.');
		linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		expect(publishLesson(db, G, groupLesson, T)).toBe(true);
		const none = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
		expect(addLesson(db, 'u2', groupLesson, none, T)).toBe(true);
		const mine = createLesson(db, U2_SALSA, { lessonDay: '2026-11-04', title: 'Mine', notes: null })
			.lesson.id;
		const v = addLessonVideo(db, { lessonId: mine, file: 'm.mp4', mime: 'v', sizeBytes: 1 }).id;
		const myPoint = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: null, label: null })!.id;
		expect(linkSpotToPosition(db, 'u2', myPoint, groupPos, T)).toBeGreaterThan(0);
		// The group's spots, and u2's own after them for u2 only.
		expect(spotsOfPosition(db, groupPos).map((s) => s.spot.id)).toEqual([groupPoint]);
		expect(spotsOfPosition(db, groupPos, undefined, 'u2').map((s) => s.spot.id)).toEqual([
			groupPoint,
			myPoint
		]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('logs the link and the unlink under the lesson; the unlink is in Recently deleted and restores', () => {
		const link = linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		expect(unlinkSpotFromPosition(db, link, T + 1, 'u2')).toBe(true);
		const lines = history(db, G.teamId, 'lesson', groupLesson).filter(
			(r) => r.subject === 'section-link'
		);
		expect(lines.map((r) => [r.verb, r.actorId])).toEqual([
			['remove', 'u2'],
			['add', 'u1']
		]);
		const [item] = listTrash(db, G.teamId);
		expect(item).toMatchObject({ kind: 'position-link', label: "'Hold' · Hammerlock" });
		expect(lines[0].trashId).toBe(item.id);
		expect(restoreTrash(db, G, item.id, T + 2)).toEqual({ ok: true });
		expect(db.select().from(spotPositionLinks).all()).toMatchObject([
			{ id: link, spotId: groupPoint, positionId: groupPos }
		]);
		expect(listTrash(db, G.teamId)).toEqual([]);
	});

	it('from the spot’s side: another spot’s link is refused; alsoLesson takes the hand link into the same trash entry', () => {
		expect(linkPosition(db, groupLesson, groupPos, 'u1')).toBe(true);
		const link = linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		expect(unlinkSpotFromPosition(db, link, T, 'u1', { spotId: section })).toBe(false);
		expect(db.select().from(spotPositionLinks).all()).toHaveLength(1);
		expect(
			unlinkSpotFromPosition(db, link, T + 1, 'u1', { spotId: groupPoint, alsoLesson: true })
		).toBe(true);
		expect(db.select().from(lessonPositions).all()).toEqual([]);
		const [item] = listTrash(db, G.teamId);
		expect(item).toMatchObject({ kind: 'position-link' });
		expect(restoreTrash(db, G, item.id, T + 2)).toEqual({ ok: true });
		expect(db.select().from(spotPositionLinks).all()).toMatchObject([
			{ id: link, spotId: groupPoint, positionId: groupPos }
		]);
		expect(db.select().from(lessonPositions).all()).toMatchObject([
			{ lessonId: groupLesson, positionId: groupPos }
		]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a spot’s list names its positions beside its other links: a reader only what they reach', () => {
		const link = linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		expect(link).toBeGreaterThan(0);
		const owner = {
			lessonVideoId: db.select().from(videoSpots).where(eq(videoSpots.id, groupPoint)).get()!
				.lessonVideoId!
		};
		expect(listSpots(db, owner).find((s) => s.id === groupPoint)?.linkedTo).toEqual(['Hammerlock']);
		const none = {
			lessons: new Set<number>(),
			recordings: new Set<number>(),
			variations: new Set<number>(),
			drills: new Set<number>()
		};
		expect(listSpots(db, owner, none).find((s) => s.id === groupPoint)?.linkedTo).toEqual([]);
		expect(
			listSpots(db, owner, { ...none, positions: new Set([groupPos]) }).find(
				(s) => s.id === groupPoint
			)?.linkedTo
		).toEqual(['Hammerlock']);
	});

	it('a restore is refused when the point is gone or linked again', () => {
		const link = linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		unlinkSpotFromPosition(db, link, T, 'u1');
		const trashId = db.select().from(teamTrash).get()!.id;
		linkSpotToPosition(db, 'u1', groupPoint, groupPos, T);
		expect(restoreTrash(db, G, trashId, T + 1)).toEqual({ ok: false, reason: 'exists' });
		const again = db.select().from(spotPositionLinks).get()!.id;
		unlinkSpotFromPosition(db, again, T, 'u1');
		deleteSpot(db, groupPoint, 'u1', T);
		expect(db.select().from(videoSpots).where(eq(videoSpots.id, groupPoint)).all()).toEqual([]);
		expect(restoreTrash(db, G, trashId, T + 1)).toEqual({ ok: false, reason: 'parent-gone' });
	});
});
