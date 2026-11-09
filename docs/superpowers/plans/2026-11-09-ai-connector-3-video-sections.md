# AI connector plan 3: video sections (the experiment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The connected AI can look at a lesson video or a video recording (small frames every 2 s, and the sound as MCP audio) and propose sections into the existing queue; a script measures its sections against the person's own.

**Architecture:** A new table `ai_timelines` holds one preparing job per video. The first `video_timeline` call queues it; the home worker claims it, cuts frames (ffmpeg, 1 every 2 s, 384 px wide JPEG) and 60 s mono MP3 pieces, and uploads one JSON piece per minute to `$DATA_DIR/timelines/<id>/<k>.json`. The tool reads the pieces covering the asked stretch and answers with text + image + audio content. Proposals go through plan 2's `propose` (`add_section`, `link_section`), which the Suggestions page already plays in a loop. An hourly sweep removes timelines unused for 30 days or whose video is gone.

**Tech Stack:** SvelteKit + Drizzle/SQLite, the hand-written MCP protocol (`src/lib/mcp/protocol.ts`), the Python home worker (`worker/`, ffmpeg, pytest).

**Spec:** `docs/superpowers/specs/2026-11-09-ai-connector-design.md`, section "The video sections experiment".

## Global Constraints

- No Whisper or other speech model on the worker; the AI makes out speech itself if it can (user's ruling).
- The server runs no media processing: frames and sound are cut by the worker only. The server stores and reads JSON pieces.
- Pieces do not count toward anyone's storage (`$DATA_DIR/timelines/`, never in `usedBytes`), and are removed 30 days after last use and with their video.
- Not ready: the first call queues the job and answers "being prepared, ask again in a minute or two", or "the home worker is offline" when it has not been seen for 15 minutes. No preparing ahead of time.
- MCP tools write nothing but `ai_*` tables (anti-goal 3). The new tools write only `ai_timelines` (+ `id_marks`).
- Every insert mints its id (`mintedId('ai_timelines')`) and the new table gets an `_id_mark` trigger in its migration, as 0045 does. Never synced: listed in `src/lib/sync/tables.ts` beside `ai_lines`.
- Server time through `serverNow()`; durations and positions are integer ms.
- Machines keep English: tool texts and worker refusals are English (refusals-guard MACHINES already covers `src/lib/server/ai-queue/`; add `src/lib/server/ai-timelines/` and the new worker routes if the guard flags them).
- Every new `/api/worker/` endpoint is classified in `src/lib/offline/routes.ts` (GET in the network list, writes `'network'` in `ENDPOINT_WRITES`).
- Numbers (Claude's calls, not the user's): piece 60 000 ms; a frame every 2 000 ms; frames 384 px wide, JPEG `-q:v 6`; sound mono 16 kHz MP3 24 kbit/s; at most 30 frames a call; sound only for stretches of at most 60 000 ms; piece body cap 4 MiB; a frame's base64 at most 256 KiB, a piece's sound at most 1 MiB base64; videos up to 3 600 s; worker offline after 15 min unseen; a failed timeline is asked again after 24 h; used_at rewritten at most hourly; `your_sections` at most 15.

## Review Focus

1. **The video is deleted while the worker prepares it.** Every worker route answers 410, the worker stops quietly (`JobGone`), the sweep removes the row and its pieces. Tests: Task 2 (`410 when the video is gone`), Task 5 (`a gone timeline is not a failure`).
2. **A video with no sound track.** Frames still arrive; pieces carry `sound: null`; `sound: true` answers frames plus a line "this video has no sound". Tests: Task 5 (`no audio stream still uploads frames`), Task 4 (`sound on a silent video`).
3. **Asking past the end.** `from_s` at or past the duration is refused with the video's length; the last piece is shorter than 60 s; `next_from_s` is null at the end. Test: Task 4 (`stretch past the end`).
4. **A video the person may not read, or a group video they may only read.** Another person's id answers exactly as a missing one; a group video the person can read can be looked at (the queue's `add_section` already refuses what they cannot edit). Test: Task 4 (`another person's video is missing`).
5. **Worker liveness after a server restart.** Never seen since boot is "being prepared", not "offline"; seen 16 min ago is offline. Test: Task 1 (`workerStatus`).

---

### Task 1: The `ai_timelines` table, its store, liveness and the sweep

