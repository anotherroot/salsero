# Today: a number a day, four faces, and Anki-style scheduling

Status: built 2026-11-05 (see "Decided while building" at the end). Built on master with
the desktop layout (merged 2026-11-05). Part 1 of three from the
"app for people who just follow their class" brainstorm; parts 2 (the levels
and the simple screens) and 3 (comments on lessons) get their own specs.

Boards: [`docs/superpowers/boards/2026-11-05-today-scheduling.html`](../boards/2026-11-05-today-scheduling.html)
(the phone screens chosen with the user, salsa and bachata, and the rule drawn
as three timelines). Open it in a browser. Desktop is described here, not drawn.

## Why

The app was built by and for someone who sets things up: every exercise has a
frequency ("every 3 days"), and Today shows everything that is due. The user's
partner pointed out that the middle-aged women in their salsa class would find
it hard. Two things make Today hard for them:

- **Setting a frequency** for each exercise is a decision they cannot make well
  and should not have to.
- **A wall of due exercises.** The user's own Today showed "37 due", every row
  "Never done · Every 3 days". After a few days away the wall only grows, and
  that is stressful.

So Today becomes like Anki: nobody sets a frequency. After practising you say
how it went, and the app decides when it comes back. Today shows only a small
number a day, and more is one tap away.

## Goals

- No frequency anywhere. When an exercise comes back is decided by how it felt
  the last times, Anki-style, **for everyone**, at every level of use.
- Today shows a set number a day (5 by default, a stepper in Settings). Missing
  a few days never piles up on Today.
- "Next 5" brings the next ones in line, so a keen day can go on.
- Every exercise can be seen with the day it comes back (Coming up), and any of
  them can be put on Today by hand.
- One exercise can be skipped for today (Not today).
- A misclick is easy to fix (Undo; or rate it again next time).
- Phone and desktop.

## Non-goals

- The simple screens for people who follow a class (the "I practised this"
  page, My class, the simple player): part 2.
- Comments on lessons: part 3.
- A memory model fitted per person (FSRS) or per-exercise ease (classic SM-2).
  See "The schedule" for why, and why switching later costs nothing.
- Notifications beyond the existing daily reminder.

## Anti-goals

- **A number that grows when you are away.** Today never shows more than the
  daily number unless the person asks.
- **Punishing early practice.** Doing something before it is due must never
  push it far into the future on thin evidence, nor make its gap shorter for
  having remembered it.
- **Rewarding absence.** Coming back after a month and remembering something
  must not send it three months away.
- **A stored "next due".** The app's rule stands: what is due is worked out from
  the sets, never kept in a column.

## The schedule

Every exercise has a **gap**: the number of whole days it waits after the
last time it was done. It is worked out by replaying the exercise's sets in
order. It is never stored.

### Inputs per set

- Its local day (`localDay(doneAt, tz)`).
- Its **feeling**, one of four faces: *Still hard*, *Getting there*, *I've got
  it*, *Easy*. Stored in `sets.rating` (below), or none for older sets.

### Replaying

Start with `gap = exercise.every_days` (the old frequency, default 3). For each
set in time order (one review per local day, below), with `e` = calendar days since the previous set (`daysBetween`
of the two local days; 0 for two sets on one day; for the first set, `e = 0`):

| Feeling | New gap |
|---|---|
| Still hard | 1 |
| Getting there | max(3, used × 1.2); done early: max(that, gap ÷ 2) |
| I've got it | max(7, used × 2.5, gap) |
| Easy | max(21, used × 4, gap × 1.3) |
| none (older sets) | gap unchanged |

where `used = min(e, gap)`, and "done early" means `e < gap`.

- **`used = min(e, gap)`** is the user's cap: only the days it was meant to
  wait count. Remembering after a month away, for a 10-day gap, counts as 10.
- **The `gap` term in I've got it** (and `gap × 1.3` in Easy) is the floor for
  early reviews: an exercise with a 75-day gap, done again the next day through
  Next 5 and rated I've got it, keeps 75 days (counted from now). It does not
  drop to 2 days because `used` was 1.
- **A misclick is undone by the next rating:** a gap only gets the floor from
  I've got it and Easy. If she rated I've got it by mistake and the next day
  feels it needs work, Getting there or Still hard bring it back sooner.
- Gaps are rounded to whole days (half up), at least 1, at most 365 *(my call)*.
- **Due day** = the local day of the last set + gap. Never done: due on the
  local day it was created (so a class's new exercises queue behind older
  overdue ones, not ahead of them).

The numbers (× 1.2, × 2.5, × 4, the floors 3/7/21, the cap) are a starting
point the user agreed to tune. They live in one table in the pure module.

**Why this one** (the user chose it over the alternatives):

1. *This* — fixed steps plus the cap and the floor. Simple, explainable, and the
   face buttons can show exact times.
