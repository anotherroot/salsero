import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createAndLink, linkOptionsFor, parseLinkBody } from '$lib/server/link-popup';
import { linkSpot, sectionSpace, SpotLinkError } from '$lib/server/spot-links';
import { archivedTarget } from '$lib/server/changes';
import { linkSpotToPosition } from '$lib/server/position-links';
import type { RequestHandler } from './$types';

/**
 * A section's or point's links, for the Link popup. Flat like
 * `/api/video-spots`: no dance in the URL — the spot's own wall is the wall.
 * `linkOptionsFor` answers null for another person's spot, and for a group's
 * unless this person edits the group: the options list the group's drafts too
 * (a 404 here). `linkSpot` refuses a target from another dance or another
 * owner, and a point (it links positions only, `linkSpotToPosition`).
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

/**
 * `{ target }` links an existing variation, drill or position; `{ create }`
 * makes one and links it. A create refused for one of its fields answers
 * `{ message, field }`.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const id = spotId(params.id);
	const userId = locals.user!.id;
	optionsOr404(id, userId);
	const body = parseLinkBody(await request.json().catch(() => null));
	if (!body) throw error(400, 'Send a target or something to create.');
	try {
		if ('create' in body) createAndLink(getDb(), userId, id, body.create);
		else if ('positionId' in body.target) {
			// An archived position is refused as missing ("No such position.").
			linkSpotToPosition(getDb(), userId, id, body.target.positionId);
		} else {
			const target = body.target;
			// One archived since the popup opened: "Archived by Ana", Restore or pick another.
			const space = sectionSpace(getDb(), userId, id);
			const archived = space ? archivedTarget(getDb(), space, target) : null;
			if (archived) {
				const { by, message } = archived;
				return json({ message, archived: { by, restorable: true } }, { status: 410 });
			}
			linkSpot(getDb(), userId, id, target);
		}
	} catch (e) {
		if (e instanceof SpotLinkError) {
			// A refusal that names its field answers it, so the popup shows it there.
			if (e.field) return json({ message: e.message, field: e.field }, { status: e.status });
			throw error(e.status, e.message);
		}
		throw e;
	}
	return json(optionsOr404(id, userId));
};
