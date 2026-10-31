import { tick } from 'svelte';

/** The key to focus once `gone` leaves `keys`: the one after it, else the one before it, else `fallback`. */
export function nextFocusKey(keys: readonly string[], gone: string, fallback: string): string {
	const i = keys.indexOf(gone);
	if (i < 0) return fallback;
	return keys[i + 1] ?? keys[i - 1] ?? fallback;
}

/** Focuses the first `[data-focus="<key>"]` outside `[inert]` and `[hidden]`; true if one was found. */
export function focusKeyed(key: string): boolean {
	for (const el of document.querySelectorAll<HTMLElement>(`[data-focus="${key}"]`)) {
		if (el.closest('[inert], [hidden]')) continue;
		el.focus();
		return true;
	}
	return false;
}

// Whether the last input was the keyboard. A pointer user's focus is never moved.
let keyboard = true;
if (typeof window !== 'undefined') {
	window.addEventListener('keydown', () => (keyboard = true), true);
	window.addEventListener('pointerdown', () => (keyboard = false), true);
}

/** True when focus fell to nowhere (`<body>` or a removed element) and the user is on the keyboard. */
export function focusWasLost(): boolean {
	if (!keyboard) return false;
	const a = document.activeElement;
	return !a || a === document.body || !a.isConnected;
}

/** After a row is removed: if focus was lost, focus the next row's key, else the one before, else `fallback`. */
export async function focusAfterRemoval(
	keys: readonly string[],
	gone: string,
	fallback: string
): Promise<void> {
	await tick();
	if (!focusWasLost()) return;
	if (!focusKeyed(nextFocusKey(keys, gone, fallback))) focusKeyed(fallback);
}

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function usable(el: HTMLElement): boolean {
	return !el.closest('[inert], [hidden]') && el.getClientRects().length > 0;
}

/** The first focusable after `el` in document order and outside it, else the last one before it. */
export function focusAfter(el: Element): HTMLElement | null {
	const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(c) => !el.contains(c) && usable(c)
	);
	const after = all.find((c) => el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
	if (after) return after;
	const before = all.filter(
		(c) => el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING
	);
	return before[before.length - 1] ?? null;
}
