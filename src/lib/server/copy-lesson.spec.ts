/**
 * Make my own copy: a group lesson becomes a member's own (a member of its
 * family, through the clone engine), its figures filed under their moves by
 * name, each family copied once, its sections linked to the copies, its files
 * linked under new names and charged to them. Files live in a temp folder,
 * never `$DATA_DIR`.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figureGroups,
	figureStartPositions,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	links,
	recordings,
	routines,
	routineSteps,
	spotLinks,
	teamMembers,
	users,
	videoSpots
} from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { setRole } from './membership';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from './lessons';
import { addRecording, createFigure, createVariationIn } from './figures';
import { addChildSlot, addFigureSlot, addOption, createRoutine, routineSlots } from './routines';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import { addLinks } from './links';
import { addLesson } from './entries';
import { seedPositions, listPositions } from './positions';
import { setFigureShape } from './graph';
import { usedBytes } from './storage';
import { purgeTeams } from './team-purge';
import { linkCopy } from './files';
import { copyCost, copyLesson, copySummary, type CopyFiles } from './copy-lesson';
import { suffixed } from './clones/names';
import { T1_SALSA, U2_SALSA } from './test-walls';

const DAY = 24 * 60 * 60 * 1000;
const T = Date.UTC(2026, 10, 3, 20);
const VIDEO = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const REC = '1b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
const SIZE = 5;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;
let dir: string;
let files: CopyFiles;
let w: ReturnType<typeof world>;

/** Group 1's lesson: a video with two sections, two variations, a routine embedding another, a drill. */
function world() {
	const lesson = createLesson(db, T1_SALSA, {
		lessonDay: '2026-11-03',
		title: 'Tue 3 Nov',
		notes: 'Watch the frame.'
	}).lesson.id;
	const made = createFigure(db, T1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!;
	const basic = made.figure.id;
	const doble = createVariationIn(db, made.group.id, { name: 'Doble', ...shape }, 'u1')!.id;
	const intro = createRoutine(db, T1_SALSA, { name: 'Intro', notes: null }).routine.id;
	addFigureSlot(db, intro, basic, 'u1');
	const show = createRoutine(db, T1_SALSA, { name: 'Show', notes: 'Twice.' }).routine.id;
	const step = addFigureSlot(db, show, basic, 'u1')!;
	expect(addChildSlot(db, show, intro, 'u1')).not.toBeNull();
	const drill = createCustomExercise(db, T1_SALSA, {
		name: 'Drill',
		everyDays: 2,
		notes: 'Slow.'
	}).id;
	db.update(exercises)
		.set({ practiceMode: 'count', countBpm: 90 })
		.where(eq(exercises.id, drill))
		.run();

	linkFigure(db, lesson, basic, 'u1');
	linkRoutine(db, lesson, show, 'u1');
	linkExercise(db, lesson, drill, 'u1');
	addLinks(db, { lessonId: lesson }, ['https://example.com/lesson'], 'Notes', 'u1');
	addLinks(db, { exerciseId: drill }, ['https://example.com/drill'], null, 'u1');
	addLinks(db, { figureId: doble }, ['https://example.com/doble'], null, 'u1');

	writeFileSync(join(dir, VIDEO), 'bytes');
	writeFileSync(join(dir, REC), 'bytes');
	const video = addLessonVideo(
		db,
		{ lessonId: lesson, file: VIDEO, mime: 'video/mp4', sizeBytes: SIZE },
		'u1'
	).id;
	addRecording(
		db,
		{ figureId: doble, file: REC, mime: 'video/mp4', kind: 'video', sizeBytes: SIZE, note: null },
		'u1'
	);
	// Doble and the drill are on the lesson through sections only.
	const first = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 0, endMs: 1000, label: 'A' },
		'u1'
	)!;
	const second = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 2000, endMs: 3000, label: 'B' },
		'u1'
	)!;
	addSpot(db, { lessonVideoId: video }, { startMs: 4000, endMs: null, label: 'point' }, 'u1');
	linkInSpace(db, T1_SALSA, first.id, { figureId: doble });
	linkInSpace(db, T1_SALSA, second.id, { exerciseId: drill });
	// An option while the two share a shape; Doble's own timing comes after.
	expect(addOption(db, step, doble, 'u1')).toBe(true);
	const [open, closed] = listPositions(db, 'salsa');
	expect(
		setFigureShape(
			db,
			doble,
			{ startIds: [open.id, closed.id], endId: closed.id, startCount: 5, lengthCounts: 16 },
			'u1'
		)
	).toBe(true);
	db.update(figures).set({ notes: 'Turn twice.' }).where(eq(figures.id, doble)).run();
	publishLesson(db, T1_SALSA, lesson, 2);
	return { lesson, basic, doble, intro, show, drill, video, open, closed };
}

