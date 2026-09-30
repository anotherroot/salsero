# Figure timing, variations, and the visual routine — design

> **Status:** approved in brainstorming, 2026-09-29. Extends
> [`2026-09-24-routines-design.md`](2026-09-24-routines-design.md), which stays
> the design for positions, the graph and routines; this document owns figure
> timing, figure variations, the figure page's layout, and what a routine run
> shows in the player. It **changes** three things that document says: slot
> "variants" are renamed **alternatives**, `figures.eights` gives way to
> `length_counts`, and a routine run no longer calls figure names.
>
> **Slices 1 (timing and one edit mode) and 2 (variations) are live.** Slice 3
> is not built yet.

## Purpose

Three things a dancer knows about a figure that the app could not say:

1. **Not every figure is one 8-count from "1".** A turn can take four counts; a
   figure can begin on 5. Until now the only timing was `eights`, a whole
   number of 8-counts, and every figure implicitly started on 1.
2. **One figure is danced several ways.** Enchufla from open, enchufla doble,
   enchufla from a cross-hand hold: the same figure to the dancer, but each
   version can start and end in a different handhold, take a different number
   of counts, have its own directions and its own video. Recording them as
   separate figures clutters the library and Today with things that are not
   practised separately.
3. **A routine is a timeline, not a list of calls.** Hearing "enchufla" while
   dancing a routine you built is noise; what helps is seeing which figure you
   are on and on which count, and what comes next.

And one thing that was simply awkward: the figure page had an Edit mode for
name and notes, a separate always-open positions form with its own "Save
positions", and an upload button at the bottom. Variations would have tripled
that. The page gets one edit mode.

## Decisions taken in brainstorming

- **Length is in counts, not steps.** Salsa takes six steps in eight counts and
  bachata differs again; counts are the same unit for every dance and the one
  the beat grid already speaks.
- **A variation lives under its figure.** It is never its own exercise and never
  appears on Today. Practising "Enchufla" covers its variations.
- **The drill ignores variations.** It keeps calling base figures, on "1",
  exactly as now.
- **A routine run stops calling.** The count, the clave and the recorded count
  voice keep playing; figure names are shown, not spoken.
- **A variation is a figure row with a parent** (approach A below), and routine
  slot "variants" are renamed **alternatives**.
- **Version tabs** on the figure page, not a page per variation.

## Approaches considered for storing variations

- **A — a child row in `figures` (chosen).** Everything that works per figure id
  keeps working per variation: `figure_start_positions`, `end_position_id`,
  recordings and their upload route, the graph, and — the deciding point —
  `routine_step_options (step_id, figure_id)`. Choosing a variation in a routine
  is choosing its figure id; the options table needs no change. The cost is that
  every list meaning "figures" must now exclude variations.
- **B — a `figure_variations` table.** Keeps variations out of figure lists by
  construction, but duplicates the position and recording machinery, and a slot
  could not hold two variations of one figure: the options table's primary key
  is `(step_id, figure_id)`, and changing it is a table rebuild — which the
  CHECK/rebuild rule in `CLAUDE.md` exists to prevent.
- **C — a JSON column on the figure.** Cheapest, but a variation could not own a
  recording, and nothing could query its positions.

## Data model

All additive `ALTER TABLE figures ADD COLUMN`s. No CHECK, no rebuild — `figures`
has incoming foreign keys, so a rebuild is impossible here (see the
`figures.style` note in `schema.ts`).

```
figures
  + parent_id       integer REFERENCES figures(id), nullable
                    -- set on a variation; null on a base figure
  + start_count     integer, nullable     -- 1..8; null reads as 1, or the
                                          -- parent's value on a variation
  + length_counts   integer, nullable     -- counts the figure takes; null
                                          -- reads as 8, or the parent's value
                                          -- on a variation
    eights          VESTIGIAL from here on (see below)
```

