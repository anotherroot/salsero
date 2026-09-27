import { describe, expect, it } from 'vitest';
import { int } from './form';

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
});
