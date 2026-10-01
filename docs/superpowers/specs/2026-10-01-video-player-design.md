# Full-screen video player and spots — design

> **Status:** approved in brainstorming, 2026-10-01. Extends
> [`2026-09-28-exercise-types-design.md`](2026-09-28-exercise-types-design.md)'s
> "Videos: mirror and slow motion", which stays the inline player; this
> document owns the full-screen player and saved spots.

## Purpose

A move is learned from a recording by taking it apart: slow it right down,
step back a second, watch the same four counts again and again. The inline
player is the browser's own `<video controls>`, and its fullscreen is the
browser's too — on an iPhone that is iOS's player, which shows no web
controls at all. So the tools for taking a move apart cannot live there.

This adds our own full-screen player, opened from any uploaded video, with
±1 s steps, 0.25×–1× speed, mirror, and **spots**: saved moments and
sections of a video. Tapping a point jumps to it; tapping a section loops it.
Spots are stored per video in the database, so a section marked on the work
PC is there on the phone.

Asked and decided: spots apply to **both** figure recordings and lesson
videos; loops are **saved** sections rather than throwaway A/B points.
Audio-only figure recordings keep the inline player only.

## The inline player

`ui/VideoFrame.svelte` keeps its native controls, Mirror and the speed row
(now 0.25 / 0.5 / 0.75 / 1). It gains one button, **Full screen**, next to
Mirror, shown for `kind === 'video'` only. Mirror and speed are shared with the
full-screen player through `src/lib/video-prefs.ts`, as today.

## The full-screen player

`ui/VideoPlayer.svelte` (new). A fixed, black, full-viewport layer
(`position: fixed; inset: 0`) holding a `<video>` without `controls` and our
controls on top.

**Fullscreen.** Where `Element.requestFullscreen` exists (Android, desktop),
the layer requests it on open and exits on close; leaving browser fullscreen
(Esc, the back gesture) closes the player. Where it does not (iPhone), the
fixed layer is the fullscreen: from the home-screen app there is no browser
chrome, so it fills the screen. The layout works in both orientations; the
phone is rotated by hand.

**Controls.**

- **Top bar:** close (×), Mirror, speed 0.25 / 0.5 / 0.75 / 1.
- **Progress bar:** a scrubbable range input with spots drawn on it — a tick
  per point, a shaded band per section — and the current time and duration.
- **Main row:** −1 s, Play/Pause, +1 s, **Mark**, **Section**.
  - **Mark** saves the current time as a point.
  - **Section** is two taps: the first remembers the current time as a start
    and relabels the button **End section**; the second saves the section. A
    second tap at or before the start is ignored with a short note. Closing the
    player drops a pending start.
- **Spots (n):** opens a panel listing the spots by start time. A point jumps
  there. A section jumps to its start and becomes the active loop. Each row can
  be renamed (no label shows its time, `2:14.5` or `2:14.5–2:22.0`) or deleted.
- **Looping chip:** while a loop is active, `Looping 2:14–2:22 ×` sits above
  the main row; × ends the loop. Deleting the looped spot ends it too.
- **Hiding:** while playing, controls fade after 3 s; a tap on the video brings
  them back. Paused, they stay.

**Keyboard** (the work PC): Space play/pause, ← / → ∓1 s, M mark, S section
start/end, L end loop, Esc close. Ignored while typing in a rename field.

**The loop.** Checked on every animation frame while playing, not on
`timeupdate` (~4 Hz, which would overshoot a quarter-second at 1×): once
`currentTime` reaches the section's end, seek to its start. Seeking past the
end — scrubbing, +1 s — therefore lands back at the start; seeking before the
start plays on into the section. Only ending the loop (×, L, deleting the spot)
lets playback leave it.

## Data model

```
video_spots
  id               integer pk
  recording_id     fk recordings, nullable
  lesson_video_id  fk lesson_videos, nullable
  start_ms         integer not null       -- ms into the video, >= 0
  end_ms           integer, nullable      -- null = a point; else > start_ms
  label            text, nullable         -- null shows the time
  created_at       timestamp
  CHECK exactly one of recording_id, lesson_video_id
  CHECK end_ms is null or end_ms > start_ms
  index on recording_id, index on lesson_video_id
```

