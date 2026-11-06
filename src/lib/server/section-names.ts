/**
 * Sections and points linked before a link named them (spec A3, 2026-11-05)
 * take the name of what they are linked to: their oldest figure or drill link
 * (lowest `spot_links.id`), else their oldest position link (lowest
 * `spot_position_links.id`). Once EVER — `app_flags` remembers, as
 * `importNoteLinks` and the positions move do — so a name the user clears
 * afterwards is never brought back by a restart. No one's edit, so no History.
 */
import { asc, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { appFlags, positions, spotLinks, spotPositionLinks, videoSpots } from './db/schema';
import { nameIfUnnamed, targetName } from './spot-links';

const FLAG = 'sections-named';

export function nameLinkedSpots(db: Db, now: number): { ran: boolean; named: number } {
	return db.transaction((tx) => {
		if (tx.select().from(appFlags).where(eq(appFlags.key, FLAG)).get()) {
			return { ran: false, named: 0 };
		}
		tx.insert(appFlags).values({ key: FLAG, doneAt: now }).run();

		const unnamed = tx
			.select({ id: videoSpots.id })
			.from(videoSpots)
			.where(isNull(videoSpots.label))
			.all();
		let named = 0;
		for (const { id } of unnamed) {
			const link = tx
				.select({ figureId: spotLinks.figureId, exerciseId: spotLinks.exerciseId })
				.from(spotLinks)
				.where(eq(spotLinks.spotId, id))
				.orderBy(asc(spotLinks.id))
				.limit(1)
				.get();
			let name: string | null = null;
			if (link?.figureId != null) name = targetName(tx, { figureId: link.figureId });
			else if (link?.exerciseId != null) name = targetName(tx, { exerciseId: link.exerciseId });
			else {
				name =
					tx
						.select({ name: positions.name })
						.from(spotPositionLinks)
						.innerJoin(positions, eq(positions.id, spotPositionLinks.positionId))
						.where(eq(spotPositionLinks.spotId, id))
						.orderBy(asc(spotPositionLinks.id))
						.limit(1)
						.get()?.name ?? null;
			}
			if (name) {
				nameIfUnnamed(tx, id, name);
				named += 1;
			}
		}
		return { ran: true, named };
	});
}
