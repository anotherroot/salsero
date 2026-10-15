# Saving a YouTube video — design

> **Status:** approved in brainstorming, 2026-10-15. Builds on
> [`2026-10-01-video-player-design.md`](2026-10-01-video-player-design.md)
> (full screen and spots) and on the home worker of the main design spec.

## Purpose

A YouTube link on a figure or a lesson plays as an embed, and an embed gets
neither the full-screen player nor spots (a "Known gaps" entry of the video
player spec). It also disappears the day its uploader deletes it.

**Save video** on a YouTube link hands the link to the home worker, which
downloads it at 480p, re-encodes it to a small H.264 MP4 and uploads it. The
link then BECOMES an ordinary figure recording or lesson video: full screen,
loops and spots work on it unchanged, and it stays when YouTube loses it.

Asked and decided:

- **Figures and lessons only.** A drill (custom exercise) has links but no
  stored videos, and giving it some would need a third owner on
  `video_spots` — a CHECK change, so a table rebuild, which the repo forbids.
  A drill's YouTube links show no Save button.
- **The video replaces the link.** On success the link row is deleted and the
  video carries the URL in a new `source_url` column, shown as
  "from YouTube ↗" beside the player. Nothing appears twice.
- **At most 480p, at most 60 minutes.** A longer video fails for good, as a
  song over 15 minutes does.
- A link with a start time (`t=90`) gets a **point spot** at that time, so the
  moment that was linked is one tap away.

## Data model

```
video_downloads                       -- new; one row per link being saved
  id          integer pk
  link_id     fk links, not null, unique   -- one job per link
  figure_id   fk figures, nullable
  lesson_id   fk lessons, nullable
  url         text not null           -- copied from the link
  status      text not null           -- 'queued' | 'failed'
  error       text, nullable
  attempts    integer not null default 0
  claimed_at  integer, nullable       -- epoch ms; the lease
  created_at  integer                 -- epoch ms
  CHECK (figure_id is not null) + (lesson_id is not null) = 1
  CHECK status in ('queued', 'failed')

recordings.source_url     text, nullable   -- ADD COLUMN
lesson_videos.source_url  text, nullable   -- ADD COLUMN
```

- The CHECKs are safe because `video_downloads` is new. The two other changes
  are additive `ALTER TABLE ... ADD COLUMN`; the generated SQL must be exactly
  one `CREATE TABLE` (plus its indexes) and two `ADD COLUMN`s — read it.
- **There is no `done` status.** Success deletes the job, in the same
  transaction that inserts the video and deletes the link.
- **No `dance` column.** A job is the dance of its figure or lesson, like the
  link it came from.
- The owner is stored on the job rather than read through the link, so
  completing it does not depend on a row it is about to delete.

## Server

`src/lib/server/video-downloads.ts`, every function taking `db` first:

- `requestVideoDownload(db, owner, linkId)` → `'ok' | 'not-found' | 'not-youtube'`.
  The link must belong to `owner` (a `{ figureId }` or `{ lessonId }`; an
  `{ exerciseId }` is refused as `not-found`) and parse as YouTube. A link that
  already has a job is `'ok'` and changes nothing — Retry is its own action.
- `retryVideoDownload(db, owner, linkId)` → boolean. Back to `queued`,
  attempts 0, error and lease cleared.
- `claimVideoJob(db, now)` → `{ id, url } | null`. Same lease and attempt
  rules as `claimJob` for songs (`LEASE_MS`, `MAX_ATTEMPTS`): a stale claim is
  retaken, one that went stale `MAX_ATTEMPTS` times is failed instead.
- `failVideoJob(db, id, error, permanent)`. As `failJob`: a transient failure
  keeps its lease (the lease is the backoff); a permanent one, or the last
  attempt, sets `failed`.
- `completeVideoJob(db, id, { file, mime, sizeBytes })` → the new video row's
  owner and id, or `null` when the job is gone. One transaction: insert the
  recording (`kind = 'video'`, `note` null) or lesson video with
  `source_url`; add the start spot when `parseLink(url).start > 0`; delete the
  job; delete the link.
- `deleteLink` deletes the link's job first, in one transaction — the foreign
  key refuses the link otherwise. Removing a saving link cancels the save.
- `listLinks` left-joins the job: `LinkRow` gains
  `saving: { status: 'queued' | 'failed'; error: string | null } | null`.
- `RecordingRow` and `LessonVideoRow` gain `sourceUrl: string | null`, filled
  everywhere they are read (the figure and lesson pages, the log popups).

### Worker endpoints

Under `/api/worker/videos/`, so the hook's bearer-token check already covers
them. A separate queue from songs on purpose: the server and the worker deploy
separately, and the current worker treats any job from `/api/worker/claim`
that is not a `download` as an analysis job — a video job reaching it there
would be processed as a song. On this endpoint an old worker never looks.

