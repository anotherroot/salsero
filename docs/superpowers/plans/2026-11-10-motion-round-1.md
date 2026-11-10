# Motion round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo: native build (CLAUDE.md "Building in a slot").

**Goal:** Give the app its first round of motion: taps dip, lists fold and open, Done lands on Today, and the player's count moves on the beat.

**Architecture:** One small motion module (`src/lib/motion/`) holds the timing vocabulary, a reduced-motion-aware `play()` over the Web Animations API, a FLIP helper for keyed lists, and a "ghost" that draws a leaving element after the DOM has dropped it. Taps live in the class builders as Tailwind classes. Today and the player add only what the helper doesn't cover. Nothing is stored, and nothing waits on an animation.

**Tech Stack:** Svelte 5 runes ($effect.pre / $effect), Tailwind v4 (@theme), Web Animations API, vitest (node env: pure functions and source-shape specs).

**Spec:** `docs/superpowers/specs/2026-11-10-motion-round-1-design.md`

## Global Constraints

- Durations short 150 ms, medium 260 ms, long 380 ms. ARRIVE `cubic-bezier(.2, 0, 0, 1)`, SETTLE `cubic-bezier(.3, 1.35, .6, 1)`, LEAVE `cubic-bezier(.4, 0, 1, 1)`. Tune by eye only within ±30 %.
- Only `transform`/`translate`/`scale`/`opacity` move, plus one list container's `height` while it folds.
- `prefers-reduced-motion: reduce` turns everything off: `motion-reduce:` in classes, and `play()` returns null.
- Nothing waits for motion: no `await` on an animation before navigating, saving, closing or focusing. Ghosts are `pointer-events: none`.
- No new dependencies. No new words (no `t()` keys), so no catalog changes.
- Hard rules: colour classes stay the builders'. A scale isn't a colour, so it may go in the builders. Keep `focusAfterRemoval` and `refreshWhenSettled` as they are.
- Vitest at most `--maxWorkers=4`. After each task: `npx vitest run <specs>`, plus `npx eslint` and `npx prettier --check` on the changed files. The full `npm run check` runs only before the final review.

## Review Focus

1. **A fast second tap mid-animation** (Not today on two rows within 150 ms; Undo before the fold ends): each list change starts from where things are drawn now. No row is left translated, faded or duplicated. Covered by the `flipPlan` specs (moves measured from the current rects) and the cancel-before-start rule in Task 3.
2. **The list hidden when it changes** (phone: an exercise page is open over Today): no measuring of a hidden list, and no animation on later reloads that the user didn't cause. Replay happens only on the landing with a save or Not today toast up. Covered by the Task 6 spec on `shouldReplay`.
3. **A seek, a section jump, a loop restart or a pause in the player:** no push, no Next rise. Covered by the `stepMotion` and `callMoves` specs in Task 7.
4. **Reduced motion:** nothing moves, including CSS keyframes and the leave ghost. Covered by the `play()` spec in Task 1 and the source spec in Task 5 (every new keyframe class sits under `motion-safe:` or a no-preference media query).
5. **A press while swiping a Today row or dragging a warm-up or slot:** no scale fights the drag. Covered by the Task 2 builder spec (`in-data-swiping:` / `in-data-dragging:` reset).

---

### Task 1: The motion vocabulary

**Files:**
- Modify: `src/routes/layout.css` (`@theme`: `--ease-arrive`, `--ease-settle`, `--ease-leave`; `:root`: `--motion-short: 150ms`, `--motion-medium: 260ms`, `--motion-long: 380ms`; keyframes `motion-rise`, `motion-pop` under `@media (prefers-reduced-motion: no-preference)`)
- Create: `src/lib/motion/motion.ts`
- Test: `src/lib/motion/motion.spec.ts`

**Interfaces:**
- Produces:
  - `export const MS = { short: 150, medium: 260, long: 380 } as const`
  - `export const ARRIVE`, `SETTLE`, `LEAVE` (the strings above)
  - `export function reducedMotion(): boolean` (false where `matchMedia` is missing)
  - `export function play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null`. Returns null and does nothing under reduced motion or with no `el.animate`. The default easing is ARRIVE.
  - CSS classes `motion-rise` (from `translateY(24px)` and opacity 0, medium, ARRIVE) and `motion-pop` (from `scale(.55)` and opacity 0, medium, SETTLE). Both are inert under reduced motion.

