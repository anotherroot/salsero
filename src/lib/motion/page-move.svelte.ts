/**
 * Page changes on the phone, the runtime (spec 2026-11-10-page-transitions-design.md).
 * On the tap the page's card (the Screen's `<main>`) lifts and its words and the
 * band's fade; it holds there, empty, while the page loads; when the new page is
 * drawn it comes down to where that page's band ends and the new words fade in.
 * It moves the real elements: SvelteKit keeps the old page mounted while the new
 * one loads, and the landing sets the new page's start before it paints.
 * The rules (edges, which move) are `page-move.ts`; the dots and Go back `PageWait`.
 */
import { afterNavigate, goto, onNavigate } from '$app/navigation';
import { navigating, page } from '$app/state';
import { tick, untrack } from 'svelte';
import { desk } from '$lib/nav/desk.svelte';
import { LEAVE, play, reducedMotion } from './motion';
import {
	PAGE_MOVE,
	drawnEdge,
	heldEdge,
	moveKind,
	shapeOf,
	visibleEdge,
	type MoveKind
} from './page-move';

type Phase = 'idle' | 'up' | 'held' | 'down';

/** What the card is doing: `edge` is where it waits (viewport px), `since` when the wait began. */
export const moveState = $state<{
	phase: Phase;
	edge: number | null;
	square: boolean;
	since: number;
}>({ phase: 'idle', edge: null, square: false, since: 0 });

let inPage = false;
/** The next navigation is a step inside this page (Task 4): read once. */
export function stepInPage(): void {
	inPage = true;
}

let running: Animation[] = [];
/** Bumped by each move, so a finished one never tidies up after a newer one. */
let gen = 0;
let landingEnd = 0;
let overflow: string | null = null;
let shadowed: HTMLElement | null = null;
/** The faded page's card, made inert while it waits. */
let inerted: HTMLElement | null = null;

function release() {
	if (inerted) inerted.inert = false;
	inerted = null;
}
/** The move began on a full-screen page (Practice, the map): there was no card to lift. */
let fromScreen = false;
/** The band's and the card's colours as the lift saw them, for a layer that outlives the page. */
let paint = { band: '', ground: '' };

/**
 * A layer over everything, in the band's colour with the held card on it (or the band alone): the
 * page under it is already the new one, and it fades off (a full-screen page coming or going).
 */
function ghost(band: string, card: { y: number; square: boolean; ground: string } | null) {
	const g = document.createElement('div');
	g.setAttribute('aria-hidden', 'true');
	g.inert = true;
	Object.assign(g.style, {
		position: 'fixed',
		inset: '0',
		zIndex: '45',
		pointerEvents: 'none',
		background: band
	});
	if (card) {
		const c = document.createElement('div');
		Object.assign(c.style, {
			position: 'absolute',
			inset: `${card.y}px 0 0 0`,
			background: card.ground,
			borderRadius: card.square ? '0' : '28px 28px 0 0'
		});
		g.append(c);
	}
	document.body.append(g);
	return g;
}

/** Fades a layer off and takes it away (never kept by a move that ends: it is not in `running`). */
function fadeOff(g: HTMLElement) {
	const a = play(g, [{ opacity: 1 }, { opacity: 0 }], {
		duration: PAGE_MOVE.screenFade,
		easing: 'ease-out',
		fill: 'forwards'
	});
	if (!a) return g.remove();
	a.finished.then(
		() => g.remove(),
		() => g.remove()
	);
	setTimeout(() => g.remove(), 2000);
}

/** How long until the card has landed: Today's own landing starts then (round 1). */
export function settledIn(): number {
	if (moveState.phase === 'up' || moveState.phase === 'held') return PAGE_MOVE.down;
	if (moveState.phase === 'down') return Math.max(0, landingEnd - performance.now());
	return 0;
}

/** The page's card, its band (`BandHeader`, just before it) and the slim band. */
function parts(): {
	main: HTMLElement;
	header: HTMLElement | null;
	slim: HTMLElement | null;
} | null {
	const main = document.querySelector('main');
	if (!(main instanceof HTMLElement)) return null;
	const header = main.previousElementSibling;
	const slim = document.querySelector('[data-slim-band]');
	return {
		main,
		header: header instanceof HTMLElement ? header : null,
		slim: slim instanceof HTMLElement ? slim : null
	};
}

