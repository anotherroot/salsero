# The figure page, reworked

Agreed with the user on 2026-11-05/06 from mockups built beside real
screenshots (the 6 Nov backup, Exhibela in 10 routines). It changes the figure
page's own layout. It builds on two other slots' work and does not do theirs:

- **Slot 3 (positions-rework)** owns the shared ⋯ menu and the version switch on
  all six member pages (figure, position, routine, drill, song, lesson): the
  tabs, the out-of-sync banner, Copy to / Same as / Move to / Detach / Drop my
  copy in the menu, and the nicer Move-to popup.
- **Slot 8 (groups-polish)** owns the Compare and Send sheets that open from there.
- **Slot 5 (lesson-links)** owns the links popup (one link at a time, showing
  what it found) and the "+ Add" heading button's look.

This page uses those once they are in master; it never builds its own copy of them.

## Why

On the phone the user comes to a figure page to watch it and remember it: the
section video, the description, when it starts and how long it is, and which
positions it goes from and to. Today that is buried. With real data the page
is about 4,400 px long: Follows from lists 22 figures and Leads to 16, each a
full row, and In routines grows the same way. Recordings, sections and links are
three separate sections with large empty states and full-width buttons; the user
has never used a phone recording or audio.

## Goals

- What you came for is at the top: the video, then one card with the facts.
- Recordings, sections and (later) links are one list, **Recordings**, with one
  `+ Add` in its heading row.
- Lists that grow with use (Follows from, Leads to, In routines) take one short
  row each and open in a sheet with search.
- The page's own actions go into slot 3's ⋯ menu once it exists.

## Non-goals

- The ⋯ menu itself, the version switch, Copy to, Same as, Move to, Detach,
  Drop my copy, Compare, Send: slots 3 and 8.
- The links popup: slot 5.
- A figure map, the "no position / no video / no exercise" marks, cleaning up
  other pages, the basic-step ideas: later, each designed with the user first.
- Any change to the data model or to what the page loads beyond what the new
  rows need. No migration, no new route.

## Anti-goals

- An upload lost because the sheet that started it closed.
- A second, page-local ⋯ menu that slot 3's then has to replace.
- Editing `LinksEditor`, `SourceTabs` or the clone sheets here: those files are
  other slots' and an edit here is a merge conflict.

## The page (phone order)

1. **Band** (unchanged): back, "Move · Figure" (compact), the subtitle, History,
   the Edit pencil. Slot 3's ⋯ joins the band in plan 2.
2. **Figure tabs and SourceTabs** (unchanged; slot 3 changes SourceTabs).
3. **The video.** A 16:9 card with a play disc over the picture and a caption
   strip at its foot: the section's label, where it is from, and its range
   (the words `SectionCard` uses today). A tap opens that section in its
   looping full-screen player (`SectionPlayer`), as a section card's tap does
   today. Which video:
   - the first of the variation's linked sections, in the order the page lists
     them today;
   - else the first video recording (not audio), drawn the same way: the bare
     picture with the play disc and the caption strip (the day, "Recording"),
     a tap opening the full-screen player at 0. Not today's full `VideoFrame`
     card with its control row *(my call: one look for the top video)*;
   - else nothing: no empty card, no placeholder.

   The top video is a preview of the first item of Recordings, so that item
   shows twice on purpose. Its row in Recordings owns everything else about it:
   Unlink or the delete while editing, Take, a broken file's message.

   The section's picture is the video itself at the section's start
   (`<video preload="metadata">` with a `#t=<start>` fragment, no controls, no
   autoplay), so nothing new is stored. *(My call: tap → the looping
   full-screen player rather than playing inline. The full-screen player is how
   the app plays a section everywhere else, and an inline section loop does not
   exist yet.)*
