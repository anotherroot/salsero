# Figure timing and one edit mode — Implementation Plan (slice 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figures carry a start count (1–8) and a length in counts; routines report timing breaks and refuse alternatives that land on a different count; the figure page edits everything in one form with one Save; routine slot "variants" are renamed "alternatives".

**Architecture:** Two nullable columns on `figures` (`start_count`, `length_counts`) with a backfill from `eights`. The data layer resolves nulls (start → 1, length → 8) when it builds a `Graph`, so the pure layer (`src/lib/graph/`, `src/lib/routines/`) always sees concrete `start`/`length` on a `GraphFigure`. A new pure module `src/lib/graph/timing.ts` owns the arithmetic (`nextCount`, `eightsSpan`). The drill and the routine player keep planning in 8-counts, deriving them from `length_counts`.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle ORM on SQLite (better-sqlite3), Vitest, Tailwind. Toolchain from the nix flake.

**Spec:** `docs/superpowers/specs/2026-09-29-figure-variations-design.md` — this plan implements its **slice 1** ("Timing and one edit mode"). Slices 2 (variations) and 3 (visual routine player) get their own plans after this ships.

## Global Constraints

- Run every node command through the flake: `nix develop -c <cmd>` (e.g. `nix develop -c npx vitest run <file>`). `npx`/`node` are not on PATH outside it.
- `nix develop` exports `DATA_DIR`/`DATABASE_PATH` pointing at `.data/`. To run the app against another database, set them **inside** the shell: `nix develop -c env DATABASE_PATH=... node build`.
- Never add a CHECK to an existing table; additive `ALTER TABLE ... ADD COLUMN` only. `figures` can never be rebuilt. Read the generated SQL before committing it.
- Data functions take `db` first. Specs use `openDb(':memory:')`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does. A spec must never touch `$DATA_DIR`.
- Nothing under `$lib/server` is imported by components.
- `src/lib/graph/` and `src/lib/routines/` stay PURE: no database, no DOM, no `Date.now()`, no knowledge of dances.
- Timing values, verbatim from the spec: `start_count` is 1..8, null reads as 1. `length_counts` is counts, null reads as 8. The form accepts lengths 1..64. `nextCount = ((start − 1 + length) mod 8) + 1`.
- UI wording: slot "Variants" / "+ Variant" become **"Alternatives" / "+ Alternative"**. Table and column names (`routine_step_options`) do not change.
- `figures.eights` stays in the schema, VESTIGIAL. Do not drop it.
- Commit messages follow the repo's `area: what changed` style and end with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `nix develop -c npm run check` (prettier + eslint + svelte-check + build + vitest) must pass at the end of every task that touches `src/`.

## Review Focus

1. **A figure save that fails halfway.** Posting a valid name with a start position from the other dance must write NOTHING — not even the name. The route must call `setFigureShape` (which can refuse) before `updateFigure`. Pinned in Task 6.
2. **Out-of-range timing from a hand-built POST** — start count 0, 9 or `abc`, length 0 or 65 — must be refused with a message and write nothing. Pinned in Tasks 3 and 6.
3. **Existing routines must not grow timing breaks after the migration.** Every existing figure becomes start 1 with a multiple of 8 counts, so every `nextCount` is 1. Pinned in Task 4 (a 1×8 → 2×8 → 1×8 chain has no timing break) and checked for real against a copy of the dev database in Task 3.
4. **A hand-edited slot whose alternatives disagree on their next count** must read as "unknown", report no timing break out of it, and never crash the editor. Pinned in Task 4.
5. **An embedded routine with nothing danceable** must give `{ starts: [], next: null }` for its row, not throw. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/graph/timing.ts` (new) | Pure timing arithmetic and limits: `nextCount`, `eightsSpan`, `isStartCount`, `isLengthCounts`, defaults. |
| `src/lib/graph/timing.spec.ts` (new) | Its tests. |
| `src/lib/graph/graph.ts` | `GraphFigure` swaps `eights` for resolved `start`/`length`; adds `nextCountOf`. |
| `src/lib/graph/flow.ts` | Drill spacing from `eightsSpan(length)`. |
| `src/lib/routines/plan.ts` | Routine call spacing from `eightsSpan(length)` (deleted in slice 3). |
| `src/lib/routines/routines.ts` | `slotStartCounts`, `sharedNextCount`, `slotTiming`, `timingBreaks`, timing-aware `loops`. |
| `src/lib/server/db/schema.ts` | `startCount`, `lengthCounts` columns; `eights` marked vestigial. |
| `drizzle/0010_*.sql` (generated + one appended UPDATE) | The migration and the backfill. |
| `src/lib/server/graph.ts` | `buildGraph` resolves timing; `setFigurePositions` → `setFigureShape` (positions + timing, one transaction). `MAX_EIGHTS` removed. |
| `src/lib/server/figures.ts` | `createFigure` stores `length_counts = 8`. |
| `src/lib/server/routines.ts` | `addOption` also requires the same `nextCount`. |
| `src/lib/server/practice-content.ts` | Cue `eights` derived from `length_counts`. |
| `src/lib/components/figures/FigureTiming.svelte` (new) | Start-count chips and the counts input. |
| `src/routes/[dance]/figures/[id]/+page.server.ts` / `+page.svelte` | One `update` action and one Edit form; the `positions` action and form are gone. |
| `src/routes/[dance]/routines/[id]/+page.server.ts` / `+page.svelte` | Timing per slot, timing breaks, alternatives wording, fitting-only alternative picker. |
| `src/routes/[dance]/routines/+page.server.ts` | List hint counts timing breaks too. |
| Docs: spec pointers, `CLAUDE.md` | Keep the design current. |

---

### Task 0: Branch

- [ ] **Step 1: Create the working branch**

```bash
git switch -c figure-timing
```

---

### Task 1: Pure timing arithmetic

**Files:**
- Create: `src/lib/graph/timing.ts`
- Test: `src/lib/graph/timing.spec.ts`

**Interfaces:**
- Produces:
  - `COUNTS_PER_EIGHT = 8`, `DEFAULT_START_COUNT = 1`, `DEFAULT_LENGTH_COUNTS = 8`, `MAX_LENGTH_COUNTS = 64`
  - `isStartCount(n: unknown): n is number` — integer 1..8
  - `isLengthCounts(n: unknown): n is number` — integer 1..64
  - `nextCount(start: number, length: number): number` — 1..8
  - `eightsSpan(length: number): number` — `max(1, ceil(length / 8))`

- [ ] **Step 1: Write the failing test**

`src/lib/graph/timing.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eightsSpan, isLengthCounts, isStartCount, nextCount } from './timing';

describe('nextCount', () => {
	it.each([
		[1, 8, 1],
		[5, 4, 1],
		[1, 4, 5],
		[1, 16, 1],
		[3, 6, 1],
		[8, 1, 1],
		[7, 3, 2]
	])('a figure from %i taking %i counts leaves the next on %i', (start, length, next) => {
		expect(nextCount(start, length)).toBe(next);
	});
});

describe('eightsSpan', () => {
	it('rounds up to whole 8-counts, never below one', () => {
		expect(eightsSpan(8)).toBe(1);
		expect(eightsSpan(4)).toBe(1);
		expect(eightsSpan(12)).toBe(2);
		expect(eightsSpan(16)).toBe(2);
		expect(eightsSpan(1)).toBe(1);
	});
});

