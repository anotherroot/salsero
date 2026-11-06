import { describe, expect, it } from 'vitest';
import { memberRoute } from './pages';

describe('memberRoute', () => {
	it('opens each kind’s own page, never a list', () => {
		expect(memberRoute('figure')).toBe('/[dance]/(moves)/figures/[id]');
		expect(memberRoute('routine')).toBe('/[dance]/(moves)/routines/[id]');
		expect(memberRoute('drill')).toBe('/[dance]/(today)/exercises/[id]');
		expect(memberRoute('song')).toBe('/[dance]/songs/[id]');
		expect(memberRoute('lesson')).toBe('/[dance]/lessons/[id]');
		expect(memberRoute('position')).toBe('/[dance]/(moves)/positions/[id]');
	});
});
