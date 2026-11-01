import type { DanceSlug } from '$lib/dances/dances';
import type { IconName } from '$lib/icons/icons';

export type TabId = 'today' | 'moves' | 'lessons' | 'music';

export const TABS: readonly {
	id: TabId;
	label: string;
	icon: IconName;
	path: '/[dance]' | '/[dance]/figures' | '/[dance]/lessons' | '/[dance]/songs';
}[] = [
	{ id: 'today', label: 'Today', icon: 'today', path: '/[dance]' },
	{ id: 'moves', label: 'Moves', icon: 'moves', path: '/[dance]/figures' },
	{ id: 'lessons', label: 'Lessons', icon: 'lessons', path: '/[dance]/lessons' },
	{ id: 'music', label: 'Music', icon: 'music', path: '/[dance]/songs' }
];

/** First segment after the dance -> the tab it belongs to. */
const SECTION: Record<string, TabId> = {
	exercises: 'today',
	figures: 'moves',
	routines: 'moves',
	positions: 'moves',
	coverage: 'moves',
	lessons: 'lessons',
	songs: 'music',
	player: 'music'
};

/**
 * Which tab is lit, decided on the path AFTER the dance segment — the tabs
 * never leave the dance you are in, so the slug itself says nothing about
 * which one you are on.
 *
 * The prefix test is not a formality: shared pages (`/settings`, `/voice`)
 * live outside the dance, and slicing a same-length path off blind lights up
 * Today on `/voice` (six characters, exactly like `/salsa`).
 */
export function tabFor(path: string, dance: DanceSlug): TabId | null {
	const prefix = `/${dance}`;
	if (path !== prefix && !path.startsWith(`${prefix}/`)) return null;
	const first = path.slice(prefix.length).split('/')[1] ?? '';
	if (first === '') return 'today';
	return SECTION[first] ?? null;
}

/** The main lists a tab opens on. Moves has two: figures and routines. */
export function rootsOf(tab: TabId, dance: DanceSlug): string[] {
	if (tab === 'moves') return [`/${dance}/figures`, `/${dance}/routines`];
	const path = { today: '', lessons: '/lessons', music: '/songs' }[tab];
	return [`/${dance}${path}`];
}

const TOP_LEVEL = new Set([
	'/[dance]',
	'/[dance]/figures',
	'/[dance]/routines',
	'/[dance]/lessons',
	'/[dance]/songs'
]);

/** The bar is for the four top-level screens only; detail screens have a Back. */
export function showsTabs(routeId: string | null): boolean {
	return routeId != null && TOP_LEVEL.has(routeId);
}
