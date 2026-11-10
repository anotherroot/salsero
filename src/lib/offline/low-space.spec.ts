import { describe, expect, it } from 'vitest';
import { shouldOpenLowSheet } from './low-space';

describe('the low-space sheet opens once (offline phase 4b)', () => {
	it('when space is short and it has not been shown yet', () => {
		expect(shouldOpenLowSheet(true, false)).toBe(true);
		expect(shouldOpenLowSheet(true, true)).toBe(false);
		expect(shouldOpenLowSheet(false, false)).toBe(false);
	});
});
