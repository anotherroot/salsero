import { and, asc, eq } from 'drizzle-orm';
import type { CountPattern } from '$lib/labels';
import type { Db } from './db';
import { countTakes } from './db/schema';

export interface CountTakeInput {
	pattern: CountPattern;
	bpm: number;
	phrase: 'a' | 'b';
	file: string;
	sampleRate: number;
	preRollS: number;
	lengthS: number;
	durationS: number;
	sizeBytes: number;
}

/** Everything recorded, oldest first — the recording grid reads this. */
export function listCountTakes(db: Db) {
	return db.select().from(countTakes).orderBy(asc(countTakes.bpm), asc(countTakes.phrase)).all();
}

/**
 * The takes usable for one pattern. The player asks for this once per run and
 * picks the nearest tempo; a pattern with nothing recorded returns [] and the
 * run falls back to the shipped clips.
 */
export function listCountTakesFor(db: Db, pattern: CountPattern) {
	return db
		.select()
		.from(countTakes)
		.where(eq(countTakes.pattern, pattern))
		.orderBy(asc(countTakes.bpm))
		.all();
}

export function getCountTakeByFile(db: Db, file: string) {
	return db.select().from(countTakes).where(eq(countTakes.file, file)).get() ?? null;
}

/**
 * Store a take, replacing whatever held that (pattern, bpm, phrase) slot.
 *
 * Returns the REPLACED file name, if any, so the caller can unlink it — the
 * row is gone the moment this returns, and a file nothing points at is just
 * disk nobody will ever reclaim. Deliberately not done inside the transaction:
 * a failed unlink must not roll back a good recording.
 */
export function putCountTake(db: Db, input: CountTakeInput): { replaced: string | null } {
	return db.transaction((tx) => {
		const existing = tx
			.select({ file: countTakes.file })
			.from(countTakes)
			.where(
				and(
					eq(countTakes.pattern, input.pattern),
					eq(countTakes.bpm, input.bpm),
					eq(countTakes.phrase, input.phrase)
				)
			)
			.get();
		if (existing) {
			tx.delete(countTakes).where(eq(countTakes.file, existing.file)).run();
		}
		tx.insert(countTakes).values(input).run();
		return { replaced: existing?.file ?? null };
	});
}

/** Hard delete, like a recording. Returns the file to unlink, or null if it was already gone. */
export function deleteCountTake(db: Db, id: number): string | null {
	const row = db
		.select({ file: countTakes.file })
		.from(countTakes)
		.where(eq(countTakes.id, id))
		.get();
	if (!row) return null;
	db.delete(countTakes).where(eq(countTakes.id, id)).run();
	return row.file;
}
