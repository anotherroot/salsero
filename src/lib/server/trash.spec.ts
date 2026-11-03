/**
 * Recently deleted: a group's hard deletes keep their rows and file for 30
 * days and come back with their own ids; its archived things come back with
 * exactly the members' entries that went with them (risk 6); the purge.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, lessonVideos, recordings, teamTrash, users, videoSpots } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	deleteLessonVideo,
	getLessonRow,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson,
	restoreLesson,
	unlinkFigure
} from './lessons';
import { addSpot, deleteSpot } from './spots';
import { linkInSpace, unlinkSpot } from './spot-links';
import { addLinks, deleteLink, listLinks } from './links';
import {
	addRecording,
	archiveVariation,
	createFigure,
	createVariationIn,
	deleteRecording,
	restoreVariation
} from './figures';
import {
	addFigureSlot,
	archiveRoutine,
	createRoutine,
	deleteSlots,
	removeOption,
	addOption,
	restoreOption,
	restoreRoutine,
	restoreSlots
} from './routines';
import { archiveExercise, createCustomExercise, restoreDrill } from './exercises';
import { addLesson, entryFor, removeLesson } from './entries';
import { history } from './changes';
import { usedBytesOf } from './storage';
import {
	listTrash,
	purgeTrash,
	restoreDeleted,
	restoreTrash,
	trashedSpot,
	trashSpace
} from './trash';
import { T1_SALSA, U1_SALSA } from './test-walls';
import type { Space } from './scope';
import { TRASH_MS } from '$lib/limits';

const DAY = 24 * 60 * 60 * 1000;
const MB = 1024 ** 2;
const FILE = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const REC = '1c9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
/** Later than anything the fixtures stamp with `Date.now()`. */
const T = Date.now() + DAY;

let db: Db;
let scratch: string;

beforeEach(() => {
	db = openDb(':memory:');
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok || made.teamId !== 1) throw new Error('setup');
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	joinTeam(db, 'u3', 1, 3);
	scratch = mkdtempSync(join(tmpdir(), 'salsa-trash-'));
});

afterEach(() => rmSync(scratch, { recursive: true, force: true }));

const lesson = (space: Space = T1_SALSA, title = 'Class 3') =>
	createLesson(db, space, { lessonDay: '2026-11-01', title, notes: null }).lesson.id;
const video = (lessonId: number, file = FILE, by = 'u1') =>
	addLessonVideo(db, { lessonId, file, mime: 'video/mp4', sizeBytes: 50 * MB }, by).id;
const section = (videoId: number, label: string, startMs = 0) =>
	addSpot(db, { lessonVideoId: videoId }, { startMs, endMs: startMs + 4000, label }, 'u1')!.id;
const trashRow = (id: number) => db.select().from(teamTrash).where(eq(teamTrash.id, id)).get()!;
const variation = (space: Space = T1_SALSA, figureName = 'Enchufla', name = 'Basic') =>
	createFigure(db, space, { figureName, name, partner: 'partner', style: 'salsa', notes: null })!;

