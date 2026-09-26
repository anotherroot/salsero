# Phase 3b — Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A routine is an ordered list of slots, each holding interchangeable
figures or one embedded routine; it gets its own exercise, the routine page
tells you where it breaks and whether it loops, and pressing Play walks the
player through it.

**Architecture:** Three layers, the same split phase 3a used. `src/lib/routines/`
is pure and client-safe — the slot algebra (`routines.ts`) and the run planner
(`plan.ts`), both of which read a `Graph` and neither of which knows a database
or a dance exists. `src/lib/server/routines.ts` owns the rows, the
routine↔exercise pairing, and the three cross-dance invariants. The routes are
`/[dance]/routines` and `/[dance]/routines/[id]`. The player gains one optional
`planner` hook so `attach.ts` can play a routine without learning what one is.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle ORM on better-sqlite3,
Tailwind 4, vitest. Toolchain comes from the nix flake: **every** command runs
as `nix develop -c <cmd>` — `node`, `npm` and `npx` are not on PATH.

**Spec:** [`docs/superpowers/specs/2026-09-24-routines-design.md`](../specs/2026-09-24-routines-design.md)
(slice 3b). Read it alongside this plan. Slice 3a is already live: positions,
`figure_start_positions`, `figures.end_position_id`, `figures.eights`,
`src/lib/graph/`, the gap report, and the drill's graph walk all exist.

---

## Global Constraints

These bind every task. Copied from `CLAUDE.md` and the spec.

- **Never add a CHECK to an existing table.** drizzle-kit rebuilds the table and
  the rebuild selects the new columns from the old one, failing at migrate time;
  a table with an incoming foreign key fails a second way, because the rebuild's
  `DROP TABLE` is an implicit delete and `PRAGMA foreign_keys` is a no-op inside
  the migrator's transaction. Additive `ALTER TABLE ... ADD COLUMN` only. Put
  the invariant in the data function.
- **`exercises.routine_id` gets NO mirror of `exercises_source_ck`.** The
  invariant `source = 'routine'` ⟺ `routine_id is not null` lives in
  `src/lib/server/routines.ts`. `exercises.lesson_id` is the precedent,
  including the comment.
- **Always read the generated migration SQL before committing it.** It must be
  purely additive: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD`. Any
  `DROP`, any `__new_` rebuild table, any re-`CREATE` of an existing table means
  stop and report.
- **Data functions take `db` as their first argument** so tests run against
  `openDb(':memory:')`. Routes pass `getDb()`.
- **A spec must never touch `$DATA_DIR`.** Setting `process.env.DATABASE_PATH`
  does NOT work — the app reads it through `$env/dynamic/private`, so the spec
  silently runs against the real database. Route-level tests mock:
  `vi.mock('$lib/server/db')` plus `openDb(':memory:')` per test, exactly as
  `src/routes/[dance]/dance-wall.spec.ts` does.
- **Nothing under `$lib/server` is imported by components.** Shared row shapes
  live in `src/lib/types.ts`.
- **Every instant is an integer of epoch ms**, never a `Date`. `now` is an
  argument to anything that needs it.
- **Nothing derived is stored.** A routine's starts, its end, its breaks and
  whether it loops are recomputed per request. No columns for them, no cache.
- **Archive, don't delete — for entities.** `routines` gets `archived_at`. A
  **slot, an option and a note are structure, not entities**: hard-deleted
  freely, the way a song's anchors are.
- **Purity.** `src/lib/routines/` has no database, no DOM, no `Date.now()`, and
  no idea dances exist. It may import from `$lib/graph/graph`, `$lib/labels`
  and `$lib/scheduler/scheduler` (types and constants only) and nothing else.
- **`src/lib/scheduler/` must not import `$lib/graph/` or `$lib/routines/`.**
  The direction is one-way: the scheduler declares interfaces, the others
  implement them.
- **Spacing is `Math.max(every, eights)` in BOTH planners** — the drill's
  `extendPlan` and the routine's `routinePlan`. See Task 3 for why this differs
  from the spec's earlier wording; Task 10 amends the spec.
- **Deny-by-default auth.** New routes are private automatically; do not touch
  `PUBLIC_PATHS` in `hooks.server.ts`.
- **`npm run check` must pass** (prettier + eslint + svelte-check + build +
  vitest). Run `nix develop -c npm run check` before the final commit of every
  task — not just the type check, and not just on the files you touched.
  Prettier formats `.ts`, `.svelte` AND `.md`.
- **Prove each new test can fail.** Before committing, break the thing the test
  asserts (invert a condition, delete the guard), watch that test fail, restore.
  A test that passes with its subject removed is not a test.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/lib/routines/routines.ts` | PURE. `Slot`/`RoutineShape` types, `flatten`, `slotStarts`, `sharedEnd`, `routineStarts`, `routineEnd`, `breaks`, `loops`. |
| `src/lib/routines/routines.spec.ts` | The variant algebra, untagged-means-neutral, breaks reported not refused. |
| `src/lib/routines/plan.ts` | PURE. `routinePlan` — the routine as `PlanStep[]`. |
| `src/lib/routines/plan.spec.ts` | Option resolution, looping, spacing, determinism under a seeded rand. |
| `src/lib/server/routines.ts` | Rows: CRUD, the exercise pairing, shape/slot readers, slot mutations, the embedding rule, the three cross-dance invariants. |
| `src/lib/server/routines.spec.ts` | Everything above against `openDb(':memory:')`. |
| `src/routes/[dance]/routines/+page.server.ts` | List load + `create` + `archive`. |
| `src/routes/[dance]/routines/+page.svelte` | The list, with "does not loop" / "has breaks" hints. |
| `src/routes/[dance]/routines/[id]/+page.server.ts` | Detail load + nine actions. |
| `src/routes/[dance]/routines/[id]/+page.svelte` | The slot editor. |

**Modified:**

| File | Change |
| --- | --- |
| `src/lib/server/db/schema.ts` | `routines`, `routineSteps`, `routineStepOptions`; `exercises.routineId`. |
| `drizzle/0007_*.sql` | Generated. Purely additive. |
| `src/lib/labels.ts` | `SOURCES`: `'choreography'` → `'routine'`. |
| `src/lib/components/today/ExerciseRow.svelte` | Label map: `choreography: 'Choreo'` → `routine: 'Routine'`. |
| `src/lib/types.ts` | `RoutineItem`, `SlotRow`. |
| `src/lib/server/scope.ts` | `requireRoutineInDance`. |
| `src/lib/server/figures.ts` | `listFiguresForCall` — names for figures a routine calls by id. |
| `src/lib/scheduler/attach.ts` | `PlayerOptions.planner`, and the one branch that uses it. |
| `src/routes/[dance]/player/+page.server.ts` | `?routine=` → the routine's shape and its figures' names. |
| `src/routes/[dance]/player/+page.svelte` | Pass `planner`; pool from the routine. |
| `src/lib/components/player/Setup.svelte` | A `routine` prop: show it, hide the pool picker. |
| `src/routes/[dance]/dance-wall.spec.ts` | Routine-id guards on both new routes. |
| `src/lib/components/shell/*` | The nav link to `/[dance]/routines` (match how Lessons is linked). |
| `CLAUDE.md` | Layout gains `src/lib/routines/`; the Live/Not-built line moves 3b across. |
| `docs/superpowers/specs/2026-09-22-salsa-app-design.md` | Choreography → Routine. |
| `docs/superpowers/specs/2026-09-24-routines-design.md` | The spacing amendment. |

---

### Task 1: Schema, migration, and `SOURCES` gains `'routine'`

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/labels.ts:14`
- Modify: `src/lib/components/today/ExerciseRow.svelte:19`
- Generated: `drizzle/0007_*.sql`

**Interfaces:**

- Produces: tables `routines`, `routineSteps`, `routineStepOptions`; column
  `exercises.routineId`; type `Routine = typeof routines.$inferSelect`;
  `SOURCES` containing `'routine'` and not `'choreography'`.

- [ ] **Step 1: Add the three tables to `schema.ts`**

Put them in a new `/* ── Routines ─── */` section AFTER the `positions` /
`figureStartPositions` section and BEFORE `/* ── Songs ─── */`. `routines` must
be declared before `exercises` references it — the file is read top to bottom by
drizzle-kit, and the generated migration must create `routines` before altering
`exercises`. Note `positions` currently sits above `songs`, and `exercises` is
below `songs`, so this ordering works.

No CHECK constraints anywhere in this task — not on the new tables either. The
new tables could legally carry one, but `position >= 0` and "a slot holds
something" are both enforced in `routines.ts`, and keeping the tables
CHECK-free means a later column addition never risks the rebuild trap.

```ts
/* ── Routines ───────────────────────────────────────────────────────────── */

/**
 * A named sequence of slots — a combo. Creating one creates its exercise in the
 * same transaction, the rule figures and lessons already follow; see
 * `src/lib/server/routines.ts`.
 *
 * There is no separate "block" or "subroutine" table. A block is just a short
 * routine, so a combo built standalone can be embedded later with no
 * conversion, and practising three figures is a good practice unit by itself.
 */
export const routines = sqliteTable(
	'routines',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		name: text('name').notNull(),
		notes: text('notes'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [index('routines_dance_idx').on(t.dance, t.archivedAt)]
);

/**
 * One slot of a routine, in order. It holds EITHER interchangeable figure
 * options (`routine_step_options`) OR one embedded routine — never both, and
 * never neither. Both rules live in `routines.ts`: "exactly one of two tables"
 * is not expressible as a CHECK at all, and a CHECK here would foreclose
 * adding a column later.
 *
 * A slot needs no length of its own. The plan is built per run after options
 * are resolved, so the chosen figure's `eights` is what counts.
 *
 * `position` is 0-based and contiguous. A slot is structure, not an entity: it
 * is hard-deleted and renumbered freely, the way a song's anchors are.
 */
export const routineSteps = sqliteTable(
	'routine_steps',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		routineId: integer('routine_id')
			.notNull()
			.references(() => routines.id),
		position: integer('position').notNull(),
		/** An embedded routine, or null when this slot holds figure options. */
		childRoutineId: integer('child_routine_id').references((): AnySQLiteColumn => routines.id),
		/** A reminder for this slot — "hand change here". */
		note: text('note'),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('routine_steps_slot_idx').on(t.routineId, t.position),
		index('routine_steps_child_idx').on(t.childRoutineId)
	]
);

/**
 * The interchangeable figures filling one slot — the variants.
 *
 * All of them must share ONE end position, enforced on write: that is what
 * interchangeable means. A slot's START positions are the UNION of its
 * options', and a run filters them by where the hands actually are.
 */
export const routineStepOptions = sqliteTable(
	'routine_step_options',
	{
		stepId: integer('step_id')
			.notNull()
			.references(() => routineSteps.id),
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.stepId, t.figureId] }),
		index('routine_step_options_figure_idx').on(t.figureId)
	]
);

