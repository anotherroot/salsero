import { describe, expect, it } from 'vitest';
import { posLabel, posName, targetLabel } from './words';

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

describe('positions', () => {
	it('labels a position by its count, the and with &', () => {
		expect(posLabel(6.5)).toBe('6&');
		expect(posLabel(2)).toBe('2');
	});

	it('names a position in a sentence', () => {
		expect(posName(6.5)).toBe('the and of 6');
		expect(posName(1)).toBe('the 1');
	});
});
