import { describe, expect, it } from 'vitest';
import { besideOf, columnOf } from './moves-pane';

const R = (s: string) => `/[dance]/(moves)/${s}`;

describe('besideOf', () => {
	it('lists with nothing open', () => {
		expect(besideOf(R('figures'), '/salsa/figures', null)).toEqual({ list: 'figures', open: null });
		expect(besideOf(R('routines'), '/salsa/routines', null)).toEqual({
			list: 'routines',
			open: null
		});
		expect(besideOf(R('positions'), '/salsa/positions', null)).toEqual({
			list: 'positions',
			open: null
		});
	});

	it('a figure opened from a routine keeps the routines beside it', () => {
		expect(besideOf(R('figures/[id]'), '/salsa/figures/12', '/salsa/routines/5')).toEqual({
			list: 'routines',
			open: { kind: 'routine', id: 5 }
		});
	});

	it('a figure otherwise sits in the figures list', () => {
		const fig = { list: 'figures', open: { kind: 'figure', id: 12 } };
		expect(besideOf(R('figures/[id]'), '/salsa/figures/12', null)).toEqual(fig);
		expect(besideOf(R('figures/[id]'), '/salsa/figures/12', '/salsa/moves/3')).toEqual(fig);
		// a routine-shaped opener must be exactly a routine page
		expect(besideOf(R('figures/[id]'), '/salsa/figures/12', '/salsa/routines')).toEqual(fig);
	});

	it('a move and Coverage open in the figures list', () => {
		expect(besideOf(R('moves/[id]'), '/salsa/moves/3', null)).toEqual({
			list: 'figures',
			open: { kind: 'move', id: 3 }
		});
		expect(besideOf(R('coverage'), '/salsa/coverage', null)).toEqual({
			list: 'figures',
			open: { kind: 'coverage' }
		});
	});

	it('a routine opens in the routines list', () => {
		expect(besideOf(R('routines/[id]'), '/salsa/routines/9', null)).toEqual({
			list: 'routines',
			open: { kind: 'routine', id: 9 }
		});
	});

	it('the map, No position and a position', () => {
		expect(besideOf(R('positions/map'), '/salsa/positions/map', null)).toEqual({
			list: 'positions',
			open: { kind: 'map' }
		});
		expect(besideOf(R('positions/none'), '/salsa/positions/none', null)).toEqual({
			list: 'positions',
			open: { kind: 'no-position' }
		});
		expect(besideOf(R('positions/[id]'), '/salsa/positions/7', null)).toEqual({
			list: 'positions',
			open: { kind: 'position', id: 7 }
		});
	});

	it('a position opened from a figure keeps the figures beside it', () => {
		expect(besideOf(R('positions/[id]'), '/salsa/positions/7', '/salsa/figures/12')).toEqual({
			list: 'figures',
			open: { kind: 'figure', id: 12 }
		});
	});

	it('any other route has no Moves list', () => {
		expect(besideOf('/[dance]/lessons/[id]', '/salsa/lessons/1', null)).toBeNull();
		expect(besideOf('/[dance]/songs', '/salsa/songs', null)).toBeNull();
		expect(besideOf(null, '/salsa/figures', null)).toBeNull();
	});
});

describe('columnOf', () => {
	it('is the list beside the route: besideOf for Moves, the route’s own list otherwise', () => {
		expect(columnOf(R('figures/[id]'), '/salsa/figures/12', '/salsa/routines/5')).toBe('routines');
		expect(columnOf(R('figures/[id]'), '/salsa/figures/12', null)).toBe('figures');
		expect(columnOf('/[dance]/songs/[id]', '/salsa/songs/3', null)).toBe('songs');
		expect(columnOf('/[dance]/player', '/salsa/player', null)).toBeNull();
		expect(columnOf(null, '/salsa', null)).toBeNull();
	});
});
