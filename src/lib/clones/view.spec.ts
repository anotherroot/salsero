import { describe, expect, it } from 'vitest';
import type { FieldDiff, SwitchReport } from '$lib/types';
import {
	DROP_BUTTON,
	DROP_FAILED,
	DROP_TITLE,
	SEND_FIRST,
	USE_INSTEAD,
	addToo,
	cantFollow,
	copiedHere,
	dropChoiceMeta,
	dropOne,
	dropSub,
	droppedToast,
	onlyInYours,
	FAMILY_TITLE,
	NEXT,
	NOTHING_TO_SEND,
	SEND,
	SEND_FAILED,
	SEND_MINE,
	SEND_SUB,
	SEND_TITLE,
	THIS_ONE,
	bothNote,
	bothTitle,
	deleteRow,
	differsBanner,
	memberMeta,
	notSent,
	ownChanges,
	selfMeta,
	sendButton,
	sendNote,
	sendTargetMeta,
	statusChip,
	ALREADY_IN_YOURS,
	CANCEL,
	COMPARE_FAILED,
	IN_STEP,
	TAKE_FAILED,
	THEIRS,
	YOURS,
	optionShow,
	COMPARE,
	NOT_TAKEN,
	PICK_BOTH,
	RECORDING_GONE,
	STALE,
	TAKE_BUTTON,
	VERSIONS,
	absentLine,
	changedLine,
	compareSub,
	compareTitle,
	diffTag,
	nameTaken,
	ARCHIVED_SONG_COPY,
	MAKE_MINE,
	MAKE_MINE_SUB,
	makeMineTitle,
	restoreLine,
	staysTheirs,
	switchNote,
	youGet,
	fromLessonNote,
	groupSlotNote,
	groupSlotNotes,
	moveHeading,
	possessive,
	usedAsIs,
	changedLabels,
	cloneSubtitle,
	makeMineSize,
	recordingMeta,
	sourceNote,
	TAKE
} from './view';

describe('clone words', () => {
	it('possessive: a final s takes only the apostrophe', () => {
		expect(possessive('Salsa Tuesdays')).toBe('Salsa Tuesdays’');
		expect(possessive('Rueda club')).toBe('Rueda club’s');
	});
	it('usedAsIs', () => {
		expect(usedAsIs('Salsa Tuesdays')).toBe('Salsa Tuesdays’ · used as it is');
	});
	it("moveHeading: a group's move is labelled with the group", () => {
		expect(moveHeading('Enchufla')).toBe('Enchufla');
		expect(moveHeading('Enchufla', { name: 'Salsa Tuesdays' })).toBe('Enchufla · Salsa Tuesdays');
	});
	it('fromLessonNote', () => {
		expect(fromLessonNote('Week 6', 'Salsa Tuesdays')).toBe(
			'From Week 6. Use it in your routines as it is; it stays Salsa Tuesdays’.'
		);
	});
	it('groupSlotNote: one figure is, several are', () => {
		expect(groupSlotNote(['Setenta'], 'Salsa Tuesdays')).toBe(
			'Setenta is Salsa Tuesdays’. If you leave the group, you keep a copy and this routine keeps working.'
		);
		expect(groupSlotNote(['Setenta', 'Enchufla'], 'Rueda club')).toBe(
			'Setenta and Enchufla are Rueda club’s. If you leave the group, you keep a copy and this routine keeps working.'
		);
	});
	it('groupSlotNotes: one note per group, each move once', () => {
		const g = {
			1: { team: 'Salsa Tuesdays', name: 'Setenta' },
			2: { team: 'Salsa Tuesdays', name: 'Setenta' },
			3: { team: 'Rueda club', name: 'Sombrero' }
		};
		expect(groupSlotNotes(g, [[1, 9], [2], [3]])).toEqual([
			groupSlotNote(['Setenta'], 'Salsa Tuesdays'),
			groupSlotNote(['Sombrero'], 'Rueda club')
		]);
		expect(groupSlotNotes(g, [[9]])).toEqual([]);
	});
});

