# One picker for every list — design

> **Status:** approved in brainstorming, 2026-10-30. Touches the pickers of
> [`2026-10-01-routine-editor-design.md`](2026-10-01-routine-editor-design.md)
> (SlotPicker), [`2026-10-29-section-link-popup-design.md`](2026-10-29-section-link-popup-design.md)
> (the Link popup's list and its "+ Variation" step),
> [`2026-10-15-video-section-links-design.md`](2026-10-15-video-section-links-design.md)
> (Link a section) and the lesson page of
> [`2026-09-23-lessons-design.md`](2026-09-23-lessons-design.md).
>
> Mockup: https://claude.ai/artifact/XdxfgY2zPLQkqUq33KTN3n (version 4), and a
> local copy at `.superpowers/brainstorm/unified-pickers/pickers.html` (not
> committed; open it in a browser). Every phone in it works, and each one sits
> next to a screenshot of today's app at phone width. Where this document and
> the mockup disagree, this document wins.

## Why

The task in the notes was "searchable inputs in the figure selection for
lessons": linking a figure to a lesson is a native `<select>` of every
variation, with no search. A survey of the app found eleven places where the
user picks a figure, a variation, an exercise, a routine or a section from a
list, built five different ways: plain `<select>`s (`LinkPicker`, Today's
"Forgot to log", the player's Save this run), `FigureList` (search + radio
cards), the Link popup's own list (search + an Add button per row, its own
second search for "Other…" figures), `LinkSectionSheet` (no search, a Link
button per row), and `SlotPicker` (search, figure headings, timing, filters).
They disagree on search, labels, grouping, order, empty states and what a tap
does, and the dropdowns are long and unsearchable on a phone.

The user wants one way of picking, used everywhere, and wants linking to be
quick: "if I select only one then both popups should close because it's
done. I linked it."

## Goals

1. **One picker component** behind every list in the table below, with the
   same search, grouping, order, row look, empty state and gestures.
2. **Tap a row and you are done.** It links that one, fills the field, adds
   the slot or opens the log, and everything closes back to the page.
3. **+ to keep going.** Where the picker links things, a + on each row links
   that one at once and keeps the picker open; Done closes.
4. **No `<select>` for anything the user owns** (figures, variations,
   exercises, routines, sections).

## Non-goals

- The song picker (player setup, practice panel), start and end positions,
  style, how often, and the voice page's bars. Short fixed lists; a
  `<select>` or chips are right there.
- Android's "Add to a lesson" share page: five newest lessons per dance,
  already one tap. Only fix its comment in `share/+page.server.ts`, which says
  older lessons "are a search away on the lessons page"; that page has no
  search.
- + in the routine editor (adding several slots in a row, each fitting after
  the last). A feature for later, not part of this.
- No change to what can be linked to what, to the data model, or to any link
  rule. This is the UI only, plus the data the pickers need to show.

## Anti-goals

- A picker that behaves differently in one place "because it was easier
  there". The point is that they are the same.
- The phone keyboard opening over the list on its own.
- Losing work: a picker opened from a form must never clear the form.

## The rules every picker follows

These are the user's decisions unless marked *(builder's call)*.

1. **Search on top.** Case- and accent-insensitive ("exhibela" finds
   Exhíbela), the way `fit.ts`'s `fold` already works. Focused on open only
   under `(pointer: fine)`, as `SlotPicker` does today; never on a phone.
   Typing filters the list in place; the server is not asked. The letters
   each word matched are marked in the accent, in rows and headings alike
   (taken from the song popup, 2026-10-30).
