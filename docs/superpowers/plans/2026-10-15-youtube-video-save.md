# Saving a YouTube video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A YouTube link on a figure or lesson can be saved: the home worker downloads it at ≤480p, re-encodes it and uploads it in chunks, and the link becomes an ordinary recording / lesson video with full screen and spots.

**Architecture:** A new `video_downloads` queue table with its own `/api/worker/videos/*` endpoints (separate from songs so an old worker never sees a video job). The worker's upload is chunked with the lesson-video protocol, whose chunk-writing code moves into a shared helper. Completion is one transaction: insert the video with `source_url`, add a start spot, delete job and link.

**Tech Stack:** SvelteKit 2 / Svelte 5, Drizzle + better-sqlite3, vitest; Python 3 stdlib worker with yt-dlp and ffmpeg, pytest.

**Spec:** `docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`

## Global Constraints

- Figures and lessons only; a drill's (`exerciseId`) link is never saved.
- At most 480p (`bv*[height<=480]+ba/b[height<=480]/b`), at most 60 minutes (`duration <= 3600`).
- Size cap `MAX_LESSON_VIDEO_BYTES` (1 GiB); chunk cap `MAX_UPLOAD_CHUNK_BYTES`; worker chunk 8 MiB.
- Lease/attempts reuse `LEASE_MS` and `MAX_ATTEMPTS` from `src/lib/server/songs.ts`.
- Additive migration only: one `CREATE TABLE video_downloads` (+ indexes) and two `ADD COLUMN source_url`. Read the SQL.
- Data functions take `db` first; nothing under `$lib/server` imported by components.
- One-tap forms use `use:enhance`.
- Never judge the worker against `vite dev`.

## Review Focus

1. **Link removed while the worker is uploading** — expect 410, no partial left, no video row. Test in Task 4.
2. **The last chunk's 201 lost, worker retries it** — expect 410 and exactly one video. Test in Task 4.
3. **A second Save press, or Save on a link already failed** — no second job, failed stays failed until Retry. Test in Task 2.
4. **A link URL with `t=` of 0 or none** — no spot; `t=90` → one point spot at 90 000 ms. Test in Task 2.
5. **Upload resumes after a 409 offset mismatch** — the worker continues from `x-received-bytes`, not from zero. Test in Task 7.

---

### Task 1: Schema, migration, `sourceUrl` on video rows

**Files:**
- Modify: `src/lib/server/db/schema.ts` (recordings, lessonVideos, new videoDownloads after `links`)
- Create: `drizzle/0014_*.sql` (generated)
- Modify: `src/lib/types.ts` (`RecordingRow`, `LessonVideoRow`, `LinkRow`)
- Modify: `src/lib/server/lessons.ts` (`getLesson` video select), `src/lib/server/practice-content.ts` (recording map)

**Interfaces:**
- Produces: `videoDownloads` table export; `RecordingRow.sourceUrl: string | null`; `LessonVideoRow.sourceUrl: string | null`; `LinkRow.saving: { status: 'queued' | 'failed'; error: string | null } | null`.

- [ ] **Step 1: Schema.** Add `sourceUrl: text('source_url')` (nullable, comment "The YouTube URL this was saved from; null for an upload.") to `recordings` and `lessonVideos`. After `links`, add:

```ts
/**
 * A YouTube link being saved as a video by the home worker. See
 * `docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`.
 *
 * No `done` status: success deletes the row, with the link, in the transaction
 * that inserts the video. The owner is copied from the link so completing does
 * not read a row it is about to delete. CHECKs are safe: the table is new.
 */
export const videoDownloads = sqliteTable(
	'video_downloads',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		linkId: integer('link_id')
			.notNull()
			.unique()
			.references(() => links.id),
		figureId: integer('figure_id').references(() => figures.id),
		lessonId: integer('lesson_id').references(() => lessons.id),
		url: text('url').notNull(),
		status: text('status', { enum: ['queued', 'failed'] }).notNull(),
		error: text('error'),
		attempts: integer('attempts').notNull().default(0),
		claimedAt: integer('claimed_at'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'video_downloads_owner_ck',
			sql`(${t.figureId} is not null) + (${t.lessonId} is not null) = 1`
		),
		check('video_downloads_status_ck', sql`${t.status} in ('queued', 'failed')`),
		index('video_downloads_status_idx').on(t.status, t.createdAt)
	]
);
```

