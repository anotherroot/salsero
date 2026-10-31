# Redesign: a routine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw a routine's page (`/[dance]/routines/[id]`) in the new look — the band
with back, pencil and a ⋯ sheet holding Select, the Practise hero, the facts and loop
badges, slot cards, warn seams, the alternatives rail, selection with its bar on the
bottom edge, Make routine, Edit routine with one pinned Save and an Archive dialog, the
empty and loading states — with every gesture of the routine editor kept.

**Architecture:** The route, its actions and the editor's machinery (`act.ts`, `fit.ts`,
`longpress.ts`, `gestures/drag.ts` and `swipe.ts`, the optimistic overlays) stay. Every
data-dependent line of copy (facts, badges, slot meta, seam wording, selection title,
where a refusal shows, which band size) moves into a pure `src/lib/routines/page.ts`
with a spec; `selection.ts` and `drag.ts` gain one pure function each. The components in
`src/lib/components/routines/` are restyled in place; the page wires them. Two refusals
(`rename`, `extract`) name their field and action, so the error lands under the field.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node only), Drizzle/SQLite
(no schema change).

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "A routine", "Patterns
used across screens", "Additions" (the ⋯ Select), "Calls made" (the Exercise row). The
editor's behaviour: `docs/superpowers/specs/2026-10-01-routine-editor-design.md` (every
gesture there must survive). Board source: `docs/superpowers/design-kit/screens/routine.py`;
previews `s-routine-0.png` … `s-routine-2.png` in the scratchpad `previews/` folder.

**This is plan 6 of 13.** All plans land on branch `app-icons`. It builds on the
foundation (plan 1: `Screen`, `BandButton`, `HeroCard`, `Badge`, `Banner`, `EmptyState`,
`Sheet`, `Dialog`, `Toast`, `Spinner`, `Icon`, `styles.ts`) and reuses, without
re-creating: plan 3's `Sheet` props, `BottomBar` and the exercise page's edit pattern
(pencil → × Stop editing via `leaveOrAsk`, one Save pinned in `BottomBar`); plan 4's
`FieldError`, `plural` (`src/lib/moves/plural.ts`) and its field-named refusals; plan 5's
`Screen` slim subtitle. Out of scope: the shared `Picker`'s sheet, search, rows and
headings (plan 8 "Picker and Link popup" — only `SlotPicker`'s own `top` and `empty`
snippets are restyled here), the Practice/player page, the routine log popup (plan 3).

`SHOTS` below is
`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/tools`;
the dev server on http://localhost:20000 serves this worktree and `page.sh` is signed in.

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

- The URL and every action name and form field (`rename`, `duplicate`, `archive`, `addOption`, `removeOption`, `restoreOption`, `note`, `insert`, `reorder`, `deleteMany`, `restore`, `duplicateMany`, `extract`) stay. The only server changes: `rename` and `extract` refusals gain `action` and `field`; the load gains `childSlots`.
- Every gesture of the editor spec keeps working: handle drag (pointer, auto-scroll, Escape/`pointercancel` puts it back, ↑/↓ on a focused handle), swipe left to Delete / Remove (direction lock, snap, one open at a time, tap elsewhere closes), long-press to select, tap to expand one card, the note saving on blur/Enter with Escape restoring and the unsaved guard, the flash and expand after an insert, Undo for deleted slots and removed alternatives, refusals under the slot they were aimed at.
- Status colours: "Doesn't loop" and seams in `warn`; breaks and timing breaks in `danger`; "Loops" in `done`; danger otherwise only for what destroys (Delete, Remove, Archive).
- Small accent text is `text-accent-text`, never bare `text-accent`. Text on an `accent-soft` fill (a selected card) is `ink` or `ink-2`, never `muted` (4.13:1 in bachata light).
- This is a pushed screen with no tab bar: the selection bar, the edit `BottomBar` and the toast sit at `bottom: 0` / `1rem` plus `env(safe-area-inset-bottom)`; nothing uses `--tab-bar-h` or the old `4.5rem` offset.
- Edit is the band's pencil: × "Stop editing" (asks if unsaved, `leaveOrAsk`) and one Save pinned at the bottom; no ✓ on the band.
- The page's only question is the Archive `Dialog`; deletes never ask (Undo instead).

## Review Focus

1. **A selected card stays readable:** on the `accent-soft` fill the meta, note and "or …" lines switch from `muted` to `ink-2` (muted is 4.13:1 there in bachata light). Pinned by the new `ink-2`/`accent-soft` token pair in Task 1 and the selection screenshots in Task 4.
2. **A refusal lands where it is about:** a rename with an empty name under Name in edit mode, too-long notes under Notes, an unnamed Make routine under its Name, a non-contiguous Make routine as a banner in its sheet, a slot refusal under its slot, anything else in a dismissable page banner — never twice. Pinned by the `failurePlace` tests (Task 1) and `routine-forms.spec.ts` (Tasks 4 and 5).
3. **Selecting from the ⋯ sheet with nothing selected:** the band reads "Select slots", every action is greyed and says why on tap, and nothing posts an empty `stepIds`. Pinned by the `actionBlocks` tests (Task 1) and the Task 4 screenshot.
4. **The bottom edge on a screen without tabs:** the selection bar touches the bottom, the last slot scrolls clear of it, the Undo toast sits 1 rem above the safe area, and a drag's dashed gap opens exactly where the card will land. Pinned by the `gapTop` tests (Task 1) and the FULL screenshots in Tasks 3 and 4.
5. **Names and badges at the edges:** an empty routine shows no loop badge and no facts; "1 break" / "2 timing breaks" pluralise; a long name ("Hammerlock combo con vuelta y salida") takes the 30 px band, wraps to two lines, ellipsizes in the slim band, and never pushes the pencil or ⋯ off. Pinned by the `factBadges` / `bandCompact` tests (Task 1) and the long-name screenshot in Task 2.

---

### Task 1: What the page derives

