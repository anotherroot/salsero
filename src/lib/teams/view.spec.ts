import { describe, expect, it } from 'vitest';
import { deletingLine, joinQuestion, noAccountLine, peopleLine, roleLabel } from './view';

describe('group wording', () => {
	it('labels roles', () => {
		expect(roleLabel('owner')).toBe('Owner');
		expect(roleLabel('editor')).toBe('Editor');
		expect(roleLabel('member')).toBe('Member');
	});
	it('counts people', () => {
		expect(peopleLine(1)).toBe('1 person');
		expect(peopleLine(14)).toBe('14 people');
	});
	it('asks, explains and warns in the spec words', () => {
		expect(joinQuestion('Salsa nadaljevalna')).toBe('Join Salsa nadaljevalna?');
		expect(noAccountLine('Tilen')).toBe(
			'This code only adds people who already have an account. Ask Tilen for an invite.'
		);
		expect(deletingLine('Class', '3 Dec')).toBe(
			'Class is being deleted on 3 Dec · Make my own copy'
		);
	});
});
