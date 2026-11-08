import { describe, expect, it } from 'vitest';
import { FEEL_TONE, faceColumns } from './face-view';
import { FEELS, feelWord } from '$lib/schedule/feel';
import { withLocale } from '$lib/i18n/current';

describe('faceColumns', () => {
	it('words each face and its time', () => {
		const cols = faceColumns([
			{ feel: 'hard', gap: 1 },
			{ feel: 'getting', gap: 3 },
			{ feel: 'gotit', gap: 21 },
			{ feel: 'easy', gap: 70 }
		]);
		expect(cols.map((c) => [c.word, c.time])).toEqual([
			['Still hard', 'Tomorrow'],
			['Getting there', '3 days'],
			["I've got it", '3 weeks'],
			['Easy', '2 months']
		]);
	});
	it('has no times without a preview (a back-filled day)', () => {
		const cols = faceColumns(null);
		expect(cols.map((c) => c.feel)).toEqual([...FEELS]);
		expect(cols.every((c) => c.time === null)).toBe(true);
	});
});

describe('FEEL_TONE', () => {
	it('colours each feel with its own token pair', () => {
		expect(FEEL_TONE.hard.bg).toBe('bg-danger-soft');
		expect(FEEL_TONE.getting.text).toBe('text-warn');
		expect(FEEL_TONE.gotit.ring).toBe('ring-done');
		expect(FEEL_TONE.easy).toEqual({ text: 'text-easy', bg: 'bg-easy-soft', ring: 'ring-easy' });
	});
});

describe('faceColumns in Slovenian', () => {
	it('words each face and its time', () => {
		const cols = withLocale('sl', () =>
			faceColumns([
				{ feel: 'hard', gap: 1 },
				{ feel: 'getting', gap: 3 },
				{ feel: 'gotit', gap: 21 },
				{ feel: 'easy', gap: 70 }
			])
		);
		expect(cols.map((c) => c.word)).toEqual(['Še težko', 'Napredujem', 'Obvladam', 'Lahko']);
		expect(cols.every((c) => c.time !== null)).toBe(true);
	});
});

describe('faceColumns learnt', () => {
	it('a learnt column', () =>
		expect(faceColumns([{ feel: 'gotit', gap: 3, learnt: true }])[2]).toEqual({
			feel: 'gotit',
			word: feelWord('gotit'),
			time: '3 days',
			learnt: true
		}));
	it('no column is learnt without it', () =>
		expect(faceColumns([{ feel: 'gotit', gap: 3 }]).some((c) => c.learnt)).toBe(false));
});
