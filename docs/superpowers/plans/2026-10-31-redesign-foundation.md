# Redesign foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the new design's foundation — colours, fonts, app icons, Android
bars, the icon set, the four-tab shell and every shared component — so each
area of the app can then be redrawn on top of it.

**Architecture:** One TypeScript token module (`src/lib/theme/tokens.ts`) is
the source of every colour; `layout.css` copies it into CSS custom properties
per dance and scheme (a spec keeps the two in sync, as `dances.spec.ts`
already does for accents). Old token names stay as aliases of the new ones
until the last area plan removes them, so every old screen keeps working on
the branch. Shared components live in `src/lib/components/ui/`; a dev-only
gallery page shows each in every state to check against the design board.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4 (`@theme`), Vitest
(node), Kotlin (Android WebView shell), librsvg via `nix shell` for icons,
`@fontsource-variable/*` for self-hosted fonts.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` (values in
`docs/superpowers/design-kit/kit.py`; mockups at
https://claude.ai/artifact/9f1bRKTJ9ST8Vxg17YC9XJ — "Design system", parts 1–3).

**This is plan 1 of 13.** All plans land on branch `app-icons`, which is
deployed once, when the last plan is done. Later plans (one per area, each
written against the components this plan produces): Today · Logging and the
exercise page · Moves · A figure · A routine · Lessons · Picker and Link popup
· Music · Practice · Video player · Settings, voice, sign-in and system (incl.
`+error.svelte`) · Cleanup (remove the old token aliases and dead
components). Between plans, Settings is reachable by URL only (its gear
arrives with the Today plan).

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

## Review Focus

1. **Every old screen still readable mid-branch:** an old class such as `text-accent-ink` on `bg-accent` must not become invisible when the accent changes — pinned by the alias test in Task 2.
2. **Bachata dark and salsa light band:** the two themes nearest the contrast limits — pinned by the contrast test in Task 1.
3. **A pushed screen never strands the user:** routes without tabs must have a back control, and `/salsa/player` etc. must show no tab bar — pinned by `showsTabs` tests in Task 6.
4. **Spanish names in the new fonts:** "Montaña", "Caída", "Manos cruzadas" render in Bricolage and Manrope (latin-ext glyphs) — checked in the gallery (Task 10).
5. **Long figure names in the band:** "Dile que no con vuelta · Doble con mano" must wrap to two lines then ellipsize, never push the band's icons off — shown in the gallery (Task 10).

---

### Task 1: Theme tokens and contrast

**Files:**
- Create: `src/lib/theme/tokens.ts`
- Create: `src/lib/theme/contrast.ts`
- Test: `src/lib/theme/tokens.spec.ts`

**Interfaces:**
- Produces: `type Scheme = 'light' | 'dark'`; `type Theme = Record<TokenName, string>`;
  `THEMES: Record<DanceSlug, Record<Scheme, Theme>>`; `TOKEN_NAMES: readonly TokenName[]`;
  `mix(a: string, b: string, amount: number): string` (hex, `amount` of `a`);
  `contrast(fg: string, bg: string): number` (WCAG ratio, hex or `#rrggbbaa` over `bg`).

Token names (kebab-case, become `--color-<name>`): `ground surface raised sheet field
hairline field-line ink ink-2 muted chevron chip chip-ink step tab-bg tab-line done
on-done done-soft danger on-danger danger-soft warn warn-soft disabled-bg disabled-ink
skeleton inverse-bg inverse-ink band band-ink band-small accent accent-text accent-soft
on-accent status inverse-accent`. Values: the spec's "Design tokens" table and
`design-kit/kit.py` `_LIGHT`, `_DARK`, `THEMES` (copy exactly). `accent-soft` =
`mix(accent, surface, 0.12)` light / `0.18` dark; `band-ink` = `#FFF3E4`.

- [ ] **Step 1: Write the failing tests**

