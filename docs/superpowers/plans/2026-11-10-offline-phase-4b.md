# Offline phase 4b: lesson videos kept on the phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person keeps lesson videos and figure recordings on the phone (a switch per space in Settings → On this phone, or a phone button under one video), they play from the phone with no signal, download only on Wi-Fi by default, and the app warns once when space runs short.

**Architecture:** 4a's OPFS media store gets two more kinds, `lesson-videos` and `recordings` (the URL's first segment), and the service worker already answers any store kind from the phone with Range. The device worker decides what to keep: the songs (4a) plus the videos of each switched-on space and each kept video, from settings in its `device_meta` (`keep`), and fetches them one at a time, newest lesson first, resuming a cut-off video from its `.part`, gated by Wi-Fi and free space. The page sees it all through one `KeepStatus` the worker posts, and changes it with `keep-set`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, OPFS (`createWritable`, sync access handle), Network Information API (`navigator.connection.type`), `navigator.storage.estimate()`/`persist()`, better-sqlite3 in specs, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-offline-phase-4-design.md` (4b, and "4b's looks, picked by the user"), on `docs/superpowers/specs/2026-11-07-offline-design.md` ("Media on the device", "Keep on this phone"). Mockups: `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-offline/d986c4b7-9797-406b-a731-8cf9584480e4/scratchpad/4b/videi-na-telefonu.html` (sections 1B, 3·1, 4B are the picks; its `gen.py` holds the Slovenian words and icon paths).

## Global Constraints

- No migration, no APK, no `PAGE_EPOCH` raise: everything new is additive (protocol messages, a `device_meta` key, store kinds).
- Nothing leaves the phone without the person asking, except what left the copy (a group left, a lesson archived, another person): switching a space off, un-keeping a video and Clear are asks.
- With "Only on Wi-Fi" on (the default) a video never downloads while the phone says it is on mobile data; songs and count takes ignore it.
- Downloads run while the app is open, one file at a time, songs first, then videos newest lesson first.
- Words through `t()` in en and sl (vikanje, `slCount`, decimal comma via `byteSize`); no browser `confirm()`; a built control's colour is the builder's (`swap()`); safe area via `--safe-*`.
- Components never import `$lib/server`; shared shapes in `src/lib/offline/protocol.ts`.
- Settings → On this phone (row and page) and the video button show only where the store exists and the device is `ready`.
- Specs never touch `$DATA_DIR`; Vitest at most `--maxWorkers=4`; full `npm run check` only before the final review and after merging master.

## Review Focus

1. The app closed (or Wi-Fi lost) half way through a 400 MB video: the next pass resumes from the `.part` with `Range`, and a short file is never served (Task 1, Task 5).
2. A server or proxy that answers a resume's `Range` with 200 (the whole file): the write starts over from 0 instead of appending (Task 5).
3. Wi-Fi → mobile data mid-download with Only on Wi-Fi on: the file in flight stops at once and nothing more comes until Wi-Fi (Task 5, Task 6).
4. A 1 GiB video on Safari's sync-handle path (no `createWritable`): written in chunks as it arrives, never read whole into memory (Task 1).
5. Another person on the phone, or a group left: the first person's switches and kept videos go with the copy (Task 3).
6. Free space short: no download starts that would leave less than `LOW_SPACE_BYTES`, and the status says why videos wait (Task 5).

---

### Task 1: The media store holds videos, resumes and streams

**Files:**
- Modify: `src/lib/offline/media-store.ts`
- Test: `src/lib/offline/media-store.spec.ts`

**Interfaces:**
- Produces:
  - `type MediaKind = 'audio' | 'count' | 'lesson-videos' | 'recordings'`; `const VIDEO_KINDS: readonly MediaKind[] = ['lesson-videos', 'recordings']`; `const SONG_KINDS = ['audio', 'count']`.
  - `type MediaFile = { kind: MediaKind; file: string; mime: string; size?: number }` — `size` known (videos): a whole file of another size is refused.
  - `MediaStore.write(f: MediaFile, res: Response, opts?: { from?: number }): Promise<void>` — `from > 0` appends to the `.part` of that many bytes.
  - `MediaStore.partSize(kind: MediaKind, file: string): Promise<number>` — bytes of the `.part`, 0 when none.
  - `MediaStore.usage(kinds?: readonly MediaKind[]): Promise<number>`; `MediaStore.clear(kinds?: readonly MediaKind[]): Promise<void>` — no argument: every kind (4a's callers unchanged).
  - `mediaOf('/lesson-videos/x.mp4')` → `{ kind: 'lesson-videos', file: 'x.mp4' }`.

- [ ] **Step 1: Write the failing tests** (in the `describe.each(CAPS)` block unless said)

```ts
const VIDEO: MediaFile = { kind: 'lesson-videos', file: 'v.mp4', mime: 'video/mp4', size: 300 };