export type Routine = typeof routines.$inferSelect;
export type RoutineStep = typeof routineSteps.$inferSelect;
```

`childRoutineId` is a self-reference, so its `references()` callback needs the
explicit `AnySQLiteColumn` return type or TypeScript reports a circular
inference. Add `AnySQLiteColumn` to the existing
`import { ... } from 'drizzle-orm/sqlite-core'` line as a `type` import.

- [ ] **Step 2: Add `routineId` to `exercises`**

In the `exercises` table, immediately after the `lessonId` field:

```ts
		/**
		 * Set iff `source = 'routine'`. Deliberately WITHOUT a mirror of
		 * `exercises_source_ck`, for the same reason `lessonId` has none: a new
		 * CHECK on this table makes drizzle-kit rebuild it and the rebuild fails
		 * at migrate time. `routines.ts` is the only thing that writes this
		 * column, and is the enforcement.
		 */
		routineId: integer('routine_id').references(() => routines.id),
```

- [ ] **Step 3: Swap `'choreography'` for `'routine'`**

`src/lib/labels.ts:14` becomes:

```ts
export const SOURCES = ['figure', 'routine', 'custom', 'lesson'] as const;
```

No migration: `source` is a TypeScript-only enum, `exercises_source_ck`
constrains only the `figure`/`figureId` pairing, and no row has ever carried
`'choreography'` — phase 3 was never built.

`src/lib/components/today/ExerciseRow.svelte:19` becomes:

```svelte
		routine: 'Routine',
```

Keep the map's existing key order and indentation; the object is keyed by
`Source`, so leaving `choreography` in place would fail the type check.

- [ ] **Step 4: Generate the migration**

```sh
nix develop -c npm run db:generate
```

- [ ] **Step 5: Read the generated SQL by hand**

```sh
cat drizzle/0007_*.sql
```

Expected, and nothing else: `CREATE TABLE routines`, `CREATE TABLE
routine_steps`, `CREATE TABLE routine_step_options`, four
`CREATE INDEX`/`CREATE UNIQUE INDEX` statements, and
`ALTER TABLE 'exercises' ADD 'routine_id' integer REFERENCES routines(id);`.
`routines` must appear before the `ALTER TABLE exercises`.

**If you see `DROP TABLE`, a `__new_`-prefixed table, or a re-`CREATE` of any
existing table: stop and report BLOCKED.** That is the rebuild trap and it
fails at migrate time on the production database.

- [ ] **Step 6: Run the check suite**

```sh
nix develop -c npm run check
```

`src/lib/server/db/migrate.spec.ts` applies every migration to a fresh
in-memory database, so a green run here is the migration's real gate. Expected:
PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/labels.ts src/lib/components/today/ExerciseRow.svelte drizzle/
git commit -m "routines: the three tables, and SOURCES gains 'routine'"
```

---

### Task 2: The pure slot algebra

**Files:**

- Create: `src/lib/routines/routines.ts`
- Test: `src/lib/routines/routines.spec.ts`

**Interfaces:**

- Consumes: `Graph`, `GraphFigure`, `startsOf`, `endOf`, `figureById` from
  `$lib/graph/graph`. `startsOf` resolves an empty `starts` to `[g.neutral]`
  and `endOf` resolves a null `end` to `g.neutral`; **never read `f.starts` or
  `f.end` directly** — going through these two is the only reason
  untagged-means-neutral holds everywhere.
- Produces: `OptionsSlot`, `ChildSlot`, `Slot`, `RoutineShape`, `flatten`,
  `slotStarts`, `sharedEnd`, `routineStarts`, `routineEnd`, `breaks`, `loops`.

- [ ] **Step 1: Write the failing tests**

`src/lib/routines/routines.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import {
	breaks,
	flatten,
	loops,
	routineEnd,
	routineStarts,
	sharedEnd,
	slotStarts,
	type RoutineShape
} from './routines';

/**
 * Positions 1 open (neutral), 2 closed, 3 hammerlock.
 *
 * 10 untagged — both sides neutral, which is most of the repertoire.
 * 11 open → closed. 12 closed → open. 13 open|closed → hammerlock, 2 eights.
 * 14 hammerlock → open.
 */
const g: Graph = {
	neutral: 1,
	figures: [
		{ id: 10, starts: [], end: null, eights: 1 },
		{ id: 11, starts: [1], end: 2, eights: 1 },
		{ id: 12, starts: [2], end: 1, eights: 1 },
		{ id: 13, starts: [1, 2], end: 3, eights: 2 },
		{ id: 14, starts: [3], end: 1, eights: 1 }
	]
};

const opts = (...figureIds: number[]): RoutineShape => ({
	slots: figureIds.map((id) => ({ kind: 'options', figureIds: [id] }))
});

describe('slotStarts', () => {
	it('is the union of its options, deduplicated', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 13] })).toEqual([1, 2]);
	});

	it('resolves an untagged option to the neutral position', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [10] })).toEqual([1]);
	});

	it('ignores an option the graph does not know', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 999] })).toEqual([1]);
	});
});

describe('sharedEnd', () => {
	it('is the end every option agrees on', () => {
		expect(sharedEnd(g, { kind: 'options', figureIds: [12, 14] })).toBe(1);
	});

	it('counts an untagged option as ending at neutral', () => {
		expect(sharedEnd(g, { kind: 'options', figureIds: [10, 14] })).toBe(1);
	});

	it('is null when the options disagree', () => {
		expect(sharedEnd(g, { kind: 'options', figureIds: [11, 12] })).toBeNull();
	});
});

describe('flatten', () => {
	it('splices an embedded routine in place', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [12] }] },
				{ kind: 'options', figureIds: [13] }
			]
		};
		expect(flatten(g, shape).map((s) => s.figureIds)).toEqual([[11], [12], [13]]);
	});

	it('drops options the graph does not know, and slots left empty', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 999] },
				{ kind: 'options', figureIds: [998] }
			]
		};
		expect(flatten(g, shape).map((s) => s.figureIds)).toEqual([[11]]);
	});
});

describe('routineStarts and routineEnd', () => {
	it('borrow the first and last slot', () => {
		const shape = opts(13, 14);
		expect(routineStarts(g, shape)).toEqual([1, 2]);
		expect(routineEnd(g, shape)).toBe(1);
	});

	it('see through an embedded routine at either end', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [11] }] },
				{ kind: 'child', routineId: 8, slots: [{ kind: 'options', figureIds: [12] }] }
			]
		};
		expect(routineStarts(g, shape)).toEqual([1]);
		expect(routineEnd(g, shape)).toBe(1);
	});

	it('are empty and null for a routine with nothing danceable', () => {
		expect(routineStarts(g, { slots: [] })).toEqual([]);
		expect(routineEnd(g, { slots: [] })).toBeNull();
	});
});

describe('breaks', () => {
	it('reports the seam the hands cannot cross, and does not refuse it', () => {
		// 11 ends closed; 14 starts only from hammerlock.
		expect(breaks(g, opts(11, 14))).toEqual([0]);
	});

	it('is empty when every seam joins', () => {
		expect(breaks(g, opts(11, 12, 13, 14))).toEqual([]);
	});

	it('sees a break inside an embedded routine and at its seam', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{
					kind: 'child',
					routineId: 7,
					slots: [
						{ kind: 'options', figureIds: [14] },
						{ kind: 'options', figureIds: [14] }
					]
				}
			]
		};
		// flat: 11 (→closed), 14 (needs hammerlock), 14 (needs hammerlock, gets open)
		expect(breaks(g, shape)).toEqual([0, 1]);
	});

	it('cannot report a break out of a slot whose end is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 12] },
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(breaks(g, shape)).toEqual([]);
	});
});

describe('loops', () => {
	it('is true when the end is one of the starts', () => {
		expect(loops(g, opts(11, 12))).toBe(true);
	});

	it('is false when it is not', () => {
		expect(loops(g, opts(11, 13))).toBe(false);
	});

	it('is true for one untagged figure, which really does run into itself', () => {
		expect(loops(g, opts(10))).toBe(true);
	});
});
```

- [ ] **Step 2: Run the tests to watch them fail**

```sh
nix develop -c npx vitest run src/lib/routines/routines.spec.ts
```

Expected: FAIL — cannot resolve `./routines`.

- [ ] **Step 3: Write `src/lib/routines/routines.ts`**

```ts
/**
 * A routine's shape, and what the figure graph says about it.
 *
 * PURE and client-safe, the same rules `src/lib/graph/` follows: no database,
 * no DOM, no `Date.now()`, and no idea that dances exist — the data-access
 * layer scopes to one dance and hands over plain data.
 *
 * Nothing here is stored. Where a routine starts, where it ends, where it
 * breaks and whether it loops are all recomputed per request, for the same
 * reason urgency is: a cached answer is a second source of truth that goes
 * stale the moment a tag is edited.
 *
 * Every position is read through `startsOf` and `endOf`, never off the figure
 * row, because those two are what make an untagged figure resolve to the
 * neutral position. A repertoire nobody has tagged is one big hub, and a
 * routine over it is all seams and no breaks — which is honest.
 */
import { endOf, figureById, startsOf, type Graph } from '$lib/graph/graph';

/** A slot filled by interchangeable figures — the variants. */
export interface OptionsSlot {
	kind: 'options';
	figureIds: number[];
}

/**
 * A slot filled by an embedded routine.
 *
 * Its own slots are always `OptionsSlot`: embedding is one level, enforced on
 * write, so the type says so too and nothing downstream has to recurse.
 */
export interface ChildSlot {
	kind: 'child';
	routineId: number;
	slots: OptionsSlot[];
}

export type Slot = OptionsSlot | ChildSlot;

export interface RoutineShape {
	slots: Slot[];
}

/**
 * The routine as one flat run of option slots, children spliced in place.
 *
 * Everything else here works on this, which is why a break INSIDE an embedded
 * routine and a break at its seam are both visible: the embedded slot borrows
 * the child's shape rather than hiding it.
 *
 * An option no figure in the graph answers for is dropped, and a slot left with
 * none disappears with it. Archiving a figure must not be able to stop a
 * routine playing, and a slot that can call nothing is not a slot.
 */
export function flatten(g: Graph, shape: RoutineShape): OptionsSlot[] {
	const out: OptionsSlot[] = [];
	for (const slot of shape.slots) {
		for (const s of slot.kind === 'child' ? slot.slots : [slot]) {
			const figureIds = s.figureIds.filter((id) => figureById(g, id) !== null);
			if (figureIds.length > 0) out.push({ kind: 'options', figureIds });
		}
	}
	return out;
}

/**
 * Every position this slot can be entered from: the union of its options'.
 *
 * Permissive on purpose. An option that does not work from where the hands are
 * is simply not picked at run time, rather than blocked while authoring.
 */
export function slotStarts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		for (const p of startsOf(g, f)) out.add(p);
	}
	return [...out];
}

/**
 * The position every option leaves the hands at, or null when they disagree.
 *
 * Disagreement is refused on write — that is what interchangeable means — but
 * pure code must not assume the write path was the only way rows arrived. A
 * hand-edited database should read as "end unknown" rather than pick a winner,
 * and the callers here all decline to guess.
 */
export function sharedEnd(g: Graph, slot: OptionsSlot): number | null {
	let end: number | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		const e = endOf(g, f);
		if (end === null) end = e;
		else if (end !== e) return null;
	}
	return end;
}

/** Where the routine can be started. Empty when it has no danceable slot. */
export function routineStarts(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	return flat.length === 0 ? [] : slotStarts(g, flat[0]);
}

/** Where it leaves the hands, or null if the last slot's options disagree. */
export function routineEnd(g: Graph, shape: RoutineShape): number | null {
	const flat = flatten(g, shape);
	return flat.length === 0 ? null : sharedEnd(g, flat[flat.length - 1]);
}

/**
 * Flat slot indices `i` where the hands cannot get from slot `i` to `i + 1`.
 *
 * Reported, never refused. This is a personal app and the dancer may know
 * something the graph does not — a tag that is simply missing, or a transition
 * their body makes anyway. A slot whose own end is unknown yields no break:
 * there is nothing to compare, and a warning nobody can act on is noise.
 */
export function breaks(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const end = sharedEnd(g, flat[i]);
		if (end === null) continue;
		if (!slotStarts(g, flat[i + 1]).includes(end)) out.push(i);
	}
	return out;
}

/**
 * Whether the routine runs straight back into itself.
 *
 * A free diagnostic worth showing: the player loops a routine when the song
 * outlasts it, so a routine that does not loop will cross one break per lap.
 */
export function loops(g: Graph, shape: RoutineShape): boolean {
	const end = routineEnd(g, shape);
	return end !== null && routineStarts(g, shape).includes(end);
}
```

