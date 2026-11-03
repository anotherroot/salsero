/**
 * A deleted group, 30 days on: its files go, its rows stay archived so its
 * members' logs keep their names, and nobody's sets are touched. Files live in
 * a temp folder, never `$DATA_DIR`.
 */
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonAdds,
	lessons,
	lessonVideos,
	links,
	recordings,
	routines,
	sets,
	spotLinks,
	teamMembers,
	teamTrash,
	users,
	videoDownloads,
	videoSpots
} from './db/schema';
import { createTeam, deleteTeam, getTeam, joinTeam, restoreTeam } from './teams';
import {
	addLessonVideo,
	createLesson,
	deleteLessonVideo,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from './lessons';
import { addRecording, createFigure } from './figures';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import { addLinks } from './links';
import { requestVideoDownload } from './video-downloads';
import { addLesson, entryFor } from './entries';
import { lessonAccess } from './access';
import { purgeTeams } from './team-purge';
import { TEAM_PURGE_MS } from '$lib/limits';
import { T1_SALSA, U2_SALSA } from './test-walls';

const DAY = 24 * 60 * 60 * 1000;
const T = Date.UTC(2026, 10, 3, 20); // deleted on Tue 3 Nov, in the evening
const VIDEO = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const REC = '1b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const TRASHED = '2b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';

let db: Db;
let dir: string;
let dirs: { lessonVideos: string; recordings: string };
let w: ReturnType<typeof world>;

function world() {
	const lesson = createLesson(db, T1_SALSA, {
		lessonDay: '2026-11-03',
		title: 'Tue 3 Nov',
		notes: null
	}).lesson.id;
	const figure = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	const routine = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
	const drill = createCustomExercise(db, T1_SALSA, { name: 'Drill', everyDays: 3, notes: null }).id;
	linkFigure(db, lesson, figure, 'u1');
	linkRoutine(db, lesson, routine, 'u1');
	linkExercise(db, lesson, drill, 'u1');
	for (const f of [VIDEO, REC, TRASHED]) writeFileSync(join(dir, f), 'bytes');
	const video = addLessonVideo(
		db,
		{ lessonId: lesson, file: VIDEO, mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;
	const rec = addRecording(
		db,
		{ figureId: figure, file: REC, mime: 'video/mp4', kind: 'video', sizeBytes: 5, note: null },
		'u1'
	).id;
	const section = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 0, endMs: 1000, label: 'A' },
		'u1'
	)!.id;
	linkInSpace(db, T1_SALSA, section, { figureId: figure });
	addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 500, label: 'B' }, 'u1');
	const link = addLinks(
		db,
		{ lessonId: lesson },
		['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
		null,
		'u1'
	)![0].id;
	requestVideoDownload(db, { lessonId: lesson }, link, 'u1');
	const gone = addLessonVideo(
		db,
		{ lessonId: lesson, file: TRASHED, mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;
	expect(deleteLessonVideo(db, gone, 'u1', T - DAY)!.trashId).not.toBeNull();
	publishLesson(db, T1_SALSA, lesson, 2);
	addLesson(
		db,
		'u2',
		lesson,
		{ lesson: true, routineIds: [routine], drillIds: [drill], figureIds: [figure] },
		3
	);
	const entries = {
		lesson: entryFor(db, 'u2', { lessonId: lesson })!.id,
		routine: entryFor(db, 'u2', { routineId: routine })!.id,
		figure: entryFor(db, 'u2', { figureId: figure })!.id,
		drill: entryFor(db, 'u2', { drillId: drill })!.id
	};
	// u2's own drill, and a set on it and on the lesson's entry.
	const own = createCustomExercise(db, U2_SALSA, { name: 'Mine', everyDays: 2, notes: null }).id;
	db.insert(sets)
		.values({ exerciseId: entries.lesson, doneAt: T - 2 * DAY })
		.run();
	db.insert(sets)
		.values({ exerciseId: own, doneAt: T - 2 * DAY })
		.run();
	return { lesson, figure, routine, drill, video, rec, entries, own };
}

const archivedAt = (id: number) =>
	db.select({ a: exercises.archivedAt }).from(exercises).where(eq(exercises.id, id)).get()!.a;

beforeEach(() => {
	db = openDb(':memory:');
	dir = mkdtempSync(join(tmpdir(), 'salsa-team-purge-'));
	dirs = { lessonVideos: dir, recordings: dir };
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	w = world();
});

afterEach(() => {
	vi.restoreAllMocks();
	rmSync(dir, { recursive: true, force: true });
});

describe('purgeTeams', () => {
	it('leaves a group alone until 30 days have passed, and a live one always', async () => {
		expect(await purgeTeams(db, T + 40 * DAY, dirs)).toBe(0);
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + TEAM_PURGE_MS - 1, dirs)).toBe(0);
		expect(getTeam(db, 1)!.purgedAt).toBeNull();
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
		expect(existsSync(join(dir, VIDEO))).toBe(true);
	});

	it('at +31 days removes the files and the media rows, keeps the rows archived and the sets', async () => {
		// u2 had taken the routine off Today themselves, before: that time stays.
		db.update(exercises).set({ archivedAt: 7 }).where(eq(exercises.id, w.entries.routine)).run();
		deleteTeam(db, 1, 'u1', T);
		const now = T + 31 * DAY;
		expect(await purgeTeams(db, now, dirs)).toBe(1);

		// The files: the lesson video, the recording, and the trash's.
		for (const f of [VIDEO, REC, TRASHED]) expect(existsSync(join(dir, f))).toBe(false);
		for (const t of [lessonVideos, recordings, videoSpots, spotLinks, links, videoDownloads]) {
			expect(db.select().from(t).all()).toEqual([]);
		}
		expect(db.select().from(teamTrash).get()!.purgedAt).toBe(now);

		// The rows stay, archived with one `now`.
		expect(db.select().from(lessons).get()).toMatchObject({ title: 'Tue 3 Nov', archivedAt: now });
		expect(db.select().from(figures).get()!.archivedAt).toBe(now);
		expect(db.select().from(figureGroups).get()!.archivedAt).toBe(now);
		expect(db.select().from(routines).get()!.archivedAt).toBe(now);
		expect(archivedAt(w.drill)).toBe(now);

		// u2's entries go off Today; one already off keeps its own time.
		expect(archivedAt(w.entries.lesson)).toBe(now);
		expect(archivedAt(w.entries.figure)).toBe(now);
		expect(archivedAt(w.entries.drill)).toBe(now);
		expect(archivedAt(w.entries.routine)).toBe(7);
		// Their own things and every set are untouched.
		expect(archivedAt(w.own)).toBeNull();
		expect(db.select().from(sets).all()).toHaveLength(2);

		// The group is gone: no members, no added lessons, nothing to read.
		expect(getTeam(db, 1)!.purgedAt).toBe(now);
		expect(db.select().from(teamMembers).all()).toEqual([]);
		expect(db.select().from(lessonAdds).all()).toEqual([]);
		const lesson = db.select().from(lessons).get()!;
		expect(lessonAccess(db, 'u2', lesson)).toBeNull();
		expect(lessonAccess(db, 'u1', lesson)).toBeNull();
	});

	it('runs twice without changing anything the second time', async () => {
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		expect(await purgeTeams(db, T + 32 * DAY, dirs)).toBe(0);
		expect(getTeam(db, 1)!.purgedAt).toBe(T + 31 * DAY);
		expect(archivedAt(w.entries.lesson)).toBe(T + 31 * DAY);
	});

	it('goes on past a file that is already gone, quietly', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		unlinkSync(join(dir, VIDEO));
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		expect(existsSync(join(dir, REC))).toBe(false);
		expect(warn).not.toHaveBeenCalled();
	});

	it('deletes an earlier group’s files when a later group’s purge throws, and goes on', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		createTeam(db, 'u1', 'salsa', 'Other', 1);
		deleteTeam(db, 1, 'u1', T);
		deleteTeam(db, 2, 'u1', T);
		const real = db.transaction.bind(db);
		let calls = 0;
		vi.spyOn(db, 'transaction').mockImplementation(((fn: Parameters<Db['transaction']>[0]) => {
			if (++calls === 2) throw new Error('disk I/O error');
			return real(fn);
		}) as Db['transaction']);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		expect(getTeam(db, 1)!.purgedAt).toBe(T + 31 * DAY);
		for (const f of [VIDEO, REC, TRASHED]) expect(existsSync(join(dir, f))).toBe(false);
		expect(getTeam(db, 2)!.purgedAt).toBeNull();
		expect(warn).toHaveBeenCalledWith('[team-purge] could not purge group 2', expect.any(Error));
	});

	it('leaves a group restored after it was listed, before its claim', async () => {
		deleteTeam(db, 1, 'u1', T);
		const real = db.transaction.bind(db);
		vi.spyOn(db, 'transaction').mockImplementation(((fn: Parameters<Db['transaction']>[0]) => {
			expect(restoreTeam(db, 1, 'u1', T + 30 * DAY)).toBe('restored');
			return real(fn);
		}) as Db['transaction']);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(0);
		expect(getTeam(db, 1)!.purgedAt).toBeNull();
		expect(existsSync(join(dir, VIDEO))).toBe(true);
	});

	it('leaves another group’s rows and files alone', async () => {
		createTeam(db, 'u1', 'salsa', 'Other', 1);
		const other = createLesson(
			db,
			{ ...T1_SALSA, teamId: 2 },
			{ lessonDay: '2026-11-01', title: 'O', notes: null }
		).lesson.id;
		const file = '3b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
		writeFileSync(join(dir, file), 'bytes');
		addLessonVideo(db, { lessonId: other, file, mime: 'video/mp4', sizeBytes: 5 }, 'u1');
		deleteTeam(db, 1, 'u1', T);
		await purgeTeams(db, T + 31 * DAY, dirs);
		expect(existsSync(join(dir, file))).toBe(true);
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
		expect(db.select().from(lessons).where(eq(lessons.id, other)).get()!.archivedAt).toBeNull();
		expect(db.select().from(teamMembers).where(eq(teamMembers.teamId, 2)).all()).toHaveLength(1);
	});
});

describe('restoreTeam before the purge', () => {
	it('brings everything back and leaves the entries as they were', async () => {
		db.update(exercises).set({ archivedAt: 7 }).where(eq(exercises.id, w.entries.routine)).run();
		deleteTeam(db, 1, 'u1', T);
		expect(restoreTeam(db, 1, 'u1', T + 10 * DAY)).toBe('restored');
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(0);

		for (const f of [VIDEO, REC]) expect(existsSync(join(dir, f))).toBe(true);
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
		expect(db.select().from(lessons).get()!.archivedAt).toBeNull();
		expect(archivedAt(w.entries.lesson)).toBeNull();
		expect(archivedAt(w.entries.drill)).toBeNull();
		expect(archivedAt(w.entries.routine)).toBe(7);
		expect(db.select().from(teamMembers).all()).toHaveLength(2);
		expect(lessonAccess(db, 'u2', db.select().from(lessons).get()!)).toBe('read');
	});
});
