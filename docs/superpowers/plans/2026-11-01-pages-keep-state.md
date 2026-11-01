# Pages Keep Their Place — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each tab picks up where you left it, the band's back goes to the page you came from, and the tab bar shows on pushed screens. All of it lasts for the session only.

**Architecture:** A pure "trail" model (`src/lib/nav/trail.ts`) holds, per page, its kept query, scroll, title and opener, plus each tab's last page and the page in each history slot. A thin reactive wrapper (`trail.svelte.ts`) keeps one trail in `sessionStorage`, feeds it from `beforeNavigate`/`afterNavigate` in the root layout, and answers "where does this tab go" and "where does back go". The bar's visibility moves from "four screens" to "every dance page except Practice and share, unless a mode claims the bottom".

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-pages-keep-state-design.md` (read it first; the "my call" lines in it are decisions, not suggestions).

## Global Constraints

- Session only: `sessionStorage`, one key `nav-trail`. Every read and write in `try/catch`; blocked storage means "nothing remembered", never an error.
- Pure modules (`src/lib/nav/*.ts` without `.svelte`) import nothing from `$app/*` and touch no DOM; they get specs like `tabs.spec.ts`.
- Nothing under `$lib/server` is imported by components.
- Safe area through `--safe-*` only, never `env()` (`class-rules.spec.ts`).
- A colour on a built control is the builder's; never append `text-*` after `iconButton()` etc. (`class-rules.spec.ts`).
- SvelteKit's history slot index is `history.state['sveltekit:history']` (a number), the same way `src/lib/sheets/history.svelte.ts` reads `'sveltekit:states'`. Add a spec assertion next to `stack.spec.ts`'s key check if one exists, else a comment naming the SvelteKit source.
- The sheets' and the video player's history entries (`src/lib/sheets/`, `src/lib/video/player-history.ts`) must behave exactly as before. The trail never calls `pushState`.
- `npm run check` must pass at the end of every task.

## Review Focus

1. **Back that loops.** figure → lesson → (link) same figure → back must not bounce figure ↔ lesson forever. Pinned in Task 1 (`openerFor` cycle test).
2. **A remembered page that is gone** (variation archived, lesson deleted in another tab). A tab tap or back must land on the tab's list, not a 404. Pinned in Task 2 (gone fallback) and Task 4 (removals).
3. **Same-page navigations** (Figures chips/search `refilter`, `?add=1` cleanup, `invalidateAll` after a form) must not jump the scroll or reset the opener. Pinned in Task 1 (`replace` arrival keeps opener; same-path arrival restores no scroll).
4. **Sheets and the video player still close on Back.** The band's back uses `history.back()` only when the previous slot holds its target. A sheet's shallow entry is never a trail slot. Pinned in Task 2 (back-via-history test on `backMove`).
5. **The tab bar covering things:** an edit Save, the routine selection bar, Coverage's selection bar, the variation switcher, the exercise page's Log button, toasts, and the routine editor's drag auto-scroll edge. Pinned in Task 3 (each bar named in its steps) and in the final browser check.

---

### Task 1: The pure trail model

**Files:**
- Create: `src/lib/nav/trail.ts`
- Create: `src/lib/nav/trail.spec.ts`
- Modify: `src/lib/nav/tabs.ts` (exercise pages light Today; `rootsOf`)
- Modify: `src/lib/nav/tabs.spec.ts`

**Interfaces:**
- Consumes: `TabId`, `TABS`, `tabFor(path, dance)` from `tabs.ts`; `DanceSlug`.
- Produces (all exported from `trail.ts`):

```ts
export type PageKey = string; // a pathname, e.g. '/salsa/figures/12'
export interface Visit { search: string; scrollY: number; opener: PageKey | null; title: string }
export interface Trail {
	pages: Record<PageKey, Visit>;
	/** `${dance}:${tab}` → the last page seen in that tab (never Practice or share). */
	last: Record<string, PageKey>;
	/** `${dance}:${tab}` → the last main list seen in that tab (Moves: figures or routines). */
	lastRoot: Record<string, PageKey>;
	/** History slot index → the page in it. */
	entries: Record<number, PageKey>;
}
export const EMPTY_TRAIL: Trail;
export type Intent = 'tab' | 'back' | null;
export interface Arrival {
	to: PageKey; search: string; title: string;
	from: PageKey | null; // null: came from outside the app, or from a page outside a dance
	index: number; prevIndex: number | null;
	kind: 'enter' | 'pop' | 'push' | 'replace';
	intent: Intent;
}
export function keptSearch(search: string): string;
export function isTrailPage(path: string): boolean;            // under a dance: /salsa/..., /bachata/...
export function remembered(path: string): boolean;              // trail page, and not /<dance>/player or /<dance>/share
export function isRoot(path: string): boolean;                  // /<d>, /<d>/figures, /<d>/routines, /<d>/lessons, /<d>/songs
export function openerFor(t: Trail, to: PageKey, from: PageKey | null): PageKey | null;
export function arrive(t: Trail, a: Arrival): Trail;
export function leave(t: Trail, key: PageKey, scrollY: number): Trail;
export function forget(t: Trail, key: PageKey): Trail;
export function hrefOf(t: Trail, key: PageKey): string;         // key + kept search
export function backTarget(t: Trail, key: PageKey, fallback: { href: string; label: string }): { href: string; label: string; key: PageKey | null };
export function tabTarget(t: Trail, tab: TabId, dance: DanceSlug, current: PageKey): { href: string } | { scrollTop: true };
export function scrollFor(t: Trail, a: Arrival): number | null; // where to scroll after an arrival, null = leave it
export function parseTrail(raw: string | null): Trail;          // bad or missing JSON → EMPTY_TRAIL
```

- From `tabs.ts`: `tabFor` maps `exercises` → `'today'`; new `rootsOf(tab: TabId, dance: DanceSlug): string[]` (Moves → `['/<d>/figures', '/<d>/routines']`, others one path). `showsTabs` is untouched here (Task 3).

**Rules the code must follow** (each one is a test below):
- `keptSearch` drops `log`, `new`, `add`, `session`, `v`; keeps the rest in order; returns `''` or `'?…'`.
- Main lists (`isRoot`) always have `opener: null`.
- `openerFor`: a push from a trail page gives `from`, unless `to` is already on `from`'s opener chain (walk at most 50 steps). Then it keeps `to`'s existing opener. From `null` (outside the dance), it keeps the existing opener, or `null`.
- `arrive` by `kind`/`intent`:
  - `enter`: keep the record if there is one (reload), else `opener: null`.
  - `pop`: keep the opener.
  - `intent` `'tab'` or `'back'`: keep the target's opener.
  - `replace` (no intent): the opener carries over from `from`'s record. If `from === to`, nothing changes but the search.
  - `push`: `openerFor`.
  - Every arrival stores `search` (through `keptSearch`) and `title`, sets `entries[index] = to`, and on `push` deletes every entry above `index`. It sets `last[dance:tab]` when `remembered(to)`, and `lastRoot[dance:tab]` when `isRoot(to)`.
  - A non-trail `to` returns `t` unchanged.
- `leave` stores `scrollY` on the page's record (creates none).
- `forget` removes the page from `pages`, from `last`/`lastRoot` values, and from `entries`. Any record whose opener was it gets that page's own opener instead.
- `backTarget`: opener present and recorded → `{ href: hrefOf(opener), label: 'Back to ' + title, key: opener }`. Otherwise `{ ...fallback, key: null }`, with the fallback's href given its kept search when the fallback path has a record.
- `tabTarget`: if `tab === tabFor(current)`: on one of its roots → `{ scrollTop: true }`; else → `hrefOf(lastRoot ?? first root)`. If a different tab → `hrefOf(last ?? lastRoot ?? first root)`.
- `scrollFor`: `pop` and `enter` → `null` (the browser/SvelteKit restore). Same pathname as `from` → `null`. Otherwise → the record's `scrollY` if there is one, else `null`.
- Titles: the caller passes the title with the ` · <Dance label>` suffix already stripped.

- [ ] **Step 1: Write the failing tests** in `src/lib/nav/trail.spec.ts`. One `describe` per function; the cases that must exist:

```ts
const A = (o: Partial<Arrival>): Arrival => ({ to: '/salsa/routines', search: '', title: 'Routines', from: null, index: 1, prevIndex: null, kind: 'push', intent: null, ...o });