- [ ] **Step 4: Run the tests to watch them pass**

```sh
nix develop -c npx vitest run src/lib/routines/routines.spec.ts
```

Expected: PASS, 18 tests.

- [ ] **Step 5: Prove two of the tests can fail**

Mutation experiment, one at a time, restoring after each:

1. In `sharedEnd`, change `else if (end !== e) return null;` to `else if (false) return null;`. Expected: "is null when the options disagree" FAILS, and so does "cannot report a break out of a slot whose end is unknown".
2. In `flatten`, drop the `slot.kind === 'child' ? slot.slots : [slot]` splice — use `[slot]` unconditionally, casting as needed. Expected: "splices an embedded routine in place" FAILS.

If either mutation leaves the suite green, the test is not testing what it
claims. Fix the test, and say so in your report.

- [ ] **Step 6: Run the full check suite and commit**

```sh
nix develop -c npm run check
git add src/lib/routines/
git commit -m "routines: the pure slot algebra"
```

---

### Task 3: The pure run planner

**Files:**

- Create: `src/lib/routines/plan.ts`
- Test: `src/lib/routines/plan.spec.ts`

**Interfaces:**

- Consumes: `flatten`, `type OptionsSlot`, `type RoutineShape` from
  `./routines`; `endOf`, `figureById`, `startsOf`, `type Graph` from
  `$lib/graph/graph`; `LEAD_IN_8S` (= 2) and `type PlanStep`
  (`{ eight: number; figureId: number }`) from `$lib/scheduler/scheduler`;
  `type CallEvery` (1 | 2 | 4) from `$lib/labels`.
- Produces: `routinePlan(plan, shape, g, every, throughEight, rand): PlanStep[]`.

**Why this task deviates from the spec, and how.** The spec says a routine is
spaced "by the chosen figure's `eights`". Take that literally and a routine
whose figures are all at the default `eights: 1` calls a new figure every
8-count — 2.7 seconds at 180 BPM, far too fast to dance. `figures.eights`
defaults to 1 for the entire existing repertoire, so that is what every routine
would do on day one. Spacing by `Math.max(every, eights)` instead — the drill's
existing rule — lets the user's own call rate govern where the data is silent,
while a figure with a real `eights` still gets its full length whenever that is
longer. One spacing rule in the codebase, and the identical expression in both
planners. Task 10 amends the spec to match.

- [ ] **Step 1: Write the failing tests**

`src/lib/routines/plan.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import { LEAD_IN_8S } from '$lib/scheduler/scheduler';
import { routinePlan } from './plan';
import type { RoutineShape } from './routines';

/** Same graph as routines.spec.ts: 1 open (neutral), 2 closed, 3 hammerlock. */
const g: Graph = {
	neutral: 1,
	figures: [
		{ id: 10, starts: [], end: null, eights: 1 },
		{ id: 11, starts: [1], end: 2, eights: 1 },
		{ id: 12, starts: [2], end: 1, eights: 1 },
		{ id: 13, starts: [1, 2], end: 3, eights: 2 },
		{ id: 14, starts: [3], end: 1, eights: 1 }
	]
};

const opts = (...figureIds: number[]): RoutineShape => ({
	slots: figureIds.map((id) => ({ kind: 'options', figureIds: [id] }))
});

/** A rand that walks a fixed list, so a plan is reproducible. */
const seeded = (values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

describe('routinePlan', () => {
	it('calls the slots in order, starting after the lead-in', () => {
		const plan = routinePlan([], opts(11, 12), g, 1, 3, seeded([0]));
		expect(plan).toEqual([
			{ eight: LEAD_IN_8S, figureId: 11 },
			{ eight: LEAD_IN_8S + 1, figureId: 12 }
		]);
	});

	it('loops back to the first slot when the song outlasts the routine', () => {
		const plan = routinePlan([], opts(11, 12), g, 1, 6, seeded([0]));
		expect(plan.map((s) => s.figureId)).toEqual([11, 12, 11, 12, 11]);
	});

	it('spaces by max(every, eights)', () => {
		// 13 is 2 eights; callEvery is 1, so 13 gets 2 and 14 gets 1.
		const plan = routinePlan([], opts(13, 14), g, 1, 5, seeded([0]));
		expect(plan).toEqual([
			{ eight: 2, figureId: 13 },
			{ eight: 4, figureId: 14 },
			{ eight: 5, figureId: 13 }
		]);
	});

	it('lets a slower call rate win over a short figure', () => {
		const plan = routinePlan([], opts(11, 12), g, 4, 10, seeded([0]));
		expect(plan.map((s) => s.eight)).toEqual([2, 6, 10]);
	});

	it('resumes an existing plan without touching what it already decided', () => {
		const first = routinePlan([], opts(11, 12), g, 1, 3, seeded([0]));
		const second = routinePlan(first, opts(11, 12), g, 1, 5, seeded([0]));
		expect(second.slice(0, first.length)).toEqual(first);
		expect(second.map((s) => s.figureId)).toEqual([11, 12, 11, 12]);
	});

	it('picks the option that can be entered from where the hands are', () => {
		// Slot 1 is 11 (open → closed). Slot 2 offers 14 (needs hammerlock) and
		// 12 (needs closed). Only 12 fits, whatever rand says.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'options', figureIds: [14, 12] }
			]
		};
		for (const r of [0, 0.5, 0.99]) {
			expect(routinePlan([], shape, g, 1, 3, seeded([r])).map((s) => s.figureId)).toEqual([11, 12]);
		}
	});

	it('spreads across the options that fit, driven by rand', () => {
		// After 12 the hands are open; both 11 and 13 start from open.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		expect(routinePlan([], shape, g, 1, 3, seeded([0, 0])).map((s) => s.figureId)).toEqual([12, 11]);
		expect(routinePlan([], shape, g, 1, 3, seeded([0, 0.99])).map((s) => s.figureId)).toEqual([
			12, 13
		]);
	});

	it('calls something anyway when no option fits — a break is not a stop', () => {
		// 11 ends closed; 14 needs hammerlock. The routine page warns; the run dances.
		expect(routinePlan([], opts(11, 14), g, 1, 3, seeded([0])).map((s) => s.figureId)).toEqual([
			11, 14
		]);
	});

	it('flattens an embedded routine into the walk', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [12] }] }
			]
		};
		expect(routinePlan([], shape, g, 1, 4, seeded([0])).map((s) => s.figureId)).toEqual([
			11, 12, 11
		]);
	});

	it('returns the plan untouched when nothing is danceable', () => {
		expect(routinePlan([], { slots: [] }, g, 1, 8, seeded([0]))).toEqual([]);
		expect(
			routinePlan([], { slots: [{ kind: 'options', figureIds: [999] }] }, g, 1, 8, seeded([0]))
		).toEqual([]);
	});

	it('is deterministic under a seeded rand', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		const a = routinePlan([], shape, g, 1, 20, seeded([0.1, 0.9, 0.4]));
		const b = routinePlan([], shape, g, 1, 20, seeded([0.1, 0.9, 0.4]));
		expect(a).toEqual(b);
		expect(a.length).toBeGreaterThan(5);
	});

	it('cannot run off the end of an option list when rand returns 1', () => {
		expect(routinePlan([], opts(11), g, 1, 3, seeded([1])).map((s) => s.figureId)).toEqual([11, 11]);
	});
});
```

- [ ] **Step 2: Run the tests to watch them fail**

```sh
nix develop -c npx vitest run src/lib/routines/plan.spec.ts
```

Expected: FAIL — cannot resolve `./plan`.

- [ ] **Step 3: Write `src/lib/routines/plan.ts`**

