/**
 * Families: a gene id names one thing copied into several places, and each
 * place's row of it is a member. A row starts as a family of one with no gene;
 * `stampGene` gives it one the first time it is copied. A gene is only ever
 * read to FIND a member (links stay concrete row ids, the plan's rule).
 *
 * Only `stampGene` writes. `visibleMembers` is the one way a page learns about
 * a family: another person's own member never appears in it.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { CloneKind, Member, PieceKind, PlaceRef } from '$lib/types';
import type { Db } from '../db';
import {
	exercises,
	figures,
	lessons,
	lessonVideos,
	recordings,
	routines,
	songs,
	videoSpots
} from '../db/schema';
import { ownedBy, type Space } from '../scope';
import { getTeam } from '../teams';
import { drillAccess, figureAccess, lessonAccess, routineAccess, songAccess } from '../access';

type Cols = { table: SQLiteTable; id: SQLiteColumn; geneId: SQLiteColumn };
type RootCols = Cols & {
	userId: SQLiteColumn;
	teamId: SQLiteColumn;
	dance: SQLiteColumn;
	archivedAt: SQLiteColumn;
	clonedFrom: SQLiteColumn;
};

const root = (
	t: typeof figures | typeof routines | typeof exercises | typeof songs | typeof lessons
) =>
	({
		table: t,
		id: t.id,
		geneId: t.geneId,
		userId: t.userId,
		teamId: t.teamId,
		dance: t.dance,
		archivedAt: t.archivedAt,
		clonedFrom: t.clonedFrom
	}) as RootCols;

const ROOTS: Record<CloneKind, RootCols> = {
	figure: root(figures),
	routine: root(routines),
	drill: root(exercises),
	song: root(songs),
	lesson: root(lessons)
};

const PIECES: Record<PieceKind, Cols> = {
	recording: { table: recordings, id: recordings.id, geneId: recordings.geneId },
	video: { table: lessonVideos, id: lessonVideos.id, geneId: lessonVideos.geneId },
	spot: { table: videoSpots, id: videoSpots.id, geneId: videoSpots.geneId }
};

/**
 * The rows a kind covers: a drill is an `exercises` row with source `custom`;
 * entries and a figure's, routine's or lesson's own exercise are never members.
 */
function kindWhere(kind: CloneKind | PieceKind, extra: SQL): SQL {
	return kind === 'drill' ? and(extra, eq(exercises.source, 'custom'))! : extra;
}

function colsOf(kind: CloneKind | PieceKind): Cols {
	return (ROOTS as Record<string, Cols>)[kind] ?? PIECES[kind as PieceKind];
}

/** A new family's id. */
export function newGene(): string {
	return randomUUID();
}

/** A row's gene, or null when it is a family of one (or missing). Never writes. */
export function geneOf(db: Db, kind: CloneKind | PieceKind, id: number): string | null {
	const c = colsOf(kind);
	const row = db
		.select({ gene: c.geneId })
		.from(c.table)
		.where(kindWhere(kind, eq(c.id, id)))
		.get() as { gene: string | null } | undefined;
	return row?.gene ?? null;
}

/**
 * The row's gene, giving it a new one first when it has none. Throws for a
 * missing row, and for an exercise that is not a drill.
 */
export function stampGene(tx: Db, kind: CloneKind | PieceKind, id: number): string {
	const c = colsOf(kind);
	const row = tx
		.select({ gene: c.geneId })
		.from(c.table)
		.where(kindWhere(kind, eq(c.id, id)))
		.get() as { gene: string | null } | undefined;
	if (!row) throw new Error(`No ${kind} ${id} to stamp`);
	if (row.gene !== null) return row.gene;
	const gene = newGene();
	tx.update(c.table)
		.set({ geneId: gene } as never)
		.where(eq(c.id, id))
		.run();
	return gene;
}

