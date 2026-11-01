# Redesign: Moves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the Moves tab — Figures | Routines on the band, the Figures
list with its Positions and Coverage tiles, the Routines list, the New figure /
New routine sheets — and the two screens pushed from it (Positions, Coverage)
in the new look, losing nothing they do today, and add Undo to removing a
position.

**Architecture:** The URLs stay: `/[dance]/figures` and `/[dance]/routines`
are still two routes, both drawn inside one `MovesScreen` whose band carries
the segmented switch; switching segments is a `goto` with `replaceState`.
Every rule a list follows (which chips are on, the heading, which empty state,
the meta words, the gap count, the pick order) lives in pure modules under
`src/lib/moves/` with specs; the pages only lay them out with the foundation's
components. Positions and Coverage are pushed screens (`Screen` with a back
chevron, no tab bar). The only server changes are refusals that name their
field, the positions load gaining the tagged count, and a `restore` action for
Undo.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node), Playwright screenshots via the scratchpad tool.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Moves",
"Patterns used across screens", "Additions" (Undo on a removed position). The
board source is `docs/superpowers/design-kit/screens/moves.py` (exact copy,
spacing and states); its rendered previews are
`$S/previews/s-moves-0.png` … `s-moves-6.png`, where
`S=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.

**This is plan 4 of 13.** It follows the foundation (plan 1, built). Today
(plan 2) and Logging (plan 3) are built in parallel and own
`src/routes/[dance]/+page.*`, `src/lib/components/today/`, the log popup and
the exercise page — do not touch those. A single figure's page (plan 5) and a
single routine's page (plan 6) are out of scope; links from the lists into
them stay as they are.

## Global Constraints

From the foundation, verbatim:

- Colours come from `tokens.ts` / `layout.css` only; no hex in components.
- Small text ≥ 4.5:1 against its background, large (≥ 24 px) ≥ 3:1, in all four themes.
- Small text on the light salsa band is white `#ffffff`; band title and icons are cream `#FFF3E4`.
- Fonts: Bricolage Grotesque (titles, hero, big numbers) and Manrope (everything else), self-hosted.
- Icons: 24 px grid, 2 px round strokes; filled variants for the four tabs; tab bar icons 28 px.
- Radii: 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill. Spacing 4, 8, 12, 16, 20, 24, 32, 48.
- Focus: 2 px accent ring + 4 px halo (accent at 20 %); around a filled control, a 2 px gap first.
- No dance switch anywhere; no dance name in a header.
- Touch targets ≥ 44 px.
- Respect `prefers-reduced-motion` for every animation.
- Project rules from `CLAUDE.md` hold: `use:guarded` for filled-in forms, no browser `confirm()`, nothing from `$lib/server` in components, `npm run check` must pass.

This area's:

- URLs and query strings keep working: `/[dance]/figures?q=&style=&partner=&unlinked=1&new=1`, `/[dance]/routines`, `/[dance]/positions`, `/[dance]/coverage`.
- Small accent text is `text-accent-text`, never bare `text-accent` (salsa light accent is 4.18:1 on the ground).
- Status words ("No section", "No lesson", "In no routine · 7", "7 in no routine") are `text-status` 700; dead end / orphan / breaks are `danger`; "does not loop" is `warn`; never link-looking text.
- Rows: a row is a link (chevron) or one button, never both. Lists are `GROUP` cards; the label above is `SECTION_LABEL`.
- Creating sheets: a refusal about one field shows under that field (`FieldError`, `aria-invalid`, `aria-describedby`); any other refusal is a `Banner kind="error"` at the top of the sheet. The sheet stays open and keeps what was typed.
- Pushed screens (Positions, Coverage) have no tab bar: anything pinned to the bottom sits at `bottom: 0` with `env(safe-area-inset-bottom)` padding, and a `Toast` there passes `bottom="calc(1rem + env(safe-area-inset-bottom))"`.
- `FigureFields.svelte` is shared with the figure page and the lesson page: this plan changes its look and adds an `errors` prop only — its field names, defaults and behaviour stay.

## Review Focus

1. **A search and a chip together:** picking a chip keeps `q`, and All clears the chips but keeps `q` — a filter tap must never drop a typed search. Pinned by `filterChips` tests in Task 2.
2. **The right empty state:** a dance with no figures shows "No figures yet" (no tiles); Not linked with nothing left shows "All linked"; any other empty result shows "No figures match"; tiles step aside while a search runs. Pinned by `figuresEmpty` / `showTiles` tests in Task 2.
3. **A refused New figure lands on the right field in either dance:** a taken name under Figure name, a missing variation name under Variation name, with every typed value kept. Pinned by the action tests in Task 3.
4. **Undo after the name was added again:** remove Caída, add "Caída" again, then tap Undo — one live Caída, no error, no duplicate; and Undo from the other dance's URL is a 404. Pinned by `restorePosition` and action tests in Task 4.
5. **The coverage bar on a phone with a home indicator:** with versions picked, the pinned bar sits on the bottom edge above the safe area and the last row scrolls clear of it (the old 4.5 rem tab-bar offset is gone). Pinned by the full-page screenshot step in Task 5.

---

### Task 1: The Moves shell and the Routines list

