# Hearing drills, phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Can you find the 1?" on a counted song's page opens a listening player: Tap along or
Dropped in, any target, a one-time tap delay check, and a result. Nothing is saved.

**Architecture:** Pure judging in `src/lib/hearing/` (targets, tap matching, drops, tap delay),
specs beside it. A new page `/[dance]/songs/[id]/listen` runs the existing engine
(`createPlayer` from `src/lib/scheduler/attach.ts`) with the count off, and swaps three views:
setup, running, result. The song page gets one card.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind classes via `src/lib/components/ui/styles.ts`, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-hearing-drills-design.md` (phase 1 only).

## Global Constraints

- Only songs a person counted: `anchors_json` parses to a non-empty list. Otherwise the listen page 404s and the card points to the count.
- Words through `t()`, in `en` and `sl` (vikanje, `slCount`, decimal comma); digits, "2-3"/"3-2" untranslated.
- Colours only from the builders in `styles.ts` (`swap()` in a `.ts`), never appended `text-*`.
- Times are arguments in `src/lib/hearing` (no `Date.now()`, no `performance.now()` inside it).
- Every storage access wrapped in try/catch (private mode).
- No new APK, no migration, nothing written to the server.
- Safe area via `--safe-*`, never `env()`.
- Building: after each task only its specs (`npx vitest run <files> --maxWorkers=4`) plus `npx eslint` and `npx prettier --check` on changed files, inside `nix develop`. Full `npm run check` once at the end.

## Review Focus

1. A song with sections that are count-offs (an intro): no expected taps there, and a tap there is not "missed" nor graded. Test in Task 2.
2. A round stopped after a few seconds: the result counts only what was played (expected taps up to the stop). Test in Task 2.
3. Taps far from anything (a double tap, a tap in a pause): extras, never matched twice to one expected tap. Test in Task 2.
4. Dropped in on a short song (fewer beats than 10 drops need): fewer drops, never the same spot twice, never a drop in a count-off. Test in Task 3.
5. A tap delay check with wild taps: "uneven", nothing stored. Test in Task 4.

---

### Task 1: Targets

**Files:**
- Create: `src/lib/hearing/targets.ts`, `src/lib/hearing/targets.spec.ts`

**Interfaces:**
- Consumes: `CLAVE_POSITIONS` (`src/lib/scheduler/scheduler.ts`), `ClavePattern` (`$lib/labels`), `Dance` (`$lib/dances/dances`).
- Produces:
  - `type TargetId = 'every' | 'one' | 'ones' | 'odd' | 'fourEight' | 'clave'`
  - `const TARGET_IDS: readonly TargetId[]`
  - `targetPositions(id: TargetId, clave: ClavePattern | null): number[]`
  - `targetsFor(dance: Pick<Dance, 'clave'>): TargetId[]`
  - `isTargetId(v: unknown): v is TargetId`

- [ ] **Step 1: Write the failing tests** — `targetPositions('every', null)` → `[1,2,3,4,5,6,7,8]`; `'one'` → `[1]`; `'ones'` → `[1,5]`; `'odd'` → `[1,3,5,7]`; `'fourEight'` → `[4,8]`; `'clave','3-2'` → `[1,2.5,4,6,7]`; `'clave', null` → the 2-3 positions `[2,3,5,6.5,8]`. `targetsFor({clave:true})` ends with `'clave'`; `targetsFor({clave:false})` has no `'clave'` and starts `['one','every']`. Order for both: `one, every, ones, odd, fourEight` (+ `clave`).
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/targets.spec.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** in `targets.ts`, with a header comment: a target is positions in the eight, like the voice's `COUNT_POSITIONS`; a new target is one entry.
- [ ] **Step 4: Run** the same — PASS.
- [ ] **Step 5: Commit** `feat(hearing): targets`.

### Task 2: Judging taps (Tap along)

**Files:**
- Create: `src/lib/hearing/judge.ts`, `src/lib/hearing/judge.spec.ts`

**Interfaces:**
- Consumes: `timeline`, `timeAt` (`scheduler.ts`), `nearestBeat` (`$lib/beatgrid/beatgrid`), `isQuiet`, `QuietRange` (`$lib/scheduler/quiet`), `Placed` (`$lib/songs/sections`).
- Produces:
  ```ts
  export interface Grid { beats: number[]; counts: number[] }
  export interface Expected { at: number; eight: number; pos: number }
  export const SPOT_ON_S = 0.06;
  export function windowS(beatS: number): number;          // min(0.15, 0.45 * beatS)
  export function expectedTaps(grid: Grid, positions: number[], from: number, to: number, quiet: readonly QuietRange[]): Expected[];
  export type Mark = 'spot' | 'close' | 'missed';
  export interface Match { expected: Expected; tap: number | null; offset: number | null; mark: Mark }
  export interface Extra { at: number; eight: number; count: number; offset: number }
  export function matchTaps(grid: Grid, expected: Expected[], taps: number[]): { matches: Match[]; extras: Extra[] };
  export interface EightRow { eight: number; matches: Match[]; extras: Extra[]; otherCount: number | null }
  export type Verdict = 'on' | 'late' | 'early' | 'other' | 'missed';
  export interface SectionLine { name: string; from: number; verdict: Verdict; meanMs: number | null; otherCount: number | null }
  export interface TapAlongResult { hit: number; of: number; meanMs: number | null; rows: EightRow[]; sections: SectionLine[] }
  export function judgeTapAlong(input: { grid: Grid; positions: number[]; from: number; to: number; quiet: readonly QuietRange[]; sections: Placed[]; taps: number[] }): TapAlongResult;
  ```
- Rules (from the spec, "How a tap is judged"):
  - `expectedTaps`: every position of every eight whose time `t` (`timeAt`) has `from <= t < to` and is not quiet. Beats before the first 1 have eight -1: none.
  - `matchTaps`: sort taps; for each expected in time order, take the nearest unused tap with `|tap - at| <= windowS(local beat length)`; `offset = tap - at` (seconds, + = late); mark `spot` if `|offset| <= SPOT_ON_S`, `close` otherwise, `missed` without a tap. Every unused tap is an `Extra` with `count` = `counts[nearestBeat(beats, tap)]`, `offset` = tap − that beat, `eight` from the timeline.
  - `otherCount` of an eight: when it has no `spot`/`close` match and its extras' most common count `c` (not in `positions`) appears at least `max(1, ceil(expectedInEight / 2))` times → `c`, else null.
  - Sections: group rows by the placed section whose span holds the eight's first beat (no sections → one line, name `''`). Verdict: most rows `otherCount` → `'other'` (with that count); else mean offset of hits: none → `'missed'`; `|mean| <= 60 ms` → `'on'`; else `'late'`/`'early'`.
  - `hit` = spot + close; `of` = expected count; `meanMs` = mean hit offset in ms rounded, null with no hits.
- [ ] **Step 1: Write the failing tests** on a synthetic grid (120 BPM: beats every 0.5 s from 0, counts 1..8 repeating; build with a helper in the spec):
  - `expectedTaps(grid, [1], 0, 8, [])` → at `[0, 4]`, eights `[0, 1]`.
  - quiet `[{from:0,to:4}]` → only `[4]` (Review Focus 1).
  - `windowS(0.5)` → `0.15`; `windowS(0.24)` → `0.108` (±1e-9).
  - taps `[0.03, 4.1]` on target `[1]` → marks `['spot','close']`, offsets `[0.03, 0.1]`.
  - taps `[0.02, 0.05]` → one match (0.02), one extra (Review Focus 3).
  - taps on the 5 every eight (`[2, 6]`) for target `[1]`, `from 0 to 8` → both rows `otherCount: 5`, section verdict `'other'`, `hit 0`.
  - `to = 2` (stopped early): `of` is 1 (Review Focus 2).
  - a tap at 3.0 with nothing near: extra, count 7.
  - verdict `'late'` when hits average +80 ms; `'on'` at +40 ms.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/judge.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the interfaces above in `judge.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): judge taps against the song's count`.

