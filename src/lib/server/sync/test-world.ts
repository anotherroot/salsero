/**
 * Specs only: one world for the device's copy (offline phase 2), built on
 * `makeClass` through the data functions. Ana (u1) owns group 1, Luka (u2)
 * edits it, Maja (u3) is a member with an added lesson, Nik (u4) is in no
 * group, Eva (u5) has group 2.
 *
 * On top of the class:
 * - u1 and u4 each have their own move with a figure, a recording, a section
 *   on it linked to the figure, a position tagging the figure, a routine with a
 *   step, a lesson with a video, a section on it, a YouTube link with a save
 *   in flight, a song link and a position link, a set on the lesson's
 *   exercise, a twin, a today pick, a default style, a count take and Keep in
 *   step on the figure;
 * - group 1 has a published lesson holding a figure (a recording and a
 *   section on it), a routine and a drill, with a position tagged on the
 *   figure, a comment with a heart and a deleted comment, Music (the class
 *   song, and a song unshared after Maja practised to it); a draft lesson
 *   holding a figure, a position and a video of its own; an archived lesson
 *   holding a figure of its own;
 * - group 2 has a published lesson with a figure;
 * - Maja opened the published lesson.
 *
 * Tasks 3 and 4 reuse it. Every setup step that can refuse is checked, or
 * the assertions after it would be hollow.
 */
import type { Db } from '../db';
import { makeClass, CLASS_ED, CLASS_T, OTHER_ED, type Class } from '../test-class';
import type { Space, TeamSpace, Wall } from '../scope';
import { addRecording, createFigure } from '../figures';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { linkSpotToPosition } from '../position-links';
import { addFigureSlot, createRoutine } from '../routines';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	linkExercise,
	linkFigure,
	linkPosition,
	linkRoutine,
	publishLesson
} from '../lessons';
import { addLinks } from '../links';
import { requestVideoDownload } from '../video-downloads';
import { addMusic } from '../song-links';
import { createCustomExercise, logSet, setPracticeSettings } from '../exercises';
import { shareSong, unshareSong } from '../song-share';
import { defaultPracticeConfig } from '$lib/exercises/practice';
import { DANCES } from '$lib/dances/dances';
import { markTwins } from '../twins';
import { addPicks } from '../today-picks';
import { setDefaultStyle } from '../default-styles';
import { putCountTake } from '../countTakes';
import { setSyncSettings } from '../clones/sync-settings';
import { setFigureShape } from '../graph';
import { addPosition } from '../test-positions';
import { createSongFromUpload, storeAnalysis } from '../songs';
import { deleteComment, postComment, toggleHeart } from '../comments';
import { recordOpen } from '../whats-new';

export const WORLD_T = CLASS_T + 1000;
export const WORLD_DAY = '2026-11-08';

/** What one person (u1 or u4) owns. */
export type Own = {
	move: number;
	figure: number;
	/** A second figure in its own move, twinned with `figure`. */
	twin: number;
	recording: number;
	/** A section on the recording, linked to `figure`. */
	spot: number;
	spotLink: number;
	position: number;
	spotPositionLink: number;
	routine: number;
	step: number;
	lesson: number;
	/** The lesson's own exercise, with one set and a today pick. */
	exercise: number;
	video: number;
	videoSpot: number;
	link: number;
	song: number;
	songLink: number;
	set: number;
	pick: number;
};

export type World = Class & {
	own: { u1: Own; u4: Own };
	group: {
		published: number;
		move: number;
		figure: number;
		recording: number;
		spot: number;
		routine: number;
		step: number;
		drill: number;
		position: number;
		comment: number;
		deletedComment: number;
		/** The class song in the published lesson's Music. */
		sharedLink: number;
		/** A song Maja practised to, then unshared: a drop on her entry, a link she cannot play. */
		withdrawn: number;
		withdrawnLink: number;
		draft: number;
		draftFigure: number;
		draftPosition: number;
		draftVideo: number;
		draftSpot: number;
		archived: number;
		archivedFigure: number;
	};
	otherGroup: { lesson: number; figure: number };
};

function must<T>(made: T | null | undefined | false, what: string): T {
	if (made === null || made === undefined || made === false) {
		throw new Error(`test world: ${what} refused`);
	}
	return made;
}

const SHAPE = { startCount: 1, lengthCounts: 8 };

function figureIn(db: Db, space: Space, figureName: string) {
	return must(
		createFigure(db, space, {
			figureName,
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		}),
		`figure ${figureName}`
	);
}

