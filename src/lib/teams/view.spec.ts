import { describe, expect, it } from 'vitest';
import {
	codeLink,
	copyItems,
	copyLine,
	deletingLine,
	joinQuestion,
	leftLine,
	lessonNotice,
	limitLine,
	MAKE_COPY,
	newPill,
	noAccountLine,
	peopleLine,
	purgeDay,
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

describe('a group lesson after leaving, or while its group is deleted', () => {
	const DAY = 24 * 60 * 60 * 1000;
	// 2 Nov 2026, 12:00 UTC.
	const deletedAt = Date.UTC(2026, 10, 2, 12);

	it('names the day the group goes, 30 days on, in the person’s zone', () => {
		expect(purgeDay(deletedAt, 'UTC')).toBe('2 Dec');
		// 23:30 UTC on 2 Nov is already 3 Nov in Ljubljana.
		expect(purgeDay(Date.UTC(2026, 10, 2, 23, 30), 'Europe/Ljubljana')).toBe('3 Dec');
		expect(purgeDay(deletedAt - DAY, 'UTC')).toBe('1 Dec');
	});

	it('says the group is being deleted, with Make my own copy, in the spec words', () => {
		const notice = lessonNotice({ name: 'Salsa nadaljevalna', deletedAt }, true, 'UTC')!;
		expect(notice).toEqual({
			tone: 'warning',
			text: 'Salsa nadaljevalna is being deleted on 2 Dec',
			action: MAKE_COPY
		});
		expect(`${notice.text} · ${notice.action}`).toBe(deletingLine('Salsa nadaljevalna', '2 Dec'));
		// A former member of a deleted group hears about the deletion.
		expect(lessonNotice({ name: 'X', deletedAt }, false, 'UTC')!.tone).toBe('warning');
	});

	it('tells a former member it is read-only', () => {
		expect(lessonNotice({ name: 'Salsa nadaljevalna', deletedAt: null }, false, 'UTC')).toEqual({
			tone: 'info',
			text: 'You left Salsa nadaljevalna · read-only',
			action: MAKE_COPY
		});
		expect(leftLine('Salsa nadaljevalna')).toBe('You left Salsa nadaljevalna · read-only');
	});

	it('says nothing to someone still in a live group', () => {
		expect(lessonNotice({ name: 'X', deletedAt: null }, true, 'UTC')).toBeNull();
	});
});

describe('make my own copy', () => {
	it('says what it costs in the spec words', () => {
		expect(copyLine(380 * 1024 * 1024)).toBe('Make my own copy · uses 380 MB of your space');
	});
	it('lists what comes, leaving out what the lesson has none of', () => {
		expect(copyItems({ bytes: 5, videos: 2, variations: 1, routines: 0, drills: 3 })).toEqual([
			'The lesson, its notes and links',
			'2 videos and their sections',
			'1 variation',
			'3 drills'
		]);
		expect(copyItems({ bytes: 0, videos: 0, variations: 0, routines: 1, drills: 0 })).toEqual([
			'The lesson, its notes and links',
			'1 routine'
		]);
	});
});

describe('newPill', () => {
	it('is empty for none and counts otherwise', () => {
		expect(newPill(0)).toBeNull();
		expect(newPill(1)).toBe('1 new');
		expect(newPill(12)).toBe('12 new');
	});
});
