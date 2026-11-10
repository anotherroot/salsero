/**
 * A video made ready for the AI to look at (AI connector plan 3): one
 * `ai_timelines` row per video. The first `video_timeline` call queues it,
 * the home worker claims it (`/api/worker/timelines/*`) and uploads a JSON
 * piece per minute (`files.ts`), and the hourly sweep drops it 30 days after
 * its last use or once its video is gone. Lease and attempts as saved videos.
 */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { aiTimelines, lessonVideos, recordings } from '../db/schema';
import { LEASE_MS, MAX_ATTEMPTS } from '../songs';
import { timelinesDir } from '../files';
import type { SpotOwner } from '$lib/types';

export const PIECE_MS = 60_000;
export const KEEP_MS = 30 * 24 * 3600_000;
/** A video that failed for good is tried again when asked a day later. */
export const RETRY_FAILED_MS = 24 * 3600_000;
const TOUCH_MS = 3600_000;

export type Timeline = {
	id: number;
	status: 'queued' | 'ready' | 'failed';
	error: string | null;
	pieces: number | null;
	durationMs: number | null;
	createdAt: number;
	usedAt: number | null;
};

type Row = typeof aiTimelines.$inferSelect;
const shape = (r: Row): Timeline => ({
	id: r.id,
	status: r.status,
	error: r.error,
	pieces: r.pieces,
	durationMs: r.durationMs,
	createdAt: r.createdAt,
	usedAt: r.usedAt
});

export const videoKey = (v: SpotOwner) =>
	'lessonVideoId' in v ? `lv:${v.lessonVideoId}` : `rec:${v.recordingId}`;

const whereVideo = (v: SpotOwner) =>
	'lessonVideoId' in v
		? eq(aiTimelines.lessonVideoId, v.lessonVideoId)
		: eq(aiTimelines.recordingId, v.recordingId);

export function timelineOf(db: Db, video: SpotOwner): Timeline | undefined {
	const r = db.select().from(aiTimelines).where(whereVideo(video)).get();
	return r && shape(r);
}

/** The timelines of these videos, keyed by `videoKey`. */
export function timelinesOf(db: Db, videos: SpotOwner[]): Map<string, Timeline> {
	const lv = videos.flatMap((v) => ('lessonVideoId' in v ? [v.lessonVideoId] : []));
	const rec = videos.flatMap((v) => ('recordingId' in v ? [v.recordingId] : []));
	const rows = db
		.select()
		.from(aiTimelines)
		.where(
			or(
				lv.length ? inArray(aiTimelines.lessonVideoId, lv) : sql`0`,
				rec.length ? inArray(aiTimelines.recordingId, rec) : sql`0`
			)
		)
		.all();
	return new Map(
		rows.map((r) => [
			videoKey(
				r.lessonVideoId !== null
					? { lessonVideoId: r.lessonVideoId }
					: { recordingId: r.recordingId! }
			),
			shape(r)
		])
	);
}

/** The video's timeline, queued now if it has none; one that failed a day ago is queued again. */
export function askTimeline(db: Db, video: SpotOwner, now: number): Timeline {
	return db.transaction((tx) => {
		const r = tx.select().from(aiTimelines).where(whereVideo(video)).get();
		if (!r) {
			const made = tx
				.insert(aiTimelines)
				.values({
					lessonVideoId: 'lessonVideoId' in video ? video.lessonVideoId : null,
					recordingId: 'recordingId' in video ? video.recordingId : null,
					status: 'queued',
					createdAt: now
				})
				.returning()
				.get();
			return shape(made);
		}
		if (r.status === 'failed' && r.failedAt !== null && now - r.failedAt > RETRY_FAILED_MS) {
			const again = tx
				.update(aiTimelines)
				.set({ status: 'queued', error: null, attempts: 0, failedAt: null, claimedAt: null })
				.where(eq(aiTimelines.id, r.id))
				.returning()
				.get();
			return shape(again);
		}
		return shape(r);
	});
}

/** The oldest queued timeline, leased to the worker; one tried too often fails. */
export function claimTimeline(db: Db, now: number): { id: number } | null {
	return db.transaction((tx) => {
		const queued = eq(aiTimelines.status, 'queued');
		const stale = or(isNull(aiTimelines.claimedAt), lt(aiTimelines.claimedAt, now - LEASE_MS));
		tx.update(aiTimelines)
			.set({
				status: 'failed',
				error: `Gave up after ${MAX_ATTEMPTS} attempts.`,
				claimedAt: null,
				failedAt: now
			})
			.where(and(queued, stale, sql`${aiTimelines.attempts} >= ${MAX_ATTEMPTS}`))
			.run();
		const next = tx
			.select()
			.from(aiTimelines)
			.where(and(queued, stale))
			.orderBy(asc(aiTimelines.createdAt), asc(aiTimelines.id))
			.limit(1)
			.get();
		if (!next) return null;
		tx.update(aiTimelines)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(aiTimelines.id, next.id))
			.run();
		return { id: next.id };
	});
}

