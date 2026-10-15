# Sections of a video linked to figures and drills — design

> **Status:** approved in brainstorming, 2026-10-15. Builds on
> [`2026-10-01-video-player-design.md`](2026-10-01-video-player-design.md)'s
> spots and [`2026-10-15-youtube-video-save-design.md`](2026-10-15-youtube-video-save-design.md)'s
> saved videos.

## Purpose

A lesson video often shows many moves: a three-minute clip of fifteen cubana
figures, each of which becomes a figure in the app. Until now the only way to
put "how it looks" on a figure was a recording or a YouTube link, so the
figure page sent the user hunting YouTube for a move the lesson video already
shows.

This links a **section** of a video — a saved spot with an end, marked in the
full-screen player — to a figure version or a drill. The figure, its Today
popup and the drill show the section as a card that opens the player looping
it. Linking works from both ends: from the lesson video's sections, and from
the figure or drill.

Asked and decided:

- A link points at the **saved section**, not a copied start and end. Renaming
  the section renames it everywhere.
- **Sections only**, never points: a point has nothing to loop.
- **Per version**, like recordings: a section linked to "Enchufla · Doble"
  shows on the Doble tab only.
- **Drills only** among exercises. A figure's exercise shows its figure's
  sections, the way it shows its recordings; a lesson's review and a routine
  have no content of their own to hang one on.
- **Any video of the same dance** — a lesson video or a figure recording — with
  the lessons the target is taught in first.
- **A linked section cannot be deleted, and neither can its video.** Unlink
  first. Archiving a figure or drill keeps its links, and they keep blocking.
- Linking happens in **lists on the pages** (lesson, figure, drill). The
  player only shows what a section links to and refuses a linked delete. A
  "link while you watch" mode in the player was considered and left out: it
  puts pickers and a second mode into a full-screen component on a phone.
  "Open a video to mark a new section and link it" can be added later on top
  of this without changing it.

## Data model

```
spot_links
  id           integer pk
  spot_id      fk video_spots, not null
  figure_id    fk figures, nullable     -- a figure or a variation
  exercise_id  fk exercises, nullable   -- a drill
  created_at   timestamp
  CHECK exactly one of figure_id, exercise_id
  unique (spot_id, figure_id)
  unique (spot_id, exercise_id)
  index on figure_id, index on exercise_id
```

The CHECK is safe because the table is new; the "never add a CHECK" rule is
about drizzle-kit rebuilding an existing table. Read the generated SQL: one
`CREATE TABLE` and its indexes, nothing touching `video_spots`, `figures` or
`exercises`. SQLite treats NULLs as distinct in a unique index, so the two
unique indexes each constrain only their own kind of target.

**No `dance` column.** A link is the dance of its target, which must equal the
dance of the section's video (resolved through the lesson, or the recording's
figure). Hard-deleted on unlink, like a link or a spot.

**One section, many targets.** A stretch of video showing a combination may
belong to two figures. The same pair twice is refused.

## Rules

In `src/lib/server/spot-links.ts`, because none is expressible as a CHECK:

- **The spot is a section** — its `end_ms` is not null.
- **Same dance** — the section's video and the target are in one dance.
- **A drill** — `exercise_id` names an exercise with `source = 'custom'`.
- **Not yet linked** to this target.

Each breach is a typed `SpotLinkError` the route turns into a `fail(400)`
(`409` for "already linked").

**Deleting is refused while linked.** `deleteSpot`, `deleteLessonVideo` and
`deleteRecording` first ask `linksBlocking`; when any section involved is
linked they delete nothing and return a refusal naming the targets — "Linked
to Enchufla · Doble, Clave drill (archived)". The foreign key from
`spot_links.spot_id` is the database's own second line: with
`foreign_keys = ON` it refuses the spot's delete even if a caller skipped the
check. Today all three delete a video's spots first in one transaction; that
stays, after the check.

Archived targets are listed in the refusal and in the chips, marked
"(archived)", because an archived figure's or drill's page is a 404. The
chips are where they get unlinked: under each lesson video on the lesson page,
and under each recording (that has sections) on its figure's page, whose
`unlinkSection` takes the version's own links or any link of a section on one
of the version's recordings. Without the second, a recording's section linked
to a since-archived target could never be unlinked, and the recording never
deleted.

Targets are always named through `figureLabels` ("Enchufla · Doble"), never a
variation's bare name.

## Server

`src/lib/server/spot-links.ts`, every function taking `db` first. `target` is
`{ figureId }` or `{ exerciseId }`; `owner` is the existing `SpotOwner`.

- `linkSpot(db, spotId, target)` — the new row, or throws `SpotLinkError`.
- `unlinkSpot(db, id, target)` — scoped to the target, like `deleteLink`, so
  an id belonging to another target (or dance) deletes nothing. Returns
  whether a row went.
