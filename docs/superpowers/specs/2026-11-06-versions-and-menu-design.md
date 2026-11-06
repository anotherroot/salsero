# Whose version and the ⋯ menu — design

Agreed with the user on 2026-11-06, from the board "Whose version: three
options" (real screenshots of the position page beside options B, C and D).
The user picked **D**, with the shared ⋯ menu.

## Why

Six pages show a family of copies: figure, position, routine, drill, song and
lesson. Today each draws `SourceTabs` at the top of its body: a pill row with
one segment per version ("Yours | Intenziuci poletje 2026 | Sreda 17:30 |
Yours 2"), "Not the same? Separate", the compare line, a banner per copy that
differs, "Copies you can see" with Send mine…, and a row of small text buttons
(Copy to…, Same as…, Move to…, Detach, Drop my copy). With three or four
versions the labels squeeze onto two lines, and on a real page the whole block
pushes the page's own content (a position's figures, its notes and video)
below the fold. The user wants whose version this is shown at the top in a way
that holds up with four versions, and the copy actions in a ⋯ menu like the
lesson, routine and song pages already have.

## Goals

- **One "whose version" row** at the top of the page body, on all six pages,
  replacing the pill row, Separate and "Copies you can see".
- **One ⋯ menu part** in the band, on all six pages, holding the page's own
  menu items and the copy actions.
- Both are shared components the figure-page slot builds on; this part is
  merged into master on its own, before the rest of the positions work.

## Non-goals

- **The sync rework** (Update mine, Sync all, a Track option) is parked as an
  idea. Today's out-of-sync line and its Compare keep working as they do; the
  Versions list leaves room for a later sync button at its foot.
- **The Compare and Send sheets** are slot 8's (groups-polish). This work only
  opens them, as today; it does not change them.
- **Publish in the menu** is slot 5's (lesson-links); it adds its own item to
  the lesson's menu once this lands.
- No change to the server's offers (`pageSources`, `familyView`, `copyOffer`,
  `detachOffer`, `dropOptions`, `sameAsOffer`, the lesson's `move`), to any
  form field or action, or to the wording of the sheets the menu opens. No
  `PAGE_EPOCH` raise.
- The rest of the position page's layout (from / into figures, notes and video
  first) is separate work, designed and shown to the user on its own.

## Anti-goals

- A person with one version sees anything new on the page (no row; the ⋯ only
  where it has an item).
- An action that is offered today becoming unreachable, or one offered where
  it cannot be done (each menu item shows exactly when its offer is non-null,
  as each button does today).

## The row (option D)

Shown when the page has two or more sources (`sources.length > 1`), as the
first thing of the version part, where `SourceTabs` sits today on each page.

- A single card row (the `GROUP` look, 60 px or more): a 40 px tile with the
  shown version's icon (your own: person; a group's: group; a twin: link), the
  title, a meta line, and at the right "N ▾" in accent (N = the number of
  sources).
- **Title:** "Your version" on the person's own row, "<Place>’s version" on a
  group's ("Sreda 17:30’s version"). A twin of yours reads "Your version" too:
  the label in the list tells them apart ("Yours 2").
- **Meta:** "Also: Intenziuci poletje 2026, Sreda 17:30" (the other sources'
  labels, in the sources' order). When the page has a compare offer or a copy
  that differs, the meta says so in the status tone instead: "Sreda 17:30
  changed: notes" (the compare offer first, else the first differs banner).
- The whole row is one button; it opens **Versions**.
- Under the row, unchanged and in today's order: the "read-only, take what you
  want" note (`taking`), the compare line with Compare, and one banner per copy
  that differs with Compare. They open `CompareSheet` exactly as today.

## Versions (the list the row opens)

A `Sheet` titled "Versions", sub the item's name.

- One row per source, in the sources' order: the tile, the label ("Yours",
  "Sreda 17:30", "Yours 2"), and a meta line. The page's own row ends in a
  check and is not a link; every other row ends in a chevron and opens that
  version's page the way a tab does today (replacing the history entry, with
  `?vs=<mine>` when the person has their own member and the source is not a
  twin; `memberRoute`).
