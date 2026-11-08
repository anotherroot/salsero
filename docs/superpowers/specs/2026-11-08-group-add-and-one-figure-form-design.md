# A group's + and one figure form

Two small fixes asked for on 2026-11-08, built together on `small-fixes`.

## 1. The group page: months, the band's +, Add to the group

What the user said: on a group's page the lessons do not show which month and
year they are from; move Add lesson to a + in the band; drop the Lessons title
and head the list by month as the Lessons tab does; the + first opens a choice
of Lesson, Music, Figure, Routine, Position and Drill, then the popup for that
one.

- **By month.** The group page's lessons are grouped under month headings
  ("November 2026"), the Lessons tab's `SECTION_LABEL` words
  (`monthLabel`). The load puts drafts first; the page sorts by class day,
  newest first (`byMonth` in `src/lib/lessons/list.ts`), so a draft sits in its
  month wearing its Draft badge. The "Lessons" heading and the "+ New lesson"
  button above the list go. With no lessons, "No lessons yet" stays.
- **The band's +.** An editor (owner or editor, the group not deleted, not My
  class) gets a + in the band, before the ⋯, labelled "Add to the group".
- **Add to the group** (option A of the mock, picked 2026-11-08): a small sheet,
  titled "Add to the group", one card of rows like the group's ⋯ menu: an
  accent icon and a bold name. In order:

  | Row      | Icon        | What it does |
  |----------|-------------|--------------|
  | Lesson   | `lessons`   | New lesson, on this page (the sheet it had) |
  | Music    | `music`     | switches into the group, `/{dance}/songs?add=1` |
  | Figure   | `footprints`| switches into the group, `/{dance}/figures?new=1` |
  | Routine  | `route`     | switches into the group, `/{dance}/routines?new=1` |
  | Position | `graph`     | switches into the group, `/{dance}/positions?new=1` |
  | Drill    | `metronome` | New drill, on this page |

  "Switches into the group" is the group-mode switch itself: a POST to
  `/{dance}/group-mode` with `team` and `to`, close-then-go
  (`gotoWhenSettled`), as `GroupModeButton` does. The list then opens its own
  create sheet from the URL, as each already does, and what is made is the
  group's (`spaceOf`).
- **Only where group mode exists.** The switch is drawn at Everything only
  (`groupModeShown`). Below it (Practise and keep my own) the + opens New
  lesson straight away, no sheet.
- **Drill** (choice 2): a drill of the group with no lesson yet. The sheet asks
  for a name and notes and posts `?/createDrill` on the group page, which
  makes it with `createCustomExercise` in the group's space (logged in History
  there) and opens the drill's page. Members reach a group drill only through a
  published lesson, so it reaches nobody until an editor links it in a lesson
  (the lesson's exercise picker lists it). Refused: an empty name, notes over
  2000, a member, a deleted group.
- Words in both catalogs (`groups.page.add`, `addMenu`, `newDrill`).

## 2. One figure form: the move is a field

What the user said: when adding a new figure there should be no difference
between + Figure and + Move; remove Move, and in the figure's form search for
the move to put it under; if no move fits, make a new one when the figure is
made.

- **The Move field.** `PickerField` takes an optional create: the picker's
  create row reads "Not in the list? Create “Tornillo” as  + Move". Tapping it
  fills the field with the typed name, marked "New move", and the form posts it
  as `figureName`; a picked move posts `groupId`. One of the two, never both.
  A typed name that folds to an existing move's name (`fold`) picks that move
  instead of making a second. An empty search makes nothing.
- **Where it applies** (every form that made a figure two ways):
  - **The Link popup** (player and lesson page): the create row is + Figure,
    + Drill, + Position; + Move goes. The Figure step has Move (the field),
    Figure name, Danced, Style. It sends `kind: 'variation'` with `groupId` or
    `kind: 'figure'` with `figureName` — the API is unchanged, both already
    exist and create-and-link in one transaction.
  - **The lesson page:** New figure loses its Make switch (New move / In a
    move); one form, Move first. It posts to `?/newVariation` or `?/newFigure`
    by what the field holds; both actions stay as they are. Its Link a figure
    picker's create row is + Figure only.
  - **Moves → Figures:** "New move" becomes "New figure" (the button, the
    sheet's title, the empty pane's button). Its form gets the Move field; the
    list's `create` action takes `groupId` too and makes the figure in that
    move (`createVariationIn`), the position preset included, in one
    transaction; a move not in the space, or archived, is refused under the
    field. The moves offered are the space's own (`listMoveTargets`, loaded by
    the `(moves)` layout).
- **Not changed:** a move's page and a figure's page make a figure in their own
  move (the move is known); Edit renames the move with its text field.
- New figure in an existing move keeps its existing refusals ("Enchufla already
  has a figure called Doble"), shown under Figure name.

## 3. Edit asks no move name (2026-11-08)

A figure's Edit no longer shows Move name: the move's own page renames it.
The page's `update` takes `figureName` only when it is sent (an older open page
still sends it) and otherwise leaves the move as it is. `FigureFields` has no
Move name field any more: every New figure form takes its move from the Move
field (section 2).

## 4. A group's heading in the Moves lists (option A, 2026-11-08)

On Figures, Routines and Positions, where a group's rows start (the lessons a
person added), the group gets its own heading (`components/moves/GroupHeading`):
a line above, the people icon in an accent tile, the group's name larger than a
move's name, and "Group · 3 figures" under it (`groupMeta`). The lists stay
apart: yours first, then each group. Merging same-named moves (options B and C)
was not chosen.

## 5. Scrollbars

Thin rounded scrollbars in the theme's muted ink, no track, no arrows
(`layout.css`: `::-webkit-scrollbar` for Chromium and Safari, `scrollbar-width`
and `scrollbar-color` for Firefox).

On the desktop the window's scrollbar runs from the band row's foot to the bottom:
its track starts `--band-row-h` down and the strip beside the band row is the band's
colour (`--gutter-band`, per dance, theme and group). Chromium styles the window's
scrollbar from `<body>`, so those rules sit on `body:has([data-frame-band])`. Firefox
keeps a full-height bar.
