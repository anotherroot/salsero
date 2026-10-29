# A figure is its variations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "a base figure with variations that inherit from it" by "a figure is a name holding equal, self-contained variations", with a Move to… action and the version switcher at the bottom of the figure page.

**Architecture:** A new `figure_groups` table is the figure; every `figures` row is a variation pointing at it through `group_id`. One migration materialises everything variations used to inherit, so nothing reads through `parent_id` again (it becomes vestigial). The data layer gains create/rename/move/archive rules with the invariants; every consumer that grouped by `parent_id` or printed a bare `figures.name` switches to groups and the "Figure · Variation" label. The figure page is rebuilt around one variation per URL.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Drizzle ORM on better-sqlite3, drizzle-kit migrations, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-29-figures-are-variations-design.md` (mockups: row 3, G–K, of https://claude.ai/artifact/L5xC4YFb4v3VazC3cveo2m). Read both, and `CLAUDE.md`'s hard rules.

## Global Constraints

- Additive schema only: one new table, `ALTER TABLE figures ADD group_id`. No CHECK on `figures`, no rebuild of any existing table. Read the generated SQL before committing it.
- `figures.parent_id`, `style`, `eights`, `callable`, `call_text` stay in the schema, read by nothing. Do not drop them.
- Data functions take `db` first; tests use `openDb(':memory:')`. A spec never touches `$DATA_DIR`.
- Every instant is epoch ms. Archive, don't delete: "the figure is removed" means `figure_groups.archived_at` is set.
- Label is always `"<figure name> · <variation name>"` (U+00B7 with a space each side), including for a figure with one variation.
- Name comparison everywhere (variation within figure, figure within dance): `trim().toLowerCase()`, live rows only — the rule `variationNameTaken` uses today.
- Copy, exact: `There's already a figure called <name>.` · `<figure> already has a variation called <name>. Rename one first.` · `<figure> will be removed` · `<variation> is its last variation`.
- Forms someone fills in use `use:guarded`; one-tap forms (archive, a picker's choice) stay on `use:enhance`. No browser `confirm()` on anything new.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- `npm run check` must pass at the end of Task 9. Between Tasks 2 and 8 the type check is expected to fail in not-yet-updated routes; each task runs its own vitest files.

## Review Focus

- **A variation whose figure has other variations is archived or moved, and you are on its page** → you land on a remaining variation of the figure, never a 404. (Task 7, test `archive redirects to a sibling`.)
- **Moving into a figure of the other dance by posting its id by hand** → refused as "not found", nothing changes. (Task 3 test `refuses a group of another dance`; Task 7 dance-wall test.)
- **Renaming a figure to its own name with different case ("enchufla")** → allowed, it is the same figure. (Task 2 test `renameFigure allows its own name in another case`.)
- **An old bookmark `/salsa/figures/12?v=40`** → lands on variation 40; a `?v=` naming an archived or other-dance variation → 404, not the wrong page. (Task 7 tests.)
- **A routine slot holding a variation whose old parent had start positions and the variation had none** → after the migration the slot has the same starts, so no new break. (Task 1 test `variation inherits nothing it had resolved`.)

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/server/db/schema.ts` | `figureGroups` table; `figures.groupId`; `parentId` comment → vestigial |
| `drizzle/0016_*.sql` (generated, then data SQL appended) | the migration |
| `src/lib/server/db/migrate.spec.ts` | the migration test (new `it` block) |
| `src/lib/server/figures.ts` | groups, create, rename, copy, archive, move, labels, lists |
| `src/lib/server/variations.spec.ts` | rewritten for the new rules (keep the file name) |
| `src/lib/server/graph.ts` | `buildGraph` without inheritance; `setFigureShape` always concrete; `taggedFigures` counts variations |
| `src/lib/server/lessons.ts`, `spot-links.ts`, `practice-content.ts` | variations as first-class targets, labels |
| `src/lib/types.ts` | `FigureVersion`, `FigureListItem`, `MoveTarget`, `SiblingSummary` |
| `src/lib/routines/fit.ts`, `src/lib/components/routines/SlotPicker.svelte`, `src/routes/[dance]/routines/[id]/+page.server.ts` | picker grouped by figure |
| `src/routes/[dance]/figures/+page.server.ts` / `+page.svelte`, `src/lib/components/figures/FigureFields.svelte`, `src/routes/[dance]/lessons/[id]/+page.server.ts` / `+page.svelte` | creating a figure with both names; the list of figures |
| `src/routes/[dance]/figures/[id]/+page.server.ts` | one variation per URL, new actions |
| `src/routes/[dance]/figures/[id]/+page.svelte`, new `src/lib/components/figures/VariationBar.svelte`, `MoveSheet.svelte`, `RemoveWarning.svelte`; `FigureTiming.svelte` | the page (G–K) |
| `CLAUDE.md`, the 2026-09-29 and 2026-09-22 specs | docs |

---

### Task 1: Schema and migration

**Files:**
- Modify: `src/lib/server/db/schema.ts` (figures table ~97–180; add `figureGroups` before it)
- Create: `drizzle/0016_<generated>.sql` and its snapshot/journal entry (via `npm run db:generate`)
- Test: `src/lib/server/db/migrate.spec.ts`

**Interfaces:**
- Produces: `figureGroups` (Drizzle table: `id` integer pk autoincrement, `dance` text not null, `name` text not null, `archivedAt` integer, `createdAt: createdAt()`, index `figure_groups_dance_idx` on `dance`); `figures.groupId: integer('group_id').references(() => figureGroups.id)` with index `figures_group_idx`; types `FigureGroup = typeof figureGroups.$inferSelect`, exported beside `Figure`.

- [ ] **Step 1: Write the failing migration test** — a new `it('turns base figures into groups and materialises what variations inherited', …)` in `migrate.spec.ts`, built like the existing one: `migrate` a temp file through `migrationsThrough('0015_smiling_baron_strucker')`, insert rows with raw SQL, close, `openDb(file)`, assert. Seed (salsa unless noted; seed positions rows by raw insert too, ids 1 = neutral, 2 = cross-hand, 3 = hammerlock):
  - base A "Enchufla" (start rows [2], end 3, start_count 5, length_counts 4, partner 'solo', style_tag 'son') with variations: V1 "Doble" (no start rows, null end/start/length), V2 "Basic" (own start rows [1], end 1, start 1, length 8);
  - base B "Setenta" archived with V3 "Con mano" **live** (hand-edited case);
  - bases C "Vacilala" and D "vacilala " (live, same dance — duplicate) and E "Vacilala" in bachata;
  - an exercise `source='figure'` on A, and one on V1.

  Assert:
  ```ts
  const g = (id: number) => db.select().from(figureGroups).where(eq(figureGroups.id, id)).get();
  expect(g(A)).toMatchObject({ name: 'Enchufla', dance: 'salsa', archivedAt: null });
  expect(rows(A, V1, V2).map((r) => r.groupId)).toEqual([A, A, A]);
  // A's own variation is named, avoiding the existing "Basic"
  expect(fig(A).name).toBe('Original');
  // V1 inherits nothing it had resolved
  expect(fig(V1)).toMatchObject({ endPositionId: 3, startCount: 5, lengthCounts: 4, partner: 'solo', styleTag: 'son' });
  expect(starts(V1)).toEqual([2]);
  // V2 keeps its own values
  expect(fig(V2)).toMatchObject({ endPositionId: 1, startCount: 1, lengthCounts: 8, partner: 'solo' });
  expect(starts(V2)).toEqual([1]);
  // a live variation keeps its group live
  expect(g(B).archivedAt).toBeNull();
  // duplicates within a dance are numbered by id; the other dance is untouched
  expect([g(C).name, g(D).name, g(E).name]).toEqual(['Vacilala', 'vacilala 2', 'Vacilala']);
  // exercise names follow the label
  expect(exerciseOf(A).name).toBe('Enchufla · Original');
  expect(exerciseOf(V1).name).toBe('Enchufla · Doble');
  ```
  Base C's variation name: `'Basic'` (no collision).

- [ ] **Step 2: Run it** — `npx vitest run src/lib/server/db/migrate.spec.ts` → FAIL (`figureGroups` not exported).

- [ ] **Step 3: Schema** — add `figureGroups`, `figures.groupId`, the two indexes. Rewrite the `parentId` doc comment to: VESTIGIAL since migration 0016 (figures became groups), read by nothing, not dropped for the same reason `style` is not. Above `figures`, a comment: a `figures` row is a VARIATION; its figure is its `figure_groups` row; see the 2026-10-29 spec.

- [ ] **Step 4: Generate** — `npm run db:generate`. Read the SQL: it must be exactly `CREATE TABLE figure_groups`, its index, `ALTER TABLE figures ADD group_id integer REFERENCES figure_groups(id)`, the figures index. Anything touching `__new_figures` → stop and fix the schema change.

- [ ] **Step 5: Append the data SQL** to the generated file, each statement after a `--> statement-breakpoint`, in this order (the order is the algorithm):
  ```sql
  INSERT INTO figure_groups (id, dance, name, archived_at, created_at)
    SELECT f.id, f.dance, f.name,
      CASE WHEN EXISTS (SELECT 1 FROM figures v WHERE v.parent_id = f.id AND v.archived_at IS NULL)
           THEN NULL ELSE f.archived_at END,
      f.created_at
    FROM figures f WHERE f.parent_id IS NULL;
  UPDATE figures SET group_id = coalesce(parent_id, id);
  INSERT INTO figure_start_positions (figure_id, position_id)
    SELECT v.id, p.position_id FROM figures v
    JOIN figure_start_positions p ON p.figure_id = v.parent_id
    WHERE v.parent_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM figure_start_positions s WHERE s.figure_id = v.id);
  UPDATE figures SET
    end_position_id = coalesce(end_position_id, (SELECT p.end_position_id FROM figures p WHERE p.id = figures.parent_id)),
    start_count     = coalesce(start_count,     (SELECT p.start_count     FROM figures p WHERE p.id = figures.parent_id)),
    length_counts   = coalesce(length_counts,   (SELECT p.length_counts   FROM figures p WHERE p.id = figures.parent_id)),
    partner         = (SELECT p.partner   FROM figures p WHERE p.id = figures.parent_id),
    style_tag       = (SELECT p.style_tag FROM figures p WHERE p.id = figures.parent_id)
  WHERE parent_id IS NOT NULL;
  UPDATE figure_groups SET name = name || ' ' || (
      SELECT r.n FROM (SELECT id, row_number() OVER (PARTITION BY dance, lower(trim(name)) ORDER BY id) AS n
                       FROM figure_groups WHERE archived_at IS NULL) r WHERE r.id = figure_groups.id)
    WHERE id IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY dance, lower(trim(name)) ORDER BY id) AS n
                                 FROM figure_groups WHERE archived_at IS NULL) WHERE n > 1);
  UPDATE figures SET name = CASE
      WHEN EXISTS (SELECT 1 FROM figures v WHERE v.parent_id = figures.id AND v.archived_at IS NULL
                   AND lower(trim(v.name)) = 'basic') THEN 'Original' ELSE 'Basic' END
    WHERE parent_id IS NULL;
  UPDATE exercises SET name = (SELECT g.name || ' · ' || f.name FROM figures f
      JOIN figure_groups g ON g.id = f.group_id WHERE f.id = exercises.figure_id)
    WHERE source = 'figure';
  ```
  The test trims-and-lowercases for duplicates, so "vacilala " collides with "Vacilala"; the suffix is appended to the stored name as is.

- [ ] **Step 6: Run** `npx vitest run src/lib/server/db/migrate.spec.ts` → PASS (both `it` blocks).

- [ ] **Step 7: Rehearse on real data.** Ask the user for a copy of the production database (`docs/deployment.md`, "Backups"); copy it into the scratchpad, never `$DATA_DIR`. Before migrating, dump for every live routine `buildGraph`-equivalent resolved values per figure id (a throwaway script in the scratchpad running the pre-migration `src/lib/server/graph.ts` from `git show master:…`, or a SQL query resolving the old inheritance). Run `openDb(copy)`. Check: `select count(*) from figures where archived_at is null and group_id is null` = 0; live variations in archived groups = 0; resolved values per id identical to the dump; list groups renamed by the duplicate step and bases named "Original". Report those lists to the user. If no copy is available, say so and continue — the user decides before deploying.

- [ ] **Step 8: Commit** — `git add src/lib/server/db/schema.ts drizzle src/lib/server/db/migrate.spec.ts && git commit -m "Figures become groups: figure_groups, group_id, and a migration that writes out what variations inherited"`

---

### Task 2: Figures as groups — create, rename, copy, labels, lists

**Files:**
- Modify: `src/lib/server/figures.ts`, `src/lib/types.ts`
- Test: `src/lib/server/variations.spec.ts` (rewrite: drop every `parent_id`/inheritance test; keep the file)

**Interfaces:**
- Consumes: `figureGroups`, `figures.groupId`, `FigureGroup` (Task 1).
- Produces (all in `figures.ts` unless noted):
  - `type FigureInput = { name: string; partner: Partner; style: string; notes: string | null }` — `name` is the VARIATION's name now.
  - `createFigure(db, dance, input: FigureInput & { figureName: string }): { figure: Figure; group: FigureGroup } | null` — group + first variation in one transaction; blank shape (`startCount` 1, `lengthCounts` 8, no positions). Null on a style not of the dance, an empty name, or a taken figure name. **Every existing call site changes:** `{ name: 'X', … }` becomes `{ figureName: 'X', name: 'Basic', … }`; do it with the test helpers first.
  - `figureNameTaken(db, dance, name, exceptGroupId: number | null): boolean`
  - `variationNameTaken(db, groupId, name, exceptId: number | null): boolean` (same body, `groupId` instead of `parentId`)
  - `getGroup(db, groupId): FigureGroup | null`
  - `listGroupVariations(db, groupId): Figure[]` — live, by id. Replaces `listVariations`.
  - `createVariationFrom(db, fromId, name): Figure | null` — same group; copies `partner`, `styleTag`, `notes`, start rows, `endPositionId`, `startCount`, `lengthCounts`; nothing else. Null when `fromId` is gone/archived or the name is empty/taken.
  - `updateVariation(db, id, input: FigureInput): Figure | null` — replaces both `updateFigure` and the old `updateVariation`. Null for gone/archived, style not of its dance, taken name. Renames its exercise to the label.
  - `renameFigure(db, groupId, name): boolean` — false for empty or taken (excluding itself); renames every exercise of the group's variations.
  - `addFigureExercise` — same signature; works on any live variation; exercise `name` is the label.
  - `figureLabels(db, dance): Map<number, string>` — every variation of the dance, archived included, always the label.
  - `listVersions(db, dance): FigureVersion[]` — live variations of live groups, ordered by figure name then variation id.
  - `listFigures(db, dance, filter: FigureFilter): FigureListItem[]` — one row per live group; `q` matches figure or any live variation name; `style`/`partner` match if any live variation matches; ordered by name.
  - `listFiguresForCall(db, dance, ids): CalledFigure[]` — `name` the label, `say` the figure name.
  - `listMoveTargets(db, dance, exceptGroupId): MoveTarget[]` — live groups of the dance but one, by name.
  - In `src/lib/types.ts`: `FigureVersion = { id: number; groupId: number; figure: string; name: string; label: string }` (replaces `parentId`; `figure` is the figure's name, `name` the variation's); `FigureListItem = { id: number /* group */; name: string; variations: number; recordings: number; firstVariationId: number }`; `MoveTarget = { id: number; name: string; variations: string[] }`.
  - Remove: `updateFigure`, `listVariations`, `createVariation` (old), the old `updateVariation`.

- [ ] **Step 1: Write the failing tests** in `variations.spec.ts`. Helper: `const fig = (figureName = 'Enchufla', name = 'Basic', dance = 'salsa') => createFigure(db, dance, { figureName, name, partner: 'partner', style: dance === 'salsa' ? 'salsa' : 'dominican', notes: null })!`. Tests (name → assertion):
  - `createFigure makes a group and its first variation` → `figure.groupId === group.id`, `group.name === 'Enchufla'`, `figure.name === 'Basic'`, `startCount 1`, `lengthCounts 8`.
  - `createFigure refuses a taken figure name in the same dance` → second `fig('enchufla ')` is null; `fig('Enchufla', 'Basic', 'bachata')` is not.
  - `createVariationFrom copies the shape and nothing else` → set shape/notes/partner on the source, add a recording, a link, a lesson link and an exercise to it; the copy has equal partner/style/notes/starts/end/startCount/lengthCounts, and zero recordings, links, lesson links, exercise.
  - `createVariationFrom refuses a taken name` → `'basic'` → null.
  - `updateVariation renames its exercise to the label` → exercise name `'Enchufla · Doble'`.
  - `updateVariation refuses a sibling's name and another dance's style` → null, row unchanged.
  - `renameFigure renames every exercise of the figure` → two variations with exercises → both labels change.
  - `renameFigure refuses another figure's name` / `renameFigure allows its own name in another case` → false / true.
  - `figureLabels always shows both names` → one-variation figure → `'Setenta · Basic'`.
  - `listFigures is one row per figure` → `{ name, variations: 2, recordings: n, firstVariationId: lowest id }`; archived variations not counted.
  - `listFigures filters by any variation` → q `'doble'` finds Enchufla; `partner: 'solo'` finds a figure whose second variation is solo.
  - `listVersions lists variations with their figure` → `[{ groupId, name: 'Basic', label: 'Enchufla · Basic' }, …]`.
  - `listFiguresForCall says the figure name` → `{ name: 'Enchufla · Doble', say: 'Enchufla' }`.
  - `addFigureExercise works on any variation` → non-null on a second variation; named with the label.

