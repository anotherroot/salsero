# Redesign: Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw Today — band, hero card in every state, the four bands in the
new order, rows with type tiles, the past-day view, the New exercise sheet and
Today's loading skeleton — on the foundation's components, losing nothing the
page does now.

**Architecture:** Everything that decides *what* Today shows (band order and
labels, each row's meta line and tile tone, which hero state, the past day's
groups) moves into one pure module, `src/lib/exercises/today.ts`, with a spec;
the type tile's icon and accessible name come from `src/lib/exercises/tile.ts`.
The page and its components only render those answers with `Screen`,
`HeroCard`, `GROUP`/`ROW`, `Badge`, `EmptyState`, `Sheet` and `Icon`. The
session logic in `+page.svelte` (URL flag, `skipped`, `tally`, `bumpKey`) is
kept as it is; only the hero that drives it changes.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4 tokens from the
foundation, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` ("Today",
"Patterns used across screens"); board source
`docs/superpowers/design-kit/screens/today.py`; previews `s-today-0.png`,
`s-today-1.png`, `s-today-2.png` in
`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/previews/`.

**This is plan 2 of 13.** All plans land on branch `app-icons`, deployed once
when the last is done. Out of this plan (plan 3, "Logging and the exercise
page"): the log popup (`LogShell.svelte` and the per-type popups), its session
footer (Skip / Logged / Next / Session done / Finish — "Session done" lives in
`LogShell`, so it stays as it is here), and the exercise page. Settings the
page is restyled by plan 11; this plan only links to it from the band.

## Global Constraints

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

Today's own:

- Order on Today: hero → Due → Not yet due → Done today → Inactive (fold) → "+ Custom exercise". No time estimate anywhere.
- Section labels read "`<Band> · <count>`": "Due · 3", "Not yet due · 4", "Done today · 2", "Inactive · 3", past day "Logged that day · 3".
- A row is a split row: the text part is an `<a>` to `/[dance]/exercises/[id]`, the "+" a sibling `<button>` (`aria-label="Log a set of <name>"`) — never nested.
- Small accent text uses `text-accent-text`, never bare `text-accent` (salsa light accent is 4.18:1 on the ground). Bare `text-accent` is allowed only on icons ("+", rating dots).
- Dates on screen come from `src/lib/format.ts` (built by hand), never `toLocale*`.
- Keep every behaviour of today's page: session flag `?session=1`, Skip/Next/Finish via `SessionControls`, `?day=` past days (future day and `day=today` still redirect), backfill on a past day, the forgotten-set picker, `createExercise` and its server message, the Inactive fold closed by default.

**Screenshots.** `SHOTS=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/tools`. Plain pages: `$SHOTS/page.sh OUTDIR /salsa /bachata …` (`FULL=1` for full page). States that need a tap: copy `$SHOTS/sheet.py` to `$SHOTS/today-states.py`, change the clicks, and run it with page.sh's wrapper:
`env -u LD_LIBRARY_PATH PLAYWRIGHT_BROWSERS_PATH=/nix/store/wzfqrpwxk230xqjl1z27h7lis19gjs4f-playwright-browsers timeout 240 nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (p: [p.playwright])' -c python3 -I $SHOTS/today-states.py OUTDIR $SHOTS/state.json`.
The dev server on http://localhost:20000 already serves this worktree; do not start another. If the dev database lacks a state (no inactive exercise, no past day with sets), make it through the app's own UI (Custom exercise, Active off on the exercise page, log a set on a past day) — never by touching `$DATA_DIR` from a spec.

## Review Focus

