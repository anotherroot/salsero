# Salsa app — design

> **Status:** approved in brainstorming, 2026-09-22. Hosted at
> `salsa.anotherroot.eu`. Several people since 2026-11-02, each behind their
> own wall — see [`2026-11-02-accounts-design.md`](2026-11-02-accounts-design.md).
> A class can share lessons through a group, a wall beside the person — see
> [`2026-11-02-groups-design.md`](2026-11-02-groups-design.md).
> Multi-dance since 2026-09-24 — see
> [`2026-09-24-multi-dance-design.md`](2026-09-24-multi-dance-design.md) for
> the dance dimension, the registry, and the URL scheme.

## Purpose

A personal practice companion for salsa and son (and other Afro-Cuban dance),
used mostly at lunchtime from a locked-down work PC (browser only) and from a
phone. It answers three needs:

1. **What should I practice today?** — an exercise list ordered by how overdue
   each exercise is, with sets logged per day and history browsable by day.
2. **Remember what I learned** — figures (dance moves) with recordings, and
   routines built from the position graph.
3. **Hear the music** — play saved songs (from YouTube or upload) with the
   count spoken aloud ("uno, dos, tres … cinco, seis, siete"), a clave click,
   slow-down, and figures called out in time ("right turn", "lateral").

## Vocabulary

| Term             | Meaning                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Move**         | A named move (_figura_): _enchufla_, _dile que no_, a right turn. A name that holds its figures (`figure_groups`).                                                                                         |
| **Figure**       | One self-contained way of dancing a move: "Enchufla · Doble" (a `figures` row, once called a variation). Partner or solo. A routine's run shows it, lit in time with the music.                                                                   |
| **Routine**      | An ordered sequence of figures, built from the position graph. See the [routines design](2026-09-24-routines-design.md).                                                            |
| **Exercise**     | Anything practiced and logged. Created automatically for every routine; for a figure only on request ("Practise on its own"); or by hand (custom: "son basic 5 min"). |
| **Set**          | One logged bout of an exercise. Many per day allowed.                                                                                                                               |
| **8-count**      | Two bars of 4/4. Salsa counts 1–8 (spoken 1-2-3, 5-6-7; 4 and 8 are pauses). The musical grid is bars; the dance grid is 8-counts, so the user's correction picks which bar is "1". |

## Phases

Each phase is independently deployable and useful. Phases 1 and 2 are **live**
(2a on 2026-09-22, 2b on 2026-09-23), as is phase 4; phase 3 is live in both
slices, 3a since 2026-09-24 and 3b since 2026-09-26. Phase 5's accounts and
groups are live; its clones and twins are built, not yet deployed.

1. **Exercises & figures** — Today page, exercises, sets, frequency/priority,
   active/inactive, past-day navigation, figures with recordings (auto-creating
   an exercise), custom exercises, deploy + backups. `practice_mode` exists in
   the schema but every mode behaves as "log a set" until phase 2.
2. **Songs & player** — song library (YouTube URL via yt-dlp, or upload), beat
   and downbeat analysis, 1-correction, player with slow-down, voice count,
   clave click, figure calls spoken by the browser (removed 2026-11-08), count-only mode,
   song page, player runs save a set.
3. **Routines & the figure graph** — positions (the handhold vocabulary), each
   figure's start and end positions, the graph derived from them, the drill
   walking it instead of picking at random, and the gap report; then routines
   built on top, with variant slots. Reframed and split in two on 2026-09-24:
   **3a and 3b are both live.** Song-bound choreography is out of scope. See
   [`2026-09-24-routines-design.md`](2026-09-24-routines-design.md).
   Figure timing (start count, length in counts), figure variations and the
   visual routine player: see
   [`2026-09-29-figure-variations-design.md`](2026-09-29-figure-variations-design.md).
   Its variations model (a base figure with inheriting children) was replaced on
   2026-10-29: see
   [`2026-10-29-figures-are-variations-design.md`](2026-10-29-figures-are-variations-design.md).
