import { describe, expect, it } from 'vitest';
import {
	chooseButton,
	copyChip,
	copyMeta,
	everythingMeta,
	leaveSub,
	leaveTitle,
	lockedMeta,
	overLimitLine,
	reconnectNote,
	removeBody,
	usedMeta
} from './leave-view';
import { withLocale } from '$lib/i18n/current';
import type { KeepPreview } from '$lib/types';

const GB = 1024 ** 3;
const preview = (
	n: Partial<Record<'lessons' | 'figures' | 'routines' | 'songs', number>>,
	bytes: number
) =>
	({
		lessons: Array(n.lessons ?? 0).fill({}),
		figures: Array(n.figures ?? 0).fill({}),
		routines: Array(n.routines ?? 0).fill({}),
		songs: Array(n.songs ?? 0).fill({}),
		drills: [],
		allBytes: bytes
	}) as unknown as KeepPreview;

describe('leave lines', () => {
	it('say the board’s words', () => {
		expect(leaveTitle('Salsa Tuesdays')).toBe('Leave Salsa Tuesdays?');
		expect(leaveSub()).toBe(
			'After leaving you see nothing of the group. You keep copies of what you choose.'
		);
		expect(reconnectNote()).toBe(
			'What you keep becomes your copies. Rejoin later and they reconnect.'
		);
		expect(chooseButton(3)).toBe('Leave and keep 3');
		expect(removeBody()).toBe('They leave the group and keep copies of what they had.');
		expect(copyChip()).toBe('Copy');
		expect(copyMeta('Salsa Tuesdays')).toBe('Your copy · from Salsa Tuesdays');
	});

	it('count everything, leaving out zeros', () => {
		const p = preview({ lessons: 6, figures: 9, routines: 3, songs: 5 }, 1.2 * GB);
		expect(everythingMeta(p)).toBe(
			'6 lessons, 9 figures, 3 routines, 5 songs · 1.2 GB counted to you'
		);
		expect(everythingMeta(preview({ lessons: 1, songs: 2 }, 40 * 1024 ** 2))).toBe(
			'1 lesson, 2 songs · 40 MB counted to you'
		);
		expect(everythingMeta(preview({}, 0))).toBe('Nothing to keep');
	});

	it('name what the routines use', () => {
		expect(usedMeta(['Setenta'], 'Week 4 loop')).toBe(
			'Setenta, which Week 4 loop uses. Everything else goes'
		);
		expect(usedMeta(['Setenta', 'Dile que no'], null)).toBe(
			'Setenta and Dile que no, which your routines use. Everything else goes'
		);
		expect(usedMeta([], null)).toBe('Nothing of yours uses it. Everything goes');
	});

	it('warn over the limit', () => {
		expect(overLimitLine(GB)).toBe(
			'That takes you over your 1 GB. You can still practise; new uploads wait until you’re under.'
		);
		expect(overLimitLine(1.5 * GB)).toContain('your 1.5 GB.');
	});

	it('lock a row with who uses it', () => {
		expect(lockedMeta('1 recording', 'routine')).toBe('1 recording · used by your routine');
		expect(lockedMeta('2 videos', 'lesson')).toBe('2 videos · used by your lesson');
		expect(lockedMeta('', 'routine')).toBe('Used by your routine');
	});
});

// Catches: the Leave sheet in English for a Slovenian member leaving a class, a
// count not in its Slovenian form, a name declined, or "1,0 GB" left unstripped.
describe('leave lines in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('ask and explain', () => {
		expect(sl(() => leaveTitle('Salsa torek'))).toBe('Želite zapustiti »Salsa torek«?');
		expect(sl(() => chooseButton(3))).toBe('Zapusti in obdrži 3');
		expect(sl(() => copyMeta('Salsa torek'))).toBe('Vaša kopija · vir: Salsa torek');
		expect(sl(leaveSub)).toBe(
			'Po izstopu iz skupine ne boste videli ničesar več. Obdržite kopije tistega, kar izberete.'
		);
	});

	it('count in four forms and say a whole gigabyte plainly', () => {
		expect(sl(() => everythingMeta(preview({ lessons: 1, figures: 2, songs: 5 }, GB)))).toBe(
			'1 lekcija, 2 figuri, 5 skladb · 1 GB v vašem prostoru'
		);
		expect(sl(() => everythingMeta(preview({ routines: 3 }, 1.2 * GB)))).toBe(
			'3 kombinacije · 1,2 GB v vašem prostoru'
		);
		expect(sl(() => overLimitLine(GB))).toContain('(1 GB)');
		expect(sl(() => everythingMeta(preview({}, 0)))).toBe('Ni česa obdržati');
	});

	it('put the routine after a colon and lock a row', () => {
		expect(sl(() => usedMeta(['Setenta', 'Dile que no'], 'Teden 4'))).toBe(
			'Setenta in Dile que no · uporablja: Teden 4. Vse drugo izgine'
		);
		expect(sl(() => lockedMeta('2 videa', 'lesson'))).toBe('2 videa · v uporabi: vaša lekcija');
		expect(sl(() => lockedMeta('', 'routine'))).toBe('V uporabi: vaša kombinacija');
	});
});

// Catches: Keep everything's counts in one form for every number (2 and 5 apart).
describe('Keep everything’s counts in Slovenian, two and five', () => {
	it('says 2 and 5 each in its own form', () => {
		expect(
			withLocale('sl', () => everythingMeta(preview({ lessons: 2, routines: 5, songs: 4 }, GB)))
		).toBe('2 lekciji, 5 kombinacij, 4 skladbe · 1 GB v vašem prostoru');
	});
});