1. **A session with nothing left to walk** (every remaining row skipped, or the last one logged, popup closed): the hero must not say "Resume session · Next: …" with no next — it falls back to Start session or All done. Pinned by `heroFor` tests in Task 1.
2. **Only inactive exercises** (everything parked): not the first-run empty state and not a live Start button — a disabled hero that says why. Pinned by `heroFor` tests in Task 1; screenshot in Task 3.
3. **Up next on a Not-yet-due row** (the session walks upcoming once due is done): that row gets the tint, the badge and an accent tile, not a grey one. Pinned by `tileTone` tests in Task 1; screenshot in Task 3.
4. **Counts of one:** "1 set today", "1 exercise · 1 set", "Inactive · 1" — never "1 sets". Pinned by `rowMeta` / `heroFor` / `todayBands` tests in Task 1.
5. **Long Spanish names with the Up next badge** ("Dile que no con vuelta · Doble con mano" + Up next): the name wraps, the "+" stays at 44 px on the right. Screenshot check in Task 3 (rename a custom exercise to that, start a session).

---

### Task 1: The pure Today model

**Files:**
- Create: `src/lib/exercises/today.ts`, `src/lib/exercises/tile.ts`
- Modify: `src/lib/format.ts` (add `longDayLabel`)
- Test: `src/lib/exercises/today.spec.ts`, `src/lib/exercises/tile.spec.ts`, `src/lib/format.spec.ts`

**Interfaces:**
- Produces (`tile.ts`):
  - `exerciseTile(e: { source: Source; partner: Partner | null }): { icon: IconName; label: string }` —
    figure + `partner`/`null` → `people`, "Figure, partner"; figure + `solo` → `solo`, "Figure, solo";
    `routine` → `route`, "Routine"; `lesson` → `lessons`, "Lesson review"; `custom` → `metronome`, "Drill".
- Produces (`today.ts`):
  - `type BandKey = 'due' | 'upcoming' | 'doneToday' | 'inactive'`
  - `todayBands<R>(plan: { due: R[]; upcoming: R[]; doneToday: R[]; inactive: R[] }): { key: BandKey; label: string; rows: R[] }[]`
    — in the order due, upcoming, doneToday, inactive; empty bands dropped; labels "Due", "Not yet due", "Done today", "Inactive" plus " · n".
  - `type MetaPart = { text: string; tone: 'status' | 'done' | null }`
  - `rowMeta(row: PlanRow<ExerciseItem>, band: BandKey, lessonDay: string | null): MetaPart[]` (rules in Step 3).
  - `type TileTone = 'accent' | 'quiet' | 'done'`; `tileTone(band: BandKey, upNext: boolean): TileTone`.
  - `type Hero = { kind: 'start' | 'resume' | 'idle' | 'done'; title: string; meta: string } | null`
  - `heroFor(plan: Plan<ExerciseItem>, session: { on: boolean; next: string | null; logged: number }): Hero`
  - `pastGroups(daySets: DaySet[]): { exerciseId: number; name: string; sets: DaySet[] }[]`
- Produces (`format.ts`): `longDayLabel(day: string): string` — `2026-10-31` → `Saturday, 31 October`.

- [ ] **Step 1: Write the failing tests.** Build plan rows with a small local `row(id, name, overrides)` helper.

