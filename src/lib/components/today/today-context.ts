import { getContext, setContext } from 'svelte';

/**
 * Start session, for now: it walks exercise pages (`?session=1`), and after a
 * save the next one opens. Plan 3's run replaces it.
 */
export interface SessionControls {
	/** On after a save: the session's next row's page (a replace), else back to Today (`backWhenSettled`). */
	onnext: () => void;
}

/**
 * What the (today) layout shares with the exercise page it holds (desktop spec,
 * "Today"). The layout builds it with getters over its own state, so the page
 * reads it live.
 */
export interface TodayPane {
	/** `?session=1` on an exercise route, not a past day; else null. */
	readonly session: SessionControls | null;
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