**Files:**
- Modify: `src/lib/server/db/schema.ts` (new table after `aiLines`)
- Create: `drizzle/0046_*.sql` via `npm run db:generate`, then append the `ai_timelines_id_mark` trigger exactly as 0045's
- Modify: `src/lib/sync/tables.ts` (add `'ai_timelines'` after `'ai_lines'`)
- Create: `src/lib/server/ai-timelines/store.ts`, `src/lib/server/ai-timelines/store.spec.ts`
- Create: `src/lib/server/worker-seen.ts`, `src/lib/server/worker-seen.spec.ts`
- Modify: `src/lib/server/files.ts` (`timelinesDir()`), `src/hooks.server.ts` (note the worker seen once its token is accepted), `src/lib/server/trash.ts` (the hourly `runPurge` also sweeps timelines)

**Interfaces:**
- Produces:
  - table `ai_timelines`: `id` minted; `lesson_video_id` int null, `recording_id` int null (no foreign keys: a video's hard delete must not be blocked; the sweep drops orphans); `status` text `'queued'|'ready'|'failed'` (CHECK, new table); `error` text; `attempts` int default 0; `claimed_at`, `failed_at`, `pieces`, `duration_ms`, `ready_at`, `used_at` int null; `created_at`. CHECK exactly one owner; unique index on each owner column.
  - `type Timeline = { id: number; status: 'queued'|'ready'|'failed'; error: string|null; pieces: number|null; durationMs: number|null; createdAt: number; usedAt: number|null }`
  - `timelineOf(db, video: SpotOwner): Timeline | undefined`
  - `timelinesOf(db, videos: SpotOwner[]): Map<string, Timeline>` keyed `videoKey(video)` = `lv:<id>` / `rec:<id>`
  - `askTimeline(db, video: SpotOwner, now): Timeline`: the existing one, or a new queued one; a failed one whose `failed_at` is more than 24 h ago is re-queued with `attempts 0, error null, failed_at null`.
  - `claimTimeline(db, now): { id: number } | null`: oldest queued with a stale or empty lease; songs' `LEASE_MS` and `MAX_ATTEMPTS` (`$lib/server/songs`) and the same give-up rule as `claimVideoJob`.
  - `failTimeline(db, id, error, permanent, now): void` as `failVideoJob`, setting `failed_at = now` when it fails for good (also on the give-up in `claimTimeline`).
  - `finishTimeline(db, id, pieces: number, durationMs: number, now): boolean`: queued → ready, `ready_at = used_at = now`, lease cleared; false when the row is gone or not queued.
  - `timelineSource(db, id): { path: string } | null`: the video file's path (`lessonVideosDir()`/`recordingsDir()` + `file`); null when the row or its video is gone, or the recording is `kind: 'audio'`.
  - `touchTimeline(db, id, now): void`: `used_at = now` only when older than 1 h.
  - `sweepTimelines(db, now): number[]`: deletes rows unused (`used_at ?? created_at`) for 30 days or whose video row is gone; returns their ids. `removeTimelineFiles(ids)` (in store.ts, `rm -r` each `timelinesDir()/<id>`, missing is fine) runs after it in `runPurge`.
  - `timelineDir(id): string` = `join(timelinesDir(), String(id))`.
  - `noteWorkerSeen(now): void`; `workerStatus(now): 'online'|'offline'|'unknown'` (unknown = not seen since boot; offline = last seen more than 15 min ago); `resetWorkerSeen()` for specs. Module state on `globalThis` like trash's timer.

- [ ] **Step 1: Write the failing specs** (`store.spec.ts` on `openDb(':memory:')` + `makeWorld` from `../sync/test-world`):
  - `askTimeline queues once`: two calls on `{ lessonVideoId: w.video }` give the same id, status `'queued'`.
  - `claim, finish, ready`: `claimTimeline` returns it; a second claim inside the lease returns null; `finishTimeline(db, id, 3, 150_000, now)` → true; `timelineOf` is `{ status: 'ready', pieces: 3, durationMs: 150000 }`.
  - `a failed one is asked again after a day`: `failTimeline(..., true)`; `askTimeline` at +1 h is still failed; at +25 h is queued with attempts 0.
  - `the sweep`: a ready timeline used 31 days ago and one whose lesson video row was deleted are swept; one used yesterday stays.
  - `timelineSource` is null for an audio recording and for a gone video.
  - `worker-seen.spec.ts` `workerStatus`: `'unknown'` after reset; `noteWorkerSeen(t)` → `'online'` at `t + 14 min`, `'offline'` at `t + 16 min`.
  - extend the sync tables spec if it enumerates tables (it fails until `ai_timelines` is classified).
- [ ] **Step 2:** Run `npx vitest run src/lib/server/ai-timelines src/lib/server/worker-seen.spec.ts --maxWorkers=4`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Schema, `npm run db:generate`, read the generated SQL, append the trigger; then the store, `worker-seen.ts`, `timelinesDir()`, the hook line (`noteWorkerSeen(serverNow())` right after `workerTokenOk` passes), the `runPurge` line (`sweepTimelines` then `removeTimelineFiles`, its own `.catch` logging `[timelines] sweep failed`).
- [ ] **Step 4:** Run the same command plus `npx vitest run src/lib/sync src/lib/server/db --maxWorkers=4`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ai-timelines): the table, its store, worker liveness, the 30-day sweep`.

### Task 2: The worker's timeline routes

**Files:**
- Create: `src/routes/api/worker/timelines/claim/+server.ts` (POST), `src/routes/api/worker/timelines/[id]/source/+server.ts` (GET), `src/routes/api/worker/timelines/[id]/pieces/[k]/+server.ts` (PUT), `src/routes/api/worker/timelines/[id]/done/+server.ts` (POST), `src/routes/api/worker/timelines/[id]/fail/+server.ts` (POST), and `src/routes/api/worker/timelines/timelines.spec.ts` (mock `$lib/server/db` as `dance-wall.spec.ts` does; `DATA_DIR` set to a `mkdtemp` dir via the `$env/dynamic/private` mock the other worker specs use)
- Create: `src/lib/server/ai-timelines/piece.ts` + `piece.spec.ts`
- Modify: `src/lib/offline/routes.ts`

**Interfaces:**
- Consumes: Task 1's store.
- Produces:
  - `type Piece = { frames: { tMs: number; data: string }[]; sound: string | null }`
  - `parsePiece(raw: unknown, k: number): Piece | string` (string = the English refusal): `frames` an array of at most 31, each `t_ms` a whole number in `[k*60000, (k+1)*60000)`, ascending, `data` base64 (`/^[A-Za-z0-9+/]+=*$/`) of at most 256 KiB; `sound` null or base64 of at most 1 MiB; no other keys.
  - `writePiece(dir, k, piece): Promise<void>` and `readPiece(dir, k): Promise<Piece | null>` in `src/lib/server/ai-timelines/files.ts` (stored as `{"frames":[{"t_ms","data"}],"sound"}`).
  - Routes: claim → `{ id }` or 204; source → the file via `serveFile` (Range works); pieces/[k] → body JSON capped at 4 MiB (`content-length` and the read length), `k` a whole number `0..59`, 204 on success, 400 with the refusal; done `{ pieces, duration_ms }` → 400 unless every piece `0..pieces-1` is on disk and `pieces === ceil(duration_ms / 60000)`, else 201; fail `{ error, permanent }` → 204. Every route but claim answers **410** `This video is no longer wanted.` when `timelineSource` is null, and the done/pieces routes remove the timeline's directory then.

- [ ] **Step 1: Failing specs.** `piece.spec.ts`: accepts a 2-frame piece at k=1 (`t_ms` 60000, 62000); refuses `t_ms` 59000 at k=1; refuses an extra key; refuses frame data with a space. `timelines.spec.ts`: claim gives the queued id then 204; a piece PUT then done → the timeline is ready; done with a missing piece is 400; `410 when the video is gone` (delete the lesson video row, PUT a piece → 410 and the directory is gone); source streams the file bytes.
- [ ] **Step 2:** `npx vitest run src/lib/server/ai-timelines src/routes/api/worker/timelines --maxWorkers=4` → FAIL.
- [ ] **Step 3:** Implement; classify the five routes in `routes.ts` (source GET with the other `/api/worker/` GETs; writes `'network'`).
- [ ] **Step 4:** Same command plus `npx vitest run src/lib/offline src/routes/route-ids --maxWorkers=4` (whatever spec checks route classification) → PASS.
- [ ] **Step 5: Commit** `feat(ai-timelines): the worker's routes: claim, source, pieces, done, fail`.