**The backfill.** The migration runs `UPDATE figures SET length_counts = eights *
8` for existing rows, so every existing figure keeps exactly its current length.
An `UPDATE` in a migration is data, not structure, and triggers no rebuild. A
base figure created afterwards gets `length_counts = 8` from `createFigure`.

**`eights` is vestigial, not dropped.** Dropping a column is a rebuild. Nothing
reads it after this change; the drill derives its spacing from `length_counts`
(`ceil(length / 8)` 8-counts). The schema comment says so, in the same words as
`figures.style`'s: do not "clean this up".

### A variation's fields

| Field                        | On a variation                                           |
| ---------------------------- | -------------------------------------------------------- |
| `name`                       | its own ("Doble"); unique among its parent's variations  |
| `notes`                      | its own — shown as its **directions**                    |
| start positions (join rows)  | its own; **no rows means the parent's**                  |
| `end_position_id`            | its own; **null means the parent's**                     |
| `start_count`                | its own; null means the parent's                         |
| `length_counts`              | its own; null means the parent's                         |
| recordings                   | its own, through the existing upload route               |
| partner, style, callable, call text | the parent's, always — not editable on a variation |
| links, "Taught in", practice | the parent's, always                                     |

Note the one asymmetry with base figures: on a **base** figure, no start rows
and a null end mean the dance's **neutral** position (the routines design's
"untagged means neutral"). On a **variation** they mean **the parent's**, which
in turn may be neutral. To say "this variation ends in neutral while its parent
ends in hammerlock", pick the neutral position explicitly — it is a real row.

**Resolution happens once, in the data layer.** `buildGraph` resolves each
variation against its parent before handing rows to `src/lib/graph/`, so the
pure layer sees every figure with concrete starts, end, start count and length,
and never learns that variations exist — the same way it never learns dances
exist.

## Rules

- **One level.** A variation cannot have variations. `createVariation` refuses a
  parent that has a parent. There is no CHECK; the data function is the
  enforcement, as it is for `exercises.lesson_id`.
- **Same dance as the parent**, set by `createVariation` from the parent, never
  from the form. Because a variation carries a real `dance`, every existing
  check that compares a figure's dance — the figure page's own, and the routine
  and lesson linkers' — covers it unchanged. The recordings upload route is
  flat and keyed by figure id, exactly as it is for a base figure today.
- **A variation never gets an exercise.** `createVariation` inserts no exercise
  row. `exercises_source_ck` (`(source = 'figure') = (figure_id is not null)`)
  is unaffected: no exercise row points at a variation.
- **Archive, don't delete.** Archiving a figure archives its variations in the
  same transaction. A variation can be archived by itself. A routine slot
  holding an archived variation behaves exactly as a slot holding an archived
  figure does today.
- **Variations are not figures, for every list.** `listFigures` excludes
  `parent_id is not null` by default. So do `listCallableFigures` (the drill
  pool), the lesson figure picker and the "tagged 6/41" count. Each gets a test, because a missed filter leaks
  variations somewhere silently. The write side matches: the lessons
  `linkFigure` refuses a variation id posted by hand — a lesson teaches the
  figure, and the variation is reached through it.
- **The graph includes variations.** A variation is a real way to move between
  positions, so the gap report and the routine algebra count it. The positions
  page IS the gap report, so its in/out counts include variations — a
  variation that leaves hammerlock is a real way out. (An earlier draft of the
  rule above listed "the positions page's counts" among the exclusions; that
  contradicted this rule and was corrected when slice 2 shipped.) The drill
  cannot be affected: `graphFlow.pick` filters the **pool** by the graph, not
  the other way round, and the pool excludes variations.
- **Nothing derived is stored**, as before: a version's effective values, its
  next count, a routine's timing breaks — all recomputed per request.

## Timing algebra

Pure, in `src/lib/graph/`. `GraphFigure` gains `start: number` (1..8) and
`length: number` (counts), both already resolved; `eights` is removed from it.

