# Clones and twins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the screen words (variation → figure, figure → move), then let material live in several places as clones that can be compared and updated, let a person's own routines, lessons and section links use a group's figures without copying them, make leaving a group keep copies instead of reading on, and let a person mark things they see as twins (shown as one).

**Architecture:** Every cloneable row gets a nullable `gene_id` (a text uuid, stamped the first time the row is copied; null means a family of one) and a `cloned_from` id; links stay concrete row ids, and the gene only matches members across places. One clone engine (`src/lib/server/clones/`) copies a figure, drill, song, routine or lesson into a place (a `Space`), mapping every reference to that place's member of the referenced family. A pure flatten-and-diff module turns any member into a map of field keys and compares two members against the pair's last snapshot (`clone_pairs`). One re-point function moves a person's own rows (slots, embeds, section links, lesson links, practice entries, twins) from one row to another; Edit, Drop my copy, Move to…, leaving and the rescue on reach shrink all use it. Twins are a per-person table read only by views.

**Tech Stack:** SvelteKit 2, Svelte 5, SQLite with Drizzle, Vitest. Run everything inside `nix develop -c …`.

**Spec:** `docs/superpowers/specs/2026-11-03-clones-and-twins-design.md` (mockups: https://claude.ai/artifact/Pqdc9XEXQHjS8poJd6asr8, the "Design 2 · clones and twins" rows, boards C0–C8). Read `CLAUDE.md` first: its hard rules bind every task. The groups spec (`2026-11-02-groups-design.md`) and the follow-ups spec (`2026-11-03-groups-follow-ups-design.md`) describe what this changes.

**Branch:** `clones-and-twins`, cut from `groups` (= master = production, 6611131). Five ship points (end of Phases A, C, D, E; B ships with C). Do not merge, push or deploy: the user does that.

---

## Rulings made while planning

The spec leaves these open, or the code contradicts it. Each is decided here; the executor follows them and the user reviews them with the plan.

1. **Editors keep editing the group's rows wherever they open them** (reverses the spec's "Editors *(my call)*" bullet). Outside group mode the teacher reaches drafts from the Groups tab, and turning Edit into "make your own copy" there would strand the publish flow. Edit makes a clone for anyone who can only *read* the row. An editor who wants their own copy uses Copy to… → Your app.
2. **A person's own lessons may link a group's figure, routine or drill they reach**, like their routines and section links (the spec names only those two). Move to… says "your other lessons … re-pointed" and Drop my copy re-points everything, which is impossible otherwise.
3. **"Make it mine" promises name, timing, positions and notes.** Board C2's "and sections" is dropped: sections sit on recordings, and recordings stay the group's (the spec's own Recordings rule). The source's recordings, with their sections, are in the source's tab with Take.
4. **Members of a deleted (not purged) group keep exactly what they have today** for the 30 days: their added lessons (`lessonsReached`' fallback branch). The branch is narrowed to people who still have a `team_members` row; people who left or were removed read nothing. At purge, every member gets Keep everything.
5. **Losing access keeps recordings; choosing to copy doesn't.** A clone into your own app made by Edit, Copy to… → Your app or Make my own copy has no recordings (spec). One made by Keep (leaving, removal, purge) brings them, hard-linked and charged to you, since you would otherwise lose them. One made by the rescue when an editor archives something you use (Task 17) has no recordings: the rescue runs inside the editor's transaction and touches no files.
6. **Practice entries are re-pointed with everything else**, including by the rescue (the spec says "as today" for things you only read; an entry on a thing your routine uses is moved to the rescued copy so practice continues).
7. **History reuses existing verbs.** Copy into a group logs `add`; Take, Send and Detach in a group log `change`; Move to… logs `add` in the group. No new `team_changes` CHECK values, no second 0025-style rebuild.
8. **The figure page keeps its bottom switcher** (renamed: "Figures of Enchufla"), and its sheet gets the move's name as a link to the move's page. The new source tabs sit at the top. Different axes, both kept.
9. **The Moves list is figures under move headings** (board C0, the spec). Board C7's "one row per move" is read as: a group's move whose figures are all your twins gets no heading of its own; your move's heading says "also in Salsa Tuesdays", and each twinned figure is one row with a "Twins" chip.
10. **The banner names the place, not the person** ("Rueda club changed the timing", not "Marko changed…"): who edited a field is not stored per field.
11. **Lesson practice stays with the archived copy on Move to…**, and Move's default is "Keep mine as well" for any figure, routine or drill your other lessons or routines use *or that you practise*: a draft group lesson can't be added, so practice could not follow (R8).
12. **Make my own copy and Edit on a group lesson are the same action** ("Make it mine"). The lesson page has one Edit for readers; the "Make my own copy" button goes.
13. **Recording and section pieces are matched by gene inside their parent**, never across parents. Moving a figure to another move never changes its gene.

---

## Global Constraints

- Every instant is an integer of epoch ms. Data functions take `db` first. Specs never touch `$DATA_DIR`: file work goes through an injected `CloneFiles`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does.
- Migrations are additive only: `ALTER TABLE … ADD` and `CREATE TABLE/INDEX`. Never a CHECK on an existing table, never a rebuild. Read the generated SQL before committing. The one migration of this plan is `0027`.
- **Links stay concrete row ids.** No column anywhere references a gene. A gene is read only to find a member (`memberIn`, `familyRows`), and every re-point is an explicit update in the same transaction.
- **At most one member of a family per place.** Root tables: the unique indexes from Task 6 (archived rows included: an archived member holds its place). Pieces (recordings, lesson videos, sections): one per parent row, checked in the data function and in `restoreTrash`.
- **A group row only ever points at rows of its own group.** A person's own row (routine slot, embed, section link, lesson link, entry) points at the person's own rows or at group rows the person reaches (`access.ts`). `crossRefs` (Task 12) checks both and runs in every spec of Phases C–E that changes reach.
- Every group mutation calls `logChange` with a real actor in its own transaction and is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`. Verbs and root kinds stay within the existing CHECK lists (ruling 7).
- A write into a group row from a comparison carries `seen` (the target's digest from Task 8) and is refused with "Changed since you opened this. Compare again." when it no longer matches.
- Reach shrinks, entries and own rows follow: `reconcileEntries` (which now also runs `rescueUsed`, Task 17) runs in every change that can shrink someone's reach.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`. All new screen copy comes from pure modules (`src/lib/clones/view.ts`, `src/lib/teams/leave-view.ts`) with specs.
- A form someone fills in uses `use:guarded`; one-tap forms use `use:enhance`; a refresh after a sheet closes goes through `refreshWhenSettled()`; close-then-go uses `gotoWhenSettled`.
- `space-rules.spec.ts` bans `eq(<content>.userId, wall.userId)` outside its allow-list: filter by owner with `ownedBy`.
- Raise `PAGE_EPOCH` (`src/lib/page-epoch.ts`) in the commit that changes a form field or action an open page would still send (Tasks 21 and 23).
- Copy follows the boards. The words: **figure** (a `figures` row, "Enchufla · Doble"), **move** (a `figure_groups` row, "Enchufla"), "Yours", "Your copy · from Salsa Tuesdays", "Salsa Tuesdays’ figure", "Make it mine", "Compare", "Take", "Take what’s picked", "Send mine…", "Drop my copy", "Detach", "Copy to…", "Move to…", "Same as…", "Mark as the same", "Not the same? Separate", "Keep everything", "Choose what to keep", "Keep only what my routines use". Typographic apostrophes (’) as on the boards.
- `npm run check` must pass at the end of every task.

## Review Focus

1. **Three members of one family, edits on two, Take and Send in every order** (the spec's Known risk), including a member taking from one sibling and sending to another, and a pair that was never in step. Expect: a field only one side changed since the pair's snapshot is preselected from that side; both changed asks; no snapshot asks for every difference; nothing is silently lost. Pinned in Task 7 (pure, a table of orders), Task 26 (server, three places) and Task 34 (the whole story).
2. **A person's own row left pointing at a group row they can no longer reach**, after leaving, removal, demotion, an archived figure or routine or drill, an unlinked lesson item, a removed slot option, an unlinked section, a deleted group's purge. Expect: the row was rescued (cloned and re-pointed) or kept, never dangling. Pinned in Tasks 17 and 19 with `crossRefs`.
3. **A former member reading anything of the group**: lesson page, figure page, routine page, media files (`/recordings`, `/lesson-videos`, `/audio`), Moves and Routines group sections, the Lessons tab, Today's lesson days, live entries, the player. Expect 404 or absence everywhere. Pinned in Task 20.
4. **Two members of one family in one place**: copying twice, Edit after Drop my copy, restoring a trashed recording after Send re-added it, leave → rejoin → leave, Keep on leaving when you already made your copy. Expect: reuse, a restore offer, or a refusal with a reason. Pinned in Tasks 10, 12, 18, 23, 27 and 28.
5. **A shared file unlinked while another row still uses it**: hard-linked copies get new names, so deleting a recording in one place, `purgeTrash`, `purgeSongs` and `purgeTeams` must each leave the other place's file in place and playable. Pinned in Tasks 9 and 19.

---

## File structure

**Phase A (names):** words in `src/lib/figures/page.ts`, `src/lib/moves/figures.ts`, `src/lib/teams/{view,deleted,history}.ts`, `src/lib/clash/clash.ts`, the components under `src/lib/components/{figures,links,lessons,moves}/`, and the routes under `src/routes/[dance]/{figures,lessons}/`; new `src/routes/[dance]/moves/[id]/` (a move's page); `src/lib/moves/list.ts` (figures under move headings).

**Phase B (families), all new under `src/lib/clones/` (PURE, client-safe) and `src/lib/server/clones/`:**
- `src/lib/clones/flat.ts`: `Flat`, field keys and labels per kind.
- `src/lib/clones/diff.ts`: the three-way compare, default picks, the next snapshot.
- `src/lib/clones/view.ts`: every clone and twin screen's words.
- `src/lib/server/clones/genes.ts`: stamping, finding members, visible members.
- `src/lib/server/clones/trees.ts`: a member as a `Flat`, per kind.
- `src/lib/server/clones/pairs.ts`: pair snapshots, hashing, the target digest.
- `src/lib/server/clones/clone.ts`: the clone engine (plan files, link, write rows).
- `src/lib/server/clones/repoint.ts`: move a person's own rows from one row to another.
- `src/lib/server/twins.ts`: the twins table.
- Modify `src/lib/server/db/schema.ts`, `trash.ts`, `integrity.ts`, `copy-lesson.ts` (becomes a wrapper), `copy-song.ts` (same).

**Phase C (using and leaving):** `src/lib/server/access.ts`, `lessons.ts`, `routines.ts`, `graph.ts`, `spot-links.ts`, `link-popup.ts`, `entries.ts`, `membership.ts`, `team-purge.ts`; new `src/lib/server/clones/{rescue,keep}.ts`, `src/lib/teams/leave-view.ts`, `src/lib/components/teams/LeaveSheet.svelte`.

**Phase D (working with clones):** new `src/lib/server/clones/{shadow,edit,sources,compare,apply,drop,detach,copy-to,move}.ts`; components `src/lib/components/clones/{SourceTabs,MakeMineSheet,CompareSheet,SendSheet,DropSheet,DetachSheet,CopyToSheet,MoveToSheet,FamilyList}.svelte`; the five item pages (figure, routine, drill, song, lesson).

**Phase E (twins):** `src/lib/clones/twins.ts` (PURE folding), `src/lib/components/clones/SameAsSheet.svelte`, the Moves list and the pickers.

---

## Shared types (Task 6 adds them to `src/lib/types.ts`; later tasks use them verbatim)

```ts
export type CloneKind = 'figure' | 'routine' | 'drill' | 'song' | 'lesson'; // 'figure' = a `figures` row
export type TwinKind = 'figure' | 'routine' | 'lesson' | 'song';
export type PieceKind = 'recording' | 'video' | 'spot';
export type PlaceRef = { kind: 'mine' } | { kind: 'team'; teamId: number; name: string };
export type FlatField = {
	key: string; // see Task 7's key grammar
	label: string; // "Timing", "Notes", "Recording · Ana, 3 Nov"
	value: string; // canonical text; equal values mean equal content
	show: string; // what the compare sheet prints
};
export type Flat = Record<string, FlatField>;
export type PairBase = { fields: Record<string, string>; skip: string[] }; // key → hash
export type Side = 'mine' | 'theirs' | 'both';
export type FieldDiff = {
	key: string;
	label: string;
	mine: FlatField | null; // null = absent on that side
	theirs: FlatField | null;
	side: Side; // who changed it since the base; 'both' = must pick
	removal: boolean; // the change on `side` is that the piece/member is gone
};
export type Picks = Record<string, 'mine' | 'theirs'>;
export type Member = {
	kind: CloneKind;
	id: number;
	place: PlaceRef;
	access: 'edit' | 'read';
	archived: boolean;
	clonedFrom: number | null;
};
export type Source = {
	id: number;
	label: string; // 'Yours' or the group's name
	relation: 'self' | 'clone' | 'twin';
	access: 'edit' | 'read';
	status: 'same' | 'behind' | 'newer' | 'differs' | null; // vs the page's own member; null for self and twins
	changed: string[]; // labels of what differs, for the banner
	rejoined?: boolean; // Task 28: last in step before the person's current membership began
};
```

---

# Phase A — Names (ships first, on its own)

The code keeps its names (`figures` is a figure, `figure_groups` a move); only words, two screens and docs change. Ruling 8 keeps the switcher. URL paths, action names, DOM ids, API bodies (`kind: 'variation'`) and stored `team_changes.subject` values do **not** change.

### Task 1: Words in the pure modules

**Files:**
- Modify: `src/lib/figures/page.ts`, `src/lib/moves/figures.ts`, `src/lib/moves/segment.ts` (no change: the label stays "Figures"; verify), `src/lib/teams/view.ts`, `src/lib/teams/deleted.ts`, `src/lib/teams/history.ts`, `src/lib/clash/clash.ts`, `src/lib/player/view.ts` (verify only)
- Test: the `.spec.ts` beside each

**Interfaces:**
- Produces: `historySubject(rootKind: ChangeRootKind, subject: string): string` in `src/lib/teams/history.ts` (display mapping; stored values unchanged).

- [ ] **Step 1: Update the specs first** to the new words:
  - `figures/page.spec.ts`: `variationNav` → "2 of 3 figures"; `archiveCopy` caption "…is its last figure." and button "Archive and remove move"; `moveState` buttons "Move to Enchufla", "Move and remove move", "Make it its own move"; "Setenta goes with it" unchanged; "Doble leaves Enchufla" unchanged.
  - `moves/figures.spec.ts`: `figureMeta` "3 figures · 2 recordings · No section · No lesson"; `figuresHeading` "12 moves" / "1 move" / "3 moves match" / "1 move matches" (Task 3 changes the list's unit again; this task only swaps words).
  - `teams/view.spec.ts:108`: "5 figures" where it said "5 variations".
  - `teams/deleted.spec.ts`: `KIND_NAME.variation` → 'Figure'; the move's kind name → 'Move'.
  - `teams/history.spec.ts`: a line with subject `variation` reads "archived the figure 'Doble'"; rootKind `figure` with subject `figure` reads "made the move 'Enchufla'"; rootKind `lesson` with subject `figure` still reads "added the figure 'Enchufla · Doble'".
  - `clash.spec.ts`: label 'Figure name' → 'Move name'; `history.ts` 'figure’s name' → 'move’s name'.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/figures src/lib/moves src/lib/teams src/lib/clash` — expect FAIL on each changed line.
- [ ] **Step 3: Change the words** in the modules listed. `historySubject` maps (`'figure'`, `'figure'`) → `'move'`, any rootKind with `'variation'` → `'figure'`, else the subject unchanged; `history.ts` prints through it.
- [ ] **Step 4: Run** the same command — PASS.
- [ ] **Step 5: Run** `nix develop -c npm run check` — PASS. Commit: `refactor(names): variation → figure, figure → move in the pure modules`.

### Task 2: Words in components, pages and server messages

**Files:**
- Modify: `src/lib/components/figures/{VariationBar,RemoveWarning,MoveSheet,FigureFields}.svelte`, `src/lib/components/links/LinkPopup.svelte`, `src/lib/components/lessons/LessonFields.svelte`, `src/lib/components/moves/MovesScreen.svelte`, `src/routes/[dance]/figures/+page.svelte`, `src/routes/[dance]/figures/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/routes/[dance]/figures/+page.server.ts`, `src/routes/[dance]/figures/[id]/+page.server.ts`, `src/routes/[dance]/lessons/[id]/+page.server.ts`, `src/lib/server/link-popup.ts`, `src/routes/[dance]/groups/[id]/history/[kind]/[rootId]/+page.server.ts`
- Test: `src/routes/[dance]/dance-wall.spec.ts`, `src/routes/[dance]/lessons/lesson-forms.spec.ts`, `src/routes/[dance]/moves-forms.spec.ts`, `src/lib/server/link-popup.spec.ts`, `src/routes/api/video-spots/links.spec.ts`, `src/lib/video/spots-api.spec.ts`

**Interfaces:** none new.

- [ ] **Step 1: Update the specs' asserted messages:**
  - "already has a variation called X" → "already has a figure called X"
  - "There's already a figure called X." → "There's already a move called X."
  - "Give the figure a name" → "Give the move a name"
  - "Give the variation a name…" → "Give the figure a name…"
  - "Pick a figure." (where it means the move: lesson-forms 306, dance-wall 938) → "Pick a move."
  - "X is already a variation of Y." → "X is already a figure of Y."
  - "This variation is already practised on its own." → "This figure is already practised on its own."
  - "That variation could not be made." → "That figure could not be made."
  - "No such figure." → "No such move."
  - "That figure could not be made." (link-popup 328, the move) → "That move could not be made."
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/routes/[dance] src/lib/server/link-popup.spec.ts src/routes/api src/lib/video` — expect FAIL.
- [ ] **Step 3: Change the server messages** to match, and the component words. In components:
  - VariationBar: "Figures of {move}", "Previous figure", "Next figure", "New figure", aria "Figures", "Add figure".
  - RemoveWarning: "{figure} is its last figure, and a move with no figures is gone. It leaves the Figures list."
  - MoveSheet: "Move “{figure}” to…" (unchanged), "{figure} becomes its first figure", "New move’s name", "Or join a move", "Move", "Choose a move…", "Join a move", "Search moves", "There are no other moves yet.", picker group 'Moves'.
  - FigureFields: "Move name" (placeholder "e.g. Dile que no, Enchufla"), "Figure name".
  - LinkPopup: steps 'Figure' (was 'Variation'), 'New figure' (was 'New variation'), 'New move' (was 'New figure'); "Figure name" (was "Variation name"); "Move name" (was "Figure name").
  - Lesson page: FIGURE_MODES 'New move' / 'New figure in a move'; that block's "There are no moves yet.", label "Move", "Choose a move…", "Search moves", "Moves in this lesson come first", group 'Moves'; sheet 'New figure'; 'Add figure'.
  - LessonFields placeholder "…enchufla figures".
  - Figures page: `<title>Figures ·` stays; "No figures yet" stays; "New figure" (the sheet makes a move and its first figure) → "New move"; "Search figures" stays (the list is figures, Task 3); "No figures match" stays.
  - figure page "Shared by its N figures"; "A new move of its own, or another move".
  - History fallback title for kind `figure` → 'Move'.
- [ ] **Step 4: Run** the step-2 command — PASS; then `grep -rn "[Vv]ariation" src --include=*.svelte` and inspect each hit: none may be visible text (identifiers, comments and `kind: 'variation'` stay).
- [ ] **Step 5: Run** `nix develop -c npm run check` — PASS. Commit: `refactor(names): variation → figure, figure → move on screen`.

### Task 3: The Figures tab lists figures under move headings

**Files:**
- Create: `src/lib/moves/list.ts`, `src/lib/moves/list.spec.ts`
- Modify: `src/lib/server/figures.ts` (`listFigures`, `listAddedFigures`), `src/lib/types.ts` (`FigureListItem`), `src/routes/[dance]/figures/+page.server.ts`, `src/routes/[dance]/figures/+page.svelte`, `src/lib/moves/figures.ts` (`figuresHeading`, `figureMeta`, `groupFigureMeta`)
- Test: `src/lib/server/figures.spec.ts`, `src/routes/[dance]/moves-forms.spec.ts`

**Interfaces:**
- Produces:
  - `src/lib/types.ts`: `type MoveRow = { id: number /* figure_groups.id */; name: string; figures: FigureRow[] }`; `type FigureRow = { id: number; name: string; label: string /* "Enchufla · Doble" */; startCount: number | null; lengthCounts: number | null; recordings: number; hasSection: boolean; hasLesson: boolean; gene: string | null }`. `FigureListItem` is removed.
  - `listFigures(db: Db, space: Space, filter?: FigureFilter): MoveRow[]` — a move appears when any of its live figures matches; only matching figures are listed; `q` matching the move's name lists all its figures; Not linked keeps a figure that lacks a section or a lesson.
  - `listAddedFigures(db, wall, filter): { team: TeamRef; moves: MoveRow[] }[]`.
  - `src/lib/moves/list.ts`: `figureRowMeta(f: FigureRow): string` → "Starts on 1 · 16 counts · 2 recordings" (omits unknown timing; "No section", "No lesson" appended as today's `figureMeta`); `movesHeading(n: { moves: number; figures: number }, matching: boolean): string` → "Yours · 14 figures" / "3 figures match".

- [ ] **Step 1: Write the failing pure tests** in `list.spec.ts`: `figureRowMeta` for (start 1, 16, 2 recs) → "Starts on 1 · 16 counts · 2 recordings"; (null, null, 0) → "" ; with `hasSection: false` → "… · No section". `movesHeading({moves:5, figures:14}, false)` → "Yours · 14 figures"; `(…, true)` → "14 figures match"; one figure → "1 figure".
- [ ] **Step 2: Write the failing data tests** in `figures.spec.ts`, `it('lists figures under their move, filtered per figure')`: move Enchufla with Doble (style son) and Básica (salsa); `listFigures(db, U1_SALSA, { style: 'son' })` → `[{ name: 'Enchufla', figures: [expect.objectContaining({ name: 'Doble', label: 'Enchufla · Doble' })] }]`; `{ q: 'enchufla' }` lists both; `{ unlinked: '1' }` keeps only figures lacking a section or lesson.
- [ ] **Step 3: Run** `nix develop -c npx vitest run src/lib/moves/list.spec.ts src/lib/server/figures.spec.ts` — FAIL.
- [ ] **Step 4: Implement** the server shape and pure helpers; the page renders, per move, a heading link (`<a href="/{dance}/moves/{id}">` with the chevron, board C0 p1) over a `GROUP` list of figure rows (`/{dance}/figures/{id}`, label without the move prefix as the row name, meta from `figureRowMeta`). Group sections do the same under the group heading. Group mode unchanged apart from the shape. Empty states and chips keep their words.
- [ ] **Step 5: Route spec** `moves-forms.spec.ts`, `it('the Figures load returns moves with their figures')`: assert `data.figures[0].figures[0].label`.
- [ ] **Step 6: Run** `nix develop -c npm run check` — PASS. Commit: `feat(names): the Figures tab lists figures under their move`.

### Task 4: A move's page

**Files:**
- Create: `src/routes/[dance]/moves/[id]/+page.server.ts`, `+page.svelte`, `src/routes/[dance]/moves/[id]/move-page.spec.ts`, `src/lib/moves/move-page.ts`, `src/lib/moves/move-page.spec.ts`
- Modify: `src/lib/nav/tabs.ts` (`SECTION`: `moves` → the Moves tab), `src/lib/nav/trail.ts` (no new root; the page is a child), `src/lib/nav/bands.spec.ts` (if it lists pages), `src/lib/server/scope.ts` (new guard), `src/routes/[dance]/groups/[id]/history/[kind]/[rootId]/+page.server.ts` (kind `figure` links to the move's page)

**Interfaces:**
- Consumes: `figureGroupAccess` (access.ts:376), `listFigures`-style rows, `routineShapes`, `routinesUsing`, `taughtIn`.
- Produces:
  - `requireMoveAccess(db, locals, params, id, need): { move: FigureGroup; space: Space; access: 'edit' | 'read'; reach: Reach | null }` in `scope.ts`.
  - `src/lib/moves/move-page.ts`: `moveSubtitle(n: number): string` → "Move · 3 figures"; `usedInMeta(kind: 'routine' | 'lesson', figureNames: string[]): string` → "Routine · Doble and Básica", "Lesson".
  - Load: `{ move: { id; name }, figures: FigureRow[], usedIn: { kind; id; name; meta }[], canEdit }`. Actions: `rename` (name, `seen` on a group move), `createFigure` (adds a figure to this move; redirects to it).

- [ ] **Step 1: Pure tests** for `moveSubtitle` (1 → "Move · 1 figure") and `usedInMeta` (two names joined with " and ", three with ", " and " and ").
- [ ] **Step 2: Route tests** in `move-page.spec.ts`: the owner gets the move with its live figures in id order; `usedIn` lists the owner's routine that uses two of its figures as "Routine · Doble and Básica" and a lesson that links one as "Lesson"; u2 gets 404; a member reaching the group's move reads it with `canEdit: false` and sees only reached figures; `rename` to a taken move name fails with "There's already a move called X."; archived move → 404.
- [ ] **Step 3: Run** both specs — FAIL.
- [ ] **Step 4: Implement** the guard, the load, the actions and the page (board C0 p2: page band with title = move name, sub = `moveSubtitle`, ⋯ with Rename and New figure for editors; "Figures" heading with rows → figure pages; "Used in" heading with rows → routine or lesson pages; no "Used in" heading when empty). The move's page gets its own `rename` action; the figure page's existing actions stay as they are, so no open page breaks and `PAGE_EPOCH` is not raised.
- [ ] **Step 5: Run** the specs and `nix develop -c npm run check` (including `bands.spec.ts`) — PASS. Commit: `feat(names): a move's page`.

### Task 5: The figure page's band, the switcher's link, and the docs

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte`, `src/lib/components/figures/VariationBar.svelte`, `src/lib/figures/page.ts` (`figureSubtitle`), `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (Vocabulary table, "## Figures", player note), `docs/superpowers/specs/2026-10-31-redesign-design.md` (Moves section words), `docs/superpowers/specs/2026-10-29-figures-are-variations-design.md` (a note at the top: "Renamed 2026-11: a variation is now called a figure, a figure a move")
- Test: `src/lib/figures/page.spec.ts`

**Interfaces:**
- Produces: `figureSubtitle(f: { startCount: number | null; lengthCounts: number | null }): string` → "Figure · starts on 1 · 16 counts" (or "Figure").

- [ ] **Step 1: Test** `figureSubtitle` for both cases.
- [ ] **Step 2: Implement:** the figure page's band title is the label ("Enchufla · Doble"), subtitle `figureSubtitle` (board C0 p3). VariationBar's sheet title "Figures of Enchufla" becomes a link to `/{dance}/moves/{groupId}`.
- [ ] **Step 3: Docs.** CLAUDE.md: the phase line "figures as variations (…)" reads "figures and moves (a move is a name holding self-contained figures; Move to… another move or a new one; switcher at the bottom; a move's page)"; the hard rule "A `figures` row is a variation; a `figure_groups` row is a figure" becomes "A `figures` row is a figure; a `figure_groups` row is a move" with the same invariants in the new words; the `src/lib/figures/` and `src/lib/moves/` layout lines likewise. The design spec's vocabulary table gets Move and Figure rows. Nothing else in the docs changes meaning.
- [ ] **Step 4: Run** `nix develop -c npm run check` — PASS. Commit: `docs(names): figures and moves`.

**Ship point A.** The rename can be deployed on its own (no migration).

# Phase B — Families (no screens; ships with Phase C)

### Task 6: Migration 0027 and the shared types

**Files:**
- Modify: `src/lib/server/db/schema.ts`, `src/lib/types.ts` (the shared types above)
- Create: `drizzle/0027_*.sql` (generated), `src/lib/server/clones-schema.spec.ts`

**Interfaces:**
- Produces, in `schema.ts`:
  - On `figures`, `routines`, `songs`, `lessons`, `exercises`: `geneId: text('gene_id')`, `clonedFrom: integer('cloned_from')` (no foreign key: a source may be hard-deleted or purged), and two partial unique indexes `<table>_gene_user_idx` on `(gene_id, user_id)` and `<table>_gene_team_idx` on `(gene_id, team_id)`, both `.where(sql\`${t.geneId} is not null\`)`. Archived rows are included on purpose.
  - On `recordings`, `lesson_videos`, `video_spots`: the same two columns and a plain index `<table>_gene_idx` on `(gene_id)`.
  - New table `clone_pairs`: `kind text NOT NULL`, `a_id integer NOT NULL`, `b_id integer NOT NULL`, `base_json text NOT NULL`, `at integer NOT NULL`; primary key `(kind, a_id, b_id)`; `check('clone_pairs_order_ck', a_id < b_id)`; `check('clone_pairs_kind_ck', kind in ('figure','routine','drill','song','lesson'))` (CHECKs on a new table are allowed).
  - New table `twins`: `user_id text NOT NULL`, `kind text NOT NULL`, `set_id text NOT NULL`, `item_id integer NOT NULL`, `created_at`; primary key `(user_id, kind, item_id)`; index `twins_set_idx (user_id, set_id)`; `check('twins_kind_ck', kind in ('figure','routine','lesson','song'))`.
- No backfill: a null gene is a family of one (ruling: genes are stamped lazily, Task 8).

- [ ] **Step 1: Write the failing schema spec** `clones-schema.spec.ts` (copy the shape of `groups-schema.spec.ts:138`):
  - `it('0027 is additive')`: read `drizzle/0027_*.sql`, assert `not.toMatch(/DROP TABLE|RENAME TO|__new_/)`, and that `figures` still carries `figures_style_ck`, `exercises` still `exercises_source_ck`.
  - `it('one member per place')`: two `figures` rows with `gene_id 'g'` and `user_id 'u1'` → the second insert throws `UNIQUE`; same gene with `user_id 'u2'` is fine; same gene with `team_id 1` and another with `team_id 2` is fine; two rows with `gene_id NULL` and the same user are fine; an archived member still blocks.
  - `it('entries never collide')`: two entry exercises of u1 (`source 'figure'`, null gene) on different figures insert fine.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones-schema.spec.ts` — FAIL (no columns).
- [ ] **Step 3: Edit `schema.ts`, run** `nix develop -c npm run db:generate`, **read the SQL**: only `ALTER TABLE … ADD`, `CREATE TABLE`, `CREATE (UNIQUE) INDEX`. If drizzle-kit wants to rebuild any table, stop and find which schema change triggered it (a `check()` or `.references()` added to an existing table).
- [ ] **Step 4: Add the shared types** to `src/lib/types.ts`.
- [ ] **Step 5: Run** the spec and `nix develop -c npm run check` — PASS. Commit: `feat(clones): gene and cloned-from columns, clone pairs, twins (migration 0027)`.

### Task 7: Flatten and compare (PURE)

**Files:**
- Create: `src/lib/clones/flat.ts`, `src/lib/clones/diff.ts`, `src/lib/clones/flat.spec.ts`, `src/lib/clones/diff.spec.ts`

**Interfaces:**
- Produces:
  - **Key grammar** (`flat.ts`, documented at the top of the file):
    - root fields: `name`, `notes`, `partner`, `style`, `timing`, `positions` (figure); `practice` (drill); `title`, `artist`, `count`, `sample` (song; `title` and `day` for a lesson); `slots` (routine, one field: spec).
    - set members, one key each, value `'1'`: `link:<url>` (a row's URL links), `fig:<ref>`, `routine:<ref>`, `drill:<ref>` (a lesson's hand links).
    - pieces: `rec:<g>` and `video:<g>` (presence; value is the piece's media kind and size), `rec:<g>:note`, `<piece>:spot:<s>` (value `start|end|label`), `<piece>:spot:<s>:links` (sorted refs).
    - `<ref>` / `<g>` / `<s>` is the row's gene, or `#<id>` when it has none.
  - `fieldLabel(key: string, show: string): string` — 'Name', 'Notes', 'Partner', 'Style', 'Timing', 'Positions', 'Practice', 'Title', 'Day', 'Artist', 'Count', 'Sample', 'Slots'; `link:` → `Link · <show>`; `fig:` → `Figure · <show>`; `routine:` → `Routine · <show>`; `drill:` → `Drill · <show>`; `rec:<g>` → `Recording · <show>`; `video:<g>` → `Video · <show>`; `…:spot:<s>` → `Section · <show>`.
  - `pieceOf(key: string): string | null` → the `rec:<g>` / `video:<g>` prefix of a key, else null.
  - `diff(base: PairBase | null, mine: Flat, theirs: Flat, hash: (v: string) => string): FieldDiff[]`.
    - Keys = union of `mine` and `theirs` (a key gone from both sides is no difference). A key in `base.skip`, or whose `pieceOf` is in `base.skip`, is ignored.
    - Equal hashes → no diff.
    - No base → `side: 'both'`.
    - Otherwise each side is changed when its hash (null when absent) differs from `base.fields[key] ?? null`; `side` is the changed one, or `'both'`.
    - `removal` is true when the changed side's value is null; for `'both'`, when either is null.
    - When a piece key itself is a diff with one side null, its child keys are not reported (the piece travels or goes whole).
    - Order: root fields in grammar order, then set members, then pieces by label.
  - `defaultPicks(diffs: FieldDiff[], mode: 'take' | 'send'): Picks` — `side 'theirs'` → `'theirs'`, `side 'mine'` → `'mine'`, `'both'` → no entry; **a removal is never preselected**: in take mode a theirs-side removal is picked `'mine'`; in send mode a mine-side removal is picked `'theirs'` (deletes only if ticked).
  - `unpicked(diffs: FieldDiff[], picks: Picks): string[]` — `'both'` keys without a pick.
  - `nextBase(receiver: Flat, giver: Flat, prevSkip: string[], hash): PairBase` — after a Take or Send: a key equal on both sides gets that hash; a key that still differs gets the **giver's** hash (absent if the giver lacks it), so the next compare reads the receiver's kept value as the receiver's own change and does not ask again. `skip` keeps `prevSkip` minus pieces now present on both sides.
  - `initialBase(source: Flat, skip: string[], hash): PairBase` — at copy time: the source's hashes, with `skip` the pieces not carried (recordings of a clone into your own app).

- [ ] **Step 1: Write the failing tests** in `diff.spec.ts` with `hash = (v) => v`. Name each `it` after its row:

  | # | setup (A mine, B theirs, base = their last sync) | expect |
  |---|---|---|
  | 1 | B changes `notes` | one diff `notes`, side `theirs`; `defaultPicks(…, 'take')` = `{ notes: 'theirs' }` |
  | 2 | A and B both change `notes` | side `both`; `unpicked` = `['notes']` |
  | 3 | no base, `timing` differs | side `both` |
  | 4 | B adds `rec:g2` (not in base) | side `theirs`, removal false, label `Recording · …` |
  | 5 | B deletes `rec:g1` (in base) | side `theirs`, removal true; take default picks `'mine'` |
  | 6 | A deletes `rec:g1`; send mode | side `mine`, removal true; send default picks `'theirs'` |
  | 7 | `rec:g1` and its `rec:g1:spot:s` in skip, absent on A | no diffs |
  | 8 | B adds `rec:g1:spot:s9` under a piece both have | one diff for the section, side `theirs` |
  | 9 | B lacks `rec:g1` entirely while A has `rec:g1` and `rec:g1:note` | one diff (`rec:g1`), not two |
  | 10 | after take with `notes` kept `'mine'`: `nextBase(A, B)` then compare again | no `'both'` for notes; side `mine` |
  | 11 | **three members** A, B, C; A→B and A→C copies (bases from `initialBase(A)`); B edits `notes`; A takes from B (`nextBase`); A sends to C | A vs C: `notes` side `mine`, default send pick `'mine'` |
  | 12 | as 11 but C also edited `notes` before the send | A vs C: `notes` side `both` |
  | 13 | B vs C never synced directly (no base), equal after 11 | no diffs |
  | 14 | B and C both change `timing`; A takes B's; A vs C | `timing` side `both` |
  | 15 | rename on arrival: clone's `name` differs from the base | side `mine` (shows as a difference, nothing asked) |

  And `flat.spec.ts`: `fieldLabel` for each prefix; `pieceOf('rec:g1:spot:s2:links')` = `'rec:g1'`; `pieceOf('notes')` = null.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/clones` — FAIL.
- [ ] **Step 3: Implement** `flat.ts` and `diff.ts` (no imports from `$lib/server`).
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): flatten and three-way compare`.

### Task 8: Genes, pair snapshots, and a member as a Flat

**Files:**
- Create: `src/lib/server/clones/genes.ts`, `src/lib/server/clones/pairs.ts`, `src/lib/server/clones/trees.ts`, and a spec beside each
- Modify: `src/lib/server/test-walls.ts` if a helper for a second team is needed (`T2_SALSA`)

**Interfaces:**
- Consumes: `figureAccess`, `routineAccess`, `drillAccess`, `songAccess`, `lessonAccess`, `recordingAccess` (access.ts), `ownedBy`, `inSpace`.
- Produces:
  - `genes.ts`:
    - `newGene(): string` — `crypto.randomUUID()`.
    - `stampGene(tx: Db, kind: CloneKind | PieceKind, id: number): string` — returns the row's gene, setting a new one first if null.
    - `geneOf(db: Db, kind: CloneKind | PieceKind, id: number): string | null`.
    - `memberIn(db: Db, kind: CloneKind, gene: string, place: Space): { id: number; archived: boolean } | null` — archived included.
    - `familyRows(db: Db, kind: CloneKind, gene: string): { id: number; userId: string | null; teamId: number | null; archivedAt: number | null; clonedFrom: number | null }[]`.
    - `visibleMembers(db: Db, userId: string, kind: CloneKind, id: number): Member[]` — the row's family (just the row when its gene is null) that `userId` can read, each with its `PlaceRef` and access; another person's private member never appears; a deleted group's members appear only as the access rules allow.
  - `pairs.ts`:
    - `hashValue(v: string): string` — sha-256 hex, first 16 characters.
    - `pairBase(db: Db, kind: CloneKind, a: number, b: number): PairBase | null` (order-free).
    - `writePair(tx: Db, kind: CloneKind, a: number, b: number, base: PairBase, now: number): void` (upsert).
    - `pairAt(db, kind, a, b): number | null` (when last in step; Task 28's rejoin line).
    - `dropPairs(tx: Db, kind: CloneKind, id: number): void`.
    - `digest(flat: Flat): string` — `hashValue` of the sorted `key=value` lines; the `seen` of a comparison.
  - `trees.ts`: `flatOf(db: Db, kind: CloneKind, id: number): Flat` — never writes (an unstamped row reads as `#<id>`). Per kind:
    - **figure:** `name`, `notes`, `partner`, `style` (`style_tag`), `timing` (show "Starts on 1 · 8 counts"), `positions` (sorted start position ids + end id; show "Closed → Open, hammerlock"), `link:*`, and per recording `rec:<g>` (show the recording's note or "Recording, 3 Nov"), `rec:<g>:note`, its sections and their links.
    - **drill:** `name`, `notes`, `practice` (`practice_mode`, `count_bpm`, `practice_json`), `link:*`.
    - **song:** `title`, `artist`, `style`, `count` (`anchors_json` + `tempo_factor`), `sample` (`sample_start_s`). The audio is the family's and never a field.
    - **routine:** `name`, `notes`, `slots` (canonical JSON of `[{ child: ref | null, options: ref[] main first, note }]`; show "6 slots").
    - **lesson:** `title`, `day`, `notes`, `link:*`, `fig:`, `routine:`, `drill:` (hand links only, from the three join tables), and per lesson video `video:<g>` with its sections and their links.
    - Local fields are never in a Flat: which move a figure is under, `archived_at`, `published_at`, `shared_at`, owners, entries, practice settings of entries, logs (spec "Local to each place").

- [ ] **Step 1: Failing tests:**
  - `genes.spec.ts`: `stampGene` twice returns the same gene; `memberIn` finds an archived member; `visibleMembers(u2)` of a u1 personal figure whose gene is shared with a group figure u2 reaches returns only the group's, with `place.kind 'team'` and `access 'read'`; an editor sees the group's as `'edit'`.
  - `pairs.spec.ts`: `writePair(kind, 7, 3)` then `pairBase(kind, 3, 7)` round-trips; `digest` changes when any value changes and not when key order does.
  - `trees.spec.ts`, one `it` per kind: build the row with its pieces through the existing create functions, assert the exact key set and two `show` strings; an unstamped recording keys as `rec:#<id>`; moving a figure to another move leaves its Flat unchanged.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): genes, pair snapshots, members as flat fields`.

### Task 9: The clone engine — figure, drill, song

**Files:**
- Create: `src/lib/server/clones/clone.ts`, `src/lib/server/clones/files.ts`, `src/lib/server/clones/clone.spec.ts`
- Modify: `src/lib/server/figures.ts` (export `moveFor`), `src/lib/server/copy-lesson.ts` (export `suffixed` stays; nothing else yet)

**Interfaces:**
- Consumes: `linkCopy` (files.ts:59), `roomForOwner` (storage.ts:188), `logChange`, `figureNameTaken`, `variationNameTaken`, `createFigure`/`createVariationIn` (or direct inserts mirroring them), `createCustomExercise`, `addRecording`, `addSpot`, `linkInSpace`, Task 8.
- Produces:
  - `files.ts`: `type CloneFiles = { link(kind: 'recording' | 'lesson-video' | 'audio', file: string): Promise<string>; unlink(kind: 'recording' | 'lesson-video' | 'audio', file: string): Promise<void> }`; `realCloneFiles(): CloneFiles` (dirs and patterns as `copy-lesson`/`copy-song` route code uses today). Specs pass a fake that returns `'copy-' + file` and records calls.
  - `clone.ts`:
    - `type CloneRequest = { kind: CloneKind; id: number; into: Space; recordings: boolean; draft?: boolean; overLimitOk?: boolean; trusted?: boolean; use?: Record<string, number> }` — `trusted` skips the read check and allows an archived source (only Task 17's rescue and Task 18's keep pass it); `use` maps a gene to the row to copy for that family (the twin chosen in Copy to…).
    - `type CloneResult = { ok: true; id: number; made: boolean; archived: boolean } | { ok: false; reason: 'room'; room: Room } | { ok: false; reason: 'name'; message: string } | { ok: false; reason: 'denied' }`.
    - `planClone(db: Db, req: CloneRequest): ClonePlan` — reads only: what rows will be made, the files to link (`{ kind, file, bytes }[]`), the bytes charged to `into`, existing members reused.
    - `cloneTx(tx: Db, req: CloneRequest, linked: Map<string, string>, now: number): CloneResult` — the synchronous write: stamps genes on every source row it copies (root and pieces), inserts the copies with `gene_id` and `cloned_from`, maps references through a per-call `Mapper` (Task 10 fills routine and lesson references), writes the pair snapshot (`initialBase(flatOf(source), skip)`, `skip` = the source's recording pieces when `recordings` is false), logs `add` in a group exactly as that kind's create function does.
    - `cloneInto(db: Db, req: CloneRequest, files: CloneFiles, now: number, freeDiskBytes = Number.POSITIVE_INFINITY): Promise<CloneResult>` — `planClone`; refuse `denied` unless the actor reads the source and edits `into` (a team: owner or editor, group not deleted; mine: its own wall); the source already in `into` → `{ ok, id: source, made: false }`; a member already in `into` → `{ ok, id, made: false, archived }`; room check with `roomForOwner(ownerOf(into), bytes, freeDiskBytes)` unless `overLimitOk`; link files; `cloneTx` in a transaction; on any throw, unlink every linked file and rethrow.
  - **Figure:** filed under `moveFor(tx, into, sourceMoveName): number` — the live move in `into` with the same trimmed, lowercased name, else a new one (an archived one of that name is not revived); the figure's name kept unless taken in that move, then `suffixed(name, sourcePlaceName)` ("Doble (Salsa Tuesdays)"; from a person's own app the suffix is their shown name, `nameOf`); copies notes, partner, `style_tag`, end position, start positions, timing, URL links; recordings only when `req.recordings`, with their sections and section links. No exercise (practice is opt-in, and entries move by re-point).
  - **Drill:** `createCustomExercise` fields: name, notes, practice settings, URL links; `song_id` null.
  - **Song:** source must be `status 'ready'` (else `denied`); audio linked; count data copied (beats, downbeats, anchors, tempo, sample, mime, duration, bpm, size); into a group it is a draft (`shared_at` null); `source_url` copied.

- [ ] **Step 1: Failing tests** in `clone.spec.ts`:
  - `it('a group figure into my app: same move by name, no recordings, family stamped')`: group figure "Enchufla · Doble" with one recording; `cloneInto({ kind:'figure', id, into: U2_SALSA, recordings:false })` → `made: true`; the clone is under u2's move "Enchufla" (made if missing, reused if present); no recording rows; `geneOf(source) === geneOf(clone)`; `clone.clonedFrom === id`; `pairBase(...)!.skip` contains the recording's piece key; `files.link` not called.
  - `it('copying again reuses the member')`: second call → `{ made: false, id: <same> }`; after archiving the clone → `{ made: false, archived: true }`.
  - `it('into a group: recordings come, charged to the group')`: personal figure with two recordings (sizes 100 and 200) into team 1 → two `link('recording', …)` calls, the group's `teamUsedBytes` grew by 300, the person's did not; `team_changes` has one `add` row with actor u1.
  - `it('refuses when the place is full, and leaves no files behind')`: group limit below the bytes → `{ ok:false, reason:'room' }`, no rows, `unlink` called for every linked name (or link never called).
  - `it('a taken name is suffixed')`: u2 already has "Enchufla · Doble" (another family) → the clone is "Doble (Salsa Tuesdays)".
  - `it('denied without read or edit')`: u3 (not a member) → `denied`; a member copying into the group they only read → `denied`.
  - `it('a drill and a song')`: drill fields copied; a song into a group lands with `sharedAt` null; a song still downloading → `denied`.
  - **Review Focus 5:** `it('deleting the source recording leaves the copy playable')`: figure into group with recordings; `deleteRecording` the source's, then `purgeTrash` with fake dirs at `now + TRASH_MS + 1` → the unlinked names never include the copy's file; the copy's row is intact.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones/clone.spec.ts` — FAIL.
- [ ] **Step 3: Implement** `files.ts`, `planClone`, `cloneTx` and `cloneInto` for the three kinds, plus `moveFor` in `figures.ts`.
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): the clone engine for figures, drills and songs`.

### Task 10: The clone engine — routines and lessons; Make my own copy through families

**Files:**
- Modify: `src/lib/server/clones/clone.ts`, `src/lib/server/copy-lesson.ts`, `src/lib/server/copy-song.ts`
- Test: `src/lib/server/clones/clone.spec.ts`, `src/lib/server/copy-lesson.spec.ts` (rewrite the R22 cases), `src/lib/server/copy-song.spec.ts`

**Interfaces:**
- Produces:
  - The `Mapper` inside `cloneTx`: `mapRef(kind: CloneKind, sourceId: number): number | null` — the row in `into` for that family: the source itself when it is already in `into`; else `memberIn(into)` (archived included: the reference points at the archived member, which the caller sees in the result); else, when the actor reads it (or `trusted`), a nested clone of it with the same `recordings` flag; else null (the reference is dropped, as `copy-lesson` drops out-of-reach options). Memoised per call, and a family already being copied returns its pending id, so a section that links back to its own figure does not recurse. `req.use[gene]` replaces the source row for that family.
  - **Routine:** made with the kind's create function (so a personal clone gets the exercise a new routine gets); each slot in order: a child routine through `mapRef('routine', …)` (one level, as today), options through `mapRef('figure', …)` with the main figure first; a slot whose every option dropped is dropped; slot notes copied.
  - **Lesson:** made with `createLesson` (a personal clone gets its review exercise); title, day, notes, URL links; hand links through `mapRef`; lesson videos with new file names (`link('lesson-video', …)`), their sections, and each section link through `mapRef`; into a group always a draft (`published_at` null), whatever the source was.
  - `copyLesson(db, userId, lessonId, now, files, freeDiskBytes)` keeps its exported signature and `CopyResult` shape and becomes `cloneInto({ kind:'lesson', id: lessonId, into: wallOf(lesson.dance, userId), recordings:false }, …)` (its `CopyFiles` adapted to `CloneFiles`); R22's name matching of figures is gone (moves are still matched by name in `moveFor`). `copySummary` and `copyCost` read `planClone`. `copySong` likewise. Both wrappers are removed in Task 23.

- [ ] **Step 1: Failing tests:**
  - `it('a routine brings its figures and its embedded routine')`: group routine R (slot 1: options Doble (main) and Básica; slot 2: child routine S with option Setenta) into u2's app → R′ with S′, three figure clones, options in the same order, the same main figure; a figure u2 already has a member of is reused, not doubled.
  - `it('an option the actor cannot read is dropped')`: a personal routine of u1 whose option is a figure of a group u1 left → that slot's option is not in the group clone.
  - `it('a lesson brings videos, sections, section links and hand links')`: group lesson with one video (one section linked to Doble) and a hand link to a drill → personal clone with one video (new file name), one section, its link pointing at u2's clone of Doble, a hand link to u2's clone of the drill; storage charged to u2.
  - `it('into a group a lesson is a draft')`.
  - `it('a section linking back to its own figure does not loop')`: figure with a recording whose section links that same figure, into a group → one figure clone, one section link to it.
  - `copy-lesson.spec.ts`: `it('copying a lesson twice reuses the first copy')` replaces "makes two copies"; `it('two lessons linking one group figure share one copy of it')` replaces the R22 name-match case (moves still join by name: assert one move "Enchufla").
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones src/lib/server/copy-lesson.spec.ts src/lib/server/copy-song.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): routines and lessons clone with their references; Make my own copy reuses the family`.

### Task 11: Re-point a person's own rows

**Files:**
- Create: `src/lib/server/clones/repoint.ts`, `src/lib/server/clones/repoint.spec.ts`

**Interfaces:**
- Produces:
  - `type RepointReport = { routines: { id: number; name: string }[]; lessons: { id: number; title: string }[]; sections: number; entries: number; twins: number }`.
  - `repointPreview(db: Db, userId: string, dance: DanceSlug, kind: CloneKind, fromId: number): RepointReport` — what `repoint` would move; reads only.
  - `repoint(tx: Db, userId: string, dance: DanceSlug, kind: CloneKind, fromId: number, toId: number, opts: { entries: boolean; addLesson?: boolean }, now: number): RepointReport` — only rows **owned by `userId`** (personal rows of this dance, and the person's own entries), never a group's rows, never another person's:
    - **figure:** `routine_step_options` of the person's routines (a slot that already holds `toId` loses the `fromId` row instead: primary key); `lesson_figures` of the person's lessons (same clash rule); `spot_links` on sections of the person's videos (unique `(spot, figure)`: same rule); with `entries`, the person's exercise on `fromId` (an entry or their own figure exercise): when they already have one on `toId`, its sets move there (`sets.exercise_id`) and the old one is archived ("merge"), else its `figure_id` becomes `toId`; `twins` rows of the person for `fromId` become `toId` (a clash deletes the old row).
    - **routine:** `routine_steps.child_routine_id` in the person's routines; `lesson_routines`; entries on `routine_id` (merge rule); twins.
    - **drill:** `spot_links.exercise_id`; `lesson_exercises`; practice: from a group drill (the person's `'added'` entry) to a personal drill, sets move onto the personal drill and the entry is archived; from a personal drill to a group drill, the entry is ensured (revived or made, `source 'added'`) and sets move to it. Without `entries`, practice stays.
    - **song:** the person's exercises' `song_id`; their `song_drops` rows for `fromId` are deleted.
    - **lesson:** entries on `lesson_id` (merge rule); twins; with `addLesson`, `toId` (a group lesson) gets a `lesson_adds` row (`touch:false`).
- The caller archives `fromId` when its flow says so; `repoint` never archives a root.

- [ ] **Step 1: Failing tests**, one `it` per kind and rule:
  - a personal routine's option moves to the target;
  - a slot already holding the target keeps one option row;
  - the person's own lesson link moves;
  - a section link moves (and the clash case);
  - entry merge: sets of both end on one exercise, the other is archived;
  - entry move without a target entry;
  - `entries:false` leaves practice;
  - a group routine's option on `fromId` is untouched;
  - u3's routine on `fromId` is untouched;
  - drill practice both directions;
  - song ids and song drops;
  - `addLesson` inserts the add once;
  - `repointPreview` equals the report of a following `repoint`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones/repoint.spec.ts` — FAIL.
- [ ] **Step 3: Implement** with `ownedBy`/`inSpace` for "the person's" (the space-rules spec forbids raw `userId` equality on content tables).
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): re-point a person's own rows`.

### Task 12: Twins data, the trash's family check, and two integrity checks

**Files:**
- Create: `src/lib/server/twins.ts`, `src/lib/server/twins.spec.ts`
- Modify: `src/lib/server/trash.ts` (`restoreTrash`), `src/lib/teams/deleted.ts` (a reason), `src/lib/server/integrity.ts`, `src/hooks.server.ts` or wherever `ownerIntegrity` is logged at boot
- Test: `src/lib/server/trash.spec.ts`, `src/lib/server/integrity.spec.ts`

**Interfaces:**
- Produces:
  - `twins.ts`:
    - `markTwins(db: Db, wall: Wall, kind: TwinKind, ids: number[]): boolean` — false unless every id is a live row of that kind and dance that the person reads, and there are at least two; the sets any of them were in merge into one `set_id`.
    - `separate(db: Db, wall: Wall, kind: TwinKind, id: number): boolean` — removes its row; a set left with one row loses it too.
    - `twinsOf(db: Db, userId: string, kind: TwinKind, id: number): number[]` — the other rows of its set that the person still reads and are live.
    - `twinSets(db: Db, wall: Wall, kind: TwinKind): number[][]` — sets with at least two such rows.
  - `restoreTrash`: before inserting, every snapshot row of `recordings`, `lesson_videos`, `video_spots` with a gene is checked against its parent (a recording's figure, a video's lesson, a section's recording or video): another live row there with that gene refuses with `reason: 'family'`; `deleted.ts` maps it to "A copy of this is here already."
  - `integrity.ts`:
    - `familyIntegrity(db: Db): string[]` — a piece parent holding two rows of one gene.
    - `crossRefs(db: Db): string[]` — two kinds of line:
      - a group row pointing outside its group: a slot option, an embed, a section link from a group video, a group lesson's link;
      - a person's row pointing at a group row the person does not read: their slots, embeds, section links, lesson links, entries' targets.
    - Both are logged at boot beside `ownerIntegrity`, and exported for specs.

- [ ] **Step 1: Failing tests:**
  - `twins.spec.ts`: marking two then a third merges into one set; marking across kinds or across dances is refused; `twinsOf` hides a row the person stopped reading; `separate` on a pair removes both rows.
  - `trash.spec.ts`: `it('restoring a recording the family has here again is refused')`: a group figure with a stamped recording; delete it (trash); a Send-like insert of a recording with the same gene on the same figure; `restoreTrash` → `{ ok:false, reason:'family' }`.
  - `integrity.spec.ts`: a hand-inserted group slot option pointing at a personal figure → one `crossRefs` line; a personal routine option on a group figure of a group the person is not in → one line; the same person as a member → none.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/twins.spec.ts src/lib/server/trash.spec.ts src/lib/server/integrity.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): twins data, the trash's family check, cross-reference integrity`.

# Phase C — Using without copying, and leaving (ship point after Task 21, together with Phase B)

The rule this phase adds: **a person's own routine, lesson or section may point at a group row the person can use**, and reading it always goes through `access.ts`. "Can use" is `usableOf` below: what their added lessons reach (what Moves shows them), plus what their own rows already point at that they still read. Group rows still point only inside their group.

### Task 13: Your routines can use a group's figures and routines

**Files:**
- Create: `src/lib/server/usable.ts`, `src/lib/server/usable.spec.ts`
- Modify: `src/lib/server/graph.ts` (`buildGraph`), `src/lib/server/routines.ts` (`addOption`, `restoreOption`, `insertSlot`, `restoreSlots`, `canEmbed`, `embeddable`, `createRoutineFromFigures`), `src/lib/server/figures.ts` (`figureLabels`, `listFiguresForCall`), `src/routes/[dance]/routines/[id]/+page.server.ts`, `src/routes/[dance]/routines/+page.server.ts`, `src/routes/[dance]/player/+page.server.ts`
- Test: `src/lib/server/routines.spec.ts`, `src/routes/[dance]/routine-forms.spec.ts`, `src/routes/[dance]/player/*.spec.ts`

**Interfaces:**
- Consumes: `addedTeams`, `addedReach`, `figureAccess`, `routineAccess`, `drillAccess`.
- Produces:
  - `type Usable = { figures: Set<number>; routines: Set<number>; drills: Set<number> }` (server-only, in `usable.ts`).
  - `usableOf(db: Db, wall: Wall): Usable` — for each team in `addedTeams(db, wall)`, `addedReach(db, wall.userId, teamId)`; plus every group row the person's own slots, embeds, section links and lesson links point at that the person still reads. Personal rows are not in it (they are the wall's own).
  - `buildGraph(db: Db, space: Space, extra?: Set<number>): Graph` — `extra` figures (live, in live moves) join the graph.
  - `graphFor(db: Db, space: Space): Graph` — a `Wall` gets `buildGraph(db, wall, usableOf(db, wall).figures)`; a `TeamSpace` gets `buildGraph(db, space)` as today.
  - `figureLabels(db, space)` and `listFiguresForCall(db, space, ids)`: for a `Wall`, also the usable figures' labels and calls.
  - Routine write rules, for a **personal** routine: an option, a restored option, an inserted figure slot, restored slots, `createRoutineFromFigures` accept a figure in the routine owner's `graphFor`; `canEmbed`/`embeddable` accept a child that is the owner's or in `usableOf(...).routines` (one level, as today: a child that embeds is refused). For a **group** routine nothing changes: same space only.

- [ ] **Step 1: Failing tests:**
  - `usable.spec.ts`: u2 adds a published lesson linking group figure F and routine R → `usableOf(U2_SALSA)` has F, R and R's options; a published lesson u2 did not add gives nothing; after u2 links F in a slot and then removes the lesson (`removeLesson`), F is still usable while u2 still reads it (member, published).
  - `routines.spec.ts`: `it('a personal routine takes a usable group figure')`: `addOption` → true, and `routineShapes` + `graphFor` flatten the slot with F's label; `it('…not a figure of a group the person is not in')` → false; `it('a group routine still refuses a personal figure')`; `it('a personal routine embeds a usable group routine')` → `canEmbed` true and `embeddable` lists it; `restoreSlots` of a snapshot holding F → true.
  - Player route spec: a personal routine with F in a slot → the load's plan calls F by name (`callNames` has F).
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/usable.spec.ts src/lib/server/routines.spec.ts src/routes/[dance]` — FAIL.
- [ ] **Step 3: Implement**; the routine page, Routines list (breaks, loops) and player use `graphFor` and the wall-aware labels for a personal routine.
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): your routines can use a group's figures and routines`.

### Task 14: Your sections and lessons can link a group's figures, routines and drills

**Files:**
- Modify: `src/lib/server/spot-links.ts` (`targetDance`, `linkInSpace`, `sectionsFor`, `linkableSections`), `src/lib/server/lessons.ts` (`linkFigure`, `linkRoutine`, `linkExercise`, `listLinkableFigures`, `listLinkableRoutines`, `listLinkableExercises`), `src/lib/server/link-popup.ts` (`linkOptions`)
- Test: `src/lib/server/spot-links.spec.ts`, `src/lib/server/lessons.spec.ts`, `src/lib/server/link-popup.spec.ts`

**Interfaces:**
- Produces:
  - `linkInSpace(db, space, spotId, target)`: for a `Wall` space, a target in `usableOf(db, wall)` (figure or drill) is accepted besides the wall's own; a `TeamSpace` is unchanged.
  - `linkFigure`, `linkRoutine`, `linkExercise` on a **personal** lesson accept a usable group row (ruling 2); `linkExercise` still refuses an entry (`source` not `'custom'`).
  - `sectionsFor(db, target, visible?)` called for a group figure or drill by a person also returns that person's own sections linked to it (their own videos), after the group's own; `linkableSections` unchanged.
  - `linkOptions` (the Link popup on a personal video) and the three `listLinkable*` (a personal lesson) also offer usable group rows, each tagged with its team (`team: TeamRef`, added to `FigureVersion` and `PickExercise` as optional).

- [ ] **Step 1: Failing tests:** u2 links a section of their own lesson video to group figure F (usable) → 201 and the link exists; to a figure of a group u2 is not in → refused as today; u2 links F to their own lesson → true, and `viaSections`/the lesson page list it; a group lesson still refuses u2's personal figure; `sectionsFor(F)` for u2 includes u2's own section after the group's; `linkOptions` for u2's video lists F with `team.name` set.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/spot-links.spec.ts src/lib/server/lessons.spec.ts src/lib/server/link-popup.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): your sections and lessons can link what your groups gave you`.

### Task 15: The pickers offer what your groups gave you

**Files:**
- Modify: `src/lib/picker/build.ts` (`variationEntries`, `linkOptionGroups`, `exerciseGroups`, `routineRows`), `src/lib/components/routines/SlotPicker.svelte`, `src/routes/[dance]/routines/[id]/+page.server.ts` (`candidates`), `src/lib/routines/fit.ts` if it keys by name
- Create: `src/lib/clones/view.ts` (started here; later tasks add to it), `src/lib/clones/view.spec.ts`
- Test: `src/lib/picker/build.spec.ts`

**Interfaces:**
- Produces:
  - `src/lib/clones/view.ts`: `possessive(name: string): string` ("Salsa Tuesdays" → "Salsa Tuesdays’", "Rueda club" → "Rueda club’s"); `usedAsIs(team: string): string` → "Salsa Tuesdays’ · used as it is".
  - `variationEntries` keeps one heading per move **id** and shows a group's rows under their own heading with the meta `usedAsIs(team)`; `linkOptionGroups` groups by move id, not by name (today's comment "Figure names are unique per dance" stops being true); two moves named "Enchufla" (yours and a group's) are two headings, the group's labelled "Enchufla · Salsa Tuesdays".

- [ ] **Step 1: Failing tests** in `build.spec.ts`: rows from your move "Enchufla" and Salsa Tuesdays' move "Enchufla" give two headings, the second's text "Enchufla · Salsa Tuesdays" and its rows' meta "Salsa Tuesdays’ · used as it is"; `linkOptionGroups` with the same pair gives two headings. `view.spec.ts`: `possessive('Salsa Tuesdays')` → "Salsa Tuesdays’" and `possessive('Rueda club')` → "Rueda club’s" (a final "s" takes "’", anything else "’s", as the boards write them); `usedAsIs('Salsa Tuesdays')` → "Salsa Tuesdays’ · used as it is".
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/picker src/lib/clones` — FAIL.
- [ ] **Step 3: Implement**; the routine page's `candidates` add the usable group figures and routines (Task 13), with their team.
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): pickers offer your groups' figures, by move`.

### Task 16: What a group's figure shows you, and your slot that uses it

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts`, `+page.svelte`, `src/routes/[dance]/routines/[id]/+page.svelte`, `src/lib/components/routines/SlotList.svelte`, `src/lib/clones/view.ts`
- Test: `src/lib/clones/view.spec.ts`, `src/routes/[dance]/figures/figure-page.spec.ts` (or the existing figure page spec)

**Interfaces:**
- Produces in `view.ts`:
  - `fromLessonNote(lesson: string, team: string): string` → "From Week 6. Use it in your routines as it is; it stays Salsa Tuesdays’."
  - `groupSlotNote(figures: string[], team: string): string` → "Setenta is Salsa Tuesdays’. If you leave the group, you keep a copy and this routine keeps working." (several names joined with " and ", verb "are").
- The figure page load for a reader of a group figure adds `fromLesson: string | null` (the newest lesson they added that holds it), `myRoutines` (`routinesUsing` over the **person's** shapes and `graphFor(wall)`, after the group's own), and the person's own linked sections (Task 14's `sectionsFor`).
- The routine page marks each option that is a group's with a source chip (the group's name, board C1 p3) and shows `groupSlotNote` under the slot list when any slot uses a group figure.

- [ ] **Step 1: Failing tests:** the two pure lines; the figure page as u2 (member, added lesson "Week 6") → `fromLesson: 'Week 6'`, `myRoutines` holds u2's routine that uses it, the sections list holds u2's own section; as the owner → `fromLesson: null`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): a group's figure shows where you use it`.

### Task 17: The rescue when reach shrinks

**Files:**
- Create: `src/lib/server/clones/rescue.ts`, `src/lib/server/clones/rescue.spec.ts`
- Modify: `src/lib/server/entries.ts` (`reconcileEntries` calls `rescueUsed` first)

**Interfaces:**
- Consumes: `cloneTx` (Task 9, `trusted: true`, `recordings: false`), `repoint` (Task 11), `crossRefs` (Task 12).
- Produces: `rescueUsed(tx: Db, teamId: number, now: number, userId?: string): number` — finds personal rows (of `userId`, or of anyone) that point at this team's rows (options, embeds, section links, lesson links); for each person and target the person no longer reads (`figureAccess`/`routineAccess`/`drillAccess` null), clones the target into the person's wall (`trusted`, an archived source allowed, no files) and re-points that person's rows to the clone with `entries: true` (ruling 6); returns how many it cloned. A target the person still reads is left alone. A person with a member of that family already gets re-pointed to it (archived or not), with no clone. Synchronous: it runs inside the caller's transaction.
- `reconcileEntries(tx, teamId, now, userId?)` calls `rescueUsed(tx, teamId, now, userId)` before reconciling entries, so an entry moved to a rescued copy is not archived.

- [ ] **Step 1: Failing tests**, one per shrink path. Each ends with `expect(crossRefs(db)).toEqual([])` and checks u2's routine (or lesson, or section) now points at u2's copy:
  - `archiveVariation` of F, which u2's routine uses (u2's entry on F moves to the copy with its sets);
  - `unlinkFigure` of F from the only lesson that reached it;
  - `archiveLesson` of that lesson;
  - `archiveRoutine` of a group routine u2's routine embeds (the copy comes with its figures);
  - `removeOption` / `deleteSlots` on a group routine that was the only way u2 reached F;
  - `archiveExercise` of a group drill u2's section links;
  - `unlinkSpot` that took a drill out of reach;
  - `setRole` demoting u2 from editor while u2's routine used a draft-only group figure;
  - and the negative case: archiving a figure u2 only reads (no own row uses it) makes no copy.
  Restoring F afterwards does not undo u2's copy (asserted, documented).
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones/rescue.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it and `nix develop -c npx vitest run src/lib/server` (every existing reconcile caller still passes) — PASS. `nix develop -c npm run check`. Commit: `feat(clones): when an editor takes away what your routine uses, you get a copy`.

### Task 18: Keeping copies of a group's things

**Files:**
- Create: `src/lib/server/clones/keep.ts`, `src/lib/server/clones/keep.spec.ts`
- Modify: `src/lib/types.ts` (`KeepPreview`, `KeepChoice`)

**Interfaces:**
- Produces:
  - `type KeepItem = { kind: CloneKind; id: number; name: string; meta: string; bytes: number; used: string | null /* the person's routine or lesson that uses it, if any */; inLesson: number | null /* the kept lesson that brings it */ }`.
  - `type KeepPreview = { lessons: KeepItem[]; figures: KeepItem[]; routines: KeepItem[]; songs: KeepItem[]; drills: KeepItem[]; allBytes: number; usedBytes: number; usedNames: string[]; limitBytes: number | null; nowBytes: number }`.
  - `type KeepChoice = { mode: 'all' } | { mode: 'used' } | { mode: 'chosen'; lessons: number[]; figures: number[]; routines: number[]; songs: number[] }`.
  - `keepPreview(db: Db, userId: string, teamId: number): KeepPreview`. "Everything" is:
    - the person's added lessons that are live and published, with the figures, routines and drills they reach (`addedReach`);
    - every group row the person practises (their entries' targets);
    - every group row the person's own rows use (as `rescueUsed` finds them);
    - the group's shared, live songs, plus any group song the person's entries picked.
  - `keepFromTeam(db: Db, userId: string, teamId: number, choice: KeepChoice, files: CloneFiles, now: number): Promise<{ kept: number }>`:
    - **What is kept.** `'chosen'` is widened by everything the person's own rows use, and by everything a chosen lesson brings. `'used'` is exactly what own rows use.
    - **How.** Plan, link files, then one transaction:
      - each item is copied with `cloneTx` (`recordings: true`, `overLimitOk: true`, `trusted: true`), reusing an existing member (never overwriting it);
      - `repoint` (with `entries: true`) moves the person's rows from the group's row to the copy;
      - the person's entries on group songs not kept drop to count only (`dropSongs`);
      - the person's `lesson_adds` for the group's lessons are deleted.
    - It does not touch membership: Task 19's callers do.

- [ ] **Step 1: Failing tests:**
  - **Keep everything.** u2 (member) with an added lesson (one video, one section), a figure with one recording, a routine, a class song, an entry on the figure with sets, and an own routine using another group figure. `keepFromTeam('all')` gives u2:
    - a lesson copy with its video and section;
    - figure copies with their recordings (files linked);
    - the routine and the song;
    - the entry moved to the figure copy with its sets;
    - u2's own routine re-pointed;
    - no `lesson_adds` for the team.
    u2's storage counts the files. After deleting u2's membership row, `crossRefs` is `[]`.
  - **Keep only what my routines use:** only that figure is copied, and nothing else of the group.
  - **Choose:** choosing the lesson keeps its figures even if unticked, and an unticked song is not kept.
  - **Already copied (Review Focus 4):** u2 already copied F into their app, so keep reuses it (one member, not two).
  - **Over the limit:** u2 at their limit still keeps everything; then `roomFor` refuses an upload.
  - **Preview:** `keepPreview` counts match the items; `usedNames` is `['Setenta · Básico']`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones/keep.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): keep copies of a group's things`.

### Task 19: Leaving, removal, a deleted group's purge, and people who already left

**Files:**
- Modify: `src/lib/server/membership.ts` (`leaveTeam`, `removeMember`), `src/lib/server/team-purge.ts` (`purgeTeams`), `src/lib/server/trash.ts` (`startTrashPurge`: one boot run of `settleFormerMembers`), `src/routes/[dance]/groups/[id]/people/+page.server.ts` (`remove` passes files), `src/routes/[dance]/groups/[id]/+page.server.ts` (`leave` passes `{ mode: 'all' }` until Task 21)
- Create: `src/lib/server/clones/settle.ts`, spec beside it
- Test: `src/lib/server/membership.spec.ts`, `src/lib/server/team-purge.spec.ts`, `src/routes/[dance]/groups/leaving.spec.ts`

**Interfaces:**
- Produces:
  - `leaveTeam(db: Db, teamId: number, userId: string, choice: KeepChoice, files: CloneFiles, now: number): Promise<'left' | 'owner'>` — owner refused first; then `keepFromTeam`; then, in one transaction, the membership row is deleted and `reconcileEntries(tx, teamId, now, userId)` runs.
  - `removeMember(db: Db, teamId: number, userId: string, files: CloneFiles, now: number): Promise<boolean>` — same with `{ mode: 'all' }`.
  - `purgeTeams(db, now, dirs?)` — for every `team_members` row of a team due for purge (owner included), `keepFromTeam('all')` **before** `purgeRows` unlinks the group's files; the kept copies have their own file names.
  - `settleFormerMembers(db: Db, files: CloneFiles, now: number): Promise<number>` — every person with `lesson_adds` on a team's lessons, no `team_members` row, and the team not purged, gets `keepFromTeam('all')`. Idempotent: their adds are gone afterwards. Run once at boot.

- [ ] **Step 1: Failing tests:**
  - `leaveTeam` with `'used'` keeps only what's used and removes the membership.
  - `removeMember` keeps everything.
  - The owner still gets `'owner'`.
  - **Purge (Review Focus 5):** a group deleted at t, purged at t + 30 days. Its member u2 ends with copies whose files exist, i.e. none of the unlink calls named them. Its recordings' original names were unlinked.
  - **Settle:** `settleFormerMembers` gives a person who left before this shipped (an add without a membership) their copies, and a second run does nothing.
- [ ] **Step 2: Run** the specs — FAIL.
- [ ] **Step 3: Implement**; routes pass `realCloneFiles()`.
- [ ] **Step 4: Run** — PASS. `nix develop -c npm run check` — PASS. Commit: `feat(clones): leaving, removal and a purge keep copies`.

### Task 20: The wall: after leaving you read nothing of the group

**Files:**
- Modify: `src/lib/server/access.ts` (`lessonsReached`, `addedLessonIds`, `addedTeams`), `src/lib/server/lessons.ts` (`listMyLessons`, `lessonDays`), `src/lib/server/entries.ts` (`newInLesson`, `isAdded`, `addState`), `src/lib/server/copy-lesson.ts` (`copyable`), `src/lib/teams/view.ts` (drop `leftLine`), `src/routes/[dance]/lessons/[id]/+page.server.ts` (`lessonNotice`), `CLAUDE.md` (the wall rule: "and through lessons they added after leaving" → "a member of a deleted group, until its purge, through the lessons they added"; the `access.ts` layout line likewise)
- Test: `src/routes/[dance]/groups/leaving.spec.ts` (rewritten), `src/lib/server/access.spec.ts`

**Interfaces:**
- Produces: `lessonsReached(db, userId, teamId)`:
  - a member of a live group gets every published, live lesson (as today);
  - a person who still has a `team_members` row in a deleted, not purged group gets their added lessons (as today, ruling 4);
  - **anyone else gets `[]`.**
  
  `addedLessonIds` and `addedTeams` require the person's `team_members` row and the team not purged; `listMyLessons` and `lessonDays` use them.

- [ ] **Step 1: Failing tests** (Review Focus 3). After u2 leaves Salsa Tuesdays, u2 gets 404 on:
  - the group's lesson page, a figure page and a routine page;
  - `/recordings/<file>`, `/lesson-videos/<file>` and `/audio/<file>` of the group;
  - the player with a group routine.

  And the group is absent from:
  - Moves' and Routines' group sections;
  - the Lessons tab;
  - `lessonDays`;
  - `whatsNew`.

  u2's entries on the group's rows are gone (moved to copies by Task 19, or archived), and u2's own copies are in all those lists instead. A member of a *deleted* group still reads their added lesson until the purge.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): former members read nothing of the group`.

### Task 21: The leave sheet, and your copies in Lessons

**Files:**
- Create: `src/lib/teams/leave-view.ts`, `src/lib/teams/leave-view.spec.ts`, `src/lib/components/teams/LeaveSheet.svelte`, `src/routes/api/teams/[id]/keep/+server.ts` (GET: the preview)
- Modify: `src/routes/[dance]/groups/[id]/+page.svelte` (the Leave row opens `LeaveSheet` instead of the dialog), `+page.server.ts` (`leave` reads `mode` and, for `chosen`, `lesson`, `figure`, `routine`, `song` ids), `src/routes/[dance]/groups/[id]/people/+page.svelte` (remove dialog text), `src/lib/server/lessons.ts` (`LessonItem.copyOf: string | null`), `src/routes/[dance]/lessons/+page.svelte`, `src/lib/lessons/*.ts` (row meta), `src/lib/page-epoch.ts` (raise)

**Interfaces:**
- Produces in `leave-view.ts`:
  - `leaveTitle(team): string` → "Leave Salsa Tuesdays?"
  - `leaveSub` → "After leaving you see nothing of the group. You keep copies of what you choose."
  - `everythingMeta(p: KeepPreview): string` → "6 lessons, 9 figures, 3 routines, 5 songs · 1.2 GB counted to you". Zero counts are left out; bytes use `format.ts`.
  - `usedMeta(names: string[], routine: string | null): string` → "Setenta, which Week 4 loop uses. Everything else goes". Several names are joined with " and "; with no own rows: "Nothing of yours uses it. Everything goes".
  - `overLimitLine(limit: number): string` → "That takes you over your 1 GB. You can still practise; new uploads wait until you’re under."
  - `reconnectNote` → "What you keep becomes your copies. Rejoin later and they reconnect."
  - `chooseButton(n): string` → "Leave and keep 3".
  - `lockedMeta(meta, by: 'routine' | 'lesson'): string` → "1 recording · used by your routine".
  - Removal dialog body: "They leave the group and keep copies of what they had."
  - Lessons list: a personal lesson whose `cloned_from` is a group's lesson gets `copyOf: <group name>`, meta "Your copy · from Salsa Tuesdays" and a "Copy" chip (board C6 p3).

- [ ] **Step 1: Failing tests:** each pure line, with the board's exact text. A route spec: `leave` with `mode=chosen&lesson=…` keeps exactly that, plus what u2's routines use. A missing or unknown `mode` returns 400. The Lessons load marks a copy with `copyOf: 'Salsa Tuesdays'`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `LeaveSheet` (boards C6 p1 and p2):
  - It fetches the preview when it opens.
  - Three radio choices, Keep everything preselected.
  - "Choose what to keep" opens the second level: boxes per section. A lesson's items are ticked and locked while it is ticked; items used by own rows are locked with `lockedMeta`.
  - The over-limit line shows when `nowBytes + allBytes > limitBytes` (or the chosen bytes).
  - The submit uses `use:enhance`, then `gotoWhenSettled('/{dance}/groups')`.
  - Raise `PAGE_EPOCH`: the `leave` action's fields changed.
- [ ] **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): leaving asks what to keep`.

**Ship point B+C.** Migration 0027 runs here. Before deploying, run the migration dry run in `docs/deployment.md` (Task 34 adds 0027 to it; until then run it the same way as for 0023–0025) and the boot's `settleFormerMembers` count must be logged.

# Phase D — Working with clones (ship point after Task 30)

### Task 22: Yours replaces theirs in what you see

**Files:**
- Create: `src/lib/server/clones/shadow.ts`, `src/lib/clones/shadow.ts` (PURE), specs beside both
- Modify: `src/lib/server/figures.ts` (`listAddedFigures`), `src/lib/server/routines.ts` (`listAddedRoutines`), `src/lib/server/lessons.ts` (`listMyLessons`), the Music load's group-song section (`src/routes/[dance]/songs/+page.server.ts` or where class songs are listed), `src/lib/server/usable.ts` (pickers), `src/routes/[dance]/lessons/[id]/+page.server.ts` (link cards on a group lesson)

**Interfaces:**
- Produces:
  - `myMembers(db: Db, wall: Wall, kind: CloneKind, genes: (string | null)[]): Map<string, number>` — gene → the person's own **live** member.
  - PURE `shadow<T extends { gene: string | null }>(theirs: T[], mine: Map<string, number>): T[]` — drops every row whose gene has a member of yours.
  - PURE `swapToMine<T extends { id: number; gene: string | null }>(rows: T[], mine: Map<string, number>): (T & { mineId: number | null })[]` — for link cards: same rows, each marked with your member's id when you have one.
  - Where it applies (the spec's "only in what is shown to you"):
    - Moves' group sections;
    - Routines' group sections;
    - the Lessons tab (a group lesson you made yours shows once, as yours);
    - the Music tab's class songs;
    - every picker's usable group rows;
    - a group lesson's link cards, which open your copy, labelled "Yours".

    It does not apply to a group routine's own plan, coverage, the gap report or Today.
  - `usableOf` keeps the shadowed group rows (your existing slots on them stay valid until re-pointed); only the pickers hide them.

- [ ] **Step 1: Failing tests:**
  - **Pure:** `shadow` and `swapToMine` on three rows with one shadowed.
  - **Server:**
    - u2 made Setenta theirs, so Moves' Salsa Tuesdays section no longer lists Setenta.
    - The SlotPicker candidates hold u2's Setenta, not the group's.
    - The group lesson Week 6's figure card for Setenta has `mineId` set.
    - u2's clone archived makes the group's row show again.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): your copy shows in place of the group's`.

### Task 23: Edit makes it yours

**Files:**
- Create: `src/lib/server/clones/edit.ts`, `src/lib/server/clones/edit.spec.ts`, `src/lib/components/clones/MakeMineSheet.svelte`
- Modify: `src/lib/clones/view.ts`; the five pages' loads and actions: `src/routes/[dance]/figures/[id]`, `src/routes/[dance]/routines/[id]`, `src/routes/[dance]/exercises/[id]` (a drill), `src/routes/[dance]/songs/[id]`, `src/routes/[dance]/lessons/[id]`; remove the `copy` actions on lessons and songs and their "Make my own copy" buttons (ruling 12), and delete `copy-lesson.ts`'s and `copy-song.ts`'s wrappers (callers move to `makeMine`); `src/lib/page-epoch.ts` (raise: the `copy` actions are gone)

**Interfaces:**
- Produces:
  - `makeMinePreview(db: Db, wall: Wall, kind: CloneKind, id: number): { title: string; repoint: RepointReport; bytes: number; existing: { id: number; archived: boolean } | null }`.
  - `makeMine(db: Db, wall: Wall, kind: CloneKind, id: number, files: CloneFiles, now: number, freeDiskBytes: number): Promise<CloneResult>`:
    - copies the row into the wall with `cloneInto` (`recordings: false`; a lesson brings its videos, charged to you);
    - then re-points with `repoint(entries: true)`, moving the person's own rows from the group's row to the copy;
    - an existing archived member is restored and re-pointed instead (`restoreVariation`/`restoreRoutine`/… with the wall);
    - a live existing member is just re-pointed.
  - `view.ts`:
    - `makeMineTitle(label: string): string` → "Make Setenta · Básico yours?"
    - `MAKE_MINE_SUB` → "Editing makes your own copy. The class’s stays as it is."
    - `youGet(kind): string` (figure: "Its name, timing, positions and notes, to change as you like."; routine: "Its name, notes and slots, to change as you like."; drill: "Its name, notes and practice, to change as you like."; song: "Its title, artist and count, to change as you like."; lesson: "Its title, notes, links, videos and sections, to change as you like. The videos count against your space.")
    - `staysTheirs(kind, team): { title: string; body: string } | null` (figure only: "STAYS SALSA TUESDAYS’" / "Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).")
    - `switchNote(r: RepointReport, practised: boolean): string | null` → "Your routine Week 4 loop and your practice of it switch to your copy." Variants:
      - routines only: "Your routine Week 4 loop switches to your copy."
      - two routines: "Your routines Week 4 loop and Shines switch…"
      - practice only: "Your practice of it switches to your copy."
      - nothing to move: null.
    - `restoreLine` → "You had your own copy. Restore it?"
  - Pages:
    - **Edit button.** For a person who only *reads* a group's row (ruling 1), Edit opens `MakeMineSheet`; on success, `gotoWhenSettled` goes to the copy's page. An editor's Edit is unchanged.
    - **Figure page buttons.** The figure page's pinned row for a reader is Edit plus Practise (board C1 p1).
    - **Lesson page.** It loses "Make my own copy". Its 413 refusal shows the existing Ask-for-more line.

- [ ] **Step 1: Failing tests:**
  - **Figure:** u2's Edit on group figure F, which u2's routine uses and u2 practises, gives:
    - a copy under u2's "Setenta" move;
    - the routine's option on the copy;
    - the entry moved with its sets;
    - the action redirecting to the copy.
  - **Repeat Edit:** a second Edit on F (after shadowing u2 would not normally see it, but by URL) re-points to the same copy.
  - **Edit after Drop (Review Focus 4):** after archiving the copy, Edit restores it.
  - **Lesson:** a lesson as u2 at their storage limit is refused 413 with no rows made.
  - **Pure:** each line above, with the board's text.
  - **Removed actions:** the `copy` actions return 404/405.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): Edit on a class's figure, routine, drill, song or lesson makes it yours`.

### Task 24: A tab per source, and taking a recording

**Files:**
- Create: `src/lib/server/clones/sources.ts`, spec; `src/lib/components/clones/SourceTabs.svelte`
- Modify: `src/lib/clones/view.ts`; the five pages (`+page.server.ts` loads `sources`; `+page.svelte` draws `SourceTabs` at the top of the body, board C2 p2); `src/routes/[dance]/figures/[id]/+page.server.ts` (action `takeRecording`)

**Interfaces:**
- Produces:
  - `sourcesOf(db: Db, userId: string, kind: CloneKind, id: number): Source[]`:
    - **Order:** the page's own row first, then the person's own member (labelled "Yours" if it is not the page's), then other visible family members by group name, then visible twins (Task 12's `twinsOf`; empty until Phase E marks any).
    - **Status:** each clone's `status` is computed against the page's row with `diff(pairBase, …)`: no diffs → `'same'`; every diff's side `'mine'` → `'behind'`; every side `'theirs'` → `'newer'`; otherwise → `'differs'`.
    - **Changed:** `changed` lists the diffs' labels, with pieces counted ("1 recording", "2 sections").
    - **Fewer than two:** a page with fewer than two sources gets `[]` and no tabs.
  - **The tabs.** `SourceTabs` is a `Segmented` row. Each tab links to that member's own page, with `?vs=<page's own member id>` when the page's row is yours (the source's page then knows whose Take target it is), and the link replaces the history entry.
  - **On a source's page opened with `vs`:**
    - the note "Salsa Tuesdays’ version, read-only. Take what you want into yours." shows;
    - each recording shows "already in yours" when your member holds its gene, else "New · 0:41" with a Take button.
  - **Subtitles:** `cloneSubtitle(s: { self: PlaceRef; clonedFrom: string | null; groups: number; twins: number; kind: CloneKind }): string` →
    - "Your copy · from Salsa Tuesdays"
    - "Salsa Tuesdays’ figure" (or routine / drill / song / lesson)
    - "Yours · in 2 groups"
    - "Twins · 3 versions"
    - else the page's usual subtitle (null)
  - `takeRecording(db: Db, wall: Wall, intoFigureId: number, recordingId: number, files: CloneFiles, now: number, freeDiskBytes: number): Promise<CloneResult>`:
    - copies one recording, with its sections and their section links (mapped as in Task 10), into your figure;
    - refused when your figure already holds that gene;
    - charged to you;
    - removes that piece from the pair's `skip` and writes the pair.

- [ ] **Step 1: Failing tests:**
  - **Sources:** for u2's copy of Setenta, `sourcesOf` gives `[{label:'Yours', relation:'self'}, {label:'Salsa Tuesdays', relation:'clone', status:'newer', changed:['Timing','1 recording']}]` after the group changed its timing and added a recording.
  - **Single row:** a lone row gives `[]`.
  - **Privacy (Review Focus 1):** a private member of u3 never shows.
  - **Take a recording:** `takeRecording` copies the file once (via the fake files), and a second call is refused.
  - **Subtitles:** `cloneSubtitle` covers its four forms.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): a tab per source, and taking a recording`.

### Task 25: Compare and Take theirs

**Files:**
- Create: `src/lib/server/clones/apply.ts`, `src/lib/server/clones/compare.ts`, specs; `src/routes/api/clones/compare/+server.ts` (GET), `src/lib/components/clones/CompareSheet.svelte`
- Modify: `src/lib/clones/view.ts`; the five pages (the banner with Compare, the `take` action)

**Interfaces:**
- Produces:
  - `type Comparison = { diffs: FieldDiff[]; picks: Picks; seen: string; synced: boolean; canTake: boolean; canSend: boolean }` (in `types.ts`).
  - `compareWith(db: Db, userId: string, kind: CloneKind, mineId: number, theirsId: number): Comparison | null`:
    - null unless both rows are in one family and the person reads both;
    - `picks = defaultPicks(diffs, 'take')`;
    - `seen = digest(flatOf(mine))`;
    - `canTake` when the person edits `mine`; `canSend` when they edit `theirs`.
  - `applyInto(tx: Db, kind: CloneKind, targetId: number, giverId: number, keys: string[], linked: Map<string, string>, actorId: string, now: number): ApplyOutcome`. It writes the giver's value of each listed key into the target, in place, by key family:
    - **root fields:** the same column updates as the kind's own save, and `setFigureShape` for timing and positions;
    - **name:** refused with `{ reason: 'name', message }` when taken in the target's move, routine list or library ("Doble is taken in Enchufla; rename one first.");
    - **`link:`:** add or remove the URL link;
    - **`fig:`, `routine:`, `drill:`:** add or remove the lesson link, the referenced row mapped into the target's place (Task 10's `Mapper`);
    - **a piece's presence:** clone the piece in (file linked), or delete it through its own delete function, which refuses a linked section (`{ reason: 'linked', message }`, existing wording) and, in a group, goes to `team_trash`;
    - **a piece's child keys:** update in place;
    - **`slots`:** replace the routine's whole slot list, each option and child mapped into the target's place (spec).

    `type ApplyOutcome = { ok: true; removals: boolean } | { ok: false; reason: 'name' | 'linked'; message: string }`.
  - `takeTheirs(db: Db, actorId: string, kind: CloneKind, intoId: number, fromId: number, picks: Picks, seen: string, files: CloneFiles, now: number, freeDiskBytes: number): Promise<SyncResult>`:
    - **Refusals:**
      - `'denied'` unless the actor edits `intoId`;
      - `'stale'` with "Changed since you opened this. Compare again." when `digest(flatOf(into))` ≠ `seen`;
      - `'pick'` with "Pick yours or theirs where both changed." when `unpicked` is not empty.
    - **Writing:** it links the files the picked pieces need (room is checked against the receiving place), then in one transaction:
      - applies the keys picked `'theirs'`;
      - writes `nextBase(into, from)`;
      - in a group: logs `change` (subject the kind's usual subject; `before`/`after` the changed root fields) and runs `reconcileEntries` when there were removals.

    `type SyncResult = { ok: true } | { ok: false; reason: 'denied' | 'stale' | 'pick' | 'name' | 'linked' | 'room'; message: string }` (in `types.ts`).
  - `view.ts`:
    - `changedLine(place: string, changed: string[]): string` → "Salsa Tuesdays changed it since you took it: timing, 1 recording"
    - `compareTitle(place)` → "Compare with Salsa Tuesdays’"
    - `compareSub(synced: boolean)` → "Since you last took from it. Pick where both of you changed something." / "You were never in step with this one. Pick each difference."
    - `diffTag(d: FieldDiff)` → "Only theirs changed" / "Only yours changed" / "New on theirs" / "Gone from theirs" / "Both changed: pick"
    - `TAKE_BUTTON` → "Take what’s picked"
  - **The sheet and banner.**
    - `CompareSheet` (board C2 p3) draws one card per diff, Yours / Theirs, preselected from `picks`. A removal is never preselected and needs a tap. A Both-changed card has no selection until tapped.
    - The banner (`changedLine` plus Compare) shows on your member's page when its source tab's status is `'newer'` or `'differs'`.

- [ ] **Step 1: Failing tests:**
  - **`apply.spec.ts`:** each key family writes in place. The target's id, its entries, and its sections' links survive a Take. A `slots` take maps the options into the target's place. A delete of a linked section is refused and nothing of that transaction lands.
  - **`compare.spec.ts`:**
    - The board C2 p3 case gives three diffs with the tags "Only theirs changed", "Both changed: pick", "New on theirs".
    - Take with `notes: 'mine'`, `timing: 'theirs'` and the recording taken leaves the next compare with no diffs except notes, which is `'mine'`.
    - A stale `seen` is refused.
    - **Taking into a group:** taking into the group's member as its editor logs one `change` with actor u1 (added to `MUTATIONS`).
    - A take whose theirs-side removal is ticked runs `reconcileEntries`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): compare a copy with its source and take what you pick`.

### Task 26: Copies you can see, and Send mine

**Files:**
- Create: `src/lib/server/clones/send.ts`, spec; `src/lib/components/clones/FamilyList.svelte`, `src/lib/components/clones/SendSheet.svelte`
- Modify: `src/lib/clones/view.ts`; the five pages (FamilyList under the banner when the person edits at least one other member; pinned "Send mine…"; the `send` action); `src/lib/server/changes.spec.ts` (`MUTATIONS`)

**Interfaces:**
- Produces:
  - `familyStatus(db: Db, userId: string, kind: CloneKind, id: number): { member: Member; status: Source['status']; changed: string[]; editable: boolean }[]` — every visible member, the page's own first ("This one"); built on `sourcesOf`.
  - `sendPreview(db: Db, userId: string, kind: CloneKind, fromId: number): { target: Member; comparison: Comparison /* from the target's side: mine = target, theirs = fromId; picks from defaultPicks(…, 'send') read as what lands */; removals: FieldDiff[]; both: FieldDiff[] }[]` — editable members only.
  - `sendMine(db: Db, actorId: string, kind: CloneKind, fromId: number, targets: { id: number; picks: Picks; seen: string }[], files: CloneFiles, now: number, freeDiskBytes: number): Promise<{ id: number; result: SyncResult }[]>`:
    - each target is its own transaction (one refusal does not undo another);
    - each uses `applyInto` with the giver `fromId`, the `seen` check, `nextBase(target, from)`, the log and the reconcile, as Task 25.
  - `view.ts`:
    - `statusChip(s): { text; tone } | null` → 'behind' "Behind", 'newer' "Newer", 'differs' "Differs", 'same' null
    - `memberMeta(role: 'owner' | 'editor' | 'member' | null, status, changed: string[]): string` → "Owner · behind yours: notes, 1 recording"
    - `differsBanner(place, changed)` → "Rueda club’s copy differs: timing" (ruling 10)
    - `SEND_TITLE` "Send your changes"
    - `SEND_SUB` "Adds and changes travel. Deletes only if you tick them."
    - `sendTargetMeta(diffs, bytes, team)` → "Notes · 1 new recording (charged to the group)"; with a both-changed field it appends " · timing: they changed it too, you’ll pick"
    - `deleteRow(name)` → "Also delete “old take” there" with meta "You deleted it from yours. Refused where a lesson links its section."
    - `SEND_NOTE` "Changes land on the groups’ own figure: members’ practice and lesson links stay." (the kind's noun)
    - `sendButton(n, name)` → "Send to 2 groups" / "Send to Salsa Tuesdays"
    - `bothTitle(place, fields)` → "Rueda club: both changed the timing"
    - `bothNote` → "Pick yours and theirs is replaced in Rueda club. Pick theirs and you send only the rest."
  - **The sheets.**
    - `SendSheet` (board C3 p2): one box per editable target, ticked when it has differences; one box per removal, unticked.
    - When a ticked target has both-changed fields, a second level (board C3 p3) asks per field before sending.

- [ ] **Step 1: Failing tests (Review Focus 1, server):**
  - **Three places:** u1's own Enchufla is the hub, copied into Salsa Tuesdays (T1) and Rueda club (T2); u4, an editor of T2, edits T2's timing; u1 edits notes and adds a recording.
    - `sendPreview` shows T1 with notes and the recording, and T2 with notes and the recording. T2's timing shows too, as changed on T2's side only (u1 did not touch timing), so it is **not** sent by default.
    - `sendMine` to both lands notes and the recording in both, and T2 keeps u4's timing.
    - Then u1 takes T2's timing; a later `sendPreview` to T1 offers timing.
  - **Removals:** a ticked removal of a section that a T1 lesson links is refused for T1 only, and T2's send still lands.
  - **Logging:** each landed target logs one `change` with actor u1.
  - **Privacy:** a member u1 only reads is not a target.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): see every copy and send yours where you edit`.

### Task 27: Drop my copy

**Files:**
- Create: `src/lib/server/clones/drop.ts`, spec; `src/lib/components/clones/DropSheet.svelte`
- Modify: `src/lib/clones/view.ts`; the five pages (⋯ "Drop my copy" on your member when another member is readable; the `drop` action; the toast)

**Interfaces:**
- Produces:
  - `dropOptions(db: Db, wall: Wall, kind: CloneKind, id: number): DropOptions | null`. It returns null when `id` is not yours or no other live member is readable, so the item is not offered. `type DropOptions = { choices: { id: number; place: PlaceRef; clonedFrom: boolean; practiceFollows: boolean; addLesson: { id: number; title: string } | null }[]; preselected: number; onlyInMine: string[]; sendable: number[] }`:
    - `clonedFrom` marks the row yours was copied from, which is `preselected` while readable, else the first by group name.
    - `practiceFollows` is false for a group figure, drill or routine outside the person's `addedReach` (R8). `addLesson` is then the newest published lesson of that group that holds it, if any.
    - `onlyInMine` holds the labels of keys where your member differs on your side (`side 'mine'` or `'both'`).
    - `sendable` holds the choices you edit.
  - `dropCopy(db: Db, wall: Wall, kind: CloneKind, id: number, toId: number, opts: { addLessonId?: number }, now: number): { ok: true; toId: number } | { ok: false; message: string }`. In one transaction:
    - adds the lesson when asked (`addLesson`, which makes the practice follow);
    - runs `repoint(entries: practiceFollows || added)` with `addLesson: kind === 'lesson'`;
    - archives your member with the kind's archive function, its entries' practice staying with it when it could not follow.
  - `view.ts`:
    - `DROP_TITLE` "Drop your copy?"
    - `dropSub(place)` → "You go back to the class’s version, read-only. Your copy is archived."
    - `dropOne(place, label)` → "Your routines and practice will use Salsa Tuesdays’ Setenta · Básico."
    - `onlyInYours(labels)` → "Only in yours: your notes and 1 recording. They go with your copy." (with sendable: "Only in yours: your notes. You edit Salsa Tuesdays.")
    - `USE_INSTEAD` "Use instead"
    - `copiedHere` "You copied it from here"
    - `cantFollow(lesson | null)` → "Not in a lesson you added: your practice can’t follow · Add Week 2 too" (with no lesson: "…can’t follow")
    - `DROP_BUTTON` "Drop my copy"
    - `SEND_FIRST` "Send mine first"
    - `droppedToast(place)` → "Back on Salsa Tuesdays’. Your copy is archived."
  - **The sheet.** `DropSheet` covers board C5:
    - with one choice it names the version;
    - with several it shows radios, and the ticked "Add Week 2 too" box sits under a choice that has `addLesson`;
    - "Send mine first" opens `SendSheet` for that target, and Drop is then sent with the result;
    - the button is a danger button.

- [ ] **Step 1: Failing tests:**
  - **One choice:** u2's copy of Setenta with one readable source has `choices.length` 1 and `onlyInMine` `['Notes']`. `dropCopy` re-points u2's routine to the group's and moves the entry (Setenta is in an added lesson), and the copy is archived.
  - **Several choices:** with T1's and T2's, T1 (copied from) is preselected. T2 is not in an added lesson, so `practiceFollows` is false and `addLesson` is "Week 2".
    - Dropping to T2 without adding keeps the entry on the archived copy.
    - Dropping with `addLessonId` moves it.
  - **Lesson:** dropping to the group's lesson adds it.
  - **No other version:** `dropOptions` is null when no other member is readable (after leaving).
  - **Review Focus 4:** Edit after Drop restores (Task 23 case, asserted again here through the action).
  - **Pure:** each line.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): Drop my copy`.

### Task 28: Detach, and reconnecting after rejoining

**Files:**
- Create: `src/lib/server/clones/detach.ts`, spec; `src/lib/components/clones/DetachSheet.svelte`
- Modify: `src/lib/clones/view.ts`, `src/lib/server/clones/sources.ts` (the rejoin line), the five pages (⋯ "Detach" on a member with a family)

**Interfaces:**
- Produces:
  - `detach(db: Db, actorId: string, kind: CloneKind, id: number, now: number): boolean`:
    - The actor must edit the row.
    - It sets `gene_id` and `cloned_from` to null and drops the row's pairs.
    - On a personal row, when the row it was copied from (or another family member) is still readable, it marks the two as twins (`markTwins`; only for `TwinKind`s; a drill just leaves).
    - On a group row it logs `change`.
  - `sourcesOf` (Task 24): when your member's pair with a group member is older than your current membership's `joined_at`, that source carries `rejoined: true`, and the banner reads `reconnectedLine(place, n)` → "Reconnected with Salsa Tuesdays: 3 changes while you were away" (n = the diffs).
  - `view.ts`:
    - `detachTitle(place)` → "Stop following Salsa Tuesdays?"
    - `DETACH_MINE` → "Your copy stays yours, as it is. It stays shown together with theirs, as twins."
    - `DETACH_NO_MORE` → "No more “updated since”, and no Take theirs to hit by mistake."
    - `DETACH_GROUP` → "In a group, Detach just makes it an ordinary group figure." (the kind's noun)
    - `DETACH_BUTTON` "Detach"

- [ ] **Step 1: Failing tests:**
  - **Personal detach:** after `detach` on u2's copy, the copy has no family, `sourcesOf` gives the group's as a twin tab (no status), and Compare is refused.
  - **Group detach:** detaching a group's member logs one `change` and makes no twin.
  - **Rejoin (Review Focus 4):** u2 leaves keeping everything, rejoins (`joinTeam`), and the group then edits notes. The source shows `rejoined` with 1 change, and the shadow shows u2's copy in place of the group's again. u2 leaves again: Keep reuses the copies (one member each).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): Detach, and reconnecting after rejoining`.

### Task 29: Copy to…

**Files:**
- Create: `src/lib/server/clones/copy-to.ts`, spec; `src/lib/components/clones/CopyToSheet.svelte`
- Modify: `src/lib/clones/view.ts`, the five pages (⋯ "Copy to…"; the `copyTo` action), `src/lib/server/changes.spec.ts`

**Interfaces:**
- Produces:
  - `copyTargets(db: Db, userId: string, kind: CloneKind, id: number): { place: PlaceRef; role: 'owner' | 'editor' | null; usedBytes: number; limitBytes: number | null; existing: { id: number; archived: boolean; at: number } | null }[]` — your app (when the row is not already yours) and every live group of this dance you own or edit, except the row's own place; `existing` is that place's member of the family.
  - `copyPlan(db: Db, userId: string, kind: CloneKind, id: number, into: Space): { goes: string; bytes: number; already: string[]; twins: { gene: string; label: string; choices: { id: number; place: PlaceRef; changedAt: number }[] }[] }`:
    - `goes` is "3 figures · 2 videos (420 MB, charged to the group) · notes";
    - `already` reads "Enchufla · Doble: Salsa Tuesdays has your copy from 3 Oct. It’s reused, not doubled.";
    - `twins` holds, for each family in what goes that has visible twins, a choice (spec point 5).
  - `copyTo(db: Db, actorId: string, kind: CloneKind, id: number, into: Space, use: Record<string, number>, files: CloneFiles, now: number, freeDiskBytes: number): Promise<CloneResult>` → `cloneInto` with `recordings: isTeam(into)` and the `use` choices; a lesson or song into a group is a draft.
  - Existing member in `into`:
    - the action answers `{ existing: id }` and the sheet opens Compare between the two (spec point 9);
    - an archived one answers `{ restore: id }` and the sheet offers Restore, then Compare.
  - `view.ts`:
    - `copyTitle(name)` → "Copy Week 3 to…"
    - `COPY_SUB_GROUP` "The group gets a draft. You keep yours."
    - `placeMeta(role, used, limit)` → "Owner · 412 MB of 1 GB used"
    - `WHAT_GOES` / `ALREADY_THERE`
    - `copyButton(kind, into)` → "Copy as a draft" (lesson or song into a group) / "Copy"
    - `whichTitle(label)` → "Which Enchufla · Doble?"
    - `whichSub(place)` → "You see two versions of this figure. Which one goes to Salsa Tuesdays?" ("two" from the count)
    - `TWINS_ONE_GOES` "They’re twins in your app. Only one goes; the group never gets twins."
    - `CONTINUE` "Continue"
    - `twinChoiceMeta(place, changedAt)` → "Last changed 30 Oct"

- [ ] **Step 1: Failing tests:**
  - **Group to group:** u1 (editor of T1 and T2) copies T1's Enchufla into T2, giving a T2 member with its recordings, charged to T2, and a `team_changes` `add` in T2 (added to `MUTATIONS`).
  - **Lesson as a draft:** copying u1's lesson into T1 makes a draft. `copyPlan.already` names the figure T1 already has, and that figure is reused.
  - **Twins:** with u1's Doble twinned with T2's Doble, `copyPlan.twins` has one entry, and `copyTo` with `use` picking T2's makes T1's member in T2's family.
  - **Existing member:** copying again answers `existing`.
  - **Pure:** each line.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** The ⋯ shows Copy to… when `copyTargets` is not empty. **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): Copy to… your app or a group you edit`.

### Task 30: Move to… a group (lessons)

**Files:**
- Create: `src/lib/server/clones/move.ts`, spec; `src/lib/components/clones/MoveToSheet.svelte`
- Modify: `src/lib/clones/view.ts`, `src/routes/[dance]/lessons/[id]/+page.server.ts` and `+page.svelte` (⋯ "Move to…" on your own lesson when you own or edit a group of this dance; the `moveTo` action)

**Interfaces:**
- Produces:
  - `movePreview(db: Db, wall: Wall, lessonId: number, teamId: number): { items: { kind: 'figure' | 'routine' | 'drill'; id: number; label: string; why: string; keepByDefault: boolean }[] } & ReturnType<typeof copyPlan>`:
    - `why` is one of: "Used by 2 other lessons", "Used by Week 4 loop", "You practise it", "Only this lesson" (the first that applies, in that order);
    - `keepByDefault` is true for all but "Only this lesson" (ruling 11).
  - `moveLesson(db: Db, wall: Wall, lessonId: number, teamId: number, choices: Record<string /* `${kind}:${id}` */, 'keep' | 'group'>, use: Record<string, number>, files: CloneFiles, now: number, freeDiskBytes: number): Promise<CloneResult>`:
    - `copyTo` into the team as a draft;
    - then, in one transaction, for each `'group'` item, `repoint(entries: false)` from yours to the group's copy, and archive yours;
    - then archive your lesson, whose practice stays with it.

    The group logs one `add` (from the copy).
  - `view.ts`:
    - `moveTitle(lesson, place)` → "Move Week 3 to Salsa Tuesdays"
    - `MOVE_SUB` "The lesson lives in the group and leaves your lessons. What it brings:"
    - `KEEP_MINE` "Keep mine as well"
    - `USE_GROUPS` "Use the group’s"
    - `MOVE_NOTE` "“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s."
    - `PRACTICE_STAYS` "Your practice of what you drop stays with your archived copy." (shown when a chosen `'group'` item is practised)
    - `MOVE_BUTTON` "Move as a draft"

- [ ] **Step 1: Failing tests:**
  - **Preview:** with Enchufla used by 2 other lessons, Setenta only in this one, and Dile que no in Week 4 loop, `movePreview` gives `why` and defaults `[keep, group, keep]`.
  - **Move:** `moveLesson` with those defaults leaves:
    - a draft lesson in T1;
    - u1's lesson archived;
    - Setenta archived in u1's app;
    - u1's other routine that used Setenta now on T1's copy;
    - Enchufla still u1's.
  - **After the move:** `crossRefs` is `[]`. u1 (editor) reads T1's draft copy; a member does not.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(clones): Move a lesson to a group`.

