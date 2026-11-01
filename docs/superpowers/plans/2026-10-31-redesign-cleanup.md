# Redesign: Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the area plans found to be systemic — focus rings clipped by
cards, focus lost after a one-tap removal, data left stale when a sheet closes
during a reload, colour classes that lose to a builder's own — and finish what
they left behind: the old token aliases, a scrim and band-track token, the
foundation's small leftovers, the parked minors, and docs that describe what
the redesign built.

**Architecture:** Each systemic fix is made once, at the shared layer, and
pinned by a spec that scans the source so it cannot come back: rows inside a
clipping card draw their ring inside (`focus-inset`, carried by `GROUP` and a
new `CLIP`); focus after a removal goes through one pure rule
(`src/lib/focus.ts`); a refresh that a closing sheet could drop goes through
one helper on the sheet stack (`refreshWhenSettled`), and Sheet and Dialog
call it themselves when a form was sent while they were open; a colour on an
icon button is the builder's `tone`, never a class appended after it. The rest
are small, independent edits, each with its own check.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node only),
Playwright screenshots via `$S/tools/page.sh` and small `$S/tools/*.py` scripts.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Components
and states" (Focus), "Patterns used across screens", "Additions", "Calls made
while writing this"; and the foundation plan's "Carried to later plans",
Cleanup bullet (`docs/superpowers/plans/2026-10-31-redesign-foundation.md`).

**This is plan 13 of 13, the last** (it lives at
`docs/superpowers/plans/2026-10-31-redesign-cleanup.md`). All plans land on branch `app-icons`,
deployed once when this one is done. It runs after Practice (plan 10), the
video player (plan 11) and Settings/system (plan 12) have landed; Task 1
Step 1 checks that. Where a step depends on one of them (e.g. `bands.spec.ts`'s
`PENDING`, voice takes), it says so.

`$S` below is `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.
The dev server on http://localhost:20000 serves this worktree; never start
another. Screenshot scripts go in `$S/tools/`, shots in `$S/shots/cleanup-N/`.

## Global Constraints

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

This plan adds:

- No feature, copy or data-model change. Every screen keeps what it does; only
  focus, refresh timing and the listed look fixes change.
- Inside an element that clips (`overflow-hidden`) and holds focusable
  children, the ring and halo draw inside the control (`focus-inset`).
- A colour on a built control comes from the builder (`iconButton(variant, tone)`,
  `FIELD_INVALID`, `SELECT_INVALID`); never append a `text-*` colour after
  `button()` / `iconButton()` output, never `.replace('text-ink', …)` it.
- Small accent text is `text-accent-text`; bare `text-accent` only on icons, rings and fills.
- Files plans 11 and 12 own (the player's `src/lib/components/video/`,
  `ui/VideoPlayer.svelte`; Settings, `/voice`, login, pairing, share) are
  edited here only where a step names them.
- `/dev/kit` gets nothing new; its existing examples follow the rules above.

## Review Focus

1. **The first and last row of a card under the keyboard:** the whole ring and halo show inside the card's rounded edge, in light and dark — pinned by `focus-clip.spec.ts` and the Tab screenshots of six pages (Task 1).
2. **Removing the last row, or the only one:** focus goes to the row before it, and with the list empty to the list's add control or heading — never `<body>` — pinned by the `nextFocusKey` tests and the keyboard script (Task 2).
3. **Closing a sheet while its Save or + is still loading** (a slow phone, a double tap on ×): the page still shows the change once it lands — pinned by the delayed-response script (Task 3).
4. **A theme block that drifts** (bachata dark carrying a salsa value, a token missing from one block, an alias removed while a page still uses it) — pinned by the per-block `stylesheet.spec.ts` and its alias scan (Task 5).
5. **A refused field:** the danger outline appears without moving the field's text by 1 px, and a muted or danger icon button stays muted or danger — pinned by `styles.spec.ts` and `class-rules.spec.ts` (Task 4).

---

### Task 1: Focus rings stay whole inside cards

**Files:**
- Modify: `src/routes/layout.css` (one rule after the global focus rule)
- Modify: `src/lib/components/ui/styles.ts` (`CLIP`, `GROUP`), `src/lib/components/ui/styles.spec.ts`
- Modify (add `CLIP` where the class string has `overflow-hidden`): `src/routes/[dance]/figures/[id]/+page.svelte` (recording cards), `src/routes/[dance]/lessons/[id]/+page.svelte` (video cards), `src/lib/components/links/LinkList.svelte` (YouTube cards), `src/lib/components/exercises/kinds/lesson/Content.svelte`, `src/lib/components/exercises/kinds/figure/Content.svelte`, `src/lib/components/picker/Picker.svelte`, `src/lib/components/routines/Swipeable.svelte`, `src/lib/components/player/Running.svelte` and `SongPicker.svelte` (Practice), `src/routes/dev/kit/+page.svelte` (two cards)
- Modify: `Picker.svelte`, `SongPicker.svelte` (delete their scoped `.inset-focus` rules and classes)
- Create: `src/lib/components/ui/focus-clip.spec.ts`
- Create: `$S/tools/cleanup-focus.py`

**Interfaces:**
- Produces: `CLIP = 'focus-inset overflow-hidden'`; `GROUP = \`${CLIP} divide-y divide-hairline rounded-2xl bg-surface\``; CSS class `focus-inset` (on a container: every focusable inside draws its ring inside) and `focus-out` (on a control inside one: keeps the outside ring). Later tasks and plans use `CLIP` for any new clipping card.

