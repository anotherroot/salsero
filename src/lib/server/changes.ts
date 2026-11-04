/**
 * A group's History: every change to a group's things, written in the same
 * transaction as the change (`logChange`), read per lesson, figure, routine or
 * drill (`history`), and the last of them as "Edited by" (`lastEdit`).
 *
 * A person's own things keep no History: `logChange` is a no-op for a `Wall`.
 * A group's change must say who made it: one with no actor throws, so a write
 * path that forgot to pass the person fails loudly instead of logging no one.
 *
 * The player's 0.1 s nudges would fill History with one line each, so
 * consecutive changes by one person to the same field of the same thing
 * within `HISTORY_MERGE_MS` are one line (risk 11): the first `before`, the
 * last `after`. A song's `edit`s merge the same way (tapping the count is
 * many saves).
 *
 * Which thing a change is filed under (its root): a lesson for its videos,
 * sections, links and section links; a figure (the `figure_groups` row: the
 * page a person reads as one figure) for its variations and recordings and
 * their sections; a routine for its slots; a drill and a song for themselves.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figures,
	lessonVideos,
	lessons,
	recordings,
	routineSteps,
	songs,
	teamChanges,
	teamMembers,
	users,
	videoSpots
} from './db/schema';
import { isTeam, spaceOfRow, type Space, type TeamSpace } from './scope';
import { HISTORY_MERGE_MS } from '$lib/limits';
import { shortNames } from '$lib/names';
import { changedFields, type Seen } from '$lib/clash/clash';
import { checkSeen } from './clash';
import { archivedByLine, canRestore } from '$lib/teams/history';
import { fail } from '@sveltejs/kit';
import type { ChangeRootKind, ChangeValues, ChangeVerb, HistoryRow, SpotOwner } from '$lib/types';
import { getLessonRow, updateLesson } from './lessons';
import { getGroup, renameFigure, updateVariation } from './figures';
import { getRoutine, setSlotNote, updateRoutine } from './routines';
import { getExercise, updateExercise } from './exercises';
import { updateSpot } from './spots';
import type { LinkOwner } from './links';

export interface ChangeEntry {
	rootKind: ChangeRootKind;
	rootId: number;
	verb: ChangeVerb;
	subject: string;
	subjectId?: number | null;
	before?: ChangeValues | null;
	after?: ChangeValues | null;
	trashId?: number | null;
}

/** The owner columns every root row carries. */
type Owned = { dance: string; userId: string | null; teamId: number | null };

const json = (v: ChangeValues | null | undefined) => (v ? JSON.stringify(v) : null);
const parse = (v: string | null): ChangeValues | null => (v === null ? null : JSON.parse(v));

/**
 * Write one History row for a change in `space`, inside the caller's
 * transaction. Nothing for a person's own things. A `change` by the same
 * person to the same subject of the same root, under `HISTORY_MERGE_MS` after
 * the root's last row, is merged into that row (its `before` kept).
 */
export function logChange(tx: Db, space: Space, e: ChangeEntry, now: number): void {
	if (!isTeam(space)) return;
	if (!space.actorId)
		throw new Error(`a group's change needs who made it (${e.rootKind} ${e.subject})`);
	const subjectId = e.subjectId ?? null;
	if (e.verb === 'change' || e.verb === 'edit') {
		const last = tx
			.select()
			.from(teamChanges)
			.where(
				and(
					eq(teamChanges.teamId, space.teamId),
					eq(teamChanges.rootKind, e.rootKind),
					eq(teamChanges.rootId, e.rootId)
				)
			)
			.orderBy(desc(teamChanges.at), desc(teamChanges.id))
			.get();
		if (
			last &&
			last.verb === e.verb &&
			last.actorId === space.actorId &&
			last.subject === e.subject &&
			last.subjectId === subjectId &&
			now - last.at < HISTORY_MERGE_MS
		) {
			const before = { ...(e.before ?? {}), ...(parse(last.beforeJson) ?? {}) };
			const after = { ...(parse(last.afterJson) ?? {}), ...(e.after ?? {}) };
			tx.update(teamChanges)
				.set({ beforeJson: json(before), afterJson: json(after), at: now })
				.where(eq(teamChanges.id, last.id))
				.run();
			return;
		}
	}
	tx.insert(teamChanges)
		.values({
			teamId: space.teamId,
			rootKind: e.rootKind,
			rootId: e.rootId,
			actorId: space.actorId,
			at: now,
			verb: e.verb,
			subject: e.subject,
			subjectId,
			beforeJson: json(e.before),
			afterJson: json(e.after),
			trashId: e.trashId ?? null
		})
		.run();
}

