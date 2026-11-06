import type { MenuItem } from '$lib/menu';
import type { CopyOffer, DetachOffer, DropOptions, MoveOffer, TwinOffer } from '$lib/types';
import { COPY_TO, DETACH_BUTTON, DROP_BUTTON, MOVE_TO, SAME_AS } from './view';

/** The sheet a copy action in the ⋯ menu opens. */
export type CloneSheet = 'copy' | 'sameAs' | 'move' | 'detach' | 'drop';

/** What the page's load offers; each null or missing one is left out of the menu. */
export type CloneOffers = {
	copy?: CopyOffer | null;
	sameAs?: TwinOffer | null;
	move?: MoveOffer | null;
	detach?: DetachOffer | null;
	drop?: DropOptions | null;
};

const ITEMS: { key: CloneSheet; icon: MenuItem['icon']; label: string; danger?: boolean }[] = [
	{ key: 'copy', icon: 'copy', label: COPY_TO },
	{ key: 'sameAs', icon: 'link', label: SAME_AS },
	{ key: 'move', icon: 'move-to', label: MOVE_TO },
	{ key: 'detach', icon: 'unlink', label: DETACH_BUTTON },
	{ key: 'drop', icon: 'undo', label: DROP_BUTTON, danger: true }
];

/**
 * The copy actions for the ⋯ menu, in the order the button row had them:
 * Copy to…, Same as…, Move to…, Detach, Drop my copy. Each only when its
 * offer is set; a tap opens its sheet. PURE, client-safe.
 */
export function cloneMenuItems(o: CloneOffers, open: (s: CloneSheet) => void): MenuItem[] {
	return ITEMS.filter((i) => o[i.key] != null).map((i) => ({
		key: i.key,
		icon: i.icon,
		label: i.label,
		...(i.danger ? { danger: true } : {}),
		onclick: () => open(i.key)
	}));
}
