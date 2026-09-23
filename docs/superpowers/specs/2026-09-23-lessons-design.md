# Lessons — design

> **Status:** approved in brainstorming, 2026-09-23. Extends
> [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md), which
> stays the overall design; this document owns lessons and the Today bands.

## Purpose

Coming home from a class you have video on your phone, a head full of detail,
and — until now — nowhere in the app to put any of it. Figures and exercises
existed, but a lesson is the thing that _produced_ them. It is where the videos
belong, where the notes belong, and what you want to go back over a week later
when half of it has faded.

A **lesson** holds a day, a title, notes, its videos, the figures it taught, and
exercises attached by hand. Creating one creates its own review exercise, so the
lesson appears on Today by itself; its frequency is lowered, or it is
deactivated, as the memory settles.

Deliberately NOT included, asked and declined: teacher, school, style, and a
caption per video. Each is one column if it is ever wanted.

## Data model

```
lessons
  id              integer pk
  lesson_day      text not null      -- 'YYYY-MM-DD', the LOCAL day of the class
  title           text not null
  notes           text, nullable
  archived_at     timestamp, nullable
  created_at      timestamp

lesson_videos
  id              integer pk
  lesson_id       fk lessons not null
  file            text not null unique   -- name under lesson-videos/
  mime            text not null
  size_bytes      integer not null
  created_at      timestamp

lesson_figures     (lesson_id, figure_id) pk, created_at
lesson_exercises   (lesson_id, exercise_id) pk, created_at

exercises
  + lesson_id     fk lessons, nullable   -- set iff source = 'lesson'
  source          gains 'lesson'
```

**`lesson_day` is text, not epoch ms, and that is the point.** It is a calendar
day, not an instant: exactly what `localDay` returns and what `?day=` already
carries. Storing it as an instant would mean converting a zone on every read,
which is how a day eventually shifts by one. `created_at` remains an instant,
per the app-wide rule.

**No CHECK ties `lesson_id` to `source = 'lesson'`.** A new CHECK on the
existing `exercises` table makes drizzle-kit emit a table rebuild that selects
the new columns from the old table and fails at migrate time — the same trap
already recorded for `exercises_practice_ck`. `lessons.ts` is the only writer of
the column and is the enforcement. The existing `exercises_source_ck`
(`(source = 'figure') = (figure_id is not null)`) already permits the new row
shape: for a lesson exercise it reads `false = false`.

Verified before committing the migration, against a copy of the real database:
`migrate` succeeds, a `source='lesson'` row inserts, both original CHECKs
survive verbatim, and a bad figure row is still refused.

## Rules

- **Creating a lesson creates its exercise**, in one transaction, named
  `Review: <title>` — the figure rule, applied to lessons. A retitle renames it;
  archiving the lesson archives it. `archiveExercise` and `updateExercise` are
  restricted to `source = 'custom'`, so both already behave correctly for a
  lesson exercise with no change.
- **Archive, don't delete.** A lesson gets `archived_at`; its videos, links and
  sets stay. A video row is a hard delete, like a recording.
- **A figure's exercise never appears twice.** It belongs under the figure.
  Enforced on both writes — `linkFigure` sweeps that exercise out of
  `lesson_exercises`, `linkExercise` refuses one whose figure is already linked
  — and filtered again on read, so a row that predates a link cannot surface.
- **A review exercise is never "linked"**, not even to its own lesson: it
  belongs to the lesson that created it, and borrowing one into a second lesson
  makes "whose is this?" unanswerable on screen.
- **A lesson cannot be dated in the future.** A class you have not attended is
  not a lesson — the same instinct the Today page has about future days.

## Videos, and why the upload is chunked

A figure recording is one request, so **Cloudflare's 100 MB edge limit is its
ceiling** (`MAX_RECORDING_BYTES`, 95 MiB). A class video is several times that,
so it cannot be one request at all. It is sliced instead:

- **`PUT /api/lessons/[id]/videos/[uploadId]`**, one chunk per request.
  `uploadId` is a uuid the browser generates. `content-range:
  bytes <start>-<end>/<total>`; the mime and filename ride along on every chunk.
- **Stateless, and there is no uploads table.** The partial file on disk IS the
  state and its size IS the resume offset. A chunk must start exactly where the
  file ends; anything else is a **409** carrying `x-received-bytes`, which the
  client believes and resumes from. Refusing holes is what lets the size stand
  in for the whole protocol — supporting them would need the manifest this
  avoids.
- **The last chunk finalises**: the partial is renamed into `lesson-videos/`
  (same filesystem, atomic) and then the row is written. File first, then row,
  so a crash leaves an orphan file rather than a row pointing at nothing.
- **204** while incomplete, **201** with the row when done.

