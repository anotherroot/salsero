import { describe, expect, it } from 'vitest';
import { shiftDay } from '$lib/day/day';
import { runEstimate, typicalSeconds } from './estimate';

const TZ = 'Europe/Ljubljana';
/** An instant on a local day (winter offset, as schedule.spec.ts builds it). */
const at = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
const D0 = '2026-01-10';
const D1 = shiftDay(D0, 1);
const D2 = shiftDay(D0, 2);
const D3 = shiftDay(D0, 3);
const D4 = shiftDay(D0, 4);

describe('typicalSeconds', () => {
	it('takes the median of the last 3 timed days, a day added up', () => {
		const sets = [
			{ doneAt: at(D0), durationS: 300 },
			{ doneAt: at(D1, 9), durationS: 600 },
			{ doneAt: at(D1, 18), durationS: 120 }, // 720 that day
			{ doneAt: at(D2), durationS: null },
			{ doneAt: at(D3), durationS: 240 },
			{ doneAt: at(D4), durationS: 0 }
		];
		expect(typicalSeconds(sets, TZ)).toBe(300); // 240, 720, 300
	});
	it('two timed days: their mean; none: null', () => {
		expect(
			typicalSeconds(
				[
					{ doneAt: at(D0), durationS: 100 },
					{ doneAt: at(D1), durationS: 200 }
				],
				TZ
			)
		).toBe(150);
		expect(typicalSeconds([{ doneAt: at(D0), durationS: null }], TZ)).toBeNull();
	});
	it('ignores older days beyond the last 3', () => {
		const sets = [D0, D1, D2, D3].map((d, i) => ({
			doneAt: at(d),
			durationS: [9000, 10, 20, 30][i]
		}));
		expect(typicalSeconds(sets, TZ)).toBe(20);
	});
});

describe('runEstimate', () => {
	it('sums what has a time, null when nothing has', () => {
		const sets = [
			{ exerciseId: 1, doneAt: at(D0), durationS: 300 },
			{ exerciseId: 2, doneAt: at(D0), durationS: 180 }
		];
		expect(runEstimate(sets, [1, 2, 3], TZ)).toBe(480);
		expect(runEstimate(sets, [3], TZ)).toBeNull();
	});
});
