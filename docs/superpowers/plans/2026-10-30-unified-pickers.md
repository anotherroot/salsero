# One Picker for Every List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's eleven list pickers (five different builds) with one shared picker: search, figure headings, tap a row to finish, + to link several, already-linked rows kept visible, one create row.

**Architecture:** A pure, client-safe module `src/lib/picker/` decides what is shown (folding, word search, figure headings, group order) and turns server rows into picker groups. Two components, `Picker.svelte` (a sheet with search, grouped rows, create row, Done) and `PickerField.svelte` (a form field that opens it), never fetch or post; each page owns its requests. Server lists that today leave linked items out return them flagged instead.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, SQLite via Drizzle, vitest (node environment; there is no component test setup, so components are checked by `npm run check` and by hand).

**Spec:** `docs/superpowers/specs/2026-10-30-unified-pickers-design.md` — read it first; its rule numbers (rule 1 … rule 11) and picker numbers (#1 … #11) are used below. The mockup it names shows each picker working.

## Global Constraints

- Every command runs inside `nix develop` (or with direnv allowed). `npm run check` (prettier + eslint + svelte-check + build + vitest) must pass at the end of every task.
- Data functions take `db` first; tests use `openDb(':memory:')`. A spec must never touch `$DATA_DIR` (CLAUDE.md).
- Nothing under `$lib/server` is imported by a component; shared row shapes go in `src/lib/types.ts`.
- One-tap posts (a picker's tap, its +, Unlink) use `use:enhance`; a form someone fills in keeps `use:guarded`. Never `confirm()`.
- No schema change and no migration. No change to what may be linked to what.
- Copy, exactly: `✓ Linked` · `Done · {n} linked` · `Not in the list?` · `Not in the list? Create “{query}” as` · `Nothing matches “{query}”.` · group titles `In this lesson`, `This figure`, `Figures`, `Routines`, `Drills`, `Lessons`, `Other videos`.
- Group order (rule 2): near group, `Figures`, `Routines`, `Drills`, `Lessons`; a group with no rows is left out.
- Second lines (rule 10): exercise → `frequencyLabel(everyDays)`; routine → `{n} slots` / `1 slot`, plus ` · loops` when it loops; a figure picked as a figure → its variations joined with `, `; a section → its time range (when it has a label) and ` · → {linkedTo joined ', '}` when linked elsewhere; timing only in the routine editor.
- The search field is focused on open only when `matchMedia('(pointer: fine)').matches`.
- Light theme uses the site tokens (`bg-surface`, `text-muted`, `border-line`, `text-accent` …); dark uses the player's `--pl-*` tokens as `LinkPopup.svelte` does today.

## Review Focus

1. **Several words across figure and variation** ("enchufla doble", "doble enchufla") must find "Enchufla · Doble" — pinned in Task 1 (`matches every word anywhere in the heading and label`).
2. **A section with no name** is labelled by its time range; typing "1:01" must find it — pinned in Task 6 (`sectionGroups: an unnamed section is found by its time`).
3. **A + or tap that the server refuses** (the variation was archived in another tab, the link already exists) must leave the row un-ticked and show the message inside the picker, not close it — pinned in Task 4 Step 6 and Task 8 Step 6 (by hand: archive a variation in a second tab, then + it).
4. **Closing a field's picker with ×** must leave everything typed in the form — pinned in Task 4 Step 6 (by hand: type a variation name, open Figure, ×, the name is still there).
5. **On a phone the keyboard must not open by itself** when any picker opens — pinned in Task 4 Step 6 (by hand at 390 px with touch emulation: no field focused).

---

### Task 1: The pure picker model

**Files:**
- Create: `src/lib/picker/model.ts`
- Create: `src/lib/picker/model.spec.ts`
- Modify: `src/lib/routines/fit.ts:90-92` (`fold` moves to `$lib/picker/model`; `fit.ts` and every other importer of `fold` import it from there)

**Interfaces:**
- Produces:
  ```ts
  /** One pickable row. `key` is unique in the picker ("figure:12", "exercise:3", "spot:7", "group:4", "routine:2"). */
  export interface PickRow {
  	key: string;
  	/** The id posted or linked. */
  	value: number;
  	/** Full label, shown when the row stands alone: "Enchufla · Doble". */
  	label: string;
  	/** Shown under a heading instead of `label`: "Doble". Defaults to `label`. */
  	short?: string;
  	meta?: string;
  	/** Extra text the search matches (a section's time range). Never `meta`. */
  	keywords?: string;
  	linked?: boolean;
  	/** A section: ▶ previews it. */
  	preview?: boolean;
  }
  /** A heading over rows: a figure over its variations, a video over its sections. */
  export interface PickHeading {
  	heading: string;
  	rows: PickRow[];
  	/** A figure: with exactly one row (counted before search) it shows as that row alone. A video: false. */
  	collapse: boolean;
  }
  export type PickEntry = PickRow | PickHeading;
  export interface PickGroup { title: string; entries: PickEntry[] }
  export type PickLine =
  	| { kind: 'group'; title: string }
  	| { kind: 'heading'; text: string }
  	| { kind: 'row'; row: PickRow; text: string; indent: boolean };
  export function fold(s: string): string;
  export function shown(groups: PickGroup[], query: string): PickLine[];
  export const isHeading: (e: PickEntry) => e is PickHeading;
  ```

- [ ] **Step 1: Write the failing tests** in `model.spec.ts`, with a fixture of three groups: `Figures` holding heading `Enchufla` (rows Basic, Doble, collapse) and heading `Dile que no` (one row Basic, collapse); `Drills` holding row `Spot turns`; `Other videos` holding heading `Tuesday class · 27 Oct` (one row `1:01.0–1:20.0`, collapse false, keywords `1:01.0–1:20.0`).

```ts
it('shows a one-row figure as its full label, unindented', () => {
	const lines = shown(groups, '');
	expect(lines).toContainEqual({ kind: 'row', row: expect.objectContaining({ key: 'figure:3' }), text: 'Dile que no · Basic', indent: false });
	expect(lines).not.toContainEqual({ kind: 'heading', text: 'Dile que no' });
});
it('shows a several-row figure as a heading over its short names', () => {
	expect(shown(groups, '')).toEqual(expect.arrayContaining([
		{ kind: 'heading', text: 'Enchufla' },
		{ kind: 'row', row: expect.objectContaining({ key: 'figure:2' }), text: 'Doble', indent: true }
	]));
});
it('keeps a video heading over a single section', () => {
	expect(shown(groups, '')).toContainEqual({ kind: 'heading', text: 'Tuesday class · 27 Oct' });
});
it('a figure name brings all its variations', () => {
	const rows = shown(groups, 'enchufla').filter((l) => l.kind === 'row');
	expect(rows.map((l) => l.row.key)).toEqual(['figure:1', 'figure:2']);
});
it('a variation name brings only itself, still under its heading', () => {
	expect(shown(groups, 'doble')).toEqual([
		{ kind: 'group', title: 'Figures' },
		{ kind: 'heading', text: 'Enchufla' },
		{ kind: 'row', row: expect.objectContaining({ key: 'figure:2' }), text: 'Doble', indent: true }
	]);
});
it('matches every word anywhere in the heading and label', () => {
	for (const q of ['enchufla doble', 'doble enchufla', 'ENCH  dob']) {
		expect(shown(groups, q).filter((l) => l.kind === 'row').map((l) => l.row.key)).toEqual(['figure:2']);
	}
});
it('ignores accents both ways', () => {
	// fixture row label "Exhíbela · Basic" in Figures
	expect(shown(groups, 'exhibela').some((l) => l.kind === 'row' && l.row.label === 'Exhíbela · Basic')).toBe(true);
	expect(shown(groups, 'exhíbela').length).toBeGreaterThan(0);
});
it('searches keywords but not meta', () => {
	expect(shown(groups, '1:01').some((l) => l.kind === 'row')).toBe(true);
	// a row with meta 'Every 3 days' and no "every" in its label
	expect(shown(groups, 'every')).toEqual([]);
});
it('drops a group with nothing left and keeps group order', () => {
	expect(shown(groups, 'spot')).toEqual([{ kind: 'group', title: 'Drills' }, expect.objectContaining({ kind: 'row' })]);
	expect(shown(groups, '').filter((l) => l.kind === 'group').map((l) => l.title)).toEqual(['Figures', 'Drills', 'Other videos']);
});
it('is empty for no groups or no match', () => {
	expect(shown([], '')).toEqual([]);
	expect(shown(groups, 'zzz')).toEqual([]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/picker/model.spec.ts`
Expected: FAIL, `Cannot find module './model'`.

- [ ] **Step 3: Implement `model.ts`.** Move `fold` from `fit.ts` unchanged (and its doc comment). `shown`: split the folded query on whitespace; a row matches when every word is a substring of `fold([heading, label, short, keywords].join(' '))`; a heading collapses when `collapse && rows.length === 1`, counted before filtering; emit a `group` line only when the group has a row left. `fit.ts` imports `fold` from `$lib/picker/model` and no longer exports it; point any other importer (`rg "fold" src`) at the new home.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/picker src/lib/routines`
Expected: PASS, `fit.spec.ts` included.

- [ ] **Step 5: Commit**

```bash
git add src/lib/picker src/lib/routines/fit.ts
git commit -m "Picker model: word search, figure headings, group order"
```

---

### Task 2: `Picker.svelte` and `PickerField.svelte`

**Files:**
- Create: `src/lib/components/picker/Picker.svelte`
- Create: `src/lib/components/picker/PickerField.svelte`

**Interfaces:**
- Consumes: `PickGroup`, `PickRow`, `shown` from Task 1; `Sheet.svelte`.
- Produces — `Picker.svelte` props:
  ```ts
  interface Props {
  	open: boolean;
  	title: string;
  	/** Search placeholder: "Search figures". */
  	placeholder: string;
  	groups: PickGroup[];
  	/** 'link': rows get + and ✓ Linked; 'field': `chosen` gets ✓; 'act': plain rows. */
  	kind: 'link' | 'field' | 'act';
  	/** 'field': the current value's `key`. */
  	chosen?: string | null;
  	/** The empty box without a query (rule 7). */
  	nothingLeft: string;
  	/** The create row (rule 6). Absent: no row. */
  	create?: { key: string; label: string }[];
  	/** How many + this opening has linked; Done shows when > 0. Owned by the caller. */
  	added?: number;
  	/** A refused link, shown above the list. */
  	message?: string | null;
  	/** 'dark': an overlay inside the player's <dialog> with --pl-* tokens; 'light': Sheet.svelte. */
  	theme?: 'light' | 'dark';
  	/** The caller already filtered `groups` by `query` (the routine editor). */
  	prefiltered?: boolean;
  	query?: string; // $bindable, starts '' on every opening
  	/** Under the search: the routine editor's context line and chips. */
  	top?: Snippet;
  	/** Replaces the empty box (the routine editor's "Turn off Hold"). */
  	empty?: Snippet;
  	onpick: (row: PickRow) => void;
  	onadd?: (row: PickRow) => void;
  	onpreview?: (row: PickRow) => void;
  	oncreate?: (key: string, query: string) => void;
  	ondone?: () => void;
  	/** ×, Escape, the backdrop: one level back (rule 8). */
  	onclose: () => void;
  }
  ```
- Produces — `PickerField.svelte` props:
  ```ts
  interface Props {
  	/** Hidden input's name; posts the chosen row's `value`. */
  	name: string;
  	label: string;
  	placeholder: string; // "Choose a figure…"
  	title: string; // the picker's title
  	search: string; // the picker's search placeholder
  	groups: PickGroup[];
  	nothingLeft: string;
  	value: number | null; // $bindable — a row's `value`
  	required?: boolean;
  	theme?: 'light' | 'dark';
  	open?: boolean; // $bindable, so a host (the player) can tie it to history
  }
  ```

- [ ] **Step 1: Build `Picker.svelte`.** Layout top to bottom: Sheet header (title, ×) → search (the magnifier `<label>` from today's `FigureList.svelte:96-121`, `type="search"`, Enter does not submit) → `top` snippet → `message` (role alert) → the list (`max-h-[55dvh] overflow-y-auto overscroll-contain`, rendering `prefiltered ? linesWithoutFilter : shown(groups, query)`) → create row (pinned, outside the scroll, labels per the copy constraints, `oncreate(key, query.trim())`) → `Done · {added} linked` button when `kind === 'link' && added > 0`. Rows: rule 9 — the row is one `<button>`; + is a sibling 36 px button (`aria-label="Link {label} and keep picking"`); a linked row is a disabled button with `✓ Linked`; the field's chosen row has an accent `✓` and `bg-accent/10`; ▶ is a sibling button before the row when `row.preview`. Group lines are the 11 px uppercase muted heading `SlotPicker` uses; heading lines are its 13 px muted figure heading; indented rows use `pl-5` and the muted `└ `. Reset `query` to `''` whenever `open` turns true. Focus the search on open only under `(pointer: fine)`. The dark theme renders the same markup in an `absolute inset-0 z-40` overlay with the classes `LinkPopup.svelte:170-187` uses, and Escape/backdrop call `onclose`.

- [ ] **Step 2: Build `PickerField.svelte`:** the field button (current row's `label` found in `groups` by `value`, or the muted placeholder, and a `›`), a hidden `<input name={name} value={value ?? ''} {required}>`, and a `Picker` with `kind="field"`, `chosen` = the row key whose `value` matches, `onpick` → set `value`, close. × closes only the picker. The field never resets the surrounding form.

- [ ] **Step 3: Run the checks**

Run: `npm run check`
Expected: PASS (the components are not used yet; svelte-check and lint are clean).

- [ ] **Step 4: Commit.** The components are first used, and checked by hand, in Task 4.

```bash
git add src/lib/components/picker
git commit -m "Picker and PickerField components"
```

---

### Task 3: Server lists for the lesson page, Today and the player

**Files:**
- Modify: `src/lib/types.ts` (add `PickExercise`, `PickRoutine`)
- Modify: `src/lib/server/lessons.ts:490-586` (`listLinkableFigures`, `listLinkableRoutines`, `listLinkableExercises`)
- Modify: `src/lib/server/exercises.ts` (add `listPickExercises`)
- Modify: `src/lib/server/routines.ts` (add `listPickRoutines`)
- Test: `src/lib/server/lessons.spec.ts`, `src/lib/server/exercises.spec.ts` (create if absent), `src/lib/server/routines.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export interface PickExercise {
  	id: number;
  	name: string;
  	source: Source; // 'figure' | 'routine' | 'custom' | 'lesson'
  	everyDays: number;
  	/** A figure exercise's figure and variation names; null otherwise. */
  	figure: string | null;
  	variation: string | null;
  	linked: boolean;
  }
  export interface PickRoutine { id: number; name: string; slots: number; loops: boolean; linked: boolean }
  // lessons.ts
  export function listLinkableFigures(db: Db, lessonId: number): (FigureVersion & { linked: boolean })[];
  export function listLinkableRoutines(db: Db, lessonId: number): PickRoutine[];
  export function listLinkableExercises(db: Db, lessonId: number): PickExercise[];
  // exercises.ts — every live exercise of the dance, linked: false
  export function listPickExercises(db: Db, dance: DanceSlug): PickExercise[];
  // routines.ts — every live routine, slots from listRoutines, loops via buildGraph + routineShapes + loops()
  export function listPickRoutines(db: Db, dance: DanceSlug): Omit<PickRoutine, 'linked'>[];
  ```

- [ ] **Step 1: Write the failing tests.** In `lessons.spec.ts`, replace the tests that assert linked items are absent from the three lists with:
  - `listLinkableFigures: a hand-linked variation is present with linked true`
  - `listLinkableFigures: a variation linked through a section is present with linked true`
  - `listLinkableFigures: other live variations of the dance are linked false; archived ones absent`
  - `listLinkableRoutines: a linked routine is present with linked true and carries slots and loops`
  - `listLinkableExercises: a linked drill is present with linked true`
  - `listLinkableExercises: another lesson's review exercise and the exercise of a linked figure stay absent` (today's exclusion, unchanged)
  - `listLinkableExercises: a figure exercise carries figure and variation names`
  In `exercises.spec.ts`: `listPickExercises returns every live exercise of the dance with source, everyDays, figure and variation`; `listPickExercises leaves out archived exercises and the other dance's`. In `routines.spec.ts`: `listPickRoutines: slots counts children as one; loops follows loops()`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/server/lessons.spec.ts src/lib/server/exercises.spec.ts src/lib/server/routines.spec.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement.** `linked` for figures = by hand (`linkedFigureIds`) or through sections (`viaSections(db, lessonId)` figures); for exercises = in `lesson_exercises` or through sections — exactly the `alreadyLinked` set `listLinkableExercises` builds today, now used to flag instead of exclude. Keep the other exclusions as they are. Figure exercises get their names by joining `figures` and `figure_groups` on `exercises.figure_id`. Order: figures by `listVersions` order; routines and exercises by name.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/server
git commit -m "Linkable lists flag linked items; pick lists for exercises and routines"
```

---

### Task 4: Builders, and the lesson page (#1–#4)

**Files:**
- Create: `src/lib/picker/build.ts`, `src/lib/picker/build.spec.ts`
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (load), `src/routes/[dance]/lessons/[id]/+page.svelte:352-470, 488-560`
- Delete: `src/lib/components/lessons/LinkPicker.svelte`

**Interfaces:**
- Consumes: Task 1 types, Task 2 components, Task 3 lists.
- Produces (`build.ts`, client-safe):
  ```ts
  /** One heading per figure (collapse), rows key `figure:{id}`, label v.label, short v.name, linked when given. */
  export function variationEntries(vs: (FigureVersion & { linked?: boolean })[]): PickHeading[];
  /** A figure picked as a figure: key `group:{id}`, meta variations joined ', '. Takes `MoveTarget`s as they are; a `LinkFigureChoice` maps `groupId` to `id`. */
  export function figureRows(ts: { id: number; name: string; variations: string[] }[]): PickRow[];
  /** key `routine:{id}`, meta per the second-line constraint. */
  export function routineRows(rs: (Omit<PickRoutine, 'linked'> & { linked?: boolean })[]): PickRow[];
  /** Figures (headings by figure, short = variation), Routines, Drills (source 'custom'), Lessons (source 'lesson'); meta frequencyLabel. */
  export function exerciseGroups(es: PickExercise[]): PickGroup[];
  ```

- [ ] **Step 1: Write the failing tests** in `build.spec.ts`:
  - `variationEntries: groups variations under their figure in input order, keys figure:{id}`
  - `variationEntries: carries linked`
  - `figureRows: meta is the variations joined with ", "`
  - `routineRows: "1 slot", "4 slots · loops"`
  - `exerciseGroups: groups in the order Figures, Routines, Drills, Lessons, empty ones left out`
  - `exerciseGroups: a figure with one exercise collapses to "Setenta · Complicado"` (assert through `shown(exerciseGroups(es), '')`)
  - `exerciseGroups: meta is frequencyLabel(everyDays)` (`'Every 3 days'`)

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/lib/picker/build.spec.ts`, FAIL (`Cannot find module './build'`).

- [ ] **Step 3: Implement `build.ts`**, then run the tests to PASS.

- [ ] **Step 4: Rewire the lesson page.**
  - Load: keep `linkableFigures`, `linkableRoutines`, `linkableExercises` (now flagged). `figureGroups` stays (`listMoveTargets`).
  - Each of Exercises, Routines, Figures replaces its `LinkPicker` with a trigger button (search icon + `Link an existing exercise…` / `routine…` / `figure…`) and one `Picker kind="link"` per section, groups: `[{ title: 'Figures', entries: variationEntries(...) }]`, `[{ title: 'Routines', entries: routineRows(...) }]`, `exerciseGroups(...)` (no Lessons group appears because the server list has no review exercises).
  - Tap: post the section's existing action (`?/linkFigure` with `figureId`, `?/linkRoutine` with `routineId`, `?/linkExercise` with `exerciseId`) through a hidden form submitted with `requestSubmit()` under `use:enhance`; on success close the picker; on `failure` keep it open and pass the message to `message`. +: the same post, keep open, `added += 1`. Done/×: close, `added = 0`.
  - Create row: Figures → `[{key:'figure',label:'+ Figure'},{key:'variation',label:'+ Variation'}]`, Routines → `+ Routine`, Exercises → `+ Exercise`. `oncreate` opens the page's existing sheet on top of the picker (`openFigureSheet` in the matching mode, `addingRoutine`, the New exercise sheet) with the query in its name field; that sheet's × returns to the picker with the query kept; its successful submit closes both.
  - #4: in the "Variation of a figure" form, replace `FigureList` with `PickerField name="groupId" label="Figure" placeholder="Choose a figure…" title="Choose a figure" search="Search figures"`, groups `[{ title: 'In this lesson', entries: figureRows(taught) }, { title: 'Figures', entries: figureRows(rest) }]` where `taught` are the `figureGroups` whose id is a group of `data.figures`; `value` starts on the first taught group, or null; a refused `newVariation` restores the posted `groupId`.
  - Delete `LinkPicker.svelte`.

- [ ] **Step 5: Run the checks** — `npm run check`, PASS.

- [ ] **Step 6: Check by hand** in this slot's dev server at 390 px with touch emulation and on desktop: each of the three pickers links with a tap and closes; + twice shows `Done · 2 linked`; a linked item shows `✓ Linked` greyed; "Not in the list?" with "dob" typed opens New figure → Variation of a figure with "dob"; its × returns to the picker with "dob". Review Focus 3: archive a variation in a second tab, then + it — the message shows in the picker and the row stays un-ticked. Review Focus 4: in New variation, type a name, open Figure, press × — the name is still there. Review Focus 5: no field gets focus when a picker opens on the touch-emulated phone.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/picker src/routes/[dance]/lessons src/lib/components/lessons
git commit -m "Lesson page: one picker for figures, routines, exercises and the variation's figure"
```

---

### Task 5: Move to… (#5)

**Files:**
- Modify: `src/lib/components/figures/MoveSheet.svelte:118-140`
- Delete: `src/lib/components/figures/FigureList.svelte`

**Interfaces:**
- Consumes: `PickerField`, `figureRows`.

- [ ] **Step 1: Replace the join list** with the "A new figure of its own" card unchanged and, under the heading `Or join a figure`, a `PickerField name="target"` (groups `[{ title: 'Figures', entries: figureRows(targets) }]`, `title="Join a figure"`, `nothingLeft="There are no other figures yet."`). Choosing a figure selects joining; tapping the card selects `new` (post `target=new`, the field's value cleared). "Name in {figure}" and the submit label follow the chosen figure as they do now. Delete `FigureList.svelte` (no other users after Task 4: `rg FigureList src` is empty).

- [ ] **Step 2: Run the checks** — `npm run check`, PASS.

- [ ] **Step 3: Check by hand:** move a variation to a new figure and to an existing one; a refused move (name clash) keeps the chosen figure and the typed name.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/components/figures
git commit -m "Move to…: the figure is a field that opens the picker"
```

---

### Task 6: Link a section (#9)

**Files:**
- Modify: `src/lib/types.ts` (`SectionGroup.sections: (Spot & { linked: boolean })[]`)
- Modify: `src/lib/server/spot-links.ts:398-421` (`linkableSections`)
- Modify: `src/lib/picker/build.ts`, `build.spec.ts` (add `sectionGroups`)
- Modify: `src/lib/components/ui/LinkSectionSheet.svelte` (becomes a wrapper over `Picker`)
- Test: `src/lib/server/spot-links.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export function linkableSections(db: Db, target: SectionTarget): SectionGroup[]; // now includes sections linked to target, linked: true
  /** Near group (title given) for taughtHere videos, then 'Other videos'; a heading per video (collapse false); rows key `spot:{id}`, label spotLabel(spot), keywords spotLabel({...spot, label: null}) + ' ' + heading, preview true. */
  export function sectionGroups(gs: SectionGroup[], nearTitle: string): PickGroup[];
  ```

- [ ] **Step 1: Write the failing tests.** `spot-links.spec.ts`: `linkableSections includes a section already linked to the target, flagged linked`; `linkableSections for a drill: videos of lessons that link the drill are taughtHere`. `build.spec.ts`: `sectionGroups: taught videos under the near title, the rest under Other videos, in input order`; `sectionGroups: a video with one section keeps its heading`; `sectionGroups: an unnamed section is found by its time` (`shown(sectionGroups(gs, 'In this lesson'), '1:01')` has the row); `sectionGroups: meta shows → what it is linked to`.

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/lib/server/spot-links.spec.ts src/lib/picker/build.spec.ts`, FAIL.

- [ ] **Step 3: Implement** both; sections within a video by `startMs`. Run the tests to PASS.

- [ ] **Step 4: Rewrite `LinkSectionSheet.svelte`** over `Picker kind="link"` (`title="Link a section"`, `placeholder="Search sections"`, `nothingLeft` = today's empty sentence, near title `In this lesson`). Tap and + post `?/linkSection` with the page's `hidden` fields and `spotId` under `use:enhance`; tap closes on success; ▶ opens `SectionPlayer` as now. Callers (`figures/[id]/+page.svelte:521`, `exercises/kinds/drill/Content.svelte:49`) change only the trigger's text to `Link a section…` with the search icon.

- [ ] **Step 5: Run the checks** — `npm run check`, PASS. **Check by hand** on a figure page and a drill page: search "1:01", ▶ previews, + twice then Done.

- [ ] **Step 6: Commit** — `git commit -m "Link a section: the shared picker, with search and linked sections shown"`.

---

### Task 7: The routine editor (#6)

**Files:**
- Modify: `src/lib/components/routines/SlotPicker.svelte`

**Interfaces:**
- Consumes: `Picker` (`kind="act"`, `prefiltered`, `bind:query`, `top`, `empty` snippets); `pickList`, `variationName`, `anchorText` from `fit.ts`. SlotPicker's own props (`open`, `title`, `anchor`, `candidates`, `positionName`, `onpick`, `onclose`) stay exactly as they are, so `routines/[id]/+page.svelte` does not change.

- [ ] **Step 1: Rewrite the body.** Keep `count`, `hold`, the reset on open, `meta()` and `emptyText`. Convert `pickList(...)` to groups: `Figures` with one `PickHeading` per `PickGroup` (`collapse: g.single`, rows key `figure:{id}`, label `c.label`, short `variationName(c)`, meta `meta(c)`), then `Routines` (rows key `routine:{id}`). Pass the query through `bind:query` so `pickList` filters, and `prefiltered`. `top`: the context line and the Count/Hold chips as now. `empty`: today's box with "Turn off Hold"/"Turn off Count". `onpick` maps the row back to its `Candidate` by key and calls the existing `onpick`.

- [ ] **Step 2: Run the checks** — `npm run check`, PASS (`fit.spec.ts` unchanged).

- [ ] **Step 3: Check by hand:** ↓+, ↑+, the seam's +, + Alternative, Add above/below each open the picker with the right context; the chips filter; the empty box's rescue works; a pick adds the slot and closes.

- [ ] **Step 4: Commit** — `git commit -am "Routine editor: SlotPicker over the shared picker"`.

---

### Task 8: The Link popup's data (#7, #8 server side)

**Files:**
- Modify: `src/lib/types.ts` (`LinkOption`, `LinkOptions`)
- Modify: `src/lib/server/link-popup.ts:120-205` (`linkOptions`)
- Modify: `src/lib/picker/build.ts`, `build.spec.ts` (add `linkOptionGroups`)
- Test: `src/lib/server/link-popup.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LinkOption {
  	target: SectionTarget;
  	label: string; // "Enchufla · Doble" or the drill's name
  	drill: boolean;
  	/** A variation's figure and own name, for headings; null for a drill. */
  	figure: string | null;
  	name: string;
  	everyDays: number | null; // a drill's; null for a variation
  	linked: boolean;
  }
  export interface LinkOptions {
  	dance: DanceSlug;
  	spot: { id: number; startMs: number; endMs: number; label: string | null };
  	context: LinkContext;
  	linked: LinkedTarget[];
  	/** 'In this lesson' or 'This figure'. */
  	nearTitle: string;
  	near: LinkOption[];     // variations then drills
  	figures: LinkOption[];  // every other live variation
  	drills: LinkOption[];   // every other live drill
  	figureChoices: LinkFigureChoice[]; // was `figures`
  	defaults: { partner: Partner; style: string };
  }
  /** near (variations as headings, then drills), Figures, Drills. Rows key `figure:{id}` / `exercise:{id}`; drills meta frequencyLabel. */
  export function linkOptionGroups(o: LinkOptions): PickGroup[];
  ```

- [ ] **Step 1: Write the failing tests.** `link-popup.spec.ts` (update the existing near/other tests):
  - `lesson: near holds every live variation of each figure the lesson teaches, by hand or through sections, and the lesson's drills`
  - `recording: near holds the recording's figure's variations; nearTitle is This figure`
  - `a target already linked to the section is listed with linked true, not left out`
  - `figures and drills hold the rest; nothing appears twice`
  - `figureChoices lists near figures first`
  `build.spec.ts`: `linkOptionGroups: near, Figures, Drills in that order, near titled from nearTitle`; `linkOptionGroups: a drill row carries how often`.

- [ ] **Step 2: Run them to see them fail** — `npx vitest run src/lib/server/link-popup.spec.ts src/lib/picker/build.spec.ts`, FAIL.

- [ ] **Step 3: Implement.** The near figures for a lesson = groups of the variations in `lessonSide(db, lessonId).on`; near drills = the lesson's drills in that set. Linked = in `taken` (today's set of the section's links). Run the tests to PASS.

- [ ] **Step 4: Keep `LinkPopup.svelte` compiling** until Task 9 rewrites it: where it reads `options.figures` read `options.figureChoices`; where it reads `near` / `other` read `near.filter((o) => !o.linked)` / `[...figures, ...drills].filter((o) => !o.linked)`. Nothing else changes. Run `npm run check`, PASS.

- [ ] **Step 5: Commit** — `git commit -am "Link popup data: near widened, linked flagged, figures and drills apart"`.

---

### Task 9: The Link popup UI (#7, #8) and its light host

**Files:**
- Create: `src/lib/video/link-steps.ts`, `src/lib/video/link-steps.spec.ts`
- Modify: `src/lib/components/links/LinkPopup.svelte`
- Modify: `src/lib/components/lessons/VideoSections.svelte:28-31, 88-100`

**Interfaces:**
- Consumes: Task 8 shapes and `linkOptionGroups`; `Picker`, `PickerField`.
- Produces:
  ```ts
  /** The popup's levels, bottom first. 'links': linked list + the Link button. 'pick': the picker.
   *  'variation' | 'figure' | 'drill': create steps. 'variation-figure': the variation step's Figure picker. */
  export type LinkStep = 'links' | 'pick' | 'variation' | 'figure' | 'drill' | 'variation-figure';
  interface Props {
  	spotId: number;
  	theme: 'light' | 'dark';
  	/** The stack of levels; the top one shows. Controlled by the host. */
  	steps: LinkStep[];
  	onpush: (step: LinkStep) => void;
  	/** One level back (×, Escape, the backdrop). */
  	onback: () => void;
  	/** Finished or closed: everything goes. */
  	onclose: () => void;
  	onchange?: (labels: string[]) => void;
  }
  // src/lib/video/link-steps.ts — PURE. `LinkStep` is defined here and re-exported by LinkPopup.svelte.
  // (Not under src/lib/links/: `$lib/links` is already the file links.ts.)
  /** Where a host opens the popup: straight into the picker when the section has no links. */
  export function openingSteps(linkedCount: number): LinkStep[]; // 0 → ['pick'], else ['links']
  ```

- [ ] **Step 1: Write the failing test** `openingSteps: no links → pick; some → links` in `src/lib/video/link-steps.spec.ts`; run it to FAIL; implement; run to PASS.

- [ ] **Step 2: Rewrite the popup's levels.**
  - `links`: the header as now, the `Linked` list with × (the "also on the lesson by hand" question unchanged), and one trigger `Link a figure or drill…` → `onpush('pick')`. Without links: `Not linked to anything yet.` above the trigger.
  - `pick`: `Picker kind="link"`, groups `linkOptionGroups(options)`, `title="Link {range} to…"`, `placeholder="Search figures and drills"`, create `+ Variation` / `+ Figure` / `+ Drill`. Tap → `addLink`, then `onclose()`; + → `addLink`, `added += 1`, stay; Done → `onclose()`; a refused call → `message`. `oncreate(key, q)` fills the step's name field with `q` and `onpush(key)`.
  - Create steps as today, minus the chips and "Other…": the variation step's Figure is a `PickerField name="groupId"` with groups `[{ title: options.nearTitle, entries: figureRows(near) }, { title: 'Figures', entries: figureRows(rest) }]`, where `near` / `rest` are `options.figureChoices` split on `near` and mapped `{ id: c.groupId, name: c.name, variations: c.variations }`, its `open` bound so opening it calls `onpush('variation-figure')` and its × calls `onback()`; value starts on the first near figure. "Create and link" → `onclose()`.
  - The light theme stays a `<dialog>`; the picker and the field's picker open above it as `Sheet`s. Escape on any level calls `onback()`.
  - The popup keeps the picker's query while a create step is on top, so × from the create step shows the picker with its search text.
- [ ] **Step 3: Rewire `VideoSections.svelte`:** `steps` is a local array; opening uses `openingSteps(section.links.length)`; `onpush` appends, `onback` pops (popping the last one closes), `onclose` clears and `invalidateAll()` as now.

- [ ] **Step 4: Run the checks** — `npm run check`, PASS.

- [ ] **Step 5: Check by hand** on a lesson with sections: a section with no links opens the picker; a tap links and closes everything; reopening shows the popup with the link; + twice then Done; "Not in the list?" with "dob" → + Variation shows "dob", its Figure field opens the figure picker, × returns to the step, × again to the picker with "dob"; Create and link closes everything. A recording's section shows `This figure`.

- [ ] **Step 6: Commit** — `git commit -am "Link popup: links, a picker, create steps; opens straight into the picker when empty"`.

---

### Task 10: The Link popup in the full-screen player

**Files:**
- Modify: `src/lib/video/screens.ts:13` (`PlayerSheet`), `src/lib/video/screens.spec.ts`
- Modify: `src/lib/components/ui/VideoPlayer.svelte:143, 463-490, 1184-1192`

**Interfaces:**
- Consumes: `LinkStep`, `openingSteps` (Task 9).
- Produces:
  ```ts
  // screens.ts — one sheet per popup level: 'link' (links), 'link-pick' (pick), 'link-new' (a create step), 'link-figure' (variation-figure)
  export type PlayerSheet = 'rename' | 'delete' | 'keys' | 'list' | 'link' | 'link-pick' | 'link-new' | 'link-figure';
  /** The stack's link sheets as popup steps, bottom first. `create` names the step 'link-new' stands for. */
  export function linkStepsOf(stack: Stack, create: 'variation' | 'figure' | 'drill'): LinkStep[];
  ```

- [ ] **Step 1: Write the failing tests** in `screens.spec.ts`: `linkStepsOf: [full, link, link-pick] → ['links','pick']`; `linkStepsOf: [full, link-pick] → ['pick']` (opened straight into the picker); `linkStepsOf: [full, link-pick, link-new, link-figure] with 'variation' → ['pick','variation','variation-figure']`; `linkStepsOf: no link sheets → []`. Run to FAIL; implement; run to PASS.

- [ ] **Step 2: Rewire the player:** `openLink(spotId)` pushes the sheets for `openingSteps(spot.linkedTo.length)`; `onpush` pushes the matching sheet (remembering the create kind); `onback` is `nav.up()`; `onclose` removes every link sheet (`closeLink` as now, over the four names). Render `LinkPopup theme="dark"` while any link sheet is on top, with `steps` from `linkStepsOf`. Hardware Back and Escape step one level at a time.

- [ ] **Step 3: Run the checks** — `npm run check`, PASS.

- [ ] **Step 4: Check by hand** in the player (portrait at 390 px, landscape, desktop): the same walk as Task 9 Step 5, using the phone's Back; the picker and the Figure picker are dark.

- [ ] **Step 5: Commit** — `git commit -am "Player: the Link popup's picker and create steps are history levels"`.

---

### Task 11: Today (#10) and Save this run (#11)

**Files:**
- Modify: `src/routes/[dance]/+page.server.ts:61-64`, `src/routes/[dance]/+page.svelte:289-315`
- Modify: `src/routes/[dance]/player/+page.server.ts:77`, `src/lib/components/player/SaveSetSheet.svelte:8-9, 61-74`

**Interfaces:**
- Consumes: `listPickExercises` (Task 3), `exerciseGroups` (Task 4), `Picker`, `PickerField`.

- [ ] **Step 1: Today.** Load `exercises: listPickExercises(db, dance)` in place of the sorted name list (`exercises` is used by nothing else on the page — check with `rg "data.exercises" src/routes/[dance]/+page.svelte`). Replace the `<select>` form with the trigger `Pick an exercise…` and a `Picker kind="act"` titled `Log a set on {dayLabel(data.day)}`, `placeholder="Search exercises"`, groups `exerciseGroups(data.exercises)`, `nothingLeft="No exercises yet."`; a tap sets `openId` (as the old submit did) and closes.

- [ ] **Step 2: Save this run.** `SaveSetSheet`'s `exercises` prop becomes `PickExercise[]` (the load passes `listPickExercises(db, dance)`); the `<select>` becomes `PickerField name="exerciseId" label="Exercise" placeholder="Choose an exercise…" title="Choose an exercise" search="Search exercises" required`, `value` starting from `fail?.exerciseId ?? null`; Save is disabled while `value` is null. The run's own exercise case (`exercise` given) is unchanged.

- [ ] **Step 3: Run the checks** — `npm run check`, PASS.

- [ ] **Step 4: Check by hand:** on a past day, pick an exercise → its log popup opens for that day; finish a song run with no exercise → Save is off until one is chosen; a failed save keeps the chosen exercise.

- [ ] **Step 5: Commit** — `git commit -am "Today and Save this run: exercises through the shared picker"`.

---

### Task 12: Documents

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the lesson section's linking; "Unsaved changes": a picker's tap and + are one-tap posts)
- Modify: `docs/superpowers/specs/2026-10-01-routine-editor-design.md` ("The picker": the shared picker fed by `fit.ts`)
- Modify: `docs/superpowers/specs/2026-10-29-section-link-popup-design.md` (the list moves into the picker; the direct open; the Figure field; the player's four link levels)
- Modify: `CLAUDE.md` (layout block: `src/lib/picker/` PURE model and builders; `src/lib/components/picker/`; `src/lib/video/link-steps.ts`; the "Live" paragraph gains "one picker for every list"; the spec list gains `2026-10-30-unified-pickers-design.md`)
- Modify: `src/routes/share/+page.server.ts:8` (the comment: older lessons are on the lessons page, without "a search away")

- [ ] **Step 1: Make the edits**, each pointing at `2026-10-30-unified-pickers-design.md` rather than restating it.
- [ ] **Step 2: Run the checks** — `npm run check`, PASS (prettier formats the markdown).
- [ ] **Step 3: Commit** — `git commit -am "Docs: the shared picker in the design, the routine editor and the Link popup specs"`.
