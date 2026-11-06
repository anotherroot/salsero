import type { IconName } from '$lib/icons/icons';
import type { CloneKind } from '$lib/types';

/**
 * One row of a page's ⋯ menu (`ui/MenuSheet.svelte`): a link (`href`) or a
 * button (`onclick`, run once the menu has closed). PURE, client-safe.
 */
export type MenuItem = {
	key: string;
	icon: IconName;
	label: string;
	/** A muted line under the label. */
	meta?: string;
	/** Crimson, and listed last. */
	danger?: boolean;
	href?: string;
	onclick?: () => void;
};

/**
 * The menu's order: the page's own items, then the copy actions, then every
 * danger item (the copies' Drop my copy before the page's own Delete).
 */
export function orderMenu(own: MenuItem[], copies: MenuItem[]): MenuItem[] {
	const safe = (xs: MenuItem[]) => xs.filter((x) => !x.danger);
	const danger = (xs: MenuItem[]) => xs.filter((x) => x.danger);
	return [...safe(own), ...safe(copies), ...danger(copies), ...danger(own)];
}

const KIND_NAME: Record<CloneKind, string> = {
	figure: 'Figure',
	position: 'Position',
	routine: 'Routine',
	drill: 'Drill',
	song: 'Song',
	lesson: 'Lesson'
};

/** The ⋯ button's name: "Position menu". */
export function menuLabel(kind: CloneKind): string {
	return `${KIND_NAME[kind]} menu`;
}
