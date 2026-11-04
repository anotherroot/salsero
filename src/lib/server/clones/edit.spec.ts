/**
 * Edit makes it yours: a person who only reads a group's figure, routine,
 * drill, song or lesson gets their own copy, and everything of theirs that
 * used the group's row (routines, practice) moves onto it. Files are fakes
 * (`NO_FILES`); the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	lessonVideos,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	songs,
	users
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { leaveTeam, setRole } from '../membership';
import { archiveVariation, createFigure } from '../figures';
import { archiveRoutine, createRoutine } from '../routines';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from '../lessons';
import { archiveExercise, createCustomExercise } from '../exercises';
import { addLesson, addOffer, newInLesson } from '../entries';
import { archiveSong, createSongFromUpload, storeAnalysis } from '../songs';
import { shareSong } from '../song-share';
import { crossRefs } from '../integrity';
import type { Space } from '../scope';
import { NO_FILES, T1_SALSA, U2_SALSA } from '../test-walls';
import { makeMine, makeMinePreview } from './edit';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
const ROOMY = 1024 ** 4;

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' },
			{ id: 'u4', email: 'u4@x.si', passwordHash: 'x', firstName: 'Nik' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
	setRole(db, 1, 'u3', 'editor');
});

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const routine = (space: Space, name: string) =>
	createRoutine(db, space, { name, notes: null }).routine.id;
function published(title: string, link: (id: number) => void = () => {}) {
	const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title, notes: null }).lesson.id;
	link(id);
	expect(publishLesson(db, T1_SALSA, id, T)).toBe(true);
	return id;
}
function slot(routineId: number, position: number, figureIds: number[]) {
	const step = db.insert(routineSteps).values({ routineId, position }).returning().get().id;
	for (const figureId of figureIds)
		db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
	return step;
}
const optionsOf = (stepId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all()
		.map((r) => r.f);
const figureRow = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const exerciseRow = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;
const setsOf = (exerciseId: number) =>
	db.select().from(sets).where(eq(sets.exerciseId, exerciseId)).all();
const entryOn = (col: 'figureId' | 'routineId' | 'drillId' | 'lessonId', id: number) =>
	db
		.select()
		.from(exercises)
		.where(and(eq(exercises.userId, 'u2'), eq(exercises[col], id)))
		.get();
const mine = (kind: 'figure' | 'routine' | 'drill' | 'song' | 'lesson', id: number) =>
	makeMine(db, U2_SALSA, kind, id, NO_FILES, NOW, ROOMY);

/**
 * Group figure Setenta · Básico (F) in published lesson L, which u2 added
 * practising F (an entry with a set). u2's routine Week 4 loop (P) has a slot
 * holding F, and u2 has a Setenta move of their own (Cruzado).
 */
function readerOfFigure() {
	const F = figure(T1_SALSA, 'Setenta');
	const L = published('Week 4', (id) => linkFigure(db, id, F, 'u1'));
	expect(addLesson(db, 'u2', L, { ...NONE, figureIds: [F] }, T)).toBe(true);
	const entry = entryOn('figureId', F)!;
	db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();
	const P = routine(U2_SALSA, 'Week 4 loop');
	const step = slot(P, 1, [F]);
	const own = figure(U2_SALSA, 'Setenta', 'Cruzado');
	expect(crossRefs(db)).toEqual([]);
	return { F, L, P, step, entry, own };
}