it('a video cut off half way keeps its part, and the next write goes on from it', async () => {
	const store = mediaStoreIn(asRoot(new FakeDir(caps)));
	await expect(store.write(VIDEO, cutOff())).rejects.toThrow();
	expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(100);
	expect(await store.read('lesson-videos', 'v.mp4')).toBeNull();
	await store.write(VIDEO, new Response(bytes.slice(100)), { from: 100 });
	const got = await store.read('lesson-videos', 'v.mp4');
	expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
	expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(0);
});

it('a song cut off half way keeps nothing (4a, unchanged)', async () => {
	const store = mediaStoreIn(asRoot(new FakeDir(caps)));
	await expect(store.write(SONG, cutOff())).rejects.toThrow();
	expect(await store.partSize('audio', SONG.file)).toBe(0);
});

it('a whole file of another size than the row says is refused and dropped', async () => {
	const store = mediaStoreIn(asRoot(new FakeDir(caps)));
	await expect(store.write({ ...VIDEO, size: 999 }, new Response(bytes))).rejects.toThrow();
	expect(await store.read('lesson-videos', 'v.mp4')).toBeNull();
	expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(0);
});

it('usage and clear by kind: clearing videos leaves the songs', async () => {
	const store = mediaStoreIn(asRoot(new FakeDir(caps)));
	await store.write(SONG, new Response(bytes));
	await store.write(VIDEO, new Response(bytes));
	expect(await store.usage(VIDEO_KINDS)).toBe(300);
	await store.clear(VIDEO_KINDS);
	expect((await store.list()).map((f) => f.kind)).toEqual(['audio']);
});
```

Outside the `each`: the sync-handle path writes each chunk as it comes. Extend `FakeFile`'s sync handle to record the `at` offsets of its writes and to keep data across `write` calls (`buf` grows to `at + d.byteLength`); assert that a body of three enqueued chunks gives three writes at offsets `0, 100, 200` and the whole bytes back. Also: `mediaOf('/lesson-videos/x.mp4')`, `mediaOf('/recordings/y.webm')` parse; `mediaOf('/lesson-videos/../x')` and `/videos/x.mp4` are null; `mediaPath('recordings', 'y.webm')` is `/recordings/y.webm`; the memory store honours `from`, `partSize` (always 0 after a failure is fine for memory: it stores nothing), `usage(kinds)` and `clear(kinds)`. Change 4a's `'/recordings/x.mp4'` null case in `a path to a file and back` to a parse.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/offline/media-store.spec.ts --maxWorkers=4`
Expected: FAIL (`partSize` is not a function, `mediaOf` null for the new kinds, type errors on `VIDEO_KINDS`).

- [ ] **Step 3: Implement in `src/lib/offline/media-store.ts`**

- `mediaOf`'s pattern becomes `/^\/([a-z-]+)\/([^/]+)$/`.
- `writeFile(dir, name, res, from = 0)`: `createWritable({ keepExistingData: from > 0 })`, `seek(from)` when `from > 0`, then `pipeTo`; the sync-handle path reads `res.body` with a reader and `h.write(chunk, { at })` per chunk (`truncate(from)` first), `flush`, `close`. `rename`'s copy fallback streams through the same `writeFile`.
- `write`: on a body error, remove the `.part` only for a kind outside `VIDEO_KINDS`; after the body, if `f.size !== undefined && size !== f.size`, remove the `.part` and throw `the file is ${size} bytes, not ${f.size}`.
- `remove` and `clear` drop `.part` files too (4a already does for `remove`; `clear(kinds)` loops only over `kinds ?? KINDS`).

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/offline/media-store.spec.ts src/lib/offline/media-range.spec.ts src/device/media.spec.ts --maxWorkers=4`
Expected: PASS, 4a's tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/media-store.ts src/lib/offline/media-store.spec.ts
git commit -m "offline: the media store holds lesson videos and recordings, resumes a cut-off video, streams on Safari"
```

### Task 2: Lesson videos and recordings are media routes

**Files:**
- Modify: `src/lib/offline/routes.ts:57-72`, `src/lib/offline/sw-route.ts` (the `media` comment), `src/service-worker.ts:212-216` (comment only)
- Test: `src/lib/offline/sw-route.spec.ts`, `src/lib/offline/routes.spec.ts`

**Interfaces:**
- Produces: `MEDIA_ENDPOINTS = ['/audio/[file]', '/count/[file]', '/lesson-videos/[file]', '/recordings/[file]']`; the two leave `NETWORK_ENDPOINTS`.

