# Redesign: Lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the Lessons tab (the library grouped by month, its empty state and the New
lesson sheet) and a lesson's page (compact band, notes, the review exercise, videos with
their sections and the chunked upload, links, and the figures, routines and exercises that
reach it) in the new look, with every `confirm()` turned into a kit dialog.

**Architecture:** Both routes keep their URLs, loads and actions. Every line of copy that
depends on data (the month groups, the date tile, "3 videos · 1.2 GB", the three counts,
"via 2 sections", the row metas, the delete and unlink questions, the upload card's states)
is a pure function in `src/lib/lessons/` or `src/lib/upload-queue.ts` with a spec; the
pages only lay them out. The load gains one thing (`everyDays` on linked routines and
exercises, for their meta line); the create and edit refusals name the field they are about.
Shared pieces built by plan 5 (`UploadButton`'s card, `VideoFrame`'s `action`,
`VideoSections`, `LinksEditor`'s Save video states) are reused; the two pieces both areas
now draw — the upload card and the broken-video card — become small shared components.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node only), Drizzle/SQLite
(no schema change).

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Lessons", "Patterns used
across screens", "Calls made while writing this" (lesson page order). Board source:
`docs/superpowers/design-kit/screens/lessons.py`; previews `s-lessons-r0c0.png` …
`s-lessons-r6c2.png` in the scratchpad `previews/` folder (row r, column c = the 19 screens
in `SCREENS` order, three per row). Lessons: `docs/superpowers/specs/2026-09-23-lessons-design.md`
(chunked upload, link rules); `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`
(what reaches a lesson through its sections is derived, never stored).

**This is plan 7 of 13.** All plans land on branch `app-icons`, deployed once when the last
is done. It builds on the foundation (plan 1) and reuses, without re-creating: plan 2's
`SELECT` and `FrequencyField`; plan 3's `Sheet` (`sub`/`footer`), `BottomBar`, `VideoFrame`
(`caption`), `LinksEditor`'s add form, `lessonVideoCaption`, the log popup and its
`restoreSet` action on this route; plan 4's `FieldError`, `plural`
(`src/lib/moves/plural.ts`), `FigureFields` (`errors`); plan 5's `VideoFrame` `action`,
`UploadButton` card and `kind`, `AppUploadLink` `kind`, `VideoSections` restyle,
`sectionMeta`, `uploadProblem`, `LinksEditor` Save video states. **Plan 5 must be complete
(its Tasks 5–6) before Task 4 here starts.** Out of scope: the Link popup and the shared
`Picker`/`PickerField` look (plan 8), the full-screen video player (plan 11), the share
page's "Add to a lesson" (plan 12).

**Screenshots.** `SHOTS=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/tools`.
Plain pages: `$SHOTS/page.sh OUTDIR /salsa/lessons /bachata/lessons/<id>` (`FULL=1` for the
full page; light and dark come out side by side). States behind a tap: copy `$SHOTS/sheet.py`
to `$SHOTS/lessons-states.py` (Task 2 creates it; later tasks add to it) and run it with
page.sh's wrapper:
`env -u LD_LIBRARY_PATH PLAYWRIGHT_BROWSERS_PATH=/nix/store/wzfqrpwxk230xqjl1z27h7lis19gjs4f-playwright-browsers timeout 240 nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (p: [p.playwright])' -c python3 -I $SHOTS/lessons-states.py OUTDIR $SHOTS/state.json`.
Test videos (scratchpad only, never committed):
`timeout 120 nix shell nixpkgs#ffmpeg -c ffmpeg -y -f lavfi -i testsrc=duration=60:size=1280x720:rate=30 -pix_fmt yuv420p -b:v 3M <scratchpad>/clip.mp4`
(≈ 22 MB: three 8 MiB chunks). Pick lesson ids from the dev database; add sections in the
full-screen player (Section) and link one through the link button.

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

- URLs, every action name (`create` on the list; `update`, `archive`, `log`, `deleteSet`, `restoreSet`, `newFigure`, `newVariation`, `newExercise`, `newRoutine`, `linkFigure`, `unlinkFigure`, `linkRoutine`, `unlinkRoutine`, `linkExercise`, `unlinkExercise`, `deleteVideo`, `addLink`, `deleteLink`, `saveVideo`, `retryVideo` on the page), every form field name, and the chunk protocol (`PUT /api/lessons/[id]/videos/[uploadId]`, `content-range`, 409 + `x-received-bytes`, 8 MiB chunks, one file at a time) stay as they are.
- What reaches a lesson through its videos' sections is derived by `getLesson`, never stored; unlinking such a row takes its section links too, and always asks first.
- Lesson page order (reading): notes → the review exercise → Videos → Links → Figures → Routines → Exercises.
- The Lessons list is a main screen (tab bar, full band); a lesson is pushed (compact band, back chevron, no tab bar). Edit is the band's pencil: × "Stop editing" (asks if unsaved, via `leaveOrAsk`) and one Save pinned in a `BottomBar`.
- Every former `confirm()` is a kit `Dialog`: delete a video, archive the lesson; unlinking a row that comes through a section is one too.
- Small accent text is `text-accent-text`, never bare `text-accent` (the foundation's carried item). Danger only for what destroys (delete video, archive, Unlink in the dialog); a zero count is `text-muted`, never faded with opacity.
- Rows: a row is a link (chevron) or holds one button; a linked item is a split row (text is the link, its buttons are siblings).
- Dates on screen go through `src/lib/format.ts`, never `toLocaleDateString`.
- Shared components touched here keep every existing prop and default; additions are optional.

## Review Focus

1. **A chunk drops mid-batch:** the upload card turns warn ("Connection dropped — retrying", the percent held, not reset), goes back to accent on the next good chunk, and a file that fails for good is named in the summary while the files behind it still go up. Pinned by the `uploadCard` / `summaryTitle` tests in Task 1 and the aborted-chunk screenshot in Task 5.
2. **Deleting a video whose sections are linked:** the trash shows the refusal on the card at once (no "Delete?" first), naming what to unlink exactly as the server would ("Linked to A, B (archived) — unlink it first."); with only unlinked sections the dialog counts them; a link made meanwhile in another tab still lands in the same banner. Pinned by the `deleteBlock` / `deleteVideoBody` tests in Task 1 and the dialog screenshots in Task 4.
3. **A variation on the lesson both by hand and through two sections:** one row, "via 2 sections", both ranges as its meta; its Unlink asks and takes both; a row only by hand unlinks at once. Pinned by the `viaBadge` / `figureMeta` / `unlinkViaBody` tests in Task 1 and the unlink screenshot in Task 6.
4. **A class day in the future, a blank title or notes over 2000:** refused under the field it is about in both New lesson and Edit, everything typed kept. Pinned by the refusal tests in Tasks 2 and 3.
5. **Months across a year end, and empty counts:** December 2025 and January 2026 are two groups with their years; "1 video" is singular; a lesson with no videos has no size line; all three counts always show, zeros muted; no "Videos on disk" line at 0 bytes. Pinned by the `monthGroups` / `videoMeta` / `lessonCounts` / `diskSubtitle` tests in Task 1.

---

### Task 1: What the Lessons screens derive

**Files:**
- Create: `src/lib/lessons/list.ts`, `src/lib/lessons/list.spec.ts`
- Create: `src/lib/lessons/page.ts`, `src/lib/lessons/page.spec.ts`
- Modify: `src/lib/format.ts`, `src/lib/format.spec.ts`
- Modify: `src/lib/upload-queue.ts`, `src/lib/upload-queue.spec.ts`
- Modify: `src/lib/types.ts` (`LessonRoutineRow`, `LessonExerciseRow`), `src/lib/server/lessons.ts` (`getLesson`), `src/lib/server/lessons.spec.ts`

**Interfaces:**
- Consumes: `LessonItem`, `LessonFigureRow`, `LessonRoutineRow`, `LessonExerciseRow`, `ViaSection`, `VideoSection` (`types.ts`); `plural`; `spotTime`; `frequencyLabel`; `PARTNER_LABEL`; `byteSize`.
- Produces (`format.ts`): `fullDateLabel(day: string): string` (`2026-10-28` → `28 October 2026`); `monthLabel(day: string): string` (→ `October 2026`); `weekdayShort(day: string): string` (→ `Wed`).
- Produces (`lessons/list.ts`, PURE, client-safe):
  - `monthGroups(lessons: LessonItem[]): { key: string; label: string; lessons: LessonItem[] }[]` — consecutive lessons of one `YYYY-MM` share a group, order kept (the load sorts newest first); `key` = `YYYY-MM`, `label` = `monthLabel`.
  - `dateTile(day: string): { weekday: string; day: number; label: string }` — `{ weekday: 'Wed', day: 28, label: '28 October 2026' }`.
  - `videoMeta(l: Pick<LessonItem, 'videos' | 'videoBytes'>): string | null` — `"3 videos · 1.2 GB"`, `"1 video · 410 MB"`, `null` at 0 videos.
  - `lessonCounts(l: Pick<LessonItem, 'sections' | 'routines' | 'figures'>): { n: number; word: string }[]` — always three, in the order sections, routines, figures.
  - `diskSubtitle(bytes: number): string | undefined` — `"Videos on disk: 3.4 GB"`, `undefined` at 0.
- Produces (`lessons/page.ts`, PURE, client-safe):
  - `sectionHeading(label: string, n: number): string` — `"Figures · 3"`, `"Figures"` at 0.
  - `viaBadge(via: ViaSection[]): string | null` — `null`, `"via section"`, `"via 2 sections"`.
  - `viaRanges(via: ViaSection[]): string` — `"1:12.0–1:30.4, 3:05.0–3:22.8"` (`spotTime`).
  - `figureMeta(f: Pick<LessonFigureRow, 'partner' | 'viaSections'>): string` — the ranges when via sections, else `PARTNER_LABEL[partner]`.
  - `routineMeta(r: Pick<LessonRoutineRow, 'everyDays'>): string | null` — `frequencyLabel`, `null` without an exercise.
  - `exerciseMeta(e: Pick<LessonExerciseRow, 'viaSections' | 'everyDays'>): string` — the ranges when via sections, else `frequencyLabel(everyDays)`.
  - `reviewMeta(e: { everyDays: number; active: boolean }): { text: string; strong: boolean }[]` — `Every 3 days · review exercise`; inactive: `Every 3 days · inactive · review exercise` with `inactive` strong.
  - `unlinkViaBody(label: string, via: ViaSection[]): string`.
  - `deleteVideoBody(sections: number): string`.
  - `deleteBlock(sections: Pick<VideoSection, 'links'>[]): string | null` — the server's `SpotLinkedError` wording from the same rule as `linksBlocking`: every link's label, `" (archived)"` appended when archived, de-duplicated, sorted with `localeCompare`.
  - `type LessonRoutineRow` gains `everyDays: number | null`; `LessonExerciseRow` gains `everyDays: number` — `getLesson` selects `exercises.everyDays` alongside what it selects now.
- Produces (`upload-queue.ts`):
  - `uploadCard(s: { progress: number; position: { index: number; count: number } | null; retrying: boolean }): { title: string; helper: string; tone: 'accent' | 'warn'; icon: 'upload' | 'refresh'; percent: number }`.
  - `summaryTitle(added: number, skipped: number): string | null`.

- [ ] **Step 1: Write the failing tests.**

```ts
// format.spec.ts
expect(fullDateLabel('2026-10-28')).toBe('28 October 2026');
expect(monthLabel('2026-01-03')).toBe('January 2026');
expect(weekdayShort('2026-10-28')).toBe('Wed');

// lessons/list.spec.ts — `lesson(day, over)` builds a LessonItem
const groups = monthGroups([lesson('2026-01-07'), lesson('2026-01-02'), lesson('2025-12-31')]);
expect(groups.map((g) => [g.key, g.label, g.lessons.length])).toEqual([
  ['2026-01', 'January 2026', 2], ['2025-12', 'December 2025', 1]]);
expect(monthGroups([])).toEqual([]);
expect(dateTile('2026-10-24')).toEqual({ weekday: 'Sat', day: 24, label: '24 October 2026' });
expect(videoMeta({ videos: 3, videoBytes: 1.2 * 1024 ** 3 })).toBe('3 videos · 1.2 GB');
expect(videoMeta({ videos: 1, videoBytes: 410 * 1024 ** 2 })).toBe('1 video · 410 MB');
expect(videoMeta({ videos: 0, videoBytes: 0 })).toBeNull();
expect(lessonCounts({ sections: 6, routines: 1, figures: 0 })).toEqual([
  { n: 6, word: 'sections' }, { n: 1, word: 'routine' }, { n: 0, word: 'figures' }]);
expect(diskSubtitle(3.4 * 1024 ** 3)).toBe('Videos on disk: 3.4 GB');
expect(diskSubtitle(0)).toBeUndefined();

// lessons/page.spec.ts — `via(start, end)` builds a ViaSection
const two = [via(72_000, 90_400), via(185_000, 202_800)];
expect(sectionHeading('Figures', 3)).toBe('Figures · 3');
expect(sectionHeading('Exercises', 0)).toBe('Exercises');
expect(viaBadge([])).toBeNull();
expect(viaBadge([two[0]])).toBe('via section');
expect(viaBadge(two)).toBe('via 2 sections');
expect(figureMeta({ partner: 'partner', viaSections: two })).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
expect(figureMeta({ partner: 'solo', viaSections: [] })).toBe('Solo');
expect(routineMeta({ everyDays: 3 })).toBe('Every 3 days');
expect(routineMeta({ everyDays: null })).toBeNull();
expect(exerciseMeta({ viaSections: [], everyDays: 1 })).toBe('Daily');
expect(reviewMeta({ everyDays: 7, active: false })).toEqual([
  { text: 'Weekly', strong: false }, { text: 'inactive', strong: true }, { text: 'review exercise', strong: false }]);
expect(unlinkViaBody('Enchufla · Doble', [via(42_000, 65_500)])).toBe(
  'Enchufla · Doble is on this lesson through section 0:42.0–1:05.5. Unlink it from the lesson and the section?');
expect(unlinkViaBody('Setenta · Basic', two)).toBe(
  'Setenta · Basic is on this lesson through sections 1:12.0–1:30.4, 3:05.0–3:22.8. Unlink it from the lesson and the sections?');
expect(deleteVideoBody(3)).toBe('Its 3 sections go with it. Lesson videos aren’t backed up, so this can’t be undone.');
expect(deleteVideoBody(1)).toBe('Its 1 section goes with it. Lesson videos aren’t backed up, so this can’t be undone.');
expect(deleteVideoBody(0)).toBe('Lesson videos aren’t backed up, so this can’t be undone.');
expect(deleteBlock([{ links: [] }, { links: [] }])).toBeNull();
expect(deleteBlock([
  { links: [chip('Footwork drill'), chip('Enchufla · Doble')] },
  { links: [chip('Enchufla · Doble'), chip('Old drill', true)] }
])).toBe('Linked to Enchufla · Doble, Footwork drill, Old drill (archived) — unlink it first.');

// upload-queue.spec.ts
expect(uploadCard({ progress: 0.468, position: { index: 2, count: 3 }, retrying: false })).toEqual({
  title: 'Uploading 2 of 3… 46%', helper: 'Keep this page open — a reload starts over',
  tone: 'accent', icon: 'upload', percent: 46 });
expect(uploadCard({ progress: 0.2, position: null, retrying: false }).title).toBe('Uploading… 20%');
expect(uploadCard({ progress: 0.468, position: null, retrying: true })).toEqual({
  title: 'Connection dropped — retrying', helper: 'Picks up from what the server already has · 46%',
  tone: 'warn', icon: 'refresh', percent: 46 });
expect(uploadCard({ progress: 0.999, position: null, retrying: false }).percent).toBe(99);
expect(summaryTitle(2, 0)).toBeNull();
expect(summaryTitle(1, 2)).toBe('Some files were skipped');
expect(summaryTitle(0, 1)).toBe('That file wasn’t added');
expect(summaryTitle(0, 3)).toBe('No videos were added');

// server/lessons.spec.ts
it('lists a linked routine and a linked drill with their frequencies', ...)
// a routine made with everyDays 7 and linked → routines[0].everyDays === 7;
// a custom exercise every 1 day linked → exercises[0].everyDays === 1
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/format.spec.ts src/lib/lessons src/lib/upload-queue.spec.ts src/lib/server/lessons.spec.ts` — Expected: FAIL (functions and fields missing).
- [ ] **Step 3: Implement.** The three `format.ts` functions use its existing UTC-noon pattern and month/weekday tables. `videoMeta` uses `plural` and `byteSize`; `percent` is `Math.floor(progress * 100)` clamped to 0–100. Header comments: `list.ts` — "PURE, client-safe: what the Lessons list shows"; `page.ts` — "PURE, client-safe: what a lesson's page shows"; `deleteBlock`'s comment names `linksBlocking` in `spot-links.ts` as the rule it mirrors.
- [ ] **Step 4: Run** the command of Step 2 — Expected: PASS.
- [ ] **Step 5: Commit** `feat(lessons): pure lines for the list and the lesson page, upload card states`.

### Task 2: The Lessons list and New lesson

**Files:**
- Modify: `src/routes/[dance]/lessons/+page.svelte`, `src/routes/[dance]/lessons/+page.server.ts` (`create` refusals)
- Modify: `src/lib/components/lessons/LessonFields.svelte`
- Create: `src/routes/[dance]/lessons/lesson-forms.spec.ts`

**Interfaces:**
- Consumes: `monthGroups`, `dateTile`, `videoMeta`, `lessonCounts`, `diskSubtitle` (Task 1); `Screen`, `BandButton`, `EmptyState`, `Sheet` (`footer`), `Banner`, `Spinner`, `Icon`, `FieldError`, `FrequencyField`, `button`, `FIELD`, `TEXTAREA`, `LABEL`, `GROUP`, `SECTION_LABEL`.
- Produces:
  - `create` refusals: `fail(400, { action: 'create', field?: 'lessonDay' | 'title' | 'notes', message, title, notes, lessonDay })`, checked in this order: no title or over 200 → `title`, "Give it a title (up to 200 characters)."; notes over 2000 → `notes`, "Notes are up to 2000 characters."; a frequency not offered → no field, "Pick how often to go over it."; not a day → `lessonDay`, "Pick the day of the class."; after today → `lessonDay`, "That day is in the future." (unchanged).
  - `LessonFields` props: `lessonDay?`, `title?`, `notes?`, `max?` (unchanged) plus `errors?: Partial<Record<'lessonDay' | 'title' | 'notes', string>>`, `notesRows?: number = 3`, `notesHelp?: string`, `autofocus?: boolean = false`; ids from `$props.id()`.

- [ ] **Step 1: Write the failing tests** in `lesson-forms.spec.ts` (the `vi.mock('$lib/server/db')` + `openDb(':memory:')` set-up, `post` and `call` helpers of `moves-forms.spec.ts`; `USER.timezone` `Europe/Ljubljana`):

```ts
it('puts a blank title under Title, keeping the day and notes', async () => {
  expect(await call(listActions.create, post('salsa', { title: ' ', notes: 'Slow on 4', everyDays: '3', lessonDay: '2026-01-05' })))
    .toMatchObject({ status: 400, data: { action: 'create', field: 'title',
      message: 'Give it a title (up to 200 characters).', notes: 'Slow on 4', lessonDay: '2026-01-05' } });
});
it('puts a day in the future under Day of the class, in bachata too', async () => {
  // lessonDay = localDay(Date.now() + 2 days, zone)
  // → { field: 'lessonDay', message: 'That day is in the future.', title: 'Sensual footwork' }
});
it('puts notes over 2000 characters under Notes', ...)          // field 'notes'
it('refuses a frequency that is not offered without naming a field', ...) // everyDays '5' → no `field`, 'Pick how often to go over it.'
it('creates the lesson and goes to its page', ...)               // throws a 303 redirect to /salsa/lessons/<id> (catch it as dance-wall.spec.ts does)
```

- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/routes/\[dance\]/lessons` — Expected: FAIL (no `field`).
- [ ] **Step 3: Implement the refusals** in `create` in the order above; every refusal carries `title`, `notes` and `lessonDay` as typed.
- [ ] **Step 4: LessonFields** (to `new_lesson_fields`): 14 px apart. Day of the class: `LABEL`, a `type="date"` input (`name="lessonDay"`, `required`, `max`, keep its `YYYY-MM-DD` comment) in `FIELD` with `pl-11` and a `calendar` 20 `text-muted` icon overlaid at the left (`pointer-events-none`). Title: `LABEL`, `FIELD`, `maxlength="200"`, placeholder "Wednesday rueda — enchufla variations", `autofocus` when asked (with the `svelte-ignore a11y_autofocus` comment). Notes: `LABEL` "Notes" + " (optional)" 500 `text-muted`, `TEXTAREA` with `notesRows` rows, `maxlength="2000"`, placeholder "What the teacher said, what to fix, what you kept getting wrong…"; `notesHelp` 13 `text-muted` `pl-1` under it. Each field with an error: `aria-invalid="true"`, `aria-describedby`, `<FieldError>` under it.
- [ ] **Step 5: The list page** (to `lessons_list`, `lessons_empty`): `<Screen title="Lessons" subtitle={diskSubtitle(data.storageBytes)}>` with `right` = `BandButton icon="plus" label="New lesson"` opening the sheet. The old sticky header goes. No lessons → `<EmptyState icon="lessons" title="No lessons yet" body="Add one after your next class — the videos, the notes, and something on Today to make you go back over it.">` with a `button('primary')` + `plus` 20 "New lesson" action (60 px above it). Otherwise, per `monthGroups` group (14 px between groups): `SECTION_LABEL` `<h2>` with the label, then `<ul class={GROUP} aria-label={label}>`; each row an `<a>` (min-h 84, `pl-4 pr-3`, gap 12, `py-3`): the date tile (`aria-hidden`; 48 × 54, radius 12, `bg-accent-soft`; weekday 11/800 `tracking-[0.06em] uppercase text-accent-text` over the day `font-display` 22/800 `text-ink`, 3 px apart); the text column — title 16/700 (wraps) preceded by `<span class="sr-only">{tile.label}, </span>`, `videoMeta` 13 `text-muted` when not null, then the counts row (`mt-[5px]`, gap 12, 13 px): non-zero `text-ink-2` with the number 800 `text-ink`, zero all `text-muted`; then a `chevron-right` 20 `text-chevron`. Keep the `<title>`.
- [ ] **Step 6: The New lesson sheet** (to `new_lesson`, `new_lesson_error`): `<Sheet title="New lesson">`, the form `id="new-lesson"` (`use:guarded` as now, `label: 'New lesson'`, a second tap while busy is cancelled), fields 14 px apart: `LessonFields` (`autofocus`, `errors` from `form.field`, values from the refusal or `lessonDay = data.today`), then `<FrequencyField name="everyDays" label="Go over it again" bind:value>` (starts at `DEFAULT_EVERY_DAYS`) with "Puts “Review: …” on Today; lower it as it settles." 13 `text-muted` `pl-1` under it. A refusal without a field: `<Banner kind="error">` at the top of the form. `footer`: `button('primary', 'md', true)` "Create lesson" (`form="new-lesson"`, Spinner while busy, width kept). The sheet reopens on a refusal, as now.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** `$SHOTS/page.sh OUTDIR /salsa/lessons /bachata/lessons` (one dance with lessons in two months, one with none — archive dev lessons or use a fresh bachata). Create `$SHOTS/lessons-states.py` from `sheet.py`: the band "+" (sheet, Title focused, today's day filled); a day two days ahead and Create (the message under Day of the class, the title kept) in bachata. Compare with "Lessons", "Lessons · empty", "New lesson", "New lesson · refused" (`s-lessons-r0c0/r0c1/r0c2/r1c0.png`), light and dark.
- [ ] **Step 9: Commit** `feat(lessons): the Lessons list by month, its empty state and the New lesson sheet`.

### Task 3: A lesson's frame — band, notes, review exercise, order, edit and archive

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`, `src/routes/[dance]/lessons/[id]/+page.server.ts` (`update` refusals)
- Modify: `src/lib/components/ui/LinkedText.svelte` (link colour)
- Modify: `src/routes/[dance]/lessons/lesson-forms.spec.ts`

**Interfaces:**
- Consumes: `fullDateLabel` (Task 1), `reviewMeta`, `sectionHeading` (Task 1); `LessonFields` `errors`/`notesRows`/`notesHelp` (Task 2); `Screen`, `BandButton`, `BottomBar`, `Dialog`, `Banner`, `Spinner`, `Icon`, `LinkedText`, `button`, `iconButton`, `GROUP`, `SECTION_LABEL`; `leaveOrAsk`, `guarded`; `logFor('lesson')`.
- Produces:
  - `update` refusals: `fail(400, { action: 'update', field?: 'lessonDay' | 'title' | 'notes', message })` — title, notes, then day, with Task 2's messages; "That lesson no longer exists." (404) has no field.
  - The page's sections render in the order of Global Constraints, each its own `<section>` with an `<h2 class={SECTION_LABEL}>` from `sectionHeading`; Tasks 4–6 restyle their insides.

- [ ] **Step 1: Write the failing tests** (in `lesson-forms.spec.ts`; make a lesson with `createLesson`): a blank title → `{ field: 'title', message: 'Give it a title (up to 200 characters).' }`; a day after today → `{ field: 'lessonDay', message: 'That day is in the future.' }`; notes over 2000 → `field: 'notes'`; a valid edit → `{ action: 'update', ok: true }` and `getLesson` shows it.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/routes/\[dance\]/lessons` — Expected: FAIL.
- [ ] **Step 3: Implement** the `update` refusals.
- [ ] **Step 4: The band** (to `lesson_header`): `<Screen compact title={lesson.title} subtitle={editing ? 'Editing' : fullDateLabel(lesson.lessonDay)}>`; `left` = `BandButton icon="back" label="Back to Lessons"` (href the list) or, while editing, `BandButton icon="close" label="Stop editing"` → `leaveOrAsk(editForm, () => (editing = false), 'Stop editing')`; `right` = `BandButton icon="pencil" label="Edit lesson"` while reading, nothing while editing. The old sticky header and its Done/Edit buttons go; the body gets `pb-28` while editing.
- [ ] **Step 5: Reading, top** (to `lesson_top`), the column 12 px apart, section labels 14 px above their content: notes (only when set) as a `bg-surface` radius 16 card (`px-4 pt-3.5 pb-4`, gap 6): "Notes" 13/700 `text-muted`, `LinkedText` 16/500 `text-ink` `whitespace-pre-line`. In `LinkedText.svelte` its links change from bare `text-accent` to `text-accent-text` (still underlined, `break-all`) — every page that shows notes gains the readable colour. The review exercise (when `data.exercise && data.popup`): a `GROUP` with one split row (min-h 64, `pl-4 pr-1.5`): the `<a>` to the exercise page holds a 40 px `bg-accent-soft` disc with `repeat` 20 `text-accent-text`, "Go over this lesson" 16/700 over `reviewMeta` joined by " · " (13 `text-muted`, the strong part 700); the sibling `iconButton('bare')` `text-accent` `plus` 24 `aria-label="Log a set of {data.exercise.name}"` opens the lesson log popup as now. Then the sections in order: Videos, Links, Figures, Routines, Exercises (move the existing blocks; their insides stay until Tasks 4–6).
- [ ] **Step 6: Editing** (to `edit`, `archive_confirm`): only the form and Archive show. The form (`id="edit-form"`, `use:guarded` label "Lesson edits", `update({ reset: false })`, success leaves editing) holds `LessonFields` with `errors` from `failure('update')`'s `field`, `notesRows={7}`, `notesHelp="Links in notes open when tapped."`; a refusal with no field is a `<Banner kind="error">` at its top. Its own Save button goes: `<BottomBar>` holds `button('primary', 'md', true)` "Save" (`form="edit-form"`, `aria-busy` + Spinner while saving). Under the form, centred: `button('danger-text', 'sm')` "Archive lesson" opens `<Dialog title="Archive this lesson?" body="Its review exercise goes too. The videos, links and sets are kept." icon="warning" tone="danger">` — actions `button('tertiary', 'sm')` "Cancel" and, in a `use:enhance` form to `?/archive`, `button('danger', 'sm')` "Archive" (Spinner while posting; on the redirect set `editing = false` and `await tick()` before `update()`, as the exercise page does, so leaving is not asked about; a refusal closes the dialog and shows its message in a `Banner` above the form). The `confirm()` goes.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** `FULL=1 $SHOTS/page.sh OUTDIR /salsa/lessons/<id with notes and a link in them>`; in `lessons-states.py`: the pencil (× and "Editing" on the band, Save pinned); type in Notes and press × (Unsaved changes; Stay keeps it); clear Title and Save (the message under Title); Archive lesson (the dialog; Cancel). Rename a dev lesson "Rueda · enchufla variations con la mano derecha" and screenshot it at the top and scrolled 300 px: two lines then ellipsis, the pencil stays. Compare with "Lesson", "Edit lesson · notes focused", "Archive lesson" (`s-lessons-r1c1.png`, `r4c2`, `r5c0`), light and dark.
- [ ] **Step 9: Commit** `feat(lessons): a lesson's band, notes and review exercise; edit with one pinned Save; archive asks`.

### Task 4: Videos — the cards, their sections, delete

**Files:**
- Create: `src/lib/components/ui/VideoProblem.svelte`
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (the Videos section)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (its inline problem card becomes `VideoProblem`, same look)

**Interfaces:**
- Consumes: `deleteVideoBody`, `deleteBlock`, `sectionHeading` (Task 1); `VideoFrame` (`caption`, `action` — plans 3 and 5), `lessonVideoCaption`, `VideoSections` (plan 5, `linking` as now), `Dialog`, `Banner`, `Spinner`, `Icon`, `button`, `iconButton`.
- Produces: `<VideoProblem kind: 'missing' | 'unplayable' body: string meta: string download?: string action?: Snippet />` — plan 5's recording problem card moved into `ui/`: a 40 px `bg-chip` disc with `video` 22 `text-muted`; title 16/700 "This file is missing" / "Can’t play here" over `body` 14 `text-ink-2`; a row indented 52 px, min-h 44: `meta` 13 `text-muted`, then (unplayable with `download`) an `<a download>` `button('tertiary', 'sm')` + `download` 18 "Download", then `action` pushed right.

- [ ] **Step 1: VideoProblem.** Move the figure page's markup into it unchanged in look; the figure page passes its own bodies ("The server has no file for this recording." / "This browser can’t play this file. Download it or open it on your phone.") and its `action` (the edit-mode trash) as before.
- [ ] **Step 2: Each video** (to `video_card`, `lesson_broken`), a `<li class="overflow-hidden rounded-[22px] bg-surface">` in a `<ul class="flex flex-col gap-3">` under "Videos · {n}" / "Videos": playable → `VideoFrame` as now (`sourceUrl`, `owner`, `linking`, `onproblem`, `onclosed`) plus `caption={lessonVideoCaption(i, video)}` and `action` = `iconButton('bare')` `text-danger` `trash` 22 `aria-label="Delete video {i + 1}"`; missing / unplayable → `VideoProblem` with "The server has no file for this video." / "This browser can’t play this file. Download it or open it on your phone.", `meta={byteSize(video.sizeBytes)}`, `download` = the `/lesson-videos/[file]` URL, the same trash as `action`. Then the refusal banner (Step 3), then `VideoSections` as now.
- [ ] **Step 3: Delete** (to `delete_confirm`, `delete_refused`). The trash: when `deleteBlock(data.sections[video.id] ?? [])` is not null, show it at once in the card (`refused[video.id]`) as `<Banner kind="error" title="Can’t delete this video">` (`px-3 pb-2.5`) and open nothing; else open `<Dialog title="Delete this video?" body={deleteVideoBody(n)} icon="trash" tone="danger">` (n = that video's sections) with `button('tertiary', 'sm')` "Cancel" and, in a `use:enhance` form to `?/deleteVideo` (hidden `videoId`), `button('danger', 'sm')` "Delete" (Spinner while posting). Any answer closes the dialog; a 409 (`form.action === 'deleteVideo' && form.videoId === video.id`) shows the server's message in the same banner. The banner clears on the next tap of that trash. Both `confirm()`s go.
- [ ] **Step 4: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Look.** Upload `clip.mp4` twice to a dev lesson (the old button still works); mark three sections on one, link one (Enchufla · Doble). `FULL=1 $SHOTS/page.sh OUTDIR /salsa/lessons/<id>`. In `lessons-states.py`: the trash on the linked video (the banner names it, no dialog); unlink its section in the player, then the trash (the dialog, "Its 3 sections go with it."; Cancel). Rename one video file on disk (dev only) for the missing card; copy a `.txt` over another's file for the unplayable one; put both back. Check `/salsa/figures/<id with a missing recording>` still shows its problem card. Compare with "Lesson", "Delete video", "Delete video · refused", "Lesson · upload failed, broken files" (`s-lessons-r1c1`, `r4c0`, `r4c1`, `r2c1`), light and dark.
- [ ] **Step 6: Commit** `feat(lessons): video cards with their sections; delete asks, or says what blocks it`.

### Task 5: Uploads and links

**Files:**
- Create: `src/lib/components/ui/UploadCard.svelte`
- Modify: `src/lib/components/ui/ChunkedUploadButton.svelte`, `src/lib/components/ui/UploadButton.svelte` (its card becomes `UploadCard`, same look), `src/lib/components/ui/AppUploadLink.svelte`
- Modify: `src/lib/components/ui/styles.ts`, `src/lib/components/ui/styles.spec.ts` (`DASHED_ADD`)
- Modify: `src/lib/components/links/YouTubeCard.svelte`, `src/lib/components/links/LinkList.svelte`, `src/lib/components/links/LinksEditor.svelte` (`compact`)
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (Videos' add control, the Links section)

**Interfaces:**
- Consumes: `uploadCard`, `summaryTitle`, `summarise`, `screenFiles` (Task 1 and today); `Banner`, `Icon`, `iconButton`; plan 5's `UploadButton` card markup and `AppUploadLink` `kind`.
- Produces:
  - `DASHED_ADD` in `styles.ts`: `flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-field-line text-[16px] font-extrabold text-accent-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`.
  - `<UploadCard title: string helper: string percent: number label: string tone?: 'accent' | 'warn' = 'accent' icon?: IconName = 'upload' />` — `role="status"` `bg-surface` radius 16 card (padding 16, gap 12): a 40 px disc (`bg-accent-soft` + icon `text-accent-text`, or `bg-warn-soft` + `text-warn`), title 16/700 over helper 13 `text-muted`; a 6 px `role="progressbar"` (`aria-label="Uploading {label}"`, `aria-valuenow={percent}`) `bg-hairline` track with a `bg-accent` / `bg-warn` fill, radius 3.
  - `ChunkedUploadButton` props unchanged; internal `retrying` state.
  - `AppUploadLink` `kind` gains `'dashed'` (draws `DASHED_ADD` with `upload` 20; the hint as now).
  - `YouTubeCard`, `LinkList`, `LinksEditor` gain `compact?: boolean = false` (`LinkList` and `LinksEditor` pass it down).

- [ ] **Step 1: Write the failing test** in `styles.spec.ts`: `DASHED_ADD` contains `border-dashed`, `text-accent-text` and `h-[52px]`, and not `text-accent ` (bare).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/components/ui` — Expected: FAIL.
- [ ] **Step 3: UploadCard** — move `UploadButton`'s card into it; `UploadButton` renders `<UploadCard title="Uploading… {pct}%" helper=… percent label />` with its own copy, look unchanged.
- [ ] **Step 4: ChunkedUploadButton** (to `upload_idle`, `upload_card`, `lesson_reconnect`, `lesson_broken`). Logic unchanged except: `retrying = true` when a chunk's request throws (before the back-off) and when a 409 resyncs; `retrying = false` after any 2xx chunk and when a file ends. Render, top to bottom: the summary — after a batch with skipped files, `<Banner kind="error" title={summaryTitle(added, failed.length)}>` holding `summarise(...)` and, as `action`, `iconButton('bare')` `close` 20 `text-muted` `aria-label="Dismiss"`; while busy, `<UploadCard {...uploadCard({ progress, position, retrying })} label="videos">` (the tone and icon from it), the file input still in the DOM but disabled; idle, `<label class={DASHED_ADD}>` with `upload` 20 and `label`, the input `sr-only multiple`. The `track` registration and its comment stay. Lessons page: `label="Add videos"` (the "+" goes); in the app `<AppUploadLink kind="dashed" label="Add videos">`.
- [ ] **Step 5: YouTubeCard `compact`** (to `yt_card` closed and expanded): closed → a row `pt-3 pr-1.5 pl-3` gap 12: a `button` (`aria-label="Play {title ?? 'the video'}"`) holding the thumbnail at 112 × 64, radius 12, with a 32 px `bg-black/70` disc and the filled `play` 16 in white; the text column — title 16/700 (wraps) over `youtube` 16 + "youtube.com" (+ " · from m:ss") 13 `text-muted`; then the Open on YouTube link as now. Tapped → exactly today's playing layout (16:9 embed, the info row with Mirror and Open on YouTube). Not compact: unchanged.
- [ ] **Step 6: Links on the page** (to `lesson_links`, `lesson_add_link`, `in_app_empty`): "Links · {n}" / "Links", then `<LinksEditor compact canSave …>` with the props it has now. The add form stays as `LinksEditor` draws it for every page (see Calls).
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** In `lessons-states.py`, on a dev lesson: pick three files (`clip.mp4`, a copy, and `notes.txt`) with each chunk PUT held 3 s by `page.route('**/api/lessons/*/videos/*', …)` — screenshot "Uploading 1 of 2…"; then abort the first PUT once (later ones held 3 s) — screenshot the warn card, then the accent card after it; at the end the "Some files were skipped" banner naming `notes.txt`, and Dismiss. With the `?app=android` cookie: the dashed "Add videos" and its hint. A YouTube link closed and tapped (Mirror on); a link with a dev `video_downloads` row queued and one failed (plan 5's states, in the compact card); a plain link; a bad line in Add links. Compare with "Lesson · uploading", "… upload reconnecting", "… upload failed, broken files", "… links", "… a link playing, add links focused", "… in the app, nothing yet" (`s-lessons-r1c2`, `r2c0`, `r2c1`, `r2c2`, `r3c0`, `r6c0`), light and dark. Check the figure page's upload card still reads the same.
- [ ] **Step 9: Commit** `feat(lessons): the batch upload card with its retrying state, compact YouTube links`.

### Task 6: In this lesson — figures, routines, exercises and their sheets

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (the three sections, the three create sheets)
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (`newFigure`, `newVariation`, `newExercise`, `newRoutine` refusals)
- Modify: `src/lib/components/lessons/UnlinkVia.svelte`
- Modify: `src/routes/[dance]/lessons/lesson-forms.spec.ts`

**Interfaces:**
- Consumes: `sectionHeading`, `viaBadge`, `figureMeta`, `routineMeta`, `exerciseMeta`, `unlinkViaBody` (Task 1); `Badge`, `Dialog`, `Sheet` (`sub`, `footer`), `Segmented`, `Banner`, `Spinner`, `FieldError`, `FrequencyField`, `FigureFields` (`errors`), `PickerField`, `Picker` (both unchanged — plan 8), `Icon`, `button`, `iconButton`, `GROUP`, `SECTION_LABEL`, `FIELD`, `TEXTAREA`, `LABEL`.
- Produces:
  - Refusals carry `field` (messages as plan 4 words them): `newFigure` — `figureName` "Give the figure a name (up to 200 characters).", `name` "Give the variation a name (up to 200 characters).", `notes` "Notes are up to 2000 characters.", none "Pick how it is danced and its style.", `figureName` "There's already a figure called {figureName}." (unchanged); `newVariation` — `groupId` "Pick a figure.", `name` for a missing name (message unchanged) and the taken name (unchanged), `notes`, none for partner/style; `newExercise` — `name` "Give it a name (up to 200 characters).", `notes`, none "Pick how often to do it."; `newRoutine` — `name` "Give the routine a name (up to 200 characters).", `notes`. Every refusal keeps returning what was typed, as now.
  - `UnlinkVia` props unchanged (`action`, `name`, `id`, `label`, `via`, `onclose`); drawn as a kit `Dialog`.

- [ ] **Step 1: Write the failing tests:** `newFigure` without a figure name → `field: 'figureName'`; with a taken name → `field: 'figureName'`, the message unchanged; `newVariation` with `groupId: ''` → `field: 'groupId'`; with a taken name → `field: 'name'`; `newExercise` with a blank name → `field: 'name'`, `notes` kept; `newRoutine` with a blank name → `field: 'name'`; the existing `dance-wall.spec.ts` lesson tests still pass unchanged.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/routes/\[dance\]/lessons src/routes/\[dance\]/dance-wall.spec.ts` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the refusals.
- [ ] **Step 4: The three sections** (to `linked`), in the order Figures, Routines, Exercises, 10 px between: a label row — `<h2 class={SECTION_LABEL}>` with `sectionHeading` and, right, `button('tertiary', 'sm')` + `plus` 18 "New" (`aria-label="New figure"` / "New routine" / "New exercise") opening the sheet as `createFrom` does now. Then one `<ul class={GROUP}>`: each linked item a split row (`pl-4 pr-1.5`, min-h 64): the `<a>` (`py-2.5`) holds the title 16/700 with, when via sections, `<Badge tone="neutral"><Icon name="link" size={12} />{viaBadge}</Badge>` beside it (wrapping), over the meta 13 `text-muted` (`figureMeta` / `routineMeta` when not null / `exerciseMeta`); siblings — exercises only: an `<a>` `iconButton('bare')` `text-accent` `plus` 24 `aria-label="Log a set of {name}"` to `?log=1` as now; then Unlink: `iconButton('bare')` `text-muted` `unlink` 22 `aria-label="Unlink {name}"` — a one-tap `use:enhance` form when the row is not via sections, else it opens `UnlinkVia` (routines are never via sections). The last row: a `<button aria-haspopup="dialog">` (min-h 54, `px-4`, gap 12) with `search` 20 and "Link a figure…" / "Link a routine…" / "Link an exercise…" 16/700 `text-accent-text`, opening the picker as `openPicker` does now. The old `linkButton` snippet and the `tag` class go.
- [ ] **Step 5: UnlinkVia** (to `unlink_via`): `<Dialog open title="Unlink {label}?" body={unlinkViaBody(label, via)} icon="unlink" tone="danger">` with `button('tertiary', 'sm')` "Cancel" and the existing `use:enhance` form (hidden `name`/`id`, `alsoSections=1`) holding `button('danger', 'sm')` "Unlink" (Spinner while posting). The native `<dialog>` and its `<style>` go.
- [ ] **Step 6: The figure sheet** (to `new_variation`): title "New figure" / "New variation" by mode; at its top `<Segmented name="make" label="Make" items={[{ value: 'figure', label: 'New figure' }, { value: 'variation', label: 'Variation of a figure' }]} bind:value={figureMode}>` (sheet form, not on the band) replacing the two pressed buttons; then the mode's form as now (`id="lesson-new-figure"` / `"lesson-new-variation"`, `use:guarded`, 12 px gaps): a no-field refusal as `<Banner kind="error">` at its top; `FigureFields` with `errors` from the refusal's `field`; in variation mode `PickerField` (unchanged) with "Figures in this lesson come first" 13 `text-muted` `pl-1` under it and, for `field: 'groupId'`, `<FieldError>` under that; no figures yet: the line "There are no figures yet." as now. `footer`: `button('primary', 'md', true)` "Add figure" / "Add variation" with `form` = the mode's id (disabled in variation mode with no figures; Spinner while posting).
- [ ] **Step 7: Routine and exercise sheets** (to `new_routine`): `<Sheet title="New routine from this lesson" sub="Linked here, then opened to build its slots">` and `<Sheet title="New exercise from this lesson">`; each form (`use:guarded` as now) holds Name (`LABEL`, `FIELD`, `maxlength="200"`, value from the refusal or the picker's query), `<FrequencyField name="everyDays" label="How often">` (starts at `DEFAULT_EVERY_DAYS`), Notes ("(optional)", `TEXTAREA` rows 2, `maxlength="2000"`), 14 px apart, each field's refusal under it with `FieldError`, others in a top `Banner`. `footer`: "Add routine and build it" / "Add exercise", `button('primary', 'md', true)` (the "→" goes; Spinner while posting).
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Look.** On a dev lesson with a variation linked by hand, one through two sections, a routine, a drill through a section and one by hand: `FULL=1 $SHOTS/page.sh OUTDIR /salsa/lessons/<id>`. In `lessons-states.py`: Unlink on the two-sections row (the dialog with both ranges; Cancel), then confirm it (the row and both section links go — check the sections now read "Not linked"); Unlink on a by-hand row (gone at once); "+ New" for figures, switch to "Variation of a figure" (the segmented control, the helper), Add with no name (the message under Variation name); "+ New" for routines (sub line); "Link a figure…" (the picker opens; its look is plan 8's). A fresh bachata lesson in the app mode for "Lesson · in the app, nothing yet". Compare with "Lesson · in this lesson", "Unlink via section", "New variation from a lesson", "New routine from this lesson", "Lesson · in the app, nothing yet" (`s-lessons-r3c1`, `r3c2`, `r5c1`, `r5c2`, `r6c0`), light and dark.
- [ ] **Step 10: Commit** `feat(lessons): what the lesson teaches as split rows with via-section badges; unlink and create sheets in the new look`.

### Task 7: Both dances end to end, and the docs

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-23-lessons-design.md`

- [ ] **Step 1: Docs.** `CLAUDE.md` Layout: add `src/lib/lessons/  PURE: the Lessons list's month groups, date tiles and counts; a lesson page's lines — via-section badges, row metas, the delete and unlink questions. Client-safe`. Lessons spec: in "The client", after the retry sentence, "While a chunk is being retried or resynced the card says so (warn, "Connection dropped — retrying") and holds its percent (`uploadCard` in `upload-queue.ts`)"; and that a batch with skipped files ends in an error banner titled by `summaryTitle`. In "Interface notes": the library row's counts — "a zero is muted rather than faded" replaces "a zero fades"; add a line: "The page reads notes → review exercise → Videos → Links → Figures → Routines → Exercises (the redesign's order). Deleting a video whose sections are linked says so on its card without asking first (`deleteBlock` mirrors `linksBlocking`); otherwise a dialog counts the sections that go with it. Archive asks in a dialog." Replace "A fifth bottom-nav tab, between Figures and Songs." with "Lessons is one of the four tabs (Today · Moves · Lessons · Music); see the redesign spec."
- [ ] **Step 2: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 3: Look, both dances.** `FULL=1 $SHOTS/page.sh OUTDIR /salsa/lessons /bachata/lessons /salsa/lessons/<id> /bachata/lessons/<id>` — no old-look piece left (no `bg-raised` cards, no "‹", no uppercase headings, no "+ " labels); the tab bar on the list only; the slim band on the lesson after scrolling; Today's lesson rows and the lesson review popup (`/salsa?…` → its "+") still open and log. Grep `src/routes/[dance]/lessons src/lib/components/lessons` for `confirm(`, `text-accent"`, `text-accent `, `bg-raised`, `border-rule`, `accent-ink` — Expected: none.
- [ ] **Step 4: Commit** `docs: the Lessons area in CLAUDE.md and the lessons spec`.

---

## Calls made in this plan

- **Edit follows the spec's pattern, not the board's ✓.** The board draws ✓ on the band and a Save in the body; the spec ("× Stop editing, Save pinned at the bottom — one Save, not a header Done plus a form Save") and plans 3 and 5 put × on the left and Save in a `BottomBar`. Archive lesson stays at the end of the form as the board draws it. Cost if wrong: swap two band buttons.
- **Deleting a video that cannot be deleted does not ask first.** The page already knows each section's links, so the trash shows the refusal at once (`deleteBlock`, the server's own wording and rule) instead of "Delete this video?" followed by "Can’t delete". The server's 409 still lands in the same banner for a link made meanwhile. Cost if wrong: always open the dialog — one condition.
- **Lesson videos use the shared caption row** (`lessonVideoCaption`: "Video 1" over the size, the trash at its right via plan 5's `action`), as the figure page's recordings and the exercise page do, rather than the board's size-and-trash line under the controls. One card shape across the three places that show a video. "from YouTube ↗" stays where `VideoFrame` puts it.
- **The YouTube card's footer is plan 5's** (Save video / saving / failed, then the worded Remove), not the board's bare trash and "Keeps it at 480p" line: one link editor for the figure and lesson pages. The compact closed row (112 × 64 thumbnail) is new and lesson-only (`compact`), because the spec names it for lessons ("a compact row that plays the embed in place").
- **The Add links form is not boxed in a card** as the lesson board draws it: `LinksEditor` owns the form for the figure, drill and lesson pages, and plan 3 settled its look on the ground. Cost if wrong: one optional wrapper in `LinksEditor`.
- **Two shared pieces are extracted** because both the figure and lesson pages now draw them: `ui/UploadCard.svelte` (plan 5's progress card; the batch upload adds a warn tone) and `ui/VideoProblem.svelte` (plan 5's missing / can't-play card). The figure page's markup moves into them unchanged. Cost: a touch on the figure page this plan does not otherwise own.
- **A retry is shown as "Connection dropped — retrying"** for both a network drop and a 409 resync (the board draws one warn state), and the percent is held, not recomputed from zero; it clears on the next good chunk. "Keep this page open — a reload starts over" is true: a reload starts a new `uploadId`.
- **The skipped-files banner gets a title** (`summaryTitle`): "Some files were skipped" when some landed, "That file wasn’t added" for a single failure, "No videos were added" otherwise; the body is today's `summarise` line. It is dismissable.
- **Routine and exercise rows get a frequency meta**, which needed `everyDays` added to `getLesson`'s routine and exercise selects (a column read, no schema change). The board's "· 6 figures" and "Solo ·" parts are left out: the page has no slot counts, and a drill has no partner.
- **Every create and edit refusal names its field**, as plan 4 did for Moves: the lesson's own create/update (title, notes, day) and the four "from this lesson" sheets. Old one-line messages ("Give it a title and a day that is not in the future.", "Give the figure and the variation a name …") are split; no existing test depends on them.
- **The class day stays a native date input** (drawn as a field with a calendar icon): it is the one control whose value needs no parsing, and a phone's date picker is already a sheet. The board's "28 October 2026" text is what the browser shows in its own format.
- **"Link a …" openers are the group's last row**, as the lesson board draws them, not the full-width tonal buttons the picker spec describes; plan 8 may swap them. The pickers and `PickerField` keep their current look.
- **New exercise from this lesson has no subtitle**; the board only says it is "the same sheet with Add exercise", and the routine's sub ("then opened to build its slots") does not apply.
- **No lesson-shaped skeleton.** The list keeps the `list` skeleton (band + rows) and the lesson the `detail` one; plans 4 and 5 added kinds for their screens, but a lesson's first screen is a notes card and a video, which `detail` already approximates. Cost if wrong: one `pending.ts` kind.
- **The weekday tile is uppercased by CSS** from `weekdayShort` ("Wed"), and is `aria-hidden`; the row's title carries the full date for a screen reader ("28 October 2026, Rueda …").
- **No `?new=1` for New lesson.** Nothing links to it; the band "+" and the empty state's button open the sheet.
- **Unlink of a by-hand row stays one tap without Undo**: the spec's Undo list does not name it, and re-linking is one picker tap.
