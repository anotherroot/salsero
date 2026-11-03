import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { lessonAdds, lessons } from './db/schema';
import {
	drillAccess,
	figureAccess,
	figureGroupAccess,
	fileAccess,
	lessonAccess,
	publishedReach,
	lessonVideoAccess,
	reach,
	recordingAccess,
	routineAccess
} from './access';
import { createCustomExercise, getExercise } from './exercises';
import { addRecording, createFigure, createVariationIn, listGroupVariations } from './figures';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine
} from './lessons';
import { addChildSlot, addFigureSlot, archiveRoutine, createRoutine, getRoutine } from './routines';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import {
	requireExerciseAccess,
	requireFigureAccess,
	requireLessonAccess,
	requireRoutineAccess
} from './scope';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { leaveTeam, setRole } from './membership';
import { T1_SALSA, U1_SALSA } from './test-walls';

/**
 * Team T1, owned by u1 (an editor too, as owners are). u2 and u5 are members,
 * u3 an editor, u4 an outsider. P is published and links routine R, which
 * embeds C, whose slot holds V2. D is a draft holding V3, a newer variation of
 * V2's figure. A is published and archived. V2 has a recording.
 */
let db: Db;
let P: number, D: number, A: number;
let R: number, C: number;
let V2: number, V3: number, groupId: number;
let recId: number;
let drill: number, draftDrill: number, viaDrill: number;
let pVideo: number, dVideo: number;

const lessonRow = (id: number) => db.select().from(lessons).where(eq(lessons.id, id)).get()!;
const variation = (id: number) => ({ id, userId: null, teamId: 1 });
const publish = (id: number) =>
	db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, id)).run();
const add = (userId: string, lessonId: number) =>
	db.insert(lessonAdds).values({ userId, lessonId, addedAt: 1, seenAt: 1 }).run();
const lessonInput = (title: string) => ({ lessonDay: '2026-11-02', title, notes: null });
/** A setup step that must have happened, or every assertion after it is hollow. */
const must = (made: unknown) => {
	if (!made) throw new Error('setup step refused');
};

