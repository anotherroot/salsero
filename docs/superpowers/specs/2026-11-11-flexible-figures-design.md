# Flexible figures: several start counts, a length set in the routine

Status: agreed with the user 2026-11-11 (brainstorm). Board with today's screens
and the mockups: https://claude.ai/artifact/SnZPtZTpEREenzVP3uFwVp — boards 1
(figure page) and C (setting the length) are the chosen looks; 2A, 2B, A, B, D
were set aside.

## Why

A figure today has one start count and one length (`figures.start_count`,
`figures.length_counts`). Some figures are not a fixed shape but a state you
stay in: a basic, a shadow basic, walking in cradle, the slow walk that steps on
1-3-5-7. They can begin on more than one count and last as long as the dancer
likes. To say "walk 4 counts, then the wave on 5" or "walk 8, then the wave on
1", the user now has to make a new figure per start and per length. The bachata
data shows it: the move "Basic step" holds six figures (1-8, 1-4, 5-8 and the
same three closed) that are one basic with a different start and length.

The user's words: "it doesn't make sense to me to make a new figure for stepping
for 8 beats instead of 4."

## What it is

Two independent settings on a figure, each off unless the user turns it on:

1. **Can start on** — a set of counts (1–8), not one count. The user taps the
   counts the figure works from: one (as today), several (1 and 5), or all.
2. **Length: You choose** — the figure's length is not fixed; it is chosen per
   use **in a routine**. Outside routines nothing changes.

### Goals

- One figure covers every start and length it is really danced in; the six
  Basic step figures could become two (Open, Closed).
- Building a routine adds up on the count: a slot's start follows from the slot
  before it, its length comes from the routine, and the next slot's start
  follows from that.

### Non-goals

- **The player still plans in whole 8-counts.** A routine run gives every
  figure at least one full eight and calls the next figure on a 1, as today
  (`routinePlan` / `eightsSpan` / `PlanStep.eight`). Calling figures on the count
  they start (a wave on 5) is a separate idea, written in the project's note
  (2026-11-11). This design must not make that later change harder: keep the
  slot's start count and length available in what the plan is built from.
- No merging of existing figures. The user tidies the six Basic step figures up
  by hand once this exists. No migration of data beyond new columns.
- No length limits or step sizes per figure (no "grows by 2 counts"). The sheet
  offers common lengths; Other takes any whole number the form already accepts
  (1–64, `MAX_LENGTH_COUNTS`).
- Setting the length anywhere but a routine (practising a figure alone, a drill,
  the figure page) — not wanted.

### Anti-goals (would make it a failure even if it works)

- Figures the user does not touch behave or read differently from today.
- A routine refusing a save because the counts don't line up. Timing is reported
  (a timing break), never refused, as now.
- An extra step for fixed-length figures when adding them to a routine.

## The figure

**Board 1.** In the figure's Timing (`FigureTiming.svelte`, figure page):

- "Starts on" becomes **"Can start on"**: the eight counts as toggle buttons
  (`aria-pressed`), any number on, never zero (the last one on can't be turned
  off). A text button **All** turns all eight on; with all on it reads **Only 1**
  and goes back to just 1. The line above sums it up: "Starts on 1",
  "Starts on 1 or 5", "Starts on 1, 3 or 5", "Starts on any count".
- "Length" gets a **You choose** option beside today's shortcuts (4, 8, 16,
  Other). Its hint: "Set in each routine. Practised alone it runs N counts", N
  being the figure's own length (8 unless set). *(My call, a small change from
  board 1:)* You choose is a toggle independent of the numbers: with it on, the
  number pills stay live and lit, and set that "alone" length. So
  `length_free` and `length_counts` are separate inputs to `setFigureShape`.
- Elsewhere a figure shows its timing as today; where one start count was shown
  it shows the set the same way as the summary line ("1 or 5", "any count"),
  and a You choose length reads "length you choose" (en) where a length was
  shown. Exact wording per place is the builder's, through `t()`.

## The routine

**Board C.**

### Start

A slot's start count is no longer a property of its figure alone:

- The first slot of a routine starts on its figure's **usual start**: the lowest
  count in its set. *(My call; the user did not say. Today's single start is
  that count, so nothing existing changes.)*
- Every later slot starts **where the slot before leaves off** (the existing
  `nextCount` of the slot before), when that count is in the figure's set.
- When it is not in the set, the slot starts on its usual start and the seam
  shows a **timing break**, exactly as `timingBreaks` / `timingSeams` report
  today. A figure whose set is one count therefore behaves exactly as now.
- An embedded routine still borrows its first slot's starts and its last slot's
  next count.

The slot's meta line keeps today's form, `1→5`, with the start it resolved to.

### Length

- A figure with a fixed length takes its own length in a routine, as today.
- A figure with **You choose** takes the length stored on that routine option
  (the figure in that slot). With nothing stored it takes the figure's own
  length.
- **Adding** a You choose figure (Add a slot, or an alternative): after the
  pick, a short sheet titled **How long?** with the figure's name and its start
  ("Basic step · Closed, from 1"), eight big buttons in a 4×2 grid: 2, 4, 6, 8,
  12, 16, 24 (each with "counts" under the number) and **Other** (a number
  field, 1–64). One tap adds the figure at that length; no extra Add button. The
  sheet's ✕ or swipe-down cancels the add. A fixed-length figure skips the sheet
  and is added at once, as today.
