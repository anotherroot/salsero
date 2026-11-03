import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { defaultStyle } from '$lib/server/default-styles';
import { createFigure, listAddedFigures, listFigures, listVersions } from '$lib/server/figures';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { coverage } from '$lib/routines/coverage';
import { taggedFigures } from '$lib/server/graph';
import { oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER, type Partner } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { wallOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, params, locals }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const dance = wall.dance;
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
		figures: listFigures(db, wall, { ...filter, unlinked }),
		// Each group's figures from the lessons the person added, after their own.
		// Not linked is about their own figures only.
		groups: unlinked ? [] : listAddedFigures(db, wall, filter),
		// The page rebuilds its URL from these strings; `unlinked` rides as '1'.
		filter: { ...filter, q, unlinked: unlinked ? ('1' as const) : undefined },
		// Figures with no section or no lesson, whatever the filter: the header's
		// way into the "Not linked" filter, as `unrouted` is into coverage.
		unlinked: listFigures(db, wall, { unlinked: true }).length,
		// How much of the repertoire carries handhold tags. An untagged figure
		// reads as neutral, which is right for most of casino but worth surfacing:
		// the graph is only as good as this fraction.
		tagged: taggedFigures(db, wall),
		// Versions no routine can call: the Figures header's way into coverage.
		unrouted: coverage(
			listVersions(db, wall),
			routineShapes(db, wall),
			listRoutines(db, wall)
		).filter((r) => r.routines.length === 0).length,
		// What the new-figure form pre-selects. Settings picks it.
		defaultStyle: defaultStyle(db, locals.user.id, dance)
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const typed = {
			figureName: String(form.get('figureName') ?? ''),
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		// Each refusal names the field it is about, so the sheet shows it there.
		if (!figureName) {
			return fail(400, {
				field: 'figureName' as const,
				message: 'Give the figure a name (up to 200 characters).',
				...typed
			});
		}
		if (!name) {
			return fail(400, {
				field: 'name' as const,
				message: 'Give the variation a name (up to 200 characters).',
				...typed
			});
		}
		if (notes === undefined) {
			return fail(400, {
				field: 'notes' as const,
				message: 'Notes are up to 2000 characters.',
				...typed
			});
		}
		if (!partner || !style) {
			return fail(400, { message: 'Pick how it is danced and its style.', ...typed });
		}
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses.
		const made = createFigure(getDb(), wall, { figureName, name, partner, style, notes });
		if (!made) {
			return fail(400, {
				field: 'figureName' as const,
				message: `There's already a figure called ${figureName}.`,
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		throw redirect(303, `/${dance}/figures/${made.figure.id}`);
	}
};
