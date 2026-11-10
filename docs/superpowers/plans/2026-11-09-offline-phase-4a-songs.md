# Offline phase 4a: songs on the phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The audio of every song the person can play and their count takes
are kept on the device automatically, and the player plays them with no
signal.

**Architecture:** A media store in the browser's own storage (OPFS, a
`media/` directory) holds the files by their server name. The device worker
fills it after each sync from the copy's `songs` and `count_takes` rows
(download what is missing, remove what is no longer wanted). The service
worker answers `GET /audio/<file>` and `GET /count/<file>` from the store
first, with Range, else from the network, so the player needs no change.
The store empties with the copy when the person changes or is forgotten.

**Tech Stack:** SvelteKit service worker, the device worker (dedicated
worker, `src/device/`), OPFS (`navigator.storage.getDirectory()`), Vitest,
the Playwright walk (`scripts/offline/`).

**Spec:** `docs/superpowers/specs/2026-11-09-offline-phase-4-design.md`
(part 4a and "Claude's calls"), on top of
`docs/superpowers/specs/2026-11-07-offline-design.md` ("Media on the
device").

## Global Constraints

- One store on every device, Android's WebView too: OPFS, served with Range
  by the service worker. No APK change in 4a.
- Songs download on any connection (no Wi-Fi rule for songs).
- Automatic, no buttons. The only look: a plain line in Settings saying how
  much the songs take.
- A device never holds a file its person may not read: the wanted list comes
  only from rows in the copy (`syncScope` already walls them), and the store
  is emptied whenever the copy is wiped for another person or forgotten.
- Words through `t()`, in `en` and `sl` (vikanje, `byteSize` for sizes).
- Specs never touch `$DATA_DIR`; Vitest at most `--maxWorkers=4`.
- Phone-only and kept videos are 4b/4c: `/lesson-videos/` and `/recordings/`
  stay network endpoints.

## Review Focus

1. A download cut off half way (tab closed, signal lost) must never leave a
   file that is served as whole: the store commits a file only once all of
   it is in. (Task 2 and Task 4 tests.)
2. Another person signs in on the same phone: the first person's files go
   before the new copy serves. (Task 4 test.)
3. A song's audio replaced (a new file name): the old file goes, the new one
   comes, nothing is fetched twice. (Task 4 test.)
4. The audio element's own requests: `bytes=0-`, a seek past the end
   (416), no Range at all. (Task 1 tests.)
5. Online with the file on the phone: the phone's copy answers (no data used,
   no wait on the network). (Task 3 sets a marker header; Task 6's walk
   checks it.)

---

### Task 1: Range answers from a file

**Files:**
- Create: `src/lib/offline/media-range.ts`
- Test: `src/lib/offline/media-range.spec.ts`

**Interfaces:**
- Produces: `rangeResponse(body: Blob, range: string | null, mime: string): Response`

- [ ] **Step 1: Write the failing tests** (`describe('media from the phone: Range')`), with a 1000-byte Blob of known bytes:
  - `no Range: 200, the whole file` → status 200, `Content-Length: 1000`, `Accept-Ranges: bytes`, `Content-Type` the mime.
  - `bytes=0-99: 206 and the first 100 bytes` → status 206, `Content-Range: bytes 0-99/1000`, `Content-Length: 100`, body equals bytes 0–99.
  - `bytes=0-: 206, the whole file` (what `<audio>` sends first) → `Content-Range: bytes 0-999/1000`.
  - `bytes=900-` → bytes 900–999; `bytes=-100` (suffix) → bytes 900–999.
  - `bytes=950-2000` → clamped to `bytes 950-999/1000`.
  - `bytes=1000-` → 416 with `Content-Range: bytes */1000`.
  - `a malformed or multi-range header: 200, the whole file` (`items=0-5`, `bytes=0-1,5-9`).
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/offline/media-range.spec.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `rangeResponse` with `Blob.slice`; no Node APIs (it runs in the service worker).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `offline: Range answers from a file on the phone (phase 4a)`.

### Task 2: The media store

**Files:**
- Create: `src/lib/offline/media-store.ts`
- Test: `src/lib/offline/media-store.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MediaKind = 'audio' | 'count';
  export type MediaFile = { kind: MediaKind; file: string; mime: string };
  export type MediaStore = {
  	/** What the store holds, whole files only. */
  	list(): Promise<MediaFile[]>;
  	/** The file and its type, or null. */
  	read(kind: MediaKind, file: string): Promise<{ body: Blob; mime: string } | null>;
  	/** Reads the response's body to the end, then commits; a body that fails stores nothing. */
  	write(f: MediaFile, res: Response): Promise<void>;
  	remove(kind: MediaKind, file: string): Promise<void>;
  	clear(): Promise<void>;
  	/** Bytes held. */
  	usage(): Promise<number>;
  };
  export function memoryMediaStore(): MediaStore; // specs, and a browser without OPFS
  export function opfsMediaStore(): Promise<MediaStore | null>; // null: no OPFS here
  export function mediaPath(kind: MediaKind, file: string): string; // '/audio/<file>' | '/count/<file>'
  export function mediaOf(path: string): { kind: MediaKind; file: string } | null;
  ```
