/**
 * The once-ever boot step: sections and points linked before a link named
 * them (spec A3) take the name of their oldest link.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { spotLinks, spotPositionLinks, teamChanges, videoSpots } from './db/schema';
import { addLessonVideo, createLesson } from './lessons';
import { createFigure, createVariationFrom } from './figures';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { createPosition } from './positions';
import { createTeam } from './teams';
import { nameLinkedSpots } from './section-names';
import type { PositionRow } from './db/schema';
import type { Space, TeamSpace } from './scope';
import { U1_SALSA } from './test-walls';

const T = Date.UTC(2026, 10, 6, 12);

let db: Db;

const labelOf = (id: number) =>
	db.select({ label: videoSpots.label }).from(videoSpots).where(eq(videoSpots.id, id)).get()!.label;

/** A video in `space` and an empty spot maker on it. */
function videoIn(space: Space) {
	const lessonId = createLesson(db, space, {
		lessonDay: '2026-11-03',
		title: 'Cubana',
		notes: null
	}).lesson.id;
	const lessonVideoId = addLessonVideo(
		db,
		{
			lessonId,
			file: `${lessonId}.mp4`,
			mime: 'video/mp4',
			sizeBytes: 1
		},
		'u1'
	).id;
	return (startMs: number, endMs: number | null, label: string | null = null) =>
		addSpot(db, { lessonVideoId }, { startMs, endMs, label }, 'u1')!.id;
}

/** Links inserted straight into the tables, as a link made before naming left them. */
const linkFigure = (spotId: number, figureId: number) =>
	db.insert(spotLinks).values({ spotId, figureId }).run();
const linkDrill = (spotId: number, exerciseId: number) =>
	db.insert(spotLinks).values({ spotId, exerciseId }).run();
const linkPosition = (spotId: number, positionId: number) =>
	db.insert(spotPositionLinks).values({ spotId, positionId, createdAt: T }).run();

const position = (space: Space, name: string) =>
	(
		createPosition(
			db,
			space,
			{
				name,
				styleTag: 'salsa',
				hold: { hands: 'two', crossed: null, facing: 'face', frame: 'closed' },
				notes: null,
				pictureSpotId: null
			},
			T
		) as PositionRow
	).id;

let doble: number;
let drill: number;

beforeEach(() => {
	db = openDb(':memory:');
	const basic = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	doble = createVariationFrom(db, basic, 'Doble')!.id;
	drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
});

describe('nameLinkedSpots', () => {
	it('names every unnamed linked section once', () => {
		const spot = videoIn(U1_SALSA);
		const a = spot(0, 1000);
		const b = spot(2000, 3000);
		const loose = spot(4000, 5000);
		linkFigure(a, doble);
		linkDrill(b, drill);
		expect(nameLinkedSpots(db, T)).toEqual({ ran: true, named: 2 });
		expect(labelOf(a)).toBe('Enchufla · Doble');
		expect(labelOf(b)).toBe('Clave');
		expect(labelOf(loose)).toBeNull();
	});

	it('takes the oldest section link, else the oldest position link', () => {
		const spot = videoIn(U1_SALSA);
		const section = spot(0, 1000);
		const point = spot(1500, null);
		linkDrill(section, drill);
		linkFigure(section, doble);
		const cerrada = position(U1_SALSA, 'Cerrada');
		const abierta = position(U1_SALSA, 'Abierta');
		linkPosition(point, cerrada);
		linkPosition(point, abierta);
		nameLinkedSpots(db, T);
		expect(labelOf(section)).toBe('Clave');
		expect(labelOf(point)).toBe('Cerrada');
	});

	it('leaves named sections alone', () => {
		const spot = videoIn(U1_SALSA);
		const named = spot(0, 1000, 'The cross');
		linkFigure(named, doble);
		expect(nameLinkedSpots(db, T)).toEqual({ ran: true, named: 0 });
		expect(labelOf(named)).toBe('The cross');
	});

	it('runs once ever', () => {
		const spot = videoIn(U1_SALSA);
		const a = spot(0, 1000);
		linkFigure(a, doble);
		nameLinkedSpots(db, T);
		db.update(videoSpots).set({ label: null }).where(eq(videoSpots.id, a)).run();
		expect(nameLinkedSpots(db, T + 1)).toEqual({ ran: false, named: 0 });
		expect(labelOf(a)).toBeNull();
	});

	it('writes no History line', () => {
		const made = createTeam(db, 'u1', 'salsa', 'Tuesdays', T);
		if (!made.ok) throw new Error('no team');
		const team: TeamSpace = { dance: 'salsa', teamId: made.teamId, actorId: 'u1' };
		const spot = videoIn(team);
		const cerrada = position(team, 'Cerrada');
		const point = spot(0, null);
		linkPosition(point, cerrada);
		const before = db.select().from(teamChanges).all().length;
		nameLinkedSpots(db, T);
		expect(labelOf(point)).toBe('Cerrada');
		expect(db.select().from(teamChanges).all().length).toBe(before);
	});
});