describe('makeMine: a figure', () => {
	it('copies it under the person’s move, moves their routine and practice, and says where', async () => {
		const { F, step, entry, own } = readerOfFigure();
		const res = await mine('figure', F);
		expect(res).toMatchObject({ ok: true, made: true, archived: false });
		const id = (res as { id: number }).id;

		const copy = figureRow(id);
		expect(copy).toMatchObject({ userId: 'u2', teamId: null, clonedFrom: F, name: 'Básico' });
		expect(copy.groupId).toBe(figureRow(own).groupId);
		// The routine's option is the copy now; the group's figure is untouched.
		expect(optionsOf(step)).toEqual([id]);
		expect(figureRow(F).archivedAt).toBeNull();
		// The entry moved with its set, and stays on Today.
		const moved = exerciseRow(entry.id);
		expect(moved).toMatchObject({ figureId: id, archivedAt: null, active: true });
		expect(setsOf(entry.id)).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a second Edit (by URL, after shadowing) lands on the same copy', async () => {
		const { F, step } = readerOfFigure();
		const first = (await mine('figure', F)) as { id: number };
		const again = await mine('figure', F);
		expect(again).toEqual({ ok: true, id: first.id, made: false, archived: false });
		expect(db.select().from(figures).where(eq(figures.clonedFrom, F)).all()).toHaveLength(1);
		expect(optionsOf(step)).toEqual([first.id]);
	});

	it('after the copy was dropped (archived), Edit restores it rather than making another', async () => {
		const { F, step } = readerOfFigure();
		const first = (await mine('figure', F)) as { id: number };
		expect(archiveVariation(db, first.id, NOW + 1)).not.toBeNull();

		const again = await makeMine(db, U2_SALSA, 'figure', F, NO_FILES, NOW + 2, ROOMY);
		expect(again).toMatchObject({ ok: true, id: first.id, made: false });
		expect(figureRow(first.id).archivedAt).toBeNull();
		expect(db.select().from(figures).where(eq(figures.clonedFrom, F)).all()).toHaveLength(1);
		expect(optionsOf(step)).toEqual([first.id]);
		// The practice archived with the copy comes back with it.
		expect(entryOn('figureId', first.id)).toMatchObject({ archivedAt: null });
		expect(crossRefs(db)).toEqual([]);
	});

	it('is a reader’s only: an editor, an outsider and the person’s own row are denied', async () => {
		const { F, own } = readerOfFigure();
		const as = (userId: string, id: number) =>
			makeMine(db, { userId, dance: 'salsa' }, 'figure', id, NO_FILES, NOW, ROOMY);
		expect(await as('u3', F)).toEqual({ ok: false, reason: 'denied' });
		expect(await as('u4', F)).toEqual({ ok: false, reason: 'denied' });
		expect(await as('u2', own)).toEqual({ ok: false, reason: 'denied' });
		expect(
			await makeMine(db, { userId: 'u2', dance: 'bachata' }, 'figure', F, NO_FILES, NOW, ROOMY)
		).toEqual({ ok: false, reason: 'denied' });
		// An archived group figure has no page, and no Edit.
		archiveVariation(db, F, NOW, 'u1');
		expect(await as('u2', F)).toEqual({ ok: false, reason: 'denied' });
	});

	it('the preview: the label, what switches, what it costs, and the copy once there', async () => {
		const { F, P } = readerOfFigure();
		expect(makeMinePreview(db, U2_SALSA, 'figure', F)).toEqual({
			title: 'Setenta · Básico',
			repoint: {
				routines: [{ id: P, name: 'Week 4 loop' }],
				lessons: [],
				sections: 0,
				entries: 1,
				twins: 0
			},
			practised: true,
			bytes: 0,
			existing: null
		});
		const { id } = (await mine('figure', F)) as { id: number };
		expect(makeMinePreview(db, U2_SALSA, 'figure', F)).toMatchObject({
			existing: { id, archived: false },
			repoint: { routines: [], entries: 0 },
			practised: false
		});
	});
});

