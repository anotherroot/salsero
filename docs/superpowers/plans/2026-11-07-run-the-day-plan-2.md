# Run the day, plan 2: the one page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The exercise page becomes the place you practise: the running time in the band, Practise with on the page, a drill's Recordings, the H1 history, and a pinned ✓ Done that opens "How did it go?" (tap a face = save and go back, toast with Undo). One entry per exercise per day, no "set" anywhere, and the old log popup gone from every page.

**Architecture:** The data function `saveDay` keeps one `sets` row per exercise per local day (a second save updates it and hands back what it held, for Undo). PURE words (`done-view.ts`, `day-entry.ts`, `doneFaces`) decide what the page, the sheet and the history say. One `DoneSheet` component is the save everywhere (the page, a past day); a small client store (`saved.svelte.ts`) plus `SavedToast` in the `[dance]` layout shows "Saved · back in 12 days · Undo" on whatever screen comes next. The type's registry keeps owning the page's content (`contentFor`) and gains `practiceFor` for the Practise with card. `LogShell`, the per-type `Log.svelte`s and `?log=1` are deleted.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-07-run-the-day-design.md` ("No sets", "The exercise page (one page)", "The Done sheet", "Time", "Leaving the old popup", "The practice panel and the full player"). Read `CLAUDE.md` (hard rules, "Words go through `t()`") first. **Plan 1** is built and merged (master `bf85cdc`); what this plan uses of it, as built:
- `DueState` (`src/lib/schedule/schedule.ts`): `gap`, `lastDay`, `dueDay`, `every: 1 | 2 | 3 | 7 | null`, `learning: { good; of: 3 | 5 } | null`. **While learning `gap` is 1** (a fixed rhythm: N), so a face's time is never read off `gap`: it is replayed with the face added (Task 2). `scheduleOf`, `replay`, `preview`/`FacePreview`, `STEPS` (G3) live there too.
- `scheduleStates(db, wall, tz, beforeDay?)` and `scheduleStateOf(db, exerciseId, tz)` (`src/lib/server/schedule.ts`).
- `ComesBack`, `parseComesBack`, `serializeComesBack`, `effectiveComesBack`, `rhythmWords`, `learningWords` (`src/lib/schedule/comes-back.ts`); `ExerciseItem.comesBack` is the effective `ComesBack` (`comesBackOwn`, `comesBackTeacher` beside it), `warmup: boolean`, `warmupOrder: number | null`.
- `DayRow.list: 'warmup' | 'practice'`, `DayList.total`/`warmups` (`src/lib/schedule/today-list.ts`); `listLabels`, `todayHero` (`src/lib/exercises/today.ts`).
- The exercise page's load: `data.scheduleAtStart` (start-of-day `DueState` of the person's row or entry, null without one), `data.today`, `data.sets` (today's rows, from `popupData`), `data.songs`, `data.takes`.
- `PAGE_EPOCH = 8`.

**Mockups:** PNGs in `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-exercise-flow/72d7463b-31e7-40d6-976c-6196df628393/scratchpad/mock/png/` (call it `$M`; the HTML beside them in `../`), explained on the board https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs. This plan uses `page-drill`, `drill-rows`, `drill-add`, `drill-editing`, `hist-a` (H1, the chosen history), `page-lesson`, `page-figure`, `sheet-drill`, `sheet-learning`, `sheet-past-day`, `run-toast` (the toast; ignore its Skip and "4 of 7": plan 3), `desk-sheet` (the desktop pane and the sheet as a dialog; ignore Skip). Where a mock still shows "3 sets" tiles or trash on history rows, `hist-a` wins.

**Not in this plan (plan 3):** the run (Start walks warm-ups, Skip, "Next:", Done · next, Done for today, the hero's time estimate), the player's continuation and its no-faces Save for a fixed rhythm (the player's rating-null rule), and the desktop clock rule (here the clock starts when the page mounts, at every width). **Start session keeps working, degraded, and as small as works** (Task 8): at both widths it walks exercise *pages* (`?session=1`), after a face the next page opens (replace), and after the last it goes back to Today. No "Session · 2 of 5" line, no tally, no Skip until plan 3 (Not today still works).

## Global Constraints

- One entry per exercise per local day. A second save that day updates the day's row: time added, face and note replaced, the run's `player_json` replaced when the new save has one. Old days with several rows show merged: minutes added, the day's last rated face, the notes joined with ` · ` in time order.
- No "set" or "sets" in any UI string (labels, aria-labels, toasts, refusals). Code names (`sets` table, `HistorySet`) stay.
- **Words go through `t()`** (CLAUDE.md hard rule). Every word a task adds or changes goes in the English catalog area it names (`src/lib/i18n/en/<area>.ts`) and, in the same task, in Slovenian (`sl/<area>.ts`: vikanje in sentences, the glossary at the top of `sl/index.ts`, plurals through `slCount`, a name after a colon or a "·"); a key nothing reads any more is removed from both (`i18n.spec.ts` checks they match). A new component that draws words goes into `TRANSLATED` (`src/lib/i18n/no-english.spec.ts`) in the task that makes it; a deleted one leaves the list in the task that deletes it (the spec reads every listed file). PURE word functions read `t()` at call time, never into a top-level constant; dates through `src/lib/format.ts` (`dayLabel` "Thu 5 Nov", `weekdayDayMonth` "Thursday 5 November", `longDayLabel`, `clock`). Specs pin **English by default** (no locale set) with the exact values below; a Slovenian case runs under `withLocale('sl', …)` (`$lib/i18n/current`), as `exercise-page.spec.ts`'s `sl()` does.
- Time is never typed: `duration_s` is the page's counted seconds, counted only while `document.visibilityState === 'visible'`, restarting from 0 when the page (re)mounts or another exercise opens in it. A past day saves `duration_s` null.
- Exact copy (the English catalog's values): sheet title **How did it go?** (`exercise.types.howItWent`); note label **Note (optional)** (`exercise.log.note` + `exercise.log.optional`), placeholder **What went well, what to fix** (`exercise.log.notePlaceholder`); **Tap a face to save it** (muted, centred, under the faces); toast **Saved · back in 12 days** / **Saved · back tomorrow** with **Undo** (`common.undo`); past day toast **Added to Thu 5 Nov**; pinned **✓ Done**, and **Done today** once the exercise has today's entry; history tiles **N times** / **N min in all**; empty history **Nothing logged yet** / **Tap Done after you practise — it shows up here, grouped by day.** (`exercise.page.nothingYet`/`nothingYetBody`); routine **A run there saves itself. Tap Done when you practised away from the app.** (`exercise.content.routineNote`).
- Band subtitle: `Drill · 4:12`, `Drill · learning · 3:20`, `Drill · warm-up · 6:30` (both: `Drill · warm-up · learning · 4:12`; plan 3 adds the place in a run). Sheet's muted line: the time (`4:12`); a learning drill `Learning · 2 of 3 good days` (`learningWords`); a past day `<exercise name> · <weekdayDayMonth(day)>`.
- A face card's time comes from `doneFaces` (Task 2: the sets replayed with that face added now, so a learning drill's learnt face shows the gap the faces earned, not `DueState.gap`); a learning drill's faces say **Tomorrow** except a face that finishes its learning: its gap and, on a second line, **learnt** in `text-done`; when any card has that second line, all four time rows are two lines high.
- A fixed-rhythm drill (`DueState.every !== null`; the page's `fixed`): Done saves at once, no sheet, `rating` null (the `done` action forces null whatever was posted).
- Closing the sheet (×, Back, scrim) saves nothing; a typed note makes it ask "Unsaved changes" (`use:guarded`, the hard rule).
- Data functions take `db` first; specs use `openDb(':memory:')`, never `$DATA_DIR`. Every instant is epoch ms; days via `localDay`/`noonOf`/`daysBetween`.
- A refresh after a sheet closes goes through `refreshWhenSettled()`; close-then-navigate waits for the sheet's Back (`gotoWhenSettled`, and Task 5's `backWhenSettled` in `src/lib/nav/trail.svelte.ts`).
- Raise `PAGE_EPOCH` 8 → 9 in Task 4 (the player's save answers JSON in place of a redirect: an open player page would wait for a redirect that never comes, and a second tap would add the run twice). Tasks 7–9 change the other log forms in the same release.
- `npm run check` must pass at the end of every task, and the app stays usable after each. Shots (`scripts/shots/README.md`) are compared with the `$M` images named in each task.

## Review Focus

- Done twice on one day, and Done on a day that already holds several old rows: still one row is written to (the day's latest), time added, face/note replaced; Undo of the second save puts the first save's values back rather than deleting the day. → Task 1.
- A learning drill one good day short: I've got it and Easy show the gap the faces earned with **learnt**, not "Tomorrow" and not `DueState.gap` (1). → Task 2.
- A page left open while the phone is locked or the tab hidden: those minutes don't count. → Task 3 (`followVisibility`).
- A stale page posting a face to `done` for a fixed-rhythm drill: stored with `rating` null; a by-how-it-went exercise posted with no face: refused, nothing stored. → Task 4.
- Undo with a forged or mismatched `before` (another exercise's snapshot, another person's set): refused, nothing changes. → Task 4.
- A group drill's page with no entry of the person's: no Done bar, no Practise with, no crash; a `done` post naming the group's drill id (not the entry) is a 404. → Task 4, Task 7 step 1.

---

### Task 1: One entry a day (data)

**Files:**
- Modify: `src/lib/server/exercises.ts` (`logSet` stays for restore; add `saveDay`, `undoSave`, `deleteDay`, `restoreSets`; change `exerciseSummary`)
- Modify: `src/lib/types.ts` (`ExerciseSummary`)
- Modify: `src/lib/server/log-form.ts` (`logSetFrom` writes through `saveDay`), `src/routes/[dance]/player/+page.server.ts` (`save` writes through `saveDay`)
- Modify: `src/lib/exercises/exercise-page.ts` (`historyTiles` replaces `summaryTiles`; `archiveBody(name, times)`), its spec; `src/routes/[dance]/(today)/exercises/[id]/+page.server.ts` and `+page.svelte` (the summary's new shape: two tiles)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.page`: `times(n)` "time"/"times" replaces `tileSets`, `inAll` "in all" replaces `tilePractised`, `tileRecently` goes; `archiveBody(name, times)`)
- Test: `src/lib/server/exercises.spec.ts`, `src/lib/server/data.spec.ts` (the two `exerciseSummary` cases, ~line 471), `src/lib/server/log-form.spec.ts`, `src/lib/exercises/exercise-page.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  /** The day's row for input.exerciseId on localDay(input.doneAt, tz): inserted, or the latest one updated. */
  export function saveDay(db: Db, input: SetInput, tz: string): { set: SetRow; before: SetSnapshot | null };
  /** Undo of saveDay: before null → the row is deleted; else the row takes before's fields back. False when the row is gone or before.exerciseId differs. */
  export function undoSave(db: Db, setId: number, before: SetSnapshot | null): boolean;
  /** Every row of that exercise on that local day, deleted; their snapshots, oldest first. */
  export function deleteDay(db: Db, exerciseId: number, day: string, tz: string): SetSnapshot[];
  /** Re-inserts snapshots in one transaction (Undo of deleteDay). */
  export function restoreSets(db: Db, snaps: SetSnapshot[]): void;
  export function exerciseSummary(db: Db, id: number, tz: string): ExerciseSummary;
  // types.ts
  export interface ExerciseSummary { times: number; totalS: number } // times: distinct local days; recentRating goes
  // exercise-page.ts
  export function historyTiles(s: ExerciseSummary): { value: string; label: string }[];
  export function archiveBody(name: string, times: number): string;
  ```
  (`SetRow` is `typeof sets.$inferSelect`: there is no alias. `SetInput` and `SetSnapshot` exist: `exercises.ts`, `types.ts`.)