2. **Headings, in one order.** A figure with one row in this picker is one
   row, "Dile que no · Basic". A figure with several is a heading that can't
   be tapped, with its variations indented under it ("└ Doble"). "Rows in
   this picker" is counted before the search filters, from what the list
   holds: in an exercise picker, Setenta with two variations but one
   exercise is the single row "Setenta · Complicado". *(builder's call)* Where the
   variation's own name matches the search, it shows under its heading; where
   the figure's name matches, all its variations show. Groups always come in
   this order, each present only when it has rows: **the near group** (below),
   **Figures**, **Routines**, **Drills**, **Lessons**. Within a group,
   alphabetical by name; variations in id order under their figure, as
   `listVersions` does.
3. **Tap a row: done.** What "done" means depends on the picker (table
   below), and then everything closes back to where the user started: the
   picker, and the popup or sheet it was opened from.
4. **Tap +: keep going.** Only in pickers that link things. + links that one
   immediately (same request as a tap), the row turns into "✓ Linked", and a
   **Done · N linked** button appears at the bottom. Done only closes; it
   does not save anything. + does not collect a batch to confirm at the end.
   The undo is the existing × / Unlink on the link.
5. **Already linked stays visible.** In a linking picker, something already
   linked to this target keeps its place in the list, greyed, with "✓ Linked"
   instead of +, and can't be tapped. This includes what is linked through a
   video's sections (`viaSections`). Things that can never be linked here
   (a lesson's review exercise in another lesson, an exercise owned by a
   figure or routine the lesson already links) stay out of the list, as
   today. In a field picker, the field's current value shows a "✓" in the
   accent colour and stays tappable. The groups are fixed when the picker
   opens; while it is open, a + only turns rows into "✓ Linked". Nothing
   moves between groups mid-session, even when a link widens the near group
   (a variation of a new figure linked through a lesson's section); the next
   opening shows the fresh groups. *(builder's call)*
6. **"Not in the list?" at the bottom.** Wherever something can be created
   from this place, its buttons sit in a row pinned under the list, always
   visible. With text in the search, the label reads 'Not in the list? Create
   “dob” as' and the text is carried into the create step's name field.
   Creating finishes like a tap: create and link, then everything closes.
7. **One empty state.** A grey box under the search: 'Nothing matches “…”.'
   with text typed, or the picker's own "nothing left" sentence without. No
   create link inside it; rule 6 covers creating.
8. **× steps back one level.** From a picker to the popup or form it was
   opened from, or to the page. Escape and the backdrop do the same. Finishing
   (rule 3, 4's Done, 6) goes all the way back. A create step opened from the
   create row is a level **on top of** the picker: its × returns to the
   picker with the search text kept. *(builder's call)* This holds when the
   Link popup was skipped (nothing linked): the create step opens over the
   picker, the popup is still not shown, and "Create and link" closes
   everything. In the full-screen player the create step is a history level
   above the picker's.
9. **Rows, not cards.** The divider rows of today's `SlotPicker`: label, an
   optional second line in muted 12 px, + or ✓ on the right, ▶ on the left
   for a section. The whole row is the tap target; + and ▶ are separate
   targets of at least 36 px.
10. **Second lines.** An exercise always shows how often (`frequencyLabel`).
    A routine shows its slots and whether it loops ("4 slots · loops"). A
    figure being picked as a figure shows its variations joined with ", ".
    A section shows its time range, and "→ …" for what it is linked to.
    Timing ("1→1 · Abierta → Abierta") only in the routine editor.
11. **No hint line.** The picker does not explain + in words. The one
    exception is the song popup (#12): its "▶ hear 15 s · tap a song to pick
    it" line and the song count stay, because the sample ▶ is its alone.

## Two kinds of opener

- **A linking picker** opens from a button that reads as an action and
  carries the search icon: "Link an existing figure…", "Link a section…",
  "Link a figure or drill…", "Pick an exercise…".
- **A field picker** opens from a field inside a form, which shows the
  current value (or a muted placeholder) and a ›. Tapping it opens the same
  picker on top of the form; a tap fills the field and returns to the form.
  The form is never cleared. The field posts its value as a hidden input, so
  the form's `use:guarded` submit is unchanged.

## The near group

The group that comes first, named for where the user is:

| Where | Heading | Holds |
|---|---|---|
| A lesson's video section (Link popup), or the lesson's New variation | **In this lesson** | every live variation of each figure the lesson teaches (linked by hand or through its sections), and the lesson's drills |
| A recording's section (Link popup) | **This figure** | the recording's figure's variations |
| Link a section, from a figure page | **In this lesson** | the videos of lessons that teach this figure (today's `taughtHere`) *(the heading text is the builder's call; the user saw "In this lesson")* |
| Link a section, from a drill page | **In this lesson** | the videos of lessons that link this drill |

Today the Link popup's near group holds only the variations the lesson links.
Widening it to the figure's other variations *(builder's call, from the
mockup)*: a new variation shown in a lesson video is usually of a figure the
lesson teaches.

## Every picker

| # | Where | Opener | Kind | Groups | Tap does | + | Create row |
|---|---|---|---|---|---|---|---|
| 1 | Lesson page → Figures | "Link an existing figure…" (replaces `LinkPicker`) | linking | Figures | `?/linkFigure`, close | yes | + Figure, + Variation: open the lesson's New figure sheet in that mode, name filled |
| 2 | Lesson page → Routines | "Link an existing routine…" | linking | Routines | `?/linkRoutine`, close | yes | + Routine: the lesson's New routine sheet |
| 3 | Lesson page → Exercises | "Link an existing exercise…" | linking | Figures, Routines, Drills | `?/linkExercise`, close | yes | + Exercise: the lesson's New exercise sheet |
| 4 | Lesson → + New figure → Variation of a figure | Figure field, starts on the lesson's first taught figure, empty if none | field (pick a figure) | In this lesson, Figures | fills the field | no | none |
| 5 | Figure page → Move to… | "Or join a figure" field, starts empty; the "A new figure of its own" card stays above it | field (pick a figure, not its own) | Figures | fills the field; the name field and button follow it | no | none |
| 6 | Routine editor → every + | unchanged (seams, ends, Add above/below, + Alternative) | acting | Figures, Routines | adds the slot, close (today's behaviour) | no | none |
| 7 | A section's link icon (Link popup) | the icon; see "The Link popup" | linking | near, Figures, Drills | links, closes picker and popup | yes | + Variation, + Figure, + Drill: the popup's create steps |
| 8 | Link popup → + Variation | Figure field, starts on the near group's first figure | field (pick a figure) | near, Figures | fills the field | no | none |
| 9 | Figure page / drill page → + Link a section | "Link a section…" | linking | near, then one heading per video | `?/linkSection`, close | yes | none |
| 10 | Today, a past day → Forgot to log | "Pick an exercise…" (replaces the `<select>`; nothing preselected) | acting | Figures, Routines, Drills, Lessons | opens that exercise's log popup for that day, as Add set does now | no | none |
| 11 | Player → Save this run, from a song | Exercise field, starts empty; Save stays disabled until set | field | Figures, Routines, Drills, Lessons | fills the field | no | none |
| 12 | Player setup / a log popup → Song (added after the first build) | the Song field, with its own ▶ sample | field | Recent, All songs A–Z; one flat A to Z while searching | fills the field, stops a sample | no | none |

In #6 the routine editor keeps everything of its own: `fit.ts` decides what
is offered, the anchor's context line, the Count and Hold filters and their
"Turn off Hold" rescue in the empty box, and the timing second line. It uses
the shared picker for the sheet, the search, the rows and the headings.

In #12 the song popup keeps everything of its own (see
`2026-10-30-song-samples-design.md`): `songs/search.ts` decides what is
listed (title or artist, Recent, A to Z), each row ends in its ▶ sample, the
second line turns into "Sample from 0:45" in the accent while it plays, a
sample stops when its row is filtered out and when the popup closes, and the
empty box points to the Songs page. It uses the shared picker for the sheet,
the search, the rows, the ✓ and the highlight.

In #9 there are two groups, the near group and **Other videos**, and inside
each a heading per video ("Tuesday class — Enchufla · 27 Oct", "Recording ·
Kentucky"); a video's sections are always under its heading, even when it has
one. Videos keep today's order from `videosOf` (lessons newest first, then
recordings by figure name) rather than rule 2's alphabetical order, and a
video's sections go by start time. *(builder's call)* So the pure module
handles three levels here: group → video heading → section, the same shape
as group → figure heading → variation. Search matches a section's name, its
time range and its video's heading. ▶ previews the section looping, as now.

## The Link popup

It becomes thinner. The list moves out of it into the picker.

- **Nothing linked yet:** the section's link icon opens the picker directly;
  the popup is not shown. A tap links and closes: two taps in all. × closes
  back to the page.
- **Something linked:** the icon opens the popup. It shows the links (× to
  unlink, with today's "also on the lesson by hand" question) and one button,
  "Link a figure or drill…", which opens the picker over it. × on the picker
  returns to the popup; a tap, Done or a create closes both.
- **Create:** + Variation, + Figure and + Drill live in the picker's create
  row. They open the popup's existing create steps, with the search text in
  the name field as today. The variation step's figure chips and "Other…"
  list are replaced by a Figure field (#8). "Create and link" closes
  everything.
- **In the full-screen player** the popup is an overlay inside the player's
  `<dialog>` with the dark tokens. The picker opens inside that same dialog,
  in the dark look, and the player's history gets a level for it, so Back
  closes the picker first, then the popup (see `screens.ts` /
  `player-history.ts` and the popup's controlled `step`).

## How it is built (builder's call within this)

- One component, e.g. `src/lib/components/ui/Picker.svelte`, on top of
  `Sheet.svelte` (a native `<dialog>`, so stacking over another sheet or the
  light Link popup's `<dialog>` uses the top layer). Props: title, search
  placeholder, groups, kind (linking / field / acting), the linked and chosen
  ids, a create row, a theme (light / dark), and callbacks for pick, add,
  create and close. It never fetches and never posts; its owner does.
- A field component for forms, e.g. `PickerField.svelte`: the field, the
  hidden input, and the picker it opens.
- The pure part in its own module, e.g. `src/lib/picker/`: folding text
  (`fold`, which now lives in `src/lib/fold.ts`), filtering groups
  by a query with the heading rule of rule 2, and the order of rule 2.
  Client-safe, DOM-free, with vitest tests like `fit.spec.ts`.
- Shared row shapes in `src/lib/types.ts` (components may not import
  `$lib/server`).
- The lists' data comes from the server as today, extended where a rule
  needs it: the lesson's linkable lists, `linkOptions` and `linkableSections`
  return already-linked items with a flag instead of leaving them out;
  routines carry their slot count and whether they loop; exercises carry
  their source (to group them), their figure and variation (to put a figure
  exercise under its figure's heading) and `every_days`.
- On the lesson page, a tap and a + post the same form action with
  `use:enhance` (a one-tap action, not a filled-in form, so not
  `use:guarded`). A + keeps the picker open across the page's invalidation;
  its row shows "✓ Linked" from the returned data. A refused link shows its
  message inside the picker and the row stays as it was.
- What goes away: `LinkPicker.svelte`, `FigureList.svelte`, the list and
  "Other…" inside `LinkPopup.svelte`, the list inside `LinkSectionSheet.svelte`
  and `SlotPicker.svelte`'s own rows and search (it becomes a wrapper that
  feeds `fit.ts`'s output to the picker), and the `<select>`s of #10 and #11.
- Desktop (the work PC) gets the same picker; `Sheet` already centres on a
  wide screen. Keyboard: Tab reaches each row, its + and its ▶; Enter on a
  focused row picks it. Anything more (arrow keys, Enter picks the first
  match) is left out.

## Documents to update with the build

- The design spec's lesson section and its "Unsaved changes" note on one-tap
  forms (a picker's tap and + are one-tap).
- `2026-10-01-routine-editor-design.md`, "The picker": it is now the shared
  picker fed by `fit.ts`.
- `2026-10-29-section-link-popup-design.md`: the list moves into the picker,
  the direct open when nothing is linked, the Figure field.
- `CLAUDE.md`'s layout block: the new picker module and components.

## Testing

- Unit tests for the pure module: folding, a figure name bringing all its
  variations, a variation name bringing only itself under its heading, a
  one-variation figure as a single row, group order, empty groups dropped.
- Server tests for the extended lists: linked items flagged rather than
  missing, through-section links flagged, review and owned exercises still
  absent.
- `fit.spec.ts` keeps passing with `fold` imported from its new home.
- By hand, at phone width and on desktop: each of the eleven, light, and #7
  and #8 inside the full-screen player, dark.

## Left to the builder

Component names and file layout within the above; the exact copy of empty
"nothing left" sentences; how the + request and its pending state look while
in flight; whether the create row scrolls with the list on a very short
screen; the near-group heading on the figure and drill pages.