- **Meta:** what "Copies you can see" says today when the page has a family
  view (`selfMeta` for this one, `memberMeta` for the others, with the status
  chip: Behind, Newer, Differs). Without a family view: "This one" for the
  page's row, the place's role and status from the `Source` (`memberMeta` with
  no role when unknown), and "Marked the same" for a twin.
- Twins: "Not the same? Separate" under the list, the same form as today.
- At the foot, when the family view allows it (`family.canSend`): **Send
  mine…**, opening `SendSheet` as today. This is where a later sync button
  goes.
- Copies the person can see that are not sources (a family entry with no
  source) are listed after the sources, as they are in "Copies you can see"
  today, so nothing that list showed is lost.

## The ⋯ menu

A `BandButton` "more" at the right end of the band (after History and the
pencil, where the page has them), labelled "<Kind> menu" ("Position menu").
It opens a small `Sheet` (`size="small"`, a centred dialog on the desktop)
titled with the item's name.

- **Rows:** a 22 px icon in accent (danger in crimson), a bold 16 px label,
  and an optional muted meta line; 56 px or more; the look the lesson and song
  menus draw by hand today, now one component.
- **Order:** the page's own items first (as each page has them today), then
  Copy to…, Same as…, Move to…, Detach, and the danger items last (Drop my
  copy, then the page's own danger items: Delete, Remove from my lessons).
- **Each copy item shows when its offer is non-null**, exactly as its button
  does today; the drill page passes no `sameAs`, as today. Each opens its sheet
  (DropSheet, DetachSheet, CopyToSheet, SameAsSheet, MoveToSheet) unchanged,
  after the menu closes. Copy to…'s "Copied to …" toast with Open stays.
- **The ⋯ shows when the menu has at least one item.** That makes it new on
  the figure, position and drill pages and on a person's own song (Copy to…),
  and widens when the routine's and lesson's show.
- **Each page's own items move into the shared part unchanged:** the lesson's
  History and Remove from my lessons, the routine's Select slots, the song's
  History, Stop sharing and Delete. They keep their conditions and what they
  open.

## Decided while designing (the builder's calls, for the user to check)

1. **History stays where each page has it today**: a band button on the
   figure, position, routine and drill pages, a menu item on the lesson and
   song pages. Moving it is a separate look change, to show the user first.
2. **The row's meta prefers the compare offer** over a differs banner, since
   the compare line is about the page's own source.
3. **No row on one version**, and no "1 ▾": a page with a single version
   looks as it does today, minus the copy buttons (now in ⋯).
4. **The pill row's words go:** `VERSIONS` ("Versions") becomes the sheet's
   title.
5. **Whose the shown row is** comes from the page's `cloneLine.self` (a
   `PlaceRef`, already loaded by `pageSources`), not from `Source`, which has
   no place kind.
6. **The toasts keep a host on every page,** row or no row: the "Copied to …"
   toast and the landing toast after Drop my copy (`dropped`), which today
   live in `SourceTabs` and show even on a page with one version (where a drop
   usually lands).
7. **Versions closes before Send mine… or Separate opens,** as the ⋯ menu
   closes before its sheets: Separate can leave one source, and the row (and
   its list) would go while open.
8. **A copy listed with no matching source opens like a version**
   (replacing the history entry, with `?vs=` where it applies); today's
   "Copies you can see" pushes a new entry.
9. **Readers and edit mode:** the ⋯ follows each page's current rule for
   hiding `SourceTabs` and its own menu (while editing, while selecting slots),
   and a reader's page shows it when it has an item.

## Left to the builder

The component names and where they live (`components/clones/` for the row and
the list, `components/ui/` for the menu), the pure module for the row's and the
list's words with its spec, how a page hands its own items to the menu, the
order of the work across the six pages, and keeping the redesign spec, this
spec and CLAUDE.md's layout current. Keep the hard rules: one-tap forms on
`use:enhance`, colours from the builders (`class-rules.spec.ts`), refresh after
a sheet through `refreshWhenSettled()`, focus after a sheet closes on the ⋯.

## Then: Move to… for songs

The second step of this slot, after the shared part has merged: Move to… on a
person's own song (the note's "Songs have no move to"), as a menu item beside
Copy to…. Its server side (what moves, what happens to the person's practice
on it) is designed with the user before it is built.
