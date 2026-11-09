# salsaapp agent guide

A personal practice companion for salsa and bachata, used from a browser-only
work PC and a phone. The two are separate **dances** — a hard wall through the
content, one codebase behind it. Son is a style inside salsa, not a third
dance: the same songs, the same beat grid, a different count pattern.

SvelteKit + SQLite (Drizzle) on one box, two apps on one backend
(`salsa.anotherroot.eu`, `bachata.anotherroot.eu`), a Python home worker
(`worker/`) and Android WebView apps (`android/`). Toolchain from the nix flake
(`nix develop`, or `direnv allow` once). Sister project with the same
conventions: `~/Projects/muscle_model`.

## Read more when you need it

- [`docs/features.md`](docs/features.md) — what is live, and the index of
  feature specs (one per area). Before changing an area, read its spec there;
  when a feature ships, add it there, not here.
- [`docs/superpowers/specs/2026-09-22-salsa-app-design.md`](docs/superpowers/specs/2026-09-22-salsa-app-design.md)
  — the main design. Read it before adding anything; keep it current when the
  design changes. Its "Known gaps" list (the player): check it before hunting a bug.
- [`docs/layout.md`](docs/layout.md) — every module and what it holds. Grep it
  for a module or concept before searching the tree; update it when you add one.
- [`docs/hard-rules.md`](docs/hard-rules.md) — the rules below in full, with
  reasons and exceptions. Read the matching rule before touching its area.
- [`docs/development.md`](docs/development.md) — running locally (songs in the
  dev db, the admin) and the one-off clip and icon scripts. [`docs/deployment.md`](docs/deployment.md) — deploy,
  app releases, the APK, the host.
- `scripts/shots/README.md` (screenshots), `src/routes/dev/kit` (every shared
  component, dev only), `docs/superpowers/design-kit/` (the design board).

## Commands

```sh
npm run dev           # DATA_DIR/DATABASE_PATH come from the flake (.data/)
npm run check         # prettier + eslint + svelte-check + build + vitest — must pass
npm run db:generate   # after editing src/lib/server/db/schema.ts
./scripts/deploy.sh   # see docs/deployment.md
# slots: C-1…C-9 in tmux; prefix C-a for reset-db and close slot (tmux_project)
nix develop .#android -c ./android/gradlew -p android test assembleDebug   # the APK
npm run test:device   # the suite on the WASM shim (slow; not in check)
scripts/offline/serve.sh <db> + walk.py   # every page offline (scripts/offline/README.md)
```

In dev `DANCE_HOSTS` is unset, so the path decides the dance (bachata login:
`/login?dance=bachata`); `ADMIN_EMAIL`/`ADMIN_PASSWORD` create an admin per dance.

## Building in a slot

Several slots share one 8-core machine, and the full check takes 10–40 minutes,
so a plan runs it twice, not after every task. This overrides a plan's "npm run
check must pass at the end of every task".

- Build natively: the slot's own agent builds every task, with one review of
  the whole branch at the end. Subagent-driven only when the user asks for it.
- After each task, check only what it touched: its specs
  (`npx vitest run <files>` or `npx vitest related <changed files>`), and
  `npx eslint` and `npx prettier --check` on the changed files. Commit.
- The full `npm run check` runs before the final review, and again after
  merging master in, right before the merge into master.
- Vitest at most `--maxWorkers=4`. A build killed with exit 143 (memory):
  `nix develop -c sh -c "systemd-run --user --scope -q -p MemoryMax=5G npx vite build"`,
  then `./scripts/deploy.sh --skip-build`.

## Layout in short (full map: docs/layout.md)

```
src/lib/<area>/          PURE, client-safe logic, one folder per area (schedule, day,
                         routines, graph, positions, clones, teams, levels, songs, video,
                         nav, picker, i18n, theme…). `now`/`tz` are arguments. Specs beside it
src/lib/server/          db (schema.ts, ids.ts), auth, data access, scope.ts (walls),
                         access.ts (reach), clones/, teams, entries, trash, changes
src/lib/components/      Svelte by area; ui/ shared components, ui/styles.ts class builders
src/lib/i18n/            t(), en/ and sl/ catalogs
src/routes/[dance]/      every page under its dance; (moves) and (today) are route groups.
                         Flat: login, settings, voice, api/, media servers (Range)
drizzle/                 generated migrations, applied at boot
worker/ android/ scripts/ static/clips static/icons   $DATA_DIR/ holds the media
```

## Hard rules (full text: docs/hard-rules.md)

**Time and the schedule**

- What is due is never stored: no due/last-done column, no cron, no frequency.
  It is replayed from the sets' days and faces (`sets.rating`, `src/lib/schedule/`).
  `today_picks` holds only a day's choices. A drill's Comes back is the one
  setting; due is still derived. A warm-up is outside the daily number.