it('walks the opening case', () => {
	let t = EMPTY_TRAIL;
	t = arrive(t, A({ to: '/salsa/routines', kind: 'enter', index: 1 }));
	t = arrive(t, A({ to: '/salsa/routines/3', title: 'Basic loop', from: '/salsa/routines', index: 2, prevIndex: 1 }));
	t = arrive(t, A({ to: '/salsa/figures/12', title: 'Enchufla · Doble', from: '/salsa/routines/3', index: 3, prevIndex: 2 }));
	t = arrive(t, A({ to: '/salsa/lessons/5', title: 'Tue class', from: '/salsa/figures/12', index: 4, prevIndex: 3 }));
	expect(backTarget(t, '/salsa/lessons/5', { href: '/salsa/lessons', label: 'Back to Lessons' }))
		.toEqual({ href: '/salsa/figures/12', label: 'Back to Enchufla · Doble', key: '/salsa/figures/12' });
	expect(tabTarget(t, 'moves', 'salsa', '/salsa/lessons/5')).toEqual({ href: '/salsa/figures/12' });
	t = arrive(t, A({ to: '/salsa/figures/12', from: '/salsa/lessons/5', index: 5, prevIndex: 4, intent: 'tab', title: 'Enchufla · Doble' }));
	expect(backTarget(t, '/salsa/figures/12', { href: '/salsa/figures', label: 'Back to Moves' }).href).toBe('/salsa/routines/3');
});
it('a link back up the chain does not make a loop', () => { /* figure→lesson, lesson links to figure: figure keeps opener routine */ });
it('a main list never has an opener', () => {});
it('replace carries the opener (variation step) and keeps the search on refilter', () => {});
it('reload (enter) keeps the record; a fresh enter has no opener', () => {});
it('push drops history slots above it', () => {});
it('Practice and share are never a tab\'s last page', () => {});
it('lit tab: on a root scrolls to top, on a pushed page goes to the last root with its search', () => {});
it('keptSearch strips popup flags and session, keeps day, q and chips', () => {
	expect(keptSearch('?q=enc&new=1&style=cuban')).toBe('?q=enc&style=cuban');
	expect(keptSearch('?session=1&day=2026-10-30')).toBe('?day=2026-10-30');
	expect(keptSearch('?log=1')).toBe('');
});
it('forget reattaches children to the removed page\'s opener and clears tab memory', () => {});
it('scrollFor: restores on push/tab/back, not on pop, enter or same path', () => {});
it('parseTrail survives junk', () => { expect(parseTrail('{oops')).toEqual(EMPTY_TRAIL); expect(parseTrail(null)).toEqual(EMPTY_TRAIL); });
```

In `tabs.spec.ts`, add: `tabFor('/salsa/exercises/4', 'salsa') === 'today'` and `rootsOf('moves', 'bachata')` equal to `['/bachata/figures', '/bachata/routines']`.

- [ ] **Step 2:** Run `npx vitest run src/lib/nav/trail.spec.ts src/lib/nav/tabs.spec.ts`. Expected: FAIL (module missing / new cases red).
- [ ] **Step 3:** Implement `trail.ts` and the `tabs.ts` changes. Every function returns a new `Trail`, never mutating its input. Dance and tab come from the path via `danceInPath` (`$lib/dances/dances`) and `tabFor`.
- [ ] **Step 4:** Run the same command. Expected: PASS. Then `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(nav): a pure trail of pages — openers, kept search and scroll, each tab's last page`.

