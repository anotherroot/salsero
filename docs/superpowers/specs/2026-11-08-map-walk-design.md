# The map: a walk sheet, and walking a routine

*2026-11-08. Replaces the "The map" paragraph of the
[positions spec](2026-11-04-positions-design.md) (its "Screens" section) for
how the map looks and what a tap does. The layout's promises there still hold:
computed once, the same every visit.*

## Why

The user does not like how the map looks today: circles sized by figure
count, names under them, a card on a page with the legend and the tray
below it. They looked at nine designs over three pages of mockups and picked
two:

- **A, Walk sheet:** the whole map fills the screen and stays where it is.
  Tapping a position raises a sheet that says where it comes from and every
  place you can step to, each with its figures. Tapping a place steps there.
- **C, Walk a routine:** "Walk from here" in that sheet. Each figure you tap
  is added to a strip, the map draws the numbered path, and Make routine
  saves the strip as a routine.

In the user's words: *"I like that the map stays as it is. You can always zoom
in. And it's less work for the phone to rearrange each time you click
something."* They turned down Focus, the design where the map rearranges
around the tapped position, for exactly that reason. They also said they
*"really like the idea that you can walk the graph to make a routine."*

The mockups (live phones, light and dark):

- [The first five designs and today's screenshots](https://claude.ai/artifact/DggyKFU9AZZpno2e9Bv3ei)
- [Four mixes](https://claude.ai/artifact/Nr2EzqLqb5XhJ1iyHqMJz7). Design 1 there is A on the user's real data.
- [The map with lots of connections](https://claude.ai/artifact/BxneXEEuUxBhzsne4YhgtK).
  A and C there are what is being built, on a made-up library of 20 positions.

## Goals

- The map is the whole screen on the phone, with positions drawn as name
  pills that never collide.
- One tap reads a position: what leads in, and where you can go with which
  figures. The next tap steps there.
- You can walk a routine figure by figure and save it as a routine.
- The map never moves its positions after it is drawn. Only the view (pan and
  zoom) moves.

## Non-goals

- No rearranging layout (Focus). No second layout.
- No new data: nothing is stored for the walk until Make routine, and no
  migration.
- No change to the graph's rules (`meet`, families, twins) or to the gap report.
- The routine editor is unchanged. A walk ends on the routine's page, where
  the editor takes over.

## Anti-goals (a failure even if it works)

- The positions jump or re-lay out when you tap something.
- Tapping gets slow on the phone: a tap must not recompute the layout.
- Labels overlap or run off the screen at rest.
- A walk you've been building disappears without asking.

## The phone

### At rest

- The map fills the screen between the top and the tab bar. The tab bar stays.
- The back button, the title "The map", the summary line (today's `mapSummary`),
  and an ⓘ button float over the map, top left and top right, on surface-coloured
  rounded backs as in the mockups. Below ⓘ, a "whole map" button (the ⤢ icon) sets
  the view back to fit everything.
- Each position is a **pill**: a rounded box holding its name (up to two
  lines), with a dot in its type's colour (`styleTone`). The border is in the
  type's colour too.
  - A dead end has a solid danger border and its mark word under it (today's
    words). An orphan has a dashed danger border.
  - A twinned node keeps its "Twins" line.
- Arrows join the pills. Their thickness is the figure count, with the number
  on the arrow when it is more than 1, as today. A loop is a small curl on the
  pill. At rest, arrows are muted (ink-2, about 40% opacity).
- The view starts fitted: the whole map visible above the tray.
- A **tray** sits at the bottom, a low sheet (about 116 px) holding one hint
  line ("Tap a position to see where it leads.") and a row of chips:
  - "N nothing gets to" and "N dead ends", when there are any. Tapping one
    picks the first such position.
  - "N unused" (positions with no figures).
  - "N with no position", a link to `/positions/none`.
  - Islands, one chip each, linking to the position.

  The tray replaces today's "Not on the map" and islands cards.
- The legend moves into a small sheet behind ⓘ ("How the map works"): types,
  dead end, orphan, island, the arrow colours, and the gestures.
- Pinch zooms from the fitted view up to 4×, one finger pans a zoomed map, a
  double tap on empty space fits the whole map again, and Ctrl+wheel zooms on a
  trackpad (today's `video/zoom.ts` maths, with the floor at the fitted scale
  rather than 1×).

### A tap on a position (A)

- The pill fills with the accent colour. Arrows **out** of it turn accent
  (wine), arrows **into** it turn the easy colour (blue). Positions it doesn't
  touch fade to about 25%, and so do their arrows.
- The view eases so the lit positions sit in the room above the sheet,
  zooming out if it must and never zooming in past 1×. Positions never move,
  only the view. With reduced motion it jumps.
- The **sheet** rises, about 380 px, scrolling inside:
  - **‹ <previous>**, only when you got here by stepping. It steps back.
  - The name, large, with "N figures in · N out" under it, and **Open** (the
    position's page) on the right. A second tap on the lit pill opens it too,
    as today.
  - **↻ Stays here:** the loop figures, when there are any.
  - **From** with blue chips, one per position that leads here. Tapping one
    picks that position; it is not a step. When nothing leads here:
    "Nothing leads here yet" (danger).
  - **Step to**, one row per place you can go: the type dot, the name, the
    figures in short ("Basic step ×3 · Paso Madrid · To Cradle", moves
    grouped), the count, and a chevron. Tapping a row is a step. Most figures
    first.
  - **Anywhere**: figures that start here and have no end, with the line "No end
    set" and their names. It isn't tappable.
  - "Nothing leaves here yet" (danger) when there is no row.
  - **Walk from here**, a button (see C). It sits beside or under the name
    row, as the builder sees fit.
- **A step:** tapping a Step to row (or a lit pill that is a place you can go)
  picks that position and remembers where you came from. The edge you just
  took is drawn thick and blue. ‹ walks the trail back one at a time. Tapping a
  position that isn't one step away picks it and forgets the trail.
- A tap on empty space, or Escape, closes the sheet back to the tray.
- `?pick=<id>` (Show on the map) arrives with that position picked and its
  sheet up, as today.

### Walking a routine (C)

- **Walk from here** turns the sheet into the walk:
  - The title is "Walk from <start>", with "N figures · now in <position>" under
    it, and **Undo** on the right.
  - A **strip** that scrolls sideways: the start position as a plain chip, then
    each figure as a numbered chip ("1 Cradle entry · From closed").
  - **Next from <current>**, one group per place you can go: "→ <name>" (or "↻
    Stays in <name>"), then a chip "+ <figure>" for each figure that goes there.
    Tapping a chip adds that figure, and the current position becomes where it
    ends.
  - **Anywhere (no end)**, a group of figures that start here with no end.
  - **Fits anywhere · N**, collapsed at the end: figures with no start, which fit
    after anything (`meet`). Open, it lists them like the other groups.
  - After a figure with no end, there is no current position. The sheet says
    "<figure> has no end, so anything can follow. Tap a position on the map to
    carry on", and a tap on a pill continues from there. The strip shows that as
    a plain "→ <name>" chip, not a figure.
  - When nothing leaves the current position: "Nothing leads out of <name>.
    Undo, or make the routine as it is."
  - A footer that stays at the bottom of the sheet: **Clear** (ends the walk
    and goes back to the current position's sheet) and **Make routine · N**
    (dimmed with no figures).
- **The map** while walking:
  - Each figure walked is a thick accent arrow with a step-number badge
    ("1", or "2,5" when the same arrow is walked twice).
  - The current position is filled with the accent colour. Positions you've
    visited have an accent border.
  - The places you can go next are full strength, with dashed accent arrows
    from the current position. Everything else fades to about 20%.
  - The view eases to fit the path so far plus the next places, above the
    sheet. Pills still never move.
  - During a walk, a tap on a pill does nothing, except after a figure with no
    end, where it picks the position you carry on from.
- **Make routine** opens a "New routine" sheet with a name field, as Coverage's
  Create routine does. Saving makes a routine with one slot per walked figure,
  in order (`createRoutineFromFigures`), and goes to that routine's page. A
  step from a no-end figure to a tapped position isn't saved. The routine
  editor shows a seam there anyway when the next figure's start doesn't meet.
- **Walked figures with no arrow:** a "Fits anywhere" figure (no start) that has
  an end E, added at A, is drawn as a dashed accent arrow A → E with its badge.
  That arrow is drawn for the walk only and isn't in `layout.edges`, so the walk
  model passes it to the arrow geometry itself. A figure with no end, and the
  tap that carries on after it, draw no arrow: the strip shows them.
- **Leaving with a walk:** while the walk has at least one figure, leaving the
  page (a tab, a link, the band's back) asks through the app's Unsaved changes
  dialog. **My call:** its Save makes the routine under the name "Walk from
  <start>" (renamed on the routine's page like any other) and then carries on
  where the person was going. Clear and Undo don't ask. The page holds off its
  reload after a deploy while a walk has figures (`holdReloadWhile`).
- **Back** (Android's button or the browser's). **My call:** an open sheet,
  position or walk, holds one history entry, as the app's sheets do. Back
  closes the position sheet to the tray. From a walk it ends the walk, asking
  first through Unsaved changes when the walk has figures. Stepping and ‹ don't
  add entries: ‹ is the in-sheet way back along the trail. The sheets aren't
  modal (the map still takes taps), so they aren't the app's `Sheet`. They use
  the same history plumbing (`src/lib/sheets/`).
- **The same figure twice** is allowed (badges like "2,5"). The new action keeps
  repeats in order. Coverage's `ints()` drops duplicates, so it isn't used as is.
- Make routine and Walk from here are offered wherever the Routines list
  offers a new routine (the same level and group-mode rules). In group mode
  the routine is made in the group (`spaceOf`, as every create does).

## The desktop (from 1024 px)

The map stays the Positions pane beside the list, at most 800 px wide.
**My call:** the sheet becomes a panel on the right of the map inside the pane
(about 320 px), holding the tray at rest, a position when one is tapped, and
the walk while walking. Same content, no bottom sheet. The map takes the rest
of the width and the full pane height. The floating title isn't drawn,
because the pane has its own heading (`PaneHeading`).

## What the map needs from the server

Today `mapData` sends each edge's figure **count**. The sheet and the walk
need the figures themselves:

- Per edge (from → to, loops included): the figures, each as `{ id, label, move }`,
  where `label` is `figureLabels`' "Enchufla · Doble" form and `move` is the
  move's name, for the grouped short line.
- Per position: the figures that start there and have no end (Anywhere).
- Once: the figures with no start that have an end or not (Fits anywhere),
  for the walk.

All of this is the same graph the map already reads (`graphFor`: the person's
figures plus the group figures they may use, or the group's in group mode),
with twins folded as now. The walk needs nothing more: "where can I go from
here" is these lists.

## Constraints (from CLAUDE.md, restated where they bite)

- Words go through `t()`, in both catalogs (en and sl), and the new and changed
  components go in `TRANSLATED`. **My call:** the map's existing words (the
  `MAP` constant in `positions/view.ts`) move into the catalogs with the rest,
  since the whole screen is rewritten.
- Colours come from the tokens: `--accent` for out and the walk, `--easy` for
  in and the step back, `--danger` for gaps, the type tones from `styleTone`.
  No colour that isn't a token.
- PURE parts stay PURE and tested: the layout (`map.ts`), what is lit and how
  arrows bend (`map-view.ts`), the sheet's rows and short lines, the walk's
  state (start, steps, current position, Undo, the options from the current
  position), and the view fitting (the transform that fits a set of positions
  in a given room).
- The map page draws no band of its own on the phone (the title floats over
  the map). It goes in `NO_BAND` in `bands.spec.ts` with that reason.
- Every position is still a link (Tab reaches it, Enter is a tap). The sheet's
  rows and chips are buttons. Escape closes the top thing.
- The layout runs once per load, never on a tap. Taps change only what is lit
  and the view's transform.

## Left to the builder

- **The layout's maths.** Today's Fruchterman–Reingold plus push-apart works
  on circles and label boxes. Now the pill is the box. The frame's shape (a
  portrait frame may suit the phone better than today's square) is also the
  builder's. It must stay deterministic and collision-free, as today.
- The exact sizes, timings (around 0.5 s with an ease-out), and fade levels,
  following the mockups.
- How the view's fit and the pinch share state.
- Where the walk's state lives (component state is enough: it doesn't survive
  a reload, and the unsaved guard covers leaving).
- The order of the work, and whether C ships with A or right after it.

## Decided while writing (my calls, for the user to check)

1. The legend moves behind ⓘ, and the tray chips replace the Not on the map
   and Islands cards.
2. Arrows are wine out and blue in for every position, not in the position's
   type colour as today. The type shows on the pill's dot and border.
3. Tapping the picked position's pill a second time still opens its page, as
   today.
4. The walk offers figures with no start ("Fits anywhere") in a collapsed
   group, since the graph says they fit after anything.
5. On the desktop, the sheet is a side panel inside the pane.
6. The map's words move to the catalogs now, not in Slovenian part 2.
7. Unsaved changes' Save names the routine "Walk from <start>" and carries on.
8. Back closes the open sheet (one history entry). From a walk with figures, it
   asks first.
9. A no-start figure walked from A draws a dashed A → its end arrow. A no-end
   figure draws none.

The map is drawn in two places on the desktop, the map route and the Positions
list's empty pane. Both go through `MapPane`, so everything here applies to both.

## Decided while building

1. The frame is portrait, 7:10, for the phone. Two pills too wide to sit side
   by side in it are always parted vertically, or they bounced against the
   walls for good.
2. The whole-map view is capped at scale 1: a tiny map is centred, not
   enlarged. It also keeps 12 px clear at the room's sides.
3. On the desktop the map takes the pane's full width and the 320 px panel
   floats over its right edge, as the phone's sheet floats over the bottom.
   Read literally, "panel on the right, map the rest" left a 310 px map. The
   fits leave the panel's room (`Room.right`); the person can pan.
4. An orphan keeps its mark word under the pill, as a dead end does.
5. The unused chip opens the first unused position, like the gap chips.
6. A tray chip starts a fresh trail. It is never a step back from the last one.
7. The panel holds one history entry whatever it shows, so Back closes it.
8. Back during a walk ends it and lands on the tray, after asking when there
   are figures. Clear is the way back to the position's sheet.
9. While the walk stands nowhere, the view fits the path so far, not the whole
   map: at whole-map scale the pills were too small to tap. After a figure
   with no end it does the same.
10. Walk badges are drawn above the pills, so a pill never hides one.
11. The Unsaved dialog's Save uses `sendAt`, which posts and does not follow
    the redirect. Following it would race the navigation the person chose.
    It then calls `invalidate('app:moves')`, so the Moves lists show the routine.
12. Make routine closes the sheets, then goes with `gotoWhenSettled`, so no
    shallow map entries are left behind.
13. Sorts in the sheet and the walk use a fixed `'en'` comparator, so the
    server and the browser order names the same.
14. Fits anywhere is offered when the walk stands nowhere too, since those
    figures fit after anything. The stuck line shows when no group leaves the
    current position.
15. The legend became the ⓘ sheet, and "Bigger: more figures" went: pills no
    longer change size. The pill links lose the global focus halo; the in-map
    ring stays.
16. The sheet has a fixed height (the smaller of 380 px and 62 % of the map),
    so a step never refits the view. A short sheet leaves blank space at its foot.
17. The map's words are in both catalogs, and the pill marks are translated.

## Known gaps

- At 1280 px the whole map draws at about 0.71x on the desktop: the frame is
  portrait for the phone. A landscape frame for wide maps would fix it.
- Two copies of a figure show identical chip labels in a walk. Nothing tells
  them apart.
- The first open on the phone fits twice, because the room's foot is measured
  a tick late.
- The Twins line under a pill ("Twins: ...") stays English.
- In Slovenian the "N neuporabljenih" chip has no noun, and the mark words
  are wider than the space reserved for them.
- The sheet pulls focus back to its heading when the map data refreshes.
- Past about 200 positions the layout takes a noticeable moment (0.5 s at 400).
- On a short phone about 70 px of map shows above the sheet; the sheet has no
  rise animation.