### Task 3: Dropped in

**Files:**
- Create: `src/lib/hearing/drops.ts`, `src/lib/hearing/drops.spec.ts`

**Interfaces:**
- Consumes: Task 2's `Grid`, `expectedTaps`, `windowS`; `nearestBeat`; `QuietRange`.
- Produces:
  ```ts
  export const DROPS = 10;
  export function dropStarts(grid: Grid, quiet: readonly QuietRange[], opts: { count: number; from: number; rand: () => number }): number[];
  export interface DropAnswer { start: number; tap: number | null; hit: boolean; offset: number | null; count: number | null; listened: number | null }
  export function judgeDrop(grid: Grid, positions: number[], start: number, tap: number | null): DropAnswer;
  export interface DropsResult { hit: number; of: number; meanMs: number | null; meanListened: number | null; drops: DropAnswer[] }
  export function judgeDrops(drops: DropAnswer[]): DropsResult;
  ```
- Rules: a start is a beat time `>= from` (the music start), in an eight >= 0, not quiet, with at least 64 more beats after it; starts are distinct beats at least 16 beats apart, picked with `rand`; fewer when the song has room for fewer (never repeats). `judgeDrop`: `count` = count of the beat nearest the tap; the nearest expected target time to the tap (`expectedTaps` over `[start, tap + 2]`, no quiet) gives `offset`; `hit` when `|offset| <= windowS(beat length)`; `listened = tap - start`. No tap → `hit false`, the rest null.
- [ ] **Step 1: Write the failing tests** (the Task 2 grid, 400 beats):
  - `dropStarts(..., {count: 10, from: 0, rand: seeded})` → 10 distinct beat times, sorted by pick order irrelevant, each `<= beats[400-64]`, pairwise ≥ 8 s apart (16 beats at 0.5 s).
  - a 100-beat grid → fewer than 10, no repeats (Review Focus 4).
  - quiet `[{from:0,to:50}]` → none below 50.
  - `judgeDrop(grid,[1],10,12.05)` → `hit true`, `offset 0.05`, `count 1`, `listened 2.05`.
  - `judgeDrop(grid,[1],10,14.0)` (on a 5) → `hit false`, `count 5`.
  - `judgeDrops` of 3 drops (2 hits at +0.04/+0.06, 1 null) → `hit 2, of 3, meanMs 50`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/drops.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): dropped-in rounds`.

### Task 4: The tap delay

**Files:**
- Create: `src/lib/hearing/tap-delay.ts`, `src/lib/hearing/tap-delay.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CHECK_TAPS = 16;
  export const CHECK_BPM = 100;
  export function tapDelayFrom(offsetsMs: number[]): { ms: number; uneven: boolean } | null;
  export function tapSongTime(songNow: number, lagMs: number, tapDelayMs: number, rate: number): number;
  export function loadTapDelay(): number | null;   // null = never checked
  export function saveTapDelay(ms: number): void;
  ```
- Rules: fewer than 12 offsets → null. Take the last 12, their median `m`; keep those within ±150 ms of `m`; `uneven` when fewer than 9 kept or the kept spread (max − min) is over 160 ms. `ms` = median of the kept, rounded to 5, clamped 0..300. `tapSongTime` = `songNow - ((lagMs + tapDelayMs) / 1000) * rate`. Storage key `'hearing.tapDelayMs'`, every access in try/catch; a stored value outside 0..300 or not a number reads as null.
- [ ] **Step 1: Write the failing tests:** 12 offsets around 70 (60..80) → `{ms: 70, uneven: false}`; 11 offsets → null; 16 offsets where the first 4 are 400 → uses the last 12; wild offsets (−200..+300 spread) → `uneven: true` (Review Focus 5); 12 offsets of −30 → `ms: 0`; `tapSongTime(10, 20, 70, 1)` → `9.91`; with `localStorage` stubbed to throw, `loadTapDelay()` → null and `saveTapDelay(70)` does not throw.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/hearing/tap-delay.spec.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(hearing): the tap delay`.

