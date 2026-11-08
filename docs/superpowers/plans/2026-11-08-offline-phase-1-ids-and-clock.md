# Offline phase 1: ids and the clock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every insert into an integer-id table gets its id from the runtime's
own block (`id = slot × 2³² + n`), and every server read of the time goes
through one function. Both are enforced by specs. Nothing changes for a person
using the app.

**Architecture:**
- A new table, `id_marks (tbl, slot, hi)`, holds the highest id used per table
  and slot. An `AFTER INSERT` trigger on each of the 26 id tables keeps it
  current, so explicit ids from a device or a restore are counted too.
- Each id column gets a Drizzle `$defaultFn` that returns a SQL expression:
  "this table's mark in my slot, plus one".
- The server keeps slot 0, the slot of every existing row.
- `serverNow()` in `src/lib/server/server-clock.ts` replaces `Date.now()` and
  `new Date()` in server code. Phase 3's replay will set it.

**Tech Stack:** SvelteKit 2, Drizzle 0.45 on better-sqlite3, drizzle-kit
migrations, vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-offline-design.md` ("Ids the
device can make", "Offline changes (push)", Phases → 1), with
`docs/superpowers/specs/2026-11-07-offline-spike-findings.md`.

## Global Constraints

- Work on branch `offline` in this worktree. Commit, never push.
- **Additive only.** A new table and `CREATE TRIGGER`s; no column changes and
  no CHECK. Read every generated SQL file before committing it (CLAUDE.md's
  CHECK rule).
- **Ids:** `id = slot × 2³² + n`. Slots run 0 to 2²¹ − 1, so every id stays
  below 2⁵³. Slot 0 is every existing row, and the server keeps minting
  there (see the ruling below).
- `users` and `sessions` keep their text ids. Composite-key tables are
  untouched.
- **Never reuse an id**, including one deleted before this phase.
  Recently deleted restores rows with their own ids.
- **One clock:** server code reads the time only through `serverNow()`.
  "Server code" means:
  - every `.ts` under `src/lib/` except `*.svelte.ts` and `*.spec.ts`;
  - `src/routes/**/+page.server.ts`, `+layout.server.ts` and `+server.ts`;
  - `src/hooks.server.ts`.
- Data functions take `db` first; specs use `openDb(':memory:')` and never
  touch `$DATA_DIR`.
- No PAGE_EPOCH change: nothing an open page sends changes.
- `npm run check` (prettier, eslint, svelte-check, build, vitest) passes at
  the end. Run node tooling inside `nix develop -c …`. If vitest gets
  SIGTERM in parallel on this machine, run it in shards
  (`npx vitest run --shard=i/8`) and say so in the ledger.

**Ruling carried into this plan (the spec is updated in Task 5).** The spec
says "the server takes a slot of its own". The server keeps slot 0 instead:
- device blocks start at slot 1, so they never overlap slot 0;
- URLs, test fixtures and existing ids stay as they are.

Cost if wrong: one `setIdSlot` call at boot later.

## Review Focus

1. **The highest id was deleted before the migration.** Expected: the next
   id continues after it, not into it (seeded from `sqlite_sequence`).
   Test: Task 1.
2. **Recently deleted's Restore after newer rows took ids.** Expected: the
   row comes back with its own id, with no clash. Test: Task 2.
3. **A device's id (slot ≥ 1) is inserted on the server.** Expected: the
   server's next ids stay in slot 0 and continue its own sequence. Tests:
   Tasks 1 and 2.
4. **One insert carrying several new rows into an id table.** Expected: a
   loud UNIQUE error, never a silent drop. Each row's id is worked out
   before any row goes in, so they collide. `onConflictDoNothing` would turn
   that collision into a silent drop. Test: Task 2; audit: Task 2, Step 5.
5. **Ids of 2³² and above** in route params, JSON and the access guards.
   Expected: found exactly. Test: Task 2.

---

### Task 1: The id block: slots, marks, the migration

**Files:**
- Create: `src/lib/server/db/ids.ts`
- Create: `src/lib/server/db/ids.spec.ts`
- Modify: `src/lib/server/db/schema.ts` (add `idMarks`; nothing else yet)
- Create: `drizzle/0034_*.sql` (generated: the `id_marks` table)
- Create: `drizzle/0035_id_marks_triggers.sql` (custom: seed and triggers)
- Modify: `src/lib/server/db/migrate.spec.ts` (Review Focus 1)

**Interfaces:**
- Produces, from `src/lib/server/db/ids.ts`:
  - `SLOT_SIZE = 2 ** 32`
  - `MAX_SLOT = 2 ** 21 - 1`
  - `setIdSlot(slot: number): void` — throws `RangeError` unless an integer
    in 0..MAX_SLOT
  - `idSlot(): number` — default 0
  - `slotOf(id: number): number`
  - `mintId(table: string): SQL` — reads the slot at call time
  - `mintedId(table: string)` — the column builder:
    `integer('id').primaryKey({ autoIncrement: true }).$defaultFn(() => mintId(table))`
- Produces, from `schema.ts`: `idMarks`, the table `id_marks`, with
  `tbl text not null`, `slot integer not null`, `hi integer not null`, and
  primary key `(tbl, slot)`.

`mintId`'s SQL, exactly (bound parameters):

```sql
(select coalesce((select hi from id_marks where tbl = ? and slot = ?), ? ) + 1)
--                                           table        slot   slot * SLOT_SIZE
```

- [ ] **Step 1: Write the failing tests in `ids.spec.ts`.**

Use `openDb(':memory:')` and the raw client (`db.$client`). Reset with
`setIdSlot(0)` in `afterEach`.

- `slotOf(3 * 2 ** 32 + 7)` is `3`.
- `setIdSlot` throws for `-1`, `1.5` and `2 ** 21`, and takes `MAX_SLOT`.
- `id_marks` has a trigger per id table:
  - `select name from sqlite_master where type = 'trigger' and name like '%_id_mark'`
    gives exactly the 26 tables listed in Step 4, each as `<table>_id_mark`.
- Through `db.$client`, insert into `songs` (fill its NOT NULL columns)
  with ids 1, then 2, then `3 * 2 ** 32 + 5`. Expected `id_marks` rows:
  - `{ tbl: 'songs', slot: 0, hi: 2 }`
  - `{ tbl: 'songs', slot: 3, hi: 3 * 2 ** 32 + 5 }`
- `db.run(sql\`insert into songs (id, …) values (${mintId('songs')}, …)\`)`
  after those inserts gets id `3` (slot 0 continues past 2). After
  `setIdSlot(3)` it gets `3 * 2 ** 32 + 6`.

- [ ] **Step 2: Run them, and see them fail.**
  Run: `nix develop -c npx vitest run src/lib/server/db/ids.spec.ts`
  Expected: FAIL (`./ids` does not exist).

- [ ] **Step 3: Write `ids.ts`, and add `idMarks` to `schema.ts`.** Then
  generate: `nix develop -c npm run db:generate`. Expected: one new
  migration that creates `id_marks` and nothing else. Read it.

- [ ] **Step 4: Write the custom migration.**
  `nix develop -c npx drizzle-kit generate --custom --name=id_marks_triggers`
  creates the empty file, already in the journal. Fill it, with
  `--> statement-breakpoint` between statements (the migrator runs one
  statement per chunk):

```sql
INSERT INTO id_marks (tbl, slot, hi)
  SELECT name, 0, seq FROM sqlite_sequence
  WHERE seq < 4294967296 AND name IN (<the 26 tables>);
--> statement-breakpoint
CREATE TRIGGER today_picks_id_mark AFTER INSERT ON today_picks BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('today_picks', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'today_picks' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
… one trigger per table …
```

The 26 tables:
- `today_picks`, `device_tokens`, `login_attempts`, `figure_groups`,
  `figures`, `recordings`, `positions`, `spot_position_links`;
- `routines`, `routine_steps`, `songs`, `exercises`, `sets`, `lessons`,
  `lesson_videos`, `video_spots`, `spot_links`;
- `links`, `song_links`, `video_downloads`, `count_takes`,
  `storage_requests`, `teams`, `lesson_comments`, `team_changes`,
  `team_trash`.

Why the seed reads `sqlite_sequence`: it is AUTOINCREMENT's high-water
mark, so ids deleted before this phase are not handed out again.

- [ ] **Step 5: Add Review Focus 1 to `migrate.spec.ts`.**

Add `it('continues each table's ids after the highest ever used (0035)')`.
Use the file's `migrationsThrough('0033_material_echo')` pattern:
1. Insert three `songs` rows.
2. Delete the one with id 3.
3. `openDb` the file.
4. Insert a song with `db.run` and `mintId('songs')` (there is no
   `$defaultFn` until Task 2).

Expected: id `4`.

- [ ] **Step 6: Run the tests.**
  Run: `nix develop -c npx vitest run src/lib/server/db/`
  Expected: PASS. `migrate.spec` and `bootstrap.spec` still pass.

- [ ] **Step 7: Commit:**
  `git add src/lib/server/db drizzle && git commit -m "ids: id_marks and the per-slot id block"`

---

### Task 2: Every id column mints its id

**Files:**
- Modify: `src/lib/server/db/schema.ts` (26 id columns → `mintedId('<table>')`)
- Modify: the call sites that insert several new rows at once into an id
  table (the suite finds them)
- Modify: `src/lib/server/db/ids.spec.ts`
- Modify: `src/lib/server/trash.spec.ts`

**Interfaces:**
- Consumes: `mintedId`, `setIdSlot`, `SLOT_SIZE` (Task 1).
- Produces the rule every later phase relies on. An insert into an id table
  carries:
  - one new row, or
  - rows that all carry their own ids (a restore, a move).

- [ ] **Step 1: Write the failing tests in `ids.spec.ts`.**

- `it('mints 1, 2 in a fresh database, through the data functions')`:
  `createCustomExercise(db, U1_SALSA, …)` twice; the ids are `[1, 2]`.
- `it('never reuses a deleted id')`:
  1. Log three sets on one exercise.
  2. Delete the third with its data function (sets are hard-deleted).
  3. Log another.

  Expected id: `4`.
- `it('keeps minting in slot 0 after a device's row arrives')` (Review
  Focus 3):
  1. Insert a set through Drizzle with an explicit
     `id: 7 * SLOT_SIZE + 1`.
  2. Log a set through `logSet`.

  Expected: its id is the previous slot-0 id + 1.
- `it('mints in the slot it is given')`: after `setIdSlot(5)`, a new custom
  exercise's id is `5 * SLOT_SIZE + 1`. In the same test (Review Focus 5):
  - `requireExerciseAccess(db, locals, { dance: 'salsa' }, String(id), 'read')`
    finds it, with `locals` shaped as in `owner-wall.spec.ts`;
  - `JSON.parse(JSON.stringify({ id })).id === id`.
- `it('refuses an insert of several new rows')` (Review Focus 4):
  `db.insert(sets).values([a, b]).run()` with no ids throws with
  `code` starting `SQLITE_CONSTRAINT`.

In `trash.spec.ts`, beside "comes back with the same ids", add
`it('comes back with its own id after newer rows took ids')` (Review
Focus 2):
1. Trash the newest lesson video.
2. Add another video.
3. Restore.

Expected: the restored video has its old id, and the new one's id is
greater.

- [ ] **Step 2: Run them, and see them fail.**
  Run: `nix develop -c npx vitest run src/lib/server/db/ids.spec.ts src/lib/server/trash.spec.ts`
  Expected:
  - "mints in the slot it is given" FAILS (SQLite's autoincrement ignores
    the slot);
  - "refuses an insert of several new rows" FAILS (the insert succeeds).

- [ ] **Step 3: Swap each of the 26 id columns to `mintedId('<table>')`.**
  Then `nix develop -c npm run db:generate`. Expected: "No schema changes"
  (`$defaultFn` is app-side). If it generates anything, stop and find out
  why.

- [ ] **Step 4: Run the whole suite, and fix each multi-row insert it
  exposes.** Turn each into one insert per row, inside the transaction it
  is already in. Known candidates:
  - `clones/clone.ts:845` (`figure_end_positions`: composite key, so
    probably fine);
  - `clones/move.ts:334–339` (check whether those rows carry ids);
  - `countTakes.ts:128`.

  Run: `nix develop -c npx vitest run > <workspace>/suite.log 2>&1; tail -30 <workspace>/suite.log`
  Expected: every failure is a UNIQUE/PRIMARY KEY constraint at an insert.
  Fix those until the suite is green.

- [ ] **Step 5: Audit `onConflictDoNothing` on id tables.**

  For every `onConflictDoNothing()` / `onConflictDoUpdate()` whose table is
  one of the 26, confirm it inserts one row. Several new rows would drop
  silently, not fail.

  Write one ledger line per site:
  `Task 2: audit <file:line> <table> one row|fixed`.

- [ ] **Step 6: Run the tests.**
  Run: the Step 2 command, then the whole suite.
  Expected: PASS, everything.

- [ ] **Step 7: Commit:**
  `git commit -am "ids: every id column mints from the runtime's slot"`

---

### Task 3: Specs that keep it so

**Files:**
- Create: `src/lib/server/server-sources.ts` (spec helper, like `test-walls.ts`)
- Modify: `src/lib/server/db/ids.spec.ts`

**Interfaces:**
- Produces:
  `serverSources(): { path: string; code: string }[]`
  - It covers the server-code file set from Global Constraints, read from
    disk.
  - Comments are stripped from `code`: `/* … */` blocks, and `//` to end of
    line when at line start or after whitespace.
  - Task 4 uses it too.

- [ ] **Step 1: Write the failing scans in `ids.spec.ts`.**

- `it('gives every integer id column a minted default naming its own table')`:
  - Use `getTableConfig` over every `SQLiteTable` export of `schema.ts`.
  - For every table whose `id` column is an integer primary key, the
    column's `defaultFn` exists.
  - `new SQLiteSyncDialect().sqlToQuery(defaultFn())` has `params[0]` equal
    to the table's name.
  - The set of such tables equals the 26 that have triggers.
- `it('has no raw SQL insert into an id table')`: no `serverSources()` code
  matches `/insert\s+(or\s+\w+\s+)?into\s+["'`]?(<the 26>)\b/i`.
- `it('lets no later migration insert into an id table without its id')`:
  - Scan `drizzle/*.sql` numbered above 0035.
  - Every `INSERT INTO <one of the 26>` must have a column list that names
    `id`.

To see the scans fail first:
- remove `mintedId` from one table, temporarily;
- write a throwaway `drizzle/9999_x.sql` holding
  `INSERT INTO songs (title) …`.

- [ ] **Step 2: Run them, and see each fail on its planted breakage.**
  Run: `nix develop -c npx vitest run src/lib/server/db/ids.spec.ts`
  Expected: three FAILs naming the table, or the file.

- [ ] **Step 3: Remove the planted breakage** (restore the column; delete
  the throwaway SQL file).

- [ ] **Step 4: Run the tests.**
  Run: the Step 2 command.
  Expected: PASS.

- [ ] **Step 5: Commit:**
  `git add src/lib/server && git commit -m "ids: specs that every insert mints"`

---

### Task 4: One clock for the server

**Files:**
- Create: `src/lib/server/server-clock.ts`
- Create: `src/lib/server/server-clock.spec.ts`
- Modify: every file in the server-code set that reads `Date.now()` or
  `new Date()` (about 66 files, 183 reads, `schema.ts`'s `now` included)

**Interfaces:**
- Consumes: `serverSources()` (Task 3).
- Produces: `serverNow(): number` (epoch ms) from
  `$lib/server/server-clock`. It's named this way because `clock` is taken
  (`$lib/format`, `$lib/clock`) and many functions have a parameter called
  `now`. Phase 3 adds the replay override inside this module; nothing else
  changes then.

- [ ] **Step 1: Write the failing scan in `server-clock.spec.ts`.**

  `it('reads the time only through serverNow')`:
  - no `serverSources()` file except `server-clock.ts` matches
    `/\bDate\.now\b|new Date\(\s*\)/`;
  - the failure lists `path:line` for each read.

  Add `it('is the wall clock')`: `serverNow()` is within 50 ms of
  `Date.now()`.

- [ ] **Step 2: Run it, and see it fail.**
  Run: `nix develop -c npx vitest run src/lib/server/server-clock.spec.ts`
  Expected: FAIL (the module doesn't exist). Once Step 3 creates it, it
  FAILs with about 183 locations.

- [ ] **Step 3: Write `server-clock.ts`.** `serverNow` returns `Date.now()`.
  The doc comment says it is the one place server code reads the time, and
  that replay will set it.

- [ ] **Step 4: Codemod the server-code set.**
  - `Date.now()` → `serverNow()`
  - `new Date()` → `new Date(serverNow())`
  - a bare `Date.now` reference → `serverNow`
  - Add `import { serverNow } from '$lib/server/server-clock';` after the
    file's last top-level import (a relative path inside
    `src/lib/server/db/schema.ts` if `$lib` isn't resolvable for
    drizzle-kit; check with `npm run db:generate`, which must still say
    "No schema changes").
  - Use perl over the file list the scan prints. Then run
    `nix develop -c npx prettier --write` on the changed files.

- [ ] **Step 5: Run the tests.**
  - Run: the Step 2 command. Expected: PASS.
  - Then: `nix develop -c npm run check > <workspace>/check.log 2>&1; tail -30 <workspace>/check.log`.
    Expected: passes. Specs that fake time with `vi.useFakeTimers` /
    `vi.setSystemTime` still work, since `serverNow` reads `Date.now()`.

- [ ] **Step 6: Commit:**
  `git commit -am "clock: server code reads the time through serverNow"`

---

### Task 5: Docs

**Files:**
- Modify: `CLAUDE.md` (Hard rules; Layout)
- Modify: `docs/superpowers/specs/2026-11-07-offline-design.md` ("Ids the
  device can make"; "never synced")

- [ ] **Step 1: In `CLAUDE.md` Hard rules, add two rules.**
  - **Every insert mints its id.** An integer id comes from `mintedId`
    (`src/lib/server/db/ids.ts`): this runtime's slot in `id_marks`, plus
    one. An insert carries one new row, or rows with their own ids. No raw
    SQL insert into an id table, and no migration insert without `id`.
    `ids.spec.ts` checks all three.
  - **Server code reads the time through `serverNow()`**
    (`src/lib/server/server-clock.ts`), never `Date.now()` or
    `new Date()`. `server-clock.spec.ts` checks it. Pure modules still take
    `now` as an argument.

  In Layout, add the two files.

- [ ] **Step 2: In the design spec,** replace "The server takes a slot of
  its own" with the ruling:
  - the server keeps slot 0, and device slots start at 1;
  - `id_marks` and its triggers;
  - inserts carry one new row.

  Add `id_marks` to "Never synced": each database keeps its own marks.

- [ ] **Step 3: Run the checks.**
  Run: `nix develop -c npm run check > <workspace>/check.log 2>&1; tail -5 <workspace>/check.log`
  Expected: passes.

- [ ] **Step 4: Commit:**
  `git commit -am "docs: ids from slots and one server clock"`
