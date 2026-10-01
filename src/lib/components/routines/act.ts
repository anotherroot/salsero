/**
 * POST one of the routine page's form actions without a <form>.
 *
 * A drag, a swipe or a picker tap has no form to submit, but the actions are
 * still the one way this app mutates — so this posts to `?/<name>` exactly as
 * `use:enhance` would (the `x-sveltekit-action` and `accept` headers ask for
 * the JSON result), then does what enhance does with it: the load re-runs so
 * the server's state replaces the page's optimistic guess, and `form` is set
 * so a refusal shows under its slot.
 */
import { applyAction, deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';

export type Field = string | number | null | (string | number)[];

let resetting = false;

/**
 * True while `applyAction` is moving focus to <body>, as SvelteKit does after
 * every successful action. A blur then is not the user leaving the field — the
 * note input must not save half a sentence because an unrelated action came
 * back while it was being typed. `act` puts the focus back straight after.
 */
export const resettingFocus = () => resetting;

export async function act(name: string, fields: Record<string, Field>): Promise<ActionResult> {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) for (const v of value) body.append(key, String(v));
		else body.append(key, value === null ? '' : String(value));
	}
	let result: ActionResult;
	try {
		const res = await fetch(`?/${name}`, {
			method: 'POST',
			body,
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
		});
		result = deserialize(await res.text());
	} catch {
		result = { type: 'failure', status: 0, data: { message: 'Could not reach the server.' } };
	}
	// The load re-runs BEFORE `form` is set: re-running it after would lose the
	// message, and setting it to a success is what clears an earlier refusal
	// from under its slot, as `enhance`'s `update()` does. A refusal reloads
	// too — the slot may be gone or changed in another tab, and the server's
	// state wins. Only an unreachable server (status 0) skips it: there is
	// nothing to reload from.
	if (result.type === 'success' || (result.type === 'failure' && result.status !== 0)) {
		await invalidateAll();
	}
	// `applyAction` focuses <body> after a success (SvelteKit's `reset_focus`,
	// meant for a navigation). Here nothing navigated: a handle being moved with
	// the arrow keys, or a note being typed, keeps its focus — and its caret.
	const active = document.activeElement;
	const caret =
		active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
			? [active.selectionStart, active.selectionEnd]
			: null;
	resetting = result.type === 'success';
	try {
		await applyAction(result);
	} finally {
		resetting = false;
	}
	if (
		active instanceof HTMLElement &&
		active !== document.body &&
		active.isConnected &&
		document.activeElement !== active
	) {
		active.focus({ preventScroll: true });
		if (caret && caret[0] !== null && caret[1] !== null) {
			(active as HTMLInputElement | HTMLTextAreaElement).setSelectionRange(caret[0], caret[1]);
		}
	}
	return result;
}
