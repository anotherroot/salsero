# A group's + and one figure form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The group page lists lessons by month with a band + that opens Add to the group; every New figure form takes its move from one searchable field that can also make a new move.

**Architecture:** Pure words and rules in `src/lib/teams/add-menu.ts` and `src/lib/figures/move-field.ts`; `PickerField` grows an optional create; the three figure forms use it and post to the actions that already exist (the figures list's `create` learns `groupId`). The group page gets a `createDrill` action.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Drizzle on SQLite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-group-add-and-one-figure-form-design.md`

## Global Constraints

- Words through `t()` in both catalogs for translated components (`groups/[id]/+page.svelte` is translated); the Moves, lesson and Link popup forms are English-only today and stay so.
- A form someone fills in uses `use:guarded`; one-tap forms `use:enhance`.
- Forms in a list column post to the list route's explicit action URL (`/{dance}/figures?/create`).
- Every group mutation logged (`createCustomExercise` and `createVariationIn` already log).
- Raise `PAGE_EPOCH` (src/lib/page-epoch.ts): the lesson page's form fields change.
- `npm run check` must pass.

## Review Focus

- A typed move name equal (case/accents folded) to an existing move → picks the existing move, no "already a move called" refusal.
- Picking a move, then creating a new one, then picking again → posts only the last choice (never both `groupId` and `figureName`).
- A refused lesson-page New figure → the sheet reopens with the move (picked or new) and names it kept.
- Figures list `create` with a `groupId` of another person's or an archived move → refusal under Move, nothing written.
- Add to the group at Practise and keep my own → + opens New lesson directly (no switch that the cookie check would drop).

---

### Task 1: Group page — by month, the band's + (built)

Done before this plan: `byMonth` in `src/lib/lessons/list.ts` (+ spec), the lessons snippet grouped by month without heading, the band's + (`groups.page.add`) opening New lesson.

### Task 2: Add to the group sheet and New drill

**Files:**
- Create: `src/lib/teams/add-menu.ts`, `src/lib/teams/add-menu.spec.ts`
- Modify: `src/routes/[dance]/groups/[id]/+page.svelte`, `+page.server.ts`, `src/lib/i18n/en/groups.ts`, `src/lib/i18n/sl/groups.ts`
- Test: `src/routes/[dance]/groups/groups.spec.ts` (createDrill)

**Interfaces:**
- Produces: `type AddKind = 'lesson' | 'music' | 'figure' | 'routine' | 'position' | 'drill'`; `ADD_KINDS: readonly { kind: AddKind; icon: IconName }[]` in the table's order; `addPath(kind, dance): string | null` (null for lesson and drill: on this page); `chooserShown(level: Level | null): boolean` = `groupModeShown(levelShown(level))`.

- [ ] Spec `add-menu.spec.ts`: order is lesson, music, figure, routine, position, drill; `addPath('music','salsa') === '/salsa/songs?add=1'`, figure `'/salsa/figures?new=1'`, routine `'/salsa/routines?new=1'`, position `'/salsa/positions?new=1'`, lesson and drill `null`; `chooserShown('all')`, `chooserShown(null)` true, `chooserShown('own')` false.
- [ ] Implement `add-menu.ts`; run the spec.
- [ ] Spec in `groups.spec.ts`: `createDrill` by the owner makes a `custom` exercise with `team_id` set, `user_id` null, logs a `team_changes` row, redirects to `/salsa/exercises/<id>`; empty name → 400 `field: 'name'`; a member → 404; a deleted group → 404.
- [ ] Action `createDrill` in `groups/[id]/+page.server.ts`: role owner/editor and group live, `text(form,'name')`, `optionalText(form,'notes')`, `createCustomExercise(db, teamSpace, { name, notes })`, `redirect(303, …)`. Refusals `fail(400, { action: 'drill', field, message, name, notes })`.
- [ ] Page: `openAdd()` → `chooserShown(data.user?.level ?? null)` ? sheet : New lesson. The sheet (`size="small"`, title `w.add`): one `GROUP` card; lesson and drill rows are buttons; the four switch rows are submit buttons `name="to" value={addPath(...)}` in one `<form method="POST" action="/{dance}/group-mode">` with hidden `team`, enhanced as `GroupModeButton.pick` (close, `gotoWhenSettled(result.location, { invalidateAll: true })`). New drill sheet: name + notes, `use:guarded`, posts `?/createDrill`, a refusal reopens it.
- [ ] Words: `groups.page.add` (have), `addMenu: { lesson, music, figure, routine, position, drill }`, `newDrill: { title, name, notes, create }` in en and sl.
- [ ] svelte-check, vitest for the touched specs; commit `feat(groups): Add to the group, New drill`.

### Task 3: PickerField with a create, and the move rule

**Files:**
- Create: `src/lib/figures/move-field.ts`, `src/lib/figures/move-field.spec.ts`
- Modify: `src/lib/components/picker/PickerField.svelte`

**Interfaces:**
- Produces: `moveFromQuery(query: string, moves: { id: number; name: string }[]): { groupId: number } | { newName: string } | null` (null for an empty query; folded equal name → that move's id). `PickerField` props: `create?: { label: string; tag: string; name: string }` (the create button's noun "Move", the field's tag "New move", the posted name `figureName`), `newName = $bindable<string | null>(null)`, `oncreate?: (query: string) => void` optional override; when `newName` is set the field shows it with the tag, posts `create.name`=newName and an empty, not-required `name` input.
- [ ] Spec: `moveFromQuery('  ', …) === null`; `'tornillo'` with `Tornillo` existing → `{ groupId }`; `'Enchúfla'` vs `Enchufla` → groupId; `'New one'` → `{ newName: 'New one' }` (trimmed).
- [ ] Implement with `fold` from `$lib/fold`; run the spec.
- [ ] PickerField: pass `create={[{ key: 'create', label }]}` to Picker; `oncreate(key, q)` → `moveFromQuery(q, rows as moves)`: groupId → `value = id, newName = null`; newName → `value = null, newName`; null → nothing; close. A pick clears `newName`. Rows for the rule are every row in `groups` (`value`, `label`).
- [ ] svelte-check; commit `feat(picker): a field that can make a new move`.

### Task 4: The Link popup's one Figure step

**Files:** `src/lib/video/link-steps.ts` (+ its spec), `src/lib/components/links/LinkPopup.svelte`

- [ ] link-steps spec: the create row is `[Figure, Drill, Position]` for a section (keys `variation`, `drill`, `position`); `SHOWN.variation` includes `figureName` too (a new move's refusal shows under the field).
- [ ] Remove `figure` from `CREATE_ROW` and `LinkStep`'s create steps; the `variation` step's PickerField gets `create={{ label: 'Move', tag: 'New move', name: 'figureName' }}` and `bind:newName`; submit sends `{ kind: 'figure', figureName: newName, name, partner, style }` when `newName`, else the variation body. Refusal at `figureName` or `groupId` shows under the field.
- [ ] Run link-steps and link-popup specs; commit `feat(links): one Figure step, the move a field`.

### Task 5: The lesson page's New figure

**Files:** `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/page-epoch.ts`

- [ ] Drop `FIGURE_MODES` and the Segmented; one form `id="lesson-new-figure"` whose `action` is `newName ? '?/newFigure' : '?/newVariation'`; the Move PickerField with create (offered even with no moves yet); `FigureFields asksFigureName={false}`. Errors merged from both actions; the move's error is `figureName ?? groupId`. A refused `newFigure` restores `newName` from `form.figureName`; a refused `newVariation` restores `variationOf`.
- [ ] The Link a figure picker's `create` is `[{ key: 'variation', label: 'Figure' }]`; `openFigureSheet(query)` puts the query in Figure name.
- [ ] `PAGE_EPOCH` + 1.
- [ ] Run `lesson-forms.spec.ts`; svelte-check; commit `feat(lessons): one New figure form`.

### Task 6: Moves → Figures: New figure

**Files:** `src/routes/[dance]/(moves)/figures/+page.server.ts`, `src/lib/server/moves-lists.ts`, `src/lib/components/moves/FiguresList.svelte`, `src/routes/[dance]/moves-forms.spec.ts`

- [ ] Spec in `moves-forms.spec.ts`: `create` with `groupId` of the person's move makes a figure in it and redirects to it; with a `start` preset the figure is tagged; another person's `groupId` → 400 `field: 'figureName'`, nothing written; a taken figure name in that move → 400 `field: 'name'`.
- [ ] `create`: `groupId = int(form,'groupId')`; when set: `getGroup`, live and `inSpace`, else refuse under `figureName` ("Pick a move."); `variationNameTaken` → refuse under name; `createVariationIn(tx, …)` in the same transaction as the preset; else the existing new-move path.
- [ ] `(moves)` layout load: `moveTargets: listMoveTargets(db, space, null)` in the figures namespace; FiguresList: "New figure" words, the Move field first (`asksFigureName={false}` on FigureFields), groups `figureRows(moveTargets)`.
- [ ] Run the spec and `figure-page.spec.ts`; commit `feat(moves): New figure takes a move`.

### Task 7: Docs, check, merge, deploy

- [ ] CLAUDE.md "Live" line and the spec list mention this spec; design spec's Moves/figure wording if it names New move.
- [ ] `git merge master`, `npm run check`, final whole-branch review (one reviewer), merge into master locally, `./scripts/deploy.sh`. No push.
