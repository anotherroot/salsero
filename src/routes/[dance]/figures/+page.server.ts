import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { defaultStyle } from '$lib/server/default-styles';
import { createFigure, listAddedFigures, listFigures, listVersions } from '$lib/server/figures';
import { getPosition } from '$lib/server/positions';
import { writeFigureShape } from '$lib/server/graph';
import { usableBy } from '$lib/server/usable';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { coverage } from '$lib/routines/coverage';
import { int, oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER, type Partner } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import { inSpace, wallOf, type Space } from '$lib/server/scope';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { publishedReach } from '$lib/server/access';
import { storedTwinSets } from '$lib/server/twins';
import { foldMoves } from '$lib/clones/twins';
import { PRESET_GONE } from '$lib/positions/view';
import type { Db } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

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

/** The Not linked chip counts figures, as the heading does, not the moves holding them. */
const figureCount = (moves: { figures: unknown[] }[]) =>
	moves.reduce((n, m) => n + m.figures.length, 0);

export const load: PageServerLoad = ({ url, params, locals, cookies }) => {
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
	const mode = groupModeOf(db, wall.userId, dance, cookies);
	if (mode) {
		// Group mode: the group's figures only, each marked with whether members
		// reach it. Coverage is the person's own.
		const space = { dance, teamId: mode.teamId, actorId: wall.userId };
		const reach = publishedReach(db, mode.teamId);
		return {
			// Groups have no twins: nothing folds, no move says "also in".
			figures: listFigures(db, space, { ...filter, unlinked }).map((m) => ({
				...m,
				figures: m.figures.map((f) => ({ ...f, membersSee: reach.variations.has(f.id) })),
				also: [] as string[]
			})),
			groups: [],
			twinned: [] as number[],
			filter: { ...filter, q, unlinked: unlinked ? ('1' as const) : undefined },
			unlinked: figureCount(listFigures(db, space, { unlinked: true })),
			unrouted: null,
			defaultStyle: defaultStyle(db, locals.user.id, dance),
			preset: presetOf(db, space, url)
		};
	}
	// Twins show as one (board C7 p3): each set once, a group's move left
	// empty folds into the move that shows it ("also in Salsa Tuesdays").
	const folded = foldMoves(
		listFigures(db, wall, { ...filter, unlinked }),
		// Each group's figures from the lessons the person added, after their own.
		// Not linked is about their own figures only.
		unlinked ? [] : listAddedFigures(db, wall, filter),
		storedTwinSets(db, wall.userId, 'figure')
	);
	return {
		figures: folded.mine,
		groups: folded.groups,
		/** The figures that stand for their twins: the "Twins" chip. */
		twinned: [...folded.twinOf.keys()],
		// The page rebuilds its URL from these strings; `unlinked` rides as '1'.
		filter: { ...filter, q, unlinked: unlinked ? ('1' as const) : undefined },
		// Figures with no section or no lesson, whatever the filter: the header's
		// way into the "Not linked" filter, as `unrouted` is into coverage.
		unlinked: figureCount(listFigures(db, wall, { unlinked: true })),
		// Versions no routine can call: the Figures header's way into coverage.
		unrouted: coverage(
			listVersions(db, wall),
			routineShapes(db, wall),
			listRoutines(db, wall)
		).filter((r) => r.routines.length === 0).length,
		// What the new-figure form pre-selects. Settings picks it.
		defaultStyle: defaultStyle(db, locals.user.id, dance),
		/** New move from a position: the tag the new figure gets (ruling 8). */
		preset: presetOf(db, wall, url)
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const space = spaceOf(getDb(), params, locals, cookies);
		const dance = space.dance;
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
				message: 'Give the move a name (up to 200 characters).',
				...typed
			});
		}
		if (!name) {
			return fail(400, {
				field: 'name' as const,
				message: 'Give the figure a name (up to 200 characters).',
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
		// New move from a position (ruling 8): its tag, written with the figure or not at all.
		const startId = int(form, 'start');
		const endId = int(form, 'end');
		const preset = startId !== undefined || endId !== undefined;
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses; then the tag, which `writeFigureShape`
		// refuses for a position the figure may not have (another person's,
		// archived since). Either refusal leaves nothing written.
		const db = getDb();
		const refused = new Error('preset refused');
		let made;
		try {
			made = db.transaction((tx) => {
				const m = createFigure(tx, space, { figureName, name, partner, style, notes });
				if (!m || !preset) return m;
				const shape = {
					startIds: startId === undefined ? [] : [startId],
					endIds: endId === undefined ? [] : [endId],
					startCount: m.figure.startCount ?? DEFAULT_START_COUNT,
					lengthCounts: m.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
				};
				if (writeFigureShape(tx, m.figure.id, shape)) return m;
				// Thrown, so the figure goes back out with the transaction.
				throw refused;
			});
		} catch (e) {
			if (e !== refused) throw e;
			// The position is gone or not theirs: say so; the sheet drops it.
			return fail(400, { message: PRESET_GONE, presetGone: true as const, ...typed });
		}
		if (!made) {
			return fail(400, {
				field: 'figureName' as const,
				message: `There's already a move called ${figureName}.`,
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		throw redirect(303, `/${dance}/figures/${made.figure.id}`);
	}
};
