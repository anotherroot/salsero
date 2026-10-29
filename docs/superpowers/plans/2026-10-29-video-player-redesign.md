# Full-screen player redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the full-screen video player's screens as three levels (full video, section view, editor) with frame steps, a drag-and-nudge section editor, sheets for rename and delete, and back/Esc going up one level — with the API, data model and loop rule unchanged.

**Architecture:** Everything that can be decided without a DOM is a pure module under `src/lib/video/` with a spec: frame and whole-section arithmetic (`spots.ts`), the trim strip's geometry (`trim.ts`), the stack of screens and the loop it implies (`screens.ts`), keys and layout (`keys.ts`, `layout.ts`), the history bookkeeping behind an injected port (`player-history.ts`), and the frame-rate estimate (`frame-rate.ts`). `ui/VideoPlayer.svelte` stays the one entry point and becomes a shell (dialog, `<video>`, fullscreen, the stack, the history port, the loop, keys, writes); the screens are small components in a new `src/lib/components/video/`. Back is SvelteKit shallow routing: one `pushState` entry per screen, `page.state.videoPlayer` holding the depth.

**Tech Stack:** SvelteKit 2.70 / Svelte 5 runes, TypeScript, Tailwind, vitest (node project only — there are no component tests in this repo).

**Spec:** `docs/superpowers/specs/2026-10-29-video-player-redesign-design.md` (and `2026-10-01-video-player-design.md` for what stays). Mockups: https://claude.ai/artifact/Frkabcp1eJGFVjvG8kU5qe

## Global Constraints

- No change to `video_spots`, `/api/video-spots`, `src/lib/server/spots.ts`, `spots-api.ts`, or `loopTarget`; the loop is still checked every animation frame.
- Nothing under `$lib/server` is imported by components. Pure modules in `src/lib/video/` never touch the DOM, `Date.now()` or `window`.
- Edges are integer milliseconds; `MIN_SECTION_MS` (1000) still bounds every edit; `moveEdge` still decides whether a nudge changes anything.
- The player is always dark, whatever the site theme; its accent is `getDance(page.params.dance ?? 'salsa').accentDark`, ink on the accent `#140803`.
- Touch targets at least 44 px. No `autofocus`, no `.focus()` on a text field — the keyboard opens only when the user taps the field.
- Nothing deletes in one tap. No browser `confirm()`.
- Writes go straight through the API as today: "Couldn't save" / "Couldn't load spots" on failure; edits to an existing spot show at once, are sent in order, and reload the list on a failure.
- Copy is the spec's, verbatim, where the spec gives it: `Delete "<name>"?`, `Keep it`, `Delete`, `Linked to <target>. Unlink it there first; until then this section stays.`, `Deleted <name>` / `Undo`, `Section saved · 7.2 s`, `Point saved at 1:38.5`, `End set to 1:10.40`, `‹ Full video`, `Edit section`, `Done`, `Sections (n)`.
- `npm run check` must pass at the end of every task.

## Review Focus

- **A video whose duration is not known yet** (`NaN` before metadata): frame seeks, whole-section moves and the trim window must clamp only at 0, never produce `NaN` (Task 1, Task 2 tests).
- **A section at the very start or end of the video** (`startMs 0`, `endMs` = duration): Earlier/Later/Longer and ±1 f clamp, and the buttons disable rather than doing nothing (Task 1 tests).
- **Back pressed twice quickly, or forward pressed after back**: the stack never goes negative and never grows from a forward move (Task 5 tests).
- **A spot deleted elsewhere (another device) while its section view is open**: a reload of the list that lacks the open spot drops the player to the full video instead of rendering an undefined spot (Task 3 `prune` test).
- **Undo after a failed delete, or a delete of a linked section that slipped past the disabled button** (a 409): the sheet shows the server's message and the spot stays; no Undo toast (Task 10 manual check).

---

### Task 1: Frame and whole-section arithmetic

**Files:**
- Modify: `src/lib/video/spots.ts` (append after `moveEdge`)
- Test: `src/lib/video/spots.spec.ts` (append)

**Interfaces — Produces:**
- `DEFAULT_FRAME_S = 1 / 30`
- `frameNumber(currentS: number, frameS: number): number`
- `frameSeek(currentS: number, frames: number, frameS: number, durationS: number): number` — seconds, the middle of the frame `frames` away
- `edgeByFrames(spot: Pick<Spot,'startMs'|'endMs'>, edge: 'start'|'end', frames: number, frameS: number, durationS: number): { startMs: number; endMs: number | null } | null`
- `edgeFrameTime(spot: Pick<Spot,'startMs'|'endMs'>, edge: 'start'|'end', frameS: number): number` — seconds to show for an edge
- `WHOLE_SHIFT_MS = 500`, `WHOLE_RESIZE_MS = 250`
- `shiftSpot(spot, deltaMs: number, durationS: number): { startMs: number; endMs: number } | null`
- `resizeSpot(spot, perSideMs: number, durationS: number): { startMs: number; endMs: number } | null` — positive grows