- [ ] **Step 2: Run** `npx vitest run src/lib/server/variations.spec.ts` → FAIL.
- [ ] **Step 3: Implement** the Produces list. Labels: one internal helper `labelOf(tx, figureId): string` and, for queries, an inner join on `figureGroups` selecting `figureGroups.name` beside `figures.name`. Exercise renames go through one internal `syncExerciseNames(tx, where)`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Figures as groups: create, rename, copy a variation, labels and lists"`

---

### Task 3: Moving and archiving variations

**Files:**
- Modify: `src/lib/server/figures.ts`, `src/lib/server/exercises.ts:126-130` (comment only: figure exercises are archived through `archiveVariation`)
- Test: `src/lib/server/variations.spec.ts` (new `describe('moveVariation')`, `describe('archiveVariation')`)

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `archiveVariation(db, id, now): { figureRemoved: boolean } | null` — archives the variation and its exercise; archives the group too when no live variation is left. Null when already archived or gone. Replaces `archiveFigure`.
  - `type MoveTo = { groupId: number } | { newFigure: string }`
  - `type MoveResult = { ok: true; groupId: number; figureRemoved: boolean } | { ok: false; reason: 'gone' | 'same-figure' | 'name-taken' | 'figure-name-taken' }`
  - `moveVariation(db, id, to: MoveTo): MoveResult` — one transaction. `gone`: variation gone/archived, or target group missing/archived/**of another dance**. `same-figure`: target is its own group. `name-taken`: target has a live variation of that name. `figure-name-taken`: `newFigure` empty or taken in the dance. On success: `group_id` changes, its exercise is renamed to the new label, the old group is archived when it has no live variation left.
  - `isLastVariation(db, id): boolean` — what the page asks before showing the warning.

- [ ] **Step 1: Failing tests:**
  - `moves into another figure and takes everything with it` → recording, section link (`spot_links`), link, lesson link, exercise + a set, routine option: all still reference the same id; `groupId` is the target's; exercise name `'Setenta · Doble'`.
  - `makes a new figure` → `{ newFigure: 'Enchufla Doble' }` → new group of the same dance, the variation keeps the name `Doble`.
  - `removes the figure it leaves when it was the last` → `{ ok: true, figureRemoved: true }`, old group `archivedAt` set; with a sibling left → `figureRemoved: false`, group live.
  - `refuses its own figure` / `refuses a taken variation name` / `refuses a taken figure name` / `refuses a group of another dance` → the reasons above; nothing changed.
  - `archiveVariation archives its exercise and, when last, its figure` → `{ figureRemoved: true }`; with a sibling → `false`.
  - `never leaves a live variation in an archived figure` → after a mix of moves and archives across three groups, `select … where figures.archived_at is null and figure_groups.archived_at is not null` is empty.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/variations.spec.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Move a variation to another figure or its own; the last one out removes the figure"`

---

### Task 4: The graph without inheritance

**Files:**
- Modify: `src/lib/server/graph.ts`
- Test: `src/lib/server/graph.spec.ts` (update helpers to the new `createFigure`; delete inheritance tests)

**Interfaces:**
- Produces: `buildGraph` — nodes straight from each live variation of a live group (`starts` own rows, `end` own, `start ?? DEFAULT_START_COUNT`, `length ?? DEFAULT_LENGTH_COUNTS`), ordered by `figures.id`. `FigureShape.startCount` and `.lengthCounts` become `number` (not nullable); `setFigureShape` drops the parent check. `taggedFigures` counts every live variation.

- [ ] **Step 1: Failing tests** — `a variation's graph node is its own values` (variation with no start rows reads neutral even when a sibling has starts); `taggedFigures counts variations` (`{ done: 1, total: 2 }` for one tagged, one untagged variation of one figure).
- [ ] **Step 2: Run** `npx vitest run src/lib/server/graph.spec.ts` → FAIL.
- [ ] **Step 3: Implement**; delete the "A variation takes whatever it leaves unset" block and its comments.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Graph: every variation stands on its own"`

---

### Task 5: Lessons, section links, practice content

**Files:**
- Modify: `src/lib/server/lessons.ts` (`linkFigure` ~230, `getLesson` ~170–190, `listLinkableFigures` ~407), `src/lib/server/spot-links.ts` (`linkChips` ~155–185, `videosOf` ~240–260, `targetContext` ~277), `src/lib/server/practice-content.ts` (~60–80), `src/routes/[dance]/lessons/[id]/+page.server.ts` (`sectionTargets` `isTaught`)
- Test: `src/lib/server/lessons.spec.ts`, `spot-links.spec.ts`, `practice-content.spec.ts`

**Interfaces:**
- Produces: `linkFigure` accepts any live variation of the lesson's dance (variation refusal removed). `listLinkableFigures(db, lessonId): { id: number; name: string }[]` — live variations, `name` = label, ordered by label. `getLesson(...).figures[].name` = label. `linkChips` and `videosOf` label via the group join (drop the `parent` alias). `targetContext` uses only the target's own id. `practicePayload` names every figure by label. `isTaught = (v) => taught.has(v.id)`.

- [ ] **Step 1: Failing tests:**
  - lessons: `links a variation` → `linkFigure(db, lesson, doble.id)` true and `taughtIn(db, doble.id)` has the lesson; `does not teach its sibling` → `taughtIn(db, basic.id)` empty. `lists variations to link by label` → `['Enchufla · Basic', 'Enchufla · Doble']`.
  - spot-links: `a chip reads the label` → `'Enchufla · Doble'`; `a variation's lessons are its own` → a section from a lesson linked only to the sibling is not in the variation's "this lesson" group.
  - practice-content: `a figure exercise is named by its label`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/lessons.spec.ts src/lib/server/spot-links.spec.ts src/lib/server/practice-content.spec.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Lessons, section links and practice treat each variation as its own"`

---

### Task 6: The routine picker, grouped by figure

**Files:**
- Modify: `src/lib/routines/fit.ts`, `src/lib/components/routines/SlotPicker.svelte` (~120–150), `src/routes/[dance]/routines/[id]/+page.server.ts` (~76–108)
- Test: `src/lib/routines/fit.spec.ts`

**Interfaces:**
- Consumes: `FigureVersion` (Task 2).
- Produces: `Candidate.parentId` → `groupId: number | null` (null for a routine) plus `figure: string | null` (the figure's name, for the heading). `PickGroup = { groupId: number; name: string; single: boolean; variations: Candidate[] }` — `single` is true when the figure has exactly one candidate overall (fitting or not); `variations` holds only fitting ones; a group with none fitting is left out. `headFits` is gone.
- Sheet: `single` → one pickable row showing the variation's `label`; otherwise a non-pickable heading `name` and one row per fitting variation showing its own name (the variation part of its label).

- [ ] **Step 1: Failing tests** — `groups variations under their figure` (two variations of Enchufla → one group, `single: false`, both rows); `a one-variation figure is a single row`; `leaves out a figure none of whose variations fit`; search `'enchufla doble'` still matches. Replace every `headFits` assertion.
- [ ] **Step 2: Run** `npx vitest run src/lib/routines/fit.spec.ts` → FAIL.
- [ ] **Step 3: Implement**, including `isNonEmpty` (~line 210) and the routine loader's candidates (`groupId: v.groupId`, `figure: v.figure`; routines `groupId: null, figure: null`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Routine picker: variations under a figure heading, a lone variation as one row"`

---

### Task 7: The figure page server — one variation per URL

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (rewrite), `src/routes/[dance]/figures/+page.server.ts` (`create`), `src/routes/[dance]/lessons/[id]/+page.server.ts` (`newFigure`, ~175–200)
- Test: `src/routes/[dance]/dance-wall.spec.ts` (figure-page block ~400–520), `src/routes/[dance]/section-links.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- `load` returns (types in `src/lib/types.ts` where a component needs them):
  ```ts
  {
    figure: { id: number; name: string },               // the group
    variation: { id; name; partner; styleTag; notes; recordings; sections; recordingSections },
    siblings: SiblingSummary[],                          // live variations of the figure, id order, current included
    exercise, popup, positions, tags,
    shape: { startCount: number; lengthCounts: number }, // the edit form's values
    effective: { starts: number[]; end: number | null; startCount: number; lengthCounts: number },
    leadsTo, followsFrom: { id: number; name: string }[], // name = label; href is /figures/<id>
    links, taughtIn, linkable,
    moveTargets: MoveTarget[]
  }
  // SiblingSummary = { id: number; name: string; holds: string; timing: string; videos: number }
  // holds "Cross-hand → Open two hands" (neutral name for none); timing "Starts on 5 · 4 counts"
  ```
- Routing: `params.id` is a variation id. A `?v=<id>` param → `303` to `/<dance>/figures/<id>` (that page then 404s if `<id>` is bad). Missing, archived, or other-dance variation → 404.
- Actions (no `versionId` field anywhere any more — the URL's variation is the subject):
  - `update` — fields `figureName`, `name`, `partner`, `style`, `notes`, `startIds`, `endId`, `startCount`, `lengthCounts`. Order: validate all; `figureNameTaken` → fail `There's already a figure called <figureName>.`; `variationNameTaken` → fail `<figure> already has a variation called <name>. Rename one first.`; then `setFigureShape`, `updateVariation`, `renameFigure` (only if changed).
  - `createVariation` — field `name`; `createVariationFrom(current, name)`; 303 to the new id; taken name → fail with the variation copy.
  - `move` — fields `target` (`'new'` or a group id) and `figureName` (when `'new'`); maps `MoveResult` reasons to fails with the copy above (`gone` → 404); success → 303 to the same `/figures/<id>`.
  - `archive` — `archiveVariation`; 303 to the lowest-id remaining sibling, or to `/<dance>/figures` when the figure was removed.
  - `practise`, `log`, `deleteSet`, `deleteRecording` (`recordingId`), `linkSection` (`spotId`), `unlinkSection` (`linkId`), `addLink`, `deleteLink`, `saveVideo`, `retryVideo` — as today, keyed on the page's variation.
- Figures list `create` and lesson `newFigure`: read `figureName` and `name`; taken figure name → fail `There's already a figure called <figureName>.` (keep the entered values in the fail payload, as today).

- [ ] **Step 1: Failing tests** in `dance-wall.spec.ts` (replace the old variation block): `a ?v= link redirects to the variation`; `a bachata variation under /salsa/ is a 404`; `move refuses a figure of the other dance` (404, nothing moved); `archive redirects to a sibling` / `archive of the last variation goes to the figures list`; `update refuses a taken figure name`; `createVariation copies the current variation and opens it` (303 location `/salsa/figures/<new id>`). In `section-links.spec.ts`, drop `versionId` from posted forms.
- [ ] **Step 2: Run** `npx vitest run 'src/routes/[dance]/dance-wall.spec.ts' 'src/routes/[dance]/section-links.spec.ts'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Figure page server: one variation per URL; update, new variation, move, archive"`

---

### Task 8: The figure page and the forms (G–K)

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (rewrite), `src/lib/components/figures/FigureFields.svelte`, `src/lib/components/figures/FigureTiming.svelte`, `src/routes/[dance]/figures/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`
- Create: `src/lib/components/figures/VariationBar.svelte`, `MoveSheet.svelte`, `RemoveWarning.svelte`

**Interfaces:**
- Consumes: Task 7's load data and action names.
- `FigureFields` props: `{ dance, figureName = '', name = '', partner, style, notes }`; renders "Figure name" (`name="figureName"`, required) then "Variation name" (`name="name"`, required, placeholder `e.g. Basic, Doble, From cross`) then the existing fields.
- `FigureTiming`: remove the `inherited` prop and every "as Basic" branch; both inputs required.
- `VariationBar.svelte` props `{ figureName: string; siblings: SiblingSummary[]; currentId: number; slug: string; failed: string | null }` — the pinned bar (‹, name over "N of M variations", ›; links, wrapping), the "Variations of <figure>" `Sheet` (rows: name, holds, `timing · N videos`, current marked; each row a link), and "+ New variation" opening a second `Sheet` with a `use:guarded` form posting `?/createVariation` (name only). Shown with one variation too.
- `RemoveWarning.svelte` props `{ figure: string; variation: string }` — the red box: `<figure> will be removed` / `<variation> is its last variation, and a figure with no variations is gone. It leaves the figures list.`
- `MoveSheet.svelte` props `{ variation: string; figure: string; targets: MoveTarget[]; last: boolean; failed: string | null; open; onclose }` — the I layout: "A new figure of its own" (selected by default, shows a `figureName` field prefilled `<figure> <variation>`), "Or join a figure" with a search filtering `targets` by figure or variation name, a radio list; button `Make it its own figure` / `Move to <name>`. When `last`, the button reads `Move and remove figure`, is red, and `RemoveWarning` shows above it. `use:guarded` (it has a typed field), posting `?/move`.
- Page: header (back, figure name over variation name, Edit/Done); body as today minus tabs; end of page: a full-width link-styled button `Move <variation> to…` (subtitle `A new figure of its own, or another figure`) opening `MoveSheet`, then `Archive <variation>` in red, opening a `Sheet` with `RemoveWarning` when last (button `Archive and remove figure`) or a plain confirm sheet otherwise (button `Archive <variation>`), posting `?/archive` with `use:enhance`. Page bottom padding ≥ the bar's height plus `env(safe-area-inset-bottom)`. The Edit form posts `?/update` with `FigureFields`, positions (`neutralName` = the real neutral name), end, `FigureTiming`.
- Figures list rows: name and `N variation(s)` · recordings; link to `/figures/<firstVariationId>`. Drop per-row style/partner chips.

- [ ] **Step 1: Implement** the components and pages above.
- [ ] **Step 2: Check** — `npx svelte-kit sync && npx svelte-check --threshold error` → 0 errors outside `*.spec.ts`, and `npm run build` succeeds. (Spec files still on the old `createFigure` call are Task 9's.)
- [ ] **Step 3: See it working** — `npm run dev` on this slot; with the dev database migrated, open a figure: the bar steps ‹ › through variations; the sheet opens from the bar; "+ New variation" copies the current one and opens it; Edit renames the figure and the variation; "Move … to…" → new figure, then back into the old figure (the warning shows on the move that empties a figure); archive the last variation of a figure → lands on the figures list and the figure is gone; a lesson's new-figure form asks both names. Note what you saw.
- [ ] **Step 4: Commit** — `git commit -am "Figure page: switcher at the bottom, Move to…, last-variation warning; forms ask figure and variation names"`

---

### Task 9: Sweep, remaining tests, docs

**Files:**
- Modify: every spec still failing from the `createFigure` signature (`data.spec.ts`, `routines.spec.ts`, `links.spec.ts`, `spots.spec.ts`, `video-downloads.spec.ts`, `link-form.spec.ts`, `log-form.spec.ts`, `src/routes/api/**/*.spec.ts`, `video-spots.spec.ts`); any `.svelte`/`.ts` still printing a bare `figures.name` where a label belongs (`grep -rn "figures\.name" src`); `CLAUDE.md`; `docs/superpowers/specs/2026-09-29-figure-variations-design.md`; `docs/superpowers/specs/2026-09-22-salsa-app-design.md`.

- [ ] **Step 1: Fix the specs** — call sites to `{ figureName, name, … }`; drop assertions about `parentId` and inheritance; no behavioural test is deleted without a replacement asserting the new rule.
- [ ] **Step 2: Sweep bare names** — every remaining `figures.name` read either is the variation-name field of a form or is joined with the group into a label. `grep -rn "parentId\|parent_id" src` returns only the schema's vestigial column.
- [ ] **Step 3: Docs** — `CLAUDE.md`: in the "Live" paragraph replace "figure variations (versions of a figure with their own positions, timing and videos; chosen per routine slot)" with "figures as variations (a figure is a name holding self-contained variations; Move to… another figure or a new one; switcher at the bottom)"; add the spec to the spec list; replace the hard rule "A variation is a `figures` row with `parent_id`…" with: **A `figures` row is a variation; a `figure_groups` row is a figure.** Every live variation has a live group of its dance and a name unique within it; figure names are unique per dance; the last variation leaving archives its figure (`figures.ts`). Show a variation with `figureLabels` ("Enchufla · Doble"), always. `figures.parent_id` is vestigial, read by nothing, not dropped. Update the "Archive, don't delete" rule's sentence about a figure's exercise to say variation. The 2026-09-29 spec: status note "Data model, variation fields, rules and the figure page replaced by 2026-10-29-figures-are-variations-design.md". The 2026-09-22 spec: a pointer beside the variations one.
- [ ] **Step 4: Verify** — `npm run check` → all pass. Paste the vitest summary line in the commit body.
- [ ] **Step 5: Commit** — `git commit -am "Figures are variations: remaining tests, labels everywhere, docs"`
