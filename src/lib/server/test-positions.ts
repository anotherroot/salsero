/**
 * Specs only: the positions a fixture needs, inserted by hand. Nothing is
 * seeded in the app any more; this is the old starting vocabulary kept as a
 * fixture so specs that walk the graph still have positions to tag figures with.
 */
import type { Db } from './db';
import { positions } from './db/schema';
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

/** Insert the fixture positions for each dance that has none. The first is the neutral one. */
export function seedPositions(db: Db) {
	for (const dance of DANCE_SLUGS) {
		if (
			db
				.select()
				.from(positions)
				.all()
				.some((p) => p.dance === dance)
		)
			continue;
		db.insert(positions)
			.values(
				FIXTURE[dance].map((p, i) => ({
					dance,
					slug: p.slug,
					name: p.name,
					neutral: i === 0,
					sortOrder: i
				}))
			)
			.run();
	}
}
