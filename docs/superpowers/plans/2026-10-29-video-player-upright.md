# Full-screen player round 2 (upright videos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portrait laid out for upright videos (Hide, a row of sections, Back/Edit on top, an editor that never scrolls), plus 0.1 s steps, the screen kept on, pinch zoom and double-tap jumps everywhere.

**Architecture:** As in round 1: every rule that needs no DOM is a pure module in `src/lib/video/` with a spec (zoom maths, tap classifier, wake lock against injected fakes); the Svelte side is small components in `src/lib/components/video/` wired by `ui/VideoPlayer.svelte`. No server or schema change.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind v4, vitest (node only — no component tests in this repo).

**Spec:** `docs/superpowers/specs/2026-10-29-video-player-upright-design.md` (builds on `2026-10-29-video-player-redesign-design.md`). Mock-ups: rounds 2–3 of https://claude.ai/artifact/Frkabcp1eJGFVjvG8kU5qe.

## Global Constraints

- Run everything through the flake: `nix develop -c npm run check` must pass at the end; per-task tests with `nix develop -c npx vitest run <files>`.
- Pure modules take no `window`/`document`/`navigator` globals — inject them.
- Nothing under `$lib/server` imported by components; dates on screen built by hand.
- Copy: `−0.1 s` / `+0.1 s` (U+2212 minus), `Hide`, `Show`, `All`, `Zoom 2×`, `Reset`, `« 1 s` / `1 s »`, `Edit`, `‹ Full video`.
- Numbers from the spec: zoom 1×–4×; double-tap window 250 ms; chained taps 600 ms; jump 1 s per tap; editor end parks 10 ms before the end; video at least 120 px in portrait; drag snaps to 10 ms.
- The `<video>` element is never remounted (one element in every layout).

## Review Focus

1. Landscape with faded controls: a single tap only wakes them; a double tap on a side jumps and does not also toggle play.
2. A second finger landing during a one-finger touch: no tap fires on release, the pinch zooms about the fingers, pan stays clamped.
3. Rotating or resizing while zoomed: the view is re-clamped to the new box, no gap at the picture's edges.
4. A chip or an All-sheet card opened from a section view: Back goes to the full video, never to the previous section.
5. The wake lock is let go on close and taken again after the page was hidden and comes back.
6. `VideoFrame` / `SectionPlayer` saving mirror or speed does not wipe the stored Hide choice.

---

### Task 1: 0.1 s steps replace frame steps

**Files:**
- Modify: `src/lib/video/spots.ts` (remove `DEFAULT_FRAME_S`, `frameNumber`, `frameSeek`, `edgeByFrames`, `edgeFrameTime`; add the two below), `src/lib/video/spots.spec.ts`
- Modify: `src/lib/video/keys.ts`, `src/lib/video/keys.spec.ts`
- Delete: `src/lib/video/frame-rate.ts`, `src/lib/video/frame-rate.spec.ts`
- Modify: `src/lib/components/video/Transport.svelte`, `SpotEditor.svelte`, `SectionView.svelte`, `icons.ts` (drop `framePrev`/`frameNext`), `src/lib/components/ui/VideoPlayer.svelte`

**Interfaces:**
- Produces: `export const TENTH_MS = 100`; `export const END_PARK_MS = 10`; `edgeViewTime(spot: Pick<Spot,'startMs'|'endMs'>, edge: 'start'|'end'): number` (seconds: start → `startMs/1000`; end → `(endMs − 10)/1000`; a point → its start).
- `KeyAction`: `'framePrev'|'frameNext'` become `'tenthBack'|'tenthFwd'` (`,` and `.`).
- `MoveHow`: `'frame'` becomes `'tenth'`.
- `Transport` prop `onframe` becomes `ontenth: (d: -1 | 1) => void`; the two buttons are text `−0.1 s` / `+0.1 s` (aria-labels `Back 0.1 s` / `Forward 0.1 s`).
- `SpotEditor` loses `frameS`/`frameNo`/`onframe`, gains `ontenth`; `SectionView` loses `frameNo`/`onframe`, gains `ontenth`.

