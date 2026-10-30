import { error } from '@sveltejs/kit';
import { SHARE_KEY_RE } from '$lib/app-mode';
import { getDb } from '$lib/server/db';
import { listLessons } from '$lib/server/lessons';
import { danceOf } from '$lib/server/scope';
import type { PageServerLoad } from './$types';

/** How many recent lessons it offers; older ones are a search away on the lessons page. */
const RECENT = 30;

/**
 * A video shared to a dance's Android app, asking its one question: which
 * lesson? The app keeps the file under `key`; each row hands the key back with
 * the lesson through `salsa://upload`. Only this dance's lessons: each dance is
 * its own app, with its own entry in the share sheet.
 */
export const load: PageServerLoad = ({ url, params }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!SHARE_KEY_RE.test(key)) throw error(404, 'Nothing was shared');
	return { key, lessons: listLessons(getDb(), danceOf(params)).slice(0, RECENT) };
};
