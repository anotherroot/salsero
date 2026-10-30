import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { defaultStyle } from '$lib/server/default-styles';
import { createFigure, listFigures, listVersions } from '$lib/server/figures';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { coverage } from '$lib/routines/coverage';
import { taggedFigures } from '$lib/server/graph';
import { oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER, type Partner } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, params, locals }) => {
	if (!locals.user) throw error(401);
	const dance = danceOf(params);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const style = url.searchParams.get('style');
	const partner = url.searchParams.get('partner');
	const filter = {
		q: q || undefined,
		style: (DANCES[dance].styles as readonly string[]).includes(style ?? '')
			? (style as string)
			: undefined,
		partner: (PARTNER as readonly string[]).includes(partner ?? '')
			? (partner as Partner)
			: undefined
	};
	const unlinked = url.searchParams.get('unlinked') === '1';
	const db = getDb();
	return {
		figures: listFigures(db, dance, { ...filter, unlinked }),
		// The page rebuilds its URL from these strings; `unlinked` rides as '1'.
		filter: { ...filter, q, unlinked: unlinked ? '1' : undefined },
		// Figures with no section or no lesson, whatever the filter: the header's
		// way into the "Not linked" filter, as `unrouted` is into coverage.
		unlinked: listFigures(db, dance, { unlinked: true }).length,
		// How much of the repertoire carries handhold tags. An untagged figure
		// reads as neutral, which is right for most of casino but worth surfacing:
		// the graph is only as good as this fraction.
		tagged: taggedFigures(db, dance),
		// Versions no routine can call: the Figures header's way into coverage.
		unrouted: coverage(
			listVersions(db, dance),
			routineShapes(db, dance),
			listRoutines(db, dance)
		).filter((r) => r.routines.length === 0).length,
		// What the new-figure form pre-selects. Settings picks it.
		defaultStyle: defaultStyle(db, locals.user.id, dance)
	};
};

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		if (!figureName || !name || !partner || !style || notes === undefined) {
			return fail(400, {
				message: 'Give the figure and the variation a name (up to 200 characters).',
				figureName: String(form.get('figureName') ?? ''),
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses.
		const made = createFigure(getDb(), dance, { figureName, name, partner, style, notes });
		if (!made) {
			return fail(400, {
				message: `There's already a figure called ${figureName}.`,
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		throw redirect(303, `/${dance}/figures/${made.figure.id}`);
	}
};
