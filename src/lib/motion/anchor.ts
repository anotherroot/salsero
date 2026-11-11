/**
 * Nothing jumps (spec 2026-11-11, routine lift): when a tap or a long press
 * opens, closes, selects or joins cards, the card under the finger stays
 * where it is on screen. Its top is read before the change and after Svelte
 * has drawn it, and the page scrolls by the difference — whatever appeared or
 * went above it. A page that cannot scroll that far goes as far as it can.
 */
import { tick } from 'svelte';

export async function keepInPlace(
	el: Element | null | undefined,
	change: () => void
): Promise<void> {
	const before = el?.getBoundingClientRect().top;
	change();
	await tick();
	if (!el || before === undefined || !el.isConnected) return;
	const moved = el.getBoundingClientRect().top - before;
	if (Math.abs(moved) >= 1) window.scrollBy(0, moved);
}
