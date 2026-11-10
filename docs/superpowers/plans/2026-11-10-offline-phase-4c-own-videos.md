# Offline phase 4c: your videos only on the phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo the default is native (CLAUDE.md "Building in a slot").

**Goal:** A person's own new video (a recording on their figure, a video on their own lesson) stays on the phone as the untouched original. "Where is this video" offers Upload and Remove server copy, other devices show it "On <device>", and an iPhone warns once.

**Architecture:**
- **Server:** two tables gain three additive columns: `server_copy`, `origin_slot` and `origin_bytes`. A phone-only row is created by a small JSON endpoint that runs on the device first (device class) and replays like any other write. Its bytes never go through the outbox. Upload later is a chunked PUT that attaches a file to that existing row.
- **iPhone and phone browser:** the device worker keeps the original in OPFS under a new kind, `originals`. The keeper never clears it.
- **Android:** the app keeps a persisted gallery URI and serves it to the WebView with Range from `shouldInterceptRequest`, through a new `SalsaVideos` bridge.
- **Two parts.** Part 1 is everything without the APK and ships on its own: older apps keep uploading at once, as today. Part 2 is the Android app and its release.

**Tech Stack:** SvelteKit, Drizzle/SQLite (migration 0049), the device worker on OPFS SQLite, the service worker, and Kotlin (WebView, WorkManager, Media3), as already used.

**Spec:** `docs/superpowers/specs/2026-11-09-offline-phase-4-design.md` (4c, "Claude's calls", "4c's looks, picked by the user"), with the main design `docs/superpowers/specs/2026-11-07-offline-design.md` ("Videos", "Keep on this phone", "iPhone and browsers", "Media on the device").

## Global Constraints

**Phone-only by default**
- A new video stays on the phone by default, but only on a person's own figures and lessons. A group's videos always upload, as today.
- On a desktop browser a new video uploads as it does today: no pointer-coarse, no app.
- The phone never uploads a video unless the person asks. The app never removes a phone-only original unless the person asks (anti-goals).

**Upload and Remove**
- Upload sends the copy sized by Settings → video size (`users.video_short_side`: 480, 720 or 1080). On Android it is compressed by `Compressor.kt`; the iPhone and browser send the original uncompressed. The original stays on the phone.
- Only the device holding the original may remove the server copy.
- Phone-only videos don't count against the storage limit (`src/lib/server/storage.ts`). Only server copies count.

**Uploads**
- Recording uploads become chunked, like lesson videos: 8 MiB chunks, 1 GiB cap (`MAX_LESSON_VIDEO_BYTES`). A 409 + `x-received-bytes` resumes. Older Android apps keep the single POST, so the server accepts both.

**Elsewhere and leaving**
- On another device a phone-only video reads "On <device name>". Its sections and links list as usual; it can't play.
- `video_timeline` and the other AI video tools say the video is on a device and can't be read.
- Deleting a phone-only video says it is permanent. On Android (11 and up) it asks "Delete from the gallery too".

**Rules from CLAUDE.md and docs/hard-rules.md**
- `ADD COLUMN` only, no CHECK.
- Every insert uses `mintedId`.
- Every new GET or write route is classified in `src/lib/offline/routes.ts`.
- Words go through `t()` in en and sl (vikanje, » «, decimal comma).
- A spec never touches `$DATA_DIR`.
- Vitest runs with `--maxWorkers=4`.
- Look picks (spec "4c's looks"):
  - 1B: the Where button sits in the 4b KeepButton's place and opens the Where sheet.
  - 2A: a dark frame the video's size.
  - 3B: a warm card under the video, once.

## Review Focus

