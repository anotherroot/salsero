# Groups follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the missing group routines in Routines, and add group mode, notifications and group songs, as the spec describes.

**Architecture:** Group mode is a per-dance cookie naming a group the person edits; one server helper (`spaceOf`) turns it into the `Space` the list pages and their create actions use, re-checked on every request, and the root layout paints the navy band and the Mine tab from layout data. Notifications are derived per request from a new `opens` table and existing timestamps, never stored as flags. Group songs give `songs` a `team_id` and a `shared_at`, and route every song read (audio, grid, player, practice, picker) through one `songAccess` in `access.ts`.

**Tech Stack:** SvelteKit 2, Svelte 5, SQLite with Drizzle, Vitest. Run everything inside `nix develop -c …`.

**Spec:** `docs/superpowers/specs/2026-11-03-groups-follow-ups-design.md` (mockups: https://claude.ai/artifact/Pqdc9XEXQHjS8poJd6asr8, boards B, E and the "Design 1" rows). Read `CLAUDE.md` first: its hard rules bind every task.

## Global Constraints

- Every instant is an integer of epoch ms; nothing "new" or "unread" is stored as a flag (the urgency rule). The `opens` table stores when a person opened something, nothing more.
- Data functions take `db` first. Specs never touch `$DATA_DIR`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does.
- Migrations are additive only: `ALTER TABLE … ADD COLUMN` and `CREATE TABLE/INDEX`. Never a CHECK on an existing table, never a rebuild. Read the generated SQL before committing it (`npm run db:generate`).
- Every group mutation calls `logChange` with a real actor in its own transaction, and is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`.
- A save on a group row carries `seen` covering every field it writes (`src/lib/server/clash.ts`).
- Reach shrinks, entries follow: whatever takes a song or a lesson item out of someone's reach runs `reconcileEntries` in the same transaction.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- A colour on a built control is the builder's; new colours are tokens in `src/lib/theme/tokens.ts`, mirrored in `src/routes/layout.css`, checked by `stylesheet.spec.ts` and `tokens.spec.ts`.
- A form someone fills in uses `use:guarded`; one-tap forms use `use:enhance`; a refresh after a sheet closes goes through `refreshWhenSettled()`.
- Group mode only changes which space a list reads and a create writes. Who may read or write a row is still decided by `access.ts` and the `require*Access` guards.
- The group mode cookie is never trusted: every load and every action that uses it re-checks it with `groupModeOf`.
- Copy: "Mine", "Work in", "Members don't see it yet", "Share with the class", "Stop sharing", "Working in", "New", "N new". Group mode band label: "<group name> · group".
- `npm run check` must pass at the end of every task.

## Review Focus

1. **A song a person must not hear:** a group's draft song, another group's song, or a song of a group the person left, asked for through `/audio/[file]`, `/[dance]/songs/[id]/grid`, the player's `?song=`, or a practice entry's song setting. Each must 404 or be refused. Pinned in Task 7 (`song access` spec) and Task 9 (route spec).
2. **A stale or forged group mode cookie:** a group the person was removed from or demoted in, a deleted group, a group of the other dance, a group they are only a member of, or a non-number. It must read as Mine, clear the cookie, and land no write in that group. Pinned in Task 2 and Task 4.
3. **Opening a lesson, then looking at the dot:** the response that renders the lesson must not still count that lesson as new. Pinned in Task 5 (`whatsNew` excludes the item being opened) and Task 6.
4. **Stop sharing, then Share again:** members' practice entries get the song back, except a member who picked another song in between. Pinned in Task 8.
5. **A deleted group being purged:** its songs and their audio files go with it, and a group's storage counts its songs (archived included, as for a person). Pinned in Task 7.

---

## File structure

- Create `src/lib/server/group-mode.ts`: reading, checking and clearing the group mode cookie; `spaceOf`; the person's group choices.
- Create `src/lib/teams/mode.ts`: PURE. Cookie name, which paths leave group mode, the safe return path, the band label.
- Create `src/routes/[dance]/group-mode/+server.ts`: POST to switch group mode.
- Create `src/lib/components/shell/GroupModeButton.svelte`: the band's group icon and the "Work in" sheet.
- Create `src/lib/server/whats-new.ts`: `recordOpen`, `whatsNew`.
- Create `src/lib/server/song-share.ts`: share, stop sharing, delete and restore a group song; song drops.
- Modify (main ones): `src/lib/server/routines.ts`, `figures.ts`, `songs.ts`, `access.ts`, `scope.ts`, `storage.ts`, `entries.ts`, `integrity.ts`, `team-purge.ts`, `deleted`/`trash.ts` (restore), `changes.ts`, `clash.ts`, `exercises.ts`, `db/schema.ts`; the routes under `src/routes/[dance]/{figures,routines,lessons,songs,groups,player,coverage}`, `src/routes/[dance]/+layout.server.ts`, `src/routes/+layout.svelte`, `src/routes/audio/[file]`, `src/routes/api/songs`, `src/routes/api/worker/songs/[id]/audio`; `src/lib/components/shell/BottomNav.svelte`, `src/lib/components/ui/Screen.svelte`; `src/lib/theme/tokens.ts`, `src/routes/layout.css`.

---

### Task 1: Group routines in Routines (the bug)

**Files:**
- Modify: `src/lib/server/routines.ts` (beside `listRoutines`, ~line 247)
- Modify: `src/routes/[dance]/routines/+page.server.ts`, `src/routes/[dance]/routines/+page.svelte`
- Test: `src/lib/server/routines.spec.ts`, `src/routes/[dance]/routine-forms.spec.ts` (or a new `src/routes/[dance]/routines/added.spec.ts`)

**Interfaces:**
- Consumes: `addedReach(db, userId, teamId): Reach` (access.ts:243), `getTeam`, `TeamRef` (types.ts:13), `RoutineItem` (types.ts:348).
- Produces: `listAddedRoutines(db: Db, wall: Wall): { team: TeamRef; routines: RoutineItem[] }[]`.

- [ ] **Step 1: Write the failing data test** in `routines.spec.ts`: `it('lists the routines of lessons the person added, per group')`. Setup: team 1 (`createTeam(db,'u1','salsa','Salsa Tuesdays',1)`), `joinTeam(db,'u2',1,2)`; a group routine `R` and a second group routine `S` (both `createRoutine(db, T1_SALSA, …)`); a published lesson linking `R` (`linkRoutine`); u2 adds the lesson (`addLesson`). Assert `listAddedRoutines(db, U2_SALSA)` equals `[{ team: { id: 1, name: 'Salsa Tuesdays' }, routines: [expect.objectContaining({ id: R.id })] }]` (S, unlinked, is absent). Second case: archive `R` → the team entry is absent (empty groups are dropped). Third: u2's own routines never appear in it.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/routines.spec.ts` — expect FAIL (`listAddedRoutines` not exported).
- [ ] **Step 3: Implement `listAddedRoutines`** mirroring `listAddedFigures` (figures.ts:692): team ids from `lessonAdds` ⋈ `lessons` for the wall's user and dance with `team_id` not null; per team `addedReach(...).routines`; select those routines (not archived) with the same columns `listRoutines` returns; drop teams with none; sort by team name then id.
- [ ] **Step 4: Run** the test — PASS.
- [ ] **Step 5: Route + page.** `routines/+page.server.ts` load returns `groups: listAddedRoutines(db, wall)`. `+page.svelte` renders after the person's list, per group, the same section markup `figures/+page.svelte` uses for `data.groups` (lines ~210–222: `<section aria-label>`, the `people` icon heading, a `GROUP` list), each row a link to `/{dance}/routines/{id}` showing the name and `plural(slots,'slot')`. No loops/breaks badges for group routines (their graph is the group's). The empty state shows only when both lists are empty.
- [ ] **Step 6: Route spec** (`it('shows a routine from an added lesson under its group')`): load the Routines page as u2 and assert `data.groups[0].routines[0].id === R.id`. Mutation check: revert the load to omit `groups` — the spec must fail.
- [ ] **Step 7: Run** `nix develop -c npm run check` — PASS. Commit: `fix(groups): added lessons' routines show in Routines`.

