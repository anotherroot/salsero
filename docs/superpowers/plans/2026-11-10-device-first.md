# Device first Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo the slot builds natively (CLAUDE.md, "Building in a slot").

**Goal:** Online, pages read the phone's copy first, the pull keeps it fresh and re-reads the open page when it brings changes, and phone pages get pull down to refresh.

**Architecture:** The service worker's `device-read` turns around: the device first when the page's device is ready and the page has no unpulled server save, the network as the fallback. What the device cannot know (the Music dot, the AI count, the update gate, Music's To pick) travels with the pull as `extras`; Settings, whose own load reads server-only tables, stays network first. A pull reports how much it changed, and the page re-reads once nothing is open over it. Step 2 starts the device at once and draws the first page of an open from the cached shell.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), service worker, SQLite WASM device worker (`src/device/`), Drizzle on better-sqlite3, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-device-first-design.md` (with `2026-11-07-offline-design.md` and `2026-11-09-offline-phase-3-design.md` behind it). The look: https://claude.ai/artifact/LY6oPhWtmXBegScvKuRppf, option C.

## Global Constraints

- Group rows online still save on the server first; nothing in `write()` of `src/service-worker.ts` changes.
- Network pages (`NETWORK_PAGES`), network-only writes, uploads and media routes are unchanged.
- Pull cadence stays: `PULL_EVERY_MS` (5 min), on focus, on `online`, 1 s after a server save.
- Words through `t()` in `en` and `sl` (vikanje; `sl/index.ts` glossary); no bare English (`no-english.spec.ts`).
- Server code reads time through `serverNow()`; no `Date.now()` in `src/lib/day` or `src/lib/schedule`.
- No migration, no `PAGE_EPOCH` raise (requests and answers keep their shape; `extras` is optional on the wire).
- A spec never touches `$DATA_DIR`; vitest `--maxWorkers=4`; per task only the touched specs + eslint/prettier on changed files; full `npm run check` before the final review and after merging master.
- Pull to refresh: phone only (touch), Screen pages only, not inside a sheet, the player, the Positions map or the video player.
- Pull to refresh words: en "Pull to sync" / "Let go to sync" / "Syncing…" / "Up to date" / "Offline".

## Review Focus

- **A server-first group save, then the page's own re-read:** the page must show the save (network read while dirty), not the copy from before it. Pinned in Task 4.
- **The device answers 5xx or falls back (its own failure) on a ready page:** the network answers, the person sees no error. Pinned in Task 4.
- **A pull lands while a `use:guarded` form is half-filled or a sheet is open:** no re-read until it closes, then exactly one. Pinned in Task 2.
- **An old copy without `extras` (before its first pull on the new build):** layouts draw as today offline (no dot, no AI count), never throw. Pinned in Task 3.
- **Pull to refresh on a page that scrolled, or that starts on a horizontal swipe (Today's swipe rows):** no pull; the swipe and the scroll keep working. Pinned in Task 7.

---

## File map

| File | What changes |
| --- | --- |
| `src/device/apply.ts` | `applyPull` returns how many changes it applied; stores `extras` |
| `src/device/core.ts` | `pulled` carries `changed`; runtime carries `extras` |
| `src/lib/offline/protocol.ts` | `DeviceOut.pulled.changed`; `SwIn` `copy` message (step 2) |
| `src/lib/offline/device.svelte.ts` | re-read on changes via `refreshWhenIdle`; `pullNow()`; start at once (step 2); tell the SW of the copy (step 2) |
| `src/lib/sheets/idle-refresh.svelte.ts` (new) | `refreshWhenIdle()`: one re-read once nothing is open or unsaved |
| `src/lib/sync/wire.ts` | `ServerExtras`; `PullResponse.extras?` |
| `src/lib/server/sync/extras.ts` (new) | `serverExtras(db, userId)` |
| `src/routes/api/sync/pull/+server.ts` | adds `extras` |
| `src/lib/server/device-runtime.ts` | `DeviceRuntime.extras` |
| `src/routes/+layout.server.ts`, `src/routes/[dance]/+layout.server.ts`, `src/routes/[dance]/songs/+layout.server.ts` | read `extras` on the device |
| `src/lib/offline/routes.ts` | `NETWORK_FIRST_PAGES`; `/[dance]/songs/imports/[id]` to `NETWORK_PAGES` |
| `src/lib/offline/server-only.spec.ts` (new) | guard: device-drawn loads read no server-only table |
| `src/lib/offline/sw-route.ts`, `src/service-worker.ts` | device-first `deviceRead`; shell on navigate (step 2) |
| `src/routes/[dance]/songs/[id]/+page.svelte`, `src/lib/components/songs/MusicList.svelte` | poll by pulling |
| `src/lib/motion/pull-refresh.ts` (new), `src/lib/components/ui/PullRefresh.svelte` (new), `src/lib/components/ui/Screen.svelte` | pull to refresh |
| `src/lib/i18n/en/sync.ts`, `src/lib/i18n/sl/sync.ts` | the five words |
| docs | `features.md`, `layout.md`, `hard-rules.md`, both offline specs, this spec's "Decided while building" |

---

## Step 1: taps read the device

### Task 1: A pull says how much it changed

**Files:**
- Modify: `src/device/apply.ts` (`applyPull`), `src/device/core.ts` (`pullOnce`), `src/lib/offline/protocol.ts` (`DeviceOut`)
- Test: `src/device/apply.spec.ts`, `src/device/core.spec.ts`

**Interfaces:**
- Produces: `applyPull(db: SqliteDb, res: PullResponse): number` — rows written or removed: `sum(changed[t].rows.length)` over synced tables, plus 1 if the stored `cookies` JSON differs from `res.cookies`, plus 1 if the stored `extras` JSON differs (Task 3 adds extras; until then cookies only). Full tables with no row differences still count their rows (a digest mismatch means something changed).
- Produces: `DeviceOut` `{ type: 'pulled'; cursor: number; startedAt: number; landed: number; changed: number }`.

- [ ] **Step 1: Write the failing tests**

In `apply.spec.ts`:
```ts
it('counts the rows a pull wrote', () => {
	expect(applyPull(db, pullWith({ songs: 2, figures: 1 }))).toBe(3);
});
it('counts nothing for an empty pull', () => {
	applyPull(db, pullWith({ songs: 1 }));
	expect(applyPull(db, pullWith({}))).toBe(0);
});
it('counts a changed cookie jar once', () => {
	applyPull(db, { ...pullWith({}), cookies: { theme: 'dark' } });
	expect(applyPull(db, { ...pullWith({}), cookies: { theme: 'light' } })).toBe(1);
});
```
(`pullWith` builds a `PullResponse` for the spec's existing user with N rows per table; reuse the spec's own row builders.)

In `core.spec.ts`: `it("posts the pull's change count")` — after a pull that brings one song, `h.posted.at(-1)` matches `{ type: 'pulled', changed: 1 }`; after an empty pull, `changed: 0`.

- [ ] **Step 2: Run them, expect FAIL** — `npx vitest run src/device/apply.spec.ts src/device/core.spec.ts --maxWorkers=4`

- [ ] **Step 3: Implement** the return value in `applyPull` (count inside the transaction, compare the old meta JSON before writing), and `changed` in `pullOnce`'s `deps.post`.

- [ ] **Step 4: Run them, expect PASS.**

- [ ] **Step 5: Commit** — `feat(device): a pull says how much it changed`

### Task 2: The open page re-reads when a pull brings changes, once nothing is open over it

**Files:**
- Create: `src/lib/sheets/idle-refresh.svelte.ts`, `src/lib/sheets/idle-refresh.spec.ts`
- Modify: `src/lib/offline/device.svelte.ts` (`pulled`)

**Interfaces:**
- Consumes: `DeviceOut.pulled.changed` (Task 1); `sheetStack.openCount` (`$lib/sheets/history.svelte`); `unsaved(null)`, `sendingNow()` (`$lib/unsaved/guard.svelte`); `refreshWhenSettled()`.
- Produces: `busy(now: { openSheets: number; unsaved: number; sending: number; path: string }): boolean` (pure; true when any count > 0 or `path` matches `/[dance]/player`), and `refreshWhenIdle(): void` — coalesces calls into one pending re-read; checks `busy` every 500 ms; when idle, `refreshWhenSettled()`; dropped when `location.href` changed since the first call (the new page read fresh).

- [ ] **Step 1: Write the failing tests** (fake timers, `refreshWhenSettled` and the readers mocked):
```ts
it('re-reads at once when nothing is open', ...);           // 1 call to refreshWhenSettled
it('waits while a sheet is open, then re-reads once', ...); // openSheets 1 → 0 after 1 s: exactly 1 call
it('waits while a guarded form is unsaved', ...);
it('three pulls while busy make one re-read', ...);
it('drops the re-read when the page changed meanwhile', ...);
it('counts the player page as busy', () => expect(busy({ openSheets: 0, unsaved: 0, sending: 0, path: '/salsa/player' })).toBe(true));
```
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/sheets/idle-refresh.spec.ts --maxWorkers=4`
- [ ] **Step 3: Implement**, and in `device.svelte.ts` `pulled(startedAt, landed, changed)`: `if (landed > 0 || changed > 0) refreshWhenIdle();` (replaces the `refreshWhenSettled` call there).
- [ ] **Step 4: Run, expect PASS**; also `npx vitest related src/lib/offline/device.svelte.ts --maxWorkers=4`.
- [ ] **Step 5: Commit** — `feat(offline): a pull with changes re-reads the page once nothing is open over it`

### Task 3: What only the server knows travels with the pull

**Files:**
- Create: `src/lib/server/sync/extras.ts`, `src/lib/server/sync/extras.spec.ts`
- Modify: `src/lib/sync/wire.ts`, `src/routes/api/sync/pull/+server.ts`, `src/device/apply.ts`, `src/device/core.ts` (`serve`: runtime gets `extras`), `src/device/migrate.ts` (`readMeta` reads `extras`), `src/lib/server/device-runtime.ts`, `src/routes/+layout.server.ts`, `src/routes/[dance]/+layout.server.ts`, `src/routes/[dance]/songs/+layout.server.ts`
- Test: `src/routes/api/sync/pull/pull.spec.ts` (or the existing `src/lib/server/sync/pull.spec.ts` `call` helper), `src/device/apply.spec.ts`, a layout spec beside each layout (mock `$lib/server/db` as `dance-wall.spec.ts` does)

**Interfaces:**
- Produces (`src/lib/sync/wire.ts`, client-safe):
```ts
export type ServerExtras = {
	musicToPick: boolean;
	aiPending: number;
	aiConnected: boolean;
	/** The dance's current APK release (`currentRelease`), null when none. */
	release: Release | null;
	/** Music's To pick: own view (`listImports(own)` + `groupImportsToPick`), and each group's (`listImports(team)`) by team id. */
	imports: { own: SongImportRow[]; teams: Record<string, SongImportRow[]> };
};
// PullResponse gains: extras?: ServerExtras
```
- Produces: `serverExtras(db: Db, userId: string): ServerExtras` — the user's dance from their row; `teams` covers every live team of that dance the person is a member of.
- Produces: `DeviceRuntime.extras: ServerExtras | null`.
- Layout rule: on the device (`deviceRuntime()` non-null) a layout reads `deviceRuntime()!.extras` and, when it is null (an old copy), the defaults it uses today for a signed-out page (`false`, `0`, `false`, release null → `appUpdate` from `updateState(agent, null)`, imports `[]`). On the server nothing changes.

- [ ] **Step 1: Write the failing tests**
  - `extras.spec.ts`: a person with one ready import of their own, one of a group they edit, two pending AI lines, one live grant → `{ musicToPick: true, aiPending: 2, aiConnected: true, imports: { own: [2 rows], teams: { [teamId]: [1 row] } } }`; a person with none → all false/0/empty; another dance's import is not counted.
  - pull route: the answer carries `extras` equal to `serverExtras` for the session's user.
  - `apply.spec.ts`: `applyPull` stores extras; a second pull with different extras returns ≥ 1; `readMeta(db).extras` round-trips; a pull without `extras` keeps the stored ones.
  - layouts (device mocked through `globalThis.__salsaDevice`): with `extras.aiPending = 3` the dance layout returns `aiPending: 3` and never calls `pendingCount` (spy); with `extras: null` it returns `aiPending: 0`; the root layout with an Android agent and `extras.release` below the agent's `minVersionCode` returns `appUpdate.state: 'required'`; the songs layout in a group view returns `extras.imports.teams[teamId]`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Count an extras change in `applyPull`'s return (Task 1's rule).
- [ ] **Step 4: Run, expect PASS**, plus `npx vitest related` on the changed files.
- [ ] **Step 5: Commit** — `feat(offline): the server-only facts travel with the pull`

### Task 4: Reads go to the device first

**Files:**
- Modify: `src/lib/offline/routes.ts`, `src/lib/offline/sw-route.ts`, `src/service-worker.ts` (`deviceRead`)
- Create: `src/lib/offline/server-only.spec.ts`
- Test: `src/lib/offline/sw-route.spec.ts`, `src/lib/offline/routes.spec.ts`

**Interfaces:**
- Produces (`routes.ts`): `NETWORK_FIRST_PAGES = ['/settings']` (its load reads `device_tokens`, `oauth_grants`, `storage_requests`/`team_trash`, `app_installs`: online the network first as in phase 2, offline the device) and `isNetworkFirstPage(path: string): boolean`. `'/[dance]/songs/imports/[id]'` joins `NETWORK_PAGES` (picking from a list reads `song_imports` items).
- Produces (`sw-route.ts`): `DeviceClients.readsDeviceFirst(id: string): boolean` — `state === 'ready' && !dirtyAt.has(id)`; and the pure `readPlan(a: { networkFirst: boolean; fromDevice: boolean; deviceFirst: boolean }): 'device' | 'device-then-network' | 'network-then-device'` — `fromDevice` (outbox waiting, today's `readsFromDevice`) → `'device'` (today's behaviour: device, then the network-first path on a fallback); else `networkFirst` → `'network-then-device'`; else `deviceFirst` → `'device-then-network'`; else `'network-then-device'`.
- Produces: `deviceFailed(res: Response | null): boolean` — null (a fallback) or status ≥ 500 → the network answers instead.
- `deviceRead` for `'device-then-network'`: `viaDevice`; if `deviceFailed`, the network untimed, and if that fails too, `offlineRead()`. `'network-then-device'` is today's code path unchanged.
- The data path of a page is `path` minus `/__data.json` when asking `isNetworkFirstPage`.

- [ ] **Step 1: Write the failing tests** (`sw-route.spec.ts`):
```ts
it('a ready page with nothing unpulled reads the device first', () =>
	expect(readPlan({ networkFirst: false, fromDevice: false, deviceFirst: true })).toBe('device-then-network'));
it('a page dirty from a server save reads the network', () => {
	const d = new DeviceClients(); d.setState('p', 'ready', null); d.changed('p', 100);
	expect(d.readsDeviceFirst('p')).toBe(false);
	d.pulled('p', 100);
	expect(d.readsDeviceFirst('p')).toBe(true);
});
it('a starting device reads the network', ...);           // state 'starting' → false
it('Settings reads the network first', () =>
	expect(readPlan({ networkFirst: true, fromDevice: false, deviceFirst: true })).toBe('network-then-device'));
it('a device 500 or fallback goes to the network', () => {
	expect(deviceFailed(null)).toBe(true);
	expect(deviceFailed(new Response('', { status: 500 }))).toBe(true);
	expect(deviceFailed(new Response('', { status: 404 }))).toBe(false);
});
```
`routes.spec.ts`: `isNetworkFirstPage('/settings')` true, `'/salsa'` false; the imports page is a network page.

`server-only.spec.ts` (the guard, scanning sources like `refusals-guard.spec.ts` does): every `+page.server.ts` / `+layout.server.ts` under `src/routes` whose route is neither in `NETWORK_PAGES` nor `NETWORK_FIRST_PAGES` must not import any of these names, except where `ALLOWED` lists the file with a reason ("reads extras on the device"):
```ts
const SERVER_ONLY_READS = {
	'$lib/server/song-imports': ['listImports', 'groupImportsToPick', 'importsWaiting', 'itemsOf'],
	'$lib/server/ai-queue/store': ['pendingCount'],
	'$lib/server/ai-queue/view': ['*'],
	'$lib/server/oauth/store': ['listGrants'],
	'$lib/server/devices': ['listDevices'],
	'$lib/server/storage': ['storageOf'],
	'$lib/server/releases': ['currentRelease'],
	'$lib/server/app-seen': ['*']
};
```
Before writing `ALLOWED`, audit: `grep -rlE "\b(deviceTokens|oauthGrants|oauthTokens|aiGroups|aiActions|aiLines|aiTimelines|appInstalls|songImports|storageRequests|teamChanges|teamTrash|clonePairs|appFlags|invites|sessions)\b" src/lib/server` and follow each module into the route loads that read it. Each find either reads extras (Task 3 pattern), moves its route to `NETWORK_FIRST_PAGES`/`NETWORK_PAGES`, or is a write only (actions: fine, list its names as allowed for that file with "action only"). Add any new name to `SERVER_ONLY_READS`.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/offline/ --maxWorkers=4`
- [ ] **Step 3: Implement** `readPlan`, `readsDeviceFirst`, `deviceFailed`, the lists, and `deviceRead`'s branch; update the header comments of `sw-route.ts` and `service-worker.ts` (online reads are no longer network first).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(offline): reads go to the device first, online too`

### Task 5: Pages waiting on the home worker pull instead of re-reading

**Files:**
- Modify: `src/lib/offline/device.svelte.ts`, `src/routes/[dance]/songs/[id]/+page.svelte`, `src/lib/components/songs/MusicList.svelte`
- Test: `src/lib/offline/device-poll.spec.ts` (new, pure)

**Interfaces:**
- Produces: `pullNow(): void` (exported; posts `{ type: 'pull' }` to the worker; no-op without one) and the pure `pollStep(ready: boolean): 'pull' | 'reload'`.
- The two 10 s pollers call `pollStep(deviceReady()) === 'pull' ? pullNow() : <their current invalidate>`. The pull's changes re-read through Task 2.
- Audit for other pollers: `grep -rnE "setInterval" src/routes src/lib/components` — any that re-reads a device page for the worker's result gets the same treatment (Suggestions is a network page: unchanged).

- [ ] **Step 1: Test** `pollStep(true) === 'pull'`, `pollStep(false) === 'reload'`.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Commit** — `feat(songs): a song waiting on the worker pulls every 10 s`

### Task 6: The words

**Files:** `src/lib/i18n/en/sync.ts`, `src/lib/i18n/sl/sync.ts`

- [ ] **Step 1:** add `pull: { pull, release, syncing, done, offline }` — en: `'Pull to sync'`, `'Let go to sync'`, `'Syncing…'`, `'Up to date'`, `'Offline'`; sl: `'Povlecite za sinhronizacijo'`, `'Spustite za sinhronizacijo'`, `'Sinhroniziram …'`, `'Posodobljeno'`, `'Brez povezave'` (check against the `sl/index.ts` glossary and `sl/sync.ts`'s own words; the catalog types force both).
- [ ] **Step 2:** `npx vitest run src/lib/i18n --maxWorkers=4` passes. Commit with Task 7.

### Task 7: Pull down to refresh (look C)

**Files:**
- Create: `src/lib/motion/pull-refresh.ts`, `src/lib/motion/pull-refresh.spec.ts`, `src/lib/components/ui/PullRefresh.svelte`
- Modify: `src/lib/components/ui/Screen.svelte` (wraps its sheet; prop `pull = true`), the Positions map page and any other Screen page in the exclusion list (`pull={false}`), `src/routes/layout.css` (`overscroll-behavior-y: none` on `html` at phone width, so Chrome's own pull never fires), `src/routes/dev/kit` (a demo)

**Interfaces:**
- Consumes: `syncNow()` (`$lib/offline/device.svelte`), `invalidateAll`, `t().sync.pull` (Task 6), `PULL_*` constants below.
- Produces (pure, `pull-refresh.ts`):
```ts
export const PULL_MAX = 120;      // px the sheet can travel
export const PULL_K = 170;        // resistance
export const PULL_TRIGGER = 68;   // px past which a release syncs
export const PULL_HOLD = 52;      // px the sheet stays open while syncing
export const DONE_MS = 700;       // "Up to date" shows this long
export const OFFLINE_MS = 1000;   // "Offline" shows this long
export function pullDistance(raw: number): number;           // PULL_MAX * (1 - exp(-max(0,raw)/PULL_K))
export type PullPhase = 'idle' | 'pull' | 'ready' | 'syncing' | 'done' | 'offline';
export function phaseWhilePulling(d: number): 'pull' | 'ready'; // d >= PULL_TRIGGER → 'ready'
export function mayStart(a: { pointerType: string; scrollY: number; dx: number; dy: number; inside: boolean }): boolean;
// touch only, scrollY === 0, dy > 0 and |dy| > |dx| (a vertical move down), not inside an excluded element
```
- `PullRefresh.svelte`: listens to touch on the sheet; translates the sheet (and a `data-band-hero` card) by `d`; the gap shows the phase's word, centred, `text-band-small`, semibold 14px, opacity `min(1, d/36)`; release in `ready` → `navigator.onLine ? syncing : offline`; syncing awaits `syncNow()` then `invalidateAll()` (no device: `invalidateAll()` alone; a network page: `invalidateAll()` alone), then `done` for `DONE_MS`, then springs back (320 ms ease-out, `prefers-reduced-motion`: no spring, a jump). Excluded: inside `[role=dialog]`, a Sheet, `[data-no-pull]`, the player route, the video player, the map. Desktop (`desk:`) draws nothing and listens to nothing.

- [ ] **Step 1: Write the failing tests** (`pull-refresh.spec.ts`):
```ts
it('resists and never passes the max', () => {
	expect(pullDistance(0)).toBe(0);
	expect(pullDistance(10_000)).toBeLessThanOrEqual(PULL_MAX);
	expect(pullDistance(200)).toBeLessThan(200);
});
it('is ready past the trigger', () => expect(phaseWhilePulling(PULL_TRIGGER)).toBe('ready'));
it('starts only at the top', () => expect(mayStart({ pointerType: 'touch', scrollY: 4, dx: 0, dy: 20, inside: false })).toBe(false));
it('never starts on a horizontal swipe', () => expect(mayStart({ pointerType: 'touch', scrollY: 0, dx: 30, dy: 10, inside: false })).toBe(false));
it('never starts with a mouse', () => expect(mayStart({ pointerType: 'mouse', scrollY: 0, dx: 0, dy: 20, inside: false })).toBe(false));
it('never starts inside a sheet or the player', () => expect(mayStart({ pointerType: 'touch', scrollY: 0, dx: 0, dy: 20, inside: true })).toBe(false));
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the module, the component and the Screen wiring.
- [ ] **Step 4: Run** the spec, `no-english.spec.ts`, `class-rules.spec.ts`; expect PASS. Shoot Today, Moves and a figure at 390×844 light and dark (`scripts/shots/shots.sh`, a scene in `scripts/shots/ext_pull.py` that holds a pull at `PULL_HOLD` with the syncing word) and compare with option C of the mockup.
- [ ] **Step 5: Commit** — `feat(shell): pull down to refresh, words in the band`

### Task 8: Step 1 lands

- [ ] **Step 1:** Docs: `docs/features.md` (device first, pull to refresh), `docs/layout.md` (new modules), `docs/hard-rules.md` offline rule (reads are device first; `NETWORK_FIRST_PAGES`; a device-drawn load reads no server-only table: `server-only.spec.ts`), the main offline spec's "Network first in phase 2" and phase 3's "With nothing waiting, reads go network first" point to the device-first spec; the device-first spec gets "Decided while building": cookies already travelled with the pull (no change needed), Settings is network first, the imports page is a network page.
- [ ] **Step 2:** The offline walk (`scripts/offline/serve.sh` + `walk.py`) passes; add a walk check that counts `__data.json` requests reaching the server per tab tap with the device ready: 0.
- [ ] **Step 3:** Commit — `docs: device first`.

## Step 2: the first page from the device

### Task 9: Measure today's open on the phone

- [ ] **Step 1:** With the phone on `adb devices` (if not, ask the user to plug it in and allow debugging), install the current master APK build and measure as the spike did (`docs/superpowers/plans/2026-11-07-offline-phase-0-spike.md`, Task 4–5: `first-contentful-paint` and the time to Today's list drawn, read through `chrome://inspect`): 5 cold opens (app killed), 5 warm opens, on Wi-Fi. Write the medians into the device-first spec under "Done when". These are the bar for Task 11.

### Task 10: Start at once, and the shell draws the first page when a copy exists

**Files:**
- Modify: `src/lib/offline/device.svelte.ts` (`startDevice`; tell the SW of the copy), `src/lib/offline/protocol.ts` (`SwIn`), `src/lib/offline/sw-route.ts`, `src/service-worker.ts` (`navigate`, the message handler, `OutboxState`)
- Test: `src/lib/offline/sw-route.spec.ts`

**Interfaces:**
- Produces: `SwIn` `{ type: 'copy'; has: boolean }` — sent by the page when its device turns `ready` (`has: true`) and on `empty` or after `forgetCopy()` (`has: false`). The SW keeps it in the outbox-state cache entry (`OutboxState.copy: boolean`, default false), so it outlives the SW and the app.
- Produces: `navigatePlan(a: { shell: boolean; copy: boolean; networkPage: boolean; waiting: number; online: boolean }): 'shell' | 'network'` — `shell && !networkPage && (waiting > 0 || copy || !online)` → `'shell'`; else `'network'` (today's timed path).
- Produces: `DeviceClients.readsDeviceFirst(id, copy: boolean)` widens: an unknown page (no state yet, the shell just opened) with `copy` reads the device first (`viaDevice` waits up to `DEVICE_START_LIMIT_MS` for the start, then the network).
- `startDevice`: `startWorker()` at once, online too (no `requestIdleCallback`).

- [ ] **Step 1: Tests**: `navigatePlan` — copy + online → shell; no copy + online → network; network page → network; waiting > 0 → shell; no shell → network. `readsDeviceFirst('new', true)` true; `('new', false)` false; a dirty page false either way.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Commit** — `feat(offline): the first page of an open comes from the device`

### Task 11: Measure again, then land

- [ ] **Step 1:** Same measurement as Task 9 on this branch's APK/site. If a cold or warm open is slower than the bar, revert Task 10's `navigatePlan` use in `navigate` (keep the rest) and say so in the spec's "Decided while building".
- [ ] **Step 2:** Docs as Task 8 for step 2 (main offline spec "Opening the app").
- [ ] **Step 3:** Full `npm run check`, the offline walk, the whole-branch review, merge master, full check again, then the merge.

---

## Self-review notes

- Spec coverage: reads (T4), freshness and re-read (T1, T2), extras (T3), song page (T5), saves unchanged (constraint), expired session (already true: a 401 pull keeps `ready`, `signedOut` meta; pinned by the existing `core.spec` — add `it('a 401 pull keeps the copy answering')` in T1 if it is missing), pull to refresh (T6, T7), two steps (T8, T11), measuring (T9, T11), docs (T8, T11).
- Settings as network first and the imports page as a network page are builder calls beyond the spec, recorded in T8's docs step.
