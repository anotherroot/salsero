/**
 * Done for today: where a run ends. The day summed up — how many, how long,
 * the warm-ups and their streak, and each other exercise done with its face
 * and when it comes back. PURE, client-safe. `today` and `timeZone` are
 * arguments; days go through `localDay`/`daysBetween`.
 */
import { daysBetween, localDay, shiftDay } from '$lib/day/day';
import { t } from '$lib/i18n/catalog';
import { feelOf, type Feel } from '$lib/schedule/feel';
import type { DueState } from '$lib/schedule/schedule';
import type { DayList } from '$lib/schedule/today-list';
import { backWords } from '$lib/schedule/words';
import type { Partner, Source as ExerciseSource } from '$lib/labels';
import type { DaySet, ExerciseItem } from '$lib/types';

export interface DoneRow {
	id: number;
	name: string;
	source: ExerciseSource;
	/** The tile's figure kind (partner or solo), as Today's row draws it. */
	partner: Partner | null;
	/** The day's last rated set's; null when none (a fixed-rhythm drill). */
	face: Feel | null;
	back: string;
}

export interface DoneView {
	/** Done rows, both lists. */
	count: number;
	/** The day's `durationS` added up. */
	seconds: number;
	/** Null when no warm-up is done today. */
	warmup: { done: number; line: string } | null;
	/** Practice done rows, in the day's order. */
	rows: DoneRow[];
}

/** Consecutive local days ending today with a set on any of `warmupIds`; 0 when today has none. */
export function warmupStreak(
	sets: readonly { exerciseId: number; doneAt: number }[],
	warmupIds: ReadonlySet<number>,
	today: string,
	timeZone: string
): number {
	const days = new Set(
		sets.filter((s) => warmupIds.has(s.exerciseId)).map((s) => localDay(s.doneAt, timeZone))
	);
	let n = 0;
	for (let d = today; days.has(d); d = shiftDay(d, -1)) n++;
	return n;
}

/** "2 done · 7 days in a row"; the streak only when ≥ 2: "1 done". */
export function warmupLine(done: number, streak: number): string {
	const w = t().today.doneToday;
	return streak >= 2 ? `${w.warmupDone(done)} · ${w.streak(streak)}` : w.warmupDone(done);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Back in 12 days", "Back tomorrow" (`backWords`); a drill that finished learning today: "Learnt · back in 3 days". */
export function backLine(row: { state: DueState; start: DueState }, today: string): string {
	const back = backWords(daysBetween(today, row.state.dueDay));
	const learnt = row.start.learning !== null && row.state.learning === null;
	return learnt ? t().today.doneToday.learnt(lowerFirst(back)) : back;
}

/** The face of an exercise's last rated set of the day, by time. */
function lastFace(sets: readonly DaySet[], exerciseId: number): Feel | null {
	let last: DaySet | null = null;
	for (const s of sets) {
		if (s.exerciseId !== exerciseId || s.rating === null) continue;
		if (last === null || s.doneAt > last.doneAt) last = s;
	}
	return last ? feelOf(last.rating) : null;
}

export function doneForToday(
	day: DayList<ExerciseItem>,
	todaySets: readonly DaySet[],
	streak: number
): DoneView {
	const done = day.rows.filter((r) => r.kind === 'done');
	const warmups = done.filter((r) => r.list === 'warmup').length;
	return {
		count: done.length,
		seconds: todaySets.reduce((sum, s) => sum + (s.durationS ?? 0), 0),
		warmup: warmups > 0 ? { done: warmups, line: warmupLine(warmups, streak) } : null,
		rows: done
			.filter((r) => r.list === 'practice')
			.map((r) => ({
				id: r.exercise.id,
				name: r.exercise.name,
				source: r.exercise.source,
				partner: r.exercise.partner,
				face: lastFace(todaySets, r.exercise.id),
				back: backLine(r, day.today)
			}))
	};
}