```ts
// tile.spec.ts
expect(exerciseTile({ source: 'figure', partner: 'partner' })).toEqual({ icon: 'people', label: 'Figure, partner' });
expect(exerciseTile({ source: 'figure', partner: null })).toEqual({ icon: 'people', label: 'Figure, partner' });
expect(exerciseTile({ source: 'figure', partner: 'solo' })).toEqual({ icon: 'solo', label: 'Figure, solo' });
expect(exerciseTile({ source: 'routine', partner: null }).icon).toBe('route');
expect(exerciseTile({ source: 'lesson', partner: null })).toEqual({ icon: 'lessons', label: 'Lesson review' });
expect(exerciseTile({ source: 'custom', partner: null })).toEqual({ icon: 'metronome', label: 'Drill' });
// every icon it returns exists in ICONS

// format.spec.ts
expect(longDayLabel('2026-10-31')).toBe('Saturday, 31 October');
expect(longDayLabel('2027-01-03')).toBe('Sunday, 3 January');

// today.spec.ts — bands
it('orders Due, Not yet due, Done today, Inactive and drops empty bands', () => {
  const b = todayBands({ doneToday: [d1, d2], due: [a], upcoming: [], inactive: [i1] });
  expect(b.map((x) => x.key)).toEqual(['due', 'doneToday', 'inactive']);
  expect(b.map((x) => x.label)).toEqual(['Due · 1', 'Done today · 2', 'Inactive · 1']);
});
// rowMeta
expect(rowMeta(dueNever, 'due', null)).toEqual([{ text: 'Never done', tone: 'status' }, { text: 'Every 3 days', tone: null }]);
expect(rowMeta(up1day, 'upcoming', null)).toEqual([{ text: 'Yesterday', tone: null }, { text: 'Weekly', tone: null }]);
expect(rowMeta(doneOne, 'doneToday', null)).toEqual([{ text: '1 set today', tone: 'done' }, { text: 'Daily', tone: null }]);
expect(rowMeta(doneTwo, 'doneToday', null)[0].text).toBe('2 sets today');
expect(rowMeta(lessonUp, 'upcoming', 'Wed 28 Oct')).toEqual([{ text: 'Wed 28 Oct class', tone: null }, { text: 'Yesterday', tone: null }]);
expect(rowMeta(lessonDone, 'doneToday', 'Tue 27 Oct')).toEqual([{ text: '1 set today', tone: 'done' }, { text: 'Tue 27 Oct class', tone: null }]);
expect(rowMeta(inactive12, 'inactive', null)[0]).toEqual({ text: '12 days ago', tone: null });
// tileTone
expect(tileTone('due', false)).toBe('accent');
expect(tileTone('upcoming', false)).toBe('quiet');
expect(tileTone('inactive', false)).toBe('quiet');
expect(tileTone('doneToday', false)).toBe('done');
expect(tileTone('upcoming', true)).toBe('accent'); // Review Focus 3
// heroFor
const off = { on: false, next: null, logged: 0 };
expect(heroFor(p({ due: 3, upcoming: 4 }), off)).toEqual({ kind: 'start', title: 'Start session', meta: '3 due · 4 not yet due' });
expect(heroFor(p({ upcoming: 4 }), off)?.meta).toBe('4 not yet due');
expect(heroFor(p({ due: 2 }), { on: true, next: 'Enchufla · Doble', logged: 2 }))
  .toEqual({ kind: 'resume', title: 'Resume session', meta: 'Next: Enchufla · Doble · 2 logged' });
expect(heroFor(p({ due: 2 }), { on: true, next: 'Enchufla · Doble', logged: 0 })?.meta).toBe('Next: Enchufla · Doble');
expect(heroFor(p({ upcoming: 1 }), { on: true, next: null, logged: 3 })?.kind).toBe('start');   // Review Focus 1
expect(heroFor(p({ done: [2, 1, 2, 1, 1] }), { on: true, next: null, logged: 5 }))
  .toEqual({ kind: 'done', title: 'All done for today', meta: '5 exercises · 7 sets' });
expect(heroFor(p({ done: [1] }), off)?.meta).toBe('1 exercise · 1 set');                       // Review Focus 4
expect(heroFor(p({ inactive: 3 }), off)).toEqual({ kind: 'idle', title: 'Start session', meta: 'No active exercises · 3 inactive' }); // Review Focus 2
expect(heroFor(p({}), off)).toBeNull();
// pastGroups: daySets arrive newest first (listSetsBetween orders by doneAt desc)
const g = pastGroups([set(3, ex1, '20:10'), set(2, ex2, '18:05'), set(1, ex1, '19:42')]);
expect(g.map((x) => x.exerciseId)).toEqual([ex2, ex1]);          // first done first
expect(g[1].sets.map((s) => s.id)).toEqual([1, 3]);              // oldest set first within a group
```

  (`p({ due, upcoming, inactive, done })` builds a plan with that many rows per band; `done` lists each row's `setsToday`.)

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/exercises src/lib/format.spec.ts` — Expected: FAIL (modules / exports missing).
- [ ] **Step 3: Implement.**
  - `rowMeta`: `doneToday` → `[n set(s) today (done), lessonDay ? "<lessonDay> class" : frequencyLabel(everyDays)]`;
    otherwise a lesson with a `lessonDay` → `["<lessonDay> class", lastDoneLabel(lastDoneDaysAgo)]`, any other row →
    `[lastDoneLabel(lastDoneDaysAgo), frequencyLabel(everyDays)]`; the `lastDoneLabel` part has tone `status` only
    in band `due` (overdue by construction there). Reuse `lastDoneLabel`, `frequencyLabel`.
  - `heroFor`: `null` when all four bands are empty; `resume` when `session.on && session.next !== null`
    (tally appended as " · n logged" only when `logged > 0`); else `start` when due + upcoming > 0 (parts
    "n due", "n not yet due", each only when > 0, joined " · "); else `done` when doneToday is non-empty
    (exercise count, then the sum of `setsToday`); else `idle`.
  - `pastGroups`: move the page's `pastGroups` derivation here unchanged (reverse, then group in first-seen order).
  - `longDayLabel`: full weekday and month names, built by hand like `dayLabel` (UTC noon).
  - Header comment of `today.ts`: PURE, client-safe; "what Today shows", and why Done today now sits after Not yet due ("what the session walks comes first").
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(today): the pure Today model — bands, meta lines, hero states, past-day groups`.

### Task 2: Shared pieces — hero states, type tile, select field

**Files:**
- Modify: `src/lib/components/ui/HeroCard.svelte`, `src/lib/components/ui/styles.ts`, `src/lib/components/ui/styles.spec.ts`, `src/routes/dev/kit/+page.svelte`
- Create: `src/lib/components/ui/TypeTile.svelte`

**Interfaces:**
- Consumes: `exerciseTile`, `TileTone` (Task 1).
- Produces:
  - `HeroCard` gains `state?: 'default' | 'disabled' | 'done'` (default `'default'`). Disc 54 px (was 52), meta 14/600 (was 13) — the foundation's carried item. `disabled`: a `<button disabled>`, title `text-muted`, disc `bg-disabled-bg text-disabled-ink`. `done`: a `<div role="status">` (not a button, ignores `href`/`onclick`), disc `bg-done-soft text-done` holding the `check` icon at 28 px.
  - `<TypeTile exercise: { source: Source; partner: Partner | null } tone: TileTone />` — a 40 × 40 `span role="img"`, radius 12, glyph 22 px. `accent`: `bg-accent-soft text-accent-text`; `quiet`: `bg-chip text-muted`; `done`: `bg-done-soft`, filled `check-circle` 24 px in `text-done` with `--icon-knockout: var(--color-on-done)`. `aria-label`: the tile's label; done: "`<label>`, done today". `exercise` may be `null`/`undefined` with `tone="done"` only (a past day's archived exercise): label "Done".
  - `SELECT` in `styles.ts`: `FIELD` plus `flex cursor-pointer items-center gap-2.5 pr-3 text-left` — a field-shaped button that opens a sheet (the caller adds a `chevron-down` 20 px `text-muted` and a muted placeholder span).

