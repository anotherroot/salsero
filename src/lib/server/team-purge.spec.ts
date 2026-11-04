/**
 * A deleted group, 30 days on: its files go, its rows stay archived so its
 * members' logs keep their names, and nobody's sets are touched. Files live in
 * a temp folder, never `$DATA_DIR`.
 */
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figureEndPositions,
	figureGroups,
	figureStartPositions,
	figures,
	lessonAdds,
	lessonPositions,
	lessons,
	lessonVideos,
	links,
	positions,
	recordings,
	routineStepOptions,
	routineSteps,
	routines,
	sets,
	songDrops,
	songs,
	spotLinks,
	spotPositionLinks,
	teamMembers,
	teams,
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
import { createSongFromUpload } from './songs';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import { addLinks } from './links';
import { requestVideoDownload } from './video-downloads';
import { addLesson, entryFor } from './entries';
import { lessonAccess } from './access';
import { purgeTeams } from './team-purge';
import { TEAM_PURGE_MS } from '$lib/limits';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Wall } from './scope';
import { crossRefs } from './integrity';

const DAY = 24 * 60 * 60 * 1000;
const T = Date.UTC(2026, 10, 3, 20); // deleted on Tue 3 Nov, in the evening
const VIDEO = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const REC = '1b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const TRASHED = '2b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';

let db: Db;
let dir: string;
let dirs: { lessonVideos: string; recordings: string; audio: string };
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
	dirs = { lessonVideos: dir, recordings: dir, audio: dir };
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

