import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonAdds,
	lessonFigures,
	lessons,
	lessonVideos,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	songs,
	songLinks,
	spotLinks,
	teamMembers,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure } from '../figures';
import { createCustomExercise } from '../exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from '../lessons';
import { createRoutine } from '../routines';
import { addLesson } from '../entries';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { createSongFromUpload } from '../songs';
import { roomFor, storageOf } from '../storage';
import { crossRefs } from '../integrity';
import type { Space } from '../scope';
import { T1_SALSA, U2_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import type { CloneFileKind, CloneFiles } from './files';
import { geneOf } from './genes';
import { keepBytes, keepFromTeam, keepPreview } from './keep';
import { addMusic } from '../song-links';
import { pairBase } from './pairs';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

/** A fake `CloneFiles`: a new name is `copy-<file>`, and every call is recorded. */
function fakeFiles() {
	const linked: [CloneFileKind, string][] = [];
	const unlinked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return `copy-${file}`;
		},
		async unlink(kind, file) {
			unlinked.push([kind, file]);
		}
	};
	return { files, linked, unlinked };
}

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
});

const figure = (space: Space, move: string, name: string) =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const recording = (figureId: number, file: string, sizeBytes: number) =>
	addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes, note: null },
		'u1'
	).id;
/** A slot of one figure at `position` (inserted as is: the graph check is not what's tested). */
function slot(routineId: number, position: number, figureId: number) {
	const step = db.insert(routineSteps).values({ routineId, position }).returning().get().id;
	db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
}

/**
 * The group: lesson L (published; a video with one section linking F; F, R
 * and drill D linked by hand), figure F (Enchufla · Doble, one recording),
 * routine R (a slot of F), a shared class song S, and figure G (Setenta ·
 * Básico, one recording) in another published lesson L2. u2 added L with
 * every pick, practises F (with a set) and picked S on R's entry; u2's own
 * routine P has a slot of G.
 */
function story() {
	const F = figure(T1_SALSA, 'Enchufla', 'Doble');
	recording(F, 'f.mp4', 100);
	const G = figure(T1_SALSA, 'Setenta', 'Básico');
	recording(G, 'g.mp4', 50);
	const R = createRoutine(db, T1_SALSA, { name: 'Rueda basics', notes: null }).routine.id;
	slot(R, 0, F);
	const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;

	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
		.lesson.id;
	const video = addLessonVideo(
		db,
		{ lessonId: L, file: 'v.mp4', mime: 'video/mp4', sizeBytes: 200 },
		'u1'
	).id;
	const spot = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 0, endMs: 900, label: 'Turn' },
		'u1'
	)!;
	linkInSpace(db, T1_SALSA, spot.id, { figureId: F });
	linkFigure(db, L, F, 'u1');
	linkRoutine(db, L, R, 'u1');
	linkExercise(db, L, D, 'u1');
	expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);

	const L2 = createLesson(db, T1_SALSA, { lessonDay: '2026-11-02', title: 'Week 2', notes: null })
		.lesson.id;
	linkFigure(db, L2, G, 'u1');
	expect(publishLesson(db, T1_SALSA, L2, T)).toBe(true);

	const S = createSongFromUpload(db, T1_SALSA, {
		file: 's.mp3',
		mime: 'audio/mpeg',
		title: 'Chan Chan',
		style: 'salsa',
		sizeBytes: 300
	}).id;
	db.update(songs).set({ status: 'ready', sharedAt: T }).where(eq(songs.id, S)).run();

	expect(
		addLesson(db, 'u2', L, { lesson: true, routineIds: [R], drillIds: [D], figureIds: [F] }, T)
	).toBe(true);
	const entryF = entryOf({ figureId: F });
	db.insert(sets).values({ exerciseId: entryF.id, doneAt: T }).run();
	db.update(exercises)
		.set({ songId: S })
		.where(eq(exercises.id, entryOf({ routineId: R }).id))
		.run();

	const P = createRoutine(db, U2_SALSA, { name: 'My routine', notes: null }).routine.id;
	slot(P, 0, G);
	expect(crossRefs(db)).toEqual([]);
	return { F, G, R, D, L, L2, S, P, entryF };
}