- [ ] **Step 1: Write the failing tests**

```ts
const F = 1 / 30;
describe('frameNumber', () => {
	it('floors, and an exact boundary is that frame', () => {
		expect(frameNumber(0, F)).toBe(0);
		expect(frameNumber(1, F)).toBe(30);
		expect(frameNumber(1.0499, F)).toBe(31);
	});
});
describe('frameSeek', () => {
	it('lands in the middle of the next or previous frame', () => {
		expect(frameSeek(1, 1, F, 10)).toBeCloseTo(31.5 / 30, 6);
		expect(frameSeek(1, -1, F, 10)).toBeCloseTo(29.5 / 30, 6);
	});
	it('clamps inside the video, and to 0 only while the duration is unknown', () => {
		expect(frameSeek(0, -1, F, 10)).toBe(0);
		expect(frameSeek(9.99, 1, F, 10)).toBe(10);
		expect(frameSeek(0, -1, F, NaN)).toBe(0);
		expect(frameSeek(100, 1, F, NaN)).toBeCloseTo(3001.5 / 30, 6);
	});
});
describe('edgeByFrames', () => {
	const s = { startMs: 1000, endMs: 3000 };
	it('moves an edge one frame from its nearest frame boundary', () => {
		expect(edgeByFrames(s, 'start', 1, F, 10)).toEqual({ startMs: 1033, endMs: 3000 });
		expect(edgeByFrames(s, 'end', -1, F, 10)).toEqual({ startMs: 1000, endMs: 2967 });
	});
	it('is null at a bound', () => {
		expect(edgeByFrames({ startMs: 0, endMs: 3000 }, 'start', -1, F, 10)).toBeNull();
		expect(edgeByFrames({ startMs: 1000, endMs: 2000 }, 'end', -1, F, 10)).toBeNull();
		expect(edgeByFrames({ startMs: 1000, endMs: null }, 'end', 1, F, 10)).toBeNull();
	});
});
describe('edgeFrameTime', () => {
	it('is the first frame inside for a start and the last inside for an end', () => {
		expect(edgeFrameTime({ startMs: 1000, endMs: 3000 }, 'start', F)).toBeCloseTo(1 + F / 2, 6);
		expect(edgeFrameTime({ startMs: 1000, endMs: 3000 }, 'end', F)).toBeCloseTo(3 - F / 2, 6);
	});
});
describe('shiftSpot', () => {
	it('moves both edges and keeps the length', () => {
		expect(shiftSpot({ startMs: 1000, endMs: 3000 }, 500, 10)).toEqual({ startMs: 1500, endMs: 3500 });
	});
	it('stops at the start and end of the video', () => {
		expect(shiftSpot({ startMs: 200, endMs: 3000 }, -500, 10)).toEqual({ startMs: 0, endMs: 2800 });
		expect(shiftSpot({ startMs: 0, endMs: 3000 }, -500, 10)).toBeNull();
		expect(shiftSpot({ startMs: 8000, endMs: 10_000 }, 500, 10)).toBeNull();
	});
	it('is null for a point', () => {
		expect(shiftSpot({ startMs: 1000, endMs: null }, 500, 10)).toBeNull();
	});
});
describe('resizeSpot', () => {
	it('grows and shrinks each side', () => {
		expect(resizeSpot({ startMs: 1000, endMs: 3000 }, 250, 10)).toEqual({ startMs: 750, endMs: 3250 });
		expect(resizeSpot({ startMs: 1000, endMs: 3000 }, -250, 10)).toEqual({ startMs: 1250, endMs: 2750 });
	});
	it('clamps a grow at the video edges', () => {
		expect(resizeSpot({ startMs: 0, endMs: 1000 }, 250, 10)).toEqual({ startMs: 0, endMs: 1250 });
		expect(resizeSpot({ startMs: 0, endMs: 10_000 }, 250, 10)).toBeNull();
	});
	it('shrinks no further than MIN_SECTION_MS, centred', () => {
		expect(resizeSpot({ startMs: 1000, endMs: 2200 }, -250, 10)).toEqual({ startMs: 1100, endMs: 2100 });
		expect(resizeSpot({ startMs: 1000, endMs: 2000 }, -250, 10)).toBeNull();
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/spots.spec.ts`
Expected: FAIL — the new names are not exported.

- [ ] **Step 3: Implement the functions in `src/lib/video/spots.ts`**

