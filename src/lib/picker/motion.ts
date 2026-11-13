/**
 * Which picker tiles play their clip (picker preview, revision 2026-11-13): the
 * first `MAX_PLAYING` on screen, in list order (`granted`); none while a list
 * scrolls (they play again 250 ms after it settles); none at all on a phone
 * that should show stills (`stillOnly`). One IntersectionObserver and one
 * scroll listener for every tile. A tile not granted unmounts its <video>, so
 * a row far off screen holds no decoder or memory. Browser only.
 */
import type { Attachment } from 'svelte/attachments';
import { granted, stillOnly } from './preview';

const tiles = new Map<Element, (playing: boolean) => void>();
const onScreen = new Set<Element>();
let observer: IntersectionObserver | null = null;
let scrolling = false;
let settle: ReturnType<typeof setTimeout> | undefined;
let queued = false;

/** Whether pictures stay still here: Reduce motion, Data Saver, or a weak phone. */
export function stillHere(): boolean {
	if (typeof window === 'undefined') return true;
	const nav = navigator as Navigator & {
		connection?: { saveData?: boolean };
		deviceMemory?: number;
	};
	return stillOnly({
		reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
		saveData: nav.connection?.saveData === true,
		deviceMemory: nav.deviceMemory,
		cores: nav.hardwareConcurrency || undefined
	});
}

function recompute() {
	queued = false;
	const visible = [...onScreen].sort((a, b) =>
		a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
	);
	const play = stillHere() ? new Set<Element>() : granted(visible, scrolling);
	for (const [el, set] of tiles) set(play.has(el));
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
			if (e.isIntersecting) onScreen.add(e.target);
			else onScreen.delete(e.target);
		}
		soon();
	});
	// Capture: a picker's list scrolls inside its sheet, and scroll does not bubble.
	document.addEventListener('scroll', onScroll, { capture: true, passive: true });
	return observer;
}

/** A tile: `set(true)` while it may play its clip, `set(false)` otherwise. */
export const playSlot =
	(set: (playing: boolean) => void): Attachment =>
	(el) => {
		const io = start();
		if (!io) return;
		tiles.set(el, set);
		io.observe(el);
		return () => {
			io.unobserve(el);
			tiles.delete(el);
			onScreen.delete(el);
			soon();
		};
	};