### Task 3: Audio content in the MCP protocol

**Files:**
- Modify: `src/lib/mcp/protocol.ts`, `src/lib/mcp/protocol.spec.ts`, `src/lib/mcp/sdk-compat.spec.ts`

**Interfaces:**
- Produces: `ToolResult.audio?: { data: string; mimeType: string }[]`, emitted after the images as `{ type: 'audio', data, mimeType }`.

- [ ] **Step 1:** Specs: `protocol.spec.ts` `tools/call carries audio after images` (content types `['text','image','audio']`); `sdk-compat.spec.ts` a tool answering with one image and one audio parses with the official client and the client sees `type: 'audio'`.
- [ ] **Step 2:** `npx vitest run src/lib/mcp --maxWorkers=4` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same → PASS.
- [ ] **Step 5: Commit** `feat(mcp): audio content in tool results`.

### Task 4: The `videos` and `video_timeline` tools

**Files:**
- Create: `src/lib/server/mcp/video.ts` (`videoTools: ToolModule`), `src/lib/server/mcp/video.spec.ts`
- Modify: `src/lib/server/mcp/modules.ts` (`[readTools, queueTools, videoTools]`), `src/lib/server/mcp/read.ts` (export `sections` for reuse), `src/lib/mcp/protocol.ts` (`INSTRUCTIONS`: one sentence: "To mark sections on a video, use videos and video_timeline, then propose add_section (and link_section)."), the tools-count assertions wherever plan 1/2 specs list tool names.

