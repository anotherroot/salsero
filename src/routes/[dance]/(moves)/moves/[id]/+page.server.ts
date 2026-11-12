import { error, fail, redirect } from '@sveltejs/kit';
import { replayName } from '$lib/server/replay-context';
import { getDb } from '$lib/server/db';
import { requireMoveAccess, wallOf } from '$lib/server/scope';
import { groupModeFor } from '$lib/server/group-mode';
import { mergedMoveRows } from '$lib/server/moves-lists';
import { copyCounts } from '$lib/server/clones/step';
import { teamRefs } from '$lib/server/usable';
import {
	createVariationIn,
	figureNameTaken,
	listGroupVariations,
	listFigures,
	renameFigure,
	variationNameTaken
} from '$lib/server/figures';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { taughtIn } from '$lib/server/lessons';
import { text } from '$lib/server/form';
import { seenRefusal, moveSeen } from '$lib/server/clash';
import { editedBy } from '$lib/server/changes';
import { defaultStyle } from '$lib/server/default-styles';
import { usedInMeta } from '$lib/moves/move-page';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';
import { optionSlots } from '$lib/routines/routines';

const moveTaken = (name: string) => t().moves.refused.moveTaken(name);

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const { move, space, access, reach } = requireMoveAccess(db, locals, params, params.id, 'read');
	// A reader's lists hold only what the published lessons reach.
	const figures =
		listFigures(db, space, reach ? { only: reach.variations } : {}).find((m) => m.id === move.id)
			?.figures ?? [];
	const nameOf = new Map(figures.map((f) => [f.id, f.name]));

	const usedIn: { kind: 'routine' | 'lesson'; id: number; name: string; meta: string }[] = [];
	const shapes = routineShapes(db, space);
	for (const r of listRoutines(db, space)) {
		if (reach && !reach.routines.has(r.id)) continue;
		const shape = shapes.get(r.id);
		if (!shape) continue;
		const used: string[] = [];
		for (const slot of shape.slots) {
			for (const s of optionSlots(slot)) {
				for (const fid of s.figureIds) {
					const n = nameOf.get(fid);
					if (n !== undefined && !used.includes(n)) used.push(n);
				}
			}
		}
		if (used.length > 0) {
			usedIn.push({ kind: 'routine', id: r.id, name: r.name, meta: usedInMeta('routine', used) });
		}
	}
	const taught = new Map<number, { id: number; title: string; lessonDay: string }>();
	for (const f of figures) {
		for (const l of taughtIn(db, space, f.id)) {
			if (!reach || reach.lessons.has(l.id)) taught.set(l.id, l);
		}
	}
	[...taught.values()]
		.sort((a, b) => (a.lessonDay < b.lessonDay ? 1 : a.lessonDay > b.lessonDay ? -1 : b.id - a.id))
		.forEach((l) =>
			usedIn.push({ kind: 'lesson', id: l.id, name: l.title, meta: usedInMeta('lesson', []) })
		);

	// The figures as the Figures list shows this move (`mergedMoveRows`): the
	// person's own and the added groups' of the same name, each group's marked,
	// a copy or a twin set one row with its chip. In this group's own workspace
	// (read-only on the cookie: a load never sets or deletes it) the group's alone.
	const wall = wallOf(params, locals);
	const inGroupMode =
		groupModeFor(db, wall.userId, wall.dance, move.teamId, locals.user?.level) !== null;
	const team = move.teamId === null ? null : (teamRefs(db, [move.teamId]).get(move.teamId) ?? null);
	const merged = mergedMoveRows(
		db,
		wall,
		{ name: move.name, teamId: move.teamId },
		figures,
		listGroupVariations(db, move.id).map((f) => f.id),
		!inGroupMode,
		team
	);
	const copies = copyCounts(
		db,
		wall.userId,
		'figure',
		merged.rows.map((f) => f.id)
	);

	return {
		move: { id: move.id, name: move.name },
		figures: merged.rows.map((f) => ({
			...f,
			copies: copies.get(f.id) ?? 0,
			twins: merged.twinned.has(f.id)
		})),
		usedIn,
		canEdit: access === 'edit',
		// What the rename form saw (the clash check).
		seen: moveSeen(db, move.id)
	};
};

export const actions: Actions = {
	/** Rename the move. A group's carries `seen`, as the figure page's name does. */
	rename: async ({ params, request, locals }) => {
		const db = getDb();
		const { move, space } = requireMoveAccess(db, locals, params, params.id, 'edit');
		const form = await request.formData();
		const typed = String(form.get('name') ?? '');
		let name = text(form, 'name');
		if (!name) {
			return fail(400, {
				action: 'rename' as const,
				field: 'name' as const,
				message: t().moves.refused.moveName,
				name: typed
			});
		}
		const clash = seenRefusal(
			form,
			{ team: move.teamId !== null, copies: false },
			moveSeen(db, move.id),
			{ action: 'rename' as const },
			serverNow(),
			() => editedBy(db, move.teamId, 'figure', move.id)
		);
		if (clash) return clash;
		if (name) name = replayName(name, (n) => figureNameTaken(db, space, n, move.id));
		if (figureNameTaken(db, space, name, move.id)) {
			return fail(400, {
				action: 'rename' as const,
				field: 'name' as const,
				message: moveTaken(name),
				name: typed
			});
		}
		if (!renameFigure(db, move.id, name, wallOf(params, locals).userId)) {
			return fail(400, {
				action: 'rename' as const,
				field: 'name' as const,
				message: moveTaken(name),
				name: typed
			});
		}
		return { action: 'rename' as const, ok: true };
	},

	/** A blank figure in this move, in the style and way of dancing of its first; opened. */
	createFigure: async ({ params, request, locals }) => {
		const db = getDb();
		const { move, space } = requireMoveAccess(db, locals, params, params.id, 'edit');
		const form = await request.formData();
		const typed = String(form.get('name') ?? '');
		let name = text(form, 'name');
		if (!name) {
			return fail(400, {
				action: 'createFigure' as const,
				field: 'name' as const,
				message: t().moves.refused.figureName,
				name: typed
			});
		}
		name = replayName(name, (n) => variationNameTaken(db, move.id, n, null));
		if (variationNameTaken(db, move.id, name, null)) {
			return fail(400, {
				action: 'createFigure' as const,
				field: 'name' as const,
				message: t().moves.refused.figureTaken(move.name, name),
				name: typed
			});
		}
		const base = listGroupVariations(db, move.id)[0];
		const userId = wallOf(params, locals).userId;
		const made = createVariationIn(
			db,
			move.id,
			{
				name,
				partner: base?.partner ?? 'partner',
				style: base?.styleTag ?? defaultStyle(db, userId, space.dance),
				notes: null
			},
			userId
		);
		if (!made) throw error(404, t().refusals.moveNotFound);
		throw redirect(303, `/${space.dance}/figures/${made.id}`);
	}
};