```ts
it('defines every token in all four themes', () => {
  for (const d of DANCE_SLUGS) for (const s of ['light', 'dark'] as const)
    for (const n of TOKEN_NAMES) expect(THEMES[d][s][n], `${d} ${s} ${n}`).toMatch(/^#[0-9a-f]{6}$/i);
});
it('measures contrast like WCAG', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
  expect(contrast('#FFF3E4', '#D2401E')).toBeCloseTo(4.3, 1); // why small band text is white
});
it.each(pairs)('%s on %s passes in every theme', ...) // pairs below, ≥ 4.5
it('keeps the band colours of the app icons', () => {
  expect(THEMES.salsa.light.band).toBe('#D2401E');
  expect(THEMES.bachata.light.band).toBe('#6B1D4F');
});
```

`pairs` (fg, bg) that must reach 4.5 in every theme: ink/ground, ink/surface, ink-2/surface,
muted/surface, muted/ground, accent-text/surface, status/surface, on-accent/accent,
danger/surface, on-danger/danger, done/surface, warn/surface, band-small/band,
inverse-ink/inverse-bg, inverse-accent/inverse-bg, chip-ink/chip. Plus band-ink/band at
≥ 3 (it is only ever large: titles and icons). Disabled text is not tested (WCAG exempts it).

- [ ] **Step 2: Run** `npx vitest run src/lib/theme` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement `tokens.ts` and `contrast.ts`** with the values above. If a pair
  fails, fix the value in `tokens.ts` AND note it in the spec's token table (the kit's
  audit passed all four themes, so a failure means a copying error first).
- [ ] **Step 4: Run** `npx vitest run src/lib/theme` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(theme): the redesign's colour tokens and a contrast check`.

### Task 2: Tokens in the stylesheet, fonts, accents in the registry

**Files:**
- Modify: `src/routes/layout.css` (the `@theme` block, the `[data-dance]` and dark rules, focus, body font)
- Modify: `src/lib/dances/dances.ts` (`accent`, `accentDark`; add `band`, `bandDark`)
- Modify: `src/lib/dances/dances.spec.ts`
- Modify: `package.json` (add `@fontsource-variable/manrope`, `@fontsource-variable/bricolage-grotesque`)
- Test: `src/lib/theme/stylesheet.spec.ts`

**Interfaces:**
- Consumes: `THEMES`, `TOKEN_NAMES` (Task 1).
- Produces: Tailwind utilities `bg-ground`, `text-ink-2`, `bg-band`, `text-band-ink`, … for
  every token; `font-display` (Bricolage) and `font-sans` (Manrope); `Dance.band`,
  `Dance.bandDark` in the registry. Old names kept as aliases: `plane`→ground,
  `surface`→surface, `raised`→raised, `line`→hairline, `rule`→field-line,
  `accent-ink`→on-accent, `done-bg`→done-soft, `overdue`→status.

- [ ] **Step 1: Write the failing tests** in `stylesheet.spec.ts` (reads `layout.css` from
  disk like `dances.spec.ts` does):

```ts
it('carries every token value of every theme', () => {
  const css = readFileSync('src/routes/layout.css', 'utf8').toLowerCase();
  for (const d of DANCE_SLUGS) for (const s of ['light','dark'] as const)
    for (const n of TOKEN_NAMES) expect(css, `${d} ${s} ${n}`).toContain(THEMES[d][s][n].toLowerCase());
});
it('still defines the old names for screens not yet redrawn', () => {
  for (const old of ['plane','surface','raised','line','rule','accent-ink','done-bg','overdue','ink','ink-2','muted','accent','danger','done'])
    expect(css).toContain(`--color-${old}:`);
});
```

  And in `dances.spec.ts`, replace "keeps salsa looking exactly as it does today" with:
  salsa `accent` `#d2401e`, `accentDark` `#ff6b47`, `band` `#D2401E`, `bandDark` `#8f2a12`;
  bachata `#8e2a66`, `#f07aae`, `#6B1D4F`, `#4a1238`; and every registry value equals
  `THEMES[slug][scheme].accent` / `.band`.
