import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { audioDir, lessonVideosDir, recordingsDir } from '$lib/server/files';
import { deleteRecording } from '$lib/server/figures';
import { deleteLessonVideo } from '$lib/server/lessons';
import { deleteSong } from '$lib/server/songs';
import { SpotLinkedError } from '$lib/server/spot-links';
import { int } from '$lib/server/form';
import { listStorageItems, storageOf } from '$lib/server/storage';
import type { StorageItem } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	return {
		items: listStorageItems(db, locals.user.id),
		storage: storageOf(db, locals.user.id)
	};
};

/** The id of one of THIS person's things of a kind, or a 404 shaped like every other refusal. */
function own(userId: string, kind: StorageItem['kind'], id: number | undefined) {
	const found =
		id !== undefined &&
		listStorageItems(getDb(), userId).some((i) => i.kind === kind && i.id === id);
	return found ? id : undefined;
}

const gone = (action: string) => fail(404, { action, message: 'That is already gone.' });

/** Row first, then file: an orphan file is harmless, a row pointing at nothing is not. */
async function remove(
	action: string,
	userId: string,
	kind: StorageItem['kind'],
	form: FormData,
	del: (id: number) => { file: string } | null,
	dir: () => string
) {
	const id = own(userId, kind, int(form, 'id'));
	if (id === undefined) return gone(action);
	let row;
	try {
		row = del(id);
	} catch (e) {
		if (e instanceof SpotLinkedError) return fail(409, { action, id, message: e.message });
		throw e;
	}
	if (!row) return gone(action);
	await unlink(join(dir(), row.file)).catch(() => {});
	return { action, ok: true, id };
}

export const actions: Actions = {
	deleteRecording: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		return remove(
			'deleteRecording',
			locals.user.id,
			'recording',
			await request.formData(),
			(id) => deleteRecording(getDb(), id),
			recordingsDir
		);
	},

	deleteVideo: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		return remove(
			'deleteVideo',
			locals.user.id,
			'lessonVideo',
			await request.formData(),
			(id) => deleteLessonVideo(getDb(), id),
			lessonVideosDir
		);
	},

	deleteSong: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const id = int(await request.formData(), 'id');
		const res = id === undefined ? null : deleteSong(getDb(), locals.user.id, id);
		if (!res || id === undefined) return gone('deleteSong');
		if (!res.ok) {
			return fail(409, {
				action: 'deleteSong',
				id,
				message: `Used by: ${res.usedBy.join(', ')}. Remove it there first.`
			});
		}
		if (res.file) await unlink(join(audioDir(), res.file)).catch(() => {});
		return { action: 'deleteSong', ok: true, id };
	}
};
