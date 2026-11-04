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
import type {
	FigureVersion,
	PlaceRef,
	TeamRef,
	TwinCandidate,
	TwinKind,
	TwinNote,
	TwinOffer
} from '$lib/types';
import { twinRows } from '$lib/clones/twins';
import type { Db } from './db';
import { figures, lessons, positions, routines, songs, twins } from './db/schema';
import { isTeam, type Space, type Wall } from './scope';
import { accessTo, newGene, visibleMembers } from './clones/genes';
import { listVersions } from './figures';
import { usableVersions } from './usable';
import { listAddedRoutines, listRoutines } from './routines';
import { listMyLessons } from './lessons';
import { listSharedSongs, listSongs } from './songs';

const TABLES = {
	figure: figures,
	routine: routines,
	lesson: lessons,
	song: songs,
	position: positions
} as const;

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

/**
 * Not the same? Separate (board C7 p2), from a page that shows a whole
 * family: a twin mark may sit on any member the person sees, so every one of
 * them leaves its set (`separate` each, sets of one going with them). False
 * when none of them was in a set.
 */
export function separateFamily(db: Db, wall: Wall, kind: TwinKind, id: number): boolean {
	const ids = new Set([id, ...visibleMembers(db, wall.userId, kind, id).map((m) => m.id)]);
	return db.transaction((tx) => {
		let any = false;
		for (const m of ids) any = separate(tx as unknown as Db, wall, kind, m) || any;
		return any;
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
 * already. `ticked` marks its current twins: those of any member of the
 * family the person sees, as the page's tabs show them. Routines, lessons and
 * songs offer what their lists show: the Routines list (their own and the
 * routines of lessons they added), the Lessons list (their own and added
 * ones) and Music (their own songs and their groups' class songs), the ones
 * their own copies shadow already left out.
 */
export function twinCandidates(db: Db, wall: Wall, kind: TwinKind, id: number): TwinCandidate[] {
	const family = new Set(visibleMembers(db, wall.userId, kind, id).map((m) => m.id));
	family.add(id);
	// The page's tabs show the twins of every member of the family: so do the ticks.
	const ticked = new Set([...family].flatMap((m) => twinsOf(db, wall.userId, kind, m)));
	const mine: PlaceRef = { kind: 'mine' };
	const placeOf = (t: TeamRef): PlaceRef => ({ kind: 'team', teamId: t.id, name: t.name });
	let rows: { id: number; label: string; place: PlaceRef }[];
	switch (kind) {
		case 'figure':
			rows = [
				...listVersions(db, wall).map((v) => ({ id: v.id, label: v.label, place: mine })),
				...usableVersions(db, wall).map((v) => ({
					id: v.id,
					label: v.label,
					place: placeOf(v.team)
				}))
			];
			break;
		case 'routine':
			rows = [
				...listRoutines(db, wall).map((r) => ({ id: r.id, label: r.name, place: mine })),
				...listAddedRoutines(db, wall).flatMap((g) =>
					g.routines.map((r) => ({ id: r.id, label: r.name, place: placeOf(g.team) }))
				)
			];
			break;
		case 'lesson':
			rows = listMyLessons(db, wall).map((l) => ({
				id: l.id,
				label: l.title,
				place: l.team ? placeOf(l.team) : mine
			}));
			break;
		case 'song':
			rows = [
				...listSongs(db, wall).map((s) => ({ id: s.id, label: s.title, place: mine })),
				...listSharedSongs(db, wall.userId, wall.dance).flatMap((g) =>
					g.songs.map((s) => ({ id: s.id, label: s.title, place: placeOf(g.team) }))
				)
			];
			break;
		case 'position':
			rows = []; // positions: a later task
			break;
	}
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

/**
 * The person's sets of this kind as stored, every dance and reach alike: for
 * folding a list that already holds only what they see (the Moves list, a
 * picker), where a member not in the list simply folds nothing. Reads no
 * access: the list is the visibility, computed once for it.
 */
export function storedTwinSets(db: Db, userId: string, kind: TwinKind): number[][] {
	const bySet = new Map<string, number[]>();
	for (const r of db
		.select({ setId: twins.setId, itemId: twins.itemId })
		.from(twins)
		.where(mine(userId, kind))
		.orderBy(asc(twins.itemId))
		.all()) {
		bySet.set(r.setId, [...(bySet.get(r.setId) ?? []), r.itemId]);
	}
	return [...bySet.values()].filter((s) => s.length >= 2);
}

/**
 * Same as… for a page: the sheet's offer, or null with nothing to tick (and
 * in a group's workspace, which has no twins).
 */
export function sameAsOffer(
	db: Db,
	wall: Wall,
	kind: TwinKind,
	id: number,
	title: string,
	inGroupMode: boolean
): TwinOffer | null {
	if (inGroupMode) return null;
	const candidates = twinCandidates(db, wall, kind, id);
	return candidates.length === 0 ? null : { kind, title, candidates };
}

/**
 * A person's picker rows of a kind named by `name` (routines) with their
 * twins folded: one row per set, theirs if they have one, else the first by
 * group name, carrying the twins behind it. A group's space folds nothing.
 */
export function foldNamed<T extends { id: number; name: string; team?: TeamRef | null }>(
	db: Db,
	space: Space,
	kind: TwinKind,
	rows: T[]
): (T & { twins?: TwinNote[] })[] {
	if (isTeam(space)) return rows;
	const sets = storedTwinSets(db, space.userId, kind);
	if (sets.length === 0) return rows;
	const byId = new Map(rows.map((r) => [r.id, r]));
	const mineIds = new Set(rows.filter((r) => !r.team).map((r) => r.id));
	const note = (id: number): TwinNote => {
		const t = byId.get(id)!;
		return { id, figure: null, name: t.name, team: t.team ?? null };
	};
	return twinRows(rows, sets, mineIds).map(({ id, twins: behind }) => {
		const r = byId.get(id)!;
		return behind.length === 0 ? r : { ...r, twins: behind.map(note) };
	});
}

/**
 * A person's picker variations with their twins folded (board C7): one row
 * per set, theirs if they have one, else the first by group name, carrying
 * the twins behind it (`twins`, for the meta). A group's space folds nothing:
 * groups have no twins.
 */
export function foldVersions<T extends FigureVersion>(db: Db, space: Space, versions: T[]): T[] {
	if (isTeam(space)) return versions;
	const sets = storedTwinSets(db, space.userId, 'figure');
	if (sets.length === 0) return versions;
	const byId = new Map(versions.map((v) => [v.id, v]));
	const mineIds = new Set(versions.filter((v) => !v.team).map((v) => v.id));
	const note = (id: number): TwinNote => {
		const t = byId.get(id)!;
		return { id, figure: t.figure, name: t.name, team: t.team ?? null };
	};
	const rows = versions.map((v) => ({ id: v.id, team: v.team }));
	return twinRows(rows, sets, mineIds).map(({ id, twins: behind }) => {
		const v = byId.get(id)!;
		return behind.length === 0 ? v : { ...v, twins: behind.map(note) };
	});
}
