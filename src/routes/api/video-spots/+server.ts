import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { allows, judgeVideo } from '$lib/server/access';
import { addSpot, listSpots, ownerFrom, SpotError } from '$lib/server/spots';
import type { SpotOwner } from '$lib/types';
import { flowAfter, rootOfRecording, rootOfVideo } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/**
 * Spots of one video, for the full-screen player.
 *
 * Flat, like the media servers that stream the same videos: there is no dance
 * in the URL to contradict, and a spot is reached only through its video's id.
 * The person and their groups are the wall: listing needs read on the video,
 * adding needs edit, and another person's video, a group's draft and a missing
 * one are the same 404.
 */
function requireVideo(video: SpotOwner, locals: App.Locals, need: 'read' | 'edit') {
	const userId = locals.user?.id;
	const judged = userId ? judgeVideo(getDb(), userId, video) : null;
	if (!judged || !allows(judged.access, need)) throw error(404, t().video.refusal.noVideo);
	return judged;
}

export const GET: RequestHandler = ({ url, locals }) => {
	const q = url.searchParams;
	const owner = ownerFrom({
		recordingId: q.get('recording') ?? undefined,
		lessonVideoId: q.get('lessonVideo') ?? undefined
	});
	if (!owner) throw error(400, t().refusals.spots.nameVideoQuery);
	// A reader of a group's video sees only the links to what they can reach (risk 20).
	const { reach } = requireVideo(owner, locals, 'read');
	return json(listSpots(getDb(), owner, reach ?? undefined));
};

/** Adds a section or point; Keep in step's flow then runs from the video's root. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body))
		throw error(400, t().refusals.badJson);
	const b = body as Record<string, unknown>;
	const owner = ownerFrom({ recordingId: b.recordingId, lessonVideoId: b.lessonVideoId });
	if (!owner) throw error(400, t().refusals.spots.nameVideoBody);
	requireVideo(owner, locals, 'edit');
	let spot;
	try {
		spot = addSpot(
			getDb(),
			owner,
			{ startMs: b.startMs, endMs: b.endMs, label: b.label },
			locals.user?.id
		);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
	if (!spot) throw error(404, t().video.refusal.noVideo);
	const root =
		'recordingId' in owner
			? rootOfRecording(getDb(), owner.recordingId)
			: rootOfVideo(getDb(), owner.lessonVideoId);
	if (root) await flowAfter(locals.user?.id, root.kind, root.id);
	return json(spot, { status: 201 });
};
