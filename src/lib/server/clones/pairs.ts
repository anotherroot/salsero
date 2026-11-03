/**
 * Pair snapshots: for two members of one family, a hash per field of what both
 * held the last time they were in step. Written only by copy, Take and Send
 * (never by an ordinary save); the three-way compare (`$lib/clones/diff`)
 * reads them. A pair is stored once, smaller id first, so either order finds it.
 */
import { createHash } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import type { CloneKind, Flat, PairBase } from '$lib/types';
import type { Db } from '../db';
import { clonePairs } from '../db/schema';

/** A field value's hash: sha-256, hex, the first 16 characters. */
export function hashValue(v: string): string {
	return createHash('sha256').update(v).digest('hex').slice(0, 16);
}

function ordered(a: number, b: number): [number, number] {
	if (a === b) throw new Error('A pair needs two members');
	return a < b ? [a, b] : [b, a];
}

function pairWhere(kind: CloneKind, a: number, b: number) {
	const [lo, hi] = ordered(a, b);
	return and(eq(clonePairs.kind, kind), eq(clonePairs.aId, lo), eq(clonePairs.bId, hi));
}

/** The pair's snapshot, in either order; null when the two were never in step. */
export function pairBase(db: Db, kind: CloneKind, a: number, b: number): PairBase | null {
	if (a === b) return null;
	const row = db
		.select({ json: clonePairs.baseJson })
		.from(clonePairs)
		.where(pairWhere(kind, a, b))
		.get();
	if (!row) return null;
	const parsed = JSON.parse(row.json) as Partial<PairBase>;
	return { fields: parsed.fields ?? {}, skip: parsed.skip ?? [] };
}

/** Record that the two are in step as `base` says, at `now` (insert or replace). */
export function writePair(
	tx: Db,
	kind: CloneKind,
	a: number,
	b: number,
	base: PairBase,
	now: number
): void {
	const [aId, bId] = ordered(a, b);
	const baseJson = JSON.stringify({ fields: base.fields, skip: base.skip });
	tx.insert(clonePairs)
		.values({ kind, aId, bId, baseJson, at: now })
		.onConflictDoUpdate({
			target: [clonePairs.kind, clonePairs.aId, clonePairs.bId],
			set: { baseJson, at: now }
		})
		.run();
}

/** When the two were last in step, or null when never. */
export function pairAt(db: Db, kind: CloneKind, a: number, b: number): number | null {
	if (a === b) return null;
	const row = db
		.select({ at: clonePairs.at })
		.from(clonePairs)
		.where(pairWhere(kind, a, b))
		.get();
	return row?.at ?? null;
}

/** Forget every snapshot this member is in (it left its family). */
export function dropPairs(tx: Db, kind: CloneKind, id: number): void {
	tx.delete(clonePairs)
		.where(and(eq(clonePairs.kind, kind), or(eq(clonePairs.aId, id), eq(clonePairs.bId, id))))
		.run();
}

/**
 * A member's content as one hash: the `seen` of a comparison, so a write
 * refuses when the target changed since the sheet was opened. Key order does
 * not matter; every key and value does. The sorted `[key, value]` pairs are
 * hashed as JSON, so an `=` or a newline inside a URL or a note cannot make
 * two different members read the same.
 */
export function digest(flat: Flat): string {
	const lines = Object.keys(flat)
		.sort()
		.map((key) => [key, flat[key].value]);
	return hashValue(JSON.stringify(lines));
}