**Interfaces:**
- Consumes: Task 1 (`askTimeline`, `timelineOf`, `timelinesOf`, `touchTimeline`, `timelineDir`, `workerStatus`), Task 2 (`readPiece`), Task 3 (`audio`), `viewOf` (`lesson_videos`, `recordings`, `video_spots`, `owner`, `label`).
- Produces:
  - `videos` (read-only hint; args none): `{ worker: 'online'|'offline'|'unknown', videos: [{ lesson_video_id | recording_id, title, owner ('mine' | group name), sections, timeline: 'ready'|'preparing'|'failed'|'not prepared', duration_s? }] }`, readable video rows only (recordings of `kind: 'video'`), newest (`created_at`) first, at most 200 with `total`. Lesson video title: `<lesson title> · <video n of the lesson>` only when the lesson has more than one; recording title: `v.label(figure_id)`.
  - `video_timeline` (args `lesson_video_id | recording_id`, `from_s` default 0, `to_s` default `from_s + 60`, `every_s` default 2 (an even whole number 2..30), `sound` default false, `blind` default false; readOnlyHint false because it may queue the job, destructive false, idempotent true):
    - not readable via `viewOf`, or an audio recording → `isError` `No video with that id. Videos come from the videos tool.`
    - none/queued → `{ status: 'preparing', message: 'Being prepared on the home worker; ask again in a minute or two. Tell the person.' }`; queued and `workerStatus` offline → `{ status: 'worker offline', message: 'The home worker has not been seen for over 15 minutes; this video will be prepared when it is back. Tell the person.' }`; failed → `{ status: 'failed', error }`.
    - ready: refuse `from_s >= duration` (`The video is <d> s long.`), more than 30 frames (`At most 30 frames a call: shorten the stretch or raise every_s.`), `sound` over 60 s (`With sound, at most 60 s a call.`); `to_s` is clipped to the duration. Answer text JSON `{ video: { id, title, duration_s }, from_s, to_s, frames_s: [..], sound: [{ from_s, to_s }] | 'off' | 'none on this video', next_from_s: number|null, sections_here?: sections(...) (left out when blind), your_sections: [{ start_ms, end_ms, label, links }] }` then images (`image/jpeg`, one per `frames_s`, in order) then audio (`audio/mpeg`, one per piece touched). `your_sections`: the person's own (`owner === 'mine'`) spans (`end_ms` not null) on other videos, highest id first, at most 15. Calls `touchTimeline`.
    - The description carries the habit: "The person's sections start a little before the figure and end a little after it; sometimes earlier, to include the explanation. your_sections shows their real ones. Propose sections with propose add_section; link a figure with link_section."