- `sectionsFor(db, target)` — the cards: each linked section with its spot,
  its video's `src` (`/lesson-videos/…` or `/recordings/…`), whether the file
  is a recording or a lesson video, and where it comes from (lesson title and
  day, or the recording's figure label). Ordered by lesson day, then video,
  then start.
- `linkableSections(db, target)` — the "+ Link a section" sheet: every section
  in the dance not yet linked to the target, grouped by video. Groups in this
  order: videos of lessons the target is taught in (for a version, lessons
  linked to it or to its figure via `lesson_figures`; for a drill,
  `lesson_exercises`), marked *taught here*; other lesson videos, newest
  lesson first; other figures' recordings. Each section carries what it is
  already linked to.
- `videoSections(db, owner)` — the lesson page's lists: a video's sections
  with their links (id, label, archived).
- `linksBlocking(db, { spotId } | owner)` — the labels blocking a delete.

`GET /api/video-spots` adds `linkedTo: string[]` to each `Spot`, so the player
can show it. `DELETE /api/video-spots/[id]` answers a refused delete with
**409** and the refusal as its message. No other API changes.

### Routes

Two actions, `linkSection` and `unlinkSection`, on each of:

- the lesson page — link posts `spotId` plus `target`, `figure:<id>` or
  `exercise:<id>` (one `<select>` carries both kinds, read by `targetFrom`);
  unlink posts `linkId`. The spot (for an unlink, the link's spot) must belong
  to one of THIS lesson's videos, checked before the data function, as
  `deleteVideo` checks its video. The unlink then calls `unlinkSpot` with the
  link's own target;
- the figure page — posts `spotId` (link) or `linkId` (unlink) for the
  version in the tab, through the page's existing version guard;
- the drill's exercise page — the same, through `exerciseOf`.

The lesson page's `deleteVideo` and the figure page's `deleteRecording` return
`fail(409, { action, message })` with the refusal.

## Screens

### Lesson page

Under each video, **Sections**: the video's sections by start time. A row
shows the name (or the time) and the range, and ▶ opens the full-screen player
looping it. Under the row, a chip per link, "→ Enchufla · Doble ×", the ×
unlinking. **Link…** opens a `<select>` with groups — *This lesson* (its
figures with their variations, its linked drills), *Other figures*, *Other
drills* — leaving out what this section already links to, and one tap on Link
(`use:enhance`).

Closing the full-screen player calls `invalidateAll()`, so sections marked a
moment ago appear in the list. A refused video delete shows its message under
the video.

### Figure page and the drill's exercise page

A **Sections** block after Recordings (figure, per version tab) or in the
drill's content. Each linked section is a card — "Cubana class · 12 Oct" over
"Enchufla 0:42–0:55" — that opens the player looping it. Unlink sits behind
Edit on the figure page, as Delete recording does; on the drill page, which
edits its content in place like its links, it sits on the card.

**+ Link a section** opens a sheet listing `linkableSections`, grouped as
above, each row with ▶ (preview: the player looping it) and **Link**
(`use:enhance`).

### Today popup and the figure's exercise page

`practice-content.ts` adds `sections` to the figure and drill content, and
their `Content.svelte` show the same cards after the recordings (figure) or
links (drill), read-only. A figure exercise in Today shows the four seconds of
class video where the teacher does it.

### The full-screen player

- A new optional prop `loopSpot: Spot`. Given one, the player opens at its
  start with it as the loop, and plays. Opening comes from a tap, so `play()`
  is allowed.
- The Spots panel shows "→ Enchufla · Doble" under each linked section, from
  `linkedTo`.
- ✕ on a linked section gets the 409, shows its message as a note, and keeps
  the row.

`ui/SectionPlayer.svelte` is the player opened on a section, with the stored
mirror and speed: the card, the lesson page's ▶ and the sheet's preview all use
it. A card opens the player directly; it does not put an inline `<video>` on the
page per section.

## Testing

- `src/lib/server/spot-links.spec.ts` on `openDb(':memory:')`: link and
  unlink; each refusal (a point, the other dance, a non-drill exercise, a
  duplicate); unlink scoped to its target; per version (a link on the Doble
  shows on the Doble only); the *taught here* groups first; an archived
  target still blocks and is labelled archived.
- `spots.spec.ts`, `lessons.spec.ts` and the recording tests: a linked section
  blocks `deleteSpot`, `deleteLessonVideo` and `deleteRecording`, and nothing
  is deleted; unlinked, each deletes as before.
- `video-spots.spec.ts`: a linked delete is a 409; GET carries `linkedTo`.
- In the browser against `npm run dev`: mark sections on a lesson video; link
  one from the lesson page and another from a figure's variation tab; a card
  loops; the figure's Today popup shows it; deleting the video is refused,
  then unlink and delete; the same at phone width.
- `npm run check` passes.

## Known gaps

- **YouTube embeds have no sections.** A link stays an embed until it is saved
  as a video; only then can it have sections to link.
- **No "mark and link" from the figure.** A section that does not exist yet is
  marked in the player on its video first, then linked.
- **A figure's Today popup shows Basic's sections only.** The exercise belongs
  to the figure, so its content is Basic's, as its recordings are; a
  variation's sections are on the variation's tab.
- **A link whose video's lesson or figure is archived** drops out of the cards
  with it, and comes back when it is unarchived. It still blocks a delete
  meanwhile, and the refusal names it.