- Update rule (`saveDay` on an existing day row): `durationS` = old + new (null only when both are null); `rating` = new; `note` = new (`''` → null); `playerJson` = new ?? old; `reps` and `doneAt` kept. Other rows of that day are left alone.
- `archiveBody`: `"<name> leaves Today and every list. Its history is kept."` when `times > 0`, the first sentence alone at 0.

- [ ] **Step 1: Write the failing tests** (`TZ = 'Europe/Ljubljana'`, `openDb(':memory:')`, a drill from `createCustomExercise(db, U1_SALSA, { name, notes: null })`; define `at(day, h)` as `schedule.spec.ts` does and `input(o)` = `{ exerciseId: ex, doneAt, durationS: null, reps: null, rating: null, note: null, playerJson: null, ...o }`):
  ```ts
  it('a first save of the day inserts', () => {
  	const r = saveDay(db, input({ doneAt: at('2026-11-07', 10), durationS: 240, rating: 4, note: 'a' }), TZ);
  	expect(r.before).toBeNull();
  	expect(exerciseHistory(db, ex)).toHaveLength(1);
  });
  it('a second save that day adds the time and replaces face and note', () => {
  	saveDay(db, input({ doneAt: at('2026-11-07', 10), durationS: 240, rating: 2, note: 'a', playerJson: '{"x":1}' }), TZ);
  	const r = saveDay(db, input({ doneAt: at('2026-11-07', 20), durationS: 60, rating: 4, note: '', playerJson: null }), TZ);
  	expect(exerciseHistory(db, ex)).toHaveLength(1);
  	expect(r.set).toMatchObject({ durationS: 300, rating: 4, note: null, playerJson: '{"x":1}', doneAt: at('2026-11-07', 10) });
  	expect(r.before).toMatchObject({ durationS: 240, rating: 2, note: 'a' });
  });
  it('null time on both saves stays null', () => { /* durationS null + null → null */ });
  it('a day with two old rows: the latest is updated, the other kept', () => { /* logSet twice, saveDay → 2 rows, latest changed */ });
  it('a back-filled day merges into that day', () => { /* doneAt noonOf('2026-11-05', TZ) twice → one row */ });
  it('undoSave of a first save deletes it; of a second puts the first back', () => { /* … */ });
  it('undoSave refuses a before of another exercise', () => expect(undoSave(db, id, { ...snap, exerciseId: other })).toBe(false));
  it('deleteDay deletes that day only and restoreSets brings it back', () => { /* two rows on 15 Oct, one on 16 Oct */ });
  it('exerciseSummary counts days, not rows', () => {
  	// rows on 15 Oct (240 s, 120 s) and 16 Oct (300 s)
  	expect(exerciseSummary(db, ex, TZ)).toEqual({ times: 2, totalS: 660 });
  });
  // exercise-page.spec.ts (English by default)
  expect(historyTiles({ times: 3, totalS: 1020 })).toEqual([{ value: '3', label: 'times' }, { value: '17 min', label: 'in all' }]);
  expect(historyTiles({ times: 1, totalS: 0 })[0]).toEqual({ value: '1', label: 'time' });
  expect(archiveBody('Clave', 3)).toBe('Clave leaves Today and every list. Its history is kept.');
  ```
  In `log-form.spec.ts`: a second `logSetFrom` the same day leaves one row; the response carries `setId` and `before` (a JSON string, or null). Rewrite `data.spec.ts`'s two `exerciseSummary` expectations to `{ times, totalS }`. Replace the `summaryTiles` and `archiveBody` cases (English and the `sl()` block) with `historyTiles`/`archiveBody` ones.
