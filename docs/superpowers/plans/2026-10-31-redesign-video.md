# Redesign: the full-screen video player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the full-screen video player — all three levels, the trim
strip, the lists, Rename / Delete / Keys, the toasts, every layout — in the
redesign's media palette, drawn from the same tokens as the site, keeping
every feature it has today.

**Architecture:** The player's `<dialog>` carries `.theme-media` (plan 8's
scope that re-declares the colour tokens with the kit's media palette), so
every player component uses the site's token classes (`bg-surface`,
`text-accent-text`, …) and the private `--pl-*` palette retires. What the
screens decide without a DOM — which parts the top bar shows per layout and
level, what a link entry says, the delete sheet's copy, the toast's icon and
place, whether the buffering spinner shows — goes into a new pure
`src/lib/video/chrome.ts` with a spec. The existing pure modules in
`src/lib/video/` are not touched. The player's buttons come from a small
builder module (`components/video/styles.ts`, rewritten) and its icons from
the shared set (`ui/Icon.svelte`).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node), Playwright screenshots via the scratchpad tools.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "The
full-screen video player" (binding), "Building it" (the player keeps its own
always-dark palette, the `media` theme, drawn from the same tokens) and "Calls
made while writing this" (desktop layouts and the "?" key list restyled with
the same tokens, layout unchanged). Behaviour:
`docs/superpowers/specs/2026-10-01-video-player-design.md` (three levels,
0.1 s steps, the trim strip, delete that asks and undoes, Back up one level,
pinch zoom, double-tap jumps, screen kept on, portrait / landscape / desktop,
0.25–1×, mirror, saved points and sections; why it is not the browser's
fullscreen). Board source: `docs/superpowers/design-kit/screens/video.py`
(media palette: `kit.py` `_media`); previews `$S/previews/s-video-0.png` …
`s-video-4.png` and the crops `s-video-c2.png` … `s-video-c4.png`, where
`S=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.

**This is plan 11 of 13.** All plans land on branch `app-icons`, deployed
once when the last plan is done. It builds on the foundation (plan 1) and on
plan 8 (pickers and the Link popup), which creates `MEDIA` in
`src/lib/theme/tokens.ts`, the `.theme-media` CSS scope and
`ui/PlayerLayer.svelte`. If plan 8 has not landed when a task here needs one of
them, that task creates it exactly as plan 8's Task 2 Interfaces say (quoted
in Task 2 below) and plan 8 then finds it done. Out of scope: the Link popup's
levels inside the player (`LinkPopup`, `LinkLevel`, `Picker` — plan 8), the
inline players (`VideoFrame`, `SectionPlayer`, `SectionCard` — figure, lessons
and logging plans).

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

- Every behaviour of the video-player spec survives unchanged: the three levels and their stack (`screens.ts`), one history entry per screen (`player-history.ts`), Esc / Back / leaving fullscreen go up one level, ✕ closes from anywhere, the loop only in a section's view or editor, the editor's Loop toggle per visit, 0.1 s steps that pause, ±1 s and whole-section moves that play the change, Now that sets without seeking, the trim strip's drag / tap-to-seek / still window, a drag writing once on release, the list not re-sorted while an editor is open, Delete asking (Keep it / Delete), a linked section's Delete disabled, a 409 shown in the sheet, Undo, rename never focusing by itself, Hide remembered, the row of sections, pinch / pan / Ctrl+wheel zoom and its Reset, double-tap jumps, the screen kept on, the keys, the four areas in one DOM order so rotating never remounts the video. The pure modules in `src/lib/video/` other than the new `chrome.ts` are not edited; their specs pass untouched.
- The player is always dark: its `<dialog>` carries `.theme-media`; no `dark:` variants inside it; at the end of this plan nothing in `src/` mentions `--pl-`.
- Over the picture (scrims, pills on the video, the timeline's track and bands, the glass line) colours are `black/<n>` and `white/<n>` alphas, the kit's values — the picture is not a theme surface. Everything else is a token class. The glass fill is `bg-surface/72` (media `surface` is the kit's glass base `#1c1c1f`).
- Small accent text is `text-accent-text`; bare `text-accent` only on icons, fills and bands. Never append a colour, font size or radius class after a builder's output (`playerButton`, `roundButton`, `button`, `iconButton`) — the builder's own class can win by CSS order: pick the builder's variant, use `.replace(…)`, or write the classes out.
- Time readouts: the big ones (26 px, 20 px) are `font-display` 800 with `tabular-nums`; every other time is Manrope with `tabular-nums`.
- The 36 / 40 px pills and discs of the board (Edit, Loop, speed, mirror, glass close) sit inside a 44 px hit area.
- Desktop (`layout === 'desktop'`) keeps its grid, sidebar, expanded editor card and key legend exactly where they are; only colours, type and buttons change.
- Rename stays a plain `<form onsubmit>` inside the player, not `use:guarded` (see "Calls made"); the Link popup's own components are plan 8's and are not edited here.

