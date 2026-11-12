/**
 * History: every group mutation writes exactly one line in the same
 * transaction, a person's writes none, nudges merge, and Restore goes through
 * the clash check.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import {
	figures,
	positions as positionsTable,
	songs,
	songLinks,
	spotPositionLinks,
	teamChanges,
	teamTrash,
	users,
	videoSpots
} from './db/schema';
import { linkSpotToPosition, unlinkSpotFromPosition } from './position-links';
import { restoreTrash } from './trash';
import { actorOf, isTeam, type Space } from './scope';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_SALSA } from './test-walls';
import { createTeam, joinTeam } from './teams';
import { removeMember, setRole } from './membership';
import {
	archivedTarget,
	editedBy,
	history,
	lastEdit,
	logChange,
	restoreChange,
	rootInTeam,
	teamNames
} from './changes';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	deleteLessonVideo,
	getLessonRow,
	linkExercise,
	linkFigure,
	linkPosition,
	linkRoutine,
	publishLesson,
	restoreLesson,
	unlinkExercise,
	unlinkFigure,
	unlinkPosition,
	unlinkRoutine,
	updateLesson
} from './lessons';
import { addSpot, deleteSpot, updateSpot } from './spots';
import { linkInSpace, linkSpot, unlinkFromSection, unlinkSpot } from './spot-links';
import { addLinks, deleteLink } from './links';
import {
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom,
	createVariationIn,
	deleteRecording,
	moveVariation,
	renameFigure,
	restoreVariation,
	updateVariation
} from './figures';
import { setFigureShape } from './graph';
import {
	addTemplates,
	archivePosition,
	createPosition,
	restorePosition,
	updatePosition
} from './positions';
import type { PositionRow } from './db/schema';
import type { PositionInput } from '$lib/types';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	createRoutine,
	createRoutineFromFigures,
	deleteSlots,
	duplicateRoutine,
	duplicateSlots,
	makeSection,
	promoteSection,
	insertSlot,
	moveSlotTo,
	removeOption,
	restoreOption,
	setOptionLength,
	restoreRoutine,
	restoreSlots,
	setSlotEnd,
	setSlotNote,
	updateRoutine
} from './routines';
import { archiveExercise, createCustomExercise, restoreDrill, updateExercise } from './exercises';
import { claimVideoJob, completeVideoJob, requestVideoDownload } from './video-downloads';
import {
	createSongFromUpload,
	createSongFromUrl,
	restoreCount,
	setAnchors,
	setCountAndSections,
	setMusicStart,
	setSampleStart,
	setSections,
	setTempoFactor,
	updateSongMeta
} from './songs';
import { deleteGroupSong, shareSong, unshareSong } from './song-share';
import {
	addFromImport,
	claimImportJob,
	createImport,
	dismissImport,
	failImportJob,
	retryImport,
	storeImportItems
} from './song-imports';
import { addMusic, removeMusic, setMusicNote } from './song-links';
import { restoreDeleted } from './trash';
import { eq } from 'drizzle-orm';
import { HISTORY_MERGE_MS } from '$lib/limits';
import { cloneInto, type CloneResult } from './clones/clone';
import type { CloneFiles } from './clones/files';
import { syncFrom } from './clones/apply';
import { digest, hashValue, pairBase } from './clones/pairs';
import { flatOf } from './clones/trees';
import { diff } from '$lib/clones/diff';
import { flowFrom } from './clones/flow';
import { syncAll, syncView } from './clones/sync';
import { detach } from './clones/detach';
import { copyTo } from './clones/copy-to';
import { moveLesson } from './clones/move';
import { demoteRoutine } from './sections';

let db: Db;
const GB = 1024 ** 3;
const MIN = 60_000;
/** Later than anything the fixtures write with `Date.now()`, so a test's own times are the newest. */
const T = Date.now() + 60 * MIN;

/** A new database with Ana, Luka and a second Ana. */
function fresh() {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'ana@x.si', passwordHash: 'x', firstName: 'Ana', lastName: 'Kranjc' },
			{ id: 'u2', email: 'luka@x.si', passwordHash: 'x', firstName: 'Luka', lastName: 'Novak' },
			{ id: 'u3', email: 'ana2@x.si', passwordHash: 'x', firstName: 'Ana', lastName: 'Zupan' }
		])
		.run();
}

beforeEach(() => {
	fresh();
	const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	if (!made.ok || made.teamId !== T1_SALSA.teamId) throw new Error('team 1 expected');
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
});

const rows = () => db.select().from(teamChanges).all();
const count = () => rows().length;
const variation = (name: string) => ({
	name,
	partner: 'partner' as const,
	style: 'salsa',
	notes: null
});

const newPosition = (name: string): PositionInput => ({
	name,
	styleTag: 'salsa',
	hold: { hands: 'two', crossed: null, facing: 'face', frame: 'closed' },
	notes: null,
	pictureSpotId: null
});

/** A fake `CloneFiles`: nothing on disk. */
const cloneFiles: CloneFiles = { link: async (_, file) => `copy-${file}`, unlink: async () => {} };
/** A clone's result when it made a row, else null, so a refusal fails the case. */
const ok = (r: CloneResult | { ok: false; reason: 'phoneOnly' }) => (r.ok && r.made ? r : null);