describe('Make it mine', () => {
	const report = (
		routines: string[],
		entries = 0,
		extra: Partial<SwitchReport> = {}
	): SwitchReport => ({
		routines: routines.map((name, i) => ({ id: i + 1, name })),
		lessons: [],
		sections: 0,
		entries,
		...extra
	});

	it('the title and the line under it', () => {
		expect(makeMineTitle('Setenta · Básico')).toBe('Make Setenta · Básico yours?');
		expect(MAKE_MINE_SUB).toBe('Editing makes your own copy. The class’s stays as it is.');
		expect(MAKE_MINE).toBe('Make it mine');
		expect(restoreLine).toBe('You had your own copy. Restore it?');
	});

	it('youGet, per kind', () => {
		expect(youGet('figure')).toBe('Its name, timing, positions and notes, to change as you like.');
		expect(youGet('routine')).toBe('Its name, notes and slots, to change as you like.');
		expect(youGet('drill')).toBe('Its name, notes and practice, to change as you like.');
		expect(youGet('song')).toBe('Its title, artist and count, to change as you like.');
		expect(youGet('lesson')).toBe(
			'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.'
		);
	});

	it('staysTheirs: a figure’s recordings stay the group’s; nothing else says so', () => {
		expect(staysTheirs('figure', 'Salsa Tuesdays')).toEqual({
			title: 'STAYS SALSA TUESDAYS’',
			body: 'Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).'
		});
		expect(staysTheirs('figure', 'Rueda club')!.title).toBe('STAYS RUEDA CLUB’S');
		for (const kind of ['routine', 'drill', 'song', 'lesson'] as const)
			expect(staysTheirs(kind, 'Salsa Tuesdays')).toBeNull();
	});

	it('switchNote: the board’s line, and its variants', () => {
		expect(switchNote(report(['Week 4 loop'], 1), true)).toBe(
			'Your routine Week 4 loop and your practice of it switch to your copy.'
		);
		expect(switchNote(report(['Week 4 loop']), false)).toBe(
			'Your routine Week 4 loop switches to your copy.'
		);
		expect(switchNote(report(['Week 4 loop', 'Shines']), false)).toBe(
			'Your routines Week 4 loop and Shines switch to your copy.'
		);
		expect(switchNote(report(['Week 4 loop', 'Shines', 'Ending']), false)).toBe(
			'Your routines Week 4 loop, Shines and Ending switch to your copy.'
		);
		expect(switchNote(report(['Week 4 loop', 'Shines'], 1), true)).toBe(
			'Your routines Week 4 loop and Shines, and your practice of it, switch to your copy.'
		);
		expect(switchNote(report([], 1), true)).toBe('Your practice of it switches to your copy.');
		expect(switchNote(report([]), false)).toBeNull();
	});

	it('switchNote: lessons and sections that move are named too', () => {
		const lessons = [{ id: 4, title: 'Week 6' }];
		expect(switchNote(report([], 0, { lessons }), false)).toBe(
			'Your lesson Week 6 switches to your copy.'
		);
		expect(switchNote(report(['Week 4 loop'], 0, { lessons }), false)).toBe(
			'Your routine Week 4 loop and your lesson Week 6 switch to your copy.'
		);
		expect(switchNote(report([], 0, { sections: 2 }), false)).toBe(
			'2 of your sections switch to your copy.'
		);
		expect(switchNote(report([], 0, { sections: 1 }), true)).toBe(
			'Your section and your practice of it switch to your copy.'
		);
	});

	it('the archived song copy’s refusal', () => {
		expect(ARCHIVED_SONG_COPY).toBe(
			'Your copy of this song is archived. Delete it in Settings → What uses space to make it yours again.'
		);
	});
});

