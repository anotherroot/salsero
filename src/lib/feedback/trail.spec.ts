import { describe, expect, it } from 'vitest';
import { ERROR_CHARS, errorLine, pageBefore, pushed } from './trail';

describe('the trail', () => {
	it('keeps the last few, without a repeat of the last', () => {
		expect(pushed(['/a'], '/b', 3)).toEqual(['/a', '/b']);
		expect(pushed(['/a', '/b'], '/b', 3)).toEqual(['/a', '/b']);
		expect(pushed(['/a', '/b', '/c'], '/d', 3)).toEqual(['/b', '/c', '/d']);
		// A page opened again later is a new step.
		expect(pushed(['/a', '/b'], '/a', 3)).toEqual(['/a', '/b', '/a']);
	});

	it('means the page before the one they write from', () => {
		expect(pageBefore([])).toBeNull();
		expect(pageBefore(['/salsa/groups'])).toBe('/salsa/groups');
		expect(pageBefore(['/salsa', '/salsa/moves/3', '/salsa/groups'])).toBe('/salsa/moves/3');
	});

	it('cuts an error to one short line', () => {
		expect(errorLine(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
		expect(errorLine('Script error.')).toBe('Script error.');
		const long = errorLine('e'.repeat(1000));
		expect(long).toHaveLength(ERROR_CHARS);
		expect(long.endsWith('…')).toBe(true);
	});
});
