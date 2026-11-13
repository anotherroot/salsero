/**
 * A drill's round, handed from its listening page back to the drill's page
 * (phase 2), where Done saves it with the face. The tab's sessionStorage, as
 * the player's trip does (`clock-trip.ts`); read once. PURE but for the
 * `Storage` passed in, so every access may throw (a private window): callers
 * wrap it.
 */
import { parseRound, type HearingRound } from './drill';

const key = (exerciseId: number) => `salsa:hearing-round:${exerciseId}`;

export function leaveRound(store: Storage, exerciseId: number, round: HearingRound): void {
	store.setItem(key(exerciseId), JSON.stringify(round));
}

/** The round left for this exercise, once; none, or a broken one, is null. */
export function takeRound(store: Storage, exerciseId: number): HearingRound | null {
	const raw = store.getItem(key(exerciseId));
	if (raw === null) return null;
	store.removeItem(key(exerciseId));
	try {
		return parseRound(JSON.parse(raw));
	} catch {
		return null;
	}
}
