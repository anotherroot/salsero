import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { buildGraph } from '$lib/server/graph';
import { checkbox, int, text } from '$lib/server/form';
import {
	archivePosition,
	createPosition,
	listPositions,
	updatePosition
} from '$lib/server/positions';
import { positionCounts } from '$lib/graph/graph';
import { danceOf, requirePositionInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

/** A slug from a name: stable, lowercase, no spaces. */
const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'position';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const rows = listPositions(db, dance);
	const counts = positionCounts(
		buildGraph(db, dance),
		rows.map((p) => p.id)
	);
	const byId = new Map(counts.map((c) => [c.id, c]));

	return {
		positions: rows.map((p) => ({
			name: p.name,
			neutral: p.neutral,
			// `byId.get(p.id)` always carries this same row's `id` alongside its
			// counts — `counts` was built from these rows' own ids above — so the
			// spread is the only place `id` appears; listing it explicitly too
			// would just be overwritten by the spread, which `tsc` refuses to do
			// silently.
			...byId.get(p.id)!
		}))
	};
};

/** A position id from this dance, or a 404 — the wall, for every action below. */
function positionOf(params: { dance: string }, id: number | undefined) {
	const dance = danceOf(params);
	if (id === undefined) throw error(404, 'No such position');
	return requirePositionInDance(getDb(), dance, id);
}

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name', 80);
		if (!name) return fail(400, { action: 'create', message: 'Give the position a name.' });
		const made = createPosition(getDb(), dance, {
			slug: slugify(name),
			name,
			neutral: false,
			sortOrder: listPositions(getDb(), dance).length
		});
		if (!made) return fail(400, { action: 'create', message: 'That position already exists.' });
		return { action: 'create', ok: true };
	},

	rename: async ({ params, request }) => {
		const form = await request.formData();
		const found = positionOf(params, int(form, 'id'));
		const name = text(form, 'name', 80);
		if (!name) return fail(400, { action: 'rename', message: 'Give the position a name.' });
		// The slug is left alone: it is the seed's identity, not the label.
		const row = updatePosition(getDb(), found.id, {
			slug: found.slug,
			name,
			neutral: checkbox(form, 'neutral') || found.neutral,
			sortOrder: found.sortOrder
		});
		if (!row) return fail(400, { action: 'rename', message: 'That name is taken.' });
		return { action: 'rename', ok: true };
	},

	archive: async ({ params, request }) => {
		const found = positionOf(params, int(await request.formData(), 'id'));
		if (!archivePosition(getDb(), found.id, Date.now())) {
			return fail(400, {
				action: 'archive',
				message: 'The neutral position cannot be removed.'
			});
		}
		return { action: 'archive', ok: true };
	}
};
