# Redesign: the picker and the Link popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the one picker behind every list (link, field and act pickers,
`PickerField`), every opener, the Link popup's levels and its create steps,
and the song popup in the new look — light on site pages, the media palette
inside the full-screen player — losing nothing they do today.

**Architecture:** The picker's rules that decide what shows (a row's trailing
control, the create row's lead, the empty text, which body state, sheet height,
the card a line sits in) move into a pure `src/lib/picker/view.ts`; the Link
popup's headings, which levels show Back, and where a refusal lands join the
pure `src/lib/video/link-steps.ts`. On site pages every level is the
foundation's `Sheet`; inside the player every level is a new `PlayerLayer` (the
Sheet's and Dialog's look as an overlay in the player's `<dialog>`), wrapped in
a `.theme-media` scope that re-declares the colour tokens with the kit's media
palette, so one set of token classes draws both. One server change: a create
refusal names its field.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node), Playwright screenshots via the scratchpad tool.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "The picker
and the Link popup" (binding), "Patterns used across screens", "Calls made
while writing this" (the picker stays a bottom sheet, centred with a max width
on desktop). Behaviour: `docs/superpowers/specs/2026-10-30-unified-pickers-design.md`
and `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`. Board
source: `docs/superpowers/design-kit/screens/pickers.py` (and `music.py`'s
`picker_sheet` / `song_field` for the song popup); previews
`$S/previews/s-pickers-0.png` … `s-pickers-7.png` and `s-music-popup-crop.png`,
where `S=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.

**This is plan 8 of 13.** All plans land on branch `app-icons`, deployed once
when the last plan is done. It builds on the foundation (plan 1) and on what
Today, Logging, Moves, Music and Figure built; Lessons (plan 7) and Routine
(plan 6) may still be landing — where a step names their markup it says what
to look for in either state. Out of scope: `SlotPicker`'s own `top` / `empty`
snippets (plan 6), the Practice page's layout (plan 10 — only `SongPicker` is
here), the full-screen player's own screens and `--pl-*` palette (plan 11).

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

- Every behaviour of the unified-pickers and Link popup specs survives: a tap finishes and closes everything back to the page; + links at once and keeps the picker open, Done only closes; linked rows stay greyed and untappable; groups are fixed while the picker is open; the field picker's current value carries the check and stays tappable; search is accent- and case-insensitive, focused on open only under `(pointer: fine)`, has no `name`, and Enter in it never submits a surrounding form; every picker button is `type="button"`; the typed text is carried into a create step; a refusal keeps the picker open; × / Escape / backdrop go back one level; `prefiltered`, `bind:query`, `top` and `empty` keep working for `SlotPicker`; ▶ previews a section looping; the player's four history levels (`link`, `link-pick`, `link-new`, `link-figure`) and the popup's controlled `steps` are unchanged; the song popup's one-sample rules (`sample-player.svelte.ts` unchanged).
- A level opened from the page has × only; a level stacked on another (the picker over the links level, a create step, a field's picker) has Back on the left and no × (spec, "The picker and the Link popup").
- Small accent text is `text-accent-text`; bare `text-accent` only on icons. Never append a colour class after `iconButton(…)` / `button(…)` — their `text-ink` (or kind colour) wins by CSS order: use `iconButton('bare').replace('text-ink', 'text-accent')` or write the classes out.
- On a row tinted `bg-accent-soft` (a field's current value, the picked song) the second line is `text-ink-2`, never `text-muted` (muted on accent-soft is 4.13–4.54:1).
- Inside the player every layer carries `.theme-media`; the files this plan touches (`Picker`, `PickerField`, `LinkLevel`, `LinkPopup`, `SongPicker`) use no `--pl-*` and no per-theme class maps — token classes only.
- The tap and + of a linking picker stay one-tap (`use:enhance` forms or fetch); the Link popup's create steps stay fetch forms without `use:guarded` (section-link spec, "Left to the builder"); hosts of `PickerField` keep their `use:guarded`.

**Screenshots.** `$S/tools/page.sh OUTDIR /salsa/... /bachata/...` (`FULL=1` for full page). Taps: copy `$S/tools/sheet.py` to `$S/tools/pickers-states.py`, change the clicks, run it the way `page.sh` runs `page.py`. `$S/tools/lessons-states.py` and `figure-states.py` show how earlier plans reached a lesson with videos and sections and a figure page. The dev server on http://localhost:20000 serves this worktree; never start another. Give one salsa figure the name "Dile que no con vuelta" with a variation "Doble con mano" so long rows show.

## Review Focus

1. **A + that is refused or fails in flight:** the row's spinner gives way to + again (nothing turns "Linked"), a "That could not be linked." banner with the reason sits above the list, and the picker stays open — pinned by `rowTrail` tests (Task 1) and the refused-link screenshot (Task 5).
2. **Typed text with accents carried into a create step:** "Montaña" reads 'Not in the list? Create “Montaña” as' and lands in New figure's Figure name — pinned by `createLead` tests (Task 1) and the create screenshots (Task 6).
3. **A field picker inside a form never submits or clears it:** Enter in the picker's search, a pick, Back — the Move to… sheet stays open with its typed name — pinned by the scripted check in Task 3.
4. **The Link popup in the player:** Back/Escape go create step → picker → links → player; the create step's Figure picker opens over the whole player, never trapped inside the step's panel — pinned by `stacked` tests (Task 1) and the player check in Task 6.
5. **Tinted rows stay readable:** a field's current value and the picked song keep their second line at ≥ 4.5:1 in four themes and the media palette — pinned by the contrast pairs in Tasks 1 and 2.

---

### Task 1: The pure rules

**Files:**
- Create: `src/lib/picker/view.ts`, `src/lib/picker/view.spec.ts`
- Modify: `src/lib/video/link-steps.ts`, `src/lib/video/link-steps.spec.ts`
- Modify: `src/lib/songs/search.ts`, `src/lib/songs/search.spec.ts`
- Modify: `src/lib/theme/tokens.spec.ts` (two pairs)

**Interfaces:**
- Consumes: `shown`, `PickGroup`, `PickRow`, `PickLine` (`$lib/picker/model`); `spotTime`, `lengthText` (`$lib/video/spots`); `LinkOptions` (`$lib/types`).
- Produces, in `view.ts`:
  - `type PickKind = 'link' | 'field' | 'act'`
  - `type Trail = 'add' | 'pending' | 'linked' | 'chosen' | 'none'`
  - `rowTrail(kind: PickKind, row: PickRow, chosen: string | null, pending: ReadonlySet<string>): Trail` — link: `linked` wins, then `pending.has(row.key)`, else `add`; field: `chosen` when `row.key === chosen`, else `none`; act: `none`.
  - `createLead(typed: string): string` — `'Not in the list?'` or `'Not in the list? Create “' + typed + '” as'` (typed already trimmed by the caller).
  - `doneLabel(n: number): string` — `` `Done · ${n} linked` ``.
  - `emptyText(typed: string, nothingLeft: string): string` — `` `Nothing matches “${typed}”.` `` when typed, else `nothingLeft`.
  - `type PickerBody = 'loading' | 'failed' | 'list' | 'empty'`; `pickerBody(s: { loading: boolean; failed: boolean; lines: number }): PickerBody` — loading first, then failed, then list when `lines > 0`.
  - `pickerTall(s: { loading: boolean; failed: boolean; groups: PickGroup[] }): boolean` — true while loading, false when failed, else true iff some group has entries (the unfiltered groups, so typing never resizes the sheet).
  - `interface LineGroup { title: string; lines: { line: Exclude<PickLine, { kind: 'group' }>; last: boolean }[] }`; `lineGroups(lines: PickLine[]): LineGroup[]` — splits `shown()`'s flat lines at each group line; `last` marks the final line of each group (its row draws no hairline).
- Produces, in `link-steps.ts`:
  - `stacked(steps: LinkStep[], step: LinkStep): boolean` — `steps.indexOf(step) > 0`.
  - `linkHeading(spot: { startMs: number; endMs: number; label: string | null }): { range: string; sub: string }` — range `"0:42–0:55"` (en dash, `spotTime`), sub = label and `lengthText(length)` joined `' · '`.
  - `destination(o: Pick<LinkOptions, 'spot' | 'context'>): string` — `"Linked to 0:42–0:55 and to Tuesday class"` for a lesson, `"Linked to 0:42–0:55"` for a recording.
  - `type CreateStep = 'variation' | 'figure' | 'drill'`; `type CreateSpot = 'name' | 'figureName' | 'groupId' | 'style' | 'everyDays' | 'banner'`; `refusalAt(step: CreateStep, field: string | undefined): CreateSpot` — the fields each step shows: variation `groupId`, `name`; figure `figureName`, `name`, `style`; drill `name`, `everyDays`; anything else (or none) is `banner`.
- Produces, in `search.ts`: `pickerCount(n: number, searching: boolean): string` — `"1 song"`, `"8 songs"`, `"1 match"`, `"0 matches"`.

- [ ] **Step 1: Write the failing tests.**

```ts
// view.spec.ts
const row = (key: string, extra: Partial<PickRow> = {}): PickRow => ({ key, value: 1, label: key, ...extra });
it('says what a row ends in', () => {
  const none = new Set<string>();
  expect(rowTrail('link', row('figure:1'), null, none)).toBe('add');
  expect(rowTrail('link', row('figure:1'), null, new Set(['figure:1']))).toBe('pending');
  expect(rowTrail('link', row('figure:1', { linked: true }), null, new Set(['figure:1']))).toBe('linked');
  expect(rowTrail('link', row('figure:1', { linked: false }), null, none)).toBe('add'); // a refused + is a + again
  expect(rowTrail('field', row('group:4'), 'group:4', none)).toBe('chosen');
  expect(rowTrail('field', row('group:5'), 'group:4', none)).toBe('none');
  expect(rowTrail('act', row('exercise:3'), null, new Set(['exercise:3']))).toBe('none');
});
it('leads the create row with the typed text', () => {
  expect(createLead('')).toBe('Not in the list?');
  expect(createLead('dob')).toBe('Not in the list? Create “dob” as');
  expect(createLead('Montaña')).toBe('Not in the list? Create “Montaña” as');
});
it('counts what + linked', () => expect(doneLabel(2)).toBe('Done · 2 linked'));
it('says nothing matches, or the picker’s own sentence', () => {
  expect(emptyText('Montaña', 'There are no figures yet.')).toBe('Nothing matches “Montaña”.');
  expect(emptyText('', 'There are no figures yet.')).toBe('There are no figures yet.');
});
it('picks the body', () => {
  expect(pickerBody({ loading: true, failed: false, lines: 0 })).toBe('loading');
  expect(pickerBody({ loading: false, failed: true, lines: 4 })).toBe('failed');
  expect(pickerBody({ loading: false, failed: false, lines: 4 })).toBe('list');
  expect(pickerBody({ loading: false, failed: false, lines: 0 })).toBe('empty');
});
it('is tall when it opens on rows, short on nothing', () => {
  const g = [{ title: 'Figures', entries: [row('figure:1')] }];
  expect(pickerTall({ loading: true, failed: false, groups: [] })).toBe(true);
  expect(pickerTall({ loading: false, failed: false, groups: g })).toBe(true);
  expect(pickerTall({ loading: false, failed: false, groups: [] })).toBe(false);
  expect(pickerTall({ loading: false, failed: true, groups: g })).toBe(false);
});
it('puts each group’s lines in its own card, the last one without a hairline', () => {
  const h = (heading: string, ids: number[]): PickHeading => ({
    heading, collapse: true,
    rows: ids.map((id, i) => row(`figure:${id}`, { value: id, label: `${heading} · ${['Basic', 'Doble'][i]}`, short: ['Basic', 'Doble'][i] }))
  });
  const groups = [{ title: 'Figures', entries: [h('Enchufla', [1, 2]), h('Sombrero', [3, 4])] }];
  const out = lineGroups(shown(groups, 'dob'));
  expect(out.map((g) => g.title)).toEqual(['Figures']);
  expect(out[0].lines.map((l) => (l.line.kind === 'heading' ? l.line.text : l.line.text)))
    .toEqual(['Enchufla', 'Doble', 'Sombrero', 'Doble']);
  expect(out[0].lines.map((l) => l.last)).toEqual([false, false, false, true]);
});
```

```ts
// link-steps.spec.ts
it('knows which levels are stacked', () => {
  expect(stacked(['pick'], 'pick')).toBe(false);
  expect(stacked(['links'], 'links')).toBe(false);
  expect(stacked(['links', 'pick'], 'pick')).toBe(true);
  expect(stacked(['pick', 'variation'], 'variation')).toBe(true);
  expect(stacked(['pick', 'variation', 'variation-figure'], 'variation-figure')).toBe(true);
});
it('heads the popup with the range, the name and the length', () => {
  expect(linkHeading({ startMs: 42000, endMs: 55000, label: 'Doble entry' }))
    .toEqual({ range: '0:42–0:55', sub: 'Doble entry · 13.0 s' });
  expect(linkHeading({ startMs: 42000, endMs: 55000, label: null }).sub).toBe('13.0 s');
});
it('says where a created thing is linked', () => {
  const spot = { id: 1, startMs: 42000, endMs: 55000, label: null };
  expect(destination({ spot, context: { kind: 'lesson', lessonId: 2, title: 'Tuesday class' } }))
    .toBe('Linked to 0:42–0:55 and to Tuesday class');
  expect(destination({ spot, context: { kind: 'recording', groupId: 3, figure: 'Enchufla' } }))
    .toBe('Linked to 0:42–0:55');
});
it('puts a refusal under the field it names, if the step shows it', () => {
  expect(refusalAt('variation', 'name')).toBe('name');
  expect(refusalAt('variation', 'groupId')).toBe('groupId');
  expect(refusalAt('figure', 'figureName')).toBe('figureName');
  expect(refusalAt('figure', 'style')).toBe('style');
  expect(refusalAt('drill', 'everyDays')).toBe('everyDays');
  expect(refusalAt('drill', 'figureName')).toBe('banner');
  expect(refusalAt('figure', undefined)).toBe('banner');
});
```

```ts
// search.spec.ts
it('counts songs and matches', () => {
  expect(pickerCount(1, false)).toBe('1 song');
  expect(pickerCount(8, false)).toBe('8 songs');
  expect(pickerCount(1, true)).toBe('1 match');
  expect(pickerCount(0, true)).toBe('0 matches');
});
```

In `tokens.spec.ts`, add to `pairs`: `['ink-2', 'accent-soft']` (a tinted row's second line) and `['accent-text', 'accent-soft']` (the song popup's marked match). Both pass today (lowest 7.57 and 4.86); `muted` on `accent-soft` does not, which is why the constraint above exists.

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/picker src/lib/video/link-steps.spec.ts src/lib/songs/search.spec.ts src/lib/theme` — Expected: FAIL (missing exports); the two token pairs already PASS.
- [ ] **Step 3: Implement** the functions above. `SongPicker`'s inline `countText` and `LinkPopup`'s inline `range` / `destination` are replaced by these in Tasks 5–7, not here.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(pickers): the picker's and the Link popup's rules as pure functions`.

### Task 2: The media palette and the player's layer

**Files:**
- Modify: `src/lib/theme/tokens.ts`, `src/lib/theme/tokens.spec.ts`
- Modify: `src/routes/layout.css`, `src/lib/theme/stylesheet.spec.ts`
- Create: `src/lib/components/ui/PlayerLayer.svelte`

**Interfaces:**
- Consumes: `THEMES`, `TOKEN_NAMES`, `mix`, `contrast`; `Icon`; the classes of `Sheet.svelte`'s header and `Dialog.svelte`'s body.
- Produces:
  - `MEDIA: Record<DanceSlug, Theme>` — `THEMES[d].dark` with `ground: '#000000'`, `raised: '#1c1c1f'`, `ink: '#ffffff'`, `'ink-2': mix('#ffffff', '#1c1c1f', 0.82)`, `muted: mix('#ffffff', '#1c1c1f', 0.64)`, `hairline: mix('#ffffff', '#1c1c1f', 0.16)` (kit `_media`, its rgba composited over the surface so every token stays `#rrggbb`).
  - CSS: `.theme-media { … }` with every `--color-<name>` of `MEDIA.salsa`, `color-scheme: dark`, `--icon-knockout: var(--color-surface)`; `[data-dance='bachata'] .theme-media { … }` with bachata's dance tokens (`band` … `inverse-accent`, as the bachata dark rule lists them).
  - `<PlayerLayer shape?: 'sheet' | 'dialog' = 'sheet' title: string sub?: string back?: boolean tall?: boolean z?: string = 'z-40' icon?: IconName tone?: 'default' | 'danger' body?: string footer?: Snippet children?: Snippet onclose: () => void />` — an overlay inside the full-screen player's `<dialog>`, always `.theme-media`.