**The cap is 1 GiB per video, enforced three ways** so no client behaviour can
exceed it: `total` is rejected up front, the byte count inside `appendStream`
rejects a lying `content-length` mid-stream, and the strict-append rule makes
the file a gap-free prefix of `total`, so `size <= total <= 1 GiB` is an
invariant rather than a hope. The limit is the **disk**, not the edge: the box
is ~80% full and shared with four other services. The Lessons page shows total
bytes used, archived lessons included, because an archived lesson's video is
still on that disk.

**`appendStream` is `saveStream`'s sibling**, differing in the two ways that
make an upload resumable: it opens for append rather than exclusive create, and
on any failure it truncates back to `start` instead of unlinking. Losing one
chunk costs one chunk; unlinking would cost the whole gigabyte.

**Abandoned partials** are swept at boot (`bootstrap`), deleting `*.part` older
than 24 hours. No cron, no unit, no table: nothing in the database points at
these files, so age is the only signal there is — and the only one needed, since
a live upload touches its partial every few seconds.

**Serving** is `GET /lesson-videos/[file]` through the existing `serveFile`.
Range matters twice over here: iOS refuses to play media without it, and these
files run to a gigabyte.

### Measured

- A 131.6 MiB mp4 uploaded in 17 chunks of 8 MiB, zero failures, and the stored
  file's SHA-256 matched the source exactly.
- **`BODY_SIZE_LIMIT` must be set on the host.** adapter-node's default is
  512 KB — below one chunk — so with it unset *every* upload fails. The endpoint
  answers that specific rejection with a 413 naming the setting, because the
  symptom otherwise points nowhere near the cause. See `docs/deployment.md`.
- 8 MiB chunks: far under the edge limit, small enough that a dropped mobile
  connection costs almost nothing to retry, and only ~128 requests for a full
  1 GiB file.

### The client

`ui/ChunkedUploadButton.svelte` is a **sibling** of `UploadButton`, not a mode
inside it. That one is a single request with a single status code; this is a
loop with per-chunk retry, offset reconciliation, aggregate progress, and
success only on the last request. Folding both together would put all of that in
the path figure recordings take, which works today and has no tests. Progress is
`(done + thisChunkLoaded) / total` over XHR, because an 8 MiB chunk on mobile
data takes tens of seconds and a bar that only moves between chunks reads as
hung. Resuming across a page reload is out of scope; the partial survives 24
hours if it is ever wanted.

## Today: four bands instead of three

`plan()` returned `doneToday / todo / inactive`. `todo` splits, so the page
reads top-down as _logged today → do this now → coming up → parked_:

```
setsToday > 0      → doneToday
!active            → inactive      -- parking beats urgency
overdue            → due           -- urgency >= 1, never-done included
otherwise          → upcoming
```

`due` and `upcoming` share one comparator. Its never-done branch is dead weight
in `upcoming` — a null urgency is overdue by definition — but one comparator
that cannot drift beats two that can. **Not yet due is shown, dimmed, not
collapsed**: seeing what is coming is how you pick a short session. Inactive
stays collapsed.

## Interface notes

- **A fifth bottom-nav tab**, between Figures and Songs.
- `LogSheet`'s footer now branches on `source`, not on `figureId`. It offered an
  "Archive exercise" button to anything with a null figure — which a lesson's
  review exercise has — and `archiveExercise` then refused it. It now offers
  "Open figure →", "Open lesson →", or Archive for a custom exercise only.
- `ExerciseRow`'s badge gained a `lesson` arm. Without it a lesson exercise
  rendered as "Custom", and nothing in the types would have caught that.
- `$lib/media.ts` holds the broken-media diagnosis (a 404 on a one-byte range
  means the file is gone; anything else means the codec is) that was inline on
  the figure page. The lesson page is its second caller.
- `format.byteSize` replaces the inline whole-megabyte rounding, which cannot
  say "1.2 GB".

## Testing

Pure and data modules, as ever; no route or component tests, matching the repo.

- `urgency.spec.ts` — the band split, the boundary at exactly 1.0, never-done in
  `due` and never in `upcoming`, an overdue-but-inactive exercise staying
  inactive, and both active bands sorting by urgency then name.
- `lessons.spec.ts` — the paired exercise created, renamed and archived with its
  lesson; `archiveExercise` and `updateExercise` refusing it; both halves of the
  "never in both places" rule; the pickers' exclusions; byte totals.
- `files.spec.ts` — `parseContentRange`, and `appendStream` appending in order,
  reporting the true offset on a mismatch, and **truncating back to `start`**
  when the cap is breached mid-chunk; `sweepUploads` keeping fresh partials.
- One picker test exists purely as a regression: `NOT IN` is null-propagating,
  so `figure_id not in (…)` silently drops every custom exercise. The explicit
  null arm is the fix and that test is what holds it.

## Not built

Choreographies are still phase 3. `lesson_figures` is shaped so a
`lesson_choreographies` table can be added the same way; nothing
choreography-shaped exists yet.
