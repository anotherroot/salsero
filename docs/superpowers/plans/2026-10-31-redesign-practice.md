# Redesign: Practice (the player) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw Practice (`/[dance]/player`) in the new look — setup on a band with
Count only | A song, the tempo and Voice rows, chips, a pinned Play; the band turned
into a stage while running (the count in cream, the 1 as a cream disc, the called
figure, the time), the app's own seek bar, the routine's slots and a Voice card under
it, Stop and Pause as 64 px pills; Save this run as a bottom sheet — and every error
state, in portrait, landscape and desktop, losing nothing the player does today.

**Architecture:** The route, its load, its `save` action and the whole audio side
(`src/lib/scheduler/`, `createPlayer`, `routinePlan`, the Play tap's synchronous path)
stay exactly as they are. What the screens *decide* — the stage's size, its dots and
digit, the band's subtitles, the run summary, Play's state, Built-in or Yours, where
Back goes — moves into a new pure `src/lib/player/view.ts` with a spec. The components
in `src/lib/components/player/` are restyled in place: `Setup` renders its own `Screen`,
`Running` renders its own stage band, a new `StageCount` draws the count on the band,
`SaveSetSheet` follows the board. The load gains one field (`back`) and reads one new
query parameter (`from`).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4 tokens from the foundation,
Vitest (node only — no component tests), Playwright screenshots via the scratchpad tools.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Practice", "Patterns
used across screens", "Navigation" (Practice is pushed, reached from Music, a song, a
routine, an exercise), "Calls made while writing this" (Save this run drops "0 figures
called" when no routine ran). The voice: `docs/superpowers/specs/2026-09-23-count-voice-design.md`.
The player's behaviour: "Songs & player" in `docs/superpowers/specs/2026-09-22-salsa-app-design.md`.
Board source: `docs/superpowers/design-kit/screens/practice.py` (exact copy, spacing,
states); previews `s-practice-0.png` … `s-practice-5.png` in
`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/previews/`.

**This is plan 10 of 13.** All plans land on branch `app-icons`, deployed once when the
last is done. It builds on the foundation (plan 1: `Screen`, `BandButton`, `Segmented`,
`Banner`, `Badge`, `Spinner`, `Sheet`, `Icon`, `styles.ts`), the Logging plan (plan 3:
`Stepper`, `Slider`, `BottomBar`, `nextRating` in `src/lib/exercises/log-view.ts`, the
restyled `SourcePicker` and `PracticePanel`) and the Music plan (`SampleButton` with its
`name`, `LiveCount`, `SongProgress` token names). Out of scope: the song popup's sheet,
search and rows inside `SongPicker.svelte` and the exercise `PickerField` (the picker
plan, 8 — this plan only opens them), the voice recording page `/voice` (plan 12 — this
plan only links to it), the log popup's practice panel (plan 3, done).

`SHOTS` below is
`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/tools`;
the dev server on http://localhost:20000 serves this worktree and `page.sh` is signed in.
Never start another dev server.

## Global Constraints

From the foundation, verbatim:

- Colours come from `tokens.ts` / `layout.css` only; no hex in components.
- Small text ≥ 4.5:1 against its background, large (≥ 24 px) ≥ 3:1, in all four themes.
- Small text on the light salsa band is white `#ffffff`; band title and icons are cream `#FFF3E4`.
- Fonts: Bricolage Grotesque (titles, hero, big numbers) and Manrope (everything else), self-hosted.
- Icons: 24 px grid, 2 px round strokes; filled variants for the four tabs; tab bar icons 28 px.
- Radii: 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill. Spacing 4, 8, 12, 16, 20, 24, 32, 48.
- Focus: 2 px accent ring + 4 px halo (accent at 20 %); around a filled control, a 2 px gap first.
- No dance switch anywhere; no dance name in a header.
- Touch targets ≥ 44 px.
- Respect `prefers-reduced-motion` for every animation.
- Project rules from `CLAUDE.md` hold: `use:guarded` for filled-in forms, no browser `confirm()`, nothing from `$lib/server` in components, `npm run check` must pass.

This area's:

- **The player's timing is the audio clock's — only the look changes.** No edit to
  `src/lib/scheduler/`, `src/lib/routines/plan.ts`, `songGrid.svelte.ts`, the
  `createPlayer` options the page and `PracticePanel` pass, the takes filter, the
  `starting` guard, or the `onDestroy` / `beforeunload` stops. In `handlePlay`/`start`,
  nothing may be awaited before `handle.start()` (iOS unlocks audio only inside the
  tap). `git diff app-icons -- src/lib/scheduler src/lib/routines/plan.ts` must be empty
  at the end of every task.
- **Keep every behaviour of today:** `?song=`, `?bpm=`, `?exercise=`, `?routine=` (404s
  for the other dance's song or routine); settings remembered per dance in
  `localStorage` (`<dance>.player`, the same fields and guards); the exercise's choices
  remembered on Play (`rememberPractice`); the song's grid fetched on pick; seek before
  Play and while running; Stop then Play resumes where it stopped; pitch-corrected
  speeds; count pattern and voice volume changeable mid-run; the routine's slot list
  following the call; the song's end ends the run; Calls only with a routine (default
  every 2); clave only where `dance.clave`; a sample stops on Play; `player_json`'s shape
  and `MAX_CALLED`; Save → Today; Don’t save → setup; a failed save keeps what was
  entered; ✕, the scrim, Escape, Back and a navigation ask first on Save this run.
- **On the band, cream only.** The count is `text-band-ink`; the 1 is a `bg-band-ink`
  disc with the number in `text-band`; never accent on the band (it fails contrast).
  Small band text is `text-band-small`.
- Small accent text is `text-accent-text`, never bare `text-accent` (the foundation's
  carried item). Bare `text-accent` only on icons, rings and fills.
- **CSS order:** a colour appended after `button()` / `iconButton()` output loses to the
  builder's own (`text-ink`, `text-on-danger`…) whatever the attribute order. Build a
  colour variant with `.replace(...)` on the builder's string, or write literal classes.
- Numbers that tick (the count, times, BPM) are `tabular-nums`.
- Copy, exactly: "Practice", "Count only", "A song", "Tempo", "BPM", "Slower", "Faster",
  "Voice", "Record your own count", "Built-in", "Yours", "Song", "Speed", "Loading the
  beat grid…", "That song could not be loaded. Pick another, or use the count.", "Voice
  count", "Clave", "Off", "Calls · a figure every 1, 2 or 4 eights", "Every 1", "Every
  2", "Every 4", "Voice volume", "Play", "Starting…", "Pick a song first.", "Its song is
  not ready" + "Pick another, or use the count.", "Could not start the player." +
  "Nothing is playing. Tap Play to try again.", "Stop and go back", "Pause", "Resume",
  "Stop", "Paused · <m:ss>", "Now", "Save this run", "<m:ss> · <n> figures called ·
  logged as a set", "<m:ss> · logged as a set", "Exercise", "Choose an exercise…", "How
  did it go?", "Note", "(optional)", "Anything to remember?", "Don’t save", "Save",
  "Back to Music", "Back to Today", "Back to <routine or song name>".

**Screenshots.** Plain pages: `$SHOTS/page.sh OUTDIR /salsa/player /bachata/player`
(`FULL=1` full page, `W=`/`H=` for the viewport). States behind a tap: Task 3 creates
`$SHOTS/practice-states.py` (copy `$SHOTS/sheet.py`; launch chromium with
`args=["--autoplay-policy=no-user-gesture-required"]`; `BASE = "http://localhost:20000"`);
later tasks add to it. Run it with page.sh's wrapper:
`env -u LD_LIBRARY_PATH PLAYWRIGHT_BROWSERS_PATH=/nix/store/wzfqrpwxk230xqjl1z27h7lis19gjs4f-playwright-browsers timeout 240 nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (p: [p.playwright])' -c python3 -I $SHOTS/practice-states.py OUTDIR $SHOTS/state.json`.
Data the dev database lacks (it has one bachata song and one bachata routine): a ready
salsa song made by hand as `CLAUDE.md`'s Commands section says — an ffmpeg click track
under `.data/audio/`, `status='ready'`, `dance='salsa'`, title "Vivir mi vida", beats
every 0.625 s for 252 s — via `timeout 30 nix develop -c sqlite3 .data/salsa.db`, never
from a spec; a salsa routine "Casino basics" with five or six slots, one of them a
figure named "Dile que no con vuelta · Doble con mano", and its exercise, made through
the app's own UI (Moves → Routines → +). States the UI cannot reach are forced in the
script: song failed — `pg.route("**/songs/*/grid", lambda r: r.fulfill(status=500))`;
could not start — `pg.route("**/clips/**", lambda r: r.abort())` before Play; Starting… —
delay `**/clips/**` by 3 s and shoot 300 ms after the tap.

## Review Focus

1. **Leaving mid-run never loses the run silently:** the band's back while running
   stops the run and opens Save this run; Don’t save then goes to the back target, Save
   logs it. Pinned by the "back mid-run" assertions in Task 4's script.
2. **Play disabled always says why:** A song with nothing picked shows "Pick a song
   first." above Play; a loading grid shows the loading row; a failed one the error
   under the field; Starting… is busy and cannot be tapped twice. Pinned by `playState`
   tests in Task 1 and the Task 3 screenshots.
3. **Bachata has no clave anywhere** — not in setup, not in the running subtitle, even
   when the run's toggles carry a clave from a salsa-written store. Pinned by
   `runSubtitle` tests in Task 1 and the bachata screenshots in Tasks 3 and 4.
4. **The stage fits a small phone and a landscape phone:** at 360×640 and 844×390 the
   count, a two-line called name ("Dile que no con vuelta · Doble con mano"), the time,
   Stop and Pause are all on screen without scrolling. Pinned by the screenshots in
   Tasks 4 and 6.
5. **The run summary counts right:** no routine, or a routine run with Calls off, drops
   the figures part; one figure is "1 figure called". Pinned by `runSummary` tests in
   Task 1.

---

### Task 1: What the page derives, and where Back goes

**Files:**
- Create: `src/lib/player/view.ts`
- Test: `src/lib/player/view.spec.ts`
- Modify: `src/routes/[dance]/player/+page.server.ts` (read `from`, return `back`)
- Modify: `src/lib/components/exercises/kinds/routine/Log.svelte` (the "Practise in player" link gains `&from=today`)
- Test: `src/routes/[dance]/dance-wall.spec.ts` (one assertion in the player block)

**Interfaces:**
- Consumes: `chooseTakes(takes, effectiveBpm)` from `$lib/scheduler/attach` (pure, node-safe — `attach.spec.ts` already imports it), `clock` from `$lib/format`, `frequencyLabel` from `$lib/frequency`, `typeInfo` from `$lib/exercises/kinds`, `Dance`, `DanceSlug`, `Speed`, `ClavePattern`, `CountPattern`, `Source`, `CountTakeRow`.
- Produces (all in `src/lib/player/view.ts`, PURE, client-safe):
  - `stageSize(hasSong: boolean, hasRoutine: boolean): number` — the count's disc in px.
  - `stageDigit(count: number | null, paused: boolean): { text: string; disc: boolean; dim: boolean }`
  - `stageDots(count: number | null, paused: boolean): { n: number; size: 10 | 16; tone: 'now' | 'held' | 'beat' | 'quiet' }[]`
  - `setupSubtitle(routine: { name: string; figureIds: number[] } | null): string | undefined`
  - `runSubtitle(r: { routine: string | null; song: boolean; speed: Speed; bpm: number | null; clave: ClavePattern | null }, dance: Dance): string | undefined`
  - `runSummary(durationS: number, calls: number | null): string` — `calls` null = nothing was called by design.
  - `playState(p: { source: 'count' | 'song'; songId: number | null; ready: boolean; error: string | null; starting: boolean }): { disabled: boolean; busy: boolean; label: 'Play' | 'Starting…'; why: string | null }`
  - `voiceKind(takes: CountTakeRow[], pattern: CountPattern, bpm: number | null): 'Built-in' | 'Yours'`
  - `exerciseLine(e: { source: Source; everyDays: number }): string`
  - `practiceBack(p: { dance: DanceSlug; from: string | null; routine: { id: number; name: string } | null; song: { id: number; title: string } | null; exercise: boolean }): { href: string; label: string }`
  - The load's data gains `back: { href: string; label: string }`.

- [ ] **Step 1: Write the failing tests** in `view.spec.ts`:

```ts
it('sizes the stage by what else shares the screen', () => {
  expect(stageSize(true, true)).toBe(136);
  expect(stageSize(false, true)).toBe(176);
  expect(stageSize(true, false)).toBe(176);
  expect(stageSize(false, false)).toBe(230);
});
it('puts the 1 in a disc, dims a paused count, shows – before the first beat', () => {
  expect(stageDigit(1, false)).toEqual({ text: '1', disc: true, dim: false });
  expect(stageDigit(1, true)).toEqual({ text: '1', disc: false, dim: true });
  expect(stageDigit(6, false)).toEqual({ text: '6', disc: false, dim: false });
  expect(stageDigit(null, false)).toEqual({ text: '–', disc: false, dim: true });
});
it('draws eight dots, the current one big, 4 and 8 quiet', () => {
  const d = stageDots(1, false);
  expect(d.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(d[0]).toEqual({ n: 1, size: 16, tone: 'now' });
  expect(d[1]).toEqual({ n: 2, size: 10, tone: 'beat' });
  expect(d[3]).toEqual({ n: 4, size: 10, tone: 'quiet' });
  expect(stageDots(6, true)[5]).toEqual({ n: 6, size: 16, tone: 'held' });
  expect(stageDots(null, false).some((x) => x.size === 16)).toBe(false);
});
it('says the routine and its size under Practice', () => {
  expect(setupSubtitle({ name: 'Casino basics', figureIds: [1, 2, 3, 4, 5, 6] })).toBe('Casino basics · 6 figures');
  expect(setupSubtitle({ name: 'Uno', figureIds: [9] })).toBe('Uno · 1 figure');
  expect(setupSubtitle(null)).toBeUndefined();
});
it('says what the run is running with', () => {
  expect(runSubtitle({ routine: 'Casino basics', song: true, speed: 0.9, bpm: null, clave: '3-2' }, salsa)).toBe('Casino basics · 0.9× · clave 3-2');
  expect(runSubtitle({ routine: null, song: false, speed: 1, bpm: 180, clave: '2-3' }, salsa)).toBe('180 BPM · clave 2-3');
  expect(runSubtitle({ routine: 'Sensual flow', song: false, speed: 1, bpm: 128, clave: null }, bachata)).toBe('Sensual flow · 128 BPM');
  expect(runSubtitle({ routine: 'Sensual flow', song: false, speed: 1, bpm: 128, clave: '3-2' }, bachata)).toBe('Sensual flow · 128 BPM');
  expect(runSubtitle({ routine: null, song: true, speed: 1, bpm: null, clave: null }, salsa)).toBeUndefined();
});
it('sums the run up, dropping the calls when nothing was called by design', () => {
  expect(runSummary(222, 12)).toBe('3:42 · 12 figures called · logged as a set');
  expect(runSummary(60, 1)).toBe('1:00 · 1 figure called · logged as a set');
  expect(runSummary(252, null)).toBe('4:12 · logged as a set');
});
it('says why Play cannot start', () => {
  const base = { source: 'song', songId: 4, ready: true, error: null, starting: false } as const;
  expect(playState({ ...base, source: 'count', songId: null, ready: false })).toEqual({ disabled: false, busy: false, label: 'Play', why: null });
  expect(playState(base)).toEqual({ disabled: false, busy: false, label: 'Play', why: null });
  expect(playState({ ...base, songId: null, ready: false })).toEqual({ disabled: true, busy: false, label: 'Play', why: 'Pick a song first.' });
  expect(playState({ ...base, ready: false })).toMatchObject({ disabled: true, why: null }); // the loading row says it
  expect(playState({ ...base, ready: false, error: 'x' })).toMatchObject({ disabled: true, why: null }); // the field's error says it
  expect(playState({ ...base, starting: true })).toEqual({ disabled: true, busy: true, label: 'Starting…', why: null });
});
it('calls the voice Yours only when a recorded set fits the tempo', () => {
  const take = (pattern, bpm, phrase) => ({ id: 1, pattern, bpm, phrase, file: 'x.wav', preRollS: 0.1, lengthS: 1.3 });
  const takes = [take('salsa', 180, 'a'), take('salsa', 180, 'b')];
  expect(voiceKind([], 'salsa', 180)).toBe('Built-in');
  expect(voiceKind(takes, 'salsa', 180)).toBe('Yours');
  expect(voiceKind(takes, 'all', 180)).toBe('Built-in');
  expect(voiceKind(takes, 'salsa', 230)).toBe('Built-in');
  expect(voiceKind(takes, 'salsa', null)).toBe('Built-in');
});
it('describes the exercise a run logs to', () => {
  expect(exerciseLine({ source: 'routine', everyDays: 3 })).toBe('Routine · Every 3 days');
  expect(exerciseLine({ source: 'figure', everyDays: 7 })).toBe('Figure practice · Weekly');
});
it('goes back where Practice was opened from', () => {
  const p = { dance: 'salsa', from: null, routine: null, song: null, exercise: false } as const;
  expect(practiceBack(p)).toEqual({ href: '/salsa/songs', label: 'Back to Music' });
  expect(practiceBack({ ...p, song: { id: 4, title: 'Vivir mi vida' } })).toEqual({ href: '/salsa/songs/4', label: 'Back to Vivir mi vida' });
  expect(practiceBack({ ...p, routine: { id: 3, name: 'Casino basics' }, exercise: true })).toEqual({ href: '/salsa/routines/3', label: 'Back to Casino basics' });
  expect(practiceBack({ ...p, from: 'today', routine: { id: 3, name: 'Casino basics' }, exercise: true })).toEqual({ href: '/salsa', label: 'Back to Today' });
  expect(practiceBack({ ...p, exercise: true })).toEqual({ href: '/salsa', label: 'Back to Today' });
});
```

`salsa` / `bachata` are `getDance('salsa')` / `getDance('bachata')`.

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/player` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement `view.ts`.** `stageDigit`: `dim` when paused or `count === null`.
  `runSubtitle` joins `[routine, song ? (speed === 1 ? null : `${speed}×`) : `${bpm} BPM`, dance.clave && clave ? `clave ${clave}` : null]` with " · " and returns `undefined` for an empty list. `voiceKind`: `bpm` null or no fitting set (`chooseTakes(takes.filter((t) => t.pattern === pattern), bpm) === null`) → `'Built-in'`. `practiceBack` order: `from === 'today'` → Today; routine → its page; song → its page; exercise → Today; else Music. A file header comment: PURE, client-safe, what the Practice page shows.
- [ ] **Step 4: Run** the spec again — Expected: PASS.
- [ ] **Step 5: The load.** In `+page.server.ts` read `from = url.searchParams.get('from')` and
  return `back: practiceBack({ dance, from, routine: routine && { id: routine.id, name: routine.name }, song: songId ? { id: songId, title: songs.find((s) => s.id === songId)!.title } : null, exercise: exercise !== null })` — `songId` here is the URL's `?song=`, not the exercise's memory (Back returns to the page that opened Practice). In `routine/Log.svelte` append `&from=today` to the "Practise in player" href. In `dance-wall.spec.ts`'s player block add: `openPlayer('salsa', \`song=${salsaSong}\`).back` equals `{ href: \`/salsa/songs/${salsaSong}\`, label: 'Back to Salsa ready' }` (widen the `PlayerLoad` type with `back`).
- [ ] **Step 6: Run** `timeout 600 nix develop -c npx vitest run src/lib/player src/routes` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(practice): what the page derives, and Back to where it was opened from`.

### Task 2: The shared pieces Practice needs

**Files:**
- Create: `src/lib/components/player/SpeedChips.svelte`
- Modify: `src/lib/components/player/SourcePicker.svelte` (uses `SpeedChips`), `CountChips.svelte`, `ClaveChips.svelte`, `SongPicker.svelte` (the field only), `src/lib/components/ui/BottomBar.svelte`

**Interfaces:**
- Produces:
  - `<SpeedChips value: Speed onchange: (s: Speed) => void name: string />` — a `role="radiogroup"` `aria-label="Speed"` of `CHIP` radios over `SPEEDS`, labels `1×`, `0.9×`, `0.8×`, `0.7×`.
  - `CountChips` and `ClaveChips` gain `label: string` (the radiogroup's `aria-label`, `role="radiogroup"` on the wrapper); `CountChips` gains `scroll?: boolean = false` — one row that scrolls sideways (`flex-nowrap overflow-x-auto`, bleeding to the screen edge with `-mr-4 pr-4`, scrollbar hidden) instead of wrapping; on mount it sets the row's `scrollLeft` so the checked chip is in view (never `scrollIntoView`, which would move the page). Wrapping rows use `gap-x-2 gap-y-1` (board: gap 8, row gap 4).
  - `SongPicker` gains `variant?: 'field' | 'card' = 'field'`, `invalid?: boolean = false`, `children?: Snippet` (drawn under the card's head). `'field'` is today's look, untouched (the panel's; its restyle is the picker plan's). `'card'`: a `rounded-2xl bg-surface overflow-hidden` card, `ring-2 ring-inset ring-danger` and `aria-invalid="true"` on the field button when `invalid`; head `flex items-center gap-3 py-2.5 pr-2.5 pl-3`: the picked song's `SampleButton` (with `name={picked.title}`) FIRST, then the field button (`min-h-11 flex-1`, title 16/700 `text-ink leading-[1.3]`, meta 13 `text-muted` — or "Sample from m:ss" 13/700 `text-accent-text` while sampling — and `chevron-down` 20 `text-muted`; nothing picked: "Pick a song" 16/600 `text-muted`); `children` under a `border-t border-hairline`. The popup (`Sheet` "Pick a song") is not touched.
  - `BottomBar` gains `fade?: boolean = false`: no top border, background `bg-linear-to-b from-ground/0 to-ground to-[34%]`, top padding 28 px — the board's footer the settings scroll under.

- [ ] **Step 1: Run** `timeout 600 nix develop -c npx vitest run` — Expected: PASS (baseline; these are components).
- [ ] **Step 2: Implement** the four changes above. `SourcePicker` renders `<SpeedChips name="{name}-speed" …>`; `PracticePanel` passes the new `label`s ("Voice count", "Clave").
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look.** Open a drill or figure exercise's log popup with its panel expanded on A song (the Logging plan's `$SHOTS/logging-states.py`, or by hand): it looks as before — the panel keeps `variant="field"`, the chips still wrap. `/salsa/player` still works with its old layout.
- [ ] **Step 5: Commit** `feat(practice): speed chips, chip groups that scroll, the song card, a fading bottom bar`.

### Task 3: Setup

**Files:**
- Modify: `src/lib/components/player/Setup.svelte`, `src/routes/[dance]/player/+page.svelte`
- Create: `$SHOTS/practice-states.py` (scratchpad, not the repo)

**Interfaces:**
- Consumes: Task 1's `setupSubtitle`, `playState`, `voiceKind`, `data.back`; Task 2's `SpeedChips`, `CountChips label`, `ClaveChips label`, `SongPicker variant="card"`, `BottomBar fade`; `Screen`, `BandButton`, `Segmented onBand`, `Stepper`, `Slider`, `Banner`, `Spinner`, `Icon`, `GROUP`, `ROW`, `SECTION_LABEL`, `CHIP`, `button`; `bpmOf` from `$lib/beatgrid/beatgrid`.
- Produces: `Setup` props, replacing today's: `songs`, `source` (bindable), `songId` (bindable), `songReady: boolean`, `songError: string | null`, `audio`, `rememberedBpm`, `songGone`, `defaultBpm`, `dance`, `routine`, `onplay`, `starting` (all as today) plus `back: { href: string; label: string }`, `takes: CountTakeRow[]`, `songBeats: number[] | null` (the picked song's grid beats, for Built-in or Yours), `startError: string | null`. `PlayerSettings` is unchanged.

- [ ] **Step 1: Setup renders its own `Screen`** — `title="Practice"`, `subtitle={setupSubtitle(routine)}`,
  `left`: `<BandButton icon="back" label={back.label} href={resolve(back.href)} />`, `extra`
  (only when `songs.length > 0`, as today's `SourcePicker` hides Source without songs):
  `<Segmented onBand name="player-source" label="Source" items={[Count only, A song]}>`
  bound to `source`. Body, in this order (board `setup_count`, `setup_song`, `setup_routine`, `setup_bachata`):
  1. `startError` → `<Banner kind="error" title="Could not start the player.">Nothing is playing. Tap Play to try again.</Banner>`; the page `console.error`s the thrown error. `songGone` → `<Banner kind="info" title="Its song is not ready">Pick another, or use the count.</Banner>`.
  2. Count only: one `GROUP` — the `Stepper` (label "Tempo", unit "BPM", 60–300, step 5, `bind:value={bpm}`) in a `py-3 pr-3 pl-4` row, then the Voice row. Inside the surface card the stepper's `bg-field` pill reads as the board draws it in dark (the carried item: it sat on the ground before and vanished) — check it in the dark screenshot.
     A song: `SECTION_LABEL` "Song" (its id names the field), `SongPicker variant="card" invalid={!!songError}` whose `children` is `SongProgress` (when `songReady && audio`, seeking `audio.currentTime` as today) or, while `songId !== null && !songReady && !songError`, the loading row (`Spinner` 18 + "Loading the beat grid…" 13/600 `text-muted`, `px-4 py-3`); under the card `songError` as `FIELD_ERROR` with the `warning` icon 16; then `SECTION_LABEL` "Speed" + `SpeedChips`.
  3. With a routine: `SECTION_LABEL` "Calls · a figure every 1, 2 or 4 eights" + radios Off / Every 1 / Every 2 / Every 4 (`CHIP`, today's `callEvery` state).
  4. "Voice count" + `CountChips label="Voice count"`; "Clave" + `ClaveChips label="Clave"` when `dance.clave`.
  5. A song only: a `GROUP` with the Voice row (count only has it in the tempo group).
  6. "Voice volume" + `Slider` (label "Voice volume", `bind:value={voiceVolume}`) in `rounded-2xl bg-surface px-4 py-2`.
  The Voice row: `<a class="{ROW} min-h-[58px]" href={myCountHref(page.url.pathname + page.url.search, pattern)}>` — "Voice" 16/700 `text-ink`, "Record your own count" 13 `text-muted`, trailing `voiceKind(takes, count, tempo)` 16 `text-muted` and `chevron-right` 20 `text-chevron`, where `tempo` is `bpm` for Count only, and for A song `bpmOf(songBeats) * speed` once the grid has loaded, else `null` (Built-in while it loads). The old "Use my own voice" link and the "Routine: …" paragraph go (both are now on the band or in this row).
  Section labels sit `pt-2` above their control; the body ends `pb-32` so the last control clears the footer.
- [ ] **Step 2: Play** in `<BottomBar fade>`: `const ps = playState({ source, songId, ready: songReady, error: songError, starting })`; when `ps.why`, a 13/700 `text-muted` centred line above the button; the button is `button('primary', 'lg', true)` with `disabled={ps.disabled}`, `aria-busy={ps.busy}`, content `<Icon name="play" size={22} filled />Play` or `<Spinner size={22} />Starting…`. `play()` is unchanged (still `stopSample()` then `onplay(...)` synchronously).
- [ ] **Step 3: The page.** Delete the old sticky header and the old start-error paragraph; the
  `<audio>` stays mounted as today but loses `controls` and is always `hidden` (the app's
  seek bar replaces the browser's; the device's volume keys set the song's level). Pass
  `back={data.back}`, `takes={data.takes}`, `songBeats={song.grid?.beats ?? null}`,
  `startError`. Render `Setup` whenever `mode !== 'running'` (Task 5 draws Save this run
  over it). `<title>Practice · {data.dance.label}</title>`.
- [ ] **Step 4: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS; and `git diff app-icons -- src/lib/scheduler src/lib/routines/plan.ts` — Expected: empty.
- [ ] **Step 5: Look.** Create the data in "Screenshots" if missing. `$SHOTS/page.sh OUT /salsa/player?bpm=180 /salsa/player?song=<id> /salsa/player?routine=<id> /bachata/player` and `practice-states.py` for: song failed, could not start, Starting…, A song with nothing picked (switch Source on `/salsa/player?bpm=180` → "Pick a song first."). Compare with "Setup · count only", "Setup · a song", "Setup · a routine", "Setup · bachata", "Song failed to load", "Could not start", "Starting…" in `s-practice-0…4.png`, light and dark: Segmented on the band, the stepper pill readable in dark, no Clave in bachata, Play pinned over the fade.
- [ ] **Step 6: Commit** `feat(practice): setup on the band, the song card, Voice and Play pinned`.

### Task 4: Running — the band becomes the stage

**Files:**
- Create: `src/lib/components/player/StageCount.svelte`
- Modify: `src/lib/components/player/Running.svelte`, `src/routes/[dance]/player/+page.svelte`
- Modify: `$SHOTS/practice-states.py`

**Interfaces:**
- Consumes: Task 1's `stageSize`, `stageDigit`, `stageDots`, `runSubtitle`; `beatIndexAt`; `BandButton`, `Badge`, `BottomBar`, `Slider`, `CountChips` (`scroll`), `SongProgress`, `button`, `SECTION_LABEL`.
- Produces:
  - `<StageCount time: () => number | null beats: number[] counts: number[] size: number paused: boolean />` — the same `requestAnimationFrame` + `beatIndexAt` loop as `LiveCount` (which stays as it is for the song page and the panel); `aria-live="off"`; the digit in a `role="img"` `aria-label="Count {n}"` box of `--stage: min({size}px, 30dvh)` square (Task 6 widens the cap in landscape); digit `font-display` 800 `tabular-nums` `tracking-[-0.03em]` `leading-none` at `calc(var(--stage) * 0.82)`, `text-band-ink` (`text-band-ink/60` when `dim`); a disc: `rounded-full bg-band-ink text-band shadow-[0_10px_30px_rgb(0_0_0/0.22)]`. Dots under it, `gap-2.5`, `h-4`, `aria-hidden`: `now` `bg-band-ink`, `held` `bg-band-ink/60`, `beat` `bg-band-ink/36`, `quiet` `bg-band-ink/20`, sized 10 or 16.
  - `Running` gains `title: string`, `subtitle: string | undefined`, `backLabel: string`, `onback: () => void`; its other props are today's.
  - The page: `finish(leave = false)`; `let leaving = $state(false)`.

- [ ] **Step 1: The stage band** (board `stage_header`). `Running` fills the viewport: a
  `fixed inset-y-0 left-1/2 w-full max-w-[560px] -translate-x-1/2 flex flex-col z-10`
  column. The band (`bg-band`, padding `calc(22px + env(safe-area-inset-top)) 20px 50px`,
  `--focus-ring: var(--color-band-ink)`): a row with `<BandButton icon="back"
  label="Stop and go back" onclick={onback}>` and the 30 px title (`font-display` 800
  `text-band-ink` `leading-[1.1]`, one line, ellipsis); the subtitle 15/600
  `text-band-small` `pl-[38px]`; then, centred, gap 10: `StageCount` (`size={stageSize(!!song, slots.length > 0)}`), the call — only
  with a routine — `<p aria-live="polite">` 32 px `font-display` 800 `text-band-ink`
  `leading-[1.1] min-h-9 text-balance line-clamp-2`, and the time: 16/700
  `text-band-small` `tabular-nums` `clock(elapsed)`, or paused the pill
  `inline-flex h-[30px] items-center gap-1.5 rounded-full pr-3.5 pl-2.5 ring-[1.5px] ring-inset ring-band-ink text-[14px] font-extrabold text-band-ink tabular-nums` with `pause` 16 filled and "Paused · {clock(elapsed)}". No slim band: the stage never scrolls away.
- [ ] **Step 2: The sheet** under it: `-mt-7 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-ground px-4 pt-4 pb-[112px]`, holding in order:
  - A song: `SongProgress {audio} onseek={(t) => player.seek(t)}` — the app's own bar now that the `<audio>` has no controls (it seeks once, on release; `SeekBar` seeks on every move, which would clear the queued count each time).
  - A routine: the slot list (board `slot_list`): `<ol aria-label="Routine">` `relative max-h-[130px] overflow-y-auto rounded-2xl bg-surface` with `mask-image: linear-gradient(#000 70%, transparent)`; each `li` `min-h-12 flex items-center gap-3 border-b border-hairline py-1.5 pr-3.5 pl-3.5`: the number 13/800 `w-[18px] tabular-nums`, the names (`figureIds.map(nameOf).join('  /  ')`) 15 `leading-[1.3]`, the note under them 12/600; active (`aria-current="step"`): `bg-accent-soft`, number and names `text-accent-text` 800, note `text-accent-text`, and `<Badge tone="accent" solid>Now</Badge>`; others: number `text-muted`, names `text-ink-2` 600, note `text-muted`. Follow the active slot by setting the `ol`'s own `scrollTop` to the row's `offsetTop` (`behavior: 'smooth'`, `'auto'` under `prefers-reduced-motion`) — replacing `scrollIntoView`, which also scrolls the sheet and would push the seek bar away.
  - The Voice card: `SECTION_LABEL` "Voice", then `rounded-2xl bg-surface overflow-hidden`: `CountChips name="runCount" label="Voice count" scroll={!!song || slots.length > 0}` in `py-1.5 pl-3`, a hairline, and `Slider label="Voice volume"` in `px-4 py-1` calling `player.setVoiceVolume` on input (as today).
- [ ] **Step 3: The transport** in `<BottomBar fade>` inside `Running`'s column (the column's transform makes the bar's `fixed` relative to the column, which is what keeps it 560 px wide; Task 6 moves it into the right half in landscape), `flex gap-2.5`:
  Stop — `button('danger', 'lg').replace('bg-danger text-on-danger', 'bg-danger-soft text-danger').replace('px-7', 'pr-6 pl-5')` with `stop` 22 filled and "Stop", calling `onstop`; Pause — `button('primary', 'lg', true)` with `pause` 22 filled "Pause", or `play` "Resume" while paused (`togglePause` unchanged: never stop/start).
- [ ] **Step 4: The page.** Pass `title={runningSong?.title ?? 'Practice'}`, `subtitle={runSubtitle({ routine: data.routine?.name ?? null, song: !!runningSong, speed, bpm: runningBpm, clave: runToggles?.clave ?? null }, data.dance)}`, `backLabel`, `onback={() => finish(true)}`. `finish(leave)` sets `leaving = leave` and does what it does today. (Task 5 uses `leaving`.)
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS; the scheduler diff — Expected: empty.
- [ ] **Step 6: Look.** In `practice-states.py`: Play on `/salsa/player?bpm=180` (wait 3 s) → count only; `/salsa/player?routine=<id>` with Source A song → routine to a song; then Pause → paused; `/bachata/player?routine=<id>` → bachata. Also at `W=360 H=640` the routine run with the long figure called (wait for its call). Compare with "Running · routine to a song", "Running · count only", "Paused", "Running · bachata" in `s-practice-1.png`/`s-practice-2.png`, light and dark: the 1 a cream disc with the band-coloured number, no Clave in the bachata subtitle, the count, a two-line call, the time, Stop and Pause all visible at 360×640.
  Back mid-run (Review Focus 1), asserted by the script: while running click "Stop and go back" → a `dialog[open]` titled "Save this run" is visible (print it) — Task 5 then checks where Don’t save goes.
- [ ] **Step 7: Commit** `feat(practice): the stage on the band, the seek bar, slots and voice mid-run, Stop and Pause`.

### Task 5: Save this run

**Files:**
- Modify: `src/lib/components/player/SaveSetSheet.svelte`, `src/routes/[dance]/player/+page.svelte`
- Modify: `$SHOTS/practice-states.py`

**Interfaces:**
- Consumes: Task 1's `runSummary`, `exerciseLine`; `nextRating` (`$lib/exercises/log-view`); `Sheet` (`sub`, `footer`), `Banner`, `Spinner`, `Icon`, `GROUP`, `ROW`, `LABEL`, `TEXTAREA`, `button`; `PickerField` and `exerciseGroups` as today.
- Produces: `SaveSetSheet` props: `exercise: { id: number; name: string; line: string } | null`, `exercises`, `summary: string` (replaces `durationS` + `calledCount` for the text; `durationS: number` stays for the hidden field), `run`, `fail`, `onclose` — as today otherwise.

- [ ] **Step 1: The sheet** (board `save_sheet`): `<Sheet title="Save this run" sub={summary}>`, body `flex flex-col gap-3.5`, inside the existing `use:guarded` form (label "This run", `dirty: () => true`, unchanged) given an `id`:
  - A fixed exercise: `LABEL` "Exercise", then a `GROUP` holding one non-interactive `ROW` — `check-circle` 24 filled `text-accent`, the name 16/700 `text-ink`, `exercise.line` 13 `text-muted`; the hidden `exerciseId` as today. Otherwise today's `PickerField` ("Exercise", "Choose an exercise…") — its look is the picker plan's.
  - "How did it go?": a `fieldset`, legend `LABEL`; five `flex-1 h-12 rounded-[14px] text-[17px] font-extrabold` buttons `1`…`5`, `aria-pressed={rating === n}`, filled up to the pick (`bg-accent text-on-accent`), the rest `bg-surface text-ink-2 ring-1 ring-inset ring-field-line`; a tap sets `rating = nextRating(rating, n)` (tap the pick again to clear).
  - "Note" `LABEL` with ` (optional)` in `font-normal text-muted`; `<textarea class={TEXTAREA} rows="2" maxlength="2000" placeholder="Anything to remember?">` keeping `fail?.note`.
  - `fail` → `<Banner kind="error" title={fail.message} />` after the note (as the board places it, next to Save).
  - `footer`: `flex items-center gap-2` — "Don’t save" `button('tertiary')` calling `onclose`; "Save" `button('primary', 'md', true)` `type="submit" form={formId}`, disabled until an exercise is fixed or picked, and while saving `aria-busy` with a `Spinner` in place of the label (width kept).
- [ ] **Step 2: The page.** Pass `summary={runSummary(finalElapsed, data.routine !== null && runToggles?.callEvery != null ? calledIds.length : null)}` and `exercise={data.exercise && { id, name, line: exerciseLine(data.exercise) }}`. `onclose`: `if (leaving) goto(resolve(data.back.href)); else mode = 'setup';` then `leaving = false`. Setup stays drawn behind the sheet (Task 3 Step 3).
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look.** In `practice-states.py`: a routine run with its exercise (`?routine=<id>&exercise=<id>`), Stop → "from an exercise" (pick 4, type a note); `/salsa/player?song=<id>`, Play, Stop → "from a song" (Save disabled); save failed — remove the textarea's `maxlength` with `pg.evaluate`, fill 2001 characters, Save → the banner "That note is too long — keep it under 2000 characters." with the rating and note kept; Escape → the Unsaved changes dialog ("This run is not saved yet."). Back mid-run, finished (Review Focus 1): "Stop and go back" → Don’t save → print `pg.url` — expected the routine page (`/salsa/routines/<id>`), not setup. Compare with "Save this run · from an exercise", "· from a song", "Save failed", "Unsaved changes" in `s-practice-3.png`/`s-practice-4.png`, light and dark.
- [ ] **Step 5: Commit** `feat(practice): Save this run in the new look; Back mid-run asks before it leaves`.

### Task 6: Landscape, desktop, and the docs

**Files:**
- Modify: `src/lib/components/player/Running.svelte`, `src/lib/components/player/StageCount.svelte`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`

**Interfaces:**
- Consumes: Task 4's `Running` and `StageCount`.

- [ ] **Step 1: Landscape phone** — a scoped `<style>` media query in `Running.svelte`,
  `@media (orientation: landscape) and (max-height: 520px)`: the column becomes a row as
  wide as the screen (`max-width: 900px`); the band is the left half, full height, its
  stage centred and its bottom padding 22 px; the sheet is the right half, full height,
  scrolling, with `border-radius: 28px 0 0 28px` and `margin-left: -28px` (it overlaps the
  band from the side, as it overlaps from below in portrait); the transport sits at the
  bottom of the right half. `StageCount`'s cap becomes `min({size}px, 46dvh)` there. Setup
  needs nothing: `Screen` scrolls and Play stays pinned.
- [ ] **Step 2: Desktop** (wide and tall): the portrait layout in the 560 px column, as every
  pushed screen; nothing else.
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look** with `practice-states.py` at `W=844 H=390` (routine to a song, running and paused) and `W=1280 H=800` (setup and running): count, call, time, Stop and Pause on screen with no page scroll; the same tokens as portrait; light and dark.
- [ ] **Step 5: Docs.** `CLAUDE.md` Layout gains `src/lib/player/ PURE view.ts: what the
  Practice page shows — the stage's size and dots, the band's subtitles, the run summary,
  Play's state, Built-in or Yours, where Back goes. Client-safe`. The main spec's "Songs &
  player": the `<audio>` has no browser controls (the app's seek bar seeks before Play and
  while running); Back goes to where Practice was opened from (`practiceBack`, `?from=today`
  from the routine log popup); Back mid-run stops the run and offers Save this run first;
  the Voice row says Built-in or Yours and opens My count through `myCountHref` (`?from=`).
- [ ] **Step 6: Commit** `feat(practice): landscape and desktop; docs`.

---

## Calls made in this plan

- **Back goes to where Practice was opened from**, derived from the query in the load
  (`practiceBack`): a routine → its page, `?song=` → the song, an exercise alone → Today,
  else Music; the routine log popup's link adds `&from=today`. The board names four back
  targets and today's page always went to Today. Not `history.back()`: a direct open
  has no history. Cost if wrong: one pure function and one link.
- **Back while running stops the run and opens Save this run;** Don’t save then leaves.
  The board's label "Stop and go back" with a run lost silently would break "a failed
  save keeps the input"'s spirit. A hardware Back or a tab switch mid-run still stops
  without asking, as today. Cost if wrong: the `leaving` flag.
- **"0 figures called" is dropped when nothing was called by design** — no routine, *or*
  a routine run with Calls off (the spec's call names only the first; the second is the
  same reason). A routine run that called nothing with Calls on still says "0 figures
  called".
- **The `<audio>` loses its browser controls**, in setup and while running; the app's
  `SongProgress` seeks in both. The browser bar's song volume (desktop only) goes; the
  device's volume and the Voice volume slider set the mix. If missed: a volume `Slider`
  for the song in the running sheet.
- **`SongProgress`, not the Music plan's `SeekBar`,** is Practice's seek bar: it is already
  the board's drawing (time · 6 px track with a 16 px accent thumb · length) and it seeks
  once on release, while `SeekBar` seeks on every pointer move — each seek clears the
  queued count. Cost if wrong: a prop on `SeekBar` and a swap.
- **The stage's size** is the board's per state (136 / 176 / 230 px disc, digit at 0.82 —
  the spec's 112–188 px), capped at 30 % of the viewport height in portrait and 46 % in a
  landscape phone so a small phone keeps Stop and Pause on screen. The running screen has
  no slim band: it does not scroll, only its sheet does.
- **A `StageCount` beside `LiveCount`**, not a variant of it: the band's disc, cream
  tones and dim state share nothing with the card count but the rAF loop. "–" before
  the first beat is cream at 75 % (LiveCount's muted would vanish on the band).
- **Voice: "Yours" means a recorded set fits this run's tempo** (`chooseTakes`, the
  player's own rule, ±12 %), for the chosen pattern; a song's tempo is its grid's × speed,
  Built-in while the grid loads. "Yours" for any recording at all would promise a voice
  the run will not use.
- **The My count link uses `myCountHref` from `src/lib/voice/back.ts`** (controller ruling, to agree with plan 12's Interfaces): Task 3 creates `back.ts` with exactly plan 12's signatures — `myCountHref(from?: string, pattern?: PhrasePattern): string` (`/voice` plus `?from=<encoded>` and/or `pattern=<p>`) and `voiceBack(from: string | null): { href; label: 'Back to Settings' | 'Back to Practice' }` (Practice only for `/<dance>/player…`, else Settings — no open redirect) — with plan 12's spec cases; plan 12 then only wires `/voice` to `voiceBack`.
- **"Its song is not ready" is an info banner** here, as the Practice board draws it (the
  log popup's panel uses warning, as its board does). Setup has already fallen back to
  the count, so nothing is wrong yet.
- **"Could not start the player."** is fixed copy with "Nothing is playing. Tap Play to
  try again."; the thrown message goes to the console instead of the screen.
- **"Pick a song first."** above a disabled Play when A song has nothing picked — the
  board has no such state, and the foundation's rule is that a disabled control says why.
- **The rating is five numbered buttons**, as the Practice board draws them (the log
  popup uses stars); the toggle is the shared `nextRating`.
- **The save error banner sits after the note**, next to Save, as the board places it —
  not at the top of the sheet.
- **The exercise line under a fixed exercise is "<type> · <how often>"** ("Routine · Every
  3 days") from data the page has; the board's "Partner · every 3 days" is not a field.
- **`SongPicker` gets a `card` variant** for Practice and keeps its old field look for the
  log popup's panel; the panel's field and the popup sheet are the picker plan's.
- **Speed chips, chip `label`s, a scrolling chip row and `BottomBar fade`** are small
  additions to shared pieces rather than Practice-only copies.
- **Landscape running is two halves** (stage left, sheet right) under a scoped media
  query; the board draws only portrait. Desktop keeps the 560 px column.
