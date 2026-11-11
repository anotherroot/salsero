import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepInPlace } from './anchor';

/** A card whose top the change moves, as a layout change would. */
const fake = (top: number) => {
	const el = {
		top,
		isConnected: true,
		getBoundingClientRect: () => ({ top: el.top })
	};
	return el;
};
const card = (el: ReturnType<typeof fake>) => el as unknown as Element;

describe('keepInPlace', () => {
	const scrollBy = vi.fn();
	beforeEach(() => vi.stubGlobal('window', { scrollBy }));
	afterEach(() => {
		vi.unstubAllGlobals();
		scrollBy.mockReset();
	});

	it('scrolls by how far the card moved', async () => {
		const el = fake(100);
		await keepInPlace(card(el), () => void (el.top = 140));
		expect(scrollBy).toHaveBeenCalledWith(0, 40);
	});

	it('and back up when it moved up', async () => {
		const el = fake(300);
		await keepInPlace(card(el), () => void (el.top = 220));
		expect(scrollBy).toHaveBeenCalledWith(0, -80);
	});

	it('not for under a pixel', async () => {
		const el = fake(100);
		await keepInPlace(card(el), () => void (el.top = 100.4));
		expect(scrollBy).not.toHaveBeenCalled();
	});

	it('no card, or one the change removed: the change still runs, nothing scrolls', async () => {
		const change = vi.fn();
		await keepInPlace(null, change);
		const el = fake(100);
		await keepInPlace(card(el), () => {
			el.top = 180;
			el.isConnected = false;
		});
		expect(change).toHaveBeenCalled();
		expect(scrollBy).not.toHaveBeenCalled();
	});
});
