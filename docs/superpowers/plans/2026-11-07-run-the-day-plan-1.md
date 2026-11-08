# Run the day, plan 1: schedule and Today

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The slower gaps, Comes back (fixed rhythm, every day until it feels good, a teacher's setting) and Warm-up, stored and worked out; Today as two lists (Warm-up, Practice) with "7 for today", no lateness, Next in line and the band's +; the two settings in Edit.

**Architecture:** Two new nullable/default columns plus one JSON setting on `exercises`. A PURE `comes-back.ts` reads the setting; a PURE `scheduleOf` in `schedule.ts` turns sets + setting into a due state (fixed rhythm and learning on top of `replay`). `today-list.ts` splits warm-ups from the daily number. Nothing about what is due is stored. The old log popup, the session and the row's "+" stay as they are: plans 2 and 3 replace them.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-07-run-the-day-design.md`. The board with every screen, now and new: https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs (look at "Today", "Warm-up and Comes back"). Read `CLAUDE.md` (hard rules) first.

## Global Constraints

- What is due is never stored: only the person's choices (Warm-up, Comes back, the warm-ups' order).
- Never add a CHECK to `exercises`; `ADD COLUMN` only. Read the generated SQL before committing.
- Data functions take `db` first; specs use `openDb(':memory:')`, never `$DATA_DIR`.
- Elapsed time sorts, calendar days speak: days via `localDay`/`daysBetween`/`shiftDay`; no `Date.now()` in `src/lib/schedule` or `src/lib/day`.
- Nothing on screen says "late". A row due today or past its day shows no due wording on Today.
- List labels: **Warm-up · N** and **Practice · N**. Hero title: **"N for today"** before anything is done, **"N left for today"** after.
- Comes back words: "By how it went" / "The faces decide when it comes back."; switch "Every day until it feels good" / "Then the faces take over."; chips "3 good days" / "5 good days"; "Good means I've got it or Easy. 2 of 3 so far."; "On a fixed rhythm" / "Just Done, no faces."; chips "Every day" / "Every 2 days" / "Every 3 days" / "Weekly". Warm-up switch: "Warm-up" / "Do it first. It doesn't count toward your 5." (the person's daily number, not a literal 5).
- Only drills (`source` `custom` or `added`) have Comes back; every other type reads as "by how it went" whatever the column holds.
- Warm-up is the person's own: a group's exercise row never shows or saves it; copies don't carry it.
- Raise `PAGE_EPOCH` (`src/lib/page-epoch.ts`, now 6) in the commit that changes the exercise settings form.
- `npm run check` must pass at the end of every task.

## Review Focus

- A class drill entry whose drill holds an unreadable `comes_back` (or a member's own unreadable value): the page and Today still load, and it reads as by how it went. → Task 2 parse tests, Task 3 data test.
- Turning "every day until it feels good" on for a drill that already had good days: those days don't count; the drill is learning again from that day. → Task 2.
- A fixed-rhythm drill missed for days: on Today once, no "late", and the rhythm counts from the day it's next done. → Task 2, Task 4.
- A warm-up that is paused, archived, skipped (Not today) or already done: never in the Warm-up list as to-do, never counted in the daily number; added early from Coming up it joins Warm-up. → Task 4.
- A fixed-rhythm drill switched back to "by how it went": its unrated sets leave the gap as it was (no jump, no crash). → Task 2.

---

### Task 1: The slower gaps (G3)

**Files:**
- Modify: `src/lib/schedule/schedule.ts` (`STEPS`)
- Modify: `src/lib/schedule/schedule.spec.ts`, and any spec asserting old gap numbers (`grep -rn "nextGap\|preview(" src --include=*.spec.ts`)
- Modify: `docs/superpowers/specs/2026-11-05-today-scheduling-design.md` (the table under "Feeling | New gap": new numbers, and a line pointing to the run-the-day spec)

**Interfaces:**
- Produces: `STEPS = { getting: { floor: 2, used: 1.3, earlyShare: 0.5 }, gotit: { floor: 3, used: 1.5 }, easy: { floor: 7, used: 2, gap: 1.2 }, hardGap: 1, minGap: 1, maxGap: 365 }`. `nextGap` keeps its shape.

- [ ] **Step 1: Update the tests to the new numbers**

In `schedule.spec.ts`, rewrite the `nextGap` cases and add a sequence test:

```ts
it('I\'ve got it every time grows 3, 5, 8, 12, 18, 27, 41, 62, 93', () => {
	let gap = 3, e = 0; const seen: number[] = [];
	for (let i = 0; i < 9; i++) { gap = nextGap(gap, e, 'gotit'); seen.push(gap); e = gap; }
	expect(seen).toEqual([3, 5, 8, 12, 18, 27, 41, 62, 93]);
});
it('Easy every time grows 7, 14, 28, 56, 112, 224, 365', () => { /* same loop with 'easy', 7 steps */ });
it('Getting there on time uses used x 1.3, at least 2', () => {
	expect(nextGap(10, 10, 'getting')).toBe(13);
	expect(nextGap(1, 1, 'getting')).toBe(2);
});
it('caps at 365', () => expect(nextGap(300, 300, 'easy')).toBe(365));
```

- [ ] **Step 2: Run `npx vitest run src/lib/schedule` — the new cases FAIL.**
- [ ] **Step 3: Change `STEPS` to the values above.** Fix every other spec that pinned an old gap (run the whole suite to find them) by recomputing with the new numbers, not by loosening the assertion.
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Update the scheduling spec's table, commit** `feat(schedule): slower gaps (G3), longest still a year`.

---

### Task 2: Comes back, worked out (PURE)

**Files:**
- Create: `src/lib/schedule/comes-back.ts`, `src/lib/schedule/comes-back.spec.ts`
- Modify: `src/lib/schedule/schedule.ts` (add `scheduleOf`, `DueState`), `src/lib/schedule/schedule.spec.ts`

**Interfaces:**
- Produces (`comes-back.ts`):
  ```ts
  export type ComesBack =
  	| { kind: 'faces' }
  	| { kind: 'until'; good: 3 | 5; since: number } // since: epoch ms the switch went on
  	| { kind: 'every'; days: 1 | 2 | 3 | 7 };
  export const FACES: ComesBack; // { kind: 'faces' }
  /** Total: null, junk, an unknown kind or out-of-range numbers → null (= not set). */
  export function parseComesBack(raw: string | null | undefined): ComesBack | null;
  export function serializeComesBack(c: ComesBack): string; // JSON
  /** Only drills have it: other sources are FACES. Own wins, else the class drill's (entries), else FACES. */
  export function effectiveComesBack(source: Source, own: ComesBack | null, drill: ComesBack | null): ComesBack;
  /** "Every day", "Every 2 days", "Every 3 days", "Weekly". */
  export function rhythmWords(days: 1 | 2 | 3 | 7): string;
  ```
  (`Source` from `$lib/server/db/schema`'s `SOURCES` is server-side; take the union type from `$lib/types` or `kinds.ts`, whichever is client-safe.)
- Produces (`schedule.ts`):
  ```ts
  export interface DueState extends ScheduleState {
  	every: 1 | 2 | 3 | 7 | null;
  	learning: { good: number; of: 3 | 5 } | null; // set only while still learning
  }
  export function scheduleOf(
  	startGap: number, createdAt: number, sets: ScheduleSet[], comesBack: ComesBack,
  	timeZone: string, beforeDay?: string
  ): DueState;
  ```

Rules (spec, "What is worked out"): `faces` = `replay` with `every: null, learning: null`. `every N`: `lastDay` = last local day with a set (before `beforeDay`), `gap = N`, `dueDay = lastDay ? shiftDay(lastDay, N) : localDay(createdAt)`. `until`: run `replay`; a good day is a local day on or after `localDay(since)` (and before `beforeDay`) whose last rated set has `rating >= 4` (`feelOf` is gotit/easy); while `good < target`, `dueDay = lastDay ? shiftDay(lastDay, 1) : localDay(createdAt)` and `learning = { good, of }`; once reached, `replay`'s state with `learning: null`.

- [ ] **Step 1: Write the failing tests** (`TZ = 'Europe/Ljubljana'`, helpers like the existing spec's `at`/`day`):

```ts
describe('parseComesBack', () => {
	it.each([null, '', '{', '{"kind":"every","days":4}', '{"kind":"until","good":4,"since":1}', '{"kind":"x"}'])
		('%s is not set', (raw) => expect(parseComesBack(raw)).toBeNull());
	it('round-trips', () => {
		const c = { kind: 'until', good: 3, since: 1730000000000 } as const;
		expect(parseComesBack(serializeComesBack(c))).toEqual(c);
	});
});
describe('effectiveComesBack', () => {
	const every2 = { kind: 'every', days: 2 } as const;
	it('a lesson review is always faces', () => expect(effectiveComesBack('lesson', every2, null)).toEqual(FACES));
	it('an entry follows its class drill', () => expect(effectiveComesBack('added', null, every2)).toEqual(every2));
	it('the member\'s own wins', () => expect(effectiveComesBack('added', FACES, every2)).toEqual(FACES));
});
describe('scheduleOf', () => {
	it('every 2: due two days after the last set, never "late"', () => {
		const s = scheduleOf(3, at(D0), [unrated(day(0))], { kind: 'every', days: 2 }, TZ);
		expect(s).toMatchObject({ dueDay: dayStr(2), gap: 2, every: 2, learning: null });
	});
	it('every 1, missed for 5 days: still due on the day after the last set', () => {
		expect(scheduleOf(3, at(D0), [unrated(day(0))], { kind: 'every', days: 1 }, TZ).dueDay).toBe(dayStr(1));
	});
	it('every N never done: due on its creation day', () => { /* dueDay === localDay(createdAt) */ });
	it('until 3: daily while learning, counting good days from the switch', () => {
		const since = at(day(2));
		const sets = [gotit(day(0)), gotit(day(1)), gotit(day(2)), getting(day(3))];
		const s = scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since }, TZ);
		expect(s.learning).toEqual({ good: 1, of: 3 }); // days 0 and 1 were before the switch
		expect(s.dueDay).toBe(dayStr(4));
	});
	it('until 3: learnt on the third good day, then the faces\' gap', () => {
		const sets = [gotit(day(0)), easy(day(1)), gotit(day(2))];
		const s = scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since: at(D0) }, TZ);
		expect(s.learning).toBeNull();
		expect(s).toMatchObject(replay(3, at(D0), sets, TZ));
	});
	it('switched back to faces: unrated rhythm sets leave the gap', () => {
		const sets = [gotit(day(0)), unrated(day(3)), unrated(day(4))];
		expect(scheduleOf(3, at(D0), sets, FACES, TZ).gap).toBe(replay(3, at(D0), [gotit(day(0))], TZ).gap);
	});
	it('beforeDay leaves out that day\'s sets', () => { /* every 1 with a set today: before today it is due today */ });
});
```

- [ ] **Step 2: `npx vitest run src/lib/schedule` — FAIL (module missing).**
- [ ] **Step 3: Implement `comes-back.ts` and `scheduleOf`.** `parseComesBack` checks every field's type and range; nothing throws.
- [ ] **Step 4: `npx vitest run src/lib/schedule` — PASS; `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(schedule): comes back — fixed rhythm and learning, worked out from the sets`.

---

### Task 3: Store Comes back and Warm-up, and read them everywhere the schedule is read

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`exercises`), generate `drizzle/0034_*.sql` (`npm run db:generate`)
- Modify: `src/lib/types.ts` (`ExerciseItem`), `src/lib/server/exercises.ts` (`listExercises`), `src/lib/server/schedule.ts` (`scheduleStates`, `scheduleStateOf`), `src/lib/schedule/today-list.ts` (`DayExercise`, use `scheduleOf`)
- Test: `src/lib/server/schedule.spec.ts`, `src/lib/server/exercises.spec.ts` (or the existing spec for `listExercises`)

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - columns `comesBack: text('comes_back')` (nullable, JSON of `ComesBack`), `warmup: integer('warmup', { mode: 'boolean' }).notNull().default(false)`, `warmupOrder: integer('warmup_order')` (nullable).
  - `ExerciseItem` gains `comesBack: ComesBack` (effective), `comesBackOwn: ComesBack | null` (the row's own, parsed), `comesBackTeacher: ComesBack | null` (an entry's class drill's, parsed; null otherwise), `warmup: boolean`, `warmupOrder: number | null`.
  - `DayExercise` gains `comesBack: ComesBack; warmup: boolean; warmupOrder: number | null`. `DayRow.state` and `DayRow.start` become `DueState`.
  - `scheduleStates`/`scheduleStateOf` return `DueState`, using the effective Comes back (the entry's own, else its `drill_id` row's, through an alias join as `listExercises` already does for the team).

- [ ] **Step 1: Write the failing data tests:** `listExercises` returns `comesBack` = the class drill's for an entry with none of its own (build the class with `src/lib/server/test-class.ts`), the entry's own when set, `FACES` for a lesson review whose column holds `every 2`, and `FACES` when the column holds `'junk'`; `warmup` false by default. `scheduleStateOf` for an `every 1` drill with one set yesterday has `dueDay` today and `every: 1`.
- [ ] **Step 2: Run them — FAIL.**
- [ ] **Step 3: Add the columns, run `npm run db:generate`, read the SQL:** it must be three `ALTER TABLE \`exercises\` ADD \`…\`` lines and nothing else (no table rebuild). Then thread the fields through `listExercises`, `ExerciseItem`, `scheduleStates`, `scheduleStateOf` and `workOf` (`scheduleOf(e.everyDays, e.createdAt, sets, e.comesBack, tz[, today])`). Every other `ExerciseItem`/`DayExercise` literal in specs and fixtures gets the new fields (`comesBack: FACES, warmup: false, warmupOrder: null`): let `svelte-check` find them.
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): store comes back and warm-up; the schedule reads them`.

---

### Task 4: Today's two lists, no lateness, Next in line (PURE)

**Files:**
- Modify: `src/lib/schedule/today-list.ts`, `src/lib/schedule/today-list.spec.ts`
- Modify: `src/lib/exercises/today.ts` (`rowMeta`, `todayHero`, `listLabel` → `listLabels`), its spec
- Modify: `src/lib/schedule/words.ts` (`dueWords`), `src/lib/schedule/coming-up.ts`, `src/lib/schedule/coming-view.ts`, their specs

**Interfaces:**
- Consumes: Task 3's `DayExercise` fields, Task 2's `rhythmWords`.
- Produces:
  - `DayRow` gains `list: 'warmup' | 'practice'`. `DayList` gains `warmups: number` (warm-up rows) and keeps `rows` (warm-ups first, in their order, then practice in today's order), `done`, `total`, `left` over BOTH lists.
  - `workOf`: warm-ups (`e.warmup`) never enter the daily-number queue. A warm-up is a row when it is due (`start.dueDay <= today`, not skipped), done today, or picked (Coming up's +). Warm-up rows sort by `warmupOrder` (nulls last), then `byDue`. `lineOf` (Next N) never returns a warm-up. Practice works exactly as now on the non-warm-ups.
  - `todayHero`: when `left > 0`: title `${left} for today` if `done === 0`, else `${left} left for today`; meta unchanged (`${done} of ${total} done`).
  - `listLabels(day): { warmup: string | null; practice: string }` — `"Warm-up · N"` (null when no warm-up rows), `"Practice · N"` (`"Done today · N"` once nothing is left, as now).
  - `dueWords`: a past due day reads `Due today` (never "N days late").
  - `rowMeta`: a todo or picked row due today or earlier shows no due part; "New · from class …" stays; a drill row appends its rhythm or learning: `[{ text: 'Every 2 days' }]`, `[{ text: 'Learning · 2 of 3 good days' }]`; a done row stays "Done · …".
  - `coming-up.ts`: the `'waiting'` group excludes warm-ups (a due warm-up is on Today); each group row gains `meta: string | null` from `comingMeta(e, state: DueState)`: warm-up `"Warm-up · every day"` (its rhythm in lower case, or `"Warm-up"` when by how it went), else the rhythm, else `"Learning · 2 of 3"`, else null.
  - `comingHeading`: `'waiting'` → `"Next in line"`.

- [ ] **Step 1: Write the failing tests** (in the existing specs' style; build `DayInput`s with `comesBack`/`warmup`):
  - two warm-ups due + 6 practice due, daily 5 → rows: 2 warm-up then 5 practice; `total` 7; `inLine` returns the 6th practice, no warm-up.
  - warm-up order: `warmupOrder` 2 and 1 → the order-1 one first; a null order goes last.
  - a paused warm-up, an archived one, a skipped one → not rows; a warm-up done today → a done row with `list: 'warmup'`; a warm-up picked ahead of its day → a `picked` row with `list: 'warmup'`.
  - `todayHero` with 0 of 7 done → title "7 for today"; 2 of 7 → "5 left for today".
  - `listLabels` → `{ warmup: 'Warm-up · 2', practice: 'Practice · 5' }`; no warm-ups → `warmup: null`.
  - `dueWords` 20 days past → `[{ text: 'Due today', tone: null }]`.
  - `rowMeta` of a todo row 20 days past due, never-done false → `[]`; an every-2 drill → `[{ text: 'Every 2 days', tone: null }]`; learning 2 of 3 → `Learning · 2 of 3 good days`.
  - `comingUp`: a due warm-up is not in `'waiting'`; a warm-up due tomorrow is in tomorrow's group with meta `"Warm-up · every day"`; `comingHeading({ key: 'waiting', … })` → `"Next in line"`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.** Keep `dayListOf`'s nothing-left logic over both lists.
- [ ] **Step 4: `npm run check` passes** (components using `listLabel` are switched to `listLabels` in Task 5; keep `listLabel` as a thin wrapper until then if that's simpler, and delete it in Task 5).
- [ ] **Step 5: Commit** `feat(today): warm-ups outside the daily number, no lateness, Next in line`.

---

### Task 5: Today and Coming up draw it; New exercise is the band's +

**Files:**
- Modify: `src/lib/components/today/TodayList.svelte`, `ExerciseRow.svelte` (meta only), `ComingUpList.svelte`, `TodayBar.svelte` (if the hero's words live there), `src/routes/[dance]/(today)/+layout.svelte` (the band's + at every width)
- Test: `src/lib/components/today/today-forms.spec.ts` or a new `src/lib/exercises/today.spec.ts` case for anything PURE you add; shots below

**Interfaces:**
- Consumes: Task 4's `listLabels`, `DayRow.list`, group row `meta`.

- [ ] **Step 1:** TodayList: two `<section>`s with the app's `SECTION_LABEL`: **Warm-up · N** (only when `listLabels(day).warmup`), then **Practice · N**; each its own `GROUP` card of `ExerciseRow`s from `day.rows` filtered by `list`; NextRow stays the Practice card's last row. Rows keep their current look and "+" (plan 2 replaces the "+").
- [ ] **Step 2:** The bottom `+ Custom exercise` button goes (the phone's and the empty-state's stay: the empty state still offers "Custom exercise"). In `(today)/+layout.svelte`, the band's "Custom exercise" `+` shows at every width, not only desk (board: `today.jpg`, the + after the sliders). `focusAfterRemoval`'s fallback (layout comment at ~line 346) now lands on the band's +.
- [ ] **Step 3:** ComingUpList: each row shows its `meta` as the muted second line (the ExerciseRow meta style); the waiting heading reads "Next in line".
- [ ] **Step 4: Shots.** Shoot Today and Coming up (`scripts/shots/README.md`) on a copy of the latest backup with two drills set to warm-up and one to every 2 days (set the columns in the copy with `nix develop -c sqlite3`), and compare with the board's `today.jpg`, `coming-up.jpg`. No "late" anywhere; no overflow at 390.
- [ ] **Step 5: `npm run check` passes; commit** `feat(today): Warm-up and Practice lists; New exercise in the band`.

---

### Task 6: Save Warm-up and Comes back

**Files:**
- Modify: `src/lib/server/exercises.ts` (`SettingsInput`, `createCustomExercise`, `updateExercise`), `src/lib/server/clash.ts` (`exerciseSeen`)
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.server.ts` (`update`), `src/routes/[dance]/(today)/+page.server.ts` (`createExercise`)
- Create: `src/lib/server/comes-back-form.ts` (reads the form), with a spec
- Modify: `src/lib/page-epoch.ts` (6 → 7)
- Test: `src/lib/server/exercises.spec.ts`, `src/lib/server/changes.spec.ts` (History), the page's spec if it has one

**Interfaces:**
- Consumes: Task 2 (`ComesBack`, `serializeComesBack`), Task 3 columns.
- Produces:
  - `SettingsInput` gains `warmup?: boolean` and `comesBack?: ComesBack | 'teacher'` (`'teacher'` = clear an entry's own so it follows the class drill again; `undefined` = keep).
  - `readComesBack(form: FormData, current: ComesBack | null, now: number): ComesBack | 'teacher' | 'invalid' | undefined` — fields `comesBack` (`faces` | `every` | `teacher`), `until` (`on`), `good` (`3` | `5`), `every` (`1|2|3|7`). `since` is kept when the stored value is already `until` (switch stayed on), else `now`. Missing `comesBack` field → `undefined` (keep); a value out of range → `'invalid'` (the action answers `fail(400)`).
  - `updateExercise` writes `comes_back` only for drills (`custom`, `added`), `warmup` only for a person's row (`teamId === null`); a group drill's Comes back change is in its History line (add a `comesBack` field to the `fieldChange` fields as its words, e.g. "Every day until it feels good on 3 days") and in `exerciseSeen` (the `comesBack` raw value for a `custom` row), so the clash check covers it.
  - `createCustomExercise(db, space, { name, notes, warmup?, comesBack? })`.

- [ ] **Step 1: Write the failing tests:**
  - `readComesBack`: `{ comesBack: 'faces' }` → FACES; `{ comesBack: 'faces', until: 'on', good: '5' }` → until 5 with `since: now`; same while stored is until 3 since T → since T kept, good 5; `{ comesBack: 'every', every: '2' }` → every 2; `every: '4'` → `'invalid'`; no field → `undefined`.
  - `updateExercise` on a lesson review with `comesBack: every 2` leaves the column null; on a member's entry with `'teacher'` sets it null; on a group drill, `warmup: true` is not written and the History line names the Comes back change.
  - a stale form (`seen` with the old Comes back) on a group drill is refused by the clash check.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement; wire both actions; raise PAGE_EPOCH to 7.**
- [ ] **Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(exercises): save warm-up and comes back (a teacher's for the class)`.

---

### Task 7: The settings in Edit, New exercise, and a member's line

**Files:**
- Create: `src/lib/exercises/comes-back-view.ts` (+ spec): the words
- Create: `src/lib/components/exercises/ComesBackCard.svelte`, `WarmupRow.svelte`
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (edit mode and the page's line), `src/lib/components/today/NewExerciseSheet.svelte`

**Interfaces:**
- Consumes: Task 3's `ExerciseItem` fields (or the page load's row: add `comesBackOwn`, `comesBackTeacher`, `warmup` to the page's data), Task 6's form field names.
- Produces (`comes-back-view.ts`): `comesBackWords(c: ComesBack): string` ("By how it went", "Every day until it feels good on 3 days", "Every 2 days", "Weekly"); `learningNote(good: number, of: 3|5): string` ("Good means I've got it or Easy. 2 of 3 so far."); `teacherLine(c): string` ("Your teacher set: every day until it feels good on 3 days").

Look: the board's `edit-default`, `edit-learning`, `edit-rhythm`, `edit-figure-warmup`, `new-exercise`, `member-page`, `member-edit`, `teacher-edit`. The Warm-up row is the Active row's twin (`Switch`, label + muted line), right under Active; not drawn on a group's row. The Comes back card follows the Settings card under a `SECTION_LABEL` "Comes back" ("Comes back, for the class" on a group drill, with "Members can change it for themselves." muted under the card). Radios are the native accent radios LevelCards uses; chips are `CHIP` with the selected state; the switch's chips and note show only while the switch is on, the rhythm chips only while "On a fixed rhythm" is chosen. A member's entry: "Your teacher set: …" muted above the card while the class drill has one; once they have their own, a centred accent text button **Use my teacher's** posts `comesBack=teacher`. The page (not editing) of an entry following its class drill shows a card "Comes back" / the words / a "Set by your teacher" chip in the group's navy soft colours. Hidden at Follow my class (`simple(level)` from `levels.ts`); Warm-up shows at every level.

- [ ] **Step 1: Test `comes-back-view.ts`** (each words case above) — FAIL, then implement — PASS.
- [ ] **Step 2: Build the two components and wire them into edit mode and NewExerciseSheet (`use:guarded` forms as now).**
- [ ] **Step 3: Shots** of the Edit page in the three states and New exercise; compare with the board images named above.
- [ ] **Step 4: `npm run check` passes; commit** `feat(exercises): Warm-up and Comes back in Edit and New exercise`.

---

### Task 8: Clones carry Comes back, not Warm-up

**Files:**
- Modify: `src/lib/clones/flat.ts` (`ROOT_KEYS`, labels: add `comesBack`, label "Comes back"), `src/lib/server/clones/trees.ts` (`drillFlat` adds it, shown with `comesBackWords`), `src/lib/server/clones/apply.ts` (Take/Send write it), `src/lib/server/clones/clone.ts` (a copy carries `comes_back`, sets `warmup: false`, `warmupOrder: null`)
- Test: the existing clone specs (`src/lib/server/clones/*.spec.ts`)

- [ ] **Step 1: Failing tests:** Copy to… of a drill with `every 2` and `warmup` on → the copy has `every 2`, `warmup` false; Compare lists a Comes back difference; Take writes theirs.
- [ ] **Step 2: Run — FAIL. Step 3: Implement. Step 4: `npm run check` passes.**
- [ ] **Step 5: Commit** `feat(clones): a drill's comes back travels; warm-up stays the person's`.

---

### Task 9: Warm-ups in your own order

**Files:**
- Create: `src/lib/server/warmup-order.ts` (+ spec): `setWarmupOrder(db: Db, wall: Wall, ids: number[]): boolean` — writes `warmup_order` 1..n for the wall's own live warm-ups in `ids`, refuses (false) an id not the wall's or not a warm-up.
- Modify: `src/routes/[dance]/(today)/+page.server.ts` (action `warmupOrder`, field `ids` comma-separated), `TodayList.svelte` (drag to reorder the Warm-up card)

Drag uses the arithmetic in `src/lib/gestures/` the routine editor's reorder uses (long-press then drag, the same handle/feel); one post on drop, then `invalidate`. A keyboard path: the row's swipe-free menu isn't there, so give each warm-up row Move up / Move down in its long-press menu if the routine editor has that pattern; otherwise the drag alone, and say so in the report.

- [ ] **Step 1: Failing tests for `setWarmupOrder`** (orders, refuses another person's id, refuses a non-warm-up). **Step 2: FAIL. Step 3: Implement + wire the drag. Step 4: `npm run check`; try it in the dev server at 390 wide.**
- [ ] **Step 5: Commit** `feat(today): drag warm-ups into your own order`.

---

### Task 10: Docs

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-11-05-today-scheduling-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`

- [ ] **Step 1:** `CLAUDE.md` hard rules: "There is no frequency to set" → the drill exception (fixed rhythm and learning are a person's choice, worked out from the sets, never stored as due), and that warm-ups sit outside the daily number. Layout: `src/lib/schedule/comes-back.ts`, `scheduleOf`, `src/lib/server/warmup-order.ts`, `src/lib/exercises/comes-back-view.ts`. The "Today as a number a day" summary: Warm-up and Practice, no lateness.
- [ ] **Step 2:** The scheduling spec: warm-ups, fixed rhythm, learning, no lateness, Next in line; the main design spec's Today section likewise.
- [ ] **Step 3: Commit** `docs: run the day plan 1 (schedule and Today)`.