function readySong(db: Db, space: Space, title: string, file: string): number {
	const id = createSongFromUpload(
		db,
		space,
		{ file, mime: 'audio/mpeg', title, style: 'salsa', sizeBytes: 1000 },
		WORLD_T
	).id;
	storeAnalysis(db, id, {
		beats: Array.from({ length: 160 }, (_, i) => 0.5 + i * 0.5),
		downbeats: [0.5],
		durationS: 90
	});
	return id;
}

function lessonIn(db: Db, space: Space, title: string) {
	return createLesson(db, space, { lessonDay: '2026-11-02', title, notes: null });
}

function ownRows(db: Db, userId: 'u1' | 'u4', n: number): Own {
	const wall: Wall = { userId, dance: 'salsa' };
	const made = figureIn(db, wall, `Enchufla ${userId}`);
	const figure = made.figure.id;
	const twin = figureIn(db, wall, `Enchufla ${userId} again`).figure.id;
	must(markTwins(db, wall, 'figure', [figure, twin]), 'twin');

	const recording = addRecording(db, {
		figureId: figure,
		file: `0000000${n}-0000-4000-8000-00000000a001.mp4`,
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
	const spot = must(
		addSpot(db, { recordingId: recording }, { startMs: 0, endMs: 1000, label: 'Turn' }),
		'recording section'
	).id;
	const spotLink = linkInSpace(db, wall, spot, { figureId: figure });

	const position = addPosition(db, wall, `Cerrada ${userId}`);
	must(setFigureShape(db, figure, { startIds: [position], endIds: [position], ...SHAPE }), 'tag');
	const spotPositionLink = linkSpotToPosition(db, userId, spot, position, WORLD_T);

	const routine = createRoutine(db, wall, { name: `Routine ${userId}`, notes: null }).routine.id;
	const step = must(addFigureSlot(db, routine, figure), 'slot');

	const { lesson, exercise } = createLesson(db, wall, {
		lessonDay: '2026-11-02',
		title: `Lesson ${userId}`,
		notes: null
	});
	must(linkPosition(db, lesson.id, position), 'lesson position');
	const video = addLessonVideo(db, {
		lessonId: lesson.id,
		file: `0000000${n}-0000-4000-8000-00000000b001.mp4`,
		mime: 'video/mp4',
		sizeBytes: 10
	}).id;
	const videoSpot = must(
		addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 2000, label: 'Part' }),
		'video section'
	).id;
	const link = must(
		addLinks(db, { lessonId: lesson.id }, [`https://www.youtube.com/watch?v=abcdefghij${n}`], null),
		'link'
	)[0].id;
	if (requestVideoDownload(db, { lessonId: lesson.id }, link) !== 'ok') {
		throw new Error('test world: video download refused');
	}
	const song = readySong(db, wall, `Song ${userId}`, `0000000${n}-0000-4000-8000-00000000c001.mp3`);
	const music = addMusic(db, wall, { lessonId: lesson.id }, song, 'Slow', WORLD_T);
	if (!music.ok) throw new Error(`test world: music refused: ${music.message}`);

	const set = logSet(db, {
		exerciseId: exercise.id,
		doneAt: WORLD_T,
		durationS: 60,
		reps: null,
		rating: 3,
		note: null,
		playerJson: null
	}).id;
	const pick = addPicks(db, wall, [exercise.id], WORLD_DAY, 'add', WORLD_T).created[0];
	setDefaultStyle(db, userId, 'salsa', 'son');
	putCountTake(db, userId, {
		pattern: 'salsa',
		bpm: 120,
		phrase: 'a',
		file: `${userId}-take.wav`,
		sampleRate: 44100,
		preRollS: 0.1,
		lengthS: 1,
		durationS: 1.5,
		sizeBytes: 10
	});
	must(
		setSyncSettings(
			db,
			userId,
			'figure',
			figure,
			{ on: true, names: true, small: true, sections: false, media: false },
			WORLD_T
		),
		'keep in step'
	);

	return {
		move: made.group.id,
		figure,
		twin,
		recording,
		spot,
		spotLink,
		position,
		spotPositionLink,
		routine,
		step,
		lesson: lesson.id,
		exercise: exercise.id,
		video,
		videoSpot,
		link,
		song,
		songLink: music.id,
		set,
		pick: must(pick, 'pick')
	};
}

