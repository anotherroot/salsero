/**
 * Link from other places: what a group's pickers find in your own app and in
 * your other groups while you search. Ana (u1) owns Salsa Tuesdays (T1),
 * edits Rueda club (T2, Maja's) and is a member of Tuesday class (T3, Maja's).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { addRecording, archiveVariation, createFigure, createVariationIn } from './figures';
import { addLessonVideo, createLesson, linkFigure, publishLesson } from './lessons';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { createPosition } from './positions';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
import { markTwins } from './twins';
import { cloneInto } from './clones/clone';
import { copyHereView, copyPlan, copyTargets } from './clones/copy-to';
import type { Space, TeamSpace } from './scope';
import type { PositionInput } from '$lib/types';
import type { PositionRow } from './db/schema';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_SALSA } from './test-walls';
import { PER_KIND, elsewhereGroup, findElsewhere, staysBehind } from './elsewhere';

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

	it('finds moves by their own name, one row per name, never one the group has', () => {
		const mine = createFigure(db, U1_SALSA, {
			figureName: 'Cradle entry',
			name: 'Basic',
			...shape
		})!;
		createVariationIn(db, mine.group.id, { name: 'Fast', ...shape });
		figure(U1_SALSA, 'Setenta', 'Cradle-ish');
		figure(T2_SALSA, 'Cradle entry', 'With turn');
		figure(T2_SALSA, 'Cradle exit');
		figure(T1_SALSA, 'CRÁDLE EXIT');
		const places = findElsewhere(db, T1_SALSA, ['move'], 'cradle');
		// Setenta's figure matches, its name does not; Cradle exit is the group's own.
		expect(placeNames(places)).toEqual(['mine']);
		expect(places[0].rows).toMatchObject([
			{ kind: 'move', label: 'Cradle entry', heading: null, alsoIn: ['Rueda club'] }
		]);
	});

	it('a read-only group’s move shows once the person reads one of its figures', () => {
		const F = figure(T3_SALSA, 'Cradle walk', 'Slow');
		expect(findElsewhere(db, T1_SALSA, ['move'], 'cradle')).toEqual([]);
		const L = createLesson(db, T3_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null })
			.lesson.id;
		linkFigure(db, L, F, 'u3');
		expect(publishLesson(db, T3_SALSA, L, T)).toBe(true);
		const places = findElsewhere(db, T1_SALSA, ['move'], 'cradle');
		expect(places).toMatchObject([{ readOnly: true, rows: [{ label: 'Cradle walk' }] }]);
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

describe('copyHereView', () => {
	it('the plan carries stays-behind and the group’s storage', () => {
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
		const view = copyHereView(db, 'u1', 'figure', F, T1_SALSA, 'UTC');
		const t1 = copyTargets(db, 'u1', 'figure', F).find(
			(t) => t.place.kind === 'team' && t.place.teamId === 1
		)!;
		expect(view).toMatchObject({
			staysBehind: 1,
			usedBytes: t1.usedBytes,
			limitBytes: t1.limitBytes
		});
		expect(view.goes).toBe(copyPlan(db, 'u1', 'figure', F, T1_SALSA, 'UTC').goes);
	});

	it('a song or a lesson counts nothing behind', () => {
		const L = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null })
			.lesson.id;
		expect(copyHereView(db, 'u1', 'lesson', L, T1_SALSA, 'UTC').staysBehind).toBe(0);
	});
});

describe('elsewhereGroup', () => {
	it('only a person who edits a live group of the dance gets it', () => {
		expect(elsewhereGroup(db, 'u1', 'salsa', 1)).toEqual(T1_SALSA);
		expect(elsewhereGroup(db, 'u1', 'salsa', 2)).toEqual(T2_SALSA);
		// A member only reads Tuesday class.
		expect(elsewhereGroup(db, 'u1', 'salsa', 3)).toBeNull();
		expect(elsewhereGroup(db, 'u1', 'bachata', 1)).toBeNull();
		expect(elsewhereGroup(db, 'u1', 'salsa', 99)).toBeNull();
	});
});

describe('findElsewhere at scale (review I1, I2)', () => {
	const prepares = () => {
		const raw = (db as unknown as { $client: { prepare: (...a: unknown[]) => unknown } }).$client;
		return vi.spyOn(raw, 'prepare');
	};

	it('does a fixed number of queries, not one or more per matching row', () => {
		for (let i = 0; i < 40; i++) figure(U1_SALSA, `Basic move ${i}`);
		const spy = prepares();
		findElsewhere(db, T1_SALSA, ['figure'], 'basic');
		expect(spy.mock.calls.length).toBeLessThan(40);
		spy.mockRestore();
	});

	it('caps each place’s kind, so a long list never hides the other kinds or places', () => {
		for (let i = 0; i < 30; i++) figure(U1_SALSA, `Basic move ${i}`);
		position(U1_SALSA, 'Basic hold');
		figure(T2_SALSA, 'Basic theirs');
		const places = findElsewhere(db, T1_SALSA, ['figure', 'position'], 'basic');
		expect(placeNames(places)).toEqual(['mine', 'Rueda club']);
		const mine = places[0].rows;
		expect(mine.filter((r) => r.kind === 'figure').length).toBe(PER_KIND);
		expect(mine.filter((r) => r.kind === 'position').map((r) => r.label)).toEqual(['Basic hold']);
	});
});

describe('stays behind, for a group you only read (review M2)', () => {
	it('counts only sections on lessons the reader reaches', () => {
		const F = figure(T3_SALSA, 'Cradle walk', 'Slow');
		const section = (title: string) => {
			const L = createLesson(db, T3_SALSA, { lessonDay: '2026-11-01', title, notes: null }).lesson
				.id;
			const v = addLessonVideo(
				db,
				{ lessonId: L, file: `${title}.mp4`, mime: 'video/mp4', sizeBytes: 1 },
				'u3'
			).id;
			const s = addSpot(
				db,
				{ lessonVideoId: v },
				{ startMs: 0, endMs: 1000, label: null },
				'u3'
			)!.id;
			linkSpot(db, 'u3', s, { figureId: F });
			return L;
		};
		const shown = section('Published');
		linkFigure(db, shown, F, 'u3');
		expect(publishLesson(db, T3_SALSA, shown, T)).toBe(true);
		section('Draft');
		expect(copyHereView(db, 'u1', 'figure', F, T1_SALSA, 'UTC').staysBehind).toBe(1);
	});
});

describe('findElsewhere: picker preview', () => {
	it('a figure row carries its look; a drill row none', () => {
		figure(U1_SALSA, 'Cradle entry');
		const [mine] = findElsewhere(db, T1_SALSA, ['figure'], 'cradle');
		expect(mine.rows[0].look).toEqual({ hands: '', length: 8, picture: null });
	});
});
