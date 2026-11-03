import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import { lessonAccess } from '$lib/server/access';
import { recordOpen } from '$lib/server/whats-new';
import type { RequestHandler } from './$types';

/**
 * The page tells us it is shown. Recorded from the page, never from a load:
 * SvelteKit preloads a page's data on hover and touch, which is not opening it.
 * Only a group's lesson the person can read; anything else is a 404. Songs get
 * their own branch (and access check) with the group song library.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Sign in');
	const body = (await request.json().catch(() => null)) as { kind?: unknown; id?: unknown } | null;
	const id = body && typeof body.id === 'number' && Number.isInteger(body.id) ? body.id : 0;
	if (!body || body.kind !== 'lesson' || id <= 0) throw error(400, 'Bad request');
	const db = getDb();
	const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
	if (!lesson || lesson.teamId === null || lessonAccess(db, user.id, lesson) === null) {
		throw error(404, 'No such lesson');
	}
	recordOpen(db, user.id, 'lesson', lesson.id, Date.now());
	return new Response(null, { status: 204 });
};
