import type { DanceSlug } from '$lib/dances/dances';
import type { IconName } from '$lib/icons/icons';
import { t } from '$lib/i18n/catalog';
import { groupsTabLabel } from '$lib/teams/view';

export type TabId = 'today' | 'moves' | 'lessons' | 'music' | 'groups' | 'you';

export interface Tab {
	id: TabId;
	label: string;
	icon: IconName;
	path:
		| '/[dance]/(today)'
		| '/[dance]/(moves)/figures'
		| '/[dance]/lessons'
		| '/[dance]/songs'
		| '/[dance]/groups'
		| '/[dance]/you';
}

/**
 * Every tab, in order, named in the current language (a function, so the labels
 * are read at call time). A person sees the ones their level gives (`tabsFor` on
 * the phone, `sideTabsFor` on the desktop, `$lib/levels/levels.ts`). On the
 * phone the Groups tab is "You" (the groups, then the settings), except at
 * Follow my class, where it is "My class" and You is a tab of its own
 * (`/[dance]/you`, the settings alone). The desktop's side has no You: it has
 * Settings.
 */
export function tabs(): readonly Tab[] {
	const w = t().shell.tabs;
	return [
		{ id: 'today', label: w.today, icon: 'today', path: '/[dance]/(today)' },
		{ id: 'moves', label: w.moves, icon: 'moves', path: '/[dance]/(moves)/figures' },
		{ id: 'lessons', label: w.lessons, icon: 'lessons', path: '/[dance]/lessons' },
		{ id: 'music', label: w.music, icon: 'music', path: '/[dance]/songs' },
		{ id: 'groups', label: w.groups, icon: 'group', path: '/[dance]/groups' },
		{ id: 'you', label: w.you, icon: 'solo', path: '/[dance]/you' }
	];
}

/** First segment after the dance -> the tab it belongs to. */
const SECTION: Record<string, TabId> = {
	exercises: 'today',
	'coming-up': 'today',
	done: 'today',
	figures: 'moves',
	routines: 'moves',
	moves: 'moves',
	positions: 'moves',
	coverage: 'moves',
	lessons: 'lessons',
	groups: 'groups',
	songs: 'music',
	player: 'music',
	you: 'you',
	suggestions: 'you'
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

/** The main lists a tab opens on. Moves has three: figures, routines and positions. */
export function rootsOf(tab: TabId, dance: DanceSlug): string[] {
	if (tab === 'moves') return [`/${dance}/figures`, `/${dance}/routines`, `/${dance}/positions`];
	const path = {
		today: '',
		lessons: '/lessons',
		music: '/songs',
		groups: '/groups',
		you: '/you'
	}[tab];
	return [`/${dance}${path}`];
}

/** Inside a dance the bar stays, except where the app is the whole screen. */
const BARE = new Set(['/[dance]/player', '/[dance]/share']);

/**
 * The bar shows on every screen of a dance but Practice and share: pushed
 * screens keep it so a tab is always one tap away (edit and selection bars
 * take the bottom while they show, see `chrome.svelte.ts`).
 */
export function showsTabs(routeId: string | null): boolean {
	if (routeId == null) return false;
	if (!routeId.startsWith('/[dance]/')) return false;
	return !BARE.has(routeId);
}

/**
 * What a click on a tab does: a modified or non-primary click is the browser's
 * (a new tab, a download), a plain one goes to the tab, or, on the lit tab's own
 * list (no href of its own, `tabHref`), scrolls the list to the top.
 */
export function tapKind(
	e: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
	scrollTop: boolean
): 'pass' | 'tab' | 'top' {
	if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return 'pass';
	return scrollTop ? 'top' : 'tab';
}

/**
 * A tab's dot: Groups while something is new there, Music while a read playlist
 * waits to be picked, You while the AI's suggestions wait to be run or the
 * phone is short of space. `data` is the page's data, as the tab bar has it
 * (the `[dance]` layout's `groupsNew`, `musicToPick` and `aiPending`), plus
 * `lowSpace`, which the tab bar adds from the device (offline phase 4b).
 */
export function tabDot(id: TabId, data: Record<string, unknown>): boolean {
	if (id === 'groups') return !!data.groupsNew || Number(data.aiPending ?? 0) > 0;
	if (id === 'music') return !!data.musicToPick;
	if (id === 'you') return Number(data.aiPending ?? 0) > 0 || !!data.lowSpace;
	return false;
}

/** A dotted tab's name for a screen reader: what the dot means. */
export function tabDotLabel(id: TabId, label: string, data: Record<string, unknown> = {}): string {
	if (id === 'groups') return groupsTabLabel(true, label);
	if (id === 'music') return t().shell.tabs.musicToPick(label);
	if (id === 'you') {
		// Short of space says so unless suggestions wait too (that dot was there first).
		if (data.lowSpace && !(Number(data.aiPending ?? 0) > 0)) {
			return t().settings.onPhone.low.tabLabel(label);
		}
		return t().suggestions.tabLabel(label);
	}
	return label;
}
