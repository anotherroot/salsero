# Exercise types — design

> **Status:** approved 2026-09-28; built 2026-09-28. Extends
> [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md) and
> [`2026-09-23-lessons-design.md`](2026-09-23-lessons-design.md); this document
> owns exercise types, the log popups, links, the in-popup practice player, and
> the exercise page. Modelled on the guitar app's exercise kinds
> (`~/Projects/guitar/docs/superpowers/specs/2026-09-23-exercise-kinds-design.md`).

## Purpose

Logging today is one generic sheet — minutes, reps, rating, note — whatever is
being logged, and practising means leaving it for the player page. But
reviewing a lesson, drilling a figure and switching from salsa to son are
different things to do:

- **Reviewing a lesson** means looking at it again: its notes, its videos, the
  YouTube links that until now sat unclickable in the notes.
- **Practising a figure** means seeing how it goes — its description,
  recordings, reference videos — and then dancing it, to a count, a clave or a
  song, without leaving the sheet.
- **A drill** (salsa ↔ son switching, clave clapping) wants the same count,
  clave or song, and a rating of how it went.

So an exercise gets a **type**, and the type owns its log popup. Tapping a row
opens the exercise; the **+** opens the popup.

## Vocabulary

| Term               | Meaning                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **Type**           | What kind of practice an exercise is: lesson review, figure practice, drill, routine. Derived from `source`. |
| **Log popup**      | The type's sheet: its content, its practice tools, and the form that logs a set.                          |
| **Link**           | A URL attached to a lesson, a figure or a drill. A YouTube URL renders as an embed.                       |
| **Practice panel** | The slim player inside the figure and drill popups: count, clave, song. No calls unless asked for.       |
| **Session**        | Walking Today's to-do list popup by popup, "Next →" after each log.                                       |

## Types

The type is **derived from `source`**; there is no new column. The four
sources already are four types, one-to-one:

| `source`  | Type                | Popup                                                        |
| --------- | ------------------- | ------------------------------------------------------------ |
| `lesson`  | **Lesson review**   | lesson content + log                                          |
| `figure`  | **Figure practice** | figure reference + practice panel + log                       |
| `custom`  | **Drill**           | description + links + practice panel + log                    |
| `routine` | **Routine**         | the routine's sequence + "Practise in player →" + log         |

