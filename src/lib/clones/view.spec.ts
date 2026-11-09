import { withLocale } from '$lib/i18n/current';
import { describe, expect, it } from 'vitest';
import type { FieldDiff, SwitchReport } from '$lib/types';
import {
	alreadyThere,
	continueLabel,
	copyFailed,
	copySubGroup,
	copyTo,
	openLabel,
	restoreLabel,
	twinsOneGoes,
	whatGoesTitle,
	alreadyLine,
	copiedToast,
	copyButton,
	copySub,
	copyTitle,
	existingNote,
	placeLabel,
	placeMeta,
	twinChoiceLabel,
	twinChoiceMeta,
	whatGoes,
	whichSub,
	whichTitle,
	detachButton,
	detachMine,
	detachNoMore,
	detachGroup,
	detachTitle,
	dropButton,
	dropFailed,
	dropTitle,
	syncFirst,
	useInstead,
	addToo,
	cantFollow,
	copiedHere,
	dropChoiceMeta,
	dropOne,
	dropSub,
	droppedToast,
	onlyInYours,
	familyTitle,
	thisOne,
	memberMeta,
	ownChanges,
	selfMeta,
	statusChip,
	alreadyInYours,
	cancelLabel,
	loadFailed,
	notTaken,
	pickBoth,
	recordingGone,
	landingStale,
	syncStale,
	versionsTitle,
	nameTaken,
	archivedSongCopy,
	makeMine,
	makeMineSub,
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
	takeLabel,
	keepMine,
	moveButton,
	moveNote,
	moveSub,
	moveTo,
	practiceStays,
	useGroups,
	movedToast,
	moveTitle,
	moveWhy,
	detachFailed,
	dropGone,
	dropPlace,
	syncNoAccess,
	syncTitle,
	updateTitle,
	moveFailed,
	moveGone,
	sameAs,
	sameAsTitle,
	twinsNote,
	sameAsSearch,
	sameAsEmpty,
	markSame,
	separateLabel,
	sameAsFailed
} from './view';

