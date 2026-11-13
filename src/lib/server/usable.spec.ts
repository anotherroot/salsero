import { describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { usableBy, usableOf, usablePositions } from './usable';
import { addRecording, createFigure } from './figures';
import { createTeam, joinTeam } from './teams';
import { archiveLesson, createLesson, linkFigure, linkRoutine, publishLesson } from './lessons';
import { addLesson, removeLesson } from './entries';
import {
	addChildSlot,
	addFigureSlot,
	createRoutine,
	createRoutineFromFigures,
	insertRoutine
} from './routines';
import { routineSteps } from './db/schema';
import { NO_FILES, T1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';
import {
	figureEndPositions,
	figureStartPositions,
	lessonFigures,
	lessonPositions,
	positions,
	spotLinks,
	spotPositionLinks
} from './db/schema';
import { eq } from 'drizzle-orm';
import { addPosition } from './test-positions';
import { leaveTeam } from './membership';
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

	it('holds a group routine sections at any depth (spec 2026-11-12, review I3)', () => {
		const { db, R, L } = setup();
		const S1 = insertRoutine(db, T1_SALSA, { name: 'S1', notes: null, isSection: true }).routine.id;
		const S2 = insertRoutine(db, T1_SALSA, { name: 'S2', notes: null, isSection: true }).routine.id;
		db.insert(routineSteps).values({ routineId: R, position: 50, childRoutineId: S1 }).run();
		db.insert(routineSteps).values({ routineId: S1, position: 0, childRoutineId: S2 }).run();
		addLesson(db, 'u2', L, NONE, T);
		const u = usableOf(db, U2_SALSA);
		expect(u.routines.has(S1)).toBe(true);
		expect(u.routines.has(S2)).toBe(true);
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

describe('usable positions (ruling 12)', () => {
	/**
	 * Group positions: `onF` tags F (in L), `byHand` is linked from L by hand,
	 * `onH` tags H (in L2, which u2 reads but never added), `onDraft` tags a
	 * figure only a draft lesson holds.
	 */
	function withPositions() {
		const s = setup();
		const { db, F, H, L } = s;
		const onF = addPosition(db, T1_SALSA, 'Abierta');
		const byHand = addPosition(db, T1_SALSA, 'Sombra');
		const onH = addPosition(db, T1_SALSA, 'Cerrada');
		const onDraft = addPosition(db, T1_SALSA, 'Setenta');
		const D = fig(db, T1_SALSA, 'Draft only');
		db.insert(figureStartPositions)
			.values([
				{ figureId: F, positionId: onF },
				{ figureId: H, positionId: onH },
				{ figureId: D, positionId: onDraft }
			])
			.run();
		db.insert(lessonPositions).values({ lessonId: L, positionId: byHand }).run();
		return { ...s, onF, byHand, onH, onDraft, D };
	}
	const sorted = (ids: Iterable<number>) => [...ids].sort((a, b) => a - b);

	it('holds the positions an added lesson reaches: its figures’ tags and its hand links', () => {
		const { db, L, onF, byHand } = withPositions();
		expect(addLesson(db, 'u2', L, NONE, T)).toBe(true);
		expect(sorted(usableOf(db, U2_SALSA).positions)).toEqual(sorted([onF, byHand]));
	});

	it('holds nothing of a lesson the person did not add', () => {
		const { db } = withPositions();
		expect(usableOf(db, U2_SALSA).positions.size).toBe(0);
	});

	it('keeps a group position the person’s own figure already ends in, while they are a member', async () => {
		const { db, onH } = withPositions();
		const mine = fig(db, U2_SALSA, 'Mine');
		// Written directly: u2 reads onH (L2 is published) but never added L2.
		db.insert(figureEndPositions).values({ figureId: mine, positionId: onH }).run();
		expect([...usableOf(db, U2_SALSA).positions]).toEqual([onH]);
		expect(crossRefs(db)).toEqual([]);
		expect(await leaveTeam(db, 1, 'u2', { mode: 'all' }, NO_FILES, T + 1)).toBe('left');
		expect(usableOf(db, U2_SALSA).positions.has(onH)).toBe(false);
	});

	it('keeps what the person’s own lesson and section link by hand', () => {
		const { db, onH, byHand } = withPositions();
		const lesson = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-03',
			title: 'My notes',
			notes: null
		}).lesson.id;
		db.insert(lessonPositions).values({ lessonId: lesson, positionId: byHand }).run();
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
		db.insert(spotPositionLinks).values({ spotId: spot.id, positionId: onH }).run();
		expect(sorted(usableOf(db, U2_SALSA).positions)).toEqual(sorted([byHand, onH]));
		expect(crossRefs(db)).toEqual([]);
	});

	it('never holds what the person does not read, even when their row points at it', () => {
		const { db, onDraft } = withPositions();
		const mine = fig(db, U2_SALSA, 'Mine');
		db.insert(figureStartPositions).values({ figureId: mine, positionId: onDraft }).run();
		expect(usableOf(db, U2_SALSA).positions.has(onDraft)).toBe(false);
		expect(crossRefs(db)).toEqual([
			`figures ${mine}: start position ${onDraft} is group 1's, which u2 does not read`
		]);
	});

	it('holds the positions a figure the person’s routine uses is tagged with', () => {
		const { db, H, L2, onH } = withPositions();
		expect(addLesson(db, 'u2', L2, NONE, T)).toBe(true);
		const R = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null }).routine.id;
		expect(addFigureSlot(db, R, H)).not.toBeNull();
		expect(removeLesson(db, 'u2', L2, T + 1)).toBe(true);
		// H stays usable through the slot, and so does what it is tagged with.
		expect(usableOf(db, U2_SALSA).positions.has(onH)).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});

	it('usablePositions lists them live, with their group, by name', () => {
		const { db, L, onF, byHand } = withPositions();
		addLesson(db, 'u2', L, NONE, T);
		const listed = usablePositions(db, U2_SALSA);
		expect(listed.map((p) => p.id)).toEqual([onF, byHand]);
		expect(listed[0]).toMatchObject({ name: 'Abierta', team: { id: 1, name: 'Salsa Tuesdays' } });
		expect(usablePositions(db, { userId: 'u2', dance: 'bachata' })).toEqual([]);
	});

	it('usableBy answers for positions as for the other kinds', () => {
		const { db, L, onF, onDraft } = withPositions();
		addLesson(db, 'u2', L, NONE, T);
		const row = (id: number) => db.select().from(positions).where(eq(positions.id, id)).get()!;
		expect(usableBy(db, U2_SALSA, 'positions', row(onF))).toBe(true);
		expect(usableBy(db, U2_SALSA, 'positions', row(onDraft))).toBe(false);
		expect(usableBy(db, T1_SALSA, 'positions', row(onF))).toBe(false);
	});
});