describe('a group video', () => {
	it('is gone from lesson_videos, kept in the trash with its sections, and comes back with the same ids', () => {
		const L = lesson();
		const V = video(L);
		const a = section(V, 'Enchufla doble');
		const b = section(V, 'Vacilala', 5000);
		const gone = deleteLessonVideo(db, V, 'u2', T)!;
		expect(gone.trashId).not.toBeNull();
		expect(db.select().from(lessonVideos).all()).toEqual([]);
		expect(db.select().from(videoSpots).all()).toEqual([]);
		const row = trashRow(gone.trashId!);
		expect(row).toMatchObject({ kind: 'video', label: 'Class 3', sizeBytes: 50 * MB });
		expect(JSON.parse(row.filesJson)).toEqual([{ dir: 'lessonVideos', file: FILE }]);
		expect(JSON.parse(row.rowsJson).video_spots.map((s: { id: number }) => s.id)).toEqual([a, b]);

		// The removal's History row points at the trash entry.
		const removed = history(db, 1, 'lesson', L).find((r) => r.verb === 'remove')!;
		expect(removed.trashId).toBe(gone.trashId);

		const space = { ...T1_SALSA, actorId: 'u2' };
		expect(restoreTrash(db, space, gone.trashId!, T + 1)).toEqual({ ok: true });
		expect(db.select({ id: lessonVideos.id }).from(lessonVideos).all()).toEqual([{ id: V }]);
		expect(
			db.select({ id: videoSpots.id, label: videoSpots.label }).from(videoSpots).all()
		).toEqual([
			{ id: a, label: 'Enchufla doble' },
			{ id: b, label: 'Vacilala' }
		]);
		expect(trashRow(gone.trashId!).restoredAt).toBe(T + 1);
		// Logged as a restore, by who restored it, linking the entry.
		expect(history(db, 1, 'lesson', L)[0]).toMatchObject({
			verb: 'restore',
			subject: 'video',
			subjectId: V,
			actorId: 'u2',
			trashId: gone.trashId
		});
		// Twice is refused.
		expect(restoreTrash(db, space, gone.trashId!, T + 2)).toEqual({
			ok: false,
			reason: 'restored'
		});
	});

	it('a person’s own delete keeps nothing', () => {
		const L = lesson(U1_SALSA);
		const gone = deleteLessonVideo(db, video(L), 'u1')!;
		expect(gone.trashId).toBeNull();
		expect(db.select().from(teamTrash).all()).toEqual([]);
	});

	it('counts against the group until it is purged', () => {
		const L = lesson();
		const gone = deleteLessonVideo(db, video(L), 'u1', T)!;
		expect(usedBytesOf(db, { teamId: 1 })).toBe(50 * MB);
		return purgeTrash(db, T + TRASH_MS, { lessonVideos: scratch, recordings: scratch }).then(
			(n) => {
				expect(n).toBe(1);
				expect(usedBytesOf(db, { teamId: 1 })).toBe(0);
				expect(trashRow(gone.trashId!).purgedAt).toBe(T + TRASH_MS);
			}
		);
	});
});

describe('purgeTrash', () => {
	it('at +31 days deletes the file; Restore is then refused as purged', async () => {
		const dirs = { lessonVideos: join(scratch, 'v'), recordings: join(scratch, 'r') };
		mkdirSync(dirs.lessonVideos);
		mkdirSync(dirs.recordings);
		writeFileSync(join(dirs.lessonVideos, FILE), 'video');
		writeFileSync(join(dirs.lessonVideos, 'other.mp4'), 'kept');
		const L = lesson();
		const gone = deleteLessonVideo(db, video(L), 'u1', T)!;

		// Not yet: a day short of 30 keeps it.
		expect(await purgeTrash(db, T + 29 * DAY, dirs)).toBe(0);
		expect(existsSync(join(dirs.lessonVideos, FILE))).toBe(true);

		expect(await purgeTrash(db, T + 31 * DAY, dirs)).toBe(1);
		expect(existsSync(join(dirs.lessonVideos, FILE))).toBe(false);
		expect(existsSync(join(dirs.lessonVideos, 'other.mp4'))).toBe(true);
		expect(restoreTrash(db, T1_SALSA, gone.trashId!, T + 32 * DAY)).toEqual({
			ok: false,
			reason: 'purged'
		});
		// Once only.
		expect(await purgeTrash(db, T + 40 * DAY, dirs)).toBe(0);
	});

	it('leaves a restored entry’s file alone', async () => {
		writeFileSync(join(scratch, FILE), 'video');
		const gone = deleteLessonVideo(db, video(lesson()), 'u1', T)!;
		restoreTrash(db, T1_SALSA, gone.trashId!, T + DAY);
		expect(await purgeTrash(db, T + 40 * DAY, { lessonVideos: scratch, recordings: scratch })).toBe(
			0
		);
		expect(existsSync(join(scratch, FILE))).toBe(true);
	});
});

