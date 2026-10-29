import { describe, expect, it } from 'vitest';
import { keyAction } from './keys';

const k = (
	key: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}
) => ({
	key,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	...mods
});

describe('keyAction', () => {
	it.each([
		[' ', 'toggle'],
		['ArrowLeft', 'back1'],
		['ArrowRight', 'fwd1'],
		[',', 'framePrev'],
		['.', 'frameNext'],
		['?', 'keys']
	] as const)('%j is %s at every level', (key, action) => {
		for (const level of ['full', 'section', 'edit'] as const) {
			expect(keyAction(k(key), level)).toBe(action);
		}
	});

	it.each([
		['m', 'full', 'mark'],
		['M', 'full', 'mark'],
		['s', 'full', 'section'],
		['S', 'full', 'section'],
		['m', 'section', null],
		['M', 'edit', null],
		['s', 'edit', null]
	] as const)('%j at %s is %s', (key, level, action) => {
		expect(keyAction(k(key), level)).toBe(action);
	});

	it.each([
		['i', 'edit', 'setStart'],
		['O', 'edit', 'setEnd'],
		['I', 'section', null],
		['o', 'full', null],
		['[', 'section', 'jumpStart'],
		[']', 'edit', 'jumpEnd'],
		['[', 'full', null],
		['l', 'edit', 'loop'],
		['L', 'full', null],
		['l', 'section', null]
	] as const)('%j at %s is %s', (key, level, action) => {
		expect(keyAction(k(key), level)).toBe(action);
	});

	it('leaves anything with a modifier to the browser', () => {
		expect(keyAction(k('s', { ctrlKey: true }), 'full')).toBeNull();
		expect(keyAction(k(' ', { metaKey: true }), 'full')).toBeNull();
		expect(keyAction(k('ArrowLeft', { altKey: true }), 'full')).toBeNull();
	});

	it('is null for any other key', () => {
		expect(keyAction(k('x'), 'full')).toBeNull();
		expect(keyAction(k('Escape'), 'edit')).toBeNull();
	});
});
