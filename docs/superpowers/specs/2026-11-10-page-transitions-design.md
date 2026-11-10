# Motion, round 2: changing pages (the card lifts and settles)

Status: picked on the demo, 2026-11-10 (option D). Demo with real screens,
the other options, slow pages, scrolled down and the failures:
https://claude.ai/artifact/JjnEJjPBh58G99XJgiY9nK

## Why

Round 1 (`2026-11-10-motion-round-1-design.md`) left page changes out. Today
a tap lights the new tab at once, but the old page stays still until the new
page's data arrives. After 100 ms a grey skeleton of the destination covers
it, then the real page replaces it in one frame. Nothing moves, and what the
user sees is a wait followed by a snap.

The user wants a page change that always animates into place, whatever is
loading. It should be fast but smooth, and above all never jitter or snap
when the data comes. They tried four ways on the demo and picked D.

A sibling slot (`device-first`) is making pages read from the phone's copy
first, so most pages will be ready almost at once. This design must work for
both cases: a page that is ready at once, and one that waits on the network.

## Goals

1. **The card lifts and settles.** The page's cream card (the Screen's
   `<main>`) is one card that stays. On the tap it lifts and its words fade
   out. When the new page is ready, it comes down to where the new page's
   band ends, and the new words fade in. The band stays where it is and only
   its words change.
2. **The lift is the wait.** The card holds up there, empty, until the page
   is ready. There's no skeleton. With data on the phone the hold is near
   zero, so it reads as up, then down.
3. **A slow page says so.** Still up after 0.5 s, three small dots in the
   band's colour pulse on the empty card.
4. **No page leaves the user stuck.** Still up after 8 s, a line under the
   dots says "Still trying… Go back". Go back lands the card on the page the
   user came from.
5. **Errors are pages.** A 404, a refusal, a server error or "offline" lands
   like any other page, with its error screen on the card. The one exception
   is the offline layer, which stays a layer (see Failures).

## Non-goals

- **The desktop** (≥ 1024 px, the side and the pane) keeps today's pending
  behaviour: the bar and the skeleton. *My call:* the user only tried it on
  the phone's frame. The desktop can follow in another round. The one thing
  it does get is the "Still trying… Go back" line on its skeleton after 8 s,
  so no page leaves anyone stuck (goal 4).
- Moving the tab bar. It never moves; its lit tab changes at once, as now.
- Sheets, the player's layers and toasts. They are not page changes.
- A change of the query only (a filter, a search, `?in=`). The lists fold
  there (round 1), and the card doesn't lift.
- The full-page reload the app falls back to after dropped navigations
  (`$lib/nav/dropped.ts`). It stays as it is: the WebView reloads, unanimated.

## Anti-goals

These count as failures even if the motion works:

- **A snap or a jump when the data comes.** The new page must never appear
  first and move after. The landing starts from where the card is held.
- **A seam.** The band is one colour. Any layer the motion uses paints
  exactly the band's colour, and fades as one piece, so no edge or darker
  strip shows (found on the demo: two see-through layers make a strip where
  they overlap).
- **Waiting on motion.** A tap acts at once. A second tap while the card is
  up or moving works at once: the card stays where it is and waits for the
  new page.
- **A frame of the old page's words under the new band**, or the new page's
  words on the old card.
- Motion with reduced motion asked for (see below).

## How it moves (phone)

Values from the demo, written with round 1's vocabulary (`src/lib/motion/`):

| Step | What moves | Timing |
|---|---|---|
| Tap | The tab lights (as now). The card lifts 70 px from where its top edge is on screen, never above the slim band's foot | 200 ms, ARRIVE |
| Tap | The old card's words and the old band's words fade out | 130 ms, LEAVE |
| Waiting, 0.5 s in | The dots fade in on the empty card, about 46 px below its edge | 200 ms in, a 900 ms pulse, 150 ms stagger |
| Waiting, 8 s in | "Still trying… **Go back**" fades in under the dots | 200 ms |
| The page is ready | The card comes down from where it's held to where the new page's band ends | 320 ms, ARRIVE |
| The page is ready | The new band's words and the card's words fade in | 240 ms, ease-out, from 60 ms |
| The page is ready | The dots and the line fade out | 120 ms, LEAVE |

"Ready" means the new page is drawn, so its band height can be measured.
The card lands there. The builder may tune the values by eye on a phone,
within about ±30 %.

**Scrolled down.** When the user has scrolled, the band is folded into the
slim band and the card runs on under it, with **square corners**. The card is
already as high as it can go, so it doesn't lift: its words fade, and it holds
under the slim band (square). When it comes down, its corners round
(260 ms) as it leaves the slim band. The rule that covers every case: the
card lifts at most 70 px from where its edge is now, never above the slim
band's foot, and lands where the new page's edge will be.

**Back to a scrolled page.** A page that comes back scrolled (Back to a list)
has its edge under the slim band. The card lifts to the slim band, its
corners square off, and its words fade in. It doesn't come back down.

