# Routine editor: a slot lifts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An open slot and a long-press selection lift out of the routine list (T3, S5–S8) while the rest dims, and no change of what is open or selected moves the slot under the finger.

**Architecture:** One pure function decides each row's place in the selection (`selectionShape`); `SlotList` draws a row as a lifted piece (open, alone, or a joined run) from it, and a shared `CardToolbar` draws both toolbars (the open slot's and the selection's, in its run or docked by `SelectionBar`). The page wraps every open/select change in `keepInPlace`, which scrolls by however far the touched card moved.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind v4, vitest; the shots rig (Playwright) for the look and the no-jump checks.

**Spec:** `docs/superpowers/specs/2026-11-11-routine-lift-design.md` (amends `docs/superpowers/specs/2026-10-01-routine-editor-design.md`).

## Global Constraints

- Every word through `t()`, in `en` and `sl` (`no-english.spec.ts`); Slovenian vikanje, en dash in ranges (»Mesti 3–4«).
- Colours from tokens only (`bg-surface`, `text-accent-text`, `border-hairline`, `bg-accent-soft`, `text-danger`, `text-disabled-ink`…), so dark mode and salsa/bachata follow; the shadow is `0 14px 34px rgb(0 0 0 / 0.18)`, the ring `color-mix(in srgb, var(--color-accent) 12%, transparent)`.
- Never append `text-*` to a class builder's output (`class-rules.spec.ts`); shared class strings live in a `.ts` module.
- Touch targets ≥ 44 px; safe area through `--safe-*`, never `env()`.
- No layout property is animated (margins, sizes): only `opacity` and `box-shadow`, 150 ms, `motion-reduce:transition-none`. `keepInPlace` measures right after the change.
- Slot rule from CLAUDE.md: after each task run only its specs (`nix develop -c npx vitest run <files> --maxWorkers=4`), `npx eslint` and `npx prettier --check` on the changed files, then commit. `npm run check` runs before the final review and again after merging master.

## Review Focus

- A long press near the foot of a page that cannot scroll further: `keepInPlace` scrolls as far as it can and never throws (Task 2 spec: element gone / zero distance; Task 7 scene `lift-press-bottom`).
- A seam between two selected neighbours: drawn inside the joined piece, between the two cards, not outside it (Task 7 scene `lift-run-seam`).
- Select slots from ⋯ with nothing selected: the dock shows, every action greyed, a tap says why (Task 1 spec `actionBlocks(0, …)`; Task 7 scene `lift-select-empty`).
- An embedded routine's open slot: toolbar Before / After only (Task 4 spec on `openTools`).
- Dark mode: the lifted shadow and the dimmed rows stay readable (Task 7 shoots every scene with `--theme dark` too).

---

### Task 1: The selection's shape and the toolbar's rules

**Files:**
- Modify: `src/lib/routines/selection.ts`
- Modify: `src/lib/i18n/en/routine.ts`, `src/lib/i18n/sl/routine.ts` (`selection` block)
- Test: `src/lib/routines/selection.spec.ts`

**Interfaces:**
- Produces:
  - `export type Piece = 'single' | 'top' | 'mid' | 'bottom'`
  - `export interface SelectionShape { pieces: (Piece | null)[]; runs: { from: number; to: number }[] }` — `pieces[i]` for row `i`, `runs` in row order, `from`/`to` row indices inclusive.
  - `export function selectionShape(rowIds: number[], selected: number[]): SelectionShape`
  - `actionBlocks(count: number, together: boolean, extractBlocked: string | null): Record<SelectionAction, string | null>` (new middle parameter: the selection is one run).
  - catalog `routine.selection.run: (from: number, to: number) => string` and `routine.selection.tip: string`; `routine.selection.blocked.one` removed.

- [ ] **Step 1: Write the failing tests** in `selection.spec.ts`:

