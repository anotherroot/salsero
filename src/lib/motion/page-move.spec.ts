import { describe, expect, it } from 'vitest';
import { drawnEdge, heldEdge, moveKind, shapeOf, visibleEdge } from './page-move';

describe('visibleEdge', () => {
	it('is the card top while it shows below the slim band', () =>
		expect(visibleEdge(172, 64)).toEqual({ y: 172, square: false }));
	it('is the slim band foot, square, when the card runs on under it', () =>
		expect(visibleEdge(-40, 64)).toEqual({ y: 64, square: true }));
	it('with no slim band shown, is the card top', () =>
		expect(visibleEdge(131, null)).toEqual({ y: 131, square: false }));
});

describe('heldEdge', () => {
	it('lifts 70 px', () => expect(heldEdge(172, 64)).toBe(102));
	it('never above the slim band foot', () => expect(heldEdge(131, 64)).toBe(64));
	it('already at the slim band: stays', () => expect(heldEdge(64, 64)).toBe(64));
	it('never below where it is', () => expect(heldEdge(50, 64)).toBe(50));
});

describe('shapeOf', () => {
	it('Practice and the positions map are full screen', () => {
		expect(shapeOf('/[dance]/player')).toBe('screen');
		expect(shapeOf('/[dance]/(moves)/positions/map')).toBe('screen');
	});
	it('sign-in and welcome pages are frames; an unknown route too', () => {
		expect(shapeOf('/login')).toBe('frame');
		expect(shapeOf('/welcome/start')).toBe('frame');
		expect(shapeOf(null)).toBe('frame');
	});
	it('a dance page and Settings have the card', () => {
		expect(shapeOf('/[dance]/(moves)/figures')).toBe('card');
		expect(shapeOf('/settings')).toBe('card');
	});
});

describe('moveKind', () => {
	const at = (routeId: string, path: string) => ({ routeId, path });
	const figures = at('/[dance]/(moves)/figures', '/salsa/figures');
	const move = at('/[dance]/(moves)/moves/[id]', '/salsa/moves/11');
	const phone = { desk: false, inPage: false };
	it('a new path lifts', () => expect(moveKind(figures, move, phone)).toBe('lift'));
	it('the query only: still', () =>
		expect(moveKind(figures, at(figures.routeId, '/salsa/figures'), phone)).toBe('none'));
	it('the desktop: still', () =>
		expect(moveKind(figures, move, { desk: true, inPage: false })).toBe('none'));
	it('a step inside the page: words only', () =>
		expect(moveKind(move, at(move.routeId, '/salsa/moves/12'), { desk: false, inPage: true })).toBe(
			'words'
		));
	it('to or from a frame page: still', () => {
		expect(moveKind(figures, at('/login', '/login'), phone)).toBe('none');
		expect(moveKind(at('/login', '/login'), figures, phone)).toBe('none');
	});
	it('to and from a full-screen page: lift', () => {
		expect(moveKind(figures, at('/[dance]/player', '/salsa/player'), phone)).toBe('lift');
		expect(moveKind(at('/[dance]/player', '/salsa/player'), figures, phone)).toBe('lift');
	});
});

describe('drawnEdge', () => {
	it('adds the running transform', () => expect(drawnEdge(172, -35)).toBe(137));
});
