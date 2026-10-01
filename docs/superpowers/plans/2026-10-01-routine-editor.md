# Routine Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the routine page's sheet-and-select slot editor with drag-to-reorder, swipe-to-delete/open, tap-to-expand editing, seams that offer to build where the routine does not connect, a picker that offers what fits, and a long-press selection with Add above/below, Duplicate, Make routine and Delete.

**Architecture:** Server rules stay in `src/lib/server/routines.ts` (new `insertSlot`, `moveSlotTo`, `deleteSlots`/`restoreSlots`, `restoreOption`, `duplicateSlots`, `extractRoutine`, a stricter `addOption`). The thinking the page needs is pure and tested: `src/lib/routines/fit.ts` (the picker), `selection.ts`, `snapshot.ts`, `positionSeams`/`rowEdges` in `routines.ts`, and `src/lib/gestures/` (drag, swipe). The page calls the existing form-action route through `fetch` + `deserialize`, applies each change optimistically, then `invalidateAll()`s. No schema change, no migration, no new dependency.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Drizzle on better-sqlite3, Vitest (node environment only — there are no component tests in this repo).

**Spec:** `docs/superpowers/specs/2026-10-01-routine-editor-design.md` — read it first. The plan argues from it.

## Global Constraints

- Node and npm come from the nix flake: run every command as `nix develop -c <cmd>` from the worktree root (`/home/tilen/Projects/salsaapp-wt/nicer-routines`).
- No new dependencies. No schema change, no migration (`npm run db:generate` must not be needed).
- Data functions take `db` first; their tests use `openDb(':memory:')`. Route tests mock `$lib/server/db` exactly as `src/routes/[dance]/dance-wall.spec.ts` does — never set `process.env.DATABASE_PATH`.
- Nothing under `$lib/server` is imported by a component or by `src/lib/routines/` / `src/lib/gestures/`.
- `src/lib/routines/` and `src/lib/gestures/` are PURE: no DOM, no `Date.now()`, no `$app/*`, and `src/lib/routines/` never learns dances exist.
- The main figure of a slot is its first option added: order by `routine_step_options.created_at`, then `rowid`.
- A new alternative must match the main figure's start count AND share ≥1 start position, on top of the existing shared end + next count. Existing slots are not migrated.
- Gesture numbers: swipe reveal 84 px, direction lock 10 px, snap at 40 % of the reveal, long-press 450 ms with 10 px tolerance, undo toast 6 s.
- Copy, verbatim: chips **Count** and **Hold**; **+ Alternative**; **Open →**; swipe buttons **Delete**, **Open**, and **Remove** on an alternative; toasts "Slot N deleted", "N slots deleted", "Removed <label>", each with **Undo**; picker context "Starts on N from <position>", "Ends on N at <position>".
- Comments explain WHY, in the voice of the surrounding code (see any function in `src/lib/server/routines.ts`).
- `nix develop -c npm run check` must pass at the end of every task that touches `.svelte` or route files, and at the end of the plan.
- Commit after every task. End each commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Undo after the routine changed underneath** — delete slot 3 of 3, delete slot 1, then Undo the first delete: the slot must come back at the end, not fail. (Task 4: "restores past the end when the routine has since shrunk".)
2. **A stale or double delete** — swiping Delete on a slot another tab already removed, or two quick deletes: nothing partial may be deleted. (Task 4: "deletes nothing when any id is not this routine's".)
3. **A slot whose main figure is archived** — no **+ Alternative**, and a seam/plus anchored on a slot with nothing danceable opens an unfiltered picker rather than one that shows nothing. (Task 7: `anchorAfter`/`anchorBefore` on empty edges.)
4. **An insert whose index went stale** — a picker opened before another tab deleted slots posts an `at` past the end; it must append, not fail. (Task 3: "clamps an index past the end".)
5. **Search typed the way people type** — "DILE que NO", "enchufla doble", accents both ways. (Task 7: "ignores case and accents".)

---

## File Structure

**Create**
- `src/lib/routines/snapshot.ts` (+ `.spec.ts`) — `SlotSnapshot` and its strict parser: what a delete returns and an undo posts back.
- `src/lib/routines/fit.ts` (+ `.spec.ts`) — `Candidate`, `Anchor`, `pickList`, `anchorText`, `anchorAfter/Before/Alternative`, `fold`.
- `src/lib/routines/selection.ts` (+ `.spec.ts`) — `inOrder`, `extractBlock`.
- `src/lib/gestures/drag.ts` (+ `.spec.ts`) — `dropIndex`, `shiftFor`, `autoScroll`, `moved`.
- `src/lib/gestures/swipe.ts` (+ `.spec.ts`) — the swipe state machine.
- `src/lib/components/routines/types.ts` — `RowView`, `AltView`, `Swiped`.
- `src/lib/components/routines/act.ts` — POST a form action without a `<form>`.
- `src/lib/components/routines/UndoToast.svelte`, `Swipeable.svelte`, `Seam.svelte`, `SlotCard.svelte`, `SlotList.svelte`, `SlotPicker.svelte`, `SelectionBar.svelte`.

**Modify**
- `src/lib/server/routines.ts` (+ `routines.spec.ts`) — option order, start rule, new data functions; old `moveSlot`/`deleteSlot`/`duplicateSlot` removed in Task 12.
- `src/lib/routines/routines.ts` (+ `.spec.ts`) — `rowEdges`, `positionSeams`.
- `src/routes/[dance]/routines/[id]/+page.server.ts` — load additions, new actions; old actions removed in Task 12.
- `src/routes/[dance]/routines/[id]/+page.svelte` — rewritten in Task 12.
- `src/routes/[dance]/dance-wall.spec.ts` — new action guards; old ones removed in Task 12.
- `docs/superpowers/specs/2026-09-24-routines-design.md`, `CLAUDE.md` — Task 13.

---

### Task 1: The main figure is the first option added

**Files:**
- Modify: `src/lib/server/routines.ts` (`routineShapes` options query, `routineSlots` options query, `duplicateSlot` options query)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces: `MAIN_FIRST` (module-private `SQL[]` ordering) used by later tasks in the same file; `routineSlots(db, id)[i].figureIds[0]` is the main figure everywhere.

- [ ] **Step 1: Write the failing test** — append to `src/lib/server/routines.spec.ts`:

```ts
describe('the main figure', () => {
	it('is the first option added, not the lowest id', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([high.id, low.id]);
		expect(routineShapes(db, 'salsa').get(routine.id)!.slots[0]).toMatchObject({
			figureIds: [high.id, low.id]
		});
	});

	it('survives duplicateSlot and duplicateRoutine', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		duplicateSlot(db, routine.id, step);
		expect(routineSlots(db, routine.id)[1].figureIds).toEqual([high.id, low.id]);
		const copy = duplicateRoutine(db, routine.id)!;
		expect(routineSlots(db, copy.id).map((s) => s.figureIds)).toEqual([
			[high.id, low.id],
			[high.id, low.id]
		]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts -t "the main figure"`
Expected: FAIL — `figureIds` comes back `[low.id, high.id]` (ordered by `figure_id`).

- [ ] **Step 3: Implement**

In `src/lib/server/routines.ts`, add `sql` to the drizzle import:

```ts
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
```

Below `groupByStep`, add:

```ts
/**
 * A slot's options, main figure first: the order they were added in.
 *
 * The first option added is the slot's MAIN figure — the one the editor shows
 * on the card, with the others hung under it as alternatives. `created_at` is
 * epoch ms, so two options added in one transaction (every copy path) tie;
 * `rowid` breaks the tie in insertion order, which is why every path that
 * copies options inserts them in THIS order.
 */
const MAIN_FIRST = [asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`];
```

Replace `.orderBy(asc(routineStepOptions.figureId))` with `.orderBy(...MAIN_FIRST)` in BOTH `routineShapes` and `routineSlots`. In `duplicateSlot`, the `options` query has no `orderBy`; add `.orderBy(...MAIN_FIRST)` before `.all()`.

- [ ] **Step 4: Run the whole file to verify it passes and nothing else broke**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts src/lib/routines`
Expected: PASS. If an older test compared `figureIds` unsorted and now differs only in order, sort both sides there (`.slice().sort()`) — the order it assumed was `figure_id`, which is exactly what this task changes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: a slot's main figure is its first option added

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The start rule for alternatives, and putting one back

**Files:**
- Modify: `src/lib/server/routines.ts` (`landingIn`, `addOption`; add `restoreOption`)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Consumes: `MAIN_FIRST` (Task 1).
- Produces: `restoreOption(db: Db, stepId: number, figureId: number): boolean`.

- [ ] **Step 1: Write the failing tests** — add `restoreOption` to the import list at the top of the spec, add `routineStepOptions` to the `./db/schema` import, then append:

```ts
describe('addOption: the start rule', () => {
	const setup = () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [p1, p2] = listPositions(db, 'salsa').filter((p) => !p.neutral);
		return { db, routine, p1, p2 };
	};

	it('refuses an alternative that starts on another count', () => {
		const { db, routine } = setup();
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 }); // 5 → 1
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('refuses one that shares no start position with the main figure', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endId: null, startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, { startIds: [p2.id], endId: null, startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('accepts one whose starts overlap the main figure’s', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endId: null, startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, {
			startIds: [p1.id, p2.id],
			endId: null,
			startCount: 1,
			lengthCounts: 8
		});
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('leaves a slot that already breaks the rule alone', () => {
		const { db, routine } = setup();
		const a = figure(db, 'A');
		const legacy = figure(db, 'Legacy');
		setFigureShape(db, legacy.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		// Written past `addOption`, the way a slot made before this rule looks.
		db.insert(routineStepOptions).values({ stepId: step, figureId: legacy.id }).run();
		const c = figure(db, 'C');
		expect(addOption(db, step, c.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id, legacy.id, c.id]);
	});
});
```

Note on the last test: `legacy` leaves the next figure on 1, the same as `a` and `c`, so the existing end/next loop accepts `c`; only the start rule could object, and it compares against the MAIN figure `a`, not `legacy`.

```ts
describe('restoreOption', () => {
	it('puts back an alternative the start rule would now refuse', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id, b.id]);
	});

	it('is idempotent', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, a.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(restoreOption(db, step, figure(db, 'B', 'bachata').id)).toBe(false);
	});

	it('refuses a slot that holds a routine', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const step = addChildSlot(db, parent.id, child.id)!;
		expect(restoreOption(db, step, figure(db, 'A').id)).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts -t "start rule|restoreOption"`
Expected: FAIL — `restoreOption` is not exported; the first two start-rule tests return `true`.

- [ ] **Step 3: Implement**

Add `figures` to the schema import and `startsOf` to the graph import:

```ts
import { exercises, figures, routineStepOptions, routineSteps, routines } from './db/schema';
import { endOf, figureById, nextCountOf, startsOf, type Graph } from '$lib/graph/graph';
```

Replace `landingIn` with:

```ts
/**
 * Where a figure — or a variation — begins and lands: its start positions and
 * start count, the position it leaves the hands at and the count it leaves the
 * next figure on. Read off the graph, which fills a variation's unset fields
 * from its figure and resolves untagged to neutral; reading the row directly
 * would see a variation's nulls. Null when the figure is not in this dance's
 * graph — another dance, archived, or gone.
 */
function landingIn(
	g: Graph,
	figureId: number
): { starts: number[]; start: number; end: number; next: number } | null {
	const f = figureById(g, figureId);
	return f
		? { starts: startsOf(g, f), start: f.start, end: endOf(g, f), next: nextCountOf(f) }
		: null;
}
```

In `addOption`, replace from `const existing = db` to the end of the function with:

```ts
	const existing = db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.orderBy(...MAIN_FIRST)
		.all();
	// Idempotent on purpose: (step_id, figure_id) is a composite primary key, so
	// falling through to the insert would throw rather than refuse.
	if (existing.some((o) => o.figureId === figureId)) return true;
	for (const o of existing) {
		const other = landingIn(g, o.figureId);
		if (other === null || other.end !== landing.end || other.next !== landing.next) return false;
	}
	// The start rule, judged against the MAIN figure only: an alternative that
	// begins on another count, or from no hold the main figure begins from, can
	// never be danced where the main one is. Older slots that predate this rule
	// are left as they are — it governs adding, it is not a migration.
	const main = existing.length > 0 ? landingIn(g, existing[0].figureId) : null;
	if (main && (main.start !== landing.start || !main.starts.some((p) => landing.starts.includes(p)))) {
		return false;
	}
	db.insert(routineStepOptions).values({ stepId, figureId }).run();
	return true;
}
```

Also update `addOption`'s doc comment: append "…and, against the slot's main figure, when it begins on another count or from no hold the main figure begins from."

After `removeOption`, add:

```ts
/**
 * Undo for a removed alternative: put it straight back.
 *
 * Checks the dance only, not the alternative rules. It was in the slot a
 * moment ago, and `addOption` would refuse an older alternative that predates
 * the start rule — an undo that cannot undo. It comes back as the newest
 * option, which cannot change the main figure: the main figure is never
 * removed on its own (removing it removes the slot).
 */
export function restoreOption(db: Db, stepId: number, figureId: number): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	const figure = db
		.select({ dance: figures.dance })
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	if (!routine || !figure || figure.dance !== routine.dance) return false;
	db.insert(routineStepOptions).values({ stepId, figureId }).onConflictDoNothing().run();
	return true;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: PASS (all of it — the older `addOption` tests too).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: an alternative starts where its main figure starts; restoreOption

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Insert at an index, move to an index

**Files:**
- Modify: `src/lib/server/routines.ts` (add `insertSlot`, `moveSlotTo`; `addFigureSlot` and `addChildSlot` become wrappers)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces:
  - `type SlotContent = { figureId: number } | { childId: number }`
  - `insertSlot(db: Db, routineId: number, at: number, content: SlotContent): number | null` — the new step id; `at` is clamped to `0..length`.
  - `moveSlotTo(db: Db, routineId: number, stepId: number, index: number): boolean`

- [ ] **Step 1: Write the failing tests** — add `insertSlot`, `moveSlotTo` to the spec's import list, then append:

```ts
describe('insertSlot', () => {
	it('inserts at the start, the middle and the end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		const first = insertSlot(db, routine.id, 0, { figureId: figure(db, 'C').id })!;
		const mid = insertSlot(db, routine.id, 2, { figureId: figure(db, 'D').id })!;
		const last = insertSlot(db, routine.id, 4, { figureId: figure(db, 'E').id })!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([first, ids[0], mid, ids[1], last]);
		expect(rows.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
	});

	it('clamps an index past the end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const b = insertSlot(db, routine.id, 9, { figureId: figure(db, 'B').id })!;
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([a, b]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		expect(insertSlot(db, routine.id, 0, { figureId: figure(db, 'B', 'bachata').id })).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('embeds a routine only where canEmbed allows', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const grand = createRoutine(db, 'salsa', { name: 'G', notes: null }).routine;
		addFigureSlot(db, parent.id, figure(db, 'A').id);
		const step = insertSlot(db, parent.id, 0, { childId: child.id })!;
		expect(routineSlots(db, parent.id)[0]).toMatchObject({ id: step, childId: child.id });
		// `parent` now embeds, so it cannot itself be embedded.
		expect(insertSlot(db, grand.id, 0, { childId: parent.id })).toBeNull();
	});
});

describe('moveSlotTo', () => {
	it('moves a slot to any index and keeps positions contiguous', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const ids = ['A', 'B', 'C', 'D'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlotTo(db, routine.id, ids[0], 2)).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
		expect(moveSlotTo(db, routine.id, ids[3], 0)).toBe(true);
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([ids[3], ids[1], ids[2], ids[0]]);
		expect(rows.map((s) => s.position)).toEqual([0, 1, 2, 3]);
	});

	it('refuses an index off the end or a slot of another routine', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		const foreign = addFigureSlot(db, other.id, figure(db, 'C').id)!;
		expect(moveSlotTo(db, routine.id, ids[0], 2)).toBe(false);
		expect(moveSlotTo(db, routine.id, ids[0], -1)).toBe(false);
		expect(moveSlotTo(db, routine.id, foreign, 0)).toBe(false);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts -t "insertSlot|moveSlotTo"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement** — replace `addFigureSlot` and `addChildSlot` with the following, keeping their placement (`insertSlot` needs `canEmbed`, which is a function declaration and hoists, so order in the file does not matter):

```ts
/** What a new slot holds: one figure (its main figure), or one embedded routine. */
export type SlotContent = { figureId: number } | { childId: number };

/**
 * Insert a slot at index `at`. The new slot's id, or null when the figure is not
 * this routine's dance (or is archived, or gone), or the routine cannot be
 * embedded here.
 *
 * `at` is CLAMPED to `0..length` rather than refused: the picker that sent it
 * may have been opened before another tab removed slots, and appending is what
 * the person meant. There is no way to create an EMPTY slot: a slot must hold
 * something, and the cheapest way to guarantee that is never to make one that
 * does not.
 */
export function insertSlot(
	db: Db,
	routineId: number,
	at: number,
	content: SlotContent
): number | null {
	const routine = getRoutine(db, routineId);
	if (!routine) return null;
	if ('childId' in content) {
		if (!canEmbed(db, routineId, content.childId)) return null;
	} else if (landingIn(buildGraph(db, routine.dance as DanceSlug), content.figureId) === null) {
		return null;
	}
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		// Appended first, then the whole routine re-ordered with it spliced in:
		// inserting at `at` directly would collide with `unique (routine_id,
		// position)` before anything shifted out of the way.
		const step = tx
			.insert(routineSteps)
			.values({
				routineId,
				position: ids.length,
				childRoutineId: 'childId' in content ? content.childId : null
			})
			.returning({ id: routineSteps.id })
			.get();
		if ('figureId' in content) {
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId: content.figureId }).run();
		}
		ids.splice(Math.min(Math.max(at, 0), ids.length), 0, step.id);
		order(tx, ids);
		return step.id;
	});
}

