/**
 * Detach (board C8): a copy leaves its family. It keeps its content as it
 * is, but has no gene, no `cloned_from` and no pair snapshots, so nothing
 * says "updated since" and nothing offers Take theirs into it.
 *
 * On a person's own row the family's other readable members become its
 * TWINS (`markTwins`, for the kinds that have twins; a drill just leaves),
 * so the person still sees them shown together. On a group's row Detach is
 * an ordinary group edit: it is logged as a `change`.
 */
import { eq } from 'drizzle-orm';
import type { CloneKind, DetachOffer, TwinKind } from '$lib/types';
import type { Db } from '../db';
import { exercises, figures, lessons, routines, songs } from '../db/schema';
import { logChange } from '../changes';
import type { DanceSlug } from '$lib/dances/dances';
import { isTeam, spaceOfRow } from '../scope';
import { markTwins } from '../twins';
import { accessTo, geneOf, visibleMembers } from './genes';
import { rowOf } from './edit';
import { dropPairs } from './pairs';
import { logRoot } from './apply';

const TABLES = {
	figure: figures,
	routine: routines,
	drill: exercises,
	song: songs,
	lesson: lessons
} as const;

/** The live row the actor edits and that has a family, with its other live members; else null. */
function detachable(db: Db, actorId: string, kind: CloneKind, id: number) {
	const row = rowOf(db, kind, id);
	if (!row || row.archivedAt !== null) return null;
	if (accessTo(db, actorId, kind, id) !== 'edit') return null;
	if (geneOf(db, kind, id) === null) return null;
	const members = visibleMembers(db, actorId, kind, id);
	const others = members.filter((m) => m.id !== id && !m.archived);
	return { row, self: members.find((m) => m.id === id), others };
}

/**
 * What the page's Detach offers: the place named in its question (where the
 * copy came from while it is still readable, else the first other member by
 * place) and whether the row is a group's. Null when there is nothing to
 * leave: the row is not live, not the person's to edit, or has no other
 * live member they read.
 */
export function detachOffer(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number
): DetachOffer | null {
	const d = detachable(db, actorId, kind, id);
	if (!d || d.others.length === 0) return null;
	const name = (p: { kind: 'mine' } | { kind: 'team'; name: string }) =>
		p.kind === 'team' ? p.name : 'Yours';
	const from = d.others.find((m) => m.id === d.self?.clonedFrom);
	const first = [...d.others].sort(
		(a, b) =>
			Number(a.place.kind === 'mine') - Number(b.place.kind === 'mine') ||
			name(a.place).localeCompare(name(b.place))
	)[0];
	return { place: name((from ?? first).place), group: d.row.teamId !== null };
}

/**
 * Detach the actor's row. False, writing nothing, unless it is a live row
 * they edit that is in a family.
 */
export function detach(db: Db, actorId: string, kind: CloneKind, id: number, now: number): boolean {
	const d = detachable(db, actorId, kind, id);
	if (!d) return false;
	const { row, others } = d;
	return db.transaction((t) => {
		const tx = t as unknown as Db;
		const table = TABLES[kind];
		tx.update(table)
			.set({ geneId: null, clonedFrom: null } as never)
			.where(eq(table.id, id))
			.run();
		dropPairs(tx, kind, id);
		const raw = tx.select().from(table).where(eq(table.id, id)).get() as {
			id: number;
			dance: string;
			userId: string | null;
			teamId: number | null;
			groupId?: number | null;
		};
		const space = spaceOfRow(raw, actorId);
		if (isTeam(space)) {
			const { thing, ...root } = logRoot(kind, raw);
			logChange(tx, space, { ...root, verb: 'change', subject: thing }, now);
		} else if (kind !== 'drill') {
			const same = others.filter((m) => rowOf(tx, kind, m.id)?.dance === row.dance);
			markTwins(tx, { userId: actorId, dance: row.dance as DanceSlug }, kind as TwinKind, [
				id,
				...same.map((m) => m.id)
			]);
		}
		return true;
	});
}
