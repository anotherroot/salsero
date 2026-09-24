import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText } from '$lib/server/form';
import { createSongFromUrl, listSongs, retrySong } from '$lib/server/songs';
import { DANCES } from '$lib/dances/dances';
import { danceOf, requireSongInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({
	songs: listSongs(getDb(), danceOf(params))
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
	addUrl: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const raw = String(form.get('url') ?? '');
		const url = httpUrl(raw);
		const title = optionalText(form, 'title', 200);
		const style = oneOf(form, 'style', DANCES[dance].styles) ?? DANCES[dance].styles[0];
		if (!url) return fail(400, { message: 'Paste a full link, starting with https://', url: raw });
		if (title === undefined) {
			return fail(400, { message: 'Keep the title to 200 characters.', url: raw });
		}
		createSongFromUrl(getDb(), dance, { url, title: title ?? '', style });
		return { ok: true };
	},

	retry: async ({ params, request }) => {
		const dance = danceOf(params);
		const id = Number((await request.formData()).get('id'));
		// The same guard the song's own page uses. Without it this action would
		// re-queue — and, through its 409, confirm the existence of — a song on
		// the other side of the wall.
		requireSongInDance(getDb(), dance, id);
		if (!retrySong(getDb(), id))
			return fail(409, { message: 'Only a failed song can be retried.' });
		return { ok: true };
	}
};