/** Append a slot holding one figure. See `insertSlot`. */
export function addFigureSlot(db: Db, routineId: number, figureId: number): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { figureId });
}

/** Append a slot holding an embedded routine. Null when `canEmbed` says no. */
export function addChildSlot(db: Db, routineId: number, childId: number): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { childId });
}
```

After `moveSlot`, add:

```ts
/**
 * Move a slot to `index` — where a drag dropped it. False when the slot is not
 * this routine's or the index is off either end; a drop is always inside the
 * list, so an index outside it is a stale or tampered request.
 */
export function moveSlotTo(db: Db, routineId: number, stepId: number, index: number): boolean {
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const from = ids.indexOf(stepId);
		if (from < 0 || !Number.isInteger(index) || index < 0 || index >= ids.length) return false;
		ids.splice(from, 1);
		ids.splice(index, 0, stepId);
		order(tx, ids);
		return true;
	});
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: insertSlot at an index, moveSlotTo an index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Delete several slots, and put them back

**Files:**
- Create: `src/lib/routines/snapshot.ts`, `src/lib/routines/snapshot.spec.ts`
- Modify: `src/lib/server/routines.ts` (add `optionsIn`, `deleteSlots`, `restoreSlots`)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces:
  - `interface SlotSnapshot { position: number; childId: number | null; note: string | null; figureIds: number[] }` (client-safe, `$lib/routines/snapshot`)
  - `parseSnapshots(raw: string): SlotSnapshot[] | null`
  - `deleteSlots(db: Db, routineId: number, stepIds: number[]): SlotSnapshot[] | null`
  - `restoreSlots(db: Db, routineId: number, snapshot: SlotSnapshot[]): boolean`

- [ ] **Step 1: Write the failing parser tests** — `src/lib/routines/snapshot.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSnapshots } from './snapshot';

const ok = { position: 2, childId: null, note: 'hand change', figureIds: [7, 3] };

describe('parseSnapshots', () => {
	it('reads what deleteSlots wrote', () => {
		expect(parseSnapshots(JSON.stringify([ok]))).toEqual([ok]);
		const child = { position: 0, childId: 4, note: null, figureIds: [] };
		expect(parseSnapshots(JSON.stringify([child]))).toEqual([child]);
	});

	it.each([
		['not JSON', '{'],
		['not an array', JSON.stringify(ok)],
		['empty', '[]'],
		['a negative position', JSON.stringify([{ ...ok, position: -1 }])],
		['a fractional id', JSON.stringify([{ ...ok, figureIds: [1.5] }])],
		['a repeated figure', JSON.stringify([{ ...ok, figureIds: [3, 3] }])],
		['neither a figure nor a child', JSON.stringify([{ ...ok, figureIds: [] }])],
		['both a figure and a child', JSON.stringify([{ ...ok, childId: 4 }])],
		['an overlong note', JSON.stringify([{ ...ok, note: 'x'.repeat(201) }])],
		['two slots at one position', JSON.stringify([ok, ok])]
	])('refuses %s', (_, raw) => {
		expect(parseSnapshots(raw)).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `nix develop -c npx vitest run src/lib/routines/snapshot.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/routines/snapshot.ts`:

```ts
/**
 * What deleting slots returns and what undoing that delete posts back.
 *
 * PURE and client-safe: the page holds a snapshot between the delete and the
 * Undo tap, and the route parses it back from a form field. Strict, because it
 * arrives as text from the client: every id a positive integer, every slot
 * holding exactly one kind of thing, the note within the 200 characters a note
 * may have. The data function still checks dance and embedding — this only
 * guarantees the shape.
 */
export interface SlotSnapshot {
	/** Where the slot stood when it was deleted. Restored there, or at the end if the routine has since shrunk. */
	position: number;
	childId: number | null;
	note: string | null;
	/** Main figure first. Empty for a child slot. */
	figureIds: number[];
}

/** More than any routine anyone dances; a bound so a tampered body cannot loop the server. */
const MAX_SLOTS = 200;

const isIndex = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

export function parseSnapshots(raw: string): SlotSnapshot[] | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SLOTS) return null;
	const out: SlotSnapshot[] = [];
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null) return null;
		const { position, childId, note, figureIds } = entry as Record<string, unknown>;
		if (!isIndex(position)) return null;
		if (childId !== null && !isId(childId)) return null;
		if (note !== null && (typeof note !== 'string' || note.length > 200)) return null;
		if (!Array.isArray(figureIds) || !figureIds.every(isId)) return null;
		if (new Set(figureIds).size !== figureIds.length) return null;
		// Exactly one of the two: a slot of figures, or a slot holding a routine.
		if ((childId === null) === (figureIds.length === 0)) return null;
		out.push({ position, childId, note, figureIds });
	}
	if (new Set(out.map((s) => s.position)).size !== out.length) return null;
	return out;
}
```

Run: `nix develop -c npx vitest run src/lib/routines/snapshot.spec.ts` — Expected: PASS.

- [ ] **Step 4: Write the failing data-function tests** — add `deleteSlots`, `restoreSlots` to the spec's import list and `import type { SlotSnapshot } from '$lib/routines/snapshot';`, then append:

```ts
describe('deleteSlots and restoreSlots', () => {
	const shape = (db: ReturnType<typeof openDb>, id: number) =>
		routineSlots(db, id).map(({ position, note, childId, figureIds }) => ({
			position,
			note,
			childId,
			figureIds
		}));

	it('round-trips to an identical routine, main figure and note included', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, c.id)!;
		addOption(db, s1, b.id);
		setSlotNote(db, s1, 'hand change');
		const s2 = addFigureSlot(db, routine.id, d.id)!;
		const before = shape(db, routine.id);

		const snapshot = deleteSlots(db, routine.id, [s2, s1])!;
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([s0]);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(shape(db, routine.id)).toEqual(before);
	});

	it('deletes nothing when any id is not this routine’s', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
		const mine = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const foreign = addFigureSlot(db, other.id, figure(db, 'B').id)!;
		expect(deleteSlots(db, routine.id, [mine, foreign])).toBeNull();
		expect(deleteSlots(db, routine.id, [mine, 9999])).toBeNull();
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([mine]);
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});

	it('restores past the end when the routine has since shrunk', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [a, b, c] = ['A', 'B', 'C'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, b.id)!;
		const s2 = addFigureSlot(db, routine.id, c.id)!;
		const snapshot = deleteSlots(db, routine.id, [s2])!; // was at position 2
		deleteSlots(db, routine.id, [s0]);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		const rows = routineSlots(db, routine.id);
		expect(rows[0].id).toBe(s1);
		expect(rows.map((s) => s.figureIds)).toEqual([[b.id], [c.id]]);
	});

	it('restores a figure archived since it was deleted', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const snapshot = deleteSlots(db, routine.id, [addFigureSlot(db, routine.id, a.id)!])!;
		archiveFigure(db, a.id, 1_000);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const snapshot: SlotSnapshot[] = [
			{ position: 0, childId: null, note: null, figureIds: [figure(db, 'B', 'bachata').id] }
		];
		expect(restoreSlots(db, routine.id, snapshot)).toBe(false);
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('refuses a child that can no longer be embedded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const inner = createRoutine(db, 'salsa', { name: 'I', notes: null }).routine;
		const snapshot = deleteSlots(db, parent.id, [addChildSlot(db, parent.id, child.id)!])!;
		addChildSlot(db, child.id, inner.id); // the child now embeds: one level only
		expect(restoreSlots(db, parent.id, snapshot)).toBe(false);
		expect(routineSlots(db, parent.id)).toHaveLength(0);
	});
});
```

- [ ] **Step 5: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts -t "deleteSlots"`
Expected: FAIL — not exported.

- [ ] **Step 6: Implement** — in `src/lib/server/routines.ts`, add the import:

```ts
import type { SlotSnapshot } from '$lib/routines/snapshot';
```

After the `order` helper, add:

```ts
/** These steps' options, main figure first, grouped by step. */
function optionsIn(tx: Tx, stepIds: number[]): Map<number, number[]> {
	if (stepIds.length === 0) return new Map();
	return groupByStep(
		tx
			.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(inArray(routineStepOptions.stepId, stepIds))
			.orderBy(...MAIN_FIRST)
			.all()
	);
}
```

After `deleteSlot`, add:

```ts
/**
 * Hard-delete several slots and renumber, returning what was removed so the
 * editor can offer Undo. All or nothing: null, with nothing deleted, when any
 * id is not this routine's — a stale tab or a double tap must not delete half
 * of what it asked for.
 */
export function deleteSlots(
	db: Db,
	routineId: number,
	stepIds: number[]
): SlotSnapshot[] | null {
	const wanted = [...new Set(stepIds)];
	if (wanted.length === 0) return null;
	return db.transaction((tx) => {
		const steps = tx
			.select({
				id: routineSteps.id,
				position: routineSteps.position,
				childId: routineSteps.childRoutineId,
				note: routineSteps.note
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (steps.length !== wanted.length) return null;
		const options = optionsIn(tx, wanted);
		const snapshot = steps.map((s) => ({
			position: s.position,
			childId: s.childId,
			note: s.note,
			figureIds: options.get(s.id) ?? []
		}));
		// Options first: `routine_step_options.step_id` references the step and
		// `foreign_keys = ON`, so the step cannot go while its options remain.
		tx.delete(routineStepOptions).where(inArray(routineStepOptions.stepId, wanted)).run();
		tx.delete(routineSteps).where(inArray(routineSteps.id, wanted)).run();
		order(tx, slotIds(tx, routineId));
		return snapshot;
	});
}

/**
 * Undo for `deleteSlots`: re-insert each slot at the position it was deleted
 * from, lowest first — which is what makes a multi-slot undo land exactly where
 * the slots were. A position past the end (the routine shrank since) appends.
 *
 * A figure only has to still be this dance's, archived or not: the slot held it
 * a moment ago, and an undo that refused an archived figure would lose the
 * slot. A child must still be embeddable, because the one-level rule is a
 * structural guarantee, not a preference. All or nothing.
 */
export function restoreSlots(db: Db, routineId: number, snapshot: SlotSnapshot[]): boolean {
	const routine = getRoutine(db, routineId);
	if (!routine || snapshot.length === 0) return false;
	const figureIds = [...new Set(snapshot.flatMap((s) => s.figureIds))];
	if (figureIds.length > 0) {
		const ours = db
			.select({ id: figures.id })
			.from(figures)
			.where(and(inArray(figures.id, figureIds), eq(figures.dance, routine.dance)))
			.all();
		if (ours.length !== figureIds.length) return false;
	}
	if (snapshot.some((s) => s.childId !== null && !canEmbed(db, routineId, s.childId))) {
		return false;
	}
	return db.transaction((tx) => {
		for (const s of [...snapshot].sort((a, b) => a.position - b.position)) {
			const ids = slotIds(tx, routineId);
			const step = tx
				.insert(routineSteps)
				.values({ routineId, position: ids.length, childRoutineId: s.childId, note: s.note })
				.returning({ id: routineSteps.id })
				.get();
			for (const figureId of s.figureIds) {
				tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
			}
			ids.splice(Math.min(s.position, ids.length), 0, step.id);
			order(tx, ids);
		}
		return true;
	});
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts src/lib/routines/snapshot.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/routines/snapshot.ts src/lib/routines/snapshot.spec.ts src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: deleteSlots returns a snapshot; restoreSlots puts it back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Duplicate several slots; make a routine from a run

**Files:**
- Modify: `src/lib/server/routines.ts` (add `duplicateSlots`, `embeddedIn`, `extractRoutine`)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Consumes: `optionsIn`, `insertRoutine`, `order`, `slotIds`.
- Produces:
  - `duplicateSlots(db: Db, routineId: number, stepIds: number[]): number[] | null` — the copies' ids, in order.
  - `embeddedIn(db: Db, routineId: number): { id: number; name: string }[]`
  - `extractRoutine(db: Db, routineId: number, stepIds: number[], name: string): { routineId: number; stepId: number } | null`

- [ ] **Step 1: Write the failing tests** — add the three names to the spec's import list, then append:

```ts
describe('duplicateSlots', () => {
	it('copies the selection, in order, after the last selected slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, c.id)!;
		addOption(db, s1, b.id);
		const s2 = addFigureSlot(db, routine.id, d.id)!;
		const copies = duplicateSlots(db, routine.id, [s1, s0])!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([s0, s1, ...copies, s2]);
		expect(rows.map((s) => s.figureIds)).toEqual([[a.id], [c.id, b.id], [a.id], [c.id, b.id], [d.id]]);
	});

	it('copies nothing when any id is not this routine’s', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const s0 = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(duplicateSlots(db, routine.id, [s0, 9999])).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(1);
	});
});

