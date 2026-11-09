# Offline phase 3: changes made with no signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this project the slot's own agent builds natively (CLAUDE.md "Building in a slot") unless the user asks otherwise.

**Goal:** Every change a person can make offline saves on the device at once and reaches the server later, dated when it was made, with the same ids, through the same action code and checks; the person sees sync only when it matters.

**Architecture:** The device worker runs every device-first write (a form action or an `/api/` write) through its own SvelteKit `Server` against the copy, inside one SQLite transaction, while triggers capture each written row's before and after. A write that succeeds is committed with an **outbox entry** (the request, made-at, the build's `PAGE_EPOCH`, the ids it minted, the captured rows) and drained to `POST /api/sync/push`, which replays each entry through the hook and the route's own action as the person, in one transaction under a process-wide write gate, with `serverNow()` and `mintId` reading the entry (an `AsyncLocalStorage` replay context). Own rows then get "later edit wins, per field" from the captured before/after and `change_log`; group rows go through the existing clash check. The service worker sends writes to the device first (a group's row online goes to the network), reads from the device while entries wait, and the page shows a band status, a Waiting badge, a Sync page and "Needs a connection" where an action cannot run offline.

**Tech Stack:** SvelteKit 2 (adapter-node), Drizzle on better-sqlite3 (server) and on the SQLite WASM shim (device), `node:async_hooks` (server; stubbed on the device), a SvelteKit service worker, BroadcastChannel, devalue, vitest, Playwright for the walk.

**Spec:** `docs/superpowers/specs/2026-11-09-offline-phase-3-design.md` (binding; approved 2026-11-09 with its picks 1D, 2B, 3B, 4B), building on `docs/superpowers/specs/2026-11-07-offline-design.md` ("Offline changes (push)", "Updates and PAGE_EPOCH", "Decided while building phase 2"). Phase 2's plan (`docs/superpowers/plans/2026-11-08-offline-phase-2-read-only-copy.md`) and its appendix hold the rulings this builds on.

**Parts.** One phase, as the person chose ("everything at once"), in five parts that each end green:

- **Part A — the server takes changes** (Tasks 1–7): slots, the replay context, owners and the outbox's wire, every write classified, the write gate, the per-field merge, the push.
- **Part B — the device records and drains** (Tasks 8–11): capture and the outbox, writes on the device, push then pull, the worker's wiring.
- **Part C — the service worker and the page** (Tasks 12–13).
- **Part D — what the person sees** (Tasks 14–17): words, the band status and the Waiting badge, the Sync page, Needs a connection and Sign out.
- **Part E — proof and docs** (Tasks 18–19).

Parts A–C change nothing a person sees while no write is device-first; device-first writes start only with Task 12. If the user wants two ships, A–C plus Task 18's walk (without its Sync-page checks) is the engine, D the look; the plan stays one file either way.

## Global Constraints

- **Rulings this plan makes on the spec's open points** (the reply to the controller lists them too):
  - **Cookie-setting actions are network-only:** Settings `theme` and `language`, and `/[dance]/group-mode`. A service-worker answer cannot set a browser cookie, and the device's cookie jar would disagree with the browser's.
  - **Sign out is network-only** (greyed offline): `/logout` must reach the server, or the session lives on after the copy is wiped.
  - **Media deletes are network-only with the uploads** (phase 4): `deleteVideo`, `deleteRecording`, `takeRecording`, My count's takes (`/voice`), What uses space, `/[dance]/share`.
  - **`names.ts`' `suffixed` no longer exists** (clone sync removed it): Task 2 adds `suffixed` and `replayName`.
  - **The Waiting badge has the same ~2 s grace** as the status, or it flickers online.
  - **"A group's row online goes to the server first" is decided by the rows the write captured on the device** (any row owned by a group, or whose owner the copy cannot tell), not by one route param. Comments, hearts and publishing a lesson are group rows, so online they go to the server as today; offline they queue with the badge.
  - **An entry of any other epoch than the server's is refused** (`!==`, not only older).
  - **One transaction per entry needs a write gate:** on the one better-sqlite3 connection, another request's write during the replay's awaits would join the replay's transaction. Every other write request holds the gate shared; a replay holds it alone (Task 5).
  - **`flowAfter` does nothing on the device:** the server flows on replay, and the pull brings the result.
  - **A landed entry is deleted at once.** That is the spec's "landed" state: nothing reads it afterwards, and `lastSyncedAt` says when.
- **Online stays as fast as today.** A device-first write answers from the device. A network-only write, and any write when the device cannot take it, goes to the network exactly as in phase 2. In dev there is no service worker and no device: everything is as today.
- **Writes are device-first only when** the request is classified `device` or `queued` (Task 4), the device is ready, has a slot, holds the page's person, and the page's `x-page-epoch` equals the device's `PAGE_EPOCH`. Otherwise: network online, "Needs a connection" offline (phase 2's answer).
- **Uploads stay `pass`** in the service worker (phase 2 ruling): XHR progress and memory.
- **Constants:**
  - `WAITING_GRACE_MS = 2000`;
  - `PUSH_BATCH = 20` entries and `PUSH_MAX_BYTES = 4 * 1024 * 1024` per push;
  - `PUSH_RETRY_MS = 30_000`;
  - `GATE_WAIT_MS = 5000`;
  - `LANDED_KEEP_MS = 180 * 24 * 3600_000`;
  - `RELAY_LIMIT_MS = 15_000`;
  - the outbox header `x-salsa-outbox`;
  - the service worker's state cache `outbox-state` (no `salsa-` prefix: `cachesToDelete` would delete it).
- **New server tables** (migration 0043, plain `CREATE TABLE`, no CHECK on any existing table; read the generated SQL):
  - `device_slots` (key `slot`, an integer handed out by `slotFor`: not a row id, so no `mintedId`);
  - `sync_landed` (key `entry_id`, text).
  - Both go in `NEVER_SYNCED`.
- **Device-only tables** (`outbox`, `capture_rows`, `outbox_capture`) live outside `schema.ts`, made by `installCapture` beside `device_meta`. They are never synced, and their `integer primary key autoincrement` keys are local bookkeeping, never ids the server sees, which is why they don't mint. `capture.ts` says so in its header.
- **Server code reads the time through `serverNow()`.** Pure modules take `now`. Specs never touch `$DATA_DIR` (mock `$lib/server/db` as `dance-wall.spec.ts` does).
- **Words go through `t()`** in both catalogs (`src/lib/i18n/en`, `src/lib/i18n/sl`), read at call time. Slovenian: vikanje, a name after a colon or "·", the number after a colon where agreement would vary. `no-english.spec.ts` covers every component automatically.
- **`PAGE_EPOCH` is not raised.**
  - No existing form, action or API shape changes.
  - The pull's `device`/`slot` fields are additive, and only the versioned device bundle sends them.
  - `PAGE_EPOCH` moves to a leaf module (`src/lib/epoch.ts`), re-exported by `page-epoch.ts`, so the service worker and the device import it without the catalogs.
- **Checks per CLAUDE.md "Building in a slot":**
  - After each task, only its specs: `nix develop -c npx vitest run --maxWorkers=4 <files>`, then `nix develop -c npx eslint <changed>` and `nix develop -c npx prettier --check <changed>`. Commit.
  - The full `nix develop -c npm run check` runs twice: before the final review (Task 19), and after merging master in.
  - A build killed with exit 143: `nix develop -c sh -c "systemd-run --user --scope -q -p MemoryMax=5G npx vite build"`.
- **Never start a pty client or pipe endless input** (a subagent once OOM-killed the session). Every command here ends by itself.

## Review Focus

1. **A pull answer that lands after a new write was recorded on the device** would erase that write from the copy (the server does not have it yet). The device drops such an answer and pushes first. Pinned in Task 10: "drops a pull answer when a write was recorded meanwhile".
2. **A device clock ahead of the server:** a made-at in the future would win every "later edit wins" and date a log tomorrow. The push clamps made-at to its own time. Pinned in Task 7: "clamps a made-at from the future to the push's time".
3. **The service worker was stopped and restarted while offline** (browsers do this after ~30 s idle). It has forgotten every page's device, and a write must still reach the device rather than get "Needs a connection". Pinned in Task 12: "tries the device for a write when it knows nothing of the page".
4. **The group-mode cookie changed between an offline save and its replay:** the row must land in the space it was made in. The entry carries its own cookies, and replay uses them over the push's. Pinned in Task 7: "replays with the entry's group-mode cookie, not the push's".
5. **A multipart form (`use:enhance` sends FormData) posted to the device:** SvelteKit's CSRF check needs `origin`, and `request.formData()` needs the base Request's content-type, or every device-first form 403s or throws. Pinned in Task 9: "runs a multipart form action on the device".

---

## File structure

```
src/lib/epoch.ts                 PAGE_EPOCH, a leaf (page-epoch.ts re-exports it)
src/lib/sync/                    PURE, client-safe, shared by server, device and service worker
  owners.ts                      OWNERS: how each synced row finds its owner; ownerOf
  outbox.ts                      the entry's wire, folding captures, minted ids, held entries, labels, body fields
  status.ts                      the band status and the Waiting mark, with the grace
  view.ts                        the Sync page's and the status's words
  resolve.ts                     a clash resolved from the Sync page: the form to send again
src/lib/server/replay-context.ts the replay's AsyncLocalStorage: made-at, minted ids, deferred flows
src/lib/server/sync/
  slots.ts                       slotFor: a device's id slot
  landed.ts                      sync_landed: idempotent replay, pruned
  gate.ts                        WriteGate: shared writes, an exclusive replay
  merge.ts                       own rows: later edit wins, per field
  outcome.ts                     what an action's answer means for an entry
  replay.ts                      replayEntry, push
  test-replay.ts                 specs only: runs route actions as SvelteKit would answer them
src/routes/api/sync/push/+server.ts
src/lib/offline/
  routes.ts                      + every write classified (ACTIONS, ENDPOINT_WRITES, writeClass)
  sw-route.ts                    + DeviceClients knows the outbox; holdsUpdate
  protocol.ts                    + OutboxSummary, OutboxItem, the new messages
  relay.ts                       the BroadcastChannel relay between tabs
  connection.svelte.ts           online or not, for greying
  needs-connection-action.ts     use:needsConnection on a lone button or link
  device.svelte.ts               + sync state, relay, Sync page calls, sign-out
src/device/
  capture.ts                     the before/after triggers and the device-only tables
  outbox.ts                      the outbox store: record, send, results, held, retry, discard, forget
  core.ts, worker.ts, apply.ts, migrate.ts, request.ts   (changed)
src/lib/components/system/SyncStatus.svelte, NeedsConnectionNote.svelte
src/lib/components/ui/WaitingBadge.svelte
src/lib/components/sync/SyncEntry.svelte
src/routes/[dance]/sync/+page.svelte
src/lib/i18n/en/sync.ts, src/lib/i18n/sl/sync.ts
drizzle/0043_*.sql
```

---

# Part A — the server takes changes

### Task 1: Device slots and landed entries

**Files:**
- Modify:
  - `src/lib/server/db/schema.ts` (`deviceSlots`, `syncLanded`);
  - `src/lib/sync/tables.ts` (`NEVER_SYNCED` += `'device_slots'`, `'sync_landed'`);
  - `src/lib/sync/wire.ts`;
  - `src/lib/server/sync/pull.ts`;
  - `src/routes/api/sync/pull/+server.ts`;
  - `src/lib/server/trash.ts` (`startTrashPurge` also calls `pruneLanded`);
  - `src/device/migrate.ts` (`DeviceMeta` gains `deviceKey`, `slot`);
  - `src/device/apply.ts` (`wipeCopy` keeps `deviceKey`/`slot`; `pullRequestOf` sends `device`; `applyPull` stores `slot`).
- Create: `src/lib/server/sync/slots.ts`, `src/lib/server/sync/landed.ts`, and their specs.
- Migration: `nix develop -c npm run db:generate` → `drizzle/0043_*.sql`. Read it: two `CREATE TABLE`s and a unique index, nothing else.

