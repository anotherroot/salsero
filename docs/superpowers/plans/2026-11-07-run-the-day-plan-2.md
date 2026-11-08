# Run the day, plan 2: the one page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The exercise page becomes the place you practise: the running time in the band, Practise with on the page, a drill's Recordings, the H1 history, and a pinned ✓ Done that opens "How did it go?" (tap a face = save and go back, toast with Undo). One entry per exercise per day, no "set" anywhere, and the old log popup gone from every page.

**Architecture:** The data function `saveDay` keeps one `sets` row per exercise per local day (a second save updates it and hands back what it held, for Undo). PURE words (`done-view.ts`, `day-entry.ts`, `doneFaces`) decide what the page, the sheet and the history say. One `DoneSheet` component is the save everywhere (the page, a past day); a small client store (`saved.svelte.ts`) plus `SavedToast` in the `[dance]` layout shows "Saved · back in 12 days · Undo" on whatever screen comes next. The type's registry keeps owning the page's content (`contentFor`) and gains `practiceFor` for the Practise with card. `LogShell`, the per-type `Log.svelte`s and `?log=1` are deleted.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-07-run-the-day-design.md` ("No sets", "The exercise page (one page)", "The Done sheet", "Time", "Leaving the old popup", "The practice panel and the full player"). Read `CLAUDE.md` (hard rules) first. **Plan 1** (`2026-11-07-run-the-day-plan-1.md`) is built before this one; this plan assumes its Interfaces: `DueState` (`every`, `learning`) from `scheduleStates`/`scheduleStateOf`, `ComesBack`, `ExerciseItem.comesBack/warmup/warmupOrder`, `DayRow.list`, `listLabels`, G3 `STEPS`, and `PAGE_EPOCH = 7`.

**Mockups:** PNGs in `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-exercise-flow/72d7463b-31e7-40d6-976c-6196df628393/scratchpad/mock/png/` (call it `$M`; the HTML beside them in `../`), explained on the board https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs. This plan uses `page-drill`, `drill-rows`, `drill-add`, `drill-editing`, `hist-a` (H1, the chosen history), `page-lesson`, `page-figure`, `sheet-drill`, `sheet-learning`, `sheet-past-day`, `run-toast` (the toast; ignore its Skip and "4 of 7": plan 3), `desk-sheet` (the desktop pane and the sheet as a dialog; ignore Skip). Where a mock still shows "3 sets" tiles or trash on history rows, `hist-a` wins.

**Not in this plan (plan 3):** the run (Start walks warm-ups, Skip, "Next:", Done · next, Done for today, the hero's time estimate), the player's continuation and its no-faces Save for a fixed rhythm, and the desktop clock rule (here the clock starts when the page mounts, at every width). **Start session keeps working, degraded:** at both widths it walks exercise *pages* (`?session=1`), and after a face the next page opens (the last goes back to Today). There is no Skip until plan 3 (Not today still works).

## Global Constraints

- One entry per exercise per local day. A second save that day updates the day's row: time added, face and note replaced, the run's `player_json` replaced when the new save has one. Old days with several rows show merged: minutes added, the day's last rated face, the notes joined with ` · ` in time order.
- No "set" or "sets" in any UI string (labels, aria-labels, toasts, refusals). Code names (`sets` table, `HistorySet`) stay.
- Time is never typed: `duration_s` is the page's counted seconds, counted only while `document.visibilityState === 'visible'`, restarting from 0 when the page (re)mounts or another exercise opens in it. A past day saves `duration_s` null.
- Exact copy: sheet title **How did it go?**; note label **Note (optional)**, placeholder **What went well, what to fix**; **Tap a face to save it** (muted, centred, under the faces); toast **Saved · back in 12 days** / **Saved · back tomorrow** with **Undo**; past day toast **Added to Thu 5 Nov**; pinned **✓ Done**, and **Done today** once the exercise has today's entry; history tiles **N times** / **N min in all**; empty history **Nothing logged yet** / **Tap Done after you practise — it shows up here, grouped by day.**; routine **A run there saves itself. Tap Done when you practised away from the app.**
- Band subtitle: `Drill · 4:12`, `Drill · learning · 3:20`, `Drill · warm-up · 6:30` (plan 3 adds the place in a run). Sheet's muted line: the time (`4:12`); a learning drill `Learning · 2 of 3 good days`; a past day `<exercise name> · <weekdayDayMonth(day)>`.
- A face card's time comes from `doneFaces` (G3 numbers via `preview`); a learning drill's faces say **Tomorrow** except a face that finishes its learning: its gap and, on a second line, **learnt** in `text-done`; when any card has that second line, all four time rows are two lines high.
- A fixed-rhythm drill (`DueState.every !== null`): Done saves at once, no sheet, `rating` null (the server forces null whatever was posted).
- Closing the sheet (×, Back, scrim) saves nothing; a typed note makes it ask "Unsaved changes" (`use:guarded`, the hard rule).
- Data functions take `db` first; specs use `openDb(':memory:')`, never `$DATA_DIR`. Every instant is epoch ms; days via `localDay`/`noonOf`/`daysBetween`.
- A refresh after a sheet closes goes through `refreshWhenSettled()`; close-then-navigate waits for the sheet's Back (`gotoWhenSettled` / the new `backWhenSettled`).
- Raise `PAGE_EPOCH` 7 → 8 in Task 7 (the first commit that changes a log form; Tasks 8–9 ship in the same release).
- `npm run check` must pass at the end of every task. Shots (`scripts/shots/README.md`) are compared with the `$M` images named in each task.

## Review Focus

- Done twice on one day, and Done on a day that already holds several old rows: still one row is written to (the day's latest), time added, face/note replaced; Undo of the second save puts the first save's values back rather than deleting the day. → Task 1.
- A page left open while the phone is locked or the tab hidden: those minutes don't count. → Task 3 (`followVisibility`).
- A stale page or the player posting a face for a fixed-rhythm drill: stored with `rating` null; a by-how-it-went exercise posted with no face: refused, nothing stored. → Task 4.
- Undo with a forged or mismatched `before` (another exercise's snapshot, another person's set): refused, nothing changes. → Task 4.
- A group drill's page with no entry of the person's: no Done bar, no Practise with, no crash; a `done` post naming the group's drill id (not the entry) is a 404. → Task 4, Task 7 step 5.

---

### Task 1: One entry a day (data)

**Files:**
- Modify: `src/lib/server/exercises.ts` (`logSet` stays for restore; add `saveDay`, `undoSave`, `deleteDay`, `restoreSets`; change `exerciseSummary`)
- Modify: `src/lib/types.ts` (`ExerciseSummary`)
- Modify: `src/lib/server/log-form.ts` (`logSetFrom` writes through `saveDay`), `src/routes/[dance]/player/+page.server.ts` (`save` writes through `saveDay`)
- Test: `src/lib/server/exercises.spec.ts`, `src/lib/server/data.spec.ts` (the `exerciseSummary` cases), `src/lib/server/log-form.spec.ts`

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
  export interface ExerciseSummary { times: number; totalS: number } // times: distinct local days
  ```
  (`SetRow` is the `sets` select type; name it `typeof sets.$inferSelect` if no alias exists.)
