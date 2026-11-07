# Run the day: one page per exercise, warm-ups, slower gaps

Status: agreed in brainstorming on 2026-11-07, not built. The design boards:
https://claude.ai/artifact/4udVsxmwPMRTWebNdpWpsz (round 1, directions A–C),
https://claude.ai/artifact/WYKy9HYn6GBmujnPCydT2W (rounds 2 and 3: direction B,
the picks L1 F1 T1, and the gap growth G1–G3) and
https://claude.ai/artifact/V1pUxNSP6VHw68Mu8APsTs (every screen that changes,
now and new, drawn with the app's own CSS). The last one is the reference for
how each screen looks.

## Why

Practising today means two screens per exercise: the exercise page, then a
log popup that repeats half of it and asks for minutes, reps, a face and a
note. After saving you're back on the list, and you pick the next exercise
yourself. Two kinds of practice also don't fit the schedule:

- **The warmup**, and a few drills like "Salsa to Son switching", should come up
  every day (or every 2 days) no matter how they went. A lesson review,
  a figure or a routine is different: it's practised less often as it sinks in.
- **A new, hard drill** (e.g. "Desni dvojni obrat") wants daily practice
  until it starts to feel good, and only then the usual spacing.

Also, the gaps grow too fast: "I've got it" every time brings an exercise
back after 7, 18, 45 and then 113 days, which is only 4 practices in
3 months. Dance moves fade faster than that.

## Goals

- **One page per exercise.** It shows everything about the exercise and has a
  pinned **Done** button. Done opens a bottom sheet asking "How did it go?",
  with a note box and **one row of four face cards**. **Tapping a face saves
  the set and moves to the next exercise**, with no second button.
- **Run the day.** "Start" on Today walks the day in order: the warm-ups first,
  then the day's N exercises (Next N extends it, as today). The run ends on a
  **Done for today** screen.
- **Time is never typed.** It counts from when the page opened, shows in the
  band, and is saved with the set. The end screen shows the day's total.
- **No reps.** Nothing asks for reps any more. Old reps still show in the history.
- **Warm-up**, a switch on any exercise. Warm-ups are their own short list at the
  top of Today, done first, and they **don't count toward the daily number**.
- **Drills get "Comes back"**, set in their Edit:
  - **By how it went** (the default), with a switch: **every day until it
    feels good on 3 or 5 days**, then the faces take over.
  - **On a fixed rhythm**: every day, every 2 days, every 3 days, or weekly.
    Done saves it at once, with no faces.
- **Every exercise is the same on Today.** A fixed-rhythm or learning drill is
  an ordinary row: it looks like the others, counts toward the daily number, and
  comes in by when it was due, oldest first.
- **A teacher sets Comes back for the class.** A class drill's Comes back
  applies to every member's entry, until the member sets their own.
- **Slower gaps** (G3), with the longest still a year.
- **Nothing says "late"**, and nothing reads as a pile.

## Non-goals

- Lessons, figures and routines get no Comes back. They always come back by
  how they went. (They can be warm-ups.)
- No per-person or per-exercise pace, ease or memory model. The four faces
  and one set of numbers stay.
- The warmup's steps stay as text on its page; there's no tick box per step.
- The full-screen player keeps its own run summary and logging, except that a
  fixed-rhythm drill's Save set has no faces and that a run continues after it
  (see "The practice panel and the full player").
- No new exercise type. Warm-up and Comes back are settings.

## Anti-goals

- **What is due is never stored.** A fixed-rhythm drill's next day and a
  drill's learning count are worked out from its sets every time, like the gap.
  Only the person's choices (Warm-up, Comes back, the warm-ups' order) are
  stored.
- **Nothing says "late"**, for any exercise, and nothing reads as a pile. The
  user's words: "minimize the feeling of being late and having a bunch to do".
- The defaults (no warm-up, by how it went) leave a person who never opens
  Edit with the app they have now, apart from the one page and the slower gaps.
- No extra tap to save. The face is the save.

## No lateness

- **Today's rows** show no due wording for a row that's due today or past its
  day: being on Today says it's for today. "N days late" and "Due today" go.
  "New · from class Tue 3 Nov", "Ahead · due Sunday", "Added · due tomorrow",
  "Done · …", and a drill's "Every day", "Every 2 days" or "Learning · 2 of 3
  good days" stay. (`rowMeta` in `src/lib/exercises/today.ts`, `dueWords` in
  `src/lib/schedule/words.ts`.)
