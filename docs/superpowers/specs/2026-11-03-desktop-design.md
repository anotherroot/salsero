# Desktop: the app on a wide screen

Status: the frame and three layout questions agreed 2026-11-03. Not built.

**Order (the user's):** this spec first; then every page is drawn at desktop
width on the boards (in the design session, not by the builder) and the user
looks them over; only then is it built, from the boards and this spec. A plan
written before the every-page boards exist covers nothing but the build
order; the boards are the target for each page.

Boards: https://claude.ai/artifact/NJjKcTobc99mpVut2ETVB3, the page "In the
chosen frame" (what is agreed) and "Frame explorations" (what was tried and
not picked). They are drawn with the redesign's design kit
([`docs/superpowers/design-kit/kit.py`](../design-kit/kit.py)), so every
colour, type size, radius and component is the one the phone uses. The boards'
source moves into `docs/superpowers/design-kit/desktop/` with the every-page
set.

This spec only says what changes on a wide screen. Everything else (the look,
the tokens, the components and their states, what each screen does) is the
[redesign spec](2026-10-31-redesign-design.md), and the phone stays exactly as
it is.

## Why

The app is used "mostly at lunchtime from a locked-down work PC (browser only)
and from a phone" (main spec). On the PC it shows the phone layout: a 560 px
column in the middle of the window, a tab bar at the bottom, sheets sliding up
from the bottom of a 1440 px wide screen. That was never designed; the
redesign spec left "tablet/desktop width" to the builder as "the phone layout
centred with a max width, as today". The user: "if you open the site on a
computer it shows the mobile size".

Success: on a computer the app looks like it was made for one: the same look
as the phone (the band, the sheet, the type, the four themes), using the
width to show more at once, with nothing the phone can do missing.

## Goals, non-goals, anti-goals

- **Goals:** a desktop frame for every page; a list and the item opened from
  it side by side; figure and lesson pages in two columns; popups as centred
  dialogs; every page drawn at desktop width before it is built.
- **Non-goals:** no new features, no data-model change, no change to what a
  page can do or to any URL. No keyboard shortcuts beyond what dialogs and the
  video player already have. No separate desktop app or second set of
  components.
- **Anti-goals:** the phone looking or behaving any differently; a desktop
  that is the phone stretched wide (lines and cards 1400 px long); a page that
  works on the phone and is left half-designed on desktop; two copies of the
  same list on one page.

## When the desktop layout applies

- **From 1024 px of window width** (CSS pixels), whatever the height or the
  device. Narrower windows, and the Android app on any phone, get the phone
  layout as it is today. *My call:* 1024 keeps every phone on its side (the
  widest are about 930 px) on the phone layout, and gives a laptop at 1280 or
  1366 the desktop.
- One codebase and one DOM: the desktop is the same pages and components
  restyled at that width, plus the few structural pieces below (the side,
  the list column). The full-screen video player keeps its own rule
  (`layoutFor` in `src/lib/video/layout.ts`) and its existing desktop layout.

## The frame

Agreed board: "The frame · Today". The window is the band colour. The band is
one short row across the top and a narrow column down the left; the sheet
fills the rest.

### The band row

- **88 px tall**, the full window width, band-coloured. It does not scroll and
  never shrinks: there is no big band and no slim band on desktop.
- **The title on the left,** starting 30 px from the window's left edge (over
  the side column): Bricolage 800 46 px in cream (`display`), one line. A long
  title uses the phone's compact rule (30 px past 18 characters or a word
  over 10) and ends in an ellipsis if it still does not fit.
- **A subtitle** (Today's date, "2 days ago", a routine's name on Practice)
  sits beside the title on the same line, 14 px after it, in `subtitle`
  15/600 `band-small`, nudged down to share the title's baseline.
- **Back** ‹ comes before the title (from 18 px), as a band icon button. Where
  it shows and where it goes is the phone's (`BackButton`, the trail).