- [ ] **Step 2: Run** `npx vitest run src/lib/theme src/lib/dances` — Expected: FAIL.
- [ ] **Step 3: Implement.** Salsa light is the `@theme` default (as today); bachata light
  under `[data-dance='bachata']`; both darks under the existing
  `prefers-color-scheme` rules (keep their selector comments' reasoning). `accent-soft` may be
  written as `color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))` only if the
  spec test is adapted to accept it — otherwise write the hex. Import the two fontsource
  `wght.css` files at the top of `layout.css`; `--font-sans: 'Manrope Variable', system-ui,
  sans-serif`; `--font-display: 'Bricolage Grotesque Variable', 'Manrope Variable',
  sans-serif`. Focus rule becomes `outline: 2px solid var(--color-accent); outline-offset:
  2px; box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 20%, transparent)`.
  Update the `select` arrow's hard-coded muted hex to the new muted (and its comment). Update
  the comments that name hexes (`layout.css`, `dances.ts`).
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS. Then `npm run check` — Expected: PASS.
- [ ] **Step 5: Look** at `/salsa`, `/bachata`, `/salsa/figures` in light and dark in the dev
  server: old screens in the new colours, nothing invisible.
- [ ] **Step 6: Commit** `feat(theme): new tokens and fonts, old names kept as aliases`.

### Task 3: App icons, manifest and theme colour

**Files:**
- Create: `static/icon-salsa.svg`, `static/icon-bachata.svg` (from `docs/superpowers/design-kit/icons/`)
- Delete: `static/icon.svg`
- Modify: `scripts/make-icons.sh`
- Regenerate: `static/icons/{salsa,bachata}-{192,512}.png`, `android/app/src/main/res/mipmap-xxxhdpi/ic_{salsa,bachata}.png`
- Modify: `src/routes/manifest-[dance].webmanifest/+server.ts`, `src/routes/[dance]/+layout.svelte`

**Interfaces:**
- Consumes: `Dance.band`, `Dance.bandDark` (Task 2), `THEMES[slug].light.ground`.

- [ ] **Step 1:** Rewrite `make-icons.sh`: no tinting, no registry lookup; for each dance
  rasterise `static/icon-<dance>.svg` with `nix shell nixpkgs#librsvg -c rsvg-convert` to
  `static/icons/<dance>-192.png`, `-512.png` and the Android launcher
  `android/app/src/main/res/mipmap-xxxhdpi/ic_<dance>.png` at 192. Keep the header comment's
  reasoning about why librsvg is not in the flake; say the two SVGs are different drawings.
- [ ] **Step 2: Run** `./scripts/make-icons.sh` — Expected: six PNGs rewritten; open two and
  check the flame and the heart.
- [ ] **Step 3:** Manifest: `theme_color: dance.band`, `background_color` = the light ground
  `#f2f2f5`. Dance layout head: replace the single theme-color meta with two —
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content={band}>` and the dark
  one with `bandDark`.
- [ ] **Step 4: Run** `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(icons): flame and heart app icons`.

### Task 4: Android system bars

**Files:**
- Create: `android/app/src/salsa/res/values/colors.xml`, `android/app/src/salsa/res/values-night/colors.xml`, `android/app/src/bachata/res/values/colors.xml`, `android/app/src/bachata/res/values-night/colors.xml`
- Modify: `android/app/src/main/res/values/colors.xml`, `values-night/colors.xml`
- Modify: `android/app/src/main/kotlin/eu/anotherroot/salsa/WebShell.kt`, `Launchers.kt`

**Interfaces:**
- `WebShell` gains `protected open val pageColor: Int get() = barColor` — the WebView's and
  window's background; `barColor` is only the strip behind the status bar.

- [ ] **Step 1:** Colours: per flavor `band` (salsa `#D2401E` / night `#8f2a12`, bachata
  `#6B1D4F` / `#4a1238`); in main `ground` (`#f2f2f5` / `#0b0b0d`) and `tab_bar` (`#f9f9fb` /
  `#121214`), replacing `plane` and `surface` (update their comments to name the new tokens).