- [ ] **Step 1: Write the failing test** in `styles.spec.ts`: `SELECT` contains every class of `FIELD`, and contains `text-left` and `cursor-pointer`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: FAIL.
- [ ] **Step 3: Implement** `SELECT`, `TypeTile`, the `HeroCard` states. Gallery: replace the "Nothing due" hero with the three states as Today uses them ("Start session" / "3 due · 4 not yet due"; disabled "Start session" / "No active exercises · 3 inactive"; done "All done for today" / "5 exercises · 7 sets"), add a row of the five type tiles in each tone, and one `SELECT` with a placeholder.
- [ ] **Step 4: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: PASS.
- [ ] **Step 5: Look:** `$SHOTS/page.sh OUTDIR /dev/kit` with `FULL=1`; compare the hero states with `done_hero` / `hero_card(state='disabled')` on the board and the tiles with `s-today-0.png`.
- [ ] **Step 6: Commit** `feat(ui): hero card disabled and done states, the exercise type tile, select fields`.

### Task 3: Today — band, hero, the four bands, rows, first run

**Files:**
- Modify: `src/routes/[dance]/+page.svelte` (the `isToday` branch, the band, the hero; session logic untouched)
- Modify: `src/lib/components/today/ExerciseRow.svelte`
- Modify: `src/lib/urgency/urgency.ts` (the `Plan` comment only: Today now reads Due first)