function groupRows(db: Db, c: Class): World['group'] {
	const ed: TeamSpace = CLASS_ED;
	const by = ed.actorId;

	const made = figureIn(db, ed, 'Group Enchufla');
	const figure = made.figure.id;
	const recording = addRecording(
		db,
		{
			figureId: figure,
			file: '00000000-0000-4000-8000-000000000d01.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		},
		by
	).id;
	const spot = must(
		addSpot(db, { recordingId: recording }, { startMs: 0, endMs: 1000, label: 'Class turn' }, by),
		'group section'
	).id;
	const position = addPosition(db, ed, 'Group Cerrada');
	must(
		setFigureShape(db, figure, { startIds: [position], endIds: [position], ...SHAPE }, by),
		'group tag'
	);
	const routine = createRoutine(db, ed, { name: 'Group routine', notes: null }).routine.id;
	const step = must(addFigureSlot(db, routine, figure, by), 'group slot');
	const drill = createCustomExercise(db, ed, { name: 'Group drill', everyDays: 3, notes: null }).id;

	const published = lessonIn(db, ed, 'Published').lesson.id;
	must(linkFigure(db, published, figure, by), 'link figure');
	must(linkRoutine(db, published, routine, by), 'link routine');
	must(linkExercise(db, published, drill, by), 'link drill');
	must(publishLesson(db, ed, published, WORLD_T), 'publish');

	const posted = postComment(db, 'u3', published, 'Lovely class', null, WORLD_T);
	if (!('id' in posted)) throw new Error(`test world: comment refused: ${posted.message}`);
	must(toggleHeart(db, 'u1', posted.id, WORLD_T), 'heart');
	const gone = postComment(db, 'u3', published, 'Said too much', null, WORLD_T);
	if (!('id' in gone)) throw new Error(`test world: comment refused: ${gone.message}`);
	must(deleteComment(db, 'u3', gone.id, WORLD_T), 'delete comment');
	recordOpen(db, 'u3', 'lesson', published, WORLD_T);

	// Music: the class song, and one unshared after Maja practised to it, so
	// her entry keeps a drop and the lesson a link to a song she cannot play.
	const music = (songId: number) => {
		const added = addMusic(db, ed, { lessonId: published }, songId, null, WORLD_T);
		if (!added.ok) throw new Error(`test world: music refused: ${added.message}`);
		return added.id;
	};
	const sharedLink = music(c.shared);
	const withdrawn = readySong(db, ed, 'Withdrawn', '00000000-0000-4000-8000-000000000f01.mp3');
	must(shareSong(db, ed, withdrawn, WORLD_T), 'share withdrawn');
	const withdrawnLink = music(withdrawn);
	must(
		setPracticeSettings(db, c.entry, {
			mode: 'song',
			songId: withdrawn,
			countBpm: null,
			config: defaultPracticeConfig(DANCES.salsa)
		}),
		'practise to withdrawn'
	);
	must(unshareSong(db, ed, withdrawn, WORLD_T), 'unshare withdrawn');

	const draft = lessonIn(db, ed, 'Draft').lesson.id;
	const draftFigure = figureIn(db, ed, 'Draft figure').figure.id;
	must(linkFigure(db, draft, draftFigure, by), 'draft figure');
	const draftPosition = addPosition(db, ed, 'Draft position');
	must(linkPosition(db, draft, draftPosition, by), 'draft position');
	const draftVideo = addLessonVideo(
		db,
		{
			lessonId: draft,
			file: '00000000-0000-4000-8000-000000000e01.mp4',
			mime: 'video/mp4',
			sizeBytes: 10
		},
		by
	).id;
	const draftSpot = must(
		addSpot(db, { lessonVideoId: draftVideo }, { startMs: 0, endMs: 1000, label: 'Draft' }, by),
		'draft section'
	).id;

	const archived = lessonIn(db, ed, 'Archived').lesson.id;
	const archivedFigure = figureIn(db, ed, 'Archived figure').figure.id;
	must(linkFigure(db, archived, archivedFigure, by), 'archived figure');
	must(publishLesson(db, ed, archived, WORLD_T), 'publish archived');
	must(archiveLesson(db, archived, WORLD_T, by), 'archive');

	return {
		published,
		move: made.group.id,
		figure,
		recording,
		spot,
		routine,
		step,
		drill,
		position,
		comment: posted.id,
		deletedComment: gone.id,
		sharedLink,
		withdrawn,
		withdrawnLink,
		draft,
		draftFigure,
		draftPosition,
		draftVideo,
		draftSpot,
		archived,
		archivedFigure
	};
}

export function makeWorld(db: Db): World {
	const c = makeClass(db);
	const own = { u1: ownRows(db, 'u1', 1), u4: ownRows(db, 'u4', 4) };
	const group = groupRows(db, c);

	const lesson = lessonIn(db, OTHER_ED, 'Elsewhere').lesson.id;
	const figure = figureIn(db, OTHER_ED, 'Other figure').figure.id;
	must(linkFigure(db, lesson, figure, OTHER_ED.actorId), 'other figure');
	must(publishLesson(db, OTHER_ED, lesson, WORLD_T), 'publish other');

	return { ...c, own, group, otherGroup: { lesson, figure } };
}
