/**
 * The Figures list's rules: the filter in the URL, the chips, the heading,
 * which empty state, whether the tiles show, and the words under each row.
 * The page only lays these out. PURE.
 */
import { PARTNER, type Partner } from '$lib/labels';
import { t } from '$lib/i18n/catalog';
import { movesHeading } from './list';

/** The load's `filter`: the search is always a string, the rest only when set. */
export type FigureFilter = {
	q: string;
	style?: string;
	partner?: Partner;
	unlinked?: '1';
	sync?: '1';
};

export type FigureChip = {
	key: string;
	label: string;
	count?: number;
	on: boolean;
	/** What tapping it does to the filter. Never touches `q`. */
	change: Partial<FigureFilter>;
};

/** The query's keys in the load's order. */
const KEYS = ['q', 'style', 'partner', 'unlinked', 'sync'] as const;

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
 * A dance's style labels (`DANCES[dance].styleLabel`) in the reader's language:
 * the catalog's word where it has one ("Other" → "Drugo"), else the registry's
 * (Salsa, Son and Timba are the same everywhere).
 */
export function styleLabelsOf(labels: Record<string, string>): Record<string, string> {
	const words = t().moves.styles;
	return Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, words[k] ?? v]));
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
	const none = !filter.style && !filter.partner && !filter.unlinked && !filter.sync;
	return [
		{
			key: 'all',
			label: t().moves.chips.all,
			on: none,
			change: { style: undefined, partner: undefined, unlinked: undefined, sync: undefined }
		},
		{
			key: 'unlinked',
			label: t().moves.chips.unlinked,
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
			label: t().moves.chips[p],
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
	if (filter.unlinked) return t().moves.heading.unlinked(n.figures);
	return movesHeading(n, !!(filter.q || filter.style || filter.partner || filter.sync));
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
	const narrowed = filter.q || filter.style || filter.partner || filter.sync;
	if (filter.unlinked) return narrowed ? 'no-match' : 'all-linked';
	return narrowed ? 'no-match' : 'none';
}

/** The Coverage tile steps aside while a search runs, and on an empty list. */
export function showTiles(count: number, filter: FigureFilter): boolean {
	return count > 0 && !filter.q;
}

/**
 * The line under a group's name where its rows start in a Moves list (the
 * name itself is the heading, larger than a move's): "Group · 3 figures".
 */
export function groupMeta(kind: 'figure' | 'routine' | 'position', count: number): string {
	const c = t();
	const counted = {
		figure: c.nouns.figures,
		routine: c.nouns.routines,
		position: c.nouns.positions
	}[kind];
	return `${c.moves.heading.group} · ${counted(count)}`;
}

/** The Coverage tile's meta line (Positions is a Moves segment now, not a tile). */
export function tileMetas(unrouted: number): { coverage: { text: string; status: boolean } } {
	return {
		coverage:
			unrouted > 0
				? { text: t().moves.tile.unrouted(unrouted), status: true }
				: { text: t().moves.tile.allRouted, status: false }
	};
}
