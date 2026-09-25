# Routines and the figure graph — design

> **Status:** approved in brainstorming, 2026-09-24. Extends
> [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md), which
> stays the overall design; this document owns positions, the figure graph,
> routines, and what they do to the player's figure calls. It **replaces** that
> document's "Choreographies (phase 3)" section and the `choreographies` /
> `choreo_steps` sketch in its data model.

## Purpose

Phase 3, reframed. The original sketch was a sequence of figures, optionally
pinned to a song's 8-counts. What is actually wanted is the thing underneath a
sequence: **which figures can follow which**, so that

1. the player's random drill calls a sequence you can physically dance,
2. a figure page answers "I am in hammerlock — what do I know from here?",
3. a routine can be built by picking from figures that fit rather than from all
   of them, and
4. the app can say which corner of the repertoire is a dead end, which is the
   "what should I learn next" answer.

The mechanism is **positions**. A figure starts at one or more handholds and
ends at exactly one. Tag those and the graph exists; nothing is hand-listed
pair by pair.

Song-bound choreography is **out of scope** — see
[Deliberately not included](#deliberately-not-included).

### Why positions rather than figure-to-figure links

Marking "what may follow this figure" on each figure is O(n²) by hand: a
repertoire of a few dozen figures is already over a thousand decisions, which
will never be made, and the knowledge does not generalise to the next figure
learned. Two dropdowns per figure is O(n) and the graph falls out of it.

It also matches the dance. A figure's real contract is *handhold in → handhold
out*, and that contract is what a dancer already carries in their head.

Where the value concentrates is worth saying plainly, because it sets
expectations: in casino most figures run neutral-open → neutral-open, so for
the bulk of a repertoire the graph restates what you already know. It earns its
keep on the minority that leave you in hammerlock, shadow or a cross-hand hold
— which are exactly the ones that go blank mid-dance.

## Two slices

Each is independently deployable and useful, the same rule the phases follow.

- **3a — positions and the graph.** The `positions` table, tagging on the
  figure page, `src/lib/graph/`, "Follows from" / "Leads to", the gap report,
  and the drill's walk. This is the slice that fixes the drill that already
  exists.
- **3b — routines.** `routines`, slots, variants, one-level embedding, the
  auto-created exercise, and playing a routine through the player.

3b reads the graph and never reshapes it, so 3a does not have to anticipate it.

## Data model

### 3a

```
positions                       -- the handhold vocabulary. Content, not code
  id            integer pk
  dance         text not null default 'salsa'
  slug          text not null      -- stable: 'open-two', 'hammerlock-r'
  name          text not null      -- shown; renameable
  neutral       integer not null default 0   -- exactly one per dance
  sort_order    integer not null default 0
  archived_at   integer, nullable
  created_at    integer
  unique (dance, slug)

figure_start_positions          -- many starts per figure
  figure_id     fk figures
  position_id   fk positions
  primary key (figure_id, position_id)
  index on (position_id)

figures.end_position_id   ADD COLUMN integer REFERENCES positions(id)
figures.eights            ADD COLUMN integer not null default 1
                          -- how many 8-counts the figure takes to dance
```

### 3b

```
routines
  id            integer pk
  dance         text not null default 'salsa'
  name          text not null
  notes         text, nullable
  archived_at   integer, nullable
  created_at    integer

routine_steps
  id                integer pk
  routine_id        fk routines not null
  position          integer not null          -- 0-based
  child_routine_id  fk routines, nullable     -- an embedded routine
  note              text, nullable            -- "hand change here"
  unique (routine_id, position)

routine_step_options            -- the variants filling one slot
  step_id       fk routine_steps
  figure_id     fk figures
  primary key (step_id, figure_id)

exercises.routine_id   ADD COLUMN integer REFERENCES routines(id)
```

Every added column is a nullable `ALTER TABLE ... ADD COLUMN`, and
`exercises.routine_id` deliberately has **no** mirror of
`exercises_source_ck`: a new CHECK on that table makes drizzle-kit rebuild it
and the rebuild fails at migrate time. The invariant
`source = 'routine'` ⟺ `routine_id is not null` lives in the data function
instead. `exercises.lesson_id` is the precedent, including the comment. Read
the generated SQL before committing it.

Two migration mechanics, both of which migration 0004 already demonstrates for
lessons: the slices generate **separate migrations**, since they deploy
separately; and within 3b's, `routines` must be created before the
`ALTER TABLE exercises ADD routine_id` that references it.

## Rules

- **A position vocabulary is rows, not a registry.** `DANCES` is code because
  count and clave positions are code-shaped — a database row could not carry
  them. A handhold vocabulary is the opposite: it grows the week a new hold is
  learned and it differs between schools. Seeded at boot per dance when that
  dance has none, idempotently, the same shape as the admin seed.
- **`neutral` is a flag on the row, not a constant in the registry**, because
  the neutral genuinely differs per dance: salsa's is open-two-hands, bachata's
  is closed. "Exactly one per dance" is cross-row and so cannot be a CHECK; the
  data function enforces it, as the song/count pairing does.
- **Many starts, one end.** Entry is plural — enchufla works from open or from
  a cross-hand hold. The end must be singular or the walk cannot know where it
  has landed. The rule that follows: *if a figure ends differently depending on
  how it is finished, that is two figures* — which is also how it becomes a
  variant of itself in 3b.
- **Untagged means neutral, and that lives in the pure layer.** No start rows
  reads as `{neutral}`; a null `end_position_id` reads as neutral. So there is
  no backfill migration and nothing to run against production: an untagged
  repertoire is a correct-by-default hub, `figures.eights` defaults to 1, and
  every existing figure behaves exactly as it does today. Only the corners get
  tagged.
- **Nothing derived is stored.** Which figures follow which, a routine's start
  and end, whether it has breaks, whether it loops, where the dead ends are —
  all recomputed per request. Same rule as urgency, for the same reason.
- **Within a slot, agreement is enforced; between slots, a break is a
  warning.** See [The variant algebra](#the-variant-algebra).
- **Creating a routine creates its exercise** in one transaction, renaming
  renames it, archiving archives it — the rule figures and lessons already
  follow. `archiveExercise` and `updateExercise` stay restricted to
  `source='custom'`, so a routine's exercise can only be changed through its
  routine.
- **Archive, don't delete — for the entities.** Positions and routines get
  `archived_at`. An archived position stays referenced by the figures tagged
  with it, so history and existing routines keep meaning. A **slot, an option
  and a start-position tag are structure, not entities**: they are edited and
  hard-deleted freely, the way a song's anchors are. Nothing points at them and
  no set refers to them, so there is no history to keep.

## Positions

The seed, which is a starting point to edit rather than a fixed vocabulary:

| Dance   | Positions                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Salsa   | open two hands *(neutral)*, open one hand, closed, cross-hand, hammerlock follower's-right, hammerlock follower's-left, shadow, cuddle, back-to-back |
| Bachata | closed *(neutral)*, open two hands, open one hand, cross-hand, hammerlock, shadow, side-by-side                                                                  |

The granularity is deliberate, and both directions are wrong in a way worth
recording:

- **Coarser** (open / closed / cross-hand / hammerlock / shadow) collapses most
  of the repertoire to open → open, so the graph mostly restates what is
  already known.
- **Finer** (which hand holds which, arms over or under, facing) fragments it:
  every position ends up with one way in and one way out, most figures need
  several start positions to stay reachable, and the walk dead-ends constantly.

Medium — which arm is behind the back matters, one hand versus two matters, the
exact hand permutation does not — keeps several figures entering and leaving
each position, which is what makes a walk possible.

Floor rotation and who-stands-where are **not** part of a position. Salsa
figures do not care, and modelling them would double the vocabulary for
nothing.

## `src/lib/graph/`

Pure and client-safe. Like `day/` and `urgency/`, it never learns that dances
exist — the data-access layer scopes before it is called.

```ts
interface GraphFigure { id: number; starts: number[]; end: number | null; eights: number }
interface Graph { neutral: number; figures: GraphFigure[] }

startsOf(g, f)        // f.starts, or [g.neutral] when empty
endOf(g, f)           // f.end ?? g.neutral
figuresFrom(g, pos)   // what can be danced from here
figuresTo(g, pos)
follows(g, figureId)  // figuresFrom(endOf(figure)) — the figure page's list
precedes(g, figureId)
deadEnds(g)           // ≥1 figure ends here, none starts here
orphans(g)            // ≥1 figure starts here, none ends here
```

A position with nothing on either side is neither: it is simply unused, and the
gap report lists it as such rather than as a fault.

3b adds the routine side: a routine's start positions and end, its breaks,
whether it loops, and `routinePlan`.

## The drill walks the graph

Today `pickFigure` picks uniformly from the pool and the only rule is "not the
same as last", so the player will call a figure that starts in hammerlock while
your hands are in open position. That is the nonsense this removes.

The change rests on one observation: **the current position is derivable from
the last plan step** — the last figure's end *is* where the hands are. So the
walk needs no hidden state and `extendPlan` stays pure and re-entrant exactly
as it is, which matters because it is called again on every tick to grow a plan
that must never change a call already announced.

`extendPlan` takes one new optional argument:

```ts
interface Flow {
  /** `last` is the figure just called, or null at the start of a run. */
  pick(pool: number[], last: number | null, r: number): number | null;
  eights(figureId: number): number;
}
extendPlan(plan, pool, every, throughEight, rand, flow = UNIFORM_FLOW)
```

`graphFlow`'s `pick` derives the current position from `last` itself —
`endOf(last)`, or the neutral position when `last` is null — which is why no
position has to be threaded through `extendPlan`'s signature or held anywhere.

`UNIFORM_FLOW` is today's `pickFigure` with `eights` always 1, so every
existing scheduler test passes untouched and an untagged repertoire behaves
identically to now. `src/lib/graph/` exports `graphFlow(g)` as the other
implementation.

Note the direction of the dependency: **the scheduler declares `Flow`, the
graph implements it.** `src/lib/scheduler/` does not import
`src/lib/graph/`; the wiring happens in `attach.ts`'s caller. The scheduler
keeps deciding what sounds and when, and learns nothing about positions.

Two behaviours to name, or they will read as bugs later:

- **Spacing is `max(callEvery, eights)`.** Calling the next figure one
  8-count after a figure that takes two is wrong. With `eights` defaulting to
  1 this is a no-op on an untagged repertoire.
- **A dead end resets to neutral.** If nothing exits the current position the
  next pick treats the dancer as neutral rather than going silent — which is
  what a dancer does anyway, resolve back to open. The gap report is what keeps
  that from being invisible.

"Not the same figure twice running" survives, with today's escape hatch: when
the only exit from a position is the figure just danced, it is allowed.

There is **no flow on/off toggle** in the player. With nothing tagged the graph
is a single neutral hub and the walk *is* today's uniform random, so the toggle
would do nothing until tagging began; after tagging, the nonsense it removes is
the point. The cost, recorded honestly: once tagged, the drill narrows at each
step, and "call me anything and I will deal with it" is no longer available.

## Routines

A routine is an **ordered** sequence of slots. Each slot holds either one or
more interchangeable figures — the variants — or a single embedded routine.

There is no separate "block" or "subroutine" concept. A block is just a short
routine, so a combo built standalone can be reused later with no conversion,
and practising a three-figure combo is a good practice unit in its own right.
Every routine gets its exercise like a figure does; `active = false` is the
existing lever if Today gets noisy.

### The variant algebra

- All options in a slot **must share one end position**, enforced on write.
  That is what interchangeable means: if picking option B changes where you
  land, B is not a variant, it is a different step.
- A slot's start positions are the **union** of its options', and a run filters
  them by the incoming position. Permissive on purpose — an option that does
  not work from where you are is simply not picked, rather than blocked at
  authoring time. In practice the editor suggests the figures that fit a slot
  from the incoming position, so options added through the UI already agree.
- An **embedded-routine slot** borrows the child's shape: its starts are the
  child's starts and its end is the child's end. So the two slot kinds present
  the same interface to everything downstream, which is the whole reason a
  routine can stand in for a figure.
- A slot must hold **at least one option or a child** — an empty slot is
  rejected on write rather than skipped on read.
- `routine.starts` is the first slot's starts; `routine.end` is the last slot's
  end.
- A **break** is `step[i].end ∉ step[i+1].starts`. The editor shows it and
  saves anyway: this is a personal app and the dancer may know something the
  graph does not.

A slot needs no length of its own. The plan is built per run *after* options
are resolved, so the chosen figure's `eights` is the one that counts.

### Embedding, one level

Adding child C to routine R is allowed iff **C has no embedded steps and R is
not itself embedded anywhere.** Both checks are needed for depth ≤ 2, and with
them cycles are impossible by construction rather than by a cycle check.

### Playing a routine

`routinePlan(routine, graph, rand, throughEight)` → `PlanStep[]`: flatten
children, resolve each slot's options against the incoming position, space by
the chosen figure's `eights`, and loop back to the start when the song outlasts
the routine. Same `PlanStep[]` the drill produces, so the scheduler and
`attach.ts` need no routine-specific code at all.

Looping gives a free diagnostic worth showing on the routine page: *"this
routine does not loop"* when its end is not among its starts.

### `SOURCES` gains `'routine'` and loses `'choreography'`

`SOURCES` already carries `'choreography'` and **no row has ever used it** —
phase 3 was never built. It is a TypeScript-only enum, and
`exercises_source_ck` constrains the figure/`figure_id` pairing without
enumerating source values, so the rename costs no migration and moves no data.
Only `ExerciseRow.svelte`'s label map changes.

## Routing

Everything belongs to a dance; the flat routes are untouched.

```
/[dance]/routines            list, with "does not loop" / has-breaks hints
/[dance]/routines/[id]       detail + slot editor
/[dance]/positions           the vocabulary, plus the gap report
                             (in/out counts, dead ends, orphans)
/[dance]/figures/[id]        gains start/end pickers, `eights`, and derived
                             "Follows from" / "Leads to"
/[dance]/figures             gains a "tagged 6/41" hint
/[dance]/player              opened from a routine, plays it
```

`scope.ts` gains guards for routine and position ids, the same shape as the
figure and lesson guards, so a bachata routine id cannot be reached from
`/salsa/`. New routes are private by default; `PUBLIC_PATHS` is not touched.

## The dance wall

`positions` and `routines` carry `dance`. `routine_steps`,
`routine_step_options` and `figure_start_positions` derive it through their
parents, exactly as the lesson join tables do.

Three cross-dance invariants, in the data functions because none is expressible
as a CHECK:

1. a figure's positions must be of the figure's dance,
2. a routine's option figures must be of the routine's dance,
3. a child routine must be of its parent's dance.

`src/lib/graph/` stays ignorant of all of it.

## Testing

The interesting logic is pure, so that is where the tests are:

- the union / shared-end algebra, and that a break is reported rather than
  refused,
- untagged-means-neutral, in every function that touches a position,
- the walk's determinism under a seeded `rand`, the dead-end reset, and
  `max(callEvery, eights)` spacing,
- that `UNIFORM_FLOW` reproduces today's behaviour exactly,
- the depth-≤-2 embedding rules, from both directions,
- `routinePlan` resolving options and looping.

Data functions take `db` first, so most data-layer tests need no mock and run
against `openDb(':memory:')`. Route-level dance-wall tests follow
`src/routes/[dance]/dance-wall.spec.ts` with `vi.mock('$lib/server/db')` —
never `process.env.DATABASE_PATH`, which silently runs the spec against the
real database. `npm run check` must pass.

## Documentation this changes

- [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md): the
  vocabulary table's **Choreography** row becomes **Routine**; the
  "Choreographies (phase 3)" section and the `choreographies` / `choreo_steps`
  sketch are replaced by a pointer here; the phase 3 line changes.
- `CLAUDE.md`: the Layout block gains `src/lib/graph/`, and the "Live / Not
  built" line moves phase 3 across.

## Deliberately not included

- **Song-bound choreography.** No `song_id` on `routines`, no `start_8` on a
  slot, no timeline editor placing figures while listening. The purpose here is
  social improvisation vocabulary, not a performance piece. Both are additive
  to add later, so nothing is foreclosed.
- **Figure-to-figure overrides.** Neither a hand-listed "these two flow
  beautifully" nor a "the position says yes but my body says no". A named
  routine already expresses the first, and no instance of the second has been
  hit yet.
- **Variants that are routines.** A slot holds figure options or one embedded
  routine, never a choice between two routines.
- **Urgency-weighted calls** — biasing the walk toward figures that are overdue.
  Tempting, and it would tie the drill to the app's core loop, but it makes the
  walk's output depend on the set history, which is a much larger idea than
  this one.
- **Practising a transition as its own exercise.** An edge is nameable, but a
  two-figure routine already covers it.
- **A flow on/off toggle**, for the reason given above.
- **Moving a dance's neutral position.** Enforced in the data layer —
  `updatePosition` accepts and guards the change, refusing to leave a dance
  without one or to promote an archived row — but no route exposes it:
  `rename` posts only `id` and `name`, and `create` always passes
  `neutral: false`. The seeded neutral (salsa open-two-hands, bachata closed)
  is expected to stand.