/** Everything that reads as words: the card's children, the band's, the slim band's row while it shows. */
function words(p: NonNullable<ReturnType<typeof parts>>): Element[] {
	const out = boxes(p.main);
	if (p.header) out.push(...boxes(p.header));
	if (p.slim && !p.slim.classList.contains('opacity-0') && p.slim.firstElementChild)
		out.push(p.slim.firstElementChild);
	return out;
}

/** An element's children that draw a box: a `display: contents` wrapper fades nothing, so its own children stand in. */
function boxes(el: Element): Element[] {
	const out: Element[] = [];
	for (const c of el.children) {
		if (getComputedStyle(c).display === 'contents') out.push(...boxes(c));
		else out.push(c);
	}
	return out;
}

const translateY = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).m42;
const slimFoot = (p: { slim: HTMLElement | null }) =>
	p.slim?.getBoundingClientRect().bottom ?? null;

function stopAll() {
	for (const a of running) a.cancel();
	running = [];
}

function keep(a: Animation | null) {
	if (a) running.push(a);
	return a;
}

function holdScroll(on: boolean) {
	const root = document.documentElement;
	if (on && overflow === null) {
		overflow = root.style.overflow;
		root.style.overflow = 'hidden';
	} else if (!on && overflow !== null) {
		root.style.overflow = overflow;
		overflow = null;
	}
}

/** The card lifts from where it is drawn (still moving from a last tap or not), or stays (a step inside the page); its words fade. */
function lift(kind: MoveKind): boolean {
	if (shapeOf(page.route.id) === 'screen') {
		// Leaving a full-screen page: no card to lift. The next page's card comes in held (`land`).
		stopAll();
		++gen;
		fromScreen = true;
		Object.assign(moveState, {
			phase: 'held',
			edge: null,
			square: false,
			since: performance.now()
		});
		return true;
	}
	const p = parts();
	if (!p) return false;
	fromScreen = false;
	paint = {
		band: p.header ? getComputedStyle(p.header).backgroundColor : '',
		ground: getComputedStyle(p.main).backgroundColor
	};
	const foot = slimFoot(p);
	// Where it is drawn now: its laid-out top plus whatever transform still runs on it.
	const ty = translateY(p.main);
	const layoutTop = p.main.getBoundingClientRect().top - ty;
	const edge = visibleEdge(drawnEdge(layoutTop, ty), foot);
	// A step inside one page (`words`) keeps the card where it is; so does reduced motion.
	const held = reducedMotion() || kind === 'words' ? edge.y : heldEdge(edge.y, foot);
	const fades = words(p).map((el) => [el, getComputedStyle(el).opacity] as const);
	stopAll();
	const mine = ++gen;
	moveState.edge = held;
	moveState.square = edge.square;
	moveState.since = performance.now();
	moveState.phase = 'up';
	const up = keep(
		play(
			p.main,
			[{ transform: `translateY(${ty}px)` }, { transform: `translateY(${ty + held - edge.y}px)` }],
			{ duration: PAGE_MOVE.up, fill: 'forwards' }
		)
	);
	for (const [el, from] of fades)
		keep(
			play(el, [{ opacity: from }, { opacity: 0 }], {
				duration: PAGE_MOVE.wordsOut,
				easing: LEAVE,
				fill: 'forwards'
			})
		);
	if (up) holdScroll(true);
	// The faded page is still there under the empty card: nothing on it answers a tap meanwhile
	// (the band's ‹ and buttons and the tabs stay live).
	p.main.inert = true;
	inerted = p.main;
	const held_ = () => {
		if (mine === gen && moveState.phase === 'up') moveState.phase = 'held';
	};
	if (up) up.finished.then(held_, () => {});
	else held_();
	return true;
}

