import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { allows, spotAccess } from '$lib/server/access';
import { eq } from 'drizzle-orm';
import { videoSpots } from '$lib/server/db/schema';
import { deleteSpot, SpotError, spotOwner, updateSpot } from '$lib/server/spots';
import { checkSeen, MISSING_SEEN, seesAll, spotSeen } from '$lib/server/clash';
import { asSeen, clashTitle } from '$lib/clash/clash';
import { SpotLinkedError } from '$lib/server/spot-links';
import type { RequestHandler } from './$types';

/**
 * The spot id from the path, if the signed-in person may change it (their own,
 * or a group's they edit), or a 404 — a bad id, a missing spot, another
 * person's and a group's they only read get the same answer.
 */
function spotId(raw: string, locals: App.Locals): number {
	const id = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(id) || id <= 0) throw error(404, 'No such spot');
	const userId = locals.user?.id;
	if (!userId || !allows(spotAccess(getDb(), userId, id), 'edit')) throw error(404, 'No such spot');
	return id;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const id = spotId(params.id, locals);
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Bad JSON.');
	// Only the keys sent change: a missing `label` keeps it, and `null` is how
	// a caller clears it. A body with none of the three is a bad request.
	const changes: { label?: unknown; startMs?: unknown; endMs?: unknown } = {};
	for (const key of ['label', 'startMs', 'endMs'] as const) {
		if (key in body) changes[key] = (body as Record<string, unknown>)[key];
	}
	if (Object.keys(changes).length === 0) throw error(400, 'Nothing to change.');

	// The clash check: `seen` is what the player last set or got back for this
	// spot, so a run of nudges never clashes with its own previous one. Only the
	// fields this save changes are compared: a nudge to the start does not
	// write the name someone else just gave it.
	const db = getDb();
	const sent = 'seen' in body ? asSeen((body as { seen: unknown }).seen) : null;
	const team = 'teamId' in (spotOwner(db, id) ?? { userId: '' });
	if (team && !seesAll(sent, Object.keys(changes))) throw error(400, MISSING_SEEN);
	const row = db
		.select({ label: videoSpots.label, startMs: videoSpots.startMs, endMs: videoSpots.endMs })
		.from(videoSpots)
		.where(eq(videoSpots.id, id))
		.get();
	if (!row) throw error(404, 'No such spot');
	const pick = (all: Record<string, unknown>) =>
		Object.fromEntries(
			Object.keys(changes)
				.filter((k) => k in all)
				.map((k) => [k, all[k]])
		);
	const check = checkSeen(spotSeen(row), sent === null ? null : (pick(sent) as typeof sent));
	if (!check.ok && 'changed' in check) {
		const { changed, current, by, at } = check;
		return json(
			{ message: clashTitle({ by, at }, Date.now()), clash: { changed, current, by, at } },
			{ status: 409 }
		);
	}
	try {
		const spot = updateSpot(db, id, changes);
		if (!spot) throw error(404, 'No such spot');
		return json(spot);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};

/** A linked section is a 409 whose message names what to unlink — the player shows it. */
export const DELETE: RequestHandler = ({ params, locals }) => {
	const id = spotId(params.id, locals);
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
