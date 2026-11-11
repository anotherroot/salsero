import { describe, expect, it } from 'vitest';
import { targetLabel } from './words';

describe('targetLabel', () => {
	it('names a target by its counts or in words', () => {
		expect(targetLabel('ones')).toBe('1 · 5');
		expect(targetLabel('one')).toBe('The 1');
		expect(targetLabel('clave')).toBe('The clave');
	});
});

describe('targetLabel for your own counts', () => {
	it('names them by their counts', () => {
		expect(targetLabel('own', [3, 6, 7])).toBe('3 6 7');
		expect(targetLabel('own', [])).toBe('Your own');
	});
});
