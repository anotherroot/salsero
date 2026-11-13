import { t } from '$lib/i18n/catalog';
import type { RoutineItem, TeamRef } from '$lib/types';
import { outOfSync } from './sync';

/** The Routines list as the (moves) layout loads it. */
export interface RoutinesLists {
	/** The space's own, with what the graph says of each. */
	routines: (RoutineItem & {
		loops: boolean;
		breaks: number;
		/** L4 (spec 2026-11-12): where it starts and ends, by name; null when unnamed. */
		start: string | null;
		end: string | null;
		figures: number;
		eights: number;
	})[];
	/** Each group's routines from the lessons the person added (none in group mode). */
	groups: { team: TeamRef; routines: RoutineItem[] }[];
	/** The routines that stand for their twins: the "Twins" chip. */
	twinned: number[];
}

export type RoutineBadge = { tone: 'danger' | 'warn'; text: string };

/**
 * The badges on a Routines list row: breaks (danger) only. Whether it loops
 * reads from its start → end line, ↻ when it does (spec 2026-11-12, L4). PURE.
 */
export function routineBadges(r: {
	slots: number;
	breaks: number;
	loops: boolean;
}): RoutineBadge[] {
	const out: RoutineBadge[] = [];
	if (r.breaks > 0) out.push({ tone: 'danger', text: t().nouns.breaks(r.breaks) });
	return out;
}

/** A routine's class day as a screen reader hears it: "From class Tue 3 Nov". */
export function fromClass(label: string): string {
	return t().moves.routines.fromClass(label);
}

/** The Routines list under `?sync=1`: only the routines a copy of which differs. */
export function routinesView(l: RoutinesLists, sync: boolean): RoutinesLists {
	if (!sync) return l;
	return {
		...l,
		routines: l.routines.filter(outOfSync),
		groups: l.groups
			.map((g) => ({ team: g.team, routines: g.routines.filter(outOfSync) }))
			.filter((g) => g.routines.length > 0)
	};
}