- **The figure page's practice line** (`practiceLine`) says "Due today" for an
  exercise past its day, never "N days late".
- **Coming up's "Waiting"** is renamed **Next in line**, with no count.
- Anything else that words a past due day the same way follows these rules.

## No sets

The user: "It will never be done more than once in a day. We should remove the
idea of sets from this app."

- **An exercise is done at most once a day.** Nothing on screen says "set" or
  "sets" any more ("Log a set", "3 sets", "logged as a set" go). The history
  counts **times**: one per day it was done.
- **Done again on a day it's already done** doesn't add a second entry. The
  page shows **Done today** in place of Done; tapping it opens the same sheet to
  change the face or the note, and the page's time is added to the day's.
  *(My call.)*
- **The data stays a `sets` table** (renaming it is a rebuild for no gain), but
  the data function keeps one row per exercise per local day: a second save
  that day updates the day's row. Old days with several rows show as one: the
  minutes added up, the day's last face, the notes joined. `replay` already
  treats a day as one review, so the schedule doesn't change.
- **The history (option H1, picked)**: two tiles with room to breathe, "3 /
  times" and "17 min / in all" (28px numbers), then one card with a row per day:
  the date in bold on the left ("Thu 15 Oct"), the minutes and the face icon in
  its colour on the right, and the day's note muted under its row. No trash on
  the rows: a tap on a day opens a small sheet to delete it. On every exercise
  page. Board: "To pick", H1.
- **Empty Recordings and Music** stay as bare heading rows with + Add for now.
  Doing something like E1 (one card of adds) or E2 (hidden, adds in ⋯) on every
  page is an idea for later, in the project's note.
- The player's save line ("logged as a set") and every other "set" word in the
  app follow.

## The deliberate exception

The scheduling spec (2026-11-05) says "no frequency anywhere", and the hard
rule in `CLAUDE.md` says "There is no frequency to set: the gap is earned from
the faces." This design breaks that **for drills only, and only by choice**:
the fixed rhythm is a frequency. Update that rule and spec to say so. The
other half of the rule, "what is due is never stored", still holds.

## Today's list

Two lists, in the app's existing label style:

- **Warm-up · N**: the warm-ups due today, done first. They don't count toward
  the daily number. **Their order is the person's**: they drag to reorder
  within the list, and the order is stored per exercise. One with no stored
  order goes after the ordered ones, by when it was due, then by creation.
  *(My call: in the real data the Warmup was made after Salsa to Son, so no
  derived order puts it first.)* With no warm-ups due, the list isn't drawn.
- **Practice · N**: everything else, exactly as Today's list works now: the
  daily number (default 5), due oldest first, Next N, Not today. Fixed-rhythm
  and learning drills are rows here like any other.
- **Rows all look the same**: a row opens the exercise page and ends in a
  chevron; the "+" that opened the log popup goes. Done rows look as done rows
  do now.
