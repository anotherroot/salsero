/**
 * Today's list: which exercises are on Today for a day. PURE. The day's rows
 * come from the START of the day (the schedule replayed without today's
 * sets), so doing something else first never pushes a row off.
 */
import { localDay, shiftDay } from '$lib/day/day';
import { replay, type ScheduleSet, type ScheduleState } from './schedule';
import type { DayPick, PickKind } from './picks';

export type { DayPick, PickKind };

export interface DayExercise {
	id: number;
	name: string;
	active: boolean;
	archived: boolean;
	createdAt: number;
	everyDays: number;
}

export interface DayInput<E extends DayExercise> {
	exercises: E[];
	sets: (ScheduleSet & { exerciseId: number })[];
	/** Today's picks only (next, add, skip). */
	picks: DayPick[];
	daily: number;
	now: number;
	timeZone: string;
}

export type RowKind = 'done' | 'todo' | 'picked';

export interface DayRow<E> {
	exercise: E;
	kind: RowKind;
	/** With today's sets. */
	state: ScheduleState;
	/** At the start of the day. */
	start: ScheduleState;
	neverDone: boolean;
	pick: DayPick | null;
}

export interface DayList<E> {
	today: string;
	rows: DayRow<E>[];
	done: number;
	total: number;
	left: number;
	showNext: boolean;
	nothingLeft: { next: E; day: string; more: number } | null;
}

interface Entry<E> {
	e: E;
	state: ScheduleState;
	start: ScheduleState;
	firstToday: number | null;
}

export interface Worked<E extends DayExercise> {
	today: string;
	entry: Map<number, Entry<E>>;
	rows: DayRow<E>[];
	skipped: Set<number>;
}

/** Due day, then creation, then name. */
function byDue<E extends DayExercise>(
	a: { e: E; start: ScheduleState },
	b: { e: E; start: ScheduleState }
): number {
	if (a.start.dueDay !== b.start.dueDay) return a.start.dueDay < b.start.dueDay ? -1 : 1;
	return a.e.createdAt - b.e.createdAt || a.e.name.localeCompare(b.e.name);
}

/** The day, worked out once; `dayList`, `inLine` and Coming up share it. */
export function workOf<E extends DayExercise>(input: DayInput<E>): Worked<E> {
	const tz = input.timeZone;
	const today = localDay(input.now, tz);
	const setsOf = new Map<number, ScheduleSet[]>();
	for (const s of input.sets) {
		const list = setsOf.get(s.exerciseId);
		if (list) list.push(s);
		else setsOf.set(s.exerciseId, [s]);
	}
	const entry = new Map<number, Entry<E>>();
	for (const e of input.exercises) {
		const sets = setsOf.get(e.id) ?? [];
		const todays = sets.filter((s) => localDay(s.doneAt, tz) === today).map((s) => s.doneAt);
		entry.set(e.id, {
			e,
			state: replay(e.everyDays, e.createdAt, sets, tz),
			start: replay(e.everyDays, e.createdAt, sets, tz, today),
			firstToday: todays.length ? Math.min(...todays) : null
		});
	}
	const skipped = new Set(input.picks.filter((p) => p.kind === 'skip').map((p) => p.exerciseId));
	const live = [...entry.values()].filter((x) => x.e.active && !x.e.archived);

	const queue = live
		.filter((x) => x.start.dueDay <= today && !skipped.has(x.e.id))
		.sort(byDue)
		.slice(0, Math.max(0, input.daily));
	const inQueue = new Set(queue.map((x) => x.e.id));
	const pickFor = (id: number) =>
		input.picks.find((p) => p.exerciseId === id && p.kind !== 'skip') ?? null;
	const rowOf = (x: Entry<E>, kind: RowKind, pick: DayPick | null): DayRow<E> => ({
		exercise: x.e,
		kind,
		state: x.state,
		start: x.start,
		neverDone: x.start.lastDay === null,
		pick
	});

	const extras = [...entry.values()]
		.filter((x) => x.firstToday !== null && !x.e.archived && !inQueue.has(x.e.id))
		.sort((a, b) => a.firstToday! - b.firstToday!);
	const picked = [...input.picks]
		.filter((p) => p.kind !== 'skip')
		.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
		.flatMap((p) => {
			const x = entry.get(p.exerciseId);
			const ok =
				x !== undefined &&
				x.e.active &&
				!x.e.archived &&
				x.firstToday === null &&
				!inQueue.has(p.exerciseId) &&
				!skipped.has(p.exerciseId);
			return ok ? [rowOf(x, 'picked', p)] : [];
		});
	const all = [
		...queue.filter((x) => x.firstToday !== null).map((x) => rowOf(x, 'done', pickFor(x.e.id))),
		...extras.map((x) => rowOf(x, 'done', pickFor(x.e.id))),
		...queue.filter((x) => x.firstToday === null).map((x) => rowOf(x, 'todo', null)),
		...picked
	];
	const seen = new Set<number>();
	const rows = all.filter((r) => {
		if (seen.has(r.exercise.id)) return false;
		seen.add(r.exercise.id);
		return true;
	});
	return { today, entry, rows, skipped };
}

function lineOf<E extends DayExercise>(w: Worked<E>): E[] {
	const onToday = new Set(w.rows.map((r) => r.exercise.id));
	return [...w.entry.values()]
		.filter(
			(x) =>
				x.e.active &&
				!x.e.archived &&
				x.firstToday === null &&
				!w.skipped.has(x.e.id) &&
				!onToday.has(x.e.id)
		)
		.sort(byDue)
		.map((x) => x.e);
}

/** What Next N would take, in order. */
export function inLine<E extends DayExercise>(input: DayInput<E>): E[] {
	return lineOf(workOf(input));
}

export function dayList<E extends DayExercise>(input: DayInput<E>): DayList<E> {
	const w = workOf(input);
	const done = w.rows.filter((r) => r.kind === 'done').length;
	const total = w.rows.length;
	const left = total - done;
	const line = lineOf(w);
	let nothingLeft: DayList<E>['nothingLeft'] = null;
	if (left === 0 && line.length === 0) {
		const tomorrow = shiftDay(w.today, 1);
		// What comes back soonest; a skipped one comes back tomorrow at the earliest.
		const cands = [...w.entry.values()]
			.filter((x) => x.e.active && !x.e.archived)
			.map((x) => {
				const late = w.skipped.has(x.e.id) && x.state.dueDay < tomorrow;
				return { e: x.e, start: { ...x.state, dueDay: late ? tomorrow : x.state.dueDay } };
			})
			.sort(byDue);
		if (cands.length) {
			const day = cands[0].start.dueDay;
			nothingLeft = {
				next: cands[0].e,
				day,
				more: cands.filter((c) => c.start.dueDay === day).length - 1
			};
		}
	}
	return {
		today: w.today,
		rows: w.rows,
		done,
		total,
		left,
		showNext: left <= 1 && line.length > 0,
		nothingLeft
	};
}