2. Classic Anki (SM-2): the same, plus a per-exercise ease that drops on Still
   hard and rises on Easy.
3. FSRS (Anki's newest): a fitted memory model. Too opaque, and it needs more
   reviews than a dance move gets.

Because the gap is replayed from the sets every time, moving to 2 later changes
no stored data.

### What the face buttons say

Each face shows the time it would set, worked out by the same function with a
hypothetical set now: "Tomorrow", "3 days", "1 week", "3 weeks", "2 months".
Done early, a line under the faces says so: "Done early: you last did it
yesterday, it was due on Saturday 14 Nov." (Board: "Done early".)

### Storing the feeling

`sets.rating` already exists, nullable, CHECK 1–5 (the old stars). No migration:

- **Written:** Still hard = 1, Getting there = 2, I've got it = 4, Easy = 5.
- **Read:** 1 Still hard, 2 Getting there, 3 and 4 I've got it, 5 Easy. Old
  star ratings read sensibly; null is "none".

## Today on the phone

Board: "Today", "1 left", "All done", "Nothing left".

### The list

One list replaces the four bands (Due, Not yet due, Done today, Inactive).

**Once on Today, a row stays until it is done or skipped** (the user's choice,
2026-11-05). Doing something else first — a picked row, or a figure from a
lesson page — never pushes a row off. This needs no stored list: the day's
rows are worked out from the **start of the day**, ignoring today's sets.

- **The day's queue:** active, not archived exercises, due on or before today
  **as of the start of today** (the schedule replayed without today's sets),
  not skipped today; by due day, earliest first; ties by creation time, then
  name. It does not change as sets are logged during the day.
- **The day's rows:** the first `daily` of the day's queue. Each shows done
  (ticked) once it has a set today, else to do. A skip takes one out, and the
  next in line moves up into its place.
- **Today · N** — what is on Today, in this order:
  1. Done today: the day's rows that are done, then any other exercise done
     today (from a lesson, the player, Coming up's +): in the order of their
     first set today, ticked green, meta "Done · Back in a week" (the new gap,
     in words).
  2. To do: the day's rows not done yet, in queue order.
  3. Picked today (Next 5 and Coming up's +) not done yet, in the order they
     were picked.
- N is all of them, so it can pass the daily number ("Today · 6"); the bar
  card counts done of N.
- Changing the daily number mid-day changes the day's rows at once. An
  exercise created today (a class published today) is due today and queues
  behind everything due earlier, so it does not push out a row already shown
  unless that row was also new today and created later.
- Row metas: "New · from class Tue 3 Nov" (never done), "2 days late", "Due
  today", "Ahead · due Sunday" (picked before its day), "Added · due tomorrow"
  (from Coming up). "New" and "late" in the status colour, as now.
- The row's own **+** (log) stays, as now; the row opens the exercise page.
- What used to be Not yet due and Inactive is on Coming up.

Something done elsewhere today shows on Today as an extra done row; it does
not use up one of the day's rows.

### The top card

The Start session card becomes the **bar card** (board "Today"):

- Title "3 left for today"; under it a bar (`done` colour on `field_line`) and
  "2 of 5 done". No dots (they do not fit 20), no minutes.
- Play starts the existing session, walking the to-do rows in order.
- All done: "All 5 done", a full bar, "That's today's practice", no play.

### Next 5

Board: "1 left", "All done".

- **The last row of the list card:** "+ Next 5" in accent text, centred, as a
  row (not a separate button). The number is the daily number.
- **Shows when one or none is left to do,** and there is anything left to pull.
- **Tapping it** picks the next N in line, saved for today (below): first the
  rest of the queue, then exercises not yet due by due day. Never one done
  today or skipped today. They appear as "Picked today", metas "Ahead · due …".
- **Nothing left at all** (board "Nothing left"): the card says "You've done
  everything", and a card shows what is next ("Dile que no · Tomorrow · then 3
  more on Sunday").

### Not today

- **Swipe a row left** on Today: "Not today" (`warn_soft`, the redo icon).
  Board: "Swipe on Today". The gesture is the routine editor's swipe
  (`src/lib/gestures/`).
- **At the very end of the exercise page,** after everything else: a quiet text
  button "Not today", "It comes back tomorrow" under it. Board: "At the end of
  an exercise" (drawn on part 2's simple page; on today's exercise page it goes
  under History and Settings).
- It is not a rating: the gap does not change. The exercise is gone from Today
  until tomorrow; it is still due, so tomorrow it is near the front of the
  queue. The next in line fills its place today.
- A toast "Not today · Undo".

### Undo

After a set is logged (any way: the log popup, the session, the player): a
toast "Basic step on 1 · back in 75 days · Undo" for the toast's usual time.
Undo deletes that set (sets are already a hard-delete kind). Board: "Undo".

### Past days

Unchanged: `?day=` shows what was done that day. The add-a-forgotten-set flow
asks for a face like every other log.

## Rating where sets are logged

Board: "The log popup".

- **The log popup** (every type's, through `LogShell`): the "How did it go?"
  stars become the four faces, in the chosen style: four equal columns, each a
  soft tint with a 2 px ring in its colour, a drawn face, the feeling, the time.
  Colours: Still hard red (`danger`/`danger_soft`), Getting there amber
  (`warn`/`warn_soft`), I've got it green (`done`/`done_soft`), Easy blue
  (`#1f5fbf` / `#e6effc` light; a dark pair to add to the tokens). Faces level
  with each other however the words wrap (a fixed three-row grid).
- **A face is required to log a set** *(my call)*: Log set stays disabled until
  one is picked. Minutes, reps and note stay as each type has them.
- **The player's Save set sheet** and the session ask the same faces.
- **Where a rating is shown** (the Today row's five dots, the history's stars,
  `LastTime`): the face and its word instead.

## Coming up

Board: "Coming up", "Today after adding".

- **Opened from a calendar icon in Today's band,** beside Settings. A page in
  the Today area: `/[dance]/coming-up`, Today lit.
- **One group per due day:** the date on the left of the heading ("Sun 8 Nov";
  with the year when it is not this year), how far away on the right
  ("tomorrow", "in 3 days", "in a week", "in 4 months"). The rows carry no
  distance. One far-away exercise is its own group.
- **First group, when there is one: "Waiting"** — due already but not on Today
  (past the daily number). *My call.*
- **Last group: "Paused"** — inactive exercises, no date. *My call:* they had
  their own band on Today.
- **Each row:** the type tile, the name, and a **+** that puts it on Today
  (saved for today, a toast "Setenta is on Today · Undo"); then a green "On
  Today" instead of the +. Done today: "Done today", no +. The row itself opens
  the exercise.
- **Skipped today** (Not today) shows in Waiting, meta "Not today"; its + puts
  it back on Today (deleting the skip). *My call.*
- **Paused rows have no +:** "Paused" on the right; the row opens the exercise,
  where Active turns it back on. Adding never writes `exercises.active`.
  *My call.*
- On Today, an added one sits with the picked ones, meta "Added · due
  tomorrow", and "Today · 6".

## Other places that show a frequency

The figure page's practice line (`src/lib/figures/page.ts`), the player's
exercise line (`src/lib/player/view.ts`, "Type · Every 3 days") and the lesson
page's exercise metas (`src/lib/lessons/page.ts`) read `frequencyLabel`. They
show the due-day words instead: "Due Sunday", "Due today", "2 days late",
"New". *My call.*

## The daily reminder

`dueByDance` (`src/lib/server/devices.ts`) feeds the Android reminder ("N
exercises due"). It counts **what is left to do on Today** (Today's to-do and
picked rows not yet done), never the whole overdue queue, and returns nothing
once they are all done, so the reminder stays silent. The `{ due: string[] }`
shape stays, so no app release is needed. *My call* (the anti-goal rules out
the whole queue).

## Settings

Board: "Settings". In Settings → Practice, first row: **Exercises a day**, a
stepper (− 5 +, 1 to 30), help "Today shows this many. When they're done, Next 5
brings more." Saves on change, like the rest of Settings. *My call:* one number
per person, used by each dance's Today.

## What goes away

Every way to set a frequency:

- The exercise page's How often, the New exercise sheet's How often level, the
  New lesson sheet's "Go over it again", a figure's practice frequency, the
  Link popup's and the picker's frequency bits, a group drill's How often.
- `every_days` stays in the schema, read only as the first gap and for old
  unrated sets (vestigial otherwise, like `figures.style`; never dropped, never
  a new CHECK). New rows keep its default.
- The Today bands Not yet due and Inactive (now Coming up's groups).

## What is stored

- `users.daily_count` (integer, nullable, null = 5): Settings' number. Plain
  `ADD COLUMN`.
- A new table **`today_picks`**: `id`, `user_id`, `exercise_id`, `day`
  (`YYYY-MM-DD`, the person's local day), `kind` (`next` | `add` | `skip`),
  `created_at`. One row per pick. Only rows for today are read; older ones are
  inert *(left to the builder whether to purge them)*. Its dance and owner come
  through the exercise, like `sets`. Undo of an add or a skip deletes its row.

These are the person's choices for a day, not urgency: what is due is still
worked out from the sets every time.

## Desktop

From the desktop spec (`2026-11-03-desktop-design.md`), Today is a list on the
left and the open exercise as a pane on the right. This changes only what is
in them:

- **The list column** gets the bar card in place of Start session, the one
  Today · N list, and the Next 5 row. No swipe on desktop: the pane has Not
  today (below).
- **The pane's log form** gets the four faces with their times, in place of the
  stars; Log set stays pinned under it. **Not today** is a quiet text button
  under Log set. *My call.*
- **The calendar icon** is in the band row beside Settings. **Coming up** on
  desktop is its list in the list column (groups by date, the + on each row)
  and the clicked exercise in the pane, as Today does.
- After Log set the pane already says Logged and offers Next: the toast with
  Undo appears as on the phone.
- Settings' stepper is a row like any other.

## Pure modules and where things live

- The schedule (replay, due day, the preview for each face, the early line),
  Today's list (done, queue, picks, the Next 5 row's state, the nothing-left
  state) and Coming up's groups are pure, client-safe, `now` and `tz` as
  arguments, never `Date.now()` — in `src/lib/schedule/` (built; `src/lib/urgency/`
  and its `plan` are deleted).
- The words ("Back in a week", "in 4 months", "Ahead · due Sunday") in a pure
  view module, like `today.ts` now.
- Server: the picks (add, next, skip, undo) as page actions or `/api/` calls;
  the data functions take `db` first, scoped to the person's wall.

## Rules and docs to update

- **CLAUDE.md hard rule "Urgency is never stored":** it now reads: what is due
  is a pure function of the sets' days and faces; `today_picks` keeps only the
  person's choices for one day. "Priority IS frequency (`every_days`)" goes;
  `every_days` joins the vestigial list.
- **The main design spec's Today section,** the exercise types spec (the rating
  in the log popup), the lessons spec ("Go over it again"), the desktop spec's
  Today section, and the groups spec (a group drill's How often).
- **PAGE_EPOCH:** raised in the commit that changes the log forms (a new
  required field, removed frequency fields).

## Left to the builder

- The exact toast wording and timing, beyond what is quoted here.
- Whether `today_picks` older than today are purged, and when.
- How the session (Start session) treats picked rows: walking them after the
  to-do rows is the expectation.
- The dark-theme pair for Easy's blue (contrast-checked like the rest of
  `tokens.ts`).
- Whether the schedule lives in `src/lib/urgency/` or a new folder: settled, `src/lib/schedule/`.

## Calls made while writing this (check these)

- A face is required to log a set everywhere.
- The day's rows come from the start of the day, so they stay put (the user
  chose that rows stay; this is how).
- Never-done exercises are due on their creation day (queue behind overdue).
- Coming up has a "Waiting" group first and a "Paused" group last.
- One daily number per person, used by both dances.
- The gap is capped at 365 days.
- Desktop: Not today under Log set in the pane; no swipe.
- Old star ratings are read as faces (1 hard, 2 getting there, 3–4 got it, 5 easy).
- The reminder counts what is left on Today and goes silent when it is done.
- A skipped exercise shows in Coming up's Waiting, and its + undoes the skip.
- Paused exercises have no + on Coming up; adding never un-pauses.
- The figure page, the player and the lesson page show due-day words where
  they showed a frequency.

## Decided while building

- **One review per local day.** `replay` groups a day's sets; the day's **last
  rated** set's face (else none) is applied once, with `e` from the previous
  reviewed day. Two sets on one day, or a set logged again after Undo, never
  shrink or inflate a gap. This replaces "for each set in time order" in
  Replaying above: where that reads "set", read "reviewed day".
- **The reminder rule.** `dueByDance` returns, per dance, the names of Today's
  to-do and picked rows that are not done (`dayList` over `dayInputOf`, the
  list Today shows), and `[]` once they are all done, so the Android reminder
  stays silent. 7 due with a daily number of 5 gives 5 names. The
  `{ due: string[] }` shape is unchanged: no app release.
- **Nothing left.** The nothing-left card (the next exercise and its day) stays
  ABOVE the list, so many done rows never bury it; the list's label reads
  "Done today · N" in that state. Its meta is "Tomorrow · and 3 more" (the
  count on the same day), not the board's "then 3 more on Sunday".
- **Copy added during the build:** "Nothing left for today" (the top card in that
  state), "Nothing due today · You can practise ahead below" (no due rows but
  exercises to take), "Nothing on Today · Every exercise is paused" (nothing
  active at all), and the nothing-left meta above.
- **Group headings are gone from Today's rows:** Today is the one list the spec
  describes, in due-day order.
- **Face times reach every Log.** The log popup previews from the schedule at the
  START of today (`scheduleStates(db, wall, tz, today)`), passed as `schedule`
  and `today` from the Today layout, the exercise page, the lesson page and the
  figure page, so a second log the same day previews from the same base.
- **Dead data dropped:** `everyDays` is no longer sent with a lesson's routines,
  exercises or the pickers' exercises; the column stays, read only as the
  first gap.
- Coming up, Not today and Undo are built to the sections above.
