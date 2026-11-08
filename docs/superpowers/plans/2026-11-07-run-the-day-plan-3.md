# Run the day, plan 3: the run

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start (the hero's play) walks the day: the warm-ups in their order, then the Practice rows, one exercise page after another (Skip | Done, "3 of 7" in the band, "Next: …" in the Done sheet), and ends on a **Done for today** screen. The hero estimates the time. The full-screen player continues the run, and saves a fixed-rhythm drill without faces. On the desktop the auto-opened exercise doesn't start the clock.

**Architecture:** The run is the URL (`?run=1&skip=3,5` on an exercise page) plus Today's rows, worked out by PURE functions (`session.ts`, a new `run.ts`), so nothing is stored and a reload keeps it. The (today) layout replaces plan 2's interim session with a `run` entry in the `TodayPane` context, which the exercise page (built by plan 2) uses for its pinned bar, its band subtitle, its Done sheet line and where it goes after a save. The toast is plan 2's: the page announces the save (`announceSaved`), then navigates; `SavedToast` in the `[dance]` layout shows it on the next screen. Done for today is a route in the (today) group (`/[dance]/done`), drawn from the layout's day. The player's save works out the run's next exercise on the server and answers it with the save; the player goes there.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-07-run-the-day-design.md` ("The run", "The practice panel and the full player", "Desktop", "Time"). The board with every screen: https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs. Mockup PNGs, by id, in `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-exercise-flow/72d7463b-31e7-40d6-976c-6196df628393/scratchpad/mock/png/<id>.png`: `today`, `today-warmup-done`, `run-drill`, `run-regular`, `run-toast`, `run-routine`, `sheet-drill`, `player-save-regular`, `done-for-today`, `desk-today`, `desk-sheet`. Read `CLAUDE.md` (hard rules, "Words go through `t()`") first.

**Builds on:** plan 1 (built: `DayRow.list: 'warmup' | 'practice'`, warm-ups first in `DayList.rows`, `DayList.total`/`done`/`warmups`; `DueState` with `every`/`learning` from `scheduleStates`/`scheduleStateOf` in `src/lib/server/schedule.ts`; `ExerciseItem.comesBack` (effective) and `warmup`; `todayHero(day)` saying "N for today" / "N left for today" over "D of T done") and plan 2 (`docs/superpowers/plans/2026-11-07-run-the-day-plan-2.md`: the one page). Both are merged before this plan starts.

## Consumes from plan 2

The names as plan 2 defines them; where a task here changes one, it says so.

1. **The page clock**: `pageClock()` in `src/lib/exercises/page-clock.svelte.ts` → `{ readonly seconds: number; restart(): void }`, started on mount. Task 7 adds the idle mode (`pageClock({ idle })`, `start()`).
2. **The band subtitle**: `bandSubtitle({ label, warmup, learning, seconds })` in `src/lib/exercises/done-view.ts` ("Drill · 4:12", "Drill · warm-up · 6:30", "Drill · learning · 3:20"). Task 4 adds `place`.
3. **The Done sheet's muted line**: `doneSubtitle({ seconds, learning, day, name })` in `done-view.ts`. Task 4 adds `next`.
4. **The pinned Done control**: `DoneBar.svelte` (`src/lib/components/exercises/`): a `BottomBar` with `left?: Snippet` (with a `left`, both buttons are `rowButton`s) and the main button from `doneBar({ doneToday, playing })` in `done-view.ts` (`kind: 'primary' | 'done-soft'`). Task 4 adds `fixedInRun` and `'done'`.
5. **The no-face save**: the exercise page's `saveNow(): Promise<void>` (`act('done', …)`, then `saved(result.data)`), used when `fixed` (`data.scheduleAtStart?.every != null`).
6. **After a save**: the page's `saved(r: DoneResult)`: `announceSaved({ dance, message: savedMessage(r.backDays ?? 1), undo })`, then the interim session's `onnext()` or `backWhenSettled(Today)`, then `clock.restart()`. The DoneSheet awaits `update()` before `onsaved`, and `act` reloads by itself, so the layout's day already counts the save. Task 3 drops the session branch; Task 4 branches it: in a run, `run.after()`.
7. **The toast**: `announceSaved` (`src/lib/exercises/saved.svelte.ts`) + `SavedToast` in `src/routes/[dance]/+layout.svelte`, which survives the navigation; its Undo posts Today's `undoDone`. There is **no `?logged=` toast** (plan 2 Task 8 removed Today's handling): announce, then navigate.
8. **The save's answer**: `DoneResult` (`src/lib/types.ts`: `{ ok: true; setId; before: string | null; backDays: number | null }`); the exercise page's and Today's `done` answer it with `action: 'done'`, and so does the player's `save` (JSON since plan 2 Task 4, no redirect). `SaveSetSheet`'s `onsaved(r: DoneResult)`; the player page's `saved(r)` announces and leaves through `leaveRun()` (the sheet's Back, then `goBack(data.back, { replace: true })`).
9. **The routine's "Practise in player"**: `kinds/routine/Practice.svelte`, its link built with `PracticeProps.playerFrom` (the page passes `'from=exercise'`); the page's Music `practise` callback (`practiseHref`). Task 4 makes both carry the run.
10. **The interim session** plan 2 leaves in the (today) layout, which Task 3 deletes: `sessionOn`, `walkRows`, `firstUp`, `nextUp`, `openRow`, `startSession`, `session` (`SessionControls { onnext }` in `today-context.ts`), `resuming`/`play`, `upNextId`, `rowSearch`, `swapTo`'s `sessionOn` branch, the `?session=1` in `at()` calls; `TodayList`'s `upNextId`/`rowSearch` and `ExerciseRow`'s `upNext`/`search`; the catalog's `today.hero.start` ("Start session") / `resume` and `today.row.upNext`. `TodayPane` after plan 2 is `{ session, canSkip, notToday }`. The phone popup, `sessionSummary`, `sessionLine`, `today.session.*` and `undoLogMessage` are gone already.
11. **"Set" words** are gone (`player.loggedAsSet` included); `ButtonKind` has `'done-soft'` (the "Done today" button); `PAGE_EPOCH` is 9.

## Global Constraints

- Nothing about the run is stored on the server: it is `?run=1` (and `skip=<ids>`) on an exercise page plus Today's rows. A reload keeps it.
- The walk: the warm-ups not done today in their list order (`todo` and `picked`), then the Practice `todo` rows, then the Practice `picked` rows. A row done today is never walked.
- Skip is for this run only (it goes into `skip=`); it is never Not today.
- **Words go through `t()`** (CLAUDE.md hard rule). Every word a task adds or changes goes in the English catalog area it names (`src/lib/i18n/en/<area>.ts`) and, in the same task, in Slovenian (`sl/<area>.ts`: vikanje in sentences, the glossary at the top of `sl/index.ts`, plurals through `slCount`, a name after a colon or a "·"); a key nothing reads any more is removed from both. A new component or page that draws words goes into `TRANSLATED` (`src/lib/i18n/no-english.spec.ts`) in the task that makes it. PURE word functions read `t()` at call time; dates through `src/lib/format.ts` (`longDayLabel` "Saturday, 7 November", `clock`). Specs pin **English by default** (no locale set) with the exact values below; a Slovenian case runs under `withLocale('sl', …)`.
- Band subtitle in a run: "Drill · 3 of 7 · 4:12"; a warm-up "Drill · warm-up · 1 of 7 · 6:30". `of` is the day's rows (`DayList.total`, both lists).
- Done sheet line in a run: "4:12 · Next: <name>"; a learning drill "Learning · 2 of 3 good days · Next: <name>"; the last of the run has no "Next:".
- Pinned bar in a run: **Skip** | **✓ Done**, two equal `rowButton`s (plan 2's `DoneBar` with Skip as its `left`). A fixed-rhythm drill (`DueState.every !== null`, the page's `fixed`) not done today: **✓ Done · next** in the done green, saving at once (`saveNow`).
- Done for today: title **Done for today**, subtitle the long day ("Saturday, 7 November"), tiles **N exercises** / **N min practised** (`practisedLabel`, `src/lib/exercises/exercise-page.ts`), a **Warm-up** row "2 done · 7 days in a row" (the streak only when ≥ 2), each other done exercise with its face and "Back in 12 days" / "Back tomorrow" / "Learnt · back in 3 days", then **Next 5** (the daily number) | **Back to Today**. Nothing on it is a checkbox.
- Hero meta: "0 of 7 done · about 30 min"; the estimate is left out when no walked exercise has a timed day.
- The player in a run: its Save reads **Save · next**; after saving it opens the run's next exercise (or Done for today) with the toast. A fixed-rhythm drill's Save set has no faces and saves `rating` null.
- Desktop: opening from the list is never a run. The exercise Today opens by itself doesn't start the clock until a tap or key in the pane.
- Elapsed time sorts, calendar days speak: days via `localDay`/`daysBetween`; no `Date.now()` in `src/lib/schedule` or `src/lib/day`.
- A colour on a built control is the builder's: the green is a `ButtonKind` (`'done'`), never an appended class.
- Data functions take `db` first; specs use `openDb(':memory:')`, never `$DATA_DIR`.
- Raise `PAGE_EPOCH` 9 → 10 in Task 6 (the player's save form gains `runSkip` and its answer `next`; nothing else this plan changes is posted by an open page).
- `npm run check` must pass at the end of every task, and the app stays usable after each.

## Review Focus

- A run URL with junk or a stale `skip` (`skip=abc,-1,3,3`, an id of another dance, an exercise no longer on Today, the open exercise already done): the page loads; the band shows no place; Skip and Done go to the first of the walk. → Task 1 (`parseSkip`, `runPlace`, `runStep` tests).
- Undo from the toast on the next page: the undone exercise is a to-do row again and comes up as the next one; the place counts down; nothing loops. → Task 1 (`runStep` after an undo).
- Every exercise skipped, nothing done: Done for today says 0 exercises, has no rows card and no Warm-up row, and still offers Next N when more is in line. → Task 5 (`doneForToday` empty case).
- The player's save in a run when the saved exercise was the run's last, or every other one is skipped: it lands on Done for today with the toast. → Task 6 (save action test: `next: '/salsa/done'`).
- A fixed-rhythm drill saved from the player with a face posted anyway: stored with `rating` null; a by-how-it-went exercise without a face is still refused. → Task 6.

---

### Task 1: The walk and the run (PURE)

**Files:**
- Modify: `src/lib/exercises/session.ts` (`sessionWalk` takes warm-ups first; its doc comment: pages, not popups), `src/lib/exercises/session.spec.ts`
- Create: `src/lib/exercises/run.ts`, `src/lib/exercises/run.spec.ts`
- Modify: `src/lib/exercises/today-pane.spec.ts` (`defaultOpen` opens the first warm-up)

**Interfaces:**
- Consumes: plan 1's `DayRow.list` and `DayList.total`.
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
  /** "/salsa/exercises/12?run=1&skip=3,5" (no skip when empty). */
  export function runHref(dance: string, exerciseId: number, run: RunState): string;
  /** "/salsa/done". */
  export function doneHref(dance: string): string;
  /** A player link's `from` from a page: "from=run&skip=3,5" in a run (no skip when empty), else "from=exercise". */
  export function playerFrom(run: RunState | null): string;
  /** `of` = day.total; `at` = done rows + walk rows in `skip` + 1, for a current in the walk and not skipped; else null. */
  export function runPlace(day: { rows: readonly Walkable[]; total: number }, skip: readonly number[], current: number): RunPlace | null;
  export interface RunStep {
  	place: RunPlace | null;
  	next: { id: number; name: string } | null; // nextInSession(walk, skip, current)
  	skipHref: string;                            // the next with current added to skip, else doneHref
  	afterHref: string;                           // the next, else doneHref
  }
  export function runStep(
  	dance: string,
  	day: { rows: readonly (Walkable & { exercise: { id: number; name: string } })[]; total: number },
  	run: RunState,
  	current: number
  ): RunStep;
  ```
  (No `logged` in any href: the toast is plan 2's `announceSaved`.)

- [ ] **Step 1: Write the failing tests**

```ts
// session.spec.ts — rows carry `list`
type Kind = 'done' | 'todo' | 'picked';
const w = (id: number, kind: Kind = 'todo') => ({ exercise: { id }, kind, list: 'warmup' as const });
const p = (id: number, kind: Kind = 'todo') => ({ exercise: { id }, kind, list: 'practice' as const });
it('walks the warm-ups first, in their order, a picked one among them', () => {
	const rows = [p(1, 'done'), w(10), w(11, 'picked'), w(12, 'done'), p(2), p(4, 'picked'), p(3)];
	expect(sessionWalk(rows).map((r) => r.exercise.id)).toEqual([10, 11, 2, 3, 4]);
});
it('a row without a list is practice', () => {
	expect(sessionWalk([{ exercise: { id: 2 }, kind: 'todo' }, w(10)]).map((r) => r.exercise.id)).toEqual([10, 2]);
});

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
	expect(runHref('salsa', 12, { skip: [3, 5] })).toBe('/salsa/exercises/12?run=1&skip=3,5');
	expect(doneHref('salsa')).toBe('/salsa/done');
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
	expect(s.afterHref).toBe('/salsa/exercises/11?run=1');
});
it('runStep: the last one ends on Done for today', () => {
	const s = runStep('salsa', day, { skip: [10, 11, 2] }, 3);
	expect(s.next).toBeNull();
	expect(s.skipHref).toBe('/salsa/done');
	expect(s.afterHref).toBe('/salsa/done');
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

In `today-pane.spec.ts`: `defaultOpen` of a practice to-do 2 and a warm-up to-do 10 (rows with `list`, the warm-up second) is 10.

- [ ] **Step 2: Run `npx vitest run src/lib/exercises` — the new cases FAIL.**
- [ ] **Step 3: Implement.** `runStep` builds its walk with `sessionWalk(day.rows)`; `nextInSession(walk, new Set(skip), current)` is `next`. (`sessionSummary` is gone since plan 2.)
- [ ] **Step 4: `npx vitest run src/lib/exercises` — PASS.**
- [ ] **Step 5: Commit** `feat(today): the run's walk takes the warm-ups first; run.ts works out place, next and the hrefs`.

---

### Task 2: The hero's time estimate

**Files:**
- Create: `src/lib/exercises/estimate.ts`, `src/lib/exercises/estimate.spec.ts`
- Modify: `src/lib/server/schedule.ts` (`listScheduleSets` also selects `durationS`), `src/lib/server/schedule.spec.ts` if it pins the row shape
- Modify: `src/lib/exercises/today.ts` (`todayHero`), `src/lib/exercises/today.spec.ts`
- Modify: `src/routes/[dance]/(today)/+layout.server.ts` (`list.estimateS`), `src/routes/[dance]/today-layout.spec.ts`
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (`todayHero(day, data.list.estimateS)`)
- Modify: `src/lib/i18n/en/today.ts` + `sl/today.ts` (`today.hero.about(minutes)` "about 30 min")

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
  - `listScheduleSets(db, wall): (ScheduleSet & { exerciseId: number; durationS: number | null })[]` (it feeds `dayInputOf`'s `sets`, so `DayInput.sets` carries `durationS` from now on).
  - `todayHero(day: DayList<unknown>, estimateS: number | null = null): TodayHero` — the to-do meta (`today.hero.doneOf`) gains ` · ${t().today.hero.about(Math.max(1, Math.round(estimateS / 60)))}` when `estimateS` is a number.
  - Layout data `list.estimateS: number | null` = `runEstimate(input.sets, sessionWalk(day.rows).map((r) => r.exercise.id), tz)`: what is still to walk, so it shrinks as the day goes (my reading of "the run's exercises").

- [ ] **Step 1: Write the failing tests** (`TZ = 'Europe/Ljubljana'`, `at(day, hh)` → epoch ms as `schedule.spec.ts` builds it)

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
// today.spec.ts (its `list(...)` helper)
it('the hero says about how long', () => {
	expect(todayHero(list({ done: 0, total: 7, left: 7 }), 1800).meta).toBe('0 of 7 done · about 30 min');
	expect(todayHero(list({ done: 0, total: 7, left: 7 }), 20).meta).toBe('0 of 7 done · about 1 min');
	expect(todayHero(list({ done: 0, total: 7, left: 7 }), null).meta).toBe('0 of 7 done');
});
// today-layout.spec.ts: an every-day drill (`createCustomExercise(…, { name, notes: null, comesBack: { kind: 'every', days: 1 } })`)
// with one 600 s set at noon yesterday (`logSet`, `noonOf(shiftDay(localDay(Date.now(), TZ), -1), TZ)`) is due today → list.estimateS === 600;
// a drill never timed → list.estimateS === null
```

- [ ] **Step 2: Run `npx vitest run src/lib/exercises "src/routes/[dance]/today-layout.spec.ts"` — FAIL.**
- [ ] **Step 3: Implement** (local days through `localDay`; sort days, take the last 3).
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(today): the hero says about how long the day takes`.

---

### Task 3: Start opens the run; the layout's run replaces the session

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (plan 2's interim session goes; `start`, `run`)
- Modify: `src/lib/components/today/today-context.ts` (`TodayPane`: `run`, `say`; `SessionControls` and `session` go)
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (`saved` loses its session branch; Task 4 adds the run's)
- Modify: `src/lib/components/today/TodayBar.svelte` (play is "Start"), `TodayList.svelte` + `ExerciseRow.svelte` (`upNextId`/`upNext` and `rowSearch`/`search` go)
- Modify: `src/lib/nav/trail.ts` (`DROPPED` loses `session`), `src/lib/nav/trail.spec.ts`; `src/lib/unsaved/pending.spec.ts` (its `?session=1` strings → `?run=1`)
- Modify: `src/routes/dev/kit/+page.svelte` (the two HeroCard titles "Start session" → "7 for today")
- Modify: `src/lib/i18n/en/today.ts` + `sl/today.ts` (`today.hero.start` "Start" / "Začni"; `today.hero.resume` and `today.row.upNext` go); `sl/index.ts` (the glossary's Session line: the session goes, the run is never named on screen; Start is `Začni`)

**Interfaces:**
- Consumes: Task 1 (`runOf`, `runStep`, `runHref`, `sessionWalk`, `nextInSession`, `playerFrom`); plan 2's interim session (seam 10) and `gotoWhenSettled`.
- Produces (`today-context.ts`):
  ```ts
  export interface RunControls {
  	readonly place: RunPlace | null;
  	readonly next: { id: number; name: string } | null;
  	/** The player's `from` from this page: "from=run&skip=…". */
  	readonly playerFrom: string;
  	/** On without saving (this run only): the next, or Done for today. A replace. */
  	skip(): void;
  	/** A save (or Not today) landed and was announced: the next, or Done for today. A replace. */
  	after(): void;
  }
  export interface TodayPane {
  	readonly run: RunControls | null; // `?run=1` on an exercise route, not a past day
  	say(message: string): void;       // the layout's toast
  	canSkip(exerciseId: number): boolean;
  	notToday(exerciseId: number): Promise<boolean>;
  }
  ```
  (From plan 2's `{ session, canSkip, notToday }`: `session` goes, `run` and `say` come. Task 7 adds `autoOpened` and `wake`.)
  - The trail keeps `run` and `skip` in a page's search (a run page is a place to come back to: the player's Back and a tab tap return into the run); `session` is no longer dropped because nothing sets it.

- [ ] **Step 1: Write the failing tests:** `trail.spec.ts` — `keptSearch('?run=1&skip=3&day=2026-10-30')` → `'?run=1&skip=3&day=2026-10-30'`; `backMove({ 1: '/salsa/exercises/4?run=1&skip=3', 2: '/salsa/player?exercise=4&from=run&skip=3' }, 2, '/salsa/exercises/4')` → `'history'`. Drop the two `session` cases (~line 90, `keptSearch('?session=1&day=…')`, and ~line 473, `backMove({ 1: '/salsa?session=1', … })`); the `?log=1` and `?new=1` cases beside them keep covering a dropped flag.
- [ ] **Step 2: Run `npx vitest run src/lib/nav` — FAIL.**
- [ ] **Step 3: The layout.** Delete everything of plan 2's interim session (seam 10: `sessionOn`, `walkRows`, `firstUp`, `nextUp`, `openRow`, `startSession`, `session`, `resuming`, `play`, `upNextId`, `rowSearch`, `swapTo`'s `sessionOn` branch, `'?session=1'`). Then:
  - `const run = $derived(!isList && !past && currentId !== null ? runOf(page.url.searchParams) : null)` and `step = run ? runStep(dance, day, run, currentId) : null`; the context's `run` getter wraps `step` (`skip`/`after` go through `gotoWhenSettled(href, { replaceState: true })`, so a closing Done sheet's Back lands first; the day already counts a save, plan 2 seam 6).
  - `start()`: the first of `nextInSession(sessionWalk(day.rows), new Set(), null)`; none → nothing. `gotoWhenSettled(runHref(dance, id, { skip: [] }), { replaceState: run !== null })`: a push from the list, a replace from a page already in a run (the run is one history entry). Same on the phone and the desktop.
  - `swapTo` on the list route is `defaultOpen(day)` only (no run).
  - `TodayBar`: `playLabel={t().today.hero.start}`, `onplay={start}`; its doc comment says the play starts the run.
  - `notToday` stays; the page decides where it goes (Task 4).
  - The exercise page's `saved(r)`: announce, then `backWhenSettled(Today)`, then `clock.restart()` (the session branch goes).
- [ ] **Step 4: Check nothing old is left:** `rg -n "session=1|sessionOn|sessionSummary|sessionLine|SessionControls|Start session|Resume session|upNextId|rowSearch" src` prints nothing (a comment that says "session" for the trail's history is fine).
- [ ] **Step 5: `npm run check` passes. In the dev server at 390 wide: Start opens the first warm-up's page with `?run=1`; one Back returns to Today.**
- [ ] **Step 6: Commit** `feat(today): Start opens the run; the old session goes`.

---

### Task 4: The run on the exercise page

**Files:**
- Modify: `src/lib/components/ui/styles.ts` (`ButtonKind` gains `'done'`), `src/lib/components/ui/styles.spec.ts`
- Modify: `src/lib/exercises/done-view.ts` (`bandSubtitle`: `place`; `doneSubtitle`: `next`; `doneBar`: `fixedInRun`), `src/lib/exercises/done-view.spec.ts`
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (the run's pinned bar, subtitle, sheet line, after a save, Not today, player links)
- Modify: `src/lib/songs/music.ts` (`practiseHref` takes `from`), `src/lib/songs/music.spec.ts`
- Modify: `src/lib/i18n/en/exercise.ts` + `sl/exercise.ts` (`exercise.done.place(at, of)` "3 of 7", `next(name)` "Next: <name>", `skip` "Skip", `doneNext` "Done · next")

**Interfaces:**
- Consumes: Task 3's `todayPane().run`; plan 2 seams 2–6 and 9; the page's `fixed`.
- Produces:
  - `button('done', size, full)` / `rowButton('done')`: `bg-done text-on-done disabled:bg-disabled-bg disabled:text-disabled-ink`.
  - `bandSubtitle`'s `place: RunPlace | null` input → `"Drill · 3 of 7 · 4:12"`, `"Drill · warm-up · 1 of 7 · 6:30"` (type, warm-up or learning, place, clock — in that order).
  - `doneSubtitle`'s `next: string | null` input → `"4:12 · Next: Review: Ponavljanje vseh figur"`; learning: `"Learning · 2 of 3 good days · Next: <name>"` (the learning words replace the time, as outside a run; my call); `next: null` → as plan 2 has it.
  - `doneBar({ doneToday, playing, fixedInRun })`: `fixedInRun && !doneToday` → `{ label: 'Done · next', kind: 'done', disabled: playing, hint }` (the hint as for Done); otherwise as plan 2 has it. `kind: 'primary' | 'done-soft' | 'done'`.
  - `practiseHref(dance: string, at: PractiseAt, songId: number, from?: string): string` — `from` (`playerFrom(...)`'s "from=run&skip=3") appended as given, after the `URLSearchParams` part (the comma stays a comma).

- [ ] **Step 1: Write the failing tests:** `styles.spec.ts`: `rowButton('done')` contains `bg-done` and `text-on-done` and `flex-1`. `done-view.spec.ts`: `bandSubtitle({ label: 'Drill', warmup: false, learning: false, seconds: 252, place: { at: 3, of: 7 } })` → `'Drill · 3 of 7 · 4:12'`; warm-up, `{ at: 1, of: 7 }`, 390 s → `'Drill · warm-up · 1 of 7 · 6:30'`; `doneSubtitle` with 252 s and `next: 'Review: La policía'` → `'4:12 · Next: Review: La policía'`; learning 2 of 3 with next → `'Learning · 2 of 3 good days · Next: Review: La policía'`; `doneBar({ doneToday: false, playing: false, fixedInRun: true })` → `{ label: 'Done · next', kind: 'done', disabled: false, hint: null }`. One Slovenian case for the place (`withLocale('sl', …)`). `music.spec.ts`: `practiseHref('salsa', { drillEntryId: 4 }, 9, 'from=run&skip=3')` → `'/salsa/player?exercise=4&song=9&from=run&skip=3'`.
- [ ] **Step 2: Run `npx vitest run src/lib/components/ui src/lib/exercises src/lib/songs` — FAIL.**
- [ ] **Step 3: Implement the builders and `'done'`.**
- [ ] **Step 4: Wire the page** (`const run = todayPane()?.run ?? null`):
  - **Pinned bar** (`DoneBar`, not in edit mode): in a run, `left` = **Skip** (`rowButton('secondary')`, `t().exercise.done.skip`, `onclick={run.skip}`), and the main button from `doneBar({ doneToday, playing, fixedInRun: run !== null && fixed })`: Done · next calls `saveNow()`. Outside a run, plan 2's bar as is. Look: `run-drill`, `run-regular`, `run-routine`; desk `desk-today` (the green Done · next).
  - **Subtitle**: `bandSubtitle` with `place: run?.place ?? null`.
  - **Done sheet**: `doneSubtitle` with `next: run?.next?.name ?? null` (`sheet-drill`).
  - **After a save** (`saved(r)`, plan 2 seam 6): announce as now, then in a run `run.after()` in place of `backWhenSettled` (`run-toast`: the toast comes from `SavedToast` on the next page). Closing the sheet (×, Back, scrim) saves nothing and stays.
  - **Not today** in a run: once `notToday` lands, `run.after()` (the row has left the walk; the layout's "Not today · Undo" toast stays up across the replace). Outside a run, as now (back to Today).
  - **Player links**: the page's Music `practise` passes `run ? run.playerFrom : undefined`; the routine's Practise with gets `playerFrom={run?.playerFrom ?? 'from=exercise'}` (`run-routine`).
- [ ] **Step 5: `npm run check` passes. In the dev server at 390 wide, a run over a warm-up, a fixed-rhythm drill and a lesson review: the subtitle counts 1 of 3, 2 of 3; Skip goes on; the fixed drill's Done · next saves and goes on with "Saved · back tomorrow"; a face on the last goes to `/salsa/done`.**
- [ ] **Step 6: Commit** `feat(exercises): the run on the page — Skip | Done, 3 of 7, Next:, on to the next`.

---

### Task 5: Done for today

**Files:**
- Create: `src/lib/exercises/done-today.ts`, `src/lib/exercises/done-today.spec.ts`
- Create: `src/routes/[dance]/(today)/done/+page.server.ts`, `src/routes/[dance]/(today)/done/+page.svelte`
- Modify: `src/lib/nav/pane.ts` (`ROUTES`, `LIST_HOME.today.items`), `src/lib/nav/tabs.ts` (`SECTION`), `src/lib/nav/trail.ts` (`remembered`), their specs
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (its only change: `currentId` is null on a route without an `id` param, as `/done` is — `Number(undefined)` is NaN today)
- Modify: `src/lib/i18n/en/today.ts` + `sl/today.ts` (new area `today.doneToday`: `title` "Done for today", `exercises(n)` "exercise"/"exercises" (a tile's label: the noun in the number's form, as `exercise.page.times` does), `practised` "practised", `warmupDone(n)` "2 done", `streak(n)` "7 days in a row", `learnt(back)` "Learnt · <back>"), `no-english.spec.ts` (`TRANSLATED` gains the new `+page.svelte`); reused: `exercise.warmup.title` "Warm-up", `today.list.next(n)` "Next 5", `shell.backTo(shell.tabs.today)` "Back to Today", `backWords`

**Interfaces:**
- Consumes: plan 1's `DayRow` (`list`, `state`/`start: DueState`, `exercise.source`), `DaySet`, `feelOf` (`src/lib/schedule/feel.ts`), `backWords` (`src/lib/schedule/words.ts`), `practisedLabel` (`src/lib/exercises/exercise-page.ts`), `inLine`, `dayInputOf`, `listScheduleSets`, `listExercises`; Task 1's `runHref`; the `next` action on `/[dance]` (answers `{ action: 'next', pickIds, exerciseIds }`).
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
  /** "Back in 12 days", "Back tomorrow" (`backWords`); a drill that finished learning today: "Learnt · back in 3 days". */
  export function backLine(row: { state: DueState; start: DueState }, today: string): string;
  export function doneForToday(day: DayList<ExerciseItem>, todaySets: readonly DaySet[], streak: number): DoneView;
  ```
  - A row's face is the day's last rated set's (`feelOf`), null when none (a fixed-rhythm drill). "Learnt" = `start.learning !== null && state.learning === null`. The back days are `daysBetween(today, state.dueDay)`.
  - Route `/[dance]/(today)/done`: `listOf` → `{ list: 'today', open: true }`; `LIST_HOME.today.items` = `['/exercises', '/done']`; `SECTION.done = 'today'`; `remembered('/salsa/done')` is false (a Today tab tap never lands on it).
  - Page load returns `{ streak: number, more: boolean }` (`more`: `inLine(dayInputOf(...)).length > 0`); the rest is the layout's `list` (`day`, `todaySets`, `daily`).

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

Plus one Slovenian case for `warmupLine` and `backLine`'s learnt (`withLocale('sl', …)`).

- [ ] **Step 2: Run `npx vitest run src/lib/exercises src/lib/nav` — FAIL.**
- [ ] **Step 3: Implement `done-today.ts`, the nav entries, `currentId` and the load** (`streak` from `listScheduleSets(db, wall)` and the live warm-up ids of `listExercises`).
- [ ] **Step 4: The page** (`done-for-today`): a `Screen` titled `t().today.doneToday.title`, subtitle `longDayLabel(today)`, the band's right an × (`BandButton icon="close" label={t().shell.backTo(t().shell.tabs.today)}`) on the phone. Two tiles in one card (the count and `today.doneToday.exercises(n)`; `practisedLabel(seconds)` and `today.doneToday.practised`). One `GROUP` card: the Warm-up row (the drill tile, `exercise.warmup.title`, the line), then each `DoneRow` (its type's tile as `ExerciseRow` draws it, the name, `back` muted, `Face` at the end). No rows and no warm-up: no card. Pinned `BottomBar`: **Next {daily}** (`rowButton('secondary')`, `today.list.next(daily)`, only when `more`) and **Back to Today** (`rowButton('primary')`, full when alone). Next posts `actAt('/{dance}', 'next', {})`; a refusal goes to `todayPane().say`; otherwise `gotoWhenSettled(runHref(dance, exerciseIds[0], { skip: [] }), { replaceState: true })`. Back to Today and × call `goBack({ href: '/{dance}', label: … })` (`src/lib/nav/trail.svelte.ts`). On the desktop it is the pane beside the list.
- [ ] **Step 5: `npm run check` passes (`bands.spec` sees the `Screen`; `route-ids.spec` sees the route; `frame.spec` finds its frame). In the dev server, a run's last face lands here with the toast; one Back from here returns to Today.**
- [ ] **Step 6: Commit** `feat(today): Done for today`.

---

### Task 6: The player continues the run; a fixed-rhythm Save set has no faces

**Files:**
- Modify: `src/routes/[dance]/player/+page.server.ts` (load: `run`, `fixed`; `save`: the rating rule, the run's `next`), `src/routes/[dance]/player/save.spec.ts`
- Create: `src/lib/server/run.ts` (+ spec in `src/lib/server/run.spec.ts`)
- Modify: `src/lib/player/view.ts` (`practiceBack` takes the run; `exerciseLine` says a rhythm), `src/lib/player/view.spec.ts`
- Modify: `src/lib/components/player/SaveSetSheet.svelte`, `src/routes/[dance]/player/+page.svelte` (both in `TRANSLATED` already)
- Modify: `src/lib/server/exercises.ts` (`listPickExercises`: `fixed`), `src/lib/types.ts` (`PickExercise.fixed: boolean`)
- Modify: `src/lib/i18n/en/player.ts` + `sl/player.ts` (`player.saveNext` "Save · next")
- Modify: `src/lib/page-epoch.ts` (9 → 10)

**Interfaces:**
- Consumes: Task 1 (`parseSkip`, `runHref`, `doneHref`, `sessionWalk`, `nextInSession`), plan 1 (`scheduleStateOf` → `DueState` with `every`; `parseComesBack`, `effectiveComesBack`, `rhythmWords`), `dayInputOf`, `workOf`, `dayListOf`; plan 2's `DoneResult`, `saveDay`, `announceSaved`, `savedMessage`.
- Produces:
  ```ts
  // src/lib/server/run.ts
  /** The run's next exercise id after a save, or null: today's walk (`sessionWalk` of `dayListOf(workOf(dayInputOf(...)))`), less `skip`. */
  export function nextInRunOf(db: Db, wall: Wall, timeZone: string, now: number, skip: readonly number[]): number | null;
  // view.ts
  export function practiceBack(p: { …as now; run: { skip: number[] } | null }): { href: string; label: string };
  //   from === 'run' with a live exercise and run → { href: runHref(dance, id, run), label: t().shell.backTo(name) }
  export function exerciseLine(e: { source: Source; state: DueState | null; today: string }): string;
  //   a fixed rhythm: "Drill · every day" (`rhythmWords(every)` lower-cased); else as now
  ```
  - Player load: `run: { skip: number[] } | null` (`from === 'run'` and an exercise; `skip` via `parseSkip`), `fixed: boolean` (`data.schedule?.every != null`).
  - Save form: a hidden `runSkip` field (present only in a run; the skip ids joined by ","). The action: `fixed` (the exercise's `scheduleStateOf(...).every !== null`) stores `rating` null whatever was posted; otherwise a missing face is still `t().exercise.log.pickFeel`. It answers plan 2's `DoneResult` (`{ action: 'done', ok: true, setId, before, backDays }`) and, in a run, also `next: string` — `runHref(dance, nextInRunOf(…), { skip })`, or `doneHref(dance)` when that is null.
  - `SaveSetSheet` props gain `faces: boolean` (false: no `FaceRating`, Save enabled without a face) and `inRun: boolean` (Save reads `t().player.saveNext`); `onsaved(r: DoneResult & { next?: string })`. With the picker (no exercise), `faces` is `!picked.fixed`.
  - The player page's `saved(r)`: `announceSaved(...)` as plan 2 has it; then in a run (`r.next`) it waits for the sheet's Back as `leaveRun` does and `goto(r.next, { replaceState: true })` (the player's entry becomes the next page; Back from it is the page just saved, showing Done today: my call, simpler than unwinding two entries). Outside a run, as now (`leaveRun()`: `goBack(data.back)`).

- [ ] **Step 1: Write the failing tests** (`save.spec.ts`, its existing `save()` helper, which posts `exerciseId: drillId` unless the fields give one):

```ts
it('a fixed-rhythm drill saves rating null, even with a face posted', async () => {
	const fixed = createCustomExercise(db, U1_SALSA, { name: 'Warmup', notes: null, comesBack: { kind: 'every', days: 1 } }).id;
	expect(await save({ exerciseId: String(fixed), rating: '4' })).toMatchObject({ ok: true });
	expect(db.select().from(sets).all()).toMatchObject([{ rating: null }]);
	expect(await save({ exerciseId: String(fixed) })).toMatchObject({ ok: true }); // no face needed; still one row
});
it('by how it went still needs a face', async () => {
	const res = (await save({})) as { status: number };
	expect(res.status).toBe(400);
});
it('in a run: on to the next', async () => {
	const other = createCustomExercise(db, U1_SALSA, { name: 'Basic', everyDays: 2, notes: null }).id;
	const res = await save({ rating: '4', runSkip: '' });
	const [row] = db.select().from(sets).all();
	expect(res).toMatchObject({ ok: true, setId: row.id, next: `/salsa/exercises/${other}?run=1` });
});
it('in a run, the last one: Done for today', async () => {
	const other = createCustomExercise(db, U1_SALSA, { name: 'Basic', everyDays: 2, notes: null }).id;
	expect(await save({ rating: '4', runSkip: String(other) })).toMatchObject({ ok: true, next: '/salsa/done' });
});
it('outside a run there is no next', async () => {
	expect(await save({ rating: '4' })).not.toHaveProperty('next');
});
// run.spec.ts: nextInRunOf on a day with a warm-up (`warmup: true`) and a practice drill → the warm-up's id; skip it → the drill's; both done → null
// view.spec.ts
expect(practiceBack({ dance: 'salsa', from: 'run', routine: null, song: null, exercise: { id: 4, name: 'Warmup' }, run: { skip: [3] } }))
	.toEqual({ href: '/salsa/exercises/4?run=1&skip=3', label: 'Back to Warmup' });
expect(exerciseLine({ source: 'custom', state: { ...due, every: 1, learning: null }, today })).toBe('Drill · every day');
```

- [ ] **Step 2: Run `npx vitest run "src/routes/[dance]/player" src/lib/server/run.spec.ts src/lib/player` — FAIL.**
- [ ] **Step 3: Implement** the load, the action, `nextInRunOf`, the view changes and `listPickExercises.fixed` (the entry's own `comes_back`, else its `drill_id` row's, through an alias join as `scheduleStates` does, read with `effectiveComesBack`); raise `PAGE_EPOCH` to 10.
- [ ] **Step 4: Wire the sheet and the page** (`player-save-regular`: Exercise row "Warmup / Drill · every day", Note, **Don't save** | **Save · next**, no faces).
- [ ] **Step 5: `npm run check` passes. In the dev server: a run's routine page → Practise in player → Back returns to the page with `?run=1`; Play, Stop, Save · next opens the next page with the toast.**
- [ ] **Step 6: Commit** `feat(player): a run goes on after Save; a fixed rhythm saves without faces`.

---

### Task 7: Desktop — the exercise Today opens by itself waits for a tap

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.svelte` (`autoOpened`), `src/lib/components/today/today-context.ts`
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (the clock starts idle when auto-opened)
- Modify: `src/lib/exercises/page-clock.svelte.ts` (plan 2's clock: the idle mode)

**Interfaces:**
- Consumes: plan 2's `pageClock()` (seam 1).
- Produces:
  ```ts
  // page-clock.svelte.ts
  export function pageClock(opts?: { idle?: boolean }): { readonly seconds: number; start(): void; restart(opts?: { idle?: boolean }): void };
  //   idle: created (or restarted) at 0 and not counting until start(); start() is idempotent; without idle, as plan 2's
  // TodayPane
  /** The path the list route opened by itself (desktop), until a tap or key in its pane, a row, or Start. */
  readonly autoOpened: string | null;
  /** A tap or key in the pane: the auto-opened page's clock may start. */
  wake(): void;
  ```
  - The layout sets `autoOpened = href.split('?')[0]` just before its swap's `gotoWhenSettled`, and clears it in `wake()`, in `start()`, and in `onNavigate` for any navigation that is not the swap's own.
  - The page: `idle = desk.current && today?.autoOpened === page.url.pathname`, read once when the page (or its id) mounts, creates or restarts the clock idle; `onpointerdown`/`onkeydown` (capture) on the page's outermost element call `today.wake()`; an `$effect` calls `clock.start()` once `autoOpened` no longer names this path. The phone never sets it.

- [ ] **Step 1: Shots scene first** (it is the test): in `scripts/shots/ext_run.py` (Task 8 fills the file; create it here with this one scene, `Scene` from `scenes` as `ext_today.py` does) `desk-auto-idle`: open `/{dance}` at 1440 wide, wait 3 s, read the pane's band subtitle: it ends in `0:00`; click the pane's description; wait 2 s: it no longer ends in `0:00`. Run it — it FAILS (the clock already counts).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: The scene passes; `npm run check` passes. Clicking a row or Start counts at once (try it).**
- [ ] **Step 4: Commit** `feat(today): on the desktop, the exercise Today opens by itself waits for a tap`.

---

### Task 8: Shots and docs

**Files:**
- Modify: `scripts/shots/ext_run.py` (the run's scenes), `scripts/shots/ext_today.py` (what plan 2 left of the session: `today-session` and `today-session-pages`, and `_start_session`)
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-05-today-scheduling-design.md`, `docs/superpowers/specs/2026-11-03-desktop-design.md`, `docs/superpowers/specs/2026-11-07-run-the-day-design.md`

- [ ] **Step 1: Scenes** (`Scene` from `scenes`, as `ext_today.py` does; a copy of the latest backup with two warm-ups and one every-day drill set in the copy): `run-start` (Start → the first warm-up's page; subtitle matches `/· 1 of \d+ ·/`), `run-sheet` (Done → the sheet's line contains `Next:`), `run-next` (a face → the next page with the toast "Saved · back in"), `run-skip` (Skip → `skip=` in the URL, place + 1), `run-done` (walk to the end → `/done`, "Done for today"), `run-player-save` (a routine in the run → Practise in player → Save · next lands on the next page), `desk-run` (1440 wide: Start, the pane's Skip | Done · next), plus `desk-auto-idle` from Task 7. Shoot them and compare with `run-drill`, `run-regular`, `run-toast`, `run-routine`, `sheet-drill`, `player-save-regular`, `done-for-today`, `desk-today`, `desk-sheet`. No overflow at 390.
- [ ] **Step 2: `CLAUDE.md`:** Layout — `session.ts` (the walk: warm-ups first), `run.ts` (the run's URL, place, next), `estimate.ts`, `done-today.ts`, `src/lib/server/run.ts`, `done-view.ts`'s place and next; the `(today)` entry says "Start, the run (`?run=1&skip=`), Done for today (`(today)/done`)" in place of "Start session"; `TodayPane.run`/`autoOpened`; `page-clock.svelte.ts`'s idle mode. Plan 3 in the "Live" summary.
- [ ] **Step 3: Specs:** the scheduling spec's bar card ("Play starts the existing session" → the run, the estimate) and its two other session lines; the desktop spec's session paragraphs → the run and the idle auto-open; the run-the-day spec's Status line: plan 3 built (what was decided: the estimate covers what is left to walk; the learning line in a run keeps the learning words; the player's Save · next replaces the player's history entry; Not today in a run goes on; the streak counts days with any warm-up set and shows from 2).
- [ ] **Step 4: `npm run check` passes; commit** `docs: run the day plan 3 (the run)`.
