# The song page: listening, Edit, sections

Date: 2026-11-08. Status: built (branch `songs-redesign`). Board: "D, every screen"
(https://claude.ai/artifact/YPLPyKeSZ78HJyDAkE8kyz), option D from round two
with F's Edit tabs.

## Why

Three things bothered the user about a song's page:

1. **Viewing and changing are mixed.** The page has an Edit pencil (it opens
   Song details), yet Tap on the 1, the sample start, the count speed and
   Remove change the song from the open page. Nothing tells you whether a tap
   on the page changes something.
2. **Setting the 1 is blind.** You tap along and get a tick on the seek bar,
   but you can't see what a tap did to the count, or where the count shifts
   in the song.
3. **The song has no shape.** A salsa song has parts (intro, verse, coro,
   montuno, mambo, breaks), and the 1 often moves at the changes. The user
   wants to see the whole song's counts, its parts and its changes, and to
   turn the count off in some places (a break, a change).

While a song just plays, the user wants a **minimal** view: which part this
is, and how far away the next part is. No colourful parts.

## Goals

- Listening never changes the song. Everything that does is behind the
  pencil.
- In Edit, a grid of the whole song's counts, one row per eight, where each
  tap on the 1 visibly changes the rows after it.
- **Sections**: named parts of a song, each starting on a 1, each with the
  count on or off.
- While listening: the section's name, and "Mambo in 3 eights".
- Detected downbeats suggest where the 1 moves; the user accepts or skips.

## Non-goals

- The songs list stays as it is ("Song list is good").
- The Practice player is slot 1's (branch `practice-player`). That it stays
  quiet in a count-off section, says the next section, or shows sections at
  all is theirs. This design stores sections and gives pure helpers to read
  them (below); it does not touch `src/lib/scheduler/` or the player page. The
  one seam is `startS` in `GET /[dance]/songs/[id]/grid` (where the music
  starts, below).
- The worker's beat analysis (unchanged; it only gains the music start,
  below).
- The same view/edit split elsewhere in the app. It goes to the notes repo
  as a task, not into this work.
- Automatic section detection. Sections are the user's.

## Anti-goals

- A colour per section. Sections are plain headings, one ink colour.
- A suggestion that changes the count by itself. The count is the user's
  (hard rule); downbeats only suggest.
- A listening view that grows busy: no grid, no list of 1s, no settings there.

## The page

### Listening (the page as you open it)

Top to bottom, inside the sheet under the band (band: back, title, pencil,
⋯; subtitle as today):

