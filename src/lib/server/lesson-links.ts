/**
 * What reaches a lesson through its videos' sections: a variation or drill
 * linked to a section of one of the lesson's videos is on that lesson, with no
 * row written for it. See
 * `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`.
 *
 * Imports only the schema, so `lessons.ts` and `spot-links.ts` can both use it.
 * Nothing here filters archived rows: callers do, as they do for hand links.
 */
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { Db } from './db';
import { lessonVideos, spotLinks, videoSpots } from './db/schema';
import type { SectionTarget, ViaSection } from '$lib/types';

/** This lesson's section links, keyed by variation and by drill, each list by start time. */
export function viaSections(
	db: Db,
	lessonId: number
): { figures: Map<number, ViaSection[]>; exercises: Map<number, ViaSection[]> } {
	const rows = db
		.select({
			spotId: videoSpots.id,
			startMs: videoSpots.startMs,
			endMs: videoSpots.endMs,
			label: videoSpots.label,
			figureId: spotLinks.figureId,
			exerciseId: spotLinks.exerciseId
		})
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.where(and(eq(lessonVideos.lessonId, lessonId), isNotNull(videoSpots.endMs)))
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
	const figures = new Map<number, ViaSection[]>();
	const exercises = new Map<number, ViaSection[]>();
	for (const { figureId, exerciseId, endMs, ...spot } of rows) {
		const via = { ...spot, endMs: endMs! };
		const [map, key] = figureId !== null ? [figures, figureId] : [exercises, exerciseId!];
		map.set(key, [...(map.get(key) ?? []), via]);
	}
	return { figures, exercises };
}

/** The lessons with a video whose section links this target, each once. */
export function lessonsReaching(db: Db, target: SectionTarget): number[] {
	const column =
		'figureId' in target
			? eq(spotLinks.figureId, target.figureId)
			: eq(spotLinks.exerciseId, target.exerciseId);
	return db
		.selectDistinct({ id: lessonVideos.lessonId })
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.where(column)
		.all()
		.map((r) => r.id);
}
