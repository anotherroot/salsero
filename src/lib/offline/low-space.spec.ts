import { describe, expect, it } from 'vitest';
import { shouldOpenLowSheet } from './low-space';

describe('the low-space sheet opens once (offline phase 4b)', () => {
	it('when space is short and it has not been shown yet', () => {
		expect(shouldOpenLowSheet(true, false)).toBe(true);
		expect(shouldOpenLowSheet(true, true)).toBe(false);
		expect(shouldOpenLowSheet(false, false)).toBe(false);
	});
});

describe('nothing to suggest: no sheet (4b minor 10)', () => {
	it('short of space but nothing the person can take off: only the dot and the page', () => {
		expect(shouldOpenLowSheet(true, false, 0)).toBe(false);
		expect(shouldOpenLowSheet(true, false, 2)).toBe(true);
	});
});
