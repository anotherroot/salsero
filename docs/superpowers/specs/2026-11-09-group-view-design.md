# The group view: a new look, and it follows where you are

2026-11-09. Replaces the look of group mode in
[`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md) part 2
(the navy band, the striped edge, "Salsa Tuesdays · group") and changes when it is on.
Everything else there (what group mode lists, what + makes, Working in, who gets it)
stands. Mockups were shot on the real app over three rounds, from a copy of the
2026-11-06 backup; they are not committed (they hold personal data). The last round,
"round 3", is what was picked: the phone's top row and filled tab bar, desktop idea H3.

## Why

An owner or editor of a group edits things other people see. Today that is easy to
miss:

- **The look.** The navy group mode does not feel like the app (salsa is clay, bachata
  wine), and the user wants a look that still feels like salsa but says at a glance
  "what you change here, others see".
- **When it is on.** Group mode is a switch (a cookie) and nothing else. Open a group's
  lesson from Groups, or a group's figure mixed into your own Moves: every edit button
  is there, the page looks like your own, and on the desktop your own Lessons list sits
  beside it with nothing lit.

Success: wherever you can change a group's things, the screen says whose they are and
who sees them, on the phone at any scroll and on the desktop; and the view goes in and
out with how you move, so it never surprises you.

## The look *(user, round 3)*

The dance's own colours everywhere: navy is gone. Nothing new at the very top of the
screen: on Android the status bar (clock, battery) is transparent over the band, so a
strip there either covers it or reads as a margin under it. No banner-like strips,
warning stripes or frames: it must look like the app, not a dev build.

**Phone, top of the page.** The band's first row (where the small "X · group" line is
today) becomes the group's row: today's people icon in a round cream badge (the icon in
the band's colour), the group's name in band ink at 17 px extra-bold, and on the right
the faces of the group's people as small overlapping initial circles with a count
("2 people"). Below it the band is as on any page: Back, the title, the actions, the
subtitle.

**Phone, scrolled.** The slim band (once the big one has scrolled away) puts the same
round badge before the title. *(my call, from round 3: the group's name as a second line
crowded a compact page's slim band, which already has a subtitle.)*

**Phone, tab bar** *(user: "G's colour idea")*. Filled with the band's colour. Icons and
labels in cream at about 70 %; the lit tab a cream pill with band-coloured icon and
label; Mine (where Today was) in cream, back arrow and word as today. The app is edge to
edge, so the tab bar runs under Android's navigation bar: while the bar is filled, the
page tells the Android app to draw that bar's icons light (`SalsaBars` gets `dark`, see
`src/app.html`), and back to the theme's when it is not. No APK change.

**Desktop** *(user: H3 alone)*. The side opens with a cream card above the tabs: the
round badge (here band-coloured with a cream icon), the group's name and the count on
two lines, in the band's colour. The band row stays exactly as on your own pages: no
group row over the title on the desktop. The side's Mine stays where Today was. The
list column and the pane are unchanged.

**Both themes.** Dark mode takes the dark band of the dance; the cream badge and card
stay cream.

**What goes:** the `GROUP` tokens (`tokens.ts`) and both `[data-dance][data-group]`
blocks in `layout.css`, the navy `--gutter-band` and `theme-color`, `data-group-edge`
(the stripes), and the small `data-group-line` as drawn today. The two other places that
borrow the navy through `data-group` (a comment's avatar, `CommentItem`; "Set by your
teacher", the exercise page) take the dance's own accent *(my call: navy no longer means
"group" anywhere)*.

**The faces** *(my call)*: up to three people of the group other than you, by name, as
initials; the count is everyone in the group, you included. With only you, the badge
and name and "1 person", no faces.

## When you are in a group's view *(user)*

The view belongs to where you are in your history, not to one switch.

1. **A page of one thing decides by that thing.** A lesson, figure, routine, position,
   song or move page whose row belongs to a group you own or edit is in that group's
   view, however you got there (Groups, a lesson's links, your own mixed lists, a
   figure's switcher). A row of a group you only read opens as today (read only), in
   your own view. A row of your own is in your own view, even if you were in a group's
   view before: stepping through a figure's switcher onto your own figure leaves the
   group.
2. **A group's own page** (Groups → the group, its People, storage, History, Recently
   deleted) is in that group's view when you own or edit it *(my call)*.
3. **Moving forward keeps the view.** A tab, a list link, + or any other forward step
   from a page in a group's view lands in that group's view, unless rule 1 or 2 decides:
   Moves from a group's lesson opens the group's Moves.
4. **Back gives back the view that page had.** Open a group's lesson from your own
   Lessons and press Back: your own Lessons, in your own view. Forward (the browser's)
   likewise.
5. **Today and its pages stay personal**, as now. Settings, the admin, the player too.
   **A group's drill** (`/[dance]/exercises/[id]`, a team row you own or edit) is the one
   exception *(user)*:
   - opened from a group's lesson or a group's list (a forward step in the group's view),
     its page is in the group's view, like any page of one thing;
   - opened from your Today, to practise it, it is in your own view; but while you edit
     it (Edit on the page, the `editing` state, not a page of its own) the frame shows
     the group's view, since what you change reaches the group's people. Stopping
     editing (Save, ×) puts your own view back;
   - Mine while editing it there stops editing (with the unsaved-changes question as ×
     asks) and stays on the same exercise, in your own view.
6. **Mine** leaves the group's view, as a forward step, landing on:
   - on a page of one thing: your own copy of it first (your clone in the family,
     `memberIn`, or your twin, `twinsOf`); for a figure next, your own figure in the
     same merged move, the first in the switcher's order (`mergedMoveFigures`);
     otherwise that tab's list, yours;
   - on a list: the same list, yours (as `minePath` does now);
   - on a group's own page: your Groups list.
7. **The Work in sheet** (the group button beside +) still switches straight into a
   group or back to Mine, as a forward step.
8. **Who gets it** is unchanged: owners and editors, at the Everything level
   (`groupModeShown`). Below it nobody is ever in a group's view.

On the desktop the list beside an open thing follows the same view: a group's lesson
opens beside the group's lessons with its row lit, never beside your own Lessons.

## How it may work (constraints, and a suggested shape)

Constraints that hold whatever the build:

- **No load changes the view.** SvelteKit runs loads on hover and touch preload; a load
  only reads. (Same reason as today's Mine being a form.)
- **The server is never trusted with a client's say-so.** Whatever names the group (a
  cookie today) is re-checked on every request (`groupModeOf`: the group alive, of this
  dance, the person owner or editor), and access to any row stays `access.ts` and the
  `require*Access` guards, as now.
- **A preload must load what a tap would show.** Hovering Moves while in a group's view
  preloads the group's Moves.
- **One page, one view**, the same from the server, on the device offline (the device
  answers GETs only when the network fails, `docs/hard-rules.md`), and after a reload.

- **A write lands in the space its page shows**, in every browser tab: two desktop tabs
  may show different views, and a + in a tab showing your own view never makes a group
  row because another tab is in a group *(my call, from the builder check)*. So the view
  cannot live only in one shared cookie.

Suggested shape *(my call, the builder may find better)*:

- A page of one thing (rule 1) and a group's own page (rule 2) work out their view from
  their row and the person's role. The layouts that draw the list beside them (Lessons,
  Moves, Music, Groups) use the open row's view for the column.
- Every other page (the lists) carries the view in its address: a query parameter, say
  `?in=<team id>`, re-checked by the server like the cookie is now (`groupModeOf`'s
  checks) and ignored when it fails. A query parameter is not the URL-based routes the
  follow-ups spec set aside: no route is doubled. Back, Forward, preload, several tabs,
  a reload and the offline device then all get the right view from the address alone.
- Forward steps carry it: the tab targets (`$lib/nav/tab-links.svelte.ts`), the Moves
  lists' own switch (Figures, Routines, Positions) and filters, Mine (drops it), Work in
  (sets it), and every form action a list in a group's view posts (`?/create` and the
  others: the action reads the same parameter or a field, re-checked), so + makes the
  group's row. Links from a list to a page of one thing need nothing: that page decides.
- The group cookie goes, or stays only as a fallback the builder can justify; the switch
  action (`/[dance]/group-mode`) becomes a redirect to the address with or without
  `in`.
- **A fresh start** (a new tab, a typed or bookmarked list address without `in`, the app
  opened cold) is in your own view; a page of one thing still decides by its row
  *(my call)*.
- `page.data.groupMode` (or a renamed `view`) stays the one thing the frame reads: the
  band row, the slim band, the tab bar, the side card, `theme-color`, `SalsaBars`.

**What a page shows in a group's view** *(my call, from the builder check)*: the content
follows the view, as group mode's does today (`inGroupMode`, now decided by the row, not
the cookie): a group lesson's link cards open the group's rows, not your copies; twin
offers, sources and `sameAsOffer` as in group mode. One exception, the user's: a
figure's switcher keeps the merged move (yours and the groups' figures) in a group's view
too, so stepping onto your own figure is possible and leaves the group (rule 1). Your own
routines and sections on a group's figure stay hidden there, as now; Mine reaches yours.

**Today carries your own view forward** *(my call)*: Today's pages are in your own view,
so a tab from Today opens your lists.

## Non-goals

- What group mode lists and makes, Working in on the Groups list, the clash check,
  History, Recently deleted, What's new: unchanged.
- No URL-based group routes (`/salsa/g/<id>/…`); set aside in the follow-ups spec, still.
- No new colours per group.

## Anti-goals

- A strip or banner at the top of the screen, or anything that looks like a debug or
  staging marker.
- The view changing on hover, on a preload, or on Back to a page that was not in it.
- A member (reader) ever seeing the group's view, or edit controls they do not have.

## Left to the builder

- The exact sizes, spacing and the faces' colours (round 3: badge 30 px, faces 26 px
  with a 2 px band-coloured ring, the side card 18 px radius with a 34 px badge), and
  the words in both catalogs (en, sl; Slovenian count with `slCount`).
- Where the per-entry view is kept and how the cookie is kept in step, within the
  constraints.
- Tests: the view rules as pure functions (which view a page has, where Mine lands),
  the frame in group and own view, the cookie re-check, the Mine targets.
- Screens: re-shoot the phone (390×844, light and dark, salsa and bachata, top and
  scrolled) and the desktop (1440×900 `--viewport`) in group view, and the phone baseline
  of own pages must not change.
- `PAGE_EPOCH`, if the change breaks older open pages.
- Update `docs/features.md`, `docs/layout.md`, and part 2 of the follow-ups spec (point
  it here).