describe('a group section', () => {
	it('whose video is in the trash is refused with parent-gone, and comes back after the video', () => {
		const L = lesson();
		const V = video(L);
		const S = section(V, 'Enchufla doble');
		const keep = section(V, 'Vacilala', 5000);
		const sectionGone = deleteSpot(db, S, 'u1', T)!;
		const videoGone = deleteLessonVideo(db, V, 'u1', T + 1)!;
		expect(restoreTrash(db, T1_SALSA, sectionGone.trashId!, T + 2)).toEqual({
			ok: false,
			reason: 'parent-gone'
		});
		expect(restoreDeleted(db, T1_SALSA, 'section', sectionGone.trashId!, T + 2)).toEqual({
			ok: false,
			message: 'Restore the video first'
		});
		// Nothing half-done: the refusal wrote nothing.
		expect(trashRow(sectionGone.trashId!).restoredAt).toBeNull();

		expect(restoreTrash(db, T1_SALSA, videoGone.trashId!, T + 3)).toEqual({ ok: true });
		expect(restoreTrash(db, T1_SALSA, sectionGone.trashId!, T + 4)).toEqual({ ok: true });
		expect(
			db
				.select({ id: videoSpots.id })
				.from(videoSpots)
				.all()
				.map((r) => r.id)
				.sort()
		).toEqual([S, keep].sort());
	});

	it('a save after the delete is told who deleted it; a member and an outsider are not', () => {
		const S = section(video(lesson()), 'Enchufla doble');
		deleteSpot(db, S, 'u2', T);
		expect(trashedSpot(db, 'u1', S)).toEqual({ by: 'Luka', at: T });
		expect(trashedSpot(db, 'u3', S)).toBeNull();
		expect(trashedSpot(db, 'u9', S)).toBeNull();
	});

	it('Undo from the player goes through the entry the delete returned (risk 18)', () => {
		const S = section(video(lesson()), 'Enchufla doble');
		const { trashId } = deleteSpot(db, S, 'u1', T)!;
		const found = trashSpace(db, 'u2', trashId!)!;
		expect(found.kind).toBe('section');
		expect(restoreTrash(db, found.space, trashId!, T + 1)).toEqual({ ok: true });
		expect(db.select({ id: videoSpots.id }).from(videoSpots).all()).toEqual([{ id: S }]);
		// A member may not.
		expect(trashSpace(db, 'u3', trashId!)).toBeNull();
	});
});

describe('a group section link', () => {
	it('made again since gives exists', () => {
		const L = lesson();
		const S = section(video(L), 'Enchufla doble');
		const F = variation().figure.id;
		const link = linkInSpace(db, T1_SALSA, S, { figureId: F });
		expect(unlinkSpot(db, link, { figureId: F }, T, 'u1')).toBe(true);
		const [trash] = db.select().from(teamTrash).all();
		expect(trash.kind).toBe('spot-link');
		linkInSpace(db, T1_SALSA, S, { figureId: F });
		expect(restoreTrash(db, T1_SALSA, trash.id, T + 1)).toEqual({
			ok: false,
			reason: 'exists'
		});
	});
});

describe('a group link and recording', () => {
	it('a link comes back with its id', () => {
		const L = lesson();
		const [link] = addLinks(
			db,
			{ lessonId: L },
			['https://www.youtube.com/watch?v=x'],
			null,
			'u1'
		)!;
		expect(deleteLink(db, { lessonId: L }, link.id, 'u1', T)).toBe(true);
		const [trash] = db.select().from(teamTrash).all();
		expect(trash).toMatchObject({ kind: 'link', label: 'youtube.com · Class 3' });
		expect(restoreTrash(db, T1_SALSA, trash.id, T + 1)).toEqual({ ok: true });
		expect(listLinks(db, { lessonId: L }).map((l) => l.id)).toEqual([link.id]);
	});

	it('a recording keeps its file and comes back', () => {
		const F = variation().figure.id;
		const rec = addRecording(
			db,
			{ figureId: F, file: REC, mime: 'video/mp4', kind: 'video', sizeBytes: 3 * MB, note: null },
			'u1'
		);
		const gone = deleteRecording(db, rec.id, 'u1', T)!;
		expect(trashRow(gone.trashId!)).toMatchObject({ kind: 'recording', sizeBytes: 3 * MB });
		expect(restoreTrash(db, T1_SALSA, gone.trashId!, T + 1)).toEqual({ ok: true });
		expect(db.select({ id: recordings.id }).from(recordings).all()).toEqual([{ id: rec.id }]);
	});
});

