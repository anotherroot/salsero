# The Group View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In a slot this plan is built **natively** (CLAUDE.md, "Building in a slot").

**Goal:** Replace navy group mode with a group view that looks like the dance (group row, filled tab bar, the side's cream card) and that follows where you are: a page of one thing decides by its row, lists carry `?in=<team>`, Back gives back the view.

**Architecture:** The group cookie goes. A pure module (`$lib/teams/group-view.ts`) names the view parameter and rewrites hrefs; the server (`$lib/server/group-mode.ts`) turns a request (route, params, url) into a re-checked `GroupMode | null`. Item pages decide from their row; lists and their actions from `in`. The frame (band row, slim band, tab bar, side) reads `page.data.groupMode`, plus a client-only override while a group drill is being edited.

**Tech Stack:** SvelteKit 2.70 (per-search-param load tracking), Svelte 5 runes, Drizzle/SQLite, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-group-view-design.md`

## Global Constraints

- The view parameter is `in`, a team id: `/salsa/figures?in=4`. Re-checked on every request: group alive, of this dance, the person `owner` or `editor`, level `groupModeShown`. A failing `in` is ignored (own view), never an error.
- No load writes anything to do with the view (preload). No cookie for it any more.
- Only `url.searchParams.get('in')` is read in layouts (SvelteKit tracks that one param), never all of `url`.
- Today's pages, Settings, the admin, the player: own view. A group drill: see Task 5.
- Navy is gone: `GROUP` in `tokens.ts`, both `[data-dance][data-group]` blocks and the navy `--gutter-band` in `layout.css`, `data-group-edge`. The dance's colours everywhere.
- Words through `t()` in en and sl; Slovenian counts with `slCount`. `no-english.spec.ts` must pass.
- Raise `PAGE_EPOCH` to 13 (old open pages post to the cookie switch and hold navy CSS).
- Specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does; never `$DATA_DIR`.
- After each task: its own specs (`npx vitest run <files> --maxWorkers=4`), `npx eslint` and `npx prettier --check` on changed files, commit. Full `npm run check` only in Task 8.

## Review Focus

1. **A stale `in`** (removed as editor, group deleted, a member's group, another dance's group, garbage like `in=abc`): the page shows the own view and an action posted with it creates nothing in the group. Test in Task 2.
2. **The trail reopening an old address**: Moves was last seen as `/salsa/figures?in=4`; from your own view the Moves tab must open `/salsa/figures` (and from a group's view `?in=` that group). Test in Task 4.
3. **A filter or search on a group's list** (Figures, Routines, Positions, Music, the desktop column beside an item) keeps `in`. Test in Task 4.
4. **Your own row while the URL has `in`** (a typed `/salsa/figures/12?in=4` for your own figure): own view; `in` never puts a row page in a group the row is not in. Test in Task 2.
5. **Old open pages** posting to `/[dance]/group-mode`: still land, now on the address with or without `in`. Test in Task 3.

---

### Task 1: The pure view module

**Files:**

- Create: `src/lib/teams/group-view.ts`, `src/lib/teams/group-view.spec.ts`
- Modify: `src/lib/teams/mode.ts` (`workInRows` gains `href`), its spec if any

**Interfaces:**

- Produces:
  - `VIEW_PARAM = 'in'`
  - `viewParam(search: URLSearchParams): number | null`: the `in` value when it is `^[1-9][0-9]{0,9}$`, else null.
  - `withView(href: string, teamId: number | null): string`: sets or removes `in`, keeps every other param, the hash, and a `?/action` key first (`/salsa/lessons?/create` → `/salsa/lessons?/create&in=4`).
  - `ROW_ROUTES: Record<string, RowKind>` and `rowKindOf(routeId: string | null): RowKind | null`, `RowKind = 'lesson' | 'figure' | 'routine' | 'position' | 'move' | 'song' | 'drill' | 'group'`. Route ids: `/[dance]/lessons/[id]`, `/[dance]/(moves)/figures/[id]`, `/[dance]/(moves)/routines/[id]`, `/[dance]/(moves)/positions/[id]`, `/[dance]/(moves)/moves/[id]`, `/[dance]/songs/[id]`, `/[dance]/(today)/exercises/[id]`, and `/[dance]/groups/[id]` with every route under it (people, storage, history/[kind]/…, deleted).
  - `viewedList(path: string, dance: DanceSlug): boolean`: the lists whose content follows the view: figures, routines, positions (and `/positions/map`, `/positions/none`), coverage, lessons, songs (and `/songs/imports/…`).
  - `workInRows(choices, current, path)` rows: `{ teamId, name, meta, on, href }`, `href = withView(path, teamId === 'mine' ? null : teamId)`.

- [ ] **Step 1: Write the failing tests** (`group-view.spec.ts`)

```ts
it('reads a valid in only', () => {
	expect(viewParam(new URLSearchParams('in=4'))).toBe(4);
	for (const bad of ['in=0', 'in=abc', 'in=-1', 'in=4.5', 'in=12345678901', ''])
		expect(viewParam(new URLSearchParams(bad))).toBeNull();
});
it('sets and drops in, keeping the rest', () => {
	expect(withView('/salsa/figures?q=adi&style=salsa', 4)).toBe('/salsa/figures?q=adi&style=salsa&in=4');
	expect(withView('/salsa/figures?in=4&q=adi', null)).toBe('/salsa/figures?q=adi');
	expect(withView('/salsa/figures?in=4', 7)).toBe('/salsa/figures?in=7');
	expect(withView('/salsa/lessons?/create', 4)).toBe('/salsa/lessons?/create&in=4');
	expect(withView('/salsa/songs#top', 4)).toBe('/salsa/songs?in=4#top');
});
it('knows the row routes', () => {
	expect(rowKindOf('/[dance]/(moves)/figures/[id]')).toBe('figure');
	expect(rowKindOf('/[dance]/groups/[id]/history/[kind]/[rootId]')).toBe('group');
	expect(rowKindOf('/[dance]/(moves)/figures')).toBeNull();
});
it('knows the viewed lists', () => {
	expect(viewedList('/salsa/positions/map', 'salsa')).toBe(true);
	expect(viewedList('/salsa/groups', 'salsa')).toBe(false);
	expect(viewedList('/salsa', 'salsa')).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL** (`npx vitest run src/lib/teams/group-view.spec.ts`): module not found.
- [ ] **Step 3: Implement** in `group-view.ts` (pure, client-safe; `URL` on a dummy origin for `withView`, rebuilding the search so an action key `/x` stays first and keeps no `=`).
- [ ] **Step 4: Run, expect PASS.** In `mode.ts` add `href` to `workInRows`; `groupCookie` stays until Task 3 removes its last users.
- [ ] **Step 5: Commit** `feat(groups): the view parameter and its hrefs`.

### Task 2: The server's view

**Files:**

- Modify: `src/lib/server/group-mode.ts`, `src/lib/types.ts` (`GroupMode`), `src/lib/server/group-mode.spec.ts` (create if absent)

**Interfaces:**

- Consumes: Task 1's `viewParam`, `rowKindOf`.
- Produces:
  - `GroupMode = { teamId: number; name: string; role: 'owner' | 'editor'; people: number; faces: string[] }`: `people` everyone in the group, `faces` the initials (first letter of first name + last name, `initialOf`-style, uppercase) of up to three other members, ordered by name then id.
  - `groupModeFor(db, userId: string, dance: DanceSlug, teamId: number | null, level?: Level | null): GroupMode | null`: today's re-check (alive, dance, role, `groupModeShown`), no cookies.
  - `rowTeam(db, kind: RowKind, id: number): { teamId: number | null; dance: string } | null`: the row's owner (a move: its `figure_groups` row; a drill: `exercises`; a group: the team itself).
  - `viewOf(db, wall: Wall, level: Level | null | undefined, at: { routeId: string | null; params: Record<string, string>; url: URL }): GroupMode | null`:
    - a row route (not `drill`): `groupModeFor(rowTeam(...).teamId)`; `in` is ignored;
    - `drill`: `in` counts only when it equals the drill's team (rule 5 of the spec), else null;
    - a Today route (`outsideGroupMode`), `/settings`, the player: null;
    - any other route: `groupModeFor(viewParam(url.searchParams))`.
  - `spaceOf(db, params, locals, url: URL): Space`: the group's space when `groupModeFor(viewParam(url.searchParams))` passes, else the wall. (Signature: `cookies` → `url`.)
  - Removed: `groupModeOf`, `inGroupModeOn` (callers move in Task 3).

- [ ] **Step 1: Failing tests** (`openDb(':memory:')`, a group with owner A, editor B, member C, another dance's group, a deleted group):
  - `viewOf` on `/[dance]/(moves)/figures` with `in=<g>`: A and B get the mode, C null, `in=<deleted>` null, `in=<bachata group>` on salsa null, `in=abc` null.
  - `viewOf` on `/[dance]/(moves)/figures/[id]` for A's own figure with `?in=<g>`: null (Review Focus 4); for the group's figure without `in`: the mode.
  - `viewOf` on `/[dance]/(today)/exercises/[id]` for the group's drill: null without `in`, the mode with `in=<g>`, null with `in=<other group A edits>`.
  - `viewOf` on `/[dance]` (Today) with `in=<g>`: null.
  - `groupModeFor` at level `follow`: null.
  - `people` and `faces`: A sees `people: 3`, `faces` = B's and C's initials, never A's.
  - `spaceOf` with a stale `in` returns the wall (Review Focus 1).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `faces` from one query over `team_members` ⨝ `users`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(groups): the view from the row or from in`.

### Task 3: Loads and actions read the view

**Files:**

- Modify: `src/routes/[dance]/+layout.server.ts`; the layouts `lessons/`, `(moves)/`, `songs/`, `groups/` (`+layout.server.ts`); the list pages `(moves)/figures`, `routines`, `positions`, `positions/map`, `positions/none`, `coverage`, `lessons`, `songs` (`+page.server.ts`); the row pages `lessons/[id]`, `(moves)/figures/[id]`, `routines/[id]`, `positions/[id]`, `moves/[id]`, `songs/[id]`, `groups/[id]` (and its subpages' loads where they read the mode), `(today)/exercises/[id]`; `src/routes/[dance]/group-mode/+page.server.ts`; `src/routes/api/sync/pull/+server.ts` (drop the group cookie from `ECHOED`); `src/lib/teams/mode.ts` (`groupCookie` removed); `src/lib/server/moves-lists.ts`, `src/lib/server/positions-map.ts` (take a `GroupMode | null`, not cookies); `src/lib/page-epoch.ts` (13). Specs that build cookies for group mode (`group-mode.spec.ts`, `group-mode-lists.spec.ts`, and any `grep -rl "group_salsa\|groupCookie" src`) move to `?in=`.

**Interfaces:**

- Consumes: Task 2's `viewOf`, `spaceOf`, `groupModeFor`.
- Produces: every load returns `groupMode` = `viewOf(...)` at its level: the `[dance]` layout for lists; each row page returns its own `groupMode` (it overrides the layout's in `page.data`); the four layouts use the same `viewOf` for their column (a row route's column is its row's group's list). `inGroupMode` on row pages = `groupMode !== null` (decided by the row).
- The figure page's switcher is merged in every view: `mergedMoveRows(..., merge = true)` / `mergedMoveFigures` regardless of the view (the user's exception). The move page keeps following the view.
- `/[dance]/group-mode` action: no cookie; redirects to `withView(returnPath(to), team === 'mine' ? null : id)` after the same `groupChoices` check.

- [ ] **Step 1: Failing tests:**
  - lessons layout: `?in=<g>` gives the group's lessons; on `/[dance]/lessons/[id]` for a group lesson with no `in`, the column is the group's (route id + params in the event).
  - the switch action: `team=4,to=/salsa/lessons` → 303 to `/salsa/lessons?in=4`; `team=mine,to=/salsa/lessons?in=4` → `/salsa/lessons`; a group the person only reads → 404; no `set-cookie` (Review Focus 5).
  - `figures?/create` posted with `?/create&in=<g>` makes a group figure; without `in` an own one; with a stale `in` an own one.
  - the figure page of a group figure (editor, no `in`): `groupMode` set, switcher holds the editor's own same-named figures too.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** caller by caller (the grep in Task 2's Produces lists them all). Layout events pass `{ routeId: route.id, params, url }`; read only `url.searchParams.get('in')` through `viewParam`.
- [ ] **Step 4: Run** the touched specs (`npx vitest related <changed files> --maxWorkers=4`), expect PASS.
- [ ] **Step 5: Commit** `feat(groups): loads and actions follow the view, the cookie goes`.

### Task 4: Forward steps carry the view; Mine and Work in are links

**Files:**

- Modify: `src/lib/nav/tab-links.svelte.ts` (`tabTargets` gains `view: number | null`), `BottomNav.svelte`, `Side.svelte`, `GroupModeButton.svelte`, `src/routes/[dance]/(moves)/+layout.svelte` (the segmented goto), `FiguresList.svelte`, `RoutinesList.svelte`, `PositionsList.svelte`, `MusicList.svelte` (their filter gotos and `?/…` actions), `lessons/+layout.svelte` and the other create sheets' action URLs, `BackButton.svelte` (fallback), the list hrefs in `lessons/[id]/+page.svelte`, `songs/[id]/+page.svelte`, `SimpleLesson.svelte`, `songs/imports/[id]/+page.svelte`, `src/lib/nav/pane.ts`, `src/lib/nav/pending.ts`; server redirects to a list (`routines/[id]` 477, `songs/[id]` 544/575, `songs/imports/[id]`, `coverage` 17) keep the request's view. A group lesson's drill links carry `in` when the lesson page is in the group's view.
- Create: `src/lib/teams/view-links.spec.ts`

**Interfaces:**

- Consumes: `withView`, `viewedList`, `page.data.groupMode`, Task 6's `mineHref` (page data, may be absent → fallback).
- Produces: `tabTargets(tabs, dance, path, view)`: each target `withView(target, viewedList(target) ? view : null)` (Review Focus 2). Mine: a plain `<a href>` (no form, no action): `page.data.mineHref ?? withView(minePath(path, dance), null)`. Work in rows: links (`workInRows(...).href`).

- [ ] **Step 1: Failing tests:**
  - `tabTargets` with a trail that remembers `/salsa/figures?in=4`: own view → `/salsa/figures`; view 7 → `/salsa/figures?in=7`; Groups' target never gets `in`.
  - `view-links.spec.ts`, a source guard in the style of `class-rules.spec.ts`: every `.svelte`/`.ts` under `src/lib` and `src/routes` (specs excluded) that builds a viewed-list href or action (`/figures`, `/routines`, `/positions`, `/lessons`, `/songs`, `/coverage` followed by `'`, `` ` ``, `?` or `/map`, `/none`, `/imports`) does it on a line inside `withView(` or is listed in `EXEMPT` with a reason (Review Focus 3).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** site by site until the guard passes.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(groups): every forward step keeps the view; Mine and Work in are links`.

### Task 5: The group drill while editing

**Files:**

- Create: `src/lib/teams/frame-view.svelte.ts`
- Modify: `src/routes/+layout.svelte` (the frame's view), `(today)/exercises/[id]/+page.svelte`, `BottomNav.svelte`, `Side.svelte`

**Interfaces:**

- Produces: `frameView` (module `$state`): `{ current: GroupMode | null; stop: (() => void) | null }`, with `holdView(mode: GroupMode, stop: () => void): () => void` (returns the release). The root layout's view = `page.data.groupMode ?? frameView.current`. `exercises/[id]` loads return `editView: GroupMode | null` (`groupModeFor` on the drill's team, regardless of `in`): while `editing` and `editView`, the page holds it; stopping editing releases it. Mine while held: calls `stop()` (the page's own × path, `leaveOrAsk`), no navigation.

- [ ] **Step 1: Failing test** (`frame-view.svelte.spec.ts`): hold → `current` set; release → null; a second hold replaces the first and the first's release is a no-op.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(groups): a group drill shows the group's view while edited`.

### Task 6: Where Mine lands

**Files:**

- Create: `src/lib/server/mine-target.ts`, `src/lib/server/mine-target.spec.ts`
- Modify: the row pages' loads (`lessons/[id]`, `figures/[id]`, `routines/[id]`, `positions/[id]`, `moves/[id]`, `songs/[id]`, `groups/[id]` and subpages) to return `mineHref`

**Interfaces:**

- Consumes: `memberIn`, `geneOf` (`clones/genes.ts`), `twinsOf` (`twins.ts`), `mergedMoveFigures` (`moves-lists.ts`).
- Produces: `mineTarget(db, wall: Wall, kind: RowKind, id: number): string | null` (a path, no `in`): your live (not archived) clone in the family; else your twin; for a figure, else your first own figure in the merged move in the switcher's order; for `group`, `/{dance}/groups`; else null (the client falls back to the tab's list).

- [ ] **Step 1: Failing tests:** a group figure with your clone → your clone's path; your clone archived and a twin → the twin; neither, but your same-named move has figures → the first; none → null; a group's page → `/salsa/groups`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(groups): Mine opens your own copy of what you were on`.

### Task 7: The look

**Files:**

- Create: `src/lib/components/shell/GroupBadge.svelte` (round badge, today's `people` icon; props `size`, `tone: 'cream' | 'band'`), `GroupFaces.svelte` (overlapping initials + the count word), `GroupCard.svelte` (the side's card)
- Modify: `BandHeader.svelte` (the group row replaces `data-group-line`; no `data-group-edge`; desktop: the row hidden, `desk:hidden`), `src/lib/components/ui/Screen.svelte` (slim band: the badge before the title), `BottomNav.svelte` (filled), `Side.svelte` (the card above the tabs), `src/routes/[dance]/+layout.svelte` (`theme-color` = the dance's band always), `src/routes/+layout.svelte` (`data-group` from the frame's view; posts `dark` to `SalsaBars` while the bar is filled and the theme's scheme otherwise: one small function next to `src/app.html`'s), `src/lib/theme/tokens.ts` and `src/routes/layout.css` (navy out), `CommentItem.svelte` and `(today)/exercises/[id]/+page.svelte` (drop `data-group`), `src/routes/dev/kit/+page.svelte` (the kit shows the new pieces), i18n `en`/`sl` (`groups.view.people(n)`: "1 person"/"2 people"; sl with `slCount`: oseba/osebi/osebe/oseb), `docs/superpowers/design-kit` only if the kit board lists group mode.

**Values** (from round 3; the builder may adjust a pixel):

- Phone group row: badge 30 px, cream fill, icon in `--color-band`; name 17 px extra-bold in band ink; faces 26 px circles, 2 px ring in `--color-band`, fill `band-small` mixed toward cream, initials in `--color-band`, overlap 68 %; the count 13 px bold `band-small`. Sits where `data-group-line` is (basis-full row above Back/title), never above `--safe-top`.
- Slim band: the 26 px badge, 9 px before the title.
- Tab bar in a group's view: `bg-band`, no top line; tabs cream at 72 %; the lit tab a cream pill with band-coloured icon and label; Mine cream.
- Desktop side card: first in the side, cream (`#FFF6EC`, the band ink) 18 px radius, 34 px badge with `band` fill and cream icon, name and count on two lines, 15 px extra-bold, `--color-band` ink; the band row has no group row.

- [ ] **Step 1: Failing tests:** `class-rules.spec.ts` and `no-english.spec.ts` pass with the new components; a render spec (as other `shell` specs do) that `BandHeader` with a group shows the name and the count and has no `data-group-edge`; `BottomNav` in a group's view has no Today link and a Mine link to the given href.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Screens.** Shoot (scripts/shots, a copy of the newest backup in the scratchpad, `--level all`) the phone 390×844 light and dark, salsa and bachata, a group lesson top and scrolled (`?in=` lists via a pages file, row pages without), and the desktop 1440×900 `--viewport`; compare with round 3. The phone baseline of own pages must not change (`shots.py diff` against a baseline from master).
- [ ] **Step 6: Commit** `feat(groups): the group view's look: the group row, the filled bar, the side's card; navy gone`.

### Task 8: Docs, the full check, review

- [ ] Update `docs/features.md` (the group view, link the spec), `docs/layout.md` (`group-view.ts`, `frame-view.svelte.ts`, `mine-target.ts`, the three components), the follow-ups spec part 2 (one line pointing here), `docs/hard-rules.md` if it mentions the group cookie.
- [ ] `npm run check` passes.
- [ ] One whole-branch review (fresh reviewer, the spec and this plan in hand; hard limits in its prompt: no pty, no endless input).
- [ ] Merge master in, `npm run check` again, then merge into master (locally) and deploy per `docs/deployment.md` (backup first).
