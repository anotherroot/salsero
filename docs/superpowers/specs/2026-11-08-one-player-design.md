# One player, with the details in it

2026-11-08. Branch `practice-player`. **Built** (plan `docs/superpowers/plans/2026-11-08-one-player.md`). Builds on slot 3's exercise page and Done
sheet (branch `exercise-flow`, plans 2 and 3 of
[`2026-11-07-run-the-day-design.md`](2026-11-07-run-the-day-design.md)) and on
this branch's routine run without calls (commit `45854b5`).

## Why

There were two players: a small one inside the log popup (figures and drills)
and the full page at `/[dance]/player` (routines, songs, count only). The
popup is going (slot 3), and the user prefers the full page: "as just a tool i
use to practice". Practising is not logging: "it's not required, nor does
finishing the work there set any duration amount or anything". And while
practising they want to check the figure or drill without leaving: "some
expandable details of the figure or drill or whatever in the player if you
need to check something".

On the running screen, the space nobody uses goes to the count: "no empty
space. The rest of the space when closed should go to the orange numbers so
the number can be nice and big on the phone".

## Goals

- One player: the full page. The small one goes.
- The player logs nothing. Done on the exercise page is the only way a
  practice becomes a set.
- While a run plays, the exercise's details are one tap away, with the count
  still running.
- On the phone the count fills the band.

## Non-goals

- No change to what the count, the clave, a song or a routine's Follow / Still
  do. Nothing is spoken but the count (as since 2026-11-08).
- No editing from the player. Editing stays on the exercise, figure and drill
  pages.
- Several songs at once, the song's start point and song sections: separate
  work, later.

## Anti-goals

- An empty box, an "Add notes" or a "Nothing here" where an exercise has no
  details. A drill that is only a title shows no About at all.
- Empty space under the count on a phone while it runs.
- The player quietly saving a set, a time or a run summary.

## Decided with the user

Mockups: board B2 (drills, figures) and "A routine in B2", from 2026-11-08.

### Getting there

- The exercise page (slot 3's) keeps a **Practise with** card where the
  practice panel sat, but it no longer plays in place: it opens the full player
  for that exercise (`/[dance]/player?exercise=<id>&from=…`), with the
  exercise's own song, tempo, clave and voice (its remembered practice, as
  today). This holds for drills, figures and routines alike (a routine's card is
  already a "Practise in player" link).
- Back from the player returns to the exercise page; in a run, still in the
  run (slot 3's `from`).
- The other ways in stay: the routine page's Practise, Music's Count only, a
  song's Practice with this song, a Music row's Practise to this.

### The player logs nothing

- The Save screen after Stop goes, and so does the player's `save` action. A
  routine run no longer saves itself.
- Slot 3's "Save · next" in a run goes with it: in a run, Back from the player
  goes to the exercise page, and its Done goes on to the next.
- Done no longer carries a run: the exercise page sends no `player_json`, and
  no Minutes come from a run. `sets.player_json` stays as a column (never
  dropped, see CLAUDE.md), read for old sets wherever it is read today.
- Stop ends the run and goes back to Setup, as Back does today.

### Running, phone (B2)

- **The band fills the screen** above the rows: the exercise's name in place of
  "Practice" (truncated on one line), a subtitle with the type and the tempo
  ("Figure · 130 BPM · clave 2-3", "Drill · 180 BPM", "Routine · 180 BPM"), the
  count, the dots and the time. The count is as big as the band's free height
  allows, which is about 1.5× today's on a 390×844 phone; with fewer rows it is
  bigger still.
- **Under the band, one card of rows**, in the app's row style (the icon tile,
  a bold title, a muted one-line preview, a chevron pointing up):
  - **About**: only when the exercise has details (below). Its preview names
    what is inside ("Notes · a lesson section · a link"), or for a drill with
    only a description, the description's first line.
  - **Voice**: what is set ("1 2 3 · 5 6 7 · 100%"; "Off" when the count is
    off). Always there.
