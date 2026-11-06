# Lesson links, part A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The lesson page's lists each get one "+ Add" (Positions gains "+ New position"), Links add in a shared popup, sections take the name of what they link to (old ones named once at boot), the share page makes a lesson on the spot, the Routines list marks routines from a class, and Publish gets a real button.

**Architecture:** Mostly page and component work on existing actions. Two data changes: the two link-making functions fill an empty `video_spots.label`, and a once-ever boot step does the same for links made before. New server actions: `newPosition` on the lesson page, `create` on the share page. No migration, no new table.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Drizzle on SQLite, Vitest, Tailwind 4 (builders in `src/lib/components/ui/styles.ts`).

**Spec:** `docs/superpowers/specs/2026-11-05-lesson-links-and-music-design.md` (Part A). Read it and the repo's `CLAUDE.md` before starting.

## Global Constraints

- Data functions take `db` first; specs use `openDb(':memory:')`; a spec that needs `getDb()` mocks `$lib/server/db` as `src/routes/[dance]/lessons/lesson-forms.spec.ts` does. A spec never touches `$DATA_DIR`.
- A form someone fills in uses `use:guarded`, not `use:enhance`. One-tap forms stay `use:enhance`.
- A colour on a built control is the builder's (`button()`, `iconButton()`); never append `text-*` to their output. `class-rules.spec.ts` enforces it.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- Dates on screen come from `src/lib/format.ts` (`classDayLabel`), never `toLocaleDateString`.
- Every group mutation is logged in its transaction (`logChange`); a new one is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`.
- Forms in a list column post to the list route's explicit action URL. (The share page is not a list column; a bare `?/create` is right there.)
- No `PAGE_EPOCH` raise: no existing action's fields change (`addLink` still takes `urls` and `title`).
- Words, exactly: "Add" (heading buttons); aria-labels "Add a figure", "Add a routine", "Add an exercise", "Add a position", "Add a link"; "Add a link" (sheet title), "Link", "Title", "(optional)", "Add link"; "YouTube video" / "You can save it at 480p after adding"; "New lesson" / "Make one for this video"; "Where", "Mine", "A group's lesson starts as a draft", "Make it and add the video"; "Draft" / "Members don't see it yet" / "Publish"; "From class " + day.
- `npm run check` must pass at the end of every task.

## Review Focus

1. A section that already has a name, linked again (or linked to a second thing) — its name must not change.
2. A section linked to a figure whose move is renamed later — the stored label stays the old name (it is a name, not a live link); nothing may rename it behind the user's back.
3. The share page's Where posted with a group the person only reads (member) or a stranger's group id — refused, nothing made.
4. The boot naming step on a second boot — names nothing (the flag), even if the user has cleared a name since.
5. A reader (no edit) on the lesson page — sees no "+ Add" anywhere, including Links.

---

### Task 1: A section takes the name of what it is linked to

**Files:**
- Modify: `src/lib/server/spot-links.ts` (`linkInSpace` ~:200, `targetName` ~:226)
- Modify: `src/lib/server/position-links.ts` (`linkPositionInSpace` ~:71, `positionName` ~:113)
- Test: `src/lib/server/spot-links.spec.ts`, `src/lib/server/position-links.spec.ts`

**Interfaces:**
- Produces: `nameIfUnnamed(tx: Db, spotId: number, name: string | null): void` exported from `spot-links.ts` — sets `video_spots.label = name` only where `label IS NULL` and `name` is non-null. Task 2 reuses it.

- [ ] **Step 1: Write the failing tests** in `spot-links.spec.ts`:
  - `it('names an unnamed section after the figure it is linked to')`: section with `label: null`, `linkSpot` to a figure version of move "Enchufla", figure "Doble" → the spot's label is `'Enchufla · Doble'`.
  - `it('names an unnamed section after a drill')` → label is the drill's name.
  - `it('keeps a named section's name')`: label `'The cross'`, link → still `'The cross'`.
  - `it('only the first link names it')`: link to Doble, then to a drill → label stays `'Enchufla · Doble'`.
  - `it('keeps the name after unlinking')`.
  In `position-links.spec.ts`: `it('names an unnamed point after the position')` and `it('keeps a named point's name')`.
- [ ] **Step 2: Run them, expect FAIL** — `npx vitest run src/lib/server/spot-links.spec.ts src/lib/server/position-links.spec.ts`.
- [ ] **Step 3: Implement.** Add `nameIfUnnamed`; call it inside the existing `db.transaction` of `linkInSpace` with `targetName(tx, target)` and of `linkPositionInSpace` with `positionName(tx, positionId)`. No extra History line (the link's own `logSectionLink` / `logPositionLink` is the line). Do not touch the copy paths (`clones/clone.ts`, `apply.ts`, `move.ts`).
- [ ] **Step 4: Run them, expect PASS.**
- [ ] **Step 5: Commit** — `feat(links): a section takes the name of what it links to`.

### Task 2: Name the sections already linked, once, at boot

**Files:**
- Create: `src/lib/server/section-names.ts`
- Modify: `src/lib/server/db/bootstrap.ts` (a `.then` after `importNoteLinks`)
- Test: `src/lib/server/section-names.spec.ts`

**Interfaces:**
- Consumes: `nameIfUnnamed` (Task 1); `appFlags` table as `positions-move.ts` uses it (`FLAG` const, check-then-insert in one transaction).
- Produces: `nameLinkedSpots(db: Db, now: number): { ran: boolean; named: number }`, flag key `'sections-named'`.

- [ ] **Step 1: Write the failing tests:**
  - `it('names every unnamed linked section once')`: two unnamed sections, one linked to a figure version, one to a drill; one unnamed section with no link → `{ ran: true, named: 2 }`, labels set, the third still null.
  - `it('takes the oldest section link, else the oldest position link')`: a section with a drill link (lower `spot_links.id`) and a figure link → the drill's name; a point with two position links → the lower `spot_position_links.id`'s position name.
  - `it('leaves named sections alone')`.
  - `it('runs once ever')`: second call → `{ ran: false, named: 0 }` even after a label is cleared back to null.
  - `it('writes no History line')`: `team_changes` row count unchanged for a group's section.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `nameLinkedSpots`: one transaction; flag check; for each spot with `label IS NULL`, its lowest-id `spot_links` row (figure: `move · figure` name; drill: its name), else its lowest-id `spot_position_links` row (position name); `nameIfUnnamed`; insert the flag. Wire into `bootstrap.ts` and log `[sections] named N` when `ran`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(links): name the sections linked before, once`.

### Task 3: One "+ Add" per list on the lesson page, and New position

**Files:**
- Create: `src/lib/server/position-form.ts`
- Modify: `src/routes/[dance]/(moves)/positions/+page.server.ts` (the `create` action uses the new reader)
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (new `newPosition` action)
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (`labelRow`, the four `PickerOpener`s, the position `Picker`, a `PositionSheet`)
- Modify: `src/lib/lessons/page.ts` (words)
- Test: `src/routes/[dance]/lessons/lesson-forms.spec.ts`, `src/lib/lessons/page.spec.ts`, the positions list action's existing spec (must stay green)

**Interfaces:**
- Produces: `readNewPosition(form: FormData, dance: DanceSlug): { input: PositionInput } | { field?: 'name' | 'notes'; message: string; typed: { name: string; notes: string; styleTag: string } }` in `position-form.ts` — exactly the checks the positions `create` action does today (notes ≤ 2000 → field `notes`, "Notes are up to 2000 characters."; name > 200 → field `name`, "A name is up to 200 characters."; a style outside the dance → `null`; `parseHold(form)`; `pictureSpotId: null`).
- Produces: lesson action `newPosition` → `{ action: 'newPosition', ok: true, positionId: number }` on success; `fail(400, { action: 'newPosition', field?, message, name, notes, styleTag })` on a refusal (blank or taken name comes from `createPosition`'s `NameRefusal`).
- Produces: `ADD_LABEL: Record<'figure' | 'routine' | 'exercise' | 'position' | 'link', string>` in `src/lib/lessons/page.ts` with the aria-labels from Global Constraints.

- [ ] **Step 1: Write the failing tests** in `lesson-forms.spec.ts`, `describe('New position from this lesson')`:
  - `it('makes the position in the lesson's space and links it')`: post `{ name: 'Cerrada', styleTag: '', notes: '' }` → `ok: true`; a `lesson_positions` row joins the lesson and the new position; the position's `user_id` is u1.
  - `it('puts a blank name under Name, keeping what was typed')` → `{ status: 400, data: { action: 'newPosition', field: 'name' } }`, no position made.
  - `it('puts a taken name under Name')`.
  - `it('puts notes over 2000 characters under Notes')`.
  - In `page.spec.ts`: `ADD_LABEL.exercise === 'Add an exercise'`, `ADD_LABEL.link === 'Add a link'`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement the server side.** `readNewPosition` (move the positions `create` action's checks into it; that action now calls it and keeps its redirect). `newPosition`: `lessonOf` → `space`; `readNewPosition`; `createPosition(db, space, input, Date.now())`; on a row, `linkPosition(db, lesson.id, row.id, actorOf(space))`; return as above. In a group both already log (`createPosition`'s insert, `linkPosition`).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Change the page.**
  - `labelRow(heading, kind)`: for an editor, a `button('tertiary', 'sm')` with the plus icon and "Add", `aria-label={ADD_LABEL[kind]}`, `aria-haspopup="dialog"`, `data-focus="{kind}-add"`, opening `openPicker(kind)` (Links: opens the Task 4 sheet). Delete the four `PickerOpener`s and the "+ New" button; drop the now-unused `PickerOpener` import.
  - The position `Picker` gets `create={[{ key: 'position', label: 'Position' }]}` and `oncreate` opens `PositionSheet` (`mode="new"`, `action="?/newPosition"`, `dance={data.dance.slug}`, `defaultStyle={data.defaultStyle}`); its `onclose` closes only the sheet, so the picker shows the new row as linked after the refresh.
  - Focus fallbacks keep the keys `figure-add` etc. (now the heading buttons).
- [ ] **Step 6: Check by eye.** `scripts/shots/shots.sh <copy of the 6 Nov backup> <scratch>/a3 390x844 --pages <file with /{dance}/lessons/29>` and `--theme dark`: headings read "Figures · 1 … + Add" like option 1A; no full-width buttons left.
- [ ] **Step 7: `npm run check`, then commit** — `feat(lessons): one + Add per list, and New position`.

### Task 4: Add a link in a shared popup

**Files:**
- Create: `src/lib/components/links/AddLinkSheet.svelte`
- Modify: `src/lib/links.ts` (a pure helper), `src/lib/components/links/LinksEditor.svelte` (a prop to drop its in-page form), `src/routes/[dance]/lessons/[id]/+page.svelte`
- Test: `src/lib/links.spec.ts`

**Interfaces:**
- Produces: `linkFound(raw: string): { youtube: boolean; title: string; line: string } | null` in `src/lib/links.ts` — `null` for empty, several lines, or anything `parseLink` refuses; YouTube → `{ youtube: true, title: 'YouTube video', line: 'You can save it at 480p after adding' }`; web → `{ youtube: false, title: host, line: 'Web page' }`.
- Produces: `AddLinkSheet` props `{ open: boolean; onclose: () => void; action: string; message: string | null; entered: string; canSave?: boolean }` — posts `urls` (the one link) and `title` to `action`; success closes; refusal keeps the sheet open, message under the Link field, `entered` back in it. `canSave` false hides the 480p line (a drill's links cannot be saved). Slot 1's figure page imports this component.
- Produces: `LinksEditor` prop `adding?: boolean` (default `true`); `false` renders the list only.

- [ ] **Step 1: Write the failing tests** for `linkFound`: a `youtu.be/…` URL, a `youtube.com/watch?v=…` URL, `https://www.salsa.si/x` → `title: 'salsa.si'`, `''` → null, two lines → null, `not a link` → null.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `linkFound`, then the sheet: `Sheet` titled "Add a link"; a `use:guarded` form (label "A link"); Link field (`name="urls"`, `FIELD`), under it while `linkFound` is non-null a card (YouTube: a band-coloured tile with the play icon; web: the link icon in an accent-soft tile), Title field (optional, maxlength 200); footer `button('primary', 'md', true)` "Add link" with a spinner while out. A refused post that the page re-renders opens the sheet again holding `entered`, as the lesson page's create sheets do (`seen` / `refusalOf` pattern).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Use it on the lesson page.** Links' heading gets the "+ Add" from Task 3 (kind `link`); `LinksEditor adding={false}`; `AddLinkSheet action="?/addLink" canSave message={failure('addLink')} entered={…}`. The `saveVideo`/`retryVideo` messages still show where they do now. Figure and drill pages are not touched.
- [ ] **Step 6: Check by eye** at 390×844 light and dark (lesson 29 and lesson 28): the in-page form is gone; the sheet matches option 2B.
- [ ] **Step 7: `npm run check`, then commit** — `feat(links): add a link in a popup`.

### Task 5: A new lesson from a shared video

**Files:**
- Modify: `src/routes/[dance]/share/+page.server.ts` (load adds `today`, `places`; a `create` action)
- Modify: `src/routes/[dance]/share/+page.svelte` (the first row, the sheet, the empty case)
- Modify: `src/lib/components/lessons/NewLessonSheet.svelte` (optional Where and button words)
- Test: `src/routes/[dance]/share/share-forms.spec.ts` (new; mocks `getDb` as `lesson-forms.spec.ts` does)

**Interfaces:**
- Consumes: `readNewLesson(form, today)` (`lesson-form.ts`), `createLesson(db, space, input)`, `listMyTeams(db, userId, dance)` (role `owner`/`editor`, `deletedAt === null` = may add), `uploadLink({ lesson }, { back, name, share })`.
- Produces: load data `places: { value: number; label: string }[]` — `{ value: 0, label: 'Mine' }` first, then each group the person edits; `today: string`.
- Produces: action `create` → `{ action: 'create', ok: true, lessonId: number, title: string }`; refusals are `readNewLesson`'s, plus `fail(400, { action: 'create', field: 'teamId', message: 'Pick where it goes.' })` for a `teamId` that is not 0 and not a group the person edits.
- Produces: `NewLessonSheet` props `places?: { value: number; label: string }[]` (renders a `PickerField name="teamId"` titled "Where", helper "A group's lesson starts as a draft", only when given with more than one place) and `submit?: string` (footer words; default unchanged).

- [ ] **Step 1: Write the failing tests:**
  - `it('makes the lesson in the person's own lessons')`: `teamId: '0'` → ok, lesson's `user_id` u1, its review exercise exists.
  - `it('makes a draft in a group the person edits')`: `createTeam` by u1, `teamId` = it → lesson's `team_id` set, `published_at` null.
  - `it('refuses a group the person only reads')`: u2's team, u1 joined as member → 400 field `teamId`, no lesson.
  - `it('refuses a stranger's group')` → same 400.
  - `it('hands back a blank title under Title')`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** load and action (the space: `{ dance, teamId, actorId: userId }` for a group, the wall for 0).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: The page.** The Recent lessons card's first row (option 4B): an accent-filled 40 px tile with the plus, "New lesson" in `text-accent-text` bold, "Make one for this video" muted, a chevron; it opens `NewLessonSheet` (`action="?/create"`, `places`, `submit="Make it and add the video"`, `handle`). On `success` the handler sets `location.href = uploadLink({ lesson: lessonId }, { back: '/{dance}/lessons/{lessonId}', name: title, share: data.key })` and shows the row's spinner as a tapped row does. With no lessons and no groups the card holds only that row (the old empty state goes); the heading still reads "Recent lessons" only when there are some.
- [ ] **Step 6: Check by eye** (`/{dance}/share?key=00000000-0000-4000-8000-000000000000`, light and dark).
- [ ] **Step 7: `npm run check`, then commit** — `feat(share): make a lesson for a shared video`.

### Task 6: Routines from a class

**Files:**
- Modify: `src/lib/server/lessons.ts` (a query), `src/lib/server/moves-lists.ts` (`routinesList`), `src/routes/[dance]/(moves)/+layout.server.ts` (pass today), `src/lib/moves/routines.ts` (words), `src/lib/types.ts` (`RoutineItem`), `src/lib/components/moves/RoutinesList.svelte`
- Test: `src/lib/server/lessons.spec.ts`, `src/lib/moves/routines.spec.ts`

**Interfaces:**
- Produces: `latestClassDays(db: Db, routineIds: number[], reader: { userId: string; editsTeamId: number | null }): Map<number, string>` in `lessons.ts` — per routine the greatest `lesson_day` among live lessons in `lesson_routines` that the reader sees: their own (`lessons.user_id = userId`), a group's published one, or any of `editsTeamId`'s (group mode).
- Produces: `RoutineItem.classDay?: string | null` — already the label (`classDayLabel(day, today)`).
- Produces: `routinesList(db, wall, mode, today: string)`; `fromClass(label: string): string` → `` `From class ${label}` `` in `src/lib/moves/routines.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `latestClassDays`: two own lessons linking one routine (2026-10-21, 2026-11-03) → `'2026-11-03'`; an archived lesson is skipped; a group's draft is skipped for a member but counted with `editsTeamId`; a routine in no lesson is absent.
  - `fromClass('Tue 3 Nov') === 'From class Tue 3 Nov'`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the query and wire it: `routinesList` takes `today`, fills `classDay` on own rows and on each group's rows (`editsTeamId` = the mode's team when in group mode, else null); the layout passes `localDay(Date.now(), locals.user.timezone)`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: The row** (option A2): after the slot count, when `classDay` is set, a `<span>` in `text-accent-text font-bold` holding `Icon name="lessons" size={15}` and the day, `aria-label={fromClass(classDay)}`. Not a link: the whole row stays the one link.
- [ ] **Step 6: Check by eye** (`/{dance}/routines`, light and dark) against the A2 mockup.
- [ ] **Step 7: `npm run check`, then commit** — `feat(moves): mark routines from a class`.

### Task 7: Publish as a real button

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (`draftBand`), `src/lib/lessons/page.ts` (words)
- Test: `src/lib/lessons/page.spec.ts`

**Interfaces:**
- Produces: `DRAFT_BAND = { title: 'Draft', line: "Members don't see it yet", publish: 'Publish' }` in `src/lib/lessons/page.ts`.

- [ ] **Step 1: Write the failing test** — `DRAFT_BAND` has those three strings.
- [ ] **Step 2: Run, expect FAIL; implement; run, expect PASS.**
- [ ] **Step 3: The strip** (option 3A): on the phone one block on the band — `bg-band-track` (black 15 %), `rounded-[18px]`, `py-2 pr-2 pl-3`; "Draft" 15/800 and the line 13/600 in `text-band-small`; the Publish button a cream pill with the `upload` icon: build it as a new `button()` kind or a `STRIP_ACTION`-style constant in `ui/styles.ts` via `swap()` (cream fill, band-coloured text, `desk:` keeps today's accent fill), never classes appended in the `.svelte` file. The `Badge` and the old line go. The form still posts `?/publish` with `use:enhance`.
- [ ] **Step 4: Check by eye** — a draft lesson (in a copy of the backup, set `published_at = null` on lesson 29), light and dark, phone and `--viewport` 1440×900.
- [ ] **Step 5: `npm run check`, then commit** — `feat(lessons): Publish as a real button`.

Not in this plan: "Publish" as the first row of the lesson's ⋯ menu waits for slot 3's shared menu to reach master; add it then (upload icon, "Publish", "Members of <group> see it" under it, posting `?/publish`).

### Task 8: Docs and the whole check

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-lessons-design.md` (a dated note: one "+ Add" per list, the Links popup, New position), `docs/superpowers/specs/2026-10-15-video-section-links-design.md` (a section takes its first link's name; the boot step), `CLAUDE.md` (Layout: `section-names.ts`, `position-form.ts`, `AddLinkSheet`)

- [ ] **Step 1:** Write the notes.
- [ ] **Step 2:** `npm run check` — must pass.
- [ ] **Step 3:** Shoot `pages.txt` at 390×844 light and dark from a backup copy and look at every lesson, share and routines page once more.
- [ ] **Step 4: Commit** — `docs: lesson links part A`.
