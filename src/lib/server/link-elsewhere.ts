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

/**
 * Copy and use (a group's field pickers: a figure's positions, a routine's
 * slots): nothing to link, the page uses the copy itself.
 */
export const useOnly: Linker = () => true;

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

export type CopyLinkRequest = {
	kind: ElsewhereKind;
	id: number;
	use: Record<string, number>;
	/** The family's archived member to restore first (Restore and link), or null. */
	restore: number | null;
};

const KINDS: readonly ElsewhereKind[] = ['figure', 'routine', 'drill', 'position'];

const posId = (v: unknown): number | null => {
	const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
	return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * What a Copy and link asks, from a form's fields or a JSON body: `kind`,
 * `id`, `use` (Copy to…'s twin answers, an object or its JSON), `restore`.
 * Null for anything malformed.
 */
export function copyLinkRequest(raw: unknown): CopyLinkRequest | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	if (!KINDS.includes(r.kind as ElsewhereKind)) return null;
	const id = posId(r.id);
	if (id === null) return null;
	const rawRestore = r.restore ?? null;
	const restore = rawRestore === null || rawRestore === '' ? null : posId(rawRestore);
	if (restore === null && rawRestore !== null && rawRestore !== '') return null;
	let use: unknown = r.use ?? {};
	if (typeof use === 'string') {
		if (use === '') use = {};
		else {
			try {
				use = JSON.parse(use);
			} catch {
				return null;
			}
		}
	}
	if (!use || typeof use !== 'object' || Array.isArray(use)) return null;
	const answers: Record<string, number> = {};
	for (const [key, v] of Object.entries(use)) {
		const n = typeof v === 'number' ? posId(v) : null;
		if (n === null) return null;
		answers[key] = n;
	}
	return { kind: r.kind as ElsewhereKind, id, use: answers, restore };
}
