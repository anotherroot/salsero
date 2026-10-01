# Figure coverage — design

> **Status:** approved in brainstorming, 2026-10-01. Changes one hard rule of
> [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md): a figure
> no longer gets an exercise when it is created. Builds on the routines design
> ([`2026-09-24-routines-design.md`](2026-09-24-routines-design.md)) and figure
> variations
> ([`2026-09-29-figure-variations-design.md`](2026-09-29-figure-variations-design.md)).

## Purpose

The user practises **routines**, not single figures. Today every figure brings
an exercise with it, so Today fills with figure rows that are never the thing
being practised. What the user actually needs to know about a figure is
whether any routine uses it — a figure in no routine is a figure that is not
getting practised.

Success:

- adding a figure does not add a row to Today;
- one page answers "which figures, and which variations, does no routine use?";
- from that page, a few of them become a new routine in a couple of taps, to
  be put in order on the routine page.

"Not practised enough" means **in few or no routines**. It is a count of
routines, not of sets logged on them.

## 1. A figure's exercise is opt-in

- `createFigure` creates the figure only. The frequency picker leaves both
  "New figure" sheets (the Figures page and a lesson's).
- `addFigureExercise(db, figureId, everyDays = 3)` creates one on request: the
  figure's name and dance, `source: 'figure'`, `figure_id` set — the same
  pairing as before, still written only by `src/lib/server/figures.ts`.
  Returns null for a variation, an archived or missing figure, or a figure
  that already has one (a figure never has two).
- The figure page's Practice section, today shown only when the figure has an
  exercise, shows instead a **"Practise on its own"** button when it has none.
  The button posts to a page action that calls `addFigureExercise`; the page
  reloads with the usual Practice section and Log button.
- `updateFigure` (rename) and `archiveFigure` keep carrying over to the
  exercise. Both already match by `figure_id`, so they are no-ops without one.
- A lesson's linked figures already tolerate a missing exercise
  (`LessonFigureRow.exerciseId` comes from a left join); such a figure shows
  without a log action.
- `NewExerciseSheet`'s "Figures get an exercise automatically — add those from
  the Figures tab" becomes "To practise a figure on its own, open it and tap
  Practise on its own."
- CLAUDE.md's "Archive, don't delete" rule changes its second sentence to: a
  figure's exercise is opt-in; when one exists it is renamed and archived WITH
  its figure, in one transaction.

## 2. The coverage page

`/[dance]/coverage`, one per dance, behind the dance wall like every other
page.

**Linked** from the Figures header, under "Tagged n / m positions":
"7 versions in no routine →", or "Routine coverage →" when every version is in
at least one.

**Rows** are versions: every unarchived figure and every unarchived variation,
each its own row, labelled "Enchufla · Doble" — exactly what `listVersions`
already returns.

**The count** is the number of distinct unarchived routines that can call that
exact version:

- a version counts for a routine when it is an option in any of the routine's
  slots — its own option slots, and the slots of a routine it embeds;
- so a figure in "Combo A", embedded in "Friday", counts for both;
- a base figure counts only for its own id: its variations do not add to it,
  and it does not add to them;
- an archived routine does not count; an inactive one does (it still contains
  the figure — turning practice off is a separate decision).

**Grouping**, fewest first: "In no routine (n)", "In 1 routine (n)", "In 2+
routines (n)" — alphabetical by label inside each group. Empty groups are not
shown. Each row shows its routine names muted and truncated underneath
("Friday combo, Basic loop"). Tapping a row opens the figure page on that
version's tab.

**The logic is pure:** `coverage(versions, shapes, archivedRoutineIds)` in
`src/lib/routines/coverage.ts` takes the versions (`{ id, label }`) and
`routineShapes`' map and returns each version with its sorted routine ids. It
never touches the database; the page's load assembles its inputs from
`listVersions`, `routineShapes` and the dance's routines (for names and
`archived_at`).

