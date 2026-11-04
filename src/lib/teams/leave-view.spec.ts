import { describe, expect, it } from 'vitest';
import {
	chooseButton,
	COPY_CHIP,
	copyMeta,
	everythingMeta,
	leaveSub,
	leaveTitle,
	lockedMeta,
	overLimitLine,
	reconnectNote,
	REMOVE_BODY,
	usedMeta
} from './leave-view';
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
		expect(leaveSub).toBe(
			'After leaving you see nothing of the group. You keep copies of what you choose.'
		);
		expect(reconnectNote).toBe(
			'What you keep becomes your copies. Rejoin later and they reconnect.'
		);
		expect(chooseButton(3)).toBe('Leave and keep 3');
		expect(REMOVE_BODY).toBe('They leave the group and keep copies of what they had.');
		expect(COPY_CHIP).toBe('Copy');
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
