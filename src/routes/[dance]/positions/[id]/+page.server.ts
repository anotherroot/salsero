import { error, fail } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { figures } from '$lib/server/db/schema';
import { buildGraph, canonicalOf } from '$lib/server/graph';
import { figureById, figuresFrom, figuresTo, positionCounts } from '$lib/graph/graph';
import { through } from '$lib/routines/routines';
import {
	positionsFrom,
	positionSummary,
	restorePositionIn,
	updatePosition,
	archivePosition
} from '$lib/server/positions';
import { figureLabels } from '$lib/server/figures';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { spotsOfPosition, positionTaughtIn } from '$lib/server/position-links';
import { teamRefs, usableOf } from '$lib/server/usable';
import { getTeam } from '$lib/server/teams';
import { inGroupModeOn } from '$lib/server/group-mode';
import { inSpace, isTeam, requirePositionAccess, wallOf, type Space } from '$lib/server/scope';
import { int, optionalText } from '$lib/server/form';
import { positionSeen, seenRefusal } from '$lib/server/clash';
import { editedBy } from '$lib/server/changes';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import {
	copyToFrom,
	detachFrom,
	dropFrom,
	sameAsFrom,
	sendFrom,
	separateFrom,
	takeFrom
} from '$lib/server/take-form';
import { pageSources } from '$lib/server/clones/sources';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { dropOptions } from '$lib/server/clones/drop';
import { sameAsOffer } from '$lib/server/twins';
import { DANCES } from '$lib/dances/dances';
import { parseHold } from '$lib/positions/hold';
import { styleLabelOf } from '$lib/positions/view';
import type { Actions, PageServerLoad } from './$types';

/** The position this URL names, or a 404: another person's, another dance's, a draft's. */
const positionIn = (
	params: { dance: string; id: string },
	locals: App.Locals,
	need: 'read' | 'edit'
) => requirePositionAccess(getDb(), locals, params, params.id, need);

