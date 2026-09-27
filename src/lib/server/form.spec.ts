import { describe, expect, it } from 'vitest';
import { int, ints } from './form';

describe('int', () => {
	it('parses a good integer', () => {
		const form = new FormData();
		form.set('id', '42');
		expect(int(form, 'id')).toBe(42);
	});

	it('is undefined for an empty string', () => {
		const form = new FormData();
		form.set('id', '');
		expect(int(form, 'id')).toBeUndefined();
	});

	it('is undefined for a missing key', () => {
		const form = new FormData();
		expect(int(form, 'id')).toBeUndefined();
	});

	it('is undefined for a non-integer', () => {
		const form = new FormData();
		form.set('id', '4.5');
		expect(int(form, 'id')).toBeUndefined();
	});

	it('is undefined for a whitespace-only value', () => {
		// `Number(' ')` is also 0, so this is the same hole as the empty string and
		// the fix trims for exactly this reason.
		const form = new FormData();
		form.set('id', '   ');
		expect(int(form, 'id')).toBeUndefined();
	});
});

describe('ints', () => {
	it('parses and de-duplicates', () => {
		const form = new FormData();
		form.append('p', '3');
		form.append('p', '7');
		form.append('p', '3');
		expect(ints(form, 'p')).toEqual([3, 7]);
	});

	it('drops an empty entry rather than keeping it as the id 0', () => {
		// `Number('')` is 0 and passes `Number.isInteger`, so without an explicit
		// guard this function would return [5, 0] and contradict its own contract.
		// Id 0 matches no row — SQLite AUTOINCREMENT starts at 1 — so downstream it
		// fails closed rather than writing something wrong, but returning it at all
		// is the bug.
		const form = new FormData();
		form.append('p', '5');
		form.append('p', '');
		expect(ints(form, 'p')).toEqual([5]);
	});

	it('drops an unparseable entry', () => {
		const form = new FormData();
		form.append('p', '5');
		form.append('p', 'nope');
		expect(ints(form, 'p')).toEqual([5]);
	});
});
