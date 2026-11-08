/**
 * The Link popup's server side: what a section or point is linked to and could
 * be, and making a variation, figure, drill or position and linking it in one
 * go. A section links variations, drills and positions; a point, positions only
 * (ruling 10 of the positions plan). See
 * `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureEndPositions,
	figureGroups,
	figureStartPositions,
	figures,
	lessonExercises,
	lessonFigures,
	lessonPositions,
	lessonVideos,
	lessons,
	positions,
	recordings,
	spotLinks,
	spotPositionLinks,
	videoSpots,
	type PositionRow
} from './db/schema';
import {
	createFigure,
	createVariationIn,
	figureNameTaken,
	getGroup,
	listGroupVariations,
	listMoveTargets,
	listVersions,
	variationNameTaken,
	withFigureOrigins
} from './figures';
import { createCustomExercise } from './exercises';
import { actorOf, inSpace, isTeam, ownedBy, spaceOfRow, type Space } from './scope';
import { teamRefs, usableDrills, usableOf, usablePositions, usableVersions } from './usable';
import { createPosition, listPositions, positionSummary } from './positions';
import { linkPositionInSpace } from './position-links';
import { foldVersions } from './twins';
import { linkInSpace, sectionSpace, SpotLinkError, videoOfSpot } from './spot-links';
import { viaSections } from './lesson-links';
import { defaultStyle } from './default-styles';
import { PARTNER, type Partner } from '$lib/labels';
import { isStyleOf } from '$lib/dances/dances';
import { EMPTY_HOLD } from '$lib/positions/hold';
import { t } from '$lib/i18n/catalog';
import type {
	Hold,
	LinkContext,
	LinkCreate,
	LinkedTarget,
	LinkOption,
	LinkOptions,
	LinkTarget,
	SectionTarget,
	TeamRef
} from '$lib/types';
import { serverNow } from '$lib/server/server-clock';

const key = (t: LinkTarget) =>
	'figureId' in t ? `f${t.figureId}` : 'exerciseId' in t ? `e${t.exerciseId}` : `p${t.positionId}`;
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
/** A target's row id, a variation's, a drill's or a position's. */
const idOf = (t: LinkTarget) =>
	'figureId' in t ? t.figureId : 'exerciseId' in t ? t.exerciseId : t.positionId;

/** A position as a row the popup offers or lists: its name, its hold for the second line. */
const positionOption = (p: { id: number; name: string; hold: Hold }, linked: boolean) => ({
	target: { positionId: p.id },
	label: p.name,
	drill: false,
	figure: null,
	name: p.name,
	linked,
	hold: p.hold
});

/** The spot's position links, archived ones marked, with the group a position is of. */
function positionLinksOf(db: Db, spotId: number, space: Space) {
	return db
		.select({ linkId: spotPositionLinks.id, position: positions })
		.from(spotPositionLinks)
		.innerJoin(positions, eq(positions.id, spotPositionLinks.positionId))
		.where(eq(spotPositionLinks.spotId, spotId))
		.all()
		.map(({ linkId, position: p }) => {
			const s = positionSummary(p, space);
			return {
				linkId,
				...positionOption(s, true),
				archived: p.archivedAt !== null,
				teamId: p.teamId
			};
		});
}