- [ ] **Step 1: Write the failing spec.** `motion.spec.ts`:
  - `MS` deep-equals `{ short: 150, medium: 260, long: 380 }`, and the three easings equal the spec's strings.
  - With `globalThis.matchMedia` stubbed to `matches: true`, `play(fakeEl, …)` returns null and `fakeEl.animate` isn't called.
  - With `matches: false`, it calls `animate` once, easing defaulting to ARRIVE.
  - A source check reads `layout.css` and finds `--ease-settle: cubic-bezier(.3, 1.35, .6, 1)`.
- [ ] **Step 2:** `npx vitest run src/lib/motion/motion.spec.ts`. Expect FAIL (module missing).
- [ ] **Step 3:** Implement `motion.ts` and the CSS.
- [ ] **Step 4:** Run the spec again. Expect PASS.
- [ ] **Step 5:** Commit `feat(motion): the timing vocabulary and play()`.

### Task 2: Taps dip

**Files:**
- Modify: `src/lib/components/ui/styles.ts`
  - `BUTTON_BASE`: `transition-colors` → `transition`, adding `duration-260 ease-settle active:duration-150 active:ease-arrive active:scale-94 disabled:active:scale-100 aria-busy:active:scale-100 motion-reduce:active:scale-100`.
  - The same press set goes on `ICON_BUTTON`'s shared part, `BAND_BUTTON`, `FLOAT_BUTTON` and `SHORTCUT`.
  - `CHIP` (a label wrapping a radio) gets it too.
- Create in styles.ts: `export const PRESS_ROW`. It's the row version, `active:scale-[.985]`, with the same transition, resets, and `in-data-swiping:active:scale-100 in-data-dragging:active:scale-100`. Add those two resets to the button press set as well.
- Modify: `src/lib/components/today/ExerciseRow.svelte`. The row link (`LINK`) gets `PRESS_ROW`.
- Modify: every `<a>`/`<button>` that *is* a whole list row. Find them with `grep -rn "{ROW\|{ROW_TALL\|ROW}" src --include='*.svelte'` and keep only those where the element carrying ROW is the `<a>`/`<button>`. Never put it on a container: `:active` also matches ancestors.
- Modify: `src/lib/components/routines/Swipeable.svelte`, to set `data-swiping` on its root while a finger moves it. Modify `TodayList.svelte`'s and `SlotList.svelte`'s lists to set `data-dragging` while a row is lifted.
- Modify: `TodayBar.svelte`. The round play button uses the press set, at .94.
- Test: `src/lib/components/ui/styles.spec.ts`.

**Interfaces:**
- Consumes: the easing utilities from Task 1 (`ease-arrive`, `ease-settle`).
- Produces: `PRESS_ROW: string`.

- [ ] **Step 1: Write the failing specs** in `styles.spec.ts`:
  - `button('primary')` contains `active:scale-94` and `motion-reduce:active:scale-100`, and doesn't contain `transition-colors`.
  - The same holds for `iconButton('bare')` and `bandButton()`.
  - `PRESS_ROW` contains `active:scale-[.985]`, `in-data-swiping:active:scale-100` and `in-data-dragging:active:scale-100`.
  - A source check: `ExerciseRow.svelte` uses `PRESS_ROW`, and `Swipeable.svelte` writes `data-swiping`.
- [ ] **Step 2:** `npx vitest run src/lib/components/ui/styles.spec.ts src/lib/components/ui/class-rules.spec.ts`. Expect FAIL on the new specs only.
- [ ] **Step 3:** Implement. Keep every existing colour class as it is.
- [ ] **Step 4:** Run the same specs. Expect PASS. Fix any older spec that pinned `transition-colors`, updating it to `transition` and saying why in the spec.
- [ ] **Step 5:** Commit `feat(motion): taps dip under the finger`.

### Task 3: Lists fold and open (the helper and Today)

**Files:**
- Create: `src/lib/motion/flip.ts` (pure)
- Create: `src/lib/motion/flip.svelte.ts` (the runes helper)
- Create: `src/lib/motion/ghost.ts`
- Modify: `src/lib/components/today/ExerciseRow.svelte` (`data-flip={ex.id}` on its `<li>`), `TodayList.svelte` (both `<ul>`s), `ComingUpList.svelte`, `NextRow.svelte` (if its `<li>` is in the practice list: `data-flip="next"`)
- Test: `src/lib/motion/flip.spec.ts`

