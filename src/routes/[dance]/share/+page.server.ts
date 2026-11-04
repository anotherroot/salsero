import { error } from '@sveltejs/kit';
import { SHARE_KEY_RE } from '$lib/app-mode';
import { getDb } from '$lib/server/db';
import { listLessons, listTeamLessons } from '$lib/server/lessons';
import { wallOf } from '$lib/server/scope';
import { listMyTeams } from '$lib/server/teams';
import type { PageServerLoad } from './$types';

/** How many recent lessons it offers; older ones are on the lessons page. */
const RECENT = 30;

/**
 * A video shared to a dance's Android app, asking its one question: which
 * lesson? The app keeps the file under `key`; each row hands the key back with
 * the lesson through `salsa://upload`. This person's lessons of this dance,
 * then the lessons of each group they edit, headed by the group — drafts
 * included, since a class video goes into a draft before it is published.
 * Each dance is its own app, with its own entry in the share sheet.
 */
export const load: PageServerLoad = ({ url, params, locals }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!SHARE_KEY_RE.test(key)) throw error(404, 'Nothing was shared');
	const db = getDb();
	const wall = wallOf(params, locals);
	const groups = listMyTeams(db, wall.userId, wall.dance)
		.filter((t) => t.role !== 'member' && t.deletedAt === null)
		.map((t) => ({
			id: t.id,
			name: t.name,
			lessons: listTeamLessons(db, wall.userId, t.id, t.role).slice(0, RECENT)
		}))
		.filter((g) => g.lessons.length > 0);
	return { key, lessons: listLessons(db, wall).slice(0, RECENT), groups };
};
