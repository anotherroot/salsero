/**
 * Twins: a person's own "these are the same move", between things that show
 * in their app (their own rows and the group rows they read). One row per
 * marked item in `twins`, keyed by person, kind and item; the rows of one
 * `set_id` are one set. Twins never sync and never travel: the table is read
 * only by views (lists, pickers, a page's tabs), and nothing else learns of it.
 *
 * A set keeps its rows when one of them stops showing (archived, or out of
 * the person's reach): reading drops it, and reaching it again brings it
 * back. `repoint.ts` (`moveTwin`) keeps the same rules when a row moves: sets
 * merge, and a set left with one row is gone.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { PlaceRef, TwinCandidate, TwinKind } from '$lib/types';
import type { Db } from './db';
import { figures, lessons, routines, songs, twins } from './db/schema';
import type { Wall } from './scope';
import { accessTo, newGene, visibleMembers } from './clones/genes';
import { listVersions } from './figures';
import { usableVersions } from './usable';

const TABLES = { figure: figures, routine: routines, lesson: lessons, song: songs } as const;

/** Whether the person sees this row in their app: live, of `dance` when given, and readable. */
function shows(db: Db, userId: string, kind: TwinKind, id: number, dance?: string): boolean {
	const t = TABLES[kind];
	const row = db
		.select({ dance: t.dance, archivedAt: t.archivedAt })
		.from(t)
		.where(eq(t.id, id))
		.get();
	if (!row || row.archivedAt !== null) return false;
	if (dance !== undefined && row.dance !== dance) return false;
	return accessTo(db, userId, kind, id) !== null;
}

const mine = (userId: string, kind: TwinKind) =>
	and(eq(twins.userId, userId), eq(twins.kind, kind));

/**
 * Mark these as one. False, changing nothing, unless there are at least two
 * distinct ids and every one is a live row of this kind and the wall's dance
 * that the person reads. The sets any of them were in merge into one.
 */
export function markTwins(db: Db, wall: Wall, kind: TwinKind, ids: number[]): boolean {
	const unique = [...new Set(ids)];
	if (unique.length < 2) return false;
	if (!unique.every((id) => shows(db, wall.userId, kind, id, wall.dance))) return false;
	db.transaction((tx) => {
		const where = mine(wall.userId, kind);
		const existing = tx
			.select()
			.from(twins)
			.where(and(where, inArray(twins.itemId, unique)))
			.orderBy(asc(twins.createdAt), asc(twins.itemId))
			.all();
		const setIds = [...new Set(existing.map((r) => r.setId))];
		const setId = setIds[0] ?? newGene();
		if (setIds.length > 1) {
			tx.update(twins)
				.set({ setId })
				.where(and(where, inArray(twins.setId, setIds.slice(1))))
				.run();
		}
		const have = new Set(existing.map((r) => r.itemId));
		for (const itemId of unique) {
			if (!have.has(itemId)) {
				tx.insert(twins).values({ userId: wall.userId, kind, setId, itemId }).run();
			}
		}
	});
	return true;
}

/**
 * Not the same after all: the row's twin row goes, and a set left with one
 * row goes with it. False when the row was in no set of the person's.
 */
export function separate(db: Db, wall: Wall, kind: TwinKind, id: number): boolean {
	return db.transaction((tx) => {
		const where = mine(wall.userId, kind);
		const row = tx
			.delete(twins)
			.where(and(where, eq(twins.itemId, id)))
			.returning()
			.get();
		if (!row) return false;
		const left = tx
			.select({ itemId: twins.itemId })
			.from(twins)
			.where(and(where, eq(twins.setId, row.setId)))
			.all();
		if (left.length === 1) {
			tx.delete(twins)
				.where(and(where, eq(twins.setId, row.setId)))
				.run();
		}
		return true;
	});
}

/** The other rows of this row's set that the person still reads and are live, by id. */
export function twinsOf(db: Db, userId: string, kind: TwinKind, id: number): number[] {
	const where = mine(userId, kind);
	const row = db
		.select({ setId: twins.setId })
		.from(twins)
		.where(and(where, eq(twins.itemId, id)))
		.get();
	if (!row) return [];
	return db
		.select({ itemId: twins.itemId })
		.from(twins)
		.where(and(where, eq(twins.setId, row.setId)))
		.orderBy(asc(twins.itemId))
		.all()
		.map((r) => r.itemId)
		.filter((other) => other !== id && shows(db, userId, kind, other));
}

/**
 * The person's sets of this kind in the wall's dance that still hold at least
 * two rows they read and are live: each by id, sets by their first id.
 */
export function twinSets(db: Db, wall: Wall, kind: TwinKind): number[][] {
	const bySet = new Map<string, number[]>();
	for (const r of db
		.select({ setId: twins.setId, itemId: twins.itemId })
		.from(twins)
		.where(mine(wall.userId, kind))
		.orderBy(asc(twins.itemId))
		.all()) {
		if (!shows(db, wall.userId, kind, r.itemId, wall.dance)) continue;
		bySet.set(r.setId, [...(bySet.get(r.setId) ?? []), r.itemId]);
	}
	return [...bySet.values()].filter((s) => s.length >= 2).sort((a, b) => a[0] - b[0]);
}

/**
 * Same as…: every live row of the kind that the person sees in their app (their
 * own, and the usable rows of the groups they added, minus the ones their own
 * copy shadows) except the row itself and its family, which are shown together
 * already. `ticked` marks its current twins. Figures only for now.
 */
export function twinCandidates(db: Db, wall: Wall, kind: TwinKind, id: number): TwinCandidate[] {
	if (kind !== 'figure') return [];
	const family = new Set(visibleMembers(db, wall.userId, 'figure', id).map((m) => m.id));
	family.add(id);
	const ticked = new Set(twinsOf(db, wall.userId, 'figure', id));
	const mine: PlaceRef = { kind: 'mine' };
	const rows = [
		...listVersions(db, wall).map((v) => ({ id: v.id, label: v.label, place: mine })),
		...usableVersions(db, wall).map((v) => ({
			id: v.id,
			label: v.label,
			place: { kind: 'team', teamId: v.team.id, name: v.team.name } as PlaceRef
		}))
	];
	return rows
		.filter((r) => !family.has(r.id))
		.map((r) => ({ ...r, ticked: ticked.has(r.id) }))
		.sort((a, b) => a.label.localeCompare(b.label) || a.id - b.id);
}

/**
 * Save the Same as… sheet: the row's twins become exactly `ticked`. Each must
 * be a candidate, or nothing changes (false). Unticked former twins separate
 * from the row; ticked ones are marked with it. Group mode has no twins: the
 * caller never asks.
 */
export function setTwins(
	db: Db,
	wall: Wall,
	kind: TwinKind,
	id: number,
	ticked: number[]
): boolean {
	const offered = new Map(twinCandidates(db, wall, kind, id).map((c) => [c.id, c.ticked]));
	const want = [...new Set(ticked)];
	if (!want.every((t) => offered.has(t))) return false;
	return db.transaction((tx) => {
		for (const [other, was] of offered) {
			if (was && !want.includes(other)) separate(tx as unknown as Db, wall, kind, other);
		}
		if (want.length > 0) return markTwins(tx as unknown as Db, wall, kind, [id, ...want]);
		return true;
	});
}