- Update rule (`saveDay` on an existing day row): `durationS` = old + new (null only when both are null); `rating` = new; `note` = new (`''` → null); `playerJson` = new ?? old; `reps` and `doneAt` kept. Other rows of that day are left alone.

- [ ] **Step 1: Write the failing tests** (`TZ = 'Europe/Ljubljana'`, `openDb(':memory:')`, an exercise from the spec's existing helpers):
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
  it('a back-filled day merges into that day', () => { /* doneAt noonOf('2026-11-05') twice → one row */ });
  it('undoSave of a first save deletes it; of a second puts the first back', () => { /* … */ });
  it('undoSave refuses a before of another exercise', () => expect(undoSave(db, id, { ...snap, exerciseId: other })).toBe(false));
  it('deleteDay deletes that day only and restoreSets brings it back', () => { /* two rows on 15 Oct, one on 16 Oct */ });
  it('exerciseSummary counts days, not rows', () => {
  	// rows on 15 Oct (240 s, 120 s) and 16 Oct (300 s)
  	expect(exerciseSummary(db, ex, TZ)).toEqual({ times: 2, totalS: 660 });
  });
  ```
  In `log-form.spec.ts`: a second `logSetFrom` the same day leaves one row; the response carries `setId` and `before` (a JSON string, or null). Rewrite `data.spec.ts`'s two `exerciseSummary` expectations to `{ times, totalS }`.
- [ ] **Step 2: Run `npx vitest run src/lib/server` — the new cases FAIL.**
- [ ] **Step 3: Implement.** Find the day's rows by selecting the exercise's sets in `[noonOf(day) - DAY_MS, noonOf(day) + DAY_MS)` and filtering with `localDay` (the `listSetsBetween` rule: the day boundary decided in one place). `saveDay` and `deleteDay` run in one transaction. `logSetFrom` and the player's `save` call `saveDay(getDb(), …, tz)`; `logSetFrom` returns `{ action: 'log', ok: true, setId, before: before && JSON.stringify(before) }`. The exercise page's `summary` reads `exerciseSummary(db, id, tz)` (and `{ times: 0, totalS: 0 }` for a drill with no entry); fix its uses of `summary.sets` → `summary.times` (`archiveBody`, the tiles) so `npm run check` passes.
- [ ] **Step 4: `npx vitest run src/lib/server` PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): one entry per exercise per day`.

---

### Task 2: The faces (PURE)

**Files:**
- Modify: `src/lib/schedule/schedule.ts` (add `DoneFace`, `doneFaces`), `src/lib/schedule/schedule.spec.ts`
- Modify: `src/lib/exercises/face-view.ts` (`faceColumns`), `src/lib/exercises/face-view.spec.ts`
- Modify: `src/lib/components/exercises/FaceRating.svelte`

**Interfaces:**
- Consumes: plan 1's `DueState`.
- Produces:
  ```ts
  export interface DoneFace extends FacePreview { learnt: boolean }
  /** What each face would set today, as the Done sheet shows it; null for a fixed rhythm (no faces). `state` is the start-of-day state. */
  export function doneFaces(state: DueState, today: string): DoneFace[] | null;
  // face-view.ts
  export interface FaceColumn { feel: Feel; word: string; time: string | null; learnt: boolean }
  export function faceColumns(preview: (FacePreview & { learnt?: boolean })[] | null): FaceColumn[];
  ```
  Rule: not learning → `preview(state, today).faces` with `learnt: false`. Learning (`state.learning = { good, of }`): a face with `RATING_OF[feel] >= 4` and `good + 1 >= of` keeps `preview`'s gap and `learnt: true`; every other face is `{ gap: 1, learnt: false }`.
- `FaceRating` gains `hideQuestion?: boolean` (the legend becomes `sr-only`: the sheet's title asks) and `busy?: Feel | null` (while a face's save is in flight: every card disabled, that one `aria-busy`), and draws a column's `learnt` as a second line **learnt** in `text-done` under the time; the grid's third row is `2.6em` when any column is learnt (else `1.4em` as now). Its other props and the hidden `rating` input stay (the player's Save sheet uses it).

- [ ] **Step 1: Write the failing tests:**
  ```ts
  const learning = (good: number) => ({ gap: 3, lastDay: '2026-11-06', dueDay: '2026-11-07', every: null, learning: { good, of: 3 as const } });
  it('a learning drill one good day short: the good faces finish it', () => {
  	expect(doneFaces(learning(2), '2026-11-07')).toEqual([
  		{ feel: 'hard', gap: 1, learnt: false }, { feel: 'getting', gap: 1, learnt: false },
  		{ feel: 'gotit', gap: 3, learnt: true }, { feel: 'easy', gap: 7, learnt: true }
  	]);
  });
  it('two good days short: all four say tomorrow', () =>
  	expect(doneFaces(learning(1), '2026-11-07')!.map((f) => [f.gap, f.learnt])).toEqual([[1, false], [1, false], [1, false], [1, false]]));
  it('not learning: preview\'s gaps', () => { /* learning: null → preview(state, today).faces with learnt false */ });
  it('a fixed rhythm has no faces', () => expect(doneFaces({ ...learning(0), learning: null, every: 2 }, '2026-11-07')).toBeNull());
  // face-view.spec.ts
  it('a learnt column', () => expect(faceColumns([{ feel: 'gotit', gap: 3, learnt: true }])[2]).toEqual({ feel: 'gotit', word: 'I’ve got it', time: '3 days', learnt: true }));
  ```
  (Use `FEEL_WORD.gotit` for the word rather than retyping its apostrophe.)
- [ ] **Step 2: `npx vitest run src/lib/schedule src/lib/exercises/face-view.spec.ts` — FAIL.**
- [ ] **Step 3: Implement `doneFaces`, `faceColumns`, and FaceRating's two props.** Look: `$M/sheet-learning.png`.
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(schedule): the Done sheet's faces, learning ones say when it's learnt`.

---

### Task 3: The page's words and the clock (PURE)

**Files:**
- Create: `src/lib/exercises/day-entry.ts` (+ spec), `src/lib/exercises/done-view.ts` (+ spec)
- Modify: `src/lib/exercises/exercise-page.ts` (+ spec), `src/lib/exercises/stopwatch.ts` (+ spec), `src/lib/exercises/today.ts` (`pastGroups`; + spec), `src/lib/exercises/today-pane.ts` (`dayTotals`; + spec), `src/lib/player/view.ts` (`runSummary`; + spec)
- Modify: `src/lib/components/ui/styles.ts` (`ButtonKind` gains `'done'`), `src/lib/components/ui/styles.spec.ts`
- Modify: `src/lib/components/today/PastDay.svelte` (draws `pastGroups`' merged entry)

**Interfaces:**
- Produces (`day-entry.ts`):
  ```ts
  export interface DayEntry { durationS: number | null; reps: number | null; rating: number | null; note: string | null }
  /** A day's rows as one: minutes and reps added (null when none has any), the last rated face, notes joined " · " in time order. Rows in any order. */
  export function mergeDay(rows: { doneAt: number; durationS: number | null; reps: number | null; rating: number | null; note: string | null }[]): DayEntry;
  ```
- Produces (`done-view.ts`):
  ```ts
  export function bandSubtitle(i: { label: string; warmup: boolean; learning: boolean; seconds: number }): string;
  export function doneSubtitle(i: { seconds: number | null; learning: { good: number; of: 3 | 5 } | null; day: string | null; name: string }): string;
  export function savedMessage(backDays: number): string;   // "Saved · back in 12 days"
  export function addedMessage(day: string): string;        // "Added to Thu 5 Nov" (dayLabel)
  export function doneBar(i: { doneToday: boolean; playing: boolean }): { label: 'Done' | 'Done today'; kind: 'primary' | 'done'; disabled: boolean; hint: string | null };
  ```
- Produces (`exercise-page.ts`): `historyTiles(s: ExerciseSummary): { value: string; label: string }[]`; `historyRows(history: HistorySet[], tz: string, today: string): HistoryDay[]` with `HistoryDay = { day: string; label: string; amount: string | null; feel: Feel | null; note: string | null }` (`amount`: `setSummary` of the merged entry without the face, e.g. `"6 min"`, `"6 min · 40 reps"` for old reps; null when empty); `archiveBody(name, times)` → `"<name> leaves Today and every list. Its history is kept."` when `times > 0`. `PageParts` loses `logButton` and `setList`. `summaryTiles`, `historyDays`, `setTitle`, `setMeta` are deleted.
- Produces (`stopwatch.ts`): `followVisibility(w: Stopwatch, visible: boolean, now: number): Stopwatch` (start when visible, pause when hidden).
- Changes: `pastGroups` returns one `{ exerciseId, name, entry: DayEntry }` per exercise (merged); `dayTotals` drops the sets count (`"7 exercises · 1 h 05"`); `runSummary` drops `'logged as a set'` (`"3:42 · 12 figures called"`); `undoLogMessage` is deleted in Task 8 (its last user goes there).
- `button('done', …)`: `bg-done-soft text-done` plus the shared disabled colours.

- [ ] **Step 1: Write the failing tests** (exact values):
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
  expect(doneBar({ doneToday: true, playing: false })).toEqual({ label: 'Done today', kind: 'done', disabled: false, hint: null });
  expect(doneBar({ doneToday: false, playing: true })).toEqual({ label: 'Done', kind: 'primary', disabled: true, hint: 'Stop the count first.' });
  // exercise-page
  expect(historyTiles({ times: 3, totalS: 1020 })).toEqual([{ value: '3', label: 'times' }, { value: '17 min', label: 'in all' }]);
  expect(historyTiles({ times: 1, totalS: 0 })[0]).toEqual({ value: '1', label: 'time' });
  // historyRows: two rows on 2026-10-15 (240 s gotit at 10:00, 120 s getting at 21:00, note 'Lost the clave') →
  //   [{ day: '2026-10-15', label: 'Thu 15 Oct', amount: '6 min', feel: 'getting', note: 'Lost the clave' }];
  //   a row on 2025-12-31 with today 2026-11-07 → label 'Wed 31 Dec, 2025'; newest day first
  // stopwatch
  expect(followVisibility({ bankedMs: 5000, runningSince: 1000 }, false, 3000)).toEqual({ bankedMs: 7000, runningSince: null });
  expect(followVisibility({ bankedMs: 7000, runningSince: null }, true, 9000)).toEqual({ bankedMs: 7000, runningSince: 9000 });
  // dayTotals: 3 rows of 2 exercises, 3900 s → '2 exercises · 1 h 05'; runSummary(222, 12) → '3:42 · 12 figures called'
  // styles.spec: button('done') contains 'bg-done-soft' and 'text-done'
  ```
  Rewrite or delete the old `summaryTiles`/`historyDays`/`setTitle`/`setMeta`/`pastGroups` cases.
- [ ] **Step 2: `npx vitest run src/lib/exercises src/lib/player src/lib/components/ui/styles.spec.ts` — FAIL.**
- [ ] **Step 3: Implement.** `PastDay.svelte` draws one line per exercise from `entry` (`setSummary(entry) || 'Done'`, the note under it) and `exercise-page.ts`'s callers compile (the page's history is redrawn in Task 7; until then keep it compiling with the new functions).
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): the one page's words, merged days, the visible-only clock`.

