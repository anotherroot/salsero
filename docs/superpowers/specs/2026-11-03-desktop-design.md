# Desktop: the app on a wide screen

Status: the frame agreed 2026-11-03; every page drawn at desktop width and
settled with the user over nine review rounds, 2026-11-03/04. Not built.

**Order (the user's):** this spec, then every page drawn at desktop width on
the boards and looked over by the user, then the build. The first two are
done. **The boards are the target for each page;** this spec says what holds
across pages, and what a board alone cannot show (URLs, behaviour, the rules
behind a layout).

Boards: https://claude.ai/artifact/MHiCSgC56gJSrsEsbyXQ4i (171 boards, four
themes, "Settled so far" at the top). Source:
[`docs/superpowers/design-kit/desktop/`](../design-kit/desktop/README.md),
which renders every board as a standalone page for side-by-side comparison.
They are drawn with the redesign's design kit, so every colour, type size,
radius and component is the one the phone uses. The first frame explorations
(https://claude.ai/artifact/NJjKcTobc99mpVut2ETVB3) are history only.

This spec only says what changes on a wide screen. Everything else (the look,
the tokens, the components and their states, what each screen does) is the
[redesign spec](2026-10-31-redesign-design.md) and the feature specs, and the
phone stays exactly as it is.

**Where a board's wording differs from the built app** (a label, a menu item,
an order), the built app wins: the boards were drawn from the phone canvases
and may lag a rename. The desktop changes layout, not words or features,
except where this spec says so.

## Why

The app is used "mostly at lunchtime from a locked-down work PC (browser only)
and from a phone" (main spec). On the PC it shows the phone layout: a 560 px
column in the middle of the window, a tab bar at the bottom, sheets sliding up
from the bottom of a 1440 px wide screen. The user: "if you open the site on a
computer it shows the mobile size".

Success: on a computer the app looks like it was made for one: the same look
as the phone (the band, the sheet, the type, the four themes), using the
width to show more at once, with nothing the phone can do missing.

## Goals, non-goals, anti-goals

- **Goals:** a desktop frame for every page; a list and the item opened from
  it side by side; figure, position and lesson pages in two columns; popups as
  centred dialogs; Today as a list with the open exercise beside it.
- **Non-goals:** no new features, no data-model change, no migration, no
  change to what a page can do or to any URL. No keyboard shortcuts beyond
  what dialogs, the map and the video player already have. No separate
  desktop app or second set of components. No band pattern (below).
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
  restyled at that width, plus the few structural pieces below (the side, the
  list column, the pane). The full-screen video player keeps its own rule
  (`layoutFor` in `src/lib/video/layout.ts`) and its existing desktop layout.
- Resizing across 1024 switches layouts live; nothing is lost (an open item
  stays open, a dialog becomes a sheet and back).

## The frame

Boards: every board; "Today · the list and the open exercise" shows it best.
The window is the band colour. The band is one short row across the top and
a column down the left; the sheet fills the rest.

### The band row

- **88 px tall**, the full window width, band-coloured. It does not scroll and
  never shrinks: there is no big band and no slim band on desktop.
- **The title on the left,** starting 30 px from the window's left edge (over
  the side column): Bricolage 800 46 px in cream (`display`), one line. A long
  title uses the phone's compact rule (30 px past 18 characters or a word
  over 10) and ends in an ellipsis if it still does not fit.
- **A subtitle** (Today's date, "2 days ago", a routine's name on Practice, a
  group's storage in group mode) sits beside the title on the same line,
  14 px after it, in `subtitle` 15/600 `band-small`, sharing the title's
  baseline.
- **Back** ‹ comes before the title, as a band icon button, only on pages that
  are not a tab's list and pane (Practice, a past day's own ‹ ›, My count,
  What uses space…). Where it shows and where it goes is the phone's
  (`BackButton`, the trail). In a list and pane, back belongs to the pane
  (below).
- **Toggles in the middle,** centred over the sheet (not the window): Moves'
  segmented **Figures | Routines | Positions**, Practice's Count only | A
  song, My count's count pattern, a past day's "Back to today" pill. The
  band's segmented control is the phone's (cream pill on the 15 % black
  track).