```
nextCount(f) = ((f.start - 1 + f.length) mod 8) + 1
```

The count the **following** figure should start on:

| start | length | next |
| ----- | ------ | ---- |
| 1     | 8      | 1    |
| 5     | 4      | 1    |
| 1     | 4      | 5    |
| 1     | 16     | 1    |
| 3     | 6      | 1    |

`src/lib/routines/`:

- **Alternatives agree on where they land.** Adding an alternative to a slot is
  refused unless it shares the slot's end position (as today) **and** its
  `nextCount`. Interchangeable means same landing, in the hands and on the
  count.
- A slot's **start counts** are the union of its alternatives' start counts,
  exactly as its start positions are the union of theirs.
- An embedded-routine slot borrows the child's first start counts and last
  `nextCount`, as it already borrows positions.
- A **timing break** is `nextCount(slot i) ∉ startCounts(slot i+1)`. Reported
  alongside position breaks, never refused.
- **Loops** only when the end position is among the first slot's start
  positions **and** the last `nextCount` is among its start counts.

Existing data is unaffected: every existing figure resolves to start 1 and a
multiple of 8 counts, so every `nextCount` is 1, every existing slot agrees, and
no existing routine gains a timing break.

## The figure page

Version tabs under the header: **Basic** (the figure itself), each variation by
name, and **+** to add one. The selected tab is `?v=<variationId>` in the URL,
so a reload or a shared link lands on the same version.
`/[dance]/figures/<variationId>` redirects to its parent with `?v=` set, so a
variation's id never 404s.

**View mode**, for the selected version:

- a summary: "Starts on 5 · 4 counts", "Cross-hand → Open two hands", with
  "(as Basic)" beside any value a variation inherits;
- directions (`notes`);
- Videos, with **+ Add video or audio** always available — filming a figure
  right after class is the common case and should not need Edit;
- "Follows from / Leads to" for that version; a variation is listed as
  "Enchufla · Doble".

Shared across tabs, whichever is selected: the Practice card, Links, "Taught in".

**Edit mode**, one form, one Save:

- on Basic: name, partner, style, callable, call text, directions, start
  positions, end position, start count, length;
- on a variation: name, directions, start positions, end position, start count,
  length — each position and timing control has a "Same as Basic" choice;
- deleting a video, and archiving (the figure, or this variation), live here
  only.

The separate positions form and its "Save positions" button are removed; the
`positions` action folds into `update`. **Start count** is a row of 1–8 chips;
**length** is a counts input with 4 / 8 / 16 shortcuts. The "Eight-counts"
field is removed.

## The routine editor

- **Adding a slot** picks a figure, then — only if it has variations — a
  version: Basic, Doble, From cross… When adding an **alternative**, only
  versions whose end position and `nextCount` match the slot are offered.
- A slot row reads **"Enchufla · Doble · 5→1"**: its start count(s) and next
  count, so the timeline is readable without opening anything.
- "Variants" / "+ Variant" become **"Alternatives" / "+ Alternative"**,
  everywhere in the UI and in code comments. Table and column names do not
  change.
- The existing position-break marker gains a timing marker: "ends ready for 1,
  next starts on 5". A warning, never a refusal.
- "Does not loop" uses the timing-aware rule above.

## The player, running a routine

**No calls.** A routine run hands the scheduler an empty call plan. The count,
the clave and the recorded count voice play as before; none depended on calls.
The "call every N" control is hidden for a routine run — there is nothing left
for it to govern. The drill is unchanged: it calls, ignores variations, and
starts every figure on "1".

**`routineTimeline(steps, shape, graph, throughBeat, rand)`** in
`src/lib/routines/`, pure, replaces `routinePlan` for routine runs. It returns
`{ beat, figureId, length }[]`, `beat` being an absolute count index into the
song:

- the first figure starts after the existing lead-in (`LEAD_IN_8S`), on its own
  start count — a figure starting on 5 begins on count 5 of the first bar;
