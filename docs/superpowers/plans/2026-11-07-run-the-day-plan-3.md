# Run the day, plan 3: the run

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start (the hero's play) walks the day: the warm-ups in their order, then the Practice rows, one exercise page after another (Skip | Done, "3 of 7" in the band, "Next: …" in the Done sheet), and ends on a **Done for today** screen. The hero estimates the time. The full-screen player continues the run, and saves a fixed-rhythm drill without faces. On the desktop the auto-opened exercise doesn't start the clock.

**Architecture:** The run is the URL (`?run=1&skip=3,5` on an exercise page) plus Today's rows, worked out by PURE functions (`session.ts`, a new `run.ts`), so nothing is stored and a reload keeps it. The (today) layout replaces its old session state with a `run` entry in the `TodayPane` context, which the exercise page (built by plan 2) uses for its pinned bar, its band subtitle, its Done sheet line and where it goes after a save. Done for today is a route in the (today) group (`/[dance]/done`), drawn from the layout's day. The player's save works out the next exercise on the server and redirects there.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-07-run-the-day-design.md` ("The run", "The practice panel and the full player", "Desktop", "Time"). The board with every screen: https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs. Mockup PNGs, by id, in `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-exercise-flow/72d7463b-31e7-40d6-976c-6196df628393/scratchpad/mock/png/<id>.png`: `today`, `today-warmup-done`, `run-drill`, `run-regular`, `run-toast`, `run-routine`, `sheet-drill`, `player-save-regular`, `done-for-today`, `desk-today`, `desk-sheet`. Read `CLAUDE.md` (hard rules) first.

**Builds on:** plan 1 (`docs/superpowers/plans/2026-11-07-run-the-day-plan-1.md`: `DayRow.list`, warm-ups first in `DayList.rows`, `DueState` with `every`/`learning`, `ExerciseItem.comesBack`/`warmup`, `todayHero`'s "N for today") and plan 2 (`docs/superpowers/plans/2026-11-07-run-the-day-plan-2.md`: the one page). Both are merged before this plan starts.

## Consumes from plan 2 (seams to reconcile)

Plan 3 assumes these exist after plan 2. Where plan 2 names them differently, use plan 2's names; where one is missing, the task that needs it adds it.

1. **The page clock** — the exercise page's visible-time clock (counts only while the page is visible), as one object with `readonly seconds: number` and an idempotent `start(): void`, which **can be created idle** (not counting until `start()`). Assumed name: `pageClock({ idle }: { idle: boolean })` in `src/lib/exercises/page-clock.svelte.ts`. Task 7 needs the idle mode; if plan 2's clock always starts at once, Task 7 adds `idle`.
2. **The band subtitle builder** — PURE, in `src/lib/exercises/exercise-page.ts`: "Drill · 4:12", "Drill · warm-up · 4:12", "Drill · learning · 3:20". Task 4 adds a `place: { at: number; of: number } | null` input: "Drill · 3 of 7 · 4:12", "Drill · warm-up · 1 of 7 · 6:30".
3. **The Done sheet's muted line builder** — PURE: "4:12", "Learning · 2 of 3 good days", a past day. Task 4 adds `next: string | null`.
4. **The pinned Done control** — plan 2's "✓ Done" / "Done today" button, drawn from one snippet or component in the page, that Task 4 can place as the right half of a two-button row (it accepts the row's class).
5. **The no-face save** — the page's save for a fixed-rhythm drill (Done saves at once, `rating` null), callable from code (assumed `saveNow(): Promise<number | null>`, resolving to the set id once the action's `update()` has run).
6. **After a save** — plan 2's one place where the page decides where to go after a face has saved (outside a run: back to the opener, the toast there). It must resolve the set id **after** the action's `update()` (the layout's day is fresh then). Task 4 branches it: in a run, `run.after(setId)`.
7. **The toast** — the (today) layout's `?logged=<setId>` handling (the layout's `afterNavigate` reads it on any (today) route and drops it), with plan 2's words ("Saved · back in 12 days", "Saved · back tomorrow").
8. **The routine's "Practise in player"** link on the exercise page (from the old routine `Log.svelte` panel), built with `from=exercise`, and the page's Music `practise` callback (`practiseHref`). Task 4 makes both carry the run.
9. **The phone popup is gone** from the (today) layout (`openId`, `Log`, `onlog`, `pagePopup`, `bumpKey`'s popup use, LogShell's `SessionControls`). Task 3 deletes whatever of the old session is left, whichever plan 2 left.
10. **"Set" words in the player** (`runSummary`'s "logged as a set") are plan 2's to change.

## Global Constraints

- Nothing about the run is stored on the server: it is `?run=1` (and `skip=<ids>`) on an exercise page plus Today's rows. A reload keeps it.
- The walk: the warm-ups not done today in their list order (`todo` and `picked`), then the Practice `todo` rows, then the Practice `picked` rows. A row done today is never walked.
- Skip is for this run only (it goes into `skip=`); it is never Not today.
- Band subtitle in a run: "Drill · 3 of 7 · 4:12"; a warm-up "Drill · warm-up · 1 of 7 · 6:30". `of` is the day's rows (`DayList.total`, both lists).
- Done sheet line in a run: "4:12 · Next: <name>"; a learning drill "Learning · 2 of 3 good days · Next: <name>"; the last of the run has no "Next:".
- Pinned bar in a run: **Skip** | **✓ Done**, two equal `rowButton`s. A fixed-rhythm drill (`comesBack.kind === 'every'`) not done today: **✓ Done · next** in the done green, saving at once.
- Done for today: title **Done for today**, subtitle the long day ("Saturday, 7 November"), tiles **N exercises** / **N min practised** (`practisedLabel`), a **Warm-up** row "2 done · 7 days in a row" (the streak only when ≥ 2), each other done exercise with its face and "Back in 12 days" / "Back tomorrow" / "Learnt · back in 3 days", then **Next 5** (the daily number) | **Back to Today**. Nothing on it is a checkbox.
- Hero meta: "0 of 7 done · about 30 min"; the estimate is left out when no walked exercise has a timed day.
- The player in a run: its Save reads **Save · next**; after saving it opens the run's next exercise (or Done for today) with the toast. A fixed-rhythm drill's Save set has no faces and saves `rating` null.
- Desktop: opening from the list is never a run. The exercise Today opens by itself doesn't start the clock until a tap or key in the pane.
- Elapsed time sorts, calendar days speak: days via `localDay`/`daysBetween`; no `Date.now()` in `src/lib/schedule` or `src/lib/day`.
- A colour on a built control is the builder's: the green is a `ButtonKind`, never an appended class.
- Data functions take `db` first; specs use `openDb(':memory:')`, never `$DATA_DIR`.
- `npm run check` must pass at the end of every task.

## Review Focus

- A run URL with junk or a stale `skip` (`skip=abc,-1,3,3`, an id of another dance, an exercise no longer on Today, the open exercise already done): the page loads; the band shows no place; Skip and Done go to the first of the walk. → Task 1 (`parseSkip`, `runPlace`, `runStep` tests).
- Undo from the toast on the next page: the undone exercise is a to-do row again and comes up as the next one; the place counts down; nothing loops. → Task 1 (`runStep` after an undo).
- Every exercise skipped, nothing done: Done for today says 0 exercises, has no rows card and no Warm-up row, and still offers Next N when more is in line. → Task 5 (`doneForToday` empty case).
- The player's save in a run when the saved exercise was the run's last, or every other one is skipped: it lands on Done for today with the toast. → Task 6 (save action test).
- A fixed-rhythm drill saved from the player with a face posted anyway: stored with `rating` null; a by-how-it-went exercise without a face is still refused. → Task 6.

---

### Task 1: The walk and the run (PURE)

**Files:**
- Modify: `src/lib/exercises/session.ts` (`sessionWalk` takes warm-ups first; `sessionSummary` goes), `src/lib/exercises/session.spec.ts`
- Create: `src/lib/exercises/run.ts`, `src/lib/exercises/run.spec.ts`
- Modify: `src/lib/exercises/today-pane.spec.ts` (`defaultOpen` opens the first warm-up)

**Interfaces:**
- Consumes: plan 1's `DayRow.list: 'warmup' | 'practice'` and `DayList.total`.
- Produces (`session.ts`):
  ```ts
  type Walkable = { exercise: { id: number }; kind: 'done' | 'todo' | 'picked'; list?: 'warmup' | 'practice' };
  /** Warm-ups not done (todo, picked) in the given order, then practice todo, then practice picked. No `list` = practice. */
  export function sessionWalk<R extends Walkable>(rows: readonly R[]): R[];
  export function nextInSession(...) // unchanged
  ```
- Produces (`run.ts`, PURE, client-safe):
  ```ts
  export interface RunState { skip: number[] }
  export interface RunPlace { at: number; of: number }
  /** `?run=1` → { skip: parseSkip(skip) }; anything else → null. */
  export function runOf(search: URLSearchParams): RunState | null;
  /** Total: "12,15" → [12, 15]; non-integers, ≤ 0 and repeats dropped; the first 50 kept; null → []. */
  export function parseSkip(raw: string | null): number[];
  /** "/salsa/exercises/12?run=1&skip=3,5" (no skip when empty), "&logged=41" when given. */
  export function runHref(dance: string, exerciseId: number, run: RunState, logged?: number | null): string;
  /** "/salsa/done", "?logged=41" when given. */
  export function doneHref(dance: string, logged?: number | null): string;
  /** A player link's `from` from a page: "from=run&skip=3,5" in a run (no skip when empty), else "from=exercise". */
  export function playerFrom(run: RunState | null): string;
  /** `of` = day.total; `at` = done rows + walk rows in `skip` + 1, for a current in the walk and not skipped; else null. */
  export function runPlace(day: { rows: readonly Walkable[]; total: number }, skip: readonly number[], current: number): RunPlace | null;
  export interface RunStep {
  	place: RunPlace | null;
  	next: { id: number; name: string } | null; // nextInSession(walk, skip, current)
  	skipHref: string;                            // the next with current added to skip, else doneHref
  	afterHref(setId: number | null): string;      // the next with `logged`, else doneHref with `logged`
  }
  export function runStep(
  	dance: string,
  	day: { rows: readonly (Walkable & { exercise: { id: number; name: string } })[]; total: number },
  	run: RunState,
  	current: number
  ): RunStep;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// session.spec.ts — rows carry `list`
const w = (id: number, kind: Kind = 'todo') => ({ exercise: { id }, kind, list: 'warmup' as const });
const p = (id: number, kind: Kind = 'todo') => ({ exercise: { id }, kind, list: 'practice' as const });
it('walks the warm-ups first, in their order, a picked one among them', () => {
	const rows = [p(1, 'done'), w(10), w(11, 'picked'), w(12, 'done'), p(2), p(4, 'picked'), p(3)];
	expect(sessionWalk(rows).map((r) => r.exercise.id)).toEqual([10, 11, 2, 3, 4]);
});
it('a row without a list is practice', () => {
	expect(sessionWalk([{ exercise: { id: 2 }, kind: 'todo' }, w(10)]).map((r) => r.exercise.id)).toEqual([10, 2]);
});
// delete the sessionSummary cases

// run.spec.ts
it.each([[null, []], ['', []], ['3,5', [3, 5]], ['abc,-1,3,3,0,2.5', [3]]])('parseSkip(%s)', (raw, want) =>
	expect(parseSkip(raw)).toEqual(want));
it('keeps 50 skips at most', () => expect(parseSkip(Array.from({ length: 60 }, (_, i) => i + 1).join(','))).toHaveLength(50));
it('runOf', () => {
	expect(runOf(new URLSearchParams('run=1&skip=3'))).toEqual({ skip: [3] });
	expect(runOf(new URLSearchParams('run=0'))).toBeNull();
	expect(runOf(new URLSearchParams(''))).toBeNull();
});
it('hrefs', () => {
	expect(runHref('salsa', 12, { skip: [] })).toBe('/salsa/exercises/12?run=1');
	expect(runHref('salsa', 12, { skip: [3, 5] }, 41)).toBe('/salsa/exercises/12?run=1&skip=3,5&logged=41');
	expect(doneHref('salsa')).toBe('/salsa/done');
	expect(doneHref('salsa', 41)).toBe('/salsa/done?logged=41');
	expect(playerFrom({ skip: [3] })).toBe('from=run&skip=3');
	expect(playerFrom({ skip: [] })).toBe('from=run');
	expect(playerFrom(null)).toBe('from=exercise');
});
// a day: P1 done; warm-ups 10, 11; practice 2, 3 — total 5
const named = <R extends { exercise: { id: number } }>(r: R) => ({ ...r, exercise: { ...r.exercise, name: `E${r.exercise.id}` } });
const day = { rows: [p(1, 'done'), w(10), w(11), p(2), p(3)].map(named), total: 5 };
it('runPlace', () => {
	expect(runPlace(day, [], 10)).toEqual({ at: 2, of: 5 });
	expect(runPlace(day, [10], 11)).toEqual({ at: 3, of: 5 });
	expect(runPlace(day, [10], 10)).toBeNull(); // skipped
	expect(runPlace(day, [], 1)).toBeNull();     // done today
	expect(runPlace(day, [], 99)).toBeNull();    // not on Today
	expect(runPlace(day, [99], 10)).toEqual({ at: 2, of: 5 }); // a stale skip counts nothing
});
it('runStep: on to the next, Skip adds the current to skip', () => {
	const s = runStep('salsa', day, { skip: [] }, 10);
	expect(s.next).toEqual({ id: 11, name: 'E11' });
	expect(s.skipHref).toBe('/salsa/exercises/11?run=1&skip=10');
	expect(s.afterHref(41)).toBe('/salsa/exercises/11?run=1&logged=41');
});
it('runStep: the last one ends on Done for today', () => {
	const s = runStep('salsa', day, { skip: [10, 11, 2] }, 3);
	expect(s.next).toBeNull();
	expect(s.skipHref).toBe('/salsa/done');
	expect(s.afterHref(41)).toBe('/salsa/done?logged=41');
	expect(s.afterHref(null)).toBe('/salsa/done');
});
it('runStep: after an Undo the exercise is a to-do again and comes up next', () => {
	// 10 was saved, then undone on 11's page: 10 is a to-do row again
	const s = runStep('salsa', day, { skip: [] }, 11);
	expect(s.next?.id).toBe(10);
	expect(s.place).toEqual({ at: 2, of: 5 });
});
it('runStep: an open exercise already done goes on to the first of the walk', () => {
	expect(runStep('salsa', day, { skip: [] }, 1).next?.id).toBe(10);
});
```

In `today-pane.spec.ts`: `defaultOpen` of `[p(2), w(10)]` is 10.

- [ ] **Step 2: Run `npx vitest run src/lib/exercises` — the new cases FAIL.**
- [ ] **Step 3: Implement.** `runStep` builds its walk with `sessionWalk(day.rows)`; `nextInSession(walk, new Set(skip), current)` is `next`. Delete `sessionSummary` (its one user, LogShell's Session done card, is gone with plan 2; if not, Task 3 deletes the user).
- [ ] **Step 4: `npx vitest run src/lib/exercises` — PASS.**
- [ ] **Step 5: Commit** `feat(today): the run's walk takes the warm-ups first; run.ts works out place, next and the hrefs`.

---

### Task 2: The hero's time estimate

**Files:**
- Create: `src/lib/exercises/estimate.ts`, `src/lib/exercises/estimate.spec.ts`
- Modify: `src/lib/server/schedule.ts` (`listScheduleSets` also selects `durationS`)
- Modify: `src/lib/exercises/today.ts` (`todayHero`), `src/lib/exercises/today.spec.ts`
- Modify: `src/routes/[dance]/(today)/+layout.server.ts` (`list.estimateS`), `src/routes/[dance]/today-layout.spec.ts`
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (`todayHero(day, data.list.estimateS)`)

**Interfaces:**
- Consumes: Task 1's `sessionWalk`.
- Produces:
  ```ts
  // estimate.ts (PURE)
  type TimedSet = { exerciseId: number; doneAt: number; durationS: number | null };
  /** The median of the exercise's last 3 timed local days (a day's durations added up; null and 0 are untimed); null with none. */
  export function typicalSeconds(sets: readonly Omit<TimedSet, 'exerciseId'>[], timeZone: string): number | null;
  /** The sum of `typicalSeconds` over `ids`; null when none of them has a timed day. */
  export function runEstimate(sets: readonly TimedSet[], ids: readonly number[], timeZone: string): number | null;
  ```
  - `listScheduleSets(db, wall): (ScheduleSet & { exerciseId: number; durationS: number | null })[]`.
  - `todayHero(day: DayList<unknown>, estimateS: number | null = null): TodayHero` — the to-do meta gains ` · about ${Math.max(1, Math.round(estimateS / 60))} min` when `estimateS` is a number.
  - Layout data `list.estimateS: number | null` = `runEstimate(input.sets, sessionWalk(day.rows).map((r) => r.exercise.id), tz)`: what is still to walk, so it shrinks as the day goes (my reading of "the run's exercises").

- [ ] **Step 1: Write the failing tests** (`TZ = 'Europe/Ljubljana'`, `at(day, hh)` → epoch ms)

```ts
it('takes the median of the last 3 timed days, a day added up', () => {
	const sets = [
		{ doneAt: at(D0), durationS: 300 },
		{ doneAt: at(D1, 9), durationS: 600 }, { doneAt: at(D1, 18), durationS: 120 }, // 720 that day
		{ doneAt: at(D2), durationS: null },
		{ doneAt: at(D3), durationS: 240 },
		{ doneAt: at(D4), durationS: 0 }
	];
	expect(typicalSeconds(sets, TZ)).toBe(300); // 240, 720, 300
});
it('two timed days: their mean; none: null', () => {
	expect(typicalSeconds([{ doneAt: at(D0), durationS: 100 }, { doneAt: at(D1), durationS: 200 }], TZ)).toBe(150);
	expect(typicalSeconds([{ doneAt: at(D0), durationS: null }], TZ)).toBeNull();
});
it('runEstimate sums what has a time, null when nothing has', () => {
	const sets = [{ exerciseId: 1, doneAt: at(D0), durationS: 300 }, { exerciseId: 2, doneAt: at(D0), durationS: 180 }];
	expect(runEstimate(sets, [1, 2, 3], TZ)).toBe(480);
	expect(runEstimate(sets, [3], TZ)).toBeNull();
});
// today.spec.ts
it('the hero says about how long', () => {
	expect(todayHero(dayOf({ done: 0, total: 7 }), 1800).meta).toBe('0 of 7 done · about 30 min');
	expect(todayHero(dayOf({ done: 0, total: 7 }), 20).meta).toBe('0 of 7 done · about 1 min');
	expect(todayHero(dayOf({ done: 0, total: 7 }), null).meta).toBe('0 of 7 done');
});
// today-layout.spec.ts: a drill with one 600 s set yesterday, due today → list.estimateS === 600;
// a drill never timed → list.estimateS === null
```

- [ ] **Step 2: Run `npx vitest run src/lib/exercises src/routes/[dance]/today-layout.spec.ts` — FAIL.**
- [ ] **Step 3: Implement** (local days through `localDay`; sort days, take the last 3).
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(today): the hero says about how long the day takes`.

---

### Task 3: Start opens the run; the layout's run replaces the session

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (the session code goes; `start`, `run`)
- Modify: `src/lib/components/today/today-context.ts` (`TodayPane`: `run`, `say`; the session members go)
- Modify: `src/lib/components/today/TodayBar.svelte` (play is "Start"), `TodayList.svelte` + `ExerciseRow.svelte` (`upNextId`/`upNext` and `rowSearch`/`search` go)
- Modify: `src/lib/exercises/today-pane.ts` (`sessionLine` goes), its spec
- Modify: `src/lib/nav/trail.ts` (`DROPPED` loses `session`), `src/lib/nav/trail.spec.ts`; `src/lib/unsaved/pending.spec.ts` (its `?session=1` strings → `?run=1`)
- Modify: `src/routes/dev/kit/+page.svelte` (the two HeroCard titles "Start session" → "7 for today")

**Interfaces:**
- Consumes: Task 1 (`runOf`, `runStep`, `runHref`, `sessionWalk`, `nextInSession`, `playerFrom`), plan 2 seam 9.
- Produces (`today-context.ts`):
  ```ts
  export interface RunControls {
  	readonly place: RunPlace | null;
  	readonly next: { id: number; name: string } | null;
  	/** The player's `from` from this page: "from=run&skip=…". */
  	readonly playerFrom: string;
  	/** On without saving (this run only): the next, or Done for today. A replace. */
  	skip(): void;
  	/** A save (or Not today) landed: the next, or Done for today, with `?logged=` when setId is a number. A replace. */
  	after(setId: number | null): void;
  }
  export interface TodayPane {
  	readonly run: RunControls | null; // `?run=1` on an exercise route, not a past day
  	say(message: string): void;       // the layout's toast
  	// kept: undoable, canSkip, notToday, toast, dismissToast (and whatever plan 2 added)
  	// gone: session, follow, line, key, logged, pagePopup
  }
  ```
  - The trail keeps `run` and `skip` in a page's search (a run page is a place to come back to: the player's Back and a tab tap return into the run); `session` is no longer dropped because nothing sets it.

- [ ] **Step 1: Write the failing tests:** `trail.spec.ts` — `keptSearch('?run=1&skip=3&day=2026-10-30')` → `'?run=1&skip=3&day=2026-10-30'`; `backMove({ 1: '/salsa/exercises/4?run=1&skip=3', 2: '/salsa/player?exercise=4&from=run&skip=3' }, 2, '/salsa/exercises/4')` → `'history'`. Replace the two `session` cases (lines ~90 and ~473) with `?log=1` ones. `today-pane.spec.ts`: drop the `sessionLine` cases.
- [ ] **Step 2: Run `npx vitest run src/lib/nav src/lib/exercises` — FAIL.**
- [ ] **Step 3: The layout.** Delete every session member (`sessionOn`, `skipped`, `tally`, `walked`, `sessionEnded`, `bumpKey`, `walkRows`, `current`, `firstUp`, `nextUp`, `openRow`, `clearSession`, `walk`, `startSession`, `endSession`, the `onMount` and `wasOn` effects, `session`, `logged`, `follow`, `line`, `resuming`, `upNextId`, the `sessionOn` branches of `swapTo`, `rowSearch`), whichever plan 2 left. Then:
  - `const run = $derived(!isList && !past && currentId !== null ? runOf(page.url.searchParams) : null)` and `step = run ? runStep(dance, day, run, currentId) : null`; the context's `run` getter wraps `step` (`skip`/`after` go through `gotoWhenSettled(href, { replaceState: true })`, so a closing Done sheet's Back lands first).
  - `start()`: the first of `nextInSession(sessionWalk(day.rows), new Set(), null)`; none → nothing. `gotoWhenSettled(runHref(dance, id, { skip: [] }), { replaceState: run !== null })`: a push from the list, a replace from a page already in a run (the run is one history entry). Same on the phone and the desktop.
  - `swapTo` on the list route is `defaultOpen(day)` only (no run).
  - `TodayBar`: `playLabel="Start"`, `onplay={start}`; its doc comment says the play starts the run.
  - `notToday` stays; the page decides where it goes (Task 4).
- [ ] **Step 4: Check nothing old is left:** `grep -rn "session=1\|sessionOn\|sessionSummary\|sessionLine\|Start session\|Resume session\|upNextId\|rowSearch" src` prints nothing.
- [ ] **Step 5: `npm run check` passes. In the dev server at 390 wide: Start opens the first warm-up's page with `?run=1`; one Back returns to Today.**
- [ ] **Step 6: Commit** `feat(today): Start opens the run; the old session goes`.

---

### Task 4: The run on the exercise page

**Files:**
- Modify: `src/lib/components/ui/styles.ts` (`ButtonKind` gains `'done'`), `src/lib/components/ui/styles.spec.ts`
- Modify: `src/lib/exercises/exercise-page.ts` (plan 2's subtitle and sheet-line builders: `place`, `next`), its spec
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (the run's pinned bar, subtitle, sheet line, after a save, Not today, player links)
- Modify: `src/lib/songs/music.ts` (`practiseHref` takes `from`), `src/lib/songs/music.spec.ts`
- Modify: wherever plan 2 put the routine's "Practise in player" link (seam 8)

**Interfaces:**
- Consumes: Task 3's `todayPane().run`; plan 2 seams 2–6 and 8; plan 1's `ExerciseItem.comesBack`.
- Produces:
  - `button('done', size, full)` / `rowButton('done')`: `bg-done text-on-done disabled:bg-disabled-bg disabled:text-disabled-ink`.
  - The subtitle builder's `place` input → `"Drill · 3 of 7 · 4:12"`, `"Drill · warm-up · 1 of 7 · 6:30"` (type, warm-up or learning, place, clock — in that order).
  - The sheet-line builder's `next` input → `"4:12 · Next: Review: Ponavljanje vseh figur"`; learning: `"Learning · 2 of 3 good days · Next: <name>"` (the learning words replace the time, as outside a run; my call); `next: null` → as plan 2 has it.
  - `practiseHref(dance: string, at: PractiseAt, songId: number, from?: string): string` — `from` (`playerFrom(...)`'s "from=run&skip=3") appended as given.

- [ ] **Step 1: Write the failing tests:** `styles.spec.ts`: `rowButton('done')` contains `bg-done` and `text-on-done` and `flex-1`. `exercise-page.spec.ts`: the subtitle with `place: { at: 3, of: 7 }`, type Drill, 252 s → `'Drill · 3 of 7 · 4:12'`; warm-up, `{ at: 1, of: 7 }`, 390 s → `'Drill · warm-up · 1 of 7 · 6:30'`; the sheet line with 252 s and `next: 'Review: La policía'` → `'4:12 · Next: Review: La policía'`; learning 2 of 3 with next → `'Learning · 2 of 3 good days · Next: Review: La policía'`. `music.spec.ts`: `practiseHref('salsa', { drillEntryId: 4 }, 9, 'from=run&skip=3')` → `'/salsa/player?exercise=4&song=9&from=run&skip=3'`.
- [ ] **Step 2: Run `npx vitest run src/lib/components/ui src/lib/exercises src/lib/songs` — FAIL.**
- [ ] **Step 3: Implement the builders and `'done'`.**
- [ ] **Step 4: Wire the page** (`const run = todayPane()?.run ?? null`):
  - **Pinned bar** (`BottomBar`, not in edit mode): in a run, `Skip` (`rowButton('secondary')`, `onclick={run.skip}`) then the Done control at `rowButton(...)`. A fixed-rhythm drill not done today (`data.exercise.comesBack.kind === 'every'`): `rowButton('done')` with the `check` icon and **Done · next**, which calls plan 2's `saveNow()` and then `run.after(setId)`. Outside a run, plan 2's bar as is. Look: `run-drill`, `run-regular`, `run-routine`; desk `desk-today` (the green Done · next).
  - **Subtitle**: plan 2's builder with `place: run?.place ?? null`.
  - **Done sheet**: its line with `next: run?.next?.name ?? null` (`sheet-drill`).
  - **After a save** (seam 6): in a run, `run.after(setId)` in place of going back to the opener. The toast comes from `?logged=` on the next page (`run-toast`). Closing the sheet (×, Back, scrim) saves nothing and stays.
  - **Not today** in a run: once `notToday` lands, `run.after(null)` (the row has left the walk; the layout's "Not today · Undo" toast stays up across the replace). Outside a run, as now (back to Today).
  - **Player links**: the page's Music `practise` passes `run ? run.playerFrom : undefined`; the routine's "Practise in player" uses `run?.playerFrom ?? 'from=exercise'` (`run-routine`).
- [ ] **Step 5: `npm run check` passes. In the dev server at 390 wide, a run over a warm-up, a fixed-rhythm drill and a lesson review: the subtitle counts 1 of 3, 2 of 3; Skip goes on; the fixed drill's Done · next saves and goes on with "Saved · back tomorrow"; a face on the last goes to `/salsa/done`.**
- [ ] **Step 6: Commit** `feat(exercises): the run on the page — Skip | Done, 3 of 7, Next:, on to the next`.

---

### Task 5: Done for today

**Files:**
- Create: `src/lib/exercises/done-today.ts`, `src/lib/exercises/done-today.spec.ts`
- Create: `src/routes/[dance]/(today)/done/+page.server.ts`, `src/routes/[dance]/(today)/done/+page.svelte`
- Modify: `src/lib/nav/pane.ts` (`ROUTES`, `LIST_HOME.today.items`), `src/lib/nav/tabs.ts` (`SECTION`), `src/lib/nav/trail.ts` (`remembered`), their specs
(The layout needs no change: `/done` is an open route, so `swapTo` leaves it alone, and `say` is in the context since Task 3.)

**Interfaces:**
- Consumes: plan 1's `DayRow` (`list`, `state`/`start: DueState`, `exercise.source`), `DaySet`, `feelOf`, `backWords`, `practisedLabel`, `inLine`, `dayInputOf`, `listScheduleSets`; Task 1's `runHref`; the `next` action on `/[dance]` (returns `{ exerciseIds }`).
- Produces (`done-today.ts`, PURE):
  ```ts
  export interface DoneRow { id: number; name: string; source: ExerciseSource; face: Feel | null; back: string }
  export interface DoneView {
  	count: number;                                   // done rows, both lists
  	seconds: number;                                 // the day's durationS added up
  	warmup: { done: number; line: string } | null;   // null when no warm-up is done today
  	rows: DoneRow[];                                 // practice done rows, in the day's order
  }
  /** Consecutive local days ending today with a set on any of `warmupIds`; 0 when today has none. */
  export function warmupStreak(sets: readonly { exerciseId: number; doneAt: number }[], warmupIds: ReadonlySet<number>, today: string, timeZone: string): number;
  /** "2 done · 7 days in a row"; the streak only when ≥ 2: "1 done". */
  export function warmupLine(done: number, streak: number): string;
  /** "Back in 12 days", "Back tomorrow"; a drill that finished learning today: "Learnt · back in 3 days". */
  export function backLine(row: { state: DueState; start: DueState }, today: string): string;
  export function doneForToday(day: DayList<ExerciseItem>, todaySets: readonly DaySet[], streak: number): DoneView;
  ```
  - A row's face is the day's last rated set's (`feelOf`), null when none (a fixed-rhythm drill). "Learnt" = `start.learning !== null && state.learning === null`.
  - Route `/[dance]/(today)/done`: `listOf` → `{ list: 'today', open: true }`; `LIST_HOME.today.items` = `['/exercises', '/done']`; `SECTION.done = 'today'`; `remembered('/salsa/done')` is false (a Today tab tap never lands on it).
  - Page load returns `{ streak: number, more: boolean }` (`more`: `inLine(dayInputOf(...)).length > 0`); the rest is the layout's `list`.

- [ ] **Step 1: Write the failing tests**

```ts
it('folds the warm-ups, faces and back-in for the rest', () => {
	// warm-ups 10, 11 done; 1 done gotit due today+12; 2 learnt today due +3; 3 fixed rhythm due +2; 4 to do
	const v = doneForToday(day, todaySets /* 600, 600, 300, 300 s */, 7);
	expect(v.count).toBe(5);
	expect(v.seconds).toBe(1800);
	expect(v.warmup).toEqual({ done: 2, line: '2 done · 7 days in a row' });
	expect(v.rows.map((r) => [r.id, r.face, r.back])).toEqual([
		[1, 'gotit', 'Back in 12 days'],
		[2, 'easy', 'Learnt · back in 3 days'], // its third good day was today
		[3, null, 'Back in 2 days']
	]);
});
it('nothing done: 0, no rows, no warm-up', () =>
	expect(doneForToday(allSkipped, [], 0)).toEqual({ count: 0, seconds: 0, warmup: null, rows: [] }));
it('back tomorrow', () => expect(backLine({ state: due(D1), start: due(D0) }, D0)).toBe('Back tomorrow'));
it('warmupLine', () => {
	expect(warmupLine(2, 7)).toBe('2 done · 7 days in a row');
	expect(warmupLine(1, 1)).toBe('1 done');
});
it('warmupStreak counts back from today, any warm-up a day', () => {
	const sets = [s(10, D0), s(11, Dm1), s(10, Dm2), s(9, Dm3), s(10, Dm4)]; // 9 is not a warm-up
	expect(warmupStreak(sets, new Set([10, 11]), D0, TZ)).toBe(3);
	expect(warmupStreak([s(10, Dm1)], new Set([10]), D0, TZ)).toBe(0);
});
// pane.spec / tabs.spec / trail.spec
expect(listOf('/[dance]/(today)/done')).toEqual({ list: 'today', open: true });
expect(tabFor('/salsa/done', 'salsa')).toBe('today');
expect(remembered('/salsa/done')).toBe(false);
```

- [ ] **Step 2: Run `npx vitest run src/lib/exercises src/lib/nav` — FAIL.**
- [ ] **Step 3: Implement `done-today.ts`, the nav entries and the load** (`streak` from `listScheduleSets(db, wall)` and the live warm-up ids of `listExercises`).
- [ ] **Step 4: The page** (`done-for-today`): a `Screen` titled "Done for today", subtitle `longDayLabel(today)`, the band's right an × (`BandButton icon="close" label="Back to Today"`) on the phone. Two tiles in one card (`exercises`/`exercise` via `plural`; `practisedLabel(seconds)` + "practised"). One `GROUP` card: the Warm-up row (the drill tile, "Warm-up", the line), then each `DoneRow` (its type's tile as `ExerciseRow` draws it, the name, `back` muted, `Face` at the end). No rows and no warm-up: no card. Pinned `BottomBar`: **Next {daily}** (`rowButton('secondary')`, only when `more`) and **Back to Today** (`rowButton('primary')`, full when alone). Next posts `actAt('/{dance}', 'next', {})`; a refusal goes to `todayPane().say`; otherwise `gotoWhenSettled(runHref(dance, exerciseIds[0], { skip: [] }), { replaceState: true })`. Back to Today and × call `goBack({ href: '/{dance}', label: 'Today' })`. On the desktop it is the pane beside the list.
- [ ] **Step 5: `npm run check` passes (`bands.spec` sees the `Screen`; `route-ids.spec` sees the route). In the dev server, a run's last face lands here with the toast; one Back from here returns to Today.**
- [ ] **Step 6: Commit** `feat(today): Done for today`.

---

### Task 6: The player continues the run; a fixed-rhythm Save set has no faces

**Files:**
- Modify: `src/routes/[dance]/player/+page.server.ts` (load: `run`, `fixed`; `save`: the rating rule, the run's redirect), `src/routes/[dance]/player/save.spec.ts`
- Create: `src/lib/server/run.ts` (+ spec in `src/lib/server/run.spec.ts`)
- Modify: `src/lib/player/view.ts` (`practiceBack` takes the run; `exerciseLine` says a rhythm), `src/lib/player/view.spec.ts`
- Modify: `src/lib/components/player/SaveSetSheet.svelte`, `src/routes/[dance]/player/+page.svelte`
- Modify: `src/lib/server/exercises.ts` (`listPickExercises`: `fixed`), `src/lib/types.ts` (`PickExercise.fixed: boolean`)

**Interfaces:**
- Consumes: Task 1 (`parseSkip`, `runHref`, `doneHref`, `sessionWalk`, `nextInSession`), plan 1 (`scheduleStateOf` → `DueState` with `every`; `parseComesBack`, `effectiveComesBack`, `rhythmWords`), `dayInputOf`, `workOf`, `dayListOf`.
- Produces:
  ```ts
  // src/lib/server/run.ts
  /** The run's next exercise id after a save, or null: today's walk, less `skip`. */
  export function nextInRunOf(db: Db, wall: Wall, timeZone: string, now: number, skip: readonly number[]): number | null;
  // view.ts
  export function practiceBack(p: { …as now; run: { skip: number[] } | null }): { href: string; label: string };
  //   from === 'run' with a live exercise and run → { href: runHref(dance, id, run), label: `Back to ${name}` }
  export function exerciseLine(e: { source: Source; state: DueState | null; today: string }): string;
  //   a fixed rhythm: "Drill · every day" (`rhythmWords(every)` lower-cased); else as now
  ```
  - Player load: `run: { skip: number[] } | null` (`from === 'run'` and an exercise; `skip` via `parseSkip`), `fixed: boolean` (`data.schedule?.every != null`).
  - Save form: a hidden `runSkip` field (present only in a run; the skip ids joined by ","). The action: `fixed` (the exercise's `scheduleStateOf(...).every !== null`) stores `rating` null whatever was posted; otherwise a missing face is still "Pick how it went". In a run it redirects to `runHref(dance, next, { skip }, setId)` or `doneHref(dance, setId)`; otherwise to `/${dance}?logged=${setId}` as now.
  - `SaveSetSheet` props gain `faces: boolean` (false: no `FaceRating`, Save enabled without a face) and `inRun: boolean` (Save reads **Save · next**); `onsaved(location: string)` passes the redirect's location. With the picker (no exercise), `faces` is `!picked.fixed`.
  - The player page: `onsaved(location)` in a run waits for the sheet's Back as `leaveRun` does, then `goto(location, { replaceState: true })` (the player's entry becomes the next page; Back from it is the page just saved, showing Done today: my call, simpler than unwinding two entries). Outside a run, as now (`goBack(data.back)`).

- [ ] **Step 1: Write the failing tests** (`save.spec.ts`, its existing `save()` helper; add a `url`-less `runSkip` field):

```ts
it('a fixed-rhythm drill saves rating null, even with a face posted', async () => {
	setComesBack(db, drillId, { kind: 'every', days: 1 });
	await expect(save({ rating: '4' })).rejects.toMatchObject({ status: 303 });
	expect(db.select().from(sets).all()).toMatchObject([{ rating: null }]);
	await expect(save({})).rejects.toMatchObject({ status: 303 }); // no face needed
});
it('by how it went still needs a face', async () => {
	const res = (await save({})) as { status: number };
	expect(res.status).toBe(400);
});
it('in a run: on to the next, the toast with it', async () => {
	const other = createCustomExercise(db, U1_SALSA, { name: 'Basic', everyDays: 2, notes: null }).id;
	const err = await save({ rating: '4', runSkip: '' }).catch((e) => e);
	const [row] = db.select().from(sets).all();
	expect(err).toMatchObject({ status: 303, location: `/salsa/exercises/${other}?run=1&logged=${row.id}` });
});
it('in a run, the last one: Done for today', async () => {
	const other = createCustomExercise(db, U1_SALSA, { name: 'Basic', everyDays: 2, notes: null }).id;
	const err = await save({ rating: '4', runSkip: String(other) }).catch((e) => e);
	const [row] = db.select().from(sets).all();
	expect(err).toMatchObject({ status: 303, location: `/salsa/done?logged=${row.id}` });
});
// run.spec.ts: nextInRunOf on a day with a warm-up and a practice drill → the warm-up's id; skip it → the drill's; both done → null
// view.spec.ts
expect(practiceBack({ dance: 'salsa', from: 'run', routine: null, song: null, exercise: { id: 4, name: 'Warmup' }, run: { skip: [3] } }))
	.toEqual({ href: '/salsa/exercises/4?run=1&skip=3', label: 'Back to Warmup' });
expect(exerciseLine({ source: 'custom', state: { ...due, every: 1, learning: null }, today })).toBe('Drill · every day');
```

(`setComesBack`: write `comes_back` with plan 1's `serializeComesBack` in the spec.)

- [ ] **Step 2: Run `npx vitest run src/routes/[dance]/player src/lib/server/run.spec.ts src/lib/player` — FAIL.**
- [ ] **Step 3: Implement** the load, the action, `nextInRunOf`, the view changes and `listPickExercises.fixed` (the entry's own `comes_back`, else its `drill_id` row's, through an alias join, read with `effectiveComesBack`).
- [ ] **Step 4: Wire the sheet and the page** (`player-save-regular`: Exercise row "Warmup / Drill · every day", Note, **Don't save** | **Save · next**, no faces).
- [ ] **Step 5: `npm run check` passes. In the dev server: a run's routine page → Practise in player → Back returns to the page with `?run=1`; Play, Stop, Save · next opens the next page with the toast.**
- [ ] **Step 6: Commit** `feat(player): a run goes on after Save; a fixed rhythm saves without faces`.

---

### Task 7: Desktop — the exercise Today opens by itself waits for a tap

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (`autoOpened`), `src/lib/components/today/today-context.ts`
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (the clock starts idle when auto-opened)
- Modify: plan 2's page clock (seam 1) only if it cannot start idle

**Interfaces:**
- Consumes: plan 2 seam 1 (`pageClock({ idle })`, `start()`).
- Produces (`TodayPane`):
  ```ts
  /** The path the list route opened by itself (desktop), until a tap or key in its pane, a row, or Start. */
  readonly autoOpened: string | null;
  /** A tap or key in the pane: the auto-opened page's clock may start. */
  wake(): void;
  ```
  - The layout sets `autoOpened = href.split('?')[0]` just before its swap's `gotoWhenSettled`, and clears it in `wake()`, in `start()`, and in `onNavigate` for any navigation that is not the swap's own.
  - The page: `idle = desk.current && today?.autoOpened === page.url.pathname`, read once when the page (or its id) mounts, creates the clock idle; `onpointerdown`/`onkeydown` (capture) on the page's outermost element call `today.wake()`; an `$effect` starts the clock once `autoOpened` no longer names this path. The phone never sets it.

- [ ] **Step 1: Shots scene first** (it is the test): in `scripts/shots/ext_run.py` (Task 8 creates the file; create it here with this one scene) `desk-auto-idle`: open `/{dance}` at 1440 wide, wait 3 s, read the pane's band subtitle: it ends in `0:00`; click the pane's description; wait 2 s: it no longer ends in `0:00`. Run it — it FAILS (the clock already counts).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: The scene passes; `npm run check` passes. Clicking a row or Start counts at once (try it).**
- [ ] **Step 4: Commit** `feat(today): on the desktop, the exercise Today opens by itself waits for a tap`.

---

### Task 8: Shots and docs

**Files:**
- Modify: `scripts/shots/ext_run.py` (the run's scenes), `scripts/shots/ext_today.py` (its session scenes and `_start_session` go: `today-session`, `today-session-return`, `pane-session`, the desk session walk checks around lines 494–600)
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-05-today-scheduling-design.md`, `docs/superpowers/specs/2026-11-03-desktop-design.md`, `docs/superpowers/specs/2026-11-07-run-the-day-design.md`

- [ ] **Step 1: Scenes** (`Scene` from `scenes`, as `ext_today.py` does; a copy of the latest backup with two warm-ups and one every-day drill set in the copy): `run-start` (Start → the first warm-up's page; subtitle matches `/· 1 of \d+ ·/`), `run-sheet` (Done → the sheet's line contains `Next:`), `run-next` (a face → the next page with the toast "Saved · back in"), `run-skip` (Skip → `skip=` in the URL, place + 1), `run-done` (walk to the end → `/done`, "Done for today"), `run-player-save` (a routine in the run → Practise in player → Save · next lands on the next page), `desk-run` (1440 wide: Start, the pane's Skip | Done · next), plus `desk-auto-idle` from Task 7. Shoot them and compare with `run-drill`, `run-regular`, `run-toast`, `run-routine`, `sheet-drill`, `player-save-regular`, `done-for-today`, `desk-today`, `desk-sheet`. No overflow at 390.
- [ ] **Step 2: `CLAUDE.md`:** Layout — `session.ts` (the walk: warm-ups first), `run.ts` (the run's URL, place, next), `estimate.ts`, `done-today.ts`, `src/lib/server/run.ts`; `today-pane.ts` loses "the session's line"; the `(today)` entry says "Start, the run (`?run=1&skip=`), Done for today (`(today)/done`)" in place of "Start session" and `sessionLine`; `TodayPane.run`/`autoOpened`.
- [ ] **Step 3: Specs:** the scheduling spec's bar card ("Play starts the existing session" → the run, the estimate) and its two other session lines; the desktop spec's session paragraphs → the run and the idle auto-open; the run-the-day spec's Status line: plan 3 built (what was decided: the estimate covers what is left to walk; the learning line in a run keeps the learning words; the player's Save · next replaces the player's history entry; Not today in a run goes on; the streak counts days with any warm-up set and shows from 2).
- [ ] **Step 4: `npm run check` passes; commit** `docs: run the day plan 3 (the run)`.