/** The section's links, labelled, archived ones marked, with the group a target is of. */
function linksOf(db: Db, spotId: number) {
	return db
		.select({
			linkId: spotLinks.id,
			figureId: spotLinks.figureId,
			exerciseId: spotLinks.exerciseId,
			figure: figureGroups.name,
			variation: figures.name,
			figureArchived: figures.archivedAt,
			groupArchived: figureGroups.archivedAt,
			figureTeam: figures.teamId,
			drill: exercises.name,
			drillArchived: exercises.archivedAt,
			drillTeam: exercises.teamId
		})
		.from(spotLinks)
		.leftJoin(figures, eq(figures.id, spotLinks.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.leftJoin(exercises, eq(exercises.id, spotLinks.exerciseId))
		.where(eq(spotLinks.spotId, spotId))
		.all()
		.map((r) =>
			r.figureId !== null
				? {
						linkId: r.linkId,
						target: { figureId: r.figureId },
						label: `${r.figure} · ${r.variation}`,
						drill: false,
						figure: r.figure,
						name: r.variation!,
						linked: true,
						archived: r.figureArchived !== null || r.groupArchived !== null,
						teamId: r.figureTeam
					}
				: {
						linkId: r.linkId,
						target: { exerciseId: r.exerciseId! },
						label: r.drill!,
						drill: true,
						figure: null,
						name: r.drill!,
						linked: true,
						archived: r.drillArchived !== null,
						teamId: r.drillTeam
					}
		);
}

/** The positions a variation is tagged with, at its start or its end. */
function figureTags(db: Db, figureId: number): Set<number> {
	const starts = db
		.select({ id: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all();
	const ends = db
		.select({ id: figureEndPositions.positionId })
		.from(figureEndPositions)
		.where(eq(figureEndPositions.figureId, figureId))
		.all();
	return new Set([...starts, ...ends].map((r) => r.id));
}

/** What the section's lesson has: by hand, and everything on it. */
function lessonSide(db: Db, lessonId: number) {
	const via = viaSections(db, lessonId);
	const handFigures = db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	const handExercises = db
		.select({ id: lessonExercises.exerciseId })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	const handPositions = db
		.select({ id: lessonPositions.positionId })
		.from(lessonPositions)
		.where(eq(lessonPositions.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	const byHand = new Set([
		...handFigures.map((id) => key({ figureId: id })),
		...handExercises.map((id) => key({ exerciseId: id })),
		...handPositions.map((id) => key({ positionId: id }))
	]);
	const on = new Set([
		...byHand,
		...[...via.figures.keys()].map((id) => key({ figureId: id })),
		...[...via.exercises.keys()].map((id) => key({ exerciseId: id })),
		...[...via.positions.keys()].map((id) => key({ positionId: id }))
	]);
	return { byHand, on };
}

/**
 * Everything the popup shows for one section or point. Null for a missing
 * spot. A point is offered positions only (ruling 10): no variations, drills
 * or figures to make. `defaultStyle` is what New figure starts on (the
 * user's, from Settings — the route reads it).
 */
export function linkOptions(db: Db, spotId: number, defaultStyle: string): LinkOptions | null {
	const video = videoOfSpot(db, spotId);
	if (!video || (video.userId === null && video.teamId === null)) return null;
	const point = !video.isSection;
	// The spot's own space: everything offered is its owner's, of its dance.
	// Only the owner is read here: no one acts. A person's spot is also offered
	// the group variations, drills and positions they may use (`usableOf`), each
	// tagged with its group; a group's spot, its group's rows only.
	const space = spaceOfRow(video, '');
	const dance = space.dance;
	const usable = isTeam(space) ? null : usableOf(db, space);
	const versions = point
		? []
		: [
				...listVersions(db, space),
				...(usable && !isTeam(space) ? usableVersions(db, space, usable) : [])
			];
	const offeredPositions: (PositionRow & { team?: TeamRef })[] = [
		...listPositions(db, space),
		...(usable && !isTeam(space) ? usablePositions(db, space, usable) : [])
	];
	const spot = db
		.select({
			id: videoSpots.id,
			startMs: videoSpots.startMs,
			endMs: videoSpots.endMs,
			label: videoSpots.label
		})
		.from(videoSpots)
		.where(eq(videoSpots.id, spotId))
		.get()!;

	let context: LinkContext;
	let nearTitle: string;
	let byHand = new Set<string>();
	let isNear: (o: LinkOption, groupId: number | null) => boolean;
	/** The positions near: the lesson's (by hand or through a spot), or the recording's figure's tags. */
	let nearPosition: (id: number) => boolean;
	if ('lessonVideoId' in video.owner) {
		const lesson = db
			.select({ id: lessons.id, title: lessons.title })
			.from(lessonVideos)
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(eq(lessonVideos.id, video.owner.lessonVideoId))
			.get()!;
		context = { kind: 'lesson', lessonId: lesson.id, title: lesson.title };
		nearTitle = t().links.near.lesson;
		const side = lessonSide(db, lesson.id);
		byHand = side.byHand;
		// Every variation of a figure the lesson teaches is near, not just the taught one.
		const taughtGroups = new Set(
			versions.filter((v) => side.on.has(key({ figureId: v.id }))).map((v) => v.groupId)
		);
		isNear = (o, groupId) =>
			groupId !== null ? taughtGroups.has(groupId) : side.on.has(key(o.target));
		nearPosition = (id) => side.on.has(key({ positionId: id }));
	} else {
		const own = db
			.select({ groupId: figureGroups.id, figure: figureGroups.name, figureId: figures.id })
			.from(recordings)
			.innerJoin(figures, eq(figures.id, recordings.figureId))
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(recordings.id, video.owner.recordingId))
			.get()!;
		context = { kind: 'recording', groupId: own.groupId, figure: own.figure };
		nearTitle = t().links.near.recording;
		isNear = (_o, groupId) => groupId === own.groupId;
		const tags = figureTags(db, own.figureId);
		nearPosition = (id) => tags.has(id);
	}

	// On a person's section, a link to a group's row shows while they may use it,
	// tagged with its group, as `sectionsFor` lists it.
	const links = [...linksOf(db, spotId), ...positionLinksOf(db, spotId, space)];
	const teams = teamRefs(
		db,
		usable ? links.flatMap((l) => (l.teamId === null ? [] : [l.teamId])) : []
	);
	const usableSet = (t: LinkTarget, u: NonNullable<typeof usable>) =>
		'figureId' in t ? u.figures : 'exerciseId' in t ? u.drills : u.positions;
	const linked: LinkedTarget[] = links
		.filter((l) => !usable || l.teamId === null || usableSet(l.target, usable).has(idOf(l.target)))
		.map(({ teamId, ...l }) => {
			const team = usable && teamId !== null ? teams.get(teamId) : undefined;
			return { ...l, ...(team ? { team } : {}), alsoByHand: byHand.has(key(l.target)) };
		})
		.sort(byLabel);
	const taken = new Set(linked.map((l) => key(l.target)));

	// Twins show as one (board C7): a set is one row, linked when any of it is,
	// near when any of it is. A group's section folds nothing.
	const groupOf = new Map(versions.map((v) => [v.id, v.groupId]));
	const variations = withFigureOrigins(db, actorOf(space), foldVersions(db, space, versions)).map(
		(v) => {
			const behind = v.twins ?? [];
			const ids = [v.id, ...behind.map((t) => t.id)];
			return {
				option: {
					target: { figureId: v.id },
					label: v.label,
					drill: false,
					figure: v.figure,
					name: v.name,
					linked: ids.some((id) => taken.has(key({ figureId: id }))),
					from: v.from,
					...(v.team ? { team: v.team } : {}),
					...(behind.length > 0 ? { twins: behind } : {})
				} as LinkOption,
				groupId: v.groupId as number | null,
				groups: ids.map((id) => groupOf.get(id) ?? null)
			};
		}
	);
	const ownDrills: { id: number; name: string; team?: TeamRef }[] = point
		? []
		: db
				.select({ id: exercises.id, name: exercises.name })
				.from(exercises)
				.where(
					and(
						ownedBy(exercises, space),
						eq(exercises.source, 'custom'),
						isNull(exercises.archivedAt)
					)
				)
				.orderBy(asc(exercises.name))
				.all();
	const drills = [
		...ownDrills,
		...(usable && !isTeam(space) && !point ? usableDrills(db, space, usable) : [])
	].map((d) => ({
		option: {
			target: { exerciseId: d.id },
			label: d.name,
			drill: true,
			figure: null,
			name: d.name,
			linked: taken.has(key({ exerciseId: d.id })),
			...(d.team ? { team: d.team } : {})
		} as LinkOption,
		groupId: null as number | null,
		groups: [null] as (number | null)[]
	}));
	const near = (c: (typeof variations)[number]) => c.groups.some((g) => isNear(c.option, g));
	const nearOf = (cs: typeof variations) => cs.filter(near).map((c) => c.option);
	const restOf = (cs: typeof variations) =>
		cs
			.filter((c) => !near(c))
			.map((c) => c.option)
			.sort(byLabel);

	// The figures New variation offers first: those of the lesson's variations
	// (linked or not), or the recording's own; a row near through its twin
	// brings its own figure too.
	const nearGroups = new Set(
		variations.filter(near).flatMap((v) => v.groups.filter((g) => g !== null))
	);
	const figureChoices = (point ? [] : listMoveTargets(db, space, null)).map((g) => {
		const first = listGroupVariations(db, g.id)[0];
		return {
			groupId: g.id,
			name: g.name,
			variations: g.variations,
			near: nearGroups.has(g.id),
			partner: first?.partner ?? ('partner' as const),
			style: first?.styleTag ?? null
		};
	});

	// Positions in list order (ruling 7), own then the group's; not folded by twins.
	const positionOptions = offeredPositions.map((p) => {
		const s = positionSummary(p, space);
		return {
			option: {
				...positionOption(s, taken.has(key({ positionId: p.id }))),
				...(p.team ? { team: p.team } : {})
			} as LinkOption,
			near: nearPosition(p.id)
		};
	});

	return {
		dance,
		spot,
		context,
		linked,
		nearTitle,
		near: [
			...nearOf(variations),
			...nearOf(drills),
			...positionOptions.filter((p) => p.near).map((p) => p.option)
		],
		figures: restOf(variations),
		drills: restOf(drills),
		positions: positionOptions.filter((p) => !p.near).map((p) => p.option),
		figureChoices: [
			...figureChoices.filter((f) => f.near),
			...figureChoices.filter((f) => !f.near)
		],
		defaults: { partner: 'partner', style: defaultStyle }
	};
}

/**
 * Make a variation, a figure, a drill or a position in the spot's space and
 * link the spot to it — both or neither. A point makes positions only.
 * `userId` is who asks: a spot they may not edit (another person's, a group's
 * they only read) is refused as missing, so nothing is made in a space they
 * cannot change.
 */
export function createAndLink(db: Db, userId: string, spotId: number, create: LinkCreate): number {
	const space = sectionSpace(db, userId, spotId);
	if (!space) throw new SpotLinkError(t().links.refused.noSection);
	return createAndLinkIn(db, space, spotId, create);
}

/**
 * `createAndLink` in one space: the section must be its owner's, and what is
 * made is the space's too. The creators run inside this transaction (drizzle
 * nests them as savepoints), so a link that fails takes the new row with it.
 * Returns the link's id; throws `SpotLinkError` with what to tell the user and,
 * when a field is the reason, which one (the popup shows it under that field).
 */
export function createAndLinkIn(db: Db, space: Space, spotId: number, create: LinkCreate): number {
	return db.transaction((tx) => {
		const video = videoOfSpot(tx, spotId);
		if (!video || !inSpace(video, space)) throw new SpotLinkError(t().links.refused.noSection);
		const dance = space.dance;
		// A point links positions only (ruling 10): refused before anything is made.
		if (!video.isSection && create.kind !== 'position') {
			throw new SpotLinkError(t().links.refused.pointPositions);
		}
		const name = create.name.trim();
		if (!name) throw new SpotLinkError(t().links.refused.noName, 400, 'name');

		if (create.kind === 'position') {
			if (create.styleTag !== null && !isStyleOf(dance, create.styleTag)) {
				throw new SpotLinkError(t().links.refused.typeDance, 400, 'style');
			}
			const made = createPosition(
				tx,
				space,
				{ name, styleTag: create.styleTag, hold: EMPTY_HOLD, notes: null, pictureSpotId: null },
				serverNow()
			);
			// The refusal's own field: tsc flags it here if a refusal ever names one the popup lacks.
			if ('field' in made) throw new SpotLinkError(made.message, 400, made.field);
			return linkPositionInSpace(tx, space, spotId, made.id);
		}

		let target: SectionTarget;
		if (create.kind === 'variation') {
			const group = getGroup(tx, create.groupId);
			if (!group || group.archivedAt !== null || !inSpace(group, space)) {
				throw new SpotLinkError(t().links.refused.noMove, 400, 'groupId');
			}
			if (variationNameTaken(tx, group.id, name, null)) {
				throw new SpotLinkError(t().links.refused.variationTaken(group.name, name), 400, 'name');
			}
			if (create.style !== undefined && !isStyleOf(dance, create.style)) {
				throw new SpotLinkError(t().links.refused.styleDance, 400, 'style');
			}
			const first = listGroupVariations(tx, group.id)[0];
			const made = createVariationIn(
				tx,
				group.id,
				{
					name,
					partner: create.partner ?? first?.partner ?? 'partner',
					style: create.style ?? first?.styleTag ?? '',
					notes: null
				},
				actorOf(space)
			);
			if (!made) throw new SpotLinkError(t().links.refused.figureNotMade);
			target = { figureId: made.id };
		} else if (create.kind === 'figure') {
			const figureName = create.figureName.trim();
			if (!figureName) throw new SpotLinkError(t().links.refused.noName, 400, 'figureName');
			if (!isStyleOf(dance, create.style)) {
				throw new SpotLinkError(t().links.refused.styleDance, 400, 'style');
			}
			if (figureNameTaken(tx, space, figureName, null)) {
				throw new SpotLinkError(t().links.refused.moveTaken(figureName), 400, 'figureName');
			}
			const made = createFigure(tx, space, {
				figureName,
				name,
				partner: create.partner,
				style: create.style,
				notes: null
			});
			if (!made) throw new SpotLinkError(t().links.refused.moveNotMade);
			target = { figureId: made.figure.id };
		} else {
			const made = createCustomExercise(tx, space, {
				name,
				notes: null
			});
			target = { exerciseId: made.id };
		}
		return linkInSpace(tx, space, spotId, target);
	});
}

/**
 * `linkOptions` with this user's default style for the section's dance. Null
 * for a section this user may not edit (another person's, a group's they only
 * read) — the same answer a missing one gets.
 */
export function linkOptionsFor(db: Db, spotId: number, userId: string): LinkOptions | null {
	const space = sectionSpace(db, userId, spotId);
	if (!space) return null;
	return linkOptions(db, spotId, defaultStyle(db, actorOf(space), space.dance));
}

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= 200;

/** A POST body: `{ target }` or `{ create }`, checked field by field. Null for anything else. */
export function parseLinkBody(
	body: unknown
): { target: LinkTarget } | { create: LinkCreate } | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const b = body as Record<string, unknown>;
	if (b.target && typeof b.target === 'object') {
		const t = b.target as Record<string, unknown>;
		if (isId(t.figureId)) return { target: { figureId: t.figureId } };
		if (isId(t.exerciseId)) return { target: { exerciseId: t.exerciseId } };
		if (isId(t.positionId)) return { target: { positionId: t.positionId } };
		return null;
	}
	if (!b.create || typeof b.create !== 'object') return null;
	const c = b.create as Record<string, unknown>;
	if (!isText(c.name)) return null;
	if (c.kind === 'variation' && isId(c.groupId)) {
		const create = { kind: 'variation' as const, groupId: c.groupId, name: c.name };
		if (c.partner === undefined && c.style === undefined) return { create };
		if (!(PARTNER as readonly unknown[]).includes(c.partner) || !isText(c.style)) return null;
		return { create: { ...create, partner: c.partner as Partner, style: c.style } };
	}
	if (
		c.kind === 'figure' &&
		isText(c.figureName) &&
		typeof c.style === 'string' &&
		(PARTNER as readonly unknown[]).includes(c.partner)
	) {
		return {
			create: {
				kind: 'figure',
				figureName: c.figureName,
				name: c.name,
				partner: c.partner as Partner,
				style: c.style
			}
		};
	}
	if (c.kind === 'drill') {
		return { create: { kind: 'drill', name: c.name } };
	}
	if (c.kind === 'position' && (c.styleTag === null || isText(c.styleTag))) {
		return { create: { kind: 'position', name: c.name, styleTag: c.styleTag } };
	}
	return null;
}
