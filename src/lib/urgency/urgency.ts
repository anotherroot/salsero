/**
 * What to practise next — as a pure function of (exercises, sets, now, tz).
 *
 * Urgency is NEVER stored. There is no "last done" column and no cron: every
 * request recomputes it from the sets, so changing an exercise's frequency
 * reorders the list immediately and history can never drift out of step.
 *
 * Two readings of time, deliberately different (the muscle_model rule):
 * - `urgency` uses ELAPSED time, because it is a ratio nobody reads.
 * - `lastDoneDaysAgo` and "done today" use CALENDAR days via `localDay`, because
 *   a set at 23:30 read at 07:00 was "yesterday", not "today".
 */
import { daysBetween, localDay } from '$lib/day/day';

export interface PlanExercise {
	id: number;
	name: string;
	/** Target frequency: 1 = daily, 7 = weekly. Priority is expressed as this. */
	everyDays: number;
	active: boolean;
	archived: boolean;
	createdAt: number;
}

export interface PlanSet {
	exerciseId: number;
	doneAt: number;
}

export interface PlanRow<E extends PlanExercise = PlanExercise> {
	exercise: E;
	/** Elapsed days since the last set over `everyDays`. `null` = never done. */
	urgency: number | null;
	/** Never-done counts as overdue: it is waiting to be started. */
	overdue: boolean;
	lastDoneAt: number | null;
	lastDoneDaysAgo: number | null;
	setsToday: number;
}

/**
 * The four bands the Today page reads top-down: what you have already logged,
 * what is asking to be done, what is coming, and what you have parked.
 *
 * The split between `due` and `upcoming` is the whole point of having both: a
 * list that mixes them makes "am I behind?" a question you have to compute.
 */
export interface Plan<E extends PlanExercise = PlanExercise> {
	doneToday: PlanRow<E>[];
	/** Urgency >= 1, never-done included. It is time, or past time. */
	due: PlanRow<E>[];
	/** Active, but not its turn yet. Shown, dimmed, still loggable. */
	upcoming: PlanRow<E>[];
	inactive: PlanRow<E>[];
}

const DAY_MS = 86_400_000;

const byName = (a: PlanRow, b: PlanRow) =>
	a.exercise.name.localeCompare(b.exercise.name, undefined, { sensitivity: 'base' });

/**
 * Most urgent first; never-done ahead of everything, oldest created first.
 *
 * Shared by both active bands. The never-done branch is dead weight in
 * `upcoming` — a null urgency is overdue by definition, so it always lands in
 * `due` — but one comparator that cannot drift beats two that can.
 */
const byUrgency = (a: PlanRow, b: PlanRow) => {
	if (a.urgency === null || b.urgency === null) {
		if (a.urgency !== b.urgency) return a.urgency === null ? -1 : 1;
		return a.exercise.createdAt - b.exercise.createdAt || byName(a, b);
	}
	return b.urgency - a.urgency || byName(a, b);
};

export function plan<E extends PlanExercise>(
	exercises: E[],
	sets: PlanSet[],
	now: number,
	timeZone: string
): Plan<E> {
	const today = localDay(now, timeZone);

	const last = new Map<number, number>();
	const todayCount = new Map<number, number>();
	for (const s of sets) {
		if ((last.get(s.exerciseId) ?? -Infinity) < s.doneAt) last.set(s.exerciseId, s.doneAt);
		if (localDay(s.doneAt, timeZone) === today) {
			todayCount.set(s.exerciseId, (todayCount.get(s.exerciseId) ?? 0) + 1);
		}
	}

	const out: Plan<E> = { doneToday: [], due: [], upcoming: [], inactive: [] };

	for (const exercise of exercises) {
		if (exercise.archived) continue;

		const lastDoneAt = last.get(exercise.id) ?? null;
		const urgency =
			lastDoneAt === null ? null : (now - lastDoneAt) / DAY_MS / Math.max(exercise.everyDays, 0.01);
		const row: PlanRow<E> = {
			exercise,
			urgency,
			overdue: urgency === null || urgency >= 1,
			lastDoneAt,
			lastDoneDaysAgo:
				lastDoneAt === null ? null : daysBetween(localDay(lastDoneAt, timeZone), today),
			setsToday: todayCount.get(exercise.id) ?? 0
		};

		// Order matters: a set today wins over everything, and parking an
		// exercise wins over its urgency — an inactive one is not "due".
		if (row.setsToday > 0) out.doneToday.push(row);
		else if (!exercise.active) out.inactive.push(row);
		else if (row.overdue) out.due.push(row);
		else out.upcoming.push(row);
	}

	out.doneToday.sort((a, b) => (b.lastDoneAt ?? 0) - (a.lastDoneAt ?? 0));
	out.due.sort(byUrgency);
	out.upcoming.sort(byUrgency);
	out.inactive.sort(byName);

	return out;
}