```ts
/**
 * A routine as the player's plan: which figure is called on which 8-count.
 *
 * PURE. It produces the same `PlanStep[]` the drill's `extendPlan` produces, so
 * nothing downstream — `cuesIn`, `attach.ts`, the count, the clave — has any
 * idea a routine exists.
 *
 * Called again and again as the run's horizon grows, exactly the way
 * `extendPlan` is, and for the same reason: a call already announced must never
 * change. The plan itself is the cursor. One step is pushed per resolved slot,
 * so `plan.length` says which slot comes next and where the hands are, and no
 * state has to survive between ticks.
 */
import { endOf, figureById, startsOf, type Graph } from '$lib/graph/graph';
import type { CallEvery } from '$lib/labels';
import { LEAD_IN_8S, type PlanStep } from '$lib/scheduler/scheduler';
import { flatten, type OptionsSlot, type RoutineShape } from './routines';

/**
 * Extend `plan` through `throughEight`, looping the routine when the song
 * outlasts it.
 *
 * Spacing is `max(every, eights)`, the same expression the drill uses.
 * `figures.eights` defaults to 1, so spacing by the figure alone would call a
 * new one every 8-count — under three seconds at 180 BPM, which is not
 * danceable. The user's call rate is the better guess where the data is silent,
 * and a figure that carries a real `eights` still gets its own length whenever
 * that is the longer of the two.
 */
export function routinePlan(
	plan: PlanStep[],
	shape: RoutineShape,
	g: Graph,
	every: CallEvery,
	throughEight: number,
	rand: () => number
): PlanStep[] {
	const flat = flatten(g, shape);
	if (flat.length === 0) return plan;
	const eightsOf = (id: number) => figureById(g, id)?.eights ?? 1;
	const out = [...plan];
	let eight =
		out.length === 0
			? LEAD_IN_8S
			: out[out.length - 1].eight + Math.max(every, eightsOf(out[out.length - 1].figureId));
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = choose(g, flat[out.length % flat.length], last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += Math.max(every, eightsOf(figureId));
	}
	return out;
}

/**
 * Which of a slot's options to dance, given the figure just called.
 *
 * An option that cannot be entered from where the hands are is skipped — the
 * slot is permissive by design. If NONE fit, the whole list is eligible again:
 * that is the break the routine page already warns about, and calling nothing
 * would stop the run dead over a tag somebody has not got round to.
 *
 * `r` is in `[0, 1)`, and the index is clamped the way `pickFigure` clamps it,
 * so an `r` that reaches 1 cannot run off the end.
 */
function choose(g: Graph, slot: OptionsSlot, last: number | null, r: number): number | null {
	if (slot.figureIds.length === 0) return null;
	const lastFigure = last === null ? null : figureById(g, last);
	const here = lastFigure === null ? null : endOf(g, lastFigure);
	const fits =
		here === null
			? slot.figureIds
			: slot.figureIds.filter((id) => {
					const f = figureById(g, id);
					return f !== null && startsOf(g, f).includes(here);
				});
	const choices = fits.length > 0 ? fits : slot.figureIds;
	return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
}
```

- [ ] **Step 4: Run the tests to watch them pass**

```sh
nix develop -c npx vitest run src/lib/routines/plan.spec.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Prove three of the tests can fail**

One at a time, restoring after each:

1. In `routinePlan`, replace `Math.max(every, eightsOf(figureId))` with
   `every` in BOTH places. Expected: "spaces by max(every, eights)" FAILS.
2. In `choose`, replace `const choices = fits.length > 0 ? fits : slot.figureIds;`
   with `const choices = slot.figureIds;`. Expected: "picks the option that can
   be entered from where the hands are" FAILS.
3. In `routinePlan`, change the slot cursor from `out.length % flat.length` to
   `0`. Expected: "calls the slots in order" FAILS.

If a mutation leaves the suite green, fix the test and say so in your report.

- [ ] **Step 6: Run the full check suite and commit**

```sh
nix develop -c npm run check
git add src/lib/routines/plan.ts src/lib/routines/plan.spec.ts
git commit -m "routines: the pure run planner"
```

---

### Task 4: Routines in the database — CRUD, the exercise, the readers

**Files:**

- Create: `src/lib/server/routines.ts`
- Test: `src/lib/server/routines.spec.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**

- Consumes: `Db` from `./db`; `routines`, `routineSteps`, `routineStepOptions`,
  `exercises`, `figures` from `./db/schema`; `DanceSlug` from
  `$lib/dances/dances`; `OptionsSlot`, `RoutineShape`, `Slot` from
  `$lib/routines/routines`.
- Produces: `type Tx`, `RoutineInput`, `createRoutine`, `updateRoutine`,
  `archiveRoutine`, `getRoutine`, `listRoutines`, `routineShapes`,
  `routineSlots`. Task 5 adds the mutations to this same file.

- [ ] **Step 1: Add the row shapes to `src/lib/types.ts`**

Append, following the file's existing style (each interface documented, no
imports from `$lib/server`):

```ts
/** A routine as the library list shows it. */
export interface RoutineItem {
	id: number;
	name: string;
	notes: string | null;
	/** Slots, children counted as one. */
	slots: number;
	createdAt: number;
}

/**
 * One slot as the editor renders it: the ids and names the pure `Slot`
 * deliberately does without.
 */
export interface SlotRow {
	id: number;
	position: number;
	note: string | null;
	/** The embedded routine, or null when this slot holds figure options. */
	childId: number | null;
	childName: string | null;
	/** Empty for a child slot. */
	figureIds: number[];
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/server/routines.spec.ts`. These run against `openDb(':memory:')` with
no mock, because data functions take `db` first.

```ts
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { createFigure } from './figures';
import { createRoutine, getRoutine, listRoutines, routineShapes, updateRoutine } from './routines';
import { archiveRoutine } from './routines';
import { exercises } from './db/schema';
import { eq } from 'drizzle-orm';

const figure = (db: ReturnType<typeof openDb>, name: string, dance: 'salsa' | 'bachata' = 'salsa') =>
	createFigure(db, dance, {
		name,
		partner: 'either',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null,
		callable: true,
		callText: null
	})!.figure;

describe('createRoutine', () => {
	it('creates the routine and its exercise in one go', () => {
		const db = openDb(':memory:');
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Setenta combo', notes: null });
		expect(routine.dance).toBe('salsa');
		expect(exercise.name).toBe('Setenta combo');
		expect(exercise.source).toBe('routine');
		expect(exercise.routineId).toBe(routine.id);
		expect(exercise.dance).toBe('salsa');
	});
});

describe('updateRoutine', () => {
	it('carries a rename over to the exercise', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		updateRoutine(db, routine.id, { name: 'Setenta combo', notes: 'from Tuesday' });
		expect(getRoutine(db, routine.id)?.notes).toBe('from Tuesday');
		const ex = db.select().from(exercises).where(eq(exercises.routineId, routine.id)).get();
		expect(ex?.name).toBe('Setenta combo');
	});

	it('is null for a routine that does not exist', () => {
		const db = openDb(':memory:');
		expect(updateRoutine(db, 999, { name: 'x', notes: null })).toBeNull();
	});
});

describe('archiveRoutine', () => {
	it('archives the exercise with it, and only once', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		expect(archiveRoutine(db, routine.id, 1000)).toBe(true);
		expect(archiveRoutine(db, routine.id, 2000)).toBe(false);
		const ex = db.select().from(exercises).where(eq(exercises.routineId, routine.id)).get();
		expect(ex?.archivedAt).toBe(1000);
	});
});

describe('listRoutines', () => {
	it('shows only this dance, unarchived, with a slot count', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		createRoutine(db, 'bachata', { name: 'B', notes: null });
		createRoutine(db, 'salsa', { name: 'C', notes: null });
		archiveRoutine(db, a.id, 1000);
		expect(listRoutines(db, 'salsa').map((r) => r.name)).toEqual(['C']);
		expect(listRoutines(db, 'salsa')[0].slots).toBe(0);
		expect(listRoutines(db, 'bachata').map((r) => r.name)).toEqual(['B']);
	});
});

describe('routineShapes', () => {
	it('is an empty shape for a routine with no slots', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		expect(routineShapes(db, 'salsa').get(routine.id)).toEqual({ slots: [] });
	});

	it('does not reach across the dance wall', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'bachata', { name: 'B', notes: null });
		expect(routineShapes(db, 'salsa').has(routine.id)).toBe(false);
	});
});
```

The rest of `routineShapes` and `routineSlots` — slots with options, an
embedded child spliced in — is tested in Task 5, which is where slots can first
be created. Do not hand-insert rows to test them here.

- [ ] **Step 3: Run the tests to watch them fail**

```sh
nix develop -c npx vitest run src/lib/server/routines.spec.ts
```

Expected: FAIL — cannot resolve `./routines`.

- [ ] **Step 4: Write `src/lib/server/routines.ts`**