- each next figure starts at `previous.beat + previous.length` when the timing
  agrees; across a timing break it waits for the next occurrence of its start
  count, so a figure is never shown starting on the wrong count, and the wait
  shows as a short free stretch;
- alternatives are chosen once per step, with the same incoming-position filter
  `routinePlan` uses;
- extended the way `extendPlan` and `routinePlan` are — called again as the
  horizon grows, the existing prefix is the cursor, and **a step once produced
  never changes**;
- loops when the song outlasts the routine.

**On screen**, driven by the song's current beat:

```
Now   Enchufla · Doble
      ● ● ● ○ ○ ○ ○ ○      count 3 of 8
Next  Setenta · on 5
```

The dots are the current figure's own counts, not the bar's — a four-count
figure shows four. The slot list below still highlights the active slot. Works
over a song and in count-only mode alike, since both run on a beat grid. Saving
a finished run as a set is unchanged.

`routinePlan` is deleted once nothing calls it; its spacing rule
(`max(every, eights)`) existed only to keep calls danceable.

## Slices

Each deploys on its own, in this order.

1. **Timing and one edit mode.** `start_count`, `length_counts` and the
   backfill; the figure page's single Edit form with positions and timing
   folded in; the timing algebra, timing breaks and timing-aware looping in the
   routine editor; the Alternatives rename; the drill spacing from
   `length_counts`. Useful before any variation exists — "starts on 5, 4
   counts" can be set on existing figures and breaks show at once.
2. **Variations.** `parent_id`; resolution in `buildGraph`; version tabs;
   create, edit and archive a variation; recordings per variation; the list
   exclusions; choosing a version in the routine editor.
3. **The visual routine.** `routineTimeline`; no calls on a routine run; the
   Now/Next display; the call-rate control hidden.

## Testing

Test-first, pure and data layers, as the rest of the repo. No route or
component tests.

- **Timing algebra:** `nextCount` on the table above, including wrap-around and
  lengths over 8; start-count unions; timing breaks beside position breaks;
  timing-aware `loops`.
- **Resolution:** each inherited field inherits when unset and overrides when
  set; "no start rows" means the parent's on a variation and neutral on a base
  figure.
- **Data rules:** one level only; unique names within a parent; same dance as
  the parent; archiving a figure archives its variations; no exercise for a
  variation.
- **List exclusions:** the library, the drill pool, the lesson picker, the
  tagged count each exclude variations — one test apiece; the gap report
  counts them.
- **Alternatives:** `addOption` refuses a mismatched end position or
  `nextCount`.
- **`routineTimeline`:** first figure on its start count after the lead-in;
  lengths chaining with no gap; waiting for the start count across a break;
  looping; stability as the horizon extends; determinism under a seeded
  `rand`.
- **Migrations:** read the generated SQL before committing; run it against a
  copy of the real database and confirm the backfill, as lessons did.

## Known gaps

Accepted in brainstorming, recorded so they are not hunted as bugs.

- **The drill calls every figure on "1"**, including one whose start count is 5.
  The drill was deliberately left alone; honouring start counts there means
  moving its plan from 8-counts to counts.
- **The drill never calls a variation.** A variation reachable only from a
  position its base figure does not start from is invisible to the drill.
- **Editing a figure's timing or end position does not re-check the routine
  slots it already sits in.** Alternatives agree when added; a later edit can
  make them disagree. The editor shows the resulting break, the same way it
  already treats a position edit.

## Documentation this changes

- [`2026-09-24-routines-design.md`](2026-09-24-routines-design.md): a status
  note pointing here; "variants" → "alternatives" where it describes slots;
  `eights` → `length_counts`; "Playing a routine" notes calls are gone.
- [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md): a pointer
  here from the figures and phase-3 text.
- `CLAUDE.md`: the live line, and a hard rule — **a variation is a `figures` row
  with `parent_id`; every list of figures excludes it; it never has an
  exercise.**
