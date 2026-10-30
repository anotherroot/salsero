import { describe, expect, it } from 'vitest';
import { leavesPage, skeletonFor } from './pending';

describe('skeletonFor', () => {
	it('gives Today its own shape', () => {
		expect(skeletonFor('/[dance]')).toEqual({ kind: 'today' });
	});

	it('titles a list with the name its page will show', () => {
		expect(skeletonFor('/[dance]/figures')).toEqual({ kind: 'list', title: 'Figures' });
		expect(skeletonFor('/[dance]/coverage')).toEqual({ kind: 'list', title: 'Routine coverage' });
		expect(skeletonFor('/settings')).toEqual({ kind: 'list', title: 'Settings' });
		expect(skeletonFor('/voice')).toEqual({ kind: 'list', title: 'My count' });
	});

	it('gives every page behind an id the detail shape', () => {
		for (const id of ['figures', 'routines', 'lessons', 'songs', 'exercises']) {
			expect(skeletonFor(`/[dance]/${id}/[id]`)).toEqual({ kind: 'detail' });
		}
		expect(skeletonFor('/[dance]/player')).toEqual({ kind: 'detail' });
	});

	it('leaves pages outside the shell, the redirect and unknown routes to the bar alone', () => {
		for (const id of ['/login', '/device/pair', '/share', '/', null, undefined]) {
			expect(skeletonFor(id)).toBeNull();
		}
	});
});

describe('leavesPage', () => {
	it('is a new path, not a new query', () => {
		expect(leavesPage('/salsa/figures', '/salsa/figures/12')).toBe(true);
		expect(leavesPage('/salsa', '/bachata')).toBe(true);
		expect(leavesPage('/salsa/figures', '/salsa/figures')).toBe(false);
	});
});