/**
 * What changed between two versions of a row's fields, as a change's subject
 * and its two halves: only the fields that differ (null and '' are the same,
 * as the clash check reads them). The subject is the field when one changed,
 * else `thing`. Null when nothing did.
 */
export function fieldChange(
	before: ChangeValues,
	after: ChangeValues,
	thing: string
): { subject: string; before: ChangeValues; after: ChangeValues } | null {
	const keys = changedFields(before, after);
	if (keys.length === 0) return null;
	const pick = (v: ChangeValues) => Object.fromEntries(keys.map((k) => [k, v[k] ?? null]));
	return { subject: keys.length === 1 ? keys[0] : thing, before: pick(before), after: pick(after) };
}

/** A root row's space, acted in by `by`; '' when no one is named (`logChange` refuses it for a group). */
export function actingIn(row: Owned, by: string | undefined): Space {
	return spaceOfRow(row, by ?? '');
}

/** A video's root: its lesson, or its recording's figure. Null when the video is gone. */
export function videoRoot(
	tx: Db,
	owner: SpotOwner
): { rootKind: 'lesson' | 'figure'; rootId: number; row: Owned } | null {
	if ('lessonVideoId' in owner) {
		const row = tx
			.select({
				id: lessons.id,
				dance: lessons.dance,
				userId: lessons.userId,
				teamId: lessons.teamId
			})
			.from(lessonVideos)
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(eq(lessonVideos.id, owner.lessonVideoId))
			.get();
		return row ? { rootKind: 'lesson', rootId: row.id, row } : null;
	}
	const row = tx
		.select({
			groupId: figures.groupId,
			dance: figures.dance,
			userId: figures.userId,
			teamId: figures.teamId
		})
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(recordings.id, owner.recordingId))
		.get();
	return row && row.groupId !== null ? { rootKind: 'figure', rootId: row.groupId, row } : null;
}

/** A spot's root: its video's. */
export function spotRoot(tx: Db, spotId: number) {
	const spot = tx
		.select({ lessonVideoId: videoSpots.lessonVideoId, recordingId: videoSpots.recordingId })
		.from(videoSpots)
		.where(eq(videoSpots.id, spotId))
		.get();
	if (!spot) return null;
	return videoRoot(
		tx,
		spot.lessonVideoId !== null
			? { lessonVideoId: spot.lessonVideoId }
			: { recordingId: spot.recordingId! }
	);
}

/** A variation's root: its figure. */
export function variationRoot(
	tx: Db,
	figureId: number
): { rootKind: 'figure'; rootId: number; row: Owned } | null {
	const row = tx
		.select({
			groupId: figures.groupId,
			dance: figures.dance,
			userId: figures.userId,
			teamId: figures.teamId
		})
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	return row && row.groupId !== null ? { rootKind: 'figure', rootId: row.groupId, row } : null;
}

/** A link's root: its lesson, its variation's figure, or its drill. */
export function linkRoot(
	tx: Db,
	owner: LinkOwner
): { rootKind: 'lesson' | 'figure' | 'drill'; rootId: number; row: Owned } | null {
	if ('figureId' in owner) return variationRoot(tx, owner.figureId);
	if ('lessonId' in owner) {
		const row = getLessonRow(tx, owner.lessonId);
		return row ? { rootKind: 'lesson', rootId: row.id, row } : null;
	}
	const row = tx.select().from(exercises).where(eq(exercises.id, owner.exerciseId)).get();
	return row ? { rootKind: 'drill', rootId: row.id, row } : null;
}

/** A row of `team_changes`, read back. */
function asRow(r: typeof teamChanges.$inferSelect): HistoryRow {
	return {
		id: r.id,
		rootKind: r.rootKind as ChangeRootKind,
		rootId: r.rootId,
		actorId: r.actorId,
		at: r.at,
		verb: r.verb as ChangeVerb,
		subject: r.subject,
		subjectId: r.subjectId,
		before: parse(r.beforeJson),
		after: parse(r.afterJson),
		trashId: r.trashId
	};
}

