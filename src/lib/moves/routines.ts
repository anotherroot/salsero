import { plural } from '$lib/format';

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

/** A group's slight heading over its routines in Moves: "Salsa Tuesdays · 2". */
export function groupRoutinesHeading(name: string, count: number): string {
	return `${name} · ${count}`;
}
