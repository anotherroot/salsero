/**
 * What Today shows. PURE, client-safe: each row's meta line and tile, the bar
 * card's words and a past day's groups. The rows themselves, and their order,
 * are `dayList`'s (`src/lib/schedule/today-list.ts`).
 */
import { backWords, dayWords, dueWords } from '$lib/schedule/words';
import { learningWords, rhythmWords } from '$lib/schedule/comes-back';
import type { DueState } from '$lib/schedule/schedule';
import type { DayList, DayRow, RowKind } from '$lib/schedule/today-list';
import type { DaySet, ExerciseItem } from '$lib/types';

export type MetaPart = { text: string; tone: 'status' | 'done' | null };

/** "Due Sunday" → "due Sunday", for after "Ahead ·" and "Added ·". */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * A Today row's meta: "Done · Back in a week", "New · from class Tue 3 Nov",
 * "Ahead · due Sunday" (Next, before its day), "Added · due tomorrow" (Coming
 * up's +). A row due today or past its day says nothing of when it was due.
 * `lessonDay`: a lesson's class day as shown ("Tue 3 Nov"), null for every
 * other type.
 */
export function rowMeta(
	row: DayRow<ExerciseItem>,
	today: string,
	lessonDay: string | null
): MetaPart[] {
	if (row.kind === 'done') {
		return [
			{ text: 'Done', tone: 'done' },
			{ text: backWords(row.state.gap), tone: null }
		];
	}
	const neverDone = row.neverDone;
	const dueNow = !neverDone && row.start.dueDay <= today;
	const due = dueNow ? [] : dueWords(row.start, today, neverDone);
	const ahead = !neverDone && row.start.dueDay > today;
	const rhythm = rhythmOf(row.start);
	let parts: MetaPart[];
	if (row.kind === 'picked' && row.pick?.kind === 'add') {
		const [first, ...rest] = due;
		const said = first
			? first.tone === 'status'
				? first
				: { ...first, text: lower(first.text) }
			: null;
		parts = [{ text: 'Added', tone: null }, ...(said ? [said] : []), ...rest];
	} else if (row.kind === 'picked' && ahead) {
		parts = [{ text: 'Ahead', tone: null }, ...due.map((p) => ({ ...p, text: lower(p.text) }))];
	} else if (neverDone && lessonDay) {
		parts = [...due, { text: `from class ${lessonDay}`, tone: null }];
	} else parts = due;
	return rhythm ? [...parts, rhythm] : parts;
}

/** A drill's rhythm or its learning, as a meta part; null for every other row. */
function rhythmOf(state: DueState): MetaPart | null {
	if (state.every !== null) return { text: rhythmWords(state.every), tone: null };
	if (state.learning) return { text: learningWords(state.learning), tone: null };
	return null;
}

export type TileTone = 'accent' | 'quiet' | 'done';

/** A done row's tile is ticked; a to-do or picked one is the accent tile. */
export function tileTone(kind: RowKind): TileTone {
	return kind === 'done' ? 'done' : 'accent';
}

export type TodayHero = {
	title: string;
	meta: string;
	/** The bar's fill, 0 to 1. */
	progress: number;
	/** Whether the bar shows: not with nothing on Today, nor once nothing is left. */
	bar: boolean;
	/** todo: the play button; done: no play; nothing: a tick in its place. */
	state: 'todo' | 'done' | 'nothing';
};

/**
 * The bar card over Today's list: "3 left for today" · "2 of 5 done"; "All 5
 * done" · "That's today's practice" once the day's rows are done (Next brings
 * more); "You've done everything" once nothing is left to pull at all.
 */
export function todayHero(day: DayList<unknown>): TodayHero {
	if (day.left > 0) {
		return {
			title: day.done === 0 ? `${day.left} for today` : `${day.left} left for today`,
			meta: `${day.done} of ${day.total} done`,
			progress: day.total > 0 ? day.done / day.total : 0,
			bar: true,
			state: 'todo'
		};
	}
	if (day.nothingLeft) {
		const when = dayWords(day.nothingLeft.day, day.today);
		// Nothing done (everything skipped): it must not say done.
		return day.done > 0
			? {
					title: "You've done everything",
					meta: `Every exercise is done until ${when}`,
					progress: 1,
					bar: false,
					state: 'nothing'
				}
			: {
					title: 'Nothing left for today',
					meta: `The rest comes back ${when}`,
					progress: 0,
					bar: false,
					state: 'nothing'
				};
	}
	if (day.total > 0) {
		return {
			title: `All ${day.total} done`,
			meta: "That's today's practice",
			progress: 1,
			bar: true,
			state: 'done'
		};
	}
	return day.showNext
		? {
				title: 'Nothing due today',
				meta: 'You can practise ahead below',
				progress: 0,
				bar: false,
				state: 'done'
			}
		: {
				title: 'Nothing on Today',
				meta: 'Every exercise is paused',
				progress: 0,
				bar: false,
				state: 'done'
			};
}

/**
 * The two lists' labels: "Warm-up · 2" (null with no warm-ups) and "Practice · 5";
 * "Done today · 14" once nothing is left (board "Nothing left").
 */
export function listLabels(day: Pick<DayList<unknown>, 'total' | 'warmups' | 'nothingLeft'>): {
	warmup: string | null;
	practice: string;
} {
	return {
		warmup: day.warmups > 0 ? `Warm-up · ${day.warmups}` : null,
		practice: `${day.nothingLeft ? 'Done today' : 'Practice'} · ${day.total - day.warmups}`
	};
}

/** What comes back first, once nothing is left: "Tomorrow · and 3 more", "Sunday". */
export function nothingLeftMeta(next: { day: string; more: number }, today: string): string {
	const when = dayWords(next.day, today);
	const day = when.charAt(0).toUpperCase() + when.slice(1);
	return next.more > 0 ? `${day} · and ${next.more} more` : day;
}

/** The toast after a set, worded as the row: "Setenta · back in a week", "Setenta · back tomorrow". */
export function undoLogMessage(name: string, gap: number): string {
	return `${name} · ${lower(backWords(gap))}`;
}

/** A past day's sets, grouped by exercise in the order they were first done. */
export function pastGroups(
	daySets: DaySet[]
): { exerciseId: number; name: string; sets: DaySet[] }[] {
	const groups: { exerciseId: number; name: string; sets: DaySet[] }[] = [];
	for (const s of [...daySets].reverse()) {
		let g = groups.find((x) => x.exerciseId === s.exerciseId);
		if (!g) groups.push((g = { exerciseId: s.exerciseId, name: s.exerciseName, sets: [] }));
		g.sets.push(s);
	}
	return groups;
}

/**
 * A logged exercise's name once its group is purged: "Tue 3 Nov · Salsa
 * nadaljevalna (deleted)". `title` is what the entry practised (a lesson's
 * title, a routine's, a variation's or a drill's name).
 */
export function deletedGroupName(title: string, team: string): string {
	return `${title} · ${team} (deleted)`;
}
