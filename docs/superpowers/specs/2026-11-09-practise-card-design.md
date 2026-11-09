# One Practise card, on every exercise

Mockups: `gumb-za-vadbo.html` (option A), sent to the user's phone 2026-11-09,
built on real screenshots of the exercise pages, the player's Setup and its
About layer (a copy of the 2026-11-06 backup, Slovenian).

## Why

Each exercise type has its own way into the player, and the commonest one hides
half of what it does:

- A drill and a figure show the **Practise with** card (`PractiseCard`): the
  line of what it will play with, and a round ▶ at its right. ▶ opens the
  player playing (`&play=1`). A tap on the line opens the player's Setup, where
  the song is changed, but nothing says the line can be tapped. The user: people
  will not know they can press left of ▶ to pick a song.
- A routine shows a pale, full-width "Practise in player" button with a note
  under it. It always opens Setup, and it never says which song it will play,
  though the routine's exercise remembers one.
- A lesson's review has no way into the player at all.

The user wants one way in, the same on every type, with both of its actions
said in words.

## Goals

- Every exercise type has the same card, lesson included.
- Both actions are visible and labelled: **Change** (Setup, nothing plays) and
  **▶ Practise** (plays at once).
- What the card says is what the player will open with, for every type.
- A song or setting changed in Setup sticks even when the person goes back
  without playing.
- A lesson has an About in the player, as a drill and a figure do.
- A video watched with sound in About is not drowned by the count or the song.

## Non-goals

- No change to what the player does once it plays, beyond About's videos.
- No new place to pick a song on the exercise page itself (that was option B).
- The bottom bar keeps Done alone; Practise does not move there (option C).
- No change to the other ways into the player (Music's Count only, a song's
  Practise with this song, a Music row's Practise to this).

## Anti-goals

- A tap target whose action is not written on it.
- A card that names one song and a player that opens with another.
- Music that starts again by itself while the person is watching or has just
  watched a video.

## Decided with the user

### The card (option A)

One card, `PractiseCard`, for drill, figure, routine and lesson, where each
type's Practise with sits now (drill: after the description; figure: after the
reference notes; routine: in place of the "Practise in player" button and its
note; lesson: after the lesson's notes, before its figures). From top to
bottom:

- A row: the music icon in a round tile, "Practise with" small and muted, the
  summary line under it (`practiseWithLine`, as today), and at the row's right
  end a **Change** pill (the sliders icon and the word, in the accent-soft
  colour). Change opens the player's Setup for this exercise
  (`exercisePlayerHref(…, play = false)`).
- Under it, a full-width filled **▶ Practise** button. It opens the player
  playing (`exercisePlayerHref(…, play = true)`), as the round ▶ does today.
- In a run, both carry the run's `from`, as today.

A routine's line also says Follow or Still (this phone's choice for that
routine, `loadRoutineView`): "BAILE INOLVIDABLE · Follow · no count". The
routine's exercise page loses its note ("Tap Done when you have practised…").

The bottom bar keeps Done alone.

### Setup keeps what is changed

The user asked that a change made in Setup is kept when they go back without
playing. Setup already keeps every change as it is made (its `$effect` calls
`onchange` → `keep` → `practiceSaver.change`, which waits `SAVE_DELAY_MS`, and
flushes on `pagehide` and when the page is torn down). What fails is the order
on the way back: SvelteKit runs the exercise page's load before the player is
torn down, so the flush lands after that load, and the card's line still shows
the old choice. To the person it looks unsaved.

So: the waiting change is flushed **before** Back navigates (Setup's back,
Stop's return, the browser's Back), and the exercise page's card shows the new
choice on return, without a manual refresh. A spec covers "change the song in
Setup, Back, the card names the new song".

### A lesson in the player

A lesson exercise gets the card, and in the player an **About**, on Setup and
while running, the same row and layer a drill and a figure have. It holds what
the lesson's exercise page shows, read-only, each part only when it has
something:

