import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText } from '$lib/server/form';
import { createSongFromUrl, listSongs, retrySong } from '$lib/server/songs';
import { roomFor } from '$lib/server/storage';
import { DANCES } from '$lib/dances/dances';
import { requireSongInWall, wallOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => ({
	songs: listSongs(getDb(), wallOf(params, locals))
});

function httpUrl(raw: string): string | null {
	try {
		const u = new URL(raw.trim());
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	addUrl: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
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
		// The size is unknown until the worker has it: refuse only a person already
		// at or over the limit (one byte more would not fit); it is accepted when it lands.
		const room = roomFor(getDb(), wall.userId, 1);
		if (!room.ok) return fail(413, { field: 'url' as const, message: room.message, ...kept });
		createSongFromUrl(getDb(), wall, { url, title: title ?? '', style });
		return { ok: true };
	},

	retry: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const id = Number((await request.formData()).get('id'));
		// The same guard the song's own page uses. Without it this action would
		// re-queue — and, through its 409, confirm the existence of — a song on
		// the other side of the wall.
		requireSongInWall(getDb(), wall, id);
		// A retry downloads again: refused at or over the limit, as addUrl is.
		const room = roomFor(getDb(), wall.userId, 1);
		if (!room.ok) return fail(413, { message: room.message });
		if (!retrySong(getDb(), id))
			return fail(409, { message: 'Only a failed song can be retried.' });
		return { ok: true };
	}
};