**Ship point D.**

# Phase E — Twins (ship point after Task 34)

### Task 31: Same as…, and Separate

**Files:**
- Create: `src/lib/components/clones/SameAsSheet.svelte`, `src/routes/api/twins/+server.ts` (POST mark, DELETE separate) or page actions on the four pages
- Modify: `src/lib/clones/view.ts`, `src/lib/server/twins.ts` (`twinCandidates`), the figure page (⋯ "Same as…"; "Not the same? Separate" under the tabs of a twin's page)

**Interfaces:**
- Produces:
  - `twinCandidates(db: Db, wall: Wall, kind: TwinKind, id: number): { id: number; label: string; place: PlaceRef; ticked: boolean }[]` — every live row of that kind the person sees in their app (their own, and their added groups' usable rows), except the row itself and its own family members (a clone is already shown together); `ticked` for its current twins.
  - Sheet: search field (`SearchField`, folded), rows with the place as meta ("Salsa Tuesdays’", "Yours"), boxes; `markTwins` with the ticked set, `separate` for unticked former twins.
  - `view.ts`:
    - `sameAsTitle(label)` → "Enchufla · Doble is the same as…"
    - `TWINS_NOTE` → "Twins show as one figure. They never sync, and only you see the grouping." (the kind's noun)
    - `MARK_SAME` "Mark as the same"
    - `SEPARATE` "Not the same? Separate"
- [ ] **Step 1: Failing tests:**
  - **Candidates:** `twinCandidates` lists the group's Básica and Rueda's Doble but not u2's own clone of the page's figure.
  - **Marking:** marking twins, then calling `separate` on one, leaves a set of two.
  - **Privacy:** another member's view of the group's figure shows no twins.
  - **Pure:** each line.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(twins): Same as… and Separate`.

### Task 32: Twins show as one: Moves, pickers, the figure page

**Files:**
- Create: `src/lib/clones/twins.ts` (PURE), `src/lib/clones/twins.spec.ts`
- Modify: `src/routes/[dance]/figures/+page.server.ts` and `+page.svelte` (the Figures tab), `src/lib/picker/build.ts`, `src/lib/server/usable.ts` (twin sets with the picker rows), `src/lib/server/clones/sources.ts` (twins' tabs, subtitle "Twins · 3 versions"), `src/lib/moves/list.ts` (counts)

**Interfaces:**
- Produces in `twins.ts`:
  - `foldMoves(mine: MoveRow[], groups: { team: TeamRef; moves: MoveRow[] }[], sets: number[][]): { mine: (MoveRow & { also: string[] })[]; groups: { team: TeamRef; moves: MoveRow[] }[]; twinOf: Map<number, number[]> }` (ruling 9):
    - each twin set shows once, as your figure if one is yours, else the first by group name;
    - the other members leave their sections;
    - a group's move left with no figures loses its heading, and that group's name goes into `also` of the move that holds the shown member (the move's meta reads "also in Salsa Tuesdays, Rueda club");
    - `twinOf` maps a shown figure to its hidden twins (the "Twins" chip).
  - `twinRows<T extends { id: number }>(rows: T[], sets: number[][], mineIds: Set<number>): (T & { twins: number[] })[]` — the pickers' one row per set.
    - **Which row is used:** your member if you have one, else the first by group name.
    - **Meta:** `twinUseMeta(theirs: string[], mine: boolean)` → "Yours, twin of Salsa Tuesdays’ Básica · yours is used"; without your member → "Salsa Tuesdays’, twin of Rueda club’s Doble · Salsa Tuesdays’ is used".
  - **Group mode folds nothing** (groups have no twins): in group mode the Figures tab, the pickers and the pages show no twin chip, tab or fold.
  - `movesHeading` counts after folding ("Yours · 8 moves" counts moves of yours, a folded group move not counted twice).
  - `sourcesOf` for a figure in a twin set lists the twins as tabs (relation `'twin'`, no status, no Take, no Compare); the page subtitle is `cloneSubtitle(...)` → "Twins · 3 versions" when the page has twins and no clones.
- [ ] **Step 1: Failing tests:**
  - **Folding, board C7 p3:** u2 has Enchufla (Doble, Básica). Salsa Tuesdays has Enchufla (Básica, twin of u2's Básica) and Sombrero. Rueda club has Enchufla (Doble, twin of u2's Doble).
    - Folded, u2's Enchufla shows `also: ['Salsa Tuesdays', 'Rueda club']`.
    - Salsa Tuesdays keeps only Sombrero, and Rueda club has no section left.
    - `twinOf` maps u2's Doble to [Rueda's Doble].
  - **Partial folding:** a group move with one twinned figure and one not keeps its heading with the one left.
  - **Pickers:** `twinRows` gives one row per set, with the used member as described.
  - **Server:** u2's figure page with two twins has three tabs. In group mode, the same person's Figures load and figure page show no folding, chip or twin tab.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(twins): twins show as one`.

### Task 33: Twins for routines, lessons and songs

**Files:**
- Modify: the routine, lesson and song pages (⋯ "Same as…", tabs, "Not the same? Separate"); `src/routes/[dance]/routines/+page.server.ts` and `+page.svelte` (Routines: one row per set, chip "Twins"); `src/routes/[dance]/lessons/+page.server.ts` (Lessons: one row per set, newest member's day); the Music tab (one row per set); the routine embed picker and the lesson pickers (`twinRows`)
- Test: route specs for each list; `src/lib/clones/twins.spec.ts` (a generic `foldRows` for flat lists)

**Interfaces:**
- Produces: `foldRows<T extends { id: number }>(rows: T[], sets: number[][], mineIds: Set<number>): (T & { twins: number[] })[]` in `twins.ts` (the flat-list sibling of `foldMoves`; `twinRows` may become an alias).
- [ ] **Step 1: Failing tests:**
  - **Lessons:** u2's lesson "Week 6 notes", twinned with Salsa Tuesdays' "Week 6", is one row in Lessons (u2's shown, chip "Twins").
  - **Pages:** the routine page of a twinned routine has two tabs. A song twin is one row in Music.
  - **Pure:** `foldRows` on each shape.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; `nix develop -c npm run check` — PASS. Commit: `feat(twins): routines, lessons and songs`.

### Task 34: The whole story end to end, docs, and the deploy notes

**Files:**
- Create: `src/lib/server/clones/story.spec.ts`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-03-clones-and-twins-design.md` (Status: built, plus the rulings above under "Decided while planning"), `docs/superpowers/specs/2026-11-02-groups-design.md` (a note where it describes reading after leaving and Make my own copy: "Replaced by clones and twins"), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (phases list), `docs/deployment.md`

**Interfaces:** none new.

- [ ] **Step 1: Write `story.spec.ts`**, one `it` running the spec's story through the data functions with fake files, asserting `crossRefs(db)` and `familyIntegrity(db)` are `[]` after every step:
  1. Ana (u1) has her own Enchufla · Doble and owns Salsa Tuesdays (T1) and Rueda club (T2). She copies it into both, and a lesson linking it into T1 (a draft), which she publishes.
  2. Marko (u4), an editor of T2, changes T2's timing.
  3. Pia (u2) joins T1, adds the lesson, and uses T1's Doble in her own routine.
  4. Ana edits notes and sends to T1 and T2; T2 keeps Marko's timing.
  5. Ana takes T2's timing into hers and sends it to T1.
  6. Pia's routine plays T1's Doble with the new timing (her `graphFor` has it).
  7. Pia makes it hers (Edit): her routine is on her copy.
  8. Pia drops her copy back to T1's.
  9. Pia leaves with "Keep only what my routines use": she has one copy, her routine uses it, and she reads nothing of T1.
  10. Pia rejoins: her copy shows "Reconnected" with the changes since.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/clones/story.spec.ts` — it must PASS on the built code; a failure is a bug in an earlier task, fixed in a separate commit that names the task.
- [ ] **Step 3: CLAUDE.md:**
  - **Phase line:** add "and clones and twins (a gene id and cloned-from on every copyable row; Copy to…, Edit makes your copy, Compare, Take, Send, Drop my copy, Detach, Move to… a group; your own routines, lessons and sections use a group's things without copying; leaving keeps copies; Same as… shows twins as one)", with the spec link.
  - **Hard rules:** a **"Clones: links are row ids, genes only match"** rule (one member per place; archived holds the place; re-point explicitly; `clone_pairs` written only by copy, Take and Send; never on ordinary saves). The wall rule's new sentence on own rows pointing at usable group rows, and `crossRefs`. A **"Twins are views"** rule (the `twins` table is read only by list, picker and page views; nothing else learns of it).
  - **Layout:** lines for `src/lib/clones/`, `src/lib/server/clones/`, `src/lib/server/usable.ts`, `src/lib/server/twins.ts`.
- [ ] **Step 4: `docs/deployment.md`:**
  - Add 0027 to the loud migration dry-run block, with expected checks: the new columns exist; `clone_pairs` and `twins` exist; no table rebuilt (`sqlite_master` has no `__new_`).
  - Add a line: the first boot logs `settled N former members` (Task 19) and the integrity counts (Task 12); any `crossRefs` line at boot is a bug to look at before using the app.
- [ ] **Step 5: Run** `nix develop -c npm run check` — PASS. Commit: `docs(clones): CLAUDE.md, specs and the deploy notes; the whole story as a spec`.

**Ship point E.**

---

## Risks

- **The graph wall (Task 13) has more callers than listed.** `buildGraph` is called from the player, the routine page, the Routines list, coverage, the figure page and the gap report. Each caller that takes a person's wall must decide between `graphFor` (their routines may use group figures) and `buildGraph` (the gap report and coverage stay their own). `grep -rn buildGraph src` before and after Task 13; the task's reviewer checks every hit.
- **`reconcileEntries` gains work (Task 17).** It now runs `rescueUsed`, which joins a person's rows against a team's rows. Measure it on the Design 1 fixture of two groups with fifty lessons (`a297617`); keep it under the same budget (eight queries per reconcile is the bar that spec set for `whatsNew`).
- **Hard links across a failed transaction.** Every async flow (Tasks 9, 10, 18, 19, 23–30) links files before its transaction and must unlink them when the transaction throws. Each of those tasks' specs has one forced failure (a `name` refusal inside the transaction) asserting `files.unlink` was called for every linked name.
- **Old snapshots in `team_trash`** carry no `gene_id`. A restore inserts null: the restored piece is a family of one. Accepted; it only matters if that piece was copied, which needed a gene, which it never had.
- **Copies made before this ships are families of one** and never show "From …" (the spec accepts it). The R22 name-matched copies stay as they are.
- **Ship order.** B ships with C because 0027 alone is invisible, and C's wall change (Task 20) must ship with Keep (Tasks 18, 19). Shipping Task 20 without Task 19 would strand people who leave. A, D and E can each ship alone after their predecessors.
