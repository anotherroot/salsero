/** PURE: group mode's cookie name, where it ends, where a switch returns to. */
import type { DanceSlug } from '$lib/dances/dances';
import { tabFor } from '$lib/nav/tabs';

export const groupCookie = (dance: DanceSlug): string => `group_${dance}`;

/** Today and its pages are always personal. */
export const leavesGroupMode = (path: string, dance: DanceSlug): boolean =>
	tabFor(path, dance) === 'today';

/** A same-dance path, else Moves. */
export function returnPath(to: string | null, dance: DanceSlug): string {
	const prefix = `/${dance}`;
	if (to && !to.startsWith('//') && (to === prefix || to.startsWith(`${prefix}/`))) return to;
	return `${prefix}/figures`;
}

export const groupLabel = (name: string): string => `${name} · group`;
