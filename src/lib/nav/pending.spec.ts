import { describe, expect, it } from 'vitest';
import { deskSkeletonMode, leavesPage, skeletonFor } from './pending';

describe('skeletonFor', () => {
	it('gives Today its own shape', () => {
		expect(skeletonFor('/[dance]')).toMatchObject({ kind: 'today' });
	});

	it('gives the three Moves lists the Moves shape, with the destination segment', () => {
		expect(skeletonFor('/[dance]/figures')).toMatchObject({ kind: 'moves', segment: 'figures' });
		expect(skeletonFor('/[dance]/routines')).toMatchObject({ kind: 'moves', segment: 'routines' });
		expect(skeletonFor('/[dance]/positions')).toMatchObject({
			kind: 'moves',
			segment: 'positions'
		});
	});

	it('gives the pages under Positions their own shapes, not the Moves band', () => {
		expect(skeletonFor('/[dance]/positions/[id]')).toMatchObject({ kind: 'detail' });
		expect(skeletonFor('/[dance]/positions/none')).toMatchObject({
			kind: 'list',
			title: 'No position'
		});
		expect(skeletonFor('/[dance]/positions/map')).toMatchObject({ kind: 'detail' });
	});

	it('titles a list with the name its page will show', () => {
		expect(skeletonFor('/[dance]/coverage')).toMatchObject({ kind: 'list', title: 'Coverage' });
		expect(skeletonFor('/settings')).toMatchObject({ kind: 'list', title: 'Settings' });
		expect(skeletonFor('/voice')).toMatchObject({ kind: 'list', title: 'My count' });
	});

	it('gives every page behind an id the detail shape', () => {
		for (const id of ['lessons', 'songs', 'exercises']) {
			expect(skeletonFor(`/[dance]/${id}/[id]`)).toMatchObject({ kind: 'detail' });
		}
		expect(skeletonFor('/[dance]/player')).toMatchObject({ kind: 'detail' });
	});

	it('gives a figure its own shape', () => {
		expect(skeletonFor('/[dance]/figures/[id]')).toMatchObject({ kind: 'figure' });
	});

	it('gives a routine its own shape', () => {
		expect(skeletonFor('/[dance]/routines/[id]')).toMatchObject({ kind: 'routine' });
	});

	it('leaves pages outside the shell, the redirect and unknown routes to the bar alone', () => {
		for (const id of ['/login', '/device/pair', '/share', '/', null, undefined]) {
			expect(skeletonFor(id)).toBeNull();
		}
	});
});

describe('a list and its pane', () => {
	it('says whether the target is a list and pane, and whether an item opens in it', () => {
		expect(skeletonFor('/[dance]/songs/[id]')).toMatchObject({
			kind: 'detail',
			pane: true,
			open: true
		});
		expect(skeletonFor('/[dance]/songs')).toMatchObject({ kind: 'list', pane: true, open: false });
		expect(skeletonFor('/settings')!.pane).toBe(false);
		expect(skeletonFor('/[dance]')!.pane).toBe(false);
		expect(skeletonFor('/[dance]/lessons/[id]')!.pane).toBe(false);
	});

	it('names the band row title of a list and pane', () => {
		expect(skeletonFor('/[dance]/songs/[id]')!.deskTitle).toBe('Music');
		expect(skeletonFor('/[dance]/figures/[id]')!.deskTitle).toBeNull();
	});
});

describe('deskSkeletonMode', () => {
	it('draws the whole frame coming from outside a list and pane', () => {
		expect(deskSkeletonMode('/[dance]/songs/[id]', '/[dance]')).toBe('frame');
		expect(deskSkeletonMode('/[dance]/songs', null)).toBe('frame');
		expect(deskSkeletonMode('/settings', '/[dance]/songs')).toBe('frame');
	});

	it('keeps the list column live from one item to another: the pane alone', () => {
		expect(deskSkeletonMode('/[dance]/songs/[id]', '/[dance]/songs/[id]')).toBe('pane');
		expect(deskSkeletonMode('/[dance]/songs/[id]', '/[dance]/songs')).toBe('pane');
	});

	it('draws nothing on the desktop going from an item to its empty pane', () => {
		expect(deskSkeletonMode('/[dance]/songs', '/[dance]/songs/[id]')).toBe('none');
	});
});

describe('leavesPage', () => {
	it('is a new path, not a new query', () => {
		expect(leavesPage('/salsa/figures', '/salsa/figures/12')).toBe(true);
		expect(leavesPage('/salsa', '/bachata')).toBe(true);
		expect(leavesPage('/salsa/figures', '/salsa/figures')).toBe(false);
	});
});