- the lesson's notes;
- its figures, as chips; a chip opens that figure's details in the same layer
  (the figure's About: facts, notes, sections, recordings, links), with a back
  row at the top naming the lesson that returns to it;
- its lesson videos;
- its links.

The About row's preview names what is inside ("Notes · 3 figures · 2 videos").

### A video with sound pauses the music

In About (every type):

- **Short clips** (a section of a recording, as `RunClip` plays them now) still
  loop by themselves, muted, while on screen, and the music goes on.
- **A tap on a clip** plays it with sound, from its range's start. The count and
  the song pause at once (the player's Pause). Over the content, at the top of
  the layer, a strip says "Music paused" with a **Resume** button.
- **Resume** (the strip's, or the foot's Pause button, which reads Resume while
  paused) stops the video's sound, and the music goes on from where it was. The
  clip goes back to looping muted.
- **A lesson video** (long, with its own sound) does not play by itself: a
  poster with ▶. Its ▶ plays it with sound, and the music pauses, as above.

## My calls (the user has not weighed in)

These were in the mockup and the user did not object, but did not decide them:

- **The music does not start again by itself** when a video ends or is paused
  from its own controls. It waits for Resume. A video that ends goes back to
  its muted loop (a clip) or its poster (a lesson video).
- **YouTube in About plays in place**, as on the exercise page (`YouTubeCard`:
  a thumbnail until tapped, the tap swaps in the iframe with autoplay). That tap
  pauses the music as a clip's does. Resume closes the iframe back to its
  thumbnail. No YouTube API is needed: the tap is what we hear. Other links stay
  links.
- **The routine page's Practise** (Moves) opens the routine's exercise page when
  it has one, as the figure page's Practise already does, so the card and Done
  are where Practise lands. A routine with no exercise opens the player as it
  does today; Practise does not make an exercise.
- **Change goes to Setup in the player**, not a sheet on the exercise page: one
  place where settings live.
- **A lesson video's poster is a plain dark tile** with ▶ and its caption, as
  in the mockup. Lesson videos have no thumbnail and none is made (no worker
  work, no migration).
- **The video rule holds wherever details show clips**: the About layer, and a
  routine's figure details opened from its list (the slot's ⓘ in Follow, a tap
  in Still), since they are the same `DetailsBody` / `RunClip`. In Setup, where
  nothing runs, a clip played with sound stops the song sample, and a sample
  started mutes the clip. So the "a video has the sound" state is shared by
  Setup, `Running` and the routine's layers, not kept in `Running` alone.
- The words: en "Practise with", "Change", "Practise", "Music paused",
  "Resume"; sl »Vadi ob«, »Spremeni«, »Vadi«, »Glasba je na premoru«,
  »Nadaljuj«. Existing catalog entries are reused where they say the same
  thing.

## Constraints

- The type owns its page: the lesson gets a `kinds/lesson/Practice.svelte` in
  the `PRACTICE` registry (today `lesson: null`); no page branches on the type.
  The lesson's About comes from `exerciseDetails` (`src/lib/server/run-details.ts`),
  which today has no lesson branch.
- A lesson may be a group's: what its About shows obeys the same reach as the
  lesson's exercise page (`access.ts`, sections through `sectionsFor` / reach).
- Words through `t()`, both catalogs; Slovenian per `sl/index.ts`.
- `PractiseCard` shows no audio and plays nothing on the exercise page.
- The player's timing stays on the AudioContext clock; pausing for a video is
  the player's own Pause, not a new path.
- No migration expected: `exercises.practice_mode`, `song_id`, `count_bpm` and
  `practice_json` already hold a lesson's practice.

## Left to the builder

- Exact spacing and sizes, within the redesign's tokens and `ui/styles.ts`
  builders (`button('primary', 'md', true)` for ▶ Practise).
- How the exercise page learns the new line after Back (an invalidation of its
  load, or the card reading what Setup posted).
- How the shared video state is wired (a callback from `DetailsBody` /
  `RunClip` up to `Running`, or a small store).
- Whether a figure opened from a lesson's chip reuses the routine slot's details
  path (`slotDetails`, `figureDetails`) or loads its own.
- Specs and a shots scene for each type's card, the lesson's About, and the
  paused strip.
