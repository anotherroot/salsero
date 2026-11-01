# Redesign: Logging a set and the exercise page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the log popup of every exercise type (a tall bottom sheet with a
pinned footer, stars, the practice panel in its three states, the session
footer) and the exercise page (band with a pencil, owner row, history tiles,
sets by day, settings, a drill's links), and make deleting a logged set happen
at once with "Set deleted · Undo" — losing nothing either does today.

**Architecture:** What the popup and the page *decide* moves into two pure
modules with specs: `src/lib/exercises/log-view.ts` (the footer's state
machine, field range errors, the rating toggle, the "Last time" line) and
`src/lib/exercises/exercise-page.ts` (history by day, the three stat tiles,
set titles, the owner row, the archive question). Undo is a server round trip:
`deleteSet` returns a snapshot of the row it removed, and a new `restoreSet`
action re-inserts it with its original instant. The look is built from the
foundation's components plus four small shared ones this area needs first
(`Stepper`, `Slider`, `Stars`, `BottomBar`) and three new `Sheet` props; the
media pieces the popup shows (`VideoFrame`, `SectionCard`, `YouTubeCard`,
`LinkList`, `LinksEditor`'s add form) are restyled here once, for every page
that uses them.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4 tokens from the
foundation, Vitest (node), Drizzle on SQLite (`openDb(':memory:')` in specs).

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` ("Logging a set
and the exercise page", "Patterns used across screens", "Additions" — Undo);
the exercise types spec `docs/superpowers/specs/2026-09-28-exercise-types-design.md`
for what each type's popup holds. Board source
`docs/superpowers/design-kit/screens/logging.py`; previews `s-logging-0.png` …
`s-logging-3.png` in
`/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/previews/`.

**This is plan 3 of 13.** All plans land on branch `app-icons`, deployed once
when the last is done. It builds on plan 1 (foundation) and plan 2 (Today:
`TypeTile`, `exerciseTile`, `SELECT`, `FrequencyField`, `longDayLabel`, the
"Log a set of <name>" buttons that open the popup). Out of this plan: Today
itself (plan 2), the shared Picker's look (plan 7), the full Practice page
(plan 9), the full-screen video player (plan 10). Handed to later plans:
YouTube links' Save video / saving / failed states stay as they are for the
Lessons plan (6); the figure page (plan 4) and the lesson page (plan 6) wrap the
restyled `VideoFrame` in their own cards; the Practice plan (9) reuses
`Stepper`, `Slider` and the restyled `SourcePicker`.

## Global Constraints

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

This area's own:

- **The type owns its popup.** Pages ask `logFor` / `contentFor`; no page branches on the exercise type. The owner row reads the payload through the pure `ownerOf`.
- Small accent text uses `text-accent-text`, never bare `text-accent` (salsa light accent is 4.18:1 on the ground). Bare `text-accent` only on icons (stars, the play glyph).
- Dates and times on screen come from `src/lib/format.ts` / `src/lib/day/day.ts`, never `toLocale*`.
- Copy, exactly: "Log set", "Add set to this day", "Saving…", "Logged", "Next: <name>", "Session done", "Finish", "Skip", "Details", "Stop the count to log it.", "First time.", "Last time: <when>", "Reference", "Hide" / "Show", "Practise with", "<m:ss> practised — Play carries on", "From the practice: <m:ss>", "<n> of 5 · tap it again to clear", "Sets today" / "Sets that day", "Adding to <Weekday, d Month>", "Set deleted" + "Undo", "Could not load this exercise’s details." + "You can still log a set.", "Its song is not ready" + "Pick another, or use the count.", "Practise in player", "A run there saves itself. Log here when you practised away from the app.", "Log a set", "History", "sets" / "practised" / "recent rating", "Nothing logged yet" + "Log a set after you practise — it shows up here, grouped by day.", "Settings", "How often", "Active", "Show it in the to-do list", "Practice notes" (drill: "Description"), "Archive exercise", "Archive this drill?", "Edit links on the figure page", "Link a section…", "Add links", "Add link", "Mirror", "Voice volume", "Tempo", "BPM".
- Keep every behaviour of today: `?log=1` opens the popup on the exercise page; Skip and every close ask first when practice time or typed values would be lost (`leaveOrAsk`, the one UnsavedDialog); a playing count blocks closing and logging; a run fills Minutes and posts `durationS` + `run`; typing in Minutes clears the exact seconds; back-fill hides the panel and posts `day`; the panel remembers its settings (`rememberPractice`) and remounts after each logged set; the figure's call-on-cue; only ready songs; the lesson review has no panel; the routine's "Practise in player" link carries `exercise`; notes are linkified (`LinkedText`); a drill's links, Link a section… and unlink; Save video on the figure and lesson pages; "Showing the latest 200."; `update` / `archive` actions; an archived exercise 404s.

**Screenshots.** `SHOTS=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/tools`. Plain pages: `$SHOTS/page.sh OUTDIR /salsa/exercises/<id> …` (`FULL=1` for full page). States behind a tap: copy `$SHOTS/sheet.py` to `$SHOTS/logging-states.py` (Task 6 creates it; later tasks add to it), change the clicks, run it with page.sh's wrapper:
`env -u LD_LIBRARY_PATH PLAYWRIGHT_BROWSERS_PATH=/nix/store/wzfqrpwxk230xqjl1z27h7lis19gjs4f-playwright-browsers timeout 240 nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (p: [p.playwright])' -c python3 -I $SHOTS/logging-states.py OUTDIR $SHOTS/state.json`.
Open a popup from Today with `pg.get_by_role("button", name="Log a set of <name>")`. The dev server on http://localhost:20000 already serves this worktree; never start another. Missing states in the dev database (a figure exercise with a recording, a drill with a YouTube link, a lesson review, a routine exercise, a past day) are made through the app's own UI — never by touching `$DATA_DIR` from a spec.

## Review Focus

1. **Skip runs out the list before anything is logged** (session `ended`, not `justLogged`): the footer must still offer Log set for the skipped exercise, with the Session done card and Finish under it — not a dead popup and not a lost Log set. Pinned by `footerFor` tests in Task 1.
2. **Undo puts a set back on its own day:** a set back-filled to noon on Wednesday, deleted and undone, returns to Wednesday with its rating, note and run — not to "now". Pinned by `restoreSetFrom` tests in Task 2.
3. **Undo across the dance wall:** a `restoreSet` posted under `/salsa` carrying a bachata exercise's snapshot is refused with a 404 and inserts nothing. Pinned in `dance-wall.spec.ts`, Task 2.
4. **Out-of-range Minutes or Reps** ("700", "-1", "2.5"): the field turns red with "0–600" (or "0–10000") under it and nothing is posted. Pinned by `rangeError` tests in Task 1; screenshot in Task 6.
5. **A long Spanish name in the popup header with Skip and Details** ("Dile que no con vuelta · Doble con mano" in a session): the name wraps to two lines, Skip, Details and × stay 44 px and on screen. Screenshot check in Task 6.

---

### Task 1: The pure view models

**Files:**
- Create: `src/lib/exercises/log-view.ts`, `src/lib/exercises/exercise-page.ts`, `src/lib/video/caption.ts`
- Modify: `src/lib/exercises/session.ts` (`sessionSummary`), `src/lib/format.ts` (add `dayMonth`), `src/lib/video-prefs.ts` (add `RATE_LABEL`)
- Test: `src/lib/exercises/log-view.spec.ts`, `src/lib/exercises/exercise-page.spec.ts`, `src/lib/video/caption.spec.ts`, `src/lib/exercises/session.spec.ts`, `src/lib/format.spec.ts`, `src/lib/video-prefs.spec.ts`

**Interfaces:**
- Produces (`log-view.ts`, PURE, client-safe):
  - `type FooterInput = { session: { next: string | null; ended: boolean } | null; justLogged: boolean; busy: boolean; playing: boolean; backfill: boolean }`
  - `type MainState = 'log' | 'saving' | 'disabled' | 'logged'`
  - `interface FooterView { skip: boolean; main: { state: MainState; label: string } | null; hint: string | null; next: string | null; done: boolean }`
  - `footerFor(i: FooterInput): FooterView`
  - `rangeError(value: string, max: number): string | null` — `''` and integers `0..max` → `null`, anything else → `` `0–${max}` ``.
  - `nextRating(current: number | null, tapped: number): number | null`
  - `lastTimeParts(last: LastSet | null): { when: string; rating: number | null; note: string | null } | null` — `null` means "First time.".
- Produces (`exercise-page.ts`, PURE, client-safe):
  - `practisedLabel(totalS: number): string`
  - `summaryTiles(s: ExerciseSummary): { value: string; label: string; star: boolean }[]`
  - `historyDays(history: HistorySet[], timezone: string, today: string): { day: string; label: string; sets: HistorySet[] }[]`
  - `setTitle(s: { durationS: number | null; reps: number | null; rating: number | null }): { text: string; rating: number | null }`
  - `setMeta(s: HistorySet, timezone: string): string`
  - `ownerOf(c: PracticeContent): { kind: 'figure' | 'lesson' | 'routine'; id: number; title: string; meta: string; icon: IconName } | null`
  - `archiveBody(name: string, sets: number): string`
- Produces (`video/caption.ts`): `recordingCaption(r: RecordingRow, timezone: string): { title: string; meta: string }`; `lessonVideoCaption(index: number, v: LessonVideoRow): { title: string; meta: string }`.
- Produces: `dayMonth(day: string): string` (`2026-10-26` → `26 Oct`); `RATE_LABEL: Record<VideoRate, string>`; `sessionSummary(count, seconds)` now returns the card's second line only.

- [ ] **Step 1: Write the failing tests.**

```ts
// log-view.spec.ts — footerFor
const base = { session: null, justLogged: false, busy: false, playing: false, backfill: false };
const ses = (next: string | null, ended = false) => ({ next, ended });
expect(footerFor(base)).toEqual({ skip: false, main: { state: 'log', label: 'Log set' }, hint: null, next: null, done: false });
expect(footerFor({ ...base, backfill: true }).main).toEqual({ state: 'log', label: 'Add set to this day' });
expect(footerFor({ ...base, busy: true }).main).toEqual({ state: 'saving', label: 'Saving…' });
expect(footerFor({ ...base, playing: true })).toMatchObject({ main: { state: 'disabled', label: 'Log set' }, hint: 'Stop the count to log it.' });
expect(footerFor({ ...base, justLogged: true }).main).toEqual({ state: 'logged', label: 'Logged' });
expect(footerFor({ ...base, session: ses('Count drill · 3-2 clave') }).skip).toBe(true);
expect(footerFor({ ...base, session: ses('Count drill · 3-2 clave'), justLogged: true }))
  .toEqual({ skip: false, main: { state: 'logged', label: 'Logged' }, hint: null, next: 'Next: Count drill · 3-2 clave', done: false });
expect(footerFor({ ...base, session: ses(null), justLogged: true }))
  .toEqual({ skip: false, main: null, hint: null, next: null, done: true });
// Review Focus 1: Skip ran out the list, nothing logged yet
expect(footerFor({ ...base, session: ses(null, true) }))
  .toEqual({ skip: false, main: { state: 'log', label: 'Log set' }, hint: null, next: null, done: true });
// rangeError — Review Focus 4
expect(rangeError('', 600)).toBeNull();
expect(rangeError('600', 600)).toBeNull();
for (const bad of ['700', '-1', '2.5', 'e']) expect(rangeError(bad, 600)).toBe('0–600');
expect(rangeError('40', 10000)).toBeNull();
// nextRating
expect(nextRating(4, 4)).toBeNull();
expect(nextRating(null, 3)).toBe(3);
expect(nextRating(2, 5)).toBe(5);
// lastTimeParts
expect(lastTimeParts(null)).toBeNull();
expect(lastTimeParts(last({ daysAgo: 3, rating: 3, note: 'lost the count' })))
  .toEqual({ when: 'Last time: 3 days ago', rating: 3, note: 'lost the count' });
expect(lastTimeParts(last({ daysAgo: 0, rating: null, note: null }))?.when).toBe('Last time: Today');

// exercise-page.spec.ts
expect(practisedLabel(0)).toBe('0 min');
expect(practisedLabel(2700)).toBe('45 min');
expect(practisedLabel(15000)).toBe('4 h 10');
expect(practisedLabel(21900)).toBe('6 h 05');
expect(summaryTiles({ sets: 23, totalS: 15000, recentRating: 3.8 })).toEqual([
  { value: '23', label: 'sets', star: false },
  { value: '4 h 10', label: 'practised', star: false },
  { value: '3.8', label: 'recent rating', star: true }
]);
expect(summaryTiles({ sets: 1, totalS: 0, recentRating: null }).map((t) => [t.value, t.label]))
  .toEqual([['1', 'set'], ['0 min', 'practised'], ['–', 'recent rating']]);
expect(summaryTiles({ sets: 2, totalS: 60, recentRating: 4 })[2].value).toBe('4.0');
// historyDays: history arrives newest first (exerciseHistory orders doneAt desc)
const d = historyDays([at('2026-10-31', '19:42'), at('2026-10-31', '08:15'), at('2026-10-30', '20:00'), at('2026-10-27', '20:05'), at('2025-12-30', '18:00')], TZ, '2026-10-31');
expect(d.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Tuesday, 27 October', 'Tuesday, 30 December, 2025']);
expect(d[0].sets).toHaveLength(2);
// setTitle / setMeta
expect(setTitle({ durationS: 360, reps: null, rating: 4 })).toEqual({ text: '6 min', rating: 4 });
expect(setTitle({ durationS: 480, reps: 20, rating: null })).toEqual({ text: '8 min · 20 reps', rating: null });
expect(setTitle({ durationS: null, reps: null, rating: 3 })).toEqual({ text: '', rating: 3 });
expect(setTitle({ durationS: null, reps: null, rating: null })).toEqual({ text: 'Set', rating: null });
expect(setMeta(at('2026-10-31', '19:42', 'Turn felt late'), TZ)).toBe('19:42 · Turn felt late');
expect(setMeta(at('2026-10-31', '08:15'), TZ)).toBe('08:15');
// ownerOf
expect(ownerOf(figureContent)).toEqual({ kind: 'figure', id: 12, title: 'Enchufla · Doble', meta: 'Figure', icon: 'footprints' });
expect(ownerOf(lessonContent)).toMatchObject({ kind: 'lesson', title: 'Thursday class', meta: 'Lesson · 22 Oct 2026', icon: 'lessons' });
expect(ownerOf(routineContent)).toMatchObject({ kind: 'routine', meta: 'Routine', icon: 'route' });
expect(ownerOf(drillContent)).toBeNull();
// archiveBody
expect(archiveBody('Clave clapping · 2-3', 41)).toBe('Clave clapping · 2-3 leaves Today and every list. Its 41 sets are kept.');
expect(archiveBody('Hips', 1)).toBe('Hips leaves Today and every list. Its 1 set is kept.');
expect(archiveBody('Hips', 0)).toBe('Hips leaves Today and every list.');

// caption.spec.ts
expect(recordingCaption(rec({ kind: 'video', createdAt: noonOf('2026-10-26', TZ), sizeBytes: 12_500_000 }), TZ))
  .toEqual({ title: 'Recording · 26 Oct', meta: byteSize(12_500_000) });
expect(recordingCaption(rec({ kind: 'audio', createdAt: noonOf('2026-10-26', TZ) }), TZ).title).toBe('Audio · 26 Oct');
expect(lessonVideoCaption(0, vid({ sizeBytes: 740_000_000 }))).toEqual({ title: 'Video 1', meta: byteSize(740_000_000) });

// session.spec.ts — replaces the old sessionSummary case
expect(sessionSummary(3, 1500)).toBe('3 exercises, 25 min');
expect(sessionSummary(1, 0)).toBe('1 exercise');
expect(sessionSummary(0, 0)).toBe('Nothing logged');
// format.spec.ts
expect(dayMonth('2026-10-26')).toBe('26 Oct');
// video-prefs.spec.ts
expect(VIDEO_RATES.map((r) => RATE_LABEL[r])).toEqual(['¼×', '½×', '¾×', '1×']);
```

  (`at(day, hh:mm, note?)` builds a `HistorySet` with `doneAt` from `noonOf` shifted to that local time; `last`, `rec`, `vid` and the four `*Content` values are small local builders.)
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/exercises src/lib/video/caption.spec.ts src/lib/format.spec.ts src/lib/video-prefs.spec.ts` — Expected: FAIL (modules / exports missing; `sessionSummary` old strings).
- [ ] **Step 3: Implement.**
  - `footerFor` precedence for `main`: `busy` → saving; else `playing` → disabled (+ hint); else `justLogged` → logged; else log. `done = session !== null && (session.ended || (justLogged && session.next === null))`; `main = null` when `done && justLogged`; `skip = session !== null && !justLogged && !session.ended`; `next` only when `session && justLogged && !session.ended && session.next !== null`.
  - `historyDays`: group by `localDay(doneAt, tz)` in arrival order (the page's derivation, moved); label `Today` / `Yesterday` (via `daysBetween`), else `longDayLabel(day)`, plus `, <year>` when the year differs from `today`'s.
  - `setTitle`: `setSummary({ ...s, rating: null })` for the text (keeps its minute rounding); `'Set'` only when there is neither text nor rating.
  - `setMeta`: `timeOfDay(doneAt, tz)` then ` · <note>` when there is one.
  - `ownerOf`: figure → `figure.name`, "Figure", `footprints`; lesson → `lesson.title`, `Lesson · ${dateLabel(lessonDay)}`, `lessons`; routine → `routine.name`, "Routine", `route`; drill → `null`.
  - `practisedLabel`: under an hour `"<m> min"`; else `"<h> h <mm>"` with minutes padded to two digits.
  - `recordingCaption`: `"Recording · " + dayMonth(localDay(createdAt, tz))` ("Audio · …" for `kind: 'audio'`), meta `byteSize(sizeBytes)`.
  - `sessionSummary`: drop the "Session done — " prefix (the card's title says it); `0` → "Nothing logged". Update its comment. Today's page passes it through `SessionControls.summary` unchanged.
  - Header comments: `log-view.ts` — PURE, client-safe, "what the log popup shows"; `exercise-page.ts` — PURE, "what the exercise page shows".
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(logging): pure view models for the log popup and the exercise page`.

### Task 2: Undo a deleted set (server)

**Files:**
- Modify: `src/lib/types.ts` (add `SetSnapshot`), `src/lib/server/log-form.ts`
- Modify: `src/routes/[dance]/+page.server.ts`, `src/routes/[dance]/figures/[id]/+page.server.ts`, `src/routes/[dance]/lessons/[id]/+page.server.ts`, `src/routes/[dance]/exercises/[id]/+page.server.ts` (one `restoreSet` line each)
- Test: `src/lib/server/log-form.spec.ts`, `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Produces:
  - `interface SetSnapshot { exerciseId: number; doneAt: number; durationS: number | null; reps: number | null; rating: number | null; note: string | null; playerJson: string | null }` in `types.ts`.
  - `parseSetSnapshot(raw: string, now: number): SetSnapshot | null` (exported from `log-form.ts`; pure).
  - `deleteSetFrom` success now returns `{ action: 'deleteSet', ok: true, snapshot: string }` — the JSON of the removed row's `SetSnapshot`.
  - `restoreSetFrom(event: LogEvent)` — form field `snapshot`; success `{ action: 'restoreSet', ok: true }`; a malformed snapshot `fail(400, { action: 'restoreSet', message: 'That set could not be put back.' })`; an exercise of the other dance a 404 (`requireExerciseInDance`).
  - Action `restoreSet` on the four routes that host the log popup.

- [ ] **Step 1: Write the failing tests** in `log-form.spec.ts`:

```ts
describe('deleteSetFrom and restoreSetFrom', () => {
  it('hands back what it deleted, and Undo puts it back on its own day', async () => {
    const wed = noonOf('2026-10-28', TZ);
    const s = logSet(db, { exerciseId: drillId, doneAt: wed, durationS: 720, reps: 20, rating: 2, note: 'warm-up', playerJson: '{"bpm":180}' });
    const res = await deleteSetFrom(post('salsa', { setId: String(s.id) }));
    expect(getSet(db, s.id)).toBeNull();
    const snapshot = (res as { snapshot: string }).snapshot;
    await restoreSetFrom(post('salsa', { snapshot }));
    const back = db.select().from(sets).all();
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ exerciseId: drillId, doneAt: wed, durationS: 720, reps: 20, rating: 2, note: 'warm-up', playerJson: '{"bpm":180}' });
  });
  it('refuses a malformed snapshot and inserts nothing', async () => {
    const res = await restoreSetFrom(post('salsa', { snapshot: 'not json' }));
    expect(res).toMatchObject({ status: 400 });
    expect(db.select().from(sets).all()).toHaveLength(0);
  });
});
describe('parseSetSnapshot', () => {
  const ok = { exerciseId: 1, doneAt: 1_000, durationS: null, reps: null, rating: 4, note: null, playerJson: null };
  it('reads a whole snapshot', () => expect(parseSetSnapshot(JSON.stringify(ok), 2_000)).toEqual(ok));
  it.each([
    ['a rating of 6', { ...ok, rating: 6 }],
    ['a set in the future', { ...ok, doneAt: 10_000_000 }],
    ['no exercise', { ...ok, exerciseId: undefined }],
    ['a fractional duration', { ...ok, durationS: 1.5 }],
    ['an overlong note', { ...ok, note: 'x'.repeat(2001) }],
    ['an overlong run', { ...ok, playerJson: 'x'.repeat(4001) }]
  ])('refuses %s', (_, v) => expect(parseSetSnapshot(JSON.stringify(v), 2_000)).toBeNull());
});
```

  And in `dance-wall.spec.ts` (Review Focus 3), in the exercises block:

```ts
it('will not restore a set onto an exercise of the other dance', async () => {
  const snapshot = JSON.stringify({ exerciseId: bachataExerciseId, doneAt: 1_000, durationS: null, reps: null, rating: null, note: null, playerJson: null });
  const before = db.select().from(sets).all().length;
  await refuses(todayActions.restoreSet, post('salsa', { snapshot }));
  await refuses(exercisePage.actions.restoreSet, post('salsa', { snapshot }, String(salsaExerciseId)));
  expect(db.select().from(sets).all()).toHaveLength(before);
});
```

  (The page's own `[id]` is a salsa exercise, so only the snapshot's exercise is foreign.)
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/server/log-form.spec.ts src/routes/[dance]/dance-wall.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `parseSetSnapshot`: `JSON.parse` in a try; every field present; `exerciseId` a positive integer; `doneAt` an integer `> 0` and `<= now`; `durationS` null or integer `0..86400`; `reps` null or `0..10000`; `rating` null or `1..5`; `note` null or a string ≤ 2000; `playerJson` null or a string ≤ 4000 — the same limits `logSetFrom` applies. `deleteSetFrom` keeps the row `requireSetInDance` already returns and builds the snapshot from it before deleting. `restoreSetFrom` checks `requireExerciseInDance(getDb(), danceOf(params), snap.exerciseId)` before `logSet`. Comment on `restoreSetFrom`: the delete happened at once (spec "Additions"); Undo re-inserts the same values with the original instant — a new id, the same set; nothing is held back on the client. Add `restoreSet: (event) => restoreSetFrom(event)` beside each `deleteSet` line.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(logging): deleting a set hands back a snapshot; restoreSet puts it back`.

