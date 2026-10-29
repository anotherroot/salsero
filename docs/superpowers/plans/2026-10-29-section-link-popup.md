# Section link popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Link popup for a video section that links, unlinks and creates
(variation, figure, drill) in place, on the lesson page and in the full-screen
player; and a lesson's variations and drills that include what its videos'
sections link to.

**Architecture:** Lesson membership becomes derived: a new pure-SQL module
(`lesson-links.ts`) answers "which variations and drills reach this lesson
through its sections", and every reader of `lesson_figures` /
`lesson_exercises` merges it in. A new server module (`link-popup.ts`) builds
the popup's data and does create-and-link in one transaction (drizzle nests
`tx.transaction` as a savepoint, so the existing creators are called with
`tx`). A flat JSON API under `/api/video-spots/[id]/links` feeds one
`LinkPopup.svelte`, used light on the lesson and figure pages and dark inside
the player, where its list and create steps are two player sheets so Back
works.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle on
better-sqlite3, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-29-section-link-popup-design.md`.
Mockup (local, not committed): `.superpowers/brainstorm/3008515-1793306080/content/section-create-v3.html`.

## Global Constraints

- Read `CLAUDE.md` first. Data functions take `db` first; tests use
  `openDb(':memory:')`; a spec that needs `getDb()` mocks `$lib/server/db`
  exactly as `src/routes/api/video-spots/video-spots.spec.ts` does. Never touch
  `$DATA_DIR`.
- No schema change and no migration in this plan.
- Nothing under `$lib/server` is imported by components; shared shapes go in
  `src/lib/types.ts`.
- Labels are always `figureLabels` style: "Enchufla · Doble".
- The keyboard never opens by itself: no `autofocus`, no `.focus()` on a text
  field anywhere in the popup.
- Never a popup on top of a popup: create steps and the unlink question
  replace the popup's content.
- Copy, verbatim from the spec: "Link 0:42–0:55" header (range via
  `spotTime`), groups "Linked", "This lesson" / "This figure", "Other";
  buttons "Add", "+ Variation", "+ Figure", "+ Drill", "Create and link",
  "‹ Link"; subtitle "Linked to <range> and to <lesson title>" (recording:
  "Linked to <range>"); refusals "Enchufla already has a Doble.",
  "There's already a figure called Enchufla."; unlink question
  "Unlink <label>?", "It's also linked to this lesson.", "Only from this
  section", "From the section and the lesson", "Cancel"; lesson row tag
  "via section" / "via 2 sections"; lesson row question "<label> is linked
  through section <range>. Unlink it from the lesson and the section?" with
  "Unlink" / "Cancel"; toast `Section saved · 13.0 s` with "Edit" and "Link".
- New figure from the popup: variation name prefilled "Basic", partner
  default `'partner'`, style default `defaultStyle(db, userId, dance)`.
- New variation from the popup copies `partner` and `style_tag` from the
  figure's first live variation (`listGroupVariations(db, groupId)[0]`), notes
  null.
- New drill: `everyDays` default `DEFAULT_EVERY_DAYS`, validated by
  `isFrequency`; notes null.
- `npm run check` must pass at the end of every task.

## Review Focus

1. **Create-and-link half done.** A create whose link then fails (a point, the
   other dance) must leave no figure, group, variation or drill behind. Test
   in Task 3.
2. **A hand link silently lost.** "Only from this section" must keep
   `lesson_figures`; a section unlink without `alsoLesson` must never touch
   it. Test in Task 3.
3. **Two sections, one variation.** Unlinking one section keeps the variation
   on the lesson through the other; the lesson row's Unlink removes all of
   them. Tests in Tasks 1 and 2.
4. **A variation's own exercise shown twice** once its variation arrives
   through a section. Test in Task 2.
5. **Back from the popup in the player** leaving the page instead of
   stepping create → list → closed. Checked by hand in Task 6 (the history
   class is already tested; the new sheets only add screens).

---

### Task 1: Derived lesson membership

**Files:**
- Create: `src/lib/server/lesson-links.ts`
- Test: `src/lib/server/lesson-links.spec.ts`

**Interfaces:**
- Produces (imported by `lessons.ts`, `spot-links.ts`, `link-popup.ts`; this
  module imports only `./db` and `./db/schema`):
  - `export interface ViaSection { spotId: number; startMs: number; endMs: number; label: string | null }`
    (also exported from `src/lib/types.ts` so components can use it; define it
    there and import it here).
  - `viaSections(db: Db, lessonId: number): { figures: Map<number, ViaSection[]>; exercises: Map<number, ViaSection[]> }`
    — every spot link whose spot is on one of this lesson's videos, keyed by
    `figure_id` / `exercise_id`, each list by `startMs`. No archive filtering
    here; callers filter as they do for hand links.
  - `lessonsReaching(db: Db, target: SectionTarget): number[]` — ids of
    lessons with a video whose section links `target`, deduplicated. No
    archive filtering.

- [ ] **Step 1: Write the failing tests** in `lesson-links.spec.ts`, fixture
  as `spot-links.spec.ts` builds it (a salsa lesson with two videos, Enchufla
  Basic + Doble, a drill, sections on both videos, a point):
  - `viaSections` with no links → both maps empty.
  - link section A (video 1) and section B (video 2) to Doble, section A to the
    drill → `figures.get(doble)` has both spot ids ordered by `startMs`;
    `exercises.get(drill)` has A.
  - a link from another lesson's video is not included.
  - `lessonsReaching({ figureId: doble })` → `[lessonId]` once, even with two
    sections linked; `lessonsReaching({ exerciseId: drill })` → `[lessonId]`;
    a target linked only through a recording's section → `[]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/lesson-links.spec.ts` —
  expect FAIL (module missing).
- [ ] **Step 3: Implement** both functions: one select joining `spot_links` →
  `video_spots` → `lesson_videos` filtered on `lesson_videos.lesson_id`.
- [ ] **Step 4: Run** the spec — PASS.
- [ ] **Step 5: Commit** `Lesson links: which variations and drills reach a lesson through its sections`.

### Task 2: Lessons read the union

**Files:**
- Modify: `src/lib/server/lessons.ts` (`linkedFigureIds`, `getLesson`,
  `linkExercise`, `unlinkFigure`, `unlinkExercise`, `listLinkableExercises`,
  `taughtIn`)
- Modify: `src/lib/server/spot-links.ts` (`targetContext`)
- Modify: `src/lib/types.ts` (`LessonFigureRow`, `LessonExerciseRow`)
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (`unlinkFigure`,
  `unlinkExercise` actions read `alsoSections`)
- Test: `src/lib/server/lessons.spec.ts` (extend; create a `describe('through sections')`)

**Interfaces:**
- Consumes: `viaSections`, `lessonsReaching` (Task 1).
- Produces:
  - `LessonFigureRow` and `LessonExerciseRow` gain
    `byHand: boolean; viaSections: ViaSection[]` (empty when hand-linked only).
  - `unlinkFigure(db, lessonId, figureId, alsoSections = false): boolean` and
    `unlinkExercise(db, lessonId, exerciseId, alsoSections = false): boolean` —
    with `alsoSections`, one transaction also deletes every `spot_links` row
    to that target whose spot is on this lesson's videos. True when any row
    went.
  - The lesson page actions `unlinkFigure` / `unlinkExercise` pass
    `form.get('alsoSections') === '1'`.

- [ ] **Step 1: Write the failing tests:**
  - `getLesson` lists Doble with `byHand: false`, `viaSections` = the section,
    after only `linkSpot(section → doble)`; unlinking the spot removes it.
  - hand link + section link → one row, `byHand: true`, `viaSections` length 1.
  - an archived variation through a section is still listed (as a hand-linked
    one is today); an archived drill through a section is not.
  - a drill linked through a section appears in `getLesson(...).exercises`
    with `byHand: false`.
  - **never in both places:** `addFigureExercise(doble)`, hand-link that
    exercise with `linkExercise`, then `linkSpot(section → doble)` →
    `getLesson(...).exercises` does not contain it; `linkExercise` of a
    variation's exercise refuses when the variation is on the lesson only
    through a section; `listLinkableExercises` leaves it out.
  - `listLinkableFigures` leaves out a variation that is there through a
    section; `listLinkableExercises` leaves out a drill that is.
  - `taughtIn(doble)` includes the lesson after a section link only, and not
    when the lesson is archived.
  - `linkableSections({ figureId: doble })` puts the lesson's video group
    first (`taughtHere: true`) when the only connection is another section of
    that lesson linked to Doble.
  - `unlinkFigure(db, lessonId, doble, true)` with a hand link and two section
    links → all three gone; `unlinkFigure(db, lessonId, doble)` (no flag) →
    only the hand link gone, the sections still link and Doble is still
    listed. Same pair for `unlinkExercise` with a drill.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/lessons.spec.ts src/lib/server/spot-links.spec.ts` — the new tests FAIL.