/** One of everything in a space, for a mutation to act on. */
function world(space: Space) {
	const by = actorOf(space);
	const lesson = createLesson(db, space, { lessonDay: '2026-11-01', title: 'Class', notes: null })
		.lesson.id;
	const fig = createFigure(db, space, { figureName: 'Enchufla', ...variation('Basic') })!;
	const V = fig.figure.id;
	const G = fig.group.id;
	const V2 = createVariationIn(db, G, variation('Doble'), by)!.id;
	const other = createFigure(db, space, { figureName: 'Dile', ...variation('Basic') })!.group.id;
	const routine = createRoutine(db, space, { name: 'Show', notes: null }).routine.id;
	const step = addFigureSlot(db, routine, V, by)!;
	const step2 = addFigureSlot(db, routine, V, by)!;
	const child = createRoutine(db, space, { name: 'Child', notes: null }).routine.id;
	const drill = createCustomExercise(db, space, { name: 'Shines', everyDays: 3, notes: null }).id;
	const drill2 = createCustomExercise(db, space, { name: 'Turns', everyDays: 3, notes: null }).id;
	const video = addLessonVideo(
		db,
		{ lessonId: lesson, file: 'a.mp4', mime: 'video/mp4', sizeBytes: 5 },
		by
	).id;
	const emptyVideo = addLessonVideo(
		db,
		{ lessonId: lesson, file: 'b.mp4', mime: 'video/mp4', sizeBytes: 5 },
		by
	).id;
	const rec = addRecording(
		db,
		{ figureId: V, file: 'r.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: 5, note: null },
		by
	).id;
	const section = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 0, endMs: 5000, label: 'Enchufla doble' },
		by
	)!.id;
	const linked = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 6000, endMs: 9000, label: 'B' },
		by
	)!.id;
	const spotLink = linkInSpace(db, space, linked, { exerciseId: drill });
	const link = addLinks(db, { lessonId: lesson }, ['https://example.org/a'], null, by)![0].id;
	const position = createPosition(db, space, newPosition('Cerrada'), 1) as PositionRow;
	const song = createSongFromUpload(db, space, {
		file: 'song.mp3',
		mime: 'audio/mpeg',
		title: 'Chan Chan',
		style: 'salsa'
	}).id;
	db.update(songs)
		.set({ status: 'ready', durationS: 200, beatsJson: '[]' })
		.where(eq(songs.id, song))
		.run();
	return {
		by,
		lesson,
		V,
		V2,
		G,
		other,
		routine,
		step,
		step2,
		child,
		drill,
		drill2,
		video,
		emptyVideo,
		rec,
		section,
		linked,
		spotLink,
		link,
		song,
		position: position.id
	};
}
type World = ReturnType<typeof world>;

/** The lesson's one Music link (the mutations' prep added it). */
const musicLinkOf = (lesson: number) =>
	db.select({ id: songLinks.id }).from(songLinks).where(eq(songLinks.lessonId, lesson)).get()!.id;

/**
 * Every mutating data function, with where its line is filed. A NEW TEAM
 * MUTATION MUST BE ADDED HERE: this list is what proves each one logs once in a
 * group and never for a person. `prep` runs first and is not counted.
 */
/** The pasted playlist `addFromImport`'s prep made. */
let importId = 0;