```ts
describe('selectionShape', () => {
	const ids = [10, 11, 12, 13, 14, 15];
	it('nothing selected', () =>
		expect(selectionShape(ids, [])).toEqual({ pieces: [null, null, null, null, null, null], runs: [] }));
	it('one slot', () =>
		expect(selectionShape(ids, [12])).toEqual({
			pieces: [null, null, 'single', null, null, null],
			runs: [{ from: 2, to: 2 }]
		}));
	it('neighbours join, whatever order they were tapped in', () =>
		expect(selectionShape(ids, [14, 12, 13])).toEqual({
			pieces: [null, null, 'top', 'mid', 'bottom', null],
			runs: [{ from: 2, to: 4 }]
		}));
	it('apart stays apart', () =>
		expect(selectionShape(ids, [11, 14])).toEqual({
			pieces: [null, 'single', null, null, 'single', null],
			runs: [{ from: 1, to: 1 }, { from: 4, to: 4 }]
		}));
	it('an id not on screen is ignored', () =>
		expect(selectionShape(ids, [99]).runs).toEqual([]));
});
```

and in the `actionBlocks` describe (replace the cases that expected `blocked.one`):

```ts
const w = () => t().routine.selection.blocked;
it('Before and After work for a run of neighbours', () => {
	const b = actionBlocks(3, true, null);
	expect([b.above, b.below]).toEqual([null, null]);
});
it('apart: Before and After say why', () => {
	const b = actionBlocks(2, false, w().apart);
	expect([b.above, b.below, b.duplicate, b.delete]).toEqual([w().apart, w().apart, null, null]);
});
it('nothing selected: every action says why', () =>
	expect(Object.values(actionBlocks(0, false, w().none)).every((v) => v !== null)).toBe(true));
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/routines/selection.spec.ts --maxWorkers=4`
Expected: FAIL — `selectionShape` is not exported; `actionBlocks` arity.

- [ ] **Step 3: Implement** `selectionShape` and the new `actionBlocks` in `selection.ts`: above/below are `w.first` with nothing selected, `null` when `together`, else `w.apart`. Add to both catalogs, in `selection`: `run` — en `` `Slots ${from}–${to}` ``, sl `` `${to - from === 1 ? 'Mesti' : 'Mesta'} ${from}–${to}` ``; `tip` — en `'Tap other slots to add them.'`, sl `'Tapnite še druga mesta, da jih dodate.'`. Delete `blocked.one` from en and sl. In `+page.svelte`, beside `extractBlocked`, add `const shape = $derived(selectionShape(rows.map((r) => r.id), selected))` and call `actionBlocks(selected.length, shape.runs.length === 1, extractBlocked)`.

- [ ] **Step 4: Run the tests and the catalog guards**

Run: `nix develop -c npx vitest run src/lib/routines/selection.spec.ts src/lib/i18n --maxWorkers=4`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(routines): the selection's shape; Before/After for a run of neighbours`

---

### Task 2: `keepInPlace`

**Files:**
- Create: `src/lib/motion/anchor.ts`
- Test: `src/lib/motion/anchor.spec.ts`

**Interfaces:**
- Produces: `export async function keepInPlace(el: Element | null | undefined, change: () => void): Promise<void>` — reads `el`'s `getBoundingClientRect().top`, runs `change()`, awaits Svelte's `tick()`, and when `el` is still connected and moved by ≥ 1 px calls `window.scrollBy(0, after - before)`. Never throws for a missing or detached element (it still runs `change`).

- [ ] **Step 1: Write the failing tests** (`window.scrollBy` stubbed with `vi.stubGlobal('window', { scrollBy })`; a fake element `{ isConnected, getBoundingClientRect: () => ({ top }) }` whose `top` the `change` callback moves):

```ts
it('scrolls by how far the card moved', async () => {
	const el = fake(100);
	await keepInPlace(el, () => (el.top = 140));
	expect(scrollBy).toHaveBeenCalledWith(0, 40);
});
it('and back up when it moved up', async () => {
	const el = fake(300);
	await keepInPlace(el, () => (el.top = 220));
	expect(scrollBy).toHaveBeenCalledWith(0, -80);
});
it('not for under a pixel', async () => {
	const el = fake(100);
	await keepInPlace(el, () => (el.top = 100.4));
	expect(scrollBy).not.toHaveBeenCalled();
});
it('no card, or one the change removed: the change still runs, nothing scrolls', async () => {
	const change = vi.fn();
	await keepInPlace(null, change);
	const el = fake(100);
	await keepInPlace(el, () => (el.isConnected = false));
	expect(change).toHaveBeenCalled();
	expect(scrollBy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to see them fail** — `nix develop -c npx vitest run src/lib/motion/anchor.spec.ts`; FAIL, no module.
- [ ] **Step 3: Implement** `keepInPlace` (module doc: why — the spec's "Nothing jumps").
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(motion): keepInPlace keeps a card where the finger is across a layout change`