describe('extractRoutine', () => {
	const fourSlots = () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const ids = ['A', 'B', 'C', 'D'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		return { db, routine, ids };
	};
	const routineCount = (db: ReturnType<typeof openDb>) => listRoutines(db, 'salsa').length;

	it('moves a contiguous run into a new routine and embeds it in its place', () => {
		const { db, routine, ids } = fourSlots();
		setSlotNote(db, ids[2], 'spin here');
		const made = extractRoutine(db, routine.id, [ids[2], ids[1]], 'Combo')!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([ids[0], made.stepId, ids[3]]);
		expect(rows[1].childId).toBe(made.routineId);
		// Moved, not copied: the same step rows, options and notes intact.
		const inner = routineSlots(db, made.routineId);
		expect(inner.map((s) => s.id)).toEqual([ids[1], ids[2]]);
		expect(inner[1].note).toBe('spin here');
		expect(getRoutine(db, made.routineId)!.name).toBe('Combo');
		const exercise = db
			.select()
			.from(exercises)
			.where(eq(exercises.routineId, made.routineId))
			.get();
		expect(exercise).toMatchObject({ source: 'routine', name: 'Combo' });
	});

	it('refuses a run with a gap and writes nothing', () => {
		const { db, routine, ids } = fourSlots();
		const before = routineCount(db);
		expect(extractRoutine(db, routine.id, [ids[0], ids[2]], 'Combo')).toBeNull();
		expect(routineCount(db)).toBe(before);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});

	it('refuses a run holding an embedded routine', () => {
		const { db, routine, ids } = fourSlots();
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const embedded = insertSlot(db, routine.id, 1, { childId: child.id })!;
		expect(extractRoutine(db, routine.id, [ids[0], embedded], 'Combo')).toBeNull();
	});

	it('refuses when the routine is itself embedded somewhere', () => {
		const { db, routine, ids } = fourSlots();
		const parent = createRoutine(db, 'salsa', { name: 'Social mix', notes: null }).routine;
		addChildSlot(db, parent.id, routine.id);
		expect(embeddedIn(db, routine.id).map((r) => r.name)).toEqual(['Social mix']);
		expect(extractRoutine(db, routine.id, [ids[0]], 'Combo')).toBeNull();
	});

	it('refuses a slot of another routine', () => {
		const { db, routine } = fourSlots();
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
		const foreign = addFigureSlot(db, other.id, figure(db, 'E').id)!;
		expect(extractRoutine(db, routine.id, [foreign], 'Combo')).toBeNull();
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts -t "duplicateSlots|extractRoutine"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement** — after `duplicateSlot`, add:

```ts
/**
 * Copy several slots — options in order, notes, an embedded child by
 * reference — and place the copies, in routine order, directly after the LAST
 * selected slot: "repeat this bit" belongs right after the bit. The copies'
 * ids, or null (nothing written) when any id is not this routine's.
 */
export function duplicateSlots(db: Db, routineId: number, stepIds: number[]): number[] | null {
	const wanted = [...new Set(stepIds)];
	if (wanted.length === 0) return null;
	return db.transaction((tx) => {
		const steps = tx
			.select({
				id: routineSteps.id,
				childId: routineSteps.childRoutineId,
				note: routineSteps.note
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (steps.length !== wanted.length) return null;
		const options = optionsIn(tx, wanted);
		const ids = slotIds(tx, routineId);
		const copies = steps.map((s, k) => {
			const copy = tx
				.insert(routineSteps)
				.values({ routineId, position: ids.length + k, childRoutineId: s.childId, note: s.note })
				.returning({ id: routineSteps.id })
				.get();
			for (const figureId of options.get(s.id) ?? []) {
				tx.insert(routineStepOptions).values({ stepId: copy.id, figureId }).run();
			}
			return copy.id;
		});
		const last = Math.max(...steps.map((s) => ids.indexOf(s.id)));
		ids.splice(last + 1, 0, ...copies);
		order(tx, ids);
		return copies;
	});
}

/** The routines that embed this one — why it cannot embed anything itself. */
export function embeddedIn(db: Db, routineId: number): { id: number; name: string }[] {
	return db
		.selectDistinct({ id: routines.id, name: routines.name })
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(eq(routineSteps.childRoutineId, routineId))
		.orderBy(asc(routines.name))
		.all();
}

/**
 * "Make routine": pull a contiguous run of slots out into a new routine — with
 * its exercise, as every routine has — and put one slot embedding it where the
 * run was. The slots MOVE (their rows change routine), so options, the main
 * figure and notes come along untouched.
 *
 * Null, with nothing written, when the run has a gap (pulling slots 2 and 5 out
 * would silently reorder the routine), holds an embedded routine, or this
 * routine is itself embedded somewhere — the one-level rule seen from the new
 * routine's side, so no new rule is introduced.
 */
export function extractRoutine(
	db: Db,
	routineId: number,
	stepIds: number[],
	name: string
): { routineId: number; stepId: number } | null {
	const routine = getRoutine(db, routineId);
	const wanted = [...new Set(stepIds)];
	if (!routine || wanted.length === 0 || embeddedIn(db, routineId).length > 0) return null;
	const dance = routine.dance as DanceSlug;
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const run = tx
			.select({ id: routineSteps.id, childId: routineSteps.childRoutineId })
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (run.length !== wanted.length || run.some((s) => s.childId !== null)) return null;
		const at = ids.indexOf(run[0].id);
		if (ids.indexOf(run[run.length - 1].id) - at !== run.length - 1) return null;

		const made = insertRoutine(tx, dance, { name, notes: null }, 3);
		run.forEach((s, k) =>
			tx
				.update(routineSteps)
				.set({ routineId: made.routine.id, position: k })
				.where(eq(routineSteps.id, s.id))
				.run()
		);
		// Compact what is left before appending, or the append's position could
		// collide with a row past the gap the run left behind.
		const rest = ids.filter((id) => !wanted.includes(id));
		order(tx, rest);
		const step = tx
			.insert(routineSteps)
			.values({ routineId, position: rest.length, childRoutineId: made.routine.id })
			.returning({ id: routineSteps.id })
			.get();
		rest.splice(at, 0, step.id);
		order(tx, rest);
		return { routineId: made.routine.id, stepId: step.id };
	});
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: duplicateSlots and extractRoutine (Make routine)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: A row's edges and its position seams

**Files:**
- Modify: `src/lib/routines/routines.ts` (add `RowEdges`, `rowEdges`, `PositionSeam`, `positionSeams`)
- Test: `src/lib/routines/routines.spec.ts`

**Interfaces:**
- Produces:
  - `interface RowEdges { starts: number[]; startCounts: number[]; end: number | null; next: number | null }`
  - `rowEdges(g: Graph, slot: Slot): RowEdges`
  - `type PositionSeam = TimingSeam` (`{ after: number; next: number }`, row indices into `shape.slots`)
  - `positionSeams(g: Graph, shape: RoutineShape): PositionSeam[]`

- [ ] **Step 1: Write the failing tests** — add `positionSeams`, `rowEdges` to the spec's import list, then append (`g` is the fixture at the top of the file: 1 open (neutral), 2 closed, 3 hammerlock; 11 open→closed, 12 closed→open, 13 open|closed→hammerlock, 14 hammerlock→open):

```ts
describe('rowEdges', () => {
	it('is where an options row begins and lands', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [11] })).toEqual({
			starts: [1],
			startCounts: [1],
			end: 2,
			next: 1
		});
	});

	it('borrows a child routine’s first starts and last end', () => {
		const child: Slot = {
			kind: 'child',
			routineId: 9,
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'options', figureIds: [13] }
			]
		};
		expect(rowEdges(g, child)).toMatchObject({ starts: [1], end: 3 });
	});

	it('is empty for a row with nothing danceable', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [999] })).toEqual({
			starts: [],
			startCounts: [],
			end: null,
			next: null
		});
	});
});

describe('positionSeams', () => {
	it('names the rows on both sides of a hold that does not connect', () => {
		// 11 lands in closed; 14 starts from hammerlock.
		expect(positionSeams(g, opts(11, 14))).toEqual([{ after: 0, next: 1 }]);
	});

	it('is silent where the hold connects', () => {
		expect(positionSeams(g, opts(11, 12, 11))).toEqual([]);
	});

	it('skips a slot with nothing danceable, pointing at the next real one', () => {
		expect(positionSeams(g, opts(11, 999, 12))).toEqual([]);
		expect(positionSeams(g, opts(11, 999, 14))).toEqual([{ after: 0, next: 2 }]);
	});

	it('reports a seam at an embedded routine by its own row', () => {
		const shape: RoutineShape = {
			slots: [
				{
					kind: 'child',
					routineId: 9,
					slots: [
						{ kind: 'options', figureIds: [11] },
						{ kind: 'options', figureIds: [12] }
					]
				},
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(positionSeams(g, shape)).toEqual([{ after: 0, next: 1 }]);
	});

	it('is silent out of a row whose end is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 12] },
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(positionSeams(g, shape)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/routines/routines.spec.ts -t "rowEdges|positionSeams"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement** — in `src/lib/routines/routines.ts`, after `slotTiming`, add:

```ts
/**
 * Where one editor row begins and lands, in the hands and on the count: what
 * the picker filters against when building next to it, and what a seam
 * compares. An embedded routine borrows its first slot's starts and its last
 * slot's end, the way it does everywhere else. All empty / null when nothing in
 * the row is danceable — an archived-only slot has no edges to build from.
 */
export interface RowEdges {
	starts: number[];
	startCounts: number[];
	end: number | null;
	next: number | null;
}

export function rowEdges(g: Graph, slot: Slot): RowEdges {
	const flat = flatten(g, { slots: [slot] });
	if (flat.length === 0) return { starts: [], startCounts: [], end: null, next: null };
	const first = flat[0];
	const last = flat[flat.length - 1];
	return {
		starts: slotStarts(g, first),
		startCounts: slotStartCounts(g, first),
		end: sharedEnd(g, last),
		next: sharedNextCount(g, last)
	};
}
```

After `timingSeams`, add:

```ts
/** A position break between two of the editor's own rows. Same shape as a timing seam. */
export type PositionSeam = TimingSeam;

/**
 * `breaks`, indexed by the editor's rows instead of the flat run — the twin of
 * `timingSeams`, for the same reason: flat indices drift from the rows as soon
 * as a slot embeds a routine or holds only archived figures, and the editor
 * draws a seam BETWEEN two rows. A break inside a child is not a seam between
 * rows; `breaks` still counts it.
 */
export function positionSeams(g: Graph, shape: RoutineShape): PositionSeam[] {
	const rows = shape.slots.map((s) => rowEdges(g, s));
	const out: PositionSeam[] = [];
	for (let i = 0; i < rows.length; i++) {
		const end = rows[i].end;
		if (end === null) continue;
		const j = rows.findIndex((r, k) => k > i && r.starts.length > 0);
		if (j === -1) continue;
		if (!rows[j].starts.includes(end)) out.push({ after: i, next: j });
	}
	return out;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/routines/routines.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routines/routines.ts src/lib/routines/routines.spec.ts
git commit -m "routines: rowEdges and positionSeams, per editor row

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The picker's brain, and the selection's rules

**Files:**
- Create: `src/lib/routines/fit.ts`, `src/lib/routines/fit.spec.ts`, `src/lib/routines/selection.ts`, `src/lib/routines/selection.spec.ts`

**Interfaces:**
- Consumes: `RowEdges` (Task 6).
- Produces (`$lib/routines/fit`):
  - `interface Candidate { kind: 'figure' | 'routine'; id: number; parentId: number | null; label: string; starts: number[]; startCounts: number[]; end: number | null; next: number | null }`
  - `type Anchor = { kind: 'none' } | { kind: 'after'; end: number | null; next: number | null } | { kind: 'before'; starts: number[]; startCounts: number[] } | { kind: 'alternative'; starts: number[]; startCount: number; end: number; next: number; exclude: number[] }`
  - `interface Filters { count: boolean; hold: boolean; query: string }`
  - `interface PickGroup { head: Candidate; headFits: boolean; variations: Candidate[] }`
  - `interface PickList { figures: PickGroup[]; routines: Candidate[]; toggles: { count: boolean; hold: boolean }; emptiedBy: ('count' | 'hold')[] }`
  - `fold(s: string): string`, `pickList(candidates: Candidate[], anchor: Anchor, filters: Filters): PickList`, `anchorText(a: Anchor, name: (id: number) => string): string | null`, `anchorAfter(e: RowEdges): Anchor`, `anchorBefore(e: RowEdges): Anchor`, `anchorAlternative(main: Candidate | undefined, exclude: number[]): Anchor | null`
- Produces (`$lib/routines/selection`):
  - `inOrder(rows: { id: number }[], selected: number[]): number[]`
  - `extractBlock(rows: { id: number; isRoutine: boolean }[], selected: number[], embeddedIn: string[]): string | null`

- [ ] **Step 1: Write the failing `fit` tests** — `src/lib/routines/fit.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	anchorAfter,
	anchorAlternative,
	anchorBefore,
	anchorText,
	fold,
	pickList,
	type Anchor,
	type Candidate
} from './fit';

/** Positions: 1 open (neutral), 2 closed, 3 hammerlock. */
const fig = (
	id: number,
	label: string,
	o: Partial<Candidate> = {},
	parentId: number | null = null
): Candidate => ({
	kind: 'figure',
	id,
	parentId,
	label,
	starts: [1],
	startCounts: [1],
	end: 1,
	next: 1,
	...o
});

const candidates: Candidate[] = [
	fig(1, 'Cross body lead', { end: 2 }),
	fig(2, 'Dile que no', { end: 2 }),
	fig(3, 'Enchufla', { starts: [2] }),
	fig(4, 'Enchufla · Doble', {}, 3),
	fig(5, 'Sombrero', { starts: [3] }),
	fig(6, 'Son basic', { startCounts: [5], next: 5 }),
	{ ...fig(7, 'Shine combo'), kind: 'routine' }
];

const all = { count: true, hold: true, query: '' };
const after: Anchor = { kind: 'after', end: 1, next: 1 }; // starts on 1 from open
const ids = (l: ReturnType<typeof pickList>) => ({
	figures: l.figures.map((g) => [g.head.id, g.headFits, g.variations.map((v) => v.id)]),
	routines: l.routines.map((r) => r.id)
});

describe('pickList', () => {
	it('offers everything without an anchor', () => {
		const l = pickList(candidates, { kind: 'none' }, all);
		expect(l.figures).toHaveLength(5);
		expect(l.routines.map((r) => r.id)).toEqual([7]);
		expect(l.toggles).toEqual({ count: false, hold: false });
	});

	it('after a slot: starts on its next count, from where it lands', () => {
		expect(ids(pickList(candidates, after, all))).toEqual({
			figures: [
				[1, true, []],
				[2, true, []],
				[3, false, [4]], // Enchufla starts from closed; its Doble from open
			],
			routines: [7]
		});
	});

	it('before a slot: lands where it starts, ready for its count', () => {
		const before: Anchor = { kind: 'before', starts: [2], startCounts: [1] };
		expect(ids(pickList(candidates, before, all)).figures).toEqual([
			[1, true, []],
			[2, true, []]
		]);
	});

	it('turns each filter off on its own', () => {
		const countOff = ids(pickList(candidates, after, { ...all, count: false })).figures;
		expect(countOff.map((g) => g[0])).toContain(6); // Son basic starts on 5
		expect(countOff.map((g) => g[0])).not.toContain(5); // Sombrero still fails Hold
		const holdOff = ids(pickList(candidates, after, { ...all, hold: false })).figures;
		expect(holdOff.map((g) => g[0])).toEqual([1, 2, 3, 5]);
	});

	it('ignores case and accents', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'DILE quÉ' });
		expect(ids(l).figures).toEqual([[2, true, []]]);
	});

	it('finds a variation by its own name, under a greyed figure', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'doble' });
		expect(ids(l).figures).toEqual([[3, false, [4]]]);
	});

	it('says which filter emptied the list', () => {
		const shadow: Anchor = { kind: 'after', end: 9, next: 1 };
		const l = pickList(candidates, shadow, all);
		expect(l.figures).toEqual([]);
		expect(l.emptiedBy).toEqual(['hold']);
	});

	it('hides a chip the anchor cannot use', () => {
		expect(pickList(candidates, { kind: 'after', end: null, next: 1 }, all).toggles).toEqual({
			count: true,
			hold: false
		});
	});

	it('in alternative mode: same starts, count and landing; no routines; filters ignored', () => {
		const alt: Anchor = {
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			end: 2,
			next: 1,
			exclude: [1]
		};
		const l = pickList(candidates, alt, { count: false, hold: false, query: '' });
		expect(ids(l)).toEqual({ figures: [[2, true, []]], routines: [] });
	});
});

describe('anchors', () => {
	it('builds from a row’s edges', () => {
		const e = { starts: [2], startCounts: [1], end: 3, next: 5 };
		expect(anchorAfter(e)).toEqual({ kind: 'after', end: 3, next: 5 });
		expect(anchorBefore(e)).toEqual({ kind: 'before', starts: [2], startCounts: [1] });
	});

	it('falls back to no anchor for a row with nothing danceable', () => {
		const empty = { starts: [], startCounts: [], end: null, next: null };
		expect(anchorAfter(empty)).toEqual({ kind: 'none' });
		expect(anchorBefore(empty)).toEqual({ kind: 'none' });
	});

	it('has no alternative anchor when the main figure is gone', () => {
		expect(anchorAlternative(undefined, [1])).toBeNull();
		expect(anchorAlternative(fig(1, 'A', { end: 2 }), [1])).toEqual({
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			end: 2,
			next: 1,
			exclude: [1]
		});
	});
});

describe('anchorText', () => {
	const name = (id: number) => ['', 'Open', 'Closed', 'Hammerlock'][id];
	it('says it the way a dancer does', () => {
		expect(anchorText({ kind: 'after', end: 2, next: 1 }, name)).toBe('Starts on 1 from Closed');
		expect(anchorText({ kind: 'before', starts: [3], startCounts: [1] }, name)).toBe(
			'Ends on 8 at Hammerlock'
		);
		expect(anchorText({ kind: 'before', starts: [1, 2], startCounts: [5] }, name)).toBe(
			'Ends on 4 at Open or Closed'
		);
		expect(
			anchorText(
				{ kind: 'alternative', starts: [2], startCount: 1, end: 1, next: 1, exclude: [] },
				name
			)
		).toBe('Closed → Open, 1→1');
		expect(anchorText({ kind: 'none' }, name)).toBeNull();
	});
});

