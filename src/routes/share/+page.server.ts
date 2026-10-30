import { error } from '@sveltejs/kit';
import { SHARE_KEY_RE } from '$lib/app-mode';
import { DANCE_SLUGS, getDance } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { listLessons } from '$lib/server/lessons';
import type { PageServerLoad } from './$types';

/** How many recent lessons each dance offers; older ones are on the lessons page. */
const PER_DANCE = 30;

/**
 * A video shared to the Android app, asking its one question: which lesson?
 * The app keeps the file under `key`; each row hands the key back with the
 * lesson through `salsa://upload`. Both dances, because a share comes from
 * the gallery, which knows nothing of the wall.
 */
export const load: PageServerLoad = ({ url }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!SHARE_KEY_RE.test(key)) throw error(404, 'Nothing was shared');
	const db = getDb();
	return {
		key,
		dances: DANCE_SLUGS.map((slug) => ({
			slug,
			label: getDance(slug).label,
			lessons: listLessons(db, slug).slice(0, PER_DANCE)
		}))
	};
};
