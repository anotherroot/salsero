# Song samples and the song popup

Agreed 2026-10-30. Mockups (the version agreed is v3):
https://claude.ai/artifact/AEH5TccTqrb4zRyvspJ6FZ

## Why

Song titles alone do not say which song is which. When picking a song for a
practice the user often cannot tell two apart, and the only way to hear one
today is to leave, open the song's page and play it there. As the library
grows, the native `<select>` that holds the songs also stops scaling: no
search, no way to hear anything, titles only.

Success: from any place a song is picked, the user can hear about 15 seconds of
any song and find a song by typing part of its name, without leaving the page.

## What gets built

Five parts around one shared mechanism (the sample), plus a fix to how Back
closes popups that the song popup depends on (part 6).

### 1. The sample

A short stretch of a song, played on its own: no count, no clave, always at 1×
(the speed chips do not apply; the sample is for recognising the song, not for
practising).

- **Length:** 15 s, with a short fade in and out (about 1 s each).
- **One at a time,** across the whole page: starting a sample stops any other.
- **Stops when** the practice starts (Play on the Practice screen, ▶ in
  "Practise with"), when the song popup closes, when its 15 s run out, or when
  its button is tapped again.
- **Button:** a round ▶ that becomes ■ while sampling, with a ring around it
  that fills over the 15 s. While a row is sampling, its second line reads
  "Sample from 1:24".
- **Plays the song file the app already serves** (`/audio/[file]`, which
  already speaks HTTP Range), starting part-way in. No new files, no
  downloads, nothing stored per play.
- It must not use or disturb the player's own `<audio>` element (the one
  `loadSongGrid` mounts for the run): the sample has its own.

### 2. Where a sample starts

- **Automatic (default):** one third of the song's duration, moved back to the
  nearest "1" at or before that point, so it starts on the beat. The "1"s come
  from the song's grid as the user's count defines it (beats + anchors + tempo
  factor), not from Beat This!'s downbeats.
- **The user's own point:** set on the song's page (part 4). It also snaps to
  the nearest 1 at or before it.
- **Store the raw time, snap on read.** A new nullable column
  `songs.sample_start_s` (real, seconds) holds the time the user set; `null`
  means automatic. Snapping happens when the start is computed, so if the user
  later corrects their count with new taps, their sample start follows the
  corrected 1s. Additive `ALTER TABLE ... ADD COLUMN` only, no CHECK (see the
  hard rule in CLAUDE.md); validate in the data function (`0 ≤ t < duration`).
- The start is computed by one **pure** function (beside the beat grid code in
  `src/lib/beatgrid/`, or its own module), given the duration, the grid and the
  stored point. Unit-tested.
- A song nobody has tapped yet snaps to the 1s its page shows anyway (the
  suggested count from `buildGrid`). A slightly wrong 1 still starts the
  sample on a beat, which beats not snapping. (My call.)
- If a song has no usable grid, fall back to the unsnapped time.
- If the start is within 15 s of the end, the sample simply ends with the
  song.

### 3. The song popup (replaces the `<select>`)

Applies wherever `SourcePicker` is used: the Practice screen
(`player/Setup.svelte`) and "Practise with" (`player/PracticePanel.svelte`,
in every exercise log popup: Today, figure, lesson and exercise pages).
Changing `SourcePicker` changes both.

**The Song field (popup closed).** Where the `<select>` was: one row showing
the picked song's title and, under it, `Style · BPM · length` (BPM as the
Songs list shows it: `bpm × tempoFactor`, rounded). On its right, split off by
a thin line, a ▶ that samples the picked song without opening anything.
Tapping the rest of the field opens the popup.

**The popup.** A bottom sheet (`ui/Sheet.svelte`), titled "Pick a song". From
the top:

- A search box. **On a phone the keyboard does not open by itself** (the user
  can scroll and sample straight away; tapping the box brings it up). On the
  work PC (a fine pointer), the cursor starts in the box.
- A small line: "18 songs" (or "3 matches") and "▶ hear 15 s · tap a song to
  pick it".
- The list. Each row: a radio dot (filled for the current pick, row tinted),
  the title, `Style · BPM · length` under it, and a ▶ on the right split off by
  a thin line. Tapping the ▶ samples; tapping anywhere else on the row picks
  the song, closes the popup and stops the sample. Sampling never changes the
  pick.

**Search.** Filters as you type, matching anywhere in the title or the artist,
ignoring accents and case ("valio" finds "Valió la pena"). Reuse `fold` from
`src/lib/routines/fit.ts` (move it somewhere shared if that reads better). The
matched letters are highlighted in the title. While searching it is one flat
list, A to Z. With no match: "No song matches “xyz”." and a pointer to the
Songs page; the typed text stays. A running sample keeps playing while typing
if its row is still in the list.

**With the search empty:** a "Recent" group (up to five songs the user
practised with most recently), then "All songs A–Z" with everything else. When
nothing qualifies as recent, there is no Recent heading, just the A to Z list.

**Closing without picking:** ✕, the backdrop, Escape, and the phone's back
button (part 6). The pick does not change.

**Which songs:** the same set as today's dropdown, this dance's ready,
unarchived songs (`listReadySongs`). Its row shape grows to carry what the
popup shows: artist, style, BPM, tempo factor, duration, audio file and the
computed sample start.