---

### Task 2: Group mode — the cookie, the checks, the switch

**Files:**
- Create: `src/lib/teams/mode.ts`, `src/lib/teams/mode.spec.ts`
- Create: `src/lib/server/group-mode.ts`, `src/lib/server/group-mode.spec.ts`
- Create: `src/routes/[dance]/group-mode/+server.ts`, `src/routes/[dance]/group-mode/group-mode.spec.ts`
- Modify: `src/routes/[dance]/+layout.server.ts`, `src/lib/types.ts`

**Interfaces:**
- Consumes: `roleOf(db,userId,teamId)`, `getTeam`, `wallOf`, `Space`, `TeamSpace`, `tabFor(path,dance)` (nav/tabs.ts:41).
- Produces:
  - `src/lib/types.ts`: `type GroupMode = { teamId: number; name: string; role: 'owner' | 'editor' }`; `type GroupChoice = { teamId: number; name: string; role: 'owner' | 'editor'; people: number }`.
  - `src/lib/teams/mode.ts`: `groupCookie(dance: DanceSlug): string` → `'group_' + dance`; `leavesGroupMode(path: string, dance: DanceSlug): boolean` (true when `tabFor(path, dance) === 'today'`); `returnPath(to: string | null, dance: DanceSlug): string` (a same-dance path beginning `/${dance}` and not `//`, else `/${dance}/figures`); `groupLabel(name: string): string` → `` `${name} · group` ``.
  - `src/lib/server/group-mode.ts`:
    - `groupChoices(db: Db, userId: string, dance: DanceSlug): GroupChoice[]` — live groups (not deleted, not purged) of this dance where the person is owner or editor, by name then id.
    - `groupModeOf(db: Db, userId: string, dance: DanceSlug, cookies: Cookies): GroupMode | null` — parses the cookie; returns null **and deletes the cookie** unless it names a live group of this dance where `roleOf` is owner or editor.
    - `spaceOf(db: Db, params: { dance: string }, locals: App.Locals, cookies: Cookies): Space` — the `TeamSpace` (`actorId` = the person) when `groupModeOf` gives a group, else `wallOf(params, locals)`.
  - `[dance]/+layout.server.ts` load additionally returns `groupMode: GroupMode | null` and `groupChoices: GroupChoice[]` (empty for a person with none). When `leavesGroupMode(url.pathname, dance)` the load deletes the cookie and returns `groupMode: null`.
  - `POST /[dance]/group-mode` form fields `team` (`'mine'` or a team id) and `to`: sets the cookie (path `/`, httpOnly, sameSite lax, one year) only if `groupChoices` contains the team; `'mine'` deletes it; anything else → 404. Answers `303` to `returnPath(to, dance)`.

