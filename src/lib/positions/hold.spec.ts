import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	EMPTY_HOLD,
	FACING,
	FRAME,
	HANDS,
	HANDS_LABEL,
	HANDS_SHORT,
	crossedLabel,
	notCrossedLabel,
	holdChips,
	holdLine,
	parseHold
} from './hold';

const full = { hands: 'two', crossed: true, facing: 'face', frame: 'open' } as const;

describe('hold words', () => {
	it('lists the chips in order', () => {
		expect(holdChips(full)).toEqual(['Two hands', 'Crossed, right on top', 'Face to face', 'Open']);
		expect(holdChips(EMPTY_HOLD)).toEqual([]);
	});
	it('joins the second line with all but the first lower-cased', () => {
		expect(holdLine(full)).toBe('Two hands · crossed, right on top · face to face · open');
		expect(holdLine(EMPTY_HOLD)).toBeNull();
	});
	it('does not show crossed when it is false', () => {
		expect(holdChips({ ...EMPTY_HOLD, hands: 'one', crossed: false })).toEqual(['One hand']);
	});
	it('exposes the vocabulary', () => {
		expect(HANDS).toEqual(['two', 'one', 'none']);
		expect(FACING).toEqual(['face', 'side', 'shadow', 'back']);
		expect(FRAME).toEqual(['open', 'closed']);
	});
	it('names the form’s Hands choices short: the field says Hands', () => {
		expect(HANDS.map((h) => HANDS_SHORT[h])).toEqual(['Two', 'One', 'None']);
	});
});

describe('parseHold', () => {
	it('reads the form fields', () => {
		const f = new FormData();
		f.set('hands', 'one');
		f.set('crossed', '1');
		f.set('facing', 'shadow');
		f.set('frame', 'closed');
		expect(parseHold(f)).toEqual({
			hands: 'one',
			crossed: true,
			facing: 'shadow',
			frame: 'closed'
		});
	});
	it('turns missing and unknown values into null', () => {
		const f = new FormData();
		f.set('hands', 'three');
		f.set('facing', '');
		expect(parseHold(f)).toEqual(EMPTY_HOLD);
	});
});

describe('hold words in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('reads the chips and the form’s choices in the reader’s language', () => {
		expect(
			sl(() => holdChips({ hands: 'two', crossed: null, facing: 'face', frame: 'open' }))
		).toEqual(['Dve roki', 'Obraz v obraz', 'Odprta']);
		expect(sl(() => holdLine(full))).toBe(
			'Dve roki · prekrižani, desna zgoraj · obraz v obraz · odprta'
		);
		expect(sl(() => HANDS_LABEL.none)).toBe('Brez rok');
		expect(sl(() => HANDS.map((h) => HANDS_SHORT[h]))).toEqual(['Dve', 'Ena', 'Brez']);
		expect(sl(() => [crossedLabel(), notCrossedLabel()])).toEqual([
			'Prekrižani, desna zgoraj',
			'Neprekrižani'
		]);
		// Read again outside: the table is not stuck in the language it was first read in.
		expect(HANDS_LABEL.none).toBe('No hands');
	});
});
