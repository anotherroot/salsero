# Full-screen player, round 2: upright videos on a phone

Status: design, 2026-10-29. Builds on
[`2026-10-29-video-player-redesign-design.md`](2026-10-29-video-player-redesign-design.md)
(three levels, Back up one level, the editor, the trim strip), which shipped
the same day. Mock-ups: the "Round 2" and "Round 3" rows of the design canvas
(https://claude.ai/artifact/Frkabcp1eJGFVjvG8kU5qe).

## Why

Used on the phone, the redesigned player fell short in portrait:

- **Most videos are upright** (filmed on a phone). Portrait gave the video at
  most 55 % of the height, so an upright video sat in a narrow column and
  pushed everything under it down.
- **Edit section and Back were off screen.** In the section view both live in
  the panel under the video; with an upright video the panel overflows and
  they scroll away. Landscape has both in the top bar.
- **The editor scrolled.** It got whatever the video left, so half of it was
  below the fold.
- **No way to focus on the moves.** Landscape fades its controls; portrait
  always shows controls and the whole list.
- **A frame is too small a step.** At 60 fps one frame is 17 ms — tapping it
  shows nothing. A 0.1 s step is what the user reaches for.

## Goals

1. Portrait is laid out for an upright video first, and still works for a
   wide one.
2. The section view's Back and Edit are always on screen, in the top bar.
3. Every edit control in portrait is visible without scrolling.
4. A Hide button folds the controls away so the video gets the screen.
5. Sections in one row, so a section can be opened — or switched to from
   another section — in one tap.
6. The fine step is 0.1 s, everywhere.
7. The screen stays on while the player is open, playing or paused.
8. Pinch to zoom into the picture.
9. Double-tap the left or right of the video to jump 1 s.

## Non-goals

- A pause between repeats, and counting repeats — offered, not chosen.
- Any change to the levels, the Back rule, delete/undo, or the server.
- Changing the landscape layout beyond what is listed under "Everywhere".

## Portrait

**Sizing rule.** The controls under the video are sized first; the video
takes what is left, kept whole (`object-fit: contain`), centred on black. The
55 % cap goes. Only the full list (a sheet) ever scrolls. On a very short
screen the video keeps at least 120 px and the editor scrolls instead — the
only case where it may.

**Full video** (canvas A): top bar as now (✕, title, Mirror, speed). Under the
video: the time to hundredths and the length, a **Hide** button, the timeline,
the transport (−1 s, −0.1 s, Play, +0.1 s, +1 s), Mark point / Start section,
and the **sections row**.

**Sections row.** One horizontal, scrollable row of chips: first **All · n**,
then every spot in time order — a section chip shows its name and length, a
point chip its name. Tapping a section chip opens its view; a point chip opens
its editor (as tapping it in the list does today). **All** opens the full list
as a sheet over the controls (the video stays visible above it); every card
there has an **Edit** button besides the tap that opens it. With nothing
marked, the row is replaced by the existing "Nothing marked yet…" hint.

**Section view** (canvas C): the top bar becomes ✕, **‹ Full video**, a
coloured **Edit**, Mirror, speed. The section's name is the badge on the
video (it is already there, with the loop's progress bar). Under the video:
`2.7 / 7.2 s`, **Hide**, the section's timeline with its start and end, the
large transport, and the sections row with this section's chip highlighted
and scrolled into view. Tapping another section's chip switches to it in
place — the open section view is *replaced*, so Back still goes to the full
video. The panel's own ‹ Full video row, its speed row and its Edit section
button go (all three are in the top bar now).

**Hidden** (canvas B, D): Hide folds the controls to a slim bar — the
timeline (the whole video's, or the section's), **Show**, −0.1 s / Play /
+0.1 s, and the time (or `2.7 / 7.2 s`). The top bar stays, so ✕, Back and
Edit are still one tap away. The choice is remembered per browser beside
mirror and speed (`video-prefs.ts`). The editor ignores it: editing always
shows the editor.

**Editor** (canvas 3, 4, E): as today, but sized first so it never scrolls:
the compact transport row (time, −0.1 s, Play, +0.1 s), name and Loop, the
trim strip, Start | End, the move row (−1 s, −0.1 s, Now, +0.1 s, +1 s, 52 px
tall), Earlier / Shorter / Longer / Later, and Delete / **Done** (Done 52 px,
wide). The top bar stays as it is.

## Everywhere (portrait, landscape, desktop)

**0.1 s instead of a frame.** The transport's frame buttons, the editor's
±1 f and the `,` / `.` keys become −0.1 s / +0.1 s. A step pauses, then
seeks. In the editor ±0.1 s moves the chosen edge by 100 ms and pauses on the
edge (the "frame" kind of move today). The frame number and the frame-rate
measurement are removed (`frame-rate.ts`, and the frame helpers in
`spots.ts`), along with "frame N" in every layout. A drag on the trim strip
snaps to hundredths, the precision the times are shown in.

**Edit on the list cards.** Landscape's `Sections (n)` panel gets the same
Edit button on every card as portrait's All sheet; desktop keeps its Edit on
the open card.

**Screen stays on.** While the player is open it holds a screen wake lock
(`navigator.wakeLock`, which the Android app already provides inside its
WebView), takes it again when the page becomes visible, and lets it go on
close. A browser without it just dims as before.

**Pinch to zoom.** Two fingers on the video zoom it, 1× to 4×, about the
point between the fingers; one finger drags the zoomed picture, which never
leaves a gap at its edges. A trackpad pinch (wheel with Ctrl) does the same
on the PC. While zoomed, a chip in the video's corner says `Zoom 2×` with
**Reset**. Zoom combines with Mirror, survives level changes, and is gone
when the player closes.

**Double-tap a side.** A double tap on the left or right third of the video
jumps −1 s / +1 s, with a brief `« 1 s` / `1 s »` mark on that side; each
further tap on the same side within 0.6 s adds a second (`« 3 s`). A single
tap keeps today's meaning (play/pause; in landscape, show the controls first),
taken once the double-tap window (≈ 250 ms) has passed without a second tap.
A tap in the middle third is never delayed. The jumps follow the loop rule
like the ±1 s buttons.

## Testing

Pure modules carry the logic, as in round 1: the zoom maths (scale clamp,
pinch about a point, pan clamp, combined with mirror) and the tap classifier
(single / double / which side / repeated taps) get unit specs; the 0.1 s
edge moves get specs in `spots.spec.ts` in place of the frame ones. Layout,
Hide, the sections row and the wake lock are checked in the browser at
390×844 with an upright and a wide video, at 390×640, and in landscape and
desktop for regressions.

## Calls made after the builder check

My calls, not discussed — each is cheap to change:

- **The All sheet follows the chip rule.** Opening a section from a card
  replaces the sheet *and* any open section view, so Back always goes to the
  full video. A point, from a chip or a card, opens its editor over the full
  video, so Done returns there.
- **Zooming an upright video:** panning stops at the picture's own edges, and
  along a side where the zoomed picture is still smaller than its box it
  stays centred. The zoom chip stacks under the speed / Mirrored badge in the
  top-right corner.
- **±0.1 s on an end** parks the video 10 ms before the end, so the paused
  picture is still inside the section (it used the frame length before).
- **Saving the Hide choice merges** with what is stored: `VideoFrame.svelte`
  writes `{ mirror, rate }` whole today and would wipe it, so its save merges
  as `YouTubeCard`'s does.
- **A section started but not ended, then Hide:** the slim bar has no End
  section; the pending band stays on its timeline, and Show brings the button
  back.
- **"Linked to …"** leaves the section view (no room under an upright video);
  the editor and the list cards still show it.
