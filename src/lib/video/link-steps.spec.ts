import { describe, expect, it } from 'vitest';
import { openingSteps } from './link-steps';

describe('openingSteps', () => {
	it('openingSteps: no links → pick; some → links', () => {
		expect(openingSteps(0)).toEqual(['pick']);
		expect(openingSteps(1)).toEqual(['links']);
		expect(openingSteps(3)).toEqual(['links']);
	});
});