- [ ] **Step 1: Pure tests** (`mode.spec.ts`): `groupCookie('salsa') === 'group_salsa'`; `leavesGroupMode('/salsa', 'salsa') === true`, `('/salsa/exercises/3','salsa') === true`, `('/salsa/figures','salsa') === false`, `('/salsa/groups/1','salsa') === false`; `returnPath('/salsa/routines','salsa') === '/salsa/routines'`, `returnPath('//evil.example','salsa') === '/salsa/figures'`, `returnPath('/bachata/figures','salsa') === '/salsa/figures'`, `returnPath(null,'salsa') === '/salsa/figures'`; `groupLabel('Salsa Tuesdays') === 'Salsa Tuesdays · group'`.
- [ ] **Step 2: Server tests** (`group-mode.spec.ts`, a fake `Cookies` with `get/set/delete` recording calls). Cases, each asserting the return and whether `delete` was called:
  - owner and editor of a live salsa group → `GroupMode` with that role, no delete;
  - a member of the group → null, deleted;
  - the group deleted (`deleteTeam`) → null, deleted; an owner of a deleted group is still refused;
  - a bachata group under `dance = 'salsa'` → null, deleted;
  - `'abc'`, `'0'`, a missing team id → null, deleted; no cookie → null, no delete;
  - demoted from editor to member after the cookie was set (`setRole`) → null, deleted;
  - `spaceOf` returns `{ dance:'salsa', teamId:1, actorId:'u2' }` for an editor's valid cookie and `U2_SALSA` otherwise;
  - `groupChoices` lists owner/editor groups of the dance only, skips deleted and member-only ones.
- [ ] **Step 3: Run** both specs — FAIL.
- [ ] **Step 4: Implement** `mode.ts`, `group-mode.ts`, the endpoint and the layout additions to the interfaces above.
- [ ] **Step 5: Endpoint spec** (`group-mode.spec.ts` under the route, db mocked): POST `team=1&to=/salsa/routines` as an editor → 303 to `/salsa/routines` and the cookie set to `1`; as a member → 404 and no cookie set; `team=mine` → cookie deleted, 303; `to=//x` → 303 to `/salsa/figures`.
- [ ] **Step 6: Run** all three specs — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(groups): group mode cookie, checks and switch`.

---

### Task 3: Group mode — the look (band, tab bar, the button)

**Files:**
- Modify: `src/lib/theme/tokens.ts`, `src/routes/layout.css`, `src/lib/theme/stylesheet.spec.ts`, `src/lib/theme/tokens.spec.ts`
- Modify: `src/routes/+layout.svelte` (the `data-dance` wrapper, ~line 176), `src/routes/[dance]/+layout.svelte` (theme-color meta)
- Modify: `src/lib/components/ui/Screen.svelte`, `src/lib/components/shell/BottomNav.svelte`
- Create: `src/lib/components/shell/GroupModeButton.svelte`
- Modify: `src/lib/components/moves/MovesScreen.svelte`, `src/routes/[dance]/lessons/+page.svelte`, `src/routes/[dance]/songs/+page.svelte` (put the button in the band's `right`, before +)
- Modify: `src/routes/dev/kit/` (show the group band and the Mine tab)

**Interfaces:**
- Consumes: layout data `groupMode`, `groupChoices` (Task 2); `groupLabel` (Task 2); POST `/[dance]/group-mode`.
- Produces:
  - `tokens.ts`: `GROUP: Record<Scheme, Pick<Theme, 'band' | 'band-ink' | 'band-small' | 'on-cream' | 'accent' | 'accent-text' | 'accent-soft' | 'on-accent' | 'status' | 'inverse-accent'>>`, the same keys the bachata block overrides. Light band `#26345E`, band ink `#EAF0FF`; the rest chosen to pass `tokens.spec.ts`'s contrast checks in both schemes.
  - `layout.css`: a `[data-dance][data-group]` block (outranks `[data-dance='bachata']`) and `:root[data-theme='dark'] [data-dance][data-group]`, carrying `GROUP.light` and `GROUP.dark`.
  - Root layout wrapper gets `data-group` when `page.data.groupMode` is set.
  - `BottomNav` reads `page.data.groupMode`: when set, the Today slot is a plain link to `/${dance}` showing the `back` icon and "Mine" in `text-accent-text`, no background (spec: "a plain Mine button … with no fill"); it takes the 2fr column like a lit tab.
  - `Screen` reads `page.data.groupMode`: when set it draws a 6px striped edge at the top of the band and, above the title, a line with the `people` icon and `groupLabel(name)` in `text-band-small`. The striped edge uses a token (e.g. `--color-band-ink` at low opacity), never a hard-coded colour.
  - The Groups list (`src/routes/[dance]/groups/+page.svelte`) stays the list of all the person's groups in group mode; the row of the group being worked in shows a "Working in" chip (from `page.data.groupMode.teamId`). Opening a group opens its page and does not change group mode.
  - `GroupModeButton`: renders nothing when `groupChoices` is empty. One choice and not in group mode → a form posting `team=<id>` and `to=<current path>`. Otherwise it opens a `Sheet` titled "Work in" listing "Mine" and each choice (name; "Owner"/"Editor" · `plural(people,'person','people')`), the current one checked; each row is a one-tap `use:enhance` form to the endpoint. Icon `people`, label "Work in a group" (outside) / "Switch group" (inside).