**Interfaces:**
- Produces:
  - **Schema:**
    - `device_slots (slot integer primary key, device_key text not null unique, user_id text not null, created_at integer not null)`;
    - `sync_landed (entry_id text primary key, user_id text not null, landed_at integer not null)`.
  - **`slotFor(db: Db, userId: string, deviceKey: string, now: number): number`:**
    - the key's existing slot, whoever asks: a slot belongs to the browser's database, not to a person;
    - otherwise a new row with `max(slot) + 1`, the first being 1;
    - throws `RangeError` past `MAX_SLOT`.
  - **`landed.ts`:**
    - `LANDED_KEEP_MS`;
    - `isLanded(db, entryId: string, userId: string): boolean`;
    - `markLanded(db, entryId, userId, now): void`;
    - `pruneLanded(db, now): number`.
  - **`wire.ts`:**
    - `PullRequest.device?: string`: the device key, `^[A-Za-z0-9-]{8,64}$`;
    - `PullResponse.slot?: number`: present when `device` was sent.
  - **`DeviceMeta`:**
    - `deviceKey: string | null`;
    - `slot: number | null`.
  - `pullRequestOf` sends `device: meta.deviceKey` when set.
  - **`ensureDeviceKey(db: SqliteDb, newKey: () => string): string`** (`apply.ts`): writes one the first time.

- [ ] **Step 1: Write the failing tests.**

`src/lib/server/sync/slots.spec.ts`:
```ts
it('hands the first device slot 1, the next slot 2', ...)        // slotFor(db,'u1','dev-a',1) === 1; ('u1','dev-b') === 2
it('gives the same key the same slot, whoever asks', ...)         // ('u2','dev-a') === 1
it('never hands out the server slot 0', ...)
```
`src/lib/server/sync/landed.spec.ts`:
```ts
it('knows a landed entry, for its own person only', ...)         // markLanded(e1,u1) → isLanded(e1,u1) true, isLanded(e1,u2) false
it('prunes what landed more than 180 days ago', ...)
```
`src/lib/server/sync/pull.spec.ts`, add:
```ts
it('assigns a slot to a device that names itself', ...)          // pull(.., { ..., device: 'dev-a' }).slot === 1
it('says no slot to a device that does not', ...)                // 'slot' in res === false
```
`src/device/apply.spec.ts`, add:
```ts
it('keeps the device key and slot through a wipe', ...)          // ensureDeviceKey, apply {slot:3}, wipeCopy → readMeta: deviceKey same, slot 3
it('sends its device key with every pull request', ...)
```
`src/lib/sync/tables.spec.ts` already fails on the two unclassified tables. That's the check.

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/sync src/device/apply.spec.ts src/lib/sync/tables.spec.ts`. Expected: FAIL (no modules, unclassified tables).

- [ ] **Step 3: Implement.**
  1. Schema, then `db:generate`.
  2. Then the two modules.
  3. `pull` calls `slotFor` inside its transaction when `req.device` is set. The route's `readRequest` accepts `device`.
  4. `wipeCopy` deletes `device_meta` rows except `deviceKey` and `slot`.
  5. Run `ids.spec.ts`: `device_slots` has no `id` column, so it is not an id table.

- [ ] **Step 4: Run them.** Same command, plus `src/lib/server/db/ids.spec.ts`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "sync: device slots and landed entries (migration 0043)"`

---

### Task 2: The replay context

**Files:**
- Create: `src/lib/server/replay-context.ts`, `src/lib/server/replay-context.spec.ts`
- Modify:
  - `src/lib/server/server-clock.ts`, `src/lib/server/db/ids.ts`;
  - `src/lib/server/clones/flow-hook.ts` (+ spec), `src/lib/server/clones/names.ts` (+ spec);
  - `src/lib/server/clash.ts` (+ spec);
  - the seven `seenRefusal` callers:
    - `(today)/exercises/[id]`, `lessons/[id]`, `(moves)/figures/[id]`, `(moves)/moves/[id]`, `(moves)/routines/[id]`, `(moves)/positions/[id]`, `songs/[id]` (each `+page.server.ts`);
    - `src/lib/server/music-form.ts`;
    - `src/routes/api/video-spots/[id]/+server.ts` (its `checkSeen`);
  - the name sites below.

**Interfaces:**
- Produces:
```ts
// replay-context.ts (node:async_hooks; the device's stub never runs it)
export type ReplayContext = {
	entryId: string;
	madeAt: number;
	/** The entry's minted ids per table, taken in order by mintId. */
	minted: Map<string, number[]>;
	/** The flows the actions asked for, run by the replay after the merge. */
	flows: { actorId: string; kind: CloneKind; id: number }[];
	/** True while the action runs; false while the replay runs the deferred flows. */
	deferFlows: boolean;
};
export function replaying(): ReplayContext | undefined;
export function runReplaying<T>(ctx: ReplayContext, fn: () => T): T;
/** On replay, a taken name becomes `suffixed`; otherwise the name as it is. */
export function replayName(name: string, taken: (n: string) => boolean): string;
// names.ts
export function suffixed(name: string, taken: (n: string) => boolean): string; // "Basic (2)", "Basic (3)", …
// clash.ts
export type SeenRule = { team: boolean; copies: boolean };
export function seenApplies(team: boolean): boolean; // team || !replaying()
// seenRefusal(form, rule: SeenRule, current, extra, now?, who?) — was `required: boolean`
```
- **Rules:**
  - **`serverNow()`:** `replaying()?.madeAt ?? Date.now()`.
  - **`mintId(table)`:** when `replaying()?.minted.get(table)` has an id left, it shifts it and returns ``sql`${id}` ``. Otherwise as today: the server's slot.
  - **`flowAfter`:**
    - returns at once when `deviceRuntime()` is set;
    - while `replaying()?.deferFlows`, pushes `{ actorId, kind, id }` and returns.
  - **`seenRefusal`:**
    - `current === null` → 410, as today, always;
    - `!rule.team && replaying()` → null: no 400, no 409; the push merges own rows;
    - otherwise `required = rule.team || rule.copies`, as today.
  - **The video-spots PATCH** skips its `checkSeen` when `!seenApplies(teamRow)` and the spot still exists.
  - **`replayName` runs before every uniqueness check** on a create or rename path:
    - `src/lib/server/figures.ts`: `figureNameTaken` and `variationNameTaken`/`variationNameRefused` where `createFigure`, `createVariation`, `duplicate` (line ~311), `updateVariation` and `renameMove` check;
    - `src/lib/server/positions.ts` create and update (`nameTaken`);
    - the route-level pre-checks in `(moves)/figures/+page.server.ts` (~114, ~150), `(moves)/moves/[id]` (~100, ~134), `(moves)/figures/[id]` (~565, ~568) and `lessons/[id]` (~543, ~591);
    - `src/lib/server/link-popup.ts`.

    The suffixed name is then the one written. Teams' names stay as they are: making and renaming a group run online first.

- [ ] **Step 1: Write the failing tests.**

`replay-context.spec.ts` (`openDb(':memory:')`):
```ts
it('reads the made-at inside a replay and the clock outside', ...)
// runReplaying({madeAt: 1000,...}, () => serverNow()) === 1000; serverNow() outside ≈ Date.now()
it("mints the entry's ids in order, then the server's slot", ...)
// minted {sets:[2**32*3+5, 2**32*3+9]} → two inserted sets have those ids; a third gets slot-0 mark + 1
it('keeps two replays apart across awaits', ...)                 // two concurrent runReplaying, each reads its own madeAt after an await
it('suffixes a taken name only on replay', ...)                  // replayName('Basic', n => n==='Basic') === 'Basic' outside; 'Basic (2)' inside
```
`names.spec.ts`:
```ts
it('adds (2), then (3)', ...)
```
`clash.spec.ts`:
```ts
it("skips a stale seen on a person's own row during a replay", ...)    // seenRefusal(form, {team:false,copies:true}, cur, {}) === null inside runReplaying
it("still refuses a group's row with a stale seen during a replay", ...) // status 409 with clash
it('still says gone for an archived row during a replay', ...)            // current null → 410
```
`flow-hook.spec.ts`:
```ts
it('defers a flow during a replay and runs it when asked', ...)  // ctx.flows has {kind,id}; flowFrom not called
it('does nothing on the device', ...)                            // __salsaDevice set → flowFrom not called
```

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/replay-context.spec.ts src/lib/server/clones/names.spec.ts src/lib/server/clash.spec.ts src/lib/server/clones/flow-hook.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**, including the 8 `seenRefusal` call sites:
  - `{ team: row.teamId !== null, copies: hasCopies(db, kind, row.id) }`;
  - music-form: `{ team: isTeam(space), copies: false }`;
  - songs: `{ team: true, copies: false }`, where it passed `true`.

- [ ] **Step 4: Run them, the scans and the specs the touched routes have.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server src/routes/[dance] src/routes/api/video-spots` (`server-clock.spec.ts` and `ids.spec.ts` must stay green). Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "sync: the replay context (made-at clock, the entry's ids, deferred flows, own rows skip seen)"`

---

### Task 3: Who owns a row, and the outbox's wire (PURE)

**Files:**
- Create: `src/lib/sync/owners.ts`, `src/lib/sync/owners.spec.ts`, `src/lib/sync/outbox.ts`, `src/lib/sync/outbox.spec.ts`

**Interfaces:**
- Produces, in `owners.ts`:
```ts
export type OwnerRule =
	| { root: true }                      // carries user_id / team_id
	| { team: true }                      // teams: the row is the group
	| { person: true }                    // a person's own bookkeeping
	| { via: { col: string; table: string }[] }   // the first non-null column names the parent
	| { cloneSync: true };                // (kind, row_id) names the row
export const OWNERS: Readonly<Record<string, OwnerRule>>;
export type Owner = 'person' | 'team' | 'unknown';
/** `get(table, id)`: a parent row by id, null when the copy or db lacks it. */
export function ownerOf(table: string, row: Record<string, unknown>, get: (table: string, id: number) => Record<string, unknown> | null): Owner;
```
**`OWNERS`:**

| Table(s) | Rule |
|---|---|
| `figure_groups`, `figures`, `routines`, `exercises`, `lessons`, `positions`, `songs` | root |
| `teams` | team |
| `team_members` | via `team_id` → `teams` |
| `users`, `today_picks`, `default_styles`, `count_takes`, `opens`, `twins`, `lesson_adds` | person |
| `clone_sync` | cloneSync (`figure`→`figures`, `routine`, `drill`→`exercises`, `song`, `lesson`, `position`) |
| `recordings`, `figure_start_positions`, `figure_end_positions` | via `figure_id` → `figures` |
| `lesson_videos`, `lesson_figures`, `lesson_routines`, `lesson_exercises`, `lesson_positions`, `lesson_comments` | via `lesson_id` → `lessons` |
| `routine_steps` | via `routine_id` → `routines` |
| `routine_step_options` | via `step_id` → `routine_steps` |
| `sets`, `song_drops` | via `exercise_id` → `exercises` |
| `video_spots` | via `recording_id` → `recordings` or `lesson_video_id` → `lesson_videos` |
| `spot_links`, `spot_position_links` | via `spot_id` → `video_spots` |
| `links` | via `figure_id`, `lesson_id` or `exercise_id` |
| `song_links` | via `lesson_id`, `exercise_id` or `routine_id` |
| `video_downloads` | via `link_id` → `links`, `figure_id` or `lesson_id` |
| `lesson_comment_hearts` | via `comment_id` → `lesson_comments` |

A root is `team` when `team_id` is not null. A missing parent is `unknown`.