/** As `failVideoJob`: a transient failure stays queued under its lease; a permanent one fails. */
export function failTimeline(
	db: Db,
	id: number,
	error: string,
	permanent: boolean,
	now: number
): void {
	const r = db.select().from(aiTimelines).where(eq(aiTimelines.id, id)).get();
	if (!r || r.status !== 'queued') return;
	if (permanent || r.attempts >= MAX_ATTEMPTS) {
		db.update(aiTimelines)
			.set({ status: 'failed', error: error.slice(0, 500), claimedAt: null, failedAt: now })
			.where(eq(aiTimelines.id, id))
			.run();
	} else {
		db.update(aiTimelines)
			.set({ error: error.slice(0, 500) })
			.where(eq(aiTimelines.id, id))
			.run();
	}
}

/** Every piece is in: ready. False when the timeline is gone or not queued. */
export function finishTimeline(
	db: Db,
	id: number,
	pieces: number,
	durationMs: number,
	now: number
): boolean {
	const done = db
		.update(aiTimelines)
		.set({
			status: 'ready',
			pieces,
			durationMs,
			readyAt: now,
			usedAt: now,
			claimedAt: null,
			error: null
		})
		.where(and(eq(aiTimelines.id, id), eq(aiTimelines.status, 'queued')))
		.run();
	return done.changes > 0;
}

/**
 * The video file a timeline is cut from; null when the timeline or its video is gone, it is sound
 * only, or it is only on a phone (offline phase 4c: no file here).
 */
export function timelineSource(
	db: Db,
	id: number
): { kind: 'lesson-video' | 'recording'; file: string } | null {
	const r = db.select().from(aiTimelines).where(eq(aiTimelines.id, id)).get();
	if (!r) return null;
	if (r.lessonVideoId !== null) {
		const v = db
			.select({ file: lessonVideos.file, serverCopy: lessonVideos.serverCopy })
			.from(lessonVideos)
			.where(eq(lessonVideos.id, r.lessonVideoId))
			.get();
		return v?.serverCopy ? { kind: 'lesson-video', file: v.file } : null;
	}
	const rec = db
		.select({ file: recordings.file, kind: recordings.kind, serverCopy: recordings.serverCopy })
		.from(recordings)
		.where(eq(recordings.id, r.recordingId!))
		.get();
	return rec && rec.kind === 'video' && rec.serverCopy
		? { kind: 'recording', file: rec.file }
		: null;
}

/** A use of a ready timeline: `used_at` moves at most hourly. */
export function touchTimeline(db: Db, id: number, now: number): void {
	db.update(aiTimelines)
		.set({ usedAt: now })
		.where(
			and(
				eq(aiTimelines.id, id),
				or(isNull(aiTimelines.usedAt), lt(aiTimelines.usedAt, now - TOUCH_MS))
			)
		)
		.run();
}

/** Drops timelines unused for 30 days or whose video is gone; returns their ids. */
export function sweepTimelines(db: Db, now: number): number[] {
	return db.transaction((tx) => {
		const unused = tx
			.select({ id: aiTimelines.id })
			.from(aiTimelines)
			.where(lt(sql`coalesce(${aiTimelines.usedAt}, ${aiTimelines.createdAt})`, now - KEEP_MS))
			.all();
		const orphanVideos = tx
			.select({ id: aiTimelines.id })
			.from(aiTimelines)
			.leftJoin(lessonVideos, eq(lessonVideos.id, aiTimelines.lessonVideoId))
			.where(and(isNotNull(aiTimelines.lessonVideoId), isNull(lessonVideos.id)))
			.all();
		const orphanRecordings = tx
			.select({ id: aiTimelines.id })
			.from(aiTimelines)
			.leftJoin(recordings, eq(recordings.id, aiTimelines.recordingId))
			.where(and(isNotNull(aiTimelines.recordingId), isNull(recordings.id)))
			.all();
		const ids = [...new Set([...unused, ...orphanVideos, ...orphanRecordings].map((r) => r.id))];
		if (ids.length) tx.delete(aiTimelines).where(inArray(aiTimelines.id, ids)).run();
		return ids;
	});
}

/** Where a timeline's pieces live. */
export const timelineDir = (id: number) => join(timelinesDir(), String(id));

/** The pieces of swept timelines; a folder already gone is fine. */
export async function removeTimelineFiles(ids: number[]): Promise<void> {
	for (const id of ids) await rm(timelineDir(id), { recursive: true, force: true });
}
