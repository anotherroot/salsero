/**
 * The pick list's posted picks (`picks`, JSON): which items, with the title,
 * artist and style typed for each. Null when anything is off (not a list, an
 * index out of range or twice); a style outside the dance's falls back to
 * Style for all, an empty title to the item's own, an empty artist to none.
 */
import type { ImportItem } from '$lib/types';
import type { Pick } from './song-imports';

export function readPicks(
	raw: string,
	items: ImportItem[],
	styles: readonly string[],
	styleForAll: string
): Pick[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const seen = new Set<number>();
	const out: Pick[] = [];
	for (const p of parsed) {
		if (p === null || typeof p !== 'object') return null;
		const r = p as Record<string, unknown>;
		const i = r.i;
		if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= items.length) return null;
		if (seen.has(i)) return null;
		seen.add(i);
		const typed = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
		out.push({
			i,
			title: typed(r.title) || items[i].title,
			artist: typed(r.artist) || null,
			style: typeof r.style === 'string' && styles.includes(r.style) ? r.style : styleForAll
		});
	}
	return out;
}