/** Every row of these tables, to compare before and after a refusal. */
const snapshot = () =>
	[
		lessons,
		lessonVideos,
		videoSpots,
		spotLinks,
		figureGroups,
		figures,
		routines,
		routineSteps,
		exercises,
		links
	].map((t) => db.select().from(t).all());

/** u2's live variations of their figure of this name, by name. */
function mineIn(figureName: string) {
	const groups = db
		.select()
		.from(figureGroups)
		.where(
			and(
				eq(figureGroups.userId, 'u2'),
				eq(figureGroups.name, figureName),
				isNull(figureGroups.archivedAt)
			)
		)
		.all();
	expect(groups).toHaveLength(1);
	return db
		.select()
		.from(figures)
		.where(eq(figures.groupId, groups[0].id))
		.orderBy(asc(figures.id))
		.all();
}

beforeEach(() => {
	db = openDb(':memory:');
	seedPositions(db);
	dir = mkdtempSync(join(tmpdir(), 'salsa-copy-'));
	files = { dir, link: linkCopy };
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
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

describe('copyLesson', () => {
	it('makes the lesson u2’s own, with its review exercise, notes, links and video', async () => {
		const res = await copyLesson(db, 'u2', w.lesson, T, files);
		expect(res.ok).toBe(true);
		const id = (res as { lessonId: number }).lessonId;
		expect(id).not.toBe(w.lesson);
		expect(db.select().from(lessons).where(eq(lessons.id, id)).get()).toMatchObject({
			userId: 'u2',
			teamId: null,
			dance: 'salsa',
			title: 'Tue 3 Nov',
			lessonDay: '2026-11-03',
			notes: 'Watch the frame.',
			publishedAt: null
		});
		expect(db.select().from(exercises).where(eq(exercises.lessonId, id)).get()).toMatchObject({
			userId: 'u2',
			teamId: null,
			source: 'lesson',
			name: 'Review: Tue 3 Nov'
		});
		expect(db.select().from(links).where(eq(links.lessonId, id)).all()).toMatchObject([
			{ url: 'https://example.com/lesson', title: 'Notes' }
		]);

		const [video] = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, id)).all();
		expect(video).toMatchObject({ mime: 'video/mp4', sizeBytes: SIZE });
		expect(video.file).not.toBe(VIDEO);
		expect(readFileSync(join(dir, video.file), 'utf8')).toBe('bytes');
		// The sections and the point, and no recording.
		expect(
			db
				.select({ s: videoSpots.startMs, e: videoSpots.endMs, l: videoSpots.label })
				.from(videoSpots)
				.where(eq(videoSpots.lessonVideoId, video.id))
				.orderBy(asc(videoSpots.startMs))
				.all()
		).toEqual([
			{ s: 0, e: 1000, l: 'A' },
			{ s: 2000, e: 3000, l: 'B' },
			{ s: 4000, e: null, l: 'point' }
		]);
		expect(db.select().from(recordings).all()).toHaveLength(1);
	});

	it('copies the variations into a new figure, with their timing, positions, notes and links', async () => {
		await copyLesson(db, 'u2', w.lesson, T, files);
		const [basic, doble] = mineIn('Enchufla');
		expect(basic).toMatchObject({ name: 'Basic', userId: 'u2', teamId: null, dance: 'salsa' });
		expect(doble).toMatchObject({
			name: 'Doble',
			notes: 'Turn twice.',
			startCount: 5,
			lengthCounts: 16,
			endPositionId: w.closed.id,
			styleTag: 'salsa'
		});
		expect(
			db
				.select({ p: figureStartPositions.positionId })
				.from(figureStartPositions)
				.where(eq(figureStartPositions.figureId, doble.id))
				.all()
				.map((r) => r.p)
				.sort()
		).toEqual([w.open.id, w.closed.id].sort());
		expect(db.select().from(links).where(eq(links.figureId, doble.id)).all()).toMatchObject([
			{ url: 'https://example.com/doble' }
		]);
		// No exercise comes with a variation, and no recording.
		expect(db.select().from(exercises).where(eq(exercises.figureId, doble.id)).all()).toHaveLength(
			0
		);
		expect(db.select().from(recordings).where(eq(recordings.figureId, doble.id)).all()).toEqual([]);
	});

	it('for u2, who owns a figure Enchufla, the copied Enchufla · Doble joins it', async () => {
		createFigure(db, U2_SALSA, { figureName: 'enchufla ', name: 'Cross', ...shape });
		await copyLesson(db, 'u2', w.lesson, T, files);
		expect(mineIn('enchufla ').map((v) => v.name)).toEqual(['Cross', 'Basic', 'Doble']);
	});

	it('when u2 already has Doble there, the copy is Doble (Salsa nadaljevalna), then … 2', async () => {
		createFigure(db, U2_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape });
		await copyLesson(db, 'u2', w.lesson, T, files);
		expect(mineIn('Enchufla').map((v) => v.name)).toEqual([
			'Doble',
			'Basic',
			'Doble (Salsa nadaljevalna)'
		]);
	});

	it('copying a lesson twice reuses the first copy', async () => {
		const first = await copyLesson(db, 'u2', w.lesson, T, files);
		if (!first.ok) throw new Error('expected a copy');
		const before = snapshot();
		const filesBefore = readdirSync(dir).sort();
		expect(await copyLesson(db, 'u2', w.lesson, T, files)).toEqual(first);
		expect(snapshot()).toEqual(before);
		expect(readdirSync(dir).sort()).toEqual(filesBefore);
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toHaveLength(1);
		// Nothing more to bring: the summary says so.
		expect(copySummary(db, 'u2', w.lesson)).toEqual({
			bytes: 0,
			videos: 0,
			variations: 0,
			routines: 0,
			drills: 0
		});
	});

	it('copying again after archiving the copy brings that copy back', async () => {
		const first = await copyLesson(db, 'u2', w.lesson, T, files);
		if (!first.ok) throw new Error('expected a copy');
		expect(archiveLesson(db, first.lessonId, T + 1)).toBe(true);
		expect(await copyLesson(db, 'u2', w.lesson, T + 2, files)).toEqual(first);
		expect(db.select().from(lessons).where(eq(lessons.id, first.lessonId)).get()).toMatchObject({
			archivedAt: null
		});
		expect(
			db.select().from(exercises).where(eq(exercises.lessonId, first.lessonId)).get()
		).toMatchObject({ archivedAt: null });
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toHaveLength(1);
	});

	it('two lessons linking one group figure share one copy of it', async () => {
		const other = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-10',
			title: 'Tue 10 Nov',
			notes: null
		}).lesson.id;
		linkFigure(db, other, w.doble, 'u1');
		publishLesson(db, T1_SALSA, other, 3);
		await copyLesson(db, 'u2', w.lesson, T, files);
		const id = ((await copyLesson(db, 'u2', other, T, files)) as { lessonId: number }).lessonId;
		// One move "Enchufla", one Doble in it, and the second lesson links that Doble.
		const [, doble] = mineIn('Enchufla');
		expect(mineIn('Enchufla').map((v) => v.name)).toEqual(['Basic', 'Doble']);
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, id)).all()
		).toMatchObject([{ figureId: doble.id }]);
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toHaveLength(2);
	});

	it('points the section links at the copies, not the group’s rows', async () => {
		const id = ((await copyLesson(db, 'u2', w.lesson, T, files)) as { lessonId: number }).lessonId;
		const video = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, id)).get()!;
		const linked = db
			.select({
				label: videoSpots.label,
				figureId: spotLinks.figureId,
				exerciseId: spotLinks.exerciseId
			})
			.from(spotLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
			.where(eq(videoSpots.lessonVideoId, video.id))
			.orderBy(asc(videoSpots.label))
			.all();
		const [, doble] = mineIn('Enchufla');
		const drill = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'custom')))
			.get()!;
		expect(linked).toEqual([
			{ label: 'A', figureId: doble.id, exerciseId: null },
			{ label: 'B', figureId: null, exerciseId: drill.id }
		]);
		// The group's own links are untouched.
		expect(db.select().from(spotLinks).all()).toHaveLength(4);
	});

	it('copies the routines and the one they embed, slots remapped, and links the lesson’s', async () => {
		const id = ((await copyLesson(db, 'u2', w.lesson, T, files)) as { lessonId: number }).lessonId;
		const mine = db.select().from(routines).where(eq(routines.userId, 'u2')).all();
		expect(mine.map((r) => r.name).sort()).toEqual(['Intro', 'Show']);
		const show = mine.find((r) => r.name === 'Show')!;
		const intro = mine.find((r) => r.name === 'Intro')!;
		expect(show.notes).toBe('Twice.');
		const [basic, doble] = mineIn('Enchufla');
		expect(routineSlots(db, show.id).map((s) => [s.position, s.figureIds, s.childId])).toEqual([
			[0, [basic.id, doble.id], null],
			[1, [], intro.id]
		]);
		expect(routineSlots(db, intro.id).map((s) => s.figureIds)).toEqual([[basic.id]]);
		// Each comes with its own exercise, as a person's routine does.
		for (const r of mine) {
			expect(db.select().from(exercises).where(eq(exercises.routineId, r.id)).get()).toMatchObject({
				userId: 'u2',
				source: 'routine'
			});
		}
		// What the lesson linked by hand: Basic, Show, the drill.
		const drill = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'custom')))
			.get()!;
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, id)).all()
		).toMatchObject([{ figureId: basic.id }]);
		expect(
			db.select().from(lessonRoutines).where(eq(lessonRoutines.lessonId, id)).all()
		).toMatchObject([{ routineId: show.id }]);
		expect(
			db.select().from(lessonExercises).where(eq(lessonExercises.lessonId, id)).all()
		).toMatchObject([{ exerciseId: drill.id }]);
	});

	it('copies the drill with its practice settings and links, and no song', async () => {
		await copyLesson(db, 'u2', w.lesson, T, files);
		const drill = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'custom')))
			.get()!;
		expect(drill).toMatchObject({
			name: 'Drill',
			teamId: null,
			everyDays: 2,
			notes: 'Slow.',
			practiceMode: 'count',
			countBpm: 90,
			songId: null,
			drillId: null
		});
		expect(db.select().from(links).where(eq(links.exerciseId, drill.id)).all()).toMatchObject([
			{ url: 'https://example.com/drill' }
		]);
	});

	it('counts against u2, not the group', async () => {
		expect(copyCost(db, 'u2', w.lesson)).toBe(SIZE);
		expect(copySummary(db, 'u2', w.lesson)).toEqual({
			bytes: SIZE,
			videos: 1,
			variations: 2,
			routines: 2,
			drills: 1
		});
		expect(usedBytes(db, 'u2')).toBe(0);
		await copyLesson(db, 'u2', w.lesson, T, files);
		expect(usedBytes(db, 'u2')).toBe(SIZE);
	});

	it('survives the group’s purge: the copy’s file is its own link', async () => {
		const id = ((await copyLesson(db, 'u2', w.lesson, T, files)) as { lessonId: number }).lessonId;
		const copy = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, id)).get()!;
		deleteTeam(db, 1, 'u1', T);
		expect(
			await purgeTeams(db, T + 31 * DAY, { lessonVideos: dir, recordings: dir, audio: dir })
		).toBe(1);
		expect(existsSync(join(dir, VIDEO))).toBe(false);
		expect(readFileSync(join(dir, copy.file), 'utf8')).toBe('bytes');
		expect(db.select().from(lessons).where(eq(lessons.id, id)).get()!.archivedAt).toBeNull();
		expect(db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, id)).all()).toHaveLength(
			1
		);
	});

	it('over u2’s limit, refuses with the room and leaves no rows and no files', async () => {
		db.update(users)
			.set({ storageLimitBytes: SIZE - 1 })
			.where(eq(users.id, 'u2'))
			.run();
		const before = snapshot();
		const res = await copyLesson(db, 'u2', w.lesson, T, files);
		expect(res).toMatchObject({
			ok: false,
			room: { ok: false, usedBytes: 0, limitBytes: SIZE - 1 }
		});
		expect(snapshot()).toEqual(before);
		expect(readdirSync(dir).sort()).toEqual([VIDEO, REC].sort());
	});

	it('refuses under the disk floor', async () => {
		const res = await copyLesson(db, 'u2', w.lesson, T, files, 0);
		expect(res.ok).toBe(false);
		expect(readdirSync(dir)).toHaveLength(2);
	});

	it('unlinks the new files when the rows cannot be written', async () => {
		const before = snapshot();
		vi.spyOn(db, 'transaction').mockImplementation(() => {
			throw new Error('disk I/O error');
		});
		await expect(copyLesson(db, 'u2', w.lesson, T, files)).rejects.toThrow('disk I/O error');
		vi.restoreAllMocks();
		expect(snapshot()).toEqual(before);
		expect(readdirSync(dir).sort()).toEqual([VIDEO, REC].sort());
	});

	it('starts paused what the person already practises through an entry (R23)', async () => {
		addLesson(
			db,
			'u2',
			w.lesson,
			{ lesson: true, routineIds: [w.show], drillIds: [w.drill], figureIds: [] },
			T
		);
		const id = ((await copyLesson(db, 'u2', w.lesson, T, files)) as { lessonId: number }).lessonId;
		const active = (target: { lessonId: number } | { routineId: number }) =>
			db
				.select({ a: exercises.active })
				.from(exercises)
				.where(
					and(
						eq(exercises.userId, 'u2'),
						'lessonId' in target
							? eq(exercises.lessonId, target.lessonId)
							: eq(exercises.routineId, target.routineId)
					)
				)
				.get()!.a;
		const mine = (name: string) =>
			db
				.select()
				.from(routines)
				.where(and(eq(routines.userId, 'u2'), eq(routines.name, name)))
				.get()!.id;
		expect(active({ lessonId: id })).toBe(false);
		expect(active({ routineId: mine('Show') })).toBe(false);
		// Intro was not picked: no entry, so its copy is on Today.
		expect(active({ routineId: mine('Intro') })).toBe(true);
		const drill = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'custom')))
			.get()!;
		expect(drill).toMatchObject({ active: false, everyDays: 2 });
		// The entries themselves are untouched.
		expect(
			db
				.select({ a: exercises.active })
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'added')))
				.get()!.a
		).toBe(true);
	});

	it('starts everything active for a person with no entries', async () => {
		await copyLesson(db, 'u2', w.lesson, T, files);
		const mine = db.select().from(exercises).where(eq(exercises.userId, 'u2')).all();
		expect(mine.map((e) => e.source).sort()).toEqual(['custom', 'lesson', 'routine', 'routine']);
		expect(mine.every((e) => e.active)).toBe(true);
	});

	it('cuts a suffixed name to fit the form, keeping the suffix whole', async () => {
		expect(suffixed('Doble', ' (G)')).toBe('Doble (G)');
		expect(suffixed('x'.repeat(200), ' (G 2)')).toBe(`${'x'.repeat(194)} (G 2)`);
		const long = 'D'.repeat(200);
		db.update(figures).set({ name: long }).where(eq(figures.id, w.doble)).run();
		createFigure(db, U2_SALSA, { figureName: 'Enchufla', name: long, ...shape });
		await copyLesson(db, 'u2', w.lesson, T, files);
		const copied = mineIn('Enchufla').map((v) => v.name)[2];
		expect(copied).toBe(`${'D'.repeat(200 - 21)} (Salsa nadaljevalna)`);
		expect(copied).toHaveLength(200);
	});

	it('works for someone who left before Keep with the lesson added, and an editor', async () => {
		addLesson(db, 'u2', w.lesson, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
		// Out of the group the way people left before Keep: the row goes, the add stays.
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, 'u2')))
			.run();
		expect((await copyLesson(db, 'u2', w.lesson, T, files)).ok).toBe(true);
		expect((await copyLesson(db, 'u1', w.lesson, T, files)).ok).toBe(true);
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u1')).all()).toHaveLength(1);
	});

	it('lets an editor copy their draft while the group is being deleted, but not a member (R25)', async () => {
		joinTeam(db, 'u3', 1, 2);
		setRole(db, 1, 'u3', 'editor');
		const draft = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'D', notes: null })
			.lesson.id;
		expect(deleteTeam(db, 1, 'u1', T)).toBe(true);
		const res = await copyLesson(db, 'u3', draft, T, files);
		expect(res.ok).toBe(true);
		const copy = db
			.select()
			.from(lessons)
			.where(eq(lessons.id, (res as { lessonId: number }).lessonId))
			.get()!;
		expect(copy).toMatchObject({ userId: 'u3', teamId: null, title: 'D' });
		await expect(copyLesson(db, 'u2', draft, T, files)).rejects.toMatchObject({ status: 404 });
	});

	it('is the missing lesson’s 404 for an outsider, a member’s draft, and a person’s own lesson', async () => {
		const draft = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'D', notes: null })
			.lesson.id;
		const own = createLesson(db, U2_SALSA, { lessonDay: '2026-11-04', title: 'O', notes: null })
			.lesson.id;
		for (const [user, id] of [
			['u3', w.lesson],
			['u2', draft],
			['u2', own],
			['u2', 999]
		] as const) {
			await expect(copyLesson(db, user, id, T, files)).rejects.toMatchObject({ status: 404 });
			expect(() => copyCost(db, user, id)).toThrow();
		}
		expect(readdirSync(dir)).toHaveLength(2);
	});
});
