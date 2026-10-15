/**
 * Saving a YouTube link as a figure recording or a lesson video: the queue the
 * home worker drains through `/api/worker/videos/`. See
 * `docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`.
 *
 * Its own queue, not a kind of song job: the server and the worker deploy
 * separately, and a worker that predates this would read a video job from
 * `/api/worker/claim` as a song to analyse.
 */
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { lessonVideos, links, recordings, videoDownloads, videoSpots } from './db/schema';
import type { LinkOwner } from './links';
import { LEASE_MS, MAX_ATTEMPTS } from './songs';
import { parseLink } from '$lib/links';

/** The link, if it belongs to `owner`. A drill's never does: drills keep their links as links. */
function linkOf(db: Db, owner: LinkOwner, linkId: number) {
	if ('exerciseId' in owner) return null;
	const where =
		'figureId' in owner ? eq(links.figureId, owner.figureId) : eq(links.lessonId, owner.lessonId);
	return db
		.select()
		.from(links)
		.where(and(eq(links.id, linkId), where))
		.get();
}

/** Queue a YouTube link. A link that already has a job keeps it as it is — Retry is its own action. */
export function requestVideoDownload(
	db: Db,
	owner: LinkOwner,
	linkId: number
): 'ok' | 'not-found' | 'not-youtube' {
	const link = linkOf(db, owner, linkId);
	if (!link) return 'not-found';
	if (parseLink(link.url)?.kind !== 'youtube') return 'not-youtube';
	db.insert(videoDownloads)
		.values({
			linkId: link.id,
			figureId: link.figureId,
			lessonId: link.lessonId,
			url: link.url,
			status: 'queued'
		})
		.onConflictDoNothing({ target: videoDownloads.linkId })
		.run();
	return 'ok';
}

/** A failed save, queued again from scratch. False when the link is not `owner`'s or has no job. */
export function retryVideoDownload(db: Db, owner: LinkOwner, linkId: number): boolean {
	if (!linkOf(db, owner, linkId)) return false;
	return (
		db
			.update(videoDownloads)
			.set({ status: 'queued', attempts: 0, error: null, claimedAt: null })
			.where(eq(videoDownloads.linkId, linkId))
			.run().changes > 0
	);
}

/**
 * Hand the oldest queued video to the worker and lease it — the same lease and
 * attempt rules as `claimJob` for songs, so a video that kills the worker
 * every time is failed rather than blocking the queue.
 */
export function claimVideoJob(db: Db, now: number): { id: number; url: string } | null {
	return db.transaction((tx) => {
		const queued = eq(videoDownloads.status, 'queued');
		const stale = or(
			isNull(videoDownloads.claimedAt),
			lt(videoDownloads.claimedAt, now - LEASE_MS)
		);
		tx.update(videoDownloads)
			.set({ status: 'failed', error: `Gave up after ${MAX_ATTEMPTS} attempts.`, claimedAt: null })
			.where(and(queued, stale, sql`${videoDownloads.attempts} >= ${MAX_ATTEMPTS}`))
			.run();

		const next = tx
			.select()
			.from(videoDownloads)
			.where(and(queued, stale))
			.orderBy(asc(videoDownloads.createdAt), asc(videoDownloads.id))
			.limit(1)
			.get();
		if (!next) return null;

		tx.update(videoDownloads)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(videoDownloads.id, next.id))
			.run();
		return { id: next.id, url: next.url };
	});
}

/**
 * As `failJob` for songs: a transient failure stays queued and keeps its lease
 * (the lease is the backoff); a permanent one, or the last attempt, fails it.
 * A report about a job that is gone or already failed is ignored.
 */
export function failVideoJob(db: Db, id: number, error: string, permanent: boolean): void {
	const job = db.select().from(videoDownloads).where(eq(videoDownloads.id, id)).get();
	if (!job || job.status !== 'queued') return;
	const giveUp = permanent || job.attempts >= MAX_ATTEMPTS;
	db.update(videoDownloads)
		.set(
			giveUp
				? { error: error.slice(0, 500), claimedAt: null, status: 'failed' }
				: { error: error.slice(0, 500) }
		)
		.where(eq(videoDownloads.id, id))
		.run();
}

/** Which kind of video a job becomes — so the upload knows its directory — or null when it is gone. */
export function videoJobTarget(db: Db, id: number): 'recording' | 'lesson-video' | null {
	const job = db
		.select({ figureId: videoDownloads.figureId })
		.from(videoDownloads)
		.where(eq(videoDownloads.id, id))
		.get();
	if (!job) return null;
	return job.figureId !== null ? 'recording' : 'lesson-video';
}

/**
 * The video arrived. One transaction: the recording or lesson video with its
 * source, a point spot at the link's start time if it had one, then the job
 * and the link go — the link has become the video. Null when the job is gone
 * (the link was removed while the video was on its way).
 */
export function completeVideoJob(
	db: Db,
	id: number,
	input: { file: string; mime: string; sizeBytes: number }
): { recordingId: number } | { lessonVideoId: number } | null {
	return db.transaction((tx) => {
		const job = tx.select().from(videoDownloads).where(eq(videoDownloads.id, id)).get();
		if (!job) return null;

		const owner =
			job.figureId !== null
				? {
						recordingId: tx
							.insert(recordings)
							.values({
								...input,
								figureId: job.figureId,
								kind: 'video',
								note: null,
								sourceUrl: job.url
							})
							.returning({ id: recordings.id })
							.get().id
					}
				: {
						lessonVideoId: tx
							.insert(lessonVideos)
							.values({ ...input, lessonId: job.lessonId!, sourceUrl: job.url })
							.returning({ id: lessonVideos.id })
							.get().id
					};

		const parsed = parseLink(job.url);
		const start = parsed?.kind === 'youtube' ? parsed.start : null;
		if (start) {
			tx.insert(videoSpots)
				.values({ ...owner, startMs: start * 1000, endMs: null, label: null })
				.run();
		}

		tx.delete(videoDownloads).where(eq(videoDownloads.id, id)).run();
		tx.delete(links).where(eq(links.id, job.linkId)).run();
		return owner;
	});
}