/** This family's member in a place (a person's own side or a group's), archived included. */
export function memberIn(
	db: Db,
	kind: CloneKind,
	gene: string,
	place: Space
): { id: number; archived: boolean } | null {
	const c = ROOTS[kind];
	const row = db
		.select({ id: c.id, archivedAt: c.archivedAt })
		.from(c.table)
		.where(kindWhere(kind, and(eq(c.geneId, gene), ownedBy(c, place))!))
		.get() as { id: number; archivedAt: number | null } | undefined;
	return row ? { id: row.id, archived: row.archivedAt !== null } : null;
}

export type FamilyRow = {
	id: number;
	userId: string | null;
	teamId: number | null;
	archivedAt: number | null;
	clonedFrom: number | null;
};

/** Every member of a family, whoever owns it, by id. For the server's own bookkeeping only. */
export function familyRows(db: Db, kind: CloneKind, gene: string): FamilyRow[] {
	const c = ROOTS[kind];
	return db
		.select({
			id: c.id,
			userId: c.userId,
			teamId: c.teamId,
			archivedAt: c.archivedAt,
			clonedFrom: c.clonedFrom
		})
		.from(c.table)
		.where(kindWhere(kind, eq(c.geneId, gene)))
		.orderBy(asc(c.id))
		.all() as FamilyRow[];
}

/** What `userId` may do with one member, by the kind's own access rule. */
function accessTo(db: Db, userId: string, kind: CloneKind, id: number) {
	switch (kind) {
		case 'figure': {
			const row = db.select().from(figures).where(eq(figures.id, id)).get();
			return row ? figureAccess(db, userId, row) : null;
		}
		case 'routine': {
			const row = db.select().from(routines).where(eq(routines.id, id)).get();
			return row ? routineAccess(db, userId, row) : null;
		}
		case 'drill': {
			const row = db.select().from(exercises).where(eq(exercises.id, id)).get();
			return row && row.source === 'custom' ? drillAccess(db, userId, row) : null;
		}
		case 'song': {
			const row = db.select().from(songs).where(eq(songs.id, id)).get();
			return row ? songAccess(db, userId, row) : null;
		}
		case 'lesson': {
			const row = db.select().from(lessons).where(eq(lessons.id, id)).get();
			return row ? lessonAccess(db, userId, row) : null;
		}
	}
}

/**
 * The members of this row's family that `userId` can read (just the row
 * itself when it has no gene), by id, each with its place and access. Empty
 * unless `userId` can read the row itself, so an id is never a way into a
 * family; empty too for an exercise that is not a drill. Another person's own
 * member never appears, and a group's appears only as `access.ts` allows: a
 * deleted group's to its editors, read-only; a purged group's to nobody.
 */
export function visibleMembers(db: Db, userId: string, kind: CloneKind, id: number): Member[] {
	const c = ROOTS[kind];
	const self = db
		.select({
			id: c.id,
			geneId: c.geneId,
			userId: c.userId,
			teamId: c.teamId,
			archivedAt: c.archivedAt,
			clonedFrom: c.clonedFrom
		})
		.from(c.table)
		.where(kindWhere(kind, eq(c.id, id)))
		.get() as (FamilyRow & { geneId: string | null }) | undefined;
	if (!self || accessTo(db, userId, kind, id) === null) return [];
	const rows = self.geneId === null ? [self] : familyRows(db, kind, self.geneId);
	const out: Member[] = [];
	for (const row of rows) {
		const access = accessTo(db, userId, kind, row.id);
		if (access === null) continue;
		let place: PlaceRef;
		if (row.teamId === null) {
			place = { kind: 'mine' };
		} else {
			const team = getTeam(db, row.teamId);
			if (!team) continue;
			place = { kind: 'team', teamId: team.id, name: team.name };
		}
		out.push({
			kind,
			id: row.id,
			place,
			access,
			archived: row.archivedAt !== null,
			clonedFrom: row.clonedFrom
		});
	}
	return out;
}