/** The section `promoteSection` runs on, made in its `prep`. */
let sectionOf = 0;
const MUTATIONS: {
	name: string;
	root: 'lesson' | 'figure' | 'routine' | 'drill' | 'song' | 'position';
	verb: string;
	rootId: (w: World) => number;
	teamOnly?: boolean;
	prep?: (w: World, space: Space) => unknown;
	run: (w: World, space: Space) => unknown;
}[] = [
	// lessons.ts
	{
		name: 'createLesson',
		root: 'lesson',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => createLesson(db, s, { lessonDay: '2026-11-02', title: 'New', notes: null })
	},
	{
		name: 'updateLesson',
		root: 'lesson',
		verb: 'change',
		rootId: (w) => w.lesson,
		run: (w) =>
			updateLesson(db, w.lesson, { lessonDay: '2026-11-01', title: 'Class', notes: 'n' }, w.by)
	},
	{
		name: 'archiveLesson',
		root: 'lesson',
		verb: 'archive',
		rootId: (w) => w.lesson,
		run: (w) => archiveLesson(db, w.lesson, 5, w.by)
	},
	{
		name: 'publishLesson',
		root: 'lesson',
		verb: 'publish',
		rootId: (w) => w.lesson,
		teamOnly: true,
		run: (w) => publishLesson(db, T1_SALSA, w.lesson, 5)
	},
	{
		name: 'linkFigure',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkFigure(db, w.lesson, w.V, w.by)
	},
	{
		name: 'unlinkFigure',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w) => linkFigure(db, w.lesson, w.V, w.by),
		run: (w) => unlinkFigure(db, w.lesson, w.V, false, 5, w.by)
	},
	{
		name: 'linkRoutine',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkRoutine(db, w.lesson, w.routine, w.by)
	},
	{
		name: 'unlinkRoutine',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w) => linkRoutine(db, w.lesson, w.routine, w.by),
		run: (w) => unlinkRoutine(db, w.lesson, w.routine, 5, w.by)
	},
	{
		name: 'linkExercise',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkExercise(db, w.lesson, w.drill2, w.by)
	},
	{
		name: 'unlinkExercise',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w) => linkExercise(db, w.lesson, w.drill2, w.by),
		run: (w) => unlinkExercise(db, w.lesson, w.drill2, false, 5, w.by)
	},
	{
		name: 'addLessonVideo',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) =>
			addLessonVideo(
				db,
				{ lessonId: w.lesson, file: 'c.mp4', mime: 'video/mp4', sizeBytes: 1 },
				w.by
			)
	},
	{
		name: 'deleteLessonVideo',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		run: (w) => deleteLessonVideo(db, w.emptyVideo, w.by)
	},
	// spots.ts
	{
		name: 'addSpot',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) =>
			addSpot(db, { lessonVideoId: w.video }, { startMs: 1, endMs: null, label: null }, w.by)
	},
	{
		name: 'addSpot (recording)',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.G,
		run: (w) => addSpot(db, { recordingId: w.rec }, { startMs: 1, endMs: null, label: null }, w.by)
	},
	{
		name: 'updateSpot',
		root: 'lesson',
		verb: 'change',
		rootId: (w) => w.lesson,
		run: (w) => updateSpot(db, w.section, { startMs: 1200 }, w.by)
	},
	{
		name: 'deleteSpot',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		run: (w) => deleteSpot(db, w.section, w.by)
	},
	// spot-links.ts
	{
		name: 'linkInSpace',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w, s) => linkInSpace(db, s, w.section, { figureId: w.V })
	},
	{
		name: 'linkSpot',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkSpot(db, w.by, w.section, { figureId: w.V })
	},
	{
		name: 'unlinkSpot',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		run: (w) => unlinkSpot(db, w.spotLink, { exerciseId: w.drill }, 5, w.by)
	},
	// position-links.ts
	{
		name: 'linkSpotToPosition',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkSpotToPosition(db, w.by, w.section, w.position, 5)
	},
	{
		name: 'linkSpotToPosition (recording point)',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.G,
		prep: (w) =>
			addSpot(db, { recordingId: w.rec }, { startMs: 1, endMs: null, label: null }, w.by),
		run: (w) => {
			const p = db.select().from(videoSpots).where(eq(videoSpots.recordingId, w.rec)).get()!;
			return linkSpotToPosition(db, w.by, p.id, w.position, 5);
		}
	},
	{
		name: 'unlinkSpotFromPosition',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w) => linkSpotToPosition(db, w.by, w.section, w.position, 5),
		run: (w) => unlinkSpotFromPosition(db, db.select().from(spotPositionLinks).get()!.id, 5, w.by)
	},
	{
		name: 'linkPosition',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) => linkPosition(db, w.lesson, w.position, w.by)
	},
	{
		name: 'unlinkPosition',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w) => linkPosition(db, w.lesson, w.position, w.by),
		run: (w) => unlinkPosition(db, w.lesson, w.position, true, 5, w.by)
	},
	{
		name: 'unlinkFromSection',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		run: (w) => unlinkFromSection(db, w.linked, w.spotLink, true, 5, w.by)
	},
	// links.ts
	{
		name: 'addLinks',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		run: (w) =>
			addLinks(
				db,
				{ lessonId: w.lesson },
				['https://example.org/b', 'https://example.org/c'],
				null,
				w.by
			)
	},
	{
		name: 'addLinks (drill)',
		root: 'drill',
		verb: 'add',
		rootId: (w) => w.drill,
		run: (w) => addLinks(db, { exerciseId: w.drill }, ['https://example.org/b'], null, w.by)
	},
	{
		name: 'deleteLink',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		run: (w) => deleteLink(db, { lessonId: w.lesson }, w.link, w.by)
	},
	// figures.ts and graph.ts
	{
		name: 'createFigure',
		root: 'figure',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => createFigure(db, s, { figureName: 'Vacilala', ...variation('Basic') })
	},
	{
		name: 'createVariationIn',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.G,
		run: (w) => createVariationIn(db, w.G, variation('Triple'), w.by)
	},
	{
		name: 'createVariationFrom',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.G,
		run: (w) => createVariationFrom(db, w.V, 'Copy', w.by)
	},
	{
		name: 'updateVariation',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		run: (w) => updateVariation(db, w.V, { ...variation('Basic'), notes: 'lead early' }, w.by)
	},
	{
		name: 'setFigureShape',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		run: (w) =>
			setFigureShape(db, w.V, { startIds: [], endIds: [], startCount: 5, lengthCounts: 8 }, w.by)
	},
	{
		name: 'renameFigure',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		run: (w) => renameFigure(db, w.G, 'Enchufla doble', w.by)
	},
	{
		name: 'archiveVariation',
		root: 'figure',
		verb: 'archive',
		rootId: (w) => w.G,
		run: (w) => archiveVariation(db, w.V2, 5, w.by)
	},
	{
		name: 'moveVariation',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.other,
		run: (w) => moveVariation(db, w.V2, { groupId: w.other }, w.by)
	},
	{
		name: 'addRecording',
		root: 'figure',
		verb: 'add',
		rootId: (w) => w.G,
		run: (w) =>
			addRecording(
				db,
				{
					figureId: w.V,
					file: 's.mp4',
					mime: 'video/mp4',
					kind: 'video',
					sizeBytes: 1,
					note: null
				},
				w.by
			)
	},
	{
		name: 'deleteRecording',
		root: 'figure',
		verb: 'remove',
		rootId: (w) => w.G,
		run: (w) => deleteRecording(db, w.rec, w.by)
	},
	// routines.ts
	{
		name: 'createRoutine',
		root: 'routine',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => createRoutine(db, s, { name: 'Another', notes: null })
	},
	{
		name: 'createRoutineFromFigures',
		root: 'routine',
		verb: 'add',
		rootId: () => 0,
		run: (w, s) => createRoutineFromFigures(db, s, { name: 'From', notes: null }, [w.V])
	},
	{
		name: 'updateRoutine',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.routine,
		run: (w) => updateRoutine(db, w.routine, { name: 'Show', notes: 'slow' }, w.by)
	},
	{
		name: 'archiveRoutine',
		root: 'routine',
		verb: 'archive',
		rootId: (w) => w.routine,
		run: (w) => archiveRoutine(db, w.routine, 5, w.by)
	},
	{
		name: 'insertSlot',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => insertSlot(db, w.routine, 0, { figureId: w.V }, w.by)
	},
	{
		name: 'addFigureSlot',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => addFigureSlot(db, w.routine, w.V, w.by)
	},
	{
		name: 'addChildSlot',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => addChildSlot(db, w.routine, w.child, w.by)
	},
	{
		name: 'addOption',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => addOption(db, w.step, w.V2, w.by)
	},
	{
		name: 'removeOption',
		root: 'routine',
		verb: 'remove',
		rootId: (w) => w.routine,
		prep: (w) => addOption(db, w.step, w.V2, w.by),
		run: (w) => removeOption(db, w.step, w.V2, 5, w.by)
	},
	{
		name: 'restoreOption',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		prep: (w) => addOption(db, w.step, w.V2, w.by) && removeOption(db, w.step, w.V2, 5, w.by),
		run: (w) => restoreOption(db, w.step, w.V2, w.by)
	},
	{
		name: 'setOptionLength',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.routine,
		// The slot's figure has its length set in the routine (spec 2026-11-11).
		prep: (w) => db.update(figures).set({ lengthFree: 1 }).where(eq(figures.id, w.V)).run(),
		run: (w) => setOptionLength(db, w.step, w.V, 12, w.by)
	},
	{
		name: 'setSlotEnd',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.routine,
		// The slot's figure ends in the group's position (spec 2026-11-11, slot end).
		prep: (w) =>
			setFigureShape(
				db,
				w.V,
				{ startIds: [], endIds: [w.position], startCount: 1, lengthCounts: 8 },
				w.by
			),
		run: (w) => setSlotEnd(db, w.step, w.position, w.by)
	},
	{
		name: 'setSlotNote',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.routine,
		run: (w) => setSlotNote(db, w.step, 'on 5', w.by)
	},
	{
		name: 'deleteSlots',
		root: 'routine',
		verb: 'remove',
		rootId: (w) => w.routine,
		run: (w) => deleteSlots(db, w.routine, [w.step, w.step2], 5, w.by)
	},
	{
		name: 'restoreSlots',
		root: 'routine',
		verb: 'restore',
		rootId: (w) => w.routine,
		run: (w) => {
			const snapshot = deleteSlots(db, w.routine, [w.step], 5, w.by)!;
			db.delete(teamChanges).run();
			return restoreSlots(db, w.routine, snapshot, w.by);
		}
	},
	{
		name: 'moveSlotTo',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.routine,
		run: (w) => moveSlotTo(db, w.routine, w.step, 1, w.by)
	},
	{
		name: 'duplicateSlots',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => duplicateSlots(db, w.routine, [w.step], w.by)
	},
	{
		name: 'makeSection',
		root: 'routine',
		verb: 'add',
		rootId: (w) => w.routine,
		run: (w) => makeSection(db, w.routine, [w.step], w.by)
	},
	{
		name: 'promoteSection',
		root: 'routine',
		verb: 'change',
		rootId: () => 0,
		prep: (w) => {
			sectionOf = makeSection(db, w.routine, [w.step], w.by)!.sectionId;
		},
		run: (w) => promoteSection(db, sectionOf, 'Bit', w.by)
	},
	{
		name: 'demoteRoutine',
		root: 'routine',
		verb: 'change',
		rootId: (w) => w.child,
		prep: (w) => {
			addChildSlot(db, w.routine, w.child, w.by);
		},
		run: (w) => demoteRoutine(db, w.child, w.by)
	},
	{
		name: 'duplicateRoutine',
		root: 'routine',
		verb: 'add',
		rootId: () => 0,
		run: (w) => duplicateRoutine(db, w.routine, w.by)
	},
	// exercises.ts
	{
		name: 'createCustomExercise',
		root: 'drill',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => createCustomExercise(db, s, { name: 'Spins', everyDays: 3, notes: null })
	},
	{
		name: 'updateExercise',
		root: 'drill',
		verb: 'change',
		rootId: (w) => w.drill,
		run: (w) =>
			updateExercise(db, w.drill, { name: 'Shines', everyDays: 3, notes: 'x', active: true }, w.by)
	},
	{
		name: 'archiveExercise',
		root: 'drill',
		verb: 'archive',
		rootId: (w) => w.drill2,
		run: (w) => archiveExercise(db, w.drill2, 5, w.by)
	},
	// trash.ts and the restores of archived things (Recently deleted)
	{
		name: 'restoreTrash',
		root: 'lesson',
		verb: 'restore',
		rootId: (w) => w.lesson,
		teamOnly: true,
		prep: (w) => deleteSpot(db, w.section, w.by),
		run: (_, s) => {
			const [entry] = db.select().from(teamTrash).all();
			const done = restoreTrash(db, s as typeof T1_SALSA, entry.id, T);
			return done.ok;
		}
	},
	{
		name: 'restoreLesson',
		root: 'lesson',
		verb: 'restore',
		rootId: (w) => w.lesson,
		prep: (w) => archiveLesson(db, w.lesson, 5, w.by),
		run: (w, s) => restoreLesson(db, s, w.lesson, T).ok
	},
	{
		name: 'restoreVariation',
		root: 'figure',
		verb: 'restore',
		rootId: (w) => w.G,
		prep: (w) => archiveVariation(db, w.V2, 5, w.by),
		run: (w, s) => restoreVariation(db, s, w.V2, T).ok
	},
	{
		name: 'restoreRoutine',
		root: 'routine',
		verb: 'restore',
		rootId: (w) => w.routine,
		prep: (w) => archiveRoutine(db, w.routine, 5, w.by),
		run: (w, s) => restoreRoutine(db, s, w.routine, T).ok
	},
	{
		name: 'restoreDrill',
		root: 'drill',
		verb: 'restore',
		rootId: (w) => w.drill2,
		prep: (w) => archiveExercise(db, w.drill2, 5, w.by),
		run: (w, s) => restoreDrill(db, s, w.drill2, T).ok
	},
	// song-links.ts: a lesson's Music (a group's song shared first, so the add is one line)
	{
		name: 'addMusic',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		prep: (w, s) => isTeam(s) && shareSong(db, s, w.song, T),
		run: (w, s) => addMusic(db, s, { lessonId: w.lesson }, w.song, 'Count it', T).ok
	},
	{
		name: 'setMusicNote',
		root: 'lesson',
		verb: 'change',
		rootId: (w) => w.lesson,
		prep: (w, s) => {
			if (isTeam(s)) shareSong(db, s, w.song, T);
			return addMusic(db, s, { lessonId: w.lesson }, w.song, null, T);
		},
		run: (w, s) => setMusicNote(db, s, musicLinkOf(w.lesson), 'Listen for the clave', T)
	},
	{
		name: 'removeMusic',
		root: 'lesson',
		verb: 'remove',
		rootId: (w) => w.lesson,
		prep: (w, s) => {
			if (isTeam(s)) shareSong(db, s, w.song, T);
			return addMusic(db, s, { lessonId: w.lesson }, w.song, null, T);
		},
		run: (w, s) => removeMusic(db, s, musicLinkOf(w.lesson), T)
	},
	// songs.ts
	{
		name: 'createSongFromUrl',
		root: 'song',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) =>
			createSongFromUrl(db, s, { url: 'https://youtu.be/x', title: 'New', style: 'salsa' }, T)
	},
	{
		// One `add` line per ticked song: Add from a pick list of one.
		name: 'addFromImport',
		root: 'song',
		verb: 'add',
		rootId: () => 0,
		prep: (_, s) => {
			importId = createImport(
				db,
				s,
				{ url: 'https://www.youtube.com/playlist?list=PL1', kind: 'youtube-playlist' },
				T
			).id;
			storeImportItems(db, importId, {
				name: 'Clase',
				items: [{ title: 'Uno', artist: null, durationS: 200, url: 'https://youtu.be/x1' }],
				truncated: false
			});
		},
		run: (_, s) =>
			addFromImport(db, s, importId, [{ i: 0, title: 'Uno', artist: null, style: 'salsa' }], T).ok
	},
	{
		name: 'createSongFromUpload',
		root: 'song',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) =>
			createSongFromUpload(
				db,
				s,
				{ file: 'new.mp3', mime: 'audio/mpeg', title: 'New', style: 'salsa' },
				T
			)
	},
	{
		name: 'setAnchors',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => setAnchors(db, w.song, [0, 8], s, T)
	},
	{
		name: 'setTempoFactor',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => setTempoFactor(db, w.song, 2, s, T)
	},
	{
		name: 'setSections',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => setSections(db, w.song, [{ at: 4, name: 'Mambo', countOff: false }], s, T)
	},
	{
		name: 'setCountAndSections',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) =>
			setCountAndSections(
				db,
				w.song,
				{ anchors: [3], sections: [{ at: 1.5, name: '', countOff: true }] },
				s,
				T
			)
	},
	{
		name: 'restoreCount',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => restoreCount(db, w.song, [5], 2, s, T)
	},
	{
		name: 'setMusicStart',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => setMusicStart(db, w.song, 3, s, T)
	},
	{
		name: 'setSampleStart',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) => setSampleStart(db, w.song, 12, s, T)
	},
	{
		name: 'updateSongMeta',
		root: 'song',
		verb: 'edit',
		rootId: (w) => w.song,
		run: (w, s) =>
			updateSongMeta(db, w.song, { title: 'Other', artist: null, style: 'salsa' }, s, T)
	},
	// song-share.ts
	{
		name: 'shareSong',
		root: 'song',
		verb: 'share',
		rootId: (w) => w.song,
		teamOnly: true,
		run: (w) => shareSong(db, T1_SALSA, w.song, T)
	},
	{
		name: 'unshareSong',
		root: 'song',
		verb: 'unshare',
		rootId: (w) => w.song,
		teamOnly: true,
		prep: (w) => shareSong(db, T1_SALSA, w.song, 5),
		run: (w) => unshareSong(db, T1_SALSA, w.song, T)
	},
	{
		name: 'deleteGroupSong',
		root: 'song',
		verb: 'delete',
		rootId: (w) => w.song,
		teamOnly: true,
		run: (w) => deleteGroupSong(db, T1_SALSA, w.song, T)
	},
	{
		name: 'restoreDeleted (song)',
		root: 'song',
		verb: 'restore',
		rootId: (w) => w.song,
		teamOnly: true,
		prep: (w) => deleteGroupSong(db, T1_SALSA, w.song, 5),
		run: (w) => restoreDeleted(db, T1_SALSA, 'song', w.song, T)
	},
	// clones/clone.ts: a person's own thing cloned into the group (cloneInto awaits its files)
	{
		name: 'cloneInto (figure)',
		root: 'figure',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createFigure(db, U1_SALSA, { figureName: 'Cloned', ...variation('Basic') })!;
			return ok(
				await cloneInto(
					db,
					{ kind: 'figure', id: own.figure.id, into: T1_SALSA, recordings: false },
					cloneFiles,
					T
				)
			);
		}
	},
	{
		name: 'cloneInto (drill)',
		root: 'drill',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createCustomExercise(db, U1_SALSA, { name: 'Mine', everyDays: 3, notes: null });
			return ok(
				await cloneInto(
					db,
					{ kind: 'drill', id: own.id, into: T1_SALSA, recordings: false },
					cloneFiles,
					T
				)
			);
		}
	},
	{
		name: 'cloneInto (song)',
		root: 'song',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createSongFromUpload(db, U1_SALSA, {
				file: 'mine.mp3',
				mime: 'audio/mpeg',
				title: 'Mine',
				style: 'salsa'
			}).id;
			db.update(songs).set({ status: 'ready' }).where(eq(songs.id, own)).run();
			return ok(
				await cloneInto(
					db,
					{ kind: 'song', id: own, into: T1_SALSA, recordings: false },
					cloneFiles,
					T
				)
			);
		}
	},
	{
		name: 'cloneInto (routine)',
		root: 'routine',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createRoutine(db, U1_SALSA, { name: 'Mine', notes: null }).routine.id;
			return ok(
				await cloneInto(
					db,
					{ kind: 'routine', id: own, into: T1_SALSA, recordings: false },
					cloneFiles,
					T
				)
			);
		}
	},
	{
		name: 'cloneInto (lesson)',
		root: 'lesson',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createLesson(db, U1_SALSA, {
				lessonDay: '2026-11-02',
				title: 'Mine',
				notes: null
			}).lesson.id;
			return ok(
				await cloneInto(
					db,
					{ kind: 'lesson', id: own, into: T1_SALSA, recordings: false },
					cloneFiles,
					T
				)
			);
		}
	},
	// clones/apply.ts: syncFrom (what Take theirs was) into the group's figure from u1's own copy
	{
		name: 'syncFrom',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		teamOnly: true,
		run: async (w) => {
			const mine = await cloneInto(
				db,
				{ kind: 'figure', id: w.V, into: U1_SALSA, recordings: false },
				cloneFiles,
				T
			);
			if (!mine.ok) return null;
			updateVariation(db, mine.id, { ...variation('Basic'), notes: 'Taken' });
			const into = flatOf(db, 'figure', w.V);
			const diffs = diff(
				pairBase(db, 'figure', w.V, mine.id),
				into,
				flatOf(db, 'figure', mine.id),
				hashValue
			);
			const picks = Object.fromEntries(diffs.map((d) => [d.key, 'theirs' as const]));
			const r = await syncFrom(
				db,
				'u1',
				'figure',
				w.V,
				mine.id,
				picks,
				digest(into),
				cloneFiles,
				T,
				GB
			);
			return r.ok ? r : null;
		}
	},
	// clones/flow.ts: Keep in step, u1's save on her own copy flows into the group's figure
	// (landKeys logs it, as the saver: one change)
	{
		name: 'flowFrom',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		teamOnly: true,
		run: async (w) => {
			const mine = await cloneInto(
				db,
				{ kind: 'figure', id: w.V, into: U1_SALSA, recordings: false },
				cloneFiles,
				T
			);
			if (!mine.ok) return null;
			updateVariation(db, mine.id, { ...variation('Basic'), notes: 'Flowed' });
			const report = await flowFrom(db, 'u1', 'figure', mine.id, cloneFiles, T, GB);
			return report.landed.includes(w.V) ? report : null;
		}
	},
	// clones/sync.ts: Sync from u1's own copy lands her notes on the group's figure
	// (landKeys logs it, as the actor: one change; her own copy logs nothing)
	{
		name: 'syncAll',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		teamOnly: true,
		run: async (w) => {
			const mine = await cloneInto(
				db,
				{ kind: 'figure', id: w.V, into: U1_SALSA, recordings: false },
				cloneFiles,
				T
			);
			if (!mine.ok) return null;
			updateVariation(db, mine.id, { ...variation('Basic'), notes: 'Synced' });
			const view = syncView(db, 'u1', 'figure', mine.id);
			if (!view || view.targets.length !== 2) return null;
			const res = await syncAll(
				db,
				'u1',
				'figure',
				mine.id,
				{},
				view.targets.map((t) => ({ id: t.id, seen: t.seen })),
				view.members,
				cloneFiles,
				T,
				GB
			);
			return res.ok && res.refused.length === 0 ? res : null;
		}
	},
	// clones/detach.ts: a group's figure leaves its family (an ordinary edit: one change)
	{
		name: 'detach',
		root: 'figure',
		verb: 'change',
		rootId: (w) => w.G,
		teamOnly: true,
		run: async (w) => {
			const mine = await cloneInto(
				db,
				{ kind: 'figure', id: w.V, into: U1_SALSA, recordings: false },
				cloneFiles,
				T
			);
			if (!mine.ok) return null;
			return detach(db, 'u1', 'figure', w.V, T) || null;
		}
	},
	// clones/copy-to.ts: Copy to… group to group, a figure with no references (one add, in T1)
	{
		name: 'copyTo (group to group)',
		root: 'figure',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		prep: () => {
			// Rueda club (Maja's, T2), which Ana edits, holds the figure she copies into T1.
			createTeam(db, 'u3', 'salsa', 'Rueda club', 1);
			joinTeam(db, 'u1', 2, 1);
			setRole(db, 2, 'u1', 'editor');
			createFigure(db, T2_SALSA, { figureName: 'Rueda', ...variation('Dile que no') });
		},
		run: async () => {
			const from = db.select().from(figures).where(eq(figures.teamId, 2)).get()!.id;
			return ok(await copyTo(db, 'u1', 'figure', from, T1_SALSA, {}, cloneFiles, T, 100 * GB));
		}
	},
	// clones/move.ts: Move to… a lesson of Ana's own with nothing linked (one add, in T1)
	{
		name: 'moveLesson',
		root: 'lesson',
		verb: 'add',
		rootId: () => 0,
		teamOnly: true,
		run: async () => {
			const own = createLesson(db, U1_SALSA, {
				lessonDay: '2026-11-02',
				title: 'Mine',
				notes: null
			}).lesson.id;
			return ok(await moveLesson(db, U1_SALSA, own, 1, {}, {}, cloneFiles, T, 100 * GB));
		}
	},
	// video-downloads.ts, on completion
	{
		name: 'completeVideoJob',
		root: 'lesson',
		verb: 'add',
		rootId: (w) => w.lesson,
		prep: (w) => {
			const [l] = addLinks(
				db,
				{ lessonId: w.lesson },
				['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
				null,
				w.by
			)!;
			requestVideoDownload(db, { lessonId: w.lesson }, l.id, w.by);
		},
		run: () => {
			const job = claimVideoJob(db, 10)!;
			return completeVideoJob(
				db,
				job.id,
				{ file: 'y.mp4', mime: 'video/mp4', sizeBytes: 1 },
				100 * GB
			);
		}
	},
	// positions.ts
	{
		name: 'createPosition',
		root: 'position',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => createPosition(db, s, newPosition('Sombrero'), 5)
	},
	{
		name: 'updatePosition',
		root: 'position',
		verb: 'change',
		rootId: (w) => w.position,
		run: (w) => updatePosition(db, w.position, newPosition('Cerrada 2'), { actorId: w.by, now: 5 })
	},
	{
		name: 'archivePosition',
		root: 'position',
		verb: 'archive',
		rootId: (w) => w.position,
		run: (w) => archivePosition(db, w.position, 5, { actorId: w.by })
	},
	{
		name: 'restorePosition',
		root: 'position',
		verb: 'restore',
		rootId: (w) => w.position,
		prep: (w) => archivePosition(db, w.position, 4, { actorId: w.by }),
		run: (w) => restorePosition(db, w.position, 5, { actorId: w.by })
	},
	{
		name: 'addTemplates',
		root: 'position',
		verb: 'add',
		rootId: () => 0,
		run: (_, s) => addTemplates(db, s, 'salsa', 'salsa', ['Abierta (dos manos)'], 5)
	}
];

