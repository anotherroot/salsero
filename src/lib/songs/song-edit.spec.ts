import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { clearLines, startRow, tempoAskBody } from './song-edit';

describe("Edit · Song's words", () => {
	it('says where the music starts and whose it is', () => {
		expect(startRow({ at: 18.2, source: 'found' })).toEqual({
			title: 'At 0:18',
			meta: 'Found by the home box'
		});
		expect(startRow({ at: 16, source: 'yours' })).toEqual({ title: 'At 0:16', meta: 'Yours' });
		expect(startRow({ at: 0, source: 'unmeasured' })).toEqual({
			title: 'Not measured yet',
			meta: 'Plays from 0:00'
		});
		expect(withLocale('sl', () => startRow({ at: 18.2, source: 'found' }).meta)).toBe(
			'Našel domači računalnik'
		);
	});

	it('offers Clear all only when there is something to clear', () => {
		expect(clearLines(2, 8)).toEqual({ ones: '2 set by you', sections: '8 sections' });
		expect(clearLines(1, 1)).toEqual({ ones: '1 set by you', sections: '1 section' });
		expect(clearLines(0, 0)).toEqual({ ones: null, sections: null });
		expect(withLocale('sl', () => clearLines(2, 3).sections)).toBe('3 deli');
	});

	it('asks before a count speed change clears the 1s, and says the sections stay', () => {
		expect(tempoAskBody(2, 2)).toBe(
			'Counting at ×2 clears your 2 1s. Your sections stay, each on its nearest 1.'
		);
		expect(tempoAskBody(1, 0.5)).toBe(
			'Counting at ×½ clears the 1 you set. Your sections stay, each on its nearest 1.'
		);
	});
});