**Screenshots.** The player is not a URL, so each task scripts it: copy
`$S/tools/page.py` to `$S/tools/video-states.py` (first task that needs it) and
run it the way `$S/tools/page.sh` runs `page.py` (same `nix shell` line). It
opens `/salsa/figures/1` (recording 1, a video with three sections), clicks
`[aria-label="Full screen"]`, waits 800 ms, acts, and screenshots — once per
dance (the player has no light/dark pair; use `color_scheme='dark'`), at
390×844, and where a task says so at 844×390 and 1280×800. Bachata: once,
upload `.data/recordings/32f582d5-8853-4e08-8214-0e0878710218.mp4` to a
bachata figure (`pg.request.post(B + '/api/figures/4/recordings', data=…,
headers={'content-type': 'video/mp4'})`) and use that figure's page; it starts
with no spots, which is the "Nothing marked" state. Rename spot 1 (salsa) to
"Dile que no con vuelta · Doble con mano" through the player's Rename once,
and link spot 2 to a figure (the figure page's "Link a section", or the
player's Link entry) so the linked states show. Failures: `pg.route('**/api/video-spots?*', lambda r: r.abort())`
(load) and a `PATCH`/`POST` abort (save). The dev server on
http://localhost:20000 serves this worktree; never start another. Compare each
screenshot with the board crop named in the step.

## Review Focus

1. **A linked section can never be deleted from the player:** Delete is disabled and a warning banner says what it is linked to; a 409 that slips through shows in the sheet as an error banner and the section stays — pinned by `deleteCopy` tests (Task 1) and the delete-linked screenshot plus a forced-409 check (Task 5).
2. **No level strands the user on a phone:** every section view shows ‹ Full video, every editor Done and Delete, every layout ✕ — pinned by the `topBar` table test over every mode × level (Task 1) and the Back walk in Task 6.
3. **Rotating with a level open keeps the video playing where it was:** portrait editor → 844×390 → back, the same `<video>` node, `currentTime` within 0.3 s — pinned by the scripted check in Task 6.
4. **Long names never push Mirror and Speed off:** a 38-character title and section label truncate in the top bar, the chips, the editor head, the list and the delete sheet — pinned by the long-name screenshots in Tasks 3, 5 and 6.
5. **The buffering spinner never sticks:** it shows only between `waiting` and the next `playing` / `canplay` / `seeked` / `pause` / `error` / `emptied` — pinned by the `buffering` reducer tests (Task 1) and the delayed-video screenshot (Task 3).

---

### Task 1: The player's screen rules, pure

**Files:**
- Create: `src/lib/video/chrome.ts`
- Test: `src/lib/video/chrome.spec.ts`

**Interfaces:**
- Consumes: `spotLabel`, `spotTime`, `preciseTime`, `lengthText`, `linkSummary` (`spots.ts`); `PlayerLayout` (`layout.ts`); `Spot` (`$lib/types`); `IconName` (`$lib/icons/icons`); `VideoRate` (`$lib/video-prefs`).
- Produces:
  - `type PlayerMode = 'portrait' | 'overlay' | 'panel' | 'desktop'`; `type LevelKind = 'full' | 'section' | 'edit'`.
  - `playerMode(layout: PlayerLayout, level: LevelKind, listOpen: boolean): PlayerMode` — today's inline `mode` in `VideoPlayer.svelte`, moved: portrait → `portrait`, desktop → `desktop`, landscape → `panel` when `level === 'edit' || listOpen`, else `overlay`.
  - `type TopBarParts = { glass: boolean; back: boolean; title: boolean; sub: 'subtitle' | 'looping'; edit: 'accent' | 'glass' | null; sections: boolean }`; `topBar(mode: PlayerMode, level: LevelKind): TopBarParts`.
  - `cornerBadge(rate: VideoRate, mirror: boolean): string` — today's inline `badge`: `'0.5× · Mirrored'`, `'0.75×'`, `'Mirrored'`, `''`.
  - `type LinkEntry = { kind: 'none' } | { kind: 'show'; text: string } | { kind: 'open'; text: string; label: string; invite: boolean }`; `linkEntry(linkedTo: string[], linking: boolean, where: 'badge' | 'editor'): LinkEntry`.
  - `editorSub(spot: Spot): string` (SpotEditor's inline `sub`, moved); `listMeta(spot: Spot): string` (SpotList's inline `sub`, moved); `spotLine(spot: Spot): string` — a section `0:12.4–0:16.0 · 3.6 s`, a point `Point at 1:38.50`.
  - `deleteCopy(spot: Spot): { title: string; sub: string; body: string | null; blocked: { title: string; body: string } | null }`.
  - `type ToastTone = 'saved' | 'deleted' | 'failed' | 'note'`; `TOAST_ICON: Record<ToastTone, IconName | null>`; `toastPlace(mode: PlayerMode, level: LevelKind): 'video' | 'bottom'`.
  - `type MediaEvent = 'waiting' | 'playing' | 'canplay' | 'seeked' | 'pause' | 'error' | 'emptied'`; `buffering(now: boolean, event: MediaEvent): boolean`.

- [ ] **Step 1: Write the failing tests** in `chrome.spec.ts`:

```ts
const sec = (o: Partial<Spot> = {}): Spot => ({ id: 1, startMs: 64000, endMs: 71200, label: 'Enchufla doble', linkedTo: [], ...o } as Spot);
const pt = sec({ startMs: 98500, endMs: null, label: 'Hand change' });

it('picks the mode as the player always has', () => {
  expect(playerMode('portrait', 'edit', true)).toBe('portrait');
  expect(playerMode('landscape', 'full', false)).toBe('overlay');
  expect(playerMode('landscape', 'section', false)).toBe('overlay');
  expect(playerMode('landscape', 'full', true)).toBe('panel');
  expect(playerMode('landscape', 'edit', false)).toBe('panel');
  expect(playerMode('desktop', 'edit', false)).toBe('desktop');
});
it.each([
  ['portrait', 'full',    { glass: false, back: false, title: true,  sub: 'subtitle', edit: null,     sections: false }],
  ['portrait', 'section', { glass: false, back: true,  title: false, sub: 'subtitle', edit: 'accent', sections: false }],
  ['portrait', 'edit',    { glass: false, back: false, title: true,  sub: 'subtitle', edit: null,     sections: false }],
  ['overlay',  'full',    { glass: true,  back: false, title: true,  sub: 'subtitle', edit: null,     sections: true }],
  ['overlay',  'section', { glass: true,  back: true,  title: true,  sub: 'looping',  edit: 'glass',  sections: false }],
  ['panel',    'edit',    { glass: false, back: false, title: true,  sub: 'subtitle', edit: null,     sections: false }],
  ['panel',    'full',    { glass: false, back: false, title: true,  sub: 'subtitle', edit: null,     sections: false }],
  ['desktop',  'section', { glass: false, back: false, title: true,  sub: 'subtitle', edit: null,     sections: false }],
] as const)('top bar in %s at %s', (mode, level, parts) => expect(topBar(mode, level)).toEqual(parts));
it('says speed and mirror on the corner badge', () => {
  expect(cornerBadge(0.5, true)).toBe('0.5× · Mirrored');
  expect(cornerBadge(1, true)).toBe('Mirrored');
  expect(cornerBadge(0.75, false)).toBe('0.75×');
  expect(cornerBadge(1, false)).toBe('');
});
it('words the link entry', () => {
  expect(linkEntry([], true, 'badge')).toEqual({ kind: 'open', text: 'Link', label: 'Link this section', invite: true });
  expect(linkEntry(['A', 'B'], true, 'badge')).toEqual({ kind: 'open', text: 'A +1', label: 'Links: A, B', invite: false });
  expect(linkEntry(['A', 'B'], false, 'badge')).toEqual({ kind: 'show', text: 'A +1' });
  expect(linkEntry([], false, 'badge')).toEqual({ kind: 'none' });
  expect(linkEntry([], true, 'editor')).toEqual({ kind: 'open', text: 'Link to a figure or drill', label: 'Link to a figure or drill', invite: true });
  expect(linkEntry(['A', 'B'], true, 'editor')).toEqual({ kind: 'open', text: 'Linked to A +1', label: 'Links: A, B', invite: false });
  expect(linkEntry(['A', 'B'], false, 'editor')).toEqual({ kind: 'show', text: 'Linked to A, B' });
});
it('keeps the second lines', () => {
  expect(editorSub(sec())).toBe('1:04.0–1:11.2 · 7.2 s');
  expect(editorSub(sec({ label: null }))).toBe('7.2 s');
  expect(editorSub(pt)).toBe('Point at 1:38.50');
  expect(listMeta(sec())).toBe('1:04.0–1:11.2 · 7.2 s');
  expect(listMeta(sec({ label: null }))).toBe('7.2 s');
  expect(listMeta(pt)).toBe('1:38.5 · point');
  expect(spotLine(sec({ label: null }))).toBe('1:04.0–1:11.2 · 7.2 s');
  expect(spotLine(pt)).toBe('Point at 1:38.50');
});
it('asks before a delete, and refuses a linked section', () => {
  expect(deleteCopy(sec())).toEqual({ title: 'Delete “Enchufla doble”?', sub: '1:04.0–1:11.2 · 7.2 s',
    body: 'The section goes from this video. You can undo it for a few seconds.', blocked: null });
  expect(deleteCopy(pt).body).toBe('The point goes from this video. You can undo it for a few seconds.');
  expect(deleteCopy(sec({ linkedTo: ['Enchufla · Doble', 'Count drill'] }))).toMatchObject({ body: null,
    blocked: { title: 'Linked to Enchufla · Doble, Count drill', body: 'Unlink it there first; until then this section stays.' } });
});
it('places and marks toasts', () => {
  expect(TOAST_ICON).toEqual({ saved: 'check-circle', deleted: 'trash', failed: 'warning', note: null });
  expect(toastPlace('portrait', 'edit')).toBe('video');
  for (const [m, l] of [['portrait', 'full'], ['portrait', 'section'], ['overlay', 'full'], ['panel', 'edit'], ['desktop', 'edit']] as const)
    expect(toastPlace(m, l)).toBe('bottom');
});
it('shows the buffering spinner only while the video waits', () => {
  expect(buffering(false, 'waiting')).toBe(true);
  for (const e of ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied'] as const) expect(buffering(true, e)).toBe(false);
  expect(buffering(false, 'seeked')).toBe(false);
});
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/video/chrome.spec.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement `chrome.ts`.** A header comment: what the player's screens show, decided without a DOM; PURE, client-safe. `listMeta` and `editorSub` keep the existing bodies (and their comments) from `SpotList.svelte` / `SpotEditor.svelte` — they are moved in Tasks 5 and 6, not here. `linkEntry`'s summary is `linkSummary`; the `show` text in the editor joins all labels (as the editor does today when it may not link).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(video): the player's screen rules as pure functions`.

### Task 2: The media palette on the player, its buttons and its toast

**Files:**
- Modify (only if plan 8 has not landed them): `src/lib/theme/tokens.ts`, `src/lib/theme/tokens.spec.ts`, `src/routes/layout.css`, `src/lib/theme/stylesheet.spec.ts`
- Modify: `src/lib/components/video/styles.ts` (rewritten)
- Test: `src/lib/components/video/styles.spec.ts`
- Modify: `src/lib/components/video/Toast.svelte`, `src/lib/components/ui/VideoPlayer.svelte` (the dialog's class, `say`, the toast's place)

**Interfaces:**
- Consumes (plan 8, Task 2, verbatim): "`MEDIA: Record<DanceSlug, Theme>` — `THEMES[d].dark` with `ground: '#000000'`, `raised: '#1c1c1f'`, `ink: '#ffffff'`, `'ink-2': mix('#ffffff', '#1c1c1f', 0.82)`, `muted: mix('#ffffff', '#1c1c1f', 0.64)`, `hairline: mix('#ffffff', '#1c1c1f', 0.16)`"; "CSS: `.theme-media { … }` with every `--color-<name>` of `MEDIA.salsa`, `color-scheme: dark`, `--icon-knockout: var(--color-surface)`; `[data-dance='bachata'] .theme-media { … }` with bachata's dance tokens". `TOAST_ICON`, `ToastTone`, `toastPlace`, `playerMode` (Task 1). `Icon` (`ui/Icon.svelte`).
- Produces:
  - `type PlayerButtonKind = 'neutral' | 'accent' | 'ghost' | 'glass' | 'outline' | 'danger-text'`;
    `playerButton(kind: PlayerButtonKind, size: 'sm' | 'md' | 'lg' | 'xl' | 'cta' = 'lg', shape: 'pill' | 'tile' = 'pill'): string` — sizes `sm` `h-9 px-3 text-[13px]`, `md` `h-11 px-3 text-[14px]`, `lg` `h-12 px-4 text-[15px]`, `xl` `h-[52px] px-1 text-[15px]`, `cta` `h-[52px] px-9 text-[16px]`; `pill` `rounded-full`, `tile` `rounded-2xl`. Base: `inline-flex flex-none cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-sans font-extrabold tabular-nums select-none transition-colors disabled:cursor-default`. Kinds: neutral `bg-step text-ink active:brightness-90 disabled:bg-disabled-bg disabled:text-disabled-ink`; accent `bg-accent text-on-accent active:brightness-90 disabled:bg-disabled-bg disabled:text-disabled-ink`; ghost `text-ink active:bg-step disabled:text-disabled-ink`; glass `bg-surface/72 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] active:bg-surface`; outline `text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)] active:bg-step disabled:text-disabled-ink`; danger-text `text-danger active:opacity-60 disabled:text-disabled-ink`.
  - `roundButton(kind: 'neutral' | 'accent' | 'glass' | 'ghost', size: 44 | 48 | 54 | 56 | 58 | 66 | 78): string` — `flex flex-none cursor-pointer items-center justify-center rounded-full font-sans font-extrabold tabular-nums whitespace-nowrap select-none` + `size-11` / `size-12` / `size-[54px]` / `size-14` / `size-[58px]` / `size-[66px]` / `size-[78px]` + the kind's colours as above (glass and ghost included). **No font size**: the caller adds `text-[13px]` or `text-[14px]`.
  - `ON_VIDEO = 'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full bg-black/60 px-2.5 text-[12.5px] tabular-nums'` — the caller adds `font-bold text-white/92`, or `font-extrabold text-accent-text` for an invite.
  - `<Toast text: string tone: ToastTone actions?: { label: string; run: () => void }[] />`.
  - In `VideoPlayer`: `say(text: string, tone: ToastTone, ...actions: ToastAction[])`.
  - Icon names for every player icon from here on (old `icons.ts` key → shared name): close→`close`, mirror→`mirror`, play→`play` (filled), pause→`pause` (filled), flag→`flag`, bracket→`scissors`, loop→`repeat`, pencil→`edit`, trash→`trash`, link→`link`, check→`check`, chevronLeft/Right/Up/Down→`chevron-left`/`-right`/`-up`/`-down`, list→`list`; `startEdge` and `endEdge` are dropped (the board's Start / End carry no glyph). Colour an icon through its parent's text colour (`ui/Icon` has no `class`).

- [ ] **Step 1: If `MEDIA` is not in `tokens.ts`,** do plan 8's Task 2 Steps 1–3 exactly (its tests, `MEDIA`, the two CSS blocks with their comment) and note in the commit body that plan 8's Task 2 now only adds `PlayerLayer`. Either way, add to `tokens.spec.ts` (if not there) a check that on `MEDIA[d]` for both dances `accent-text`/`ground`, `muted`/`ground`, `inverse-accent`/`inverse-bg` and `on-accent`/`accent` reach 4.5 and `disabled-ink`/`disabled-bg` is defined.
- [ ] **Step 2: Write the failing test** `styles.spec.ts`: for every kind × size × shape of `playerButton` and every kind × size of `roundButton`, the output contains no `--pl-` and no `#`; `playerButton('accent')` contains `bg-accent` and `text-on-accent`; `playerButton('glass')` contains `bg-surface/72`; `playerButton('neutral', 'xl', 'tile')` contains `rounded-2xl` and not `rounded-full`; `playerButton('neutral')` contains `disabled:bg-disabled-bg`; `roundButton('accent', 66)` contains `size-[66px]`; no `roundButton` output contains `text-[`; `ON_VIDEO` contains `bg-black/60` and no `text-white`.
- [ ] **Step 3: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/video/styles.spec.ts src/lib/theme` — Expected: FAIL (new exports missing).
- [ ] **Step 4: Rewrite `styles.ts`** with the Interfaces' exports and a header comment (the player is always dark because its dialog carries `.theme-media`; builders carry colour, so append nothing that sets colour, size or radius). Keep the old `BTN*` exports for now, re-pointed at `playerButton` equivalents (`BTN` = neutral md tile-less, `BTN_ACCENT` = accent md, `BTN_GHOST` = ghost md, `BTN_OUTLINE` = outline md, `BTN_DANGER` = danger-text md, `BTN_DANGER_FILL` = `button('danger', 'sm')` classes, `BTN_ON_VIDEO` = glass md) so unconverted components keep working; Task 7 deletes them.
- [ ] **Step 5: The player's dialog.** `class="player theme-media"`; the `<style>` `.player` background becomes `var(--color-ground)` and drops `color-scheme` (the scope sets it); `::backdrop` stays `black`. The `--pl-*` `style={tokens}` stays until Task 7.
- [ ] **Step 6: Toast** (board `toast`): `role="status"`, `flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-inverse-bg py-1 pl-4 text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.5)]`, `pr-1` with actions else `pr-4`; the tone's icon 22 first; text `flex-1 text-[15px] leading-[1.35] font-bold tabular-nums`; each action `h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent` (no underline). `VideoPlayer`: `say` gains `tone` — `Point saved …` and `Section saved …` are `saved`, `Deleted …` `deleted`, `Couldn't save` / `Couldn't load spots` `failed`, `Start/End set to …` and `Play on a little, then end the section` `note`; timings unchanged (6 s with Link, else 4 s). Its place: replace the inline `mode` with `playerMode(layout, level.kind, sheet === 'list')`; when `toastPlace(mode, level.kind) === 'video'` render the toast inside the video area (`absolute inset-x-4 bottom-3 z-30`), else where it is now with `bottom: 20px` (the `84px` case goes).
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look:** create `$S/tools/video-states.py` (see Screenshots), open the salsa player, tap Mark point → the light inverse toast with a check-circle and Edit; compare with `s-video-0.png` "Saved".
- [ ] **Step 9: Commit** `feat(video): the player on the media palette; its buttons and toast`.

### Task 3: The full video in portrait, and what sits on the picture

**Files:**
- Modify: `src/lib/components/video/TopBar.svelte`, `Transport.svelte`, `Timeline.svelte`, `SectionRow.svelte`, `VideoGestures.svelte` (the jump mark's markup only)
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (portrait full controls, slim bar, corner badge, zoom chip, paused glyph, buffering)

**Interfaces:**
- Consumes: `playerButton`, `roundButton`, `ON_VIDEO` (Task 2); `topBar`, `cornerBadge`, `buffering`, `playerMode` (Task 1); `Icon`, `Spinner`; `VIDEO_RATES`.
- Produces:
  - `<TopBar title subtitle mirror rate parts: TopBarParts spotsCount onspots? onback? onedit? onclose onchoose />` — `overlay` goes; what shows comes from `parts` (the player passes `topBar(mode, level.kind)` and the callbacks as today).
  - `<Transport paused size: 'compact' | 'normal' | 'large' | 'float' glass?: boolean ontoggle onstep ontenth />` — `seconds` and `overlay` go: `compact` is −0.1 s / Play / +0.1 s; `float` is the landscape size (Task 6). Sizes (sides / Play / gap / glyph): normal 54 / 66 / `gap-2.5` / 28; large 58 / 78 / `gap-3` / 32; float 48 / 56 / `gap-2.5` / 24; compact: sides `roundButton('ghost', 48)`, Play `roundButton('neutral', 44)` glyph 22, `gap-1`. Sides are `neutral` (`glass` when `glass`), ±1 s `text-[14px]`, ±0.1 s `text-[13px]`; Play is always `accent` outside compact; the glyph is the filled `play` (with `ml-[3px]`) or filled `pause`; labels as today ("Back 1 s" etc. stay — the −1 s/+1 s buttons gain `aria-label="Back 1 s"` / `"Forward 1 s"`).
  - `<Timeline … glass?: boolean />` — `overlay` renamed `glass`; geometry and colours below.

- [ ] **Step 1: TopBar** (board `top_bar`, `mirror_btn`, `speed_btn`, `close_btn`, `title_block`): row `relative flex h-14 flex-none items-center gap-1 bg-ground px-2` (`parts.glass`: no background — the player's scrim wrapper supplies it). ✕: 44 px button, `close` 24 `text-white`; glass: a 40 px disc `bg-surface/72` with the inset white/12 line inside the 44 px button, `close` 22, `aria-label="Close player"`. Back (`parts.back`): `playerButton(parts.glass ? 'glass' : 'ghost', 'md')` with `pl-1 pr-3` replaced in (or a 40 px glass pill), `chevron-left` 20 + "Full video". Title block (`parts.title`): `flex min-w-0 flex-1 flex-col gap-px pl-0.5`, title `truncate text-[16px] leading-[1.25] font-extrabold`, sub `text-[12.5px] font-semibold text-muted` — `subtitle`, or "Looping" when `parts.sub === 'looping'`; when there is no title block, a `flex-1` spacer. Edit (`parts.edit`): accent → `playerButton('accent', 'md')` at 40 px height (`h-10`, written out) with `edit` 18; glass → the glass pill; "Edit". Sections (`parts.sections`): glass pill `list` 20 + "Sections ({spotsCount})". Mirror: off → `mirror` 24 white bare (glass: the glass disc); on → a 40 px `bg-accent text-on-accent` disc with `mirror` 22; `aria-pressed`. Speed: a 44 px button holding a 36 px pill `min-w-[52px] rounded-full px-2.5 text-[15px] font-extrabold tabular-nums text-white` on `bg-step` (glass: `bg-surface/72` + white/12 line), `shadow-[0_0_0_2px_var(--color-accent)]` while open; label `{rate}×`, `aria-label="Speed {rate}×"`, `aria-expanded`. Popover: `role="group" aria-label="Speed"`, `absolute top-[58px] right-2 z-30 flex gap-0.5 rounded-[27px] bg-surface p-[5px] shadow-[0_12px_30px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.12)]`; options `h-11 min-w-[62px] rounded-full text-[15px] font-extrabold tabular-nums` — chosen `bg-accent text-on-accent`, else `text-white`; `aria-pressed`; a pick calls `onchoose` and closes (as now).
- [ ] **Step 2: Transport** to the Interfaces. Update every caller of the renamed props in this task, so `svelte-check` passes between tasks: `SpotEditor`'s row (`size="compact"`, no `seconds`), `SectionView` (`overlay` → `glass`, its overlay transport `size="float" glass`), `VideoPlayer`'s slim bar, overlay and panel rows; `Timeline`'s `overlay` → `glass` in `VideoPlayer` and `SectionView`.
- [ ] **Step 3: Timeline** (board `timeline`): root unchanged (`h-11`, pointer capture, slider ARIA). Track `absolute inset-x-0 top-[19px] h-1.5 rounded-full bg-white/24` (glass `bg-white/30`); fill same geometry, `bg-accent` when `accentFill` else `bg-white/62`; a point `top-2.5 h-6 w-[3px] -translate-x-1/2 rounded-sm bg-white/90`; a section band `top-[15px] h-3.5 min-w-[5px] rounded` `bg-accent` when active else `bg-white/34`; pending `top-[15px] h-3.5 rounded bg-accent opacity-60`; playhead `top-[7px] h-[30px] w-1 -translate-x-1/2 rounded-sm bg-white shadow-[0_0_0_2px_black]`.
- [ ] **Step 4: SectionRow** (board `section_chips`, `kit.chip`): row `flex gap-2 overflow-x-auto px-4` with the scoped mask now `linear-gradient(90deg, black 86%, transparent)` (and `transparent, black 10%, black 86%, transparent` once scrolled — `scrollLeft > 0`, tracked on scroll), `scrollbar-width: none`. Each chip is a 44 px button holding a 36 px pill `flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px]`: All — `bg-chip text-chip-ink font-semibold`, `list` 16, "All", count `font-bold opacity-75`; a point — `flag` 16 + label (`max-w-40 truncate`); a section — `repeat` 16 + label + length `font-bold opacity-75`; the open one `bg-accent text-on-accent font-extrabold`, `aria-current="true"`. Empty: `<p class="px-5 pt-0.5 text-[13px] leading-[1.45] text-muted">Nothing marked yet. <b class="font-bold text-ink-2">Mark point</b> saves this moment; <b class="font-bold text-ink-2">Start section</b> saves a stretch to loop.</p>`. Failed: `<p role="alert" class="flex items-center gap-2 px-5 pt-1 text-[13px] font-bold text-danger">` with `warning` 16 + "Couldn't load spots".
- [ ] **Step 5: Portrait full controls** in `VideoPlayer` (board `full_controls`): wrapper `flex flex-col gap-1.5 bg-ground pt-1.5 pb-[max(env(safe-area-inset-bottom),22px)]`. Row 1 `flex items-center pr-2 pl-5`: the time `font-display text-[26px] font-extrabold tracking-[-0.01em] tabular-nums` + `/ {duration}` `text-[14px] font-semibold text-muted tabular-nums` (baseline-aligned, `gap-2`), spacer, Hide = `playerButton('ghost', 'md').replace('text-ink', 'text-ink-2')` "Hide" + `chevron-down` 18. Timeline `px-5`; Transport normal in `px-4 pt-0.5 pb-1`; then `flex gap-2 px-4 pt-0.5 pb-1.5`: Mark point `playerButton('neutral')` `flex-1` with `flag` 20; Start section `playerButton(pendingStart === null ? 'neutral' : 'accent')` `flex-[1.4]` with `scissors` 20 and today's labels; then the row. Desktop's `markButtons` use `playerButton('neutral', 'md')` / accent; overlay's use glass (Task 6 draws overlay).
- [ ] **Step 6: Slim bar** (board `slim_bar`): `flex flex-col bg-ground px-4 pt-1 pb-[max(env(safe-area-inset-bottom),22px)]`; the timeline in `px-1`; row `-mx-1 flex items-center`: Show = Hide's class with `chevron-up`, spacer, `<Transport size="compact">`, spacer, the time `w-[92px] text-right text-[15px] font-extrabold tabular-nums`.
- [ ] **Step 7: On the picture.** Paused glyph: `grid size-16 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]` with filled `play` 30 `ml-[3px]`. Buffering: `let waiting = $state(false)`, the `<video>` gets `onwaiting`, `onplaying`, `oncanplay`, `onseeked`, `onpause`, `onerror`, `onemptied` each setting `waiting = buffering(waiting, '<event>')`; while `waiting && !faded` the same disc shows `<span class="text-white"><Spinner size={30} label="Loading video" /></span>` instead of the play glyph. Corner badge (`cornerBadge(rate, mirror)`, not in overlay): `absolute top-2.5 right-2.5` `{ON_VIDEO} font-bold text-white/92 pointer-events-none`. Zoom chip: `absolute right-2.5 z-10 flex h-9 items-center gap-0.5 rounded-full bg-black/60 pl-3 text-[13px] font-bold text-white/92`, `top-16` in overlay, `top-[46px]` under a badge, else `top-2.5`; `search` 15 (in `text-white/80`), "Zoom {n}×", Reset `-my-1 h-11 cursor-pointer pr-3.5 pl-2.5 text-[13px] font-extrabold text-accent-text`.
- [ ] **Step 8: VideoGestures' jump mark** (board `jump_mark`), markup only: a half-disc `pointer-events-none absolute inset-y-[12%] w-[200px] rounded-[50%] bg-white/14` at `-left-[60px]` / `-right-[60px]`, and over it `absolute top-1/2 -translate-y-1/2` at `left-[74px]` / `right-[74px]` a column `flex flex-col items-center gap-1 text-white`: two `chevron-left` (or `-right`) 22 overlapping (`-ml-3.5` on the second) and the text `font-display text-[20px] font-extrabold` — `« {total} s` / `{total} s »` as now.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look** at 390×844, salsa and bachata (`video-states.py`): playing (`s-video-0.png` "Full video · playing"); paused with Speed open and Mirror on ("Speed and Mirror"); Start section then 3 s later ("Marking a section"); End section ("Saved", the toast with Edit and Link); Hide ("Hidden"); the bachata video with no spots ("Nothing marked"); spots failing to load plus a failed Mark point, and the video delayed with `pg.route('**/recordings/*', lambda r: (time.sleep(3), r.continue_()))` then seeking (the spinner — "Loading and errors", Review Focus 5: it must go once playback resumes); the long title on a figure named "Dile que no con vuelta · Doble con mano" (Mirror and Speed stay put, Review Focus 4); the long section label in the row.
- [ ] **Step 11: Commit** `feat(video): the full video in the new look — top bar, transport, timeline, the row of sections`.

### Task 4: A section's view

**Files:**
- Modify: `src/lib/components/video/SectionView.svelte`
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (the loop badges, the link entry, the section's top bar)

**Interfaces:**
- Consumes: `linkEntry`, `topBar` (Task 1); `ON_VIDEO`, `playerButton` (Task 2); `Transport`, `Timeline` (Task 3).
- Produces: `<SectionView spot currentMs paused variant: 'panel' | 'overlay' | 'bar' onfull onseek ontoggle onstep ontenth onhide? row? badges? />` — `badges?: Snippet`, rendered above the overlay variant's timeline (the name and the link pills move there in landscape).

- [ ] **Step 1: The loop badges** — one snippet `loopBadges(spot: Spot, row: boolean)` in `VideoPlayer` (board `loop_badges`): a column (`flex flex-col items-start gap-1.5`), or a row `mb-1 flex gap-1.5` when `row`. The name: `{ON_VIDEO} font-bold text-white/92 pointer-events-none` with `repeat` 15 in `text-accent` + `spotLabel(spot)` (truncate at `max-w-[60vw]`). The link: by `linkEntry(spot.linkedTo, linking, 'badge')` — `open` → `<button>` `{ON_VIDEO}` with `aria-label={label}` and `onclick={() => openLink(spot.id)}`, `font-extrabold text-accent-text` with `link` 14 when `invite`, else `font-bold text-white/92` with `link` 14 in `text-white/80`; `show` → the same as a `<span>`; `none` → nothing. Portrait and desktop: the column at `absolute top-2.5 left-2.5 z-10` while a loop runs (as now); overlay: passed to `SectionView` as `badges` in row form.
- [ ] **Step 2: SectionView** (board `section_controls`, `land_section`, `ends_row`). `panel`: `flex flex-col gap-1.5 bg-ground pt-1.5 pb-[max(env(safe-area-inset-bottom),22px)]`; row 1 as the full video's (Task 3 Step 5) with `sectionProgress` as the big time and no "/ duration"; the track `px-5` with ends row `-mt-1.5 flex justify-between text-[12px] font-bold text-muted tabular-nums`; `Transport size="large"` in `px-4 py-2.5`; `row`. `overlay`: `flex flex-col px-12 pb-3`; `badges`; the track `glass` with ends row in `text-white/85` and the middle `sectionProgress` `font-extrabold text-white`; `<Transport size="float" glass>` in `mt-1.5`. `bar` (desktop, layout unchanged): the same track, ends in `text-muted`, middle `text-ink`; its row: the time 15/800, Transport normal, "Full video" `playerButton('ghost', 'md')` with `chevron-left`.
- [ ] **Step 3: The top bar** in a section uses `topBar(mode, level.kind)`: portrait → ✕, ‹ Full video, spacer, accent Edit, Mirror, Speed (board "Section view"). The overlay title is now the video's own `title` with "Looping" under it (was the section's name — the name pill sits above the timeline instead).
- [ ] **Step 4: The loop bar** stays `absolute bottom-0 left-0 h-[3px] bg-accent` with its width.
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look** at 390×844, both dances: a section chip tapped ("Section view": the name and "Enchufla · Doble"-style link pill on the picture, the lit chip, 2.7 / 7.2 s); Hide in a section and a Ctrl+wheel zoom ("Section · hidden and zoomed"); a double tap on the left third twice ("Double-tap a side"; an unlinked section shows the accent "Link" pill); the link pill → plan 8's Link popup over the player ("Link popup in the player" — its look is plan 8's; check only that it opens and Back returns to the section). Compare with `s-video-1.png` / `s-video-c3.png`.
- [ ] **Step 7: Commit** `feat(video): a section's view in the new look`.

