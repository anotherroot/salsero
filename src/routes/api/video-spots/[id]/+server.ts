import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteSpot, renameSpot, SpotError } from '$lib/server/spots';
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
	try {
		const spot = renameSpot(getDb(), id, (body as Record<string, unknown>).label);
		if (!spot) throw error(404, 'No such spot');
		return json(spot);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};

export const DELETE: RequestHandler = ({ params }) => {
	if (!deleteSpot(getDb(), spotId(params.id))) throw error(404, 'No such spot');
	return new Response(null, { status: 204 });
};