- **Toggles in the middle,** centred over the sheet (not the window): the
  Moves segmented Figures | Routines, Practice's Count only | A song, My
  count's count pattern, Today's past-day "Back to today" pill. The band's
  segmented control is the phone's (cream pill on the 15 % black track).
- **Actions on the right,** 30 px from the window's right edge: the phone's
  bare cream band icons in 44 px hit areas, in the phone's order (New +,
  Edit pencil, ⋯, ‹ › on a past day, Previous day ‹ on Today, Select on
  Coverage). Settings is not among them on desktop: it is in the side.
- The row is a three-column grid from the side's edge to the window's right
  edge: left and right columns share the space equally, the middle sizes to
  its toggle, so the toggle stays centred over the sheet whatever the title's
  length. The title's column reaches back over the side to the window edge.
- The navigation progress bar (cream) runs along the top edge of the row.

### The side

- **188 px wide**, band-coloured, from under the band row to the bottom of the
  window.
- **The four tabs at the top** (Today, Moves, Lessons, Music), then **Settings
  at the bottom.** Each is a 48 px row: a 24 px icon and the label (16/700,
  `band-small`), 14 px in, 12 px between icon and label, rows 4 px apart, the
  column padded 6 px top, 12 px sides, 20 px bottom.
- **The current one** is a cream pill (radius 24) with its filled icon and its
  label in the band colour at 800, the way the phone's tab bar shows it.
- Which item is lit, and where a tap goes (the tab's last page, the lit tab
  going to its main list), is the phone's tab bar: `src/lib/nav/tabs.ts` and
  `src/lib/nav/trail.ts`. Settings is lit on Settings, What uses space, My
  count and the admin page.
- The side replaces the bottom tab bar; on desktop there is no tab bar.
- It is the `<nav aria-label="Main">` landmark, after the page content in the
  DOM as the tab bar is now (see "Keyboard and focus").

### The sheet

