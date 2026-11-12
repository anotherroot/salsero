# Routine sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sections (unnamed or named, shared), nesting at any depth with a cycle check, the four ways between slots, sections and routines, a calmer editor (J1 selection, D1 duplicate with Undo, panels, a "where am I" bar, spring-open drag), the L4 Routines list, and alternatives removed.

**Architecture:** A section is a `routines` row with `is_section = 1` and no exercise, embedded through today's `routine_steps.child_routine_id`. That keeps walls, groups, sync and clones on the routine path. The pure algebra (`src/lib/routines/`) becomes recursive (`ChildSlot.slots: Slot[]`). The server loads shapes recursively with a visited set. `canEmbed` becomes a cycle check. The editor renders child rows recursively as panels.

**Tech Stack:** SvelteKit, Svelte 5, Drizzle + SQLite, vitest, Playwright shots rig.

**Spec:** `docs/superpowers/specs/2026-11-12-routine-sections-design.md`. The board is https://claude.ai/artifact/A2cJERhq3znfqhXkKNTXYz (v13).

## Global Constraints

- Build natively in this slot. After each task, run only that task's specs (`npx vitest run <files> --maxWorkers=4`), plus `npx eslint` and `npx prettier --check` on the changed files, then commit. The full `npm run check` runs before the final review, and again after merging master in.
- Schema: additive `ADD COLUMN` only, no CHECK. Run `npm run db:generate` and read the SQL. `routines.name` stays NOT NULL, and an unnamed section stores `''`.
- Every insert uses `mintedId`. Server time comes from `serverNow()`. Data functions take `db` first. Specs use `openDb(':memory:')`.
- Every new action is classified in `src/lib/offline/routes.ts` (`ACTIONS`). Writes are `'device'` unless they set cookies.
- Every group mutation calls `logChange` and is listed in `MUTATIONS` (`changes.spec.ts`). Writes go through `scope.ts`, and reads through `access.ts`.
- Words go through `t()` in en and sl. In sl a section is **»sklop«** (add it to the glossary in `src/lib/i18n/sl/index.ts`). No bare English (`no-english.spec.ts`), and every refusal goes through `refusals-guard.spec.ts`.
- Built-control colours come from the builders (`class-rules.spec.ts`). Safe area goes through `--safe-*`. A filled form uses `use:guarded`.
- Raise `PAGE_EPOCH` in `src/lib/epoch.ts` in the commit that changes the routine page's actions.
- The band (back, title, pencil, ⋯) is unchanged.
- Undo appears only after a change: move, delete, add, rename, duplicate, Section, Unpack, Detach. Never after selecting.

## Review Focus

1. **Cycles through sharing:** section A holds B, and someone drops A into B, or picks B's routine inside A. Expect it refused at every entry point (picker, drag, Section, Make routine, Turn into a section). Pinned in Task 3.
2. **Deleting or unpacking the last use of a named section** must archive it, and Undo must bring it back live. Pinned in Task 5.
3. **The same named section twice in one routine:** Detach and Unpack act on one slot only. Pinned in Task 5.
4. **A depth-5 section in the editor** never opens in place, and the drag never springs it open. Pinned in Tasks 8 and 11.
5. **Old data:** the one slot with alternatives keeps its main figure. Routines made with the old Make routine stay routines with their exercises. Pinned in Task 6.

---

### Task 1: `is_section`, no exercise, out of the lists

**Files:**
- Modify: `src/lib/server/db/schema.ts` (routines), `src/lib/server/routines.ts` (`insertRoutine`, `listRoutines`, `listPickRoutines`, `listUsableRoutines`, `listAddedRoutines`), migration from `npm run db:generate`
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces: `routines.isSection: integer('is_section').notNull().default(0)`. `RoutineInput` gains `isSection?: boolean`. `insertRoutine` makes no exercise when `isSection`. Every routine list above excludes sections.