4. **The facts card** (today's, trimmed): the style and partner badges, Timing
   with the eight counts, **Positions** (today's "Handholds" row, renamed: the
   mockup the user approved says Positions; each position still links to its
   page; an empty side reads "No position"), and the notes. Same card, same
   tokens.
5. **Practice** stays as it is in plan 1 and goes in plan 2 (below).
6. **Recordings · N** with `+ Add` at the right of the heading row (editors
   only), then one grouped card of rows:
   - each linked section: today's `SectionCard` content as a row (accent play
     disc, label, "from · range"), a tap opens its looping player; while
     editing, its row ends in Unlink as today;
   - each recording: a row with a tonal lead icon (video, or mic for an old
     audio recording), the day it was made as the title (`recordingDay`) and
     "Video · 24 MB" / "Audio · 2 MB" as the meta. A tap on a video opens the
     full-screen player at 0 (`VideoPlayer`, as `VideoFrame`'s Full screen does);
     an audio recording keeps a small inline audio player in its row *(my call:
     there are old ones and they must stay playable)*. While editing, the row
     ends in the trash button that asks first, as today. A source's recording
     not yet taken (`data.taking`) ends in Take, as today. A broken file is found
     as today: each recording row holds a hidden `<video preload="metadata">`
     (or `<audio>`) watched by `watchMedia` from `$lib/media`, exactly as
     `VideoFrame` learns it now (the page already loads every recording's
     metadata today). A missing file's row reads "This file is missing" in
     `status` and does not open the player; an unplayable one reads "Can't play
     here" and ends in Download, as `VideoProblem` does today. `VideoPlayer` is
     not changed *(my call: it is shared with lessons and sections, and the
     player is another slot's area)*.
   - N counts sections and recordings (links join it in plan 3).
   - With nothing in it: an editor sees the heading and `+ Add` only; a reader
     sees no Recordings section at all *(my call)*.
   - A recording's own sections are no longer drawn under it (today's
     `VideoSections` under each recording): the ones linked to this figure are
     rows already, and all of them show in the full-screen player.
7. **Links** stay their own section, exactly as today, until plan 3.
8. **One card of three rows** (option B2): "Follows from", "Leads to",
   "In routines", each with its count on the right and a chevron. A tap opens a
   sheet (title "Follows from" / "Leads to" / "In N routines") with a search
   pill and the list:
   - figures as today's rows, labelled with `figureLabels` ("Move · Figure"),
     in today's order; the search folds accents and case (`fold.ts`) and matches
     the move or the figure name;
   - routines with today's meta ("Slot 2 of 6 · loops"), the looping ones first,
     then by name; a group's figure read by someone with their own routines
     using it gets two headed groups in the sheet, the group's and "Yours"
     (today's "In your routines"), and the row's count is both together.
   - A tap on a row goes to that figure or routine (the sheet closes first:
     `gotoWhenSettled`).
   - A count of 0 shows "None" in muted text, and the row is not a button.
   - A reader of a group's figure with no routines sees the row as "None" too
     (today it hides In routines for them; one rule is simpler).
9. **Taught in · N** (unchanged rows), then, in plan 1 only, today's
   "Move … to…" row and Archive button, which go in plan 2.

### The desktop (two columns from `two:`)

`left`: the video, the facts card, Practice (plan 1 only). `right`: Recordings,
then Links. `leftEnd`: the three-row card and Taught in (and, in plan 1, Move
and Archive). The phone's order is then exactly the list above, since
`PaneColumns` stacks `left`, `right`, `leftEnd`. Edit mode keeps today's layout:
the form across the top, the recordings with their delete under its right half.

## `+ Add`

Slot 5's look: `button('tertiary', 'sm')` with the plus icon, at the right of
the heading row, `aria-label` "Add to Recordings". It opens a small sheet,
"Add to <Figure>", of rows:

- **Link a section** — "A part of a lesson video": today's `LinkSectionSheet`.
- **Video from the phone** — on the web, it opens the file chooser for
  `video/*` and the upload goes to `/api/figures/[id]/recordings` as today; in
  the Android app, the `AppUploadLink` to the app's compress-and-upload, as today.
- **YouTube or other link** — plan 3 only, slot 5's popup.

No audio anywhere: no "Add audio", and the web's `accept` drops `audio/*`.

**The upload stays the page's.** The sheet must not own the upload's
component: closing it would take the progress card with it (the XHR survives,
the progress and its error message do not). The page keeps today's
`UploadButton` mounted in the Recordings section, invisible until a file goes
up, and the sheet's row closes the sheet and opens that button's file chooser
in the same tap (a file input only opens from a user gesture). While a file
goes up, its progress card shows as the Recordings list's first item, as today.
How the page reaches the input (a bindable `open` function, a forwarded ref) is
the builder's choice; `UploadButton` is shared, so it keeps its current look
and behaviour for every other caller.

## Plans

- **Plan 1, now:** the video, the facts card's Positions, Recordings as one list
  with `+ Add` (section and video), the three-row card and its sheets, the
  desktop columns, the specs and docs. Depends on neither slot.
- **Plan 2 (built 2026-11-06, on slot 3's `ItemMenu`):** Practice leaves the page. The
  menu gets this page's own items, first: **Create exercise** ("Put it on Today
  on its own", today's `?/practise`) or, once one exists, **Its exercise** (a
  link to it, with today's practice line as its meta), then **History** (from
  the band). The "Move … to…" row and Archive leave the page for slot 3's Move
  to and Archive items. A reader's pinned Practise / Edit bar stays as it is.
- **Plan 3, after slot 5's links popup is in master:** links become rows in
  Recordings (the YouTube row: title, site, a saved/saving/failed state, an
  external-link or Save video action as slot 5's row does it), the Links section
  goes, and `+ Add` gains "YouTube or other link", opening slot 5's popup.

## What stays as it is

Edit mode and its form; the clash check; the variation bar pinned at the bottom;
the reader's Edit / Practise bar; the log popup; the Make it mine sheet; every
server action. A page epoch raise is needed only if a form field or action a
loaded page sends changes; plan 1 changes none.

## Docs to keep current

- `2026-10-31-redesign-design.md`, "A figure": replace the order of the page.
- `2026-09-22-salsa-app-design.md`, wherever it describes the figure page.
- `CLAUDE.md`'s figure lines if a new pure module is added (for example
  `src/lib/figures/` wording for the row metas or the three rows).

## The approved mockup

`figure-page-options.html` in this session's scratchpad
(`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-figure-page/74ae04fc-47e8-48d1-916f-1d71eea03795/scratchpad/`),
part 2 ("The whole page") with option B2. It is not committed: it embeds
screenshots of the production database, which never go into the repo. What it
fixes that the text above leaves open: the top video's caption strip (white
13/600 on a dark gradient at the picture's foot); Recordings rows at 60 px with
a 40 px round lead (accent play disc for a section, tonal chip-coloured icon for
a recording) and a 20 px trailing icon; the three-row card as 52 px rows, the
label 16/700 on the left, the count 16/700 `muted` before the chevron; `+ Add`
on the heading row's right. A section row in the grouped card is a row variant
of `SectionCard` (no own rounded card), the builder's to shape.

## Left to the builder

- Where the pure parts live (row metas, the three rows' counts and "None",
  the routines' sort): `src/lib/figures/page.ts` is the obvious home, with specs.
- The sheet for the three rows: a plain `Sheet` with `SearchField` and a
  `GROUP` list is enough; the shared `Picker` is for picking, not navigating.
- How `UploadButton` exposes its file chooser.
- Screenshots after building, with the rig, at 390×844 light and dark and at
  1440×900 desktop, on a copy of the latest backup, compared with the approved
  mockup (`scripts/shots`).