### Task 5: The editor, the trim strip, and Rename / Delete / Keys

**Files:**
- Modify: `src/lib/components/video/SpotEditor.svelte`, `TrimStrip.svelte`, `PlayerSheet.svelte`
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (the portrait editor, `remove`'s message)
- Create (only if plan 8 has not): `src/lib/components/ui/PlayerLayer.svelte`, exactly as plan 8 Task 2 Step 4 specifies

**Interfaces:**
- Consumes: `editorSub`, `linkEntry`, `deleteCopy`, `spotLine` (Task 1); `playerButton`, `roundButton` (Task 2); `Transport` (Task 3); `<PlayerLayer shape title sub back tall z icon tone body footer children onclose />` (plan 8); `Banner`, `button`, `iconButton`, `FIELD`, `LABEL`.
- Produces: `PlayerSheet`'s props unchanged (`kind`, `spot`, `message`, `oncancel`, `onrename`, `ondelete`); it now renders a `PlayerLayer` (`shape="sheet"`, `z="z-40"`, `onclose={oncancel}`). `SpotEditor`'s props unchanged.

- [ ] **Step 1: The compact row** (board `compact_transport_row`, portrait editor only, `transport` prop): `flex h-[52px] flex-none items-center border-b border-surface bg-ground pr-2 pl-5`; the time `text-[16px] font-extrabold tabular-nums`; spacer; `<Transport size="compact">`.
- [ ] **Step 2: The editor's body** (board `editor_panel`, `editor_head`): scroll area `flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-ground px-4 pt-3.5 pb-2`, ending in a `pointer-events-none sticky bottom-0 -mt-9 h-9 flex-none bg-linear-to-b from-transparent to-ground` fade when not `keys`. Head `flex items-start gap-2`: the name button (`aria-label="Rename {label}"`, opens Rename, never a field) — `flex items-center gap-2`: the name `truncate font-display text-[22px] leading-[1.15] font-extrabold`, `edit` 16 in `text-muted`; under it `editorSub(spot)` 13 `text-muted tabular-nums`. Loop (sections): a 44 px box holding `playerButton(looping ? 'accent' : 'neutral', 'sm')` with `repeat` 16, "Looping" / "Loop", `aria-pressed`. The link line by `linkEntry(spot.linkedTo, !!onlink, 'editor')` — `open`: `-my-1.5 flex h-8 items-center gap-1.5 self-start text-[13px]`, `invite` → `font-extrabold text-accent-text` + `link` 15, else `font-semibold text-ink-2` + `link` 15 + text + `chevron-right` 16 in `text-muted`; `show`: the same as a span without the chevron.
- [ ] **Step 3: TrimStrip** (board `trim_strip`): the strip `h-16 rounded-xl bg-surface` (pointer logic untouched); ticks `bg-white/45` 18 px major / `bg-white/25` 9 px; the section `border-y-[3px] border-accent bg-accent/16`; handles `w-[22px]` with `rounded-l-[10px]` / `rounded-r-[10px]`, `bg-accent` when selected else `bg-ink-2` (class swap, no inline style), grip `h-[22px] w-0.5 rounded-full bg-black/45`; a point `w-6 -translate-x-1/2 rounded-[10px] bg-accent text-on-accent` with `flag` 15; the playhead `w-0.5 bg-white`; under it `text-[11.5px] font-semibold text-muted tabular-nums`. The handles gain `role="slider"`, `aria-label="Start"` / `"End"`, `aria-valuetext={preciseTime(…)}` (no tabindex: the edges are moved by the buttons and I / O).
- [ ] **Step 4: Start | End** (board `edge_selectors`): `flex h-14 flex-1 cursor-pointer flex-col items-start justify-center gap-px rounded-[14px] px-3.5`, chosen `bg-raised shadow-[inset_0_0_0_2px_var(--color-accent)]` with the label `text-accent-text`, else `bg-surface` with the label `text-muted`; label `text-[12px] font-bold` "Start" / "End" (plus the desktop `kbd` I / O, Task 6's class); value `text-[18px] font-extrabold tabular-nums`; `aria-pressed`.
- [ ] **Step 5: The move rows** (board `move_row`, `whole_row`): label `text-[12px] font-bold text-muted` ("Move the start" / "Move the end" / "Move the point"); five buttons `playerButton('neutral', 'xl', 'tile')` `flex-1` (Now `flex-[1.3] flex-col gap-0 leading-tight` with `spotTime(currentMs)` under it `text-[12px] font-semibold text-muted`, `text-disabled-ink` when disabled); disabled as now. "Whole section · {length}": four `playerButton('outline', 'md')` `flex-1 px-1` — "‹ Earlier", "Shorter", "Longer", "Later ›".
- [ ] **Step 6: The footer** (board `editor_footer`): `flex flex-none items-center gap-2 border-t border-surface bg-ground px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),22px)]`; Delete `playerButton('danger-text')` `px-3` with `trash` 20; spacer; desktop's Rename `playerButton('ghost', 'md')` stays; Done `playerButton('accent', 'cta')` with `check` 20.
- [ ] **Step 7: PlayerSheet on PlayerLayer** (board `rename_sheet`, `delete_sheet`, `delete_linked`). Rename: `title="Rename"`, `sub={spotLine(spot)}`; body `<form id="spot-rename" onsubmit>` with `<label for="spot-name" class={LABEL}>Name</label>`, the input `class={FIELD}` (`maxlength`, placeholder `spotLabel({ ...spot, label: null })`, `aria-describedby="spot-name-help"`, no autofocus), `<p id="spot-name-help" class="mt-1.5 pl-1 text-[13px] text-muted">Leave it empty to show the times.</p>`; footer `flex gap-2`: `button('secondary')` `flex-1` "Cancel", `button('primary')` `flex-1` `type="submit" form="spot-rename"` "Save". Delete: `deleteCopy(spot)` — `title`, `sub`; body `<p class="text-[15px] leading-[1.45] text-ink-2">` or, when `blocked`, `<Banner kind="warning" title={blocked.title}>{blocked.body}</Banner>`; `message` → `<Banner kind="error" title={message} />` above; footer: "Keep it" secondary `flex-1`, `button('danger')` `flex-1` with `trash` 20 + "Delete", `disabled={!!blocked}`. Keys (the "?" list, every layout): `title="Keys"`; `<dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">`, each key a `kbd` chip (`inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-step px-1.5 text-[12px] font-bold tabular-nums text-ink`), its meaning 14 `text-ink-2`; footer `button('secondary', 'md', true)` "Close". The comment about not being a second `<dialog>` stays.
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Look** at 390×844, both dances (`s-video-1.png`, `-c3`, `-c4`, `-2`): Edit on a section ("Editor · section", Linked to … with the chevron); End chosen, Loop off, Now ("Editor · end, Now": the toast over the video's bottom edge); a point at 0:00 ("Editor · point": −1 s and −0.1 s disabled); the name tapped ("Rename": the keyboard does not open — `document.activeElement` is not the input); Delete on an unlinked section ("Delete asks"); Delete on the linked one ("Delete · linked section", Review Focus 1); then force a 409 — `pg.route('**/api/video-spots/*', …)` fulfilling DELETE with `status=409, json={'message': 'Linked to Enchufla · Doble. Unlink it first.'}` on an unlinked section — the error banner shows and the section stays; Delete then Undo ("Deleted · Undo", the section back in the row); the long label in the editor head and the delete title (Review Focus 4).
- [ ] **Step 10: Commit** `feat(video): the editor, trim strip and Rename / Delete / Keys in the new look`.

### Task 6: The lists, landscape and the desktop

**Files:**
- Modify: `src/lib/components/video/SpotList.svelte`
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (the portrait All sheet, the overlay and panel areas, the desktop sidebar, editor card and legend, the panel column width)

**Interfaces:**
- Consumes: `listMeta` (Task 1); `playerButton`, `roundButton` (Task 2); `TopBar`, `Transport` (`float`, `glass`), `Timeline` (Task 3); `SectionView` (Task 4); `SpotEditor` (Task 5); `iconButton`, `SECTION_LABEL`.
- Produces: `<SpotList spots activeId loadFailed variant: 'sheet' | 'panel' | 'sidebar' onopen onedit? onclose? expanded? />` — `compact` and `editAll` go (`sidebar` was `compact`; `sheet` and `panel` were `editAll`); the header is SpotList's own.

- [ ] **Step 1: SpotList.** `listMeta` replaces the inline `sub`. Header by variant: `sheet` (board `all_sheet`) — the grabber `mx-auto h-[5px] w-10 rounded-full bg-hairline`, then `flex min-h-11 items-center -mr-1.5 pl-1`: `<h3 class="flex-1 font-display text-[22px] font-extrabold">Sections and points</h3>`, the count 14/700 `text-muted mr-1`, × `iconButton('bare')` `close` `aria-label="Close list"` → `onclose`; `panel` (board `land_list`) — `flex h-[52px] items-center pr-1 pl-4`, `<h3 class="flex-1 text-[16px] font-bold">Sections and points · {n}</h3>`, the same ×; `sidebar` — `<h3 class="{SECTION_LABEL} pt-3 pb-1.5">Sections and points · {n}</h3>`. Empty and failed lines as `SectionRow`'s (Task 3 Step 4). The list: `<ul class="overflow-hidden rounded-2xl bg-surface">` (`mx-3` in panel). Rows — `sheet`: `flex items-center gap-1 pl-3.5`; the open button `flex min-h-[62px] min-w-0 flex-1 items-center gap-3 py-2 text-left` with `border-b border-hairline` unless last; a tile `grid size-10 flex-none place-items-center rounded-xl bg-step text-ink-2` with `flag` / `repeat` 20; the name `truncate text-[16px] font-bold`, `listMeta` 13 `text-muted tabular-nums`, and when linked `flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2` with `link` 13 + "Linked to {all, joined}"; the Edit cell `flex self-stretch items-center pr-2` with the same hairline, `playerButton('neutral', 'sm')` `pr-3 pl-2.5` with `edit` 15 + "Edit". `panel`: `pl-3`, button `min-h-[52px] gap-2.5 py-1.5`, the icon 20 in `text-ink-2` (no tile), name 15/700, meta 12.5 with " · <span class='text-ink-2'>linked</span>" when linked, Edit as `sheet`. `sidebar` (desktop, layout unchanged): rows `py-1.5`, no tile, the open card `bg-surface` (`aria-current`), its Edit `playerButton('accent', 'sm')`; `expanded` renders in `px-3 py-1.5` as now.
- [ ] **Step 2: The portrait All sheet** (board "All · the list"): in the area under the video, `<section aria-label="Sections and points" class="flex max-h-[50dvh] min-h-0 flex-col gap-2 rounded-t-[28px] bg-sheet px-4 pt-2 pb-[max(env(safe-area-inset-bottom),22px)]">` holding `<SpotList variant="sheet" onclose={() => nav.up()}>` with the list scrolling (`min-h-0 overflow-y-auto`); the old absolute × goes.
- [ ] **Step 3: Landscape, controls over the picture** (board `land_full`, `_land_top`, `land_section`). Top wrapper: `absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/60 to-transparent px-11 pt-2.5 pb-[30px]` (fading as now) around `TopBar` with `parts.glass`. Bottom wrapper: `absolute inset-x-0 bottom-0 z-20 bg-linear-to-b from-transparent to-black/72 px-12 pt-10 pb-3.5`. Full video: the `glass` timeline, then `mt-0.5 flex items-center gap-2`: a `w-[170px]` box with the time `font-display text-[20px] font-extrabold tabular-nums` + "/ duration" 14/600 `text-white/85`, spacer, `<Transport size="float" glass>`, spacer, a `w-[170px] flex justify-end gap-1.5` box with "Mark" (`flag`) and "Section" / "End · {len}" (`scissors`) as `playerButton('glass', 'md')` (accent while marking). A section: `SectionView variant="overlay"` with the row-form badges (Task 4). Faded and zoomed (board `land_faded_zoom`): unchanged behaviour; the zoom chip at `top-16`.
- [ ] **Step 4: Landscape panel** (board `land_editor`, `land_list`). The grid column becomes `minmax(300px, 44%)`. Top bar plain at `h-[52px]` (`pl-10` for the rounded corner side). Under the video: `flex h-[60px] items-center gap-2 pr-3 pl-11` — the time 15/800 tabular, spacer, `<Transport size="compact">` with the editor open, `<Transport size="float">` with the list. The side: `flex min-h-0 flex-col border-l border-surface bg-ground pr-[env(safe-area-inset-right)]` holding `<SpotList variant="panel">` or the editor (its scroll fades and its footer stays pinned, Task 5).
- [ ] **Step 5: Desktop** (layout unchanged): the sidebar `border-l border-surface`; the expanded editor card `rounded-2xl border border-hairline bg-surface`; the full video's row as now with token classes (time 15/800, "/ duration" 12 `text-muted`, `Transport size="normal"`, Mark / Section `playerButton('neutral', 'md')`); the key legend `flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-1 pb-3 text-[12px] text-muted` with each key in Task 5's `kbd` chip class; SpotEditor's desktop `kbd` uses the same chip at `h-5 min-w-5 text-[11px]`, and its `<style>` block goes.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look**, both dances: 390×844 All ("All · the list", Edit on every card, the long label truncating); 844×390 full video playing, a section, Edit (panel), Sections (5) (panel), faded with a Ctrl+wheel zoom and a right double tap (`s-video-3.png`, `s-video-4.png`); 1280×800 full video, a section, an editor card, `?` (Keys) — compare with today's layout (only the look changed). **Rotation (Review Focus 3):** in portrait open an editor and play, record `video.currentTime` and tag the element (`document.querySelector('dialog video').dataset.t = '1'`), `pg.set_viewport_size({'width': 844, 'height': 390})`, wait 300 ms, check the tagged element is still there and `currentTime` moved forward by less than 1 s of wall time, rotate back. **Back walk (Review Focus 2):** from the editor of a section reached through its view, `history.back()` three times → the section view, the full video, the player closed; the same with Escape at 844×390.
- [ ] **Step 8: Commit** `feat(video): the lists, landscape and desktop in the new look`.

### Task 7: Retire `--pl-*`, the player's own icons, and the docs

**Files:**
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (delete `tokens`, `style={tokens}`, the `.kbd` style, `getDance`/`accent`)
- Modify: `src/lib/components/video/styles.ts` (delete the `BTN*` aliases)
- Delete: `src/lib/components/video/icons.ts`, `src/lib/components/video/Icon.svelte`
- Test: `src/lib/components/video/retired.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-01-video-player-design.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing test** `retired.spec.ts` (node `fs`, like `stylesheet.spec.ts` reads files): walk `src/` recursively; no `.svelte`, `.ts` or `.css` file contains `--pl-`; no file under `src/lib/components/video/` or `ui/VideoPlayer.svelte` contains `/#[0-9a-fA-F]{3,8}\b/` or imports `./icons` / `video/Icon.svelte`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/video/retired.spec.ts` — Expected: FAIL (the `tokens` string; and `LinkPopup` / `Picker` / `LinkLevel` too if plan 8 has not landed — then stop and report: plan 8 owns those files).
- [ ] **Step 3: Delete** the `--pl-*` palette, the `BTN*` aliases (convert any last user to `playerButton`), `video/icons.ts` and `video/Icon.svelte`.
- [ ] **Step 4: Run** the test and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Docs.** The video-player spec gains a status note (2026-10-31, the redesign): the player's look follows the redesign spec — the media palette as `.theme-media` from `MEDIA` in `tokens.ts` (no own palette); round transport with Play as an accent disc; the speed pill opens a popover; the link entry on the video reads "Link" (was "+ Link") and the editor's "Link to a figure or drill"; toasts carry an icon and, in the portrait editor, sit over the video's bottom edge; a spinner shows on the picture while the video buffers; the landscape editor's under-video transport is the compact one (−0.1 s / Play / +0.1 s), as the portrait editor's; the landscape panel is 44 % wide; Rename, Delete and Keys are `PlayerLayer` sheets; what the screens show is decided in `src/lib/video/chrome.ts`. Add `chrome.ts` to its "Client" list. `CLAUDE.md` Layout, the `src/lib/video/` entry: add `chrome.ts` (which parts the top bar shows per layout and level, the link entry's words, the delete sheet's copy, the toast's icon and place, the buffering spinner) to the PURE list, and say the player's screens draw from `.theme-media`.
- [ ] **Step 6: Look** once more at every board state in Tasks 3–6 for both dances (one run of `video-states.py`) — nothing reverted.
- [ ] **Step 7: Commit** `refactor(video): retire the player's own palette and icons; docs`.

---

## Calls made in this plan

- **The player draws from plan 8's `.theme-media` scope, and `--pl-*` goes** (spec: "drawn from the same tokens"). Mid-plan the old palette stays defined so unconverted components keep working; Task 7 removes it with a test. Cost if wrong: none at runtime — the values match (`MEDIA.salsa.accent` = the old `accentDark`).
- **Over the picture, colours are black/white alphas, not tokens** — scrims, pills, the timeline's track and bands, the glass line, the jump disc. They sit on a video, not a theme surface; the kit draws them as rgba. The glass fill is `bg-surface/72`. Cost: a handful of literal alphas; the retired-test forbids hex only.
- **The trim strip's unselected handle is `ink-2`** (media ink-2 ≈ `#d4d4d5`); the board's `#d4d4da` has no token.
- **The player's icons move to the shared set** (`repeat`, `scissors`, `edit`…); the drawn start/end-edge glyphs go, since the board's Start / End selectors have none. Cost: two glyphs.
- **New pure module `src/lib/video/chrome.ts`.** The existing pure modules are not edited; the inline `mode`, `badge`, the list's and editor's second lines move there so they are specced.
- **A buffering spinner on the picture is new** — the board draws it ("Loading and errors"); the player had no buffering state. It is a reducer over seven media events (Review Focus 5). Cost if unwanted: one `{#if}`.
- **Link copy:** the badge reads "Link" (spec: "the link entry as a link icon plus 'Link'"), the editor line "Link to a figure or drill", and a linked editor line shows `linkSummary` ("Linked to A +1") with a chevron, as the board does — it listed every label before. The All list and the delete banner still list every label.
- **Toast tones:** saved (check-circle), deleted (trash), failed (warning), notes without an icon; light inverse colours in the player, as the board. In the portrait editor the toast sits over the video's bottom edge (the board's "End set to"), so it never covers the editor's buttons; elsewhere at the bottom as now. Timings unchanged (6 s with Link, 4 s otherwise; the board's caption says "about 4 s" for Undo).
- **Landscape section view:** the top bar shows the video's title with "Looping" under it, and the section's name moves to a pill above its timeline (board), instead of the name as the title.
- **The landscape editor's under-video transport is the compact one** (board `land_editor`), like the portrait editor's; ±1 s stays on the arrow keys and in the move row's edge steps. The list panel keeps the full transport.
- **The landscape panel is 44 % wide (min 300 px)** to match the board's 372 of 844; it was 40 % (min 280). Desktop is untouched.
- **Rename stays a plain form, not `use:guarded`.** It is not a SvelteKit form action, it holds one optional field, and the player's history moves are shallow so the unsaved guard never sees them (video-player spec); Cancel and the backdrop already discard it, as today.
- **Delete's body for a point says "The point goes…"**, the board only draws a section. A linked section's banner lists every link ("Linked to A, B").
- **Rename, Delete and Keys are `PlayerLayer` sheets** (plan 8's shared overlay), not a second `<dialog>`; their Escape steps one level back as the old sheet's did.
- **SectionRow's leading fade** appears once the row is scrolled, as the board's "Section view" draws it.
- **Straight apostrophes stay** in "Couldn't save" / "Couldn't load spots" (today's copy); the board uses ’.
- **The trim handles gain slider roles** (`aria-valuetext`), without focus: the arrows are the player's ±1 s keys, and I / O set the edges.
