/**
 * The Figures list's filter rules, applied where the list is drawn (the
 * layout loads the list once, unfiltered; a search never asks the server).
 * PURE, client-safe.
 */
import { PARTNER } from '$lib/labels';
import { foldMoves } from '$lib/clones/twins';
import type { FigureRow, MoveRow, MoveTarget, TeamRef } from '$lib/types';
import type { FigureFilter } from './figures';

/** The filter in the URL: `q` trimmed, the rest only when valid. */
export function parseFigureFilter(
	params: URLSearchParams,
	styles: readonly string[]
): FigureFilter {
	const q = params.get('q')?.trim() ?? '';
	const style = params.get('style') ?? '';
	const partner = params.get('partner') ?? '';
	const filter: FigureFilter = { q };
	if (styles.includes(style)) filter.style = style;
	if ((PARTNER as readonly string[]).includes(partner)) {
		filter.partner = partner as FigureFilter['partner'];
	}
	if (params.get('unlinked') === '1') filter.unlinked = '1';
	if (params.get('sync') === '1') filter.sync = '1';
	return filter;
}

/**
 * Whether a figure stays under the filter: the search matches its move's name
 * or its own; style and partner; Not linked keeps a figure with no section or
 * no lesson.
 */
export function figureMatches(
	moveName: string,
	f: Pick<FigureRow, 'name' | 'style' | 'partner' | 'hasSection' | 'hasLesson' | 'differ'>,
	filter: FigureFilter
): boolean {
	const q = filter.q.trim().toLowerCase();
	if (q && !moveName.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q)) return false;
	if (filter.style && f.style !== filter.style) return false;
	if (filter.partner && f.partner !== filter.partner) return false;
	if (filter.unlinked && f.hasSection && f.hasLesson) return false;
	if (filter.sync && !((f.differ ?? 0) > 0)) return false;
	return true;
}

/** The Figures list as the layout loads it: unfiltered, unfolded. */
export interface FiguresLists {
	mine: MoveRow[];
	groups: { team: TeamRef; moves: MoveRow[] }[];
	sets: number[][];
	groupMode: boolean;
	/** Figures with no section or no lesson, whatever the filter. */
	unlinked: number;
	/** Versions no routine can call; null in group mode. */
	unrouted: number | null;
	defaultStyle: string;
	/** New figure's Move field: the space's own live moves (a group's in group mode). */
	moveTargets: MoveTarget[];
}

type Shown = MoveRow & { also: string[] };

function filtered(moves: MoveRow[], filter: FigureFilter): MoveRow[] {
	return moves
		.map((m) => ({ ...m, figures: m.figures.filter((f) => figureMatches(m.name, f, filter)) }))
		.filter((m) => m.figures.length > 0);
}

/** What the list shows under `filter`: filtered first, then twins folded. */
export function figuresView(
	l: FiguresLists,
	filter: FigureFilter
): {
	figures: Shown[];
	groups: { team: TeamRef; moves: Shown[] }[];
	twinned: number[];
} {
	const mine = filtered(l.mine, filter);
	if (l.groupMode) {
		// Groups have no twins: nothing folds, no move says "also in".
		return { figures: mine.map((m) => ({ ...m, also: [] })), groups: [], twinned: [] };
	}
	// Not linked is about the person's own figures only.
	const groups = filter.unlinked
		? []
		: l.groups
				.map((g) => ({ team: g.team, moves: filtered(g.moves, filter) }))
				.filter((g) => g.moves.length > 0);
	const folded = foldMoves(mine, groups, l.sets);
	return { figures: folded.mine, groups: folded.groups, twinned: [...folded.twinOf.keys()] };
}
