/**
 * The one-time move of today's positions to their owners, at boot.
 *
 * Positions were one shared, ownerless list per dance. Now they are owned like
 * figures, and the graph reads only owned positions and `figure_end_positions`.
 * So, once EVER (`app_flags` remembers, as `importNoteLinks` does) and in one
 * transaction:
 *
 * 1. Every shared position becomes the admin's (the earliest-created admin,
 *    else the earliest user), with a fresh gene. The admin's figures keep
 *    their tags.
 * 2. Every other place (a person, a group) whose figures use a shared position
 *    — a start, an end row, or the old `figures.end_position_id`, archived
 *    figures included — gets its own copy of it: name, dance and `archived_at`
 *    kept, the SAME gene as the admin's row (one family per shared position,
 *    so a routine mixing a person's figures with a group's keeps meeting where
 *    it met), no `cloned_from`. That place's figures' tags are repointed.
 * 3. Every `figures.end_position_id` is copied into `figure_end_positions`,
 *    pointing at the place's copy. The column itself is left as it was
 *    (vestigial).
 * 4. Untagged figures stay untagged.
 *
 * With no users at all it does nothing and leaves no marker, so it runs on the
 * first boot that has someone to give the positions to.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	appFlags,
	figureEndPositions,
	figures,
	figureStartPositions,
	positions,
	users
} from './db/schema';
import { newGene } from './clones/genes';

const FLAG = 'positions-owned';

export interface PositionsMove {
	ran: boolean;
	/** Copies made for places other than the owner's. */
	copies: number;
	/** Figures of those places now tagged with one of their copies. */
	figures: number;
	/** `figure_end_positions` rows written from `figures.end_position_id`. */
	ends: number;
}

const NOT_RUN: PositionsMove = { ran: false, copies: 0, figures: 0, ends: 0 };

/** Where a figure lives: a group's (`team_id` set) or else a person's. */
type Place = { teamId: number } | { userId: string };
const placeKey = (f: { userId: string | null; teamId: number | null }): string | null =>
	f.teamId !== null ? `t:${f.teamId}` : f.userId !== null ? `u:${f.userId}` : null;
const placeOf = (key: string): Place =>
	key.startsWith('t:') ? { teamId: Number(key.slice(2)) } : { userId: key.slice(2) };

export function movePositionsToOwners(db: Db, now: number): PositionsMove {
	return db.transaction((tx) => {
		if (tx.select().from(appFlags).where(eq(appFlags.key, FLAG)).get()) return NOT_RUN;
		const owner = tx
			.select({ id: users.id })
			.from(users)
			.orderBy(sql`${users.isAdmin} desc`, users.createdAt, users.id)
			.limit(1)
			.get();
		if (!owner) return NOT_RUN;
		tx.insert(appFlags).values({ key: FLAG, doneAt: now }).run();

		// 1. The shared positions become the owner's, a fresh family each.
		const shared = tx
			.select()
			.from(positions)
			.where(and(isNull(positions.userId), isNull(positions.teamId)))
			.all();
		const sharedById = new Map<number, (typeof shared)[number] & { geneId: string }>();
		for (const p of shared) {
			const geneId = newGene();
			tx.update(positions).set({ userId: owner.id, geneId }).where(eq(positions.id, p.id)).run();
			sharedById.set(p.id, { ...p, geneId });
		}

		// Every figure (archived ones too) and the shared positions it uses.
		const ownerKey = `u:${owner.id}`;
		const allFigures = tx
			.select({
				id: figures.id,
				userId: figures.userId,
				teamId: figures.teamId,
				endPositionId: figures.endPositionId
			})
			.from(figures)
			.all();
		const placeOfFigure = new Map(allFigures.map((f) => [f.id, placeKey(f)]));
		const uses: { figureId: number; positionId: number }[] = [
			...tx
				.select({
					figureId: figureStartPositions.figureId,
					positionId: figureStartPositions.positionId
				})
				.from(figureStartPositions)
				.all(),
			...tx
				.select({
					figureId: figureEndPositions.figureId,
					positionId: figureEndPositions.positionId
				})
				.from(figureEndPositions)
				.all(),
			...allFigures.flatMap((f) =>
				f.endPositionId === null ? [] : [{ figureId: f.id, positionId: f.endPositionId }]
			)
		];

		// 2. A copy per (other place, shared position it uses).
		const copyOf = new Map<string, Map<number, number>>();
		let copies = 0;
		for (const use of uses) {
			const source = sharedById.get(use.positionId);
			const key = placeOfFigure.get(use.figureId);
			if (!source || !key || key === ownerKey) continue;
			let placeCopies = copyOf.get(key);
			if (!placeCopies) copyOf.set(key, (placeCopies = new Map()));
			if (placeCopies.has(source.id)) continue;
			const place = placeOf(key);
			const copy = tx
				.insert(positions)
				.values({
					dance: source.dance,
					slug: `p-${crypto.randomUUID()}`,
					name: source.name,
					archivedAt: source.archivedAt,
					createdAt: now,
					userId: 'userId' in place ? place.userId : null,
					teamId: 'teamId' in place ? place.teamId : null,
					geneId: source.geneId,
					clonedFrom: null,
					styleTag: null
				})
				.returning({ id: positions.id })
				.get();
			placeCopies.set(source.id, copy.id);
			copies++;
		}

		// ...and that place's figures' tags, both tables, move onto the copies.
		for (const [key, placeCopies] of copyOf) {
			const place = placeOf(key);
			const figureIds = tx
				.select({ id: figures.id })
				.from(figures)
				.where(
					'teamId' in place
						? eq(figures.teamId, place.teamId)
						: and(eq(figures.userId, place.userId), isNull(figures.teamId))
				);
			for (const [sourceId, copyId] of placeCopies) {
				for (const table of [figureStartPositions, figureEndPositions]) {
					tx.update(table)
						.set({ positionId: copyId })
						.where(and(eq(table.positionId, sourceId), inArray(table.figureId, figureIds)))
						.run();
				}
			}
		}

		// 3. The old single end, into the ends table, on the place's copy.
		let ends = 0;
		for (const f of allFigures) {
			if (f.endPositionId === null) continue;
			const key = placeOfFigure.get(f.id) ?? null;
			const positionId =
				(key === null ? undefined : copyOf.get(key)?.get(f.endPositionId)) ?? f.endPositionId;
			ends += tx
				.insert(figureEndPositions)
				.values({ figureId: f.id, positionId, createdAt: now })
				.onConflictDoNothing()
				.run().changes;
		}

		const copyIds = [...copyOf.values()].flatMap((m) => [...m.values()]);
		const touched = new Set<number>();
		if (copyIds.length > 0) {
			for (const table of [figureStartPositions, figureEndPositions]) {
				for (const r of tx
					.select({ id: table.figureId })
					.from(table)
					.where(inArray(table.positionId, copyIds))
					.all())
					touched.add(r.id);
			}
		}

		return { ran: true, copies, figures: touched.size, ends };
	});
}
