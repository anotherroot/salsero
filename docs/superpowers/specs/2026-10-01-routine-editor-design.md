# The routine editor — design

> **Status:** approved in brainstorming, 2026-10-01. Extends
> [`2026-09-24-routines-design.md`](2026-09-24-routines-design.md), which stays
> the design of routines themselves — slots, alternatives, embedding, playing.
> This document owns how a routine is **edited** on
> `/[dance]/routines/[id]`, and tightens one rule there: a new alternative must
> also agree with the slot's main figure on where and on which count it starts.

## Purpose

The routine page works but is slow to build with. Every change goes through a
per-slot sheet: ↑/↓ buttons to reorder one step at a time, a `<select>` of every
figure in the dance to add one, and a confirm dialog to remove one. Building a
routine is mostly *"what can I do from here?"*, and the page does not answer
that question at the point where it is asked.

The goal is one cohesive, fast, pleasant flow:

- **reorder** by dragging a handle,
- **build** from the places that need building — the ends of the routine and
  every seam that does not connect — with a picker that offers what fits there,
- **edit** a slot in place: its alternatives and its note,
- **remove** with a swipe, and undo it,
- **work on several slots at once** with a long-press selection, including
  pulling a run out into its own routine.

Nothing about what a routine *is* changes. No schema change, no migration.

## The page

```
 Shine combo                         Edit
 [ Practise ]
 Starts from Open · Ends at Open · 1 break

            ( + )                        ← build up into slot 1
 ┌──────────────────────────────────┐
 │ ⋮⋮  1  Basic                      │
 │        1→1                        │
 └──────────────────────────────────┘
 ┌──────────────────────────────────┐
 │ ⋮⋮  3  Enchufla           Open → │  ← tapped open
 │        1→1 · closed → open        │
 │        ✎ Add a note…              │  ← the note, in the card
 └──────────────────────────────────┘
     │ ┌ Enchufla · Doble      1→1 ┐    ← alternatives: smaller, tinted
     │ └ + Alternative             ┘
 ─────────── (↓+) (↑+) ── hammerlock? ─  ← a seam that does not connect
 ┌──────────────────────────────────┐
 │ ⋮⋮  4  Sombrero                   │
 └──────────────────────────────────┘
            ( + )                        ← continue from the last slot
```

### Slot cards