### Task 5: Words and the ear icon

**Files:**
- Create: `src/lib/i18n/en/hearing.ts`, `src/lib/i18n/sl/hearing.ts`
- Modify: `src/lib/i18n/en/index.ts`, `src/lib/i18n/sl/index.ts` (register `hearing`), `src/lib/icons/icons.ts` (add `ear`: lucide's two paths `M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0` and `M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4`)

**Interfaces:**
- Produces `t().hearing` with at least: `card.title` ("Can you find the 1?"), `card.sub` ("Tap along or get dropped in mid-song"), `card.try` ("Try it"), `card.countFirst` ("Set the count first to try this"), `kinds.tapAlong` ("Tap along"), `kinds.dropped` ("Dropped in"), `kindSub.tapAlong`, `kindSub.dropped`, `targets.{one,every,ones,odd,fourEight,clave}` ("The 1", "Every beat", "1 · 5", "Downbeats 1 3 5 7", "4 · 8", "The clave"), `wholeSong`, `section`, `start`, `pad.tapOn(target)` ("Tap on the 1"), `pad.tapNext(target)` ("Tap the next 1"), `pad.anywhere`, `stage.hidden` ("The count is hidden until the end"), `stage.drop(n, of)` ("Drop 4 of 10"), `stage.listen` ("Listen, then tap"), `reveal.hit(ms)`, `reveal.other(count)` ("That was the 5"), `reveal.none`, `result.title`, `result.score(hit, of, target)` ("7 of 10 on the 1"), `result.late(ms)`/`early(ms)`/`onTime`, `result.listened(s)`, `result.verdict.{on,late,early,other,missed}`, `result.drop(n)`, `again`, `done`, `check.title` ("Your tap delay"), `check.intro`, `check.tapWith` ("Tap with each count"), `check.progress(n, of)`, `check.result(ms)` ("You tap 70 ms after you hear it"), `check.uneven` ("Your taps were uneven. Try again."), `check.save`, `check.again`, `check.skip` ("Skip for now"), `check.row` ("Check my tap delay"), `check.rowValue(ms|null)`, `stop`, `notCounted` (the 404's refusal, also added to `refusals`), `pageTitle(dance)`.
- Slovenian: vikanje, `slCount` for counts with nouns, decimal comma for seconds, » « quotes. sl words: "Ali najdete ena?", "Poskusite", "Tapkajte zraven", "Spuščeni sredi pesmi", "Ena", "Vsak udarec", "1 · 5", "Poudarki 1 3 5 7", "4 · 8", "Klava", "Vaša zakasnitev tapa"… (the builder writes the rest in the same register; the glossary is in `sl/index.ts`).
- [ ] **Step 1:** Write both catalogs and register them; add the icon.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/i18n` — PASS (the catalog type keeps sl complete).
- [ ] **Step 3: Commit** `feat(hearing): words and the ear icon`.

### Task 6: The listening page

**Files:**
- Create: `src/routes/[dance]/songs/[id]/listen/+page.server.ts`, `+page.svelte`, `src/lib/components/hearing/ListenSetup.svelte`, `ListenRun.svelte`, `ListenResult.svelte`, `TapCheck.svelte`, `BeatStrip.svelte`, `src/routes/[dance]/songs/[id]/listen/listen.spec.ts`
- Modify: `src/lib/offline/routes.ts` only if its spec demands the new page be listed (it is a device page: its load reads only the song).

**Interfaces:**
- Consumes: Tasks 1–5; `requireSongAccess`, `songGrid`, `musicStart`, `parseSections`, `placeSections`, `quietRanges`, `createPlayer`, `loadDelayCorrection`, `playFrom`, `BottomBar`, `RUN_STOP`, `button`, `Icon`, `BandButton`, `goBack`/`backFor`.
- Load returns `{ dance, song: { id, title, audioFile }, grid: SongGrid, sections: Placed[] }`; a song not `ready`, without audio, or with empty anchors → `error(404, t().refusals.notCounted)`.
- The page holds `view: 'setup' | 'check' | 'run' | 'result'`. Setup → Start: if `loadTapDelay() === null` go to `check` first (Skip stores nothing and runs with 0). `run` builds `createPlayer({ audio, grid, toggles: { count: 'off', clave: null }, quiet, voiceVolume: 0, delayCorrectionMs: loadDelayCorrection(), onStep: () => {}, onEnd })` inside the Start tap (no await before `start()`, as `/[dance]/player` does). Tap along: seek to the section's start (or `playFrom(0, startS, duration)`), stop at the section's end (rAF watch on `songTime()`). Dropped in: `dropStarts` with `Math.random`, `seek(start)`; the first tap answers; for one eight after it the stage shows the live count (count of `beatIndexAt(beats, songTime())`) and the drop's reveal line; then the next drop; after `DROPS` drops (or fewer) the result.
- A tap: `pointerdown` on the pad; `lagMs = performance.now() - e.timeStamp`; time = `tapSongTime(player.songTime(), lagMs, tapDelay, audio.playbackRate)`.
- Stop → the result of what was played (`to` = the stop's song time).
- `TapCheck`: a count-only `createPlayer` on `syntheticGrid(CHECK_BPM, 40)` with `count: 'all'`; each tap's offset to the nearest beat (ms) after the first 2 beats; at `CHECK_TAPS` taps, `tapDelayFrom`; show `check.result` with Save / Again, or `check.uneven` with Again; Skip.
- Look: copy `Running.svelte`'s column (band stage + `-mt-7 rounded-t-[28px] bg-ground` sheet + `BottomBar` with `RUN_STOP`); stage = title, subline, a big dash/?/count, the section's name; sheet = the tap pad (a full-width button, ~170 px, `bg-surface rounded-[22px]`, press ring on `pointerdown`). Result: words on top (`result.score`, late/early, per section lines or per drop lines) and `BeatStrip` (SVG, one row per eight, counts 1–8 across, a dot per tap: done colour spot, warn close, danger other count).
- [ ] **Step 1: Write the failing load test** in `listen.spec.ts` (mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does): a counted ready song → data with its grid; empty anchors → 404; another dance's song → 404.
- [ ] **Step 2: Run** `nix develop -c npx vitest run 'src/routes/[dance]/songs/[id]/listen'` — FAIL.
- [ ] **Step 3: Implement** the load, then the page and components.
- [ ] **Step 4: Run** the spec, `npx vitest run src/lib/offline src/lib/i18n` (route classification and no bare English) — PASS. `npx svelte-check` on the new files has no errors.
- [ ] **Step 5: Try it** with `npm run dev` on the seeded db (a counted song) at 390×844: setup, a tap along of a few taps, Stop, the result; a dropped-in round; the tap check.
- [ ] **Step 6: Commit** `feat(hearing): the listening player`.

### Task 7: The card on the song page, docs, check, deploy

**Files:**
- Modify: `src/routes/[dance]/songs/[id]/+page.server.ts` (return `counted: anchors.length > 0`), `+page.svelte` (the card after `CountCard`'s block, before the sample: `GROUP` card, ear icon, `card.title`/`card.sub`, `Try it` → `/{dance}/songs/{id}/listen`; uncounted: `card.countFirst`, no link), `docs/features.md` (an entry pointing at the spec), `docs/layout.md` (`src/lib/hearing/`, `components/hearing/`, the route).
- [ ] **Step 1:** Implement the card; shoot the song page at 390×844 with the rig (counted and uncounted).
- [ ] **Step 2:** `npx eslint` / `npx prettier --check` on the changed files; commit `feat(hearing): Can you find the 1? on the song page`.
- [ ] **Step 3:** Full `npm run check` (MemoryMax build if it is killed). Fix, commit.
- [ ] **Step 4:** One review of the whole branch; fix what it finds.
- [ ] **Step 5:** Merge master in, `npm run check` again, merge into master, backup, `./scripts/deploy.sh` (asks the user), report the "live now" lines.