---

### Task 3: `CardToolbar`, and the docked `SelectionBar`

**Files:**
- Create: `src/lib/components/routines/CardToolbar.svelte`
- Create: `src/lib/components/routines/lift.ts` (class strings)
- Modify: `src/lib/components/routines/SelectionBar.svelte`
- Modify: `src/routes/[dance]/(moves)/routines/[id]/+page.svelte` (bottom claim, dock only when docked, toast offset)

**Interfaces:**
- Produces:
  - `lift.ts`: `export const LIFTED` — `relative rounded-[20px] bg-surface` plus the ring as an inset shadow and the shadow on a `before:` pseudo-element at `-z-10` (`before:absolute before:inset-0 before:rounded-[inherit] before:content-['']`), so joined pieces never shade each other (the list `<ul>` gets `isolate`); `export const DIM_OPEN = 'opacity-45'`, `export const DIM_SELECT = 'opacity-60'`, `export const FADE = 'transition-opacity duration-150 motion-reduce:transition-none'`; `export function pieceRound(p: Piece): string` → `'single'` all corners 20 px, `'top'` top corners, `'mid'` none, `'bottom'` bottom corners.
  - `CardToolbar.svelte` props: `items: ToolItem[]`, where `export interface ToolItem { key: string; label: string; icon: IconName; name?: string /* aria-label when the label is short */; why?: string | null; danger?: boolean; onclick: () => void }` (exported from `src/lib/components/routines/types.ts`). A grid of `items.length` equal cells, hairline above and between, 60 px, icon 20 over a 12 px extrabold label; `text-accent-text`, `text-danger` when `danger`, `text-disabled-ink` + `aria-disabled` when `why`. A tap on a `why` cell shows `why` in a line above the cells (the SelectionBar's hint, moved here); the hint clears when `items` change.
  - `SelectionBar.svelte` keeps its props; it is now the docked piece: `fixed` at `bottom: calc(20px + var(--safe-bottom))`, `inset-x-3`, `LIFTED`, desk `left-(--pane-left)` as today, holding a `CardToolbar` built from its props; the dock has no one slot to number, so Before/After keep `t().routine.selection.above` / `.below`. It no longer calls `claimBottom`.

- [ ] **Step 1: Build `CardToolbar` and `lift.ts`**, then move `SelectionBar` onto them.
- [ ] **Step 2: Page:** `claimBottom(() => selecting)` (the tab bar steps aside for the whole selection); render `<SelectionBar>` only when `selecting && shape.runs.length !== 1`; the Undo toast's bottom offset uses `barHeight` only then.
- [ ] **Step 3: Check** — `nix develop -c sh -c "npx svelte-check --threshold error && npx eslint src/lib/components/routines 'src/routes/[dance]/(moves)/routines/[id]/+page.svelte' && npx vitest run src/lib/i18n/no-english.spec.ts src/lib/components/ui/class-rules.spec.ts --maxWorkers=4"`; 0 errors, PASS.
- [ ] **Step 4: Commit** — `feat(routines): CardToolbar; the selection bar docks as a lifted piece`

---

### Task 4: The open slot lifts (T3)

**Files:**
- Modify: `src/lib/components/routines/SlotCard.svelte`, `src/lib/components/routines/SlotList.svelte`
- Create: `src/lib/routines/tools.ts` (which open-slot tools show), test `src/lib/routines/tools.spec.ts`

**Interfaces:**
- Consumes: `LIFTED`, `DIM_OPEN`, `FADE`, `pieceRound` (Task 3), `CardToolbar`/`ToolItem` (Task 3).
- Produces: `export type OpenTool = 'length' | 'alternative' | 'before' | 'after'`; `export function openTools(row: { isRoutine: boolean; length: unknown | null; canAddAlternative: boolean }): OpenTool[]` — in that order, `length` only with `row.length`, `alternative` only with `canAddAlternative`, never either for a routine slot.

- [ ] **Step 1: Failing test** `tools.spec.ts`:

```ts
it('a figure with a set length and room for an alternative', () =>
	expect(openTools({ isRoutine: false, length: { figureId: 1, n: 4 }, canAddAlternative: true }))
		.toEqual(['length', 'alternative', 'before', 'after']));
it('a figure with its own length', () =>
	expect(openTools({ isRoutine: false, length: null, canAddAlternative: true }))
		.toEqual(['alternative', 'before', 'after']));
it('an embedded routine: Before and After only', () =>
	expect(openTools({ isRoutine: true, length: null, canAddAlternative: false }))
		.toEqual(['before', 'after']));
```

- [ ] **Step 2: Run — FAIL**; **Step 3: implement** `openTools`; **run — PASS.**
- [ ] **Step 4: The card.** In `SlotList`, the open row's `<li>` content is wrapped in a piece `div` (`LIFTED` + `pieceRound('single')`, `overflow-clip`), and the `<ul>` gets `isolate`; every other `<li>` gets `DIM_OPEN` + `FADE` while a slot is open (its seam with it). The open row's seam stays outside the piece, under it. `SlotCard` takes `rounded: string` (passed to `Swipeable` and its face; `'rounded-none'` inside a piece, `'rounded-2xl'` otherwise); its number fills (`bg-accent text-on-accent`) when `expanded`; the meta line's length chip shows only when not expanded. Below the note: the alternatives section (label `t().figure.or`, `uppercase`, 12 px extrabold muted; rows `h-11 rounded-xl bg-accent-soft` inside the existing `Swipeable`: the name as `<a href={alt.href} data-focus="alt-{row.id}-{alt.id}">` with its group `Badge`, the length as a text button `t().routine.length.chip(n)` → `onlength(alt.id, n)` when `alt.length !== null`, and × (`close`, `aria-label={t().routine.slot.remove(alt.label)}`) → `onremoveAlt`). Then `CardToolbar` with `openTools(row)` mapped to: length → label `t().routine.length.chip(n)`, icon `clock`, name `t().routine.length.change(n)`; alternative → `t().routine.slot.alternative`, `plus`; before → `t().routine.seam.before(index + 1)`, `arrow-up`, name `t().routine.seam.addBefore(index + 1)`; after → `t().routine.seam.after(index + 1)`, `arrow-down`, name `t().routine.seam.addAfter(index + 1)`. Remove the earlier circle column and the `ml-7` rail.
- [ ] **Step 5: Check** — svelte-check 0 errors; eslint, prettier on the changed files; `npx vitest run src/lib/routines src/lib/i18n/no-english.spec.ts src/lib/components/ui/class-rules.spec.ts src/lib/motion/flip-sites.spec.ts --maxWorkers=4` PASS.
- [ ] **Step 6: Commit** — `feat(routines): an open slot lifts, its alternatives and tools inside (T3)`

---

### Task 5: The selection lifts (S7 → S6 → S8)

**Files:**
- Modify: `src/lib/components/routines/SlotList.svelte`, `src/lib/components/routines/SlotCard.svelte`, `src/routes/[dance]/(moves)/routines/[id]/+page.svelte`

**Interfaces:**
- Consumes: `selectionShape`/`Piece`/`SelectionShape` and `actionBlocks` (Task 1), `LIFTED`/`DIM_SELECT`/`FADE`/`pieceRound`, `CardToolbar`, `SelectionBar` (Task 3).
- Produces: `SlotList` props `shape: SelectionShape` and `tools?: Snippet` (the selection toolbar, drawn at the foot of the only run; the page passes it only when `shape.runs.length === 1`).

- [ ] **Step 1: SlotList.** While selecting, a row with `shape.pieces[i] !== null` wraps its card in a piece `div` (`LIFTED` + `pieceRound(piece)`); a `'mid'`/`'bottom'` row's `<li>` takes `-mt-2` (the list's gap) and its piece a hairline top border; a `'top'` piece opens with the header `t().routine.selection.run(from + 1, to + 1)` (12 px extrabold muted, `px-4 pt-3`). Inside a piece, after the card: the row's seam when the row is not its run's last; then, on the only run's last row, the tip `t().routine.selection.tip` when one slot is selected, and `tools`. The run's last row's seam goes outside, under the piece. Rows with no piece take `DIM_SELECT` + `FADE`.
- [ ] **Step 2: SlotCard while selecting.** The handle column stays 44 px with the `drag` icon muted and inert (no button, `aria-hidden`), replacing today's check circle; the number is a filled accent circle with `check` when selected, else a 2 px dashed `border-accent/40` ring with the number. The card face drops `bg-accent-soft` for selected (the piece shows it).
- [ ] **Step 3: Page.** Pass `shape` and, when `shape.runs.length === 1`, a `tools` snippet: `CardToolbar` with Before (`t().routine.seam.before(from + 1)`), After (`t().routine.seam.after(to + 1)`), Duplicate, Make routine (`t().routine.make.action`), Delete (danger), each `why` from `actionBlocks(selected.length, shape.runs.length === 1, extractBlocked)` and the handlers `SelectionBar` gets today. `addAround(side)` uses the run: `openPicker(side === 'after' ? to + 1 : from, { row: side === 'after' ? to : from, side })`.
- [ ] **Step 4: Check** — svelte-check, eslint, prettier, `npx vitest run src/lib/routines src/lib/i18n/no-english.spec.ts src/lib/components/ui/class-rules.spec.ts --maxWorkers=4` PASS.
- [ ] **Step 5: Commit** — `feat(routines): a selection lifts; neighbours join with their toolbar (S6–S8)`

