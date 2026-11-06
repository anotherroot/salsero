# Whose version and the ⋯ menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SourceTabs` on the six family pages with one "whose version" row (option D) that opens a Versions list, and move the copy actions into one shared ⋯ menu in the band.

**Architecture:** Two pure modules decide the words and the order (`src/lib/clones/versions.ts`, `src/lib/menu.ts` + `src/lib/clones/menu.ts`). Three components draw them: `ui/MenuSheet.svelte` (the generic ⋯ and its sheet), `clones/ItemMenu.svelte` (MenuSheet plus the five copy sheets), `clones/Versions.svelte` (the row, the list, the compare lines, the toasts). Each page swaps `<SourceTabs>` for `<Versions>` and puts `<ItemMenu>` at the end of its band's right side, its own menu items passed in.

**Tech Stack:** SvelteKit, Svelte 5 runes, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-versions-and-menu-design.md`

## Global Constraints

- No change to a server offer, a form field, an action or `PAGE_EPOCH`; no change inside `CompareSheet`, `SendSheet` (slot 8's), `CopyToSheet`, `MoveToSheet`, `DropSheet`, `DetachSheet`, `SameAsSheet`, `MakeMineSheet`.
- One version: no row. ⋯ only when the menu has an item.
- Each copy item shows exactly when its offer is non-null; the drill page passes no `sameAs`.
- Menu order: page's own non-danger items, Copy to…, Same as…, Move to…, Detach, Drop my copy, page's own danger items.
- History stays where each page has it today.
- Colours only from the builders (`class-rules.spec.ts`); `swap()` only in `.ts`; one-tap forms on `use:enhance`; refresh after a sheet through `refreshWhenSettled()`.
- Nothing under `$lib/server` imported by a component.
- Words: row title "Your version" / "<possessive(place)> version"; meta "Also: A, B" or "<place> changed: <changed, lower-cased, ', '>"; trailing "<N>"; sheet title `VERSIONS` ("Versions"), sub the item's name; twin meta "Marked the same"; ⋯ label "<Kind> menu" (Figure, Position, Routine, Drill, Song, Lesson).

## Review Focus

1. **A drop that lands on a one-version page** must still show "Back on …" (the `dropped` toast): `Versions` is mounted whenever the page mounted `SourceTabs`, and draws the toast even with one source.
2. **Separate leaving one source** while the list is open: the list closes before the form posts (spec call 7); the row then disappears without an orphaned sheet.
3. **A reader's page** (a group's row read by a member): no edit items, but Copy to… when offered; the ⋯ appears only then.
4. **Edit and selection modes** hide the row and the ⋯ exactly where `SourceTabs` and each page's ⋯ were hidden (figure, lesson, drill `!editing`; routine `!selecting`).
5. **A family copy that is not a source** still appears in the list and opens with `replaceState` and `?vs=`.

Each is pinned by a test or a shot in the task that owns it.

---

### Task 0: Bring the branch up to master

- [ ] **Step 1:** `git merge master` on `positions-rework` (it carries 38299d8, `memberRoute`, which this work needs). Resolve nothing by hand without reading both sides.
- [ ] **Step 2:** `nix develop -c npm run check` — expected: passes.

### Task 1: The menu's order and the copy items (pure)

**Files:**
- Create: `src/lib/menu.ts`, `src/lib/menu.spec.ts`, `src/lib/clones/menu.ts`, `src/lib/clones/menu.spec.ts`

**Interfaces:**
- Produces (`src/lib/menu.ts`, client-safe):
  `type MenuItem = { key: string; icon: IconName; label: string; meta?: string; danger?: boolean; href?: string; onclick?: () => void }`
  `orderMenu(own: MenuItem[], copies: MenuItem[]): MenuItem[]` — own non-danger, copies non-danger, copies danger, own danger; stable within each.
  `menuLabel(kind: CloneKind): string` — "Figure menu", "Position menu", "Routine menu", "Drill menu", "Song menu", "Lesson menu".
- Produces (`src/lib/clones/menu.ts`):
  `type CloneSheet = 'copy' | 'sameAs' | 'move' | 'detach' | 'drop'`
  `type CloneOffers = { copy?: CopyOffer | null; sameAs?: TwinOffer | null; move?: MoveOffer | null; detach?: DetachOffer | null; drop?: DropOptions | null }`
  `cloneMenuItems(o: CloneOffers, open: (s: CloneSheet) => void): MenuItem[]` — in the order copy, sameAs, move, detach, drop; labels `COPY_TO`, `SAME_AS`, `MOVE_TO`, `DETACH_BUTTON`, `DROP_BUTTON` from `clones/view.ts`; icons `copy`, `link`, `move-to`, `unlink`, `undo`; `drop` has `danger: true`; keys = the `CloneSheet` names.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/clones/menu.spec.ts
it('offers each copy action exactly when its offer is set, in order', () => {
	const items = cloneMenuItems({ copy: COPY, sameAs: null, move: null, detach: DETACH, drop: DROP }, () => {});
	expect(items.map((i) => i.key)).toEqual(['copy', 'detach', 'drop']);
	expect(items.map((i) => i.label)).toEqual(['Copy to…', 'Detach', 'Drop my copy']);
	expect(items.find((i) => i.key === 'drop')?.danger).toBe(true);
});
it('opens its sheet', () => {
	const opened: string[] = [];
	cloneMenuItems({ sameAs: TWIN }, (s) => opened.push(s))[0].onclick?.();
	expect(opened).toEqual(['sameAs']);
});
it('no offers, no items', () => expect(cloneMenuItems({}, () => {})).toEqual([]));

// src/lib/menu.spec.ts
it('puts the page’s own first, the copy actions next, and every danger last', () => {
	const own = [item('history'), item('delete', true), item('select')];
	const copies = [item('copy'), item('drop', true)];
	expect(orderMenu(own, copies).map((i) => i.key)).toEqual(['history', 'select', 'copy', 'drop', 'delete']);
});
it('names each kind’s menu', () => {
	expect(menuLabel('position')).toBe('Position menu');
	expect(menuLabel('drill')).toBe('Drill menu');
});
```

