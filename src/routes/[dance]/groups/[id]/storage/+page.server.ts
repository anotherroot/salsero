import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { localDay } from '$lib/day/day';
import { getDb } from '$lib/server/db';
import { deleteRecording } from '$lib/server/figures';
import { lessonVideosDir, recordingsDir } from '$lib/server/files';
import { int, optionalText } from '$lib/server/form';
import { deleteLessonVideo } from '$lib/server/lessons';
import { requireTeam } from '$lib/server/scope';
import { SpotLinkedError } from '$lib/server/spot-links';
import {
	askForMore,
	listTeamStorageItems,
	openRequest,
	teamLimitBytes,
	usedBytesOf
} from '$lib/server/storage';
import { askedLine } from '$lib/storage-view';
import type { StorageItem } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/** The group, for its editors and owner: a member gets the stranger's 404. */
function teamOf(
	params: { dance: string; id: string },
	locals: App.Locals,
	need: 'editor' | 'owner'
) {
	const found = requireTeam(getDb(), locals, params, need);
	if (found.team.deletedAt !== null) throw error(404, 'No such group');
	return found;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const { team, role } = teamOf(params, locals, 'editor');
	const db = getDb();
	const asked = openRequest(db, locals.user!.id, team.id);
	return {
		team: { id: team.id, name: team.name },
		role,
		items: listTeamStorageItems(db, team.id),
		storage: {
			usedBytes: usedBytesOf(db, { teamId: team.id }),
			limitBytes: teamLimitBytes(db, team.id)
		},
		// Only the owner asks; an editor sees the numbers and the items.
		asked:
			role === 'owner' && asked ? askedLine(localDay(asked.createdAt, locals.user!.timezone)) : null
	};
};

const gone = (action: string) => fail(404, { action, message: 'That is already gone.' });

/**
 * Row first, then file. In a group the delete trashes the row and the file
 * waits for the purge (risk 19): a trash id back means the route must not unlink.
 */
async function remove(
	action: string,
	teamId: number,
	kind: StorageItem['kind'],
	form: FormData,
	del: (id: number) => { file: string; trashId: number | null } | null,
	dir: () => string
) {
	const id = int(form, 'id');
	const mine =
		id !== undefined &&
		listTeamStorageItems(getDb(), teamId).some((i) => i.kind === kind && i.id === id);
	if (!mine || id === undefined) return gone(action);
	let row;
	try {
		row = del(id);
	} catch (e) {
		if (e instanceof SpotLinkedError) return fail(409, { action, id, message: e.message });
		throw e;
	}
	if (!row) return gone(action);
	if (row.trashId === null) await unlink(join(dir(), row.file)).catch(() => {});
	return { action, ok: true, id };
}

export const actions: Actions = {
	deleteRecording: async ({ params, locals, request }) => {
		const { team } = teamOf(params, locals, 'editor');
		return remove(
			'deleteRecording',
			team.id,
			'recording',
			await request.formData(),
			(id) => deleteRecording(getDb(), id, locals.user!.id),
			recordingsDir
		);
	},

	deleteVideo: async ({ params, locals, request }) => {
		const { team } = teamOf(params, locals, 'editor');
		return remove(
			'deleteVideo',
			team.id,
			'lessonVideo',
			await request.formData(),
			(id) => deleteLessonVideo(getDb(), id, locals.user!.id),
			lessonVideosDir
		);
	},

	/** The owner asks the admin for more room for the group; one request waits at a time. */
	ask: async ({ params, locals, request }) => {
		const { team } = teamOf(params, locals, 'owner');
		const note = optionalText(await request.formData(), 'note', 500);
		if (note === undefined) return fail(400, { message: 'Keep the note under 500 characters.' });
		const res = askForMore(getDb(), { userId: locals.user!.id, teamId: team.id }, note, Date.now());
		return { asked: res === 'asked' };
	}
};
