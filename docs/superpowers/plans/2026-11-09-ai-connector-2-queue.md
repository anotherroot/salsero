# AI connector, plan 2: the queue of actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo a slot builds **natively** (CLAUDE.md "Building in a slot"): per task only its specs + eslint/prettier on changed files; the full `npm run check` before the final review and again after merging master.

**Goal:** The connected AI proposes changes into a queue (grouped, ordered, some depending on others) and edits its own pending queue; nothing changes until the person runs actions on the new Suggestions page (option A), where each run goes through the same data functions as the app's forms, refuses what changed since it was proposed, and can be undone.

**Architecture:** Three new tables (`ai_groups`, `ai_actions`, `ai_lines`; never synced). A **line** is one unit of work of one **kind** (rename a move, add a section, publish…); an **action** is what the person sees as one card (one or many lines, e.g. "Typos in 12 names"); a **group** is a heading. Every kind is one object in a registry (`src/lib/server/ai-queue/kinds/`) with `parse`, `prepare` (access + the "before" snapshot at propose time), `run` and `undo`, each calling the existing data function the form calls. A runner applies a set of actions in queue order, one transaction per line, never stopping at a refusal. MCP write tools touch only the queue tables. The page reads a view model built on the server with `t()` words.

**Tech Stack:** SvelteKit 2.70, better-sqlite3 + Drizzle (synchronous), Vitest, the existing MCP module system (`src/lib/server/mcp/modules.ts`).

**Spec:** `docs/superpowers/specs/2026-11-09-ai-connector-design.md` (sections "The queue", "Groups", "Actions that depend on each other", "The AI edits its own queue", "Running", "The page"). Plan 1: `docs/superpowers/plans/2026-11-09-ai-connector-1-connector.md` (built, deployed). The look: artboard **A2** of https://claude.ai/artifact/FX91ZKLGWgo7cg9YWQUHCi.

## Global Constraints

