# Redesign: a figure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw a figure's page (`/[dance]/figures/[id]`, one variation per URL) in the
new look — compact band, facts card with the 8-count strip, Practice, the new "In
routines · N" list, recordings, sections, links, Taught in, Move to… and Archive — with
its variation switcher pinned to the bottom of a screen that has no tab bar, and its
edit mode behind the band's pencil with one pinned Save.

**Architecture:** The page keeps its route, its load and its actions; the load gains two
derived things (`routines`: which live routines call this variation, from the coverage
maths; `practice`: the Practice row's line, from the urgency plan of its one exercise).
Every line of copy that depends on data (timing, practice, variation position, Move and
Archive wording, the delete question, the length check) is a pure function in
`src/lib/figures/page.ts` with a spec; the components only lay them out. Shared pieces
changed here (`UploadButton`, `AppUploadLink`, `VideoSections`, `LinksEditor`'s Save
video states, `RemoveWarning`, `Screen`, `VideoFrame`, `FigureFields`) gain optional
props only, so the lesson page and the drill content keep compiling and working.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node only), Drizzle/SQLite
(no schema change).

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "A figure", "Patterns used
across screens", "Additions" (In routines). Board source:
`docs/superpowers/design-kit/screens/figure.py`; previews `s-figure-0.png` … `s-figure-4.png`
in the scratchpad `previews/` folder. Figures as variations:
`docs/superpowers/specs/2026-10-29-figures-are-variations-design.md`.

**This is plan 5 of 13.** All plans land on branch `app-icons`. It builds on the
foundation (plan 1) and reuses, without re-creating: plan 2's `SELECT`; plan 3's `Sheet`
(`subtitle`/`actions`/`tall`), `BottomBar`, restyled `VideoFrame` (`caption`),
`SectionCard`, `YouTubeCard`, `LinkList`, `LinksEditor`, `recordingCaption`, the log
popup and its `restoreSet` action on this route; plan 4's `FieldError`, `plural`
(`src/lib/moves/plural.ts`), `FigureFields` restyle with `errors`. Out of scope: the log
popup and exercise page (plan 3), the routine page (plan 6), the shared Picker's look
(plan 7 — `PickerField` in Move to… keeps whatever look it has), the full-screen video
player (plan 10).

## Global Constraints

From the foundation, verbatim:

- Colours come from `tokens.ts` / `layout.css` only; no hex in components.
- Small text ≥ 4.5:1 against its background, large (≥ 24 px) ≥ 3:1, in all four themes.
- Small text on the light salsa band is white `#ffffff`; band title and icons are cream `#FFF3E4`.
- Fonts: Bricolage Grotesque (titles, hero, big numbers) and Manrope (everything else), self-hosted.
- Icons: 24 px grid, 2 px round strokes; filled variants for the four tabs; tab bar icons 28 px.
- Radii: 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill. Spacing 4, 8, 12, 16, 20, 24, 32, 48.
- Focus: 2 px accent ring + 4 px halo (accent at 20 %); around a filled control, a 2 px gap first.
- No dance switch anywhere; no dance name in a header.
- Touch targets ≥ 44 px.
- Respect `prefers-reduced-motion` for every animation.
- Project rules from `CLAUDE.md` hold: `use:guarded` for filled-in forms, no browser `confirm()`, nothing from `$lib/server` in components, `npm run check` must pass.

This area's:

- The URL, the `?v=` redirect, every action name (`update`, `createVariation`, `move`, `archive`, `practise`, `log`, `deleteSet`, `restoreSet`, `deleteRecording`, `linkSection`, `unlinkSection`, `addLink`, `deleteLink`, `saveVideo`, `retryVideo`) and every form field name stay as they are.
- A variation is shown as `figureLabels` wording ("Enchufla · Doble") wherever it is listed (Follows from, Leads to, "Linked to …"); the band shows the figure name with the variation name as subtitle.
- Small accent text is `text-accent-text`, never bare `text-accent`.
- Status words: "n days overdue", "Never done", "Due today", "Not in a routine yet" in `text-status` 700; "Done today" and "loops" in `text-done`; danger only for what destroys (delete, archive, "and remove figure").
- Rows: a row is a link (chevron) or holds one button, never both; lists are `GROUP` cards under a `SECTION_LABEL`.
- This is a pushed screen with no tab bar: the variation bar and the edit `BottomBar` sit at `bottom: 0` with `env(safe-area-inset-bottom)` padding; nothing uses `--tab-bar-h` or the old `3.5rem + 1px` offset.
- Edit is the band's pencil: × "Stop editing" (asks if unsaved, via `leaveOrAsk`) and one Save pinned at the bottom; the variation bar is hidden while editing.
- Every question that was a `confirm()` is a kit `Dialog` (delete a recording); Move to…, Archive, the variations list and New variation are bottom `Sheet`s, as the board draws them.
- Dates on screen go through `src/lib/format.ts` (`longDayLabel`), never `toLocaleDateString`.
- Shared components touched here keep every existing prop and default; additions are optional.

## Review Focus

1. **A variation in an embedded routine, or twice in one routine:** "In routines" lists the parent with the embedding slot's number, lists a routine once however many slots call it ("Slots 2 and 5 of 8"), and never lists an archived routine. Pinned by the `routinesUsing` tests in Task 1.
2. **The practice line counts calendar days, not hours:** a daily exercise done at 23:30 yesterday reads "Done yesterday" at 07:00 (not due), every-3-days done 5 days ago reads "2 days overdue", a set today reads "Done today", never done reads "Never done", a parked one "Inactive · not on Today's list". Pinned by the `practiceLine` tests in Task 1.
3. **A figure with one variation:** both steps disabled, "1 of 1 variation", the middle still opens the list with New variation; with three, › on the last wraps to the first. Pinned by the `variationNav` tests in Task 3.
4. **Moving into a figure that has the name already, typed differently:** "  doble " against "Doble" is a clash, shown under the field, Move disabled; the last variation's button is the danger "Move and remove figure"; a server refusal lands under the field it is about. Pinned by the `moveState` tests and the `move` action tests in Task 4.
5. **Long names:** "Dile que no con vuelta" / "Doble con mano" wraps to two lines in the compact band, ellipsizes in the slim band and in the variation bar's middle, and never pushes the pencil or the ‹ › steps off screen. Pinned by the long-name screenshot steps in Tasks 2 and 3.

---

### Task 1: What the page derives — routines that use it, the practice line