- [ ] **Step 2: Run `npx vitest run src/lib/server src/lib/exercises/exercise-page.spec.ts` — the new cases FAIL.**
- [ ] **Step 3: Implement.** Find the day's rows by selecting the exercise's sets in `[noonOf(day, tz) - DAY_MS, noonOf(day, tz) + DAY_MS)` and filtering with `localDay` (the `listSetsBetween` rule: the day boundary decided in one place). `saveDay` and `deleteDay` run in one transaction. `logSetFrom` and the player's `save` call `saveDay(getDb(), …, tz)`; `logSetFrom` returns `{ action: 'log', ok: true, setId, before: before && JSON.stringify(before) }`. The exercise page's `summary` reads `exerciseSummary(db, id, tz)` (and `{ times: 0, totalS: 0 }` for a group drill with no entry); the page draws `historyTiles` (two tiles, no face tile) and passes `data.summary.times` where it read `summary.sets` (`archiveBody`, the empty check, "Showing the latest").
- [ ] **Step 4: `npx vitest run src/lib/server src/lib/exercises` PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): one entry per exercise per day`.

---

### Task 2: The faces (PURE)

**Files:**
- Modify: `src/lib/schedule/schedule.ts` (add `DoneFace`, `DoneInput`, `doneFaces`), `src/lib/schedule/schedule.spec.ts`
- Modify: `src/lib/server/schedule.ts` (add `doneFacesOf`), `src/lib/server/schedule.spec.ts`
- Modify: `src/lib/exercises/face-view.ts` (`faceColumns`), `src/lib/exercises/face-view.spec.ts`
- Modify: `src/lib/components/exercises/FaceRating.svelte` (already in `TRANSLATED`)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (new area `exercise.done`: `learnt` "learnt")

**Interfaces:**
- Consumes: plan 1's `scheduleOf`, `DueState`, `RATING_OF`, `ComesBack`.
- Produces:
  ```ts
  export interface DoneFace extends FacePreview { learnt: boolean }
  export interface DoneInput { startGap: number; createdAt: number; sets: ScheduleSet[]; comesBack: ComesBack }
  /**
   * What each face would set if saved now, as the Done sheet shows it: the sets replayed
   * through `scheduleOf` with `{ doneAt: now, rating: RATING_OF[feel] }` added; `gap` is
   * `daysBetween(today, dueDay)`. `learnt`: the start-of-day state (`beforeDay` today) is
   * learning and the replayed one is not. Null for a fixed rhythm (no faces).
   */
  export function doneFaces(input: DoneInput, now: number, timeZone: string): DoneFace[] | null;
  // server/schedule.ts — the inputs `scheduleStateOf` reads (the row, its class drill's comes_back, its sets). Not owner-scoped: check access first.
  export function doneFacesOf(db: Db, exerciseId: number, timeZone: string, now: number): DoneFace[] | null;
  // face-view.ts
  export interface FaceColumn { feel: Feel; word: string; time: string | null; learnt: boolean }
  export function faceColumns(preview: (FacePreview & { learnt?: boolean })[] | null): FaceColumn[];
  ```
  Why a replay, not `preview(state, today)`: while learning `DueState.gap` is 1 (plan 1's ruling), so the learnt face's gap must come from the faces' own replay. Replaying with the face added at `now` also previews a second save today right (the day is felt as its last rated set).
- `FaceRating` gains `hideQuestion?: boolean` (the legend becomes `sr-only`: the sheet's title asks) and `busy?: Feel | null` (while a face's save is in flight: every card disabled, that one `aria-busy`), and draws a column's `learnt` as a second line `t().exercise.done.learnt` in `text-done` under the time; the grid's third row is `2.6em` when any column is learnt (else `1.4em` as now). Its other props and the hidden `rating` input stay (the player's Save sheet uses it).

- [ ] **Step 1: Write the failing tests** (`schedule.spec.ts`'s own `at`, `gotit`, `TZ`):
  ```ts
  const now = at('2026-11-07', 18);
  const until = (sets: ScheduleSet[]) => ({ startGap: 3, createdAt: at('2026-11-01'), sets, comesBack: { kind: 'until', good: 3, since: at('2026-11-01') } as const });
  it('a learning drill one good day short: the good faces finish it, with the gap the faces earned', () => {
  	expect(doneFaces(until([gotit('2026-11-05'), gotit('2026-11-06')]), now, TZ)).toEqual([
  		{ feel: 'hard', gap: 1, learnt: false }, { feel: 'getting', gap: 1, learnt: false },
  		{ feel: 'gotit', gap: 3, learnt: true }, { feel: 'easy', gap: 7, learnt: true }
  	]);
  });
  it('two good days short: all four say tomorrow', () =>
  	expect(doneFaces(until([gotit('2026-11-06')]), now, TZ)!.map((f) => [f.gap, f.learnt])).toEqual([[1, false], [1, false], [1, false], [1, false]]));
  it('by the faces: the next gaps, none learnt', () =>
  	expect(doneFaces({ startGap: 3, createdAt: at('2026-11-01'), sets: [gotit('2026-11-04')], comesBack: FACES }, now, TZ)!.map((f) => [f.gap, f.learnt]))
  		.toEqual([[1, false], [4, false], [5, false], [7, false]]));
  it('a fixed rhythm has no faces', () =>
  	expect(doneFaces({ startGap: 3, createdAt: at('2026-11-01'), sets: [], comesBack: { kind: 'every', days: 2 } }, now, TZ)).toBeNull());
  // server/schedule.spec.ts: doneFacesOf on an entry that follows a class drill set to `{ kind: 'every', days: 1 }` → null; on an own drill with no sets → four faces
  // face-view.spec.ts
  it('a learnt column', () => expect(faceColumns([{ feel: 'gotit', gap: 3, learnt: true }])[2]).toEqual({ feel: 'gotit', word: feelWord('gotit'), time: '3 days', learnt: true }));
  ```
  (`feelWord` from `$lib/schedule/feel` rather than retyping "I've got it".)
- [ ] **Step 2: `npx vitest run src/lib/schedule src/lib/server/schedule.spec.ts src/lib/exercises/face-view.spec.ts` — FAIL.**
- [ ] **Step 3: Implement `doneFaces`, `doneFacesOf`, `faceColumns`, FaceRating's two props and the `learnt` line.** Look: `$M/sheet-learning.png`.
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(schedule): the Done sheet's faces, learning ones say when it's learnt`.

---

### Task 3: The page's words and the clock (PURE)

**Files:**
- Create: `src/lib/exercises/day-entry.ts` (+ spec), `src/lib/exercises/done-view.ts` (+ spec)
- Modify: `src/lib/exercises/exercise-page.ts` (add `historyRows`; + spec), `src/lib/exercises/stopwatch.ts` (+ spec), `src/lib/exercises/today.ts` (`pastGroups`; + spec), `src/lib/exercises/today-pane.ts` (`dayTotals`; + spec), `src/lib/player/view.ts` (`runSummary`; + spec)
- Modify: `src/lib/components/ui/styles.ts` (`ButtonKind` gains `'done-soft'`), `src/lib/components/ui/styles.spec.ts`
- Modify: `src/lib/components/today/PastDay.svelte` (draws `pastGroups`' merged entry; already in `TRANSLATED`), `src/lib/components/player/SaveSetSheet.svelte` (its `summary` doc comment)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.done`: `learning` "learning", `warmup` "warm-up", `saved(back)` "Saved · <back>", `added(day)` "Added to <day>", `doneToday` "Done today", `stopFirst` "Stop the count first."; Done itself is the existing `exercise.log.done`; `exercise.page.dayWithYear` stays), `en/today.ts` + `sl/today.ts` (`today.totals(exercises)`: the sets count goes; `today.past.set` → `today.past.done` "Done"), `en/player.ts` + `sl/player.ts` (`player.loggedAsSet` goes)

**Interfaces:**
- Produces (`day-entry.ts`):
  ```ts
  export interface DayEntry { durationS: number | null; reps: number | null; rating: number | null; note: string | null }
  /** A day's rows as one: minutes and reps added (null when none has any), the last rated face, notes joined " · " in time order. Rows in any order. */
  export function mergeDay(rows: { doneAt: number; durationS: number | null; reps: number | null; rating: number | null; note: string | null }[]): DayEntry;
  ```
- Produces (`done-view.ts`, every word from `t().exercise.done` at call time):
  ```ts
  export function bandSubtitle(i: { label: string; warmup: boolean; learning: boolean; seconds: number }): string;
  export function doneSubtitle(i: { seconds: number | null; learning: { good: number; of: 3 | 5 } | null; day: string | null; name: string }): string;
  export function savedMessage(backDays: number): string;   // "Saved · back in 12 days": `saved` with `backWords(backDays)` lower-cased, as `undoLogMessage` does
  export function addedMessage(day: string): string;        // "Added to Thu 5 Nov" (dayLabel)
  export function doneBar(i: { doneToday: boolean; playing: boolean }): { label: string; kind: 'primary' | 'done-soft'; disabled: boolean; hint: string | null };
  ```
- Produces (`exercise-page.ts`): `historyRows(history: HistorySet[], tz: string, today: string): HistoryDay[]` with `HistoryDay = { day: string; label: string; amount: string | null; feel: Feel | null; note: string | null }` (`label`: `dayLabel(day)`, another year through `exercise.page.dayWithYear`; `amount`: `setSummary` of the merged entry without the face, e.g. `"6 min"`, `"6 min · 40 reps"` for old reps; null when empty). `historyDays`, `PageParts`'s `logButton`/`setList` stay until Task 7; `setTitle`, `setMeta` until Task 9 (their users, the page's old history and `SetList.svelte`, go there).
- Produces (`stopwatch.ts`): `followVisibility(w: Stopwatch, visible: boolean, now: number): Stopwatch` (start when visible, pause when hidden).
- Changes: `pastGroups` returns one `{ exerciseId, name, entry: DayEntry }` per exercise (merged); `dayTotals` drops the sets count (`"7 exercises · 1 h 05"`); `runSummary` drops `loggedAsSet` (`"3:42 · 12 figures called"`); `undoLogMessage` is deleted in Task 8 (its last user goes there).
- `button('done-soft', …)`: `bg-done-soft text-done disabled:bg-disabled-bg disabled:text-disabled-ink` (the "Done today" button). Plan 3 adds `'done'` (`bg-done text-on-done`, the green "Done · next").

