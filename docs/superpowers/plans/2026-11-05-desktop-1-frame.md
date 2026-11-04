# Desktop plan 1 — the frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 1024 px wide, every page sits in the desktop frame (an 88 px band row, a 188 px band-coloured side, the sheet), bottom sheets are centred dialogs, and the list-and-pane machinery exists and is proven on Music, while the phone stays pixel-for-pixel as it is.

**Architecture:** One DOM, restyled by a Tailwind custom variant `desk` (`@media (width >= 1024px)`). **The window stays the scroller** for the page (or the open item): the band row and the side are `position: fixed` on desktop and the content is offset under and beside them, so every page's kept scroll, `bind:scrollY` and `scrollTo` keep working. A list column is a `position: sticky` column with its own `overflow-y: auto`, rendered once by a section layout (`ListPane`); a `Screen` rendered inside a pane draws its header as the pane's header on desktop. Behaviour that must differ (focusing a search on open) reads a `MediaQuery`; layout never does (no hydration flash).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest; Playwright (Python, from nixpkgs) for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-03-desktop-design.md` (read "The frame", "A list and the item beside it", "Popups are dialogs", "Keyboard and focus", "Building it"). Boards: `docs/superpowers/design-kit/desktop/` (README says how to render them; compare with `out/boards/<theme>/<area>--<id>.html`).

This is plan 1 of 5. Later plans (drafted separately): 2 Today, 3 Moves and Positions, 4 Lessons and Groups, 5 Practice, Settings and the rest. They rely on this plan's Interfaces blocks, so keep the names.

## Global Constraints

- The desktop applies from **1024 px** window width; below it nothing changes, ever. The phone at 390 px must match the baseline screenshots of Task 1.
- Measures (spec): band row **88 px**; side **188 px**, its items **144 px wide, 48 px tall, centred** (22 px each side), rows 4 px apart, icon 24, label 16/700, lit = cream pill radius 24, label in band colour at 800; title Bricolage 800 **46 px** cream, compact rule as the phone's; subtitle 15/600 `band-small` on the title's line, 14 px after it; title 30 px from the window's left edge; actions 30 px from the right edge in 44 px hit areas; sheet from x 188 / y 88, `ground`, **28 px radius top-left only**; content padded 28 top / 40 sides; max widths **1140** (two columns), **720** (one), **640** (song, Practice setup, a lesson's edit), **560** (errors, share); list column **360 px** (Today 400), divided from the pane by a `hairline` rule; dialogs **560** (small **480**), radius 28 all corners, shadow `0 24px 70px rgb(0 0 0 / 0.32)`, max height `min(780px, 100dvh - 64px)`, no grabber, side padding 28.
- Colours only from tokens and the builders in `ui/styles.ts` (CLAUDE.md "A colour on a built control is the builder's"; `swap()` only in `.ts`).
- No new feature, no data-model change, no migration, no URL change. PAGE_EPOCH stays (no form or API changes shape).
- `npm run check` must pass at the end of every task (`nix develop --command npm run check`; in a worktree `npm` is only on PATH inside `nix develop`).
- **Builder checklist (read before every task; reviewers keep finding these):**
  - Error paths: a button that goes busy must come back on failure; a refused action shows its message.
  - Tests must fail without the change. For each new test, name the mutation that would make it fail (remove the class, swap the branch) and check it does.
  - The browser and the tests can disagree: CSS, media queries and layout are not in vitest. Every task that changes what is drawn ends with a screenshot check (Task 1's rig) at 1440 and at 390.
  - Order: nothing is marked done/open/saved before the work it stands for has happened.
  - Forms in a layout's list column post to the list route's explicit action URL (`action="/{dance}/songs?/retry"`), never a bare `?/x`: on an item route a bare `?/x` posts to the item's actions.

## Review Focus

1. **A window resized across 1024 px** with a dialog open or an item open: nothing is lost; the dialog becomes a sheet and back, the open item stays open (Task 5 and Task 9 each check a resize in the screenshot step).
2. **Group mode at desktop width**: navy band row and side, the stripe along the window's top, Mine in place of Today (Task 3, Task 4: screenshot in group mode).
3. **A list-column form on an item route** (Music's Retry on a failed song while a song is open) posts to the list route (Task 9: a spec on the action URL).
4. **The phone's list page after the move into a layout**: the same DOM order for the band, search and rows, the same scroll keep (Task 9: phone screenshot diff = 0 and the existing songs specs pass).
5. **Keyboard**: Esc closes the top dialog only; Tab order is band row, content, side; the side's lit item has `aria-current="page"` (Task 3, Task 5).

---

### Task 1: The screenshot rig and the phone baseline

**Files:**
- Create: `scripts/shots/shots.sh`, `scripts/shots/shots.py`, `scripts/shots/pages.txt`, `scripts/shots/README.md`

**Interfaces:**
- Produces: `scripts/shots/shots.sh <db-copy> <out-dir> <width>x<height> [--theme light|dark] [--pages FILE]` — boots `vite dev` on a free port inside `nix develop` with `DATA_DIR`/`DATABASE_PATH` pointing at a throwaway copy, inserts a session row, shoots every page in `pages.txt` (one path per line, `{dance}` and `{figure}`/`{song}`/`{lesson}`/`{routine}`/`{group}`/`{position}`/`{exercise}` filled from the db), and writes `<out-dir>/<slug>.png`. `scripts/shots/shots.py diff <dirA> <dirB>` prints `<slug> <changed-pixels>` per page and exits 1 if any page differs.

- [ ] **Step 1: Write the rig.** `shots.sh` copies the db given to a `mktemp -d` dir (never `.data`, never `$DATA_DIR`), sets the env INSIDE `nix develop --command bash -c '…'` (a prefix outside is clobbered by the flake), starts `npx vite dev --port <free>`, waits for `/health`, inserts `insert into sessions (id, user_id, expires_at, created_at) values ('shots', <first admin user id>, <now+1d>, <now>)`, runs `shots.py shoot`, then kills the server **by its PID** (never `pkill -f`) and deletes the temp dir. `shots.py` runs under the Playwright command in the README (`nix shell --impure --expr 'with (builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux; python3.withPackages (p: [p.playwright])'`, `PLAYWRIGHT_BROWSERS_PATH` from nixpkgs' `playwright-driver.browsers`), sets cookie `salsa_session=shots`, `colorScheme` from `--theme`, waits for network idle plus 300 ms, full-page screenshot. `diff` uses Pillow (`python3.withPackages (p: [p.playwright p.pillow])`): a size mismatch counts as changed, else the count of non-zero pixels in `ImageChops.difference`.
- [ ] **Step 2: `pages.txt`** lists at least: `/{dance}`, `/{dance}?day=<yesterday>`, `/{dance}/exercises/{exercise}`, `/{dance}/figures`, `/{dance}/figures/{figure}`, `/{dance}/moves/{move}`, `/{dance}/coverage`, `/{dance}/routines`, `/{dance}/routines/{routine}`, `/{dance}/positions`, `/{dance}/positions/{position}`, `/{dance}/positions/map`, `/{dance}/lessons`, `/{dance}/lessons/{lesson}`, `/{dance}/groups`, `/{dance}/groups/{group}`, `/{dance}/songs`, `/{dance}/songs/{song}`, `/{dance}/player`, `/settings`, `/settings/storage`, `/voice`, `/admin`, `/app`, `/{dance}/does-not-exist`. `{dance}` = salsa. Ids are the first live row of each kind owned by the admin (or reached by them, for a group).
- [ ] **Step 3: Take the baseline before any desktop change.** `scripts/shots/shots.sh <db> <scratch>/base-390 390x844` and again `--theme dark`. The db is a copy of the latest production backup the controller hands you (path in the task prompt); it must never be committed. Expected: one PNG per page, none an error page except the 404 line.
- [ ] **Step 4: Check the diff tool** by shooting the baseline twice: `shots.py diff base-390 base-390-again` prints all zeros and exits 0. (If a page is not stable, e.g. a clock, mask it in `shots.py` with a CSS `visibility:hidden` on `[data-shots-mask]`, and add that attribute to the clock element only.)
- [ ] **Step 5: Commit** `scripts/shots/` (`chore(desktop): a screenshot rig for the desktop build`).

### Task 2: The width variant and the frame's pure parts

**Files:**
- Modify: `src/routes/layout.css` (the variant and frame variables)
- Create: `src/lib/nav/frame.ts`, `src/lib/nav/frame.spec.ts`, `src/lib/nav/desk.svelte.ts`
- Modify: `src/lib/nav/tabs.ts` only if a helper is shared (no behaviour change)

**Interfaces:**
- Produces:
  - CSS: `@custom-variant desk (@media (width >= 1024px));` so classes read `desk:…`. Custom properties on `:root`: `--side-w: 0px; --band-row-h: 0px; --pane-left: 0px;` and under the desk media query `--side-w: 188px; --band-row-h: 88px; --pane-left: var(--side-w);`.
  - `export type Frame = 'side' | 'bare' | 'card' | 'none'` and `frameOf(routeId: string | null, signedIn: boolean): Frame` in `frame.ts`: `'side'` for every route of a dance but Practice and share, and for `/settings`, `/settings/storage`, `/voice`, `/admin`; `'bare'` for `/[dance]/player` and `/[dance]/share`; `'card'` for `/login`, `/join`, `/welcome`, `/app`, `/device/pair`, `/g/[code]`; `'none'` otherwise (the dev kit, `null`).
  - `sideLit(path: string, dance: DanceSlug): TabId | 'settings' | null` — `tabFor(path, dance)` inside the dance; `'settings'` for `/settings`, `/settings/storage`, `/voice`, `/admin`; else null.
  - `isDesk` in `desk.svelte.ts`: `export const desk = new MediaQuery('(width >= 1024px)', false)` (svelte/reactivity). Behaviour only, never layout.

- [ ] **Step 1: Write the failing tests** in `frame.spec.ts`: `frameOf('/[dance]/figures/[id]', true) === 'side'`, `frameOf('/[dance]/player', true) === 'bare'`, `frameOf('/[dance]/share', true) === 'bare'`, `frameOf('/login', false) === 'card'`, `frameOf('/g/[code]', true) === 'card'`, `frameOf('/settings/storage', true) === 'side'`, `frameOf('/admin', true) === 'side'`, `frameOf('/dev/kit', true) === 'none'`, `frameOf(null, true) === 'none'`; `sideLit('/salsa/figures/3', 'salsa') === 'moves'`, `sideLit('/settings/storage', 'salsa') === 'settings'`, `sideLit('/voice', 'salsa') === 'settings'`, `sideLit('/bachata', 'salsa') === null`. Plus: every route id under `src/routes` (glob the `+page.svelte` files, as `bands.spec.ts` does) has a frame other than `'none'`, except `/dev/kit` and the API.
- [ ] **Step 2: Run** `nix develop --command npx vitest run src/lib/nav/frame.spec.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** `frame.ts`, `desk.svelte.ts` and the CSS.
- [ ] **Step 4: Run** the spec — PASS; `npm run check` passes.
- [ ] **Step 5: Commit** (`feat(desktop): the desk width and which frame a page gets`).

