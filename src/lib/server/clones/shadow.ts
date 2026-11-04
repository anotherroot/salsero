/**
 * The server side of "Yours replaces theirs": finding the person's own live
 * member of a family, and which of a list's group rows it shadows. Reads only.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { CloneKind } from '$lib/types';
import { shadow, swapToMine } from '$lib/clones/shadow';
import type { Db } from '../db';
import { exercises, figures, lessons, positions, routines, songs } from '../db/schema';
import { ownedBy, type Wall } from '../scope';

type T = {
	table: SQLiteTable;
	id: SQLiteColumn;
	geneId: SQLiteColumn;
	userId: SQLiteColumn;
	teamId: SQLiteColumn;
	dance: SQLiteColumn;
	archivedAt: SQLiteColumn;
};
const cols = (
	t:
		| typeof figures
		| typeof routines
		| typeof exercises
		| typeof songs
		| typeof lessons
		| typeof positions
) =>
	({
		table: t,
		id: t.id,
		geneId: t.geneId,
		userId: t.userId,
		teamId: t.teamId,
		dance: t.dance,
		archivedAt: t.archivedAt
	}) as T;
const tables: Record<CloneKind, T> = {
	figure: cols(figures),
	routine: cols(routines),
	drill: cols(exercises),
	song: cols(songs),
	lesson: cols(lessons),
	position: cols(positions)
};

/** Gene → the person's own LIVE member of that family (an archived one does not shadow). */
export function myMembers(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	genes: (string | null)[]
): Map<string, number> {
	const list = [...new Set(genes.filter((g): g is string => g !== null))];
	const out = new Map<string, number>();
	if (list.length === 0) return out;
	const t = tables[kind];
	const where = [inArray(t.geneId, list), ownedBy(t, wall), isNull(t.archivedAt)];
	if (kind === 'drill') where.push(eq(exercises.source, 'custom'));
	const rows = db
		.select({ id: t.id, gene: t.geneId })
		.from(t.table)
		.where(and(...where))
		.all() as { id: number; gene: string }[];
	for (const r of rows) out.set(r.gene, r.id);
	return out;
}

function genesOf(db: Db, kind: CloneKind, ids: number[]): { id: number; gene: string | null }[] {
	if (ids.length === 0) return [];
	const t = tables[kind];
	return db.select({ id: t.id, gene: t.geneId }).from(t.table).where(inArray(t.id, ids)).all() as {
		id: number;
		gene: string | null;
	}[];
}

/** Of these group rows, the ids the person's own copies shadow. */
export function shadowedIds(db: Db, wall: Wall, kind: CloneKind, ids: number[]): Set<number> {
	const rows = genesOf(db, kind, ids);
	const mine = myMembers(
		db,
		wall,
		kind,
		rows.map((r) => r.gene)
	);
	if (mine.size === 0) return new Set();
	const kept = new Set(shadow(rows, mine).map((r) => r.id));
	return new Set(rows.filter((r) => !kept.has(r.id)).map((r) => r.id));
}

/** Drops from `rows` (group rows with an `id`) those the person's copies shadow. */
export function withoutShadowed<R extends { id: number }>(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	rows: R[]
): R[] {
	if (rows.length === 0) return rows;
	const hidden = shadowedIds(
		db,
		wall,
		kind,
		rows.map((r) => r.id)
	);
	return hidden.size === 0 ? rows : rows.filter((r) => !hidden.has(r.id));
}

/** Group row id → the person's own member, for link cards. Only rows with a copy are in it. */
export function mineIdsFor(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	ids: number[]
): Map<number, number> {
	const rows = genesOf(db, kind, ids);
	const mine = myMembers(
		db,
		wall,
		kind,
		rows.map((r) => r.gene)
	);
	const out = new Map<number, number>();
	for (const r of swapToMine(rows, mine)) if (r.mineId !== null) out.set(r.id, r.mineId);
	return out;
}
