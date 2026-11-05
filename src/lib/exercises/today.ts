/**
 * What Today shows. PURE, client-safe: each row's meta line and tile, the bar
 * card's words and a past day's groups. The rows themselves, and their order,
 * are `dayList`'s (`src/lib/schedule/today-list.ts`).
 */
import { backWords, dueWords } from '$lib/schedule/words';
import type { DayList, DayRow, RowKind } from '$lib/schedule/today-list';
import type { DaySet, ExerciseItem } from '$lib/types';

export type MetaPart = { text: string; tone: 'status' | 'done' | null };

/** "Due Sunday" → "due Sunday", for after "Ahead ·" and "Added ·". */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "tomorrow", "Sunday", "14 Nov": a day ahead as the due words name it. */
function dayWords(day: string, today: string): string {
	const text = dueWords({ gap: 1, lastDay: today, dueDay: day }, today, false)[0].text;
	return text.replace(/^Due /, '');
}

/**
 * A Today row's meta: "Done · Back in a week", "New · from class Tue 3 Nov",
 * "2 days late", "Due today", "Ahead · due Sunday" (Next, before its day),
 * "Added · due tomorrow" (Coming up's +). `lessonDay`: a lesson's class day as
 * shown ("Tue 3 Nov"), null for every other type.
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
	const due = dueWords(row.start, today, row.neverDone);
	const ahead = !row.neverDone && row.start.dueDay > today;
	if (row.kind === 'picked' && row.pick?.kind === 'add') {
		const [first, ...rest] = due;
		const said = first.tone === 'status' ? first : { ...first, text: lower(first.text) };
		return [{ text: 'Added', tone: null }, said, ...rest];
	}
	if (row.kind === 'picked' && ahead) {
		return [{ text: 'Ahead', tone: null }, ...due.map((p) => ({ ...p, text: lower(p.text) }))];
	}
	if (row.neverDone && lessonDay) return [...due, { text: `from class ${lessonDay}`, tone: null }];
	return due;
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
	/** todo: the play button; done: the bar, no play; nothing: a tick, no bar. */
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
			title: `${day.left} left for today`,
			meta: `${day.done} of ${day.total} done`,
			progress: day.total > 0 ? day.done / day.total : 0,
			state: 'todo'
		};
	}
	if (day.nothingLeft) {
		return {
			title: day.done > 0 ? "You've done everything" : 'Nothing left for today',
			meta: `Every exercise is done until ${dayWords(day.nothingLeft.day, day.today)}`,
			progress: 1,
			state: 'nothing'
		};
	}
	if (day.total > 0) {
		return {
			title: `All ${day.total} done`,
			meta: "That's today's practice",
			progress: 1,
			state: 'done'
		};
	}
	return day.showNext
		? {
				title: 'Nothing due today',
				meta: 'You can practise ahead below',
				progress: 0,
				state: 'done'
			}
		: { title: 'Nothing on Today', meta: 'Every exercise is paused', progress: 0, state: 'done' };
}

/** What comes back first, once nothing is left: "Tomorrow · and 3 more", "Sunday". */
export function nothingLeftMeta(next: { day: string; more: number }, today: string): string {
	const when = dayWords(next.day, today);
	const day = when.charAt(0).toUpperCase() + when.slice(1);
	return next.more > 0 ? `${day} · and ${next.more} more` : day;
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