- **Stop and Pause** at the foot, as now.
- **A row opens a full-screen layer**, the same shape as the routine's
  full-screen list that is already built: a band strip at the top with ✕, the
  live count, the name and the time; the content on the ground below; Stop and
  Pause stay at the foot. ✕ or Back closes it (`sheetStack`, as the routine
  layer does).
- **The Voice layer** holds what the Voice card holds today: the voice count
  chips (wrapped) and the volume.
- **About layer** shows the details, below.

### Running, a routine

- The small list window and its expand button become a **Routine** row, above
  About and Voice. Its preview is "5 of 16 · Follow" or "16 figures · Still".
  It opens the full-screen routine list that is already built (with the Follow
  / Still switch in its strip).
- **Follow**: the band shows, under the count, the lit figure's name and a
  smaller "Next: <figure>". **Still**: the band shows only the count, bigger.
- **About in a routine is the lit figure's** ("About Guapea · Basic"), changing
  as the run moves. It shows only in Follow, and only when that figure has
  details. Before the first figure starts, it is the first slot's (Follow
  lights slot 0 then).
- **In the full-screen list**, a figure's details open from the list:
  - **Still**: tapping a figure opens its details.
  - **Follow**: tapping a figure still jumps the run to it (as built); each row
    has an ⓘ at its right end that opens that figure's details.
  - The details open over the list in the same layer shape; ✕ or Back returns
    to the list.

### What the details hold

What the exercise's page shows, read-only, each part only when it has
something:

- **A figure** (a figure exercise, or a routine's figure): its timing and
  positions as facts ("1 → 1 · 8 counts", "Abierta (una mano) → Abierta (una
  mano)"), its notes, its linked lesson sections, its own recordings, and its
  links.
- **A drill**: its description, then its Recordings (slot 3's list: linked
  sections, then links).
- The heading is "About" for the exercise itself, the figure's label for a
  routine's figure.

### Setup

- The band shows the exercise's name in place of "Practice", as running does.
  Everything else in Setup stays as it is.

## My calls (the user has not weighed in)

- The exercise page's card keeps its look (the summary of what is set and the
  ▶), minus the dropdown that changed the settings in place: tapping the card
  opens the player's Setup, and ▶ opens it and starts at once (the tap's
  activation carries over a client-side navigation; where it does not, it
  lands on Setup).
- **The exercise page's time keeps counting while its player is open.** Slot
  3's clock counts while the page is visible and restarts when the page is
  reopened; a trip to the player and back is one visit, so the time spent in
  the player is part of it. The player itself still records nothing. So is a
  load of the whole page (2026-11-09): a new version out makes the way back
  from the player a full load, and a reload drops the page; the page leaves its
  time as it unloads (stopped) and a whole load takes it back.
- A section or recording in the details plays inline, muted and looping, so
  the count keeps going; it never opens the full-screen video player from here.
  A link opens outside the app, as links do elsewhere.
- About is on Setup too: the same row above Setup's settings, so the details
  can be read before Play.
- A routine's own notes, when it has any, show at the top of its full-screen
  list.
- The desktop keeps its layout (the stage on the band, a 520 px column on the
  right): the rows sit in that column, and a row's layer opens in the column
  in place of the rows, the stage staying where it is.
- The layer's names and words go through the i18n catalog, in both languages.

- **The boards are not in the repo**: they hold the user's own content (from a
  backup copy), and screenshots of it are never committed. What they show, in
  the app's existing parts: the rows are a `GROUP` card of rows like Music's
  "Count only" row (`MusicList.svelte`: a 40 px `bg-accent-soft` icon tile,
  16 px bold title, 13 px muted preview), with a chevron pointing up; a layer's
  strip is the routine layer's strip in `Running.svelte` (✕, the live digit,
  the name and the time); a layer's heading is the display font at 22 px.
- **A song run**: the seek bar stays where it is (the top of the sheet, above
  the rows). The band's title is the exercise's name, and the song's title goes
  in the subtitle ("Drill · Suavemente · 125 BPM", the tempo as played, with the
  speed when it is not 100%). Without an exercise, the song's title is the band
  title, as now.