The CHECKs are safe because the table is new; the "never add a CHECK" rule is
about drizzle-kit rebuilding an existing table. Read the generated SQL: it must
be one `CREATE TABLE` and its indexes, nothing touching `recordings` or
`lesson_videos`.

`start_ms` and `end_ms` are positions inside a media file, not instants, so the
epoch-ms rule does not apply; they are integers for the same reason.

**No `dance` column.** A spot is the dance of its video, which is the dance of
its figure or lesson — resolved through the parent, as recordings and links
are. Hard-deleted, like a recording or a link.

**Deleting a video deletes its spots.** `deleteRecording` and
`deleteLessonVideo` delete the video's spots and then the row in one
transaction. Without it the foreign key refuses the delete.

## Server

`src/lib/server/spots.ts`, every function taking `db` first:

- `listSpots(db, owner)` — `owner` is `{ recordingId }` or `{ lessonVideoId }`;
  ordered by `start_ms`, then `id`.
- `addSpot(db, owner, { startMs, endMs, label })` — returns the row, or null
  when the owner does not exist.
- `renameSpot(db, id, label)` — returns the row or null.
- `deleteSpot(db, id)` — returns whether a row went.

Validation lives here, not in the route: `startMs` a non-negative integer,
`endMs` null or an integer greater than `startMs`, `label` trimmed, empty
becomes null, at most `MAX_SPOT_LABEL` (80, in `src/lib/limits.ts`)
characters. A bad value throws a typed error the route turns into a 400.

## API

Flat, like the other `/api/*` routes, and private by the deny-by-default hook
(an unauthenticated `/api/` request is a 401). JSON in and out.

| Request                                                        | Answer                    |
| -------------------------------------------------------------- | ------------------------- |
| `GET /api/video-spots?recording=12` or `?lessonVideo=7`        | `Spot[]` by start time    |
| `POST /api/video-spots` `{recordingId \| lessonVideoId, startMs, endMs, label}` | the new `Spot` |
| `PATCH /api/video-spots/[id]` `{label}`                        | the updated `Spot`        |
| `DELETE /api/video-spots/[id]`                                 | 204                       |

A missing video or spot is a 404; a malformed body, both or neither owner, or
an invalid time or label is a 400. `Spot` is a row shape in
`src/lib/types.ts`, since the player is a component.

The media servers already serve these files without a dance in the URL, so a
flat spots API crosses no wall the media does not.

## Client

`src/lib/video/spots.ts` — PURE, client-safe:

- `spotTime(ms)` → `2:14.5`; `spotLabel(spot)` → its label or its time range.
- `step(current, delta, duration)` → the new time, clamped to `[0, duration]`.
- `sortSpots(spots)` — by start, then id.
- `loopTarget(current, loop)` → the time to seek to, or null to keep playing.

`ui/VideoPlayer.svelte` fetches the spots when it opens, and writes each change
straight through the API, updating its list from the response. A failed fetch
or write shows "Couldn't save" (or "Couldn't load spots") and leaves the list
as it was — never an optimistic row that might not exist.

## Testing

- `src/lib/video/spots.spec.ts` — formatting, clamping at 0 and the duration,
  ordering, `loopTarget` before, at and past the end and with no loop.
- `src/lib/server/spots.spec.ts` on `openDb(':memory:')` — add, list, rename,
  delete; each validation; the one-owner CHECK; deleting a recording and a
  lesson video takes their spots.
- `src/routes/api/video-spots/video-spots.spec.ts` with
  `vi.mock('$lib/server/db')`, as `dance-wall.spec.ts` does — 404 for a
  missing owner or spot, 400 for bad bodies.
- In the browser against `npm run dev`: open a lesson video full screen, 0.25×,
  ±1 s, a point and a section, the loop holding, the keyboard, a phone-width
  viewport.
- `npm run check` passes.

## Known gaps

- **iPhone in a Safari tab** keeps Safari's own bars around the layer; only the
  home-screen app is truly full screen. iOS offers no fullscreen API for
  anything but its own video player.
- **No orientation lock.** `screen.orientation.lock` works only inside browser
  fullscreen on Android and not at all on iOS, so the phone is rotated by hand.
- **YouTube embeds** get no full-screen player or spots: controlling one from
  outside needs the IFrame API and a script from youtube.com.