function entryOf(target: { figureId: number } | { routineId: number }) {
	const col = 'figureId' in target ? exercises.figureId : exercises.routineId;
	const id = 'figureId' in target ? target.figureId : target.routineId;
	return db
		.select()
		.from(exercises)
		.where(and(eq(exercises.userId, 'u2'), eq(col, id)))
		.get()!;
}

/** u2's copy of a group row (its family's member in u2's app), or undefined. */
function copyOf(kind: 'figure' | 'routine' | 'lesson' | 'song' | 'drill', id: number) {
	const t =
		kind === 'figure'
			? figures
			: kind === 'routine'
				? routines
				: kind === 'lesson'
					? lessons
					: kind === 'song'
						? songs
						: exercises;
	const gene = geneOf(db, kind, id);
	if (gene === null) return undefined;
	return db
		.select({ id: t.id, archivedAt: t.archivedAt })
		.from(t)
		.where(and(eq(t.geneId, gene), eq(t.userId, 'u2'), isNull(t.teamId)))
		.all();
}

const u2Rows = (t: typeof figures | typeof routines | typeof lessons | typeof songs) =>
	db
		.select({ id: t.id })
		.from(t)
		.where(and(eq(t.userId, 'u2'), isNull(t.teamId)))
		.all();
const u2Drills = () =>
	db
		.select()
		.from(exercises)
		.where(and(eq(exercises.userId, 'u2'), eq(exercises.source, 'custom')))
		.all();
const optionsOf = (routineId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.where(eq(routineSteps.routineId, routineId))
		.all()
		.map((r) => r.f);
const leave = () =>
	db
		.delete(teamMembers)
		.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, 'u2')))
		.run();
const addsOf = () => db.select().from(lessonAdds).where(eq(lessonAdds.userId, 'u2')).all();
const figureRow = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;

