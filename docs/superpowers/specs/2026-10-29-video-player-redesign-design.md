# Full-screen player redesign — design

> **Status:** approved in brainstorming, 2026-10-29; built 2026-10-29 and
> folded into [`2026-10-01-video-player-design.md`](2026-10-01-video-player-design.md),
> which describes the player as it is. This document stays as the record of
> why. Data model, API, server functions and loop rule did not change.
>
> Mockups (a clickable phone prototype, landscape and desktop layouts):
> https://claude.ai/artifact/Frkabcp1eJGFVjvG8kU5qe — private to the owner.

## Why

The player works, but it feels hacky, and on the phone it fights you:

- **The keyboard opens by itself.** Edit puts the label field in focus
  (`autofocus` in `VideoPlayer.svelte`), so on a phone the keyboard covers
  half the screen before you have done anything.
- **Delete is one tap, with no question asked.** A spot is hard-deleted.
- **No frame steps.** ±1 s is too coarse for placing the edge of a move.
- **The video is covered while you edit.** On a phone the spots panel is an
  overlay on the bottom 60% of the screen, so the move you are cutting is
  hidden behind the controls cutting it.
- **Editing a section is fiddly.** One small row of −1s/+1s/Now per edge, no
  way to drag an edge, no way to move or resize the whole section at once.

## Goals

- In portrait on a phone, the **whole video is always visible**, including
  while a section is being edited.
- A section can be **opened on its own**: a timeline of just that section,
  looping, with nothing else on screen but the controls for practising.
- A section editor you can **tap through quickly**: pick an edge, nudge it by
  a second or a frame, drag it, or move and resize the whole section.
- **Frame-by-frame stepping**, everywhere.
- **Nothing destructive in one tap**, and **no keyboard unless you tapped a
  text field**.
- It should look like a modern video app, not a row of bordered buttons.

## Non-goals

- No change to `video_spots`, `/api/video-spots`, `src/lib/server/spots.ts`,
  or the loop rule (`loopTarget`, checked every animation frame).
- No new kinds of spot, no thumbnails or filmstrip, no waveform.
- YouTube embeds still get no full-screen player.
- The inline player (`VideoFrame.svelte`) is unchanged apart from opening this one.

## Anti-goals — it fails if

- in portrait, any control lies over the video while editing;
- the keyboard appears without the user tapping a text field;
- a single tap deletes a spot;
- Android's back gesture leaves the page, or closes the player, from inside
  a section or the editor.

## Three levels

The player has three levels. Each goes back to the one above it.

| Level           | Opened by                                                                                      | Back / Esc / its own button                                       |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Full video**  | Full screen on the inline player                                                               | closes the player                                                 |
| **Section view**| tapping a section card; a linked section card elsewhere in the app (`SectionPlayer`); Done in the editor | **‹ Full video**: ends the loop, stays where playback is |
| **Editor**      | **Edit section** in the section view; tapping a point; **Edit** on a just-saved toast           | **Done**: a section back to its section view, a point to the full video |

