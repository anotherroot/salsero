/*
 * A device's id slot (offline phase 3): every runtime mints ids in its own
 * block (`id = slot × 2³² + n`, `db/ids.ts`); the server is slot 0, and each
 * browser database gets the next free slot the first time it names itself.
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { MAX_SLOT } from '../db/ids';
import { deviceSlots } from '../db/schema';

/** The key's slot, whoever asks (a slot belongs to the database, not a person); a new one otherwise. */
export function slotFor(db: Db, userId: string, deviceKey: string, now: number): number {
	return db.transaction((tx) => {
		const have = tx
			.select({ slot: deviceSlots.slot })
			.from(deviceSlots)
			.where(eq(deviceSlots.deviceKey, deviceKey))
			.get();
		if (have) return have.slot;
		const top = tx.get<{ hi: number | null }>(sql`SELECT max(slot) AS hi FROM device_slots`).hi;
		const slot = (top ?? 0) + 1;
		if (slot > MAX_SLOT) throw new RangeError(`no device slot left past ${MAX_SLOT}`);
		tx.insert(deviceSlots).values({ slot, deviceKey, userId, createdAt: now }).run();
		return slot;
	});
}
