import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { addedMessage, bandSubtitle, doneBar, doneSubtitle, savedMessage } from './done-view';

describe('bandSubtitle', () => {
	it('says the kind and the time', () => {
		expect(bandSubtitle({ label: 'Drill', warmup: false, learning: false, seconds: 252 })).toBe(
			'Drill · 4:12'
		);
		expect(bandSubtitle({ label: 'Drill', warmup: false, learning: true, seconds: 200 })).toBe(
			'Drill · learning · 3:20'
		);
		expect(bandSubtitle({ label: 'Drill', warmup: true, learning: false, seconds: 390 })).toBe(
			'Drill · warm-up · 6:30'
		);
		expect(bandSubtitle({ label: 'Drill', warmup: true, learning: true, seconds: 252 })).toBe(
			'Drill · warm-up · learning · 4:12'
		);
	});
	it('in a run, the place goes before the time', () => {
		expect(
			bandSubtitle({
				label: 'Drill',
				warmup: false,
				learning: false,
				seconds: 252,
				place: { at: 3, of: 7 }
			})
		).toBe('Drill · 3 of 7 · 4:12');
		expect(
			bandSubtitle({
				label: 'Drill',
				warmup: true,
				learning: false,
				seconds: 390,
				place: { at: 1, of: 7 }
			})
		).toBe('Drill · warm-up · 1 of 7 · 6:30');
		expect(
			bandSubtitle({
				label: 'Drill',
				warmup: false,
				learning: true,
				seconds: 200,
				place: { at: 2, of: 3 }
			})
		).toBe('Drill · learning · 2 of 3 · 3:20');
		expect(
			bandSubtitle({ label: 'Drill', warmup: false, learning: false, seconds: 252, place: null })
		).toBe('Drill · 4:12');
	});
});

describe('doneSubtitle', () => {
	it('is the time, the learning line, or the past day', () => {
		expect(doneSubtitle({ seconds: 252, learning: null, day: null, name: 'X' })).toBe('4:12');
		expect(doneSubtitle({ seconds: 252, learning: { good: 2, of: 3 }, day: null, name: 'X' })).toBe(
			'Learning · 2 of 3 good days'
		);
		expect(
			doneSubtitle({ seconds: null, learning: null, day: '2026-11-05', name: 'Review: La policía' })
		).toBe('Review: La policía · Thursday 5 November');
	});
	it('in a run, names the next', () => {
		const next = 'Review: La policía';
		expect(doneSubtitle({ seconds: 252, learning: null, day: null, name: 'X', next })).toBe(
			'4:12 · Next: Review: La policía'
		);
		expect(
			doneSubtitle({ seconds: 252, learning: { good: 2, of: 3 }, day: null, name: 'X', next })
		).toBe('Learning · 2 of 3 good days · Next: Review: La policía');
		// The last of the run: no Next.
		expect(doneSubtitle({ seconds: 252, learning: null, day: null, name: 'X', next: null })).toBe(
			'4:12'
		);
	});
});

describe('toasts', () => {
	it('saved says when it comes back, lower case', () => {
		expect(savedMessage(12)).toBe('Saved · back in 12 days');
		expect(savedMessage(1)).toBe('Saved · back tomorrow');
	});
	it('added names the day', () => {
		expect(addedMessage('2026-11-05')).toBe('Added to Thu 5 Nov');
	});
});

describe('doneBar', () => {
	it('is Done today once the day has an entry, and never waits (nothing plays on the page)', () => {
		expect(doneBar({ doneToday: true })).toEqual({
			label: 'Done today',
			kind: 'done-soft'
		});
		expect(doneBar({ doneToday: false })).toEqual({
			label: 'Done',
			kind: 'primary'
		});
	});
	it('is the green Done · next for a fixed rhythm in a run', () => {
		expect(doneBar({ doneToday: false, fixedInRun: true })).toEqual({
			label: 'Done · next',
			kind: 'done'
		});
		// Done today already: as outside a run.
		expect(doneBar({ doneToday: true, fixedInRun: true }).kind).toBe('done-soft');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('words the saved toast', () => {
		expect(sl(() => savedMessage(12))).toBe('Shranjeno · spet čez 12 dni');
	});
	it('words a past day', () => {
		expect(
			sl(() => doneSubtitle({ seconds: null, learning: null, day: '2026-11-05', name: 'X' }))
		).toBe('X · četrtek, 5. novembra');
	});
	it('words the run', () => {
		expect(
			sl(() =>
				bandSubtitle({
					label: 'Vaja',
					warmup: false,
					learning: false,
					seconds: 252,
					place: { at: 3, of: 7 }
				})
			)
		).toBe('Vaja · 3 od 7 · 4:12');
		expect(
			sl(() => doneSubtitle({ seconds: 252, learning: null, day: null, name: 'X', next: 'Y' }))
		).toBe('4:12 · Naslednja: Y');
		expect(sl(() => doneBar({ doneToday: false, fixedInRun: true }).label)).toBe(
			'Opravljeno · naprej'
		);
	});
	it('words the bar', () => {
		expect(sl(() => doneBar({ doneToday: true }).label)).toBe('Opravljeno danes');
	});
});
