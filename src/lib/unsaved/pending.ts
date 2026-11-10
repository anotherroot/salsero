/**
 * Something on screen that leaving would throw away: a form with edits, a
 * finished run, an upload in flight. PURE types and selection; the live
 * registry is `guard.svelte.ts`.
 */

export type SaveOutcome =
	/** `moved`: the save redirected, so the page it was on is already gone. */
	| { ok: true; moved?: boolean }
	| { ok: false; message: string }
	/** The form failed its own checks and was not sent; the caller shows the browser's hint. */
	| { ok: false; invalid: HTMLFormElement };

export interface Unsaved {
	/** What the dialog calls it: "Figure edits", "Practice log". */
	label: string;
	dirty: () => boolean;
	/** Absent when there is nothing to save, only to lose (an upload). */
	save?: () => Promise<SaveOutcome>;
	/** Its save sends something (a message) rather than saving: the question says "not sent". */
	sends?: boolean;
	/** Why Save cannot run just now ("Stop the count first"), or null. */
	blocked?: () => string | null;
	/** Where it lives, so a sheet can ask about only what is inside it. */
	node?: Node;
	/**
	 * Only a real unload loses it. An upload's XHR outlives an in-app
	 * navigation — the component goes, the request does not — so only a
	 * reload or a closed tab needs to ask.
	 */
	unloadOnly?: boolean;
	/**
	 * A form whose save is out: not dirty while it sends (a save that redirects
	 * must not be stopped by its own navigation), but not settled either.
	 */
	sending?: () => boolean;
}

export function pending(
	entries: Iterable<Unsaved>,
	{ scope, unload }: { scope: Node | null; unload: boolean }
): Unsaved[] {
	const out: Unsaved[] = [];
	for (const e of entries) {
		if (e.unloadOnly && !unload) continue;
		if (scope && !(e.node && scope.contains(e.node))) continue;
		if (e.dirty()) out.push(e);
	}
	return out;
}

/** How many forms have a save out (`Unsaved.sending`). */
export function sendingCount(entries: Iterable<Unsaved>): number {
	let n = 0;
	for (const e of entries) if (e.sending?.()) n++;
	return n;
}

/** A navigation whose question was already answered (`passNext`): where it goes, and what was agreed to lose. */
export interface Pass {
	/** Path and search, as resolved. */
	href: string;
	/** The entries the user chose to lose; anything else unsaved is still asked about. */
	answered: Unsaved[];
}

/**
 * What a navigation to `to` must still ask about: everything unsaved, less what
 * the pass's question already covered when the pass is for this very move.
 */
export function stillToAsk(list: Unsaved[], pass: Pass | null, to: string | null): Unsaved[] {
	if (!pass || to !== pass.href) return list;
	return list.filter((e) => !pass.answered.includes(e));
}
