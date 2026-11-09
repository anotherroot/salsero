import { error, fail, redirect } from '@sveltejs/kit';
import { replayName } from '$lib/server/replay-context';
import { getDb } from '$lib/server/db';
import { createFigure, createVariationIn, getGroup, variationNameTaken } from '$lib/server/figures';
import { getPosition } from '$lib/server/positions';
import { setFigureShapeIn } from '$lib/server/graph';
import { usableBy } from '$lib/server/usable';
import { int, oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import { actorOf, inSpace, wallOf, type Space } from '$lib/server/scope';
import { spaceOf, viewOf } from '$lib/server/group-mode';
import { presetGone } from '$lib/positions/view';
import { t } from '$lib/i18n/catalog';
import type { Db } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

/** `createVariationIn`'s figure in `createFigure`'s shape: the rest reads `.figure`. */
const asMade = <T>(figure: T | null) => (figure ? { figure } : null);

/**
 * New move from a position (ruling 8): `?start=<id>` or `?end=<id>` (from a
 * position's page) tags the new figure with it. Only a position a figure of
 * `space` may be tagged with: the space's own and live, or a group's a person
 * may use (`writeFigureShape` asks the same when the form is sent). Anything
 * else is no preset: a stale link opens a plain New move.
 */
function presetOf(
	db: Db,
	space: Space,
	url: URL
): { side: 'start' | 'end'; id: number; name: string } | null {
	for (const side of ['start', 'end'] as const) {
		const raw = Number(url.searchParams.get(side) ?? '');
		if (!Number.isSafeInteger(raw) || raw <= 0) continue;
		const p = getPosition(db, raw);
		if (!p || p.archivedAt !== null || p.dance !== space.dance) return null;
		if (!inSpace(p, space) && !usableBy(db, space, 'positions', p)) return null;
		return { side, id: p.id, name: p.name };
	}
	return null;
}

export const load: PageServerLoad = ({ url, params, locals, route }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const db = getDb();
	const mode = viewOf(db, wall, locals.user?.level, { route, params, url });
	const space = mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	/** New move from a position: the tag the new figure gets (ruling 8). */
	return { preset: presetOf(db, space, url) };
};

export const actions: Actions = {
	create: async ({ params, request, locals, url }) => {
		const space = spaceOf(getDb(), params, locals, url);
		const dance = space.dance;
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		// New figure in a move that exists (the Move field picked one); else a new move.
		const groupId = int(form, 'groupId');
		let name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const typed = {
			figureName: String(form.get('figureName') ?? ''),
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		// Each refusal names the field it is about, so the sheet shows it there.
		if (groupId === undefined && !figureName) {
			return fail(400, {
				field: 'figureName' as const,
				message: t().moves.refused.moveName,
				...typed
			});
		}
		if (!name) {
			return fail(400, {
				field: 'name' as const,
				message: t().moves.refused.figureName,
				...typed
			});
		}
		if (notes === undefined) {
			return fail(400, {
				field: 'notes' as const,
				message: t().moves.refused.notes,
				...typed
			});
		}
		if (!partner || !style) {
			return fail(400, { message: t().moves.refused.partnerStyle, ...typed });
		}
		// New move from a position (ruling 8): its tag, written with the figure or not at all.
		const startId = int(form, 'start');
		const endId = int(form, 'end');
		const preset = startId !== undefined || endId !== undefined;
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses; then the tag, which `setFigureShapeIn`
		// refuses for a position the figure may not have (another person's,
		// archived since). Either refusal leaves nothing written.
		const db = getDb();
		const move = groupId === undefined ? null : getGroup(db, groupId);
		if (groupId !== undefined) {
			if (!move || move.archivedAt !== null || !inSpace(move, space)) {
				return fail(400, {
					field: 'figureName' as const,
					message: t().moves.refused.pickMove,
					...typed
				});
			}
			const moveId = move.id;
			if (name) name = replayName(name, (n) => variationNameTaken(db, moveId, n, null));
			if (variationNameTaken(db, move.id, name, null)) {
				return fail(400, {
					field: 'name' as const,
					message: t().moves.refused.figureTaken(move.name, name),
					...typed
				});
			}
		}
		const refused = new Error('preset refused');
		let made;
		try {
			made = db.transaction((tx) => {
				const m = move
					? asMade(createVariationIn(tx, move.id, { name, partner, style, notes }, actorOf(space)))
					: createFigure(tx, space, { figureName: figureName ?? '', name, partner, style, notes });
				if (!m || !preset) return m;
				const shape = {
					startIds: startId === undefined ? [] : [startId],
					endIds: endId === undefined ? [] : [endId],
					startCount: m.figure.startCount ?? DEFAULT_START_COUNT,
					lengthCounts: m.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
				};
				// Logged like an edit of the new figure, so a group's History shows the tag.
				if (setFigureShapeIn(tx, m.figure.id, shape, actorOf(space))) return m;
				// Thrown, so the figure goes back out with the transaction.
				throw refused;
			});
		} catch (e) {
			if (e !== refused) throw e;
			// The position is gone or not theirs: say so; the sheet drops it.
			return fail(400, { message: presetGone(), presetGone: true as const, ...typed });
		}
		if (!made && move) throw error(404, t().refusals.moveNotFound);
		if (!made) {
			return fail(400, {
				field: 'figureName' as const,
				message: t().moves.refused.moveTaken(figureName ?? ''),
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		throw redirect(303, `/${dance}/figures/${made.figure.id}`);
	}
};