- [ ] **Step 1: Write the failing tests.** In `spots.spec.ts` replace the `frameNumber`/`frameSeek`/`edgeByFrames`/`edgeFrameTime` blocks with:
  - `edgeViewTime({startMs: 4000, endMs: 11200}, 'start') === 4` ; `... 'end') === 11.19` ; `edgeViewTime({startMs: 4000, endMs: null}, 'end') === 4`.
  - `TENTH_MS === 100`, and `moveEdge(spot, 'start', 4000 + TENTH_MS, 60)` gives `startMs 4100` (documents the editor's step).
  In `keys.spec.ts`: `,` → `'tenthBack'`, `.` → `'tenthFwd'` at every level.
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/video/spots.spec.ts src/lib/video/keys.spec.ts` — Expected: FAIL (`edgeViewTime` not exported, key actions differ).
- [ ] **Step 3: Implement** the spots/keys changes; delete `frame-rate.ts` and its spec. In the player: `tenth(d)` pauses then `video.currentTime = step(video.currentTime, d * TENTH_MS / 1000, video.duration)`; `moved()` treats `'tenth'` and `'drag'` as "pause and seek to `edgeViewTime(next, edge)`"; drop `frameS`, `frameNo`, `watchFrameDuration`, every "frame N" text, and change the key legend row to `[', .', '0.1 s']`. In `SpotEditor` the move row is `−1 s, −0.1 s, Now, +0.1 s, +1 s` via `moveEdge(spot, edge, atMs ± TENTH_MS, durationS)`; the label line reads `Move the start` (no "1 f = one frame"); `onDrag` snaps with `Math.round(ms / 10) * 10`. The compact editor transport keeps `−0.1 s / Play / +0.1 s`.
- [ ] **Step 4:** run the two specs — Expected: PASS. Then `nix develop -c npx svelte-check --threshold error` — Expected: 0 errors.
- [ ] **Step 5: Commit** `Video player: 0.1 s steps instead of frame steps`.

### Task 2: Prefs remember Hide, and every save merges

**Files:** Modify `src/lib/video-prefs.ts`, `src/lib/video-prefs.spec.ts`, `src/lib/components/ui/VideoFrame.svelte`, `src/lib/components/ui/SectionPlayer.svelte`, `src/lib/components/links/YouTubeCard.svelte`

**Interfaces:**
- Produces: `VideoPrefs` gains `hidden: boolean` (default `false`); `saveVideoPrefs(p: Partial<VideoPrefs>): void` merges `p` over `loadVideoPrefs()`.

- [ ] **Step 1: Failing tests:** `parseVideoPrefs('{"hidden":true}').hidden === true`; `parseVideoPrefs('{"hidden":"yes"}').hidden === false`; with a fake `localStorage` (`vi.stubGlobal`) holding `{"mirror":false,"rate":1,"hidden":true}`, `saveVideoPrefs({ mirror: true })` leaves `hidden: true` and sets `mirror: true`.
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/video-prefs.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; callers pass only what they change (`VideoFrame`: `{ mirror, rate }`; `SectionPlayer`: `{ mirror, rate }` from its state; `YouTubeCard`: `{ mirror }`).
- [ ] **Step 4:** run the spec — PASS.
- [ ] **Step 5: Commit** `Video prefs: remember Hide; a save merges with what is stored`.

### Task 3: Zoom maths (pure)

**Files:** Create `src/lib/video/zoom.ts`, `src/lib/video/zoom.spec.ts`

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`, `type Size = { w: number; h: number }`, `type View = { scale: number; x: number; y: number }` (x, y: translation in px of the picture's centre from the box's centre; the wrapper's `transform-origin` is its centre).
  - `MIN_ZOOM = 1`, `MAX_ZOOM = 4`, `NO_ZOOM: View = { scale: 1, x: 0, y: 0 }`.
  - `fitSize(box: Size, natural: Size): Size` — the contained picture's size at 1×.
  - `clampView(v: View, box: Size, pic: Size): View` — scale into [1, 4]; per axis, if `pic·scale ≥ box` then `|t| ≤ (pic·scale − box)/2`, else `t = 0`. Returns `NO_ZOOM` when scale clamps to 1.
  - `pinchView(start: View, from: [Pt, Pt], to: [Pt, Pt], box: Size, pic: Size): View` — points relative to the box centre; the picture point under `from`'s midpoint lands under `to`'s midpoint, scale × (distance ratio), then clamped.
  - `panView(v: View, dx: number, dy: number, box: Size, pic: Size): View`.
  - `wheelView(v: View, at: Pt, deltaY: number, box: Size, pic: Size): View` — factor `Math.exp(-deltaY / 200)` about `at`.
  - `zoomTransform(v: View): string` → `translate(${x}px, ${y}px) scale(${scale})`.

- [ ] **Step 1: Failing tests** (box 390×690, upright picture natural 1080×1920 → `fitSize` = 388.125×690):
  - `clampView({scale: 9, x: 0, y: 0}, …).scale === 4`; `clampView({scale: 0.5, x: 30, y: 30}, …)` equals `NO_ZOOM`.
  - At scale 2 the picture is 776.25×1380: `clampView({scale: 2, x: 999, y: -999}, …)` → `x === (776.25−390)/2`, `y === −(1380−690)/2`.
  - Narrow axis stays centred: wide picture (`fitSize` of 1920×1080 in 390×690 = 390×219.375) at scale 2 (438.75 tall < 690) → `y === 0` whatever is asked.
  - `pinchView(NO_ZOOM, [{x:-50,y:0},{x:50,y:0}], [{x:-100,y:0},{x:100,y:0}], …).scale === 2` with `x === 0`; pinching about `{x: 100, y: 0}` keeps that picture point under the fingers (assert `x` ≈ −100 before clamping is within range).
  - Re-clamp on a new box (rotation): a view valid in 390×690 clamped to 844×390 never exceeds the new bounds.
  - `zoomTransform({scale: 2, x: 10, y: -5}) === 'translate(10px, -5px) scale(2)'`.
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/video/zoom.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5: Commit** `Video player: zoom maths`.

### Task 4: Tap classifier (pure)

**Files:** Create `src/lib/video/taps.ts`, `src/lib/video/taps.spec.ts`

**Interfaces:**
- Produces:
  - `DOUBLE_TAP_MS = 250`, `CHAIN_MS = 600`.
  - `type Side = 'left' | 'right'`; `zoneOf(x: number, width: number): Side | 'mid'` (thirds).
  - `type TapState = { pending: { side: Side; t: number } | null; chain: { side: Side; t: number; total: number } | null }`; `IDLE: TapState`.
  - `type TapResult = { state: TapState; act: { kind: 'single' } | { kind: 'jump'; side: Side; total: number } | null; wait: boolean }`.
  - `tap(state: TapState, t: number, zone: Side | 'mid'): TapResult` — mid: `single` now (and ends any chain). Side, within a chain on that side (t − chain.t ≤ 600): `jump` total+1, chain renewed. Side with a pending tap on that side within 250 ms: `jump` total 1, start a chain. Otherwise: pending, `wait: true`.
  - `expire(state: TapState, t: number): TapResult` — a pending tap older than 250 ms becomes `single`; a chain older than 600 ms ends.
  - The component jumps `±1 s` per `jump` result (not by `total`; `total` is only the label).

- [ ] **Step 1: Failing tests:** mid tap → single immediately; left tap → wait, `expire` at +260 → single; left, left at +200 → jump left total 1; then left at +500 → jump total 2; then right at +550 → wait (other side breaks the chain); left then right at +100 → no jump (wait); left, then `expire` at +700 after a chain → chain cleared.
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/video/taps.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5: Commit** `Video player: the tap classifier`.

### Task 5: Keep the screen on

**Files:** Create `src/lib/video/screen-on.ts`, `src/lib/video/screen-on.spec.ts`

**Interfaces:**
- Produces: `holdScreenOn(env: { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> }; doc: { visibilityState: string; addEventListener(t: 'visibilitychange', f: () => void): void; removeEventListener(t: 'visibilitychange', f: () => void): void } }): () => void` — requests now, requests again on `visibilitychange` to `visible` (the browser drops the lock when hidden), swallows rejections, and the returned function removes the listener and releases any held lock (also one that resolves after release was called).

- [ ] **Step 1: Failing tests** with fakes: requests once on start; after `visibilitychange` with `visibilityState = 'visible'` requests again; with `'hidden'` does not; the returned stop releases the sentinel and removes the listener; a request resolving after stop is released at once; no `wakeLock` → no throw; a rejected request → no throw.
- [ ] **Step 2:** `nix develop -c npx vitest run src/lib/video/screen-on.spec.ts` — FAIL.
- [ ] **Step 3: Implement**; in `VideoPlayer.svelte` an `onMount` returns `holdScreenOn({ wakeLock: navigator.wakeLock, doc: document })`.
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5: Commit** `Video player: the screen stays on while it is open`.

### Task 6: Gestures on the video — pinch, pan, double-tap

**Files:** Create `src/lib/components/video/VideoGestures.svelte`; modify `src/lib/components/ui/VideoPlayer.svelte`

**Interfaces:**
- Consumes: Task 3 (`View`, `fitSize`, `clampView`, `pinchView`, `panView`, `wheelView`, `zoomTransform`, `NO_ZOOM`), Task 4 (`tap`, `expire`, `zoneOf`, `IDLE`, `DOUBLE_TAP_MS`, `CHAIN_MS`).
- Produces: `VideoGestures` props `{ view: View (bindable), natural: Size, label: string, onsingle: () => void, onjump: (side: Side) => void }`. It is the layer over the picture (replacing today's tap button): a `<button>` with `touch-action: none` handling pointer events; keyboard activation (`click` with `detail === 0`) calls `onsingle`. It shows the `« n s` / `n s »` mark on the jumped side for `CHAIN_MS`.

- [ ] **Step 1: Build `VideoGestures`.** Pointers in a `Map`. One pointer: a release within 300 ms and under 10 px of travel is a tap → `tap()`; `wait` schedules `expire` after `DOUBLE_TAP_MS`; a `single` act → `onsingle()`, a `jump` → `onjump(side)`. A one-pointer move over 10 px while `view.scale > 1` pans (`panView`). A second pointer cancels any tap and starts a pinch from the two current points (`pinchView` from the start view). Box size from the element's `ResizeObserver`; on resize `view = clampView(view, box, fitSize(box, natural))`. Wheel with `ctrlKey` → `wheelView` (listener added with `{ passive: false }` in an `$effect`, `preventDefault`).
- [ ] **Step 2: Wire it.** The `<video>` goes inside a wrapper `div` styled `transform: zoomTransform(view)` with `transform-origin: center` (mirror stays on the `<video>`, so they compose). `onsingle` = today's `tapVideo`; `onjump` = `nudge(side === 'left' ? -1 : 1)` (which already follows the loop rule). While `view.scale > 1` a chip under the speed/Mirrored badge reads `Zoom {scale rounded to 0.1}×` with a **Reset** button setting `NO_ZOOM`. The view resets on close (component state).
- [ ] **Step 3: Verify** `nix develop -c npx svelte-check --threshold error` — 0 errors; in the browser (dev slot, 390×844 and 844×390): double-tap left/right jumps 1 s (and 3 taps → `« 2 s`, 2 jumps after the first double), a middle tap toggles at once, a side single tap toggles after ~¼ s, landscape single tap with faded controls only wakes them. Pinch can't be driven by the harness: check `wheel` + Ctrl zoom and drag-pan with the mouse, plus the clamping on resize.
- [ ] **Step 4: Commit** `Video player: pinch to zoom, drag to pan, double-tap a side to jump`.

### Task 7: Portrait for upright videos

**Files:** Create `src/lib/components/video/SectionRow.svelte`; modify `SpotList.svelte`, `TopBar.svelte`, `SectionView.svelte`, `SpotEditor.svelte`, `src/lib/components/ui/VideoPlayer.svelte`

**Interfaces:**
- Consumes: Task 1 (`ontenth`), Task 2 (`hidden`, `saveVideoPrefs({ hidden })`).
- Produces:
  - `SectionRow` props `{ spots: Spot[]; activeId: number | null; onopen: (s: Spot) => void; onall: () => void }` — `All · n` chip first, then chips in time order (section: name + `lengthText`; point: flag + name), the active one in the accent and scrolled into view (`scrollIntoView({ inline: 'center', block: 'nearest' })` on change).
  - `SpotList` prop `editAll?: boolean` — an **Edit** button on every card (non-compact), calling `onedit`.
  - `TopBar`: with `onback` and not `overlay`, the title block is a spacer (the name is the badge on the video).
  - `SectionView` variant `panel` becomes: `2.7 / 7.2 s` with a **Hide** button, the section timeline with start/end, the large transport, then a `row` snippet prop (the `SectionRow`). Its back row, speed row, Linked line and Edit section button go.

- [ ] **Step 1: Navigation.** `fromList` drops its `replaceTop` branch: a section → `toSection`, a point → `toEdit` (both `jump` to `[FULL, target]` when the stack is deeper than the full video, so Back always returns to the full video). Chips use `fromList` too.
- [ ] **Step 2: Layout.** In portrait the video area is `relative min-h-[120px] flex-1` (no aspect-ratio, no `55dvh`); the area below is `shrink-0` with `max-height: calc(100dvh − 56px − 120px)` and scrolls only past that. Full video (shown): time + length, **Hide**, timeline, transport, Mark point / Start section, `SectionRow`. Section view: `SectionView` panel with the row. Hidden (full or section, from prefs): one slim bar — the right timeline, **Show**, `−0.1 s / Play / +0.1 s`, the time or `2.7 / 7.2 s`. The editor ignores Hide. Portrait top bar in a section view: `onback = nav.up`, `onedit = toEdit(openSpot)` (Edit in the accent style when not overlay — add `BTN_ACCENT` for `onedit` in `TopBar` when `!overlay`).
- [ ] **Step 3: The All sheet.** `sheet === 'list'` in portrait renders in the below area: a header `Sections and points · n` with ✕ (`nav.up()`), then the scrolling `SpotList` with `editAll` (`onopen = fromList`, `onedit = toEdit`). Landscape's panel list gets `editAll` too.
- [ ] **Step 4: Editor sizing.** `SpotEditor`'s move row buttons `h-13`, Done `h-13 min-w-38`; its inner wrapper stays `overflow-y-auto` (only scrolls in the short-screen fallback).
- [ ] **Step 5: Verify** svelte-check (0 errors) and in the browser at 390×844 with the upright test video (make one: the existing 60 s frame-counter clip re-encoded at 1080×1920, a new recording row like the round-1 one) and the wide one, and at 390×640:
  - full video and section view fit with no scroll; the editor fits at 844 and scrolls only at 640 with the video ≥ 120 px;
  - Hide/Show both levels; reopen the player → still hidden; change speed in `VideoFrame` → still hidden;
  - a chip in the section view switches section; Back → full video; All → sheet; a card's Edit → editor; Done → section view; Back → full video;
  - landscape and desktop look as before apart from Edit on landscape's list cards.
- [ ] **Step 6: Commit** `Video player: portrait for upright videos — Hide, a row of sections, Back and Edit on top, an editor that fits`.

### Task 8: Docs

**Files:** Modify `docs/superpowers/specs/2026-10-01-video-player-design.md` (the full-screen player section, Testing, Known gaps), `docs/superpowers/specs/2026-10-29-video-player-upright-design.md` (Status: built), `CLAUDE.md` (the "Live" clause and the `src/lib/video/` layout line: `frame-rate.ts` out; `zoom.ts`, `taps.ts`, `screen-on.ts` in).

- [ ] **Step 1:** Rewrite the player section's Layouts / Full video / Section view / Editor / Frames / Keyboard paragraphs to match: 0.1 s steps (no frames), portrait sizing and Hide, the sections row and All sheet, zoom, double-tap, the wake lock. Known gaps: pinch is only checked through the trackpad path in the harness.
- [ ] **Step 2:** `nix develop -c npm run check` — Expected: all green.
- [ ] **Step 3: Commit** `Docs: the player on a phone, round 2`.
