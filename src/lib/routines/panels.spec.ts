import { describe, expect, it } from 'vitest';
import { openable, panelHue, wherePath } from './panels';

describe('panels (spec 2026-11-12)', () => {
	it('panelHue cycles every four and keeps routines grey', () => {
		expect([1, 2, 3, 4, 5].map((d) => panelHue(d, false))).toEqual(['h1', 'h2', 'h3', 'h4', 'h1']);
		expect(panelHue(3, true)).toBe('rt');
	});

	it('openable stops at 4', () => {
		expect([1, 4, 5].map(openable)).toEqual([true, true, false]);
	});

	it('wherePath keeps the deepest three and counts the rest', () => {
		const chain = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ name, hue: 'h1' as const }));
		expect(wherePath(chain)).toEqual({ more: 2, rows: chain.slice(2) });
		expect(wherePath(chain.slice(0, 2))).toEqual({ more: 0, rows: chain.slice(0, 2) });
	});
});