```ts
/**
 * Routines: the rows, the exercise that comes with one, and the shape the pure
 * layer reads.
 *
 * A routine is an ordered list of slots. Each slot holds either interchangeable
 * figures — the variants — or one embedded routine. The rules that a database
 * cannot express live here: exactly one of those two per slot, one shared end
 * across a slot's options, one level of embedding, and the three cross-dance
 * invariants (a slot's figures, a child routine, and a routine's own dance).
 *
 * `src/lib/routines/` does the thinking about shapes; this module only feeds it
 * and writes the answers back.
 */
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, routineStepOptions, routineSteps, routines } from './db/schema';
import { neutralPosition } from './positions';
import type { DanceSlug } from '$lib/dances/dances';
import type { OptionsSlot, RoutineShape, Slot } from '$lib/routines/routines';
import type { RoutineItem, SlotRow } from '$lib/types';

/**
 * Drizzle's transaction handle. NOT a `Db` — it has no `.transaction()` — so a
 * helper meant to run inside one cannot take `Db`, and this is how its type is
 * named without importing drizzle's internals.
 */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface RoutineInput {
	name: string;
	notes: string | null;
}

/**
 * Create a routine and its exercise together — the rule figures and lessons
 * already follow, so a routine appears in Today without a second step.
 *
 * `source: 'routine'` and `routineId` are set as a pair. There is no CHECK
 * pairing them (see `schema.ts`); this function is the enforcement, and it is
 * the only thing that ever writes `exercises.routine_id`.
 */
export function createRoutine(db: Db, dance: DanceSlug, input: RoutineInput, everyDays = 3) {
	return db.transaction((tx) => {
		const routine = tx
			.insert(routines)
			.values({ ...input, dance })
			.returning()
			.get();
		const exercise = tx
			.insert(exercises)
			.values({
				name: routine.name,
				source: 'routine',
				routineId: routine.id,
				dance,
				everyDays
			})
			.returning()
			.get();
		return { routine, exercise };
	});
}

/** Edit a routine. A rename carries over to its exercise so the two never drift. */
export function updateRoutine(db: Db, id: number, input: RoutineInput) {
	return db.transaction((tx) => {
		const routine = tx.update(routines).set(input).where(eq(routines.id, id)).returning().get();
		if (!routine) return null;
		tx.update(exercises)
			.set({ name: routine.name })
			.where(eq(exercises.routineId, id))
			.run();
		return routine;
	});
}

/**
 * Archive a routine and its exercise together. Slots, options and sets stay.
 *
 * A routine embedded in another is archived all the same: the parent keeps
 * dancing it, the way a figure tagged with an archived position keeps its tag.
 * What archiving removes is the offer — the library list and the embed picker.
 */
export function archiveRoutine(db: Db, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const res = tx
			.update(routines)
			.set({ archivedAt: now })
			.where(and(eq(routines.id, id), isNull(routines.archivedAt)))
			.run();
		if (res.changes === 0) return false;
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.routineId, id)).run();
		return true;
	});
}

export function getRoutine(db: Db, id: number) {
	return db.select().from(routines).where(eq(routines.id, id)).get() ?? null;
}

/** The library: newest first, with how many slots each holds. */
export function listRoutines(db: Db, dance: DanceSlug): RoutineItem[] {
	return db
		.select({
			id: routines.id,
			name: routines.name,
			notes: routines.notes,
			slots: count(routineSteps.id),
			createdAt: routines.createdAt
		})
		.from(routines)
		.leftJoin(routineSteps, eq(routineSteps.routineId, routines.id))
		.where(and(eq(routines.dance, dance), isNull(routines.archivedAt)))
		.groupBy(routines.id)
		.orderBy(desc(routines.createdAt))
		.all();
}

/**
 * Every routine of this dance as a pure shape, embedded children spliced in.
 *
 * The whole dance in three queries rather than three per routine: the library
 * list derives "does not loop" and "has breaks" for every row, and each of
 * those needs a full shape. The detail page reads its own routine out of the
 * same map, so there is exactly one implementation of "what shape is this".
 *
 * Archived routines are included. A shape is a reading, and the list decides
 * separately what it offers.
 */
export function routineShapes(db: Db, dance: DanceSlug): Map<number, RoutineShape> {
	const steps = db
		.select({
			id: routineSteps.id,
			routineId: routineSteps.routineId,
			childRoutineId: routineSteps.childRoutineId
		})
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(eq(routines.dance, dance))
		.orderBy(asc(routineSteps.routineId), asc(routineSteps.position))
		.all();

	const options = db
		.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(eq(routines.dance, dance))
		.orderBy(asc(routineStepOptions.figureId))
		.all();

	const byStep = new Map<number, number[]>();
	for (const o of options) {
		const list = byStep.get(o.stepId);
		if (list) list.push(o.figureId);
		else byStep.set(o.stepId, [o.figureId]);
	}

	// A routine's own option slots, in order. Embedding is one level, so a
	// routine that IS embedded has none of its own children to worry about and
	// this is its whole shape.
	const own = new Map<number, OptionsSlot[]>();
	for (const s of steps) {
		if (s.childRoutineId !== null) continue;
		const list = own.get(s.routineId) ?? [];
		list.push({ kind: 'options', figureIds: byStep.get(s.id) ?? [] });
		own.set(s.routineId, list);
	}

	const out = new Map<number, RoutineShape>();
	for (const r of db
		.select({ id: routines.id })
		.from(routines)
		.where(eq(routines.dance, dance))
		.all()) {
		out.set(r.id, { slots: [] });
	}
	for (const s of steps) {
		const slot: Slot =
			s.childRoutineId === null
				? { kind: 'options', figureIds: byStep.get(s.id) ?? [] }
				: { kind: 'child', routineId: s.childRoutineId, slots: own.get(s.childRoutineId) ?? [] };
		out.get(s.routineId)?.slots.push(slot);
	}
	return out;
}

/** One routine's slots as the editor needs them: ids, notes, and the child's name. */
export function routineSlots(db: Db, routineId: number): SlotRow[] {
	const child = db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.all()
		.reduce((m, r) => m.set(r.id, r.name), new Map<number, string>());

	const steps = db
		.select({
			id: routineSteps.id,
			position: routineSteps.position,
			note: routineSteps.note,
			childId: routineSteps.childRoutineId
		})
		.from(routineSteps)
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(asc(routineSteps.position))
		.all();

	const ids = steps.map((s) => s.id);
	const options =
		ids.length === 0
			? []
			: db
					.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
					.from(routineStepOptions)
					.where(inArray(routineStepOptions.stepId, ids))
					.orderBy(asc(routineStepOptions.figureId))
					.all();

	const byStep = new Map<number, number[]>();
	for (const o of options) {
		const list = byStep.get(o.stepId);
		if (list) list.push(o.figureId);
		else byStep.set(o.stepId, [o.figureId]);
	}

	return steps.map((s) => ({
		...s,
		childName: s.childId === null ? null : child.get(s.childId) ?? null,
		figureIds: byStep.get(s.id) ?? []
	}));
}
```

`Tx`, `figures` and `neutralPosition` are for Task 5 — if eslint reports them
unused, leave them out now and add them in Task 5 rather than adding a disable
comment.

- [ ] **Step 5: Run the tests to watch them pass**

```sh
nix develop -c npx vitest run src/lib/server/routines.spec.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Prove two of the tests can fail**

1. In `createRoutine`, change `source: 'routine'` to `source: 'custom'`.
   Expected: "creates the routine and its exercise in one go" FAILS.
2. In `listRoutines`, drop `isNull(routines.archivedAt)` from the `where`.
   Expected: "shows this dance's unarchived routines" FAILS.

- [ ] **Step 7: Run the full check suite and commit**

```sh
nix develop -c npm run check
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts src/lib/types.ts
git commit -m "routines: rows, the paired exercise, and the shape readers"
```

---

### Task 5: Slots, options, and the embedding rule

**Files:**

- Modify: `src/lib/server/routines.ts`
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**

- Consumes: everything Task 4 produced, plus `neutralPosition` from
  `./positions` and `figures` from `./db/schema`.
- Produces: `addFigureSlot`, `addChildSlot`, `addOption`, `removeOption`,
  `setSlotNote`, `deleteSlot`, `moveSlot`, `canEmbed`, `embeddable`.

**The invariants this task owns.** Every one of them returns a falsy result and
writes nothing — never a throw, never a partial write:

1. A slot's figures must be of the routine's dance.
2. A child routine must be of its parent's dance.
3. All options in a slot share one end position, nulls resolved to the dance's
   neutral (so an untagged figure and one tagged with the neutral position DO
   agree).
4. A slot holds at least one option or a child — never zero, never both.
5. Embedding is one level: child `C` may go into routine `R` iff `C ≠ R`, `C`
   has no child slots of its own, and `R` is embedded nowhere.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/routines.spec.ts`. Extend the existing imports rather
than adding a second import line from `./routines`.

```ts
describe('addFigureSlot', () => {
	it('appends slots at 0, 1, 2 and shows up in the shape', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const f1 = figure(db, 'Enchufla');
		const f2 = figure(db, 'Dile que no');
		expect(addFigureSlot(db, routine.id, f1.id)).not.toBeNull();
		expect(addFigureSlot(db, routine.id, f2.id)).not.toBeNull();
		expect(routineSlots(db, routine.id).map((s) => [s.position, s.figureIds])).toEqual([
			[0, [f1.id]],
			[1, [f2.id]]
		]);
		expect(routineShapes(db, 'salsa').get(routine.id)).toEqual({
			slots: [
				{ kind: 'options', figureIds: [f1.id] },
				{ kind: 'options', figureIds: [f2.id] }
			]
		});
	});

	it('refuses a figure from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const other = figure(db, 'Bachata basic', 'bachata');
		expect(addFigureSlot(db, routine.id, other.id)).toBeNull();
		expect(routineSlots(db, routine.id)).toEqual([]);
	});
});

describe('addOption and removeOption', () => {
	it('accepts a second figure that ends in the same place', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds.sort()).toEqual([a.id, b.id].sort());
	});

	it('refuses a figure that ends somewhere else', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const pos = listPositions(db, 'salsa').find((p) => !p.neutral)!;
		setFigurePositions(db, b.id, [], pos.id, 1);
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('counts an untagged figure as ending at the neutral position', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const neutral = listPositions(db, 'salsa').find((p) => p.neutral)!;
		setFigurePositions(db, b.id, [], neutral.id, 1);
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('refuses an option from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const other = figure(db, 'B', 'bachata');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, other.id)).toBe(false);
	});

	it('will not empty a slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		addOption(db, step, b.id);
		expect(removeOption(db, step, a.id)).toBe(true);
		expect(removeOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([b.id]);
	});
});

describe('deleteSlot', () => {
	it('drops the slot, its options, and renumbers what is left', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B', 'C'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(deleteSlot(db, routine.id, ids[0])).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => [s.id, s.position])).toEqual([
			[ids[1], 0],
			[ids[2], 1]
		]);
		expect(deleteSlot(db, routine.id, ids[0])).toBe(false);
	});

	it('refuses a slot belonging to another routine', () => {
		const db = openDb(':memory:');
		const mine = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const theirs = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const step = addFigureSlot(db, theirs.id, figure(db, 'A').id)!;
		expect(deleteSlot(db, mine.id, step)).toBe(false);
		expect(routineSlots(db, theirs.id)).toHaveLength(1);
	});
});

describe('moveSlot', () => {
	it('swaps with a neighbour and keeps positions contiguous', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B', 'C'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlot(db, routine.id, ids[2], -1)).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([ids[0], ids[2], ids[1]]);
		expect(routineSlots(db, routine.id).map((s) => s.position)).toEqual([0, 1, 2]);
	});

	it('refuses to move off either end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlot(db, routine.id, ids[0], -1)).toBe(false);
		expect(moveSlot(db, routine.id, ids[1], 1)).toBe(false);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});
});

describe('setSlotNote', () => {
	it('sets and clears it', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(setSlotNote(db, step, 'hand change')).toBe(true);
		expect(routineSlots(db, routine.id)[0].note).toBe('hand change');
		setSlotNote(db, step, null);
		expect(routineSlots(db, routine.id)[0].note).toBeNull();
	});
});

describe('embedding, one level', () => {
	it('splices the child into the parent shape', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const f = figure(db, 'A');
		addFigureSlot(db, child.id, f.id);
		expect(addChildSlot(db, parent.id, child.id)).not.toBeNull();
		expect(routineShapes(db, 'salsa').get(parent.id)).toEqual({
			slots: [{ kind: 'child', routineId: child.id, slots: [{ kind: 'options', figureIds: [f.id] }] }]
		});
		expect(routineSlots(db, parent.id)[0].childName).toBe('C');
	});

	it('refuses a child that embeds something itself', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const c = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		addChildSlot(db, b.id, c.id);
		expect(canEmbed(db, a.id, b.id)).toBe(false);
		expect(addChildSlot(db, a.id, b.id)).toBeNull();
	});

	it('refuses to embed into a routine that is itself embedded', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const c = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		addChildSlot(db, a.id, b.id);
		expect(canEmbed(db, b.id, c.id)).toBe(false);
		expect(addChildSlot(db, b.id, c.id)).toBeNull();
	});

	it('refuses a routine inside itself', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		expect(canEmbed(db, a.id, a.id)).toBe(false);
	});

	it('refuses a child from the other dance', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'bachata', { name: 'B', notes: null }).routine;
		expect(canEmbed(db, a.id, b.id)).toBe(false);
		expect(addChildSlot(db, a.id, b.id)).toBeNull();
	});

	it('offers only what may be embedded, archived routines excluded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const ok = createRoutine(db, 'salsa', { name: 'OK', notes: null }).routine;
		const nested = createRoutine(db, 'salsa', { name: 'Nested', notes: null }).routine;
		const gone = createRoutine(db, 'salsa', { name: 'Gone', notes: null }).routine;
		addChildSlot(db, nested.id, ok.id);
		archiveRoutine(db, gone.id, 1000);
		expect(embeddable(db, parent.id).map((r) => r.id)).toEqual([ok.id]);
	});
});
```