- Nothing an MCP tool does writes a content table: every write tool writes only `ai_groups`, `ai_actions`, `ai_lines`. A spec walks every write tool and checks every other table's row count is unchanged.
- A run writes only through the data function the app's own form calls (the map below); never a raw update of a content row.
- Runs act as the person: `by`/`actorId` = the person's id; no "AI" mark anywhere others see (group History shows the person).
- Never synced: the three tables go in `NEVER_SYNCED`; `mintedId` + `_id_mark` triggers (as migration 0043); `/[dance]/suggestions` in `NETWORK_PAGES`.
- `serverNow()` only; instants are epoch ms.
- Words people read go through `t()`, en and sl (vikanje, » «; glossary: gib, figura, kombinacija, vaja, lekcija, položaj, odsek, skupina). Refusals on a line are stored as a code + arguments and worded at render time (the reader's language). Tool texts, tool results and server instructions are English.
- Caps: 50 lines per action, 500 pending lines per person, names ≤ 200 characters, notes ≤ 10 000.
- An action's lines run in order, each line its own transaction; a run never stops at a refusal; a refused line stays pending with its reason.
- Undo of a done line for 30 days while the values still equal what the run wrote; publish has no undo.
- No hard delete of the person's content through the queue; deletes happen only where Undo uses the form's own (a created section, a link).

## Review Focus

1. **Changed since proposed:** a group member edits the same figure's notes after the AI proposed a fix → the run refuses "changed since", writes nothing, the line stays pending (Task 4).
2. **Claude changed it under the person's eyes:** the page shows version 1, the AI changes the action to version 2, the person taps Run → refused, nothing written (Task 7).
3. **A dependency was dropped or refused:** "link section @4 to figure" after @4 was dropped → refuses "depends on…", Run all still runs the rest (Task 7).
4. **No right to edit:** a plain member's proposal on a group lesson, another dance's row, another person's id, or a right lost between propose and run → refused at propose with one line to the AI, and again at run (Tasks 3, 4).
5. **Two taps, two tabs:** the same action run twice at once → written once (the status is checked inside the line's transaction) (Task 7).

---

## The kinds (v1) and the functions they call

From the form map (all paths `src/lib/server/`). "Seen" = the field values the line will overwrite, captured at propose time and compared at run time (the meaning of `clash.ts` `checkSeen`, on just these keys; `null` and `''` equal). `flow` = call `flowAfter(userId, kind, id)` (`clones/flow-hook.ts`) after a successful run and undo.

| kind | payload | run | undo | flow |
|---|---|---|---|---|
| `rename_move` | `move_id, name` | `figureNameTaken` refusal, then `renameFigure(db, id, name, userId)` | `renameFigure` back | — |
| `edit_figure` | `figure_id, name?, notes?` | `updateVariation(db, id, {name, partner, style: styleTag, notes}, userId)` with the row's current partner/styleTag | the same with the before values | `figure` |
| `edit_routine` | `routine_id, name?, notes?` | `updateRoutine(db, id, {name, notes}, userId)` | back | `routine` |
| `edit_drill` | `drill_id, name?, notes?` | `updateExercise(db, id, {name, notes, active: row.active}, userId)`; a name only on `source==='custom'` (else refusal `notCustom`) | back | `drill` |
| `edit_lesson` | `lesson_id, title?, notes?` | `updateLesson(db, id, {lessonDay: row.lessonDay, title, notes}, userId)` | back | `lesson` |
| `edit_position` | `position_id, name?, notes?` | `updatePosition(db, id, {name, styleTag, hold, notes, pictureSpotId} from the row + changes, {actorId: userId, now})`; a `NameRefusal` → `nameTaken` | back | `position` |
| `edit_section` | `section_id, label?, start_ms?, end_ms?` | `updateSpot(db, id, changes, userId)`; `SpotError` → `badSpan` | back | `rootOfSpot` |
| `add_section` | `video: {lesson_video_id}\|{recording_id}, start_ms, end_ms, label` | `judgeVideo(...)` edit, `addSpot(db, owner, {startMs, endMs, label}, userId)` | `deleteSpot(db, id, userId)` (`SpotLinkedError` → `linked`) | `rootOfVideo`/`rootOfRecording` |
| `link_section` | `section_id\|ref, figure_id\|ref` or `drill_id\|ref` | `linkSpot(db, userId, spotId, target)` | `unlinkFromSection(db, spotId, linkId, false, now, userId)` | `rootOfSpot` |
| `link_lesson` | `lesson_id\|ref` + one of `figure_id, routine_id, drill_id, position_id` (each `\|ref`) | `linkFigure`/`linkRoutine`/`linkExercise`/`linkPosition` (lessons.ts) with `by` | the matching `unlink*` with `alsoSections=false` | `lesson` |
| `publish_lesson` | `lesson_id` | `publishLesson(db, teamSpace, id, now)`; an own lesson → `notGroup` | none (`canUndo: false`) | `lesson` |
| `create_figure` | `move_id\|ref` or `move_name`, `name, notes?, group_id?` | `createVariationIn(db, moveId, input, userId)` or `createFigure(db, space, {...input, figureName})` (refusal `nameTaken` on `variationNameTaken`/`figureNameTaken`) | `archiveVariation(db, id, now, userId)` | — |
| `create_drill` | `name, notes?, group_id?` | `createCustomExercise(db, space, {name, notes})` | `archiveExercise` | — |
| `create_routine` | `name, notes?, group_id?, slots: (figure_id\|ref)[]` | `createRoutine(db, space, {name, notes})` then `addFigureSlot` per slot, inside one `db.transaction` | `archiveRoutine` | — |
| `create_position` | `name, notes?, group_id?` | `createPosition(db, space, {name, styleTag: null, hold: empty, notes, pictureSpotId: null}, now)` | `archivePosition(db, id, now, {actorId})` | — |
| `create_lesson` | `title, day, notes?, group_id?` | `createLesson(db, space, {lessonDay: day, title, notes})` (a group's is a draft) | `archiveLesson` | — |
| `archive` | `thing: figure\|routine\|drill\|lesson\|position, id` | `archiveVariation`/`archiveRoutine`/`archiveExercise`/`archiveLesson`/`archivePosition` | `restoreVariation`/`restoreRoutine`/`restoreDrill`/`restoreLesson`/`restorePositionIn` (`(db, space, id, now)`) | — |
| `restore` | same | the restores | the archives | — |

Not in v1 (needs a later ruling): unlinking, removing slots, deleting sections, slot notes, retiming a figure, hold changes.

`group_id` on a create: null = the person's own; a group id = that group, only when the person is its owner or editor (`requireTeam`'s rule). A `ref` is `{ "ref": <action id> }`: the id the referenced action's one create line made; using one adds that action to `needs`.

---

### Task 1: The queue tables

**Files:** Modify `src/lib/server/db/schema.ts`, `src/lib/sync/tables.ts`, `src/lib/server/db/ids.spec.ts`; Create `drizzle/0044_*.sql` (+ appended triggers).

**Interfaces — Produces:**
- `aiGroups` / `ai_groups`: `id mintedId`, `userId text not null → users cascade`, `dance text not null`, `title text not null`, `sort integer not null`, `createdAt`, `updatedAt integer not null`; index `(user_id, dance)`.
- `aiActions` / `ai_actions`: `id mintedId`, `userId`, `dance`, `groupId integer not null → ai_groups cascade`, `sort integer not null`, `title text not null`, `grantId integer` (→ `oauth_grants`, `on delete set null`), `needs text not null default '[]'` (JSON action ids), `version integer not null default 1`, `previous text` (JSON `{title, lines}` before the AI's last change), `createdAt`, `updatedAt integer not null`; index `(user_id, dance)`.
- `aiLines` / `ai_lines`: `id mintedId`, `actionId integer not null → ai_actions cascade`, `sort integer not null`, `kind text not null`, `payload text not null` (JSON), `before text` (JSON, the overwritten fields at propose time), `status text not null default 'pending'` CHECK in `('pending','left_out','done','dropped','withdrawn','undone')`, `refusal text` (JSON `{code, args}`; set on a pending line a run refused), `result text` (JSON: created ids, the values written), `ranAt integer`, `undoneAt integer`; index on `action_id`.

- [ ] **Step 1:** Add the three to `ID_TABLES` and `NEVER_SYNCED`; run `npx vitest run src/lib/server/db/ids.spec.ts src/lib/sync/tables.spec.ts` — FAIL.
- [ ] **Step 2:** Schema, `npm run db:generate`, append the three `_id_mark` triggers (0043's shape); read the SQL (only new tables and indexes).
- [ ] **Step 3:** Run `npx vitest run src/lib/server/db src/lib/sync src/lib/server/sync` — PASS. Commit `feat(ai-queue): tables`.

### Task 2: The word diff

**Files:** Create `src/lib/ai-queue/diff.ts` (+spec). PURE, client-safe.

**Produces:** `type DiffPart = { text: string; op: 'same' | 'del' | 'ins' }`; `wordDiff(before: string, after: string): DiffPart[]` — tokens are words and the whitespace/punctuation runs between them; a longest-common-subsequence over tokens; adjacent parts of one op merged.

- [ ] **Step 1: tests.** `wordDiff('Ucili smos e slišati', 'Učili smo se slišati')` → `[{del:'Ucili smos e'},{ins:'Učili smo se'},{same:' slišati'}]` (merged across the spaces between changed words); `wordDiff('a b', 'a b')` → one `same`; `wordDiff('', 'x')` → one `ins`; `wordDiff('Exchibela', 'Exhibela')` → `del` then `ins`. Join of `same`+`ins` texts equals `after`, of `same`+`del` equals `before` (property over a few pairs).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): word diff`.

### Task 3: The queue store (no running)

**Files:** Create `src/lib/server/ai-queue/store.ts` (+spec), `src/lib/server/ai-queue/refs.ts` (+ spec).

**Interfaces — Produces:**
- `type Ref = { ref: number }`; `refsOf(payload: unknown): number[]` (every `{ref}` anywhere in a payload); `resolveRefs(payload, created: Map<number, number>): unknown | { missing: number }`.
- `type LineIn = { kind: string; [k: string]: unknown }`, `type ActionIn = { group: { id: number } | { title: string }; title: string; lines: LineIn[]; needs?: number[] }`.
- `type Refusal = { code: string; args?: Record<string, string | number> }` (codes listed in Task 9's words).
- `propose(db, who: Who, input: ActionIn, now): { ok: true; actionId: number } | { ok: false; message: string }` where `Who = { userId: string; dance: DanceSlug; grantId: number | null }`. Checks caps; resolves or creates the group (a new group goes last); each line through `KINDS[kind].parse` then `prepare` (Task 4); `needs` and refs must name the person's own pending-or-done actions created earlier (lower id) — no cycles by construction; stores lines with their `before`. `message` is one English line for the AI.
- `changeAction(db, who, id, change: { title?; lines?: LineIn[]; needs?: number[]; groupId?: number }, now)` — only while every line is `pending`/`left_out`; saves `previous`, bumps `version`, re-prepares the lines.
- `withdrawAction(db, who, id, now)` — pending lines → `withdrawn`.
- `moveAction(db, who, id, to: { groupId?: number; before?: number | null }, now)`; `setGroup(db, who, { id?: number; title: string; before?: number | null }, now)`; `removeGroup(db, who, id, now)` (withdraws its pending actions).
- `queueOf(db, userId, dance, now): QueueRow[]` — groups in order, each with actions in order and their lines; done/undone lines of the last 30 days; withdrawn hidden.
- Every write is one transaction and refuses another person's or another dance's ids with the same "No action with id n." line.

- [ ] **Step 1: tests** (on `makeWorld`, as u1, with a stub kind registered for the spec): propose into a new group, then a second action into it → order 1, 2; `needs: [later id]` refused; a ref to an action of u4 refused with the same text as a missing id; 51 lines refused; `changeAction` bumps version to 2 and keeps `previous.title`; `changeAction` after a line is done refused; `withdrawAction` hides it from `queueOf`; `moveAction` before another reorders; `removeGroup` withdraws its pending actions; u4 cannot touch u1's action.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): the queue store`.

### Task 4: The kind registry and the edit kinds

**Files:** Create `src/lib/server/ai-queue/kinds/index.ts`, `kinds/edit.ts` (+ `kinds/edit.spec.ts`), `src/lib/server/ai-queue/reach.ts` (+spec).

**Interfaces — Produces:**
- `reach.ts`: `editable(db, userId, dance, thing: 'move'|'figure'|'routine'|'drill'|'lesson'|'position'|'section', id): { row; space: Space } | null` — the row of that dance, `judge*`'s access `'edit'` (`judgeSpot` via `spotAccess` for a section), `space = spaceOfRow(row, userId)`; and `teamSpaceFor(db, userId, dance, groupId): TeamSpace | null` (owner or editor of a live group of that dance).
- `kinds/index.ts`:
  ```ts
  export interface LineKind<P> {
  	kind: string;
  	/** One English line for the AI, or the payload. */
  	parse(raw: Record<string, unknown>): Parsed<P>;
  	/** At propose: may the person do it, and the values it will overwrite. */
  	prepare(db: Db, who: Who, p: P): { ok: true; before: Record<string, unknown> | null } | { ok: false; message: string };
  	/** At run, inside a transaction; refs already resolved. */
  	run(db: Db, who: Who, p: P, before: Record<string, unknown> | null, now: number): { ok: true; result: Record<string, unknown> } | { ok: false; refusal: Refusal };
  	undo: null | ((db: Db, who: Who, p: P, result: Record<string, unknown>, now: number) => { ok: true } | { ok: false; refusal: Refusal });
  	/** flowAfter's kind and root id after run and undo, or null. */
  	flows(db: Db, p: P, result: Record<string, unknown>): { kind: CloneKind; id: number } | null;
  }
  export const KINDS: Record<string, LineKind<unknown>>;
  ```
- `kinds/edit.ts`: the seven edit kinds of the table, sharing one helper `fieldEdit({ thing, fields, read(row) → current values, write(db, who, id, values) })`. `run` refuses `changed` (with the field names) when the row's current values of the written fields differ from `before`, `gone` when `editable` is null (missing, archived, or no longer the person's to edit), then writes and returns `result = { after: values }`. `undo` refuses `changed` when current ≠ `result.after`, else writes `before`.

- [ ] **Step 1: tests** (`edit.spec.ts`, `makeWorld`): for each of the seven, propose-prepare + run as u1 writes through the data function (the group figure's change appears in `team_changes` with actor u1 and no other mark); a second edit of the same field by u2 between prepare and run → `changed`, row untouched; `prepare` as u3 (plain member) on a group figure → refused; `prepare` on u4's figure → the same text as a missing id; undo restores; undo after another change → `changed`; `edit_drill` name on a non-custom drill → `notCustom`; `rename_move` to a taken name → `nameTaken`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): edit kinds`.

### Task 5: Sections, lesson links, publish

**Files:** Create `kinds/sections.ts`, `kinds/links.ts`, `kinds/publish.ts` (+ specs); register in `kinds/index.ts`.

**Produces:** `add_section`, `link_section`, `link_lesson`, `publish_lesson` per the table. `add_section` refuses `badSpan` for `end_ms <= start_ms` or past the video's duration when known; `link_section` refuses `notSection` for a point. `publish_lesson.undo = null`.

- [ ] **Step 1: tests:** add a section on u1's lesson video, undo removes it; on a group draft video as owner u1 → in the group's trash-able state as the form does; link a section to a figure and undo; `link_lesson` with a drill on a published group lesson calls the GROWTH path (a member's entry appears, as `auto-add.spec.ts` checks); publish the group draft as u1 → `published_at` set, members' Today gets its drills; publish as u3 → refused at prepare; publish an own lesson → `notGroup`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): sections, links, publish`.

### Task 6: Creates, archive, restore

**Files:** Create `kinds/create.ts`, `kinds/archive.ts` (+ specs); register.

**Produces:** the five `create_*`, `archive`, `restore` per the table. A create's `result` is `{ id }` (and `moveId` for a figure in a new move), the id refs resolve to. `create_routine`'s slots and the routine are one transaction: a slot whose figure is not usable (`usableOf`) refuses the whole line `badSlot`.

- [ ] **Step 1: tests:** create a figure in a new move, and one in an existing move; create in group 1 as owner u1 (row's `team_id` set, History shows u1); create in a group as u3 → refused at prepare; create a routine with two slots; undo of each create archives it; archive then undo restores; restore of a row that is not archived → `notArchived`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): creates, archive, restore`.

### Task 7: The runner

**Files:** Create `src/lib/server/ai-queue/run.ts` (+spec).

**Interfaces — Consumes:** `KINDS`, `refs.ts`, the store's rows. **Produces:**
- `runActions(db, who, ids: number[], versions: Record<number, number>, now): RunReport` — `RunReport = { done: number[] /* line ids */; refused: { lineId: number; refusal: Refusal }[] }`. Order: queue order of `ids`; an action whose `needs` are in the set and still pending is postponed until they ran (loop until no progress; whatever is left refuses `waits`). Per action: `versions[id] !== version` → every pending line refuses `claudeChanged`, nothing runs. A `needs` action dropped, withdrawn or refused → `dependsOn` (args: its number). Per line (`pending` only, `left_out` skipped): one `db.transaction` that re-reads the line's status (another run may have taken it), resolves refs from done lines' `result.id` (missing → `dependsOn`), calls `run`, writes `status='done'`, `result`, `ranAt`, clears `refusal`; a refusal is stored on the line and the line stays pending. After the transaction, `flowAfter` for `flows(...)` (awaited, never throws).
- `actionsUpTo(db, who, id): number[]`, `actionsOfGroup(db, who, groupId): number[]`, `allPending(db, who): number[]` — in queue order, pending only.
- `dropActions(db, who, ids, withDependents: boolean, now): { dropped: number[]; dependents: number[] }` — `withDependents=false` and some pending action needs one of them → nothing dropped, `dependents` named (the page then asks).
- `toggleLine(db, who, lineId, now)` — `pending` ↔ `left_out`.
- `undoLines(db, who, lineIds, now): RunReport` — reverse order; a line whose kind has `undo: null`, or older than 30 days → `noUndo`/`tooLate`; success → `status='undone'`, `undoneAt`.

- [ ] **Step 1: tests:** run all with three actions where the second refuses → first and third done, second pending with its refusal; `versions` stale for one action → only it refused `claudeChanged`; a `link_section` with a ref to an `add_section` in the same run → runs after it, the link's `spot_id` is the new section; the ref'd action dropped → `dependsOn`; `dropActions` without dependents names them, with → drops both; the same action run twice in a row → second run writes nothing (`done` already) and reports nothing refused; undo of a publish → `noUndo`; undo after 31 days → `tooLate`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, commit `feat(ai-queue): the runner`.

### Task 8: The AI's tools for the queue

**Files:** Create `src/lib/server/mcp/queue.ts` (+spec); register `queueTools` in `modules.ts`; modify `src/lib/mcp/protocol.ts` `INSTRUCTIONS`.

**Produces:** `queueTools: ToolModule`, annotations `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false` except `queue` (read: `true, false, true, false`):
- `queue` — the queue as `queueOf` gives it, compact: groups, actions (`id`, `n`, `title`, `status` derived: pending/partly done/done/dropped, `version`, `needs`), lines (`id`, `kind`, payload, `status`, `refusal` as `{code, args}`, `before`).
- `propose` — `{ group_id? | group_title?, title, lines, needs? }` → `{ action_id, n }`; each line's schema in the tool description (the table's payloads, refs as `{"ref": <action_id>}`).
- `change_action` `{ id, title?, lines?, needs?, group_id? }`, `withdraw_action` `{ id }`, `move_action` `{ id, group_id?, before_id? }`, `set_group` `{ id?, title, before_id? }`, `remove_group` `{ id }`.
- `INSTRUCTIONS` gains: "You can now propose changes. Nothing changes until the person runs them in the app (Suggestions). Put related changes in one action (one card: \"Typos in 12 names\"), in groups the person can run at once; propose only what is worth their time. Fix spelling and typos only, in the person's own words (see vocabulary), unless they ask for nicer wording. Use needs or {\"ref\": id} when one action needs another. When the person tells you something is wrong, change or withdraw your own pending actions; you cannot touch what they ran or dropped." Remove "This version reads only; it cannot change anything."

- [ ] **Step 1: tests:** every write tool, called on `makeWorld` as u1 with valid input, changes the row count of no table but the three queue tables (count every table in `sqlite_master` before and after); `propose` with an unknown kind → one line naming the kinds; a line the person cannot do → the kind's `prepare` message; tool defs' annotations as above, `additionalProperties: false`; `host.spec`'s "no clashes" still passes.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS (plus `src/lib/mcp`), commit `feat(ai-queue): MCP tools for the queue`.

### Task 9: The page's server side and words

**Files:** Create `src/routes/[dance]/suggestions/+page.server.ts`, `suggestions.spec.ts`; `src/lib/server/ai-queue/view.ts` (+spec); `src/lib/i18n/{en,sl}/suggestions.ts` registered in both `index.ts`; modify `src/lib/types.ts` (the view types), `src/lib/offline/routes.ts` (`NETWORK_PAGES` `'/[dance]/suggestions'`), `src/routes/[dance]/+layout.server.ts` (`aiPending: number`), `src/lib/nav/tabs.ts` (`tabDot('you')` while `aiPending > 0`, and its label).

**Interfaces — Produces (`src/lib/types.ts`):**
```ts
export interface SuggestionGroup { id: number; title: string; actions: SuggestionAction[] }
export interface SuggestionAction {
	id: number; n: number; title: string; version: number;
	/** "Claude changed this … ago", with the earlier version's title, when the AI changed it. */
	changed: { when: string; previousTitle: string } | null;
	state: 'pending' | 'partly' | 'done' | 'dropped';
	waitsFor: number[]; /* the n of pending needs */
	lines: SuggestionLine[];
}
export interface SuggestionLine {
	id: number; status: 'pending' | 'left_out' | 'done' | 'dropped' | 'undone';
	/** Built by the app from the payload, never the AI's words. */
	heading: string; where: string | null; /* "Salsa Ljubljana will see this" for a group row */
	fields: { label: string; parts: DiffPart[] }[];
	section: { src: string; startMs: number; endMs: number } | null;
	warning: string | null; /* publish: can't be undone */
	refusal: string | null; canUndo: boolean;
}
```
- `suggestionsView(db, userId, dance, now): SuggestionGroup[]` (Task 3's `queueOf` + `t()` words + `wordDiff`); `pendingCount(db, userId, dance): number`.
- Actions (one-tap, JSON `{ok, report}` or `fail` with a `t()` message): `run` (`ids[]`, `versions` JSON), `runUpTo` (`id`, `versions`), `runGroup` (`id`, `versions`), `runAll` (`versions`), `drop` (`id`, `withDependents`), `dropAll`, `toggleLine` (`lineId`), `undo` (`lineIds[]`).
- Words (`t().suggestions`, en / sl): title "Suggestions" / »Predlogi«; youRow "AI suggestions" / »Predlogi AI«, `waiting(n)` "{n} waiting" / slCount »{n} čaka«; run "Run" / »Izvedi«; runN(n) "Run {n}" / »Izvedi {n}«; upToHere "Up to here" / »Do tukaj«; runGroup "Run group" / »Izvedi skupino«; runAll(n) "Run all · {n}" / »Izvedi vse · {n}«; drop "Drop" / »Zavrzi«; dropAll "Drop all" / »Zavrzi vse«; alsoDrop(n) "{n} more need it. Drop them too?" / »Še {n} jih potrebuje. Jih zavržem tudi?«; leftOut "left out" / »izpuščeno«; changedBy(who, when) "{who} changed this {when}" / »{who} je to popravil {when}«; earlier "Earlier" / »Prej«; doneToday(n) "Done today · {n}" / »Izvedeno danes · {n}«; undo "Undo" (`common.undo`); waits(n) "Waits for {n}" / »Čaka na {n}«; publishWarning "Can't be undone: the group sees it at once, and its drills go to their Today." / »Tega ni mogoče razveljaviti: skupina jo vidi takoj, vaje gredo na njihov Danes.«; groupSees(name) "{name} will see this" / »To bo videla skupina {name}«; empty "Nothing waiting. Ask your AI app to suggest something." / »Nič ne čaka. Prosite svojo aplikacijo AI, naj kaj predlaga.«; a heading per kind ("Rename move", "Figure", "Routine", "Drill", "Lesson", "Position", "Section", "New section {from}–{to}", "Link {section} to {target}", "Add {thing} to the lesson", "Publish {lesson}", "New figure {label}", "New drill", "New routine", "New position", "New lesson", "Archive {thing}", "Restore {thing}") and per refusal code (`changed`, `gone`, `notAllowed`, `nameTaken`, `notCustom`, `badSpan`, `linked`, `notSection`, `notGroup`, `badSlot`, `notArchived`, `waits`, `dependsOn`, `claudeChanged`, `noUndo`, `tooLate`) in both languages; the builder writes the Slovenian with the glossary and checks it in `no-english`/`refusals-guard`.

- [ ] **Step 1: tests** (`suggestions.spec.ts` with the mocked db, `view.spec.ts`): load lists the groups and a line's diff parts; a group row's line has `where`; `run` with a stale version → the action refused, others ran; `drop` with dependents and `withDependents` absent → `fail` naming them; another person's action id → 404; `aiPending` in the layout data and `tabDot('you', {aiPending: 2})` true.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS plus `src/lib/i18n` and `src/lib/offline`, commit `feat(ai-queue): the Suggestions page's data and words`.

### Task 10: The page (option A2), the You row, live refresh

**Files:** Create `src/routes/[dance]/suggestions/+page.svelte`, `src/lib/components/suggestions/{SuggestionCard,DiffText,SectionPreview}.svelte`; modify `src/routes/[dance]/you/+page.svelte` (the row at the top when `aiPending > 0` or a grant exists), `src/routes/dev/kit` (the three components, dev only).

The look is artboard A2, in the app's own components and tokens (light and dark come from `tokens.ts`): the band "Predlogi" with Back and the subtitle "Claude · {n} waiting"; group headings (Bricolage 20/800) with "Run group"; a card per action: the number chip, the title, the "where" chip for a group, the lines (ticks for a batched action, `DiffText` for fields: del = danger-tinted strike, ins = done-tinted bold), `SectionPreview` (the video looping the stretch, the stretch drawn dashed on its seek bar, using `SectionPlayer`/`VideoFrame` as the section cards do), the publish warning, a refusal banner, "Claude changed this …" with Earlier; the buttons Drop · Up to here · Run (a waiting card shows "Waits for 4" instead of Run, and hangs under what it needs with a rail); "Done today · n" with Undo per done action; a fixed bar "Drop all · Run all · n". After a run, a toast with Undo for the lines just run (`undoToast`, `focusAfterRemoval`). Drop with dependents opens a sheet (`Sheet`, never `confirm()`): "{n} more need it. Drop them too?" with Drop all of them / Cancel. While the page is visible it reloads its data every 5 s (`invalidate`, paused when hidden), so a desktop tab fills while the AI works. One-tap forms with `use:enhance` posting to explicit action URLs.

- [ ] **Step 1:** Screenshot scene `scripts/shots/ext_suggestions.py` (a queue seeded through `propose` in a `placeholders` hook or a seed): the page light and dark at 390×844 and 1440×900; compare with A2 and send to the phone with the board link before merging. (No unit test for markup; `no-english.spec` and `class-rules.spec` cover the words and classes.)
- [ ] **Step 2:** Implement. **Step 3:** `npx vitest run src/lib/i18n src/lib/components src/lib/nav` PASS; the scene shoots; commit `feat(ai-queue): the Suggestions page`.

### Task 11: Docs, check, review

- [ ] **Step 1:** `docs/layout.md` (`src/lib/server/ai-queue/`, `src/lib/ai-queue/`, the page), `docs/hard-rules.md` + CLAUDE.md (a write tool touches only the queue tables; a run goes through the form's data function, as the person), `docs/features.md` (plan 2), spec status line "Plans 1–2 built", `PAGE_EPOCH` unchanged (no old page sends anything new).
- [ ] **Step 2:** `npm run check` — PASS.
- [ ] **Step 3:** One review of the branch (most capable model) with this plan's Review Focus. Fix, re-run, commit.
- [ ] **Step 4:** Merge master in, `npm run check`, hand back for the merge, backup and deploy (migration 0044).