- [ ] **Step 1: Write the failing tests** (exact values, English):
  ```ts
  // day-entry
  expect(mergeDay([
  	{ doneAt: 3, durationS: null, reps: null, rating: 4, note: 'b' },
  	{ doneAt: 1, durationS: 240, reps: null, rating: 2, note: 'a' },
  	{ doneAt: 2, durationS: 120, reps: null, rating: null, note: null }
  ])).toEqual({ durationS: 360, reps: null, rating: 4, note: 'a · b' });
  // done-view
  expect(bandSubtitle({ label: 'Drill', warmup: false, learning: false, seconds: 252 })).toBe('Drill · 4:12');
  expect(bandSubtitle({ label: 'Drill', warmup: false, learning: true, seconds: 200 })).toBe('Drill · learning · 3:20');
  expect(bandSubtitle({ label: 'Drill', warmup: true, learning: false, seconds: 390 })).toBe('Drill · warm-up · 6:30');
  expect(doneSubtitle({ seconds: 252, learning: null, day: null, name: 'X' })).toBe('4:12');
  expect(doneSubtitle({ seconds: 252, learning: { good: 2, of: 3 }, day: null, name: 'X' })).toBe('Learning · 2 of 3 good days');
  expect(doneSubtitle({ seconds: null, learning: null, day: '2026-11-05', name: 'Review: La policía' })).toBe('Review: La policía · Thursday 5 November');
  expect(savedMessage(12)).toBe('Saved · back in 12 days');
  expect(savedMessage(1)).toBe('Saved · back tomorrow');
  expect(addedMessage('2026-11-05')).toBe('Added to Thu 5 Nov');
  expect(doneBar({ doneToday: true, playing: false })).toEqual({ label: 'Done today', kind: 'done-soft', disabled: false, hint: null });
  expect(doneBar({ doneToday: false, playing: true })).toEqual({ label: 'Done', kind: 'primary', disabled: true, hint: 'Stop the count first.' });
  // exercise-page
  // historyRows: two rows on 2026-10-15 (240 s gotit at 10:00, 120 s getting at 21:00, note 'Lost the clave') →
  //   [{ day: '2026-10-15', label: 'Thu 15 Oct', amount: '6 min', feel: 'getting', note: 'Lost the clave' }];
  //   a row on 2025-12-31 with today 2026-11-07 → label 'Wed 31 Dec, 2025'; newest day first
  // stopwatch
  expect(followVisibility({ bankedMs: 5000, runningSince: 1000 }, false, 3000)).toEqual({ bankedMs: 7000, runningSince: null });
  expect(followVisibility({ bankedMs: 7000, runningSince: null }, true, 9000)).toEqual({ bankedMs: 7000, runningSince: 9000 });
  // dayTotals: 3 rows of 2 exercises, 3900 s → '2 exercises · 1 h 05'; runSummary(222, 12) → '3:42 · 12 figures called'
  // styles.spec: button('done-soft') contains 'bg-done-soft' and 'text-done'
  ```
  Add one Slovenian case each for `savedMessage` and `doneSubtitle`'s past day under `withLocale('sl', …)` (the values the Slovenian you write gives). Rewrite or delete the old `pastGroups` and `dayTotals` cases.
- [ ] **Step 2: `npx vitest run src/lib/exercises src/lib/player src/lib/components/ui/styles.spec.ts` — FAIL.**
- [ ] **Step 3: Implement.** `PastDay.svelte` draws one line per exercise from `entry` (`setSummary(entry) || t().today.past.done`, the note under it); the `today` pane's day so far (`PastDay today`) follows.
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): the one page's words, merged days, the visible-only clock`.

---

### Task 4: The save, its Undo and a day's delete (form side)

**Files:**
- Modify: `src/lib/server/log-form.ts` (add the four below; `parseSetSnapshot` stays, add `parseSetSnapshots`; `logSetFrom`/`deleteSetFrom`/`restoreSetFrom` stay until Task 9 removes their last users)
- Modify: `src/lib/types.ts` (`DoneResult`, client-safe)
- Modify: `src/routes/[dance]/(today)/+page.server.ts` (add actions `done`, `undoDone`; `log`, `deleteSet`, `restoreSet` stay until Task 8)
- Modify: `src/routes/[dance]/player/+page.server.ts` (`save` answers JSON, no redirect), `src/lib/components/player/SaveSetSheet.svelte` (`onsaved` gets the result), `src/routes/[dance]/player/+page.svelte` (its `saved` takes it)
- Modify: `src/lib/page-epoch.ts` (8 → 9)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.refused.dayGone` "That day was already removed.", `dayPutBack` "That day could not be put back." — the `deleteDay`/`restoreDay` refusals; the old `setGone`/`putBack` say "set")
- Test: `src/lib/server/log-form.spec.ts`, `src/routes/[dance]/player/save.spec.ts`, `src/routes/[dance]/today-actions.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`saveDay`, `undoSave`, `deleteDay`, `restoreSets`), plan 1's `scheduleStateOf` (`DueState`).
- Produces:
  ```ts
  // types.ts
  export interface DoneResult { ok: true; setId: number; before: string | null; backDays: number | null }
  // log-form.ts
  /** Fields: exerciseId, durationS (0..86400, optional), rating (1..5, optional), note (≤2000), run (≤4000, dropped when longer), day (a past day: backfill at noon, no run, no time). */
  export async function saveDoneFrom(e: LogEvent): Promise<ActionFailure<{ action: 'done'; message: string }> | (DoneResult & { action: 'done' })>;
  /** Fields: setId, before ('' = null). */
  export async function undoDoneFrom(e: LogEvent): Promise<…{ action: 'undoDone'; ok: true }>;
  /** Fields: exerciseId, day. Answers { action: 'deleteDay', ok: true, snapshots: string } (JSON array). */
  export async function deleteDayFrom(e: LogEvent): Promise<…>;
  /** Fields: snapshots. */
  export async function restoreDayFrom(e: LogEvent): Promise<…>;
  export function parseSetSnapshots(raw: string, now: number): SetSnapshot[] | null; // all valid, one exerciseId, else null
  ```