- [ ] **Step 1: Token tests first.** In `tokens.spec.ts` add `it('defines the group palette in both schemes and it passes contrast')` asserting every listed key exists in `GROUP.light`/`GROUP.dark` and the band/band-ink and accent/on-accent pairs reach 4.5:1 (use `contrast.ts`). In `stylesheet.spec.ts` add `it('carries the group palette')` matching `/\[data-dance\]\[data-group\]\s*\{([^}]*)\}/` against `GROUP.light` and the dark selector against `GROUP.dark`.
- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement** the tokens and CSS. Run — PASS.
- [ ] **Step 4: Components.** Wire the root layout attribute, `Screen`, `BottomNav`, `GroupModeButton` and the three bands as above. `[dance]/+layout.svelte` uses the group band colour for `theme-color` in group mode.
- [ ] **Step 5: View helper test.** Anything the components decide that is not markup lives in `mode.ts` and is tested there: add `workInRows(choices: GroupChoice[], current: number | null): { teamId: number | 'mine'; name: string; meta: string; on: boolean }[]` with a test: Mine first, `on` on the current one (or Mine when `current` is null), meta `'Owner · 14 people'`.
- [ ] **Step 6: Manual look.** `npm run dev`, set the cookie through the button on a seeded group, check Moves, Lessons, Music, the Groups tab and a lesson page in light and dark, and Mine returning to Today with the red band. Note what you saw in the task report.
- [ ] **Step 7:** `nix develop -c npm run check` — PASS. Commit: `feat(groups): group mode band, Mine tab and Work in sheet`.

---

### Task 4: Group mode — lists and creating in the group

**Files:**
- Modify: `src/routes/[dance]/figures/+page.server.ts`, `+page.svelte`; `src/routes/[dance]/routines/+page.server.ts`, `+page.svelte`; `src/routes/[dance]/lessons/+page.server.ts`, `+page.svelte`; `src/routes/[dance]/coverage/+page.server.ts`
- Modify: `src/lib/server/access.ts` (add `publishedReach`), `src/lib/server/figures.ts`, `src/lib/server/graph.ts` if `buildGraph` takes only a `Wall`
- Test: `src/lib/server/access.spec.ts`, `src/routes/[dance]/group-mode-lists.spec.ts` (new)

**Interfaces:**
- Consumes: `spaceOf` (Task 2), `listFigures(db, space, filter)`, `listRoutines(db, space)`, `routineShapes(db, space)`, `createFigure(db, space, …)`, `createRoutine(db, space, …)`, `createLesson(db, space, input)`, `listTeamLessons(db, userId, teamId, role)` (lessons.ts:406), `readNewLesson(form, today, frequency)`.
- Produces:
  - `publishedReach(db: Db, teamId: number): Reach` — `reachFrom(db, teamId, <ids of the team's published, unarchived lessons>)`.
  - Figures page data, in group mode: `figures` from `listFigures(db, teamSpace, filter)`, each item with `membersSee: boolean` (true when at least one of its live variations is in `publishedReach(...).variations`); `groups: []`; no coverage or tagged tiles (`coverage: null`, `tagged: null`); `groupMode` from the layout.
  - Routines page data, in group mode: `routines` from `listRoutines(db, teamSpace)` with `loops`/`breaks` from the group's graph, each with `membersSee` (in `publishedReach(...).routines`); `groups: []`.
  - Lessons page data, in group mode: `lessons` from `listTeamLessons(db, userId, teamId, role)`; the create action makes a draft (`readNewLesson(form, today, false)`, `createLesson(db, teamSpace, input)`), redirecting to the lesson.
  - Every create action (`figures` `create`, `routines` `create`, `lessons` `create`) takes its space from `spaceOf(getDb(), params, locals, cookies)`, never from layout data.
  - `coverage` load: in group mode, `303` to `/${dance}/figures`.
  - In the page markup: a row with `membersSee === false` adds "Members don't see it yet" (eye-off icon) to its meta, and, when any row does, a note at the top: "Anything not in a published lesson stays with the editors. Link it from a lesson and members get it."

- [ ] **Step 1: `publishedReach` test** (`access.spec.ts`): a published lesson linking routine R and variation V, a draft lesson linking routine D, an unlinked routine U → `publishedReach(db,1).routines` has R only; `.variations` has V; archiving the published lesson empties both.
- [ ] **Step 2: Route specs** (`group-mode-lists.spec.ts`, db mocked, a cookie jar fake):
  - `it('creates a figure in the group in group mode')`: u2 editor of team 1 with the cookie, POST `create` on figures → the new figure group and variation have `teamId === 1`, `userId === null`, and `team_changes` has a row with `actor = 'u2'`.
  - `it('creates in Mine when the cookie names a group the person only belongs to')`: u3 member, same cookie → `userId === 'u3'`, `teamId === null`, and the cookie was deleted.
  - Same pair for routines and lessons (the lesson draft has `publishedAt === null`).
  - `it('lists only the group\'s routines in group mode, marking what members don\'t see')`: R linked from a published lesson → `membersSee: true`; U → `false`; u2's own routine absent.
  - `it('sends coverage back to figures in group mode')`: 303.
  - Mutation check: make one create action read `wallOf` instead of `spaceOf` — its spec must fail.
