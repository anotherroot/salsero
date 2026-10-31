/**
 * The Moves tab's two segments. Each is its own route — `/[dance]/figures`
 * and `/[dance]/routines` — drawn inside one `MovesScreen` whose band carries
 * the switch. PURE.
 */

export type MovesSegment = 'figures' | 'routines';

export const MOVES_SEGMENTS: readonly { value: MovesSegment; label: string }[] = [
	{ value: 'figures', label: 'Figures' },
	{ value: 'routines', label: 'Routines' }
];

const ROUTES: Record<string, MovesSegment> = {
	'/[dance]/figures': 'figures',
	'/[dance]/routines': 'routines'
};

/** The segment a route id draws, or null for anything else (a figure's page, Coverage…). */
export function segmentOf(routeId: string | null): MovesSegment | null {
	return (routeId && ROUTES[routeId]) || null;
}