`listPositions` and `seedPositions` come from `./positions`,
`setFigurePositions` from `./graph`; add them to the spec file's imports.
`setFigurePositions(db, figureId, startIds, endId, eights)` is 3a's writer.

**`openDb(':memory:')` does NOT seed positions** — `seedPositions` is called
from `bootstrap.ts` at boot, not from `openDb`, which is why the three tests
above call it by hand. Tests that never name a position do not need it: an
untagged figure's end resolves through `neutralPosition(...)?.id ?? 0`, so two
untagged figures agree with each other either way.

- [ ] **Step 2: Run the tests to watch them fail**

```sh
nix develop -c npx vitest run src/lib/server/routines.spec.ts
```

Expected: FAIL — the new functions do not exist.

- [ ] **Step 3: Write the mutations**

Append to `src/lib/server/routines.ts`:

```ts
/**
 * Write `ids` as this routine's slot order, positions 0..n-1.
 *
 * Two passes through a negative sentinel range, because
 * `unique (routine_id, position)` is checked per row: any single-pass renumber
 * can collide with a row it has not moved yet. Positions have no CHECK, so the
 * sentinels are legal rows for the duration of the transaction.
 */
function order(tx: Tx, ids: number[]): void {
	ids.forEach((id, i) =>
		tx
			.update(routineSteps)
			.set({ position: -1 - i })
			.where(eq(routineSteps.id, id))
			.run()
	);
	ids.forEach((id, i) =>
		tx.update(routineSteps).set({ position: i }).where(eq(routineSteps.id, id)).run()
	);
}

/** This routine's slot ids, in order. */
function slotIds(tx: Tx, routineId: number): number[] {
	return tx
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(asc(routineSteps.position))
		.all()
		.map((s) => s.id);
}

/** Where a figure leaves the hands, with an untagged one resolved to neutral. */
function endOfFigure(db: Db, dance: DanceSlug, figureId: number): number | null {
	const row = db
		.select({ end: figures.endPositionId })
		.from(figures)
		.where(and(eq(figures.id, figureId), eq(figures.dance, dance), isNull(figures.archivedAt)))
		.get();
	if (!row) return null;
	return row.end ?? neutralPosition(db, dance)?.id ?? 0;
}

/**
 * Append a slot holding one figure. The new slot's id, or null when the figure
 * is not this routine's dance — or is archived, or gone.
 *
 * There is no way to create an EMPTY slot: a slot must hold something, and the
 * cheapest way to guarantee that is never to make one that does not.
 */
export function addFigureSlot(db: Db, routineId: number, figureId: number): number | null {
	const routine = getRoutine(db, routineId);
	if (!routine) return null;
	const dance = routine.dance as DanceSlug;
	if (endOfFigure(db, dance, figureId) === null) return null;
	return db.transaction((tx) => {
		const at = slotIds(tx, routineId).length;
		const step = tx
			.insert(routineSteps)
			.values({ routineId, position: at })
			.returning({ id: routineSteps.id })
			.get();
		tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
		return step.id;
	});
}

/**
 * Whether `childId` may be embedded in `parentId`.
 *
 * Both halves are needed for depth ≤ 2: the child must embed nothing, AND the
 * parent must be embedded nowhere. With both, a cycle is impossible by
 * construction, which is why there is no cycle check anywhere in this module.
 */
export function canEmbed(db: Db, parentId: number, childId: number): boolean {
	if (parentId === childId) return false;
	const parent = getRoutine(db, parentId);
	const child = getRoutine(db, childId);
	if (!parent || !child || parent.dance !== child.dance) return false;
	const childEmbeds = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, childId), isNotNull(routineSteps.childRoutineId)))
		.get();
	if (childEmbeds) return false;
	const parentEmbedded = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(eq(routineSteps.childRoutineId, parentId))
		.get();
	return !parentEmbedded;
}

/** Append a slot holding an embedded routine. Null when `canEmbed` says no. */
export function addChildSlot(db: Db, routineId: number, childId: number): number | null {
	if (!canEmbed(db, routineId, childId)) return null;
	return db.transaction((tx) => {
		const at = slotIds(tx, routineId).length;
		return tx
			.insert(routineSteps)
			.values({ routineId, position: at, childRoutineId: childId })
			.returning({ id: routineSteps.id })
			.get().id;
	});
}

/** The routines this one may embed: same dance, unarchived, and `canEmbed`. */
export function embeddable(db: Db, routineId: number): { id: number; name: string }[] {
	const routine = getRoutine(db, routineId);
	if (!routine) return [];
	return db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.where(and(eq(routines.dance, routine.dance), isNull(routines.archivedAt)))
		.orderBy(asc(routines.name))
		.all()
		.filter((r) => canEmbed(db, routineId, r.id));
}

/**
 * Add an interchangeable figure to a slot.
 *
 * False when the figure is the wrong dance, when the slot holds an embedded
 * routine instead, or when it would land somewhere the slot's other options do
 * not: options that end differently are not variants of each other, they are
 * different steps.
 */
export function addOption(db: Db, stepId: number, figureId: number): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	if (!routine) return false;
	const dance = routine.dance as DanceSlug;
	const end = endOfFigure(db, dance, figureId);
	if (end === null) return false;
	const existing = db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all();
	for (const o of existing) {
		if (o.figureId === figureId) return true;
		if (endOfFigure(db, dance, o.figureId) !== end) return false;
	}
	db.insert(routineStepOptions).values({ stepId, figureId }).run();
	return true;
}

/** Drop an option. False when it would leave the slot empty. */
export function removeOption(db: Db, stepId: number, figureId: number): boolean {
	return db.transaction((tx) => {
		const all = tx
			.select({ figureId: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(eq(routineStepOptions.stepId, stepId))
			.all();
		if (all.length <= 1 || !all.some((o) => o.figureId === figureId)) return false;
		tx.delete(routineStepOptions)
			.where(
				and(eq(routineStepOptions.stepId, stepId), eq(routineStepOptions.figureId, figureId))
			)
			.run();
		return true;
	});
}

export function setSlotNote(db: Db, stepId: number, note: string | null): boolean {
	return (
		db.update(routineSteps).set({ note }).where(eq(routineSteps.id, stepId)).run().changes > 0
	);
}

/**
 * Hard-delete a slot and its options, then renumber.
 *
 * A slot is structure, not an entity — nothing points at it, no set refers to
 * it, and there is no history in it to keep. `routineId` is passed so a slot
 * can only be deleted through the routine it belongs to.
 */
export function deleteSlot(db: Db, routineId: number, stepId: number): boolean {
	return db.transaction((tx) => {
		// Confirm the slot is this routine's BEFORE deleting anything, then take the
		// options first: `routine_step_options.step_id` references `routine_steps.id`
		// and `openDb` sets `foreign_keys = ON`, so deleting the step first would
		// abort on its own children.
		const step = tx
			.select({ id: routineSteps.id })
			.from(routineSteps)
			.where(and(eq(routineSteps.id, stepId), eq(routineSteps.routineId, routineId)))
			.get();
		if (!step) return false;
		tx.delete(routineStepOptions).where(eq(routineStepOptions.stepId, stepId)).run();
		tx.delete(routineSteps).where(eq(routineSteps.id, stepId)).run();
		order(tx, slotIds(tx, routineId));
		return true;
	});
}

/** Swap a slot with its neighbour. `delta` is -1 or 1. */
export function moveSlot(db: Db, routineId: number, stepId: number, delta: -1 | 1): boolean {
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const i = ids.indexOf(stepId);
		const j = i + delta;
		if (i < 0 || j < 0 || j >= ids.length) return false;
		[ids[i], ids[j]] = [ids[j], ids[i]];
		order(tx, ids);
		return true;
	});
}
```

Add `isNotNull` to the `drizzle-orm` import.

- [ ] **Step 4: Run the tests to watch them pass**

```sh
nix develop -c npx vitest run src/lib/server/routines.spec.ts
```

Expected: PASS, 7 + 18 = 25 tests.

- [ ] **Step 5: Prove three of the tests can fail**

1. In `addOption`, change `if (endOfFigure(db, dance, o.figureId) !== end) return false;`
   to `if (false) return false;`. Expected: "refuses a figure that ends
   somewhere else" FAILS.
2. In `canEmbed`, delete the `parentEmbedded` check (`return true` instead).
   Expected: "refuses to embed into a routine that is itself embedded" FAILS.
3. In `order`, remove the first pass (the sentinel loop). Expected: at least one
   of the `moveSlot` / `deleteSlot` tests FAILS — a unique-constraint error is a
   pass for this experiment. If both stay green, the renumber is not being
   exercised: extend the test until it is.

- [ ] **Step 6: Run the full check suite and commit**

```sh
nix develop -c npm run check
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: slots, options, and one level of embedding"
```

---

### Task 6: The routines list

**Files:**

- Create: `src/routes/[dance]/routines/+page.server.ts`
- Create: `src/routes/[dance]/routines/+page.svelte`
- Modify: `src/lib/server/scope.ts`
- Modify: the shell nav (find it with
  `grep -rn "lessons" src/lib/components/shell/`)

**Interfaces:**

- Consumes: `listRoutines`, `routineShapes`, `createRoutine`, `archiveRoutine`
  from `$lib/server/routines`; `buildGraph` from `$lib/server/graph`; `loops`,
  `breaks` from `$lib/routines/routines`; `danceOf` from `$lib/server/scope`;
  `text`, `optionalText`, `int` from `$lib/server/form`.
- Produces: `requireRoutineInDance(db, dance, id)` in `scope.ts`.

- [ ] **Step 1: Add the guard to `src/lib/server/scope.ts`**

After `requirePositionInDance`, matching its comment style:

```ts
/**
 * The routine, or a 404.
 *
 * Every action on the detail page acts on a routine by id, and a slot id in a
 * form body is just a number — so the routine is resolved here first and the
 * slot mutations all take the routine id alongside the slot's, which is what
 * stops a salsa request editing a bachata routine's slots.
 *
 * An archived routine is still a routine: the page shows it and offers to look,
 * the same way an archived position can still be renamed.
 */
export function requireRoutineInDance(db: Db, dance: DanceSlug, id: number) {
	const routine = getRoutine(db, id);
	if (!routine || routine.dance !== dance) throw error(404, 'No such routine');
	return routine;
}
```

Import `getRoutine` from `./routines` alongside the existing imports.

- [ ] **Step 2: Write `+page.server.ts`**

