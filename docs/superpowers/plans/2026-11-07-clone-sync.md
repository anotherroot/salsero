# Keeping Copies in Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copies of one thing keep in step by themselves after every save (Keep in step, per copy, on by default), and one Sync sheet merges every copy and sends the result to all the copies the person edits; the page and the Moves list say whenever copies disagree.

**Architecture:** A per-copy **mark** (hash per field after its last save or flow) tells what a save changed; `flowFrom` walks the family from the saved row, one hop per transaction, through `landKeys` (the write half of today's `syncFrom`, with a partial snapshot). A PURE N-way merge (`merge.ts`) feeds the Sync sheet, which replaces Compare, Take and Send mine. Status (`stepStatus`) feeds one notice per page and a card on the Moves lists.

**Tech Stack:** SvelteKit 2 + Svelte 5, SQLite via Drizzle (better-sqlite3, synchronous transactions), Vitest, Tailwind 4, the shots rig (Playwright).

**Spec:** `docs/superpowers/specs/2026-11-07-clone-sync-design.md` (read it whole). It amends `2026-11-03-clones-and-twins-design.md`, `2026-11-06-merge-sheets-and-update-bubbles-design.md` and `2026-11-06-versions-and-menu-design.md`. Mockups the user picked: https://claude.ai/artifact/TWB4xPndeGFrxvov2Boxh3 (1A, 2A, 3A, 4A + 4b A, 5A).

## Global Constraints

- Every hard rule in `CLAUDE.md` applies; these bite here:
- Additive migrations only: new tables, never a CHECK added to an existing table, never a rebuild. Read the generated SQL before committing it.
- Data functions take `db` first; specs use `openDb(':memory:')`; a spec never touches `$DATA_DIR`.
- Every instant is epoch ms (`now` is an argument; no `Date.now()` in PURE modules).
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- Every group mutation logs `logChange` with a real actor in its transaction and is listed in `MUTATIONS` (`src/lib/server/changes.spec.ts`); Keep in step's settings are **exempt** (a setting, not content; `team_changes.verb` has a CHECK and cannot grow).
- A write into a group row that can grow a published lesson calls `autoAddPending` (listed in `GROWTH`, `auto-add.spec.ts`); one that can shrink reach calls `reconcileEntries`. `crossRefs` and `familyIntegrity` stay `[]` in every new spec that changes rows.
- Every read of a row goes through `access.ts` / `accessTo`; another person's own copy is never shown, counted or named to someone else.
- A form someone fills in uses `use:guarded`; one-tap forms stay on `use:enhance`. Colours come from builders (`ui/styles.ts`), never appended classes.
- Raise `PAGE_EPOCH` (now 6) to 7 in the commit that removes the take/keep/send actions.
- Words, exactly: "Keep in step"; "Your edits go to the clubs, theirs come here"; options "Names", "Small removals" (meta "Links, positions, songs"), "Sections and points" (meta "Adding or removing them"), "Recordings and videos" (meta "A removal from yours can't be undone"); the Versions line "Keeps in step · names, small removals" / "Not kept in step"; the notice title "Your copies don't agree", button "Sync"; the sheet title "Sync <figure label>", button "Sync N copies"; the reader's sheet "Update from <club>", button "Update mine", line "Your own change to <field> stays."; the Moves card "N figures out of sync" / "Your copies and the clubs' don't agree" (routines/positions: "N routines …", "N positions …"); a row's meta "N copies differ"; same names drawn "Basic · Sreda 17:30".
- Defaults: switch on; names on; small removals on; sections and points off; recordings and videos off.

## Review Focus

1. **An open form across a flow.** A person has their copy's edit form open, a club edit flows into it, they save without touching that field: the save is refused as a clash, never writes the old value back. (Test in Task 5.)
2. **A ping-pong.** Two copies both switched on, a save on one: the other is written once and nothing comes back to the first (visited set, marks updated after each hop). (Task 4.)
3. **A suffixed old copy.** "Basic (Sreda 17:30)" against the club's "Basic": no notice, no Moves mark, never pushed back by a save; Sync offers the plain name. (Tasks 4, 9, 8.)
4. **The first save after deploy.** Copies that already differ (timing changed a week ago) and a person edits only the notes: only the notes flow; the timing difference stays in the notice. (Task 4.)
5. **A reader's copy.** A member who only reads the club's copy edits their own: nothing reaches the club; the club's next edit flows in only on fields they did not change. (Task 4.)

---

### Task 1: Settings and the PURE flow rules

**Files:**
- Create: `src/lib/clones/sync.ts`, `src/lib/clones/sync.spec.ts`
- Create: `src/lib/server/clones/sync-settings.ts`, `src/lib/server/clones/sync-settings.spec.ts`
- Modify: `src/lib/server/db/schema.ts` (two tables), `src/lib/types.ts` (`SyncSettings`)
- Create: `drizzle/0034_*.sql` (generated)

**Interfaces:**
- Produces (types.ts): `type SyncSettings = { on: boolean; names: boolean; small: boolean; sections: boolean; media: boolean }`
- Produces (`sync.ts`, PURE): `DEFAULT_SYNC: SyncSettings`; `type KeyClass = 'name' | 'small' | 'sections' | 'media' | 'always'`; `classOf(key: string, removal: boolean): KeyClass`; `allows(s: SyncSettings, key: string, removal: boolean): boolean`; `changedKeys(mark: Record<string, string> | null, flat: Flat, hash: Hash): string[]`; `flowKeys(saved: string[], pair: FieldDiff[], into: SyncSettings): string[]`; `suffixOnly(d: FieldDiff): boolean`.
- Produces (`sync-settings.ts`): `syncSettingsOf(db, kind: CloneKind, id: number): SyncSettings`; `setSyncSettings(db, actorId: string, kind, id, s: SyncSettings, now): boolean` (false unless `accessTo(...) === 'edit'`).
- Schema: `clone_sync(kind text, row_id int, on int, names int, small int, sections int, media int, at int, pk(kind,row_id))`; `clone_marks(kind text, row_id int, fields_json text, at int, pk(kind,row_id))`. No CHECKs needed; kinds validated in the data functions.

- [ ] **Step 1: Write the failing tests** (`sync.spec.ts`)

```ts
it('classes keys', () => {
  expect(classOf('name', false)).toBe('name');
  expect(classOf('title', false)).toBe('name');
  expect(classOf('notes', false)).toBe('always');
  expect(classOf('link:https://x', false)).toBe('always');      // an addition of a small thing
  expect(classOf('link:https://x', true)).toBe('small');
  expect(classOf('start:g1', true)).toBe('small');
  expect(classOf('rec:g2:spot:s1:links', true)).toBe('small');
  expect(classOf('rec:g2:spot:s1', false)).toBe('sections');
  expect(classOf('video:g3:spot:s1', true)).toBe('sections');
  expect(classOf('rec:g2', false)).toBe('media');
  expect(classOf('rec:g2:note', false)).toBe('always');
});
it('defaults carry names and small removals, not sections or media', () => {
  expect(allows(DEFAULT_SYNC, 'name', false)).toBe(true);
  expect(allows(DEFAULT_SYNC, 'link:a', true)).toBe(true);
  expect(allows(DEFAULT_SYNC, 'rec:g:spot:s', false)).toBe(false);
  expect(allows(DEFAULT_SYNC, 'video:g', true)).toBe(false);
  expect(allows({ ...DEFAULT_SYNC, on: false }, 'notes', false)).toBe(false);
});
it('changedKeys: none without a mark; keys whose hash moved, added or gone', () => { /* mark {notes:h('a'),timing:h('8')}, flat notes 'b', timing '8', link:x → ['link:x','notes'] sorted; null mark → [] */ });
it('flowKeys takes only what this save changed and the receiver did not', () => {
  // pair is diff(base, into's flat as mine, giver's flat as theirs)
  // saved = ['notes','timing']; pair: notes side 'theirs', timing side 'both', partner side 'theirs'
  expect(flowKeys(['notes', 'timing'], pair, DEFAULT_SYNC)).toEqual(['notes']);
});
it('a name differing only by a copy suffix never flows', () => { /* into 'Basic (Sreda 17:30)', giver 'Basic', side 'theirs' → [] ; suffixOnly true */ });
```

- [ ] **Step 2: Run** `npx vitest run src/lib/clones/sync.spec.ts` — FAIL (module missing).
- [ ] **Step 3: Implement `sync.ts`.** `classOf` reads `NAME_KEYS`, `pieceParts`, `setPrefixOf` from `flat.ts`/`diff.ts`: a piece's presence (`part: 'piece'`) is `media`; a `spot` part is `sections`; `links` parts and set members are `small` when `removal`, else `always`; anything else `always`. `suffixOnly` uses `isCopySuffix` on `name`/`title` in either direction.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Schema + migration.** Add both tables to `schema.ts`; `npm run db:generate`; read the SQL (two `CREATE TABLE`, nothing else).
- [ ] **Step 6: Tests for `sync-settings.ts`:** a missing row reads `DEFAULT_SYNC`; `setSyncSettings` by the owner writes and reads back; by a group's plain member returns false and writes nothing; by a group editor on the group's row writes.
- [ ] **Step 7: Implement, run, commit** `feat(clones): Keep in step settings and the flow rules`.

### Task 2: Marks

**Files:**
- Create: `src/lib/server/clones/marks.ts`, `marks.spec.ts`
- Modify: `src/lib/server/clones/clone.ts` (`cloneTx` marks both members), `src/lib/server/db/bootstrap.ts` (one-time step)

**Interfaces:**
- Consumes: `changedKeys` (Task 1), `flatOf`, `hashValue`, `familyRows`.
- Produces: `readMark(db, kind, id): Record<string, string> | null`; `writeMark(tx, kind, id, flat: Flat, now)`; `markNow(tx, kind, id, now)` (= `writeMark` of `flatOf`); `markFamilies(db, now): { ran: boolean; marked: number }` (an `app_flags` marker `clone-marks-1`; marks every live row whose gene has more than one live member).

- [ ] **Step 1: Failing tests:** `markNow` then `readMark` returns `{key: hash(value)}` for the row's flat; `markFamilies` marks the two members of a copied figure and not a lone figure, and a second run returns `{ ran: false }`; after `cloneTx` (Copy to… a group) both the source and the copy have marks equal to their flats.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; call `markFamilies(getDb(), Date.now())` in `bootstrap.ts` beside `nameLinkedSpots`, logging the count; in `cloneTx`, `markNow` for the source and the new member inside its transaction (and for each copied piece's root only; pieces have no marks).
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(clones): marks, what a copy held after its last save`.

### Task 3: `landKeys`, the write half of `syncFrom`

**Files:**
- Modify: `src/lib/server/clones/apply.ts`
- Test: `src/lib/server/clones/apply.spec.ts` (existing must still pass; add two)

**Interfaces:**
- Produces: `landKeys(db, o: { actorId: string; kind: CloneKind; intoId: number; fromId: number; keys: string[]; snapshot: 'full' | 'keys'; files: CloneFiles; now: number; freeDiskBytes: number; seen?: string }): Promise<SyncResult>` — the room check, file links, then one transaction: (re-check `seen` when given), `applyInto`, the pair snapshot, `markNow(intoId)`, and for a group target `logChange` by `actorId`, `reconcileEntries` on removals, `autoAddPending` for a lesson. `snapshot: 'full'` is today's `nextBase`; `'keys'` updates only `keys` in the existing base (`fields[key] = hash(from value)`, deleted when the giver lacks it) and creates no pair when none exists.
- `syncFrom` keeps its signature and becomes access checks + picks + `landKeys(..., snapshot: 'full', seen)`.

- [ ] **Step 1: Failing tests:** a `'keys'` landing of `['notes']` into a copy whose timing also differs leaves `pairBase(...).fields.timing` unchanged and `notes` equal to the giver's hash; `readMark(into)` equals the target's flat after.
- [ ] **Step 2: Run** — FAIL. **Step 3: Extract and implement.** **Step 4:** `npx vitest run src/lib/server/clones` — all PASS (existing Take/Send specs unchanged).
- [ ] **Step 5: Commit** `refactor(clones): landKeys, shared by Take, Send and the flow`.

### Task 4: The flow

**Files:**
- Create: `src/lib/server/clones/flow.ts`, `flow.spec.ts`
- Modify: `src/lib/server/changes.spec.ts` (`MUTATIONS`: the flow into a group's copy), `src/lib/server/auto-add.spec.ts` (`GROWTH` reason, if its scan finds a new insert site)

**Interfaces:**
- Consumes: Tasks 1–3, `familyRows`, `accessTo`, `pairBase`, `diff`.
- Produces: `type FlowReport = { landed: number[]; refused: { id: number; reason: string }[] }`; `flowFrom(db, actorId: string, kind: CloneKind, id: number, files: CloneFiles, now: number, freeDiskBytes: number): Promise<FlowReport>`.

Algorithm (state it in the module comment): `saved = changedKeys(readMark(id), flatOf(id))`; no mark → `markNow`, return empty; `markNow(id)`; stop when `saved` is empty or `id`'s switch is off. Queue `[(id, saved)]`, `visited = {id}`. For a node X and its keys: every live family member Y (`familyRows`, not only what the actor sees) not visited, with a pair snapshot with X, Y's switch on, and the write allowed (Y a group's: `accessTo(actorId, Y) === 'edit'`; Y a person's own: `accessTo(Y.owner, X) !== null`). `keys = flowKeys(nodeKeys, diff(pairBase(X,Y), flatOf(Y), flatOf(X)), settingsOf(Y))`. Empty → skip. `landKeys({ actorId: Y group ? actorId : Y.owner, intoId: Y, fromId: X, keys, snapshot: 'keys' })`; refused → into `refused`, not queued; landed → `visited.add(Y)`, enqueue `(Y, keys)`.

- [ ] **Step 1: Failing tests** (build the family with `cloneTx`; owner U1 with own figure F, groups G1 (U1 owner) and G2 (U1 owner), member U2 of G1 who has Make it mine copy F2):
  - `option A`: F and G1's copy differ on timing (set before marks); U1 edits F's notes; `flowFrom` → G1's notes equal F's, G1's timing unchanged.
  - `both changed`: G1's copy and F both change notes since the snapshot; F's flow leaves G1's notes.
  - `chain`: U1 edits F → G1's copy → U2's F2 (F2's switch on, U2 reads G1) all hold the new notes; G2's copy too; each written once (`landed` has no duplicate).
  - `no ping-pong`: after the flow, `flowFrom` on G1's copy as U1 lands nothing.
  - `reader pulls only`: U2 edits F2's notes; `flowFrom(U2, F2)` lands nothing in G1.
  - `switch off`: F2's switch off → U1's flow skips F2; F's switch off → nothing leaves F.
  - `options`: F removes a link → lands in G1 (small removals on); F adds a recording → not in G1 (media off) until G1's `media` is on.
  - `suffix`: F2 named "Basic (Sreda 17:30)"; U2 edits F2's notes → G1's name unchanged.
  - `refused hop`: a section removal meeting a linked section in G1 (sections on) → `refused` has G1, G2 still landed.
  - `history`: G1's landing logged one `change` by U1; `crossRefs(db)` and `familyIntegrity(db)` are `[]`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/lib/server` — PASS (MUTATIONS/GROWTH lists updated).