describe('makeMine: a routine', () => {
	it('copies it with its figures; the person’s routines and practice follow', async () => {
		const G = figure(T1_SALSA, 'Enchufla');
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [G]);
		const L = published('Week 5', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, routineIds: [R] }, T)).toBe(true);
		const entry = entryOn('routineId', R)!;
		db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();
		// u2's own routine uses the class routine's figure too.
		const Q = routine(U2_SALSA, 'Shines');
		const step = slot(Q, 1, [G]);

		expect(makeMinePreview(db, U2_SALSA, 'routine', R)).toMatchObject({
			title: 'Class routine',
			repoint: { routines: [{ id: Q, name: 'Shines' }], entries: 1 },
			practised: true
		});
		const res = (await mine('routine', R)) as { ok: true; id: number };
		expect(res.ok).toBe(true);
		const copy = db.select().from(routines).where(eq(routines.id, res.id)).get()!;
		expect(copy).toMatchObject({ userId: 'u2', clonedFrom: R, archivedAt: null });
		const g = db
			.select()
			.from(figures)
			.where(and(eq(figures.clonedFrom, G), eq(figures.userId, 'u2')))
			.get()!;
		// What the copy brought (Enchufla) takes the person's own slot too.
		expect(optionsOf(step)).toEqual([g.id]);
		// One live practice of the copy, holding the set.
		const live = db
			.select()
			.from(exercises)
			.where(
				and(
					eq(exercises.userId, 'u2'),
					eq(exercises.routineId, res.id),
					isNull(exercises.archivedAt)
				)
			)
			.all();
		expect(live).toHaveLength(1);
		expect(live[0].active).toBe(true);
		const all = db
			.select({ id: exercises.id })
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.routineId, res.id)))
			.all()
			.map((e) => e.id);
		expect(all.flatMap((id) => setsOf(id))).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a routine nobody practised: its copy waits off Today', async () => {
		const R = routine(T1_SALSA, 'Class routine');
		published('Week 5', (id) => linkRoutine(db, id, R, 'u1'));
		const res = (await mine('routine', R)) as { id: number };
		const own = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.routineId, res.id)))
			.all();
		expect(own.every((e) => !e.active)).toBe(true);
	});

	it('restores an archived copy', async () => {
		const R = routine(T1_SALSA, 'Class routine');
		published('Week 5', (id) => linkRoutine(db, id, R, 'u1'));
		const first = (await mine('routine', R)) as { id: number };
		expect(archiveRoutine(db, first.id, NOW + 1)).toBe(true);
		expect(await makeMine(db, U2_SALSA, 'routine', R, NO_FILES, NOW + 2, ROOMY)).toMatchObject({
			ok: true,
			id: first.id
		});
		expect(
			db.select().from(routines).where(eq(routines.id, first.id)).get()!.archivedAt
		).toBeNull();
	});
});

describe('makeMine: a drill', () => {
	function practisedDrill() {
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const L = published('Week 6', (id) => linkExercise(db, id, D, 'u1'));
		expect(addLesson(db, 'u2', L, { ...NONE, drillIds: [D] }, T)).toBe(true);
		const entry = entryOn('drillId', D)!;
		db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();
		return { D, entry };
	}

	it('the copy takes the practice and its sets; the entry on the group’s goes', async () => {
		const { D, entry } = practisedDrill();
		const res = (await mine('drill', D)) as { id: number };
		const copy = exerciseRow(res.id);
		expect(copy).toMatchObject({
			userId: 'u2',
			source: 'custom',
			clonedFrom: D,
			archivedAt: null,
			active: true,
			everyDays: 3
		});
		expect(setsOf(res.id)).toHaveLength(1);
		expect(exerciseRow(entry.id).archivedAt).not.toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});

	it('restores an archived copy', async () => {
		const { D } = practisedDrill();
		const first = (await mine('drill', D)) as { id: number };
		archiveExercise(db, first.id, NOW + 1);
		expect(await makeMine(db, U2_SALSA, 'drill', D, NO_FILES, NOW + 2, ROOMY)).toMatchObject({
			ok: true,
			id: first.id
		});
		expect(exerciseRow(first.id).archivedAt).toBeNull();
	});
});

describe('makeMine: a song', () => {
	function sharedSong() {
		const S = createSongFromUpload(
			db,
			T1_SALSA,
			{
				file: '00000000-0000-4000-8000-0000000000c1.mp3',
				mime: 'audio/mpeg',
				title: 'Chan Chan',
				style: 'salsa',
				sizeBytes: 1000
			},
			T
		).id;
		storeAnalysis(db, S, { beats: [0.5, 1, 1.5, 2], downbeats: [0.5], durationS: 90 });
		expect(shareSong(db, T1_SALSA, S, T)).toBe(true);
		return S;
	}

	it('makes the person’s song with the count; their picks follow; charged to them', async () => {
		const S = sharedSong();
		const pick = createCustomExercise(db, U2_SALSA, {
			name: 'Basics',
			everyDays: 1,
			notes: null
		}).id;
		db.update(exercises).set({ songId: S }).where(eq(exercises.id, pick)).run();
		expect(makeMinePreview(db, U2_SALSA, 'song', S)).toMatchObject({
			title: 'Chan Chan',
			bytes: 1000,
			practised: true
		});
		const res = (await mine('song', S)) as { id: number };
		expect(db.select().from(songs).where(eq(songs.id, res.id)).get()).toMatchObject({
			userId: 'u2',
			teamId: null,
			audioFile: 'copy-00000000-0000-4000-8000-0000000000c1.mp3'
		});
		expect(exerciseRow(pick).songId).toBe(res.id);
	});

	it('a copy the person archived is refused with what to do: a person’s song has no restore', async () => {
		const S = sharedSong();
		const first = (await mine('song', S)) as { id: number };
		archiveSong(db, first.id, NOW + 1);
		expect(await mine('song', S)).toEqual({
			ok: false,
			reason: 'archived',
			message:
				'Your copy of this song is archived. Delete it in Settings → What uses space to make it yours again.'
		});
	});
});