- [ ] **Step 2: Generate and read.** `npm run db:generate`; `cat drizzle/0014_*.sql`. Expected: `CREATE TABLE video_downloads`, its indexes, `ALTER TABLE recordings ADD source_url`, `ALTER TABLE lesson_videos ADD source_url`. No `__new_` tables. If there are, stop.

- [ ] **Step 3: Types.** Add `sourceUrl: string | null;` to `RecordingRow` and `LessonVideoRow`; add `saving: { status: 'queued' | 'failed'; error: string | null } | null;` to `LinkRow`. In `getLesson`'s video select add `sourceUrl: lessonVideos.sourceUrl`; in `practice-content.ts`'s recording map add `sourceUrl: r.sourceUrl`.

- [ ] **Step 4: Typecheck.** `npx svelte-check` — the only errors should be `listLinks` not returning `saving` (fixed in Task 2). Commit after Task 2 so the tree type-checks.

### Task 2: Data layer — `video-downloads.ts`, links

**Files:**
- Create: `src/lib/server/video-downloads.ts`, `src/lib/server/video-downloads.spec.ts`
- Modify: `src/lib/server/links.ts` (`listLinks` saving, `deleteLink` cancels)

**Interfaces:**
- Consumes: `videoDownloads`, `LEASE_MS`, `MAX_ATTEMPTS`, `parseLink`.
- Produces:
  - `type SaveOwner = { figureId: number } | { lessonId: number }`
  - `requestVideoDownload(db, owner: LinkOwner, linkId: number): 'ok' | 'not-found' | 'not-youtube'`
  - `retryVideoDownload(db, owner: LinkOwner, linkId: number): boolean`
  - `claimVideoJob(db, now: number): { id: number; url: string } | null`
  - `failVideoJob(db, id: number, error: string, permanent: boolean): void`
  - `completeVideoJob(db, id: number, file: { file: string; mime: string; sizeBytes: number }): { recordingId: number } | { lessonVideoId: number } | null`
  - `videoJobTarget(db, id: number): 'recording' | 'lesson-video' | null` (which directory the route writes into)