- **The hero card** says "7 for today": the warm-ups and the practice
  together (the user's pick over "2 warm-ups, then 5"). Once started, as now:
  "5 left for today". Then the bar, "0 of 7 done · about 30 min", and the play
  button that starts the run.
- **New exercise is the + in Today's band** on the phone too (the desktop
  already has it there): the band's "Custom exercise" button shows at every
  width, and the big "+ Custom exercise" button under the list goes. It opens
  the same New exercise sheet. (Drills as their own list in Moves is a task for
  later, in the project's note.)
- **A warm-up that isn't due today** isn't on Today. Coming up lists it on its
  day with "Warm-up · every day". **Next N never pulls in a warm-up** (they
  don't count anyway). Coming up's + can add one early; it joins the Warm-up
  list. *(My call.)*
- **A fixed-rhythm or learning drill that doesn't fit** in the daily number
  waits in Next in line like anything else. Since its due day stays put, it's
  older tomorrow and comes in earlier. (On the board: Desni dvojni obrat,
  learning and due today, waits behind five that were due earlier.)
- A paused (`active = false`) or archived exercise shows nowhere, as now.
- The reminder (`dueByDance`) counts what is on Today, warm-ups included.

## Warm-up

- **Stored**: one boolean on `exercises` (`ADD COLUMN`, default false, no CHECK)
  and the warm-ups' order (a nullable integer, or the builder's choice).
- **Any type** can be a warm-up: a drill, a figure's exercise, a routine, a
  lesson review. Its schedule is its own (Comes back for a drill, the faces for
  the rest). The flag only decides which list it's in and that it isn't
  counted.
- **Set in the Edit page's Settings card**, a Switch row under Active:
  "Warm-up" / "Do it first. It doesn't count toward your 5." (the person's daily
  number). Also in New exercise, under Notes. Shown at every level.
- **Each person's own.** A member's entry carries its own flag; a teacher
  doesn't set it, so a class drill's Edit has no Warm-up row. Copies don't
  carry it (it's how a person arranges their day, not part of the exercise).
  *(My call.)*

## Comes back

### What is stored

One nullable setting on `exercises`, added by `ADD COLUMN` (no CHECK,
per the hard rule), read through a PURE, total parser in the way
`parsePracticeConfig` reads `practice_json`. Any value it can't read means
"by how it went". The setting holds:

- `faces`: by how it went, switch off.
- `until 3` / `until 5`: by how it went, with every day until it feels good on
  3 or 5 days. It also stores **when the switch was turned on** (epoch ms).
  Only good days on or after that day count, so turning the switch on for an
  old drill starts it learning again. *(My call: otherwise an old drill with a
  few good days would be "learnt" the moment the switch goes on.)*
- `every 1|2|3|7`: on a fixed rhythm.
- null: on a person's own drill, the same as `faces`; on an entry (`source =
  'added'`), **follow the class drill's setting** (`drill_id`'s row), read every
  time, so the teacher's later changes reach the member. When the member saves
  a Comes back of their own, it's stored on their entry and from then on it's
  theirs. *(My call: a "Use my teacher's" choice that sets it back to null.)*

The exact column(s) and encoding are the builder's. `every_days` stays
vestigial and is not reused: its default of 3 is on every row.

### What is worked out (PURE, `src/lib/schedule/`)

Everything below takes the sets, the setting, `now` and the zone, and stores
nothing.

- **By how it went, switch off.** As now: `replay` gives the gap and the due
  day.
- **Learning** (switch on, fewer good days than the target): a good day is
  a local day whose last rated set was I've got it or Easy (`rating ≥ 4`), on
  or after the day the switch went on. While learning, the drill is due **every
  day**: due the day after its last set (today, if never done). `replay` still
  runs over all the sets, so when it's learnt, the gap is whatever the faces
  earned.
- **Learnt**: once the good days reach the target, the drill is due by `replay`
  as usual. Good days only add up, so it never goes back to learning; Still hard
  already brings it back tomorrow.
- **Fixed rhythm, every N days**: due on the local day of its last set + N.
  Never done: due today. A missed day keeps its due day, so it's still there the
  next day, and the rhythm counts from the day it's done. Its sets are saved with
  `rating` null. Switching back to "by how it went" replays as now (unrated
  sets leave the gap unchanged).

### Where it's set

- **The drill's Edit** (and New exercise) has a "Comes back" card: two radio
  rows.
  - "By how it went" / "The faces decide when it comes back." (the default),
    with the switch "Every day until it feels good" / "Then the faces take
    over.", and when it's on, the chips **3 good days** / **5 good days** and
    "Good means I've got it or Easy. 2 of 3 so far."
  - "On a fixed rhythm" / "Just Done, no faces.", with the chips Every day /
    Every 2 days / Every 3 days / Weekly.
- **A class drill** (a group's `custom` exercise) has the same card in its Edit,
  in the group look, titled "Comes back, for the class", with "Members can
  change it for themselves." under it. It's a group mutation: `logChange`, add
  it to `MUTATIONS`, and `seen` covers it for the clash check. It's a field
  that clones carry (Copy to…, Compare, Take, Send: add it to the drill's
  fields in `clones/flat.ts`).
- **A member's entry** shows "Comes back · Every day until it feels good on 3
  days" on the exercise page with a navy "Set by your teacher" chip while it
  follows the class drill. Their Edit shows "Your teacher set: …" above the
  card, and once they pick their own, a "Use my teacher's" text button.
- Levels: at Follow my class the card is hidden, so the teacher's setting just
  applies. The exercise page still shows the line.

## The exercise page (one page)

The page at `/[dance]/exercises/[id]` becomes the place you practise:

- **The band** shows the name and a subtitle with the type, the place in a run
  and the running time: "Drill · 4:12", in a run "Drill · 3 of 7 · 4:12", a
  warm-up "Drill · warm-up · 1 of 7 · 6:30", a learning drill "Drill · learning
  · 3:20".
- **The body** shows what the type shows today on the page and in the popup's
  practice panel: the description, the **Practise with** card (count, song,
  clave, play; moved from the popup to right after the description), and the
  rest of the page. `contentFor` still owns the type's part (the "type owns its
  popup" rule becomes "the type owns its page's content").
- **A drill's sections and links are one list, Recordings**, as on the
  figure page (its `watched` snippet): a heading "Recordings" ("Recordings · N"
  when there are rows) with **+ Add**, and one card with the linked sections
  (`SectionRow`) then the links (`LinkRow`). The "Link a section…" button and
  the inline Add links form (textarea, Title, "+ Add link") go. **+ Add** opens
  "Add to <drill>" with **Link a section** and **Link** (the figure's
  `AddRecordingSheet` without "Video from the phone": a drill holds no video of
  its own). Unlink and remove are on the drill's Edit page, in a Recordings card
  at its end. Someone who can't edit the drill (a class member) and has nothing
  linked sees no Recordings, as on the figure page. Music stays as it is.
  Order: description, Practise with, Recordings, Music, History, Settings.
- **Pinned bottom**: **✓ Done**, full width. For a fixed-rhythm drill in a run
  it reads **✓ Done · next** in the done green and saves at once.
- **In a run** the pinned bar has two equal buttons: **Skip** (on to the next
  without saving; a skip only for this run, not Not today) and Done. Edit, Not
  today and archive stay where they are now.
- The empty history says "Tap Done after you practise — it shows up here,
  grouped by day."

### The Done sheet

- The title is "How did it go?", and under it a muted line: the time and the
  next exercise in a run ("4:12 · Next: Review: Ponavljanje vseh figur"), the
  time alone otherwise, "Learning · 2 of 3 good days" for a learning drill, the
  day for a past day.
- The **note** box comes first (optional, one line that grows).
- **One row of four face cards**: Still hard, Getting there, I've got it, Easy.
  Each says when it would bring the exercise back ("Tomorrow", "12 days"),
  from `preview`. A learning drill's faces say "Tomorrow", except a face that
  would finish its learning: "3 days" with "learnt" on a second line in the
  done green; the time row is two lines high on all four cards so the faces
  stay level.
- "Tap a face to save it", muted and centred, under the faces. No button.
- **Tapping a face saves the set** (time, face, note) and goes on: to the next
  exercise in a run, otherwise back to where the page was opened from.
  A toast on the next screen, "Saved · back in 12 days" with **Undo**, undoes it
  (`undoLogMessage` and the set restore exist). For a fixed-rhythm drill the
  toast is "Saved · back tomorrow".
- **Closing the sheet** (×, Back, the scrim) saves nothing.
- Logging twice in a day keeps working as now: one review per local day.

### Time

- It counts from when the page opened, **only while the page is visible**
  (paused while the tab or app is hidden), and is saved as `sets.duration_s`.
  *(My call: a phone left open on the page overnight shouldn't log 9 hours.)*
- It's shown in the band, and the day's total is on the end screen. Nothing
  asks for or edits it in the sheet. Old sets keep their minutes in the history.
- If the page is reopened (refresh, coming back), the count starts again from
  that open.

### Leaving the old popup

The log popup (`LogShell`, its per-type forms with minutes and reps, `?log=1`)
goes. Links that opened it (`?log=1` from the lesson page, Today rows) open the
exercise page. Its other uses:

- **The practice buttons open the exercise page**: the figure page's
  Practise and the lesson page's review row (its "+", "Log a set of …") go to
  `/[dance]/exercises/[id]`, where the time starts and Done is. No popup opens in
  place on those pages, so `FigureLog` and `LessonLog` go. After the face it
  goes back to the page it came from. (The user's words: "The practice buttons
  should open the exercise page".) A figure with no exercise yet keeps its
  "Practise on its own", which makes the exercise and then opens its page.
- **Adding a forgotten set to a past day** (Today's `?day=` view,
  `backfillDay`) opens the Done sheet with no time: the set lands on that day
  with `duration_s` null. *(My call.)*
- **Practice away from the app** (the routine page's "Log here when you
  practised away from the app", now "Tap Done when you practised away from the
  app") is the same: the Done sheet, and the time is whatever the page counted.
  Nobody types a time. *(My call, following "time is never typed".)*

### The practice panel and the full player

- **The practice panel on the page** (count, song, clave): a run there
  doesn't save a set on its own. Done saves the page's time plus the panel's
  `player_json`, as the popup handed it over before. *(My call.)*
- **The full-screen player** keeps its own Save set screen. When it was opened
  from a run, its `from` carries the run, and after saving it goes **to the
  next exercise of the run** (or Done for today); the button reads "Save · next".
  Back without saving returns to the exercise page, still in the run. A page
  whose exercise already has a set from this run shows "Done today" in place of
  Done, so it can't be logged twice by accident. *(My call.)*
- **A fixed-rhythm drill in the player**: the Save set screen shows no faces,
  and saves `rating` null. *(My call; otherwise a face would be saved and
  ignored, and then count if the drill is switched back.)*

Every log form changes, so **raise PAGE_EPOCH**.

## The run

- **Start** (the hero's play button) opens the first exercise of the walk: the
  warm-ups due today in their order, then the Practice rows (`sessionWalk`,
  extended with the warm-ups first). The run stays a URL flag plus the page's
  own rows, as today (`session.ts`). Nothing is stored on the server.
- The hero's time estimate is the sum, over the run's exercises, of the median
  of each one's last 3 timed sets; exercises with none add nothing, and with no
  timed sets at all the words are left out. *(My call.)*
- After each save the next page opens. A row already done today is passed
  over.
- **Done for today** shows how many exercises and how many minutes, the
  warm-ups folded into one row ("Warm-up · 2 done · 7 days in a row" where that
  holds), each other exercise with its face and when it's back (a drill that
  finished learning: "Learnt · back in 3 days"), then **Next 5** (adds the next
  N and goes on) and **Back to Today**.
- Opening an exercise from the list (not Start) is the same page, without Skip
  or "Next:". After the face it goes back to Today.

## Slower gaps (G3, longest a year)

Replace the numbers in `STEPS` (`src/lib/schedule/schedule.ts`) and the
scheduling spec's table:

| Face | New gap | Was |
|---|---|---|
| Still hard | 1 | 1 |
| Getting there | max(2, used × 1.3); done early: max(that, gap ÷ 2) | max(3, used × 1.2) |
| I've got it | max(3, used × 1.5, gap) | max(7, used × 2.5, gap) |
| Easy | max(7, used × 2, gap × 1.2) | max(21, used × 4, gap × 1.3) |
| Longest | 365 | 365 |

"I've got it" every time: 3, 5, 8, 12, 18, 27, 41, 62, 93 days, then about
4½, 7 and 10 months, then a year. Easy every time: 7, 14, 28, 56, 112, 224, 365.
Because the gap is replayed from the sets, every exercise moves to the new
numbers by itself, with nothing to migrate.

Slower gaps mean more exercises due at once. With 15 active salsa exercises
(23 in bachata) and 5 a day, plus warm-ups outside the number, G3 fits. The
default stays 5.

## Desktop

- The run and the exercise page sit in Today's right-hand pane, as the exercise
  does now. The two lists are in the list column.
- Arriving at Today still opens the first due exercise in the pane (R11), but
  **that open doesn't start the clock**. The clock starts at the first tap or
  key in the pane, or at once when the page was opened by Start or a row.
  So a desk left on Today logs no idle time. *(My call.)*
- Opening an exercise from the list on desktop is not a run, the same as on the
  phone: no Skip and no "Next:". Start is the run.
- The Done sheet is a centred dialog, as every bottom sheet is on desktop.

## Specs and docs to update

- `CLAUDE.md`: the hard rules "There is no frequency to set" (the exception) and
  "The type owns its popup" (now its page's content). Also the Layout lines for
  `src/lib/schedule/` and `src/lib/exercises/`, and the "Today as a number a day"
  summary.
- `2026-11-05-today-scheduling-design.md`: the numbers, warm-ups, fixed rhythm
  and learning, no lateness, and the exception.
- `2026-09-28-exercise-types-design.md`: the popup goes, the page takes its
  content, reps go, a drill's Recordings.
- `2026-11-05-levels-design.md`: the simple exercise page and log popup become
  the one page. At Follow my class, Comes back is hidden; Warm-up is shown.
- `2026-09-22-salsa-app-design.md`: Today and the log.

## Left to the builder

- The column names and encoding of Comes back, Warm-up and the warm-ups' order.
- How the walk carries the warm-ups (one list or two).
- The toast's exact wording beyond the examples, and the shape of the
  "N days in a row" line (it's derived from the sets).
- Screenshots for the rig (`scripts/shots/`): scenes for the run, the sheet,
  a learning drill, a warm-up, Done for today, and the Edit card. Compare with
  the board's mockups.
