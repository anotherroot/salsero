import { describe, expect, it, vi } from 'vitest';
import { DROPPED_RETRIES, droppedMove, watchDropped, type UnderWay } from './dropped';

/** A navigation under way whose `complete` the test settles. */
function underWay(href = 'https://salsa.test/salsa/lessons', popstate = false) {
	let fulfil!: () => void;
	let reject!: (e: unknown) => void;
	const complete = new Promise<void>((f, r) => {
		fulfil = f;
		reject = r;
	});
	complete.catch(() => {});
	const nav: UnderWay = { complete, href, popstate };
	return { nav, fulfil, reject };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('watchDropped', () => {
	it('goes again when SvelteKit aborts a navigation and leaves it under way', async () => {
		const { nav, reject } = underWay();
		const again = vi.fn();
		watchDropped(nav, () => nav.complete, again);
		reject(new Error('navigation aborted'));
		await settle();
		expect(again).toHaveBeenCalledWith(nav);
	});

	it('leaves a navigation that finished', async () => {
		const { nav, fulfil } = underWay();
		const again = vi.fn();
		watchDropped(nav, () => null, again);
		fulfil();
		await settle();
		expect(again).not.toHaveBeenCalled();
	});

	it('leaves one a newer navigation took over: that one is under way now', async () => {
		const first = underWay();
		const newer = underWay('https://salsa.test/salsa/songs');
		const again = vi.fn();
		watchDropped(first.nav, () => newer.nav.complete, again);
		first.reject(new Error('navigation aborted'));
		await settle();
		expect(again).not.toHaveBeenCalled();
	});

	it('leaves one that was cancelled: it was never under way', async () => {
		const { nav, reject } = underWay();
		const again = vi.fn();
		watchDropped(nav, () => null, again);
		reject(new Error('navigation cancelled'));
		await settle();
		expect(again).not.toHaveBeenCalled();
	});
});

describe('droppedMove', () => {
	it('goes again inside the app, then loads the page whole', () => {
		for (let n = 1; n <= DROPPED_RETRIES; n++) expect(droppedMove(n)).toBe('goto');
		expect(droppedMove(DROPPED_RETRIES + 1)).toBe('load');
	});
});