(`COPY`, `DETACH`, `DROP`, `TWIN` are minimal literal offers of their types; `item(key, danger?)` builds a `MenuItem`.)

- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/menu.spec.ts src/lib/clones/menu.spec.ts` — FAIL (modules missing).
- [ ] **Step 3:** Implement both modules as in Interfaces.
- [ ] **Step 4:** Same command — PASS.
- [ ] **Step 5:** Commit `feat(clones): the ⋯ menu's order and its copy items`.

### Task 2: The row and the list's words (pure)

**Files:**
- Create: `src/lib/clones/versions.ts`, `src/lib/clones/versions.spec.ts`

**Interfaces:**
- Consumes: `Source`, `FamilyView`, `CompareOffer`, `PlaceRef` (`$lib/types`); `possessive`, `memberMeta`, `selfMeta`, `statusChip`, `YOURS` (`clones/view.ts`).
- Produces:
  `type VersionIcon = 'solo' | 'group' | 'link'`
  `versionRow(i: { sources: Source[]; current: number; self: PlaceRef; compare: CompareOffer | null; family: FamilyView | null }): { title: string; meta: string; changed: boolean; count: number; icon: VersionIcon } | null`
  `type VersionLine = { id: number; label: string; meta: string; chip: { text: string; tone: 'neutral' | 'accent' | 'warn' } | null; icon: VersionIcon; current: boolean; twin: boolean }`
  `versionList(i: { sources: Source[]; current: number; family: FamilyView | null }): VersionLine[]`
  `ROW_WORDS = { yours: 'Your version', also: 'Also: ', twin: 'Marked the same' }`

