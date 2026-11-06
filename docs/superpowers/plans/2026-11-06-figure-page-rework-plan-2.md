# Figure page rework, plan 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practice, History, Move and Archive leave the figure page's body and band for its ⋯ menu (slot 3's `ItemMenu`), as the spec's plan 2 says.

**Architecture:** The figure page passes `own` items to the `ItemMenu` slot 3 mounted with `own={[]}`. The items are built by one pure function in `src/lib/figures/page.ts` with injected callbacks, like `cloneMenuItems`. Create exercise posts `?/practise` with `act()` and answers with a toast. Nothing on the server changes.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-figure-page-rework-design.md` ("Plans", plan 2). Slot 3's menu: `docs/superpowers/specs/2026-11-06-versions-and-menu-design.md` ("The ⋯ menu").

## Global Constraints

- Do not edit `ItemMenu.svelte`, `MenuSheet.svelte`, `$lib/menu.ts` or `$lib/clones/menu.ts` (slot 3's). Use `MenuItem` and `orderMenu` as they are.
- History moves from the band into the menu on the figure page only (the user approved it in the figure page's mockup; slot 3's spec keeps it in the band elsewhere).
- A reader's pinned Edit / Practise bar (`readerActions`) and the log popup it opens stay exactly as they are.
- Words: "Create exercise" / "Put it on Today on its own"; "Its exercise" / the practice line; "History"; "Move to another move…" / "Or a new move of its own"; "Archive {variation}"; toast "On Today now" with "Open".
- No form field or action changes: no `PAGE_EPOCH` raise.
- `npm run check` must pass at the end.

## Review Focus

1. Create exercise refused by the server (a reader not allowed, already practised): the menu has closed, so the refusal must show as a toast, never nothing. (Task 2; scene in Task 3.)
2. Create exercise succeeds: the page reloads its data, the menu's item becomes "Its exercise", and the toast's Open goes to the new exercise. (Task 2; scene.)
3. A move refused by the server (name clash): today's effect reopens the Move sheet with the message; it must still, now that the sheet is opened from the menu. (Task 2; existing `failed('move')` effect kept.)
4. A reader of a group's figure: no Create exercise, Move or Archive in the menu; Its exercise when they have one; the ⋯ hidden when nothing is in it. (Task 1 tests.)
5. Edit mode: the ⋯ is hidden while editing, as slot 3 left it. (Task 2, unchanged condition.)

---

### Task 1: The figure's own menu items (pure)

**Files:**
- Modify: `src/lib/figures/page.ts`
- Test: `src/lib/figures/page.spec.ts`

**Interfaces:**
- Produces: `figureMenuItems(i: { canEdit: boolean; reader: boolean; practisable: boolean; exercise: { href: string; line: string } | null; historyHref: string | null; variationName: string }, on: { create: () => void; move: () => void; archive: () => void }): MenuItem[]` — in order: Its exercise (`href`, meta = `line`, icon `today`) when `exercise`, else Create exercise (`onclick: on.create`, icon `plus`) when `practisable && !reader`; History (`href`, icon `clock`) when `historyHref`; Move to another move… (`move-to`) and Archive {variationName} (`trash`, `danger: true`) when `canEdit`. Keys: `exercise`, `create`, `history`, `moveFigure`, `archive`.
- [ ] **Step 1: Write failing tests:** an editor with no exercise gets `['create','history','moveFigure','archive']` (history given); with an exercise `['exercise', …]` and the exercise item's `href` and `meta` are the inputs; a reader (`canEdit: false, reader: true`) with no exercise and `practisable: true` gets `[]`; not practisable gets no `create`; Archive's label is `Archive Doble` and it is `danger`; Create's `onclick` calls `on.create`.
- [ ] **Step 2: Run** `npx vitest run src/lib/figures/page.spec.ts` — expect FAIL.
- [ ] **Step 3: Implement** in `page.ts` (import type `MenuItem` from `$lib/menu`).
- [ ] **Step 4: Run** — expect PASS. **Step 5: Commit** `feat(figure): the figure's own ⋯ items`.

### Task 2: The page uses the menu

**Files:**
- Modify: `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`

- [ ] **Step 1:** Pass `own={figureMenuItems(...)}` to `ItemMenu` and to `hasMenu(own, offers)` for the band's ⋯. `exercise.href` is today's exercise link, `line` is `data.practice?.text ?? 'Practice'`; `reader` is `!!data.makeMine`; `on.move` sets `moving = true`; `on.archive` sets `archiving = true`; `on.create` runs `act('practise', {})` and shows a `Toast`: success "On Today now" with "Open" (to the exercise page, from the reloaded `data.exercise`), else `refusalMessage(result, 'Could not add it to Today.')`.
- [ ] **Step 2:** Remove the band's History `BandButton`, the Practice heading and everything under it in `about` (keep `readerActions`, the log popup and `practising` only if still used), and the Move row and Archive button (with its caption) at the end of `aboutEnd`. Keep the Move and Archive sheets and the `failed('move')` effect.
- [ ] **Step 3: Verify** `npm run check` passes. **Commit** `feat(figure): Practice, History, Move and Archive into the ⋯ menu`.

### Task 3: Check it, docs

**Files:**
- Modify: `scripts/shots/ext_figure.py` (scenes `figure-menu`: open the ⋯; `figure-create`: Create exercise, then the toast and the menu showing Its exercise)
- Modify: `docs/superpowers/specs/2026-11-06-figure-page-rework-design.md` (plan 2: built), `docs/superpowers/specs/2026-10-31-redesign-design.md` ("A figure": the pending sentence), `CLAUDE.md` (the `src/lib/figures/` line: `figureMenuItems`)

- [ ] **Step 1:** Run the figure scenes on the scratchpad's `ten.db` copy at 390×844 and the page at 390×2400 light; expected: all ok, the menu in the approved mockup's order (Create exercise, History, then slot 3's copy items, Archive last).
- [ ] **Step 2:** Update the docs; `npm run check`; commit `docs(figure): plan 2 built; scenes for the menu`.

### Task 4: One review of the branch's plan 2 commits, fixes, then ask before merging.
