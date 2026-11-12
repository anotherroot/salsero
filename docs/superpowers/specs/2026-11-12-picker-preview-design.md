# Picker preview: see the figure before you pick it — design

> **Status:** picked 2026-11-12 from the board
> https://claude.ai/artifact/Sst9B6MoFRGS9gd8nzpQvm (rows **C**, sheet
> **S1**). The board's "now" column is real screenshots of today's pickers
> (`scripts/shots/ext_picker_preview.py` on a copy of the 6 Nov backup). Where
> this document and the board disagree, this document wins; the one known
> difference is the sound rule (see "One sound at a time").
>
> Builds on [`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md)
> (every picker is `Picker.svelte`; its rules 1–11 still hold) and the look of
> [`2026-10-31-redesign-design.md`](2026-10-31-redesign-design.md).

## Why

When the user links something (a lesson to a figure, a section to a
variation) or picks a figure (a routine slot, the move of a new figure), the
picker shows names only. Variations get names like "Con la prima y hermana",
"Rotacija solo" or "1-4 closed", and the user doesn't recognise the figure
from its name. They want to see the figure quickly, without leaving the
picker.

Success: in a figure picker the user can tell figures apart at a glance by
their moving picture and their positions, and can look closer at any one
without losing their place in the picker.

## What the user chose

1. **Rows that are recognisable (option C).** Every figure row gets a second
   line with its positions and length, and a small **moving picture** on its
   left: a loop of a few frames cut from the figure's own video.
2. **A preview sheet (S1).** A tap on the picture opens a tall sheet over the
   picker: the figure's video playing muted, start → end positions and length,
   the first lines of the notes, where it comes from, and Back / the picker's
   verb. The picker stays open underneath; Back returns to it as it was.
3. **"We can try."** The user is curious whether moving rows work. If C does
   not work well in use (too busy, too slow, too much data), the fallback is
   option A: the picture becomes an **eye icon** before the +, opening the same
   sheet. Build so this fallback is a small change (see "Building for the
   fallback").

## Goals

- The picture and the positions line on every figure row of the pickers
  listed below, the same everywhere (rule 10 of the unified pickers).
- The preview sheet from every such row.
- Loops made ahead by the home worker, for every section already linked and
  every new one, so the list never waits on a video.
- Works offline: the device keeps every loop in its reach (see "On the phone, ahead of time").

## Non-goals

- Exercise pickers (Link an existing exercise, Forgot to log, Save this run),
  routine, drill, lesson, section and song rows. Figures and moves only.
- Choosing which section is a figure's picture ("Use for previews"). A later
  idea; this round uses the rule below.
- Making loops on the phone (canvas) or on the server. The server runs no
  media processing.
- Any change to what a tap on a row does, to search, grouping, order, or to
  what can be linked to what.

## Anti-goals

- A picker that gets slow to open or to scroll because of the pictures.
- Pictures that fight the one-sound rule: two videos moving with sound, or a
  preview that a playing song silently ignores.
- Data use that surprises: a list must not pull whole videos.
- Losing the picker's state (search text, scroll, what was linked with +) by
  opening or closing the sheet.

## Where it applies

| Picker (numbers from the unified pickers spec) | Rows | Notes |
|---|---|---|
| 1 Lesson → Link a figure | variations (`variationEntries`) | |
| 7 A section's Link popup, near group and Figures | variations | drill rows unchanged |
| 6 Routine editor, every + (SlotPicker) | variations | keeps its own timing line ("1→1 · Abierta → Cerrada") as the second line; gains the picture |
| 4, 8 Variation of a figure; 5 Move to…; New figure's Move field | moves (`figureRows`, the move field) | a move's picture and sheet: see "A move" |
| A group's pickers, rows from other places (link from other places) | variations | the same fields come with `/api/elsewhere`'s rows |

Under a heading (a move with several variations) each variation row has its
own picture; the heading has none.

## The row

```
[ picture 64×40 ]  Con la prima                       [+]
                   Abierta (una mano) → Cerrada · 8 counts
```

- **Picture:** 64 × 40, radius 8 (the `xs` radius), at the row's left, after
  the indent. It is its own button (the row's tap still picks): its label is
  "Preview <figure label>" (through `t()`), and a small eye badge in its
  corner says it can be tapped. A tap opens the sheet.
- **No video:** the same tile in `accent_soft` with a muted film icon. It still
  opens the sheet (positions, notes and where it's from are worth seeing).
- **Moving:** the loop plays only while the row is on screen (an
  IntersectionObserver adds a class; CSS `steps()` moves a JPEG strip). It is a
  picture, never a `<video>`.
- **Still instead of moving** (the strip's first frame) when
  `prefers-reduced-motion: reduce` or the browser asks to save data
  (`navigator.connection.saveData`). *(My call: the user did not answer
  whether loops should stop on mobile data. Data Saver is the switch they
  already control; if moving loops on mobile data turn out to bother them, add
  a Settings choice later.)*
- **Second line:** start positions → end positions · length, in the words the
  routine editor's timing line already uses for positions
  (`src/lib/routines/page.ts`; not `holdLine`, which describes holds). One
  place makes it.
  With no positions set: "8 counts" alone. A length set per routine slot
  (`length_free`) shows no length. A row that already had a second line (a
  twin note, "used as is from …") keeps it; the positions line goes first and
  the old one after it, joined with " · ", truncated with an ellipsis.
  *(Builder's call how exactly the two join; one line, never two.)*
- Search does not match the positions line (it is `meta`, rule 1).

## The preview sheet (S1)

A level stacked on the picker, the way the picker's create step is (rule 8 of
the unified pickers): its Back returns to the picker with search text, scroll
and the + count kept; Escape and the backdrop do the same. In the light theme
it is a `Sheet`; on the desktop a stacked level over the picker's level. Top
at about the height the board shows (the picker's title still visible above
it).

From top to bottom:

1. **Title:** the row's full label ("Adios · Con la prima"), Back chevron on
   the left (a stacked level shows Back, never ×).
2. **The video**, 16 : 9 box, radius 16: the figure's section playing **muted
   and looping its section** (start to end, then back to start). A sound
   button on it unmutes. A small chip on the video: the section's length ("7
   s"). Adapt the inline looping section player of the Suggestions page
   (`src/lib/components/suggestions/SectionPreview.svelte`); `SectionPlayer`
   is the full-screen player and is not it.
   - **The video can't play here** (offline and not in the device's media
     store; a phone-only original on another phone; the file is gone): show the
     loop strip, large, moving; if there is no loop either, the "No video yet"
     tile.
   - **No section at all:** the "No video yet" tile (accent_soft, film icon).
3. **Under the video:** one muted line, where the video is from: the lesson's
   title and day ("15 salsa cubana moves · 26 Sep", dates by `format.ts`), or
   "Your recording".
4. **Positions:** two cards with an arrow between: "Starts on 1" over the start
   positions, "Ends after 8 counts" over the end positions. Several positions
   on a side are joined as the row joins them. Start count from
   `start_count`/`start_counts` as the figure page shows it. No positions:
   one card, "Starts on 1 · 8 counts" over "No positions set".
5. **Notes:** the first three lines (`line-clamp`), plain text. Absent when
   the figure has no notes.
6. **Where it's from:** person icon + "Yours", or the group icon + the group's
   name, and "you only read it" when the person can't edit there (the words of
   link from other places, `picker.elsewhere`).
7. **Footer:** Back (tonal) and the picker's verb (primary): **Link this** in
   a linking picker, **Add this** in the routine editor, **Pick this** in a
   field picker. The verb does exactly what a tap on the row does (`onpick` /
   `onelsewhere(row, false)`), so it closes everything (rule 3). A row already
   linked shows "✓ Linked", disabled, in place of the verb. The sheet has no +
   *(builder's call: keep going stays on the list)*.

### Inside the full-screen player

A section's Link popup (picker 7) also opens inside the full-screen player,
where the picker is a dark `PlayerLayer` in the media palette. There the
preview sheet is a dark `PlayerLayer` too, stacked on the picker's layer (a
history level, as the create step is), drawn from the same component. Opening
it starts its video, so the player's lesson video pauses (the one-sound
rule). **On Back the lesson video carries on playing from where it paused**
(the user's choice, 2026-11-12), only if it was playing when the sheet
opened. Finishing (the verb) closes the picker and the popup as today, and
the lesson video carries on the same way.

### A move

In the Move pickers (4, 5, 8 and the Move field) a row is a move. Its picture
is the picture of its first variation (in id order, as `listVersions`) that
has one. Its sheet: the move's name as title, then each of its variations as
a row (picture, name, positions line; display only, no tap), then the verb,
which picks the move. No big video. *(Builder's call how many variations show
before "and N more".)*

## Which section is a figure's picture

**The figure page's own top video, when it is a section:** the first section
in the order the figure page shows them (`topVideo` in
`src/lib/figures/page.ts`, sections from `sectionsFor` / `videosOf`), so the
picker and the figure page always lead with the same video. *(My call, after
the builder check: the board's "own recording first, then newest lesson" would
have made the picker and the page disagree.)* Where the page's order differs
by viewer (a group's variation: the viewer's own sections after the group's),
the picture follows the same viewer's order.

Only sections. A figure whose top video is a whole recording (no section), or
that has none, has no picture: the empty tile. *(My call: the backup holds no
recordings, and a recording-keyed job would be a second job type with a
duration probe; a later round can add it.)*

The pickers pick it in one batched query per load (`looksFor`, plan task 6),
and a spec proves it picks exactly what `topVideo(sectionsFor(...))` picks on
the figure page, for an owner, a group editor and a group reader. *(Plan
decision: a proven equivalence instead of one shared function, because the
figure page builds its sections one figure at a time.)*

## The loop

- **What:** one JPEG, a horizontal strip of **12 frames**, each **128 × 80**
  (twice the tile), cut evenly across the section (frame k at
  `start + (k + 0.5) · (end − start) / 12`), scaled to cover and centred, JPEG
  quality about 75. Played at **3 frames a second**: a 4 s loop whatever the
  section's length (a long section plays sped up; the sheet plays the real
  speed).
- **Size:** about 40 KB a loop, 4 KB the still (estimates). **Measure first:**
  the first worker task cuts loops from a few real lesson videos and reports
  sizes; above 60 KB a loop, lower the quality or the frame size before
  building the rest, and tell the user the numbers.
- **Who makes it: the home worker.** It already claims video jobs and runs
  ffmpeg for the AI timeline (`worker/salsa_worker/jobs.py`
  `process_timeline`, `media.py` `timeline_frames`,
  `src/routes/api/worker/timelines/`). A loop job has the same shape: claim
  (lease, attempts, failed for good), fetch, cut, upload, done. ffmpeg reads
  only the section's seconds: the job's source endpoint serves the video with
  Range, and ffmpeg seeks it over HTTP (`-ss` before `-i` on the URL, with the
  worker token header), so a 1 GiB lesson video is never downloaded whole.
  *(If seeking over HTTP proves unreliable, downloading the file as the
  timeline does is acceptable; say so.)*
- **When:** one sweep (`queueLoops`, run on every worker claim and in the
  hourly sweep) queues every figure-linked section whose current span has no
  loop. That covers a new link, an edited span, a copy, an offline replay and
  the backfill alike, without touching each write path. A
  loop belongs to a spot **and its span**: a changed span makes the old loop
  stale (it is no longer shown) and queues a new one. Unlinking does not
  delete it (a loop is cheap and the section may be linked again); deleting
  the spot does, with the spot.
- **The still:** the worker also writes the first frame as its own small JPEG
  (about 4 KB), so Reduce motion and Data Saver never pull the strip. *(My
  call.)*
- **Phone-only videos** (`server_copy` 0): no job until the server has the
  file (Move to… / the upload), then queued. Until then the row shows the
  empty tile.
- **On the phone, ahead of time (the user's choice, 2026-11-12: "they should
  be offline available so it remains fast"):** the device worker downloads
  every ready loop (strip and still) in the device's synced reach into the
  media store when it syncs, as it does songs and count takes, and drops
  those no longer in reach or stale. About 40 KB a figure: a few MB the first
  time, then only new ones. Rows read from the store first, so a picker never
  waits on the network for a picture. The service worker today only reads the
  store (`media()` in `src/service-worker.ts`); the loops go in through the
  device worker (`src/lib/offline/media-store.ts`), not cache-on-view.
- **Storage:** files under `$DATA_DIR/loops/`, not counted in a person's or a
  group's storage *(my call: derived and tiny)*. Served at a media URL with a
  long immutable cache (the name changes when the span does).
- **Copies (clones):** a copied spot points at a copied video; it gets its own
  loop by the same rules (a job, or the source's file reused when the video
  file is the same). *(Builder's call.)*

### The data it needs

Decided in the plan:

- A worker queue table, never synced, like `ai_timelines`: one row per spot
  (`spot_id`, the span it was cut for, status queued/ready/failed, lease,
  attempts, error, file).
- What the pickers and the phone read: nothing new. A loop's file name is
  derived from synced columns, `<spotId>-<startMs>-<endMs>.jpg` and
  `…-still.jpg`, so a page or the phone builds the URL from the spot itself;
  a loop not cut yet answers 404 and the row shows the empty tile. No server
  write touches a synced row, so the group change log and sync triggers are
  untouched.
- A new hard delete (the loop row and file, with its spot) goes into the
  hard-delete list in `docs/hard-rules.md`. The worker endpoints go into
  `NETWORK_ENDPOINTS`; the loop and still URLs into `MEDIA_ENDPOINTS`, so the
  service worker answers them from the media store (see "On the phone, ahead
  of time").

## The row data

The pickers' rows are built from page data (`listVersions`, the Link popup's
`link-popup.ts`, SlotPicker's own data, the move lists, `/api/elsewhere`).
Each figure row needs, in its data: start and end position names, start
count, length (or free), and the loop URL or none. These are small; add them
to what those loads already return.

The sheet's extra (notes' first lines, the video URL and span, where the video
is from, where the figure is from) is fetched when the sheet opens, from a GET
endpoint classified `DEVICE_ENDPOINTS` (answered from synced rows offline).
*(Builder's call: it may come with the page data instead, if that stays
small; it must work offline either way.)* Every read goes through `access.ts`;
another's id and a missing one give the same 404.

## One sound at a time

The rule (`src/lib/sound`): whatever starts playing stops the rest, and a
muted video still counts as playing ("two pictures running at once is the
bug"); only a muted background loop marked `data-ambient` plays on its own.

- **Row pictures** are images, not media: outside the rule.
- **The sheet's video is an ordinary small video, not `data-ambient`.** When
  it starts, whatever else plays stops (a lesson video under the Link popup,
  a song sample, a song); when something else starts, it stops. Its sound
  button only unmutes. Closing the sheet stops it. *(The board said it would
  be a quiet background loop; that was wrong against the rule the user wants
  kept.)*
- The large loop strip shown when the video can't play is an image: outside
  the rule.

## Building for the fallback

The picture and the eye are the same button with two looks: one component
(`PreviewButton` or similar) that draws either the 64 × 40 picture or a
40 px eye icon placed before the +, behind one switch. Going to option A is
then that switch plus not asking for loops in the row data. The sheet is the
same in both.

## Words

Every word through `t()`, in `en` and `sl` (vikanje; glossary in
`sl/index.ts`): "Preview …", "Link this", "Add this", "Pick this", "✓ Linked",
"Back", "Starts on {n}", "Ends after {n} counts", "No positions set", "No
video yet", "Your recording", "Yours", "Sound on"/"Sound off", the move sheet's
words. Positions and figure names are user content, never translated.

## Testing and screenshots

- Specs beside each pure module: the section rule, the row's second line, the
  loop frame times.
- Worker: the ffmpeg arguments and the job flow, as `test_media.py` and the
  timeline tests do; the endpoints like `timelines.spec.ts`.
- `no-english.spec.ts`, `refusals-guard.spec.ts`, `routes.spec.ts`,
  `tables.spec.ts` stay green.
- Screenshots: extend `scripts/shots/ext_picker_preview.py` with the sheet
  open (S1) and rows with pictures, light and dark, salsa and the bachata
  group lesson. A seeded db with a real video (`seed.sh`) for the picture.

## Left to the builder

Marked *(builder's call)* above, plus: the exact table and column names; how
the IntersectionObserver is shared across rows; the sheet's desktop width;
whether the backfill runs once at boot or as a script. Anything not covered
here that changes what the user sees: ask.