## 3. Selecting versions and creating a routine

- **Long-press** a row (~500 ms, pointer held, little movement) to select it
  and enter selection mode. Rows suppress the iOS callout and text selection
  (`-webkit-touch-callout: none`, `user-select: none`). A small **Select**
  button in the header enters the same mode, for a mouse on the work PC.
- In selection mode a tap toggles a row instead of opening it, and a bottom
  bar shows "n selected · Cancel · **Create routine**". Cancel, or deselecting
  the last row, leaves the mode.
- **Create routine** opens a sheet with a required name (the same field and
  limits as the routine list's New sheet). Submitting posts the name and the
  selected ids, **in the order they were tapped**, to the page's `create`
  action.
- The action calls `createRoutineFromFigures(db, dance, { name, notes: null },
  figureIds)` in `src/lib/server/routines.ts`: one transaction creates the
  routine and its exercise (as `createRoutine` does) and appends one option
  slot per id, in order.
- Every id must be an unarchived figure or variation of this dance. Any other
  id — the other dance, archived, missing — fails the whole request (the
  function returns null; the action answers 404, as every cross-dance id does)
  and nothing is written. An empty list or a duplicate id is a 400: duplicates
  cannot come from the UI.
- On success, redirect to the new routine's page, where the user puts the
  slots in order. Timing breaks show there as they always do.

## 4. Deleting the existing figure exercises (one-off, on the server)

Not code and not a migration: run by hand once the code above is deployed.

1. **Deploy first**, so nothing creates a new figure exercise meanwhile.
2. **Back up:** start `salsa-backup`, and take a named copy that the 14-day
   rotation never removes:
   `sqlite3 /var/lib/salsa/salsa.db ".backup /var/lib/salsa/backups/pre-figure-exercise-delete.db"`
   (the database path from the host config).
3. **Preview, read-only, shown to the user:**
   - every `exercises` row with `source = 'figure'`, archived included: id,
     name, dance, set count;
   - total `sets` that will go; `lesson_exercises` rows that will go; `links`
     rows with those `exercise_id`s (expected 0 — exercise links are
     drill-only);
   - a baseline of exercise and set counts per `source`.
4. **Wait for the user's go-ahead.**
5. **One transaction:**
   ```sql
   BEGIN;
   DELETE FROM lesson_exercises WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
   DELETE FROM links            WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
   DELETE FROM sets             WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
   DELETE FROM exercises        WHERE source = 'figure';
   COMMIT;
   ```
   `sets`, `lesson_exercises` and `links` are the only tables with a foreign
   key into `exercises`, so nothing is left dangling.
6. **Verify:** the per-source counts match the baseline for `custom`,
   `lesson` and `routine`; `figure` is 0. Load Today and a lesson page.

The user's local dev database is left alone unless asked.

This deliberately breaks "archive, don't delete" once, at the user's explicit
request: the figure exercises and every set logged on them are gone for good,
recoverable only from the backup. The rule stands for everything after.

## Testing

- `createFigure` creates no exercise; `addFigureExercise` creates one, refuses
  a second, a variation and an archived figure; rename and archive carry over
  when one exists and do nothing when none does.
- `coverage`: base vs variation counted apart, embedding counted for both
  routines, a routine listed once even when the version is in several of its
  slots, archived routines ignored, grouping order and alphabetical ties.
- `createRoutineFromFigures`: slot order is the given order; another dance's
  id, an archived id or a missing id writes nothing; the routine has its
  exercise.
- Dance wall: `/salsa/coverage` never lists a bachata version, and its
  `create` action refuses a bachata id.
- By hand: long-press and Select on a phone and on a desktop browser;
  "Practise on its own" on a figure page.

## Out of scope

- Counting how often a routine is practised (sets) into a figure's coverage.
- Ordering the new routine's slots automatically by the position graph.
- Adding versions to an existing routine from the coverage page.
