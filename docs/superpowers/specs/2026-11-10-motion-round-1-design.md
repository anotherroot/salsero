# Motion, round 1: Done, lists, the player's beat, taps

Status: approved on the board, 2026-11-10. Board (real screenshots, Now / With
motion): https://claude.ai/artifact/FzmFGe1LM931W4w59LxtqK

## Why

The app has almost no motion. A press changes colour, a toast appears, a row
that leaves a list is simply gone, and the player's count swaps digits. The
user says the app feels fine. This round is curiosity, not a complaint, so it
is small and it must never make the app feel slower.

The user's reactions to the first demos decided what is in this round:

- Lists that move: good.
- Done: yes, but it happens on its own page, so the moment plays where you
  land (Today), not on the exercise page.
- The player on the beat: good, "would make the music feel more beaty".
- Taps that dip: yes.
- A title that travels between pages: no, it looked glitchy.

They picked option B (livelier). Option A (quieter) may be used case by case
when a page is built and B feels too much there.

## Goals

1. **Done lands on Today.** After saving a face, Today shows what changed.
   The row slides into its done place, the check pops in, the bar fills, the
   count words change, and the toast rises in.
2. **Lists fold and open.** A row that leaves slides out and its gap folds
   shut. The rows under it slide up. Undo opens the gap and the row comes back.
3. **The player's count moves on the beat.** Every count gets a small push,
   the 1's cream disc pops in, the 5 lands a little harder, the lit dot grows,
   and on a new figure's 1, Next rises into the call.
4. **Taps dip.** Rows, buttons, chips and tabs scale down a little under the
   finger and settle back when it lets go.

## Non-goals

