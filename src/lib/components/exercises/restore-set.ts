/**
 * Undo of a deleted set: post its snapshot to the current page's `restoreSet`
 * action, as `use:enhance` would (the `x-sveltekit-action` header asks for the
 * JSON result), then reload so the set is listed again. Client-side only, like
 * `fetch-practice.ts`. Today, the figure page, the lesson page and the
 * exercise page all carry the action, so `?/restoreSet` of wherever the popup
 * is open is the right one.
 */
import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';

export async function restoreSet(snapshot: string): Promise<boolean> {
	const body = new FormData();
	body.set('snapshot', snapshot);
	let ok: boolean;
	try {
		const res = await fetch('?/restoreSet', {
			method: 'POST',
			body,
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
		});
		ok = deserialize(await res.text()).type === 'success';
	} catch {
		// Unreachable: nothing changed, nothing to reload from.
		return false;
	}
	// A refusal reloads too: the server's state wins.
	await invalidateAll();
	return ok;
}