`frameNumber` adds a 1e-6 epsilon before flooring so exact boundaries count. `edgeByFrames` snaps the edge to `Math.round(edgeS / frameS) * frameS`, adds `frames * frameS`, converts with `msOf`, and hands the result to `moveEdge` (so its clamping and null rule apply). `shiftSpot` clamps the delta itself so the length is kept. `resizeSpot` clamps each edge to the video; if the result is shorter than `MIN_SECTION_MS` it shrinks to exactly `MIN_SECTION_MS` around the old midpoint (`Math.round`); null when nothing changes. Unknown duration (`!Number.isFinite`) bounds only at 0, as `step` and `moveEdge` already do.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/video/spots.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/spots.ts src/lib/video/spots.spec.ts
git commit -m "Video spots: frame steps and whole-section moves"
```

---

### Task 2: The trim strip's geometry

**Files:**
- Create: `src/lib/video/trim.ts`
- Test: `src/lib/video/trim.spec.ts`

**Interfaces — Produces:**
- `TRIM_PAD_MS = 3000`, `TRIM_FIT_MS = 500`, `GRAB_PX = 28`
- `interface TrimWindow { fromMs: number; toMs: number }`
- `trimWindow(spot: Pick<Spot,'startMs'|'endMs'>, durationS: number): TrimWindow` — the spot ± `TRIM_PAD_MS`, clamped to the video (a point uses its start for both edges)
- `fitWindow(win: TrimWindow, spot, durationS: number): TrimWindow` — returns `win` itself when both edges are at least `TRIM_FIT_MS` inside; otherwise widens the side that is too close to that edge ± `TRIM_PAD_MS`, clamped
- `msAtX(x: number, width: number, win: TrimWindow): number` — rounded, clamped to the window
- `pctOf(ms: number, win: TrimWindow): number` — 0–100, clamped
- `handleAt(x: number, width: number, win: TrimWindow, spot, grabPx?: number): 'start' | 'end' | null` — the nearer handle within `grabPx`, start on a tie; a point only ever answers `'start'`

- [ ] **Step 1: Write the failing tests** — in `trim.spec.ts`:
  - `trimWindow({startMs: 10_000, endMs: 17_000}, 60)` is `{fromMs: 7000, toMs: 20_000}`; `trimWindow({startMs: 1000, endMs: 5000}, 6)` is `{fromMs: 0, toMs: 6000}`; with `durationS` `NaN`, `toMs` is `endMs + 3000`.
  - `fitWindow` returns the same object (`toBe`) for `{7000, 20_000}` and the spot above; for an end moved to 19_800 it returns `{fromMs: 7000, toMs: 22_800}`; for a start moved to 7200 it returns `{fromMs: 4200, toMs: 20_000}`.
  - `msAtX(0, 300, {7000, 20_000})` is 7000, `msAtX(150, 300, …)` is 13_500, `msAtX(-20, 300, …)` is 7000, `msAtX(400, 300, …)` is 20_000.
  - `pctOf(13_500, {7000, 20_000})` is 50; `pctOf(0, …)` is 0; `pctOf(99_999, …)` is 100.
  - `handleAt`: width 300, window `{7000, 20_000}`, spot `{10_000, 17_000}` (start at x≈69.2, end at x≈230.8): x 75 → `'start'`, x 225 → `'end'`, x 150 → `null`; a point at 10_000, x 60 → `'start'`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/trim.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/video/trim.ts`** with the signatures above.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/video/trim.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/trim.ts src/lib/video/trim.spec.ts
git commit -m "Video spots: the trim strip's window, positions and handles"
```

---

### Task 3: Screens, and the loop they imply

**Files:**
- Create: `src/lib/video/screens.ts`
- Test: `src/lib/video/screens.spec.ts`

**Interfaces — Produces:**
```ts
export type PlayerSheet = 'rename' | 'delete' | 'keys';
export type Screen =
	| { kind: 'full' }
	| { kind: 'section'; spotId: number }
	| { kind: 'edit'; spotId: number }
	| { kind: 'sheet'; sheet: PlayerSheet };
export type Stack = readonly Screen[]; // [0] is always { kind: 'full' }
```
- `openingStack(loopSpotId?: number): Stack` — `[full]`, or `[full, section]`
- `levelOf(stack: Stack): Screen` — the top screen that is not a sheet
- `sheetOf(stack: Stack): PlayerSheet | null`
- `doneTarget(stack: Stack, spot: Pick<Spot,'id'|'endMs'>): 'pop' | Screen` — the editor's Done: a point pops; a section pops when its section view is directly below, otherwise replaces the editor with `{kind:'section', spotId}`
- `loopOf<T extends Pick<Spot,'id'|'endMs'>>(stack: Stack, spots: readonly T[], paused: boolean): T | null` — the section whose section view or editor is the level; null at the full video, for a point, or when `paused` and the level is its editor
- `prune(stack: Stack, spots: readonly Pick<Spot,'id'>[]): Stack` — cut the stack just below the first screen whose spot no longer exists; the same array when nothing is missing

- [ ] **Step 1: Write the failing tests** — `screens.spec.ts`:
  - `openingStack()` equals `[{kind:'full'}]`; `openingStack(4)` equals `[{kind:'full'},{kind:'section',spotId:4}]`.
  - `levelOf` of `[full, section 4, sheet 'delete']` is the section; `sheetOf` of it is `'delete'`, of `[full]` is null.
  - `doneTarget([full, section 4, edit 4], {id:4,endMs:9000})` is `'pop'`; `doneTarget([full, edit 4], {id:4,endMs:9000})` equals `{kind:'section',spotId:4}`; `doneTarget([full, edit 5], {id:5,endMs:null})` is `'pop'`.
  - `loopOf([full], spots, false)` null; `loopOf([full, section 4], …)` is spot 4; `loopOf([full, section 4, edit 4], …, true)` null and with `false` spot 4; `loopOf([full, edit 5], …)` null where 5 is a point; `loopOf([full, section 4, sheet 'rename'], …, false)` is spot 4.
  - `prune([full, section 4, edit 4], [{id: 5}])` equals `[full]`; `prune(s, [{id:4}])` is `s` itself (`toBe`).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/screens.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/video/screens.ts`.**

