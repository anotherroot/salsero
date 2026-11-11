import { describe, expect, it } from 'vitest';
import { faceRound } from './lift';

describe('faceRound: a card’s corners inside the piece lifting it', () => {
	it('a card of its own keeps its own', () => {
		expect(faceRound(null, false)).toBe('rounded-2xl');
	});
	it('alone in a piece: all four, or only the top ones when something follows it', () => {
		expect(faceRound('single', false)).toBe('rounded-[20px]');
		expect(faceRound('single', true)).toBe('rounded-t-[20px]');
	});
	it('a run: the header has the top corners, the last card the bottom ones unless the toolbar follows', () => {
		expect(faceRound('top', false)).toBe('rounded-none');
		expect(faceRound('mid', false)).toBe('rounded-none');
		expect(faceRound('bottom', false)).toBe('rounded-b-[20px]');
		expect(faceRound('bottom', true)).toBe('rounded-none');
	});
});