/** A person's own rows: what Keep gave them. */
const own = (userId: string) => {
	const mine = <T extends typeof lessons | typeof figures | typeof routines>(t: T) =>
		db
			.select()
			.from(t)
			.where(and(eq(t.userId, userId), isNull(t.teamId)))
			.all();
	return { lessons: mine(lessons), figures: mine(figures), routines: mine(routines) };
};
/** The person's own routine 'Mine' with one slot of this figure; the slot's step id. */
function routineUsing(wall: Wall, figureId: number): number {
	const routineId = createRoutine(db, wall, { name: 'Mine', notes: null }).routine.id;
	const step = db.insert(routineSteps).values({ routineId, position: 0 }).returning().get().id;
	db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
	return step;
}
const optionOf = (stepId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.get()!.f;
/** An entry by hand on a group routine. */
const practise = (userId: string, routineId: number) =>
	db
		.insert(exercises)
		.values({ name: 'Show', source: 'routine', routineId, dance: 'salsa', userId })
		.returning()
		.get().id;

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
		// The group's media rows, by id: u2's kept copies have rows of their own.
		const media = [lessonVideos, recordings, videoSpots, spotLinks, links, videoDownloads].map(
			(t) => [t, db.select({ id: t.id }).from(t).all()] as const
		);
		deleteTeam(db, 1, 'u1', T);
		const now = T + 31 * DAY;
		expect(await purgeTeams(db, now, dirs)).toBe(1);

		// The files: the lesson video, the recording, and the trash's.
		for (const f of [VIDEO, REC, TRASHED]) expect(existsSync(join(dir, f))).toBe(false);
		for (const [t, rows] of media) {
			expect(rows.length).toBeGreaterThan(0);
			expect(
				db
					.select({ id: t.id })
					.from(t)
					.where(
						inArray(
							t.id,
							rows.map((r) => r.id)
						)
					)
					.all()
			).toEqual([]);
		}
		expect(db.select().from(teamTrash).get()!.purgedAt).toBe(now);

		// The rows stay, archived with one `now`.
		const groups = (t: typeof lessons | typeof figures | typeof figureGroups | typeof routines) =>
			db.select().from(t).where(eq(t.teamId, 1)).all();
		expect(groups(lessons)).toMatchObject([{ title: 'Tue 3 Nov', archivedAt: now }]);
		expect(groups(figures).map((r) => r.archivedAt)).toEqual([now]);
		expect(groups(figureGroups).map((r) => r.archivedAt)).toEqual([now]);
		expect(groups(routines).map((r) => r.archivedAt)).toEqual([now]);
		expect(archivedAt(w.drill)).toBe(now);

		// u2 practises nothing of the group's any more: their practice is on
		// their kept copies. One already off keeps its own time.
		const onGroup = db
			.select()
			.from(exercises)
			.where(
				and(
					eq(exercises.userId, 'u2'),
					isNull(exercises.archivedAt),
					or(
						eq(exercises.lessonId, w.lesson),
						eq(exercises.figureId, w.figure),
						eq(exercises.routineId, w.routine),
						eq(exercises.drillId, w.drill)
					)
				)
			)
			.all();
		expect(onGroup).toEqual([]);
		const [copy] = db
			.select()
			.from(lessons)
			.where(and(eq(lessons.userId, 'u2'), isNull(lessons.teamId)))
			.all();
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.lessonId, copy.id), isNull(exercises.archivedAt)))
				.all()
		).toHaveLength(1);
		expect(archivedAt(w.entries.routine)).toBe(7);
		// Their own things and every set are untouched.
		expect(archivedAt(w.own)).toBeNull();
		expect(db.select().from(sets).all()).toHaveLength(2);

		// The group is gone: no members, no added lessons, nothing to read.
		expect(getTeam(db, 1)!.purgedAt).toBe(now);
		expect(db.select().from(teamMembers).all()).toEqual([]);
		expect(db.select().from(lessonAdds).all()).toEqual([]);
		const lesson = db.select().from(lessons).where(eq(lessons.id, w.lesson)).get()!;
		expect(lessonAccess(db, 'u2', lesson)).toBeNull();
		expect(lessonAccess(db, 'u1', lesson)).toBeNull();
	});

	it('every member keeps everything first, the deleter only what their rows use: the copies’ files stay', async () => {
		// The owner, who deletes the group: their routine uses the group's
		// figure, and they practise the group's routine.
		const step = routineUsing(U1_SALSA, w.figure);
		const ownersEntry = practise('u1', w.routine);
		deleteTeam(db, 1, 'u1', T);
		const now = T + 31 * DAY;
		expect(await purgeTeams(db, now, dirs)).toBe(1);

		// The group's own names are gone.
		for (const f of [VIDEO, REC, TRASHED]) expect(existsSync(join(dir, f))).toBe(false);

		// u2 keeps everything: the lesson with its video, the figure with its recording.
		const u2 = own('u2');
		expect(u2.lessons.map((l) => l.title)).toEqual(['Tue 3 Nov']);
		expect(u2.lessons[0].archivedAt).toBeNull();
		const video = db
			.select()
			.from(lessonVideos)
			.where(eq(lessonVideos.lessonId, u2.lessons[0].id))
			.get()!;
		const rec = db
			.select()
			.from(recordings)
			.where(eq(recordings.figureId, u2.figures[0].id))
			.get()!;
		for (const f of [video.file, rec.file]) {
			expect([VIDEO, REC]).not.toContain(f);
			expect(existsSync(join(dir, f))).toBe(true);
		}
		// Their practice is on the copy, live.
		const practice = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.lessonId, u2.lessons[0].id), isNull(exercises.archivedAt)))
			.all();
		expect(practice).toHaveLength(1);
		expect(practice[0].userId).toBe('u2');

		// The deleter keeps only what their routine uses, with its own recording
		// file: not the routine they only practised, whose entry goes.
		const u1 = own('u1');
		expect(u1.figures).toHaveLength(1);
		expect(u1.routines.map((r) => r.name)).toEqual(['Mine']);
		const ownersRec = db
			.select()
			.from(recordings)
			.where(eq(recordings.figureId, u1.figures[0].id))
			.get()!;
		expect(ownersRec.file).not.toBe(rec.file);
		expect(existsSync(join(dir, ownersRec.file))).toBe(true);
		expect(optionOf(step)).toBe(u1.figures[0].id);
		expect(archivedAt(ownersEntry)).toBe(now);
		expect(crossRefs(db)).toEqual([]);
	});

	it('when the owner is not the deleter, the owner keeps everything and the deleter what they use', async () => {
		const step = routineUsing(U2_SALSA, w.figure);
		practise('u1', w.routine);
		deleteTeam(db, 1, 'u1', T);
		// deleteTeam lets only the owner delete; here the delete is u2's.
		db.update(teams).set({ deletedBy: 'u2' }).where(eq(teams.id, 1)).run();
		const now = T + 31 * DAY;
		expect(await purgeTeams(db, now, dirs)).toBe(1);

		// u2, the deleter: only the figure their routine uses, not the lesson they added.
		const u2 = own('u2');
		expect(u2.figures).toHaveLength(1);
		expect(u2.lessons).toEqual([]);
		expect(optionOf(step)).toBe(u2.figures[0].id);
		expect(archivedAt(w.entries.lesson)).toBe(now);
		// u1, the owner: everything they had, the routine they practise.
		const u1 = own('u1');
		expect(u1.routines.map((r) => r.name)).toEqual(['Show']);
		expect(
			db
				.select()
				.from(exercises)
				.where(
					and(
						eq(exercises.userId, 'u1'),
						eq(exercises.routineId, u1.routines[0].id),
						isNull(exercises.archivedAt)
					)
				)
				.all()
		).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('someone who left before Keep, with an added lesson, keeps everything too', async () => {
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, 'u2')))
			.run();
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		const u2 = own('u2');
		expect(u2.lessons.map((l) => l.title)).toEqual(['Tue 3 Nov']);
		const video = db
			.select()
			.from(lessonVideos)
			.where(eq(lessonVideos.lessonId, u2.lessons[0].id))
			.get()!;
		expect(existsSync(join(dir, video.file))).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});

	it('runs twice without changing anything the second time', async () => {
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		const tables = [exercises, lessons, figures, routines, recordings, lessonVideos, lessonAdds];
		const before = tables.map((t) => db.select().from(t).all());
		expect(await purgeTeams(db, T + 32 * DAY, dirs)).toBe(0);
		expect(getTeam(db, 1)!.purgedAt).toBe(T + 31 * DAY);
		expect(tables.map((t) => db.select().from(t).all())).toEqual(before);
	});

	it('goes on past a file that is already gone: Keep skips it, logged, and nothing else complains', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		unlinkSync(join(dir, VIDEO));
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		expect(existsSync(join(dir, REC))).toBe(false);
		expect(warn.mock.calls).toEqual([
			[`[clones] keep: lesson-video ${VIDEO} missing on disk, skipped`]
		]);
		// u2 still keeps the lesson, without the video whose file was gone.
		const u2 = own('u2');
		expect(u2.lessons).toHaveLength(1);
		expect(
			db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, u2.lessons[0].id)).all()
		).toEqual([]);
		const rec = db
			.select()
			.from(recordings)
			.where(eq(recordings.figureId, u2.figures[0].id))
			.get()!;
		expect(existsSync(join(dir, rec.file))).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a class song whose audio is already gone is not kept: its picks drop to the count', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const AUDIO = '6b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp3'; // never written
		const song = createSongFromUpload(db, T1_SALSA, {
			file: AUDIO,
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'salsa',
			sizeBytes: 5
		}).id;
		db.update(songs).set({ status: 'ready', sharedAt: T }).where(eq(songs.id, song)).run();
		db.update(exercises).set({ songId: song }).where(eq(exercises.id, w.entries.drill)).run();
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);

		expect(warn).toHaveBeenCalledWith(`[clones] keep: audio ${AUDIO} missing on disk, skipped`);
		expect(db.select().from(songs).all()).toEqual([]);
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), isNotNull(exercises.songId)))
				.all()
		).toEqual([]);
		// The rest is kept as ever.
		expect(own('u2').lessons).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('deletes an earlier group’s files when a later group’s Keep throws, and goes on', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		createTeam(db, 'u1', 'salsa', 'Other', 1);
		deleteTeam(db, 1, 'u1', T);
		deleteTeam(db, 2, 'u1', T);
		const real = db.transaction.bind(db);
		// Every write fails once the first group is purged: the second group's Keep.
		vi.spyOn(db, 'transaction').mockImplementation(((fn: Parameters<Db['transaction']>[0]) => {
			if (getTeam(db, 1)!.purgedAt !== null) throw new Error('disk I/O error');
			return real(fn);
		}) as Db['transaction']);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);
		expect(getTeam(db, 1)!.purgedAt).toBe(T + 31 * DAY);
		for (const f of [VIDEO, REC, TRASHED]) expect(existsSync(join(dir, f))).toBe(false);
		expect(getTeam(db, 2)!.purgedAt).toBeNull();
		expect(error).toHaveBeenCalledWith(
			'[team-purge] Keep failed for u1 in group 2; group kept for the next run',
			expect.any(Error)
		);
	});

	it('a member’s Keep that fails is an error, and leaves the group, files and all, for the next run', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		deleteTeam(db, 1, 'u1', T);
		const real = db.transaction.bind(db);
		let calls = 0;
		// u1's Keep is the first write, u2's the second.
		vi.spyOn(db, 'transaction').mockImplementation(((fn: Parameters<Db['transaction']>[0]) => {
			if (++calls === 2) throw new Error('disk I/O error');
			return real(fn);
		}) as Db['transaction']);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(0);
		expect(getTeam(db, 1)!.purgedAt).toBeNull();
		for (const f of [VIDEO, REC]) expect(existsSync(join(dir, f))).toBe(true);
		expect(error).toHaveBeenCalledWith(
			'[team-purge] Keep failed for u2 in group 1; group kept for the next run',
			expect.any(Error)
		);
		vi.restoreAllMocks();
		expect(await purgeTeams(db, T + 32 * DAY, dirs)).toBe(1);
		expect(own('u2').lessons).toHaveLength(1);
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

	it('deletes the group’s songs and their audio, and takes them off the entries that used them', async () => {
		const AUDIO = '4b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp3';
		const MINE = '5b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp3';
		for (const f of [AUDIO, MINE]) writeFileSync(join(dir, f), 'bytes');
		const upload = (file: string) => ({
			file,
			mime: 'audio/mpeg',
			title: 'S',
			style: 'salsa',
			sizeBytes: 5
		});
		const song = createSongFromUpload(db, T1_SALSA, upload(AUDIO)).id;
		const mine = createSongFromUpload(db, U2_SALSA, upload(MINE)).id;
		db.update(exercises).set({ songId: song }).where(eq(exercises.id, w.entries.drill)).run();
		db.update(exercises).set({ songId: mine }).where(eq(exercises.id, w.own)).run();
		db.insert(songDrops).values({ exerciseId: w.entries.lesson, songId: song, droppedAt: 1 }).run();
		deleteTeam(db, 1, 'u1', T);
		expect(await purgeTeams(db, T + 31 * DAY, dirs)).toBe(1);

		expect(db.select({ id: songs.id }).from(songs).all()).toEqual([{ id: mine }]);
		const songOf = (id: number) =>
			db.select({ s: exercises.songId }).from(exercises).where(eq(exercises.id, id)).get()!.s;
		expect(songOf(w.entries.drill)).toBeNull();
		expect(songOf(w.own)).toBe(mine);
		expect(db.select().from(songDrops).all()).toEqual([]);
		expect(existsSync(join(dir, AUDIO))).toBe(false);
		expect(existsSync(join(dir, MINE))).toBe(true);
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
		expect(
			db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, other)).all()
		).toHaveLength(1);
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

describe('purgeTeams with positions', () => {
	it('unlinks its spots and archives its positions; tags and hand links stay, as a figure’s do', async () => {
		const pos = (name: string, picture: number | null = null) =>
			db
				.insert(positions)
				.values({ teamId: 1, dance: 'salsa', slug: `p-${name}`, name, pictureSpotId: picture })
				.returning()
				.get().id;
		const point = db
			.insert(videoSpots)
			.values({ lessonVideoId: w.video, startMs: 5, endMs: null })
			.returning()
			.get().id;
		const recPoint = db
			.insert(videoSpots)
			.values({ recordingId: w.rec, startMs: 5, endMs: null })
			.returning()
			.get().id;
		const cerrada = pos('Cerrada', point);
		const abierta = pos('Abierta');
		db.insert(figureStartPositions).values({ figureId: w.figure, positionId: abierta }).run();
		db.insert(figureEndPositions).values({ figureId: w.figure, positionId: cerrada }).run();
		db.insert(lessonPositions).values({ lessonId: w.lesson, positionId: cerrada }).run();
		db.insert(spotPositionLinks)
			.values([
				{ spotId: point, positionId: cerrada },
				{ spotId: recPoint, positionId: abierta }
			])
			.run();
		deleteTeam(db, 1, 'u1', T);
		const now = T + 31 * DAY;
		expect(await purgeTeams(db, now, dirs)).toBe(1);
		expect(db.select().from(spotPositionLinks).all()).toEqual([]);
		expect(
			db
				.select({ id: videoSpots.id })
				.from(videoSpots)
				.where(inArray(videoSpots.id, [point, recPoint]))
				.all()
		).toEqual([]);
		const group = db.select().from(positions).where(eq(positions.teamId, 1)).all();
		expect(group.map((p) => [p.name, p.archivedAt, p.pictureSpotId])).toEqual([
			['Cerrada', now, null],
			['Abierta', now, null]
		]);
		expect(
			db.select().from(lessonPositions).where(eq(lessonPositions.lessonId, w.lesson)).all()
		).toHaveLength(1);
		expect(
			db
				.select()
				.from(figureStartPositions)
				.where(eq(figureStartPositions.figureId, w.figure))
				.all()
		).toHaveLength(1);
		for (const f of [VIDEO, REC]) expect(existsSync(join(dir, f))).toBe(false);
	});
});
