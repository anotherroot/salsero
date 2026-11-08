/**
 * PURE, client-safe: a group page's + (Add to the group). Lesson and Drill are
 * made on the group page; the other four switch into the group (group mode)
 * and open their list's own create sheet from the URL.
 */
import type { DanceSlug } from '$lib/dances/dances';
import type { IconName } from '$lib/icons/icons';
import { groupModeShown, levelShown, type Level } from '$lib/levels/levels';

export type AddKind = 'lesson' | 'music' | 'figure' | 'routine' | 'position' | 'drill';

export const ADD_KINDS: readonly { kind: AddKind; icon: IconName }[] = [
	{ kind: 'lesson', icon: 'lessons' },
	{ kind: 'music', icon: 'music' },
	{ kind: 'figure', icon: 'footprints' },
	{ kind: 'routine', icon: 'route' },
	{ kind: 'position', icon: 'graph' },
	{ kind: 'drill', icon: 'metronome' }
];

/** Where a kind's create sheet opens, or null when it is made on the group page. */
export function addPath(kind: AddKind, dance: DanceSlug): string | null {
	switch (kind) {
		case 'music':
			return `/${dance}/songs?add=1`;
		case 'figure':
			return `/${dance}/figures?new=1`;
		case 'routine':
			return `/${dance}/routines?new=1`;
		case 'position':
			return `/${dance}/positions?new=1`;
		default:
			return null;
	}
}

/**
 * Whether the + opens the choice. Switching into a group exists at Everything
 * only; below it the + is New lesson.
 */
export function chooserShown(level: Level | null | undefined): boolean {
	return groupModeShown(levelShown(level));
}
