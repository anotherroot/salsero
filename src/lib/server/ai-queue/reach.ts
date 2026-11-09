/**
 * What the person may change through the queue: the row of their dance that
 * `access.ts` lets them edit, and the space a data function writes it in.
 * The queue never decides access itself; a missing row and one the person may
 * not edit are the same null.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { figures, teams, videoSpots } from '../db/schema';
import {
	allows,
	judgeDrill,
	judgeFigure,
	judgeLesson,
	judgeMove,
	judgePosition,
	judgeRoutine,
	spotAccess
} from '../access';
import { spaceOfRow, type Space, type TeamSpace } from '../scope';
import { getGroup } from '../figures';
import { getRoutine } from '../routines';
import { getExercise } from '../exercises';
import { getLessonRow } from '../lessons';
import { getPosition } from '../positions';
import { spotRoot } from '../changes';
import { roleOf } from '../teams';
import type { DanceSlug } from '$lib/dances/dances';

export type Thing = 'move' | 'figure' | 'routine' | 'drill' | 'lesson' | 'position' | 'section';

type Row = { id: number; dance: string; userId: string | null; teamId: number | null };
export type Editable<R> = { row: R; space: Space };

function judged<R extends Row>(
	row: R | null | undefined,
	dance: string,
	ok: (r: R) => boolean
): Editable<R> | null {
	if (!row || row.dance !== dance || !ok(row)) return null;
	return { row, space: spaceOfRow(row, '') };
}

/** The row the person may edit (live, or with `state` archived ones only), with its space (actor: the person), or null. */
export function editable(
	db: Db,
	userId: string,
	dance: DanceSlug,
	thing: Thing,
	id: number,
	state: 'live' | 'archived' = 'live'
) {
	const withActor = <R extends Row>(e: Editable<R> | null): Editable<R> | null =>
		e && { row: e.row, space: spaceOfRow(e.row, userId) };
	const live = (r: { archivedAt: number | null }) =>
		state === 'live' ? r.archivedAt === null : r.archivedAt !== null;
	switch (thing) {
		case 'move':
			return withActor(
				judged(
					getGroup(db, id),
					dance,
					(r) => live(r) && allows(judgeMove(db, userId, r).access, 'edit')
				)
			);
		case 'figure': {
			const row = db.select().from(figures).where(eq(figures.id, id)).get();
			const move = row?.groupId ? getGroup(db, row.groupId) : null;
			return withActor(
				judged(
					row,
					dance,
					(r) =>
						live(r) &&
						!!move &&
						(state === 'archived' || move.archivedAt === null) &&
						allows(judgeFigure(db, userId, r).access, 'edit')
				)
			);
		}
		case 'routine':
			return withActor(
				judged(
					getRoutine(db, id),
					dance,
					(r) => live(r) && allows(judgeRoutine(db, userId, r).access, 'edit')
				)
			);
		case 'drill':
			return withActor(
				judged(
					getExercise(db, id),
					dance,
					// A person's entry of a group drill is theirs to log, not a drill to edit.
					(r) => live(r) && r.drillId === null && allows(judgeDrill(db, userId, r).access, 'edit')
				)
			);
		case 'lesson':
			return withActor(
				judged(
					getLessonRow(db, id),
					dance,
					(r) => live(r) && allows(judgeLesson(db, userId, r).access, 'edit')
				)
			);
		case 'position':
			return withActor(
				judged(
					getPosition(db, id),
					dance,
					(r) => live(r) && allows(judgePosition(db, userId, r).access, 'edit')
				)
			);
		case 'section': {
			const spot = db.select().from(videoSpots).where(eq(videoSpots.id, id)).get();
			const root = spot ? spotRoot(db, spot.id) : null;
			if (!spot || !root || (root.row as { dance?: string }).dance !== dance) return null;
			if (!allows(spotAccess(db, userId, id), 'edit')) return null;
			return { row: spot, space: spaceOfRow(root.row, userId) };
		}
	}
}

/** The group a create goes into: a live group of this dance the person owns or edits. */
export function teamSpaceFor(
	db: Db,
	userId: string,
	dance: DanceSlug,
	groupId: number
): TeamSpace | null {
	const team = db
		.select()
		.from(teams)
		.where(and(eq(teams.id, groupId), eq(teams.dance, dance)))
		.get();
	if (!team || team.deletedAt !== null || team.purgedAt !== null) return null;
	const role = roleOf(db, userId, groupId);
	if (role !== 'owner' && role !== 'editor') return null;
	return { dance, teamId: groupId, actorId: userId };
}