**Interfaces:**
- Consumes: `MS`, `ARRIVE`, `SETTLE`, `LEAVE`, `play`, `reducedMotion` (Task 1).
- Produces:
  - `type Box = { top: number; height: number }`
  - `flipPlan(before: Map<string, Box>, after: Map<string, Box>): { moves: { key: string; dy: number }[]; entering: string[]; leaving: string[] }`. `dy = before.top − after.top`, listed only when |dy| ≥ 0.5. Tops are relative to the container's own top, so scrolling never counts.
  - `flipList(o: { container: () => HTMLElement | undefined; keys: () => unknown; shown?: () => boolean; replayOnShow?: () => boolean; lift?: () => string | null }): void`. Called in a component's script. Children are the container's `:scope > [data-flip]`, keyed by that attribute.
  - `ghost(el: HTMLElement, clip: HTMLElement | null): HTMLElement`. A `position: fixed; pointer-events: none` copy of `el` at its current viewport rect, appended to `document.body`, inside a wrapper clipped to `clip`'s rect and border radius (or none). The caller animates it, and it removes itself when its animations finish.

**Behaviour of `flipList`:**
- `$effect.pre`, reading `keys()` and `shown()`: if the container is laid out (`getClientRects().length > 0`), measure every child's Box and the container's height, cancel the children's running animations first, and ghost every child whose key isn't in the new key set. If it isn't laid out, keep the last snapshot.
- `$effect`, after the DOM update, if laid out:
  - **Before-measure taken in the pre-effect:** animate the plan with `translateY(dy) → none` (medium, ARRIVE). Entering rows go `opacity 0, scale(.96) → 1`, with opacity held at 0 until offset .45 (medium + short, SETTLE). The container's height goes from old to new (medium, ARRIVE), only when it changed. Ghosts slide from their current `translateX` to `-100%` (short, LEAVE), and fade from 60 ms in.
  - **Hidden in the pre-effect, shown now, `replayOnShow?.()` true:** animate the plan against the stored snapshot, using long instead of medium. The `lift?.()` row also gets the shadow pulse `0 8px 24px #0000 → #0002 → #0000`. There are no ghosts.
  - **Either way:** store the snapshot afterwards.
- Under `reducedMotion()`, it does nothing.

- [ ] **Step 1: Write the failing specs** in `flip.spec.ts`:
  - **One row leaves:** before `{a:0, b:66, c:132}`, after `{a:0, c:66}` gives moves `[{key:'c', dy:66}]`, leaving `['b']` and entering `[]`.
  - **Undo brings it back:** the reverse gives moves `[{key:'c', dy:-66}]` and entering `['b']`.
  - **Done reorders:** before `{x:0, y:66, z:132}`, after `{z:0, x:66, y:132}` gives `z` dy 132, `x` dy −66 and `y` dy −66.
  - **No change** gives empty moves.
  - **Scroll doesn't count:** the same tops give empty moves, whatever the container's own position was (the tops are relative).
