import { describe, expect, it } from 'vitest';
import { suffixed } from './names';

describe('suffixed', () => {
	it('adds (2), then (3)', () => {
		expect(suffixed('Basic', () => false)).toBe('Basic');
		expect(suffixed('Basic', (n) => n === 'Basic')).toBe('Basic (2)');
		expect(suffixed('Basic', (n) => n === 'Basic' || n === 'Basic (2)')).toBe('Basic (3)');
	});
});
