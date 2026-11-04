# Positions as their own things — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make positions owned things like figures (per person and group, clones, twins, group mode), optional (no position = fits anywhere, no neutral), with any number of starts and ends per figure, a type, a hold, notes, a picture, links to video sections and points and to lessons, a page, a place in Moves, templates, How positions work, and a map — and move today's shared positions to their owners.

**Architecture:** `positions` becomes a root table (additive migration 0028; three CHECK widenings in a 0025-style rebuild, 0029). The pure graph (`src/lib/graph/`) drops the neutral: an empty start or end list means "anywhere", and every comparison goes through one helper. The server builds the graph with one canonical id per position family, so a person's figures and a group's figures meet on the same hold. Positions join every list of root kinds (access, usable, integrity, clones, twins, trash, History). The phone screens live under `/[dance]/positions`, the third segment of Moves.

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind 4, SQLite with Drizzle, Vitest. Run everything inside `nix develop -c …`.

**Spec:** `docs/superpowers/specs/2026-11-04-positions-design.md`. Boards: the "Positions (new, a proposal)" area of https://claude.ai/artifact/MHiCSgC56gJSrsEsbyXQ4i (build the boards `positions--phone-1` … `phone-5`; the desktop boards only show the same content). Read `CLAUDE.md` first: its hard rules bind every task. The clones spec (`2026-11-03-clones-and-twins-design.md`), the groups spec and the pickers spec (`2026-10-30-unified-pickers-design.md`) describe what this extends.

**Branch:** `positions` (master 04f9077 merged in). Do not merge into master, push or deploy: ask the user.

---

## Rulings made while planning

The spec leaves these open, or the code contradicts it. The executor follows them; the user reviews them with the plan.