```ts
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { buildGraph } from '$lib/server/graph';
import { archiveRoutine, createRoutine, listRoutines, routineShapes } from '$lib/server/routines';
import { breaks, loops } from '$lib/routines/routines';
import { int, optionalText, text } from '$lib/server/form';
import { danceOf, requireRoutineInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const graph = buildGraph(db, dance);
	const shapes = routineShapes(db, dance);
	// Derived per request, never stored — the same rule urgency follows. A tag
	// edited on a figure page changes these answers with no routine touched.
	return {
		routines: listRoutines(db, dance).map((r) => {
			const shape = shapes.get(r.id) ?? { slots: [] };
			return {
				...r,
				loops: loops(graph, shape),
				breaks: breaks(graph, shape).length
			};
		})
	};
};

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				message: 'Give the routine a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		const { routine } = createRoutine(getDb(), dance, { name, notes });
		throw redirect(303, `/${dance}/routines/${routine.id}`);
	},

	archive: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const id = int(form, 'id');
		if (id === undefined) return fail(400, { message: 'Could not archive that routine.' });
		const db = getDb();
		requireRoutineInDance(db, dance, id);
		archiveRoutine(db, id, Date.now());
		return { ok: true };
	}
};
```

Check `text()`'s signature in `src/lib/server/form.ts` before using it — it may
take a max length. Match how `/[dance]/lessons/+page.server.ts` calls it.

- [ ] **Step 3: Write `+page.svelte`**

Model it on `src/routes/[dance]/lessons/+page.svelte`: the same page shell,
heading, empty state, `<form method="POST" action="?/create" use:enhance>`, and
the same `$lib/components/ui/` primitives. Per row show the name, the slot
count, and — only when there is something to say — a muted hint:

- `{r.breaks} break{r.breaks === 1 ? '' : 's'}` when `r.breaks > 0`
- `does not loop` when `!r.loops && r.slots > 0`

Do not invent new components or colours. Reuse what the lessons list uses; if a
badge style is needed, the positions page (`/[dance]/positions/+page.svelte`)
already has one for dead-end / orphan.

- [ ] **Step 4: Link it from the nav**

Add "Routines" beside Lessons in the shell nav, using `resolve()` for the href
the way the existing links do.

- [ ] **Step 5: Run the check suite and commit**

```sh
nix develop -c npm run check
git add src/routes/\[dance\]/routines/ src/lib/server/scope.ts src/lib/components/shell/
git commit -m "routines: the library list"
```

---

### Task 7: The routine detail route

**Files:**

- Create: `src/routes/[dance]/routines/[id]/+page.server.ts`
- Modify: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**

- Consumes: everything Tasks 4-6 produced.
- Produces: the `load` payload the editor renders in Task 8 —
  `{ routine, slots, figures, positions, names, diagnostics, embeddable, suggestions }`.

- [ ] **Step 1: Write `+page.server.ts`**

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { exercises } from '$lib/server/db/schema';
import { listFigures } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
import { listPositions } from '$lib/server/positions';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	deleteSlot,
	embeddable,
	moveSlot,
	removeOption,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import { breaks, loops, routineEnd, routineStarts, slotStarts } from '$lib/routines/routines';
import { int, optionalText, text } from '$lib/server/form';
import { danceOf, requireRoutineInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const routine = requireRoutineInDance(db, dance, Number(params.id));
	const graph = buildGraph(db, dance);
	const shape = routineShapes(db, dance).get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id);
	const positions = listPositions(db, dance);
	const figures = listFigures(db, dance, {}).map((f) => ({ id: f.id, name: f.name }));

	// Which figures could be added as an option to each slot: the ones that end
	// where that slot already ends. Suggestion, not restriction — the write path
	// is what refuses, and it refuses for the same reason.
	const flatBreaks = new Set(breaks(graph, shape));

	return {
		routine: { id: routine.id, name: routine.name, notes: routine.notes },
		// The routine's own exercise, so "Practise" can hand the player an exercise
		// id and the save sheet comes up with the right one already chosen.
		exerciseId:
			db
				.select({ id: exercises.id })
				.from(exercises)
				.where(eq(exercises.routineId, routine.id))
				.get()?.id ?? null,
		slots,
		figures,
		positions: positions.map((p) => ({ id: p.id, name: p.name })),
		starts: routineStarts(graph, shape),
		end: routineEnd(graph, shape),
		loops: loops(graph, shape),
		// Flat indices, which line up with `slots` only while no slot holds a
		// child. The page shows the count when they diverge rather than pointing
		// at the wrong slot.
		breaks: [...flatBreaks],
		hasChild: slots.some((s) => s.childId !== null),
		embeddable: embeddable(db, routine.id),
		// Per slot: where it can be entered from, so the editor can say so.
		slotStarts: shape.slots.map((s) =>
			s.kind === 'child' ? slotStarts(graph, s.slots[0] ?? { kind: 'options', figureIds: [] }) : slotStarts(graph, s)
		)
	};
};
```

Then the actions. Every one of them: resolve the dance, resolve the routine
through `requireRoutineInDance` (a 404 for the other dance's id), parse the
form, and `fail(400, { message })` on a malformed body. A refused mutation
becomes `fail(400, { message: '<why>' })` — never a silent success.

```ts
export const actions: Actions = {
	rename: async ({ params, request }) => { /* text name, optionalText notes, updateRoutine */ },
	archive: async ({ params, request }) => { /* archiveRoutine, then redirect to the list */ },
	addFigure: async ({ params, request }) => { /* int figureId → addFigureSlot; null → 400
		'That figure is not part of this dance.' */ },
	addChild: async ({ params, request }) => { /* int childId → addChildSlot; null → 400
		'That routine cannot be embedded here.' */ },
	addOption: async ({ params, request }) => { /* int stepId, int figureId → addOption; false → 400
		'Those figures do not end in the same place, so they are not variants.' */ },
	removeOption: async ({ params, request }) => { /* false → 400 'A slot has to hold something.' */ },
	note: async ({ params, request }) => { /* optionalText note (max 200) → setSlotNote */ },
	remove: async ({ params, request }) => { /* int stepId → deleteSlot(db, routine.id, stepId) */ },
	move: async ({ params, request }) => { /* int stepId, int delta ∈ {-1, 1} → moveSlot */ }
};
```

Write them out in full, following the shape
`src/routes/[dance]/figures/[id]/+page.server.ts` uses for its `positions`
action. Two rules that matter:

- **Every slot mutation passes `routine.id`**, so a slot id from another routine
  cannot be edited through this one. `deleteSlot` and `moveSlot` take it
  already; for `addOption`, `removeOption` and `note`, check the slot belongs to
  this routine by looking it up in `routineSlots(db, routine.id)` first and
  `fail(400)` if it is not there.
- **`delta` is validated to exactly -1 or 1** before it reaches `moveSlot`,
  because the type says `-1 | 1` and a form body can say anything.

- [ ] **Step 2: Add the dance-wall tests**

In `src/routes/[dance]/dance-wall.spec.ts`, following the file's existing
pattern exactly (`vi.mock('$lib/server/db')`, a fresh `openDb(':memory:')` per
test). Three tests:

1. `GET /salsa/routines/<a bachata routine's id>` → 404.
2. `POST /salsa/routines/<salsa id>?/addFigure` with a **bachata** figure id →
   the slot is not created. Post a bachata figure, not a bachata routine's slot:
   two different guards reject a bachata routine id, so such a test would pass
   with the guard under test deleted.
3. `POST /salsa/routines/<salsa id>?/remove` with a slot id belonging to a
   **salsa** routine the request does not name → the slot survives.

- [ ] **Step 3: Prove the new guard tests can fail**

Delete the `eq(figures.dance, dance)` clause from `endOfFigure` in
`routines.ts`; test 2 must fail. Delete the `eq(routineSteps.routineId, routineId)`
clause from `deleteSlot`; test 3 must fail. Restore both.

- [ ] **Step 4: Run the check suite and commit**

```sh
nix develop -c npm run check
git add src/routes/\[dance\]/routines/ src/routes/\[dance\]/dance-wall.spec.ts
git commit -m "routines: the detail route and its actions"
```

---

### Task 8: The slot editor

**Files:**

- Create: `src/routes/[dance]/routines/[id]/+page.svelte`

**Interfaces:**

- Consumes: Task 7's `load` payload and its nine actions.

- [ ] **Step 1: Build the page**

Read `src/routes/[dance]/figures/[id]/+page.svelte` first and follow it: the
same shell, the same `$lib/components/ui/` primitives, the same
`use:enhance` forms, Svelte 5 runes (`$props`, `$state`, `$derived`) — no
stores, no `export let`. Sections, in order:

1. **Header** — the name, an inline rename form, the notes, and an "Archive"
   form. A "Practise" link to
   `/{dance}/player?routine={routine.id}&exercise={exerciseId}`, using the
   `exerciseId` Task 7's load returns; drop the `&exercise=` part when it is
   null rather than sending `exercise=null`.
2. **Diagnostics** — one muted line, only when there is something to say:
   "Starts from <names>", "Ends at <name>", and the warnings —
   `{breaks.length} break(s)` and "does not loop". Resolve position ids to
   names through the `positions` map. When `hasChild` is true, show the break
   count but do not mark individual slots: the indices are flat and the slots
   are not.
3. **The slots**, in order. Each row: its 1-based number, its content, its note,
   and the controls.
   - An options slot lists its figures by name, each with a remove form, plus an
     "add a variant" `<select>` of `figures` and a submit.
   - A child slot shows "Routine: <childName>" and nothing to edit inside it —
     it is edited on its own page, with a link there.
   - Both get: a note field (`?/note`), move up / move down (`?/move` with
     `delta`), and remove (`?/remove`). Disable move-up on the first and
     move-down on the last.
4. **Add a slot** — a `<select>` of `figures` posting `?/addFigure`, and, when
   `embeddable` is non-empty, a `<select>` of it posting `?/addChild`.

Keep it one column and thumb-sized: this is used on a phone. No drag and drop —
move up / move down is enough and works without JavaScript.

- [ ] **Step 2: Check it renders**

```sh
nix develop -c npm run check
```

`svelte-check` is the gate here. There is no component test suite in this repo;
do not invent one.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\[dance\]/routines/
git commit -m "routines: the slot editor"
```

---

### Task 9: Playing a routine

**Files:**

- Modify: `src/lib/scheduler/attach.ts`
- Modify: `src/lib/server/figures.ts`
- Modify: `src/routes/[dance]/player/+page.server.ts`
- Modify: `src/routes/[dance]/player/+page.svelte`
- Modify: `src/lib/components/player/Setup.svelte`

**Interfaces:**

- Consumes: `routinePlan` from `$lib/routines/plan`; `routineShapes`,
  `requireRoutineInDance` from the server modules.
- Produces: `PlayerOptions.planner`; `listFiguresForCall(db, dance, ids)`.

- [ ] **Step 1: Add the `planner` hook to `attach.ts`**

In `PlayerOptions`, after `flow`:

```ts
	/**
	 * Decides the whole plan instead of picking figure by figure — which is how a
	 * routine plays. Given the plan so far it returns the plan extended through
	 * `throughEight`, and must never change a step it has already returned.
	 *
	 * A function the page supplies, exactly as `flow` is, so this module never
	 * learns what a routine is.
	 */
	planner?: (
		plan: PlanStep[],
		every: CallEvery,
		throughEight: number,
		rand: () => number
	) => PlanStep[];