- Produces, in `outbox.ts`:
```ts
export type Row = Record<string, string | number | null>;
export type CapturedRow = { tbl: string; key: string; op: 'i' | 'u' | 'd'; before: Row | null; after: Row | null };
export type WireEntry = {
	id: string; madeAt: number; epoch: number;
	url: string; method: string; headers: [string, string][];
	body: string | null;                          // base64
	minted: Record<string, number[]>;
	rows: CapturedRow[];
};
export type PushRequest = { device: string; entries: WireEntry[] };
export type RefusalReason = 'clash' | 'gone' | 'stale' | 'refused' | 'access' | 'error' | 'not-allowed' | 'bad-ids';
export type EntryResult =
	| { id: string; state: 'landed' }
	| { id: string; state: 'refused'; reason: RefusalReason; message: string | null; clash: ClashInfo | null; gone: GoneInfo | null }
	| { id: string; state: 'held'; heldBy: string }
	| { id: string; state: 'deferred' };
export type PushResponse = { slot: number; results: EntryResult[] };
export const PUSH_BATCH = 20;
export const PUSH_MAX_BYTES = 4 * 1024 * 1024;
export const OUTBOX_HEADER = 'x-salsa-outbox';
/** The request headers an entry keeps: what the action reads. */
export const RECORDED_HEADERS = ['content-type', 'accept', 'x-sveltekit-action', 'cookie'] as const;
export function foldCaptured(rows: CapturedRow[]): CapturedRow[];
export function mintedIn(rows: CapturedRow[], slot: number, marks: Record<string, number>): Record<string, number[]>;
export type DepEntry = { id: string; url: string; rows: CapturedRow[]; minted: Record<string, number[]> };
export function dependsOn(later: DepEntry, earlier: DepEntry): boolean;
export function heldBy(entries: DepEntry[], refused: ReadonlySet<string>): Map<string, string>;
export const QUEUED_MARK: Readonly<Record<string, string | null>>;
export function queuedMarks(rows: CapturedRow[]): string[];
export type EntryLabel = { kind: 'log' | 'note' | 'name' | 'new' | 'removed' | 'edit' | 'comment' | 'heart' | 'other'; thing: string | null };
export function entryLabel(action: string, rows: CapturedRow[], thing: string | null): EntryLabel;
export function bodyFields(contentType: string | null, body: Uint8Array | null): [string, string][];
export function base64Of(bytes: Uint8Array): string;
export function bytesOf(b64: string): Uint8Array;
```
- **Rules:**
  - **`foldCaptured`** folds per `tbl` + `key`, keeping the order of first appearance:
    - the first `before` and the last `after`;
    - `i` then `u` is `i`; `i` then `d` drops the row; `u` then `d` is `d`; `d` then `i` is `u`.
  - **`mintedIn`:** for each `i` row whose table's key is `['id']` (per `SYNCED`), with `Math.floor(id / 2**32) === slot` and `id > (marks[tbl] ?? slot * 2**32)`, its ids in order.
  - **`dependsOn(later, earlier)`** holds when either:
    - `later` touches a `tbl:key` that `earlier` wrote;
    - or one of `earlier`'s minted ids appears in `later.url` as a path segment, or as a value in `later`'s rows (`before` or `after`).
  - **`heldBy`** walks the entries in order. An entry depending on a refused or held one maps to the root refused id.
  - **`QUEUED_MARK`:** `songs: null`, `lessons: null`, `lesson_comments: null` (the row itself), `lesson_comment_hearts: 'comment_id'` (→ `lesson_comments:<id>`), `video_downloads: 'link_id'` (→ `links:<id>`).
  - **`queuedMarks`** returns `"<table>:<key>"` strings.
  - **`entryLabel`:**
    - action `done` → `log`, its thing passed in;
    - else the first row of a root table, a `lesson_comments` row or a hearts row:
      - an `i` on `lesson_comments` → `comment`;
      - a hearts row → `heart`;
      - another `i` → `new`;
      - a `d`, or `archived_at` going from null to set → `removed`;
      - a `u` whose changed columns (before ≠ after) are only `notes` → `note`;
      - only `name` or `title` → `name`;
      - anything else → `edit`;
    - no such row → `other`.
  - **`bodyFields`** reads text fields only, from `application/x-www-form-urlencoded` and `multipart/form-data` (via `new Response(body, { headers }).formData()`, so make it `async` if that is the cleanest; then the type is `Promise<[string,string][]>`). It drops `seen` and `fingerprint`.

- [ ] **Step 1: Write the failing tests.**

`owners.spec.ts`:
```ts
it('has a rule for every synced table, naming real columns and tables', ...) // keys(OWNERS) === keys(SYNCED); every via col exists in getTableConfig
it("reads a set's owner through its drill", ...)                 // own drill → 'person'; group drill → 'team'
it('reads a section through a lesson video or a recording', ...)
it('is unknown when a parent is missing', ...)
```
`outbox.spec.ts`:
```ts
it('folds an insert and an update into one insert with the last after', ...)
it('drops a row inserted and deleted in one entry', ...)
it("lists the ids minted in the device's slot above its marks, in order", ...) // a restored lower id is not minted
it('holds a log on a drill whose creation was refused', ...)     // B.url '/salsa/exercises/<A.minted.exercises[0]>?/done'
it('holds a second edit to a row refused in a clash', ...)       // same tbl:key
it('holds transitively and names the refused root', ...)
it('marks a heart by its comment and a YouTube save by its link', ...)
it('labels a notes-only change "note", a rename "name", an archive "removed"', ...)
it('reads the text fields of a url-encoded and a multipart body, without seen', ...)
it('round-trips bytes through base64', ...)
```

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/sync/owners.spec.ts src/lib/sync/outbox.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Both modules are PURE; `owners.spec` may import the schema.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "sync: who owns a row, and the outbox's wire"`

---

### Task 4: Every write classified

**Files:**
- Modify: `src/lib/offline/routes.ts`, `src/lib/offline/routes.spec.ts`

**Interfaces:**
- Produces:
```ts
export type WriteClass = 'device' | 'queued' | 'network';
/** Every form action, by route id, then action name ('default' for a default action). */
export const ACTIONS: Readonly<Record<string, Readonly<Record<string, WriteClass>>>>;
/** Every endpoint write, by route id, then method. 'pass': the service worker never handles it. */
export const ENDPOINT_WRITES: Readonly<Record<string, Readonly<Partial<Record<'POST' | 'PUT' | 'PATCH' | 'DELETE', WriteClass | 'pass'>>>>>;
/** The route id among `ids` a path matches: the one with the most static segments. Null: none. */
export function matchRoute(path: string, ids: readonly string[]): string | null;
/** A write's class; null for a GET, an unknown route or action (treated as network). */
export function writeClass(method: string, url: URL): WriteClass | 'pass' | null;
```
- **Classification (rulings).** Every action not named in the network or queued lists below is `device`:
  - **`network`:**
    - `/admin` (all) and `/login`, `/join`, `/device/pair`, `/welcome` (`default`);
    - `/g/[code]` `join`; `/welcome/start` `join`;
    - `/[dance]/group-mode` `default`;
    - `/[dance]/groups` `create`, `joinCode`;
    - `/[dance]/groups/[id]` `remakeCode`, `leave`, `delete`, `restore`;
    - every action of `/[dance]/groups/[id]/people`, `/[dance]/groups/[id]/storage`, `/[dance]/groups/[id]/deleted`, `/[dance]/groups/[id]/history/[kind]/[rootId]`, `/settings/storage` and `/voice`;
    - `/settings` `ask`, `theme`, `language`, `removeDevice`, `restoreDevice`;
    - `/[dance]/share` `create`;
    - `/[dance]/songs/imports/[id]` (all); `/[dance]/songs` `retryImport`, `dismissImport`;
    - on every item page that has them (lessons, figures, positions, routines, songs, exercises): `makeMine`, `sync`, `drop`, `detach`, `copyTo`, `moveTo`;
    - `/[dance]/(moves)/figures/[id]` `takeRecording`, `deleteRecording`; `/[dance]/lessons/[id]` `deleteVideo`; `/[dance]/songs/[id]` `audio`.
  - **`queued`:**
    - `/[dance]/songs` `addUrl`, `retry`; `/[dance]/songs/[id]` `retry`;
    - `/[dance]/lessons/[id]` `publish`, `saveVideo`, `retryVideo`;
    - `/[dance]/(moves)/figures/[id]` `saveVideo`, `retryVideo`.
  - **Endpoints:**
    - `queued`: `/api/lessons/[id]/comments` POST, `/api/comments/[id]` DELETE, `/api/comments/[id]/heart` POST, `/api/comments/[id]/restore` POST;
    - `device`: `/api/archived` POST, `/api/positions` POST, `/api/video-spots` POST, `/api/video-spots/[id]` PATCH and DELETE, `/api/video-spots/[id]/links` POST, `/api/video-spots/[id]/links/[linkId]` DELETE, `/api/opens` POST, `/[dance]/(today)/exercises/[id]/practice` POST;
    - `network`: `/api/count-takes` POST, `/api/trash/[id]` POST, `/logout` POST, every `/api/worker/*` write;
    - `pass`: `/api/sync/pull`, `/api/sync/push`, and the uploads `/api/figures/[id]/recordings` POST, `/api/songs` POST, `/api/lessons/[id]/videos/[uploadId]` PUT.
- **`writeClass`:**
  1. For an action URL (`?/name`, or none → `default`), it matches the path against `ACTIONS` keys with `matchRoute`. `/settings` must match `/settings`, not `/[dance]/(today)`.
  2. Otherwise it matches `ENDPOINT_WRITES`.
  3. A path that is a network page (`isNetworkPage`) is `network`.

- [ ] **Step 1: Write the failing tests** in `routes.spec.ts`:
```ts
it('classifies every action of every page, exactly once', ...)
// vi.mock('$lib/server/db'); import.meta.glob('/src/routes/**/+page.server.ts'); for each module with `actions`:
// Object.keys(mod.actions).sort() toEqual Object.keys(ACTIONS[routeId]).sort(); and no ACTIONS key without a module
it('classifies every write method of every endpoint', ...)
// source scan as the GET test does, for POST|PUT|PATCH|DELETE; === ENDPOINT_WRITES
it('blocks offline what the spec names', ...)
// writeClass('POST', u('/salsa/groups?/joinCode')) 'network'; '/g/abc?/join'; '/welcome/start?/join';
// '/salsa/lessons/1?/copyTo', '?/makeMine', '?/sync', '?/drop', '?/detach', '?/moveTo'; '/salsa/figures/1?/takeRecording';
// '/admin?/invite'; '/device/pair'; '/salsa/groups/1?/leave', '?/delete', '?/remakeCode'; '/settings?/ask'; '/settings?/theme'
it('queues what the spec names', ...)
// '/salsa/songs?/addUrl', '/salsa/lessons/1?/saveVideo', '/salsa/lessons/1?/publish', POST /api/lessons/1/comments,
// POST /api/comments/1/heart, DELETE /api/comments/1 → 'queued'
it('reads a path to the most specific route', ...)
// '/salsa?/done' 'device'; '/settings?/name' 'device'; '/voice?/delete' 'network'; '/salsa/exercises/7?/done' 'device'
it('passes the sync endpoints and the uploads', ...)
```
- [ ] **Step 2: Run it to see it fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/offline/routes.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, listing every action. The first test prints what is missing.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "offline: every write classified (device, queued, network)"`

---

### Task 5: The write gate, and the hook

**Files:**
- Create: `src/lib/server/sync/gate.ts`, `src/lib/server/sync/gate.spec.ts`
- Modify:
  - `src/hooks.server.ts`;
  - `src/lib/server/device-runtime.ts` (`DeviceRuntime.slot: number | null`) and its spec;
  - `src/device/core.ts` (its `DeviceRuntime` copy gains `slot`).

