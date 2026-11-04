import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getLessonRow } from '$lib/server/lessons';
import { movePreview } from '$lib/server/clones/move';
import { isDanceSlug } from '$lib/dances/dances';
import type { RequestHandler } from './$types';

/**
 * The Move sheet's rows for the group picked (board C4 p3):
 * `?id=<lesson>&into=<group id>`, Copy to…'s plan and each thing of the
 * person's the lesson brings, with why and the default (`movePreview`). Flat
 * like `/api/clones/copy`: a lesson that is not the person's own, or a group
 * it cannot move to, is a 404.
 */
const id = (raw: string | null) => (raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0);

export const GET: RequestHandler = ({ url, locals }) => {
	const lessonId = id(url.searchParams.get('id'));
	const teamId = id(url.searchParams.get('into'));
	if (
		!Number.isSafeInteger(lessonId) ||
		lessonId <= 0 ||
		!Number.isSafeInteger(teamId) ||
		teamId <= 0
	)
		throw error(404, 'Not found');
	const user = locals.user!;
	const db = getDb();
	const lesson = getLessonRow(db, lessonId);
	if (!lesson || !isDanceSlug(lesson.dance)) throw error(404, 'Not found');
	const preview = movePreview(
		db,
		{ userId: user.id, dance: lesson.dance },
		lessonId,
		teamId,
		user.timezone
	);
	if (!preview) throw error(404, 'Not found');
	return json(preview);
};