describe('sources', () => {
	const team = { kind: 'team' as const, teamId: 1, name: 'Salsa Tuesdays' };
	const mine = { kind: 'mine' as const };
	const none = { clonedFrom: null, groups: 0, twins: 0 };

	it('cloneSubtitle: a copy, a group’s, yours in groups, twins (boards C2, C3, C7)', () => {
		expect(
			cloneSubtitle({ ...none, self: mine, clonedFrom: 'Salsa Tuesdays', kind: 'figure' })
		).toBe('Your copy · from Salsa Tuesdays');
		expect(cloneSubtitle({ ...none, self: team, kind: 'figure' })).toBe('Salsa Tuesdays’ figure');
		expect(cloneSubtitle({ ...none, self: team, kind: 'routine' })).toBe('Salsa Tuesdays’ routine');
		expect(cloneSubtitle({ ...none, self: { ...team, name: 'Rueda club' }, kind: 'lesson' })).toBe(
			'Rueda club’s lesson'
		);
		expect(cloneSubtitle({ ...none, self: mine, groups: 2, kind: 'figure' })).toBe(
			'Yours · in 2 groups'
		);
		expect(cloneSubtitle({ ...none, self: mine, groups: 1, kind: 'drill' })).toBe(
			'Yours · in 1 group'
		);
		expect(cloneSubtitle({ ...none, self: mine, twins: 2, kind: 'figure' })).toBe(
			'Twins · 3 versions'
		);
		expect(cloneSubtitle({ ...none, self: mine, kind: 'song' })).toBeNull();
	});

	it('changedLabels: fields by name, pieces counted', () => {
		const d = (key: string, label: string) => ({ key, label });
		expect(changedLabels([d('timing', 'Timing'), d('rec:g1', 'Recording · Ana, 3 Nov')])).toEqual([
			'Timing',
			'1 recording'
		]);
		expect(
			changedLabels([
				d('notes', 'Notes'),
				d('rec:g1', 'Recording · a'),
				d('rec:g2:note', 'Note · b'),
				d('rec:g3:spot:s1', 'Section · 0:01'),
				d('rec:g3:spot:s2:links', 'Section links · 0:05'),
				d('video:v1', 'Video · c'),
				d('link:https://x.si', 'Link · https://x.si'),
				d('fig:g9', 'Figure · Enchufla')
			])
		).toEqual(['Notes', '2 recordings', '1 video', '2 sections', '1 link', '1 figure']);
		expect(changedLabels([])).toEqual([]);
	});

	it('the source’s tab: its note, and each recording’s line', () => {
		expect(sourceNote('Salsa Tuesdays')).toBe(
			'Salsa Tuesdays’ version, read-only. Take what you want into yours.'
		);
		expect(recordingMeta(true, '12 MB')).toBe('12 MB · already in yours');
		expect(recordingMeta(false, '12 MB')).toBe('New · 12 MB');
		expect(TAKE).toBe('Take');
	});

	it('makeMineSize: what the copy uses of the person’s space', () => {
		expect(makeMineSize(380 * 1024 * 1024)).toBe('Uses 380 MB of your space');
		expect(makeMineSize(0)).toBeNull();
	});

	it('changedLine: the banner over your copy, names lowered', () => {
		expect(changedLine('Salsa Tuesdays', ['Timing', '1 recording'])).toBe(
			'Salsa Tuesdays changed it since you took it: timing, 1 recording'
		);
		expect(changedLine('Rueda club', ['Notes'])).toBe(
			'Rueda club changed it since you took it: notes'
		);
		expect(COMPARE).toBe('Compare');
	});

	it('the compare sheet: title, sub, button', () => {
		expect(compareTitle('Salsa Tuesdays')).toBe('Compare with Salsa Tuesdays’');
		expect(compareTitle('Rueda club')).toBe('Compare with Rueda club’s');
		expect(compareTitle('Yours')).toBe('Compare with yours');
		expect(compareSub(true)).toBe(
			'Since you last took from it. Pick where both of you changed something.'
		);
		expect(compareSub(false)).toBe('You were never in step with this one. Pick each difference.');
		expect(TAKE_BUTTON).toBe('Take what’s picked');
	});

	it('diffTag: who changed it, and what', () => {
		const field = { key: 'k', label: 'L', value: 'v', show: 'v' };
		const d = (side: FieldDiff['side'], mine: boolean, theirs: boolean): FieldDiff => ({
			key: 'k',
			label: 'L',
			mine: mine ? field : null,
			theirs: theirs ? field : null,
			side,
			removal: false
		});
		expect(diffTag(d('theirs', true, true))).toBe('Only theirs changed');
		expect(diffTag(d('theirs', false, true))).toBe('New on theirs');
		expect(diffTag(d('theirs', true, false))).toBe('Gone from theirs');
		expect(diffTag(d('mine', true, true))).toBe('Only yours changed');
		expect(diffTag(d('both', true, true))).toBe('Both changed: pick');
		expect(diffTag(d('both', false, true))).toBe('Both changed: pick');
	});

	it('an option that is not there, and the refusals', () => {
		expect(absentLine('mine')).toBe('Not in yours');
		expect(absentLine('theirs')).toBe('Not in theirs');
		expect(STALE).toBe('Changed since you opened this. Compare again.');
		expect(PICK_BOTH).toBe('Pick yours or theirs where both changed.');
		expect(nameTaken('Doble', 'Enchufla')).toBe('Doble is taken in Enchufla; rename one first.');
	});

	it('the source tab’s words: Take refused, the switcher', () => {
		expect(ALREADY_IN_YOURS).toBe('It is already in yours.');
		expect(RECORDING_GONE).toBe('That recording is gone.');
		expect(NOT_TAKEN).toBe('Not taken');
		expect(VERSIONS).toBe('Versions');
	});
});