**Files:**
- Create: `src/lib/routines/page.ts`, `src/lib/routines/page.spec.ts`
- Modify: `src/lib/routines/selection.ts`, `src/lib/routines/selection.spec.ts`
- Modify: `src/lib/gestures/drag.ts`, `src/lib/gestures/drag.spec.ts`
- Modify: `src/lib/theme/tokens.spec.ts` (two pairs)
- Modify: `src/lib/icons/icons.ts` (five icons)

**Interfaces:**
- Consumes: `RowEdges` (`src/lib/routines/routines.ts`), `plural` (`src/lib/moves/plural.ts`).
- Produces (`page.ts`, PURE, client-safe):
  - `bandCompact(name: string): boolean` — true when `name.length > 18` or any word is longer than 10 characters.
  - `factsOf(starts: string[], end: string | null): { from: string; to: string | null } | null` — `from` = starts joined `' or '`; null when `starts` is empty.
  - `type FactBadge = { tone: 'done' | 'warn' | 'danger'; text: string; loop: boolean }`; `factBadges(r: { slots: number; breaks: number; timingBreaks: number; loops: boolean }): FactBadge[]` — `[]` when `slots === 0`; else first `{ done, 'Loops', loop: true }` or `{ warn, 'Doesn’t loop', loop: true }`, then `plural(breaks, 'break', 'breaks')` and `plural(timingBreaks, 'timing break', 'timing breaks')` in `danger` (`loop: false`) when non-zero.
  - `slotMeta(e: RowEdges, name: (id: number) => string, childSlots: number | null): string` — the core is `''` when `e.starts` is empty, else `"{startCounts joined '/'}→{next ?? '?'} · {starts names joined ' / '} → {end name ?? '?'}"`; with `childSlots !== null`, `'Routine'`, `plural(childSlots, 'slot', 'slots')` and the core joined `' · '` (empty parts dropped).
  - `seamLabel(hands: { end: string; next: string[] } | null, count: { ready: number | null; next: number[] } | null): string` — "Ends in {end}, next starts from {next joined ' or '}"; "ready for {ready ?? '?'}, next starts on {next joined ' or '}"; joined `' · '`; first letter upper-cased.
  - `selectionTitle(n: number): string` — `'Select slots'` at 0, else `'{n} selected'`.
  - `makeRoutineCaption(n: number): string` — n = 1: "The slot moves into the new routine, and it takes its place here as one slot."; else "The {n} slots move into the new routine, and it takes their place here as one slot."
  - `type FailurePlace = { where: 'slot'; stepId: number; message: string } | { where: 'edit'; field: 'name' | 'notes'; message: string } | { where: 'extract'; field: 'name' | null; message: string } | { where: 'banner'; message: string }`; `failurePlace(form: unknown, slotIds: number[]): FailurePlace | null` — null without a string `message`; `action: 'rename'` → `edit` (`field` `'notes'` when so, else `'name'`); `action: 'extract'` → `extract` (`field` `'name'` or null); a numeric `stepId` that is in `slotIds` → `slot`; anything else → `banner`.
- Produces (`selection.ts`): `type SelectionAction = 'above' | 'below' | 'duplicate' | 'extract' | 'delete'`; `actionBlocks(count: number, extractBlocked: string | null): Record<SelectionAction, string | null>` — above/below: `count === 1 ? null : 'Select one slot to add next to it.'`; duplicate/delete: `count === 0 ? 'Select slots first.' : null`; extract: `extractBlocked`.
- Produces (`drag.ts`): `gapTop(tops: number[], heights: number[], from: number, to: number): number` — the top (list-relative) of the gap the dragged card leaves open: `tops[to]` when `to <= from`, else `tops[to] + heights[to] - heights[from]`.
- Produces (`icons.ts`, canonical names, from `GLYPH` in `routine.py`): `add-above`, `add-below`, `copy`, `arrow-up`, `arrow-down`.

- [ ] **Step 1: Write the failing tests.** `page.spec.ts`:

