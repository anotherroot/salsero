/** Coming up: every exercise by the day it comes back. PURE. */
import { awayWords } from './words';
import { learningWords, rhythmWords } from './comes-back';
import type { DueState } from './schedule';
import { workOf, type DayExercise, type DayInput, type Worked } from './today-list';

export type ComingRowState = 'add' | 'onToday' | 'doneToday' | 'skipped' | 'paused';

export interface ComingGroup<E> {
	/** 'waiting' | 'paused' | 'YYYY-MM-DD' */
	key: string;
	day: string | null;
	away: string | null;
	rows: { exercise: E; state: ComingRowState; dueDay: string | null; meta: string | null }[];
}

interface Item<E> {
	e: E;
	state: ComingRowState;
	dueDay: string | null;
	meta: string | null;
}

/**
 * A row's second line: a warm-up says so (with its rhythm, in lower case),
 * a drill its rhythm or how far its learning is; else nothing.
 */
export function comingMeta(e: Pick<DayExercise, 'warmup'>, state: DueState): string | null {
	const rhythm = state.every !== null ? rhythmWords(state.every) : null;
	if (e.warmup) return rhythm ? `Warm-up · ${rhythm.toLowerCase()}` : 'Warm-up';
	if (rhythm) return rhythm;
	if (state.learning) return learningWords(state.learning);
	return null;
}

export function comingUp<E extends DayExercise>(input: DayInput<E>): ComingGroup<E>[] {
	return comingUpOf(workOf(input));
}

/** `comingUp` of a day already worked out (the Today load shares one with the list). */
export function comingUpOf<E extends DayExercise>(w: Worked<E>): ComingGroup<E>[] {
	const onToday = new Map(w.rows.map((r) => [r.exercise.id, r]));
	const waiting: Item<E>[] = [];
	const paused: Item<E>[] = [];
	const byDay = new Map<string, Item<E>[]>();
	const put = (day: string, item: Item<E>) => byDay.set(day, [...(byDay.get(day) ?? []), item]);

	for (const x of w.entry.values()) {
		if (x.e.archived) continue;
		if (!x.e.active) {
			paused.push({ e: x.e, state: 'paused', dueDay: null, meta: comingMeta(x.e, x.state) });
			continue;
		}
		const row = onToday.get(x.e.id);
		if (row) {
			// On Today: it shows under the day it comes back, if that is ahead.
			const dueDay = x.state.dueDay;
			if (dueDay > w.today)
				put(dueDay, {
					e: x.e,
					state: row.kind === 'done' ? 'doneToday' : 'onToday',
					dueDay,
					meta: comingMeta(x.e, x.state)
				});
		} else {
			// Skipped today (Not today): "Not today", and its + takes the skip away.
			const item: Item<E> = {
				e: x.e,
				state: w.skipped.has(x.e.id) ? 'skipped' : 'add',
				dueDay: x.start.dueDay,
				meta: comingMeta(x.e, x.start)
			};
			// A due warm-up is on Today, not waiting; a skipped one stays here for its +.
			if (x.start.dueDay <= w.today) {
				if (!x.e.warmup || item.state === 'skipped') waiting.push(item);
			} else put(x.start.dueDay, item);
		}
	}

	const sorted = (items: Item<E>[]) =>
		[...items]
			.sort(
				(a, b) =>
					(a.dueDay ?? '').localeCompare(b.dueDay ?? '') ||
					a.e.createdAt - b.e.createdAt ||
					a.e.name.localeCompare(b.e.name)
			)
			.map((i) => ({ exercise: i.e, state: i.state, dueDay: i.dueDay, meta: i.meta }));

	const groups: ComingGroup<E>[] = [];
	if (waiting.length) groups.push({ key: 'waiting', day: null, away: null, rows: sorted(waiting) });
	for (const day of [...byDay.keys()].sort())
		groups.push({ key: day, day, away: awayWords(w.today, day), rows: sorted(byDay.get(day)!) });
	if (paused.length) groups.push({ key: 'paused', day: null, away: null, rows: sorted(paused) });
	return groups;
}
