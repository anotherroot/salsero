/**
 * When a row's picture moves (picker preview): only on screen, through one
 * IntersectionObserver for every row, and never with Reduce motion or Data
 * Saver on (`stillOnly`). Browser only.
 */
import type { Attachment } from 'svelte/attachments';
import { stillOnly } from './preview';

const watched = new Map<Element, (on: boolean) => void>();
let observer: IntersectionObserver | null = null;

function observe(): IntersectionObserver | null {
	if (observer || typeof IntersectionObserver === 'undefined') return observer;
	observer = new IntersectionObserver((entries) => {
		for (const e of entries) watched.get(e.target)?.(e.isIntersecting);
	});
	return observer;
}

/** `set(true)` while the element is on screen, `set(false)` when it leaves. */
export const onScreen =
	(set: (on: boolean) => void): Attachment =>
	(el) => {
		const io = observe();
		if (!io) return;
		watched.set(el, set);
		io.observe(el);
		return () => {
			io.unobserve(el);
			watched.delete(el);
		};
	};

/** Whether pictures stay still here: Reduce motion, or the browser saving data. */
export function stillHere(): boolean {
	if (typeof window === 'undefined') return true;
	const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	return stillOnly({
		reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
		saveData: conn?.saveData === true
	});
}
