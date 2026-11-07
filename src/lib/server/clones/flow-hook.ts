/**
 * Keep in step's hook: what runs the flow (`flowFrom`, `flow.ts`) after a
 * save. An item page wraps its actions in `flowing`; a flat route (or a page
 * that changes a piece of some other row) calls `flowAfter` with the root its
 * write touched, mapped by `rootOfSpot`, `rootOfVideo`, `rootOfRecording` or
 * `rootOfTrash`.
 *
 * The flow runs after the save's own write has committed (the action has
 * returned), never before, and it never reaches the response: a flow that
 * throws is logged and the save still answers as it would have. What it
 * landed or was refused is not sent anywhere: its ids include other people's
 * own copies. `flow-hook.spec.ts` lists every save path that must call it.
 */
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { CloneKind } from '$lib/types';
import { getDb, type Db } from '../db';
import { lessonVideos, recordings, teamTrash, videoSpots } from '../db/schema';
import { freeDisk } from '../storage';
import { realCloneFiles } from './files';
import { flowFrom } from './flow';
import { geneOf } from './genes';

/** The root row a write changed: the member of a family it belongs to. */
export type FlowRoot = { kind: CloneKind; id: number };

/** A route's numeric id param, or null. */
export function idParam(raw: string | undefined): number | null {
	if (raw === undefined || !/^\d+$/.test(raw)) return null;
	const id = Number(raw);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Run the flow from row `id` (of `kind`), saved by `actorId`. Nothing without
 * an actor or a row, or for a row in no family. Never throws: a failure is
 * logged, and so is a refused hop (as a count and its reasons, no ids).
 */
export async function flowAfter(
	actorId: string | null | undefined,
	kind: CloneKind,
	id: number | null
): Promise<void> {
	if (!actorId || id === null) return;
	try {
		const db = getDb();
		// A row in no family has nowhere to flow (and no disk to ask about).
		if (geneOf(db, kind, id) === null) return;
		const report = await flowFrom(
			db,
			actorId,
			kind,
			id,
			realCloneFiles(),
			Date.now(),
			await freeDisk()
		);
		if (report.refused.length > 0) {
			const reasons = [...new Set(report.refused.map((r) => r.reason))].join(', ');
			console.error(`[keep-in-step] ${kind} ${id}: ${report.refused.length} refused (${reasons})`);
		}
	} catch (e) {
		console.error(`[keep-in-step] ${kind} ${id}: the flow failed`, e);
	}
}

/** `rootOf` asked of an event, or null when it cannot say (a bad id throws its 404). */
function rootSafely<E>(rootOf: (event: E) => number | null, event: E): number | null {
	try {
		return rootOf(event);
	} catch {
		return null;
	}
}

/**
 * A page's actions, each running the flow from the page's own row
 * (`rootOf(event)`) after it: after a result that is not a failure, and after
 * a redirect it throws (which is then rethrown). A failure (`fail(...)`) or
 * an error flows nothing. Sync actions come back async.
 */
export function flowing<A extends Record<string, (event: never) => unknown>>(
	kind: CloneKind,
	rootOf: (event: Parameters<A[keyof A]>[0]) => number | null,
	actions: A
): A {
	type Event = Parameters<A[keyof A]>[0];
	const wrapped: Record<string, (event: Event) => Promise<unknown>> = {};
	for (const [name, action] of Object.entries(actions)) {
		wrapped[name] = async (event: Event) => {
			const after = () =>
				flowAfter(
					(event as { locals: App.Locals }).locals.user?.id,
					kind,
					rootSafely(rootOf, event)
				);
			let result: unknown;
			try {
				result = await (action as (event: Event) => unknown)(event);
			} catch (e) {
				if (isRedirect(e)) await after();
				throw e;
			}
			if (!isActionFailure(result)) await after();
			return result;
		};
	}
	return wrapped as unknown as A;
}

/** A recording's root: its variation (a `figures` row). */
export function rootOfRecording(db: Db, recordingId: number): FlowRoot | null {
	const row = db
		.select({ figureId: recordings.figureId })
		.from(recordings)
		.where(eq(recordings.id, recordingId))
		.get();
	return row ? { kind: 'figure', id: row.figureId } : null;
}

/** A lesson video's root: its lesson. */
export function rootOfVideo(db: Db, lessonVideoId: number): FlowRoot | null {
	const row = db
		.select({ lessonId: lessonVideos.lessonId })
		.from(lessonVideos)
		.where(eq(lessonVideos.id, lessonVideoId))
		.get();
	return row ? { kind: 'lesson', id: row.lessonId } : null;
}

/** A section's or point's root: its video's (a lesson's video, or a variation's recording). */
export function rootOfSpot(db: Db, spotId: number): FlowRoot | null {
	const row = db
		.select({ recordingId: videoSpots.recordingId, lessonVideoId: videoSpots.lessonVideoId })
		.from(videoSpots)
		.where(eq(videoSpots.id, spotId))
		.get();
	if (!row) return null;
	if (row.lessonVideoId !== null) return rootOfVideo(db, row.lessonVideoId);
	return row.recordingId !== null ? rootOfRecording(db, row.recordingId) : null;
}

const num = (v: unknown): number | null =>
	typeof v === 'number' && Number.isSafeInteger(v) ? v : null;

/**
 * A group's trash entry's root, read from the rows it holds: a recording's
 * variation, a video's lesson, a section's video's root, a link's owner, a
 * section link's or position link's section's root. Null when it cannot say.
 */
export function rootOfTrash(db: Db, trashId: number): FlowRoot | null {
	const row = db
		.select({ kind: teamTrash.kind, rowsJson: teamTrash.rowsJson })
		.from(teamTrash)
		.where(eq(teamTrash.id, trashId))
		.get();
	if (!row) return null;
	let rows: Record<string, Record<string, unknown>[] | undefined>;
	try {
		rows = JSON.parse(row.rowsJson);
	} catch {
		return null;
	}
	const first = (table: string) => rows[table]?.[0] ?? {};
	switch (row.kind) {
		case 'recording': {
			const id = num(first('recordings').figureId);
			return id === null ? null : { kind: 'figure', id };
		}
		case 'video': {
			const id = num(first('lesson_videos').lessonId);
			return id === null ? null : { kind: 'lesson', id };
		}
		case 'section': {
			const spot = first('video_spots');
			const video = num(spot.lessonVideoId);
			const rec = num(spot.recordingId);
			return video !== null
				? rootOfVideo(db, video)
				: rec !== null
					? rootOfRecording(db, rec)
					: null;
		}
		case 'link': {
			const link = first('links');
			const figureId = num(link.figureId);
			const lessonId = num(link.lessonId);
			const exerciseId = num(link.exerciseId);
			if (figureId !== null) return { kind: 'figure', id: figureId };
			if (lessonId !== null) return { kind: 'lesson', id: lessonId };
			return exerciseId !== null ? { kind: 'drill', id: exerciseId } : null;
		}
		case 'spot-link': {
			const spotId = num(first('spot_links').spotId);
			return spotId === null ? null : rootOfSpot(db, spotId);
		}
		case 'position-link': {
			const spotId = num(first('spot_position_links').spotId);
			return spotId === null ? null : rootOfSpot(db, spotId);
		}
		default:
			return null;
	}
}
