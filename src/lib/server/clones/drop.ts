/**
 * Drop my copy (board C5, the spec's point 7): the person's own member of a
 * family goes, and they are back on a version they can still read: a group's
 * member of the same family. Everything of theirs that used their copy (their
 * routines' slots and embeds, their figures' position tags, their lessons'
 * links, their section links, their practice, their twin row, the group
 * lesson's add) is re-pointed onto it in the same transaction (`repoint`),
 * and the copy is archived with its kind's own archive, never deleted.
 *
 * Practice follows only where it may (R8): an entry on a group's figure,
 * routine or drill needs a lesson the person added that holds it. Where none
 * does, the practice stays with the archived copy, history intact, unless
 * the person asks Drop to add that group's newest published lesson holding
 * it ("Add Week 2 too"). A group's lesson is added by the drop itself
 * (`repoint`'s `addLesson`), so a published one always takes the practice;
 * a group's song takes the person's picks while they may practise to it.
 * A copy with no live practice has nothing to carry, so no lesson is offered.
 *
 * A song is the person's own: Drop archives it as the song page's Archive
 * does (`archiveSong`). A person's song has no restore, so Edit on the
 * class's song afterwards is refused with what to do (`ARCHIVED_SONG_COPY`).
 */
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { CloneKind, DropChoice, DropOptions } from '$lib/types';
import { changedLabels, DROP_GONE } from '$lib/clones/view';
import type { Db } from '../db';
import { exercises, lessons, songs } from '../db/schema';
import {
	addedLessonIds,
	addedReach,
	lessonAccess,
	practiceSong,
	reachFrom,
	type Reach
} from '../access';
import { addLesson } from '../entries';
import { archiveVariation } from '../figures';
import { archiveRoutine } from '../routines';
import { archiveExercise } from '../exercises';
import { archiveLesson } from '../lessons';
import { archiveSong } from '../songs';
import { archivePosition } from '../positions';
import { getTeam } from '../teams';
import { ownedBy, type Wall } from '../scope';
import { visibleMembers } from './genes';
import { compareWith } from './compare';
import { rowOf } from './edit';
import { repoint } from './repoint';
import { ENTRY, keepNestedEmbeds } from './rescue';

export type DropResult = { ok: true; toId: number } | { ok: false; message: string };

const NO_PICKS = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

/** Which of a reach's sets an entry on a group row of the kind is valid by (R8). */
const REACH: Partial<Record<CloneKind, keyof Reach>> = {
	figure: 'variations',
	routine: 'routines',
	drill: 'drills',
	position: 'positions'
};

/**
 * The group's newest published, live lesson the person reads that holds
 * `id` (by hand, through a section, or a routine's slot or embed), or null.
 */
function lessonHolding(
	db: Db,
	userId: string,
	kind: CloneKind,
	teamId: number,
	id: number
): { id: number; title: string } | null {
	const set = REACH[kind];
	if (!set) return null;
	const list = db
		.select()
		.from(lessons)
		.where(
			and(eq(lessons.teamId, teamId), isNotNull(lessons.publishedAt), isNull(lessons.archivedAt))
		)
		.orderBy(desc(lessons.publishedAt), desc(lessons.id))
		.all();
	for (const lesson of list) {
		if (lessonAccess(db, userId, lesson) === null) continue;
		if (reachFrom(db, teamId, [lesson.id])[set].has(id))
			return { id: lesson.id, title: lesson.title };
	}
	return null;
}

/** Whether the person's practice may sit on this group row as it is (R8; a lesson: the drop adds it). */
function practiceMayFollow(
	db: Db,
	userId: string,
	kind: CloneKind,
	teamId: number,
	id: number
): boolean {
	switch (kind) {
		case 'lesson': {
			if (addedLessonIds(db, userId, teamId).includes(id)) return true;
			const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
			return !!lesson && lesson.publishedAt !== null && lesson.archivedAt === null;
		}
		case 'song': {
			const song = db.select().from(songs).where(eq(songs.id, id)).get();
			return !!song && practiceSong(db, userId, song);
		}
		case 'position':
			// A position has no practice to carry.
			return false;
		default:
			return addedReach(db, userId, teamId)[REACH[kind]!].has(id);
	}
}

/**
 * Whether the person's copy has live practice to carry: an entry on it (a
 * figure's, routine's or lesson's), a song picked by a live exercise. A drill
 * always has: it is its own exercise.
 */
function hasPractice(db: Db, wall: Wall, kind: CloneKind, id: number): boolean {
	if (kind === 'position') return false; // A position is practised through its figures, never itself.
	if (kind === 'drill') return true;
	const col = kind === 'song' ? exercises.songId : ENTRY[kind];
	return (
		db
			.select({ id: exercises.id })
			.from(exercises)
			.where(and(ownedBy(exercises, wall), eq(col, id), isNull(exercises.archivedAt)))
			.get() !== undefined
	);
}

/**
 * The versions the person's live own row `id` can drop to: the other live
 * members of its family they read, in a group that is not deleted (one about
 * to be purged is no place to go back to). The one it was copied from first,
 * then by group name. Null when `id` is not the person's live own row of the
 * wall's dance, or no such version is left.
 */
