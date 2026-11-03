/**
 * Who may see or change a group's rows. One module, built on one derived set:
 * what a person reaches through the group's published lessons (`reach`).
 *
 * A person's own row is theirs to edit and nobody else's to see. A group's row
 * is editable by its editors and owner while the group lives; readable when it
 * is in the person's reach; otherwise it is not there at all (the routes answer
 * a missing row's 404). Reach is computed per call, never stored: like urgency,
 * it is a function of the rows.
 *
 * Imports only the schema, `teams.ts` and `lesson-links.ts`, so `scope.ts` and
 * the content modules can use it without an import cycle.
 */
import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonAdds,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	videoSpots
} from './db/schema';
import type { SpotOwner } from '$lib/types';
import { viaSections } from './lesson-links';
import { getTeam, roleOf } from './teams';

/** What a person can read of one group: ids, archived rows left out. */
export type Reach = {
	lessons: Set<number>;
	variations: Set<number>;
	figures: Set<number>;
	routines: Set<number>;
	drills: Set<number>;
	recordings: Set<number>;
};

export type Access = 'edit' | 'read' | null;

const RANK = { read: 1, edit: 2 } as const;

/** Whether `access` is at least `need`. */
export function allows(access: Access, need: 'read' | 'edit'): boolean {
	return access !== null && RANK[access] >= RANK[need];
}

const empty = (): Reach => ({
	lessons: new Set(),
	variations: new Set(),
	figures: new Set(),
	routines: new Set(),
	drills: new Set(),
	recordings: new Set()
});

/**
 * The group's lessons this person reads through membership: every published,
 * unarchived one for a member; the ones they added, for a former member or
 * once the group is deleted; nothing once it is purged.
 */
function lessonsReached(db: Db, userId: string, teamId: number): number[] {
	const team = getTeam(db, teamId);
	if (!team || team.purgedAt !== null) return [];
	const live = and(
		eq(lessons.teamId, teamId),
		isNotNull(lessons.publishedAt),
		isNull(lessons.archivedAt)
	);
	const member = team.deletedAt === null && roleOf(db, userId, teamId) !== null;
	if (member) {
		return db
			.select({ id: lessons.id })
			.from(lessons)
			.where(live)
			.all()
			.map((r) => r.id);
	}
	return db
		.select({ id: lessons.id })
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.where(and(eq(lessonAdds.userId, userId), live))
		.all()
		.map((r) => r.id);
}

/**
 * Everything these lessons contain, closed under "contains" (risk 7): the
 * variations linked by hand or through a section, and their figures and
 * recordings; the routines linked by hand, the routines embedded in those, and
 * every variation in their slots; the drills, by hand or through a section.
 * Only the group's own rows count, and archived ones drop out — an archived
 * routine takes what only it held with it.
 */
export function reachFrom(db: Db, teamId: number, lessonIds: number[]): Reach {
	const out = empty();
	if (lessonIds.length === 0) return out;
	for (const id of lessonIds) out.lessons.add(id);

	const variationIds = new Set<number>();
	const drillIds = new Set<number>();
	for (const r of db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(inArray(lessonFigures.lessonId, lessonIds))
		.all())
		variationIds.add(r.id);
	for (const r of db
		.select({ id: lessonExercises.exerciseId })
		.from(lessonExercises)
		.where(inArray(lessonExercises.lessonId, lessonIds))
		.all())
		drillIds.add(r.id);
	for (const id of lessonIds) {
		const via = viaSections(db, id);
		for (const f of via.figures.keys()) variationIds.add(f);
		for (const e of via.exercises.keys()) drillIds.add(e);
	}

	// Routines: the hand-linked ones, then whatever their slots embed, until
	// nothing new turns up (embedding is one level today; the loop does not care).
	const liveRoutines = (ids: number[]) =>
		ids.length === 0
			? []
			: db
					.select({ id: routines.id })
					.from(routines)
					.where(
						and(inArray(routines.id, ids), eq(routines.teamId, teamId), isNull(routines.archivedAt))
					)
					.all()
					.map((r) => r.id);
	let frontier = liveRoutines(
		db
			.select({ id: lessonRoutines.routineId })
			.from(lessonRoutines)
			.where(inArray(lessonRoutines.lessonId, lessonIds))
			.all()
			.map((r) => r.id)
	);
	while (frontier.length > 0) {
		for (const id of frontier) out.routines.add(id);
		const children = db
			.select({ id: routineSteps.childRoutineId })
			.from(routineSteps)
			.where(and(inArray(routineSteps.routineId, frontier), isNotNull(routineSteps.childRoutineId)))
			.all()
			.map((r) => r.id!)
			.filter((id) => !out.routines.has(id));
		frontier = liveRoutines([...new Set(children)]);
	}
	if (out.routines.size > 0) {
		for (const r of db
			.select({ id: routineStepOptions.figureId })
			.from(routineStepOptions)
			.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
			.where(inArray(routineSteps.routineId, [...out.routines]))
			.all())
			variationIds.add(r.id);
	}

	if (variationIds.size > 0) {
		const live = db
			.select({ id: figures.id, groupId: figures.groupId })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(
				and(
					inArray(figures.id, [...variationIds]),
					eq(figures.teamId, teamId),
					isNull(figures.archivedAt),
					isNull(figureGroups.archivedAt)
				)
			)
			.all();
		for (const v of live) {
			out.variations.add(v.id);
			out.figures.add(v.groupId!);
		}
	}
	if (out.variations.size > 0) {
		for (const r of db
			.select({ id: recordings.id })
			.from(recordings)
			.where(inArray(recordings.figureId, [...out.variations]))
			.all())
			out.recordings.add(r.id);
	}
	if (drillIds.size > 0) {
		for (const r of db
			.select({ id: exercises.id })
			.from(exercises)
			.where(
				and(
					inArray(exercises.id, [...drillIds]),
					eq(exercises.teamId, teamId),
					eq(exercises.source, 'custom'),
					isNull(exercises.archivedAt)
				)
			)
			.all())
			out.drills.add(r.id);
	}
	return out;
}

