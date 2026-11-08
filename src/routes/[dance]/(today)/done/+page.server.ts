import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { dayInputOf } from '$lib/server/today-picks';
import { serverNow } from '$lib/server/server-clock';
import { localDay } from '$lib/day/day';
import { inLine } from '$lib/schedule/today-list';
import { warmupStreak } from '$lib/exercises/done-today';
import type { PageServerLoad } from './$types';

/**
 * Done for today: where a run ends. The day itself is the layout's (`list`:
 * `day`, `todaySets`, `daily`); this adds the warm-ups' streak and whether
 * Next N has anything to take. Reads `params` and `locals` only.
 */
export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const tz = locals.user.timezone;
	const now = serverNow();
	// `listExercises` (live ones only) and `listScheduleSets`, with today's picks.
	const input = dayInputOf(getDb(), wall, tz, now);
	const warmupIds = new Set(input.exercises.filter((e) => e.warmup).map((e) => e.id));
	return {
		streak: warmupStreak(input.sets, warmupIds, localDay(now, tz), tz),
		more: inLine(input).length > 0
	};
};
