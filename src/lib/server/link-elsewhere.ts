/**
 * Copy and link (link from other places): a row from the person's own app or
 * another group copied into a group through Copy to… (`copyTo`), as a clone
 * in the same family, and linked to the group's lesson or video section in
 * the same transaction (`copyTo`'s `after` hook). A link that is refused
 * throws inside that transaction, so a copy never lands without its link.
 *
 * When the family already has a member in the group, `copyTo` makes nothing:
 * a live member is linked in its own transaction; an archived one is answered
 * for Restore and link (`restoreAndLink`).
 */
import type { ElsewhereKind } from '$lib/types';
import type { Db } from './db';
import type { TeamSpace } from './scope';
import type { CloneFiles } from './clones/files';
import { copyTo, restoreMember } from './clones/copy-to';
import { linkExercise, linkFigure, linkPosition, linkRoutine } from './lessons';
import { linkInSpace, SpotLinkError } from './spot-links';
import { linkPositionInSpace } from './position-links';

/** Links the group's row `id`; false when the link is refused. Runs inside the caller's transaction. */
export type Linker = (tx: Db, id: number) => boolean;

export type CopyLinkResult =
	| { ok: true; id: number; made: boolean }
	| { ok: false; restore: number }
	| { ok: false; reason: 'room' | 'name' | 'denied' | 'refused'; message?: string };

class LinkRefused extends Error {}

/**
 * Copy `id` into `group` and link the copy with `link`, one transaction; or
 * link the family's live member already there. `use` answers Copy to…'s twin
 * questions.
 */
export async function copyAndLink(
	db: Db,
	actorId: string,
	kind: ElsewhereKind,
	id: number,
	group: TeamSpace,
	use: Record<string, number>,
	link: Linker,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<CopyLinkResult> {
	let res;
	try {
		res = await copyTo(db, actorId, kind, id, group, use, files, now, freeDiskBytes, {
			after: (tx, r) => {
				if (!link(tx, r.id)) throw new LinkRefused();
			}
		});
	} catch (e) {
		if (e instanceof LinkRefused) return { ok: false, reason: 'refused' };
		throw e;
	}
	if (!res.ok) {
		if (res.reason === 'room')
			return { ok: false, reason: 'room', message: res.room.ok ? undefined : res.room.message };
		if (res.reason === 'name') return { ok: false, reason: 'name', message: res.message };
		return { ok: false, reason: 'denied' };
	}
	if (res.made) return { ok: true, id: res.id, made: true };
	if (res.archived) return { ok: false, restore: res.id };
	return linkOnly(db, res.id, link);
}

/** Restore the family's archived member in the group, then link it. */
export function restoreAndLink(
	db: Db,
	actorId: string,
	kind: ElsewhereKind,
	id: number,
	group: TeamSpace,
	memberId: number,
	use: Record<string, number>,
	link: Linker,
	now: number
): CopyLinkResult {
	const done = restoreMember(db, actorId, kind, id, group, memberId, now, use);
	if (done === null) return { ok: false, reason: 'denied' };
	if (!done.ok) return { ok: false, reason: 'refused', message: done.message };
	return linkOnly(db, memberId, link);
}

function linkOnly(db: Db, id: number, link: Linker): CopyLinkResult {
	return link(db, id) ? { ok: true, id, made: false } : { ok: false, reason: 'refused' };
}

/** A lesson's link of a kind (`linkFigure`, `linkRoutine`, `linkExercise`, `linkPosition`). */
export function lessonLinker(kind: ElsewhereKind, lessonId: number, by: string): Linker {
	const fn = {
		figure: linkFigure,
		routine: linkRoutine,
		drill: linkExercise,
		position: linkPosition
	}[kind];
	return (tx, id) => fn(tx, lessonId, id, by);
}

/** A group video's section or point link: a variation or drill on a section, a position on either. */
export function spotLinker(kind: ElsewhereKind, space: TeamSpace, spotId: number): Linker {
	return (tx, id) => {
		try {
			if (kind === 'figure') linkInSpace(tx, space, spotId, { figureId: id });
			else if (kind === 'drill') linkInSpace(tx, space, spotId, { exerciseId: id });
			else if (kind === 'position') linkPositionInSpace(tx, space, spotId, id);
			else return false;
			return true;
		} catch (e) {
			if (e instanceof SpotLinkError) return false;
			throw e;
		}
	};
}