- Elapsed time sorts; calendar days speak (`localDay`/`daysBetween`, user's zone).
  No `Date.now()` in `src/lib/day` or `src/lib/schedule`.
- Server code reads time through `serverNow()`, never `Date.now()`/`new Date()`
  (`server-clock.spec.ts`). Every instant in the db is integer epoch ms.
- One entry per exercise per local day (`saveDay`). The UI never says "set".
- Player timing is the AudioContext clock (25 ms look-ahead), not `setTimeout`;
  `scheduler.ts` decides what and when, never touches audio.

**Database**

- Every insert mints its id: `mintedId('<table>')`, one new row per statement;
  no raw SQL insert into an id table; a new table gets a mark trigger (0038).
- Data functions take `db` first; tests use `openDb(':memory:')`.
- A spec never touches `$DATA_DIR`. Setting `process.env.DATABASE_PATH` does NOT
  work; mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does.
- Never add a CHECK to an existing table (the drizzle rebuild fails). Additive
  `ADD COLUMN` only, invariants in the data function; read the generated SQL.
- Vestigial, never dropped (a drop is a rebuild): `figures.style` (use
  `style_tag`; don't widen `figures_style_ck`), `figures.eights` (use
  `length_counts`), `figures.parent_id`, `callable`, `call_text`,
  `end_position_id` (use `figure_end_positions`), `positions.neutral/slug/sort_order`,
  `exercises.every_days` (only a first gap).
- Archive, don't delete (`archived_at`). Hard deletes are a short, listed set;
  comments are soft-deleted; a group's hard deletes go to `team_trash` for 30 days
  (the route must not unlink the file). A linked spot and its video refuse delete
  (`assertUnlinked`). Check the list in docs/hard-rules.md before any delete.
- A `figures` row is a figure, a `figure_groups` row a move; the last figure
  leaving archives its move. Show a figure with `figureLabels`.

**Files, worker, media**

- Recordings: one streamed raw-body request, cap 95 MiB (`limits.ts`, Cloudflare).
  Lesson videos: 8 MiB chunks, 1 GiB cap, file size is the resume offset (409 +
  `x-received-bytes`). Both served with HTTP Range. `BODY_SIZE_LIMIT` on the host.
- The server runs no Python and no ML: the home worker drains `/api/worker/*`.
  Never judge the worker against `vite dev` (no cross-site POST check there).
- The count is the user's anchors; Beat This!'s downbeats only suggest.

**UI**

- A filled-in form uses `use:guarded` (not `use:enhance`; one-tap forms keep
  it). Never a browser `confirm()`.
- A built control's colour is the builder's: never append `text-*` or
  `.replace()`; `swap()`, in a `.ts` module (`class-rules.spec.ts`).
- List-column forms post to an explicit action URL (`/{dance}/songs?/addUrl`).
- A clipping card uses `GROUP` or `CLIP`. After a one-tap removal,
  `focusAfterRemoval`. A refresh after a sheet or the player closes:
  `refreshWhenSettled()`. Safe area through `--safe-*`, never `env()`.
- Raise `PAGE_EPOCH` (`src/lib/epoch.ts`) in the commit that breaks older open pages.
- Words go through `t()`, in both catalogs (en, sl), read at call time; every
  component is checked for bare English (`no-english.spec.ts`, `EXEMPT` with a
  reason) and every server refusal too (`refusals-guard.spec.ts`). Slovenian:
  vikanje, `slCount`, decimal comma, » «, glossary in `sl/index.ts`. User content
  and the count are never translated; machines keep English.
- Dates on screen built by hand (`format.ts`), never `toLocaleDateString`.
- Levels hide entry points, never routes; ask `levels.ts` (`levelShown`), never
  compare level strings.
- The type owns its page: `contentFor`/`practiceFor`, never branch on type.
- Components never import `$lib/server`; shared shapes in `src/lib/types.ts`.

**Auth and walls**

- Deny-by-default auth (`hooks.server.ts`); public routes go in `PUBLIC_PATHS`.
- Offline: every table is classified in `src/lib/sync/tables.ts` (a newly synced
  one gets its triggers in a NEW custom migration, `scripts/sync-triggers.ts <table>`;
  never edit 0042); no row
  leaves the server outside `syncScope`; every GET endpoint is classified in
  `src/lib/offline/routes.ts`, and every write too (`ACTIONS`, `ENDPOINT_WRITES`):
  device/queued writes run on the device first and replay via `/api/sync/push`
  (made-at clock, device ids, per-field merge on own rows, `replayName`); a
  group's row online goes to the server; cookie-setting actions and Sign out are
  network-only; every non-GET holds `writeGate` (docs/hard-rules.md).
- A device token signs in on `/api/` only (not pages, not `/api/worker/`); hash only.
- An account belongs to one dance (`users.dance`): `wallOf` 404s another dance;
  a flat route takes the account's dance, never the request's.
- Dance is the wall through the content; person or group the wall inside it.
  Root tables carry `dance` and exactly one of `user_id`/`team_id`; children
  derive both from their parent. Write and filter via `scope.ts` (`Space`,
  `ownedBy`, `inSpace`), never `.dance` alone; reads ask `access.ts`. Another's
  id and a missing one: the same 404. Own rows point at group rows only via
  `usableOf`; `crossRefs` must stay `[]`.

**Groups, copies, positions**

- Every group mutation: `logChange` in its transaction, listed in `MUTATIONS`
  (`changes.spec.ts`). A save on a group row carries `seen` for every field it writes.
- What grows a published lesson calls `autoAddPending` (`GROWTH`, `auto-add.spec.ts`).
- Reach shrinks, entries follow: `reconcileEntries` (and the rescue); leaving
  runs Keep before the membership goes.
- Opens are recorded from the page (`POST /api/opens`), never in a load.
- Group songs differ from own songs; everything serving a song asks `songAccess`.
- Clones: links are row ids, genes only find members; one member per place;
  re-points explicit (`repoint`); saves on copies go through `flowing`/`flowAfter`.
- Twins are views (lists, pickers, pages only), except twinned positions are one
  hold in a person's graph (`buildGraph`).
- Positions are optional: an empty side fits anything (`meet`); the graph
  compares by family (`gene_id`); nobody starts with any.