- **Actions on the right,** 30 px from the window's right edge: the phone's
  bare cream band icons in 44 px hit areas, in the phone's order. Today: **+
  (Custom exercise)** and ‹ Previous day; the sliders icon (Settings) is gone,
  Settings is in the side. Moves: the group button and + (New move, New
  routine or New position, by the segment). Lessons, Music, Groups: the group
  button where the phone has it, and +. A past day: ‹ ›.
- The row is a three-column grid from the side's edge to the window's right
  edge: left and right columns share the space equally, the middle sizes to
  its toggle, so the toggle stays centred over the sheet whatever the title's
  length. The title's column reaches back over the side to the window edge.
- The navigation progress bar (cream) runs along the top edge of the row.
- **No band pattern.** The boards' viewer has a Band switcher (silhouettes and
  gradients on the band); the user has not picked one, so the band stays
  plain. It is not part of this build.

### The side

- **188 px wide**, band-coloured, from under the band row to the bottom of the
  window.
- **The five tabs at the top** (Today, Moves, Lessons, Groups, Music), then
  **Settings at the bottom.** Each is a 48 px row, **144 px wide and centred
  in the side** (22 px of band on each side): a 24 px icon and the label
  (16/700, `band-small`), 14 px in, 12 px between icon and label, rows 4 px
  apart. (Settled round 3: the full-width rows read as too heavy.)
- **The current one** is a cream pill (radius 24) with its filled icon and its
  label in the band colour at 800, the way the phone's tab bar shows it.
- Which item is lit, and where a tap goes (the tab's last page, the lit tab
  going to its main list), is the phone's tab bar: `src/lib/nav/tabs.ts` and
  `src/lib/nav/trail.ts`. Settings is lit on Settings, What uses space, My
  count and the admin page.
- **Something new in your groups** is the phone's dot on Groups: a 9 px dot
  after the label (cream, or the band colour on the lit pill), never a number.
- The side replaces the bottom tab bar; on desktop there is no tab bar.
- It is the `<nav aria-label="Main">` landmark, after the page content in the
  DOM as the tab bar is now (see "Keyboard and focus").

### Group mode

