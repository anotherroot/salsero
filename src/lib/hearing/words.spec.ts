import { describe, expect, it } from 'vitest';
import { targetLabel } from './words';

describe('targetLabel', () => {
	it('names a target by its counts or in words', () => {
		expect(targetLabel('ones')).toBe('1 · 5');
		expect(targetLabel('one')).toBe('The 1');
		expect(targetLabel('clave')).toBe('The clave');
	});
});
