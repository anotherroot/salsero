# Picker preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo a slot builds **natively** (CLAUDE.md "Building in a slot"): per task only its specs, `npx eslint` and `npx prettier --check` on the changed files; the full `npm run check` before the final review and again after merging master in.

**Goal:** Figure rows in the pickers get a moving picture (a 12-frame loop cut by the home worker) and a positions line; a tap on the picture opens a preview sheet over the picker.

**Architecture:** The server keeps a never-synced queue `video_loops`; one sweep queues every figure-linked section whose current span has no loop (new links, edits, clones, offline replays and the backfill alike). The worker claims a job, cuts a JPEG strip and a still from the section with ffmpeg, uploads both to `$DATA_DIR/loops/`, named `<spotId>-<startMs>-<endMs>.jpg` / `…-still.jpg`. The name is derived from synced columns, so pages and the phone build the URL without new synced data; the phone's device worker keeps every loop of its copy in the media store. Rows carry a `picture`; `PreviewButton` draws it; `LookSheet` fetches the details from a device endpoint.

**Tech Stack:** SvelteKit 5 (runes), Drizzle + better-sqlite3, Vitest, Python worker (ffmpeg), the offline device worker and service worker.

**Spec:** `docs/superpowers/specs/2026-11-12-picker-preview-design.md`

## Global Constraints