- [ ] **Step 3: Implement.** `linkedFigureIds` returns hand ∪ via-section ids
  (it feeds `listLinkableFigures` and `listLinkableExercises`). `getLesson`
  selects the via-section variations not hand-linked with the same columns as
  today's figure query and merges, sorted by label; same for drills, keeping
  the `isNull(exercises.archivedAt)` filter; `ownedByLinked` runs over the
  merged figures. `linkExercise`'s figure check also refuses when the figure
  is in `viaSections(...).figures`. `listLinkableExercises`' `alreadyLinked`
  includes via-section drills. `taughtIn` unions `lessonsReaching` (filter
  archived lessons, same order). `targetContext`'s `taught` set unions
  `lessonsReaching`.
- [ ] **Step 4: Run** the two specs and `npx vitest run src/routes/[dance]` — PASS.
- [ ] **Step 5: Commit** `Lessons: a variation or drill linked through a lesson video's section is on the lesson`.

### Task 3: The popup's data and create-and-link

**Files:**
- Create: `src/lib/server/link-popup.ts`
- Modify: `src/lib/server/spot-links.ts` (add `unlinkFromSection`)
- Modify: `src/lib/types.ts` (popup types)
- Test: `src/lib/server/link-popup.spec.ts`

**Interfaces:**
- Consumes: `linkSpot`, `videoOfSpot`, `linkChips`, `SpotLinkError` (existing);
  `viaSections` (Task 1); `createFigure`, `createVariationIn`,
  `listGroupVariations`, `figureNameTaken`, `variationNameTaken`,
  `listMoveTargets` (`figures.ts`); `createCustomExercise` (`exercises.ts`);
  `isFrequency` (`$lib/frequency`).
