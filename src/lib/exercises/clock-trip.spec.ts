import { describe, expect, it } from 'vitest';
import {
	backFromPlayer,
	dropTrip,
	leaveForPlayer,
	TRIP_MAX_MS,
	type TripStore
} from './clock-trip';
import type { Stopwatch } from './stopwatch';

/** sessionStorage, as a map. */
function store(): TripStore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k)
	};
}

const MIN = 60_000;
/** The page opened 4 minutes before it was left for the player, 10 minutes ago. */
const running: Stopwatch = { bankedMs: 0, runningSince: 0 };
const left = 4 * MIN;
const back = 14 * MIN;

describe('the exercise page’s time across a trip to the player', () => {
	it('comes back with the page’s time plus the trip, banked', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		expect(backFromPlayer(s, 7, back)).toEqual({ bankedMs: 14 * MIN, runningSince: null });
	});

	it('is read once', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		backFromPlayer(s, 7, back);
		expect(backFromPlayer(s, 7, back)).toBeNull();
	});

	it('is nothing for another exercise', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		expect(backFromPlayer(s, 8, back)).toBeNull();
	});

	it('is nothing after a trip longer than six hours', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		expect(backFromPlayer(s, 7, left + TRIP_MAX_MS + 1)).toBeNull();
	});

	it('is nothing when the store holds garbage', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		for (const k of s.data.keys()) s.data.set(k, '{not json');
		expect(backFromPlayer(s, 7, back)).toBeNull();
		s.data.set([...s.data.keys()][0] ?? 'x', JSON.stringify({ watch: 'x', at: 'y' }));
		expect(backFromPlayer(s, 7, back)).toBeNull();
	});

	it('keeps a paused page’s time without the trip', () => {
		const s = store();
		leaveForPlayer(s, 7, { bankedMs: 3 * MIN, runningSince: null }, left);
		expect(backFromPlayer(s, 7, back)).toEqual({ bankedMs: 3 * MIN, runningSince: null });
	});

	it('is dropped when the page is reached some other way than back from the player', () => {
		const s = store();
		leaveForPlayer(s, 7, running, left);
		dropTrip(s, 7);
		expect(backFromPlayer(s, 7, back)).toBeNull();
	});
});