---

### Task 6: Nothing jumps

**Files:**
- Modify: `src/routes/[dance]/(moves)/routines/[id]/+page.svelte`

**Interfaces:**
- Consumes: `keepInPlace` (Task 2).

- [ ] **Step 1:** A page helper `slotEl(id: number) => document.querySelector(`[data-slot="${id}"]`)` and `let touched = $state<number | null>(null)`. Wrap in `keepInPlace(slotEl(id), …)`: the body of `tap(id)` (open/close and select/deselect) and the long press's `onLongPress(id)`; set `touched = id` in both. `leaveSelecting()` (× and Escape) runs `stopSelecting` through `keepInPlace(touched === null ? null : slotEl(touched), …)`.
- [ ] **Step 2: Check** — svelte-check 0 errors, eslint/prettier on the page.
- [ ] **Step 3: Commit** — `fix(routines): opening or selecting a slot keeps it under the finger`

---

### Task 7: Scenes, the look checked, docs

**Files:**
- Modify: `scripts/shots/seed-class.ts` (a second own routine)
- Create: `scripts/shots/ext_routine_lift.py`
- Modify: `docs/superpowers/specs/2026-10-01-routine-editor-design.md`, `docs/features.md`, `docs/layout.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Seed.** After "Doma", `createRoutineFromFigures(db, wall, { name: 'Dolga', notes: null }, mine6)` with the admin's first six live figures (if six exist), so `{routine}` stays "Doma". Add a placeholder in the ext: `{longroutine}` = the admin's live routine named Dolga.
- [ ] **Step 2: Scenes** in `ext_routine_lift.py`, each on `/salsa/routines/{longroutine}`; every act that changes what is open or selected records the touched card's `bounding_box()['y']` before and after and raises `AssertionError(f'jumped {d}px')` when they differ by more than 1:
  - `lift-open` — tap slot 3; `lift-open-switch` — tap slot 2 then slot 4 (slot 2 closing above; slot 4 must not move);
  - `lift-press` — long press slot 3 (700 ms); `lift-run` — then tap slot 4; `lift-run-seam` — the first slot with a seam under it and the next one (shoots the seam inside the piece; `skip` when the routine has no seam); `lift-apart` — slots 2 and 5 (dock); `lift-select-empty` — ⋯ → Select slots, tap the greyed Before (hint shows);
  - `lift-press-bottom` — scroll to the end, long press the last slot (no exception; the check allows the page's own limit: skip the jump assertion only when `window.scrollY` is at its maximum).
- [ ] **Step 3: Shoot** light and dark, sl: `scripts/shots/shots.sh <seeded db> <out> 390x844 --pages /dev/null --scenes lift-open,lift-open-switch,lift-press,lift-run,lift-run-seam,lift-apart,lift-select-empty,lift-press-bottom --level all --locale sl` and again with `--theme dark`; every line `ok`. Compare with the board (T3, S6, S7, S8) and fix what differs.
- [ ] **Step 4: Docs.** Routine editor spec: "Tapping a card" and "Long-press: select" point to the new spec and lose what it replaces (the rail, the circle column, the bottom bar's five items for one slot); `docs/features.md`: one line under routines; `docs/layout.md`: `lift.ts`, `CardToolbar.svelte`, `tools.ts`, `$lib/motion/anchor.ts`.
- [ ] **Step 5: Full check** — `nix develop -c npm run check` (background; 10–40 min); PASS.
- [ ] **Step 6: Commit** — `test(shots): routine lift scenes with no-jump checks; docs`