```ts
const name = (id: number) => ({ 1: 'Open', 2: 'Closed', 3: 'Hammerlock' })[id] ?? '?';
it('picks the band size from the name', () => {
  expect(bandCompact('Shine combo')).toBe(false);
  expect(bandCompact('Hammerlock combo')).toBe(false);
  expect(bandCompact('Hammerlock combo con vuelta y salida')).toBe(true);
  expect(bandCompact('Hammerlockcombo')).toBe(true);
});
it('states where it starts and ends', () => {
  expect(factsOf(['Open'], 'Closed')).toEqual({ from: 'Open', to: 'Closed' });
  expect(factsOf(['Open', 'Closed'], null)).toEqual({ from: 'Open or Closed', to: null });
  expect(factsOf([], null)).toBeNull();
});
it('badges loops, breaks and timing breaks', () => {
  expect(factBadges({ slots: 0, breaks: 0, timingBreaks: 0, loops: false })).toEqual([]);
  expect(factBadges({ slots: 3, breaks: 0, timingBreaks: 0, loops: true })).toEqual([{ tone: 'done', text: 'Loops', loop: true }]);
  expect(factBadges({ slots: 6, breaks: 1, timingBreaks: 2, loops: false })).toEqual([
    { tone: 'warn', text: 'Doesn’t loop', loop: true },
    { tone: 'danger', text: '1 break', loop: false },
    { tone: 'danger', text: '2 timing breaks', loop: false }]);
});
it('writes a slot’s meta line', () => {
  const e = { starts: [1], startCounts: [1], end: 2, next: 1 };
  expect(slotMeta(e, name, null)).toBe('1→1 · Open → Closed');
  expect(slotMeta({ starts: [1], startCounts: [1], end: 1, next: 1 }, name, 3)).toBe('Routine · 3 slots · 1→1 · Open → Open');
  expect(slotMeta({ starts: [], startCounts: [], end: null, next: null }, name, null)).toBe('');
  expect(slotMeta({ starts: [], startCounts: [], end: null, next: null }, name, 1)).toBe('Routine · 1 slot');
});
it('words a seam', () => {
  expect(seamLabel({ end: 'Hammerlock', next: ['Open'] }, null)).toBe('Ends in Hammerlock, next starts from Open');
  expect(seamLabel(null, { ready: 5, next: [1] })).toBe('Ready for 5, next starts on 1');
  expect(seamLabel({ end: 'Shadow', next: ['Open', 'Closed'] }, { ready: 5, next: [1, 3] }))
    .toBe('Ends in Shadow, next starts from Open or Closed · ready for 5, next starts on 1 or 3');
});
it('titles the selection and captions Make routine', () => {
  expect(selectionTitle(0)).toBe('Select slots');
  expect(selectionTitle(3)).toBe('3 selected');
  expect(makeRoutineCaption(3)).toBe('The 3 slots move into the new routine, and it takes their place here as one slot.');
  expect(makeRoutineCaption(1)).toBe('The slot moves into the new routine, and it takes its place here as one slot.');
});
it('places a refusal', () => {
  expect(failurePlace(null, [4])).toBeNull();
  expect(failurePlace({ ok: true }, [4])).toBeNull();
  expect(failurePlace({ action: 'rename', field: 'notes', message: 'm' }, [4])).toEqual({ where: 'edit', field: 'notes', message: 'm' });
  expect(failurePlace({ action: 'rename', message: 'm' }, [4])).toEqual({ where: 'edit', field: 'name', message: 'm' });
  expect(failurePlace({ action: 'extract', field: 'name', message: 'm' }, [4])).toEqual({ where: 'extract', field: 'name', message: 'm' });
  expect(failurePlace({ action: 'extract', message: 'm' }, [4])).toEqual({ where: 'extract', field: null, message: 'm' });
  expect(failurePlace({ stepId: 4, message: 'm' }, [4])).toEqual({ where: 'slot', stepId: 4, message: 'm' });
  expect(failurePlace({ stepId: 9, message: 'm' }, [4])).toEqual({ where: 'banner', message: 'm' });
  expect(failurePlace({ message: 'Those slots could not be put back.' }, [4])).toEqual({ where: 'banner', message: 'Those slots could not be put back.' });
});
```

  `selection.spec.ts`: `actionBlocks(0, 'Select the slots to make into a routine.')` → above/below `'Select one slot to add next to it.'`, duplicate/delete `'Select slots first.'`, extract the given string; `actionBlocks(1, null)` → all null; `actionBlocks(3, null)` → above/below blocked, the rest null.
  `drag.spec.ts` (cards 66/106/66 px, 8 px apart): `gapTop([0, 74, 188], [66, 106, 66], 0, 2)` → `188`; `(…, 2, 0)` → `0`; `(…, 1, 1)` → `74`; `gapTop([0, 74, 148, 222], [66, 66, 66, 66], 1, 3)` → `222`.
  `tokens.spec.ts`: add `['ink-2', 'accent-soft']` and `['warn', 'warn-soft']` to `pairs` (they pass: ≥ 7.5 and ≥ 5.29 in every theme; the seam text and a selected card depend on them).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/routines src/lib/gestures src/lib/theme src/lib/icons` — Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the functions in their files, and the five icons (markup copied from `GLYPH` in `routine.py`, kebab-case keys, strokes only).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(routine): what the routine page derives — facts, badges, meta, seams, refusal places, the drag gap`.

### Task 2: The band, the hero, the facts and More

**Files:**
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte` (the header, the reading sections above and below the slots, the banner, the toast)
- Create: `src/lib/components/routines/RoutineMenu.svelte`
- Modify: `src/lib/components/ui/Banner.svelte`, `src/routes/dev/kit/+page.svelte` (Banner `ondismiss`)
- Modify: `src/lib/nav/pending.ts`, `src/lib/nav/pending.spec.ts`, `src/lib/components/shell/PageSkeleton.svelte` (a routine-shaped skeleton)

**Interfaces:**
- Consumes: `bandCompact`, `factsOf`, `factBadges`, `failurePlace` (Task 1); `Screen`, `BandButton`, `HeroCard`, `Badge`, `Banner`, `EmptyState`, `Sheet`, `Toast`, `Icon`, `button`, `GROUP`, `SECTION_LABEL`, `longDayLabel`.
- Produces:
  - `Banner` gains `ondismiss?: () => void` — a bare 40 px `close` 20 `text-muted` button "Dismiss" at the banner's right (padding right becomes 6 px), as `kit.banner(dismiss=True)`.
  - `<RoutineMenu open: boolean title: string canSelect: boolean onselect: () => void onclose: () => void />` — a `Sheet` (title = the routine's name) holding one `GROUP` row button (min-h 64): `check-circle` 22 `text-accent-text`, "Select slots" 16/700 over "Duplicate, delete or make a routine of several" 13 `text-muted`; `onselect` closes the sheet first. Not rendered at all when `!canSelect` (the page hides ⋯ then).
  - `Skeleton` gains `{ kind: 'routine' }`; `skeletonFor('/[dance]/routines/[id]')` returns it (removed from `DETAILS`).
  - Page state used by later tasks: `editing`, `selecting`, `selected`, `menuOpen`, `place = $derived(failurePlace(form, data.slots.map((s) => s.id)))`, `dismissed` (the `form` object whose banner was dismissed).

- [ ] **Step 1: Write the failing test** in `pending.spec.ts`: `skeletonFor('/[dance]/routines/[id]')` → `{ kind: 'routine' }`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/nav` — Expected: FAIL.
- [ ] **Step 3: Implement** the skeleton kind. `PageSkeleton` draws for it: a full band with a back and two icon placeholders and a 46 px title bar ~50 % wide, room for the hero (92 px bottom padding); on the sheet an 84 px `bg-skeleton` radius 22 card straddling the edge, a 14 px bar ~70 % wide, two 22 px pill bars, a 13 px label bar, four 64 px radius-16 cards each holding a 20 px dot, a 26 px disc and two bars — all `bg-skeleton`.
- [ ] **Step 4: Banner dismiss** and its gallery entry (an error banner "Those slots could not be put back." with Dismiss).
- [ ] **Step 5: The band.** Replace the sticky `<header>` with `<Screen title compact left right hero>`:
  - reading: `title={routine.name}`, `compact={bandCompact(routine.name)}`; `left` = `BandButton icon="back" label="Back to Moves"` → `resolve('/[dance]/routines', …)`; `right` = `BandButton icon="pencil" label="Edit routine"` → `editing = true; window.scrollTo({ top: 0 })`, then, when `data.slots.length > 0`, `BandButton icon="more" label="More actions"` → `menuOpen = true`.
  - selecting: `title={selectionTitle(selected.length)}`, `compact`; `left` = `BandButton icon="close" label="Stop selecting"` → `stopSelecting`; no `right`.
  - editing: `title="Edit routine"`; `left` = `BandButton icon="close" label="Stop editing"` (wired in Task 5); no `right`.
  The page measures nothing for the header any more (`headerHeight` goes; Task 3 replaces `insetTop`). `<svelte:head>` keeps its title. The Escape handler also skips while `menuOpen`.
