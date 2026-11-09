import type { IconName } from '$lib/icons/icons';
import type { CloneKind } from '$lib/types';
import { t } from '$lib/i18n/catalog';

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
	/** Needs a connection: greyed offline (offline phase 3). */
	network?: boolean;
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

/** The ⋯ button's name: "Position menu", in the reader's language. */
export function menuLabel(kind: CloneKind): string {
	return t().clones.menuLabel(kind);
}

/**
 * The menu offline (offline phase 3, look 4B): the items that need a
 * connection greyed, and one note at the top saying so; online, as it is.
 */
export function offlineMenu(
	items: MenuItem[],
	online: boolean
): { note: boolean; items: (MenuItem & { disabled: boolean })[] } {
	const out = items.map((i) => ({ ...i, disabled: !online && !!i.network }));
	return { note: out.some((i) => i.disabled), items: out };
}
