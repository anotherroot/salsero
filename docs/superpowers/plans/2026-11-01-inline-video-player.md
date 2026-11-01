# Our player in the page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser's `<video controls>` in `ui/VideoFrame.svelte`
with our own controls on the picture — a play disc, the time, and the
full-screen player's seek bar with the sections as bands — so no browser
button (volume, ⋮, browser full screen) shows anywhere a video sits in a page.

**Architecture:** `VideoFrame.svelte` keeps its `<video>` (no `controls`)
inside a 16:9 black stage and draws an overlay on it. What the overlay shows
for a given state (disc, length pill, bar, spinner), the time line and the
bands are a new pure module `src/lib/video/inline.ts` with a spec. The bar
is the full-screen player's `components/video/Timeline.svelte`, given an
opt-in keyboard. Sections are fetched with `fetchSpots(owner)` on the first
play and again when the full-screen player closes, so a page that never plays
a video makes no extra request. Audio-only recordings keep the browser's
`<audio controls>`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node project only — there are no component tests; components are checked by `npm run check` and in the browser).

**Spec:** `docs/superpowers/specs/2026-10-01-video-player-design.md`, section
"The inline player" — rewritten by Task 1 from the decisions below, which
were approved on the mockups in `docs/superpowers/design-kit/screens/inline.py`
(`python3 -I inline.py OUT.html` draws every place and every state).

Decisions made with the user (2026-11-01):

- Our controls replace the browser's in every inline video: lesson page,
  figure page, the Today figure popup and lesson review popup (and the exercise
  page, which uses the same Content components).
- A tap on the picture **plays it in place** (not full screen). Tapping again pauses.
- **Full screen, Mirror and speed stay in the row under the picture**, where
  the design board draws them. Nothing about the caption row or control row changes.
- Before the first play: the board's thumbnail — a dark play disc in the
  centre and the length in a pill at the bottom right. No bar.
- Once played: a dark fade at the bottom holding the time (`0:09 / 1:08`) and
  the seek bar with the sections as bands (points as ticks); the disc returns
  while paused; a spinner while the video waits for data.
- No volume, mute or menu button: volume is the phone's.
- Mirror flips the picture only, never the controls.

## Global Constraints

- `npm run check` (prettier + eslint + svelte-check + build + vitest) must pass.
- `src/lib/video/*.ts` is PURE and client-safe: no DOM, no fetch, no `$lib/server`.
- Nothing under `$lib/server` is imported by components (CLAUDE.md).
- A colour on a built control is the builder's: never append a `text-*`/`bg-*`
  after a builder's output (`class-rules.spec.ts`). Plain spans may carry their own classes.
