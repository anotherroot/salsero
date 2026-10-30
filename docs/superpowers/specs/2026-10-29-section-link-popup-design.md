# Link a section in one popup, creating what it shows — design

> **Status:** approved in brainstorming, 2026-10-29. Builds on
> [`2026-10-15-video-section-links-design.md`](2026-10-15-video-section-links-design.md)
> (spot links), [`2026-10-29-figures-are-variations-design.md`](2026-10-29-figures-are-variations-design.md)
> (a figure is a group of variations) and the full-screen player as it stands
> after [`2026-10-29-video-player-upright-design.md`](2026-10-29-video-player-upright-design.md).
>
> **Updated 2026-10-30**
> ([`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md)):
> the list, its search, Add buttons and "Other…" moved into the shared picker.
> The popup now shows only the links and one button, "Link a figure or
> drill…", and opens straight into the picker when the section has no links.
> A tap in the picker links and closes everything; + links and stays; Done
> closes. The create steps open from the picker's create row, and the variation
> step's figure chips are a Figure field (a picker). In the full-screen player
> the levels are four history levels: `link`, `link-pick`, `link-new`,
> `link-figure`. Where the text below describes the list, the picker replaces it.
>
> Mockup: `.superpowers/brainstorm/3008515-1793306080/content/section-create-v3.html`
> (local, not committed; open it in a browser). Rows A and B are the design.

## Why

Going through a lesson video, the user marks a section showing a move they
don't have in the app yet. Today they can only link a section to a variation
or drill that already exists. So they leave the video, create the figure or
variation somewhere else, come back, and pick it from a long `<select>`. And
a variation linked through a lesson's video doesn't count as taught in that
lesson unless it is also linked to the lesson by hand.

The user's words: "I wanted to just tap a button for create new variant or
create new figure instead of link existing", with the parent figure and a
name, and a description at most, "but I probably wouldn't fill it out cuz
there is a video showing how to do it". And: "if I link a figure in a section
of a video of a lesson that figure should also be linked to the lesson. And if
it's then removed it should be removed."

## Already built (not part of this)

From the figures-are-variations work, on master:

- A lesson links a specific variation ("Enchufla · Doble"), not only a figure.
- The lesson's "+ New figure" sheet has a "Variation of a figure" mode, for a
  variation learned with no video.

## Goals

1. **One Link popup** for a section. It shows what the section is linked to,
   links something else in one tap, and creates a variation, a figure or a
   drill and links it, without leaving the popup. It is the same popup on the
   lesson page and in the full-screen player.
2. **The fast path in the player**: mark a section, tap **Link** on the
   "Section saved" toast, link or create, and keep watching.
3. **Links take little room.** Outside the popup, what a section is linked
   to is one small line.
4. **A lesson's figures include what its videos' sections link to**, and lose
   it again when the section is unlinked.

## Non-goals

- No change to the spot-link rules (sections only, same dance, drills only
  among exercises, a linked section refuses delete).
- No change to the figure page's or drill page's "+ Link a section" sheet.
- No notes field when creating from the popup: the video is the notes. Notes
  are added on the variation's page, if ever.
- No new way to delete anything.

## Anti-goals: it fails if

- the keyboard opens without the user tapping a text field (the player's
  rule, which now applies to the popup everywhere);
- a popup opens on top of a popup (creating replaces the popup's content
  instead);
- a variation disappears from a lesson that the user linked by hand, without
  them choosing that.

## Decisions

These are the user's:

- Linking is a **popup** (a centred dialog), not a sheet and not an inline
  panel. Creating happens **inside** it.
- What a section is linked to is shown **very small**: a grey line under the
  section's time on the lesson page, and a small line under the section's
  name badge on the video in the player.
- Create from a section: **New variation** (pick its figure, type a name),
  **New figure**, and **New drill**.
- A variation (or drill) linked through a section of a lesson's video **is on
  that lesson**, and leaves it when the link goes.
- Unlinking a section from a variation that is **also linked to the lesson
  by hand** asks: **Only from this section** / **From the section and the
  lesson** / **Cancel**.

Mine, shown in the mockup and approved with it:

- New figure's variation name starts as **"Basic"** (editable). Partner and
  style start on the user's defaults (`defaultStyle`, partner "With
  partner").
- New variation copies **partner and style** from the figure's first live
  variation (lowest id), and is otherwise blank, as `createVariationIn`
  makes it. This differs from the lesson sheet's "Variation of a figure",
  which asks for partner and style. That form stays as it is.
- Drills behave like variations: created from the popup, and shown on the
  lesson through a section (see "Lessons" below).
- A lesson figure row that is there **through a section** carries a "via
  section" tag. Its Unlink asks first: "Enchufla · Doble is linked through
  section 0:42–0:55. Unlink it from the lesson and the section?" with
  **Unlink** / **Cancel**. It removes the hand link, if there is one, and
  every link from this lesson's videos' sections to that variation.
- The toast after End section gets **Link** next to Edit, and stays up about
  6 s instead of 4.

## The Link popup

One component, two skins: light on site pages, and the player's dark palette
(`--pl-*`) inside the player. Centred, with a scrim, at every size, including
landscape and desktop in the player. ✕ closes it. Back and Esc go from a
create step back to the picker, then close the popup, then follow the player's usual
levels (a sheet or popup closes first, as in the player today).

### The list (mockup A2, B3)

*Superseded 2026-10-30: the candidates, search and Add moved into the shared
picker; already-linked items are shown greyed, not left out.*

- **Header:** "Link 0:42–0:55" (the range), and under it the section's name
  (if it has one) and its length.
- **Linked:** one row per link, labelled with `figureLabels` ("Enchufla ·
  Doble") or the drill's name with a "Drill" note, archived ones marked
  "(archived)". Each has **×**. Unlinking follows "Unlinking" below.
- **Search**, never focused on open. It filters the rows below by label,
  trimmed and case-insensitive.
- **Candidates**, each with a one-tap **Add**, leaving out what is already
  linked:
  - from a **lesson video**: *This lesson* (the lesson's variations and
    drills, hand-linked or through a section), then *Other* (every other live
    variation and live drill of the dance);
  - from a **figure's recording**: *This figure* (the live variations of the
    recording's variation's figure), then *Other*.
- **+ Variation · + Figure · + Drill** at the bottom. Each opens its create
  step, carrying the search text into the name field it asks for first (the
  variation name, the figure name, the drill name).

An Add or a create puts the new link under **Linked**. A tap on a row, or Create and link, closes
everything; + on a row keeps picking.
The section's small line updates behind the popup.

### Create steps (mockup A3, A4, B4)

Each replaces the popup's content, with **‹ Link** at the top to go back. The
subtitle says where it goes: "Linked to 0:42–0:55 and to Cubana class", or
"Linked to 0:42–0:55" from a recording.

- **New variation:** *Figure*, a field that opens the shared picker (the same one Move to… uses).
  From a lesson video, the figures that this lesson's variations belong to
  come first. From a recording, the recording's own figure comes first.
  Then *Variation name*. **Create and link.** It is refused, with the message
  in the popup, when the name is taken in that figure ("Enchufla already has
  a Doble.").
- **New figure:** *Figure name*, *Variation name* (starts "Basic"),
  *Danced* (With partner / Solo), *Style* (the dance's styles). **Create and
  link.** It is refused when the figure name is taken in the dance ("There's
  already a figure called Enchufla.").
- **New drill:** *Name*, *How often* (the frequency presets, default as the
  lesson's "+ New exercise"). **Create and link.**

Creating and linking is **one transaction**: the variation or figure or drill
and the spot link, or nothing. The lesson needs no extra write (see
"Lessons").

### Unlinking (mockup A5)

× on a Linked row:

- if the section's video is a lesson video **and** the target is also
  hand-linked to that lesson (`lesson_figures` / `lesson_exercises`): the
  popup's content becomes the question **Unlink Enchufla · Basic?** "It's
  also linked to this lesson." **Only from this section** / **From the
  section and the lesson** (red) / **Cancel**;
- otherwise it unlinks at once.

"From the section and the lesson" deletes the spot link and the hand link.
If another section of the same lesson still links the target, the target stays
on the lesson through that section, which is correct.

## Lessons: derived, not copied

A lesson's variations are **its hand links plus the variations its videos'
sections link to**, computed on read. The same goes for drills, with
`lesson_exercises` and spot links to `exercise_id`. Nothing is written to
`lesson_figures` or `lesson_exercises` when a section is linked, so there is
nothing to keep in step: unlinking the section is what removes it.

Every reader of `lesson_figures` / `lesson_exercises` goes through one place
that returns the union, with how each entry got there (`byHand: boolean`,
`viaSections: { spotId, label }[]`). Today's readers, all in
`src/lib/server/lessons.ts` and `src/lib/server/spot-links.ts`:

- `getLesson`'s figures and exercises (the lesson page, the Today review);
- `linkedFigureIds` and the "already linked" filters of
  `listLinkableFigures` / `listLinkableExercises`. A variation already on the
  lesson through a section is not offered for a hand link (my call: linking
  it by hand would change nothing visible);
- `taughtIn` (a variation's "Taught in");
- `linkableSections`' "taught here" ordering;
- the "never in both places" rule for a variation's own exercise (see
  below).

**A variation on the lesson through a section counts as linked for the
"never in both places" rule** (my call, after review). Its own exercise
(`source = 'figure'`) is hidden from the lesson's Exercises list by
`getLesson`'s `ownedByLinked`, left out by `listLinkableExercises`, and
refused by `linkExercise`, all computed over the union. Nothing is written:
`linkFigure`'s sweep of a hand-linked exercise stays a hand-link-only write.
A hand-linked exercise row that the section hides comes back if the section
is unlinked. That's harmless, and it's what "nothing is copied" means.

**The filters match today's per kind** (my call, after review). Today
`getLesson` shows hand-linked variations even when archived, and leaves out
archived exercises. A variation through a section is shown on the same terms
as a hand-linked one, marked "(archived)" when it is. A drill through a
section is left out when archived, like a hand-linked drill. `taughtIn` keeps
leaving out archived lessons.

## Screens

### Lesson page, under each video's Sections (mockup A1)

- Each section row: ▶, the name (or the time), and under it one grey line,
  "0:42–0:55 · 🔗 Enchufla · Doble, Arm styling", cut with an ellipsis and
  "+n" when it doesn't fit.
- On the right, a **link icon button** (44 px target) that opens the popup.
  It is in the accent when nothing is linked yet, and grey once something is.
- The old **Link…** button, the inline `<select>` and the chips with × are
  gone. Unlinking is in the popup.
- `VideoSections.svelte` also shows a recording's sections on the figure page.
  The same change applies there.

### Lesson page, Figures (mockup A6)

Rows labelled with `figureLabels`. A row there through a section gets a
small **via section** tag (or "via 2 sections"), with the sections' ranges as
its second line. Unlink on such a row asks first, as in "Decisions". A row
that is hand-linked only unlinks as today. The Exercises list treats a drill
the same way.

### Full-screen player

- **The toast** after End section: `Section saved · 13.0 s` with **Edit** and
  **Link**. Link opens the popup on that section (mockup B1).
- **Section view** (mockup B2): under the section-name badge on the video, a
  second, smaller badge, "🔗 Enchufla · Doble +1", or "🔗 + Link" in the accent
  when nothing is linked. Tapping it opens the popup. No new row of controls.
  In landscape, where the badge fades with the controls, it fades with them.
- **Editor** (mockup B5): the existing "Linked to …" line becomes a button
  that opens the popup, and shows "🔗 + Link" when nothing is linked. It is
  as small as it is now.
- Delete stays refused while linked, as today.
- **Where the player can link** (my call, after review): only where it opens
  on a video whose sections the user manages, which is the lesson page's
  videos and the figure page's recordings (the inline player's Full screen
  and `VideoSections`' ▶). These hosts pass a `linking` prop (the owner's
  context) and refresh with `invalidateAll()` when the player closes, as the
  lesson page already does. Everywhere else the player opens (the Today
  popup, `SectionCard` on the figure, drill and exercise pages, and the
  preview in `LinkSectionSheet`), it shows the link line read-only, with no
  "+ Link" and no Link on the toast. That keeps a host from going stale under
  an open log popup or sheet.
- **Back on site pages** (my call, after review): the popup on the lesson
  and figure pages gets no history entry, like every other sheet on the
  site's pages. Android Back there behaves as it does with those sheets
  open today. Inside the player, the popup is one of the player's sheets and
  follows its history rules, so Back steps from a create step to the picker,
  then closes the popup. The Android check is for the player.
- `Spot.linkedTo` (labels) stays as the player's source for the small
  lines. The popup loads its own data when it opens.

## Server

### Data functions

In `src/lib/server/spot-links.ts` (or a sibling), `db` first:

- `linkOptions(db, spotId)`: the popup's data. The section (range, label),
  its owner kind, the lesson (id, title) if any, `linked` (link id, target,
  label, archived, `alsoByHand` for a lesson video), `candidates` grouped as
  above, and `figures` for the New variation chips (the lesson's or
  recording's figures first, then the rest, each with its variation names
  for the clash check).
- `createAndLink(db, spotId, create)`, where `create` is
  `{ kind: 'variation', groupId, name }`,
  `{ kind: 'figure', figureName, name, partner, style }` or
  `{ kind: 'drill', name, everyDays }`. One transaction around the existing
  creators (`createVariationIn`, `createFigure`, `createCustomExercise`) and
  `linkSpot`. Returns the new link, or a typed refusal (name taken,
  bad style, not a section, other dance). The existing creators open their
  own transactions. Whether to nest them (better-sqlite3 savepoints) or
  factor out transaction-free inner functions is the builder's call, but
  the result must be all or nothing.
- `unlinkFromSection(db, linkId, { alsoLesson: boolean })`: deletes the spot
  link and, with `alsoLesson`, the hand link to the section's lesson.
- The derived lesson membership described under "Lessons", plus the lesson
  row's "unlink via section" (the hand link and every spot link of this
  lesson's videos to the target, in one transaction).

### API

The player talks to the server through `/api/`, so the popup does too, on
both pages. Flat, like `/api/video-spots`:

- `GET /api/video-spots/[id]/links` → `linkOptions`.
- `POST /api/video-spots/[id]/links` with `{ target }` (link existing) or
  `{ create }` → the updated `linkOptions`. A refusal is a 400 (409 for
  "already linked", as today) with the message.
- `DELETE /api/video-spots/[id]/links/[linkId]?alsoLesson=1` → the updated
  `linkOptions`.

Each checks the spot's dance against the target's through the existing rules
in `linkSpot`. There is no dance in the URL: the spot's own dance is the
wall. A missing spot is a 404, and a target or figure group from the other
dance is a 400. Device tokens may call `/api/`, as they may call
`/api/video-spots` today. The lesson page's `linkSection` / `unlinkSection`
form actions and `VideoSections`' `targets` prop go once nothing uses them.
After the popup closes, the lesson page refreshes (`invalidateAll()`), as it
already does when the player closes.

## Testing

Test-first, data layer against `openDb(':memory:')`:

- `createAndLink` for each kind: the row and the link both exist, or neither
  (force the link to fail, e.g. a point instead of a section, and check that
  no variation, figure or drill was left behind). Name clashes are refused,
  and the dance wall holds.
- Derived lesson membership: a section link puts the variation on the lesson
  and on the variation's "Taught in". Unlinking removes it. A hand link
  survives "Only from this section". "From the section and the lesson"
  removes both. Two sections linking one variation: removing one keeps it.
  The same for drills. Archived targets and lessons are filtered as today.
- `linkOptions`' groups and order for a lesson video and for a recording.
- The API routes: link, create, unlink with and without `alsoLesson`,
  refusals, a missing spot is a 404, and a target from the other dance is a
  400.
- The "never in both places" rule over the union: a variation through a
  section hides its own exercise from the lesson's Exercises, and
  `linkExercise` refuses it.
- In the browser against `npm run dev`, at phone portrait and desktop: the
  toast's Link, the popup from the section view, the editor and the lesson
  page, each create step, Back from a create step, the keyboard never opening
  by itself. Then in the Android app, Back from inside the popup.
- `npm run check` passes.

## Documentation this changes

- `2026-10-15-video-section-links-design.md`: a status note pointing here.
  "Linking happens in lists on the pages" and the lesson page's Link… become
  the popup.
- `2026-10-01-video-player-design.md`: the toast's Link, the section view's
  link badge, the editor's link line.
- `2026-09-23-lessons-design.md`: a lesson's variations and drills include
  those its sections link to.
- `CLAUDE.md`: the section-links line in "Live".

## Left to the builder

- Component structure (one `LinkPopup` with a `theme` prop is my guess), and
  how it sits inside the player's `<dialog>`.
- The exact copy of refusals, within the examples above.
- Whether the derived membership is one SQL union or two queries merged in
  TypeScript.
- Whether the popup's create steps use `use:guarded`. They are fetch forms
  inside a popup, like the player's rename sheet, so my guess is no: closing
  a half-typed create step just discards it.
