import { plural } from '$lib/format';
import type { RoutineItem, TeamRef } from '$lib/types';

/** The Routines list as the (moves) layout loads it. */
export interface RoutinesLists {
	/** The space's own, with what the graph says of each. */
	routines: (RoutineItem & { loops: boolean; breaks: number })[];
	/** Each group's routines from the lessons the person added (none in group mode). */
	groups: { team: TeamRef; routines: RoutineItem[] }[];
	/** The routines that stand for their twins: the "Twins" chip. */
	twinned: number[];
}

export type RoutineBadge = { tone: 'danger' | 'warn'; text: string };

/**
 * The badges after a routine's slot count on the Routines list: breaks
 * (danger), then "does not loop" (warn). An empty routine has nothing to
 * loop, so it is not called out for it. PURE.
 */
export function routineBadges(r: {
	slots: number;
	breaks: number;
	loops: boolean;
}): RoutineBadge[] {
	const out: RoutineBadge[] = [];
	if (r.breaks > 0) out.push({ tone: 'danger', text: plural(r.breaks, 'break', 'breaks') });
	if (!r.loops && r.slots > 0) out.push({ tone: 'warn', text: 'does not loop' });
	return out;
}

/** A routine's class day as a screen reader hears it: "From class Tue 3 Nov". */
export function fromClass(label: string): string {
	return `From class ${label}`;
}