**The band.** Its colour never changes during a move. Its words (title,
subtitle, the band's buttons and tabs) fade out with the old card's words,
and the new band's words fade in with the new card's. The band's height
follows the card: the card covers whatever of the band isn't the new page's.

**Today's card** sits over the band (`data-band-hero`). It belongs to the
card's words: it fades with them.

**Reduced motion.** No lift and no fades: the page changes at once when it is
ready, as today. The dots (still, not pulsing) and the "Still trying" line
still show, on the old page's card.

## Failures

- **An error answer** (404, no access, a server error): the card lands with
  the error screen (`+error.svelte`, `ErrorScreen`), like any page.
- **Offline / no connection.** Today the phone waits 4 s for the network,
  then asks its own copy. If the copy can't answer either, the card lands
  with the "You're offline" screen and Try again.
- **Known offline.** When `navigator.onLine` is false and the phone's copy
  can't answer, the root layout cancels the navigation and lays a modal
  Offline layer over the page, so anything typed stays. That stays as it is.
  The card lands back on the page the user was on (as Go back does), and the
  layer opens over it. *My call* (builder check): the layer protects typed
  text, and a landing would lose it.
- **No answer at all.** The network layer may never fail. After 8 s the card
  shows "Still trying… Go back". Go back abandons the navigation (the URL
  stays the page the user was on) and lands the card on that page. Without
  Go back the card keeps waiting until the navigation ends one way or the
  other.
- **Any other tap while waiting** (‹, a tab, a row): the waiting navigation is
  dropped and the card, already up, waits for the new one.
- **A redirect** (signed out, sent to Login): the card lands on wherever it
  ends up. A page without the band and card (Login's card pages, the welcome
  steps) just appears, as now.

## Where it applies (settled after the builder check; my calls)

- **Every change of path lifts the card**, except steps inside one page:
  the figure switcher (`VariationBar`'s pick), `VersionsSheet`, and the Moves
  list's own steps (`goto` with `keepFocus`/`noScroll`). There the card
  doesn't move; only its words fade out and in (130 ms out, 240 ms in, the
  same as a landing). The builder may mark these with an explicit flag
  rather than infer them from `goto`'s options.
- **A run's Skip and Done · next lift**: each opens a new exercise, so it
  reads as a new page. Done · next still opens the next exercise as soon as
  the save lands (round 1's rule: nothing waits).
- **A destination that keeps its scroll** (`noScroll`, Back to a scrolled
  page) lands where its edge is drawn, as in "Back to a scrolled page".
- **Done landing on Today** (round 1, §1). The card lands first. Round 1's
  landing starts when the card has settled: the rows move from their old
  places, the check pops, the bar fills, the words swap and the toast rises.
  Today is drawn anew by each page on the phone (round 1, "Found in the
  code"), so its rows' old places come from `kept` (`flip.ts`), not from a
  hidden Today. The Done sheet's slide-down plays over the lift as now.
- **Pages without the band and card.**
  - **Into** a full-screen page (Practice `/[dance]/player`, the positions
    map, share): the card lifts and waits as usual, with the dots and the
    "Still trying" line. When the page is ready, it fades in over everything
    (200 ms, ease-out).
  - **Out of** one, to a page with a card: the band's colour and the card come
    in held up 70 px, then land as usual.
  - **Login, welcome, join** and the other `CardFrame` pages appear at once,
    as before. They come before sign-in, and none of the motion applies.

### Error screen changes (agreed with the user)

1. **The Offline screen keeps the tab bar.** Found while building: the
   "offline without the tab bar" screen was the Offline layer (a modal over
   the whole page), not the error page. A page change that cannot reach the
   server never draws `+error.svelte`: the layer stops it first, or the page
   loads whole. On the phone the layer now stops above the tab bar, which
   shows, inert while the layer is open. Its backdrop is truly transparent: the
   app-wide scrim had beaten its own transparent class.
2. **Add "Still trying… Go back"**, as above. New words in both catalogs
   (en, sl).
3. **Drop the "ERROR 404" line** on Not found. The band ("Not found") and the
   heading ("Figure not found") already say it.

## What it replaces

- The phone's skeleton (`PageSkeleton`, `skeletonFor`, `SKELETON_DELAY_MS`),
  for every destination, those without a card too. The lifted card is the
  wait now. The desktop keeps its skeleton.
- The thin progress bar (`NavProgress`) on the phone, for every destination:
  the dots say the same thing. *My call;* the desktop keeps it.

## Constraints

- **Android WebView on a mid-range phone.** Move the card with `transform`
  only, and fade with `opacity`. The corners' radius animates on one element.
- The band fold is CSS scroll-linked (`data-fold`, `band-*` keyframes in
  `layout.css`, `band-collapse.ts`). The move must not fight it: measure the
  card's edge and the slim band's foot on screen, as they are drawn.
- SvelteKit keeps the old page mounted until the new one's `load` answers.
  The old words fade out while still mounted; the old page must not flash back
  if it is still there when the card is up.
- The hard rules stand: `refreshWhenSettled`, `focusAfterRemoval`, words
  through `t()` in both catalogs, colours from the builders, nothing new
  stored. Focus moves to the new page as it does now.
- `PAGE_EPOCH` doesn't change: nothing stored or posted changes shape.

## Left to the builder

- How the move hooks in: `beforeNavigate`/`onNavigate`/`afterNavigate`, or
  the root layout's `navigating` watch (`$lib/nav/pending.ts`).
- How "Go back" abandons a navigation in flight.
- How the card is drawn while it waits (the old `<main>` emptied, or a stand-in
  card shape over it), as long as the user sees one card.
- How the offline error keeps its frame.
- Tuning the values by eye on the phone, within the ranges above.
