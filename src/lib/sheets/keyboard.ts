/**
 * A sheet above the on-screen keyboard. Chrome on Android (and Safari) lay the
 * keyboard over the page: the layout viewport keeps its height, only the
 * visual viewport shrinks, so a sheet fixed to the bottom ends up under the
 * keyboard, its field and Send with it. The Android app shrinks the WebView
 * itself (`WebShell.kt`), so there the two heights agree and nothing moves.
 *
 * `keyboardInsets` is PURE: where the visible part of the page is. `followKeyboard`
 * puts it on a dialog as `--kb-top`, `--kb-bottom` and `--vvh`, which Sheet's
 * phone CSS reads (its `top`, `bottom` and 88 % of the visible height).
 */

export interface Viewport {
	/** `window.innerHeight`: the layout viewport. */
	innerHeight: number;
	/** `visualViewport.height`, `.offsetTop` and `.scale`. */
	height: number;
	offsetTop: number;
	scale: number;
}

/** How far the visible part sits from the top and bottom of the page, or null when it is all of it. */
export function keyboardInsets(
	v: Viewport
): { top: number; bottom: number; height: number } | null {
	// A pinch zoom shrinks the visual viewport too; the page is only magnified.
	if (Math.abs(v.scale - 1) > 0.01) return null;
	const top = Math.max(0, v.offsetTop);
	const bottom = Math.max(0, v.innerHeight - v.offsetTop - v.height);
	if (top < 1 && bottom < 1) return null;
	return { top, bottom, height: v.height };
}

const PROPS = ['--kb-top', '--kb-bottom', '--vvh'] as const;

/** Keeps `el`'s keyboard properties current while it is shown; returns the stop. */
export function followKeyboard(el: HTMLElement): () => void {
	const vv = window.visualViewport;
	if (!vv) return () => {};
	const apply = () => {
		const at = keyboardInsets({
			innerHeight: window.innerHeight,
			height: vv.height,
			offsetTop: vv.offsetTop,
			scale: vv.scale
		});
		if (!at) {
			for (const p of PROPS) el.style.removeProperty(p);
			return;
		}
		el.style.setProperty('--kb-top', `${at.top}px`);
		el.style.setProperty('--kb-bottom', `${at.bottom}px`);
		el.style.setProperty('--vvh', `${at.height}px`);
	};
	apply();
	vv.addEventListener('resize', apply);
	vv.addEventListener('scroll', apply);
	return () => {
		vv.removeEventListener('resize', apply);
		vv.removeEventListener('scroll', apply);
		for (const p of PROPS) el.style.removeProperty(p);
	};
}
