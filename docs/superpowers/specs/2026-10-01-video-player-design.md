# Full-screen video player and spots — design

> **Status:** approved in brainstorming, 2026-10-01; live since 2026-10-01. Extends
> [`2026-09-28-exercise-types-design.md`](2026-09-28-exercise-types-design.md)'s
> "Videos: mirror and slow motion", which stays the inline player; this
> document owns the full-screen player and saved spots.
>
>
> Its screens were redesigned on 2026-10-29 (three levels, a section editor,
> frame steps, back up one level), and again for upright videos the same day
> (Hide, a row of sections, 0.1 s steps, zoom, double-tap, the screen kept on);
> the sections below describe the result. Why, and what was decided:
> [`2026-10-29-video-player-redesign-design.md`](2026-10-29-video-player-redesign-design.md) and
> [`2026-10-29-video-player-upright-design.md`](2026-10-29-video-player-upright-design.md).
>
> **Linking from the player** (2026-10-29,
> [`2026-10-29-section-link-popup-design.md`](2026-10-29-section-link-popup-design.md)):
> where the page manages the video's sections (a lesson's videos, a figure's
> recordings; the `linking` prop), the "Section saved" toast offers **Link**
> beside Edit and stays 6 s; the section view shows a small link badge under
> the section's name on the video ("+ Link" when nothing is linked); and the
> editor's "Linked to …" line opens the Link popup. The popup is two player
> sheets, `link` (its list) and `link-new` (a create step), so Back steps from
> a create step to the list, then closes it. Everywhere else the player opens,
> the badge and the line only show.

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

`ui/VideoPlayer.svelte`. A `<dialog>` opened with `showModal()`, filling the
viewport, holding a `<video>` without `controls` and our controls. `showModal()`
puts it in the top layer, above the Today popup — itself a modal dialog — so
it opens from there too. Browser fullscreen is requested on an inner stage
`<div>` inside the dialog, not on the dialog itself. Its screens are small
components in `src/lib/components/video/`; everything that can be decided
without a DOM is a pure module in `src/lib/video/`. Redesigned 2026-10-29: the
why, and the decisions taken in brainstorming, are in
[`2026-10-29-video-player-redesign-design.md`](2026-10-29-video-player-redesign-design.md).

**Three levels**, a stack (`src/lib/video/screens.ts`): the **full video**;
a **section view** (one section, looping, with a timeline of just that
section); the **editor** (one spot). Sheets — rename, delete, the key list,
and the landscape list panel — sit on top as screens of their own. Tapping a
section card opens its view; tapping a point opens its editor (a point has
nothing to loop). Edit section opens the editor; Done returns a section to
its view and a point to the full video. `‹ Full video` leaves a section. ✕
closes from anywhere. `SectionPlayer` (a linked section card) opens straight
into the section's view.

**The loop is the section view.** A loop runs only while a section's view or
editor is open (`loopOf`); leaving the view ends it, so the full video never
loops. The editor's Loop toggle rests it for that editor visit only.