### Task 3: Shared pieces — Sheet props, Stepper, Slider, Stars, BottomBar

**Files:**
- Modify: `src/lib/components/ui/Sheet.svelte`, `src/routes/dev/kit/+page.svelte`
- Create: `src/lib/components/ui/Stepper.svelte`, `src/lib/components/ui/Slider.svelte`, `src/lib/components/ui/Stars.svelte`, `src/lib/components/ui/BottomBar.svelte`

**Interfaces:**
- Produces:
  - `Sheet` gains `subtitle?: Snippet` (a rich line under the title; wins over `sub`), `actions?: Snippet` (header controls between the title and ×), `tall?: boolean` (height fixed at `88dvh` so the footer sits at the bottom however short the body; the body ends in a 28 px fade from transparent to `--color-sheet`, `aria-hidden`, pointer-events none). With `subtitle`, the header aligns to the top (`items-start`, the title block `pt-2`, gap 4 between title and subtitle). The `toast` snippet now renders inside an absolute wrapper sitting 8 px above the footer (Sheet measures the footer with `bind:clientHeight`), or 16 px above the bottom without a footer; a `<Toast contained bottom="0">` goes in it. Behaviour (history stack, unsaved guard, Escape, backdrop) unchanged.
  - `<Stepper value: number (bindable) min: number max: number step?: number = 1 label: string unit?: string minusLabel?: string = 'Slower' plusLabel?: string = 'Faster' />` — to `kit.stepper`: the label 16/700 `text-ink` filling the row (`aria-hidden`; the input carries `aria-label={label}`), a 76 × 44 number pill (`bg-field`, radius 22, 18/800 tabular, centred, `inputmode="numeric"`), the unit 13/600 `text-muted`, then `iconButton('step')` − and + (icons `minus`, `plus` 20). − is disabled at `min`, + at `max`; a typed value is clamped into range and to `step` on `change`.
  - `<Slider value: number (bindable) min?: number = 0 max?: number = 1 step?: number = 0.05 label: string icon?: IconName = 'volume' valueText?: (v: number) => string oninput?: () => void />` — to `kit.slider(framed=False)`: icon 24 `text-muted`, a native `<input type="range">` (6 px track `hairline`, filled part `accent` via a `--fill` percentage gradient, 26 px white thumb with the kit's shadow, focus ring on the thumb), value text 15/700 `text-ink` right-aligned in 44 px. Default `valueText`: `Math.round(v * 100) + '%'`.
  - `<Stars rating: number size?: number = 14 />` — `role="img" aria-label="Rated {rating} of 5"`, `rating` filled `star` icons in `text-accent`, 1 px apart, `vertical-align: -2px`.
  - `<BottomBar children: Snippet />` — fixed to the bottom, full width, `bg-ground`, top border `hairline`, `pt-3 px-4`, bottom padding `calc(12px + env(safe-area-inset-bottom))`, content in the 560 px column, `z-20`. Callers add `pb-28` to their scroll content.

- [ ] **Step 1: Run** `timeout 600 nix develop -c npx vitest run` — Expected: PASS (baseline; these components carry no logic beyond clamping).
- [ ] **Step 2: Implement** the four components and the Sheet props. Check every other `Sheet` user still renders (all new props are optional).
- [ ] **Step 3: Gallery.** Add to `/dev/kit`: a Stepper at 180 BPM and one at its minimum (− disabled); a Slider at 80 %; Stars 1–5; a tall Sheet with a subtitle snippet ("Last time: 3 days ago · ★★★"), an `actions` snippet holding a "Details ›" link, a footer with a primary button, and a toast button that shows "Set deleted · Undo" inside it.
- [ ] **Step 4: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Look:** `FULL=1 $SHOTS/page.sh OUTDIR /dev/kit`, then open the tall sheet in a states script; compare the stepper, slider and sheet header with `kit.stepper`, `kit.slider` and the popup header in `s-logging-0.png`, light and dark. The toast must sit above the sheet's footer, not over Log set.
- [ ] **Step 6: Commit** `feat(ui): stepper, slider, stars, bottom bar; sheets get a rich subtitle, header actions and a tall size`.

### Task 4: Media and links in the new look

**Files:**
- Modify: `src/lib/components/ui/VideoFrame.svelte`, `src/lib/components/ui/SectionCard.svelte`, `src/lib/components/links/YouTubeCard.svelte`, `src/lib/components/links/LinkList.svelte`, `src/lib/components/links/LinksEditor.svelte`, `src/routes/dev/kit/+page.svelte`

**Interfaces:**
- Consumes: `RATE_LABEL` (Task 1), `iconButton`, `button`, `GROUP`, `LABEL`, `TEXTAREA`, `FIELD`, `FIELD_ERROR`, `Icon`.
- Produces:
  - `VideoFrame` gains `caption?: { title: string; meta?: string }`. Under the picture: with a caption, a row (`pl-3.5 pr-1.5 py-1.5`) of title 15/700 (one line, ellipsis) over meta 12 `text-muted`, and Full screen (`iconButton('bare')`, `expand` 22, `text-muted`, `aria-label="Full screen"`, only with `owner`) at its right; then the control row (`pl-2 pr-3 pb-2.5`): Mirror — a 44 px round toggle (`aria-pressed`, `aria-label="Mirror"`; on: `bg-accent-soft` with `mirror` 22 in `text-accent-text`; off: bare, `text-muted`) and the word "Mirror" 13/700 `text-muted` — a spacer, and the speed switch: `role="group" aria-label="Speed"`, a 36 px `bg-chip` pill track holding four 40 × 44 buttons (`aria-label="Speed 0.25×"`…, `aria-pressed`) each with a 36 × 30 inner pill showing `RATE_LABEL[r]` 13 px — selected `bg-surface` with a small shadow, 800 `text-ink`; others 700 `text-ink-2`. Without a caption Full screen moves into the control row before the spacer. "from YouTube ↗" stays under it (12 `text-muted`). The audio element keeps native controls. The card around it stays the caller's.
  - `SectionCard`: a `rounded-2xl bg-surface` row, min-h 64, `pl-3 pr-1.5`: the button part holds a 40 px `bg-accent` disc with the filled `play` 18 in `text-on-accent`, the title 16/700 (`spot.label` or the range) and the meta 13 `text-muted` (`<from> · <range>` when the spot has a label, else `<from>`); trailing: the `unlink` snippet when given, else `repeat` 20 in `text-chevron` (`aria-hidden`). A tap still opens `SectionPlayer`.
  - `YouTubeCard`: the thumbnail (16:9, a 52 px `bg-black/70` disc with the filled `play` icon in white) that becomes the embed; then a row `pl-3.5 pr-1.5 py-2`: title 15/700 (wraps) over a meta line — `youtube` 15 icon and "youtube.com", plus " · from m:ss" when `start` — 12 `text-muted`; the Mirror toggle as in `VideoFrame`; Open on YouTube as a 44 px `external` 22 `text-muted` link with `aria-label="Open on YouTube"`.
  - `LinkList`: `actions?: Snippet<[LinkRow, 'youtube' | 'web']>`. YouTube links first, each its own `overflow-hidden rounded-2xl bg-surface` card, 12 px apart, with `actions` (when given) in a footer row under a hairline (min-h 52, `pl-1 pr-1.5`, items right-aligned); then every other link in one `GROUP`: an `<a target="_blank" rel="external noopener noreferrer">` row (min-h 60) with a 40 px `bg-accent-soft` tile holding `link` 20 `text-accent-text`, title 16/700 (`title ?? host`), host 13 `text-muted`, and `external` 20 `text-chevron`; with `actions`, the snippet renders as a sibling after the `<a>` (split row) in place of the external icon. Unparseable stored URLs stay plain text.
  - `LinksEditor`: for `'youtube'` its actions are the Save video states exactly as now (plan 6 redraws them) then Remove as `button('danger-text', 'sm')` with `trash` 18 and the word "Remove", pushed right; for `'web'`, `iconButton('bare')` `text-muted` `trash` 20 with `aria-label="Remove <title ?? host>"`. The add form (still `use:guarded`, still keeps the typed text on failure): `<label class={LABEL}>Add links</label>` over the `TEXTAREA` (rows 2, placeholder "Paste YouTube or other links, one per line"); with `message`, the textarea gets `aria-invalid="true"` + `aria-describedby` and the message shows under it as `FIELD_ERROR` with `warning` 16 (the old red box goes); then a Title field (`LABEL` "Title" + " (optional)" 500 `text-muted`, `FIELD`, placeholder "For a single link", `maxlength="200"`); then `button('secondary', 'md', true)` with `plus` 20 "Add link". 14 px between them.

- [ ] **Step 1: Implement** the five components to `video_frame`, `section_card`, `yt_card`, `web_link`, `remove_button` and the add form in `drill_page_links` on the board.
- [ ] **Step 2: Gallery:** a `VideoFrame` with a caption (its source may be missing — the rows under the picture are what is checked), a `SectionCard` with and without unlink, a `LinkList` of one YouTube and one web link with and without `actions`.
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look:** `FULL=1 $SHOTS/page.sh OUTDIR /dev/kit /salsa/figures/<id with a recording> /salsa/lessons/<id with a video>` — the figure and lesson pages keep working with the new frame (their own cards are plan 4's and 6's). Compare the gallery with `s-logging-0.png` (the recording card) and `s-logging-3.png` (Drill page · links and sections), light and dark.
- [ ] **Step 5: Commit** `feat(ui): video frame, section card and links in the new look`.

### Task 5: The practice panel

**Files:**
- Modify: `src/lib/components/player/PracticePanel.svelte`, `src/lib/components/player/SourcePicker.svelte`, `src/lib/components/songs/LiveCount.svelte`, `src/lib/components/player/SongProgress.svelte` (tokens only), `src/lib/components/player/CountChips.svelte`, `src/lib/components/player/ClaveChips.svelte` (gap only)

**Interfaces:**
- Consumes: `Segmented`, `Stepper`, `Slider` (Task 3), `Banner`, `Spinner`, `Icon`, `iconButton`, `button`, `CHIP`, `LABEL`, `FIELD_ERROR`.
- Produces: `PracticePanel`'s props and events unchanged (`onrun`, `onactive`). `SourcePicker`'s props unchanged; its look changes for the Practice page too.

- [ ] **Step 1: Folded** (to `panel_card` + `panel_head`): `<section aria-label="Practice">` `bg-surface`, radius 18, padding `12px 12px 14px 16px`, gap 12. Head: a `<button aria-expanded>` (min-h 48, flex-1) holding "Practise with" (13/700 `text-muted`) over the summary (15/700 `text-ink`, wraps — no truncation) and `chevron-down` / `chevron-up` 20 `text-muted`; beside it Play: `iconButton('filled')` resized to 52 px, filled `play` 24, `aria-label="Play"`, disabled when `!canPlay`; while `starting` a `<Spinner>` replaces the glyph and the button stays 52 px. Before ▶ with a song, `SongProgress` still shows under the head.
- [ ] **Step 2: Banked time and errors.** When `watch.bankedMs > 0` and not running: a strip `bg-done-soft` radius 12, `px-3 py-[9px]`, `clock` 18 and "<m:ss> practised — Play carries on" 13/700 `text-done`. The song-gone notice becomes `<Banner kind="warning" title="Its song is not ready">Pick another, or use the count.</Banner>`; `startError` becomes `<Banner kind="error" title={startError}>`.
- [ ] **Step 3: Opened** (to `panel_settings`): under a hairline (`border-t border-hairline pt-3`), groups 12 px apart, each a 13/700 `text-muted` label 4 px over its control. `SourcePicker`: Source becomes `<Segmented label="Source" name="{name}-source" items={[{ value: 'count', label: 'Count only' }, { value: 'song', label: 'A song' }]}>` (neutral, still only when there are songs); count → `<Stepper label="Tempo" unit="BPM" min={60} max={300} step={5} bind:value={bpm}>`; song → the song field (`SongPicker`, unchanged) with `song.error` under it as `FIELD_ERROR` + `warning` 16, then Speed chips. Voice count (`CountChips`), Clave (`ClaveChips`, only when `dance.clave`), Call it on cue (Off · Every 2 · Every 4, figure only) as `CHIP` radios, 6 px apart, wrapping (`gap-1.5` in the two chip components).
- [ ] **Step 4: Running** (to `panel_running`), gap 10: `LiveCount` — restyle the component itself: `font-display` 800, 92 px, `leading-[0.95]`, tabular; 1 `text-accent`, 5 `text-ink`, others `text-ink-2`; eight 12 px dots 7 px apart, 10 px under the number — current dot `bg-accent` on 1 else `bg-ink`, others `bg-hairline` on 4 and 8 and `bg-field-line` elsewhere. Under it "<m:ss> · <summary>" 13/700 `text-muted` tabular, centred; `SongProgress` with a song (swap `bg-rule` for `bg-hairline`, labels 12/700); a two-column grid, 8 px gap: `button('secondary', 'md', true)` Pause (`pause` icon) / Resume (`play`) and `button('primary', 'md', true)` Stop (`stop`); then "Voice volume" (13/700 `text-muted`) over `<Slider label="Voice volume" bind:value={voiceVolume} oninput={() => player?.setVoiceVolume(voiceVolume)}>`. Keep every comment in the script (the iOS gesture rule, `destroyed`, the look-ahead).
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look** in the popup (Task 6's `logging-states.py` does not exist yet; open a figure exercise's page with `?log=1` in a small script): folded, opened, playing (click Play, wait 1 s), stopped (banked strip). Compare with "Figure popup · as it opens", "Practice panel · opened", "Practice panel · running" in `s-logging-0.png`, light and dark; check `/salsa/player` still works with the new `SourcePicker` (its layout is plan 9's).
- [ ] **Step 7: Commit** `feat(logging): the practice panel in the new look`.

### Task 6: The log popup — shell, form, footer, sets with Undo

**Files:**
- Modify: `src/lib/components/exercises/LogShell.svelte`, `src/lib/components/exercises/SetList.svelte`, `src/lib/components/exercises/LastTime.svelte`
- Create: `src/lib/components/exercises/RatingStars.svelte`, `src/lib/components/exercises/restore-set.ts`
- Delete: `src/lib/components/exercises/RatingChips.svelte`

**Interfaces:**
- Consumes: `footerFor`, `rangeError`, `nextRating`, `lastTimeParts`, `setTitle`, `setMeta` (Task 1); `deleteSet` → `snapshot`, `restoreSet` (Task 2); `Sheet` (`tall`, `subtitle`, `actions`, `footer`, `toast`), `Stars`, `Toast`, `Banner`, `Spinner` (Task 3); `longDayLabel`, `clock`.
- Produces:
  - `<RatingStars question: string value: number | null onchange: (v: number | null) => void />` — `fieldset`/`legend` (13/700 `text-ink-2`), hidden `rating` input, five `flex-1` buttons 52 px tall, radius 14, 6 px apart, `aria-label="n of 5"`, `aria-pressed={value === n}`; filled up to `value`: `bg-accent-soft` with the filled `star` 26 in `text-accent`; after: `bg-surface` with the outline star in `text-chevron`; under them, while `value !== null`, "<value> of 5 · tap it again to clear" 12/700 `text-muted`. Taps go through `nextRating`.
  - `<SetList sets: HistorySet[] timezone: string ondeleted: (snapshot: string) => void onfailed: (message: string) => void />` — one `GROUP`; each `<li>` min-h 60, `pl-4 pr-1.5`: title 16/700 = `setTitle` text then `<Stars rating size={14}>`, meta 13 `text-muted` one line = `setMeta`; trailing `iconButton('bare')` `text-muted` `trash` 20 `aria-label="Delete set logged at <hh:mm>"` in a `use:enhance` form to `?/deleteSet`. The row hides at submit; on success `ondeleted(result.data.snapshot)`; on failure it shows again and `onfailed(message)`.
  - `restoreSet(snapshot: string): Promise<boolean>` (`restore-set.ts`, client side, like `fetch-practice.ts`) — POSTs `snapshot` to `?/restoreSet` of the current page (`fetch` with `x-sveltekit-action: true`, `deserialize`), then `invalidateAll()`; `true` on success.
  - `LastTime` renders `lastTimeParts`: "Last time: 3 days ago · <Stars size 13> · “note”" or "First time." — 13 px `text-muted`, used as the Sheet's subtitle.

- [ ] **Step 1: The sheet.** `LogShell` renders `<Sheet tall title={exercise.name}>` with: `subtitle` — `LastTime` once the payload is there, a 190 × 10 `bg-skeleton` bar (radius 5) while loading, nothing after a load error; `actions` — in a session while `view.skip`, a Skip button (44 px, `px-2.5`, "Skip" 15/800 `text-accent-text` + `chevron-right` 18), calling `away(session.onskip, 'Skip')` as now; then "Details" + `chevron-right` 18 (15/800 `text-accent-text`, 44 px, `aria-label="Details and settings"`) linking to the exercise page — not rendered when the popup is open on that page itself (`page.url.pathname` equals its href). The old "Details and settings →" link and the old Skip row go.
- [ ] **Step 2: The body**, a column with 12 px gaps: a back-filled day first — a strip `bg-accent-soft` radius 14, `px-3.5 py-2.5`, `calendar` 20 and "Adding to {longDayLabel(backfillDay)}" 14/800 `text-accent-text`; then the type's `body` snippet once loaded; while loading (to `loading` on the board) three bars (92 %, 80 %, 56 % × 12, radius 6) in an `aria-busy` block with a visually hidden "Loading", a 150 px `bg-skeleton` block radius 16, one skeleton row; after a load error `<Banner kind="error" title="Could not load this exercise’s details.">You can still log a set.</Banner>`. The form stays usable in all three.
- [ ] **Step 3: The form** (same `use:guarded` options, hidden inputs and `submit` callback as now, plus `novalidate`): Minutes — `LABEL` over a `FIELD` box with the input and a "min" suffix (15/600 `text-muted`) inside it; while `exactS !== null` the helper "From the practice: {clock(exactS)}" 13 `text-muted` under it; Reps beside it in a two-column grid (12 px gap) when the type has reps. `rangeError(minutes, 600)` / `rangeError(reps, 10000)` set `aria-invalid` and show as `FIELD_ERROR` + `warning` 16 under their field; the `submit` callback calls `cancel()` while either is non-null (Review Focus 4). `RatingStars` with `info.ratingQuestion`. Note — `LABEL` "Note" + " (optional)" 500 `text-muted`, `TEXTAREA` rows 2, placeholder "What went well, what to fix", `maxlength="2000"`. The server's `message` as `<Banner kind="error" title={message}>` after the note. Then, under "Sets today" (or "Sets that day" when back-filling) as `SECTION_LABEL`, the `SetList`.
- [ ] **Step 4: The footer** from `view = $derived(footerFor({ session: session && { next: session.next?.name ?? null, ended: session.ended }, justLogged, busy, playing, backfill: backfillDay !== null }))`: `main` `log` → `<button type="submit" form=… class={button('primary','md',true)}>` with `check` 22 and the label; `saving` → the same button `aria-busy` and disabled, a `<Spinner>` and "Saving…", width kept; `disabled` → disabled with no icon, then `view.hint` centred 13/700 `text-muted`; `logged` → a submit button `bg-done-soft text-done` 52 px pill, `check` 22 (stroke 2.5) and "Logged" (still logs another set when tapped, as today). `view.next` → `button('secondary','md',true)` "{view.next}" + `chevron-right` 20, `onclick={session.onnext}`. `view.done` → a `role="status"` card (`bg-done-soft`, radius 16, `px-3.5 py-3`, gap 10): the filled `check-circle` 28 in `text-done` (`--icon-knockout: var(--color-on-done)`), "Session done" 15/800 `text-ink` over `session.summary` 13/700 `text-done`; then `button('primary','md',true)` "Finish" → `session.onfinish`. The submit button sits in the footer, outside the `<form>`, so it uses `form="log-<exercise.id>"`.
- [ ] **Step 5: Undo.** `LogShell` keeps `toast` state and renders `<Toast contained bottom="0">` in the Sheet's `toast` snippet: `ondeleted` → `{ message: 'Set deleted', action: 'Undo' }`, its action → `restoreSet(snapshot)`, then `load()` (the subtitle's "Last time" may change) — on `false`, "Could not put the set back." without an action; `onfailed(message)` → that message without an action. A delete also calls `load()`.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** Create `$SHOTS/logging-states.py` from `sheet.py`. Shots, light and dark: a drill's popup as it opens (Today → "Log a set of <drill>"); after typing Minutes 700 and tapping Log set (field error, nothing posted — check the Sets today count is unchanged); a rating chosen (hint line); after a log (Logged, form cleared, the set under Sets today); the trash tapped (row gone, "Set deleted · Undo" above the footer) and Undo tapped (row back with its time); a session (`/salsa?session=1`): Skip in the header, after a log "Logged" + "Next: …", and the last one's Session done card + Finish; a past day (`/salsa?day=<yesterday>` → a group's "+"): the "Adding to …" strip and "Add set to this day"; the network blocked for `**/practice` (`page.route(..., lambda r: r.abort())`) for the error banner, and delayed 2 s for the skeleton. Unsaved changes: Play then Stop on a figure (banked time), press × (Save · Stay · Close without saving); Play again and press × while it runs (Save disabled, "Stop the count to log it."). Review Focus 5: rename a custom exercise to "Dile que no con vuelta · Doble con mano", start a session with it first, screenshot the header. Compare with `s-logging-1.png` (loading, saving, logged) and `s-logging-2.png` (error, back-filling, session next / done, unsaved changes).
- [ ] **Step 8: Commit** `feat(logging): the log popup's shell, stars, footer, and Undo for a deleted set`.

### Task 7: Each type's popup content

**Files:**
- Modify: `src/lib/components/exercises/kinds/index.ts` (`ContentProps`), `kinds/figure/Log.svelte`, `kinds/figure/Content.svelte`, `kinds/drill/Log.svelte`, `kinds/drill/Content.svelte`, `kinds/lesson/Log.svelte`, `kinds/lesson/Content.svelte`, `kinds/routine/Log.svelte`, `kinds/routine/Content.svelte`

**Interfaces:**
- Consumes: `VideoFrame` `caption`, `SectionCard`, `LinkList`, `LinksEditor` (Task 4); `recordingCaption`, `lessonVideoCaption` (Task 1); `PracticePanel` (Task 5); `LogShell` (Task 6).
- Produces: `ContentProps` gains `timezone: string` (for captions) and `onPage?: boolean` — rendered on the exercise page: section labels, and the figure's "Edit links on the figure page" link. `editLinks` keeps its meaning (only the drill honours it). Every `Content` is a column with 12 px gaps; prose is `LinkedText` 15/500 `text-ink-2`, `leading-[1.45]`, `px-1`.

- [ ] **Step 1: Figure** (to `figure_reference`). `figure/Log.svelte`: a section label row — "Reference" (`SECTION_LABEL`) with the toggle as its trailing control: a 32 px button "Hide" + `chevron-up` 18 / "Show" + `chevron-down` 18, 14/800 `text-accent-text`, `aria-expanded`, `aria-controls` → the content's id (open by default, as now). `figure/Content.svelte`: notes; each recording as an `overflow-hidden rounded-2xl bg-surface` card holding `VideoFrame` with `caption={recordingCaption(rec, timezone)}` (broken files keep their two messages, 13 `text-muted`, `p-4`); the sections as `SectionCard`s; then `LinkList`. On the page (`onPage`): the "Reference" label above (no toggle) and, last, an `<a>` to the figure "Edit links on the figure page" + `chevron-right` 18, 14/800 `text-accent-text`. The empty message stays ("No notes, recordings, sections or links yet — add them on the figure page."), 13 `text-muted`. Then the panel, as now.
- [ ] **Step 2: Drill** (to `drill_content`; on the page, `drill_page_links` and `empty_history`). In the popup: notes, `LinkList` (YouTube cards, then the web-link group), the sections. On the page: "Description" label over the notes (when there are notes); "Sections" label over the section cards (each with the unlink form as now: `iconButton('bare')` `close` 20 `text-muted`, `aria-label="Unlink this section"`), the unlink refusal as `FIELD_ERROR`, then the "Link a section…" opener — a 48 px full-width `bg-surface` radius 16 button, `link` 20 and the text 15/800 `text-accent-text`, `aria-haspopup="dialog"` (opens `LinkSectionSheet`, unchanged); then "Links" label over `LinksEditor`. The panel (song or count) as now.
- [ ] **Step 3: Lesson review** (to `lesson_review`) — order: the lesson as a link card (`bg-surface` radius 16, `pl-3 pr-3.5 py-2.5`: a 40 px `bg-accent-soft` radius 12 tile with `lessons` 20 `text-accent-text`; title 16/700; meta 13 `text-muted` "{longDayLabel(lessonDay)} · {n} video(s)"; `chevron-right` 20 `text-chevron`); the notes; "Figures" label over the figure chips (links; 36 px pills `bg-chip text-chip-ink` 14/600 with `chevron-right` 16 `text-muted`, 8 px apart, wrapping) — before the links and the videos (spec); `LinkList`; each video in a card with `VideoFrame caption={lessonVideoCaption(i, video)}`. No panel.
- [ ] **Step 4: Routine** (to `routine_popup`): the notes; the slots as an `<ol>` inside a `GROUP`, each `<li>` min-h 52 `px-4` with a 28 px `bg-chip` circle holding the number (13/800 `text-ink-2`, tabular), the names joined " / " 16/700, the slot note under it 13 `text-muted`. `routine/Log.svelte` (not when back-filling): `<a class={button('secondary','md',true)}>` with `play` 20 "Practise in player" (same href with `routine` and `exercise`), then "A run there saves itself. Log here when you practised away from the app." 13 `text-muted`, `px-1`, 4 px closer.
- [ ] **Step 5: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 6: Look** with `logging-states.py`: a figure popup (reference open; Hide; the panel), a drill popup, a bachata drill popup with the count running, a lesson review, a bachata routine. Compare with "Figure popup", "Drill popup", "Drill popup · song running", "Lesson review popup", "Routine popup" in `s-logging-0.png` and `s-logging-1.png`, light and dark. Check the figure page's own Practice popup and the lesson page's review popup still open and log.
- [ ] **Step 7: Commit** `feat(logging): figure, drill, lesson and routine popups in the new look`.

### Task 8: The exercise page, and the docs

**Files:**
- Modify: `src/routes/[dance]/exercises/[id]/+page.svelte`
- Modify: `CLAUDE.md` (Layout: `src/lib/exercises/` entry), `docs/superpowers/specs/2026-10-31-redesign-design.md` (one line under "Logging a set and the exercise page" on edit mode), `docs/superpowers/specs/2026-09-28-exercise-types-design.md` (the popup's footer and Undo)

**Interfaces:**
- Consumes: `summaryTiles`, `historyDays`, `ownerOf`, `archiveBody` (Task 1); `restoreSet` action (Task 2); `BottomBar`, `Stars`, `Toast`, `Dialog`, `Switch`, `Banner`, `EmptyState`, `Screen`, `BandButton`, `FrequencyField` (plan 2), `SetList`, `restoreSet()` (Task 6); `contentFor` with `onPage` (Task 7); `leaveOrAsk`, `guarded`.

- [ ] **Step 1: The band.** `<Screen compact title={exercise.name} subtitle={TYPES[type].label}>`. Not editing: `left` = `BandButton icon="back" label="Back to Today"` → `/[dance]`; `right` = `BandButton icon="pencil" label="Edit settings"` → `editing = true`. Editing: `left` = `BandButton icon="close" label="Stop editing"` → `leaveOrAsk(settingsForm, () => (editing = false), 'Stop editing')`; no `right`. Delete the old sticky header.
- [ ] **Step 2: Reading** (to `exercise_page_top` / `exercise_page_history`), sections 14 px apart, the content `pb-28`: the owner row when `ownerOf(data.practice.content)` is not null — a one-row `GROUP`, an `<a>` (min-h 60) with a 40 px `bg-accent-soft` radius 12 tile (its icon 20 `text-accent-text`), title 16/700, meta 13 `text-muted`, `chevron-right` 20 `text-chevron`, href by kind; then `<Content onPage …>` (with `editLinks` as now, plus `timezone`); then "History": when `data.summary.sets === 0`, a `bg-surface` radius 16 card holding `<EmptyState icon="clock" title="Nothing logged yet" body="Log a set after you practise — it shows up here, grouped by day.">`; otherwise the tiles — one `bg-surface` radius 16 card, three equal columns split by 1 px `bg-hairline` rules inset 12 px top and bottom, each `px-3.5 py-3`: value `font-display` 24/800 (`star` filled 20 `text-ink` after it when `star`), label 12/700 `text-muted` — then for each `historyDays(...)` group its label (`SECTION_LABEL`) and a `SetList`, and "Showing the latest {n}." (12 `text-muted`) when `history.length < summary.sets`; then "Settings": a `GROUP` of plain rows (min-h 56) — "How often" with `frequencyLabel(everyDays)` right-aligned 15/600 `text-muted`; "Active" with "Yes" / "No — not on Today's list"; and, when there are notes and the type is not a drill, "Practice notes" with the notes under it (`LinkedText`, 15 `text-ink-2`).
- [ ] **Step 3: Editing** (to `drill_page_settings`): only the "Settings" label and a `bg-surface` radius 16 card (padding 16, fields 14 px apart) holding the form (`id="exercise-settings"`, `action="?/update"`, `use:guarded` with label "Exercise settings" and the same `submit`, plus `editing = false` after a success): Name (drills only; `FIELD` on `bg-field`, `required`, `maxlength="200"`); `<FrequencyField name="everyDays" bind:value={everyDays}>`; the Active row — "Active" 16/700 over "Show it in the to-do list" 13 `text-muted`, `<Switch name="active" label="Active" bind:checked={active}>` at its right; "Description" (drill) / "Practice notes" (`TEXTAREA` rows 3, `maxlength="2000"`, on `bg-field`); the `update` failure as `<Banner kind="error">` at the top of the card. Under the card, drills only, a centred `button('danger-text')` "Archive exercise" opening `<Dialog title="Archive this drill?" body={archiveBody(exercise.name, data.summary.sets)}>` with `button('tertiary','sm')` "Cancel" and, in a `use:enhance` form to `?/archive`, `button('danger','sm')` "Archive" (the archive failure, if any, as `FIELD_ERROR` under the button).
- [ ] **Step 4: The pinned bar.** `<BottomBar>` holds, reading: `button('primary','md',true)` with `plus` 20 "Log a set" → `logging = true`; editing: `<button type="submit" form="exercise-settings" class={button('primary','md',true)}>Save</button>` (`aria-busy` + `<Spinner>` while saving, width kept). `?log=1` still opens the popup on load.
- [ ] **Step 5: Undo on the page.** A page-level `<Toast>` with `bottom="calc(5.75rem + env(safe-area-inset-bottom))"` (above the bar); both `SetList`s on the page (history) feed it as in Task 6, and Undo calls `restoreSet()`. The popup opened from the page keeps its own toast inside its sheet.
- [ ] **Step 6: Docs.** `CLAUDE.md` Layout, `src/lib/exercises/` entry: add "what the log popup shows (log-view.ts: the footer's states, range errors, the rating toggle) and the exercise page (exercise-page.ts)"; add `src/lib/video/caption.ts` to the `src/lib/video/` entry. Redesign spec, under "Logging a set and the exercise page": one line — "Settings are read on the page and edited behind the band's pencil (× Stop editing, Save pinned), as every other edit screen." Exercise types spec, under the log popup: the footer's states (Log set / Saving… / Logged / Next / Session done + Finish), and that a deleted set comes back with Undo through `restoreSet` (same instant, new id).
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** `FULL=1 $SHOTS/page.sh OUTDIR /salsa/exercises/<figure exercise> /salsa/exercises/<drill with a link and a section> /bachata/exercises/<new drill with no sets>`, then in `logging-states.py`: the pencil (edit mode: × on the band, Save pinned, the drill's Name and Archive); type in Description and press × (Unsaved changes); Archive exercise (the dialog; Cancel); add a link with a bad line ("www salsa clave": the error under Add links, the text kept); delete a history set (toast above the bar, Undo brings it back); `?log=1` (popup opens, no Details link in its header). Compare with "Exercise page · figure", "… · history and settings", "Drill page · links and sections", "Drill page · settings", "Archive · confirm", "Exercise page · empty history" in `s-logging-2.png` / `s-logging-3.png`, light and dark — the board's inline Settings card is this plan's edit mode (see Calls).
- [ ] **Step 9: Commit** `feat(logging): the exercise page in the new look; docs`.

---

## Calls made in this plan

- **The exercise page's settings sit behind the band's pencil**, not inline as the board draws them ("Save settings" inside the card). The controller's scope and the spec's pattern ("Edit is a pencil on the band … one Save") both say pencil; the board's Settings card is drawn as the edit mode, and the read mode shows How often / Active / Practice notes as plain rows. Cost if wrong: switching Active takes three taps instead of one; reverting is one task's markup (the form already exists).
- **Edit mode shows only the settings** (and Archive for a drill), not the history or links under them — one job per mode, and the pinned bar can hold Save without a second Log a set. If wrong: render the reading sections under the form.
- **Undo is a server round trip** (`deleteSet` returns a snapshot, `restoreSet` re-inserts it with the same instant and a new id), not a delete held back on the client for six seconds: a held delete is lost or fired late when the page closes, and the routine editor's Undo already works this way. Cost: the set's id changes; nothing refers to a set id.
- **The toast reads "Set deleted · Undo"**, naming what went, as the routine editor's "Slot 4 deleted" does (the spec's "Deleted · Undo" is the pattern, not the copy). Failures: "Could not put the set back." / the server's "That set was already removed.".
- **Skip running out the list keeps Log set** in the footer above the Session done card and Finish: the user may still log the exercise they skipped (today's popup allows it). The board only draws Session done after a final log, where Log set is gone.
- **`sessionSummary` returns only the card's second line** ("3 exercises, 24 min", "1 exercise", "Nothing logged"); "Session done" is the card's fixed title. Today passes the string through unchanged.
- **A remembered song that is no longer ready still falls back to the count** (Play enabled), as `practiceStart` does today; only the notice changes (a warning banner, panel opened). The board's caption ("Play disabled until a song or the count") is read as describing a song source with no song, which is already disabled.
- **The panel's Stop is primary (accent)** as the board draws it; the Practice page's "soft danger" Stop is plan 9's.
- **Tempo steps by 5 BPM** in the stepper (60–300); a typed value is kept exactly (clamped to range and to the step). If wrong: one prop.
- **Shared pieces restyled here, used by other areas' pages:** `VideoFrame` (new optional `caption`), `SectionCard`, `YouTubeCard`, `LinkList`, `LinksEditor`'s add form and Remove, `LiveCount` (font and dot tokens), `SongProgress` (token names), `SourcePicker` (Source as a Segmented, Tempo as a Stepper — the Practice page gets the same; plan 9 may move Source to the band). The YouTube Save video / saving / failed states are left for plan 6.
- **New shared components:** `Stepper`, `Slider` (both needed again by Practice and My count), `Stars`, `BottomBar` (every edit screen's pinned Save); `Sheet` gains `subtitle`, `actions`, `tall`, and places its `toast` above its footer.
- **YouTube cards come before web links** in `LinkList` (the board's order; web links share one group card). Within each kind the order is as stored.
- **Recording captions** are "Recording · 26 Oct" over the file size (the board's "Filmed after class" has no data behind it); lesson videos are "Video n" over the size. `dayMonth` joins `format.ts` for the short date.
- **Minutes and Reps are checked on the client** (`rangeError`, `novalidate`, the submit cancelled), with the error under the field as the board draws it; the server's own check and message stay.
- **The Details link hides when the popup is open on the exercise page itself** (it would link to the page underneath).
- **History day labels** are "Today", "Yesterday", then "Tuesday, 27 October" (with ", 2025" for another year); the old "Tue 27 Oct" labels go.
- **The exercise page's back goes to Today**, as now, wherever it was opened from.
- **"Edit links on the figure page ›"** appears on a figure exercise's page (board), and nowhere else; the owner row is the way to a lesson or routine.
- **The owner row** is "<owner name>" over "Figure" / "Lesson · 22 Oct 2026" / "Routine" (board) rather than the spec's one-line "Figure · Enchufla".
- **The lesson review's subtitle line** under the lesson's title is "<Weekday, d Month> · n videos" (board), from data the payload has.