---

### Task 4: The save, its Undo and a day's delete (form side)

**Files:**
- Modify: `src/lib/server/log-form.ts` (replace `logSetFrom`/`deleteSetFrom`/`restoreSetFrom` with the four below; `parseSetSnapshot` stays, add `parseSetSnapshots`)
- Modify: `src/routes/[dance]/(today)/+page.server.ts` (add actions `done`, `undoDone`; `log`, `deleteSet`, `restoreSet` stay until Task 8 removes the popup and the layout's Undo that post to them)
- Modify: `src/routes/[dance]/player/+page.server.ts` (`save` answers JSON, no redirect), `src/lib/components/player/SaveSetSheet.svelte` (`onsaved` gets the result)
- Test: `src/lib/server/log-form.spec.ts`, `src/routes/[dance]/player/save.spec.ts`, `src/routes/[dance]/today-actions.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`saveDay`, `undoSave`, `deleteDay`, `restoreSets`), plan 1's `scheduleStateOf` (`DueState`).
- Produces:
  ```ts
  /** Fields: exerciseId, durationS (0..86400, optional), rating (1..5, optional), note (≤2000), run (≤4000, dropped when longer), day (a past day: backfill at noon, no run, no time). */
  export async function saveDoneFrom(e: LogEvent): Promise<ActionFailure<{ action: 'done'; message: string }> | DoneResult>;
  export type DoneResult = { action: 'done'; ok: true; setId: number; before: string | null; backDays: number | null };
  /** Fields: setId, before ('' = null). */
  export async function undoDoneFrom(e: LogEvent): Promise<…{ action: 'undoDone'; ok: true }>;
  /** Fields: exerciseId, day. Answers { action: 'deleteDay', ok: true, snapshots: string } (JSON array). */
  export async function deleteDayFrom(e: LogEvent): Promise<…>;
  /** Fields: snapshots. */
  export async function restoreDayFrom(e: LogEvent): Promise<…>;
  export function parseSetSnapshots(raw: string, now: number): SetSnapshot[] | null; // all valid, one exerciseId, else null
  ```
  `DoneResult` also goes in `src/lib/types.ts` (client-safe) for the sheet.
- Rules: the exercise is `requireExerciseInWall` (a group's row is a 404). Fixed rhythm (`scheduleStateOf(...).every !== null`) → `rating` stored null whatever was posted; otherwise a missing rating is `fail(400, { action: 'done', message: 'Pick how it went' })`. `backDays` = `daysBetween(today, scheduleStateOf(db, id, tz).dueDay)` after the save; null for a past day. `undoDoneFrom`: the set must be the wall's (`getSet` then `requireExerciseInWall`), `before` must parse and name the same exercise, else `fail(400, { action: 'undoDone', message: 'Could not undo that. Try again.' })`.
- Player `save`: `saveDay` (reps null), then `{ ok: true, setId, before, backDays }`; `SaveSetSheet` calls `onsaved(result: DoneResult)` on a `success` result (was: on `redirect`); the player page leaves as now and, from Task 5 on, announces the save first. Until Task 5 the player's save shows no toast; Today's `?logged=` handling is removed in Task 8.

- [ ] **Step 1: Write the failing tests** (`log-form.spec.ts`, the existing mock-`getDb` pattern):
  - `saveDoneFrom` with `{ exerciseId, durationS: '252', rating: '4', note: 'ok' }` → one row `{ durationS: 252, rating: 4, note: 'ok' }`, `before: null`, `backDays: 3` (a new drill, G3 "I've got it" first gap; compute it from `STEPS` in the test, not by hand-typing).
  - a fixed-rhythm drill (`comes_back` `{"kind":"every","days":2}`) posted with `rating: '5'` → stored `rating: null`, `backDays: 2`.
  - by how it went with no rating → 400 "Pick how it went", nothing stored.
  - `day: '2026-11-05'` (a past day) → `doneAt === noonOf('2026-11-05', TZ)`, `durationS` null even when posted, `playerJson` null, `backDays: null`.
  - posting the group drill's own id (not the member's entry; `test-class.ts`) → 404, nothing stored.
  - `undoDoneFrom` with a `before` of another exercise → 400, the row unchanged; with another person's `setId` → 404.
  - `deleteDayFrom` then `restoreDayFrom` with its `snapshots` → the day's rows back.
  - `save.spec.ts`: a saved run answers `{ ok: true, setId, before: null, backDays }` (no redirect); a second run that day leaves one row.
- [ ] **Step 2: `npx vitest run src/lib/server/log-form.spec.ts "src/routes/[dance]"` — FAIL.**
- [ ] **Step 3: Implement; wire Today's `done` and `undoDone`.** The exercise, figure and lesson pages and Today's popup still post the old actions: keep `logSetFrom`, `deleteSetFrom`, `restoreSetFrom` (writing through `saveDay`, Task 1) until Tasks 7–9 remove their last users; Task 9 deletes them.
- [ ] **Step 4: PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(log): save a day, undo it, delete a day`.

---

### Task 5: The Done sheet, the saved toast, the page clock

**Files:**
- Create: `src/lib/components/exercises/DoneSheet.svelte`, `src/lib/components/exercises/SavedToast.svelte`, `src/lib/exercises/saved.svelte.ts`, `src/lib/exercises/page-clock.svelte.ts`
- Modify: `src/routes/[dance]/+layout.svelte` (mount `<SavedToast />` once), `src/lib/sheets/history.svelte.ts` (add `backWhenSettled`), `src/routes/[dance]/player/+page.svelte` (`onsaved` announces)
- Test: `src/lib/components/today/today-forms.spec.ts` (source checks, the file's existing style)

**Interfaces:**
- Consumes: Task 2 (`DoneFace`, FaceRating's `hideQuestion`), Task 3 (`savedMessage`), Task 4 (`DoneResult`, Today's `undoDone`).
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
  // history.svelte.ts
  /** Close-then-back: once the sheets' Back has landed, the band's back (`goBack`), dropping a refresh owed for a form sent in the sheet. */
  export function backWhenSettled(fallback: { href: string; label: string }): Promise<void>;
  ```
- DoneSheet: a `Sheet` (auto height, not `tall`) titled **How did it go?** with `sub={subtitle}`; body: Note (one line that grows, `TEXTAREA`, `rows=1`, min-h 52px) unless `simple`, then `FaceRating hideQuestion` with `preview={faces}`, then **Tap a face to save it**. One `<form method="POST" {action} use:guarded>` (label `'How did it go?'`; dirty only by the note): hidden `exerciseId`, `durationS` (from `seconds` at submit, omitted when null), `run`, `day`, `rating`. A face tap sets the rating and `requestSubmit()`s; while sending, the faces are disabled and the tapped one shows `aria-busy`. A refusal shows as a `Banner` in the sheet. No footer. On desktop it is the centred dialog every Sheet already is (`$M/desk-sheet.png`).
- SavedToast: the app's `Toast` with `saved.current`; Undo posts `actAt('/' + dance, 'undoDone', { setId, before: before ?? '' })` and shows its refusal (`refusalMessage(result, 'Could not undo that. Try again.')`) as a plain toast. It is drawn above a pinned bar the way the exercise page's toast is (`bottom` with `--pin-bottom`).
- pageClock: `stopwatch.ts` state, `followVisibility` on `visibilitychange`, a 1 s tick only while visible, started on mount.

- [ ] **Step 1: Write the failing source checks** in `today-forms.spec.ts` (read the file as text, as the spec does for LogShell now): DoneSheet posts to its `action` prop, never a bare `?/…`; uses `use:guarded`; contains `Tap a face to save it`; SavedToast posts `undoDone` through `actAt`.
- [ ] **Step 2: Run — FAIL. Step 3: Implement**, and have the player's `onsaved(r)` call `announceSaved({ dance, message: savedMessage(r.backDays ?? 1), undo: { setId: r.setId, before: r.before } })` before it leaves.
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): the Done sheet and the saved toast`.

---

### Task 6: Practise with on the page, a drill's Recordings

**Files:**
- Modify: `src/lib/components/exercises/kinds/index.ts` (`ContentProps`, add `practiceFor`, drop `logFor` in Task 9)
- Create: `src/lib/components/exercises/kinds/drill/Practice.svelte`, `kinds/figure/Practice.svelte`, `kinds/routine/Practice.svelte`, `src/lib/components/exercises/DrillRecordings.svelte`
- Modify: `kinds/drill/Content.svelte`, `kinds/figure/Content.svelte`, `kinds/routine/Content.svelte`, `kinds/lesson/Content.svelte` (prop changes only), `src/lib/components/figures/AddRecordingSheet.svelte` (`video?: boolean`)
- Modify: `src/lib/exercises/kinds.ts` (`TypeInfo` = `{ type, label }`; `LogField`, `fields`, `ratingQuestion`, `paneContent`, `hasField` go), `src/lib/exercises/kinds.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ContentProps {
  	dance: Dance; content: PracticeContent; timezone: string;
  	canEdit?: boolean; simple?: boolean;
  	/** The Practise with card, drawn right after the type's description (drill: Description; figure: the reference notes; routine: its notes). A lesson has none. */
  	practice?: Snippet;
  	/** A drill's Recordings' + Add, or null when the person may not add (a reader, the simple page). */
  	recordings?: { label: string; linkable: SectionGroup[]; message: string | null; entered: string } | null;
  }
  export interface PracticeProps {
  	dance: Dance; exercise: ExerciseItem; content: PracticeContent;
  	songs: PickerSong[]; takes: CountTakeRow[];
  	onrun: (r: { durationS: number; playerJson: string }) => void;
  	onactive: (playing: boolean) => void;
  }
  export const practiceFor: (type: ExerciseType) => Component<PracticeProps> | null; // lesson → null
  ```
  `onPage` and `editLinks` leave `ContentProps` (the content is always the page's now).
- `drill/Practice` and `figure/Practice` are today's `drill/Log.svelte` / `figure/Log.svelte` panel snippets as components (`PracticePanel`; the figure's `cue` from `content.figure`). `routine/Practice` is the "Practise in player" link (`from=exercise`) and the line **A run there saves itself. Tap Done when you practised away from the app.**
- `DrillRecordings.svelte` props: `{ sections: LinkedSection[]; links: LinkRow[]; canEdit: boolean; editing: boolean; recordings: ContentProps['recordings'] }`. Not editing: heading `recordingsTitle(n)` with **+ Add** (when `recordings` is non-null), one `GROUP` card of `SectionRow`s then `LinkRow`s (`canSave={false}`: a drill holds no video of its own); hidden by `showRecordings({ canEdit, items })`. + Add opens `AddRecordingSheet` with `video={false}` and `figureLabel={recordings.label}` ("Add to <drill>"), whose Link a section opens `LinkSectionSheet` (`groups={linkable}`, posts `?/linkSection`) and Link opens `AddLinkSheet` (`action="?/addLink"`). Editing: the same card with each section's **Unlink** (`?/unlinkSection`, `focusAfterRemoval` as the drill content does now) and each link's trash (`LinkRow editing`, `?/deleteLink`). Look: `$M/drill-rows.png`, `$M/drill-add.png`, `$M/drill-editing.png`.
- `drill/Content`: Description (`SECTION_LABEL` + text), `practice`, then `<DrillRecordings editing={false}>`. The old "Link a section…" opener, the Sections heading and `LinksEditor` go.

- [ ] **Step 1: Failing tests:** `kinds.spec.ts`: `TYPES.drill` is `{ type: 'drill', label: 'Drill' }`; a source check that `kinds/index.ts` maps `lesson` to no practice. **Step 2: FAIL. Step 3: Implement** (the page still renders through these props after Task 7; keep the old exercise page compiling by passing the new props). **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): Practise with on the page; a drill's Recordings`.

---

### Task 7: The exercise page is the one page

**Files:**
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte`, `+page.server.ts`
- Create: `src/lib/components/exercises/DoneBar.svelte`, `src/lib/components/exercises/HistoryDaySheet.svelte`
- Modify: `src/lib/page-epoch.ts` (7 → 8)
- Test: `src/routes/[dance]/owner-wall.spec.ts` / `dance-wall.spec.ts` where they name the page's `log`, `deleteSet`, `restoreSet` actions (`grep -rn "deleteSet\|restoreSet\|'log'" "src/routes/[dance]"`)

**Interfaces:**
- Consumes: Tasks 1–6, plan 1's `DueState` (`data.scheduleAtStart`).
- Produces: actions `done` (`saveDoneFrom`), `deleteDay`, `restoreDay` on the page (`log`, `deleteSet`, `restoreSet` go). Load: drop `canLog`-free leftovers of the pane (`songs`/`takes` stay for the panel); `summary` per Task 1; `entryToday: DayEntry | null` (`mergeDay` of `popup.sets`, null when none).
- `DoneBar.svelte`: a `BottomBar` (`width="two"`, no `desk:hidden`: it pins to the pane on desktop) with `left?: Snippet` beside the main button (plan 3 puts Skip there, two `rowButton`s) and the main button from `doneBar()` (`button(view.kind, 'md', true)`, `check` icon), its hint under it.
- `HistoryDaySheet.svelte`: `Sheet size="small"` titled with the row's label; the day's amount, face word and note; **Delete this day** (`button('danger-text')`) posting `?/deleteDay` (`exerciseId`, `day`) with `use:enhance`. The page's toast says **<label> deleted** with **Undo** → `act('restoreDay', { snapshots })`.

Page, top to bottom (`$M/page-drill.png`, `$M/hist-a.png`, `$M/page-lesson.png`, `$M/page-figure.png`; desktop `$M/desk-sheet.png`):
- Band subtitle `bandSubtitle({ label: TYPES[type].label, warmup: exercise.warmup, learning: !!data.scheduleAtStart?.learning, seconds: clock.seconds })` while `canLog`; while editing, or on a group drill without an entry, the type label alone; the clone line still wins when `cloneSubtitle` has one. `LastTime` and the session `line` stay under the band.
- Phone, one column: owner row, the type's `Content` (with `practice` = `practiceFor(type)` rendered with the page's `songs`/`takes`, `onrun` → `run`, `onactive` → `playing`; only when `canLog`) and `recordings` (when `canEditContent && !simple`: `{ label: title, linkable: data.linkable, message: failure('addLink') ?? failure('linkSection'), entered }`), from class, comments, the Add block, Music, History, Settings, Not today. Desktop (`PaneColumns ratio="1:1"`): left = owner row … Add block; right = Music, History, Settings, Not today. `logColumn`, `contentLeft` and the Log popup go; Not today is one button at the end at both widths.
- History (H1, `parts.historyTiles`): two tiles from `historyTiles` (28px numbers), then one `GROUP` card, a row per `historyRows` day: label bold left, `amount` muted right then `Face` (22px) in its colour, the note muted under; the row is a button opening `HistoryDaySheet`. No trash. Empty: `EmptyState` with the Global Constraints' words. "Showing the latest N" stays when `history` was cut.
- Pinned: `DoneBar` when `canLog` and not editing; edit mode keeps its Save bar. Done:
  - fixed rhythm (`data.scheduleAtStart?.every != null`): `act('done', { exerciseId, durationS: clock.seconds, run: run?.playerJson ?? '', rating: '' })`, then `saved()`;
  - else opens `DoneSheet` with `action="?/done"`, `faces = data.scheduleAtStart ? doneFaces(data.scheduleAtStart, data.today) : null`, `subtitle = doneSubtitle({ seconds: clock.seconds, learning: data.scheduleAtStart?.learning ?? null, day: null, name: title })`, `current = data.entryToday`, `simple`.
  - `saved(r)`: `announceSaved({ dance, message: savedMessage(r.backDays ?? 1), undo: { setId: r.setId, before: r.before } })`; `today?.logged(clock.seconds)`; in a session `today.session.next ? today.session.onnext() : today.session.onfinish()`; otherwise `backWhenSettled({ href: Today, label: 'Back to Today' })`. Then `clock.restart()`.
- Edit mode (a drill the person may edit): after the settings card(s), `DrillRecordings editing` when it has rows (`$M/drill-editing.png`), then Archive.
- Another exercise opened in the page (`pageId` changes): `clock.restart()`, the sheet closes, `run` and `playing` reset (the existing `$effect.pre` block). `?log=1` is no longer read.
- Simple page (`pageParts(simple, …)`): the same page, the same Done and sheet (no note), no history.

- [ ] **Step 1: Failing route test:** the page's `done` action on a member's group-drill page saves on the member's entry (the posted `exerciseId`), and the group's drill id posted there is a 404 (Review Focus). Update the wall specs' action names.
- [ ] **Step 2: Run — FAIL. Step 3: Implement; raise `PAGE_EPOCH` to 8.**
- [ ] **Step 4: `npm run check` passes. Shots:** the exercise page for a drill (with sections and a link), a lesson review, a figure, a routine, a learning drill's sheet, a group drill without an entry, at 390 and 1440; compare with `page-drill`, `drill-rows`, `hist-a`, `page-lesson`, `page-figure`, `sheet-drill`, `sheet-learning`, `desk-sheet`. Try in the dev server: the band's time stops while the tab is hidden; Done → face → back where it was opened, toast, Undo puts it back; Done again → **Done today** → sheet with the face lit → one row, time added.
- [ ] **Step 5: Commit** `feat(exercises): one page — practise, Done, and the history by day`.

---

### Task 8: Today: rows open the page, a past day's Done, the session walks pages

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte`, `+layout.server.ts`, `+page.svelte`
- Modify: `src/lib/components/today/today-context.ts`, `TodayList.svelte`, `ExerciseRow.svelte`, `PastDay.svelte`
- Modify: `src/lib/exercises/today.ts` (delete `undoLogMessage`), its spec
- Test: `src/routes/[dance]/today-layout.spec.ts`, `src/lib/components/today/today-forms.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // today-context.ts (SessionControls moves here from LogShell)
  export interface SessionControls { next: { name: string } | null; onnext: () => void; onfinish: () => void }
  export interface TodayPane {
  	readonly session: SessionControls | null;
  	readonly line: string | null;
  	logged(durationS: number | null): void;
  	canSkip(exerciseId: number): boolean;
  	notToday(exerciseId: number): Promise<boolean>;
  }
  ```
  (`follow`, `key`, `undoable`, `toast`, `dismissToast`, `pagePopup` go.)
- Today's `+page.server.ts`: the `log`, `deleteSet` and `restoreSet` actions go (nothing posts them now).
- Layout: the phone popup, `openId`, `openSets`, `Log`, `skipped`, `sessionEnded`, `bumpKey`, the narrowing effects and `?logged=` handling go. `openRow(id, how)` navigates at both widths to `at(id, '?session=1')` (Start and Resume push; Next replaces). `nextInSession(walkRows, new Set(), current)` with `current = currentId`. `endSession` goes to Today. The list load drops `songs`, `takes`, `schedulesAtStart`.
- `ExerciseRow`: the "+" button and `onlog` go; the link ends in a muted `chevron-right` (`text-chevron`, as the lesson rows) at every width. `TodayList` loses `onlog`.
- Past day (`+page.svelte`): PastDay's `onlog(id)` opens `DoneSheet` with `action="/{dance}?/done"`, `day={past.day}`, `seconds={null}`, `faces={null}`, `subtitle={doneSubtitle({ seconds: null, learning: null, day: past.day, name })}`, `current` = that exercise's merged entry that day (or null), `simple`; `onsaved` closes it and `announceSaved({ dance, message: addedMessage(past.day), undo })`. PastDay's words: the + is **Add {name} to this day**, the picker title **Add to {dayLabel(day)}**, headings unchanged. Look: `$M/sheet-past-day.png`.

- [ ] **Step 1: Failing tests:** `today-forms.spec.ts`: a past day's DoneSheet posts to `/{dance}?/done`; `ExerciseRow.svelte` has no `Log a set`; `today-layout.spec.ts` cases that opened the popup are rewritten to the page (`?session=1` on the next row's URL).
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: `npm run check` passes.** Try at 390 and 1440: Start session → first page → face → next page → … → last face → Today; a row tap → page → face → back to Today with the toast; a past day's +.
- [ ] **Step 5: Commit** `feat(today): rows open the exercise; a past day's Done; the session walks pages`.

