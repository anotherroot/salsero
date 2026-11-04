import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { buildGraph } from '$lib/server/graph';
import { int, text } from '$lib/server/form';
import {
	archivePosition,
	createPosition,
	getPosition,
	listPositions,
	liveNameTaken,
	restorePosition,
	updatePosition
} from '$lib/server/positions';
import { taggedFigures } from '$lib/server/graph';
import { positionCounts } from '$lib/graph/graph';
import { danceOf, requireAdmin, requirePositionInDance } from '$lib/server/scope';
import { spaceOf } from '$lib/server/group-mode';
import type { Actions, PageServerLoad } from './$types';

/** A slug from a name: stable, lowercase, no spaces. */
const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'position';

export const load: PageServerLoad = ({ params, locals, cookies }) => {
	const db = getDb();
	// The graph of whose figures: the switched-into group's, else the person's own.
	const space = spaceOf(db, params, locals, cookies);
	const dance = space.dance;
	const inGroup = 'teamId' in space;
	const rows = listPositions(db, dance);
	const counts = positionCounts(
		buildGraph(db, space),
		rows.map((p) => p.id)
	);
	const byId = new Map(counts.map((c) => [c.id, c]));

	return {
		// Positions are shared by everyone: only the admin changes them.
		isAdmin: locals.user?.isAdmin === true,
		positions: rows.map((p) => ({
			name: p.name,
			// `byId.get(p.id)` always carries this same row's `id` alongside its
			// counts — `counts` was built from these rows' own ids above — so the
			// spread is the only place `id` appears; listing it explicitly too
			// would just be overwritten by the spread, which `tsc` refuses to do
			// silently.
			...byId.get(p.id)!,
			// The gap report is hidden in group mode: nothing is flagged a dead end or orphan.
			...(inGroup ? { deadEnd: false, orphan: false } : {})
		})),
		groupMode: inGroup,
		// How much of the repertoire carries tags: the intro's first sentence.
		tagged: taggedFigures(db, space)
	};
};

/** A position id from this dance, or a 404 — the wall, for every action below. */
function positionOf(params: { dance: string }, id: number | undefined) {
	const dance = danceOf(params);
	if (id === undefined) throw error(404, 'No such position');
	return requirePositionInDance(getDb(), dance, id);
}

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		requireAdmin(locals);
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name', 80);
		if (!name)
			return fail(400, { action: 'create', field: 'name', message: 'Give the position a name.' });
		// The slug drops accents, so two names can differ in slug and still read the same.
		const taken = {
			action: 'create',
			field: 'name',
			message: 'That position already exists.',
			name
		};
		if (liveNameTaken(getDb(), dance, name)) return fail(400, taken);
		const made = createPosition(getDb(), dance, {
			slug: slugify(name),
			name,
			neutral: false,
			sortOrder: listPositions(getDb(), dance).length
		});
		if (!made) return fail(400, taken);
		return { action: 'create', ok: true };
	},

	rename: async ({ params, request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const found = positionOf(params, int(form, 'id'));
		const name = text(form, 'name', 80);
		if (!name)
			return fail(400, {
				action: 'rename',
				field: 'name',
				message: 'Give the position a name.',
				id: found.id,
				name
			});
		if (liveNameTaken(getDb(), danceOf(params), name, found.id))
			return fail(400, {
				action: 'rename',
				field: 'name',
				message: 'That name is taken.',
				id: found.id,
				name
			});
		// The slug is left alone: it is the seed's identity, not the label.
		const row = updatePosition(getDb(), found.id, {
			slug: found.slug,
			name,
			// Vestigial: nothing reads it since positions became optional.
			neutral: found.neutral,
			sortOrder: found.sortOrder
		});
		if (!row)
			return fail(400, {
				action: 'rename',
				field: 'name',
				message: 'That name is taken.',
				id: found.id,
				name
			});
		return { action: 'rename', ok: true };
	},

	archive: async ({ params, request, locals }) => {
		requireAdmin(locals);
		const found = positionOf(params, int(await request.formData(), 'id'));
		// Already removed (a double tap, another tab): nothing to do. A figure tagged
		// with it keeps its tag; that side reads as no position (fits anywhere).
		if (found.archivedAt === null) archivePosition(getDb(), found.id, Date.now());
		return { action: 'archive', ok: true };
	},

	// Undo for a removal, inside the wall like every action here. A position that
	// is already live is a replay and still a success; one whose name a live
	// position has taken meanwhile is refused, so Undo never makes a duplicate.
	restore: async ({ params, request, locals }) => {
		requireAdmin(locals);
		const found = positionOf(params, int(await request.formData(), 'id'));
		if (!restorePosition(getDb(), found.id) && getPosition(getDb(), found.id)?.archivedAt != null) {
			return fail(409, {
				action: 'restore',
				id: found.id,
				message: `Can't undo — a position called ${found.name} exists again.`
			});
		}
		return { action: 'restore', ok: true };
	}
};
