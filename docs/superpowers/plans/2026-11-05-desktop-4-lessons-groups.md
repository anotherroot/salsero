# Desktop plan 4 — Lessons and Groups Implementation Plan

**Runs after:** plan 1, plan 5, then lane A's branch merged in (with plan 3) — lane B: plan 5 → merge plan 3 → plan 4. Plan 2 may run alongside it on lane A.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 1024 px, Lessons and Groups are a list beside the open item (2A): a lesson and a group open in two columns from a 780 px pane (3A), a group's People, storage, History and Recently deleted open in the pane with the group still lit, and the phone stays pixel-for-pixel as it is.

**Architecture:** Same as plan 1's Music pilot. Each list moves into a section layout (`src/routes/[dance]/lessons/+layout.svelte`, `src/routes/[dance]/groups/+layout.svelte`) that loads the list and renders `ListPane`, so the list is rendered once and survives opening an item. The item pages keep their `Screen`, which becomes the pane header through `inPane()`. Two columns come from plan 3's `PaneColumns` (plan 1's `two:` variant on its own `cols` container, never on the pane: a size container would capture the pane's `position: fixed` bars), with the phone's DOM order kept: its snippet wrappers are `display: contents` below `two:` and grid items from it. Nothing new on the server: loads move, actions stay, URLs stay.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest; plan 1's screenshot rig (`scripts/shots/`).

**Spec:** `docs/superpowers/specs/2026-11-03-desktop-design.md` — "A list and the item beside it (2A)", "Two columns (3A)" (a lesson, a group, clones and twins), "Page by page" → Lessons and Groups, "Popups are dialogs". Boards: `docs/superpowers/design-kit/desktop/gen/desk/pages/lessons.py` and `groups.py` (render with `book.py boards lessons groups --theme salsa-light`; compare with `out/boards/<theme>/lessons--<id>.html` / `groups--<id>.html`).

**Depends on plan 1** (`docs/superpowers/plans/2026-11-05-desktop-1-frame.md`), built first. Consumed by name: the `desk:` variant, `--side-w`, `--band-row-h`, `--pane-left`, `--pane-max`, `desk` (MediaQuery, `src/lib/nav/desk.svelte.ts`), `Screen`'s `width` prop (`'one' | 'two' | 'song' | 'narrow'`), `ListPane` and its props (`list`, `isList`, `width`, `title`, `subtitle`, `extra`, `right`, `empty`, children), `setPane`/`inPane` (`shell/pane-context.ts`), `listOf`/`ListId`/`paneBack` (`src/lib/nav/pane.ts`), `skeletonFor(...).pane`, `BandHeader`, `Sheet`'s `size="small"`, the `two:` variant, `scripts/shots/shots.sh` and `shots.py diff`. Lessons and Groups have no search or chips, so the trail's `keptFilter`/`keepFilter` are not used here.

**Depends on plan 3** (merged into this lane before this plan), consumed by name and not redefined: `pane.ts`'s `LIST_HOME`, `inList`, `listOf`'s `under?: true` and `paneBack(opener, list, dance, under = false)`; `PaneColumns`; `ListPane`'s `solo`/`soloWidth`, `deskSubtitle`, `data-list-column` and keep-focus; `Screen`'s `below` row (a pane header shows `extra` under the title); `BackButton`'s pane gate (it already passes `under`); `route-ids.spec.ts` (it checks the route-id literals this plan adds). **And on plan 5** (earlier on this lane): `BottomBar`'s `width`, the rig's scenes (`scenes.py`, `ext_*.py` placeholders). Plan 2 runs on the other lane at the same time: it adds an optional `search` argument and a `list` field to `skeletonFor`, so call `skeletonFor(routeId)` and compare its results with `toMatchObject`.

## Global Constraints