describe('clone words', () => {
	it('possessive: a final s takes only the apostrophe', () => {
		expect(possessive('Salsa Tuesdays')).toBe('Salsa Tuesdays’');
		expect(possessive('Rueda club')).toBe('Rueda club’s');
		expect(possessive('CLASS')).toBe('CLASS’');
		expect(possessive('  Rueda club ')).toBe('Rueda club’s');
		expect(possessive('Salsa Tuesdays ')).toBe('Salsa Tuesdays’');
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
		figures: [],
		...extra
	});

	it('the title and the line under it', () => {
		expect(makeMineTitle('Setenta · Básico')).toBe('Make Setenta · Básico yours?');
		expect(makeMineSub()).toBe('Editing makes your own copy. The class’s stays as it is.');
		expect(makeMine()).toBe('Make it mine');
		expect(withLocale('sl', makeMine)).toBe('Naredi svojo kopijo');
		expect(restoreLine()).toBe('You had your own copy. Restore it?');
	});

	it('youGet, per kind', () => {
		expect(youGet('figure')).toBe('Its name, timing, positions and notes, to change as you like.');
		expect(youGet('routine')).toBe('Its name, notes and slots, to change as you like.');
		expect(youGet('drill')).toBe('Its name, notes and practice, to change as you like.');
		expect(youGet('song')).toBe('Its title, artist and count, to change as you like.');
		expect(youGet('lesson')).toBe(
			'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.'
		);
		expect(youGet('position')).toBe('Its name, type, hold and notes, to change as you like.');
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

	it('staysTheirs: a position’s links from the group’s lessons and videos', () => {
		expect(staysTheirs('position', 'Rueda club')).toEqual({
			title: 'STAYS RUEDA CLUB’S',
			body: 'The lessons and videos it was linked from. You see them in Rueda club’s tab.'
		});
		expect(staysTheirs('position', 'Salsa Tuesdays')!.body).toBe(
			'The lessons and videos it was linked from. You see them in Salsa Tuesdays’ tab.'
		);
	});

	it('switchNote: a position’s figures, then the rest', () => {
		const one = [{ id: 7, label: 'Setenta · Con giro' }];
		const three = [
			{ id: 7, label: 'Setenta · Con giro' },
			{ id: 8, label: 'Vuelta · Simple' },
			{ id: 9, label: 'Enchufla · Doble' }
		];
		expect(switchNote(report([], 0, { figures: one }), false)).toBe(
			'Your Setenta · Con giro, tagged with it, switches to your copy.'
		);
		expect(switchNote(report([], 0, { figures: three }), false)).toBe(
			'Your 3 figures tagged with it switch to your copy.'
		);
		const lessons = [{ id: 4, title: 'Mi clase' }];
		expect(switchNote(report([], 0, { figures: one, lessons }), false)).toBe(
			'Your Setenta · Con giro, tagged with it, and your lesson Mi clase switch to your copy.'
		);
		expect(switchNote(report([], 0, { figures: one, lessons, sections: 1 }), false)).toBe(
			'Your Setenta · Con giro, tagged with it, your lesson Mi clase and your section switch to your copy.'
		);
		const two = [...lessons, { id: 5, title: 'Week 6' }];
		expect(switchNote(report([], 0, { figures: one, lessons: two }), false)).toBe(
			'Your Setenta · Con giro, tagged with it, and your lessons Mi clase and Week 6, switch to your copy.'
		);
		expect(switchNote(report([], 0, { figures: three, lessons }), false)).toBe(
			'Your 3 figures tagged with it and your lesson Mi clase switch to your copy.'
		);
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
		expect(archivedSongCopy()).toBe(
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
		// A figure's positions are counted by side, a lesson's hand-linked ones as positions.
		expect(
			changedLabels([
				d('start:g1', 'Starts in · Cerrada'),
				d('end:g1', 'Ends in · Cerrada'),
				d('end:#4', 'Ends in · Sombra'),
				d('pos:g2', 'Position · Setenta')
			])
		).toEqual(['1 start position', '2 end positions', '1 position']);
		expect(changedLabels([])).toEqual([]);
	});

	it('the source’s tab: its note, and each recording’s line', () => {
		expect(sourceNote('Salsa Tuesdays')).toBe(
			'Salsa Tuesdays’ version, read-only. Take what you want into yours.'
		);
		expect(recordingMeta(true, '12 MB')).toBe('12 MB · already in yours');
		expect(recordingMeta(false, '12 MB')).toBe('New · 12 MB');
		expect(takeLabel()).toBe('Take');
	});

	it('makeMineSize: what the copy uses of the person’s space', () => {
		expect(makeMineSize(380 * 1024 * 1024)).toBe('Uses 380 MB of your space');
		expect(makeMineSize(0)).toBeNull();
	});

	it('the refusals', () => {
		expect(loadFailed()).toBe('That could not be loaded. Try again.');
		expect(landingStale()).toBe('Changed meanwhile; check it again.');
		expect(syncStale()).toBe('Changed while you were syncing; check it again.');
		expect(pickBoth()).toBe('Pick yours or theirs where both changed.');
		expect(nameTaken('Doble', 'Enchufla')).toBe('Doble is taken in Enchufla; rename one first.');
	});

	it('the source tab’s words: Take refused, the switcher', () => {
		expect(alreadyInYours()).toBe('It is already in yours.');
		expect(recordingGone()).toBe('That recording is gone.');
		expect(notTaken()).toBe('Not taken');
		expect(versionsTitle()).toBe('Versions');
	});
});

describe('the sheets’ Cancel', () => {
	it('is the kit’s word', () => {
		expect(cancelLabel()).toBe('Cancel');
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
		expect([familyTitle(), thisOne()]).toEqual(['Copies you can see', 'This one']);
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
});

describe('Drop my copy (board C5)', () => {
	it('the sheet’s title and line, by what the person goes back to', () => {
		expect(dropTitle()).toBe('Drop your copy?');
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
		expect(useInstead()).toBe('Use instead');
		expect(copiedHere()).toBe('You copied it from here');
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
		expect([dropButton(), syncFirst()]).toEqual(['Drop my copy', 'Sync first']);
		expect(droppedToast('Salsa Tuesdays')).toBe('Back on Salsa Tuesdays’. Your copy is archived.');
		expect(droppedToast('Rueda club')).toBe('Back on Rueda club’s. Your copy is archived.');
		expect(dropFailed()).toBe('That could not be dropped. Try again.');
	});
});

describe('Detach and reconnecting (board C8)', () => {
	it('the sheet', () => {
		expect(detachTitle('Salsa Tuesdays')).toBe('Stop following Salsa Tuesdays?');
		// A group's row follows nobody: its copies are the others' (Task 28's review).
		expect(detachTitle('Rueda club', true)).toBe('Detach from its copies?');
		expect(detachGroup('figure')).toBe(
			'In a group, Detach just makes it an ordinary group figure.'
		);
		expect(detachGroup('routine')).toBe(
			'In a group, Detach just makes it an ordinary group routine.'
		);
		expect(detachMine()).toBe(
			'Your copy stays yours, as it is. It stays shown together with theirs, as twins.'
		);
		expect(detachNoMore()).toBe('No more “updated since”, and no Take theirs to hit by mistake.');
		expect(detachButton()).toBe('Detach');
	});
});

describe('Copy to… (board C4)', () => {
	const T1 = { kind: 'team' as const, teamId: 1, name: 'Salsa Tuesdays' };
	const MINE = { kind: 'mine' as const };
	const MB = 1024 ** 2;
	const GB = 1024 ** 3;
	const none = {
		figures: 0,
		positions: 0,
		routines: 0,
		drills: 0,
		recordings: 0,
		videos: 0,
		audio: false
	};

	it('the sheet’s title, sub and places', () => {
		expect(copyTo()).toBe('Copy to…');
		expect(copyTitle('Week 3')).toBe('Copy Week 3 to…');
		expect(copySubGroup()).toBe('The group gets a draft. You keep yours.');
		expect(copySub('lesson', T1, true)).toBe(copySubGroup());
		expect(copySub('song', T1, true)).toBe(copySubGroup());
		expect(copySub('figure', T1, true)).toBe('The group gets a copy. You keep yours.');
		expect(copySub('lesson', T1, false)).toBe('The group gets a draft. This one stays as it is.');
		expect(copySub('routine', T1, false)).toBe('The group gets a copy. This one stays as it is.');
		expect(copySub('figure', MINE, false)).toBe('You get your own copy. This one stays as it is.');
		expect(placeLabel(T1)).toBe('Salsa Tuesdays');
		expect(placeLabel(MINE)).toBe('Your app');
		expect(placeMeta('owner', 412 * MB, GB)).toBe('Owner · 412 MB of 1 GB used');
		expect(placeMeta('editor', 80 * MB, GB)).toBe('Editor · 80 MB of 1 GB used');
		expect(placeMeta(null, 1.5 * GB, 2 * GB)).toBe('1.5 GB of 2 GB used');
		expect(placeMeta(null, 3 * MB, null)).toBe('3 MB used');
		// Catches: a Slovenian whole gigabyte left as 1,0 GB (its decimal comma).
		expect(withLocale('sl', () => placeMeta(null, 1.5 * GB, 2 * GB))).not.toContain('2,0 GB');
	});

	it('what goes', () => {
		expect(whatGoesTitle()).toBe('WHAT GOES');
		const lesson = { ...none, kind: 'lesson' as const, figures: 3, videos: 2 };
		expect(whatGoes({ ...lesson, bytes: 420 * MB, notes: true, into: T1 })).toBe(
			'3 figures · 2 videos (420 MB, charged to the group) · notes'
		);
		const figure = { ...none, kind: 'figure' as const, recordings: 1 };
		expect(whatGoes({ ...figure, bytes: 12 * MB, notes: false, into: T1 })).toBe(
			'1 recording (12 MB, charged to the group)'
		);
		const routine = { ...none, kind: 'routine' as const, figures: 1, routines: 1, drills: 2 };
		expect(whatGoes({ ...routine, bytes: 0, notes: false, into: MINE })).toBe(
			'1 figure · 1 routine · 2 drills'
		);
		const video = { ...none, kind: 'lesson' as const, videos: 1 };
		expect(whatGoes({ ...video, bytes: 5 * MB, notes: false, into: MINE })).toBe(
			'1 video (5 MB, charged to you)'
		);
		const song = { ...none, kind: 'song' as const, audio: true };
		expect(whatGoes({ ...song, bytes: 4 * MB, notes: false, into: T1 })).toBe(
			'The audio (4 MB, charged to the group)'
		);
		expect(whatGoes({ ...none, kind: 'figure', bytes: 0, notes: true, into: T1 })).toBe('Notes');
		expect(whatGoes({ ...none, kind: 'drill', bytes: 0, notes: false, into: T1 })).toBe(
			'Just the drill'
		);
		const tagged = { ...none, kind: 'lesson' as const, figures: 2, positions: 3 };
		expect(whatGoes({ ...tagged, bytes: 0, notes: false, into: T1 })).toBe(
			'2 figures · 3 positions'
		);
		expect(
			whatGoes({ ...none, kind: 'figure', positions: 1, bytes: 0, notes: false, into: T1 })
		).toBe('1 position');
		expect(whatGoes({ ...none, kind: 'position', bytes: 0, notes: false, into: T1 })).toBe(
			'Just the position'
		);
	});

	it('already there', () => {
		expect(alreadyThere()).toBe('ALREADY THERE');
		expect(alreadyLine('Enchufla · Doble', T1, '2026-10-03', true)).toBe(
			'Enchufla · Doble: Salsa Tuesdays has your copy from 3 Oct. It’s reused, not doubled.'
		);
		expect(alreadyLine('Enchufla · Doble', T1, '2026-10-03', false)).toBe(
			'Enchufla · Doble: Salsa Tuesdays has it already, from 3 Oct. It’s reused, not doubled.'
		);
		expect(alreadyLine('Setenta · Básico', MINE, '2026-11-01', true)).toBe(
			'Setenta · Básico: you have it already, from 1 Nov. It’s reused, not doubled.'
		);
	});

	it('the button, the existing member and the toast', () => {
		expect(copyButton('lesson', T1)).toBe('Copy as a draft');
		expect(copyButton('song', T1)).toBe('Copy as a draft');
		expect(copyButton('figure', T1)).toBe('Copy');
		expect(copyButton('lesson', MINE)).toBe('Copy');
		expect(existingNote(T1, false)).toBe('Salsa Tuesdays has it already. Sync the two copies.');
		expect(existingNote(T1, true)).toBe(
			'Salsa Tuesdays has an archived copy. Restore it, then sync.'
		);
		expect(existingNote(MINE, false)).toBe('You have it already. Sync the two copies.');
		expect(existingNote(MINE, true)).toBe('You have an archived copy. Restore it, then sync.');
		expect(restoreLabel()).toBe('Restore');
		expect(copiedToast(T1, true)).toBe('Copied to Salsa Tuesdays as a draft.');
		expect(copiedToast(T1, false)).toBe('Copied to Salsa Tuesdays.');
		expect(copiedToast(MINE, false)).toBe('Copied to your app.');
		expect(copyFailed()).toBe('That could not be copied. Try again.');
		expect(openLabel()).toBe('Open');
	});

	it('which version goes (board C4 p4)', () => {
		expect(whichTitle('Enchufla · Doble')).toBe('Which Enchufla · Doble?');
		expect(whichSub('figure', 2, 'Salsa Tuesdays')).toBe(
			'You see two versions of this figure. Which one goes to Salsa Tuesdays?'
		);
		expect(whichSub('routine', 3, 'Rueda club')).toBe(
			'You see three versions of this routine. Which one goes to Rueda club?'
		);
		expect(whichSub('song', 12, 'Rueda club')).toBe(
			'You see 12 versions of this song. Which one goes to Rueda club?'
		);
		expect(twinChoiceLabel(MINE)).toBe('Yours');
		expect(twinChoiceLabel({ kind: 'team', teamId: 2, name: 'Rueda club' })).toBe('Rueda club’s');
		expect(twinChoiceMeta(Date.UTC(2026, 9, 30, 12), 'Europe/Ljubljana')).toBe(
			'Last changed 30 Oct'
		);
		// The day is the person's: late on 1 Nov in UTC is 2 Nov in Ljubljana.
		expect(twinChoiceMeta(Date.UTC(2026, 10, 1, 23, 30), 'Europe/Ljubljana')).toBe(
			'Last changed 2 Nov'
		);
		expect(twinsOneGoes()).toBe(
			'They’re twins in your app. Only one goes; the group never gets twins.'
		);
		expect(continueLabel()).toBe('Continue');
	});
});

describe('Move to… (board C4 p3)', () => {
	it('names the sheet, the two choices and the note', () => {
		expect(moveTo()).toBe('Move to…');
		expect(moveTitle('Week 3', { kind: 'team', teamId: 1, name: 'Salsa Tuesdays' })).toBe(
			'Move Week 3 to Salsa Tuesdays'
		);
		expect(moveSub()).toBe(
			'The lesson lives in the group and leaves your lessons. What it brings:'
		);
		expect(keepMine()).toBe('Keep mine as well');
		expect(useGroups()).toBe('Use the group’s');
		expect(moveNote()).toBe(
			'“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s.'
		);
		expect(practiceStays()).toBe('Your practice of what you drop stays with your archived copy.');
		expect(moveButton()).toBe('Move as a draft');
		expect(movedToast('Salsa Tuesdays')).toBe('Moved to Salsa Tuesdays as a draft.');
	});

	it('says why a thing is kept: lessons, then routines, then practice, else only this lesson', () => {
		const why = (lessons: number, routines: string[], practised: boolean) =>
			moveWhy({ lessons, routines, practised });
		expect(why(2, ['Week 4 loop'], true)).toBe('Used by 2 other lessons');
		expect(why(1, [], false)).toBe('Used by 1 other lesson');
		expect(why(0, ['Week 4 loop'], true)).toBe('Used by Week 4 loop');
		expect(why(0, ['A', 'B'], false)).toBe('Used by 2 routines');
		expect(why(0, [], true)).toBe('You practise it');
		expect(why(0, [], false)).toBe('Only this lesson');
	});
});

describe('Same as… (board C7)', () => {
	it('words the sheet and the page', async () => {
		const v = await import('./view');
		expect(v.sameAsTitle('Enchufla · Doble')).toBe('Enchufla · Doble is the same as…');
		expect(v.twinsNote('figure')).toBe(
			'Twins show as one figure. They never sync, and only you see the grouping.'
		);
		expect(v.markSame()).toBe('Mark as the same');
		expect(v.separateLabel()).toBe('Not the same? Separate');
		expect(v.sameAs()).toBe('Same as…');
	});

	it('words the note, search and empty line for every kind', async () => {
		const v = await import('./view');
		expect(v.twinsNote('routine')).toBe(
			'Twins show as one routine. They never sync, and only you see the grouping.'
		);
		expect(v.twinsNote('lesson')).toContain('one lesson.');
		expect(v.twinsNote('song')).toContain('one song.');
		expect(v.sameAsSearch('routine')).toBe('Search your routines');
		expect(v.sameAsSearch('song')).toBe('Search your songs');
		expect(v.sameAsSearch('position')).toBe('Search your positions');
		expect(v.sameAsSearch('figure')).toBe('Search your figures');
		expect(v.sameAsEmpty('figure')).toBe('No other figures match.');
		expect(v.sameAsEmpty('position')).toBe('No other positions match.');
		expect(v.twinsNote('position')).toBe(
			'Twins show as one position. They never sync, and only you see the grouping.'
		);
		expect(v.sameAsEmpty('lesson')).toBe('No other lessons match.');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T): T => withLocale('sl', fn);
	const report = (extra: Partial<SwitchReport> = {}): SwitchReport => ({
		routines: [],
		lessons: [],
		sections: 0,
		entries: 0,
		figures: [],
		...extra
	});
	const team = { kind: 'team' as const, teamId: 1, name: 'Sreda 17:30' };
	const mine = { kind: 'mine' as const };
	const none = { clonedFrom: null, groups: 0, twins: 0 };

	it('a group’s name stands after a “·” or a colon, never declined', () => {
		expect(sl(() => usedAsIs('Sreda 17:30'))).toBe('Sreda 17:30 · uporabljeno, kakršno je');
		expect(sl(() => fromLessonNote('Teden 6', 'Sreda 17:30'))).toBe(
			'Iz lekcije: Teden 6. V kombinacijah jo uporabljajte, kakršna je; ostane v skupini: Sreda 17:30.'
		);
		expect(sl(() => groupSlotNote(['Setenta', 'Enchufla'], 'Rueda club'))).toBe(
			'Setenta in Enchufla · iz skupine: Rueda club. Če skupino zapustite, obdržite kopijo in ta kombinacija deluje naprej.'
		);
	});

	it('Make it mine: the sheet’s words', () => {
		expect(sl(() => makeMineTitle('Setenta · Básico'))).toBe(
			'Želite narediti svojo kopijo: Setenta · Básico?'
		);
		expect(sl(makeMineSub)).toBe(
			'Ko urejate, nastane vaša kopija. Tista iz tečaja ostane nespremenjena.'
		);
		expect(sl(restoreLine)).toBe('Svojo kopijo ste že imeli. Jo želite obnoviti?');
		expect(sl(() => youGet('routine'))).toBe(
			'Ime, opombe in mesta. Spreminjate jih lahko po svoje.'
		);
		expect(sl(() => staysTheirs('figure', 'Sreda 17:30'))!.title).toBe(
			'OSTANE V SKUPINI · SREDA 17:30'
		);
		expect(sl(() => staysTheirs('position', 'Rueda club'))!.body).toBe(
			'Lekcije in videi, ki so nanj povezani. Vidite jih na zavihku skupine: Rueda club.'
		);
		expect(sl(() => makeMineSize(380 * 1024 * 1024))).toBe('Zasede 380 MB vašega prostora');
		expect(sl(archivedSongCopy)).toContain('Kaj zaseda prostor');
	});

	it('Make it mine: what switches, listed after the colon', () => {
		expect(sl(() => switchNote(report({ routines: [{ id: 1, name: 'Teden 4' }] }), true))).toBe(
			'Na vašo kopijo preide: kombinacija Teden 4 in vadenje.'
		);
		const two = [
			{ id: 1, name: 'A' },
			{ id: 2, name: 'B' }
		];
		expect(sl(() => switchNote(report({ routines: two }), false))).toBe(
			'Na vašo kopijo preide: kombinaciji A in B.'
		);
		expect(
			sl(() =>
				switchNote(
					report({
						figures: [{ id: 7, label: 'Setenta · Con giro' }],
						lessons: [{ id: 4, title: 'Mi clase' }],
						sections: 2
					}),
					false
				)
			)
		).toBe(
			'Na vašo kopijo preide: figura Setenta · Con giro (s tem položajem), lekcija Mi clase in 2 odseka.'
		);
		const three = [7, 8, 9].map((id) => ({ id, label: `F${id}` }));
		expect(sl(() => switchNote(report({ figures: three }), false))).toBe(
			'Na vašo kopijo preide: 3 figure s tem položajem.'
		);
		expect(sl(() => switchNote(report(), false))).toBeNull();
	});

	it('the band’s subtitle and the source tab', () => {
		expect(sl(() => cloneSubtitle({ ...none, self: team, kind: 'routine' }))).toBe(
			'Kombinacija · Sreda 17:30'
		);
		expect(
			sl(() => cloneSubtitle({ ...none, self: mine, clonedFrom: 'Sreda 17:30', kind: 'figure' }))
		).toBe('Vaša kopija · vir: Sreda 17:30');
		expect(
			[1, 2, 5].map((g) =>
				sl(() => cloneSubtitle({ ...none, self: mine, groups: g, kind: 'figure' }))
			)
		).toEqual(['Vaše · v 1 skupini', 'Vaše · v 2 skupinah', 'Vaše · v 5 skupinah']);
		expect(sl(() => cloneSubtitle({ ...none, self: mine, twins: 1, kind: 'figure' }))).toBe(
			'Dvojčka · 2 figuri'
		);
		expect(sl(() => cloneSubtitle({ ...none, self: mine, twins: 2, kind: 'figure' }))).toBe(
			'Dvojčki · 3 figure'
		);
		expect(sl(() => cloneSubtitle({ ...none, self: mine, twins: 4, kind: 'routine' }))).toBe(
			'Dvojčki · 5 kombinacij'
		);
		expect(cloneSubtitle({ ...none, self: mine, twins: 4, kind: 'routine' })).toBe(
			'Twins · 5 versions'
		);
		expect(sl(() => sourceNote('Sreda 17:30'))).toBe(
			'Kopija · Sreda 17:30, samo za branje. Kar želite, prevzemite v svojo.'
		);
		expect(sl(() => [recordingMeta(true, '12 MB'), recordingMeta(false, '12 MB')])).toEqual([
			'12 MB · že v vaši kopiji',
			'Nov · 12 MB'
		]);
		expect(sl(() => [takeLabel(), notTaken(), alreadyInYours(), recordingGone()])).toEqual([
			'Prevzemi',
			'Ni prevzeto',
			'Ta posnetek je že v vaši kopiji.',
			'Tega posnetka ni več.'
		]);
	});

	it('changedLabels counts in the nominative', () => {
		const d = (key: string, label: string) => ({ key, label });
		expect(
			sl(() =>
				changedLabels([
					d('notes', 'Opombe'),
					d('rec:g1', 'x'),
					d('rec:g2', 'y'),
					d('start:g1', 'x'),
					d('end:g1', 'x'),
					d('end:g2', 'y'),
					d('end:g3', 'z'),
					d('fig:g9', 'x')
				])
			)
		).toEqual(['Opombe', '2 posnetka', '1 začetni položaj', '3 končni položaji', '1 figura']);
	});

	it('Drop my copy', () => {
		expect(sl(dropTitle)).toBe('Želite opustiti svojo kopijo?');
		expect(sl(() => dropSub('edit'))).toBe(
			'Vrnete se h kopiji skupine, ki jo urejate. Vaša kopija se arhivira.'
		);
		expect(sl(() => dropOne('Sreda 17:30', 'Setenta · Básico'))).toBe(
			'Vaše kombinacije in vadenje bodo uporabljali: Setenta · Básico · Sreda 17:30.'
		);
		expect(sl(() => dropOne('Sreda 17:30', 'Setenta · Básico', false))).toBe(
			'Vaše kombinacije bodo uporabljale: Setenta · Básico · Sreda 17:30.'
		);
		expect(sl(() => onlyInYours(['Opombe', 'Ime', '1 posnetek']))).toBe(
			'Samo v vaši kopiji: opombe, ime in 1 posnetek. To gre v arhiv z vašo kopijo.'
		);
		expect(sl(() => onlyInYours(['Opombe'], 'Sreda 17:30'))).toBe(
			'Samo v vaši kopiji: opombe. To kopijo lahko urejate: Sreda 17:30.'
		);
		expect(sl(() => cantFollow('Teden 2'))).toBe(
			'Ni v nobeni lekciji, ki ste jo dodali, zato vadenje ne more slediti · Dodajte tudi lekcijo: Teden 2'
		);
		expect(sl(() => cantFollow(null, 'song'))).toBe(
			'Še ni objavljena: vaše vadenje ostane pri vaši kopiji.'
		);
		expect(
			sl(() => dropChoiceMeta({ clonedFrom: true, practiceFollows: true, addLesson: null }, false))
		).toBe('Vaša kopija je narejena od tod');
		expect(sl(() => dropPlace('Sreda 17:30'))).toBe('Sreda 17:30');
		expect(sl(() => droppedToast('Sreda 17:30'))).toBe(
			'Nazaj na kopiji · Sreda 17:30. Vaša kopija je arhivirana.'
		);
		expect(sl(() => [dropButton(), syncFirst(), useInstead(), dropGone()])).toEqual([
			'Opusti svojo kopijo',
			'Najprej uskladi',
			'Namesto nje uporabite',
			'Te kopije ni več mogoče uporabiti. Naložite znova in izberite še enkrat.'
		]);
	});

	it('Detach', () => {
		expect(sl(() => detachTitle('Sreda 17:30'))).toBe('Želite nehati slediti: Sreda 17:30?');
		expect(sl(() => detachTitle('Sreda 17:30', true))).toBe('Želite odklopiti od kopij?');
		expect(sl(() => detachGroup('routine'))).toBe(
			'V skupini »Odklopi« le prekine povezavo s kopijami: ostane kombinacija skupine.'
		);
		expect(sl(detachNoMore)).toBe('Brez obvestil o razlikah in brez nehotenega usklajevanja.');
		expect(sl(() => [detachButton(), detachFailed()])).toEqual([
			'Odklopi',
			'Odklop ni uspel. Poskusite znova.'
		]);
	});

	it('Sync’s titles and refusals', () => {
		expect(sl(() => syncTitle('Enchufla · Doble'))).toBe('Uskladi: Enchufla · Doble');
		expect(sl(() => updateTitle('Sreda 17:30'))).toBe('Posodobi iz: Sreda 17:30');
		expect(sl(syncStale)).toBe('Med usklajevanjem se je spremenilo; preverite znova.');
		expect(sl(syncNoAccess)).toBe('Te kopije ne morete več urejati.');
		expect(sl(() => nameTaken('Doble', 'Enchufla'))).toBe(
			'Figura s tem imenom že obstaja: Enchufla · Doble. Najprej eno preimenujte.'
		);
	});

	it('Versions: the chips, a copy’s line and the page’s own', () => {
		expect(sl(() => [versionsTitle(), familyTitle(), thisOne()])).toEqual([
			'Kopije',
			'Kopije, ki jih vidite',
			'Ta kopija'
		]);
		expect(sl(() => statusChip('behind'))).toEqual({ text: 'Zaostaja', tone: 'neutral' });
		expect(sl(() => statusChip('newer'))?.text).toBe('Novejša');
		expect(sl(() => statusChip('differs'))?.text).toBe('Razlikuje se');
		expect(sl(() => memberMeta('owner', 'behind', ['Notes', '1 posnetek']))).toBe(
			'Vodja · zaostaja za vašo kopijo: notes, 1 posnetek'
		);
		expect(sl(() => memberMeta('editor', 'newer', ['Opombe'], 'this one'))).toBe(
			'Lahko ureja · novejša od te kopije: opombe'
		);
		expect(sl(() => memberMeta('member', 'differs', []))).toBe(
			'Lahko bere · razlikuje se v obe smeri'
		);
		expect(sl(() => memberMeta(null, 'same', []))).toBe('Usklajena');
		expect(sl(() => memberMeta(null, 'behind', ['Opombe'], 'this one'))).toBe(
			'Zaostaja za to kopijo: opombe'
		);
		expect(sl(() => selfMeta(['Opombe', '+1 posnetek']))).toBe(
			'Ta kopija · vaše spremembe: opombe, +1 posnetek'
		);
		expect(sl(() => selfMeta([]))).toBe('Ta kopija');
	});

	it('Copy to…: the title, the places and what goes', () => {
		const MB = 1024 ** 2;
		const GB = 1024 ** 3;
		const zero = {
			figures: 0,
			positions: 0,
			routines: 0,
			drills: 0,
			recordings: 0,
			videos: 0,
			audio: false,
			bytes: 0,
			notes: false
		};
		expect(sl(copyTo)).toBe('Kopiraj v …');
		expect(sl(() => copyTitle('Teden 3'))).toBe('Kam želite kopirati: Teden 3?');
		expect(sl(() => copySub('lesson', team, true))).toBe('Skupina dobi osnutek. Svojo obdržite.');
		expect(sl(() => copySub('figure', team, false))).toBe(
			'Skupina dobi kopijo. Izvirnik ostane, kakršen je.'
		);
		expect(sl(() => copySub('figure', mine, false))).toBe(
			'Dobite svojo kopijo. Izvirnik ostane, kakršen je.'
		);
		expect(sl(copySubGroup)).toBe('Skupina dobi osnutek. Svojo obdržite.');
		expect(sl(() => [placeLabel(team), placeLabel(mine)])).toEqual([
			'Sreda 17:30',
			'Vaša aplikacija'
		]);
		expect(sl(() => placeMeta('owner', 412 * MB, GB))).toBe('Vodja · zasedeno: 412 MB od 1 GB');
		expect(sl(() => placeMeta('editor', 1.5 * GB, 2 * GB))).toBe(
			'Lahko ureja · zasedeno: 1,5 GB od 2 GB'
		);
		expect(sl(() => placeMeta(null, 3 * MB, null))).toBe('Zasedeno: 3 MB');
		expect(sl(() => [whatGoesTitle(), alreadyThere()])).toEqual(['KAJ SE KOPIRA', 'ŽE TAM']);
		expect(
			sl(() => whatGoes({ ...zero, kind: 'lesson', figures: 2, positions: 5, into: team }))
		).toBe('2 figuri · 5 položajev');
		const lesson = { ...zero, kind: 'lesson' as const, figures: 3, videos: 2, notes: true };
		const charged = sl(() => whatGoes({ ...lesson, bytes: 1.2 * GB, into: team }));
		expect(charged).toBe('3 figure · 2 videa (1,2 GB, na račun skupine) · opombe');
		expect(charged).toContain('1,2 GB');
		expect(
			sl(() => whatGoes({ ...zero, kind: 'lesson', videos: 1, bytes: 5 * MB, into: mine }))
		).toBe('1 video (5 MB, na vaš račun)');
		expect(
			sl(() => whatGoes({ ...zero, kind: 'song', audio: true, bytes: 4 * MB, into: team }))
		).toBe('Zvok (4 MB, na račun skupine)');
		expect(
			sl(() => whatGoes({ ...zero, kind: 'routine', routines: 1, drills: 2, into: team }))
		).toBe('1 kombinacija · 2 vaji');
		expect(sl(() => whatGoes({ ...zero, kind: 'drill', into: team }))).toBe('Samo vaja');
		expect(sl(() => whatGoes({ ...zero, kind: 'position', into: team }))).toBe('Samo položaj');
	});

	it('Copy to…: already there, the place’s own copy and the toast', () => {
		expect(sl(() => alreadyLine('Enchufla · Doble', team, '2026-10-03', true))).toBe(
			'Enchufla · Doble: skupina ima vašo kopijo od 3. okt. · Sreda 17:30. Uporabi se obstoječe, nič se ne podvoji.'
		);
		expect(sl(() => alreadyLine('Enchufla · Doble', team, '2026-10-03', false))).toBe(
			'Enchufla · Doble: skupina to že ima, od 3. okt. · Sreda 17:30. Uporabi se obstoječe, nič se ne podvoji.'
		);
		expect(sl(() => alreadyLine('Setenta · Básico', mine, '2026-11-01', true))).toBe(
			'Setenta · Básico: to že imate (od 1. nov.). Uporabi se obstoječe, nič se ne podvoji.'
		);
		expect(sl(() => [copyButton('lesson', team), copyButton('figure', team)])).toEqual([
			'Kopiraj kot osnutek',
			'Kopiraj'
		]);
		expect(sl(() => existingNote(team, false))).toBe(
			'Skupina to že ima · Sreda 17:30. Uskladite kopiji.'
		);
		expect(sl(() => existingNote(team, true))).toBe(
			'Skupina ima arhivirano kopijo · Sreda 17:30. Obnovite jo, nato uskladite.'
		);
		expect(sl(() => existingNote(mine, false))).toBe('To že imate. Uskladite kopiji.');
		expect(sl(() => existingNote(mine, true))).toBe(
			'Imate arhivirano kopijo. Obnovite jo, nato uskladite.'
		);
		expect(sl(() => copiedToast(team, true))).toBe('Kopirano kot osnutek v: Sreda 17:30.');
		expect(sl(() => copiedToast(team, false))).toBe('Kopirano v: Sreda 17:30.');
		expect(sl(() => copiedToast(mine, false))).toBe('Kopirano v vašo aplikacijo.');
		expect(sl(() => [restoreLabel(), copyFailed(), openLabel()])).toEqual([
			'Obnovi',
			'Kopiranje ni uspelo. Poskusite znova.',
			'Odpri'
		]);
	});

	it('Copy to…: which twin goes', () => {
		expect(sl(() => whichTitle('Enchufla · Doble'))).toBe('Kateri dvojček: Enchufla · Doble?');
		expect([2, 3, 5].map((n) => sl(() => whichSub('figure', n, 'Rueda club')))).toEqual([
			'Vidite 2 dvojčka. Kateri naj gre v: Rueda club?',
			'Vidite 3 dvojčke. Kateri naj gre v: Rueda club?',
			'Vidite 5 dvojčkov. Kateri naj gre v: Rueda club?'
		]);
		expect(sl(() => [twinChoiceLabel(mine), twinChoiceLabel(team)])).toEqual([
			'Vaše',
			'Skupina: Sreda 17:30'
		]);
		expect(sl(() => twinChoiceMeta(Date.UTC(2026, 9, 30, 12), 'Europe/Ljubljana'))).toBe(
			'Nazadnje spremenjeno: 30. okt.'
		);
		expect(sl(twinsOneGoes)).toBe(
			'V vaši aplikaciji so dvojčki. Gre samo eden; skupina nikoli ne dobi dvojčkov.'
		);
		expect(sl(continueLabel)).toBe('Naprej');
	});

	it('Move to…', () => {
		expect(sl(moveTo)).toBe('Premakni v …');
		expect(sl(() => moveTitle('Teden 3', team))).toBe('Premakni lekcijo: Teden 3 → Sreda 17:30');
		expect(sl(() => [keepMine(), useGroups(), moveButton()])).toEqual([
			'Obdrži tudi svojo',
			'Uporabi skupinsko',
			'Premakni kot osnutek'
		]);
		expect(sl(moveNote)).toBe(
			'»Uporabi skupinsko«: vaša kopija se opusti, vaše druge lekcije in kombinacije pa uporabijo skupinsko.'
		);
		expect(sl(moveSub)).toBe(
			'Lekcija bo v skupini in ne več med vašimi lekcijami. Kaj prinese s sabo:'
		);
		expect(sl(practiceStays)).toBe(
			'Vadenje tega, kar opustite, ostane pri vaši arhivirani kopiji.'
		);
		expect(sl(() => movedToast('Sreda 17:30'))).toBe('Premaknjeno kot osnutek v: Sreda 17:30.');
		expect(sl(moveFailed)).toBe('Premik ni uspel. Poskusite znova.');
		expect(sl(moveGone)).toBe(
			'Kar lekcija prinese, se je spremenilo. Naložite znova in izberite še enkrat.'
		);
	});

	it('Move to…: “Used by”, the verb agreeing with the count', () => {
		const why = (lessons: number, routines: string[], practised = false) =>
			sl(() => moveWhy({ lessons, routines, practised }));
		const names = (n: number) => Array.from({ length: n }, (_, i) => `K${i}`);
		expect([2, 3, 5, 101, 102].map((n) => why(0, names(n)))).toEqual([
			'Uporabljata 2 kombinaciji',
			'Uporabljajo 3 kombinacije',
			'Uporablja 5 kombinacij',
			'Uporablja 101 kombinacija',
			'Uporabljata 102 kombinaciji'
		]);
		expect([1, 2, 3, 5].map((n) => why(n, []))).toEqual([
			'Uporablja še 1 lekcija',
			'Uporabljata še 2 lekciji',
			'Uporabljajo še 3 lekcije',
			'Uporablja še 5 lekcij'
		]);
		expect(why(0, ['Teden 4'])).toBe('V kombinaciji: Teden 4');
		expect(why(0, [], true)).toBe('To vadite');
		expect(why(0, [])).toBe('Samo v tej lekciji');
	});

	it('Same as…', () => {
		expect(sl(sameAs)).toBe('Enako kot …');
		expect(sl(() => sameAsTitle('Enchufla · Doble'))).toBe('Enchufla · Doble · enako kot …');
		expect(sl(() => twinsNote('figure'))).toBe(
			'Dvojčki so prikazani kot ena figura. Nikoli se ne usklajujejo in to združitev vidite samo vi.'
		);
		expect(sl(() => twinsNote('position'))).toContain('kot en položaj.');
		expect(sl(() => sameAsSearch('routine'))).toBe('Iščite med svojimi kombinacijami');
		expect(sl(() => sameAsSearch('position'))).toBe('Iščite med svojimi položaji');
		expect(sl(() => sameAsEmpty('lesson'))).toBe('Nobena druga lekcija ne ustreza.');
		expect(sl(() => sameAsEmpty('position'))).toBe('Noben drug položaj ne ustreza.');
		expect(sl(() => [markSame(), separateLabel(), sameAsFailed()])).toEqual([
			'Označi kot enako',
			'Ni enako? Loči',
			'Tega ni bilo mogoče shraniti. Poskusite znova.'
		]);
	});
});