- Rules: the exercise is `requireExerciseInWall` (a group's row is a 404). Fixed rhythm (`scheduleStateOf(...).every !== null`) → `rating` stored null whatever was posted; otherwise a missing rating is `fail(400, { action: 'done', message: t().exercise.log.pickFeel })` ("Pick how it went"). `backDays` = `daysBetween(today, scheduleStateOf(db, id, tz).dueDay)` after the save; null for a past day. `undoDoneFrom`: the set must be the wall's (`getSet` then `requireExerciseInWall`), `before` must parse and name the same exercise, else `fail(400, { action: 'undoDone', message: t().today.refused.undo })` ("Could not undo that. Try again."). Refusals read `t()` per request, as the existing ones do.
- Player `save`: `saveDay` (reps null), then `{ action: 'done', ok: true, setId, before, backDays }` (a `DoneResult`); a missing face is still refused (the fixed-rhythm rule in the player is plan 3's). `SaveSetSheet` calls `onsaved(result.data as DoneResult)` on a `success` result (was: on `redirect`); the player page's `saved(r)` leaves as now (`leaveRun`) and, from Task 5 on, announces the save first. Until Task 5 the player's save shows no toast; Today's `?logged=` handling is removed in Task 8.

- [ ] **Step 1: Write the failing tests** (`log-form.spec.ts`, its existing mock-`getDb` pattern):
  - `saveDoneFrom` with `{ exerciseId, durationS: '252', rating: '4', note: 'ok' }` → one row `{ durationS: 252, rating: 4, note: 'ok' }`, `before: null`, `backDays: 3` (a new drill, G3 "I've got it" first gap: compute it in the test as `Math.max(STEPS.gotit.floor, everyDays)`, not by hand).
  - a fixed-rhythm drill (`createCustomExercise(…, { name, notes: null, comesBack: { kind: 'every', days: 2 } })`) posted with `rating: '5'` → stored `rating: null`, `backDays: 2`.
  - by how it went with no rating → 400 "Pick how it went", nothing stored.
  - `day: '2026-11-05'` (a past day) → `doneAt === noonOf('2026-11-05', TZ)`, `durationS` null even when posted, `playerJson` null, `backDays: null`.
  - posting the group drill's own id (not the member's entry; `makeClass(db)` from `src/lib/server/test-class.ts`, acting as Maja, `u3`) → 404, nothing stored.
  - `undoDoneFrom` with a `before` of another exercise → 400, the row unchanged; with another person's `setId` → 404.
  - `deleteDayFrom` then `restoreDayFrom` with its `snapshots` → the day's rows back.
  - `save.spec.ts`: a saved run answers `{ ok: true, setId, before: null, backDays }` (no redirect: replace the two 303 cases); a second run that day leaves one row. `today-actions.spec.ts`: Today's `done` with `day` and `undoDone`.
- [ ] **Step 2: `npx vitest run src/lib/server/log-form.spec.ts "src/routes/[dance]"` — FAIL.**
- [ ] **Step 3: Implement; wire Today's `done` and `undoDone`; raise `PAGE_EPOCH` to 9.** The exercise, figure and lesson pages and Today's popup still post the old actions: keep `logSetFrom`, `deleteSetFrom`, `restoreSetFrom` (writing through `saveDay`, Task 1) until Tasks 7–9 remove their last users; Task 9 deletes them.
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(log): save a day, undo it, delete a day`.

---

### Task 5: The Done sheet, the saved toast, the page clock

**Files:**
- Create: `src/lib/components/exercises/DoneSheet.svelte`, `src/lib/components/exercises/SavedToast.svelte`, `src/lib/exercises/saved.svelte.ts`, `src/lib/exercises/page-clock.svelte.ts`
- Modify: `src/routes/[dance]/+layout.svelte` (mount `<SavedToast />` once), `src/lib/sheets/history.svelte.ts` (add `whenSettled`), `src/lib/nav/trail.svelte.ts` (add `backWhenSettled`), `src/routes/[dance]/player/+page.svelte` (`saved(r)` announces)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.done.tapFace` "Tap a face to save it"; the title, note and placeholder reuse `exercise.types.howItWent`, `exercise.log.note`/`optional`/`notePlaceholder`), `src/lib/i18n/no-english.spec.ts` (`TRANSLATED` gains `DoneSheet.svelte`, `SavedToast.svelte`)
- Test: `src/lib/components/today/today-forms.spec.ts` (source checks, the file's existing style)

**Interfaces:**
- Consumes: Task 2 (`DoneFace`, FaceRating's `hideQuestion`/`busy`), Task 3 (`savedMessage`), Task 4 (`DoneResult`, Today's `undoDone`).
- Produces:
  ```ts
  // DoneSheet props
  interface Props {
  	open: boolean; onclose: () => void;
  	/** '?/done' on the exercise page; `/${dance}?/done` on a past day (the hard rule: never bare in a layout). */
  	action: string;
  	exerciseId: number;
  	subtitle: string;
  	faces: DoneFace[] | null;   // null: no times
  	seconds: number | null;     // read at the tap; null posts no durationS
  	run: string | null;         // the practice panel's player_json
  	day: string | null;
  	simple: boolean;            // no note (the levels spec's call, kept)
  	current: { rating: number | null; note: string | null } | null; // Done today: that face lit, that note filled
  	onsaved: (r: DoneResult) => void;
  }
  // saved.svelte.ts
  export interface Saved { dance: DanceSlug; message: string; undo: { setId: number; before: string | null } | null }
  export function announceSaved(s: Saved): void;
  export const saved: { readonly current: (Saved & { id: number }) | null; dismiss(): void };
  // page-clock.svelte.ts (call during component init)
  export function pageClock(): { readonly seconds: number; restart(): void };
  // history.svelte.ts — the shared start of gotoWhenSettled, which uses it from now on
  /** Once history has caught up with the sheets' own Back moves, run fn; lets a click's hold go and drops a refresh owed for a form sent in a sheet. */
  export function whenSettled(fn: () => void): void;
  // trail.svelte.ts (beside goBack and leaveRemoved: trail imports history.svelte.ts, never the other way)
  /** Close-then-back: once the sheets' Back has landed, the band's back (`goBack(fallback)`). */
  export function backWhenSettled(fallback: { href: string; label: string }): Promise<void>;
  ```
- DoneSheet: a `Sheet` (auto height, not `tall`) titled `t().exercise.types.howItWent` with `sub={subtitle}`; body: Note (one line that grows, `TEXTAREA`, `rows=1`, min-h 52px) unless `simple`, then `FaceRating hideQuestion` with `preview={faces}`, then `t().exercise.done.tapFace`. One `<form method="POST" {action} use:guarded>` (label `t().exercise.types.howItWent`; dirty only by the note): hidden `exerciseId`, `durationS` (from `seconds` at submit, omitted when null), `run`, `day`, `rating`. A face tap sets the rating and `requestSubmit()`s; while sending, the faces are disabled and the tapped one shows `aria-busy` (`busy`). On success the submit **awaits `update({ reset: false })` while the sheet is still open** (the page and the (today) layout's day then count the save: the row is done, a session's or run's next is right) and then calls `onsaved(result.data)`; the caller closes the sheet and leaves. A refusal shows as a `Banner` in the sheet (from the submit result, as LogShell does: a past day's posts to another route). No footer. On desktop it is the centred dialog every Sheet already is (`$M/desk-sheet.png`).
- SavedToast: the app's `Toast` with `saved.current`; Undo posts `actAt('/' + dance, 'undoDone', { setId, before: before ?? '' })` and shows its refusal (`refusalMessage(result, t().today.refused.undo)`) as a plain toast. It is drawn above a pinned bar the way the exercise page's toast is (`bottom` with `--pin-bottom`).
- pageClock: `stopwatch.ts` state, `followVisibility` on `visibilitychange`, a 1 s tick only while visible, started on mount.

- [ ] **Step 1: Write the failing source checks** in `today-forms.spec.ts` (read the file as text, as the spec does for LogShell now): DoneSheet posts to its `action` prop, never a bare `?/…`; uses `use:guarded`; reads its refusal from the submit result; SavedToast posts `undoDone` through `actAt`.
- [ ] **Step 2: Run — FAIL. Step 3: Implement**, and have the player's `saved(r)` call `announceSaved({ dance, message: savedMessage(r.backDays ?? 1), undo: { setId: r.setId, before: r.before } })` before it leaves.
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): the Done sheet and the saved toast`.

---

### Task 6: Practise with on the page, a drill's Recordings

**Files:**
- Modify: `src/lib/components/exercises/kinds/index.ts` (`ContentProps`, add `practiceFor`/`PracticeProps`; `logFor` goes in Task 9)
- Create: `src/lib/components/exercises/kinds/drill/Practice.svelte`, `kinds/figure/Practice.svelte`, `kinds/routine/Practice.svelte`, `src/lib/components/exercises/DrillRecordings.svelte`
- Modify: `kinds/drill/Content.svelte`, `kinds/figure/Content.svelte`, `kinds/routine/Content.svelte`, `kinds/lesson/Content.svelte` (prop changes only), `src/lib/components/exercises/LogShell.svelte` (`contentProps` picks `'onPage' | 'canEdit'`), `src/lib/components/figures/AddRecordingSheet.svelte` (`video?: boolean`)
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (passes the new props; it is redrawn in Task 7)
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.content.recordings(n)` "Recordings" / "Recordings · 3"; `routineNote` takes the new copy), `no-english.spec.ts` (`TRANSLATED` gains the three `Practice.svelte`s and `DrillRecordings.svelte`)
- Test: `src/lib/exercises/kinds.spec.ts` (a source check on `kinds/index.ts`)