---

### Task 2: Wire the trail — tabs remember, back goes where you came from

**Files:**
- Create: `src/lib/nav/trail.svelte.ts`
- Create: `src/lib/components/shell/BackButton.svelte`
- Modify: `src/routes/+layout.svelte` (call `syncTrail()` next to `syncSheets()`)
- Modify: `src/lib/components/shell/BottomNav.svelte`
- Modify: `src/lib/components/moves/MovesScreen.svelte` (the switch goes to `rememberedHref(path)`)
- Modify: `src/lib/components/figures/VariationBar.svelte` (step and list links replace the entry: `data-sveltekit-replacestate`; the new-variation redirect too, see step 3)
- Modify, band back → `BackButton`: `src/routes/[dance]/figures/[id]/+page.svelte:264-268`, `routines/[id]/+page.svelte:518-522`, `lessons/[id]/+page.svelte:420-424`, `songs/[id]/+page.svelte:~146`, `exercises/[id]/+page.svelte:~135`, `positions/+page.svelte:~88`, `coverage/+page.svelte:~80`. Each keeps its current `href`/`label` as the `fallback`.
- Test: `src/lib/nav/trail.svelte.spec.ts` (only the pure helper `backMove`, below)
- Modify: `CLAUDE.md` (the `src/lib/nav/` line: add `trail.ts`, `trail.svelte.ts`)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces (from `trail.svelte.ts`):

