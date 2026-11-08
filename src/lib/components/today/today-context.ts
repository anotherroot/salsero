import { getContext, setContext } from 'svelte';
import type { RunPlace } from '$lib/exercises/run';

/**
 * The run as the exercise page sees it: Start on Today walks the day's
 * exercises one page after another, carried in the URL (`?run=1&skip=…`,
 * `src/lib/exercises/run.ts`). Nothing is stored: the layout's rows say what
 * is next.
 */
export interface RunControls {
	/** "3 of 7"; null when this exercise is not in the walk (done, skipped, a stale URL). */
	readonly place: RunPlace | null;
	/** The walk's next after this one; null at the end. */
	readonly next: { id: number; name: string } | null;
	/** The player's `from` from this page: "from=run&skip=…". */
	readonly playerFrom: string;
	/** On without saving (this run only): the next, or Done for today. A replace. */
	skip(): void;
	/** A save (or Not today) landed and was announced: the next, or Done for today. A replace. */
	after(): void;
}

/**
 * What the (today) layout shares with the exercise page it holds (desktop spec,
 * "Today"). The layout builds it with getters over its own state, so the page
 * reads it live.
 */
export interface TodayPane {
	/** `?run=1` on an exercise route, not a past day; else null. */
	readonly run: RunControls | null;
	/** The layout's toast, with a plain message. */
	say(message: string): void;
	/** Whether Not today applies: the exercise is a to-do or picked row on Today. */
	canSkip(exerciseId: number): boolean;
	/** Not today: posts the skip, toasts Undo; false when it was refused. */
	notToday(exerciseId: number): Promise<boolean>;
}

const KEY = Symbol('today-pane');

export function setTodayPane(p: TodayPane): void {
	setContext(KEY, p);
}

/** The (today) layout's pane controls, or null outside it. */
export function todayPane(): TodayPane | null {
	return getContext<TodayPane | undefined>(KEY) ?? null;
}
