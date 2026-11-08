import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { audioDir, lessonVideosDir, recordingsDir } from '$lib/server/files';
import { deleteRecording } from '$lib/server/figures';
import { deleteLessonVideo } from '$lib/server/lessons';
import { deleteSong } from '$lib/server/songs';
import { SpotLinkedError } from '$lib/server/spot-links';
import { int } from '$lib/server/form';
import { listStorageItems, storageOf } from '$lib/server/storage';
import {
	flowAfter,
	rootOfRecording,
	rootOfVideo,
	type FlowRoot
} from '$lib/server/clones/flow-hook';
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

const gone = (action: string) => fail(404, { action, message: t().settings.storage.alreadyGone });

/**
 * Row first, then file: an orphan file is harmless, a row pointing at nothing
 * is not. Keep in step's flow then runs from the root the file was on
 * (`rootOf`, read before the delete).
 */
async function remove(
	action: string,
	userId: string,
	kind: StorageItem['kind'],
	form: FormData,
	del: (id: number) => { file: string; trashId: number | null } | null,
	dir: () => string,
	rootOf: (id: number) => FlowRoot | null
) {
	const id = own(userId, kind, int(form, 'id'));
	if (id === undefined) return gone(action);
	const root = rootOf(id);
	let row;
	try {
		row = del(id);
	} catch (e) {
		if (e instanceof SpotLinkedError) return fail(409, { action, id, message: e.message });
		throw e;
	}
	if (!row) return gone(action);
	// A group's file stays for Recently deleted; its purge deletes it (risk 19).
	if (row.trashId === null) await unlink(join(dir(), row.file)).catch(() => {});
	if (root) await flowAfter(userId, root.kind, root.id);
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
			(id) => deleteRecording(getDb(), id, locals.user?.id),
			recordingsDir,
			(id) => rootOfRecording(getDb(), id)
		);
	},

	deleteVideo: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		return remove(
			'deleteVideo',
			locals.user.id,
			'lessonVideo',
			await request.formData(),
			(id) => deleteLessonVideo(getDb(), id, locals.user?.id),
			lessonVideosDir,
			(id) => rootOfVideo(getDb(), id)
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
				message: res.busy
					? t().settings.storage.songBusy
					: t().settings.storage.songUsedBy(res.usedBy.join(', '))
			});
		}
		if (res.file) await unlink(join(audioDir(), res.file)).catch(() => {});
		return { action: 'deleteSong', ok: true, id };
	}
};