describe('keepFromTeam: Keep everything', () => {
	it('copies the lesson, figures, routine, drill and song with their files; u2’s rows follow', async () => {
		const s = story();
		const f = fakeFiles();
		const res = await keepFromTeam(db, 'u2', 1, { mode: 'all' }, f.files, NOW);
		expect(res).toEqual({ kept: 6, skipped: [] }); // L, R, F, G, D, S

		// The lesson, with its video and its section (linked to u2's copy of F).
		const [L] = copyOf('lesson', s.L)!;
		const [F] = copyOf('figure', s.F)!;
		const [G] = copyOf('figure', s.G)!;
		const video = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, L.id)).get()!;
		expect(video.file).toBe('copy-v.mp4');
		const spot = db.select().from(videoSpots).where(eq(videoSpots.lessonVideoId, video.id)).get()!;
		expect(
			db
				.select()
				.from(spotLinks)
				.where(eq(spotLinks.spotId, spot.id))
				.all()
				.map((l) => l.figureId)
		).toEqual([F.id]);
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, L.id)).all()
		).toHaveLength(1);

		// Figures with their recordings: files linked, not copied by the database.
		const recs = (figureId: number) =>
			db
				.select()
				.from(recordings)
				.where(eq(recordings.figureId, figureId))
				.all()
				.map((r) => r.file);
		expect(recs(F.id)).toEqual(['copy-f.mp4']);
		expect(recs(G.id)).toEqual(['copy-g.mp4']);
		expect(f.linked.map(([, file]) => file).sort()).toEqual(['f.mp4', 'g.mp4', 's.mp3', 'v.mp4']);
		expect(f.unlinked).toEqual([]);

		// The routine (its slot on u2's F), the drill and the song.
		const [R] = copyOf('routine', s.R)!;
		expect(optionsOf(R.id)).toEqual([F.id]);
		expect(copyOf('drill', s.D)).toHaveLength(1);
		const [S] = copyOf('song', s.S)!;
		expect(db.select().from(songs).where(eq(songs.id, S.id)).get()!.audioFile).toBe('copy-s.mp3');

		// The entry on F moved to the copy, with its set; still live.
		const moved = db.select().from(exercises).where(eq(exercises.id, s.entryF.id)).get()!;
		expect(moved.figureId).toBe(F.id);
		expect(moved.archivedAt).toBeNull();
		expect(db.select().from(sets).where(eq(sets.exerciseId, moved.id)).all()).toHaveLength(1);
		// The routine's practice is on the copy's own exercise, with the song picked: the copy.
		const routinePractice = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.routineId, R.id), isNull(exercises.archivedAt)))
			.get()!;
		expect(routinePractice.active).toBe(true);
		expect(routinePractice.songId).toBe(S.id);
		// u2's own routine now holds u2's G.
		expect(optionsOf(s.P)).toEqual([G.id]);
		expect(addsOf()).toEqual([]);

		// The files are charged to u2.
		expect(storageOf(db, 'u2').usedBytes).toBe(100 + 50 + 200 + 300);

		// Nothing of u2's points at the group's song any more.
		const groupSongs = db.select({ id: songs.id }).from(songs).where(eq(songs.teamId, 1));
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), inArray(exercises.songId, groupSongs)))
				.all()
		).toEqual([]);

		leave();
		expect(crossRefs(db)).toEqual([]);
	});

	it('the drill’s copy keeps the entry’s warm-up, its order and its own Comes back', async () => {
		const s = story();
		const own = JSON.stringify({ kind: 'until', good: 5, since: T });
		const entryD = () =>
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), eq(exercises.drillId, s.D)))
				.get()!;
		db.update(exercises)
			.set({ warmup: true, warmupOrder: 2, comesBack: own })
			.where(eq(exercises.id, entryD().id))
			.run();
		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);
		const [D] = copyOf('drill', s.D)!;
		const copy = db.select().from(exercises).where(eq(exercises.id, D.id)).get()!;
		expect(copy).toMatchObject({
			archivedAt: null,
			warmup: true,
			warmupOrder: 2,
			comesBack: own
		});
	});

	it('a merged-away entry is timed one instant before, so a restore never doubles practice', async () => {
		const s = story();
		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);
		const old = entryOf({ routineId: s.R });
		expect(old.archivedAt).toBe(NOW - 1);
	});
});

describe('keepFromTeam: the other choices', () => {
	it('Keep only what my routines use: only that figure, nothing else of the group', async () => {
		const s = story();
		const f = fakeFiles();
		const res = await keepFromTeam(db, 'u2', 1, { mode: 'used' }, f.files, NOW);
		expect(res.kept).toBe(1);
		const [G] = copyOf('figure', s.G)!;
		expect(u2Rows(figures).map((r) => r.id)).toEqual([G.id]);
		expect(u2Rows(routines).map((r) => r.id)).toEqual([s.P]);
		expect(u2Rows(lessons)).toEqual([]);
		expect(u2Rows(songs)).toEqual([]);
		expect(u2Drills()).toEqual([]);
		expect(optionsOf(s.P)).toEqual([G.id]);
		expect(f.linked).toEqual([['recording', 'g.mp4']]);
		// The song not kept drops to the count; the adds are gone.
		expect(entryOf({ routineId: s.R }).songId).toBeNull();
		expect(addsOf()).toEqual([]);
	});

	it('Choose: a chosen lesson keeps what it brings even unticked; an unticked song is not kept', async () => {
		const s = story();
		const res = await keepFromTeam(
			db,
			'u2',
			1,
			{ mode: 'chosen', lessons: [s.L], figures: [], routines: [], songs: [] },
			fakeFiles().files,
			NOW
		);
		expect(res.kept).toBe(5); // L, R, F, D, and G (used)
		expect(copyOf('lesson', s.L)).toHaveLength(1);
		expect(copyOf('figure', s.F)).toHaveLength(1);
		expect(copyOf('routine', s.R)).toHaveLength(1);
		expect(copyOf('drill', s.D)).toHaveLength(1);
		expect(copyOf('figure', s.G)).toHaveLength(1);
		expect(u2Rows(songs)).toEqual([]);
	});

	it('Choose: an id outside what the person could keep is ignored', async () => {
		const s = story();
		// A group figure only a draft lesson holds: u2 never read it.
		const H = figure(T1_SALSA, 'Dile que no', 'Basic');
		const draft = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Draft',
			notes: null
		}).lesson.id;
		linkFigure(db, draft, H, 'u1');
		await keepFromTeam(
			db,
			'u2',
			1,
			{ mode: 'chosen', lessons: [draft], figures: [H], routines: [], songs: [] },
			fakeFiles().files,
			NOW
		);
		expect(geneOf(db, 'figure', H)).toBeNull();
		expect(geneOf(db, 'lesson', draft)).toBeNull();
		expect(copyOf('figure', s.G)).toHaveLength(1);
	});
});