4. **Lessons** — a class as a record: day, title, notes, chunk-uploaded videos,
   links to the figures and routines it taught and to exercises, and its own
   auto-created review exercise. Shipped 2026-09-23, ahead of phase 3; routine
   links followed on 2026-09-29. Today gained a fourth
   band at the same time. See
   [`2026-09-23-lessons-design.md`](2026-09-23-lessons-design.md).
   Since 2026-10-30 the lesson page links figures, routines and exercises
   through the one shared picker, which also shows what is already linked
   (greyed, "Linked"): see [`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md).
   A full-screen video player with saved spots and looped sections, for
   figure recordings and lesson videos: live since 2026-10-01, see
   [`2026-10-01-video-player-design.md`](2026-10-01-video-player-design.md).
5. **People and groups** — accounts (one-time invites, a storage limit; see
   [`2026-11-02-accounts-design.md`](2026-11-02-accounts-design.md)), groups (a
   class shares its lessons, figures, routines and drills with its members; see
   [`2026-11-02-groups-design.md`](2026-11-02-groups-design.md)) and their
   follow-ups (group mode, notifications, class songs; see
   [`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md)),
   all live by 2026-11-03. Then clones and twins: copies across places that
   remember where they came from (Copy to…, Make it mine, Compare, Take, Send,
   Drop my copy, Detach, Move to… a group), a group's things used in your own
   routines, lessons and sections without copying, leaving that keeps copies,
   and Same as… showing twins as one. Built 2026-11-04 (migration `0027`); see
   [`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md).

Deferred beyond phase 3: stats/charts, ear-training quizzes (e.g. "2-3 or 3-2
clave?"), offline mode.

## Architecture

```
browser (work PC / phone, installable PWA)
  ├─ Today / Exercises   list, log sets, ‹ › day navigation
  ├─ Figures             list, detail, recordings
  ├─ Lessons             (phase 4) list, detail, videos, figure/routine/exercise links
  ├─ Routines            (phase 3)
  ├─ Music               (phase 2) library, add by URL/upload, song page
  └─ Player              (phase 2) <audio> + Web Audio scheduler
        │ HTTPS
salsa.anotherroot.eu → nginx (publicAcme, raised body size)
                     → node 127.0.0.1:3060 (SvelteKit, adapter-node)
                         ├─ SQLite   /var/lib/salsa/salsa.db (Drizzle)
                         ├─ files    /var/lib/salsa/recordings/, audio/,
                         │            lesson-videos/, uploads/
                         └─ /api/worker/*  job queue for the home worker
                                  ▲ outbound HTTPS only, bearer token
home host (backtop; laptop later) — salsa-worker, timer every minute
    yt-dlp → ffmpeg → Beat This! → beats/downbeats → back to the server
    yt-dlp → ffmpeg (≤480p H.264) → a saved video, in chunks → back to the server
```

**Split of responsibility**

- **Server (SvelteKit):** auth, CRUD, file upload and range-served download,
  urgency computation per request, and a small job queue the home worker
  polls. The server runs no Python and no ML: it has 3.7 GB RAM shared with
  other services and an 80% full disk.
- **Home worker (`salsa-worker`, Python)** — phase 2, on a home host
  (`my.salsa.worker.enable`: backtop first, laptop later).
  Claims jobs over HTTPS, downloads with yt-dlp (YouTube bot-blocks the
  Hetzner IP), transcodes with ffmpeg, runs Beat This! (`final0` checkpoint,
  ~15 s and ~660 MB per song on CPU, measured) and posts beats + downbeats
  back. Packaged by the salsaapp flake; yt-dlp comes from nixpkgs-unstable
  because YouTube breaks old versions within weeks.
  It also saves YouTube links as videos, from a second queue drained after
  the songs — see
  [`2026-10-15-youtube-video-save-design.md`](2026-10-15-youtube-video-save-design.md).
- **Browser:** all timing-critical work. The player must be sample-accurate
  relative to the music, so the scheduler runs where the music plays.

## Stack

SvelteKit 2 + Svelte 5, adapter-node, Tailwind 4, TypeScript, Drizzle ORM on
SQLite (`better-sqlite3`), Vitest. Same tooling conventions as
`~/Projects/muscle_model` (prettier, eslint, svelte-check, `npm run check`).
Nix flake dev shell: Node 22, sqlite, rsync/openssh/curl; phase 2 adds Python,
yt-dlp, ffmpeg, Beat This!, piper.

## Data model

All timestamps are UTC ISO strings / epoch ms; "day" is always derived through
the `day` module in the user's timezone (see Pure modules).

```
exercises
  id              integer pk
  name            text not null
  source          'figure' | 'routine' | 'custom' | 'lesson'
  figure_id       fk figures, nullable      -- set iff source = 'figure'
  routine_id      fk routines, nullable     -- phase 3b; set iff source = 'routine'
  lesson_id       fk lessons, nullable      -- set iff source = 'lesson'
  practice_mode   'song' | 'count' | 'none'  default 'none'
  song_id         fk songs, nullable        -- used when practice_mode = 'song'
  count_bpm       integer, nullable         -- used when practice_mode = 'count'
  every_days      real not null default 3   -- target frequency; 1 = daily
  active          boolean not null default true
  archived_at     timestamp, nullable
  notes           text, nullable
  created_at      timestamp

sets
  id              integer pk
  exercise_id     fk exercises not null
  done_at         timestamp not null
  duration_s      integer, nullable
  reps            integer, nullable
  rating          integer 1–5, nullable
  note            text, nullable
  player_json     text, nullable   -- phase 2: {source, songId, bpm, speed, count, clave, routineView, figures, danced:[figure_id...]}

figures
  id              integer pk
  name            text not null
  notes           text, nullable
  partner         'partner' | 'solo'
  style           'salsa' | 'son' | 'other'   default 'salsa'
  callable        boolean default true        -- VESTIGIAL: the random drill's pool, removed 2026-09-30
  call_text       text, nullable              -- VESTIGIAL: a spoken override, removed with the drill
  end_position_id fk positions, nullable       -- VESTIGIAL since positions (2026-11-04): ends are figure_end_positions
  eights          integer not null default 1  -- phase 3a; how many 8-counts the figure takes
  archived_at     timestamp, nullable
  created_at      timestamp

recordings
  id              integer pk
  figure_id       fk figures, nullable
  file            text not null               -- name under recordings/
  mime            text not null
  kind            'video' | 'audio'
  size_bytes      integer
  note            text, nullable
  created_at      timestamp

songs                                          -- phase 2
  id              integer pk
  title           text not null default ''     -- '' until the user or the worker (YouTube title) names it
  artist          text, nullable
  style           'salsa' | 'son' | 'other'   default 'salsa'
  source_url      text, nullable               -- YouTube link; source_url or audio_file is always set
  status          'waiting_download' | 'waiting_analysis' | 'ready' | 'failed'
  error           text, nullable               -- last worker error; shown while waiting or failed
  attempts        integer not null default 0   -- claims so far; failed after 5
  claimed_at      timestamp, nullable          -- the worker's lease; null or 15+ min old = claimable
  audio_file      text unique, nullable        -- name under audio/
  mime            text, nullable
  duration_s      real, nullable
  bpm             real, nullable               -- from the cleaned beats
  beats_json      text, nullable               -- cleaned beat times (gaps filled), seconds
  downbeats_json  text, nullable               -- the model's downbeats, only for the suggested "1"
  anchors_json    text not null default '[]'   -- user: beat indices tapped as "1", sorted
  tempo_factor    real not null default 1      -- user: 0.5 / 1 / 2 — count every other beat, as detected, or twice per beat
  sample_start_s  real, nullable               -- user: where the 15 s sample starts, raw; null = automatic (a third in). Snapped to a 1 on read
  archived_at     timestamp, nullable
  created_at      timestamp

lessons                                        -- phase 4
  id              integer pk
  lesson_day      text not null                -- 'YYYY-MM-DD', the LOCAL day of
                                               -- the class. A day, not an instant
  title           text not null
  notes           text, nullable
  archived_at     timestamp, nullable
  created_at      timestamp

lesson_videos                                  -- phase 4
  id              integer pk
  lesson_id       fk lessons not null
  file            text not null unique         -- name under lesson-videos/
  mime            text not null
  size_bytes      integer not null
  created_at      timestamp

lesson_figures     (lesson_id, figure_id) pk, created_at      -- phase 4
lesson_routines    (lesson_id, routine_id) pk, created_at     -- phase 4
lesson_exercises   (lesson_id, exercise_id) pk, created_at    -- phase 4

positions                                      -- phase 3a; owned since 2026-11-04 (positions spec)
  id              integer pk
  dance           text not null default 'salsa'
  user_id, team_id                             -- exactly one set, as on every root table
  gene_id, cloned_from                         -- families, as on figures (unique per owner)
  slug            text not null                -- VESTIGIAL; new rows 'p-' + uuid, not unique
  name            text not null                -- shown; renameable
  style_tag       text, nullable               -- the type, one of the dance's styles
  hands           'two' | 'one' | 'none', nullable  -- the hold, each part nullable
  crossed         boolean, nullable
  facing          'face' | 'side' | 'shadow' | 'back', nullable
  frame           'open' | 'closed', nullable
  notes           text, nullable
  picture_spot_id integer, nullable            -- a linked point used as its picture
  neutral         boolean not null default false  -- VESTIGIAL: the neutral position went
  sort_order      integer not null default 0   -- VESTIGIAL: lists sort by type, then name
  archived_at     timestamp, nullable
  created_at      timestamp
  -- names are unique per OWNER among LIVE rows, compared ignoring accents and
  -- case (checked in the data function, not a constraint); a restore refuses
  -- when another live position took the name. Archived, never deleted

figure_start_positions                         -- phase 3a; handholds a figure can START from
  figure_id       fk figures
  position_id     fk positions                 -- indexed
  created_at      timestamp
  primary key (figure_id, position_id)

figure_end_positions                           -- positions; handholds a figure can END in
  (figure_id, position_id) pk, created_at      -- any number; indexed by position

lesson_positions   (lesson_id, position_id) pk, created_at    -- positions; a lesson's hand links
spot_position_links                            -- positions; a section or point linked to a position
  id pk, spot_id fk video_spots, position_id fk positions, created_at
  unique (spot_id, position_id)                -- a hard delete on unlink; a group's to team_trash

exercises
  + practice_json text, nullable                -- exercise types; the panel's remembered
                                                 -- count/clave/speed (an old callEvery is ignored)

links                                           -- exercise types
  id           integer pk
  lesson_id    fk lessons, nullable
  figure_id    fk figures, nullable
  exercise_id  fk exercises, nullable            -- source = 'custom' only
  url          text not null                     -- http: or https: only
  title        text, nullable
  created_at   integer
  CHECK ((lesson_id is not null) + (figure_id is not null) + (exercise_id is not null) = 1)

app_flags                                       -- exercise types; one-off boot markers
  key       text pk
  done_at   integer
```

**Exercise types** (2026-09-28) gives every exercise a type derived from
`source`, and each type its own page content (a log popup until 2026-11-08), a practice panel (count/clave/song,
remembered per exercise), and links (a URL attached to a lesson, figure or
drill, YouTube ones rendered as embeds). See
[`2026-09-28-exercise-types-design.md`](2026-09-28-exercise-types-design.md)
for the data model, the popups and the panel in full.

**Rules**

- **What is due is never stored.** It is a pure function of the sets' days and
  faces, replayed per request (since 2026-11-05, see
  [`2026-11-05-today-scheduling-design.md`](2026-11-05-today-scheduling-design.md); the urgency ratio is gone). No cron, no cached
  "last done" or "due" column.
- **Nothing is hard-deleted** except a set (a mistaken log), a recording, a
  lesson video and a link. Figures, lessons, positions and exercises are
  archived; sets keep pointing at them and history stays intact.
- **A figure's exercise is opt-in** (since 2026-10-01; see the
  [figure coverage design](2026-10-01-figure-coverage-design.md)): creating a
  figure creates none, and Create exercise in the figure's ⋯ menu (since
  2026-11-06; "Practise on its own" before) calls `addFigureExercise`
  (`source='figure'`, name = figure name). When one exists, renaming the
  figure renames it and archiving the figure archives it, in one transaction.
- **Creating a routine creates its exercise** in the same transaction — see
  the [routines design](2026-09-24-routines-design.md).
  **Same for a lesson** (`source='lesson'`, name = `Review: <title>`), which is
  what puts a class on Today. `archiveExercise` and `updateExercise` are
  restricted to `source='custom'`, so an owned exercise can only be renamed or
  archived through the thing that owns it.
- **`lesson_day` is a day, not an instant**, and is stored as the `YYYY-MM-DD`
  string `localDay` produces. The "every instant is epoch ms" rule is about
  instants; converting a day through one on every read is how it drifts by one.
- **A figure's or routine's exercise is never in two places.** It shows under
  its figure or routine, so `lesson_exercises` is for hand-attached exercises
  only — enforced on both writes and filtered again on read.
- **Analysis output and user corrections are stored separately**, so
  re-analysing a song never loses a correction.
- `active = false` means "not practicing this right now": shown below the
  active list, dimmed, still loggable. Archived means gone from all lists.

## Today / Exercises page

> **Replaced 2026-11-05** by [`2026-11-05-today-scheduling-design.md`](2026-11-05-today-scheduling-design.md): Today is a number a day (default 5) taken in due-day order, not four bands; every set carries one of four faces and the gap is replayed from them; Next N brings more; Not today and Undo; Coming up lists the rest. The urgency ratio, the frequency presets and the Due / Not yet due / Inactive bands below describe the old Today and are kept for history. Past days are unchanged.

> **Run the day, plan 1 (2026-11-07)** ([`2026-11-07-run-the-day-design.md`](2026-11-07-run-the-day-design.md)): Today has two lists, "Warm-up · N" first (outside the daily number) and "Practice · N". The hero reads "N for today", then "N left for today". Nothing says late. A drill can come back on a fixed rhythm or every day until it feels good, and gaps are slower; see the scheduling spec.

The home page. One page serves both "exercises" and "today".

- **Header:** today shows ‹ (previous day) and Settings on the band; a past
  day shows ‹ › and "Back to today" (the look is in the redesign spec).
  `?day=YYYY-MM-DD` in the URL so days are linkable and back-button friendly.
- **Viewing today:**
  1. **Due** — active exercises at urgency ≥ 1, never-done included, most urgent
     first.
  2. **Not yet due** — the rest of the active ones, grey tiles but shown and still
     loggable: seeing what is coming is how you pick a short session.
  3. **Done today** — exercises with ≥1 set today, in the "done" colour,
     showing the set count. Ordered by most recent set first. (Done sits below
     the first two since 2026-10-31: what the session walks comes first; the
     look is in [`2026-10-31-redesign-design.md`](2026-10-31-redesign-design.md).)
  4. **Inactive** — dimmed, collapsed by default, alphabetical. Parking an
     exercise beats its urgency, so an overdue inactive one stays here.
- **Viewing a past day:** the exercises done that day with their sets (read-only
  list plus the ability to add a forgotten set to that day or delete a mistaken
  one). No urgency ordering — it answers "what did I do that day".
- **Logging (changed 2026-11-08: the row opens the exercise page, where Done opens the
  Done sheet; one entry per exercise per local day, saved by `saveDay`, and a past day's
  history is grouped by day; the rest of this bullet is how it was):** the row opens the exercise page; **+** opens the type's log
  popup — its content, a practice panel where the type has one, and the form
  (duration / reps / rating / note, whichever the type carries). Multiple sets
  per day. After logging, the exercise moves into "done today" without a page
  reload. See
  [`2026-09-28-exercise-types-design.md`](2026-09-28-exercise-types-design.md).
- **Urgency:** `urgency = elapsed_days_since_last_set / every_days`.
  Never-done exercises sort first (by creation, oldest first). Ties break by
  name. `every_days` is set per exercise with presets (daily, every 2 days,
  3, weekly, every 2 weeks) — "priority" is expressed as frequency.
  An exercise reads as "overdue" once urgency ≥ 1.
- **Row content:** name, source badge (figure / choreo / custom), partner/solo
  icon for figures, "last done N days ago" (calendar days via `day`), and a
  subtle overdue marker.
- **Add custom exercise** button at the bottom of the list.

## Figures

- **List:** figures under their move's heading (a move's page at `/[dance]/moves/[id]`); search box, filter chips (style, partner/solo, Not linked), a tile to
  Coverage with its count. Archived hidden. See the
  [redesign](2026-10-31-redesign-design.md), Moves.
- **Positions:** Moves' third segment, `/[dance]/positions`: how many figures
  have positions, Templates and How positions work, search, a chip per type
  and Gaps, No position, the map (name pills, a sheet per position and a walk
  that makes a routine: see the [map spec](2026-11-08-map-walk-design.md)), then Yours and each group's. Positions are
  owned like figures (a person's or a group's, with copies, Make it mine and
  twins); a name is unique among the space's live positions, ignoring accents
  and case. See the [positions spec](2026-11-04-positions-design.md).
- **Positions and the graph:** positions are **optional**. Nobody starts with
  any, and a figure without one fits anywhere: no start positions, it can
  follow anything; no end positions, anything can follow it (`meet` in
  `src/lib/graph/graph.ts`, the one rule). There is no neutral position. A
  figure starts in any number of positions and ends in any number; the next
  figure fits when one of its starts is one of this one's ends, or either side
  has none. A slot's alternatives share the same set of ends. The graph
  compares positions by **family** (`gene_id`, else the row id), so a
  person's figures and the group figures they use meet on the same hold
  across owners, and a person's twinned positions (Same as…) are one hold in
  their graph: fit, breaks, loops, coverage, the player's plan, Leads to /
  Follows from, the gap report and the map all read them as one. The gap
  report is dead ends, orphans and islands (cut off from the main part).
- **New figure's style:** pre-selected from the user's pick in Settings
  ("New figures", one per dance, stored in `default_styles`), else the
  registry's `defaultStyle` — salsa for salsa, sensual for bachata. A stored
  style the dance no longer has falls back to the registry's. A lesson's
  "New figure in a move" pre-selects it too; a copy keeps its source's.
  Songs still start on the dance's first style.
- **Detail** (reworked 2026-11-06, see
  [`2026-11-06-figure-page-rework-design.md`](2026-11-06-figure-page-rework-design.md)):
  the first section (else the first video recording) as a picture that plays
  full screen; the facts card (partner/solo, style, timing, Positions: Starts
  in and Ends in, any number each, links to the positions' pages; notes);
  Recordings, one list of the linked sections, the recordings and the links
  with `+ Add` (Link a section, Video from the phone, Link); Follows from, Leads to and In routines as three rows with counts, each
  a sheet with search (In routines: the live routines that call this figure,
  by slot, `routinesUsing`); Taught in.
- **Coverage:** `/[dance]/coverage` lists every figure version by how many
  routines can call it, and makes a routine from a selection (Select; picks numbered in tap order). See
  [`2026-10-01-figure-coverage-design.md`](2026-10-01-figure-coverage-design.md).
- **Recordings:** upload a video from Recordings' `+ Add` (Video from the
  phone; `accept="video/*"`, no new audio since 2026-11-06; old audio
  recordings still play), or in the Android app its compress-and-upload. Upload shows progress. Stored as-is under
  `/var/lib/salsa/recordings/<uuid>.<ext>`, served by an endpoint that supports
  HTTP range requests (seeking on phones). Max 95 MiB per file — see below.

## Songs & player (phase 2)

**Adding a song:** paste a YouTube or Spotify song link (status
`waiting_download`) or upload an audio file (`waiting_analysis`). A Spotify
song is found on YouTube by the worker (Spotify's audio is DRM'd): its name,
artist and length from Spotify, the best-scoring YouTube result downloaded.
Song details shows where the audio came from ("Audio from": the Spotify song
and the video it plays) and **Use another YouTube link** fixes a wrong match:
the song downloads again, its 1s are cleared, and copies kept in step get the
new audio too. A YouTube or Spotify **playlist or album** link is not downloaded:
the worker reads it (`song_imports`, a third queue it drains first; at most 200
songs, and Spotify's page shows at most 100), it waits under **To pick** at the
top of Music with a dot on the Music tab, and the pick list (option A2) adds only
the ticked songs, each a `waiting_download` song with the title, artist and
style picked. A group's list is its editors', its songs the group's drafts. See
[`2026-11-08-spotify-and-playlists-design.md`](2026-11-08-spotify-and-playlists-design.md). The home worker claims waiting songs with a
15-minute lease, so a job that dies mid-way is picked up again. A transient
failure keeps its lease, so the next try waits out the 15 minutes rather than
following straight away, and the worker stops its run after any failed job.
After 5 failed
attempts, or a permanent error (video unavailable, longer than 15 minutes), the
song is `failed` with the error shown, **Retry** and **Upload a file instead**.
While laptop is off, songs simply wait; the library says so.

**Music (since the redesign):** the Songs tab is Music: search, Count only,
Being added (waiting and failed songs, plus the upload in flight), Recent, then A–Z. A song being
added shows its steps on its own page (Added, Download, Find the beat; an upload
has no Download); a failed one shows the error, Retry and Upload a file instead.
The ready song page (since 2026-11-08, see
[`2026-11-08-song-page-design.md`](2026-11-08-song-page-design.md)) is a minimal
listening view that changes nothing: the section playing, the count (a dash in a
count-off section), "→ Mambo in 3 eights", the seek bar with the section starts
and the part before the music pale, the sample (play only) and the sections,
tap to jump. Its pencil opens **Edit**, which saves as you go with Undo: a Grid
tab (the whole song's count, a row per eight, tap a beat to jump, hold it for
Make this the 1, Start a section here, Remove this 1, Start the song here; Tap
on the 1; suggestions from the downbeats; the section sheet) and a Song tab
(count speed, the sample, where the music starts, Song details, Clear all).
**Sections** are the user's named parts (`songs.sections_json`, raw seconds,
snapped to a 1 on read), each counted or not. A song **starts where its music
starts**: the worker measures it (`start_found_s`), the user may move it
(`start_s`), every player seeks there from 0:00 (`playFrom`), and the file stays
whole. Song details is a sheet from Edit · Song, with a refusal under its field;
Archive song asks in a dialog stacked over it (no browser `confirm()`).
Music has two sections: the person's own songs, then a section per group with
the songs it shares (in group mode, only that group's). A group song is
withdrawn or deleted by its teacher with a warning, not refused; see
[`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md).

**Beat grid** (measured 2026-09-22 on a salsa and a son track): Beat This!'s
BEATS are good — 96–97% of inter-beat intervals within 8% of the median, tempo
stable to ±0.3 BPM across a song — but its DOWNBEATS are not reliable on salsa
(often a "bar" every 2 beats; phase votes 52/27/38/34), and a single
constant-tempo fit drifts 100+ ms at breaks. So:

- The grid IS the detected beats, with gaps (breaks, intros) filled at the
  median interval and near-duplicates dropped.
- The count comes from **anchors**: beat indices the user tapped as "1".
  Counting runs 1–8 forward from each anchor until the next one; before the
  first anchor it runs backwards from it. With no anchors, the downbeat vote
  (computed on read from `downbeats_json`, never stored) is the suggestion.
- A tap snaps to the nearest beat (minus ~80 ms for reaction time). Re-tapping
  later in the song re-anchors from there, which is how a count that slipped
  at a break is fixed. Anchors consistent with the previous one are dropped.
- `tempo_factor` fixes a half- or double-time detection (salsa measured at
  103 BPM is likely half the count rate): ×2 inserts midpoints, ×½ keeps every
  other beat. Changing it clears the anchors, since beat indices change;
  sections stay (they are seconds), each on its nearest 1.
- A tap while paused takes the beat at the playhead with no reaction time
  off, so a jump to a beat and Tap on the 1 sets that very beat.
- The downbeats also suggest where the 1 moves later in the song: runs of 4
  or more downbeats in a new bar phase (`src/lib/songs/suggest.ts`), shown as
  a card the user accepts or puts aside, never applied by itself.

**Player:**

- The song plays through an `<audio>` element (`playbackRate` 0.7–1.0 with
  `preservesPitch`). It is deliberately **NOT** routed into the `AudioContext`:
  the music needs no processing, and piping it through Web Audio would cost an
  extra conversion and break the element's own controls on iOS. Only the clips
  go through the context. Voice and clave clips are decoded `AudioBuffer`s
  scheduled on the context clock with a look-ahead scheduler (≈100 ms horizon,
  25 ms tick) that maps song time → context time from the element's current
  position and rate.
- **Toggles:** voice count, clave (2-3 / 3-2), speed, voice volume and, for a
  routine, Follow or Still. Voice volume and the count pattern are adjustable
  **during** a run (volume feeds the clips' gain node), because whether the
  voice sits right against the music is only knowable once the music plays;
  so is Follow / Still. The rest are fixed when the run starts.
- **Pause** holds the run in place — it must never be faked with stop/start,
  which would re-fetch the clips and discard the figures already planned.
  Resuming a count-only run shifts its context origin, or the count would jump
  forward by the length of the break.
- **A run ends** when the song ends or a count-only grid runs out, and that is
  latched: the 25 ms tick keeps firing, so an unlatched "finished" would fire
  forty times a second.
- **Nothing is called** (since 2026-11-08). A routine run used to speak each
  figure's name every 1, 2 or 4 8-counts, ducking the count under it; the user
  found "every 2" made no sense and wanted to practise on their own, with the
  count or without. Nothing but the count and the clave sounds now.
- **A routine run, Follow or Still** (since 2026-11-08). The routine is still
  walked silently (`routinePlan`): each figure takes its own length
  (`eightsSpan`, at least one 8-count), after two 8-counts of count only.
  **Follow** lights the figure on now from its first "1" (the player's
  `onStep`), names it on the band and scrolls the list to it; a tap on a row
  restarts the run at that figure (`jumpTo`): the song, or the count, goes back
  to the "1" of the 8-count the run is in and the walk carries on from that
  slot. **Still** lights nothing and leaves the list to read; rows do nothing.
  The switch is on Setup (a Routine row), on the desktop's routine heading and
  on the full-screen routine, remembered per routine on the phone
  (`routineViews` in `<dance>.player`, `loadRoutineView`).
- **The full-screen routine** (phone, since 2026-11-08; option B of the routine
  run mockups, band on top): an expand button on the routine list opens the
  list in large type over the run screen, the count and "5 of 16" on a short
  band strip with Follow / Still, a mark per count of the figure on now (per
  8-count past 16, `stepMarks`). Stop and Pause stay on top of it. It holds a
  history entry like a sheet (`sheetStack`), so Back closes it and the run
  goes on. The desktop has no need of it: its sheet lists the whole routine.
- **Count-only mode:** no song; a synthetic grid at `count_bpm` with clave and
  voice.
- **The song is picked in the player** (since 2026-10-14), with the same
  `player/SourcePicker.svelte` as the popup's practice panel: count only at a
  tempo, or any of this dance's ready songs at a speed. Changing song is not a
  navigation: the page fetches the grid from `GET /[dance]/songs/[id]/grid`
  when the song is picked (`player/songGrid.svelte.ts`, shared with the
  panel), so the `<audio>` has its `src` before the Play tap. It opens on
  `?song=` (the song page's Play), else the exercise's remembered practice
  (`practiceStart` in `src/lib/exercises/practice.ts`, shared with the
  panel), else the count. Its settings start where the panel's do
  (`practiceSeed`: the exercise's memory, else this phone's). An exercise remembers its source, song,
  tempo, count, clave and speed as they change, a count changed mid-run too, through the panel's own
  `POST /[dance]/exercises/[id]/practice`. The routine page's Practise goes
  straight here; its sheet of songs is gone. The song's progress bar
  (`player/SongProgress.svelte`) shows before Play, so an intro can be
  skipped.
- **Practice in the new look** (since 2026-10-31; the look is in the redesign
  spec). The `<audio>` has no browser controls: the app's seek bar
  (`SongProgress`) seeks before Play and while running, once on release. Back
  goes to where Practice was opened from (`practiceBack` in
  `src/lib/player/view.ts`: a routine's page, `?song=` the song, an exercise
  alone Today, else Music; the routine log popup's link adds `&from=today`, or `&from=exercise` on the exercise page).
  Back mid-run stops the run and leaves. The player logs nothing (since
  2026-11-08, [`2026-11-08-one-player-design.md`](2026-11-08-one-player-design.md)):
  Stop and the song's end return to setup, and Done on the exercise page is
  the only way a practice becomes a set. The Voice row says Built-in or Yours (Yours: a recorded set fits the
  run's tempo) and opens My count through `myCountHref` (`from` and the pattern; My
  count returns here once it reads them, plan 12; as `&from=…` after the other
  parameters). The running screen is the stage on the band (count disc, dots,
  the figure on now in Follow, the time), a sheet under it and Stop and Pause pinned; it
  does not scroll the page. A landscape phone puts the stage left and the sheet
  right; from 1024 px the desktop splits the running screen, the
  stage left and the sheet right
  ([`2026-11-03-desktop-design.md`](2026-11-03-desktop-design.md)); setup is a
  640 px column.
- **Song samples and the song popup** (since 2026-10-30) have their own
  spec, [`2026-10-30-song-samples-design.md`](2026-10-30-song-samples-design.md).
  `SourcePicker`'s song `<select>` is now `player/SongPicker.svelte`: a field
  with the pick and a ▶, opening "Pick a song" — a search, then Recent and
  A to Z, a 15 s sample on every row. Samples play from their own
  module-level `<audio>` (`src/lib/songs/sample-player.svelte.ts`), never the
  player's, one at a time; Play (and the panel's ▶) stops one first. Where a
  sample starts is `sampleStart` (`src/lib/songs/sample.ts`): a third of the
  way in, or `sample_start_s` from the song's page, snapped to a 1 on read.
  Recent is derived from the latest sets' `player_json.songId`, never stored.
- **The scheduler plays a plan:** the scheduler plays a
  _plan_ — as built, a list of `{ eight, figureId, slot }`, where `eight` is the
  8-count the figure STARTS on and `slot` the flattened routine slot it answers
  (a jump restarts the walk at a slot: `routinePlan`'s `from`).
  A routine grows its plan lazily, tick by tick, through `routinePlan` (`src/lib/routines/plan.ts`), which flattens the
  routine's slots and extends the plan through `throughEight`, rather than
  resolving the whole routine up front. `rand` is injected so the module
  stays pure. `extendPlan`, the pool and the flow went with the calls.
- **The random drill was removed on 2026-09-30.** It called figures at random
  from a picked pool, walking the position graph (`graphFlow`); it went unused.
  With it went the figure's "callable" checkbox and "Say it like" input — the
  voice then always said the figure's name; since 2026-11-08 nothing is said. Without a routine the player is count and clave only.
- **Ending a run** offers "Save as set" on the exercise it was opened from, or a
  choice of exercise when opened from a song. `player_json` holds
  `{ source, songId, bpm, speed, count, clave }` and, for a routine, `routineView`,
  `figures` (the true number of figures started) and `danced` (capped at the
  last 250 ids; older sets say `callEvery`, `calls`, `called`) — the list
  grows by one every few seconds, and an oversized summary must never cost the
  user the set it describes. Nothing queries inside `player_json`.
- **Phone:** Screen Wake Lock while playing; audio starts on the Play tap
  (iOS unlock); Play is disabled while starting, so a second impatient tap cannot
  build a second, unreachable player.

**Voice:** superseded by
[`2026-09-23-count-voice-design.md`](2026-09-23-count-voice-design.md), which
adds count patterns (son, every count, 1-3-5-7, 1-and-5) and the user's own
recorded half-bar phrases. What follows describes what is live today.

The count plays from seven clips shipped with the app
(`static/clips/`: uno, dos, tres, cinco, seis, siete, clave), generated once by
`scripts/make-clips.sh` with Piper and committed. They are decoded into
`AudioBuffer`s and scheduled on the audio clock, so every number lands on its
beat.

The words are generated at Piper's **natural** rate and **may run past their
beat** — each count gets its own source node, so a word still sounding when the
next begins simply mixes with it, which is how a person counts out loud. An
earlier version squeezed every word inside one beat (`--length-scale 0.75`, plus
a `silenceremove` pass that also ate the stop closures inside "cinco" and
"siete") and the count audibly clipped its own words at speed. Do not
reintroduce that: shortening the words is not how the overlap is handled — the
mixer handles it. Measured at the current length, two words summed peak at
−1.2 dB, so the overlap does not clip and needs no limiter.

Figure names were spoken by the browser (`speechSynthesis`) until
2026-11-08; nothing is called now (see "Nothing is called" above).

**Known gaps (phase 2b, deployed 2026-09-23).** Found by review, consciously not
fixed before shipping. Check here before hunting one of these as a new bug:

- **Count steadiness on iOS is unproven.** `ctxAt()` re-derives the song →
  context offset from `audio.currentTime` on every tick rather than latching it,
  so a browser that quantises `currentTime` (Safari) feeds that straight into
  each count. Nothing compensates for output latency either, which would read as
  a constant ahead/behind offset. **First suspect if the count feels off**; the
  fix differs depending on whether it is unsteady or merely displaced, so it
  needs a real ear on a real phone first.
- **The iPhone silent switch mutes the voice but not the music.** True and
  expected — but the hint this spec called for was never put on screen.
- ~~A stray tap on the save sheet's backdrop discards a finished run.~~ Fixed
  2026-10-01: `SaveSetSheet` counts the run as unsaved, so the backdrop, ✕,
  Escape and a navigation all get the unsaved-changes question (see "Unsaved
  changes" below). "Don't save" still discards at once, because it says so.
  The sheet itself is gone since 2026-11-08: the player saves nothing.
- **Pause can let ~100 ms of already-scheduled clips through**, and the
  `AbortError` from a `play()` interrupted by a pause is swallowed.
- ~~**Stop then Play resumes mid-song**, and the `<audio controls>` is hidden
  outside a run, so there is no visible way to rewind at that moment.~~ Fixed
  2026-10-14: the song's progress bar shows on the setup screen too. Stop then
  Play still resumes where it stopped, which is now a choice.
- **Logged `duration_s` is SONG seconds, not wall clock**, so a run at 0.7×
  under-reports the time actually spent.
- Nothing adjusts the pool or the speed mid-run; `setPool` exists on the
  handle but is unused.

## Choreographies (phase 3)

Superseded by
[`2026-09-24-routines-design.md`](2026-09-24-routines-design.md), which
replaces this section and the `choreographies` / `choreo_steps` sketch in the
data model above with positions and the figure graph. Song-bound choreography
is out of scope there. Of its two slices, 3a (positions, `src/lib/graph/`, the
figure page's tagging, the gap report, and the drill's walk — since removed) and 3b (routines
themselves: `src/lib/routines/`, slots, variants, one-level embedding, and the
player walking one) are both live.

## Pure modules

No DB, no DOM, no `Date.now()` inside — `now` is always an argument.

| Module                   | Responsibility                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/day/`           | `localDay(instant, tz)`, `daysBetween(dayA, dayB)`. Anything a user reads as a day goes through here; elapsed milliseconds are only for sorting. (Same rule as muscle_model.) |
| `src/lib/schedule/`      | The Anki-style schedule: `replay` (gap and due day from the sets, one review per local day), `preview` (what each face sets), `dayList` (Today's rows), Coming up and the words. Replaced `src/lib/urgency/` 2026-11-05. |
| `src/lib/beatgrid/` (2)  | Beats + downbeats + corrections → count (1–8) and 8-count index at any song time; synthetic grid for count-only.                                                                       |
| `src/lib/scheduler/` (2) | Plan + grid + toggles + time window → list of `{at, clip}` events. The only impure part is a thin `attach.ts` that owns the `AudioContext`.                                            |
| `src/lib/graph/` (3a)    | Positions → which figures can follow which (`meet`: an empty side fits anything; positions by family), and the gap report (`positionCounts`). See the positions spec.                                                                      |
| `src/lib/routines/` (3b) | Slot algebra (union starts, a shared set of ends, one-level embedding) and `routinePlan`: a routine → the same `PlanStep[]` `extendPlan` produces. See the routines design.                    |

## Unsaved changes

Nothing typed is lost by leaving without a question. One dialog
(`src/lib/components/ui/UnsavedDialog.svelte`, mounted once in the root
layout) asks it everywhere, and `src/lib/unsaved/` is the list of what can be
unsaved.

- **What counts.** A form that someone fills in uses `use:guarded={{ label,
  submit }}` in place of `use:enhance` (`submit` is the same callback). It is
  unsaved while its `FormData` differs from what it showed at first paint or
  last saved — compared as data, so values set by code (start-position chips,
  timing shortcuts, rating buttons) count like typed ones. One-tap forms (a
  delete, a move, a shared picker's tap and +, see
  [`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md)) stay on `use:enhance`: there is nothing to
  lose. A form can widen the test (`dirty`): the player's finished run is unsaved with nothing typed (the Done sheet's typed note asks too). Non-form things
  register with `track()`: the voice page's unkept take, and an upload in
  flight.
- **When it asks.** Any in-app navigation (links, the bottom nav, back and
  forward — replayed with `history.go`, not pushed); a sheet's ✕, backdrop,
  Escape or Back (only about what is inside that sheet; the way out is
  "Close"); the session's Skip, Next and Finish ("Skip without saving"…).
- **Back on a sheet.** Each open sheet holds one shallow history entry
  (`page.state.sheets`, `src/lib/sheets/`), so Back — Android's button and
  gesture, the browser's — closes only the topmost sheet. A popstate between
  shallow entries runs no `beforeNavigate`, so the sheet asks its own question
  exactly as its ✕ does; if the user stays, the entry Back took is pushed
  again. ✕, the backdrop and Escape go back over the entry too, so history
  never keeps one for a closed sheet. A sheet closed by its page (a save, a
  link inside it) leaves an entry only when the page moved on, and Back onto
  it bounces straight past. The depth is read from the history entry, not
  from `page.state`, which `invalidateAll()` resets to {}. Known gaps:
  `startSession` leaves a stale `/[dance]` entry carrying `sheets: 1`, which
  Back bounces over in one press; a multi-step desktop Back (long-press
  history) over a sheet with unsaved work can ask twice; and the lesson
  page's light `LinkPopup` is its own `<dialog>`, not a Sheet, so Back there
  still leaves the page.
- **What it offers.** Save · Stay · *Leave* without saving. Save submits the
  real form(s) and waits for the server's answer: Saved ✓ then offers Leave or
  Stay; a failure shows the server's message with "Stay and fix it". A form
  that fails its own checks (an empty required name) is never sent — the
  dialog closes and the browser points at the field. Save is disabled, with
  the reason, while the count is playing.
- **What it cannot do.** A reload or a closed tab gets only the browser's own
  "Leave site?" — no page may show its own UI there. An upload only asks then:
  its XHR outlives an in-app navigation, so leaving the page does not stop it.
  A plain (unenhanced) form post — Archive, Duplicate, Log out — is let
  through: it was pressed on purpose, and it reaches the guard as an unload
  right after a submit that nothing prevented.
- **Not covered.** The coverage page's long-press selection is page state, not
  an edit, and is not guarded. Edit mode still has no Cancel; leaving is the
  way to discard.

The look (colours, type, icons, shared components) and the five tabs (Today, Moves, Lessons, Groups, Music) are in [`2026-10-31-redesign-design.md`](2026-10-31-redesign-design.md).
Which of them a person sees depends on their level (`tabsFor`): Everything has
all five; Practise and keep my own has Today, Lessons, Groups and Music; Follow
my class has Today and My class (the Groups route under that name). See
[`2026-11-05-levels-design.md`](2026-11-05-levels-design.md).

## Where you are

Where Back and the tabs lead (a pure trail of pages, each tab reopening where
you left it, a removed page and a finished Practice run going back to the page
that opened them) is specified in
[`2026-11-01-pages-keep-state-design.md`](2026-11-01-pages-keep-state-design.md).

## Get the app and fresh pages

A Get the app page (`/app`) hands friends the Android apps, and open pages and
the apps keep themselves current: a page epoch older pages are checked
against, a Reload bar, and the app's own updater. See
[`2026-11-03-app-updates-design.md`](2026-11-03-app-updates-design.md).

## Pending navigation

Every page has a server `load`, and SvelteKit keeps the old page on screen
until it answers, so a tap used to change nothing for a whole round trip. It
read as a missed tap. Now a tap answers at once, in three steps, all in the
root layout (`src/routes/+layout.svelte`, driven by `navigating` from
`$app/state`; the pure part is `src/lib/nav/pending.ts`):

- **Under the finger.** A link dims while pressed (`a[href]:active` in
  `layout.css`).
- **At once.** The destination's bottom tab lights, the accent
  follows the destination's dance, and a thin bar runs along the top (`NavProgress`).
  The bar runs on every navigation, a search or a day step included.
- **After 100 ms** (`SKELETON_DELAY_MS`) still waiting, a skeleton shaped like
  the destination covers the page (`PageSkeleton`): Today, a list (titled with
  the page's real name), or a detail page. Pages outside the shell (login,
  pairing, share) get the bar alone. Only a new PATH gets a skeleton: a
  search on Figures or a step to another day stays in view under the bar, so
  the field you typed in does not vanish.

The skeleton **covers** the old page and never replaces it. SvelteKit saves the
old page's scroll position only once the new data has arrived, so hiding it
would save a scroll of zero and break Back. A refused or failed navigation also
finds the old page exactly as it was. The cover stops at the top of the bottom
nav when the destination shows one, and sits above the bars pinned over a page's end (z-30).

Links already preload on touchstart (`data-sveltekit-preload-data="hover"` in
`app.html`), so the 100 ms is usually enough for a page to land without a grey
flash. If a page still feels slow behind its skeleton, the next step is to
stream its slow queries (return them un-awaited from `load`) rather than to
cache data on the client.

## Settings

Settings is pushed from Today (no tab). It saves on change: no Save button. It
shows this dance's default style only (the dance comes from the dance cookie;
the other dance's `default_styles` entry is untouched). The reminder is a
switch plus a time row; turning it on uses the time last shown, else 19:30.
My count shows one count pattern at a time (the band's segmented control;
`?pattern=`). Removing a paired phone toasts for 6 s with Undo, held 60 s on the server
(`src/lib/server/undo-hold.ts`, a server hold: the token hash never reaches the
page). Every page draws a band (`src/lib/nav/bands.spec.ts`).

`+error.svelte` shows the designed error page (`nav/error-view.ts`: 4xx show
their message, 5xx never show the server's; Back goes to the tab the failed URL
belongs to). Offline is caught before the navigation (`navigator.onLine`),
because SvelteKit answers an unreachable server with a full page reload; the
Offline layer lies over the current page so nothing typed is lost.

## Two languages

The app is in English or Slovenian, per account (`users.locale`, null is English).
The admin picks the language on an invite (`invites.locale`): Join, and the account
it makes, are in it. A `lang` cookie remembers the last language on a browser for
the pages drawn before sign-in; Settings has a switch at the top, and the admin page
sets a person's. Words live in typed catalogs (`src/lib/i18n/`, English the source,
Slovenian typed against it) read through `t()`; the server keeps the language per
request, never in a module variable. What people write and the count stay as they
are. Everything a person reads is translated: every page, sheet, toast, refusal and
error page, the admin page, and the Android app's own text (1.8, in the account's
language from `/api/device/config`). Machines keep English: the worker's queue, the
media servers' bodies, `/releases`, `/api/app-update` and the 426 a too-old app gets.
Text the app writes into the database (a template's notes, a copy's suffix) is in the
actor's language; text composed when read (History, Recently deleted, refusals) is in
the reader's. Two specs keep it so: every component's markup is checked for bare
English (`no-english.spec.ts`, a named few exempt) and every server refusal for an
English literal (`refusals-guard.spec.ts`). The register, the glossary, plurals,
cases, dates, numbers and the order of work are in
[`2026-11-07-slovenian-design.md`](2026-11-07-slovenian-design.md).

## Errors

- Form actions return validation failures that keep entered values; nothing
  fails silently.
- Upload too large → clear message before and after upload (client checks
  size first; nginx and the endpoint both enforce 300 MB).
- Analysis failures → `failed` with message, Retry, Upload instead (phase 2).
- Missing recording file on disk → recording shows "file missing", not a crash.

## Auth

Email + password, carried over from muscle_model: scrypt, session
cookie, login rate-limited per IP and per account, identical copy for wrong
password and unknown user, admin seeded from env (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`). No Cloudflare Access in front, same as muscle.

Single user until 2026-11-02. Accounts — the admin's one-time invites, the
owner wall inside each dance, storage limits — are in
[`2026-11-02-accounts-design.md`](2026-11-02-accounts-design.md). The owner
wall is a person or a group since step 2: see
[`2026-11-02-groups-design.md`](2026-11-02-groups-design.md).

## Testing

- **Vitest, pure modules first and thoroughly:** `day` (timezone edges,
  late-evening sets read next morning), `urgency` (ordering, never-done,
  done-today, inactive, ties), later `beatgrid` and `scheduler` (which clip on
  which count, where a routine's figures start, jumps, speed changes).
- **Server actions** against a temporary SQLite file: log set, delete set,
  create figure → exercise exists, rename propagates, archive propagates,
  upload size rejection.
- **Phone layout** checked at phone width in a browser during development;
  real-device checks (wake lock, iOS audio) by the user after deploy.
- `npm run check` = lint + types + build + tests, must pass before deploy.

## Deployment

Mirrors muscle_model's `docs/007-deployment.md`, minus Postgres.

- **NixOS repo** (`~/.config/nixos-config`):
  - `modules/services/ports.nix`: `salsa = 3060`.
  - `modules/services/salsa.nix`, modelled on `muscle.nix`: system user
    `salsa`, tmpfiles for `/var/lib/salsa{,/app,/recordings,/audio,/backups}`,
    `services.nginx.virtualHosts."salsa.anotherroot.eu" = publicAcme { port = …; }`
    plus `client_max_body_size 300m`, systemd unit (node 22,
    `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`, hardening as muscle,
    `ReadWritePaths=/var/lib/salsa`), agenix secret gated on
    `my.secrets.bootstrap`, a NixOS VM check.
  - Backup timer: nightly `sqlite3 salsa.db ".backup backups/salsa-<date>.db"`,
    keep 14.
  - `secrets/salsa-prod.env.age`: `DATABASE_PATH=/var/lib/salsa/salsa.db`,
    `DATA_DIR=/var/lib/salsa`, `ORIGIN=https://salsa.anotherroot.eu` (must be
    the public URL — CSRF), `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
    `TZ_USER=Europe/Ljubljana`.
  - Phase 2: `modules/services/salsa-worker.nix`, enabled per host with
    `my.salsa.worker.enable` (backtop first) (oneshot +
    1-minute timer, DynamicUser, MemoryMax 2G), secret `salsa-worker.env.age`
    (`SALSA_WORKER_TOKEN`) readable by cloud and laptop, and salsaapp as a
    private GitHub flake input (`git+ssh://git@github.com/anotherroot/salsero`).
- **Build first, then switch** on the shared host.
- **App repo:** `scripts/deploy.sh prod` — build locally, rsync `build/`,
  `package.json`, lockfile and `drizzle/`, `npm ci --omit=dev` on the box
  (`better-sqlite3` builds natively there), restart, health-check
  `http://127.0.0.1:3060/health` over loopback. Migrations run at app boot.
- DNS: nothing to do if the zone's wildcard reaches the box; otherwise a
  grey-clouded A record so ACME HTTP-01 works.

## Decided after review

- **Off-box backup:** the nightly backup job also copies recordings and the
  newest DB snapshot into `/home/tilen/Backups/salsa` on the server, shared by
  Syncthing as a send-only folder to `backtop` (receive-only). No `--delete`,
  so a deleted recording survives in the backup.
- **Timezone:** `Europe/Ljubljana` (stored on the user row, as muscle_model).

- **Recording size cap is 95 MiB, not 300 MB.** The hostname is behind
  Cloudflare's proxy, whose free plan rejects request bodies over 100 MB at the
  edge. nginx and `BODY_SIZE_LIMIT` sit at 100m, just above the app's own check.

- **YouTube downloads run at home, not on the server (phase 2).** Tested
  2026-09-22 with yt-dlp 2026.08.19: from the Hetzner IP every video, even a
  plain upload, fails with "Sign in to confirm you're not a bot"; from the home
  connection the same version downloads both a plain upload and an official
  label video. Design: pasting a URL creates a song with status
  `waiting_download`. A fetcher on a home host (a systemd timer declared in
  nixos-config, running every minute or so; `my.salsa.worker.enable`, on
  backtop first, laptop later) asks the server
  for waiting songs over HTTPS, downloads audio with yt-dlp, and uploads it back
  with a per-device token (agenix secret on both ends). The server then runs
  the beat analysis as for an uploaded file. Outbound-only from home: no
  tailnet membership, nothing exposed. Songs wait while laptop is off; the
  library shows "waiting for the home fetcher". Uploading a file stays the
  fallback. Cookies on the server were rejected (expiry, account-flag risk).

## Open items

- `better-sqlite3` is a native addon; its prebuilt binary may not load on
  NixOS. Verify on the server early in phase 1. Fallbacks: build it on the box
  with the toolchain in the unit's environment, or switch the Drizzle driver to
  `@libsql/client` (file mode).