- [ ] **Step 6: Reading, above the slots** (to `overview` / `bachata_overview`; none of it while selecting or editing — the board's selection screens show only the slots): `hero` (`danceable` only) = `<HeroCard title="Practise" meta="Count only or with a song" href={practiseHref}>`. Then, 8 px apart: the routine-level banner — `<Banner kind="error" title={place.message} ondismiss={() => (dismissed = form)}>` when `place?.where === 'banner' && dismissed !== form`; the notes (`<p>` 15/500 `text-ink-2` `leading-[1.45] px-1 whitespace-pre-line`); the facts block (`px-1 pt-0.5 pb-1`, gap 8) when `factsOf(...)` is not null: "Starts from **{from}**" and, with `to`, " · ends at **{to}**" — 14/600 `text-ink-2`, the names 800 `text-ink` — over a wrapping row (gap 6) of `<Badge tone>` per `factBadges(...)`, a `loop` badge leading with `repeat` 14. The old `hint` / `errorBox` classes and "Exercise →" link go.
- [ ] **Step 7: Empty routine** (to `empty`): with no slots, instead of the label and the list, `<EmptyState icon="route" title="No slots yet" body="The first slot is where the routine starts. Add a figure, then build from it.">` whose action is `button('primary')` with `plus` 20 "Add a figure" → `openPicker(0, null)` (no anchor, no chips). No hero, no facts.
- [ ] **Step 8: More** (to the bottom of `bachata_overview`): when there is an exercise or any lesson, `SECTION_LABEL` "More" (14 px above) over a `GROUP` of link rows (min-h 64, `pl-4 pr-3.5`, gap 12, a 24 px leading icon in `text-accent-text`, title 16/700, meta 13 `text-muted`, `chevron-right` 20 `text-chevron`): the exercise — `repeat`, "Exercise" over "History, how often, active" (only what the page already has; spec "Calls made") → `/[dance]/exercises/[id]`; then per `data.taughtIn` — `lessons`, the lesson title over "Taught in · {longDayLabel(lessonDay)}" → `/[dance]/lessons/[id]`. Not shown while selecting or editing.
- [ ] **Step 9: The ⋯ sheet.** `<RoutineMenu open={menuOpen} title={routine.name} canSelect={data.slots.length > 0} onselect={() => { selecting = true; selected = []; expanded = null; swiped = null; }} onclose={() => (menuOpen = false)}>`. Selection entered this way starts empty (the band reads "Select slots"); a tap adds; deselecting the last one still leaves selection mode, as today.
- [ ] **Step 10: The toast** keeps its wiring; pass `bottom="calc(1rem + env(safe-area-inset-bottom))"` (no tab bar here; the Toast default clears one).
- [ ] **Step 11: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 12: Look.** Build the dev data once (dev database only, through the page or SQL): a salsa routine "Shine combo" of six slots as on the board — slot 2 with a note and two alternatives, slot 4 an embedded routine, a hands seam after 3 and a count seam after 5; a salsa routine "Footwork" with no slots; and the existing bachata "Friday combo" made to loop with a note, an exercise and a lesson link. `FULL=1 $SHOTS/page.sh OUTDIR /salsa/routines/<shine> /salsa/routines/<footwork> /bachata/routines/1`; compare with "A routine" (`s-routine-0.png`), "A routine that loops" and "Empty routine" (`s-routine-2.png`), light and dark. Rename Shine combo to "Hammerlock combo con vuelta y salida" (dev db), screenshot at the top and scrolled 400 px: 30 px title in two lines, the slim band ellipsized, pencil and ⋯ on screen (Review Focus 5); rename it back. Tap ⋯: the sheet with "Select slots".
- [ ] **Step 13: Commit** `feat(routine): the routine's band, Practise hero, facts and More in the new look`.

### Task 3: Slot cards, seams and the drag

**Files:**
- Modify: `src/lib/components/routines/SlotCard.svelte`, `SlotList.svelte`, `Seam.svelte`, `Swipeable.svelte`, `types.ts`
- Modify: `src/lib/components/ui/Screen.svelte` (one attribute: `data-slim-band` on the slim band)
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (load: `childSlots`), `src/routes/[dance]/routines/[id]/+page.svelte` (`rows`, `seamOf`, the Slots label)

**Interfaces:**
- Consumes: `slotMeta`, `seamLabel`, `gapTop` (Task 1); `Icon`, `Banner`, `iconButton`.
- Produces:
  - Load adds `childSlots: Record<number, number>` — for each slot that embeds a routine, `shapes.get(childId)?.slots.length ?? 0`, keyed by child id.
  - `RowView.meta` is now `slotMeta(edges, posName, isRoutine ? (data.childSlots[childId] ?? 0) : null)`; `RowView` gains `empty: boolean` (no option and no child: the title is muted).
  - `Swipeable`'s `end` becomes `{ label: string; icon?: IconName; onclick: () => void }` and it gains `reveal?: number` (default 84). The red under the card is `bg-danger`; the button is `text-on-danger` 14/800, with the icon (22) stacked over the label when given.
  - `SlotList` drops the `insetTop` prop: at grab it reads the top inset from `document.querySelector('[data-slim-band]')?.getBoundingClientRect().bottom ?? 0` and the bottom from `window.innerHeight` (no tab bar on a pushed screen; the selection bar never shows during a drag).

- [ ] **Step 1: Run** `timeout 600 nix develop -c npx vitest run` — Expected: PASS (baseline; the logic is Task 1's).
- [ ] **Step 2: The load and the rows.** Add `childSlots`. In the page, `rows[].meta` from `slotMeta`, `empty` when neither an option nor a child; `seamOf` builds its label with `seamLabel(p && a.end !== null ? { end: posName(a.end), next: b.starts.map(posName) } : null, t ? { ready: a.next, next: b.startCounts } : null)`; `failure` from `place?.where === 'slot' && place.stepId === slot.id`. Above the list, `SECTION_LABEL` "Slots · {n}" (6 px above).
- [ ] **Step 3: The card** (to `slot()` in `routine.py`). Card `rounded-2xl bg-surface`, padding `8px 6px 8px 2px`; expanded: `shadow-[inset_0_0_0_2px_var(--color-accent)]`; lifted: `bg-raised` with the kit shadow (`0 18px 40px rgb(0 0 0/0.22)`) and `scale(1.03) rotate(-0.8deg)` (no rotate/scale under reduced motion). Head row min-h 48, gap 6: the handle — 44 px, `drag` 20 `text-muted`, `cursor-grab touch-none`, same events, `aria-label` and `data-handle`, pressed `bg-step` radius 12; the number — 26 px disc `bg-accent-soft text-accent-text` 12/800 tabular; the body (same role/aria/events) — title 16/700 `leading-[1.3]` (`text-muted` when `empty`; a routine leads with `route` 18 `text-accent-text`, 6 px gap), meta 13 `text-muted` `mt-0.5`; collapsed: note 13 italic `text-ink-2` `mt-[3px]`, alternatives as "**or** Doble, Complicada" 13 `text-muted` (the "or" 700) — all one line, truncated; expanded with an href: "Open" 15/800 `text-accent-text` + `chevron-right` 18, 44 px tall, `pl-2.5 pr-1.5`. The swipe's Delete: `reveal={100}`, `icon: 'trash'`, label "Delete".
- [ ] **Step 4: The open card's note** (to the expanded note): a row `pl-[78px] pr-3.5 pt-0.5 pb-1.5`; a 40 px line with `edit` 16 (`text-muted`, `text-accent-text` on focus-within) and the input (15/500 `text-ink`, transparent, no outline, placeholder "Add a note…", `maxlength="200"`, `aria-label="Note for slot {n}"`), `border-b-[1.5px] border-dashed border-field-line`, `focus-within:border-b-2 focus-within:border-solid focus-within:border-accent`. All of its handlers, `track` registration and `resettingFocus` check stay.
- [ ] **Step 5: The alternatives rail** (to `alt_row`): `role="group" aria-label="Alternatives for slot {n}"`, `ml-7 pl-3 border-l-2 border-accent/25`, rows 8 px apart, 6 px gap in a row: the tile (in its `Swipeable`, `reveal={88}`, label "Remove", radius 12) 44 px `bg-accent-soft` radius 12 `px-3.5` 15/700 `text-ink` truncated; Open — a 44 px radius-12 `bg-accent-soft` link with `external` 18 `text-accent-text`; Remove — a 44 px radius-12 `bg-danger-soft` button with `trash` 18 `text-danger`; labels as now. "+ Alternative" — 44 px radius 12, `border-[1.5px] border-dashed border-accent/50`, `plus` 18 + "Alternative" 15/800 `text-accent-text`. The slot's refusal is `<Banner kind="error" title={row.failure}>` 8 px under it.
- [ ] **Step 6: The seam** (to `seam()`): `role="group" aria-label="Slots {above} and {below} do not connect"`, `bg-warn-soft` radius 14, `border-l-[3px] border-warn`, padding `10px 10px 4px 12px`; the label with `warning` 16 — 13/700 `text-warn` `leading-[1.35]`; then a wrapping row (gap 6) of 44 px buttons each drawing a 36 px pill (radius 18, `pl-2.5 pr-3.5`, gap 6, 14/800): `arrow-down` 18 "After {above}" and `arrow-up` 18 "Before {below}" on `bg-surface text-accent-text`; Bridge (only with `onbetween`) `plus` 18 "Bridge" on `bg-accent text-on-accent`. `aria-label`s as now. Seams sit 8 px under their card.
- [ ] **Step 7: The ends** (to `add_top` / `add_end`): above slot 1, a centred 44 px button holding a 36 px circle `border-[1.5px] border-dashed border-accent/50` with `plus` 18 `text-accent-text` (`aria-label="Add before slot 1"`); disabled while selecting: `border-field-line`, `text-disabled-ink`. Below the last, a full-width 52 px radius-16 dashed button (`border-accent/50`), `plus` 20 + "Add a slot" 15/800 `text-accent-text`, `aria-label="Add after slot {n}"`, disabled the same way while selecting. The list's gap is 8 px (`GAP` stays 8).
- [ ] **Step 8: The drag's gap.** At grab, `SlotList` also records each live item's list-relative top and height; while dragging it draws one `aria-hidden` box in the `<ul>` (`relative`): `absolute inset-x-0`, `top: gapTop(tops, heights, from, to)px`, `height: heights[from]px`, `rounded-2xl border-2 border-dashed border-accent/45 bg-accent/5`, `pointer-events-none`, under the lifted card. Replace the `nav[aria-label="Main"]` lookup with the slim band / `innerHeight` reads above; update that comment. `Screen` gets `data-slim-band` on its fixed slim band (no other change).
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look.** Write `$SHOTS/routine-states.py` from `figure-states.py` (light and dark, 390 × 844, `state.json` cookies) for Shine combo: the top; slot 2 tapped open with the note focused; a mouse drag of slot 5's handle held mid-way over slot 2 (`page.mouse.down/move`, screenshot before `up`), then Escape (order unchanged); slot 4's body swiped left 120 px (Delete shown); Delete tapped (the toast "Slot 4 deleted · Undo", the seam moved), then Undo (slot back); on the open slot 2, Doble swiped left (Remove). Compare with "A slot tapped open" (`s-routine-0.png`), "Dragging a slot", "Swipe to delete", "Deleted · Undo", "Alternative swiped" (`s-routine-1.png`). `FULL=1` once: the "Add a slot" button clears the bottom edge. Keyboard: focus slot 3's handle, ArrowUp — it moves and keeps focus.
- [ ] **Step 11: Commit** `feat(routine): slot cards, alternatives, warn seams and the drag gap in the new look`.

### Task 4: Selecting, the bar on the bottom edge, Make routine

**Files:**
- Modify: `src/lib/components/routines/SelectionBar.svelte`, `SlotCard.svelte` (select mode)
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte` (selection wiring, the Make routine sheet)
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (`extract` refusals)
- Create: `src/routes/[dance]/routine-forms.spec.ts`

**Interfaces:**
- Consumes: `actionBlocks` (`selection.ts`), `selectionTitle`, `makeRoutineCaption`, `failurePlace` (Task 1); `Sheet` (`footer`), `FieldError`, `Banner`, `Spinner`, `FIELD`, `LABEL`, `button`.
- Produces:
  - `extract` refusals: no name → `fail(400, { action: 'extract', field: 'name', message: 'Give the new routine a name (up to 200 characters).', name })`; the run refused → `fail(400, { action: 'extract', message: <unchanged text> })`.
  - `SelectionBar` props: `count: number`, `blocks: Record<SelectionAction, string | null>` (replaces `extractBlocked`), the five callbacks unchanged.

- [ ] **Step 1: Write the failing tests** in `routine-forms.spec.ts`, set up like `moves-forms.spec.ts` (`vi.mock('$lib/server/db')`, `openDb(':memory:')` per test, `post(dance, fields, id)`): a salsa routine with two figure slots;

```ts
it('puts a nameless Make routine under its Name', async () => {
  expect(await call(routinePage.actions.extract, post('salsa', { stepIds: String(a), name: ' ' }, String(r))))
    .toMatchObject({ status: 400, data: { action: 'extract', field: 'name', message: 'Give the new routine a name (up to 200 characters).' } });
  expect(routineSlots(db, r)).toHaveLength(2);
});
it('refuses a run that cannot become a routine as the sheet’s banner', async () => {
  addChildSlot(db, otherRoutine, r); // r is now embedded, so it cannot embed a new routine
  expect(await call(routinePage.actions.extract, post('salsa', { stepIds: String(a), name: 'Opener' }, String(r))))
    .toMatchObject({ status: 400, data: { action: 'extract' } });
  // …and `data` has no `field`
});
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run 'src/routes/[dance]/routine-forms.spec.ts'` — Expected: FAIL.
- [ ] **Step 3: Implement** the two refusals.
- [ ] **Step 4: Run** the same command and `'src/routes/[dance]/dance-wall.spec.ts'` — Expected: PASS.
- [ ] **Step 5: Cards in select mode** (to `select_mark` and the `selected` state): the handle's place holds a 44 px box with, selected, the filled `check-circle` 24 in `text-accent` (`--icon-knockout: var(--color-on-accent)`), else a 24 px circle `border-2 border-muted`; a selected card is `bg-accent-soft`, its number disc `bg-accent text-on-accent`, and its meta, note and "or …" lines `text-ink-2` (Review Focus 1). The body keeps `aria-pressed`. Seams, the alternatives rail and swipes stay off while selecting, as now; the facts, notes, hero and More are hidden (Task 2).
- [ ] **Step 6: The bar** (to `selection_bar`; carried from the foundation: it sat at the old 4.5 rem tab offset): `role="toolbar" aria-label="Selected slots"`, fixed at `bottom: 0`, full width, content in the 560 px column, `z-30`, `bg-tab-bg`, top border `tab-line`, `shadow-[0_-8px_24px_rgb(0_0_0/0.08)]`, padding `8px 8px calc(8px + env(safe-area-inset-bottom))`. Five equal columns (gap 2): buttons min-h 60, radius 14, an icon 24 over the label 12/700 `leading-[1.2]`, centred, gap 5 — Add above (`add-above`), Add below (`add-below`), Duplicate (`copy`), Make routine (`route`), Delete (`trash`, `text-danger`); others `text-ink`; blocked ones `aria-disabled="true"` in `text-disabled-ink` and still tappable: a tap shows the reason above the row — `role="status"` `mx-1 mb-1.5 rounded-xl bg-warn-soft px-3 py-2.5` 13/600 `text-ink` `leading-[1.4]` with `info` 16 `text-warn` — cleared when `count` or `blocks` change (as now). The page passes `blocks={actionBlocks(selected.length, extractBlock(rows, selected, data.embeddedIn))}` and its content's bottom padding is `pb-36` while selecting.
- [ ] **Step 7: The Make routine sheet** (to `make_routine`): `<Sheet title="Make a routine" footer>`; the form (`id="make-routine"`, `action="?/extract"`, `use:guarded` with label "New routine name" and the same `extracted` callback, plus a `making` busy flag): with `place?.where === 'extract' && place.field === null`, `<Banner kind="error" title={place.message}>` first; `LABEL` "Name" over `FIELD` (`name="name"`, `required`, `maxlength="200"`, placeholder "Shine opener", autofocus with the `svelte-ignore` comment), `aria-invalid` + `aria-describedby` and `<FieldError id="make-name-error">` when `place.field === 'name'`; then `makeRoutineCaption(n)` 14 `text-muted` `leading-[1.45]`; then the selected slots in routine order, 6 px apart: a 26 px number disc (`bg-accent-soft text-accent-text` 12/800) and the title 14/600 `text-ink-2`. The hidden `stepIds` inputs stay. `footer`: `<button type="submit" form="make-routine" class={button('primary','md',true)}>` with `route` 20 "Make routine" (`aria-busy` + `<Spinner>` while posting, width kept). The page banner no longer repeats an extract refusal (Task 1's `failurePlace` sends it here).
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Look** with `routine-states.py`: long-press slot 1 (600 ms), tap 2 and 3 — "3 selected", the bar on the bottom edge; tap Add above (the reason strip); tap Make routine (the sheet), submit an empty name (error under Name, the sheet stays); `FULL=1` while selecting (the last slot clears the bar). Bachata Friday combo with an embedded slot selected: Make routine greyed, its tap shows "Slot n is a routine — embedding is one level." Enter from ⋯ → Select slots (Review Focus 3): "Select slots", all five greyed, Delete's tap says "Select slots first.". Compare with "Selecting", "Make a routine" (`s-routine-1.png`) and "Make routine refused" (`s-routine-2.png`), light and dark — the selected cards' meta reads in `ink-2`.
- [ ] **Step 10: Commit** `feat(routine): selection with its bar on the bottom edge, and Make routine in the new look`.

### Task 5: Edit routine and Archive

**Files:**
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte` (edit mode)
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts` (`rename` refusals)
- Modify: `src/routes/[dance]/routine-forms.spec.ts`

**Interfaces:**
- Consumes: `failurePlace` (Task 1); `BottomBar`, `Dialog`, `FieldError`, `Spinner`, `FIELD`, `TEXTAREA`, `LABEL`, `GROUP`, `SECTION_LABEL`, `button`, `leaveOrAsk`, `guarded`.
- Produces: `rename` refusals — no name → `fail(400, { action: 'rename', field: 'name', message: 'Give the routine a name (up to 200 characters).', name, notes })`; notes over 2000 → `fail(400, { action: 'rename', field: 'notes', message: 'Notes are up to 2000 characters.', name, notes })` (name checked first).

- [ ] **Step 1: Write the failing tests** in `routine-forms.spec.ts`: rename with `name: ' '`, `notes: 'Fridays'` → `{ status: 400, data: { action: 'rename', field: 'name', message: 'Give the routine a name (up to 200 characters).', notes: 'Fridays' } }` and the name unchanged; rename with `notes: 'x'.repeat(2001)` → `field: 'notes'`, `'Notes are up to 2000 characters.'`; a good rename → `{ ok: true }` and the new name stored.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run 'src/routes/[dance]/routine-forms.spec.ts'` — Expected: FAIL.
- [ ] **Step 3: Implement** the refusals (split today's single check; `optionalText(form, 'notes')` returning `undefined` is the too-long case).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Edit mode** (to `edit`), replacing the reading content while `editing` (no hero, facts, slots or More), `pt-1`, 14 px apart, `pb-28`: the form (`id="edit-form"`, `action="?/rename"`, `bind:this={editForm}`, `use:guarded` label "Routine edits", same callback plus a `saving` flag): `LABEL` "Name" over `FIELD` (`name="name"`, `required`, `maxlength="200"`, the current name) with the helper "Up to 200 characters" (13 `text-muted`, `mt-1.5 pl-1`) — replaced by `<FieldError id="edit-name-error">` (plus `aria-invalid`/`aria-describedby`) when `place?.where === 'edit' && place.field === 'name'`; `LABEL` "Notes" + " (optional)" (500 `text-muted`) over `TEXTAREA` rows 4, `maxlength="2000"`, with the notes `FieldError` the same way. Then `SECTION_LABEL` "More" (18 px above) over a `GROUP` of two row buttons (min-h 64, `pl-4 pr-3.5`, gap 12): "Duplicate routine" over "Makes a copy and opens it", leading `copy` 22 `text-accent-text`, trailing `chevron-right` 20 `text-chevron`, a submit button in the existing plain `?/duplicate` form; "Archive routine" (16/700 `text-danger`) over "Its slots and practice history are kept", leading `trash` 22 `text-danger`, `aria-haspopup="dialog"` → `archiving = true`.
- [ ] **Step 6: The band's ×** → `leaveOrAsk(editForm ?? null, () => (editing = false), 'Stop editing')`.
- [ ] **Step 7: Save pinned.** `<BottomBar>` while editing: `<button type="submit" form="edit-form" class={button('primary','md',true)}>Save</button>` (`aria-busy` + `<Spinner>` while saving, width kept). A refused save keeps you editing with the error under its field.
- [ ] **Step 8: Archive** (to `archive`): `<Dialog open={archiving} icon="trash" tone="danger" title="Archive “{routine.name}”?" body="It leaves the Routines list. Its slots and practice history are kept." onclose={() => (archiving = false)}>`; actions: `button('tertiary','sm')` "Cancel", and in a `use:enhance` form to `?/archive` a `button('danger','sm')` "Archive" (Spinner while posting; the action's redirect to Routines is followed). The `confirm()` goes.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look** with `routine-states.py`: the pencil (edit mode: "Edit routine", × only, Save pinned); clear Name and Save (error under Name, still editing); type in Notes and press × (Unsaved changes: Save · Stay · Stop editing); Archive routine (the dialog; Cancel). Compare with "Edit routine" and "Archive?" (`s-routine-2.png`), light and dark. The board's ✓ on the band and in-form Save are this plan's single pinned Save (see Calls).
- [ ] **Step 11: Commit** `feat(routine): Edit routine with one pinned Save, and Archive in a dialog`.

### Task 6: The picker's routine parts, refusals, and the docs

**Files:**
- Modify: `src/lib/components/routines/SlotPicker.svelte` (its `top` and `empty` snippets only)
- Modify: `docs/superpowers/specs/2026-10-01-routine-editor-design.md`, `docs/superpowers/specs/2026-10-31-redesign-design.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `CHIP`, `Icon`, `anchorText` (unchanged), the shared `Picker`'s `top` / `empty` snippets (unchanged; plan 8 owns the sheet).

- [ ] **Step 1: The context line and the chips** (to `picker()` in `routine.py`): the context line — `flag` 15 `text-accent-text` + the text 13/600 `text-ink-2`, gap 6, `mt-2`. The chips — a `role="group" aria-label="Filters"` row (gap 8, `mt-2`) of `<label class={CHIP}>` each holding an `sr-only` checkbox bound to `count` / `hold` and, while checked, `check` 16 before "Count" / "Hold" (CHIP's `has-checked` draws the solid accent). Shown only when `list.toggles` says so (alternative mode has none), as now.
- [ ] **Step 2: The empty box's rescue** (to `picker_empty`): "Turn off Hold" / "Turn off Count" as a text button 800 `text-accent-text`, `underline underline-offset-[3px]`, `min-h-6`, inside the existing sentence ("Nothing you know starts on 5 from Shadow. Turn off Hold to see the rest.").
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look** with `routine-states.py`: Shine combo's seam "After 3" (title "Add after slot 3", "Starts on 1 from Hammerlock", both chips on); the seam's Bridge; slot 2's "+ Alternative" (no chips); a bachata routine's end "Add a slot" with Hold on and nothing fitting (the rescue), then tap Turn off Hold (the list fills). Pick one row: the new slot flashes, opens expanded, the seam it closed is gone. Refusals, each by submitting a plain `<form method="POST">` built with `page.evaluate` (a non-enhanced post renders the page with its `form`): `?/addOption` with slot 2's `stepId` and a figure that does not fit (the error under slot 2), and `?/restore` with `snapshot=x` ("Those slots could not be put back." in the page banner; Dismiss hides it). Compare with the four picker screens (`s-routine-0.png`) and "Refused, archived, empty" (`s-routine-2.png`), light and dark — only the context line, chips and rescue are this plan's; the sheet, search and rows are plan 8's.
- [ ] **Step 5: Docs.** Routine editor spec: "Seams" — the red line becomes a warn box with "↓ After n", "↑ Before n" and "+ Bridge" (the Bridge only when something fits both sides, as now); "Long-press: select" — selection can also start from "Select slots" in the band's ⋯ sheet, with nothing selected ("Select slots" on the band, every action greyed with its reason); the ends — the bottom + is an "Add a slot" button; "What goes away" — the header's Edit is the band's pencil, Edit routine is the page's edit mode with × and one pinned Save, Archive asks in a dialog. Redesign spec, "A routine": one line — "The band is 46 px for short names and 30 px past 18 characters or a word over 10; ⋯ opens a sheet with Select slots; edit has × and one pinned Save (no ✓)". `CLAUDE.md` Layout, `src/lib/routines/` entry: add "the routine page's wording and where a refusal shows (page.ts)".
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(routine): the picker's context line, chips and rescue in the new look; docs`.

---

## Calls made in this plan

- **Band size by name length**, not always compact: the board draws "Shine combo" and "Opener" at 46 px, the controller's scope and the spec's pattern say compact for long names, so `bandCompact` takes 30 px past 18 characters or a word over 10. Cost if wrong: one function's threshold.
- **⋯ opens a bottom sheet with one row, "Select slots"**, not a popover menu: the kit has no menu component and a Sheet brings Back, Escape and the scrim for free. Pencil stays the way into Edit; nothing else joined the sheet (Duplicate stays in Edit, as drawn). ⋯ hides on an empty routine. Cost: one more tap than a popover; swapping for a popover is local to `RoutineMenu`.
- **Selection from ⋯ starts empty** and titles itself "Select slots"; Duplicate and Delete grey out at zero ("Select slots first.") so nothing posts an empty list. Deselecting the last slot still leaves selection, as today.
- **Edit routine follows the pattern, not the board:** × "Stop editing" and one Save pinned in `BottomBar`; the board's ✓ on the band and in-form Save would be "a header Done plus a form Save", which the spec's pattern rules out and the exercise page (plan 3) and figure page (plan 5) already dropped. Edit mode shows only the form and More (Duplicate, Archive), as the board draws it.
- **Breaks and timing breaks are danger badges** (controller's scope and the spec's status pattern), not warn as the board's overview draws them; "Doesn't loop" warn, "Loops" done, both with the `repeat` icon. An empty routine gets no badge.
- **Facts read "Starts from Open or Closed · ends at Closed"** — several starts joined with "or", matching the seam and picker wording.
- **A selected card's secondary text is `ink-2`**, not the board's muted (muted on `accent-soft` is 4.13–4.54:1).
- **The Exercise row reads "Exercise" over "History, how often, active"** (spec's call: only what the page has; the board's "Every 3 days · done yesterday" needs data the page does not load). Taught in rows read the lesson title over "Taught in · Wednesday, 28 October" (the board's "2 videos" needs a count the load lacks).
- **An embedded routine's meta says "Routine · 3 slots · …"** as drawn; the load gains `childSlots` (counted from the shapes it already builds) — the one load addition.
- **`rename` and `extract` refusals carry `action` and `field`** so `failurePlace` can put them under their field (Moves' pattern); a non-field Make routine refusal is a banner inside its sheet, never also on the page.
- **The routine-level banner gets a Dismiss ×** (`Banner.ondismiss`, a shared optional prop) as the board draws; it comes back with the next refusal.
- **The drag draws a dashed gap** where the card will land (board), placed by the pure `gapTop`; the auto-scroll's top edge is the slim band's bottom, read at grab (`data-slim-band` on `Screen`), since the sticky header it measured is gone.
- **The swipe's Delete is 100 px with a trash icon** and the alternative's Remove 88 px, text only (board); `Swipeable` gains `reveal` and `end.icon` for it.
- **The toast has no leading trash icon** (the shared `Toast` has none; the board's is decoration) and sits 1 rem above the safe area.
- **The picker's context line stays under the search** in `SlotPicker`'s `top` snippet; the board puts it under the title, which is the shared Picker's header (plan 8 may lift it there). Count/Hold are `CHIP` checkboxes, so no new chip builder.
- **Hero meta is "Count only or with a song"** (board), and the hero hides while selecting or editing; there is no Practise hero on a routine that cannot be danced (spec).
- **Notes stay plain text** (`whitespace-pre-line`), not linkified — no behaviour change.
- **Loading is a routine-shaped skeleton** (`{ kind: 'routine' }`), replacing the generic detail skeleton for this route.