Rules (from the spec):
- `versionRow`: null when `sources.length < 2`. Title `Your version` when `self.kind === 'mine'`, else `${possessive(self.name)} version`. Icon: the current source's relation `twin` → `link`; else `self.kind === 'mine'` → `solo`, else `group`. Meta: compare offer → `${compare.place} changed: …`; else the first `family.banners` → same form; `changed: true` for both; otherwise `Also: ` + the other sources' labels joined `, `. Count = `sources.length`.
- `versionList`: one line per source in order; the current one: `selfMeta(entry.changed)` with a family entry, else `This one`; others: the family entry for that id → `memberMeta(role, status, changed, pageWord)` and `statusChip(status)`; no entry → `memberMeta(null, source.status, source.changed)`; a twin → `Marked the same`, no chip. Icon: twin → `link`, label `Yours…` (relation self, or a source whose family entry's place is mine) → `solo`, else `group`. Then each family entry whose member id is not a source, with its place's name (`YOURS` for mine) as label.

- [ ] **Step 1: Write the failing tests** — in `versions.spec.ts`, with sources built from the real states of the board:

```ts
it('no row with one version', () =>
	expect(versionRow({ sources: [YOURS_SRC], current: 15, self: MINE, compare: null, family: null })).toBeNull());
it('says whose and who else', () =>
	expect(versionRow({ sources: [YOURS_SRC, INT, SRE], current: 15, self: MINE, compare: null, family: null }))
		.toEqual({ title: 'Your version', meta: 'Also: Intenziuci poletje 2026, Sreda 17:30', changed: false, count: 3, icon: 'solo' }));
it('a group’s page names the group', () =>
	expect(versionRow({ sources: [YOURS_SRC, SRE], current: 32, self: { kind: 'team', teamId: 4, name: 'Sreda 17:30' }, compare: null, family: null })?.title)
		.toBe('Sreda 17:30’s version'));
it('the compare offer wins the meta', () => {
	const r = versionRow({ sources: [YOURS_SRC, SRE], current: 15, self: MINE, compare: { id: 31, place: 'Sreda 17:30', changed: ['Notes'] }, family: FAMILY_WITH_BANNER });
	expect(r?.meta).toBe('Sreda 17:30 changed: notes');
	expect(r?.changed).toBe(true);
});
it('falls back to a differs banner', () => /* compare null, family.banners[0] = Intenziuci, ['Hold'] */
	expect(versionRow({ …, compare: null, family: FAMILY_WITH_BANNER })?.meta).toBe('Intenziuci poletje 2026 changed: hold'));
it('lists this one, the copies with their status, and a twin', () => {
	expect(versionList({ sources: [YOURS_SRC, SRE_NEWER, TWIN_SRC], current: 15, family: FAMILY }).map((l) => [l.label, l.meta, l.chip?.text ?? null, l.current]))
		.toEqual([['Yours', 'This one', null, true], ['Sreda 17:30', 'Owner · newer than yours: notes', 'Newer', false], ['Yours 2', 'Marked the same', null, false]]);
});
it('keeps a copy that is not a source', () =>
	expect(versionList({ sources: [YOURS_SRC, SRE], current: 15, family: FAMILY_WITH_EXTRA }).at(-1)?.label).toBe('Salsa Tuesdays'));
it('without a family view, says the status from the source', () =>
	expect(versionList({ sources: [YOURS_SRC, { ...SRE, status: 'behind', changed: ['Notes'] }], current: 15, family: null })[1].meta)
		.toBe('Behind yours: notes'));
```

(Check `memberMeta`'s exact output for the last line against `view.ts` and use what it returns.)

- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/clones/versions.spec.ts` — FAIL.
- [ ] **Step 3:** Implement `versions.ts` per the rules.
- [ ] **Step 4:** Same command — PASS.
- [ ] **Step 5:** Commit `feat(clones): the whose-version row and the Versions list, as words`.

### Task 3: The components

**Files:**
- Create: `src/lib/components/ui/MenuSheet.svelte`, `src/lib/components/clones/ItemMenu.svelte`, `src/lib/components/clones/Versions.svelte`, `src/lib/components/clones/VersionsSheet.svelte`, `src/lib/components/clones/copied.svelte.ts`
- Delete: `src/lib/components/clones/SourceTabs.svelte`, `src/lib/components/clones/FamilyList.svelte` (after Task 5, once no page imports them)
- Modify: `src/routes/dev/kit/+page.svelte` (a MenuSheet and a Versions row in the gallery)

**Interfaces:**
- `MenuSheet.svelte` props: `{ title: string; label: string; items: MenuItem[]; focusKey?: string }`. Draws nothing when `items` is empty; else a `BandButton icon="more"` and a `Sheet size="small"` of one `GROUP` card: an item with `href` is an `<a>`, else a `<button aria-haspopup="dialog">` that sets the menu closed and then calls `onclick`. Row: `flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-step`, icon 22 `text-accent-text` (`text-danger` when danger), label 16 bold `text-ink` / `text-danger`, meta 13 `text-muted` under it.
- `ItemMenu.svelte` props: `{ title: string; kind: CloneKind; current: number; own?: MenuItem[] } & CloneOffers`. Renders `MenuSheet` with `orderMenu(own, cloneMenuItems(offers, s => (open = s)))`, `menuLabel(kind)`, and the five sheets exactly as `SourceTabs` mounts them (DropSheet `fromId={current}`, DetachSheet `{kind}`, CopyToSheet `{current}` with `ondone={(m, href) => copied.show(m, href)}`, SameAsSheet, MoveToSheet `{current}`).
- `copied.svelte.ts`: `copied = { toast: {id, message, href?} | null, show(message, href?), clear() }` — a rune-backed module state, so the toast outlives the band.
- `Versions.svelte` props: `{ sources: Source[]; kind: CloneKind; dance: DanceSlug; current: number; mineId: number | null; self: PlaceRef; taking?: string | null; compare?: CompareOffer | null; family?: FamilyView | null; title: string }`. Draws: the row (`versionRow`; a `GROUP` card with one `<button aria-haspopup="dialog">`, tile 40 px `bg-accent-soft text-accent-text`, meta in `text-status font-bold` when `changed`, trailing count + `chevron-down` in `text-accent-text`), then `taking`, the compare line and the differs banners with their `CompareSheet`s exactly as `SourceTabs` did, then the `dropped` toast and the `copied` toast (one `Toast`, the later wins), always mounted.
- `VersionsSheet.svelte` props: `{ open; onclose; lines: VersionLine[]; title: string; kind; dance; current; mineId; twins: boolean; canSend: boolean }`. A row per line (current: check, no link; else `<a>` that `goto`s `memberRoute` + `?vs=` as `SourceTabs.open` did, `replaceState: true, keepFocus: true, noScroll: true`); `Not the same? Separate` (the `?/separate` form, `use:enhance`, `refreshWhenSettled`) when `twins`; footer Send mine… when `canSend`, which closes the list and opens `SendSheet`. Separate closes the list before it posts.

- [ ] **Step 1:** Build the five files to the interfaces. Keep `SourceTabs.svelte` and `FamilyList.svelte` until Task 5.
- [ ] **Step 2:** `nix develop -c npm run check` — PASS (class rules, svelte-check, eslint).
- [ ] **Step 3:** Commit `feat(clones): the ⋯ menu, the whose-version row and the Versions list`.

### Task 4: Figure, position and drill pages (no ⋯ today)

**Files:**
- Modify: `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`, `src/routes/[dance]/(moves)/positions/[id]/+page.svelte`, `src/routes/[dance]/(today)/exercises/[id]/+page.svelte`

- [ ] **Step 1:** On each page replace `<SourceTabs …>` with `<Versions …>` in the same place and under the same condition, passing `self={data.cloneLine.self}` and the item's name as `title`, plus the props it passed before minus `copy`, `sameAs`, `drop`, `detach`, `move`. Add `<ItemMenu>` as the last thing in the band's `right` snippet (after History and the pencil), under the condition that hid `SourceTabs` (figure and drill: `!editing`; position: `editing !== 'pane'`), with `copy={data.copyTo}`, `sameAs`, `drop`, `detach` as before (drill: no `sameAs`), `own` empty.
- [ ] **Step 2:** Shots (Task 6's command) of the figure, position and drill pages with versions — row, list and ⋯ draw; a one-version page shows no row.
- [ ] **Step 3:** `nix develop -c npm run check` — PASS. Commit `feat(clones): whose version and ⋯ on figures, positions and drills`.

### Task 5: Lesson, song and routine pages (their ⋯ folds in)

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/routes/[dance]/songs/[id]/+page.svelte`, `src/routes/[dance]/(moves)/routines/[id]/+page.svelte`, `src/lib/components/routines/RoutineMenu.svelte` (delete it; Select slots becomes an `own` item), `src/routes/[dance]/lessons/lesson-pane.spec.ts`
- Delete: `SourceTabs.svelte`, `FamilyList.svelte`

- [ ] **Step 1:** Swap `SourceTabs` for `Versions` as in Task 4 (lesson `!editing`, routine `!selecting`, song always).
- [ ] **Step 2:** Replace each page's hand-drawn menu with `<ItemMenu own={…}>`:
  - Lesson: `own` = History (`href`, when `data.historyHref`), Remove from my lessons (`danger`, opens the existing Dialog, when `data.add?.added`); plus `copy`, `sameAs`, `move`, `drop`, `detach`. Shown `!editing`.
  - Song: `own` = History (when `data.historyHref`), Stop sharing (when `canEdit && song.sharedAt !== null`), Delete (`danger`, when `canEdit`); these only for a group song as today (`group !== null`); plus the copy offers.
  - Routine: `own` = Select slots (meta "Duplicate, delete or make a routine of several", icon `check-circle`, when `data.canEdit && data.slots.length > 0`, calls the page's selection start); plus the copy offers. Keep the routine's desk rules (the band's `actions` snippet and its `desk:` classes) so the ⋯ sits where it sits today.
- [ ] **Step 3:** Update `lesson-pane.spec.ts` to assert the same about `<Versions` (above `PaneColumns`, never in a column snippet).
- [ ] **Step 4:** Delete `SourceTabs.svelte`, `FamilyList.svelte`, `RoutineMenu.svelte`; update `dropped.svelte.ts`'s comment (`Versions`).
- [ ] **Step 5:** `nix develop -c npm run check` — PASS. Commit `feat(clones): lesson, song and routine menus are the shared ⋯`.

### Task 6: Shots, docs, merge

- [ ] **Step 1: Shots.** Copy `~/Backups/salsa/db/salsa-2026-11-06.db` into the scratchpad (never `.data` or the backup). Shoot at 390x844, light and `--theme dark`, `SHOTS_DANCE=bachata`, the pages: `/bachata/positions/14`, `/bachata/positions/24`, `/bachata/positions/11`, `/bachata/positions/32?vs=24`, a figure with versions (`/bachata/figures/16`), a lesson, a song, a routine and a drill of the admin's with a group copy (pick ids from the db: families with two or more members). Add scenes in a new `scripts/shots/ext_versions.py` for the Versions list open and the ⋯ open on `/bachata/positions/11`, and a drop landing (Review Focus 1). Look at every shot; also `1440x900 --viewport`.
- [ ] **Step 2: Docs.** In the spec, mark "Built" notes where the build chose; in `2026-11-03-clones-and-twins-design.md` and `2026-10-31-redesign-design.md`, replace the tabs and the button row with the row, Versions and ⋯ (a line each, pointing at the new spec); in `CLAUDE.md`'s layout, `src/lib/menu.ts`, `src/lib/clones/versions.ts` and `menu.ts`, `ui/MenuSheet`, `clones/Versions`, `ItemMenu`; and the new spec in the specs paragraph.
- [ ] **Step 3:** `nix develop -c npm run check` — PASS. Commit `docs: whose version and the ⋯ menu`.
- [ ] **Step 4:** Send the user the shots (one HTML, light and dark) before merging. After they agree, merge into `master` locally (`git checkout master && git merge --no-ff positions-rework`), from the main checkout.