- `POST claim` → 200 `{ id, url }`, or 204.
- `PUT [id]/file` — one chunk per request, `content-range: bytes s-e/total`,
  `content-type: video/*`. The partial is `uploads/video-<id>.part`, so the
  boot sweep collects an abandoned one like any other. The same rules as a
  lesson video's chunks: a chunk must start where the file ends, else 409 with
  `x-received-bytes`; total at most `MAX_LESSON_VIDEO_BYTES` (1 GiB, the
  chunked cap); a chunk at most `MAX_UPLOAD_CHUNK_BYTES`. 204 with
  `x-received-bytes` until the last chunk; the last renames the file into
  `recordings/` or `lesson-videos/`, calls `completeVideoJob` and answers 201.
  A job that no longer exists (link removed, already completed) answers **410**
  and the partial is deleted.
- `POST [id]/fail` — `{ error, permanent }`. Unknown job: 204, ignored.

The chunk-writing part of the lesson-video route (offset check, size caps,
the 413 hint about `BODY_SIZE_LIMIT`) moves into a shared helper in
`files.ts` that both routes call, rather than being copied.

### Page actions

On the figure and lesson pages, beside `addLink`/`deleteLink`:
`saveVideo` and `retryVideo`, each taking `linkId`. One-tap forms, so
`use:enhance`.

## Worker

- `media.fetch_video(url, workdir)` — yt-dlp with
  `-f "bv*[height<=480]+ba/b[height<=480]/b"`, `--merge-output-format mkv`,
  `--match-filter "duration <= 3600"`, the same `PERMANENT_MARKERS`. Nothing
  downloaded with exit 0 means the duration filter skipped it: permanent.
- `media.to_mp4(src, dest)` — always re-encode, so every saved video plays
  everywhere, iPhones included: `-c:v libx264 -preset veryfast -crf 28
  -vf "scale=-2:'min(480,ih)'" -pix_fmt yuv420p -c:a aac -b:a 96k -ac 2
  -movflags +faststart`. Roughly 4–6 MB a minute.
- `api.claim_video()`, `api.upload_video(id, path)` (8 MiB chunks; on a 409
  resume from `x-received-bytes`; a 410 raises `JobGone`),
  `api.fail_video(id, error, permanent)`.
- `jobs.process_video(job, api, tools, workdir)` — fetch, encode, upload. A
  `JobGone` is logged and is not a failure. Other errors are reported exactly
  as for songs.
- `jobs.run` drains songs first, then videos, sharing the 20-job budget and
  stopping at the first failure. Songs first because a song is seconds of
  work and an hour of video can be ten minutes of encoding on two cores.

## UI

- `LinksEditor` takes `canSave`; the figure and lesson pages pass it, the
  drill page does not. On a YouTube row with `canSave`, next to Remove:
  - no job: **Save video**;
  - queued: "Saving — the home worker picks it up within a few minutes";
  - failed: "Couldn't save: <error>" and **Retry**.
- No polling. The video appears on the next page load; a reload must never
  interrupt a form being filled in.
- `VideoFrame` takes an optional `sourceUrl`, shown as "from YouTube ↗"
  (`target="_blank" rel="external noopener noreferrer"`) in its control row.
  All four call sites pass it.

## Errors

| What | Where it lands |
| --- | --- |
| Deleted, private, members-only, over 60 min | permanent: `failed`, Retry shown |
| Network, bot check, YouTube change | transient: retried after the lease, `failed` after 5 attempts |
| ffmpeg cannot decode | permanent |
| Link removed mid-download | 410 on upload; worker drops the job, server drops the partial |
| Upload's last 201 lost | the retry gets 410; the video is already saved |
| Over 1 GiB after encoding | 413 → permanent failure |

## Testing

- `video-downloads.spec.ts` against `openDb(':memory:')`: request rules
  (YouTube only, figure and lesson only, owner check, idempotent), claim
  lease and attempt limit, fail transient vs permanent, complete for a figure
  and for a lesson (row with `source_url`, link gone, job gone, start spot),
  delete-link cancels, `listLinks`' `saving`.
- The worker chunk route's spec with `vi.mock('$lib/server/db')`, as the
  lesson-video route's: resume, wrong offset, last chunk completes, gone job
  is 410 and leaves no partial. The lesson-video spec keeps passing
  unchanged after the helper moves.
- Worker pytest: `fetch_video`'s and `to_mp4`'s arguments and error mapping
  through an injected runner; chunked upload and resume with a fake
  `urlopen`; `run` order (songs before videos) and `JobGone`.
- End to end against `node build`, never `vite dev`: the worker run by hand
  against it on a short YouTube video, then full screen and a loop on the
  result.

## Known gaps

- A saved figure video lands in `recordings/`, which is backed up, and may be
  far larger than the 95 MiB a browser upload of a recording is capped at.
- There is no progress while the worker downloads; "Saving" is all the page
  knows until the next load.
- Drills cannot save videos (see Purpose).
