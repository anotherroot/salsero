import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { allows, spotAccess } from '$lib/server/access';
import { eq } from 'drizzle-orm';
import { videoSpots } from '$lib/server/db/schema';
import { deleteSpot, SpotError, spotOwner, updateSpot } from '$lib/server/spots';
import { checkSeen, MISSING_SEEN, seesAll, spotSeen } from '$lib/server/clash';
import { asSeen, clashTitle, goneTitle } from '$lib/clash/clash';
import { trashedSpot } from '$lib/server/trash';
import { SpotLinkedError } from '$lib/server/spot-links';
import { editedBy, spotRoot } from '$lib/server/changes';
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

/**
 * A save on a group's section that is in Recently deleted now: 410, naming
 * who deleted it, for that group's editors only (anyone else gets the 404).
 * Null for a spot that is not in the trash, and at once for one that is there
 * (`trashedSpot` scans the trash only for a missing spot).
 */
function trashed(raw: string, locals: App.Locals): Response | null {
	const id = /^\d+$/.test(raw) ? Number(raw) : 0;
	const userId = locals.user?.id;
	if (!userId || !Number.isSafeInteger(id) || id <= 0) return null;
	const gone = trashedSpot(getDb(), userId, id);
	if (!gone) return null;
	return json({ message: goneTitle(gone, Date.now()), gone }, { status: 410 });
}

export const PATCH: RequestHandler = (event) =>
	trashed(event.params.id, event.locals) ?? patch(event);

async function patch({ params, request, locals }: Parameters<RequestHandler>[0]) {
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
	const check = checkSeen(spotSeen(row), sent === null ? null : (pick(sent) as typeof sent), () => {
		const root = spotRoot(db, id);
		return root
			? editedBy(db, root.row.teamId, root.rootKind, root.rootId, id)
			: { by: null, at: null };
	});
	if (!check.ok && 'changed' in check) {
		const { changed, current, by, at } = check;
		return json(
			{ message: clashTitle({ by, at }, Date.now()), clash: { changed, current, by, at } },
			{ status: 409 }
		);
	}
	try {
		const spot = updateSpot(db, id, changes, locals.user?.id);
		if (!spot) throw error(404, 'No such spot');
		return json(spot);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
}

/**
 * A linked section is a 409 whose message names what to unlink — the player
 * shows it. A group's section goes to Recently deleted: `trashId` is what the
 * player's Undo restores, so the same section comes back (risk 18).
 */
export const DELETE: RequestHandler = ({ params, locals }) => {
	const answer = trashed(params.id, locals);
	if (answer) return answer;
	const id = spotId(params.id, locals);
	let gone: { trashId: number | null } | null;
	try {
		gone = deleteSpot(getDb(), id, locals.user?.id);
	} catch (e) {
		if (e instanceof SpotLinkedError) throw error(409, e.message);
		throw e;
	}
	if (!gone) throw error(404, 'No such spot');
	return json({ trashId: gone.trashId });
};
