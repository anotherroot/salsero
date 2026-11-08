import type { MenuItem } from '$lib/menu';
import type {
	CopyOffer,
	DetachOffer,
	DropOptions,
	KeepView,
	MoveOffer,
	TwinOffer
} from '$lib/types';
import { COPY_TO, DETACH_BUTTON, DROP_BUTTON, MOVE_TO, SAME_AS } from './view';
import { SYNC_MENU } from './step-view';

/** The sheet a copy action in the ⋯ menu opens. */
export type CloneSheet = 'sync' | 'copy' | 'sameAs' | 'move' | 'detach' | 'drop';

/** What the page's load offers; each null or missing one is left out of the menu. */
export type CloneOffers = {
	/** Sync…: the page's `keep` when it has a Sync (`mode` set), else null. */
	sync?: KeepView | null;
	copy?: CopyOffer | null;
	sameAs?: TwinOffer | null;
	move?: MoveOffer | null;
	detach?: DetachOffer | null;
	drop?: DropOptions | null;
};

const ITEMS: { key: CloneSheet; icon: MenuItem['icon']; label: string; danger?: boolean }[] = [
	{ key: 'sync', icon: 'refresh', label: SYNC_MENU },
	{ key: 'copy', icon: 'copy', label: COPY_TO },
	{ key: 'sameAs', icon: 'link', label: SAME_AS },
	{ key: 'move', icon: 'move-to', label: MOVE_TO },
	{ key: 'detach', icon: 'unlink', label: DETACH_BUTTON },
	{ key: 'drop', icon: 'undo', label: DROP_BUTTON, danger: true }
];

/**
 * The copy actions for the ⋯ menu: Sync…, then in the order the button row
 * had them: Copy to…, Same as…, Move to…, Detach, Drop my copy. Each only when its
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

/** Whether a page's ⋯ has anything in it: the band draws the ⋯ only then. */
export function hasMenu(own: MenuItem[], o: CloneOffers): boolean {
	return own.length > 0 || ITEMS.some((i) => o[i.key] != null);
}
