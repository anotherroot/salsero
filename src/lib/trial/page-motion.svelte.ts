/**
 * TRIAL (throwaway): ways to change pages on the phone, picked in Settings and
 * kept on this device, so the person can feel each one on the real app before
 * one is designed and built properly. Off unless picked. Remove this module,
 * its Settings row and its words once a choice is made.
 *
 * The page's card (the Screen's `<main>`, the cream sheet under the band) moves
 * out of the way on a tap: up over the band, or down off it with the band's
 * colour filling behind. It stays there while the next page loads, then the
 * next page's card comes back with its content fading in.
 */
import { afterNavigate, beforeNavigate, onNavigate } from '$app/navigation';
import type { Navigation } from '@sveltejs/kit';

export const PAGE_MOTIONS = ['off', 'close', 'slim', 'dip', 'deep', 'swap'] as const;
export type PageMotion = (typeof PAGE_MOTIONS)[number];

const KEY = 'salsa:page-motion';
const S = 150;
const M = 260;
const L = 380;
const ARRIVE = 'cubic-bezier(.2, 0, 0, 1)';
const SETTLE = 'cubic-bezier(.3, 1.25, .6, 1)';
/** The slim band's height under the status bar: where "Closes to the slim band" stops. */
const SLIM = 60;

function readSaved(): PageMotion {
	if (typeof window === 'undefined') return 'off';
	try {
		const v = localStorage.getItem(KEY);
		return (PAGE_MOTIONS as readonly string[]).includes(v ?? '') ? (v as PageMotion) : 'off';
	} catch {
		return 'off';
	}
}

export const pageMotion = $state<{ current: PageMotion; away: boolean }>({
	current: readSaved(),
	away: false
});

export function setPageMotion(m: PageMotion) {
	pageMotion.current = m;
	try {
		localStorage.setItem(KEY, m);
	} catch {
		/* private window: kept for this page load only */
	}
}

const dips = (k: PageMotion) => k === 'dip' || k === 'deep' || k === 'swap';

/** The page's card and its band, when the page is drawn as a Screen. */
function cardOf(): { main: HTMLElement; header: HTMLElement } | null {
	const main = document.querySelector('main');
	const header = main?.previousElementSibling;
	if (!(main instanceof HTMLElement) || !(header instanceof HTMLElement)) return null;
	if (header.tagName !== 'HEADER') return null;
	return { main, header };
}

function motionNow(): PageMotion {
	const k = pageMotion.current;
	if (k === 'off') return 'off';
	if (matchMedia('(min-width: 1024px)').matches) return 'off';
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
	return k;
}

function moves(nav: Pick<Navigation, 'from' | 'to' | 'type' | 'willUnload'>): boolean {
	if (nav.willUnload || !nav.from || !nav.to?.route.id) return false;
	if (nav.type !== 'link' && nav.type !== 'goto' && nav.type !== 'popstate') return false;
	return nav.from.url.pathname !== nav.to.url.pathname;
}

const running: Animation[] = [];
/** Inline styles set for the motion, taken off again when it ends. */
const touched: [HTMLElement, string][] = [];
let painted = false;

function play(
	el: Element,
	frames: Keyframe[],
	duration: number,
	opts: KeyframeAnimationOptions = {}
) {
	const a = el.animate(frames, { duration, easing: ARRIVE, ...opts });
	running.push(a);
	return a;
}

/** Puts everything back as the page draws it. */
function settle() {
	for (const a of running.splice(0)) a.cancel();
	for (const [el, prop] of touched.splice(0)) el.style.removeProperty(prop);
	painted = false;
	pageMotion.away = false;
}

function setStyle(el: HTMLElement, prop: string, value: string) {
	el.style.setProperty(prop, value);
	touched.push([el, prop]);
}

/**
 * Behind a dipping card the band's colour runs all the way down, and the card
 * reaches the screen's foot, so a short page shows no band under it.
 */