beforeEach(() => {
	db = openDb(':memory:');
	const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	if (!made.ok || made.teamId !== T1_SALSA.teamId) throw new Error('team 1 expected');
	for (const u of ['u2', 'u3', 'u5']) joinTeam(db, u, 1, 2);
	setRole(db, 1, 'u3', 'editor');

	const fig = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	V2 = fig.figure.id;
	groupId = fig.figure.groupId!;
	V3 = createVariationIn(
		db,
		groupId,
		{
			name: 'Doble-only-in-draft',
			partner: 'partner',
			style: 'salsa',
			notes: null
		},
		'u1'
	)!.id;
	recId = addRecording(
		db,
		{
			figureId: V2,
			file: 'v2.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		},
		'u1'
	).id;

	C = createRoutine(db, T1_SALSA, { name: 'Child', notes: null }).routine.id;
	must(addFigureSlot(db, C, V2, 'u1'));
	R = createRoutine(db, T1_SALSA, { name: 'Parent', notes: null }).routine.id;
	must(addChildSlot(db, R, C, 'u1'));

	P = createLesson(db, T1_SALSA, lessonInput('Published')).lesson.id;
	must(linkRoutine(db, P, R, 'u1'));
	publish(P);
	drill = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
	must(linkExercise(db, P, drill, 'u1'));
	pVideo = addLessonVideo(
		db,
		{ lessonId: P, file: 'p.mp4', mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;
	viaDrill = createCustomExercise(db, T1_SALSA, { name: 'Via', everyDays: 3, notes: null }).id;
	const section = addSpot(
		db,
		{ lessonVideoId: pVideo },
		{ startMs: 0, endMs: 9, label: 'S' },
		'u1'
	)!;
	linkInSpace(db, T1_SALSA, section.id, { exerciseId: viaDrill });

	D = createLesson(db, T1_SALSA, lessonInput('Draft')).lesson.id;
	must(linkFigure(db, D, V3, 'u1'));
	draftDrill = createCustomExercise(db, T1_SALSA, {
		name: 'Draft drill',
		everyDays: 3,
		notes: null
	}).id;
	must(linkExercise(db, D, draftDrill, 'u1'));
	dVideo = addLessonVideo(
		db,
		{ lessonId: D, file: 'd.mp4', mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;

	A = createLesson(db, T1_SALSA, lessonInput('Archived')).lesson.id;
	publish(A);
	archiveLesson(db, A, 3, 'u1');
});

describe('reach', () => {
	it('a member reaches P and what it contains, closed under embedding, and nothing of D or A', () => {
		const r = reach(db, 'u2', 1);
		expect([...r.lessons]).toEqual([P]);
		expect([...r.routines].sort()).toEqual([R, C].sort());
		expect([...r.variations]).toEqual([V2]);
		expect([...r.figures]).toEqual([groupId]);
		expect([...r.recordings]).toEqual([recId]);
		expect([...r.drills].sort()).toEqual([drill, viaDrill].sort());
		expect(r.lessons.has(D) || r.lessons.has(A)).toBe(false);
		expect(r.variations.has(V3) || r.drills.has(draftDrill)).toBe(false);
	});

	it("the figure page's variations for a member are V2 only", () => {
		const r = reach(db, 'u2', 1);
		const shown = listGroupVariations(db, groupId)
			.filter((v) => r.variations.has(v.id))
			.map((v) => v.id);
		expect(shown).toEqual([V2]);
	});

	it('an archived routine takes what only it held with it', () => {
		archiveRoutine(db, C, 4, 'u1');
		const r = reach(db, 'u2', 1);
		expect([...r.routines]).toEqual([R]);
		expect(r.variations.size).toBe(0);
		expect(r.recordings.size).toBe(0);
	});

	it('an outsider reaches nothing', () => {
		const r = reach(db, 'u4', 1);
		expect(Object.values(r).every((s) => s.size === 0)).toBe(true);
	});
});

describe('access', () => {
	it('a member reads P and its contents, edits none of it, and gets nothing of D', () => {
		expect(lessonAccess(db, 'u2', lessonRow(P))).toBe('read');
		expect(routineAccess(db, 'u2', getRoutine(db, R)!)).toBe('read');
		expect(routineAccess(db, 'u2', getRoutine(db, C)!)).toBe('read');
		expect(figureAccess(db, 'u2', variation(V2))).toBe('read');
		expect(figureGroupAccess(db, 'u2', { id: groupId, userId: null, teamId: 1 })).toBe('read');
		expect(recordingAccess(db, 'u2', { id: recId, figureId: V2 })).toBe('read');
		expect(drillAccess(db, 'u2', getExercise(db, drill)!)).toBe('read');
		expect(lessonVideoAccess(db, 'u2', { lessonId: P })).toBe('read');

		expect(lessonAccess(db, 'u2', lessonRow(D))).toBeNull();
		expect(lessonAccess(db, 'u2', lessonRow(A))).toBeNull();
		expect(figureAccess(db, 'u2', variation(V3))).toBeNull();
		expect(drillAccess(db, 'u2', getExercise(db, draftDrill)!)).toBeNull();
		expect(lessonVideoAccess(db, 'u2', { lessonId: D })).toBeNull();
	});

	it('an editor and the owner edit D, drafts included', () => {
		for (const u of ['u1', 'u3']) {
			expect(lessonAccess(db, u, lessonRow(D))).toBe('edit');
			expect(figureAccess(db, u, variation(V3))).toBe('edit');
			expect(drillAccess(db, u, getExercise(db, draftDrill)!)).toBe('edit');
			expect(lessonAccess(db, u, lessonRow(P))).toBe('edit');
		}
	});

	it('an outsider gets null on everything', () => {
		expect(lessonAccess(db, 'u4', lessonRow(P))).toBeNull();
		expect(lessonAccess(db, 'u4', lessonRow(D))).toBeNull();
		expect(routineAccess(db, 'u4', getRoutine(db, R)!)).toBeNull();
		expect(routineAccess(db, 'u4', getRoutine(db, C)!)).toBeNull();
		expect(figureAccess(db, 'u4', variation(V2))).toBeNull();
		expect(figureGroupAccess(db, 'u4', { id: groupId, userId: null, teamId: 1 })).toBeNull();
		expect(recordingAccess(db, 'u4', { id: recId, figureId: V2 })).toBeNull();
		expect(drillAccess(db, 'u4', getExercise(db, drill)!)).toBeNull();
		expect(lessonVideoAccess(db, 'u4', { lessonId: P })).toBeNull();
		expect(() => fileAccess(db, 'u4', 'lesson-video', 'p.mp4')).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});

	it('a person edits their own rows and nobody else does', () => {
		const own = createLesson(db, U1_SALSA, lessonInput('Mine')).lesson;
		expect(lessonAccess(db, 'u1', own)).toBe('edit');
		expect(lessonAccess(db, 'u2', own)).toBeNull();
	});

	it('the media file of P is served to a member, of D is a 404 like a missing one', () => {
		expect(fileAccess(db, 'u2', 'lesson-video', 'p.mp4').file).toBe('p.mp4');
		expect(fileAccess(db, 'u2', 'recording', 'v2.mp4').file).toBe('v2.mp4');
		for (const file of ['d.mp4', 'missing.mp4']) {
			expect(() => fileAccess(db, 'u2', 'lesson-video', file)).toThrow(
				expect.objectContaining({ status: 404 })
			);
		}
		expect(dVideo).toBeGreaterThan(0);
	});

	it('after leaving, a former member reaches P only if they had added it', () => {
		add('u2', P);
		add('u2', D); // a draft never reaches anyone, added or not
		expect(leaveTeam(db, 1, 'u2')).toBe('left');
		expect(leaveTeam(db, 1, 'u5')).toBe('left');
		expect(lessonAccess(db, 'u2', lessonRow(P))).toBe('read');
		expect([...reach(db, 'u2', 1).lessons]).toEqual([P]);
		expect(figureAccess(db, 'u2', variation(V2))).toBe('read');
		expect(lessonAccess(db, 'u2', lessonRow(D))).toBeNull();
		expect(lessonAccess(db, 'u5', lessonRow(P))).toBeNull();
		expect(reach(db, 'u5', 1).lessons.size).toBe(0);
	});

	it('after the group is deleted, a member with P added reads P; the owner reads but does not edit', () => {
		add('u2', P);
		expect(deleteTeam(db, 1, 'u1', 5)).toBe(true);
		expect(lessonAccess(db, 'u2', lessonRow(P))).toBe('read');
		expect(lessonAccess(db, 'u5', lessonRow(P))).toBeNull();
		expect(lessonAccess(db, 'u1', lessonRow(P))).toBe('read');
		expect(lessonAccess(db, 'u1', lessonRow(D))).toBe('read');
		expect(figureAccess(db, 'u1', variation(V3))).toBe('read');
	});

	it('after the group is deleted, an editor reads everything, drafts included, and edits nothing (R25)', () => {
		add('u2', P);
		add('u2', D);
		expect(deleteTeam(db, 1, 'u1', 5)).toBe(true);
		expect(lessonAccess(db, 'u3', lessonRow(D))).toBe('read');
		expect(lessonAccess(db, 'u3', lessonRow(P))).toBe('read');
		expect(figureAccess(db, 'u3', variation(V3))).toBe('read');
		expect(drillAccess(db, 'u3', getExercise(db, draftDrill)!)).toBe('read');
		expect(lessonVideoAccess(db, 'u3', { lessonId: D })).toBe('read');
		// A member, even one who added the draft, still does not.
		expect(lessonAccess(db, 'u2', lessonRow(D))).toBeNull();
		expect(figureAccess(db, 'u2', variation(V3))).toBeNull();
		expect(lessonAccess(db, 'u5', lessonRow(D))).toBeNull();
	});
});

describe('the guards', () => {
	const as = (id: string, dance = 'salsa') =>
		[
			db,
			{ user: { id, email: `${id}@example.com`, timezone: 'UTC', isAdmin: false } } as App.Locals,
			{ dance }
		] as const;
	const threw404 = expect.objectContaining({ status: 404 });

	it('a member reads P but may not edit it; D, another dance and an outsider are 404s', () => {
		expect(requireLessonAccess(...as('u2'), P, 'read')).toMatchObject({
			access: 'read',
			space: { teamId: 1, dance: 'salsa', actorId: 'u2' }
		});
		expect(() => requireLessonAccess(...as('u2'), P, 'edit')).toThrow(threw404);
		expect(() => requireLessonAccess(...as('u2'), D, 'read')).toThrow(threw404);
		expect(() => requireLessonAccess(...as('u2', 'bachata'), P, 'read')).toThrow(threw404);
		expect(() => requireLessonAccess(...as('u4'), P, 'read')).toThrow(threw404);
		expect(requireLessonAccess(...as('u3'), D, 'edit').access).toBe('edit');
	});

	it('once the group is deleted, its editor reads the draft D and may not edit it (R25)', () => {
		expect(deleteTeam(db, 1, 'u1', 5)).toBe(true);
		expect(requireLessonAccess(...as('u3'), D, 'read').access).toBe('read');
		expect(() => requireLessonAccess(...as('u3'), D, 'edit')).toThrow(threw404);
		expect(() => requireFigureAccess(...as('u3'), V3, 'edit')).toThrow(threw404);
		expect(() => requireLessonAccess(...as('u2'), D, 'read')).toThrow(threw404);
	});

	it('figures and routines follow reach the same way', () => {
		expect(requireFigureAccess(...as('u2'), V2, 'read').figure.id).toBe(V2);
		expect(() => requireFigureAccess(...as('u2'), V3, 'read')).toThrow(threw404);
		expect(() => requireFigureAccess(...as('u2'), V2, 'edit')).toThrow(threw404);
		expect(requireRoutineAccess(...as('u2'), C, 'read').routine.id).toBe(C);
		expect(() => requireRoutineAccess(...as('u2'), C, 'edit')).toThrow(threw404);
		expect(requireRoutineAccess(...as('u3'), C, 'edit').access).toBe('edit');
	});

	it("an exercise: the person's own row to edit, a group drill in reach only to read", () => {
		const mine = createCustomExercise(
			db,
			{ userId: 'u2', dance: 'salsa' },
			{
				name: 'Mine',
				everyDays: 3,
				notes: null
			}
		).id;
		expect(requireExerciseAccess(...as('u2'), mine, 'edit').access).toBe('edit');
		expect(() => requireExerciseAccess(...as('u1'), mine, 'read')).toThrow(threw404);
		expect(requireExerciseAccess(...as('u2'), drill, 'read').access).toBe('read');
		expect(() => requireExerciseAccess(...as('u2'), drill, 'edit')).toThrow(threw404);
		expect(() => requireExerciseAccess(...as('u2'), draftDrill, 'read')).toThrow(threw404);
		expect(requireExerciseAccess(...as('u3'), draftDrill, 'edit').access).toBe('edit');
	});
});

describe('publishedReach', () => {
	it('reaches what published lessons link, and nothing from drafts or unlinked rows', () => {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
		const fig = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		const V = fig.figure.id;
		const R = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		const D = createRoutine(db, T1_SALSA, { name: 'D', notes: null }).routine.id;
		const U = createRoutine(db, T1_SALSA, { name: 'U', notes: null }).routine.id;
		const pub = createLesson(db, T1_SALSA, lessonInput('P')).lesson.id;
		const draft = createLesson(db, T1_SALSA, lessonInput('Draft')).lesson.id;
		must(linkRoutine(db, pub, R, 'u1'));
		must(linkFigure(db, pub, V, 'u1'));
		must(linkRoutine(db, draft, D, 'u1'));
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, pub)).run();

		const got = publishedReach(db, 1);
		expect([...got.routines]).toEqual([R]);
		expect(got.routines.has(D) || got.routines.has(U)).toBe(false);
		expect([...got.variations]).toEqual([V]);

		db.update(lessons).set({ archivedAt: 5 }).where(eq(lessons.id, pub)).run();
		const none = publishedReach(db, 1);
		expect(none.routines.size).toBe(0);
		expect(none.variations.size).toBe(0);
	});
});
