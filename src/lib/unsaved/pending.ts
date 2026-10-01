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