/** What this person reads of this group through its published lessons. */
export function reach(db: Db, userId: string, teamId: number): Reach {
	return reachFrom(db, teamId, lessonsReached(db, userId, teamId));
}

type Owned = { userId: string | null; teamId: number | null };

/**
 * A row's access, given how to find it in a reach. Editors and the owner edit
 * everything the group owns while it lives; once it is deleted the owner only
 * reads; anyone else reads what is in their reach. A purged group gives
 * nothing to anyone. A row with two owners is no one's (`ownerIntegrity`
 * reports it).
 */
function rowAccess(db: Db, userId: string, row: Owned, inReach: (r: Reach) => boolean): Access {
	if (row.teamId === null) return row.userId !== null && row.userId === userId ? 'edit' : null;
	if (row.userId !== null) return null;
	const team = getTeam(db, row.teamId);
	if (!team || team.purgedAt !== null) return null;
	const role = roleOf(db, userId, row.teamId);
	if (team.deletedAt === null && (role === 'editor' || role === 'owner')) return 'edit';
	if (team.deletedAt !== null && role === 'owner') return 'read';
	return inReach(reach(db, userId, row.teamId)) ? 'read' : null;
}

/** A lesson: an editor's drafts included; a member's only once published and in reach. */
export function lessonAccess(db: Db, userId: string, lesson: Owned & { id: number }): Access {
	return rowAccess(db, userId, lesson, (r) => r.lessons.has(lesson.id));
}

/** A variation (a `figures` row). */
export function figureAccess(db: Db, userId: string, figure: Owned & { id: number }): Access {
	return rowAccess(db, userId, figure, (r) => r.variations.has(figure.id));
}

/** A figure (a `figure_groups` row): in reach when one of its variations is. */
export function figureGroupAccess(db: Db, userId: string, group: Owned & { id: number }): Access {
	return rowAccess(db, userId, group, (r) => r.figures.has(group.id));
}

export function routineAccess(db: Db, userId: string, routine: Owned & { id: number }): Access {
	return rowAccess(db, userId, routine, (r) => r.routines.has(routine.id));
}

/**
 * An exercise row. A person's own (a drill, an entry, any source) is theirs to
 * edit; a group's (only ever a drill) follows the group's rules.
 */
export function drillAccess(db: Db, userId: string, exercise: Owned & { id: number }): Access {
	return rowAccess(db, userId, exercise, (r) => r.drills.has(exercise.id));
}

/** A recording: its variation's owner, and in reach when its variation is. */
export function recordingAccess(
	db: Db,
	userId: string,
	recording: { id: number; figureId: number }
): Access {
	const figure = db
		.select({ userId: figures.userId, teamId: figures.teamId })
		.from(figures)
		.where(eq(figures.id, recording.figureId))
		.get();
	if (!figure) return null;
	return rowAccess(db, userId, figure, (r) => r.recordings.has(recording.id));
}

/** A lesson video: exactly its lesson's access. */
export function lessonVideoAccess(db: Db, userId: string, video: { lessonId: number }): Access {
	const lesson = db
		.select({ id: lessons.id, userId: lessons.userId, teamId: lessons.teamId })
		.from(lessons)
		.where(eq(lessons.id, video.lessonId))
		.get();
	return lesson ? lessonAccess(db, userId, lesson) : null;
}

/** A video named by its spot owner (a recording or a lesson video); null for a missing one. */
export function videoAccess(db: Db, userId: string, video: SpotOwner): Access {
	if ('recordingId' in video) {
		const rec = db
			.select({ id: recordings.id, figureId: recordings.figureId })
			.from(recordings)
			.where(eq(recordings.id, video.recordingId))
			.get();
		return rec ? recordingAccess(db, userId, rec) : null;
	}
	const lv = db
		.select({ lessonId: lessonVideos.lessonId })
		.from(lessonVideos)
		.where(eq(lessonVideos.id, video.lessonVideoId))
		.get();
	return lv ? lessonVideoAccess(db, userId, lv) : null;
}

/** A spot (a point or a section): exactly its video's access. Null for a missing one. */
export function spotAccess(db: Db, userId: string, spotId: number): Access {
	const spot = db
		.select({ recordingId: videoSpots.recordingId, lessonVideoId: videoSpots.lessonVideoId })
		.from(videoSpots)
		.where(eq(videoSpots.id, spotId))
		.get();
	if (!spot) return null;
	return videoAccess(
		db,
		userId,
		spot.lessonVideoId !== null
			? { lessonVideoId: spot.lessonVideoId }
			: { recordingId: spot.recordingId! }
	);
}
/**
 * A media file this person may read, or a 404 — a missing file and a
 * forbidden one get the same answer. Used by the two media servers.
 */
export function fileAccess(
	db: Db,
	userId: string,
	kind: 'lesson-video' | 'recording',
	file: string
): { file: string; mime: string } {
	if (kind === 'lesson-video') {
		const video = db.select().from(lessonVideos).where(eq(lessonVideos.file, file)).get();
		if (video && allows(lessonVideoAccess(db, userId, video), 'read')) return video;
	} else {
		const rec = db.select().from(recordings).where(eq(recordings.file, file)).get();
		if (rec && allows(recordingAccess(db, userId, rec), 'read')) return rec;
	}
	throw error(404, 'Not found');
}
