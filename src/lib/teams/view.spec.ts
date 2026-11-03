import { describe, expect, it } from 'vitest';
import {
	codeLink,
	deletingLine,
	joinQuestion,
	limitLine,
	noAccountLine,
	peopleLine,
	roleLabel,
	youLine
} from './view';

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

describe('group lines', () => {
	it('says what you are', () => {
		expect(youLine('owner')).toBe('you own it');
		expect(youLine('member')).toBe('you are a member');
	});
	it('names the limit and the link', () => {
		expect(limitLine(2)).toBe('You can make 2 groups. Ask the admin for more.');
		expect(limitLine(1)).toBe('You can make 1 group. Ask the admin for more.');
		expect(codeLink('https://x.eu', 'ABC')).toBe('https://x.eu/g/ABC');
	});
});

describe('the group storage line', () => {
	it('reads Uses X of Y', async () => {
		const { groupUsesLine } = await import('./view');
		expect(groupUsesLine(120 * 1024 ** 2, 600 * 1024 ** 2)).toBe('Uses 120 MB of 600 MB');
	});
});
