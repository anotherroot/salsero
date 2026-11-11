# Hearing drills, phase 1c — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drop is two full eights from the first tap, judged in the person's own count
(shift found from the first tap, partial credit by how far off), ending right after its last
beat; blue for "on a beat, wrong count"; where each tap fell (look A) at a drop's end and in
the replay; Count on result B's score card; the music fades between spots; faded circles
before the first tap read as faded.

**Architecture:** `judgeDropPattern` becomes "judge in the person's frame": the first tap's
nearest beat is the pattern's first position; the shift to the music's count is found once;
beats carry both the music's position (for drawing) and the person's (for the "you N" label).
Scoring gains a count factor. The components draw the judged drop in the music's eights (2–3
rows) with tap marks. No migration; nothing saved.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-hearing-drills-design.md`, "Phase 1c" (with 1b).
Boards: https://claude.ai/artifact/C8r1VgMBNzh28TTLLRRBNZ (count off),
https://claude.ai/artifact/Q2hRhgSPzEYLM6vpL72uvP (look A).

## Global Constraints

- As phase 1b's plan: words in `en` and `sl` through `t()`; colours via token classes / builders; no clocks in `src/lib/hearing`; reduced motion respected; guarded `onDestroy`.
- Ladder (spec 1c.3): shift 0 → 1, 4 → 0.5, 2 or 6 → 0.25, odd → 0.1. The reversed clave is shift 4.
- Building: per task specs + eslint + prettier; full check before review and after merging master.

## Review Focus

1. A first tap far from every beat (> the tap window): its nearest beat still sets the shift; the rest judged normally. Test in Task 1.
2. A drop whose 16 beats run past the song's end: beats beyond the grid are left out, `of` counts only those that exist. Test in Task 1.
3. A clave 2-3 tapped exactly as 3-2 in time: shift 4, every beat hit, keeps 50 %. Test in Tasks 1 and 2.
4. A person who forgets one tap mid-drop: that circle missed, the following taps still right (no cascade). Test in Task 1.
5. Fading the volume where `audio.volume` is read-only (iOS): nothing breaks, the cut stays. Covered by guarding the setter (Task 4).

---

### Task 1: Judging in the person's count

**Files:** Modify `src/lib/hearing/drops.ts`, `drops.spec.ts`; `src/lib/hearing/spot.ts` (window type only), `replay.ts` (uses `beats[].row/pos`), their specs where shapes change.

**Interfaces:**
- `export function shiftOf(musicCount: number, firstPos: number): number` — `((musicCount − floor(firstPos)) mod 8 + 8) mod 8`.
- `export function countKeep(shift: number): number` — the ladder.
- `DropWindow` becomes `{ eight: number; from: number; end: number; startIndex: number; shift: number }`: `startIndex` = the beat index of the person's count 1 (`nearestBeat(first) − (floor(positions[0]) − 1)`), `from` = the first tap's beat time, `end` = the time of the last expected beat (the drop ends at `end + winS`), `eight` = the music eight of the first expected beat.
- `export function dropWindow(grid: Grid, first: number, positions: number[]): DropWindow` (positions now needed).
- `DropBeat` gains `yours: number` (the person's position) and `row` becomes `0 | 1 | 2` (the music eight from `eight`); `pos` is the music position (for drawing).
- `DropAnswer` gains `shift: number` (0 without a tap).
- Expected beats: for person-eight `k` ∈ {0,1} and each `p` of `positions`, the time at beat index `startIndex + 8k + floor(p) − 1` plus the fraction of `p` between that beat and the next; beats past the grid are left out (Review Focus 2). No `skip` beats any more (every expected beat is from the first tap on); `BeatState` keeps `'skip'` only for drawing positions outside the drop.
- [ ] **Step 1: Tests:** `shiftOf(5, 1)` 4, `(1, 1)` 0, `(3, 1)` 2, `(2, 1)` 1, `(6, 2)` 4 (clave 2-3 first hit on the 6); `countKeep` 0→1, 4→0.5, 2→0.25, 6→0.25, 1/3/5/7→0.1; every beat from the music's 5 (taps on beats 4…19 of a 120 BPM grid): `shift` 4, `of` 16, `hits` 16, beats span rows 0–2, `beats[0]` `{ pos: 5, yours: 1 }`; clave 2-3 tapped as 3-2 in time → shift 4, hits 10 of 10 (Review Focus 3); a missing 6th tap → that beat `miss`, the rest `spot` (Review Focus 4); a first tap 0.2 s off every beat → shift from its nearest beat (Review Focus 1); 16 beats past a 22-beat grid → `of` < 16 (Review Focus 2); `dropWindow` `end` = the last expected beat's time.
- [ ] **Step 2:** run `npx vitest run src/lib/hearing/drops.spec.ts` — FAIL.
- [ ] **Step 3:** implement; update `spot.ts` callers' types, `replay.ts` (`from` = two beats before the first expected beat; `to` = `end` + 0.5) and their specs.
- [ ] **Step 4:** `npx vitest run src/lib/hearing` — PASS.
- [ ] **Step 5:** commit `feat(hearing): judge a drop in the person's own count`.

