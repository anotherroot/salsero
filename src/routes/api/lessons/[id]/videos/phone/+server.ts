import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { addPhoneLessonVideo, phoneRefusal, readPhoneVideo } from '$lib/server/phone-videos';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/** A lesson video kept only on the phone (offline phase 4c): as a recording's (`figures/[id]/recordings/phone`). */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const lessonId = Number(params.id);
	if (!locals.user || !Number.isInteger(lessonId)) throw error(404, t().lesson.upload.noLesson);
	const body = readPhoneVideo(await request.json().catch(() => null));
	if ('refused' in body) throw error(400, phoneRefusal(body.refused));
	const video = addPhoneLessonVideo(getDb(), locals.user.id, lessonId, body);
	if (!video) throw error(404, t().lesson.upload.noLesson);
	if ('refused' in video) throw error(400, phoneRefusal(video.refused));
	await flowAfter(locals.user.id, 'lesson', lessonId);
	return json(video, { status: 201 });
};