**Interfaces:**
- Produces:
  ```ts
  export interface ContentProps {
  	dance: Dance; content: PracticeContent; timezone: string;
  	canEdit?: boolean; simple?: boolean;
  	/** The popup's look until Task 9 deletes the popup (and this prop). */
  	onPage?: boolean;
  	/** The Practise with card, drawn right after the type's description (drill: Description; figure: the reference notes; routine: its notes). A lesson has none. */
  	practice?: Snippet;
  	/** A drill's Recordings' + Add, or null when the person may not add (a reader, the simple page). */
  	recordings?: { label: string; linkable: SectionGroup[]; message: string | null; entered: string } | null;
  }
  export interface PracticeProps {
  	dance: Dance; exercise: ExerciseItem; content: PracticeContent;
  	songs: PickerSong[]; takes: CountTakeRow[];
  	/** The player link's `from` part: 'from=exercise' (plan 3 passes the run's). */
  	playerFrom: string;
  	onrun: (r: { durationS: number; playerJson: string }) => void;
  	onactive: (playing: boolean) => void;
  }
  export const practiceFor: (type: ExerciseType) => Component<PracticeProps> | null; // lesson → null
  ```
  `editLinks` leaves `ContentProps` now (only the page passed it); `onPage` stays until Task 9 (the popups still draw `Content` until then).
