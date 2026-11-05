import { getContext, setContext } from 'svelte';
import type { SessionControls } from '$lib/components/exercises/LogShell.svelte';

/**
 * What the (today) layout shares with the exercise page it holds (desktop spec,
 * "Today"): the list's session walks the pane, and outside a session Next after
 * a log goes to the first due one. The layout builds it with getters over its
 * own state, so the page reads it live.
 */
export interface TodayPane {
	/** The session as the pane's log form sees it, or null outside one. */
	readonly session: SessionControls | null;
	/** Outside a session: where Next goes after a log (the first due one), or null. */
	readonly follow: { name: string; onnext: () => void } | null;
	/** "Session · 2 of 5 · 1 logged so far" above Last time, or null. */
	readonly line: string | null;
	/** The pane's log form remounts when it changes (another exercise, a Skip of the last). */
	readonly key: string;
	/** A set was logged in the pane: the session's tally and walk. */
	logged(durationS: number | null): void;
	/**
	 * The page's own log popup (the phone's Log a set) is open or not: a window
	 * narrowing in a session then leaves it the only popup, never two forms with
	 * one id.
	 */
	pagePopup(on: boolean): void;
}

const KEY = Symbol('today-pane');

export function setTodayPane(p: TodayPane): void {
	setContext(KEY, p);
}

/** The (today) layout's pane controls, or null outside it. */
export function todayPane(): TodayPane | null {
	return getContext<TodayPane | undefined>(KEY) ?? null;
}
