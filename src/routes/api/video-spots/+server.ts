import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addSpot, listSpots, ownerExists, ownerFrom, SpotError } from '$lib/server/spots';
import type { RequestHandler } from './$types';

/**
 * Spots of one video, for the full-screen player.
 *
 * Flat, like the media servers that stream the same videos: there is no dance
 * in the URL to contradict, and a spot is reached only through its video's id.
 */
export const GET: RequestHandler = ({ url }) => {
	const q = url.searchParams;
	const owner = ownerFrom({
		recordingId: q.get('recording') ?? undefined,
		lessonVideoId: q.get('lessonVideo') ?? undefined
	});
	if (!owner) throw error(400, 'Name one video: ?recording= or ?lessonVideo=.');
	const db = getDb();
	if (!ownerExists(db, owner)) throw error(404, 'No such video');
	return json(listSpots(db, owner));
};

export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Bad JSON.');
	const b = body as Record<string, unknown>;
	const owner = ownerFrom({ recordingId: b.recordingId, lessonVideoId: b.lessonVideoId });
	if (!owner) throw error(400, 'Name one video: recordingId or lessonVideoId.');
	try {
		const spot = addSpot(getDb(), owner, { startMs: b.startMs, endMs: b.endMs, label: b.label });
		if (!spot) throw error(404, 'No such video');
		return json(spot, { status: 201 });
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};
