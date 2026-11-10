# Page Changes (Motion Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone, a page change lifts the page's card on the tap, holds it empty while the page loads (dots after 0.5 s, "Still trying… Go back" after 8 s), and lands it at the new page's band, with the words fading out and in.

**Architecture:** One pure module decides the edges and the kind of move (`src/lib/motion/page-move.ts`). One runtime module (`page-move.svelte.ts`), wired once in the root layout, moves the real elements: the Screen's `<main>` (the card), its `BandHeader` (`main.previousElementSibling`) and the slim band (`[data-slim-band]`). It uses Web Animations from round 1's `play()`. No copies of pages: SvelteKit keeps the old page mounted while the new one loads, so the lift and the abandon act on it. The landing acts on the new page in `afterNavigate`, before it paints (FLIP).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Web Animations, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-page-transitions-design.md` (and round 1's `2026-11-10-motion-round-1-design.md` for the vocabulary and the Done landing).

## Global Constraints

- Phone only: below 1024 px (`desk.current` false). The desktop keeps its skeleton and `NavProgress`, and only gains the "Still trying" line (Task 7).
- Values (spec table): lift 70 px; up 200 ms ARRIVE; words out 130 ms LEAVE; dots after 500 ms, 900 ms pulse, 150 ms stagger, 46 px below the edge; still line after 8000 ms; down 320 ms ARRIVE; words in 240 ms ease-out from 60 ms; corners 260 ms; dots and line out 120 ms LEAVE; full-screen page fade 200 ms ease-out.
- Never above the slim band's foot. A card under the slim band is square. Its corners are otherwise 28 px (`rounded-t-[28px]`, Screen).
- `transform` and `opacity` only, plus `border-radius` on the card. No new dependencies. Use round 1's `play()`, `MS`, `ARRIVE`, `LEAVE` and `reducedMotion()` (`src/lib/motion/motion.ts`).
- Reduced motion: no lift, no fades. The dots (still, not pulsing) and the line still show, over the old card.
- Nothing waits on motion. A tap while the card is up or moving takes over from where it is drawn.
- No seam: any band-coloured fill used during a move is exactly `bg-band` and fades as one piece.
- Words through `t()`, in en and sl. Colours from the tokens. Hard rules unchanged. No `PAGE_EPOCH` change.
- *Ruling (plan vs spec):* the spec lists `VersionsSheet` among in-page steps. Its only navigation is the copy toast's Open (`Versions.svelte`), which opens another figure, so it lifts like any page. The in-page steps are `VariationBar`'s pick and its ‹ › links. The Moves list's filters are query-only, so they never move.
- Build natively (CLAUDE.md "Building in a slot"). Per task: its specs with `nix develop -c npx vitest run --maxWorkers=4 <files>`, then `npx eslint` and `npx prettier --check` on the changed files, then commit. Run the full `npm run check` before the final review and again after merging master in.

## Review Focus

1. **A refresh while the card is up** (`refreshWhenSettled`, a sync landing, the app coming back on screen): SvelteKit drops the navigation and `$lib/nav/dropped.ts` runs it again. Expected: the card stays up and lands when the retry lands. It must never stay up with no navigation under way (Task 3's rig check "refresh while held").
2. **Back while the card is up** (the ‹, Android's Back, a swipe): expected, the card waits for that page and lands on it (Task 3's rig check "back while held").
3. **A band that grows after its first draw** (a font, the group row, a two-line title): expected, the card lands where the band ends once drawn, with no jump after the landing (Task 3 measures in `afterNavigate` after `tick()`, plus the rig check "group page").
4. **A tap during the landing**: expected, the card lifts again from where it is drawn, with no snap (Task 3's unit test on `drawnEdge`, plus the rig check "tap while landing").
5. **Known offline**: the layout's `beforeNavigate` cancels the navigation and opens the Offline layer. Expected: the card never lifts, because the trigger is `navigating.to`, which a cancelled navigation never sets (Task 3's rig check "offline").

---

### Task 1: The pure rules

**Files:**
- Create: `src/lib/motion/page-move.ts`
- Test: `src/lib/motion/page-move.spec.ts`

**Interfaces:**
- Produces:
  - `PAGE_MOVE` (as const): `{ lift: 70, up: 200, wordsOut: 130, dotsAfter: 500, stillAfter: 8000, down: 320, wordsIn: 240, wordsInDelay: 60, corners: 260, quietOut: 120, screenFade: 200, dotsBelow: 46 }`.
  - `type Edge = { y: number; square: boolean }`.
  - `visibleEdge(cardTop: number, slimFoot: number | null): Edge`.
  - `heldEdge(edge: number, slimFoot: number | null, lift = PAGE_MOVE.lift): number`.
  - `type PageShape = 'card' | 'screen' | 'frame'`.
  - `shapeOf(routeId: string | null): PageShape`.
  - `type MoveKind = 'lift' | 'words' | 'none'`.
  - `moveKind(from: { routeId: string | null; path: string }, to: { routeId: string | null; path: string }, o: { desk: boolean; inPage: boolean }): MoveKind`.
  - `drawnEdge(top: number, transformY: number): number`, the edge as drawn mid-animation (`top + transformY`).

- [ ] **Step 1: Write the failing tests**

```ts
describe('visibleEdge', () => {
	it('is the card top while it shows below the slim band', () =>
		expect(visibleEdge(172, 64)).toEqual({ y: 172, square: false }));
	it('is the slim band foot, square, when the card runs on under it', () =>
		expect(visibleEdge(-40, 64)).toEqual({ y: 64, square: true }));
	it('with no slim band shown, is the card top', () =>
		expect(visibleEdge(131, null)).toEqual({ y: 131, square: false }));
});
describe('heldEdge', () => {
	it('lifts 70 px', () => expect(heldEdge(172, 64)).toBe(102));
	it('never above the slim band foot', () => expect(heldEdge(131, 64)).toBe(64));
	it('already at the slim band: stays', () => expect(heldEdge(64, 64)).toBe(64));
	it('never below where it is', () => expect(heldEdge(50, 64)).toBe(50));
});
describe('shapeOf', () => {
	it('Practice and the positions map are full screen', () => {
		expect(shapeOf('/[dance]/player')).toBe('screen');
		expect(shapeOf('/[dance]/(moves)/positions/map')).toBe('screen');
	});
	it('sign-in and welcome pages are frames; an unknown route too', () => {
		expect(shapeOf('/login')).toBe('frame');
		expect(shapeOf('/welcome/start')).toBe('frame');
		expect(shapeOf(null)).toBe('frame');
	});
	it('a dance page and Settings have the card', () => {
		expect(shapeOf('/[dance]/(moves)/figures')).toBe('card');
		expect(shapeOf('/settings')).toBe('card');
	});
});
describe('moveKind', () => {
	const at = (routeId: string, path: string) => ({ routeId, path });
	const figures = at('/[dance]/(moves)/figures', '/salsa/figures');
	const move = at('/[dance]/(moves)/moves/[id]', '/salsa/moves/11');
	const phone = { desk: false, inPage: false };
	it('a new path lifts', () => expect(moveKind(figures, move, phone)).toBe('lift'));
	it('the query only: still', () =>
		expect(moveKind(figures, at(figures.routeId, '/salsa/figures'), phone)).toBe('none'));
	it('the desktop: still', () => expect(moveKind(figures, move, { desk: true, inPage: false })).toBe('none'));
	it('a step inside the page: words only', () =>
		expect(moveKind(move, at(move.routeId, '/salsa/moves/12'), { desk: false, inPage: true })).toBe('words'));
	it('to or from a frame page: still', () => {
		expect(moveKind(figures, at('/login', '/login'), phone)).toBe('none');
		expect(moveKind(at('/login', '/login'), figures, phone)).toBe('none');
	});
	it('to and from a full-screen page: lift', () => {
		expect(moveKind(figures, at('/[dance]/player', '/salsa/player'), phone)).toBe('lift');
		expect(moveKind(at('/[dance]/player', '/salsa/player'), figures, phone)).toBe('lift');
	});
});
describe('drawnEdge', () => {
	it('adds the running transform', () => expect(drawnEdge(172, -35)).toBe(137));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run --maxWorkers=4 src/lib/motion/page-move.spec.ts`
Expected: FAIL, the module doesn't exist.

- [ ] **Step 3: Implement `src/lib/motion/page-move.ts`**

PURE, client-safe. `visibleEdge` is square when `cardTop < slimFoot`. `heldEdge` returns `min(edge, max(slimFoot ?? -Infinity, edge - lift))`. `shapeOf` gives 'screen' for the two full-screen route ids, and 'frame' when `frameOf(routeId, true)` (`$lib/nav/frame`) is 'card' or 'none'; everything else is 'card'. `moveKind` returns 'none' on the desktop, when either side is 'frame', or when `from.path === to.path`; 'words' when `inPage`; otherwise 'lift'.

- [ ] **Step 4: Run them to see them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Lint, format and commit**

```bash
git add src/lib/motion/page-move.ts src/lib/motion/page-move.spec.ts
git commit -m "feat(motion): page changes' rules: the card's edge, where it waits, which move"
```

### Task 2: Error screens and the new words

**Files:**
- Modify: `src/lib/nav/error-view.ts` (the 404 branch), its spec `src/lib/nav/error-view.spec.ts`
- Create: `src/lib/nav/signed-in.svelte.ts`, `src/lib/nav/signed-in.spec.ts`
- Modify: `src/routes/+layout.svelte` (the `nav` derived, about line 185), `src/routes/+error.svelte` (`frameOfError`'s second argument)
- Modify: `src/lib/i18n/en/shell.ts`, `src/lib/i18n/sl/shell.ts`

**Interfaces:**
- Produces:
  - `shownSignedIn(user: unknown, error: boolean, wasSignedIn: boolean): boolean`, which is `Boolean(user) || (error && wasSignedIn)`.
  - `signedIn = $state({ was: false })`, set true by the root layout whenever `data.user` is present.
  - `t().shell.wait.still` ("Still trying…"; sl "Še poskušam …"; check the glossary in `sl/index.ts`) and `t().shell.wait.back` ("Go back"; sl "Nazaj").

- [ ] **Step 1: Write the failing tests.** `errorView(404, …)` returns `code: null` (the "ERROR 404" line is gone). The other statuses keep their code. `shownSignedIn(null, true, true)` is true, `shownSignedIn(null, true, false)` is false, `shownSignedIn(null, false, true)` is false, and `shownSignedIn({ id: 1 }, false, false)` is true.
- [ ] **Step 2: Run them to see them fail:** `nix develop -c npx vitest run --maxWorkers=4 src/lib/nav/error-view.spec.ts src/lib/nav/signed-in.spec.ts`.
- [ ] **Step 3: Implement.** 404's `code: null`. `signed-in.svelte.ts` holds the state and the function. Root layout: `$effect(() => { if (data.user) signedIn.was = true; })`, and `nav` becomes `shownSignedIn(data.user, Boolean(page.error), signedIn.was) && page.url.pathname !== '/login'`. `+error.svelte` passes the same to `frameOfError`. Add the words to both catalogs.
- [ ] **Step 4: Run them to see them pass,** plus `src/lib/i18n` and the `no-english` spec (`npx vitest related` on the changed files).
- [ ] **Step 5: Rig check.** Shoot the offline error (a scene: `page.context.set_offline(True)`, then tap a row) on a copy of the latest `~/Backups/salsa/db` backup. The tab bar shows, and 404 has no "ERROR 404". Then commit: `fix(errors): the offline and server-error screens keep the tab bar; 404 says it once; the wait's words`.

### Task 3: The lift, the wait and the landing (phone)

**Files:**
- Create: `src/lib/motion/page-move.svelte.ts`, `src/lib/components/shell/PageWait.svelte`
- Modify: `src/routes/+layout.svelte`: call `pageMove()` once in the script. Render `<PageWait />` inside the nav wrapper, after `{@render children()}`. Show `PageSkeleton` only when `desk.current`, and `<NavProgress />` only when `desk.current`.
- Test: `src/lib/motion/page-move.spec.ts` (`drawnEdge` covers the takeover maths); behaviour in the rig (Step 5).

**Interfaces:**
- Consumes: Task 1's functions and `PAGE_MOVE`; round 1's `play`, `reducedMotion`, `ARRIVE`, `LEAVE`.
- Produces:
  - `moveState = $state({ phase: 'idle' as 'idle' | 'up' | 'held' | 'down', edge: null as number | null, square: false, since: 0 })`. `edge` is the held edge in viewport px; `since` is `performance.now()` at the tap.
  - `pageMove(): void`, called by the root layout once.
  - `goBack(): void`.
  - `settledIn(): number`, the ms until the card has landed (0 when idle).
  - `stepInPage(): void`, a one-shot flag the next navigation reads (Task 4).

- [ ] **Step 1: The lift.** Watch `navigating.to` (`$app/state`), not `beforeNavigate`, so a navigation the Offline layer cancels never lifts. When it turns non-null and `moveKind(...)` is 'lift':
  - Find the card: the `main` drawn by `Screen`. If there's none, there's nothing to lift.
  - Take `edge = visibleEdge(main.top, slim foot when [data-slim-band] isn't opacity-0, else null)` and `held = heldEdge(...)`.
  - Animate `main` `transform` to `translateY(held − edge)` (`PAGE_MOVE.up`, ARRIVE, fill forwards).
  - Fade out every child of `main`, of the header and of the slim band's inner row (`wordsOut`, LEAVE, fill forwards). Fade from their current opacity.
  - Set `moveState` to 'up', then 'held'.
  - While held, the page doesn't scroll (`overflow: hidden` on `html`, removed on landing).
  - If the card is already moving, start from `drawnEdge` (no snap).
- [ ] **Step 2: The landing.** In `afterNavigate`, after `await tick()` (Review Focus 3), when the phase isn't 'idle':
  - Find the new `main` and header.
  - Take `to = visibleEdge(...)`.
  - Set `main` to `translateY(held − to.y)` and its top radius to 0 if held square, otherwise 28 px, before paint.
  - Animate to none (`down`, ARRIVE) and to its own radius (`corners`).
  - Fade in the new words (`wordsIn`, ease-out, delay `wordsInDelay`).
  - Wherever the moved card uncovers what's behind the band, paint `bg-band`, e.g. a band-coloured `box-shadow` downward on the header for the move's length.
  - Clean up on finish: cancel the animations, take off the inline styles, back to 'idle'.
  - If the navigation ends without `afterNavigate` (`navigating` back to null with the old page still mounted: cancelled, Go back), land the old page the same way.
  - If the page it lands on has no card and isn't full screen (a redirect to Login, a welcome step), clean up at once: it just appears (spec, Failures).
- [ ] **Step 3: `PageWait.svelte`.** It's fixed and centred, at `top: edge + dotsBelow`, phone only, and draws only while the phase is 'up' or 'held':
  - The three dots fade in at `since + dotsAfter`: 10 px, `bg-band`, pulsing 900 ms with a 150 ms stagger. With reduced motion they don't pulse.
  - Under them, at `since + stillAfter`, a button reads `t().shell.wait.still` and **`t().shell.wait.back`**, calling `goBack()`.
  - Both fade out (`quietOut`) when the landing starts.
  - `goBack()` calls `goto(page.url, { replaceState: true, noScroll: true, keepFocus: true })`. It supersedes the hanging navigation, and the same page lands.
- [ ] **Step 4: Run the unit tests and the layout's existing specs.** Run `npx vitest related src/routes/+layout.svelte src/lib/nav/pending.ts`. Any phone skeleton assertion changes to desktop-only, with a ruling.
- [ ] **Step 5: Rig check.** Add a temporary scene file `scripts/shots/ext_pagemove.py`; delete it before the commit. Use a copy of the latest backup, at 390×844 with `--viewport`. Shoot frames with `page.screenshot` at set times; WAAPI runs in the rig. Look at:
  - Moves → Adios: up, held, down. Also with `__data.json` held 2 s: the dots. And held 9 s: the line, then Go back.
  - Moves scrolled down → Adios: square under the slim band, rounding on the way down.
  - Adios → ‹ (back while held, with the data held).
  - A refresh while held: `invalidateAll()` from the console while `__data.json` is held.
  - Tap while landing.
  - A group page.
  - Offline (`set_offline` then tap): the layer opens, with no lift.
  - No page errors.
- [ ] **Step 6: Commit:** `feat(motion): a page change lifts the card, waits and lands it (phone)`.

### Task 4: Steps inside a page

**Files:**
- Modify: `src/lib/motion/page-move.svelte.ts` (the 'words' kind), `src/lib/components/figures/VariationBar.svelte` (`pick`, and the ‹ › step links' `onclick`)

**Interfaces:**
- Consumes: `stepInPage()` from Task 3; `moveKind`'s `inPage` reads it (one shot, cleared on read).

- [ ] **Step 1:** 'words': no transform. Fade out the main's and the header's words (`wordsOut`), and fade in the new ones in `afterNavigate` (`wordsIn`). No dots unless the step waits; then the same `PageWait` shows at the current edge.
- [ ] **Step 2:** `VariationBar`: call `stepInPage()` before `gotoWhenSettled` in `pick`, and in an `onclick` on the ‹ › links.
- [ ] **Step 3: Rig check:** the switcher's ‹ › steps don't lift; only the words change. Commit: `feat(motion): a figure's switcher steps change the words, not the card`.

### Task 5: Full-screen pages

**Files:**
- Modify: `src/lib/motion/page-move.svelte.ts`

- [ ] **Step 1: Into a 'screen' page** (Practice, the map). Lift and wait as usual. In `afterNavigate` there's no `main`. Fade the new page's sheet in (`screenFade`, ease-out). Over it, a plain card shape (fixed, `bg-ground`, the held edge, the held corners, `pointer-events: none`, `aria-hidden`) fades out over the same time, then is removed.
- [ ] **Step 2: Out of one, to a 'card' page:**
  - The new `main` starts at `heldEdge(to.y, slim foot)`.
  - It fades in over `wordsOut` while landing (`down`), with the words as usual.
  - The band's words fade in.
- [ ] **Step 3: Rig check:** Practise from an exercise, then back. Also the map. Commit: `feat(motion): into and out of full-screen pages`.

### Task 6: Done lands after the card

**Files:**
- Modify: `src/lib/motion/flip.svelte.ts` (a `delay?: () => number` option, applied to the replay's animations only), `src/lib/components/today/TodayList.svelte` (`delay: settledIn`), `src/lib/components/today/TodayBar.svelte` (the frame-delayed swap waits `settledIn()` ms), `src/lib/components/today/ExerciseRow.svelte` (the `motion-pop` span gets `style:animation-delay="{settledIn()}ms"` when landed)

- [ ] **Step 1:** Add `delay`. The replay's rows start at their old places at once (FLIP inverted, as now). They start moving after `delay()` ms, so nothing paints in the new order first.
- [ ] **Step 2:** Wire Today's three parts to `settledIn()`.
- [ ] **Step 3: Run the specs:** `src/lib/motion` and `src/lib/components/today`. **Rig check:** Done from an exercise (round 1's scene steps). The card lands, then the rows move, the check pops and the bar fills, in that order. Commit: `feat(motion): Done's landing plays once the card has settled`.

### Task 7: The desktop's way out

**Files:**
- Modify: `src/lib/components/shell/PageSkeleton.svelte` (desk mode)

- [ ] **Step 1:** In desk mode, after `PAGE_MOVE.stillAfter` from when the skeleton came up, show the same line and Go back as `PageWait`, centred in the skeleton's pane. Reuse a snippet or a small `StillTrying.svelte` shared by both, with `goBack()`.
- [ ] **Step 2: Rig check at 1440×900** with the data held 9 s. Commit: `feat(nav): the desktop's skeleton offers Go back after 8 s`.

### Task 8: Docs and the full check

**Files:**
- Modify: `docs/features.md` (Motion: page changes), `docs/layout.md` (`page-move.ts`, `page-move.svelte.ts`, `PageWait.svelte`, `signed-in.svelte.ts`), the main design spec's "Pending navigation" section (the phone's wait is the lifted card now), `scripts/shots/README.md` (`DELAY_FROM` on the phone shoots the held card, not a skeleton)

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2:** Delete any temporary scene. Run the full `npm run check` (CLAUDE.md: before the final review). Commit `docs: page changes`.