describe('makeMine: a lesson', () => {
	function lessonWithVideo() {
		const F = figure(T1_SALSA, 'Setenta');
		const L = published('Week 7', (id) => {
			linkFigure(db, id, F, 'u1');
			addLessonVideo(
				db,
				{
					lessonId: id,
					file: '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4',
					mime: 'video/mp4',
					sizeBytes: 5
				},
				'u1'
			);
		});
		return { F, L };
	}

	it('copies it with its videos (charged) and figures; the person’s routine follows the figure', async () => {
		const { F, L } = lessonWithVideo();
		expect(addLesson(db, 'u2', L, { ...NONE, lesson: true }, T)).toBe(true);
		const P = routine(U2_SALSA, 'Week 4 loop');
		const step = slot(P, 1, [F]);
		expect(makeMinePreview(db, U2_SALSA, 'lesson', L)).toMatchObject({
			title: 'Week 7',
			bytes: 5,
			repoint: { routines: [{ id: P, name: 'Week 4 loop' }] }
		});
		const res = (await mine('lesson', L)) as { id: number };
		expect(db.select().from(lessons).where(eq(lessons.id, res.id)).get()).toMatchObject({
			userId: 'u2',
			clonedFrom: L
		});
		expect(
			db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, res.id)).all()
		).toHaveLength(1);
		const f = db
			.select()
			.from(figures)
			.where(and(eq(figures.clonedFrom, F), eq(figures.userId, 'u2')))
			.get()!;
		expect(optionsOf(step)).toEqual([f.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('at the person’s limit, refused for room, writing nothing', async () => {
		const { L } = lessonWithVideo();
		db.update(users).set({ storageLimitBytes: 4 }).where(eq(users.id, 'u2')).run();
		const before = {
			lessons: db.select().from(lessons).all().length,
			figures: db.select().from(figures).all().length,
			moves: db.select().from(figureGroups).all().length
		};
		const res = await mine('lesson', L);
		expect(res).toMatchObject({ ok: false, reason: 'room', room: { ok: false, limitBytes: 4 } });
		expect({
			lessons: db.select().from(lessons).all().length,
			figures: db.select().from(figures).all().length,
			moves: db.select().from(figureGroups).all().length
		}).toEqual(before);
	});

	it('restores an archived copy', async () => {
		const { L } = lessonWithVideo();
		const first = (await mine('lesson', L)) as { id: number };
		expect(archiveLesson(db, first.id, NOW + 1)).toBe(true);
		expect(await makeMine(db, U2_SALSA, 'lesson', L, NO_FILES, NOW + 2, ROOMY)).toMatchObject({
			ok: true,
			id: first.id
		});
		expect(db.select().from(lessons).where(eq(lessons.id, first.id)).get()!.archivedAt).toBeNull();
	});
});

/**
 * Add after Make it mine: a later lesson holding the group's row must not put
 * a second practice of the family on Today. The lesson page's card already
 * opens the person's copy; the Add sheet leaves the group's row out, and Add
 * ignores it even if it is posted.
 */
describe('Add after Make it mine', () => {
	const ALL = (routineIds: number[], drillIds: number[], figureIds: number[]) => ({
		lesson: true,
		routineIds,
		drillIds,
		figureIds
	});
	const live = (col: 'figureId' | 'routineId' | 'drillId', ids: number[]) =>
		db
			.select()
			.from(exercises)
			.where(
				and(eq(exercises.userId, 'u2'), inArray(exercises[col], ids), isNull(exercises.archivedAt))
			)
			.all();
	const offered = (lessonId: number) =>
		addOffer(db, 'u2', lessonId)!.items.map((i) => `${i.kind}:${i.id}`);

	// Catches: Week 2's Add sheet offering R ticked, and Add making a second practice on Today.
	it('a routine: Week 2 does not offer R, and Add leaves one practice, on R′', async () => {
		const R = routine(T1_SALSA, 'Class routine');
		slot(R, 1, [figure(T1_SALSA, 'Enchufla')]);
		const W1 = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', W1, { ...NONE, routineIds: [R] }, T)).toBe(true);
		const res = (await mine('routine', R)) as { ok: true; id: number };
		expect(res.ok).toBe(true);
		const W2 = published('Week 2', (id) => linkRoutine(db, id, R, 'u1'));

		expect(offered(W2)).not.toContain(`routine:${R}`);
		expect(offered(W2)).toContain(`lesson:${W2}`);
		expect(addLesson(db, 'u2', W2, ALL([R], [], []), NOW + 10)).toBe(true);
		const practice = live('routineId', [R, res.id]);
		expect(practice.map((e) => e.routineId)).toEqual([res.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	// Catches: "new in this lesson" nagging about a routine the person practises as their own.
	it('a routine linked into an added lesson later is not new', async () => {
		const R = routine(T1_SALSA, 'Class routine');
		const W1 = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', W1, { ...NONE, routineIds: [R] }, T)).toBe(true);
		await mine('routine', R);
		const W2 = published('Week 2');
		expect(addLesson(db, 'u2', W2, NONE, 10)).toBe(true);
		expect(linkRoutine(db, W2, R, 'u1')).toBe(true);
		expect(newInLesson(db, 'u2', W2)).toEqual([]);
	});

	it('a drill: Week 2 does not offer D, and Add brings back no entry on it', async () => {
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const W1 = published('Week 1', (id) => linkExercise(db, id, D, 'u1'));
		expect(addLesson(db, 'u2', W1, { ...NONE, drillIds: [D] }, T)).toBe(true);
		const res = (await mine('drill', D)) as { ok: true; id: number };
		const W2 = published('Week 2', (id) => linkExercise(db, id, D, 'u1'));

		expect(offered(W2)).not.toContain(`drill:${D}`);
		expect(addLesson(db, 'u2', W2, ALL([], [D], []), NOW + 10)).toBe(true);
		expect(live('drillId', [D])).toEqual([]);
		expect(exerciseRow(res.id).archivedAt).toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});

	it('a figure: Week 2 does not list F, and a posted F makes no entry on it', async () => {
		const F = figure(T1_SALSA, 'Setenta');
		const W1 = published('Week 1', (id) => linkFigure(db, id, F, 'u1'));
		expect(addLesson(db, 'u2', W1, { ...NONE, figureIds: [F] }, T)).toBe(true);
		const res = (await mine('figure', F)) as { ok: true; id: number };
		const W2 = published('Week 2', (id) => linkFigure(db, id, F, 'u1'));

		expect(offered(W2)).not.toContain(`figure:${F}`);
		expect(addLesson(db, 'u2', W2, ALL([], [], [F]), NOW + 10)).toBe(true);
		expect(live('figureId', [F, res.id]).map((e) => e.figureId)).toEqual([res.id]);
		expect(crossRefs(db)).toEqual([]);
	});

	// Catches: the same double after Keep everything, leaving, and coming back.
	it('after Keep and rejoining: a later lesson holding R adds no second practice', async () => {
		const R = routine(T1_SALSA, 'Class routine');
		const W1 = published('Week 1', (id) => linkRoutine(db, id, R, 'u1'));
		expect(addLesson(db, 'u2', W1, { ...NONE, routineIds: [R] }, T)).toBe(true);
		expect(await leaveTeam(db, 1, 'u2', { mode: 'all' }, NO_FILES, NOW)).toBe('left');
		expect(joinTeam(db, 'u2', 1, NOW + 1)).toBe('joined');
		const kept = db
			.select()
			.from(routines)
			.where(and(eq(routines.userId, 'u2'), eq(routines.clonedFrom, R)))
			.get()!;
		const W2 = published('Week 2', (id) => linkRoutine(db, id, R, 'u1'));

		expect(offered(W2)).not.toContain(`routine:${R}`);
		expect(addLesson(db, 'u2', W2, ALL([R], [], []), NOW + 10)).toBe(true);
		expect(live('routineId', [R, kept.id]).map((e) => e.routineId)).toEqual([kept.id]);
		expect(crossRefs(db)).toEqual([]);
	});
});