**Files:**
- Create: `src/lib/moves/plural.ts`, `src/lib/moves/segment.ts`, `src/lib/moves/routines.ts`
- Test: `src/lib/moves/segment.spec.ts`, `src/lib/moves/routines.spec.ts`
- Create: `src/lib/components/moves/MovesScreen.svelte`, `src/lib/components/ui/FieldError.svelte`
- Modify: `src/lib/components/ui/Segmented.svelte` (an `onchange` prop)
- Modify: `src/lib/nav/pending.ts`, `src/lib/nav/pending.spec.ts`, `src/lib/components/shell/PageSkeleton.svelte`
- Modify: `src/routes/[dance]/routines/+page.server.ts`, `src/routes/[dance]/routines/+page.svelte`
- Test: `src/routes/[dance]/moves-forms.spec.ts` (new; the mock pattern of `dance-wall.spec.ts`)

**Interfaces:**
- Produces:
  - `plural(n: number, one: string, many: string): string` → `"1 slot"`, `"4 slots"`.
  - `type MovesSegment = 'figures' | 'routines'`; `MOVES_SEGMENTS: readonly { value: MovesSegment; label: string }[]` = Figures, Routines; `segmentOf(routeId: string | null): MovesSegment | null`.
  - `routineBadges(r: { slots: number; breaks: number; loops: boolean }): { tone: 'danger' | 'warn'; text: string }[]`.
  - `Skeleton` gains `{ kind: 'moves'; segment: MovesSegment }`.
  - `Segmented` gains `onchange?: (value: string) => void`, called after the bound value changes.
  - `<MovesScreen segment: MovesSegment dance: DanceSlug onnew: () => void children: Snippet />` — `Screen` titled "Moves"; `right` = `BandButton icon="plus"` labelled "New figure" / "New routine"; `extra` = `Segmented onBand name="moves" label="Moves"`, whose change does `goto(resolve('/[dance]/<segment>', { dance }), { replaceState: true, keepFocus: true })`.
  - `<FieldError id: string message: string />` — `FIELD_ERROR` with a 16 px `warning` icon; the field it describes sets `aria-invalid="true"` and `aria-describedby={id}`.
  - Routines `create` refusals: `fail(400, { field: 'name' | 'notes', message, name, notes })` — name: "Give the routine a name (up to 200 characters).", notes: "Notes are up to 2000 characters."

- [ ] **Step 1: Write the failing tests**