---

### Task 9: The popup goes everywhere else

**Files:**
- Modify: `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/lessons/[id]/+page.svelte`, `+page.server.ts`
- Delete: `src/lib/components/exercises/LogShell.svelte`, `kinds/*/Log.svelte`, `SetList.svelte`, `restore-set.ts`, `restore-set.spec.ts`, `fetch-practice.ts`; the `GET` in `src/routes/[dance]/(today)/exercises/[id]/practice/+server.ts` (its `POST` stays); `footerFor`, `fieldsShown`, `rangeError` in `src/lib/exercises/log-view.ts` (keep `lastTimeParts`) and their spec cases; `logSetFrom`, `deleteSetFrom`, `restoreSetFrom`
- Modify: `src/lib/components/exercises/kinds/index.ts` (`logFor`, `LogProps` go), `src/lib/components/ui/focus-clip.spec.ts` (LogShell's entry), `src/routes/dev/kit/+page.svelte` ("set" words)

**Interfaces:**
- Figure page: `FigureLog`, `logging`, `data.popup`, `scheduleAtStart` and the `log`/`deleteSet`/`restoreSet` actions go. The reader's pinned **Practise** is a link to the exercise page whenever `data.exercise`; without one, the `practise` form's success `goto`s the new exercise's page (the action returns `{ action: 'practise', ok: true, exerciseId }`). `practice` (the ⋯ menu's line) is built from the exercise without `popup`.
- Lesson page: `LessonLog`, `logging`, `data.popup` (and `scheduleAtStart` if nothing else reads it) and the three actions go. The review row is shown when `data.exercise` (was `&& data.popup`); its "+" becomes a muted chevron inside its link. The linked exercises' `?log=1` "+" goes; each row's link ends in a chevron.
- Sweep: `grep -rn -i -E "\b(a set|sets?)\b" src --include='*.svelte'` and string literals in `src/lib` (exclude code names): every UI string loses "set" (e.g. songs page delete body: **Your history with it stays.**; lesson archive body: **The videos, links and history are kept.**; kit samples).