**✕ closes the player from every level.** Back (Android's gesture, the
browser's back) and Esc go **up one level**: editor → section view → full
video → closed. A sheet (rename, delete) is closed first by back/Esc, before
any level changes.

A point has nothing to loop, so it has no section view: tapping one opens its
editor directly.

### The loop is the section view

_(My call, settled after review.)_ A loop exists only while a section's
view or its editor is open; there is no free-standing loop any more.
Leaving the section view by any route (‹ Full video, back, Esc) ends it, so
the full video never loops and has no `Looping ×` chip. The editor's **Loop**
toggle pauses the loop for that editor visit only (to watch past an edge);
**Done** back to the section view turns it on again. This drops the
`loop` state's independence from today's player: it becomes "which section
is open".

Opening from a linked section card elsewhere (`SectionPlayer`, `loopSpot`)
lands in that section's view, playing; **‹ Full video** is still there.

### Back on Android — the trap

In the Android app, `WebShell.back()` first leaves WebView fullscreen if the
page is in it, and otherwise calls `web.goBack()`, which leaves the page. In
Android Chrome, back is the history. So "up one level" needs:

- an entry the back gesture can pop for **opening the player and for each
  level above the full video** — so back from the full video closes the
  player and never the page, also once fullscreen has been left and on
  iPhone, which has none (my suggestion: SvelteKit shallow routing,
  `pushState` from `$app/navigation`, with ✕ unwinding the entries before
  `onclose`). The player is opened from sheets (`LinkSectionSheet`, the Today
  popup) and beside `use:guarded` forms, whose guard watches navigation: the
  entries must not trip it, nor close those sheets; and
- leaving browser fullscreen while above the full-video level is treated as
  "up one level", not as "close": the player stays open filling the
  viewport, as it already does when a browser refuses fullscreen, and **stays
  that way until it closes** — no asking for fullscreen again (my call).
  Only at the full-video level does leaving fullscreen close the player, as
  today.

The mechanism is the builder's; the behaviour above is not. It must be
checked in the Android app, not only in a desktop browser.

## Layouts

The player is always dark, whatever the site's theme, with the dance's
accent (`accentDark` in the registry) for the play button, the active
section, the selected edge and the loop.

Three layouts, chosen by the viewport:

- **Portrait** (taller than wide): the video is a 16:9 box at full width
  under a slim top bar; **every control is below it**. Nothing fades, since
  nothing covers the picture.
- **Phone landscape** (wider than tall, short — about under 520 px high):
  in the full video and section view, the video fills the screen and the
  controls float over it and fade after 3 s of playing, as now: the
  transport and the timeline (the whole video's, or the section's) at the
  bottom, with **Mark** and **Section** beside the transport in the full
  video. The editor is a panel on the right with the video beside it, not
  over it. _(My call, settled after review:)_ in the full video a
  **Sections (n)** button in the top bar opens the list as the same right
  panel, the video shrinking beside it rather than covered; tapping a card
  goes to that level and the panel closes (section view) or becomes the
  editor (a point).
- **Desktop** (the work PC): one layout for all three levels — the video on
  the left with the timeline and transport under it and a key legend, a
  sidebar on the right with the list. _(My call, settled after review:)_ the
  levels are states of that one screen: in the **full video** the sidebar is
  the plain list and the timeline is the whole video's; in the **section
  view** that section's card is highlighted with its name, range and an
  **Edit** button, and the timeline under the video becomes the
  section-only one; in the **editor** the card expands in place into the
  editor, as the mockup shows. Esc steps up through the same levels.

The exact breakpoints are the builder's; the mockups show each.

## Full video

- **Top bar:** ✕, the title (figure or lesson name, and "Lesson video" or
  "Recording"), Mirror (a toggle), speed (shows `0.5×`; tapping opens a small
  popover with 0.25 / 0.5 / 0.75 / 1).
- **On the video:** a small badge, top right, when speed is not 1× or mirror
  is on (`0.5× · Mirrored`). Tapping the video plays or pauses; paused, a
  play glyph sits in the middle.
- **Time row:** current time to hundredths, `frame N`, the duration.
- **Timeline:** a scrubbable track (drag, not only tap) with each section as
  a band (the looping one in the accent) and each point as a tick. While a
  section is being marked, its growing band shows from the start to the
  playhead.
- **Transport:** −1 s, previous frame, Play/Pause (large), next frame, +1 s.
- **Mark point** and **Start section** side by side. Start section becomes
  **End section · 3.2 s** (the running length, highlighted) until tapped
  again. Ending at less than `MIN_SECTION_MS` past the start says so and
  saves nothing.
- After a save, a short toast: `Section saved · 7.2 s` or
  `Point saved at 1:38.5`, with **Edit**, which opens that spot's editor.
- **Sections and points:** a list of cards by start time. Each shows an
  icon (loop for a section, flag for a point), the name (or its time),
  `1:04.0–1:11.2 · 7.2 s` or `1:38.5 · point`, and `Linked to …` when linked.
  A section card opens its section view; a point card its editor.

## Section view

What you see when practising one section.

- **‹ Full video** (top left) and a small `Looping` marker.
- The section's name, and `Linked to …` if linked.
- **A timeline of only the section**: its start time on the left, its end on
  the right, `2.7 / 7.2 s` in the middle; dragging it seeks within the
  section. The loop rule is unchanged, so play wraps from end to start.
- The time in the whole video and the frame number, small.
- The transport, larger than in the full video: −1 s, previous frame,
  Play/Pause, next frame, +1 s.
- Speed as four inline buttons, always visible.
- **Edit section**, a full-width button at the bottom.
- On the video: the loop's name, top left, and a thin accent bar along the
  video's bottom edge showing progress through the section.

## Editor

Opened on one spot. For a section:

- **Header:** the name with a pencil, tappable, and its range and length
  under it; a **Loop** toggle (on when opened; see "The loop is the section
  view"); `Linked to …` if linked.
- **A compact transport** right under the video: the time, the frame,
  previous frame, Play/Pause, next frame.
- **The trim strip**, a zoomed timeline of the section with 3 s either side:
  - the section shaded in the accent, a handle at each edge, the selected
    edge's handle in the accent and the other in light grey, a tick every
    second and a taller one every five, the playhead;
  - **drag a handle** to move that edge (it becomes the selected edge;
    playback pauses and the video shows the frame at the edge as you drag;
    on release it plays from the start, or the last 2 s up to the end, so
    the cut is heard). A handle's grab area is generous (about 28 px each
    side) — this is a phone;
  - **tap anywhere else** on the strip to seek there;
  - the window stays fixed while dragging, so the handle does not slide out
    from under the finger, and widens on release if an edge has come within
    half a second of the window's side.
  - Under it, the window's first and last times, and "drag a handle · tap to seek".
- **Start | End**, two large selectors showing each edge's time to
  hundredths. Choosing one selects that edge **and jumps to it**: Start plays
  from the start; End plays the last 2 s up to the end.
- **Move the start / Move the end:** −1 s, −1 f, **Now** (showing the current
  time), +1 f, +1 s, acting on the selected edge.
  - ±1 s plays, exactly as today's nudge.
  - ±1 f **pauses** and shows the frame at the edge: the first frame inside
    for the start, the last frame inside for the end. A frame is for
    looking, not listening.
  - Now sets the selected edge to the playback time without seeking, and
    says so in a toast (`End set to 1:10.40`).
  - A button that would change nothing is disabled (`moveEdge` returning null).
- **Whole section · 7.2 s:** **‹ Earlier** and **Later ›** move both edges
  0.5 s, keeping the length; **Shorter** and **Longer** move each edge
  0.25 s inwards or outwards (0.5 s in all). All clamp inside the video and
  keep `MIN_SECTION_MS`; each plays from the new start.
- **Footer:** **Delete** (red text, left) and **Done** (accent, right).

For a point, the strip has a single marker, there are no Start/End
selectors, no Whole section and no Loop; the move row moves the point, and
Done returns to the full video.

The list is not re-sorted while the editor is open (as today).

### Rename

The name is a heading, never a focused field. Tapping it opens a bottom
sheet with a labelled text field (not focused: the keyboard appears only
when the field itself is tapped), Cancel and Save. Enter saves. Empty saves
as no label, which shows the time. `MAX_SPOT_LABEL` still applies.

### Delete

Delete opens a bottom sheet: `Delete "Enchufla doble"?`, the range, and
**Keep it** / **Delete** (red). For a linked section the sheet says
`Linked to Enchufla · Doble. Unlink it there first; until then this section
stays.` and Delete is disabled — the user learns why before trying, rather
than from a 409 afterwards. The 409 is still handled, as a fallback, by
showing its message.

After a delete the editor closes to the full video and a toast says
`Deleted Enchufla doble` with **Undo** for about 4 s. Undo posts the same
times and label again as a new spot; its id changes, which is harmless,
because a linked spot cannot have been deleted.

## Frame steps

Browsers do not expose a video's frame rate. The frame duration is measured
with `requestVideoFrameCallback` (the `mediaTime` gap between two
consecutive presented frames, taken while playing) and assumed 1/30 s until
it is known; saved YouTube videos at 480p are 25 or 30 fps. A frame step
pauses and seeks to the middle of the next or previous frame. `frame N` is
`floor(time / frame duration)`. Edges stay integer milliseconds.

Where `requestVideoFrameCallback` does not exist, 1/30 s stays the step.

## Keyboard (the work PC)

| Key        | Does                                                       |
| ---------- | ---------------------------------------------------------- |
| Space      | play / pause                                               |
| ← →        | ∓1 s                                                       |
| , .        | previous / next frame                                      |
| M          | mark a point                                               |
| S          | start / end a section                                      |
| I / O      | in the editor: set start / end to now                      |
| [ / ]      | in the section view or editor: jump to the start / the last 2 s |
| L          | in the editor: pause / resume the loop                     |
| Esc        | up one level (closes a sheet first)                        |
| ?          | a sheet listing these keys                                 |

Ignored while typing in a text field, and with Ctrl/Cmd/Alt held, as now.
On the desktop layout the Start/End selectors show their I/O keys.

## What stays from 2026-10-01

Spots are fetched on open and written straight through the API; a failed
write shows "Couldn't save" and leaves the list as it was, except edits to
an existing spot, which show at once, are sent in order, and reload the list
on a failure. Mirror and speed are shared with the inline player through
`video-prefs.ts`. The loop is checked every animation frame. A section ending
at the last frame restarts from `onended`.

## Left to the builder

- Whether a drag on the trim strip sends its edit while moving or once on
  release (the PATCHes go in order either way), and whether the portrait
  video stays put while the controls below it scroll on a short phone.
- How the bottom sheets sit inside the player's `<dialog>`.

- How the component splits up (one dialog with level components is my
  guess), the animations between levels, the icon set (inline stroke SVG in
  the mockup), and exact sizes — touch targets at least 44 px.
- The pure helpers for frame snapping and whole-section moves belong in
  `src/lib/video/spots.ts` beside `moveEdge`, with specs.
- The mechanism for back, within the rules above.

## Testing

- `spots.spec.ts`: frame snapping, whole-section shift and resize clamping at
  0, the duration, and `MIN_SECTION_MS`.
- In the browser against `npm run dev`, at phone portrait, phone landscape and
  desktop sizes: every level and the way back from each; the trim strip
  dragged on a touch device; frame steps; rename never focusing by itself;
  delete asking, refusing a linked section, and Undo.
- **In the Android app:** back from the editor, the section view and the
  full video, in and out of fullscreen.
- `npm run check` passes.
