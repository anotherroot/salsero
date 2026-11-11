# Hearing drills, phase 1b — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The listening player's round as decided on 2026-11-11: the target drawn as circles you
fill with no feedback, spots that start over / Reset / Skip, colours only when a drop ends, the
slide to the next spot, result B with a 0–100 score, a replay per drop, and the clave explained.

**Architecture:** Pure rules in `src/lib/hearing/` (drop window, the spot's state machine, the
score, the verdict, the stack's geometry, the replay's cues), each with a spec. The page keeps
setup and the tap check and creates the player inside the Start tap (as now); the dropped-in run,
the tap-along run, result B and the replay become their own components in
`src/lib/components/hearing/`. Nothing is saved; no migration.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind via `src/lib/components/ui/styles.ts`, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-hearing-drills-design.md`, section "Phase 1b — a round
you can see" (and "How a tap is judged"). The look: https://claude.ai/artifact/Wdspg2ZuajQvwVgAfvdB9N
(its code is in the session scratchpad only; the spec's words win).

## Global Constraints

- Words through `t()` in `en` and `sl` (vikanje, `slCount`, decimal comma); digits, "2-3"/"3-2" and "6&" are not words (`TARGET_DIGITS` precedent; `catalog.spec.ts` forbids same-as-English leaves).
- Colours from builders/constants in `.ts` files (`class-rules.spec.ts`); SVG `fill-*`/`stroke-*` token classes are fine.
- No `Date.now()`/`performance.now()` inside `src/lib/hearing`; times are arguments.
- Player timing on the AudioContext; the replay's ticks are scheduled ahead on an AudioContext, never fired by `setTimeout`.
- Reduced motion: no slides, pops or pulses; same order of states.
- `onDestroy` runs on the server too: guard every `cancelAnimationFrame`/AudioContext call.
- Building: per task only its specs (`nix develop -c npx vitest run <files> --maxWorkers=4`), `npx eslint`, `npx prettier --check` on changed files; full `npm run check` before the final review and again after merging master.

## Review Focus

1. A first tap just before a 1 (within ±150 ms) belongs to the eight that 1 starts, not the one before: the window starts there. Test in Task 1.
2. Skipping a spot whose music is still playing: the music stops, the spot scores 0, its beats count as missed, the next spot starts. Test in Task 2 (state) and Task 6 (scene).
3. Reset during the reveal or the slide does nothing (the spot is over). Test in Task 2.
4. A round stopped with no drop finished: the result shows only finished drops; with none, back to the setup. Test in Task 3 (`roundScore([])`) and Task 6.
5. The replay of a drop near the song's end: it never seeks past the audio's end, the cues after the end are dropped. Test in Task 4.

---

### Task 1: The drop's window

**Files:**
- Modify: `src/lib/hearing/drops.ts`, `src/lib/hearing/drops.spec.ts`

**Interfaces:**
- Consumes: `timeline`, `timeAt` (`$lib/scheduler/scheduler`), `beatIndexAt` (`$lib/beatgrid/beatgrid`), `matchTaps`, `windowS`, `SPOT_ON_S`, `Grid` (`./judge`).
- Produces:
  ```ts
  export const ROOM_BEATS = 56; // replaces the private 64: 4 listening + 2 tapping + 1 spare eight
  export interface DropWindow { eight: number; from: number; end: number } // end = the 1 two eights on (or the last beat + one beat)
  export function dropWindow(grid: Grid, first: number): DropWindow;
  export type BeatState = 'spot' | 'close' | 'miss' | 'skip';
  export interface DropBeat { row: 0 | 1; pos: number; at: number; state: BeatState; offset: number | null }
  export interface DropAnswer { start: number; tap: number | null; hit: boolean; offset: number | null; count: number | null; listened: number | null; hits: number; of: number; spot: number; close: number; beats: DropBeat[]; eight: number | null; taps: number[] }
  export function judgeDropPattern(grid: Grid, positions: number[], start: number, taps: number[]): DropAnswer;
  ```
- Rules: the window's eight is the eight of the beat nearest `first + windowS(beat)` (`timeline().eights`), so a tap up to 150 ms before a 1 opens that 1's eight. Expected beats: every target position of `eight` and `eight + 1` (`timeAt`); those of row 0 with `at < first − windowS` are `skip` and do not count in `of`. Matching as `matchTaps` (unchanged). `spot`/`close` counted separately (the score needs them). No taps → `tap: null`, `eight: null`, `beats: []`, `of = 2 × positions.length`, all else 0/null. `judgeDrop` (one tap) goes: every target now uses two eights (spec 1b.3) — delete it and its tests; `judgeDrops` keeps summing `hits`/`of`.
- [ ] **Step 1: Update and add tests** in `drops.spec.ts` (grid: 120 BPM from 0, counts 1–8):
  - `dropWindow(g, 12.02)` → `{ eight: 3, from: 12, end: 20 }`; `dropWindow(g, 15.9)` (0.1 s before the 1 at 16) → `eight: 4` (Review Focus 1).
  - 1 3 5 7, taps `[14.02, 15, 16.03, 17]` (first tap on the 5 of eight 3): `of` 6 (the 1 and 3 of eight 3 are `skip`), `hits` 4, `spot` 4; `beats.filter(b => b.state === 'skip').map(b => b.pos)` = `[1, 3]`.
  - clave 2-3 `[2,3,5,6.5,8]`, no taps → `of` 10, `hits` 0, `beats` `[]`.
  - `ROOM_BEATS` is 56 and `dropStarts` keeps 56 beats after every start (adjust the old 64 test).
  - delete the `judgeDrop` tests; keep `judgeDrops` tests using `judgeDropPattern`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/drops.spec.ts` — FAIL (no `dropWindow`, counts differ).
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** the spec — PASS; `npx tsc --noEmit -p .` shows no errors in `src/lib/hearing` (round.ts uses `judgeDrop`'s type only; `revealOf` is removed in Task 6).
- [ ] **Step 5: Commit** `feat(hearing): a drop is the first tap's eight and the next`.

### Task 2: The spot's rules

**Files:**
- Create: `src/lib/hearing/spot.ts`, `src/lib/hearing/spot.spec.ts`

**Interfaces:**
- Consumes: `DropWindow` (Task 1), `TargetId`-free (positions only).
- Produces:
  ```ts
  export const LISTEN_EIGHTS = 4;      // no first tap in this many eights → start over
  export const SKIP_AFTER = 3;         // Skip shows after this many start-overs
  export function longestGapBeats(positions: number[]): number; // cyclic, in beats: clave 2-3 → 2, the 1 → 8
  export type SpotPhase = 'listening' | 'tapping' | 'over';
  export interface Spot { start: number; attemptStart: number; restarts: number; first: number | null; lastTap: number | null; taps: number[]; fill: number; window: DropWindow | null; phase: SpotPhase; skipped: boolean }
  export function newSpot(start: number): Spot;
  export function tapSpot(s: Spot, at: number, window: DropWindow | null, circles: number): Spot; // window: dropWindow() on the first tap, else ignored
  export type SpotStep = 'keep' | 'restart' | 'end';
  export function stepSpot(s: Spot, now: number, rules: { eightS: number; gapS: number; winS: number }): SpotStep;
  export function restartSpot(s: Spot): Spot; // restarts + 1, back to listening at `start`, taps cleared
  export function skipSpot(s: Spot): Spot;    // phase 'over', skipped true
  export function endSpot(s: Spot): Spot;     // phase 'over'
  export const canSkip = (s: Spot) => s.restarts >= SKIP_AFTER && s.phase !== 'over';
  ```
- Rules (spec 1b.3): `listening` and `now − attemptStart > 4 × eightS` → `restart`; `tapping` and `now − lastTap > eightS + gapS` and `now < window.end` → `restart`; `tapping` and `now > window.end + winS` → `end`; `over` → `keep`. `tapSpot` on `over` returns `s` unchanged; `fill` is `min(fill + 1, circles)`. `restartSpot` on `over` returns `s` unchanged (Review Focus 3).
- [ ] **Step 1: Write the failing tests:** `longestGapBeats([2,3,5,6.5,8])` = 2, `([1])` = 8, `([3,6,7])` = 4; a spot started at 10 s with `eightS` 4 restarts at 26.01 and keeps at 25.9; after taps at 12 and 13 (window end 20) it restarts at 13 + 4 + 1 + 0.01 for gap 1 s and not before; ends at 20.16 with `winS` 0.15; `fill` stops at `circles`; `canSkip` false at 2 restarts, true at 3; `restartSpot` and `tapSpot` on an ended spot return it unchanged; `skipSpot` → `{ phase: 'over', skipped: true }`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/spot.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): a spot starts over, and can be skipped`.

### Task 3: The score and the verdict

**Files:**
- Create: `src/lib/hearing/score.ts`, `score.spec.ts`, `src/lib/hearing/verdict.ts`, `verdict.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // score.ts (spec 1b.5)
  export const CLOSE_WEIGHT = 0.7, RESTART_KEEP = 0.85, LISTEN_KEEP = 0.95, FREE_LISTEN_EIGHTS = 2;
  export interface DropScore { score: number; timing: number; restartsLoss: number; listenLoss: number } // all 0–100, score = timing − restartsLoss − listenLoss
  export function scoreDrop(d: { spot: number; close: number; of: number; restarts: number; listenEights: number; skipped: boolean }): DropScore;
  export function roundScore(drops: DropScore[]): DropScore; // the mean of each field, rounded; [] → all 0
  // verdict.ts (spec 1b.6)
  export type Verdict = { kind: 'late' | 'early'; pos: number; ms: number } | { kind: 'missed'; pos: number; misses: number; of: number } | { kind: 'onTime' };
  export function verdictOf(beats: { pos: number; offset: number | null }[], positions: number[]): Verdict;
  ```
- Rules: `timing = (spot + 0.7 × close) / of × 100` (of 0 → 0); restarts keep `0.85^restarts`; listening keeps `0.95^max(0, listenEights − 2)` (continuous); `restartsLoss = timing × (1 − rk)`, `listenLoss = timing × rk × (1 − lk)`; skipped → all 0. Verdict: per position the mean offset of its hit beats; the position with the largest |mean| over 60 ms wins (late or early by sign, `ms` rounded |mean|); else the position with the most misses (> 0); else `onTime`. `skip` beats are not passed in.
- [ ] **Step 1: Write the failing tests:** a perfect drop with 5 restarts scores 44 (±0.5) with `restartsLoss` 56; a perfect drop listening 3 eights scores 95; 4 eights → 90.25; spot 8, close 2, of 10 → timing 94; skipped → `{0,0,0,0}`; `roundScore` of a 100 and a 50 → 75, of `[]` → zeros (Review Focus 4); verdict: 6& hits at +70/+80 ms, others ±10 → `{ kind: 'late', pos: 6.5, ms: 75 }`; all within 20 ms but the 2 missed twice → `{ kind: 'missed', pos: 2, misses: 2, of: … }`; all within 20 ms → `onTime`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/score.spec.ts src/lib/hearing/verdict.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): the round's score and what to work on`.

