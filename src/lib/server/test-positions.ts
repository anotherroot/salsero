/**
 * Specs only: the positions a fixture needs, inserted by hand. Nothing is
 * seeded in the app any more; this is the old starting vocabulary kept as a
 * fixture so specs that walk the graph still have positions to tag figures with.
 *
 * Positions are owned, like figures: the fixture's belong to one person (u1 by
 * default) or one group, and only that owner's figures may be tagged with them.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { positions } from './db/schema';
import { ownerValues, type Space } from './scope';
import { DANCE_SLUGS, type DanceSlug } from '$lib/dances/dances';

const FIXTURE: Record<DanceSlug, { slug: string; name: string }[]> = {
	salsa: [
		{ slug: 'open-two', name: 'Abierta (dos manos)' },
		{ slug: 'open-one', name: 'Abierta (una mano)' },
		{ slug: 'closed', name: 'Cerrada' },
		{ slug: 'cross-hand', name: 'Manos cruzadas' },
		{ slug: 'caida', name: 'Caída' },
		{ slug: 'hammerlock-r', name: 'Setenta, derecha' },
		{ slug: 'hammerlock-l', name: 'Setenta, izquierda' },
		{ slug: 'cuddle', name: 'Sombrero' },
		{ slug: 'shadow', name: 'Sombra' },
		{ slug: 'back-to-back', name: 'Espalda con espalda' }
	],
	bachata: [
		{ slug: 'closed', name: 'Closed' },
		{ slug: 'open-two', name: 'Open, two hands' },
		{ slug: 'open-one', name: 'Open, one hand' },
		{ slug: 'cross-hand', name: 'Cross-hand' },
		{ slug: 'hammerlock', name: 'Hammerlock' },
		{ slug: 'shadow', name: 'Shadow' },
		{ slug: 'side-by-side', name: 'Side by side' }
	]
};

/** Whose fixture positions: a person (`userId`) or a group (`teamId`). */
export type FixtureOwner = { userId: string } | { teamId: number };

/**
 * Insert the fixture positions, owned by `owner` (u1 by default), for each
 * dance where that owner has none yet.
 */
export function insertFixturePositions(db: Db, owner: FixtureOwner = { userId: 'u1' }) {
	const userId = 'userId' in owner ? owner.userId : null;
	const teamId = 'teamId' in owner ? owner.teamId : null;
	for (const dance of DANCE_SLUGS) {
		const has = db
			.select({ id: positions.id })
			.from(positions)
			.where(
				and(
					eq(positions.dance, dance),
					userId === null ? isNull(positions.userId) : eq(positions.userId, userId),
					teamId === null ? isNull(positions.teamId) : eq(positions.teamId, teamId)
				)
			)
			.limit(1)
			.get();
		if (has) continue;
		db.insert(positions)
			.values(
				FIXTURE[dance].map((p, i) => ({
					dance,
					slug: p.slug,
					name: p.name,
					sortOrder: i,
					userId,
					teamId
				}))
			)
			.run();
	}
}

/** One position of `space`, with an optional gene (its family) and archive time. */
export function addPosition(
	db: Db,
	space: Space,
	name: string,
	extra: { geneId?: string; archivedAt?: number } = {}
): number {
	return db
		.insert(positions)
		.values({
			...ownerValues(space),
			slug: `p-${crypto.randomUUID()}`,
			name,
			geneId: extra.geneId ?? null,
			archivedAt: extra.archivedAt ?? null
		})
		.returning({ id: positions.id })
		.get().id;
}