const ofRoot = (teamId: number, rootKind: ChangeRootKind, rootId: number) =>
	and(
		eq(teamChanges.teamId, teamId),
		eq(teamChanges.rootKind, rootKind),
		eq(teamChanges.rootId, rootId)
	);

/** Everything that happened to one of a group's things, newest first. */
export function history(
	db: Db,
	teamId: number,
	rootKind: ChangeRootKind,
	rootId: number
): HistoryRow[] {
	return db
		.select()
		.from(teamChanges)
		.where(ofRoot(teamId, rootKind, rootId))
		.orderBy(desc(teamChanges.at), desc(teamChanges.id))
		.all()
		.map(asRow);
}

/** Who changed one of a group's things last, and when; null when History has nothing. */
export function lastEdit(
	db: Db,
	teamId: number,
	rootKind: ChangeRootKind,
	rootId: number
): { actorId: string; at: number } | null {
	return (
		db
			.select({ actorId: teamChanges.actorId, at: teamChanges.at })
			.from(teamChanges)
			.where(ofRoot(teamId, rootKind, rootId))
			.orderBy(desc(teamChanges.at), desc(teamChanges.id))
			.get() ?? null
	);
}

/**
 * The short names History shows (`shortNames`): the group's people, and
 * anyone in `actorIds` who has left since, read from the users table so a
 * past actor still has a name.
 */
export function teamNames(db: Db, teamId: number, actorIds: string[] = []): Map<string, string> {
	const members = db
		.select({ id: teamMembers.userId })
		.from(teamMembers)
		.where(eq(teamMembers.teamId, teamId))
		.all()
		.map((m) => m.id);
	const ids = [...new Set([...members, ...actorIds])];
	if (ids.length === 0) return new Map();
	const people = db
		.select({
			id: users.id,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName
		})
		.from(users)
		.where(inArray(users.id, ids))
		.all();
	return shortNames(people);
}

/**
 * Who last changed a thing and when, by name, for the clash sheet and "Edited
 * by". `teamId` is the thing's group: nobody for a person's own things
 * (null), or before History has a row. With `subjectId`, the last change to
 * that one row of the root (a section of a lesson).
 */
export function editedBy(
	db: Db,
	teamId: number | null,
	rootKind: ChangeRootKind,
	rootId: number,
	subjectId?: number
): { by: string | null; at: number | null } {
	if (teamId === null) return { by: null, at: null };
	const last =
		subjectId === undefined
			? lastEdit(db, teamId, rootKind, rootId)
			: (db
					.select({ actorId: teamChanges.actorId, at: teamChanges.at })
					.from(teamChanges)
					.where(and(ofRoot(teamId, rootKind, rootId), eq(teamChanges.subjectId, subjectId)))
					.orderBy(desc(teamChanges.at), desc(teamChanges.id))
					.get() ?? null);
	if (!last) return { by: null, at: null };
	return { by: teamNames(db, teamId, [last.actorId]).get(last.actorId) ?? null, at: last.at };
}

/**
 * Who archived a group's thing: the newest `archive` row for it (a variation
 * is a subject of its figure). Null when History has none.
 */
export function archivedBy(
	db: Db,
	space: TeamSpace,
	rootKind: ChangeRootKind,
	rootId: number,
	subjectId: number | null = null
): string | null {
	const rows = db
		.select({ actorId: teamChanges.actorId, subjectId: teamChanges.subjectId })
		.from(teamChanges)
		.where(and(ofRoot(space.teamId, rootKind, rootId), eq(teamChanges.verb, 'archive')))
		.orderBy(desc(teamChanges.at), desc(teamChanges.id))
		.all();
	const row = subjectId === null ? rows[0] : rows.find((r) => r.subjectId === subjectId);
	return row ? (teamNames(db, space.teamId, [row.actorId]).get(row.actorId) ?? null) : null;
}

export type RestoreResult =
	| { ok: true }
	| { ok: false; reason: 'not-found' | 'not-restorable' | 'gone' | 'taken' }
	| {
			ok: false;
			reason: 'clash';
			changed: string[];
			current: Seen;
			by: string | null;
			at: number | null;
	  };