1. **A person change or Forget on a phone must not delete another person's originals.** Clearing kept videos, the low-space list and the keeper's "not wanted" sweep must not touch them either. Only a delete the person made (here, or on another device after a pull) removes an original. Tests: Task 5.
2. **Phone-only rows can't be copied.** A phone-only row reached by a clone path (Keep in step, Copy to, Make mine, Move to a group) has no file on the server. It stays behind and must never create a row whose file exists nowhere. Tests: Task 3.
3. **A failed upload must leave the row as it was.** If the upload is cut off or the room runs out, the row stays phone-only (`server_copy` 0, `size_bytes` the original's) and the original is untouched. Tests: Task 4.
4. **The device that holds the original sees it, not "On <device>" or missing.** That holds before its first pull after a reinstall, and when the slot is not yet known (`slot` null): show it as here only when the file is held. Tests: Task 6.
5. **An old Android app (no `SalsaVideos`) keeps working.** It keeps today's `salsa://upload` flow and its POST to `/api/figures/[id]/recordings`. A new page must not offer phone-only there. Tests: Tasks 4 and 12.

---

## Part 1 — server, device, web (no APK)

### Task 1: Columns, device names, storage

**Files:**
- Modify: `src/lib/server/db/schema.ts`, the `recordings` and `lesson_videos` tables, plus `device_slots`
- Create: `drizzle/0049_*.sql` (`npm run db:generate`; read the SQL: plain `ALTER TABLE … ADD`)
- Modify: `src/lib/types.ts` (`RecordingRow` :280, `LessonVideoRow` :258), and the loaders that build them (grep `RecordingRow`, `LessonVideoRow` in `src/lib/server/`)
- Modify: `src/lib/server/storage.ts` (`usedBytes` :78, the group sum :105, `listStorageItems` :318)
- Create: `src/lib/devices/label.ts`, `src/lib/devices/label.spec.ts`
- Modify: `src/lib/server/sync/slots.ts`, `pull.ts` :91 and `replay.ts` :198 (pass the UA), `src/lib/sync/wire.ts` (`ServerExtras`), `src/lib/server/sync/extras.ts`
- Test: `src/lib/server/storage.spec.ts`, `src/lib/server/sync/slots.spec.ts`, `extras.spec.ts`

**Interfaces:**
- Produces:
  - Columns:
    - `recordings.server_copy` and `lesson_videos.server_copy`: integer NOT NULL default 1 (Drizzle `serverCopy: integer('server_copy', { mode: 'boolean' }).notNull().default(true)`).
    - `origin_slot`: integer, nullable.
    - `origin_bytes`: integer, nullable.
    - `device_slots.label`: text, nullable.
  - `RecordingRow` and `LessonVideoRow` gain `serverCopy: boolean`, `originSlot: number | null` and `originBytes: number | null`.
  - `type DeviceLabel = { kind: 'android' | 'iphone' | 'ipad' | 'computer'; model: string | null }`.
  - `deviceLabelOf(ua: string): DeviceLabel`.
  - `ServerExtras.devices: Record<string, DeviceLabel>`, keyed by slot as a string. It holds every slot named by an `origin_slot` among the person's own rows.
  - `slotFor(db, userId, deviceKey, now, ua?)` stores `JSON.stringify(deviceLabelOf(ua))` in `label` when it is null or changed.

- [ ] **Step 1: Write the failing tests**
  - `label.spec.ts`:
    - an Android WebView UA `…(Linux; Android 14; Pixel 8 Build/AP2A; wv)…` → `{kind:'android', model:'Pixel 8'}`;
    - an iPhone Safari UA → `{kind:'iphone', model:null}`;
    - Windows Chrome → `{kind:'computer', model:null}`;
    - an Android UA with model `K` (Chrome's reduced UA) → `{kind:'android', model:null}`.
  - `storage.spec.ts` `'a phone-only video counts nothing'`: a person with one recording of 100 bytes and one with `serverCopy:false, sizeBytes:500` → `usedBytes` 100. The same for lesson videos and for a group's sum.
  - `slots.spec.ts` `'the slot keeps the device label'`: `slotFor(db,u,'k',1,ANDROID_UA)` → the row's label parses to `{kind:'android',model:'Pixel 8'}`.
  - `extras.spec.ts` `'devices: the slots holding the person's phone-only originals'`: a recording with `originSlot: 3` and a slot 3 labelled → `extras.devices['3']` equals the label. A slot not referenced is absent.
- [ ] **Step 2: Run them and confirm they fail.**
  `npx vitest run --maxWorkers=4 src/lib/devices src/lib/server/storage.spec.ts src/lib/server/sync/slots.spec.ts src/lib/server/sync/extras.spec.ts`. Expected: FAIL (no module, no column).
- [ ] **Step 3: Implement.**
  - Add the columns, then generate 0049 and read it.
  - The loaders select the three fields.
  - The storage sums filter `server_copy = 1`.
  - Pull and push pass `request.headers.get('user-agent') ?? ''` into `slotFor`.
- [ ] **Step 4: Run Step 2 again, plus the related specs.**
  Expected: PASS. Also run `npx vitest related --maxWorkers=4 src/lib/server/db/schema.ts src/lib/types.ts` → PASS.
- [ ] **Step 5: Commit.**
  `feat(offline): 4c columns: server copy, origin slot and bytes; device labels`

### Task 2: Words

**Files:**
- Modify: `src/lib/i18n/en/*.ts` and `sl/*.ts`. Put them under `video.place` (new) and `settings.onPhone`, next to 4b's words.
- Test: the existing `no-english.spec.ts` and catalog parity specs.

**Interfaces:**
- Produces `t().video.place`. The exact sl copy is below; en says the same in plain English.
  - **Name line:**
    - `onlyHere` «samo na tem telefonu»
    - `onlyIphone` «samo na tem iPhonu»
    - `uploading(pct)` «nalagam {pct} %»
    - `both` «na telefonu in na strežniku»
    - `on(label)`: «na telefonu {model}», «na iPhonu», «na iPadu» or «na računalniku»
    - `missingGallery` «ni več v galeriji»
    - `missingHere` «ni več na tem telefonu»
  - **Where sheet:**
    - `sheetTitle` «Kje je ta video»
    - `thisPhone` «Ta telefon»
    - `original(size)` «Izvirnik · {size} · predvaja se od tu»
    - `server` «Strežnik»
    - `notUploaded` «Ni naložen. Računalnik in druge naprave ga ne morejo predvajati.»
    - `copy(size, p)` «Kopija {p}p · {size}»
    - `upload` «Naloži»
    - `remove` «Odstrani»
    - `sheetNote` «Naloži pošlje manjšo kopijo (velikost iz Nastavitev → Video). Izvirnik vedno ostane na telefonu.»
    - `sheetNoteIphone` «Naloži pošlje izvirnik.»
  - **Grey frame on another device:**
    - `frameTitle(label)` «Na telefonu {model}» (by kind, as above)
    - `frameBody` «Video je samo tam. Odseki so spodaj; predvajate ga lahko na tistem telefonu ali ko ga tam naložite.»
  - **iPhone card and its sheet:**
    - `iphoneTitle` «Video je samo v tem iPhonu»
    - `iphoneBody` «iPhone lahko shranjene datoteke izbriše, ko mu zmanjka prostora ali ko aplikacije dolgo ne odprete. Video, ki je samo tu, bi izgubili. Varno je, ko ga naložite.»
    - `gotIt` «Razumem»
  - **After adding:** `saved` «Shranjeno na tem telefonu»
  - **Deleting:**
    - `deleteOnly` «Video je samo na tem telefonu. V aplikaciji ga ne bo več, tudi njegovih odsekov ne.»
    - `deleteOnlyIphone` «Video je samo v tem iPhonu: izbris je dokončen, tudi njegovih odsekov ne bo več.»
    - `alsoGallery` «Izbriši tudi iz galerije»
  - **Removing the server copy:** `removeDone` «Kopija s strežnika je odstranjena»
  - **Refusals:**
    - `tooBig` «Video je večji od 1 GB, ne morem ga naložiti.»
    - `noRoom`: reuse the storage refusal.
    - `notHolder` «Kopijo s strežnika lahko odstrani samo naprava z izvirnikom.»
    - `copyLeaves(n, label)` «{n} videov je samo {na telefonu X}: ostanejo, dokler jih tam ne naložite.» (`slCount`)
  - **Settings:**
    - `settings.onPhone.legendGallery(size)` «Vaši videi v galeriji · {size}»
    - `legendOriginals(size)` «Vaši videi samo tu · {size}»
- [ ] **Step 1: Add the words.** Run `npx vitest run --maxWorkers=4 src/lib/i18n src/no-english.spec.ts` (or the repo's catalog specs, grep `catalog` in `*.spec.ts`). Expected: PASS.
- [ ] **Step 2: Commit.** `feat(offline): 4c words (en, sl)`

### Task 3: Phone-only rows: create on the device; copies leave them behind

**Files:**
- Create: `src/routes/api/figures/[id]/recordings/phone/+server.ts` and `src/routes/api/lessons/[id]/videos/phone/+server.ts`
- Modify: `src/lib/server/figures.ts` (`addRecording` :905) and `src/lib/server/lessons.ts` (`addLessonVideo` :1411). They take `serverCopy` and set `originSlot = slotOf(row.id)` when it is false.
- Modify: `src/lib/offline/routes.ts` `ENDPOINT_WRITES`, giving both endpoints `{ POST: 'device' }`
- Modify: the clone paths that copy recordings or lesson videos. Each skips rows with `serverCopy === false`:
  - `src/lib/server/clones/clone.ts`, `apply.ts`, `copy-to.ts`, `keep.ts`
  - `src/lib/server/sources.ts` (`takeRecording`)
  - `take-form.ts` (`moveToFrom`)
- Create: `src/lib/server/clones/phone-only.ts`, holding `shareable` and `leftBehind`
- Modify: the Copy to and Move to sheets' question (grep `copyTo` in `src/lib/components`) to say `copyLeaves`
- Test: `src/routes/api/figures/[id]/recordings/phone/phone.spec.ts`, `src/routes/api/lessons/[id]/videos/phone/phone.spec.ts`, `src/lib/server/clones/phone-only.spec.ts`, and `src/lib/offline/routes.spec.ts` (it already fails on an unclassified write)

**Interfaces:**
- Consumes: Task 1's columns.
- Produces:
  - **The two endpoints:** `POST` JSON `{ file: string; mime: string; sizeBytes: number; kind?: 'video' | 'audio'; note?: string | null }` returns 201 with the row (recordings) or `{ video }` (lessons).
    - 400 when `file` fails `RECORDING_FILE_RE`, or `sizeBytes` is not a positive integer up to `MAX_LESSON_VIDEO_BYTES`.
    - 404 for a figure or lesson that is not the person's own (a group's, or another person's). A group's videos always upload.
    - No room check.
  - `shareable<T extends { serverCopy: boolean }>(rows: T[]): T[]`
  - `leftBehind(db, root): { count: number; slots: number[] }`: the phone-only videos under a figure, move or lesson that a copy would leave behind.

- [ ] **Step 1: Write the failing tests.**
  - The endpoints follow `dance-wall.spec.ts`'s db mock pattern:
    - `'makes a phone-only recording on the person's own figure'`: 201, the row has `serverCopy:false`, `originSlot: slotOf(row.id)` and `sizeBytes` as sent, and `usedBytes` is unchanged.
    - `'a group's figure: 404'`
    - `'a bad file name: 400'`
    - The same three for lessons.
  - `phone-only.spec.ts`:
    - `'Keep in step does not copy a phone-only recording'`: clone a figure holding one uploaded recording and one phone-only recording. The clone gets one recording.
    - `'copyTo a group leaves phone-only videos behind'`: same check.
    - `'leftBehind counts them with their slots'`.
  - `routes.spec.ts` passes once both endpoints are classified.
- [ ] **Step 2: Run them and confirm they fail.**
  `npx vitest run --maxWorkers=4 src/routes/api/figures src/routes/api/lessons src/lib/server/clones/phone-only.spec.ts src/lib/offline/routes.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The endpoints follow `/api/video-spots` POST: JSON, `t()` refusals, `writeGate` as the other writes do.
  - Read access through `access.ts` (`judgeFigure`/`judgeLesson`, or what the recordings POST uses). A row in a space other than the person's own → 404.
  - Call `flowAfter` as the recordings POST does; the phone-only filter keeps it from copying.
- [ ] **Step 4: Run Step 2 again.** Expected: PASS. Also run `npx vitest related --maxWorkers=4` on the changed clone files → PASS.
- [ ] **Step 5: Commit.** `feat(offline): phone-only rows made on the device; copies leave them behind`

### Task 4: Upload to an existing row, chunked recordings, Remove server copy, AI

**Files:**
- Create:
  - `src/routes/api/recordings/[id]/file/[uploadId]/+server.ts` (PUT, chunked)
  - `src/routes/api/lesson-videos/[id]/file/[uploadId]/+server.ts` (PUT, chunked)
  - `src/routes/api/recordings/[id]/server-copy/+server.ts` (DELETE)
  - `src/routes/api/lesson-videos/[id]/server-copy/+server.ts` (DELETE)
  - `src/routes/api/figures/[id]/recordings/[uploadId]/+server.ts` (PUT): a new recording, chunked, the twin of `/api/lessons/[id]/videos/[uploadId]`
- Create: `src/lib/server/phone-videos.ts`, holding `attachServerCopy` and `removeServerCopy`
- Modify: `src/lib/offline/routes.ts`: the three PUTs are `'pass'`, the DELETEs `'network'`. Add the PUT paths to `UPLOADS` in `sw-route.ts` :67.
- Modify: `src/lib/server/mcp/video.ts` (`videosImpl` :228 marks it; `timelineImpl` :264 refuses) and `src/lib/server/ai-timelines/store.ts` (`claimTimeline`/`timelineSource` skip phone-only)
- Modify: the figure page's web upload (`UploadButton` :709) → `ChunkedUploadButton` with `uploadUrl="/api/figures/{id}/recordings"` (keep the POST route for old apps)
- Test: specs beside each route; `src/lib/server/phone-videos.spec.ts`; `src/lib/server/mcp/video.spec.ts`

**Interfaces:**
- Consumes: Task 1's columns and `writeChunk` (`src/lib/server/files.ts:232`).
- Produces:
  - `attachServerCopy(db, table: 'recordings' | 'lesson_videos', id: number, bytes: number): Row`. It sets `serverCopy: true`, `sizeBytes: bytes`, and `originBytes` (old `sizeBytes` when `originBytes` was null).
  - `removeServerCopy(db, table, id, slot: number): Row`. It throws `NotHolderError` unless `row.originSlot === slot`. It sets `serverCopy: false` and `sizeBytes: originBytes ?? sizeBytes`. The route unlinks the file after the transaction.
  - **The file PUT:**
    - protocol: `content-range`, 409 + `x-received-bytes`, 201 on the last chunk with the row;
    - cap `MAX_LESSON_VIDEO_BYTES`;
    - `roomForOwner` before the first chunk and on the last;
    - 404 unless the person owns the row and `serverCopy` is false.
    - The file is written under the row's own `file` name.
  - **The server-copy DELETE:** JSON `{ slot: number }` → 200 `{ row }`. Errors:
    - 403 `notHolder` when the slot differs;
    - 404 when not own;
    - 409 when there is no server copy;
    - 400 when the slot is not one of this person's (`device_slots.user_id`).
  - **AI:**
    - `timelineImpl` on a phone-only video returns `{ error: 'on a device', device: DeviceLabel | null }`, the shape the tool's errors use. It queues nothing.
    - `videosImpl` adds `onDevice: true` to such rows.

- [ ] **Step 1: Write the failing tests.**
  - `'upload attaches the server copy: last chunk → serverCopy true, sizeBytes the upload's, originBytes the original's'`
  - `'a cut-off upload leaves the row phone-only'`: one chunk, no last → the row is unchanged and `usedBytes` is unchanged (Review Focus 3)
  - `'no room: 413 (or the storage refusal's status) and the row is unchanged'`
  - `'over 1 GiB: refused before writing'`
  - `'remove server copy from the holder: file gone, serverCopy false, sizeBytes back to the original's'`
  - `'from another slot: 403, nothing changes'`
  - `'a new recording, chunked: the last chunk makes the row (serverCopy true)'` and `'the old single POST still works'` (Review Focus 5)
  - `'video_timeline on a phone-only video says it is on a device and queues nothing'`
- [ ] **Step 2: Run them and confirm they fail.**
  `npx vitest run --maxWorkers=4 src/routes/api/recordings src/routes/api/lesson-videos src/routes/api/figures src/lib/server/phone-videos.spec.ts src/lib/server/mcp`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Copy the structure of `/api/lessons/[id]/videos/[uploadId]/+server.ts`, its `.done` file included.
  - Refusals go through `t().refusals` (`refusals-guard.spec.ts`).
- [ ] **Step 4: Run Step 2 again.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(offline): upload a phone-only video later, chunked recordings, remove the server copy`

### Task 5: The device keeps originals (iPhone, phone browser)

**Files:**
- Modify: `src/lib/offline/media-store.ts`
  - `MediaKind` gains `'originals'`.
  - `MediaFile` gains `owner?: string`, written to `.meta`.
  - `clear(kinds)` callers never pass it.
- Modify: `src/device/media.ts` (`syncMedia`): the keeper's unwanted sweep skips `originals`. A separate `sweepOriginals` removes an original only when:
  - its owner is the current person,
  - the last pull reached the server,
  - and no row of either table in the copy has that file.
- Modify: `src/device/core.ts` (`clearMedia` at :304, :393, :734): never the `originals` kind.
- Modify: `src/device/worker.ts` and `src/lib/offline/protocol.ts`, adding three messages:
  - `DeviceIn {type:'original-put', file, mime, blob}` → reply `{ok:true}` / `{ok:false, reason:'space'|'store'}`
  - `{type:'original-get', file}` → `{blob: Blob | null}`
  - `{type:'original-drop', file}` → `{ok}`
- Modify: `KeepStatus` gains `slot: number | null`, `originals: string[]` (file names) and `bytes.originals: number`.
- Modify: `src/service-worker.ts` `media()` :250: try `originals/<file>` first, then the kind, then the network.
- Modify: `src/lib/offline/device.svelte.ts`: `putOriginal(file, mime, blob)`, `getOriginal(file)`, `dropOriginal(file)` via `ask()`.
- Test: `src/lib/offline/media-store.spec.ts`, `src/device/media.spec.ts` (or the keeper's spec), `src/lib/offline/sw-route.spec.ts` or the service worker media spec

**Interfaces:**
- Consumes: Task 1's row fields in the copy.
- Produces:
  - `sweepOriginals(deps: { store: MediaStore; person: string; pulledOnline: boolean; rowFiles: Set<string> }): Promise<string[]>` (removed names)
  - the page helpers above.

- [ ] **Step 1: Write the failing tests** (Review Focus 1).
  - `'Clear kept videos leaves originals'`
  - `'a person change empties kept media, not originals'`
  - `'an original whose row was deleted elsewhere goes after an online pull'`
  - `'…but not offline, and not another person's'`
  - `'the keeper's not-wanted sweep never touches originals'`
  - `'the service worker answers /recordings/<file> from originals first, with Range'` (`X-Salsa-From: device`)
  - `'original-put then original-get returns the same bytes'` (FakeDir from `test-opfs.ts`)
- [ ] **Step 2: Run them and confirm they fail.**
  `npx vitest run --maxWorkers=4 src/lib/offline/media-store.spec.ts src/device src/lib/offline/sw-route.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `sweepOriginals` runs after each sync pass, where `syncMedia` runs (`core.ts:669`).
  - `KeepStatus.bytes.originals` is `store.usage(['originals'])` for the current owner.
  - Low-space suggestions (`kept-view.ts` `suggestions`) add `{kind:'original', file, title, bytes}` with an Upload action for originals not yet uploaded. 4b's "Upload first" is in the spec.
- [ ] **Step 4: Run Step 2 again**, plus `npm run test:device -- src/device/media` if the keeper's device suite covers it. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(offline): originals kept on the device, never cleared`

### Task 6: Where a video is (pure), uploads in flight, phone first

**Files:**
- Create: `src/lib/offline/where.ts` and `where.spec.ts`
- Create: `src/lib/offline/uploads.svelte.ts` (module state, like `src/lib/songs/upload.svelte.ts`)
- Create: `src/lib/offline/phone-first.ts` and `phone-first.spec.ts`

**Interfaces:**
- Consumes: Task 1's row fields and `ServerExtras.devices`; Task 5's `KeepStatus.slot` and `originals`.
- Produces:
  - `type Place`:
    - `{state:'server'}`: 4b's KeepButton as today
    - `{state:'only'; iphone:boolean}`
    - `{state:'uploading'; pct:number}`
    - `{state:'both'; copyBytes:number; copyP: 480|720|1080}`
    - `{state:'elsewhere'; label:DeviceLabel|null}`
    - `{state:'missing'; gallery:boolean}`
  - `placeOf(row: {file; serverCopy; originSlot; sizeBytes; originBytes}, ctx: {held: (file:string)=>boolean; slot: number|null; uploading: (file:string)=>number|null; devices: Record<string,DeviceLabel>; iphone: boolean; android: boolean; shortSide: 480|720|1080}): Place`. Its rules, in order:
    1. If the original is held here: uploading → `uploading`; else server copy → `both`; else `only`.
    2. If the row is phone-only and `originSlot === slot`: `missing` (`gallery: android`).
    3. If the row is phone-only: `elsewhere`.
    4. Otherwise: `server`.
  - `uploads`, a `$state` map `file → pct`. Its functions:
    - `startUpload(file, run: (onPct)=>Promise<void>)`
    - `uploadOf(file): number | null`
  - `phoneFirst(env: {app: boolean; appVideos: boolean; coarse: boolean; store: boolean}): boolean`. True when either holds:
    - `appVideos`;
    - `!app && coarse && store`.
  - `isIphone(ua: string): boolean`: iPhone, iPad, or Macintosh with touch.

- [ ] **Step 1: Write the failing tests.**
  - `where.spec.ts`, one case per rule, including:
    - `'held here but the slot not known yet → only'` (Review Focus 4);
    - `'phone-only, slot matches, not held → missing'`;
    - `'phone-only from slot 3 → elsewhere with devices["3"]'`;
    - `'uploaded and held → both with the copy size'`.
  - `phone-first.spec.ts`:
    - `'old Android app (app, no SalsaVideos) → false'` (Review Focus 5);
    - `'desktop (fine pointer) → false'`;
    - `'iPhone web app with the store → true'`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run --maxWorkers=4 src/lib/offline/where.spec.ts src/lib/offline/phone-first.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run Step 2 again.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(offline): where a video is, uploads in flight, phone first`

### Task 7: The look: Where button and sheet (1B), grey frame (2A), missing

**Files:**
- Create: `src/lib/components/ui/WhereButton.svelte` and `src/lib/components/ui/WhereSheet.svelte`
- Create: `src/lib/components/ui/ElsewhereFrame.svelte`
- Modify:
  - `src/lib/components/ui/VideoFrame.svelte`: a `place?: Place` prop. It shows WhereButton in KeepButton's place when `place.state !== 'server'`, ElsewhereFrame instead of `<video>` for `elsewhere`, and the name line from `place`.
  - `src/lib/components/figures/RecordingRow.svelte`: the same in the row; for `elsewhere`, a dimmed phone disc that does not open the player.
  - the lesson page, `SimpleLesson.svelte`, the figure page and the exercise kinds' `Content.svelte`: compute `placeOf` and pass it.
  - `src/routes/dev/kit/+page.svelte`: each state.
- Modify: `src/lib/icons/icons.ts`: `cloud`, `cloud-up`, `cloud-check` and `cloud-off`, Lucide paths as in the mockup's generator.
- Test: `src/lib/offline/where.spec.ts` covers the logic. Run the component guards (`class-rules.spec.ts`, `no-english.spec.ts`, `focus-clip.spec.ts`).

**Look** (mockup: `scratchpad/4c/vasi-videi-na-telefonu.html`; spec "4c's looks"):
- **WhereButton:** the 4b KeepButton's size and place.
  - Icon `phone` for `only` and `missing`, `cloud-check` in `text-done` for `both`.
  - For `uploading`, a ring with pct, as 4b's coming state.
  - `aria-label` is `t().video.place.sheetTitle`.
- **WhereSheet:** `<Sheet size="small">`, a GROUP of two rows.
  - Row 1 is this phone: a tile with `phone-check` and `original(size)`, with a check at the right.
  - Row 2 is the server: either `notUploaded` + Upload (accent button), or `copy(size,p)` + Remove (plain).
  - Under the group: `sheetNote`, or `sheetNoteIphone` on an iPhone.
  - Remove calls Task 4's DELETE with `KeepStatus.slot`. It shows `removeDone` as a toast and refreshes with `refreshWhenSettled()`.
- **ElsewhereFrame:** `aspect-video`, `bg-[#2c2724]` through a token if one exists (else add one to the theme), a centred `phone` icon, `frameTitle(label)` bold and `frameBody` small.
- **Missing:** the name line is `missingGallery` on Android and `missingHere` elsewhere, in `text-danger`. The sheet offers only Delete (the page's existing delete).

- [ ] **Step 1: Build the components and wire the pages.** Run `npx vitest run --maxWorkers=4 src/lib/components src/no-english.spec.ts src/lib/offline/where.spec.ts` and `npx eslint` + `npx prettier --check` on the changed files. Expected: PASS.
- [ ] **Step 2: Screenshot the states** on a db copy (`scripts/offline/serve.sh` + a Playwright script as in the mockups; plant rows with `server_copy=0`). Check against the mockup by eye.
- [ ] **Step 3: Commit.** `feat(offline): Where is this video (1B), the grey frame on another device (2A)`

### Task 8: Adding a video on the phone (web: iPhone, phone browser)

**Files:**
- Modify: `src/lib/components/figures/AddRecordingSheet.svelte`, the figure page (:709, :1011) and `DrillRecordings.svelte`
- Modify: the lesson page (:1104) and `SimpleLesson.svelte` (:350)
- Create: `src/lib/offline/add-phone.ts` and `add-phone.spec.ts`
- Modify: the page toast on both pages: `saved` with action `upload`

**Interfaces:**
- Consumes: Task 3's endpoints; Task 5's `putOriginal`; Task 6's `phoneFirst` and `startUpload`; Task 4's file PUT.
- Produces:
  - `addOnPhone(target: {figureId:number} | {lessonId:number}, file: File, deps: {put: typeof putOriginal; post: (url, body)=>Promise<Response>; uuid: ()=>string}): Promise<{ ok: true; file: string } | { ok: false; reason: 'space' | 'store' | 'refused' }>`. The steps:
    - Name the file `<uuid>.<ext>`, with the extension from `file.type` / `file.name` (`mp4`, `mov`, `webm`; else `mp4`).
    - `put` first, then `post` to the phone endpoint (the device runs it).
    - If the post fails, `dropOriginal`.
  - `uploadOriginal(row, table, deps): Promise<void>`. It reads `getOriginal`, then chunk-PUTs to Task 4's file route through the ChunkedUploadButton logic (move its chunk loop into `src/lib/upload-queue.ts` as `putChunks(url, blob, onPct)`), reporting `uploads` pct.

- [ ] **Step 1: Write the failing tests.**
  - `'adds on the phone: original stored, then the row; the file name is a uuid with the extension'`
  - `'no space: nothing posted'`
  - `'the row refused: the original is dropped'`
  - `'a group lesson: phone first is not offered (the page uses ChunkedUploadButton)'`. The page condition is `phoneFirst(...) && ownSpace`; test it through a small exported `addMode(env, own): 'phone' | 'upload' | 'app-link'`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run --maxWorkers=4 src/lib/offline/add-phone.spec.ts src/lib/upload-queue.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
  - The file picker stays the same input; on change, `addMode` decides.
  - Desktop and groups keep uploading at once.
  - The old app keeps `AppUploadLink`.
- [ ] **Step 4: Run Step 2 again**, plus `npx vitest related --maxWorkers=4` on the pages. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(offline): a new video on the phone stays there; Upload later`

### Task 9: iPhone card (3B), deleting, Settings, the walk

**Files:**
- Create: `src/lib/components/ui/IphoneCard.svelte`; `src/lib/offline/iphone-warned.ts` and its spec (localStorage `salsa:iphone-warned`, every access in try/catch)
- Modify:
  - VideoFrame and RecordingRow: the card under the first video whose `place` is `only` with `iphone`, until it is closed (Got it or ×; Upload also closes it). An ⓘ after `onlyIphone` opens a small Sheet with the same words.
  - The delete question on the lesson and figure pages: `deleteOnly` / `deleteOnlyIphone` for phone-only rows. After a successful delete, `dropOriginal(file)`.
  - `src/routes/settings/phone/+page.svelte`: a third segment in the bar (`bytes.originals`) and `legendOriginals`. Android's gallery line comes in Task 12.
- Modify: `scripts/offline/walk.py` (+ README), adding a check: on a phone-first context (`has_touch`, `is_mobile`), add a small webm to an own figure offline. It plays from the device (`X-Salsa-From: device`), syncs once online with `server_copy` 0, then Upload makes `server_copy` 1.
- Modify: docs. Spec "Decided while building 4c (part 1)"; `docs/features.md`; `docs/layout.md` (new modules); `docs/hard-rules.md` ("recordings are chunked too"); `CLAUDE.md` line on uploads.

- [ ] **Step 1: Test `iphone-warned.ts`.**
  - `'warned once: shown, closed, never again'`
  - `'storage throws: shown, closing works for the session'`
  - Run `npx vitest run --maxWorkers=4 src/lib/offline/iphone-warned.spec.ts`. Expected: FAIL, then PASS after implementing.
- [ ] **Step 2: Wire the card, the delete words and Settings.** Check them with eslint/prettier on the changed files and `npx vitest related --maxWorkers=4`.
- [ ] **Step 3: Run the walk** on an en/all copy of the latest backup (`scripts/offline/README.md`). Expected: the new check `ok`. The known "menu greys Copy to" failure is pre-existing.
- [ ] **Step 4: Full `npm run check`** (it runs before the final review of part 1). Expected: PASS.
- [ ] **Step 5: Commit.** `feat(offline): iPhone card once, deleting a phone-only video, originals in Settings`

**Part 1 ends here: whole-branch review, then ask the user to merge and deploy (backup first).**

---

## Part 2 — the Android app

### Task 10: Native originals: pick, hold, serve with Range

**Files** (under `android/app/src/main/kotlin/eu/anotherroot/salsa/`):
- Create:
  - `OriginalStore.kt`: a JSON file in `filesDir/originals.json`: `file → {uri, mime, size, userId}`
  - `MediaServe.kt`: a pure Range parser plus a `WebResourceResponse` builder
  - `VideosBridge.kt`: the `SalsaVideos` web message listener
- Modify: `WebShell.kt`
  - register `SalsaVideos` (SITE origin only, like the others);
  - an `ActivityResultLauncher` for `PickVisualMedia.VideoOnly` (multiple for a lesson);
  - `shouldInterceptRequest` on the WebViewClient AND `ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(...)`, both calling `MediaServe` for GET `SITE/recordings/<file>` and `SITE/lesson-videos/<file>` when `OriginalStore` holds the file.
- Test: `android/app/src/test/kotlin/eu/anotherroot/salsa/MediaServeTest.kt` and `OriginalStoreTest.kt`

**Interfaces:**
- Produces the bridge protocol: the page posts JSON with an `id`, and the app replies JSON with the same `id`.
  - `{op:'pick', id, multiple:boolean}` → `{id, files:[{file, mime, size, name}]}` (empty when cancelled). The app:
    1. takes a persistable read permission;
    2. probes mime and size (`VideoProbe`);
    3. names the file `<uuid>.<ext>` (mp4 by default);
    4. stores it with the signed-in person (`userId` passed in the pick message).
  - `{op:'held', id, userId}` → `{id, files:[{file, size, readable:boolean}]}`
  - `{op:'forget', id, file, gallery:boolean}` → `{id, ok, deleted:boolean}`.
    - `gallery` on Android 11+ uses `MediaStore.createDeleteRequest` (the system asks).
    - On Android 10 it only releases the permission and returns `deleted:false`.
  - `{op:'space', id}` → `{id, free:number, gallery:number}`: `StatFs(filesDir).availableBytes` and the sum of held sizes.
- Produces the serving rules:
  - 200 with the whole file;
  - 206 for `Range: bytes=a-b` / `a-` with `Content-Range`, `Accept-Ranges`, `Content-Length` and `X-Salsa-From: device`;
  - 416 past the end;
  - 404 when the URI no longer opens.

- [ ] **Step 1: Write the failing JUnit tests.**
  - `MediaServeTest`: `bytes=0-0`, `bytes=100-`, `bytes=-500` (suffix), past the end → 416, no header → 200.
  - `OriginalStoreTest`: put, get, forget, and survives a reload from the file.
- [ ] **Step 2: Run them and confirm they fail.** `nix develop .#android -c ./android/gradlew -p android test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and the build.** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 5: Commit.** `feat(android): originals stay in the gallery, served to the page with Range`

### Task 11: Native upload of a phone-only video; chunked recordings

**Files:**
- Modify:
  - `UploadQueue.kt`, `UploadWorker.kt` (:105–243), `UploadPlan.kt`, `JobStore`;
  - `VideosBridge.kt`, adding `upload`;
  - `android/app/build.gradle.kts`: `versionCode = 11`, `versionName = "1.10"`.
- Test: `android/app/src/test/.../UploadPlanTest.kt` (or the existing plan test)

**Interfaces:**
- Consumes: Task 4's routes.
- Produces:
  - **Upload:** `{op:'upload', id, kind:'recording'|'lesson-video', rowId, file}` → `{id, queued:true}`. The app then posts:
    - `{event:'progress', file, pct}`
    - `{event:'done', file}`
    - `{event:'failed', file, reason}`

    It posts while a page is listening, and keeps the foreground notification as today.
  - **Job target:** a new `UploadTarget.ExistingRow(kind, rowId)` → chunked PUT to `/api/recordings/{rowId}/file/{serverId}` or `/api/lesson-videos/{rowId}/file/{serverId}`.
  - **Group recordings:** `UploadTarget.Figure` switches to chunked `/api/figures/{id}/recordings/{serverId}`.
  - **The original's permission:** `finish()` must not release the persistable permission of a file in `OriginalStore`. Shared copies and non-original picks are released as today.

- [ ] **Step 1: Write the failing tests.**
  - `'an existing row's job PUTs to its file route'`
  - `'a figure job is chunked now'`
  - `'finish keeps an original's permission'`. Wrap the release behind a small interface, so the test passes a fake.
- [ ] **Step 2: Run them and confirm they fail.** `nix develop .#android -c ./android/gradlew -p android test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 5: Commit.** `feat(android): upload a phone-only video later; recordings chunked; 1.10 (11)`

### Task 12: The page talks to the app

**Files:**
- Create: `src/lib/offline/app-videos.ts` and `app-videos.spec.ts`
- Modify:
  - Task 8's `addMode` and wiring: `'app-phone'` uses `pick`, then the phone endpoint.
  - Task 6's `held` source: the app's held files merged with OPFS originals.
  - The Where sheet's Upload calls the bridge on Android.
  - `uploads` takes the app's progress events.
  - The delete question gains the gallery checkbox (Android 11+, `deleted` result) and calls `forget` after the delete succeeds.
  - Settings → On this phone takes `free` from `space` and shows `legendGallery(gallery)`.
- Modify: docs. Spec "Decided while building 4c (part 2)"; `docs/deployment.md`'s release notes line; `docs/layout.md`.

**Interfaces:**
- Produces `appVideos(): AppVideos | null`. It returns null without `window.SalsaVideos` (old app → Review Focus 5). `AppVideos` has:
  - `pick(multiple, userId): Promise<Picked[]>`
  - `held(userId)`
  - `upload(kind, rowId, file)`
  - `forget(file, gallery)`
  - `space()`
  - `on(event cb)`

  It matches replies by `id`, with a 30 s timeout → null.

- [ ] **Step 1: Write the failing tests.**
  - `'no bridge → null'`
  - `'replies match by id; a late reply after the timeout is dropped'`
  - `'progress events reach uploads'`
  - `'addMode: new app on own figure → app-phone; old app → app-link; group → app-link'`
  - Run `npx vitest run --maxWorkers=4 src/lib/offline/app-videos.spec.ts src/lib/offline/add-phone.spec.ts`. Expected: FAIL.
- [ ] **Step 2: Implement and wire.** Run Step 1 again. Expected: PASS.
- [ ] **Step 3: Full `npm run check`, then the whole-branch review.**
- [ ] **Step 4: Commit.** `feat(offline): the page keeps Android originals in the gallery through the app`

**Part 2 ends here:**
1. The user tests a debug APK on their phone (install with `adb` or by sending the file).
2. With their approval, merge and deploy.
3. Then `scripts/release.sh both`; not `--required`, older apps keep working.