**Interfaces:**
- Consumes: `todayBands`, `rowMeta`, `tileTone`, `heroFor`, `longDayLabel` (Task 1); `HeroCard` states, `TypeTile` (Task 2); `Screen`, `BandButton`, `Badge`, `EmptyState`, `Icon`, `button`, `GROUP`, `SECTION_LABEL`.
- Produces: `ExerciseRow` props `{ row: PlanRow<ExerciseItem>; band: BandKey; dance: DanceSlug; lastRating: number | null; lessonDay: string | null; upNext: boolean; onlog: () => void }`, rendered as an `<li>` inside `<ul class={GROUP}>`.

- [ ] **Step 1: The band.** Wrap the page in `<Screen>`: on today `title="Today"`, `subtitle={longDayLabel(data.today)}`, `right` = `BandButton icon="chevron-left" label="Previous day" href={resolve(`/${slug}?day=${data.prevDay}`)}` then `BandButton icon="settings" label="Settings" href={resolve('/settings')}`. Delete the old sticky header. (`Screen` owns the slim band on scroll.)
- [ ] **Step 2: The hero.** `const hero = $derived(heroFor(data.plan, { on: sessionOn, next: firstUp?.exercise.name ?? null, logged: tally.count }))`. Render it in Screen's `hero` slot when non-null: `start` → `onclick={startSession}`; `resume` → `onclick={() => (openId = firstUp?.exercise.id ?? null)}`; `idle` → `state="disabled"`; `done` → `state="done"`. `upNextId = hero?.kind === 'resume' ? firstUp!.exercise.id : null`.
- [ ] **Step 3: The bands.** `{#each todayBands(data.plan) as b (b.key)}`: for `due`, `upcoming`, `doneToday` a `<section aria-labelledby>` with `<h2 class={SECTION_LABEL}>{b.label}</h2>` (14 px above every label but the first) and `<ul class={GROUP}>` of `ExerciseRow`s; for `inactive` the fold — a full-width `<button aria-expanded aria-controls>` (min-h 44, `pl-4 pr-2`, label 13/700 `text-muted`, `chevron-down` / `chevron-up` 20 px muted), the group shown only while open (closed by default, as now). After the bands, `<button class={button('secondary', 'md', true)}>` with a `plus` icon and "Custom exercise" (sets `creating = true`), 6 px above.
- [ ] **Step 4: The row** (`ExerciseRow.svelte`), to `ex_row` on the board: `<li>` `flex min-h-[66px] items-center pl-4 pr-1.5`, `bg-accent-soft` when `upNext`. The `<a>` (`flex flex-1 min-w-0 items-center gap-3 py-2.5 pr-1`) holds `<TypeTile tone={tileTone(band, upNext)}>`, the name (16/700, `text-ink`; `text-muted` in `inactive`; wraps, never truncated to nothing) with a solid accent `<Badge>` "Up next" after it when `upNext`, and the meta line (13/400 `text-muted`): `rowMeta` parts joined by " · ", a `status` part in `text-status font-bold`, a `done` part in `text-done font-bold`, then the rating dots when `lastRating !== null` — five 6 px circles, 3 px apart, `bg-accent` up to the rating and `bg-field-line` after, `role="img" aria-label="Last rated n of 5"`. The "+" is `iconButton('bare')` with `text-accent` (`text-done` in `doneToday`), `aria-label="Log a set of <name>"`, calling `onlog`. Drop the old "Figure · partner" text badge and the opacity dimming.
- [ ] **Step 5: First run.** When `todayBands(data.plan)` is empty (no hero either): `<EmptyState icon="calendar" title="Nothing to practise yet" body="Build a routine from your figures, or add a custom exercise.">` with an action of two full-width buttons in a 260 px column, 8 px apart: a link `button('primary', 'md', true)` with icon `route` "Build a routine" → `resolve('/[dance]/routines', …)`, and `button('secondary', 'md', true)` with `plus` "Custom exercise" → `creating = true`. 40 px above it.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** `FULL=1 $SHOTS/page.sh OUTDIR /salsa /bachata`, then a `today-states.py` that: opens `/salsa?session=1`, presses Escape (closes the popup, keeps the flag) and screenshots (Resume hero, Up next row); taps a "Log a set of …" "+" on a due row to check the popup still opens. Compare with `s-today-0.png` (Today, further down, session running) and `s-today-1.png` (All done, First run) in light and dark. Check Review Focus 2, 3 and 5 by setting up those states through the UI.
- [ ] **Step 8: Commit** `feat(today): Today in the new look — hero states, Due first, type tiles, split rows`.