describe('fold', () => {
	it('lowercases and strips accents', () => {
		expect(fold('Dile Qué Nó')).toBe('dile que no');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `nix develop -c npx vitest run src/lib/routines/fit.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/routines/fit.ts`:

```ts
/**
 * The picker's brain: which figures, variations and routines fit next to a
 * slot, grouped the way the sheet shows them.
 *
 * PURE and client-safe, like the rest of `src/lib/routines/`: the load hands
 * over candidates whose positions are already resolved (untagged reads as
 * neutral there, through `startsOf`/`endOf`), and nothing here knows dances
 * exist.
 *
 * Fitting is ONE-SIDED on purpose. Building down from a slot matches where it
 * lands; building up into one matches where it starts. A gap often takes more
 * than one figure to close, so filtering by both neighbours at once would hide
 * exactly the figure that starts the bridge.
 */
import type { RowEdges } from './routines';

export interface Candidate {
	kind: 'figure' | 'routine';
	id: number;
	/** A variation's figure; null for a figure or a routine. */
	parentId: number | null;
	/** "Enchufla · Doble" for a variation — never its bare name. */
	label: string;
	/** Resolved positions. Empty when nothing in it is danceable. */
	starts: number[];
	startCounts: number[];
	end: number | null;
	next: number | null;
}

export type Anchor =
	| { kind: 'none' }
	/** Building down from a slot: where it lands, and the count it leaves the next on. */
	| { kind: 'after'; end: number | null; next: number | null }
	/** Building up into a slot: where it can be entered, and on which counts. */
	| { kind: 'before'; starts: number[]; startCounts: number[] }
	/** Standing in for a slot's main figure. `exclude` is what the slot already holds. */
	| {
			kind: 'alternative';
			starts: number[];
			startCount: number;
			end: number;
			next: number;
			exclude: number[];
	  };

export interface Filters {
	count: boolean;
	hold: boolean;
	query: string;
}

export interface PickGroup {
	head: Candidate;
	/** False: the figure itself does not fit; it is shown greyed so its variations still read as a group. */
	headFits: boolean;
	variations: Candidate[];
}

export interface PickList {
	figures: PickGroup[];
	routines: Candidate[];
	/** Which chips mean anything here: a side the anchor does not know cannot filter. */
	toggles: { count: boolean; hold: boolean };
	/** Chips that, turned off, would show something. Empty unless the list is. */
	emptiedBy: ('count' | 'hold')[];
}

/** Lowercase, accents stripped: "Dile Qué Nó" and "dile que no" are one search. */
export function fold(s: string): string {
	return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function toggles(a: Anchor): { count: boolean; hold: boolean } {
	if (a.kind === 'after') return { count: a.next !== null, hold: a.end !== null };
	if (a.kind === 'before') return { count: a.startCounts.length > 0, hold: a.starts.length > 0 };
	return { count: false, hold: false };
}

function fitsCount(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'after') return a.next === null || c.startCounts.includes(a.next);
	if (a.kind === 'before') {
		return a.startCounts.length === 0 || (c.next !== null && a.startCounts.includes(c.next));
	}
	return true;
}

function fitsHold(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'after') return a.end === null || c.starts.includes(a.end);
	if (a.kind === 'before') {
		return a.starts.length === 0 || (c.end !== null && a.starts.includes(c.end));
	}
	return true;
}

/**
 * The server's rule for an alternative (`addOption`), mirrored: same landing,
 * same start count, at least one shared start. Not switchable — the server
 * would refuse anything else.
 */
function standsIn(c: Candidate, a: Extract<Anchor, { kind: 'alternative' }>): boolean {
	return (
		c.kind === 'figure' &&
		!a.exclude.includes(c.id) &&
		c.end === a.end &&
		c.next === a.next &&
		c.startCounts.includes(a.startCount) &&
		c.starts.some((p) => a.starts.includes(p))
	);
}

export function pickList(candidates: Candidate[], anchor: Anchor, filters: Filters): PickList {
	const t = toggles(anchor);
	const q = fold(filters.query.trim());
	const matches = (c: Candidate) => q === '' || fold(c.label).includes(q);

	const build = (on: { count: boolean; hold: boolean }) => {
		const ok = (c: Candidate) =>
			matches(c) &&
			(anchor.kind === 'alternative'
				? standsIn(c, anchor)
				: (!on.count || fitsCount(c, anchor)) && (!on.hold || fitsHold(c, anchor)));
		const figures: PickGroup[] = [];
		for (const head of candidates) {
			if (head.kind !== 'figure' || head.parentId !== null) continue;
			const variations = candidates.filter(
				(c) => c.kind === 'figure' && c.parentId === head.id && ok(c)
			);
			const headFits = ok(head);
			if (headFits || variations.length > 0) figures.push({ head, headFits, variations });
		}
		const routines =
			anchor.kind === 'alternative' ? [] : candidates.filter((c) => c.kind === 'routine' && ok(c));
		return { figures, routines };
	};
	const isEmpty = (l: ReturnType<typeof build>) => l.figures.length === 0 && l.routines.length === 0;

	const on = { count: filters.count && t.count, hold: filters.hold && t.hold };
	const list = build(on);
	const emptiedBy: ('count' | 'hold')[] = [];
	if (isEmpty(list)) {
		if (on.count && !isEmpty(build({ ...on, count: false }))) emptiedBy.push('count');
		if (on.hold && !isEmpty(build({ ...on, hold: false }))) emptiedBy.push('hold');
		if (emptiedBy.length === 0 && on.count && on.hold && !isEmpty(build({ count: false, hold: false }))) {
			emptiedBy.push('count', 'hold');
		}
	}
	return { ...list, toggles: t, emptiedBy };
}

/** Building down from a row. No anchor when the row has nothing danceable to build from. */
export function anchorAfter(e: RowEdges): Anchor {
	return e.end === null && e.next === null ? { kind: 'none' } : { kind: 'after', end: e.end, next: e.next };
}

/** Building up into a row. */
export function anchorBefore(e: RowEdges): Anchor {
	return e.starts.length === 0 && e.startCounts.length === 0
		? { kind: 'none' }
		: { kind: 'before', starts: e.starts, startCounts: e.startCounts };
}

/** Standing in for a main figure. Null when it is archived or gone: nothing to match. */
export function anchorAlternative(main: Candidate | undefined, exclude: number[]): Anchor | null {
	if (!main || main.end === null || main.next === null || main.startCounts.length === 0) return null;
	return {
		kind: 'alternative',
		starts: main.starts,
		startCount: main.startCounts[0],
		end: main.end,
		next: main.next,
		exclude
	};
}

/** The count before `n`: a slot starting on 1 is reached by a figure ending on 8. */
const countBefore = (n: number) => (n === 1 ? 8 : n - 1);

/** The picker's context line. Null when there is nothing to say. */
export function anchorText(a: Anchor, name: (id: number) => string): string | null {
	const names = (ids: number[]) => ids.map(name).join(' or ');
	if (a.kind === 'after') {
		if (a.next !== null && a.end !== null) return `Starts on ${a.next} from ${name(a.end)}`;
		if (a.next !== null) return `Starts on ${a.next}`;
		if (a.end !== null) return `Starts from ${name(a.end)}`;
		return null;
	}
	if (a.kind === 'before') {
		const counts = a.startCounts.map(countBefore).join(' or ');
		if (counts && a.starts.length > 0) return `Ends on ${counts} at ${names(a.starts)}`;
		if (counts) return `Ends on ${counts}`;
		if (a.starts.length > 0) return `Ends at ${names(a.starts)}`;
		return null;
	}
	if (a.kind === 'alternative') {
		return `${names(a.starts)} → ${name(a.end)}, ${a.startCount}→${a.next}`;
	}
	return null;
}
```

Run: `nix develop -c npx vitest run src/lib/routines/fit.spec.ts` — Expected: PASS.

- [ ] **Step 4: Write the failing `selection` tests** — `src/lib/routines/selection.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractBlock, inOrder } from './selection';

const rows = [
	{ id: 10, isRoutine: false },
	{ id: 11, isRoutine: false },
	{ id: 12, isRoutine: true },
	{ id: 13, isRoutine: false }
];

describe('inOrder', () => {
	it('puts a selection in routine order, whatever order it was tapped in', () => {
		expect(inOrder(rows, [13, 10, 11])).toEqual([10, 11, 13]);
	});
});

describe('extractBlock', () => {
	it('allows a contiguous run of figure slots', () => {
		expect(extractBlock(rows, [11, 10], [])).toBeNull();
	});

	it('names the reason it cannot', () => {
		expect(extractBlock(rows, [10, 13], [])).toBe('Select slots next to each other.');
		expect(extractBlock(rows, [11, 12], [])).toBe('Slot 3 is a routine — embedding is one level.');
		expect(extractBlock(rows, [10], ['Social mix'])).toBe(
			'This routine is embedded in Social mix — embedding is one level.'
		);
	});
});
```

- [ ] **Step 5: Implement** — `src/lib/routines/selection.ts`:

```ts
/**
 * Rules for the editor's long-press selection. PURE and client-safe.
 *
 * `extractBlock` is the client's copy of `extractRoutine`'s refusals, worded
 * for a person, so "Make routine" can say why it is greyed BEFORE anything is
 * posted. The server still decides.
 */

/** Selected ids in routine order, whatever order they were tapped in. */
export function inOrder(rows: { id: number }[], selected: number[]): number[] {
	return rows.filter((r) => selected.includes(r.id)).map((r) => r.id);
}

/** Why the selection cannot become a routine, or null when it can. */
export function extractBlock(
	rows: { id: number; isRoutine: boolean }[],
	selected: number[],
	embeddedIn: string[]
): string | null {
	if (embeddedIn.length > 0) {
		return `This routine is embedded in ${embeddedIn.join(', ')} — embedding is one level.`;
	}
	const at = rows
		.map((r, i) => (selected.includes(r.id) ? i : -1))
		.filter((i) => i >= 0);
	if (at.length === 0) return 'Select the slots to make into a routine.';
	const routine = at.find((i) => rows[i].isRoutine);
	if (routine !== undefined) return `Slot ${routine + 1} is a routine — embedding is one level.`;
	if (at[at.length - 1] - at[0] !== at.length - 1) return 'Select slots next to each other.';
	return null;
}
```

- [ ] **Step 6: Run both to verify they pass**

Run: `nix develop -c npx vitest run src/lib/routines`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routines/fit.ts src/lib/routines/fit.spec.ts src/lib/routines/selection.ts src/lib/routines/selection.spec.ts
git commit -m "routines: the picker's fitting, grouping and search; selection rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Gestures — drag and swipe, DOM-free

**Files:**
- Create: `src/lib/gestures/drag.ts`, `src/lib/gestures/drag.spec.ts`, `src/lib/gestures/swipe.ts`, `src/lib/gestures/swipe.spec.ts`

**Interfaces:**
- Produces (`$lib/gestures/drag`): `dropIndex(centers: number[], y: number, from: number): number`, `shiftFor(i: number, from: number, to: number, step: number): number`, `autoScroll(y: number, top: number, bottom: number, edge?: number, max?: number): number`, `moved<T>(list: T[], from: number, to: number): T[]`
- Produces (`$lib/gestures/swipe`): `type Side = 'left' | 'right' | null`; `interface SwipeOptions { reveal: number; lockPx: number; snap: number; sides: () => { left: boolean; right: boolean } }`; `interface Swipe { down(x: number, y: number, open: Side): void; move(x: number, y: number): number | null; up(): Side | undefined; swallow(): boolean }`; `swipe(o: SwipeOptions): Swipe`

- [ ] **Step 1: Write the failing tests** — `src/lib/gestures/drag.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autoScroll, dropIndex, moved, shiftFor } from './drag';

const centers = [50, 150, 250, 350]; // four 100 px cards

describe('dropIndex', () => {
	it('stays put until the card passes a neighbour’s middle', () => {
		expect(dropIndex(centers, 140, 0)).toBe(0);
		expect(dropIndex(centers, 160, 0)).toBe(1);
	});

	it('reaches both ends', () => {
		expect(dropIndex(centers, 999, 1)).toBe(3);
		expect(dropIndex(centers, -50, 2)).toBe(0);
	});
});

describe('shiftFor', () => {
	it('slides the cards between from and to out of the way', () => {
		expect([0, 1, 2, 3].map((i) => shiftFor(i, 0, 2, 108))).toEqual([0, -108, -108, 0]);
		expect([0, 1, 2, 3].map((i) => shiftFor(i, 3, 1, 108))).toEqual([0, 108, 108, 0]);
	});
});

describe('autoScroll', () => {
	it('is still in the middle and speeds up toward each edge', () => {
		expect(autoScroll(400, 0, 800)).toBe(0);
		expect(autoScroll(36, 0, 800)).toBeLessThan(0);
		expect(autoScroll(0, 0, 800)).toBe(-16);
		expect(autoScroll(800, 0, 800)).toBe(16);
	});
});

describe('moved', () => {
	it('moves one item and leaves the input alone', () => {
		const list = ['a', 'b', 'c'];
		expect(moved(list, 0, 2)).toEqual(['b', 'c', 'a']);
		expect(list).toEqual(['a', 'b', 'c']);
	});
});
```

`src/lib/gestures/swipe.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { swipe } from './swipe';

const make = (left = true, right = true) =>
	swipe({ reveal: 84, lockPx: 10, snap: 0.4, sides: () => ({ left, right }) });

describe('swipe', () => {
	it('is undecided inside the lock distance', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(105, 102)).toBeNull();
	});

	it('follows a horizontal move once locked', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(80, 102)).toBe(-20);
	});

	it('gives a vertical move to the page for the rest of the gesture', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(102, 130)).toBeNull();
		expect(s.move(20, 130)).toBeNull();
		expect(s.up()).toBeUndefined();
		expect(s.swallow()).toBe(false);
	});

	it('snaps open past 40 % of the reveal, shut short of it', () => {
		const s = make();
		s.down(100, 100, null);
		s.move(60, 100); // -40 ≥ 33.6
		expect(s.up()).toBe('left');
		s.down(100, 100, null);
		s.move(80, 100); // -20
		expect(s.up()).toBeNull();
		s.down(100, 100, null);
		s.move(150, 100);
		expect(s.up()).toBe('right');
	});

	it('starts from where an open card rests', () => {
		const s = make();
		s.down(100, 100, 'left');
		expect(s.move(120, 100)).toBe(-64);
		expect(s.up()).toBe('left');
		s.down(100, 100, 'left');
		s.move(160, 100); // -84 + 60 = -24
		expect(s.up()).toBeNull();
	});

	it('will not open a side that has no button', () => {
		const s = make(true, false);
		s.down(100, 100, null);
		expect(s.move(200, 100)).toBe(0);
		expect(s.up()).toBeNull();
	});

	it('is a tap, not a swipe, without movement — and swallows only a swipe’s click', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.up()).toBeUndefined();
		expect(s.swallow()).toBe(false);
		s.down(100, 100, null);
		s.move(50, 100);
		s.up();
		expect(s.swallow()).toBe(true);
		expect(s.swallow()).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/gestures`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement** — `src/lib/gestures/drag.ts`:

```ts
/**
 * The arithmetic of dragging a card through a list. DOM-free, in the manner of
 * `src/lib/longpress.ts`: the component measures, feeds numbers in, and draws
 * what comes out — so the part that is easy to get wrong is the part tested.
 */

/**
 * Where the dragged card would land: the number of OTHER cards whose middle it
 * has passed. `centers` are measured once, at the start of the drag, in page
 * coordinates; `y` is the dragged card's middle now.
 */
export function dropIndex(centers: number[], y: number, from: number): number {
	let to = 0;
	centers.forEach((c, i) => {
		if (i !== from && c < y) to++;
	});
	return to;
}

/** How far card `i` slides to open a gap at `to`: one card-and-gap `step`, or nothing. */
export function shiftFor(i: number, from: number, to: number, step: number): number {
	if (i === from) return 0;
	if (from < to && i > from && i <= to) return -step;
	if (to < from && i >= to && i < from) return step;
	return 0;
}

/**
 * Pixels to scroll this frame while the pointer is within `edge` of the
 * viewport's top or bottom — faster the closer it gets, up to `max`.
 */
export function autoScroll(y: number, top: number, bottom: number, edge = 72, max = 16): number {
	if (y < top + edge) return -Math.round(max * Math.min(1, (top + edge - y) / edge));
	if (y > bottom - edge) return Math.round(max * Math.min(1, (y - (bottom - edge)) / edge));
	return 0;
}

/** A copy of `list` with the item at `from` moved to `to`. */
export function moved<T>(list: T[], from: number, to: number): T[] {
	const out = [...list];
	const [item] = out.splice(from, 1);
	out.splice(to, 0, item);
	return out;
}
```

`src/lib/gestures/swipe.ts`:

```ts
/**
 * A swipe on a card that reveals a button underneath it — Delete on one side,
 * Open on the other. DOM-free, in the manner of `src/lib/longpress.ts`: the
 * component feeds pointer positions and asks where to draw and where to settle.
 *
 * The direction locks once the pointer has moved `lockPx`. Mostly vertical is
 * a page scroll and stays one for the rest of the gesture — a swipe that
 * started while the thumb was scrolling is the swipe nobody meant.
 */

/** Which way the card is swiped open: 'left' shows the right-hand button. */
export type Side = 'left' | 'right' | null;

export interface SwipeOptions {
	/** The button's width: how far an open card rests from home. */
	reveal: number;
	lockPx: number;
	/** Fraction of `reveal` past which a release snaps open. */
	snap: number;
	/** Which sides have a button. A function, so a card's buttons can change without a new swipe. */
	sides: () => { left: boolean; right: boolean };
}

export interface Swipe {
	down(x: number, y: number, open: Side): void;
	/** The card's offset to draw, or null while undecided or once this is a scroll. */
	move(x: number, y: number): number | null;
	/** Where to settle; undefined when it was never a swipe (a tap, or a scroll). */
	up(): Side | undefined;
	/** True once, for the click that follows a swipe — it must not also tap the card. */
	swallow(): boolean;
}

export function swipe(o: SwipeOptions): Swipe {
	let origin: { x: number; y: number; base: number } | null = null;
	let axis: 'x' | 'y' | null = null;
	let offset = 0;
	let owed = false;

	return {
		down(x, y, open) {
			// A new gesture: whatever click the last swipe owed has come or never will.
			owed = false;
			axis = null;
			const base = open === 'left' ? -o.reveal : open === 'right' ? o.reveal : 0;
			origin = { x, y, base };
			offset = base;
		},
		move(x, y) {
			if (!origin || axis === 'y') return null;
			const dx = x - origin.x;
			const dy = y - origin.y;
			if (axis === null) {
				if (Math.hypot(dx, dy) < o.lockPx) return null;
				axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
				if (axis === 'y') return null;
			}
			const { left, right } = o.sides();
			// A little past the button, then it stops: elastic enough to feel, not
			// so loose the card can be flung off.
			const min = left ? -o.reveal * 1.25 : 0;
			const max = right ? o.reveal * 1.25 : 0;
			offset = Math.min(max, Math.max(min, origin.base + dx));
			return offset;
		},
		up() {
			const was = origin;
			origin = null;
			if (!was || axis !== 'x') return undefined;
			owed = true;
			if (offset <= -o.reveal * o.snap) return 'left';
			if (offset >= o.reveal * o.snap) return 'right';
			return null;
		},
		swallow() {
			if (!owed) return false;
			owed = false;
			return true;
		}
	};
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/gestures`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gestures
git commit -m "gestures: drag and swipe arithmetic, DOM-free and tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The route — candidates, edges, seams, and the new actions

**Files:**
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts`
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces (page data, new keys): `candidates: Candidate[]`, `edges: RowEdges[]` (parallel to `slots`), `positionSeams: PositionSeam[]`, `embeddedIn: string[]`.
- Produces (actions, new): `insert` {at, figureId | childId} → `{ ok, stepId }`; `reorder` {stepId, index}; `deleteMany` {stepIds…} → `{ ok, snapshot: SlotSnapshot[] }`; `restore` {snapshot: JSON}; `restoreOption` {stepId, figureId}; `duplicateMany` {stepIds…}; `extract` {stepIds…, name} → `{ ok, stepId }`. Old actions stay until Task 12.

- [ ] **Step 1: Write the failing dance-wall tests** — in `src/routes/[dance]/dance-wall.spec.ts`, extend the routines import:

```ts
import {
	addFigureSlot,
	addOption,
	createRoutine,
	routineSlots
} from '$lib/server/routines';
```

(unchanged names — it already imports these), then add inside `describe("the routine detail route refuses the other dance's rows", …)`, after the last `it`:

```ts
	it('will not insert a bachata figure into a salsa routine', async () => {
		const res = (await call(
			routinePage.actions.insert,
			post('salsa', { at: '0', figureId: String(bachataFigureId) }, String(salsaRoutineAId))
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it.each([
		['reorder', { index: '0' }],
		['deleteMany', {}],
		['duplicateMany', {}],
		['extract', { name: 'Stolen' }]
	])("will not %s another salsa routine's slot", async (action, extra) => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const ids = action === 'reorder' ? { stepId: String(stepId) } : { stepIds: String(stepId) };
		const res = (await call(
			routinePage.actions[action as keyof typeof routinePage.actions],
			post('salsa', { ...ids, ...extra }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineBId).map((s) => s.id)).toEqual([stepId]);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it('will not restore a bachata figure into a salsa routine', async () => {
		const snapshot = JSON.stringify([
			{ position: 0, childId: null, note: null, figureIds: [bachataFigureId] }
		]);
		const res = (await call(
			routinePage.actions.restore,
			post('salsa', { snapshot }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it("will not put an alternative back on another salsa routine's slot", async () => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const res = (await call(
			routinePage.actions.restoreOption,
			post(
				'salsa',
				{ stepId: String(stepId), figureId: String(salsaFigureId2) },
				String(salsaRoutineAId)
			)
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot does not belong to this routine.');
		expect(routineSlots(db, salsaRoutineBId)[0].figureIds).toEqual([salsaFigureId]);
	});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run 'src/routes/[dance]/dance-wall.spec.ts'`
Expected: FAIL — the new actions are `undefined`.

- [ ] **Step 3: Implement** — in `+page.server.ts`:

Imports — extend:

```ts
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	deleteSlot,
	deleteSlots,
	duplicateRoutine,
	duplicateSlot,
	duplicateSlots,
	embeddable,
	embeddedIn,
	extractRoutine,
	insertSlot,
	moveSlot,
	moveSlotTo,
	removeOption,
	restoreOption,
	restoreSlots,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import {
	breaks,
	loops,
	positionSeams,
	routineEnd,
	routineStarts,
	rowEdges,
	slotStarts,
	slotTiming,
	timingBreaks,
	timingSeams,
	type OptionsSlot
} from '$lib/routines/routines';
import { endOf, figureById, nextCountOf, startsOf } from '$lib/graph/graph';
import { int, ints, optionalText, text } from '$lib/server/form';
import { parseSnapshots } from '$lib/routines/snapshot';
import type { Candidate } from '$lib/routines/fit';
```

In `load`, replace `const shape = routineShapes(db, dance).get(routine.id) ?? { slots: [] };` with:

```ts
	const shapes = routineShapes(db, dance);
	const shape = shapes.get(routine.id) ?? { slots: [] };
```

and, before `return {`, add:

```ts
	// What the picker can offer, each with where it begins and lands — resolved
	// here, through the graph, so an untagged figure is neutral on the client
	// exactly as it is on the server. Archived figures are not candidates; a slot
	// still holding one names it through `labels`.
	const candidates: Candidate[] = [
		...listVersions(db, dance).flatMap((v): Candidate[] => {
			const node = figureById(graph, v.id);
			if (!node) return [];
			return [
				{
					kind: 'figure',
					id: v.id,
					parentId: v.parentId,
					label: v.label,
					starts: startsOf(graph, node),
					startCounts: [node.start],
					end: endOf(graph, node),
					next: nextCountOf(node)
				}
			];
		}),
		...embeddable(db, routine.id).map((r): Candidate => {
			// An embeddable routine embeds nothing, so its own slots are all options.
			const own = (shapes.get(r.id)?.slots ?? []).filter(
				(s): s is OptionsSlot => s.kind === 'options'
			);
			return {
				kind: 'routine',
				id: r.id,
				parentId: null,
				label: r.name,
				...rowEdges(graph, { kind: 'child', routineId: r.id, slots: own })
			};
		})
	];
```

and add to the returned object:

```ts
		candidates,
		// Per row, parallel to `slots`: where it begins and lands — the picker's
		// anchors and the seams' labels.
		edges: shape.slots.map((s) => rowEdges(graph, s)),
		positionSeams: positionSeams(graph, shape),
		// Why "Make routine" is greyed, named.
		embeddedIn: embeddedIn(db, routine.id).map((r) => r.name),
```

In `actions`, add:

```ts
	insert: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const at = int(form, 'at');
		const figureId = int(form, 'figureId');
		const childId = int(form, 'childId');
		if (at === undefined || (figureId === undefined) === (childId === undefined)) {
			return fail(400, { message: 'Could not read what to add, or where.' });
		}
		if (childId !== undefined) {
			// Only what the picker offered: `canEmbed` alone would accept an archived routine.
			const offered = embeddable(db, routine.id).some((r) => r.id === childId);
			const stepId = offered ? insertSlot(db, routine.id, at, { childId }) : null;
			if (stepId === null) return fail(400, { message: 'That routine cannot be embedded here.' });
			return { ok: true, stepId };
		}
		const stepId = insertSlot(db, routine.id, at, { figureId: figureId as number });
		if (stepId === null) return fail(400, { message: 'That figure is not part of this dance.' });
		return { ok: true, stepId };
	},

	reorder: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const index = int(form, 'index');
		if (
			stepId === undefined ||
			index === undefined ||
			!moveSlotTo(getDb(), routine.id, stepId, index)
		) {
			return slotFail('That slot cannot move there.', stepId);
		}
		return { ok: true };
	},

	deleteMany: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		const snapshot = stepIds.length === 0 ? null : deleteSlots(getDb(), routine.id, stepIds);
		if (!snapshot) return fail(400, { message: 'Those slots are already gone.' });
		// Handed back so the page can offer Undo, which posts it to `restore`.
		return { ok: true, snapshot };
	},

	restore: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const snapshot = parseSnapshots(String(form.get('snapshot') ?? ''));
		if (!snapshot || !restoreSlots(getDb(), routine.id, snapshot)) {
			return fail(400, { message: 'Those slots could not be put back.' });
		}
		return { ok: true };
	},

	restoreOption: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		if (!restoreOption(db, stepId, figureId)) {
			return slotFail('That alternative could not be put back.', stepId);
		}
		return { ok: true };
	},

	duplicateMany: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		if (stepIds.length === 0 || duplicateSlots(getDb(), routine.id, stepIds) === null) {
			return fail(400, { message: 'Those slots could not be copied.' });
		}
		return { ok: true };
	},

	extract: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		const name = text(form, 'name');
		if (!name) return fail(400, { message: 'Give the new routine a name (up to 200 characters).' });
		const made = stepIds.length === 0 ? null : extractRoutine(getDb(), routine.id, stepIds, name);
		if (!made) {
			return fail(400, {
				message:
					'Those slots cannot become a routine: they have to sit next to each other and hold no routine, and this routine cannot itself be embedded anywhere.'
			});
		}
		return { ok: true, stepId: made.stepId };
	}
```

`moveSlot`, `deleteSlot`, `duplicateSlot`, `addFigureSlot`, `addChildSlot` stay imported and used by the old actions until Task 12.

- [ ] **Step 4: Run to verify they pass, then the full check**

Run: `nix develop -c npx vitest run 'src/routes/[dance]/dance-wall.spec.ts'`
Expected: PASS.

Run: `nix develop -c npm run check`
Expected: PASS (the page still renders through its old fields; nothing reads the new ones yet).

- [ ] **Step 5: Commit**

```bash
git add 'src/routes/[dance]/routines/[id]/+page.server.ts' 'src/routes/[dance]/dance-wall.spec.ts'
git commit -m "routine page: candidates, edges, position seams, and the editor's actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Posting actions, the undo toast, and the picker sheet

**Files:**
- Create: `src/lib/components/routines/types.ts`, `src/lib/components/routines/act.ts`, `src/lib/components/routines/UndoToast.svelte`, `src/lib/components/routines/SlotPicker.svelte`

**Interfaces:**
- Consumes: `pickList`, `anchorText`, `Candidate`, `Anchor` (Task 7); `Side` (Task 8); `Sheet.svelte`, `FIELD` from `$lib/components/ui/styles`.
- Produces:
  - `types.ts`: `AltView { id: number; label: string; timing: string; href: string }`, `RowView { id: number; title: string; meta: string; note: string | null; href: string | null; isRoutine: boolean; alternatives: AltView[]; canAddAlternative: boolean; failure: string | null; seam: { label: string; next: number } | null }`, `Swiped = { key: string; side: Side } | null`
  - `act.ts`: `type Field = string | number | null | (string | number)[]`; `act(name: string, fields: Record<string, Field>): Promise<ActionResult>`
  - `UndoToast.svelte` props: `toast: { id: number; message: string } | null; onundo: () => void; ondismiss: () => void`
  - `SlotPicker.svelte` props: `open: boolean; title: string; anchor: Anchor; candidates: Candidate[]; positionName: (id: number) => string; onpick: (c: Candidate) => void; onclose: () => void`

These are UI files; there are no component tests in this repo (vitest runs in node). The pure logic they show is tested in Task 7. Verification is `npm run check` here, and the browser in Task 13.

- [ ] **Step 1: Create `src/lib/components/routines/types.ts`**

```ts
/**
 * View shapes for the routine editor's components. The page builds them from
 * its data; the components only draw them — so no component has to know about
 * graph ids, seams indexed by server rows, or optimistic overlays.
 */
import type { Side } from '$lib/gestures/swipe';

export interface AltView {
	id: number;
	label: string;
	/** "1→1". Empty for an archived figure. */
	timing: string;
	href: string;
}

export interface RowView {
	/** The slot's id. */
	id: number;
	/** The main figure's label, or the embedded routine's name. */
	title: string;
	/** "1→1 · Closed → Open". Empty when nothing in the slot is danceable. */
	meta: string;
	note: string | null;
	/** Where swiping right or "Open →" goes; null when there is nothing to open. */
	href: string | null;
	isRoutine: boolean;
	/** Every option but the main figure, in the order they were added. */
	alternatives: AltView[];
	canAddAlternative: boolean;
	/** A refusal aimed at this slot. */
	failure: string | null;
	/** What does not connect between this row and the next danceable one; null when it does. */
	seam: { label: string; next: number } | null;
}

/** The one card swiped open on the page, by key: `slot:<id>` or `alt:<stepId>:<figureId>`. */
export type Swiped = { key: string; side: Side } | null;
```

- [ ] **Step 2: Create `src/lib/components/routines/act.ts`**

```ts
/**
 * POST one of the routine page's form actions without a <form>.
 *
 * A drag, a swipe or a picker tap has no form to submit, but the actions are
 * still the one way this app mutates — so this posts to `?/<name>` exactly as
 * `use:enhance` would (the `x-sveltekit-action` header asks for the JSON
 * result), then does what enhance does with it: a success re-runs the load so
 * the server's state replaces the page's optimistic guess, and a failure sets
 * `form` so the message shows under its slot.
 */
import { applyAction, deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';

export type Field = string | number | null | (string | number)[];

export async function act(name: string, fields: Record<string, Field>): Promise<ActionResult> {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) for (const v of value) body.append(key, String(v));
		else body.append(key, value === null ? '' : String(value));
	}
	let result: ActionResult;
	try {
		const res = await fetch(`?/${name}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		result = deserialize(await res.text());
	} catch {
		result = { type: 'failure', status: 0, data: { message: 'Could not reach the server.' } };
	}
	// A success re-runs the load THEN sets `form` to the success — which is what
	// clears an earlier refusal from under its slot, as `enhance`'s `update()`
	// does. A failure only sets `form`: nothing changed, so there is nothing to
	// reload.
	if (result.type === 'success') await invalidateAll();
	await applyAction(result);
	return result;
}
```

- [ ] **Step 3: Create `src/lib/components/routines/UndoToast.svelte`**

```svelte
<script lang="ts">
	/**
	 * "Slot 4 deleted · Undo", for six seconds. Keyed by `toast.id`, so a second
	 * delete with the same wording restarts the clock instead of inheriting the
	 * first one's.
	 */
	interface Props {
		toast: { id: number; message: string } | null;
		onundo: () => void;
		ondismiss: () => void;
	}

	let { toast, onundo, ondismiss }: Props = $props();

	$effect(() => {
		if (toast === null) return;
		// Read the id so the effect re-runs, and the timer restarts, per toast.
		void toast.id;
		const timer = setTimeout(ondismiss, 6000);
		return () => clearTimeout(timer);
	});
</script>

{#if toast}
	<div
		class="fixed inset-x-0 z-40 mx-auto max-w-[560px] px-4"
		style="bottom: calc(5rem + env(safe-area-inset-bottom))"
		role="status"
	>
		<div
			class="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-[14px] text-surface shadow-lg"
		>
			<span class="min-w-0 flex-1 truncate">{toast.message}</span>
			<button type="button" class="h-8 font-semibold text-accent" onclick={onundo}>Undo</button>
		</div>
	</div>
{/if}
```

- [ ] **Step 4: Create `src/lib/components/routines/SlotPicker.svelte`**

```svelte
<script lang="ts">
	/**
	 * The one picker behind every way of adding: a seam's ↓+ / ↑+, the + at
	 * either end, Add above / below, and + Alternative. One tap inserts and
	 * closes — there is no confirm step.
	 */
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import { anchorText, pickList, type Anchor, type Candidate } from '$lib/routines/fit';

	interface Props {
		open: boolean;
		title: string;
		anchor: Anchor;
		candidates: Candidate[];
		positionName: (id: number) => string;
		onpick: (c: Candidate) => void;
		onclose: () => void;
	}

	let { open, title, anchor, candidates, positionName, onpick, onclose }: Props = $props();

	let query = $state('');
	let count = $state(true);
	let hold = $state(true);
	let search: HTMLInputElement | undefined = $state();

	// Every opening starts clean: both filters on, no search left over.
	$effect(() => {
		if (!open) return;
		query = '';
		count = true;
		hold = true;
	});

	// Focus the search only with a mouse: on a phone the keyboard would cover
	// the list, which is what the sheet was opened to see.
	$effect(() => {
		if (search && matchMedia('(pointer: fine)').matches) search.focus();
	});

	const list = $derived(pickList(candidates, anchor, { count, hold, query }));
	const context = $derived(anchorText(anchor, positionName));
	const nothing = $derived(list.figures.length === 0 && list.routines.length === 0);

	const emptyText = $derived.by(() => {
		if (anchor.kind === 'alternative') return 'No other figure starts and lands like this one.';
		if (query.trim() !== '' && list.emptiedBy.length === 0) return 'Nothing by that name.';
		if (context) return `Nothing you know ${context[0].toLowerCase()}${context.slice(1)}.`;
		return 'No figures in this dance yet.';
	});

	function meta(c: Candidate): string {
		const timing = `${c.startCounts.join('/') || '?'}→${c.next ?? '?'}`;
		return c.end === null ? timing : `${timing} · → ${positionName(c.end)}`;
	}

	const chip = (on: boolean) =>
		`h-8 rounded-full border px-3 text-[13px] ${
			on ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-line bg-raised text-muted'
		}`;
	const row =
		'flex w-full items-center justify-between gap-3 border-b border-line py-2.5 text-left text-[15px]';
	const metaClass = 'shrink-0 text-[11.5px] text-muted';
	const heading = 'mt-3 mb-1 text-[11px] font-medium tracking-wide text-muted uppercase';
</script>

<Sheet {title} {open} {onclose}>
	{#if context}
		<p class="-mt-2 mb-3 text-[13px] text-ink-2">{context}</p>
	{/if}
	<input
		bind:this={search}
		bind:value={query}
		type="search"
		placeholder="Search figures and routines"
		aria-label="Search figures and routines"
		class={FIELD}
	/>
	{#if list.toggles.count || list.toggles.hold}
		<div class="mt-2 flex gap-2">
			{#if list.toggles.count}
				<button type="button" class={chip(count)} aria-pressed={count} onclick={() => (count = !count)}
					>{count ? '✓ ' : ''}Count</button
				>
			{/if}
			{#if list.toggles.hold}
				<button type="button" class={chip(hold)} aria-pressed={hold} onclick={() => (hold = !hold)}
					>{hold ? '✓ ' : ''}Hold</button
				>
			{/if}
		</div>
	{/if}

	<div class="mt-1 max-h-[55dvh] overflow-y-auto">
		{#if nothing}
			<p class="mt-3 rounded-lg bg-plane p-3 text-[13px] text-ink-2">
				{emptyText}
				{#if list.emptiedBy.includes('hold')}
					<button type="button" class="font-semibold text-accent" onclick={() => (hold = false)}
						>Turn off Hold</button
					> to see the rest.
				{:else if list.emptiedBy.includes('count')}
					<button type="button" class="font-semibold text-accent" onclick={() => (count = false)}
						>Turn off Count</button
					> to see the rest.
				{/if}
			</p>
		{/if}

		{#if list.figures.length > 0}
			<p class={heading}>Figures</p>
			<ul>
				{#each list.figures as group (group.head.id)}
					<li>
						{#if group.headFits}
							<button type="button" class={row} onclick={() => onpick(group.head)}>
								<span class="min-w-0 truncate">{group.head.label}</span>
								<span class={metaClass}>{meta(group.head)}</span>
							</button>
						{:else}
							<!-- Greyed: a header so its variations still read as a group. -->
							<div class="{row} text-muted">
								<span class="min-w-0 truncate">{group.head.label}</span>
								<span class={metaClass}>{meta(group.head)}</span>
							</div>
						{/if}
						{#each group.variations as v (v.id)}
							<button type="button" class="{row} pl-5 text-[14px]" onclick={() => onpick(v)}>
								<span class="min-w-0 truncate"><span class="text-muted">└ </span>{v.label}</span>
								<span class={metaClass}>{meta(v)}</span>
							</button>
						{/each}
					</li>
				{/each}
			</ul>
		{/if}

		{#if list.routines.length > 0}
			<p class={heading}>Routines</p>
			<ul>
				{#each list.routines as r (r.id)}
					<li>
						<button type="button" class={row} onclick={() => onpick(r)}>
							<span class="min-w-0 truncate">{r.label}</span>
							<span class={metaClass}>{meta(r)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Sheet>
```

- [ ] **Step 5: Verify**

Run: `nix develop -c npm run check`
Expected: PASS. (Nothing imports these yet; svelte-check still type-checks them.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/routines
git commit -m "routine editor: act(), the undo toast, and the fitting picker sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The slot card — swipe, expand, note, alternatives — and the seam

**Files:**
- Create: `src/lib/components/routines/Swipeable.svelte`, `src/lib/components/routines/SlotCard.svelte`, `src/lib/components/routines/Seam.svelte`

**Interfaces:**
- Consumes: `swipe`, `Side` (Task 8); `LongPress` from `$lib/longpress`; `RowView`, `Swiped` (Task 10).
- Produces:
  - `Swipeable.svelte` props: `open: Side; onchange: (open: Side) => void; end?: { label: string; onclick: () => void }; start?: { label: string; onclick: () => void }; disabled?: boolean; rounded?: string; children: Snippet`
  - `SlotCard.svelte` props: `row: RowView; index: number; count: number; expanded: boolean; selecting: boolean; selected: boolean; lifted: boolean; swiped: Swiped; press: LongPress; onswipe: (key: string, side: Side) => void; ontap: () => void; ongrab: (e: PointerEvent) => void; onkeymove: (delta: -1 | 1) => void; ondelete: () => void; onopen: (href: string) => void; onremoveAlt: (figureId: number, label: string) => void; onaddAlt: () => void; onnote: (note: string | null) => void`
  - `Seam.svelte` props: `label: string; above: number; below: number; onafter: () => void; onbefore: () => void` (`above`/`below` are 1-based slot numbers)

- [ ] **Step 1: Create `Swipeable.svelte`**

```svelte
<script lang="ts">
	/**
	 * A card that swipes sideways to reveal a button underneath: `end` (Delete)
	 * on the right, revealed by swiping left; `start` (Open) on the left,
	 * revealed by swiping right. The gesture arithmetic is `$lib/gestures/swipe`;
	 * this only wires pointer events to it and draws the offset.
	 *
	 * `touch-pan-y` hands vertical movement to the browser, so the page still
	 * scrolls from a card; only a horizontal move becomes a swipe.
	 */
	import type { Snippet } from 'svelte';
	import { swipe, type Side } from '$lib/gestures/swipe';

	interface Action {
		label: string;
		onclick: () => void;
	}

	interface Props {
		open: Side;
		onchange: (open: Side) => void;
		end?: Action;
		start?: Action;
		disabled?: boolean;
		rounded?: string;
		children: Snippet;
	}

	let {
		open,
		onchange,
		end,
		start,
		disabled = false,
		rounded = 'rounded-xl',
		children
	}: Props = $props();

	const REVEAL = 84;
	const gesture = swipe({
		reveal: REVEAL,
		lockPx: 10,
		snap: 0.4,
		sides: () => ({ left: end !== undefined, right: start !== undefined })
	});

	/** The live offset while a finger is on it; null at rest. */
	let tracking = $state<number | null>(null);
	const rest = $derived(open === 'left' ? -REVEAL : open === 'right' ? REVEAL : 0);
	const x = $derived(tracking ?? rest);
</script>

<div class="relative overflow-hidden {rounded}">
	{#if end && x < 0}
		<button
			type="button"
			class="absolute inset-y-0 right-0 bg-danger text-[13px] font-semibold text-white"
			style="width: {REVEAL}px"
			onclick={() => {
				onchange(null);
				end.onclick();
			}}>{end.label}</button
		>
	{/if}
	{#if start && x > 0}
		<button
			type="button"
			class="absolute inset-y-0 left-0 bg-accent text-[13px] font-semibold text-accent-ink"
			style="width: {REVEAL}px"
			onclick={() => {
				onchange(null);
				start.onclick();
			}}>{start.label}</button
		>
	{/if}
	<div
		class="relative touch-pan-y {tracking === null
			? 'transition-transform duration-200 motion-reduce:transition-none'
			: ''}"
		style="transform: translateX({x}px)"
		onpointerdown={(e) => {
			if (!disabled && e.button === 0) gesture.down(e.clientX, e.clientY, open);
		}}
		onpointermove={(e) => {
			const offset = gesture.move(e.clientX, e.clientY);
			if (offset === null) return;
			// Capture once it is a swipe, so a mouse dragged off the card keeps it.
			if (tracking === null) e.currentTarget.setPointerCapture(e.pointerId);
			tracking = offset;
		}}
		onpointerup={() => {
			const to = gesture.up();
			tracking = null;
			if (to !== undefined) onchange(to);
		}}
		onpointercancel={() => {
			gesture.up();
			tracking = null;
		}}
		onclickcapture={(e) => {
			// The click a swipe ends with must not also tap the card.
			if (gesture.swallow()) {
				e.stopPropagation();
				e.preventDefault();
			}
		}}
	>
		{@render children()}
	</div>
</div>
```

- [ ] **Step 2: Create `Seam.svelte`**

```svelte
<script lang="ts">
	/**
	 * Between two rows that do not connect — in the hands or on the count — a
	 * red line with the two ways to build: ↓+ down from the slot above, ↑+ up
	 * into the slot below. A seam that connects draws nothing at all, so an
	 * unfinished routine shows exactly where the work is.
	 */
	interface Props {
		label: string;
		/** 1-based numbers of the slots either side, for the buttons' names. */
		above: number;
		below: number;
		onafter: () => void;
		onbefore: () => void;
	}

	let { label, above, below, onafter, onbefore }: Props = $props();

	const button =
		'relative h-8 rounded-full border-[1.5px] border-danger bg-plane px-3 text-[12px] font-semibold text-danger';
</script>

<div class="pt-1.5">
	<div class="relative flex items-center justify-center gap-3">
		<span class="absolute inset-x-2 top-1/2 border-t-2 border-danger/50" aria-hidden="true"></span>
		<button type="button" class={button} onclick={onafter} aria-label="Add after slot {above}"
			>↓+</button
		>
		<button type="button" class={button} onclick={onbefore} aria-label="Add before slot {below}"
			>↑+</button
		>
	</div>
	<p class="mt-1 text-center text-[11px] text-danger">{label}</p>
</div>
```

- [ ] **Step 3: Create `SlotCard.svelte`**

```svelte
<script lang="ts">
	/**
	 * One slot: the handle, the swipe layers, and — tapped open — the note and
	 * the alternatives. The card's TOP ROW is the tap and long-press target;
	 * what an open card shows below it (the note field, the alternative cards)
	 * takes its own taps and must not collapse the card.
	 */
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import Swipeable from './Swipeable.svelte';
	import type { RowView, Swiped } from './types';

	interface Props {
		row: RowView;
		index: number;
		count: number;
		expanded: boolean;
		selecting: boolean;
		selected: boolean;
		lifted: boolean;
		swiped: Swiped;
		press: LongPress;
		onswipe: (key: string, side: Side) => void;
		ontap: () => void;
		ongrab: (e: PointerEvent) => void;
		onkeymove: (delta: -1 | 1) => void;
		ondelete: () => void;
		onopen: (href: string) => void;
		onremoveAlt: (figureId: number, label: string) => void;
		onaddAlt: () => void;
		onnote: (note: string | null) => void;
	}

	let {
		row,
		index,
		count,
		expanded,
		selecting,
		selected,
		lifted,
		swiped,
		press,
		onswipe,
		ontap,
		ongrab,
		onkeymove,
		ondelete,
		onopen,
		onremoveAlt,
		onaddAlt,
		onnote
	}: Props = $props();

	const sideOf = (key: string): Side => (swiped?.key === key ? swiped.side : null);
	const slotKey = $derived(`slot:${row.id}`);
</script>

<Swipeable
	open={sideOf(slotKey)}
	onchange={(side) => onswipe(slotKey, side)}
	disabled={selecting}
	end={{ label: 'Delete', onclick: ondelete }}
	start={row.href ? { label: 'Open', onclick: () => onopen(row.href as string) } : undefined}
>
	<div
		class="rounded-xl border bg-raised transition-[box-shadow,scale] duration-150 motion-reduce:transition-none {selected ||
		expanded
			? 'border-accent'
			: 'border-line'} {lifted ? 'scale-[1.02] shadow-xl' : ''}"
	>
		<div class="flex items-start gap-1 py-2 pr-2">
			{#if selecting}
				<span class="grid size-11 shrink-0 place-items-center" aria-hidden="true">
					<span
						class="grid size-6 place-items-center rounded-full border text-[13px] {selected
							? 'border-accent bg-accent text-accent-ink'
							: 'border-rule'}">{selected ? '✓' : ''}</span
					>
				</span>
			{:else}
				<button
					type="button"
					class="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-[18px] tracking-[-3px] text-rule"
					aria-label="Move slot {index + 1}. Arrow keys move it."
					onpointerdown={(e) => {
						// The handle is for dragging and nothing else: keep the swipe
						// and the long-press on the card from seeing this press.
						e.stopPropagation();
						e.preventDefault();
						ongrab(e);
					}}
					onkeydown={(e) => {
						if (e.key === 'ArrowUp' && index > 0) {
							e.preventDefault();
							onkeymove(-1);
						} else if (e.key === 'ArrowDown' && index < count - 1) {
							e.preventDefault();
							onkeymove(1);
						}
					}}>⋮⋮</button
				>
			{/if}

			<div
				role="button"
				tabindex="0"
				aria-expanded={selecting ? undefined : expanded}
				aria-pressed={selecting ? selected : undefined}
				class="min-w-0 flex-1 cursor-pointer py-1 select-none [-webkit-touch-callout:none]"
				onpointerdown={(e) => press.down(row.id, e.clientX, e.clientY)}
				onpointermove={(e) => press.move(e.clientX, e.clientY)}
				onpointerup={() => press.up()}
				onpointercancel={() => press.up()}
				oncontextmenu={(e) => e.preventDefault()}
				onclick={() => {
					if (press.swallow()) return;
					ontap();
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						ontap();
					}
				}}
			>
				<div class="flex items-center gap-2">
					<span
						class="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent"
						>{index + 1}</span
					>
					<span class="min-w-0 flex-1 truncate text-[15px] font-medium"
						>{#if row.isRoutine}<span class="text-muted">↻ </span>{/if}{row.title}</span
					>
				</div>
				{#if row.meta}
					<p class="mt-0.5 truncate pl-8 text-[12px] text-muted">{row.meta}</p>
				{/if}
				{#if !expanded}
					{#if row.note}
						<p class="mt-0.5 truncate pl-8 text-[12.5px] text-ink-2 italic">{row.note}</p>
					{/if}
					{#if row.alternatives.length > 0}
						<p class="truncate pl-8 text-[12px] text-muted">
							/ {row.alternatives.map((a) => a.label).join(' / ')}
						</p>
					{/if}
				{/if}
			</div>

			{#if expanded && row.href}
				<a href={row.href} class="h-9 shrink-0 px-2 text-[13px] leading-9 font-medium text-accent"
					>Open →</a
				>
			{/if}
		</div>

		{#if expanded}
			<!-- The note lives in the card, where a collapsed card shows it. Saved on
			     blur and Enter; Escape puts back what was there. Pointer events stop
			     here so selecting text never starts a swipe. -->
			<div class="pr-3 pb-3 pl-[3.25rem]" onpointerdown={(e) => e.stopPropagation()}>
				<input
					value={row.note ?? ''}
					maxlength="200"
					placeholder="✎ Add a note…"
					aria-label="Note for slot {index + 1}"
					class="w-full border-0 border-b border-dashed border-rule bg-transparent px-0 py-1 text-[13px] outline-none focus:border-accent"
					onkeydown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
						if (e.key === 'Escape') {
							e.currentTarget.value = row.note ?? '';
							e.currentTarget.blur();
						}
					}}
					onblur={(e) => {
						const v = e.currentTarget.value.trim();
						if (v !== (row.note ?? '')) onnote(v === '' ? null : v);
					}}
				/>
			</div>
		{/if}
	</div>
</Swipeable>

{#if expanded && !row.isRoutine}
	<div class="mt-1.5 ml-7 space-y-1.5 border-l-2 border-accent/25 pl-3">
		{#each row.alternatives as alt (alt.id)}
			{@const key = `alt:${row.id}:${alt.id}`}
			<Swipeable
				rounded="rounded-lg"
				open={sideOf(key)}
				onchange={(side) => onswipe(key, side)}
				end={{ label: 'Remove', onclick: () => onremoveAlt(alt.id, alt.label) }}
				start={{ label: 'Open', onclick: () => onopen(alt.href) }}
			>
				<div
					class="flex items-center justify-between gap-3 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-[14px]"
				>
					<span class="min-w-0 truncate">{alt.label}</span>
					<span class="shrink-0 text-[11.5px] text-muted">{alt.timing}</span>
				</div>
			</Swipeable>
		{/each}
		{#if row.canAddAlternative}
			<button
				type="button"
				class="h-9 w-full rounded-lg border-[1.5px] border-dashed border-accent/40 text-[13px] font-medium text-accent"
				onclick={onaddAlt}>+ Alternative</button
			>
		{/if}
	</div>
{/if}

{#if row.failure}
	<p class="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
		{row.failure}
	</p>
{/if}
```

- [ ] **Step 4: Verify**

Run: `nix develop -c npm run check`
Expected: PASS. If svelte-check flags the `role="button"` div for a11y, the `tabindex`, `onkeydown` and aria attributes above are what it asks for; if it flags the note container's `onpointerdown` on a non-interactive div, add `role="presentation"` to that div.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/routines
git commit -m "routine editor: the swipeable slot card, alternatives, note, and seam

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The list, the selection bar, the page — and retiring the old editor

**Files:**
- Create: `src/lib/components/routines/SlotList.svelte`, `src/lib/components/routines/SelectionBar.svelte`
- Rewrite: `src/routes/[dance]/routines/[id]/+page.svelte`
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (remove old actions and load keys), `src/lib/server/routines.ts` (remove `moveSlot`, `deleteSlot`, `duplicateSlot`), `src/lib/server/routines.spec.ts`, `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `SlotList.svelte` props: `rows: RowView[]; expanded: number | null; selecting: boolean; selected: number[]; swiped: Swiped; flash: number | null; press: LongPress; onswipe: (key: string, side: Side) => void; ontap: (id: number) => void; ondragstart: () => void; ondragend: () => void; onreorder: (id: number, to: number) => void; ondelete: (id: number) => void; onopen: (href: string) => void; onremoveAlt: (id: number, figureId: number, label: string) => void; onaddAlt: (id: number) => void; onnote: (id: number, note: string | null) => void; onadd: (at: number, from: { row: number; side: 'after' | 'before' } | null) => void`
  - `SelectionBar.svelte` props: `count: number; extractBlocked: string | null; onabove: () => void; onbelow: () => void; onduplicate: () => void; onextract: () => void; ondelete: () => void`

- [ ] **Step 1: Create `SlotList.svelte`**

```svelte
<script lang="ts">
	/**
	 * The slots, the seams between them, the + at either end — and the drag.
	 *
	 * A drag starts the moment the handle is pressed. It first lets the page
	 * collapse the open card and hide the seams (both would be wrong mid-drag),
	 * waits for that layout, and corrects for how far the grabbed card moved, so
	 * the card stays under the finger. Then it measures every card ONCE, and on
	 * each move asks `$lib/gestures/drag` where the card would land and how far
	 * each other card slides to make room.
	 */
	import { tick } from 'svelte';
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import { autoScroll, dropIndex, shiftFor } from '$lib/gestures/drag';
	import SlotCard from './SlotCard.svelte';
	import Seam from './Seam.svelte';
	import type { RowView, Swiped } from './types';

	interface Props {
		rows: RowView[];
		expanded: number | null;
		selecting: boolean;
		selected: number[];
		swiped: Swiped;
		flash: number | null;
		press: LongPress;
		onswipe: (key: string, side: Side) => void;
		ontap: (id: number) => void;
		ondragstart: () => void;
		ondragend: () => void;
		onreorder: (id: number, to: number) => void;
		ondelete: (id: number) => void;
		onopen: (href: string) => void;
		onremoveAlt: (id: number, figureId: number, label: string) => void;
		onaddAlt: (id: number) => void;
		onnote: (id: number, note: string | null) => void;
		onadd: (at: number, from: { row: number; side: 'after' | 'before' } | null) => void;
	}

	let {
		rows,
		expanded,
		selecting,
		selected,
		swiped,
		flash,
		press,
		onswipe,
		ontap,
		ondragstart,
		ondragend,
		onreorder,
		ondelete,
		onopen,
		onremoveAlt,
		onaddAlt,
		onnote,
		onadd
	}: Props = $props();

	/** The vertical gap between cards: `space-y-2`. */
	const GAP = 8;
	const items: HTMLElement[] = [];
	let drag = $state<{ id: number; from: number; to: number; dy: number; step: number } | null>(
		null
	);

	async function grab(e: PointerEvent, index: number) {
		const id = rows[index].id;
		const before = items[index].getBoundingClientRect().top;
		ondragstart();
		await tick();
		const box = items[index].getBoundingClientRect();
		const startY = e.clientY + (box.top - before);
		const startScroll = window.scrollY;
		const centers = items.map((el) => {
			const b = el.getBoundingClientRect();
			return b.top + b.height / 2 + window.scrollY;
		});
		// Start offset by however far the layout change moved the card, so it is
		// drawn exactly where the finger picked it up.
		drag = { id, from: index, to: index, dy: before - box.top, step: box.height + GAP };

		let y = e.clientY;
		let frame = 0;
		const update = () => {
			if (!drag) return;
			const dy = y - startY + (window.scrollY - startScroll);
			drag.dy = dy;
			drag.to = dropIndex(centers, centers[index] + dy, index);
		};
		const scroll = () => {
			const v = autoScroll(y, 0, window.innerHeight);
			if (v !== 0) {
				window.scrollBy(0, v);
				update();
			}
			frame = requestAnimationFrame(scroll);
		};
		const onmove = (ev: PointerEvent) => {
			y = ev.clientY;
			update();
		};
		const finish = (commit: boolean) => {
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onmove);
			window.removeEventListener('pointerup', onup);
			window.removeEventListener('pointercancel', oncancel);
			window.removeEventListener('keydown', onkey);
			const done = drag;
			drag = null;
			ondragend();
			if (commit && done && done.to !== done.from) onreorder(done.id, done.to);
		};
		const onup = () => finish(true);
		const oncancel = () => finish(false);
		const onkey = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') finish(false);
		};
		window.addEventListener('pointermove', onmove);
		window.addEventListener('pointerup', onup);
		window.addEventListener('pointercancel', oncancel);
		window.addEventListener('keydown', onkey);
		frame = requestAnimationFrame(scroll);
	}

	function offsetOf(i: number, id: number): number {
		if (!drag) return 0;
		return drag.id === id ? drag.dy : shiftFor(i, drag.from, drag.to, drag.step);
	}

	// A just-inserted slot is scrolled to; the flash itself is CSS.
	$effect(() => {
		if (flash === null) return;
		const i = rows.findIndex((r) => r.id === flash);
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		items[i]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
	});

	const plus =
		'grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-rule text-[20px] text-muted disabled:opacity-30';
</script>

{#if rows.length === 0}
	<button
		type="button"
		class="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-rule text-[14px] text-muted"
		onclick={() => onadd(0, null)}>+ Add a figure — the first slot is where the routine starts</button
	>
{:else}
	<div class="flex justify-center pb-2">
		<button
			type="button"
			class={plus}
			disabled={selecting}
			aria-label="Add before slot 1"
			onclick={() => onadd(0, { row: 0, side: 'before' })}>+</button
		>
	</div>
	<ul class="space-y-2">
		{#each rows as row, i (row.id)}
			{@const lifted = drag?.id === row.id}
			<li
				bind:this={items[i]}
				data-slot={row.id}
				class="rounded-xl {lifted ? 'relative z-10' : ''} {drag && !lifted
					? 'transition-transform duration-150 motion-reduce:transition-none'
					: ''} {flash === row.id ? 'flash' : ''}"
				style="transform: translateY({offsetOf(i, row.id)}px)"
			>
				<SlotCard
					{row}
					index={i}
					count={rows.length}
					expanded={expanded === row.id}
					{selecting}
					selected={selected.includes(row.id)}
					{lifted}
					{swiped}
					{press}
					{onswipe}
					ontap={() => ontap(row.id)}
					ongrab={(e) => grab(e, i)}
					onkeymove={(delta) => onreorder(row.id, i + delta)}
					ondelete={() => ondelete(row.id)}
					{onopen}
					onremoveAlt={(figureId, label) => onremoveAlt(row.id, figureId, label)}
					onaddAlt={() => onaddAlt(row.id)}
					onnote={(note) => onnote(row.id, note)}
				/>
				{#if row.seam && !selecting}
					{@const next = row.seam.next}
					<Seam
						label={row.seam.label}
						above={i + 1}
						below={next + 1}
						onafter={() => onadd(i + 1, { row: i, side: 'after' })}
						onbefore={() => onadd(next, { row: next, side: 'before' })}
					/>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="flex justify-center pt-2">
		<button
			type="button"
			class={plus}
			disabled={selecting}
			aria-label="Add after slot {rows.length}"
			onclick={() => onadd(rows.length, { row: rows.length - 1, side: 'after' })}>+</button
		>
	</div>
{/if}

<style>
	.flash {
		animation: flash 1.2s ease-out;
	}

	@keyframes flash {
		from {
			background: color-mix(in srgb, var(--color-accent) 22%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flash {
			animation: none;
		}
	}
</style>
```

- [ ] **Step 2: Create `SelectionBar.svelte`**

```svelte
<script lang="ts">
	/**
	 * The long-press selection's actions. A greyed action still takes a tap — to
	 * say why it is greyed, which a disabled button could not.
	 */
	interface Props {
		count: number;
		/** Why Make routine cannot run, or null when it can. */
		extractBlocked: string | null;
		onabove: () => void;
		onbelow: () => void;
		onduplicate: () => void;
		onextract: () => void;
		ondelete: () => void;
	}

	let { count, extractBlocked, onabove, onbelow, onduplicate, onextract, ondelete }: Props =
		$props();

	let hint = $state<string | null>(null);
	const oneOnly = $derived(count === 1 ? null : 'Select one slot to add next to it.');

	const run = (why: string | null, action: () => void) => () => {
		hint = why;
		if (why === null) action();
	};
</script>

{#snippet item(label: string, icon: string, why: string | null, action: () => void, danger = false)}
	<button
		type="button"
		aria-disabled={why !== null}
		class="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11.5px] {why
			? 'opacity-40'
			: ''} {danger ? 'text-danger' : 'text-ink'}"
		onclick={run(why, action)}><span class="text-[17px] leading-none">{icon}</span>{label}</button
	>
{/snippet}

<div
	class="fixed inset-x-0 z-30 mx-auto max-w-[560px] border-t border-line bg-surface/95 px-2 py-2 backdrop-blur"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
>
	{#if hint}
		<p class="px-2 pb-1.5 text-[12px] text-ink-2" role="status">{hint}</p>
	{/if}
	<div class="grid grid-cols-5 gap-1">
		{@render item('Above', '↑+', oneOnly, onabove)}
		{@render item('Below', '↓+', oneOnly, onbelow)}
		{@render item('Duplicate', '⧉', null, onduplicate)}
		{@render item('Routine', '↻', extractBlocked, onextract)}
		{@render item('Delete', '🗑', null, ondelete, true)}
	</div>
</div>
```

- [ ] **Step 3: Rewrite `src/routes/[dance]/routines/[id]/+page.svelte`** — replace the whole file:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import SlotList from '$lib/components/routines/SlotList.svelte';
	import SlotPicker from '$lib/components/routines/SlotPicker.svelte';
	import SelectionBar from '$lib/components/routines/SelectionBar.svelte';
	import UndoToast from '$lib/components/routines/UndoToast.svelte';
	import { act, type Field } from '$lib/components/routines/act';
	import type { RowView, Swiped } from '$lib/components/routines/types';
	import {
		anchorAfter,
		anchorAlternative,
		anchorBefore,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { extractBlock, inOrder } from '$lib/routines/selection';
	import type { RowEdges } from '$lib/routines/routines';
	import { moved } from '$lib/gestures/drag';
	import { longPress } from '$lib/longpress';
	import { dateLabel } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let practising = $state(false);
	/** The slot tapped open, by id. One at a time. */
	let expanded = $state<number | null>(null);
	let selecting = $state(false);
	/** Selected slot ids, in tap order. */
	let selected = $state<number[]>([]);
	let swiped = $state<Swiped>(null);
	let dragging = $state(false);
	let flash = $state<number | null>(null);
	let naming = $state(false);
	let picker = $state<{
		title: string;
		anchor: Anchor;
		insertAt: number | null;
		stepId: number | null;
	} | null>(null);
	let toast = $state<{ id: number; message: string; undo: () => void } | null>(null);
	let toastSeq = 0;

	/*
	 * Optimistic overlays, cleared when their action returns — by which time
	 * `act` has re-run the load, so the server's state takes over. While any is
	 * in flight the seams are hidden: they were computed for the order on the
	 * server, not the one on screen.
	 */
	let order = $state<number[] | null>(null);
	let gone = $state<number[]>([]);
	let goneOptions = $state<string[]>([]);
	let pending = $state(0);

	const routine = $derived(data.routine);
	const failure = $derived(form && 'message' in form ? form.message : null);

	/**
	 * The slot a failure was aimed at, when the action named one — printed under
	 * that slot rather than only in the banner, which on a long routine is
	 * off-screen. `typeof` rather than a cast: `'stepId' in form` narrows the
	 * members that do not declare it to `unknown`.
	 */
	const failedSlot = $derived(
		form && 'stepId' in form && typeof form.stepId === 'number' && 'message' in form
			? form.stepId
			: null
	);
	/** The banner keeps what the slots do not: routine-level failures, and a slot id that names no slot here. */
	const bannerFailure = $derived(
		failure !== null && data.slots.some((s) => s.id === failedSlot) ? null : failure
	);

	const positionNames = $derived(new Map(data.positions.map((p) => [p.id, p.name])));
	const posName = (id: number) => positionNames.get(id) ?? 'an untagged position';
	/** Live figures and variations, by id. A slot's figure missing here is archived. */
	const figuresById = $derived(
		new Map(data.candidates.filter((c) => c.kind === 'figure').map((c) => [c.id, c]))
	);

	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/routines/[id]', { dance: data.dance.slug, id: String(id) });

	function optionName(id: number): string {
		const name = data.labels[id] ?? 'a figure';
		return figuresById.has(id) ? name : `${name} (archived)`;
	}

	function timingOf(id: number): string {
		const c = figuresById.get(id);
		return c ? `${c.startCounts.join('/')}→${c.next ?? '?'}` : '';
	}

	function metaOf(e: RowEdges): string {
		if (e.starts.length === 0) return '';
		const timing = `${e.startCounts.join('/')}→${e.next ?? '?'}`;
		const hands = `${e.starts.map(posName).join(' / ')} → ${e.end === null ? '?' : posName(e.end)}`;
		return `${timing} · ${hands}`;
	}

	/** What does not connect below server row `i`, worded; null when it connects. */
	function seamOf(i: number): RowView['seam'] {
		const p = data.positionSeams.find((s) => s.after === i);
		const t = data.timingSeams.find((s) => s.after === i);
		const next = (p ?? t)?.next;
		if (next === undefined) return null;
		const a = data.edges[i];
		const b = data.edges[next];
		const parts: string[] = [];
		if (p && a.end !== null) {
			parts.push(`ends in ${posName(a.end)}, next starts from ${b.starts.map(posName).join(' or ')}`);
		}
		if (t) parts.push(`ready for ${a.next}, next starts on ${b.startCounts.join(' or ')}`);
		return { label: parts.join(' · '), next };
	}

	/** The slots as shown: the server's, with any in-flight reorder or delete applied. */
	const shown = $derived.by(() => {
		const byId = new Map(data.slots.map((slot, i) => [slot.id, { slot, edges: data.edges[i], i }]));
		const ids = (order ?? data.slots.map((s) => s.id)).filter(
			(id) => !gone.includes(id) && byId.has(id)
		);
		return ids.map((id) => byId.get(id)!);
	});
	const stale = $derived(pending > 0 || dragging);

	const rows: RowView[] = $derived(
		shown.map(({ slot, edges, i }) => {
			const isRoutine = slot.childId !== null;
			const main = slot.figureIds[0] as number | undefined;
			return {
				id: slot.id,
				title: isRoutine
					? (slot.childName ?? 'a routine')
					: main === undefined
						? 'Empty — nothing to call here'
						: optionName(main),
				meta: metaOf(edges),
				note: slot.note,
				href: isRoutine ? routineHref(slot.childId as number) : main === undefined ? null : figureHref(main),
				isRoutine,
				alternatives: slot.figureIds
					.slice(1)
					.filter((f) => !goneOptions.includes(`${slot.id}:${f}`))
					.map((f) => ({ id: f, label: optionName(f), timing: timingOf(f), href: figureHref(f) })),
				canAddAlternative: !isRoutine && main !== undefined && figuresById.has(main),
				failure: failedSlot === slot.id ? failure : null,
				seam: stale ? null : seamOf(i)
			};
		})
	);

	const facts = $derived(
		[
			data.starts.length > 0 ? `Starts from ${data.starts.map(posName).join(', ')}` : null,
			data.end === null ? null : `Ends at ${posName(data.end)}`
		].filter((f) => f !== null)
	);
	const danceable = $derived(data.starts.length > 0);

	const practiseHref = $derived(
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}`)
			: resolve(`/${data.dance.slug}/player?routine=${routine.id}&exercise=${data.exerciseId}`)
	);
	const songHref = (songId: number) =>
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}`)
			: resolve(
					`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}&exercise=${data.exerciseId}`
				);

	/* ── Talking to the server ─────────────────────────────────────────── */

	async function send(name: string, fields: Record<string, Field>) {
		pending++;
		try {
			return await act(name, fields);
		} finally {
			pending--;
		}
	}

	function showToast(message: string, undo: () => void) {
		toast = { id: ++toastSeq, message, undo };
	}

	async function reorder(id: number, to: number) {
		const ids = rows.map((r) => r.id);
		const from = ids.indexOf(id);
		if (from < 0 || to < 0 || to >= ids.length || to === from) return;
		order = moved(ids, from, to);
		await send('reorder', { stepId: id, index: to });
		order = null;
	}

	async function remove(ids: number[]) {
		const message =
			ids.length === 1
				? `Slot ${rows.findIndex((r) => r.id === ids[0]) + 1} deleted`
				: `${ids.length} slots deleted`;
		gone = [...gone, ...ids];
		swiped = null;
		if (expanded !== null && ids.includes(expanded)) expanded = null;
		const result = await send('deleteMany', { stepIds: ids });
		gone = gone.filter((id) => !ids.includes(id));
		if (result.type === 'success' && result.data?.snapshot) {
			const snapshot = JSON.stringify(result.data.snapshot);
			showToast(message, () => send('restore', { snapshot }));
		}
	}

	async function removeAlternative(stepId: number, figureId: number, label: string) {
		const key = `${stepId}:${figureId}`;
		goneOptions = [...goneOptions, key];
		swiped = null;
		const result = await send('removeOption', { stepId, figureId });
		goneOptions = goneOptions.filter((k) => k !== key);
		if (result.type === 'success') {
			showToast(`Removed ${label}`, () => send('restoreOption', { stepId, figureId }));
		}
	}

	function openPicker(at: number, from: { row: number; side: 'after' | 'before' } | null) {
		const edges = from === null ? null : shown[from.row]?.edges;
		const anchor: Anchor =
			edges == null
				? { kind: 'none' }
				: from?.side === 'after'
					? anchorAfter(edges)
					: anchorBefore(edges);
		const title =
			from === null
				? 'Add a figure'
				: from.side === 'after'
					? `Add after slot ${from.row + 1}`
					: `Add before slot ${from.row + 1}`;
		picker = { title, anchor, insertAt: at, stepId: null };
	}

	function openAlternative(stepId: number) {
		const slot = data.slots.find((s) => s.id === stepId);
		if (!slot) return;
		const main = figuresById.get(slot.figureIds[0]);
		const anchor = anchorAlternative(main, slot.figureIds);
		if (!main || !anchor) return;
		picker = { title: `Alternative for ${main.label}`, anchor, insertAt: null, stepId };
	}

	async function pick(c: Candidate) {
		const p = picker;
		picker = null;
		if (!p) return;
		if (p.stepId !== null) {
			await send('addOption', { stepId: p.stepId, figureId: c.id });
			return;
		}
		const content = c.kind === 'figure' ? { figureId: c.id } : { childId: c.id };
		const result = await send('insert', { at: p.insertAt ?? rows.length, ...content });
		if (result.type === 'success' && typeof result.data?.stepId === 'number') {
			flash = result.data.stepId;
		}
	}

	$effect(() => {
		if (flash === null) return;
		const timer = setTimeout(() => (flash = null), 1200);
		return () => clearTimeout(timer);
	});

	/* ── Selection ─────────────────────────────────────────────────────── */

	const press = longPress({
		ms: 450,
		tolerancePx: 10,
		enabled: () => !selecting && !dragging,
		onLongPress: (id) => {
			selecting = true;
			selected = [id];
			expanded = null;
			swiped = null;
		}
	});

	function tap(id: number) {
		if (swiped) {
			swiped = null;
			return;
		}
		if (selecting) {
			selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
			if (selected.length === 0) selecting = false;
			return;
		}
		expanded = expanded === id ? null : id;
	}

	function stopSelecting() {
		selecting = false;
		selected = [];
	}

	const extractBlocked = $derived(extractBlock(rows, selected, data.embeddedIn));

	function addAround(side: 'after' | 'before') {
		const i = rows.findIndex((r) => r.id === selected[0]);
		stopSelecting();
		if (i < 0) return;
		openPicker(side === 'after' ? i + 1 : i, { row: i, side });
	}

	async function extract(e: SubmitEvent) {
		e.preventDefault();
		const name = String(new FormData(e.currentTarget as HTMLFormElement).get('name') ?? '');
		const result = await send('extract', { stepIds: inOrder(rows, selected), name });
		if (result.type === 'success') {
			naming = false;
			stopSelecting();
			if (typeof result.data?.stepId === 'number') flash = result.data.stepId;
		}
	}

	const hint = 'rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger';
	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
</script>

<svelte:head><title>{routine.name} · {data.dance.label}</title></svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && selecting && !naming) stopSelecting();
	}}
/>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	{#if selecting}
		<button
			type="button"
			class="grid size-11 place-items-center rounded-full text-[20px] text-ink-2"
			aria-label="Stop selecting"
			onclick={stopSelecting}>×</button
		>
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{selected.length} selected</h1>
	{:else}
		<a
			href={resolve('/[dance]/routines', { dance: data.dance.slug })}
			class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
			aria-label="Back to routines">‹</a
		>
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{routine.name}</h1>
		<!--
			Done SAVES: it submits the edit form (by `form=`, since the header is
			outside it). A refused save keeps you editing with the message showing.
		-->
		{#if editing}
			<button
				type="submit"
				form="edit-form"
				class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent">Done</button
			>
		{:else}
			<button
				type="button"
				class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
				onclick={() => (editing = true)}>Edit</button
			>
		{/if}
	{/if}
</header>

<main class="space-y-6 px-4 pt-4 {selecting ? 'pb-40' : 'pb-4'}">
	{#if bannerFailure}
		<p class={errorBox} role="alert">{bannerFailure}</p>
	{/if}

	{#if editing}
		<form
			id="edit-form"
			method="POST"
			action="?/rename"
			class="space-y-3"
			use:enhance={() =>
				async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') editing = false;
				}}
		>
			<label class="block">
				<span class="mb-1 block text-[13px] text-muted">Name</span>
				<input name="name" required maxlength="200" value={routine.name} class={FIELD} />
			</label>
			<label class="block">
				<span class="mb-1 block text-[13px] text-muted">Notes</span>
				<textarea name="notes" rows="5" maxlength="2000" class={FIELD}
					>{routine.notes ?? ''}</textarea
				>
			</label>
			<button
				type="submit"
				class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				>Save</button
			>
		</form>
		<!-- Not behind `use:enhance`: the action redirects to the copy, and a full
		     navigation is what makes it obvious you are now editing the copy. -->
		<form method="POST" action="?/duplicate">
			<button type="submit" class="h-11 w-full rounded-xl border border-line text-[14px]"
				>Duplicate routine</button
			>
		</form>
		<form
			method="POST"
			action="?/archive"
			onsubmit={(e) => {
				if (!confirm(`Archive “${routine.name}”? Its slots and practice history are kept.`)) {
					e.preventDefault();
				}
			}}
		>
			<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
				>Archive routine</button
			>
		</form>
	{:else}
		<section class="space-y-3">
			{#if routine.notes}
				<p class="text-[15px] whitespace-pre-line">{routine.notes}</p>
			{/if}
			{#if danceable}
				{#if data.songs.length === 0}
					<a
						href={practiseHref}
						class="grid h-12 w-full place-items-center rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Practise</a
					>
				{:else}
					<button
						type="button"
						onclick={() => (practising = true)}
						class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Practise</button
					>
				{/if}
			{/if}
			{#if data.exerciseId !== null}
				<a
					href={resolve('/[dance]/exercises/[id]', {
						dance: data.dance.slug,
						id: String(data.exerciseId)
					})}
					class="text-[14px] font-medium text-accent">Exercise →</a
				>
			{/if}
		</section>
	{/if}

	{#if facts.length > 0 || data.breaks.length > 0 || data.timingBreaks.length > 0 || (!data.loops && data.slots.length > 0)}
		<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
			{#if facts.length > 0}
				<span>{facts.join(' · ')}</span>
			{/if}
			{#if data.breaks.length > 0}
				<span class={hint}>{data.breaks.length} break{data.breaks.length === 1 ? '' : 's'}</span>
			{/if}
			{#if data.timingBreaks.length > 0}
				<span class={hint}
					>{data.timingBreaks.length} timing break{data.timingBreaks.length === 1 ? '' : 's'}</span
				>
			{/if}
			{#if !data.loops && data.slots.length > 0}
				<span class={hint}>does not loop</span>
			{/if}
		</p>
	{/if}

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Slots</h2>
		<SlotList
			{rows}
			{expanded}
			{selecting}
			{selected}
			{swiped}
			{flash}
			{press}
			onswipe={(key, side) => (swiped = side === null ? null : { key, side })}
			ontap={tap}
			ondragstart={() => {
				dragging = true;
				expanded = null;
				swiped = null;
			}}
			ondragend={() => (dragging = false)}
			onreorder={reorder}
			ondelete={(id) => remove([id])}
			onopen={(href) => goto(href)}
			onremoveAlt={removeAlternative}
			onaddAlt={openAlternative}
			onnote={(id, note) => send('note', { stepId: id, note })}
			onadd={openPicker}
		/>
	</section>

	{#if data.taughtIn.length > 0}
		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Taught in</h2>
			<ul class="space-y-1">
				{#each data.taughtIn as lesson (lesson.id)}
					<li>
						<a
							class="text-[15px] text-accent"
							href={resolve('/[dance]/lessons/[id]', {
								dance: data.dance.slug,
								id: String(lesson.id)
							})}>{lesson.title}</a
						>
						<span class="text-[12px] text-muted">· {dateLabel(lesson.lessonDay)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

{#if selecting}
	<SelectionBar
		count={selected.length}
		{extractBlocked}
		onabove={() => addAround('before')}
		onbelow={() => addAround('after')}
		onduplicate={() => {
			const ids = inOrder(rows, selected);
			stopSelecting();
			send('duplicateMany', { stepIds: ids });
		}}
		onextract={() => (naming = true)}
		ondelete={() => {
			const ids = inOrder(rows, selected);
			stopSelecting();
			remove(ids);
		}}
	/>
{/if}

<SlotPicker
	open={picker !== null}
	title={picker?.title ?? ''}
	anchor={picker?.anchor ?? { kind: 'none' }}
	candidates={data.candidates}
	positionName={posName}
	onpick={pick}
	onclose={() => (picker = null)}
/>

<Sheet title="Make a routine" open={naming} onclose={() => (naming = false)}>
	<form class="space-y-3" onsubmit={extract}>
		{#if bannerFailure}
			<p class={errorBox} role="alert">{bannerFailure}</p>
		{/if}
		<label class="block">
			<span class="mb-1 block text-[12px] font-medium text-ink-2">Name</span>
			<input name="name" required maxlength="200" placeholder="Hammerlock combo" class={FIELD} />
		</label>
		<p class="text-[12px] text-muted">
			The {selected.length === 1 ? 'slot moves' : `${selected.length} slots move`} into the new routine,
			and it takes their place here.
		</p>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Make routine</button
		>
	</form>
</Sheet>

<Sheet title="Practise this routine" open={practising} onclose={() => (practising = false)}>
	<div class="space-y-2">
		<a
			href={practiseHref}
			class="grid h-12 w-full place-items-center rounded-xl border border-line text-[15px]"
			>To a count</a
		>
		<p class="pt-2 text-[12px] font-medium tracking-wide text-muted uppercase">Over a song</p>
		{#each data.songs as song (song.id)}
			<a
				href={songHref(song.id)}
				class="grid h-12 w-full place-items-center rounded-xl border border-line px-3 text-[15px]"
				>{song.title}</a
			>
		{/each}
	</div>
</Sheet>

<UndoToast
	toast={toast && { id: toast.id, message: toast.message }}
	onundo={() => {
		const t = toast;
		toast = null;
		t?.undo();
	}}
	ondismiss={() => (toast = null)}
/>
```

- [ ] **Step 4: Retire the old editor on the server**

In `+page.server.ts`:
- Delete the actions `addFigure`, `addChild`, `remove`, `move`, `duplicateSlot`.
- Delete the load keys `figures` (and the `figures` const that builds it), `hasChild`, `slotStarts`, `slotTiming`, `embeddable`. Keep `breaks`, `timingBreaks`, `timingSeams`, `starts`, `end`, `loops`, `labels`, `positions`, `slots`, `songs`, `exerciseId`, `taughtIn`, `routine`, and the Task 9 keys.
- Remove imports that are now unused (`addChildSlot`, `addFigureSlot`, `deleteSlot`, `duplicateSlot`, `moveSlot`, `slotStarts`, `slotTiming`); `svelte-check`/eslint will name any left over.

In `src/lib/server/routines.ts`: delete `deleteSlot`, `moveSlot`, `duplicateSlot`. Then:

Run: `grep -rn "deleteSlot\b\|moveSlot\b\|duplicateSlot\b" src`
Expected: matches only in `src/lib/server/routines.spec.ts` (and none of the `…Slots`/`moveSlotTo` names, which the `\b` excludes).

In `src/lib/server/routines.spec.ts`: delete the `describe('deleteSlot', …)`, `describe('moveSlot', …)` and `describe('duplicateSlot', …)` blocks and their three names from the import list. In Task 1's `describe('the main figure', …)`, change the second test to use `duplicateSlots(db, routine.id, [step])` instead of `duplicateSlot(db, routine.id, step)`.

In `src/routes/[dance]/dance-wall.spec.ts`: delete the two tests that call `routinePage.actions.addFigure` ("will not add a bachata figure to a salsa routine") and `routinePage.actions.remove` ("will not delete a slot belonging to a different salsa routine") — Task 9's `insert` and `deleteMany` tests cover the same walls. Update the comment above the `addOption` test that says "unlike `remove` and `move`" to "unlike `reorder`, `deleteMany`, `duplicateMany` and `extract`".

- [ ] **Step 5: Verify**

Run: `nix develop -c npm run check`
Expected: PASS — prettier, eslint, svelte-check, build, and every vitest spec. Fix formatting with `nix develop -c npx prettier --write <file>` if prettier is what failed.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "routine page: drag, swipe, seams, the picker and selection replace the slot sheets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: See it work, and document it

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-routines-design.md`, `CLAUDE.md`

- [ ] **Step 1: Run the app in this worktree's dev slot**

This worktree is slot 1 (`./scripts/slot.sh status` shows `:5181 nicer-routines`). Start it if it is down: `./scripts/slot.sh status`, then in the slot's tmux session `nix develop -c npm run dev -- --port 5181`. Log in with the dev admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, see `CLAUDE.md`).

Make sure the dev data has what the checks need: at least five salsa figures, one with a variation, one tagged to end in a non-neutral hold (so a seam appears), and two routines. Create them through the UI if `.data` lacks them.

- [ ] **Step 2: Walk the spec in a browser at phone width (390 × 844, touch emulation) and on a mouse**

Each line is a pass/fail check; fix and re-run `npm run check` for any failure:
1. Empty routine: one "+ Add a figure" button; the picker has no context line and no chips.
2. Bottom +: context "Starts on N from <hold>"; Count and Hold on; a tap inserts, the sheet closes, the new slot flashes.
3. Top +: context "Ends on 8 at <hold>".
4. A slot ending in a non-neutral hold followed by one that cannot start there: a red seam with ↓+ and ↑+ and a label; building from ↓+ until it connects makes the seam disappear.
5. A variation that fits under a figure that does not: the figure is greyed, the variation tappable, nested.
6. Search "DOBLE" finds the variation.
7. Drag a slot by ⋮⋮ from first to last and back; the others slide; release saves (reload confirms). Escape mid-drag puts it back. With the handle focused, ↑/↓ move it.
8. Swipe a card left: Delete shows; tap it: the slot goes, "Slot N deleted · Undo" shows; Undo brings it back in place. A vertical scroll that starts on a card never swipes it.
9. Swipe right: Open goes to the figure (or the embedded routine).
10. Tap a card: it expands; type a note, press Enter — collapsed card shows it in italics after reload. Escape while typing restores the old text.
11. + Alternative: the sheet has no chips; only figures starting and landing like the main one are listed; picking one adds an orange card. Swipe it left → Remove → "Removed … · Undo" → Undo.
12. Long-press a card: selection mode, header "1 selected ×". Above/Below open the picker anchored on that slot. Select two adjacent slots → Routine → name it → they become one ↻ slot; its Open goes to the new routine, which has its own exercise. Select non-adjacent slots → Routine says "Select slots next to each other." Duplicate copies after the last selected. Delete removes all with one Undo.
13. With a mouse: drag, swipe by mouse-drag, Open → link, long-press with the mouse button — all work.
14. `prefers-reduced-motion: reduce` (DevTools rendering): no flash or slide animations; everything still works.

- [ ] **Step 3: Update `docs/superpowers/specs/2026-09-24-routines-design.md`**

Under "### The variant algebra", after the first bullet ("All options in a slot **must share one end position**…"), add:

```markdown
- **Adding** an alternative also requires, against the slot's **main figure**
  (its first option added — `created_at`, then `rowid`), the same start count
  and at least one shared start position. An alternative that shares no start
  with the main figure can never be danced where it is. Enforced by
  `addOption` on write; slots that predate the rule are left as they are. See
  the [routine editor design](2026-10-01-routine-editor-design.md).
```

and in the status block at the top, after the 2026-09-29 update paragraph, add:

```markdown
>
> **Updated 2026-10-01** by
> [`2026-10-01-routine-editor-design.md`](2026-10-01-routine-editor-design.md):
> the editor (drag, swipe, seams, the fitting picker, selection, Make routine),
> the main figure, and the start rule for adding an alternative.
```

- [ ] **Step 4: Update `CLAUDE.md`**

In the **Live** paragraph, after "…and a routine made from a selection)", add: "and the routine editor (drag to reorder, swipe to delete or open, seams that build where a routine does not connect, a picker that offers what fits, a long-press selection with Make routine)".

After the Exercise types spec paragraph, add:

```markdown
The routine editor has its own,
[`docs/superpowers/specs/2026-10-01-routine-editor-design.md`](docs/superpowers/specs/2026-10-01-routine-editor-design.md):
the main figure, the start rule for alternatives, the picker's anchors, and the
gestures.
```

In the Layout block, after the `src/lib/exercises/` entry, add:

```
src/lib/gestures/    PURE drag and swipe arithmetic, DOM-free like longpress.ts.
                     Client-safe
```

and change the `src/lib/routines/` entry to end "…coverage (which routines can call each version), the picker's fitting (fit.ts), the selection's rules, and the delete snapshot. Client-safe". Add `routines/` to the `src/lib/components/` list.

- [ ] **Step 5: Final verification**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-24-routines-design.md
git commit -m "docs: the routine editor is live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
