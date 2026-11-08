# One player, with the details in it — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One practice player (the full page), which logs nothing, where a run's band fills the phone and the exercise's details (and a routine figure's) open from rows under it.

**Architecture:** The exercise page's Practise with card becomes a link into `/[dance]/player`. The player drops its Save screen. The server loads read-only details (`RunDetails`) for the exercise and for a routine's figures. `Running.svelte` becomes a band that fills the screen plus a card of rows (Routine, About, Voice); each row opens one shared full-screen layer (`RunLayer`). The routine's existing full-screen list moves into that layer and gains ⓘ and Still's tap.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Drizzle on SQLite, vitest. Commands run in the nix shell (`nix develop -c …`).

**Spec:** `docs/superpowers/specs/2026-11-08-one-player-design.md`. Read it first; this plan argues from it.

## Global Constraints

- This branch builds on master **after** slot 3's `exercise-flow` (plans 2 and 3) lands there. Names from that branch used below (`playerFrom(run)` in `src/lib/exercises/run.ts`, `pageClock({ idle })` with `start()`/`restart()`, the exercise page's `Practice` components and `playerFrom` prop, `DoneSheet`'s run field) are as slot 3 described them on 2026-11-08; re-read them after the merge and follow what landed.
- Every word on screen goes through the i18n catalog (`t()`, `src/lib/i18n/en/*.ts` and `src/lib/i18n/sl/*.ts`, same keys). The English below is the `en` value; `sl` uses the catalog's glossary (a routine is "Kombinacija", voice "Glas"; a routine's figure is a "različica").
- **Update 2026-11-08:** slot 3 merges plan 2 alone first; build on that. Plan 3 lands later and changes only the player's Back (`practiceBack` gets `run`). Until it lands: the card takes the exercise page's own `playerFrom` string (plan 2 passes `"from=exercise"`), not `playerFrom(run)`; the clock carry builds on plan 2's `pageClock()` (no `idle`, no `start()`). Plan 3's merge adapts both; keep the carry a thin wrapper so that is easy.
- `npm run check` must pass at the end of every task. Machine memory is tight: run vitest with `--maxWorkers=2`, one stage at a time (`npm run lint`, `npm run check:types`, `npx vitest run --maxWorkers=2 <files>`), and the full check only at the end of a task.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- A colour on a built control is the builder's (`iconButton`, `button`, `swap()` in a `.ts`); `class-rules.spec.ts` enforces it. A card that clips uses `GROUP` or `CLIP`.
- Read the safe area through `--safe-*`, never `env()`.
- A layer that Back closes uses `sheetStack` (`$lib/sheets/history.svelte`): `open({ tryLeave, close })`, `requestClose(key)`, `closedByOwner(key)` — as the routine layer in `Running.svelte` does today.
- A group's figure, drill or section is read through `access.ts` (`figureAccess`, `sectionsFor`'s `visible`), never by id alone.
- `sets.player_json` is never dropped (no table rebuilds, CLAUDE.md); old sets keep reading it.
- Never commit a database or a screenshot: they hold personal data.
- Raise `PAGE_EPOCH` (`src/lib/page-epoch.ts`) in Task 1 (the player's `save` action goes) and in Task 2 (the Done form's run field goes), unless both land in one commit.

## Review Focus

