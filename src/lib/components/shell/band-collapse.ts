/**
 * The phone's big band folding into the slim one as the page scrolls: its
 * title shrinks and moves to the slim band's title, Back and the actions move
 * to the slim band's row, the subtitle to the slim band's when it has one (a
 * compact screen's), and what else is under the title (the group line, a
 * subtitle the slim band drops, `extra`) fades. At the pin (`bandMode`) the
 * slim band takes over with nothing to fade: it holds the same things in the
 * same places. A group's row (its badge and name) shrinks into the slim band's
 * group line the same way. A title on two lines cannot become the slim band's
 * one: it shrinks as two and dissolves over the last `WRAPPED_FADE` px before
 * the pin, its subtitle fading early out of its way, and the slim band's title
 * and subtitle come in over as many px after it. The rest is in place either way. Inline styles on the big
 * band's marked parts (`data-band-*` in `BandHeader`), measured against the
 * slim band's (`data-slim-name`, `data-slim-sub`, `data-slim-g*`); never on the desktop (`clear`). Not PURE: the math is
 * `$lib/nav/band`.
 *
 * Where the browser has scroll timelines (`scrollDriven`), `drive` hands the
 * fold to the scroll itself (`data-fold` and the `band-*` keyframes in
 * layout.css): it only writes the end values and the range, again when the pin
 * or the band changes, and nothing runs while the page scrolls, so nothing
 * lags the finger. Elsewhere `update` draws each scroll from script.
 *
 * Positions are read from the layout (`offsetTop`/`offsetLeft`), which a
 * transform or a running fold does not move: measuring never takes the fold
 * off, so the big title never shows at rest for a frame mid-scroll.
 */
import { lerp } from '$lib/nav/band';

/**
 * A part at rest, in page coordinates: where its text starts (its left plus
 * its left padding, `pad`: a subtitle's indent) and its centre.
 */
type Spot = { x: number; cy: number; pad: number };

/** How many px a two-line title takes to dissolve before the pin, and the slim one to come in after. */
export const WRAPPED_FADE = 12;

type Rest = {
	name: Spot | null;
	/** The title wraps onto a second line (it crossfades into the slim band's one). */
	wrapped: boolean;
	gbadge: Spot | null;
	gname: Spot | null;
	slimGbadge: Spot | null;
	slimGname: Spot | null;
	gbadgeScale: number;
	gnameScale: number;
	sub: Spot | null;
	left: Spot | null;
	right: Spot | null;
	/** The slim band's title, on screen (it is fixed). */
	slimName: Spot | null;
	/** The slim band's subtitle, on screen; null where it has none (the big one's fades). */
	slimSub: Spot | null;
	/** The centre of the slim band's 64 px row, on screen. */
	slimRow: number;
	/** The slim title's size over the big one's, and the subtitle's. */
	scale: number;
	subScale: number;
};

const parts = (header: HTMLElement) => ({
	name: header.querySelector<HTMLElement>('[data-band-name]'),
	/** The title's h1: a two-line title dissolves through it (the name's own animation flies). */
	h1: header.querySelector<HTMLElement>('[data-band-name]')?.parentElement ?? null,
	// The phone's subtitle (the desktop's is hidden there, and has no box).
	sub:
		[...header.querySelectorAll<HTMLElement>('[data-band-sub]')].find((el) => el.offsetParent) ??
		null,
	gbadge: header.querySelector<HTMLElement>('[data-band-gbadge]'),
	gname: header.querySelector<HTMLElement>('[data-band-gname]'),
	left: header.querySelector<HTMLElement>('[data-band-left]'),
	right: header.querySelector<HTMLElement>('[data-band-right]'),
	fades: [...header.querySelectorAll<HTMLElement>('[data-band-fade]')]
});

/** Where the layout puts `el`, transforms aside: page coordinates, or the screen's inside a fixed box. */
function placed(el: HTMLElement): { left: number; top: number } {
	let left = 0;
	let top = 0;
	for (let at: HTMLElement | null = el; at; at = at.offsetParent as HTMLElement | null) {
		left += at.offsetLeft;
		top += at.offsetTop;
	}
	return { left, top };
}

function spot(el: HTMLElement | null): Spot | null {
	if (!el) return null;
	const { left, top } = placed(el);
	const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
	return { x: left + pad, cy: top + el.offsetHeight / 2, pad };
}

const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 1;

/** Whether the fold can run on the scroll itself (CSS scroll timelines). */
export const scrollDriven = (): boolean =>
	typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');