- [ ] **Step 4: Run the tests** — same command; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/screens.ts src/lib/video/screens.spec.ts
git commit -m "Video player: the stack of screens and the loop it implies"
```

---

### Task 4: Keys and layout

**Files:**
- Create: `src/lib/video/keys.ts`, `src/lib/video/layout.ts`
- Test: `src/lib/video/keys.spec.ts`, `src/lib/video/layout.spec.ts`

**Interfaces — Produces:**
- `type KeyAction = 'toggle' | 'back1' | 'fwd1' | 'framePrev' | 'frameNext' | 'mark' | 'section' | 'setStart' | 'setEnd' | 'jumpStart' | 'jumpEnd' | 'loop' | 'keys'`
- `keyAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, level: Screen['kind']): KeyAction | null` — `' '` toggle, `ArrowLeft`/`ArrowRight` back1/fwd1, `,`/`.` frames, `?` keys — at every level; `m`/`s` (either case) only at `'full'` _(my call: marking from inside a section or editor would start a section the screen does not show)_; `i`/`o` only at `'edit'`; `[`/`]` at `'section'` and `'edit'`; `l` only at `'edit'`; anything with Ctrl/Meta/Alt is null. Esc is not here: it is the dialog's `cancel`.
- `type PlayerLayout = 'portrait' | 'landscape' | 'desktop'`
- `LANDSCAPE_MAX_H = 520`
- `layoutFor(width: number, height: number): PlayerLayout` — taller than wide is portrait; otherwise height under `LANDSCAPE_MAX_H` is landscape; else desktop

- [ ] **Step 1: Write the failing tests** — a `it.each` table over every row of the spec's key table, per level, including `I` at `'section'` → null, `L` at `'full'` → null, `M` at `'edit'` → null, `{key:'s', ctrlKey:true}` → null; and `layoutFor(390, 844)` portrait, `(844, 390)` landscape, `(1280, 800)` desktop, `(800, 800)` desktop, `(1024, 519)` landscape.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/keys.spec.ts src/lib/video/layout.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both modules.**

- [ ] **Step 4: Run the tests** — same command; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/keys.ts src/lib/video/keys.spec.ts src/lib/video/layout.ts src/lib/video/layout.spec.ts
git commit -m "Video player: keys per level, and the three layouts"
```

---

### Task 5: History behind a port

The mechanism the spec leaves to the builder, decided here: **SvelteKit shallow routing.** Opening the player pushes one entry per screen of its opening stack; every screen pushed later (a section, the editor, a sheet) pushes one more; `page.state.videoPlayer` is the depth. History is the single source of truth for going up: Back, Esc (the dialog's `cancel`, `preventDefault`ed), the in-app buttons that go up, and leaving browser fullscreen all call `up()`, which only calls `history.go(-1)`; the stack changes when the resulting `page.state` arrives in `sync()`. ✕ calls `close()`. SvelteKit treats a popstate between entries of the same navigation as shallow — it updates `page.state` without running `beforeNavigate` — so the unsaved-changes guard (`src/lib/unsaved/guard.svelte.ts`) never sees these moves (`node_modules/@sveltejs/kit/src/runtime/client/client.js`, the popstate listener's `shallow` branch).

**Files:**
- Create: `src/lib/video/player-history.ts`
- Test: `src/lib/video/player-history.spec.ts`
- Modify: `src/app.d.ts` — `interface PageState { videoPlayer?: number }` inside `namespace App`

**Interfaces:**
- Consumes: `Screen`, `Stack` from Task 3
- Produces:
```ts
export interface HistoryPort {
	push(depth: number): void;
	replace(depth: number): void;
	go(delta: number): void;
}
export class PlayerHistory {
	constructor(port: HistoryPort, onchange: (stack: Stack) => void, onclosed: () => void);
	get stack(): Stack;
	open(initial: Stack): void;     // one port.push per screen, depth 1..n; onchange(initial)
	push(screen: Screen): void;     // onchange at once, port.push(depth)
	replaceTop(screen: Screen): void; // onchange at once, port.replace(depth)
	up(): void;                     // port.go(-1) only
	close(): void;                  // port.go(-depth) only
	jump(target: Stack): void;      // go back to the common prefix, then push the rest once sync reaches it
	sync(depth: number | undefined): void;
}
```