**Files:**
- Modify: `src/lib/routines/coverage.ts` (add `RoutineUse`, `routinesUsing`)
- Test: `src/lib/routines/coverage.spec.ts`
- Create: `src/lib/figures/page.ts` (this task: `practiceLine`, `routineUseMeta`; later tasks add to it)
- Test: `src/lib/figures/page.spec.ts`
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (load: `routines`, `practice`)
- Test: `src/routes/[dance]/dance-wall.spec.ts` (the figure page's describe block)

**Interfaces:**
- Consumes: `RoutineShape`, `loops` (`src/lib/routines/routines.ts`); `Graph` (`$lib/graph/graph`); `Plan`, `PlanExercise` (`$lib/urgency/urgency`); `MetaPart` (`$lib/exercises/today`); `frequencyLabel`; `plural` (plan 4, `src/lib/moves/plural.ts`); server `routineShapes`, `listRoutines`, `exerciseHistory`, `plan`.
- Produces:
  - `interface RoutineUse { id: number; name: string; slots: number[]; slotCount: number; loops: boolean }` — `slots` are 1-based positions in the routine's own top-level slots, ascending, no repeats; an embedded child's slot counts as the embedding slot's position.
  - `routinesUsing(g: Graph, versionId: number, shapes: Map<number, RoutineShape>, routines: { id: number; name: string }[]): RoutineUse[]` — only the routines passed (the live ones), only those with ≥ 1 slot calling it, by name (`localeCompare`) then id.
  - `routineUseMeta(u: Pick<RoutineUse, 'slots' | 'slotCount'>): string` — "Slot 3 of 6", "Slots 2 and 5 of 8", "Slots 1, 4 and 6 of 9".
  - `practiceLine(p: Plan<PlanExercise>): { title: string; meta: MetaPart } | null` — `null` when every band is empty.
  - Load adds `routines: RoutineUse[]` and `practice: { title: string; meta: MetaPart } | null` (null when the variation has no exercise or its popup data is null).

- [ ] **Step 1: Write the failing tests.** In `coverage.spec.ts`, with a small graph from the existing spec's helpers:

```ts
describe('routinesUsing', () => {
  it('numbers the slots that call it, once per routine', () => {
    // A: [x], [7, y], [z], [w], [7] ; B: [7], [q], [r], [s], [t], [u]
    expect(routinesUsing(g, 7, shapes, [{ id: 1, name: 'Social set A' }, { id: 2, name: 'Cubana combo' }]))
      .toEqual([
        { id: 2, name: 'Cubana combo', slots: [1], slotCount: 6, loops: expect.any(Boolean) },
        { id: 1, name: 'Social set A', slots: [2, 5], slotCount: 5, loops: expect.any(Boolean) }
      ]);
  });
  it('counts an embedded routine at the embedding slot', () => {
    // C: [a], child(B) → B calls 7 in its first slot
    expect(routinesUsing(g, 7, shapes, [{ id: 3, name: 'C' }])[0].slots).toEqual([2]);
  });
  it('ignores routines not passed in (archived) and routines that never call it', () => {
    expect(routinesUsing(g, 7, shapes, [{ id: 4, name: 'Other' }])).toEqual([]);
  });
  it('says whether the routine loops', () => {
    // one slot of a figure starting on 1, 8 counts, neutral → neutral: loops;
    // one slot of a figure ending on another position: does not
    expect(routinesUsing(g, 7, loopingShapes, [{ id: 5, name: 'L' }])[0].loops).toBe(true);
    expect(routinesUsing(g, 8, loopingShapes, [{ id: 6, name: 'N' }])[0].loops).toBe(false);
  });
});
```

  In `page.spec.ts`:

```ts
it('names the slots', () => {
  expect(routineUseMeta({ slots: [3], slotCount: 6 })).toBe('Slot 3 of 6');
  expect(routineUseMeta({ slots: [2, 5], slotCount: 8 })).toBe('Slots 2 and 5 of 8');
  expect(routineUseMeta({ slots: [1, 4, 6], slotCount: 9 })).toBe('Slots 1, 4 and 6 of 9');
});
describe('practiceLine', () => {
  // Build each Plan with `plan([exercise], sets, now, 'Europe/Ljubljana')`.
  it('a set today', () => expect(practiceLine(p)).toEqual({ title: 'Every 3 days', meta: { text: 'Done today', tone: 'done' } }));
  it('never done', () => expect(practiceLine(p)?.meta).toEqual({ text: 'Never done', tone: 'status' }));
  it('overdue by calendar days', () => // every 3 days, last set 5 calendar days ago
    expect(practiceLine(p)?.meta).toEqual({ text: '2 days overdue', tone: 'status' }));
  it('one day overdue', () => expect(practiceLine(p)?.meta.text).toBe('1 day overdue'));
  it('due, not yet a whole day over', () => // weekly, last set 7 calendar days ago, elapsed ≥ 7 days
    expect(practiceLine(p)?.meta).toEqual({ text: 'Due today', tone: 'status' }));
  it('daily, done 23:30 yesterday, read at 07:00', () =>
    expect(practiceLine(p)).toEqual({ title: 'Daily', meta: { text: 'Done yesterday', tone: null } }));
  it('not due yet', () => expect(practiceLine(p)?.meta).toEqual({ text: 'Done 2 days ago', tone: null }));
  it('parked', () => expect(practiceLine(p)?.meta).toEqual({ text: "Inactive · not on Today's list", tone: null }));
  it('nothing to say', () => expect(practiceLine({ doneToday: [], due: [], upcoming: [], inactive: [] })).toBeNull());
});
```

  In `dance-wall.spec.ts` (figure page block): "load lists the routines that use the variation" — make a routine with `createRoutineFromFigures(db, 'salsa', { name: 'Set A', notes: null }, [salsaFigureId2, salsaFigureId])`, make a second one with it and `archiveRoutine(db, second.routine.id, Date.now())`, then `expect(loadAt(figurePage.load, 'salsa', String(salsaFigureId))).toMatchObject({ routines: [{ name: 'Set A', slots: [2], slotCount: 2 }] })` (exactly one entry).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/routines/coverage.spec.ts src/lib/figures/page.spec.ts` — Expected: FAIL (functions missing).
- [ ] **Step 3: Implement** `routinesUsing` (walk `shape.slots` with their index; an `options` slot matches on `figureIds`, a `child` slot on any of its `slots`' `figureIds`; `loops(g, shape)`), `routineUseMeta`, and `practiceLine`. `practiceLine` rules, in band order: `doneToday` → "Done today" / `done`; `inactive` → "Inactive · not on Today's list" / `null`; `due` with `lastDoneDaysAgo === null` → "Never done"; `due` with `over = lastDoneDaysAgo − everyDays ≥ 1` → `plural(over, 'day', 'days') + ' overdue'`; other `due` → "Due today" (all three `status`); `upcoming` → "Done yesterday" (1), "Done n days ago" (n ≥ 2), "Done today" (0) / `null`. `title` is `frequencyLabel(everyDays)`.
- [ ] **Step 4: Load.** In `+page.server.ts` add `routines: routinesUsing(graph, id, routineShapes(db, dance), listRoutines(db, dance))` (the graph is already built) and, when `popup` is not null, `practice: practiceLine(plan([popup.exercise], exerciseHistory(db, popup.exercise.id, 50).map((s) => ({ exerciseId: popup.exercise.id, doneAt: s.doneAt })), now, zone))` with the same `now` the popup used (hoist one `const now = Date.now()`); else `null`. A comment: derived per request, never stored.
- [ ] **Step 5: Run** `timeout 600 nix develop -c npx vitest run src/lib/routines src/lib/figures src/routes/[dance]/dance-wall.spec.ts` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(figure): the routines that use a variation, and its practice line`.

### Task 2: The reading page — band, facts, Practice, In routines, the lists, the end

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (reading mode, top to bottom except recordings/sections/links, which Tasks 5–6 redraw; leave those blocks in place)
- Modify: `src/lib/figures/page.ts`, `src/lib/figures/page.spec.ts` (`timingLine`, `archiveCopy`, `recordingDay`)
- Modify: `src/lib/components/ui/Screen.svelte` (the slim band shows a compact screen's subtitle)
- Modify: `src/lib/icons/icons.ts` (add `move-to`)
- Modify: `src/lib/nav/pending.ts`, `src/lib/nav/pending.spec.ts`, `src/lib/components/shell/PageSkeleton.svelte` (a figure-shaped skeleton)

**Interfaces:**
- Consumes: `practice`, `routines`, `routineUseMeta` (Task 1); `Screen`, `BandButton`, `Badge`, `Icon`, `button`, `iconButton`, `GROUP`, `SECTION_LABEL`, `LinkedText`, `FieldError` (plan 4), `longDayLabel`.
- Produces:
  - `timingLine(start: number, length: number): { main: string; extra: string }` — `main` "Starts on 1 · 16 counts"; `extra` " · 2 eights" when `length % 8 === 0 && length > 8`, " · one 8-count" when `length === 8`, else "".
  - `archiveCopy(figure: string, variation: string, last: boolean): { title: string; button: string; caption: string }` — not last: "Archive Doble?", "Archive Doble", "Doble leaves Enchufla. Its recordings and practice history are kept."; last: "Archive Basic?", "Archive and remove figure", "Setenta goes with it: Basic is its last variation. Its recordings and practice history are kept."
  - `recordingDay(day: string, today: string): string` — `longDayLabel(day)`, plus `, <year>` when the year differs from `today`'s.
  - Icon `move-to`: `<path d="M4 12h11M11 6.5l5.5 5.5-5.5 5.5"></path><path d="M20 5v14"></path>` (from `figure.py`).
  - `Skeleton` gains `{ kind: 'figure' }`; `skeletonFor('/[dance]/figures/[id]')` returns it.
  - `Screen`: when `compact` and `subtitle` are both set, the slim band shows the subtitle under its title (12/600 `text-band-small`, one line, ellipsis).

- [ ] **Step 1: Write the failing tests.** `timingLine(1, 16)` → `{ main: 'Starts on 1 · 16 counts', extra: ' · 2 eights' }`; `timingLine(1, 8)` → extra `' · one 8-count'`; `timingLine(5, 4)` → `{ main: 'Starts on 5 · 4 counts', extra: '' }`; `timingLine(3, 12)` → extra `''`. `archiveCopy('Enchufla', 'Doble', false)` and `archiveCopy('Setenta', 'Basic', true)` → the strings above. `recordingDay('2026-10-28', '2026-10-31')` → `'Wednesday, 28 October'`; `recordingDay('2025-10-28', '2026-10-31')` → `'Tuesday, 28 October, 2025'`. `pending.spec.ts`: `skeletonFor('/[dance]/figures/[id]')` → `{ kind: 'figure' }`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/figures src/lib/nav` — Expected: FAIL.
- [ ] **Step 3: Implement** the three functions, the icon, the skeleton kind (PageSkeleton draws: a compact band with a back and a pencil placeholder and a 30 px title bar ~55 % wide; on the sheet a `bg-surface` radius 16 card holding two 22 px pill bars, a row of eight 30 px cells, two text bars; a 13 px label bar; a two-row group — all in `bg-skeleton`), and the `Screen` slim subtitle.
- [ ] **Step 4: The band.** Replace the sticky header with `<Screen compact title={figure.name} subtitle={variation.name}>`: `left` = `BandButton icon="back" label="Back to Moves" href=/[dance]/figures`; `right` = `BandButton icon="pencil" label="Edit"` → `editing = true; window.scrollTo({ top: 0 })`. Keep `<svelte:head>`'s title.
- [ ] **Step 5: The facts card** (to `summary` in `figure.py`): `bg-surface` radius 16, padding 16, children 14 px apart, full-width hairlines (`-mx-4 h-px bg-hairline`) between parts. Badges row (gap 6, wrap): the style badge `<Badge tone="accent">` with `dance.styleLabel[styleTag]` (only when `styleTag`), the partner badge `<Badge tone="neutral">` with `people` 14 (partner) or `solo` 14 and `PARTNER_LABEL`. Timing: a row with "Timing" (13/700 `text-muted`) left and `main` (15/700 `text-ink`) + `extra` (500 `text-muted`) right, from `timingLine(effective.startCount, effective.lengthCounts)`; under it `role="img" aria-label="Starts on count {n}"` with eight `flex-1` cells, 30 px tall, radius 8, 4 px apart, 14/800 tabular — the start cell `bg-accent text-on-accent`, the others `bg-chip text-ink-2`. Handholds: label "Handholds" (13/700 muted) over the value 15/700 `text-ink` — today's `handholds` string with the arrow drawn as a muted 600 " → ". Notes (when any): `LinkedText` 15/500 `text-ink-2`.
- [ ] **Step 6: Practice** (label "Practice"). With `data.practice` (and `data.popup`): a `GROUP` of two rows — row 1 (min-h 60, `pl-4 pr-1.5`, holds one button): title `practice.title` 16/700, meta 13 `practice.meta.text` (`text-status` 700 / `text-done` 700 / `text-muted` by tone), trailing `iconButton('bare')` `text-accent` with `plus` 24, `aria-label="Log {popup.exercise.name}"` → `logging = true`; row 2 a link to `/[dance]/exercises/[id]` (min-h 60): "Its exercise" over "History, how often, active" (13 muted), `chevron-right` 20 `text-chevron`. Without an exercise: one row "Via routines" over "No exercise of its own", trailing — inside the existing `use:enhance` form to `?/practise` — `button('secondary', 'sm')` "Practise on its own" (Spinner while posting, width kept); the `practise` refusal as `<FieldError id="practise-error">` under the group.
- [ ] **Step 7: In routines.** Label "In routines · {n}" (n > 0) or "In routines". Rows: links to `/[dance]/routines/[id]` (min-h 60): name 16/700; meta 13 `text-muted` = `routineUseMeta(u)` followed, when `u.loops`, by " · " and "loops" in `text-done` 700; `chevron-right`. None: a `bg-surface` radius 16 card (`px-4 py-3.5`) with "Not in a routine yet" 15/700 `text-status`.
- [ ] **Step 8: Follows from / Leads to.** Two labelled groups, stacked ("Follows from", then "Leads to" 6 px further down): link rows (min-h 48, 16/700) to each item's page with `chevron-right`; none: a card with "Nothing yet" 14 `text-muted`.
- [ ] **Step 9: Taught in** (only when any): label "Taught in · {n}", link rows (min-h 60) — lesson title 16/700 over `longDayLabel(lessonDay)` 13 muted, chevron.
- [ ] **Step 10: The end.** A hairline (`h-px bg-hairline`, 18 px above, 10 px below); a one-row `GROUP` holding a `<button aria-haspopup="dialog">` (min-h 64): a 40 px `bg-chip` disc with `move-to` 22 `text-ink-2`, "Move {variation} to…" 16/700 over "A new figure of its own, or another figure" 13 muted, `chevron-right` → `moving = true`; then `button('danger-text', 'md', true)` with `trash` 20 reading `Archive {variation}` (`aria-haspopup="dialog"`, opens the Archive sheet; the sheet's own button carries "and remove figure"); then the caption `archiveCopy(...).caption` 13 `text-muted`, centred, `px-4`.
- [ ] **Step 11: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 12: Look.** `$SHOTS/page.sh OUTDIR /salsa/figures/<a variation with an exercise, routines and notes> /bachata/figures/<a figure with one variation, no exercise>` and `FULL=1` for the first (`SHOTS` = the scratchpad `tools/` folder; pick ids from the dev database). Compare with "A variation", "End of the page" and "One variation, nothing yet" in `s-figure-0/1/3.png`, light and dark. Then rename a dev variation to "Doble con mano" in a figure renamed "Dile que no con vuelta" (through the edit form or SQL on the dev db only), screenshot it at the top and scrolled 300 px: the compact title wraps to two lines, the slim band ellipsizes title and subtitle, the pencil stays on screen. Put the names back.
- [ ] **Step 13: Commit** `feat(figure): the variation page reads in the new look`.

### Task 3: The variation switcher and its sheets

**Files:**
- Modify: `src/lib/components/figures/VariationBar.svelte`
- Modify: `src/lib/figures/page.ts`, `src/lib/figures/page.spec.ts` (`variationNav`)
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (`createVariation` refusals name their field)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (render the bar only while reading; the end spacer)
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: `Sheet` (`back`, `sub`, `footer`), `FieldError`, `button`, `iconButton`, `GROUP`, `FIELD`, `LABEL`, `Icon`, `Spinner`, `plural`.
- Produces:
  - `variationNav(siblings: { id: number }[], currentId: number): { index: number; count: number; prev: number | null; next: number | null; position: string }` — `prev`/`next` wrap, both `null` when `count === 1`; `position` "2 of 3 variations", "1 of 1 variation"; an unknown `currentId` counts as index 0.
  - `createVariation` refusals: `fail(400, { action: 'createVariation', field: 'name', message, name })` (messages unchanged).
  - `VariationBar` props unchanged (`figureName`, `siblings`, `currentId`, `slug`, `failed`); the page renders it only while `!editing`.

- [ ] **Step 1: Write the failing tests.** `variationNav([{id:4},{id:9},{id:12}], 9)` → `{ index: 1, count: 3, prev: 4, next: 12, position: '2 of 3 variations' }`; with `12` → `next: 4` (wraps); `variationNav([{id:4}], 4)` → `{ index: 0, count: 1, prev: null, next: null, position: '1 of 1 variation' }`. In `dance-wall.spec.ts`, extend "createVariation refuses a taken name" with `field: 'name'` and `name: ' basic '` in the expected data, and add: an empty name → `{ field: 'name', message: 'Give the variation a name (up to 200 characters).' }`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/figures src/routes/[dance]/dance-wall.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `variationNav` and the action's `field`/`name`.
- [ ] **Step 4: The bar** (to `var_bar`): `<nav aria-label="Variations of {figureName}">` fixed at `bottom: 0`, full width, `z-30`, `bg-tab-bg`, top border `tab-line`, padding `10px 12px calc(10px + env(safe-area-inset-bottom))`, its content in the 560 px column, gap 8. The steps: 48 px round `iconButton('step')`-look links (`h-12 w-12`) with `chevron-left` / `chevron-right` 22, `aria-label="Previous variation: {name}"` / `"Next variation: {name}"`; with one variation they are `<button disabled aria-label="Previous variation">` in the step's disabled look (the bar keeps its shape). The middle: a `<button aria-haspopup="dialog">` `flex-1 min-w-0 h-[52px] rounded-full bg-accent-soft px-4`, centred: the variation name 16/800 `text-ink` (one line, ellipsis) over `position` 12/700 `text-accent-text`, then `chevron-up` 18 `text-accent-text`. Delete the old comment about the tabs' offset; say instead that a pushed screen has no tab bar, so the bar sits on the bottom edge. The page ends, while reading, with an `aria-hidden` spacer `h-[calc(4.5rem+env(safe-area-inset-bottom))]` so the caption under Archive clears the bar.
- [ ] **Step 5: The list sheet** (to `variations_sheet`): `Sheet title="Variations of {figureName}"`; a `<ul class={GROUP} aria-label="Variations">` of links (min-h 72, `px-4 py-3`, gap 12): name 16/700, then `holds` and `"{timing} · {recordings}"` as two 13 `text-muted` lines; the current row `aria-current="page"`, `bg-accent-soft`, leading filled `check-circle` 22 `text-accent` (`--icon-knockout: var(--color-on-accent)`). `footer`: `button('secondary', 'md', true)` with `plus` 20 "New variation" → opens the name sheet ON TOP of the list (`adding = true`, `listing` stays true).
- [ ] **Step 6: The New variation sheet** (to `new_variation`): `Sheet title="New variation" sub="of {figureName}" back` — Back closes it and shows the list beneath. The form (`id="new-variation"`, `use:guarded` label "New variation", as now): `LABEL` "Name", `FIELD` `name="name"` `required` `maxlength="200"` placeholder "e.g. Doble, From cross", `aria-invalid` + `aria-describedby` and `<FieldError id message>` when the refusal shows (the typed name is kept: SvelteKit does not reset a form on a failure); then "It starts as a copy of {current} — handholds, timing and notes, not its recordings. Change them with Edit." 14 `text-muted` `leading-[1.45] px-1`. `footer`: `<button type="submit" form="new-variation">` `button('primary', 'md', true)` with `plus` 20 "Add variation" (Spinner while posting). Keep the effects that close both sheets on a new `currentId` and reopen the name sheet on a refusal.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** Write `figure-states.py` in the scratchpad `tools/` folder, modelled on `today-states.py` (light and dark, 390 × 844, the saved cookie state): open a three-variation figure, tap the bar's middle (list), tap New variation (stacked name sheet), submit a sibling's name (error under Name, text kept), press Back (the list again); open the one-variation bachata figure (disabled steps, "1 of 1 variation"); and the long-named variation from Task 2 (the middle ellipsizes, both steps visible). Compare with "Variation switcher", "Add variation · name taken" and the bars in `s-figure-0..3.png`. Check FULL-page that the last line of the page clears the bar and the bar touches the bottom edge.
- [ ] **Step 9: Commit** `feat(figure): the variation switcher on the bottom edge, its sheets in the new look`.

### Task 4: Move to… and Archive

**Files:**
- Modify: `src/lib/components/figures/MoveSheet.svelte`, `src/lib/components/figures/RemoveWarning.svelte`
- Modify: `src/lib/figures/page.ts`, `src/lib/figures/page.spec.ts` (`moveState`)
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (`move` refusals name their field)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (the Archive sheet)
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: `archiveCopy` (Task 2); `Sheet` (`footer`), `Banner`, `FieldError`, `PickerField` (look unchanged — plan 7), `button`, `FIELD`, `LABEL`, `SECTION_LABEL`, `Spinner`.
- Produces:
  - `moveState(i: { last: boolean; chosen: { name: string; variations: string[] } | null; joinName: string }): { cta: string; danger: boolean; clash: string | null; blocked: boolean }` — compared trimmed and case-insensitive (as the server does); `clash` = "{chosen} already has a {joinName trimmed}. Pick another name."; `blocked` when a figure is chosen and the name is blank or clashes; `cta` "Move and remove figure" (last) / "Move to {chosen}" / "Make it its own figure"; `danger` = `last`.
  - `move` refusals gain `field`: `'figureName'` for "Give the new figure a name (up to 200 characters)." and "There's already a figure called …"; `'name'` for the taken variation name (it already returns `name`); none for "Pick where to move it." and the same-figure refusal. Messages unchanged.
  - `RemoveWarning` props `{ figure: string; variation: string; kept?: boolean }` — a `<Banner kind="error" title="{figure} will be removed">` with "{variation} is its last variation, and a figure with no variations is gone. It leaves the figures list." plus " Its recordings and practice history are kept." when `kept`.

- [ ] **Step 1: Write the failing tests.** `moveState({ last: false, chosen: { name: 'Dile que no', variations: ['Basic', 'Doble'] }, joinName: '  doble ' })` → `{ cta: 'Move to Dile que no', danger: false, clash: 'Dile que no already has a doble. Pick another name.', blocked: true }`; `joinName: ''` → `blocked: true, clash: null`; `joinName: 'Cuddle entry'` → `blocked: false`; `{ last: true, chosen: null, joinName: 'Basic' }` → `{ cta: 'Move and remove figure', danger: true, clash: null, blocked: false }`; `{ last: false, chosen: null, … }` → cta `'Make it its own figure'`. In `dance-wall.spec.ts` add `field` to the existing move refusal expectations: the taken variation name → `field: 'name'`; the taken new-figure name and the blank one → `field: 'figureName'`; the same-figure one has no `field` (`expect(result.data).not.toHaveProperty('field')`).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/figures src/routes/[dance]/dance-wall.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `moveState` and the action's `field`s; `MoveSheet` reads `cta`, `clash`, `blocked`, `danger` from `moveState` (its own copies go).
- [ ] **Step 4: Move to…** (to `move_clash` / `move_last`): `Sheet title="Move “{variation}” to…"`; the form gets `id="move-form"`. A `bg-surface` radius 16 card (`px-4 py-1.5`) holding the radio row "A new figure of its own" (16/600) over "{variation} becomes its first variation" (13 muted), min-h 44, with a 22 px round mark at its left (`border-2 border-field-line`; checked `border-[7px] border-accent`; focus ring on `has-focus-visible`); while it is chosen, "New figure's name" (`LABEL` + `FIELD`, `name="figureName"`) under it. Then `SECTION_LABEL` "Or join a figure", the `PickerField` (or "There are no other figures yet." 14 muted), and, when a figure is chosen, "Name in {chosen}" (`LABEL` + `FIELD`, `name="name"`) with `aria-invalid` and `<FieldError>` showing `clash` — or the server's `field: 'name'` refusal. A `field: 'figureName'` refusal shows under New figure's name; any other refusal is a `<Banner kind="error">` at the top of the sheet. When `last`, `<RemoveWarning {figure} {variation} />` sits above the footer. `footer`: `<button type="submit" form="move-form" disabled={blocked}>` with `button(danger ? 'danger' : 'primary', 'md', true)` and `cta` (Spinner while posting).
- [ ] **Step 5: Archive** (to `archive_last`): the page's Archive sheet — `Sheet title={archiveCopy(...).title}`; body: `last` → `<RemoveWarning … kept />`, else the caption sentence as 15/500 `text-ink-2`; `footer`: a row (gap 8) of `button('secondary', 'md', true)` "Cancel" (`flex-1`) and `<button type="submit" form="archive-form">` `button('danger', 'md', true)` `flex-[2] px-3` with `archiveCopy(...).button` (Spinner while posting). The form (`id="archive-form"`, `use:enhance={closeOnArchive}`) stays as it is.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** In `figure-states.py`: Move to… on a three-variation figure, pick a figure that has the same name typed in another case (live clash, Move disabled); Move to… and Archive on the one-variation bachata figure (danger banner and button); Archive on a three-variation one (plain line). Compare with "Move to… · name clash", "Move to… · last variation", "Archive · last variation" in `s-figure-3/4.png`, light and dark.
- [ ] **Step 8: Commit** `feat(figure): Move to… and Archive in the new look`.

### Task 5: Recordings and uploads

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (the Recordings block, reading mode)
- Modify: `src/lib/components/ui/UploadButton.svelte`, `src/lib/components/ui/AppUploadLink.svelte`
- Modify: `src/lib/components/ui/VideoFrame.svelte` (an `action` snippet)
- Modify: `src/lib/media.ts` (`uploadProblem`)
- Create: `src/lib/media.spec.ts`

**Interfaces:**
- Consumes: `recordingDay` (Task 2); `VideoFrame` `caption` (plan 3); `byteSize`, `localDay`; `Banner`, `Icon`, `button`, `Spinner`; `MAX_RECORDING_BYTES`, `MAX_RECORDING_LABEL`.
- Produces:
  - `uploadProblem(file: { size: number; type: string }, accept: 'audio/*' | 'video/*,audio/*'): { title: string; body?: string } | null` — size first: "That file is {n} MB; the limit is 95 MB." (from the limits); a non-audio file for `audio/*`: "Only audio files can be added." / body "Pick a video with Add video instead."; a non-audio, non-video file otherwise: "Only video and audio files can be added."
  - `UploadButton` gains `icon?: IconName = 'upload'`, `kind?: 'primary' | 'secondary' = 'secondary'`, `size?: 'sm' | 'md' = 'md'`; existing props unchanged.
  - `AppUploadLink` gains `icon?: IconName = 'video'`, `kind?: 'primary' | 'secondary' = 'secondary'`; `label`, `hint`, `href` unchanged.
  - `VideoFrame` gains `action?: Snippet` — rendered at the right of the caption row in place of Full screen (Full screen then sits in the control row, as it does without a caption). Without `action`, nothing changes.

- [ ] **Step 1: Write the failing test** for `uploadProblem`: a 120 MiB video for `'video/*,audio/*'` → `{ title: 'That file is 120 MB; the limit is 95 MB.' }`; `image/png` for `'audio/*'` → `{ title: 'Only audio files can be added.', body: 'Pick a video with Add video instead.' }`; `video/mp4` for `'audio/*'` → the same; `image/png` for `'video/*,audio/*'` → `{ title: 'Only video and audio files can be added.' }`; `audio/mpeg` 3 MB for either → `null`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/media.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `uploadProblem` (move the checks out of `UploadButton`).
- [ ] **Step 4: UploadButton** — idle: a `<label>` with `button(kind, size, true)` holding the `icon` 20 and `label`, the file input `sr-only` (focus ring via `has-focus-visible`). Uploading (to `upload_card`): the label is replaced by a `role="status"` `bg-surface` radius 16 card (padding 16, gap 12): a 40 px `bg-accent-soft` disc with `upload` 22 `text-accent-text`; "Uploading… {Math.floor(pct)}%" 16/700 over "You can keep using the app; closing the tab stops it" 13 muted; a 6 px `role="progressbar"` (`aria-label="Uploading {label}"`, `aria-valuenow`) — `bg-hairline` track, `bg-accent` fill, radius 3. A problem or a failed request: `<Banner kind="error" title body>` under the button (the 413 and network messages as titles, unchanged). The `track` registration stays.
- [ ] **Step 5: AppUploadLink** — `<a class={button(kind, 'md', true)}>` with `icon` 20 and `label`; the hint under it, 13 `text-muted`, centred. Its eslint comments stay.
- [ ] **Step 6: The Recordings block** (to `enchufla_recordings`, `uploading`, `app_recordings`, `cuddle_top`): label "Recordings · {n}" / "Recordings". Each recording a `<li class="overflow-hidden rounded-2xl bg-surface">`: playable → `VideoFrame` as today plus `caption={{ title: recordingDay(localDay(rec.createdAt, timezone), today), meta: byteSize(rec.sizeBytes) }}` (`today` = `localDay(Date.now(), timezone)` once per render); missing / unplayable (to `problem_card`): `px-4 pt-3.5 pb-2` — a 40 px `bg-chip` disc with `video` 22 `text-muted`; title 16/700 ("This file is missing" / "Can’t play here") over body 14 `text-ink-2` ("The server has no file for this recording." / "This browser can’t play this file. Download it or open it on your phone."); a row indented 52 px, min-h 44: "{day} · {size}" 13 muted and, for unplayable, an `<a download href=/recordings/[file]>` `button('tertiary', 'sm')` with `download` 18 "Download". Sections under each card stay (Task 6 restyles them). Adding, after the list: web — `<UploadButton … label="Add video or audio" />`; in the app — `<AppUploadLink label="Add video" />` (its hint is the board's caption), then `<UploadButton accept="audio/*" icon="mic" label="Add audio" />`. No recordings and no upload yet (to `cuddle_top`): one `bg-surface` radius 16 card (padding 16, gap 12) — a 44 px `bg-accent-soft` disc with `video` 22 `text-accent-text`, "No recordings yet" 16/700 over "Film it after class, or add a voice note" 13 muted — and inside it the same buttons as `kind="primary"` (`size="sm"` on the web one; in the app, Add video primary and Add audio secondary). Keep the `{#key variation.id}` around the buttons.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** Screenshot a variation with two recordings and the empty one-variation figure; in `figure-states.py` pick a 5 MB file with the web button and stop the dev request mid-way (or throttle with `page.route`) to catch the progress card; with `?app=android` set (the app cookie) pick an image with Add audio (error banner). For a missing file, point a dev recording row at a file name that does not exist. Compare with "Scrolled · recordings", "Upload in progress", "In the app · problems", "One variation, nothing yet" in `s-figure-0/2/3.png`.
- [ ] **Step 9: Commit** `feat(figure): recordings, uploads and their problems in the new look`.

### Task 6: Sections and links

**Files:**
- Modify: `src/lib/components/lessons/VideoSections.svelte`
- Modify: `src/lib/video/spots.ts`, `src/lib/video/spots.spec.ts` (`sectionMeta`)
- Modify: `src/lib/components/links/LinksEditor.svelte` (the Save video states)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (the Sections and Links blocks)

**Interfaces:**
- Consumes: `SectionCard` (plan 3: its `unlink` snippet), `LinksEditor`/`LinkList` (plan 3: the `actions` footer row), `LinkSectionSheet` (unchanged), `FieldError`, `button`, `iconButton`, `Icon`, `Spinner`, `spotLabel`, `spotTime`.
- Produces:
  - `sectionMeta(s: Pick<VideoSection, 'startMs' | 'endMs' | 'label' | 'links'>): string` — with a label, "0:12.0–0:19.0 · " first (`spotTime`); then "Linked to " + the links' labels joined by ", " (an archived one gets " (archived)"), or "Not linked".
  - `VideoSections` gains `unlink?: boolean = false` — a section with exactly one link then shows Unlink (a `use:enhance` form to `?/unlinkSection` with `linkId` = that link's id) in place of the link button. Other props and the lesson page's use unchanged.
  - `LinksEditor`'s YouTube actions draw the three Save video states (below).

- [ ] **Step 1: Write the failing tests.** `sectionMeta({ startMs: 12000, endMs: 19000, label: 'Second turn', links: [{ id: 3, label: 'Hammerlock · Basic', archived: false }] })` → `'0:12.0–0:19.0 · Linked to Hammerlock · Basic'`; `{ …, label: null, links: [] }` → `'Not linked'`; two links, one archived → `'Linked to Cross · Basic, Old drill (archived)'`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/video/spots.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `sectionMeta`.
- [ ] **Step 4: VideoSections** (to the `recording(..., spots)` block): a top hairline; label "Sections · {n}" 13/700 `text-muted` `px-4 pt-2.5`; rows (min-h 58, `pl-4 pr-1.5`, gap 12): a 36 px `bg-accent` play disc (filled `play` 18 `text-on-accent`, `aria-label="Play {spotLabel}"`) that opens the `SectionPlayer` as now; `spotLabel` 16/700 (one line) over `sectionMeta` 13 `text-muted` (up to two lines); trailing `iconButton('bare')` `link` 22 `text-accent-text` `aria-label="Link {spotLabel}"` (when `linking`), or with `unlink` and one link, `button('tertiary', 'sm')` "Unlink" (`aria-label="Unlink {spotLabel} from {label}"`). Its empty line stays for the lesson page, as 13 muted `px-4 pb-3`. The old `$lib/components/video/Icon` import goes; use the kit `Icon`.
- [ ] **Step 5: Linked sections** (to `enchufla_sections`): the label row — "Sections · {n}" / "Sections" at the left, `button('tertiary', 'sm')` with `link` 18 "Link a section" (`aria-haspopup="dialog"`) at the right → `LinkSectionSheet` as now (reading mode only). The list: `<ul class="flex flex-col gap-2">` of `SectionCard`s (unlink snippet only while editing — Task 7). None: a `bg-surface` radius 16 card (`px-4 py-3.5`) with "Point at the part of a lesson video that shows this." 14 `text-muted`. The `unlinkSection` refusal: `<FieldError id="unlink-error">` under the list.
- [ ] **Step 6: Links** (to `enchufla_sections` / `enchufla_end`): label "Links · {n}" / "Links", then `LinksEditor` as now. In `LinksEditor`'s YouTube actions (the footer row plan 3 gives `LinkList`), left to right, the state first (`mr-auto`), Remove last: no save yet → a `use:enhance` form to `?/saveVideo` with `button('secondary', 'sm')` + `download` 18 "Save video" (Spinner while posting); `saving.status === 'queued'` → `<span role="status">` with `<Spinner size={16}>` and "Saving at 480p on the home worker" 13/600 `text-muted` (no percentage — the server has none); `'failed'` → `warning` 16 + "Couldn't save: {error ?? 'unknown error'}" 13/700 `text-danger` (wraps), then a `use:enhance` form to `?/retryVideo` with `button('tertiary', 'sm')` + `refresh` 18 "Retry". A saved video needs no state here: the link becomes a recording, which `VideoFrame` marks "from YouTube ↗".
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** Screenshot (FULL) a variation with a recording that has a labelled linked section and an unlabelled one, two linked lesson sections, a YouTube link and a web link; set one dev `video_downloads` row to queued and another to failed for the saving / failed states. Open Link a section (the picker opens; its look is plan 7's). Check `/salsa/lessons/<id>` still shows its video sections and link buttons. Compare with "Scrolled · recordings" and "Scrolled · sections and links" in `s-figure-0.png`.
- [ ] **Step 9: Commit** `feat(figure): sections and links in the new look, Save video states`.

### Task 7: Edit mode, the delete dialog, docs

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (edit mode)
- Modify: `src/lib/components/figures/StartPositions.svelte`, `src/lib/components/figures/FigureTiming.svelte`, `src/lib/components/figures/FigureFields.svelte` (a `figureHelp` prop)
- Modify: `src/lib/figures/page.ts`, `src/lib/figures/page.spec.ts` (`lengthError`, `deleteRecordingBody`)
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `docs/superpowers/specs/2026-10-29-figures-are-variations-design.md`

**Interfaces:**
- Consumes: `Screen`, `BandButton`, `BottomBar` (plan 3), `Dialog`, `Banner`, `FieldError`, `Spinner`, `FIELD`, `LABEL`, `CHIP`, `button`, `iconButton`; `VideoFrame` `action`, `VideoSections` `unlink` (Tasks 5–6); `recordingDay` (Task 2); `leaveOrAsk`, `guarded`; `isLengthCounts`, `MAX_LENGTH_COUNTS`, `plural`.
- Produces:
  - `lengthError(value: string): string | null` — `null` for a whole number 1–64, else "1 to 64 counts. One 8-count is 8." (64 from `MAX_LENGTH_COUNTS`).
  - `deleteRecordingBody(day: string, size: string, sections: number): string` — "{day} · {size}. " + ("Its n saved sections go with it. " | "Its 1 saved section goes with it. " | "") + "This can’t be undone."
  - `FigureFields` gains `figureHelp?: string` — 13 `text-muted` `pl-1` under Figure name.

- [ ] **Step 1: Write the failing tests.** `lengthError('16')` → `null`; `'64'` → `null`; `'70'`, `'0'`, `''`, `'8.5'`, `'abc'` → `'1 to 64 counts. One 8-count is 8.'`. `deleteRecordingBody('Wednesday, 28 October', '34 MB', 2)` → `'Wednesday, 28 October · 34 MB. Its 2 saved sections go with it. This can’t be undone.'`; with `1` → `'… · 34 MB. Its 1 saved section goes with it. This can’t be undone.'`; with `0` → `'Wednesday, 28 October · 34 MB. This can’t be undone.'`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/figures` — Expected: FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: The band and the bar.** Editing: `<Screen compact title={figure.name} subtitle="Editing {variation.name}">`, `left` = `BandButton icon="close" label="Stop editing"` → `leaveOrAsk(editForm, () => (editing = false), 'Stop editing')`, no `right`. `<BottomBar>` holds `<button type="submit" form="edit-form" class={button('primary', 'md', true)}>` with `check` 20 "Save" (`aria-busy` + Spinner while saving, width kept); the content gets `pb-28`. The header Done/Edit buttons and the form's own Save button go. The variation bar is not rendered (Task 3).
- [ ] **Step 5: The form** (to `edit_top` / `edit_timing`), still keyed on `variation.id`, `use:guarded` as now, fields 14 px apart: `FigureFields` with `figureHelp` = "Shared by its {plural(n, 'variation', 'variations')}" when the figure has more than one variation, else unset ("Shared by its 3 variations"); `StartPositions`: `LABEL` "Starts from", chosen positions as 44 px-tall buttons (`aria-label="Remove {name}"`) each holding a 34 px pill `bg-accent-soft text-accent-text` 14/700 (`pl-3.5 pr-2`) with the name (" (archived)" when so) and `close` 16; none chosen: the neutral name 14 `text-muted`; the add control a native `<select aria-label="Add a start position">` drawn as the kit's select field — `FIELD` + `appearance-none pr-10` with a `chevron-down` 20 `text-muted` overlaid at the right, first option "Choose a position…" — its snap-back behaviour unchanged. Ends at: `LABEL` + the same select look (`name="endId"`, options as now). `FigureTiming`: a `role="radiogroup" aria-label="Starts on"` fieldset (`LABEL` legend "Starts on") of eight `flex-1` labels (sr-only radios `name="startCount"`), 44 px tall, radius 12, 4 px apart, 16/800 — checked `bg-accent text-on-accent`, else `bg-surface text-ink` with an inset 1 px `field-line` ring; focus via `has-focus-visible`. Counts: `LABEL` "Counts" for a `FIELD` input (`name="lengthCounts"`, `inputmode="numeric"`, as now) with "counts" 13/600 `text-muted` inside it at the right; once the field has had input and `lengthError(length)` is not null, `aria-invalid` + `aria-describedby` and `<FieldError>` with it, else the helper "How long it takes, 1 to 64. One 8-count is 8." 13 muted; the check never blocks the submit (the server decides). Under it the 4 / 8 / 16 shortcuts as `type="button"` chips in `CHIP`'s look, `aria-pressed` and the chip's selected look when the field holds that value.
- [ ] **Step 6: The refusal.** `failed('update')` shows at the end of the form as `<Banner kind="error" title="Not saved">` with the server's message (`role="alert"`), scrolled into view when it arrives (`scrollIntoView({ block: 'center' })`, `behavior: 'smooth'` unless reduced motion). The update refusals stay as they are (no field).
- [ ] **Step 7: Recordings and sections while editing** (to `edit_delete`): under the form, "Recordings · {n}" with each card as in Task 5 but `VideoFrame`'s `action` = `iconButton('bare')` `text-danger` `trash` 22 `aria-label="Delete this recording"` (problem cards get the same button in their meta row), each card's `VideoSections` with `unlink`, and no Add buttons; then the linked "Sections · {n}" with each `SectionCard`'s `unlink` snippet = a `use:enhance` form to `?/unlinkSection` with `button('tertiary', 'sm')` "Unlink". Nothing else of the reading page shows while editing. The trash opens `<Dialog open title="Delete this recording?" icon="trash" tone="danger" body={deleteRecordingBody(recordingDay(...), byteSize(...), sectionsOnIt)}>` with `button('tertiary', 'sm')` "Cancel" and, in a `use:enhance` form to `?/deleteRecording` (hidden `recordingId`), `button('danger', 'sm')` "Delete" (Spinner while posting); any answer closes the dialog. A refusal (a linked section) shows as `<Banner kind="error">` inside that recording's card. The `confirm()` goes.
- [ ] **Step 8: Docs.** `CLAUDE.md` Layout: add `src/lib/figures/  PURE: a figure page's lines — timing, the practice line, the variation switcher's steps, Move and Archive wording, the delete question, the length check. Client-safe`; in the `src/lib/routines/` entry add "which routines use a version (`routinesUsing`, coverage.ts)". Main spec, lines 339–340: "Phase 3b: "used in routines" (not built)" becomes "In routines · N: the live routines that call this variation, by slot (`routinesUsing`), each opening the routine". Figures-are-variations spec: where it describes the switcher, say it sits on the bottom edge (a pushed screen has no tab bar) and is hidden while editing, and that edit is the band's pencil with one pinned Save.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look.** In `figure-states.py`: the pencil (× on the band, Save pinned, no variation bar), type in Notes and press × (Unsaved changes dialog; Stay keeps the text), set Counts to 70 and Save (the field error and the "Not saved" banner, values kept), remove and re-add a start position, Save a valid change (back to reading, the facts card updated), the trash on a recording (the dialog; Cancel), Unlink on a linked section. Compare with "Edit · field focused", "Edit · timing refused", "Edit · delete a recording" in `s-figure-1/2.png`, light and dark. Then one last pass over both dances: `$SHOTS/page.sh OUTDIR /salsa/figures/<id> /bachata/figures/<id>` — no old-look pieces left on the page.
- [ ] **Step 11: Commit** `feat(figure): edit mode with one pinned Save, the delete dialog; docs`.

---

## Calls made in this plan

- **Archive stays a bottom sheet**, as the board draws it ("Archive asks in a sheet") and as today, not a centred `Dialog`: the last-variation case needs the two-line warning banner, and one action should not have two looks. The recording delete — a real `confirm()` today — is the `Dialog`. Cost if wrong: swap `Sheet` for `Dialog` in one block; `archiveCopy` already has the title, button and a one-line body.
- **"n days overdue" on the Practice row**, as the board draws it, rather than Today's "4 days ago": the frequency is the row's title here, so the line says how far past it you are. Counted in calendar days (`lastDoneDaysAgo − everyDays`), with "Due today" when the elapsed-time urgency says due but less than a whole calendar day is over. Not-yet-due reads "Done n days ago", a parked exercise "Inactive · not on Today's list". Cost: one function.
- **"In routines" meta is "Slot 3 of 6" / "Slots 2 and 5 of 8", plus " · loops" in done colour** when the routine loops. The board's two rows use two shapes ("Slots 2 and 5 · loops", "Slot 3 of 6"); one rule covering both is simpler to read. A version inside an embedded routine counts at the embedding slot's number, and the embedded routine is listed too (it calls the version itself).
- **The Practice data comes from the urgency plan of the one exercise** (`plan([exercise], last 50 sets, now, tz)`), computed in the load like Today — nothing stored.
- **The edit form's refusals stay a "Not saved" banner** with the server's message (the board's), not field errors; the one field check is the Counts length, live on the client, which never blocks Save — so the board's "timing refused" state (field error and banner together) is exactly what a refused save of 70 shows.
- **Danced stays chips, not the board's segmented control**: `FigureFields` is shared with New figure and the lesson page, and plan 4 settled its look as chips. Cost: one fieldset if the segmented look is wanted later.
- **Ends at and Add a start position stay native `<select>`s drawn as the kit's select field**, not the shared picker: the list is short, a phone's native select is already a sheet, and their behaviour (the add-and-snap-back, archived positions kept) is untouched. Cost if wrong: a `PickerField` with a positions row builder.
- **Edit mode shows the form, then the recordings (with delete) and the linked sections (with Unlink)**, and nothing else, as the board's three edit screens do. Links are added and removed in reading mode (the board draws the add form there). Entering edit scrolls to the top.
- **Recording sections get Unlink only while editing and only when a section has exactly one link**; a section with several links keeps its link button, and the Link popup undoes those. The board draws one link per section.
- **Recording captions are "Wednesday, 28 October" over the size** (`longDayLabel`, plus the year for another year), not plan 3's "Recording · 26 Oct": every video on this page is a recording, and the board names the day. The control row under the picture is plan 3's (Mirror toggle, speed switch), not the board's three bare icons.
- **`VideoFrame` gains an `action` snippet** (the edit-mode trash in the caption row) — additive; nothing else uses it yet.
- **Linked sections are separate `SectionCard`s 8 px apart**, not one grouped card as the board draws: `SectionCard` is plan 3's shared card, used the same way on the exercise page.
- **"Link a section" is a tertiary button on the label row**, as the figure board draws it; the spec's full-width search-icon opener belongs to the Link popup and Picker plan, which may swap it.
- **New variation stacks over the variations list** (Back returns to the list), as the board's Back arrow says; today the list closed first.
- **The new figure's name refusal and the taken variation name land under their fields in Move to…**, other refusals in a banner — the creating-sheets rule from plan 4 applied to this sheet. The `move` messages are unchanged.
- **Shared components restyled here:** `UploadButton` (the progress card, the error banner — the figure page is its last user once Music lands), `AppUploadLink` (the lesson page's "+ Add videos" label keeps its "+" until the Lessons plan), `VideoSections` (the lesson page gets the new rows too; the Lessons plan should reuse them), `LinksEditor`'s Save video states (plan 3 left them; the lesson page gets them too), `RemoveWarning` (now a `Banner`). `Screen`'s slim band now shows a compact screen's subtitle — every compact pushed screen gains it, as the board's collapsed bar draws.
- **A figure-shaped loading skeleton** (`{ kind: 'figure' }` in `pending.ts`) replaces the generic detail one for this route; stepping ‹ › to another variation shows it too, as any new path does. Plan 4 also edits `pending.ts` and `PageSkeleton`; the changes are additive.
- **`src/lib/figures/page.ts` is a new pure module** for this page's lines; `routinesUsing` lives with the coverage maths it extends; `sectionMeta` with `spotLabel` in `src/lib/video/spots.ts`; `uploadProblem` in `src/lib/media.ts`.
- **The `move-to` icon joins the icon set** (the board defines it locally from the old page's Move row).