- [ ] **Step 1: Write the failing tests.** `tokens.spec.ts`: `MEDIA` defines every token as `#rrggbb` for both dances; `MEDIA.salsa.ground === '#000000'`; `MEDIA.bachata.accent === THEMES.bachata.dark.accent`; `it.each(pairs)` (with Task 1's two added) passes on `MEDIA[d]` too. `stylesheet.spec.ts`:

```ts
const block = (sel: RegExp) => css.match(sel)?.[1] ?? '';
it('scopes the media palette for the player’s layers', () => {
  const salsa = block(/\n\s*\.theme-media\s*\{([^}]*)\}/);
  for (const n of TOKEN_NAMES) expect(salsa, n).toContain(`--color-${n}: ${MEDIA.salsa[n].toLowerCase()};`);
  const bachata = block(/\[data-dance='bachata'\]\s+\.theme-media\s*\{([^}]*)\}/);
  for (const n of ['band', 'accent', 'accent-text', 'accent-soft', 'on-accent', 'status'] as const)
    expect(bachata, n).toContain(`--color-${n}: ${MEDIA.bachata[n].toLowerCase()};`);
});
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/theme` — Expected: FAIL.
- [ ] **Step 3: Implement** `MEDIA` and the two CSS blocks, after the bachata dark rule (a comment: the player is always dark whatever the scheme; the rule sits on the layer itself, so it beats the inherited scheme; `[data-dance='bachata'] .theme-media` outranks `.theme-media` by specificity).
- [ ] **Step 4: Implement `PlayerLayer.svelte`.** Root: `absolute inset-0 {z} theme-media flex flex-col bg-black/45` — `justify-end` for a sheet, `items-center justify-center p-6` for a dialog; `role="presentation"`; a click on the root itself → `onclose`; `keydown` Escape → `preventDefault`, `stopPropagation`, `onclose` (one level back; the player's dialog never sees it — as `LinkLevel` does today). The panel is the root's static flex child — **never positioned and never transformed** (the open animation is an opacity fade, 150 ms, none under reduced motion): a layer nested inside it (a `PickerField`'s picker in a create step) must resolve against this root and cover the player. Sheet: `role="dialog" aria-modal="true" aria-label={title} tabindex="-1"`, `mx-auto flex w-full max-w-[560px] max-h-[88%] flex-col overflow-hidden rounded-t-[28px] bg-sheet text-ink`, `h-[88%]` when `tall`, `sm:my-auto sm:rounded-[28px]`; grabber, header, body (`min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2`), the 28 px fade when `tall`, footer (`flex flex-col gap-2 border-t border-hairline px-4 pt-3`), bottom padding `max(env(safe-area-inset-bottom), 16px)` — the same classes as `Sheet.svelte`'s (a comment says to keep them in step). Back is `iconButton('bare')` `back` "Back" at the left; × is `iconButton('bare')` `close` "Close" at the right; both call `onclose`. Dialog: `role="alertdialog"`, `w-full max-w-[330px] rounded-[22px] bg-raised`, then `Dialog.svelte`'s inner markup (icon disc, 22/800 title, 15 `text-ink-2` body, `footer` as the actions). On mount focus the panel (`preventScroll`); on destroy give focus back to what had it, if still connected (from `LinkLevel`).
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS. (No screen uses the layer yet; Tasks 3 and 5 screenshot it.)
- [ ] **Step 6: Commit** `feat(ui): the media palette as a scope, and the player's layer`.

### Task 3: The shared picker, its field and its opener

**Files:**
- Modify: `src/lib/components/picker/Picker.svelte`, `src/lib/components/picker/PickerField.svelte`
- Modify: `src/lib/components/ui/SearchField.svelte`
- Create: `src/lib/components/picker/PickerOpener.svelte`
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/components/links/LinkPopup.svelte` (create labels only)

**Interfaces:**
- Consumes: Task 1's `view.ts`; `PlayerLayer` (Task 2); `Sheet` (`back`, `sub`, `tall`, `footer`); `Banner`, `Spinner`, `Icon`, `FieldError`; `button`, `iconButton`, `SELECT`, `LABEL`, `SECTION_LABEL`.
- Produces:
  - `Picker` props: today's (`open title placeholder groups kind chosen nothingLeft create added message theme prefiltered query top empty onpick onadd onpreview oncreate ondone onclose`, unchanged) plus `sub?: string`, `back?: boolean`, `pending?: ReadonlySet<string>` (keys whose + is in flight), `loading?: boolean`, `failure?: { title: string; body: string } | null`, `emptyIcon?: IconName = 'search'` (the nothing-left box), `z?: string` (dark only). `create` labels are bare nouns ("Figure"); the picker draws the +.
  - `PickerField` props: today's plus `error?: string | null` (a `FieldError` under the field, `aria-invalid` on it). Its picker always opens with `back`.
  - `SearchField`: `name` and `onclear` become optional; adds `disabled?: boolean`, `input?: HTMLInputElement` (`$bindable`, the element), `onkeydown?: (e: KeyboardEvent) => void`. Music's and Moves' uses are unchanged.
  - `<PickerOpener label: string onclick: () => void disabled?: boolean />` — `button('secondary', 'md', true)` holding `search` 20 and the label, `type="button"`, `aria-haspopup="dialog"`.

- [ ] **Step 1: `SearchField`** — the additions above; disabled draws `bg-disabled-bg text-disabled-ink`, no ring, no Clear. Keep the pill and its focus ring.
- [ ] **Step 2: `Picker`'s frame.** Light: `<Sheet {title} {open} {onclose} {back} {sub} tall={pickerTall(…)} footer={…}>`; dark: `{#if open}<PlayerLayer {title} {sub} {back} {z} tall={…} {footer} onclose>`. Inside, one column `flex h-full min-h-0 flex-col gap-2`: the `SearchField` (no `name`; `placeholder`; `bind:value={query}`; `bind:input` for the `(pointer: fine)` focus; Enter `preventDefault`; `disabled` while `loading` or `failure`), `top`, the refusal as `<Banner kind="error" title="That could not be linked.">{message}</Banner>`, then the list `-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6` — only it scrolls; the Sheet's `tall` fade sits over its end. Keep the "every opening starts with an empty search" effect.
- [ ] **Step 3: The body** by `pickerBody`. *list*: per `lineGroups` group, `<h3 class={SECTION_LABEL}>` (non-first `mt-2.5`) then one card `overflow-hidden rounded-2xl bg-surface` (no `divide-y`: hairlines are inset). A heading line: `px-4 pt-3.5 pb-0.5 text-[13px] leading-[1.3] font-extrabold tracking-[0.01em] text-ink-2 truncate`, not a button. A row (board `prow`): outer `flex items-center pl-4` (`pl-8` indented), `bg-accent-soft` when chosen, `has-[[data-pick]:active]:bg-step`; ▶ first when `row.preview`: `iconButton('tonal')` `mr-2.5` with `play` 18 filled, `aria-label="Play {row.label}"`; then a box `flex min-w-0 flex-1 items-center` with `border-b border-hairline` unless `last`, holding the pick button (`data-pick`, `type="button"`, `disabled` when linked, `aria-current="true"` when chosen; `flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-[9px] text-left`, `pr-3.5` when it has no trailing control; title 16/700 `leading-[1.3] truncate`, `text-muted` when linked else `text-ink`; meta 13 `leading-[1.35]` — `text-ink-2` on a chosen row, else `text-muted`) and the trail by `rowTrail`: `add` → `iconButton('bare').replace('text-ink', 'text-accent')` `mr-1.5` with `plus` 24, `aria-label="Link {row.label} and keep picking"`; `pending` → a 44 px box `mr-1.5` `role="status" aria-label="Linking {row.label}"` with `<Spinner size={22} />` in `text-accent`; `linked` → `flex items-center gap-1 pr-3 pl-1 text-[13px] font-bold text-muted whitespace-nowrap` with `check` 16 + "Linked"; `chosen` → `check` 22 `text-accent-text` with `pr-3.5`. Row buttons draw their focus ring inset (a scoped `:focus-visible { outline-offset: -2px; box-shadow: none }` — utilities lose to the unlayered global rule, as `SongPicker`'s `.inset-focus` comment says). *empty*: `<div role="status" class="flex flex-none items-start gap-3 rounded-2xl bg-surface p-4">` with `Icon` 22 in `text-muted` (`search` when typed, else `emptyIcon`) and `emptyText(…)` 15/500 `leading-[1.45] text-ink-2`; the `empty` snippet replaces the text when given (the routine editor's rescue). *loading*: a `w-24 h-3 rounded-md bg-skeleton ml-4` bar, then a `bg-surface rounded-2xl` card `aria-busy="true"` with `<span role="status" class="sr-only">Loading</span>` and five rows (min-h 64, `pl-4 pr-4`, inset hairlines) of two bars (h-3 / h-2.5 at widths 62/40, 48/56, 70/34, 54/46, 66/38 %). *failed*: `<Banner kind="error" title={failure.title}>{failure.body}</Banner>`.
- [ ] **Step 4: The footer** (only when there is a create row or `kind === 'link' && added > 0`): the create row — `<p class="pl-1 text-[13px] font-bold text-muted">{createLead(typed)}</p>` and `<div role="group" aria-label={createLead(typed)} class="flex gap-2">` of buttons `flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-accent-soft px-2 text-[15px] font-extrabold whitespace-nowrap text-accent-text active:brightness-95` with `plus` 18 and the label; then Done: `button('primary', 'md', true)` with `doneLabel(added)`. Change the create labels at their two call sites: the lesson page's `'+ Figure'`, `'+ Variation'`, `'+ Routine'`, `'+ Exercise'` and `LinkPopup`'s `CREATE_ROW` (`'+ Variation'`, `'+ Figure'`, `'+ Drill'`) lose the `"+ "`.
- [ ] **Step 5: `PickerField`** to the board's select field: `<span id class={LABEL}>{label}</span>`, the field `<button type="button" class={SELECT} aria-haspopup="dialog" aria-invalid={error ? 'true' : undefined} aria-describedby>`, the value 16/600 `text-ink` truncate or the placeholder `font-medium text-muted`, `chevron-down` 20 `text-muted`; `<FieldError>` under it when `error`. Keep the hidden-but-validated input and its comment. Its `Picker` gets `back`; the per-theme class maps go (the layer's `.theme-media` colours it in the player).
- [ ] **Step 6: `PickerOpener.svelte`** as in Interfaces (used from Task 4).
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look**, with `pickers-states.py`, light and dark: the lesson's Link a figure (as opened; type "dob"; type "Montaña"), Today on a past day with sets → the exercise picker (act rows, bachata), a figure's Move to… (field closed and focused by Tab; open — the current figure checked; picked — the name field follows). The field check (Review Focus 3): in Move to…, type a New figure's name, open the Figure field, press Enter in its search (nothing posts: no request in the network log, the picker still open), tap Back (the sheet, the typed name kept), open it again and pick a figure (the field shows it, the sheet still open, nothing posted). Also open a routine's seam picker (its chips and rescue are plan 6's; the rows and sheet are this one's). Compare with `s-pickers-0.png` (open, search), `s-pickers-1.png` (no match, act), `s-pickers-2.png` (field states). The field picker shows Back where the board draws × (Calls).
- [ ] **Step 9: Commit** `feat(pickers): the shared picker, its field and its opener in the new look`.

### Task 4: Every opener, and the + in flight

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte`
- Modify: `src/lib/components/exercises/kinds/drill/Content.svelte`
- Modify: `src/lib/components/today/PastDay.svelte`
- Modify: `src/lib/components/ui/LinkSectionSheet.svelte`

**Interfaces:**
- Consumes: `PickerOpener`, `Picker`'s `pending` / `emptyIcon` (Task 3); `SvelteSet` from `svelte/reactivity`.
- Produces: nothing new; every caller's props and actions unchanged.

- [ ] **Step 1: Lesson page.** The three openers — today the `linkButton` snippet under Figures, Routines and Exercises; after plan 7's Task 4, the group's last row — become `<PickerOpener label="Link an existing figure…" />`, "Link an existing routine…", "Link an existing exercise…", `mt-2` under the group's card (or under its label when nothing is linked), calling `openPicker(kind)`; drop the snippet or the last row. `inFlight` becomes a `SvelteSet<string>` (drop its eslint-disable) and is passed as `pending` to all three pickers. A refusal with no message from the server becomes `` `${row.label} was not linked. Try it again.` `` (it is the banner's body under the fixed title).
- [ ] **Step 2: Figure page.** The label row's tertiary "Link a section" goes; `<PickerOpener label="Link a section…" />` sits `mt-2` under the linked sections (or under the "Point at the part…" card), reading mode only, as now.
- [ ] **Step 3: Drill (`Content.svelte`).** The 48 px surface "Link a section…" button becomes `<PickerOpener label="Link a section…" />`; `LinkSectionSheet` unchanged.
- [ ] **Step 4: Today, a past day.** `LABEL` "Forgot to log something that day?" stays as a `<p id>`; the `SELECT` button becomes `<PickerOpener label="Pick an exercise…" />` with `aria-describedby` on that id. The picker is unchanged (title "Log a set on {dayLabel(day)}", `kind="act"`).
- [ ] **Step 5: `LinkSectionSheet`.** `inFlight` → `SvelteSet`, passed as `pending`; the fallback refusal copy as in Step 1; `emptyIcon="bookmark"`.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look**, light and dark: the lesson page (three openers), Link a figure with + tapped on two rows (Done · 2 linked) and one in flight (throttle the form POST with a Playwright route that waits 2 s before `continue_()`, shoot during the wait); a figure page's opener and its Link a section (near group, ▶, Done · 1 linked); a bachata figure with no sections anywhere (the bookmark box, no create row); a drill page; Today's past day (`/bachata?day=…`). Long names: "Dile que no con vuelta · Doble con mano" truncates, + stays 44 px. Compare with `s-pickers-0.png` (+ to keep going), `s-pickers-5.png` (Link a section), `s-pickers-6.png` (nothing to link).
- [ ] **Step 8: Commit** `feat(pickers): one opener everywhere, a spinner on a + in flight`.

### Task 5: The Link popup's levels

**Files:**
- Modify: `src/lib/components/links/LinkLevel.svelte`, `src/lib/components/links/LinkPopup.svelte`

**Interfaces:**
- Consumes: `stacked`, `linkHeading`, `destination` (Task 1); `PlayerLayer` (Task 2); `Picker`'s `sub`, `back`, `pending`, `loading`, `failure` (Task 3); `Sheet`, `Dialog`, `Badge`, `Banner`, `PickerOpener`, `iconButton`.
- Produces: `<LinkLevel theme: 'light' | 'dark' title: string sub?: string back: boolean z?: string footer?: Snippet onback: () => void children: Snippet />` — light: `<Sheet open title sub back footer onclose={onback}>` (one history entry per level, like every sheet since the foundation); dark: `<PlayerLayer … onclose={onback}>`. `label` and `intercept` go. `LinkPopup`'s props and its hosts (`VideoSections`, `VideoPlayer`) unchanged.

- [ ] **Step 1: `LinkLevel`** as above; its own `<dialog>`, styles and focus code go (the layer and the Sheet own them).
- [ ] **Step 2: The links level** (board `popup_links_sheet`): `LinkLevel` title `Link {range}`, `sub` from `linkHeading`, `back={stacked(steps, 'links')}` (false: ×). Body: `<h3 class={SECTION_LABEL}>Linked</h3>` and a `bg-surface rounded-2xl` card of rows — `pl-4`, inner `flex min-h-14 items-center gap-2 pr-1.5` with inset hairlines; the label 16/700 (`text-muted` when archived) with `<Badge tone="neutral">Drill</Badge>` and `<Badge tone="warn">Archived</Badge>` beside it (wrapping); × `iconButton('bare').replace('text-ink', 'text-muted')` `close`, `aria-label="Unlink {label}"`, disabled while busy. No links left (after the last unlink): "Not linked to anything yet." 14 `text-muted` `px-1`. Then `mt-1` `<PickerOpener label="Link a figure or drill…" />` → `onpush('pick')`. An unlink refusal: `<Banner kind="error" title={message} />` at the top. Loading (the host opened `links`): three skeleton rows in the card, `aria-busy`. Failed: `<Banner kind="error" title="Couldn’t load this section’s links.">Close and tap the link button again.</Banner>`.
- [ ] **Step 3: The question** (`asking`): light — `<Dialog open title="Unlink {label}?" body="It’s also linked to this lesson." icon="unlink" tone="danger">` whose actions are `button('secondary', 'sm', true)` "Only from this section", `button('danger', 'sm', true)` "From the section and the lesson", `button('tertiary', 'sm', true)` "Cancel" (each disabled while busy; Back/Escape = Cancel). Dark — the same as `<PlayerLayer shape="dialog" z="z-50" …>`. The links level's content no longer swaps for the question.
- [ ] **Step 4: The picker level.** `title` `Link {range} to…` once options arrive, "Link a section to…" before; `sub` = `linkHeading(…).sub` only when not stacked; `back={stacked(steps, 'pick')}`; `loading={!options && !loadFailed}`; `failure={loadFailed ? { title: 'Couldn’t load this section’s links.', body: 'Close and tap the link button again.' } : null}`; `nothingLeft="Nothing else to link."`; `inFlight` → `SvelteSet` as `pending`; the fallback refusal as Task 4 Step 1. Remove the per-theme `c` map and the inline `range` / `destination` (Task 1 has them).
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look**, light and dark, on a lesson video with sections: a section with no links → the link icon opens the picker directly (×, near group first, three create choices); link one by tap (both close, the section's line updates); its link icon again → the links level (Drill and Archived badges: archive a linked variation in the dev DB for that); Link a figure or drill… → the picker stacked (Back); + one (Done · 1 linked); Back → the links level; × a hand-linked one → the question. Loading: delay the GET of `/api/video-spots/*/links` with a route handler; failed: `route.abort()`. Refused (Review Focus 1): fulfil the POST with `status=409, json={"message": "Already linked."}` and tap + — the banner, the row back to +. Then the player: open the lesson video full screen, a section's link badge → the same levels in the media palette; Escape steps back one level at a time. Compare with `s-pickers-3.png` (popup direct, links, pick over), `s-pickers-5.png` (the question, the player), `s-pickers-6.png`/`-7` (loading, couldn't load), `s-pickers-1.png` (refused).
- [ ] **Step 7: Commit** `feat(links): the Link popup's levels as stacked sheets, the question as a dialog`.

### Task 6: Create and link, refusals under their field

**Files:**
- Modify: `src/lib/server/spot-links.ts` (`SpotLinkError`), `src/lib/server/link-popup.ts`, `src/lib/server/link-popup.spec.ts`
- Modify: `src/routes/api/video-spots/[id]/links/+server.ts`, `src/routes/api/video-spots/links.spec.ts`
- Modify: `src/lib/video/spots-api.ts`, `src/lib/video/spots-api.spec.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/components/links/LinkPopup.svelte`

**Interfaces:**
- Consumes: `refusalAt`, `destination`, `stacked` (Task 1); `LinkLevel` (Task 5); `PickerField`'s `error` (Task 3); `Segmented`, `FieldError`, `Banner`, `Spinner`, `FIELD`, `LABEL`, `button`.
- Produces: `type LinkCreateField = 'name' | 'figureName' | 'groupId' | 'style' | 'everyDays'` in `$lib/types`; `new SpotLinkError(message, status = 400, field?: LinkCreateField)` (`readonly field`); the POST answers a refusal with a field as `json({ message, field }, { status })` (without a field, as today); `SpotsApiError` gains `readonly field?: string`, read by `ok()` when the body has a string `field`. Messages unchanged.

- [ ] **Step 1: Write the failing tests.** `link-popup.spec.ts` — each refusal of `createAndLink` carries its field: an empty name → `name`; a figure group of the other dance → `groupId`; "Enchufla already has a Doble." → `name`; an empty figure name → `figureName`; "There's already a figure called Enchufla." → `figureName`; a style of the other dance → `style`; a bad frequency → `everyDays` (e.g. `expect(() => createAndLink(db, spot, {...})).toThrow(expect.objectContaining({ field: 'figureName' }))`). `links.spec.ts` — the existing "figure name is taken" case becomes `expect(res).toMatchObject({ status: 400, body: { message: "There's already a figure called Enchufla.", field: 'figureName' } })` (a JSON answer, not a thrown error); a 409 for the same target twice keeps no field. `spots-api.spec.ts` — `ok()` on a 400 with `{ message, field: 'figureName' }` rejects with `field === 'figureName'`; without a field, `field` is undefined.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/server/link-popup.spec.ts src/routes/api/video-spots src/lib/video/spots-api.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the field on the eight throws listed, the route's JSON answer, and `ok()`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: The create steps** (board `create_variation`, `create_figure_error`, `create_drill_saving`): each a `LinkLevel` titled "New variation" / "New figure" / "New drill", `back` (stacked), `sub={destination(o)}`, holding `<form id={formId} novalidate onsubmit={create} class="flex flex-col gap-3.5">`; `footer`: `<button type="submit" form={formId} class={button('primary', 'md', true)} disabled={busy}>` with `<Spinner size={20} />` before "Create and link" while busy (width kept). Fields — each `LABEL` + `FIELD` input (`maxlength="200"`, `aria-invalid`, `aria-describedby` → its `FieldError`): variation — `PickerField` "Figure" (`placeholder="Choose a figure…"`, `title="Choose a figure"`, `search="Search figures"`, `error` when `refusalAt` says `groupId`), "Variation name"; figure — "Figure name", "Variation name" (starts "Basic"), "Danced" `<Segmented name="{formId}-partner" label="Danced" items={PARTNER → PARTNER_LABEL} bind:value={partner}>`, "Style" `<Segmented … items={DANCES[o.dance].styles → styleLabel}>`, each `Segmented` under a `LABEL`-styled `<span>` (with `FieldError` under Style for `style`); drill — "Name", "How often" as a native `<select class="{FIELD} appearance-none pr-10">` of `FREQUENCIES` with a `chevron-down` 20 `text-muted` over its right end (`pointer-events-none`). A refusal goes where `refusalAt(createStep, e.field)` says; `banner` → `<Banner kind="error" title={message} />` at the form's top. A refusal clears when the step changes, as now; the typed fields stay. No field is focused for the user (the keyboard opens on a tap).
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look**, light and dark: in the direct picker type "dob", tap Variation → New variation (Back; Figure filled from the near group; Variation name "dob"); Back keeps "dob" in the search; tap Figure with "Enchufla" typed → Create and link → the message under Figure name; with "Montaña" typed, Figure → "Montaña" in Figure name (Review Focus 2); a bachata New drill with Create and link in flight (delay the POST). In the player (Review Focus 4): New variation → its Figure field → the figure picker covers the whole player above the step (Back), pick → back to the step with it filled; Escape from the step → the picker → the links level (if any) → the player. Compare with `s-pickers-4.png` (create states).
- [ ] **Step 8: Commit** `feat(links): create-and-link steps in the new look, refusals under their field`.

### Task 7: The song popup, and the docs

**Files:**
- Modify: `src/lib/components/player/SongPicker.svelte`
- Modify: `src/lib/components/songs/SampleButton.svelte` (one prop)
- Modify: `docs/superpowers/specs/2026-10-30-unified-pickers-design.md`, `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `pickerCount` (Task 1), `searchSongs`, `groupSongs`, `highlight`; `SearchField` (Task 3), `Sheet`, `EmptyState`, `Icon`, `SECTION_LABEL`.
- Produces: `SongPicker`'s props unchanged (`songs`, `songId` bindable, `labelId`). `SampleButton` gains `tinted?: boolean` — its disc is `bg-surface` instead of `bg-accent-soft` (a picked row is already accent-soft).

- [ ] **Step 1: The field** (board `song_field`): a `flex items-center rounded-[14px] bg-surface pr-1 shadow-[inset_0_0_0_1px_var(--color-field-line)]` box; the button (`aria-haspopup="dialog"`, `aria-labelledby` as now) `flex min-h-[60px] min-w-0 flex-1 items-center gap-2 py-2 pr-1 pl-3.5 text-left` holding the title 16/700 truncate over the meta 13 `text-muted` (while sampling: "Sample from {clock(startS)}" 13/700 `text-accent-text`), or "Pick a song" 16/500 `text-muted`; `chevron-down` 20 `text-muted`; the sibling `<SampleButton song={picked.sample} name={picked.title} />`.
- [ ] **Step 2: The popup** (board `picker_sheet`): `<Sheet title="Pick a song" tall={songs.length > 0}>` with one column like the picker's: `<SearchField placeholder="Search songs" bind:value={query} bind:input={search} />` (no name); the count line `flex justify-between gap-2 px-1 text-[13px] text-muted` — `pickerCount(…)` 700, and `play` 12 filled + "hear 15 s · tap a song to pick it"; the scrolling list (`-mx-4 px-4 flex flex-col gap-2`): not searching — `SECTION_LABEL` "Recent" + card, `SECTION_LABEL` "All songs A–Z" (`mt-2`) + card when there are recents, else one card; searching — one card of hits; no hits — `<EmptyState icon="search" title="No song matches “{q}”" body="Once it is added and ready, it shows here.">` whose action is `<a href={resolve('/[dance]/songs', { dance: slug }) + '?add=1'} onclick={close} class="inline-flex min-h-11 items-center text-[15px] font-extrabold text-accent-text">Add it in Music</a>` (carried: was "Add it on the Songs page." to `/songs`).
- [ ] **Step 3: A row** (board `song_row` kind pick): `pl-4`, `bg-accent-soft` when picked; inner `flex min-h-16 items-center gap-1 pr-1` with inset hairline unless last; the pick button (`aria-current` when picked, inset focus as now) `flex min-w-0 flex-1 items-center gap-3 py-[9px] text-left`: the radio dot (22 px, `border-2`, `border-accent` with a 10 px `bg-accent` dot when picked, else `border-field-line`; `aria-hidden`), the title 16/700 truncate — while searching, `highlight`'s match in `<mark class="rounded-[4px] bg-accent-soft px-px font-extrabold text-accent-text">` (carried: was bare `text-accent`) — and the second line: "Sample from {clock}" 13/700 `text-accent-text` while sampling (carried: was bare `text-accent`), else the meta 13 — `text-ink-2` on the picked row, `text-muted` elsewhere; then `<SampleButton song={s.sample} name={s.title} tinted={picked} />`. Keep: close stops the sample and clears the query; a sample whose row leaves the hits stops; `onDestroy` stops the field's sample; `(pointer: fine)` focus.
- [ ] **Step 4: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Look**, light and dark, salsa and bachata, on `/salsa/player` and `/bachata/player` with two or more ready songs (Music plan's dev rows) and one practised (Recent): the field; the popup (Recent then A–Z, the pick tinted, one row sampling — ring and "Sample from …"); type "pro" (marks, flat list, a sampling row kept); type "Cali pachanguero" (empty state, the link opens Music with Add a song). Also a figure exercise's log popup with the panel on A song. Compare with `s-music-popup-crop.png` and the Pick a song states of `s-music-3.png`.
- [ ] **Step 6: Docs.** `2026-10-30-unified-pickers-design.md`: a status note (2026-10-31, the redesign) — openers are `PickerOpener` (full-width tonal, search icon) everywhere; a stacked picker shows Back, the field picker included; the + in flight is a spinner; a refusal is a banner over the list; the create row's buttons are tonal pills with a + icon; in the player the picker is a `PlayerLayer` in the media palette. `2026-10-29-section-link-popup-design.md`: a status note — the levels are stacked bottom sheets (a `Sheet` each on site pages, so Back closes the top level; a `PlayerLayer` in the player); "Unlink …?" is a dialog over the links; a create refusal names its field (`{ message, field }`) and shows under it. `CLAUDE.md` Layout: `src/lib/picker/` — add `view.ts` (what a row ends in, the create row's lead, body state, height); `src/lib/components/picker/` — add `PickerOpener.svelte`; `src/lib/components/ui/PlayerLayer.svelte` (a Sheet or Dialog as an overlay inside the full-screen player, `.theme-media`); `src/lib/theme/` — `tokens.ts` also holds `MEDIA`, copied into `.theme-media` in `layout.css`.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Commit** `feat(pickers): the song popup in the new look; docs`.

---

## Calls made in this plan

- **One opener everywhere: `PickerOpener`, a full-width tonal button with a search icon** — the spec's binding text — replacing the lesson page's last-row buttons (Lessons plan), the figure page's label-row "Link a section" (Figure plan), the drill's surface button (Logging plan) and Today's past-day select field (Today plan), each of which left the opener to this plan. Today keeps its "Forgot to log something that day?" line above the opener. Cost if wrong: each site is a one-element swap back.
- **Every stacked level shows Back and no ×, the field picker included.** The spec says so; the board's "Field · open" draws ×. Cost: one prop.
- **The media palette is a CSS scope, `.theme-media`, built from `MEDIA` in `tokens.ts`** (kit `_media`, its rgba composited over the surface so tokens stay `#rrggbb`), so the picker and the Link popup draw the player with the same token classes as the site. Plan 11 can put the player itself on it and retire `--pl-*`. Cost: two CSS blocks.
- **`PlayerLayer` is a new shared component** — the Sheet's and Dialog's look as an overlay inside the player's `<dialog>` (a second top-layer dialog would fight the player's own history). Two users here (picker, Link popup levels and question), more in plan 11. Its panel is never positioned or transformed, so a nested layer covers the whole player.
- **On site pages each Link popup level is a `Sheet` with a history entry.** The 2026-10-29 spec gave the popup none "like every other sheet on the site's pages"; since the foundation every sheet has one, so Back now closes the top level there as everywhere else.
- **"Unlink …?" is a `Dialog`** over the links level (a `PlayerLayer` dialog in the player), as the board draws it; it was the level's content swapped in place.
- **Tinted rows' second line is `text-ink-2`, not `text-muted`** — muted on accent-soft is 4.13–4.54:1; the board draws muted.
- **The sample disc on the picked song row is `bg-surface`** (`SampleButton`'s new `tinted`); the board's `accent_soft_pressed` has no token. Cost: one class.
- **The picker is `tall` (fixed 88 dvh) whenever it opens on rows or is loading**, short when it opens on nothing or fails — the board's heights, and typing never resizes the sheet. The song popup likewise.
- **A create refusal carries a `field`** (`SpotLinkError`'s third argument, the POST's `{ message, field }`), so it shows under its field; messages, statuses and the plain-message refusals are unchanged. The only server change.
- **"Link a section to…" until the options arrive**: the popup learns the range from its own fetch; the board's loading state draws the range.
- **Section length stays "13.0 s"** (`lengthText`, shared with the player's toast); the board writes "13 s".
- **How often stays a native `<select>`** in the New drill step, drawn as the kit's select field: `FrequencyField` is a `Sheet`, which cannot stack inside the player.
- **Create choices are bare nouns with a drawn +** ("Figure"), in a group named by the lead ("Not in the list? Create “dob” as").
- **A refused link's banner title is fixed** ("That could not be linked."); its body is the server's message, or "{label} was not linked. Try it again." when there is none.
- **`SlotPicker`'s context line stays in its `top` snippet** (plan 6), not lifted into the new `sub`.
- **The song popup stays its own sheet** (the unified-pickers spec's non-goal), drawn to the Music board, with "Add it in Music" to `/[dance]/songs?add=1` (Music's Add a song on arrival).
