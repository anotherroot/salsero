# Past days: the new look (design)

2026-11-09. The look of a past day on Today (`/[dance]?day=YYYY-MM-DD`), its band, and a calendar to
jump to any day. Picked by the user over four rounds of mockups (all on real data, phone width):

- round 1, the list (picked **A**): https://claude.ai/artifact/3riWbxefXLfXn46fNEmLey
- round 2, the way back to today (picked **2**): https://claude.ai/artifact/Xd92ere8XogzV6mwkR7mUx
- round 3, the band scrolled (picked **2a**): https://claude.ai/artifact/3FFEaifcrLSJBzDo1QBZsX
- round 4, the calendar (picked **K2**; Today's ‹ stays where it is): https://claude.ai/artifact/RztViQU53dcsxjysfBZ82E

## Why

The past day still looks like the old idea of sets: every exercise is its own card with a **+**
("add a set to this day"), and under it a second row that says "Done" when there is nothing else to
say. A day has one entry per exercise (`saveDay`), so the + is wrong, and the page does not look like
the rest of Today (the Done for today page, Today's list). The empty day (a grey circle with a
calendar, "Nothing logged on this day", then a separate picker field) looks dated too. The "Back to
today" chip under the title looked poor to the user.

## Goals

- A past day reads like **Done for today** (`/[dance]/done`): numbers on top, one list, a face per
  exercise.
- Moving between days lives in one strip in the band; any day is one tap away through a calendar.
- An empty day is calm, with one obvious way to add a forgotten exercise.

## Non-goals

- Today's own page does **not** get the strip. Its ‹ (previous day) stays where it is, top right
  beside Coming up and +. The calendar does not open from Today.
- No week strip, no sessions by time of day, no hero card with a feelings bar (rounds 1 B and C,
  rejected).
- Nothing about what is stored changes: no migration, no new column.

## Anti-goals

- Anything that reads as a set: a + per exercise, a row per set, "Add X to this day" per exercise.
- A strip or banner at the very top edge (the Android status bar is transparent over the band).
- The calendar must not be confused with Coming up (Today's calendar icon opens Coming up). It opens
  only from the past day, where Coming up is not shown, so the strip uses the same `calendar` glyph
  as the mockup (designer's call); no new icon.

## The page (option A)

**Band, big (at rest).** Title: the day, as now (`dayLabel`, "pon, 2. nov."). No subtitle line and
no buttons top right. Under the title, in the band's `extra` row, **the strip**:

- a pill on `bg-band-track` (black 15 % over the band), full width minus the Today pill:
  `‹` · *calendar icon, the relative day ("3 days ago", "Yesterday", `lastDoneLabel`), a chevron
  down* · `›`. The arrows step one day (› from yesterday goes to Today, as now). The middle is a
  button that opens the calendar sheet.
- beside it a **Today** pill: band-ink fill, band colour text ("Danes"), goes to Today.

The old "Back to today" chip is gone.

**Band, scrolled (2a).** The slim band shows the title shrunk (as every slim band does), then `‹` `›`
and a small **Today** pill (band-ink fill). The strip itself is not in the slim band; the calendar
is reached at the top. The fold (`band-collapse.ts`) must not look broken: the strip leaves with the
big band and the arrows and the pill are in the slim band from the pin on.

**Numbers.** Two tiles in one card, as on Done for today: the count of exercises that day ("11 /
vaj") and the practised time ("20 min / vadbe", `practisedLabel`). Not shown on an empty day.

**The list.** One `GROUP` card, one row per exercise (as `pastGroups` merges them), in the order of
the day:

- the type tile (`TypeTile`, accent tone, the type's icon; archived exercise: as today's done tile),
- the name as drawn everywhere else (`shownExercise`: "Ponovitev: …", not the stored "Review: …"),
- a muted line: the time of day of the entry (24-hour, as `day.ts` formats) and its minutes or reps ("10:51 · 7 min"); just the time
  when there is nothing else,
- the note, if any, under it in the catalog's quotes (sl » «), at most two lines,
- the face on the right (`Face`, size 30, labelled) when the entry has a feeling,
- a chevron. The whole row is a button: it opens the Done sheet for that exercise on that day
  (today's `pick(id)` flow, so a fixed-rhythm drill still saves at once). An archived exercise's row
  is not a button and has no chevron.

The last row of the card: **+ Add an exercise to this day** (accent text, centred, like Today's
"Add 5 more"). It opens the existing exercise picker (the "Forgot to log something" picker), then the
Done sheet. The separate "Forgot to log something that day?" label and field are gone.

**Empty day.** The same card with one message row and the add row under it:
"Nothing logged this day" (bold) / "If you practised, add it." (muted); sl "Ta dan ni vpisane
vadbe" / "Če ste vadili, jo dodajte." No icon circle, no tiles.

## The calendar (K2)

A `Sheet` from the strip's middle button. Months stacked one under another, oldest on top, the
current month last; it opens with the shown day's month in view (scrolled to the bottom when that is
the current month). Scrolling up shows older months, back to the first month with an entry (or the
shown day's month, if that is older).

- Each month: its name and year as a header ("oktober 2026", built by hand in `format.ts`, never
  `toLocale…`), with the month's numbers beside it ("3 dni · 15 vaj"; `slCount`): the days with
  entries, and the day counts added up (3 + 11 + 1), not distinct exercises across the month.
- Weekday letters, Monday first (the user's week).
- Each day a rounded tile: the day number, and under it the number of exercises logged that day
  (distinct exercises, same count as the page's tile) in accent text. A day with entries has an
  `accent-soft` tile; the shown day is filled accent; today is outlined; days after today are muted
  and not buttons.
- A tap on a past day goes to it (`?day=`), on today goes to Today; the sheet closes.
- Footer: a muted legend ("Number = exercises that day") and a **Today** button.
- Each day tile has a spoken label: the day and its count ("pon, 2. nov., 11 vaj").

**Its data.** The count of distinct exercises per local day (user's zone, `localDay`), for the
person's own entries in this dance, from the first entry to today. Read through the walls (`scope.ts`
/ `access.ts`, as `listSetsBetween` does), never `.dance` alone. It is part of the past day's data;
it must work offline as the past day does. The page's load runs on the device and `sets` is synced in
full, so counts computed in the load need no new GET (designer's call: compute them in the load).

## Desktop

The past day is one column on the desktop (as now) and gets the same band row with the strip and the
same list; the calendar is the app's `Sheet` as it draws on the desktop. The desktop's "So far today"
pane (`PastDay` with `today`) gets the same rows, with no chevron and no add row (the list beside it
logs); its empty text stays.

## Words

Every new string through `t()`, in en and sl; `no-english.spec.ts` must stay green. The old
`today.past` strings that no longer show (`loggedThatDay`, `addSet`, `done` as filler, `forgot`,
`pick`) go. Slovenian: vikanje, `slCount`, » «.

## Left to the builder

- How the slim band gets its own buttons (a new `Screen` snippet, or another way) and how the strip
  folds away, as long as the scrolled look is 2a and the fold does not jump.
- Where the per-day counts are computed (a new data function beside `listSetsBetween`, or in the
  load) and whether they come with the page or with the sheet, within the walls and offline rules.
- The tile markup (reuse Done for today's or share it).
- Which time a merged entry shows (its first or last set).
- Screenshots in `scripts/shots` for the new page and the open calendar; the phone's past-day
  baseline changes on purpose.