[Group mode](2026-11-03-groups-follow-ups-design.md) (an owner or editor
working in one group) keeps the frame and changes its colour and one item
(boards "Group mode: the group's Moves", "Group mode · Lessons", "Group mode ·
Music", "Group mode: the group's positions"):

- The band row and the side take the navy palette (`GROUP` in `tokens.ts`),
  and every accent on the sheet with them, as on the phone.
- The thin striped edge runs along the **top of the window**, over the band
  row and the side.
- The small line "<people icon> Salsa Tuesdays · group" sits **above the
  title** in the band row (13/700, `band-small`); the title keeps its size.
- **Today becomes Mine** in the side: the back icon and the word, no pill,
  the same one-tap form as the phone's. It is never lit.
- The round group button (Work in a group outside, Switch group inside) sits
  in the band row's actions, left of +, on Moves, Lessons and Music, only for
  someone who owns or edits a group of this dance. Its Work in sheet is a
  dialog like every other; with one group it goes straight in.
- Group mode's Moves has no Coverage tile (Coverage is personal).

### The sheet

- The page content sits on a sheet from the side's edge (x 188) and the band
  row's edge (y 88) to the window's right and bottom edges, in `ground`, with
  a **28 px radius on its top-left corner only**.
- **The sheet scrolls, the frame does not.** The band row and the side stay
  put; the content scrolls inside the sheet (inside each pane where there are
  two). Kept scroll positions (the trail, `pages-keep-state`) are the sheet's
  or the pane's on desktop, not the window's.
- **Content width:** page content is padded 28 px top and 40 px at the sides,
  and stops growing at a max width, centred in the sheet or pane: **1140 px**
  for two columns, **720 px** for one column, **640** for a song, a lesson
  being edited and Practice's setup, **560** for errors and share. *My call.*
- **Pinned bars** (an edit's Save, a selection bar, Today's Log set,
  Practice's Play, Stop and Pause, a group song's Share with the class) pin to
  the bottom of the sheet or of the pane or column they belong to, as wide as
  that content, not to the bottom of the window.
- **Toasts** show at the bottom centre of the sheet, above a pinned bar if
  there is one. The "New version · Reload" and "This page is out of date"
  bars sit at the foot of the sheet.

### Pages without the side

- **Practice and the share page** have no side, as the phone has no tab bar
  there. The band row spans the full width; the sheet runs edge to edge under
  it, rounded at both top corners (28 px), as the phone's sheet is.
- **Sign in, Join, Welcome, Get the app, Pair this phone, and a group code's
  Join (`/g/<code>`)**: no frame. The band colour fills the window, the title
  sits on it, and the phone's form sits in a centred card, 480 px wide,
  `ground`, radius 28. *My call.* Get the app on a computer says to open the
  page on the phone, with the QR of its URL (as built). A group code that no
  longer works shows its message in the same card rather than the bare error
  page (board "Join · an old code"). So does any other error outside a dance,
  or signed out: there is no side to keep. *My call while building.*
- **Error pages** inside a dance (404, server error) keep the frame and the
  side; the error sits in the sheet, centred, 560 px wide. The side lights the
  tab of the page that was asked for. The Offline layer covers the whole
  window, side included, its content centred at 560 px.

### Pointer and hover

- *My call:* rows, buttons, chips and the side's items get a hover overlay
  (ink at 4 % in light, white at 5 % in dark; on the band, cream at 10 %),
  lighter than the pressed overlay, and a pointer cursor. Only where the
  device can hover (`@media (hover: hover)`), so the phone never shows a stuck
  hover.
- Everything that is a gesture on the phone has a click or key on desktop:
  long-press selection has the ⋯ Select item, Back closes a dialog, pinch zoom
  has the player's own zoom keys and the map's wheel and buttons. The
  routine editor's **swipe left to delete a slot** becomes a trash icon button
  on a slot card on hover and on keyboard focus (board "Working on the
  slots"); it does what the swipe does, with the same Undo toast.

## A list and the item beside it (2A)

Boards: "Figures · nothing open", "A figure open beside the list", "Routines ·
nothing open", "Positions · the list and the map", "Lessons · the list,
nothing open", "Music · the library, nothing open", "Groups · nothing open".

- **Where:** Moves (Figures, Routines, Positions), Lessons, Music and Groups;
  Today has its own form of it (below). The sheet holds two panes: **the list
  on the left, 360 px wide** (Today's 400), and the opened item to its right,
  divided by a `hairline` rule. Each pane scrolls on its own.
- **The URL decides what is open,** exactly as now: `/salsa/figures/12` is the
  Figures list with figure 12 open beside it; `/salsa/figures` is the list
  with nothing open. Opening another row replaces the item pane and adds a
  history entry, as a page navigation does now; the list pane keeps its
  scroll, search and chips because it is not re-rendered.
- **Which list sits beside an item** is decided by the route, with one
  exception: **a figure opened from a routine** (a slot, Practise's list)
  keeps the switch on Routines and the routines list on the left, that
  routine lit, and the pane's ‹ goes back to the routine (board "A figure
  opened from a routine's slot", settled round 4). How the figure knows: the
  trail's opener for that page (`src/lib/nav/trail.ts`), not a URL parameter,
  so a reload or a link from elsewhere shows the Figures list. The same rule
  holds for a position opened from a figure: Figures stays on the left.
- **The list's search and chips survive opening an item** (*my call*). They
  live in the list's URL today (`?q=`, `?style=`, `?partner=`, `?unlinked=1`
  on Figures, `?q=` on Music). On desktop the list column filters on the
  client from the whole list and keeps the filter in the trail's kept state
  for the list page (sessionStorage), not in the item's URL. Item URLs stay
  as they are. The filter rule moves into a pure function (`src/lib/moves/`,
  `src/lib/songs/search.ts`, `src/lib/positions/`) that the server and the
  list column share. The phone is unchanged.
- **Moving between lists:** the band's Figures | Routines | Positions opens
  the other list with nothing open, as it opens the bare list on the phone.
- **Nothing open:** Figures, Routines, Lessons, Music and Groups show an
  empty state centred in the pane ("Pick a figure", "Pick a song"… with the
  list's icon; Music's has a button that opens Practice with the count only).
  **Positions shows the map** (below). Nothing opens the first row by itself.
- **The open row is marked** in the list: tinted `accent_soft` and
  `aria-current="page"`. A move's heading is lit while the move's page is
  open; Coverage's tile while Coverage is open; a group while its People,
  storage or History is open.
- **The band belongs to the tab, not the item:** the band row says Moves,
  Lessons, Music or Groups, with the tab's toggle in the middle and the tab's
  + on the right. The item's own controls move into **the pane's header**: its
  name in `display_s` (30/800, ink), its subtitle line, and its actions (Edit,
  ⋯, Practise, History) as tonal icon buttons on the right of that header.
- **The pane's Back:** an item opened from its own list has no back (the list
  is beside it). An item opened from somewhere else (a lesson's Figures, a
  routine's slot, a group's page, Today) or a page under the item (a group's
  People, storage, History; a lesson's History) starts its header with ‹,
  going where the phone's band back goes (the trail).
- **What each list column holds** is the phone's list, unchanged in content:
  - Figures: search, the **Coverage tile only** (the Positions tile is gone:
    Positions is the switch's third segment; no tile at all in group mode),
    the filter chips wrapping onto more lines, the figures under their move's
    heading ("Yours · 14 figures", then each group's under a slight heading).
  - Routines: yours, then each group's from lessons you added, under the same
    slight heading.
  - Positions: Templates and How positions work at the top, search, a chip
    per type and Gaps, No position with its count, yours, then each group's.
  - Lessons: one list by month with date tiles; an added one carries its
    group's name, a copy carries the Copy badge.
  - Music: search, Count only, Being added, Recent, A–Z with samples, then a
    section per group's class songs.
  - Groups: your groups, "2 new" on one with something new. With no groups,
    no list column: the empty state is centred on the sheet.
- **Editing** happens in the pane: its content becomes the form, its header
  shows × (Stop editing), its Save pins to the bottom of the pane. The list
  stays usable; opening another row with unsaved changes asks first (the
  existing navigation guard).
- **Selection** (a routine's slots, Coverage) stays in the pane: its header
  reads "3 selected" with ×, and the selection bar pins to the pane's bottom.

## Today: the list and the open exercise (Option A)

Boards: "Today · the list and the open exercise", "a session running",
"logged, Next", "session done", "all done", "a not-yet-due routine open", "a
group lesson to review", "editing an exercise's settings", "loading", "first
run". Settled round 4 (Option A).

- **The list on the left, 400 px:** Start session, Due, Done today, then Not
  yet due and Inactive. Rows are the phone's, **without their +**: clicking a
  row opens it. The open row is marked.
- **The open exercise on the right** is the exercise page and the log popup
  in one pane. Its header: the exercise's name, its meta, the pencil (edit
  settings). Its body is two columns: **left the log form** (the type's own
  form from `logFor`, as in the log popup) with its reference (a drill's
  links and sections, a routine's Practise in player), **Log set pinned under
  the form**; **right the reference**: the figure or routine or lesson it
  practises (`contentFor`), the history (sets by day) and the settings (How
  often, Active, notes, Archive).
- **One is always open.** Arriving at Today opens the first due exercise in
  the pane (the first of Not yet due when nothing is due) without changing
  the URL. Clicking a row navigates to that exercise's URL
  (`/[dance]/exercises/[id]`), which on desktop is Today with that one open
  (Today lit in the side). An exercise opened from elsewhere (a figure, a
  lesson) lands the same way, with ‹ in the pane back to where it came from.
- **Any row opens,** due or not: logging early is fine.
- **After Log set:** the pane says Logged, the set shows under History ·
  Today, and the row moves to Done today and **stays open**; the main button
  becomes **Next: <the next due one>**.
- **A session** (Start session) opens the first due one; the pane's header
  says "Session · 2 of 5", Skip and Log set are pinned under the form, the Up
  next row is the open one. The last one logged shows the Session done card
  at the top of the form, Finish pinned. The session is the phone's
  (`src/lib/exercises/` session); only where it draws changes.
- **All done** (nothing due, nothing open by a click): the pane shows the day
  so far, every set logged today, laid out like a past day. *My call.*
- **Editing settings:** the pencil turns into ×; the settings become the form
  in place in the right column with Save and Cancel. The log form stays
  usable.
- **First run** (no exercises): the empty state across the sheet, no list
  column. + on the band does the same as Custom exercise.
- **Custom exercise** is the band's + (settled round 3); New exercise and its
  How often level are dialogs.
- **A past day** is not a list and pane: one column (720) of the sets that
  day, Back to today in the middle of the band, ‹ › on the right, and the
  "Forgot to log something" field opening the shared picker as a dialog.
- On the phone nothing changes: the list with its +, the log sheet, the
  exercise page as its own page.

## Two columns: about on the left, videos on the right (3A)

Boards: "A figure open beside the list", "A position open", "A lesson open
beside the list", "A group · as its owner".

- **A figure** in its pane: the left column (5 parts) holds what it is and how
  it is practised: the facts card (badges, the timing, **Starts in / Ends in**,
  notes), Practice, In routines, Follows from / Leads to, Taught in, Move to…,
  Archive. The right column (7 parts) holds what is watched: Recordings with
  their sections, Linked sections, Links. 32 px between the columns, aligned
  at the top, each in the phone's order. Starts in and Ends in list the
  positions as links to their pages (board "A figure: its positions are
  links"); empty reads "No position · fits anywhere".
- **The pane header of a figure:** the label ("Enchufla · Doble") with
  "Figure · starts on 1 · 16 counts" under it; then **the move's figures as
  tabs**: one pill per figure (selected solid accent, the others the neutral
  chip), a dashed "+ Figure" pill (New figure in this move, starting as a copy
  of the open one), and "Open Enchufla ›" to the move's page. They wrap onto a
  second line when there are many and hide while editing. The phone keeps its
  switcher at the bottom; there is no pinned switcher on desktop.
- **A move's page** opens in the pane (its heading lit in the list): its
  figures, New figure, where they are used; Rename is the pencil in the
  header.
- **A position** in its pane: left the picture (a still from a linked point),
  the hold, notes, figures from here and into here (+ New figure from it);
  right the linked video sections and points, lessons, routines through it.
- **A lesson** follows the same split: left the notes, the review exercise,
  Figures, Routines, Positions, Exercises; right Videos (with their sections,
  uploads and YouTube saves in progress) and Links. Copy to…, Move to… and
  Same as… sit under the title in the pane header.
- **A group** (owner or editor): left its lessons (drafts first, then
  published newest first, Add / Added on each); right the group's space and
  Class songs. People, the code and Recently deleted stay in ⋯.
- **Clones and twins** in a pane (boards "Your copy: a tab per source",
  "Twins", the same for positions, lessons and songs): the source tabs
  (Yours | Salsa Tuesdays) under the title in the pane header, then the
  banner and the row of actions as on the phone.
- **When the pane is narrow,** all of them fall back to one column in the
  phone's order. Two columns from a pane 780 px wide (*my call*: a 1366 px
  window gets two columns, 1280 gets one).
- **Inline videos** take their column's width and are at most 70 % of the
  window's height tall (*my call*); the picture letterboxes in the dark frame.
- **One column in a pane** (centred at 720): a routine, Coverage, a group's
  People, storage, History and Recently deleted. A song at 640.

## Positions on desktop

Boards: the Positions section (24 desktop boards). The phone's positions are
as built by the [positions spec](2026-11-04-positions-design.md); the
desktop lays them out:

- **The list and the map:** the Positions segment's list on the left; with
  nothing open the pane is **the map** (the Web layout, as built in
  `src/lib/positions/map.ts`), with its tray under it (islands, unused
  positions, No position).
- **Picking on the map:** a click picks a position (its figures in and out lit
  in its type's colour, the rest faded); a second click on a lit position
  opens it; click again or Esc clears. The position's page has a map button
  that opens the map with it picked.
- **No position** is the list's first row and opens in the pane: the figures
  with none, then those with only a start or only an end, each with +
  Positions.
- **Gaps** (the chip) lists the dead ends and orphans; a dead end's page says
  so, with New figure from it.
- **Editing a position** is in place in the pane; New position, Start from a
  template, How positions work, the link pickers (a section or point, a
  lesson) are dialogs. The position picker on a figure is the shared picker
  as a dialog.
- **Group mode** shows only the group's positions, History and Edit in the
  pane header.
- The phone boards in the section (Phone · …) were the brief for the slot that
  built positions; the desktop build does not change the phone's positions.

## Popups are dialogs (4B)

Boards: every "· a dialog" board; "New exercise · How often (stacked level)",
"The Link popup · a stacked level".

- **Every bottom sheet is a centred dialog on desktop:** the create sheets,
  How often, Song details, the routine picker, the shared picker, the song
  popup, the Link popup, the rename, remove, move, copy, compare, send, drop,
  detach, same as, leave, Add, Make it mine, clash sheets, the group menu and
  the code. (The log popup is not one: on Today it is the pane.)
- **The dialog:** 560 px wide (480 for a menu and a small form such as the
  group menu and a rename; the Link popup's levels are 560 wide and drawn
  480 tall, so a stacked level covers the one below), in the sheet colour
  (`sheet_bg`), radius 28 on all corners, a large soft shadow (0 24 70 at
  32 % black). As tall as its content, at most 780 px and never closer than
  32 px to the window's top and bottom; past that its body scrolls. No
  grabber.
- **Its parts are the bottom sheet's:** the header (title in `headline` 22/800,
  the subtitle under it, header actions, ×), the body, the pinned footer with
  its main button. Padding 28 px at the sides.
- **The scrim covers the whole window,** band and side included.
- **Stacked levels** (the Link popup's levels, How often from New exercise,
  Leave's choose, Send's pick, Copy's which): the new level opens in the same
  place and size on top of the one below, with Back on its left and no ×; one
  scrim, not two.
- **Closing** is the phone's: ×, Back (one history entry per open dialog, as
  `src/lib/sheets/stack.ts` does for sheets), Esc and a click on the scrim.
  All of them go through the unsaved-changes question when a form in it has
  unsaved input.
- **The picker and the song popup are dialogs too.** Their search is focused
  when they open on desktop (*my call*: no on-screen keyboard to pop up).
- The kit's small question dialogs (archive, delete, Unsaved changes) are
  already centred dialogs and do not change.
- **Inside the full-screen player** (its desktop layout), its sheets become
  dialogs too, in the player's media palette.

## Page by page

The boards are the target; the notes here are what a board cannot say.

- **Today:** above.
- **Moves → Figures:** the list and the figure, a move, Coverage (its tile
  lit; Select in the pane), a group's figure (read-only; Edit and Practise
  pinned at the pane's bottom), your copy and its source tabs.
- **Moves → Routines:** the list and the routine: one column (720) in the
  pane: Practise, starts and ends, the slot cards with their seams, More. Edit
  and ⋯ (Select slots) in the pane header. A group's routine has no drag and
  no pencil; Edit (makes it yours) and Practise pinned.
- **Moves → Positions:** above.
- **Lessons:** the list and the lesson; editing is one column (640) in the
  pane. A group's lesson opened from the group page (not yet added) has ‹ to
  the group, nothing lit, and the phone's "Not in your lessons yet · Add"
  strip as a soft bar under the pane header. A lesson whose group is being
  deleted shows the phone's warning banner at the top of the pane.
- **Groups:** the list and the group (two columns, above); People, a person's
  actions, storage, History and Recently deleted in the pane with ‹ back to
  the group, the group still lit. The group code dialog says **Copy link** on
  desktop where the phone shares. In group mode the Groups tab still lists
  every group, the one worked in marked "Working in"; opening one does not
  switch.
- **Music:** the list and the song (one column, 640). A class song is
  read-only (the teacher's count; the pencil is Edit song, offering Make it
  mine). In group mode, a draft song is a full song page with Share with the
  class pinned at the pane's foot.
- **Practice:** no side. The band row: ‹, "Practice" with the routine or song
  as subtitle, Count only | A song in the middle. **Setup:** one column, 640,
  Play pinned at the bottom of the sheet. **Running:** the stage on the band
  to the left (the count in cream, up to 240 px, the 1 as a cream disc, the
  eight dots, the called figure, the elapsed time) and the sheet as a 520 px
  column on the right (seek bar, **the whole routine with danced slots
  muted**, the Voice card), Stop and Pause pinned at its bottom; paused dims
  the count and reads "Paused · 1:42". Save this run is a dialog. This
  replaces the main spec's "a desktop keeps the 560 px column".
- **The full-screen video player:** unchanged; it covers the whole window,
  frame included, in its existing desktop layout.
- **Settings:** the side with Settings lit, no ‹ (Settings is a destination
  in the side). One column, 720, the phone's grouped rows. **What uses
  space** and **My count** (its count pattern in the middle of the band, the
  recording's count and bar larger on desktop) the same way, each with ‹ to
  Settings. **The admin page** is two columns (*my call*): requests for more
  and Invite on the left, Groups and People on the right.
- **Share** ("Add to a lesson"): no side; one column, 560.
- **Loading:** the skeleton draws the frame (band row, side) and skeleton rows
  shaped like the desktop page: both panes where there are two.
- **The kit gallery** (`/dev/kit`, dev only): not designed; it may show the
  phone column.

## Keyboard and focus

- The DOM order stays the phone's: the band row, the page content, then the
  side (the tab bar's place). Landmarks (`header`, `main`, `nav "Main"`) let a
  screen reader jump. *My call:* no skip link, as the phone has none.
- In a list and pane, the list comes before the item in the DOM and in tab
  order. After opening a row, focus stays on the row (the pane updates beside
  it), so tabbing through the list keeps its place.
- Esc closes the top dialog (native `<dialog>` already does; the unsaved
  question still applies), then clears a picked position on the map. Focus
  returns to what opened it.
- The video player's keys and its "?" list are unchanged. No other shortcuts.

## Building it

- **One set of components.** The desktop is a width condition (1024 px) in
  the existing components and a few new structural ones: the band row on
  `Screen`, the side (`BottomNav`'s desktop form or a sibling), the sheet's
  scroll container, the list column and the pane, and `Sheet` styled as a
  centred dialog. The 560 px caps in `+layout.svelte`, `BottomNav.svelte`,
  `Screen.svelte`'s slim band and `PageSkeleton.svelte` apply below 1024 only.
- **The list column lives in a layout,** shared by the list route and the item
  routes, so the list is rendered once and not rebuilt when an item opens.
  The URLs do not change (route groups may hold Figures, moves and Coverage
  together; Positions with its `[id]`, `none` and `map`). On the phone the
  item routes do not show the list, and the phone's list page looks and
  behaves as now. A list is never rendered twice on one page.
- **The list's data** loads in that layout, so an item page also loads its
  list. Accepted on the phone too: the lists are single SQLite queries.
- **Today's pane** reuses the log popup's parts (`logFor`, `log-view.ts`) and
  the exercise page's (`exercise-page.ts`); which exercise is open when none
  is in the URL is a pure function beside `today.ts`.
- **Pure parts stay pure and tested:** which pages show the side, which tab or
  Settings is lit, which list a route belongs to and which row is open
  (including a figure opened from a routine), whether a pane gets a back, and
  which exercise Today opens. They belong in `src/lib/nav/` (and
  `src/lib/exercises/` for Today) with specs.
- **Verifying:** screenshots of every page at 1440×900, 1280×800 and
  1024×768 (light and dark, salsa and bachata) against the boards, and the
  phone at 390 wide compared before and after, which must not change. The
  existing specs and `npm run check` pass.
- Existing rules hold: `use:guarded` forms, `refreshWhenSettled()`, colours
  from the builders, `GROUP`/`CLIP` for clipping cards, focus after a removal,
  PAGE_EPOCH only if a form or API changes shape (none should).

## Left to the builder

- Component names and file layout; how the width condition is written (a
  Tailwind custom variant is the obvious one).
- Exact hover colours within the rule above, and transition timings (short,
  respecting `prefers-reduced-motion`).
- How each pane's scroll container hooks into the trail's kept scroll.
- Whether the list column on a phone item route is not rendered or rendered
  hidden, as long as the phone looks and behaves as now and nothing is
  focusable or read out twice.

## Settled in review (2026-11-03/04)

What the user settled on the boards, newest last:

- **Frame:** from 1024 px; one short band row (title left, toggles in the
  middle, actions right) and a band-coloured side.
- **Side:** the five tabs at the top, Settings at the bottom; navy in group
  mode with Mine for Today. Buttons 144 px wide, centred in the 188 px side
  (round 3).
- **Lists:** a list and the opened item side by side (2A).
- **Pages:** figure and lesson pages in two columns (3A).
- **Sheets:** every bottom sheet becomes a centred dialog (4B).
- **Today:** Custom exercise is a + on the band (round 3); the list and the
  open exercise, one always open, rows without +, all done shows the day so
  far (round 4, Option A).
- **Moves:** a figure opened from a routine keeps Routines and the routines
  list (round 4); Figures | Routines | Positions (round 4); Coverage the only
  tile.
- **Positions** (rounds 4–9; built in their own branch, see the positions
  spec): owned like figures, optional, templates, one type, any number of
  starts and ends, the shared picker, the Web map, twins as one.
- **Types:** Timba joins salsa's types (round 6, built with positions).
- **Band pattern:** open; the band ships plain.

## Calls made while writing this (check these)

- **1024 px** is where the desktop starts.
- **The list column is 360 px** (Today's 400); the pane uses two columns from
  780 px (a 1366 px window and wider), one below.
- **Content max widths** 1140 (two columns), 720 (one column), 640 (a song, a
  lesson's edit, Practice's setup), 560 (errors, share); dialogs 560, small
  ones 480.
- **The list's filter** is kept by the trail, not in the item's URL, and
  filtered on the client on desktop.
- **A figure opened from a routine** knows it by the trail's opener, so a
  reload shows the Figures list.
- **Today's first open exercise** is shown without changing the URL; a click
  goes to the exercise's URL.
- **Today all done** shows the day so far.
- **Sign in, Join, Welcome, Get the app, Pair and `/g/<code>`** sit in a
  centred 480 px card on the band colour; an old group code shows in the card.
- **Settings, What uses space, My count and the admin page** show the side
  with Settings lit; the admin page is two columns.
- **Practice running** lists the whole routine, danced slots muted.
- **Hover overlays** where the device can hover; a **trash button on a slot
  card** stands in for swipe-to-delete.
- **Inline videos** at most 70 % of the window's height.
- **Pickers and the song popup** focus their search on open.
- **DOM order** stays the phone's (side last); no skip link.

## Changes to other specs

- [Redesign](2026-10-31-redesign-design.md): "Tablet/desktop width" under
  "Left to the builder", the picker's "stays a bottom sheet … on desktop"
  call, and "Desktop layouts … restyled, layout unchanged" now point here
  (the player's own desktop layout is still unchanged).
- [Main spec](2026-09-22-salsa-app-design.md): Practice's "a desktop keeps the
  560 px column" now points here.
- `CLAUDE.md` lists this spec with the others.

## Decided while building

### Plan 5 — Practice, Settings and the rest

- Running keeps the title the app already built (the figure or routine the run
  is of), not the board's.
- The running sheet's heading reads "Routine · slot N of M".
- Settings' back chevron is hidden on the desktop: `BandHeader` hides a header
  holding a `data-desk-hidden` marker, and Settings sets it.
- `PAGE_WIDTH` (`src/lib/nav/frame.ts`) is the one table of page column widths:
  one 720, two 1140, song 640, narrow 560.
- The ReloadBar sits above a run on the desktop (z 32, over the run column's
  31), so "This page is out of date" still shows during a run.
- In a short window the stage is held under the band row, never drawn into it.
- The Link popup's levels are all 480 tall on the desktop, its picker included:
  `Sheet`, `PlayerLayer` and `Picker` take a `level` prop, set only by the Link
  popup.
- `PlayerLayer` takes `size="small"` for the player's own dialogs.
- Inline videos (recording, lesson video, YouTube card) are capped at 70 % of
  the window's height on the desktop.