const pick = (row: ChangeValues, keys: string[]): Seen =>
	Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));

/**
 * Put a change to text or times back (History's Restore). Only a `change`
 * row of this group, and only while what it changed still reads as its
 * `after`: anything changed since is a clash, through `checkSeen`, as any
 * save that saw an older version. Logged as a `restore` of the same subject.
 */
export function restoreChange(
	db: Db,
	space: TeamSpace,
	changeId: number,
	now: number
): RestoreResult {
	const raw = db.select().from(teamChanges).where(eq(teamChanges.id, changeId)).get();
	if (!raw || raw.teamId !== space.teamId) return { ok: false, reason: 'not-found' };
	const row = asRow(raw);
	if (!canRestore(row) || !row.before || !row.after) {
		return { ok: false, reason: 'not-restorable' };
	}
	const keys = Object.keys(row.before);
	const before = row.before;
	const by = space.actorId;
	const R = 'restore' as const;

	/** Check the stored fields against what the change left, then write `before` back. */
	const run = (current: ChangeValues | null, write: () => boolean): RestoreResult => {
		const check = checkSeen(current === null ? null : pick(current, keys), pick(row.after!, keys));
		if (!check.ok) {
			if ('gone' in check) return { ok: false, reason: 'gone' };
			const who = editedBy(db, space.teamId, row.rootKind, row.rootId);
			return { ok: false, reason: 'clash', changed: check.changed, current: check.current, ...who };
		}
		return write() ? { ok: true } : { ok: false, reason: 'taken' };
	};
	const text = (k: string, fallback: string | null) =>
		k in before ? (before[k] === null ? null : String(before[k])) : fallback;
	const id = row.subjectId ?? row.rootId;

	switch (row.rootKind) {
		case 'lesson': {
			if (row.subject === 'section' || row.subject === 'point') break;
			const lesson = getLessonRow(db, row.rootId);
			if (!lesson || lesson.archivedAt !== null || lesson.teamId !== space.teamId) {
				return { ok: false, reason: 'gone' };
			}
			return run(lesson, () => {
				const input = {
					title: text('title', lesson.title) ?? lesson.title,
					lessonDay: text('lessonDay', lesson.lessonDay) ?? lesson.lessonDay,
					notes: text('notes', lesson.notes)
				};
				return updateLesson(db, lesson.id, input, by, now, R) !== null;
			});
		}
		case 'routine': {
			const routine = getRoutine(db, row.rootId);
			if (!routine || routine.archivedAt !== null || routine.teamId !== space.teamId) {
				return { ok: false, reason: 'gone' };
			}
			if (row.subject === 'note') {
				const step = db
					.select({ note: routineSteps.note, routineId: routineSteps.routineId })
					.from(routineSteps)
					.where(eq(routineSteps.id, id))
					.get();
				if (!step || step.routineId !== routine.id) return { ok: false, reason: 'gone' };
				return run(step, () => setSlotNote(db, id, text('note', null), by, now, R));
			}
			return run(routine, () => {
				const input = {
					name: text('name', routine.name) ?? routine.name,
					notes: text('notes', routine.notes)
				};
				return updateRoutine(db, routine.id, input, by, now, R) !== null;
			});
		}
		case 'drill': {
			const drill = getExercise(db, row.rootId);
			if (!drill || drill.archivedAt !== null || drill.teamId !== space.teamId) {
				return { ok: false, reason: 'gone' };
			}
			return run({ name: drill.name, notes: drill.notes }, () => {
				const input = {
					name: text('name', drill.name) ?? drill.name,
					notes: text('notes', drill.notes),
					everyDays: drill.everyDays,
					active: drill.active
				};
				return updateExercise(db, drill.id, input, by, now, R) !== null;
			});
		}
		case 'figure': {
			if (row.subject === 'section' || row.subject === 'point') break;
			const group = getGroup(db, row.rootId);
			if (!group || group.archivedAt !== null || group.teamId !== space.teamId) {
				return { ok: false, reason: 'gone' };
			}
			if (row.subject === 'figureName') {
				return run({ figureName: group.name }, () =>
					renameFigure(db, group.id, text('figureName', group.name) ?? group.name, by, now, R)
				);
			}
			const variation = db.select().from(figures).where(eq(figures.id, id)).get();
			if (!variation || variation.archivedAt !== null || variation.groupId !== group.id) {
				return { ok: false, reason: 'gone' };
			}
			return run({ name: variation.name, notes: variation.notes }, () => {
				const input = {
					name: text('name', variation.name) ?? variation.name,
					notes: text('notes', variation.notes),
					partner: variation.partner,
					style: variation.styleTag ?? ''
				};
				return updateVariation(db, variation.id, input, by, now, R) !== null;
			});
		}
		case 'song':
		case 'team':
			return { ok: false, reason: 'not-restorable' };
	}
	// A section's or a point's label or times, on a lesson video or a recording.
	if (row.subject !== 'section' && row.subject !== 'point') {
		return { ok: false, reason: 'not-restorable' };
	}
	const spot = db.select().from(videoSpots).where(eq(videoSpots.id, id)).get();
	const root = spot ? spotRoot(db, spot.id) : null;
	if (!spot || !root || root.row.teamId !== space.teamId) return { ok: false, reason: 'gone' };
	return run(spot, () => updateSpot(db, spot.id, before, by, now, R) !== null);
}