- [ ] **Step 1: Check the branch.** `git log --oneline app-icons | head -40` shows the Practice merge, the video player's Task 7 (`refactor(video): retire the player's own palette and icons`) and the system plan's Task 8 commit; `grep -n "settled(" src/lib/sheets/stack.ts` finds `settled`. If any is missing, stop and report which.
- [ ] **Step 2: Write the failing tests.** `styles.spec.ts`: `expect(GROUP.split(' ')).toEqual(expect.arrayContaining(['focus-inset', 'overflow-hidden']))`; `expect(CLIP).toBe('focus-inset overflow-hidden')`. `focus-clip.spec.ts` (node `fs`, a recursive `readdirSync` over `src/`, `.svelte` files): every line containing `overflow-hidden` also contains `focus-inset`, unless the file and a substring of that line are in
  ```ts
  // A clipping element with nothing focusable inside, or one that is itself the focusable.
  const ALLOWED: [file: string, line: string, why: string][] = [
    ['src/lib/components/shell/NavProgress.svelte', 'overflow-hidden', 'a bar, nothing inside'],
    ['src/lib/components/ui/UploadCard.svelte', 'h-1.5 overflow-hidden', 'progress track'],
    ['src/lib/components/songs/UploadRow.svelte', 'h-1.5 overflow-hidden', 'progress track'],
    ['src/lib/components/exercises/LogShell.svelte', 'aria-hidden', 'skeleton'],
    ['src/lib/components/shell/PageSkeleton.svelte', 'overflow-hidden', 'skeleton, aria-hidden'],
    ['src/lib/components/links/YouTubeCard.svelte', 'h-16 w-28', 'the link itself; its own outline is not clipped'],
    // the full-screen player is plan 11's: its stage and trim strip fill the screen
  ];
  ```
  plus the player's lines (`ui/VideoPlayer.svelte` stage and video area, `video/TrimStrip.svelte`) and `ui/PlayerLayer.svelte`'s panel (its header controls sit ≥ 8 px in; its rows are in their own `CLIP` cards) — each with its reason. Add nothing else to the list without a reason a reviewer can check.
- [ ] **Step 3: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: FAIL (GROUP has no `focus-inset`; the listed files' cards).
- [ ] **Step 4: Implement.** In `layout.css`, right after the global `:where(a, button, …):focus-visible` rule, unlayered like it:
  ```css
  /*
   * Inside a card that clips (GROUP, CLIP), the ring and halo go inside the
   * control: outside, the card's edge would cut them off, and between rows
   * they would cross the hairline. A filled control there keeps the outside
   * ring with `focus-out` (an inset accent ring vanishes on an accent fill).
   */
  :where(.focus-inset) :where(a, button, input, select, textarea, summary, [tabindex]):not(.focus-out):focus-visible {
  	outline-offset: -2px;
  	box-shadow: inset 0 0 0 6px color-mix(in srgb, var(--focus-ring, var(--color-accent)) 20%, transparent);
  }
  ```
  `styles.ts`: `CLIP` and `GROUP` as in Interfaces (GROUP's comment: rows draw their focus inside). Each hand-rolled clipping card in Files: replace its `overflow-hidden` with `{CLIP}` (or `${CLIP}`). Picker and SongPicker: drop `.inset-focus` (class and `<style>` rule); their cards get `CLIP`. Then `grep -rnE "bg-accent|bg-danger|iconButton\('filled'\)|button\('(primary|danger)'" ` within each `GROUP`/`CLIP` container you touched: a filled control inside one gets `focus-out` and must sit ≥ 8 px from the card's edge — list any you find in the commit message.
- [ ] **Step 5: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: PASS. Then `grep -rnE "overflow-(x|y)-auto|overflow-auto" src --include='*.svelte'` and note each scroll box whose focusable children touch its edge; they are checked in Step 6 and get `focus-inset` only if a ring is visibly cut.
- [ ] **Step 6: Look.** Write `$S/tools/cleanup-focus.py` (from `ff-focus.py`; viewport 390×844, both schemes, signed in with `state.json`): for each path, press Tab until `document.activeElement.closest('.focus-inset')` is set (at most 80 presses), screenshot the 390×300 strip around it, then keep tabbing to the last focusable in that same card and screenshot again. Paths: `/salsa`, `/salsa/figures`, a figure with recordings and links (`/salsa/figures/<id>`), a lesson with videos, sections and links (`/salsa/lessons/<id>`), `/salsa/songs`, `/settings`, and `/bachata/lessons/<id>` once for the wine accent. Expected in every shot: the whole 2 px ring and the halo inside the row, rounded with the card at its corners, nothing cut. Run it through `page.sh`'s environment: `SCRIPT=cleanup-focus.py $S/tools/page.sh $S/shots/cleanup-1` (the same for the scripts of Tasks 2 and 3).
- [ ] **Step 7: Commit** `fix(ui): focus rings draw inside the cards that clip them`.

### Task 2: Focus goes somewhere after a one-tap removal

**Files:**
- Create: `src/lib/focus.ts`, `src/lib/focus.spec.ts`
- Modify: `src/lib/components/ui/Banner.svelte`
- Modify (the three copies of the focus-key query become `focusKeyed`): `src/routes/[dance]/figures/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/routes/[dance]/routines/[id]/+page.svelte`
- Modify (removal sites, below): `src/lib/components/exercises/SetList.svelte`, `src/routes/[dance]/figures/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/components/lessons/VideoSections.svelte`, `src/lib/components/lessons/UnlinkVia.svelte`, `src/lib/components/exercises/kinds/drill/Content.svelte`, `src/lib/components/links/LinksEditor.svelte`, `src/lib/components/links/LinkPopup.svelte`, `src/routes/[dance]/positions/+page.svelte`, `src/routes/[dance]/songs/[id]/+page.svelte`, `src/lib/components/figures/StartPositions.svelte`, `src/lib/components/routines/SlotCard.svelte`, `src/routes/voice/+page.svelte` and `src/routes/settings/+page.svelte` (as plan 12 left them)

**Interfaces:**
- Produces, in `src/lib/focus.ts` (DOM is touched only inside the functions, so the module imports under node):
  - `nextFocusKey(keys: readonly string[], gone: string, fallback: string): string` — PURE: the key after `gone`, else the one before it, else `fallback`.
  - `focusKeyed(key: string): boolean` — focuses the first `[data-focus="<key>"]` not inside `[inert]` or `[hidden]`; true if one was found.
  - `focusAfterRemoval(keys: readonly string[], gone: string, fallback: string): Promise<void>` — `await tick()`; only if `document.activeElement` is `null`, `<body>` or disconnected (focus was lost, so never steal it), `focusKeyed(nextFocusKey(…))`, falling back to `focusKeyed(fallback)`.
  - `focusAfter(el: Element): HTMLElement | null` — the first focusable (`a[href]`, enabled `button`/`input:not([type=hidden])`/`select`/`textarea`, `summary`, `[tabindex]:not([tabindex="-1"])`) after `el` in document order and outside it, not inert, hidden or without client rects; else the last one before it.
- The rule: a row's `data-focus` key is `<list>-<id>` on the row's main link or button (the text part of a split row); each list has a fallback key — its add control or opener (`<list>-add`), else its section heading made focusable with `tabindex="-1"` (`<list>-heading`).

- [ ] **Step 1: Write the failing test** `focus.spec.ts`:
  ```ts
  expect(nextFocusKey(['set-1', 'set-2', 'set-3'], 'set-2', 'sets-add')).toBe('set-3');
  expect(nextFocusKey(['set-1', 'set-2', 'set-3'], 'set-3', 'sets-add')).toBe('set-2');
  expect(nextFocusKey(['set-1'], 'set-1', 'sets-add')).toBe('sets-add');
  expect(nextFocusKey([], 'set-1', 'sets-heading')).toBe('sets-heading');
  expect(nextFocusKey(['set-1', 'set-2'], 'set-9', 'sets-add')).toBe('sets-add');
  ```
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/focus.spec.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/focus.ts` as in Interfaces. Replace the three `setEditing` query copies with `focusKeyed(key)` (keep their `await tick()`).
- [ ] **Step 4: Banner.** The Dismiss button's handler: `const to = focusAfter(root)` (bind the banner's root), `ondismiss()`, `await tick()`, then `to?.focus()` if focus was lost (same test as `focusAfterRemoval`). No new prop: every Banner with `ondismiss` is fixed at once (exercise page, routine refusals ×2, LogShell, ChunkedUploadButton).
- [ ] **Step 5: Removal sites.** At each, capture the list's keys before the request, then call `focusAfterRemoval(keys, gone, fallback)` after the success's `update()` / `act()` / reload has run (a refusal keeps the row and focus):
  - Unlink: the figure page's section-link Unlink; the lesson page's split-row Unlink (through `UnlinkVia`); `VideoSections`' Unlink; the drill popup's "Unlink this section"; `LinksEditor`'s Remove; `LinkPopup`'s × on a link (fallback: the "Link a figure or drill…" opener).
  - Delete / remove: `SetList`'s delete set (fallback: the log popup's Log set button); the figure page's Delete recording and the lesson page's Delete video (after their dialog; fallback: the upload control); positions' Remove (fallback: the band's +); the song page's "Remove the 1 at …"; `StartPositions`' Remove; `SlotCard`'s alternative Remove (fallback: the slot's own button); a voice take's delete and a paired phone's Remove (plan 12's Undo flows; fallback: the section heading).
  - The routine's slot delete already focuses its neighbour (`routines/[id]` `[data-slot]`): leave it.
- [ ] **Step 6: Run** `timeout 600 nix develop -c npx vitest run src/lib/focus.spec.ts` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** `$S/tools/cleanup-removal.py` (keyboard only, prints the active element with `ff-focus.py`'s `AE` after each): on a throwaway exercise it creates, log two sets, Tab to the second's delete, Enter → focus on the first set's row; delete that → the fallback; Undo both. On a lesson: link a figure through "Link a figure", Tab to its Unlink, Enter, confirm → the next row or the "Link a figure" opener. On `/dev/kit`: Tab to the Banner's Dismiss, Enter → the next control after the banner. Expected: never `BODY`. Screenshot each landing in light and dark (`$S/shots/cleanup-2/`).
- [ ] **Step 8: Commit** `fix(ui): focus moves to the next row after a removal, and past a dismissed banner`.

### Task 3: A sheet that closes never drops the page's refresh

**Files:**
- Modify: `src/lib/sheets/stack.ts` (`open` getter), `src/lib/sheets/stack.spec.ts`
- Modify: `src/lib/sheets/history.svelte.ts` (`refreshWhenSettled`, `refreshIfSent`, the `submit` listener in `syncSheets`)
- Modify: `src/lib/components/ui/Sheet.svelte`, `src/lib/components/ui/Dialog.svelte` (call `refreshIfSent` when they really close)
- Modify: `src/lib/components/lessons/VideoSections.svelte` (`closeLink`, the SectionPlayer's `onclose`), `src/routes/[dance]/figures/[id]/+page.svelte` and `src/routes/[dance]/lessons/[id]/+page.svelte` (VideoFrame `onclosed`)
- Create: `$S/tools/cleanup-refresh.py`

**Interfaces:**
- Consumes: `sheetStack.settled(fn)` (plan 8): runs `fn` once, a task later, after history has caught up with the stack.
- Produces:
  - `SheetStack.open: number` — how many sheets are open (slots with status `open`).
  - `refreshWhenSettled(): Promise<void>` — captures `location.href`; in `sheetStack.settled`, runs `invalidateAll()` if the URL is still the same, else nothing; resolves when done.
  - `refreshIfSent(): void` — if a form was submitted on the current URL while a sheet was open since the last call, clear the mark and `void refreshWhenSettled()`. `syncSheets()` sets the mark from a capture-phase `submit` listener on `document` (`if (sheetStack.open > 0) sentAt = location.href`).
- The rule (goes into CLAUDE.md in Task 7): a refresh that follows a sheet's or the player's close goes through `refreshWhenSettled()`; a reload started before the close's Back has landed is dropped by SvelteKit when the popstate arrives.

- [ ] **Step 1: Write the failing test** in `stack.spec.ts`: a fresh started stack has `open === 0`; after two `open(...)` → 2; after `requestClose` of the top one and the flush → 1; after `closedByOwner` of the other → 0.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/sheets` — Expected: FAIL (`open` undefined).
- [ ] **Step 3: Implement** `open` and the two helpers. In `Sheet.svelte` and `Dialog.svelte`, call `refreshIfSent()` in the path that runs when the sheet has really closed (where `onclose` is called, for every way of closing: ×, Back, Escape, backdrop, owner); not in `UnsavedDialog` (it holds no form; its Save submits the page's own) and not in `PlayerLayer` (the player's layers save through `/api/video-spots`, and the page refreshes when the player closes — below).
- [ ] **Step 4: Move the hosts.** The audit, from `grep -rn "invalidateAll\|update(" src`:

  | host | what happens | action |
  |---|---|---|
  | `VideoSections` `closeLink` | the Link popup's levels close, then a refresh | `refreshWhenSettled()` in place of its inline `settled` |
  | `VideoSections` SectionPlayer `onclose` | the player closes (often from inside a popstate), then `invalidateAll` | `void refreshWhenSettled()` |
  | figure page and lesson page, `VideoFrame onclosed` | the same | `onclosed={() => void refreshWhenSettled()}` |
  | every Sheet or Dialog with a form inside or submitting into it — `AddSongSheet`, `SongDetailsSheet`, `NewExerciseSheet`, `MoveSheet`, `VariationBar`'s sheets, `SaveSetSheet`, `LogShell`, `LinkSectionSheet` (+ keeps going), the lesson's three "Link a …" pickers, `LinkPopup` (light), `UnlinkVia`, positions' sheets, the delete / archive dialogs of the figure, lesson, routine, song and exercise pages | the user can close it (×, Back, a double tap) while its `update()` is still loading | covered by Step 3; no host change |
  | positions' Remove (reloads, then closes) | already ordered safely | keep |
  | archive on the exercise and lesson pages; creates that redirect (figures, routines, lessons, coverage) | a navigation, held by the stack's `hold()` | keep |
  | the songs pages' 10 s poll, upload buttons, `restore-set.ts`, `act()` callers | no sheet closes around them; a dropped poll is caught by the next | keep |

  Check the list against the grep once more after plans 10–12 (Practice's `SaveSetSheet`, Settings' saves) and add any new row to the commit message.
- [ ] **Step 5: Run** `timeout 600 nix develop -c npx vitest run src/lib/sheets` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look.** `$S/tools/cleanup-refresh.py`: (a) on a lesson, open "Link a figure", hold the `?/linkFigure` response 1.5 s (`page.route` → `route.continue()` after a wait), tap a row's +, press Escape at once; after 3 s the lesson's Figures list shows that figure. (b) Same with a New exercise sheet on Today: Save, Escape at once; the exercise is listed after 3 s. (c) On a figure with a recording: open it full screen, rename a section in the editor, press Escape twice; the figure page's section list shows the new name. Print pass/fail for each, screenshot the end states in light and dark, then undo what the script made (unlink, archive the exercise, rename back).
- [ ] **Step 7: Commit** `fix(sheets): a refresh waits for a closing sheet's history, and Sheet and Dialog refresh after a send`.

### Task 4: Colours come from the builders

**Files:**
- Modify: `src/lib/components/ui/styles.ts`, `src/lib/components/ui/styles.spec.ts`
- Create: `src/lib/components/ui/class-rules.spec.ts`
- Modify (call sites): `src/routes/[dance]/figures/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/lib/components/exercises/SetList.svelte`, `src/lib/components/today/ExerciseRow.svelte`, `src/lib/components/today/PastDay.svelte`, `src/lib/components/lessons/VideoSections.svelte`, `src/lib/components/links/LinkPopup.svelte`, `src/lib/components/links/LinksEditor.svelte`, `src/lib/components/links/YouTubeCard.svelte`, `src/lib/components/picker/Picker.svelte`, `src/lib/components/picker/PickerField.svelte`, `src/lib/components/ui/VideoFrame.svelte`, `src/lib/components/exercises/LogShell.svelte`, `src/routes/dev/kit/+page.svelte`, and any Practice component the scan names

**Interfaces:**
- Produces, in `styles.ts`:
  - `type IconTone = 'ink' | 'muted' | 'accent' | 'accent-text' | 'danger' | 'done'`
  - `iconButton(variant: 'bare' | 'step', tone?: IconTone): string` and `iconButton(variant: 'tonal' | 'filled'): string` (overloads) — `tone` replaces the variant's `text-ink`; the tone classes are written out in a `Record<IconTone, string>` so Tailwind sees them.
  - `FIELD`: `aria-invalid:border-2` goes; invalid is `aria-invalid:border-danger aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)]` (looks 2 px, moves nothing).
  - `FIELD_INVALID` and `SELECT_INVALID`: `FIELD` / `SELECT` with `border-field-line` replaced by `border-danger shadow-[inset_0_0_0_1px_var(--color-danger)]` — for a field-shaped control that cannot carry `aria-invalid` (a `<button>`) or is marked by its owner.
  - `button()` is unchanged: no call site appends a colour, and its kinds already are the tones.

- [ ] **Step 1: Write the failing tests.** `styles.spec.ts`:
  ```ts
  const colours = (c: string) => c.split(' ').filter((x) => /^text-(ink|muted|accent|accent-text|danger|done|on-accent)$/.test(x));
  it('one colour per icon button', () => {
    for (const t of ['ink', 'muted', 'accent', 'accent-text', 'danger', 'done'] as const) {
      expect(colours(iconButton('bare', t))).toEqual([`text-${t}`]);
      expect(colours(iconButton('step', t))).toEqual([`text-${t}`]);
    }
    expect(colours(iconButton('bare'))).toEqual(['text-ink']);
  });
  it('an invalid field keeps a 1 px border', () => {
    expect(FIELD).not.toMatch(/border-2/);
    for (const c of [FIELD_INVALID, SELECT_INVALID]) {
      expect(c.split(' ')).toContain('border-danger');
      expect(c.split(' ')).not.toContain('border-field-line');
      expect(c).not.toMatch(/border-2/);
    }
    expect(SELECT_INVALID.split(' ')).toContain('text-left');
  });
  ```
  `class-rules.spec.ts` (node `fs`, every `.svelte` and `.ts` under `src/` except specs and `styles.ts`), each a separate `it` that lists `file:line` on failure:
  1. no `/(iconButton|button)\([^)]*\)\s*\.replace\(\s*'text-/`;
  2. no builder output followed by a colour class in the same class string: `/(\{|\$\{)(iconButton|button)\([^)]*\)\}[^"\x60]*(?<![\w:-])text-(ink|ink-2|muted|accent|accent-text|danger|done|warn|status|on-accent|chevron)(?![\w-])/`;
  3. no `/(FIELD|SELECT|TEXTAREA)\.replace\(\s*'border/` (use the `_INVALID` constants);
  4. bare `text-accent` on text: a line with `/(?<![\w:-])text-accent(?![\w-])/` and any of `text-[`, `font-(medium|semibold|bold|extrabold)`, `underline`, `<mark` fails, unless listed in `const ICON_ONLY: Record<string, string> = {}` (`'file:substring': why`).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: FAIL (the builder tests; rule 1 at ~17 sites, rule 2 at `LinksEditor`, `YouTubeCard` ×3, `dev/kit` ×2; rule 3 at `PickerField`, `LogShell`; rule 4 at whatever Practice left).
- [ ] **Step 3: Implement** the builder changes as in Interfaces.
- [ ] **Step 4: Migrate** every site the spec names: `iconButton('bare').replace('text-ink', 'text-X')` → `iconButton('bare', 'X')`; `{iconButton('bare')} text-muted` → `{iconButton('bare', 'muted')}`; YouTubeCard's mirror toggle → `mirror ? iconButton('tonal') : iconButton('bare', 'muted')` (today its `text-accent-text` loses to `text-ink`: a visible fix); `ExerciseRow` → `iconButton('bare', band === 'doneToday' ? 'done' : 'accent')`; PickerField → `error ? SELECT_INVALID : SELECT`; LogShell → `FIELD_INVALID`. A bare `text-accent` on text becomes `text-accent-text`.
- [ ] **Step 5: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look.** `$S/tools/page.sh $S/shots/cleanup-4 /salsa /salsa/lessons/<id> /salsa/figures/<id> /dev/kit` — the muted ✕ / unlink buttons are muted (not ink), the review + accent, the mirror toggle tonal when on; and a refused Minutes box in the log popup (`logging-states.py`'s range-error state) and a PickerField in error (the lesson edit's frequency picker after a refused save) show the danger outline with the text where it was. Light and dark.
- [ ] **Step 7: Commit** `fix(ui): icon buttons take a tone, invalid fields a constant — no colour class fights a builder`.

### Task 5: Tokens — per-theme check, old aliases out, scrim and band track

**Files:**
- Modify: `src/lib/theme/stylesheet.spec.ts`, `src/lib/theme/tokens.ts`, `src/lib/theme/tokens.spec.ts`, `src/routes/layout.css`
- Modify: `src/lib/components/ui/Sheet.svelte`, `Dialog.svelte`, `UnsavedDialog.svelte` (their `::backdrop` rules go), `src/lib/components/ui/PlayerLayer.svelte`, `src/lib/components/ui/Segmented.svelte`, `src/routes/[dance]/+page.svelte` (the band chip), `src/lib/components/shell/PageSkeleton.svelte`
- Modify: any file still using an old alias class (the scan lists them)

**Interfaces:**
- Produces: `SCRIM = '#00000073'` (black at 45 %) beside `BAND_TRACK = '#00000026'` in `tokens.ts`; Tailwind colours `scrim` and `band-track` (`--color-scrim`, `--color-band-track` in `@theme`, the same in every theme).

- [ ] **Step 1: Write the failing tests** in `stylesheet.spec.ts`:
  - Per block: parse `--color-<name>: <value>;` pairs from four blocks of `layout.css` — salsa light `@theme {`, bachata light `[data-dance='bachata'] {` (the first, inside `@layer theme`), salsa dark `:root:not([data-theme='light']) {`, bachata dark `:root:not([data-theme='light']) [data-dance='bachata'] {` — and resolve each theme as the cascade does (salsa light; + bachata light; salsa light + salsa dark; salsa light + salsa dark + bachata dark). For every dance and scheme: `expect(pick(resolved, TOKEN_NAMES)).toEqual(THEMES[d][s])` (lower-cased). This replaces "carries every token value of every theme".
  - `it('defines none of the old names')`: none of `--color-plane:`, `--color-line:`, `--color-rule:`, `--color-done-bg:`, `--color-accent-ink:`, `--color-overdue:` in the CSS; and no `.svelte`/`.ts` under `src/` matches `/(?<![\w-])(bg|text|border|divide|ring|outline|fill|stroke|from|via|to|decoration|caret|placeholder|shadow)-(plane|line|rule|done-bg|accent-ink|overdue)(?![\w-])/` (print `file:line`). Delete "still defines the old names…".
  - `--color-scrim: #00000073;` and `--color-band-track: #00000026;` are in the `@theme` block and equal `SCRIM` / `BAND_TRACK`; the global `dialog::backdrop` rule's background is `SCRIM`; no file under `src/lib/components` or `src/routes` outside `components/video/` and `ui/VideoPlayer.svelte` contains `0 0 0 / 0.45`, `bg-black/45` or `bg-black/15` (over the picture the player keeps its own alphas — plan 11's call).
  - `tokens.spec.ts` `pairs` gains the Badge pairs: `['ink-2','chip']`, `['status','accent-soft']`, `['danger','danger-soft']`, `['surface','ink-2']`, `['on-accent','status']`, `['surface','warn']`, `['on-done','done']` (all pass today; the lowest is done on done-soft, light, 4.62).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/theme` — Expected: FAIL (the old names; scrim and band track missing). If the per-block test fails on a value, that is a real drift: fix `layout.css` to `tokens.ts`.
- [ ] **Step 3: Remove the aliases.** Every user the scan lists moves to the new name: `plane` → `ground`, `line` → `hairline`, `rule` → `field-line`, `done-bg` → `done-soft`, `accent-ink` → `on-accent`, `overdue` → `status`. Then delete the six alias lines from all five places in `layout.css` (`@theme`, bachata light, bachata dark, `.theme-media`, bachata `.theme-media`) and the comments that explain them.
- [ ] **Step 4: Scrim and band track.** `tokens.ts`: `SCRIM`, and `BAND_TRACK`'s comment now says Tailwind's `bg-band-track` uses it. `layout.css`: the two `@theme` lines; one unlayered rule after `body`: `dialog::backdrop { background: #00000073; }` with the comment "SCRIM, written out: `::backdrop` does not inherit custom properties in every engine the phone or the work PC may run." Delete the three components' `dialog::backdrop` rules; `PlayerLayer` `bg-black/45` → `bg-scrim`; `Segmented`, Today's band chip and `PageSkeleton` `bg-black/15` → `bg-band-track`.
- [ ] **Step 5: Run** `timeout 600 nix develop -c npx vitest run src/lib/theme` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look.** `$S/tools/page.sh $S/shots/cleanup-5 /salsa /salsa/figures /bachata /bachata/figures /settings /voice /salsa/player /dev/kit` and one open Sheet and one Dialog (`sheet.py`) — nothing changed colour against the previous shots of those pages (the aliases resolved to these same values), the scrim is as dark as before, the band chip and Moves' segmented track unchanged.
- [ ] **Step 7: Commit** `refactor(theme): check each theme block, drop the old aliases, scrim and band-track tokens`.

### Task 6: Foundation leftovers and parked minors

**Files:**
- Modify: `src/lib/icons/icons.spec.ts`
- Modify: `src/hooks.server.ts`; Delete: `static/icon-192.png`, `static/icon-512.png`
- Modify: `src/app.html`, `src/routes/+layout.svelte` (favicon)
- Modify: `src/lib/components/ui/Dialog.svelte`, `src/lib/components/ui/Sheet.svelte`, `src/lib/components/ui/PlayerLayer.svelte` (padding, fade)
- Modify: `src/lib/components/ui/Icon.svelte` (`stroke`), `src/lib/components/ui/HeroCard.svelte` (`disc`), `src/lib/components/exercises/FrequencyField.svelte`, plus the stroke sites below
- Modify: `src/lib/components/ui/Segmented.svelte` (generic), `src/lib/components/moves/MovesScreen.svelte`
- Modify: `src/lib/components/ui/Stepper.svelte`

**Interfaces:**
- Produces: `Icon` prop `stroke?: number` (default 2); `Segmented` is `generics="T extends string"` — `items: readonly { value: T; label: string }[]`, `value: T`, `onchange?: (value: T) => void`; `Stepper`'s input reads "Tempo, 120 BPM" (`aria-label={label}`, `aria-valuetext={unit ? \`${value} ${unit}\` : undefined}`).

- [ ] **Step 1: Write the failing tests.** `icons.spec.ts`: replace the `>= 72` count (it counted aliases) with — every name in kit.py's icon table (read `docs/superpowers/design-kit/kit.py`, the keys `^\s+'([a-z0-9-]+)':` between `ICONS = {` and its closing `}`) is a key of `ICONS`; and `Object.keys(ICONS).filter((n) => !(n in ALIASES)).length` equals the number of distinct markups (`new Set(Object.values(ICONS)).size`, no two canonical icons draw the same thing).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/icons` — Expected: FAIL only if a kit icon is missing (then add it from kit.py) or two canonical names share markup (then make one an alias); otherwise it passes on first run — record that.
- [ ] **Step 3: PUBLIC_PATHS.** `static/icon-192.png` and `static/icon-512.png` exist but nothing references them (phase-1 leftovers; the manifests use `/icons/<dance>-*.png`): `grep -rn "icon-192\|icon-512" src static android docs/deployment.md` → only `hooks.server.ts`. Delete both files and both entries. The `assetlinks.json` comment becomes: "The APK's signing-key fingerprint (docs/deployment.md). The WebView app (since 2026-10-29) does not read it; Chrome still may."
- [ ] **Step 4: Favicon.** Drop the `<link rel="icon">` from `app.html`; the root `+layout.svelte` adds `<svelte:head><link rel="icon" href="/icon-{navDance.slug}.svg" type="image/svg+xml" /></svelte:head>` (flat pages show the last dance's, as their accent does).
- [ ] **Step 5: Header padding.** No two utilities on one element may set the same side (Tailwind 4 orders utilities by property, so the class list's order decides nothing). Sheet header: `px-4` + `class:pl-2={back}` → `pr-4 {back ? 'pl-2' : 'pl-4'}`. Dialog card: `px-6 pt-6 pb-4` → `pt-6 pr-5 pb-4 pl-6` (kit `dialog`: `padding: 24px 20px 16px 24px`). Check the same pattern in `PlayerLayer`'s header.
- [ ] **Step 6: The fade over the scrollbar.** Sheet's `.fade` and PlayerLayer's fade move inside the scrolling body as its last child, `position: sticky; bottom: 0; margin-top: -28px` (same height and gradient), so they cover the content but never the scrollbar.
- [ ] **Step 7: Strokes.** `Icon` gets `stroke` (applied to `stroke-width`; ignored when filled). Use it where the board draws a heavier check: HeroCard's done check (28, 2.6), `FrequencyField`'s chosen check (22, 2.6), the song page's "Got it" check (2.6), LogShell's "Logged" check (2.5); `grep -n "stroke=2\.[0-9]" docs/superpowers/design-kit/screens/*.py` lists the rest — apply each whose element exists, list them in the commit.
- [ ] **Step 8: Types and labels.** HeroCard's `disc` snippet takes one object `{ tone, knockout?, nudge?, glyph, size, filled, stroke? }` (it took six positional arguments). `Segmented` generic as in Interfaces; `MovesScreen`'s `value` is `$derived<MovesSegment>(segment)` and `open(to: MovesSegment)`. `Stepper` labels as in Interfaces.
- [ ] **Step 9: Run** `timeout 600 nix develop -c npx vitest run src/lib/icons` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look.** `$S/tools/page.sh $S/shots/cleanup-6 /dev/kit /salsa /bachata` plus `sheet.py` for a sheet with and without back, a dialog, and a tall sheet scrolled to the middle on desktop width (`W=1280 H=800`, Chromium shows a classic scrollbar there): header and title insets match the kit (title 20 px from the sheet's edge without back; back button 8 px), the dialog's right inset 20 px, the fade stops at the scrollbar. Print `document.querySelector('link[rel=icon]').href` on `/bachata` → `/icon-bachata.svg`. Light and dark.
- [ ] **Step 11: Commit** `fix(ui): the foundation's leftovers — icons spec, public paths, favicon, header insets, fade, strokes, types`.

### Task 7: Housekeeping and the docs

**Files:**
- Modify: `src/lib/nav/bands.spec.ts` (`PENDING`)
- Move: `src/lib/components/routines/act.ts` → `src/lib/act.ts` (and every import)
- Move: `plural` from `src/lib/moves/plural.ts` into `src/lib/format.ts` (+ `format.spec.ts`); delete `moves/plural.ts`; `src/lib/exercises/today.ts` drops its private copy
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-31-redesign-design.md`, `docs/superpowers/plans/2026-10-31-redesign-foundation.md` (one line under its Cleanup bullet: "Done in plan 13.")

- [ ] **Step 1: `PENDING`.** Empty `bands.spec.ts`' `PENDING` (plan 12 left it for pages not yet redrawn; all are now). Run `timeout 600 nix develop -c npx vitest run src/lib/nav/bands.spec.ts` — Expected: PASS; a page it names is a bug: fix it if it is a missing `Screen`, else put it under Late items.
- [ ] **Step 2: Moves.** `git mv` `act.ts` to `src/lib/act.ts`, update imports (`grep -rln "routines/act" src`). Add `plural(n: number, one: string, many: string): string` to `format.ts` with the tests from wherever `plural` is tested today (else: `plural(1,'set','sets')` → `'1 set'`, `plural(0,…)` → `'0 sets'`), switch the ten importers, delete `moves/plural.ts`, and `today.ts` imports it. Run `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 3: CLAUDE.md, Layout.** Find the drift:
  ```sh
  for d in $(ls -d src/lib/*/ src/lib/components/*/ | sed 's#/$##'); do grep -q "${d#src/}" CLAUDE.md || echo "not in CLAUDE.md: $d"; done
  for f in src/lib/*.ts src/lib/*/*.ts; do case $f in *.spec.ts) continue;; esac; grep -q "$(basename "$f")" CLAUDE.md || echo "unnamed: $f"; done
  ```
  Then read each `src/lib/` entry against `ls` and fix what is stale. It must at least say: `src/lib/nav/` — tabs.ts, band.ts, pending.ts, error-view.ts, and `bands.spec.ts` (every page draws a band); `src/lib/theme/` — tokens.ts with `BAND_TRACK` and `SCRIM`, contrast.ts, the per-block stylesheet spec; `src/lib/icons/`; `src/lib/voice/` — back.ts and the rest plan 12 added; `src/lib/sheets/` — `settled`, `refreshWhenSettled`, `refreshIfSent` (Sheet and Dialog refresh after a send); `src/lib/components/ui/styles.ts` — the class builders: `button(kind, size, full)`, `iconButton(variant, tone)`, `FIELD`/`TEXTAREA`/`SELECT` and their `_INVALID` constants, `CHIP`, `GROUP` and `CLIP` (`focus-inset`); `src/lib/focus.ts` — where focus goes after a removal; `src/lib/act.ts`; `format.ts`'s `plural`. Every new name in the "unnamed" output either gets a line or is covered by the `src/lib/*.ts` catch-all.
- [ ] **Step 4: CLAUDE.md, Live and Hard rules.** Add to the "Live:" sentence, before the spec links: "and the redesign (the band and four tabs — Today, Moves, Lessons, Music — one look in four themes from `tokens.ts`, the shared components in `components/ui/`, designed error pages)". Hard rules gain four short bullets: **A colour on a built control is the builder's** (`iconButton(variant, tone)`, `FIELD_INVALID`; `class-rules.spec.ts` enforces it; why: Tailwind 4 orders by property); **A card that clips uses `GROUP` or `CLIP`** so rows draw their ring inside (`focus-clip.spec.ts`); **After a one-tap removal, focus goes to the next row** (`focusAfterRemoval`, `src/lib/focus.ts`); **A refresh after a sheet or the player closes goes through `refreshWhenSettled()`** (SvelteKit drops a reload a popstate overtakes).
- [ ] **Step 5: The redesign spec.** A status line under the title: "Built on branch `app-icons`, 2026-10-31 (plans 1–13 in `docs/superpowers/plans/2026-10-31-redesign-*.md`)." "Components and states" → Focus: "Inside a card that clips (a group of rows), the ring and halo draw inside the control; a filled control there keeps the outside ring." and a new bullet: "**After a removal:** focus goes to the next row, else the previous, else the list's add control or heading; a dismissed banner hands focus to what follows it." Its "Calls made while writing this" gains this plan's first four calls, one line each.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS. Then one last sweep: `$S/tools/page.sh $S/shots/cleanup-7 /salsa /salsa/figures /salsa/routines /salsa/lessons /salsa/songs /settings /bachata /bachata/figures /bachata/lessons /bachata/songs` and compare with each area plan's final shots — nothing reverted.
- [ ] **Step 7: Commit** `docs: CLAUDE.md and the redesign spec describe what the redesign built; tidy moves`.

### Task 8: Late items

Reserved for what the last plans' final reviews add. Each item: file, fix, check.

---

## Calls made in this plan

- **Inset rings, not an unclipped GROUP.** Dropping `overflow-hidden` would need every row's background (picked, pressed, `bg-accent-soft`, a swipe's red) rounded at the first and last row — including rows whose background sits on an inner link — and an outside ring between rows would still cross the hairline into its neighbour. An inset ring needs one CSS rule and a class on the container, and Picker and SongPicker already used it. Cost: inside a card the ring sits on the row, not around it, unlike controls elsewhere.
- **`focus-out` for a filled control inside a card**, since an inset accent ring vanishes on an accent fill. None may exist; the step lists any found.
- **`CLIP` plus a source scan with a reasoned allowlist** rather than a lint rule: a line with `overflow-hidden` must carry `focus-inset` or say why not. Cost: a multi-line class string with `overflow-hidden` on a line of its own needs `focus-inset` on that line.
- **Focus after a removal: next, else previous, else the list's add control or heading.** The brief said "next, else heading or add"; the previous row is added because removing the last row is the common case (delete the set just logged). Focus moves only when it was lost (on `<body>`), so a pointer user's focus is never moved and no ring appears for them.
- **Banner finds its own target** (the next focusable after it), so every dismissible banner is fixed with no prop. **Toasts are left alone:** a toast lives 4–6 s at the end of the page; a keyboard user who presses its Undo gets the restored row back but focus on `<body>`. Cost: one Tab from the top. Late item if a review disagrees.
- **Sheet and Dialog refresh after a send by themselves**, from a capture-phase `submit` listener, instead of an audit that adds code to some thirty hosts. Cost: one extra page load after a sheet in which something was sent closes (the data is the same; the single-user server does not notice). The player's layers are excluded (they save through `/api/video-spots`); the player's close refreshes through `refreshWhenSettled()` at its four hosts. Positions' reload-then-close is kept: it is already safe.
- **`tone` on `iconButton` only.** `button()` has no call site that appends a colour, and its kinds are its tones; the size `.replace('h-11 w-11', …)` calls stay (they replace, they do not append).
- **Invalid fields: a 1 px border plus a 1 px inset danger shadow** instead of `border-2`. While such a field has focus, the global ring's halo replaces the inset shadow (the border stays danger). Cost: the outline reads 1 px while focused.
- **The bare-`text-accent` check is a heuristic** (a font size, weight, `underline` or `<mark>` on the same line means text). An icon wrapper styled with a font class would be flagged and goes in `ICON_ONLY` with its reason.
- **The scrim is written out in one global `::backdrop` rule** (custom properties did not reach `::backdrop` in older engines) and is also `--color-scrim` for `bg-scrim`; both are pinned to `SCRIM` by the spec. `BAND_TRACK` becomes `bg-band-track`; the player's over-the-picture alphas stay (plan 11's call).
- **`static/icon-192.png` and `icon-512.png` are deleted:** the foundation's note said they do not exist; they do, but nothing has referenced them since the per-dance icons. `assetlinks.json` stays public with a corrected comment.
- **"Dialog/Sheet header padding order" is read as two things:** the Sheet header set `px-4` and `pl-2` together (which wins is Tailwind's property order, not the class order), and the Dialog's right inset was 24 px against the kit's 20. Both fixed; if the foundation's reviewer meant something else, it is a Late item.
- **The favicon follows `navDance`** in the root layout, so flat pages (Settings, My count) show the last dance's icon, as their accent already does.
- **Stepper speaks "Tempo, 120 BPM"** through `aria-valuetext`; the label alone was "Tempo (BPM)" and the value was read without a unit.
- **Heavier strokes only where the board draws them** (2.5–2.6 on a handful of checks); `Icon`'s default stays 2.
- **`act.ts` moves to `src/lib/act.ts` and `plural` into `format.ts`** — the calls the Moves and system plans left to Cleanup; `today.ts`' private copy of `plural` goes with it.
- **Badge pairs are added to the contrast test as they are:** all pass today (lowest: done on done-soft, light, 4.62:1).
- **Not done here — for the user:** a long name in a session header wraps to four lines (the Today session's header). It needs a design call (clamp at two lines with an ellipsis, or a smaller size), not a cleanup.

Items added by the controller after plans 8, 10, 11 and 12 landed:

- [ ] **Player Back during "Unlink …?"** (`src/lib/components/links/LinkPopup.svelte`, the question inside the full-screen player): hardware Back closes the links level too, not just the question. Give the question its own player history level (or make Back cancel only the question). Check: open the Link popup in the player, open "Unlink …?", press Back — only the question closes.
- [ ] **Practice Play focus fallback** (`src/lib/components/player/Setup.svelte` `focusPlay`): a no-op when Play is disabled (no song picked or it failed to load); fall back to the Setup heading. Check once in a browser that focus lands on Play (or the heading) after Stop → Don't save.
- [ ] **A 5xx message in a refusal** (`src/routes/[dance]/figures/[id]/+page.server.ts` around the `fail(e.status, …)`): clamp a status ≥ 500 to a generic "Couldn’t save. Try it again." Check: a spec, or read it.
- [ ] **Settings and My count share one refusal/undo-toast shape**: `failed()`/`refused()` and the "… removed · Undo" toast are written twice (`src/routes/settings/+page.svelte`, `src/routes/voice/+page.svelte`) — one small helper; and the cookie → dance rule in the Settings and login loads uses the root layout's `lastDance` instead. Check: `npm run check`.
- [ ] **`.replace()` on builder output fails silently** when the token is missing: Task 4's builder options cover most callers; for the rest, a `swap(cls, from, to)` that throws in dev. Check: a spec.
