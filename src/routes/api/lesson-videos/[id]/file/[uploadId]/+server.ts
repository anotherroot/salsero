import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { lessons, lessonVideos } from '$lib/server/db/schema';
import { t } from '$lib/i18n/catalog';
import { failJson as fail, lessonVideosDir, UPLOAD_ID_RE } from '$lib/server/files';
import { writeGate } from '$lib/server/sync/gate';
import { attachServerCopy } from '$lib/server/phone-videos';
import { finish, finishedRow, receiveChunk } from '$lib/server/chunked-upload';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/** Upload later (offline phase 4c): a phone-only lesson video's server copy, as a recording's. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || !UPLOAD_ID_RE.test(params.uploadId) || !locals.user)
		return fail(404, t().video.refusal.noVideo);
	const db = getDb();
	const name = `lv-${id}-${params.uploadId}`;
	const finished = await finishedRow(name);
	if (finished) return Response.json(finished, { status: 201 });

	const row = db
		.select({ video: lessonVideos, lesson: lessons })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(eq(lessonVideos.id, id))
		.get();
	if (
		!row ||
		row.lesson.userId !== locals.user.id ||
		row.lesson.teamId !== null ||
		row.video.serverCopy
	)
		return fail(404, t().video.refusal.noVideo);

	const got = await receiveChunk(db, request, { userId: locals.user.id }, name);
	if (got instanceof Response) return got;
	const target = join(lessonVideosDir(), row.video.file);
	await rename(got.partial, target);
	let attached;
	try {
		attached = await writeGate.shared(async () =>
			attachServerCopy(db, 'lesson_videos', id, got.size)
		);
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, t().lesson.upload.notSaved);
	}
	await writeGate.shared(() => flowAfter(locals.user?.id, 'lesson', row.lesson.id));
	return finish(name, attached);
};