### 4. The song's page: setting the sample

On `[dance]/songs/[id]`, a new **Sample** section under "Tap on the 1" (and
its hint line), before Count speed. Only for a ready song with a grid, like
the rest of that block.

- A card whose first row reads "From 1:55" with a tag, **Automatic** or
  **Yours**, a second line ("A third of the way in, on a 1" or "Set by you"),
  and a ▶ on the right that plays the sample from that start.
- Under it, a full-width outlined button **Start the sample at 2:05**, where
  the time follows the page's `<audio>` playhead live. Tapping it stores the
  current playhead as the song's sample start.
- When the user has set one: a small **Back to automatic** link under the
  button, which clears it (`null`).
- Both are one-tap forms (`use:enhance`, like the page's other one-tap
  actions), not `use:guarded`.

### 5. The Songs list

Each ready song's card gets the same ▶ on its right edge, split off by a thin
line (like the + on Today's rows). The rest of the card still opens the song.
Songs that are waiting or failed have no audio and get no ▶.

### 6. Back closes the top popup, in every sheet

Part of this change, because the song popup stacks on top of the exercise log
popup. Today `ui/Sheet.svelte` is a plain `<dialog>` that never touches
history, and the Android app's Back (`WebShell.kt`, `web.goBack()`) goes back
a page. So Back on a phone closes every open popup at once and leaves the
page, losing a finished run or raising the unsaved-changes question.

The rule, for every `Sheet` in the app (14 users today: the log popup, Save
set, Move to…, the Link popup, the slot picker, New exercise, and the rest):

- **Back closes only the topmost open sheet.** With two stacked (the song
  popup over the log popup), the first Back closes the song popup, the second
  closes the log popup, the third leaves the page.
- **The same for every Back:** Android's button and gesture in the app, the
  browser's Back button, and Escape (which already closes the top dialog).
- **Unsaved work still asks.** If the sheet holds unsaved work (a typed form,
  a finished run), Back asks the "Unsaved changes" question, exactly as ✕ does
  today, and the sheet stays open (with its history entry back in place) if
  the user keeps editing.
- **✕, the backdrop and Escape** close the sheet the same way Back does, so
  history never keeps an entry for a sheet that is already closed.
- **A sheet that closes because the page moves on** (a form action that
  navigates, a link inside the sheet) must not leave a stale entry that makes
  the next Back do nothing or reopen it.

How: the proven pattern is the video player's — one shallow history entry per
open level (`pushState` / `page.state`), Back as the one source of truth for
going up, behind an injected port so the logic is tested in the node project
(`src/lib/video/player-history.ts`). A popstate between shallow entries runs
no `beforeNavigate`, so the sheet has to ask the unsaved question itself. No
Android change should be needed: `web.goBack()` pops the shallow entry like
the browser's Back. Sheets opened from inside the full-screen video player
(the Link popup) must stack on top of the player's own entries without
breaking its levels.

Verify on the phone (the Android app), not only in a desktop browser: open
the log popup, open the song popup, press Back three times.

## Decided

- The popup replaces the `<select>`; it does not sit beside it. A native
  dropdown cannot hold a play button.
- Search, then a Recent group, then A to Z.
- The keyboard waits on a phone; the cursor starts in the search on the PC.
- 15 s, 1×, no count or clave, one sample at a time.
- Automatic start a third of the way in, snapped to a 1; overridable per song
  on the song's page; stored raw, snapped on read.

## Non-goals

- Finding the chorus or the loudest stretch automatically. Considered (the
  home worker could do it during analysis) and set aside: a third of the way in
  is enough for now, and the user's own point covers the rest.
- A sample on any other screen (Today, routines, lessons).
- Choosing the sample's length, or setting an end point.
- Changing what the player plays for a practice.

## Anti-goals

- Tapping to hear a song must never change which song is picked.
- A sample must never keep playing under a practice run.
- No noticeable cost to opening the Practice screen or a log popup: the popup's
  list is built from data the page already loads, with no extra request per
  song.

## Left to the builder

- **Where "Recent" comes from.** Already recorded: both the Practice screen
  (`[dance]/player/+page.svelte`) and "Practise with" (`PracticePanel.svelte`)
  write `songId` into `sets.player_json` when a run is logged. Recent is the
  distinct songs of this dance's latest sets that carry one (derived, never
  stored, in the spirit of the urgency rule), skipping songs no longer ready.
  Existing sets already count.
- **The fade on iOS.** `HTMLMediaElement.volume` is read-only on iOS Safari.
  The Android app's WebView and desktop browsers honour it. A Web Audio gain
  node would fade everywhere; a sample with no fade on iOS is acceptable.
- **Where the sample player lives.** One module-level audio element with a
  tiny store (which song is sampling, since when) fits "one at a time across
  the page" naturally; a pure part (start time, remaining time) can be
  unit-tested.
- **Computing the snapped start for every song** on each page load means
  parsing every ready song's beats. Fine at the library's size; if it ever is
  not, compute it once when the analysis or anchors change.
- The exact component split (a `SongPicker` used by `SourcePicker`, a shared
  `SampleButton`), file names, and the empty-state wording beyond what is
  above.
- Keep `docs/superpowers/specs/2026-09-22-salsa-app-design.md` current: a line
  under "Songs & player" pointing here, and the new column in its data model.