1. **The count card.** The current section's name, small and uppercase,
   above the count (today's `LiveCount`: the number and eight dots). Under
   it one line: `→ Mambo in 3 eights` and one pip per eight left (at most
   one pip per eight, the line reads "after this eight" in the last eight).
   Then play/pause and the seek bar. The seek bar's notches mark section
   starts (today they mark the 1s; those move to Edit's grid).
   - Before play: the first section's name and its line (`Verse in 4
     eights`), Play.
   - In a count-off section: a dash in place of the number, the dots running
     out the section's beats, and `→ Montuno in 2 beats`. Under 8 beats to
     the next section, the line counts beats, not eights.
   - No sections: no name, no line. One quiet line under the card when the
     song also has no 1s: "The 1 is a guess from the beat. Set it, and add
     sections, in Edit ✎." (today's `grid.suggested` hint). With 1s but no
     sections, nothing.
   - Before the first section starts (sections exist but the first one
     starts after 0:00): no name; the line points to the first section.
2. **Practice with this song**, as today (a group's draft hides it, as today).
3. **Sample**: one row, "From 1:26 · 15 seconds", with the sample play
   button. Playing it is listening; where it starts is set in Edit.
4. **Sections · tap to jump**: a plain list (time, name, "Count off" chip on
   count-off sections), "playing" and "next" marked. A tap seeks there and
   plays. No list without sections.

Gone from the listening page: the Tap on the 1 button and its form, "Start
the sample here" and Back to automatic, Count speed, the "Your 1s" list, Clear
all. They are all in Edit.

Unchanged: the steps of a song being added, failed + Retry + Upload a file
instead, the group's share bar, the class-song banner for members, Versions,
the ⋯ menu and its dialogs, the seen/clash handling.

### Edit

The pencil opens Edit (only for someone who may edit the song: `canEdit`, as
today). The band shows × and the title, subtitle "Editing · saves as you go".
The tab bar steps aside (`claimBottom`). Two tabs at the top of the sheet:
**Grid** and **Song**. × leaves Edit; there is nothing unsaved to ask about.
Edit is page state, not a route (the pencil does not navigate); whether it is
a shallow route so Back leaves Edit is the builder's call, but Back must not
leave the page while in Edit without leaving Edit first.

#### Edit · Grid

- **The pinned bar:** play/pause, **Tap on the 1** (the big primary), and
  **+ Section**.
- **The grid:** the whole song, one row per eight, under section headings.
  A row starts at every 1 and at every section start; a row shorter than 8
  beats ends early and carries a warn chip "+N beats" (it is where the 1
  moved). Each row shows its start time on the left. Each cell is a beat with
  its count; the 1s are accented; a 1 the user set (an anchor) has a small
  dot. Cells of a count-off section are hatched and show no number.
  A section heading: name, start time, "Count off" chip when off, ✎.
  Before the first section (or with none), rows have no heading.
- **It follows the song:** the row that's playing is lit and the beat that's
  playing filled. While playing, the grid scrolls to keep the lit row in view,
  unless the user scrolled by hand in the last few seconds (builder picks the
  number).
- **Tap a beat:** the song jumps there, playing or paused (seek to that beat's
  time; a playing song keeps playing).
- **Hold a beat** (long press; right-click on a computer; the context-menu key
  or Shift+F10 from the keyboard): a small menu under its row, headed
  "2:21 · beat 3 of Mambo": **Make this the 1**, **Start a section here**,
  and on an anchor **Remove this 1**. A section always starts on a 1, so on
  a beat that is not a 1, Start a section here makes it the 1 first and
  starts the section there, in one change.
- **Tap on the 1:** as today, it files an anchor at the playhead. While
  playing, the tap latency is subtracted as today. **While paused, it is
  not**: the playhead is exact, so a jump to a beat then Tap on the 1 sets
  that very beat. Before the song has played: "Play the song first", as today.
- **What a tap shows:** the tapped beat lights up; the rows after it
  renumber; for a few seconds, a struck-through "before" row under the tapped
  row shows the old count; a toast says "1 set at 1:19. The count from here
  moved 2 beats." (or "…didn't change" when it agreed with the count and was
  dropped by `addAnchor`), with **Undo**.
- **Suggestions:** where the stored downbeats (`downbeats_json`) say the 1
  moves and the user's count disagrees, the grid outlines the suggested beat
  dashed and puts a card under its row: "The beat suggests the 1 is here from
  2:29, 2 beats later. It can't tell a 1 from a 5." with **Use it** (makes it
  the 1, with the toast and Undo) and **Not now** (hides it). See
  "Suggestions" below for the rule.
- **+ Section:** starts a section at the 1 of the eight that's playing (the
  last 1 at or before the playhead) and opens its sheet.

#### The section sheet

Opened from + Section, from a beat's menu, or from ✎ on a heading.
"Section", "saves as you go" beside the title.

- **Name:** chips Intro, Verse, Coro, Montuno, Mambo, Break, Outro, and
  Other… which opens a text field (1–40 characters). The chips are the same
  for salsa and bachata in this version (builder: put them in one list so a
  per-dance list is easy later).
- **Starts:** the time, "on a 1", and two buttons: an eight earlier, an eight
  later (moves the start to the 1 eight beats away; refused past the song's
  ends or onto another section's start).
- **Count:** On | Off. "Off: no count in this section. For breaks and
  changes."
- **Remove section** (danger text, one tap, toast with Undo) and **Done**
  (closes the sheet).

Each change saves when made. A new section with no name picked yet is still
a section: it is named "Section" until a name is chosen (my call).

#### Edit · Song

The player stays pinned (play/pause and the seek bar), so "here" means
something. Rows:

- **Count speed:** ×½ ×1 ×2 with today's line. With anchors set it asks first
  in a dialog: "Change count speed? Counting at ×2 clears your 2 1s. Your
  sections stay, each on its nearest 1." (Cancel, Change). As today, the
  change clears the anchors.
- **Sample:** "From 1:26 · Automatic · a third of the way in, on a 1" with
  play, then **Start the sample here** ("At 1:19, the 1 before where it is
  now"), and when it is the user's, **Back to automatic**. A toast with Undo
  after each.
- **Song details** opens today's `SongDetailsSheet` (it is a form with its
  own Save and `use:guarded`; unchanged).
- **Clear all 1s** ("2 set by you") and **Clear all sections** ("8
  sections"): danger text, one tap, toast with Undo. Hidden when there is
  nothing to clear.

### Other states

- A song still being added, or failed: as today. The pencil there opens Song
  details, as today (no grid without beats).
- A class's song seen by a member: the listening page with the teacher's
  sections and the "next" line, the class banner, no pencil. The teacher's
  Edit is the same as a person's own.
- Desktop: the page sits in the pane beside the songs list, as today. Edit's
  pinned bar sits at the bottom of the pane. Right-click opens a beat's menu.

## Saving: as you go

Decided by the user: in Edit, every change saves when made, each with Undo in
a toast, and × only leaves Edit. This is an **exception** to the redesign
spec's rule ("editing shows × and the form's Save pinned") and the doc that
holds that rule must say so: the song page's Edit is a live tool (taps can't
wait for a Save), so it saves as you go and says so in the subtitle. Song
details stays a form with Save.

Undo restores what the field held before that change (the anchors list, the
sections list, the sample start). It is one more save, through the same
action as any edit, with `seen`.

## Sections: data and rules

- **Stored** in a new column `songs.sections_json text not null default '[]'`
  (additive `ALTER TABLE … ADD COLUMN`, no CHECK; read the generated SQL).
  A JSON array of `{ at: number, name: string, countOff: boolean }`, `at` in
  seconds, sorted by `at`.
- **Seconds, not beat indices.** Anchors are indices into the beats at the
  tempo factor, which is why a speed change clears them. Sections must
  survive a speed change, so they store a time, like `sample_start_s`
  (stored raw, snapped on read).
- **Snapped on read** to a 1 of the current count (`countsFor` over the
  scaled beats). A section start is always on a 1; when the 1s change,
  sections follow the count. Nothing that changes the count (a tap, Make this
  the 1, Use it, Remove this 1, Clear all 1s, an Undo, the count speed) ever
  rewrites `sections_json` or is refused because of sections: the stored
  seconds stay, only where they snap changes, so changing the count back puts
  every section back exactly.
- **Snapping, in order:** sections are snapped one by one in time order, each
  to the nearest 1 that comes after the previous section's 1. So two sections
  never share a 1 and none is lost: when the count changes so that two would
  land on the same 1 (at ×½ an eight is 16 of today's beats, so a 4-beat
  Break and the section after it would), the later one moves to the next 1.
  A section with no 1 left after the previous one (at the song's end) is not
  drawn. A section *write* that would land on the same 1 as another
  (an eight earlier onto a neighbour) is refused with "Another section
  starts there". Nothing tells the user a section moved; the grid shows it.
  (Calls of mine, from the builder check.)
- A section added on a beat that is not a 1 makes that beat a 1 first (one
  save that writes both columns).
- **Count off** is the section's flag. The song page shows no number in it.
  What the Practice player does with it is slot 1's.
- **Pure helpers**, new `src/lib/songs/sections.ts`, client-safe: parse and
  validate the JSON (a bad value reads as no sections, never a crash), snap
  to 1s, the grid's rows (rows start at 1s and section starts; short rows;
  which section a beat is in), `sectionAt(t)`, the next section and the
  eights or beats until it, and the listening line's words. These are what
  slot 1 reads later.
- **Group songs:** a section save on a group's song carries `seen`, which
  grows a `sectionsJson` key (`songSeen` in `clash.ts`), and is logged as an
  `edit` with subject `sections` (`editSong`). Every new write path goes
  through `editSong`, so History and the clash check come for free.
- **Copies:** a song family's flat fields (`trees.ts`, `flat.ts`) grow one
  root key, `sections` (the whole list is one field, as a routine's `slots`
  is; shown as "8 sections"). Copy to…, Make it mine and Keep in step then
  carry sections like the count and the sample. The builder checks that the
  copy engine copies the new column (it copies song rows whole today) and that
  Sync's landing (`apply.ts`) writes the key.
- **Keep in step:** song sections flow like the count and the sample (always,
  when the switch is on). The switch's "Sections and points" option is about
  a video's sections and does not govern them. In Versions and Sync a song's
  key reads "Sections · 8" (a song has no video sections, so the word does
  not clash there). (My call, from the builder check.)

## Suggestions: the rule

From the stored downbeats, read on the page, never stored:

- **Work in the stored beats (×1), whatever the count speed.** The downbeats
  were found against them and Beat This! counts bars of 4 of them. Map each
  downbeat to its nearest stored beat (within a quarter interval, as
  `suggestOne`), and take its index mod 4 as its bar phase. The count's 1s
  are mapped to their nearest stored beat the same way, giving the count's
  bar phase. At ×2 a 1 may sit on an inserted midpoint; it then disagrees
  with every bar, and the builder checks on a ×2 song whether that floods
  the grid; if it does, suggestions are off at ×2. (My call, from the
  builder check.)
- Find runs where the phase holds for at least N downbeats in a row (builder
  picks N from real songs; the Casa Mía data held its new phase for many
  bars after 1:01) and differs from the count's bar phase there.
- They compare against **the count shown**, with or without 1s set. With no
  1s the count is `suggestOne`'s guess, and the cards then mark where the
  downbeats move away from it, which is where a new song's 1 most likely
  moves. Runs of N downbeats keep that to a few per song (my call).
- Suggest the first beat of such a run, as a 1 at the nearest beat with the
  run's phase. Never suggest within an eight of an existing anchor, or inside
  a count-off section.
- They catch a 1 moving by 2 beats; they can't tell a 1 from a 5 (Beat
  This! counts bars of 4), and the card says so.
- Not now hides that suggestion for the rest of this visit to Edit (not
  stored; my call). With no anchors at all, today's `suggestOne` start still
  applies and the grid shows it as the count, not as a card.

## Where the music starts

Handed over from slot 1 (2026-11-08), agreed there with the user: some
YouTube songs open with silence or a quiet video scene, so a song starts
playing where its music starts. **The file stays whole**: anchors and beat
times stay valid, a wrong guess loses nothing, and the seek bar still reaches
0:00.

Measured on the 16 songs of the 2026-11-06 backup: Hermanita has 6 s of
silence then ~12 s very quiet (-48 to -62 dB), music from ~18 s (Beat This!
still found a "beat" at 7.56 s, so beats can't find the start); El Malo
5.2 s of silence; Sabes Tu Porque a 2 s fade-in; Obsesión 1.5 s near
silence; the other 12 start within 0.5 s. Plain `silencedetect` catches only
two. What worked: **the first moment the short-term loudness (0.5–2 s RMS
windows) rises to within ~30 dB of the song's median RMS and stays there.**
(30, not 20: see "Decided while building")
That gives ~18, 5.2, ~2 and ~1.5 s, and ~0 for the rest, and ignores Sabes Tu
Porque's dip at ~12 s. (Measured with `ffmpeg -t 60 -i F -af
"aresample=22050,asetnsamples=11025,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level"
-f null -`; in a nix shell `unset LD_LIBRARY_PATH` first or ffmpeg fails to
load, quietly behind a grep.)

- **Stored:** two additive columns on `songs`, no CHECK:
  `start_found_s real` (the worker's; null = not measured yet) and `start_s
  real` (the user's; null = use the found one). Where a song starts is
  `start_s ?? start_found_s ?? 0`. "From 0:00" stores `start_s = 0`. Not the
  same thing as `sample_start_s`, and not snapped to a beat (music can start
  off the beat).
- **The worker** measures it during analysis for new songs, and once for
  ready songs that have none: a worker endpoint lists ready songs with
  `start_found_s` null and takes the measured value back (the worker needs
  to fetch the audio for those; the media server `/audio` is cookie-only, so
  this is a worker route). It always writes a number (0 when unsure), so a
  song is measured once. Worker writes are worker state: not logged, no
  `seen`. Test against `node build`, never `vite dev` (hard rule).
- **The user's start** is a song field like the sample: a save on a group's
  song carries `seen` (`startS` in `songSeen`), is logged as an `edit`, and is
  a flat key (`start`, "Starts at 0:18") that Keep in step carries.
- **Playing:** the song page's player starts there when it starts from 0:00
  (Play, a section-list jump is a seek and is unaffected). The listening seek
  bar draws the part before it pale, with a mark where the music starts, and
  "Starts at 0:18, where the music starts." under the card before the first
  play when the start is past ~1 s.
- **The other players** (slot 1): `GET /[dance]/songs/[id]/grid` carries
  `startS` (the effective start). `songGrid.svelte.ts` holds no `<audio>`, so
  the seam is `playFrom(currentTime, startS, durationS)`
  (`src/lib/songs/music-start.ts`): every player calls it before its first
  `play()`, as the song page does. Slot 1 adds that call in its run code,
  after both branches land.
- **Seeing and moving it: option C (the user's pick, board row 5), in both
  places.**
  - **In the grid:** when the start is past ~1 s, the rows before it fold
    into one line, "Before the music · 0:00–0:18 · 3 eights", closed by
    default, above a "Music starts · 0:18" line with ✎. Opened, the quiet
    rows show greyed and work like any row (tap jumps, hold opens the menu).
    Holding any beat adds **Start the song here** to the menu (that beat's
    time, not snapped). ✎ on the line switches to Edit · Song at its "Music
    starts" group (my call: the reset choices live in one place).
  - **In Edit · Song**, a "Music starts" group beside the sample: "At 0:18 ·
    Found by the home box" (or "· Yours"), **Start it here** ("At 0:16, where
    it is now": the playhead), **From 0:00** ("Play the whole file"), and,
    when it is the user's, **Back to what was found**. Before the worker has
    measured it: "Not measured yet", with only Start it here.
  - Each change saves at once with a toast and Undo, like the sample.

## Forms and actions

- New or changed actions on `songs/[id]`: setting a 1 at a beat index
  (Make this the 1, Use it), the sections writes (add, change, move, remove,
  clear), and an Undo per field (or one "set" per field that Undo reuses:
  builder's call). Tap keeps posting the playhead time, plus whether the song
  was paused.
- One-tap writes stay `use:enhance` (no form someone fills in); the Other…
  name field is the one typed input, saved on Done or Enter (my call; it is
  short).
- **Raise PAGE_EPOCH** in the commit that changes the page's actions.
- Rapid taps: today's queue of taps in flight stays; Undo applies to the last
  change that has landed.

## Accessibility

- The grid is one tab stop; arrow keys move between beats (roving tabindex),
  Enter jumps there, Shift+F10 or the context-menu key opens the menu. A beat
  is announced as "1:19, beat 1 of Montuno, your 1".
- The toast's Undo is reachable by keyboard and announced (`role=status`).
- The pinned bar's buttons are 44 px or more; Tap on the 1 is the big one.

## What changes in the code (for orientation)

- `src/routes/[dance]/songs/[id]/+page.svelte` splits into the listening view
  and Edit (new components under `components/songs/`: the count card, the
  sections list, the grid, the section sheet, the Song tab).
- `src/lib/songs/sections.ts` (new, PURE) and specs for it; `song-page.ts`
  gains the line's words; `timeline.ts` draws section notches.
- `songs.sections_json`, `songSeen`, `editSong` subjects, the song's flat
  fields, `+page.server.ts` actions.
- The redesign spec's Edit rule gets its exception; the main design spec's
  "Music" and "Beat grid" paragraphs describe sections and Edit.

## Left to the builder

- Grid sizes (the board's 30 px cells fit 8 beats at 360 px), the auto-scroll
  pause, the long-press time (use `src/lib/longpress.ts`), how long the
  "before" row stays.
- Whether Edit is a shallow route.
- Whether Undo is its own action or a "set" reused.
- N for suggestions, tuned on real songs from a copy of the backup.

## Decided while building

- **Suggestions:** N is 4 downbeats in a row (on the 15 songs of the
  2026-11-06 backup it gives 0–3 a song and keeps Casa Mía's move at 1:01;
  6 loses real ones). The count's bar phase comes from its 1s only, so it
  holds at every speed; where a 1 sits between stored beats (a ×2 midpoint)
  there is no suggestion, so nothing floods and nothing is turned off at ×2.
  A move of exactly 2 beats reads as later.
- **What's next:** a counted section reads in eights and its last eight
  "after this eight"; a count-off section reads in beats.
- **The grid:** a row is quiet (folded before the music) when it ends at or
  before the music start, so the row the music starts in shows under "Music
  starts". The fold reads 0:00 to the music start. An eight earlier or later
  moves a section to the neighbouring 1, which is 8 beats away unless the
  count shifted there. The playing row is kept in view unless the person
  scrolled by hand in the last 4 s. The long press is 450 ms; the "before"
  row stays 4 s.
- **Edit** is page state, not a shallow route: it is an entry on the sheet
  stack (`sheetStack.open`), so Back and × leave Edit first, and the reload
  after each save (which resets `page.state`) cannot drop it.
- **Undo** is one `restore` action taking the field (`count`, `sections`,
  `sample`, `start`) and its old value; `count` puts anchors and speed back
  together.
- **Section names:** the chips are one list per language
  (`t().songs.page.section.chips()`): Coro, Montuno, Mambo and Break are the
  same words in Slovenian. A song's section is a **del** in Slovenian (a
  video's stays an odsek); unnamed is stored `''` and drawn "Section"
  or "Del".
- **Copies:** the flat keys are `sections` and `musicStart` (not `start`,
  which is the figures' "Starts in" set prefix).
- **The music start:** 30 dB under the median, not 20: 20 started Sabes Tu
  Porque after its fade-in (4.0 s); 30 gives 2.5 and moves no other song
  (Hermanita 18.0, El Malo 5.0, Obsesión 1.5, the rest 0.5 or less).
  From 0:00 is not offered when the song already plays from 0:00.

## Calls made in this document (to check)

- A section with no name yet is called "Section".
- Not now hides a suggestion for this visit only.
- The section names are one list for both dances.
- Sections are stored as seconds and snap to the nearest 1, so they follow the
  count when 1s change and survive a speed change.
- A section started on a beat that is not a 1 makes that beat the 1 first.
- The listening seek bar's notches are section starts, no longer the 1s.
- Nothing that changes the count rewrites or refuses sections; sections snap
  in order, so two never share a 1 and none is lost (the later one moves on).
- Suggestions work in the stored beats at every count speed, and show with or
  without 1s set.
- Song sections always flow with Keep in step, like the count.
- The music start is two columns (found, yours), not snapped to a beat.
- The grid's ✎ on "Music starts" goes to the Song tab's group rather than
  opening a menu of its own.
