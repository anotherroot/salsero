/** PURE: where the group view ends, where a switch returns to, where Mine lands. */
import type { DanceSlug } from '$lib/dances/dances';
import { rootsOf, tabFor } from '$lib/nav/tabs';
import { t } from '$lib/i18n/catalog';
import type { GroupChoice } from '$lib/types';
import { withView } from './group-view';

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

export const groupLabel = (name: string): string => t().groups.mode.label(name);

/** The Work in sheet: Mine first, then each group the person can write in, each a link to `path` in its view. */
export function workInRows(
	choices: GroupChoice[],
	current: number | null,
	path: string
): { teamId: number | 'mine'; name: string; meta: string; on: boolean; href: string }[] {
	const w = t();
	return [
		{
			teamId: 'mine' as const,
			name: w.shell.mine,
			meta: w.groups.mode.mineMeta,
			on: current === null,
			href: withView(path, null)
		},
		...choices.map((c) => ({
			teamId: c.teamId,
			name: c.name,
			meta: `${w.groups.role[c.role]} · ${w.entry.classes.people(c.people)}`,
			on: c.teamId === current,
			href: withView(path, c.teamId)
		}))
	];
}
