import { describe, expect, it } from 'vitest';
import {
	effectiveComesBack,
	FACES,
	parseComesBack,
	rhythmWords,
	serializeComesBack
} from './comes-back';

describe('parseComesBack', () => {
	it.each([
		null,
		undefined,
		'',
		'{',
		'null',
		'{"kind":"every","days":4}',
		'{"kind":"every","days":"2"}',
		'{"kind":"until","good":4,"since":1}',
		'{"kind":"until","good":3}',
		'{"kind":"until","good":3,"since":"x"}',
		'{"kind":"x"}'
	])('%s is not set', (raw) => expect(parseComesBack(raw)).toBeNull());
	it('round-trips', () => {
		for (const c of [
			{ kind: 'until', good: 3, since: 1730000000000 },
			{ kind: 'until', good: 5, since: 1 },
			{ kind: 'every', days: 7 },
			{ kind: 'faces' }
		] as const)
			expect(parseComesBack(serializeComesBack(c))).toEqual(c);
	});
});

describe('effectiveComesBack', () => {
	const every2 = { kind: 'every', days: 2 } as const;
	it('a lesson review is always faces', () =>
		expect(effectiveComesBack('lesson', every2, null)).toEqual(FACES));
	it('an entry follows its class drill', () =>
		expect(effectiveComesBack('added', null, every2)).toEqual(every2));
	it("the member's own wins", () =>
		expect(effectiveComesBack('added', FACES, every2)).toEqual(FACES));
	it('a custom drill uses its own, else faces', () => {
		expect(effectiveComesBack('custom', every2, null)).toEqual(every2);
		expect(effectiveComesBack('custom', null, null)).toEqual(FACES);
	});
});

describe('rhythmWords', () => {
	it('names the four rhythms', () => {
		expect([1, 2, 3, 7].map((d) => rhythmWords(d as 1 | 2 | 3 | 7))).toEqual([
			'Every day',
			'Every 2 days',
			'Every 3 days',
			'Weekly'
		]);
	});
});
