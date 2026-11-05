import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText } from '$lib/server/form';
import { createSongFromUrl, retrySong } from '$lib/server/songs';
import { ownerOfRow, roomForOwner } from '$lib/server/storage';
import { DANCES } from '$lib/dances/dances';
import { ownerValues, requireSongAccess, type Space } from '$lib/server/scope';
import { spaceOf } from '$lib/server/group-mode';
import type { Actions } from './$types';

// The list itself loads in the layout (+layout.server.ts): it sits beside a song too.

/**
 * Room for a download into this space, charged to its owner (the person, or
 * the group in group mode). No disk floor: the bytes are not here yet, and the
 * worker checks the floor when they come.
 */
const roomIn = (space: Space) =>
	roomForOwner(getDb(), ownerOfRow(ownerValues(space)), 1, Number.POSITIVE_INFINITY);

function httpUrl(raw: string): string | null {
	try {
		const u = new URL(raw.trim());
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	addUrl: async ({ params, request, locals, cookies }) => {
		// Group mode files the song as the group's draft; the cookie is re-checked.
		const space = spaceOf(getDb(), params, locals, cookies);
		const dance = space.dance;
		const form = await request.formData();
		const raw = String(form.get('url') ?? '');
		const url = httpUrl(raw);
		const title = optionalText(form, 'title', 200);
		// A style from the other dance falls back to this dance's first; a
		// refusal hands back the one that would be filed.
		const style = oneOf(form, 'style', DANCES[dance].styles) ?? DANCES[dance].styles[0];
		// Everything typed goes back, so the sheet stays as it was.
		const kept = { url: raw, title: String(form.get('title') ?? ''), style };
		if (!url) {
			return fail(400, {
				field: 'url' as const,
				message: 'Paste a full link, starting with https://',
				...kept
			});
		}
		if (title === undefined) {
			return fail(400, {
				field: 'title' as const,
				message: 'Keep the title to 200 characters.',
				...kept
			});
		}
		// The size is unknown until the worker has it: refuse only an owner already
		// at or over the limit (one byte more would not fit); it is accepted when it lands.
		const room = roomIn(space);
		if (!room.ok) return fail(413, { field: 'url' as const, message: room.message, ...kept });
		createSongFromUrl(getDb(), space, { url, title: title ?? '', style });
		return { ok: true };
	},

	retry: async ({ params, request, locals }) => {
		const id = Number((await request.formData()).get('id'));
		// Only someone who edits the song retries it. Without the guard this
		// action would re-queue — and, through its 409, confirm the existence
		// of — a song on the other side of the wall, or a group's to a member.
		const { space } = requireSongAccess(getDb(), locals, params, id, 'edit');
		// A retry downloads again: refused at or over its owner's limit, as addUrl is.
		const room = roomIn(space);
		if (!room.ok) return fail(413, { message: room.message });
		// Not logged in History, on a group song too: a retry only re-queues the
		// worker (status), like the worker's own writes, and no field changes.
		if (!retrySong(getDb(), id))
			return fail(409, { message: 'Only a failed song can be retried.' });
		return { ok: true };
	}
};
