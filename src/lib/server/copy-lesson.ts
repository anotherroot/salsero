/**
 * Make my own copy: a group lesson, and what it holds, becomes the person's
 * own, to edit freely. See "Make my own copy" in
 * docs/superpowers/specs/2026-11-02-groups-design.md.
 *
 * A wrapper around the clone engine (`clones/clone.ts`), kept until Task 23
 * replaces it with Make it mine: the lesson is cloned into the person's own
 * app of its dance without recordings, so it is a member of the lesson's
 * family, and every figure, routine and drill it reaches by hand, through a
 * routine's slots or through a section is the person's member of that family
 * (one already there is reused, else a clone is made). Copying twice answers
 * the first copy. Moves still join by name (`moveFor`); a figure name taken
 * there gets the group's name ("Doble (Salsa nadaljevalna)").
 *
 * The person's practice entries stay on the group's lesson; a copied exercise
 * whose source they practise through a live entry starts paused, so Today is
 * not doubled. The videos are linked under new names and charged to the
 * person in full, like any upload.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { lessons, type Lesson } from './db/schema';
import { allows, lessonAccess } from './access';
import { restoreLesson } from './lessons';
import type { Wall } from './scope';
import type { Room } from './storage';
import { cloneInto, planClone, type CloneRequest } from './clones/clone';
import type { CloneFiles } from './clones/files';
import type { DanceSlug } from '$lib/dances/dances';
import type { CopySummary } from '$lib/types';

/** Where the files of one kind live and how one is linked under a new name (`linkCopy`). */
export type CopyFiles = {
	/** `lessonVideosDir()` or `audioDir()`; a temp folder in specs. */
	dir: string;
	/** The file under a new name in `dir`; returns the new name. */
	link(dir: string, file: string): Promise<string>;
};

export type CopyResult =
	{ ok: true; lessonId: number } | { ok: false; room: Extract<Room, { ok: false }> };

/**
 * `CopyFiles` as the engine's `CloneFiles`, for the one kind of file this
 * copy links (lesson videos, or a song's audio). Unlinks only names it made.
 */
export function cloneFilesOf(files: CopyFiles, kind: 'lesson-video' | 'audio'): CloneFiles {
	const made = new Set<string>();
	return {
		async link(k, file) {
			if (k !== kind) throw new Error(`This copy links no ${k} files`);
			const name = await files.link(files.dir, file);
			made.add(name);
			return name;
		},
		async unlink(k, file) {
			if (k !== kind || !made.has(file)) return;
			await unlink(join(files.dir, file)).catch(() => {});
		}
	};
}

/**
 * The group lesson this person may copy: one they can read, of a group. A
 * person's own lesson, an archived one and one they cannot read get the
 * missing lesson's 404.
 */
function copyable(db: Db, userId: string, lessonId: number): Lesson & { teamId: number } {
	const lesson = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (
		!lesson ||
		lesson.teamId === null ||
		lesson.archivedAt !== null ||
		!allows(lessonAccess(db, userId, lesson), 'read')
	) {
		throw error(404, 'No such lesson');
	}
	return lesson as Lesson & { teamId: number };
}

/** The clone a copy of this lesson is, into the person's own app of its dance. */
function requestFor(lesson: Lesson, userId: string): CloneRequest {
	const into: Wall = { userId, dance: lesson.dance as DanceSlug };
	return { kind: 'lesson', id: lesson.id, into, recordings: false };
}

/** What a copy is charged: the bytes of the files the clone would link. */
export function copyCost(db: Db, userId: string, lessonId: number): number {
	const lesson = copyable(db, userId, lessonId);
	return planClone(db, requestFor(lesson, userId)).bytes;
}

/**
 * `copyCost`, with how many videos, figures, routines and drills the copy
 * makes. Nothing once the person has their copy: copying again reuses it.
 */
export function copySummary(db: Db, userId: string, lessonId: number): CopySummary {
	const lesson = copyable(db, userId, lessonId);
	const plan = planClone(db, requestFor(lesson, userId));
	const count = (kind: string) => plan.rows.filter((r) => r.kind === kind).length;
	return {
		bytes: plan.bytes,
		videos: count('video'),
		variations: count('figure'),
		routines: count('routine'),
		drills: count('drill')
	};
}

/**
 * Copy a group lesson into this person's own space of its dance. Needs `read`
 * (a member, a former member who added it, an editor); a refusal is the
 * missing lesson's 404. Refused, writing nothing, when it does not fit the
 * person's room or would leave the disk under the floor. Copying twice
 * answers the first copy, restored (`restoreLesson`) when they had archived
 * it. A figure whose name is taken nine times over is a 409 with the
 * engine's words.
 */
export async function copyLesson(
	db: Db,
	userId: string,
	lessonId: number,
	now: number,
	files: CopyFiles,
	freeDiskBytes = Number.POSITIVE_INFINITY
): Promise<CopyResult> {
	const lesson = copyable(db, userId, lessonId);
	const res = await cloneInto(
		db,
		requestFor(lesson, userId),
		cloneFilesOf(files, 'lesson-video'),
		now,
		freeDiskBytes
	);
	if (res.ok && res.archived) {
		// The person archived their copy: bring it back, so Copy opens it.
		const back = restoreLesson(db, requestFor(lesson, userId).into, res.id, now);
		if (!back.ok) throw error(409, back.reason === 'taken' ? back.message : 'No such lesson');
		return { ok: true, lessonId: res.id };
	}
	if (res.ok) return { ok: true, lessonId: res.id };
	if (res.reason === 'room' && !res.room.ok) return { ok: false, room: res.room };
	if (res.reason === 'name') throw error(409, res.message);
	throw error(404, 'No such lesson');
}