- [ ] **Step 2:** `WebShell`: three layers — `pageColor` everywhere, a top layer as tall as the
  status bar in `barColor`, the bottom layer in `navBarColor` (as now); the WebView background
  is `pageColor`. Status-bar icon style follows `barColor`'s luminance (all four bands are dark:
  light icons); navigation-bar icons follow `navBarColor`. `DanceLauncher`: `barColor = R.color.band`,
  `pageColor = R.color.ground`, `navBarColor = R.color.tab_bar`. Other `WebShell` subclasses
  (share, link activities) keep their current look with `pageColor` defaulting to `barColor`.
- [ ] **Step 3: Run** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`
  — Expected: BUILD SUCCESSFUL.
- [ ] **Step 4: Commit** `feat(android): status bar in the band colour`.

### Task 5: The icon set

**Files:**
- Create: `src/lib/icons/icons.ts`, `src/lib/components/ui/Icon.svelte`
- Test: `src/lib/icons/icons.spec.ts`

**Interfaces:**
- Produces: `ICONS: Record<IconName, string>` (inner SVG markup on a 24 × 24 viewBox, strokes
  only), `FILLED: Partial<Record<IconName, string>>`, `type IconName`;
  `<Icon name: IconName size?: number = 24 filled?: boolean = false label?: string />` —
  `aria-hidden="true"` unless `label` is given (then `role="img"` + `aria-label`); stroke
  `currentColor`, width 2, round caps and joins.

- [ ] **Step 1: Write the failing test:** every name in `ICONS` has non-empty markup that
  contains no `fill="#` and no `stroke="#` (colour comes from `currentColor`); `FILLED` has
  `today`, `moves`, `lessons`, `music`; every key of `FILLED` is in `ICONS`.
- [ ] **Step 2: Run** `npx vitest run src/lib/icons` — Expected: FAIL.
- [ ] **Step 3: Implement** by porting `ICONS`, `ALIASES` and `FILLED` from
  `design-kit/kit.py` (all 72 names; keep the kit's names, kebab-case). `Icon.svelte` renders
  the markup with `{@html}` — the only `{@html}` allowed, and only for this constant table
  (say so in a comment).
- [ ] **Step 4: Run** `npx vitest run src/lib/icons` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): the icon set`.

### Task 6: Four tabs, no dance switch

**Files:**
- Create: `src/lib/nav/tabs.ts`
- Test: `src/lib/nav/tabs.spec.ts`
- Modify: `src/lib/components/shell/BottomNav.svelte`, `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `Icon` (Task 5).
- Produces: `TABS: readonly { id: TabId; label: string; icon: IconName; path: '/[dance]' | '/[dance]/figures' | '/[dance]/lessons' | '/[dance]/songs' }[]`
  with `TabId = 'today' | 'moves' | 'lessons' | 'music'`;
  `tabFor(path: string, dance: DanceSlug): TabId | null`;
  `showsTabs(routeId: string | null): boolean`.

- [ ] **Step 1: Write the failing tests:**

```ts
expect(tabFor('/salsa', 'salsa')).toBe('today');
expect(tabFor('/salsa/figures', 'salsa')).toBe('moves');
expect(tabFor('/salsa/figures/12', 'salsa')).toBe('moves');
expect(tabFor('/salsa/routines/3', 'salsa')).toBe('moves');
expect(tabFor('/salsa/positions', 'salsa')).toBe('moves');
expect(tabFor('/salsa/coverage', 'salsa')).toBe('moves');
expect(tabFor('/salsa/lessons/4', 'salsa')).toBe('lessons');
expect(tabFor('/salsa/songs/9', 'salsa')).toBe('music');
expect(tabFor('/salsa/player', 'salsa')).toBe('music');
expect(tabFor('/settings', 'salsa')).toBeNull();
expect(tabFor('/voice', 'salsa')).toBeNull(); // six characters, like /salsa
expect(tabFor('/bachata/figures', 'salsa')).toBeNull();
for (const id of ['/[dance]', '/[dance]/figures', '/[dance]/routines', '/[dance]/lessons', '/[dance]/songs'])
  expect(showsTabs(id)).toBe(true);
for (const id of ['/[dance]/figures/[id]', '/[dance]/routines/[id]', '/[dance]/player', '/[dance]/positions',
  '/[dance]/coverage', '/[dance]/lessons/[id]', '/[dance]/songs/[id]', '/[dance]/exercises/[id]',
  '/settings', '/voice', '/login', null])
  expect(showsTabs(id)).toBe(false);
```