```

And the one branch, replacing the existing `extendPlan` call (around line 295):

```ts
		if (toggles.callEvery !== null && pool.length > 0) {
			// Decide calls a bar or two ahead of where we are scheduling sound.
			const through = eightAt(until) + 2;
			plan = opts.planner
				? opts.planner(plan, toggles.callEvery as CallEvery, through, Math.random)
				: extendPlan(plan, pool, toggles.callEvery as CallEvery, through, Math.random, opts.flow);
		}
```

`pool.length > 0` stays as the gate, unchanged: the page passes the routine's
own figure ids as the pool, so a routine with nothing callable falls silent for
the same reason an empty pool does.

- [ ] **Step 2: Add `listFiguresForCall` to `src/lib/server/figures.ts`**

Beside `listCallableFigures`, returning the same `CallableFigure[]`:

```ts
/**
 * Named figures in the same shape `listCallableFigures` returns, for figures
 * called by id rather than drawn from the pool — a routine's options.
 *
 * `callable` is not consulted: that flag says "offer this in the drill's
 * picker", and a routine names its figures explicitly. Archived ones are still
 * excluded, because `buildGraph` excludes them too and the planner will never
 * reach one.
 */
export function listFiguresForCall(db: Db, dance: DanceSlug, ids: number[]): CallableFigure[] {
	if (ids.length === 0) return [];
	return db
		.select({
			id: figures.id,
			name: figures.name,
			callText: figures.callText,
			partner: figures.partner,
			style: figures.styleTag
		})
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), inArray(figures.id, ids)))
		.orderBy(figures.name)
		.all()
		.map(({ callText, ...f }) => ({ ...f, say: callText ?? f.name }));
}
```

- [ ] **Step 3: Load the routine in the player**

In `src/routes/[dance]/player/+page.server.ts`'s `load`, after the song block:

```ts
	const routineId = Number(url.searchParams.get('routine')) || null;
	const routine = routineId ? getRoutine(db, routineId) : null;
	// Same id-scoping as the song and the exercise: a routine from the other
	// dance is not this player's to walk.
	if (routineId && (!routine || routine.archivedAt !== null || routine.dance !== dance)) {
		throw error(404, 'No such routine');
	}
	const shape = routine ? (routineShapes(db, dance).get(routine.id) ?? { slots: [] }) : null;
	// Every figure the routine can call, so the voice has a name for one that is
	// not in the drill's callable pool.
	const routineFigureIds = shape
		? [
				...new Set(
					shape.slots.flatMap((s) =>
						s.kind === 'child' ? s.slots.flatMap((c) => c.figureIds) : s.figureIds
					)
				)
			]
		: [];
```

and in the returned object:

```ts
		routine: routine && shape ? { id: routine.id, name: routine.name, shape } : null,
		figures: [
			...listCallableFigures(db, dance),
			...listFiguresForCall(db, dance, routineFigureIds)
		].filter((f, i, all) => all.findIndex((o) => o.id === f.id) === i),
```

- [ ] **Step 4: Pass the planner**

In `src/routes/[dance]/player/+page.svelte`, import `routinePlan` from
`$lib/routines/plan` and add to the `createPlayer({...})` call:

```ts
			// A routine decides the whole plan; the drill's flow picks one figure at
			// a time. Never both.
			planner: data.routine
				? (plan, every, through, rand) =>
						routinePlan(plan, data.routine!.shape, data.graph, every, through, rand)
				: undefined,
```

And pass the routine down to `Setup` so the pool comes from it:

```svelte
	<Setup
		…
		routine={data.routine && {
			name: data.routine.name,
			figureIds: [
				...new Set(
					data.routine.shape.slots.flatMap((s) =>
						s.kind === 'child' ? s.slots.flatMap((c) => c.figureIds) : s.figureIds
					)
				)
			]
		}}
	/>
```

- [ ] **Step 5: Show the routine in `Setup.svelte`**

Add an optional prop `routine: { name: string; figureIds: number[] } | null`
(default `null`). When it is set: render one line — "Routine: <name>, N
figures" — in place of the figure-pool picker, and force `figureIds` in the
emitted `PlayerSettings` to `routine.figureIds`. Everything else (source, bpm,
count, clave, callEvery, speed, volume) stays exactly as it is: a routine is
still practised at a chosen tempo with the count on.

- [ ] **Step 6: Run the check suite and commit**

```sh
nix develop -c npm run check
git add src/lib/scheduler/attach.ts src/lib/server/figures.ts src/routes/\[dance\]/player/ src/lib/components/player/Setup.svelte
git commit -m "routines: the player walks one"
```

---

### Task 10: The documentation this changes

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md`
- Modify: `docs/superpowers/specs/2026-09-24-routines-design.md`

- [ ] **Step 1: `CLAUDE.md`**

In the opening paragraph's phase list, move 3b across: the "**Not built:** phase
3b, routines." line goes, and the live list gains "phase 3b (routines: slots,
variants, one-level embedding, and the player walking one)".

In the Layout block, after the `src/lib/graph/` entry:

```
src/lib/routines/    PURE routine algebra: slots, variants, breaks, whether it
                     loops, and the routine as the player's plan. Client-safe
```

- [ ] **Step 2: `2026-09-22-salsa-app-design.md`**

Three edits, found with `grep -n choreography`:

- the vocabulary table's **Choreography** row becomes **Routine**, pointing at
  the routines spec;
- line ~116's `source 'figure' | 'choreography' | 'custom' | 'lesson'` becomes
  `'figure' | 'routine' | 'custom' | 'lesson'`;
- the phase 3 line and line ~426 say 3a **and** 3b are live, and keep the
  "song-bound choreography is out of scope" sentence, which is still true.

- [ ] **Step 3: `2026-09-24-routines-design.md` — the spacing amendment**

Under "Playing a routine", replace "space by the chosen figure's `eights`" with:

```markdown
`routinePlan(plan, shape, graph, every, throughEight, rand)` → `PlanStep[]`:
flatten children, resolve each slot's options against the incoming position,
space by `max(every, eights)` — the drill's own rule — and loop back to the
start when the song outlasts the routine. Same `PlanStep[]` the drill produces,
so the scheduler and `attach.ts` need no routine-specific code at all: the page
hands them a `planner` the way it already hands them a `flow`.

Spacing is `max(every, eights)` rather than `eights` alone because
`figures.eights` defaults to 1 for the whole existing repertoire, and a call
every 8-count is 2.7 seconds at 180 BPM — not danceable. The user's call rate
governs where the data is silent; a figure carrying a real `eights` still gets
its own length whenever that is longer. One spacing rule, one expression, both
planners.
```

Also update the **Two slices** section so 3b reads as built, and strike
"3b (routines themselves) not started" wherever the spec implies it.

- [ ] **Step 4: Commit**

```sh
nix develop -c npm run check
git add CLAUDE.md docs/
git commit -m "docs: routines are built"
```

---

## What is NOT in this plan

Straight from the spec's "Deliberately not included", so no implementer adds
them on initiative: song-bound choreography (no `song_id` on a routine, no
`start_8` on a slot, no timeline editor); figure-to-figure overrides; a slot
holding a choice between two routines; urgency-weighted calls; a transition as
its own exercise; a flow on/off toggle; and a route for moving a dance's neutral
position.

Two more, specific to this slice:

- **No drag-and-drop slot reordering.** Move up / move down, which works with
  no JavaScript.
- **No "suggest the next figure" picker** beyond listing every figure of the
  dance. The write path refuses what does not fit, and that is enough feedback.

## Carried debt this plan should fix on the way past

Recorded during 3a, and the only record of it is project memory:

- `int(form, key)` in `src/lib/server/form.ts:15` returns **0** for an empty
  string AND for a missing key, because `Number('')` and `Number(null)` are both
  `0` and both pass `Number.isInteger`. Its contract says undefined on bad
  input. Every 3b action parses ids with it, so fix it in Task 6:

  ```ts
  export function int(form: FormData, key: string): number | undefined {
  	const raw = form.get(key);
  	if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  	const v = Number(raw);
  	return Number.isInteger(v) ? v : undefined;
  }
  ```

  Then check every existing caller still behaves: `grep -rn "int(form" src/`.
  A caller that relied on the old `0` for a missing field would now see
  `undefined` — which is what its own validation already handles, but confirm it
  rather than assume. Add `src/lib/server/form.spec.ts` with a test for the
  empty string, the missing key, and a good value; nothing covers `form.ts`
  today.
- A position `rename` can produce two positions with the same displayed name
  (only `(dance, slug)` is unique). Out of scope here; leave it.

## Self-review

**Spec coverage.** `routines` / `routine_steps` / `routine_step_options` /
`exercises.routine_id` → Task 1. The variant algebra (union starts, shared end,
slot holds something, borrowed child shape, break-is-a-warning) → Tasks 2 and 5.
Embedding one level, both directions → Task 5. `routinePlan` with flattening,
option resolution, spacing and looping → Task 3. `SOURCES` gains `'routine'` →
Task 1. Creating a routine creates its exercise; rename renames; archive
archives → Task 4. The three cross-dance invariants → Task 5, with route-level
guards in Tasks 6-7. `/[dance]/routines`, `/[dance]/routines/[id]`, and the
player opened from a routine → Tasks 6, 7, 8, 9. "Does not loop" on the list and
the detail page → Tasks 6 and 8. `scope.ts` guard → Task 6. Testing section →
the spec files in Tasks 2, 3, 5, 7. Documentation → Task 10.

**Deviation.** One, argued in Task 3 and amended in Task 10: spacing is
`max(every, eights)`, not `eights` alone.

**Type consistency.** `RoutineShape`/`Slot`/`OptionsSlot`/`ChildSlot` are
declared in Task 2 and used under those names in Tasks 3, 4, 7, 9.
`routinePlan`'s parameter order `(plan, shape, g, every, throughEight, rand)` is
the same in Task 3's tests, its implementation, and the `planner` closure in
Task 9. `addFigureSlot`/`addChildSlot` return `number | null`; `addOption`/
`removeOption`/`setSlotNote`/`deleteSlot`/`moveSlot` return `boolean`;
`canEmbed` returns `boolean`; `embeddable` returns `{id, name}[]` — used
consistently in Tasks 5, 6, 7. `SlotRow` is declared in Task 4's `types.ts`
edit and consumed in Tasks 7 and 8.
