/**
 * Which picker tiles play their clip (picker preview, revision 2026-11-13): the
 * first `MAX_PLAYING` on screen and not covered (a sheet over the picker), in
 * list order (`slots`); while a list scrolls they pause where they are and play
 * on 250 ms after it settles; none at all on a device that should show stills
 * (`stillOnly`). One IntersectionObserver, one scroll listener, and a check
 * every second while tiles exist (a sheet opening over them moves no tile). A
 * tile 'off' unmounts its <video>, so a row off screen holds no decoder or
 * memory. Browser only.
 */
import type { Attachment } from 'svelte/attachments';
import { slots, stillOnly, type Slot } from './preview';

const tiles = new Map<Element, (slot: Slot) => void>();
const onScreen = new Set<Element>();
let observer: IntersectionObserver | null = null;
let scrolling = false;
let settle: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
let queued = false;

/** Whether pictures stay still here: Reduce motion, Data Saver, or a weak device. */
export function stillHere(): boolean {
	if (typeof window === 'undefined') return true;
	const nav = navigator as Navigator & {
		connection?: { saveData?: boolean };
		deviceMemory?: number;
	};
	const media = (q: string) => window.matchMedia?.(q).matches ?? false;
	return stillOnly({
		reducedMotion: media('(prefers-reduced-motion: reduce)'),
		saveData: nav.connection?.saveData === true,
		deviceMemory: nav.deviceMemory,
		cores: nav.hardwareConcurrency || undefined,
		mobile: media('(pointer: coarse)')
	});
}

/** Nothing over the tile's middle: no sheet, scrim or layer covers it. */
function uncovered(el: Element): boolean {
	const r = el.getBoundingClientRect();
	const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
	return hit !== null && el.contains(hit);
}

function recompute() {
	queued = false;
	const visible = [...onScreen]
		.filter(uncovered)
		.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
	const given = stillHere() ? new Map<Element, Slot>() : slots(visible, scrolling);
	for (const [el, set] of tiles) set(given.get(el) ?? 'off');
}

function soon() {
	if (queued) return;
	queued = true;
	requestAnimationFrame(recompute);
}

function onScroll() {
	if (!scrolling) {
		scrolling = true;
		soon();
	}
	clearTimeout(settle);
	settle = setTimeout(() => {
		scrolling = false;
		soon();
	}, 250);
}

function start(): IntersectionObserver | null {
	if (observer || typeof IntersectionObserver === 'undefined') return observer;
	observer = new IntersectionObserver((entries) => {
		for (const e of entries) {
			// A notice queued before the tile went: it must not come back and take a slot.
			if (!tiles.has(e.target)) continue;
			if (e.isIntersecting) onScreen.add(e.target);
			else onScreen.delete(e.target);
		}
		soon();
	});
	// Capture: a picker's list scrolls inside its sheet, and scroll does not bubble.
	document.addEventListener('scroll', onScroll, { capture: true, passive: true });
	return observer;
}

/** A tile: `set('play' | 'pause')` while it has a clip, `set('off')` for its still alone. */
export const playSlot =
	(set: (slot: Slot) => void): Attachment =>
	(el) => {
		const io = start();
		if (!io) return;
		tiles.set(el, set);
		io.observe(el);
		ticker ??= setInterval(soon, 1000);
		return () => {
			io.unobserve(el);
			tiles.delete(el);
			onScreen.delete(el);
			if (tiles.size === 0) {
				clearInterval(ticker);
				ticker = undefined;
			}
			soon();
		};
	};