- [ ] **Step 2:** `npx vitest run src/lib/motion/flip.spec.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `flip.ts`, `flip.svelte.ts` and `ghost.ts`, and wire Today's two lists and Coming up. In TodayList pass `shown` from a new prop (Task 6 fills `replayOnShow` and `lift`; here pass `shown: () => shown` only).
- [ ] **Step 4:** Run the spec. Expect PASS. Then the related specs: `npx vitest related --maxWorkers=4 src/lib/components/today/TodayList.svelte src/lib/components/today/ExerciseRow.svelte`.
- [ ] **Step 5: See it.** `npm run dev`, phone width. Swipe a row and tap Not today: it slides off and the gap folds. Undo: the gap opens. + Next 5: new rows fade in. Drag a warm-up row: it glides into place on drop. On the desktop, Done from the pane reorders the list live.
- [ ] **Step 6:** Commit `feat(motion): lists fold and open (Today)`.

### Task 4: Lists fold and open everywhere else

**Files (modify):** each list's container gets `flipList`, and each row root gets `data-flip`.
- `src/lib/components/routines/SlotList.svelte` (slots; the dragged slot glides into place on drop).
- `src/lib/components/links/LinksEditor.svelte`, `src/lib/components/figures/RelationsCard.svelte`, `src/lib/components/positions/PositionRelations.svelte` (links).
- `src/lib/components/lessons/VideoSections.svelte`, `src/lib/components/video/Timeline.svelte` if it lists sections as rows, `src/lib/components/exercises/DrillRecordings.svelte` (sections, recordings).
- `src/lib/components/songs/MusicList.svelte` (To pick, playlists: `sections.toPick`, `adding`, `g.songs`).
- `src/lib/components/comments/CommentsSheet.svelte`, `CommentsCard.svelte`.
- `src/routes/[dance]/suggestions/+page.svelte` (groups and actions).
- `src/lib/components/today/PastDay.svelte` / `DayTiles.svelte` (a past day's rows).

**Rules:**
- Never on a list redrawn by a filter or search (MusicList's `view.hits`, any search results). Folding there is noise.
- A list whose row component renders its own root takes `data-flip` as a prop, or through `{...rest}`.

**Interfaces:**
- Consumes: `flipList` (Task 3).

- [ ] **Step 1: Write the failing source spec** `src/lib/motion/flip-sites.spec.ts`. Every file in the list above imports `flipList` and contains `data-flip`. `MusicList.svelte`'s `view.hits` block has no `data-flip`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Wire each site.
- [ ] **Step 4:** Run the spec. Expect PASS. Then `npx vitest related --maxWorkers=4 <changed files>`.
- [ ] **Step 5: See it.** In `npm run dev`: delete a slot, then Undo. Remove a link. Drop a suggestion.
- [ ] **Step 6:** Commit `feat(motion): every list that changes folds and opens`.

### Task 5: Toasts rise, sheets leave, faces pop

**Files:**
- Modify: `src/lib/components/ui/Toast.svelte` (the card inside `SwipeAway` gets `motion-rise`), `src/lib/components/video/Toast.svelte` (the same).
- Modify: `src/lib/components/ui/Sheet.svelte`. In the `!open && dialog.open` branch, call `sheetLeave(dialog)` *before* `dialog.close()`.
- Create in `src/lib/motion/ghost.ts`: `export function sheetLeave(dialog: HTMLDialogElement): void`.
  - Ghost the dialog with no clip, plus a full-screen fixed dim layer coloured from `getComputedStyle(dialog, '::backdrop').backgroundColor` (skip it when transparent).
  - Below 640 px: the panel goes `translateY(0) → translateY(100%)`, medium, LEAVE.
  - From 640 px: the panel goes opacity `1 → 0` and `scale(1) → scale(.97)`, short.
  - The dim fades out over the same time.
- Modify: `src/lib/components/exercises/FaceRating.svelte`. A face's click calls `play(button, [{transform:'none'}, {transform:'scale(.92)', offset:.25}, {transform:'scale(1.08)', offset:.65}, {transform:'none'}], { duration: 420, easing: 'ease-out' })`, then `onchange` as now, in the same tick.
- Test: `src/lib/motion/ghost.spec.ts` (source-shape).

**Interfaces:**
- Consumes: `ghost`, `play`, `MS`, `LEAVE` (Tasks 1 and 3).
- Produces: `sheetLeave(dialog)`.

- [ ] **Step 1: Write the failing spec.** It reads `Sheet.svelte` and asserts `sheetLeave(dialog)` appears before `dialog.close()` in the same block. `Toast.svelte` contains `motion-rise`. `FaceRating.svelte` imports `play`. `layout.css`'s `motion-rise`/`motion-pop` keyframes sit inside `prefers-reduced-motion: no-preference`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the spec. Expect PASS. Then `npx vitest run --maxWorkers=4 src/lib/components/ui/sheet-desk.spec.ts src/lib/components/ui/sheet-scroll.spec.ts src/lib/components/exercises/done-sheet.spec.ts`.
- [ ] **Step 5: See it.** Open and close any sheet with ×, the backdrop and Back: it slides down, and taps right after it land on the page. Tap a face: it pops, and the sheet leaves while the page goes back.
- [ ] **Step 6:** Commit `feat(motion): toasts rise, sheets slide away, faces pop`.

### Task 6: Done lands on Today

**Files:**
- Modify: `src/lib/exercises/saved.svelte.ts`. `Saved` gains `exerciseId: number | null`.
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte`'s `saved()`, to pass `exerciseId: data.exercise.id`. Every other `announceSaved` caller passes its own id, or null.
- Create: `src/lib/motion/landing.ts` (pure): `shouldReplay(o: { savedId: number | null; layoutToast: boolean }): boolean` (true when either is set), and `landedRow(savedId: number | null, rows: { id: number; done: boolean }[]): number | null` (the saved id when that row is done, else null).
- Modify: `src/routes/[dance]/(today)/+layout.svelte`. Pass TodayList `shown={isList || desk.current}`, `landing={shouldReplay(...)}`, `landedId={…}`. Pass TodayBar `shown` too.
- Modify: `TodayList.svelte`. `flipList` gets `replayOnShow: () => landing` and `lift: () => landedId`.
- Modify: `ExerciseRow.svelte`, which gains a `landed: boolean` prop. When true, the TypeTile's wrapper gets `motion-pop`. A CSS animation waits while the list is hidden and plays when it shows.
- Modify: `TodayBar.svelte`, which gains a `shown: boolean` prop.
  - It draws from `drawn`, a copy of `hero` updated only while `shown`. After a hidden→shown change, the update happens one frame later, so the old state paints first.
  - The bar's width has `transition-[width] duration-380 delay-120 ease-arrive`.
  - The title and meta each sit in a one-cell grid inside `{#key drawn.title}` / `{#key drawn.meta}`. The old line goes out with `fly({ y: -8, duration: 150 })`, and the new one comes in with `fly({ y: 8, duration: 150, delay: 90 })`, both `motion-safe` (use `reducedMotion()` to zero them).