describe('keepFromTeam: families and room', () => {
	it('already copied: Keep reuses u2’s copy of F (one member, not two)', async () => {
		const s = story();
		const first = await cloneInto(
			db,
			{ kind: 'figure', id: s.F, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!first.ok) throw new Error('expected a copy');
		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);
		expect(copyOf('figure', s.F)!.map((r) => r.id)).toEqual([first.id]);
		expect(db.select().from(exercises).where(eq(exercises.id, s.entryF.id)).get()!.figureId).toBe(
			first.id
		);
	});

	it('a copy made without recordings gets the source’s on Keep, its own fields untouched', async () => {
		const s = story();
		const rec = db.select().from(recordings).where(eq(recordings.figureId, s.F)).get()!;
		const spot = addSpot(
			db,
			{ recordingId: rec.id },
			{ startMs: 0, endMs: 900, label: 'Turn' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, spot.id, { exerciseId: s.D });
		const first = await cloneInto(
			db,
			{ kind: 'figure', id: s.F, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!first.ok) throw new Error('expected a copy');
		db.update(figures).set({ notes: 'Mine' }).where(eq(figures.id, first.id)).run();
		const gene = geneOf(db, 'recording', rec.id)!;
		expect(pairBase(db, 'figure', s.F, first.id)!.skip).toEqual([`rec:${gene}`]);
		const before = storageOf(db, 'u2').usedBytes;

		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);

		const mine = figureRow(first.id);
		expect(mine).toMatchObject({ notes: 'Mine', name: 'Doble' });
		const recs = db.select().from(recordings).where(eq(recordings.figureId, first.id)).all();
		expect(recs.map((r) => [r.file, r.geneId])).toEqual([['copy-f.mp4', gene]]);
		// Its section, linked to u2's copy of the drill.
		const spots = db.select().from(videoSpots).where(eq(videoSpots.recordingId, recs[0].id)).all();
		expect(spots).toHaveLength(1);
		const [D] = copyOf('drill', s.D)!;
		expect(
			db
				.select()
				.from(spotLinks)
				.where(eq(spotLinks.spotId, spots[0].id))
				.all()
				.map((l) => l.exerciseId)
		).toEqual([D.id]);
		// The pair reads the recording as in step now.
		const base = pairBase(db, 'figure', s.F, first.id)!;
		expect(base.skip).toEqual([]);
		expect(Object.keys(base.fields)).toContain(`rec:${gene}`);
		expect(storageOf(db, 'u2').usedBytes - before).toBe(650);
	});

	it('Keep only what my routines use moves practice on what a kept routine brings', async () => {
		const s = story();
		const P2 = createRoutine(db, U2_SALSA, { name: 'Mine with R', notes: null }).routine.id;
		db.insert(routineSteps).values({ routineId: P2, position: 0, childRoutineId: s.R }).run();
		expect(crossRefs(db)).toEqual([]);

		await keepFromTeam(db, 'u2', 1, { mode: 'used' }, fakeFiles().files, NOW);

		const [F] = copyOf('figure', s.F)!;
		const entry = db.select().from(exercises).where(eq(exercises.id, s.entryF.id)).get()!;
		expect(entry).toMatchObject({ figureId: F.id, archivedAt: null });
		expect(db.select().from(sets).where(eq(sets.exerciseId, entry.id)).all()).toHaveLength(1);
		expect(db.select().from(sets).all()).toHaveLength(1);
		leave();
		expect(crossRefs(db).filter((l) => l.includes("entry's figure"))).toEqual([]);
	});

	it('an archived figure a kept lesson still links is not copied, nor its recording charged', async () => {
		const s = story();
		const A = figure(T1_SALSA, 'Vacila', 'Basic');
		recording(A, 'a.mp4', 40);
		linkFigure(db, s.L, A, 'u1');
		const video = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, s.L)).get()!;
		const spot = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 1000, endMs: 1900, label: 'Vacila' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, spot.id, { figureId: A });
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, A)).run();

		expect(keepBytes(db, 'u2', 1, { mode: 'all' })).toBe(650);
		const f = fakeFiles();
		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, f.files, NOW);
		expect(geneOf(db, 'figure', A)).toBeNull();
		expect(f.linked.map(([, n]) => n)).not.toContain('a.mp4');
		expect(storageOf(db, 'u2').usedBytes).toBe(650);
		const [L] = copyOf('lesson', s.L)!;
		expect(
			db.select().from(lessonFigures).where(eq(lessonFigures.lessonId, L.id)).all()
		).toHaveLength(1);
	});

	it.each([
		{ mode: 'all' } as const,
		{ mode: 'used' } as const,
		{ mode: 'chosen', lessons: [], figures: [], routines: [], songs: [] } as const
	])('keepBytes ($mode) is what keepFromTeam charges', async (choice) => {
		const s = story();
		// u2 made a copy of F without recordings: Keep fills it in, and charges it.
		await cloneInto(
			db,
			{ kind: 'figure', id: s.F, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		const c =
			choice.mode === 'chosen'
				? { ...choice, lessons: [s.L], songs: [], figures: [], routines: [] }
				: choice;
		const bytes = keepBytes(db, 'u2', 1, c);
		const before = storageOf(db, 'u2').usedBytes;
		const res = await keepFromTeam(db, 'u2', 1, c, fakeFiles().files, NOW);
		expect(res.skipped).toEqual([]);
		expect(storageOf(db, 'u2').usedBytes - before).toBe(bytes);
		expect(bytes).toBeGreaterThan(0);
	});

	it('an archived copy of u2’s comes back to hold the kept rows', async () => {
		const s = story();
		const first = await cloneInto(
			db,
			{ kind: 'figure', id: s.G, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!first.ok) throw new Error('expected a copy');
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, first.id)).run();
		await keepFromTeam(db, 'u2', 1, { mode: 'used' }, fakeFiles().files, NOW);
		expect(copyOf('figure', s.G)).toEqual([{ id: first.id, archivedAt: null }]);
		expect(optionsOf(s.P)).toEqual([first.id]);
	});

	it('over the limit: u2 at their limit still keeps everything; then an upload is refused', async () => {
		story();
		db.update(users).set({ storageLimitBytes: 0 }).where(eq(users.id, 'u2')).run();
		const res = await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);
		expect(res.kept).toBe(6);
		expect(storageOf(db, 'u2').usedBytes).toBe(650);
		expect(roomFor(db, 'u2', 1).ok).toBe(false);
	});

	it('a failed write unlinks every name it linked', async () => {
		story();
		const f = fakeFiles();
		// The write throws: a table only the transaction reads is gone.
		db.run(sql`drop table song_drops`);
		await expect(keepFromTeam(db, 'u2', 1, { mode: 'all' }, f.files, NOW)).rejects.toThrow();
		expect(f.unlinked.map(([, n]) => n).sort()).toEqual(
			['copy-f.mp4', 'copy-g.mp4', 'copy-s.mp3', 'copy-v.mp4'].sort()
		);
		expect(u2Rows(figures)).toEqual([]);
	});
});