1. **A drill with only a title**: no About row, no About on Setup, the band takes the room. Pinned by `hasDetails` tests (Task 4) and the server test (Task 5).
2. **A routine's figure the person doesn't reach** (a group draft's version): its details never reach the client. Pinned in Task 5.
3. **Back while a layer is open** closes the layer, not the run; Back with two layers open (list → figure) closes only the figure. Pinned by a shot scene in Task 8 and the `sheetStack` entries.
4. **Stop and the song's end**: no Save screen; Setup returns with focus on Play. The band's back stops and leaves. Pinned in Task 1.
5. **▶ on the card when the browser won't start audio**: it lands on Setup, with no error and no second player. Pinned in Task 2 (the `play` param is read once and dropped).

---

### Task 0: Start from master with slot 3's work

**Files:** none new.

- [ ] **Step 1:** Confirm `git log master --oneline | grep -i "exercise-flow"` shows plans 2 and 3 merged. If not, stop and report: this plan needs them.
- [ ] **Step 2:** `git merge master` into `practice-player`. Expect conflicts in `PracticePanel.svelte`, the figure and drill `Log.svelte` (gone on master), `practice.ts` and specs from this branch's call removal. Keep master's structure, then re-apply this branch's removals (no calls, no `cue` prop, no `callEvery`).
- [ ] **Step 3:** `npm run check`. Expected: pass.
- [ ] **Step 4:** Commit the merge.

### Task 1: The player logs nothing

**Files:**
- Modify: `src/routes/[dance]/player/+page.svelte`, `src/routes/[dance]/player/+page.server.ts`, `src/lib/player/view.ts`, `src/lib/player/view.spec.ts`, `src/lib/page-epoch.ts`
- Delete: `src/lib/components/player/SaveSetSheet.svelte`, `src/routes/[dance]/player/save.spec.ts`
- Test: `src/routes/[dance]/player/no-save.spec.ts`

**Interfaces:**
- Produces: the page's `mode` is `'setup' | 'running'` only. `finish(leave: boolean)` stops the player; `leave` → `goBack(data.back, { replace: true })`, else `mode = 'setup'` and `setup.focusPlay()` after `tick()`.

- [ ] **Step 1: Write the failing test** `no-save.spec.ts`: `import * as route from './+page.server'`; `expect('actions' in route ? Object.keys(route.actions ?? {}) : []).toEqual([])`.
- [ ] **Step 2:** Run `npx vitest run --maxWorkers=2 src/routes/[dance]/player/no-save.spec.ts`. Expected: FAIL (`['save']`).
- [ ] **Step 3:** Remove the `save` action and its imports. Remove from the load what only the Save sheet read: `schedule`, `today`, `exercises` (check `Setup` doesn't read them first). In the page, remove `SaveSetSheet`, `runJson`, `MAX_DANCED`, `dancedIds`, `finalElapsed`, `leaving`, `closeSave`, `saved`, `leaveRun`'s popstate wait (no sheet any more: `goBack` directly), `form`. Remove `runSummary` and `exerciseLine` from `view.ts` if nothing else imports them, with their tests. Keep `PlayerHandle.danced()` (attach.spec covers it).
- [ ] **Step 4:** Raise `PAGE_EPOCH` by one.
- [ ] **Step 5:** Run the spec and `npm run check`. Expected: PASS.
- [ ] **Step 6:** Update the design spec (`2026-09-22-salsa-app-design.md`, the Practice section and Known gaps) and `CLAUDE.md` where they say a run is logged as a set ("a finished run logged as a set" in the Live line becomes "a run that logs nothing; Done logs").
- [ ] **Step 7:** Commit `feat(player): the player logs nothing`.

### Task 2: The exercise page's card opens the player

**Files:**
- Create: `src/lib/components/exercises/PractiseCard.svelte`
- Modify: the figure and drill `Practice.svelte` under `src/lib/components/exercises/kinds/`, `src/lib/components/exercises/kinds/index.ts` (`PracticeProps`: drop `onrun`, `onactive`, `songs`, `takes` if only the panel used them), the exercise page `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (drop `run`, `playing`), `DoneSheet.svelte` and its spec (drop the run field), the Done action (drop `run`), `src/lib/player/view.ts`, `src/routes/[dance]/player/+page.svelte`, `src/lib/components/player/Setup.svelte`
- Delete: `src/lib/components/player/PracticePanel.svelte` (and drop it from `no-english.spec.ts`), `songGrid` stays (the page uses it)
- Test: `src/lib/player/view.spec.ts`

**Interfaces:**
- Produces: `exercisePlayerHref(dance: string, exerciseId: number, from: string, play: boolean): string` in `view.ts`; returns `/<dance>/player?exercise=<id>&<from>` plus `&play=1` when `play`.
- Produces: `Setup` exports `playNow(): void` — calls its `onplay` with the settings shown, exactly as a Play tap does.
- Consumes: `playerFrom(run)` (slot 3) for `from`; `practiceSummary`, `practiceOf` (`src/lib/exercises/practice.ts`).

- [ ] **Step 1: Write the failing tests**: `exercisePlayerHref('salsa', 7, 'from=exercise', false)` → `'/salsa/player?exercise=7&from=exercise'`; `exercisePlayerHref('salsa', 7, 'from=run&skip=3,5', true)` → `'/salsa/player?exercise=7&from=run&skip=3,5&play=1'`.
- [ ] **Step 2:** Run them. Expected: FAIL (not defined).
- [ ] **Step 3:** Implement `exercisePlayerHref`. Build `PractiseCard.svelte`: props `{ dance: Dance; exercise: ExerciseItem; from: string }`; the closed panel's look (label "Practise with", the `practiceSummary` line, the round ▶ `PLAY_ROUND`) as an `<a>` to `exercisePlayerHref(…, false)`, with the ▶ a second `<a>` to `…, true` (not nested: the card is a flex row of the two links). No dropdown.
- [ ] **Step 4:** The figure and drill `Practice.svelte` render `PractiseCard`. Remove the panel's run plumbing from the page, `DoneSheet` and the Done action.
- [ ] **Step 5:** In the player page, on mount: if `page.url.searchParams.get('play') === '1'`, `replaceState` the URL without `play`, then `setup.playNow()`. If start throws or the context stays suspended, Setup shows as it does after any failed Play (existing `startError` path); never retry.
- [ ] **Step 6:** Raise `PAGE_EPOCH` (unless done in this commit with Task 1). Run the specs and `npm run check`. Expected: PASS.
- [ ] **Step 7:** Update slot 3's spec (`2026-11-07-run-the-day-design.md`, "The practice panel and the full player") to say the card opens the player and Done carries no run.
- [ ] **Step 8:** Commit `feat(exercises): Practise with opens the player`.

### Task 3: The exercise page's time carries across the player trip

**Files:**
- Create: `src/lib/exercises/clock-trip.ts`, `src/lib/exercises/clock-trip.spec.ts`
- Modify: `src/lib/exercises/page-clock.svelte.ts`, `PractiseCard.svelte`, the exercise page

**Interfaces:**
- Produces (PURE, storage injected):
  - `type TripStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `leaveForPlayer(store: TripStore, exerciseId: number, watch: Stopwatch, now: number): void` — stores `{ watch, at: now }` under `trip:<exerciseId>`.
  - `backFromPlayer(store: TripStore, exerciseId: number, now: number): Stopwatch | null` — reads and removes it; null when missing, unparsable, or `at` older than `TRIP_MAX_MS = 6 * 3600_000`. The returned watch has the trip's time banked as running time (the page was "open" for the whole trip): `{ bankedMs: elapsedMs(watch, now), runningSince: null }`.
- Produces: `pageClock` accepts `{ idle, carried?: Stopwatch | null }`; a carried watch is its start.

- [ ] **Step 1: Write the failing tests**: leave then back within an hour returns banked `elapsedMs` of the stored watch at `now`; back twice returns null the second time; back after 7 h returns null; garbage in the store returns null; another exercise's id returns null.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The card calls `leaveForPlayer(sessionStorage, …)` on click (both links), with the page clock's watch; the exercise page passes `backFromPlayer(sessionStorage, id, Date.now())` (in try/catch: no storage → null) to `pageClock` on mount. `restart()` ignores the carry.
- [ ] **Step 4:** Run and `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(exercises): the page's time keeps counting through the player`.

### Task 4: The run's words and which rows show (PURE)

**Files:**
- Modify: `src/lib/player/view.ts`, `src/lib/player/view.spec.ts`, `src/lib/types.ts`, the `player` catalogs (en, sl)

**Interfaces:**
- Produces in `types.ts`:
  ```ts
  export interface RunClip { kind: 'section' | 'recording'; src: string; startMs: number; endMs: number | null; caption: string }
  export interface RunDetails {
  	heading: string;              // the exercise's name, or a figure's label ("Pa ti, pa mi · Basic")
  	facts: string[];              // a figure's timing, then its positions; [] for a drill
  	hasPositions: boolean;
  	notes: string | null;         // trimmed; '' becomes null
  	clips: RunClip[];             // linked sections, then the figure's own video recordings
  	links: { url: string; title: string | null }[];
  }
  ```
- Produces in `view.ts`:
  - `hasDetails(d: RunDetails | null): boolean` — true when notes, a clip, a link, or positions. Timing alone is not details (every figure has it).
  - `aboutPreview(d: RunDetails): string`
  - `voicePreview(count: CountPattern, volume: number): string`
  - `routinePreview(lit: number | null, total: number, view: RoutineView): string`
  - `runTitle(p: { exercise: string | null; routine: string | null; song: string | null }): string`
  - `runSubtitle(p: { kind: 'figure' | 'drill' | 'routine' | null; songInTitle: boolean; song: { title: string; bpm: number | null } | null; bpm: number | null; speed: Speed; clave: ClavePattern | null }, dance: Dance): string | undefined` (replaces today's)
  - `stageSize` goes (the band fills; see Task 6).

- [ ] **Step 1: Write the failing tests** (exact `en` strings):
  - `hasDetails(null)` false; title-only drill (`facts: [], notes: null, clips: [], links: [], hasPositions: false`) false; a figure with only `facts: ['1 → 1 · 8 counts']` false; notes `'x'` true; positions only true.
  - `aboutPreview`: notes only → the notes' first line, `'Do 1 to 3 repetitions of salsa step the switch to son then back to salsa and so on'`; notes + 1 section clip + 1 link → `'Notes · a lesson section · a link'`; 2 sections + 1 recording → `'2 lesson sections · a recording'`; positions only → `'Positions'`.
  - `voicePreview('salsa', 1)` → `'<the salsa chip label> · 100%'` (use the label `CountChips` shows); `voicePreview('off', 0.5)` → `'Off'`.
  - `routinePreview(4, 16, 'follow')` → `'5 of 16 · Follow'`; `routinePreview(null, 16, 'follow')` → `'1 of 16 · Follow'`; `routinePreview(4, 16, 'still')` → `'16 figures · Still'`.
  - `runTitle({ exercise: 'Warmup', routine: null, song: 'Suavemente' })` → `'Warmup'`; `({ exercise: null, routine: 'Learning pa ti', song: null })` → `'Learning pa ti'`; `({ exercise: null, routine: null, song: 'Suavemente' })` → `'Suavemente'`; all null → `'Count only'`.
  - `runSubtitle`: `{ kind: 'figure', songInTitle: false, song: null, bpm: 130, speed: 1, clave: '2-3' }` → `'Figure · 130 BPM · clave 2-3'`; `{ kind: 'drill', songInTitle: false, song: { title: 'Suavemente', bpm: 125 }, bpm: null, speed: 0.8, clave: null }` → `'Drill · Suavemente · 100 BPM · 0.8×'` (the song's BPM × speed, rounded); `{ kind: null, songInTitle: true, song: { title: 'Suavemente', bpm: 125 }, bpm: null, speed: 1, clave: null }` → `'125 BPM'`; bachata (no clave in the registry) drops the clave.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement, words in the `player` catalogs (en and sl).
- [ ] **Step 4:** Run, `npm run check`. Expected: PASS (fix callers of the old `runSubtitle`/`stageSize` in the same commit).
- [ ] **Step 5:** Commit `feat(player): the run's titles, rows and previews`.

### Task 5: Details from the server

**Files:**
- Create: `src/lib/server/run-details.ts`, `src/lib/server/run-details.spec.ts`
- Modify: `src/routes/[dance]/player/+page.server.ts`

**Interfaces:**
- Consumes: `RunDetails`, `RunClip` (Task 4); `sectionsFor`, `listLinks`, `figurePositions`, `figureAccess`, the graph's node timing (`figureById(graph, id)`: `start`, `length`) and its positions' names.
- Produces:
  - `figureDetails(db: Db, viewer: string, space: Space, graph: Graph, ids: number[], visible?: Visible): Record<number, RunDetails>` — only ids on `graph.figures` (the load already filtered it to what the viewer reaches) and with `figureAccess(…) !== null`. `facts[0]` is the timing words the routine page uses for a figure ("1 → 1 · 8 counts": start → start of the next, its length); `facts[1]`, when tagged, "Start → End" with the positions' names joined by " / ". Clips: `sectionsFor(db, { figureId }, visible, viewer)` (caption: a lesson's `"<title> · m:ss–m:ss"`, a recording's `"Recording · m:ss–m:ss"`), then the figure's `recordings` rows of kind `video` (`src: /recordings/<file>`, `startMs: 0`, `endMs: null`, caption "Recording"). Links: `listLinks(db, { figureId })`.
  - `exerciseDetails(db: Db, wall: Wall, exercise: typeof exercises.$inferSelect, graph: Graph, visible?: Visible): RunDetails | null` — a figure exercise: that figure's `figureDetails` entry with `heading` = the exercise's name. A drill (`custom`): its notes, `sectionsFor(db, { exerciseId })`, `listLinks(db, { exerciseId })`. An entry of a group drill (`added`, `drillId`): the group drill's, read through `drillAccess`. A routine or a lesson: null.
- The load returns `details: RunDetails | null` (null when `!hasDetails`) and `figureDetails: Record<number, RunDetails>` (only entries with `hasDetails`), and `routine.notes`.

- [ ] **Step 1: Write the failing tests** on `openDb(':memory:')` (fixtures as in `spot-links.spec.ts`): a drill with no notes, sections or links → `exerciseDetails` → null after `hasDetails`; a drill with notes and a link → notes and one link; a figure with a linked section → one clip with the lesson caption; a group figure the viewer doesn't reach (a draft's variation) passed in `ids` but not on the graph → absent from the result; a figure with a video recording and an audio one → only the video is a clip.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and wire into the load.
- [ ] **Step 4:** Run, `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(player): the exercise's and a routine's figures' details`.

### Task 6: The band fills, the rows, and one layer

**Files:**
- Create: `src/lib/components/player/RunLayer.svelte`, `src/lib/components/player/RunRows.svelte`, `src/lib/components/player/DetailsBody.svelte`, `src/lib/components/player/RunClip.svelte`
- Modify: `src/lib/components/player/Running.svelte`, `StageCount.svelte`, `src/routes/[dance]/player/+page.svelte`

**Interfaces:**
- `RunLayer.svelte` props: `{ label: string; title: string; player: PlayerHandle | null; beats: number[]; counts: number[]; paused: boolean; onclose: () => void; strip?: Snippet; children: Snippet }`. It owns its `sheetStack` entry (opened on mount, `closedByOwner` on destroy, ✕ and Escape → `requestClose`), the band strip (`BandButton` close with `focusKey`, the live digit by rAF when `player` is set, `title` and the time), and the content on the ground under it with room for the run bar. Phone: `fixed inset-0 z-[15]` as the routine layer is now. Desktop: it fills the 520 px column in place of the rows (`desk:` placement in that column), the stage untouched.
- `RunRows.svelte` props: `{ rows: { key: 'routine' | 'about' | 'voice'; title: string; preview: string; icon: IconName }[]; onopen: (key) => void }` — one `GROUP` card; a row is a button with a 40 px `bg-accent-soft` icon tile, 16 px bold title, 13 px muted one-line preview, a chevron pointing up (the Music "Count only" row's look).
- `DetailsBody.svelte` props: `{ details: RunDetails }`: the heading (display font, 22 px), facts as chips, notes with `LinkedText`, each clip as `RunClip`, links as rows (`target="_blank" rel="noopener"`). Draws only the parts that have something.
- `RunClip.svelte` props: `{ clip: RunClip }`: a bare `<video muted playsinline loop preload="metadata">` from `startMs`; on `timeupdate` past `endMs` it seeks back to `startMs`. It plays while on screen (IntersectionObserver) and pauses off it. A caption bar over its foot. No controls.
- `StageCount` gains `fill: boolean`: the stage takes its container's free space (`container-type: size` on the band's stage box; `--stage: min(100cqw - 32px, 100cqh)`), replacing the `size` prop.
- `Running` props: drop `title`'s "Practice" default and the small list; add `details: RunDetails | null`, `figureDetails: Record<number, RunDetails>`, `kind: 'figure' | 'drill' | 'routine' | null`, `routineNotes: string | null`.

- [ ] **Step 1:** Rebuild `Running`'s phone layout: the header (back, title, subtitle) and the stage take all the height above the sheet; the sheet holds the seek bar (with a song), then `RunRows`, then the run bar's room. Rows: Routine (with slots), About (`hasDetails(details)`; in a routine, Follow only, the lit figure's `figureDetails` entry, titled "About <figure label>"), Voice (always). Under the count in Follow, the lit figure's name and a smaller "Next: <figure>" (the next slot's figures joined " / ").
- [ ] **Step 2:** The Voice layer: `RunLayer` with `CountChips` (wrapped, no scroll) and the volume `Slider`, the same handlers as today's Voice card. The About layer: `RunLayer` with `DetailsBody`.
- [ ] **Step 3:** The Routine layer: today's full-screen list moved into `RunLayer`, its Follow / Still `Segmented` in the strip (`strip` snippet), `routineNotes` (when set) above the list. The small list window, its expand button and `slotRow` go.
- [ ] **Step 4:** Shots (`scripts/shots/ext_routine_run.py`, renamed `ext_one_player.py` if clearer): running a drill with About, a title-only drill, a figure exercise, the About layer, the Voice layer, a routine in Follow and in Still, the Routine layer. Shoot at 390x844 light and dark, and 1440x900 `--viewport`. Look at every one; the count must fill the band with no empty space below the rows.
- [ ] **Step 5:** `npm run check`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(player): the band fills, About and Voice open full screen`.

### Task 7: A figure's details from the routine list

**Files:**
- Modify: `src/lib/components/player/Running.svelte`, `src/lib/player/view.ts` (+ spec)

**Interfaces:**
- Produces: `slotDetails(figureIds: number[], details: Record<number, RunDetails>, labelOf: (id: number) => string): RunDetails[]` — one per figure id in order; a figure without an entry gives `{ heading: labelOf(id), facts: [], hasPositions: false, notes: null, clips: [], links: [] }`.

- [ ] **Step 1: Write the failing test**: a slot `[3, 9]` with details only for 9 → two entries, the first with only a heading.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement.
- [ ] **Step 4:** In the Routine layer: in Still a row is a button that opens a second `RunLayer` (its own `sheetStack` entry) with a `DetailsBody` per `slotDetails` entry; in Follow a row's tap still jumps, and an ⓘ button at its right end (`iconButton('ghost')`, `aria-label` "About <figure label>") opens the same. ✕ or Back returns to the list.
- [ ] **Step 5:** Shots: Still's tap, Follow's ⓘ, Back from the figure to the list. `npm run check`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(player): a routine figure's details from the list`.

### Task 8: Setup shows the name and About

**Files:**
- Modify: `src/lib/components/player/Setup.svelte`, `src/routes/[dance]/player/+page.svelte`

- [ ] **Step 1:** Setup's band title is `runTitle(…)` (not "Practice"). Above its settings, when `hasDetails(details)`, the About row (`RunRows` with one row) opens `RunLayer` with `player: null` (no live digit) and `DetailsBody`.
- [ ] **Step 2:** Shots: Setup of a drill with About, of a title-only drill, the layer open from Setup; Back with the layer open closes only the layer (Review Focus 3).
- [ ] **Step 3:** `npm run check`. Expected: PASS.
- [ ] **Step 4:** Commit `feat(player): Setup names the exercise and opens its details`.

### Task 9: Docs and the last pass

- [ ] **Step 1:** Mark the spec `2026-11-08-one-player-design.md` built, with a "Decided while building" list. Update the design spec's Practice section and `CLAUDE.md` (the `src/lib/player/` and `src/lib/server/` layout lines: `run-details.ts`, the new components).
- [ ] **Step 2:** Full shot set at 390x844 light and dark and 1440x900; compare with the B2 boards in the scratchpad; send them to the user's phone.
- [ ] **Step 3:** `npm run check`. Expected: PASS. Commit `docs: one player`.