describe('every team mutation logs once; a person’s none', () => {
	it.each(MUTATIONS.map((m) => [m.name, m] as const))('%s', async (_, m) => {
		// A group's: exactly one row, filed under the right root, by who acted.
		const tw = world(T1_SALSA);
		m.prep?.(tw, T1_SALSA);
		const before = rows().map((r) => r.id);
		expect(await m.run(tw, T1_SALSA)).toBeTruthy();
		const added = rows().filter((r) => !before.includes(r.id));
		expect(added).toHaveLength(1);
		expect(added[0]).toMatchObject({ teamId: 1, rootKind: m.root, verb: m.verb, actorId: 'u1' });
		if (m.rootId(tw) !== 0) expect(added[0].rootId).toBe(m.rootId(tw));

		if (m.teamOnly) return;
		// A person's: nothing.
		fresh();
		const pw = world(U1_SALSA);
		m.prep?.(pw, U1_SALSA);
		expect(await m.run(pw, U1_SALSA)).toBeTruthy();
		expect(count()).toBe(0);
	});

	it("logs nothing for an import itself: creating, the worker's read, retry and dismiss change no content", () => {
		world(T1_SALSA);
		const before = count();
		const imp = createImport(
			db,
			T1_SALSA,
			{ url: 'https://www.youtube.com/playlist?list=PL1', kind: 'youtube-playlist' },
			T
		);
		claimImportJob(db, T);
		failImportJob(db, imp.id, 'Private playlist', true);
		retryImport(db, imp.id);
		storeImportItems(db, imp.id, {
			name: 'Clase',
			items: [{ title: 'Uno', artist: null, durationS: 200, url: 'https://youtu.be/x1' }],
			truncated: false
		});
		dismissImport(db, imp.id, T);
		expect(count()).toBe(before);
	});

	it('refuses a group change that names no one, writing nothing', () => {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		expect(() =>
			updateLesson(db, lesson, { lessonDay: '2026-11-01', title: 'D', notes: null })
		).toThrow(/needs who made it/);
		expect(getLessonRow(db, lesson)!.title).toBe('C');
	});
});