- Produces, in `src/lib/types.ts` (add `import type { DanceSlug } from './dances/dances'`;
  that module is client-safe):
  ```ts
  export interface LinkOption { target: SectionTarget; label: string; drill: boolean }
  export interface LinkedTarget extends LinkOption { linkId: number; archived: boolean; alsoByHand: boolean }
  export interface LinkFigureChoice { groupId: number; name: string; variations: string[]; near: boolean }
  export type LinkContext =
    | { kind: 'lesson'; lessonId: number; title: string }
    | { kind: 'recording'; groupId: number; figure: string };
  export interface LinkOptions {
    dance: DanceSlug;
    spot: { id: number; startMs: number; endMs: number; label: string | null };
    context: LinkContext;
    linked: LinkedTarget[];
    near: LinkOption[];   // "This lesson" / "This figure", minus what is linked
    other: LinkOption[];  // every other live variation and live drill of the dance
    figures: LinkFigureChoice[]; // near first, then by name
    defaults: { partner: Partner; style: string };
  }
  export type LinkCreate =
    | { kind: 'variation'; groupId: number; name: string }
    | { kind: 'figure'; figureName: string; name: string; partner: Partner; style: string }
    | { kind: 'drill'; name: string; everyDays: number };
  ```
- Produces, in `link-popup.ts`:
  - `linkOptions(db: Db, spotId: number, defaultStyle: string): LinkOptions | null`
    — null for a missing spot or a point. `near` for a lesson video: the
    lesson's variations and drills (hand ∪ via-section, live only); for a
    recording: the live variations of the recording's variation's figure.
    `figures[].near`: a lesson video's figures are the groups of the lesson's
    variations; a recording's is its own group. All lists by label.
    `alsoByHand` is true when the target is in the lesson's `lesson_figures` /
    `lesson_exercises`; always false for a recording.
  - `createAndLink(db: Db, spotId: number, create: LinkCreate): number` — the
    new link id, or throws `SpotLinkError` with the spec's message. One
    `db.transaction`; the creators are called with `tx`; checks before
    creating: empty name → "Give it a name."; variation name taken →
    "<figure> already has a <name>."; figure name taken in the spot's dance →
    "There's already a figure called <name>."; style not of the dance →
    "That style does not belong to this dance."; `!isFrequency` → "Pick how
    often."; group missing/archived/other dance → "No such figure.".
