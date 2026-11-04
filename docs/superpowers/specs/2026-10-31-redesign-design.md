# Redesign: new icons and one look for the whole app

Status: built on branch `app-icons`, 2026-10-31 (plans 1-13 in
`docs/superpowers/plans/2026-10-31-redesign-*.md`).

Agreed 2026-10-31. Mockups, design system and every screen (light and dark):
https://claude.ai/artifact/9f1bRKTJ9ST8Vxg17YC9XJ — the agreed icon is
"5 · Flame & heart, round 3 → v4"; the agreed look is "C4 · Final picks";
everything under "The full design — system and every screen" is the target.
The design kit that drew those boards is the source of every number below; a
copy sits in [`docs/superpowers/design-kit/`](../design-kit/) (`kit.py`: the
four themes, the type scale, the icon paths and every component's markup and
states; `icons/`: the two app icon SVGs). It is a reference for building, not
code the app runs.

## Why

In the user's words, the app "doesn't have a unified design identity. Parts are
different and look different. It doesn't feel like a modern app. Feels a bit
more pasted together. The bottom has too many tabs. Missing some icons." They
also wanted a nicer dark theme and a better font. And the home-screen icons —
two clave sticks, recoloured per dance — "don't remind me of clave sticks, but
more importantly even if they did, that doesn't remind me of salsa and
bachata."

Success: the two apps have icons that say salsa and bachata at a glance; every
screen in both apps reads as the same, modern app, in light and dark; the
bottom bar has five tabs with icons (four until groups); nothing the app does today is lost.

## Goals, non-goals, anti-goals

- **Goals:** new icons; one visual system (colour, type, spacing, icons,
  components with every state) applied to every screen and popup; a designed
  dark theme; five tabs (four until groups); no dance switch.
- **Non-goals:** no new features beyond the few the user chose (see
  "Additions"), no data-model change, no change to what a screen can do. Routes may move (see "Navigation"), behaviour does not. The
  split of the web app into one site per dance is planned but is a separate
  piece of work (see "One app per dance").
- **Anti-goals:** a redesign that drops or hides a feature; a look applied
  half-way (some screens new, some old) and left there; colour that fails
  contrast; a "light" theme recoloured into dark rather than designed.

## The icons

- **Salsa:** a flame that is also a dancer (raised arm = the tallest tongue,
  the skirt flaring into side tongues), cream on chili red `#D2401E`, peach
  core `#FFC9A8`.
- **Bachata:** a heart split in two by a curved gap — two bodies pressed
  together — with two heads leaning in cheek to cheek, cream and pink
  (`#F2B8D0`) on wine `#6B1D4F`.
- Source SVGs: `docs/superpowers/design-kit/icons/salsa.svg` and
  `bachata.svg` (v4 on the round-3 board). They move to `static/` and replace
  `static/icon.svg`. They are two different drawings, so
  `scripts/make-icons.sh` stops tinting one SVG with the registry accent and
  instead rasterises each dance's own SVG (192 and 512 into `static/icons/`,
  and the Android launcher PNGs `android/app/src/main/res/mipmap-*/ic_<dance>.png`).
  The artwork stays inside the central ~340 px circle of 512, so Android's
  launcher mask does not cut it.
- The icon colours are the **band** colours below, not the accents.

## The look ("C4 · Final picks")

