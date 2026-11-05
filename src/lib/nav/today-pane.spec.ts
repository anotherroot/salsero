import { describe, expect, it } from 'vitest';
import { besideToday } from './today-pane';
import { columnOf } from './moves-pane';
import { listOf, paneBack, inList } from './pane';

const T = (s: string) => `/[dance]/(today)/${s}`;

describe('besideToday', () => {
	it('Coming up is its own list', () => {
		expect(besideToday(T('coming-up'), '/salsa/coming-up', null)).toBe('coming');
	});

	it('an exercise opened from Coming up keeps Coming up beside it', () => {
		expect(besideToday(T('exercises/[id]'), '/salsa/exercises/4', '/salsa/coming-up')).toBe(
			'coming'
		);
	});

	it('an exercise otherwise sits in Today', () => {
		expect(besideToday(T('exercises/[id]'), '/salsa/exercises/4', null)).toBeNull();
		expect(besideToday(T('exercises/[id]'), '/salsa/exercises/4', '/salsa')).toBeNull();
		expect(besideToday(T('exercises/[id]'), '/salsa/exercises/4', '/salsa/coming-upx')).toBeNull();
		expect(besideToday('/[dance]/(today)', '/salsa', null)).toBeNull();
		expect(besideToday(null, '/salsa', null)).toBeNull();
	});

	it('is the column of the route, ahead of its own list', () => {
		expect(columnOf(T('exercises/[id]'), '/salsa/exercises/4', '/salsa/coming-up')).toBe('coming');
		expect(columnOf(T('exercises/[id]'), '/salsa/exercises/4', null)).toBe('today');
		expect(columnOf(T('coming-up'), '/salsa/coming-up', null)).toBe('coming');
	});
});

describe('Coming up in pane.ts', () => {
	it('is a list route with nothing open', () => {
		expect(listOf(T('coming-up'))).toEqual({ list: 'coming', open: false });
		expect(inList('/salsa/coming-up', 'coming', 'salsa')).toBe(true);
		expect(inList('/salsa/coming-up', 'today', 'salsa')).toBe(false);
		// An exercise opened from it has no back on the desktop.
		expect(paneBack('/salsa/coming-up', 'coming', 'salsa')).toBe(false);
		expect(paneBack('/salsa/coming-up', 'today', 'salsa')).toBe(true);
	});
});
