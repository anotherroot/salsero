# Offline phase 2: the device's copy, read only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app opens and reads with no signal, from a copy of the person's own rows kept on the device; anything that changes data offline says "Needs a connection" instead of today's whole-page offline screen.

**Architecture:** The server logs every change to the synced tables with triggers (`change_log`). A device pulls what changed since its cursor, filtered to what its person may read (`syncScope`, built on `access.ts`). Per-table digests of the key sets catch everything the log cannot see (a reach that shrank or grew, a deleted row), and those tables are resent whole. On the device, a dedicated worker runs SQLite WASM on OPFS and SvelteKit's own built `Server`, as the spike proved. A service worker sends every request to the network first, exactly as today, and only when the network fails does it answer: navigations with a cached client-rendered shell, reads from the device. Phase 2 is read-only: the device answers GETs only, and every write goes to the network.

**Tech Stack:** SvelteKit 2 (adapter-node), Drizzle on better-sqlite3 (server) and on a better-sqlite3 shim over `@sqlite.org/sqlite-wasm` (device), Vite lib mode for the device bundle, a SvelteKit service worker, Web Locks, vitest, Playwright for the offline walk.

**Spec:** `docs/superpowers/specs/2026-11-07-offline-design.md` (phase 2 of "Phases"). It is informed by `docs/superpowers/specs/2026-11-07-offline-spike-findings.md`, and builds on phase 1 (`docs/superpowers/plans/2026-11-08-offline-phase-1-ids-and-clock.md`, merged and deployed as master a388ecb).

**Spike code to carry over:** branch `offline-spike` (read it with `git show offline-spike:<path>`):
- `src/device/sqlite-shim.ts` and `sqlite-shim.spec.ts`;
- `src/device/node-stubs/*`;
- `vite.device.config.ts`;
- `vitest.device.config.ts` and `src/device/vitest-setup.ts`;
- `src/device/worker.ts`, `client.ts` and `protocol.ts`;
- `src/service-worker.ts`.

Carry the shim and the stubs over close to as they are. Rewrite the rest following this plan: each was written as a spike shortcut, and the findings list what to replace.

## Global Constraints