```ts
/** Reactive: the current trail. Read it in components; write only through the functions here. */
export const trail: { value: Trail };
export function syncTrail(): void;                 // call once in the root layout's init
export function intend(i: Exclude<Intent, null>): void; // the next navigation is a tab tap / a back
export function tabHref(tab: TabId, dance: DanceSlug, current: string): string | null; // null = "scroll to top"
export function rememberedHref(path: string): string;   // path + kept search if recorded
export function backFor(current: string, fallback: { href: string; label: string }): { href: string; label: string; key: PageKey | null };
export function goBack(fallback: { href: string; label: string }, opts?: { replace?: boolean }): Promise<void>;
/** PURE, exported for its spec: history.back() when the slot below holds the target, else a goto. */
export function backMove(entries: Record<number, PageKey>, index: number, target: PageKey | null): 'history' | 'goto';
```

- `BackButton.svelte` props: `{ fallback: { href: string; label: string }; focusKey?: string }`. It renders a `BandButton` with `icon="back"`, the `backFor` label and href (so it is a real link: long-press, open-in-new-tab and preloading still work). Its `onclick` calls `intend('back')`; when `backMove` says `'history'`, it `preventDefault()`s and calls `history.back()`.

**Behaviour to wire:**
- `syncTrail()`:
  - Loads `parseTrail(sessionStorage['nav-trail'])` once.
  - `beforeNavigate`: `leave(from.pathname, scrollY)` for trail pages.
  - `afterNavigate`: build the `Arrival`.
    - `kind`: `enter` / `popstate` → `pop` / same slot index as before → `replace` / else `push`.
    - `title`: `document.title` with the ` · Salsa`/` · Bachata` suffix stripped, read after `tick()`.
    - Then `arrive`, then `scrollFor`. Scroll when it is not `null` and the URL has no hash.
    - Clear the intent.
  - `pagehide` and `visibilitychange` (hidden): `leave` the current page and save.
  - Every change is written to `sessionStorage` (try/catch).
- **Gone fallback:** in `afterNavigate`, if the intent was `'tab'` or `'back'` and `page.status >= 400`, `forget(to)` and `goto(<tab's first root + kept search>, { replaceState: true })`.
- `BottomNav`: each tab's `href` comes from `tabHref(...)`. When it returns `null` (the lit tab on its main list), the link keeps its root href but `onclick` does `preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' })` (instant under `prefers-reduced-motion`). Otherwise `onclick` calls `intend('tab')`.
- `MovesScreen.open`: `goto(rememberedHref(<path>), { replaceState: true, keepFocus: true })`.
- `VariationBar`:
  - Step and list links get `data-sveltekit-replacestate`.
  - The create form's redirect lands with `replaceState`: in its `submit` callback, on `result.type === 'redirect'`, call `goto(result.location, { replaceState: true, invalidateAll: true })` instead of the default.

- [ ] **Step 1: Write the failing test** `trail.svelte.spec.ts`. Import only `backMove`; the module's top level must not touch `window` at import, so the import works in node.

```ts
it('goes through history when the slot below holds the target', () => {
	expect(backMove({ 1: '/salsa/routines/3', 2: '/salsa/figures/12' }, 2, '/salsa/routines/3')).toBe('history');
});
it('navigates when the target is not the slot below (after a tab tap, or no opener)', () => {
	expect(backMove({ 4: '/salsa/lessons/5', 5: '/salsa/figures/12' }, 5, '/salsa/routines/3')).toBe('goto');
	expect(backMove({ 2: '/salsa/figures/12' }, 2, null)).toBe('goto');
});
```

- [ ] **Step 2:** `npx vitest run src/lib/nav/trail.svelte.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `trail.svelte.ts`, `BackButton.svelte`, and the wiring in the files listed above.
- [ ] **Step 4:** `npx vitest run src/lib/nav`. Expected: PASS. Then `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(nav): tabs reopen where you left them, back goes to the page you came from`.

