import { localDay } from '$lib/day/day';

/** A logged set's day and time; `null` and 0 are untimed. */
export type TimedSet = { exerciseId: number; doneAt: number; durationS: number | null };

const DAYS = 3;

/**
 * How long an exercise usually takes: the median of its last 3 timed local
 * days, a day's durations added up (null and 0 are untimed). Two days give
 * their mean; none gives null. PURE: days are the user's, via `localDay`.
 */
export function typicalSeconds(
	sets: readonly Omit<TimedSet, 'exerciseId'>[],
	timeZone: string
): number | null {
	const perDay = new Map<string, number>();
	for (const s of sets) {
		if (!s.durationS || s.durationS <= 0) continue;
		const day = localDay(s.doneAt, timeZone);
		perDay.set(day, (perDay.get(day) ?? 0) + s.durationS);
	}
	const last = [...perDay.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.slice(-DAYS)
		.map(([, seconds]) => seconds)
		.sort((a, b) => a - b);
	if (last.length === 0) return null;
	const mid = Math.floor(last.length / 2);
	return last.length % 2 === 1 ? last[mid] : (last[mid - 1] + last[mid]) / 2;
}

/** The sum of `typicalSeconds` over `ids`; null when none of them has a timed day. */
export function runEstimate(
	sets: readonly TimedSet[],
	ids: readonly number[],
	timeZone: string
): number | null {
	const byExercise = new Map<number, TimedSet[]>();
	for (const s of sets) {
		const list = byExercise.get(s.exerciseId);
		if (list) list.push(s);
		else byExercise.set(s.exerciseId, [s]);
	}
	let total = 0;
	let any = false;
	for (const id of ids) {
		const typical = typicalSeconds(byExercise.get(id) ?? [], timeZone);
		if (typical === null) continue;
		total += typical;
		any = true;
	}
	return any ? total : null;
}