- **Online behaviour does not change.** Navigations, page data and actions reach the server first, as today. The device answers only when the network fails: a rejected fetch, a 502/503/504/520–530 answer, or no answer within `NETWORK_TIMEOUT_MS = 4000` while the device is ready.
- **Phase 2 is read-only on the device.** The device answers GETs only. A write that can't reach the server gets "Needs a connection" and changes nothing anywhere.
- **Production builds only.** `vite dev` registers no service worker and starts no device (`serviceWorker: { register: false }` in the SvelteKit options, and the page registers it itself when `!dev`).
- **The device never receives a row its person may not read** (spec anti-goal). Only rows in `syncScope(db, userId)` leave the server, redacted as Task 2 says. Log entries and digests are computed over scope only.
- **Never synced:**
  - from the spec: `sessions`, `login_attempts`, `invites`, `device_tokens`, `app_installs`, `storage_requests`, `team_trash`, `team_changes`, `clone_pairs`, `app_flags`, `id_marks`;
  - added since the spec: `clone_marks` (master's clone sync bookkeeping) and `change_log` (each database keeps its own).
- **Every schema table is classified** as synced or never synced in `src/lib/sync/tables.ts`. A spec fails on an unclassified table.
- **SQLite WASM:** `@sqlite.org/sqlite-wasm` at exactly `3.54.1-build1`, the `opfs-sahpool` VFS (no cross-origin isolation headers needed).
- **Device bundle:** under `build/client/_device/<version>/`, where `<version>` is SvelteKit's build version. It holds one `.wasm` and no `sqlite3-worker1*` file, and is at most **1.5 MB gzipped** in total (`scripts/check-device-build.mjs`).
- **The project's rules hold.** CLAUDE.md's hard rules apply to new code:
  - every new integer-id table mints its id (`change_log` keys on `seq`, not `id`: a log, never synced, so it is exempt, and CLAUDE.md says so);
  - server code reads the time through `serverNow()`;
  - specs never touch `$DATA_DIR`;
  - nothing under `$lib/server` is imported by components;
  - words go through `t()` in both catalogs (`src/lib/i18n/en`, `src/lib/i18n/sl`).
- **`PAGE_EPOCH` is not raised.** No form, action or API shape changes.
- **Memory on this machine:** run vitest with `--shard=i/4` or fewer parallel processes if runs are killed (exit 137/143). Never pipe endless input to a subagent.

## Review Focus

1. **A reach that shrinks** (a member leaves, is removed, or a lesson is archived): the next pull removes every row of that group the person no longer reads, though none of those rows changed. Pinned in Task 3 ("drops a left group's rows on the next pull").
2. **Another person signs in on the same browser:** the device never mixes two people's rows. The old copy is wiped before the new person's rows are applied. Pinned in Task 4 ("wipes before applying another person's pull").
3. **A device on an older build pulls from a newer server:** it is refused with `schema`, keeps its copy and keeps answering offline. After its update it migrates and does one full pull. Pinned in Task 3 ("refuses another schema") and Task 4 ("asks for everything after a migration").
4. **A whole-table replace or an upsert never cascades on the device:** replacing `figures` keeps every recording, and upserting a figure keeps its recordings. Pinned in Task 4 ("replacing a parent table keeps its children").
5. **A form sent offline inside a Sheet:** the result is a `failure`, not an `error`, so the sheet stays open with what was typed, and the toast shows. Pinned in Task 5 ("an offline action is a failure SvelteKit reads") and in the Task 8 walk ("send a form offline").

---

## File structure

```
src/lib/sync/            PURE, client-safe, shared by server, device and service worker
  tables.ts              SYNCED (table → key columns) and NEVER_SYNCED; no imports
  triggers.ts            triggerSql(table, key): the change-log triggers' SQL
  digest.ts              keyString(values), digestInput(keys)
  wire.ts                PullRequest, PullResponse, PullRefusal, TableRows
  schema-tag.ts          SCHEMA_TAG: the last migration's tag (drizzle/meta/_journal.json)
src/lib/server/sync/
  log.ts                 logHead, logOldest, changedSince, pruneChangeLog
  scope.ts               syncScope(db, userId): what this person may read, row by row, redacted
  pull.ts                pull(db, userId, req): the answer to one pull
src/lib/server/device-runtime.ts   deviceRuntime(), deviceUser(db, userId)
src/routes/api/sync/pull/+server.ts
src/routes/shell/+page.ts, +page.svelte   the client-rendered shell (ssr = false)
src/lib/offline/         client-safe
  routes.ts              PURE: which requests the device answers; the network-only routes
  sw-route.ts            PURE: what the service worker does with a request
  needs-connection.ts    PURE: the bodies the service worker answers an offline write with
  protocol.ts            the messages between the service worker, the page and the device worker
  device.svelte.ts       the page side: registers the SW, starts the worker, relays, state, pull triggers
src/device/              bundled for the device worker only (vite.device.config.ts)
  sqlite-shim.ts (+spec) from the spike
  node-stubs/            from the spike
  migrate.ts (+spec)     migrateDevice: the drizzle migrations on the device
  apply.ts (+spec)       applyPull, wipeCopy, readMeta, deviceDigests
  request.ts             DeviceRequest: a Request whose headers keep the copy's cookies
  worker.ts              the device worker
src/service-worker.ts
vite.device.config.ts, scripts/check-device-build.mjs, scripts/sync-triggers.ts
scripts/offline/serve.sh, scripts/offline/walk.py
drizzle/0039_*.sql (change_log), drizzle/0040_change_log_triggers.sql
```

---

### Task 1: The synced tables and the change log

**Files:**
- Create: `src/lib/sync/tables.ts`, `src/lib/sync/triggers.ts`, `scripts/sync-triggers.ts`, `src/lib/server/sync/log.ts`, `src/lib/sync/tables.spec.ts`, `src/lib/server/sync/log.spec.ts`
- Modify: `src/lib/server/db/schema.ts` (add `changeLog`), `src/lib/server/trash.ts` (`startTrashPurge` also prunes)
- Migrations: `npm run db:generate` → `drizzle/0039_*.sql` (the table); `npx drizzle-kit generate --custom --name=change_log_triggers` → `drizzle/0040_change_log_triggers.sql`, filled by `node scripts/sync-triggers.ts > drizzle/0040_change_log_triggers.sql` (Node 22 strips the types; add `--experimental-strip-types` if it asks)

**Interfaces:**
- Produces:
  - `SYNCED: Readonly<Record<string, readonly string[]>>`: table name → its key columns, in key order.
  - `NEVER_SYNCED: readonly string[]`.
  - `triggerSql(table: string, key: readonly string[]): string`.
  - `logHead(db): number`: `change_log`'s `sqlite_sequence` value, else 0.
  - `logOldest(db): number | null`: the lowest `seq` present.
  - `changedSince(db, cursor: number): { tbl: string; key: string }[]`: distinct pairs.
  - `pruneChangeLog(db, now: number): number`: deletes rows with `at < now - LOG_KEEP_MS`. `LOG_KEEP_MS = 30 * 24 * 3600_000`.

**Classification (rulings):**
- **Synced:** every table in the schema except the never-synced list, with its schema key:
  - `users` (`id`);
  - `today_picks`, `default_styles` (`user_id`, `dance`), `figure_groups`, `figures`, `recordings`, `positions`;
  - `figure_start_positions` and `figure_end_positions` (`figure_id`, `position_id`), `spot_position_links`, `lesson_positions`;
  - `routines`, `routine_steps`, `routine_step_options`;
  - `songs`, `song_drops`, `exercises`, `sets`, `lessons`, `lesson_videos`, `video_spots`, `spot_links`;
  - `lesson_figures`, `lesson_routines`, `lesson_exercises`, `links`, `song_links`, `video_downloads`, `count_takes`;
  - `teams`, `team_members`, `lesson_adds`, `lesson_comments`, `lesson_comment_hearts`, `opens`;
  - `clone_sync` (`kind`, `row_id`: Keep in step's toggle shows on pages);
  - `twins`.
- **Never synced:** as the Global Constraints list.

**`change_log` schema:**
- columns: `seq integer primary key autoincrement`, `tbl text not null`, `key text not null`, `op text not null` (enum `'i' | 'u' | 'd'`), `at integer not null`;
- no index.

**Trigger rules (`triggerSql`)** — four triggers per synced table, named `<t>_log_i`, `<t>_log_u`, `<t>_log_k` and `<t>_log_d`:
- **The key expression:**
  - one key column: `CAST(NEW.<k> AS TEXT)`;
  - several: `json_array(NEW.<a>, NEW.<b>, …)`;
  - `OLD.` for the old row.
- **Time:** `CAST(unixepoch('subsec') * 1000 AS INTEGER)`.
  - Ruling: a trigger can't call `serverNow()`. Phase 3's replay corrects `at` for the entries it writes.
- **`_i`:** AFTER INSERT logs NEW, `'i'`.
- **`_u`:** AFTER UPDATE logs NEW, `'u'`.
- **`_k`:** AFTER UPDATE `WHEN <old key> IS NOT <new key>` logs OLD, `'d'`. A repoint that changes a join row's key leaves no stale key behind.
- **`_d`:** AFTER DELETE logs OLD, `'d'`.
- Statements are joined with `--> statement-breakpoint`, and the file starts with a comment saying it is generated by `scripts/sync-triggers.ts` from `src/lib/sync/tables.ts`.

- [ ] **Step 1: Write the failing tests**

`src/lib/sync/tables.spec.ts`:
```ts
it('classifies every schema table exactly once', ...)
// set of getTableConfig(t).name over schema === SYNCED keys ∪ NEVER_SYNCED, disjoint
it("gives every synced table its schema's key, in key order", ...)
// single-column PK → [name]; composite → primaryKeys[0].columns names
it('migration 0040 is exactly what scripts/sync-triggers.ts writes', ...)
// readFileSync('drizzle/0040_change_log_triggers.sql') === header + SYNCED entries mapped through triggerSql, joined
```
`src/lib/server/sync/log.spec.ts`, on `openDb(':memory:')`:
```ts
it('has four log triggers on every synced table and none on the others', ...)
it('logs an insert, an update and a delete with the key as text', ...)
// insert a set → change_log row {tbl:'sets', key:String(id), op:'i'}; update → 'u'; delete → 'd'
it('logs a composite key as keyString would write it', ...)
// insert lesson_figures (lessonId, figureId) → key === JSON.stringify([lessonId, figureId])
it('logs the old key as a delete when an update changes the key', ...)
// update lesson_figures set figure_id = other → rows 'u' with the new key and 'd' with the old
it('reads the head from sqlite_sequence, so a prune keeps it', ...)
it('prunes rows older than 30 days and keeps newer ones', ...)
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/sync/tables.spec.ts src/lib/server/sync/log.spec.ts`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement**
  1. Write `tables.ts` and `triggers.ts`. Both are standalone: no imports, so `node scripts/sync-triggers.ts` can load them.
  2. Add `changeLog` to the schema, then run `npm run db:generate` and read the SQL (CLAUDE.md).
  3. Generate the custom migration and fill it from the script.
  4. Write `log.ts`.
  5. In `startTrashPurge`, call `pruneChangeLog(db(), now)` in `run`, beside `purgeTrash`, with its own `.catch` that logs `[sync] prune failed`.

- [ ] **Step 4: Run the tests and the id scans**

Run: `nix develop -c npx vitest run src/lib/sync src/lib/server/sync src/lib/server/db`
Expected: PASS. `ids.spec.ts` stays green: 0040 inserts into `change_log` only.

- [ ] **Step 5: Commit** — `git commit -m "sync: every synced table logs its changes (change_log, migrations 0039–0040)"`

---

### Task 2: What a person may read (`syncScope`)

**Files:**
- Create: `src/lib/server/sync/scope.ts`, `src/lib/server/sync/scope.spec.ts`, `src/lib/server/sync/test-world.ts` (specs only: the world below, reused by Tasks 3 and 4)

**Interfaces:**
- Consumes: `SYNCED` (Task 1); `access.ts` (`reach`, `songAccess`, …); `keyString` (Task 3's `digest.ts`). Write `digest.ts` first, in this task. Its tests are Task 3's.
- Produces:
  - `type Row = Record<string, unknown>`: raw column name → value, as `select *` returns it;
  - `type Scope = Map<string, Map<string, Row>>`: table → key string → row, already redacted;
  - `syncScope(db: Db, userId: string): Scope`, with every `SYNCED` table present, empty or not.

**The rules: a row is in scope when the person may read it.** Root rows go by owner; children follow their parent:

| Table | In scope when |
|---|---|
| `figure_groups`, `figures`, `routines`, `exercises`, `lessons`, `positions` | own (`user_id` = me); or the group's and I'm its editor/owner (all rows, archived and drafts too, until its purge); or a plain member and the id is in `reach(db, me, teamId)` (`figures` for moves, `variations` for figures, `routines`, `drills`, `lessons`, `positions`) |
| `songs` | `songAccess(db, me, song) !== null` (own; a group's per its rules) |
| `teams` | I hold a `team_members` row and `purged_at` is null |
| `team_members` | its team is in scope |
| `users` | me (full row); anyone with a `team_members` row in a team in scope; the author or `deleted_by` of a comment in scope (both redacted, below) |
| `recordings` | its figure in scope, and for a plain member also in `reach.recordings` |
| `figure_start_positions`, `figure_end_positions` | its figure in scope |
| `lesson_videos`, `lesson_figures`, `lesson_routines`, `lesson_exercises`, `lesson_positions`, `lesson_comments` | its lesson in scope |
| `routine_steps` | its routine in scope; `routine_step_options`: its step in scope |
| `video_spots` | its recording or lesson video in scope |
| `spot_links`, `spot_position_links` | its spot in scope |
| `sets`, `song_drops` | its exercise in scope |
| `links`, `song_links`, `video_downloads` | the parent it names (lesson, figure, exercise or routine) in scope |
| `lesson_comment_hearts` | its comment in scope |
| `today_picks`, `default_styles`, `count_takes`, `opens`, `twins`, `lesson_adds` | `user_id` = me |
| `clone_sync` | the row it names (`kind` per `CloneKind`: `figure`→`figures`, `routine`, `drill`→`exercises`, `song`, `lesson`, `position`) in scope |

**Redaction:**
- `users.password_hash` is always `''`.
- A user other than me keeps `id`, `dance`, `first_name`, `last_name` and `created_at`, with:
  - `email` = `` `${id}@hidden.invalid` `` (unique per dance, so the device's unique index holds);
  - `timezone` = `'UTC'`, `video_short_side` = 480, `is_admin` = 0;
  - every other column NULL.

Ruling: scope is computed set by set, starting from the roots. Queries use `where parent_id in (…)`, or read a whole child table and filter in JS, whichever is simpler. At today's scale (the whole production database is under 1 MB) that's milliseconds. Revisit once one person's copy passes 10 000 rows.

- [ ] **Step 1: Write the failing tests.** The oracle is `access.ts` itself, row by row.

`scope.spec.ts` builds one world with `makeClass(db)` (`test-class.ts`: Ana u1 owns group 1, Luka u2 edits it, Maja u3 is a member with an added lesson, Nik u4 is in no group, Eva u5 has group 2). On top of it, through the data functions:
- each of u1 and u4 gets own rows: a move and a figure, with a recording, a spot on it and a section link;
- a routine with a step;
- a lesson with a video, a spot, a link and a song link;
- a set on their exercise;
- a twin and a today pick;
- group 1 gets:
  - a published lesson holding a figure (with a recording and a spot), a routine and a drill;
  - a draft lesson;
  - an archived lesson;
  - a comment with a heart on the published lesson;
  - a position tagged on the figure.

```ts
it('agrees with access.ts on every root row, for every person', ...)
// for u in u1..u5, every row of figures/figure_groups/routines/exercises/lessons/positions:
//   scope.get(t).has(key) === (xAccess(db, u, row) !== null)   (figureAccess, figureGroupAccess,
//   routineAccess, drillAccess, lessonAccess, positionAccess)
it('agrees with access.ts on recordings, lesson videos, spots and songs', ...)
// recordingAccess, lessonVideoAccess, spotAccess, songAccess, same shape
it('takes a child row exactly when its parent is in scope', ...)
// for every child table in the rules table: child ∈ scope ⇔ parent ∈ scope
it("gives Nik nothing of group 1 and Eva nothing of group 1", ...)
it("gives Maja the published lesson and not the draft or the archived one", ...)
it('gives Luka the draft and the archived lesson', ...)
it('gives a member who left nothing of the group', ...)       // leaveTeam(u3) → no team-1 row
it("redacts another person's users row and never sends a password hash", ...)
// u3's scope: users row of u2 has email 'u2@hidden.invalid', password_hash '', timezone 'UTC'; u3's own row keeps its email
it('holds every synced table, even empty', ...)
```

- [ ] **Step 2: Run them to see them fail.** Run: `nix develop -c npx vitest run src/lib/server/sync/scope.spec.ts`. Expected: FAIL (no module).

- [ ] **Step 3: Implement `syncScope`.** The rules table above, plus `keyString` for the keys. Reads go through `db.$client.prepare('select * from <t> …')` (raw SELECTs are allowed; only raw inserts are banned).

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "sync: what a person may read, row by row (syncScope)"`

---

### Task 3: The pull

**Files:**
- Create: `src/lib/sync/digest.ts` (written in Task 2), `src/lib/sync/wire.ts`, `src/lib/sync/schema-tag.ts`, `src/lib/server/sync/pull.ts`, `src/routes/api/sync/pull/+server.ts`, `src/lib/sync/digest.spec.ts`, `src/lib/server/sync/pull.spec.ts`
- Modify: none (`/api/` is private by default; the route refuses device tokens itself)

**Interfaces:**
- Produces:
  - `keyString(values: readonly unknown[]): string`: one value → `String(v)`, several → `JSON.stringify(values)`;
  - `digestInput(keys: Iterable<string>): string`: the keys sorted with the default JS sort, joined by `'\n'`;
  - `serverDigest(keys): string` in `pull.ts`: the sha256 hex of `digestInput`, via `node:crypto`; the device computes the same with WebCrypto;
  - the wire types and `SCHEMA_TAG` below;
  - `pull(db: Db, userId: string, req: PullRequest): PullResponse | PullRefusal`;
  - `POST /api/sync/pull`: a JSON `PullRequest` → 200 `PullResponse`, 409 `PullRefusal`, 400 when malformed, 401 without a cookie session.

```ts
// wire.ts
export type TableRows = { cols: string[]; rows: unknown[][] };
export type PullRequest = { cursor: number; schema: string; digests?: Record<string, string> };
export type PullResponse = {
	userId: string;
	cursor: number;
	schema: string;
	full: string[];                          // tables the device replaces with changed[t]
	changed: Record<string, TableRows>;      // full tables: every row in scope; others: upserts
	cookies: Record<string, string>;         // the page cookies the loads read
};
export type PullRefusal = { refused: 'schema'; schema: string };
// schema-tag.ts
export const SCHEMA_TAG: string; // journal.entries.at(-1).tag, from drizzle/meta/_journal.json
```

**`pull` rules.** Everything is read inside one `db.transaction`, so the cursor, scope and rows agree:
1. **Schema:** `req.schema !== SCHEMA_TAG` → `{ refused: 'schema', schema: SCHEMA_TAG }`.
2. **Read:** `head = logHead(db)`, `oldest = logOldest(db)`, `scope = syncScope(db, userId)`.
3. **Fresh**, meaning every table is full, when any of these holds:
   - `req.digests` is absent;
   - `req.cursor > head` (a restored database);
   - `req.cursor < head` and either `oldest === null` or `req.cursor < oldest - 1` (pruned past the cursor).
4. **Per table, when not fresh:** the table is full when `req.digests[t] !== serverDigest(scope keys)`, or when the digest is missing.
5. **Full table:** `changed[t]` holds every scope row.
6. **Other tables:** `changed[t]` holds the scope rows whose key is in `changedSince(db, req.cursor)` for that table. A changed key outside scope is skipped: the digest is what removes rows.
7. **Answer:** `cursor = head`. `cols` is the table's column names in schema order, and `rows` are arrays in that order. Tables with no rows are left out of `changed` unless they are full (an empty full table means "delete all").

**The route:**
- 401 unless `validateSession(cookies.get(SESSION_COOKIE))` holds. A paired phone's device token never pulls.
- It echoes these cookies when present: `THEME_COOKIE`, `APP_COOKIE`, `LOCALE_COOKIE`, and every `groupCookie(dance)` for the registry's dances. Never the session.

- [ ] **Step 1: Write the failing tests**

`digest.spec.ts`:
```ts
it('writes one key as its text and several as JSON', ...)     // keyString([7]) '7', keyString([3,'u1']) '[3,"u1"]'
it('sorts the keys before joining', ...)                        // digestInput(['b','a']) 'a\nb'
it('gives the same digest with node:crypto and WebCrypto', ...) // crypto.subtle.digest in Node 22
```
`pull.spec.ts`, on the Task 2 world (`test-world.ts`):
```ts
it('sends every table in full to a device with no digests', ...)
it('sends nothing to a device that is up to date', ...)       // second pull with returned cursor + digests → full [], changed {}
it("sends a changed row as an upsert, not its table", ...)     // rename own figure → changed.figures has 1 row, full []
it("never sends a change to another person's row", ...)        // u4 edits own figure; u1's pull: changed has no figures
it("drops a left group's rows on the next pull", ...)          // Maja pulls, leaves, pulls → full includes lessons; lessons' rows hold no team-1 lesson
it('resends a table whose row was deleted', ...)               // delete own set → full includes 'sets'
it('starts over when the cursor is past the head or pruned away', ...)
it('refuses another schema', ...)                              // { refused: 'schema', schema: SCHEMA_TAG }
it('answers columns in schema order and rows as arrays', ...)
```
In the same file, a route test (`vi.mock('$lib/server/db')` as `dance-wall.spec.ts` does):
```ts
it('refuses a request without a session, and a device token', ...)   // 401
it('echoes the page cookies and never the session', ...)
```

- [ ] **Step 2: Run them to see them fail.** Run: `nix develop -c npx vitest run src/lib/sync src/lib/server/sync`. Expected: FAIL for the new tests.

- [ ] **Step 3: Implement** the wire types, `SCHEMA_TAG`, `serverDigest`, `pull` and the route.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "sync: the pull, with digests for what the log can't see"`

---

### Task 4: The device's database

**Files:**
- Create:
  - from the spike: `src/device/sqlite-shim.ts`, `src/device/sqlite-shim.spec.ts`, `vitest.device.config.ts`, `src/device/vitest-setup.ts`;
  - new: `src/device/migrate.ts`, `src/device/migrate.spec.ts`, `src/device/apply.ts`, `src/device/apply.spec.ts`.
- Modify: `package.json`:
  - add `"@sqlite.org/sqlite-wasm": "3.54.1-build1"` to `dependencies`, exact;
  - add a script `"test:device": "vitest --run -c vitest.device.config.ts"`. It's optional and not in `check`, because it is slow on WASM.

**Interfaces:**
- Consumes: `SYNCED`, `keyString`, `digestInput`, the wire types.
- Produces (all take a better-sqlite3-shaped `SqliteDb`: `prepare`, `exec`, `pragma`, as both better-sqlite3 and the shim provide):
  - `type Migration = { tag: string; sql: string }`;
  - `migrateDevice(db: SqliteDb, migrations: Migration[]): number`: how many it applied;
  - `type DeviceMeta = { userId: string | null; cursor: number; schema: string | null; cookies: Record<string, string>; full: boolean }`;
  - `readMeta(db: SqliteDb): DeviceMeta`;
  - `applyPull(db: SqliteDb, res: PullResponse): void`;
  - `wipeCopy(db: SqliteDb): void`;
  - `deviceDigests(db: SqliteDb): Promise<Record<string, string>>`;
  - `pullRequestOf(db: SqliteDb, schema: string): Promise<PullRequest>`: no `digests` when `meta.full`.

**Rules:**
- **`migrateDevice`:**
  - creates `device_migrations (tag text primary key)` and `device_meta (key text primary key, value text not null)` if missing;
  - applies each migration whose tag is absent, in journal order, splitting on `--> statement-breakpoint`, each in its own `BEGIN…COMMIT`;
  - when it applies any, sets `meta.full = true`. Ruling (left to the builder by the spec): a schema change on the device means one full pull.
- **`applyPull`:**
  1. If `meta.userId` is set and differs from `res.userId`, `wipeCopy` first.
  2. `PRAGMA foreign_keys = OFF`, then `BEGIN`.
  3. For each table in `full`: `DELETE FROM <t>`.
  4. For each table in `changed`, each row: `INSERT INTO t (cols) VALUES (…) ON CONFLICT(<key>) DO UPDATE SET <non-key> = excluded.<non-key>`. Never `INSERT OR REPLACE`: that is a delete and would cascade. Column names come only from the device's own `PRAGMA table_info`, intersected with `cols`.
  5. `DELETE FROM change_log`: the device logs nothing in phase 2.
  6. Write the meta: `userId`, `cursor`, `schema`, `cookies`, `full = false`.
  7. `COMMIT`, then `PRAGMA foreign_keys = ON`. On any throw: `ROLLBACK`, foreign keys back on, rethrow.
  8. A table name not in `SYNCED` is ignored.
- **`wipeCopy`:** in one transaction with foreign keys off, `DELETE FROM` every synced table and from `device_meta`. It never removes the database file. Ruling, from the spike's Review Focus 1: no code path deletes the file or the VFS.

- [ ] **Step 1: Write the failing tests.** They run on real better-sqlite3 (`new Database(':memory:')`), whose API the shim copies; the drizzle migrations are read from `drizzle/` and the journal.

`migrate.spec.ts`:
```ts
it('builds the whole schema on an empty database, with the log and id triggers', ...)
it('applies nothing the second time', ...)                       // returns 0
it('applies only the new migrations after an update, and asks for everything', ...)
// apply all but the last, readMeta().full = false after a fake applyPull, then all → returns 1, full true
```
`apply.spec.ts` (the database from `migrateDevice`, a `PullResponse` made from `pull()` on Task 3's world for u1):
```ts
it("holds exactly the person's scope after a full pull", ...)  // row counts per table === scope sizes
it("digests agree with the server's after a pull", ...)        // deviceDigests === serverDigest per table
it('replacing a parent table keeps its children', ...)          // full: ['figures'] → recordings count unchanged
it('an upsert keeps the row\'s children', ...)                   // changed.figures one row → recordings kept
it('wipes before applying another person\'s pull', ...)          // apply u1, then u4's → no u1 rows remain
it('leaves the copy as it was when a row fails', ...)            // malformed row → throws, counts unchanged, fk ON
it('asks for everything after a migration and for changes after a pull', ...) // pullRequestOf with/without digests
it('ignores a table it does not sync', ...)
```
`sqlite-shim.spec.ts` comes from the spike as it is.

- [ ] **Step 2: Run them to see them fail.** Run: `nix develop -c npx vitest run src/device`. Expected: the new specs FAIL; the shim spec passes.

- [ ] **Step 3: Implement** `migrate.ts` and `apply.ts`.

- [ ] **Step 4: Run them.** Expected: PASS. Then run `nix develop -c npm run test:device -- --shard=1/4` once, to see the shim still carries the suite. Expected: as the spike, everything passes except `migrate.spec` (×4, file reopen) and `timeout.spec`.

- [ ] **Step 5: Commit** — `git commit -m "device: its database: migrations, applying a pull, the shim"`

---

### Task 5: The server code knows it runs on a device; which requests it answers

**Files:**
- Create: `src/lib/server/device-runtime.ts`, `src/lib/offline/routes.ts`, `src/lib/offline/routes.spec.ts`, `src/lib/offline/needs-connection.ts`, `src/lib/offline/needs-connection.spec.ts`, `src/device/request.ts`, `src/lib/server/device-runtime.spec.ts`
- Modify:
  - `src/hooks.server.ts`;
  - `src/lib/server/db/bootstrap.ts` (returns at once on a device);
  - `src/lib/nav/error-view.ts` and its spec (`NEEDS_CONNECTION` reads as offline);
  - `package.json` (`"devalue"` into `dependencies` at the version `package-lock.json` already holds).

**Interfaces:**
- Produces:
  - **`device-runtime.ts`:**
    - `type DeviceRuntime = { userId: string; cookies: Record<string, string> }`;
    - `deviceRuntime(): DeviceRuntime | null` reads `globalThis.__salsaDevice`;
    - `deviceUser(db, userId): App.Locals['user']` builds the same shape the session gives (`parseLevel` on `level`), or null when the row is missing.
  - **`routes.ts`** (PURE):
    - `routePattern(routeId: string): RegExp`: drops `(group)` segments; `[x]` matches one segment;
    - `NETWORK_PAGES`, `DEVICE_ENDPOINTS` and `NETWORK_ENDPOINTS`, as route ids;
    - `deviceAnswers(method: string, url: URL): boolean`.
  - **`needs-connection.ts`** (PURE):
    - `NEEDS_CONNECTION = 'needs-connection'`;
    - `offlineWrite(isAction: boolean, message: string): { status: 503; headers: [string, string][]; body: string }`.
      - An action → `{"type":"failure","status":503,"data":"<devalue.stringify({ message, offline: true })>"}`.
      - Anything else → `{"message": …}`.
      - Both with `content-type: application/json`.
    - `offlineRead(): same shape`: `{"message":"needs-connection"}`, 503.
  - **`request.ts`:** `class DeviceRequest extends Request`, whose constructor is `(url, init, headers: Headers)`; its `headers` getter returns that `Headers`. Ruling: this replaces the spike's `defineProperty`. It carries only the copy's cookies and `user-agent`, never a session, so no forbidden header is spoofed for auth.

**Rules:**
- **`hooks.server.ts`,** when `deviceRuntime()` is set:
  - `locals.user = deviceUser(getDb(), device.userId)`, with no session lookup and no device token;
  - `noteAppSeen` is skipped;
  - `bootstrap()` returns at once (its first line checks `deviceRuntime()`);
  - everything else runs as on the server.
- **`/shell`** joins `PUBLIC_PATHS` and passes `needsName`/`needsLevel` (add it to `names.ts`' `PASS_EXACT`). The service worker caches it signed out, or mid-first-run, without a redirect.
- **`deviceAnswers`** is true only for GET:
  - a path ending `/__data.json` (or `/__data.json` itself) whose page path doesn't match a `NETWORK_PAGES` pattern;
  - or a path matching a `DEVICE_ENDPOINTS` pattern.

  **Network pages:**
  - `/admin`, `/login`, `/join`, `/app`, `/device/pair`, `/g/[code]`;
  - `/settings/storage`;
  - `/[dance]/groups/[id]/history`, `/[dance]/groups/[id]/deleted`, `/[dance]/groups/[id]/people`, `/[dance]/groups/[id]/storage`;
  - `/welcome`, `/dev/kit`, `/[dance]/group-mode`.

  **Device endpoints:** `/api/lessons/[id]/comments`, `/api/video-spots`, `/api/video-spots/[id]/links`, `/[dance]/songs/[id]/grid`, `/[dance]/(today)/exercises/[id]/practice`.

  **Network endpoints:** every other `+server.ts` with a GET:
  - the APIs: `/api/app-update/[dance]`, `/api/clones/copy`, `/api/clones/move`, `/api/clones/sync`, `/api/device/config`, `/api/device/today`, `/api/teams/[id]/keep`, `/api/worker/songs/[id]/audio`;
  - the media and files: `/audio/[file]`, `/count/[file]`, `/lesson-videos/[file]`, `/recordings/[file]`, `/releases/[dance]/[file]`;
  - the rest: `/health`, `/manifest-[dance].webmanifest`, `/.well-known/assetlinks.json`.

  The rule for a new one: answerable from synced rows → device; otherwise → network.
- **`errorView`** treats `message === NEEDS_CONNECTION` as `offline`, so lie-fi (online but failing) gets the offline page too.

- [ ] **Step 1: Write the failing tests**

`routes.spec.ts`:
```ts
it('lists every GET endpoint as device or network, exactly once', ...)
// import.meta.glob('/src/routes/**/+server.ts') → ids whose module source matches /export (const|async function|function) GET\b/
// === DEVICE_ENDPOINTS ∪ NETWORK_ENDPOINTS, disjoint
it('names only routes that exist', ...)            // every NETWORK_PAGES id has a +page.svelte
it('matches a route id with its groups and params', ...) // routePattern('/[dance]/(today)/exercises/[id]/practice').test('/salsa/exercises/7/practice')
it('answers page data, but not a network page or a write', ...)
// GET /salsa/figures/__data.json true; GET /__data.json true; GET /salsa/groups/3/history/__data.json false;
// POST /salsa/figures?/create false; GET /recordings/x.mp4 false; GET /api/video-spots?x=1 true
```
`needs-connection.spec.ts`:
```ts
it('an offline action is a failure SvelteKit reads', ...)
// JSON.parse(body).type === 'failure'; devalue.parse(JSON.parse(body).data) → { message, offline: true }
it('an offline API write is a 503 with a message', ...)
```
`device-runtime.spec.ts`:
```ts
it('is off unless the device worker set it', ...)
it("builds the session's user shape from the users row", ...)
```
`error-view.spec.ts`: add `it('reads needs-connection as offline', ...)`.

- [ ] **Step 2: Run them to see them fail.** Run: `nix develop -c npx vitest run src/lib/offline src/lib/server/device-runtime.spec.ts src/lib/nav/error-view.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**, including the hooks and bootstrap changes.

- [ ] **Step 4: Run the whole suite**, since the hook change touches every request: `nix develop -c npm run test`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "device: server code that knows the device, and which requests it answers"`

---

### Task 6: The device worker and its build

**Files:**
- Create: `vite.device.config.ts` (from the spike, reworked), `src/device/node-stubs/*` (from the spike), `src/device/worker.ts`, `scripts/check-device-build.mjs`
- Modify: `package.json` `build`: `"vite build && vite build -c vite.device.config.ts && node scripts/check-device-build.mjs"`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces the worker's messages, defined in `src/device/worker.ts` and imported as types by `device.svelte.ts`:
  - **in:**
    - `{ type: 'device-fetch', request: WireRequest }`, with a reply port;
    - `{ type: 'pull' }`;
  - **out:**
    - `{ type: 'state', state: DeviceState }`;
    - `{ type: 'pulled', cursor: number }`.
  - `type DeviceState = 'waiting' | 'starting' | 'empty' | 'ready' | 'failed'`.
  - `WireRequest`, `WireResponse` and `WireFallback` are as the spike's `protocol.ts`, moved to `src/lib/offline/protocol.ts`.

**Rules:**
- **The build:**
  - `vite.device.config.ts` writes to `build/client/_device/<version>/`. `<version>` is read from `.svelte-kit/output/client/_app/version.json`.
  - `build.assetsInlineLimit: 0`, so the WASM is never inlined as well.
  - It aliases as the spike did: `better-sqlite3` → the shim, `node:*` → the stubs, drizzle's migrator → a no-op stub that says why (`migrateDevice` runs first).
  - Migrations come from `import.meta.glob('/drizzle/*.sql', { query: '?raw', eager: true, import: 'default' })`, ordered by `drizzle/meta/_journal.json`.
  - It writes `files.json`: every file in the version directory, as absolute paths.
- **`check-device-build.mjs`:**
  - exits 1 if the version directory is missing;
  - exits 1 if it holds a `sqlite3-worker1*` file or more than one `.wasm`;
  - exits 1 if the gzipped total passes 1.5 MB;
  - prints the total.
- **The worker:**
  1. `navigator.locks.request('salsa-device', …)`, waiting, never `ifAvailable`, and the callback holds the lock for the worker's life.
     - Ruling: one tab owns the copy. A second tab's worker posts `'waiting'` and takes over when the first closes. Its requests fall to the network meanwhile.
     - The spec's BroadcastChannel relay is deferred to phase 3. It only matters offline, in two desktop tabs.
  2. Inside the lock:
     - init SQLite (`locateFile` → its own version directory);
     - `installOpfsSAHPoolVfs({ name: 'salsa' })`;
     - open `/salsa.db` through the shim;
     - run `migrateDevice`;
     - `readMeta`.
  3. If online, pull. Wait for the pull when there's no copy yet.
  4. A copy exists → set `globalThis.__salsaDevice = { userId, cookies }`, then `new Server(manifest)` and `server.init({ env: { DATABASE_PATH: '/salsa.db', DATA_DIR: '/device' } })` (once). Post `'ready'`.
     - No copy and offline → post `'empty'`.
     - Any throw → post `'failed'`.
  5. **Answering:** `device-fetch` →
     - fall back unless the state is `ready` and `deviceAnswers(method, url)`;
     - otherwise `server.respond(new DeviceRequest(url, { method }, headers), { getClientAddress: () => '127.0.0.1' })`. The headers are the wire headers plus `cookie` (from `meta.cookies`, `name=value; …`) and `user-agent` (from `navigator.userAgent`);
     - reply `WireResponse`, or a fallback on throw.
  6. **Pulling:** at most one pull at a time, and a request for another while one runs queues exactly one more.
     - The request comes from `pullRequestOf`, via `fetch('/api/sync/pull', { method: 'POST', credentials: 'same-origin' })`.
     - 200 → `applyPull`, update `__salsaDevice`; start the server if it wasn't; post `'pulled'`.
     - 401 → `wipeCopy`, post `'empty'`. Ruling: signed out means no copy; phase 3 revisits this once there is an outbox.
     - 409 → keep the copy and log `[device] schema behind, waiting for the update`.
     - A network failure → keep everything.

- [ ] **Step 1: Write the build check first** (`check-device-build.mjs`). Run it before the device config exists: `node scripts/check-device-build.mjs`. Expected: exit 1, "no device build".
- [ ] **Step 2: Write the config, stubs and worker.** Run `nix develop -c npm run build`. Expected: the build passes, and the check prints a total under 1.5 MB with one `.wasm`.
- [ ] **Step 3: Type-check and lint.** Run `nix develop -c npm run check:types && nix develop -c npm run lint`. Expected: 0 errors. Give the worker a `tsconfig` reference or `/// <reference lib="webworker" />` as the spike did.
- [ ] **Step 4: Commit** — `git commit -m "device: the worker and its bundle"`

---

### Task 7: The service worker, the shell and the page side

**Files:**
- Create: `src/service-worker.ts`, `src/lib/offline/sw-route.ts`, `src/lib/offline/sw-route.spec.ts`, `src/routes/shell/+page.ts`, `src/routes/shell/+page.svelte`, `src/lib/offline/device.svelte.ts`, `src/hooks.client.ts`
- Modify:
  - `vite.config.ts`: in the `sveltekit({...})` options, `paths: { relative: false }` and `serviceWorker: { register: false }`;
  - `src/routes/+layout.svelte`: the Offline layer and preloading, and the toast;
  - `src/lib/i18n/en/shell.ts` and `src/lib/i18n/sl/shell.ts`.

**Interfaces:**
- Consumes: `deviceAnswers`, `offlineWrite`, `offlineRead` and the wire types (Task 5); the worker's messages (Task 6).
- Produces:
  - `type SwRoute = 'precached' | 'navigate' | 'device-read' | 'write' | 'pass'`;
  - `swRoute(method: string, url: URL, mode: RequestMode, origin: string, precached: ReadonlySet<string>): SwRoute`;
  - `SHELL = '/shell'`;
  - `isNetworkFailure(res: Response): boolean` (502, 503, 504, 520–530);
  - in `device.svelte.ts`:
    - `device: { state: DeviceState | 'off' }` (`$state`);
    - `startDevice(): void`;
    - `deviceReady(): boolean`;
  - the window event `salsa:needs-connection`.

**Rules:**
- **`swRoute`:**
  - another origin → `pass`;
  - a path in `precached`, or under `/_app/` or `/_device/` → `precached`;
  - `mode === 'navigate'` and GET → `navigate`;
  - GET and `deviceAnswers` → `device-read`;
  - any other GET → `pass`;
  - anything else → `write`.
- **The service worker:**
  - **Install:**
    1. Open cache `salsa-<version>`.
    2. `addAll([...build, ...files, ...prerendered])`.
    3. Fetch `/_device/<version>/files.json` and add those.
    4. Add `SHELL`, fetched with `redirect: 'error'`.
    5. `skipWaiting()`.
  - **Activate:**
    - enable `navigationPreload`;
    - delete every `salsa-*` cache but the two newest by version. Ruling: the previous build stays, so an open page of it still finds its chunks offline;
    - `clients.claim()`.
  - **Fetch:**
    - Every handler body sits in a `try`; on any throw it answers `fetch(event.request)`.
    - `precached`: `caches.match` across caches, else the network.
    - **Where the timeout applies.** The page posts `{ type: 'device-state', state }` to the controller on every change, and the SW keeps the latest per client id.
      - A read's timeout applies when its client's state is `ready`.
      - A navigation has no running page yet, so its timeout applies when a shell is cached.
      - Otherwise the request waits for the network as long as it takes.
    - `navigate`:
      1. When `navigator.onLine`, the preload response or `fetch`, raced against `NETWORK_TIMEOUT_MS`.
      2. On a failure, the cached `SHELL`.
      3. No shell cached → `new Response('Offline', { status: 503 })`.
    - `device-read`: the network, timed as above. On a failure, ask the client's device (the spike's `viaDevice`, 15 s cap). On a fallback or no client → `offlineRead()`.
    - `write`: `fetch`, never timed out.
      - On success, post `{ type: 'changed' }` to the client.
      - On a rejection, post `{ type: 'needs-connection' }` and answer `offlineWrite(request.headers.has('x-sveltekit-action'), 'Needs a connection.')`. The SW has no language; the page's toast carries the person's words.
    - `pass`: no `respondWith`.
    - Ruling: in phase 2 a new build takes over at once (`skipWaiting`), since nothing waits to sync. Phase 3 adds the spec's "never while the outbox holds older entries".
- **The shell:**
  - `src/routes/shell/+page.ts` exports `ssr = false` and `prerender = false`;
  - `+page.svelte` is empty;
  - SvelteKit's client start on a page with no SSR data goes to `location.href`, so the shell works at any path;
  - `paths.relative = false` makes its asset URLs absolute (spike finding).
- **`device.svelte.ts`:**
  - `startDevice` does nothing in dev, or without `serviceWorker` or `Worker`.
  - It registers `/service-worker.js`.
  - It starts the worker `/_device/<version>/worker.js` (`version` from `$app/environment`), type module:
    - at once when `!navigator.onLine`;
    - otherwise on `requestIdleCallback`, with a 2 s timeout.
  - It relays `device-fetch` to the worker, starting it if needed, and waits for `ready` for up to `DEVICE_START_LIMIT_MS = 10_000`, else falls back.
  - `changed` → `pull` after 1 s, debounced.
  - `online`, `visibilitychange` to visible, and every `PULL_EVERY_MS = 300_000` → `pull`.
  - `needs-connection` → `window.dispatchEvent(new CustomEvent('salsa:needs-connection'))`.
  - It mirrors `state` into `window.__device = { state }` for the walk.
  - `hooks.client.ts` `init` calls `startDevice()` without awaiting.
- **The root layout:**
  - The Offline layer and the preload switch-off apply only when `!navigator.onLine && !deviceReady()`.
  - A `Toast` shows `t().shell.offline.needsConnection` for 4 s on `salsa:needs-connection`.
- **Words:**

  | Key | en | sl |
  |---|---|---|
  | `shell.offline.needsConnection` | `'Needs a connection. Nothing was changed.'` | `'Potrebna je povezava. Nič se ni spremenilo.'` |

  Ruling: the existing toast stands in for phase 3's designed "Needs a connection".

- [ ] **Step 1: Write the failing test.** `sw-route.spec.ts`:
```ts
it('passes other origins and media', ...)                 // GET /recordings/x → 'pass'; https://other/ → 'pass'
it('serves the build from the cache', ...)                 // /_app/immutable/x.js, /_device/1/worker.js, a precached /clips/1.wav
it('sends navigations to the network first', ...)          // mode navigate → 'navigate'
it('reads page data and device endpoints from the device', ...)
it('sends every write to the network', ...)                // POST ?/log → 'write'; PUT chunk → 'write'
it('reads a 502 and a Cloudflare 522 as the network failing, a 404 as an answer', ...)
```
- [ ] **Step 2: Run it to see it fail.** Run: `nix develop -c npx vitest run src/lib/offline/sw-route.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** everything in the Rules. `i18n.spec.ts` and `no-english.spec.ts` keep the catalogs honest.
- [ ] **Step 4: Run** `nix develop -c npm run check`. Expected: lint, types, the build (with the device check) and every test pass.
- [ ] **Step 5: Commit** — `git commit -m "offline: the service worker, the shell, and the page starting the device"`

---

### Task 8: Every page renders with no server, and the offline walk

**Files:**
- Create: `src/lib/nav/first-nav.spec.ts`, `scripts/offline/serve.sh`, `scripts/offline/walk.py`, `scripts/offline/README.md`
- Modify: whatever the scan and the walk find

**Interfaces:**
- Consumes: the whole of Tasks 1–7.
- Produces: `scripts/offline/walk.py`, which exits 0 only when every check below holds. It's the gate for this task and for shipping.

**Rules:**
- **`first-nav.spec.ts`** scans `src/**/*.{svelte,ts}`, except specs, with comments stripped (`stripComments` from `server-sources.ts`):
  - for `from.url.` or `from?.url.` not followed by `?`;
  - for `nav.from.url` in the same way.

  The first client-only navigation has `from.url === null` (spike finding). Expected hits: none.
- **`serve.sh <db-copy>`:**
  - copies the db to a `mktemp -d` (never `.data`) and migrates it;
  - inserts a session row `walk` for the first admin, as `scripts/shots/shots.py`'s `prepare` does;
  - runs `npm run build` unless `SKIP_BUILD=1`;
  - starts `node build` on a free port with `ORIGIN`, `DATABASE_PATH`, `DATA_DIR` and `BODY_SIZE_LIMIT=20M`;
  - prints the port;
  - kills its process group on exit.
- **`walk.py <port>`**, a Playwright phone context 390×844 with the cookie `salsa_session=walk`:
  1. **Online:**
     - open `/{dance}` and reload; wait until `window.__device.state === 'ready'` (20 s cap);
     - time 5 warm opens of `/{dance}` with service workers allowed, and 5 in a context with `service_workers='block'`;
     - print both medians.
  2. **Offline:** `context.set_offline(True)`. For every line of `scripts/shots/pages.txt`, with its placeholders filled by `shots.py`'s `placeholders`, do a full `page.goto`. The page passes when:
     - no `pageerror` and no console `error` was logged;
     - the error page's marker is absent;
     - a band header shows.
  3. **Offline, client navigation:** from `/{dance}`, tap each tab in the tab bar and then the first row of each list. Same checks.
  4. **Offline, a write:** open Today, open the first exercise's log popup and send it. The `salsa:needs-connection` toast shows, the sheet stays open, and the database copy has no new `sets` row.
  5. **Offline, a network page:** `/{dance}/groups/<id>/history` shows the offline error page, not an empty History.
  6. **Back online:** rename a figure through its form, then wait for `'pulled'`. Offline again, the figure page shows the new name.

  It prints one line per check (`ok` / `FAIL <why>`) and exits 1 on any FAIL.
- **Fixes:** each FAIL is fixed at its cause:
  - optional chaining for a null `from.url`;
  - a `browser` guard where a component reads `window` at module level;
  - moving a device-unanswerable read into `NETWORK_PAGES` / `NETWORK_ENDPOINTS` when it needs server-only state.

  Ledger one line per fix with its route.
- **Acceptance for "opens no slower":** the online median with the service worker is within +100 ms of the median without it. Otherwise investigate before shipping, starting with navigation preload.

- [ ] **Step 1: Write `first-nav.spec.ts`; run it.** Expected: FAIL on Today's `(today)/+layout.svelte` and on `nav/trail.svelte.ts` (the spike's two hits; this branch never had its fixes). Apply them, as the spike did, with optional chaining. Run again; expected: PASS.
- [ ] **Step 2: Write `serve.sh` and `walk.py`.** Run them against a copy of the dev database: `scripts/offline/serve.sh ../../salsaapp/.data/salsa.db` in the background, then `walk.py <port>`, under the Playwright command `scripts/shots/README.md` names. Expected at first: some FAILs.
- [ ] **Step 3: Fix each FAIL and rerun the walk until it exits 0.**
- [ ] **Step 4: Run** `nix develop -c npm run check`. Expected: green.
- [ ] **Step 5: Commit**, grouped by cause — `git commit -m "offline: every page renders from the device"`, plus `"offline: the walk"` for the scripts.

---

### Task 9: Docs, and shipping

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-07-offline-design.md`, `docs/deployment.md`

**Steps:**
- [ ] **Step 1: Update CLAUDE.md.**
  - **Layout lines:** `src/lib/sync/`, `src/lib/server/sync/`, `src/lib/offline/`, `src/device/`, `src/service-worker.ts`, `/shell`, `vite.device.config.ts`, `scripts/offline/`.
  - **Hard rules:**
    - **"Every table is classified for sync":** `src/lib/sync/tables.ts`. A synced table gets the four log triggers in a migration written by `scripts/sync-triggers.ts`, and `tables.spec.ts` checks both.
    - **"No row leaves the server outside `syncScope`":** a new synced table gets its rule in `scope.ts` and a case in `scope.spec.ts`.
    - **"A new GET endpoint is classified":** `src/lib/offline/routes.ts`, checked by `routes.spec.ts`.
    - **"The device answers only when the network fails, and only GETs, until phase 3."**
    - **The id rule gains its exception:** `change_log.seq`.
  - **Commands:** `npm run test:device`, `scripts/offline/serve.sh` + `walk.py`.
- [ ] **Step 2: Update the design spec.** In "The device's copy (pull)", record what was decided:
  - digests in place of marking reach changes;
  - network first in phase 2;
  - one tab owns the copy;
  - signed out wipes the copy;
  - a migration means one full pull;
  - `clone_sync` synced, `clone_marks` and `change_log` never;
  - the users redaction.

  Under "Phases", add a line under phase 2 saying what shipped.
- [ ] **Step 3: Update `docs/deployment.md`.**
  - The build now makes the device bundle too (`npm run build` does both, so `deploy.sh` needs no change).
  - Turning it off: deploy a `src/service-worker.ts` that calls `self.registration.unregister()` and clears its caches. A deploy without any service worker leaves the old one installed.
- [ ] **Step 4: Commit** — `git commit -m "docs: the device's copy, read only"`
- [ ] **Step 5: Ship, after asking the user.**
  1. Finish the branch (superpowers:finishing-a-development-branch).
  2. Take the backup (`docs/deployment.md`).
  3. Try migrations 0039–0040 on a copy of today's production backup.
  4. Deploy.
  5. Check on production that 41 migrations are applied and the log fills.
  6. Ask the user to try on the Android phone:
     - open the app online once and wait a few seconds;
     - switch on airplane mode;
     - open Today, Moves, a figure, Lessons, a lesson, Music, a song, Practice and Settings;
     - send a log: "Needs a connection" shows;
     - switch airplane mode off: everything works as before.

---

## Appendix: what was decided while building (2026-11-08)

Every ruling made during the build, with what it costs if wrong, and the minor findings left for later. The design spec's "Decided while building phase 2" holds the ones that shape the design.

### Rulings

- Pre-flight: Ruling: worker message types (DeviceState, in/out messages) live in src/lib/offline/protocol.ts beside WireRequest, not in src/device/worker.ts — src/lib must not import from the device bundle's entry — cost if wrong: a moved type.
- Pre-flight: Ruling: if a spec in Task 5 requires every PUBLIC_PATHS entry to be a route, Task 5 creates src/routes/shell/+page.ts (ssr=false, prerender=false) and an empty +page.svelte early; Task 7 keeps them — cost if wrong: none.
- Pre-flight: Ruling: NETWORK_TIMEOUT_MS = 4000 is exported from src/lib/offline/sw-route.ts — cost if wrong: a moved constant.
- Task 2: Ruling: a deleted comment that is kept (has live replies) goes with body '', author_id '' and deleted_by NULL, and adds no users row; one with no live reply is left out — matches listComments — cost if wrong: a device comment list that needs the author id of a deleted comment (none does today)
- Task 2: Ruling: other people's lesson_comment_hearts rows stay in scope (the count needs them; the key is (comment_id,user_id) so it can't be blanked); clone_sync on a group's rows and video_downloads.requested_by/error stay — low sensitivity, ids only — cost if wrong: a member's device knows who hearted a comment
- Task 1: Ruling: no separate re-review dispatched for the one-line type annotation (diff read in full by controller: `(v: unknown): v is SQLiteTable`) — cost if wrong: none at runtime, spec-only
- Task 3: Ruling (pre-dispatch): a teams row's redacted code depends on the person's role (team_members), which the log records on team_members, not teams; so pull treats a changed team_members key as a change to its team's teams row too — test: Luka demoted to member → his next pull carries teams.code hidden — cost if wrong: a demoted editor's device keeps the real code until the team row changes
- Task 4: Ruling: applyPull on any failure after ROLLBACK sets device_meta full='1' (its own statement, outside the rolled-back transaction) and rethrows; the next pullRequestOf sends no digests and the full replace can't conflict; Task 6's worker re-pulls once at once after such a failure — cost if wrong: one extra full pull after any apply error
- Task 7: Ruling (pre-dispatch, from Task 6's concern): the SW never posts 'changed' for POST /api/sync/pull (else pull→changed→pull loops) — cost if wrong: none
- Task 7: Ruling (pre-dispatch): POST /api/sync/pull is 'pass' in swRoute (no respondWith): the device worker's own pull must neither post 'changed' (loop) nor 'needs-connection' (a toast every offline pull) — cost if wrong: none
- Task 7: Ruling (pre-dispatch): Task 5 created no /shell route; Task 7 creates it (as the plan says)
- Task 7: Ruling: accept the implementer's deviation — uploads (chunk PUTs, recording/song POSTs) and /_app/version.json are 'pass' in swRoute, HEAD is 'pass' — keeps XHR upload progress and memory, and deploy detection; no 'changed' after an upload, the device catches up at the next pull — cost if wrong: an upload's new row shows offline only after the next pull (≤5 min)
- Task 7: Ruling: (1) is a deploy setting outside this worktree: Task 9 documents it in docs/deployment.md and the ship step checks the live header and asks the user before changing nginx/Cloudflare — cost if wrong: a broken SW lingers up to the edge TTL
- Task 7: Ruling: (2) fix now — the SW marks a client dirty when it posts 'changed' and leaves that client's reads untimed until the page reports the device pulled; the plan's 4 s rule yields to the global "online does not change" — cost if wrong: after a write, reads wait for the network as today until the next pull
- Task 7: Ruling: fix round 2 (re-review's minors + out-of-scope upload gap, all the "online change vanishes" class the global constraint forbids): the SW decides clearing alone (DeviceClients stores its own dirtyAt; device-pulled carries startedAt; clear only when startedAt ≥ dirtyAt); the page re-sends a dirty flag with device-state while a save is unpulled (survives SW replace); upload completions (recording, song, lesson-video chunk end) mark the page dirty through the same path — cost if wrong: reads stay untimed (as today) a little longer after saves
- Task 8: Ruling (implementer's, accepted): network pages' __data.json are a new 'network-read' swRoute (offline → needs-connection, not a rejected fetch crashing the error page) — cost if wrong: see final review
- Task 8: Ruling (implementer's, accepted): background writes (/api/opens, practice memory) go through backgroundWrite: nothing sent offline, `x-salsa-quiet` so the SW stays silent — cost if wrong: an open made offline isn't recorded
- Task 8: Ruling (implementer's, accepted): the walk cuts the network with its own relay (Playwright offline doesn't hold for a SW); walk.py takes <port> <upstream> <db> — cost if wrong: none (test tooling)
- Final: Ruling: fix all 4 Important (person switch pull vs old cursor/digests; sign-out/person change not wiping or gating the copy; 0041 trigger-migration trap for the next synced table; slow navigation getting the shell when no device is ready) plus Minor 1 (English/double toast offline), Minor 2 (prune by seq), Minor 4 (changed to every client) — all small, each a promise the plan makes
- Final: Ruling (fixer's, accepted): a page that can't know its person yet (the offline shell, a page the copy drew) is still answered from the copy — else offline can't work; sign-out and any other person wipe it — cost if wrong: none beyond the shell case
- Final: Ruling: parked — a sign-out no worker hears (login page closed within ~2 s, or another tab holding the lock) leaves the copy until the next online page or pull; opened offline before that, the shell is answered from the signed-out person's copy. Never mixes two people. Hardening option for phase 3: `Clear-Site-Data: "storage"` on /logout or a persisted signed-out marker — cost if wrong: a signed-out person's pages readable offline on that browser until it next goes online

### Deferred minors

- Task 1: minor (deferred): log.spec.ts dead imports kept alive with `void sets; void lessonFigures;`
- Task 1: minor (deferred): log.spec.ts _k guard only tested on composite keys; no explicit "unchanged key writes no d" assert
- Task 1: minor (deferred): trash.ts prune uses Promise.resolve().then(...) to catch a sync throw; try/catch simpler
- Task 2: minor (deferred): holds()/idsOf() assume single-id parent tables, unchecked
- Task 3: minor (deferred): pull.ts:68 `r[c] ?? null` hides a column the scope row lacks; no assert that scope row keys == columns
- Task 3: minor (deferred): pull.spec key-shape test runs `UPDATE default_styles SET dance = dance` without asserting it
- Task 3: minor (deferred): no test of one table's digest missing while others match (rule 4)
- Task 3: minor (deferred): pull.ts:50 unguarded JSON.parse of a team_members key
- Task 3: minor (deferred): TDD order — implementation written before specs ran; RED shown with a stub
- Task 4: minor (deferred): column filter dropping a key column also throws every pull — covered by the same full fallback
- Task 4: minor (deferred): applyPull's foreign_keys OFF and BEGIN sit outside the try; a BEGIN failure would leave FKs off
- Task 6: minor (deferred): take-over retries end after ~1.4 s; a closing tab that holds handles longer leaves the new tab 'failed' until reload
- Task 7: minor (deferred): shell cached without cookies → lang en + system theme offline until client applies the choice (Task 8 walk to look)
- Task 7: minor (deferred): native (non-enhanced) form POST offline shows raw JSON 503, no toast
- Task 7: minor (deferred): unused navigation preload warnings for 'precached' navigations
- Task 7: minor (deferred): each deploy re-downloads the 1.1 MB device bundle; worker starts on signed-out pages too
- Task 7: minor (deferred): noteSaved's postMessage and the following refresh fetch are not strictly ordered by spec (in practice the message is first)
- Task 8: minor (deferred): first device start 8–27 s under load; 41 migrations each in its own commit — one transaction would cut it
- Task 8: minor (deferred): offline error page outside a dance draws salsa's look for a bachata account; lesson "last edited by" missing offline (team_changes never synced)
- Task 8: minor (deferred): an unknown URL offline shows the offline page, not 404 (errorView: offline wins)
- Final: minor (deferred): clone_pairs not synced → offline Sync notice / "N copies differ" may differ from online
- Final: minor (deferred): a full syncScope + digest per pull on the single Node thread, a log insert per row written (bulk clone/rescue) — watch at scale
- Final: minor (deferred): writes to /api/ endpoints (not form actions) still get an English message offline; pages with their own refusal fallback show it beside the root toast
- Final: minor (deferred): pages rendering `result.data?.message ?? fallback` show their (some English, pre-existing) fallback beside the root toast offline; non-action JSON writes carry English messages
