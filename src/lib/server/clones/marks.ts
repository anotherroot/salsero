/**
 * Marks: for a copy, a hash per field of what it held after its last save or
 * flow (clone sync). A save compares the row with its mark to learn exactly
 * what it changed (`changedKeys`, `$lib/clones/sync`). Hashed like a pair
 * snapshot (`hashValue`), so a mark and a snapshot compare. Pieces
 * (recordings, videos, spots) have no marks: their keys are in the root's flat.
 */
import { and, eq } from 'drizzle-orm';
import type { CloneKind, Flat } from '$lib/types';
import type { Db } from '../db';
import { appFlags, cloneMarks } from '../db/schema';
import { liveGenes } from './genes';
import { hashValue } from './pairs';
import { flatOf } from './trees';

const FLAG = 'clone-marks-1';
const KINDS: CloneKind[] = ['figure', 'routine', 'drill', 'song', 'lesson', 'position'];

/** What the copy last held, or null when it has no mark. */
export function readMark(db: Db, kind: CloneKind, id: number): Record<string, string> | null {
	const row = db
		.select({ json: cloneMarks.fieldsJson })
		.from(cloneMarks)
		.where(and(eq(cloneMarks.kind, kind), eq(cloneMarks.rowId, id)))
		.get();
	return row ? (JSON.parse(row.json) as Record<string, string>) : null;
}

/** Record `flat` as what the row holds now. */
export function writeMark(tx: Db, kind: CloneKind, id: number, flat: Flat, now: number): void {
	const fields: Record<string, string> = {};
	for (const [key, field] of Object.entries(flat)) fields[key] = hashValue(field.value);
	const fieldsJson = JSON.stringify(fields);
	tx.insert(cloneMarks)
		.values({ kind, rowId: id, fieldsJson, at: now })
		.onConflictDoUpdate({
			target: [cloneMarks.kind, cloneMarks.rowId],
			set: { fieldsJson, at: now }
		})
		.run();
}

/**
 * Rename the mark's keys by `keyOf`, keeping every hash: a `#<id>` key of a
 * row that a copy has since stamped with a gene reads as the gene, as the
 * row's flat now names it. Values never change, so a save that landed in
 * between still reads as changed. Nothing written when no key moves.
 */
export function rekeyMark(
	tx: Db,
	kind: CloneKind,
	id: number,
	keyOf: (key: string) => string
): void {
	const mark = readMark(tx, kind, id);
	if (!mark) return;
	const fields: Record<string, string> = {};
	let moved = false;
	for (const [key, hash] of Object.entries(mark)) {
		const now = keyOf(key);
		if (now !== key) moved = true;
		fields[now] = hash;
	}
	if (!moved) return;
	tx.update(cloneMarks)
		.set({ fieldsJson: JSON.stringify(fields) })
		.where(and(eq(cloneMarks.kind, kind), eq(cloneMarks.rowId, id)))
		.run();
}

/** `writeMark` of the row as it is. */
export function markNow(tx: Db, kind: CloneKind, id: number, now: number): void {
	writeMark(tx, kind, id, flatOf(tx, kind, id), now);
}

/**
 * Once EVER (`app_flags`): mark every live row whose gene has more than one
 * live member, so the first save after deploy knows what it changed. A row
 * that cannot be read is logged and skipped, never fails the step (boot runs
 * it on every request until it succeeds): unmarked, its first save flows
 * nothing and marks it, as any copy without a mark.
 */
export function markFamilies(db: Db, now: number): { ran: boolean; marked: number } {
	return db.transaction((tx) => {
		if (tx.select().from(appFlags).where(eq(appFlags.key, FLAG)).get()) {
			return { ran: false, marked: 0 };
		}
		tx.insert(appFlags).values({ key: FLAG, doneAt: now }).run();
		let marked = 0;
		for (const kind of KINDS) {
			const rows = liveGenes(tx, kind);
			const sizes = new Map<string, number>();
			for (const r of rows) sizes.set(r.gene, (sizes.get(r.gene) ?? 0) + 1);
			for (const r of rows) {
				if ((sizes.get(r.gene) ?? 0) < 2) continue;
				try {
					markNow(tx, kind, r.id, now);
					marked += 1;
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`[clone-marks] skipped ${kind} ${r.id}: ${message}`);
				}
			}
		}
		return { ran: true, marked };
	});
}
