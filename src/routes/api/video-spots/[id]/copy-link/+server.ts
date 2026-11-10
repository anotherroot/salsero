import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { linkOptionsFor } from '$lib/server/link-popup';
import { sectionSpace } from '$lib/server/spot-links';
import { isTeam } from '$lib/server/scope';
import { elsewhereGroup } from '$lib/server/elsewhere';
import { copyLinkRequest, spotLinker } from '$lib/server/link-elsewhere';
import { runCopyLink } from '$lib/server/copy-link-form';
import { flowAfter, rootOfSpot } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/**
 * Link from other places, in the Link popup: copy a row from the person's own
 * app or another group into this video's group and link this section or
 * point to the copy (`{ kind, id, use, restore? }`). The server's alone
 * (network): a copy writes many rows and files. Only on a group's video the
 * person edits; anything else is a 404. Answers the section's link options as
 * the links POST does; `{ restore }` (409) when the family's member in the
 * group is archived, for Restore and link.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const raw = params.id;
	const spotId = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(spotId) || spotId <= 0) throw error(404, t().video.refusal.noSection);
	const userId = locals.user!.id;
	const db = getDb();
	const space = sectionSpace(db, userId, spotId);
	const group =
		space && isTeam(space) ? elsewhereGroup(db, userId, space.dance, space.teamId) : null;
	if (!group || !linkOptionsFor(db, spotId, userId)) throw error(404, t().video.refusal.noSection);
	const req = copyLinkRequest(await request.json().catch(() => null));
	if (!req) throw error(400, t().links.refused.copyLink);
	const res = await runCopyLink(db, group, req, spotLinker(req.kind, group, spotId));
	if (!res.ok) {
		if ('restore' in res) return json({ restore: res.restore }, { status: 409 });
		if (res.reason === 'denied') throw error(404, t().refusals.notFound);
		const status = res.reason === 'room' ? 413 : 409;
		return json({ message: res.message ?? t().links.refused.copyLink }, { status });
	}
	// A section's links are its video's root's: Keep in step's flow runs from there.
	const root = rootOfSpot(db, spotId);
	if (root) await flowAfter(userId, root.kind, root.id);
	return json(linkOptionsFor(db, spotId, userId));
};
