import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createAndLink, linkOptionsFor, parseLinkBody } from '$lib/server/link-popup';
import { linkSpot, SpotLinkError } from '$lib/server/spot-links';
import type { RequestHandler } from './$types';

/**
 * A section's links, for the Link popup. Flat like `/api/video-spots`: no dance
 * in the URL — the spot's own dance is the wall, and `linkSpot` refuses a
 * target from the other one.
 */
function spotId(raw: string): number {
	const id = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(id) || id <= 0) throw error(404, 'No such section');
	return id;
}

function optionsOr404(id: number, userId: string) {
	const options = linkOptionsFor(getDb(), id, userId);
	if (!options) throw error(404, 'No such section');
	return options;
}

export const GET: RequestHandler = ({ params, locals }) =>
	json(optionsOr404(spotId(params.id), locals.user!.id));

/** `{ target }` links an existing variation or drill; `{ create }` makes one and links it. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const id = spotId(params.id);
	const userId = locals.user!.id;
	optionsOr404(id, userId);
	const body = parseLinkBody(await request.json().catch(() => null));
	if (!body) throw error(400, 'Send a target or something to create.');
	try {
		if ('target' in body) linkSpot(getDb(), id, body.target);
		else createAndLink(getDb(), id, body.create);
	} catch (e) {
		if (e instanceof SpotLinkError) throw error(e.status, e.message);
		throw e;
	}
	return json(optionsOr404(id, userId));
};