- [ ] **Step 2: Run** `npx vitest run src/lib/nav` — Expected: FAIL.
- [ ] **Step 3: Implement** `tabs.ts` (move `BottomNav`'s prefix reasoning and its `/voice`
  comment there). Rewrite `BottomNav.svelte` to the approved bar: four columns, the current
  one wider (`1.6fr`) holding a 44 px tinted pill (`accent` at 12 %) with the filled 28 px
  icon and its label (`accent-text`, 14 px, 800) side by side; the others a 44 px icon-only
  link (`muted`, outline, 28 px) with `aria-label`; `aria-current="page"` on the current
  one; no top bar; `bg-tab-bg`, top border `tab-line`, bottom padding
  `env(safe-area-inset-bottom)`. Root layout: delete the dance pills snippet and its
  `PageSkeleton` `top` prop; render `BottomNav` only when
  `showsTabs((navigating.to ?? page).route.id)`; the bottom padding of the content wrapper
  follows the same condition. Keep `data-dance`.
- [ ] **Step 4: Run** `npx vitest run` and `npm run check` — Expected: PASS.
- [ ] **Step 5: Look** at `/salsa`, `/salsa/figures/<id>`, `/salsa/player` in the dev server:
  tabs on the first, none on the others, no Salsa/Bachata pills anywhere.
- [ ] **Step 6: Commit** `feat(shell): four tabs with icons, no dance switch`.

### Task 7: The band and the sheet

**Files:**
- Create: `src/lib/components/ui/Screen.svelte`, `src/lib/components/ui/BandButton.svelte`, `src/lib/components/ui/HeroCard.svelte`
- Create: `src/lib/nav/band.ts`
- Test: `src/lib/nav/band.spec.ts`

**Interfaces:**
- Consumes: `Icon` (Task 5).
- Produces:
  - `bandMode(scrollY: number, compact: boolean): 'full' | 'compact' | 'slim'` — `full` (46 px
    title) or `compact` (30 px) at the top, `slim` once `scrollY` passes the band's height
    (`BAND_FULL_H = 148`, `BAND_COMPACT_H = 112`).
  - `<Screen title: string subtitle?: string compact?: boolean left?: Snippet right?: Snippet
    extra?: Snippet hero?: Snippet children: Snippet />` — the band (`bg-band`, title
    `font-display` 800 cream, subtitle 15/600 `band-small`), `extra` under the title (a
    segmented control), then the sheet (`bg-ground`, 28 px top corners, overlapping the band
    by 28 px); `hero` straddles the sheet edge; the slim band (64 px: `left`, title 22 px
    one line, `right`) appears when `bandMode` says `slim`. Long titles wrap to two lines,
    then ellipsis.
  - `<BandButton icon: IconName label: string href?: string onclick?: () => void />` — bare
    cream icon, 44 px hit area, `aria-label`.
  - `<HeroCard title: string meta?: string icon?: IconName href?: string onclick?: () => void />`
    — white/`surface` card, 22 px radius, title in `font-display` 25/800, meta 13/600 muted,
    a 52 px solid accent round button with the icon (default `play`).

- [ ] **Step 1: Write the failing test:** `bandMode(0, false)` → `full`; `bandMode(0, true)` →
  `compact`; `bandMode(147, false)` → `full`; `bandMode(148, false)` → `slim`;
  `bandMode(112, true)` → `slim`.
