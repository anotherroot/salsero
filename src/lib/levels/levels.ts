/**
 * How much app a person sees (levels spec): Follow my class, Practise and keep
 * my own, Everything. Per person, stored in `users.level` (null until chosen).
 * Levels hide entry points, never routes. Components ask this module; they do
 * not compare level strings themselves. PURE, client-safe.
 */
import { TABS, type Tab } from '$lib/nav/tabs';

export type Level = 'follow' | 'own' | 'all';

/** Least app first, the order the cards are drawn in. */
export const LEVELS: readonly Level[] = ['follow', 'own', 'all'];

/** The words on the "How much app?" cards. Everything has no small line. */
export const LEVEL_WORDS: Record<Level, { title: string; body: string; small: string }> = {
	follow: {
		title: 'Follow my class',
		body: 'What my class is working on, a few things a day. Nothing to set up.',
		small: 'New class lessons come to Today by themselves.'
	},
	own: {
		title: 'Practise and keep my own',
		body: 'Also keep my own videos, like workshops or my performances, and my own songs.',
		small: 'Videos still just play.'
	},
	all: {
		title: 'Everything',
		body: 'My own figures, positions and routines. Mark and edit sections in videos.',
		small: ''
	}
};

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

const TAB_IDS: Record<Level, readonly Tab['id'][]> = {
	follow: ['today', 'groups'],
	own: ['today', 'lessons', 'groups', 'music'],
	all: ['today', 'moves', 'lessons', 'groups', 'music']
};

/** `TABS` filtered for a level, in `TABS` order. At Follow my class, Groups is "My class": same route and icon. */
export function tabsFor(level: Level): readonly Tab[] {
	return TABS.filter((t) => TAB_IDS[level].includes(t.id)).map((t) =>
		level === 'follow' && t.id === 'groups' ? { ...t, label: 'My class' } : t
	);
}

/** The simple screens: the lesson page, the video player, the exercise page and log popup. */
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

/** The Mine / group switch is drawn only at Everything. */
export function groupModeShown(level: Level): boolean {
	return level === 'all';
}

/**
 * Settings at Follow my class draws only How much app?, Exercises a day, the
 * daily reminder, theme, name, paired phones and sign out.
 */
export function fewSettings(level: Level): boolean {
	return level === 'follow';
}

/** New group is drawn only at Everything. */
export function canMakeGroup(level: Level): boolean {
	return level === 'all';
}
