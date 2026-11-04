import { describe, expect, it } from 'vitest';
import type { SwitchReport } from '$lib/types';
import {
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
});
