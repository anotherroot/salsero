/**
 * Where a same-named copy came from, drawn and never stored. PURE, client-safe.
 * Two rows of one list that share a (folded) name: each one with a `from` (the
 * place of its `cloned_from`) gets "· <place>"; a lone name is left plain.
 */
import { fold } from '$lib/fold';

const key = (name: string) => fold(name.trim());

/** Row id → "· Sreda 17:30", for the rows of ONE list that collide by name and know where they came from. */
export function fromTags<T extends { id: number; name: string; from: string | null }>(
	rows: T[]
): Map<number, string> {
	const seen = new Map<string, number>();
	for (const r of rows) seen.set(key(r.name), (seen.get(key(r.name)) ?? 0) + 1);
	const tags = new Map<number, string>();
	for (const r of rows) {
		if (r.from && (seen.get(key(r.name)) ?? 0) > 1) tags.set(r.id, `· ${r.from}`);
	}
	return tags;
}

/** "Basic · Sreda 17:30", or the name as it is. */
export function shownName(row: { id: number; name: string }, tags: Map<number, string>): string {
	const tag = tags.get(row.id);
	return tag ? `${row.name} ${tag}` : row.name;
}