describe('merging nudges (risk 11)', () => {
	function section() {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		const video = addLessonVideo(
			db,
			{ lessonId: lesson, file: 'a.mp4', mime: 'v', sizeBytes: 1 },
			'u1'
		).id;
		const spot = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 10_000, endMs: 20_000, label: 'Enchufla doble' },
			'u1'
		)!.id;
		return { lesson, spot };
	}
	const nudges = (lesson: number) =>
		history(db, 1, 'lesson', lesson).filter((r) => r.verb === 'change');

	it('three nudges by Ana within 10 minutes are one row: the first before, the last after', () => {
		const { lesson, spot } = section();
		updateSpot(db, spot, { startMs: 10_100 }, 'u1', T);
		updateSpot(db, spot, { startMs: 10_200 }, 'u1', T + 4 * MIN);
		updateSpot(db, spot, { startMs: 11_200 }, 'u1', T + 8 * MIN);
		const [one, ...rest] = nudges(lesson);
		expect(rest).toHaveLength(0);
		expect(one.before).toMatchObject({ startMs: 10_000 });
		expect(one.after).toMatchObject({ startMs: 11_200 });
		expect(one.at).toBe(T + 8 * MIN);
	});

	it('a nudge by Luka in between gives separate rows', () => {
		const { lesson, spot } = section();
		updateSpot(db, spot, { startMs: 10_100 }, 'u1', T);
		updateSpot(db, spot, { startMs: 10_200 }, 'u2', T + MIN);
		updateSpot(db, spot, { startMs: 10_300 }, 'u1', T + 2 * MIN);
		expect(nudges(lesson).map((r) => r.actorId)).toEqual(['u1', 'u2', 'u1']);
	});

	it('a nudge after HISTORY_MERGE_MS starts a new row, and another field is its own', () => {
		const { lesson, spot } = section();
		updateSpot(db, spot, { startMs: 10_100 }, 'u1', T);
		updateSpot(db, spot, { startMs: 10_200 }, 'u1', T + HISTORY_MERGE_MS);
		expect(nudges(lesson)).toHaveLength(2);
		updateLesson(
			db,
			lesson,
			{ lessonDay: '2026-11-01', title: 'C', notes: 'x' },
			'u1',
			T + HISTORY_MERGE_MS + 1
		);
		expect(nudges(lesson)).toHaveLength(3);
	});

	it('logs nothing for a save that changed nothing', () => {
		const { lesson } = section();
		const n = count();
		updateLesson(db, lesson, { lessonDay: '2026-11-01', title: 'C', notes: null }, 'u1');
		expect(count()).toBe(n);
	});
});