**The type fixes which fields exist; instances differ only in content** (the
guitar app's rule). Two figure exercises never differ in whether they have a
rating. If two exercises ever need different fields, that is two types — and
then, and only then, a `kind` column that stops being derivable.

| Type            | Minutes | Reps | Rating question               | Note | Practice panel |
| --------------- | ------- | ---- | ----------------------------- | ---- | -------------- |
| Lesson review   | ✓       |      | "How well do you remember it?" | ✓    |                |
| Figure practice | ✓ auto  |      | "How did it go?"               | ✓    | ✓ + call on cue |
| Drill           | ✓ auto  | ✓    | "How did it go?"               | ✓    | ✓              |
| Routine         | ✓       |      | "How did it go?"               | ✓    | full player    |

"auto" means the practice panel fills it. Reps leave the figure form; sets that
already carry reps keep showing them — history is typed columns on `sets` and is
never rewritten by a redesign.

### Code shape

- **`src/lib/exercises/kinds.ts`** — PURE, client-safe. `typeOf(source)`, and
  per type: `label`, `fields` (`'minutes' | 'reps' | 'rating' | 'note'`), the
  rating question. Whether a popup has a practice panel is the popup's own
  choice, not a registry flag — one source of truth, the component.
- **`src/lib/components/exercises/kinds/<type>/Log.svelte`** — one popup per
  type: `lesson/`, `figure/`, `drill/`, `routine/`.
- **`src/lib/components/exercises/kinds/index.ts`** — `logFor(type)` returns the
  component. **Nothing outside a type branches on type**: Today, the exercise
  page and the owner pages ask the registry for the popup.
- **Duplication between types is deliberate.** The figure and drill popups look
  alike today; they share by importing (`PracticePanel`, `Reference`,
  `RatingChips`, `SetList`), never by an `{#if type === …}` inside a shared
  component.

### What every popup shares

- **"Last time"** at the top: `3 days ago · ★★★ · "lost the count at the break"`
  — the latest set's calendar-day distance (through `localDay`/`daysBetween`),
  rating and note.
- **The form** posts `?/log`; the day's sets for this exercise below it, with
  delete, as now.
- **"Details →"** to the exercise page, where settings now live.
- **Back-filling a past day** opens the same popup without the practice panel.
- **Session "Next →"** after a successful log, when a session is running (see
  Session below).

### Lesson review

Content, top to bottom: the lesson's day, its notes (URLs clickable), its
links (YouTube as embeds, others as rows), its uploaded videos, and its figures
as chips linking to each figure page. Then the form. No practice panel — a
review is watching and remembering, not dancing along.

### Figure practice

A **Reference** block — the figure's notes, its recordings, its links — open by
default, collapsible, so the practice panel is one tap from the top on a phone.
Then the practice panel with **call on cue** (below), then the form.

### Drill

The exercise's notes (its description) and its links, then the practice panel,
then the form.

### Routine

The routine's slot sequence as the routine page shows it, and **Practise in
player →**, which opens the full player with the routine exactly as the routine
page's Practise link does — calls and routines stay there, and that run saves
through the player's own save sheet. The popup's form is for a routine
practised away from the app.

## Links

```
links
  id           integer pk
  lesson_id    fk lessons, nullable
  figure_id    fk figures, nullable
  exercise_id  fk exercises, nullable   -- source = 'custom' only
  url          text not null            -- http: or https: only
  title        text, nullable           -- the user's label; null shows the host
  created_at   integer                  -- epoch ms
  CHECK ((lesson_id is not null) + (figure_id is not null) + (exercise_id is not null) = 1)
  index on each of the three foreign keys
```

- **The CHECK is safe because the table is new.** The "never add a CHECK" rule
  is about rebuilding an existing table; this one is created with it.
- **No `dance` column.** A link derives its dance through its owner, as sets
  and recordings do, and every read joins through the owner's `dance`.
- **"Custom exercises only" lives in the data function** (`addLink` refuses an
  exercise whose `source` is not `custom`): a figure's or lesson's exercise
  shows its owner's links, and a second place to attach one would make "where
  is this link?" unanswerable — the same reasoning as a figure's exercise never
  appearing twice on a lesson.
- **Hard delete**, like a recording or a lesson video. Archiving the owner
  keeps its links.
- **Order is insertion order.** There is no position column, as with lesson
  videos.

### `src/lib/links.ts` (pure, client-safe)

- `parseLink(url)` → `{ kind: 'youtube', id, start: number | null }` or
  `{ kind: 'web', host }`, or `null` for anything not `http:`/`https:` — so a
  `javascript:` URL can never be stored or rendered as a link.
- YouTube forms recognised: `youtube.com/watch?v=`, `youtu.be/<id>`,
  `/shorts/<id>`, `/embed/<id>`, `/live/<id>`, the `m.`, `www.` and `music.`
  hosts, and `t=` / `start=` in seconds or `1m30s` form. `youtube-nocookie.com`
  too.
- `extractUrls(text)` → the URLs in free text, trailing `.,;:!?` and an
  unbalanced `)` trimmed. Used by the notes import and by linkified notes.
- `textPieces(text)` → `{ text } | { url }` runs, so notes render URLs as links
  without `{@html}` — the repo has none, and this keeps it that way.

### Rendering

- **YouTube** starts as a thumbnail card (`i.ytimg.com/vi/<id>/hqdefault.jpg`)
  with a play button. Tapping swaps in a
  `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&start=<s>` iframe —
  so a lesson with five links does not load five players on mobile data. An
  **Open on YouTube ↗** link always sits beside it: the work PC's browser may
  block embeds.
- **Other links** are a row: title (or host), and ↗. `target="_blank"
  rel="noopener noreferrer"`.
- **Editing**, on the lesson, figure and drill (exercise) pages: an "Add link"
  field taking one URL per line (paste several at once) and an optional title
  that applies when a single URL is added; delete per link. Unparseable lines
  come back as a validation failure naming them, keeping the entered text.
- There is no Content-Security-Policy today, so the iframe needs no header
  change. Adding one later must allow `frame-src https://www.youtube-nocookie.com`
  and `img-src https://i.ytimg.com`.

### Importing the URLs already in lesson notes

Lessons have YouTube links typed into their notes. A boot step,
`importNoteLinks(db)` beside `seedPositions` in `bootstrap.ts`, copies every URL
`extractUrls` finds in each lesson's notes into that lesson's links (skipping a
URL the lesson already has). The notes themselves are not edited — they render
linkified anyway.

It runs **once ever**, guarded by a marker row in a new table:

```
app_flags
  key       text pk
  done_at   integer   -- epoch ms
```

Insert-or-ignore the marker and the links in one transaction; if the marker was
already there, do nothing. So a link deleted afterwards stays deleted. A boot
step rather than a migration because SQLite has no regex: extracting URLs in
migration SQL would be a hand-rolled scanner nobody can test, and this is a
tested pure function.

## The practice panel

`src/lib/components/player/PracticePanel.svelte`, used by the figure and drill
popups.

**Collapsed**, it is one line and one button: `Practise with: count 180 · son ·
clave 2-3  ▶` — so a single tap plays what was used last time. **Expanded**:

- **Source:** count only, or a song (this dance's ready songs).
- **Tempo:** BPM (60–300) for count only; speed 0.7–1.0× for a song.
- **Count pattern:** the dance's `countPatterns`, from the registry.
- **Clave:** off / 2-3 / 3-2 — rendered only when `dance.clave`.
- **Call on cue** (figure popup only): off / every 2 / every 4 eights.
- **While running:** pause/resume, stop, the big count (`LiveCount`), elapsed
  wall-clock time, and the voice-volume slider (live, as in the full player).

### Engine

`createPlayer` from `src/lib/scheduler/attach.ts`, unchanged:

- `pool: []` and `callEvery: null` — nothing is called. With **call on cue**,
  `pool: [figureId]` and `callEvery: 2 | 4`; `pickFigure` already returns the
  only id in a one-figure pool (the no-repeat rule applies only to pools of two
  or more), and a flow whose `eights` is the figure's own keeps a multi-eight
  figure from being called over itself. `sayOf` is the figure's `call_text` or
  name.
- **Count only:** `audio: null`, grid `syntheticGrid(bpm, bars)` with `bars`
  sized for an hour (`ceil(bpm * 60 / 8)`), not the player page's 400.
- **The user's recorded count takes** when they exist, falling back to the
  shipped clips, as the player does.
- The count and clave chips move out of `player/Setup.svelte` into
  `player/CountChips.svelte` and `player/ClaveChips.svelte`, used by both the
  full player and the panel — extracted, not copied.

### Loading without slowing down Today

- Today's load keeps its ready-song list (`id`, `title`) and adds the count-take
  metadata (a few rows).
- A song's grid comes from **`GET /[dance]/songs/[id]/grid`** → `{ audioFile,
  beats, counts }`, built by `buildGrid` as the player's load does, guarded by
  the dance wall. Under `/[dance]/` rather than the flat `/api/` so the slug is
  in the URL and `danceOf` + `requireSongInDance` apply unchanged. It is fetched when a song is **selected**, or when the popup
  opens with a remembered song — never on the Play tap, because iOS wants
  `start()` inside the gesture, and the `<audio>` element must already have its
  `src` when that happens.
- A remembered song that is no longer ready (archived, failed) reads "Its song
  is not ready — pick another", as the log sheet says now.

### Remembered per exercise

- Reuse `practice_mode` (`'count' | 'song'`; `'none'` now just means "never
  practised", and the panel opens on count), `song_id` and `count_bpm`.
- One additive column, **`exercises.practice_json`** (text, nullable):
  `{ count, clave, speed, callEvery }`. Parsed by **`parsePracticeConfig`** in
  `src/lib/exercises/practice.ts`, which is **total**: anything missing or
  invalid falls back to the dance's defaults, so a bad value can never break a
  popup.
- Saved on **Play**, not on every tap, by a JSON
  `POST /[dance]/exercises/[id]/practice` — no navigation, no reload, and
  failure is silent (the run still plays; the settings are a convenience). An
  endpoint rather than a form action, so the four pages that open a popup do
  not each have to register it. It validates against the registry (count
  pattern in the dance's list, clave only where the dance has it, a song ready
  and in the dance) through the pure `parsePracticeInput`.
- The "Practice" mode radio, the song picker and the BPM field leave the
  exercise settings: the panel is where they are chosen now.

### Duration, and what the set records

- The panel sums **wall-clock** playing time, pauses excluded. Stop — or the
  song ending, or the grid running out — fills **Minutes** (rounded, at least 1)
  and a hidden `durationS` with the exact seconds. Typing into Minutes clears
  `durationS`, so a hand-entered value wins.
- This retires the player's known gap "logged `duration_s` is SONG seconds"
  for the panel; the full player keeps its behaviour for now.
- The set's `player_json` is `{ source, songId, bpm, speed, count, clave,
  callEvery, calls }` — the full player's shape plus `source`/`songId`/`bpm`,
  with `called` omitted (one figure). Nothing queries inside it, as before.

### A run cannot be lost by accident

- While running, with unsaved panel time, or with anything typed in the log
  form (minutes, reps, rating, note), the backdrop tap, Escape, the ✕, Skip,
  Next, Finish and a navigation do **not** leave the popup straight away: they
  get the app's one unsaved-changes dialog (Save · Stay · Close / Skip without
  saving — see the main design's "Unsaved changes"). Never a browser
  `confirm()`. Save is disabled while the count plays ("Stop the count to log
  it."). This replaced, on 2026-10-01, the inline "Discard 4 min of
  practice?" banner and `Sheet`'s `guard` prop, which covered practice time
  only.
- Closing the popup, navigating away or unloading stops the player (`onDestroy`
  plus `beforeunload`, as the player page does). The wake lock comes with
  `createPlayer`.

## Videos: mirror and slow motion

Every video the popups and pages show — recordings, lesson videos, YouTube
embeds — gets a **Mirror** toggle, so a teacher facing the camera can be
followed as in a mirror. `transform: scaleX(-1)` on the `<video>` or the
`<iframe>`; the embed's own controls mirror with it, which is the accepted
cost. Uploaded videos also get **0.25× / 0.5× / 0.75× / 1×** (`playbackRate`,
`preservesPitch`); YouTube embeds keep YouTube's own speed menu, since changing
it from outside needs the IFrame API and a script from youtube.com.

One component, `ui/VideoFrame.svelte`, wraps the element and the two controls;
figure recordings, lesson videos and link embeds all use it. Mirror and speed
are never in the database — the last-used choice is remembered in
`localStorage` (wrapped in try/catch), a per-viewer convenience only.

## The exercise page

`/[dance]/exercises/[id]`, for every type. Guarded by `scope.ts` like every id
route: an exercise of the other dance is a 404.

- **Header:** name, type badge, and the owner — "Figure · Enchufla →",
  "Lesson · 21 Sep →", "Routine · Friday combo →"; none for a drill.
- **Content:** the same `Reference` the popup shows. Links are editable here
  only for a drill; for a figure or lesson, "Edit on the figure page →".
- **Log a set** — a big button opening the type's popup, here.
- **Settings** (moved out of the popup): name (drill only), frequency, active,
  and **practice notes** (`exercises.notes`) — the description for a drill,
  kept distinct from the figure's or lesson's own notes for the owned types,
  since existing rows already use it. Archive, drill only.
- **History:** every set, newest first, grouped by calendar day, with delete;
  a summary on top — `23 sets · 4 h 10 min · last 5 ★ 3.8`. Latest 200 sets;
  the summary counts all of them.

## Today

- **The row body is a link** to the exercise page (an `<a>`, so back and
  open-in-new-tab work).
- **The + opens the type's popup.** It no longer logs a bare set: the popup is
  where a set gets its minutes and rating, and one extra tap is the price.
- **The last set's rating** shows on the row as five small dots (filled up to
  the rating), after the "last done" text — weak spots stand out without
  opening anything. Nothing for an unrated last set. Attached to each row by
  the Today load after `plan()` returns; `src/lib/urgency/` does not learn
  about ratings.
- **The popup's content loads when it opens**, from
  **`GET /[dance]/exercises/[id]/practice`** → the type's content plus the "Last
  time" set. The form renders immediately and the content fills in, so Today's
  load stays as light as now.

### Session

A **Start session** button above the Due band (hidden when Due and Not yet due
are both empty):

- It opens the popup of the first row in Due (or Not yet due, when Due is
  empty) and puts `?session=1` in the URL.
- After a successful log, the popup shows **Next: \<name\> →** — the first row
  of Due, then Not yet due, after the page's data has refreshed (the logged one
  has moved to Done today). "Skip →" moves on without logging.
- When nothing is left, the popup reads "Session done — N exercises, X min" (the
  sets logged since the session started, counted client-side) and closes on the
  next tap.
- No server state: the session is the URL flag and the page's own bands. A
  reload keeps the flag and resumes at the current first row.

## One logging path

`src/lib/server/log-form.ts` holds the parsing and the two actions — `log`
and `deleteSet` — and every page that opens a popup registers them: Today, the exercise page, the figure page, the lesson page. This replaces
the three bare-log actions the figure, lesson and Today pages each carry today.

- `log` reads `exerciseId`, `durationMin` or `durationS`, `reps`, `rating`,
  `note`, `run` (player_json, ≤ 4000, dropped if longer, as the player does) and
  `day` (back-fill), and only the fields the exercise's type has — a figure form
  posting `reps` is ignored, not stored. The exercise must be in the page's
  dance (`scope.ts`), or it is a 404.

## The owner pages

- **Figure page:** "Log set" (a bare log) becomes **Log…** (the popup) and
  **Exercise →**. Gains a **Links** editor, the mirror/speed video frame, and a
  **Taught in** section — the lessons that linked this figure, newest first.
  The link was visible only from the lesson side.
- **Lesson page:** **Log…** / **Exercise →** the same way, a **Links** editor,
  and the video frame. Its hand-linked exercises become tappable — each opens
  its exercise page, with a **+** for its popup — where today they are plain
  text with no way in.
- **Routine page:** gains **Exercise →**; its Practise link is unchanged.

## Also fixed

- **The player page prints source code.** A stray `const activeSlot = …` line
  after `</script>` in `src/routes/[dance]/player/+page.svelte` renders as text
  (left by the routine-practice commits). Removed.

## Data model changes

```
links        new table (above)
app_flags    new table (above)
exercises    + practice_json  text, nullable   -- additive ADD COLUMN
```

No CHECK on an existing table, no rebuild. The generated SQL is read before
committing, and `migrate` is run against a copy of the real database, as the
lessons work did.

## Testing

Pure and data modules, as ever; no route or component tests, matching the repo.

- **`links.spec.ts`** — every YouTube form (watch, youtu.be, shorts, embed,
  live, m./music./nocookie hosts), `t=` in `90` and `1m30s`, non-http schemes
  refused, `extractUrls` trimming punctuation and handling a URL inside
  parentheses, `textPieces` round-tripping the text.
- **`kinds.spec.ts`** — every source maps to a type; each type's fields.
- **`practice.spec.ts`** — `parsePracticeConfig` is total: garbage, wrong
  types, a count pattern of the other dance, clave on bachata → defaults.
- **Data** against `openDb(':memory:')` — links added and deleted per owner, a
  link on a non-custom exercise refused, links invisible across dances;
  `importNoteLinks` runs once and never again, even after a deleted link, and
  skips duplicates; the log helper stores `durationS` and `player_json` and
  ignores fields the type lacks; the exercise page's history and summary; the
  Taught-in lookup; the last rating on the plan row.
- **By hand, against `node build`:** each popup at phone width; a count-only
  run filling Minutes; a song run on a hand-inserted test song (see CLAUDE.md);
  call on cue; the session walking Due; mirror on a recording and an embed.

## Known gaps

Found by review, consciously not fixed before shipping. Check here before
hunting one of these as a new bug:

- **Chrome lets a second Escape close a guarded popup** — its anti-trap rule
  for `<dialog>` overrides the first Escape's guard on the second press within
  the browser's own short window. Since 2026-10-01 the first Escape opens the
  unsaved-changes dialog as a modal on top, so the second should land on that
  (meaning Stay) rather than on the popup. Not yet checked with a real
  keyboard; synthetic events do not reproduce the anti-trap rule.
- **The popup's content is one request after opening.** The form and "Last
  time" render from the page's own data; the type's content (`GET
  /[dance]/exercises/[id]/practice`) fetches once the popup opens, so on a
  slow connection the form is usable before the reference has loaded.
- **Mirroring a YouTube embed mirrors its own controls too** — `VideoFrame`
  flips the whole `<iframe>`, since a YouTube embed offers no way to mirror
  only the picture. Accepted, as the spec already says.
- **The full player still logs song seconds**, not wall clock — unchanged.
  `SaveSetSheet` keeps `duration_s` from the song's own clock; only the
  practice panel measures wall-clock time.
- **"Log set" is disabled while the practice panel plays.** The popup's submit
  button is `disabled={busy || playing}` — Stop first, then log. Matches "a
  run cannot be lost by accident": the numbers a mid-run log would capture are
  not final yet.
- **The big 1–8 count is animation-frame driven**, so it freezes while the tab
  is hidden or the phone is locked; the audio (and the count spoken aloud)
  carries on regardless. Only the on-screen digit stalls.
- **The one-time lesson-notes link import ran at the first boot after
  deploy.** `importNoteLinks` is guarded by the `app_flags` marker and runs
  once ever, so a lesson written or edited after that boot keeps its URLs
  clickable in its notes (`textPieces` linkifies on every render) but does not
  get them added to its links list unless the user adds them by hand.
- **The log/Minutes/run state in the popup has no component tests** — the
  repo has no DOM harness, so `LogShell`'s run tracking, the Minutes/durationS
  handoff and the discard confirmation were verified by hand in a browser
  against `node build`, not by an automated test.

## Not built

- **Editing a set** (the guitar app has it). Delete and re-log, as now.
- **"Log & another."** A dance set is rarely logged twice in a row.
- **A/B loop on videos.** YouTube's own player and the video frame's speed
  cover the common case.
- **The full player's wall-clock duration.** Only the panel measures wall
  clock; the player's known gap stands.