**Interfaces:**
- Produces:
```ts
export const GATE_WAIT_MS = 5000;
export class WriteGate {
	/** Runs at once unless a replay holds the gate; then after it. */
	shared<T>(fn: () => Promise<T>): Promise<T>;
	/** Waits (up to waitMs) until no shared write runs, then runs alone. New shared writes may start while it waits. */
	exclusive<T>(fn: () => Promise<T>, waitMs?: number): Promise<{ ran: true; value: T } | { ran: false }>;
	get inFlight(): number;
}
export const writeGate: WriteGate;
/** Whether the hook holds the gate for this request. */
export function gatedRequest(method: string, path: string, onDevice: boolean, replay: boolean): boolean;
```
- **Rules:**
  - **`gatedRequest`:** false for GET and HEAD, on the device, inside a replay, and for `/api/sync/push` and `/api/sync/pull`. True otherwise, the worker's writes and the uploads included.
  - **The hook:**
    - on the device, `setIdSlot(device.slot)` when the slot is not null;
    - `noteAppSeen` is skipped while `replaying()`;
    - when `gatedRequest(...)` holds, both `resolve` calls (the worker prefix's and the final one) run inside `writeGate.shared(...)`.

- [ ] **Step 1: Write the failing tests.** `gate.spec.ts`:
```ts
it('runs shared writes side by side', ...)
it('a replay waits for the writes in flight, then runs alone', ...)
it('a shared write waits while a replay holds the gate', ...)
it('gives up after waitMs and runs nothing', ...)               // fake timers → { ran: false }, fn not called
it('lets go when a write throws', ...)
it('gates writes, not reads, not the sync endpoints, not the device or a replay', ...)
```
`device-runtime.spec.ts`: add `it('carries the device slot', ...)`.

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/sync/gate.spec.ts src/lib/server/device-runtime.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, including the hook.
- [ ] **Step 4: Run them, then the hook's neighbours.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server src/routes/api`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "sync: the write gate; the hook gates writes and sets the device's slot"`

---

### Task 6: Own rows — later edit wins, per field

**Files:**
- Create: `src/lib/server/sync/merge.ts`, `src/lib/server/sync/merge.spec.ts`

**Interfaces:**
- Consumes: `CapturedRow`, `Row` (Task 3); `ownerOf` (Task 3); `logHead` (`log.ts`).
- Produces:
```ts
export type ServerRowState = { before: Row | null; lastChangeAt: number | null };
/** PURE: the columns to put back after a replayed update of an own row. */
export function fieldsToRestore(
	device: { before: Row; after: Row },
	server: { before: Row; after: Row },
	lastChangeAt: number | null,
	madeAt: number
): Row;
/** Before the action: each `u` row's server state and its last change_log time. Key: `${tbl}:${key}`. */
export function snapshotRows(db: Db, rows: CapturedRow[]): Map<string, ServerRowState>;
/** After the action: for own rows only (`ownerOf` on the server row is 'person'), writes fieldsToRestore back. Returns rows changed. */
export function restoreOwnFields(db: Db, rows: CapturedRow[], snap: Map<string, ServerRowState>, madeAt: number): number;
```
- **The rule (spec, fixed).** For each column of the server row after the action:
  - **The entry left it alone** (`device.before[c] === device.after[c]`) and the action changed it on the server (`server.after[c] !== server.before[c]`): put back `server.before[c]`.
  - **The entry changed it** (`device.before[c] !== device.after[c]`), and the server had changed it since (`server.before[c] !== device.before[c]`), and `lastChangeAt > madeAt`: put back `server.before[c]`.
  - **Otherwise** keep it.
  - Values compare after normalising: numbers as numbers, null as null.
- **Reading and writing:**
  - Reads and writes go through `db.$client.prepare`.
  - Column and table names come from `PRAGMA table_info`, never from the entry.
  - A key is parsed back with `JSON.parse` for composite keys. A one-column key is a number when the column is an integer.

- [ ] **Step 1: Write the failing tests.** `merge.spec.ts`; pure cases first, then on `openDb(':memory:')` with `updateVariation` standing in for the action:
```ts
it("puts back a field the entry left alone and the server changed since", ...) // device changed notes only; PC renamed → name stays the PC's
it('keeps the later of two changes to one field', ...)            // lastChangeAt 2000 > madeAt 1000 → server's; madeAt 3000 → entry's
it('keeps a field nobody else changed', ...)
it("never touches a group's row", ...)
it('does nothing for a row deleted on the server meanwhile', ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/sync/merge.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "sync: own rows, later edit wins per field"`

---

### Task 7: Replay, and `POST /api/sync/push`

**Files:**
- Create:
  - `src/lib/server/sync/outcome.ts`, `outcome.spec.ts`;
  - `src/lib/server/sync/replay.ts`, `replay.spec.ts`;
  - `src/lib/server/sync/test-replay.ts` (specs only);
  - `src/routes/api/sync/push/+server.ts`, `src/routes/api/sync/push/push.spec.ts`.

**Interfaces:**
- Consumes: Tasks 1–6; `PAGE_EPOCH` (`$lib/page-epoch`); `writeClass` (Task 4); `slotOf` (`ids.ts`).
- Produces:
```ts
// outcome.ts
export type Outcome =
	| { landed: true }
	| { landed: false; reason: RefusalReason; message: string | null; clash: ClashInfo | null; gone: GoneInfo | null };
export function outcomeOf(res: Response, isAction: boolean): Promise<Outcome>;
// replay.ts
export type Runner = (request: Request) => Promise<Response>;
export function replayRequest(entry: WireEntry, origin: string): Request;
export type ReplayOptions = { now: number; origin: string; gate?: WriteGate };   // gate: writeGate when absent
export function replayEntry(db: Db, run: Runner, userId: string, slot: number, entry: WireEntry, o: ReplayOptions): Promise<EntryResult>;
/** Takes the device's slot itself (`slotFor(db, userId, req.device, o.now)`). */
export function push(db: Db, run: Runner, userId: string, req: PushRequest, o: ReplayOptions): Promise<PushResponse>;
// test-replay.ts (specs only)
export function actionRunner(user: App.Locals['user'], routes: { id: string; module: unknown }[]): Runner;
```
- **`outcomeOf`:**
  - **An action** (JSON `{ type, status, data }`, `data` read with `devalue.parse`):
    - `success` or `redirect` → landed;
    - `failure` → refused, by the first that holds:
      - `data.clash` → `clash`;
      - `data.gone`, or status 404/410 → `gone`;
      - `data.stale` → `stale`;
      - status 401/403 → `access`;
      - otherwise `refused`, with `data.message`;
    - `error` → by status: 404/410 `gone`, 401/403 `access`, otherwise `error`.
  - **Anything else:**
    - 2xx/3xx → landed;
    - 409 with `clash` → `clash`;
    - 404/410 → `gone`;
    - 401/403 → `access`;
    - other 4xx → `refused` with the body's `message`;
    - 5xx → `error`.
- **`replayRequest`:**
  - the entry's path and search, on `origin`;
  - its recorded headers. `cookie` keeps every cookie except `SESSION_COOKIE`; event.fetch adds the push's session, and an explicit cookie wins over the push's own (SvelteKit's `get_cookie_header`);
  - `x-page-epoch: String(PAGE_EPOCH)`;
  - the body from base64.
- **`push`:** for each entry in order, at most `2 * PUSH_BATCH` (more is a 400 in the route):
  1. Held by an earlier refused or held entry of this batch (`heldBy`) → `{ state: 'held', heldBy }`.
  2. `entry.epoch !== PAGE_EPOCH` → refused `stale`.
  3. `writeClass` of its method and URL is not `device` or `queued` → refused `not-allowed`.
  4. Any minted id outside `slot` (`slotOf(id) !== slot`) → refused `bad-ids`.
  5. `(o.gate ?? writeGate).exclusive(..., GATE_WAIT_MS)`. When it does not run, this entry and every later one are `deferred`, and push stops. Inside the gate, under one transaction:
     1. `isLanded` → `landed`, without running.
     2. `madeAt = Math.min(entry.madeAt, o.now)`.
     3. `seqBefore = logHead(db)`, then `snapshotRows`.
     4. `db.$client.exec('BEGIN IMMEDIATE')`.
     5. `res = await runReplaying(ctx, () => run(replayRequest(entry, o.origin)))`, with `ctx.minted` from `entry.minted` and `deferFlows: true`.
     6. `outcome = await outcomeOf(res, isAction)`.
     7. **Landed:**
        1. `restoreOwnFields(db, entry.rows, snap, madeAt)`;
        2. `UPDATE change_log SET at = ? WHERE seq > ?` (madeAt, seqBefore);
        3. `ctx.minted.clear()`, `ctx.deferFlows = false`;
        4. each `ctx.flows` through `flowAfter`, inside the context;
        5. `markLanded`;
        6. `COMMIT`.
     8. **Refused:** `ROLLBACK`.
     9. **Any throw:** `ROLLBACK`, refused `error` with the message logged as `[sync] entry <id>: …` (never the body).
- **The route:**
  - 401 without a cookie session (`validateSession`). A device token never pushes.
  - 400 for a malformed body: every entry field type-checked, `id` matching `^[A-Za-z0-9-]{8,64}$`, `device` as in Task 1.
  - Otherwise `json(await push(getDb(), (r) => event.fetch(r), user, req, { now: serverNow(), origin: event.url.origin }))`. The answer is `PushResponse`.
- **`actionRunner`** finds the route by `matchRoute`, builds `params` from the path, and gives the event:
  - `request`;
  - `cookies` read from the request's `cookie` header;
  - `locals.user`.

  It answers as SvelteKit would:
  - an action → `{ type, status, data: devalue.stringify(...) }`, from a return, `fail`, a thrown `redirect` or `error`;
  - an endpoint → its Response.

  The hook does not run in specs. Its gate and slot are Task 5's tests.

- [ ] **Step 1: Write the failing tests.**

`outcome.spec.ts`:
```ts
it('reads a success and a redirect as landed', ...)
it('reads a clash, a gone, a stale and a plain refusal', ...)     // reason + message + clash payload kept
it('reads an endpoint 2xx as landed and a 5xx as error', ...)
```
`replay.spec.ts` (`vi.mock('$lib/server/db')`, `test-world.ts`, `actionRunner`, the real `(today)`, `(today)/exercises/[id]`, `(moves)/figures`, `(moves)/figures/[id]`, `lessons/[id]` modules):
```ts
it("lands a log made offline, dated when it was made, with the device's id", ...)
// entry POST /salsa/exercises/<id>?/done madeAt = yesterday 10:00, minted {sets:[slot*2**32+1]} → the set row has that id, at === madeAt, its day yesterday's
it('answers landed for a resent entry without running it', ...)  // push twice → one sets row, both results 'landed'
it("mints a later entry's ids after an earlier one was refused", ...)
it('holds an entry that uses a row a refused one made', ...)     // A creates a drill (stale epoch), B logs on it → B held by A, no row
it('refuses another epoch as stale', ...)
it('refuses a network-only action and ids outside the slot', ...)
it("keeps the server's newer notes on an own figure and takes the entry's name", ...)
it("refuses a group's lesson changed meanwhile as a clash, and the next entry carries on", ...)
it('logs a replayed group change with the real actor at the made-at time', ...) // team_changes.at === madeAt, actor_id u1
it('suffixes a move name another device took first', ...)       // two entries create "Basic" → "Basic", "Basic (2)"
it("clamps a made-at from the future to the push's time", ...)   // RF2: madeAt now+1h → row at === now
it("replays with the entry's group-mode cookie, not the push's", ...) // RF4: the lesson lands in the group
it('flows the merged row to a copy kept in step, not the form', ...)
it('leaves no row behind when an entry throws', ...)
it('defers the rest when the gate is busy', ...)                 // gate with a long shared write, waitMs 10 → all 'deferred'
```
`push.spec.ts`:
```ts
it('refuses no session, a device token and a malformed body', ...) // 401, 401, 400
```

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/sync src/routes/api/sync`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS. Then `nix develop -c npx vitest run --maxWorkers=4 src/lib/server/changes.spec.ts src/lib/server/auto-add.spec.ts src/lib/server/clones/flow-hook.spec.ts src/lib/server/server-clock.spec.ts src/lib/server/db/ids.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "sync: replay and POST /api/sync/push"`

---

# Part B — the device records and drains

### Task 8: Capture triggers and the outbox store

**Files:**
- Create: `src/device/capture.ts`, `src/device/capture.spec.ts`, `src/device/outbox.ts`, `src/device/outbox.spec.ts`
- Modify:
  - `src/lib/offline/protocol.ts` (the types below);
  - `src/device/apply.ts`: `wipeCopy` leaves `outbox` alone; `applyPull` neither captures nor touches the outbox.

**Interfaces:**
- Consumes: Task 3 (`foldCaptured`, `heldBy`, `queuedMarks`, `bodyFields`, `toWire` inputs), `SYNCED`.
- Produces in `protocol.ts`:
```ts
export type OutboxSummary = {
	waiting: number;                  // waiting + sending
	oldestWaitingAt: number | null;   // made-at of the oldest of them
	refused: number;
	held: number;
	signedOut: boolean;
	lastSyncedAt: number | null;
	seq: number;                      // the newest entry's seq (0: none)
	queued: Record<string, number>;   // queuedMarks of waiting queued entries → their made-at
	epochs: number[];                 // distinct epochs of waiting entries
};
export type OutboxItem = {
	id: string; seq: number; state: 'waiting' | 'sending' | 'refused' | 'held';
	madeAt: number; url: string; label: EntryLabel;
	reason: RefusalReason | null; message: string | null;
	clash: ClashInfo | null; gone: GoneInfo | null;
	heldBy: string | null; dependents: number;
	fields: [string, string][];
};
```
- Produces in `capture.ts`:
```ts
export function captureTriggerSql(table: string, key: readonly string[], cols: readonly string[]): string[]; // <t>_cap_i, _u, _d
export function installCapture(db: SqliteDb): void;
export function startCapture(db: SqliteDb): void;
export function stopCapture(db: SqliteDb): CapturedRow[];  // folded; clears capture_rows and outbox_capture
```
- Produces in `outbox.ts`:
```ts
export type OutboxRow = { seq: number; id: string; userId: string; madeAt: number; epoch: number; cls: 'device' | 'queued';
	url: string; method: string; headers: [string, string][]; body: Uint8Array | null;
	minted: Record<string, number[]>; rows: CapturedRow[]; label: EntryLabel;
	state: 'waiting' | 'sending' | 'refused' | 'held'; reason: RefusalReason | null; message: string | null;
	clash: ClashInfo | null; gone: GoneInfo | null; heldBy: string | null };
export type NewEntry = Omit<OutboxRow, 'seq' | 'state' | 'reason' | 'message' | 'clash' | 'gone' | 'heldBy'>;
export function recordEntry(db: SqliteDb, e: NewEntry): number;
export function toSend(db: SqliteDb, userId: string): OutboxRow[];          // waiting, by seq, ≤ PUSH_BATCH and ≤ PUSH_MAX_BYTES (at least one)
export function setStates(db: SqliteDb, ids: string[], state: 'waiting' | 'sending'): void;
export function applyResults(db: SqliteDb, userId: string, results: EntryResult[]): { landed: number };
export function resetSending(db: SqliteDb): void;
export function outboxSummary(db: SqliteDb, userId: string | null): OutboxSummary;
export function outboxItems(db: SqliteDb, userId: string): Promise<OutboxItem[]>;
export function retryEntry(db: SqliteDb, userId: string, id: string): number;
export function discardEntry(db: SqliteDb, userId: string, id: string): number;
export function forgetPerson(db: SqliteDb, userId: string): void;
export function toWire(row: OutboxRow): WireEntry;
```
- **The device-only tables** (`installCapture`, `CREATE TABLE IF NOT EXISTS`):
  - `outbox`:
    - columns `seq integer primary key autoincrement`, `id text not null unique`, `user_id text not null`, `made_at integer not null`, `epoch integer not null`, `cls text not null`, `url text not null`, `method text not null`;
    - JSON columns `headers_json text not null`, `minted_json text not null`, `rows_json text not null`, `label_json text not null`;
    - `body blob`;
    - `state text not null`, `reason text`, `message text`, `detail_json text` (clash/gone), `held_by text`;
  - `capture_rows (n integer primary key autoincrement, tbl text not null, key text not null, op text not null, before_json text, after_json text)`;
  - `outbox_capture (on integer not null)`.
- **The triggers.** Each fires only `WHEN EXISTS (SELECT 1 FROM outbox_capture)`:
  - rows go in as `json_object('<col>', NEW.<col>, …)`;
  - the key is written as `triggerSql` writes it;
  - an update that changes the key logs `d` for the old key and `i` for the new.

  `installCapture` drops and recreates every `<t>_cap_*` in one transaction at each open, from `PRAGMA table_info`, so they always match the migrated columns.
- **Sending and its results:**
  - `applyResults`:
    - `landed` deletes the row;
    - `refused` stores the reason;
    - `held` sets `held_by`;
    - `deferred` goes back to `waiting`.

    Then it recomputes held over the person's entries (`heldBy`), so a waiting entry that depends on a refused one becomes `held` and is never sent.
  - `toSend` returns only `waiting`.
  - `retryEntry` turns the refused entry and the ones held by it back to `waiting`.
  - `discardEntry` deletes it and its held ones, and returns how many in all.
  - `forgetPerson` deletes every entry of that person.
  - `outboxSummary` reads `lastSyncedAt` and `signedOut` from `device_meta`.
- **What the person counts.** Every query takes `userId`: another person's entries are kept aside, never counted, listed or sent.

- [ ] **Step 1: Write the failing tests** (better-sqlite3, `migrateDevice(repoMigrations())`, `installCapture`).

`capture.spec.ts`:
```ts
it('captures an insert, an update and a delete with before and after', ...)
it('captures nothing while no write runs', ...)                 // applyPull of a pull fixture → capture_rows empty
it("rebuilds its triggers to the table's columns at every open", ...)
it('folds what one write did to a row', ...)
```
`outbox.spec.ts`:
```ts
it('keeps entries in order and sends at most a batch', ...)
it('drops landed entries, keeps refused ones with their reason, and holds what depends on them', ...)
it('retry sends a refused entry and its held ones again', ...)
it('discard removes it with its held ones and says how many', ...)
it("keeps another person's entries aside: never counted, listed or sent", ...)
it('a sending entry goes back to waiting after a restart', ...)
it('marks queued things until their entry lands', ...)          // summary.queued has 'songs:<id>' with its made-at
it('lists an entry with its label, reason and what was typed', ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/device/capture.spec.ts src/device/outbox.spec.ts src/device/apply.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `capture.ts`'s header says why these tables are device-only and why their keys don't mint.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "device: capture triggers and the outbox"`

---

### Task 9: The device runs writes

**Files:**
- Create: `src/lib/epoch.ts`
- Modify:
  - `src/lib/page-epoch.ts` (re-exports `PAGE_EPOCH` from `./epoch`);
  - `src/device/core.ts`, `src/device/core.spec.ts`;
  - `src/device/request.ts` and its spec.

**Interfaces:**
- Consumes: Tasks 3, 4 and 8; `ownerOf`, `writeClass`.
- Produces:
  - **`DeviceDeps`** gains:
    - `epoch: number` (`PAGE_EPOCH`);
    - `newId: () => string` (`crypto.randomUUID`);
    - `onRecorded: () => void` (the worker posts the summary and pushes soon).
  - **`DeviceRuntime`** gains `slot: number | null`. `serve()` sets it from the meta.
  - **`Device.answer(wire, person)`** now takes writes too: GET as today, anything else through `write`.
  - **The `WireRequest.body`** of a write carries its bytes.
  - **`deviceHeaders(wire, cookies, userAgent, origin?)`** sets `origin` when given.
  - **`DeviceRequest`** passes the wire's `content-type` to the base `Request` as well, so `formData()` can parse.
  - **`thingName(db: SqliteDb, action: string, rows: CapturedRow[]): string | null`:**
    - for `done`, the drill's `name` (its `sets` row's `exercise_id`);
    - otherwise the labelled row's `name`, `title` or `label`;
    - otherwise its parent's (`OWNERS` `via`).
- **A write, in order.** Writes run one at a time, through one `exclusive` queue that `applyPull` and the outbox's own changes share; reads are not queued.
  1. **Fall back** unless every one of these holds:
     - the state is `ready`;
     - `runtime.slot !== null`;
     - the page's person is the copy's (as reads);
     - `writeClass` is `device` or `queued`;
     - the `x-page-epoch` header equals `deps.epoch`.
  2. `madeAt = deps.now()`; the marks: `SELECT tbl, hi FROM id_marks WHERE slot = ?`.
  3. `BEGIN`, `startCapture`.
  4. `respond(new DeviceRequest(url, { method, body }, deviceHeaders(..., url.origin)))`, and read its body whole.
  5. `rows = stopCapture(db)`.
  6. **Did it land?**
     - An action (`x-sveltekit-action`) landed when its JSON `type` is `success` or `redirect`.
     - Anything else landed when the status is < 400.
     - **Not landed:** `ROLLBACK`.
       - Status ≥ 500, or an action `error` with status ≥ 500: fall back (`'the device failed'`).
       - Otherwise answer the response as it is: the person sees the refusal as online.
  7. **Landed, nothing captured:** `ROLLBACK`. Online, fall back (`'nothing on the device'`); offline, answer the response.
  8. **Landed, online, and any captured row's `ownerOf` is `team` or `unknown`:** `ROLLBACK`, fall back (`'group-online'`).
  9. **Otherwise:**
     1. `recordEntry`:
        - `id: deps.newId()`, `cls` from step 1, `madeAt`, `epoch: deps.epoch`;
        - `headers`: the `RECORDED_HEADERS`, `cookie` from the copy's cookies;
        - the body;
        - `minted: mintedIn(rows, slot, marks)`, `rows`;
        - `label: entryLabel(action, rows, thingName(...))`.
     2. `COMMIT`, then `deps.onRecorded()`.
     3. Answer with the header `x-salsa-outbox: <seq>` added.
  10. **Any throw:** `ROLLBACK` if a transaction is open, and fall back.
- **Fallbacks** reach the service worker as `WireFallback` with the reason (Task 12 decides network or "Needs a connection").

- [ ] **Step 1: Write the failing tests** in `core.spec.ts`:
  - The responder is `actionRunner` (Task 7) over the device database, with `$lib/server/db`'s `getDb` mocked to it.
  - It runs on `migrateDevice` + `installCapture` + `applyPull` of u1's world.
  - Its slot is 5, its epoch `PAGE_EPOCH`.
```ts
it('answers a log from the device at once and records one entry with its id and made-at', ...)
// sets row id === 5*2**32 + n; entry.minted.sets === [that id]; entry.madeAt === now(); answer has x-salsa-outbox
it('records nothing and answers the refusal when the action refuses', ...) // fail(400) → same JSON, no entry, no row
it('falls back and keeps nothing when the action throws', ...)
it("sends a group's row to the network while online, and records it offline", ...)
it('falls back for a network-only write, and before the device has a slot', ...)
it('falls back for a page of another epoch', ...)
it('runs a multipart form action on the device', ...)            // RF5: FormData body, content-type with boundary → lands
it('runs writes one at a time, their captures apart', ...)
it("labels a log with its drill's name", ...)                    // label { kind: 'log', thing: 'Enchufla drill' }
it('online, a write that changed nothing on the device goes to the network', ...)
```
`request.spec.ts`: `it('parses a multipart body through its own content type', ...)`.

- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/device`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "device: writes run on the device first and go in the outbox"`

---

### Task 10: Push, then pull; sign-in and person rules

**Files:**
- Modify: `src/device/core.ts`, `src/device/core.spec.ts`

**Interfaces:**
- Consumes: Task 8's outbox store; `PushResponse`.
- Produces:
  - **`DeviceDeps`** gains `fetchPush: (body: string) => Promise<Response>`.
  - **`Device`** gains:
    - `sync(): Promise<'synced' | 'waiting' | 'offline' | 'signed-out'>`. `pull` stays as the name the page uses; it calls `sync`;
    - `summary(): OutboxSummary`;
    - `outboxList(): Promise<OutboxItem[]>`;
    - `retry(id: string): Promise<number>`;
    - `discard(id: string): Promise<number>`;
    - `forget(): Promise<void>`.
  - **`DeviceOut`** gains `{ type: 'outbox'; summary: OutboxSummary }`, posted after every change to the outbox or its meta; `pulled` gains `landed: number`.
- **Rules:**
  - **`sync`** runs one at a time (`oneAtATime`).
    1. **Push** while `toSend` is not empty:
       1. `setStates(sending)`;
       2. `fetchPush(JSON.stringify({ device, entries: rows.map(toWire) }))`.
       3. By the answer:
          - a rejection, or a 5xx → `resetSending`, `'offline'`;
          - 401 → `resetSending`, `signedOut = '1'` in `device_meta`, `'signed-out'`;
          - 200 → `applyResults`, `signedOut = '0'`, and loop.
    2. Then, with nothing `waiting` or `sending`, **pull** as today, with two changes:
       - Applying runs in the exclusive queue, and first re-checks the outbox. If an entry was recorded while the answer was on its way, the answer is dropped, not applied, and `sync` pushes again once (RF1).
       - A 401 sets `signedOut` and keeps the copy and the outbox (no `wipeCopy`).
    3. After a pull that applied with nothing waiting: `lastSyncedAt = deps.now()`.
  - **`person(null)`** never wipes. The copy stays and answers no page until a page of its person says so.
  - **`person(other)`** wipes the copy as today. The outbox stays: the first person's entries wait for them.
  - **`forget()`:** `wipeCopy` + `forgetPerson(copy's user)`, then the state is `empty`.
  - **`start()`:** `resetSending` first; then as today, with `sync` in place of `pull`.

- [ ] **Step 1: Write the failing tests** in `core.spec.ts`, with a fake `fetchPush` whose results the test sets:
```ts
it('pushes waiting entries, then pulls', ...)
it('never pulls while an entry waits', ...)
it('drops a pull answer when a write was recorded meanwhile', ...)  // RF1: write lands between fetchPull and its answer → copy keeps the write, a second push follows
it('keeps the copy and the outbox on a 401, and says sign in', ...)
it('a signed-out page never wipes the copy', ...)
it("another person gets an empty copy; the first person's entries wait for them", ...)
it("forget wipes the copy and that person's entries", ...)
it('a refused entry stays, and what depends on it is held and never sent', ...)
it('a lost answer resends the same entry ids', ...)
it('retry resends; discard removes and pulls', ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/device/core.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "device: push before pull; a 401 or signing out never loses a change"`

---

### Task 11: The worker's wiring

**Files:**
- Modify: `src/lib/offline/protocol.ts`, `src/device/worker.ts`

**Interfaces:**
- Produces in `protocol.ts`:
```ts
export type DeviceIn =
	| { type: 'device-fetch'; request: WireRequest; person?: string | null }   // reads and writes
	| { type: 'pull' }                                                          // sync: push, then pull
	| { type: 'person'; userId: string | null }
	| { type: 'outbox-list' } | { type: 'retry'; id: string } | { type: 'discard'; id: string }
	| { type: 'sync-now' } | { type: 'forget' };                               // each of these five carries a reply port
export type DeviceOut =
	| { type: 'state'; state: DeviceState }
	| { type: 'pulled'; cursor: number; startedAt: number; landed: number }
	| { type: 'outbox'; summary: OutboxSummary };
```
- **Rules in `worker.ts`:**
  - **`open`:**
    - `installCapture` after `migrateDevice`, in the same `migrate` step;
    - `ensureDeviceKey(db, () => crypto.randomUUID())`;
    - `fetchPush` POSTs `/api/sync/push` as `fetchPull` does;
    - `epoch: PAGE_EPOCH` from `$lib/epoch`;
    - `newId: () => crypto.randomUUID()`.
  - **`onRecorded`:** post the summary, and `sync` after 300 ms (debounced).
  - **When to sync:**
    - the worker's own `online` event;
    - `PUSH_RETRY_MS` after a sync that ended `'offline'` while `navigator.onLine`.
  - **The reply-port messages:**
    - `outbox-list` → `OutboxItem[]`;
    - `retry` and `discard` → `number`;
    - `sync-now` → `OutboxSummary` after `sync`;
    - `forget` → `true`.

    Each answers on its port, or with `null` when no device is open.
  - **`device-fetch`** keeps transferring the answer's body.

- [ ] **Step 1: Type-check and build.** `nix develop -c npm run check:types`, then `nix develop -c sh -c "npx vite build && npx vite build -c vite.device.config.ts && node scripts/check-device-build.mjs"`. Expected: 0 errors; the device bundle under 1.5 MB gzipped, one `.wasm`.
- [ ] **Step 2: Run the device specs again.** `nix develop -c npx vitest run --maxWorkers=4 src/device`. Expected: PASS.
- [ ] **Step 3: Commit** — `git commit -m "device: the worker wires writes, the outbox and push"`

---

# Part C — the service worker and the page

### Task 12: The service worker routes writes to the device

**Files:**
- Modify: `src/lib/offline/sw-route.ts`, `src/lib/offline/sw-route.spec.ts`, `src/service-worker.ts`

**Interfaces:**
- Consumes: `writeClass` (Task 4), `OUTBOX_HEADER` (Task 3), `PAGE_EPOCH` (`$lib/epoch`), the `SwIn` additions below.
- Produces:
```ts
// SwIn: device-state gains the outbox; a new message
| { type: 'device-state'; state: DeviceState | 'off'; unpulledSince: number | null; waiting: number; outboxSeq: number }
| { type: 'outbox'; waiting: number; epochs: number[] }
// DeviceClients
setState(id, state, unpulledSince, waiting?: number, outboxSeq?: number): void;
wrote(id: string, seq: number): void;            // a device write answered with x-salsa-outbox
readsFromDevice(id: string): boolean;           // waiting > 0, or a write newer than the last state's outboxSeq
writesToDevice(id: string): boolean;            // false only for a known state other than ready
// pure
export const OUTBOX_STATE_CACHE = 'outbox-state';
export function holdsUpdate(epochs: readonly number[], current: number, online: boolean): boolean; // online && epochs.some(e => e < current)
```
- **Rules in `service-worker.ts`:**
  - **`swRoute`** stays as it is, with `/api/sync/push` `pass` beside the pull.
  - **`write`:**
    1. `cls = writeClass(method, url)`. When it is `device` or `queued` and `devices.writesToDevice(clientId)`: send `request.clone()`'s bytes through `viaDevice` (the wire now carries the body).
       - A `WireResponse` is answered. Its `x-salsa-outbox` calls `devices.wrote`, and no `changed` is posted.
       - A fallback goes on to step 2.
    2. Phase 2's network write, unchanged ("Needs a connection" offline).
  - **`device-read`:**
    - when `readsFromDevice(clientId)`, the device first, then the network on a fallback;
    - otherwise as today.
  - **`navigate`:** with a cached shell and the persisted state's `waiting > 0`, the shell at once. The device draws what the server does not have yet.
  - **`message`:**
    - `device-state` also writes `{ waiting, epochs }` to `OUTBOX_STATE_CACHE` (`/__outbox-state`);
    - so does `outbox`. Then a waiting worker of this script whose install held (a module flag) calls `skipWaiting()` once `!holdsUpdate(...)`.
  - **`install`:** `skipWaiting()` only when `!holdsUpdate(persisted epochs, PAGE_EPOCH, navigator.onLine)`.
  - **`cachesToDelete`** never sees `outbox-state`: it has no `salsa-` prefix.

- [ ] **Step 1: Write the failing tests** in `sw-route.spec.ts`:
```ts
it('reads from the device while its outbox waits, online too', ...)
it('keeps reading from the device after a device write until a state carries that entry', ...)
it('tries the device for a write when it knows nothing of the page', ...)   // RF3: new DeviceClients → writesToDevice(id) true
it('never sends a write to a device that is waiting or failed', ...)
it('holds an update only for older entries, and only online', ...)
it('passes the push', ...)
it('never deletes the outbox state cache', ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/offline/sw-route.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `sw-route.ts`, then `service-worker.ts`.
- [ ] **Step 4: Run them, then type-check.** Same command, then `nix develop -c npm run check:types`. Expected: PASS, 0 errors.
- [ ] **Step 5: Commit** — `git commit -m "offline: the service worker sends writes to the device first"`

---

### Task 13: The page side, the relay, and the status's rules

**Files:**
- Create:
  - `src/lib/offline/relay.ts`, `relay.spec.ts`;
  - `src/lib/offline/connection.svelte.ts`;
  - `src/lib/sync/status.ts`, `status.spec.ts`.
- Modify: `src/lib/offline/device.svelte.ts`

**Interfaces:**
- Produces:
```ts
// status.ts (PURE)
export const WAITING_GRACE_MS = 2000;
export type SyncStatus = { kind: 'none' } | { kind: 'waiting'; count: number } | { kind: 'refused'; count: number } | { kind: 'signin' };
export function syncStatus(s: OutboxSummary | null, now: number): SyncStatus;   // refused > signin > waiting (only once oldestWaitingAt + grace ≤ now) > none
export function graceEndsAt(s: OutboxSummary | null, now: number): number | null; // when 'waiting' would start showing, if later than now
export function waitingMark(s: OutboxSummary | null, table: string, key: string | number, now: number): boolean; // queued[`${table}:${key}`] + grace ≤ now
// relay.ts
export const RELAY_LIMIT_MS = 15_000;
export type RelayMessage =
	| { type: 'relay-ask'; id: string; from: string; message: DeviceIn; body?: ArrayBuffer }
	| { type: 'relay-answer'; id: string; to: string; answer: unknown }
	| { type: 'relay-state'; from: string; state: DeviceState; summary: OutboxSummary | null };
export function createRelay(o: {
	channel: Pick<BroadcastChannel, 'postMessage' | 'addEventListener' | 'close'>;
	self: string;                                             // this tab's id
	answer: (m: DeviceIn) => Promise<unknown> | null;          // null: this tab does not own the copy
	limitMs?: number;
}): { ask(m: DeviceIn): Promise<unknown | null>; announce(state: DeviceState, summary: OutboxSummary | null): void; owner(): { state: DeviceState; summary: OutboxSummary | null } | null; close(): void };
// connection.svelte.ts
export const connection: { online: boolean };   // $state, from navigator.onLine and the online/offline events
// device.svelte.ts additions
export const sync: { summary: OutboxSummary | null; now: number };   // $state; `now` bumps at graceEndsAt
export function syncNow(): Promise<OutboxSummary | null>;
export function outboxList(): Promise<OutboxItem[]>;
export function retryEntry(id: string): Promise<number>;
export function discardEntry(id: string): Promise<number>;
/** Pushes what it can, then how many changes would be lost (waiting + refused + held). */
export function unsyncedBeforeSignOut(): Promise<number>;
export function forgetCopy(): Promise<void>;
```
- **Rules in `device.svelte.ts`:**
  - **The relay:**
    - The page opens `new BroadcastChannel('salsa-device')`.
    - It answers relayed asks only while its own worker is `ready`.
    - It asks through the relay while its own worker is `waiting`:
      - reads, writes, the Sync page calls;
      - a write's body travels as `body`, and the owner rebuilds the wire.
  - **The state this page shows:** its own, or the owner's (`owner()`) while its own is `waiting`. `device.state` and `sync.summary` follow that.
  - **`outbox` from the worker:**
    1. set `sync.summary`;
    2. `announce`;
    3. post `{ type: 'outbox', waiting, epochs }` to `controller` and to `registration.waiting`;
    4. re-send `device-state`, now with `waiting` and `outboxSeq`;
    5. schedule `sync.now = Date.now()` at `graceEndsAt`.
  - **`pulled` with `landed > 0`** and a page drawn by the server while entries waited: `refreshWhenSettled()`.
  - **`window.__device`** gains `outbox: OutboxSummary | null`, for the walk.
  - **`unsyncedBeforeSignOut`** asks `sync-now`, then counts. Without a device it is 0.
  - **`forgetCopy`** asks `forget`.

- [ ] **Step 1: Write the failing tests.**

`status.spec.ts`:
```ts
it('says nothing while all is synced', ...)
it('waits 2 s before saying "waiting"', ...)                     // oldest 1000, now 2999 → none; 3000 → waiting
it("says couldn't sync over waiting, and sign in over waiting", ...)
it('marks a queued thing only after the grace', ...)
```
`relay.spec.ts` (Node's `BroadcastChannel`):
```ts
it("brings a second tab's ask to the owner's device and the answer back", ...)
it('gives up after the limit when no tab owns the copy', ...)
it('ignores an answer meant for another tab', ...)
it("hands the owner's state and summary to the other tabs", ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/sync/status.spec.ts src/lib/offline/relay.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, `device.svelte.ts` included.
- [ ] **Step 4: Run them, then type-check.** Expected: PASS, 0 errors.
- [ ] **Step 5: Commit** — `git commit -m "offline: the page knows the outbox; a second tab reaches the device through a relay"`

---

# Part D — what the person sees

### Task 14: The words

**Files:**
- Create: `src/lib/i18n/en/sync.ts`, `src/lib/i18n/sl/sync.ts`, `src/lib/sync/view.ts`, `src/lib/sync/view.spec.ts`, `src/lib/sync/resolve.ts`, `src/lib/sync/resolve.spec.ts`
- Modify:
  - `src/lib/i18n/en/index.ts` and `src/lib/i18n/sl/index.ts` (the `sync` area; glossary line `sync (the device's changes reaching the server) → sinhronizacija`);
  - `src/lib/i18n/en/shell.ts`, `src/lib/i18n/sl/shell.ts` (`offline.needsConnectionFor`).

**Interfaces:**
- Produces:
```ts
// view.ts (client-safe; reads t() at call time)
export function statusText(s: SyncStatus): string | null;
export function labelText(label: EntryLabel, madeAt: number, tz: string): string;
export function reasonText(item: Pick<OutboxItem, 'reason' | 'message' | 'clash' | 'state'>): string;
export function lastSyncedText(at: number | null, now: number, tz: string): string;
export function discardQuestion(dependents: number): { title: string; body: string };
export function signOutQuestion(n: number): { title: string; body: string; confirm: string };
// resolve.ts (PURE): a clash resolved from the Sync page
export function resendFields(fields: [string, string][], values: Record<string, string>, current: Seen): [string, string][]; // values over fields, seen = JSON of current
```
- **Words** (en | sl):

| Key | en | sl |
|---|---|---|
| `sync.title` | `Sync` | `Sinhronizacija` |
| `sync.status.waiting(n)` | `` `${n} waiting` `` | `` `${n} v čakanju` `` |
| `sync.status.refused(n)` | `` `${n} couldn't sync` `` | `` `Ni sinhronizirano: ${n}` `` |
| `sync.status.signIn` | `Sign in to sync` | `Prijavite se za sinhronizacijo` |
| `sync.refusedHeading` | `Couldn't sync` | `Ni sinhronizirano` |
| `sync.waitingHeading` | `Waiting` | `V čakanju` |
| `sync.retry` / `sync.discard` / `sync.compare` | `Retry` / `Discard` / `Compare` | `Poskusi znova` / `Zavrzi` / `Primerjaj` |
| `sync.discardTitle` | `Discard this change?` | `Želite zavreči to spremembo?` |
| `sync.discardBody` | `It was never saved on the server.` | `Na strežniku ni bila nikoli shranjena.` |
| `sync.discardMore(n)` | `` `The ${n} changes waiting for it go too.` `` (1: `The change waiting for it goes too.`) | `` `Zavržejo se tudi spremembe, ki čakajo nanjo (${n}).` `` |
| `sync.held` | `Waits for the change above` | `Čaka na spremembo zgoraj` |
| `sync.lastSynced(when)` | `` `Last synced ${when}` `` | `` `Zadnja sinhronizacija: ${when}` `` |
| `sync.never` | `Not synced yet` | `Še ni sinhronizirano` |
| `sync.tryNow` | `Try now` | `Poskusi zdaj` |
| `sync.allSynced` | `Everything is synced.` | `Vse je sinhronizirano.` |
| `sync.signIn` | `Sign in` | `Prijava` |
| `sync.waitingBadge` | `Waiting` | `Čaka` |
| `sync.reason.gone` | `It was archived or deleted meanwhile.` | `Medtem je bilo arhivirano ali izbrisano.` |
| `sync.reason.clash(by)` | `` by ? `${by} changed it meanwhile.` : 'Someone changed it meanwhile.' `` | `` by ? `Medtem spremenjeno · ${by}` : 'Medtem je nekdo spremenil.' `` |
| `sync.reason.stale` | `The app was updated since.` | `Aplikacija je bila medtem posodobljena.` |
| `sync.reason.access` | `You can no longer change it.` | `Tega ne morete več spreminjati.` |
| `sync.reason.error` | `The server could not save it.` | `Strežnik tega ni mogel shraniti.` |
| `sync.reason.notAllowed` | `It needs a connection.` | `Potrebna je povezava.` |
| `sync.reason.badIds` | `It doesn't fit what the server has.` | `Ne ujema se s strežnikom.` |
| `sync.label.log(thing, when)` | `` `Log · ${thing} · ${when}` `` | `` `Vnos · ${thing} · ${when}` `` |
| `sync.label.note(thing)` | `` `Note on ${thing}` `` | `` `Opomba · ${thing}` `` |
| `sync.label.name(thing)` | `` `Name of ${thing}` `` | `` `Ime · ${thing}` `` |
| `sync.label.new(thing)` | `` `New · ${thing}` `` | `` `Novo · ${thing}` `` |
| `sync.label.removed(thing)` | `` `Removed · ${thing}` `` | `` `Odstranjeno · ${thing}` `` |
| `sync.label.edit(thing)` | `` `Change to ${thing}` `` | `` `Sprememba · ${thing}` `` |
| `sync.label.comment(thing)` | `` `Comment on ${thing}` `` | `` `Komentar · ${thing}` `` |
| `sync.label.heart` | `A heart on a comment` | `Srček na komentarju` |
| `sync.label.other` | `A change` | `Sprememba` |
| `sync.signOut.title(n)` | `` n === 1 ? "1 change hasn't synced" : `${n} changes haven't synced` `` | `` `Nesinhronizirane spremembe: ${n}` `` |
| `sync.signOut.body` | `Sign out and lose them?` | `Se želite odjaviti in jih izgubiti?` |
| `sync.signOut.confirm` | `Sign out` | `Odjava` |
| `shell.offline.needsConnectionFor` | `Needs a connection for these` | `Za te je potrebna povezava` |

- **`labelText`:**
  - `when` is `` `${weekdayShort(localDay(madeAt, tz))} ${timeOfDay(madeAt, tz)}` ``, giving "Log · Enchufla drill · Tue 10:04";
  - a missing thing falls back to `sync.label.other`.
- **`lastSyncedText`:** today → the time alone; another day → weekday and time; null → `sync.never`.
- **`reasonText`:** `refused` with a message → the server's message itself; `held` → `sync.held`.

- [ ] **Step 1: Write the failing tests.**

`view.spec.ts`:
```ts
it('says a log as "Log · Enchufla drill · Tue 10:04"', ...)       // withLocale('en')
it('says a note, a name, and a change with no name', ...)
it("says why, in the server's own words for a plain refusal", ...)
it('says last synced as a time today and a weekday before', ...)
it('asks before discarding, counting what waits on it', ...)
it('speaks Slovenian with the name after a "·"', ...)            // withLocale('sl'): reasonText clash by 'Luka' === 'Medtem spremenjeno · Luka'
```
`resolve.spec.ts`:
```ts
it("puts the person's values over the sent fields and the current version as seen", ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/sync src/lib/i18n`. Expected: FAIL (`i18n.spec.ts` too, until both catalogs agree).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "sync: the words, in English and Slovenian"`

---

### Task 15: The band status (1D) and the Waiting badge (3B)

**Files:**
- Create: `src/lib/components/system/SyncStatus.svelte`, `src/lib/components/ui/WaitingBadge.svelte`
- Modify:
  - `src/lib/components/shell/BandHeader.svelte`;
  - `src/lib/components/comments/CommentItem.svelte`;
  - `src/lib/components/songs/SongRow.svelte`;
  - `src/lib/components/lessons/LessonRow.svelte`;
  - `src/routes/[dance]/lessons/[id]/+page.svelte` (beside its Draft badge);
  - `src/lib/components/figures/LinkRow.svelte`, `src/lib/components/links/YouTubeCard.svelte`;
  - `src/routes/dev/kit/+page.svelte` (both components, every state).

**Interfaces:**
- Consumes: `sync`, `syncStatus`, `waitingMark`, `statusText` (Tasks 13–14).
- Produces:
  - `<SyncStatus subtitle={string | undefined} />`;
  - `<WaitingBadge table={string} id={string | number} />`.
- **Rules:**
  - **Where the status shows:** `BandHeader` draws the subtitle line through `SyncStatus` when `variant === 'band'`: the phone's band, and the desktop's band row, the list's `deskOnly` row included. Never in a pane's or a card's header.
  - **What `SyncStatus` draws:**
    - `none` → the subtitle as today, nothing extra;
    - `waiting` → the subtitle, then `` ` · ${statusText}` `` as a link to `/${dance}/sync`, in `text-band-small`;
    - `refused` and `signin` → the pill in place of the subtitle: a link to `/${dance}/sync` drawn as `Badge tone="danger" solid`, with "›" after the words.
  - **The dance** comes from `page.params.dance`. With no dance (a shared page), `/settings` has no Sync page, so the status links to `/${user's dance}/sync` from `page.data.user.dance`.
  - **`WaitingBadge`** draws `<Badge tone="warn">{t().sync.waitingBadge}</Badge>`, as Draft is drawn, while `waitingMark(sync.summary, table, id, sync.now)`. Its places:
    - `CommentItem`: `lesson_comments`, the comment's id, which covers its hearts;
    - `SongRow`: `songs`;
    - `LessonRow` and the lesson page: `lessons`;
    - `LinkRow` and `YouTubeCard`: `links`.

- [ ] **Step 1: Type-check, lint, and the specs these files have.** `nix develop -c npm run check:types`; `nix develop -c npx vitest run --maxWorkers=4 src/lib/components src/lib/i18n/no-english.spec.ts src/lib/nav/bands.spec.ts`. Expected: 0 errors, PASS.
- [ ] **Step 2: Look at it.** `nix develop -c npm run dev`, then open `/dev/kit` at 390 px and 1280 px, in each of the four themes. Expected: the waiting line and the pill as the mockup 1D shows; the badge like Draft. Stop the dev server.
- [ ] **Step 3: Commit** — `git commit -m "sync: the band says what waits or couldn't sync; queued things say Waiting"`

---

### Task 16: The Sync page (2B)

**Files:**
- Create: `src/routes/[dance]/sync/+page.svelte`, `src/lib/components/sync/SyncEntry.svelte`
- Modify: `scripts/shots/pages.txt` (`/{dance}/sync`)

**Interfaces:**
- Consumes: `outboxList`, `retryEntry`, `discardEntry`, `syncNow`, `sync` (Task 13); the view words (Task 14); `resendFields` (Task 14); `clashPrompt` and `ClashAsk` (`$lib/unsaved/guard.svelte`); `clashView`, `fieldLabel` (`$lib/clash/clash`); `ui/Dialog.svelte` (`tone="danger"`); `Screen`.
- **The page:**
  - `Screen` with the title `t().sync.title`. No server load: the layouts' data comes from the device as for any page.
  - On mount, and on every `sync.summary` change: `items = await outboxList()`.
  - **Couldn't sync** first: refused items, each followed by the items it holds, indented.
  - **Waiting** below: waiting and sending, oldest first.
  - **The foot:** `lastSyncedText(...) · ` then a "Try now" button (`syncNow()`). While it runs: a `Spinner`, and the button disabled.
  - **Nothing at all:** `t().sync.allSynced`, with the same foot.
  - **`signedOut`:** a `Banner` with `t().sync.status.signIn` and a "Sign in" link to `/login?next=/${dance}/sync`.
- **`SyncEntry`:**
  - **What it shows:**
    - `labelText` as the title;
    - `reasonText` under it (danger tone for refused);
    - the typed fields as `fieldLabel(key): value` lines, folded to two lines with a "More" toggle.
  - **Refused, not a clash:**
    - Retry → `retryEntry(id)`;
    - Discard → the danger `Dialog` with `discardQuestion(dependents)` → `discardEntry(id)` → `focusAfterRemoval`.
  - **A clash:**
    - Compare replaces Retry. It sets `clashPrompt.ask` to a `ClashAsk` built with `clashView(item.clash, values from item.fields, seen from item.fields, () => 'text')`.
    - Its `mine(values)` POSTs `resendFields(...)` to the entry's URL with `x-sveltekit-action` and `accept: application/json`, as `sendAt` does in `$lib/act.ts`. On a `success` or `redirect` it calls `discardEntry(id)`; any other result goes on the page's toast.
    - Its `theirs()` calls `discardEntry(id)`.
  - **Gone:** what was typed shows in the `ClashAsk`'s `typed`, as the clash screen does for gone.

- [ ] **Step 1: Type-check, and the specs the page touches.** `nix develop -c npm run check:types`; `nix develop -c npx vitest run --maxWorkers=4 src/lib/nav src/lib/i18n/no-english.spec.ts`. Expected: 0 errors, PASS (`bands.spec.ts` finds the band).
- [ ] **Step 2: Look at it.** In a build (`scripts/offline/serve.sh` with a seeded db copy, Task 18's setup), at 390 px and 1280 px:
  - an empty Sync page says "Everything is synced.";
  - after an offline log, the Waiting section lists "Log · <drill> · <day time>".
- [ ] **Step 3: Commit** — `git commit -m "sync: the Sync page"`

---

### Task 17: Needs a connection (4B), and Sign out asks

**Files:**
- Create:
  - `src/lib/offline/needs-connection-action.ts`, `needs-connection-action.spec.ts`;
  - `src/lib/components/system/NeedsConnectionNote.svelte`.
- Modify:
  - **Menus:** `src/lib/menu.ts` (+ spec), `src/lib/clones/menu.ts` (+ spec), `src/lib/components/ui/MenuSheet.svelte`.
  - **Sheets** (the note at the top, the primary button disabled offline):
    - `src/lib/components/clones/CopyToSheet.svelte`, `MoveToSheet.svelte`, `DetachSheet.svelte`, `DropSheet.svelte`, `SyncSheet.svelte`, `MakeMineSheet.svelte`;
    - `src/lib/components/teams/LeaveSheet.svelte`, `CodeSheet.svelte`.
  - **Lone buttons and links** (`use:needsConnection`):
    - `src/lib/components/teams/ClassCodeField.svelte`;
    - in `src/routes/[dance]/groups/[id]/+page.svelte`: the People, Recently deleted and Storage links, and the Delete button;
    - every link to `/[dance]/groups/[id]/history/...`;
    - in `src/routes/settings/+page.svelte`: What uses space, Ask for more, Pair a phone, the theme and language choices, Sign out;
    - `src/lib/components/system/UpdateButton.svelte`.
  - `src/routes/settings/+page.svelte`: Sign out asks.

**Interfaces:**
- Consumes: `connection` (Task 13), `unsyncedBeforeSignOut`, `forgetCopy` (Task 13), `signOutQuestion` (Task 14).
- Produces:
```ts
// menu.ts
export type MenuItem = { /* as today */ network?: boolean };
export function offlineMenu(items: MenuItem[], online: boolean): { note: boolean; items: (MenuItem & { disabled: boolean })[] };
// needs-connection-action.ts
export const needsConnection: Action<HTMLElement, boolean | undefined>; // param: online (reactive)
```
- **Rules:**
  - **`cloneMenuItems`** sets `network: true` on `sync`, `copy`, `move`, `detach` and `drop`. `sameAs` stays device-first.
  - **`offlineMenu`:** `note` when offline and some item has `network`; offline, those items are `disabled`.
  - **`MenuSheet`:**
    - draws `NeedsConnectionNote` (`t().shell.offline.needsConnectionFor`, `text-muted`, an icon) once at the top;
    - gives disabled items `aria-disabled="true"` and `opacity-40`;
    - a tap on a disabled item does nothing.
  - **`needsConnection`**, while offline:
    - sets `aria-disabled="true"` and `data-offline`. The greying is a `[data-offline]` rule in `layout.css`, `opacity: .4`; no text colour is appended;
    - catches `click` and `submit` in the capture phase: `preventDefault`, then `window.dispatchEvent(new CustomEvent('salsa:needs-connection'))`. That is phase 2's toast and words.

    Online it removes both.
  - **Sign out:** the form's `onsubmit` prevents the submit, then:
    1. `n = await unsyncedBeforeSignOut()`.
    2. `n > 0` → the danger `Dialog` with `signOutQuestion(n)`. On confirm: `await forgetCopy()`, then `form.submit()`.
    3. `n === 0` → `await forgetCopy()`, then `form.submit()`.

    Offline the button is greyed by `use:needsConnection`.

- [ ] **Step 1: Write the failing tests.**

`menu.spec.ts`:
```ts
it('greys the items that need a connection, offline only, with one note', ...)
```
`clones/menu.spec.ts`:
```ts
it('marks Sync, Copy to, Move to, Detach and Drop as needing a connection', ...)
```
`needs-connection-action.spec.ts` (node; the repo has no DOM environment, so a fake element: an `EventTarget` with `setAttribute`/`removeAttribute` spies, and `window` stubbed with `vi.stubGlobal`):
```ts
it('offline, a tap toasts and goes nowhere', ...)               // click → defaultPrevented, event dispatched
it('online, it is an ordinary button', ...)
```
- [ ] **Step 2: Run them to see them fail.** `nix develop -c npx vitest run --maxWorkers=4 src/lib/menu.spec.ts src/lib/clones/menu.spec.ts src/lib/offline/needs-connection-action.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, including every component listed.
- [ ] **Step 4: Run them, type-check, and the class rules.** Same command, plus `src/lib/components/ui/class-rules.spec.ts` and `src/lib/i18n`; then `nix develop -c npm run check:types`. Expected: PASS, 0 errors.
- [ ] **Step 5: Commit** — `git commit -m "offline: Needs a connection once per sheet, a toast on a lone button; Sign out asks"`

---

# Part E — proof and docs

### Task 18: The walk proves offline writes land

**Files:**
- Modify: `scripts/offline/walk.py`, `scripts/offline/README.md`

**Interfaces:**
- Consumes: everything above; `window.__device.outbox` (Task 13); the relay switch the walk already has; `device_data` and `sets_count` in `walk.py`.
- **New checks.** Each prints `ok` or `FAIL <why>`.
  - **Step 4 ("Offline, a write") changes:**
    - The Done sheet now **closes**, saved on the device.
    - The page shows the log.
    - The server's copy still has no new `sets` row.
    - After 2.5 s the band's subtitle ends in "· 1 waiting".
    - It notes `madeAt` (from `window.__device`, via the `outboxList` call in `page.evaluate`) and the device's set id.
  - **7. Offline, an edit:** rename a figure. Its page shows the new name, and "· 2 waiting" shows.
  - **8. Back online:**
    1. Relay on, `set_offline(False)`.
    2. Wait until `window.__device.outbox.waiting === 0` and a pull landed (30 s cap). The band shows no "waiting".
    3. The server's db holds:
       - exactly one new `sets` row, whose `id` is the device's (`>= 2**32`) and whose `created_at`/day match `madeAt` (±1 s);
       - the figure's new name.
  - **9. No duplicates:** POST the same entry again to `/api/sync/push` from `page.evaluate`, with the stored wire entry. The result is `landed`, and the `sets` count is unchanged.
  - **10. Refused:**
    1. Offline, change a figure's notes.
    2. Archive that figure in the server's db (`UPDATE figures SET archived_at = …`).
    3. Online again: the band shows the pill "1 couldn't sync ›".
    4. Tap it: the Sync page lists "Note on <figure>" with "It was archived or deleted meanwhile.".
    5. Discard → the dialog → confirm → "Everything is synced.".
  - **11. Online, no nag:** a log made online never shows "waiting" in the 2 s after it (sampled every 200 ms), and it lands.
  - **12. Needs a connection:** offline, a figure's ⋯ menu shows the note and greys Copy to; the group's Join with a code field's button toasts.

- [ ] **Step 1: Write the checks; run the walk.** Start `scripts/offline/serve.sh <seeded db copy>` in the background, then `walk.py <port> <upstream> <db>` under the Playwright command in `scripts/offline/README.md`, memory-capped. Expected at first: some FAILs.
- [ ] **Step 2: Fix each FAIL at its cause, and rerun until the walk exits 0.** Each fix goes in its own commit, with a ledger line in the plan's appendix.
- [ ] **Step 3: Update the README** with checks 7–12.
- [ ] **Step 4: Commit** — `git commit -m "offline: the walk proves offline changes land once, dated and with their ids"`

---

### Task 19: Docs, and the full check

**Files:**
- Modify: `CLAUDE.md`, `docs/hard-rules.md`, `docs/layout.md`, `docs/features.md`, `docs/superpowers/specs/2026-11-07-offline-design.md`, `docs/superpowers/specs/2026-11-09-offline-phase-3-design.md`

**Steps:**
- [ ] **Step 1: `docs/hard-rules.md`.**
  - **Replace "The device answers only when the network fails, and only GETs"** with "**Writes run on the device first**". It says:
    - every action and endpoint write is classified in `routes.ts` (`ACTIONS`, `ENDPOINT_WRITES`), and `routes.spec.ts` fails on an unclassified one;
    - `device` and `queued` writes run on the device and replay via `/api/sync/push`;
    - a group's row online goes to the server;
    - reads come from the device while entries wait.
  - **Add "Replay reads the entry":**
    - `serverNow()` and `mintId` read the replay context (`replay-context.ts`);
    - own rows skip `seenRefusal` on replay (`SeenRule`) and merge per field (`merge.ts`);
    - flows are deferred until after the merge;
    - names on create and rename paths go through `replayName`;
    - a new uniqueness check does too.
  - **Add "The write gate":** every non-GET request holds `writeGate` shared, and a replay holds it alone.
  - **To the id rule's exceptions add:**
    - `device_slots.slot` (a slot, not a row id);
    - the device-only `outbox`, `capture_rows` and `outbox_capture`.
  - **Sign out wipes the copy only through the app's own Sign out**, after asking.
  - **A cookie-setting action is network-only.**
- [ ] **Step 2: CLAUDE.md** "Auth and walls", the offline bullet: the same in short, pointing at `docs/hard-rules.md`.
- [ ] **Step 3: `docs/layout.md`.** Every new module in the file structure above, and the changed lines for `src/lib/offline/`, `src/device/` and `src/service-worker.ts`.
- [ ] **Step 4: `docs/features.md`.** Offline phase 3 as live, linking the phase 3 spec.
- [ ] **Step 5: The specs.**
  - The main spec's phase 3 line under "Phases": what shipped, the migration (0043), the plan's path.
  - The phase 3 spec gets a short "Decided while building" section: the rulings in this plan's Global Constraints, plus the appendix's.
- [ ] **Step 6: Commit** — `git commit -m "docs: offline phase 3, changes made with no signal"`
- [ ] **Step 7: The full check.** `nix develop -c npm run check`. Expected: prettier, eslint, svelte-check, the build with the device check, and every test pass. Then the final review of the whole branch. Merge master in, run `npm run check` again, and only then merge, after asking the user.
- [ ] **Step 8: Ship, after asking the user.**
  1. Take the backup (`docs/deployment.md`).
  2. Try migration 0043 on a copy of the production backup.
  3. Deploy.
  4. Check 44 migrations applied.
  5. Ask the user to try it on the Android phone:
     - airplane mode, then a log on Today, a note on a figure, and a comment on a class lesson;
     - "· 3 waiting" shows, and each comment shows Waiting;
     - airplane mode off: the waiting count goes, the PC shows all three dated when they were made, nothing twice.

---

## Appendix: decided while building

(Filled during the build: one line per ruling, with what it costs if wrong; the deferred minors below it.)
