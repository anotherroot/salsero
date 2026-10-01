/**
 * POST one of the routine page's form actions without a <form>.
 *
 * A drag, a swipe or a picker tap has no form to submit, but the actions are
 * still the one way this app mutates — so this posts to `?/<name>` exactly as
 * `use:enhance` would (the `x-sveltekit-action` header asks for the JSON
 * result), then does what enhance does with it: a success re-runs the load so
 * the server's state replaces the page's optimistic guess, and a failure sets
 * `form` so the message shows under its slot.
 */
import { applyAction, deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';

export type Field = string | number | null | (string | number)[];

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
			headers: { 'x-sveltekit-action': 'true' }
		});
		result = deserialize(await res.text());
	} catch {
		result = { type: 'failure', status: 0, data: { message: 'Could not reach the server.' } };
	}
	// A success re-runs the load THEN sets `form` to the success — which is what
	// clears an earlier refusal from under its slot, as `enhance`'s `update()`
	// does. A failure only sets `form`: nothing changed, so there is nothing to
	// reload.
	if (result.type === 'success') await invalidateAll();
	await applyAction(result);
	return result;
}
