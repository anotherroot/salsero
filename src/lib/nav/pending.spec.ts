import { describe, expect, it } from 'vitest';
import { leavesPage, skeletonFor } from './pending';

describe('skeletonFor', () => {
	it('gives Today its own shape', () => {
		expect(skeletonFor('/[dance]')).toEqual({ kind: 'today' });
	});

	it('gives the three Moves lists the Moves shape, with the destination segment', () => {
		expect(skeletonFor('/[dance]/figures')).toEqual({ kind: 'moves', segment: 'figures' });
		expect(skeletonFor('/[dance]/routines')).toEqual({ kind: 'moves', segment: 'routines' });
		expect(skeletonFor('/[dance]/positions')).toEqual({ kind: 'moves', segment: 'positions' });
	});

	it('gives the pages under Positions their own shapes, not the Moves band', () => {
		expect(skeletonFor('/[dance]/positions/[id]')).toEqual({ kind: 'detail' });
		expect(skeletonFor('/[dance]/positions/none')).toEqual({ kind: 'list', title: 'No position' });
		expect(skeletonFor('/[dance]/positions/map')).toEqual({ kind: 'detail' });
	});

	it('titles a list with the name its page will show', () => {
		expect(skeletonFor('/[dance]/coverage')).toEqual({ kind: 'list', title: 'Coverage' });
		expect(skeletonFor('/settings')).toEqual({ kind: 'list', title: 'Settings' });
		expect(skeletonFor('/voice')).toEqual({ kind: 'list', title: 'My count' });
	});

	it('gives every page behind an id the detail shape', () => {
		for (const id of ['lessons', 'songs', 'exercises']) {
			expect(skeletonFor(`/[dance]/${id}/[id]`)).toEqual({ kind: 'detail' });
		}
		expect(skeletonFor('/[dance]/player')).toEqual({ kind: 'detail' });
	});

	it('gives a figure its own shape', () => {
		expect(skeletonFor('/[dance]/figures/[id]')).toEqual({ kind: 'figure' });
	});

	it('gives a routine its own shape', () => {
		expect(skeletonFor('/[dance]/routines/[id]')).toEqual({ kind: 'routine' });
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