1. **The boot move gives every copy of one shared position the same gene** (the spec says "its own gene, no `cloned_from`"). With a gene per copy, a person's routine that mixes their own figures with a group's (tagged with the group's copy of Cerrada) would start showing breaks it never had. One gene per shared position keeps those routines as they are. No `cloned_from`, so no "From …" line. **Confirmed by the user on 2026-11-04.**
2. **"Empty means anywhere", one helper.** `meet(a, b) = a.length === 0 || b.length === 0 || a ∩ b ≠ ∅` in `src/lib/graph/graph.ts` is the only rule for "can these hands meet": after/before in the picker, breaks, seams, loops, the player's choice, the alternatives' start rule, follows/precedes. A slot's starts are `[]` (anywhere) when any of its options has none, else the union.
3. **Alternatives in a slot share the same set of ends**, compared as canonical family ids, sorted. `[]` equals `[]`. Their starts must `meet` the main option's.
4. **Archived positions are invisible but kept.** `buildGraph` reads only live positions, so a figure tagged only with archived ones reads as no position. `writeFigureShape` replaces only the live tags (and usable group tags) and never deletes a tag to an archived position: the edit form cannot show it, so saving must not drop it.
5. **Hold vocabulary:** `hands` 'two' | 'one' | 'none' → "Two hands", "One hand", "No hands"; `crossed` true → "Crossed, right on top" (form label "Right hands on top"); `facing` 'face' | 'side' | 'shadow' | 'back' → "Face to face", "Side by side", "Shadow", "Back to back"; `frame` 'open' | 'closed' → "Open", "Closed". The picker's second line is the chips joined " · " with all but the first lower-cased ("Two hands · face to face"); an empty hold has no second line.
6. **A template's one-line description becomes the new position's notes.** Templates are per salsa type Salsa, Son, Timba (the boards' names for Salsa and Son; Timba and all of bachata are drafts for the user to review) and per bachata type Dominican, Sensual, Traditional.
7. **Lists sort by type (the dance's style order, untyped last), then folded name.** `sort_order` and `slug` become vestigial; new rows get `slug = 'p-' + crypto.randomUUID()`.
8. **"New figure from it"** links to `/[dance]/figures?new=1&start=<positionId>` (an orphan's says "New figure into it", `&end=<positionId>`); the New move sheet carries the hidden tag and `create` writes it through `writeFigureShape`. **"+ Positions"** links to `/[dance]/figures/<id>?edit=1`, which opens the figure page in edit mode.
9. **Creating a position from the figure's picker** posts to a new `POST /api/positions` (JSON: `figureId`, `name`, `styleTag`, hold fields), which creates it in the figure's owner's space after `requireFigureAccess(…, 'edit')`. The picker is inside the figure's guarded form, so a page action would submit the form.
10. **Points link positions only.** A point's Link popup offers positions; a section's offers figures, drills and positions. "Use this moment as a point" is in the full-screen player's Link popup only (it needs a playhead): it saves a point at the playhead and opens the popup on it. Position links count for "via section" on lessons whether the spot is a section or a point.
11. **Unlinking a position from a group's section or point is trashed like a section link**: `team_trash` gets kind `'position-link'` in the 0029 rebuild (no foreign keys in or out of `team_trash`, verified at write time). Hand links on lessons (`lesson_positions`) follow exactly what `lesson_figures` does.
12. **What a member reads of a group's positions** (`Reach.positions`): live positions of the group that a reached figure is tagged with (start or end), that a reached lesson links by hand, or that a spot on a reached lesson's video links. **What a person may use** (`Usable.positions`): that, plus what their own figures, lessons and spots already point at, in groups they are still a member of.
13. **Islands**: positions are joined by figures (each start to each end, undirected); the main part is the connected part with the most figures through it (ties: more positions, then the lowest id). A position with figures outside the main part is an island. Gaps = dead ends + orphans + islands.
14. **The graph is the viewer's.** A position's page, the list's counts and the map read `graphFor(space)` (own figures plus usable group figures for a person; the group's figures in group mode), filtered to the position's family.
15. **A group's figures are tagged only with that group's positions**; a person's figures with their own or usable group positions. `writeFigureShape` refuses anything else (404, as today).
16. **Twins in the graph** (the spec's open question): the answer relayed from the desktop-view session on 2026-11-04 is **yes** — twinned positions (Same as…) count as one in the graph and on the map, shown as one node marked as a twin, as lists mark twins. A deliberate exception to "Twins are views": only the graph (and so fit, breaks, the map) reads twin positions as one; everything else reads rows as they are. **Confirmed by the user on 2026-11-04.** Task 27 builds it after the rest; everything before it compares by family only.

---

## Global Constraints

- Every instant is an integer of epoch ms. Data functions take `db` first. Specs never touch `$DATA_DIR`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does.
- Migrations: 0028 is additive only (`ALTER TABLE … ADD`, `CREATE TABLE/INDEX`, `DROP INDEX positions_dance_slug_idx`). 0029 is the only rebuild and only widens CHECKs on tables with identical columns and no foreign key in or out (`team_changes`, `twins`, `clone_pairs`, `team_trash`). Read the generated SQL before committing; a rebuild of any other table is a stop-and-ask.
- No new dependency. The map's layout is a small pure module.
- **Links stay concrete row ids.** A gene only finds a member (`memberIn`) or a canonical graph id; every re-point is an explicit update in the same transaction.
- A group row only points at rows of its own group; a person's rows point at their own or at group rows they may use. `crossRefs` covers the four new references and is `[]` in every spec that changes tags, links or reach.
- Every group mutation calls `logChange` with a real actor and is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`. A save on a group's position carries `seen` over every field it writes.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`. Screen words come from pure modules with specs (`src/lib/positions/view.ts`, `src/lib/clones/view.ts`, `src/lib/teams/history.ts`).
- Forms someone fills in use `use:guarded`; one-tap forms `use:enhance`; refresh after a sheet closes via `refreshWhenSettled()`; close-then-go via `gotoWhenSettled`.
- Colours on built controls come from the builders (`button`, `iconButton`, `CHIP`, `GROUP`, `swap()`); safe area via `--safe-*`; dates by hand (`format.ts`).
- Raise `PAGE_EPOCH` in Task 19 (the figure form's `endId` becomes `endIds`) and in Task 14 (the old positions page's actions go).
- Words follow the boards, typographic ’. Key strings: "No position", "No position · fits anywhere", "Fits anywhere · the default", "<Type> · this figure’s type", "Not in the list?", "Done · N", "31 of 41 figures have positions.", "Positions are optional: a figure without one fits anywhere in a routine.", "Templates", "How positions work", "Search positions", "Gaps", "dead end", "orphan", "island", "unused", "Figures from here · N", "Figures into here · N", "Video · N", "Lessons · N", "In routines · N", "Link a section or point…", "Link a lesson…", "Link a position…", "New figure from <name>", "Add N positions", "You have it", "Got it", "Archive position".
- `nix develop -c npm run check` passes at the end of every task.

## Review Focus

1. **A person who never adds a position** sees no break, no "?" , no hold chip, no gap and no nag: routine editor seams and badges, the routine picker's hold toggles, the Routines list, the player, the figure page, Coverage. Pinned in Task 4 (pure, a repertoire with no positions) and Task 20 (the routine page's load).
2. **A routine mixing owners**: your figure ending in your Cerrada, then a group's figure starting in the group's Cerrada (same family) — no break; before and after Make it mine on the position; and after the boot move (ruling 1). Pinned in Tasks 5, 6 and 13.
3. **Archived positions**: a figure tagged only with archived positions is "no position" everywhere, and saving its form keeps the archived tags in the database (ruling 4); restoring the position brings the tags back into the graph. Pinned in Task 5.
4. **Tags pointing where they may not**: a group figure tagged with a person's position (refused), a person's figure tagged with a group's position after they leave (Keep copies it; the rescue copies it when an editor archives it), a group position read by a former member (404). Pinned in Tasks 8, 13 and 14 with `crossRefs`.
5. **The boot move**: run twice (no-op), interrupted (one transaction), with an archived shared position, with a figure tagged by a group and by a member, with no admin. Pinned in Task 6.

---

## File structure

**New, pure and client-safe**
- `src/lib/positions/templates.ts` — the template registry.
- `src/lib/positions/hold.ts` — hold enums, chip words, the second line.
- `src/lib/positions/view.ts` — every positions screen's words and rows (list, page, no position, templates, how it works, figure handholds).
- `src/lib/positions/map.ts` — the map's layout (force layout, label pass, tray).

**New, server**
- `src/lib/server/positions.ts` — rewritten: owned positions' data functions.
- `src/lib/server/positions-move.ts` — the one-time boot move.
- `src/lib/server/position-links.ts` — spot and lesson links to positions.

**New routes and components**
- `src/routes/[dance]/positions/+page.{svelte,server.ts}` — rewritten: the list.
- `src/routes/[dance]/positions/[id]/+page.{svelte,server.ts}` — a position's page.
- `src/routes/[dance]/positions/none/+page.{svelte,server.ts}` — No position.
- `src/routes/[dance]/positions/map/+page.{svelte,server.ts}` — the map.
- `src/routes/api/positions/+server.ts` — create from the figure picker.
- `src/lib/components/positions/` — `PositionFields.svelte`, `PositionSheet.svelte` (new/edit), `TemplatesSheet.svelte`, `HowSheet.svelte`, `PositionRow.svelte`, `PointStill.svelte`, `PointCard.svelte`, `PositionMap.svelte`.
- `src/lib/components/picker/PickerMultiField.svelte` — a field picker that takes any number.
- `src/lib/components/figures/PositionTags.svelte` — Starts in / Ends in (replaces `StartPositions.svelte`).

**Modified (main ones):** `schema.ts`, `types.ts`, `dances.ts`, `graph/graph.ts`, `routines/{routines,fit,plan,coverage,page}.ts`, `server/{graph,routines,figures,access,usable,integrity,scope,clash,changes,trash,twins,spot-links,lesson-links,lessons,link-popup,team-purge}.ts`, `server/clones/*`, `clones/{flat,view,twins}.ts`, `teams/{history,deleted}.ts`, `moves/{segment,figures}.ts`, `nav/{tabs,trail,pending}.ts`, `components/moves/MovesScreen.svelte`, `components/shell/PageSkeleton.svelte`, the figure, figures, lesson, routine and player routes, `LinkPopup.svelte`, `VideoPlayer.svelte`, `db/bootstrap.ts`.

## Shared types (Task 2 adds them to `src/lib/types.ts`; later tasks use them verbatim)

```ts
export type Hands = 'two' | 'one' | 'none';
export type Facing = 'face' | 'side' | 'shadow' | 'back';
export type Frame = 'open' | 'closed';
export interface Hold { hands: Hands | null; crossed: boolean | null; facing: Facing | null; frame: Frame | null }

/** A position as lists, pickers and pages see it. */
export interface PositionSummary {
	id: number;
	name: string;
	styleTag: string | null;
	hold: Hold;
	teamId: number | null; // null: the viewer's own (or the group's own in group mode)
	archived: boolean;
}

/** One row of the Positions list. */
export interface PositionListRow extends PositionSummary {
	inCount: number; outCount: number;
	deadEnd: boolean; orphan: boolean; island: boolean; unused: boolean;
	from: string | null; // a group's: the lesson it came from ("from Week 6")
	twins: boolean;
}

export interface PositionInput {
	name: string; styleTag: string | null; hold: Hold; notes: string | null; pictureSpotId: number | null;
}
```

`ChangeRootKind`, `CloneKind`, `TwinKind`, `DeletedKind`, `ReadKind` each gain `'position'`; `TrashKind` gains `'position-link'`.

---

# Phase A — The model (no screen changes yet, except Timba)

### Task 1: Timba, the hold, and the templates

**Files:**
- Modify: `src/lib/dances/dances.ts` (salsa `styles: ['salsa', 'son', 'timba', 'other']`, `styleLabel.timba = 'Timba'`; remove `seedPositions` from `Dance` and both entries)
- Create: `src/lib/positions/hold.ts`, `src/lib/positions/templates.ts`
- Test: `src/lib/positions/hold.spec.ts`, `src/lib/positions/templates.spec.ts`, `src/lib/dances/dances.spec.ts`

**Interfaces:**
- Produces: `HANDS`, `FACING`, `FRAME` (readonly arrays), `holdChips(h: Hold): string[]`, `holdLine(h: Hold): string | null`, `parseHold(form: FormData): Hold` (fields `hands`, `crossed` = '1', `facing`, `frame`; unknown values → null), `EMPTY_HOLD`.
- Produces: `interface Template { name: string; description: string; hold: Hold }`, `TEMPLATES: Record<DanceSlug, Record<string /*style*/, Template[]>>`, `templateTypes(dance): string[]` (salsa: salsa, son, timba; bachata: dominican, sensual, traditional).

- [ ] **Step 1: Tests.** `holdChips({hands:'two',crossed:true,facing:'face',frame:'open'})` → `['Two hands','Crossed, right on top','Face to face','Open']`; `holdLine` of it → `'Two hands · crossed, right on top · face to face · open'`; `holdLine(EMPTY_HOLD)` → `null`. `isStyleOf('salsa','timba')` true; `isStyleOf('bachata','timba')` false. Templates: salsa/salsa names are exactly `Abierta (dos manos)`, `Abierta (una mano)`, `Cerrada`, `Hammerlock`, `Cuddle`, `Sombra`, with descriptions "Open, both hands", "Open, his left in her right", "Closed, the basic frame", "Her right arm folded behind her back", "Side by side, her wrapped in his arms", "Shadow: he is behind her, same direction"; salsa/son names `Cerrada de son` ("Closed and low, close together"), `Abierta` ("Open, one hand, loose"), `Manos cruzadas` ("Both hands crossed, right on top"), `Paseo` ("Side by side, walking"). Every template's name is unique folded within its type, and every type in `templateTypes` has at least three.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/positions src/lib/dances` — FAIL.
- [ ] **Step 3: Implement.** Timba draft (marked `// draft: the user reviews`): Pegao ("Closed, hip to hip"), Caída ("One hand, her weight dropped back"), Sombra de timba ("Shadow, close, hips moving"), Abierta de timba ("Open, one hand, low"). Bachata drafts per type (Closed, Open two hands, Open one hand, Cross-hand, Hammerlock, Shadow, Side by side spread over the three, with the hold filled). Grep for `seedPositions` and every reader of `DANCES[*].styles` that hard-codes three salsa styles (filter chips, Settings' "New figures" sheet); Timba appears there with no other change.
- [ ] **Step 4: Run** the tests — PASS. `npm run check` (the old `seedPositions` caller in `server/positions.ts` is deleted in Task 7; stub it to a no-op now if needed and say so in the commit). Commit `feat(positions): Timba, the hold and the templates`.

### Task 2: Migration 0028 and the shared types

**Files:**
- Modify: `src/lib/server/db/schema.ts`, `src/lib/types.ts`
- Create: `drizzle/0028_*.sql` (generated)
- Test: `src/lib/server/db/migrate.spec.ts`

**Interfaces:**
- Produces on `positions`: `userId text`, `teamId integer`, `geneId text`, `clonedFrom integer`, `styleTag text`, `hands text`, `crossed integer(boolean)`, `facing text`, `frame text`, `notes text`, `pictureSpotId integer` (no FK: a spot is hard-deleted, and Task 9 clears the column on delete), indexes `positions_user_idx (user_id, dance)`, `positions_team_idx (team_id, dance)`, unique `positions_gene_user_idx`/`positions_gene_team_idx` where gene not null. `positions_dance_slug_idx` dropped.
- Produces tables: `figure_end_positions (figure_id → figures, position_id → positions, created_at; PK both; index position_id)`, `spot_position_links (id pk, spot_id → video_spots notNull, position_id → positions notNull, created_at; unique (spot_id, position_id); index position_id)`, `lesson_positions (lesson_id → lessons, position_id → positions, created_at; PK both; index position_id)`.
- Produces the types in "Shared types" above; `PositionRow = typeof positions.$inferSelect`.

- [ ] **Step 1: Test** in `migrate.spec.ts`: after migrating, a position row can be inserted with `user_id` and the new columns; two positions of one dance may share a slug; `figure_end_positions`, `spot_position_links`, `lesson_positions` exist; deleting a spot that has a `spot_position_links` row fails on the foreign key.
- [ ] **Step 2: Edit `schema.ts`.** Comments: `neutral`, `slug`, `sort_order` and `figures.end_position_id` are VESTIGIAL (read by nothing after Task 6, not dropped: a rebuild is impossible for the reasons on `figures.style`). Rewrite the table comment: positions are owned like figures; no CHECKs ever (incoming foreign keys).
- [ ] **Step 3: Generate** `nix develop -c npm run db:generate`; read the SQL: only `ALTER TABLE positions ADD`, `CREATE TABLE`, `CREATE INDEX`, `DROP INDEX positions_dance_slug_idx`. Anything else: stop and fix the schema.
- [ ] **Step 4: Run** the spec — PASS; `npm run check`. Commit `feat(positions): owned positions, many ends, links (migration 0028)`.

### Task 3: Migration 0029 — the four CHECKs that learn new kinds

**Files:**
- Modify: `schema.ts` (`team_changes_root_kind_ck` + 'position'; `twins_kind_ck` + 'position'; `clone_pairs_kind_ck` + 'position'; `team_trash` kind CHECK + 'position-link'), `src/lib/types.ts` (the five unions), `CLAUDE.md` (the CHECK rule's exception paragraph names 0029 beside 0025)
- Create: `drizzle/0029_*.sql`
- Test: `src/lib/server/db/migrate.spec.ts`

- [ ] **Step 1: Verify before writing:** `grep -n "references" src/lib/server/db/schema.ts` shows no reference into or out of the four tables, and their columns are unchanged by this task. If either is false: stop and ask the user.
- [ ] **Step 2: Test:** a `team_changes` row with `root_kind 'position'`, a `twins` row with `kind 'position'`, a `clone_pairs` row with `kind 'position'`, a `team_trash` row with `kind 'position-link'` insert; rows written before the migration survive it (insert one of each in a pre-0029 database built by migrating to 0028 only, if the spec helper allows; else assert counts survive on the full run).
- [ ] **Step 3: Generate**, read the SQL: four rebuilds under `PRAGMA foreign_keys=OFF`, each `INSERT INTO __new_x SELECT <same columns> FROM x`, then the indexes recreated. Nothing else.
- [ ] **Step 4: Run** — PASS; `npm run check`. Commit `feat(positions): History, twins, pairs and trash know positions (migration 0029)`.

### Task 4: The pure graph without a neutral

**Files:**
- Modify: `src/lib/graph/graph.ts`, `src/lib/routines/routines.ts`, `src/lib/routines/fit.ts`, `src/lib/routines/plan.ts`, `src/lib/routines/coverage.ts`, `src/lib/routines/page.ts`
- Test: `graph.spec.ts`, `routines.spec.ts`, `fit.spec.ts`, `plan.spec.ts`, `coverage.spec.ts`, `page.spec.ts` beside them

**Interfaces:**
- Produces in `graph.ts`:
  ```ts
  export interface GraphFigure { id: number; starts: number[]; ends: number[]; start: number; length: number }
  export interface GraphPosition { id: number; name: string; styleTag: string | null }
  export interface Graph { figures: GraphFigure[]; positions: GraphPosition[] }
  export function meet(a: readonly number[], b: readonly number[]): boolean
  export function fitsAfter(a: GraphFigure, b: GraphFigure): boolean // meet(a.ends, b.starts)
  export function sameSet(a: readonly number[], b: readonly number[]): boolean
  // kept, new meaning: figuresFrom/figuresTo (tagged only), follows/precedes (via fitsAfter), figureById, nextCountOf
  export interface PositionCount { id; inCount; outCount; deadEnd; orphan; island; unused }
  export function positionCounts(g: Graph, positionIds: number[]): PositionCount[]
  export function noPosition(g: Graph): { none: number[]; onlyStart: number[]; onlyEnd: number[] }
  export function taggedCount(g: Graph): { done: number; total: number }
  ```
  `startsOf`, `endOf` and `Graph.neutral` are deleted.
- Produces in `routines.ts`: `slotStarts(g, slot): number[]` (`[]` when any option has none), `slotEnds(g, slot): number[] | null` (null when options disagree; replaces `sharedEnd`), `RowEdges.ends: number[] | null` (replaces `end`), `routineEnds(g, shape)` (replaces `routineEnd`), `breaks`, `positionSeams`, `loops` via `meet`; `through(g, shape, positionId): [number, number][]` (seams where hands pass through it: slot i's ends include it and slot i+1's starts include it).
- Produces in `fit.ts`: `Candidate.ends: number[]`, anchors `after {ends, next}`, `before {starts, startCounts}`, `alternative {starts, startCount, ends, next, exclude}`; `fitsHold` and `standsIn` via `meet`/`sameSet`; `toggles` shows the hold toggle only when the anchor has a position on its side; `anchorAlternative` no longer returns null for an untagged main.
- Produces in `plan.ts`: `choose` keeps options whose starts `meet` the last figure's ends.
- Produces in `page.ts`: `factsOf(starts: string[], ends: string[])` — no fact line for an empty side; `slotMeta` shows nothing for an empty end (never '?'); `seamLabel(hands: {ends: string[]; next: string[]} | null, count)` → "Ends in A or B, next starts from …".

- [ ] **Step 1: Rewrite the specs first.** Delete the neutral tests named in the graph map (graph.spec 'untagged figures read as neutral', routines.spec 'resolves an untagged option to the neutral position', 'counts an untagged option as ending at neutral…', 'is true for one untagged figure…', plan/coverage/fit fixtures with `neutral`). New tests, each its own `it`:
  - `meet([], [3])`, `meet([3], [])`, `meet([1,2],[2])` true; `meet([1],[2])` false.
  - A repertoire with no positions at all: `breaks` is `[]`, `positionSeams` is `[]`, `loops` true for any shape whose counts loop, every `pickList` anchor keeps every candidate, `follows(g, id)` is every figure.
  - A figure ending in [A, B]: a figure starting in [B] follows it; one starting in [C] does not; one with no starts does.
  - `slotEnds` of options [A,B] and [B,A] is [A,B]; of [A] and [] is null; `slotStarts` of [A] and [] is [].
  - `positionCounts`: dead end, orphan, unused as before; island: two linked parts, the smaller part's positions are islands, the larger's are not; one part only: no islands.
  - `noPosition` splits none / only a start / only an end; `taggedCount` counts a figure with either side.
  - `through` finds slots 2 → 3 for a shape whose slot 2 ends in P and slot 3 starts in P.
  - plan.spec: from ends [A, B], an option starting in [B] is chosen; an option with no starts is always eligible.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/graph src/lib/routines` — FAIL.
- [ ] **Step 3: Implement.** Rewrite the file headers: "An untagged side fits anything" replaces the neutral hub paragraph.
- [ ] **Step 4: Run** — PASS. `npm run check` will fail in server and route code until Task 5; commit both together if needed (`git commit` after Task 5 Step 5), else commit `refactor(graph): no neutral, many ends`.

### Task 5: The server graph, figure tags, slots

**Files:**
- Modify: `src/lib/server/graph.ts`, `src/lib/server/routines.ts` (`landingIn`, `addOption`), `src/lib/server/figures.ts` (`createVariationFrom` copies `figure_end_positions`), `src/lib/server/clash.ts` (`variationSeen`: `endIds` joined, replaces `endId`), `src/lib/clash/clash.ts` (`endIds: 'Ends in'`; keep `endId` label for old rows), `src/lib/teams/history.ts` (`endIds: 'end positions'`, keep `endId`), every route that read `neutral`, `startsOf`, `endOf` (figure page load, routine page load, routines list, player) — compile-level changes only; their screens change in Tasks 19–20
- Test: `src/lib/server/graph.spec.ts`, `src/lib/server/routines.spec.ts`, `src/lib/server/variations.spec.ts`, the route specs listed by `grep -rln "neutral\|endId\|endPositionId" src --include=*.spec.ts`

**Interfaces:**
- Produces: `buildGraph(db, space, extra?: { figures?: Set<number>; positions?: Set<number> }): Graph` — figures as today; starts from `figure_start_positions`, ends from `figure_end_positions`, each mapped to a canonical id; tags to archived positions and to positions outside `ownedOrUsable(positions, space, extra.positions)` dropped. Canonical id of a position: the space's own member of its family when there is one, else the lowest id of the family among the graph's positions; a position with no gene is its own family. `Graph.positions` is one entry per canonical id, named from that row. `graphFor(db, space, usable?)` passes `usable.figures` and `usable.positions`.
- Produces: `canonicalOf(g: Graph & { canon: Map<number, number> }, positionId): number` — `buildGraph`'s return type carries `canon: Map<number, number>` (real id → canonical id) for pages that start from a real id.
- Produces: `FigureShape { startIds: number[]; endIds: number[]; startCount; lengthCounts }`; `figurePositions(db, figureId): { startIds: number[]; endIds: number[] }` (live and archived, sorted); `writeFigureShape(tx, figureId, shape)` validates each wanted id: live, same dance, and `inSpace(position, figureSpace)` or (figure is a person's and `usableBy(tx, wall, 'positions', position)`); deletes and reinserts only the tags to such positions, leaving tags to archived positions alone (ruling 4). `shapeFields` emits `startIds`, `endIds`. `taggedFigures(db, space)` reads both tables.
- Produces: `addOption` refuses unless `sameSet(ends)` and `next` match and `meet(main.starts, option.starts)` (ruling 3). `landingIn` returns `{ starts, start, ends, next }`.
- Consumes: `usableBy`/`Usable.positions` from Task 8 — until then `usableBy(…, 'positions', …)` does not exist: implement `writeFigureShape` with own-space only here and widen it in Task 8 (its spec there).

- [ ] **Step 1: Tests (server/graph.spec.ts):** an untagged figure has `starts: []`, `ends: []` (replaces 'uses the dance neutral…'); a figure with two end rows has two ends; a person's figure ending in their Cerrada (gene g) and a group figure they may use starting in the group's Cerrada (gene g) — `follows` includes the group figure; with different genes it does not; an archived position's tag is dropped from the graph; `setFigureShape` with `endIds: [a, b]` stores two rows; saving with only live ids keeps an archived tag row; a position of another person is refused; a group figure tagged with a person's position is refused. routines.spec: 'refuses a figure that ends somewhere else' now uses sets ([A,B] vs [A]); an option with ends [B,A] beside main [A,B] is accepted; two untagged options are accepted.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `figure_end_positions` replaces every read of `figures.end_position_id` (grep: zero readers of `endPositionId` left outside `schema.ts`, the boot move and the migration spec). The figure form's action keeps working on `endId` until Task 19: map a single `endId` to `endIds: [endId]` there for now.
- [ ] **Step 4: Run** the specs, then `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat(graph): any number of ends, compared by family`.

### Task 6: Moving today's positions to their owners (the boot move)

**Files:**
- Create: `src/lib/server/positions-move.ts`
- Modify: `src/lib/server/db/bootstrap.ts` (call it after `seedAdmin`, in place of `seedPositions`, logging `[positions] moved: N copies, M figures, K ends`)
- Test: `src/lib/server/positions-move.spec.ts`

**Interfaces:**
- Produces: `movePositionsToOwners(db: Db, now: number): { ran: boolean; copies: number; figures: number; ends: number }`. Marker `app_flags.key = 'positions-owned'`.

- [ ] **Step 1: Tests.** Fixture: two shared salsa positions (one archived), a bachata one; the admin with a figure starting in P1, ending in P2; user u2 with a figure starting in P1; group T1 with a figure ending in P1; an untagged figure.
  - After the move: P1, P2 (and the archived one) have `user_id` = admin and a gene each; the admin's figure still points at them, now with an `figure_end_positions` row for P2.
  - u2 has one live copy of P1 (same name, dance, gene as P1, `cloned_from` null), and u2's figure's start points at it; T1 has its own copy, its figure's end row points at it; u2 has no copy of P2.
  - The untagged figure has no rows in either table.
  - `ownerIntegrity`, `familyIntegrity`, `crossRefs` are `[]` (after Task 8 these include positions; write the asserts now, they hold).
  - A second call returns `ran: false` and changes nothing. With no users at all, it returns `ran: false` and writes no marker.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** in one transaction: owner = the earliest-created admin (`users.isAdmin`), else the earliest user. Every position with `user_id` and `team_id` null becomes the owner's, with a fresh gene. For each (owner place, shared position) used by that place's figures through either table (or `figures.end_position_id`), insert a copy (name, dance, gene, `style_tag` null, `slug 'p-'+uuid`, `archived_at` copied) and repoint that place's figures' tags. Then copy every `figures.end_position_id` into `figure_end_positions` (already repointed). Write the marker.
- [ ] **Step 4: Run** — PASS; `npm run check`. Commit `feat(positions): today's shared positions move to their owners at boot`.

### Task 7: Positions' own data functions

**Files:**
- Rewrite: `src/lib/server/positions.ts`
- Modify: `src/lib/server/clash.ts` (`positionSeen`), `src/lib/server/changes.spec.ts` (`MUTATIONS`), `src/lib/server/scope.ts` (delete `requirePositionInDance`; `danceOf` stays if used elsewhere)
- Test: `src/lib/server/positions.spec.ts` (rewritten)

**Interfaces:**
- Produces:
  ```ts
  listPositions(db, space: Space, opts?: { archived?: boolean }): PositionRow[]          // the space's own, ordered (ruling 7)
  getPosition(db, id): PositionRow | null
  nameTaken(db, space: Space, name: string, exceptId?: number): boolean                 // live, folded
  createPosition(db, space: Space, input: PositionInput, now: number): PositionRow | { field: 'name'; message: string }
  updatePosition(db, id: number, input: PositionInput, by?: { actorId: string; now: number }): PositionRow | { field: 'name'; message: string } | null
  archivePosition(db, id, now, by?): boolean
  restorePosition(db, id, now, by?): boolean            // false when gone, live, or the name is taken
  addTemplates(db, space: Space, dance: DanceSlug, type: string, names: string[], now): PositionRow[] // skips names taken (folded)
  positionSummary(row: PositionRow, viewerSpace: Space): PositionSummary
  ```
  Name refusal message: "You already have a position called <name>." (group: "<Group> already has a position called <name>."). Empty name: "Give it a name." `styleTag` must be one of the dance's styles or null; `pictureSpotId` must be a point linked to this position or null (else ignored → null).
- Produces: `positionSeen(db, id): Record<string,string> | null` over `name, styleTag, hands, crossed, facing, frame, notes, pictureSpotId`.
- Group mutations log `logChange(tx, space, { rootKind: 'position', rootId: id, verb, subject: 'position', … })`: create → 'add', update → 'change' (before/after per field), archive → 'archive', restore → 'restore'.

- [ ] **Step 1: Tests:** create in a wall and in a team space (owner columns set, exactly one); a folded duplicate name is refused, an archived one is not; update clears an invalid picture spot; archive then restore; restore refused when the name was taken meanwhile; `addTemplates` adds only names not taken and gives each the type and the description as notes; `listPositions` ordering. `MUTATIONS` gains `createPosition`, `updatePosition`, `archivePosition`, `restorePosition`, `addTemplates` (root 'position').
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** the specs and `npm run check` — PASS (the old positions page route still compiles against the new functions or is reduced to a load-only stub; Task 14 rewrites it). Commit `feat(positions): owned positions' data functions`.

### Task 8: Access, usable and integrity

**Files:**
- Modify: `src/lib/server/access.ts` (`Reach.positions`, `reachFrom`, `judgePosition`, `positionAccess`, `ReadKind`, `readerOf`), `src/lib/server/usable.ts` (`Usable.positions`, `pointers` union over the person's figures' tags, `lesson_positions` and `spot_position_links`; `usableBy(…, 'positions', …)`; `usablePositions(db, wall, usable?): (PositionRow & { team: TeamRef })[]`), `src/lib/server/scope.ts` (`requirePositionAccess(db, locals, params, id, need)` → `{ position, space, access, reach }`, built on `guarded`), `src/lib/server/integrity.ts` (`ROOTS` + `positions`; `REFS` + `figure_start_positions`, `figure_end_positions` (owner = the figure's), `lesson_positions` (owner = the lesson's), `spot_position_links` (owner = the spot's video's)), `src/lib/server/graph.ts` (`writeFigureShape` takes usable group positions, ruling 15)
- Test: `src/lib/server/access.spec.ts`, `usable.spec.ts`, `integrity.spec.ts`, `graph.spec.ts`, `src/routes/[dance]/owner-wall.spec.ts` (the describe 'positions are shared, and only the admin changes them' is replaced by 'positions are each owner’s')

- [ ] **Step 1: Tests** (ruling 12): a member reaches a group position that a published lesson's figure is tagged with, one the lesson links by hand, one a spot on its video links; not one only a draft lesson reaches; not after leaving. `positionAccess` gives an editor 'edit', a member 'reach' or none. `usableOf` includes a group position the person's figure already points at while they are a member. A person may tag their figure with a usable group position; integrity: each new REF reports a group figure tagged with a person's position and a person's figure tagged with an unreadable group position; `ownerIntegrity` reports a position with both owners or none. owner-wall: u2 gets 404 reading or editing u1's position.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** and `npm run check` — PASS. Commit `feat(positions): who reads and uses a position`.

### Task 9: Links to sections, points and lessons (data)

**Files:**
- Create: `src/lib/server/position-links.ts`
- Modify: `src/lib/server/spot-links.ts` (`linksBlocking` reads `spot_position_links` too, labels "Position · <name>"; `SpotLinkedError` unchanged), `src/lib/lessons/page.ts` (`deleteBlock` mirrors it), `src/lib/server/lesson-links.ts` (`viaSections` returns `positions: Map<id, ViaSection[]>` including points; `lessonsReaching(db, { positionId })`), `src/lib/server/lessons.ts` (`getLesson` returns `positions: LessonPositionRow[]`; `linkPosition`, `unlinkPosition(…, alsoSections)`; `listLinkablePositions(db, lessonId)`), `src/lib/server/spots.ts` (`deleteSpot` clears `positions.picture_spot_id` pointing at it, in its transaction), `src/lib/server/team-purge.ts` (delete `spot_position_links` before spots, `lesson_positions` before lessons), `src/lib/server/trash.ts` (kind `'position-link'`: snapshot table `spot_position_links`, restore re-inserts), `src/lib/server/access.ts` (reach through hand links and spot links — already in Task 8; check), `src/lib/types.ts` (`LessonPositionRow { id; name; styleTag; byHand; viaSections: ViaSection[]; mineId: number | null; teamId }`, `LinkedSpot` below)
- Test: `src/lib/server/position-links.spec.ts`, `lessons.spec.ts`, `spot-links.spec.ts`, `trash.spec.ts`, `changes.spec.ts`

**Interfaces:**
- Produces in `position-links.ts`:
  ```ts
  linkSpotToPosition(db, userId: string, spotId: number, positionId: number, now): number   // section or point; SpotLinkError on refusal
  unlinkSpotFromPosition(db, linkId: number, now, by?): boolean                           // a group's goes to team_trash ('position-link')
  spotsOfPosition(db, positionId, visible?, viewer?): LinkedSpot[]                          // sections and points, newest video first
  linkableSpots(db, positionId): SectionGroup[]                                             // the position's owner's videos, sections AND points, each spot marked linked
  positionTaughtIn(db, space, positionId): { id; title; lessonDay; teamName: string | null; via: boolean }[]
  ```
  `LinkedSpot = LinkedSection & { point: boolean }`. Refusals reuse `SpotLinkError`: "No such section." / "Already linked." (409) / a position of another owner: "No such position." Group rows link only group rows of their group; a person's spot may link a usable group position.
- Group link and unlink log with `logChange` (subject 'section-link' under the spot's root, as `logSectionLink` does).

- [ ] **Step 1: Tests:** link a point and a section to a position; a duplicate is 409; a spot linked to a position refuses delete with "Linked to Position · Cerrada — unlink it first."; deleting a picture point clears `picture_spot_id`… only after unlinking (assert order: unlink, delete, column null); a lesson reaches a position through a point on its video ("via section"); `linkPosition`/`unlinkPosition` on a lesson mirror `linkFigure`'s tests (live target, usable group position allowed for a person's lesson, a group lesson refuses a person's position); `alsoSections` removes the spot links on this lesson's spots; a group unlink lands in `listTrash` and restores; `purgeTeams` succeeds with position links present; `crossRefs` `[]`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** and `npm run check` — PASS. Commit `feat(positions): link sections, points and lessons to positions`.

### Task 10: Clones — the engine carries positions

**Files:**
- Modify: `src/lib/server/clones/genes.ts` (`ROOTS.position`, `accessTo` case), `trees.ts` (`flatOf` 'position' → `positionFlat`: name, type, hold fields, notes, `link` set of linked spots by gene ref; `positionsField` for figures becomes `starts`/`ends` sets of `ref(gene, id)`), `src/lib/clones/flat.ts` (`ROOT_KEYS`/`ROOT_LABELS`: `type`, `hands`, `crossed`, `facing`, `frame`; figure `positions` field split into set prefixes `start`, `end` with labels "Starts in", "Ends in"), `clone.ts` (`rootRow`, `refTarget`, `Planner.visit` 'position' (refs its spot links? no: spots are pieces of videos, see below) and 'figure' plans `this.ref('position', id)` for every tag; `COPIERS.position = copyPosition`; `copyFigure` writes start and end rows through `m.ref('position', id)`; `copyLesson` copies `lesson_positions` through `m.ref`; `copySpot`'s `mappedLinks` also copies `spot_position_links` through `m.ref('position', …)`), `apply.ts` (`rootOf`, `roots()` → `positionRoots`; `figureRoots` maps the giver's tags through `this.m.ref('position', …)`; `REF_TABLES` + position; `logRoot` default works once `ChangeRootKind` has 'position'), `routes/api/clones/{copy,compare,send}/+server.ts` (`KINDS` + 'position'), `src/lib/server/make-mine-form.ts` (`PAGE.position = 'positions'`)
- Test: `src/lib/server/clones/clone.spec.ts`, `trees.spec.ts`, `apply.spec.ts`, `src/lib/clones/flat.spec.ts`

**Interfaces:**
- Produces: `copyPosition(m: Mapper, sourceId: number, to: Space): number` (copies the row's fields, gene, `cloned_from`; `picture_spot_id` null — the copy's links come with its spots, not with it). A position's spot links travel with the spot's video (a lesson or recording copy), never with the position.
- Rule: copying a figure into a place uses that place's member of each position's family (`memberIn`), copying the position there when the place has none (`Mapper.ref` does exactly this for figures in slots; reuse it).

- [ ] **Step 1: Tests:** copy a person's figure tagged with their Cerrada (gene g) into a group that has a Cerrada of gene g — the copy is tagged with the group's, no new position; into a group without one — a new group position with gene g, the copy tagged with it, `crossRefs` `[]`; copy a lesson linking a position by hand and a section linking it — both links land on the group's member; Compare a figure pair whose tags are each owner's member of the same family — no difference; Take theirs on 'ends' writes your own member ids; `copyPosition` via `/api/clones/copy` with kind 'position'.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** and `npm run check` — PASS. Commit `feat(positions): copies carry positions`.

### Task 11: Clones — Make it mine, Drop, Detach, Copy to…, the rescue, Keep, repoint

**Files:**
- Modify: `src/lib/server/clones/edit.ts` (`rowOf`, `ROOT_KINDS`, `bringBack` → `restorePosition`, skip `ENTRY` for 'position'), `repoint.ts` (`rootOf`, `find` position branch: the person's own figures' start and end rows, own lessons' `lesson_positions`, own spots' `spot_position_links`, own positions' `picture_spot_id` untouched; guard the three fall-throughs at 588/597/618 by kind; `RepointReport.figures: number`), `rescue.ts` (`Kind` + 'position'; `usesOf` unions over the person's `figure_start_positions`, `figure_end_positions` (by 'figure'), `lesson_positions` (by 'lesson'), `spot_position_links` (by 'section')), `keep.ts` (`Ids`, `KINDS = ['lesson','routine','position','figure','drill','song']`, `addReach`, `itemsOf`, `bringBack`, `describe`, `LIST`), `drop.ts` (`REACH.position = 'positions'`, `practiceMayFollow` false for position, `hasPractice` false, `archiveMine` → `archivePosition`), `detach.ts` (`TABLES`, twins mark for 'position'), `copy-to.ts` (`TABLES`, `TWIN_KINDS` + position, `copyable`, `addedBy`, `changedAtOf` (rootId is the position), `hasNotes` true, restore maps), `shadow.ts` (`tables.position`), `sources.ts` (`familyOf` twins for position), `src/lib/clones/view.ts` (`GETS.position`: "Its name, type, hold, notes and video links, to change as you like."; `staysTheirs` for position: "The lessons and videos it was linked from. You still see them on yours."; the move line "Your <figure label>, tagged with it, switches to your copy." / "Your N figures tagged with it switch to your copy."; `KIND_WORD.position = 'position'`; `GoesCounts.positions`)
- Test: `edit.spec.ts`, `repoint.spec.ts`, `rescue.spec.ts`, `keep.spec.ts`, `drop.spec.ts`, `detach.spec.ts`, `copy-to.spec.ts`, `src/lib/clones/view.spec.ts`

- [ ] **Step 1: Tests:** Make it mine on a group position: the person gets a copy (gene, `cloned_from`), their figures' start and end tags, their lessons' hand links and their spots' links move to it, the group's stays, `makeMinePreview` lists "Setenta · Con giro" as moving; Drop my copy brings the tags back to the group's; Detach makes them twins; Copy to… a group copies the position; an editor archives a group position a member's figure uses — the rescue copies it into the member's app and re-points the figure; leaving with Keep everything copies the positions their kept figures use (before the figures, so the figure copy finds them); `crossRefs` `[]` after each.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** and `npm run check` — PASS. Commit `feat(positions): make it mine, drop, detach, copy, keep and rescue`.

### Task 12: Twins, Recently deleted and History for positions

**Files:**
- Modify: `src/lib/server/twins.ts` (`TABLES.position`, `twinCandidates` 'position': own live positions plus `usablePositions`), `src/lib/clones/view.ts` (`twinsNote`, `sameAsSearch('position')` = "Search your positions", `sameAsEmpty`), `src/lib/server/trash.ts` (`listTrash` lists archived group positions as `archived('position', id, name, at)`; `restoreDeleted` maps 'position' → `restorePosition`; `rootTitle` 'position'), `src/lib/teams/deleted.ts` (`KIND_NAME.position = 'Position'`, `'position-link': 'Position link'`), `src/lib/server/changes.ts` (`restoreChange` and `rootInTeam` cases), `src/lib/teams/history.ts` (position subject words, the new field labels: `styleTag 'type'`, `hands 'hands'`, `crossed 'crossed'`, `facing 'facing'`, `frame 'frame'`, `pictureSpotId 'picture'`), `src/routes/[dance]/groups/[id]/history/[kind]/[rootId]/+page.server.ts` (`KINDS` + position; `thing()` → title the name, href `/${dance}/positions/${id}`)
- Test: `twins.spec.ts`, `trash.spec.ts`, `changes.spec.ts`, `src/lib/teams/history.spec.ts`, `src/lib/teams/deleted.spec.ts`

- [ ] **Step 1: Tests:** mark two positions as twins and separate them; an archived group position shows in Recently deleted as "Position" and restores; History for a position renders "<Name> renamed …" style lines with the new labels; the history route serves `/groups/:id/history/position/:rootId` and 404s for a position of another group.
- [ ] **Step 2–4:** FAIL, implement, PASS, `npm run check`. Commit `feat(positions): twins, Recently deleted and History`.

**Ship point A.** The data is moved and owned; screens still show the old list (read-only) and the figure form's single end. Not deployable on its own: the old positions page's admin actions are gone. Continue to Phase B.

# Phase B — The phone screens

### Task 13: The positions words (pure)

**Files:**
- Create: `src/lib/positions/view.ts`
- Test: `src/lib/positions/view.spec.ts`

**Interfaces:**
- Produces (every string from the boards; one `it` per function with the board's example):
  ```ts
  taggedLine(t: { done: number; total: number }): string            // "31 of 41 figures have positions."
  OPTIONAL_LINE = 'Positions are optional: a figure without one fits anywhere in a routine.'
  rowMeta(r: PositionListRow, styleLabel): { text: string; word: 'dead end' | 'orphan' | 'island' | 'unused' | null; tone: 'danger' | null }
     // "Salsa · 17 in · 12 out"; "Timba · 2 in ·" + dead end; "Timba · unused"; "Other · 1 out ·" + orphan; island tone null
  groupRowMeta(r, styleLabel): string                                // "Salsa · from Week 6"
  noPositionRow(n: number): { title: 'No position'; meta: string }   // "10 figures · they fit anywhere"
  noPositionHead(n: { none: number; onlyStart: number; onlyEnd: number }): string // "10 figures · 7 with none, 3 with only a start or an end"
  FITS_ANYWHERE: { title: 'Fits anywhere'; body: string }
  noPositionGroups(...): { title: string; ids: number[] }[]         // "No start and no end · 7", "Only an end · 2", "Only a start · 1"
  EMPTY: { title: 'No positions yet'; body: string }                // phone: "Start from a template’s rough positions, or make your own."
  GROUP_NOTE = 'The group’s own positions. Its figures can only be tagged with these.'
  positionSubtitle(p, opts: { teamName?: string; ins: number; outs: number; styleLabel }): string // "Position · 4 in · 3 out"
  holdChips → re-exported from hold.ts
  figureFromRow(f: { label; style; ends: string[] }): string        // "Son → ends in Abierta (dos manos), Salsa"
  figureIntoRow(f: { label; starts: string[]; style }): string      // "from Cerrada, Salsa"
  deadEnd(name: string, n: number): { title: 'Dead end'; body: string; action: string } // "Two figures end in Caída and nothing you know leaves it. A routine that gets here stops." / "New figure from Caída"
  orphan(name: string, n: number): { title: 'Orphan'; body: string; action: string }    // "<N> figure(s) leave <name> and nothing you know ends in it." / "New figure into <name>"
  throughMeta(pairs: [number, number][]): string                    // "Slots 2 → 3" / "Slots 5 → 6 and 9 → 10"
  moreLine(n: number): string                                       // "and 2 more"
  pointLabel(ms: number): string                                    // "Point at 1:12"
  HOW: { example: [string, string, string][]; sections: { title: string; body: string }[]; done: 'Got it' } // the five sections verbatim from board positions--how
  templatesNote(typeLabel: string): string // "Rough positions to start from: rename, change or remove them later. They get the type Son. What you already have by name is skipped."
  addLabel(n: number): string              // "Add 3 positions" / "Add 1 position"
  tagsEmpty = 'No position · fits anywhere'
  TAGS_HELP = 'Any number of each. In a routine, the next figure fits when it starts in any of these ends.'
  handholds(starts: string[], ends: string[]): { from: string; to: string } // joined " or "; empty → "No position"
  ```
- [ ] Steps: tests (FAIL), implement, PASS, `npm run check`, commit `feat(positions): the screens' words`.

### Task 14: Moves gets Positions; the list, New position, Templates, How positions work

**Files:**
- Modify: `src/lib/moves/segment.ts` (`'positions'`, label "Positions", route `/[dance]/positions` and its subroutes), `src/lib/components/moves/MovesScreen.svelte` (third href; `+` label "New position"), `src/lib/nav/tabs.ts` (`rootsOf('moves')` + positions), `src/lib/nav/trail.ts` (`ROOTS` + 'positions'), `src/lib/nav/pending.ts` (drop the `LISTS` entry; the moves skeleton for 'positions'), `src/lib/components/shell/PageSkeleton.svelte` (`grid-cols-3`, `col-start-3`), `src/lib/nav/bands.spec.ts` (`NO_BAND` + positions list), `src/lib/moves/figures.ts` (`tileMetas` → coverage only; delete the positions tile), `src/routes/[dance]/figures/+page.{svelte,server.ts}` (Coverage tile alone; drop `tagged`), `src/lib/moves/positions.ts` (delete; its words moved to `view.ts`), `src/lib/page-epoch.ts` (raise)
- Rewrite: `src/routes/[dance]/positions/+page.{svelte,server.ts}`
- Create: `src/lib/components/positions/{PositionFields,PositionSheet,TemplatesSheet,HowSheet,PositionRow}.svelte`
- Test: `src/lib/moves/segment.spec.ts`, `src/lib/nav/*.spec.ts`, `src/routes/[dance]/positions-forms.spec.ts` (new, route actions against `openDb(':memory:')` with the db mock)

**Interfaces:**
- Load returns `{ rows: PositionListRow[]; groups: { team: TeamRef; rows: PositionListRow[] }[]; none: { none; onlyStart; onlyEnd } counts; tagged: { done; total }; gaps: number; types: string[]; styleLabel; defaultStyle; owned: string[] /* folded names, for Templates */; groupMode: boolean; filter: { q; type?; gaps?: '1' } }`. Person: own rows + each group's positions they may use (`usablePositions`), twins folded with `foldRows`. Group mode: the group's only, no groups.
- Actions: `create` (PositionFields → `createPosition` in `spaceOf`; refusal `fail(400, { action: 'create', field, message })`; success redirect to `/[dance]/positions/<id>`), `templates` (`type`, `names[]` → `addTemplates`; returns `{ added: n }`).
- `PositionFields` props: `{ dance: DanceSlug; name?; styleTag?; hold?: Hold; notes?; errors?: Partial<Record<'name', string>>; autofocus? }` — Name, Type (CHIP radios, "One, the same list as a figure’s type."), Hands (Two/One/None), Crossed (a Switch "Right hands on top"), Facing (four), Frame (Open/Closed), Notes.
- `PositionSheet` props: `{ open; onclose; mode: 'new' | 'edit'; action: string; position?: PositionSummary & { notes; pictureSpotId }; points?: LinkedSpot[]; defaultStyle; seen?: Record<string,string> }` — title "New position" (sub "Type starts as your “New figures” type (Settings)") or "Edit <name>"; footer "Add position" / "Save"; edit adds Picture ("From <video> at 1:12 · Change", a ChoiceSheet of linked points) and "Archive position" with the body "Archived like a figure: Restore brings it back. Its figures lose it and, with no other, have no position."; `use:guarded`.
- `TemplatesSheet` props: `{ open; onclose; dance; owned: string[] }` — Segmented of `templateTypes`, rows with a checkbox, "You have it" Badge (disabled) for owned names, `templatesNote`, footer `addLabel(n)`; posts `?/templates`.
- `HowSheet` props: `{ open; onclose }` — `HOW` drawn: the example strip, five sections, "Got it".

- [ ] **Step 1: Tests:** segment of `/[dance]/positions/[id]` is 'positions'; a tab tap on Moves returns to the last of the three; route spec: `create` refuses a duplicate name with the field; `templates` adds 3 of 4 when one is owned; group mode creates in the group and logs; a member of a group (not editor) cannot create in it (404); the load for a person with no positions returns empty rows and `tagged` counts.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** the page from boards `phone-1` (left), `phone-2`, `templates`, `how`, `group-mode`: the two lines, Templates and How positions work as two tonal buttons, `SearchField` "Search positions", chips All / each type / Gaps N (CHIP checkboxes, `refilter` like Figures), the No position row (→ `/positions/none`, hidden when 0), "The map" row (→ `/positions/map`, shown when there are positions), "Yours · N" (`SECTION_LABEL`) then a `GROUP` of `PositionRow`s (name, `rowMeta`, word as a Badge: danger for dead end/orphan, neutral for island/unused, Twins chip), then each group's under the slight heading with the people icon. Empty: `EmptyState` with Start from a template (primary), New position, How positions work. `?new=1` opens New position.
- [ ] **Step 4: Run** and `npm run check` — PASS. Check in the browser at 390 px (light and dark): empty, a few positions, group mode. Commit `feat(positions): Positions in Moves, templates and how they work`.

### Task 15: The No position page

**Files:**
- Create: `src/routes/[dance]/positions/none/+page.{svelte,server.ts}`
- Test: `src/routes/[dance]/positions-forms.spec.ts` (load)

- [ ] **Steps:** load `noPosition(graphFor(space))` mapped to figure rows (label, `figureRowMeta`, the tag on the side it has: "ends in Manos cruzadas"); page per board `no-position`: `Screen title="No position"` with Back to Positions, `noPositionHead`, the Fits anywhere card, the three groups (each hidden when empty), each row a link to the figure with a trailing tonal "Positions" button → `/[dance]/figures/<id>?edit=1` (ruling 8). Only figures the viewer may edit get the button. Test the load groups; `npm run check`; commit `feat(positions): the figures with no position`.

### Task 16: A position's page

**Files:**
- Create: `src/routes/[dance]/positions/[id]/+page.{svelte,server.ts}`, `src/lib/components/positions/{PointStill,PointCard}.svelte`
- Modify: `src/routes/[dance]/figures/+page.{svelte,server.ts}` (`?start=`/`?end=` preset, ruling 8; `create` writes it via `writeFigureShape`), `src/routes/[dance]/figures/[id]/+page.svelte` (`?edit=1` opens edit mode when `canEdit`)
- Test: `src/routes/[dance]/positions-forms.spec.ts`, `owner-wall.spec.ts`

**Interfaces:**
- Load via `requirePositionAccess(…, 'read')`: `{ position: PositionSummary & { notes; pictureSpotId }; picture: LinkedSpot | null (the picture spot, else the first linked point); canEdit; seen; counts: PositionCount; from: { id; label; style; ends: string[] }[]; into: { id; label; style; starts: string[] }[]; spots: LinkedSpot[]; lessons: positionTaughtIn; routines: { id; name; pairs: [number, number][] }[] (via `through`, routines of the viewer's graph); clone data as the figure page: sources, cloneLine, mineId, compare, family, drop, detach, copyTo, sameAs, makeMine, team, fromLesson; historyHref }`.
- Actions: `update` (`use:guarded`, `seenRefusal` for a group's), `archive`, `restore`, `makeMine`, `take`, `send`, `drop`, `detach`, `sameAs`, `separate` (reuse `take-form.ts`, `make-mine-form.ts` as the figure page does), `linkSpot`, `unlinkSpot`, `linkLesson`, `unlinkLesson` (Task 17 draws the last four).

- [ ] **Step 1: Tests:** the load for an own position lists figures from and into it (a figure with two ends appears in "from" once, with both ends named), routines through it with their slot pairs; a group position via a published lesson loads read-only for a member with `makeMine`; 404 for another person's; `update` writes and logs in a group with `seen`; a stale `seen` returns the clash; `archive` then `restore`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** per boards `phone-1` (middle and right), `open`, `dead-end`, `group`, `make-mine`, `your-copy`, `group-mode`: band title the name, subtitle `positionSubtitle` (or `cloneSubtitle`), pencil (editors) → `PositionSheet mode="edit"`; reader: the from-lesson note card, Edit (make it mine) in the bottom row; `SourceTabs kind="position"`; the picture (`PointStill`: a `<video preload="metadata" muted playsinline>` at `#t=<s>`, `object-cover`, rounded, with "From <video title> at 1:12 · Change" under it for editors); hold chips; Notes (`LinkedText`); dead end / orphan `Banner kind="warning"` with its action link; "Figures from here · N" (+ New → ruling 8) and "Figures into here · N" as `GROUP` rows; then Video, Lessons (Task 17); "In routines · N" with three rows then `moreLine` expanding in place; History in the band in group mode.
- [ ] **Step 4: Run** and `npm run check` — PASS; check at 390 px. Commit `feat(positions): a position's page`.

### Task 17: The position page's links: video and lessons

**Files:**
- Modify: `src/routes/[dance]/positions/[id]/+page.{svelte,server.ts}`
- Create: nothing new beyond `PointCard.svelte` (Task 16)
- Test: `positions-forms.spec.ts`

- [ ] **Steps:** "Video · N": sections as `SectionCard`, points as `PointCard` (the still, "Point at 1:12", "<video title> · the picture" when it is the picture; tap plays inline from the moment, no loop), each with an unlink × while editing; `PickerOpener "Link a section or point…"` → the shared `Picker kind="link"` titled "Link to <name>", placeholder "Search lessons, recordings, sections", a `top` note "A section loops; a point is one moment, and can be the picture.", groups from `linkableSpots` (rows "The cross on 7 / Section · 1:12–1:31", "Point at 1:12 / Point"), Done · N linked (board `phone-3` middle). "Lessons · N": rows (title, `lessonMeta`, "via section" Badge), unlink (a via-only row offers `UnlinkVia`), `PickerOpener "Link a lesson…"` → `Picker kind="link"` "Lessons with <name>", sub "A lesson linked here shows the position on its page too", month groups from `monthGroups`, a reaching lesson's row meta ends "· through a section" and is shown linked (board `link-lesson`). Tests: `linkSpot` with a point; `unlinkSpot` in a group lands in trash; `linkLesson` refuses a lesson of another owner. `npm run check`; commit `feat(positions): link videos and lessons from a position`.

### Task 18: A field picker that takes any number

**Files:**
- Create: `src/lib/components/picker/PickerMultiField.svelte`
- Modify: `src/lib/picker/view.ts` (`rowTrail(kind, row, chosen: string | ReadonlySet<string> | null, pending)`; `doneLabel(n, kind: 'link' | 'field')` → "Done · 3 linked" / "Done · 3"), `src/lib/components/picker/Picker.svelte` (`chosen` accepts a Set; `kind="field"` with `multi` keeps the sheet open on a tap and shows Done · N; a `clearKey` row "No position" that clears all), `docs/superpowers/specs/2026-10-30-unified-pickers-design.md` (a "Many-value field pickers" section: a tap toggles ✓, the clearing row, Done · N closes, the create step chooses the new row and returns; start and end positions leave the non-goals)
- Test: `src/lib/picker/view.spec.ts`, `src/lib/picker/model.spec.ts`

**Interfaces:**
- `PickerMultiField` props: `{ name: string; label: string; title: string; sub?: string; placeholder: string; empty: string /* "No position · fits anywhere" */; groups: PickGroup[]; clear?: { label: string; meta: string }; values: number[] (bindable); create?: { label: string; key: string }; oncreate?: (query: string) => Promise<PickRow | null>; nothingLeft: string }`. Posts one `<input type="hidden" name={name}>` per value. The opener shows the chosen labels as chips (wrapping) or `empty`, then ›.
- [ ] **Steps:** tests for `rowTrail` with a Set and `doneLabel`; implement; check the kit gallery gets a "Many-value field" example; `npm run check`; commit `feat(picker): a field picker that takes any number`.

### Task 19: The figure's Starts in and Ends in

**Files:**
- Create: `src/lib/components/figures/PositionTags.svelte`, `src/routes/api/positions/+server.ts`
- Modify: `src/routes/[dance]/figures/[id]/+page.{svelte,server.ts}` (form fields `startIds[]`, `endIds[]`; the plain select and `StartPositions` go; the load returns `positionChoices: PickGroup[]` built by `positionGroups`), `src/lib/picker/build.ts` (`positionGroups(rows: PositionSummary[], figureStyle: string | null, styleLabel, groups: { team; rows }[]): PickGroup[]` — "<Type> · this figure’s type" first, other types in style order, then "<Group>’" with meta "<Type> · tag with it as it is"; row meta `holdLine`), `src/lib/page-epoch.ts` (raise)
- Delete: `src/lib/components/figures/StartPositions.svelte`
- Test: `src/lib/picker/build.spec.ts`, `src/routes/[dance]/dance-wall.spec.ts`, `src/routes/api/positions/positions.spec.ts`

**Interfaces:**
- `POST /api/positions` body `{ figureId, name, styleTag, hands?, crossed?, facing?, frame? }` → 201 `PositionSummary`; 400 `{ message, field: 'name' }`; 404 when the figure is not editable (ruling 9).
- `PositionTags` props: `{ startIds: number[]; endIds: number[]; groups: PickGroup[]; figureLabel: string; figureStyle: string | null; styleLabel; figureId: number }` — two `PickerMultiField`s "Starts in" / "Ends in" with sub "<figure label> · <Style>", the clear row "No position / Fits anywhere · the default", create "Position" → a stacked `PositionSheet` level (name from the query, type preset to the figure's) that calls the API and returns the new row chosen; `TAGS_HELP` under them.

- [ ] **Step 1: Tests:** `positionGroups` orders the figure's type first; the update action stores two ends; the API creates in a group's space for a group figure and refuses a duplicate name; dance-wall's `holds` expectation becomes "Abierta (dos manos) → Abierta (dos manos)" only for tagged fixtures and "No position" otherwise (update the test).
- [ ] **Step 2–4:** FAIL, implement per boards `phone-5` and `figure-edit`, PASS, `npm run check`, browser check at 390 px. Commit `feat(figures): starts in and ends in any number of positions`.

### Task 20: The figure page and routines read positions without a neutral

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.{svelte,server.ts}` (Handholds: each position a link to its page, joined " or ", → between; both empty: the section shows `tagsEmpty`; siblings' `holds` via `handholds`; Leads to / Follows from use `follows`/`precedes` and drop self), `src/routes/[dance]/routines/[id]/+page.{svelte,server.ts}` (names from `graph.positions`; `posName` for a missing id is never shown — an empty side shows nothing; `danceable` no longer depends on starts), `src/lib/components/routines/SlotPicker.svelte` (no '?'), `src/routes/[dance]/routines/+page.server.ts`, `src/routes/[dance]/player/+page.server.ts` (graph shape)
- Test: `src/routes/[dance]/routine-forms.spec.ts`, `dance-wall.spec.ts`, `src/lib/routines/page.spec.ts`

- [ ] **Steps:** test that a routine of untagged figures loads with no breaks, no seams, `loops` per counts, and the facts line has no hand fact (Review Focus 1); a routine mixing a person's and a group's figure on the same family has no break (Review Focus 2); implement; `npm run check`; browser check of a routine with and without positions. Commit `feat(routines): positions are optional in routines`.

### Task 21: Lessons list their positions

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.{svelte,server.ts}` (a Positions group after Exercises: rows from `getLesson().positions`, `viaBadge`, the one-tap unlink or `UnlinkVia`, `PickerOpener "Link a position…"` → `Picker kind="link"` with `positionGroups`; actions `linkPosition`, `unlinkPosition` posting `positionId` and `alsoSections`; `LINK.position`), `src/lib/lessons/page.ts` (`positionMeta(row, styleLabel)` → "1:12.0–1:31.0 · Son" for via rows, the type otherwise), `src/routes/[dance]/lessons/[id]/+page.server.ts` (reach filter `visible?.positions`)
- Test: `src/routes/[dance]/lesson-forms.spec.ts` (or the existing lesson route spec), `src/lib/lessons/page.spec.ts`

- [ ] **Steps:** tests: link and unlink a position on an own lesson; a member sees a published group lesson's positions and not a draft's; the via row appears for a point-linked position. Implement per board `phone-4` middle. `npm run check`; commit `feat(lessons): a lesson's positions`.

### Task 22: The Link popup offers positions; points; "Use this moment as a point"

**Files:**
- Modify: `src/lib/server/link-popup.ts` (`linkOptions` for a point: positions only; for a section: figures, drills, positions; `LinkOptions.positions: LinkOption[]`, `linked` includes positions with `kind: 'position'`; `parseLinkBody` accepts `{ target: { positionId } }` and `{ create: { kind: 'position', name, styleTag } }`; `createAndLinkIn` creates the position in the spot's space and links it), `src/routes/api/video-spots/[id]/links/+server.ts` and `[linkId]/+server.ts` (`?kind=position` deletes from `spot_position_links`, ruling 10), `src/lib/video/links-api.ts` (`removeLink(spotId, linkId, alsoLesson, kind?)`), `src/lib/video/link-steps.ts` (`CreateStep` + 'position'; `SHOWN.position = ['name', 'style']`), `src/lib/picker/build.ts` (`linkOptionGroups` adds "Positions" after Drills), `src/lib/components/links/LinkPopup.svelte` (`CREATE_ROW` + Position; opener "Link a figure, drill or position…" for a section, "Link a position…" for a point; placeholder "Search figures, drills and positions"; `targetHref` for positions; a `moment?: () => number | null` prop → the footer button "Use this moment as a point"), `src/lib/components/ui/VideoPlayer.svelte` (passes `moment` = the playhead; saving the point uses the spots API, then pushes the popup onto the new point; the link entry shows for points too), `src/lib/types.ts` (`SectionTarget` + `{ positionId }`)
- Test: `src/lib/server/link-popup.spec.ts`, `src/lib/video/link-steps.spec.ts`, `src/lib/picker/build.spec.ts`

- [ ] **Steps:** tests: a point's options have positions only; linking a position from a section; create-and-link a position in one transaction (a refused name leaves nothing); removing a position link by kind. Implement per board `phone-4` right. `npm run check`; browser check in the player (portrait). Commit `feat(links): the Link popup links positions, and points`.

### Task 23: The map

**Files:**
- Create: `src/lib/positions/map.ts`, `src/lib/components/positions/PositionMap.svelte`, `src/routes/[dance]/positions/map/+page.{svelte,server.ts}`
- Test: `src/lib/positions/map.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MapInput { positions: { id: number; name: string; styleTag: string | null; figures: number }[]; edges: { from: number; to: number; figures: number }[] }
  export interface MapNode { id: number; x: number; y: number; r: number; labelX: number; labelY: number; mark: 'dead end' | 'orphan' | null }
  export interface MapLayout { width: number; height: number; nodes: MapNode[]; edges: { from: number; to: number; width: number }[]; tray: { islands: number[]; unused: number[] } }
  export function layoutMap(input: MapInput, opts?: { steps?: number }): MapLayout
  ```
  Fruchterman–Reingold over the main connected part (ruling 13), 400 steps, start on a circle in folded-name order, no randomness; radius 14 + 4·√figures (cap 34); edge width 1 + figures (cap 6); then 60 passes pushing overlapping circles and label boxes apart (label box estimated at 7 px per character × 14 px). Islands and unused positions go to the tray.
- Page per board `phone-3` right and `map-web`: `Screen title="The map"` (Back to Positions), "<N> positions" subtitle, the hint "Pinch to zoom, tap a position to light its figures.", an SVG in a pinch-zoom container (`src/lib/video/zoom.ts` maths), circles coloured by type (a fixed token per style index from `tokens.ts`), arrows, dead end (solid danger ring) and orphan (dashed) marks; the tray under it: islands, "No figures yet", and "No position · N" linking to `/positions/none`. A tap lights the position's figures in and out (in its type's colour) and fades the rest; a second tap opens it; Escape clears. The legend lines from the board.

- [ ] **Steps:** tests: the same input twice gives the same layout; no two circles overlap; a 3-position chain lays out with the middle between the ends; islands and unused go to the tray; an empty input gives an empty layout. Implement; `npm run check`; browser check at 390 px with ~15 positions (seed a few via Templates). Commit `feat(positions): the map`.

### Task 24: The dev data, the kit, and a look at every screen

**Files:**
- Modify: `src/routes/dev/kit/+page.svelte` (PositionRow states, the hold chips, PickerMultiField)
- Test: none new

- [ ] **Steps:** with `npm run dev`, walk the boards `phone-1`…`phone-5` side by side at 390 px in light and dark, salsa and bachata, own and group mode: empty Positions, Templates (Son), How positions work, the list with gaps, a position's page (picture, chips, figures, video, lessons, routines), Edit, New position, a figure's Starts in / Ends in, the picker with create, a group's position read-only, Make it mine, a lesson's Positions, the Link popup with a position, the map. Fix what differs. `npm run check`; commit `fix(positions): match the boards`.

### Task 25: The whole story, docs

**Files:**
- Create: `src/lib/server/positions-story.spec.ts`
- Modify: `CLAUDE.md` (the "Live" paragraph gains positions; the spec link; layout lines for `src/lib/positions/`, `positions-move.ts`, `position-links.ts`, the routes; hard rules: "A dance is the wall…" loses "Positions are the one exception…" and says positions are root tables like figures; a new rule "Positions are optional: an empty side fits anything (`meet` in `src/lib/graph/graph.ts`); the graph compares positions by family"; the vestigial `neutral`, `slug`, `sort_order`, `end_position_id` named beside `figures.style`), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the positions/graph section: owned, optional, many ends, family comparison), `docs/superpowers/specs/2026-11-04-positions-design.md` (a "Decided while planning" section with rulings 1–16), `docs/superpowers/specs/2026-11-03-clones-and-twins-design.md` (positions among the kinds)

- [ ] **Step 1: The story spec:** a person with no positions builds a routine — no break; adds Salsa templates; tags two figures; a group shares a lesson whose figure is tagged with the group's Cerrada (same family via a copy); the person's routine mixes them — no break; Make it mine on the group's position; leaves the group with Keep; `crossRefs`, `ownerIntegrity`, `familyIntegrity` `[]` throughout.
- [ ] **Step 2:** PASS; docs; `npm run check`. Commit `docs(positions): positions are their own things`.

### Task 26: Final review

- [ ] Run `nix develop -c npm run check` and `nix develop -c npm run build`. Then a whole-branch review (superpowers:requesting-code-review) against this plan and the spec, focused on the Review Focus list. Fix, commit.

### Task 27: Twins as one position in the graph

`buildGraph` extends the canonical map with the person's twin sets for positions (`storedTwinSets(db, userId, 'position')`): every member of a set maps to the set's canonical id (the person's own member, else the lowest id), after families are merged. `GraphPosition` gains `twins: boolean`. Group spaces have no twins (unchanged). The map draws a twinned node with a small "Twins" marker and its tooltip line "Twins: <names, places>"; the position page already shows the Twins chip through `SourceTabs`. Tests: two twinned positions of different families connect a routine; separating them brings the break back; the map has one node for the pair, marked. Record the decision in the positions spec ("Decided by the user") and in CLAUDE.md's "Twins are views" rule as its one exception (the graph and fit read twin positions as one; everything else reads rows as they are). Commit `feat(positions): twinned positions are one in the graph`.

---

## Risks

- **0029 rebuilds four tables.** Safe only while none has a foreign key in or out and the columns are identical (Task 3 Step 1 checks both). A future column on any of them must be its own migration, never folded into a CHECK change.
- **The boot move runs on production data once.** Back up `$DATA_DIR/app.db` before the first deploy (docs/deployment.md has the command); the move is one transaction and idempotent.
- **Raw position ids in old History rows** (`startIds`, `endId`) name ids that may now belong to the admin; History shows ids as names where it can, and that is acceptable for old rows.
- **Open pages after deploy** send `endId`; `PAGE_EPOCH` makes them reload.