describe('the compare sheet’s options and states', () => {
	it('shows a field’s words, (empty), or that its side lacks it', () => {
		expect(optionShow({ show: '1 · 16 counts' }, 'mine')).toBe('1 · 16 counts');
		expect(optionShow({ show: '' }, 'theirs')).toBe('(empty)');
		expect(optionShow(null, 'mine')).toBe('Not in yours');
		expect(optionShow(null, 'theirs')).toBe('Not in theirs');
		expect([YOURS, THEIRS]).toEqual(['Yours', 'Theirs']);
		expect(IN_STEP).toBe('Nothing differs any more.');
		expect(COMPARE_FAILED).toBe('That comparison could not be loaded. Try again.');
		expect(TAKE_FAILED).toBe('That could not be taken. Try again.');
	});
});

describe('the compare sheet’s Cancel', () => {
	it('is the kit’s word', () => {
		expect(CANCEL).toBe('Cancel');
	});
});

describe('copies you can see, and Send mine (board C3)', () => {
	const fd = (
		key: string,
		label: string,
		side: FieldDiff['side'],
		mine: string | null,
		theirs: string | null,
		removal = false
	): FieldDiff => ({
		key,
		label,
		side,
		removal,
		mine: mine === null ? null : { key, label, value: mine, show: mine },
		theirs: theirs === null ? null : { key, label, value: theirs, show: theirs }
	});

	it('a copy’s chip and meta, and the page’s own line', () => {
		expect(statusChip('behind')).toEqual({ text: 'Behind', tone: 'neutral' });
		expect(statusChip('newer')).toEqual({ text: 'Newer', tone: 'accent' });
		expect(statusChip('differs')).toEqual({ text: 'Differs', tone: 'warn' });
		expect(statusChip('same')).toBeNull();
		expect(statusChip(null)).toBeNull();
		expect(memberMeta('owner', 'behind', ['Notes', '1 recording'])).toBe(
			'Owner · behind yours: notes, 1 recording'
		);
		expect(memberMeta('editor', 'differs', ['Timing', 'Notes'])).toBe('Editor · differs both ways');
		expect(memberMeta('editor', 'newer', ['Timing'])).toBe('Editor · newer than yours: timing');
		expect(memberMeta('member', 'same', [])).toBe('Member · in step');
		expect(memberMeta(null, 'behind', ['Notes'], 'this one')).toBe('Behind this one: notes');
		expect(selfMeta(['Notes', '+1 recording'])).toBe('This one · you changed notes, +1 recording');
		expect(selfMeta([])).toBe('This one');
		expect([FAMILY_TITLE, SEND_MINE, THIS_ONE]).toEqual([
			'Copies you can see',
			'Send mine…',
			'This one'
		]);
	});

	it('what the page changed: fields, then what it added (+) and took away (−)', () => {
		expect(
			ownChanges([
				fd('notes', 'Notes', 'mine', 'a', 'b'),
				fd('rec:g1', 'Recording · new', 'mine', 'v', null),
				fd('rec:g2', 'Recording · old', 'mine', null, 'v', true),
				fd('rec:g3:note', 'Note · x', 'mine', 'x', 'y')
			])
		).toEqual(['Notes', '+1 recording', '−1 recording', '1 recording']);
	});

	it('the banner names the place (ruling 10)', () => {
		expect(differsBanner('Rueda club', ['Timing'])).toBe('Rueda club’s copy differs: timing');
		expect(differsBanner('Yours', ['Notes', '1 recording'])).toBe(
			'Your copy differs: notes, 1 recording'
		);
	});

	it('the send sheet’s words', () => {
		expect(SEND_TITLE).toBe('Send your changes');
		expect(SEND_SUB).toBe('Adds and changes travel. Deletes only if you tick them.');
		const lands = [
			fd('notes', 'Notes', 'theirs', 'a', 'b'),
			fd('rec:g1', 'Recording · new', 'theirs', null, 'v')
		];
		expect(sendTargetMeta(lands, 50, true)).toBe('Notes · 1 new recording (charged to the group)');
		expect(sendTargetMeta(lands, 50, false)).toBe('Notes · 1 new recording (charged to you)');
		expect(sendTargetMeta(lands, 0, true)).toBe('Notes · 1 new recording');
		expect(sendTargetMeta([...lands, fd('timing', 'Timing', 'both', '1', '3')], 50, true)).toBe(
			'Notes · 1 new recording (charged to the group) · timing: they changed it too, you’ll pick'
		);
		// Only the target's own changes, a removal, or a name: nothing goes by default.
		expect(
			sendTargetMeta(
				[
					fd('timing', 'Timing', 'mine', '3', '1'),
					fd('rec:g2', 'Recording · old', 'theirs', 'v', null, true),
					fd('name', 'Name', 'theirs', 'Doble (Salsa Tuesdays)', 'Doble')
				],
				0,
				true
			)
		).toBe(NOTHING_TO_SEND);
		expect(NOTHING_TO_SEND).toBe('Nothing to send');
		expect(deleteRow('old take')).toEqual({
			text: 'Also delete “old take” there',
			meta: 'Gone from the copy you’re sending. Refused where a lesson links its section.'
		});
		expect(sendNote('figure', 2)).toBe(
			'Changes land on the groups’ own figure: members’ practice and lesson links stay.'
		);
		expect(sendNote('routine', 1)).toBe(
			'Changes land on the group’s own routine: members’ practice and lesson links stay.'
		);
		expect(sendNote('figure', 0)).toBeNull();
		expect(sendButton(2, 'Rueda club')).toBe('Send to 2 groups');
		expect(sendButton(1, 'Salsa Tuesdays')).toBe('Send to Salsa Tuesdays');
		expect(sendButton(1, 'Yours')).toBe('Send to yours');
		expect(sendButton(2, 'Yours', false)).toBe('Send to 2 places');
		expect(sendButton(0, '')).toBe('Send');
	});

	it('the second level: both changed, per target', () => {
		expect(bothTitle('Rueda club', ['Timing'])).toBe('Rueda club: both changed the timing');
		expect(bothTitle('Rueda club', ['Timing', 'Notes'])).toBe(
			'Rueda club: both changed the timing and notes'
		);
		expect(bothNote('Rueda club')).toBe(
			'Pick yours and theirs is replaced in Rueda club. Pick theirs and you send only the rest.'
		);
		expect([SEND, NEXT]).toEqual(['Send', 'Next']);
		expect(notSent('Salsa Tuesdays', 'Linked to Shines — unlink it first.')).toBe(
			'Not sent to Salsa Tuesdays: Linked to Shines — unlink it first.'
		);
		expect(SEND_FAILED).toBe('That could not be sent. Try again.');
	});
});