- Test: `src/lib/motion/landing.spec.ts`.

**Interfaces:**
- Consumes: `flipList` with `replayOnShow`/`lift` (Task 3), `motion-pop` (Task 1), `reducedMotion`.
- Produces: `Saved.exerciseId`, `shouldReplay`, `landedRow`.

**Decided here** (the spec's cold-landing line refined): a Today that was never drawn before the save has no old bar or words to move from. There, only the check pops.

- [ ] **Step 1: Write the failing specs:**
  - `shouldReplay({savedId: 4, layoutToast: false})` is true, `({savedId: null, layoutToast: true})` is true, and `({savedId: null, layoutToast: false})` is false.
  - `landedRow(4, [{id: 4, done: true}])` is 4, and `landedRow(4, [{id: 4, done: false}])` is null.
  - A source check: `saved()` in the exercise page passes `exerciseId`.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement. Find every `announceSaved(` caller with grep and give each an `exerciseId`. Types are checked by the full check (Task 8).
- [ ] **Step 4:** Run the specs. Expect PASS. Then `npx vitest related --maxWorkers=4` on the changed files.
- [ ] **Step 5: See it** (phone width, dev db). Open a to-do row, tap Done, then a face. Today shows:
  - the row sliding up into the done place, with a shadow at mid-flight
  - the check popping in
  - the bar filling from its old width
  - "N for today" changing to "N−1 left for today"
  - the toast rising in

  Reload Today with nothing changed: nothing moves. Open and close an exercise without saving: nothing moves.
- [ ] **Step 6:** Commit `feat(motion): Done lands on Today`.

### Task 7: The player on the beat

**Files:**
- Create: `src/lib/player/beat-motion.ts` (pure)
- Modify: `src/lib/components/player/StageCount.svelte`, `RunLayer.svelte` (the strip's count), `Running.svelte` (`run-call`/`run-next`)
- Test: `src/lib/player/beat-motion.spec.ts`

**Interfaces:**
- Produces:
  - `type StepMotion = 'none' | 'push' | 'strong' | 'disc'`
  - `stepMotion(prev: number, index: number, count: number | null, paused: boolean, off: boolean): StepMotion`. It's `'none'` unless `index === prev + 1`, not paused, not off and count isn't null. Then a count of 1 gives `'disc'`, 5 gives `'strong'`, and any other count `'push'`.
  - `beatLife(stepMs: number | null): number`. It's 0.85 × the step clamped to [150, 1000], and 0.85 × 333 when null.
  - `callMoves(prev: { now: string | null; next: string | null }, now: string | null): boolean`. True only when `now !== prev.now`, `now !== null` and `now === prev.next`.
  - `PUSH = { push: 1.045, strong: 1.09, disc: 0.8 }`.

**Behaviour:**
- **StageCount:** in the rAF `tick`, when `index` changes, take the step time from `performance.now()` since the last change. Call `play(digitEl, …)`:
  - push / strong: `scale(PUSH.x) → none`, `beatLife`, ARRIVE.
  - disc: `scale(.8) → none`, `beatLife`, SETTLE.

  Cancel the digit's last animation first.
- **The dots:** every dot box is the big size (`size-4 desk:size-[22px]`), and a small dot is `scale-[.625] desk:scale-[.636]`, so only transform moves. Gaps go to `gap-1 desk:gap-2`, keeping the centres where they are now. Each dot has `transition-[scale]`, with its duration set inline as `min(110 ms, 40 % of the last step)` and ease-arrive, plus `motion-reduce:transition-none`.
- **RunLayer's strip count:** the same `stepMotion`, but `'disc'` plays as `'push'`.
- **Running:**
  - In `$effect.pre` on `nowName`, note `{ now, next }` from before, and ghost the `run-call` element when `callMoves` will be true.
  - In `$effect`, when it's true:
    - Animate `run-call` from the `run-next` element's centre to its own: `translateY(dy) scale(nextFont / callFont)` with opacity .7 → none, over `min(MS.long, 1.4 × step)`, ARRIVE.
    - Lift the old-call ghost by 24 px and fade it over 0.7 × that time.
    - Fade `run-next` in from `translateY(8px)` with opacity 0 held to offset .4.

  The moving call holds just the name, so the "Next:" label isn't carried.

- [ ] **Step 1: Write the failing specs:**
  - `stepMotion(3, 4, 5, false, false)` is `'strong'`.
  - `stepMotion(7, 8, 1, false, false)` is `'disc'`.
  - `stepMotion(3, 4, 2, false, false)` is `'push'`.
  - A seek forward, `stepMotion(3, 9, 2, false, false)`, is `'none'`.
  - A jump backward, `stepMotion(9, 3, 4, false, false)`, is `'none'`.
  - Paused, `stepMotion(3, 4, 2, true, false)`, is `'none'`.
  - In a count-off, `stepMotion(3, 4, 2, false, true)`, is `'none'`.
  - With no count, `stepMotion(3, 4, null, false, false)`, is `'none'`.
  - `beatLife(333)` ≈ 283, `beatLife(50)` is 127.5 and `beatLife(null)` ≈ 283.
  - `callMoves({now:'A', next:'B'}, 'B')` is true, `callMoves({now:'B', next:'C'}, 'A')` is false (a jump back), and `callMoves({now:'A', next:'B'}, 'A')` is false.
- [ ] **Step 2:** `npx vitest run src/lib/player/beat-motion.spec.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the specs. Expect PASS. Then `npx vitest run --maxWorkers=4 src/lib/components/player/`.
- [ ] **Step 5: See it** (`npm run dev`, a routine with a song):
  - Each count pushes, the 1's disc pops and the 5 is harder.
  - The dots grow, and Next rises into the call on a new figure.
  - Seek back: nothing flies.
  - Pause: everything is still.
- [ ] **Step 6:** Commit `feat(motion): the player's count moves on the beat`.

### Task 8: Docs, check, review, ship

**Files:**
- Modify: `docs/features.md` (a "Motion" line linking the spec), `docs/layout.md` (`src/lib/motion/`: motion.ts, flip.ts, flip.svelte.ts, ghost.ts, landing.ts; `src/lib/player/beat-motion.ts`), and `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (one paragraph under the look/UI section: the motion vocabulary and "nothing waits on motion").

- [ ] **Step 1:** Write the docs. Commit `docs: motion round 1`.
- [ ] **Step 2:** `git merge master`, then `npm run check` (full). Expect it to pass.
- [ ] **Step 3:** One whole-branch review by a fresh reviewer on the most capable model, then fix its findings.
- [ ] **Step 4:** Merge into master, then `npm run check` again if master moved.
- [ ] **Step 5:** Deploy as the project does: salsa-backup first, then `./scripts/deploy.sh`. A build killed with 143 goes through the systemd-run fallback in CLAUDE.md. Update the project memory's prod line.