- [ ] **Step 2: Run** `npx vitest run src/lib/nav/band.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `band.ts`, then the three components to the design system board
  (part 3, "Band headers & hero card"). `Screen` reads scroll with a passive listener;
  the slim band fades in (no motion under `prefers-reduced-motion`).
- [ ] **Step 4: Run** `npx vitest run` and `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): band, sheet and hero card`.

### Task 8: Controls

**Files:**
- Modify: `src/lib/components/ui/styles.ts`
- Create: `src/lib/components/ui/Segmented.svelte`, `Switch.svelte`, `Banner.svelte`, `Badge.svelte`, `EmptyState.svelte`, `Spinner.svelte`
- Test: `src/lib/components/ui/styles.spec.ts`

**Interfaces:**
- Produces (class-string builders, as `styles.ts` already does for `FIELD`):
  `button(kind: 'primary'|'secondary'|'tertiary'|'danger'|'danger-text', size: 'sm'|'md'|'lg' = 'md', full = false): string`;
  `iconButton(variant: 'bare'|'tonal'|'filled'|'step'): string`;
  `FIELD` (52 px, radius 14, `field-line` outline, `focus:` ring, `aria-invalid:` danger
  outline), `FIELD_ERROR` (text under a field: 13 px `danger`), `LABEL`, `CHIP` (solid pill;
  checked = `bg-accent text-on-accent`), `GROUP` (surface, radius 16), `ROW` (min-h 56, px 16,
  hairline between rows via `divide-hairline` on `GROUP`), `SECTION_LABEL`.
  Components: `<Segmented items: {value, label}[] value onBand?: boolean name: string />`
  (radio group; on the band: cream track at 16 %, selected solid cream with band-coloured
  text); `<Switch checked label />` (a `role="switch"` checkbox); `<Banner kind: 'info'|'warning'|'error'|'success' title? children action? />`;
  `<Badge tone: 'neutral'|'accent'|'status'|'danger'|'warn'|'done' solid? />`;
  `<EmptyState icon title body? action? />`; `<Spinner size? label? />`.

- [ ] **Step 1: Write the failing test:** `button('primary')` contains `bg-accent` and
  `text-on-accent`; `button('danger')` contains `bg-danger`; `button('tertiary')` has no
  `bg-`; `button('primary', 'lg', true)` contains `w-full`; every builder's output contains
  `disabled:` styling; `CHIP` contains `has-checked:bg-accent`.
- [ ] **Step 2: Run** `npx vitest run src/lib/components/ui` — Expected: FAIL.
- [ ] **Step 3: Implement** to the design system board (parts 1–2: Buttons, Fields, Selection,
  Feedback). Loading state of a button is the caller rendering `<Spinner>` in place of the
  label and keeping the width.
- [ ] **Step 4: Run** `npx vitest run` and `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): buttons, fields, chips, segmented, switch, banners`.

### Task 9: Sheets, dialogs, toasts, loading

**Files:**
- Modify: `src/lib/components/ui/Sheet.svelte`, `src/lib/components/ui/UnsavedDialog.svelte`, `src/lib/components/shell/NavProgress.svelte`, `src/lib/components/shell/PageSkeleton.svelte`
- Create: `src/lib/components/ui/Dialog.svelte`, `src/lib/components/ui/Toast.svelte`
- Delete: `src/lib/components/routines/UndoToast.svelte` (its one user moves to `Toast`)
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte` (import change only)