const FOLD_VARS = ['--fly-x', '--fly-y', '--fly-k', '--fold-from', '--fold-to'];

function unfold(el: HTMLElement) {
	el.removeAttribute('data-fold');
	for (const v of FOLD_VARS) el.style.removeProperty(v);
}

/**
 * Hand one part to the scroll: `kind` its keyframes, over `from`..`to` px of
 * scroll. A part already folding only takes the new values: its animation runs on.
 */
function fold(
	el: HTMLElement,
	kind: 'fly' | 'fade' | 'in',
	from: number,
	to: number,
	vars: Record<string, string> = {}
) {
	el.style.setProperty('--fold-from', `${from}px`);
	el.style.setProperty('--fold-to', `${to}px`);
	for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
	if (el.getAttribute('data-fold') !== kind) el.setAttribute('data-fold', kind);
}

function measure(header: HTMLElement, slim: HTMLElement): Rest {
	const p = parts(header);
	const slimName = slim.querySelector<HTMLElement>('[data-slim-name]');
	const slimSub = slim.querySelector<HTMLElement>('[data-slim-sub]');
	const slimGbadge = slim.querySelector<HTMLElement>('[data-slim-gbadge]');
	const slimGname = slim.querySelector<HTMLElement>('[data-slim-gname]');
	const band = placed(slim);
	const lineH = p.name ? parseFloat(getComputedStyle(p.name).lineHeight) || fontSize(p.name) : 0;
	return {
		name: spot(p.name),
		wrapped: !!p.name && p.name.offsetHeight > lineH * 1.5,
		gbadge: spot(p.gbadge),
		gname: spot(p.gname),
		slimGbadge: spot(slimGbadge),
		slimGname: spot(slimGname),
		gbadgeScale:
			p.gbadge && slimGbadge && p.gbadge.offsetWidth
				? slimGbadge.offsetWidth / p.gbadge.offsetWidth
				: 1,
		gnameScale: p.gname && slimGname ? fontSize(slimGname) / fontSize(p.gname) : 1,
		sub: spot(p.sub),
		left: spot(p.left),
		right: spot(p.right),
		slimName: spot(slimName),
		slimSub: spot(slimSub),
		slimRow: band.top + slim.offsetHeight - 32,
		scale: p.name && slimName ? fontSize(slimName) / fontSize(p.name) : 1,
		subScale: p.sub && slimSub ? fontSize(slimSub) / fontSize(p.sub) : 1
	};
}

/** The slim band's title and subtitle: what a two-line title's dissolve brings in. */
const slimText = (slim: HTMLElement) =>
	[
		slim.querySelector<HTMLElement>('[data-slim-name]'),
		slim.querySelector<HTMLElement>('[data-slim-sub]')
	].filter((el): el is HTMLElement => el !== null);

/** 0 to 1 over `from`..`to` of scroll. */
const ramp = (y: number, from: number, to: number) =>
	Math.min(1, Math.max(0, (y - from) / Math.max(1e-6, to - from)));