- [ ] **Step 3: Run** — FAIL.
- [ ] **Step 4: Implement** to the interfaces. If `buildGraph(db, wall)` filters figures by the person only, widen its parameter to `Space` using `ownedBy`; its existing callers keep passing a `Wall`.
- [ ] **Step 5: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(groups): Moves and Lessons list and create in the group`.

---

### Task 5: Notifications — what's new, derived

**Files:**
- Modify: `src/lib/server/db/schema.ts` (table `opens`); generate `drizzle/0023_*.sql`
- Create: `src/lib/server/whats-new.ts`, `src/lib/server/whats-new.spec.ts`
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (record the open)

**Interfaces:**
- Produces:
  - Table `opens`: `user_id` text not null, `kind` text not null (`'lesson' | 'song'`), `item_id` integer not null, `opened_at` integer not null; primary key `(user_id, kind, item_id)`.
  - `recordOpen(db: Db, userId: string, kind: 'lesson' | 'song', itemId: number, now: number): void` — upsert, `opened_at = now`.
  - `type WhatsNew = { lessons: Set<number>; songs: Set<number>; byTeam: Map<number, number> }`.
  - `whatsNew(db: Db, userId: string, dance: DanceSlug, opening?: { kind: 'lesson' | 'song'; id: number }): WhatsNew` — for the person's **current** memberships of live groups of this dance (a `team_members` row, team not deleted or purged):
    - a lesson is new when it is published, not archived, `published_at > joined_at`, and there is no `opens` row with `opened_at >= published_at`;
    - or when the person added it (`lesson_adds`) and some `lesson_figures`, `lesson_routines` or `lesson_exercises` row of it, or a `spot_links` row on a section of one of its videos, has `created_at > max(opened_at ?? 0, added_at)`;
    - a song is new when it is the group's, `shared_at` is set, not archived, `shared_at > joined_at`, and there is no `opens` row with `opened_at >= shared_at` (the `songs` columns arrive in Task 7: until then this branch returns nothing; write it in Task 9);
    - `opening` is left out of the result (the response that opens it must not count it);
    - `byTeam` counts lessons and songs per team. A few queries in total, never one per lesson.
  - The lesson page load calls `recordOpen(db, userId, 'lesson', lesson.id, Date.now())` for a group lesson the person can read, before returning.

- [ ] **Step 1: Write the failing tests** (`whats-new.spec.ts`, `openDb(':memory:')`, team 1 with owner u1, u2 joined at `t=100`):
  - published at 200, never opened → `lessons` has it, `byTeam.get(1) === 1`;
  - published at 50 (before joining) → absent;
  - a draft → absent; archived → absent;
  - opened at 250 after publishing at 200 → absent; opened at 150, published at 200 (an editor who saw the draft) → present;
  - added at 300 (opened at 300), then `linkRoutine` at 400 → present; opened again at 500 → absent;
  - a section link (`spot_links`) created after the last open on a video of an added lesson → present;
  - `opening: { kind:'lesson', id }` → that lesson absent even though new;
  - u2 leaves the group → nothing from it; the group deleted → nothing;
  - a bachata group's lesson under `dance='salsa'` → absent.
  - Use explicit `created_at`/`published_at`/`joined_at` values (update the rows) so order is never decided by `Date.now()`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Schema + migration.** Add `opens` to `schema.ts`; `nix develop -c npm run db:generate`; read `drizzle/0023_*.sql`: it must be one `CREATE TABLE` (and nothing else).
- [ ] **Step 4: Implement** `recordOpen` and `whatsNew`; wire `recordOpen` into the lesson page load.
- [ ] **Step 5: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(groups): what's new in a person's groups`.

---

### Task 6: Notifications — dot, pills, markers

**Files:**
- Modify: `src/routes/[dance]/+layout.server.ts`, `src/lib/components/shell/BottomNav.svelte`
- Modify: `src/routes/[dance]/groups/+page.server.ts`, `+page.svelte`
- Modify: `src/routes/[dance]/groups/[id]/+page.server.ts`, `+page.svelte`, `src/lib/components/lessons/LessonRow.svelte` (an `isNew` prop)
- Modify: `src/lib/teams/view.ts` (pure wording)
- Test: `src/lib/teams/view.spec.ts`, `src/routes/[dance]/groups/whats-new.spec.ts` (new)

**Interfaces:**
- Consumes: `whatsNew` (Task 5).
- Produces:
  - Layout data `groupsNew: boolean`: `whatsNew(db, userId, dance, opening).byTeam.size > 0`, where `opening` is derived from the URL (`/[dance]/lessons/<id>` → that lesson; `/[dance]/songs/<id>` → that song). The load reads `url.pathname`, so it reruns on every navigation.
  - `BottomNav`: a dot on the Groups tab when `page.data.groupsNew` (a 10px `bg-accent` circle with a ring of the bar's background, `aria-label` "New in your groups" on the link's text). The tab's `<a>` becomes `relative`.
  - Groups list data: each `TeamItem` gains `newCount: number`; the row shows `newPill(n)` before the chevron.
  - Group page data: each lesson gains `isNew: boolean`; `LessonRow` shows a "New" pill.
  - `view.ts`: `newPill(n: number): string | null` → `null` for 0, `'New'` is not used here, `'1 new'`, `'3 new'`.

- [ ] **Step 1: Tests.** `view.spec.ts`: `newPill(0) === null`, `newPill(1) === '1 new'`, `newPill(12) === '12 new'`. Route spec: u2 with one new lesson → Groups list `teams[0].newCount === 1`, group page `lessons.find(l => l.id === L).isNew === true`, layout `groupsNew === true`; loading `/salsa/lessons/L`'s layout data with that URL gives `groupsNew === false`, and afterwards the Groups list gives `newCount === 0`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5:** `nix develop -c npm run check` — PASS. Commit: `feat(groups): a dot on Groups and "N new" on each group`.

---

