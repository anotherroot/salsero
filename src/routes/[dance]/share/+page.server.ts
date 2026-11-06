import { error, fail } from '@sveltejs/kit';
import { SHARE_KEY_RE } from '$lib/app-mode';
import { getDb } from '$lib/server/db';
import { createLesson, listLessons, listTeamLessons } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { wallOf, type Space } from '$lib/server/scope';
import { listMyTeams } from '$lib/server/teams';
import { localDay } from '$lib/day/day';
import { int } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';

/** How many recent lessons it offers; older ones are on the lessons page. */
const RECENT = 30;

/** The groups this person may add a lesson to: the live ones they own or edit. */
function editedGroups(db: ReturnType<typeof getDb>, userId: string, dance: Space['dance']) {
	return listMyTeams(db, userId, dance).filter((t) => t.role !== 'member' && t.deletedAt === null);
}

/**
 * A video shared to a dance's Android app, asking its one question: which
 * lesson? The app keeps the file under `key`; each row hands the key back with
 * the lesson through `salsa://upload`. This person's lessons of this dance,
 * then the lessons of each group they edit, headed by the group — drafts
 * included, since a class video goes into a draft before it is published.
 * Each dance is its own app, with its own entry in the share sheet.
 *
 * New lesson (spec A4) makes one here, in the person's own lessons or a group
 * they edit (`places`), and the page then hands the key to the app with it.
 */
export const load: PageServerLoad = ({ url, params, locals }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!SHARE_KEY_RE.test(key)) throw error(404, 'Nothing was shared');
	if (!locals.user) throw error(401);
	const db = getDb();
	const wall = wallOf(params, locals);
	const edited = editedGroups(db, wall.userId, wall.dance);
	const groups = edited
		.map((t) => ({
			id: t.id,
			name: t.name,
			lessons: listTeamLessons(db, wall.userId, t.id, t.role).slice(0, RECENT)
		}))
		.filter((g) => g.lessons.length > 0);
	return {
		key,
		lessons: listLessons(db, wall).slice(0, RECENT),
		groups,
		places: [{ value: 0, label: 'Mine' }, ...edited.map((t) => ({ value: t.id, label: t.name }))],
		today: localDay(Date.now(), locals.user.timezone)
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		if (!locals.user) throw error(401);
		const db = getDb();
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const read = readNewLesson(form, localDay(Date.now(), locals.user.timezone));
		if ('refused' in read) return read.refused;
		const teamId = int(form, 'teamId') ?? 0;
		let space: Space = wall;
		if (teamId !== 0) {
			if (!editedGroups(db, wall.userId, wall.dance).some((t) => t.id === teamId)) {
				return fail(400, {
					action: 'create' as const,
					field: 'teamId' as const,
					message: 'Pick where it goes.',
					title: read.input.title,
					notes: read.input.notes ?? '',
					lessonDay: read.input.lessonDay
				});
			}
			space = { dance: wall.dance, teamId, actorId: wall.userId };
		}
		// A group's draft gets no drill; a person's lesson gets its review exercise.
		const { lesson } = createLesson(db, space, read.input);
		return { action: 'create' as const, ok: true, lessonId: lesson.id, title: lesson.title };
	}
};