export const load: PageServerLoad = ({ params, url, locals, cookies }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	const { position, space, access, reach } = positionIn(params, locals, 'read');
	const id = position.id;
	const canEdit = access === 'edit';
	// In the group's own workspace the page is the group's: its graph, no twins.
	const inGroupMode = inGroupModeOn(db, wall.userId, wall.dance, position.teamId, cookies);
	const groupTeam =
		position.teamId === null
			? null
			: (teamRefs(db, [position.teamId]).get(position.teamId) ?? null);

	// The graph is the viewer's (ruling 14): a person's own figures and the
	// group figures they may use, or the group's in its own workspace. This
	// position joins it even when no figure of theirs uses it yet, so its family
	// maps onto it (canonicalOf).
	const viewer: Space = inGroupMode ? space : wall;
	const usable = isTeam(viewer) ? undefined : usableOf(db, viewer);
	const graph = buildGraph(
		db,
		viewer,
		usable ? { figures: usable.figures, positions: new Set([...usable.positions, id]) } : undefined
	);
	const canon = canonicalOf(graph, id);
	const [counts] = positionCounts(graph, [canon]);

	// Rows of figures: their label, their type (or their group's name), and the
	// positions they come from or go to, each with its type when it is not this one's.
	const styleLabel = styleLabelOf(DANCES[wall.dance].styleLabel);
	const named = new Map(graph.positions.map((p) => [p.id, p]));
	const nameOf = (pid: number) => {
		const p = named.get(pid);
		if (!p) return null;
		return p.styleTag === position.styleTag ? p.name : `${p.name}, ${styleLabel(p.styleTag)}`;
	};
	const names = (ids: number[]) =>
		ids
			.flatMap((pid) => nameOf(pid) ?? [])
			.sort((a, b) => a.localeCompare(b))
			.filter((n, i, all) => all.indexOf(n) === i);
	const fromIds = figuresFrom(graph, canon);
	const intoIds = figuresTo(graph, canon);
	const shown = [...new Set([...fromIds, ...intoIds])];
	const rows = new Map(
		(shown.length === 0
			? []
			: db
					.select({ id: figures.id, styleTag: figures.styleTag, teamId: figures.teamId })
					.from(figures)
					.where(inArray(figures.id, shown))
					.all()
		).map((f) => [f.id, f])
	);
	const teams = teamRefs(
		db,
		[...rows.values()].flatMap((f) => (f.teamId === null ? [] : [f.teamId]))
	);
	const labels = figureLabels(db, viewer, usable);
	// A group's figure seen from a person's app reads as the group's; in the
	// group's own workspace every figure is the group's, so none says so.
	const teamOf = (fid: number) => {
		const t = rows.get(fid)?.teamId ?? null;
		return t === null || isTeam(viewer) ? null : (teams.get(t)?.name ?? null);
	};
	const figureRow = (fid: number) => ({
		id: fid,
		label: labels.get(fid) ?? '',
		team: teamOf(fid)
	});
	const from = fromIds.map((fid) => ({
		...figureRow(fid),
		style: inGroupMode ? '' : styleLabel(rows.get(fid)?.styleTag ?? null),
		ends: names(figureById(graph, fid)?.ends ?? [])
	}));
	const into = intoIds.map((fid) => ({
		...figureRow(fid),
		style: '',
		starts: names(figureById(graph, fid)?.starts ?? [])
	}));

	// The viewer's routines whose hands pass through it, with the slots (1-based).
	const shapes = routineShapes(db, viewer, { usable, extra: usable?.routines });
	const routines = listRoutines(db, viewer).flatMap((r) => {
		const pairs = through(graph, shapes.get(r.id) ?? { slots: [] }, canon);
		return pairs.length === 0
			? []
			: [
					{
						id: r.id,
						name: r.name,
						pairs: pairs.map(([a, b]) => [a + 1, b + 1] as [number, number])
					}
				];
	});

	// Video: the owner's sections and points (a reader's only what lessons reach),
	// and on a group's position the viewer's own.
	const spots = spotsOfPosition(
		db,
		id,
		reach ?? undefined,
		inGroupMode || position.teamId === null ? undefined : wall.userId
	);
	const picture =
		spots.find((s) => s.point && s.spot.id === position.pictureSpotId) ??
		spots.find((s) => s.point) ??
		null;
	// Lessons: the owner's (a reader's only what reaches them), then, on a group's
	// position seen from a person's app, their own lessons that link it.
	const owners = positionTaughtIn(db, space, id).filter((l) => !reach || reach.lessons.has(l.id));
	const theirs =
		position.teamId === null || inGroupMode
			? []
			: positionTaughtIn(db, wall, id).filter((l) => !owners.some((o) => o.id === l.id));

	return {
		position: {
			...positionSummary(position, viewer),
			notes: position.notes,
			pictureSpotId: position.pictureSpotId
		},
		picture,
		canEdit,
		/** Whether a figure of the viewer's may be tagged with it: New figure from it, the gap banners. */
		canTag: !position.archivedAt && (inSpace(position, viewer) || !!usable?.positions.has(id)),
		/** In the group's own workspace (not `groupMode`: the layout's, which the shell reads). */
		inGroupMode,
		counts,
		from,
		into,
		spots,
		lessons: [...owners, ...theirs],
		routines,
		/** A tab per source, the subtitle's facts, and `?vs=` (`clones/sources.ts`). */
		...pageSources(db, wall.userId, 'position', id, url, !inGroupMode),
		/** Copies you can see, the differs banners and Send mine… (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'position', id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wall, 'position', id),
		detach: detachOffer(db, wall.userId, 'position', id),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'position', id),
		/** Same as… (board C7): the other positions in your app; none in a group's workspace. */
		sameAs: sameAsOffer(db, wall, 'position', id, position.name, inGroupMode),
		/** A group's position, for a reader: whose it is (the band and the note). */
		team: groupTeam,
		/** The lesson of this group's the reader added that brought it ("From Week 6"). */
		fromLesson:
			groupTeam && !inGroupMode
				? (positionsFrom(db, wall.userId, groupTeam.id, [id]).get(id) ?? null)
				: null,
		/** A reader's Edit: Make it mine (ruling 1: an editor's Edit edits the group's). */
		makeMine:
			canEdit || position.teamId === null
				? null
				: makeMineOffer(db, wall, 'position', id, getTeam(db, position.teamId)),
		/** A group position's History: its editors'. */
		historyHref:
			canEdit && position.teamId !== null
				? `/${wall.dance}/groups/${position.teamId}/history/position/${id}`
				: null,
		/** What the edit sheet saw, sent back with a save (the clash check); null when archived. */
		seen: positionSeen(db, id),
		defaultStyle: position.styleTag ?? DANCES[wall.dance].styles[0]
	};
};