describe('history, lastEdit and names', () => {
	it('reads newest first, and lastEdit is the newest', () => {
		const space = T1_SALSA;
		logChange(db, space, { rootKind: 'drill', rootId: 9, verb: 'add', subject: 'drill' }, 10);
		logChange(
			db,
			{ ...space, actorId: 'u2' },
			{ rootKind: 'drill', rootId: 9, verb: 'change', subject: 'notes' },
			20
		);
		logChange(db, space, { rootKind: 'drill', rootId: 8, verb: 'add', subject: 'drill' }, 30);
		expect(history(db, 1, 'drill', 9).map((r) => r.at)).toEqual([20, 10]);
		expect(lastEdit(db, 1, 'drill', 9)).toEqual({ actorId: 'u2', at: 20 });
		expect(lastEdit(db, 2, 'drill', 9)).toBeNull();
		expect(editedBy(db, 1, 'drill', 9)).toEqual({ by: 'Luka', at: 20 });
		expect(editedBy(db, null, 'drill', 9)).toEqual({ by: null, at: null });
	});

	it('names a former member from the users table, initials telling two Anas apart', async () => {
		await removeMember(db, 1, 'u2', NO_FILES, Date.now());
		const names = teamNames(db, 1, ['u2', 'u3']);
		expect(names.get('u2')).toBe('Luka');
		expect(names.get('u1')).toBe('Ana K.');
		expect(names.get('u3')).toBe('Ana Z.');
	});
});

