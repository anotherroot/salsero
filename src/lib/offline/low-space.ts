/*
 * The phone short of space (offline phase 4b, look 4B): a sheet with the
 * suggestions opens once, then only a dot on You and the warning on the On
 * this phone page. "Shown" is this browser's (localStorage), and is forgotten
 * when space comes back, so the next shortage opens the sheet once more.
 */
export const LOW_SHOWN_KEY = 'salsa:low-space-shown';

/** `suggestions`: how many things the sheet would offer to take off; none, no sheet (only the dot and the page). */
export function shouldOpenLowSheet(low: boolean, shown: boolean, suggestions = 1): boolean {
	return low && !shown && suggestions > 0;
}

export function lowShown(): boolean {
	try {
		return localStorage.getItem(LOW_SHOWN_KEY) === '1';
	} catch {
		return false;
	}
}

export function setLowShown(shown: boolean): void {
	try {
		if (shown) localStorage.setItem(LOW_SHOWN_KEY, '1');
		else localStorage.removeItem(LOW_SHOWN_KEY);
	} catch {
		// No storage here: the sheet may open again on the next load.
	}
}
