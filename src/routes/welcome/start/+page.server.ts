import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getDance } from '$lib/dances/dances';
import { parseLevel } from '$lib/levels/levels';
import {
	CODE_REFUSALS,
	afterJoin,
	afterSkip,
	inviteCodeOf,
	joinStepHref
} from '$lib/levels/first-run';
import { joinWithCode } from '$lib/server/join-code';
import { setLevel } from '$lib/server/levels';
import { peopleOf, roleOf, teamByCode } from '$lib/server/teams';
import { safeNext } from '$lib/safe-next';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

/**
 * The first run (levels spec): slides, How much app?, Join your class. One
 * route; the slides and the level step are page state, the join step is
 * `?step=join` (the level is saved by then, so a reload stays where it was).
 * A person who has a level and is not on the join step is sent on, so the page
 * is never a place to get stuck.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw error(401);
	const next = safeNext(url.searchParams.get('next'));
	const joinStep = url.searchParams.get('step') === 'join' && locals.user.level !== null;
	if (locals.user.level !== null && !joinStep) throw redirect(303, next);

	let invite = null;
	if (joinStep) {
		const code = inviteCodeOf(next);
		const found = code ? teamByCode(getDb(), code) : null;
		// Another dance's group is not offered (the dance split).
		const team = found?.dance === locals.user.dance ? found : null;
		if (team) {
			const db = getDb();
			// Already in that class: nothing to ask.
			if (roleOf(db, locals.user.id, team.id) !== null) {
				throw redirect(303, afterJoin(next, getDance(team.dance).slug));
			}
			invite = {
				code: code as string,
				name: team.name,
				danceLabel: getDance(team.dance).label,
				people: peopleOf(db, team.id).length
			};
		}
	}
	return {
		next,
		step: joinStep ? ('join' as const) : ('start' as const),
		invite,
		dance: locals.user.dance
	};
};

function nextOf(form: FormData, url: URL): string {
	return safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/'));
}

export const actions: Actions = {
	level: async ({ locals, request, url }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const level = parseLevel(form.get('level'));
		if (!level) return fail(400, { message: 'Pick how much app you want.' });
		setLevel(getDb(), locals.user.id, level);
		throw redirect(303, joinStepHref(nextOf(form, url)));
	},

	join: async ({ locals, request, url }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const next = nextOf(form, url);
		// The typed code, or the teacher's link's own (`teamCode`).
		const code = String(form.get('code') || form.get('teamCode') || '').trim();
		if (!code) return fail(400, { message: CODE_REFUSALS.empty, code });
		const joined = joinWithCode(getDb(), locals.user.id, code, serverNow());
		if (!joined.ok) return fail(400, { message: CODE_REFUSALS[joined.reason], code });
		throw redirect(303, afterJoin(next, joined.dance));
	},

	skip: async ({ locals, request, url }) => {
		if (!locals.user) throw error(401);
		throw redirect(303, afterSkip(nextOf(await request.formData(), url)));
	}
};