**Interfaces:**
- Produces:
  - `Sheet` gains `back?: () => void` (Back arrow on the left instead of ×), `footer?: Snippet`
    (pinned, hairline above), `sub?: string`; a grabber; title in `font-display` 22/800;
    `bg-sheet`; 28 px top corners. Behaviour (history stack, unsaved guard, Escape, backdrop)
    unchanged.
  - `<Dialog open title body? icon? tone?: 'default'|'danger' actions: Snippet onclose />` — a
    modal `<dialog>` (`bg-raised`, radius 22) for every former `confirm()`; same history-stack
    registration as `Sheet`.
  - `<Toast toast: { id: number; message: string; action?: string } | null onaction?: () => void ondismiss: () => void bottom?: string />`
    — inverse colours, action in `inverse-accent`, 6 s, keyed by `id` (keep UndoToast's comment).
  - `NavProgress`: cream bar (`band-ink`) at the top edge.
  - `PageSkeleton`: draws the band (title of the target page if known) and skeleton rows in
    `skeleton`.

- [ ] **Step 1: Run** `npx vitest run` — Expected: PASS (baseline; these are components with
  their logic already in pure modules).
- [ ] **Step 2: Implement** the five components to the design system board (part 3: Bottom
  sheet, dialog, toast; Feedback). `UnsavedDialog` keeps its three answers and its
  `guard.svelte.ts` wiring; only its look changes.
- [ ] **Step 3: Run** `npx vitest run` and `npm run check` — Expected: PASS.
- [ ] **Step 4: Look** in the dev server: open a sheet (New exercise on Today), close it with
  a typed name (Unsaved dialog), delete a slot in a routine (Toast with Undo).
- [ ] **Step 5: Commit** `feat(ui): sheets, dialogs and toasts in the new look`.

### Task 10: The kit gallery and the docs

**Files:**
- Create: `src/routes/dev/kit/+page.svelte`, `src/routes/dev/kit/+page.ts`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`

- [ ] **Step 1:** `+page.ts`: `import { dev } from '$app/environment'`; throw
  `error(404)` when `!dev`. The page (wrapped in `data-dance` with a salsa/bachata toggle
  local to the gallery; light/dark follows the system — check both with the browser's
  emulated colour scheme) renders every
  component from Tasks 5–9 in every state, a `Screen` with a long Spanish title ("Dile que
  no con vuelta · Doble con mano", "Montaña · Caída"), and all icons.
- [ ] **Step 2: Run** `npm run check` — Expected: PASS. Open `/dev/kit` and compare with the
  design system board parts 1–3 in both dances and schemes.
- [ ] **Step 3:** `CLAUDE.md`: add the redesign spec to the specs paragraph; Layout gains
  `src/lib/theme/` (tokens.ts is the colour source; layout.css copies it, a spec checks),
  `src/lib/icons/`, `src/lib/nav/tabs.ts` and `band.ts`, `/dev/kit`, and
  `docs/superpowers/design-kit/`; the `make-icons.sh` line now says it rasterises the two
  icon SVGs. Main design spec: one line under its nav/UI section pointing to the redesign
  spec for the look and the four tabs.
- [ ] **Step 4: Commit** `docs: the redesign foundation in CLAUDE.md and the kit gallery`.

---

## Carried to later plans (from the foundation's reviews)

Built and reviewed 2026-10-31 (commits e906b57..60bad13). These came out of
the reviews and belong to the plans named:

- **Figure plan:** the VariationBar still sits at the old tab bar's offset (a
  gap under it now that pushed screens have no tab bar).
- **Moves plan:** the coverage selection bar (`coverage/+page.svelte`, 4.5rem)
  is at the old offset. **Routine plan:** same for `routines/SelectionBar.svelte`.
- **Today plan:** HeroCard has no disabled / "nothing due" state yet (the kit
  has one); check its 52 px button / 13 px meta against the kit's 54 / 14.
- **System plan:** NavProgress is cream, invisible on pages without a band
  (login, pairing, share); the Android navigation-bar strip stays the tab bar's
  colour under pushed screens; give `/dev/kit` nothing more than it has.
- **Settings plan:** the Switch's off track is below 3:1 against the ground
  (non-text contrast) — decide before Settings leans on switches.
- **Every area plan:** use `text-accent-text`, not bare `text-accent`, for
  small accent text (salsa light accent is 4.18:1 on the ground).
- **Cleanup plan:** remove the old token aliases; first make the stylesheet
  spec compare per theme block (today it only checks each hex appears); add a
  check against bare `text-accent` on text; a scrim token (the 45 % black is
  repeated in Sheet, Dialog, UnsavedDialog); `BAND_TRACK` and Segmented's
  `bg-black/15` are two copies of one value; Dialog/Sheet header padding order;
  icons.spec counting aliases; `PUBLIC_PATHS` lists `/icon-192.png` and
  `/icon-512.png` that don't exist, and its comment still says TWA; the bachata
  pages use the salsa favicon; `aria-invalid` thickens the field border (1 px
  shift).
  Done in plan 13.
