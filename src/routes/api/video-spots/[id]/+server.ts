import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteSpot, SpotError, updateSpot } from '$lib/server/spots';
import { SpotLinkedError } from '$lib/server/spot-links';
import type { RequestHandler } from './$types';

/** The spot id from the path, or a 404 — a bad id and a missing spot get the same answer. */
function spotId(raw: string): number {
	const id = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(id) || id <= 0) throw error(404, 'No such spot');
	return id;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = spotId(params.id);
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Bad JSON.');
	// Only the keys sent change: a missing `label` keeps it, and `null` is how
	// a caller clears it. A body with none of the three is a bad request.
	const changes: { label?: unknown; startMs?: unknown; endMs?: unknown } = {};
	for (const key of ['label', 'startMs', 'endMs'] as const) {
		if (key in body) changes[key] = (body as Record<string, unknown>)[key];
	}
	if (Object.keys(changes).length === 0) throw error(400, 'Nothing to change.');
	try {
		const spot = updateSpot(getDb(), id, changes);
		if (!spot) throw error(404, 'No such spot');
		return json(spot);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};

/** A linked section is a 409 whose message names what to unlink — the player shows it. */
export const DELETE: RequestHandler = ({ params }) => {
	const id = spotId(params.id);
	let gone: boolean;
	try {
		gone = deleteSpot(getDb(), id);
	} catch (e) {
		if (e instanceof SpotLinkedError) throw error(409, e.message);
		throw e;
	}
	if (!gone) throw error(404, 'No such spot');
	return new Response(null, { status: 204 });
};
