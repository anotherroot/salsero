import { describe, expect, it } from 'vitest';
import { nextFocusKey } from './focus';

describe('nextFocusKey', () => {
	it('takes the next row, else the previous, else the fallback', () => {
		expect(nextFocusKey(['set-1', 'set-2', 'set-3'], 'set-2', 'sets-add')).toBe('set-3');
		expect(nextFocusKey(['set-1', 'set-2', 'set-3'], 'set-3', 'sets-add')).toBe('set-2');
		expect(nextFocusKey(['set-1'], 'set-1', 'sets-add')).toBe('sets-add');
		expect(nextFocusKey([], 'set-1', 'sets-heading')).toBe('sets-heading');
		expect(nextFocusKey(['set-1', 'set-2'], 'set-9', 'sets-add')).toBe('sets-add');
	});
});
