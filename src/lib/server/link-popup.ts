/**
 * The Link popup's server side: what a section is linked to and could be, and
 * making a variation, figure or drill and linking it in one go. See
 * `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonExercises,
	lessonFigures,
	lessonVideos,
	lessons,
	recordings,
	spotLinks,
	videoSpots
} from './db/schema';
import {
	createFigure,
	createVariationIn,
	figureNameTaken,
	getGroup,
	listGroupVariations,
	listMoveTargets,
	listVersions,
	variationNameTaken
} from './figures';
import { createCustomExercise } from './exercises';
import { actorOf, inSpace, isTeam, ownedBy, spaceOfRow, type Space } from './scope';
import { teamRefs, usableDrills, usableOf, usableVersions } from './usable';
import { foldVersions } from './twins';
import { linkInSpace, sectionSpace, SpotLinkError, videoOfSpot } from './spot-links';
import { viaSections } from './lesson-links';
import { defaultStyle } from './default-styles';
import { PARTNER, type Partner } from '$lib/labels';
import { isStyleOf } from '$lib/dances/dances';
import { isFrequency } from '$lib/frequency';
import type {
	LinkContext,
	LinkCreate,
	LinkedTarget,
	LinkOption,
	LinkOptions,
	SectionTarget,
	TeamRef
} from '$lib/types';

const key = (t: SectionTarget) => ('figureId' in t ? `f${t.figureId}` : `e${t.exerciseId}`);
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
/** A target's row id, a variation's or a drill's. */
const idOf = (t: SectionTarget) => ('figureId' in t ? t.figureId : t.exerciseId);

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
			everyDays: exercises.everyDays,
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
						everyDays: null,
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
						everyDays: r.everyDays,
						linked: true,
						archived: r.drillArchived !== null,
						teamId: r.drillTeam
					}
		);
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
	const byHand = new Set([
		...handFigures.map((id) => key({ figureId: id })),
		...handExercises.map((id) => key({ exerciseId: id }))
	]);
	const on = new Set([
		...byHand,
		...[...via.figures.keys()].map((id) => key({ figureId: id })),
		...[...via.exercises.keys()].map((id) => key({ exerciseId: id }))
	]);
	return { byHand, on };
}

/**
 * Everything the popup shows for one section. Null for a missing spot or a
 * point. `defaultStyle` is what New figure starts on (the user's, from
 * Settings — the route reads it).
 */