describe('limits', () => {
	it('accepts start counts 1..8 only, as integers', () => {
		expect([1, 5, 8].every(isStartCount)).toBe(true);
		expect([0, 9, 1.5, NaN, '1', null].some(isStartCount)).toBe(false);
	});

	it('accepts lengths 1..64 only, as integers', () => {
		expect([1, 8, 64].every(isLengthCounts)).toBe(true);
		expect([0, 65, 4.5, NaN, '8', null].some(isLengthCounts)).toBe(false);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `nix develop -c npx vitest run src/lib/graph/timing.spec.ts`
Expected: FAIL — `Failed to resolve import "./timing"`.

- [ ] **Step 3: Implement**

`src/lib/graph/timing.ts`:

```ts
/**
 * Figure timing: which count of the 8-count a figure begins on, how many
 * counts it takes, and so which count it leaves the next figure to begin on.
 *
 * PURE and client-safe, like the rest of `src/lib/graph/`.
 *
 * Counts, not steps. Salsa takes six steps in eight counts and bachata differs
 * again; a count is the same unit in every dance, and the one the beat grid
 * already speaks.
 */

export const COUNTS_PER_EIGHT = 8;

/** What an unset start count reads as: the figure begins on "1". */
export const DEFAULT_START_COUNT = 1;

/** What an unset length reads as: one 8-count. */
export const DEFAULT_LENGTH_COUNTS = 8;

/** The longest figure the form accepts — eight 8-counts, the old `MAX_EIGHTS`. */
export const MAX_LENGTH_COUNTS = 64;

export function isStartCount(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= COUNTS_PER_EIGHT;
}

export function isLengthCounts(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_LENGTH_COUNTS;
}

/**
 * The count the FOLLOWING figure should begin on. A figure from 5 taking four
 * counts is done by 8, so the next begins on 1; one from 1 taking four leaves
 * the next on 5.
 */
export function nextCount(start: number, length: number): number {
	return ((start - 1 + length) % COUNTS_PER_EIGHT) + 1;
}

/**
 * How many whole 8-counts a figure occupies, for the planners that still work
 * in 8-counts (the drill, and the routine player until slice 3). Never below
 * one: a four-count figure still owns the 8-count it is called in.
 */
export function eightsSpan(length: number): number {
	return Math.max(1, Math.ceil(length / COUNTS_PER_EIGHT));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `nix develop -c npx vitest run src/lib/graph/timing.spec.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/timing.ts src/lib/graph/timing.spec.ts
git commit -m "graph: timing arithmetic — start count, length in counts, next count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `GraphFigure` carries `start` and `length`

A pure refactor: every existing figure is start 1, length `eights × 8`, so all behaviour stays identical and the existing tests (after their fixtures are converted) keep passing.

**Files:**
- Modify: `src/lib/graph/graph.ts` (the `GraphFigure` interface, plus a new export)
- Modify: `src/lib/graph/flow.ts:63-65`
- Modify: `src/lib/routines/plan.ts:44`
- Modify fixtures: `src/lib/graph/graph.spec.ts:23-28`, `src/lib/graph/flow.spec.ts:18-21,100`, `src/lib/routines/plan.spec.ts:11-15`, `src/lib/routines/routines.spec.ts:25-29`
- Modify: `src/lib/server/graph.ts` (`buildGraph` only — the columns do not exist yet, so it maps `eights`)
- Test: `src/lib/graph/graph.spec.ts` (new `nextCountOf` case)

**Interfaces:**
- Consumes: `nextCount`, `eightsSpan` from Task 1.
- Produces:
  - `GraphFigure = { id: number; starts: number[]; end: number | null; start: number; length: number }` — `start`/`length` always resolved, never null. `eights` is REMOVED.
  - `nextCountOf(f: GraphFigure): number`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/graph/graph.spec.ts` (and add `nextCountOf` to its import from `'./graph'`):

```ts
describe('nextCountOf', () => {
	it('reads the figure’s own start and length', () => {
		expect(nextCountOf({ id: 1, starts: [], end: null, start: 5, length: 4 })).toBe(1);
		expect(nextCountOf({ id: 2, starts: [], end: null, start: 1, length: 4 })).toBe(5);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `nix develop -c npx vitest run src/lib/graph/graph.spec.ts`
Expected: FAIL — `nextCountOf` is not exported (and type errors on `start`/`length`).

- [ ] **Step 3: Change the type and add `nextCountOf`**

In `src/lib/graph/graph.ts`, replace the `eights` member of `GraphFigure`:

```ts
	/** How many 8-counts it takes. */
	eights: number;
```

with:

```ts
	/**
	 * The count it begins on, 1..8. Always resolved — the data layer turns a
	 * null column into 1 before building the graph, so nothing here guesses.
	 */
	start: number;
	/** How many counts it takes. Resolved the same way; null reads as 8. */
	length: number;
```

Add at the top of the file, after the header comment:

```ts
import { nextCount } from './timing';
```

and after `figureById`:

```ts
/** The count the figure leaves the next one to begin on. */
export function nextCountOf(f: GraphFigure): number {
	return nextCount(f.start, f.length);
}
```

- [ ] **Step 4: Derive the planners' 8-counts from `length`**

`src/lib/graph/flow.ts` — add `import { eightsSpan } from './timing';` and replace:

```ts
		eights(figureId) {
			return figureById(g, figureId)?.eights ?? 1;
		}
```

with:

```ts
		eights(figureId) {
			const f = figureById(g, figureId);
			return f ? eightsSpan(f.length) : 1;
		}
```

`src/lib/routines/plan.ts` — add `import { eightsSpan } from '$lib/graph/timing';` and replace line 44:

```ts
	const eightsOf = (id: number) => figureById(g, id)?.eights ?? 1;
```

with:

```ts
	const eightsOf = (id: number) => {
		const f = figureById(g, id);
		return f ? eightsSpan(f.length) : 1;
	};
```

- [ ] **Step 5: Map the existing column in `buildGraph`**

In `src/lib/server/graph.ts`, `buildGraph`'s return currently ends each figure with `eights: r.eights`. Replace that line with:

```ts
			start: 1,
			length: r.eights * 8
```

(Task 3 replaces this with the real columns.)

- [ ] **Step 6: Convert the pure fixtures**

```bash
perl -pi -e 's/\beights: 1\b/start: 1, length: 8/g; s/\beights: 2\b/start: 1, length: 16/g' \
  src/lib/graph/flow.spec.ts src/lib/routines/plan.spec.ts src/lib/routines/routines.spec.ts
```

In `src/lib/graph/graph.spec.ts` replace the `fig` helper:

```ts
const fig = (
	id: number,
	starts: number[] = [],
	end: number | null = null,
	eights = 1
): Graph['figures'][number] => ({ id, starts, end, eights });
```

with:

```ts
const fig = (
	id: number,
	starts: number[] = [],
	end: number | null = null,
	length = 8
): Graph['figures'][number] => ({ id, starts, end, start: 1, length });
```

No existing call passes a fourth argument, so no call site changes.

In `src/lib/server/graph.spec.ts`, the assertion `expect(g.figures[0].eights).toBe(2);` becomes `expect(g.figures[0].length).toBe(16);` (it is rewritten again in Task 3).

- [ ] **Step 7: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS. `flow.spec.ts`'s `expect(flow.eights(2)).toBe(2)` still holds because figure 2 now has `length: 16`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/graph src/lib/routines src/lib/server/graph.ts src/lib/server/graph.spec.ts
git commit -m "graph: a figure carries start count and length in counts, not eights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The columns, the backfill, and `setFigureShape`

**Files:**
- Modify: `src/lib/server/db/schema.ts` (the `figures` table)
- Create: `drizzle/0010_<generated>.sql` (+ `drizzle/meta/*` generated)
- Modify: `src/lib/server/graph.ts` (`buildGraph`, `setFigurePositions` → `setFigureShape`, remove `MAX_EIGHTS`)
- Modify: `src/lib/server/figures.ts` (`createFigure`)
- Modify: `src/lib/server/practice-content.ts:75`
- Modify callers: `src/lib/server/routines.spec.ts:25,185,198`, `src/routes/[dance]/figures/[id]/+page.server.ts` (import + the `positions` action, kept working until Task 6)
- Test: `src/lib/server/graph.spec.ts` (including `createFigure`'s default), `src/lib/server/practice-content.spec.ts`

**Interfaces:**
- Consumes: Task 1's constants and guards.
- Produces:
  - schema: `figures.startCount: integer('start_count')` (nullable), `figures.lengthCounts: integer('length_counts')` (nullable)
  - `interface FigureShape { startIds: number[]; endId: number | null; startCount: number; lengthCounts: number }` exported from `src/lib/server/graph.ts`
  - `setFigureShape(db: Db, figureId: number, shape: FigureShape): boolean` — replaces `setFigurePositions`. False (writing nothing) when the figure is gone, a timing value is out of range, or a position is of another dance.
  - `buildGraph` fills `start = start_count ?? 1`, `length = length_counts ?? 8`.
  - `createFigure` stores `lengthCounts: 8`.
  - `MAX_EIGHTS` no longer exists.

- [ ] **Step 1: Write the failing tests**

In `src/lib/server/graph.spec.ts`, change the import line to:

```ts
import { buildGraph, figurePositions, setFigureShape } from './graph';
```

add `import { figures } from './db/schema';` next to the `figureStartPositions` import (merge into one import: `import { figures, figureStartPositions } from './db/schema';`), add `import { eq } from 'drizzle-orm';`, and replace the whole `describe('setFigurePositions', …)` block (from `describe('setFigurePositions', () => {` to its closing `});`) with:

```ts
/** A shape with neutral timing, so each test only states what it is about. */
const shape = (
	startIds: number[],
	endId: number | null,
	timing: { startCount?: number; lengthCounts?: number } = {}
) => ({ startIds, endId, startCount: 1, lengthCounts: 8, ...timing });

describe('setFigureShape', () => {
	it('stores starts, end and timing, and the graph reads them back', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(
			setFigureShape(
				db,
				made.figure.id,
				shape([pos('open-two'), pos('cross-hand')], pos('hammerlock-r'), {
					startCount: 5,
					lengthCounts: 12
				})
			)
		).toBe(true);

		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('open-two'), pos('cross-hand')].sort((a, b) => a - b),
			endId: pos('hammerlock-r')
		});
		const g = buildGraph(db, 'salsa');
		expect(g.figures[0]).toMatchObject({ start: 5, length: 12, end: pos('hammerlock-r') });
	});

	it('replaces the starts rather than adding to them', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		setFigureShape(db, made.figure.id, shape([pos('open-two'), pos('cross-hand')], null));
		setFigureShape(db, made.figure.id, shape([pos('closed')], null));
		expect(figurePositions(db, made.figure.id).startIds).toEqual([pos('closed')]);
	});

	it('refuses a position from the other dance, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;

		expect(setFigureShape(db, made.figure.id, shape([bachataShadow.id], null))).toBe(false);
		expect(
			setFigureShape(db, made.figure.id, shape([pos('open-two')], bachataShadow.id, { startCount: 5 }))
		).toBe(false);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endId: null });
		// The timing half of the refused write did not land either.
		expect(buildGraph(db, 'salsa').figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('refuses timing out of range and a missing figure, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const id = made.figure.id;
		const open = [pos('open-two')];
		expect(setFigureShape(db, id, shape(open, null, { startCount: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { startCount: 9 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { startCount: 1.5 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { lengthCounts: 0 }))).toBe(false);
		expect(setFigureShape(db, id, shape(open, null, { lengthCounts: 65 }))).toBe(false);
		expect(setFigureShape(db, 9999, shape(open, null))).toBe(false);
		expect(figurePositions(db, id).startIds).toEqual([]);
	});

	it('rejects a duplicate (figure, position) row at the database level', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const row = { figureId: made.figure.id, positionId: pos('open-two') };
		db.insert(figureStartPositions).values(row).run();
		// The composite primary key is the backstop for the de-duplication
		// `setFigureShape` does in code. Nothing else in the suite reaches it.
		expect(() => db.insert(figureStartPositions).values(row).run()).toThrow();
	});

	it('de-duplicates a repeated start position rather than throwing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const open = pos('open-two');
		expect(setFigureShape(db, made.figure.id, shape([open, open], null))).toBe(true);
		expect(figurePositions(db, made.figure.id).startIds).toEqual([open]);
	});

	it('keeps a tag pointing at a position after it is archived', () => {
		// The authority spec: "An archived position stays referenced by the
		// figures tagged with it, so history and existing routines keep meaning."
		// A page round-trip re-posts the SAME ids on every save, archived or not,
		// so this is what that save must not lose.
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const crossHand = pos('cross-hand'); // not the neutral row, so it can be archived
		expect(setFigureShape(db, made.figure.id, shape([crossHand], crossHand))).toBe(true);
		expect(archivePosition(db, crossHand, Date.now())).toBe(true);
		expect(setFigureShape(db, made.figure.id, shape([crossHand], crossHand))).toBe(true);
		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [crossHand],
			endId: crossHand
		});
	});
});

describe('timing defaults', () => {
	it('stores a new figure as 8 counts, and reads a null start as 1', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		expect(made.figure.lengthCounts).toBe(8);
		expect(made.figure.startCount).toBeNull();
		expect(buildGraph(db, 'salsa').figures[0]).toMatchObject({ start: 1, length: 8 });
	});

	it('reads a null length as 8 — a row the backfill or createFigure never touched', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		db.update(figures).set({ lengthCounts: null }).where(eq(figures.id, made.figure.id)).run();
		expect(buildGraph(db, 'salsa').figures[0].length).toBe(8);
	});
});
```

In `src/lib/server/practice-content.spec.ts`, add these imports at the top:

```ts
import { eq } from 'drizzle-orm';
import { figures } from './db/schema';
```

and, directly after the test `'gives a figure its notes, spoken name, length and links'`, add:

```ts
	it('derives the cue’s 8-counts from the figure’s length in counts', () => {
		const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
		db.update(figures).set({ lengthCounts: 12 }).where(eq(figures.id, figure.id)).run();
		const content = practicePayload(db, exercise, TZ, Date.now()).content;
		// 12 counts round up to two 8-counts, so the cue is never called over itself.
		expect(content.type === 'figure' && content.figure.eights).toBe(2);
	});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/graph.spec.ts src/lib/server/practice-content.spec.ts`
Expected: FAIL — `setFigureShape` is not exported; `lengthCounts` does not exist.

- [ ] **Step 3: Add the columns**

In `src/lib/server/db/schema.ts`, inside `figures`, replace:

```ts
		/** How many 8-counts the figure takes. The drill spaces calls by it. */
		eights: integer('eights').notNull().default(1),
```

with:

```ts
		/**
		 * VESTIGIAL since migration 0010, which copied it into `length_counts`
		 * (`eights * 8`). Read by nothing. It cannot be dropped for the same reason
		 * `style` cannot — dropping a column is a table rebuild, and this table can
		 * never be rebuilt. Do not "clean this up".
		 */
		eights: integer('eights').notNull().default(1),
		/**
		 * The count the figure begins on, 1..8. Null reads as 1 — see
		 * `src/lib/graph/timing.ts`. No CHECK, for the reason above;
		 * `setFigureShape` in `src/lib/server/graph.ts` is the enforcement.
		 */
		startCount: integer('start_count'),
		/**
		 * How many COUNTS the figure takes — counts, not steps, so the unit is the
		 * same in every dance. Null reads as 8. Backfilled from `eights` by
		 * migration 0010; `createFigure` writes 8.
		 */
		lengthCounts: integer('length_counts'),
```

- [ ] **Step 4: Generate the migration and append the backfill**

Run: `nix develop -c npm run db:generate`

Open the new `drizzle/0010_*.sql`. It must contain exactly two `ALTER TABLE \`figures\` ADD ...` statements and nothing else — if it contains `CREATE TABLE \`__new_figures\`` or `DROP TABLE`, STOP: something asked for a rebuild. Append, **before running anything else against a database**:

```sql
--> statement-breakpoint
UPDATE `figures` SET `length_counts` = `eights` * 8;
```

The file then reads:

```sql
ALTER TABLE `figures` ADD `start_count` integer;--> statement-breakpoint
ALTER TABLE `figures` ADD `length_counts` integer;--> statement-breakpoint
UPDATE `figures` SET `length_counts` = `eights` * 8;
```

(The exact spacing of the generated lines may differ; the two ALTERs and the appended UPDATE are what matter.)

- [ ] **Step 5: Implement `setFigureShape` and the graph mapping**

In `src/lib/server/graph.ts`:

Replace the imports' tail so it reads:

```ts
import type { Graph } from '$lib/graph/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount
} from '$lib/graph/timing';
import type { DanceSlug } from '$lib/dances/dances';
```

Delete:

```ts
/** How many 8-counts a figure may be tagged as taking. */
export const MAX_EIGHTS = 8;
```

In `buildGraph`, change the select's `eights: figures.eights` to:

```ts
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts
```

and the Task 2 mapping `start: 1, length: r.eights * 8` to:

```ts
			start: r.startCount ?? DEFAULT_START_COUNT,
			length: r.lengthCounts ?? DEFAULT_LENGTH_COUNTS
```

Replace the whole `setFigurePositions` function and its doc comment with:

```ts
/** Everything the figure page's one form writes about how a figure is danced. */
export interface FigureShape {
	startIds: number[];
	endId: number | null;
	/** 1..8. */
	startCount: number;
	/** 1..MAX_LENGTH_COUNTS counts. */
	lengthCounts: number;
}

/**
 * Replace a figure's start positions, end position, start count and length, in
 * one transaction.
 *
 * Returns false — writing nothing — when the figure is gone, when a timing
 * value is out of range, or when any position belongs to another dance. That
 * last one is the wall: `positions.dance` has no CHECK pairing it to
 * `figures.dance` (a new CHECK on `figures` would force a rebuild and fail at
 * migrate time), so it is enforced here, the same way the figure's style is.
 *
 * The figure page calls this BEFORE `updateFigure`, because this is the half
 * that can refuse: a refusal must leave the name untouched too.
 */
export function setFigureShape(db: Db, figureId: number, shape: FigureShape): boolean {
	const { startIds, endId, startCount, lengthCounts } = shape;
	if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) return false;

	return db.transaction((tx) => {
		const figure = tx
			.select({ dance: figures.dance })
			.from(figures)
			.where(eq(figures.id, figureId))
			.get();
		if (!figure) return false;

		const wanted = [...new Set(endId === null ? startIds : [...startIds, endId])];
		if (wanted.length > 0) {
			const ours = tx
				.select({ id: positions.id })
				.from(positions)
				.where(and(inArray(positions.id, wanted), eq(positions.dance, figure.dance)))
				.all();
			// Every id must exist AND be of this figure's dance. A count comparison
			// covers both, since the ids were de-duplicated above.
			if (ours.length !== wanted.length) return false;
		}

		tx.delete(figureStartPositions).where(eq(figureStartPositions.figureId, figureId)).run();
		if (startIds.length > 0) {
			tx.insert(figureStartPositions)
				.values([...new Set(startIds)].map((positionId) => ({ figureId, positionId })))
				.run();
		}
		tx.update(figures)
			.set({ endPositionId: endId, startCount, lengthCounts })
			.where(eq(figures.id, figureId))
			.run();
		return true;
	});
}
```

- [ ] **Step 6: `createFigure` writes 8 counts**

In `src/lib/server/figures.ts`, add `import { DEFAULT_LENGTH_COUNTS } from '$lib/graph/timing';` and change the insert in `createFigure`:

```ts
			.values({ ...values(input), dance })
```

to:

```ts
			.values({ ...values(input), dance, lengthCounts: DEFAULT_LENGTH_COUNTS })
```

- [ ] **Step 7: The practice cue derives its 8-counts**

In `src/lib/server/practice-content.ts`, add `import { DEFAULT_LENGTH_COUNTS, eightsSpan } from '$lib/graph/timing';` and change:

```ts
					eights: figure.eights
```

to:

```ts
					eights: eightsSpan(figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS)
```

- [ ] **Step 8: Keep the remaining callers compiling**

`src/lib/server/routines.spec.ts`: change `import { setFigurePositions } from './graph';` to `import { setFigureShape } from './graph';`, line 185 to

```ts
		setFigureShape(db, b.id, { startIds: [], endId: pos.id, startCount: 1, lengthCounts: 8 });
```

and line 198 to

```ts
		setFigureShape(db, b.id, { startIds: [], endId: neutral.id, startCount: 1, lengthCounts: 8 });
```

`src/routes/[dance]/figures/[id]/+page.server.ts` (the `positions` action lives until Task 6; keep it working on the new function):
- import line 14 becomes `import { buildGraph, figurePositions, setFigureShape } from '$lib/server/graph';`, and add `import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT, isLengthCounts, MAX_LENGTH_COUNTS } from '$lib/graph/timing';`
- in `load`, replace `maxEights: MAX_EIGHTS,` with:

```ts
		// Resolved here so the page never sees a null — the same defaults
		// `buildGraph` applies.
		timing: {
			startCount: found.figure.startCount ?? DEFAULT_START_COUNT,
			lengthCounts: found.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		},
```

- replace the whole `positions` action with this interim version (Task 6 deletes it):

```ts
	/** The handholds this figure starts and ends at, plus how many counts it takes. */
	positions: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const lengthCounts = int(form, 'lengthCounts');

		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'positions', message: 'Pick an end position.' });
		}
		if (!isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'positions',
				message: `A figure takes between 1 and ${MAX_LENGTH_COUNTS} counts.`
			});
		}
		const startCount = found.figure.startCount ?? DEFAULT_START_COUNT;
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance, and that is a 404 rather than a message.
		if (!setFigureShape(getDb(), found.figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		return { action: 'positions', ok: true };
	},
```

`src/routes/[dance]/figures/[id]/+page.svelte`: in the "Eight-counts" input, change `name="eights"` to `name="lengthCounts"`, `max={data.maxEights}` to `max="64"`, `value={figure.eights}` to `value={data.timing.lengthCounts}`, and the label text to `Counts`. (Task 6 replaces this whole block.)

`src/routes/[dance]/dance-wall.spec.ts` lines 279 and 289: change `eights: '1'` to `lengthCounts: '8'`.

- [ ] **Step 9: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS, including the new `setFigureShape` and timing-default tests.

- [ ] **Step 10: Verify the backfill on a copy of the dev database**

The app migrates at boot, so boot the built server (`npm run check` just built it) against a copy of the dev database for a few seconds, then inspect the copy:

```bash
S=/tmp/claude-migrate-check && rm -rf $S && mkdir -p $S && cp .data/salsa.db $S/salsa.db
nix develop -c sqlite3 $S/salsa.db "select sql from sqlite_master where name='figures';" | grep -o "CHECK" | wc -l
nix develop -c env DATABASE_PATH=$S/salsa.db DATA_DIR=$S PORT=5198 ORIGIN=http://localhost:5198 timeout 8 node build; true
nix develop -c sqlite3 $S/salsa.db "select count(*) from figures where length_counts is null or length_counts <> eights * 8;"
nix develop -c sqlite3 $S/salsa.db "select sql from sqlite_master where name='figures';" | grep -o "CHECK" | wc -l
```

Expected: the backfill query prints `0` (every row has `length_counts = eights * 8`). The CHECK count printed after boot equals the one printed before it — the table was altered, not rebuilt. If the dev database has no figures, give the COPY one right after the `cp` and before booting — `nix develop -c sqlite3 $S/salsa.db "insert into figures (name, dance, eights, created_at) values ('migrate check', 'salsa', 2, 0);"` — so the backfill has a row to prove itself on. Never write to `.data/salsa.db` here. Delete `$S` afterwards.

- [ ] **Step 11: Commit**

```bash
git add src drizzle
git commit -m "figures: start_count and length_counts, backfilled from eights

setFigureShape replaces setFigurePositions and writes positions and timing
in one transaction. eights is vestigial from here on.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Routine timing algebra

**Files:**
- Modify: `src/lib/routines/routines.ts`
- Test: `src/lib/routines/routines.spec.ts`

**Interfaces:**
- Consumes: `nextCountOf` (Task 2), `GraphFigure.start`.
- Produces:
  - `slotStartCounts(g: Graph, slot: OptionsSlot): number[]` — union of the options' start counts, ascending
  - `sharedNextCount(g: Graph, slot: OptionsSlot): number | null` — null when options disagree
  - `interface SlotTiming { starts: number[]; next: number | null }`
  - `slotTiming(g: Graph, slot: Slot): SlotTiming` — a child slot borrows its first inner slot's starts and last inner slot's next
  - `timingBreaks(g: Graph, shape: RoutineShape): number[]` — flat indices `i` where `sharedNextCount(i) ∉ slotStartCounts(i+1)`
  - `loops(g, shape)` — now also requires the last next count to be among the first slot's start counts

- [ ] **Step 1: Write the failing tests**

Add `slotStartCounts, sharedNextCount, slotTiming, timingBreaks` to the import from `'./routines'` in `src/lib/routines/routines.spec.ts`, and append:

```ts
/**
 * Timing fixtures. Every figure is untagged (all positions neutral) so only the
 * count can break a seam.
 *   20: 1 → 1 (8 counts)    21: 1 → 5 (4 counts)    22: 5 → 1 (4 counts)
 *   23: 5 → 5 (8 counts)    24: 1 → 1 (16 counts)
 */
const t: Graph = {
	neutral: 1,
	figures: [
		{ id: 20, starts: [], end: null, start: 1, length: 8 },
		{ id: 21, starts: [], end: null, start: 1, length: 4 },
		{ id: 22, starts: [], end: null, start: 5, length: 4 },
		{ id: 23, starts: [], end: null, start: 5, length: 8 },
		{ id: 24, starts: [], end: null, start: 1, length: 16 }
	]
};

describe('slotStartCounts', () => {
	it('is the union of its options’ start counts, ascending', () => {
		expect(slotStartCounts(t, { kind: 'options', figureIds: [23, 20] })).toEqual([1, 5]);
	});

	it('ignores an option the graph does not know', () => {
		expect(slotStartCounts(t, { kind: 'options', figureIds: [22, 999] })).toEqual([5]);
	});
});

describe('sharedNextCount', () => {
	it('is the count every option leaves the next on', () => {
		expect(sharedNextCount(t, { kind: 'options', figureIds: [20, 24] })).toBe(1);
	});

	it('is null when the options disagree — a hand-edited slot, never a guess', () => {
		expect(sharedNextCount(t, { kind: 'options', figureIds: [20, 21] })).toBeNull();
		expect(sharedNextCount(t, { kind: 'options', figureIds: [21, 20] })).toBeNull();
	});
});

describe('timingBreaks', () => {
	it('is empty when each figure leaves the next on its start count', () => {
		expect(timingBreaks(t, opts(21, 22, 20))).toEqual([]);
	});

	it('reports the seam where the count does not line up, and does not refuse it', () => {
		// 20 leaves the next on 1; 22 starts on 5.
		expect(timingBreaks(t, opts(20, 22))).toEqual([0]);
	});

	it('finds nothing in a repertoire of whole 8-counts from 1 — every existing routine', () => {
		expect(timingBreaks(t, opts(20, 24, 20, 24))).toEqual([]);
	});

	it('reports no timing break out of a slot whose next count is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [20, 21] },
				{ kind: 'options', figureIds: [22] }
			]
		};
		expect(timingBreaks(t, shape)).toEqual([]);
	});

	it('sees a timing break at an embedded routine’s seam', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [20] },
				{ kind: 'child', routineId: 9, slots: [{ kind: 'options', figureIds: [22] }] }
			]
		};
		expect(timingBreaks(t, shape)).toEqual([0]);
	});
});

describe('slotTiming', () => {
	it('gives an option slot its start counts and next count', () => {
		expect(slotTiming(t, { kind: 'options', figureIds: [22] })).toEqual({ starts: [5], next: 1 });
	});

	it('lets an embedded routine borrow its first slot’s starts and its last slot’s next', () => {
		const child: Slot = {
			kind: 'child',
			routineId: 9,
			slots: [
				{ kind: 'options', figureIds: [21] },
				{ kind: 'options', figureIds: [23] }
			]
		};
		expect(slotTiming(t, child)).toEqual({ starts: [1], next: 5 });
	});

	it('is empty for an embedded routine with nothing danceable, rather than throwing', () => {
		expect(slotTiming(t, { kind: 'child', routineId: 9, slots: [] })).toEqual({
			starts: [],
			next: null
		});
	});
});

describe('loops, with timing', () => {
	it('is true when the count comes back round to the start', () => {
		expect(loops(t, opts(21, 22))).toBe(true);
	});

	it('is false when the positions loop but the count does not', () => {
		// Starts on 1, leaves the next on 5.
		expect(loops(t, opts(21))).toBe(false);
	});
});
```

If `Slot` is not already imported in the spec, add `type Slot` to the import from `'./routines'`.

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/routines/routines.spec.ts`
Expected: FAIL — the four functions are not exported.

- [ ] **Step 3: Implement**

In `src/lib/routines/routines.ts`, change the import to:

```ts
import { endOf, figureById, nextCountOf, startsOf, type Graph } from '$lib/graph/graph';
```

Add after `sharedEnd`:

```ts
/**
 * Every count this slot can begin on: the union of its options'. Permissive in
 * the same way `slotStarts` is.
 */
export function slotStartCounts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (f) out.add(f.start);
	}
	return [...out].sort((a, b) => a - b);
}

/**
 * The count every option leaves the next figure to begin on, or null when they
 * disagree. Disagreement is refused on write (`addOption`); pure code reads a
 * row that got past it as "unknown", exactly as `sharedEnd` does.
 */
export function sharedNextCount(g: Graph, slot: OptionsSlot): number | null {
	let next: number | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		const n = nextCountOf(f);
		if (next === null) next = n;
		else if (next !== n) return null;
	}
	return next;
}

export interface SlotTiming {
	/** Counts the slot can begin on. Empty when nothing in it is danceable. */
	starts: number[];
	/** The count it leaves the next slot on, or null when unknown. */
	next: number | null;
}

/**
 * One editor row's timing. An embedded routine borrows its first slot's start
 * counts and its last slot's next count, the way it borrows positions.
 */
export function slotTiming(g: Graph, slot: Slot): SlotTiming {
	const flat = flatten(g, { slots: [slot] });
	if (flat.length === 0) return { starts: [], next: null };
	return {
		starts: slotStartCounts(g, flat[0]),
		next: sharedNextCount(g, flat[flat.length - 1])
	};
}
```

Add after `breaks`:

```ts
/**
 * Flat slot indices `i` where slot `i` leaves the next figure on a count slot
 * `i + 1` cannot begin on. The timing twin of `breaks`: reported, never
 * refused, and silent out of a slot whose next count is unknown.
 */
export function timingBreaks(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const next = sharedNextCount(g, flat[i]);
		if (next === null) continue;
		if (!slotStartCounts(g, flat[i + 1]).includes(next)) out.push(i);
	}
	return out;
}
```

Replace `loops` with:

```ts
/**
 * Whether the routine runs straight back into itself — in the hands AND on the
 * count.
 *
 * A free diagnostic worth showing: the player loops a routine when the song
 * outlasts it, so a routine that does not loop will cross one break per lap.
 */
export function loops(g: Graph, shape: RoutineShape): boolean {
	const flat = flatten(g, shape);
	if (flat.length === 0) return false;
	const first = flat[0];
	const last = flat[flat.length - 1];
	const end = sharedEnd(g, last);
	const next = sharedNextCount(g, last);
	return (
		end !== null &&
		next !== null &&
		slotStarts(g, first).includes(end) &&
		slotStartCounts(g, first).includes(next)
	);
}
```

Also update the `OptionsSlot` doc comment from `/** A slot filled by interchangeable figures — the variants. */` to `/** A slot filled by interchangeable figures — the alternatives. */`.

- [ ] **Step 4: Run them to see them pass**

Run: `nix develop -c npx vitest run src/lib/routines`
Expected: PASS — the new tests and every existing `loops` test (the old fixtures are all 1 → 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/routines
git commit -m "routines: timing breaks, slot timing, and loops that respect the count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Alternatives must land on the same count

**Files:**
- Modify: `src/lib/server/routines.ts` (`endOfFigure` → `landingOf`, `addOption`, wording in comments at lines 6 and 377)
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (the `addOption` failure message; comments at lines 51 and 112)
- Modify: `src/lib/server/db/schema.ts:272` (comment wording)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Consumes: `setFigureShape` (Task 3), `nextCount` (Task 1).
- Produces: `addOption(db, stepId, figureId)` — unchanged signature; now false also when the figure's next count differs from the slot's.

- [ ] **Step 1: Write the failing tests**

In `src/lib/server/routines.spec.ts`, inside the `describe` that holds `'refuses a figure that ends somewhere else'`, add:

```ts
	it('refuses an alternative that leaves the next figure on a different count', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 1, lengthCounts: 4 }); // 1 → 5
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('accepts one of a different length that lands on the same count', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1, 8 counts
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 12 }); // 5 → 1
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: the first new test FAILS (the option is accepted today); the second passes already.

- [ ] **Step 3: Implement**

In `src/lib/server/routines.ts`, add `import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT, nextCount } from '$lib/graph/timing';` and replace `endOfFigure`:

```ts
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
```

with:

```ts
/**
 * Where a figure leaves the hands and on which count it leaves the next one —
 * the two things alternatives must agree on. Untagged resolves to neutral, and
 * unset timing to start 1 / 8 counts, the same defaults `buildGraph` applies.
 * Null when the figure is not this dance's, or is archived, or gone.
 */
function landingOf(
	db: Db,
	dance: DanceSlug,
	figureId: number
): { end: number; next: number } | null {
	const row = db
		.select({
			end: figures.endPositionId,
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts
		})
		.from(figures)
		.where(and(eq(figures.id, figureId), eq(figures.dance, dance), isNull(figures.archivedAt)))
		.get();
	if (!row) return null;
	return {
		end: row.end ?? neutralPosition(db, dance)?.id ?? 0,
		next: nextCount(
			row.startCount ?? DEFAULT_START_COUNT,
			row.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		)
	};
}
```

Search the file for other `endOfFigure(` callers (`grep -n endOfFigure src/lib/server/routines.ts`). For each one outside `addOption` that only needs the end, change `endOfFigure(db, dance, id)` to `landingOf(db, dance, id)?.end ?? null`.

In `addOption`, replace:

```ts
	const end = endOfFigure(db, dance, figureId);
	if (end === null) return false;
```

and the loop:

```ts
	for (const o of existing) {
		if (o.figureId === figureId) return true;
		if (endOfFigure(db, dance, o.figureId) !== end) return false;
	}
```

with:

```ts
	const landing = landingOf(db, dance, figureId);
	if (landing === null) return false;
```

and:

```ts
	for (const o of existing) {
		if (o.figureId === figureId) return true;
		const other = landingOf(db, dance, o.figureId);
		if (other === null || other.end !== landing.end || other.next !== landing.next) return false;
	}
```

The `other === null` arm refuses when the slot already holds an archived figure. That is today's behaviour too (`endOfFigure` returns null for it, and `null !== end`), so keep it; changing it is out of scope.

Update `addOption`'s doc comment tail from "options that end differently are not variants of each other, they are different steps." to "options that land differently — in the hands or on the count — are not alternatives to each other, they are different steps."

Wording elsewhere in this file: line 6's `figures — the variants — or one embedded routine` → `figures — the alternatives — or one embedded routine`.

`src/lib/server/db/schema.ts:272`: ` * The interchangeable figures filling one slot — the variants.` → ` * The interchangeable figures filling one slot — the alternatives.`, and in the same comment `All of them must share ONE end position` → `All of them must share ONE end position and ONE next count`.

`src/routes/[dance]/routines/[id]/+page.server.ts`:
- line 51 comment: `a slot's variants don't` → `a slot's alternatives don't`
- line 112 comment: `A wrong-end variant pick` → `A wrong-landing alternative pick`
- the `addOption` failure message becomes:

```ts
			return slotFail(
				'Those figures do not land in the same place or on the same count, so they are not alternatives.',
				stepId
			);
```

- [ ] **Step 4: Run them to see them pass**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server src/routes/[dance]/routines
git commit -m "routines: alternatives must land on the same count as well as the same hold

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The figure page — one Edit form, one Save

**Files:**
- Create: `src/lib/components/figures/FigureTiming.svelte`
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (fold `positions` into `update`; delete `positions`)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte`
- Test: `src/routes/[dance]/dance-wall.spec.ts` (the two positions tests become update tests, plus the partial-write guard)

**Interfaces:**
- Consumes: `setFigureShape` / `FigureShape` (Task 3), `isStartCount`, `isLengthCounts`, `MAX_LENGTH_COUNTS`, `COUNTS_PER_EIGHT` (Task 1), `data.timing` from the load (Task 3).
- Produces: the page's `update` action reads `name, partner, style, notes, callable, callText, startIds[], endId, startCount, lengthCounts`. The `positions` action no longer exists.

- [ ] **Step 1: Write the failing tests**

In `src/routes/[dance]/dance-wall.spec.ts`, replace the two tests `'refuses positions for a figure from the other dance, writing nothing'` and `'refuses a position from the other dance on a figure of this one'` with:

```ts
	/** A complete, valid figure edit — each test overrides only what it is about. */
	const edit = (fields: Record<string, string>) => ({
		name: 'Renamed',
		partner: 'partner',
		style: 'salsa',
		startCount: '1',
		lengthCounts: '8',
		...fields
	});

	it('refuses an edit of a figure from the other dance, writing nothing', async () => {
		// A BACHATA position on a BACHATA figure: `setFigureShape`'s own
		// per-position dance check would ACCEPT this payload, so the only thing
		// that can refuse it is the route's `figureOf` guard.
		const bachataClosed = listPositions(db, 'bachata').find((p) => p.slug === 'closed')!;
		const before = getFigure(db, bachataFigureId)!.figure.name;
		await refuses(
			figurePage.actions.update,
			post('salsa', edit({ startIds: String(bachataClosed.id) }), String(bachataFigureId))
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endId: null });
		expect(getFigure(db, bachataFigureId)!.figure.name).toBe(before);
	});

	it('refuses a position from the other dance on a figure of this one — name included', async () => {
		const salsaFigureId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id;
		const before = getFigure(db, salsaFigureId)!.figure.name;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.update,
			post('salsa', edit({ startIds: String(bachataShadow.id) }), String(salsaFigureId))
		);
		// The shape half refused, so the details half must not have run either.
		expect(getFigure(db, salsaFigureId)!.figure.name).toBe(before);
	});

	it('refuses out-of-range timing with a message, writing nothing', async () => {
		const salsaFigureId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id;
		const before = getFigure(db, salsaFigureId)!.figure;
		for (const bad of [
			{ startCount: '0' },
			{ startCount: '9' },
			{ startCount: 'abc' },
			{ lengthCounts: '0' },
			{ lengthCounts: '65' }
		]) {
			const result = await call(
				figurePage.actions.update,
				post('salsa', edit(bad), String(salsaFigureId))
			);
			expect(result).toMatchObject({ status: 400 });
		}
		const after = getFigure(db, salsaFigureId)!.figure;
		expect(after.name).toBe(before.name);
		expect(after.lengthCounts).toBe(before.lengthCounts);
	});
```

(`call`, `refuses`, `post`, `figureInput`, `bachataFigureId`, `getFigure`, `listPositions`, `figurePositions` and `createFigure` already exist in this spec file. `fail(400, …)` returns an `ActionFailure` whose `status` is 400, which is what `toMatchObject` checks.)

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/routes/[dance]/dance-wall.spec.ts`
Expected: FAIL — `update` ignores positions and timing today, so the salsa figure's name IS changed and the out-of-range posts return success.

- [ ] **Step 3: Fold `positions` into `update`**

In `src/routes/[dance]/figures/[id]/+page.server.ts`:

Extend the `$lib/graph/timing` import Task 3 added so it reads `import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT, isLengthCounts, isStartCount, MAX_LENGTH_COUNTS } from '$lib/graph/timing';` (the two defaults stay in use by `load`).

Replace the whole `update` action with:

```ts
	/**
	 * The figure page's one Save: details, positions and timing together.
	 *
	 * `setFigureShape` runs FIRST because it is the half that can refuse — a
	 * position of another dance. Running `updateFigure` first would rename the
	 * figure and then report the refusal, which is the half-written save this
	 * single form exists to rule out.
	 */
	update: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[danceOf(params)].styles);
		const notes = optionalText(form, 'notes');
		const callable = checkbox(form, 'callable');
		const callText = optionalText(form, 'callText', 200);
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!name || !partner || !style || notes === undefined || callText === undefined) {
			return fail(400, {
				action: 'update',
				message: 'Give the figure a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'update', message: 'Pick an end position.' });
		}
		if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'update',
				message: `A figure starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts.`
			});
		}

		const db = getDb();
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance, and that is a 404 rather than a message, the same answer
		// every other cross-dance id gets here.
		if (!setFigureShape(db, found.figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		if (
			!updateFigure(db, found.figure.id, { name, partner, style, notes, callable, callText })
		) {
			throw error(404, 'Figure not found');
		}
		return { action: 'update', ok: true };
	},
```

Delete the whole `positions` action (its doc comment and body).

- [ ] **Step 4: Create the timing control**

`src/lib/components/figures/FigureTiming.svelte`:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';

	/**
	 * Which count a figure begins on, and how many counts it takes.
	 *
	 * Seeds its own state from the props once, like `StartPositions`, so it must
	 * be keyed on the figure's id wherever it is rendered.
	 */
	let { startCount, lengthCounts }: { startCount: number; lengthCounts: number } = $props();

	let start = $state(untrack(() => startCount));
	let length = $state(untrack(() => lengthCounts));

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => i + 1);
	const shortcuts = [4, 8, 16];
</script>

<fieldset>
	<legend class="text-[13px] font-medium">Starts on</legend>
	<div class="mt-1 grid grid-cols-8 gap-1">
		{#each counts as n (n)}
			<label
				class="grid h-10 place-items-center rounded-lg border text-[15px] font-medium {start === n
					? 'border-accent bg-accent/15 text-accent'
					: 'border-line'}"
			>
				<input type="radio" name="startCount" value={n} bind:group={start} class="sr-only" />
				{n}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class="text-[13px] font-medium" for="figure-length">Counts</label>
	<div class="mt-1 flex items-center gap-2">
		<input
			id="figure-length"
			type="number"
			name="lengthCounts"
			min="1"
			max={MAX_LENGTH_COUNTS}
			required
			bind:value={length}
			class="h-11 w-24 rounded-xl border border-line bg-raised px-3 text-[15px]"
		/>
		{#each shortcuts as n (n)}
			<button
				type="button"
				onclick={() => (length = n)}
				class="h-11 rounded-xl border px-3 text-[14px] {length === n
					? 'border-accent text-accent'
					: 'border-line'}">{n}</button
			>
		{/each}
	</div>
	<p class="mt-1 text-[12px] text-muted">How long the figure takes. One 8-count is 8.</p>
</div>
```

- [ ] **Step 5: Rework the page**

In `src/routes/[dance]/figures/[id]/+page.svelte`:

Script:
- add `import FigureTiming from '$lib/components/figures/FigureTiming.svelte';`
- delete the `positionsFailure` derived
- add, after `neutralName`:

```ts
	const positionName = (id: number) =>
		data.positions.find((p) => p.id === id)?.name ?? 'an untagged position';
	/** "Open two hands / Cross-hand → Hammerlock" — untagged sides read as neutral. */
	const handholds = $derived(
		`${data.tags.startIds.length > 0 ? data.tags.startIds.map(positionName).join(' / ') : neutralName} → ${
			data.tags.endId === null ? neutralName : positionName(data.tags.endId)
		}`
	);
```

Edit mode: inside the `{#if editing}` `<form … action="?/update">`, directly after `<FigureFields … />`, insert:

```svelte
			<!--
				Positions and timing live in the same form as the name now: one Save
				for the whole figure. Keyed on the figure for the reason
				`StartPositions` documents — both components seed their state once.
			-->
			{#key figure.id}
				<StartPositions positions={data.positions} initial={data.tags.startIds} {neutralName} />
			{/key}

			<label class="block">
				<span class="text-[13px] font-medium">Ends at</span>
				<select
					name="endId"
					class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
				>
					<option value="" selected={data.tags.endId === null}>{neutralName}</option>
					{#each data.positions as position (position.id)}
						<option value={position.id} selected={data.tags.endId === position.id}>
							{position.name}{position.archived ? ' (archived)' : ''}
						</option>
					{/each}
				</select>
			</label>

			{#key figure.id}
				<FigureTiming
					startCount={data.timing.startCount}
					lengthCounts={data.timing.lengthCounts}
				/>
			{/key}
```

View mode: in the `{:else}` branch's first `<section>` (style · partner, notes), after the existing style/partner `<p>`, insert:

```svelte
				<p class="text-[13px] text-muted">
					Starts on {data.timing.startCount} · {data.timing.lengthCounts} counts
				</p>
				<p class="text-[13px] text-muted">{handholds}</p>
```

Delete the whole standalone positions section — from `<section>` containing `<h2 …>Positions</h2>` through its closing `</section>` (the block with `action="?/positions"` and the "Save positions" button).

Recordings: deleting one becomes an Edit-mode action (the spec's "deleting a video … lives in edit mode only"); adding one stays available in view mode. In the Recordings section, wrap the existing delete form

```svelte
						<form
							method="POST"
							action="?/deleteRecording"
```

… through its closing `</form>` in `{#if editing}` … `{/if}`. The size/date `<span>` beside it stays unconditional.

- [ ] **Step 6: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS, including the three dance-wall tests.

- [ ] **Step 7: Look at it**

Start the dev server (`nix develop -c npm run dev`, log in with the dev admin), open any figure:
- View mode shows "Starts on 1 · 8 counts" and the handholds line; there is no Positions form and no "Save positions".
- Edit shows name/partner/style/notes/callable/call text, then Starts from / Ends at, then the 1–8 chips and the Counts input with 4 / 8 / 16. Choose 5 and 4, Save: view mode reads "Starts on 5 · 4 counts".
- Edit again and Save without touching anything: nothing changes (the archived-position splice and the timing both round-trip).
- A recording's Delete button shows only in Edit; "+ Add video or audio" shows in both modes.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/figures/FigureTiming.svelte src/routes/[dance]/figures src/routes/[dance]/dance-wall.spec.ts
git commit -m "figure page: one Edit form and one Save for details, positions and timing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The routine editor shows timing

**Files:**
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (load)
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte`
- Modify: `src/routes/[dance]/routines/+page.server.ts` (list hint)

**Interfaces:**
- Consumes: `timingBreaks`, `slotTiming`, `SlotTiming` (Task 4); `endOf`, `nextCountOf` (Task 2).
- Produces (load data): `timingBreaks: number[]`, `slotTiming: SlotTiming[]` (parallel to `slots`), and `figures: { id: number; name: string; end: number | null; next: number | null }[]`.

- [ ] **Step 1: Extend the load**

In `src/routes/[dance]/routines/[id]/+page.server.ts`:

Change the routines import to:

```ts
import {
	breaks,
	loops,
	routineEnd,
	routineStarts,
	slotStarts,
	slotTiming,
	timingBreaks
} from '$lib/routines/routines';
import { endOf, figureById, nextCountOf } from '$lib/graph/graph';
```

Replace the `figures` line in `load`:

```ts
	const figures = listFigures(db, dance, {}).map((f) => ({ id: f.id, name: f.name }));
```

with:

```ts
	// Each figure's landing — where it leaves the hands and on which count — so
	// the alternative picker can offer only the ones that fit a slot. The
	// server's `addOption` still decides; this only stops offering the refusals.
	const figures = listFigures(db, dance, {}).map((f) => {
		const node = figureById(graph, f.id);
		return {
			id: f.id,
			name: f.name,
			end: node ? endOf(graph, node) : null,
			next: node ? nextCountOf(node) : null
		};
	});
```

In the returned object, after `breaks: [...flatBreaks],` add:

```ts
		// Same indexing as `breaks`: flat, so only trustworthy per row while no
		// slot holds a child.
		timingBreaks: timingBreaks(graph, shape),
		// Per slot, parallel to `slots`: which counts it begins on and which it
		// leaves the next on — the "5→1" on each row.
		slotTiming: shape.slots.map((s) => slotTiming(graph, s)),
```

In `src/routes/[dance]/routines/+page.server.ts`, add `timingBreaks` to the import from `'$lib/routines/routines'` and change

```ts
				breaks: breaks(graph, shape).length
```

to

```ts
				// A seam that breaks in the hands AND on the count is one problem, not two.
				breaks: new Set([...breaks(graph, shape), ...timingBreaks(graph, shape)]).size
```

- [ ] **Step 2: Render it**

In `src/routes/[dance]/routines/[id]/+page.svelte`:

Script — after `breakAfter`, add:

```ts
	const timingBreakAfter = $derived(
		data.hasChild ? new Set<number>() : new Set(data.timingBreaks)
	);

	/** "5→1", or "1/5→?" when the alternatives disagree on where they leave the count. */
	function timingLabel(i: number): string {
		const t = data.slotTiming[i];
		if (!t || t.starts.length === 0) return '';
		return `${t.starts.join('/')}→${t.next ?? '?'}`;
	}
```

Replace `addable`:

```ts
	/** Figures not already in this slot — adding one twice is a no-op, so don't offer it. */
	function addable(figureIds: number[]) {
		return data.figures.filter((f) => !figureIds.includes(f.id));
	}
```

with:

```ts
	/**
	 * Figures that could stand in for this slot's: not already in it, and landing
	 * where its first figure lands — same hold, same next count. When the slot's
	 * figures are all archived there is nothing to compare against, so everything
	 * is offered and `addOption` decides.
	 */
	function addable(figureIds: number[]) {
		const first = data.figures.find((f) => figureIds.includes(f.id));
		return data.figures.filter(
			(f) =>
				!figureIds.includes(f.id) &&
				(!first || (f.end === first.end && f.next === first.next))
		);
	}
```

Header hint row — change the condition

```svelte
	{#if facts.length > 0 || data.breaks.length > 0 || (!data.loops && data.slots.length > 0)}
```

to

```svelte
	{#if facts.length > 0 || data.breaks.length > 0 || data.timingBreaks.length > 0 || (!data.loops && data.slots.length > 0)}
```

and after the `{#if data.breaks.length > 0}…{/if}` span add:

```svelte
			{#if data.timingBreaks.length > 0}
				<span class={hint}
					>{data.timingBreaks.length} timing break{data.timingBreaks.length === 1 ? '' : 's'}</span
				>
			{/if}
```

Slots intro text — replace:

```svelte
			A slot's variants all have to end in the same place — any one of them can be danced there.
```

with:

```svelte
			A slot's alternatives all have to land in the same hold and on the same count — any one of
			them can be danced there.
```

Slot row — replace the options line and its comment:

```svelte
									<!--
										Variants read as one line rather than a stack of rows: any of them
										can be danced at this point, so they belong together, and the row
										has to stay short enough to scan a whole routine at a glance.
									-->
									<p class="text-[15px]">{slot.figureIds.map(optionName).join('  /  ')}</p>
```

with:

```svelte
									<!--
										Alternatives read as one line rather than a stack of rows: any of
										them can be danced at this point, so they belong together, and the
										row has to stay short enough to scan a whole routine at a glance.
									-->
									<p class="text-[15px]">
										{slot.figureIds.map(optionName).join('  /  ')}
										{#if timingLabel(i)}
											<span class="text-[12px] text-muted">· {timingLabel(i)}</span>
										{/if}
									</p>
```

For the child-routine row, after the `Routine: <a …>…</a>` paragraph's closing `</p>`, add:

```svelte
									{#if timingLabel(i)}
										<p class="text-[12px] text-muted">{timingLabel(i)}</p>
									{/if}
```

After the existing `{#if breakAfter.has(i)}…{/if}` block add:

```svelte
								{#if timingBreakAfter.has(i)}
									<p class="text-[12px]">
										<span class={hint}
											>timing — ends ready for {data.slotTiming[i]?.next}, next slot starts on {data.slotTiming[
												i + 1
											]?.starts.join(' or ')}</span
										>
									</p>
								{/if}
```

Edit sheet — replace `<span class="text-[13px] font-medium">Variants</span>` with `<span class="text-[13px] font-medium">Alternatives</span>`, `aria-label="Add a variant"` with `aria-label="Add an alternative"`, and `+ Variant` with `+ Alternative`. Around the add-option form, the `{#if addable(slot.figureIds).length > 0}` guard stays; add an else branch so an empty picker explains itself:

```svelte
					{:else}
						<p class="text-[12px] text-muted">
							No other figure lands in the same hold on the same count.
						</p>
					{/if}
```

(That is: change the existing `{/if}` closing the add-option form into `{:else}` + the paragraph + `{/if}`.)

- [ ] **Step 3: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS. `grep -rn "ariant" src/routes/\[dance\]/routines src/lib/routines src/lib/server/routines.ts` prints nothing.

- [ ] **Step 4: Look at it**

With the dev server: give one figure "starts on 5, 4 counts" (Task 6's form), put a default figure and then it into a routine:
- The rows read `Enchufla · 1→1` and `<that figure> · 5→1`.
- The first row shows "timing — ends ready for 1, next slot starts on 5"; the header shows "1 timing break"; the Routines list shows "1 break".
- Open slot 1's sheet: the Alternatives picker does not offer the 5→1 figure.

- [ ] **Step 5: Commit**

```bash
git add src/routes/[dance]/routines
git commit -m "routine editor: timing on every slot, timing breaks, and Alternatives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, and the whole-branch check

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-routines-design.md`
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md`
- Modify: `docs/superpowers/specs/2026-09-29-figure-variations-design.md` (status line)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Routines spec**

At the top of `docs/superpowers/specs/2026-09-24-routines-design.md`, under the existing status block, add:

```markdown
> **Updated 2026-09-29** by
> [`2026-09-29-figure-variations-design.md`](2026-09-29-figure-variations-design.md):
> slot "variants" are now **alternatives**, and must share their next count as
> well as their end position; `figures.eights` is vestigial, replaced by
> `start_count` and `length_counts`; timing breaks are reported beside position
> breaks.
```

In its 3a data model block, change the `figures.eights` line to:

```
figures.eights            VESTIGIAL since 2026-09-29 — see length_counts
figures.start_count       ADD COLUMN integer, nullable (1..8; null reads as 1)
figures.length_counts     ADD COLUMN integer, nullable (counts; null reads as 8)
```

- [ ] **Step 2: App spec and the new spec's status**

In `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, find the phase 3 paragraph that links `2026-09-24-routines-design.md` and add after it a sentence: `Figure timing (start count, length in counts), figure variations and the visual routine player: see [`2026-09-29-figure-variations-design.md`](2026-09-29-figure-variations-design.md).`

In `docs/superpowers/specs/2026-09-29-figure-variations-design.md`, under the status line add: `> **Slice 1 (timing and one edit mode) is live.** Slices 2 and 3 are not built yet.`

- [ ] **Step 3: `CLAUDE.md`**

In the **Live** paragraph, after `an exercise page)`, add: `, figure timing (a start count and a length in counts; routines report timing breaks)`.

In **Hard rules**, after the `figures.style` rule, add:

```markdown
- **`figures.eights` is vestigial; `length_counts` is real.** Copied into
  `length_counts` (`eights * 8`) by migration 0010 and read by nothing since.
  Same reason as `style`: dropping it is a rebuild, and `figures` can never be
  rebuilt. Timing arithmetic lives in `src/lib/graph/timing.ts`.
```

- [ ] **Step 4: Format and check**

Run: `nix develop -c npx prettier --write docs CLAUDE.md && nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: figure timing is live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand back**

Do not merge, push or deploy. Report the branch (`figure-timing`), the commits, and the `npm run check` result; merging and deploying are the user's call (the repo merges feature branches into `master` with `--no-ff` and a `Merge: …` message, then `./scripts/deploy.sh`).
