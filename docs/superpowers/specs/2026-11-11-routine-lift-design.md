# The routine editor: a slot lifts

Board: https://claude.ai/artifact/QUuSU6xq6Pw1h2botYSUMd (T3, S5–S8). The
user picked T3 for an open slot and S7 → S6 → S8 for the long-press
selection, one language for both: what you work on lifts, the rest steps
back. Amends the routine editor design (2026-10-01): "Tapping a card" and
"Long-press: select". Phone and desktop alike.

## The look: lifted and dimmed

- A **lifted piece** is a surface card, radius 20 px, with a soft shadow
  (`0 14px 34px` black at 18 %) and a 1 px accent ring at 12 %. It does not
  grow, move sideways or change its type size: nothing around it reflows.
- Every slot that is not lifted while something is (an open slot, or a
  selection) **dims**: opacity 45 % beside an open slot, 60 % beside a
  selection, with its seam. A dimmed slot still takes taps.
- Opacity and shadow ease in 150 ms; reduced motion: no easing.

## An open slot (T3)

Tapping a card opens it, as today; it lifts. Inside, top to bottom:

1. The header row as today (handle, number, title, meta, Open →). The number
   fills with the accent. The meta line loses the length chip while open
   (it moved to the toolbar); a closed card keeps it.
2. The note field, as today.
3. **Alternatives** under a small "OR" label (`figure.or`, upper case): one
   tinted row each: the name (a link to the figure, its group badge), its
   length when the routine sets it (a tap opens How long?), and × to remove.
   A swipe left removes it too, as today. No section without alternatives.
4. **A toolbar** across the foot, hairline above, cells split by hairlines,
   icon over label, 60 px tall: **length** ("4 counts", How long?) when the
   main figure's length is set per slot, **+ Alternative** when one can be
   added, **Before n** and **After n** (the picker anchored ↑ Before / ↓
   After this slot, as a seam's). An embedded routine's slot has only
   Before and After.

The dashed circle buttons and the rail added earlier on 2026-11-11 go.

## The selection (S7 → S6 → S8)

- A selected slot lifts; the others dim. In the number's place a selected
  slot shows a filled accent circle with a check; an unselected one a
  dashed ring with its number. The handle column stays (muted, inert), so
  no card changes width.
- **One slot** (S7): its piece holds, under the card, the line "Tap other
  slots to add them." and the selection toolbar.
- **Slots next to each other** (S6) join into one piece: a header "Slots
  3–4" (sl »Mesti 3–4«, »Mesta 3–5«), the cards split by hairlines, a seam
  between two of them drawn inside the piece, and the toolbar at its foot.
- **Slots apart** (S8), or none yet (Select slots from ⋯): each selected
  slot lifts alone, and the toolbar docks at the screen's foot as a lifted
  piece of its own.
- **The selection toolbar**: Before, After, Duplicate, Make routine, Delete.
  Before and After now work for any run of neighbours (before its first,
  after its last), not only one slot; apart: greyed, "Select slots next to
  each other." A greyed action still takes a tap to say why, in a line
  above the toolbar, as today.
- The tab bar steps aside for the whole selection, docked or not.

## Nothing jumps

A change of what is open or selected never moves the slot under the finger.
Before the change the page notes where that slot's card is on screen; after
it, it scrolls by however far the card moved. That covers a long press, a
tap that selects or deselects, opening or closing a slot (another one
closing above it included) and leaving the selection with ×. A page that
cannot scroll that far moves as far as it can.