- The overlay sits on a black picture in both light and dark page themes, so
  it uses literal white/black classes (as `Timeline.svelte` and the full-screen
  player's play disc do), not page tokens that flip with the theme.
- VideoFrame's parents are `CLIP` cards (`focus-inset overflow-hidden`), so
  focus rings on the overlay's controls draw inside; do not add outside rings.
- Dates and times on screen go through `$lib/format.ts` (`clock`), never `toLocale*`.

## Review Focus

1. **A video whose duration is not known yet** (metadata still loading, or a
   stream reporting `Infinity`/`NaN`): the length pill and the time's `/ total`
   are left out, never `NaN:NaN`; the bar does not draw until a duration is
   known. Pinned by the `timeText` and `lengthText` cases in Task 2.
2. **The sections fetch fails or the owner is missing** (offline, 5xx, the
   kit gallery's fake ids): the bar still draws, without bands; nothing is
   thrown into the page and no error shows. Owned by Task 3, step 6 (checked in the browser).
3. **Play is refused** (`play()` rejects — autoplay policy, or the source is
   gone): the disc stays, no unhandled rejection in the console. Task 3, step 3.
4. **The video ends**: the disc returns at the end; a tap plays it again from
   the start. Pinned by the `inlineParts` "ended counts as paused" case in Task 2.
5. **Full screen and back**: the inline video pauses when the full-screen
   player opens, resumes nowhere on its own, lands on the time the player
   closed at, and its bands show sections added in the player. Task 3, step 6.

---

### Task 1: The spec, the board note and CLAUDE.md

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-video-player-design.md` (section "The inline player", and the "Purpose" paragraph's "The inline player is the browser's own `<video controls>`")
- Modify: `docs/superpowers/specs/2026-10-31-redesign-design.md` (the "Video under a log or a lesson" and "Video card" lines)
- Modify: `docs/superpowers/design-kit/screens/figure.py:115` (docstring "a tap goes full screen")
- Add: `docs/superpowers/design-kit/screens/inline.py` (already in the working tree, uncommitted)
- Modify: `CLAUDE.md` (the "Live" paragraph and the `src/lib/video/` layout entry)

- [ ] **Step 1: Rewrite "The inline player"** with the decisions listed under **Spec** above, in the spec's own voice (short paragraphs, no bullets of process). Name `src/lib/video/inline.ts` as where the overlay's states are decided, say sections are fetched on the first play and refreshed when the full-screen player closes, and that audio-only recordings keep `<audio controls>`. In "Purpose", change the sentence about the inline player to past tense ("was the browser's own…") and add one line: since 2026-11-01 the inline player draws its own controls too.

- [ ] **Step 2: Redesign spec.** In both lines, add that the picture carries our controls (play disc, time, seek bar with sections) and that a tap plays it in place.

- [ ] **Step 3: Board note.** In `figure.py` `recording()`'s docstring replace "a tap goes full screen" with "a tap plays it in place; Full screen is in the row".

- [ ] **Step 4: CLAUDE.md.** In "Live", change "a full-screen video player (…)" to also say the inline video draws our own controls (append ", and the inline video with our own controls: play, the time, a seek bar with the sections" after the player's parenthesis). In the `src/lib/video/` layout entry add `inline.ts (what the inline video's overlay shows, its time line and bands)` beside `caption.ts`.

- [ ] **Step 5: Check the mockup script still runs**

Run: `cd docs/superpowers/design-kit/screens && timeout 180 nix shell nixpkgs#python3 -c python3 -I inline.py /tmp/inline-check.html && echo ok`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-10-01-video-player-design.md docs/superpowers/specs/2026-10-31-redesign-design.md docs/superpowers/design-kit/screens/figure.py docs/superpowers/design-kit/screens/inline.py CLAUDE.md docs/superpowers/plans/2026-11-01-inline-video-player.md
git commit -m "docs: the inline video draws our own controls — spec, board note, mockups"
```

---

### Task 2: `src/lib/video/inline.ts` — what the overlay shows

**Files:**
- Create: `src/lib/video/inline.ts`
- Test: `src/lib/video/inline.spec.ts`

**Interfaces:**
- Consumes: `clock(seconds: number): string` from `$lib/format`; `Spot` from `$lib/types`.
- Produces:
  - `interface InlineState { played: boolean; paused: boolean; waiting: boolean }` — `played` turns true on the video's first `play` event and stays true; `paused` is the element's `paused` (true after `ended` too).
  - `interface InlineParts { disc: boolean; length: boolean; bar: boolean; spinner: boolean }`
  - `inlineParts(s: InlineState): InlineParts`
  - `timeText(currentS: number, durationS: number): string`
  - `lengthText(durationS: number): string | null`
  - `interface InlineBand { id: number; startMs: number; endMs: number | null; active: false }` (structurally `Timeline.svelte`'s `Band`)
  - `inlineBands(spots: Spot[]): InlineBand[]`

- [ ] **Step 1: Write the failing spec**

```ts
import { describe, expect, it } from 'vitest';
import { inlineBands, inlineParts, lengthText, timeText } from './inline';

describe('inlineParts', () => {
	it('before the first play: the disc and the length, no bar', () => {
		expect(inlineParts({ played: false, paused: true, waiting: false })).toEqual({
			disc: true, length: true, bar: false, spinner: false
		});
	});
	it('waiting before the first play: the spinner replaces the disc', () => {
		expect(inlineParts({ played: false, paused: false, waiting: true })).toEqual({
			disc: false, length: true, bar: false, spinner: true
		});
	});
	it('playing: the bar only', () => {
		expect(inlineParts({ played: true, paused: false, waiting: false })).toEqual({
			disc: false, length: false, bar: true, spinner: false
		});
	});
	it('paused after playing (and ended counts as paused): the bar and the disc', () => {
		expect(inlineParts({ played: true, paused: true, waiting: false })).toEqual({
			disc: true, length: false, bar: true, spinner: false
		});
	});
	it('waiting while played: the bar and the spinner, no disc', () => {
		expect(inlineParts({ played: true, paused: false, waiting: true })).toEqual({
			disc: false, length: false, bar: true, spinner: true
		});
		expect(inlineParts({ played: true, paused: true, waiting: true }).disc).toBe(false);
	});
});

describe('timeText', () => {
	it('the time and the length', () => expect(timeText(9.4, 68)).toBe('0:09 / 1:08'));
	it('the length unknown: the time alone', () => {
		expect(timeText(9.4, NaN)).toBe('0:09');
		expect(timeText(9.4, Infinity)).toBe('0:09');
		expect(timeText(0, 0)).toBe('0:00');
	});
});

describe('lengthText', () => {
	it('a known length', () => expect(lengthText(68.2)).toBe('1:08'));
	it('not known yet', () => {
		expect(lengthText(NaN)).toBeNull();
		expect(lengthText(Infinity)).toBeNull();
		expect(lengthText(0)).toBeNull();
	});
});

describe('inlineBands', () => {
	it('sections and points, none active, in the order given', () => {
		const spots = [
			{ id: 1, startMs: 5000, endMs: 13700, label: 'Madrid', linkedTo: [] },
			{ id: 2, startMs: 20000, endMs: null, label: null, linkedTo: [] }
		];
		expect(inlineBands(spots)).toEqual([
			{ id: 1, startMs: 5000, endMs: 13700, active: false },
			{ id: 2, startMs: 20000, endMs: null, active: false }
		]);
	});
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/lib/video/inline.spec.ts`
Expected: FAIL — cannot resolve `./inline`.

- [ ] **Step 3: Implement `src/lib/video/inline.ts`** with the interfaces above and a header comment in the style of `chrome.ts` ("PURE: …"). Rules: `disc = paused && !waiting`; `length = !played`; `bar = played`; `spinner = waiting`. A duration counts as known when `Number.isFinite(d) && d > 0`. Times through `clock`.

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/lib/video/inline.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/inline.ts src/lib/video/inline.spec.ts
git commit -m "feat(video): the inline overlay's states, time line and bands"
```

---

### Task 3: VideoFrame draws our controls

**Files:**
- Modify: `src/lib/components/video/Timeline.svelte` (opt-in keyboard)
- Modify: `src/lib/components/ui/VideoFrame.svelte` (the `kind === 'video'` branch and the full-screen close)

**Interfaces:**
- Consumes: Task 2's `inlineParts`, `timeText`, `lengthText`, `inlineBands`; `fetchSpots(owner: SpotOwner): Promise<Spot[]>` (`$lib/video/spots-api`); `buffering(now, event)` and `MediaEvent` (`$lib/video/chrome`); `seekKey(key, valueS, durationS): number | null` (`$lib/songs/timeline`); `ON_VIDEO` (`$lib/components/video/styles`); `Spinner`, `Icon`.
- Produces: `Timeline` gains `keyboard?: boolean` (default `false`). VideoFrame's props are unchanged, so no page changes.

- [ ] **Step 1: Timeline keyboard.** Add `keyboard = false`. When true the slider gets `tabindex="0"` and `onkeydown`: `const to = seekKey(e.key, (currentMs - fromMs) / 1000, span / 1000)`; if not null, `preventDefault()` and `onseek(fromMs + Math.round(to * 1000))`. When false it stays `tabindex="-1"` with no handler (the full-screen player owns the arrow keys). Update the comment above the slider to say both.

- [ ] **Step 2: The stage.** Replace the `<video controls …>` with a `relative aspect-video w-full overflow-hidden bg-black` stage holding:
  - the `<video>` as `absolute inset-0 size-full`, **without** `controls`, adding `disableremoteplayback`, keeping `playsinline`, `preload="metadata"`, `class:mirror`, `bind:playbackRate`, `watchMedia`, `keepPitch`, and adding `bind:paused`, `bind:currentTime`, `bind:duration`, `onplay={() => (played = true)}` (plus loading spots, step 5), and the seven buffering events exactly as `VideoPlayer.svelte:940-946` wires them into a `waiting` state;
  - an overlay `div` with class `theme-media absolute inset-0` (the player's palette, so Spinner and any token read dark in both page themes).

  State: `played = $state(false)`, `paused = $state(true)`, `currentTime = $state(0)`, `duration = $state(NaN)`, `waiting = $state(false)`, `spots = $state<Spot[]>([])`; `parts = $derived(inlineParts({ played, paused, waiting }))`.

- [ ] **Step 3: The tap target and the disc.** In the overlay, a full-size `<button type="button" class="absolute inset-0 cursor-pointer">` with `aria-label={paused ? 'Play' : 'Pause'}` that calls `inline.play().catch(() => {})` when paused, else `inline.pause()`. Inside it, centred and `aria-hidden`:
  - when `parts.disc`: a 48 px disc in the full-screen player's look (`grid size-12 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]`) holding `<Icon name="play" filled size={24} />` nudged `ml-[3px]`;
  - when `parts.spinner`: the same disc holding `<Spinner size={24} />` (the button's label already says what a tap does; the spinner is decoration).

- [ ] **Step 4: The length pill and the bar.**
  - When `parts.length` and `lengthText(duration)` is not null: a `span` with `ON_VIDEO` plus `font-bold text-white/92`, `pointer-events-none absolute right-2 bottom-2`.
  - When `parts.bar` and the duration is known (`lengthText(duration) !== null`): a `pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-b from-black/0 to-black/72 px-3 pt-[22px]` fade holding the time (`text-[12px] font-extrabold text-white tabular-nums`, `timeText(currentTime, duration)`, `-mb-2.5`) and a `pointer-events-auto` wrapper around `<Timeline fromMs={0} toMs={duration * 1000} currentMs={currentTime * 1000} bands={inlineBands(spots)} glass keyboard onseek={(ms) => { if (inline) inline.currentTime = ms / 1000; }} />`. The fade lets a tap through to the button everywhere but the bar.

- [ ] **Step 5: Sections.** A `loadSpots()` that, when `owner` is set, does `fetchSpots(owner).then((s) => (spots = s)).catch(() => {})`. Call it from `onplay` the first time only (`if (!played) loadSpots()` before setting `played`), and in the full-screen player's `onclose` when `played` is true — after setting `inline.currentTime = at` and `fullAt = null`, before `onclosed?.()`. `openFull` is unchanged (it already pauses).

- [ ] **Step 6: Check it in the browser.** `npm run check` must pass first. Then with `npm run dev`, a lesson with a video and sections, and a figure recording, at 390 px wide in both light and dark (and once in bachata), confirm by eye and by screenshot against the mockups (`docs/superpowers/design-kit/screens/inline.py`):
  - the lesson page, the figure page, the Today figure popup and the lesson review popup each show the thumbnail state with no browser controls;
  - a tap plays in place, the bar appears with the sections as bands, a tap pauses and the disc returns; dragging the bar seeks; Tab reaches the bar and ←/→ move 5 s;
  - Full screen opens the player at the current time, the inline video stays paused, and closing returns to that time; a section added in the player shows as a band after closing;
  - Mirror flips the picture and not the bar; speed still applies;
  - the kit gallery (`/dev/kit`, fake ids, no file) shows no error and no console noise beyond the missing file the page already reports;
  - playing to the end brings the disc back and a tap restarts; the console has no unhandled rejection;
  - an audio recording still shows the browser's audio bar.

  Run: `npm run check`
  Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/video/Timeline.svelte src/lib/components/ui/VideoFrame.svelte
git commit -m "feat(video): the inline video draws our own controls — play, time, sections on the seek bar"
```