export const actions: Actions = {
	/**
	 * The edit sheet's Save: name, type, hold, notes and picture together. The
	 * clash check (a group's needs `seen`; an archived one is gone) comes before
	 * any write; a taken or empty name is refused under its field.
	 */
	update: async ({ params, request, locals }) => {
		const db = getDb();
		const { position } = positionIn(params, locals, 'edit');
		const form = await request.formData();
		const styleTag = String(form.get('styleTag') ?? '');
		const typed = {
			action: 'update' as const,
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? ''),
			styleTag
		};
		const clash = seenRefusal(
			form,
			position.teamId !== null,
			positionSeen(db, position.id),
			typed,
			Date.now(),
			() => editedBy(db, position.teamId, 'position', position.id)
		);
		if (clash) return clash;
		const notes = optionalText(form, 'notes');
		if (notes === undefined) {
			return fail(400, {
				...typed,
				field: 'notes' as const,
				message: 'Notes are up to 2000 characters.'
			});
		}
		if (typed.name.trim().length > 200) {
			return fail(400, {
				...typed,
				field: 'name' as const,
				message: 'A name is up to 200 characters.'
			});
		}
		const saved = updatePosition(
			db,
			position.id,
			{
				name: typed.name,
				// A type outside the dance's is dropped by `updatePosition`.
				styleTag: styleTag || null,
				hold: parseHold(form),
				notes,
				pictureSpotId: int(form, 'pictureSpotId') ?? null
			},
			{ actorId: wallOf(params, locals).userId, now: Date.now() }
		);
		if (!saved) throw error(404, 'Position not found');
		if ('field' in saved)
			return fail(400, { ...typed, field: saved.field, message: saved.message });
		return { action: 'update' as const, ok: true };
	},

	/**
	 * Archive it. The page stays, saying so, with Restore. A second archive (a
	 * replay, another tab) answers the same and changes nothing.
	 */
	archive: ({ params, locals }) => {
		const { position } = positionIn(params, locals, 'edit');
		archivePosition(getDb(), position.id, Date.now(), { actorId: wallOf(params, locals).userId });
		return { action: 'archive' as const, ok: true };
	},

	/** Bring it back; a live one answers the same. Refused when a live position has its name. */
	restore: ({ params, locals }) => {
		const db = getDb();
		const { position, space } = positionIn(params, locals, 'edit');
		if (position.archivedAt === null) return { action: 'restore' as const, ok: true };
		const done = restorePositionIn(db, space, position.id, Date.now());
		if (done.ok) return { action: 'restore' as const, ok: true };
		if (done.reason === 'taken')
			return fail(409, { action: 'restore' as const, message: done.message });
		throw error(404, 'Position not found');
	},

	/** Make it mine: a reader's own copy, their figures, lessons and sections moved onto it (`clones/edit.ts`). */
	makeMine: ({ params, locals }) => {
		const { position } = positionIn(params, locals, 'read');
		return makeMineFrom(getDb(), wallOf(params, locals), 'position', position.id);
	},

	/** Take theirs: the compare sheet's picks from another member of the family, in place (`clones/compare.ts`). */
	take: ({ params, locals, request }) => {
		const { position } = positionIn(params, locals, 'read');
		return takeFrom(getDb(), locals.user!.id, 'position', position.id, request);
	},

	/** Send mine (board C3 p2): this position's changes into each copy the person edits. */
	send: ({ params, locals, request }) => {
		const { position } = positionIn(params, locals, 'read');
		return sendFrom(getDb(), locals.user!.id, 'position', position.id, request);
	},

	/** Drop my copy (board C5): this copy goes for another version, whose page opens. */
	drop: ({ params, locals, request }) => {
		const { position } = positionIn(params, locals, 'read');
		return dropFrom(getDb(), wallOf(params, locals), 'position', position.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { position } = positionIn(params, locals, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'position', position.id);
	},

	/** Same as… (board C7): the row's twins become exactly the ticked ones. */
	sameAs: ({ params, locals, request }) => {
		const { position } = positionIn(params, locals, 'read');
		return sameAsFrom(getDb(), wallOf(params, locals), 'position', position.id, request);
	},

	/** Not the same? Separate (board C7 p2): the row and the rest of its family leave their twins. */
	separate: ({ params, locals }) => {
		const { position } = positionIn(params, locals, 'read');
		return separateFrom(getDb(), wallOf(params, locals), 'position', position.id);
	},

	/** Copy to… (board C4): this position into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const { position } = positionIn(params, locals, 'read');
		return copyToFrom(getDb(), wallOf(params, locals), 'position', position.id, request);
	}

	// Task 17: linkSpot, unlinkSpot, linkLesson and unlinkLesson.
};
