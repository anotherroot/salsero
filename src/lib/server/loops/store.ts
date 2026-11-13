/**
 * Figure loops for the pickers (spec 2026-11-12-picker-preview): one
 * `video_loops` row per section and span. `queueLoops` is the one place jobs
 * come from: every section linked to a figure, on a video the server holds,
 * whose current span has no row gets one; a row whose spot is gone or moved
 * is dropped and its files are returned for removal. It runs on every worker
 * claim and in the hourly sweep, so a new link, an edited span, a copy, an
 * offline replay and the backfill are all the same case. Lease and attempts
 * as `ai_timelines`.
 */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { lessonVideos, recordings, videoLoops, videoSpots } from '../db/schema';
import { LEASE_MS, MAX_ATTEMPTS } from '../songs';
import { loopsDir } from '../files';
import { loopName, type LoopSpan } from '$lib/video/loop-names';

/** A loop that failed is queued again this long after. */
export const RETRY_FAILED_MS = 24 * 3600_000;

type Span = { spotId: number; startMs: number; endMs: number };
const spanOf = (r: Span): LoopSpan => ({ id: r.spotId, startMs: r.startMs, endMs: r.endMs });
const namesOf = (r: Span) => [loopName(spanOf(r)), loopName(spanOf(r), true)];

/** Queue what has no loop yet, drop what no longer matches its spot. */
export function queueLoops(db: Db, now: number): { queued: number; stale: string[] } {
	return db.transaction((tx) => {
		const gone = tx.all<Span & { id: number }>(sql`
			SELECT l.id, l.spot_id AS spotId, l.start_ms AS startMs, l.end_ms AS endMs
			FROM video_loops l
			WHERE NOT EXISTS (
				SELECT 1 FROM video_spots v
				WHERE v.id = l.spot_id AND v.start_ms = l.start_ms AND v.end_ms = l.end_ms
			)`);
		for (const g of gone) tx.delete(videoLoops).where(eq(videoLoops.id, g.id)).run();
		// A loop that failed gets another try a day later: most failures are the source
		// not answering (a restart, the network), and a blank tile forever is worse.
		tx.update(videoLoops)
			.set({ status: 'queued', attempts: 0, error: null, failedAt: null, claimedAt: null })
			.where(and(eq(videoLoops.status, 'failed'), lt(videoLoops.failedAt, now - RETRY_FAILED_MS)))
			.run();
		const wanted = tx.all<Span>(sql`
			SELECT DISTINCT v.id AS spotId, v.start_ms AS startMs, v.end_ms AS endMs
			FROM video_spots v
			JOIN spot_links s ON s.spot_id = v.id AND s.figure_id IS NOT NULL
			LEFT JOIN lesson_videos lv ON lv.id = v.lesson_video_id
			LEFT JOIN recordings r ON r.id = v.recording_id
			WHERE v.end_ms IS NOT NULL
			  AND (lv.server_copy = 1 OR (r.server_copy = 1 AND r.kind = 'video'))
			  AND NOT EXISTS (
				SELECT 1 FROM video_loops l
				WHERE l.spot_id = v.id AND l.start_ms = v.start_ms AND l.end_ms = v.end_ms
			  )
			ORDER BY v.id`);
		// One new row per statement: `mintedId` works its default out once per statement.
		for (const w of wanted) {
			tx.insert(videoLoops)
				.values({ ...w, status: 'queued', createdAt: now })
				.run();
		}
		return { queued: wanted.length, stale: gone.flatMap(namesOf) };
	});
}

/** The oldest queued loop, leased to the worker; one tried too often fails. */
export function claimLoop(
	db: Db,
	now: number
): { id: number; startMs: number; endMs: number } | null {
	return db.transaction((tx) => {
		const queued = eq(videoLoops.status, 'queued');
		const free = or(isNull(videoLoops.claimedAt), lt(videoLoops.claimedAt, now - LEASE_MS));
		tx.update(videoLoops)
			.set({
				status: 'failed',
				error: `Gave up after ${MAX_ATTEMPTS} attempts.`,
				claimedAt: null,
				failedAt: now
			})
			.where(and(queued, free, sql`${videoLoops.attempts} >= ${MAX_ATTEMPTS}`))
			.run();
		const next = tx
			.select()
			.from(videoLoops)
			.where(and(queued, free))
			.orderBy(asc(videoLoops.createdAt), asc(videoLoops.id))
			.limit(1)
			.get();
		if (!next) return null;
		tx.update(videoLoops)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(videoLoops.id, next.id))
			.run();
		return { id: next.id, startMs: next.startMs, endMs: next.endMs };
	});
}

/** The row, while its spot still has the span it was queued for. */
function current(db: Db, id: number) {
	const r = db.select().from(videoLoops).where(eq(videoLoops.id, id)).get();
	if (!r) return null;
	const spot = db.select().from(videoSpots).where(eq(videoSpots.id, r.spotId)).get();
	return spot && spot.startMs === r.startMs && spot.endMs === r.endMs ? { r, spot } : null;
}

/** The video a loop is cut from; null when the row, its spot or its span no longer match, or the server has no file. */
export function loopSource(
	db: Db,
	id: number
): { kind: 'lesson-video' | 'recording'; file: string } | null {
	const c = current(db, id);
	if (!c) return null;
	if (c.spot.lessonVideoId !== null) {
		const v = db
			.select({ file: lessonVideos.file, serverCopy: lessonVideos.serverCopy })
			.from(lessonVideos)
			.where(eq(lessonVideos.id, c.spot.lessonVideoId))
			.get();
		return v?.serverCopy ? { kind: 'lesson-video', file: v.file } : null;
	}
	const rec = db
		.select({ file: recordings.file, kind: recordings.kind, serverCopy: recordings.serverCopy })
		.from(recordings)
		.where(eq(recordings.id, c.spot.recordingId!))
		.get();
	return rec && rec.kind === 'video' && rec.serverCopy
		? { kind: 'recording', file: rec.file }
		: null;
}

/** A queued loop's file names, while it still matches its spot: what the worker may write. */
export function loopFiles(db: Db, id: number): { strip: string; still: string } | null {
	const c = current(db, id);
	if (!c || c.r.status !== 'queued') return null;
	const [strip, still] = namesOf(c.r);
	return { strip, still };
}

/** Both files are in: ready. Returns the strip's name, or null when gone or not queued. */
export function finishLoop(db: Db, id: number, now: number): string | null {
	const files = loopFiles(db, id);
	if (!files) return null;
	db.update(videoLoops)
		.set({ status: 'ready', readyAt: now, claimedAt: null, error: null })
		.where(eq(videoLoops.id, id))
		.run();
	return files.strip;
}

/** A failure: for good, or tried again on the next claim. */
export function failLoop(db: Db, id: number, error: string, permanent: boolean, now: number): void {
	const r = db.select().from(videoLoops).where(eq(videoLoops.id, id)).get();
	if (!r || r.status !== 'queued') return;
	db.update(videoLoops)
		.set(
			permanent || r.attempts >= MAX_ATTEMPTS
				? { status: 'failed', error: error.slice(0, 500), claimedAt: null, failedAt: now }
				: { error: error.slice(0, 500), claimedAt: null }
		)
		.where(eq(videoLoops.id, id))
		.run();
}

/** Removes loop files by name (missing ones are fine). */
export async function removeLoopFiles(names: string[]): Promise<void> {
	if (names.length === 0) return;
	const dir = loopsDir();
	await Promise.all(names.map((n) => rm(join(dir, n), { force: true })));
}