Each slot is a card: a drag handle (⋮⋮), its number, the **main figure's**
label (or the embedded routine's name), and the "1→1 · closed → open" line. A
collapsed card shows its note in italics under the name, and its alternatives
as one quiet line (" / Doble").

**The main figure is the first option added** — ordered by
`routine_step_options.created_at`, then `rowid`. Today `routineSlots` orders
options by `figure_id`; it changes to that order, and everything that copies
options (`duplicateSlot`, `duplicateRoutine`, the new `duplicateSlots`,
`restoreSlot`, `extractRoutine`) inserts them in it, so a copy keeps its main
figure. "Main" is a presentation rule only: the player still resolves a slot's
options exactly as before.

### Tap: expand in place

Tapping a card's body expands it; one card is open at a time, and tapping it
again — or another card — collapses it. An open card shows, top to bottom:

1. **The note field**, inside the card under the name, styled as a quiet
   underline (✎ Add a note…). It saves on blur and on Enter, with no Save
   button; Escape restores what was there. Limit 200 characters, as today.
   While open it is registered with the unsaved-changes guard
   (`src/lib/unsaved/`), so leaving with a half-typed note gets the same
   Save / Stay / Leave question as any form; the routine's name and notes and
   the Make routine name go through `use:guarded`.
2. **An "Open →" link** in the card's header row, to the figure or the embedded
   routine.
3. **The alternatives**, under the card on an indented rail: smaller cards in
   the accent's tint, each showing its name only — no timing, since an
   alternative starts and lands exactly like the main figure. Beside each, two
   square icon buttons the card's height and rounding: **open** (↗) and
   **remove** (trash). A swipe left removes it too.
4. **+ Alternative**, a dashed button below them, which opens the picker in
   its alternative mode.

A slot holding an embedded routine expands to its note and "Open →" only. It
has no alternatives and no **+ Alternative** — a slot holds figure options or
one routine, never a choice between routines (see the routines design,
"Deliberately not included").

### Seams

Between two slots that do not connect — the hold does not reach
(`positionSeams`) or the count does not (`timingSeams`) — the page draws a red
line with two buttons and a short label naming what is missing:

- **↓+** builds **down from the slot above**: the picker is anchored on where
  that slot ends.
- **↑+** builds **up into the slot below**: the picker is anchored on where
  that slot starts.
- **+**, near the right end of the line (the line still runs past it),
  closes the gap **in one step**: the picker is anchored on both slots, so
  Count means it starts on the count the slot above leaves and leaves the slot
  below on its count, and Hold means it starts where the slot above lands and
  ends where the slot below starts. The button is drawn only when at least one
  figure, variation or routine fits both sides with both filters on (`canBridge`
  in `fit.ts`), so it never opens an empty list.

A seam that connects draws nothing, so a clean routine stays quiet and an
unfinished one shows exactly where the work is. Inserting is one-sided by
design: a gap often takes more than one figure to close, so the user builds
from whichever side they are working from and the seam moves until it
disappears.

**The ends are always buildable.** A dashed **+** above slot 1 behaves as
**↑+** into slot 1; one below the last slot behaves as **↓+** from it. An empty
routine shows a single **+** whose picker has no anchor and no filter.

### Drag to reorder

Pressing the handle starts a drag immediately — no long-press, because the
handle exists for nothing else (`touch-action: none` on the handle only). The
card lifts (shadow, slight scale), the others slide to open a gap where it
would land, and the list auto-scrolls when the pointer nears the viewport's top
or bottom edge. Release applies the new order optimistically and saves it;
Escape or `pointercancel` puts it back.

An open card collapses when its drag starts. Seams are hidden for the duration
of a drag and return with the server's answer — mid-drag they describe an order
that does not exist.

With the handle focused, **↑ / ↓** on the keyboard move the slot one place.
This replaces today's ↑/↓ buttons.

### Swipe

On a card's body — never its handle — a swipe **left** reveals **Delete**
under the card, on the right. The red fills the whole area under the card, so
it shows behind the card's rounded corners rather than stopping at the
button's edge. There is no right swipe: opening is a click ("Open →" on an
expanded card, the card itself for an alternative), which a swipe in the
other direction only duplicated while making a mis-swipe more likely.

The direction locks after ~10 px of movement: mostly vertical is a page scroll
and the swipe never starts (`touch-action: pan-y` on the card). Released past
~40 % of the button's width it snaps open, otherwise shut. One card is swiped
open at a time; a tap anywhere else closes it. A mouse drag swipes the same as
a finger.

Alternative cards swipe the same way: left removes that alternative. Swiping the **main** card left deletes the
**whole slot**, alternatives included.

### Long-press: select