### Task 4: The stack's geometry and the replay's cues

**Files:**
- Create: `src/lib/hearing/stack.ts`, `stack.spec.ts`, `src/lib/hearing/replay.ts`, `replay.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // stack.ts (spec 1b.6, the stack)
  export const STACK_ROWS = 10, STACK_CLAMP_BEATS = 0.45;
  export interface StackDot { pos: number; dx: number /* beats, clamped ±0.45 */; row: number /* 0–9 */; state: 'spot' | 'close' }
  export function stackDots(beats: { pos: number; offset: number | null }[], beatS: number): StackDot[]; // per position sorted by offset, row = index % 10
  export function stackDepth(dots: StackDot[]): number; // the most rows any position uses, at least 1
  // replay.ts (spec 1b.7)
  export interface ReplayCue { at: number; kind: 'tap' | 'beat' }
  export interface ReplayPlan { from: number; to: number; cues: ReplayCue[] }
  export function replayPlan(grid: Grid, drop: Pick<DropAnswer, 'eight' | 'beats' | 'taps'>, songEnd: number): ReplayPlan | null;
  export function cuesBetween(plan: ReplayPlan, a: number, b: number): ReplayCue[]; // a ≤ at < b
  export function stepBeat(grid: Grid, t: number, dir: -1 | 1): number; // the previous/next beat time from t
  ```