- [ ] **Step 5: Commit** `feat(clones): Keep in step, the flow after a save`.

### Task 5: Hooking the saves, and `seen` on copies

**Files:**
- Create: `src/lib/server/clones/flow-hook.ts`, `flow-hook.spec.ts`
- Modify: the actions of `src/routes/[dance]/(moves)/figures/[id]/+page.server.ts`, `routines/[id]`, `positions/[id]`, `src/routes/[dance]/lessons/[id]/+page.server.ts`, `songs/[id]`, `(today)/exercises/[id]`; the flat routes that change a copy's pieces: `src/routes/api/video-spots/**`, `api/figures/[id]/recordings`, `api/lessons/[id]/videos/**` (builder: grep for every POST/PUT/DELETE that writes a recording, video, spot, spot link, link or tag)
- Modify: `src/lib/server/clash.ts` (`seenRefusal`'s `team` → `required`), its callers, `src/lib/page-epoch.ts` is NOT raised here (Task 8 does)

**Interfaces:**
- Produces: `flowing<A extends Actions>(kind: CloneKind, rootOf: (event) => number | null, actions: A): A` — wraps each action: runs it; on a non-failure result (`isActionFailure`) or a thrown `redirect`, calls `flowAfter(event.locals.user.id, kind, rootOf(event))`, then returns/rethrows. `flowAfter(actorId, kind, id: number | null): Promise<void>` (getDb, the real `CloneFiles`, `Date.now()`, free disk; never throws into the response: logs). `rootOfSpot(db, spotId)`, `rootOfVideo`, `rootOfRecording` → `{ kind, id }` for the flat routes.
- Produces: `hasCopies(db, kind, id): boolean` (another live member exists) in `genes.ts`.

- [ ] **Step 1: Failing tests:** `flowing` calls the flow after a passing action and after a `redirect`, never after `fail(...)`; a spec (`flow-hook.spec.ts`, file scan like `class-rules.spec.ts`) lists the six item pages and the flat routes and asserts each wraps its actions in `flowing(` or calls `flowAfter(`.
- [ ] **Step 2: Failing test (Review Focus 1):** U1's figure F with a G1 copy; take `variationSeen(db, F)` as the form saw it; flow a G1 notes change into F; post `update` with the old `seen` and only the name changed → 409 `clash` naming `notes`; F's notes still G1's.
- [ ] **Step 3: Implement**; every `seenRefusal(form, row.teamId !== null, …)` becomes `seenRefusal(form, row.teamId !== null || hasCopies(db, kind, row.id), …)`; check each item page's load sends `seen` for own rows (add where missing).
- [ ] **Step 4: Run** `npx vitest run` — PASS. **Step 5: Commit** `feat(clones): every save on a copy flows, and checks seen`.

### Task 6: Same names

**Files:**
- Modify: `src/lib/server/clones/clone.ts` (`freeName`, `freePositionName`: keep the name), `apply.ts` (a name landing never refuses on a sibling copy), `src/lib/server/figures.ts` / positions' save paths (refuse a typed name only when it changed and is taken), `src/lib/server/moves-lists.ts`, `src/lib/picker/build.ts`, `src/lib/moves/*.ts`
- Create: `src/lib/clones/from-tag.ts`, `from-tag.spec.ts`

**Interfaces:**
- Produces: `fromTags<T extends { id: number; name: string; from: string | null }>(rows: T[]): Map<number, string>` — for rows of one list (a move's figures, the positions list) whose folded names collide, each row with `from` gets `"· " + from`; `shownName(row, tags): string` → `"Basic · Sreda 17:30"`. Row types gain `from: string | null` (the place of `cloned_from` when the person reads it and it is not the row's own place; builder: compute in the list loaders).

- [ ] **Step 1: Failing tests:** two "Basic" in one move, one copied from Sreda 17:30 → that one reads "Basic · Sreda 17:30", the other "Basic"; a lone "Basic" copy reads "Basic"; Copy to… a place whose move already has "Basic" lands a second "Basic" (no suffix, no refusal); the figure page's `update` on your own "Basic" (name unchanged, notes changed) succeeds beside the copy; typing a rename to a taken name is still refused.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS). Moves are untouched (`moveFor` still joins the same-named move).
- [ ] **Step 5: Commit** `feat(clones): copies keep their names; the screen says where from`.

### Task 7: The N-way merge (PURE)

**Files:**
- Create: `src/lib/clones/merge.ts`, `merge.spec.ts`; types in `src/lib/types.ts`

**Interfaces:**
- Produces: `type MergeValue = { hash: string | null; field: FlatField | null; holders: number[]; changed: boolean }`; `type MergeRow = { key: string; label: string; values: MergeValue[]; pick: string | null | undefined; kind: 'field' | 'add' | 'remove' }` (`pick` is a value's `hash`, `null` meaning "absent", `undefined` meaning open); `mergeRows(members: { id: number; flat: Flat }[], pairs: { a: number; b: number; at: number; base: PairBase }[], hash: Hash, page: SyncSettings): MergeRow[]`; `mergeTargets(rows: MergeRow[], picks: Record<string, string | null>, flats): Map<number, { giver: number; keys: string[] }[]>`.

Rule (module comment): a key's **agreed** hash is the base value of the most recent pair (by `at`) among the members that holds the key in `base.fields` or lists it absent; no pair → no agreed value. A value is `changed` when it differs from the agreed one. One changed value → `pick` it; two or more changed values, or no agreed value and two values → open (`undefined`). A piece present on some members only: `kind 'add'` when the agreed state is absent, `'remove'` when present; `pick` starts on "keep" (present) for a removal; an `add` row of a section, point, recording or video starts ticked only when the page's own copy has that option on (the spec's "the options set the boxes' defaults"); every other `add` starts ticked. `mergeRows` takes the page's `SyncSettings` as a fourth argument for this. Name rows where one value is the other plus a copy suffix pick the plain name. Rows ordered as `diff` orders keys.

- [ ] **Step 1: Failing tests (a table):** three members, the teacher's own (T) with pairs T–G1 and T–G2 only: G1 changed timing → one row, pick G1's; T changed notes → pick T's; G1 and G2 both changed partner differently → open; T and G1 never in step and differ → open; T added a recording → `add`, ticked; G1 removed a link → `remove`, pick keep; "Basic (Sreda 17:30)" vs "Basic" → pick "Basic".
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(clones): the N-way merge`.

### Task 8: Sync, server side (replaces Compare, Take, Send)

**Files:**
- Create: `src/lib/server/clones/sync.ts`, `sync.spec.ts`; `src/routes/api/clones/sync/+server.ts` (GET preview)
- Modify: `src/lib/server/take-form.ts` (`syncFromForm`), the six item pages' actions (`sync`; remove `take`, `keepMine`, `send`), delete `src/routes/api/clones/compare`, `api/clones/send`, `compare.ts`, `send.ts`'s `sendPreview`/`sendMine` (keep `familyStatus` if Task 9 uses it), and their specs' now-dead cases; `src/lib/page-epoch.ts` → 7
- Modify: `changes.spec.ts` `MUTATIONS` (`syncAll` into a group's copy)

**Interfaces:**
- Produces (types.ts): `type SyncView = { title: string; rows: MergeRow[]; targets: { id: number; label: string; role: string; seen: string; ticked: boolean }[]; mode: 'sync' | 'update'; members: { id: number; label: string }[] }`.
- Produces: `syncView(db, userId, kind, id): SyncView | null` (members: `visibleMembers` live; targets: the ones the person edits, the page's row first; `mode 'update'` when the person edits only their own copy and the others are read-only to them); `syncAll(db, actorId, kind, id, picks: Record<string, string | null>, targets: { id: number; seen: string }[], files, now, freeDiskBytes): Promise<{ ok: true; refused: { id: number; message: string }[] } | { ok: false; reason: 'pick' | 'denied'; message: string }>` — refuses while a row is open; for each ticked target, each `{giver, keys}` of `mergeTargets` lands with `landKeys(snapshot: 'full')` in its own transaction (a target refused alone); then every pair among the landed targets gets a fresh snapshot of the merged result (`writePair` with the target's flat) and `markNow`.

- [ ] **Step 1: Failing tests:** the user's story — T and G1 both changed, T opens Sync, picks T's notes and G1's timing, ticks T, G1, G2 → all three equal, `stepStatus` (Task 9) later reads in step; Keep mine (every pick T's) → G1 and G2 take T's values (this is a push, unlike old Keep mine); a reader (U2, `mode 'update'`) can only target F2, a group id in `targets` → `denied`; a stale `seen` on G2 refuses G2 only; `crossRefs`/`familyIntegrity` `[]`.
- [ ] **Step 2–4:** FAIL, implement, PASS; `npx vitest run src` — the removed actions' specs are deleted with them, nothing else fails.
- [ ] **Step 5: Commit** `feat(clones): one Sync for every copy (replaces Compare, Take, Send)` — this commit raises `PAGE_EPOCH`.

### Task 9: Where copies stand (the notice and the Moves lists)

**Files:**
- Create: `src/lib/server/clones/step.ts`, `step.spec.ts`
- Modify: `src/lib/server/clones/sources.ts` (drop `compare` from `sourcesView`), `send.ts` (`familyView` without `banners`), the six item loads (send `step`), `src/lib/server/moves-lists.ts` (counts)

**Interfaces:**
- Produces (types.ts): `type StepLine = { id: number; place: string; state: 'behind' | 'changed' | 'both' | 'held'; fields: string[] }`; `type StepView = { lines: StepLine[] }` (empty when in step).
- Produces: `stepStatus(db, userId, kind, id): StepView` — each other live visible member against the page's row (`diff` with the pair base, suffix-only names dropped): only the page changed → `behind`; only it → `changed`; both → `both`; a key the page's options hold back (a piece add/remove the flow would not carry) → `held`. `outOfStep(db, userId, kind, ids: number[]): Map<number, number>` — id → how many copies differ, only for ids whose gene has another visible live member.

- [ ] **Step 1: Failing tests:** the backup's case (G1 changed timing, G2 behind on notes and a recording) → two lines `changed: ['Timing']` and `behind: ['Notes', '+1 recording']`; the suffix-only copy → no line; `outOfStep` for a list of 30 ids returns only the one with copies.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(clones): where copies stand, for the notice and the lists`.

### Task 10: The page: notice, Sync sheet, Versions

**Files:**
- Create: `src/lib/clones/step-view.ts` + spec (PURE words: `noticeLine(line: StepLine): string` → "Intenziuci poletje 2026 changed timing", "Sreda 17:30 is behind yours: notes, 1 recording", "You and Sreda 17:30 both changed notes", "Sreda 17:30 removed a recording"; `keepLine(s: SyncSettings): string` → "Keeps in step · names, small removals" / "Not kept in step"; `syncButton(n): string` → "Sync 3 copies")
- Create: `src/lib/components/clones/SyncNotice.svelte`, `SyncSheet.svelte`, `KeepInStep.svelte` (the level)
- Modify: `Versions.svelte` (no banners; "Send mine…" → "Sync…"; the quiet Keep in step line under the list opening the level, Back to the list), `src/lib/clones/versions.ts` (the row's meta back to "Also: …"), the six item pages (`SyncNotice` under the version row), `src/routes/dev/kit/+page.svelte`
- Delete: `CompareSheet.svelte`, `SendSheet.svelte`, `compare-sheet.spec.ts`
- Create: `src/routes/api/clones/keep/+server.ts` (POST settings) or a page action via `take-form.ts` (builder's choice; one-tap, `use:enhance`)

Look (from the picked mockups; build from `components/ui/` and `ui/styles.ts`): **2A** a warn-soft card under the version row: sync icon, "Your copies don't agree", a small `Sync` button, then a dot line per `StepLine`. **3A** the merge sheet's tiles, one tile per value, its holders named above the value ("Yours · Sreda 17:30"); the field label with who changed it ("Timing · Intenziuci changed it"); open rows dashed in warn; add/remove rows as a box; "Sync to" a card of boxes (label, "· this one" / "· owner"); the full-width button. Reader: "Update from <club>", the changes as `Timing  8 → 16 counts` lines, "Your own change to … stays.", **Update mine**. **4A + 4b A** the line under the Versions list (muted, sync icon, chevron) opens the level: the switch row with "Your edits go to the clubs, theirs come here" and the four options indented beneath; a group's row the person cannot edit draws the switches disabled.

- [ ] **Step 1: Failing tests** for `step-view.ts` words (each string above) and `versions.ts` (meta "Also: …" whatever the status).
- [ ] **Step 2–4:** FAIL, implement, PASS; `npm run check` passes (svelte-check, class rules, bands).
- [ ] **Step 5: Shots.** Update `scripts/shots/ext_sync.py`: scenes `sync-notice` (the figure page), `sync-sheet` (tap Sync), `sync-keep` (Versions → the line). Shoot against a copy of the latest `~/Backups/salsa/db` backup made to differ as in the mockups (figure 12: notes on the own copy, `length_counts=16` on team 7's) with `SHOTS_DANCE=bachata`, light and dark; compare with the mockups.
- [ ] **Step 6: Commit** `feat(clones): the Sync notice, the Sync sheet and Keep in step`.

### Task 11: The Moves lists

**Files:**
- Modify: `src/lib/server/moves-lists.ts` (`outOfStep` per segment's rows), `src/lib/moves/filter.ts` (an `outOfSync` filter from `?sync=1`), the three Moves list components (card under Coverage, drawn like it; row meta), `src/lib/moves/*` words + specs; `src/lib/picker/build.ts` and the lists for `fromTags` (Task 6's display)

**Interfaces:**
- Consumes: `outOfStep` (Task 9), `fromTags`/`shownName` (Task 6).
- Produces: list rows gain `differ: number` (0 when in step); `syncCard(kind, n): { title: string; meta: string } | null` in `src/lib/moves/` ("3 figures out of sync", "Your copies and the clubs' don't agree"; null at 0).

- [ ] **Step 1: Failing tests:** `syncCard('figure', 3)`; `syncCard('routine', 1)` → "1 routine out of sync"; the filter keeps only rows with `differ > 0`; the meta ends in "· 2 copies differ" (warn tone via the builder's tone, not an appended class).
- [ ] **Step 2–4:** FAIL, implement, PASS. Shots: `/bachata/figures` against the same backup copy; the card shows and tapping it filters.
- [ ] **Step 5: Commit** `feat(moves): out of sync on the Moves lists`.

### Task 12: Docs and the whole check

**Files:**
- Modify: `docs/superpowers/specs/2026-11-07-clone-sync-design.md` ("Decided while building"), `2026-11-03-clones-and-twins-design.md` (a pointer at "Comparing and updating clones" and "Names"), `2026-11-06-merge-sheets-and-update-bubbles-design.md` (Compare/Send replaced), `2026-11-06-versions-and-menu-design.md` (Sync…, the line), `CLAUDE.md` (the live list; Layout entries for `clones/sync.ts`, `merge.ts`, `step.ts`, `flow.ts`, `marks.ts`, `sync-settings.ts`, `flow-hook.ts`; the hard rule "Clones: links are row ids…" gains "`clone_pairs` is written by a copy, a Sync and a flow; `clone_marks` by every save on a copy").

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `npm run check` — passes.
- [ ] **Step 3:** Commit `docs: keeping copies in step`.
