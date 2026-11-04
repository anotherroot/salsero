/**
 * The Figures list's rules: the filter in the URL, the chips, the heading,
 * which empty state, whether the tiles show, and the words under each row.
 * The page only lays these out. PURE.
 */
import { PARTNER, PARTNER_LABEL, type Partner } from '$lib/labels';
import { movesHeading } from './list';

/** The load's `filter`: the search is always a string, the rest only when set. */
export type FigureFilter = { q: string; style?: string; partner?: Partner; unlinked?: '1' };

export type FigureChip = {
	key: string;
	label: string;
	count?: number;
	on: boolean;
	/** What tapping it does to the filter. Never touches `q`. */
	change: Partial<FigureFilter>;
};

/** The query's keys in the load's order. */
const KEYS = ['q', 'style', 'partner', 'unlinked'] as const;

/**
 * The query string for `filter` with `change` applied, without the `?`:
 * `"q=en&style=son"`. Empty values are dropped; `''` when nothing is set.
 */
export function filterQuery(filter: FigureFilter, change: Partial<FigureFilter>): string {
	const next: Partial<FigureFilter> = { ...filter, ...change };
	return KEYS.filter((k) => next[k])
		.map((k) => `${k}=${encodeURIComponent(next[k] as string)}`)
		.join('&');
}

/**
 * The chip row: All · Not linked · the dance's styles · With partner · Solo.
 * Style and partner are single-valued — the on one clears, another replaces.
 * All is on when no chip is, and clears them all; no chip ever drops the search.
 */
export function filterChips(
	filter: FigureFilter,
	styles: readonly string[],
	styleLabel: Record<string, string>,
	unlinkedCount: number
): FigureChip[] {
	const none = !filter.style && !filter.partner && !filter.unlinked;
	return [
		{
			key: 'all',
			label: 'All',
			on: none,
			change: { style: undefined, partner: undefined, unlinked: undefined }
		},
		{
			key: 'unlinked',
			label: 'Not linked',
			count: unlinkedCount,
			on: !!filter.unlinked,
			change: { unlinked: filter.unlinked ? undefined : '1' }
		},
		...styles.map((s) => ({
			key: `style:${s}`,
			label: styleLabel[s] ?? s,
			on: filter.style === s,
			change: { style: filter.style === s ? undefined : s }
		})),
		...PARTNER.map((p) => ({
			key: `partner:${p}`,
			label: PARTNER_LABEL[p],
			on: filter.partner === p,
			change: { partner: filter.partner === p ? undefined : p }
		}))
	];
}

/**
 * The label above the list. Not linked names what is missing; a search or a
 * style or partner chip makes it a count of matching figures.
 */
export function figuresHeading(
	n: { moves: number; figures: number },
	filter: FigureFilter
): string {
	if (filter.unlinked) return `${n.figures} with no section or no lesson`;
	return movesHeading(n, !!(filter.q || filter.style || filter.partner));
}

/**
 * Which empty state an empty list shows: nothing in the dance at all, Not
 * linked with nothing left to link, or a filter that matches nothing.
 */
export function figuresEmpty(
	count: number,
	filter: FigureFilter
): 'none' | 'all-linked' | 'no-match' | null {
	if (count > 0) return null;
	const narrowed = filter.q || filter.style || filter.partner;
	if (filter.unlinked) return narrowed ? 'no-match' : 'all-linked';
	return narrowed ? 'no-match' : 'none';
}

/** The Coverage tile steps aside while a search runs, and on an empty list. */
export function showTiles(count: number, filter: FigureFilter): boolean {
	return count > 0 && !filter.q;
}

/** A group's slight heading over its figures in Moves: "Salsa nadaljevalna · 4". */
export function groupHeading(name: string, count: number): string {
	return `${name} · ${count}`;
}

/** The Coverage tile's meta line (Positions is a Moves segment now, not a tile). */
export function tileMetas(unrouted: number): { coverage: { text: string; status: boolean } } {
	return {
		coverage:
			unrouted > 0
				? { text: `${unrouted} in no routine`, status: true }
				: { text: 'All in a routine', status: false }
	};
}