describe('restoreChange', () => {
	function lessonWithNotes() {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: 'old' })
			.lesson.id;
		updateLesson(db, lesson, { lessonDay: '2026-11-01', title: 'C', notes: 'new' }, 'u1', T + 100);
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		return { lesson, change };
	}

	it('puts the text back and logs a restore', () => {
		const { lesson, change } = lessonWithNotes();
		expect(restoreChange(db, { ...T1_SALSA, actorId: 'u2' }, change.id, T + 200)).toEqual({
			ok: true
		});
		expect(getLessonRow(db, lesson)!.notes).toBe('old');
		expect(history(db, 1, 'lesson', lesson)[0]).toMatchObject({
			verb: 'restore',
			subject: 'notes',
			actorId: 'u2'
		});
	});

	it('is a clash after a later edit, naming who, and writes nothing', () => {
		const { lesson, change } = lessonWithNotes();
		updateLesson(
			db,
			lesson,
			{ lessonDay: '2026-11-01', title: 'C', notes: 'newer' },
			'u2',
			T + 150
		);
		const done = restoreChange(db, T1_SALSA, change.id, T + 200);
		expect(done).toMatchObject({ ok: false, reason: 'clash', changed: ['notes'], by: 'Luka' });
		expect(getLessonRow(db, lesson)!.notes).toBe('newer');
	});

	it('moves a section back', () => {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		const video = addLessonVideo(
			db,
			{ lessonId: lesson, file: 'a.mp4', mime: 'v', sizeBytes: 1 },
			'u1'
		).id;
		const spot = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 1000, endMs: 2000, label: 'S' },
			'u1'
		)!.id;
		updateSpot(db, spot, { startMs: 1500 }, 'u1', T + 100);
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		expect(restoreChange(db, T1_SALSA, change.id, T + 200)).toEqual({ ok: true });
		expect(updateSpot(db, spot, {}, 'u1')!.startMs).toBe(1000);
	});

	it('refuses another group’s row and anything but a change of text or times', () => {
		const { lesson } = lessonWithNotes();
		const add = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'add')!;
		expect(restoreChange(db, T1_SALSA, add.id, T + 200)).toEqual({
			ok: false,
			reason: 'not-restorable'
		});
		expect(restoreChange(db, { ...T1_SALSA, teamId: 2 }, add.id, T + 200)).toEqual({
			ok: false,
			reason: 'not-found'
		});
	});
});

