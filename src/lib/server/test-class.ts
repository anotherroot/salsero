/**
 * Specs only: a class with songs. "Salsa Tuesdays" (group 1, salsa) is Ana's
 * (u1), Luka (u2) edits it, Maja (u3) is a member; Nik (u4) is in no group.
 * Its drill sits in a published lesson Maja added, so she has an entry for
 * it. The group has a shared song and a draft; group 2, "Other", Eva's (u5),
 * has a shared song of its own. Every song is ready, with uuid file names so
 * the media route's name check lets them through.
 */
import type { Db } from './db';
import { users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { createCustomExercise } from './exercises';
import { createLesson, linkExercise, publishLesson } from './lessons';
import { addLesson, entryFor } from './entries';
import { createSongFromUpload, storeAnalysis } from './songs';
import { shareSong } from './song-share';
import type { TeamSpace } from './scope';

export const CLASS_T = 1_790_000_000_000;
/** Luka, the class's editor, in the class. */
export const CLASS_ED: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };
/** Eva, in her own group. */
export const OTHER_ED: TeamSpace = { teamId: 2, actorId: 'u5', dance: 'salsa' };

export const SHARED_FILE = '00000000-0000-4000-8000-0000000000c1.mp3';
export const DRAFT_FILE = '00000000-0000-4000-8000-0000000000c2.mp3';
export const OTHER_FILE = '00000000-0000-4000-8000-0000000000c3.mp3';

export type Class = {
	drill: number;
	lesson: number;
	/** Maja's entry for the drill. */
	entry: number;
	shared: number;
	draft: number;
	other: number;
};

/** A ready song in `space`, `sizeBytes` 1000, its beats 0.5 s apart. */
export function readyGroupSong(db: Db, space: TeamSpace, title: string, file: string): number {
	const id = createSongFromUpload(
		db,
		space,
		{ file, mime: 'audio/mpeg', title, style: 'salsa', sizeBytes: 1000 },
		CLASS_T
	).id;
	storeAnalysis(db, id, {
		beats: Array.from({ length: 160 }, (_, i) => 0.5 + i * 0.5),
		downbeats: [0.5],
		durationS: 90
	});
	return id;
}

export function makeClass(db: Db): Class {
	db.insert(users)
		.values(
			['Ana', 'Luka', 'Maja', 'Nik', 'Eva'].map((firstName, i) => ({
				id: `u${i + 1}`,
				email: `${firstName.toLowerCase()}@x.si`,
				passwordHash: 'x',
				firstName
			}))
		)
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
	createTeam(db, 'u5', 'salsa', 'Other', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');

	const drill = createCustomExercise(db, CLASS_ED, {
		name: 'Shines',
		everyDays: 3,
		notes: null
	}).id;
	const lesson = createLesson(db, CLASS_ED, {
		lessonDay: '2026-11-01',
		title: 'Class',
		notes: null
	}).lesson.id;
	linkExercise(db, lesson, drill, 'u2');
	publishLesson(db, CLASS_ED, lesson, CLASS_T);
	addLesson(
		db,
		'u3',
		lesson,
		{ lesson: false, routineIds: [], drillIds: [drill], figureIds: [] },
		CLASS_T
	);

	const shared = readyGroupSong(db, CLASS_ED, 'Chan Chan', SHARED_FILE);
	shareSong(db, CLASS_ED, shared, CLASS_T);
	const draft = readyGroupSong(db, CLASS_ED, 'Draft', DRAFT_FILE);
	const other = readyGroupSong(db, OTHER_ED, 'Elsewhere', OTHER_FILE);
	shareSong(db, OTHER_ED, other, CLASS_T);

	return {
		drill,
		lesson,
		entry: entryFor(db, 'u3', { drillId: drill })!.id,
		shared,
		draft,
		other
	};
}