- `drill/Practice` and `figure/Practice` are today's `drill/Log.svelte` / `figure/Log.svelte` panel snippets as components (`PracticePanel`; the figure's `cue` from `content.figure`). `routine/Practice` is the "Practise in player" link (`/{dance}/player?routine=…&exercise=…&{playerFrom}`, `t().exercise.content.practiseInPlayer`) and the line `t().exercise.content.routineNote` (**A run there saves itself. Tap Done when you practised away from the app.**).
- `DrillRecordings.svelte` props: `{ sections: LinkedSection[]; links: LinkRow[]; canEdit: boolean; editing: boolean; recordings: ContentProps['recordings'] }`. Not editing: heading `t().exercise.content.recordings(n)` with **+ Add** (`t().common.add`; when `recordings` is non-null), one `GROUP` card of `SectionRow`s (`src/lib/components/figures/SectionRow.svelte`) then `LinkRow`s (`canSave={false}`: a drill holds no video of its own); hidden by `showRecordings({ canEdit, items })` (`src/lib/figures/page.ts`). + Add opens `AddRecordingSheet` with `video={false}` and `figureLabel={recordings.label}` ("Add to <drill>"), whose Link a section opens `LinkSectionSheet` (`groups={linkable}`, posts `?/linkSection`) and Link opens `AddLinkSheet` (`action="?/addLink"`). Editing: the same card with each section's **Unlink** (`?/unlinkSection`, `focusAfterRemoval` as the drill content does now) and each link's trash (`LinkRow editing`, `?/deleteLink`). Look: `$M/drill-rows.png`, `$M/drill-add.png`, `$M/drill-editing.png`. The sheets and rows it opens keep their own words (the figure page's, Slovenian part 2).
- `AddRecordingSheet`: `video?: boolean` (default true); with `video={false}` the video row is not drawn and its props (`app`, `appHref`, `onvideo`, `uploading`) are optional.
- `drill/Content` on the page: Description (`SECTION_LABEL` + text), `practice`, then `<DrillRecordings editing={false}>`. The old "Link a section…" opener, the Sections heading and `LinksEditor` go. The popup's look (`!onPage`: the notes and `LinkList`) stays until Task 9.

- [ ] **Step 1: Failing tests:** `kinds.spec.ts`: a source check that `kinds/index.ts` maps `lesson` to no practice (`practiceFor('lesson')` is null). **Step 2: FAIL. Step 3: Implement** (the exercise page passes `recordings` and `practice` and drops `editLinks`, in its page content and its pane's `contentProps`; it is redrawn in Task 7). **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): Practise with on the page; a drill's Recordings`.

---

### Task 7: The exercise page is the one page

**Files:**
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/lib/components/exercises/DoneBar.svelte`, `src/lib/components/exercises/HistoryDaySheet.svelte`
- Modify: `src/lib/exercises/exercise-page.ts` (`PageParts` loses `logButton` and `setList`; `historyDays` goes), its spec
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.page.deleteDay` "Delete this day", `dayDeleted(label)` "<label> deleted"; `nothingYetBody` takes the new copy; `logASet`, `practised` go), `no-english.spec.ts` (`TRANSLATED` gains `DoneBar.svelte`, `HistoryDaySheet.svelte`)
- Test: `src/lib/components/today/today-forms.spec.ts` ("the exercise page's popup and pane post to the page's own route" becomes: its DoneSheet posts `?/done`, never an exercise URL), `src/routes/[dance]/exercise-refusals.spec.ts` (the `log`/`deleteSet`/`restoreSet` cases ~73–85 → `done`/`deleteDay`/`restoreDay`, Slovenian and English), `src/routes/[dance]/owner-wall.spec.ts` (the exercise page's `log`/`deleteSet` ~659 and `log` on a group drill ~1907 → `done`/`deleteDay`), `src/routes/[dance]/dance-wall.spec.ts` (`exercisePage.actions.restoreSet` ~263 → `restoreDay`)

**Interfaces:**
- Consumes: Tasks 1–6, plan 1's `DueState` (`data.scheduleAtStart`).
- Produces: actions `done` (`saveDoneFrom`), `deleteDay`, `restoreDay` on the page (`log`, `deleteSet`, `restoreSet` go; they sit inside `flowing(…)` as every action of the page does). Load: `summary` per Task 1; `faces: DoneFace[] | null` (`doneFacesOf` of the person's row or entry, null without one); `entryToday: DayEntry | null` (`mergeDay` of `popup.sets`, null when none); `historyCut: boolean` (`exerciseHistory` hit its 200-row limit); `songs`/`takes` stay for Practise with.
- `DoneBar.svelte`: a `BottomBar` (`width="two"`, no `desk:hidden`: it pins to the pane on desktop) with `left?: Snippet` beside the main button (plan 3 puts Skip there: with a `left`, both are `rowButton`s) and the main button from `doneBar()` (`button(view.kind, 'md', true)`, `check` icon), its hint under it.
- `HistoryDaySheet.svelte`: `Sheet size="small"` titled with the row's label; the day's amount, face word and note; **Delete this day** (`button('danger-text')`) posting `?/deleteDay` (`exerciseId`, `day`) with `use:enhance`. The page's toast says `t().exercise.page.dayDeleted(label)` with **Undo** → `act('restoreDay', { snapshots })`.
- The page's own functions (plan 3 calls and branches them):
  - `const fixed = $derived(data.scheduleAtStart?.every != null)`.
  - `async function saveNow(): Promise<void>` — the fixed-rhythm Done: `act('done', { exerciseId: data.exercise.id, durationS: clock.seconds, run: run?.playerJson ?? '', rating: '' })` (it reloads the page's data itself), a refusal as the page's toast, else `saved(result.data)`.
  - `function saved(r: DoneResult): void` — after any save: `announceSaved({ dance, message: savedMessage(r.backDays ?? 1), undo: { setId: r.setId, before: r.before } })`, the sheet closes; then, until Task 8 shrinks the layout's session, `today?.logged(clock.seconds)` and in a session `today.session.next ? today.session.onnext() : today.session.onfinish()`; otherwise `backWhenSettled({ href: Today, label: t().shell.backTo(t().shell.tabs.today) })`. Then `clock.restart()`.

Page, top to bottom (`$M/page-drill.png`, `$M/hist-a.png`, `$M/page-lesson.png`, `$M/page-figure.png`; desktop `$M/desk-sheet.png`):
- Band subtitle `bandSubtitle({ label: TYPES[type].label, warmup: exercise.warmup, learning: !!data.scheduleAtStart?.learning, seconds: clock.seconds })` while `canLog`; while editing, or on a group drill without an entry, the type label alone; the clone line still wins when `cloneSubtitle` has one. `LastTime` and the session `line` stay under the band (the line goes in Task 8).
- The "Comes back · … · Set by your teacher" line shows at every level (plan 1's final review left this here: the spec says the page still shows it at Follow my class; today's `followsTeacher` hides it on the simple page).
- Phone, one column: owner row, the type's `Content` (with `practice` = `practiceFor(type)` rendered with the page's `songs`/`takes`, `playerFrom="from=exercise"`, `onrun` → `run`, `onactive` → `playing`; only when `canLog`) and `recordings` (when `canEditContent && !simple`: `{ label: title, linkable: data.linkable, message: failure('addLink') ?? failure('linkSection'), entered }`), from class, comments, the Add block, Music, History, Settings, Not today. Desktop (`PaneColumns ratio="1:1"`): left = owner row … Add block; right = Music, History, Settings, Not today. `logColumn`, `contentLeft`, `notTodayPane` and the page's Log popup (`Log`, `logging`, `?log=1`, `SetList`, `restoreSet`, its `pagePopup` effect) go; Not today is one button at the end at both widths.
- History (H1, `parts.historyTiles`): two tiles from `historyTiles` (28px numbers), then one `GROUP` card, a row per `historyRows` day: label bold left, `amount` muted right then `Face` (22px) in its colour, the note muted under; the row is a button opening `HistoryDaySheet`. No trash. Empty: `EmptyState` with the Global Constraints' words. `t().exercise.page.showingLatest(n)` (n: the days drawn) stays when `data.historyCut`.
- Pinned: `DoneBar` when `canLog` and not editing; edit mode keeps its Save bar. Done: `fixed` → `saveNow()`; else opens `DoneSheet` with `action="?/done"`, `faces={data.faces}`, `subtitle = doneSubtitle({ seconds: clock.seconds, learning: data.scheduleAtStart?.learning ?? null, day: null, name: title })`, `current = data.entryToday`, `simple`, `onsaved={saved}`.
- Edit mode (a drill the person may edit): after the settings card(s), `DrillRecordings editing` when it has rows (`$M/drill-editing.png`), then Archive.
- Another exercise opened in the page (`pageId` changes): `clock.restart()`, the sheet closes, `run` and `playing` reset (the existing `$effect.pre` block). `?log=1` is no longer read.
- Simple page (`pageParts(simple, …)`): the same page, the same Done and sheet (no note), no history.

- [ ] **Step 1: Failing route test:** the page's `done` action on a member's group-drill page saves on the member's entry (the posted `exerciseId`), and the group's drill id posted there is a 404 (Review Focus). Update the specs named under **Test** to the new action names.
- [ ] **Step 2: Run — FAIL. Step 3: Implement.**
- [ ] **Step 4: `npm run check` passes. Shots:** the exercise page for a drill (with sections and a link), a lesson review, a figure, a routine, a learning drill's sheet, a group drill without an entry, at 390 and 1440; compare with `page-drill`, `drill-rows`, `hist-a`, `page-lesson`, `page-figure`, `sheet-drill`, `sheet-learning`, `desk-sheet`. Try in the dev server: the band's time stops while the tab is hidden; Done → face → back where it was opened, toast, Undo puts it back; Done again → **Done today** → sheet with the face lit → one row, time added.
- [ ] **Step 5: Commit** `feat(exercises): one page — practise, Done, and the history by day`.

---

### Task 8: Today: rows open the page, a past day's Done, the session walks pages

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte`, `+layout.server.ts`, `+page.svelte`, `+page.server.ts`
- Modify: `src/lib/components/today/today-context.ts`, `TodayList.svelte`, `ExerciseRow.svelte`, `PastDay.svelte`
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (`saved` uses the new session; the session line goes from `lastTime`)
- Modify: `src/lib/exercises/today.ts` (delete `undoLogMessage`), `src/lib/exercises/today-pane.ts` (delete `sessionLine`), `src/lib/exercises/session.ts` (delete `sessionSummary`), their specs
- Modify: `src/lib/i18n/en/today.ts` + `sl/today.ts` (`today.row.logSet` and `today.session` go; `today.past.addSet(name)` "Add {name} to this day", `today.past.logOn(day)` "Add to {day}"; `today.refused.undoSet` goes)
- Test: `src/lib/components/today/today-forms.spec.ts`, `src/routes/[dance]/owner-wall.spec.ts` (Today's `log`/`deleteSet`/`restoreSet` ~633–638 → `done`/`undoDone`), `src/routes/[dance]/dance-wall.spec.ts` (`todayActions.log`/`deleteSet`/`restoreSet` ~232–261 and ~299 → `done`/`undoDone`)

**Interfaces:**
- Produces (the interim session, as small as works; plan 3 Task 3 deletes it):
  ```ts
  // today-context.ts (SessionControls moves here from LogShell, smaller)
  export interface SessionControls {
  	/** On after a save: the session's next row's page (a replace), else back to Today (`backWhenSettled`). */
  	onnext: () => void;
  }
  export interface TodayPane {
  	/** `?session=1` on an exercise route, not a past day; else null. */
  	readonly session: SessionControls | null;
  	canSkip(exerciseId: number): boolean;
  	notToday(exerciseId: number): Promise<boolean>;
  }
  ```
  (`follow`, `line`, `key`, `logged`, `undoable`, `toast`, `dismissToast`, `pagePopup` go.)
- Today's `+page.server.ts`: the `log`, `deleteSet` and `restoreSet` actions go (nothing posts them now).
- Layout, what goes: the phone popup (`open`, `openSets`, `Log`, its `{#if open && Log}` block and the `logFor`/`typeOf`/LogShell imports), `openId`, `skipped`, `tally`, `walked`, `sessionEnded`, `bumpKey`, `clearSession`, `walk`, `endSession`, the `onMount`, the `wasOn` and narrowing (`wasDesk`, `pageLogging`) effects, the `onNavigate` that closes the popup, `logged`, `follow`, `line`, `undoable` and the `?logged=` handling (`loggedParam`), `swapTo`'s `openId` branch, `TodayList`'s `onlog`. The phone's `afterNavigate` keeps only its `invalidate('today:list')` (`today-layout.spec.ts` checks it is there).
- Layout, what stays for plan 3 to delete: `sessionOn`, `walkRows`, `firstUp`, `nextUp` (`nextInSession(walkRows, new Set(), currentId)`), `openRow(id, how)` (navigates at both widths to `at(id, '?session=1')` through `gotoWhenSettled`; no `answered`), `startSession()` (Start pushes the first row's page), `session` (`onnext`: `nextUp ? openRow(nextUp.exercise.id, 'replace') : backWhenSettled(Today)`), `resuming`/`play` (Resume replaces), `upNextId`, `rowSearch`, `swapTo`'s `sessionOn` branch.
- The list load drops `songs`, `takes` and `schedulesAtStart` (only the popups read them).
- The exercise page's `saved(r)` (Task 7) becomes: announce; `today?.session ? today.session.onnext() : backWhenSettled(Today)`; `clock.restart()`. `lastTime` loses `today?.line`.
- `ExerciseRow`: the "+" button and `onlog` go; the link ends in a muted `chevron-right` (`text-chevron`, as the lesson rows) at every width. `TodayList` loses `onlog`.
- Past day (`+page.svelte`): PastDay's `onlog(id)` opens `DoneSheet` with `action="/{data.dance.slug}?/done"`, `day={past.day}`, `seconds={null}`, `faces={null}`, `subtitle={doneSubtitle({ seconds: null, learning: null, day: past.day, name })}`, `current` = that exercise's merged entry that day (`mergeDay` of its `past.daySets`, or null), `simple`; `onsaved` closes it and `announceSaved({ dance, message: addedMessage(past.day), undo })`. PastDay's words: the + is `t().today.past.addSet(name)` (**Add {name} to this day**), the picker title `t().today.past.logOn(dayLabel(day))` (**Add to {day}**), headings unchanged. Look: `$M/sheet-past-day.png`.

- [ ] **Step 1: Failing tests:** `today-forms.spec.ts`: a past day's DoneSheet posts to `/{data.dance.slug}?/done` (replaces the `?/log` case); "Today's popup posts to Today" and the "Today's popup … is never drawn on the desktop" describe go; `ExerciseRow.svelte` has no `logSet` and no `onlog`. Update the wall specs named under **Test**.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: `npm run check` passes.** Try at 390 and 1440: Start session → first page → face → next page → … → last face → Today; a row tap → page → face → back to Today with the toast; a past day's +.
- [ ] **Step 5: Commit** `feat(today): rows open the exercise; a past day's Done; the session walks pages`.

---

### Task 9: The popup goes everywhere else

**Files:**
- Modify: `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/lessons/[id]/+page.svelte`, `+page.server.ts`
- Delete: `src/lib/components/exercises/LogShell.svelte`, `kinds/*/Log.svelte`, `SetList.svelte`, `restore-set.ts`, `restore-set.spec.ts`, `fetch-practice.ts`; the `GET` in `src/routes/[dance]/(today)/exercises/[id]/practice/+server.ts` (its `POST` stays); `footerFor`, `fieldsShown`, `rangeError` in `src/lib/exercises/log-view.ts` (keep `lastTimeParts`) and their spec cases; `setTitle`, `setMeta` in `exercise-page.ts` and their spec cases; `logSetFrom`, `deleteSetFrom`, `restoreSetFrom` and their `log-form.spec.ts` cases
- Modify: `src/lib/components/exercises/kinds/index.ts` (`logFor`, `LogProps` go; `ContentProps.onPage` goes, and the four `Content.svelte`s draw the page's look only), `src/lib/exercises/kinds.ts` (`TypeInfo` = `{ type, label }`; `LogField`, `fields`, `ratingQuestion`, `paneContent`, `hasField` go: their last users were LogShell and `logSetFrom`), `src/lib/exercises/kinds.spec.ts`
- Modify: `src/lib/components/ui/focus-clip.spec.ts` (LogShell's entry), `src/lib/components/today/today-forms.spec.ts` (the LogShell cases), `src/lib/i18n/no-english.spec.ts` (`TRANSLATED` loses `LogShell.svelte`, `SetList.svelte` and the four `kinds/*/Log.svelte`), `src/routes/[dance]/owner-wall.spec.ts` (the lesson page's `log` ~1825), `src/routes/[dance]/dance-wall.spec.ts` (`figurePage.actions.deleteSet` ~429), `src/routes/dev/kit/+page.svelte` ("set" words)
- Modify: the catalogs (en and sl): remove what nothing reads now (grep each key: most of `exercise.log` — keep `note`, `optional`, `notePlaceholder`, `pickFeel`, `saving`, `didNotSave`, `lastTime`, `firstTime`, `done`; `exercise.sets`; `exercise.refused.setGone`/`putBack`); the glossary's "Log a set" line in `sl/index.ts` becomes Done (`Opravljeno`)

**Interfaces:**
- `kinds.spec.ts`: `TYPES.drill` is `{ type: 'drill', label: 'Drill' }`.
- Figure page: `FigureLog`, `logging`, `data.popup`, `scheduleAtStart` and the `log`/`deleteSet`/`restoreSet` actions go. The reader's pinned **Practise** is a link to the exercise page whenever `data.exercise`; without one, the `practise` form's success `goto`s the new exercise's page (the action returns `{ action: 'practise', ok: true, exerciseId }`). `practice` (the ⋯ menu's line, the server's local `practiceFor(db, exercise, …)`) is built from `found.exercise` without `popup`.
- Lesson page: `LessonLog`, `logging`, `data.popup` (and `scheduleAtStart` if nothing else reads it) and the three actions go. The review row is shown when `data.exercise` (was `&& data.popup`); its "+" becomes a muted chevron inside its link. The linked exercises' `?log=1` "+" goes; each row's link ends in a chevron.
- Sweep: `rg -n -i "\b(a set|sets?)\b" src -g '*.svelte'` and string literals in `src/lib` and the catalogs (exclude code names): every UI string loses "set" — the songs page's delete body "… Sets you logged with it stay." → **Your history with it stays.**; the lesson archive body "… The videos, links and sets are kept." → **The videos, links and history are kept.**; the kit's samples ("5 exercises · 7 sets", "Set deleted", "Log set"); the Routines list's empty body ("… call as a single set"). A changed string on a page that is not translated yet stays inline English (Slovenian part 2); one in a catalog changes in both languages.

- [ ] **Step 1: Failing source checks** (a spec beside `today-forms.spec.ts`): no file under `src/` matches `log=1`, `LogShell`, `logFor(`; the figure and lesson pages' server files have no `log:` action.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: `npm run check` passes.** Try: a figure's Practise → its page → face → back on the figure page with the toast; a lesson's review row → its page → face → back on the lesson.
- [ ] **Step 5: Commit** `refactor(exercises): the log popup goes; every practice opens the exercise page`.

---

### Task 10: Docs and shots

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-09-28-exercise-types-design.md`, `docs/superpowers/specs/2026-11-05-levels-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `docs/superpowers/specs/2026-11-07-run-the-day-design.md` (Status), `scripts/shots/ext_today.py`, `scripts/shots/ext_practice.py`

- [ ] **Step 1: `CLAUDE.md`.** Hard rule "The type owns its popup" → **"The type owns its page's content."** (`contentFor`, `practiceFor`; pages never branch on the type). "Archive, don't delete": a day's rows (`deleteDay`) are a hard delete with Undo. Add a line: one entry per exercise per local day (`saveDay`), no "set" in the UI. Layout: `src/lib/exercises/` (`done-view.ts`, `day-entry.ts`, `saved.svelte.ts`, `page-clock.svelte.ts`; `log-view.ts` is `lastTimeParts` only; `today-pane.ts` loses the session line), `src/lib/schedule/schedule.ts` (`doneFaces`), `src/lib/server/schedule.ts` (`doneFacesOf`), the `(today)` paragraph (no `LogShell`, `frame`, `paneContent`, log popup; the pane is the page's two columns and `DoneBar`), `src/lib/sheets/` (`whenSettled`) and `src/lib/nav/trail.svelte.ts` (`backWhenSettled`), `components/exercises/` (`DoneSheet`, `SavedToast`, `DoneBar`, `HistoryDaySheet`, `DrillRecordings`, `kinds/*/Practice.svelte`). Plan 2 in the "Live" summary.
- [ ] **Step 2: Specs.** Exercise types: the popup goes, the page holds the content and Practise with, reps go, a drill's Recordings, the Done sheet. Levels (plan 1's ruling: updated here): "The simple exercise page and log popup" becomes the one page; its Done sheet has the faces and no note; the Comes back line shows at every level. Main design: Today and the log (one entry a day, the history by day). Run the day: the Status line says plan 2 is built, with what was decided (the faces replayed with the face added; the interim session).
- [ ] **Step 3: Shots.** In `ext_today.py`, every scene that drives the log popup or the pane's log form cannot run any more: replace `today-popup`, `exercise-popup-*`, `today-details-back`, `today-session-return`, `pane-logged`, `pane-logged-lit`, `pane-skip`, `pane-next`, `pane-next-room`, the `pane-session-*` scenes (walk, done, finish, reload, narrow, logged, skip-unsaved, finish-stay, resume, narrow-twice, skip-settings, skip-both) and their helpers (`_log_first`, `_logged`, `_skip`, `_details_back`, `_session_details_return`, `_sets`, `_skip_pane`, `_log_pane`, `_type_unsaved`, …) with: the page per type, the Done sheet (drill, learning drill, past day), Done today, the toast after a save, a session's second page (`today-session-pages`: Start, a face, the next page's URL carries `?session=1`). Keep `today-session` (`_start_session`, now landing on a page) for plan 3 to replace. In `ext_practice.py`, `practice-save` follows the JSON save (the toast on the page it returns to). Run them; compare with the `$M` images named in Tasks 7–8.
- [ ] **Step 4: Commit** `docs: run the day plan 2 (the one page)`.