describe('archivedTarget', () => {
	it('names who archived a group drill, routine or variation', () => {
		const drill = createCustomExercise(db, T1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		archiveExercise(db, drill, 5, 'u2');
		expect(archivedTarget(db, T1_SALSA, { exerciseId: drill })).toEqual({
			by: 'Luka',
			message: 'Archived by Luka'
		});
		const fig = createFigure(db, T1_SALSA, { figureName: 'E', ...variation('B') })!;
		archiveVariation(db, fig.figure.id, 5, 'u1');
		expect(archivedTarget(db, T1_SALSA, { figureId: fig.figure.id })?.message).toBe(
			'Archived by Ana'
		);
		const live = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		expect(archivedTarget(db, T1_SALSA, { routineId: live })).toBeNull();
		// A person's own things keep their own refusal.
		expect(archivedTarget(db, U1_SALSA, { exerciseId: drill })).toBeNull();
		// A position: who archived it; a live one and a person's own name nobody.
		const p = (createPosition(db, T1_SALSA, newPosition('Hammerlock'), 1) as PositionRow).id;
		expect(archivedTarget(db, T1_SALSA, { positionId: p })).toBeNull();
		archivePosition(db, p, 5, { actorId: 'u2' });
		expect(archivedTarget(db, T1_SALSA, { positionId: p })).toEqual({
			by: 'Luka',
			message: 'Archived by Luka'
		});
		const own = (createPosition(db, U1_SALSA, newPosition('Own'), 1) as PositionRow).id;
		archivePosition(db, own, 5);
		expect(archivedTarget(db, U1_SALSA, { positionId: own })).toBeNull();
	});
});

describe('a position’s History', () => {
	it('belongs to its own group only', () => {
		const mine = createPosition(db, T1_SALSA, newPosition('Cerrada'), 1) as PositionRow;
		const own = createPosition(db, U1_SALSA, newPosition('Own'), 1) as PositionRow;
		createTeam(db, 'u1', 'salsa', 'Other', 2);
		const other = createPosition(db, T2_SALSA, newPosition('Other'), 1) as PositionRow;
		expect(rootInTeam(db, 1, 'position', mine.id)).toBe(true);
		expect(rootInTeam(db, 1, 'position', own.id)).toBe(false);
		expect(rootInTeam(db, 1, 'position', other.id)).toBe(false);
		expect(rootInTeam(db, 1, 'position', 9999)).toBe(false);
		// An archived position still has its History (Recently deleted links to it).
		archivePosition(db, mine.id, 5, { actorId: 'u1' });
		expect(rootInTeam(db, 1, 'position', mine.id)).toBe(true);
		// A lesson's id is not a position's.
		expect(rootInTeam(db, 2, 'position', mine.id)).toBe(false);
	});

	it('puts a name or notes back, as the clash check allows, and logs a restore', () => {
		const p = createPosition(db, T1_SALSA, newPosition('Cerrada'), 1) as PositionRow;
		updatePosition(db, p.id, newPosition('Closed'), {
			actorId: 'u2',
			now: T + 100
		});
		const change = history(db, 1, 'position', p.id).find((r) => r.verb === 'change')!;
		expect(change.subject).toBe('name');
		expect(restoreChange(db, T1_SALSA, change.id, T + 200)).toEqual({ ok: true });
		expect(db.select().from(positionsTable).where(eq(positionsTable.id, p.id)).get()!.name).toBe(
			'Cerrada'
		);
		expect(history(db, 1, 'position', p.id)[0]).toMatchObject({ verb: 'restore', subject: 'name' });
		// Changed since: a clash, nothing written.
		updatePosition(db, p.id, newPosition('Third'), { actorId: 'u1', now: T + 300 });
		const again = history(db, 1, 'position', p.id).find(
			(r) => r.verb === 'change' && r.subject === 'name' && r.after?.name === 'Third'
		)!;
		updatePosition(db, p.id, newPosition('Fourth'), { actorId: 'u2', now: T + 400 });
		expect(restoreChange(db, T1_SALSA, again.id, T + 500)).toMatchObject({
			ok: false,
			reason: 'clash'
		});
		expect(db.select().from(positionsTable).where(eq(positionsTable.id, p.id)).get()!.name).toBe(
			'Fourth'
		);
	});

	it('does not restore a hold change or another group’s position', () => {
		const p = createPosition(db, T1_SALSA, newPosition('Cerrada'), 1) as PositionRow;
		updatePosition(
			db,
			p.id,
			{
				...newPosition('Cerrada'),
				hold: { hands: 'one', crossed: null, facing: 'face', frame: 'closed' }
			},
			{ actorId: 'u1', now: T + 100 }
		);
		const change = history(db, 1, 'position', p.id).find((r) => r.verb === 'change')!;
		expect(change.subject).toBe('hands');
		expect(restoreChange(db, T1_SALSA, change.id, T + 200)).toEqual({
			ok: false,
			reason: 'not-restorable'
		});
		expect(restoreChange(db, T2_SALSA, change.id, T + 200)).toEqual({
			ok: false,
			reason: 'not-found'
		});
	});
});

describe('a position link’s History', () => {
	it('names a point as a point, a section as a section, and the position as the target', () => {
		const w = world(T1_SALSA);
		const point = addSpot(
			db,
			{ lessonVideoId: w.video },
			{ startMs: 9000, endMs: null, label: null },
			'u1'
		)!.id;
		linkSpotToPosition(db, 'u1', point, w.position, 5);
		linkSpotToPosition(db, 'u1', w.section, w.position, 6);
		const links = history(db, 1, 'lesson', w.lesson).filter(
			(r) => r.subject === 'section-link' && r.verb === 'add'
		);
		const byTime = links.sort((a, b) => a.at - b.at);
		expect(byTime[0].after).toMatchObject({ name: 'Cerrada', point: 1 });
		expect(byTime[1].after?.point ?? null).toBeNull();
	});
});