describe('Drop my copy (board C5)', () => {
	it('the sheet’s title and line, by what the person goes back to', () => {
		expect(DROP_TITLE).toBe('Drop your copy?');
		expect(dropSub('read')).toBe(
			'You go back to the class’s version, read-only. Your copy is archived.'
		);
		expect(dropSub('edit')).toBe(
			'You go back to the group’s version, which you edit. Your copy is archived.'
		);
		expect(dropSub(null)).toBe('You go back to the version you pick. Your copy is archived.');
	});

	it('one choice: names the version, and says when practice cannot follow', () => {
		expect(dropOne('Salsa Tuesdays', 'Setenta · Básico')).toBe(
			'Your routines and practice will use Salsa Tuesdays’ Setenta · Básico.'
		);
		expect(dropOne('Rueda club', 'Setenta · Básico', false)).toBe(
			'Your routines will use Rueda club’s Setenta · Básico.'
		);
	});

	it('what only yours has: it goes with your copy, or you edit the place', () => {
		expect(onlyInYours(['Notes', '1 recording'])).toBe(
			'Only in yours: your notes and 1 recording. They go with your copy.'
		);
		expect(onlyInYours(['Notes'], 'Salsa Tuesdays')).toBe(
			'Only in yours: your notes. You edit Salsa Tuesdays.'
		);
		expect(onlyInYours(['Notes', 'Timing', '2 recordings'])).toBe(
			'Only in yours: your notes, timing and 2 recordings. They go with your copy.'
		);
		expect(onlyInYours(['1 recording'])).toBe(
			'Only in yours: 1 recording. They go with your copy.'
		);
		expect(onlyInYours([])).toBeNull();
	});

	it('several choices: the radios’ lines', () => {
		expect(USE_INSTEAD).toBe('Use instead');
		expect(copiedHere).toBe('You copied it from here');
		expect(cantFollow('Week 2')).toBe(
			'Not in a lesson you added: your practice can’t follow · Add Week 2 too'
		);
		expect(cantFollow(null)).toBe('Not in a lesson you added: your practice can’t follow');
		expect(addToo('Week 2')).toBe('Add Week 2 too');
		const from = { clonedFrom: true, practiceFollows: true, addLesson: null };
		const off = {
			clonedFrom: false,
			practiceFollows: false,
			addLesson: { id: 9, title: 'Week 2' }
		};
		expect(dropChoiceMeta(from, false)).toBe('You copied it from here');
		expect(dropChoiceMeta(off, false)).toBe(
			'Not in a lesson you added: your practice can’t follow · Add Week 2 too'
		);
		// With the box under it, the box says Add.
		expect(dropChoiceMeta(off, true)).toBe('Not in a lesson you added: your practice can’t follow');
		expect(dropChoiceMeta({ ...from, practiceFollows: false }, false)).toBe(
			'You copied it from here · Not in a lesson you added: your practice can’t follow'
		);
		expect(dropChoiceMeta({ ...from, clonedFrom: false }, false)).toBeNull();
	});

	it('a lesson or a song can only miss practice as a draft: no lesson to add', () => {
		const line = 'Not published yet: your practice stays with your copy.';
		expect(cantFollow(null, 'lesson')).toBe(line);
		expect(cantFollow('Week 2', 'song')).toBe(line);
		expect(cantFollow(null, 'routine')).toBe(
			'Not in a lesson you added: your practice can’t follow'
		);
		const draft = { clonedFrom: true, practiceFollows: false, addLesson: null };
		expect(dropChoiceMeta(draft, false, 'lesson')).toBe(`You copied it from here · ${line}`);
	});

	it('the buttons and the toast', () => {
		expect([DROP_BUTTON, SEND_FIRST]).toEqual(['Drop my copy', 'Send mine first']);
		expect(droppedToast('Salsa Tuesdays')).toBe('Back on Salsa Tuesdays’. Your copy is archived.');
		expect(droppedToast('Rueda club')).toBe('Back on Rueda club’s. Your copy is archived.');
		expect(DROP_FAILED).toBe('That could not be dropped. Try again.');
	});
});
