/**
 * The phone's big band folding into the slim one as the page scrolls: its
 * title shrinks and moves to the slim band's title, Back and the actions move
 * to the slim band's row, the subtitle to the slim band's when it has one (a
 * compact screen's), and what else is under the title (the group line, a
 * subtitle the slim band drops, `extra`) fades. At the pin (`bandMode`) the slim band takes over
 * with nothing to fade: it holds the same things in the same places. Inline
 * styles on the big band's marked parts (`data-band-*` in `BandHeader`), measured
 * against the slim band's (`data-slim-name`, `data-slim-sub`); never on the desktop (`clear`). Not PURE:
 * the math is `$lib/nav/band`.
 */
import { lerp } from '$lib/nav/band';

/**
 * A part at rest (no transform), in page coordinates: where its text starts
 * (its left plus its left padding, `pad`: a subtitle's indent) and its centre.
 */
type Spot = { x: number; cy: number; pad: number };

type Rest = {
	key: string;
	name: Spot | null;
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
	// The phone's subtitle (the desktop's is hidden there, and has no box).
	sub:
		[...header.querySelectorAll<HTMLElement>('[data-band-sub]')].find((el) => el.offsetParent) ??
		null,
	left: header.querySelector<HTMLElement>('[data-band-left]'),
	right: header.querySelector<HTMLElement>('[data-band-right]'),
	fades: [...header.querySelectorAll<HTMLElement>('[data-band-fade]')]
});

function spot(el: HTMLElement | null, scrollY: number): Spot | null {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
	return { x: r.left + pad, cy: r.top + r.height / 2 + scrollY, pad };
}

const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 1;

export function bandCollapse() {
	let rest: Rest | null = null;

	function reset(header: HTMLElement) {
		const p = parts(header);
		for (const el of [p.name, p.sub, p.left, p.right]) if (el) el.style.transform = '';
		for (const el of [...p.fades, p.sub]) if (el) el.style.opacity = '';
	}

	function measure(header: HTMLElement, slim: HTMLElement, key: string): Rest {
		reset(header);
		const p = parts(header);
		const y = window.scrollY;
		const slimName = slim.querySelector<HTMLElement>('[data-slim-name]');
		const s = slimName?.getBoundingClientRect();
		const slimSub = slim.querySelector<HTMLElement>('[data-slim-sub]');
		const ss = slimSub?.getBoundingClientRect();
		return {
			key,
			name: spot(p.name, y),
			sub: spot(p.sub, y),
			left: spot(p.left, y),
			right: spot(p.right, y),
			slimName: s ? { x: s.left, cy: s.top + s.height / 2, pad: 0 } : null,
			slimSub: ss ? { x: ss.left, cy: ss.top + ss.height / 2, pad: 0 } : null,
			slimRow: slim.getBoundingClientRect().bottom - 32,
			scale: p.name && slimName ? fontSize(slimName) / fontSize(p.name) : 1,
			subScale: p.sub && slimSub ? fontSize(slimSub) / fontSize(p.sub) : 1
		};
	}

	return {
		/**
		 * Draw the fold at `scrollY`, `progress` of the way to the pin. `key` names
		 * what the rest positions hang on (the width, the title): a new one measures again.
		 */
		update(
			header: HTMLElement,
			slim: HTMLElement,
			scrollY: number,
			progress: number,
			key: string
		): void {
			if (rest?.key !== key) rest = measure(header, slim, key);
			const r = rest;
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
			fly(p.sub, r.sub, r.slimSub, r.subScale);
			for (const [el, at] of [
				[p.left, r.left],
				[p.right, r.right]
			] as const) {
				if (el && at) el.style.transform = `translateY(${moved(at.cy, r.slimRow)}px)`;
			}
			// What sits under the title fades in the first part of the way, out of the title's path.
			const fade = String(Math.max(0, 1 - progress * 1.6));
			for (const el of p.fades) el.style.opacity = fade;
			// A subtitle the slim band drops fades with the rest.
			if (p.sub && !r.slimSub) p.sub.style.opacity = fade;
		},
		/** Back to rest: the desktop, or a page whose band does not fold. */
		clear(header: HTMLElement | null): void {
			rest = null;
			if (header) reset(header);
		}
	};
}
