import { describe, expect, it } from 'vitest';
import { iphoneWarning } from './iphone-warned';

function memory(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, v),
		removeItem: (k) => void m.delete(k),
		clear: () => m.clear(),
		key: () => null,
		length: 0
	} as Storage;
}
const broken = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	}
} as unknown as Storage;

describe('the iPhone card, once (offline phase 4c, look 3B)', () => {
	it('shown until closed, then never again', () => {
		const store = memory();
		const w = iphoneWarning(() => store);
		expect(w.shown()).toBe(true);
		w.close();
		expect(w.shown()).toBe(false);
		expect(iphoneWarning(() => store).shown()).toBe(false);
	});

	it('storage throws: shown, and closing still works for this page', () => {
		const w = iphoneWarning(() => broken);
		expect(w.shown()).toBe(true);
		w.close();
		expect(w.shown()).toBe(false);
	});
});