/** The card comes down from where it waits to where this page's band ends; its words fade in. */
async function land() {
	const from = moveState.edge;
	const wasSquare = moveState.square;
	const mine = ++gen;
	await tick();
	if (mine !== gen) return;
	stopAll();
	holdScroll(false);
	release();
	const shape = shapeOf(page.route.id);
	const leaving = fromScreen;
	fromScreen = false;
	if (shape === 'screen') {
		// Into a full-screen page: it is there at once, and the band and the held card fade off it.
		if (from !== null)
			fadeOff(ghost(paint.band, { y: from, square: wasSquare, ground: paint.ground }));
		return done(mine);
	}
	const p = parts();
	if (!p || shape !== 'card' || (from === null && !leaving)) return done(mine);
	const foot = slimFoot(p);
	const to = visibleEdge(p.main.getBoundingClientRect().top, foot);
	// Out of a full-screen page the card comes in held, as if it had lifted, under band that fades off.
	const start = from ?? heldEdge(to.y, foot);
	if (leaving && p.header) fadeOff(ghost(getComputedStyle(p.header).backgroundColor, null));
	const shift = start - to.y;
	moveState.phase = 'down';
	landingEnd = performance.now() + PAGE_MOVE.down;
	const radius = (square: boolean) => (square ? '0px' : '28px');
	// Landing under the slim band (back to a scrolled page) the card's visible edge is the slim
	// band's foot, which no transform of the card moves: a band strip from there shrinks away.
	if (shift > 0 && to.square && p.header && foot !== null) {
		const strip = document.createElement('div');
		strip.setAttribute('aria-hidden', 'true');
		Object.assign(strip.style, {
			position: 'fixed',
			insetInline: '0',
			top: `${foot}px`,
			height: `${shift}px`,
			zIndex: '29',
			pointerEvents: 'none',
			transformOrigin: 'top',
			background: getComputedStyle(p.header).backgroundColor
		});
		document.body.append(strip);
		const a = play(strip, [{ transform: 'none' }, { transform: 'scaleY(0)' }], {
			duration: PAGE_MOVE.down,
			fill: 'forwards'
		});
		if (a)
			a.finished.then(
				() => strip.remove(),
				() => strip.remove()
			);
		else strip.remove();
		setTimeout(() => strip.remove(), 2000);
	}
	// A card that starts lower than its place uncovers the space under the band: band there.
	else if (shift > 0 && p.header) {
		shadowed = p.header;
		p.header.style.boxShadow = `0 ${shift}px 0 0 ${getComputedStyle(p.header).backgroundColor}`;
	}
	const anims = [
		keep(
			play(p.main, [{ transform: `translateY(${shift}px)` }, { transform: 'none' }], {
				duration: PAGE_MOVE.down,
				fill: 'backwards'
			})
		),
		keep(
			play(
				p.main,
				[
					{ borderTopLeftRadius: radius(wasSquare), borderTopRightRadius: radius(wasSquare) },
					{ borderTopLeftRadius: radius(to.square), borderTopRightRadius: radius(to.square) }
				],
				{ duration: PAGE_MOVE.corners, fill: 'backwards' }
			)
		),
		...words(p).map((el) =>
			keep(
				play(el, [{ opacity: 0 }, { opacity: 1 }], {
					duration: PAGE_MOVE.wordsIn,
					delay: PAGE_MOVE.wordsInDelay,
					easing: 'ease-out',
					fill: 'backwards'
				})
			)
		)
	].filter((a): a is Animation => a !== null);
	await Promise.all(anims.map((a) => a.finished.catch(() => {})));
	done(mine);
}

/** Back to rest: no animation left on the page, nothing set by hand. */
function done(mine: number) {
	if (mine !== gen) return;
	stopAll();
	holdScroll(false);
	release();
	if (shadowed) shadowed.style.boxShadow = '';
	shadowed = null;
	moveState.phase = 'idle';
	moveState.edge = null;
}

/** "Still trying… Go back": the navigation that hangs is overtaken by this page, which lands. */
export function goBack(): void {
	void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true });
}

/** Wires the move to the router: once, from the root layout. */
export function pageMove(): void {
	$effect(() => {
		const to = navigating.to;
		untrack(() => {
			if (!to) {
				// Over with no new page drawn (cancelled, overtaken by the same page): land here.
				if (moveState.phase === 'up' || moveState.phase === 'held') void land();
				return;
			}
			const step = inPage;
			inPage = false;
			if (moveState.phase === 'up' || moveState.phase === 'held') {
				// Already waiting: it waits for this one now.
				moveState.since = performance.now();
				return;
			}
			const kind = moveKind(
				{ routeId: page.route.id, path: page.url.pathname },
				{ routeId: to.route.id, path: to.url.pathname },
				{ desk: desk.current, inPage: step }
			);
			if (kind !== 'none') lift(kind);
		});
	});
	// Just before the new page is drawn: where the card really is (a page ready mid-lift lands
	// from there, not from where the lift was heading).
	onNavigate(() => {
		if (moveState.phase !== 'up' && moveState.phase !== 'held') return;
		const p = parts();
		if (!p || moveState.edge === null) return;
		const at = visibleEdge(p.main.getBoundingClientRect().top, slimFoot(p));
		moveState.edge = at.y;
		moveState.square = at.square;
	});
	afterNavigate(() => {
		if (moveState.phase === 'up' || moveState.phase === 'held') void land();
	});
}