- [ ] **Step 1: Failing source checks** (a spec beside `today-forms.spec.ts`): no file under `src/` matches `log=1`, `LogShell`, `logFor(`; the figure and lesson pages' server files have no `log:` action.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: `npm run check` passes.** Try: a figure's Practise → its page → face → back on the figure page with the toast; a lesson's review row → its page → face → back on the lesson.
- [ ] **Step 5: Commit** `refactor(exercises): the log popup goes; every practice opens the exercise page`.

---

### Task 10: Docs and shots

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-09-28-exercise-types-design.md`, `docs/superpowers/specs/2026-11-05-levels-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `scripts/shots/ext_today.py`, `scripts/shots/ext_practice.py`

- [ ] **Step 1: `CLAUDE.md`.** Hard rule "The type owns its popup" → **"The type owns its page's content."** (`contentFor`, `practiceFor`; pages never branch on the type). "Archive, don't delete": a day's rows (`deleteDay`) are a hard delete with Undo. Add a line: one entry per exercise per local day (`saveDay`), no "set" in the UI. Layout: `src/lib/exercises/` (`done-view.ts`, `day-entry.ts`, `saved.svelte.ts`, `page-clock.svelte.ts`; `log-view.ts` is `lastTimeParts` only), the `(today)` paragraph (no `LogShell`, `frame`, `paneContent`; the pane is the page's two columns and `DoneBar`), `src/lib/sheets/` (`backWhenSettled`), `components/exercises/` (`DoneSheet`, `SavedToast`, `DoneBar`, `HistoryDaySheet`, `DrillRecordings`).
- [ ] **Step 2: Specs.** Exercise types: the popup goes, the page holds the content and Practise with, reps go, a drill's Recordings, the Done sheet. Levels: "The simple exercise page and log popup" becomes the one page; its Done sheet has the faces and no note. Main design: Today and the log (one entry a day, the history by day).
- [ ] **Step 3: Shots.** Replace the popup scenes in `ext_today.py` (`today-popup`, `exercise-popup-*`, `_log_first`, `_logged`, `_details_back`, `_session_details_return`, the pane's "Log set" checks) with: the page per type, the Done sheet (drill, learning drill, past day), Done today, the toast after a save, a session's second page. Run them; compare with the `$M` images named in Tasks 7–8.
- [ ] **Step 4: Commit** `docs: run the day plan 2 (the one page)`.
