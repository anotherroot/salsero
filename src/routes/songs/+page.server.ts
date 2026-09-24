import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText } from '$lib/server/form';
import { createSongFromUrl, listSongs, retrySong } from '$lib/server/songs';
// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
import { DANCES } from '$lib/dances/dances';
import type { Actions, PageServerLoad } from './$types';

// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
export const load: PageServerLoad = () => ({ songs: listSongs(getDb(), 'salsa') });

function httpUrl(raw: string): string | null {
	try {
		const u = new URL(raw.trim());
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	addUrl: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('url') ?? '');
		const url = httpUrl(raw);
		const title = optionalText(form, 'title', 200);
		// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
		const style = oneOf(form, 'style', DANCES.salsa.styles) ?? 'salsa';
		if (!url) return fail(400, { message: 'Paste a full link, starting with https://', url: raw });
		if (title === undefined) {
			return fail(400, { message: 'Keep the title to 200 characters.', url: raw });
		}
		// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
		createSongFromUrl(getDb(), 'salsa', { url, title: title ?? '', style });
		return { ok: true };
	},

	retry: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!retrySong(getDb(), id))
			return fail(409, { message: 'Only a failed song can be retried.' });
		return { ok: true };
	}
};