function paintBand(header: HTMLElement, main: HTMLElement) {
	setStyle(main, 'min-height', '100dvh');
	if (painted) return;
	const band = getComputedStyle(header).backgroundColor;
	for (const el of [document.documentElement, document.body]) setStyle(el, 'background', band);
	painted = true;
}

let outgoing: Promise<void> | null = null;

function startOut(kind: PageMotion) {
	const card = cardOf();
	if (!card) return;
	// A card still coming back from the last tap stops where it is drawn.
	for (const a of running.splice(0)) a.cancel();
	const { main, header } = card;
	const top = main.getBoundingClientRect().top;
	const H = innerHeight;
	pageMotion.away = true;
	if (dips(kind)) paintBand(header, main);
	const keep = { fill: 'forwards' } as const;
	for (const c of main.children) play(c, [{ opacity: 1 }, { opacity: 0 }], S, keep);
	if (dips(kind) || kind === 'slim')
		for (const c of header.children) play(c, [{ opacity: 1 }, { opacity: 0 }], S, keep);
	const y = {
		close: -Math.max(top, 0),
		slim: -(Math.max(top, SLIM) - SLIM),
		dip: Math.round(H * 0.28),
		deep: H - top,
		swap: 70,
		off: 0
	}[kind];
	const frames: Keyframe[] =
		kind === 'swap'
			? [
					{ transform: 'none', opacity: 1 },
					{ transform: `translateY(${y}px)`, opacity: 0 }
				]
			: [{ transform: 'none' }, { transform: `translateY(${y}px)` }];
	const a = play(main, frames, M, { ...keep, delay: dips(kind) ? 0 : S / 2 });
	outgoing = a.finished.then(
		() => {},
		() => {}
	);
}

function startIn(kind: PageMotion) {
	// The same <main> may have stayed (a figure to a figure): start from the page as drawn.
	for (const a of running.splice(0)) a.cancel();
	const card = cardOf();
	if (!card) return settle();
	const { main, header } = card;
	const top = main.getBoundingClientRect().top;
	const H = innerHeight;
	if (dips(kind)) paintBand(header, main);
	pageMotion.away = false;
	const y = {
		close: -Math.max(top, 0),
		slim: -(Math.max(top, SLIM) - SLIM),
		dip: Math.round(H * 0.28),
		deep: H - top,
		swap: H - top,
		off: 0
	}[kind];
	const words = dips(kind) || kind === 'slim';
	// The new title lands first, then the card comes back.
	const delay = words ? S : 0;
	if (words)
		for (const c of header.children)
			play(c, [{ opacity: 0 }, { opacity: 1 }], M, { fill: 'backwards' });
	const back = play(main, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], L, {
		delay,
		fill: 'backwards',
		easing: SETTLE
	});
	for (const c of main.children)
		play(c, [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], L, {
			delay,
			fill: 'backwards'
		});
	back.finished.then(
		() => settle(),
		() => {}
	);
}

/** Wires the trial to the router; call once, from the root layout. */
export function pageMotionHooks() {
	beforeNavigate((nav) => {
		const kind = motionNow();
		if (kind === 'off' || !moves(nav)) return;
		let cancelled = false;
		nav.complete.catch(() => {
			cancelled = true;
			outgoing = null;
			settle();
		});
		// A frame later: any other handler may still cancel this navigation (unsaved, offline).
		requestAnimationFrame(() => {
			if (!cancelled && outgoing === null) startOut(kind);
		});
	});
	onNavigate(async (nav) => {
		const kind = motionNow();
		if (kind === 'off' || !moves(nav)) {
			outgoing = null;
			settle();
			return;
		}
		// The old card finishes leaving before the next page replaces it.
		if (outgoing) await outgoing;
		outgoing = null;
		return () => startIn(kind);
	});
	afterNavigate((nav) => {
		if (nav.type === 'enter') settle();
	});
}