---

### Task 3: The tab bar on pushed screens

**Files:**
- Modify: `src/lib/nav/tabs.ts` (`showsTabs`)
- Modify: `src/lib/nav/tabs.spec.ts`
- Create: `src/lib/nav/chrome.svelte.ts` (bottom claims)
- Modify: `src/routes/+layout.svelte` (tabs = `showsTabs(route) && !bottom.claimed`; the CSS variables below on the `data-dance` wrapper)
- Modify: `src/lib/components/ui/BottomBar.svelte` (new `mode` prop)
- Modify: `src/lib/components/routines/SelectionBar.svelte`, `src/routes/[dance]/coverage/+page.svelte` (selection bar claims the bottom while shown)
- Modify: `BottomBar` callers in `figures/[id]`, `routines/[id]`, `lessons/[id]` (`mode` on their edit Save bars) and `exercises/[id]` (`mode={editing}`)
- Modify: `src/lib/components/figures/VariationBar.svelte` (sits above the tab bar; fix the "no tab bar on a pushed screen" comment)
- Modify: `src/lib/components/routines/SlotList.svelte:~100-107` (the auto-scroll bottom edge stops at the tab bar's top when it shows)
- Modify: `src/lib/components/ui/Toast.svelte` callers on pushed pages that pass their own `bottom`. Check each one still clears whatever bar is pinned.
- Modify: `docs/superpowers/specs/2026-10-31-redesign-design.md` (Navigation: "The tab bar shows on these four screens only…" and the variation-switcher line), and `src/routes/dev/kit` if it shows a pushed screen without the bar.

**Interfaces:**
- Consumes: `tabFor`.
- Produces:
  - `showsTabs(routeId: string | null): boolean`: true for every route id starting `/[dance]` except `/[dance]/player` and `/[dance]/share`; false for everything else (unchanged outside a dance).
  - `chrome.svelte.ts`: `export const bottom: { readonly claimed: boolean }` and `export function claimBottom(active: () => boolean): void`. Call it during a component's init; it registers an `$effect` that counts the claim while `active()` is true and releases it on false or on destroy.
  - Two CSS variables on the layout's `data-dance` wrapper, read by pinned bars:
    - `--pin-bottom`: the bar's top edge from the screen bottom. `calc(var(--tab-bar-h) + var(--safe-bottom))` with tabs, `0px` without.
    - `--pin-safe`: `0px` with tabs, `var(--safe-bottom)` without.
  - `BottomBar` props gain `mode?: boolean`.
    - With `mode`: claims the bottom and keeps today's placement.
    - Without: sits at `bottom: var(--pin-bottom, 0px)` and pads `calc(12px + var(--pin-safe, var(--safe-bottom)))`.

- [ ] **Step 1: Write the failing tests** in `tabs.spec.ts`:

```ts
it('shows the bar on pushed screens inside a dance', () => {
	for (const id of ['/[dance]/figures/[id]', '/[dance]/routines/[id]', '/[dance]/lessons/[id]', '/[dance]/songs/[id]', '/[dance]/exercises/[id]', '/[dance]/positions', '/[dance]/coverage'])
		expect(showsTabs(id)).toBe(true);
});
it('hides it on Practice, share and outside a dance', () => {
	for (const id of ['/[dance]/player', '/[dance]/share', '/settings', '/voice', '/login', null]) expect(showsTabs(id)).toBe(false);
});
```

- [ ] **Step 2:** `npx vitest run src/lib/nav/tabs.spec.ts`. Expected: FAIL on the pushed screens.
- [ ] **Step 3:** Implement `showsTabs`, `chrome.svelte.ts`, the layout change and every bar in the file list. `PageSkeleton` already takes `tabs`, so pass the same value.
- [ ] **Step 4:** `npm run check`. Expected: PASS (including `bands.spec.ts`, `class-rules.spec.ts`, `focus-clip.spec.ts`).
- [ ] **Step 5:** Commit: `feat(nav): the tab bar on pushed screens; edit and selection bars take the bottom while they show`.

---

### Task 4: Removals and Practice go back through the trail

**Files:**
- Modify: `src/lib/nav/trail.svelte.ts` (add `leaveRemoved`)
- Modify: `src/lib/nav/trail.ts` + `trail.spec.ts` (add `removalTarget`)
- Modify the forms whose action removes the page:
  - `lessons/[id]` delete (server redirects to `/lessons`)
  - `routines/[id]` delete (→ `/routines`)
  - `songs/[id]` delete (→ `/songs`)
  - `exercises/[id]` archive (→ `/<dance>`)
  - `figures/[id]` archive (→ a sibling variation, or `/figures`)
  - Find each by its `?/delete` / `?/archive` form in the page's `+page.svelte`. Merge into an existing `use:enhance` callback rather than replacing it.
- Modify: `src/routes/[dance]/player/+page.svelte:~272` (end of run → `goBack(data.back, { replace: true })`) and `src/lib/components/player/Setup.svelte:~267-293` (the band back becomes `BackButton` with `fallback={back}`).
- Keep `practiceBack` and `?from=` as the no-opener fallback; update its doc comment to say so.
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md`: a short "Where you are" section (or a line in its navigation part) pointing at the pages-keep-state spec.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `removalTarget(t: Trail, gone: PageKey, location: string): { href: string; replace: true; intent: 'back' | null; carry: boolean }`, PURE.
    - `location` is a figure page (the sibling variation): `{ href: location, intent: null, carry: true }`.
    - Else, the gone page's recorded opener: `{ href: hrefOf(opener), intent: 'back', carry: false }`.
    - Else: `{ href: location, intent: null, carry: false }`.
  - `leaveRemoved(location: string): Promise<void>`. It computes `removalTarget` for the current page, `forget`s the gone page (unless `carry`), sets the intent, and calls `goto(href, { replaceState: true, invalidateAll: true })`. With `carry`, the replace arrival carries the opener (Task 1's `replace` rule).
  - Call it from each form's enhance callback when `result.type === 'redirect'`. Other results keep today's handling (`await update()` / `applyAction`).

- [ ] **Step 1: Write the failing tests** in `trail.spec.ts`:

```ts
it('a deleted lesson goes back to the figure that opened it', () => { /* routine→figure→lesson; removalTarget(t, lesson, '/salsa/lessons') → { href: '/salsa/figures/12', intent: 'back', carry: false, replace: true } */ });
it('a deleted page with no opener lands where the server said', () => {});
it('an archived variation with siblings stays on the figure and keeps its opener', () => { /* location '/salsa/figures/13' → carry: true */ });
```

- [ ] **Step 2:** `npx vitest run src/lib/nav/trail.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `removalTarget`, `leaveRemoved`, the five form callbacks and the Practice changes.
- [ ] **Step 4:** `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(nav): a removed page and a finished run go back to where you came from`.

---

### Final: whole-branch check (controller)

- [ ] `npm run check` passes.
- [ ] In the browser, on the slot's dev server (salsa, phone-sized window):
  - The opening case: Routines → routine → figure → lesson → back (lands on the figure) → Moves (still the figure) → back (the routine).
  - Figures chips + search → Routines → Figures: chips and search kept. Scroll kept across a tab tap.
  - Lit tab: on a figure → the Moves list; on the list → scrolls to top.
  - The bar on a figure page with the variation switcher above it. Edit mode hides the bar. The routine selection bar hides it. The exercise Log button sits above it.
  - Delete a lesson opened from a figure: lands on the figure.
  - A sheet opened on a figure page still closes with the browser's Back.
  - Reload keeps the trail. A new browser tab starts fresh.
