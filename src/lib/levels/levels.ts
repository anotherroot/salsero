/**
 * How much app a person sees (levels spec): Follow my class, Practise and keep
 * my own, Everything. Per person, stored in `users.level` (null until chosen).
 * Levels hide entry points, never routes. Components ask this module; they do
 * not compare level strings themselves. PURE, client-safe.
 */
import { t } from '$lib/i18n/catalog';
import { tabs, type Tab } from '$lib/nav/tabs';

export type Level = 'follow' | 'own' | 'all';

/** Least app first, the order the cards are drawn in. */
export const LEVELS: readonly Level[] = ['follow', 'own', 'all'];

/** The words on the "How much app?" cards (and Settings' row). Everything has no small line: ''. */
export function levelWords(level: Level): { title: string; body: string; small: string } {
	return { small: '', ...t().entry.levels[level] };
}

export function parseLevel(v: unknown): Level | null {
	return v === 'follow' || v === 'own' || v === 'all' ? v : null;
}

/**
 * The level a screen draws for: not chosen yet (null, before the first run; no
 * user) draws as Everything, the app as it was before levels.
 */
export function levelShown(level: Level | null | undefined): Level {
	return level ?? 'all';
}

/** The phone's tabs per level. Above Follow my class the Groups tab is You (`tabsFor`). */
const TAB_IDS: Record<Level, readonly Tab['id'][]> = {
	follow: ['today', 'groups', 'you'],
	own: ['today', 'lessons', 'music', 'groups'],
	all: ['today', 'moves', 'lessons', 'music', 'groups']
};

/**
 * The phone's tab bar: `tabs()` filtered for a level, in that order. At Follow
 * my class Groups is "My class" (same route and icon) and You is its own tab;
 * above it Groups is "You", with the person icon: the groups, then the settings.
 */
export function tabsFor(level: Level): readonly Tab[] {
	const w = t().shell.tabs;
	return tabs()
		.filter((tab) => TAB_IDS[level].includes(tab.id))
		.map((tab) => {
			if (tab.id !== 'groups') return tab;
			return level === 'follow'
				? { ...tab, label: w.myClass }
				: { ...tab, label: w.you, icon: 'solo' as const };
		});
}

/**
 * The desktop side's tabs: the phone's without You (the side has Settings at its
 * foot), and Groups keeps its own name and icon ("My class" at Follow my class).
 */
export function sideTabsFor(level: Level): readonly Tab[] {
	return tabs()
		.filter((tab) => tab.id !== 'you' && TAB_IDS[level].includes(tab.id))
		.map((tab) =>
			level === 'follow' && tab.id === 'groups' ? { ...tab, label: t().shell.tabs.myClass } : tab
		);
}

/**
 * Where You is for a level: its own page at Follow my class, the Groups list
 * (whose tab is You) above it. Settings' and My count's Back go there.
 */
export function youPath(level: Level, dance: string): string {
	return level === 'follow' ? `/${dance}/you` : `/${dance}/groups`;
}

/**
 * The tab to light, given the one the path maps to (`tabFor`). At Follow my
 * class the Lessons tab is hidden, so a class's (group's) lesson lights My
 * class, the tab every route to it comes from (ruling R13); a person's own
 * lesson lights none. Above Follow my class `/[dance]/you` (not a tab there)
 * lights You, which is the Groups tab.
 */
export function litAt(
	lit: Tab['id'] | 'settings' | null,
	level: Level,
	groupLesson: boolean
): Tab['id'] | 'settings' | null {
	if (level === 'follow' && lit === 'lessons' && groupLesson) return 'groups';
	if (level !== 'follow' && lit === 'you') return 'groups';
	return lit;
}

/** The simple screens: the lesson page, the video player, the exercise page and Done sheet. */
export function simple(level: Level): boolean {
	return level !== 'all';
}

/**
 * Whether a lesson is drawn as the simple page. A group's lesson the person
 * can edit is drawn in full at every level, so a teacher who picked a lower
 * level is never stuck on their own draft.
 */
export function simpleLesson(
	level: Level,
	access: 'read' | 'edit',
	isGroupLesson: boolean
): boolean {
	return simple(level) && !(isGroupLesson && access === 'edit');
}

/**
 * Whether a group's page is drawn as My class's simple class page: a member at
 * Follow my class. An editor or the owner keeps the full page at every level
 * (drafts, New lesson, the code), as `simpleLesson` keeps their lessons full.
 */
export function simpleClass(level: Level, role: 'owner' | 'editor' | 'member'): boolean {
	return level === 'follow' && role === 'member';
}

/**
 * Whether new class lessons reach Today by themselves in one group:
 * `team_members.auto_add`, null = the level's default (on below Everything,
 * off at it). At Follow my class it is always on and a stored 0 is kept,
 * unread, for when the person moves up.
 */
export function autoAddOn(level: Level, stored: number | null): boolean {
	if (level === 'follow') return true;
	if (stored === null) return level === 'own';
	return stored !== 0;
}

/**
 * A group's page draws "Add new lessons to Today automatically" at the two
 * upper levels; at Follow my class auto-add is always on and there is no switch.
 */
export function autoAddSwitchShown(level: Level): boolean {
	return level !== 'follow';
}

/** Below Everything, a lesson's Add adds the default picks at once, without the Add sheet. */
export function addsAtOnce(level: Level): boolean {
	return level !== 'all';
}

/** The Mine / group switch is drawn only at Everything. */
export function groupModeShown(level: Level): boolean {
	return level === 'all';
}

/**
 * Settings at Follow my class draws only How much app?, Exercises a day, the
 * daily reminder, theme, name, paired phones and sign out. The admin's Admin
 * row (their only way to /admin) is kept at every level.
 */
export function fewSettings(level: Level): boolean {
	return level === 'follow';
}

/** New group is drawn only at Everything. */
export function canMakeGroup(level: Level): boolean {
	return level === 'all';
}