- [ ] **Step 1: Write the failing tests** — with a fake port that records calls:
  - `open(openingStack(4))` records `push(1), push(2)` and reports that stack.
  - `push(edit 4)` reports a stack of 3 at once and records `push(3)`.
  - `up()` records `go(-1)` and does not change the stack; `sync(2)` then reports `[full, section 4]`.
  - `sync(1)` twice in a row (two quick backs, the second arriving late) leaves `[full]` and reports once.
  - `sync(0)` and `sync(undefined)` call `onclosed` exactly once, however many times they arrive.
  - A forward move, `sync(4)` at depth 3, records `go(-1)` and leaves the stack alone.
  - `close()` at depth 3 records `go(-3)`.
  - `replaceTop({kind:'section', spotId: 4})` on `[full, edit 4]` records `replace(2)` and reports `[full, section 4]`.
  - `jump([full, section 7])` from `[full, section 4, edit 4]` records `go(-2)`; after `sync(1)` it records `push(2)` and reports `[full, section 7]`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/player-history.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `PlayerHistory`** in plain TypeScript (no runes, so the node test project can load it), and add `PageState` to `src/app.d.ts`.

- [ ] **Step 4: Run the tests** — same command; Expected: PASS. Then `npm run check`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/player-history.ts src/lib/video/player-history.spec.ts src/app.d.ts
git commit -m "Video player: history bookkeeping, one entry per screen"
```

---

### Task 6: The frame rate

**Files:**
- Create: `src/lib/video/frame-rate.ts`
- Test: `src/lib/video/frame-rate.spec.ts`

**Interfaces — Produces:**
- `interface FrameSample { mediaTime: number; presentedFrames: number }`
- `frameDurationOf(samples: readonly FrameSample[]): number | null` — from consecutive samples whose `presentedFrames` differ by exactly 1 and whose `mediaTime` gap lies in (1/121, 1/9) s: the median gap, once there are at least 5 such pairs; else null
- `watchFrameDuration(video: HTMLVideoElement, onframe: (frameS: number) => void): () => void` — collects samples with `requestVideoFrameCallback` while the video plays, calls `onframe` once a duration is known, stops after that; a no-op returning a no-op where `requestVideoFrameCallback` does not exist. The cleanup cancels the pending callback.

- [ ] **Step 1: Write the failing tests** for `frameDurationOf`: 10 samples 1/25 s apart → 0.04; samples 1/30 s apart with one dropped frame (`presentedFrames` jumps by 2) and one seek (gap 1.5 s) → 1/30; four good pairs → null; empty → null.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/video/frame-rate.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both functions.** `watchFrameDuration` is not unit-tested (it needs a real video); it is checked in Task 12.

- [ ] **Step 4: Run the tests** — same command; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/frame-rate.ts src/lib/video/frame-rate.spec.ts
git commit -m "Video player: measure the frame duration from presented frames"
```

---

### Task 7: The player's building blocks

Presentational components, no state of their own beyond hover/drag. Styling follows the mockup: dark surfaces, the accent from a `--pl-accent` custom property set by the shell (Task 10), inline stroke SVG icons with `aria-label` on icon-only buttons. These have no unit tests; `npm run check` (svelte-check) is the gate, and Task 12 checks them in a browser.

**Files:**
- Create: `src/lib/components/video/TopBar.svelte`
- Create: `src/lib/components/video/Transport.svelte`
- Create: `src/lib/components/video/Timeline.svelte`
- Create: `src/lib/components/video/Toast.svelte`
- Create: `src/lib/components/video/icons.ts` — the SVG path strings, one export per icon (close, mirror, play, pause, framePrev, frameNext, flag, bracket, loop, pencil, trash, link, check, chevronLeft, chevronRight)