### Task 7: Group songs — ownership, access, storage, worker

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`songs.team_id`, `songs.shared_at`, index; table `song_drops`); generate `drizzle/0024_*.sql`
- Modify: `src/lib/server/songs.ts`, `src/lib/server/access.ts`, `src/lib/server/scope.ts`, `src/lib/server/storage.ts`, `src/lib/server/integrity.ts`, `src/lib/server/team-purge.ts`
- Modify: `src/routes/api/worker/songs/[id]/audio/+server.ts`, `src/routes/api/songs/+server.ts`, `src/routes/[dance]/songs/+page.server.ts` (`addUrl`, `retry`)
- Test: `src/lib/server/songs.spec.ts`, `src/lib/server/access.spec.ts`, `src/lib/server/storage.spec.ts`, `src/lib/server/team-purge.spec.ts`, the worker route spec

**Interfaces:**
- Produces:
  - `songs`: `team_id` integer (references `teams.id`, nullable), `shared_at` integer (nullable); index `songs_team_idx (team_id, dance)`. Exactly one of `user_id`, `team_id` (checked by `ownerIntegrity`, not a CHECK).
  - Table `song_drops`: `exercise_id` integer not null, `song_id` integer not null, `dropped_at` integer not null; primary key `(exercise_id, song_id)`.
  - `songs.ts`: `createSongFromUrl(db, space: Space, …)` and `createSongFromUpload(db, space: Space, …)` (owner from `ownerValues(space)`); `listSongs(db, space: Space): SongItem[]` (by `ownedBy`; in a group, drafts first then shared, `SongItem` gains `sharedAt: number | null`).
  - `access.ts`: `songAccess(db: Db, userId: string, song: { userId: string | null; teamId: number | null; sharedAt: number | null; archivedAt: number | null }): Access` — the person's own → `'edit'`; a group's: owner or editor of the live group → `'edit'` (drafts included); a current member → `'read'` when `sharedAt !== null` and not archived; anyone else → `null`.
  - `scope.ts`: `requireSongAccess(db, locals, params, id, need: 'read' | 'edit'): { song: Song; space: Space; access: 'edit' | 'read' }` (404 for a wrong dance, an archived song, or too little access). `requireSongInWall` stays for callers that are personal only.
  - `storage.ts`: `teamUsedBytes` adds `sum(songs.size_bytes) where team_id = ?`; `listStorageItems` for a team lists its songs.
  - `integrity.ts`: `'songs'` joins `ROOTS`.
  - `team-purge.ts`: purging a team deletes its songs (and their `song_drops`, and nulls `exercises.song_id` pointing at them) and unlinks their audio files through the injected dirs, as it does for videos.
  - Worker `songs/[id]/audio`: the owner is `ownerOfRow(song)`; only when that throws does the job fail permanently ("Song has no owner").
  - `api/songs` POST takes an optional `?team=<id>`: allowed only when `roleOf` is owner or editor of a live group of that dance (else 404); the owner is then `{ teamId }`. Room is `roomForOwner` of that owner.
  - Songs page `addUrl`/`retry` use `spaceOf` and the space's owner for `roomForOwner`.

- [ ] **Step 1: Tests first.**
  - `access.spec.ts` `describe('song access')`: owner u1, editor u2, member u3, outsider u4, former member u5 (joined then `leaveTeam`). Draft song: u1/u2 `'edit'`, u3/u4/u5 `null`. Shared: u3 `'read'`, u4/u5 `null`. Archived shared: u3 `null`. Group deleted: u3 `null`. A person's own song: owner `'edit'`, anyone else `null`.
  - `storage.spec.ts`: a group song of 10 bytes → `usedBytesOf(db,{teamId:1})` grows by 10; an archived one still counts; the person's usage does not change.
  - `team-purge.spec.ts`: a deleted team with a song and an entry using it → after `purgeTeams`, the song row is gone, the entry's `song_id` is null, and the audio file in the temp dir is unlinked.
  - Worker route spec: a group song in `waiting_download` accepts the upload and charges the group; a song with neither owner fails permanently.
  - `integrity.spec.ts`: a song with both owners set is reported.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Schema + migration.** Edit `schema.ts`, `npm run db:generate`, read `drizzle/0024_*.sql`: two `ALTER TABLE songs ADD …`, one `CREATE INDEX`, one `CREATE TABLE song_drops`. Nothing that rebuilds `songs` (it has incoming foreign keys: a rebuild cannot run, see CLAUDE.md).