export function linkOptions(db: Db, spotId: number, defaultStyle: string): LinkOptions | null {
	const video = videoOfSpot(db, spotId);
	if (!video || !video.isSection || (video.userId === null && video.teamId === null)) return null;
	// The section's own space: everything offered is its owner's, of its dance.
	// Only the owner is read here: no one acts. A person's section is also offered
	// the group variations and drills they may use (`usableOf`), each tagged with
	// its group; a group's section, its group's rows only.
	const space = spaceOfRow(video, '');
	const dance = space.dance;
	const usable = isTeam(space) ? null : usableOf(db, space);
	const versions = [
		...listVersions(db, space),
		...(usable && !isTeam(space) ? usableVersions(db, space, usable) : [])
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
	if ('lessonVideoId' in video.owner) {
		const lesson = db
			.select({ id: lessons.id, title: lessons.title })
			.from(lessonVideos)
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(eq(lessonVideos.id, video.owner.lessonVideoId))
			.get()!;
		context = { kind: 'lesson', lessonId: lesson.id, title: lesson.title };
		nearTitle = 'In this lesson';
		const side = lessonSide(db, lesson.id);
		byHand = side.byHand;
		// Every variation of a figure the lesson teaches is near, not just the taught one.
		const taughtGroups = new Set(
			versions.filter((v) => side.on.has(key({ figureId: v.id }))).map((v) => v.groupId)
		);
		isNear = (o, groupId) =>
			groupId !== null ? taughtGroups.has(groupId) : side.on.has(key(o.target));
	} else {
		const own = db
			.select({ groupId: figureGroups.id, figure: figureGroups.name })
			.from(recordings)
			.innerJoin(figures, eq(figures.id, recordings.figureId))
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(recordings.id, video.owner.recordingId))
			.get()!;
		context = { kind: 'recording', groupId: own.groupId, figure: own.figure };
		nearTitle = 'This figure';
		isNear = (_o, groupId) => groupId === own.groupId;
	}

	// On a person's section, a link to a group's row shows while they may use it,
	// tagged with its group, as `sectionsFor` lists it.
	const links = linksOf(db, spotId);
	const teams = teamRefs(
		db,
		usable ? links.flatMap((l) => (l.teamId === null ? [] : [l.teamId])) : []
	);
	const linked: LinkedTarget[] = links
		.filter(
			(l) =>
				!usable ||
				l.teamId === null ||
				(l.drill ? usable.drills : usable.figures).has(idOf(l.target))
		)
		.map(({ teamId, ...l }) => {
			const team = usable && teamId !== null ? teams.get(teamId) : undefined;
			return { ...l, ...(team ? { team } : {}), alsoByHand: byHand.has(key(l.target)) };
		})
		.sort(byLabel);
	const taken = new Set(linked.map((l) => key(l.target)));

	// Twins show as one (board C7): a set is one row, linked when any of it is,
	// near when any of it is. A group's section folds nothing.
	const groupOf = new Map(versions.map((v) => [v.id, v.groupId]));
	const variations = foldVersions(db, space, versions).map((v) => {
		const behind = v.twins ?? [];
		const ids = [v.id, ...behind.map((t) => t.id)];
		return {
			option: {
				target: { figureId: v.id },
				label: v.label,
				drill: false,
				figure: v.figure,
				name: v.name,
				everyDays: null,
				linked: ids.some((id) => taken.has(key({ figureId: id }))),
				...(v.team ? { team: v.team } : {}),
				...(behind.length > 0 ? { twins: behind } : {})
			} as LinkOption,
			groupId: v.groupId as number | null,
			groups: ids.map((id) => groupOf.get(id) ?? null)
		};
	});
	const ownDrills: { id: number; name: string; everyDays: number; team?: TeamRef }[] = db
		.select({ id: exercises.id, name: exercises.name, everyDays: exercises.everyDays })
		.from(exercises)
		.where(
			and(ownedBy(exercises, space), eq(exercises.source, 'custom'), isNull(exercises.archivedAt))
		)
		.orderBy(asc(exercises.name))
		.all();
	const drills = [
		...ownDrills,
		...(usable && !isTeam(space) ? usableDrills(db, space, usable) : [])
	].map((d) => ({
		option: {
			target: { exerciseId: d.id },
			label: d.name,
			drill: true,
			figure: null,
			name: d.name,
			everyDays: d.everyDays,
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
	const figureChoices = listMoveTargets(db, space, null).map((g) => ({
		groupId: g.id,
		name: g.name,
		variations: g.variations,
		near: nearGroups.has(g.id)
	}));

	return {
		dance,
		spot: { ...spot, endMs: spot.endMs! },
		context,
		linked,
		nearTitle,
		near: [...nearOf(variations), ...nearOf(drills)],
		figures: restOf(variations),
		drills: restOf(drills),
		figureChoices: [
			...figureChoices.filter((f) => f.near),
			...figureChoices.filter((f) => !f.near)
		],
		defaults: { partner: 'partner', style: defaultStyle }
	};
}

/**
 * Make a variation, a figure or a drill in the section's space and link the
 * section to it — both or neither. `userId` is who asks: a section they may not
 * edit (another person's, a group's they only read) is refused as missing, so
 * nothing is made in a space they cannot change.
 */
export function createAndLink(db: Db, userId: string, spotId: number, create: LinkCreate): number {
	const space = sectionSpace(db, userId, spotId);
	if (!space) throw new SpotLinkError('No such section.');
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
		if (!video || !inSpace(video, space)) throw new SpotLinkError('No such section.');
		const dance = space.dance;
		const name = create.name.trim();
		if (!name) throw new SpotLinkError('Give it a name.', 400, 'name');

		let target: SectionTarget;
		if (create.kind === 'variation') {
			const group = getGroup(tx, create.groupId);
			if (!group || group.archivedAt !== null || !inSpace(group, space)) {
				throw new SpotLinkError('No such move.', 400, 'groupId');
			}
			if (variationNameTaken(tx, group.id, name, null)) {
				throw new SpotLinkError(`${group.name} already has a ${name}.`, 400, 'name');
			}
			const first = listGroupVariations(tx, group.id)[0];
			const made = createVariationIn(
				tx,
				group.id,
				{
					name,
					partner: first?.partner ?? 'partner',
					style: first?.styleTag ?? '',
					notes: null
				},
				actorOf(space)
			);
			if (!made) throw new SpotLinkError('That figure could not be made.');
			target = { figureId: made.id };
		} else if (create.kind === 'figure') {
			const figureName = create.figureName.trim();
			if (!figureName) throw new SpotLinkError('Give it a name.', 400, 'figureName');
			if (!isStyleOf(dance, create.style)) {
				throw new SpotLinkError('That style does not belong to this dance.', 400, 'style');
			}
			if (figureNameTaken(tx, space, figureName, null)) {
				throw new SpotLinkError(`There's already a move called ${figureName}.`, 400, 'figureName');
			}
			const made = createFigure(tx, space, {
				figureName,
				name,
				partner: create.partner,
				style: create.style,
				notes: null
			});
			if (!made) throw new SpotLinkError('That move could not be made.');
			target = { figureId: made.figure.id };
		} else {
			if (!isFrequency(create.everyDays))
				throw new SpotLinkError('Pick how often.', 400, 'everyDays');
			const made = createCustomExercise(tx, space, {
				name,
				everyDays: create.everyDays,
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
): { target: SectionTarget } | { create: LinkCreate } | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const b = body as Record<string, unknown>;
	if (b.target && typeof b.target === 'object') {
		const t = b.target as Record<string, unknown>;
		if (isId(t.figureId)) return { target: { figureId: t.figureId } };
		if (isId(t.exerciseId)) return { target: { exerciseId: t.exerciseId } };
		return null;
	}
	if (!b.create || typeof b.create !== 'object') return null;
	const c = b.create as Record<string, unknown>;
	if (!isText(c.name)) return null;
	if (c.kind === 'variation' && isId(c.groupId)) {
		return { create: { kind: 'variation', groupId: c.groupId, name: c.name } };
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
	if (c.kind === 'drill' && typeof c.everyDays === 'number') {
		return { create: { kind: 'drill', name: c.name, everyDays: c.everyDays } };
	}
	return null;
}