### Task 2: The count in the score and the verdict

**Files:** `src/lib/hearing/score.ts`, `verdict.ts`, specs.
- `scoreDrop` input gains `shift: number`; `DropScore` gains `countLoss`; `score = timing × ck × rk × lk`, `countLoss = timing × (1 − ck)`, `restartsLoss = timing × ck × (1 − rk)`, `listenLoss = timing × ck × rk × (1 − lk)`; `roundScore` averages `countLoss` too.
- `export function commonShift(shifts: number[]): { shift: number; drops: number } | null` — the most frequent non-zero shift, null when none.
- [ ] Tests: a perfect drop 4 off scores 50 with `countLoss` 50; 2 off → 25; 1 off → 10; parts add up; skipped zeros; `commonShift([0,4,4,2,0])` → `{ shift: 4, drops: 2 }`, `([0,0])` → null. Run (FAIL), implement, run (PASS), commit `feat(hearing): the count in the score`.

### Task 3: Words, circles, marks

**Files:** both `hearing.ts` catalogs; `src/lib/components/hearing/PatternRows.svelte`; `src/lib/hearing/round.ts` (`CircleState` gains `'shifted'`).
- Words: `countOff(n)` ("4 counts off" / "1 count off"), `keeps(pct)` ("keeps 50 %"), `rightCount` ("Right count"), `shiftTag(n)` ("4 off"), `you(n)` ("you 1"), `verdictShift(yours, music)` ("Your 1 was the music's 5"), tips `tip4` (the bass and the piano land together on the 1), `tip1` (odd and even swapped: try 1 3 5 7), `score.count` ("Count"), `score.offCount(n)` ("4 drops off the count"), `score.verdict.often(yours, music)` ("Your 1 was often the 5"), sl in the same register (vikanje; "zamik za 4", "obdrži 50 %", "vi 1", "Vaša 1 je bila glasbena 5").
- `PatternRows`: per-row `positions` (a drop's positions in the music's count can differ per drop: shifted); props `rows: { positions: number[]; states: Record<number, CircleState>; over?: Record<number, string> }[]`; `'shifted'` drawn blue (`fill-easy`/`stroke-easy` tokens); `'skip'` drawn at ~35 % opacity (1c.8); `marks` gain `tie?: number` (the music position of the circle the tap counted for): a thin line from the mark to that circle in the circle's colour (look A).
- [ ] `npx vitest run src/lib/i18n src/lib/hearing` PASS; svelte-check clean; commit `feat(hearing): blue for the wrong count, and tap marks`.

### Task 4: DropRun, the fade, result B, replay

**Files:** `DropRun.svelte`, `ResultB.svelte`, `ListenReplay.svelte`, `TapAlongRun.svelte` (PatternRows' new props only).
- DropRun: while tapping, the rows are the person's two eights (the target's positions, filled in order, as now); at the end the music's eights (2–3 rows) from `answer.beats`: state `spot`/`close` when `shift` is 0, `shifted` when not, `miss`; `over` = "you N" when shifted; marks (look A) for every tap with `tie` to its counted beat; the band: hits, then `countOff`/`rightCount` with the `keeps` chip; the stage line: the verdict for a shifted drop. The drop ends at `window.end + winS` (1c.2). `FinishedDrop` gets `shift` (via `answer.shift`).
- The fade (1c.7): `fadeTo(audio, 0 | 1, 400 ms)` in a small client helper `src/lib/components/hearing/fade.ts` (rAF ramp of `audio.volume`, each set in try/catch; resolves at the end); `next()` and `restart()` fade out before `pause()`; `play()` sets volume 0, resumes, fades in. Reduced motion: instant.
- ResultB: the parts card gets Count (4 columns); the line adds `offCount`; a shifted drop row shows `shiftTag`; the verdict: `commonShift` first (`often`), else as now.
- ListenReplay: the same music-eight rows and marks (marks appear as the playhead passes them).
- TapAlongRun keeps nearest-beat judging (ruling: 1c.3 applies to Dropped in now; tap-along later).
- [ ] Scenes: `listen-reveal` (marks and ties), `listen-result` (Count part), `listen-replay`; all `ok`; look at them; svelte-check, eslint, related specs PASS; commit `feat(hearing): your count on screen, tap marks, and the fade`.
- [ ] Full check, review, fix, merge, deploy, report "live now".
