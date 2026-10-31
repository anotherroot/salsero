import { plural } from '$lib/format';

/** What the graph says about one position (the server's `PositionCount`, without the id). */
export interface PositionCounts {
	inCount: number;
	outCount: number;
	deadEnd: boolean;
	orphan: boolean;
	unused: boolean;
}

/** The row's second line: the counts, then the one word that matters. PURE. */
export function positionMeta(c: PositionCounts): {
	text: string;
	tone: 'danger' | null;
	mutedTitle: boolean;
} {
	const word = c.deadEnd ? 'dead end' : c.orphan ? 'orphan' : c.unused ? 'unused' : null;
	return {
		text: `${c.inCount} in · ${c.outCount} out${word ? ` · ${word}` : ''}`,
		tone: c.deadEnd || c.orphan ? 'danger' : null,
		mutedTitle: c.unused
	};
}

/** The badges in the row's sheet. PURE. */
export function positionBadges(
	c: PositionCounts
): { text: string; tone: 'neutral' | 'danger'; icon?: 'warning' }[] {
	const badges: { text: string; tone: 'neutral' | 'danger'; icon?: 'warning' }[] = [
		{ text: `${c.inCount} in`, tone: 'neutral' },
		{ text: `${c.outCount} out`, tone: 'neutral' }
	];
	if (c.deadEnd) badges.push({ text: 'dead end', tone: 'danger', icon: 'warning' });
	else if (c.orphan) badges.push({ text: 'orphan', tone: 'danger', icon: 'warning' });
	else if (c.unused) badges.push({ text: 'unused', tone: 'neutral' });
	return badges;
}

/** The warning's title, or null when the graph has no gap. PURE. */
export function gapsTitle(rows: { deadEnd: boolean; orphan: boolean }[]): string | null {
	const n = rows.filter((r) => r.deadEnd || r.orphan).length;
	return n === 0 ? null : `${plural(n, 'gap', 'gaps')} in the graph`;
}