function choicesOf(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number,
	withDiffs: boolean
): DropChoice[] | null {
	const row = rowOf(db, kind, id);
	if (!row || row.teamId !== null || row.archivedAt !== null || row.dance !== wall.dance)
		return null;
	const members = visibleMembers(db, wall.userId, kind, id);
	const self = members.find((m) => m.id === id);
	if (!self || self.place.kind !== 'mine' || self.access !== 'edit') return null;
	const practised = hasPractice(db, wall, kind, id);
	const choices: DropChoice[] = [];
	for (const m of members) {
		if (m.id === id || m.archived || m.place.kind !== 'team') continue;
		const teamId = m.place.teamId;
		if (getTeam(db, teamId)?.deletedAt !== null) continue;
		// Nothing to carry: nothing for a lesson to be added for.
		const practiceFollows = !practised || practiceMayFollow(db, wall.userId, kind, teamId, m.id);
		const onlyInMine = withDiffs
			? changedLabels(
					(compareWith(db, wall.userId, kind, id, m.id)?.diffs ?? []).filter(
						(d) => d.side !== 'theirs' && d.mine !== null
					)
				)
			: [];
		choices.push({
			id: m.id,
			place: m.place,
			label: rowOf(db, kind, m.id)?.title ?? '',
			access: m.access,
			clonedFrom: self.clonedFrom === m.id,
			practiceFollows,
			addLesson: practiceFollows ? null : lessonHolding(db, wall.userId, kind, teamId, m.id),
			onlyInMine
		});
	}
	if (choices.length === 0) return null;
	const name = (c: DropChoice) => (c.place.kind === 'team' ? c.place.name : '');
	return choices.sort(
		(a, b) =>
			Number(b.clonedFrom) - Number(a.clonedFrom) || name(a).localeCompare(name(b)) || a.id - b.id
	);
}

/**
 * What Drop my copy offers on the person's own row (board C5), reading only:
 * the versions they can go back to; the one preselected (the one theirs was
 * copied from while they read it, else the first by group name); what only
 * theirs has against it (labels of the fields theirs changed: they go with
 * the archived copy); and the choices they edit, which Send mine first can
 * write into. Null when `id` is not theirs, or no other version is readable:
 * Drop is not offered then.
 */
export function dropOptions(db: Db, wall: Wall, kind: CloneKind, id: number): DropOptions | null {
	const choices = choicesOf(db, wall, kind, id, true);
	if (!choices) return null;
	const first = choices[0];
	return {
		kind,
		choices,
		preselected: first.id,
		onlyInMine: first.onlyInMine,
		sendable: choices.filter((c) => c.access === 'edit').map((c) => c.id)
	};
}

/** The person's own row of the kind archived, with what its archive takes (its own practice). */
function archiveMine(tx: Db, kind: CloneKind, id: number, now: number): boolean {
	switch (kind) {
		case 'figure':
			return archiveVariation(tx, id, now) !== null;
		case 'routine':
			return archiveRoutine(tx, id, now);
		case 'drill':
			return archiveExercise(tx, id, now);
		case 'lesson':
			return archiveLesson(tx, id, now);
		case 'song':
			return archiveSong(tx, id, now);
		case 'position':
			return archivePosition(tx, id, now);
	}
}

/** A refusal inside the write: rolls everything back. */
class Gone extends Error {}

/**
 * Drop the person's own row `id` for the version `toId`, in one transaction:
 * the lesson added when asked (`addLessonId`, which must be the one the
 * choice offers: then practice follows); the person's rows and practice moved
 * onto `toId` (practice only when it can follow); the copy archived, with the
 * practice that could not follow. Refused, writing nothing, when `toId` is no
 * longer one of `dropOptions`' choices.
 */
export function dropCopy(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number,
	toId: number,
	opts: { addLessonId?: number },
	now: number
): DropResult {
	try {
		return db.transaction((tx) => {
			const choice = choicesOf(tx, wall, kind, id, false)?.find((c) => c.id === toId);
			if (!choice) throw new Gone();
			let added = false;
			if (opts.addLessonId !== undefined) {
				if (opts.addLessonId !== choice.addLesson?.id) throw new Gone();
				added = addLesson(tx, wall.userId, opts.addLessonId, NO_PICKS, now, { touch: false });
				if (!added) throw new Gone();
			}
			repoint(
				tx,
				wall.userId,
				wall.dance,
				kind,
				id,
				toId,
				{ entries: choice.practiceFollows || added, addLesson: kind === 'lesson' },
				now
			);
			if (kind !== 'song' && kind !== 'position') {
				// An entry merged into the person's practice on `toId` is archived
				// at `now`; one instant earlier keeps a restore of the copy (its
				// own `archived_at`) from bringing back a second practice.
				tx.update(exercises)
					.set({ archivedAt: now - 1 })
					.where(and(ownedBy(exercises, wall), eq(ENTRY[kind], id), eq(exercises.archivedAt, now)))
					.run();
			}
			if (kind === 'routine') keepNestedEmbeds(tx, wall, id, toId);
			if (!archiveMine(tx, kind, id, now)) throw new Gone();
			return { ok: true as const, toId };
		});
	} catch (err) {
		if (err instanceof Gone) return { ok: false, message: DROP_GONE };
		throw err;
	}
}