- [ ] **Step 1: Write the failing test** — in `sw-route.spec.ts`, move `/recordings/x.mp4` and `/lesson-videos/x.mp4` out of `passes other origins and media` into a new `it('lesson videos and recordings: the phone first (offline phase 4b)')` expecting `'media'` for a plain GET; the `navigate` cases at lines 158–159 stay `'pass'` (a video opened in a tab or downloaded is the browser's). `routes.spec.ts:93` stays false (`deviceAnswers` is the copy's, not the store's).
- [ ] **Step 2: Run** `npx vitest run src/lib/offline/sw-route.spec.ts src/lib/offline/routes.spec.ts --maxWorkers=4` — Expected: FAIL, `'pass'` for the new case.
- [ ] **Step 3: Move the two routes** into `MEDIA_ENDPOINTS` and say "song audio, count takes, lesson videos and recordings" in the three comments.
- [ ] **Step 4: Run** the same — Expected: PASS (the classification guard in `routes.spec.ts` still finds every GET endpoint classified once).
- [ ] **Step 5: Commit** `offline: lesson videos and recordings are answered from the phone first`.

### Task 3: What to keep — settings, spaces and the wanted videos

**Files:**
- Create: `src/device/keep.ts`, `src/device/keep.spec.ts`
- Modify: `src/lib/offline/protocol.ts` (types only)

**Interfaces:**
- Consumes: `MediaFile`, `VIDEO_KINDS` (Task 1); `readMeta`/`writeMetaValue` style access to `device_meta` (`src/device/migrate.ts`).
- Produces (types in `protocol.ts`, functions in `keep.ts`):

```ts
/** `mine` or `team:<id>`. */
export type SpaceId = string;
export type KeepSettings = { spaces: SpaceId[]; wifiOnly: boolean; videos: string[] /* `<kind>/<file>` */ };
export type KeepChange =
	| { space: SpaceId; on: boolean }
	| { wifiOnly: boolean }
	| { video: string; on: boolean }
	| { clear: true };
export type SpaceRow = { id: SpaceId; name: string | null /* null: My lessons */; on: boolean;
	videos: number; bytes: number; held: number; heldBytes: number };
export type KeptVideo = { key: string; title: string; index: number | null /* Video N on a lesson; null: a recording */;
	bytes: number; held: boolean };
export type KeepStatus = {
	settings: KeepSettings;
	spaces: SpaceRow[];
	/** Kept one by one (settings.videos), with what to call them. */
	kept: KeptVideo[];
	/** Video keys a switched-on space keeps → its id. */
	bySpace: Record<string, SpaceId>;
	/** Whole files on the phone, `<kind>/<file>`, videos only. */
	held: string[];
	inFlight: { key: string; received: number; total: number } | null;
	/** Why wanted videos are not coming now. */
	waiting: 'wifi' | 'offline' | 'space' | null;
	canTellWifi: boolean;
	bytes: { songs: number; videos: number };
	/** Free for this app (quota − usage); null where the browser won't say. */
	free: number | null;
	low: boolean;
};
```

```ts
// keep.ts
export const KEEP_META = 'keep';
export const DEFAULT_KEEP: KeepSettings = { spaces: [], wifiOnly: true, videos: [] };
export function readKeep(db: SqliteDb): KeepSettings;
export function writeKeep(db: SqliteDb, s: KeepSettings): void;
export function applyKeepChange(s: KeepSettings, c: KeepChange): KeepSettings; // pure
export function wantedVideos(db: SqliteDb, userId: string, s: KeepSettings): MediaFile[];
export function spaceRows(db: SqliteDb, userId: string, s: KeepSettings, held: ReadonlySet<string>): SpaceRow[];
export function keptVideos(db: SqliteDb, s: KeepSettings, held: ReadonlySet<string>): KeptVideo[];
export function keptBySpace(db: SqliteDb, userId: string, s: KeepSettings): Record<string, SpaceId>;
```

Rules the code follows:
- A space's videos: `lesson_videos` of non-archived `lessons` with `user_id = userId` (`mine`) or `team_id = <id>` (a team the person is in, per `team_members`, `teams.deleted_at IS NULL`). Spaces listed: `mine` first, then the person's teams by name.
- `wantedVideos`: every switched-on space's videos, then each kept key whose row is still in the copy (`lesson_videos.file` or `recordings.file` with `kind = 'video'`), no duplicates, ordered `lessons.lesson_day DESC, lesson_videos.id DESC`, kept recordings after by `recordings.created_at DESC`; each with `mime` and `size` (`size_bytes`). A kept key whose row is gone is not wanted (it goes from the phone), and is dropped from `settings.videos` the next time settings are written.
- `applyKeepChange`: `{ clear: true }` → `spaces: []`, `videos: []`, `wifiOnly` kept. Switching on a space already on, or a video already kept, changes nothing.
- `readKeep` on a missing or unreadable value → `DEFAULT_KEEP`. `wipeCopy` already deletes every `device_meta` key but `deviceKey` and `slot`, so another person and Forget start from the default: keep it that way (pin it with a test).

- [ ] **Step 1: Write the failing tests** in `src/device/keep.spec.ts` (better-sqlite3, `migrateDevice(db, repoMigrations())`, `foreign_keys = OFF` as `media.spec.ts` does):
  - `readKeep` with nothing stored → `DEFAULT_KEEP`; `writeKeep` then `readKeep` round-trips; garbage JSON → default.
  - `wipeCopy(db)` after `writeKeep` → `readKeep` is the default again.
  - `applyKeepChange`: on/off a space, on/off a video, `wifiOnly`, `clear` keeps `wifiOnly: false`.
  - `wantedVideos`: own lesson L1 (day 2026-11-01, video a 100 B), own archived lesson's video (not wanted), team 7 lesson (day 2026-11-05, video b), team 9 the person is not in (video c), a kept recording r of kind video, a kept recording of kind audio (not wanted), a kept key whose row is gone (not wanted). With `spaces: ['mine', 'team:7']` and `videos: ['recordings/r.webm', 'recordings/gone.webm']` → `[b, a, r]` in that order, each with `size`.
  - `spaceRows` with `held = {'lesson-videos/a.mp4'}` → `mine` `{ videos: 1, bytes: 100, held: 1, heldBytes: 100, on: true, name: null }`, `team:7` with the team's name, no `team:9`.
  - `keptVideos` names a lesson video by its lesson title and 1-based place among the lesson's videos (by id), a recording by its figure's name (`figures.name`; `figureLabels` is server code the worker's raw SQL can't call) with `index: null`.
- [ ] **Step 2: Run** `npx vitest run src/device/keep.spec.ts --maxWorkers=4` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `keep.ts` and the protocol types.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `offline: what the phone keeps — a switch per space, single videos, Only on Wi-Fi`.

### Task 4: Wi-Fi and free space

**Files:**
- Create: `src/lib/offline/network.ts`, `src/lib/offline/network.spec.ts`

**Interfaces:**
- Produces:

```ts
export type Link = 'unmetered' | 'metered' | 'unknown';
/** From `navigator.connection.type`: wifi/ethernet unmetered; cellular, bluetooth, wimax metered; anything else or no API unknown. */
export function linkOf(nav: { connection?: { type?: string } }): Link;
export function canTellWifi(nav: { connection?: { type?: string } }): boolean; // `type` is a string
/** Videos may come now. Unknown counts as allowed: the page says so where it can't tell. */
export function videosMayCome(link: Link, wifiOnly: boolean): boolean;
export const LOW_SPACE_BYTES = 500 * 1024 * 1024;
/** Free for this app, from `navigator.storage.estimate()`; null when it says nothing. */
export function freeOf(e: { quota?: number; usage?: number } | null): number | null;
export function isLow(free: number | null): boolean; // free !== null && free < LOW_SPACE_BYTES
/** Whether `bytes` more still leave LOW_SPACE_BYTES free; true when free is unknown. */
export function fits(free: number | null, bytes: number): boolean;
```

- [ ] **Step 1: Write the failing tests**: `linkOf` for `wifi`, `ethernet`, `cellular`, `bluetooth`, `none`, `undefined` type, no `connection`; `canTellWifi` false on a desktop-like `{ connection: { effectiveType: '4g' } }`; `videosMayCome('metered', true)` false, `('metered', false)` true, `('unknown', true)` true; `freeOf({ quota: 10, usage: 4 })` 6, `freeOf({})` null, `freeOf(null)` null; `isLow(LOW_SPACE_BYTES - 1)` true, `isLow(null)` false; `fits(LOW_SPACE_BYTES + 10, 10)` true, `fits(LOW_SPACE_BYTES + 10, 11)` false.
- [ ] **Step 2: Run** `npx vitest run src/lib/offline/network.spec.ts --maxWorkers=4` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `network.ts` (pure, client-safe; the worker and the page pass their own `navigator`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `offline: tell Wi-Fi from mobile data, and when space is short`.

### Task 5: The keeper fetches videos — gated, resumed, with progress

**Files:**
- Modify: `src/device/media.ts`
- Test: `src/device/media.spec.ts`

**Interfaces:**
- Consumes: Task 1's store (`partSize`, `write(…, { from })`, `size`), Task 4's `fits`.
- Produces:

```ts
export async function syncMedia(deps: {
	wanted: MediaFile[];
	store: MediaStore;
	fetchMedia: (path: string, signal?: AbortSignal, range?: number) => Promise<Response>;
	online: () => boolean;
	/** Videos may come now (Wi-Fi rule); songs always may. */
	videosMayCome?: () => boolean;
	/** Free bytes now (estimate), or null. */
	free?: () => Promise<number | null>;
	onProgress?: (key: string, received: number, total: number) => void;
	log: Pick<Console, 'warn'>;
	signal?: AbortSignal;
}): Promise<{ fetched: number; removed: number; failed: number; waiting: 'wifi' | 'space' | 'offline' | null }>;

export function mediaKeeper(deps: /* as 4a, plus */ {
	videosMayCome: () => boolean;
	free: () => Promise<number | null>;
	onProgress: (key: string, received: number, total: number) => void;
	/** After every pass: what it fetched, removed, and what videos wait for. */
	onPass: (out: Awaited<ReturnType<typeof syncMedia>>) => void;
}): { sync(): Promise<void>; clear(kinds?: readonly MediaKind[]): Promise<void>; restart(): Promise<void> };
```

Rules:
- Songs (`SONG_KINDS`) first, then videos in `wanted`'s order (Task 3 already orders them).
- Before a video: `videosMayCome()` false → stop fetching videos, `waiting: 'wifi'`; `!fits(await free(), size - from)` → stop fetching videos, `waiting: 'space'`; offline → `waiting: 'offline'` when videos are still missing. Songs ignore Wi-Fi but not space.
- Resume: `from = await store.partSize(kind, file)`; `from > 0` → `fetchMedia(path, signal, from)` sends `Range: bytes=<from>-`. A 206 whose `Content-Range` starts at `from` → `write(f, res, { from })`; a 200 → `write(f, res)` (from 0); anything else → failed.
- Progress: the body is counted through a `TransformStream` before `write`; `onProgress(key, from + counted, size ?? total from headers)` at most every 500 ms and once at the end.
- `restart()`: aborts the file in flight (its `.part` stays, Task 1) and runs a pass again; used after a settings change and a connection change. `clear(kinds)` as 4a, by kind.
- Removal is unchanged: what the store holds and `wanted` lacks goes (a space switched off, a video un-kept, a group left).

- [ ] **Step 1: Write the failing tests** in `media.spec.ts` with `memoryMediaStore()` (extend the helper `run` to take the new deps):
  - `songs come first, then videos in the order given` — `wanted = [V_NEW, A, V_OLD]` (videos already newest first, a song between) → fetched `['/audio/a.m4a', '/lesson-videos/new.mp4', '/lesson-videos/old.mp4']`.
  - `on mobile data with Only on Wi-Fi, songs come and videos wait` — `videosMayCome: () => false` → only the song fetched, `waiting: 'wifi'`, nothing removed.
  - `a video that would leave too little space waits` — `free: async () => LOW_SPACE_BYTES + 50`, a 100-byte video → not fetched, `waiting: 'space'`; a 10-byte one is fetched.
  - `a cut-off video resumes from its part` — with the OPFS fake from `media-store.spec.ts` moved into `src/lib/offline/test-opfs.ts` (exported `FakeDir`, `asRoot`) so both specs share it: first fetch cuts off after 100 of 300 bytes; second pass's `fetchMedia` is called with `range = 100` and answers 206 `Content-Range: bytes 100-299/300` with the rest; the store reads 300 whole bytes.
  - `a 200 to a resume starts over` — the second pass answers 200 with all 300 bytes; the file reads back exactly `bytes` (not 400).
  - `progress is told, ending at the whole size` — the last `onProgress` call is `(key, 300, 300)`.
  - `mediaKeeper.restart stops the file in flight and runs again` — with `slowFetch`: start, `restart()`, the first fetch's signal is aborted, a second fetch of the same path starts.
- [ ] **Step 2: Run** `npx vitest run src/device/media.spec.ts src/lib/offline/media-store.spec.ts --maxWorkers=4` — Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** in `media.ts`.
- [ ] **Step 4: Run** the same — Expected: PASS, 4a's keeper tests unchanged.
- [ ] **Step 5: Commit** `offline: kept videos come one at a time, on Wi-Fi, resumed, while there is space`.

### Task 6: The device worker keeps videos and tells the page

**Files:**
- Modify: `src/device/core.ts` (`wantedMedia` → songs + `wantedVideos`; `keepStatus` and `keepSet` on `Device`), `src/device/worker.ts`, `src/lib/offline/protocol.ts` (`DeviceIn`/`DeviceOut`)
- Test: `src/device/core.spec.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  - `DeviceIn` gains `{ type: 'keep-get' }` and `{ type: 'keep-set'; change: KeepChange }`, both on a reply port answering `KeepStatus | null`.
  - `DeviceOut` gains `{ type: 'keep'; status: KeepStatus }`, posted after every pass, every settings change, and on progress at most once a second.
  - `Device.keepSettings(): KeepSettings`, `Device.keepSet(change: KeepChange): KeepSettings` (writes `device_meta`), `Device.keepRows(held: ReadonlySet<string>): Pick<KeepStatus, 'spaces' | 'kept' | 'bySpace'>`.

The worker assembles `KeepStatus` (`held` from `store.list()` filtered to `VIDEO_KINDS`, `bytes` from `usage(SONG_KINDS)`/`usage(VIDEO_KINDS)`, `free` from `navigator.storage.estimate()` via `freeOf`, `low` via `isLow`, `canTellWifi(navigator)`, the keeper's last `waiting` and in-flight progress). `keep-set` writes the settings, then `{ clear: true }` also runs `keeper.clear(VIDEO_KINDS)`; every change calls `keeper.restart()` and posts the status. `navigator.connection?.addEventListener('change', …)` and `online` call `restart()`. The keeper's `videosMayCome` reads `videosMayCome(linkOf(navigator), device.keepSettings().wifiOnly)`.

- [ ] **Step 1: Write the failing tests** in `core.spec.ts` (its existing harness): `wantedMedia()` returns the songs and a switched-on space's videos after `keepSet({ space: 'mine', on: true })`; `keepSet` persists across `readKeep`; a person change (the existing "another person" setup) leaves `keepSettings()` at `DEFAULT_KEEP`.
- [ ] **Step 2: Run** `npx vitest run src/device/core.spec.ts --maxWorkers=4` — Expected: FAIL, `keepSet` not a function.
- [ ] **Step 3: Implement** core, protocol and worker wiring (the worker has no spec of its own; keep logic out of it).
- [ ] **Step 4: Run** `npx vitest related src/device/core.ts src/device/worker.ts src/lib/offline/protocol.ts --run --maxWorkers=4` and `npx eslint src/device src/lib/offline` — Expected: PASS. (The worker's types are checked by the full check at the end.)
- [ ] **Step 5: Commit** `offline: the device worker keeps the switched-on spaces' videos and posts how it goes`.

### Task 7: The page's view of it

**Files:**
- Create: `src/lib/offline/kept.svelte.ts`, `src/lib/offline/kept-view.ts`, `src/lib/offline/kept-view.spec.ts`
- Modify: `src/lib/offline/device.svelte.ts` (handle `keep`, export `keepGet`/`keepSet` through `ask`)

**Interfaces:**
- Produces:

```ts
// kept.svelte.ts
export const kept = $state<{ status: KeepStatus | null }>({ status: null });
export async function changeKeep(change: KeepChange): Promise<void>; // asks the worker; on turning anything on, `navigator.storage.persist()` once (window only)
// kept-view.ts (pure)
export type VideoKeep =
	| { state: 'off' }
	| { state: 'coming'; percent: number }
	| { state: 'waiting'; why: 'wifi' | 'offline' | 'space' }
	| { state: 'on' }
	| { state: 'space'; space: SpaceId; name: string | null }; // kept by a switched-on space
export function videoKeep(status: KeepStatus | null, src: string): VideoKeep | null; // null: not a video path, or no store
export function lessonOnPhone(status: KeepStatus | null, files: string[]): boolean; // every file held, at least one
export function spaceLine(row: SpaceRow, status: KeepStatus): { text: string; tone: 'muted' | 'done' | 'warn'; bar: number | null };
export function suggestions(status: KeepStatus): ({ kind: 'space'; id: SpaceId; name: string | null; videos: number; bytes: number } | { kind: 'video'; key: string; title: string; bytes: number })[]; // on spaces with heldBytes > 0 and held kept videos, largest first
```

`videoKeep`: a held key kept by a space → `space`; held → `on`; in flight → `coming` (`Math.floor(received / total * 100)`); wanted (kept or a space's) but not held → `waiting` with `status.waiting ?? 'offline'`; else `off`. A space's video that is held shows `space`, not `on`, so the button opens the page.

- [ ] **Step 1: Write the failing tests** in `kept-view.spec.ts` for every `videoKeep` branch (paths `/lesson-videos/a.mp4`, `/audio/x.m4a` → null, `null` status → null), `lessonOnPhone` (`[]` → false; one of two held → false), `spaceLine` for off, on and all held, coming (`bar` 0.42 from `held/videos` bytes), waiting for Wi-Fi (words checked through `t()` in en), and `suggestions` order by bytes with an off space left out.
- [ ] **Step 2: Run** `npx vitest run src/lib/offline/kept-view.spec.ts --maxWorkers=4` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement**, with the words (Task 8 lists them) added to `src/lib/i18n/en/settings.ts` and `sl/settings.ts` under `onPhone`.
- [ ] **Step 4: Run** the same plus `npx vitest run src/lib/i18n --maxWorkers=4` — Expected: PASS (catalog parity).
- [ ] **Step 5: Commit** `offline: the page sees what is kept on the phone`.

### Task 8: Settings → On this phone, its own page

**Files:**
- Create: `src/routes/settings/phone/+page.svelte`, `src/lib/components/settings/LowSpaceCard.svelte` (warning + suggestions, shared with Task 10)
- Modify: `src/routes/settings/+page.svelte:79-84,314-321`, `src/lib/i18n/en/settings.ts`, `src/lib/i18n/sl/settings.ts`, `src/lib/icons/icons.ts` (`phone-check`, `phone-down`, `wifi-off`, paths from the mockup's `gen.py` lines 19, 20, 23)
- Test: `src/routes/settings/settings-forms.spec.ts` is server-side; this page has no load. Guard specs (`no-english.spec.ts`, `class-rules.spec.ts`) cover it.

The look (mockup 1B, `settings_B_main`/`settings_B_page`):
- Settings: the songs line becomes one `GROUP` row link to `/settings/phone`: `tile` with `phone`, title **On this phone / Na tem telefonu**, sub **Songs {a} · videos {b} · free {c} / Pesmi {a} · videi {b} · prosto {c}** (free left out when null), chevron; a `warning` icon before the sub while `low`. Shown while `kept.status` is non-null; hidden otherwise, as 4a's line is without a store.
- The page (`Screen` with back to `/settings`, title as above, sub **Songs {a} · videos {b}**):
  1. While `low`: `LowSpaceCard` (warning **Little space left on this phone / Na telefonu je malo prostora**, **{x} free. Videos on the server can always come back. / Prosto je še {x}. Videi na strežniku se lahko vedno spet prenesejo.**, label **Suggestions, largest first / Predlogi, največji najprej**, rows from `suggestions()`: a space → its name, **Kept · {n} videos · {size} / Prostor vklopljen · {n} videov · {size}**, button **Turn off / Izklopi** (`changeKeep({ space, on: false })`); a video → its title, **Video {i} · {size}** or **Recording · {size} / Posnetek · {size}**, button **Remove / Odstrani** (`changeKeep({ video, on: false })`)).
  2. A card: **{used} used · {free} free / Zasedeno {used} · prosto {free}**, a stacked bar (songs `bg-accent/40`, videos `bg-accent`, free `bg-track`), legend **Songs and count · {a} / Pesmi in štetje · {a}**, **Kept videos · {b} / Shranjeni videi · {b}**.
  3. Label **Lesson videos on this phone / Videi lekcij na telefonu**; a `GROUP` of `Switch` rows per `SpaceRow` (group rows lead with the group mark the lists use), sub from `spaceLine`, a thin bar under it while coming.
  4. `canTellWifi` → a `GROUP` row `Switch` **Only on Wi-Fi / Samo prek Wi-Fi**, sub **Videos don't download on mobile data. Songs always do. / Videi se na mobilnih podatkih ne prenašajo. Pesmi se vedno.**; else a note with `wifi-off`: **This phone doesn't tell the app whether it is on Wi-Fi or mobile data, so videos may download on mobile data: switch on only what you need. / Ta telefon aplikaciji ne pove, ali je na Wi-Fi ali na mobilnih podatkih. Videi se zato lahko prenašajo tudi prek mobilnih podatkov: vklopite le, kar res potrebujete.**
  5. Note: **A space that is on keeps all its lessons' videos on this phone, old ones too, and each new one. Keep a single video with the button under it. / Vklopljen prostor obdrži na telefonu vse videe svojih lekcij, tudi stare, in vsakega novega. Posamezen video obdržite z gumbom pod njim.**
  6. A `GROUP` row in danger tone **Clear kept videos / Počisti shranjene videe**, sub **They stay on the server; you can download them again. / Na strežniku ostanejo, lahko jih spet prenesete.** One tap (`changeKeep({ clear: true })`), then a `Toast` **Kept videos cleared / Shranjeni videi so počiščeni**; disabled look while nothing is kept.
- Sizes through `byteSize`; counts through `t()` plural helpers (`slCount` in sl).

- [ ] **Step 1: Build the page and the Settings row** as above. (The logic is Task 7's, tested there; the words are checked for en/sl parity by the catalog spec and for bare English by `no-english.spec.ts`.)
- [ ] **Step 2: Add a `/settings/phone` case** to the offline route guard if `routes.spec.ts` lists the flat settings pages (it is a device page: no load, nothing in `NETWORK_PAGES`).
- [ ] **Step 3: Run** `npx vitest run src/lib/i18n src/lib/components src/routes/settings --maxWorkers=4` and `npx eslint src/routes/settings src/lib/components/settings src/lib/icons` — Expected: PASS.
- [ ] **Step 4: Screenshot** `/settings` and `/settings/phone` at 390×844 in `sl`, light and dark, from a production build served by `scripts/offline/serve.sh <seeded db>` (the device worker runs there; the shots rig's dev server has none), with a Playwright script in the scratchpad that waits for `[data-phone-page]`; compare with mockup 1B.
- [ ] **Step 5: Commit** `offline: Settings → On this phone, its own page with a switch per space`.

### Task 9: The phone button under a video

**Files:**
- Create: `src/lib/components/ui/KeepButton.svelte`
- Modify: `src/lib/components/ui/VideoFrame.svelte` (button left of Full screen in the caption row, or before it in the control row; caption meta gets the state's words), `src/lib/components/figures/RecordingRow.svelte` (button before the trailing chevron, meta gets the words), `src/lib/server/lessons.ts:586-612` (`videoFiles: string[]` via `group_concat(lesson_videos.file)`), `src/lib/types.ts` (`LessonItem.videoFiles`), `src/lib/lessons/list.ts` + `src/lib/components/lessons/LessonRow.svelte` (**on this phone / na telefonu** after the video meta when `lessonOnPhone`)
- Test: `src/lib/server/lessons.spec.ts`, `src/lib/lessons/list.spec.ts`

`KeepButton` takes `src` and renders nothing when `videoKeep(kept.status, src)` is null. States (mockup 3·1, `mark_1`): `off` → `phone-down`, label **Keep on this phone / Obdrži na telefonu**, tap `changeKeep({ video: key, on: true })`; `coming` → a ring at `percent` (conic, the mockup's `.ring.big`), label **Downloading, {p} %. Stop / Prenašam, {p} %. Ustavi**, tap un-keeps; `waiting` → `phone-down` muted, tap un-keeps; `on` → `phone-check` in done tone, label **On this phone. Remove from the phone / Na telefonu. Odstrani s telefona**, tap un-keeps; `space` → `phone-check` done, an `<a href="/settings/phone">` labelled **On this phone, kept by {space}. Settings / Na telefonu, obdrži ga {prostor}. Nastavitve** ({space}: the group's name or **My lessons / Moje lekcije**). 44 px target, `iconButton('bare', …)` tones only (no appended `text-*`).

Caption words after the size: **on this phone / na telefonu** (done tone), **downloading {p} % / prenašam {p} %**, **waiting for Wi-Fi / čaka na Wi-Fi**, **waiting for a connection / čaka na povezavo**, **no space / ni prostora**.

- [ ] **Step 1: Write the failing tests**: `listLessons` rows carry `videoFiles` (`['a.mp4', 'b.mp4']` for the two-video lesson in the existing case at `lessons.spec.ts:385`, `[]` for none); `videoMeta`'s sibling `onPhoneMark(lesson, status)` in `list.ts` returns the words only when `lessonOnPhone`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/lessons.spec.ts src/lib/lessons/list.spec.ts --maxWorkers=4` — Expected: FAIL.
- [ ] **Step 3: Implement** the query field, `onPhoneMark`, `KeepButton`, and the three places.
- [ ] **Step 4: Run** the same plus `npx vitest related src/lib/components/ui/VideoFrame.svelte src/lib/components/figures/RecordingRow.svelte --run --maxWorkers=4` and the guard specs — Expected: PASS.
- [ ] **Step 5: Commit** `offline: a phone button under every video keeps it on the phone`.

### Task 10: Low space — a sheet once, then a dot on You

**Files:**
- Create: `src/lib/components/shell/LowSpaceSheet.svelte`, `src/lib/offline/low-space.ts`, `src/lib/offline/low-space.spec.ts`
- Modify: `src/routes/[dance]/+layout.svelte` (mount the sheet), `src/lib/nav/tabs.ts` (`tabDot('you', …)` also true on `data.lowSpace`; `tabDotLabel('you')` says why), `src/lib/components/shell/BottomNav.svelte` + `Side.svelte` (pass `{ ...page.data, lowSpace: kept.status?.low ?? false }`)
- Test: `src/lib/nav/tabs.spec.ts`

**Interfaces:**
- Produces: `shouldOpenLowSheet(low: boolean, shown: boolean): boolean` and `LOW_SHOWN_KEY = 'salsa:low-space-shown'` in `low-space.ts`; the flag in `localStorage` (try/catch), set when the sheet opens, removed when `low` turns false (so the next shortage opens it once more).

The sheet (mockup 4B, `low_sheet`): `Sheet` with a `warning` title **This phone is running out of space / Telefonu zmanjkuje prostora**, **{x} free. These videos are on the server too: remove them from the phone and they can come back any time. / Prosto je še {x}. Ti videi so tudi na strežniku: če jih odstranite s telefona, jih lahko kadarkoli spet prenesete.**, the same suggestion rows as `LowSpaceCard` (reuse it in a `compact` mode), and **Later / Kasneje** closing it. You tab dot label: **{label}, little space on this phone / {label}, na telefonu je malo prostora**.

- [ ] **Step 1: Write the failing tests**: `tabDot('you', { lowSpace: true })` true, `tabDot('today', { lowSpace: true })` false, `tabDotLabel('you', 'You')` with `lowSpace` mentions space (give `tabDotLabel` the data as a third argument, default `{}`); `shouldOpenLowSheet(true, false)` true, `(true, true)` false, `(false, false)` false.
- [ ] **Step 2: Run** `npx vitest run src/lib/nav/tabs.spec.ts src/lib/offline/low-space.spec.ts --maxWorkers=4` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** the same plus the guard specs — Expected: PASS.
- [ ] **Step 5: Commit** `offline: short of space, a sheet once and a dot on You`.

### Task 11: The storage page fits a phone

Found while shooting the mockups: `/settings/storage` draws 731 px wide on a 390 px phone (live on prod).

**Files:**
- Modify: `src/routes/settings/storage/+page.svelte` (whatever row or bar sets the width: a long unbroken file name or a `min-w`/flex child without `min-w-0`)

- [ ] **Step 1: Reproduce** with the rig: `scripts/shots/shots.sh <seeded db> <out> 390x844 --pages <file with /settings/storage> --locale sl`; the PNG is 731 px wide. Find the element: in the dev server, `document.querySelectorAll('*')` whose `scrollWidth > 390`.
- [ ] **Step 2: Fix** the overflowing element (`min-w-0`, `truncate` or `break-words` as it calls for).
- [ ] **Step 3: Re-shoot** — Expected: 390 px wide.
- [ ] **Step 4: Commit** `settings: the storage page fits a phone`.

### Task 12: Docs, the walk, the phone

**Files:**
- Modify: `docs/features.md`, `docs/layout.md` (`keep.ts`, `network.ts`, `kept*.ts`, `low-space.ts`, `KeepButton`, `LowSpaceSheet`, `/settings/phone`), `docs/superpowers/specs/2026-11-09-offline-phase-4-design.md` ("Decided while building 4b": the rulings), `scripts/offline/walk.py` (a kept lesson video answers with `X-Salsa-From: device` offline, as the songs do)

- [ ] **Step 1:** Update the docs and the walk.
- [ ] **Step 2:** Run the walk: `scripts/offline/serve.sh <db>` + `walk.py` — Expected: every page as before, and the kept video from the device.
- [ ] **Step 3:** Commit `offline: phase 4b in the docs and the walk`.
- [ ] **Step 4:** Full `npm run check` (redirected to a file), then the final whole-branch review, then ask the user before merging and deploying; on the phone: switch a group on, watch it come on Wi-Fi, turn Wi-Fi off mid-video, play it in flight mode.
