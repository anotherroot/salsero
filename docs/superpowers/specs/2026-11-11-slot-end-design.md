# A routine slot's end — design

Board: https://claude.ai/artifact/DrF5T6kTJ4p5ka6qfVmeN4 (picked: »Izbrano · samo
konec«, »Tap na mesto«, »Tap na čip konca«; the earlier boards on it are the
options that led there).

## Why

A move's figure can end in several positions (`figure_end_positions`), the
way a free figure can last several lengths (flexible figures, 2026-11-11). In a
routine the person dances ONE of them: after each figure the hands are in an
exact position; the other ends are variations, not part of this routine. Today
a routine only knows "ends in Closed or Open", so it cannot say where the hands
are, the seams judge against every possible end, and the slot's line spends its
room on start positions the slot above already decided.

So: as the routine sets a free figure's length per slot, it sets the end per
slot, for figures with more than one end.

## Goals

1. A slot can hold a chosen end: one position, for the whole slot — the main
   figure and every alternative end there (the user's rule).
2. A choice is only asked for where there is one:
   - the slot's figures share more than one end, and
   - the slot below does not decide it. It decides it when everything it can
     start in is exactly one position, and that position is among the slot's
     ends. Then that position is the end, whatever was chosen before (my call,
     shown to the user on the board without objection).
   - A figure with no positions (ends anywhere) or one end: nothing to choose.
3. The slot's line shows only where it ends, not where it starts: the start is
   the end of the slot above. The first slot of the routine keeps its start
   (»Closed → Closed«), since nothing is above it.
4. Seams, the picker and everything else that reads where a slot ends read the
   slot's effective end (below), not every end the figure knows.
5. The system back button (Android back, browser back) closes an open slot or
   leaves selection mode before it leaves the page (asked for during this
   design; it belongs to the routine-lift work).

## Non-goals

- No change to a figure's own page or its positions.
- Embedded-routine slots: no end choice (their ends are the child routine's, as
  today).
- The player does not speak or show the end.
- No end choice for a figure with a single end or none.

## Anti-goals (a failure even if it works)

- A new warning where nothing is chosen. A slot with several ends and no
  choice behaves exactly as today, apart from its dashed chip.
- Writing a choice the person did not make. "Decided by the slot below" is
  computed on read, never stored.
- Anything that jumps under the finger (the routine-lift "Nothing jumps" rule
  holds for the chips and the sheet).

## How it works

### Stored

`routine_steps.end_position_id` — integer, nullable, references `positions.id`.
Additive `ADD COLUMN` (no CHECK, hard rule); `npm run db:generate`; read the
generated SQL. Null: nothing chosen. The table is already synced and its
change-log triggers are row-level, so no trigger migration is needed. The phone
gets the column the way 0050's `length_counts` reached it (follow that
commit's path).

Invariant, in the data function (`src/lib/server/routines.ts`), not the
schema: a written end is a live position that every option of the slot can
end in. A write that breaks it is refused, with a refusal worded in both
catalogs (`refusals-guard.spec.ts`). An options slot only; an embedded
routine's slot refuses.

**Which id is stored, and how it compares** (my call). The stored id is a real
`positions.id`: the main option's own end tag (`figure_end_positions` of the
slot's first option, `MAIN_FIRST`), never the graph's canonical id. It is
compared by family on read: through the same canonical map `buildGraph` uses
(`canon`, twins merged), so a choice survives twinning and a main figure
swapped for one whose tag is a twin of the same hold. A person's routine may
hold a group's figure, so the stored position may be a group's: it must be a
position the routine's owner may use (`usableOf`), and `integrity.ts` gets a
`REFS` entry (`routine_steps` → `positions`, "slot end") so `crossRefs` stays
`[]`. A copy maps it with `m.ref('position', …)` from that real id.

A stored end that later stops being valid (the figure's ends were edited, the
position archived, an option added through a path that does not check) is
ignored on read — treated as null — and left in place. Never rewritten.

### Effective end (pure, `src/lib/routines/routines.ts`)

For an options slot, with `C` = the ends every option shares (by family; an
option with no ends at all fits anything and does not narrow `C`), and `S` =
where the slot below can start. "The slot below" is the next danceable row,
the same row the seams compare against (`positionSeams` / `rowEdges`): an
embedded routine below counts with its own starts, a row the seams skip is
skipped here too (my call). `C` is "unknown" (null, as `slotEnds` returns
today when options disagree) when the options have ends but share none; then
no seam lights and nothing can be chosen (state `open`, the sheet shows every
end disabled with its reason).

1. `C` empty (no positions): `[]` — anything follows. No choice.
2. `C` has one position: that one. No choice.
3. `S` is exactly one position `p` and `p ∈ C`: `[p]`, decided by the slot
   below. No choice (the stored end, if any, is overridden, not erased).
4. A valid stored end `E ∈ C`: `[E]`. Chosen.
5. Otherwise `C`: several, not chosen yet.

Each slot also gets its state, for the UI: `none` (1), `single` (2), `decided`
(3), `chosen` (4), `open` (5).

This replaces the slot's ends in `RowEdges.ends` (and wherever `slotEnds` feeds
a seam, a run or the routine's own ends: `positionSeams`, `breaks`,
`routineEnds`, `loops`, the picker's `after` / `between` anchors). Rule 3 reads
the raw starts of the slot below, never its effective anything, so there is no
loop. The last slot has no slot below; a routine that loops (`loops`) is not
treated as having one either.

All of this is pure and runs on the phone too (the page reads the phone's
copy), so the graph handed to the routine lib carries each slot's stored end.

### Alternatives

Today every option of a slot must have the same set of ends (`sameSet`,
enforced on write at `src/lib/server/routines.ts` ~1106 and in the picker,
`src/lib/routines/fit.ts` ~175).

With a chosen (or decided) end `E`, an alternative fits when `E` is among its
ends and its counts fit as today; its other ends do not matter. Without one,
the rule stays `sameSet`. (My call: it follows from "all alternatives end in
the same end".) `C` above is then the intersection of the options' ends.

Keeping that safe when the choice goes away (my calls): because `C` is the
intersection, an alternative admitted for `E` keeps `E` in `C` whatever
happens to the choice afterwards. Clearing the choice, the slot below no
longer deciding, or a stale stored end all leave `C` ⊇ {`E`}: the slot reads
`single` (only `E` shared) or `open` (pick again), never a new warning. No
implicit write, no refused clear. Only a figure edited to drop `E` can empty
`C`; then it is unknown (null) as above. An alternative with no ends fits any
chosen end.

### Copies and groups

- A group slot's end write calls `logChange` in its transaction and is listed in
  `MUTATIONS`; the save carries `seen` for the field.
- Copying a routine maps the end with the clone's position map (`m.ref('position', …)`
  in `src/lib/server/clones/clone.ts`); flowing / Keep in step carries it like
  `routine_step_options.length_counts` does (`snapshot.ts`, `apply.ts`,
  `trees.ts`); the clash fingerprint (`src/lib/clash/clash.ts`) counts it, as
  it counts lengths. A position with no member in the target place copies as
  null.
- The form action is classified in `src/lib/offline/routes.ts` like the length
  action (a device write, replayed through `/api/sync/push`).
- The AI connector's `get_routine` shows each slot's chosen end (as 841ebf9e
  added slot lengths). No new propose action.

### The slot's line (`SlotCard`, board »Izbrano · samo konec«)

`counts · <end>`, and for the first slot `counts · <starts> → <end>`.
`<end>` by state:

- `chosen`: a chip, the length chip's look (`LENGTH_CHIP`), with the end icon
  (an arrow into a bar), the position's name and a chevron. Tap: the end
  sheet.
- `open`: a dashed chip, »Konča?« / "Ends?", with a chevron. Tap: the end sheet.
- `single`, `decided`: the end icon and the name in the accent text colour,
  not a button.
- `none`: nothing (`counts` alone).

The end comes before the length chip. Neither is cut by the line's ellipsis;
a long position name truncates inside its own chip (builder picks the max
width). Selected and dimmed states follow the existing line colours.

### Open slot (board »Tap na mesto«)

As the routine lift (T3): the chips leave the line, the end stays as accent
text. The toolbar gets an `end` cell after `length`, only in states `chosen`
and `open`: the end icon, and the chosen name (truncated) or »Konča?«. Order:
length, end, alternative, before, after. `openTools` in
`src/lib/routines/tools.ts` grows the cell.

### The end sheet (boards »Tap na čip konca«, »List Kje konča?«)

`EndSheet.svelte`, beside `LengthSheet.svelte` and like it a small `Sheet`:

- Title »Kje konča?« / "Where does it end?"; sub: figure label · »mesto n« /
  "slot n".
- One full-width button per end of the main figure, in the figure's order.
  The current effective end is pressed (check mark).
- An end that some alternative of the slot cannot end in: disabled, with the
  line »Alternativa X ne konča tu« / "Alternative X doesn't end here".
- An end the slot below cannot start in: selectable, with the warn-coloured
  line »Mesto n ne začne tu« / "Slot n doesn't start here".
- Tap: saves, closes. When an end is chosen, a quiet text button at the foot
  clears it (»Ne izberem — katerikoli konec« / "No choice — any end").

When a figure is added to a slot (picker) and the new slot's state is `open`,
the end sheet opens right after How long? (or alone when the length is not
free). Not when the slot below decides it.

### Seams

Unchanged in look. They compare the effective end, so a chosen `Open` above a
slot that starts only in `Closed` shows the warning naming `Open` and the
slot's starts.

### Back button

While a slot is open or the page is in selection mode, back closes it / leaves
selection and stays on the page; a second back leaves. Use the shallow-routing
pattern the sheets already use (`src/lib/sheets/history.svelte.ts`,
`sheetStack`); an open sheet on top keeps closing first.

## Constraints (from CLAUDE.md, the ones this touches)

- Words through `t()`, both catalogs, Slovenian vikanje; `no-english.spec.ts`.
- `mintedId` is not involved (no new table). No CHECK. `serverNow()` only.
- A group mutation: `logChange` + `MUTATIONS`; `seen` on the field.
- Every write classified in `src/lib/offline/routes.ts`; device-first: the page
  reads from the phone's copy, so the effective end must be computed in the
  pure lib, not only server-side.
- Raise `PAGE_EPOCH` only if an older open page would break against the new
  load shape (builder judges; the flexible-figures work raised it to 14).
- `docs/features.md`, `docs/layout.md`, the routines spec
  (`2026-09-24-routines-design.md`) and the editor spec get the change.

## Left to the builder

- The chip's max width and how a long name truncates.
- Whether the end sheet reuses `LengthSheet`'s shell or is its own.
- The end icon (any stroke icon in the set that reads "arrives at"; the board
  uses an arrow into a bar).