- Rules: `from` = the beat two before the window's first 1 (≥ 0); `to` = `min(window end + 0.5, songEnd)`; cues: a `beat` for every counted (not `skip`) target beat, a `tap` for every tap; cues outside `[from, to)` dropped (Review Focus 5). `eight: null` → `null`.
- [ ] **Step 1: Write the failing tests:** offsets +0.3 s at 0.5 s beats clamp to `dx` 0.45; −0.05 s → −0.1; 12 dots on one position → rows 0–9 then 0, 1; `stackDepth` 10; `replayPlan` for eight 3 (window 12–20) → `from` 11, `to` 20.5, beat cues only for counted beats; `songEnd` 18 → `to` 18 and no cue at or after 18; `cuesBetween` half-open; `stepBeat(g, 12.2, 1)` = 12.5, `(g, 12.2, -1)` = 12, `(g, 12, -1)` = 11.5.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/stack.spec.ts src/lib/hearing/replay.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): the stack's dots and the replay's cues`.

### Task 5: Words, the circles, the clave card

**Files:**
- Modify: `src/lib/i18n/en/hearing.ts`, `src/lib/i18n/sl/hearing.ts`, `src/lib/components/hearing/ListenSetup.svelte`
- Create: `src/lib/components/hearing/PatternRows.svelte`, `src/lib/components/hearing/ClaveCard.svelte`, `src/lib/hearing/words.ts` additions + `words.spec.ts`

**Interfaces:**
- Produces:
  - `posLabel(p: number): string` (`words.ts`, digits: `"6&"` for 6.5) and `posName(p: number): string` (words: en "the 1", "the and of 6"; sl in the glossary's register, e.g. "ena", "»in« po 6").
  - `t().hearing` additions: `eightRow(n)` ("Eight 1"), `reset` ("Reset"), `skip` ("Skip"), `startOver.{noTap,stopped,reset}` ("No tap in four eights: from the start of the spot again" / "You stopped: from the start of the spot again" / "From the start of this spot"), `listening` ("Listen…"), `listenFirst` ("listen first"), `nextSpot` ("next spot coming"), `keepTapping` (exists), `dropOf(n, of)` (exists as `drop`), `restartsLine(n)` ("1 start-over" / "2 start-overs"), `firstTry` ("First try"), `result.scoreTitle(n)` ("Score 74"), `result.onBeat(hit, of)` ("89 of 100 on the beat"), `result.restarts(n)`, `result.findEach(s)` ("about 2.4 s to find each spot"), `result.parts.{timing,restarts,listening}`, `result.stackTitle` ("All your eights, on top of each other"), `result.early`/`result.late` ("◂ early", "late ▸"), `result.verdict2.{late(pos, ms),early(pos, ms),missed(pos, n, of),onTime}` with subs, `result.dropRow(n, section)` ("Drop 3 · Coro"), `result.dropDetail(hit, of, restarts)`, `result.skipped`, `replay.{title(n), countOn, yourTap, onTime, close, missed, now, slower, back}`, `clave.{t23, p23, t32, p32, hear}` (the spec's sentences, 1b.8).
  - `PatternRows.svelte` props: `{ positions: number[]; rows: Record<number, CircleState>[]; labels: string[]; pop?: { row: number; pos: number } | null; head?: { row: number; pos: number } | null; marks?: { row: number; pos: number; stray: boolean }[] }` with `type CircleState = 'future' | 'next' | 'filled' | 'skip' | 'spot' | 'close' | 'miss'` exported from `src/lib/hearing/round.ts`. Draws one SVG per row as on the board: counts 1–8 under a line, a circle per position with `posLabel` inside; `next` larger with a pulse; `pop` replays the pop on that circle; colours as SVG token classes (`fill-done`, `fill-warn`, `stroke-danger` dashed, `fill-accent`).
  - `ClaveCard.svelte` props `{ clave: ClavePattern; onhear: () => void }`: the sentence for 2-3/3-2, the eight drawn with `PatternRows` (all `filled`), a **Hear it** button.
- Setup: `ListenSetup` shows `ClaveCard` under the 2-3/3-2 chips; **Hear it** is the page's: inside the tap, a count-only `createPlayer` on `syntheticGrid(bpm of the song, 2)` with `toggles { count: 'all', clave }`, stopped after two eights (`onEnd`).
- [ ] **Step 1: Write the failing test** in `words.spec.ts`: `posLabel(6.5)` = "6&", `posLabel(2)` = "2", `posName(6.5)` = "the and of 6", `posName(1)` = "the 1".
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/words.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the words (both catalogs), `posLabel`/`posName`, `PatternRows`, `ClaveCard`, the setup card and Hear it.
- [ ] **Step 4: Run** `nix develop -c npx vitest run src/lib/hearing src/lib/i18n --maxWorkers=4` — PASS (catalog complete, no same-as-English leaves); `npx svelte-check --threshold error` clean.
- [ ] **Step 5: Commit** `feat(hearing): the pattern's circles and the clave explained`.