- [ ] **Step 4: Implement** to the interfaces. Every existing caller of the changed song functions keeps passing its `Wall` (a `Wall` is a `Space`).
- [ ] **Step 5: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(groups): songs can belong to a group`.

---

### Task 8: Group songs — share, stop sharing, delete, restore, drops

**Files:**
- Create: `src/lib/server/song-share.ts`, `src/lib/server/song-share.spec.ts`
- Modify: `src/lib/server/entries.ts` (`reconcileEntries`), `src/lib/server/changes.ts` + `src/lib/types.ts` (`ChangeRootKind` gains `'song'`; `DeletedKind` gains `'song'`), `src/lib/server/clash.ts` (`songSeen`), the Recently deleted list and restore (`src/lib/server/trash.ts` `listTrash`/`restoreDeleted`, `src/lib/teams/deleted.ts`), `src/lib/server/changes.spec.ts` (`MUTATIONS`)

**Interfaces:**
- Produces:
  - `shareSong(db: Db, space: TeamSpace, id: number, now: number): boolean` — sets `shared_at = now` on a ready, unarchived group song; revives drops (below); `logChange` verb `'share'`.
  - `unshareSong(db, space: TeamSpace, id, now): { ok: true } | null` — `shared_at = null`; runs `reconcileEntries(tx, teamId, now)`; `logChange` verb `'unshare'`.
  - `deleteGroupSong(db, space: TeamSpace, id, now): boolean` — `archived_at = now` (the song shows in Recently deleted); `reconcileEntries`; `logChange` verb `'delete'`.
  - `restoreDeleted` handles `'song'`: un-archives, revives drops; `logChange` verb `'restore'`.
  - `songUsers(db: Db, songId: number): number` — how many people's live entries use the song (for the warning).
  - `reconcileEntries(tx, teamId, now, userId?)` also: for entries (of `userId`, or of everyone) whose `song_id` is a song of this team that the entry's person can no longer read (`songAccess` null), insert `song_drops (exercise_id, song_id, dropped_at = now)` (ignore a duplicate) and set `song_id = null`.
  - `reviveSongDrops(tx: Db, songId: number): void` — for each drop of this song, if the entry's `song_id` is still null and its person now can read the song, set it back; delete those drop rows.
  - `songSeen(song): Seen` over `title`, `artist`, `style`, `anchorsJson`, `tempoFactor`, `sampleStartS` (as the other `*Seen` helpers).
  - Song edits on a group song (the song page's `tap`, `removeAnchor`, `resetAnchors`, `tempo`, `sample`, `sampleAuto`, `update`) carry `seen`, are checked with `checkSeen`, and log verb `'edit'` with the actor. (Wired in Task 10's route; the data side here: `setAnchors`, `setTempoFactor`, `setSampleStart`, `updateSongMeta` gain an optional `space?: Space, now?: number` and log when `space` is a team.)

- [ ] **Step 1: Tests** (`song-share.spec.ts`): team 1, editor u2, members u3 and u4 each with an entry using shared song S.
  - `unshareSong` → both entries `song_id === null`, two `song_drops` rows, one `team_changes` row verb `'unshare'` actor u2.
  - u4 picks another song meanwhile (`setPracticeSettings` to their own song) → `shareSong` again → u3's entry has S back, u4's keeps their own; no drop rows left for S.
  - `deleteGroupSong` then `restoreDeleted('song', S)` → u3 has S back.
  - u3 leaves the group (`leaveTeam`) → u3's entry `song_id === null`; `shareSong` later does not give it back while u3 is not a member.
  - `songUsers(db, S) === 2` before, `0` after unsharing.
  - A clash: two editors' `seen` differ on `anchorsJson` → the second save is refused (`checkSeen`).
  - Add every new mutation (share, unshare, delete, restore, edit) to `MUTATIONS`; the existing iteration must cover them.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5:** `nix develop -c npm run check` — PASS. Commit: `feat(groups): share, stop sharing and restore group songs`.

---

### Task 9: Group songs — using them (player, practice, picker, audio, copy)

**Files:**
- Modify: `src/lib/server/songs.ts` (`songChoices`), `src/lib/types.ts` (`PickerSong`), `src/lib/server/exercises.ts` (`setPracticeSettings`), `src/routes/[dance]/player/+page.server.ts`, `src/routes/audio/[file]/+server.ts`, `src/routes/[dance]/songs/[id]/grid/+server.ts`, the picker components (`src/lib/components/player/Setup.svelte`, `PracticePanel.svelte`, `src/lib/components/exercises/LogShell.svelte`, and the song search in `src/lib/songs/search.ts`)
- Create: `copySong` in `src/lib/server/songs.ts` (or `copy-song.ts`)
- Modify: `src/lib/server/whats-new.ts` (the song branch)
- Test: `src/lib/server/songs.spec.ts`, `src/lib/server/exercises.spec.ts`, `src/routes/[dance]/songs/group-songs.spec.ts` (new), `whats-new.spec.ts`

**Interfaces:**
- Produces:
  - `PickerSong` gains `group: string | null` (the group's name, null for the person's own).
  - `songChoices(db, wall)`: the person's ready songs, then the ready, shared, unarchived songs of each group they currently belong to in this dance, with `group` set. The picker shows them under a heading per group (pure grouping in `src/lib/songs/search.ts`, tested).
  - `setPracticeSettings`: a `songId` is accepted when `songAccess(db, exercise.userId, song)` is `'edit'` or `'read'` and the song is ready (the existing "a group's exercise never holds a song" refusal stays).
  - Player `?song=`: accepted when it is in `songChoices` (which now includes shared group songs).
  - `/audio/[file]` and `/[dance]/songs/[id]/grid`: authorised by `songAccess` (`'read'` or better), else 404.
  - `copySong(db: Db, userId: string, songId: number, now: number, files: CopyFiles, freeDiskBytes = Infinity): Promise<{ song: Song } | { refused: Room }>` — readable group song → a new personal song (title, artist, style, beats, downbeats, anchors, tempo, sample, the audio hard-linked under a new name), charged with `roomForOwner(db, {userId}, sizeBytes, freeDiskBytes)`. `linkCopy` (files.ts:57) checks `RECORDING_FILE_RE`: give it the file-name pattern as a parameter (default `RECORDING_FILE_RE`) and pass `AUDIO_FILE_RE` here.
  - `whatsNew` song branch as Task 5 specifies.

- [ ] **Step 1: Tests.** Route spec `group-songs.spec.ts`: member u3 GETs `/audio/<shared file>` → 200; `/audio/<draft file>` → 404; outsider → 404; former member → 404; grid likewise; player `?song=<draft>` → 404; `?song=<shared>` → 200. `exercises.spec.ts`: u3 sets a shared group song on their entry → true; a draft → false; another group's shared song (not a member) → false. `songs.spec.ts`: `copySong` makes a personal song with the same anchors and a different audio file name, charged to u3; refused over the limit. `whats-new.spec.ts`: a song shared after joining and not opened → in `songs` and counted; opened after sharing → absent.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5:** `nix develop -c npm run check` — PASS. Commit: `feat(groups): members practise to class songs`.

---

### Task 10: Group songs — the screens

**Files:**
- Modify: `src/routes/[dance]/songs/+page.server.ts`, `+page.svelte` (group mode list; members' group sections)
- Modify: `src/routes/[dance]/songs/[id]/+page.server.ts`, `+page.svelte` (`requireSongAccess`; read-only for `'read'`; Share / Stop sharing / Delete for an editor; Make my own copy; `recordOpen`; `seen` on every edit action)
- Modify: `src/routes/[dance]/groups/[id]/+page.server.ts`, `+page.svelte` (a "Class songs" section with New markers)
- Modify: `src/lib/songs/library.ts` (pure wording), `src/lib/teams/view.ts`
- Test: `src/lib/songs/library.spec.ts`, `src/routes/[dance]/songs/group-songs.spec.ts`

**Interfaces:**
- Consumes: Tasks 7–9.
- Produces:
  - Songs list in group mode: `listSongs(db, teamSpace)` with drafts under "Drafts · N" (a Draft chip) and shared under "Shared with the class · N" (meta adds "used by N" from `songUsers`). The upload sheet sends `?team=<id>` in group mode.
  - Songs list outside group mode: the person's songs, then one section per group (`listSharedSongs(db, userId, dance): { team: TeamRef; songs: SongItem[] }[]` in `src/lib/server/songs.ts`: shared, unarchived songs of live groups the person currently belongs to, by group name), each song with a New pill from `whatsNew`.
  - Song page: `canEdit = access === 'edit'`. For `'read'`: no tap controls, no grid editing, no actions but `copy` ("Make my own copy") and practise; a note "<group>'s song. The count is the teacher's." For an editor of a group song: a pinned "Share with the class" (draft) or a ⋯ "Stop sharing"; "Delete" in ⋯. Stop sharing and Delete open a sheet; when `songUsers > 0` it says `songUseWarning(n)`.
  - `library.ts`: `songUseWarning(n: number): string` → `"Used in 1 person's practice. They'll switch to count only until you share it again."`, `"Used in 4 people's practice. …"`.
  - The song page load calls `recordOpen(db, userId, 'song', id, now)` for a group song.
  - Group page: "Class songs · N" (shared songs for members; drafts too for editors, marked Draft), each with a New pill.

- [ ] **Step 1: Tests.** `library.spec.ts` for `songUseWarning(1)` and `(4)`. Route spec: a member's song page load has `canEdit === false` and posting `tap` returns 404; an editor's `share` makes members see it in their Music sections; `copy` makes a personal song and redirects to it; loading the page as a member records an open (the Groups list's count drops).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Manual look** as Task 3 Step 6, for Music in group mode, a draft song, Stop sharing's warning, a member's Music and read-only song page, and the picker. Note it in the report.
- [ ] **Step 6:** `nix develop -c npm run check` — PASS. Commit: `feat(groups): class songs in Music and on the group page`.

---

### Task 11: Documentation

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-02-groups-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (Music and songs), `docs/deployment.md`

- [ ] **Step 1:** `CLAUDE.md`:
  - the "Live" paragraph gains group mode, notifications and class songs;
  - the layout list gains `group-mode.ts`, `teams/mode.ts`, `whats-new.ts`, `song-share.ts` and the `group-mode` route;
  - the "Archive, don't delete" rule notes that a group song's delete is an archive restored from Recently deleted;
  - the person-or-group wall rule lists `songs` among the root tables with both owners (and drops `count_takes` from that list: it is person-only);
  - the songs rule: `deleteSong` refusal is for a person's own song; a group song is withdrawn with a warning and members' entries drop to count only (`song_drops` brings it back).
- [ ] **Step 2:** The groups spec: "songs are personal, they pick their own" becomes the class playlist rule, pointing at the follow-ups spec. The app design spec: Music's two sections. `docs/deployment.md`: migrations 0023–0024 are additive; take the backup first as always.
- [ ] **Step 3:** `nix develop -c npm run check` — PASS. Commit: `docs(groups): group mode, notifications and class songs`.

---

## Risks found while planning

- **R1 Cookie trusted in an action.** Layout data can be a request old. Every create action calls `spaceOf` itself (Task 4 has a mutation check for it).
- **R2 The dot one navigation late.** The layout load runs beside the page load that records the open. `whatsNew(…, opening)` leaves out the item in the URL (Task 6 test).
- **R3 A personal row seen in group mode.** A deep link to your own figure while in group mode paints it navy. Accepted: group mode lists only group rows, so you only reach your own by a direct link; leaving through Mine fixes the look. Not worth a per-row colour.
- **R4 Songs reached five ways.** Audio, grid, player, practice settings and the picker each decided "is this song yours" on their own. Task 9 routes all five through `songAccess`; Review Focus 1 pins them.
- **R5 Purge and storage.** `teamUsedBytes` and `team-purge.ts` knew nothing of songs; a deleted group would leave its songs' files behind forever. Task 7.
- **R6 `linkCopy` refuses audio names.** It checks the recording pattern; Task 9 passes the pattern in.
- **R7 Today in group mode.** Practice is personal, so any page under Today (`tabFor === 'today'`, including exercise pages) leaves group mode in the layout load, not only the Mine tap.