**Back goes up one level.** Each screen is a history entry made with
SvelteKit's shallow routing (`pushState('', { videoPlayer: depth })`, typed in
`App.PageState`); `src/lib/video/player-history.ts` keeps the stack in step
behind an injected port. Back — Android's gesture, the browser's button, Esc
(the dialog's `cancel`, prevented) — only moves history, and the stack
follows when `page.state.videoPlayer` changes. ✕ goes back over every entry.
SvelteKit treats a popstate between entries of one navigation as shallow: it
updates `page.state` and runs no `beforeNavigate`, so the unsaved-changes
guard never sees these moves. Leaving browser fullscreen (Esc, or Android's
back in the app, which `WebShell.back()` spends on fullscreen first) counts
as one back too: the player stays open filling the viewport and never asks
for fullscreen again. If Chrome closes the dialog under us (a repeated back
on a modal dialog), it is reopened and treated as the back it was.

**Layouts** (`layoutFor`): **portrait** (taller than wide), laid out for an
upright video — every control below the video, so nothing covers the picture
(the feet), sized first: the video takes what is left, whole and centred, and
keeps at least 120 px (below that only the editor scrolls). **Hide** folds the
controls of the full video and the section view to a slim bar (the timeline,
Show, −0.1 s / Play / +0.1 s, the time), remembered per browser beside mirror
and speed; the editor ignores it. Sections sit in one sideways row of chips
(`SectionRow.svelte`): **All · n** opens the full list as a sheet under the
video, with **Edit** on every card; **landscape** (a phone on its side,
under 520 px high) — the video fills the screen and the controls float over
it, fading after 3 s of playing (a tap brings them back), while the editor
and the `Sections (n)` list open as a panel beside the video; **desktop** — the
video with its timeline and transport below and a key legend, a sidebar list
whose open card expands into the editor. The four areas keep one DOM order
re-arranged by a CSS grid, so rotating the phone never remounts the video.

**Full video:** the time to hundredths, a scrubbable timeline with sections as
bands and points as ticks (and the band of a section being marked),
−1 s / −0.1 s / Play / +0.1 s / +1 s, **Mark point** and
**Start section** (which becomes `End section · 3.2 s`; an end less than
`MIN_SECTION_MS` past the start saves nothing and says so), and the row of
sections (portrait) or the list (`Sections (n)` in landscape, the sidebar on
the desktop). A save shows a toast with **Edit**.

**Section view:** on a phone the top bar carries `‹ Full video` and **Edit**
(coloured in portrait, where the name moves onto the video as a badge); then
`2.7 / 7.2 s`, a timeline from the section's start to its end, a large
transport and, in portrait, the row of sections with this one lit — tapping
another switches in place. A chip or a list card always opens its level right
above the full video, so Back goes there. A thin bar along the video's bottom
edge shows the loop's progress.

**Editor:** the name (a button: it opens the rename sheet, never a focused
field, so the phone's keyboard opens only when the field is tapped), the
Loop toggle, a **trim strip** (`TrimStrip.svelte`, `trim.ts`: the spot ± 3 s,
a handle per edge with a 28 px grab, drag to move an edge, tap elsewhere to
seek; the window holds still during a drag and widens on release when an
edge comes within 0.5 s of its side), **Start | End** selectors that choose
the edge and jump to it, the move row (−1 s, −0.1 s, Now, +0.1 s, +1 s on
the chosen edge), and for a section **Earlier / Shorter / Longer / Later**
(`shiftSpot` 0.5 s, `resizeSpot` 0.25 s each side). Every button computes the
new times with the pure functions in `spots.ts` and is disabled when they
say nothing changes. ±1 s and the whole-section moves play the change (from
the start, or the 2 s up to the end); ±0.1 s and a drag pause where the edge
shows (`edgeViewTime`: a start itself, an end 10 ms inside); Now sets the
edge without seeking. A drag snaps to hundredths and writes once, on release.
The list is not re-sorted while an editor is open.

**Delete** asks first, in a sheet: `Keep it` / `Delete`. A linked section
says what it is linked to and its Delete is disabled; a 409 that slips
through is shown in the sheet. After a delete a toast offers **Undo**, which
posts the same times and label again (a new id — harmless, a deleted spot
was never linked).

**The fine step is 0.1 s** (`TENTH_MS`), everywhere: a step pauses, then
seeks. Frame steps were tried first and dropped — at 60 fps a frame is 17 ms
and a step showed nothing.

**On the picture** (`VideoGestures.svelte`, with `zoom.ts` and `taps.ts`): a
tap plays or pauses (in landscape, brings faded controls back first); a double
tap on the left or right third jumps 1 s, each further tap on that side within
0.6 s another (`« 3 s`), so a single tap on a side waits ≈ 250 ms to be sure;
two fingers zoom 1×–4× about the point between them, one finger moves a zoomed
picture without ever leaving a gap at its edges, Ctrl+wheel (a trackpad
pinch) zooms on the PC. A `Zoom 2× · Reset` chip shows while zoomed; zoom
survives level changes and rotation (re-clamped to the new box) and is gone
on close.

**The screen stays on** while the player is open, playing or paused
(`screen-on.ts`, `navigator.wakeLock` — which the Android app provides in its
WebView — taken again whenever the page comes back).

**Keyboard** (`keys.ts`): Space, ← / → ∓1 s, `,` / `.` ∓0.1 s, `?` the key
list — everywhere; M and S at the full video; I / O (start / end to now) in
the editor; [ / ] (jump to start / the last 2 s) in a section's view and
editor; L (rest the loop) in the editor; Esc up one level. Ignored while
typing and with Ctrl/Cmd/Alt held.

**The loop** is checked on every animation frame while playing, not on
`timeupdate` (~4 Hz, which would overshoot a quarter-second at 1×): once
`currentTime` reaches the section's end, seek to its start. Seeking past the
end — scrubbing, +1 s — therefore lands back at the start; seeking before the
start plays on into the section.

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
transaction. Without it the foreign key refuses the delete. A section linked to
a figure or drill blocks both deletes, and the spot's own (a 409 from the API,
whose message the player shows): see
[`2026-10-15-video-section-links-design.md`](2026-10-15-video-section-links-design.md).

## Server

`src/lib/server/spots.ts`, every function taking `db` first:

- `listSpots(db, owner)` — `owner` is `{ recordingId }` or `{ lessonVideoId }`;
  ordered by `start_ms`, then `id`.
- `addSpot(db, owner, { startMs, endMs, label })` — returns the row, or null
  when the owner does not exist.
- `updateSpot(db, id, { label?, startMs?, endMs? })` — changes only the keys
  sent and returns the row, or null. The times are validated merged with the
  stored ones; a point cannot gain an end nor a section lose one.
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
| `PATCH /api/video-spots/[id]` any of `{label, startMs, endMs}`  | the updated `Spot`        |
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
- `moveEdge(spot, edge, toMs, duration)` → the spot's times with one edge moved
  and clamped, or null when that changes nothing.
- `TENTH_MS`, `edgeViewTime` — the fine step; `sectionProgress` (`2.7 / 7.2 s`);
  `shiftSpot`, `resizeSpot` — the whole-section moves; `preciseTime` (`1:04.23`)
  and `lengthText` (`7.2 s`).

Beside it, all PURE and specced: `trim.ts` (the trim strip's window,
positions and handles), `screens.ts` (the stack, `loopOf`, `doneTarget`,
`prune`), `keys.ts`, `layout.ts`, `player-history.ts` (behind a port),
`zoom.ts` (fit, clamp, pinch, pan, wheel), `taps.ts` (single, double, which
side, chained) and `screen-on.ts` (the wake lock, behind an injected
environment).

`ui/VideoPlayer.svelte` fetches the spots when it opens, and writes each change
straight through the API, updating its list from the response. A failed fetch
or write shows "Couldn't save" (or "Couldn't load spots") and leaves the list
as it was — never an optimistic row that might not exist. The one exception
is an edit to an existing row: a nudge has to be heard at once, so it shows
immediately and the PATCHes go one after another; a failed one reloads the
list.

## Testing

- `src/lib/video/spots.spec.ts` — formatting, clamping at 0 and the duration,
  ordering, `loopTarget` before, at and past the end and with no loop; the
  0.1 s step and `edgeViewTime`, whole-section moves at both ends of the video and at the minimum.
- `trim.spec.ts`, `screens.spec.ts`, `keys.spec.ts`, `layout.spec.ts`,
  `player-history.spec.ts` (a fake port: two quick backs, a forward move, a
  jump), `zoom.spec.ts`, `taps.spec.ts`, `screen-on.spec.ts` (fakes).
- `src/lib/video-prefs.spec.ts` — Hide is read back and a save merges, so
  saving mirror or speed never wipes it.
- `src/lib/server/spots.spec.ts` on `openDb(':memory:')` — add, list, rename,
  delete; each validation; the one-owner CHECK; deleting a recording and a
  lesson video takes their spots.
- `src/routes/api/video-spots/video-spots.spec.ts` with
  `vi.mock('$lib/server/db')`, as `dance-wall.spec.ts` does — 404 for a
  missing owner or spot, 400 for bad bodies.
- In the browser against `npm run dev`, at 390×844, 844×390 and 1280×800:
  every level and the way back from each, the loop holding, a handle dragged,
  0.1 s steps, rename never focusing by itself, Hide and the row of sections
  with an upright and a wide video (and at 390×640), double taps, Ctrl+wheel
  zoom and pan, delete asking / refusing a
  linked section / Undo, rotating with the video playing, the keys.
- In the Android app: Back from the editor, the section view and the full
  video, in fullscreen and after leaving it.
- `npm run check` passes.

## Known gaps

- **iPhone in a Safari tab** keeps Safari's own bars around the layer; only the
  home-screen app is truly full screen. iOS offers no fullscreen API for
  anything but its own video player.
- **No orientation lock.** `screen.orientation.lock` works only inside browser
  fullscreen on Android and not at all on iOS, so the phone is rotated by hand.
- **YouTube embeds** get no full-screen player or spots: controlling one from
  outside needs the IFrame API and a script from youtube.com. **Save video**
  on a figure's or lesson's YouTube link is the way around it: the home
  worker turns the link into a recording or lesson video, which gets both
  ([`2026-10-15-youtube-video-save-design.md`](2026-10-15-youtube-video-save-design.md)).
- **Esc in browser fullscreen** is the browser's: it leaves fullscreen before
  the page sees the key. That counts as one back (a sheet closes, or the level
  goes up) and the player stays open filling the viewport, without fullscreen.
- **Two-finger pinch is only checked on a real phone.** The browser harness
  drives synthetic pointers (and Ctrl+wheel); the maths is specced, the feel
  is not.
- **A wide video in portrait** gets black above and below: the layout is
  sized for upright videos, which most are.
- **A hot reload in `vite dev`** while the player is open resets its stack
  but not the history entries; ✕ may then need a second press. Dev only.