```ts
// segment.spec.ts
expect(segmentOf('/[dance]/figures')).toBe('figures');
expect(segmentOf('/[dance]/routines')).toBe('routines');
expect(segmentOf('/[dance]/figures/[id]')).toBeNull();
expect(segmentOf('/[dance]/coverage')).toBeNull();
expect(MOVES_SEGMENTS.map((s) => s.label)).toEqual(['Figures', 'Routines']);

// routines.spec.ts
expect(plural(1, 'slot', 'slots')).toBe('1 slot');
expect(routineBadges({ slots: 8, breaks: 2, loops: true })).toEqual([{ tone: 'danger', text: '2 breaks' }]);
expect(routineBadges({ slots: 5, breaks: 1, loops: false })).toEqual([
  { tone: 'danger', text: '1 break' }, { tone: 'warn', text: 'does not loop' }]);
expect(routineBadges({ slots: 0, breaks: 0, loops: false })).toEqual([]); // an empty routine is not "does not loop"

// pending.spec.ts — replace the Figures and coverage lines
expect(skeletonFor('/[dance]/figures')).toEqual({ kind: 'moves', segment: 'figures' });
expect(skeletonFor('/[dance]/routines')).toEqual({ kind: 'moves', segment: 'routines' });
expect(skeletonFor('/[dance]/coverage')).toEqual({ kind: 'list', title: 'Coverage' });
expect(skeletonFor('/[dance]/positions')).toEqual({ kind: 'list', title: 'Positions' });

// moves-forms.spec.ts — mock `$lib/server/db` + openDb(':memory:') per test, and copy the
// `post` / `call` / `refuses` helpers, exactly as dance-wall.spec.ts does (never $DATA_DIR)
it('refuses a routine without a name under the Name field, keeping the notes', ...)
  // call(routineList.actions.create, post('salsa', { name: ' ', notes: 'For Fridays' }))
  // → { status: 400, data: { field: 'name', message: 'Give the routine a name (up to 200 characters).', notes: 'For Fridays' } }
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves src/lib/nav/pending.spec.ts 'src/routes/[dance]/moves-forms.spec.ts'` — Expected: FAIL (modules missing, old skeleton titles).
- [ ] **Step 3: Implement the pure modules, `pending.ts`, the routines action's `field`.** `segmentOf` is a lookup on the two route ids. In `pending.ts` drop Figures and Routines from `LISTS`, rename coverage's title to "Coverage", and return the `moves` kind for the two route ids.
- [ ] **Step 4: Implement `Segmented.onchange`, `FieldError`, `MovesScreen`, and the Moves skeleton in `PageSkeleton`.** The `moves` skeleton draws the band as `Screen` does (title "Moves" in `font-display` 46/800 cream, then a 50 px `bg-black/15` pill track with the destination's half as a `bg-band-ink` pill, no text), then: for `figures` two 64 px `bg-surface` tile cards (38 px round bone + two bones at 70 % / 50 %), a 44 px pill bone, chip bones 52/112/66/54/70 px × 36 px running off the right edge, a 72 × 10 label bone, five rows; for `routines` the label bone and six rows.
- [ ] **Step 5: Redraw the Routines list** in `MovesScreen segment="routines"`: `SECTION_LABEL` "6 routines" (`plural(n, 'routine', 'routines')`), then a `GROUP` of link rows (min-h 68 px; title 16/700; meta 13 muted "8 slots" followed by `routineBadges` as `Badge` of that tone; trailing `chevron` in `text-chevron`). Empty: `EmptyState icon="routine" title="No routines yet" body="String some figures together into one you can call as a single set."` with a primary "New routine" button (plus icon) opening the sheet, after a 40 px spacer. The band "+" opens the same sheet, as does `?new=1` on load. Sheet "New routine": Name (`FIELD`, `autofocus` with a `svelte-ignore a11y_autofocus` comment, placeholder "Basic combo", `maxlength=200`) and Notes (`TEXTAREA`, 4 rows, placeholder "What this is for, when to reach for it…"); footer: "Create routine" primary full, submitting the form by its `id` (`form="new-routine"`); while sending it shows a `Spinner` and keeps its width (`aria-busy`). The form keeps `use:guarded` (label "New routine"). Field refusals under their field; anything else a Banner. Keep the comment on why there is no archive here.
- [ ] **Step 6: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves src/lib/nav 'src/routes/[dance]/moves-forms.spec.ts'` — Expected: PASS.
- [ ] **Step 7: Look.** `$S/tools/page.sh $S/shots/moves-1 /salsa/routines /bachata/routines /salsa/routines?new=1` and compare with `s-moves-3.png` (Routines, empty, New routine) in light and dark: band, Segmented with Routines selected, badges' tones, the tab bar with Moves lit. Tap Figures in the segmented control (a one-off script on the pattern of `$S/tools/sheet.py`): the URL becomes `/salsa/figures`, and browser Back does not return to Routines.
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Commit** `feat(moves): the Moves band with Figures | Routines, and the Routines list`.

### Task 2: The Figures list

**Files:**
- Create: `src/lib/moves/figures.ts`
- Test: `src/lib/moves/figures.spec.ts`
- Create: `src/lib/components/ui/SearchField.svelte`, `src/lib/components/moves/NavTile.svelte`
- Modify: `src/routes/[dance]/figures/+page.svelte` (the list; the sheet is Task 3)

**Interfaces:**
- Consumes: `MovesScreen`, `plural` (Task 1); `FigureListItem` (`src/lib/types.ts`); the load's `filter`, `unlinked`, `tagged`, `unrouted` (unchanged).
- Produces:
  - `type FigureFilter = { q: string; style?: string; partner?: Partner; unlinked?: '1' }` (the load's `filter` shape).
  - `filterQuery(filter: FigureFilter, change: Partial<FigureFilter>): string` — `"style=son&q=en"`-style query without `?`, empty values dropped, `''` when nothing is set (moved from the page's `filterUrl`).
  - `filterChips(filter: FigureFilter, styles: readonly string[], styleLabel: Record<string, string>, unlinkedCount: number): FigureChip[]` with `FigureChip = { key: string; label: string; count?: number; on: boolean; change: Partial<FigureFilter> }`, in the order All · Not linked · styles · With partner · Solo; keys `all`, `unlinked`, `style:<slug>`, `partner:<partner|solo>`; labels from `styleLabel` and `PARTNER_LABEL`.
  - `figuresHeading(count: number, filter: FigureFilter): string`.
  - `figuresEmpty(count: number, filter: FigureFilter): 'none' | 'all-linked' | 'no-match' | null`.
  - `showTiles(count: number, filter: FigureFilter): boolean`.
  - `figureMeta(f: FigureListItem): { text: string; status: boolean }[]`.
  - `tileMetas(tagged: { done: number; total: number }, unrouted: number): { positions: string; coverage: { text: string; status: boolean } }`.
  - `<SearchField name: string value?: string (bindable) placeholder: string label?: string onclear: () => void />` — the kit's pill: 44 px, `bg-surface`, 1 px inset `hairline` ring, `rounded-full`, 20 px `search` icon in `muted`, `type="search"` input 16 px, a 36 px bare `close` button "Clear search" while the value is non-empty; the ring becomes the focus ring with `focus-within`.
  - `<NavTile href: string icon: IconName title: string meta: string status?: boolean />` — half-width link card: `bg-surface` radius 16, min-h 64, padding 12, gap 10; a 38 px `bg-accent-soft` disc with a 22 px icon in `text-accent-text`; title 16/700; meta 13 `nowrap` truncated, `text-muted` 500 or `text-status` 700.

- [ ] **Step 1: Write the failing tests** (`figures.spec.ts`)

```ts
const none: FigureFilter = { q: '' };
const keys = (f: FigureFilter) => filterChips(f, ['salsa', 'son', 'other'], { salsa: 'Salsa', son: 'Son', other: 'Other' }, 5);
expect(keys(none).map((c) => c.label)).toEqual(['All', 'Not linked', 'Salsa', 'Son', 'Other', 'With partner', 'Solo']);
expect(keys(none)[1]).toMatchObject({ count: 5, on: false, change: { unlinked: '1' } });
expect(keys(none)[0].on).toBe(true);
const son: FigureFilter = { q: 'en', style: 'son' };
expect(keys(son).find((c) => c.key === 'style:son')).toMatchObject({ on: true, change: { style: undefined } });
expect(keys(son).find((c) => c.key === 'style:salsa')!.change).toEqual({ style: 'salsa' });
expect(filterQuery(son, keys(son)[0].change)).toBe('q=en');            // All keeps the search
expect(filterQuery(son, { partner: 'solo' })).toBe('q=en&style=son&partner=solo');
expect(filterQuery(none, {})).toBe('');

expect(figuresHeading(41, none)).toBe('41 figures');
expect(figuresHeading(1, { q: 'dile' })).toBe('1 figure matches');
expect(figuresHeading(3, { q: 'en' })).toBe('3 figures match');
expect(figuresHeading(4, { q: '', unlinked: '1' })).toBe('4 with no section or no lesson');

expect(figuresEmpty(0, none)).toBe('none');
expect(figuresEmpty(0, { q: '', unlinked: '1' })).toBe('all-linked');
expect(figuresEmpty(0, { q: '', unlinked: '1', style: 'son' })).toBe('no-match');
expect(figuresEmpty(0, { q: 'zz' })).toBe('no-match');
expect(figuresEmpty(3, none)).toBeNull();
expect(showTiles(41, none)).toBe(true);
expect(showTiles(3, { q: 'en' })).toBe(false);
expect(showTiles(0, none)).toBe(false);

expect(figureMeta({ variations: 1, recordings: 0, hasSection: false, hasLesson: false } as FigureListItem)).toEqual([
  { text: '1 variation', status: false }, { text: 'No section', status: true }, { text: 'No lesson', status: true }]);
expect(figureMeta({ variations: 4, recordings: 3, hasSection: true, hasLesson: true } as FigureListItem).map((p) => p.text))
  .toEqual(['4 variations', '3 recordings']);
expect(tileMetas({ done: 31, total: 41 }, 7)).toEqual({ positions: '31 / 41 tagged', coverage: { text: '7 in no routine', status: true } });
expect(tileMetas({ done: 0, total: 0 }, 0).coverage).toEqual({ text: 'All in a routine', status: false });
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves/figures.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `figures.ts`.** Query key order is `q, style, partner, unlinked` (the load's order). Style and partner chips are single-valued, as today: tapping the on one clears it, another one replaces it. All is on when no style, partner or unlinked is set, and its change clears those three.
- [ ] **Step 4: Implement `SearchField` and `NavTile`.**
- [ ] **Step 5: Redraw the list** in `MovesScreen segment="figures"`, top to bottom (gap 8 as `Screen`'s sheet): when `showTiles`, two `NavTile`s side by side (gap 8) — Positions (`positions` icon, `tileMetas().positions`) to `/[dance]/positions`, Coverage (`routine` icon) to `/[dance]/coverage`; a `<form role="search">` holding `SearchField name="q" placeholder="Search figures" label="Search figures"` that on submit does `goto` with `filterQuery(filter, { q })` and `{ keepFocus: true, replaceState: true }`, and whose clear does the same with `q: ''`; the chips — `role="group" aria-label="Filter figures"`, one line, `overflow-x-auto` running to the right screen edge (`-mr-4`, scrollbar hidden), each a `CHIP` label around a `sr-only` checkbox `checked={chip.on}` whose change `goto`s `filterQuery(filter, chip.change)` with `{ keepFocus: true, replaceState: true, noScroll: true }`; Not linked shows its count after the label at 700 / 75 % opacity; then `SECTION_LABEL` `figuresHeading` and a `GROUP` of link rows (title 16/700; meta 13 muted with `figureMeta` parts joined by ` · ` separator spans, status parts `text-status font-bold`; trailing chevron) to the row's `firstVariationId`, as today. Empty states (`figuresEmpty`): `none` → 40 px spacer then `EmptyState icon="moves" title="No figures yet" body="Add the first one you learned."` with a primary "New figure" button (plus icon) opening the sheet, and no search or chips; `all-linked` → `EmptyState icon="check-circle" title="All linked" body="Every figure has a section and a lesson."`; `no-match` → `EmptyState icon="search" title="No figures match"`. Remove the old header and its three underlined links (the tiles and the Not linked chip replace them).
- [ ] **Step 6: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves` — Expected: PASS.
- [ ] **Step 7: Look.** `$S/tools/page.sh $S/shots/moves-2 /salsa/figures '/salsa/figures?q=en' '/salsa/figures?unlinked=1' /bachata/figures '/bachata/figures?style=sensual&partner=solo'` and compare with `s-moves-0.png` and `s-moves-2.png` (all linked) in light and dark: tiles and their counts, the pill search with ×, the chip row running off the edge, status words in the meta, and long names ("Prima con la hermana", "Exhíbela") on one line or wrapping cleanly. Also navigate from `/salsa` to `/salsa/figures` with the network throttled (or read the skeleton from a paused navigation) and compare with the loading board.
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Commit** `feat(moves): the Figures list with tiles, search and filter chips`.

### Task 3: The New figure sheet

**Files:**
- Modify: `src/lib/components/figures/FigureFields.svelte` (look; `errors` prop)
- Modify: `src/routes/[dance]/figures/+page.server.ts` (the `create` refusals name their field)
- Modify: `src/routes/[dance]/figures/+page.svelte` (the sheet)
- Modify: `src/routes/[dance]/dance-wall.spec.ts` (the "missing variation name" test's message)
- Test: `src/routes/[dance]/moves-forms.spec.ts`

**Interfaces:**
- Consumes: `FieldError`, `MovesScreen.onnew` (Task 1).
- Produces:
  - `FigureFields` gains `errors?: Partial<Record<'figureName' | 'name' | 'notes', string>>`; its ids come from `$props.id()` (the lesson page renders two at once). Look: `LABEL` above `FIELD` / `TEXTAREA` (Notes 2 rows), Danced and Style as `<fieldset>`s whose `<legend>` uses `LABEL` and whose radios are `CHIP` labels in a wrapping row (gap 8), not equal-width boxes. Copy unchanged ("Figure name", "e.g. Dile que no, Enchufla", "Variation name", "e.g. Basic, Doble, From cross", "Danced", "Style", "Notes", "Count, hand holds, what the teacher said…"). The Figure name input takes `autofocus` (with the `svelte-ignore` comment) so the sheet opens on it.
  - Figures `create` refusals: `fail(400, { field?: 'figureName' | 'name' | 'notes', message, figureName, name, notes })` — checked in this order: no figure name → `figureName`, "Give the figure a name (up to 200 characters)."; no variation name → `name`, "Give the variation a name (up to 200 characters)."; notes too long → `notes`, "Notes are up to 2000 characters."; an invalid partner or style → no field, "Pick how it is danced and its style."; a taken name → `figureName`, "There's already a figure called {figureName}." (unchanged).

- [ ] **Step 1: Write the failing tests** in `moves-forms.spec.ts`

```ts
const fields = { figureName: 'Hammerlock', name: 'From closed', partner: 'partner', style: 'sensual', notes: 'Lead the turn early, on 1.' };
it('puts a taken figure name under Figure name, in bachata too, keeping every field', async () => {
  createFigure(db, 'bachata', { figureName: 'Hammerlock', name: 'Basic', partner: 'partner', style: 'sensual', notes: null });
  expect(await call(figureList.actions.create, post('bachata', fields))).toMatchObject({ status: 400, data: {
    field: 'figureName', message: "There's already a figure called Hammerlock.",
    figureName: 'Hammerlock', name: 'From closed', notes: 'Lead the turn early, on 1.' } });
});
it('puts a missing variation name under Variation name', ...)   // name: '' → field 'name'
it('puts a missing figure name under Figure name', ...)         // figureName: '' → field 'figureName'
it('refuses a style from the other dance without naming a field', ...) // style: 'son' in bachata → no `field`, message 'Pick how it is danced and its style.'
```

  In `dance-wall.spec.ts`, the "refuses a missing variation name" test now expects `message: 'Give the variation a name (up to 200 characters).'`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run 'src/routes/[dance]'` — Expected: FAIL.
- [ ] **Step 3: Implement the refusals** in the `create` action, in the order above.
- [ ] **Step 4: Run** `timeout 600 nix develop -c npx vitest run 'src/routes/[dance]'` — Expected: PASS.
- [ ] **Step 5: Restyle `FigureFields`** as in Interfaces; each field with an error gets `aria-invalid="true"`, `aria-describedby` and a `FieldError` under it.
- [ ] **Step 6: Redraw the sheet** on the figures page: `Sheet title="New figure"`, opened by the band "+", the empty state's button, and `?new=1`; the `use:guarded` form (label "New figure", `id="new-figure"`) holds a `Banner kind="error"` at the top when `form.message` has no `field`, then `FigureFields` with `errors` from `form.field`; the footer holds "Add figure" (primary, full, `form="new-figure"`, `Spinner` while sending, width kept) and "You can add recordings next." centred 13 px `text-muted`. A refused create keeps the sheet open (as today). Closing a filled sheet asks through the existing UnsavedDialog.
- [ ] **Step 7: Look.** `$S/tools/page.sh $S/shots/moves-3 '/salsa/figures?new=1' '/bachata/figures?new=1'` and compare with `s-moves-1.png` in light and dark (sheet title, focused Figure name, chips, footer). With a one-off script on the pattern of `$S/tools/sheet.py`: in bachata, submit a taken name — the message sits under Figure name with the warning icon and the field is outlined in danger; type a name and press Escape — "Unsaved changes" with Save, Stay, Close without saving. Open `/salsa/figures/<id>` and a lesson's New variation sheet: the restyled fields render and still save.
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Commit** `feat(moves): the New figure sheet, refusals under their field`.

### Task 4: Positions — the gap report, its sheets, and Undo

**Files:**
- Create: `src/lib/moves/positions.ts`
- Test: `src/lib/moves/positions.spec.ts`
- Modify: `src/lib/server/positions.ts` (`restorePosition`), `src/lib/server/positions.spec.ts`
- Modify: `src/routes/[dance]/positions/+page.server.ts`, `src/routes/[dance]/positions/+page.svelte`
- Test: `src/routes/[dance]/moves-forms.spec.ts`

**Interfaces:**
- Consumes: `plural`, `FieldError` (Task 1); `act` from `src/lib/components/routines/act.ts` (posts an action without a form and re-runs the load); `Toast`, `Banner`, `Badge`, `Sheet`, `Screen`, `BandButton`.
- Produces:
  - `restorePosition(db: Db, id: number): boolean` — clears `archivedAt`; false when the row is missing or already live (an archived row comes back when its name is added again, so a later Undo finds it live and does nothing).
  - Load adds `tagged: { done: number; total: number }` (`taggedFigures`).
  - Actions: `create` and `rename` refusals carry `field: 'name'` ("Give the position a name.", "That position already exists.", "That name is taken."); `archive` unchanged; new `restore` (`id`; the dance wall via `positionOf`; returns `{ action: 'restore', ok: true }` whether or not anything changed).
  - `positionMeta(c: { inCount: number; outCount: number; deadEnd: boolean; orphan: boolean; unused: boolean }): { text: string; tone: 'danger' | null; mutedTitle: boolean }`.
  - `positionBadges(c): { text: string; tone: 'neutral' | 'danger'; icon?: 'warning' }[]`.
  - `gapsTitle(rows: { deadEnd: boolean; orphan: boolean }[]): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// positions.spec.ts (src/lib/moves)
expect(positionMeta({ inCount: 14, outCount: 16, deadEnd: false, orphan: false, unused: false })).toEqual({ text: '14 in · 16 out', tone: null, mutedTitle: false });
expect(positionMeta({ inCount: 2, outCount: 0, deadEnd: true, orphan: false, unused: false })).toEqual({ text: '2 in · 0 out · dead end', tone: 'danger', mutedTitle: false });
expect(positionMeta({ inCount: 0, outCount: 1, deadEnd: false, orphan: true, unused: false }).text).toBe('0 in · 1 out · orphan');
expect(positionMeta({ inCount: 0, outCount: 0, deadEnd: false, orphan: false, unused: true })).toEqual({ text: '0 in · 0 out · unused', tone: null, mutedTitle: true });
expect(positionBadges({ inCount: 2, outCount: 0, deadEnd: true, orphan: false, unused: false })).toEqual([
  { text: '2 in', tone: 'neutral' }, { text: '0 out', tone: 'neutral' }, { text: 'dead end', tone: 'danger', icon: 'warning' }]);
expect(gapsTitle([{ deadEnd: true, orphan: false }, { deadEnd: false, orphan: true }])).toBe('2 gaps in the graph');
expect(gapsTitle([{ deadEnd: true, orphan: false }])).toBe('1 gap in the graph');
expect(gapsTitle([{ deadEnd: false, orphan: false }])).toBeNull();

// src/lib/server/positions.spec.ts — describe('restorePosition')
it('brings a removed position back with its name and its figures still tagged', ...)
it('does nothing to a live position, or one that does not exist', ...)  // false, row unchanged
it('after the name was added again, leaves exactly one live position', ...)
  // archive Caída → createPosition(… 'caida', 'Caída') revives the row → restorePosition → false; listPositions has one 'caida'

// moves-forms.spec.ts
it('restores a removed position', ...)                // archive then call(positions.actions.restore) → archivedAt null
it("refuses to restore the other dance's position", ...) // bachata id from /salsa → 404, still archived
it('puts a taken position name under Name', ...)      // create 'Shadow' in bachata → { field: 'name', message: 'That position already exists.' }
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves/positions.spec.ts src/lib/server/positions.spec.ts 'src/routes/[dance]/moves-forms.spec.ts'` — Expected: FAIL.
- [ ] **Step 3: Implement** `positions.ts` (moves), `restorePosition`, and the load/action changes.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Redraw the page** as a pushed `Screen title="Positions" subtitle="Hands before and after a figure"`, `left` = `BandButton icon="back" label="Back to Moves"` to `/[dance]/figures`, `right` = `BandButton icon="plus" label="New position"`. Sheet content: an intro `<p>` (14 px `text-ink-2`, px 4) "**31 of 41 figures tagged.** A figure with none tagged starts and ends at the neutral hold." (the bold part `text-ink`, from `tagged`); `Banner kind="warning" title={gapsTitle}` "Dead end: nothing you know leaves it. Orphan: nothing you know gets you there." when there is a gap; `SECTION_LABEL` "10 positions"; a `GROUP` of rows, each ONE `<button>` (min-h 64) opening its sheet: title (muted when `mutedTitle`), meta `positionMeta` (`text-danger font-bold` when `tone`), trailing `Badge tone="accent"` "neutral" on the neutral row and a chevron. No more inline inputs on the rows.
- [ ] **Step 6: The row's sheet:** `Sheet title={name} sub="Position"`; a `use:guarded` form (label "Position name", `id="rename-position"`, action `?/rename`, hidden `id`) with Name (`FIELD`, `maxlength=80`, `autofocus`) and its `FieldError`, then the `positionBadges` row; footer "Save" (primary, full, `form="rename-position"`) and, unless neutral, "Remove position" (`button('danger-text', 'md', true)`, `trash` icon) in its own `use:enhance` form posting `?/archive`. On success Save closes the sheet; Remove closes it at once (set the sheet's `open` to false from the page, not through ×, so no unsaved question) and shows `Toast` "{name} removed" with action "Undo" (`bottom="calc(1rem + env(safe-area-inset-bottom))"`); Undo calls `act('restore', { id })` and clears the toast. An `archive` refusal is a `Banner kind="error"` at the top of the sheet.
- [ ] **Step 7: New position sheet** from the band "+": `Sheet title="New position"`, `use:guarded` form (label "New position", `id="new-position"`, `?/create`) with Name (`FIELD`, `maxlength=80`, `autofocus`) and `FieldError`; footer "Add position" (primary, full). Closes on success.
- [ ] **Step 8: Look.** `$S/tools/page.sh $S/shots/moves-4 /salsa/positions /bachata/positions` (and `FULL=1`) and compare with `s-moves-4.png` in light and dark ("Caída", "Abierta (dos manos)", "Espalda con espalda" set right; the neutral badge; danger meta). With a one-off script: open a row's sheet (no Remove on the neutral one); in bachata add "Shadow" (refused under Name); remove a position, see the toast clear the bottom edge, tap Undo and see the row return.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Commit** `feat(moves): Positions as a gap report with rename and remove sheets, and Undo`.

### Task 5: Coverage — selection and Make routine

**Files:**
- Create: `src/lib/moves/picks.ts`
- Test: `src/lib/moves/picks.spec.ts`
- Modify: `src/routes/[dance]/coverage/+page.server.ts` (the name refusal carries `field: 'name'`), `src/routes/[dance]/coverage/+page.svelte`
- Test: `src/routes/[dance]/moves-forms.spec.ts`

**Interfaces:**
- Consumes: `plural`, `FieldError` (Task 1); `CoverageGroup` (`src/lib/routines/coverage.ts`); `longPress` (`src/lib/longpress.ts`, unchanged).
- Produces:
  - `togglePick(picked: number[], id: number): number[]` — appends, or removes keeping the others' order.
  - `pickNumber(picked: number[], id: number): number | null` — 1-based tap order.
  - `pickedRows(groups: CoverageGroup[], picked: number[]): { id: number; label: string }[]` — in tap order, skipping ids no longer listed.
  - `groupHeading(g: CoverageGroup): string` → "In no routine · 7".
  - `create` refusals: no name → `field: 'name'`, "Give the routine a name (up to 200 characters)."; no ids → no field, "Pick at least one figure." (unchanged).

- [ ] **Step 1: Write the failing tests**

```ts
expect(togglePick([5, 2], 9)).toEqual([5, 2, 9]);
expect(togglePick([5, 2, 9], 2)).toEqual([5, 9]);
expect(pickNumber([5, 9], 9)).toBe(2);
expect(pickNumber([5, 9], 3)).toBeNull();
const groups: CoverageGroup[] = [
  { key: 'none', title: 'In no routine', rows: [{ id: 1, label: 'Exhíbela', routines: [] }, { id: 2, label: 'Kentucky · Doble', routines: [] }] },
  { key: 'one', title: 'In 1 routine', rows: [{ id: 3, label: 'Setenta', routines: [{ id: 7, name: 'Setenta combo' }] }] }];
expect(pickedRows(groups, [3, 1, 99])).toEqual([{ id: 3, label: 'Setenta' }, { id: 1, label: 'Exhíbela' }]);
expect(groupHeading(groups[0])).toBe('In no routine · 2');
// moves-forms.spec.ts
it('puts a missing routine name under Name, keeping the picks to resubmit', ...) // { field: 'name' }
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/moves/picks.spec.ts 'src/routes/[dance]/moves-forms.spec.ts'` — Expected: FAIL.
- [ ] **Step 3: Implement** `picks.ts` and the refusal's `field`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Redraw the page** as a pushed `Screen title="Coverage" subtitle="Versions by how many routines use them"`, `left` = back "Back to Moves" to `/[dance]/figures`, `right` = (not selecting, and there are rows) a bare text button "Select" on the band (44 px tall, px 10, 16/800, `text-band-small`). While selecting, a 13 px `text-muted` hint "Tap in the order the routine should call them." heads the sheet. Each group: label `groupHeading` (`SECTION_LABEL`; `text-status` for `none`), then a `GROUP` of the existing link rows (long press, click swallowing and `sr-only` "Selected," kept): title 16/700, meta (routine names joined ", ", one line, truncated) when there are any, min-h 52 without meta / 64 with; trailing chevron when not selecting; while selecting a 26 px leading disc — empty 2 px `muted` ring, or `bg-accent text-on-accent` 13/800 with `pickNumber` — and a picked row on `bg-accent-soft`. No rows → `EmptyState icon="moves" title="No figures yet"`.
- [ ] **Step 6: The selection bar** (carried from the foundation: it sat at the old tab bar's 4.5 rem offset): fixed at `bottom: 0`, `max-w-[560px]` centred, `bg-tab-bg`, top border `tab-line`, padding `12px 16px calc(12px + env(safe-area-inset-bottom)) 20px`; `role="status"` "3 selected" 16/700 `text-ink`, "Cancel" (`button('tertiary', 'sm')`), "Create routine" (`button('primary', 'sm')` with `plus` icon; disabled at 0). The sheet's bottom padding clears the bar while selecting.
- [ ] **Step 7: The naming sheet:** `Sheet title="New routine"`; `use:guarded` form (`id="cover-routine"`, label "New routine") with the hidden `figureIds` in tap order, a Banner for non-field refusals, Name (`FIELD`, placeholder "Basic combo", `autofocus`) and `FieldError`, a `GROUP` `aria-label="Picked versions"` of `pickedRows` (min-h 48, leading numbered disc), then 13 px `text-muted` "{plural(n, 'figure', 'figures')}, in the order you picked them. Put them in order on the routine page."; footer "Create routine" (primary, full, `form="cover-routine"`, spinner while sending).
- [ ] **Step 8: Look.** `$S/tools/page.sh $S/shots/moves-5 /salsa/coverage /bachata/coverage` and compare with `s-moves-5.png` in light and dark. With a one-off script at 390 × 844: tap Select, pick three rows, screenshot with `full_page` — the bar is flush with the bottom edge and the last row scrolls clear of it; open Create routine and compare with "Coverage · make routine"; submit with no name — the message is under Name and the picks are still there.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Commit** `feat(moves): Coverage with numbered picks and a bar on the bottom edge`.

### Task 6: Both dances end to end, and the docs

**Files:**
- Modify: `CLAUDE.md` (Layout: `src/lib/moves/`, `src/lib/components/moves/`, `ui/SearchField.svelte`, `ui/FieldError.svelte`)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the figures list and Coverage lines; positions are renamed and removed in a sheet, with Undo)
- Modify: `docs/superpowers/specs/2026-10-31-redesign-design.md` (only if a call below changed what the spec says)

- [ ] **Step 1: Walk both dances** in the dev server, light and dark: Today's tab bar → Moves (Figures lit) → Routines → a routine → Back → Figures → a chip → search → clear → Positions tile → Back → Coverage tile → Select → Cancel → Back. Every screen in the new look, nothing old left on these routes (no old token classes and no bare `text-accent` in the four route files: `grep -nE 'bg-plane|bg-raised|border-line|border-rule|text-overdue|accent-ink|text-accent([^-]|$)' 'src/routes/[dance]/'{figures,routines,positions,coverage}/+page.svelte src/lib/components/figures/FigureFields.svelte` prints nothing).
- [ ] **Step 2: Every old feature is still there:** search, style / partner / Not linked filters, `?new=1`, the tagged count, the in-no-routine count, the not-linked count, routine breaks and does-not-loop, rename / add / remove a position (never the neutral), long-press and Select in Coverage, a routine made from picks in tap order.
- [ ] **Step 3: Update the docs** as listed (one line each; CLAUDE.md's Layout block gets `src/lib/moves/ PURE: what the Moves lists show — filter chips, headings, empty states, meta words, gaps, pick order. Client-safe`).
- [ ] **Step 4: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `docs: the Moves area in CLAUDE.md and the design spec`.

---

## Calls made in this plan

- **Two routes, not one.** Moves stays `/[dance]/figures` + `/[dance]/routines`, and the segmented switch navigates between them. Why: every existing link, the tab bar's path, `?new=1` and the skeleton map keep working; each segment keeps its own load. Cost if wrong: a later merge into one route is a move of two files.
- **The segmented switch replaces the history entry** (`replaceState`). Why: it is a view switch inside one tab; Back should leave Moves, not flip between Figures and Routines. Cost: one Back press differs from what someone expecting a push would get.
- **The filter chips are checkboxes that navigate**, styled with the foundation's `CHIP` (`has-checked:`), instead of links. Why: `CHIP` is built on a checked input and "each toggles"; no new chip style needed. Cost: the filters need JavaScript (the whole app already does).
- **Style and partner stay single-valued** (as today); All clears style, partner and Not linked but keeps the search. Why: the load and `listFigures` take one of each; the board says "each toggles, as today". Cost: none against today's behaviour.
- **Tiles show only when there is no search and the list is not empty.** Why: it is the one rule that matches every board (searching, empty, all linked have no tiles; Not linked with results has them). Cost: the tiles vanish on a "No figures match" filter.
- **"No figures match" has a title and no body or action.** The board names the words and nothing else; inventing a "Clear filters" action is a new feature.
- **Refusals name their field** (`field` in the `fail` data), and New figure's single "Give the figure and the variation a name" message is split per field. Why: the spec puts errors under the field they are about. Cost: one existing test's expected message changes.
- **Removing a position says "{name} removed" · Undo** (the spec's Additions say "Deleted · Undo"; the button is "Remove position", so the toast uses the same verb). Undo is a `restore` action that un-archives the row; positions were always archived, never deleted, so nothing else is needed.
- **`?new=1` also opens New routine.** Cheap, symmetrical with figures, and gives Today's first-run "Build a routine" a target. Cost: none if Today does not use it.
- **New shared components:** `ui/SearchField.svelte` (Music's search needs the same pill) and `ui/FieldError.svelte` (every creating sheet needs it). If the Today or Logging plan lands an equivalent first, use theirs and drop these steps. The kit gallery is not extended (the foundation's review said to give `/dev/kit` nothing more).
- **`plural` lives in `src/lib/moves/plural.ts`**, not `format.ts`, to keep clear of the plans editing `format.ts` in parallel; the Cleanup plan can move it.
- **`act()` is reused from `components/routines/act.ts`** for Undo rather than a hidden form. Cost: a Moves page imports from the routines component folder; moving `act.ts` to `src/lib/` is Cleanup's call.
- **The Moves skeleton is its own kind** in `pending.ts` / `PageSkeleton` (band with the segmented placeholder, tiles, search, chips, rows). This touches shell files the Today plan might also touch; conflicts there are additive.
- **The positions page shows the tagged count itself** (load gains `taggedFigures`), as the board's intro needs it.
- **Coverage's empty state** reuses today's words ("No figures yet"), with the Moves icon.