### Task 6: The runs

**Files:**
- Create: `src/lib/components/hearing/DropRun.svelte`, `src/lib/components/hearing/TapAlongRun.svelte`
- Modify: `src/routes/[dance]/songs/[id]/listen/+page.svelte`, `src/lib/hearing/round.ts` (drop `revealOf`/`Reveal`; add `CircleState`), `round.spec.ts`
- Delete: `src/lib/components/hearing/ListenResult.svelte`, `BeatStrip.svelte` (after Task 7 replaces them; delete in Task 7 if still referenced)

**Interfaces:**
- Consumes: Tasks 1–5; `PlayerHandle` (the page creates it inside the Start tap, as now, and passes it in), `tapSongTime`, `TapPad`, `ListenShell`, `RUN_STOP`.
- `DropRun.svelte` props: `{ player: PlayerHandle; audio: HTMLAudioElement; grid: Grid; quiet: QuietRange[]; sections: Placed[]; positions: number[]; beatS: number; starts: number[]; tapDelayMs: number; title: string; subtitle: string; onfinish: (drops: FinishedDrop[]) => void; onleave: () => void }` with `FinishedDrop = { answer: DropAnswer; restarts: number; skipped: boolean; listenEights: number; section: string }` exported from `src/lib/hearing/round.ts`.
- Behaviour (spec 1b.2–1b.4): per spot `newSpot(start)` → seek, lock, after 1.1 s unlock with the bounce (`TapPad` gains `locked` and `bounce` props); taps → `tapSpot`, `PatternRows` fills in order with `pop` on the filled circle, next circle `next`; the frame loop runs `stepSpot` with `eightS = 8 × beatS`, `gapS = longestGapBeats × beatS`, `winS = 0.15`; `restart` → `restartSpot`, pattern slides out and back empty, the spot's start again, the stage line is the matching `startOver` words; Reset → the same with `startOver.reset`; Skip (shown when `canSkip`, with the bounce) → `skipSpot`, music stops, next spot; `end` → `judgeDropPattern(grid, positions, spot.start, spot.taps)`, pad locks ("next spot coming"), circles take their states one by one (~70 ms apart, `pop`), the stage shows `hit/of` and `restartsLine`/`firstTry` for ~1.4 s, then the stage and pattern slide out (~450 ms, classes as on the board), the next spot slides in. Stop → `onfinish` with the finished drops only (Review Focus 4: none → the page returns to setup). A spot whose music hits the song's end → `end`.
- `TapAlongRun.svelte`: as phase 1's tap-along, with one `PatternRows` row that fills in order and empties (slide) every `positions.length` taps; no colours; Reset restarts the round; same `onfinish` shape with one `FinishedDrop` per song part (`judgeTapAlong` sections), `restarts 0`, `listenEights 0`.
- The page: `view` becomes `'setup' | 'check' | 'run' | 'result' | 'replay'`; `run` renders `DropRun` or `TapAlongRun`; their `onfinish` sets the drops and shows the result.
- [ ] **Step 1: Update `round.spec.ts`** (remove `revealOf` tests; `songParts`, `roundSpan` stay) and run it — PASS. (The run components are checked by scenes, Step 3.)
- [ ] **Step 2: Implement** `DropRun`, `TapAlongRun`, the page wiring, `TapPad` `locked`/`bounce`.
- [ ] **Step 3: Scenes** in `scripts/shots/ext_hearing.py`: `listen-run` (a drop after three taps: three filled circles, the 4th `next`), `listen-restart` (no tap for four eights at the test's 120 BPM: ~16 s; the start-over line), `listen-skip` (press Reset three times: Skip on the bar; press it: drop 2 of …), `listen-reveal` (tap through two eights: coloured circles, the pad locked). Shoot on the counted copy with the 80 s click track (`scratchpad/try/try.db`, see the phase 1 ledger); all `ok`.
- [ ] **Step 4: Run** `nix develop -c npx vitest run src/lib/hearing 'src/routes/[dance]/songs/[id]/listen' src/lib/nav --maxWorkers=4` — PASS; `npx svelte-check --threshold error` clean; eslint/prettier on changed files.
- [ ] **Step 5: Commit** `feat(hearing): drops you can see, start over and skip`.

### Task 7: Result B and the replay

**Files:**
- Create: `src/lib/components/hearing/ResultB.svelte`, `src/lib/components/hearing/ListenStack.svelte`, `src/lib/components/hearing/ListenReplay.svelte`
- Delete: `src/lib/components/hearing/ListenResult.svelte`, `BeatStrip.svelte`
- Modify: the page; `scripts/shots/ext_hearing.py`; `docs/features.md`; `docs/layout.md`

**Interfaces:**
- Consumes: `FinishedDrop` (Task 6), `scoreDrop`/`roundScore`/`verdictOf` (Task 3), `stackDots`/`stackDepth`/`replayPlan`/`cuesBetween`/`stepBeat` (Task 4), `PatternRows`, `posName`.
- `ResultB.svelte` props `{ drops: FinishedDrop[]; kind: RoundKind; positions: number[]; beatS: number; title: string; onreplay: (i: number) => void; onagain: () => void; ondone: () => void }`: the band "Score N" + the line (`onBeat · restarts · findEach`; tap along: `onBeat` only); the three parts card (Timing / Restarts −n / Listening −n); `ListenStack` (spec 1b.6, below the circles, nothing outside the card); the verdict (`verdictOf` over every counted beat); the drop list `dropRow(n, section)` + `dropDetail` or `skipped`, a ▶ button on unskipped drops (drops only; tap-along parts have none).
- `ListenStack.svelte` props `{ positions: number[]; dots: StackDot[]; depth: number }`.
- `ListenReplay.svelte` props `{ player: PlayerHandle; audio: HTMLAudioElement; grid: Grid; plan: ReplayPlan; drop: FinishedDrop; positions: number[]; beatS: number; n: number; onback: () => void }`: seeks to `plan.from`, plays to `plan.to` (count off, voice 0); the band shows the live count big (`beatIndexAt`) and "The count is on"; `PatternRows` with the drop's beat states revealed as the playhead passes them, `head` at the current position, `marks` for taps passed; the ticks/knocks scheduled ~100 ms ahead on its own AudioContext from `cuesBetween`, each moved earlier by the reported sound delay plus the correction (`sound-delay.ts`), since `songTime()` is the time heard; controls 1×/0.75× (`audio.playbackRate`), ‹ › (`stepBeat`, pauses and seeks), ▶/❚❚; Back (band) → the result. The page creates the replay's player inside the ▶ tap (iOS), like Start.
- [ ] **Step 1: Implement** the three components, delete the old result, wire `result` ↔ `replay`.
- [ ] **Step 2: Scenes:** `listen-result` (after a round: Score, parts card, the stack below the circles, the verdict, drop rows with ▶), `listen-replay` (▶ on drop 1, paused at the start), `listen-result-tap` (tap along: parts listed, no ▶), `listen-setup-clave` (the clave card). Shoot at 390×844 in `en` and once in `sl`; all `ok`; look at each.
- [ ] **Step 3: Docs:** `docs/features.md`'s hearing paragraph gains 1b (one sentence each: pattern, start over/Skip, colours after, result B with the score, replay, clave card); `docs/layout.md` lists the new modules.
- [ ] **Step 4: Run** `nix develop -c npx vitest run src/lib/hearing src/lib/i18n src/lib/components/ui 'src/routes/[dance]/songs/[id]/listen' --maxWorkers=4` — PASS; svelte-check clean; eslint/prettier on changed files.
- [ ] **Step 5: Commit** `feat(hearing): result B with the score, and the replay`.
- [ ] **Step 6:** Full `npm run check` (MemoryMax build if killed); one fresh review of the branch (Review Focus above); fix; merge master in; full check again; merge into master; `./scripts/deploy.sh --skip-build`; report the "live now" lines.
