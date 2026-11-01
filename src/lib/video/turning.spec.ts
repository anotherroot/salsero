import { describe, expect, it } from 'vitest';
import { letPhoneTurn } from './turning';

describe('letPhoneTurn', () => {
	it('frees the turning on open and stands the app upright on close', () => {
		const sent: string[] = [];
		const release = letPhoneTurn({ postMessage: (m) => void sent.push(m) });
		expect(sent).toEqual(['free']);
		release();
		expect(sent).toEqual(['free', 'portrait']);
	});

	it('does nothing in a browser, where there is no bridge', () => {
		expect(() => letPhoneTurn(undefined)()).not.toThrow();
	});
});
