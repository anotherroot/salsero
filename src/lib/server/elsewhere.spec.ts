/**
 * Link from other places: what a group's pickers find in your own app and in
 * your other groups while you search. Ana (u1) owns Salsa Tuesdays (T1),
 * edits Rueda club (T2, Maja's) and is a member of Tuesday class (T3, Maja's).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { addRecording, archiveVariation, createFigure } from './figures';
import { addLessonVideo, createLesson, linkFigure, publishLesson } from './lessons';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { createPosition } from './positions';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
import { markTwins } from './twins';
import { cloneInto } from './clones/clone';
import type { Space, TeamSpace } from './scope';
import type { PositionInput } from '$lib/types';
import type { PositionRow } from './db/schema';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_SALSA } from './test-walls';
import { findElsewhere, staysBehind } from './elsewhere';

const T = Date.UTC(2026, 10, 3, 20);
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const T3_SALSA: TeamSpace = { teamId: 3, actorId: 'u3', dance: 'salsa' };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u3', 'salsa', 'Rueda club', T);
	createTeam(db, 'u3', 'salsa', 'Tuesday class', T);
	joinTeam(db, 'u1', 2, T);
	setRole(db, 2, 'u1', 'editor', T);
	joinTeam(db, 'u1', 3, T);
});

const figure = (space: Space, move: string, name = 'Basic') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const copyInto = async (id: number, into: Space) => {
	const r = await cloneInto(db, { kind: 'figure', id, into, recordings: true }, NO_FILES, T, ROOMY);
	if (!r.ok) throw new Error('copy failed');
	return r.id;
};
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
			} satisfies PositionInput,
			T
		) as PositionRow
	).id;
const placeNames = (places: ReturnType<typeof findElsewhere>) =>
	places.map((p) => (p.place.kind === 'mine' ? 'mine' : p.place.name));

describe('findElsewhere', () => {
	it('finds my own and my other groups’ rows, mine first', () => {
		figure(U1_SALSA, 'Cradle entry');
		figure(T2_SALSA, 'Cradle exit', 'With turn');
		figure(U1_SALSA, 'Setenta');
		const places = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(placeNames(places)).toEqual(['mine', 'Rueda club']);
		expect(places[0].rows).toMatchObject([
			{ kind: 'figure', label: 'Cradle entry · Basic', heading: 'Cradle entry', short: 'Basic' }
		]);
		expect(places[1]).toMatchObject({ readOnly: false });
		expect(places[1].rows.map((r) => r.label)).toEqual(['Cradle exit · With turn']);
	});

	it('an empty query finds nothing', () => {
		figure(U1_SALSA, 'Cradle entry');
		expect(findElsewhere(db, T1_SALSA, ['figure'], '  ')).toEqual([]);
	});

	it('a read-only group lists only what the person reads', () => {
		const F = figure(T3_SALSA, 'Cradle walk', 'Slow');
		expect(findElsewhere(db, T1_SALSA, ['figure'], 'cradle')).toEqual([]);
		const L = createLesson(db, T3_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null })
			.lesson.id;
		linkFigure(db, L, F, 'u3');
		expect(publishLesson(db, T3_SALSA, L, T)).toBe(true);
		const places = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(placeNames(places)).toEqual(['Tuesday class']);
		expect(places[0].readOnly).toBe(true);
	});

	it('a family live in the group is left out; an archived one carries restore', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const copy = await copyInto(F, T1_SALSA);
		expect(findElsewhere(db, T1_SALSA, ['figure'], 'cradle')).toEqual([]);
		archiveVariation(db, copy, T + 1, 'u1');
		const places = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(places[0].rows[0]).toMatchObject({ id: F, restore: copy });
	});

	it('one row per family, in the first place, also in the rest', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		await copyInto(F, T2_SALSA);
		const places = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(placeNames(places)).toEqual(['mine']);
		expect(places[0].rows[0]).toMatchObject({ id: F, alsoIn: ['Rueda club'] });
	});

	it('a row whose twin is live in the group is left out', () => {
		const mine = figure(U1_SALSA, 'Cradle entry');
		const theirs = figure(T1_SALSA, 'Cradle entry', 'Their basic');
		expect(markTwins(db, U1_SALSA, 'figure', [mine, theirs])).toBe(true);
		expect(findElsewhere(db, T1_SALSA, ['figure'], 'cradle')).toEqual([]);
	});

	it('a same-named group row of another family is named, case and accents folded', () => {
		const mine = figure(U1_SALSA, 'Cradle entry', 'Basic');
		const theirs = figure(T1_SALSA, 'Cradle Entry', 'Básic');
		const places = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(places[0].rows[0]).toMatchObject({ id: mine, sameName: theirs });
	});

	it('finds routines, drills and positions by name', () => {
		createRoutine(db, U1_SALSA, { name: 'Cradle loop', notes: null });
		createCustomExercise(db, T2_SALSA, { name: 'Cradle arms', everyDays: 3, notes: null });
		position(U1_SALSA, 'Cradle hold');
		const places = findElsewhere(db, T1_SALSA, ['routine', 'drill', 'position'], 'cradle');
		expect(placeNames(places)).toEqual(['mine', 'Rueda club']);
		expect(places[0].rows.map((r) => [r.kind, r.label]).sort()).toEqual([
			['position', 'Cradle hold'],
			['routine', 'Cradle loop']
		]);
		expect(places[1].rows.map((r) => [r.kind, r.label])).toEqual([['drill', 'Cradle arms']]);
	});

	it('only the kinds asked for', () => {
		figure(U1_SALSA, 'Cradle entry');
		position(U1_SALSA, 'Cradle hold');
		const places = findElsewhere(db, T1_SALSA, ['position'], 'cradle');
		expect(places[0].rows.map((r) => r.kind)).toEqual(['position']);
	});
});

describe('staysBehind', () => {
	it('counts links from lesson videos only', () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const L = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null })
			.lesson.id;
		const v = addLessonVideo(db, {
			lessonId: L,
			file: 'l.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const s = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: 1000, label: null })!.id;
		linkSpot(db, 'u1', s, { figureId: F });
		const r = addRecording(db, {
			figureId: F,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		const rs = addSpot(db, { recordingId: r }, { startMs: 0, endMs: 1000, label: null })!.id;
		linkSpot(db, 'u1', rs, { figureId: F });
		expect(staysBehind(db, 'figure', F)).toBe(1);
		expect(staysBehind(db, 'routine', F)).toBe(0);
	});
});
