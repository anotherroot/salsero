/**
 * The Positions list's filter rules, applied where the list is drawn (the
 * layout loads the list once, unfiltered). PURE, client-safe.
 */
import { fold } from '$lib/fold';
import type { PositionListRow, TeamRef } from '$lib/types';
import { OTHER_TYPE, type PositionFilter } from './view';

/** The filter in the URL: `q` trimmed; a type only the dance has (or Other); gaps never in group mode. */
export function parsePositionFilter(
	params: URLSearchParams,
	types: readonly string[],
	groupMode: boolean
): PositionFilter {
	const type = params.get('type');
	return {
		q: params.get('q')?.trim() ?? '',
		// Other is untyped rows too, so it is taken where the dance has no such type (bachata).
		...(type && (types.includes(type) || type === OTHER_TYPE) ? { type } : {}),
		// Gaps are the person's own report: group mode has none.
		...(!groupMode && params.get('gaps') === '1' ? { gaps: '1' as const } : {})
	};
}

const hasGap = (r: PositionListRow) => r.deadEnd || r.orphan || r.island;

export function positionMatches(r: PositionListRow, f: PositionFilter): boolean {
	return (
		(!f.q || fold(r.name).includes(fold(f.q))) &&
		(!f.type || r.styleTag === f.type || (r.styleTag === null && f.type === OTHER_TYPE)) &&
		(!f.gaps || hasGap(r))
	);
}

/** The Positions list as the layout loads it: rows and groups unfiltered. */
export interface PositionsLists {
	rows: PositionListRow[];
	groups: { team: TeamRef; rows: PositionListRow[] }[];
	none: { none: number; onlyStart: number; onlyEnd: number };
	tagged: { done: number; total: number };
	/** The Gaps chip's count, whatever the other chips. */
	gaps: number;
	/** Whether the space has positions of its own: the Gaps chip is about them. */
	hasOwn: boolean;
	/** Whether any row, before filtering, has no type. */
	untyped: boolean;
	types: string[];
	styleLabel: Record<string, string>;
	defaultStyle: string;
	/** The space's own names, folded: Templates marks them "You have it". */
	owned: string[];
	/** In a group's own workspace. */
	inGroupMode: boolean;
}

export function positionsView(
	l: PositionsLists,
	f: PositionFilter
): { rows: PositionListRow[]; groups: { team: TeamRef; rows: PositionListRow[] }[] } {
	return {
		rows: l.rows.filter((r) => positionMatches(r, f)),
		// Gaps are about the person's own: a group's rows step aside under the chip.
		groups: f.gaps
			? []
			: l.groups
					.map((g) => ({ team: g.team, rows: g.rows.filter((r) => positionMatches(r, f)) }))
					.filter((g) => g.rows.length > 0)
	};
}

/**
 * Nothing at all: no positions of the space's own or of a group, and nothing
 * narrows the list. The list's first run (the empty state's three buttons), and
 * on the desktop How positions work in the pane where the map would be.
 */
export function nothingAt(l: PositionsLists, f: PositionFilter): boolean {
	const view = positionsView(l, f);
	return !(f.q || f.type || f.gaps) && view.rows.length === 0 && view.groups.length === 0;
}