- [ ] **Step 1: Failing specs** (`video.spec.ts`, `makeWorld` + `approve` as queue.spec; pieces written with `writePiece` into a `mkdtemp` dir, `timelinesDir` mocked through `$env/dynamic/private`'s `DATA_DIR`):
  - `writes only ai_timelines`: the `counts` diff of a `video_timeline` call on a fresh video changes only `ai_timelines` and `id_marks`, by one row.
  - `preparing, then offline`: first call says `preparing`; with `noteWorkerSeen(now - 16 min)` it says `worker offline`.
  - `a ready stretch`: duration 150 000, pieces 3 with frames every 2 s; `from_s: 50, to_s: 70` → `frames_s` `[50,52,…,68]` (10), 10 image contents, no audio, `next_from_s` 70.
  - `every_s skims`: `from_s 0, to_s 150, every_s 6` → 25 frames.
  - `sound`: `from_s 50, to_s 70, sound: true` → 2 audio contents, `sound` `[{0,60},{60,120}]`; `sound on a silent video` (pieces with `sound: null`) → `'none on this video'` and no audio.
  - `stretch past the end`: `from_s 150` → isError mentioning `150 s long`; `from_s 140` → `to_s` 150 and `next_from_s` null.
  - `blind leaves out this video's sections`; `your_sections` holds an own span on another video and not a group one.
  - `another person's video is missing`: a lesson video of a lesson owned by `u2` → the same text as id 999999.
  - `videos lists readable videos with their timeline state`.
- [ ] **Step 2:** `npx vitest run src/lib/server/mcp --maxWorkers=4` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/lib/server/mcp src/lib/mcp src/routes/mcp --maxWorkers=4` → PASS.
- [ ] **Step 5: Commit** `feat(mcp): videos and video_timeline: frames and sound for the AI`.

### Task 5: The worker prepares timelines

**Files:**
- Modify: `worker/salsa_worker/media.py`, `worker/salsa_worker/api.py`, `worker/salsa_worker/jobs.py`, `worker/salsa_worker/__main__.py`
- Test: `worker/tests/test_media.py`, `worker/tests/test_api.py`, `worker/tests/test_jobs.py`

**Interfaces:**
- Consumes: Task 2's routes and piece format.
- Produces:
  - `media.timeline_frames(src: Path, outdir: Path, run=subprocess.run) -> list[tuple[int, Path]]`: `ffmpeg -nostdin -loglevel error -y -i src -vf fps=1/2,scale=384:-2 -q:v 6 outdir/f%05d.jpg`; frame n (1-based) at `(n-1)*2000` ms. A failure is `PermanentError("Could not read the video: …")`.
  - `media.timeline_sound(src, outdir, run=subprocess.run) -> list[Path]`: `ffmpeg -nostdin -loglevel error -y -i src -vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 24k -f segment -segment_time 60 -reset_timestamps 1 outdir/a%04d.mp3`; returns the files in order; `[]` when ffmpeg fails (no audio stream), logged as a warning.
  - `Api.claim_timeline() -> dict | None` (204 or 404 → None), `Api.download_timeline_source(id, dest)`, `Api.put_piece(id, k, frames: list[tuple[int, bytes]], sound: bytes | None)` (base64 JSON `{"frames":[{"t_ms","data"}],"sound"}`), `Api.finish_timeline(id, pieces, duration_ms)`, `Api.fail_timeline(id, error, permanent)`. A 410 on any of them raises `JobGone`.
  - `jobs.TimelineTools(frames, sound, duration_of)`; `jobs.process_timeline(job, api, tools, workdir) -> bool` (download, `duration_of`, over `MAX_VIDEO_S` → permanent "Longer than an hour.", frames, sound, group by `t_ms // 60000`, `pieces = ceil(duration_ms / 60000)`, put each piece (an empty frames list is allowed for a piece with none), finish). Same failure handling as `process_video`.
  - `run(..., timeline_tools=None)`: timelines after the pasted lists and the songs, before music starts and saved videos.

- [ ] **Step 1: Failing tests:** `test_timeline_frames_command_and_times` (fake run creates `f00001.jpg`, `f00002.jpg` → `[(0, …), (2000, …)]`, command has `fps=1/2,scale=384:-2`); `test_timeline_sound_none_on_failure`; `test_put_piece_body` (fake urlopen captures JSON with base64); `test_put_piece_410_is_gone`; `test_process_timeline_groups_by_minute` (fake tools: 150 s, frames every 2 s, 3 sound files → 3 `put_piece` calls with 30, 30, 15 frames, then `finish_timeline(id, 3, 150000)`); `no audio stream still uploads frames` (sound `[]` → every piece `sound=None`); `a gone timeline is not a failure` (`put_piece` raises `JobGone` → True, no `fail_timeline`); `test_run_order` (timelines claimed before saved videos).
- [ ] **Step 2:** `cd worker && nix develop ..#default -c python -m pytest -q` (or the command `docs/development.md` names for the worker) → FAIL.
- [ ] **Step 3:** Implement; wire `TimelineTools(frames=media.timeline_frames, sound=media.timeline_sound, duration_of=media.duration_of)` in `__main__.py`.
- [ ] **Step 4:** Same → PASS.
- [ ] **Step 5: Commit** `feat(worker): prepare video timelines: frames every 2 s and minute sound pieces`.

### Task 6: Measuring the AI's sections

**Files:**
- Create: `src/lib/ai-queue/measure.ts` + `measure.spec.ts` (PURE), `scripts/ai-sections/measure.ts`

**Interfaces:**
- Produces:
  - `type Span = { startMs: number; endMs: number; label?: string | null }`
  - `compareSections(mine: Span[], ai: Span[], toleranceMs = 2000): { pairs: { mine: Span; ai: Span; startDeltaMs: number; endDeltaMs: number; close: boolean }[]; missed: Span[]; extra: Span[] }`: pairs by largest overlap first (overlap over the union at least 0.3), each span in at most one pair; `close` when both deltas are within `toleranceMs`; deltas are `ai - mine`.
  - The script: `npx tsx scripts/ai-sections/measure.ts <db file> lv:<id>|rec:<id>`: the person's spans on that video (excluding spots that a `done` AI line created, by `ai_lines.result.id`) against every `add_section` line for that video in any status but `withdrawn`; prints each pair with its deltas, then missed, extra, and a one-line summary `N of M close (±2 s), K missed, J extra`.

- [ ] **Step 1:** Failing spec: exact match → 1 close pair; ai 1 500 ms early at both ends → close, deltas −1500; 3 000 ms late → paired, not close; an ai span overlapping nothing → extra; an unmatched mine → missed; two ai spans over one mine → the larger overlap pairs, the other is extra.
- [ ] **Step 2:** `npx vitest run src/lib/ai-queue/measure.spec.ts` → FAIL.
- [ ] **Step 3:** Implement; the script opens the file read-only with `better-sqlite3` and plain SQL (no app modules that read `$DATA_DIR`).
- [ ] **Step 4:** The spec passes; run the script on a copy of the newest `~/Backups/salsa/db` backup with any video id → prints the summary (0 AI sections there is fine).
- [ ] **Step 5: Commit** `feat(ai-queue): measure the AI's sections against the person's`.

### Task 7: Docs and the full check

**Files:**
- Modify: `docs/superpowers/specs/2026-11-09-ai-connector-design.md` (status line: plan 3 built), `docs/features.md`, `docs/layout.md` (`src/lib/server/ai-timelines/`, `worker-seen.ts`, the worker routes, `scripts/ai-sections/`), `docs/deployment.md` (Home worker: timelines, deploy order server first then worker (`nix flake update salsaapp` + switch on backtop); an older worker never claims timelines, so they stay "preparing"), `docs/hard-rules.md` + `CLAUDE.md` Auth line ("its queue tools write only ai_* tables" stays true; add "the video tools write only `ai_timelines`").
- [ ] **Step 1:** Write the docs.
- [ ] **Step 2:** `npm run check > .superpowers/sdd/<plan>/check.log 2>&1; tail -30` → passes (prettier, eslint, svelte-check, build, vitest).
- [ ] **Step 3: Commit** `docs(ai-timelines): layout, deployment, features, spec status`.

After the plan: the final review, then merge, deploy the server (backup first) and the worker, each only with the user's go-ahead; then the experiment itself with the user: a few videos they already marked, `video_timeline` with `blind: true`, proposals into the queue, `measure.ts` on a fresh backup copy, and the result decides whether this stays and whether frames alone are enough.
