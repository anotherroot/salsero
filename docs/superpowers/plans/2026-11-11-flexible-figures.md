# Flexible figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A figure can start on several counts and can have its length chosen per routine slot; routines resolve each slot's start from the slot before.

**Architecture:** Three additive columns. The pure layer (`src/lib/graph`, `src/lib/routines`) learns a figure's start set and "free length", and a routine _walk_ that resolves each slot's start and next count in context; every timing reader (breaks, seams, loops, row edges, the picker, the player's spacing) goes through the walk. The server stores a length per routine option; the routine page gets a How long? sheet and a length chip; the figure edit form gets count toggles and a You choose toggle.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle + better-sqlite3, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-11-flexible-figures-design.md` (read it first; boards 1 and C at https://claude.ai/artifact/SnZPtZTpEREenzVP3uFwVp).

## Global Constraints

- Additive `ADD COLUMN` only, no CHECK, read the generated SQL (hard rules). Invariants live in the data functions.
- A figure no one changes behaves and reads exactly as today: null columns read as today's single start and fixed length.
- Timing is reported (breaks, `?`), never refused — except the existing alternative-agreement rule in `addOption`, now also in `setOptionLength`.
- The player keeps whole 8-counts (`eightsSpan`); only its spacing reads the slot's length.
- Every word through `t()`, en and sl; `no-english.spec.ts`, `refusals-guard.spec.ts` must pass.
- New routine-page action `length` classified `device` in `src/lib/offline/routes.ts`; group changes logged (`logChange` via `logRoutine`), listed in `MUTATIONS`.
- The How long? sheet offers exactly `[2, 4, 6, 8, 12, 16, 24]` + Other (1–64, `MAX_LENGTH_COUNTS`).
- Slot builds: per task run only its specs (`npx vitest run <files> --maxWorkers=4`) + `npx eslint` / `npx prettier --check` on changed files, then commit. Full `npm run check` before the final review.

## Review Focus

- A routine whose figures are all untouched: every slot meta, seam, break and loop identical to today (pin with a spec comparing walk results to the old per-figure numbers).
- A slot after one with an unknown next (`?`): starts on its usual start, no break reported out of the unknown slot.
- Embedded child routine: resolved from where the parent enters it; its row in the parent shows that resolved start.
- Turning You choose off on a figure used in routines: the stored length is ignored, not deleted; on again restores it.
- Undo paths (delete slots → restore, remove option → restore, duplicate, extract, copy to a group) keep each option's length.

---

### Task 1: Columns

**Files:**

- Modify: `src/lib/server/db/schema.ts` (figures, routineStepOptions)
- Create: `drizzle/0050_*.sql` (generated)

**Interfaces:**

- Produces: `figures.startCounts: integer('start_counts')` (8-bit mask, bit `n-1` = count n; null reads as `{startCount ?? 1}`), `figures.lengthFree: integer('length_free')` (1 = chosen in routines; null/0 = fixed), `routineStepOptions.lengthCounts: integer('length_counts')` (null = the figure's own length). Doc comments in the schema's style.

- [ ] Add the three columns with doc comments.
- [ ] `npm run db:generate`; read the SQL: exactly three `ALTER TABLE … ADD COLUMN`, nothing else.
- [ ] `npx vitest run src/lib/sync/tables.spec.ts src/lib/server/db --maxWorkers=4` — PASS.
- [ ] Commit `feat(figures): columns for start counts, free length, slot length`.

### Task 2: Timing helpers and the graph

**Files:**

- Modify: `src/lib/graph/timing.ts`, `src/lib/graph/graph.ts`, `src/lib/server/graph.ts` (`graphFor` read, ~L170–232)
- Test: `src/lib/graph/timing.spec.ts`, `src/lib/server/graph.spec.ts`

**Interfaces:**

- Produces (timing.ts): `maskOf(counts: number[]): number`, `countsOfMask(mask: number | null, start: number | null): number[]` (sorted; null mask → `[start ?? 1]`; a mask of 0 reads the same as null), `startOn(counts: readonly number[], usual: number, incoming: number | null): number` (incoming when in counts, else usual), `LENGTH_CHOICES = [2, 4, 6, 8, 12, 16, 24] as const`.
- Produces (graph.ts): `GraphFigure.startCounts?: number[]` (absent = `[start]`), `GraphFigure.free?: boolean`; `countsOf(f: GraphFigure): number[]`. `start` stays the usual start (lowest count). `graphFor` fills both from the new columns.

- [ ] Tests: `countsOfMask(null, 5) → [5]`, `countsOfMask(maskOf([5,1]), 1) → [1,5]`, `maskOf([1..8]) === 255`, `startOn([1,5], 1, 5) === 5`, `startOn([1,5], 1, 3) === 1`, `startOn([1], 1, null) === 1`; graphFor on a figure with `start_counts = 0b10001`, `length_free = 1` → `startCounts [1,5]`, `free true`, `start 1`; untouched figure → `countsOf` `[start]`, free falsy.
- [ ] Run — FAIL. Implement. Run — PASS.
- [ ] Commit `feat(graph): a figure's start counts and free length`.

### Task 3: The routine walk

**Files:**

- Modify: `src/lib/routines/routines.ts`, `src/lib/routines/plan.ts`
- Test: `src/lib/routines/routines.spec.ts`, `src/lib/routines/plan.spec.ts`

**Interfaces:**

- Consumes: Task 2.
- Produces:
  - `OptionsSlot.lengths?: Record<number, number>` (figureId → stored length), `OptionsSlot.stepId?: number`. `flatten` carries both through (a child's inner slots keep theirs).
  - `optionLength(g, slot, figureId): number` — stored length when the figure is `free` and one is stored, else `f.length`.
  - `slotNext(g, slot, incoming: number | null): number | null` — every option's `nextCount(startOn(countsOf(f), f.start, incoming), optionLength)`; null when they disagree. `sharedNextCount(g, slot)` stays as `slotNext(g, slot, null)`.
  - `interface Walked { incoming: number | null; start: number | null; next: number | null }` and `walk(g, flat: OptionsSlot[]): Walked[]` — first slot incoming null; each later slot's incoming is the previous `next` (null after an unknown). `start` is the main (first live) option's resolved start.
  - `slotStartCounts` now unions `countsOf(f)` (the set, not the usual start).
  - `RowEdges` gains `start: number | null`; `rowEdgesIn(g, shape): RowEdges[]` — per editor row, from the flat walk (a child row: its first inner slot's start/incoming, its last inner slot's next). `rowEdges(g, slot)` keeps working standalone (incoming null).
  - `timingBreaks`, `timingSeams`, `loops` read the walk (`loops`: last walked `next` ∈ first slot's start counts).
  - `stepIncoming(g, shape, stepId): number | null | undefined` — the incoming count of the flat slot carrying `stepId` (undefined: not found).
  - plan.ts: `eightsOf` takes the option's length: `eightsSpan(optionLength(g, flat[slot], figureId))`.
- [ ] Tests (fixtures: figure A start 1 len 4; B counts [1,5] len 4; C free, start 1, len 8; W counts [1..8] len 4):
  - untouched routine (fixed single-start figures) → `timingBreaks`, `timingSeams`, `loops`, `rowEdgesIn(...).map(e => [e.start, e.next])` equal today's values for the existing routine fixtures.
  - `[A, B]` → B resolves start 5, next 1; no break.
  - `[A, A]` → break at 0 (A cannot start on 5), second A start 1.
  - `[C with lengths {C: 4}, W]` → C next 5, W start 5, next 1.
  - C without a stored length → 8 counts; C stored length but `free` false → own length.
  - alternatives disagreeing after an edit → slot next null, following slot start = its usual start, no break out of it.
  - child row: parent `[A, child[W, B]]` → child row start 5 (from A), next from its last slot.
  - `routinePlan` with C length 12 → C takes 2 eights.
- [ ] Run — FAIL. Implement. Run — PASS (also `page.spec.ts`, `fit.spec.ts` still green).
- [ ] Commit `feat(routines): resolve each slot's start and length along the routine`.

### Task 4: The picker and the sheet's maths

**Files:**

- Modify: `src/lib/routines/fit.ts`, `src/lib/routines/page.ts` (`slotMeta`)
- Test: `src/lib/routines/fit.spec.ts`, `src/lib/routines/page.spec.ts`

**Interfaces:**

- Consumes: Task 3.
- Produces:
  - `Candidate` gains `length?: number`, `free?: boolean` (figures). `startCounts` is the figure's set.
  - `fitsCount`: after → `a.next === null || c.startCounts.includes(a.next)`; before → `a.startCounts.length === 0 || c.free || (c.next !== null && a.startCounts.includes(c.next))`; between → after holds, and the before side is judged with the start fixed to `after.next`: `c.free || a.before.startCounts.includes(nextCount(after.next, c.length))` (routines: `c.next`).
  - Alternative anchor from the row: `anchorAlternative(main: Candidate | undefined, row: RowEdges, exclude: number[])` → `startCount = row.start`, `next = row.next`; `standsIn`: `c.startCounts.includes(a.startCount)` and (`c.free` or `nextCount(a.startCount, c.length) === a.next`), ends/starts as today.
  - `lengthChoices(start: number, want: number | null): { n: number; ok: boolean }[]` over `LENGTH_CHOICES`, `ok` when `want === null || nextCount(start, n) === want`. `fitsLength(start, n, want)` for Other.
  - `preselect(start: number, want: number | null): number | null` — the shortest ok choice when `want` is set, else null.
  - `slotMeta`: core count part is `${e.start}→${e.next ?? '?'}` when `e.start !== null`, else today's `startCounts.join('/')` form.
- [ ] Tests for each rule above, incl. a free candidate fitting `before` whatever its own next, and `lengthChoices(1, 5)` → only 4, 12 ok.
- [ ] Run — FAIL. Implement. Run — PASS. Commit `feat(routines): the picker knows start sets and free lengths`.

### Task 5: Server — routine options carry a length

**Files:**

- Modify: `src/lib/server/routines.ts` (`routineShapes`, `shapesOf`, `routineSlots`, `insertSlot`, `addOption`, `restoreOption`, `deleteSlots`/`restoreSlots` snapshot, `duplicateSlots`, `extractRoutine`, `duplicateRoutine`), `src/lib/server/clones/clone.ts` (~L1180), `src/lib/server/clones/apply.ts` (~L576), `src/lib/types.ts` (`SlotRow`)
- Modify: `src/lib/server/changes.spec.ts` `MUTATIONS` (add `setOptionLength`)
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**

- Consumes: Tasks 1, 3.
- Produces:
  - Shapes: every `OptionsSlot` built here carries `stepId` and `lengths` (only non-null rows).
  - `SlotRow.lengths: Record<number, number>`.
  - `SlotContent = { figureId: number; length?: number } | { childId: number }`; `insertSlot` stores `length` on the option when the figure is free and `isLengthCounts(length)`; a length for a fixed figure is ignored.
  - `addOption(db, stepId, figureId, by?, length?)`: context from `stepIncoming` on the routine's own shape. New option start = `startOn(...)` with that incoming; must equal the main option's resolved start (replaces `main.start !== landing.start`) and meet its holds. Next = with `length` when free, else own; must equal every existing option's resolved next. Ends rule unchanged.
  - `setOptionLength(db, stepId, figureId, length: number, by?): boolean` — false when the option is missing, the figure is not free, the length is out of range, or another option's resolved next would differ. Writes `length_counts`, `logRoutine(... { verb: 'change', subject: 'option', subjectId: stepId })`.
  - `restoreOption(..., length?)`; snapshots and copies (`restoreSlots`, `duplicateSlots`, `extractRoutine`, `duplicateRoutine`, clone `copyTo`, apply/Keep in step) copy `lengthCounts`.
- [ ] Tests: insert free figure with length 4 → shape lengths `{id: 4}`; fixed figure with length → not stored; `addOption` free alternative with a length landing elsewhere → false, with the matching length → true; `addOption` start compared in context (`[A, B-main]` + alternative with counts [5] → true; with counts [1] only → false); `setOptionLength` happy path, fixed figure → false, disagreeing with an alternative → false; group routine: `setOptionLength` writes a change log row; delete+restore slots, duplicate, extract keep the length; clone copy keeps it (clone.spec or routines-copy spec beside the existing ones).
- [ ] Run — FAIL. Implement. Run the touched specs + `changes.spec.ts` — PASS. Commit `feat(routines): a routine option keeps its own length`.

### Task 6: Server — the figure's start set and free length

**Files:**

- Modify: `src/lib/server/graph.ts` (`FigureShape`, `writeFigureShape`, `shapeFields`), `src/routes/[dance]/(moves)/figures/[id]/+page.server.ts` (edit action ~L600–640, load ~L312/466), `src/routes/[dance]/(moves)/figures/+page.server.ts` (new figure shape), `src/lib/server/clones/clone.ts` (~L812), `src/lib/server/clones/apply.ts` (~L296), `src/lib/server/clones/trees.ts` (~L117: the fields compared for Keep in step)
- Test: `src/lib/server/graph.spec.ts`, the figure page's server spec

**Interfaces:**

- Consumes: Tasks 1, 2.
- Produces: `FigureShape.startCounts?: number[]`, `FigureShape.lengthFree?: boolean`. `writeFigureShape`: counts must be non-empty, each `isStartCount`; writes `start_count = min(counts)`, `start_counts = counts.length === 1 && counts[0] === start ? null : maskOf(counts)`, `length_free = lengthFree ? 1 : null`. Absent fields keep the stored values. History (`shapeFields`) carries both, worded through the existing field-change path. Form fields: repeated `startCount` (checkbox values), `lengthFree` = `'1'` when on. Figure load hands the page `startCounts: number[]` and `lengthFree: boolean`.
- [ ] Tests: save counts [1,5] → graph `[1,5]`, start 1; save [3] → mask null, start 3; empty set → refused; lengthFree round-trip; untouched form post (one count, no lengthFree) leaves an existing figure byte-identical; clone copy carries both; Keep in step sees a changed start set as a difference.
- [ ] Run — FAIL. Implement. Run — PASS. Commit `feat(figures): save a start set and You choose length`.

### Task 7: Figure UI

**Files:**

- Modify: `src/lib/components/figures/FigureTiming.svelte`, the figure page's Timing display (where "Starts on 1 · 8 counts" and the 1–8 pills render — `src/routes/[dance]/(moves)/figures/[id]/+page.svelte` / `src/lib/figures/page.ts`), `src/lib/i18n/en/figure.ts`, `src/lib/i18n/sl/figure.ts`
- Test: `src/lib/figures/page.spec.ts`

**Interfaces:**

- Consumes: Task 6.
- Produces: `startsLine(counts: number[]): string` in `src/lib/figures/page.ts` — "Starts on 1", "Starts on 1 or 5", "Starts on 1, 3 or 5", "Starts on any count" (sl: vikanje, » «-free, `slCount` not needed). Props `FigureTiming { startCounts: number[]; lengthCounts: number; lengthFree: boolean }`.
- [ ] Tests for `startsLine` (en + sl via the catalog switch the other specs use).
- [ ] FigureTiming (board 1): legend "Can start on"; eight `<button type="button" aria-pressed>` toggles posting hidden `startCount` inputs for each on; the last one on cannot be turned off; text button All ↔ Only 1; the summary line above. Length: keep the field and shortcuts; add a You choose toggle button (`aria-pressed`, hidden `lengthFree=1` when on) with hint "Set in each routine. Practised alone it runs {n} counts." Numbers stay live with it on.
- [ ] Figure page Timing display: `startsLine` + "· length you choose" when free; the read-only pills light every count in the set.
- [ ] Run page spec + `no-english.spec.ts` — PASS; eslint/prettier on changed files. Screenshot the edit form and page (rig, bachata, figure with counts [1,5]) and compare with board 1.
- [ ] Commit `feat(figures): tap the counts a figure can start on`.

### Task 8: Routine page — How long? sheet and the chip

**Files:**

- Create: `src/lib/components/routines/LengthSheet.svelte`
- Modify: `src/lib/components/routines/SlotCard.svelte`, `src/lib/components/routines/SlotPicker.svelte`, `src/routes/[dance]/(moves)/routines/[id]/+page.svelte`, `src/routes/[dance]/(moves)/routines/[id]/+page.server.ts` (load: `edges: rowEdgesIn(graph, shape)`, candidates with `startCounts: countsOf(node)`, `length`, `free`; actions `insert`/`addOption` read optional `length`; new action `length`), `src/lib/offline/routes.ts` (`length: 'device'`), `src/lib/i18n/en/routine.ts`, `src/lib/i18n/sl/routine.ts`
- Test: `src/routes/[dance]/(moves)/routines/[id]/page.server.spec.ts` (or the existing action spec beside it), `src/lib/offline/routes.spec.ts`

**Interfaces:**

- Consumes: Tasks 3–5.
- Produces: `LengthSheet` props `{ open: boolean; title: string; start: number; want: number | null; current: number | null; onpick: (n: number) => void; onclose: () => void }` — board C: title "How long?", line "{figure}, from {start}", a 4×2 grid of the `LENGTH_CHOICES` (number + "counts" under it, `slCount` in sl) + Other (a numeric field 1–64 and a Done button); a not-ok choice is disabled with one line saying why ("Its alternatives go on to {want}"); `current` shows pressed. One tap calls `onpick`. Built on the shared `Sheet`.
- Flow: picking a free figure in Add a slot / Alternative opens the sheet (start = the anchor's incoming count via the row edges, want = the alternative anchor's next or the below row's start for preselect); `onpick` posts the existing insert/addOption form with `length`. A fixed figure posts at once as today. The chip on SlotCard — `{n} counts ▾` after the meta, shown when the main option is free — opens the sheet with `current`; `onpick` posts `?/length` (`stepId`, `figureId`, `length`, fingerprint like the other slot actions). Open slot: each free alternative row has its own chip.
- [ ] Action tests: `length` saves and refuses (fixed figure → the existing slot refusal shape with a `t()` message); insert with `length`; `routes.spec.ts` green with `length` classified.
- [ ] Implement; check `no-english.spec.ts`, `refusals-guard.spec.ts`, `class-rules.spec.ts`.
- [ ] Screenshots (rig scene on the bachata copy): add a free figure → sheet; slot with chip; chip → sheet with current; compare with board C.
- [ ] Commit `feat(routines): How long? when adding a free figure, a length chip on the slot`.

### Task 9: Read tools and docs

**Files:**

- Modify: `src/lib/server/mcp/read.ts` (figure ~L151: `start_counts`, `length_free`; routine options: `length_counts` when set), its spec; `docs/features.md` (index line + this spec), `docs/layout.md` (`LengthSheet`, `walk`), `docs/superpowers/specs/2026-09-24-routines-design.md` (one line: a slot's start resolves along the routine; see this spec)
- [ ] Test the MCP read output; run — PASS. Commit `feat(mcp): read tools show start counts and slot lengths` + docs.

### Task 10: Whole-branch check and review

- [ ] `npm run check` (full) — PASS.
- [ ] One review of the whole branch (superpowers:requesting-code-review, most capable model), fix what it finds.
- [ ] Merge master in, `npm run check` again, report to the user (no deploy unless asked).
