import { describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { usableOf } from './usable';
import { addRecording, createFigure } from './figures';
import { createTeam, joinTeam } from './teams';
import { archiveLesson, createLesson, linkFigure, linkRoutine, publishLesson } from './lessons';
import { addLesson, removeLesson } from './entries';
import { addChildSlot, addFigureSlot, createRoutine, createRoutineFromFigures } from './routines';
import { T1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';
import { lessonFigures, spotLinks } from './db/schema';
import { addSpot } from './spots';
import { crossRefs } from './integrity';

const T = 1_790_000_000_000;
const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

const fig = (db: Db, space: Space, figureName: string) =>
	createFigure(db, space, {
		figureName,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;

/** Salsa Tuesdays (u1's): F and R (options G) in published lesson L; H in published L2. u2 is a member. */
function setup() {
	const db = openDb(':memory:');
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	const F = fig(db, T1_SALSA, 'Enchufla');
	const G = fig(db, T1_SALSA, 'Setenta');
	const H = fig(db, T1_SALSA, 'Sombrero');
	const R = createRoutineFromFigures(db, T1_SALSA, { name: 'Class routine', notes: null }, [G])!
		.routine.id;
	const lesson = (title: string) =>
		createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title, notes: null }).lesson.id;
	const L = lesson('Week 1');
	expect(linkFigure(db, L, F, 'u1')).toBe(true);
	expect(linkRoutine(db, L, R, 'u1')).toBe(true);
	expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
	const L2 = lesson('Week 2');
	expect(linkFigure(db, L2, H, 'u1')).toBe(true);
	expect(publishLesson(db, T1_SALSA, L2, T)).toBe(true);
	return { db, F, G, H, R, L, L2 };
}

describe('usableOf', () => {
	it('holds what the lessons the person added reach: figures, routines and their options', () => {
		const { db, F, G, R, L } = setup();
		expect(addLesson(db, 'u2', L, NONE, T)).toBe(true);
		const u = usableOf(db, U2_SALSA);
		expect([...u.figures].sort((a, b) => a - b)).toEqual([F, G].sort((a, b) => a - b));
		expect([...u.routines]).toEqual([R]);
		expect([...u.drills]).toEqual([]);
	});

	it('gives nothing for a published lesson the person did not add', () => {
		const { db, H } = setup();
		const u = usableOf(db, U2_SALSA);
		expect(u.figures.has(H)).toBe(false);
		expect(u.figures.size + u.routines.size + u.drills.size).toBe(0);
	});

	it('never holds the person’s own rows', () => {
		const { db, L } = setup();
		addLesson(db, 'u2', L, NONE, T);
		const mine = fig(db, U2_SALSA, 'Mine');
		expect(usableOf(db, U2_SALSA).figures.has(mine)).toBe(false);
	});

	it('keeps what the person’s own slots use while they still read it', () => {
		const { db, F, G, R, L } = setup();
		addLesson(db, 'u2', L, NONE, T);
		const P = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null }).routine.id;
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		const Q = createRoutine(db, U2_SALSA, { name: 'Embeds', notes: null }).routine.id;
		expect(addChildSlot(db, Q, R)).not.toBeNull();
		expect(removeLesson(db, 'u2', L, T + 1)).toBe(true);
		const u = usableOf(db, U2_SALSA);
		// Still a member, L still published: u2 reads F and R, so the slots stay playable.
		expect(u.figures.has(F)).toBe(true);
		expect(u.routines.has(R)).toBe(true);
		expect(u.figures.has(G)).toBe(true);
		// And every pointer of u2's is one u2 reads.
		expect(crossRefs(db)).toEqual([]);
	});

	it('drops a pointed-at row the person no longer reads', () => {
		const { db, F, L } = setup();
		addLesson(db, 'u2', L, NONE, T);
		const P = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null }).routine.id;
		addFigureSlot(db, P, F);
		removeLesson(db, 'u2', L, T + 1);
		archiveLesson(db, L, T + 2, 'u1');
		expect(usableOf(db, U2_SALSA).figures.has(F)).toBe(false);
	});

	it('keeps a hand link of the person’s own lesson the same way', () => {
		const { db, H } = setup();
		// u2 reads H as a member (L2 is published) but never added L2.
		const mine = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-03',
			title: 'My notes',
			notes: null
		}).lesson.id;
		// Written directly: linking a group's figure from one's own lesson is Task 14's.
		db.insert(lessonFigures).values({ lessonId: mine, figureId: H }).run();
		expect(usableOf(db, U2_SALSA).figures.has(H)).toBe(true);
	});

	it('keeps what a section link on the person’s own recording points at', () => {
		const { db, H } = setup();
		const mine = fig(db, U2_SALSA, 'Mine');
		const rec = addRecording(db, {
			figureId: mine,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		const spot = addSpot(db, { recordingId: rec.id }, { startMs: 0, endMs: 1000, label: null })!;
		// Written directly: linking a group's figure from one's own section is Task 14's.
		db.insert(spotLinks).values({ spotId: spot.id, figureId: H }).run();
		expect(usableOf(db, U2_SALSA).figures.has(H)).toBe(true);
	});
});