- The desktop applies from **1024 px**; below it nothing changes. The phone at 390 px must match its baseline: every task that changes what is drawn ends with `shots.py diff` = 0 at 390, light and dark.
- Measures (spec and boards): list column **360**; two columns from a pane **780 px** wide (a 1366 window: two; 1280: one); a lesson's columns **5fr | 7fr**, a group's **7fr | 5fr**, **32 px** between them, aligned at the top; content max **1140** (two columns), **720** (a group's People, storage, History, Recently deleted), **640** (a lesson being edited), **560** (no groups / no lessons: the empty state on the sheet). Dialogs **560**, small **480**: the group menu, the lesson menu, a person's actions, New group, Rename group, Group code, Ask for more.
- Copy (boards): Lessons' empty pane **"Pick a lesson"** / **"Its notes, videos and what it teaches open here, beside the list."** with a secondary **New lesson** button; Groups' empty pane **"Pick a group"** / **"Its lessons, class songs and people open here."**, no button. The code dialog's button on desktop: **"Copy link"** (icon `copy`), then **"Copied"**. In group mode, Lessons' band subtitle on desk: **"Group videos: {used} of {limit}"** (settled board; the spec names a group's storage as a subtitle). Every other word is the built app's.
- Colours only from tokens and the builders in `ui/styles.ts` (`swap()` only in `.ts`). No new feature, no data-model change, no migration, no URL change; PAGE_EPOCH stays (no form field or action changes; a refusal's `action` tag is not something an open page sends).
- `npm run check` passes at the end of every task (`nix develop --command npm run check`).
- **Builder checklist (read before every task; reviewers keep finding these):**
  - Error paths: a button that goes busy must come back on failure; a refused action shows its message.
  - Tests must fail without the change. For each new test, name the mutation that would make it fail (remove the class, swap the branch) and check it does.
  - The browser and the tests can disagree: CSS, media queries and layout are not in vitest. Every task that changes what is drawn ends with a screenshot check (Task 1's rig) at 1440 and at 390.
  - Order: nothing is marked done/open/saved before the work it stands for has happened.
  - Forms in a layout's list column post to the list route's explicit action URL (`action="/{dance}/songs?/retry"`), never a bare `?/x`: on an item route a bare `?/x` posts to the item's actions.

## Review Focus

1. **New lesson or New group sent while an item is open** (a lesson, a group, People): it posts to the list route, and its refusal shows in the New lesson / New group dialog — never in the group page's own New lesson. SvelteKit's `enhance` applies a result to `page.form` only when the action's path is the page's, so a refusal from the list route never reaches `page.form` on an item route: the sheets read it from the `use:guarded` callback's `result`, as plan 3's list sheets do. Task 2 and Task 4: an action-URL text spec, and no `page.form` in the layouts.
2. **A group's sub-page reloaded or opened by a link** (`/groups/3/people` with no trail): the group's row is lit and the pane has ‹ to the group. Task 1: `listOf(...).under` and `paneBack(null, 'groups', 'salsa', true) === true` (plan 3's signature).
3. **Another lesson opened from the list, a source tab or a twin tab while a lesson is open:** no ‹ (the list is beside it), the right row lit, a folded twin's row included. Task 1: `paneBack('/salsa/lessons/4', 'lessons', 'salsa') === false`; Task 2: `isOpenLesson` with `twinIds`.
4. **A narrow pane** (1280 window: pane 731; 1024: 475): the lesson and the group fall back to one column in the phone's order; while editing a lesson there is never a second column. Task 3 and Task 5: screenshots at 1366, 1280 and 1024, and while editing everything sits in `PaneColumns`' `top`.
5. **The list column after an action in the pane:** Add, Remove from my lessons, Make it mine, archiving a lesson; leaving, deleting or restoring the open group — the list column shows the change at once (the action's `update()` invalidates the layout's load). Task 3 and Task 5: a browser step per action at 1440.

---

### Task 1: The pane's rules for Lessons and Groups

**Files:**
- Modify: `src/lib/nav/pane.ts`, `src/lib/nav/pane.spec.ts`, `src/lib/nav/pending.spec.ts`
- Create: `scripts/shots/ext_groups.py` (two placeholders, no scenes), `scripts/shots/pages-4.txt`

**Interfaces:**
- Consumes: plan 1's `listOf`, `ListId`, `skeletonFor`; plan 3's `LIST_HOME`, `inList`, `paneBack(opener, list, dance, under = false)` and `listOf`'s `under?: true`; plan 5's `ext_*.py` placeholders (`scripts/shots/scenes.py`).
- Produces:
  - `ListId` gains `'lessons' | 'groups'`; `LIST_HOME` gains `lessons: { root: '/lessons', items: '/lessons' }` and `groups: { root: '/groups', items: '/groups' }`. `listOf`: `'/[dance]/lessons'` → `{ list: 'lessons', open: false }`; `'/[dance]/lessons/[id]'` → `{ list: 'lessons', open: true }`; `'/[dance]/groups'` → `{ list: 'groups', open: false }`; `'/[dance]/groups/[id]'` → `{ list: 'groups', open: true }`; `'/[dance]/groups/[id]/people'`, `…/storage`, `…/deleted`, `…/history/[kind]/[rootId]` → `{ list: 'groups', open: true, under: true }` (the first user of plan 3's `under`). No signature changes; plan 3's `BackButton` gate already passes `listOf(page.route.id)?.under ?? false`.
  - `openIdOf(path: string, list: ListId, dance: DanceSlug): number | null` — the id of the row a path keeps lit: `/salsa/lessons/5` → 5, `/salsa/groups/3/people` → 3, `/salsa/groups/3/history/lesson/9` → 3, the list root → null, a non-number or another list's path → null.
  - Shots (`ext_groups.py`'s `placeholders`): `owngroup` (first live group the admin owns or edits: `team_members.role in ('owner','editor')`) and `grouplesson` (first live published lesson of `owngroup`). `pages-4.txt`: `/{dance}/lessons`, `/{dance}/lessons/{lesson}`, `/{dance}/lessons/{grouplesson}`, `/{dance}/groups`, `/{dance}/groups/{owngroup}`, `/{dance}/groups/{owngroup}/people`, `/{dance}/groups/{owngroup}/storage`, `/{dance}/groups/{owngroup}/deleted`, `/{dance}/groups/{owngroup}/history/lesson/{grouplesson}`.

- [ ] **Step 1: Take this plan's phone baseline first.** Before any other change: add `ext_groups.py` and `pages-4.txt`, then `scripts/shots/shots.sh <db> <scratch>/p4-base-390 390x844 --pages scripts/shots/pages-4.txt`, and again with `--theme dark` and with `--group <owngroup's id>` (group mode). Expected: every line `ok`. These are the 390 baselines every later task diffs against.
- [ ] **Step 2: Write the failing tests.** `pane.spec.ts`: the seven `listOf` cases above (`toEqual`, with `under: true` on the four sub-pages and absent elsewhere); `paneBack('/salsa/lessons', 'lessons', 'salsa') === false`; `paneBack('/salsa/lessons/4', 'lessons', 'salsa') === false`; `paneBack('/salsa/groups/3', 'lessons', 'salsa') === true` (a group's lesson opened from the group page); `paneBack('/salsa/groups/3', 'groups', 'salsa', true) === true` (People); `paneBack(null, 'groups', 'salsa', true) === true`; `paneBack('/salsa/groups/3/people', 'groups', 'salsa') === false` (another group opened beside the list); `paneBack('/salsa/lessonsx', 'lessons', 'salsa') === true` (prefix is by segment). `openIdOf` for the five cases above. `pending.spec.ts` (`toMatchObject` / property checks, never `toEqual`: plan 2 adds a field on the other lane): `skeletonFor('/[dance]/lessons/[id]')?.pane === true`, `skeletonFor('/[dance]/lessons')?.pane === true`, `skeletonFor('/[dance]/groups/[id]') === null` (no skeleton on the phone today; unchanged).
- [ ] **Step 3: Run** `nix develop --command npx vitest run src/lib/nav` — FAIL on the new cases (`route-ids.spec.ts` passes: every new literal is a route id).
- [ ] **Step 4: Implement** as the Interfaces say.
- [ ] **Step 5: Run** the specs — PASS; `npm run check` passes. 390 diff against Step 1: 0 (nothing drawn has changed yet).
- [ ] **Step 6: Commit** (`feat(desktop): which list Lessons and Groups pages sit beside`).

### Task 2: Lessons — the list in a layout

**Files:**
- Create: `src/routes/[dance]/lessons/+layout.svelte`, `src/routes/[dance]/lessons/+layout.server.ts`, `src/lib/components/lessons/LessonList.svelte`, `src/routes/[dance]/lessons/lessons-layout.spec.ts`
- Modify: `src/routes/[dance]/lessons/+page.server.ts` (load moves out; `actions` stay), `src/routes/[dance]/lessons/+page.svelte` (title only), `src/lib/components/lessons/LessonRow.svelte`, `src/lib/lessons/list.ts` (+ `list.spec.ts`), `src/lib/types.ts` (`LessonItem.twinIds?`), `src/lib/nav/bands.spec.ts` (the list page, as plan 1 did for songs)
- Modify (re-point `load` imports from `./lessons/+page.server` to `./lessons/+layout.server`, assertions unchanged; `actions` keep coming from `+page.server`): `src/routes/[dance]/group-mode-lists.spec.ts`, `src/routes/[dance]/twins-kinds.spec.ts`, `src/routes/[dance]/owner-wall.spec.ts` (it reads `lessonList.load` and `lessonList.actions` from one namespace import: add a second import for the layout's load), `src/routes/[dance]/groups/leaving.spec.ts`

**Interfaces:**
- Consumes: `ListPane` with plan 3's `solo`, `soloWidth` and `deskSubtitle`, `listOf`, `openIdOf` (Task 1).
- Produces:
  - `+layout.server.ts` `load` returns what the list page's load returns today (`lessons`, `storageBytes`, `today`; group mode as now), plus `groupStorage: { usedBytes: number; limitBytes: number } | null` — in group mode the group's numbers as its group page reads them (`usedBytesOf(db, { teamId })`, `teamLimitBytes(db, teamId)`), else null. `foldedLessons` moves with it and keeps each folded row's other members as `twinIds: number[]`. It reads only `params.dance`, so it does not rerun when another lesson opens.
  - `isOpenLesson(row: { id: number; twinIds?: number[] }, openId: number | null): boolean` in `src/lib/lessons/list.ts`.
  - `PICK_LESSON = { title: 'Pick a lesson', body: 'Its notes, videos and what it teaches open here, beside the list.' }` in `src/lib/lessons/list.ts`.
  - `groupVideosSubtitle(usedBytes: number, limitBytes: number): string` in `src/lib/lessons/list.ts` — `Group videos: ${byteSize(used)} of ${byteSize(limit)}` (board: "Group videos: 1.6 GB of 3 GB").
  - `<LessonList lessons={LessonItem[]} dance={DanceSlug} openId={number | null} groupMode={boolean} onnew={() => void} />` — the list page's body today, markup unchanged: drafts, months, the empty state with New lesson.
  - `LessonRow` gains `current?: boolean`: `aria-current="page"` on the link, `bg-accent-soft` on the `<li>`, and its accent and warn badges `solid` (a soft badge vanishes on the tint).
  - The layout: band `title="Lessons"`, `subtitle={diskSubtitle(storageBytes)}` (the phone's, unchanged: none in group mode), and in group mode **`deskSubtitle={groupVideosSubtitle(…)}`** (plan 3's `ListPane` prop: the group's storage as the band subtitle on desk only; settled); `right` = `GroupModeButton` + the + (as today); `empty` = `EmptyState` with `PICK_LESSON` and a secondary New lesson button; `NewLessonSheet` rendered here with `action="/{dance}/lessons?/create"`, its refusal read from the `use:guarded` callback's `result` (`result.type === 'failure'` → the sheet's own state; anything else → `update()`), never from `page.form`, which a list-route action does not reach on an item route.
  - **No lessons → no list column:** `<ListPane solo={isList && lessons.length === 0} soloWidth="narrow" …>` (plan 3's `solo`; the empty state at 560 on the sheet). The phone ignores `solo`.

- [ ] **Step 1: Write the failing tests.** `list.spec.ts`: `isOpenLesson({ id: 5 }, 5) === true`, `isOpenLesson({ id: 5, twinIds: [9] }, 9) === true`, `isOpenLesson({ id: 5 }, null) === false`, `isOpenLesson({ id: 5, twinIds: [9] }, 7) === false`. `lessons-layout.spec.ts` (reads the files as text, as `class-rules.spec.ts` does): `+layout.svelte` contains `lessons?/create` and no `action="?/`, and neither it nor `LessonList.svelte` has a `<form` whose `action` starts with `?/`, nor `page.form` / `form?.`. `list.spec.ts`: `groupVideosSubtitle(1.6e9, 3e9)` as `byteSize` writes them. `group-mode-lists.spec.ts`: the group-mode load carries `groupStorage` with the group's numbers, and `null` outside group mode. In `twins-kinds.spec.ts`, the folded row now also carries `twinIds` with the other member's id (one added assertion beside the existing fold check).
- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement.** Move the load and the list markup; `+page.svelte` keeps only `<svelte:head>`; `isList` is `listOf(page.route.id)?.open === false`; rows get `current={isOpenLesson(lesson, openIdOf(page.url.pathname, 'lessons', dance))}`. A group's lesson opened from the group page is not in this list, so nothing is lit, by itself.
- [ ] **Step 4: Run** the specs and `npm run check` — PASS, including `lesson-forms.spec.ts`, `dance-wall.spec.ts` and the four re-pointed specs.
- [ ] **Step 5: Screenshot check** at 1440 against `lessons--lessons` (the list, "Pick a lesson"), with no lessons (a db copy with the admin's lessons archived: no list column, the empty state at 560), and in group mode against `lessons--group-mode-lessons` (drafts first; "Group videos: … of …" as the band subtitle). Open New lesson from the band's + and from the empty pane's button: the same dialog. Send it empty while a lesson is open (`/salsa/lessons/{lesson}`): the dialog shows "Give it a title…", the lesson pane shows no banner. 390: `shots.py diff p4-base-390 now-390` = 0 for the lessons lines, light, dark and group mode.
- [ ] **Step 6: Commit** (`feat(desktop): the Lessons list beside the open lesson`).

### Task 3: A lesson in its pane

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/components/ui/styles.ts` (+ `styles.spec.ts`)

**Interfaces:**
- Consumes: `inPane()`, `paneBack`, `listOf` (Task 1), `Screen` `width`, `Sheet` `size`; plan 3's `PaneColumns`, `Screen`'s `below` row (in a pane on desk, `extra` sits under the title and subtitle, the header's full width, 12 px below: board `pane_head`'s `below`) and `BackButton`'s pane gate (only Back hides; the lesson's × Stop editing in `left` always shows); plan 5's `BottomBar` `width`. This task changes neither `Screen` nor `BackButton`.
- Produces:
  - `STRIP_ACTION` in `ui/styles.ts`: `button('secondary', 'sm')` on the phone (the band strip's button, as now) and `desk:bg-accent desk:text-on-accent` (primary on the soft bar), built with `swap()` on the `bg-accent-soft text-accent-text` run.

- [ ] **Step 1: Failing test** in `styles.spec.ts`: `STRIP_ACTION` contains `bg-accent-soft`, `text-accent-text`, `desk:bg-accent` and `desk:text-on-accent`, and `button('secondary', 'sm')` is unchanged. Run — FAIL.
- [ ] **Step 2: Implement `STRIP_ACTION`**; run — PASS.
- [ ] **Step 3: The strips.** `draftBand` and `addBand` use `STRIP_ACTION` for Publish and Add, and become the soft bar on desk with `desk:` classes on their own container and text span (not on a built control): add — `desk:min-h-[52px] desk:rounded-2xl desk:bg-accent-soft desk:py-1.5 desk:pr-2 desk:pl-4`, text `desk:text-[15px] desk:font-bold desk:text-accent-text`; draft — the same on `desk:bg-warn-soft`, text `desk:text-ink-2`. The phone keeps `text-band-small` on the band.
- [ ] **Step 4: The two columns.** `Screen width={editing ? 'song' : 'two'}`. The content's wrapper (`flex flex-col gap-3 …`) becomes plan 3's `<PaneColumns ratio="5:7" class="…the same classes…">`; its children, in today's DOM order, go into its snippets (each `contents` below `two:`, so the phone's flex column is exactly as now). The `{#if editing}` boundary moves into the snippets:
  - **`top`** (both columns, row 1): SourceTabs (Copy to…, Move to…, Same as…, or the source tabs with their banner and actions), the publish refusal, then `{#if editing}` the edit form `{:else}` the notices (the being-deleted notice, Edited by, the "N new · Not now · Add" offer) `{/if}`. While editing everything is here, so a 780+ pane is still one column;
  - **`left`** (not editing): Notes, the review row;
  - **`right`** (not editing): Videos (cards, sections, Add videos and the upload progress) then Links (with YouTube saves in progress); the Videos section `two:pt-0`;
  - **`leftEnd`** (not editing): the existing Figures/Routines/Exercises/Positions `div`, its sections in the phone's order.
  While editing, the pinned Save's `BottomBar` (after `</Screen>`) gets `width="song"` (plan 5), so it is 640 like the content.
  Plan 2 (other lane) renames this page's two `resolve('/[dance]/exercises/[id]', …)` to `'/[dance]/(today)/exercises/[id]'`; when the lanes merge, keep this task's structure and re-apply that rename (`route-ids.spec.ts` and svelte-check find a missed one).
- [ ] **Step 5: Dialogs.** The lesson menu `Sheet` gets `size="small"`. Every other sheet on the page stays 560.
- [ ] **Step 6: Run** `npm run check` — PASS.
- [ ] **Step 7: Screenshot check** at 1440 against `lessons--lesson` (two columns; Copy to… under the title), `lessons--lesson-uploading` (start an upload: progress under the videos, right column), `lessons--lesson-edit` (one column 640, × in the header, Save pinned to the pane at 640), `lessons--group-lesson-new` (`/salsa/lessons/{grouplesson}` opened from `/salsa/groups/{owngroup}` as a member: ‹ to the group, nothing lit, "Not in your lessons yet · Add" as the accent bar), `lessons--group-mode-draft` (warn bar, Publish), `lessons--group-deleting` (the banner at the top), `lessons--group-lesson-added` (the offer, the review row), `lessons--group-lesson-menu` (480), `lessons--make-mine`, `lessons--copy-to`, `lessons--move-to`, `lessons--delete-refused`, and a copy with its source tabs (Yours | the group) above the columns. At 1366: two columns; at 1280 and 1024: one column in the phone's order. Browser steps at 1440: Add from the bar, then Remove from my lessons — the row appears in the list and lights, then leaves it; Make it mine — the copy appears; Archive lesson — the pane goes to the list and the row is gone. 390: diff 0 for the lesson lines, light, dark and group mode.
- [ ] **Step 8: Commit** (`feat(desktop): a lesson in two columns beside the list`).

### Task 4: Groups — the list in a layout

**Files:**
- Create: `src/routes/[dance]/groups/+layout.svelte`, `src/routes/[dance]/groups/+layout.server.ts`, `src/lib/components/teams/GroupList.svelte`, `src/routes/[dance]/groups/groups-layout.spec.ts`
- Modify: `src/routes/[dance]/groups/+page.server.ts` (load moves out; `create` stays, unchanged), `src/routes/[dance]/groups/+page.svelte` (title only), `src/lib/teams/view.ts` (+ `view.spec.ts`), `src/lib/nav/bands.spec.ts`
- Modify (re-point `listLoad` to `./+layout.server`; assertions unchanged): `src/routes/[dance]/groups/groups.spec.ts`, `src/routes/[dance]/groups/whats-new.spec.ts`

**Interfaces:**
- Consumes: `ListPane`, `listOf`, `openIdOf` (Task 1), `Sheet size="small"`.
- Produces:
  - `+layout.server.ts` `load` returns `teams` exactly as the list page's load does today (with `newCount`). No page under `groups/` returns a `teams` key (checked: `[id]`, people, storage, deleted, history do not).
  - `PICK_GROUP = { title: 'Pick a group', body: 'Its lessons, class songs and people open here.' }` in `src/lib/teams/view.ts`.
  - `<GroupList teams={the layout's teams rows} dance={DanceSlug} openId={number | null} workingIn={number | null} />` — today's list markup with its Restore forms (they already post to `{href}?/restore`, the group route's action) and the restore refusal banner. The open row (`team.id === openId`): `aria-current="page"` on its link, `bg-accent-soft` on the `<li>`, its Working in and "N new" badges `solid`. On desk the badges sit beside the name (board: no room before the chevron in 360): render them once in a `desk:hidden` place (today's, on the right) and once in a `hidden desk:inline-flex` place after the name, the name and that place wrapped in a span that is `contents` on the phone and `desk:flex desk:flex-wrap desk:items-center desk:gap-x-2 desk:gap-y-1` on desk. Only one copy is ever displayed, so only one is read.
  - The layout: band `title="Groups"`, `subtitle="Share lessons with a class"`, `right` = the + (New group); `empty` = `EmptyState` with `PICK_GROUP`; the New group `Sheet` (`size="small"`, name autofocused) rendered here with `action="/{dance}/groups?/create"`, its refusal read from the `use:guarded` callback's `result` as Task 2's New lesson (never `page.form`, so the group page's own New lesson, which reads `page.form`'s `'create'`, never sees it). **No groups → no list column:** `solo={isList && teams.length === 0} soloWidth="narrow"`, as Task 2.
  - People, storage, Recently deleted and History need no change of their own: they render under this layout, their `Screen` becomes the pane header with ‹ (Task 1's `under`), and their group's row stays lit (`openIdOf`).

- [ ] **Step 1: Write the failing tests.** `groups-layout.spec.ts` (text): `+layout.svelte` contains `groups?/create`, no `<form` in it or in `GroupList.svelte` has an `action` starting with `?/`, and neither reads `page.form` or `form?.`. `view.spec.ts`: `PICK_GROUP` as above.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `isList` and `openId` as Task 2 (`openIdOf(page.url.pathname, 'groups', dance)`); `workingIn` is `page.data.groupMode?.teamId ?? null` (opening a group still does not switch).
- [ ] **Step 4: Run** the specs and `npm run check` — PASS, including `leaving.spec.ts`, `whats-new.spec.ts`, `storage.spec.ts`, `deleted.spec.ts`, `history.spec.ts`.
- [ ] **Step 5: Screenshot check** at 1440 against `groups--nothing-open`, `groups--none` (a db copy with the admin's groups removed: no list column, the empty state centred at 560), `groups--working-in` (group mode: navy, Working in beside the name, lit row solid), `groups--people`, `groups--storage`, `groups--trash`, `groups--history` (each in the pane with ‹, the group lit; load each URL directly too: still lit, still ‹), `groups--new-group` (480, name focused), `groups--deleted-group` (Deleted and Restore in the row). Send New group empty from `/salsa/groups/{owngroup}`: the New group dialog shows the refusal and the group page's New lesson stays shut. 390: diff 0 for the groups lines, light, dark and group mode.
- [ ] **Step 6: Commit** (`feat(desktop): the Groups list beside the open group`).

### Task 5: A group in its pane

**Files:**
- Modify: `src/routes/[dance]/groups/[id]/+page.svelte`, `src/lib/components/teams/CodeSheet.svelte`, `src/lib/teams/view.ts` (+ `view.spec.ts`), `src/routes/[dance]/groups/[id]/people/+page.svelte`, `src/routes/[dance]/groups/[id]/storage/+page.svelte`, `src/lib/components/ui/PaneColumns.svelte` (plan 3's: `'7:5'` and `lead`)

**Interfaces:**
- Consumes: plan 3's `PaneColumns`, `desk` (plan 1), `Sheet size="small"`.
- Extends `PaneColumns` (no other plan does): `ratio` gains `'7:5'`; `lead?: Snippet`, rendered after `top` and before `left` in the DOM, sits in column 2 at the top of the columns, `right` under it, and `left` then spans both rows (`leftEnd` is not used with `lead`). It lets a part the phone shows before the left column head the right one. Below `two:` it is a `contents` wrapper like the others; the existing ratios and placements are unchanged.
- Produces: `codeAction(desk: boolean, canShare: boolean, copied: boolean): { label: string; icon: 'share' | 'copy'; copy: boolean }` in `src/lib/teams/view.ts` — desk: `{ label: copied ? 'Copied' : 'Copy link', icon: 'copy', copy: true }` whatever `canShare` (a desktop browser's share sheet is not what Copy link says); phone: `{ label: copied ? 'Copied' : 'Share', icon: 'share', copy: !canShare }` (today's behaviour: share, else copy).

- [ ] **Step 1: Failing tests** in `view.spec.ts`: `codeAction(true, true, false)` → `{ label: 'Copy link', icon: 'copy', copy: true }`; `codeAction(true, false, true).label === 'Copied'`; `codeAction(false, true, false)` → `{ label: 'Share', icon: 'share', copy: false }`; `codeAction(false, false, false).copy === true`. Run — FAIL.
- [ ] **Step 2: Implement** `codeAction`; `CodeSheet` calls it with `desk.current` and `typeof navigator.share === 'function'` at open, writes to the clipboard when `copy`, and gets `size="small"`. (The sheet is closed at SSR, so reading `desk` here causes no hydration flash.) Run — PASS.
- [ ] **Step 3: The two columns.** `Screen width="two"`. On the not-deleted branch, after the leave refusal banner, the storage row, Lessons and Class songs (today's DOM order) go into `<PaneColumns ratio="7:5">`: `lead` = the storage row, `left` = Lessons, `right` = Class songs (the caller's gap: today's 2). A member has no storage row: Class songs still sits at the top of the right column (an empty auto row). The deleted branch stays one column (no `PaneColumns`).
- [ ] **Step 4: Dialogs.** `size="small"` on the group menu, Rename group, People's person actions sheet, and storage's Ask for more. New lesson, Add, Leave and Delete stay as they are (560 / the kit's question dialog).
- [ ] **Step 5: Run** `npm run check` — PASS.
- [ ] **Step 6: Screenshot check** at 1440 against `groups--owner` (lessons left, space and Class songs right), `groups--editor`, `groups--member` (no space row, New on fresh rows), `groups--menu-owner`, `groups--menu-editor`, `groups--rename`, `groups--code` (Copy link; click it: Copied, the clipboard holds the link), `groups--person`, `groups--ask-more`, `groups--leave`, `groups--add`. At 1366 two columns, at 1280 and 1024 one, in the phone's order. Browser steps at 1440: Leave a group you edit — the row leaves the list column; Delete an owned group — the row shows Deleted with Restore, and Restore brings it back, in the list column and the pane. 390: diff 0 for the groups lines, light, dark and group mode; at 390 the code sheet still says Share.
- [ ] **Step 7: Commit** (`feat(desktop): a group in two columns beside the list`).

### Task 6: Lessons and Groups, checked

**Files:**
- Modify: `CLAUDE.md` (Layout block: `components/lessons/LessonList.svelte`, `components/teams/GroupList.svelte`, the `lessons` and `groups` section layouts, `PaneColumns`' `'7:5'`/`lead`), and the spec's "Decided while building" section in its own `### Plan 4 — Lessons and Groups` subsection (create `## Decided while building` at the end if no plan has; each plan writes only its own subsection): at least Lessons' group-mode desk subtitle (the group's storage) and New lesson / New group refusals read from the enhance result

- [ ] **Step 1:** Shoot `pages-4.txt` at 1440×900, 1366×768, 1280×800 and 1024×768, light and dark, salsa and bachata (swap `{dance}`), and in group mode; and at 390 light, dark and group mode. Every 390 diff against Task 1's baseline is 0. On desktop: every page has the list column (but no lessons / no groups), nothing overflows horizontally, the pane header and the pinned Save sit in the pane, the list column scrolls on its own.
- [ ] **Step 2:** `npm run check` passes.
- [ ] **Step 3: Commit** (`docs(desktop): Lessons and Groups in CLAUDE.md`).

---

## Calls made in this plan (check these)

- **No lessons → no list column**, as the spec says for Groups (otherwise the sheet shows two empty states and two New lesson buttons).
- **The lesson's × Stop editing stays before the title** in the pane header (the phone's place); the board draws it on the right among the actions.
- **The "N new · Not now · Add" offer, Edited by and the being-deleted banner** stay where the phone has them, at the top of the content under the source tabs, across both columns; the board draws the offer above Copy to….
- **The section order inside the lesson's left column is the built app's** (Figures, Routines, Exercises, Positions); the spec lists Positions before Exercises.
- **Groups pages get no loading skeleton on desktop**, since they have none on the phone and `skeletonFor` is shared.
- **Inline videos' 70 % height cap is not needed here:** a lesson's videos are 16:9 at column width, at most about 455 px wide in two columns and 650 in one, well under 70 % of any window that gets the desktop.