### Task 3: The side and the frame in the root layout

**Files:**
- Create: `src/lib/components/shell/Side.svelte`, `src/lib/components/shell/SheetCorner.svelte`
- Modify: `src/routes/+layout.svelte`, `src/lib/components/shell/BottomNav.svelte` (hidden on desk)

**Interfaces:**
- Consumes: `frameOf`, `sideLit`, `TABS`, `tabHref`, `intend`, `minePath`, `groupsTabLabel` (as `BottomNav` uses them).
- Produces: `<Side dance={DanceSlug} path={string} />` — the `<nav aria-label="Main">` on desktop; `BottomNav` gets `desk:hidden` and keeps its own `aria-label="Main"` (only one is displayed, so only one is in the accessibility tree). The root layout's content wrapper: `desk:ml-[var(--side-w)] desk:pt-[var(--band-row-h)] desk:max-w-none` for `'side'` frames, `desk:pt-[var(--band-row-h)] desk:max-w-none` for `'bare'`; the 560 px cap and the tab-bar padding apply below 1024 only; `--pin-bottom` is `0px` on desk.

- [ ] **Step 1: Write `Side.svelte`.** Fixed, `top: var(--band-row-h)`, `left: 0`, `bottom: 0`, `width: var(--side-w)`, `bg-band`, `hidden desk:flex flex-col justify-between`, padding 6 top / 20 bottom. Items as the spec's measures; the lit one (`sideLit`) is the cream pill with `aria-current="page"`, filled icon, `--icon-knockout` set to the cream so filled icons cut out correctly. Groups' dot: 9 px, cream (band colour on the lit pill), `aria-label` from `groupsTabLabel(true)` as the tab bar does. In group mode Today is Mine: the same one-tap form as `BottomNav` (post to `/{dance}/group-mode`, `team=mine`, `to=minePath(path, dance)`), back icon and the word, never lit. Settings links to `/settings` at the bottom. The tab hrefs and the lit tab's tap-to-top are `BottomNav`'s logic: lift `tap()` and `targets` into a small shared module (`src/lib/nav/tab-links.svelte.ts`) used by both, so they cannot drift.
- [ ] **Step 2: Write `SheetCorner.svelte`.** A fixed 28×28 piece at `left: var(--side-w)`, `top: var(--band-row-h)`, band-coloured with a `ground` quarter circle cut out (radial gradient), `pointer-events: none`, `aria-hidden`, `hidden desk:block`, under any dialog and over the scrolling content. For `'bare'` frames, two corners (left 0 and right 0).
- [ ] **Step 3: Wire the root layout:** compute `frame = frameOf((ahead ?? page).route.id, nav)`; render `<Side>` when `frame === 'side'` and signed in; `<SheetCorner>`; the wrapper classes above. Give `body` the band colour under the desk media query in `layout.css` (only when a frame shows: a `data-frame` attribute on the wrapper and `body:has([data-frame="side"], [data-frame="bare"])`), so the window around the sheet is band; the sheet area is the content wrapper's `bg-ground` with `min-h-dvh`.
- [ ] **Step 4: Screenshot check.** Shoot `pages.txt` at 1440×900 and 390×844. At 1440: the side matches board `today--a-today` (side and corner only; the band row is Task 4). At 390: `shots.py diff base-390 now-390` exits 0. Also shoot one page in group mode (set the group-mode cookie in `shots.py` with `--group <id>`): navy side, Mine at the top.
- [ ] **Step 5: Commit** (`feat(desktop): the side and the sheet's frame`).