### Task 4: A past day

**Files:**
- Create: `src/lib/components/today/PastDay.svelte`
- Modify: `src/routes/[dance]/+page.svelte` (the `!isToday` branch and the band for it)

**Interfaces:**
- Consumes: `pastGroups` (Task 1), `TypeTile`, `SELECT` (Task 2), `Screen`, `BandButton`, `Picker`, `exerciseGroups`, `setSummary`, `timeOfDay`, `dayLabel`, `lastDoneLabel`, `daysBetween`.
- Produces: `<PastDay day: string daySets: DaySet[] exercises: PickExercise[] kinds: Record<number, { source: Source; partner: Partner | null }> timezone: string onlog: (exerciseId: number) => void />` — owns the forgotten-set `Picker` and its `picking` state (moved from the page). `kinds` is built by the page from every plan row's exercise (`PickExercise` has no `partner`); an archived exercise is missing from it.

- [ ] **Step 1: The band** for a past day: `title={dayLabel(data.day)}` (46 px, as the board draws it), `subtitle={lastDoneLabel(daysBetween(data.day, data.today))}` ("Yesterday", "2 days ago"), `right` = `BandButton chevron-left "Previous day"` → `?day=prevDay` and `BandButton chevron-right "Next day"` → `/[dance]` when `nextDay === today`, else `?day=nextDay`. `extra` = the "Back to today" pill: an `<a>` to `/[dance]` with a 44 px hit area holding a 32 px pill (`bg-black/15`, pl 10 pr 14, gap 6, `calendar` 18 px, text 14/800 `text-band-small`).
- [ ] **Step 2: `PastDay.svelte`**, to `past_day` / `past_empty` on the board. With groups: `<h2 class={SECTION_LABEL}>Logged that day · {groups.length}</h2>`, then one `GROUP` card per exercise (8 px apart): a header row (min-h 60, `pl-4 pr-1.5`, hairline under it) with `<TypeTile tone="done" exercise={kinds[exerciseId]}>` (when `kinds` has no entry — an archived exercise — the same done tile labelled "Done"), the name 16/700, and a bare accent "+" `aria-label="Add a set of <name> to this day"` → `onlog(exerciseId)`; then one line per set indented 68 px: time 14/700 `text-muted` tabular in a 40 px column, `setSummary(s) || 'Set'` 14 `text-ink`, the note under it 13 `text-muted` in “curly quotes”. Without groups: a 56 px `bg-chip` circle with `calendar` 26 px muted and "Nothing logged on this day" (16/700) centred, padding 28 px top. Both end with the field, 14 px above: `<label for>` "Forgot to log something that day?" (`LABEL`) and a `<button class={SELECT} aria-haspopup="dialog">` showing a muted "Pick an exercise…" and `chevron-down`, opening the existing `Picker` (title `Log a set on {dayLabel(day)}`, placeholder "Search exercises", `kind="act"`, unchanged — its look is plan 7's).
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look.** `$SHOTS/page.sh OUTDIR "/salsa?day=<a day with sets>" "/salsa?day=<a day without>" "/bachata?day=<…>"`, and in `today-states.py` tap the "+" of a group (popup opens with "Adding to …"), then the forgot field (picker opens). Compare with `s-today-1.png` (Past day, nothing logged, pick an exercise).
- [ ] **Step 5: Commit** `feat(today): past days in the new look`.

### Task 5: The New exercise sheet

**Files:**
- Modify: `src/lib/components/today/NewExerciseSheet.svelte`
- Create: `src/lib/components/exercises/FrequencyField.svelte`

**Interfaces:**
- Consumes: `Sheet` (`back`, `footer`), `FIELD`, `TEXTAREA`, `LABEL`, `FIELD_ERROR`, `SELECT`, `button`, `Spinner`, `Icon`, `FREQUENCIES`, `DEFAULT_EVERY_DAYS`, `frequencyLabel`.
- Produces: `<FrequencyField name: string value: number (bindable) label?: string = 'How often' />` — a `SELECT` button showing `frequencyLabel(value)`, a hidden `<input name value>`, and a stacked `Sheet` (`title="How often"`, `back`) holding a `role="listbox" aria-label="How often"` `GROUP` of the five `FREQUENCIES` as `role="option"` buttons (min-h 56, 16 px; chosen: `aria-selected="true"`, 800 `text-accent-text`, `check` 22 px `text-accent`). Tapping an option sets `value` and closes the level; Back closes it unchanged. Plan 3 reuses it on the exercise page.

- [ ] **Step 1: Implement `FrequencyField`.** The stacked `Sheet` renders inside the New exercise sheet's dialog (a second modal `<dialog>`; the sheet stack gives it its own history entry, so Back closes only it).
- [ ] **Step 2: Restyle `NewExerciseSheet`** to `new_sheet` on the board. Form `id="new-exercise"`, `use:guarded` with the same `submit` callback and label "New exercise". Fields 14 px apart: Name (`FIELD`, placeholder "e.g. Son basic, clave clapping", `maxlength="200"`, `required`); when `message` is set: `aria-invalid="true"`, `aria-describedby` → a `FIELD_ERROR` line with a `warning` 16 px icon and the server's message (the old red box goes); `FrequencyField name="everyDays"` (state starts at `DEFAULT_EVERY_DAYS`, kept across a failed submit because the sheet stays mounted); Notes (`TEXTAREA`, rows 3, `maxlength="2000"`, label "Notes" plus " (optional)" in 400 `text-muted`). Typed values handed back by a failed action stay as now (`values`). `footer` snippet: `<button type="submit" form="new-exercise" class={button('primary', 'md', true)} aria-busy={busy} disabled={busy}>` — while busy a `<Spinner>` beside the label, width kept — then the hint "To practise a figure on its own, open it and tap Practise on its own." (13 px `text-muted`, 4 px margins).
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look** with `today-states.py`: open Custom exercise (empty); type a name (focus ring); open How often (stacked level, check on the chosen, Back returns with the form intact); pick Weekly; press Escape with a typed name (Unsaved changes dialog: Save / Stay / Close without saving); remove `required` from Name via `evaluate`, type notes, submit with an empty name (the server's message under Name, notes kept); submit a valid one (sheet closes, the row appears under Due). Compare with `s-today-2.png`.
- [ ] **Step 5: Commit** `feat(today): the New exercise sheet with a stacked How often level`.

### Task 6: Today's loading skeleton, docs, last check

**Files:**
- Modify: `src/lib/components/shell/PageSkeleton.svelte` (the `today` branch only)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the Today band order), `CLAUDE.md` (Layout: `src/lib/exercises/` line)

- [ ] **Step 1: The skeleton**, to `loading` on the board, when `skeleton.kind === 'today'`: the band with the real title "Today" (46 px), on the right a dimmed `chevron-left` (cream at 45 %) and `settings` (both inside the `aria-hidden` header, not buttons), a 150 × 14 bone in cream at 28 % for the date, bottom padding 92; a hero bone card straddling the sheet edge (−42 px, min-h 84, radius 22, `bg-surface`, shadow as `HeroCard`) with two bones (58 % × 18, 38 % × 11) and a 54 px `bg-skeleton` circle; then a 64 × 10 label bone, `rows(3, true)`, a 96 × 10 label bone, `rows(2, true)`. Leading bones 40 px, radius 12 (the tile's). The sheet is `bg-ground` with 28 px top corners overlapping the band, as `Screen` draws it. The `list` and `detail` branches are untouched.
- [ ] **Step 2: Docs.** Main spec, Today section: the order becomes Due → Not yet due → Done today → Inactive, with one line why (what the session walks comes first; the redesign spec has the look). `CLAUDE.md` Layout, `src/lib/exercises/` entry: add "what Today shows (today.ts: bands, meta lines, hero states, past-day groups) and the type tile's icon and name (tile.ts)".
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look:** in `today-states.py`, throttle the network (`page.route('**/__data.json*', lambda r: (time.sleep(2), r.continue_()))`), start on `/salsa/songs` and tap the Today tab, screenshot after 300 ms; compare with `loading` in `s-today-1.png`, light and dark.
- [ ] **Step 5: Commit** `feat(today): Today's loading skeleton; docs`.

---

## Calls made in this plan

- **Start session stays while only Not-yet-due rows are left.** The spec says the hero becomes "All done" "when nothing is due"; the board's caption says when Due *and* Not yet due are empty. The session walks upcoming rows too, so Start session stays (meta "4 not yet due") until both are empty. If wrong: one condition in `heroFor`.
- **The disabled hero** (the foundation's carried item) is used when every exercise is inactive: "Start session" / "No active exercises · 3 inactive". The board has no such screen. If wrong: copy in one test and one function.
- **Resume's tally** is "· n logged" only when n > 0, counted from the page's `tally` (it resets on reload, as now). Nothing new is stored.
- **A session with no next row** falls back to Start session / All done rather than a Resume with nothing to resume; tapping Start then restarts the session (resets `skipped`), as `startSession` already does.
- **Lesson rows** show their class day in place of the frequency ("Wed 28 Oct class · Yesterday"), as the board does; a lesson's frequency stays on its exercise page. If wrong: one branch in `rowMeta`.
- **The done tile's accessible name** is "<type>, done today" (the board has only "Done today"), so the type the spec asks every tile to name is not lost on done rows.
- **The past day's title is 46 px** as the board draws it; the spec's "compact title" is read as the short date ("Thu 29 Oct"), which never needs the 30 px size.
- **The past day's exercise name is plain text**, as on the board; its "+" is what opens the backfill popup (today's whole-name button did the same). The exercise page stays reachable from Today's rows.
- **"Back to today" text is `band-small`** (white on light salsa), not cream as the board has it: 14 px cream fails 4.5:1 on the light salsa band. Its track is `bg-black/15`, the Segmented control's value.
- **Hairlines** come from `GROUP` (full width, the foundation's rule and the spec's "full-width hairline separators"), not the board's 16 px inset.
- **How often picks and closes** in one tap (like `PickerField`), Back closes without a change. It is a small `FrequencyField` with its own stacked `Sheet`, not the shared `Picker` (five fixed options need no search); it lives in `components/exercises/` for plan 3's exercise page.
- **`TypeTile` lives in `components/ui/`** with its mapping in `src/lib/exercises/tile.ts`, so the exercise page (plan 3) and anything else listing exercises can use it.
- **A past day's tiles show the done tick, not the type glyph** (as the board draws it); the type is in the tile's accessible name, looked up from the plan's rows because the picker's rows carry no `partner`.
- **`SELECT`** joins `styles.ts` because Today alone has two such fields and the picker plan will have more.
- **No Settings on a past day's band** (the board has ‹ › only); Settings is one tap away via Back to today.