- The page content sits on a sheet from the side's edge (x 188) and the band
  row's edge (y 88) to the window's right and bottom edges, in `ground`, with
  a **28 px radius on its top-left corner only** (the other corners meet the
  window's edges).
- **The sheet scrolls, the frame does not.** The band row and the side stay
  put; the content scrolls inside the sheet (inside each pane where there are
  two, see below). Kept scroll positions (the trail, `pages-keep-state`) are
  the sheet's or the pane's on desktop, not the window's.
- **Content width:** page content is padded 28 px top and 40 px at the sides,
  and stops growing at a max width, centred in the sheet: **1140 px** for a
  page in two columns, **720 px** for a page in one column. *My call,* so
  that a 1920 px or wider screen does not stretch rows and cards.
- **Today's hero card** is the first card on the sheet, not straddling the
  band (there is no tall band to straddle).
- **Pinned bars** (an edit's Save, a selection bar, the exercise page's Log a
  set, Practice's Play, Stop and Pause) pin to the bottom of the sheet or of
  the pane they belong to, as wide as that pane's content, not to the bottom
  of the window. There is no tab bar for them to step aside from.
- **Toasts** show at the bottom centre of the sheet, above a pinned bar if
  there is one.

### Pages without the side

- **Practice and the share page** have no side, as the phone has no tab bar
  there. The band row spans the full width; the sheet runs edge to edge under
  it, rounded at both top corners (28 px), as the phone's sheet is.
- **Sign in and Join** (no dance yet, nothing to navigate to): the band colour
  fills the window and the phone's form sits in a centred card, 480 px wide,
  `ground`, radius 28. *My call.*
- **Pair this phone** (`/device/pair`): the same centred card.
- **Error pages** inside a dance (404, server error) keep the frame and the
  side; the error screen sits in the sheet, centred, 560 px wide. The Offline
  layer covers the whole window, its content centred at 560 px.

### Pointer and hover

- *My call:* rows, buttons, chips and the side's items get a hover overlay
  (ink at 4 % in light, white at 5 % in dark; on the band, cream at 10 %),
  lighter than the pressed overlay, and a pointer cursor. Only where the
  device can hover (`@media (hover: hover)`), so the phone never shows a stuck
  hover.
- Everything that is a gesture on the phone has a click or key on desktop, as
  it already does: long-press selection has the ⋯ Select item, Back closes a
  dialog, pinch zoom has the player's own zoom keys. The one gap is the
  routine editor's **swipe left to delete a slot**: on desktop a trash icon
  button shows on a slot card on hover and on keyboard focus (*my call*; it
  does what the swipe does, with the same Undo toast).

## A list and the item beside it (2A)

Agreed board: "2A · A list and the open item side by side".

- **Where:** Moves (Figures, Routines), Lessons and Music. The sheet holds two
  panes: **the list on the left, 360 px wide** (*my call*: the board drew
  392 at 1440; 360 leaves the item room at 1280), and the opened item to its
  right, divided by a `hairline` rule. Each pane scrolls on its own.
- **The URL decides what is open,** exactly as now: `/salsa/figures/12` is the
  Figures list with variation 12 open beside it; `/salsa/figures` is the list
  with nothing open. Opening another row replaces the item pane and adds a
  history entry, as a page navigation does now; the list pane keeps its
  scroll, search and chips because it is not re-rendered.
- **The list's search and chips survive opening an item** (*my call*). Today
  they live in the list's URL (`?q=`, `?style=`, `?partner=`, `?unlinked=1`
  on Figures, `?q=` on Music) and Figures filters on the server. On desktop
  the list route keeps writing them to its URL as now, but the list column
  filters on the client from the whole list, and keeps the filter in the
  trail's kept state for the list page (sessionStorage), not in the item's
  URL. Item URLs stay as they are; reloading an item page keeps the filter
  for the rest of the session, as the trail keeps anything else. The filter
  rule moves into a pure function (`src/lib/moves/`, `src/lib/songs/search.ts`)
  that the server and the list column share. The phone is unchanged.
- **Moving between lists:** the URL decides which list the column shows. The
  band's Figures | Routines toggle opens the other list with nothing open, as
  it opens the bare list on the phone. A figure opened from a routine's slot
  shows the Figures list beside it (no row lit if the filter hides it), with
  ‹ in the pane back to the routine. *My call.*
- **Nothing open** (*my call*): the item pane shows an empty state centred in
  it ("Pick a figure", "Pick a routine", "Pick a lesson", "Pick a song" with
  the list's icon) and the band's + for creating one. It does not open the
  first row by itself.
- **The open row is marked** in the list: tinted `accent_soft` and
  `aria-current="page"`.
- **The band belongs to the tab, not the item:** the band row says Moves,
  Lessons or Music, with the tab's toggle in the middle and the tab's + on
  the right. The item's own controls move into **the item pane's header**:
  its name in `display_s` (30/800, ink), its subtitle line, and its actions
  (Edit, ⋯, Practise) as tonal icon buttons on the right of that header.
- **The pane's Back:** when the item was opened from its own list, the pane
  has no back (the list is beside it). When it was opened from somewhere
  else (a lesson's Figures, a routine's slot, Today), its header starts with
  ‹, going where the phone's band back goes (the trail). *My call.*
- **What each list column holds** is the phone's list, unchanged in content:
  - Figures: search, the Positions and Coverage tiles, the filter chips
    (wrapping onto more lines instead of scrolling sideways), the figure rows.
    **Positions and Coverage open in the item pane too** (*my call*: they are
    opened from the list column, so they belong beside it), their tile tinted
    while open.
  - Routines: the routine rows with their badges.
  - Lessons: the month groups with their date tiles.
  - Music: search, Count only, Being added, Recent, A–Z, with samples. Count
    only opens Practice, which is a page of its own (no side).
- **Editing** happens in the item pane: the pane's content becomes the form,
  its header shows × (Stop editing), its Save pins to the bottom of the pane.
  The list stays usable; opening another row while there are unsaved changes
  asks first (the existing navigation guard).
- **Selection** (the routine's slots, Coverage) also stays in the pane: its
  header reads "3 selected" with ×, and the selection bar pins to the bottom
  of the pane.
- **Today is not a list and pane** (*my call*): it is two columns (below), and
  an exercise opens as a page of its own with ‹, lighting Today.

## Two columns: about on the left, videos on the right (3A)

Agreed board: "3A · A figure: about on the left, videos on the right".

- **A figure** in its pane: the left column (5 parts) holds what it is and how
  it is practised: the facts card (badges, the timing, handholds, notes),
  Practice, In routines, Follows from / Leads to (side by side), Taught in,
  Move … to, Archive. The right column (7 parts) holds what is watched:
  Recordings with their sections, Linked sections, Links. 32 px between the
  columns, aligned at the top, each in the phone's order.
- **The variation switcher** becomes **variation tabs** under the figure's
  name in the pane header: one pill per variation (selected solid accent,
  the others the neutral chip), and a dashed "+ Variation" pill that opens the
  New variation dialog. They wrap onto a second line when there are many, and
  hide while editing, as the switcher does. There is no pinned switcher on
  desktop.
- **A lesson** follows the same split: left the notes, the review exercise,
  Figures, Routines, Exercises; right Videos (with their sections) and Links.
- **When the pane is narrow,** both fall back to one column in the phone's
  order. Two columns from a pane 780 px wide (*my call*: a 1366 px window gets
  two columns, 1280 gets one).
- **Inline videos** take their column's width and are at most 70 % of the
  window's height tall (*my call*: an upright phone video in a 450 px column
  would otherwise be taller than the screen); the picture letterboxes inside
  the dark frame.

## Popups are dialogs (4B)

Agreed board: "4B · A popup is a dialog in the middle".

- **Every bottom sheet is a centred dialog on desktop:** the log popup, the
  create sheets (figure, routine, position, lesson, exercise, song), How often,
  the variation list, Song details, the routine picker, the shared picker and
  the Link popup, the rename and remove sheets.
- **The dialog:** 560 px wide, in the sheet colour (`sheet_bg`), radius 28
  on all corners, a large soft shadow (0 24 70 at 32 % black). As tall as its
  content, at most 780 px and never closer than 32 px to the window's top and
  bottom; past that its body scrolls. No grabber.
- **Its parts are the bottom sheet's:** the header (title in `headline` 22/800,
  the subtitle under it, header actions such as Skip and Details, ×), the
  body, the pinned footer with its main button. Padding 28 px at the sides.
- **The scrim covers the whole window,** band and side included.
- **Stacked levels** (the Link popup's levels, How often from New exercise):
  the new level opens in the same place and size on top of the one below,
  with Back on its left and no ×, as on the phone; one scrim, not two.
- **Closing** is the phone's: ×, Back (one history entry per open dialog, as
  `src/lib/sheets/stack.ts` does for sheets), Esc and a click on the scrim
  (`Sheet.svelte` already does both, and already centres itself above
  640 px; the desktop sets its size and look). All of them go through the unsaved-changes question when a form
  in it has unsaved input.
- **The picker is a dialog too,** replacing the redesign spec's "bottom sheet
  centred with a max width". Its search is focused when it opens on desktop
  (*my call*: there is no on-screen keyboard to pop up).
- The kit's small question dialogs (archive, delete, Unsaved changes) are
  already centred dialogs and do not change.
- **Inside the full-screen player** (its desktop layout), its sheets become
  dialogs too, in the player's media palette.

## Page by page

What each page becomes. The every-page boards are the target once drawn; this
list is what they will follow.

- **Today:** the band says Today with the date; ‹ Previous day on the right.
  Two equal columns, max 1120: the left holds the hero card and Due; the right
  Not yet due, Done today, Inactive and "+ Custom exercise". A row opens the
  exercise page; its + opens the log dialog. A running session's "Up next" row
  and the hero's Resume read as on the phone. The first-run empty state is
  centred across both columns.
- **A past day:** the compact title ("Thu 29 Oct", "2 days ago"), "Back to
  today" in the middle, ‹ › on the right. One column, max 720: the sets
  grouped per exercise, then the "Forgot to log something" picker field.
- **The exercise page** (lights Today): a page of its own with ‹. Two columns:
  left the owner row, the three stat tiles, the settings (How often, Active,
  notes), a drill's links and sections, Archive; right the sets grouped by
  day. Log a set pinned at the bottom of the sheet.
- **Moves → Figures:** the list and the figure (above). Positions and
  Coverage in the item pane, each one column at 720 max inside it.
- **Moves → Routines:** the list and the routine. The routine pane: its header
  with the name, Edit and ⋯; the Practise hero card; "Starts from … ends at …"
  with its badges; the slot cards; More (Exercise, Taught in). One column, max
  720, centred in the pane. Seams, the picker (a dialog) and drag to reorder
  as on the phone.
- **Lessons:** the list and the lesson (two columns, above). Uploads and
  YouTube saves show where they show on the phone, in the right column.
- **Music:** the list and the song. The song pane is one column, max 640: Tap
  on the 1, Practice with this song, the count and transport card, sample,
  count speed, Your 1s; a song being added shows its three steps. Add a song
  and Song details are dialogs.
- **Practice:** no side. The band row: ‹, "Practice" with the routine or
  song as subtitle, Count only | A song in the middle. **Setup:** one column,
  max 640, Play pinned at the bottom of the sheet. **Running** (*my call*, the
  phone-on-its-side layout made big): below the band row the window splits;
  the stage is on the band to the left (the count in cream, as large as the
  height allows up to 240 px, the 1 as a cream disc, the eight dots, the
  called figure, the elapsed time) and the sheet is a 520 px column on the
  right (seek bar, the routine's slots with Now, the Voice card) with Stop
  and Pause pinned at its bottom. Save this run is a dialog. This replaces
  the main spec's "a desktop keeps the 560 px column".
- **The full-screen video player:** unchanged; it covers the whole window,
  frame included, in its existing desktop layout.
- **Settings:** the side with Settings lit, the band says Settings. One
  column, max 720, the phone's grouped rows. **What uses space**, **My count**
  (its count pattern in the middle of the band) and **the admin page** the
  same way, each with ‹ to Settings where the phone has it.
- **Share** ("Add to a lesson"): no side; the phone's list in one column, max
  560. It is the Android share target and is not expected on a PC.
- **Sign in, Join, Pair this phone, errors, Offline:** above, under "Pages
  without the side".
- **Loading:** the skeleton draws the frame (band row, side) and skeleton rows
  shaped like the desktop page: both panes where there are two.
- **The kit gallery** (`/dev/kit`, dev only): not designed; it may show the
  phone column.

## Keyboard and focus

- The DOM order stays the phone's: the band row, the page content, then the
  side (the tab bar's place). Landmarks (`header`, `main`, `nav "Main"`)
  let a screen reader jump. *My call:* no skip link, as the phone has none.
- In a list and pane, the list comes before the item in the DOM and in tab
  order. After opening a row, focus stays on the row (the pane updates beside
  it), so arrowing or tabbing through the list keeps its place.
- Esc closes the top dialog (native `<dialog>` already does; the unsaved
  question still applies). Focus returns to what opened it.
- The video player's keys and its "?" list are unchanged. No other shortcuts.

## Building it

- **One set of components.** The desktop is a width condition (1024 px) in
  the existing components and a few new structural ones: the band row on
  `Screen`, the side (`BottomNav`'s desktop form or a sibling), the sheet's
  scroll container, the list column, and `Sheet` styled as a centred dialog.
  The 560 px caps in `+layout.svelte`, `BottomNav.svelte`, `Screen.svelte`'s
  slim band and `PageSkeleton.svelte` apply below 1024 only.
- **The list column lives in a layout,** shared by the list route and the item
  route, so the list is rendered once and is not rebuilt when an item opens.
  The URLs do not change (a route group may hold Figures, Positions and
  Coverage together). On the phone the item routes do not show the list,
  and the phone's list page looks and behaves as now. A list is never
  rendered twice on one page.
- **The list's data** loads in that layout, so an item page also loads its
  list. Accepted on the phone too: the lists are single SQLite queries.
- **Pure parts stay pure and tested:** which pages show the side, which tab or
  Settings is lit, which list a route belongs to and which row is open, and
  whether a pane opened from its own list gets a back (from the trail). They
  belong in `src/lib/nav/` beside `tabs.ts` and `trail.ts`, with specs.
- **Verifying:** screenshots of every page at 1440×900, 1280×800 and
  1024×768 (light and dark, salsa and bachata) against the boards, and the
  phone at 390 wide compared before and after, which must not change. The
  existing specs, `npm run check`, all pass.
- Existing rules hold: `use:guarded` forms, `refreshWhenSettled()`, colours
  from the builders, `GROUP`/`CLIP` for clipping cards, focus after a removal.

## Left to the builder

- Component names and file layout; how the width condition is written (a
  Tailwind custom variant is the obvious one).
- Exact hover colours within the rule above, and transition timings (short,
  respecting `prefers-reduced-motion`).
- How each pane's scroll container hooks into the trail's kept scroll.
- Whether the list column on a phone item route is not rendered or rendered
  hidden, as long as the phone looks and behaves as now and nothing is
  focusable or read out twice.

## Calls made while writing this (check these)

- **1024 px** is where the desktop starts.
- **The figure's two columns (3A) are the layout of the figure inside its
  pane (2A)**, not a separate full-width figure page: one URL, one layout.
  The 3A board drew the figure full width with its name and variation tabs on
  the band; in the agreed frame the band is Moves', so the name and the tabs
  sit in the pane's header as on the 2A board. Lessons get the same split.
- **The list column is 360 px**; the item pane uses two columns from 780 px
  (a 1366 px window and wider), one below.
- **Lists that open beside themselves:** Moves (Figures with Positions and
  Coverage; Routines), Lessons, Music. **Not Today:** it stays two columns,
  and an exercise is a page of its own.
- **Nothing open** shows an empty pane; the first row is not opened by itself.
- **The list's filter** is kept by the trail, not in the item's URL, and
  filtered on the client on desktop; the Figures | Routines toggle opens the
  other list with nothing open.
- **A pane opened from somewhere else gets ‹** (by the trail); one opened from
  its own list does not.
- **Practice running** puts the stage left on the band and the sheet right
  (520 px), like a phone on its side; Practice and share have no side.
- **Settings, What uses space, My count and the admin page** show the side
  with Settings lit (the phone shows no tab bar there).
- **Content max widths** 1140 (two columns) and 720 (one column); the song
  pane 640; error and share 560.
- **Stacked dialog levels** open on top in the same place; the picker's
  search is focused on open.
- **Hover overlays** where the device can hover; a **trash button on a slot
  card** on hover and focus stands in for swipe-to-delete.
- **Inline videos** at most 70 % of the window's height.
- **Sign in, Join and Pair** sit in a centred 480 px card on the band colour.
- **DOM order** stays the phone's (side last); no skip link.

## Changes to other specs

- [Redesign](2026-10-31-redesign-design.md): "Tablet/desktop width" under
  "Left to the builder", the picker's "stays a bottom sheet … on desktop"
  call, and "Desktop layouts … restyled, layout unchanged" now point here
  (the player's own desktop layout is still unchanged).
- [Main spec](2026-09-22-salsa-app-design.md): Practice's "a desktop keeps the
  560 px column" now points here.
- `CLAUDE.md` lists this spec with the others.
