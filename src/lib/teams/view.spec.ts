import { describe, expect, it } from 'vitest';
import { MAKE_MINE } from '$lib/clones/view';
import {
	codeAction,
	COPY_FAILED,
	codeLink,
	deletingLine,
	joinQuestion,
	lessonNotice,
	limitLine,
	groupsTabLabel,
	classSongsHeading,
	newPill,
	noAccountLine,
	peopleLine,
	PICK_GROUP,
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
		expect(deletingLine('Class', '3 Dec')).toBe('Class is being deleted on 3 Dec · Make it mine');
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

	it('says the group is being deleted, with Make it mine (ruling 12)', () => {
		const notice = lessonNotice({ name: 'Salsa nadaljevalna', deletedAt }, 'UTC')!;
		expect(notice).toEqual({
			tone: 'warning',
			text: 'Salsa nadaljevalna is being deleted on 2 Dec',
			action: MAKE_MINE
		});
		expect(`${notice.text} · ${notice.action}`).toBe(deletingLine('Salsa nadaljevalna', '2 Dec'));
	});

	it('says nothing while the group lives: someone who left never reaches the lesson', () => {
		expect(lessonNotice({ name: 'X', deletedAt: null }, 'UTC')).toBeNull();
	});
});

describe('newPill', () => {
	it('is empty for none and counts otherwise', () => {
		expect(newPill(0)).toBeNull();
		expect(newPill(1)).toBe('1 new');
		expect(newPill(12)).toBe('12 new');
	});
});

describe('groupsTabLabel', () => {
	it('mentions what is new', () => {
		expect(groupsTabLabel(false)).toBe('Groups');
		expect(groupsTabLabel(true)).toBe('Groups, new in your groups');
	});
});

describe('classSongsHeading', () => {
	it('counts the songs the group page lists', () => {
		expect(classSongsHeading(0)).toBe('Class songs');
		expect(classSongsHeading(3)).toBe('Class songs · 3');
	});
});

describe('PICK_GROUP', () => {
	it('is the empty pane’s words', () => {
		expect(PICK_GROUP).toEqual({
			title: 'Pick a group',
			body: 'Its lessons, class songs and people open here.'
		});
	});
});

describe('codeAction', () => {
	it('says Copy link on the desktop and copies, whether or not the browser can share', () => {
		expect(codeAction(true, true, false)).toEqual({ label: 'Copy link', icon: 'copy', copy: true });
		expect(codeAction(true, false, false)).toEqual({
			label: 'Copy link',
			icon: 'copy',
			copy: true
		});
		expect(codeAction(true, false, true).label).toBe('Copied');
	});
	it('shares on the phone, and copies only where it cannot share', () => {
		expect(codeAction(false, true, false)).toEqual({ label: 'Share', icon: 'share', copy: false });
		expect(codeAction(false, false, false).copy).toBe(true);
		expect(codeAction(false, false, true)).toEqual({ label: 'Copied', icon: 'share', copy: true });
	});
	it('says what to do when the copy fails', () => {
		expect(COPY_FAILED).toBe('Could not copy. The link above is selected: copy it from there.');
	});
});
