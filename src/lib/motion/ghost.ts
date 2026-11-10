import { LEAVE, MS, play, reducedMotion } from './motion';

/**
 * A ghost: a picture of an element the page has already dropped (a row that
 * left its list, a sheet that closed), drawn where it was so it can move away.
 * It is a copy in a fixed layer on <body>: it never takes a tap, focus or a
 * screen reader's attention, and it outlives the component it came from (a
 * sheet on a page that is navigated away). It removes itself once the
 * animations started on it have finished.
 */

/** A ghost never outlasts this, whatever its animations do. */
const MAX_MS = 2000;

/** The copy must not answer to the page's own lookups (`data-focus`, ids, keys). */
function scrub(node: Element): void {
	for (const el of [node, ...node.querySelectorAll('*')]) {
		el.removeAttribute('id');
		for (const name of el.getAttributeNames())
			if (name.startsWith('data-')) el.removeAttribute(name);
	}
}

/**
 * A copy of `el` at its place on screen now. With `clip`, it is drawn inside
 * `clip`'s box and rounded corners (a row sliding out of its card); without, it
 * floats free. Returns the copy: animate it at once.
 */
export function ghost(el: HTMLElement, clip: HTMLElement | null): HTMLElement {
	const box = el.getBoundingClientRect();
	const frame = (clip ?? el).getBoundingClientRect();
	const style = getComputedStyle(clip ?? el.parentElement ?? el);

	const layer = document.createElement('div');
	layer.setAttribute('aria-hidden', 'true');
	layer.inert = true;
	Object.assign(layer.style, {
		position: 'fixed',
		left: `${frame.left}px`,
		top: `${frame.top}px`,
		width: `${frame.width}px`,
		height: `${frame.height}px`,
		overflow: clip ? 'hidden' : 'visible',
		borderRadius: clip ? style.borderRadius : '0',
		pointerEvents: 'none',
		zIndex: '30',
		color: style.color,
		font: style.font
	});

	const copy = el.cloneNode(true) as HTMLElement;
	scrub(copy);
	Object.assign(copy.style, {
		position: 'absolute',
		left: `${box.left - frame.left}px`,
		top: `${box.top - frame.top}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		margin: '0',
		listStyle: 'none'
	});
	layer.append(copy);
	document.body.append(layer);

	const remove = () => layer.remove();
	const timer = setTimeout(remove, MAX_MS);
	queueMicrotask(() => {
		const running = layer.getAnimations({ subtree: true });
		if (running.length === 0) {
			clearTimeout(timer);
			remove();
			return;
		}
		void Promise.allSettled(running.map((a) => a.finished)).then(() => {
			clearTimeout(timer);
			remove();
		});
	});
	return copy;
}

const CLEAR = new Set(['', 'transparent', 'rgba(0, 0, 0, 0)']);

/**
 * A sheet closed by its owner (a face saved, Cancel) leaves instead of
 * vanishing: on the phone it slides down off the screen, from 640 px (a
 * centred dialog) it fades and shrinks a little; its dim fades with it. Called
 * just before `dialog.close()`, which still happens at once: focus, history and
 * the page under it never wait for this.
 */
export function sheetLeave(dialog: HTMLDialogElement): void {
	if (reducedMotion() || typeof dialog.animate !== 'function') return;
	const wide = globalThis.matchMedia?.('(min-width: 640px)').matches ?? false;
	const ms = wide ? MS.short : MS.medium;

	const dim = getComputedStyle(dialog, '::backdrop').backgroundColor;
	if (!CLEAR.has(dim)) {
		const veil = document.createElement('div');
		veil.setAttribute('aria-hidden', 'true');
		Object.assign(veil.style, {
			position: 'fixed',
			inset: '0',
			background: dim,
			pointerEvents: 'none',
			zIndex: '29'
		});
		document.body.append(veil);
		const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
		void fade.finished.finally(() => veil.remove()).catch(() => {});
	}

	const copy = ghost(dialog, null);
	// The copy keeps the dialog's classes: not its opening animation, nor its size limits.
	Object.assign(copy.style, { animation: 'none', maxHeight: 'none', maxWidth: 'none' });
	play(
		copy,
		wide
			? [
					{ opacity: 1, transform: 'none' },
					{ opacity: 0, transform: 'scale(.97)' }
				]
			: [{ transform: 'none' }, { transform: 'translateY(100%)' }],
		{ duration: ms, easing: LEAVE, fill: 'forwards' }
	);
}