- [ ] Test `insertRoutine with isSection makes no exercise`: the exercise count for it is 0, and `Made.exercise === null`.
- [ ] Test `listRoutines leaves sections out`: one routine plus one section → 1 item.
- [ ] Implement. Run the spec. Check the migration SQL is a single `ALTER TABLE routines ADD is_section`. Commit.

### Task 2: Recursive shapes (pure + loader)

**Files:**
- Modify: `src/lib/routines/routines.ts` (`ChildSlot.slots: Slot[]`, `flatten` recursive; every function that reads `child.slots` goes through `flatten`), `src/lib/server/routines.ts` (`shapesOf`, `routineShapes` recursive, guarded by a `visited` set so a corrupt cycle stops instead of looping)
- Test: `src/lib/routines/routines.spec.ts`, `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces: `ChildSlot { kind:'child'; routineId; slots: Slot[]; note?; stepId?: number }`. `flatten(g, shape)` splices children in at any depth.

- [ ] Test `flatten splices three levels`: R[f1, child S[f2, child T[f3]], f4] → figure ids [1,2,3,4]. Also `routineStarts`/`routineEnds` of R read f1 and f4.
- [ ] Test (server) `routineShapes loads a 3-level nest`, and `a hand-made cycle (A→B→A) loads once and stops`.
- [ ] Implement, fixing every type error `npx svelte-check` shows in `src/lib/routines/*` and the coverage and plan callers. Run the routines, plan, coverage, fit and end specs. Commit.

### Task 3: `canEmbed` is a cycle check

**Files:**
- Modify: `src/lib/server/routines.ts` (`canEmbed`, `embeddable`, new `holds`)
- Test: `src/lib/server/routines.spec.ts` (update the one-level cases: they now expect `true`)

**Interfaces:**
- Produces: `holds(db, outerId: number, innerId: number): boolean`, true when `innerId` sits anywhere inside `outerId`. `canEmbed(db, parentId, childId, usable?)` = same-dance `mayHold` && `parentId !== childId` && `!holds(db, childId, parentId)`. `embeddable(db, routineId, …)` returns routines and **named** sections (`name !== ''`), each `{ id, name, isSection, holders: {id,name}[] }`, where `holders` are the routines that directly hold it.

- [ ] Tests:
  - `embeds two levels deep`: R holds S, and S may hold T.
  - `refuses a cycle through a share`: A holds B, so `canEmbed(B, A)` is false.
  - `refuses itself`.
  - `embeddable leaves out unnamed sections and the routine's ancestors`.
- [ ] Implement. Run the spec. Commit.

### Task 4: Section from a selection; Make routine; Turn into a section

**Files:**
- Modify: `src/lib/server/routines.ts` (`extractRoutine` → `makeSection`, plus `promoteSection`, `demoteImpact`, `demoteRoutine`), `src/routes/[dance]/(moves)/routines/[id]/+page.server.ts` (`extract` now makes a section with no name field; new actions `promote`, `demote`), `src/lib/offline/routes.ts`, `src/lib/server/changes.ts` (`MUTATIONS`)
- Test: `src/lib/server/routines.spec.ts`, `changes.spec.ts`

**Interfaces:**
- Produces:
  - `makeSection(db, routineId, stepIds, by?) → { sectionId, stepId } | null`. A contiguous run only. Embedded slots inside the run are allowed, and so is a routine that is itself embedded. It creates an `isSection`, `name ''` row with no exercise.
  - `promoteSection(db, sectionId, name: string | null, by?) → boolean`. It sets `is_section 0`, takes the given name when the section is unnamed (refused when it's unnamed and no name is given), and makes a fresh exercise (`everyDays 3`).
  - `demoteImpact(db, routineId) → { routines: {id,name}[], lessons: {id,title}[], practised: number, team: string | null }`. `routines` are the real routines that hold it at any depth.
  - `demoteRoutine(db, routineId, by?) → boolean`. Refused when `demoteImpact(...).routines` is empty. It sets `is_section 1`, archives its exercise (`archived_at = serverNow()`, history kept), and removes its `lesson_routines` rows through the existing unlink path (check the hard-delete list in docs/hard-rules.md first).
- [ ] Tests:
  - `makeSection keeps order and allows a run with an embedded slot`
  - `makeSection inside an embedded routine`
  - `promoteSection gives an exercise, and refuses an unnamed one without a name`
  - `demoteRoutine archives the exercise and unlinks lessons`
  - `demoteRoutine refuses a routine used nowhere`
  - `demoteImpact counts routines at any depth`
- [ ] Implement the actions (form fields: `stepIds` for extract; `name` for promote). Classify `promote` and `demote` as `'device'`. Add them to `MUTATIONS`. Run the specs. Commit.

### Task 5: Unpack, Detach here, last-use archive, Undo paths

**Files:**
- Modify: `src/lib/server/routines.ts` (`unpackSlot`, `packSlots`, `detachSection`, `archiveIfUnused`, plus `deleteSlots`, `restoreSlots`, `duplicateSlots`), the routine page actions (`unpack`, `pack`, `detachHere`), `src/lib/offline/routes.ts`, `MUTATIONS`
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces:
  - `unpackSlot(db, routineId, stepId, by?) → { stepIds: number[]; sectionId: number } | null`. It puts the child's slots in place of the slot. An unnamed section's rows MOVE, and the section is then archived. A named section's or routine's slots are COPIED (options, length, end, note and child refs), and the original stays. Then `archiveIfUnused`.
  - `packSlots(db, routineId, stepIds, sectionId, by?) → stepId | null` is Unpack's Undo: it restores the section if archived, moves the given rows back into it (unnamed), or deletes the copies and re-points one slot (named).
  - `detachSection(db, routineId, stepId, by?) → newSectionId | null`. It makes a plain copy (no gene), with the same name and the slots copied with child refs as they are, and points that one slot at the copy.
  - `archiveIfUnused(tx, sectionId, now)` archives a section no live slot holds. It is called from `deleteSlots`, `unpackSlot` and `detachSection`. `restoreSlots` unarchives any section its snapshot points at.
  - Rename the routine page's existing `detach` (clones) nowhere: the new action is `detachHere`.
- [ ] Tests:
  - `unpack an unnamed section moves its rows and archives it`
  - `unpack a named section copies slots and keeps it for its other use`
  - `unpack the last use of a named section archives it, and pack brings it back`
  - `same section twice in one routine: detach acts on one slot`
  - `delete the slot holding a named section's last use archives it; restore unarchives`
  - `duplicateSlots of an unnamed section slot gives an independent copy`: the duplicate's slot points at a NEW unnamed section with copied rows.
- [ ] Implement. Run the specs. Commit.

### Task 5b: Copies at any depth

**Files:**
- Modify: `src/lib/server/routines.ts` (`duplicateRoutine`), `src/lib/server/clones/` (the routine copy: children through the mapper, at any depth; the "drop a child that embeds another" rule goes)
- Test: `src/lib/server/routines.spec.ts`, the clones spec covering routine copies

- [ ] Tests:
  - `duplicateRoutine deep-copies unnamed sections and references named ones and routines`
  - `copying a group routine with a 3-level nest into a person's space copies every level` (one member per place, gene ids as today)
- [ ] Implement. Run the specs. Commit.

### Task 6: Alternatives go

**Files:**
- Create: custom migration `npx drizzle-kit generate --custom` (name `drop-alternatives`). In each slot it deletes the options other than the main one (lowest `created_at`, then `rowid`).
- Modify: delete `addOption`, `removeOption`, `restoreOption` and their actions (`addOption`, `removeOption`, `restoreOption`), plus `ACTIONS` entries, `alternativeAnchor` (page.ts), `anchorAlternative` (fit.ts), the `'alternative'` tool (tools.ts), the alternatives UI in `SlotCard.svelte`, `AltView`, `RowView.alternatives`/`canAddAlternative`, the picker's alternative context, and the i18n keys they used. In the MCP connector (`grep -rn -i "option\|alternative" src/lib/server/mcp src/lib/server/ai-queue`), remove any proposal kind that adds an option, and stop reading an option list as alternatives.
- Test: the existing specs that covered these are deleted with them, plus a migration test in `src/lib/server/routines.spec.ts`.

- [ ] Test `the drop-alternatives SQL keeps the main option`: insert a slot with options created at t1, t2 (and the same t with a higher rowid), run the migration SQL text, and expect only the t1 one left.
- [ ] Implement. Run `npx vitest related` on the changed files and `npx svelte-check`. Commit.

### Task 7: Routines list (L4)

**Files:**
- Modify: `src/lib/server/routines.ts` (`listRoutines` returns `start: string | null`, `end: string | null`, `loops: boolean`, `figures: number`, `eights: number`), `src/lib/components/moves/RoutinesList.svelte`, i18n
- Test: `src/lib/server/routines.spec.ts`, `src/lib/components/moves/list-forms.spec.ts` (if it renders rows)

- [ ] Test `listRoutines counts figures and eights through sections`: R[f(8), S[f(8), f(16)]] gives 3 figures and 4 eights. A routine whose end equals its start gives `loops: true`.
- [ ] Rows:
  - line 2 is `start → end`, with the end in `text-accent-text`, or the start once followed by a done-coloured ↻ when it loops;
  - line 3 is "n figures · n eights" (`t().routine.list.figures(n)`, `eights(n)`, with sl plurals through `slCount`);
  - the break badge stays.
- [ ] Run the specs. Commit.

### Task 8: Editor rows: section cards, panels, depth, "where am I"

**Files:**
- Modify: `src/routes/[dance]/(moves)/routines/[id]/+page.server.ts` (load returns `rows` as a tree: a child row has `children: RowView[]`, `isSection`, `name`, `figures`, `eights`, `depth`), `src/lib/components/routines/types.ts`, `SlotCard.svelte`, `SlotList.svelte`
- Create: `src/lib/components/routines/SectionPanel.svelte` (one open child: its card + a `SlotList` of its children), `src/lib/components/routines/WhereBar.svelte`, `src/lib/routines/panels.ts` (pure: `panelHue(depth, isRoutine)`, `openable(depth)`, `wherePath(...)`)
- Test: `src/lib/routines/panels.spec.ts`

**Interfaces:**
- Produces:
  - `RowView` gains `kind: 'figure' | 'section' | 'routine'`, `name: string | null`, `figures: number`, `eights: number`, `depth: number`, and `children: RowView[] | null`.
  - `panelHue(depth: number, isRoutine: boolean): 'h1' | 'h2' | 'h3' | 'h4' | 'rt'` gives h1–h4 by `depth % 4`, and `rt` for a routine.
  - `openable(depth: number): boolean` is `depth <= 4` (top-level children are depth 1).
  - `wherePath(chain: {name: string; hue: string}[]): { more: number; rows: {name; hue}[] }` keeps the last three.
- [ ] Tests:
  - `panelHue cycles every four and keeps routines grey`
  - `openable stops at 4`
  - `wherePath keeps the deepest three and counts the rest`
- [ ] Card (closed):
  - Before the name, the `brace` icon (add it to `src/lib/icons/icons.ts`: `<path d="M7 4.5c-1.8 0-2.5.8-2.5 2.6v2.6L3 12l1.5 2.3v2.6c0 1.8.7 2.6 2.5 2.6"/><path d="M10 8h10M10 12h10M10 16h10"/>`) for a section, or `route` for a routine. An unnamed section is titled `t().routine.section.unnamed` ("Section"/"Sklop") in muted italics.
  - Lines: `slotMeta` (count · ⇥ end), then "n figures · n eights".
  - A round ▾ button on the right when `openable(depth)`; otherwise ↗ (a link to its page) and the line "Level n: opens on its own page".
- [ ] Panel (open):
  - A rounded panel with a solid tint, `color-mix(in srgb, var(--hue) 9%, var(--ground))`, a 1 px edge at 28 %, and padding 8 px. The margin is −8 px at depth 1 and −5 px inside a panel (net 3 px per level).
  - Its own card comes first with ▴, then its slots, numbered 1…n, with seams as today.
  - Add `--panel-h1..h4`/`--panel-rt` tokens to `layout.css` for both themes (h1 accent, h2 warn, h3 the bachata wine, h4 easy, rt muted).
  - Open state is per page view (a `Set` of `stepId`s), never stored.
- [ ] WhereBar: sticky under the band (`top` at the slim band's height via its CSS var, not the screen edge). It shows when the first card under it is inside a panel. One row per level, with a dot in the level hue, the deepest in the accent with "level n", and "n more above". The words go through `t()`.
- [ ] Run `panels.spec.ts` and `svelte-check`. Shoot `/salsa/routines/{routine}` light and dark on a seeded db with a nest (add one to `scripts/shots/seed-class.ts`: a section inside a section inside "Dolga"). Commit.

### Task 9: Tapping: Open first, Unpack, the lifted panel, T1 line

**Files:**
- Modify: `src/lib/routines/tools.ts` (`OpenTool = 'open' | 'length' | 'end' | 'unpack' | 'before' | 'after'`), `SlotCard.svelte`, `SectionPanel.svelte`, page actions (`unpack`), i18n
- Test: `src/lib/routines/tools.spec.ts`

**Interfaces:**
- Produces: `openTools(row)`. A figure row gets `['open', ...length?, ...end?, 'before', 'after']`. A section or routine gets `['open', 'unpack', 'before', 'after']`.
- [ ] Tests: `figure tools start with open`; `section tools are open, unpack, before, after`.
- [ ] The "Open ›" link leaves the card header. The `open` cell uses a new `arrow-up-right` icon (↗) with the label `t().routine.slot.open` ("Open"/"Odpri").
  - A tapped open panel lifts whole (shadow and ring on the panel), with the toolbar under its card.
  - A slot inside a panel lifts alone, with the line `t().routine.slot.inSection(name, n)`: "In {name} · changes show in {n} routines", the second part only when n > 1.
  - A shared section's card adds "Also in {names} · changes show in both/all".
- [ ] Unpack goes through `unpackSlot` and toasts "Unpacked {name} · Undo" (the Undo posts `pack`).
- [ ] Run the specs. Commit.

### Task 10: Selection J1, Section, Duplicate D1, Undo toasts

**Files:**
- Modify: `SlotList.svelte`, `SelectionBar.svelte`, `src/lib/routines/selection.ts` (`SelectionAction` → `'above' | 'below' | 'duplicate' | 'section' | 'delete'`), `src/lib/components/routines/lift.ts`, page (toasts), i18n, `scripts/shots/ext_routine_lift.py`
- Test: `src/lib/routines/selection.spec.ts`

- [ ] Remove:
  - the "Slots 3–4" header, the "Tap other slots to add them" line, and any toolbar between cards;
  - the inline (in-piece) toolbar — `SelectionBar` is always docked at the foot (the tab bar steps aside, as today).
- [ ] Merge neighbours with no height change:
  - a selected card whose next neighbour is selected squares its bottom corners;
  - its neighbour squares its top corners and paints a `::before` filling the 8 px gap above, plus a hairline;
  - a selected card's number becomes an accent-filled check. `selectionShape` already gives `top/mid/bottom`.
- [ ] Above the bar, a line: "1 selected · tap other slots to add them", or "Slots 3–4 selected", or the greyed reason.
- [ ] Section (replaces Make routine; no name dialog): `makeSection`. The new card glows (`@keyframes` accent wash about 2 s). Toast `t().routine.toast.sectioned(n)`: "Made a section of n slots · Undo". The Undo posts `unpack` for that slot.
- [ ] Duplicate: the copies grow in, glow about 2 s and scroll into view (`scrollIntoView({block:'nearest'})`), and the selection ends. Toast `t().routine.toast.copied(n, after)`: "n slots copied after slot k · Undo". The Undo posts `deleteMany` with the copies' ids (silently, no second toast).
- [ ] Test `actionBlocks: section needs a contiguous run` (renamed from extract).
- [ ] Update `ext_routine_lift.py`: `lift-run` and `lift-run-up` assert no header text and that no card moved more than 1 px. Run the scenes `lift-press,lift-run,lift-run-up,lift-apart,lift-leave` on a seeded db. They must pass.
- [ ] Run the specs. Commit.

### Task 11: Drag into a section (spring-open)

**Files:**
- Modify: `SlotList.svelte` (drag), `src/lib/server/routines.ts` (`moveSlotInto(db, stepId, targetRoutineId, index, by?) → boolean`), the page action `moveInto`, `ACTIONS`, `MUTATIONS`
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces: `moveSlotInto` moves the row to the other routine at `index`, compacting both. It is refused when the moved slot's child would hold the target (`canEmbed(target, child)` false) or the target is the slot's own routine. Then `archiveIfUnused` is not needed (no use is lost).
- [ ] Tests:
  - `moveSlotInto moves a figure slot into a section`
  - `refuses moving a section into itself or its descendant`
  - `moving out of a section to the parent works`
- [ ] Drag UI:
  - Hovering the middle third of a closed, openable child card for 600 ms fills a ring (a conic gradient on its ▾), then opens it and shows the gap inside.
  - Past a panel's top or bottom edge, the gap moves to the parent.
  - A drop inside keeps it open. One that only sprang open closes again on a drop elsewhere.
  - It is refused (depth > 4, or a cycle): the card shakes 300 ms and a line says why (`t().routine.drag.refused…`).
  - A drop into a shared section toasts "Added to {name} · shows in n routines · Undo".
- [ ] Run the specs. Commit.

### Task 12: A section's page, the picker, the demote sheet

**Files:**
- Modify: `src/routes/[dance]/(moves)/routines/[id]/+page.server.ts` and `+page.svelte`:
  - for a section: no Practise card; subtitle "Section · n figures · n eights"; the pill "In n routines: …" with links, shown when n > 1;
  - a `from` query param carries the stepId it was opened from;
  - ⋯: Rename/Name, Make routine (asks for a name when unnamed), Detach here (only with `from` and n > 1), Unpack into {routine} (only with `from`).
  - For a routine: ⋯ adds "Turn into a section" (only when `demoteImpact.routines.length > 0`), opening a sheet that lists `demoteImpact`.
- Modify: `src/lib/components/routines/SlotPicker.svelte` (Routines tab: this routine's named sections first, then each routine followed by the named sections it directly holds, indented, with "Section of {routine}")
- Test: `src/lib/server/routines.spec.ts` (`routinesHolding(db, id)` = real routines at any depth, each once), the page spec if it exists

- [ ] Test `routinesHolding counts a routine once though it holds the section twice and through another section`.
- [ ] Implement. Shoot the section page and the picker. Commit.

### Task 13: Docs, epoch, screenshots, full check

- [ ] Raise `PAGE_EPOCH`, if no earlier task did.
- [ ] Update `docs/features.md` (index the new spec; "sections, nesting"; remove alternatives), `docs/layout.md` (`panels.ts`, `SectionPanel`, `WhereBar`), and the 2026-09-24 and 2026-10-01 specs (one-level → any depth; alternatives gone, pointing at the new spec).
- [ ] Shoot every changed page at 390x844, light and dark, against the board. Fix differences.
- [ ] `npm run check` (memory-bound: `systemd-run --user --scope -q -p MemoryMax=5G`). Fix everything.
- [ ] Whole-branch review by one fresh reviewer.
- [ ] Merge master in, then `npm run check` again.