### Task 4: Screen's band row on desktop

**Files:**
- Modify: `src/lib/components/ui/Screen.svelte`, `src/lib/components/ui/BandButton.svelte` (only if its hit area differs), `src/lib/nav/band.ts` (+ spec)

**Interfaces:**
- Produces: `export const PAGE_WIDTH = { one: 720, two: 1140, song: 640, narrow: 560 } as const` and `export type PageWidth = keyof typeof PAGE_WIDTH` in `src/lib/nav/frame.ts`; `Screen` gains `width?: PageWidth` (default `'one'`), applied on desk only as the content's max width, centred, padded 28 top / 40 sides. On desk the header is the band row: `fixed` top 0, full window width, height 88, a three-column grid from `var(--side-w)` to the right edge (title column reaching back to x 30, `extra` centred over the sheet, `right` 30 px from the edge). `bandMode(scrollY, compact, desk: boolean)` returns `'full'` or `'compact'` on desk, never `'slim'`.

- [ ] **Step 1: Failing test** in `band.spec.ts`: `bandMode(400, false, true) === 'full'`, `bandMode(400, true, true) === 'compact'`, `bandMode(400, false, false) === 'slim'` (unchanged phone rule).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** One header element restyled with `desk:` classes (no second copy): title and subtitle on one baseline-aligned line on desk (the subtitle 14 px after the title), `left` (Back) before the title, `extra` in the middle column, `right` on the right. The group line sits above the title (13/700); the stripe moves to the window's top edge on desk (`desk:fixed desk:top-0 desk:inset-x-0`). The slim band is `desk:hidden`. The sheet div: `desk:mt-0 desk:rounded-none desk:min-h-[calc(100dvh-var(--band-row-h))]`, padding and max width from `width`. `hero`: on desk it is the sheet's first card (no negative margin). The navigation progress bar stays at the window's top edge (it already is).
- [ ] **Step 4: Run** the spec — PASS. **Screenshot check** at 1440 against boards `settings--settings` (one column), `practice--setup-count` (bare frame) and `moves--figures` (band row only: Figures | Routines | Positions in the middle, + on the right); at 1280 and 1024 the toggle stays centred over the sheet; a 30-character title ends in an ellipsis. 390: diff 0.
- [ ] **Step 5: Commit** (`feat(desktop): the band row`).