- **Changing it**: the slot shows the length as a chip after the timing,
  `1→5 [4 counts ▾]`, on the closed slot (no need to open it). Tapping the chip
  opens the same How long? sheet with the current length filled; a tap saves.
- The chip shows only on You choose options. A slot with several You choose
  alternatives shows one chip per alternative where alternatives are listed
  (open slot); the closed slot shows the first option's chip. *(My call.)*

### Alternatives in a slot

Each alternative keeps its own length. Today `addOption` refuses an alternative
whose next count disagrees with the slot's (`sharedNextCount`). That rule stays,
measured with each option's own start and length: in the How long? sheet for an
alternative, lengths that would land the next slot on a different count are
greyed and say why in one line. *(My call.)*

### When alternatives stop agreeing *(my call, all of this section)*

Because a start now depends on the slot before, ordinary edits further up
(a length, inserting/moving/deleting a slot, a count taken out of a set) can
leave a saved slot's alternatives disagreeing. Nothing is refused:

- Each alternative resolves its own start the same way as the main figure
  (incoming count if in its set, else its usual start). `addOption`'s
  same-start rule compares these resolved starts, not `figures.start_count`.
- A slot whose alternatives cannot all start on the incoming count shows a
  timing break at that seam, as today when the incoming count is not in the
  slot's start counts.
- A slot whose alternatives leave different next counts reads its next as
  unknown (`?`), exactly as `sharedNextCount` does today; the slot after it then
  starts on its usual start and no break is reported out of the unknown slot
  (today's "silent out of an unknown next" rule). So one change cascades only
  until a slot with an unknown next or a fixed-start figure.
- In the How long? sheet, greying applies whenever the slot has other options:
  changing the main option's length greys lengths that would split it from its
  alternatives, the same as for an alternative.

### Embedded routines *(my call)*

Inside a parent, an embedded routine's slots resolve from where the parent
enters it, the same walk `flatten`, the player and `timingBreaks` already use;
its row's `1→5` in the parent is that resolved walk. On its own page it
resolves standalone from its own first slot. The picker (`fit.ts`) and
`canEmbed`/`embeddable` judge a candidate routine from the count it would be
entered on.

### Picking "what fits here" with a You choose figure *(my call)*

A You choose figure can land on any count, so in the picker it fits a "before"
or "between" anchor on the count side whenever its start fits; its length is
settled in the sheet. When the slot is added between two rows, the How long?
sheet pre-selects the shortest offered length that lands on the row below's
start (none pre-selected when no offered length does; Other still works).

### Changing the figure later

- Turning You choose off: routines use the figure's own length again; stored
  slot lengths are kept but not used (turning it back on restores them).
  *(My call.)*
- Removing counts from "Can start on": routines may get timing breaks; reported,
  not refused.

## Elsewhere

- **The player (routine run)**: uses the slot's resolved length when spacing
  the plan (`eightsOf` in `routinePlan` takes the option's length, still rounded
  up to whole eights by `eightsSpan`). A 12-count walk takes two eights.
- **Practising a figure alone, drills, the figure popup's cue**: the figure's
  own length and usual start, as today.
- **Pickers that filter by "what fits here"** (`fit.ts`, the slot picker's
  count filter): a figure fits a count when that count is in its set.
- **Groups and copies**: a group routine's slot lengths are group data like the
  rest of the routine (logged with `logChange`, `seen` on the field). Copying a
  routine (`copyTo`, clones, Keep in step via `flowing`/`flowAfter`) carries
  each option's length; copying a figure carries its start set and the You
  choose setting.
- **Offline**: the new columns live on tables already synced
  (`figures`, `routine_step_options`); writes that set them go through the same
  data functions on the device as their tables' other writes do today.
- **AI connector** (`/mcp` read tools): `get_figure` reports the start set and
  whether the length is chosen in routines; `get_routine` reports each option's
  length when it has one. No new propose actions. *(My call.)*
- **Words**: every new string in en and sl through `t()`; Slovenian per the
  glossary (vikanje, `slCount` for "N counts").

## Data (the parts decided)

Additive columns only (hard rule: no CHECK, no rebuild; invariants in the data
function):

- `figures.start_counts` — the set of counts a figure can start on. Null reads
  as `{start_count ?? 1}`, so every existing figure keeps its one start.
  `start_count` stays and holds the usual start (lowest of the set) for every
  reader that needs one count. How the set is stored (e.g. an 8-bit mask) is the
  builder's choice.
- `figures.length_free` — whether the length is chosen in routines. Null reads
  as off.
- `routine_step_options.length_counts` — the option's length; null reads as the
  figure's own length. Only meaningful when the figure's length is free.

`setFigureShape` (`src/lib/server/graph.ts`) enforces the set (non-empty, 1–8)
and the length range, as it does for the single start today.

## Left to the builder

- Storage shape of the start set; names of the new fields in `GraphFigure` and
  the routine helpers (`slotStartCounts`, `sharedNextCount`, `rowEdges`, `fit.ts`
  take the per-option start and length).
- Exact copy of summary lines and hints, and the Slovenian words.
- Whether the sheet is a new component or a mode of an existing one; it follows
  the existing Sheet look (board C).
- Specs: pure timing logic (start resolution, next count with a slot length,
  breaks) in `src/lib/routines` / `src/lib/graph` specs; the data functions with
  `openDb(':memory:')`; screenshots of the figure page and a routine with a
  You choose slot against board 1 and C.
- Update `docs/features.md` and `docs/layout.md` when it ships; this spec joins
  the routine and figure specs in the features index.
