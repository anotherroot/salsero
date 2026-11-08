import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { LastSet } from '$lib/types';
import { lastTimeParts } from './log-view';

const last = (o: { daysAgo: number; rating: number | null; note: string | null }): LastSet => ({
	id: 1,
	doneAt: 0,
	durationS: null,
	reps: null,
	...o
});

describe('lastTimeParts', () => {
	it('is null for a first time', () => {
		expect(lastTimeParts(null)).toBeNull();
	});
	it('splits when, rating and note', () => {
		expect(lastTimeParts(last({ daysAgo: 3, rating: 3, note: 'lost the count' }))).toEqual({
			when: 'Last time: 3 days ago',
			rating: 3,
			note: 'lost the count'
		});
		expect(lastTimeParts(last({ daysAgo: 0, rating: null, note: null }))?.when).toBe(
			'Last time: Today'
		);
	});
});

// The class's older readers log here, and read no English.
describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('says when it was last practised, in lower case after the colon', () => {
		expect(sl(() => lastTimeParts(last({ daysAgo: 1, rating: 4, note: null })))?.when).toBe(
			'Zadnjič: včeraj'
		);
		expect(sl(() => lastTimeParts(last({ daysAgo: 0, rating: null, note: null })))?.when).toBe(
			'Zadnjič: danes'
		);
		expect(sl(() => lastTimeParts(last({ daysAgo: 3, rating: null, note: null })))?.when).toBe(
			'Zadnjič: pred 3 dnevi'
		);
	});
});