- **Page transitions.** The card-and-band ideas ("dip and swap", "dips
  away") were tried live and taken out (fa98a107). They come back in a later
  round, not this one.
- **Title travel between pages.** It was rejected.
- New sounds. The board's clicks were only there to judge the timing.
- Motion on the desktop that the phone doesn't have. The desktop gets the same
  motion; a mouse press dips like a finger.
- Animating the band fold. It is already scroll-linked and stays as it is.

## Anti-goals

These count as failures even if the motion works:

- **Anything that waits for an animation.** A tap acts at once. Navigation,
  saving and the toast's Undo never wait for motion to end, and a second tap
  mid-animation works.
- **Glitches.** A row jumping, a frame of the old layout, a flash or a
  double-drawn row is worse than no motion. If a case can't be made clean,
  leave it still.
- **A count that drifts from the music.** The player's motion follows the
  same playhead the digit reads. It never runs on its own timer.
- **Motion with reduced motion asked for.** Everything in this round is off
  under `prefers-reduced-motion: reduce`, as the band fold and sheets already
  are.

## The motion vocabulary

All of the round uses these, defined once (CSS custom properties in
`src/routes/layout.css`, plus a small TS module for Web Animations code):

| Name | Value | Use |
|---|---|---|
| short | 150 ms | presses, fades out, a row sliding off |
| medium | 260 ms | folds, sheets leaving, toasts, checks |
| long | 380 ms | the Done landing (rows moving, bar fill) |
| ARRIVE | `cubic-bezier(.2, 0, 0, 1)` | things moving into place |
| SETTLE | `cubic-bezier(.3, 1.35, .6, 1)` | a small overshoot: checks, pops, a press let go |
| LEAVE | `cubic-bezier(.4, 0, 1, 1)` | things going away |

Only `transform` and `opacity` move, plus one list card's height while a row
folds. These are the values on the board. The builder may tune them by eye on
a phone, within about ±30 %.

## 1. Done lands on Today

**Now:** Done on the exercise page opens "How did it go?". You tap a face,
the sheet vanishes, Today appears with the row already in its done place,
and the toast "Saved · back in 3 days" appears.

**With motion:**

| Step | What moves | Timing |
|---|---|---|
| Tap Done | the button dips (taps, §4) | short |
| "How did it go?" rises | as now (Sheet's `rise`) | — |
| Tap a face | it pops: 1 → .92 → 1.08 → 1 | 420 ms, ease-out |
| The sheet leaves | slides down off the screen and the dim fades, instead of vanishing | medium, LEAVE |
| Today: the rows | each row moves from where it was to where it is now (FLIP). The done row slides up into the done group with a soft shadow at mid-flight, and the rows it passed slide down | long, ARRIVE |
| Today: the check | the row's type tile fades and the green check pops in from .55 | medium, SETTLE |
| Today: the bar | the green fill grows from the old width to the new, starting 120 ms in | long, ARRIVE |
| Today: the words | "5 for today" → "4 left for today", "0 of 5 done" → "1 of 5 done": the old line lifts 8 px and fades, the new one rises 8 px in | short each, overlapped |
| The toast | rises 24 px and fades in | medium, ARRIVE |

**How Today knows.** The landing plays only on the landing right after a
save. Today needs the saved exercise's id and where its row was before. The
handoff already exists: `$lib/exercises/saved.svelte.ts` (`announceSaved`)
carries the toast to the next screen. Give it the exercise id. "Where it was"
is Today's previous order, which Today can know from its last draw, or from
the exercise page's position in the run. How is the builder's call. If Today
was not the previous page (opened cold, or from a link), there is nothing to
fly from: the check, bar and words still animate, and the row stays still.

**Also, the same moment:**

- Done · next in a run: no check on the button (the user's pick). The face
  pop and the sheet sliding away are the moment, and the next exercise opens
  as soon as the save lands, as it does now. Nothing waits. There is no Today
  landing, because you don't go there.
- The last one of the day: the TodayBar card becomes Done for today. The fill
  is the same; the card's words change the same way.
- Logging a past day (past days page): the row lands in that day's list the
  same way.

## 2. Lists fold and open

**Now:** Swipe a Today row, tap Not today, and the row is gone on the next
draw. Undo brings it back the same way.

**With motion:**

| Step | What moves | Timing |
|---|---|---|
| Swipe | Not today shows (as now) | — |
| Tap Not today | the row's card slides off to the left from its swiped spot, and fades from 60 ms in | short, LEAVE |
| The gap | the rows under it slide up by its height, and the list card's height shrinks with them | medium, ARRIVE |
| Undo | the rows slide back down, the card grows, and the row fades in from .96 once the gap is half open | medium + short, SETTLE |

The row leaves at once in the data and in focus (`focusAfterRemoval` as
now). Only its picture stays for the 150 ms it takes to slide off.

**Everywhere a list changes** (the same rule, one shared helper):

- Today: Not today, Coming up's + Next 5, and Done reordering the list.
- A routine's slots: removing one, and a dragged slot gliding into place.
  `SlotList` already has some motion here; make it use the shared helper.
- A lesson's links, sections and recordings; a figure's and a position's
  links.
- Music: To pick, a playlist. Comments. Suggestions run or dropped.
- Every Undo in a toast brings its row back the same way.

**Lists that don't fold:** a list redrawn by a filter or a search changes all
at once. Folding there is noise.

## 3. The player on the beat

**Now:** `StageCount` swaps the digit each beat, the 1 is a cream disc, the
lit dot is 16 px and the others 10 px, and `run-call`/`run-next` change text
on a new figure.

**With motion** (the board runs it at 180 BPM):

| Moment | What moves | Timing |
|---|---|---|
| Each count | the digit starts at 1.045× and settles to 1 | 85 % of the beat, ARRIVE |
| The 5 | the same push, harder: 1.09× | 85 % of the beat |
| The 1 | the cream disc pops in from .8× | 85 % of the beat, SETTLE |
| The dots | the lit dot grows 10 → 16 px, and the last one shrinks back | min(110 ms, 40 % of the beat) |
| A new figure, on its 1 | the old call lifts 24 px and fades. Next rises and grows from its 15 px into the call's size and place, and the new Next fades in under it once the move is 40 % done | min(long, 1.4 beats) |

**Only a normal step moves** (my call). Pushes, the dot and Next rising play
only when the count steps forward by one beat. A seek, a section jump or a
loop restart changes the digit, the dots and the call at once, with no
motion: after a backward jump the names would be the wrong ones to fly.
Next reads "Next: X" and the call reads "X", so the "Next:" label fades out
early while the name rises.

The dot's 10 → 16 px growth is drawn as a scale, so only `transform` moves.

**Timing.** Each push starts when the digit changes, inside the same
animation frame where `StageCount` reads `player.songTime()`. It is never a
timer of its own. The motion's length scales with the beat, so at any tempo
one push is gone before the next. A pause stops it where it is. A count-off
(quiet) section has no pushes, and its dash and plain dots stay still.

Where it applies: the player's stage on a phone, landscape and desktop, in a
run and with a song. `RunLayer`'s strip count gets the push too, but not the
disc pop. It is small.

## 4. Taps dip

**Now:** a press darkens (`active:brightness-90`, `active:bg-step`,
`active:opacity-60`).

**With motion:** the press keeps its colour change and also scales down:

- Rows (a list row, a Today row): to .985.
- Buttons, chips, tabs, icon buttons and the round play button: to .94.
- Press: short, ARRIVE. Let go: back to 1 with SETTLE (medium).

It comes through the class builders in `src/lib/components/ui/styles.ts`
(`button`, `rowButton`, `iconButton`, `bandButton`, `CHIP`, `ROW`…), so it
arrives everywhere at once. A press's scale must not fight a row that is
being swiped or dragged (`Swipeable`, slot drag). While one of those moves,
the press scale is off. A pure CSS `:active` scale with a transition (the
settle on release is a CSS easing) is enough. It needs no script.

## Constraints

- **Android WebView on a mid-range phone.** Animate compositor-friendly
  properties only. The fold's card height is the one exception. Keep it to
  one element, or replace it with a transform plus clipping if it stutters.
- **No new dependencies.** Svelte's `animate:flip`/transitions and the Web
  Animations API are enough. Neither is used in the app yet; either is fine.
- The hard rules stand: colour from the builders (a scale is not a colour, so
  it may live in the builders), `focusAfterRemoval`, `refreshWhenSettled`.
  Nothing new is stored. Reduced motion is honoured in CSS and in every
  `.animate()` call.
- Offline and the device build behave the same (no network in any of this).

## Found in the code (builder check)

- On the phone each page draws Today's list and bar anew (found while
  building: the builder check thought they stayed mounted), and the save
  reloads the data before the page leaves, so Today lands already in its new
  order. "Where it was" is what the list last showed, kept outside the
  component (`flipList`'s `id`, `kept` in `flip.ts`; TodayBar's last hero in
  its module script). A Today never shown before the save has nothing to move
  from: only the check pops.
- The Done sheet lives in the exercise page and is removed as soon as Today
  shows. Its slide-down has to be drawn by something that outlives the page,
  such as a copy of it in the `[dance]` layout. The navigation doesn't wait for
  the slide.

## Left to the builder

- How Today knows the row's previous place (see §1).
- Svelte `animate:flip` or a hand-rolled FLIP helper for the lists; one helper
  either way.
- Whether the sheet's leave is a CSS animation on `dialog` close or a Web
  Animation before `dialog.close()`. Either way, closing must not wait on it
  for focus or history.
- Tuning the values by eye on the phone, within the ranges above.
- Order of work: taps → lists → Done → player is a sensible order (each one
  builds on the vocabulary). Every part ships on its own.