describe('keepPreview', () => {
	it('lists what Keep everything would copy, with sizes and what u2’s routines use', () => {
		const s = story();
		const p = keepPreview(db, 'u2', 1);
		expect(p.lessons.map((i) => i.id)).toEqual([s.L]);
		expect(p.figures.map((i) => i.name)).toEqual(['Enchufla · Doble', 'Setenta · Básico']);
		expect(p.routines.map((i) => i.id)).toEqual([s.R]);
		expect(p.drills.map((i) => i.id)).toEqual([s.D]);
		expect(p.songs.map((i) => i.id)).toEqual([s.S]);
		expect(p.usedNames).toEqual(['Setenta · Básico']);
		expect(p.allBytes).toBe(650);
		expect(p.usedBytes).toBe(50);
		expect(p.nowBytes).toBe(0);
		expect(p.limitBytes).toBeNull();

		const [F, G] = p.figures;
		expect(F).toMatchObject({ bytes: 100, inLesson: s.L, used: null, meta: '1 recording' });
		expect(G).toMatchObject({ bytes: 50, inLesson: null, used: 'My routine', usedBy: 'routine' });
		expect(p.lessons[0]).toMatchObject({ name: 'Week 1', bytes: 200, meta: '1 Nov · 1 video' });
		expect(p.songs[0]).toMatchObject({ name: 'Chan Chan', bytes: 300 });
	});

	it('a copy u2 has already lacks nothing, so it costs nothing', async () => {
		const s = story();
		await cloneInto(
			db,
			{ kind: 'figure', id: s.F, into: U2_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		const p = keepPreview(db, 'u2', 1);
		expect(p.figures[0]).toMatchObject({ id: s.F, bytes: 0 });
		expect(p.allBytes).toBe(550);
	});

	it('a copy u2 made without recordings costs what Keep fills in', async () => {
		const s = story();
		await cloneInto(
			db,
			{ kind: 'figure', id: s.F, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		const p = keepPreview(db, 'u2', 1);
		expect(p.figures[0]).toMatchObject({ id: s.F, bytes: 100 });
		expect(p.allBytes).toBe(650);
		expect(p.allBytes).toBe(keepBytes(db, 'u2', 1, { mode: 'all' }));
	});
});

describe("keepFromTeam: Music on u2's own rows", () => {
	const ownLessonWith = (songId: number) => {
		const lesson = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-03',
			title: 'My notes',
			notes: null
		}).lesson.id;
		expect(addMusic(db, U2_SALSA, { lessonId: lesson }, songId, 'Count it', T)).toMatchObject({
			ok: true
		});
		return lesson;
	};
	const linksOf = (lessonId: number) =>
		db.select().from(songLinks).where(eq(songLinks.lessonId, lessonId)).all();

	it("a kept song's links move to the copy, note and all", async () => {
		const s = story();
		const mine = ownLessonWith(s.S);
		await keepFromTeam(db, 'u2', 1, { mode: 'all' }, fakeFiles().files, NOW);
		const [S] = copyOf('song', s.S)!;
		expect(linksOf(mine)).toEqual([expect.objectContaining({ songId: S.id, note: 'Count it' })]);
		leave();
		expect(crossRefs(db)).toEqual([]);
	});

	it('a song not kept loses its links', async () => {
		const s = story();
		const mine = ownLessonWith(s.S);
		await keepFromTeam(db, 'u2', 1, { mode: 'used' }, fakeFiles().files, NOW);
		expect(linksOf(mine)).toEqual([]);
		leave();
		// Only Music's lines: the entries a real leave settles are not this test's.
		expect(crossRefs(db).filter((l) => l.startsWith('song_links'))).toEqual([]);
	});
});

describe('keepFromTeam: a hearing drill keeps its songs (phase 2)', () => {
	/** A second class song, counted by a person, that nothing else of u2's practises. */
	const hearingSong = () => {
		const id = createSongFromUpload(db, T1_SALSA, {
			file: 'h.mp3',
			mime: 'audio/mpeg',
			title: 'Casa Mía',
			style: 'salsa',
			sizeBytes: 200
		}).id;
		db.update(songs)
			.set({ status: 'ready', sharedAt: T, anchorsJson: '[0]' })
			.where(eq(songs.id, id))
			.run();
		return id;
	};

	it("the teacher's hearing drill comes with its songs: kept with its lesson, no song ticked", async () => {
		const s = story();
		const H = hearingSong();
		db.update(exercises).set({ kind: 'hearing' }).where(eq(exercises.id, s.D)).run();
		expect(addMusic(db, T1_SALSA, { exerciseId: s.D }, H, null, T)).toMatchObject({ ok: true });
		await keepFromTeam(
			db,
			'u2',
			1,
			{ mode: 'chosen', lessons: [s.L], figures: [], routines: [], songs: [] },
			fakeFiles().files,
			NOW
		);
		expect(copyOf('drill', s.D)).toHaveLength(1);
		expect(copyOf('song', H)).toHaveLength(1);
	});

	it("u2's own hearing drill with a class song: the song is kept and its link points at the copy", async () => {
		story();
		const H = hearingSong();
		const own = createCustomExercise(db, U2_SALSA, { name: 'Kje je ena?', notes: null }).id;
		db.update(exercises).set({ kind: 'hearing' }).where(eq(exercises.id, own)).run();
		expect(addMusic(db, U2_SALSA, { exerciseId: own }, H, null, T)).toMatchObject({ ok: true });
		await keepFromTeam(db, 'u2', 1, { mode: 'used' }, fakeFiles().files, NOW);
		const [copy] = copyOf('song', H)!;
		expect(db.select().from(songLinks).where(eq(songLinks.exerciseId, own)).all()).toEqual([
			expect.objectContaining({ songId: copy.id })
		]);
		leave();
		// Only Music's lines: the entries a real leave settles are not this test's.
		expect(crossRefs(db).filter((l) => l.startsWith('song_links'))).toEqual([]);
	});
});

describe('keepFromTeam: a hearing drill never brings an unshared song (review)', () => {
	it("leaves a song the teacher unshared behind, and the drill's copy points at the kept one", async () => {
		const s = story();
		const make = (title: string, file: string) => {
			const id = createSongFromUpload(db, T1_SALSA, {
				file,
				mime: 'audio/mpeg',
				title,
				style: 'salsa',
				sizeBytes: 200
			}).id;
			db.update(songs)
				.set({ status: 'ready', sharedAt: T, anchorsJson: '[0]' })
				.where(eq(songs.id, id))
				.run();
			return id;
		};
		const kept = make('Casa Mía', 'k.mp3');
		const gone = make('Draft', 'g.mp3');
		db.update(exercises).set({ kind: 'hearing' }).where(eq(exercises.id, s.D)).run();
		expect(addMusic(db, T1_SALSA, { exerciseId: s.D }, kept, null, T)).toMatchObject({ ok: true });
		expect(addMusic(db, T1_SALSA, { exerciseId: s.D }, gone, null, T)).toMatchObject({ ok: true });
		db.update(songs).set({ sharedAt: null }).where(eq(songs.id, gone)).run();
		await keepFromTeam(
			db,
			'u2',
			1,
			{ mode: 'chosen', lessons: [s.L], figures: [], routines: [], songs: [] },
			fakeFiles().files,
			NOW
		);
		expect(copyOf('song', gone) ?? []).toHaveLength(0);
		const [song] = copyOf('song', kept)!;
		const [drill] = copyOf('drill', s.D)!;
		expect(db.select().from(songLinks).where(eq(songLinks.exerciseId, drill.id)).all()).toEqual([
			expect.objectContaining({ songId: song.id })
		]);
	});
});