- Produces, in `spot-links.ts`:
  - `unlinkFromSection(db: Db, spotId: number, linkId: number, alsoLesson: boolean): boolean`
    — deletes the link only if it belongs to `spotId`; with `alsoLesson` and a
    lesson video, also deletes the target's row in `lesson_figures` /
    `lesson_exercises` for that lesson. One transaction. False when the link
    is not this spot's.

- [ ] **Step 1: Write the failing tests:**
  - `linkOptions` for a lesson video: `context.kind === 'lesson'`; a hand-linked
    Basic in `near`; after linking Doble through the section it moves to
    `linked` with `alsoByHand: false`; hand-link Doble too → `alsoByHand: true`;
    a drill of the dance is in `other` with `drill: true`; a bachata figure is
    in no list; `figures[0]` is Enchufla with `near: true`.
  - `linkOptions` for a recording's section: `near` holds the recording
    figure's other variations; `context.kind === 'recording'`.
  - `linkOptions` for a point → null.
  - `createAndLink` variation: new variation in Enchufla named "Doble 2",
    partner/style copied from Basic, linked; `getLesson` lists it with
    `byHand: false`.
  - `createAndLink` figure: group "Sombrero" + variation "Basic" created and
    linked.
  - `createAndLink` drill: `source: 'custom'`, linked, `everyDays` stored.
  - refusals: "Enchufla already has a Doble." (taken name), "There's already
    a figure called Enchufla.", style of the other dance, bad `everyDays`, and
    **rollback**: `createAndLink(point, { kind: 'figure', … })` throws and no
    `figure_groups`/`figures` row named "Sombrero" exists; a bachata group id
    on a salsa spot throws and no variation was added.
  - `unlinkFromSection(spot, link, false)` keeps the hand link;
    `(spot, link, true)` removes both; another spot's link id → false and
    nothing deleted.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/link-popup.spec.ts` — FAIL.
- [ ] **Step 3: Implement** `linkOptions`, `createAndLink`, `unlinkFromSection`.
- [ ] **Step 4: Run** the spec — PASS.
- [ ] **Step 5: Commit** `Link popup: its data, create-and-link in one transaction, unlink with the lesson`.

### Task 4: The API and its fetch side

**Files:**
- Create: `src/routes/api/video-spots/[id]/links/+server.ts` (GET, POST)
- Create: `src/routes/api/video-spots/[id]/links/[linkId]/+server.ts` (DELETE)
- Create: `src/lib/video/links-api.ts`
- Modify: `src/lib/video/spots-api.ts` (export `ok`, so both share `SpotsApiError`)
- Test: `src/routes/api/video-spots/links.spec.ts`

**Interfaces:**
- Consumes: Task 3; `defaultStyle` from `$lib/server/default-styles`
  (`locals.user.id`, the spot's dance); `spotId` parsing as in
  `api/video-spots/[id]/+server.ts`.
- Produces:
  - `GET` → `LinkOptions`; 404 for a missing spot or a point.
  - `POST` body `{ target: SectionTarget }` or `{ create: LinkCreate }` →
    `LinkOptions` (status 200). `SpotLinkError` → its status (400, or 409 for
    already linked) with its message. A body with neither, or a malformed
    one → 400.
  - `DELETE …/links/[linkId]?alsoLesson=1` → `LinkOptions`; 404 when the link
    is not this spot's.
  - `links-api.ts`: `fetchLinkOptions(spotId): Promise<LinkOptions>`,
    `addLink(spotId, target): Promise<LinkOptions>`,
    `createLink(spotId, create): Promise<LinkOptions>`,
    `removeLink(spotId, linkId, alsoLesson: boolean): Promise<LinkOptions>`,
    all rejecting with `SpotsApiError`.

- [ ] **Step 1: Write the failing tests** (mock `getDb` as `video-spots.spec.ts`
  does; `locals: { user: USER }`): GET 200 with `linked: []`; GET on a point
  → 404; GET `abc` → 404; POST target → 200 and `linked` has it; POST the
  same target again → 409; POST a bachata figure on a salsa spot → 400; POST
  create figure → 200 and `linked[0].label === 'Sombrero · Basic'`; POST
  create with a taken figure name → 400 with "There's already a figure called
  Enchufla."; POST `{}` → 400; DELETE with and without `alsoLesson` (hand link
  kept / gone); DELETE another spot's link → 404.
- [ ] **Step 2: Run** `npx vitest run src/routes/api/video-spots` — FAIL.
- [ ] **Step 3: Implement** the routes and `links-api.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `API: a section's links — list, link, create and link, unlink`.