- [ ] **Step 1: Failing tests** in `video-downloads.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { videoDownloads } from './db/schema';
import { createCustomExercise } from './exercises';
import { createFigure, getFigure } from './figures';
import { createLesson, getLesson } from './lessons';
import { addLinks, deleteLink, listLinks } from './links';
import { listSpots } from './spots';
import { LEASE_MS, MAX_ATTEMPTS } from './songs';
import {
	claimVideoJob,
	completeVideoJob,
	failVideoJob,
	requestVideoDownload,
	retryVideoDownload
} from './video-downloads';

const YT = 'https://youtu.be/dQw4w9WgXcQ';
const T = 1_800_000_000_000;
const FILE = { file: 'a.mp4', mime: 'video/mp4', sizeBytes: 1234 };
let db: Db;
let figureId: number;
let lessonId: number;

beforeEach(() => {
	db = openDb(':memory:');
	figureId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-14', title: 'Class', notes: null })
		.lesson.id;
});

const linkOn = (owner: { figureId: number } | { lessonId: number } | { exerciseId: number }, url = YT) =>
	addLinks(db, owner, [url], null)![0].id;

describe('requestVideoDownload', () => {
	it('queues a YouTube link once, and shows it as saving', () => {
		const id = linkOn({ figureId });
		expect(requestVideoDownload(db, { figureId }, id)).toBe('ok');
		expect(requestVideoDownload(db, { figureId }, id)).toBe('ok');
		expect(db.select().from(videoDownloads).all()).toHaveLength(1);
		expect(listLinks(db, { figureId })[0].saving).toEqual({ status: 'queued', error: null });
	});

	it('refuses a web link, another page’s link, and a drill’s link', () => {
		const web = linkOn({ figureId }, 'https://a.org/x');
		expect(requestVideoDownload(db, { figureId }, web)).toBe('not-youtube');
		const onLesson = linkOn({ lessonId });
		expect(requestVideoDownload(db, { figureId }, onLesson)).toBe('not-found');
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 2, notes: null });
		const d = linkOn({ exerciseId: drill.id });
		expect(requestVideoDownload(db, { exerciseId: drill.id }, d)).toBe('not-found');
	});

	it('leaves a failed job failed; Retry requeues it', () => {
		const id = linkOn({ figureId });
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		failVideoJob(db, job.id, 'Video unavailable', true);
		requestVideoDownload(db, { figureId }, id);
		expect(listLinks(db, { figureId })[0].saving).toEqual({
			status: 'failed',
			error: 'Video unavailable'
		});
		expect(retryVideoDownload(db, { figureId }, id)).toBe(true);
		expect(listLinks(db, { figureId })[0].saving).toEqual({ status: 'queued', error: null });
		expect(claimVideoJob(db, T)?.id).toBe(job.id);
	});
});

describe('claimVideoJob / failVideoJob', () => {
	it('leases, retakes a stale claim, and gives up after MAX_ATTEMPTS', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		let now = T;
		expect(claimVideoJob(db, now)).toEqual({ id: expect.any(Number), url: YT });
		expect(claimVideoJob(db, now + LEASE_MS - 1)).toBeNull();
		for (let i = 1; i < MAX_ATTEMPTS; i++) {
			now += LEASE_MS + 1;
			expect(claimVideoJob(db, now)).not.toBeNull();
		}
		now += LEASE_MS + 1;
		expect(claimVideoJob(db, now)).toBeNull();
		expect(listLinks(db, { lessonId })[0].saving?.status).toBe('failed');
	});

	it('keeps a transient failure queued under its lease', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		const job = claimVideoJob(db, T)!;
		failVideoJob(db, job.id, 'HTTP Error 503', false);
		expect(listLinks(db, { lessonId })[0].saving).toEqual({
			status: 'queued',
			error: 'HTTP Error 503'
		});
		expect(claimVideoJob(db, T + 1)).toBeNull();
	});
});

describe('completeVideoJob', () => {
	it('turns a figure link into a recording with its source and a start spot', () => {
		const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90';
		const id = linkOn({ figureId }, url);
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		const done = completeVideoJob(db, job.id, FILE);
		expect(done).toEqual({ recordingId: expect.any(Number) });
		const [rec] = getFigure(db, figureId)!.recordings;
		expect(rec).toMatchObject({ file: 'a.mp4', kind: 'video', sourceUrl: url, sizeBytes: 1234 });
		expect(listLinks(db, { figureId })).toEqual([]);
		expect(db.select().from(videoDownloads).all()).toEqual([]);
		expect(listSpots(db, { recordingId: rec.id })).toMatchObject([{ startMs: 90_000, endMs: null }]);
	});

	it('turns a lesson link into a lesson video, no spot without a start', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		const job = claimVideoJob(db, T)!;
		const done = completeVideoJob(db, job.id, FILE) as { lessonVideoId: number };
		expect(getLesson(db, lessonId)!.videos[0]).toMatchObject({ sourceUrl: YT });
		expect(listSpots(db, { lessonVideoId: done.lessonVideoId })).toEqual([]);
	});

	it('is null for a job that is gone, and removing the link cancels the job', () => {
		const id = linkOn({ figureId });
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		expect(deleteLink(db, { figureId }, id)).toBe(true);
		expect(db.select().from(videoDownloads).where(eq(videoDownloads.id, job.id)).all()).toEqual([]);
		expect(completeVideoJob(db, job.id, FILE)).toBeNull();
		expect(getFigure(db, figureId)!.recordings).toEqual([]);
	});
});
```

