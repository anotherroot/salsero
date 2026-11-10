/*
 * The iPhone card (offline phase 4c, look 3B) shows until the person closes
 * it, once per device: remembered in this browser (a per-viewer convenience).
 * Storage that throws (a private window) still lets it close for the page.
 */
export const IPHONE_WARNED_KEY = 'salsa:iphone-warned';

export function iphoneWarning(storage: () => Storage | null) {
	let closed = false;
	return {
		shown(): boolean {
			if (closed) return false;
			try {
				return storage()?.getItem(IPHONE_WARNED_KEY) !== '1';
			} catch {
				return true;
			}
		},
		close(): void {
			closed = true;
			try {
				storage()?.setItem(IPHONE_WARNED_KEY, '1');
			} catch {
				// The page remembers it; the next one shows the card again.
			}
		}
	};
}
