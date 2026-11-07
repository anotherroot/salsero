/**
 * Today's list: which exercises are on Today for a day. PURE. The day's rows
 * come from the START of the day (the schedule replayed without today's
 * sets), so doing something else first never pushes a row off.
 */
import { localDay, shiftDay } from '$lib/day/day';
import { scheduleOf, type DueState, type ScheduleSet } from './schedule';
import type { ComesBack } from './comes-back';
import type { DayPick, PickKind } from './picks';

export type { DayPick, PickKind };

export interface DayExercise {
	id: number;
	name: string;
	active: boolean;
	archived: boolean;
	createdAt: number;
	everyDays: number;
	comesBack: ComesBack;
	warmup: boolean;
	warmupOrder: number | null;
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

export type ListName = 'warmup' | 'practice';

export interface DayRow<E> {
	exercise: E;
	kind: RowKind;
	list: ListName;
	/** With today's sets. */
	state: DueState;
	/** At the start of the day. */
	start: DueState;
	neverDone: boolean;
	pick: DayPick | null;
}

export interface DayList<E> {
	today: string;
	/** Warm-ups first, in their order, then practice in today's order. */
	rows: DayRow<E>[];
	/** How many of `rows` are warm-ups. */
	warmups: number;
	/** `done`, `total` and `left` count both lists. */
	done: number;
	total: number;
	left: number;
	showNext: boolean;
	nothingLeft: { next: E; day: string; more: number } | null;
}

interface Entry<E> {
	e: E;
	state: DueState;
	start: DueState;
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
	a: { e: E; start: DueState },
	b: { e: E; start: DueState }
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
			state: scheduleOf(e.everyDays, e.createdAt, sets, e.comesBack, tz),
			start: scheduleOf(e.everyDays, e.createdAt, sets, e.comesBack, tz, today),
			firstToday: todays.length ? Math.min(...todays) : null
		});
	}
	const skipped = new Set(input.picks.filter((p) => p.kind === 'skip').map((p) => p.exerciseId));
	const live = [...entry.values()].filter((x) => x.e.active && !x.e.archived);

	// Warm-ups sit outside the daily number: they never enter the queue.
	const queue = live
		.filter((x) => !x.e.warmup && x.start.dueDay <= today && !skipped.has(x.e.id))
		.sort(byDue)
		.slice(0, Math.max(0, input.daily));
	const inQueue = new Set(queue.map((x) => x.e.id));
	const pickFor = (id: number) =>
		input.picks.find((p) => p.exerciseId === id && p.kind !== 'skip') ?? null;
	const rowOf = (x: Entry<E>, kind: RowKind, pick: DayPick | null): DayRow<E> => ({
		exercise: x.e,
		kind,
		list: x.e.warmup ? 'warmup' : 'practice',
		state: x.state,
		start: x.start,
		neverDone: x.start.lastDay === null,
		pick
	});

	const extras = [...entry.values()]
		.filter((x) => !x.e.warmup && x.firstToday !== null && !x.e.archived && !inQueue.has(x.e.id))
		.sort((a, b) => a.firstToday! - b.firstToday!);
	const picked = [...input.picks]
		.filter((p) => p.kind !== 'skip')
		.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
		.flatMap((p) => {
			const x = entry.get(p.exerciseId);
			const ok =
				x !== undefined &&
				!x.e.warmup &&
				x.e.active &&
				!x.e.archived &&
				x.firstToday === null &&
				!inQueue.has(p.exerciseId) &&
				!skipped.has(p.exerciseId);
			return ok ? [rowOf(x, 'picked', p)] : [];
		});
	// A warm-up is a row when it is due, done today or picked.
	const warmRows = [...entry.values()]
		.filter((x) => x.e.warmup && !x.e.archived)
		.flatMap((x) => {
			if (x.firstToday !== null) return [rowOf(x, 'done', pickFor(x.e.id))];
			if (!x.e.active || skipped.has(x.e.id)) return [];
			const p = pickFor(x.e.id);
			if (x.start.dueDay <= today) return [rowOf(x, 'todo', null)];
			return p ? [rowOf(x, 'picked', p)] : [];
		})
		.sort((a, b) => {
			const oa = a.exercise.warmupOrder;
			const ob = b.exercise.warmupOrder;
			if (oa !== ob) return oa === null ? 1 : ob === null ? -1 : oa - ob;
			return byDue({ e: a.exercise, start: a.start }, { e: b.exercise, start: b.start });
		});
	const all = [
		...warmRows,
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
				!x.e.warmup &&
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
	return dayListOf(workOf(input));
}

/** `dayList` of a day already worked out (the Today load shares one with Coming up). */
export function dayListOf<E extends DayExercise>(w: Worked<E>): DayList<E> {
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
		warmups: w.rows.filter((r) => r.list === 'warmup').length,
		done,
		total,
		left,
		showNext: left <= 1 && line.length > 0,
		nothingLeft
	};
}
