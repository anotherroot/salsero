import { t } from '$lib/i18n/catalog';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import { lessonAccess, songAccess } from '$lib/server/access';
import { getSong } from '$lib/server/songs';
import { recordOpen } from '$lib/server/whats-new';
import type { RequestHandler } from './$types';

/**
 * The page tells us it is shown. Recorded from the page, never from a load:
 * SvelteKit preloads a page's data on hover and touch, which is not opening it.
 * Only a group's lesson or song the person can read (a shared song, or any of
 * the group's songs for its editors); anything else is the same 404.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, t().refusals.signIn);
	const body = (await request.json().catch(() => null)) as { kind?: unknown; id?: unknown } | null;
	const id = body && typeof body.id === 'number' && Number.isInteger(body.id) ? body.id : 0;
	const kind = body?.kind;
	if ((kind !== 'lesson' && kind !== 'song' && kind !== 'comments') || id <= 0)
		throw error(400, t().refusals.badRequest);
	const db = getDb();
	if (kind === 'song') {
		const song = getSong(db, id);
		if (
			!song ||
			song.teamId === null ||
			song.archivedAt !== null ||
			!songAccess(db, user.id, song)
		) {
			throw error(404, t().refusals.noSong);
		}
		recordOpen(db, user.id, 'song', song.id, Date.now());
		return new Response(null, { status: 204 });
	}
	const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
	if (!lesson || lesson.teamId === null || lessonAccess(db, user.id, lesson) === null) {
		throw error(404, t().refusals.noLesson);
	}
	// 'comments' is the lesson's comments (item = the lesson): the same wall, the same 404.
	recordOpen(db, user.id, kind, lesson.id, Date.now());
	return new Response(null, { status: 204 });
};
