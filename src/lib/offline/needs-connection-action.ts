/*
 * A lone button or link that needs a connection (offline phase 3, look 4B):
 * offline it is greyed (`[data-offline]` in layout.css) and a tap goes nowhere
 * but says "Needs a connection" in the root layout's toast. Online, an
 * ordinary button. The parameter is whether the browser is online.
 */
import type { Action } from 'svelte/action';

const NEEDS_CONNECTION_EVENT = 'salsa:needs-connection';

export const needsConnection: Action<HTMLElement, boolean | undefined> = (node, online) => {
	let off = online === false;
	const stop = (e: Event) => {
		if (!off) return;
		e.preventDefault();
		e.stopPropagation();
		window.dispatchEvent(new CustomEvent(NEEDS_CONNECTION_EVENT));
	};
	const apply = () => {
		if (off) {
			node.setAttribute('aria-disabled', 'true');
			node.setAttribute('data-offline', '');
		} else {
			node.removeAttribute('aria-disabled');
			node.removeAttribute('data-offline');
		}
	};
	node.addEventListener('click', stop, true);
	node.addEventListener('submit', stop, true);
	apply();
	return {
		update(next) {
			off = next === false;
			apply();
		},
		destroy() {
			node.removeEventListener('click', stop, true);
			node.removeEventListener('submit', stop, true);
		}
	};
};