export function bandCollapse() {
	/** The rest positions and what they were measured for (the band's key). */
	let rest: (Rest & { key: string }) | null = null;
	/** What `drive` last handed to the scroll: the pin and the key. */
	let driven: string | null = null;

	const restFor = (header: HTMLElement, slim: HTMLElement, key: string): Rest => {
		if (rest?.key !== key) rest = { ...measure(header, slim), key };
		return rest;
	};

	function reset(header: HTMLElement, slim?: HTMLElement | null) {
		const p = parts(header);
		for (const el of [p.name, p.h1, p.sub, p.gbadge, p.gname, p.left, p.right, ...p.fades]) {
			if (!el) continue;
			el.style.transform = '';
			el.style.opacity = '';
			unfold(el);
		}
		if (slim) {
			for (const el of [slim, ...slimText(slim)]) {
				unfold(el);
				el.style.opacity = '';
			}
		}
	}

	return {
		/**
		 * Draw the fold at `scrollY`, `progress` of the way to the pin (browsers
		 * without scroll timelines). `key` names what the rest positions hang on
		 * (the width, the title): a new one measures again.
		 */
		update(
			header: HTMLElement,
			slim: HTMLElement,
			scrollY: number,
			pin: number,
			progress: number,
			key: string
		): void {
			const r = restFor(header, slim, key);
			const p = parts(header);
			// Where a part is now without a transform: its rest centre, moved up by the scroll.
			const moved = (from: number, to: number) => lerp(from, to, progress) - (from - scrollY);
			// A text part: scaled about where its text starts, carried to the slim band's.
			const fly = (el: HTMLElement | null, from: Spot | null, to: Spot | null, scale: number) => {
				if (!el || !from || !to) return;
				el.style.transformOrigin = `${from.pad}px center`;
				el.style.transform = `translate(${lerp(0, to.x - from.x, progress)}px, ${moved(
					from.cy,
					to.cy
				)}px) scale(${lerp(1, scale, progress)})`;
			};
			fly(p.name, r.name, r.slimName, r.scale);
			if (!r.wrapped) fly(p.sub, r.sub, r.slimSub, r.subScale);
			fly(p.gbadge, r.gbadge, r.slimGbadge, r.gbadgeScale);
			fly(p.gname, r.gname, r.slimGname, r.gnameScale);
			// A two-line title dissolves before the pin; the slim title comes in after it.
			if (p.h1)
				p.h1.style.opacity = r.wrapped ? String(1 - ramp(scrollY, pin - WRAPPED_FADE, pin)) : '';
			for (const el of slimText(slim))
				el.style.opacity = r.wrapped ? String(ramp(scrollY, pin, pin + WRAPPED_FADE)) : '';
			for (const [el, at] of [
				[p.left, r.left],
				[p.right, r.right]
			] as const) {
				if (el && at) el.style.transform = `translateY(${moved(at.cy, r.slimRow)}px)`;
			}
			// What sits under the title fades in the first part of the way, out of the title's path.
			const fade = String(Math.max(0, 1 - progress * 1.6));
			for (const el of p.fades) el.style.opacity = fade;
			// A subtitle the slim band drops fades with the rest, and one under a two-line title.
			if (p.sub && (!r.slimSub || r.wrapped)) p.sub.style.opacity = fade;
		},
		/**
		 * Hand the fold to the scroll (`scrollDriven` browsers): the end of each part's
		 * way at `pin` and its range. Writes only when the pin or `key` changed, and
		 * then only new values: the running fold is never taken off. The slim band
		 * comes in at the pin itself, in the same frame the title lands.
		 */
		drive(header: HTMLElement, slim: HTMLElement, pin: number, key: string): void {
			const at = `${pin}|${key}`;
			if (driven === at) return;
			driven = at;
			const r = restFor(header, slim, key);
			const p = parts(header);
			// At the pin a part has moved up by the pin and must sit at its target:
			// the way is (target − rest) + pin, linear in the scroll as the script's is.
			const flyTo = (el: HTMLElement | null, from: Spot | null, to: Spot | null, k: number) => {
				if (!el || !from || !to) return;
				el.style.transformOrigin = `${from.pad}px center`;
				fold(el, 'fly', 0, pin, {
					'--fly-x': `${to.x - from.x}px`,
					'--fly-y': `${to.cy - from.cy + pin}px`,
					'--fly-k': String(k)
				});
			};
			flyTo(p.name, r.name, r.slimName, r.scale);
			if (r.wrapped) {
				if (p.sub) unfold(p.sub);
			} else flyTo(p.sub, r.sub, r.slimSub, r.subScale);
			flyTo(p.gbadge, r.gbadge, r.slimGbadge, r.gbadgeScale);
			flyTo(p.gname, r.gname, r.slimGname, r.gnameScale);
			for (const [el, from] of [
				[p.left, r.left],
				[p.right, r.right]
			] as const) {
				if (el && from) fold(el, 'fly', 0, pin, { '--fly-y': `${r.slimRow - from.cy + pin}px` });
			}
			const fades = [...p.fades, ...(p.sub && (!r.slimSub || r.wrapped) ? [p.sub] : [])];
			for (const el of fades) fold(el, 'fade', 0, pin / 1.6);
			// One line lands as the slim title: the slim band takes over at the pin.
			fold(slim, 'in', Math.max(0, pin - 0.5), pin);
			// Two lines cannot: the big title dissolves before the pin, the slim one comes in after.
			if (r.wrapped) {
				if (p.h1) fold(p.h1, 'fade', Math.max(0, pin - WRAPPED_FADE), pin);
				for (const el of slimText(slim)) fold(el, 'in', pin, pin + WRAPPED_FADE);
			} else {
				if (p.h1) unfold(p.h1);
				for (const el of slimText(slim)) unfold(el);
			}
		},
		/** Back to rest: the desktop, or a page whose band does not fold. */
		clear(header: HTMLElement | null, slim?: HTMLElement | null): void {
			rest = null;
			driven = null;
			if (header) reset(header, slim);
		}
	};
}
