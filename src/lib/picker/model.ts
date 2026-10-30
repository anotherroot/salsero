/**
 * The shared picker's model: groups of rows, and which lines a search leaves.
 *
 * PURE and client-safe. The picker component renders `shown`'s lines and
 * knows nothing else about figures, videos or drills.
 */

/** One pickable row. `key` is unique in the picker ("figure:12", "exercise:3", "spot:7", "group:4", "routine:2"). */
export interface PickRow {
	key: string;
	/** The id posted or linked. */
	value: number;
	/** Full label, shown when the row stands alone: "Enchufla · Doble". */
	label: string;
	/** Shown under a heading instead of `label`: "Doble". Defaults to `label`. */
	short?: string;
	meta?: string;
	/** Extra text the search matches (a section's time range). Never `meta`. */
	keywords?: string;
	linked?: boolean;
	/** A section: ▶ previews it. */
	preview?: boolean;
}

/** A heading over rows: a figure over its variations, a video over its sections. */
export interface PickHeading {
	heading: string;
	rows: PickRow[];
	/** A figure: with exactly one row (counted before search) it shows as that row alone. A video: false. */
	collapse: boolean;
}

export type PickEntry = PickRow | PickHeading;

export interface PickGroup {
	title: string;
	entries: PickEntry[];
}

export type PickLine =
	| { kind: 'group'; title: string }
	| { kind: 'heading'; text: string }
	| { kind: 'row'; row: PickRow; text: string; indent: boolean };

/** Lowercase, accents stripped: "Dile Qué Nó" and "dile que no" are one search. */
export function fold(s: string): string {
	return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export const isHeading = (e: PickEntry): e is PickHeading => 'heading' in e;

/**
 * The lines a query leaves, in group order. A row matches when every word of
 * the query appears somewhere in its heading, label, short name or keywords
 * (never `meta`). A heading with one row (counted before the search) and
 * `collapse` shows as that row alone, under its full label.
 */
export function shown(groups: PickGroup[], query: string): PickLine[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	const matches = (heading: string, row: PickRow): boolean => {
		const hay = fold([heading, row.label, row.short ?? '', row.keywords ?? ''].join(' '));
		return words.every((w) => hay.includes(w));
	};
	const lines: PickLine[] = [];
	for (const g of groups) {
		const out: PickLine[] = [];
		for (const e of g.entries) {
			if (isHeading(e)) {
				const rows = e.rows.filter((r) => matches(e.heading, r));
				if (rows.length === 0) continue;
				if (e.collapse && e.rows.length === 1) {
					out.push({ kind: 'row', row: rows[0], text: rows[0].label, indent: false });
				} else {
					out.push({ kind: 'heading', text: e.heading });
					for (const row of rows) {
						out.push({ kind: 'row', row, text: row.short ?? row.label, indent: true });
					}
				}
			} else if (matches('', e)) {
				out.push({ kind: 'row', row: e, text: e.label, indent: false });
			}
		}
		if (out.length > 0) lines.push({ kind: 'group', title: g.title }, ...out);
	}
	return lines;
}
