# Pages keep their place — design

## Why

You move between figures, routines and lessons, often across tabs, and the
app keeps losing your place. The case that started this:

> Routines → a routine → one of its figures → a lesson that teaches it →
> the band's back → landed on the Lessons list. Then Moves → reset to the
> Figures list, top of the page.

Two things cause it today:

- **The band's back is not a Back.** Every pushed screen's back chevron is a
  fixed link to its tab's main list (`Back to Moves` → `/figures`,
  `Back to Lessons` → `/lessons`, …), wherever you came from.
- **A tab always opens its main list.** Moves always opens Figures, at the
  top, with no memory of Routines, the scroll, the chips or the search.

## What it should feel like

Each tab picks up where you left it, the way phone apps with a tab bar do
(Instagram, Spotify, iOS Settings). Back takes you to the page you came from.

## Behaviour

### The tab bar shows on pushed screens too

- The bar shows on every page inside a dance: the four main screens and the
  pushed ones (figure, routine, lesson, song, exercise, Positions, Coverage).
- **Each page belongs to one tab, by what it is** (not by where you came
  from) and that tab is lit:
  - Today: `/[dance]`, an exercise page (*my call: an exercise lights Today,
    since its back already says "Back to Today"*).
  - Moves: Figures, Routines, a figure, a routine, Positions, Coverage.
  - Lessons: Lessons, a lesson.
  - Music: Songs, a song.
- **No bar** (*my call*): Practice (`/player`, a run fills the screen and has
  its own controls), the full-screen video player, the share page, and the
  pages outside a dance (Settings, My count, login), as now.