describe('restoring archived things (risk 6)', () => {
	/** A published lesson P holding a routine, a drill and a variation, added by u2 and u3. */
	function world() {
		const P = lesson(T1_SALSA, 'P');
		const R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		const D = createCustomExercise(db, T1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
		const F = variation().figure.id;
		linkRoutine(db, P, R, 'u1');
		linkExercise(db, P, D, 'u1');
		linkFigure(db, P, F, 'u1');
		publishLesson(db, T1_SALSA, P, 3);
		const all = { lesson: true, routineIds: [R], drillIds: [D], figureIds: [F] };
		addLesson(db, 'u2', P, all, 10);
		addLesson(db, 'u3', P, all, 10);
		return { P, R, D, F };
	}
	const archivedAt = (userId: string, target: Parameters<typeof entryFor>[2]) =>
		entryFor(db, userId, target)!.archivedAt;

	it('archiving a group lesson takes u2’s entries; u3’s, removed a day earlier, stay removed after restoreLesson', () => {
		const { P, R, D, F } = world();
		removeLesson(db, 'u3', P, T - DAY);
		expect(archivedAt('u3', { lessonId: P })).toBe(T - DAY);

		expect(archiveLesson(db, P, T, 'u1')).toBe(true);
		// The lesson's own entry, and (Task 9) what reconcile dropped with it.
		for (const target of [{ lessonId: P }, { routineId: R }, { drillId: D }, { figureId: F }]) {
			expect(archivedAt('u2', target)).toBe(T);
		}

		expect(restoreLesson(db, { ...T1_SALSA, actorId: 'u2' }, P, T + 1)).toEqual({ ok: true });
		expect(getLessonRow(db, P)!.archivedAt).toBeNull();
		for (const target of [{ lessonId: P }, { routineId: R }, { drillId: D }, { figureId: F }]) {
			expect(archivedAt('u2', target)).toBeNull();
			expect(archivedAt('u3', target)).toBe(T - DAY);
		}
		expect(history(db, 1, 'lesson', P)[0]).toMatchObject({ verb: 'restore', actorId: 'u2' });
	});

	it('restoring a variation whose name was taken since is refused, changing nothing', () => {
		const fig = variation();
		const V2 = createVariationIn(
			db,
			fig.group.id,
			{ name: 'Doble', partner: 'partner', style: 'salsa', notes: null },
			'u1'
		)!.id;
		archiveVariation(db, V2, T, 'u1');
		createVariationIn(
			db,
			fig.group.id,
			{ name: 'doble', partner: 'partner', style: 'salsa', notes: null },
			'u1'
		);
		expect(restoreVariation(db, T1_SALSA, V2, T + 1)).toEqual({
			ok: false,
			reason: 'taken',
			message: 'Enchufla · Doble is taken; rename that one first'
		});
	});

	it('the last variation brings its figure back; a figure name taken since is refused', () => {
		const fig = variation();
		archiveVariation(db, fig.figure.id, T, 'u1');
		const again = variation(T1_SALSA, 'Enchufla', 'Other');
		expect(restoreVariation(db, T1_SALSA, fig.figure.id, T + 1)).toMatchObject({
			ok: false,
			message: 'Enchufla is taken; rename that one first'
		});
		archiveVariation(db, again.figure.id, T + 2, 'u1');
		expect(restoreVariation(db, T1_SALSA, fig.figure.id, T + 3)).toEqual({ ok: true });
	});

	it('a variation, a routine and a drill bring back the entries their archive took', () => {
		const { R, D, F } = world();
		archiveVariation(db, F, T, 'u1');
		archiveRoutine(db, R, T + 1, 'u1');
		archiveExercise(db, D, T + 2, 'u1');
		expect(archivedAt('u2', { figureId: F })).toBe(T);
		expect(archivedAt('u2', { routineId: R })).toBe(T + 1);
		expect(archivedAt('u2', { drillId: D })).toBe(T + 2);
		expect(restoreVariation(db, T1_SALSA, F, T + 3)).toEqual({ ok: true });
		expect(restoreRoutine(db, T1_SALSA, R, T + 3)).toEqual({ ok: true });
		expect(restoreDrill(db, T1_SALSA, D, T + 3)).toEqual({ ok: true });
		expect(archivedAt('u2', { figureId: F })).toBeNull();
		expect(archivedAt('u2', { routineId: R })).toBeNull();
		expect(archivedAt('u2', { drillId: D })).toBeNull();
	});

	it('an entry brought back whose lesson is still archived goes back to its own time', () => {
		const { P, F } = world();
		archiveLesson(db, P, T, 'u1');
		archiveVariation(db, F, T + 1, 'u1');
		// The lesson first: the variation is still archived, so its entry stays at T.
		restoreLesson(db, T1_SALSA, P, T + 2);
		expect(archivedAt('u2', { figureId: F })).toBe(T);
		expect(archivedAt('u2', { lessonId: P })).toBeNull();
	});

	it('a person’s own lesson brings back its review exercise', () => {
		const L = lesson(U1_SALSA, 'Mine');
		archiveLesson(db, L, T, 'u1');
		expect(restoreLesson(db, U1_SALSA, L, T + 1)).toEqual({ ok: true });
		const [review] = db.select().from(exercises).where(eq(exercises.lessonId, L)).all();
		expect(review.archivedAt).toBeNull();
	});

	it('another group’s thing, or a live one, is gone', () => {
		const L = lesson(U1_SALSA, 'Mine');
		archiveLesson(db, L, T, 'u1');
		expect(restoreLesson(db, T1_SALSA, L, T + 1)).toEqual({ ok: false, reason: 'gone' });
		expect(restoreLesson(db, T1_SALSA, lesson(), T + 1)).toEqual({ ok: false, reason: 'gone' });
	});
});

describe('undo of a slot or option delete in a group routine (R10)', () => {
	function world() {
		const P = lesson(T1_SALSA, 'P');
		const R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		const fig = variation();
		const F = fig.figure.id;
		const F2 = createVariationIn(
			db,
			fig.group.id,
			{ name: 'Doble', partner: 'partner', style: 'salsa', notes: null },
			'u1'
		)!.id;
		const step = addFigureSlot(db, R, F, 'u1')!;
		linkRoutine(db, P, R, 'u1');
		publishLesson(db, T1_SALSA, P, 3);
		return { P, R, F, F2, step };
	}

	it('brings back the entries the delete took, and not one removed before', () => {
		const { P, R, F, step } = world();
		addLesson(db, 'u2', P, { lesson: true, routineIds: [R], drillIds: [], figureIds: [F] }, 10);
		const snapshot = deleteSlots(db, R, [step], T, 'u1')!;
		expect(snapshot[0].deletedAt).toBe(T);
		expect(entryFor(db, 'u2', { figureId: F })!.archivedAt).toBe(T);
		expect(restoreSlots(db, R, snapshot, 'u1')).toBe(true);
		expect(entryFor(db, 'u2', { figureId: F })!.archivedAt).toBeNull();
	});

	it('an alternative’s undo with the remove’s time brings its entry back', () => {
		const { P, R, F2, step } = world();
		expect(addOption(db, step, F2, 'u1')).toBe(true);
		addLesson(db, 'u2', P, { lesson: true, routineIds: [R], drillIds: [], figureIds: [F2] }, 10);
		expect(removeOption(db, step, F2, T, 'u1')).toBe(true);
		expect(entryFor(db, 'u2', { figureId: F2 })!.archivedAt).toBe(T);
		expect(restoreOption(db, step, F2, 'u1', T)).toBe(true);
		expect(entryFor(db, 'u2', { figureId: F2 })!.archivedAt).toBeNull();
	});
});

describe('listTrash', () => {
	it('lists trash and archived things newest first, with who, and the day a trash entry goes', () => {
		const L = lesson();
		const S = section(video(L), 'Enchufla doble');
		archiveLesson(db, lesson(T1_SALSA, 'Old'), T, 'u1');
		deleteSpot(db, S, 'u2', T + DAY);
		const D = createCustomExercise(db, T1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
		archiveExercise(db, D, T + 2 * DAY, 'u1');
		// Not the group's, or back already: not listed.
		archiveLesson(db, lesson(U1_SALSA, 'Mine'), T, 'u1');
		const items = listTrash(db, 1, 'UTC');
		expect(items.map((i) => [i.kind, i.label, i.by])).toEqual([
			['drill', 'Clave', 'Ana'],
			['section', "'Enchufla doble' · Class 3", 'Luka'],
			['lesson', 'Old', 'Ana']
		]);
		expect(items[1].purgeOn).not.toBeNull();
		expect(items[0].purgeOn).toBeNull();
	});
});

describe('a lesson unlink in a group', () => {
	it('leaves the trash alone (not a hard-delete kind)', () => {
		const L = lesson();
		const F = variation().figure.id;
		linkFigure(db, L, F, 'u1');
		unlinkFigure(db, L, F, false, T, 'u1');
		expect(db.select().from(teamTrash).all()).toEqual([]);
	});
});
