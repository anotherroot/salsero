/**
 * Ids every runtime can make without asking the server: `id = slot × 2³² + n`.
 *
 * Slot 0 is every row made before offline existed, and the server keeps minting
 * there. Each device gets a slot of its own (1 and up) the first time it syncs,
 * so two runtimes never hand out the same id. All of it stays under 2⁵³, so a
 * JavaScript number holds every id exactly.
 *
 * `id_marks` holds the highest id used per table and slot. An `AFTER INSERT`
 * trigger on each id table keeps it (migration 0038), so ids that arrive with
 * a row — a device's, a restore's — count too, and a deleted id is never
 * handed out again.
 *
 * Every id column defaults to `mintId(table)`: that table's mark in this
 * runtime's slot, plus one. The expression is worked out once per statement,
 * so an insert carries ONE new row, or rows that carry their own ids; several
 * new rows in one insert would collide (loudly: a UNIQUE error).
 */
import { sql, type SQL } from 'drizzle-orm';
import { integer } from 'drizzle-orm/sqlite-core';
import { replaying } from '../replay-context';

export const SLOT_SIZE = 2 ** 32;
/** 2²¹ slots of 2³² ids: the last id is just under 2⁵³. */
export const MAX_SLOT = 2 ** 21 - 1;

let slot = 0;

/** The slot this runtime mints in. The server's is 0. */
export function setIdSlot(next: number): void {
	if (!Number.isInteger(next) || next < 0 || next > MAX_SLOT) {
		throw new RangeError(`id slot must be a whole number from 0 to ${MAX_SLOT}, got ${next}`);
	}
	slot = next;
}

export function idSlot(): number {
	return slot;
}

export function slotOf(id: number): number {
	return Math.floor(id / SLOT_SIZE);
}

/**
 * The next id of `table` in this runtime's slot, as SQL worked out by the insert.
 * While an offline change is replayed, the id the device minted for it, in order
 * (offline phase 3): the server's row gets the device's id.
 */
export function mintId(table: string): SQL {
	const next = replaying()?.minted.get(table)?.shift();
	if (next !== undefined) return sql`${next}`;
	return sql`(select coalesce((select hi from id_marks where tbl = ${table} and slot = ${slot}), ${slot * SLOT_SIZE}) + 1)`;
}

/** An integer id column that mints its own id. `table` is the table's SQL name. */
export function mintedId(table: string) {
	return integer('id')
		.primaryKey({ autoIncrement: true })
		.$defaultFn(() => mintId(table));
}