- [ ] **Step 2:** `npx vitest run src/lib/server/video-downloads.spec.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `video-downloads.ts`:**

```ts
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { lessonVideos, links, recordings, videoDownloads, videoSpots } from './db/schema';
import { LEASE_MS, MAX_ATTEMPTS } from './songs';
import type { LinkOwner } from './links';
import { parseLink } from '$lib/links';

/**
 * Saving a YouTube link as a figure recording or lesson video: the queue the
 * home worker drains through `/api/worker/videos/`. See
 * `docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`.
 */

function linkOf(db: Db, owner: LinkOwner, linkId: number) {
	if ('exerciseId' in owner) return null; // drills keep their links as links
	const where =
		'figureId' in owner ? eq(links.figureId, owner.figureId) : eq(links.lessonId, owner.lessonId);
	return db.select().from(links).where(and(eq(links.id, linkId), where)).get() ?? null;
}

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

/** The oldest queued job, leased. Same lease and attempt rules as `claimJob` for songs. */
export function claimVideoJob(db: Db, now: number): { id: number; url: string } | null {
	return db.transaction((tx) => {
		const stale = or(isNull(videoDownloads.claimedAt), lt(videoDownloads.claimedAt, now - LEASE_MS));
		const queued = eq(videoDownloads.status, 'queued');
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

/** As `failJob`: transient keeps its lease (the lease is the backoff); permanent or last attempt fails it. */
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

/** Where the finished file goes, or null when the job is gone. */
export function videoJobTarget(db: Db, id: number): 'recording' | 'lesson-video' | null {
	const job = db.select().from(videoDownloads).where(eq(videoDownloads.id, id)).get();
	if (!job) return null;
	return job.figureId !== null ? 'recording' : 'lesson-video';
}

/**
 * The video arrived. One transaction: the recording or lesson video (with its
 * source), a point spot at the link's start time, then the job and the link go.
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
							.values({ figureId: job.figureId, kind: 'video', note: null, sourceUrl: job.url, ...input })
							.returning({ id: recordings.id })
							.get().id
					}
				: {
						lessonVideoId: tx
							.insert(lessonVideos)
							.values({ lessonId: job.lessonId!, sourceUrl: job.url, ...input })
							.returning({ id: lessonVideos.id })
							.get().id
					};
		const parsed = parseLink(job.url);
		const start = parsed?.kind === 'youtube' ? parsed.start : null;
		if (start) tx.insert(videoSpots).values({ ...owner, startMs: start * 1000, endMs: null }).run();
		tx.delete(videoDownloads).where(eq(videoDownloads.id, id)).run();
		tx.delete(links).where(eq(links.id, job.linkId)).run();
		return owner;
	});
}
```

- [ ] **Step 4: `links.ts`.** `listLinks` left-joins `videoDownloads` on `linkId` and maps to `saving`:

```ts
export function listLinks(db: Db, owner: LinkOwner): LinkRow[] {
	return db
		.select({ ...row, status: videoDownloads.status, error: videoDownloads.error })
		.from(links)
		.leftJoin(videoDownloads, eq(videoDownloads.linkId, links.id))
		.where(ownedBy(owner))
		.orderBy(asc(links.createdAt), asc(links.id))
		.all()
		.map(({ status, error, ...link }) => ({
			...link,
			saving: status === null ? null : { status, error }
		}));
}
```

`insertLinks` returns `LinkRow[]` too — give those `saving: null` (`.returning(row).get()` then spread `saving: null`). `deleteLink` becomes a transaction that deletes the job of `id` only when the link belongs to `owner`:

```ts
export function deleteLink(db: Db, owner: LinkOwner, id: number): boolean {
	return db.transaction((tx) => {
		const mine = tx.select({ id: links.id }).from(links).where(and(eq(links.id, id), ownedBy(owner))).get();
		if (!mine) return false;
		// A save in flight goes with its link — the foreign key would refuse the link otherwise.
		tx.delete(videoDownloads).where(eq(videoDownloads.linkId, id)).run();
		return tx.delete(links).where(eq(links.id, id)).run().changes > 0;
	});
}
```

- [ ] **Step 5:** `npx vitest run src/lib/server/` → PASS (also `links.spec`, `practice-content.spec`; fix any `toEqual` there that now needs `saving: null`/`sourceUrl: null`).

- [ ] **Step 6: Commit** Task 1 + 2: "Saved videos: the video_downloads queue and source_url".

### Task 3: Shared chunk writer in `files.ts`

**Files:**
- Modify: `src/lib/server/files.ts`, `src/routes/api/lessons/[id]/videos/[uploadId]/+server.ts`

**Interfaces:**
- Produces: `writeChunk(request: Request, partial: string, maxTotal: number): Promise<{ done: false; received: number } | { done: true; total: number } | Response>` — validates `content-range`, chunk size, `video/*` type, body; appends; returns a `Response` (JSON `{message}` with the same statuses and texts as today) on any refusal. Also `failJson(status, message, headers?)`.

- [ ] **Step 1:** Move from the lesson route into `files.ts`: the `writing` Set, `fail` (as `failJson`), the content-range/size/type/body checks and the `appendStream` call with its error mapping. Messages that name a lesson ("Only video files can be added to a lesson.", "That video is bigger than the 1 GB limit.") become parameters? Keep them generic where the lesson spec does not assert them; check `server.spec.ts` for asserted messages first (`grep -n "message" server.spec.ts`) and keep those exact.
- [ ] **Step 2:** The lesson route calls `writeChunk`; behaviour unchanged.
- [ ] **Step 3:** `npx vitest run src/routes/api/lessons src/lib/server/files.spec.ts` → PASS unchanged.
- [ ] **Step 4: Commit** "files: one chunk writer for every chunked upload".

### Task 4: Worker endpoints

**Files:**
- Create: `src/routes/api/worker/videos/claim/+server.ts`, `src/routes/api/worker/videos/[id]/file/+server.ts`, `src/routes/api/worker/videos/[id]/fail/+server.ts`, `src/routes/api/worker/videos/[id]/file/server.spec.ts`

**Interfaces:**
- Consumes: `claimVideoJob`, `failVideoJob`, `videoJobTarget`, `completeVideoJob`, `writeChunk`, `recordingsDir`, `lessonVideosDir`, `uploadsDir`.

- [ ] **Step 1: Failing spec** (mocks as the lesson-video spec does): a figure job; PUT `bytes 0-3/10` → 204 `x-received-bytes: 4`; PUT `bytes 6-9/10` → 409 `x-received-bytes: 4`; PUT `bytes 4-9/10` → 201, recording with `sourceUrl`, link gone; that same PUT again → 410 and still one recording; a second job whose link is deleted after a first chunk → next chunk 410 and `uploads/video-<id>.part` no longer exists.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** `claim`: `claimVideoJob(getDb(), Date.now())` → 200 json / 204. `fail`: parse `{ error, permanent }` like `songs/[id]/fail/+server.ts`, call `failVideoJob`, 204. `file` PUT:

```ts
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const db = getDb();
	const partial = join(uploadsDir(), `video-${id}.part`);
	const target = Number.isSafeInteger(id) && id > 0 ? videoJobTarget(db, id) : null;
	if (!target) {
		await unlink(partial).catch(() => {});
		return failJson(410, 'This video is no longer wanted.');
	}
	const chunk = await writeChunk(request, partial, MAX_LESSON_VIDEO_BYTES);
	if (chunk instanceof Response) return chunk;
	if (!chunk.done) return new Response(null, { status: 204, headers: { 'x-received-bytes': String(chunk.received) } });

	const file = `${randomUUID()}.mp4`;
	const dest = join(target === 'recording' ? recordingsDir() : lessonVideosDir(), file);
	await rename(partial, dest);
	const done = completeVideoJob(db, id, { file, mime: 'video/mp4', sizeBytes: chunk.total });
	if (!done) {
		// The link was removed while the last chunk streamed in.
		await unlink(dest).catch(() => {});
		return failJson(410, 'This video is no longer wanted.');
	}
	return json(done, { status: 201 });
};
```

- [ ] **Step 4:** Run → PASS. `npm run check` subset: `npx svelte-check`.
- [ ] **Step 5: Commit** "Worker API: claim, upload and fail a saved video".

### Task 5: Page actions

**Files:**
- Modify: `src/lib/server/link-form.ts`, `src/lib/server/link-form.spec.ts`, `src/routes/[dance]/figures/[id]/+page.server.ts`, `src/routes/[dance]/lessons/[id]/+page.server.ts`

**Interfaces:**
- Produces: `saveVideoFrom(request, db, owner)` and `retryVideoFrom(request, db, owner)` returning `{ action: 'saveVideo' | 'retryVideo', ok: true }` or `fail(404|400, { action, message })`.

- [ ] **Step 1: Failing test** in `link-form.spec.ts`: `saveVideoFrom` with a form `linkId=<yt link>` → ok and a job; with a web link → 400 "Only a YouTube link can be saved as a video."; unknown id → 404 "That link was already removed."; `retryVideoFrom` on a failed job → ok.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**

```ts
export async function saveVideoFrom(request: Request, db: Db, owner: LinkOwner) {
	const id = int(await request.formData(), 'linkId');
	const result = id === undefined ? 'not-found' : requestVideoDownload(db, owner, id);
	if (result === 'not-found')
		return fail(404, { action: 'saveVideo' as const, message: 'That link was already removed.' });
	if (result === 'not-youtube')
		return fail(400, { action: 'saveVideo' as const, message: 'Only a YouTube link can be saved as a video.' });
	return { action: 'saveVideo' as const, ok: true };
}

export async function retryVideoFrom(request: Request, db: Db, owner: LinkOwner) {
	const id = int(await request.formData(), 'linkId');
	if (id === undefined || !retryVideoDownload(db, owner, id))
		return fail(404, { action: 'retryVideo' as const, message: 'That link was already removed.' });
	return { action: 'retryVideo' as const, ok: true };
}
```

Add `saveVideo` / `retryVideo` actions to the figure page (`{ figureId: figureOf(params).figure.id }`) and lesson page (`{ lessonId: lessonOf(params).lesson.id }`), beside `deleteLink`.
- [ ] **Step 4:** Run → PASS. **Commit** "Figure and lesson pages: save and retry a YouTube video".

### Task 6: UI

**Files:**
- Modify: `src/lib/components/links/LinksEditor.svelte`, `src/lib/components/ui/VideoFrame.svelte`, `src/routes/[dance]/figures/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/components/exercises/kinds/figure/Content.svelte`, `src/lib/components/exercises/kinds/lesson/Content.svelte`

- [ ] **Step 1: LinksEditor.** New prop `canSave = false`. In the `actions` snippet, before Remove, for `canSave && parseLink(link.url)?.kind === 'youtube'`:

```svelte
{#if link.saving?.status === 'queued'}
	<span class="mr-auto self-center px-2 text-[13px] text-muted"
		>Saving — the home worker picks it up within a few minutes</span
	>
{:else if link.saving?.status === 'failed'}
	<span class="mr-auto self-center px-2 text-[13px] text-danger"
		>Couldn't save: {link.saving.error ?? 'unknown error'}</span
	>
	<form method="POST" action="?/retryVideo" use:enhance>
		<input type="hidden" name="linkId" value={link.id} />
		<button type="submit" class="h-9 px-2 text-[13px]">Retry</button>
	</form>
{:else}
	<form method="POST" action="?/saveVideo" use:enhance class="mr-auto">
		<input type="hidden" name="linkId" value={link.id} />
		<button type="submit" class="h-9 px-2 text-[13px]">Save video</button>
	</form>
{/if}
```

Pass `canSave` from the figure and lesson pages' `<LinksEditor>`; the exercise page does not.
- [ ] **Step 2: VideoFrame.** Prop `sourceUrl?: string | null`. In the control row, last: `{#if sourceUrl}<a href={sourceUrl} target="_blank" rel="external noopener noreferrer" class="ml-auto text-muted">from YouTube ↗</a>{/if}`. Pass `sourceUrl={rec.sourceUrl}` / `sourceUrl={video.sourceUrl}` at the four call sites.
- [ ] **Step 3:** `npm run check` → PASS. Look at both pages in `npm run dev` with a hand-inserted queued and failed job (sqlite3 `.data/…`), and a recording with `source_url`.
- [ ] **Step 4: Commit** "Links: Save video, its progress, and 'from YouTube' on the result".

### Task 7: Worker

**Files:**
- Modify: `worker/salsa_worker/media.py`, `worker/salsa_worker/api.py`, `worker/salsa_worker/jobs.py`, `worker/salsa_worker/__main__.py`
- Test: `worker/tests/test_media.py`, `worker/tests/test_api.py`, `worker/tests/test_jobs.py`

**Interfaces:**
- Produces: `media.MAX_VIDEO_S = 3600`; `media.fetch_video(url, workdir, run=subprocess.run) -> Path`; `media.to_mp4(src, dest, run=subprocess.run) -> None`; `api.JobGone`; `Api.claim_video() -> dict | None`; `Api.upload_video(job_id, path, chunk=8 MiB) -> None`; `Api.fail_video(job_id, error, permanent)`; `jobs.VideoTools(fetch_video, to_mp4)`; `jobs.process_video(job, api, tools, workdir) -> bool`; `jobs.run(api, tools, video_tools=None, max_jobs=20)`.

- [ ] **Step 1: Failing tests.**
  - media: `fetch_video` cmd contains `"bv*[height<=480]+ba/b[height<=480]/b"`, `"duration <= 3600"`, `"--no-playlist"`; returns the `video.*` file it made; "Private video" in stderr → `PermanentError`; exit 0 and no file → `PermanentError`. `to_mp4` cmd contains `libx264`, `-crf`, `28`, `+faststart`, `scale=-2:'min(480,ih)'`; non-zero exit → `PermanentError`.
  - api: `upload_video` on a 10-byte file with `chunk=4` sends three PUTs to `/api/worker/videos/7/file` with `bytes 0-3/10`, `bytes 4-7/10`, `bytes 8-9/10`, `Content-Type: video/mp4`; a fake answering the 2nd PUT with 409 `x-received-bytes: 6` makes the next PUT `bytes 6-9/10`; a 410 raises `JobGone`; a 413 raises `PermanentError`.
  - jobs: `run` with one song job and one video job processes the song first; `process_video` that hits `JobGone` returns True and calls no `fail_video`; a `PermanentError` calls `fail_video(id, msg, True)`.
- [ ] **Step 2:** `cd worker && nix shell --impure --expr 'with import <nixpkgs> {}; python3.withPackages (p: [ p.pytest ])' -c python -m pytest -q` → FAIL.
- [ ] **Step 3: Implement.**

`media.py`:

```python
# A saved video: an hour of class is plenty, and longer is almost always a stream.
MAX_VIDEO_S = 3600


def fetch_video(url: str, workdir: Path, run=subprocess.run) -> Path:
    """At most 480p, video and audio merged into workdir/video.mkv (re-encoded next by to_mp4)."""
    cmd = [
        "yt-dlp", "--no-playlist", "--no-warnings", "--no-progress",
        "-f", "bv*[height<=480]+ba/b[height<=480]/b",
        "--merge-output-format", "mkv",
        "--match-filter", f"duration <= {MAX_VIDEO_S}",
        "-o", str(workdir / "video.%(ext)s"),
        url,
    ]
    p = run(cmd, capture_output=True, text=True, timeout=1800)
    if p.returncode != 0:
        msg = _last_line(p.stderr)
        if any(m in p.stderr for m in PERMANENT_MARKERS):
            raise PermanentError(msg)
        raise RuntimeError(msg)
    made = sorted(workdir.glob("video.*"))
    if not made:
        raise PermanentError("Longer than 60 minutes, or nothing to download.")
    return made[0]


def to_mp4(src: Path, dest: Path, run=subprocess.run) -> None:
    """H.264 + AAC with the index up front: plays on every phone, streams with Range from the first byte."""
    p = run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src),
         "-vf", "scale=-2:'min(480,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
         "-movflags", "+faststart", str(dest)],
        capture_output=True, text=True, timeout=3600,
    )
    if p.returncode != 0:
        raise PermanentError(f"Could not encode the video: {_last_line(p.stderr)}")
```

`api.py`: `class JobGone(Exception)`; `claim_video` posts `/api/worker/videos/claim`; `fail_video` posts `/api/worker/videos/{id}/fail`; `upload_video`:

```python
CHUNK_BYTES = 8 * 1024 * 1024

    def upload_video(self, job_id: int, path: Path, chunk: int = CHUNK_BYTES) -> None:
        """8 MiB chunks; a 409 says where the server is, and the upload carries on from there."""
        total = path.stat().st_size
        offset = 0
        with open(path, "rb") as f:
            while offset < total:
                f.seek(offset)
                data = f.read(chunk)
                headers = {
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes {offset}-{offset + len(data) - 1}/{total}",
                }
                try:
                    with self._request("PUT", f"/api/worker/videos/{job_id}/file", data=data, headers=headers, timeout=300) as r:
                        offset = int(r.headers.get("x-received-bytes") or total) if r.status == 204 else total
                except ApiError as e:
                    if e.status == 410:
                        raise JobGone(e.message) from e
                    if e.status == 409 and e.received is not None:
                        offset = e.received
                        continue
                    if e.status == 413:
                        raise PermanentError(e.message) from e
                    raise
```

`ApiError` gains `received: int | None` read from the error's `x-received-bytes` header in `_request`. The test fake `Response` gains a `headers` dict.

`jobs.py`: `VideoTools(fetch_video, to_mp4)`; `process_video` = fetch → `to_mp4(src, workdir/"out.mp4")` → `api.upload_video` → True; `JobGone` → log, True; errors → `api.fail_video` as for songs. `run(api, tools, video_tools=None, max_jobs=20)` drains songs as today, then (if no failure and budget left and `video_tools`) `api.claim_video()` jobs.

`__main__.py`: pass `video_tools=jobs.VideoTools(media.fetch_video, media.to_mp4)`.
- [ ] **Step 4:** pytest → PASS.
- [ ] **Step 5: Commit** "Worker: download, encode and upload saved videos".

### Task 8: Docs

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `docs/superpowers/specs/2026-10-01-video-player-design.md`, `docs/deployment.md`

- [ ] **Step 1:** CLAUDE.md: "Live" list gains saved YouTube videos; spec pointer paragraph gains the new spec; Layout `routes/` line mentions `api/worker/videos/*` (one chunk per request); hard rule "Archive, don't delete" lists `video_downloads` among hard deletes.
- [ ] **Step 2:** Main spec: a short "Saved YouTube videos" section pointing at the new spec. Video player spec Known gaps: the YouTube line gains "Save video turns one into a recording or lesson video, which gets both." Deployment: the worker now also downloads videos (≤480p, ≤60 min); the journal logs `video <id>: saved`; the worker host needs yt-dlp + ffmpeg (already on its PATH).
- [ ] **Step 3: Commit** "Docs: saved YouTube videos".

### Task 9: End to end against `node build`

- [ ] **Step 1:** `npm run build`; start `node build` on a free port with `DATA_DIR`/`DATABASE_PATH` pointing at a scratch copy, `SALSA_WORKER_TOKEN=test`, `BODY_SIZE_LIMIT=20M`, `ORIGIN=http://localhost:<port>`.
- [ ] **Step 2:** Log in, add a short YouTube link (with `t=`) to a figure, press Save video.
- [ ] **Step 3:** Run the worker once: `cd worker && SALSA_URL=http://localhost:<port> SALSA_WORKER_TOKEN=test BEAT_THIS_CHECKPOINT=x nix shell nixpkgs#yt-dlp nixpkgs#ffmpeg-headless nixpkgs#python3 -c python -m salsa_worker`.
- [ ] **Step 4:** Reload the figure page: a recording with "from YouTube ↗", the link gone, a spot at the start time; open full screen, add a loop. `ffprobe` the file: h264, height ≤ 480.
- [ ] **Step 5:** `npm run check` green; final whole-branch review.
