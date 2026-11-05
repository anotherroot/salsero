# Today Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-exercise frequency with an Anki-style schedule: four faces, a daily number on Today with Next N, Coming up, Not today and Undo — phone and desktop.

**Architecture:** A pure, client-safe `src/lib/schedule/` replays each exercise's sets (day + face) into a gap and a due day, and builds Today's list and Coming up's groups from that plus the day's picks. The only new storage is the person's daily number (`users.daily_count`) and the day's choices (`today_picks`). Pages swap `plan()` (urgency) for these functions; every frequency field goes.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, Drizzle + better-sqlite3, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-today-scheduling-design.md` (read it whole before any task). Boards: `docs/superpowers/boards/2026-11-05-today-scheduling.html`. Desktop rules: `docs/superpowers/specs/2026-11-03-desktop-design.md` (Today, list and pane, dialogs).

## Global Constraints

- Branch `brainstorm-for-older-users` (on top of master, desktop merged). CLAUDE.md's hard rules all apply; read it first.
- Schedule numbers, verbatim from the spec: Still hard → 1; Getting there → max(3, used × 1.2), done early max(that, gap ÷ 2); I've got it → max(7, used × 2.5, gap); Easy → max(21, used × 4, gap × 1.3); none → gap unchanged; `used = min(e, gap)`; early = `e < gap`; round half up, min 1, max 365; start gap = `every_days`; first set `e = 0`; due day = last set's local day + gap; never done = due on its creation's local day.
- Faces written to `sets.rating`: Still hard 1, Getting there 2, I've got it 4, Easy 5. Read: 1 hard, 2 getting, 3–4 got it, 5 easy, null none.
- Daily number: default 5, 1–30, `users.daily_count` (null = 5), one per person for both dances.
- Words (exact copy): faces "Still hard", "Getting there", "I've got it", "Easy"; card "3 left for today", "2 of 5 done", "All 5 done", "That's today's practice"; list label "Today · N"; row "+ Next 5" (the daily number); nothing left "You've done everything"; metas "New · from class Tue 3 Nov", "2 days late", "Due today", "Ahead · due Sunday", "Added · due tomorrow", "Done · Back in a week"; "Not today", "It comes back tomorrow"; Coming up groups "Waiting", "Paused", headings "Sun 8 Nov" + "in 3 days"; Settings "Exercises a day", help "Today shows this many. When they're done, Next 5 brings more."; early line "Done early: you last did it yesterday, it was due on Saturday 14 Nov."
- Pure modules: `now` and `tz` are arguments; never `Date.now()`; calendar days via `localDay`/`daysBetween`; dates on screen via `src/lib/format.ts` (never `toLocaleDateString`).
- Colours only through tokens and the builders in `ui/styles.ts` (class-rules spec). New tokens go in `tokens.ts` AND `layout.css`.
- Migrations: additive only (`ADD COLUMN`, a new table). Read the generated SQL before committing. Never a CHECK on an existing table.
- Forms someone fills use `use:guarded`; one-tap actions use `use:enhance` or `act`. Today layout files never post to a bare `?/` (today-forms spec): use `/{dance}?/…` or `actAt`.
- Run commands inside the flake: `nix develop -c …`. Run each vitest file, each `npm run check`, each browser script ONE AT A TIME under `timeout 900 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 …`. No `script`/`expect`/`tmux attach`, no endless input, `browser.close()` in `finally`.
- **Pitfalls checklist (check before handing back):** a button stuck busy or silent after a refused/failed request; tests that would still pass with the feature removed; behaviour that differs between vitest and the real page (load the page in a browser at 390 px and at 1280 px when the task touches UI); ordering bugs (state saved before the write commits, a toast before the request succeeds).
- Commit per task with the repo's style (`feat(today): …`), ending with the two attribution lines from the session.

## Review Focus

1. **Day boundaries and DST:** a set at 23:30 local and one at 00:30 are different days; the gap counts calendar days in the person's zone, also across the late-October DST change. → Task 1 test `counts calendar days across midnight and DST`.
2. **Several sets on one exercise in one day** (practised twice, or logged again after Undo): `e = 0` must not collapse a long gap, and the day's rows must not shift. → Task 1 test `same-day second set keeps the gap`, Task 2 test `rows ignore today's sets`.
3. **Nothing left to pull** (daily number larger than everything active; all done or skipped): no Next row, the nothing-left state names what comes next, never an empty list with a dead button. → Task 2 tests `next row hidden when nothing is left`, `nothing left names the next day`.
4. **A picked exercise archived or paused later the same day:** it leaves Today and Coming up's + never adds a paused one. → Task 2 test `picked but archived or paused is dropped`, Task 3 test `addPicks refuses a paused or archived exercise`.
5. **Double taps** (Next 5 tapped twice, + tapped twice before the reply): no duplicate rows. → Task 3 test `addPicks ignores an exercise already picked today`, Task 5 test `next twice picks distinct exercises`.

