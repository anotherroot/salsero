/**
 * The full-screen player's side of `/api/video-spots`. Every call rejects on a
 * network failure or a non-2xx answer, so the player has exactly one thing to
 * catch and never shows a spot the server did not keep.
 */
import type { Spot, SpotOwner } from '$lib/types';

async function ok(res: Response): Promise<Response> {
	if (!res.ok) throw new Error(`video-spots: ${res.status}`);
	return res;
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

export async function patchSpot(id: number, label: string | null): Promise<Spot> {
	const res = await fetch(`/api/video-spots/${id}`, {
		method: 'PATCH',
		headers: JSON_HEADERS,
		body: JSON.stringify({ label })
	});
	return (await ok(res)).json();
}

export async function removeSpot(id: number): Promise<void> {
	await ok(await fetch(`/api/video-spots/${id}`, { method: 'DELETE' }));
}