### Task 5: Sheets become dialogs

**Files:**
- Modify: `src/lib/components/ui/Sheet.svelte`, `src/lib/components/picker/Picker.svelte`, the song popup component (find it with `grep -rln "song popup\|SongPicker" src/lib/components`), `src/lib/components/ui/PlayerLayer.svelte` (dialog look in the player on desk)

**Interfaces:**
- Produces: `Sheet` gains `size?: 'small'` (480 on desk). On desk: width 560 (480 small), `margin: auto`, radius 28, shadow, `max-height: min(780px, 100dvh - 64px)` (`tall` uses the same as its height), no grabber, header/body/footer side padding 28. The scrim already covers the window (native `::backdrop`). Stacked levels need nothing new: each is its own `showModal()` at the same centre; check that a stacked level of the same size covers the one below exactly.
- Picker and the song popup: `autofocus` their search input when `desk.current` is true at open.

- [ ] **Step 1: Implement** with a `@media (width >= 1024px)` block in Sheet's `<style>` (component styles cannot use the Tailwind variant; keep 1024 in one place by a comment pointing at `layout.css`). The existing 640 px rule stays for 640–1023.
- [ ] **Step 2: Screenshot check:** open New lesson, the shared picker (a figure's Starts in), the Link popup and its stacked level, and the group menu (`size="small"`) at 1440 — compare with boards `lessons--new-lesson`, `today--past-picker`, `lessons--link-stacked`, `groups--menu-owner`. Resize 1440 → 800 with the picker open: it becomes the bottom sheet, still open, search text kept. 390: diff 0 (shots with no sheet open).
- [ ] **Step 3: Keyboard:** Esc closes only the top level; focus returns to the opener (existing). Verify by hand in the browser at 1440 (Playwright: press Escape, assert `document.activeElement` is the opener).
- [ ] **Step 4: Commit** (`feat(desktop): bottom sheets are centred dialogs`).

### Task 6: Pinned bars, toasts and the reload bars

**Files:**
- Modify: `src/lib/components/ui/BottomBar.svelte`, `src/lib/components/ui/Toast.svelte`, `src/lib/components/shell/ReloadBar.svelte`, `src/lib/components/figures/VariationBar.svelte` (position only, like the other bars; plan 3 replaces it on desk with the figure tabs)

**Interfaces:**
- Consumes: `--pane-left` (Task 2). Produces: on desk every pinned bar is `left: var(--pane-left)`, `right: 0`, `bottom: 0`, its inner max width from its `width` prop (below); a `ListPane` (Task 9) sets `--pane-left` to `calc(var(--side-w) + 361px)`. Toasts centre in the same box above a bar.

- [ ] **Step 1: Implement.** `BottomBar` gains `width?: PageWidth` (Task 4; default `'one'`): on desk its inner max width is `PAGE_WIDTH[width]` — the one way a bar gets its page's width, because nearly every page renders its `BottomBar` after `</Screen>` (lesson, figure, song, position, routine, Setup), outside any variable `Screen` could set. Pages whose `Screen` is not `'one'` pass the same `width` to their bar (in this plan: the song page, `'song'`). `ReloadBar` is rendered by the root layout: it uses `--pane-left` and a fixed 720 max. The rest is CSS.
- [ ] **Step 2: Screenshot check:** a routine in Edit (Save pinned), the exercise page (Log a set), Practice setup (Play). The reload bars: render `ReloadBar` in `/dev/kit` at desk width and shoot that. 390: diff 0.
- [ ] **Step 3: Commit** (`feat(desktop): pinned bars sit in their pane`).

### Task 7: Hover and pointer

**Files:**
- Modify: `src/routes/layout.css`, `src/lib/components/ui/styles.ts` (+ `styles.spec.ts`) only if a builder needs a hover token

- [ ] **Step 1:** Under `@media (hover: hover) and (width >= 1024px)`: rows, buttons, chips and side items get the overlay (ink 4 % light, white 5 % dark, cream 10 % on the band) lighter than the pressed one, and `cursor: pointer`. Implement as one rule on the existing interactive classes (find the pressed overlay rule and add its `:hover` twin), not per component. Respect `prefers-reduced-motion` for any transition.
- [ ] **Step 2:** `class-rules.spec.ts` and `styles.spec.ts` still pass; hover a row in the browser at 1440 and see the overlay; 390 diff 0 (Playwright does not hover by default).
- [ ] **Step 3: Commit** (`feat(desktop): hover`).

### Task 8: Card pages, the error page and Offline

**Files:**
- Modify: `src/routes/login/+page.svelte`, `src/routes/join/+page.svelte`, `src/routes/welcome/+page.svelte`, `src/routes/app/+page.svelte`, `src/routes/device/pair/+page.svelte`, `src/routes/g/[code]/+page.svelte` (and its error state), `src/lib/components/system/ErrorScreen.svelte`, the Offline layer in `src/routes/+layout.svelte`
- Create: `src/lib/components/shell/CardFrame.svelte`

**Interfaces:**
- Produces: `<CardFrame title={string}>{children}</CardFrame>` — on desk the window is band-coloured, the title on the band, the children in a centred card 480 wide, `ground`, radius 28; on the phone it renders exactly what the page renders today (wrap, do not restyle). The error screen inside a dance keeps the side and sits centred at 560; the side lights `sideLit` of the asked path. Offline covers the window, centred at 560.

- [ ] **Step 1: Implement**; `/g/[code]` with a code that no longer works shows its message in the card (board `groups--join-stale`) instead of the bare error page — only the presentation changes, the status code stays.
- [ ] **Step 2: Screenshot check** against `system--sign-in`, `system--join`, `system--welcome`, `system--get-the-app`, `system--not-found`, `system--offline`, `groups--join` (shoot `/login` with no cookie). 390: diff 0.
- [ ] **Step 3: Commit** (`feat(desktop): sign in and the other card pages, errors`).

### Task 9: A list and the item beside it — the machinery, on Music

**Files:**
- Create: `src/lib/nav/pane.ts`, `src/lib/nav/pane.spec.ts`, `src/lib/components/shell/ListPane.svelte`, `src/lib/components/shell/pane-context.ts`, `src/lib/components/songs/MusicList.svelte`, `src/routes/[dance]/songs/+layout.svelte`, `src/routes/[dance]/songs/+layout.server.ts`
- Modify: `src/routes/[dance]/songs/+page.svelte`, `+page.server.ts` (the list's load moves to the layout; actions stay), `src/routes/[dance]/songs/[id]/+page.svelte`, `src/lib/components/ui/Screen.svelte` (pane header), `src/lib/nav/trail.ts` (+ spec) for the kept filter

**Interfaces:**
- Produces:
  - `pane.ts` (PURE): `export type ListId = 'songs'` (plans 2–4 widen the union: `'today' | 'figures' | 'routines' | 'positions' | 'lessons' | 'groups'`); `listOf(routeId: string | null): { list: ListId; open: boolean } | null` — `'/[dance]/songs'` → `{ list: 'songs', open: false }`, `'/[dance]/songs/[id]'` → `{ list: 'songs', open: true }`, `'/[dance]/songs/[id]/grid'` → `null` (a page of its own). `paneBack(opener: string | null, list: ListId, dance: DanceSlug): boolean` — true when the item was opened from anywhere but its own list: false when the trail's opener path is the list's root **or under it** (another song open beside the list counts as the list), or null.
  - `layout.css` defines `@custom-variant two (@container cols (width >= 700px));` — the one two-column switch plans 3 and 4 use (700 px of content = a 780 px pane less its padding). The container (`container-type: inline-size; container-name: cols`) goes on a columns wrapper only (plan 3's `PaneColumns`), **never on the pane**: a size container becomes the containing block of `position: fixed` descendants, and the pinned bars live in the pane.
  - `pane-context.ts`: `setPane(): void` and `inPane(): boolean` (Svelte context, key a module-private symbol).
  - `<ListPane list={Snippet} isList={boolean} width={number = 360} title={string} subtitle?={string} extra?={Snippet} right?={Snippet} empty={Snippet}>{children}</ListPane>`:
    - desk: the band row (a `Screen`-identical band header, built by the same markup: extract Screen's header into `shell/BandHeader.svelte` and use it in both), then a flex row: the list column (`sticky top-[var(--band-row-h)] h-[calc(100dvh-var(--band-row-h))] overflow-y-auto`, width 360, `border-r border-hairline`) and the pane (`flex-1 min-w-0`, sets `--pane-left: calc(var(--side-w) + 361px)`, `setPane()`); the pane holds `children` on item routes and `empty` (centred) on the list route.
    - phone, list route: `<Screen {title} {subtitle} {extra} {right}>{list}</Screen>` exactly as the list page renders today; `empty` not rendered (`desk:` only wrapper with `hidden desk:flex`).
    - phone, item route: `children` only; the list column is in the DOM but `hidden` (`display: none`), so nothing in it is focusable or read.
  - `Screen` inside a pane on desk: no band row; its header is the pane header (name `display_s` 30/800 ink, subtitle under it, `left`'s Back only if `paneBack(...)`, `right` actions rendered as tonal icon buttons via a `BandButton` `tone="pane"` variant from `ui/styles.ts`); its sheet is the pane's content (no corner, no negative margin).
  - The open row: rows in `MusicList` get `aria-current="page"` and the `accent_soft` tint when their href is the current path.
  - The kept filter: `trail.ts` gains `keptFilter(listPath): string` / `keepFilter(listPath, q)` stored with the trail's kept state (sessionStorage), and `MusicList` on an item route filters on the client with `src/lib/songs/search.ts`'s existing match function; on the list route it keeps writing `?q=` as now.

- [ ] **Step 1: Failing tests** in `pane.spec.ts`: the three `listOf` cases above, `listOf('/[dance]/figures') === null` (not yet a pane), `paneBack('/salsa/songs', 'songs', 'salsa') === false`, `paneBack('/salsa/songs/4', 'songs', 'salsa') === false` (another song was open beside the list), `paneBack('/salsa/groups/3', 'songs', 'salsa') === true`, `paneBack('/salsa/songsx', 'songs', 'salsa') === true` (a prefix is not "under"), `paneBack(null, 'songs', 'salsa') === false` (a reload or a direct link: the list is beside it). In `trail.spec.ts`: `keepFilter('/salsa/songs', 'mambo')` then `keptFilter('/salsa/songs') === 'mambo'`; a different list path is `''`. A spec on `MusicList`'s forms: every `<form action=` in `MusicList.svelte` starts with `/{dance}/songs?/` (read the file as text, as `class-rules.spec.ts` does).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Move the list page's body into `MusicList.svelte` unchanged in markup; the layout loads the library (the current `+page.server.ts` load, moved into `+layout.server.ts`; `+page.server.ts` keeps the actions and returns nothing new). The songs `+page.svelte` renders only the empty pane ("Pick a song", the music icon, a button "Count only" opening Practice with the count only, board `music--music`). The song page's `Screen` is unchanged in code: it becomes the pane header through `inPane()`. The song pane is `width="song"` (640).
- [ ] **Step 4: Run** the specs and `npm run check` — PASS; the existing `songs-forms.spec.ts` and `group-songs.spec.ts` pass unchanged (if one reads the load from `+page.server.ts`, point it at the layout's load; do not weaken it).
- [ ] **Step 5: Screenshot check** against `music--music`, `music--song`, `music--music-search` (type in the list's search, open a match: the search stays), `music--song-adding`. Resize 1440 → 800 with a song open: the phone's song page, the list gone; back to 1440: the list is back beside it. The list column scrolls on its own while the song stays put. 390: diff 0 for `/salsa/songs` and `/salsa/songs/{song}`.
- [ ] **Step 6: Commit** (`feat(desktop): a list and the item beside it, on Music`).

### Task 10: Loading on desktop

**Files:**
- Modify: `src/lib/components/shell/PageSkeleton.svelte`, `src/lib/nav/pending.ts` (+ spec)

**Interfaces:**
- Consumes: `listOf` (Task 9), `frameOf` (Task 2). Produces: `skeletonFor(routeId)` also says whether the target is a list and pane (`pane: boolean`); `PageSkeleton` on desk draws the band row, the side (as Task 3, no lit change), and either one sheet of skeleton rows or a list column of rows beside a pane of skeleton cards.

- [ ] **Step 1: Failing test** in `pending.spec.ts`: `skeletonFor('/[dance]/songs/[id]').pane === true`, `skeletonFor('/settings').pane === false`.
- [ ] **Step 2:** Implement; PASS; screenshot the skeleton by delaying a load in dev (Playwright `route` with a 2 s delay on the `__data.json` request) and compare with `system--loading`. 390 unchanged.
- [ ] **Step 3: Commit** (`feat(desktop): loading draws the frame`).

### Task 11: The whole frame, checked

**Files:**
- Modify: `CLAUDE.md` (the Layout block: `src/lib/nav/frame.ts`, `pane.ts`, `desk.svelte.ts`, `shell/Side.svelte`, `ListPane.svelte`, `CardFrame.svelte`, `scripts/shots/`; one line in "Hard rules": forms in a list column post to the list route's action URL), the spec only if something was decided while building (a "Decided while building" section at its end)

- [ ] **Step 1:** Shoot every page of `pages.txt` at 1440×900, 1280×800 and 1024×768, light and dark, salsa and bachata (bachata: swap `{dance}`), and at 390 light and dark. 390 diffs against the baseline are all 0. Every desktop page has the frame, nothing overflows the window horizontally, nothing sits under the band row or the side.
- [ ] **Step 2:** `npm run check` passes.
- [ ] **Step 3: Commit** (`docs(desktop): the frame in CLAUDE.md`).
