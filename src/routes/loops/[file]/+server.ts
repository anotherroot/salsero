import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { lessonVideos, recordings, videoSpots } from '$lib/server/db/schema';
import { allows, lessonVideoAccess, recordingAccess } from '$lib/server/access';
import { loopsDir, serveFile } from '$lib/server/files';
import { catalogOf } from '$lib/i18n/catalog';
import { parseLoopName } from '$lib/video/loops';
import type { RequestHandler } from './$types';

/**
 * A figure's loop for the pickers (`<spot>-<start>-<end>.jpg`, `…-still.jpg`),
 * cut by the home worker. Behind the session guard in hooks.server.ts. Only
 * to who may read the section's video, and only for the spot's current span:
 * anything else, and a loop not cut yet, is the same 404. Cached for good,
 * since an edited span is a new name.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	// An <img> reads this, not a person: English, as the media servers' own bodies.
	const notFound = () => error(404, catalogOf('en').refusals.notFound);
	const loop = parseLoopName(params.file);
	if (!loop || !locals.user) throw notFound();
	const db = getDb();
	const spot = db.select().from(videoSpots).where(eq(videoSpots.id, loop.id)).get();
	if (!spot || spot.startMs !== loop.startMs || spot.endMs !== loop.endMs) throw notFound();
	const userId = locals.user.id;
	let readable = false;
	if (spot.lessonVideoId !== null) {
		const v = db.select().from(lessonVideos).where(eq(lessonVideos.id, spot.lessonVideoId)).get();
		readable = !!v && allows(lessonVideoAccess(db, userId, v), 'read');
	} else if (spot.recordingId !== null) {
		const r = db.select().from(recordings).where(eq(recordings.id, spot.recordingId)).get();
		readable = !!r && allows(recordingAccess(db, userId, r), 'read');
	}
	if (!readable) throw notFound();
	const res = await serveFile(join(loopsDir(), params.file), 'image/jpeg', request);
	if (res.status === 404) throw notFound();
	return res;
};
