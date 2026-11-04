import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, type Db } from '$lib/server/db';
import {
	figures,
	lessonPositions,
	lessonVideos,
	recordings,
	spotPositionLinks
} from '$lib/server/db/schema';
import { localDay } from '$lib/day/day';
import type { SectionGroup } from '$lib/types';
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
import {
	linkableSpots,
	linkSpotToPosition,
	positionTaughtIn,
	spotsOfPosition,
	unlinkSpotFromPosition
} from '$lib/server/position-links';
import { sectionSpace, SpotLinkError } from '$lib/server/spot-links';
import { viaSections } from '$lib/server/lesson-links';
import { linkPosition, listLessons, unlinkPosition } from '$lib/server/lessons';
import { teamRefs, usableOf } from '$lib/server/usable';
import { getTeam } from '$lib/server/teams';
import { inGroupModeOn } from '$lib/server/group-mode';
import {
	actorOf,
	inSpace,
	isTeam,
	requireLessonAccess,
	requirePositionAccess,
	wallOf,
	type Space
} from '$lib/server/scope';
import { int, optionalText, refusalText } from '$lib/server/form';
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
import {
	LINK_REFUSED,
	notLinked,
	styleLabelOf,
	videoKey,
	type VideoPlace
} from '$lib/positions/view';
import type { Actions, PageServerLoad } from './$types';

/**
 * Where each video of the spot picker sits (its group's title): a lesson
 * video's number among its lesson's videos, in the lesson page's order
 * (oldest first), and a recording's day in the person's zone.
 */
