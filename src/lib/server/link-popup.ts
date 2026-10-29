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
import { linkSpot, SpotLinkError, videoOfSpot } from './spot-links';
import { viaSections } from './lesson-links';
import { isStyleOf, type DanceSlug } from '$lib/dances/dances';
import { isFrequency } from '$lib/frequency';
import type {
	LinkContext,
	LinkCreate,
	LinkedTarget,
	LinkOption,
	LinkOptions,
	SectionTarget
} from '$lib/types';

const key = (t: SectionTarget) => ('figureId' in t ? `f${t.figureId}` : `e${t.exerciseId}`);
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** The section's links, labelled, archived ones marked. */
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
			drill: exercises.name,
			drillArchived: exercises.archivedAt
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
						archived: r.figureArchived !== null || r.groupArchived !== null
					}
				: {
						linkId: r.linkId,
						target: { exerciseId: r.exerciseId! },
						label: r.drill!,
						drill: true,
						archived: r.drillArchived !== null
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
	if (!video || !video.isSection) return null;
	const dance = video.dance as DanceSlug;
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
		const side = lessonSide(db, lesson.id);
		byHand = side.byHand;
		isNear = (o) => side.on.has(key(o.target));
	} else {
		const own = db
			.select({ groupId: figureGroups.id, figure: figureGroups.name })
			.from(recordings)
			.innerJoin(figures, eq(figures.id, recordings.figureId))
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(recordings.id, video.owner.recordingId))
			.get()!;
		context = { kind: 'recording', groupId: own.groupId, figure: own.figure };
		isNear = (_o, groupId) => groupId === own.groupId;
	}

	const linked: LinkedTarget[] = linksOf(db, spotId)
		.map((l) => ({ ...l, alsoByHand: byHand.has(key(l.target)) }))
		.sort(byLabel);
	const taken = new Set(linked.map((l) => key(l.target)));

	const variations = listVersions(db, dance).map((v) => ({
		option: { target: { figureId: v.id }, label: v.label, drill: false } as LinkOption,
		groupId: v.groupId
	}));
	const drills = db
		.select({ id: exercises.id, name: exercises.name })
		.from(exercises)
		.where(
			and(eq(exercises.dance, dance), eq(exercises.source, 'custom'), isNull(exercises.archivedAt))
		)
		.orderBy(asc(exercises.name))
		.all()
		.map((d) => ({
			option: { target: { exerciseId: d.id }, label: d.name, drill: true } as LinkOption,
			groupId: null
		}));
	const candidates = [...variations, ...drills].filter((c) => !taken.has(key(c.option.target)));
	const near = candidates.filter((c) => isNear(c.option, c.groupId));
	const other = candidates.filter((c) => !isNear(c.option, c.groupId));

	// The figures New variation offers first: those of the lesson's variations
	// (linked or not), or the recording's own.
	const nearGroups = new Set(
		variations.filter((v) => isNear(v.option, v.groupId)).map((v) => v.groupId)
	);
	const figureChoices = listMoveTargets(db, dance, null).map((g) => ({
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
		near: near.map((c) => c.option).sort(byLabel),
		other: other.map((c) => c.option).sort(byLabel),
		figures: [...figureChoices.filter((f) => f.near), ...figureChoices.filter((f) => !f.near)],
		defaults: { partner: 'partner', style: defaultStyle }
	};
}

/**
 * Make a variation, a figure or a drill and link the section to it — both or
 * neither. The creators run inside this transaction (drizzle nests them as
 * savepoints), so a link that fails takes the new row with it. Returns the
 * link's id; throws `SpotLinkError` with what to tell the user.
 */
export function createAndLink(db: Db, spotId: number, create: LinkCreate): number {
	return db.transaction((tx) => {
		const video = videoOfSpot(tx, spotId);
		if (!video) throw new SpotLinkError('No such section.');
		const dance = video.dance as DanceSlug;
		const name = create.name.trim();
		if (!name) throw new SpotLinkError('Give it a name.');

		let target: SectionTarget;
		if (create.kind === 'variation') {
			const group = getGroup(tx, create.groupId);
			if (!group || group.archivedAt !== null || group.dance !== dance) {
				throw new SpotLinkError('No such figure.');
			}
			if (variationNameTaken(tx, group.id, name, null)) {
				throw new SpotLinkError(`${group.name} already has a ${name}.`);
			}
			const first = listGroupVariations(tx, group.id)[0];
			const made = createVariationIn(tx, group.id, {
				name,
				partner: first?.partner ?? 'partner',
				style: first?.styleTag ?? '',
				notes: null
			});
			if (!made) throw new SpotLinkError('That variation could not be made.');
			target = { figureId: made.id };
		} else if (create.kind === 'figure') {
			const figureName = create.figureName.trim();
			if (!figureName) throw new SpotLinkError('Give it a name.');
			if (!isStyleOf(dance, create.style)) {
				throw new SpotLinkError('That style does not belong to this dance.');
			}
			if (figureNameTaken(tx, dance, figureName, null)) {
				throw new SpotLinkError(`There's already a figure called ${figureName}.`);
			}
			const made = createFigure(tx, dance, {
				figureName,
				name,
				partner: create.partner,
				style: create.style,
				notes: null
			});
			if (!made) throw new SpotLinkError('That figure could not be made.');
			target = { figureId: made.figure.id };
		} else {
			if (!isFrequency(create.everyDays)) throw new SpotLinkError('Pick how often.');
			const made = createCustomExercise(tx, dance, {
				name,
				everyDays: create.everyDays,
				notes: null
			});
			target = { exerciseId: made.id };
		}
		return linkSpot(tx, spotId, target);
	});
}