A ~450 ms press on a card's body enters selection mode with that slot selected,
through the existing `src/lib/longpress.ts` (the coverage page's). While
selecting:

- the header reads **"2 selected ✕"**; ✕ or Escape leaves;
- taps toggle slots in and out of the selection;
- handles, swipes and expansion are off;
- a bottom bar offers:

| Action           | When                                     | Does                                                                                                 |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Add above**    | exactly one selected                     | the picker, anchored as **↑+** into that slot                                                       |
| **Add below**    | exactly one selected                     | the picker, anchored as **↓+** from that slot                                                       |
| **Duplicate**    | any                                      | copies of the selected slots, in their order, directly after the last selected slot                 |
| **Make routine** | a contiguous run, no embedded slot in it, and this routine not itself embedded | asks for a name, then replaces the run with one slot embedding a new routine made of it |
| **Delete**       | any                                      | deletes them all, with undo                                                                          |

A disabled action says why on tap ("Select slots next to each other", "Slot 3
is a routine — embedding is one level", "This routine is embedded in Social
mix"). After Duplicate, Make routine or Delete the selection ends. Add above
and Add below keep it while the picker is open — closing the picker without
picking leaves the slot selected — and a pick ends selection mode, with the new slot
open as below.

**Make routine** is the natural way a combo is born. The new routine is created
with its exercise (`createRoutine` already does both), its slots are the
selected ones moved over — options, order, main figure and notes intact — and
the run in this routine becomes one child slot at the run's position. All of it
is one transaction; any refusal writes nothing. The legality conditions are
exactly the one-level embedding rule (`canEmbed`) seen from the new routine's
side, so no new rule is introduced.

### Delete and undo

Delete never asks first — it is already two deliberate gestures (swipe, tap),
or a selection plus a tap. Instead:

- the slot(s) collapse out and the delete goes to the server at once;
- the action returns a **snapshot** of what it removed: per slot its position,
  child routine id, note, and option figure ids in order;
- a toast shows **"Slot 4 deleted · Undo"** (or "3 slots deleted") for ~6 s;
- **Undo** posts the snapshot to `restore`, which re-inserts each slot at its
  position.

Removing an alternative is the same: "Removed Doble · Undo". Its undo
re-inserts the option directly (`restoreOption`), checking only that the figure
is still this dance's: it was in the slot a moment ago, and running it through
`addOption` would refuse an older alternative that predates the start rule
below. It comes back as the newest option, which cannot change the main figure —
the main figure is never removed on its own. Restored slots get new ids; nothing refers to a slot id
(the routines design, "Archive, don't delete"), so that is harmless.

There is no undo for a reorder or an insert: drag it back, or swipe it away.

### After an insert

The new slot is scrolled into view and flashes once, and opens expanded, as
if you had tapped it, with its note field and + Alternative ready. If it closed a gap, the
seam it closed is gone — that is the reward for building.

### Errors

Every change is applied optimistically, then the page calls `invalidateAll()`
so the server's state replaces the guess. When an action is refused — an
alternative that no longer fits because a figure's tags changed, a slot already
deleted in another tab — the server's state wins and the message shows under
the slot it was aimed at, through the page's existing `failedSlot` mechanism,
or in the banner when no slot is named.

### What goes away

The per-slot edit sheet, the ↑/↓ buttons, the header's **+ Add** button, and
the add sheet with its two `<select>`s. The header's **Edit** — name, notes,
Duplicate routine, Archive — is unchanged.

## The picker

One bottom sheet (`Sheet.svelte`), used for every way of adding something:

```
 Add after slot 3                       ×
 Starts on 1 from Open two hands
 ⌕ Search figures and routines
 [✓ Count] [✓ Hold]
 FIGURES
 Cross body lead
 1→1 · open → closed
 Enchufla                                     ← greyed: a group header only
 1→1 · closed → open
   └ Enchufla · Doble
     1→1 · open → open
 Setenta
 1→1 · open → hammerlock
 ROUTINES
 Shine combo
 1→1 · open → open
```

Each row is two lines: the name, then the counts it starts and ends on and the
hold it starts from and the hold it ends in — both ends, because a figure is
chosen as much for where it begins as for where it lands.

**One tap inserts and closes.** There is no confirm step.

### Anchors

What the picker filters against, by how it was opened:

| Opened from                              | Anchor  | Context line                          | **Count** keeps             | **Hold** keeps                       |
| ---------------------------------------- | ------- | ------------------------------------- | --------------------------- | ------------------------------------ |
| ↓+ under slot *i*, bottom +, Add below   | `after` | "Starts on *n* from *position*"       | start count = slot's next   | starts include the slot's end        |
| ↑+ above slot *i*, top +, Add above      | `before`| "Ends on *n* at *position*"           | next count ∈ slot's start counts | end ∈ slot's start positions         |
| + Alternative                            | `alternative` | "*Closed → Open*, 1→1"          | always on — see below       | always on — see below                |
| the single + of an empty routine         | none    | none                                  | —                           | —                                    |

"Ends on *n*" is the count **before** the anchor slot's start count — a slot
starting on 1 is reached by a figure ending on 8 — because that is how a dancer
says it. Candidates are read through `startsOf` / `endOf` /
`nextCountOf`, so an untagged figure is neutral and starts on 1, exactly as
everywhere else. An embedded routine is a candidate with its own shape:
`routineStarts`, `routineEnd`, and the start count of its first slot and next
count of its last.

**Count** and **Hold** are chips, both on by default, each turning its filter
off independently. When the filters leave nothing, the list says so and offers
the way out: *"Nothing you know starts on 1 from Shadow. Turn off Hold to see
the rest."*

### The alternative mode

**+ Alternative** opens the same sheet titled "Alternative for Enchufla", with
no chips: an alternative must agree with the slot's **main** figure on all four
of start count, next count, end position, and at least one start position. It
cannot be turned off, because the server refuses anything else (below). No
routines are offered.

### Grouping and search

Figures are listed alphabetically (`listVersions`' order), **each followed by
its variations as nested rows** — every variation a full-width row with its own
timing, because variations are where landings differ. When a variation fits
but its figure does not, the figure stays as a greyed, non-tappable header so
the group still reads as one. Embeddable routines (`embeddable()`) follow under
their own heading, filtered the same way.

Search matches a figure's name or a variation's — "doble" finds
"Enchufla · Doble" — case- and accent-insensitive. A figure whose own name
matches brings its matching variations with it.

The search field is focused on open only under `(pointer: fine)`: on a phone,
the keyboard would cover the list that is the point of opening the sheet.

## The rule this tightens

The routines design requires a slot's alternatives to **share their end
position and next count**, and takes the **union** of their start positions —
permissive on purpose, so an option that does not work from where the dancer
is simply is not picked.

From now on, **adding** an alternative also requires, against the slot's main
figure:

- the **same start count**, and
- **at least one shared start position**.

An alternative that shares no start with the main figure can never be danced
where the main figure is, which is not what "alternative" means to the person
building the routine. `addOption` enforces it on write, as it already enforces
the end rule. The union rule for a slot's starts is **unchanged**, and slots
that already hold an alternative breaking the new rule are left as they are:
the rule governs adding, it is not a migration.

## Structure

### Pure, client-safe, tested

- **`src/lib/routines/fit.ts`** — the picker's brain. Input: the candidates
  (each figure, variation and embeddable routine with `starts`, `startCount`,
  `end`, `next`, a label and its parent), an anchor (`after` / `before` /
  `alternative` / none), the two toggles, and the search text. Output: the
  groups to render, greyed parents included, and whether a toggle is what
  emptied the list. Knows nothing of dances, like the rest of
  `src/lib/routines/`.
- **`positionSeams(g, shape)`** in `src/lib/routines/routines.ts`, the twin of
  `timingSeams`: per row of `slots` — not per flat index — which next row this
  one fails to reach in the hands. Today's `breakAfter` stops being trustworthy
  per row as soon as a slot embeds a routine; seams have to be per row, so this
  replaces it on the page.
- **`src/lib/gestures/drag.ts`** — pointer y and the cards' measured rects →
  the target index, plus the auto-scroll velocity near an edge.
- **`src/lib/gestures/swipe.ts`** — the direction lock, the snap threshold,
  and which side is open. DOM-free, in the manner of `src/lib/longpress.ts`:
  the caller feeds it pointer positions and asks what to do.

### Components — `src/lib/components/routines/`

`SlotCard.svelte` (handle, swipe layers, expand/collapse, note field,
alternative cards), `Seam.svelte`, `SlotPicker.svelte`, `SelectionBar.svelte`,
`UndoToast.svelte`. The page becomes the wiring between them and the actions.

### Server

New data functions in `src/lib/server/routines.ts`, `db` first, each a single
transaction built on the existing `order()` helper:

- `insertSlot(db, routineId, at, { figureId } | { childId })` — a figure or an
  embedded routine at index `at`. `addFigureSlot` / `addChildSlot` become
  calls to it with `at = length`. A child goes through `canEmbed`.
- `moveSlotTo(db, routineId, stepId, index)` — replaces `moveSlot`'s swap.
- `deleteSlots(db, routineId, stepIds)` → the snapshot, or null when any id is
  not this routine's (nothing deleted).
- `restoreSlots(db, routineId, snapshot)` — re-inserts each at its position;
  every figure must still be this dance's and every child still embeddable,
  or nothing is restored.
- `duplicateSlots(db, routineId, stepIds)` — copies after the last selected.
- `extractRoutine(db, routineId, stepIds, name)` → the new routine's id, or
  null when the run is not contiguous, holds an embedded slot, or this routine
  is embedded somewhere.
- `restoreOption(db, stepId, figureId)` — undo for a removed alternative;
  checks the dance only, not the alternative rules.
- `addOption` gains the start rule above.
- `routineSlots` orders options by `created_at`, `rowid`, and every copy path
  inserts them in that order.

New form actions on `/[dance]/routines/[id]`: `insert`, `reorder`,
`deleteMany`, `restore`, `duplicateMany`, `extract`. Existing ones stay where
still used (`addOption`, `removeOption`, `note`, `rename`, `duplicate`,
`archive`); `move`, `addFigure`, `addChild`, `remove` and `duplicateSlot` go
once nothing posts to them. Every slot-taking action checks that each id is
this routine's — the existing `ownsSlot` guard, extended to a list.

The page calls actions with `fetch` + `FormData` + `deserialize`, applies the
change locally first, and `invalidateAll()`s after — not a separate JSON
endpoint, which would be a second way of mutating the app that nothing else
uses.

The load gains, per candidate, `starts` and `startCount` beside the existing
`end` and `next`; the embeddable routines with their shape; and per row the
position seams with the position names for each label.

## Testing

- **`fit.ts`:** each anchor; each toggle alone and both; search on a figure's
  name, on a variation's, ignoring case and accents; greyed parents; untagged
  as neutral; routines filtered like figures; the alternative mode ignoring
  the toggles and offering no routines; the "a toggle emptied it" signal.
- **`positionSeams`:** past an embedded routine and past an archived-only slot,
  still on the right row.
- **Gestures:** drag target index at the edges and in the middle, auto-scroll
  velocity; swipe direction lock, the snap threshold both ways, vertical
  scroll winning.
- **Data functions** against `openDb(':memory:')`: `insertSlot` at the start,
  middle and end; `moveSlotTo`; delete-then-restore round-trips to an
  identical routine, main figure included; `duplicateSlots` keeps order;
  `extractRoutine` refuses a non-contiguous run, an embedded slot, and an
  embedded parent, creates the exercise, and writes nothing on refusal;
  `addOption` enforces the start rule and leaves existing slots alone; the
  main figure survives every copy path.
- **The dance wall:** every new action refuses a slot of another routine or
  another dance, following `src/routes/[dance]/dance-wall.spec.ts` — never
  `process.env.DATABASE_PATH`.
- **By hand:** a dev slot (`scripts/slot.sh`) at phone width with touch
  emulation, and on a real phone — drag, swipe, long-press, undo.
- `npm run check` passes.

## Documentation this changes

- [`2026-09-24-routines-design.md`](2026-09-24-routines-design.md): the variant
  algebra gains the start rule for adding an alternative and the main-figure
  ordering; a pointer here.
- `CLAUDE.md`: the Layout block gains `src/lib/gestures/` and
  `components/routines/`; the Live line gains the routine editor and its spec.

## Deliberately not included

- **Routines as alternatives.** A slot holds figure options or one embedded
  routine. Unchanged from the routines design; it would need a schema change
  and a plan that branches into several slots.
- **Dragging a multi-selection.** One slot drags at a time.
- **Undo for reorder and insert.** Both are one gesture to reverse.
- **Full-swipe delete** without the tap. Too easy to trigger while scrolling.
- **Offline queueing.** An action that fails is reported and the server's
  state is shown; nothing is retried later.
- **Two-sided fitting for an insert** — filtering by both neighbours at once.
  Considered and rejected: a gap usually takes more than one figure, and the
  one-sided anchor is what lets it be built from either end.
