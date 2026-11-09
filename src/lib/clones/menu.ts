import type { MenuItem } from '$lib/menu';
import type {
	CopyOffer,
	DetachOffer,
	DropOptions,
	KeepView,
	MoveOffer,
	TwinOffer
} from '$lib/types';
import { copyTo, detachButton, dropButton, moveTo, sameAs } from './view';
import { syncMenu } from './step-view';

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

/** Labels are read when the menu is drawn, in the reader's language. */
const ITEMS: {
	key: CloneSheet;
	icon: MenuItem['icon'];
	label: () => string;
	danger?: boolean;
	/** Changes several places at once on the server: needs a connection. */
	network?: boolean;
}[] = [
	{ key: 'sync', icon: 'refresh', label: syncMenu, network: true },
	{ key: 'copy', icon: 'copy', label: copyTo, network: true },
	{ key: 'sameAs', icon: 'link', label: sameAs },
	{ key: 'move', icon: 'move-to', label: moveTo, network: true },
	{ key: 'detach', icon: 'unlink', label: detachButton, network: true },
	{ key: 'drop', icon: 'undo', label: dropButton, danger: true, network: true }
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
		label: i.label(),
		...(i.danger ? { danger: true } : {}),
		...(i.network ? { network: true } : {}),
		onclick: () => open(i.key)
	}));
}

/** Whether a page's ⋯ has anything in it: the band draws the ⋯ only then. */
export function hasMenu(own: MenuItem[], o: CloneOffers): boolean {
	return own.length > 0 || ITEMS.some((i) => o[i.key] != null);
}
