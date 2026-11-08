/**
 * The Moves tab's three segments. Each is its own route — `/[dance]/(moves)/figures`,
 * `/[dance]/(moves)/routines` and `/[dance]/(moves)/positions` — under one band, the (moves)
 * layout's, whose switch picks between them. PURE.
 */
import { t } from '$lib/i18n/catalog';

export type MovesSegment = 'figures' | 'routines' | 'positions';

const segment = (value: MovesSegment): { value: MovesSegment; label: string } => ({
	value,
	// Read when drawn: the reader's language.
	get label() {
		return t().moves.segments[value];
	}
});

export const MOVES_SEGMENTS: readonly { value: MovesSegment; label: string }[] = [
	segment('figures'),
	segment('routines'),
	segment('positions')
];

const ROUTES: Record<string, MovesSegment> = {
	'/[dance]/(moves)/figures': 'figures',
	'/[dance]/(moves)/routines': 'routines',
	'/[dance]/(moves)/positions': 'positions'
};

/** The route id each segment's list is. */
export const SEGMENT_ROUTE: Record<MovesSegment, string> = {
	figures: '/[dance]/(moves)/figures',
	routines: '/[dance]/(moves)/routines',
	positions: '/[dance]/(moves)/positions'
};

/**
 * The segment a route id draws, or null for anything else (a figure's page,
 * Coverage…). Positions stays lit under its own pages (a position, No
 * position, the map): on a wide screen they sit beside its list.
 */
export function segmentOf(routeId: string | null): MovesSegment | null {
	if (!routeId) return null;
	if (routeId.startsWith('/[dance]/(moves)/positions/')) return 'positions';
	return ROUTES[routeId] ?? null;
}