### Task 5: LinkPopup and the lesson page

**Files:**
- Create: `src/lib/components/links/LinkPopup.svelte` (or `ui/` — builder's choice, keep it with `video/` styles importable)
- Modify: `src/lib/components/lessons/VideoSections.svelte`
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`, `+page.server.ts`
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (VideoSections and VideoFrame: `linking`, `onclosed`)
- Modify: `src/lib/types.ts` (drop `SectionTargets`, `SectionOption` if unused)
- Test: `src/routes/[dance]/section-links.spec.ts` (drop the lesson page's
  `linkSection`/`unlinkSection` and `sectionTargets` cases; add the lesson
  page `unlinkFigure`/`unlinkExercise` `alsoSections` cases)

**Interfaces:**
- Consumes: `links-api.ts` (Task 4), the types of Task 3, `ViaSection`
  (Task 1), `spotTime` from `$lib/video/spots`, `DANCES` for styles,
  `FREQUENCIES`/`DEFAULT_EVERY_DAYS`, `PARTNER_LABEL`.
- Produces:
  ```ts
  export type LinkStep = 'list' | 'variation' | 'figure' | 'drill';
  // LinkPopup props
  interface Props {
    spotId: number;
    theme: 'light' | 'dark';
    /** Controlled, so the player can tie list ↔ create to history. */
    step: LinkStep;
    onstep: (step: LinkStep) => void;
    /** After every change: the section's link labels, for the small lines. */
    onchange?: (labels: string[]) => void;
    onclose: () => void;
  }
  ```
  Export `LinkStep` from `<script module>`. The unlink question is internal
  state of the list step. Dark theme uses the player's `--pl-*` properties
  and `video/styles.ts` buttons; light uses the site tokens.
- `VideoSections` props become `{ sections, src, owner, linking?: boolean }`
  (`targets`, `hidden`, `failure` go). With `linking`, each row has the link
  icon button (44 px; `text-accent` when `links.length === 0`, else
  `text-ink-2`) opening `LinkPopup` (light; step in local state); closing
  calls `invalidateAll()`. The link line under the time is
  `links.map(l => l.label + (l.archived ? ' (archived)' : '')).join(', ')`,
  truncated by CSS. Its ▶ opens `SectionPlayer` with `linking` (Task 6 adds
  the prop; pass it already, typed optional).

- [ ] **Step 1: Update `section-links.spec.ts` first** — remove the
  lesson-page link/unlink/`sectionTargets` cases; add: `unlinkFigure` action
  with `alsoSections=1` removes the section links; without it keeps them.
  Run `npx vitest run src/routes/[dance]/section-links.spec.ts` — FAIL until
  Step 2.
- [ ] **Step 2: Server:** remove the lesson page's `linkSection`,
  `unlinkSection`, `sectionTargets` (and the load's key); keep the figure
  and exercise pages' actions. Run the spec — PASS.
- [ ] **Step 3: Build `LinkPopup.svelte`:** loads `fetchLinkOptions` on mount;
  list step (header, Linked with ×, search over `near`+`other` by label,
  case-insensitive trimmed, Add per row, the three create buttons carrying the
  search text into the first name field); create steps (variation: figure
  chips for `near` figures plus "Other…" which shows a search over the rest of
  `figures`; name; figure: figure name, variation name "Basic", partner and
  style chips from `defaults` and `DANCES[dance]`; drill: name, how often);
  errors from `SpotsApiError.message` shown in the step; after a successful
  create, `onstep('list')`. × on a row with `alsoByHand` shows the
  three-way question in place; otherwise `removeLink(…, false)`.
- [ ] **Step 4: VideoSections and the pages:** wire as in Interfaces; the
  lesson page passes `linking`; the figure page passes `linking` to its
  `VideoSections` and `VideoFrame` and adds `onclosed={() => void invalidateAll()}`
  to its `VideoFrame`.
- [ ] **Step 5: Lesson Figures and Exercises rows:** a row with
  `viaSections.length > 0` shows the "via section" / "via N sections" tag and,
  as the second line, the ranges (`spotTime(start)–spotTime(end)`, joined
  ", "). Its Unlink opens the small confirm (same markup as the popup's
  question, inline in a fixed overlay) and posts `alsoSections=1`; a
  hand-only row posts as today. A via-section-only row's Unlink is the same
  confirm.
- [ ] **Step 6: Verify** `npm run check` passes; then in `npm run dev` at 390
  px wide: open the popup from a section, Add, create each kind, unlink both
  ways, check the Figures list follows; no keyboard/focus on open.
- [ ] **Step 7: Commit** `Lesson page: the Link popup on each section; lesson rows linked through a section`.

### Task 6: The popup in the player

**Files:**
- Modify: `src/lib/video/screens.ts` (`PlayerSheet` adds `'link' | 'link-new'`)
- Modify: `src/lib/video/spots.ts` (+ `spots.spec.ts`): `linkSummary`
- Modify: `src/lib/components/video/Toast.svelte` (`actions`)
- Modify: `src/lib/components/ui/VideoPlayer.svelte`,
  `src/lib/components/video/SpotEditor.svelte`,
  `src/lib/components/ui/VideoFrame.svelte`,
  `src/lib/components/ui/SectionPlayer.svelte`

**Interfaces:**
- Consumes: `LinkPopup` and `LinkStep` (Task 5).
- Produces:
  - `linkSummary(labels: string[]): string` — `''` for none, the first label
    for one, `"<first> +<n-1>"` for more.
  - `Toast` props `{ text: string; actions?: { label: string; run: () => void }[] }`
    (every caller updated).
  - `VideoPlayer`, `VideoFrame`, `SectionPlayer` take `linking?: boolean`
    (default false), passed down.
  - In `VideoPlayer`: `linkSpotId: number | null` and `linkStep: LinkStep`
    state. `openLink(spotId)` sets `linkSpotId`, `linkStep = 'list'`, pushes
    `{ kind: 'sheet', sheet: 'link' }`. The popup renders while `sheet` is
    `'link'` or `'link-new'`, with `step = sheet === 'link' ? 'list' : linkStep`.
    `onstep(s)`: `'list'` → `nav.up()`; else `linkStep = s` and push
    `'link-new'`. `onclose` → `nav.jump` to the stack without the two link
    sheets. `onchange(labels)` updates that spot's `linkedTo` in `spots`.

- [ ] **Step 1: Write the failing test** in `spots.spec.ts`:
  `linkSummary([])` → `''`; `(['A'])` → `'A'`; `(['A','B','C'])` → `'A +2'`.
  Run `npx vitest run src/lib/video/spots.spec.ts` — FAIL.
- [ ] **Step 2: Implement** `linkSummary`; run — PASS.
- [ ] **Step 3: Toast and say():** `say(text, actions?)`; the timer is 6000
  ms when an action labelled Link is present, else 4000. End section says
  `Section saved · …` with Edit and, when `linking`, Link → `openLink(spot.id)`.
- [ ] **Step 4: The section view's link badge:** under the loop badge (same
  corner, portrait and desktop), a smaller `<button>` badge: link icon +
  `linkSummary(openSpot.linkedTo)`; when empty and `linking`, "+ Link" in
  `--pl-accent`; when empty and not `linking`, nothing; when not `linking`, a
  non-interactive span. Only at `level.kind === 'section'`. In the landscape
  overlay, put the same element beside wherever the section's name shows,
  fading with the controls.
- [ ] **Step 5: The editor's line:** `SpotEditor` takes `onlink?: () => void`;
  with it, the "Linked to …" line is a button (and shows "+ Link" when
  nothing is linked); without it, the line is as today.
- [ ] **Step 6: Render the popup** as a centred dialog inside the player's
  `<dialog>` (not a second `<dialog>`), above the toast, with a scrim; it
  replaces `PlayerSheet` for these two sheets. Keyboard shortcuts are ignored
  while it is open (the player already ignores keys in text fields; also
  ignore M/S/space while a link sheet is open).
- [ ] **Step 7: Hosts:** `VideoFrame` on the lesson page and figure page
  recordings, and `VideoSections`' `SectionPlayer`, pass `linking`. Today's
  `Content.svelte` files, `SectionCard` and `LinkSectionSheet` do not.
- [ ] **Step 8: Verify** `npm run check`; then in `npm run dev` at 390×844,
  844×390 and 1440×900: mark a section → toast Link → Add → popup closes →
  badge shows the link; badge → + Variation → Back (Esc) returns to the list
  → Esc closes the popup → Esc goes to the full video; editor line opens the
  popup; from a `SectionCard` on a figure page there is no "+ Link". If the
  Android app is available, check Back from inside the popup there.
- [ ] **Step 9: Commit** `Player: link a section from the toast, its badge or the editor`.

### Task 7: Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-video-section-links-design.md`
  (status note pointing at the new spec; "Linking happens in lists on the
  pages" and the lesson page's Link… now the popup)
- Modify: `docs/superpowers/specs/2026-10-01-video-player-design.md` (toast
  Link, section view link badge, editor link line, the two sheets)
- Modify: `docs/superpowers/specs/2026-09-23-lessons-design.md` (a lesson's
  variations and drills include those its sections link to; the via-section
  unlink)
- Modify: `CLAUDE.md` ("Live": section links now created and linked from one
  popup on the lesson page and in the player, and a lesson includes what its
  sections link to; add the new spec to the spec list; `lesson-links.ts` and
  `link-popup.ts` to Layout)

- [ ] **Step 1: Edit** the four files.
- [ ] **Step 2: Run** `npm run check` — PASS.
- [ ] **Step 3: Commit** `Docs: the section link popup`.