function videoPlaces(db: Db, groups: SectionGroup[], zone: string): Record<string, VideoPlace> {
	const lessonIds = [
		...new Set(
			groups.flatMap((g) => (g.video.from.kind === 'lesson' ? [g.video.from.lessonId] : []))
		)
	];
	const recordingIds = groups.flatMap((g) =>
		'recordingId' in g.video.owner ? [g.video.owner.recordingId] : []
	);
	const places: Record<string, VideoPlace> = {};
	if (lessonIds.length > 0) {
		const seen = new Map<number, number>();
		for (const v of db
			.select({ id: lessonVideos.id, lessonId: lessonVideos.lessonId })
			.from(lessonVideos)
			.where(inArray(lessonVideos.lessonId, lessonIds))
			.orderBy(asc(lessonVideos.createdAt), asc(lessonVideos.id))
			.all()) {
			const n = (seen.get(v.lessonId) ?? 0) + 1;
			seen.set(v.lessonId, n);
			places[videoKey({ lessonVideoId: v.id })] = { n };
		}
	}
	if (recordingIds.length > 0) {
		for (const r of db
			.select({ id: recordings.id, createdAt: recordings.createdAt })
			.from(recordings)
			.where(inArray(recordings.id, recordingIds))
			.all()) {
			places[videoKey({ recordingId: r.id })] = { day: localDay(r.createdAt, zone) };
		}
	}
	return places;
}

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
	// Each says whether this person may edit it (its video's section editor, the
	// full-screen player's Edit: the owner's, for an editor; their own, on a
	// group's position) and so unlink it while the position is live.
	const spots = spotsOfPosition(
		db,
		id,
		reach ?? undefined,
		inGroupMode || position.teamId === null ? undefined : wall.userId
	).map((s) => {
		const canEdit = sectionSpace(db, wall.userId, s.spot.id) !== null;
		return { ...s, canEdit, canUnlink: !position.archivedAt && canEdit };
	});
	const picture =
		spots.find((s) => s.point && s.spot.id === position.pictureSpotId) ??
		spots.find((s) => s.point) ??
		null;
	// Lessons: the owner's (a reader's only what reaches them), then, on a group's
	// position seen from a person's app, their own lessons that link it. Each
	// with the sections and points that bring it (Unlink takes those too), and
	// whether this person may unlink it: the owner's are an editor's, their own are theirs.
	const owners = positionTaughtIn(db, space, id).filter((l) => !reach || reach.lessons.has(l.id));
	const theirs =
		position.teamId === null || inGroupMode
			? []
			: positionTaughtIn(db, wall, id).filter((l) => !owners.some((o) => o.id === l.id));
	const lessonRow = (l: (typeof owners)[number], canUnlink: boolean) => ({
		...l,
		viaSections: l.via ? (viaSections(db, l.id).positions.get(id) ?? []) : [],
		canUnlink: canUnlink && !position.archivedAt
	});
	// What an editor may link: the owner's sections and points, and the owner's lessons.
	const linking = canEdit && !position.archivedAt;
	const taught = new Map(owners.map((l) => [l.id, l]));
	const linkable = linking ? linkableSpots(db, id) : [];
	const zone = locals.user!.timezone;

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
		lessons: [
			...owners.map((l) => lessonRow(l, canEdit)),
			...theirs.map((l) => lessonRow(l, true))
		],
		/** Link a section or point…: every section and point of the owner's videos. */
		linkable,
		/** Where each of those videos sits: "video 2", "recording 26 Oct" in the picker's titles. */
		videoPlaces: videoPlaces(db, linkable, zone),
		/** The person's today: the lesson picker leaves this year out of its months and days. */
		today: localDay(Date.now(), zone),
		/** Link a lesson…: the owner's lessons, newest class first; `linked` by hand or through a spot. */
		linkableLessons: linking
			? listLessons(db, space).map((l) => ({
					id: l.id,
					title: l.title,
					lessonDay: l.lessonDay,
					videos: l.videos,
					team: inGroupMode ? null : (l.team?.name ?? null),
					linked: taught.has(l.id),
					via: taught.get(l.id)?.via ?? false
				}))
			: [],
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
	},

	/**
	 * Link a section or point: one the person may edit, to this position when
	 * it is the spot's owner's or (on their own spot) a group's they may use.
	 * `linkSpotToPosition` refuses everything else before it writes.
	 */
	linkSpot: async ({ params, request, locals }) => {
		const { position } = positionIn(params, locals, 'read');
		const spotId = int(await request.formData(), 'spotId');
		if (spotId === undefined) {
			return fail(400, { action: 'linkSpot' as const, message: LINK_REFUSED.pickSpot });
		}
		try {
			linkSpotToPosition(getDb(), wallOf(params, locals).userId, spotId, position.id);
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, {
					action: 'linkSpot' as const,
					message: refusalText(e.status, e.message)
				});
			}
			throw e;
		}
		return { action: 'linkSpot' as const, ok: true };
	},

	/**
	 * Unlink a section or point: a link of this position on a spot the person may
	 * edit. A group's goes to Recently deleted (`unlinkSpotFromPosition`).
	 */
	unlinkSpot: async ({ params, request, locals }) => {
		const db = getDb();
		const { position } = positionIn(params, locals, 'read');
		const userId = wallOf(params, locals).userId;
		const linkId = int(await request.formData(), 'linkId');
		const link =
			linkId === undefined
				? null
				: db.select().from(spotPositionLinks).where(eq(spotPositionLinks.id, linkId)).get();
		if (
			!link ||
			link.positionId !== position.id ||
			!sectionSpace(db, userId, link.spotId) ||
			!unlinkSpotFromPosition(db, link.id, Date.now(), userId)
		) {
			return fail(404, {
				action: 'unlinkSpot' as const,
				message: LINK_REFUSED.linkGone
			});
		}
		return { action: 'unlinkSpot' as const, ok: true };
	},

	/**
	 * Link a lesson by hand. The lesson is the row that changes, so it must be one
	 * the person edits (a reader's or a stranger's is a 404); the position must
	 * be one they read. `linkPosition` then holds the owner rule: a group's
	 * lesson links only its group's positions, a person's lesson their own or a
	 * group's they may use.
	 */
	linkLesson: async ({ params, request, locals }) => {
		const db = getDb();
		const { position } = positionIn(params, locals, 'read');
		const lessonId = int(await request.formData(), 'lessonId');
		if (lessonId === undefined) {
			return fail(400, { action: 'linkLesson' as const, message: LINK_REFUSED.pickLesson });
		}
		const { lesson, space } = requireLessonAccess(db, locals, params, lessonId, 'edit');
		const refuse = (status: number, message: string) =>
			fail(status, { action: 'linkLesson' as const, message });
		if (lesson.archivedAt !== null) return refuse(400, LINK_REFUSED.lessonArchived);
		if (
			db
				.select({ id: lessonPositions.lessonId })
				.from(lessonPositions)
				.where(
					and(eq(lessonPositions.lessonId, lesson.id), eq(lessonPositions.positionId, position.id))
				)
				.get()
		) {
			return refuse(409, LINK_REFUSED.already);
		}
		if (!linkPosition(db, lesson.id, position.id, actorOf(space))) {
			return refuse(400, notLinked(lesson.title));
		}
		return { action: 'linkLesson' as const, ok: true };
	},

	/**
	 * Take this position off a lesson the person edits. A lesson there through
	 * its sections or points posts `alsoSections` (after asking): those links go too.
	 */
	unlinkLesson: async ({ params, request, locals }) => {
		const db = getDb();
		const { position } = positionIn(params, locals, 'read');
		const form = await request.formData();
		const lessonId = int(form, 'lessonId');
		if (lessonId === undefined) {
			return fail(400, { action: 'unlinkLesson' as const, message: LINK_REFUSED.pickLesson });
		}
		const { lesson, space } = requireLessonAccess(db, locals, params, lessonId, 'edit');
		const alsoSections = form.get('alsoSections') === '1';
		if (!unlinkPosition(db, lesson.id, position.id, alsoSections, Date.now(), actorOf(space))) {
			return fail(400, {
				action: 'unlinkLesson' as const,
				message: LINK_REFUSED.lessonGone
			});
		}
		return { action: 'unlinkLesson' as const, ok: true };
	}
};
