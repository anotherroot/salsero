/**
 * Compare and Take theirs (board C2 p3): two members of a family side by
 * side, field by field, since the pair was last in step; and Take, which
 * writes the other member's value of each picked field into yours, in place
 * (`apply.ts`).
 *
 * Reads only what the person may: both rows readable to them, of one family.
 * Another person's own member is never readable, so it is never compared.
 */
import type { CloneKind, Comparison, Picks, SyncResult } from '$lib/types';
import { defaultPicks, diff } from '$lib/clones/diff';
import type { Db } from '../db';
import { accessTo, geneOf } from './genes';
import { digest, hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import { syncFrom } from './apply';
import type { CloneFiles } from './files';

/**
 * `mineId` beside `theirsId`, from `mineId`'s side: what differs since the
 * two were last in step (every difference a pick when never), Take's
 * preselection, `mineId`'s digest for the take's `seen`, and which way the
 * person may write (Take into a member they edit, Send into one). Null
 * unless both are in one family and the person reads both. `tz` is the
 * zone a recording's day is shown in.
 */
export function compareWith(
	db: Db,
	userId: string,
	kind: CloneKind,
	mineId: number,
	theirsId: number,
	opts: { tz?: string } = {}
): Comparison | null {
	if (mineId === theirsId) return null;
	const gene = geneOf(db, kind, mineId);
	if (gene === null || gene !== geneOf(db, kind, theirsId)) return null;
	const mineAccess = accessTo(db, userId, kind, mineId);
	const theirsAccess = accessTo(db, userId, kind, theirsId);
	if (mineAccess === null || theirsAccess === null) return null;

	const mine = flatOf(db, kind, mineId, opts);
	const theirs = flatOf(db, kind, theirsId, opts);
	const base = pairBase(db, kind, mineId, theirsId);
	const diffs = diff(base, mine, theirs, hashValue);
	return {
		diffs,
		picks: defaultPicks(diffs, 'take'),
		seen: digest(mine),
		synced: base !== null,
		canTake: mineAccess === 'edit',
		canSend: theirsAccess === 'edit'
	};
}

/**
 * Take theirs: `fromId`'s value of each field picked `'theirs'` lands in
 * `intoId`, in place. `denied` unless the actor edits `intoId`; `stale`
 * ("Changed since you opened this. Compare again.") when `intoId` changed
 * since the comparison (`seen`); `pick` while a field both changed has no
 * pick; `room`, `name` and `linked` as `syncFrom` says. A group's member
 * logs one `change` and reconciles its members' entries after a delete.
 */
export function takeTheirs(
	db: Db,
	actorId: string,
	kind: CloneKind,
	intoId: number,
	fromId: number,
	picks: Picks,
	seen: string,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<SyncResult> {
	return syncFrom(db, actorId, kind, intoId, fromId, picks, seen, files, now, freeDiskBytes);
}
