/** PURE: group mode's cookie name, where it ends, where a switch returns to. */
import type { DanceSlug } from '$lib/dances/dances';
import { rootsOf, tabFor } from '$lib/nav/tabs';
import { plural } from '$lib/format';
import type { GroupChoice } from '$lib/types';

export const groupCookie = (dance: DanceSlug): string => `group_${dance}`;

/**
 * Today and its pages are always personal: they show no group mode. They do
 * not end it either (the cookie stays; only Mine or a switch changes it),
 * since a load runs on hover preload too.
 */
export const outsideGroupMode = (path: string, dance: DanceSlug): boolean =>
	tabFor(path, dance) === 'today';

/** A same-dance path, else Moves. */
export function returnPath(to: string | null, dance: DanceSlug): string {
	const prefix = `/${dance}`;
	if (to && !to.startsWith('//') && (to === prefix || to.startsWith(`${prefix}/`))) return to;
	return `${prefix}/figures`;
}

/**
 * Where Mine (the tab bar's way out of group mode) lands: the same tab, now on
 * the personal side. On one of the tab's lists, that list; on a page inside the
 * tab (a group's lesson, figure or song), the tab's first list, since the page
 * itself is the group's. Anywhere else, Today.
 */
export function minePath(path: string, dance: DanceSlug): string {
	const tab = tabFor(path, dance);
	if (tab === null || tab === 'today') return `/${dance}`;
	const roots = rootsOf(tab, dance);
	return roots.find((r) => r === path) ?? roots[0];
}

export const groupLabel = (name: string): string => `${name} · group`;

/** The Work in sheet: Mine first, then each group the person can write in. */
export function workInRows(
	choices: GroupChoice[],
	current: number | null
): { teamId: number | 'mine'; name: string; meta: string; on: boolean }[] {
	return [
		{ teamId: 'mine', name: 'Mine', meta: 'Your own space', on: current === null },
		...choices.map((c) => ({
			teamId: c.teamId,
			name: c.name,
			meta: `${c.role === 'owner' ? 'Owner' : 'Editor'} · ${plural(c.people, 'person', 'people')}`,
			on: c.teamId === current
		}))
	];
}
