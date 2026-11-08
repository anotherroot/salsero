/**
 * The exercise page's time across a trip to the player (one-player design):
 * open → Practise with → the player → Back is one visit, so the time spent in
 * the player counts. The page leaves its stopwatch here when it opens the
 * player and takes it back when it mounts again. PURE: the store (the tab's
 * sessionStorage) and `now` are arguments.
 *
 * Only a return within `TRIP_MAX_MS` counts, and a stored trip is read once.
 */
import { elapsedMs, type Stopwatch } from './stopwatch';

export type TripStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A phone left in the player overnight does not log the night. */
export const TRIP_MAX_MS = 6 * 3600_000;

const keyOf = (exerciseId: number) => `salsa:clock-trip:${exerciseId}`;

export function leaveForPlayer(
	store: TripStore,
	exerciseId: number,
	watch: Stopwatch,
	now: number
): void {
	store.setItem(keyOf(exerciseId), JSON.stringify({ watch, at: now }));
}

/** The page's watch as it should start again, banked; null when there is no trip to take. */
export function backFromPlayer(
	store: TripStore,
	exerciseId: number,
	now: number
): Stopwatch | null {
	const raw = store.getItem(keyOf(exerciseId));
	if (raw === null) return null;
	store.removeItem(keyOf(exerciseId));
	let trip: unknown;
	try {
		trip = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!trip || typeof trip !== 'object') return null;
	const { watch, at } = trip as { watch?: unknown; at?: unknown };
	if (typeof at !== 'number' || now - at > TRIP_MAX_MS || now < at) return null;
	if (!watch || typeof watch !== 'object') return null;
	const { bankedMs, runningSince } = watch as Record<string, unknown>;
	if (typeof bankedMs !== 'number' || bankedMs < 0) return null;
	if (runningSince !== null && typeof runningSince !== 'number') return null;
	return { bankedMs: elapsedMs({ bankedMs, runningSince }, now), runningSince: null };
}

/** The page was reached some other way than back from the player: its trip is not this visit's. */
export function dropTrip(store: TripStore, exerciseId: number): void {
	store.removeItem(keyOf(exerciseId));
}