- **Pinned bottom bars** (*my call*): while a mode owns the bottom of the
  screen (editing with its pinned Save, the routine's selection bar), the tab
  bar steps aside for it, as edit mode is a mode you leave before going
  anywhere. The figure page's variation switcher is not a mode; it sits
  directly above the tab bar.
- The redesign spec's line "the tab bar shows on these four screens only"
  changes with this; update it.

### Tapping a tab returns to where you left it

- Tapping a tab that is not lit opens **the last page you saw in that tab**,
  as you left it: same page, same Figures/Routines choice, chips, search and
  scroll. A tab you have not visited yet this session opens its main list.
- In the opening case: after routine → figure → lesson, tapping Moves brings
  back the figure, scrolled where you were.
- Tapping the **lit** tab (*my call, the usual phone-app rule*):
  - on a pushed screen: goes to that tab's main list, as you left it;
  - on the main list: scrolls to the top.

### Back goes to the page you came from

- The band's back chevron goes to **the page you opened this one from**, its
  opener, whichever tab that is in. From the lesson it goes to the figure;
  from the figure, to the routine; from the routine, to the Routines list.
- A page keeps its opener when you return to it by a tab tap. In the opening
  case, Moves brings back the figure, and its back still goes to the routine,
  not to the lesson you just left.
- With no opener (a page opened from a link, a notification, a fresh app
  start, or a reload that lost it), back goes to the tab's main list, as it
  does today.
- The label names where it goes when it can ("Back to Enchufla", "Back to
  Routines"), else "Back to <tab>". *My call; the builder may shorten the
  wording to fit the slim band.*
- Arriving by back restores the page as you left it: scroll, chips, search.
- Leaving through back still goes through the unsaved-changes guard, and
  open sheets still close first, as now.
- **The phone's own Back** (Android's gesture or button, the browser's Back)
  stays the browser's history (*my call*). It still closes the top sheet and
  steps back through the video player's levels, which already live on that
  history. Most of the time it lands in the same place as the band's back;
  it differs only after a tab tap, where the system Back returns to the
  previous tab's page, as in other apps.

### A figure is one page

*My call.* A figure's variations are one page for all of this, though each
has its own URL. Stepping between variations with the switcher replaces the
history entry instead of adding one. The opener carries over, so back from
any variation goes to the routine (or whatever opened the figure), never
through the variations you looked at. Moves remembers the variation you were
last on.

### After a delete, archive, copy or Make routine

*My calls.*

- **A page that goes away** (a lesson, routine or song deleted; an exercise
  archived; the last variation archived) sends you to **its opener**, the way
  the band's back would. With no opener, or if the opener is gone too, you
  land on the tab's main list, as now. The page leaves the trail and the
  tab's memory, so no later back or tab tap reaches it.
- Archiving a variation that has siblings stays on the figure (a sibling
  variation, as now) and keeps the figure's opener.
- **A page that is created** (Copy routine, Make routine from Coverage, a
  lesson or a selection, a new variation) opens with **the page the form was
  on** as its opener. From a new routine made on a lesson, back goes to the
  lesson.
- Whether the server keeps its `redirect(303, …)` and the client then fixes
  the destination and the trail, or the client goes back itself, is up to
  the builder.

### Pages without the bar

*My calls.*

- **Practice** joins the trail. Its back, and the end of a run, go to its
  opener like any band back, and that page counts as arrived by back: it
  keeps its own opener and its scroll. This replaces `practiceBack` and the
  `?from=` it is built from. With no opener (opened from a link or the
  Android app), the current fallbacks stay.
- Practice, the share page and the pages outside a dance (Settings, My
  count) are **never a tab's remembered page**. Tapping Music after Practice
  brings back the Music page you were on before it.
- Settings and My count are not part of this: their backs stay as they are.

### What a list keeps

*My call: the memory is per page, not one entry per tab.* Every page you
visit this session keeps its own query and scroll, and each tab also
remembers which page you were last on. So:

- Switching Figures ↔ Routines brings each list back as you left it (the
  toggle no longer drops the chips and the search).
- Any way of reaching a page this session restores its scroll. The tabs, the
  band's back (and its no-opener fallback) and the Figures/Routines switch
  also bring back its chips and search; a plain link opens the URL it names.
  *(Settled while planning.)*
- Popup flags in the URL (`?log=1`, `?new=1`, `?add=1`, the old `?v=`) are
  never brought back. Today's `?day=` (a past day) is brought back.
  `?session=1` (a Today session) is not: its count and skips live in the
  page and end when you leave it, so a session you leave is over.
  *(Settled while planning.)*
- A new variation is a step within the figure, like the switcher: it keeps
  the figure's opener rather than taking the previous variation as one.
  *(Settled while planning; overrides the "created" rule below for
  variations.)*

- Scroll position, on every page (lists and pushed screens alike).
- Moves: Figures or Routines.
- Figures: the filter chips and the search (already in the URL).
- Music: the song search (component state today; move it into the URL like
  Figures', or remember it per page, builder's choice).
- Anything else a list lets you set later should follow the same rule.

Not kept: an edit in progress, an open sheet or popup, the video player, a
playing sample or a run. Unsaved edits already have their own guard.

### How long it lasts

- **Only for the current session.** A reload while the app (or the browser
  tab) is open keeps everything; closing the app, or opening a new browser
  tab, starts every tab fresh at its main list.
- Each browser and each phone keeps its own; nothing is stored on the server
  or synced between devices.
- Salsa and bachata keep separate places (they are separate URLs, and on
  Android separate apps).

## Goals

- Never lose your place moving between tabs, or going into a page and back.
- Back always makes sense: where you came from, or the tab's list.

## Non-goals

- Keeping your place after the app is closed.
- Syncing your place between the work PC and the phone.
- Changing what any page shows.

## Anti-goals

- A back that loops (A → B → A → B) or strands you with nowhere to go.
- The system Back and the band's back fighting over the sheets or the video
  player's levels.
- The tab bar covering a Save, a selection bar or the variation switcher.
- A tab that reopens on a page that no longer exists (a figure archived,
  a lesson deleted): fall back to the tab's main list, quietly.

## Constraints

- Session-only state lives in `sessionStorage` (survives a reload, gone with
  the tab or the app's WebView), wrapped so a blocked storage just means
  "nothing remembered".
- The pure parts (which tab a page belongs to, a tab's remembered page, the
  opener trail, where back goes and its label) go in `src/lib/nav/` as pure
  functions with specs, like `tabs.ts`; the impure part is the wiring in the
  root layout and the band.
- SvelteKit already restores scroll on a history Back; a tab tap or a band
  back that pushes a new entry has to restore scroll itself.
- The sheets' and the video player's history entries (`src/lib/sheets/`,
  `src/lib/video/player-history.ts`) must keep working unchanged.
- `bands.spec.ts`, `class-rules.spec.ts` and the safe-area rules (`--safe-*`)
  still hold; the bar on more pages means more pages need bottom padding for
  it.

## Left to the builder

- How the opener is recorded (per history entry, keyed in `sessionStorage`)
  and whether the band's back uses `history.back()` when the opener is the
  previous entry, or always navigates.
- Whether Music's search moves into the URL.
- The exact back label wording.
- How a page that has gone missing is detected on a tab tap (a 404 on the
  remembered URL is enough).