- **Without an exercise** (Count only, a song, the routine page's Practise):
  the title is the routine's name, else the song's title, else "Count only".
  A routine opened from its own page gets everything a routine gets here (the
  lit figure's About, the ⓘ, Still's tap): a routine's details hang off its
  figures, not off the exercise.
- **A slot with alternatives**: a run plays one figure per step, so Follow's
  About is the figure being played. In the full-screen list, a slot row's ⓘ
  (and Still's tap) opens all the slot's figures, one after another, each under
  its own heading. A figure with no details is listed by name only.
- **The exercise page's clock**: only the trip open → player → Back keeps the
  time (the page's start is kept per exercise and run, in sessionStorage, for
  the length of the trip); a reload restarts it, as slot 3's spec says.
- **Videos in the details** are a bare `<video>`, muted and looping over the
  section's range, with no controls of the inline video (no spots, no editing).
- **Slot 3's "Save · next" and the fixed-rhythm Save set** (its plan 3,
  Task 6) are not built: slot 3 is asked to skip that task once this is
  approved. The run is carried as slot 3 defines it (`from`); Back keeps it.

## Left to the builder

- How the details reach the player (with the page's data, or fetched when a
  layer opens) — but a group's figure, drill or section is read through
  `access.ts` like everywhere else.
- How the band computes the count's size from its free height (today
  `StageCount` caps it at 30dvh).
- Removing the practice panel (`PracticePanel`, `onrun`/`onactive`, the
  figure and drill `Practice` components' panel) and the dead code behind the
  Save screen; raising `PAGE_EPOCH` (the save action and the Done form's run
  field go).
- Shots for the rig (`scripts/shots/`): running with each row, each layer,
  a title-only drill, a routine in Follow and Still, the ⓘ and Still's tap.

## Order

Slot 3's plans 2 and 3 (`exercise-flow`) land on master first; this branch
then merges master and builds on its exercise page. The changes to the
exercise page, the Done sheet and its spec are made here, and slot 3 is told.

## Decided while building

- **Where it lives.** `src/lib/server/run-details.ts` (`figureDetails`,
  `exerciseDetails`: read through `figureAccess` / `drillAccess` row by row, a
  reader's sections and recordings through `reach`); `RunDetails` and `RunClip`
  in `src/lib/types.ts`; the words in `src/lib/player/view.ts` (`runTitle`,
  `runSubtitle`, `hasDetails`, `aboutPreview`, `voicePreview`,
  `routinePreview`, `slotDetails`, `exercisePlayerHref`); the screens in
  `src/lib/components/player/` (`RunLayer`, `RunRows`, `DetailsBody`,
  `RunClip`); the exercise page's card is `components/exercises/PractiseCard`
  (`practiseWithLine` in `src/lib/exercises/practice.ts` is its line); the
  time across the trip is `src/lib/exercises/clock-trip.ts`.
- **Timing alone is not an About.** Every figure has a timing, so About shows
  when there are notes, positions, a clip or a link (`hasDetails`).
- **The card's ▶** opens `?play=1`: the player drops the param, then starts as
  soon as Play can (a song waits for its grid); where the browser will not
  start audio, Play's own error shows on Setup.
- **The time across the trip** is kept in the tab's sessionStorage, read once
  on the exercise page's next mount, within six hours. Only the card (and a
  routine's Practise in player) leaves it; Music's "Practise to this" restarts
  the time, as before.
- **The desktop** puts the Routine list behind its row too: the layer opens in
  the 520 px column, the sheet under it hidden while it is open.
- **The routine's About row** reads "About <figure>"; it closes by itself when
  that figure stops being lit.
- **Done carries no run**: `saveDoneFrom` drops a posted `run`; new sets have
  `player_json` null. `PAGE_EPOCH` 10 (the player's save action went).
- **Gone**: the practice panel (`PracticePanel`), `SaveSetSheet`, the player's
  `save` action, `runSummary`, `exerciseLine`, `stageSize`, `routineHeading`,
  `runTitleCompact`, Done's wait while a count played (`doneBar` has no
  `playing`).