/** Which roots `history` reads for a kind: the group's rows of that kind only. */
export function rootInTeam(
	db: Db,
	teamId: number,
	rootKind: ChangeRootKind,
	rootId: number
): boolean {
	const owned = (row: { teamId: number | null } | null | undefined) => row?.teamId === teamId;
	switch (rootKind) {
		case 'lesson':
			return owned(getLessonRow(db, rootId));
		case 'figure':
			return owned(getGroup(db, rootId));
		case 'routine':
			return owned(getRoutine(db, rootId));
		case 'drill': {
			const drill = getExercise(db, rootId);
			return owned(drill) && drill!.source === 'custom';
		}
		case 'song':
			return owned(
				db.select({ teamId: songs.teamId }).from(songs).where(eq(songs.id, rootId)).get()
			);
		case 'team':
			return false;
	}
}

/** What a picker links: a variation, a routine or a drill. */
export type LinkTarget = { figureId: number } | { routineId: number } | { exerciseId: number };

/**
 * Who archived a group's thing a picker offered, when it is archived now:
 * a link to it is refused with "Archived by Ana", and the editor is offered
 * Restore and Pick another. Null when the target is live, missing, or not
 * this group's (those keep their own refusal).
 */
export function archivedTarget(
	db: Db,
	space: Space,
	target: LinkTarget
): { by: string | null; message: string } | null {
	const by = whoArchived(db, space, target);
	if (by === undefined) return null;
	return {
		by,
		message: by === null ? 'That was archived since you opened this.' : archivedByLine(by)
	};
}

/** `archivedTarget`'s who: undefined when the target is live or not this group's. */
function whoArchived(db: Db, space: Space, target: LinkTarget): string | null | undefined {
	if (!isTeam(space)) return undefined;
	if ('figureId' in target) {
		const row = db.select().from(figures).where(eq(figures.id, target.figureId)).get();
		const group = row?.groupId ? getGroup(db, row.groupId) : null;
		if (!row || !group || row.teamId !== space.teamId) return undefined;
		if (row.archivedAt === null && group.archivedAt === null) return undefined;
		return archivedBy(db, space, 'figure', group.id, row.id);
	}
	if ('routineId' in target) {
		const row = getRoutine(db, target.routineId);
		if (!row || row.teamId !== space.teamId || row.archivedAt === null) return undefined;
		return archivedBy(db, space, 'routine', row.id);
	}
	const row = getExercise(db, target.exerciseId);
	if (!row || row.teamId !== space.teamId || row.archivedAt === null) return undefined;
	return archivedBy(db, space, 'drill', row.id);
}

/**
 * A link refused because its target was archived since the picker opened
 * (410): "Archived by Ana", with `restorable` so an editor is offered Restore
 * beside Pick another. Null when the target is not archived.
 */
export function archivedRefusal<T extends Record<string, unknown>>(
	db: Db,
	space: Space,
	target: LinkTarget,
	extra: T
) {
	const archived = archivedTarget(db, space, target);
	if (!archived) return null;
	const { by, message } = archived;
	return fail(410, { ...extra, message, archived: { by, restorable: true, target } });
}