- Strip: 12 frames, each 128 × 80, frame k at `start + (k + 0.5)·(end − start)/12`, scale to cover + centre crop, JPEG q ≈ 75; still = frame 0 as its own JPEG. Played at 3 frames/s (`steps(12)`, 4 s).
- Tile 64 × 40, radius 8 (`rounded-lg` = the `xs` radius in this app's scale; check `ui/styles.ts`), its own button, label "Preview <label>". No video: the tile in `accent-soft` with a film icon, still a button.
- Still instead of moving: `prefers-reduced-motion: reduce` or `navigator.connection?.saveData`.
- The sheet's video is NOT `data-ambient`; muted at start; closing stops it; Back resumes what it paused (only what was playing).
- Verbs: `kind` 'link' → "Link this", 'act' → "Add this", 'field' → "Pick this"; a linked row → "✓ Linked" disabled.
- Every word through `t()` in `en` and `sl` (vikanje, glossary in `sl/index.ts`); positions and names never translated.
- Server time through `serverNow()`; ids through `mintedId('video_loops')` + a mark trigger as in migration 0038; additive migration only; the generated SQL read before committing.
- A loop belongs to a spot AND its span; loops only for sections (`end_ms` not null) linked to a figure (`spot_links.figure_id`) on a video with `server_copy` 1.
- Specs never touch `$DATA_DIR` the real way: tests use `openDb(':memory:')` and a temp dir, as `ai-timelines/store.spec.ts` and the timelines endpoint specs do.

## Review Focus

1. A section whose span is edited after its loop was cut: the old loop must never show (the URL changes with the span; the sweep removes the stale row and files). Test in Task 2.
2. A reader of a group (published lessons only) must not get a loop, a picture or a sheet for a section on an unpublished lesson's video: the same 404 as a missing one. Tests in Tasks 5 and 7.
3. A loop not cut yet (or failed for good): the tile falls back to the empty tile on image error, and the phone's keeper treats its 404 as "not yet", not a failure that blocks other files. Tests in Tasks 5 and 8.
4. Opening the sheet while a lesson video plays, then Back: the lesson video carries on from where it paused; if it was paused before, it stays paused. Test in Task 9.
5. Phone-only video (`server_copy` 0): no job is queued, nothing errors; once the server copy lands, the next sweep queues it. Test in Task 2.

---

### Task 1: Cut a loop (worker) and measure it on real videos

**Files:**
- Modify: `worker/salsa_worker/media.py` (beside `timeline_frames`)
- Test: `worker/tests/test_media.py`

**Interfaces:**
- Produces: `loop_strip(src: str, start_ms: int, end_ms: int, outdir: Path, headers: dict[str, str] | None = None, run=subprocess.run) -> tuple[Path, Path]` returning `(strip.jpg, still.jpg)`. `src` is a path or an http(s) URL; with a URL, `headers` go to ffmpeg's `-headers`.
- Constants: `LOOP_FRAMES = 12`, `LOOP_W = 128`, `LOOP_H = 80`, `LOOP_Q = 5` (ffmpeg `-q:v` for ≈ JPEG 75; tune in Step 5).

- [ ] **Step 1: Failing tests** in `test_media.py` with a fake `run` that records argv (as the timeline tests do): `test_loop_strip_seeks_each_frame` asserts 12 ffmpeg seeks with `-ss` before `-i` at `start + (k+0.5)*span/12` seconds (for 1000–7000 ms: 1.25, 1.75 … 6.75), each `-frames:v 1` with `scale=128:80:force_original_aspect_ratio=increase,crop=128:80`; `test_loop_strip_tiles_into_one` asserts a final `tile=12x1` pass writing `strip.jpg`, and `still.jpg` is frame 0; `test_loop_strip_passes_headers_for_url` asserts `-headers` precedes `-i` when `src` starts with `http`.
- [ ] **Step 2:** `cd worker && python -m pytest tests/test_media.py -k loop -v` → FAIL (no `loop_strip`).
- [ ] **Step 3: Implement `loop_strip`.** Per-frame input seeking (`-ss t -i src`) so only the needed bytes are read over HTTP Range; then one `ffmpeg -i frame_%02d.jpg -vf tile=12x1 -q:v LOOP_Q strip.jpg`. A frame past the end (rounding) reuses the last good one; no frame at all → `PermanentError("No picture in this section.")`.
- [ ] **Step 4:** the same pytest → PASS.
- [ ] **Step 5: Measure on real lesson videos.** Ask the user for 2–3 lesson videos (a copy placed in the scratchpad, or approval to copy them read-only from the host, `docs/deployment.md`). Run `loop_strip` on 3 sections each (lengths 3–28 s, as in the db). Report strip and still sizes to the user. Above 60 KB a strip: lower `LOOP_Q` (higher number) or `LOOP_W/H` to 112 × 70 and re-measure; record the final values in this plan's Global Constraints and the spec. Do not commit the videos.
- [ ] **Step 6: Commit** `feat(worker): cut a figure loop — 12 frames from a section, one strip and a still`.

### Task 2: The loop queue on the server

**Files:**
- Modify: `src/lib/server/db/schema.ts` (new `videoLoops` after `aiTimelines`), `src/lib/sync/tables.ts` (`NEVER_SYNCED`), `src/lib/server/files.ts` (`loopsDir()`, `LOOP_FILE_RE`)
- Create: `drizzle/0055_*.sql` via `npm run db:generate`, plus the mark trigger in the same migration (copy 0038's shape), `src/lib/server/loops/store.ts`, `src/lib/server/loops/store.spec.ts`
- Modify: `docs/hard-rules.md` (bookkeeping hard deletes: `video_loops` rows and their files, when their spot is gone or its span changed)

**Interfaces:**
- Produces (`store.ts`):
  - `loopName(spot: { id: number; startMs: number; endMs: number }, still = false): string` → `"12-1000-7000.jpg"` / `"12-1000-7000-still.jpg"` (pure; re-exported from `src/lib/video/loops.ts` in Task 6 for client use; put the pure function there now and import it here).
  - `queueLoops(db: Db, now: number): { queued: number; stale: string[] }` — inserts a `queued` row for every figure-linked section on a server-copy video (lesson video or recording, live) whose `(spot_id, start_ms, end_ms)` has no row; deletes rows whose spot is gone or whose span differs from the spot's, returning their file names (strip and still) for removal.
  - `claimLoop(db: Db, now: number): { id: number; startMs: number; endMs: number } | null` — lease and attempts exactly as `claimTimeline` (`LEASE_MS`, `MAX_ATTEMPTS` from `../songs`).
  - `loopSource(db: Db, id: number): { kind: 'lesson-video' | 'recording'; file: string } | null` — null when the row, its spot, or its span no longer matches.
  - `finishLoop(db: Db, id: number, now: number): string | null` (the strip's name, or null when gone), `failLoop(db: Db, id: number, error: string, permanent: boolean, now: number): void`.
  - `removeLoopFiles(names: string[]): Promise<void>`.
- Table `video_loops`: `id` (mintedId), `spot_id` int not null, `start_ms`, `end_ms` int not null, `status` text enum queued/ready/failed not null, `error`, `attempts` default 0, `claimed_at`, `failed_at`, `ready_at`, `created_at`; unique index on `(spot_id, start_ms, end_ms)`. A NEW table, so a CHECK on status is allowed (as `ai_timelines`).

- [ ] **Step 1: Failing specs** (`store.spec.ts`, `openDb(':memory:')`, rows made through the app's data functions where they exist): `queues a figure-linked section once` (two `queueLoops` calls → one row); `skips points, drill links and phone-only videos` (end_ms null; `spot_links.drill_id`; `server_copy` 0 → 0 rows; then set `server_copy` 1 → next call queues it); `an edited span drops the old row and returns its files` (ready row for 1000–7000, spot moved to 1500–7000 → `stale` = both names, a new queued row for the new span); `a deleted spot drops its row`; `claim leases the oldest and gives up after MAX_ATTEMPTS`; `loopSource is null once the span changed`.
- [ ] **Step 2:** `npx vitest run src/lib/server/loops/store.spec.ts` → FAIL.
- [ ] **Step 3: Schema, migration, `tables.ts`, store.** Run `npm run db:generate`; read the SQL (only a CREATE TABLE + index; add the mark trigger by hand as in 0038). `ids.spec.ts` and `tables.spec.ts` must pass.
- [ ] **Step 4:** `npx vitest run src/lib/server/loops src/lib/server/db src/lib/sync/tables.spec.ts` → PASS.
- [ ] **Step 5: Commit** `feat(loops): the loop queue — one row per linked section and span, swept, leased`.

### Task 3: Worker endpoints

**Files:**
- Create: `src/routes/api/worker/loops/claim/+server.ts`, `…/loops/[id]/source/+server.ts`, `…/loops/[id]/strip/+server.ts`, `…/loops/[id]/still/+server.ts`, `…/loops/[id]/done/+server.ts`, `…/loops/[id]/fail/+server.ts`, `src/routes/api/worker/loops/loops.spec.ts`
- Modify: `src/lib/offline/routes.ts` (`NETWORK_ENDPOINTS` += `/api/worker/loops/[id]/source`; the PUT/POSTs into the writes table as `pass`/network the way the timeline ones are), the hourly sweep that calls `sweepTimelines` (also `queueLoops` + `removeLoopFiles`)

**Interfaces:**
- Consumes: Task 2's store.
- Produces (HTTP, worker token checked by `hooks.server.ts` for `/api/worker/`): `POST claim` → runs `queueLoops` (removing stale files) then `claimLoop`; 200 `{id, start_ms, end_ms}` or 204. `GET [id]/source` → the video with Range (`serveFile`), 410 when `loopSource` is null. `PUT [id]/strip`, `PUT [id]/still` → body `image/jpeg`, at most 512 KiB, written to `loopsDir()` under `loopName`; 410 when gone. `POST [id]/done` → 410 unless both files are there; `finishLoop`. `POST [id]/fail` → `{error, permanent}`.

- [ ] **Step 1: Failing spec** modelled on `timelines.spec.ts` (mock `$lib/server/db`, temp `DATA_DIR`): claim returns the queued section's span; source answers 206 to a Range; strip over 512 KiB → 413; done before the still → 409; done after both → row `ready`; a span edited between claim and strip → 410.
- [ ] **Step 2:** `npx vitest run src/routes/api/worker/loops` → FAIL.
- [ ] **Step 3: Implement the six handlers and the sweep hook.** Reuse `gone()`/`idOf()` from `../timelines/gone.ts` (move them to `src/routes/api/worker/gone.ts` if importing across folders reads badly).
- [ ] **Step 4:** `npx vitest run src/routes/api/worker src/lib/offline/routes.spec.ts` → PASS.
- [ ] **Step 5: Commit** `feat(loops): worker endpoints — claim, source with Range, strip and still, done, fail`.

### Task 4: The worker's loop job

**Files:**
- Modify: `worker/salsa_worker/api.py`, `worker/salsa_worker/jobs.py`, `worker/salsa_worker/__main__.py`
- Test: `worker/tests/test_jobs.py` (or the file the timeline job tests live in), `worker/tests/test_api.py`

**Interfaces:**
- Consumes: Task 1's `loop_strip`; Task 3's endpoints.
- Produces: `Api.claim_loop() -> dict | None` (None on 204 and on 404: an older server), `Api.loop_source_url(job_id) -> tuple[str, dict]` (URL + the token header), `Api.put_loop(job_id, which: Literal["strip","still"], path: Path)`, `Api.finish_loop(job_id)`, `Api.fail_loop(job_id, error, permanent)`; 410 → `JobGone` as `_timeline` does. `LoopTools(cut: Callable[[str, int, int, Path, dict], tuple[Path, Path]])`, `process_loop(job, api, tools, workdir) -> bool`. `run(..., loop_tools: LoopTools | None = None)` drains loops after timelines and before music starts.

- [ ] **Step 1: Failing tests:** `process_loop` uploads strip then still then finishes; `JobGone` → True and no fail call; `PermanentError` → `fail_loop(..., True)`; any other error → `fail_loop(..., False)` and `run` stops; `claim_loop` returns None on 404.
- [ ] **Step 2:** `cd worker && python -m pytest -k loop -v` → FAIL.
- [ ] **Step 3: Implement** in the shape of `process_timeline`; wire `__main__` with `LoopTools(cut=media.loop_strip)`.
- [ ] **Step 4:** `cd worker && python -m pytest -v` → all PASS.
- [ ] **Step 5: Commit** `feat(worker): the loop job — claim, cut over HTTP Range, upload strip and still`.

### Task 5: Serving loops, and the phone keeping them

**Files:**
- Create: `src/routes/loops/[file]/+server.ts`, its spec beside it
- Modify: `src/lib/offline/routes.ts` (`MEDIA_ENDPOINTS` += `/loops/[file]`), `src/lib/offline/media-store.ts` (`MediaKind` += `'loops'`, `LOOP_KINDS`), `src/device/media.ts` (`wantedMedia` + quiet 404 for loops), their specs
- Modify: `docs/layout.md`

**Interfaces:**
- Consumes: `loopName` (Task 2), `fileAccess` / `videoOfSpot` (`access.ts`, `spot-links.ts`).
- Produces: `GET /loops/<spotId>-<start>-<end>[-still].jpg` → the file with `Cache-Control: private, max-age=31536000, immutable`; 404 when the name does not parse, the spot is gone, its span differs, the viewer may not read its video (`fileAccess` on the spot's video), or the file is not there yet. `wantedMedia` adds `{kind:'loops', file, mime:'image/jpeg'}` (strip and still) for every section in the copy that `queueLoops` would queue (same SQL conditions on the device's tables).

- [ ] **Step 1: Failing specs:** route — a reader of a group gets 404 for a loop of an unpublished lesson's section and 200 for a published one; a stale span → 404. `media.spec.ts` — `wantedMedia` lists both files for a linked section and none for a point or a drill link; a 404 for a `loops` file counts neither as fetched nor failed (`PassOut` unchanged) and the pass goes on to the next file. `routes.spec.ts` stays green.
- [ ] **Step 2:** `npx vitest run src/routes/loops src/device/media.spec.ts src/lib/offline` → FAIL.
- [ ] **Step 3: Implement.** Loops are kept like songs (any connection, no Wi-Fi wait; ~40 KB each); `usage()` counts them with songs in Settings unless that list has its own line for them (builder's call, one line).
- [ ] **Step 4:** the same vitest → PASS.
- [ ] **Step 5: Commit** `feat(loops): serve loops to who may read the video; the phone keeps every loop of its copy`.

### Task 6: Which section is a figure's picture, and what the row says

**Files:**
- Create: `src/lib/video/loops.ts` (+ spec), `src/lib/server/loops/pictures.ts` (+ spec)
- Modify: `src/lib/types.ts`, `src/lib/i18n/en/picker.ts`, `src/lib/i18n/sl/picker.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `export type Picture = { strip: string; still: string } | null;` and `export interface FigureLook { hands: string; length: number | null; picture: Picture }`.
  - `loops.ts` (pure): `loopName` (moved here from Task 2), `pictureOf(spot: { id: number; startMs: number; endMs: number } | null): Picture` → `{ strip: '/loops/…jpg', still: '/loops/…-still.jpg' }` or null; `lookLine(look: FigureLook): string` → `"Abierta (una mano) → Cerrada · 8 counts"`, `"8 counts"` with no hands, `""` with neither (uses `t().picker.look.counts(n)`).
  - `pictures.ts`: `looksFor(db: Db, figureIds: number[], opts: { viewer: string; ownSections: boolean }): Map<number, FigureLook>` — batched: one `videosOf` per distinct space (the figure's own; with `ownSections` and a group figure, the viewer's own after it), one `sectionsByVideo` over all linked spots; per figure the first card in that order (= what `topVideo(sectionsFor(...))` picks on the figure page); a reader's `Visible` from `judgeFigure(...).reach`, computed once per team. `hands` from `handsLine` (`src/lib/routines/page.ts`) with the figure's start/end position ids; `length` = `length_counts`, null when `length_free`.
- i18n: `picker.look = { counts: (n) => …, preview: (label) => …, linkThis, addThis, pickThis, linked, back, startsOn: (c) => …, endsAfter: (n) => …, noPositions, noVideo, yourRecording, yours, readOnly, soundOn, soundOff, andMore: (n) => … }` (Slovenian with `slCount`).

- [ ] **Step 1: Failing specs:** `loops.spec.ts` — `pictureOf` names; `lookLine` three cases. `pictures.spec.ts` — for a fixture with a figure linked from two lessons (older and newer) and a recording section, `looksFor` picks exactly what `topVideo(sectionsFor(db, {figureId}, reach, viewer))` picks, for an owner, a group editor and a group reader (reader: the unpublished lesson's section is never chosen); a figure with only a point → `picture` null; a group figure with `ownSections` → the group's section before the viewer's.
- [ ] **Step 2:** `npx vitest run src/lib/video/loops.spec.ts src/lib/server/loops/pictures.spec.ts` → FAIL.
- [ ] **Step 3: Implement.** Then `npx vitest run src/lib/i18n` (catalog parity) .
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(picker): a figure's look — the figure page's top section as its picture, the positions line`.

### Task 7: Rows carry the look

**Files:**
- Modify: `src/lib/picker/model.ts` (`PickRow`), `src/lib/picker/build.ts` (+ spec), `src/lib/routines/fit.ts` (`Candidate`, `pickList`, + spec), `FigureVersion` / move target types in `src/lib/types.ts`
- Modify the producers (each adds `look` via `looksFor`): `src/lib/server/link-popup.ts`, `src/lib/server/lessons.ts` (the lesson page's figure picker data), `src/routes/[dance]/(moves)/routines/[id]/+page.server.ts`, `src/lib/server/moves-lists.ts`, the elsewhere search (`src/lib/server/elsewhere.ts`), and every producer of `figureRows`' input (grep `figureRows(`: the lesson page, `MoveSheet`, `LinkPopup`, `FiguresList`)

**Interfaces:**
- Consumes: Task 6.
- Produces: `PickRow.picture?: Picture` (absent: no button; null: the empty tile) and `PickRow.look?: { kind: 'figure' | 'move'; id: number }`. `FigureVersion.look?: FigureLook`; a move target gets `picture?: Picture` (its first variation in id order with a picture). `variationEntries` sets `meta` to `lookLine` joined with the old meta by " · " (look first), `picture`, `look: {kind:'figure', id}`. `figureRows` sets `picture` and `look: {kind:'move', id}`. `pickList` passes `picture`/`look` through; SlotPicker's own timing line stays its meta.

- [ ] **Step 1: Failing specs:** `build.spec.ts` — a version with look and a twin note → meta `"Abierta (una mano) → Cerrada · 8 counts · <twin note>"`, `picture` kept, `look` set; without `look` the row is as before (no `picture` key). `fit.spec.ts` — `picture` survives `pickList`. A producer spec (the lesson page or `link-popup.spec.ts`): a group reader's rows have `picture` null for a figure whose only section is on an unpublished lesson.
- [ ] **Step 2:** `npx vitest run src/lib/picker src/lib/routines/fit.spec.ts src/lib/server/link-popup.spec.ts` → FAIL.
- [ ] **Step 3: Implement**, one `looksFor` call per load.
- [ ] **Step 4:** `npx vitest related <changed files> --maxWorkers=4` → PASS.
- [ ] **Step 5: Commit** `feat(picker): figure and move rows carry their picture and positions line`.

### Task 8: The picture on the row

**Files:**
- Create: `src/lib/components/picker/PreviewButton.svelte`, `src/lib/picker/motion.svelte.ts` (one shared IntersectionObserver + the still rule)
- Modify: `src/lib/components/picker/Picker.svelte` (the `row` snippet: the button after the indent, before the text; new prop `onlook?: (row: PickRow) => void`; until Task 9 the picker's own handler is a no-op), `src/routes/dev/kit` (the button's states)

**Interfaces:**
- Consumes: `PickRow.picture`, `t().picker.look.preview`.
- Produces: `PreviewButton` props `{ picture: Picture; label: string; look: 'tile' | 'eye'; onclick: () => void }`. `'tile'`: 64 × 40, the strip as `background-image` with `background-size: 1200% 100%` animated by `steps(12)` over 4 s while `motion.moving(el)` holds (on screen, no reduced motion, no saveData), else the still; an `<img>` error (a loop not cut yet) → the empty tile; the eye badge in the corner. `'eye'`: a 40 px bare eye icon button (`iconButton('bare')`), drawn before the + (the fallback, spec "Building for the fallback"). One constant `PREVIEW_LOOK: 'tile' | 'eye' = 'tile'` in `src/lib/picker/view.ts` chooses.
- `motion.svelte.ts`: `export function moving(node: HTMLElement): { current: boolean; destroy(): void }` (or an attachment) — one observer for all rows; `stillOnly()` reads `matchMedia('(prefers-reduced-motion: reduce)')` and `navigator.connection?.saveData`.

- [ ] **Step 1: Failing specs** (the project's component spec style, e.g. `inline-video.spec.ts`): a row with `picture` renders a button named "Preview Adios · Con la prima" that does not pick the row; a row without `picture` renders none; with reduced motion the tile has no animation class; an image error swaps to the empty tile; `PREVIEW_LOOK = 'eye'` renders the eye before the +. `no-english.spec.ts` and `class-rules.spec.ts` green.
- [ ] **Step 2:** `npx vitest run src/lib/components/picker src/lib/picker` → FAIL.
- [ ] **Step 3: Implement.** Colours through the builders (`swap()` in a `.ts` module, never appended `text-*`).
- [ ] **Step 4:** PASS; `npx eslint` and `npx prettier --check` on the changed files.
- [ ] **Step 5: Commit** `feat(picker): the moving picture on figure rows`.

### Task 9: The preview sheet

**Files:**
- Create: `src/routes/api/figures/[id]/look/+server.ts`, `src/routes/api/moves/[id]/look/+server.ts` (+ specs), `src/lib/server/loops/look.ts` (the sheet's data), `src/lib/components/picker/LookSheet.svelte`, `src/lib/components/picker/LookVideo.svelte` (adapted from `suggestions/SectionPreview.svelte`)
- Modify: `src/lib/types.ts`, `src/lib/offline/routes.ts` (`DEVICE_ENDPOINTS` += both), `src/lib/sound/page.ts` (+ `one-sound.spec.ts` or a new spec), `src/lib/components/picker/Picker.svelte`, `src/lib/i18n/{en,sl}/picker.ts`

**Interfaces:**
- Consumes: Tasks 6–8; `requireFigureAccess`/`judgeFigure` for reads (another's id and a missing one: the same 404); a flat `/api/` route takes the account's dance.
- Produces:
  - `types.ts`: `FigureSheet = { id; label; notes: string | null; starts: string[]; ends: string[]; startCount: string; length: number | null; from: { kind: 'mine' } | { kind: 'group'; name: string; readOnly: boolean }; video: { src: string; startMs: number; endMs: number; from: { kind: 'lesson'; title: string; lessonDay: string } | { kind: 'recording' } } | null; picture: Picture }`; `MoveSheet = { id; name; variations: { id; name; look: FigureLook }[] }`.
  - `GET /api/figures/[id]/look` → `FigureSheet`; `GET /api/moves/[id]/look` → `MoveSheet` (both device endpoints: answered offline from the copy).
  - `sound/page.ts`: `quietWhile(from: HTMLMediaElement): () => void` — stops what `soundFrom` would and returns `resume()`, which plays again the plain media elements it paused that are still paused (never registered stoppers or holders).
  - `LookSheet` props `{ look: { kind: 'figure' | 'move'; id: number }; label: string; verb: 'link' | 'act' | 'field'; linked: boolean; theme: 'light' | 'dark'; z?: string; onpick: () => void; onclose: () => void }`. Light: a stacked `Sheet` level (Back, no ×); dark: a `PlayerLayer` history level as the create step is. Content order and words per spec "The preview sheet (S1)"; a move: the variations with their `PreviewButton` (display only, `andMore` after 6).
  - `LookVideo`: muted autoplay, loops start→end, `playsinline`, no `data-ambient`; sound button toggles `muted`; on mount `const resume = quietWhile(el)`, on destroy pause + `resume()`. Can't play (error / offline and not stored) → the strip large (`PreviewButton`'s strip drawing at 100 % width) or the "No video yet" tile.
  - `Picker.svelte`: `onlook` default opens `LookSheet` for `row.look` with `verb = kind`, `linked = row.linked`; the sheet's verb calls the same path as a tap on the row (`onpick` / `onelsewhere(row, false)`); Back keeps the query, the scroll and `added`.

- [ ] **Step 1: Failing specs:** endpoints — owner 200 with notes, hands, video src and span; a group reader of a figure reached only through an unpublished lesson → 404, same as a missing id; `from` is `group` + `readOnly` for a reader. `quietWhile` (jsdom media stubs): a playing lesson video is paused, `resume()` plays it; a video paused before stays paused; a registered stopper is not resumed. `LookSheet`: "Link this" calls `onpick`; a linked row shows "✓ Linked" disabled; Back calls `onclose`; no notes → no notes block.
- [ ] **Step 2:** `npx vitest run src/routes/api/figures src/routes/api/moves src/lib/sound src/lib/components/picker` → FAIL.
- [ ] **Step 3: Implement.** Dates via `format.ts`; the inline video keeps `CLIP` rounding; desktop: a level over the picker's level.
- [ ] **Step 4:** PASS; then `npx vitest related` on the changed files, `npx eslint`, `npx prettier --check`.
- [ ] **Step 5: Commit** `feat(picker): the preview sheet — the figure's section muted, positions, notes, where it is from`.

### Task 10: Screenshots, docs, the whole check

**Files:**
- Modify: `scripts/shots/ext_picker_preview.py` (scenes `pp-lesson`, `pp-look` (the sheet open on a row with a picture), `pp-slot`, `pp-move-look`), `docs/features.md`, `docs/layout.md`, the spec's Status line

- [ ] **Step 1:** Seed a copy with a real video (`scripts/shots/seed.sh <backup copy> <out> <media dir>`), run its loops through the worker functions directly (`loop_strip` on the seeded video, files into the copy's `loops/`), shoot light and dark at 390 × 844, and the bachata group lesson (`SHOTS_DANCE=bachata`). Compare with the board; fix what differs.
- [ ] **Step 2:** `docs/features.md` (a line in the pickers paragraph linking the spec), `docs/layout.md` (`src/lib/server/loops/`, `src/lib/video/loops.ts`, `PreviewButton`, `LookSheet`, `LookVideo`, `motion.svelte.ts`, the routes), spec status "built".
- [ ] **Step 3:** `npm run check` → passes. `cd worker && python -m pytest` → passes.
- [ ] **Step 4: Commit** `docs(picker-preview): features, layout, shots`. Then the whole-branch review (one reviewer, hard limits in its prompt: no pty, no endless input), fix wave, merge master in, `npm run check` again, and send the user the screenshots of the real thing before merging into master.