---

## Waves (what can run at once)

- **Wave 1:** Task 1.
- **Wave 2 (parallel, separate worktrees):** Task 2, Task 3, Task 4, Task 8.
- **Wave 3:** Task 5, then Task 6 ‖ Task 7 (parallel).
- **Wave 4:** Task 9 (cleanup, docs, the whole check).

---

### Task 1: The schedule (pure) and its server reader

**Files:**
- Create: `src/lib/schedule/feel.ts`, `src/lib/schedule/schedule.ts`, `src/lib/schedule/words.ts`, `src/lib/server/schedule.ts`
- Test: `src/lib/schedule/feel.spec.ts`, `src/lib/schedule/schedule.spec.ts`, `src/lib/schedule/words.spec.ts`, `src/lib/server/schedule.spec.ts`

**Interfaces:**
- Produces (`feel.ts`): `type Feel = 'hard' | 'getting' | 'gotit' | 'easy'`; `FEELS: readonly Feel[]` (that order); `FEEL_WORD: Record<Feel, string>`; `RATING_OF: Record<Feel, 1 | 2 | 4 | 5>`; `feelOf(rating: number | null): Feel | null`.
- Produces (`schedule.ts`): `STEPS` (the numbers, one object); `interface ScheduleSet { doneAt: number; rating: number | null }`; `interface ScheduleState { gap: number; lastDay: string | null; dueDay: string }`; `nextGap(gap: number, e: number, feel: Feel | null): number`; `replay(startGap: number, createdAt: number, sets: ScheduleSet[], timeZone: string, beforeDay?: string): ScheduleState` (sets in any order; `beforeDay` ignores sets on or after that local day); `interface FacePreview { feel: Feel; gap: number }`; `preview(state: ScheduleState, today: string): { faces: FacePreview[]; early: { lastDay: string; dueDay: string } | null }` (hypothetical set today; `early` when `daysBetween(lastDay, today) < gap`).
- Produces (`words.ts`): `gapWords(days: number): string` ("Tomorrow", "3 days", "1 week", "10 days", "3 weeks", "2 months", "1 year": days < 14 as days except 7 → "1 week"; < 56 as rounded weeks; < 365 as rounded months; ≥ 365 "1 year"); `backWords(days)` ("Back tomorrow", "Back in 3 days", "Back in a week", "Back in 2 weeks", "Back in 2 months"); `awayWords(today: string, day: string)` ("today", "tomorrow", "in 3 days", "in a week", "in 2 weeks", "in 4 months"); `dueWords(state: ScheduleState, today: string, neverDone: boolean): MetaPart[]` ("New" status; "Due today"; "2 days late" status; "Due Sunday" within 6 days, else "Due 14 Nov" via `format.ts`); `earlyLine(early, today): string` (the spec's sentence). `MetaPart` is the existing type from `src/lib/exercises/today.ts` (move it to `src/lib/types.ts` if importing it would be circular).
- Produces (`server/schedule.ts`): `scheduleStates(db: Db, wall: Wall, timeZone: string, beforeDay?: string): Map<number, ScheduleState>` (every non-archived exercise in the wall, one query for sets with `exerciseId, doneAt, rating`); `scheduleStateOf(db: Db, exerciseId: number, timeZone: string): ScheduleState`; `listScheduleSets(db: Db, wall: Wall): (ScheduleSet & { exerciseId: number })[]` (reused by Task 2's callers).

- [ ] **Step 1: Write failing specs.** `feel.spec.ts`: round-trip `feelOf(RATING_OF[f]) === f` for all four; `feelOf(3) === 'gotit'`; `feelOf(null) === null`. `schedule.spec.ts` (tz `Europe/Ljubljana`, fixed instants): table of `nextGap` cases — `nextGap(10, 10, 'gotit') === 25`; `nextGap(10, 40, 'gotit') === 25` (cap); `nextGap(75, 1, 'gotit') === 75` (floor); `nextGap(10, 1, 'easy') === 21`; `nextGap(30, 1, 'easy') === 39`; `nextGap(10, 1, 'getting') === 5` (early half); `nextGap(2, 2, 'getting') === 3`; `nextGap(75, 1, 'hard') === 1`; `nextGap(9, 5, null) === 9`; `nextGap(300, 300, 'easy') === 365` (max). `replay` cases — never done: `{ gap: every_days, lastDay: null, dueDay: <creation day> }`; the spec's three timelines (on time → back day 35; early "day 1" → back day 11, then on-time → day 36); `counts calendar days across midnight and DST` (sets 23:30 and 00:30 next day are e = 1; a gap spanning 25 Oct 2026 counts whole days); `same-day second set keeps the gap` (gotit then gotit same day: gap unchanged); `beforeDay` ignores today's sets. `preview`: on-time state gives faces `[1, 12, 25, 40]` for gap 10 after 10 days; early state returns `early` and faces `[1, 5, 10, 21]` for gap 10 after 1 day. `words.spec.ts`: each copy string above. `server/schedule.spec.ts`: `openDb(':memory:')`, a wall `U1_SALSA`, two exercises with sets → `scheduleStates` returns both; another person's exercise absent; archived absent.
- [ ] **Step 2: Run them, expect FAIL** (`nix develop -c npx vitest run src/lib/schedule src/lib/server/schedule.spec.ts`).
- [ ] **Step 3: Implement** the four modules. `replay` sorts by `doneAt`, walks `nextGap` with `e = daysBetween(prevDay, thisDay)` (first set `e = 0`, its "gap" the start gap), and rounds inside `nextGap`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(schedule): the Anki-style schedule, faces and words`.

---

### Task 2: Today's list and Coming up's groups (pure)

**Files:**
- Create: `src/lib/schedule/today-list.ts`, `src/lib/schedule/coming-up.ts`
- Test: `src/lib/schedule/today-list.spec.ts`, `src/lib/schedule/coming-up.spec.ts`

**Interfaces:**
- Consumes: Task 1's `replay`, `ScheduleSet`, `ScheduleState`, `awayWords`.
- Produces (`today-list.ts`):
  - `interface DayExercise { id: number; name: string; active: boolean; archived: boolean; createdAt: number; everyDays: number }`
  - `type PickKind = 'next' | 'add' | 'skip'`; `interface DayPick { id: number; exerciseId: number; kind: PickKind; createdAt: number }`
  - `interface DayInput<E extends DayExercise> { exercises: E[]; sets: (ScheduleSet & { exerciseId: number })[]; picks: DayPick[] /* today's only */; daily: number; now: number; timeZone: string }`
  - `type RowKind = 'done' | 'todo' | 'picked'`; `interface DayRow<E> { exercise: E; kind: RowKind; state: ScheduleState /* with today's sets */; start: ScheduleState /* start of day */; neverDone: boolean; pick: DayPick | null }`
  - `interface DayList<E> { today: string; rows: DayRow<E>[]; done: number; total: number; left: number; showNext: boolean; nothingLeft: { next: E; day: string; more: number } | null }`
  - `dayList<E>(input: DayInput<E>): DayList<E>` — the spec's "The list" exactly (day's queue from the start of day, first `daily`, skips removed and the next moves up; done rows = day's rows done, then other exercises with a set today, by first set today; to-do in queue order; picked not done in pick order; archived/inactive picks dropped; `showNext` when `left <= 1` and `inLine(input).length > 0`; `nothingLeft` when `left === 0` and nothing in line: the soonest-due active exercise not done today, its due day and how many more share that day).
  - `inLine<E>(input: DayInput<E>): E[]` — what Next N would take, in order: rest of the day's queue beyond the rows, then not-yet-due by due day (ties: creation, name); never done today, skipped today, already on Today, inactive or archived.
- Produces (`coming-up.ts`):
  - `type ComingRowState = 'add' | 'onToday' | 'doneToday' | 'skipped' | 'paused'`
  - `interface ComingGroup<E> { key: string /* 'waiting' | 'paused' | 'YYYY-MM-DD' */; day: string | null; away: string | null; rows: { exercise: E; state: ComingRowState; dueDay: string | null }[] }`
  - `comingUp<E>(input: DayInput<E>): ComingGroup<E>[]` — "Waiting" first (due by today, not on Today; skipped ones here with state `skipped`), then one group per due day ascending (`away` = `awayWords(today, day)`), then "Paused" (inactive, not archived). Exercises on Today are left out except as `onToday`/`doneToday` rows in their date group (spec: done today shows "Done today", no +).

- [ ] **Step 1: Failing specs** covering: daily 5 with 7 due → 5 rows, oldest due first; `rows ignore today's sets` (logging one of the 5 keeps the same 5, now with that one done; doing an off-list exercise adds a 6th done row, `total` 6); skip → the 6th moves in; picks after the rows in pick order with `kind 'picked'`; `picked but archived or paused is dropped`; never-done due on creation day queues behind an older overdue one; a class created today with two exercises does not push out an older row; `next row hidden when nothing is left`; `nothing left names the next day` (`{ next, day, more }`); `inLine` order and exclusions; daily changed mid-day changes rows. `coming-up.spec.ts`: groups order, `away` words, skipped in Waiting with state `skipped`, paused last with state `paused`, a year-away exercise alone in its own group, done today shown as `doneToday`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** both modules (start-of-day queue = `replay(..., beforeDay: today)`; `state` = `replay` with all sets).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(schedule): Today's day list and Coming up's groups`.

---

### Task 3: Storage — the daily number, the day's picks, Settings

**Files:**
- Modify: `src/lib/server/db/schema.ts` (users: `dailyCount: integer('daily_count')`; new `todayPicks` table), generate `drizzle/0030_*.sql` (`npm run db:generate`; read it: one `ALTER TABLE users ADD`, one `CREATE TABLE`, an index)
- Create: `src/lib/server/today-picks.ts`, `src/lib/server/today-picks.spec.ts`
- Modify: `src/lib/act.ts` (add `actAt`), `src/routes/[dance]/(today)/+page.server.ts` (actions `pick`, `unpick`), `src/lib/components/ui/Stepper.svelte` (optional `onchange?: (value: number) => void`), `src/routes/settings/+page.server.ts` (load `dailyCount`; action `dailyCount`), `src/routes/settings/+page.svelte` (first row of Practice), `src/routes/settings/settings-forms.spec.ts`

**Interfaces:**
- Consumes: Task 2's `DayPick`, `PickKind` (types only; import from `$lib/schedule/today-list`). If Task 2 has not merged yet, declare identical types locally and switch to the import at merge.
- Produces: table `today_picks(id integer pk autoincrement, user_id text not null references users(id) on delete cascade, exercise_id integer not null references exercises(id), day text not null, kind text not null check (kind in ('next','add','skip')), created_at integer not null)`, index `(user_id, day)`.
- Produces (`today-picks.ts`): `DAILY_DEFAULT = 5`, `DAILY_MIN = 1`, `DAILY_MAX = 30`; `dailyCountOf(db, userId): number`; `setDailyCount(db, userId, n: number): number` (clamped, returns stored); `picksFor(db, wall: Wall, day: string): DayPick[]` (only exercises in the wall); `addPicks(db, wall, exerciseIds: number[], day: string, kind: PickKind, now: number): number[]` (ids created; refuses — throws `PickRefused` → the action's 400 — an exercise outside the wall, archived, or (for `add`/`next`) inactive; ignores one already picked as add/next today; `add`/`next` deletes that exercise's `skip` today; `skip` deletes its `add`/`next` today); `removePick(db, wall, id: number): boolean`.
- Produces (`act.ts`): `actAt(path: string, name: string, fields: Record<string, string>): Promise<ActionResult>` — `act` with an explicit route path (`/${dance}`).
- Produces (actions on `(today)/+page.server.ts`): `pick` (fields `exerciseId`, `kind` `add|skip`) → `{ action: 'pick', pickIds: number[] }`; `unpick` (field `pickId`) → `{ action: 'unpick', ok: true }`; refusals `fail(400, { message })`.

- [ ] **Step 1: Failing specs** (`today-picks.spec.ts`, `openDb(':memory:')`, `U1_SALSA`/`U2_SALSA`): clamp and default; `addPicks ignores an exercise already picked today`; `addPicks refuses a paused or archived exercise`; refuses u2's exercise (owner wall); skip ↔ add replace each other; `removePick` only within the wall. `settings-forms.spec.ts`: `dailyCount` stores a clamped number, rejects non-numbers.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** schema + migration, `today-picks.ts`, `actAt`, the two Today actions, Stepper's `onchange`, Settings: load `dailyCount`; the "Exercises a day" stepper row first in Practice (`min 1`, `max 30`, `minusLabel 'Fewer'`, `plusLabel 'More'`), saving through the page's existing `save('dailyCount', { count })` on change, with the spec's help line under the group.
- [ ] **Step 4: Run, expect PASS;** open `/settings` at 390 px and 1280 px, change the number, reload, see it kept.
- [ ] **Step 5: Commit** `feat(today): the daily number and the day's picks`.

---

### Task 4: The four faces where sets are logged

**Files:**
- Modify: `src/lib/theme/tokens.ts`, `src/routes/layout.css` (tokens `easy`, `easy-soft`: light `#1f5fbf` / `#e6effc`; dark pair chosen to pass `contrast.ts` like the others, e.g. `#8fb4ff` / `#16243d`), `src/lib/theme/*.spec.ts` as needed
- Create: `src/lib/components/exercises/Face.svelte` (props `feel: Feel`, `size = 36`; the board's four drawn faces, colour from the feel's token), `src/lib/components/exercises/FaceRating.svelte` (props `value: Feel | null`, `onchange(feel: Feel)`, `preview: FacePreview[] | null`, `early: string | null`; four equal columns, fixed 3-row grid so faces sit level; hidden `<input name="rating">` = `RATING_OF[value]`; the early line under them), `src/lib/exercises/face-view.ts` (+ spec: tone classes per feel, the time label per column from `gapWords`)
- Modify: `src/lib/components/exercises/LogShell.svelte` (FaceRating in place of RatingStars; new optional prop `schedule?: ScheduleState` and `today?: string` feed `preview`; Log set disabled until a face — extend `src/lib/exercises/log-view.ts` main-state with `rated: boolean` and the hint "Pick how it went"), `src/lib/server/log-form.ts` (rating required, `fail(400, { message: 'Pick how it went' })`), `src/lib/components/player/SaveSetSheet.svelte` + `src/routes/[dance]/player/+page.server.ts` `save` (faces, required), `src/lib/components/exercises/SetList.svelte`, `src/lib/format.ts` `setSummary`, `src/lib/exercises/exercise-page.ts` (recent rating), `src/lib/components/exercises/LastTime.svelte` — show Face + word instead of stars
- Modify: `src/routes/[dance]/(today)/+layout.server.ts` (add `schedules: Record<number, ScheduleState>` from `scheduleStates`), `src/routes/[dance]/(today)/+layout.svelte` and `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` + its server load (pass `schedule`/`today` to `Log`)
- Modify: `src/lib/page-epoch.ts` (5 → 6: the log form's rating is now required)
- Delete if unused afterwards: `RatingStars.svelte`, `ui/Stars.svelte` (keep the kit gallery building)
- Test: `face-view.spec.ts`, `log-view.spec.ts`, `log-form` spec (find the existing one), the player save spec, stylesheet/token specs

**Interfaces:**
- Consumes: Task 1 (`Feel`, `FEELS`, `FEEL_WORD`, `RATING_OF`, `feelOf`, `ScheduleState`, `preview`, `gapWords`, `earlyLine`, `scheduleStates`).
- Produces: `Face.svelte`, `FaceRating.svelte` (props above); `LogProps` gains `schedule?: ScheduleState; today?: string`; Today layout data gains `list.schedules`.

- [ ] **Step 1: Failing specs:** log-view `rated: false` → main state disabled with "Pick how it went"; `logSetFrom` without rating → 400 "Pick how it went", with `rating=4` → stored 4; player `save` the same; `face-view` time labels for a preview; `setSummary` prints the face word, not ★; the token specs see `easy`/`easy-soft` in all four theme blocks and pass contrast.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Backfill (past day) logs show faces without times (`preview` null).
- [ ] **Step 4: Run, expect PASS;** in a browser at 390 px: Today's + popup shows the four faces with times, Log set disabled until one is picked, a log succeeds; at 1280 px the pane's form the same; the player's Save set asks a face.
- [ ] **Step 5: Commit** `feat(log): four faces replace the stars`.

---

### Task 8: No frequency anywhere; due words where it was shown

**Files:**
- Modify (remove the field and its reading/validation; creators keep the column default): `src/lib/components/today/NewExerciseSheet.svelte` (single level, no How often), `src/routes/[dance]/(today)/+page.server.ts` `createExercise`, `src/lib/components/lessons/NewLessonSheet.svelte` + `src/lib/server/lesson-form.ts` + `src/routes/[dance]/lessons/+page.server.ts` + `src/routes/[dance]/lessons/+layout.svelte` + `src/routes/[dance]/groups/[id]/+page.svelte` (the `frequency` prop), `src/routes/[dance]/lessons/[id]/+page.svelte` + `+page.server.ts` (`newExercise`, `newRoutine`), `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (FrequencyField and the read-only How often row) + `+page.server.ts` (`update`, load), `src/lib/server/exercises.ts` (`SettingsInput` without `everyDays`; `updateExercise` keeps the row's), `src/lib/server/clash.ts` + `src/lib/clash/clash.ts` (drop `everyDays` from `seen` and labels), `src/lib/components/links/LinkPopup.svelte` + `src/lib/video/link-steps.ts` + `src/lib/server/link-popup.ts` + `src/lib/types.ts` (`LinkCreate`), `src/lib/picker/build.ts`
- Modify (due words instead of `frequencyLabel`): `src/lib/figures/page.ts` `practiceLine(state: ScheduleState | null, today: string, neverDone: boolean)` + `src/routes/[dance]/(moves)/figures/[id]/+page.server.ts` (use `scheduleStateOf`, drop `plan`) + its `+page.svelte` fallback; `src/lib/lessons/page.ts` (`routineMeta`, `exerciseMeta`, `reviewMeta` take `state`/`today`) + lessons `[id]` load (states via `scheduleStates`) and pass `schedule`/`today` to that page's `Log`; `src/lib/player/view.ts` `exerciseLine({ source, state, today })` + player load
- Delete: `src/lib/frequency.ts`, `src/lib/components/exercises/FrequencyField.svelte` (once nothing imports them)
- Test: the specs beside each changed pure module (`figures/page.spec.ts`, `lessons/page.spec.ts`, `player/view.spec.ts`, `picker/build.spec.ts`, `link-steps` spec, clash specs, lesson-form spec, the routes' form specs that posted `everyDays`)

**Interfaces:**
- Consumes: Task 1 (`ScheduleState`, `dueWords`, `scheduleStates`, `scheduleStateOf`), Task 4's `LogProps.schedule/today` (if Task 4 has not merged, pass them anyway; the merge resolves).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Update/failing specs:** `practiceLine` returns due words ("Due Sunday", "2 days late", "New"); lesson metas the same; `exerciseLine` "Figure · Due today"; posting a form without `everyDays` creates with the default; `clash` `seen` no longer contains `everyDays`; `link-steps` drill fields `['name']`; `grep -rn "frequencyLabel\|FrequencyField\|isFrequency" src` empty.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Group drills: no How often for editors either (spec "What goes away").
- [ ] **Step 4: Run the changed specs, expect PASS;** open New exercise, New lesson, a lesson's New drill, a figure page and the player at 390 px: no frequency anywhere, due words shown.
- [ ] **Step 5: Commit** `feat(today): no frequency to set; due words where it showed`.

---

### Task 5: Today's list on phone and desktop

**Files:**
- Modify: `src/routes/[dance]/(today)/+layout.server.ts` (replace `plan()` and `lastRatings` with `day: DayList` from `dayList`, inputs from `listExercises`, `listScheduleSets`, `picksFor(today)`, `dailyCountOf`; keep `schedules`), `src/routes/[dance]/(today)/+page.server.ts` (action `next`: `addPicks(inLine(input).slice(0, daily) ids, 'next')` → `{ action: 'next', pickIds }`), `src/lib/exercises/today.ts` (rewrite: `rowMeta(row: DayRow<ExerciseItem>, today: string, lessonDay: string | null): MetaPart[]` per the spec's metas; `todayHero(day: DayList): { title: string; meta: string; progress: number; state: 'todo' | 'done' }`; drop the bands), `src/lib/exercises/session.ts` (walk to-do rows then picked rows), `src/lib/exercises/today-pane.ts` (`defaultOpen(day: DayList)`: first to-do, else first picked, else null)
- Create: `src/lib/components/today/TodayBar.svelte` (the bar card: title, bar in `done` on `field-line`, "x of y done", play button starting the session; done variant without play), `src/lib/components/today/NextRow.svelte` (the "+ Next N" last row of the list card; busy while posting; refusal message as a toast), `src/lib/components/today/NothingLeft.svelte` (the card naming what comes next)
- Modify: `src/lib/components/today/TodayList.svelte` (one "Today · N" group; NextRow inside the card; NothingLeft; keep EmptyState and Custom exercise), `src/lib/components/today/ExerciseRow.svelte` (`row: DayRow<ExerciseItem>`, metas from `rowMeta`, done tile/tone, no rating dots), `src/routes/[dance]/(today)/+layout.svelte` (bar card in place of the Start session hero; session over the new rows; `defaultOpen`), `src/routes/[dance]/(today)/+page.svelte` (past day rows without bands)
- Test: `today.spec.ts`, `session.spec.ts`, `today-pane.spec.ts`, `today-layout.spec.ts`, a `next` action spec (`next twice picks distinct exercises`), `today-forms.spec.ts` still green

**Interfaces:**
- Consumes: Task 2 (`dayList`, `inLine`, `DayList`, `DayRow`), Task 3 (`picksFor`, `addPicks`, `dailyCountOf`, `actAt`), Task 1 (`listScheduleSets`, `backWords`, `dueWords`), Task 4 (`schedules`).
- Produces: layout data `list.day: DayList<ExerciseItem>`; `rowMeta`, `todayHero`; components `TodayBar`, `NextRow`, `NothingLeft`. Task 6 adds a link to `NothingLeft` (prop `comingUpHref?: string`) and the band icon; Task 7 wraps rows in a swipe.

- [ ] **Step 1: Failing specs** for `rowMeta` (each meta string), `todayHero` ("3 left for today" / "2 of 5 done" / "All 5 done"), session order, `defaultOpen`, the layout load returning `day` with 5 rows for 7 due, `next twice picks distinct exercises`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Picked rows use the same row with their meta; the row's + still opens the log popup (phone); on desktop rows have no + (desktop spec).
- [ ] **Step 4: Run, expect PASS;** browser at 390 px and 1280 px with seeded data: 5 rows of 7 due, log one (stays, ticked), Next 5 after the 4th, all done, nothing left; desktop opens the first to-do.
- [ ] **Step 5: Commit** `feat(today): a number a day, the bar card and Next N`.

---

### Task 6: Coming up

**Files:**
- Create: `src/routes/[dance]/(today)/coming-up/+page.svelte` (+ `+page.server.ts` only if it needs its own load; prefer the `(today)` layout's data), `src/lib/components/today/ComingUpList.svelte`
- Modify: `src/routes/[dance]/(today)/+layout.server.ts` (add `coming: ComingGroup<ExerciseItem>[]` from `comingUp`), `src/routes/[dance]/(today)/+layout.svelte` (band icon `calendar`, label "Coming up", beside Settings on the phone and in the band row on desktop; on desktop the list column shows Coming up when on `coming-up` or on an exercise opened from it — follow `src/lib/nav/moves-pane.ts`'s opener pattern), `src/lib/nav/tabs.ts` (`SECTION['coming-up'] = 'today'`), `src/lib/nav/pane.ts` (route + list home), `src/lib/components/today/NothingLeft.svelte` ("See what's coming" → Coming up)
- Test: `tabs.spec.ts`, `route-ids.spec.ts`, a pane/opener spec like `moves-pane.spec.ts`, a load spec for `coming`

**Interfaces:**
- Consumes: Task 2 (`comingUp`, `ComingGroup`), Task 3 (`actAt`, actions `pick`/`unpick`), Task 5 (layout, `NothingLeft`).
- Produces: route `/[dance]/coming-up`.

- [ ] **Step 1: Failing specs:** `tabFor('/salsa/coming-up') === 'today'`; route ids exist; the opener keeps Coming up beside an exercise opened from it; the load's `coming` groups.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Row: tile, name, then + (`actAt('/'+dance, 'pick', { exerciseId, kind: 'add' })`, toast "<name> is on Today" with Undo → `unpick`), or "On Today" chip (`done-soft`), or "Done today", or "Paused"; a skipped row's + is the same add. Headings: date left (with year when not this year), `away` right. The row link opens the exercise.
- [ ] **Step 4: Run, expect PASS;** browser 390 px and 1280 px: icon → Coming up, add one, it shows on Today as "Added · due …", Undo removes it.
- [ ] **Step 5: Commit** `feat(today): Coming up`.

---

### Task 7: Not today and Undo

**Files:**
- Modify: `src/lib/components/routines/Swipeable.svelte` (prop `tone: 'danger' | 'warn' = 'danger'`; warn = `bg-warn-soft text-warn`), `src/lib/components/today/TodayList.svelte` (phone: each to-do and picked row swipeable, end action "Not today", icon `redo`; disabled on desktop), `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (phone: at the very end, a quiet text button "Not today" with "It comes back tomorrow"; desktop pane: the same button under Log set; shown only while the exercise is on Today and not done today), `src/routes/[dance]/(today)/+layout.svelte` (toasts: "Not today · Undo" → `unpick`; after any log "<name> · back in <gapWords>" with Undo → `/{dance}?/deleteSet`), `src/lib/components/exercises/LogShell.svelte` (`onlogged` also passes `setId`), `src/routes/[dance]/player/+page.server.ts` (`save` redirects to `/${dance}?logged=<setId>`; Today shows the same Undo toast, then drops the param with `replaceState`)
- Test: a `Swipeable` tone spec or class-rules coverage, `today.ts` toast-words spec (`undoLogMessage(name, gap)`), player save redirect spec

**Interfaces:**
- Consumes: Task 3 (`actAt`, `pick`/`unpick`), Task 5 (rows, layout), Task 4 (`deleteSet` unchanged), Task 1 (`gapWords`).
- Produces: `undoLogMessage(name: string, gap: number): string` in `src/lib/exercises/today.ts`.

- [ ] **Step 1: Failing specs:** `undoLogMessage('Basic step on 1', 75) === 'Basic step on 1 · back in 75 days'` (uses `gapWords` lower-cased after "back in"; "back tomorrow" for 1); player save redirect carries `logged`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** A failed skip/unpick/delete shows the refusal toast and leaves the row as it was.
- [ ] **Step 4: Run, expect PASS;** browser 390 px: swipe a row → gone, the next moves up, Undo brings it back; log → toast → Undo removes the set and the row is to-do again; exercise page Not today at the end; 1280 px: the pane's Not today under Log set.
- [ ] **Step 5: Commit** `feat(today): Not today and Undo`.

---

### Task 9: Cleanup, reminder, docs, the whole check

**Files:**
- Modify: `src/lib/server/devices.ts` `dueByDance` (names of Today's to-do and picked rows not done, via `dayList`; empty when all done) + `devices.spec.ts` + `src/routes/[dance]/owner-wall.spec.ts` expectations
- Delete: `src/lib/urgency/urgency.ts` and its spec once nothing imports `plan`/`Plan`/`PlanRow` (fix the remaining type imports)
- Docs: `CLAUDE.md` (the rule "Urgency is never stored" rewritten per the spec's "Rules and docs to update"; `every_days` in the vestigial list; Layout entries for `src/lib/schedule/`, `src/lib/server/schedule.ts`, `src/lib/server/today-picks.ts`, Coming up; the spec link in the intro list), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (Today section and the urgency row in Pure modules), `2026-09-28-exercise-types-design.md` (rating), `2026-09-23-lessons-design.md` ("Go over it again"), `2026-11-03-desktop-design.md` (Today: bar card, Next row, Not today in the pane, Coming up), `2026-11-02-groups-design.md` (a drill's How often), and the new spec's Status line ("Built 2026-11-xx").
- Test: whole suite

- [ ] **Step 1:** `dueByDance` spec: 7 due, daily 5 → 5 names; after logging all of today's → `[]`.
- [ ] **Step 2:** Implement, delete `urgency`, update docs.
- [ ] **Step 3:** `timeout 1800 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 nix develop -c npm run check` → passes (prettier, eslint, svelte-check, build, vitest).
- [ ] **Step 4:** Commit `chore(today): reminder counts Today; urgency goes; docs`.