- **Band:** the top of every main and pushed screen is a solid band in the
  dance colour. The large page title is the first thing on it, top-left, in
  Bricolage Grotesque 800 at 46 px (30 px compact variant for long names: a
  figure, a lesson). A subtitle (Today's date, "Count only") sits under it.
  The band's controls are bare cream icons in 44 px hit areas on the right of
  the title row (Settings, New) or a back chevron at its left.
- **Sheet:** the content sits on a sheet that overlaps the band with 28 px
  rounded top corners.
- **Hero card (Today only):** "Start session" with "3 due" and a solid accent
  round play button (no time estimate — the app does not compute one, and a
  guessed number on the most-seen card is worse than none), a white (dark: surface) card straddling the
  sheet's top edge, half on the band.
- **Lists:** grouped cards (16 px radius) with full-width hairline separators
  between rows. Row title Manrope 16/700, meta line 13/400. Quick log is a bare
  accent "+" (44 px hit area); navigation rows end in a chevron. A row is
  either a link or holds one button, never both.
- **Status words** ("new", "4 days overdue", "not in a routine") are coloured
  text (`status`) or a small badge — never link-looking text.
- **Chips:** solid pills; selected = solid accent.
- **Segmented control:** a cream pill switch on the band (track cream at 16 %,
  selected segment solid cream with band-coloured text); on a sheet it uses
  the neutral form from the design system.
- **Tab bar:** five tabs (Groups added by [groups](2026-11-02-groups-design.md)); inactive tabs are 28 px outline icons only; the
  current tab is a tinted pill (accent at 12 %) with its filled icon and its
  label beside it, and takes a wider column (active 2fr, the others 1fr). No bar on the top edge.
- **Icons:** one family on a 24 px grid, 2 px rounded strokes; filled variants
  for the current tab and a few states (play, pause, star…). The set is on the
  design system board (section 04).
- **Fonts:** Bricolage Grotesque (titles, hero, big numbers) and Manrope
  (everything else). Self-hosted, bundled from the `@fontsource-variable/*` packages
  (Bricolage with its optical-size axis, `opsz.css`) and imported in `layout.css` (my call: the app runs
  in a WebView behind auth and offline-ish conditions; no Google Fonts
  request).

## Design tokens

The design system board (sections 02–03) is the reference; these are its
values. `src/routes/layout.css` gets them as CSS custom properties, set per
dance and per scheme by `[data-dance]` and `<html data-theme>`. Since 2026-11-01 the
scheme is a Settings choice (System, Light, Dark; a cookie per browser,
`$lib/theme/scheme.ts`): the hook writes it into `<html data-theme-choice>` and
the script in `src/app.html` resolves it to `data-theme` before the first paint,
asking `prefers-color-scheme` for System. An attribute rather than the media
query, so one copy of the dark colours serves both System and Dark.

| role | salsa light | salsa dark | bachata light | bachata dark |
|---|---|---|---|---|
| band (same in dark since 2026-11-01) | `#D2401E` | `#D2401E` | `#6B1D4F` | `#6B1D4F` |
| small text on band | `#ffffff` | `#ffffff` | cream `#FFF3E4` | cream `#FFF3E4` |
| accent | `#d2401e` | `#ff6b47` | `#8e2a66` | `#f07aae` |
| accent_text (small accent text) | `#b3340f` | `#ff7a59` | `#8e2a66` | `#f07aae` |
| on_accent | `#ffffff` | `#0b0b0d` | `#ffffff` | `#2a0716` |
| status | `#b8330f` | `#ff8a6b` | `#8e2a66` | `#f07aae` |

Shared neutrals, light / dark: ground `#f2f2f5` / `#0b0b0d`; surface `#ffffff`
/ `#1c1c1f`; raised (dialogs) `#ffffff` / `#242428`; bottom sheet `#f2f2f5` /
`#141416`; hairline `#e3e3e8` / `#2c2c31`; ink `#111114` / `#f4f4f6`; ink2
`#3d3d44` / `#c8c8ce`; muted `#6e6e76` / `#98989f`; done `#1e7a4f` /
`#5cc98f`; **danger `#c4183c` / `#ff5c7a`** (crimson, new — the old `#c62828`
read as the salsa accent); warn `#a34a06` / `#f0a04b`. Derived: accent_soft =
accent mixed 12 % (light) / 18 % (dark) into surface; tab tint = accent at 12 %.
Band title and icons are cream `#FFF3E4`.

The segmented switch on the band has a black 15 % track (`BAND_TRACK` in `tokens.ts`) and `band-small` labels, so unselected labels keep 4.5:1 in every theme; the selected pill is cream with `on-cream` text.

- **Type scale:** display 46/800 Bricolage; display_s 30/800; hero 25/800;
  headline 22/800 (sheet and dialog titles); number_l 40/800; title 16/700
  Manrope; body 16/500; subtitle 15/600; button 16/800; number 18/800 tabular;
  meta 13/400; label 13/700; chip 14/600 (800 selected); caption 12/700.
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 48. Screen side margin 16 (sheet) /
  20 (band).
- **Radii:** 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill.
- **Contrast:** every small text pair ≥ 4.5:1, large ≥ 3:1, checked for all
  four themes. Cream on the light salsa band is 4.3:1, so small text there is
  white; the band colour itself does not change.

## Components and states

Every component exists in the states on the design system board (sections
05–14). The rules that matter for building:

- **Focus:** a 2 px accent ring plus a 4 px halo (accent at 20 %); around a
  filled control the ring sits after a 2 px gap. Visible on keyboard focus and
  on a focused text field.
  Inside a card that clips (a group of rows), the ring and halo draw inside the
  control; a filled control there keeps the outside ring, and the swipe-to-delete
  button (on red) draws its ring in `on-danger`.
- **After a removal:** focus goes to the next row, else the previous, else the
  list's add control or heading; a dismissed banner hands focus to what follows it.
- **Pressed:** a pressed overlay (ink at 6 % light / white at 7 % dark), or the
  `accent_pressed` fill on filled buttons.
- **Disabled:** `disabled_bg` / `disabled_ink`, and the control says why when it
  is not obvious (helper text), never colour alone.
- **Loading:** buttons keep their width and show a spinner; lists show
  skeleton rows; navigation shows the top progress bar.
- **Errors:** a field in error gets a danger outline and its message under it
  with a warning icon; page-level errors use the error banner.
- **Buttons:** primary (filled accent pill), secondary (tonal), tertiary
  (text), danger, danger_text; icon buttons bare / tonal / filled / step /
  band.
- **Fields:** label above, 52 px, radius 14, helper or error under. Text,
  textarea, select (opens the picker), search (pill).
- **Values:** stepper (−/value/+), slider, number field, progress, spinner.
- **Selection:** chip, segmented, switch, checkbox, radio.
- **Overlays:** bottom sheet (grabber, title, close/back, footer actions) over
  a scrim; dialog (raised, icon, title, body, actions); toast (inverse colours,
  one action, e.g. Undo). A sheet's title stops at two lines with an ellipsis
  (a long exercise name beside Skip and Details ran to four); the full name
  stays in its `title` and the dialog's label.
- **Feedback:** banner (info/warning/error/success; info uses accent_soft —
  there is no blue), empty state (icon, title, line, action), badge.
- **Media:** video card (row and tile), YouTube card (link / saving / saved /
  failed), thumbnails as dance-colour fields with a play disc.

## Navigation

- **Five tabs: Today · Moves · Lessons · Groups · Music.** The tab bar shows on every
  screen of a dance except Practice and share; a pushed screen has a back
  chevron on the band and the bar too (an edit's Save bar or a selection bar
  takes the bottom and the tab bar steps aside). See
  [pages keep their place](2026-11-01-pages-keep-state-design.md).
- **Moves** = Figures | Routines | Positions, switched by the segmented
  control on the band (Positions since 2026-11-04, see the
  [positions spec](2026-11-04-positions-design.md)). Coverage is a tile at the
  top of the Figures list ("7 in no routine"); it opens a pushed screen that
  goes back to Moves.
- **Music** = the song library (today's Songs).
- **Practice** (today's Player) is a pushed screen, reached from Music, a song,
  a routine, an exercise.
- **Settings** is the sliders icon on Today's band; there is no Settings tab.
  "My count" (voice recording) is reached from Settings.
- **No dance switch anywhere.** The Salsa/Bachata pill at the top of every page
  goes. Each Android app is one dance already; on the web the dance is the URL
  (`/salsa/…`, `/bachata/…`) and nothing on screen offers the other one.

## One app per dance

The user plans to split the web app into a salsa site and a bachata site. That
is out of scope here; this design only has to not stand in its way, and it
does not: no screen shows or switches the other dance. Settings that today
cover both dances ("New figures: Salsa style / Bachata style") show only the
current dance's row.

## Screens

Each area has its board (light and dark side by side, salsa mostly, bachata
for some); the board is the target. Below: where old features landed and the
rules the boards follow that are not obvious from looking at them.

### Patterns used across screens

- **Pushed screens** use the compact band (30 px title) for long names and
  shrink to a slim band (≈64 px: back, name, actions) once scrolled. Main
  screens shrink the same way on scroll.
- **Edit** is a pencil on the band. Editing shows × ("Stop editing", asks if
  unsaved) and the form's Save pinned at the bottom — one Save, not a header
  Done plus a form Save.
- **Every browser `confirm()` becomes a kit dialog** (archive, delete video,
  delete recording, archive song…), with one line saying what is kept or lost.
- **Split row:** where a row both opens something and has a quick action (a
  Today exercise: open it, or "+" to log; a song: open/pick it, or ▶ sample; a
  linked item: open it, or unlink), the text part is the link and the buttons
  are siblings beside it, never nested. This is the one exception to "a row is
  a link or holds one button".
- **Creating things** (new figure, routine, position, lesson, exercise, song)
  happens in a bottom sheet opened from the band's "+". Errors show under the
  field they are about; server refusals that are not about one field are an
  error banner at the top of the sheet.
- **Status colours:** overdue / "not in a routine" / "no section" in `status`;
  routine breaks and position dead ends in `danger`; "does not loop" and
  seams in `warn` (amber — red now means destroy); done and "loops" in `done`.
- **Errors that stop a page** use the error banner; loading uses skeletons
  shaped like the page; navigation shows a cream progress bar on the band
  (the salsa accent is the band colour, so an accent bar would vanish).
- **New:** a `+error.svelte` with designed 404, offline and server-error pages.

### Today

- Order: Due → Not yet due → Done today → Inactive (agreed; the old page put
  Done today first). What the session walks comes first.
- Rows: a 40 px type tile (figure, routine, drill, lesson — with an accessible
  name) replaces the "Figure · partner" text badge; name; meta line ("Never
  done", "4 days ago" in `status` while due; a lesson's class day "Wed 28 Oct
  class"); the last rating as five dots. Tapping the row opens the exercise;
  "+" opens its log popup.
- The hero card is always first on the sheet. While a session runs it reads
  "Resume session · Next: Enchufla · Doble · 2 logged", and the next row is
  tinted with an "Up next" badge. When nothing is due it becomes a plain "All
  done for today · 5 exercises · 7 sets" card.
- Not-yet-due rows get grey tiles instead of reduced opacity (contrast).
  Inactive is a fold header with a chevron. "+ Custom exercise" is a full-width
  secondary button at the end.
- Previous day ‹ is an icon on the band beside Settings. A past day has the
  compact title ("Thu 29 Oct", "2 days ago"), ‹ › on the band and a cream
  "Back to today" pill; sets grouped per exercise, "+" adds a set to that day;
  the "Forgot to log something that day?" field opens the shared picker.
- Session popup footer: Skip beside Log set → after logging, "Logged" (done
  colours) and "Next: … ›" as the main button → a "Session done" card and
  Finish.
- First run: "Nothing to practise yet" with Build a routine / Custom exercise.
- New exercise sheet: Name, How often (a second sheet with Back and a check),
  Notes; the server's message under Name.

### Logging a set and the exercise page

- The log popup is a tall bottom sheet (Today's title stays visible) with a
  pinned footer holding Log set (and Next / Finish in a session). "Details ›"
  and, in a session, Skip sit in the sheet header. Last time is the subtitle
  under the name, with stars ("First time." otherwise). The Reference toggle is
  the trailing control of the "Reference" label.
- Rating: five star buttons, filled up to the pick, "4 of 5 · tap it again to
  clear".
- Practice panel: folded to one line plus Play; open: Count only | A song,
  tempo stepper, voice count, clave, call on cue; running: a big count (the 1
  in the accent), elapsed, Pause/Stop, volume; Log set is disabled with "Stop
  the count to log it." Time practised shows as a green strip, and Minutes
  filled from it says "From the practice: 6:12".
- Lesson review popup puts the figure chips before the link and the video.
- After logging: a "Logged" button, the form clears, the set appears under
  "Sets today" with a trash button. A past day shows "Adding to Wednesday, 28
  October" and "Add set to this day".
- Exercise page: the type is the band subtitle; the owner is a row ("Figure ·
  Enchufla"); the history summary is three stat tiles (sets, practised,
  recent rating); sets grouped by day; settings (How often, Active, notes);
  a drill's links and sections; Log a set pinned at the bottom; "Archive
  exercise" as danger text.
- Settings are read on the page and edited behind the band's pencil (× Stop
  editing, Save pinned), as every other edit screen.
- Video under a log or a lesson: Mirror, a 4-way speed switch and Full screen
  in a control row beneath it. The picture carries our own controls, not the
  browser's (since 2026-11-01): a play disc, then the time and a seek bar with
  the sections as bands; a tap plays it in place.

### Moves

- Figures | Routines on the band; the band "+" is New figure or New routine
  for the tab shown.
- Filters are one scrolling chip row: All · Not linked (with its count — the
  old "n not linked →" link) · the dance's styles · With partner · Solo.
- Figures are listed under their move's heading; rows keep today's second line (recordings · No section /
  No lesson).
- Routines rows: "n slots" with a danger "2 breaks" badge and a warn "does not
  loop" badge.
- Positions (the gap report): a warning banner for gaps; dead end and orphan in
  danger in the row's second line; tap a row for a rename/remove sheet (never
  remove on the neutral position); the band "+" adds a position. Names are unique per dance among live positions, compared ignoring accents and case; Remove toasts "{name} removed" with Undo, which refuses if the name was taken meanwhile.
- Coverage (renamed from "Routine coverage", subtitle "Versions by how many
  routines use them"): Select is a text button on the band; selection shows the
  tap order in numbered discs; a pinned bar "3 selected · Cancel · Create
  routine"; a sheet names the new routine.

### A figure

- Compact band: the label ("Enchufla · Doble") with "Figure · starts on 1 · 16 counts" under it.
- A facts card: style and partner badges, the timing as eight counts with the
  start count filled ("Starts on 1 · 16 counts · 2 eights"), handholds, notes.
  Then Practice (frequency with "+", a row to the exercise), Follows from /
  Leads to as two lists, recordings (16:9 player, date · size, mirror, speed,
  full screen) each with its sections, linked sections, links, Taught in,
  "Move Doble to…", "Archive Doble".
- The figure switcher is pinned directly above the tab bar, on the tab-bar
  surface, and hidden while editing. Its sheet lists
  the move's figures with New figure in the footer, and links to the move's page.
- Edit: start positions as removable chips, Ends at, a 1–8 "Starts on" grid,
  Counts with 4/8/16 shortcuts; a "Not saved" banner carries the server's
  message.
- Upload in progress is a card ("Uploading… 42%"). In the app, Add video
  (compressed in the background) and Add audio are separate buttons.
- Move to… and archiving the last figure warn in danger ("Move and remove
  move", "Archive and remove move").

### A routine

- Band: back, title, pencil. Practise is the hero card, shown only when the
  routine can be danced. "Starts from Open · ends at Closed" plus badges
  (Doesn't loop / 1 break / 1 timing break in warn; Loops in done).
- Slot cards: drag handle, number in a tinted circle, title, timing and hands;
  closed cards show the note in italics and "or Doble, Complicada"; an open
  card has an accent ring, "Open ›", the note field and the alternatives rail
  (tinted tiles with open and remove squares, dashed "+ Alternative").
- The band is 46 px for short names and 30 px past 18 characters or a word over 10; ⋯ opens a sheet with Select slots; edit has × and one pinned Save (no ✓).
- Seams are warn-tinted boxes with a warning icon, the missing piece, and
  worded buttons "↓ After 3", "↑ Before 4", "+ Bridge".
- The picker states what fits ("Add after slot 3 · starts on 1 from
  Hammerlock"), with Count and Hold chips; Bridge and Alternative contexts as
  today; "Nothing you know starts on 5 from Shadow. Turn off Hold to see the
  rest."
- Drag: the card lifts (raised colour in dark), a dashed gap shows where it
  lands, seams hide. Swipe left reveals Delete (danger) and an Undo toast
  follows. Selecting: the band reads "3 selected" with ×, a bottom toolbar of
  five actions, the reason a greyed action is greyed in a strip above it.
- Exercise and Taught in are rows under "More" at the bottom. Edit routine is
  the page's edit mode (× and one pinned Save) with Duplicate and Archive rows.

### Lessons

- The list is grouped by month; a row leads with a weekday/day tile, then "3
  videos · 1.2 GB" and the three counts (a zero is muted, not faded).
- New lesson: Title, day (today by default), notes, "Go over it again".
- Lesson page order: notes → the review exercise → Videos → Links → Figures →
  Routines → Exercises.
- Video card: inline video (our controls on the picture, a tap plays it in
  place — as under a log), Full screen, Mirror toggle, speed switch, size,
  delete; sections below with play, range, what each links to or a muted "not
  linked", and an accent link button.
- Uploads: a batch card ("Uploading 2 of 3… 46%"); failures and unplayable
  files as before; the skipped-files summary is an error banner.
- YouTube links: a compact row that plays the embed in place (Mirror, Open on
  YouTube); Save video shows a spinner ("saving at 480p on the home worker" —
  no percentage, the server has none); a saved video says "from YouTube ↗".
- Figures / Routines / Exercises: "New" on the section label, "Link a …" as
  the group's last row (opens the shared picker), "via section" badges, unlink
  icons. Deleting a linked video is refused in a banner on its card.
- The New figure sheet from a lesson has a "New move | New figure in a move"
  switch.

### Music

- Music: search, a "Count only" row first (opens Practice at 180 BPM), Recent
  then A–Z, each song with its sample button (a ring fills over the 15 s and
  the row reads "Sample from 1:07"). Songs being added sit in a "Being added"
  group at the top with badges ("Waiting to download", "Finding the beat"),
  failed songs with Retry, and a note that the work runs on the home worker.
- Add a song is one sheet from the band "+": YouTube link, Title, one set of
  Style chips, or Upload an audio file (up to 95 MB).
- A song: "Tap on the 1" is the primary button and "Practice with this song"
  secondary. The count and the transport share one card; the app's own
  timeline replaces the browser's audio controls and shows the user's 1s as
  ticks. Sample, count speed and "Your 1s" below. Song details is a sheet from
  the pencil; Archive asks in a dialog.
- A song being added shows three steps (Added, Download, Find the beat; an
  upload skips Download).
- Pick a song (from Practice): Recent then A–Z, the current pick tinted with a
  radio dot, samples playable; "No song matches …" with "Add it in Music".

### Practice

- Setup: Count only | A song on the band; tempo stepper; a Voice row (Built-in
  or Yours — derived, opens My count); count chips; clave chips (salsa only);
  volume; Play pinned at the bottom. A song adds its field (sample ▶, tap to
  pick) and speed chips; a routine shows its name in the subtitle and the
  Calls chips.
- Running: the band becomes the stage — the count in cream at 112–188 px, the
  1 flipped to a cream disc with the number in the band colour (accent on the
  band fails contrast), eight dots, the called figure in 32 px, the elapsed
  time. The sheet holds the app's own seek bar, the routine slots ("Now"
  badge), and a Voice card (pattern and volume, changeable mid-run). Stop
  (soft danger) and Pause (accent) are 64 px pills. Paused dims the count and
  shows "Paused · 1:42".
- States: starting, song failed (field in error, Play disabled), could not
  start (banner), bachata without clave.
- Save this run: summary line, the exercise (fixed or picked), the 1–5 rating,
  a note, Don't save / Save; a failed save keeps the input.

### The full-screen video player

- Always dark; the board shows each screen in the salsa and the bachata media
  palette (not light/dark). The dance accent marks Play, the open section, the
  selected edge and the loop.
- Every feature of the three player specs keeps its place; the change is the
  look: round transport with Play as an accent disc, Bricolage time readouts,
  speed as a pill opening a segmented popover, Mirror as an accent circle, the
  link entry as a link icon plus "Link".
- The "Section saved" toast carries two actions (Edit, Link). Deleting a
  linked section explains why in a warning banner and disables Delete.
- The All list's cards are the card plus an Edit pill (two sibling buttons).
- Landscape: controls float on scrims; the editor and the list open as a
  panel beside the video.
- Desktop layout and the "?" key list: restyled with the same tokens, layout
  unchanged (not drawn).

### The picker and the Link popup

- Openers are full-width tonal buttons with a search icon ("Link an existing
  figure…", "Link a section…", "Pick an exercise…"). Create buttons are tonal
  pills with "+" pinned under the list; "Done · 2 linked" is the primary pill.
- The Link popup's levels are stacked bottom sheets (were centred dialogs).
  A level stacked on another has Back on the left and no ×; one opened from the
  page has × only.
- In the player the same sheets use the media palette — one look, always dark
  there.
- Move headings are non-tappable lines inside the group card, figures
  indented under them. Archived links show a warn "Archived" badge.
- Only the list scrolls (with a fade); search, create and Done stay put.

### Settings, My count, sign-in and system

- Settings is pushed from Today. Grouped rows: Practice (My count, New figures
  start on — this dance's style only, picked in a sheet), Android app (daily
  reminder as a switch plus a time row disabled when off; compress videos),
  Paired phones, Account (email and Sign out).
- My count: the count pattern is the segmented control on the band; tempo rows
  say Recorded / Half recorded / Not recorded with Record or Redo; recorded
  takes below with a trash button. Recording shows "Bar 2 of 4", "Say 5 now",
  eight count dots (4 and 8 hollow — silent) and a four-part bar progress;
  picking the bars is Bar 1–4 radio chips per half with Listen.
- Sign in is titled "Sign in" (not the dance name). Pairing is the one-tap
  "Pair this phone". The share page is "Add to a lesson" (no dance name), with a
  spinner on the tapped row.
- Offline: a tap made while the phone reports no connection shows the Offline
  page over the current one, as a modal dialog in the top layer, so it also
  covers an open sheet; Back dismisses it. A server that is down while the
  phone is online still ends in the browser's own error page (SvelteKit
  reloads the page then).

## Building it

- Order (my call), all on one branch: tokens and fonts in `layout.css` → the icons and
  `make-icons.sh` → shared components (band header, sheet, tab bar, buttons,
  fields, sheets/dialogs/toasts) → screens area by area. Each step leaves the
  app working; no screen is left half old, half new at a merge.
- `dances.ts` keeps `accent` / `accentDark` in sync with `layout.css` (the spec
  test in `dances.spec.ts` still enforces it), and gains `band` / `bandDark`;
  the manifest `theme_color` becomes the band colour.
- The full-screen video player keeps its own always-dark palette (the
  `media` theme on the design system board), now drawn from the same tokens.
- Existing rules hold: `use:guarded` for forms someone fills in, the
  UnsavedDialog for unsaved work, dates built by hand in `format.ts`, nothing
  under `$lib/server` in components.

## Left to the builder

- Component names and file layout under `src/lib/components/`.
- Exact animation and transition timings (keep them short; respect
  `prefers-reduced-motion`).
- Tablet/desktop width: the phone layout centred with a max width, as today,
  unless a screen board says otherwise.

## Additions (agreed with the user)

Small things the app does not do today, chosen to be built with the redesign:

- **Undo instead of no way back.** Deleting a logged set, a position, a voice
  take, or a paired phone happens at once and shows "Deleted · Undo" for a few
  seconds (the routine editor's UndoToast pattern). Archiving keeps its new
  confirm dialog.
- **Music: search and Recent then A–Z,** the same as the song popup already
  has (`src/lib/songs/search.ts`).
- **A figure's page lists the routines that use it** ("In routines · N", each
  row opening the routine). The main spec had this as "not built"; coverage
  maths already knows which routines call each version.
- **Settings saves on change** with a "Saved" toast; no Save buttons. Nothing
  in Settings is typed, so dropping its `use:guarded` forms loses nothing.
- **The routine editor gets a visible way into selection mode** (a "Select"
  item in a ⋯ menu on the band), beside the long press.

Considered and left out: a session time estimate, a drawn positions graph, a
live microphone level meter, a separate "Downloading" song state, a near group
in the routine picker, search on Routines.

## Calls made while writing this (check these)

- **Release:** the redesign is built on one branch and deployed when it is
  complete, not area by area — the new tokens recolour every old screen the
  moment they land, and the four-tab bar needs Moves and Music to exist. No
  compatibility layer for old tokens or the old BottomNav.
- **Android system bars:** painted natively per flavor — the status bar in the
  dance's band colour (light and dark), the navigation bar follows the page (the tab bar's colour where
  the tab bar or a pinned bottom bar shows, the page colour elsewhere) — so the band runs to the top of the screen. The full-screen player
  keeps its own handling.
- **Fonts self-hosted** (bundled via `@fontsource-variable/*`, imported in `layout.css`), no Google Fonts request.
- **Lesson page order** is Videos before Links, and Figures before Exercises.
- **"Try again"** on page-level load errors reloads the data; it is new but
  cheap and only appears on failure.
- **Practice's Save this run** drops "0 figures called" when no routine ran.
- **My count's back control** returns to where it was opened from (Settings or
  Practice).
- **The picker** stays a bottom sheet in landscape and on desktop (centred
  with a max width there).
- **No on-screen hints** for the screen staying on or the iPhone silent switch
  (the silent switch stays in the player's Known gaps).
- **The routine's Exercise row** shows only what the page already has (no
  invented "done yesterday" line).
- **Desktop layouts** (the video player's desktop layout, its "?" key list)
  are restyled with the same tokens, their layout unchanged.
- **Cleanup, inset rings:** a clipping card draws the ring inside (`focus-inset`)
  instead of dropping `overflow-hidden`, which would need every row rounded.
- **Cleanup, focus after a removal:** next row, else previous, else the add
  control or heading; only when focus was lost, so a pointer user is never moved.
- **Cleanup, sheets refresh by themselves:** Sheet and Dialog refresh after a form
  was sent inside them; the player's close goes through `refreshWhenSettled()`.
- **Cleanup, `tone` on `iconButton` only:** `button()`'s kinds are its tones; invalid
  fields use a 1 px border plus a 1 px inset danger shadow, not `border-2`.