- [ ] **Step 1: Write the failing tests** against `memoryMediaStore()`:
  - `write then read: the bytes and the mime come back`; `list` holds it; `usage` is its size.
  - `a body that errors half way stores nothing` (a `ReadableStream` that enqueues bytes then errors: `write` rejects, `read` is null, `list` is empty).
  - `remove` and `clear` leave nothing; `usage` 0.
  - `mediaOf('/audio/x.wav')` → `{ kind: 'audio', file: 'x.wav' }`; `/count/…` likewise; `mediaOf('/recordings/x.mp4')`, `/audio/../x`, `/audio/a/b` → null; `mediaPath` is its inverse.
- [ ] **Step 2:** Run the spec → FAIL.
- [ ] **Step 3:** Implement. `opfsMediaStore`: directory `media/<kind>/`, files under their server names, the mime beside each (the builder's choice: a sidecar file or an index). A file becomes visible to `list`/`read` only once whole: write under a temporary name and rename, or the `createWritable()` commit on close; never serve a temporary name. Works in a window, the service worker and the device worker.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `offline: the media store, whole files only (phase 4a)`.

### Task 3: The service worker answers songs from the phone

**Files:**
- Modify: `src/lib/offline/routes.ts` (move `'/audio/[file]'` and `'/count/[file]'` out of `NETWORK_ENDPOINTS` into a new exported `MEDIA_ENDPOINTS`; header comment says what it means)
- Modify: `src/lib/offline/routes.spec.ts` (the every-endpoint-classified check includes `MEDIA_ENDPOINTS`)
- Modify: `src/lib/offline/sw-route.ts` (`SwRoute` gains `'media'`)
- Modify: `src/lib/offline/sw-route.spec.ts`
- Modify: `src/service-worker.ts` (`case 'media'`)

**Interfaces:**
- Consumes: `rangeResponse` (Task 1), `opfsMediaStore`, `mediaOf` (Task 2).
- Produces: `MEDIA_ENDPOINTS: string[]`; `swRoute(...)` returns `'media'` for a non-navigate `GET` on a media endpoint.

- [ ] **Step 1: Write the failing tests** in `sw-route.spec.ts`: `GET /audio/<uuid>.wav` and `GET /count/<uuid>.wav` (mode `cors`/`no-cors`/`same-origin`) → `'media'`; `HEAD` and `POST` there → not `'media'`; a navigation to `/audio/<uuid>.wav` → `'pass'` (as today); `/recordings/<uuid>.mp4` and `/lesson-videos/<uuid>.mp4` unchanged from today. In `routes.spec.ts` the classification check still passes with the new list.
- [ ] **Step 2:** Run both specs → FAIL.
- [ ] **Step 3:** Implement the route, then in `service-worker.ts` a `media(request)` handler: the store's file → `rangeResponse(...)` with the header `X-Salsa-From: device` added; no store or no file → `fetch(request)` (the network as today). A store error falls back to the network, never an error page.
- [ ] **Step 4:** Run the two specs plus `npx vitest related src/service-worker.ts` → PASS.
- [ ] **Step 5:** Commit `offline: songs and count takes answer from the phone first (phase 4a)`.

### Task 4: The device keeps the songs

**Files:**
- Create: `src/device/media.ts`
- Test: `src/device/media.spec.ts`
- Modify: `src/device/core.ts` (a `clearMedia: () => Promise<void>` dep, awaited right after `wipeCopy` in `wipeOther` and in `forget`; a `wantedMedia(): MediaFile[]` on `Device`)
- Modify: `src/device/core.spec.ts`
- Modify: `src/device/worker.ts` (wiring)

**Interfaces:**
- Consumes: `MediaStore`, `MediaFile`, `mediaPath`, `memoryMediaStore` (Task 2).
- Produces:
  ```ts
  /** The copy's songs with audio (not archived) and the person's count takes, as files. */
  export function wantedMedia(db: SqliteDb, userId: string): MediaFile[];
  /** Brings the store to `wanted`: fetches what is missing one at a time, removes the rest. */
  export function syncMedia(deps: {
  	wanted: MediaFile[];
  	store: MediaStore;
  	fetchMedia: (path: string) => Promise<Response>;
  	online: () => boolean;
  	log: Pick<Console, 'warn'>;
  }): Promise<{ fetched: number; removed: number; failed: number }>;
  ```
- [ ] **Step 1: Write the failing tests** (`media.spec.ts`, a migrated in-memory db as `core.spec.ts` builds one):
  - `wantedMedia`: the person's own song with `audio_file` and `mime` → `{ kind: 'audio', file, mime }`; a group's song in the copy too; an archived song, a song with no `audio_file` (still downloading on the worker) → left out; the person's count takes → `{ kind: 'count', file, mime: 'audio/wav' }`; another user's count take → left out.
  - `syncMedia`: fetches only what the store lacks (a held file is not fetched again); removes a held file no longer wanted; a song whose `audio_file` changed: the old goes, the new comes; a 404 or a rejected fetch counts as `failed`, stores nothing and the next file still comes; a body that errors half way stores nothing; `online()` false → nothing fetched and nothing removed.
  - `core.spec.ts`: `forget()` awaits `clearMedia`; a person switch that wipes the copy (`person('u2')` over u1's copy) awaits `clearMedia` before the new copy serves; a switch back to the same person does not clear.
- [ ] **Step 2:** `nix develop -c npx vitest run --maxWorkers=4 src/device/media.spec.ts src/device/core.spec.ts` → FAIL.
- [ ] **Step 3:** Implement. In `worker.ts`: open `opfsMediaStore()` once (null → no media sync, nothing else changes); after `start()` reaches ready and after every `device.sync()` that is not `'offline'`, run `syncMedia` with `device.wantedMedia()`, `fetchMedia = (p) => fetch(p, { credentials: 'same-origin' })`, one run at a time (a run asked during one queues exactly one more, as `oneAtATime` does). `clearMedia` = the store's `clear()`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `offline: the device keeps every song it may play (phase 4a)`.

### Task 5: The line in Settings

**Files:**
- Modify: `src/routes/settings/+page.svelte` (a new section after Storage, label `w.onPhone.label`, one plain row)
- Modify: `src/lib/storage-view.ts` (`songsOnPhoneLine(bytes: number): string`)
- Modify: `src/lib/i18n/en/settings.ts`, `src/lib/i18n/sl/settings.ts`
- Test: `src/lib/storage-view.spec.ts` (create if missing)

**Interfaces:**
- Consumes: `opfsMediaStore().usage()` (Task 2), read on the page (`onMount`); no store → the section is not drawn.
- Produces: `settings.onPhone = { label, songs(size) }`:
  - en: `label: 'On this phone'`, `songs: (size) => \`Songs and your count · ${size}\``
  - sl: `label: 'Na tem telefonu'`, `songs: (size) => \`Pesmi in vaše štetje · ${size}\``

- [ ] **Step 1: Write the failing test:** `songsOnPhoneLine(34 * 1024 * 1024)` in en is `'Songs and your count · ' + byteSize(34 * 1024 * 1024)`, and in sl starts with `'Pesmi in vaše štetje · '`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the function, the words and the row (the Storage section's `GROUP` and `SECTION_LABEL` look, a plain text row, no link). Drawn also for `few` levels: it is the device's, not the server's.
- [ ] **Step 4:** Run the spec plus `no-english.spec.ts` → PASS.
- [ ] **Step 5:** Commit `settings: how much the songs take on this phone (phase 4a)`.

### Task 6: The walk, the docs

**Files:**
- Modify: `scripts/offline/walk.py` (check 13), `scripts/offline/README.md`
- Modify: `docs/superpowers/specs/2026-11-09-offline-phase-4-design.md` ("Decided while building" if anything was), `docs/superpowers/specs/2026-11-07-offline-design.md` (phase 4 line: 4a built), `docs/features.md` (the offline paragraph), `docs/layout.md` (`media-range.ts`, `media-store.ts`, `src/device/media.ts`), `docs/hard-rules.md` and `CLAUDE.md` (the offline rule: media endpoints are classified too, `MEDIA_ENDPOINTS`)

- [ ] **Step 1:** Walk check 13, **a song with no signal**: before the walk's first online step, write a 1-second WAV (Python's `wave`, 8 kHz mono) as `<dir of the db>/audio/<audio_file>` for the dance's first song with an `audio_file` (the served db's songs; the walk's db dir is the server's `DATA_DIR`). Online: wait (30 s cap) until `navigator.storage.getDirectory()` holds `media/audio/<file>`; then a `fetch('/audio/<file>', { headers: { Range: 'bytes=0-99' } })` from the page answers 206 with 100 bytes and `X-Salsa-From: device`. Offline: the same fetch answers the same. Settings offline shows "Songs and your count ·". `ok`/`FAIL` lines as the other checks.
- [ ] **Step 2:** Run the walk (`scripts/offline/serve.sh <db>` + `walk.py`, as the README says) → all ok, check 13 included.
- [ ] **Step 3:** The docs above; `npx prettier --check` on them.
- [ ] **Step 4:** Commit `docs: offline phase 4a, songs on the phone; the walk plays one offline`.
