/**
 * The full-screen player's side of `/api/video-spots`. Every call rejects on a
 * network failure or a non-2xx answer, so the player has exactly one thing to
 * catch and never shows a spot the server did not keep.
 */
import type { Spot, SpotOwner } from '$lib/types';
import type { ClashInfo, Seen } from '$lib/clash/clash';

/**
 * A non-2xx answer, carrying the server's message — the player shows a 409's —
 * and, when the refusal names one, the field it is about (the Link popup's
 * create steps show it there).
 */
export class SpotsApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly field?: string,
		/** A 409 from the clash check: someone else saved the spot since, and theirs. */
		readonly clash?: ClashInfo
	) {
		super(message);
	}
}

export async function ok(res: Response): Promise<Response> {
	if (res.ok) return res;
	const body: unknown = await res.json().catch(() => null);
	const said = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	const message = typeof said.message === 'string' ? said.message : `video-spots: ${res.status}`;
	const field = typeof said.field === 'string' ? said.field : undefined;
	const clash =
		res.status === 409 && said.clash && typeof said.clash === 'object'
			? (said.clash as ClashInfo)
			: undefined;
	throw new SpotsApiError(res.status, message, field, clash);
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export async function fetchSpots(owner: SpotOwner): Promise<Spot[]> {
	const q =
		'recordingId' in owner
			? `recording=${owner.recordingId}`
			: `lessonVideo=${owner.lessonVideoId}`;
	return (await ok(await fetch(`/api/video-spots?${q}`))).json();
}

export async function postSpot(
	owner: SpotOwner,
	input: { startMs: number; endMs: number | null; label: string | null }
): Promise<Spot> {
	const res = await fetch('/api/video-spots', {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify({ ...owner, ...input })
	});
	return (await ok(res)).json();
}

/**
 * Only the fields given change. `seen` is what the player last set or got
 * back for this spot: a save that saw something else since is a 409 carrying
 * theirs (`SpotsApiError.clash`), and nothing is written.
 */
export async function patchSpot(
	id: number,
	changes: { label?: string | null; startMs?: number; endMs?: number | null },
	seen?: Seen
): Promise<Spot> {
	const res = await fetch(`/api/video-spots/${id}`, {
		method: 'PATCH',
		headers: JSON_HEADERS,
		body: JSON.stringify(seen ? { ...changes, seen } : changes)
	});
	return (await ok(res)).json();
}

export async function removeSpot(id: number): Promise<void> {
	await ok(await fetch(`/api/video-spots/${id}`, { method: 'DELETE' }));
}