**Interfaces — Produces (props):**
- `TopBar`: `{ title: string; subtitle: string; mirror: boolean; rate: VideoRate; spotsCount?: number; onclose: () => void; onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void; onspots?: () => void }` — ✕, title/subtitle, Mirror toggle, a speed button opening a popover of `VIDEO_RATES`; a `Sections (n)` button only when `onspots` is given (landscape).
- `Transport`: `{ paused: boolean; size: 'compact' | 'normal' | 'large'; seconds?: boolean; ontoggle: () => void; onstep: (s: -1 | 1) => void; onframe: (f: -1 | 1) => void }` — −1 s, previous frame, Play/Pause, next frame, +1 s; `seconds: false` drops the ±1 s pair (the editor's compact row).
- `Timeline`: `{ fromMs: number; toMs: number; currentMs: number; bands?: { id: number; startMs: number; endMs: number | null; active: boolean }[]; pending?: { startMs: number } | null; onseek: (ms: number) => void }` — a track dragged with pointer capture (`touch-action: none`), sections as bands (active in the accent), points as ticks, the pending band from `pending.startMs` to the playhead. Used for the whole video (`0..duration`) and for a section (`startMs..endMs`, no bands).
- `Toast`: `{ text: string; action?: { label: string; run: () => void } }` — `role="status"`; the shell owns its timer (about 4 s).

- [ ] **Step 1: Write `icons.ts` and the four components** to the props above.
- [ ] **Step 2: Run `npm run check`** — Expected: passes (the components are not mounted yet; svelte-check type-checks them).
- [ ] **Step 3: Commit**

```bash
git add src/lib/components/video/
git commit -m "Video player: top bar, transport, timeline and toast components"
```

---

### Task 8: The list and the section view

**Files:**
- Create: `src/lib/components/video/SpotList.svelte`
- Create: `src/lib/components/video/SectionView.svelte`

**Interfaces:**
- Consumes: `Timeline`, `Transport` (Task 7); `spotLabel`, `spotTime` (`spots.ts`)
- Produces (props):
  - `SpotList`: `{ spots: Spot[]; activeId: number | null; loadFailed: boolean; onopen: (spot: Spot) => void }` — the cards of the spec's "Sections and points" (icon, name, `1:04.0–1:11.2 · 7.2 s` or `1:38.5 · point`, `Linked to …`), the empty text from today's panel, and "Couldn't load spots".
  - `SectionView`: `{ spot: Spot; currentMs: number; frameNo: number; paused: boolean; rate: VideoRate; layout: PlayerLayout; onfull: () => void; onedit: () => void; onseek: (ms: number) => void; ontoggle: () => void; onstep: (s: -1 | 1) => void; onframe: (f: -1 | 1) => void; onrate: (r: VideoRate) => void }` — `‹ Full video`, the `Looping` marker, name and `Linked to …`, the section-only `Timeline` with start, `2.7 / 7.2 s` and end, the time in the video and `frame N`, a large `Transport`, inline speed buttons, and `Edit section`. In `landscape` it renders only the overlay pieces (the back button and name top-left, the timeline and transport at the bottom) for the shell to place over the video.

- [ ] **Step 1: Write both components.**
- [ ] **Step 2: Run `npm run check`** — Expected: passes.
- [ ] **Step 3: Commit**

```bash
git add src/lib/components/video/SpotList.svelte src/lib/components/video/SectionView.svelte
git commit -m "Video player: the spot list and the section view"
```

---

### Task 9: The editor and the sheets

**Files:**
- Create: `src/lib/components/video/TrimStrip.svelte`
- Create: `src/lib/components/video/SpotEditor.svelte`
- Create: `src/lib/components/video/PlayerSheet.svelte`

**Interfaces:**
- Consumes: `trimWindow`, `fitWindow`, `msAtX`, `pctOf`, `handleAt`, `GRAB_PX` (Task 2); `moveEdge`, `edgeByFrames`, `shiftSpot`, `resizeSpot`, `WHOLE_SHIFT_MS`, `WHOLE_RESIZE_MS`, `msOf`, `spotTime` (Task 1 and existing); `Transport` (Task 7)
- Produces (props):
  - `TrimStrip`: `{ spot: Spot; selected: 'start' | 'end'; currentMs: number; durationS: number; ondragstart: (edge: 'start'|'end') => void; ondrag: (edge: 'start'|'end', ms: number) => void; ondragend: (edge: 'start'|'end') => void; onseek: (ms: number) => void }` — keeps its own `TrimWindow` in `$state`, fixed while a drag is on, `fitWindow`ed on release and when the spot changes from outside; second and five-second ticks; `GRAB_PX` scaled by `rect.width / offsetWidth` as in the prototype; the drag value is snapped to the frame grid by the shell, not here. Under it the window's first and last times and "drag a handle · tap to seek".
  - `SpotEditor`: `{ spot: Spot; selected: 'start'|'end'; currentMs: number; durationS: number; frameS: number; frameNo: number; paused: boolean; looping: boolean; layout: PlayerLayout; onselect: (edge: 'start'|'end') => void; onmove: (times: { startMs: number; endMs: number | null }, how: 'second' | 'frame' | 'now' | 'whole' | 'drag', edge: 'start'|'end') => void; ondragstart: () => void; onseek: (ms: number) => void; onloop: () => void; onrename: () => void; ondelete: () => void; ondone: () => void; ontoggle: () => void; onframe: (f: -1 | 1) => void }` — the spec's editor top to bottom. It computes each button's new times with the Task 1 functions and disables a button whose function returns null; it emits the times, and the shell writes and seeks. A point shows only the strip's marker and the move row.
  - `PlayerSheet`: `{ kind: PlayerSheet; spot: Spot | null; message: string | null; oncancel: () => void; onrename: (label: string) => void; ondelete: () => void }` — an in-stage bottom panel (absolutely positioned inside the player's stage, **not** a nested `<dialog>`: a second modal dialog opened inside browser fullscreen is not reliably shown above it), with a backdrop button that cancels. `rename`: a `<label>`led text input with `maxlength={MAX_SPOT_LABEL}`, never focused programmatically, Enter saves, Cancel / Save. `delete`: the spec's copy; for a spot with `linkedTo.length > 0` the linked text and Delete disabled; `message` shows a server refusal (a 409). `keys`: the key table, from Task 4's rows.

- [ ] **Step 1: Write the three components.**
- [ ] **Step 2: Run `npm run check`** — Expected: passes.
- [ ] **Step 3: Commit**

```bash
git add src/lib/components/video/TrimStrip.svelte src/lib/components/video/SpotEditor.svelte src/lib/components/video/PlayerSheet.svelte
git commit -m "Video player: the section editor, trim strip and sheets"
```

---

### Task 10: The shell, portrait first

Rewrite `src/lib/components/ui/VideoPlayer.svelte` around the new pieces, keeping its props (`src`, `owner`, `startAt`, `mirror`, `rate`, `onchoose`, `onclose`, `loopSpot`) so `VideoFrame` and `SectionPlayer` do not change. Add two props for the top bar: `title: string` and `subtitle: string`, defaulting to `''` and `'Video'`; `VideoFrame` and `SectionPlayer` pass what they know (`SectionPlayer` gets them from `SectionVideo.from`; `VideoFrame` gets a new optional `title` prop its callers may fill in later — leave callers alone in this task if they have no title to hand).

**Files:**
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (rewrite)
- Modify: `src/lib/components/ui/SectionPlayer.svelte`, `src/lib/components/ui/VideoFrame.svelte` (title/subtitle pass-through only)

**Interfaces — Consumes:** everything from Tasks 1–9; `pushState`, `replaceState` from `$app/navigation`; `page` from `$app/state`; `getDance` from `$lib/dances/dances`.

What the shell owns, decided here:

- **The stack.** A `PlayerHistory` whose port is `push: d => pushState('', { videoPlayer: d })`, `replace: d => replaceState('', { videoPlayer: d })`, `go: d => history.go(d)`; `onchange` sets a `$state` copy of the stack; `onclosed` does today's `close()` (pause, exit fullscreen, `dialog.close()`, `onclose(at)`). An `$effect` on `page.state.videoPlayer` calls `sync`. `open(openingStack(loopSpot?.id))` on mount. After every spots load, `prune` the stack; if it shrank, `jump` to the pruned stack.
- **Going up.** The dialog's `cancel` → `preventDefault()`; `history.up()`. If the dialog closes without our `close()` (Chrome Android's CloseWatcher may close a modal dialog on back without a cancel the second time), `showModal()` it again and `up()`. `fullscreenchange` to not-fullscreen: at depth > 1 `up()` and remember never to ask for fullscreen again; at depth 1 close, as today.
- **Levels.** Section card → `push({kind:'section'})`; point card → `push({kind:'edit'})`; Edit section → `push({kind:'edit'})`; toast Edit → `push({kind:'edit'})`; `‹ Full video` → `up()`; Done → `doneTarget` → `up()` or `replaceTop`; rename/delete/`?` → `push({kind:'sheet'})`, closed with `up()`. ✕ → `close()`.
- **The loop** is `loopOf(stack, spots, loopPaused)`; `loopPaused` resets to false whenever the level changes. Entering a section view seeks to its start and plays (play() is allowed: a tap opened it). The rAF loop check and `onended` stay as they are, reading this derived loop.
- **Edits.** `SpotEditor.onmove` → the existing in-order `change()` queue; then seek by `how`: `'second'`/`'whole'` play from the start (or the last 2 s up to the end for the end edge), `'frame'` and `'drag'` pause and seek to `edgeFrameTime`, `'now'` does not seek and toasts `End set to …`/`Start set to …` with `spotTime`-style hundredths. Drag frames: snap the dragged ms to the frame grid (`Math.round(ms / (frameS*1000)) * frameS*1000`, rounded) before `moveEdge`; send one PATCH on release, not per move. `ondragend` plays as `'second'` does. The list is not re-sorted while an editor is open (today's `endEdit` rule): sort when the level leaves the editor.
- **Delete.** Sheet Delete → `removeSpot`; on success `jump([full])`, toast `Deleted <name>` with Undo → `postSpot(owner, {startMs, endMs, label})` and add the returned spot; on a 409 keep the sheet open with the server's message.
- **Frames.** `frameS = $state(DEFAULT_FRAME_S)`, set by `watchFrameDuration` on mount; `frameNo = frameNumber(current, frameS)`; frame buttons `video.pause()` then seek to `frameSeek`.
- **Marking.** Mark and Start/End section as today, plus the pending band and the running length on the button, and the saved toasts with Edit.
- **Keys** via `keyAction(e, levelOf(stack).kind)`, ignored while a text input has focus, exactly as today.
- **Layout** `layoutFor(innerWidth, innerHeight)` on a `resize` listener. This task builds **portrait**: top bar, the video box at full width (`aspect-ratio: 16 / 9`, `object-fit: contain`), and below it the full video's time row, `Timeline`, `Transport`, Mark/Section row and `SpotList` (scrolling); or `SectionView`; or the compact transport plus `SpotEditor`. Nothing overlays the video in portrait except the badge (`0.5× · Mirrored`), the loop name and progress bar, and the paused play glyph.
- **Tokens** on the dialog root: `--pl-accent` from `getDance(page.params.dance ?? 'salsa').accentDark`, `--pl-accent-ink: #140803`, and the surface greys from the mockup.

- [ ] **Step 1: Rewrite the shell** as above, deleting the old Spots panel, its edit rows and the `autofocus`.
- [ ] **Step 2: Run `npm run check`** — Expected: passes.
- [ ] **Step 3: Check it in a browser at 390×844** against `npm run dev`, on a lesson video with spots: open, play, ±1 s, frames (the frame number changes by one), mark, start/end a section, open it (section view loops), Edit section, drag a handle, ±1 f, Earlier/Later/Shorter/Longer, Now, rename (the keyboard does not open until the field is tapped), delete with Keep it, delete with Delete then Undo, a linked section's disabled Delete, a 409 forced by linking the section in another tab while its sheet is open (the sheet shows the message, the spot stays, no Undo), Done, `‹ Full video`, ✕ — and the browser's Back from each level going up one.
- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ui/VideoPlayer.svelte src/lib/components/ui/SectionPlayer.svelte src/lib/components/ui/VideoFrame.svelte
git commit -m "Video player: three levels, frame steps and the section editor (portrait)"
```

---

### Task 11: Landscape and desktop

**Files:**
- Modify: `src/lib/components/ui/VideoPlayer.svelte`
- Modify: `src/lib/components/video/SpotList.svelte` (a `compact` row style for the desktop sidebar), `SectionView.svelte`, `SpotEditor.svelte` (layout-specific sizing only)

What to build, from the spec's Layouts section and the mockups:

- **Landscape:** the video fills the screen. Full video and section view: `TopBar` (with `onspots`, showing `Sections (n)`) and the bottom controls float over the video and fade after 3 s of playing (today's `wake` logic), a tap brings them back. `Sections (n)` and the editor open a right panel (about 300 px); the video shrinks to the space beside it (`object-fit: contain`), never under it. The open list is a history entry like a sheet — `{ kind: 'sheet', sheet: 'list' }` — so Back or Esc closes the list first and leaves the level alone. Tapping a section card in it replaces the list entry with that section's view (`replaceTop`); a point's card replaces it with the point's editor.
- **Desktop:** one layout for all levels. The video at the left with the timeline (the whole video's at the full level, the section's in the section view and editor) and transport below, then the key legend; a sidebar on the right with `SpotList`. Section view: the open card highlighted with its name, range and an `Edit` button. Editor: that card expanded into `SpotEditor` (as in the mockup). A card tapped while another is open → `jump([full, section new])`. The Start/End selectors show their `I`/`O` keys.

- [ ] **Step 1: Add `'list'` to `PlayerSheet` in `screens.ts`** with a test that `sheetOf([full, {kind:'sheet', sheet:'list'}])` is `'list'` and `levelOf` of it is the full video; run `npx vitest run src/lib/video/screens.spec.ts` — Expected: PASS.
- [ ] **Step 2: Build both layouts.**
- [ ] **Step 3: Run `npm run check`** — Expected: passes.
- [ ] **Step 4: Check in a browser** at 844×390 and 1280×800: every level, the panel in landscape not covering the video, the desktop keys from the table, Esc going up a level (and closing the list panel / a sheet first).
- [ ] **Step 5: Commit**

```bash
git add src/lib/video/screens.ts src/lib/video/screens.spec.ts src/lib/components/ui/VideoPlayer.svelte src/lib/components/video/
git commit -m "Video player: landscape and desktop layouts"
```

---

### Task 12: Docs and the phone

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-video-player-design.md` — fold in what was built: the three levels, the layouts, frame steps, the editor, sheets, keys, the history mechanism and why it is shallow routing; drop the now-wrong panel description; update "Known gaps" (the Esc-in-rename gap is gone; add "frame rate is measured, 1/30 s until known"); change the redesign pointer at the top to "built".
- Modify: `docs/superpowers/specs/2026-10-29-video-player-redesign-design.md` — status line: built, folded into the 2026-10-01 spec.
- Modify: `CLAUDE.md` — the "Live" paragraph's full-screen player clause (three levels, frame steps, section editor) and the `src/lib/video/` layout line (add `trim.ts`, `screens.ts`, `keys.ts`, `layout.ts`, `player-history.ts`, `frame-rate.ts`).

- [ ] **Step 1: Update the three documents.**
- [ ] **Step 2: Run `npm run check`** — Expected: passes.
- [ ] **Step 3: Build the APK and check on the phone** (`nix develop .#android -c ./android/gradlew -p android test assembleDebug`, against the dev server or a deploy as `docs/deployment.md` says): Back from the editor, the section view and the full video, both in fullscreen and after leaving it; a section opened from a linked section card inside the Link a section sheet goes back to that sheet, not past it; the frame number changes by exactly one per frame step on a saved YouTube video. If the phone is not to hand, say so in the hand-off rather than marking this done.
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/
git commit -m "Docs: the redesigned full-screen player"
```
