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
	usedAsIs
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
