# Link from other places — design

> **Status:** written after brainstorming, 2026-11-10, on branch
> `link-other-figures`. Builds on the unified pickers
> ([`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md)),
> the Link popup ([`2026-10-29-section-link-popup-design.md`](2026-10-29-section-link-popup-design.md)),
> lesson links ([`2026-11-05-lesson-links-and-music-design.md`](2026-11-05-lesson-links-and-music-design.md))
> and clones ([`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md),
> Copy to… is its point 4).
>
> **Built 2026-11-10** on branch `link-other-figures` (plan
> [`../plans/2026-11-10-link-from-other-places.md`](../plans/2026-11-10-link-from-other-places.md)).
>
> **Look picked 2026-11-10: option B** from the board
> https://claude.ai/artifact/B7yJwAdMjH1Nft5dedsiUf (real screenshots of the
> bachata backup of 6 Nov beside three options): a heading per place, and a
> tap opens a card that says what the copy brings before it is made. The
> board's scenes are `scripts/shots/ext_link_other.py`.

## Why

A teacher building a group's lesson searches for a figure they already made,
in their own app or in another of their groups, and the picker finds nothing:
a group lesson's pickers list only that group's rows. So they make a new one.
That new one is a stranger to the one they had: not a clone, not in its family.

The user wants the search to find those too, say where each lives, and say
that linking one copies it into this group. Copied through Copy to…, it comes
in as a **clone**, in the same family as the original. That is the point
*(user)*: a student who goes to several groups, or moves up a level, meets the
same figure as one family, already marked as clones, instead of unrelated
same-named rows they would have to twin by hand.

## Goals

- On a **group's lesson**, every linking picker that today lists only the
  group's rows also finds, while searching, the same kind of row in:
  - the person's own app ("Yours"),
  - every other live group of the dance they are in, as owner, editor or
    member *(user: read-only groups too, marked as such)*.
- Each such row says where it lives. Picking one opens a card: what the copy
  brings, what stays behind, and **Copy and link**. That copies it into this
  group (Copy to…, `copyTo`) and links the copy, as one step.
- The same for every kind those pickers link *(user: "yes" to routines,
  exercises and positions too)*.

The pickers it covers:

| Picker | Kinds | Link made |
|---|---|---|
| Lesson page, Figures `+ Add` | figure | `linkFigure` |
| Lesson page, Routines `+ Add` | routine | `linkRoutine` |
| Lesson page, Exercises `+ Add` | drill (Copy to…'s `drill`) | `linkExercise` |
| Lesson page, Positions `+ Add` | position | `linkPosition` |
| The Link popup, wherever it opens on a group's video (a lesson video's section or point, a group recording's section) *(my call: one popup, one behaviour)* | figure, drill, position (a point: positions only, as today) | `linkInSpace` / `linkPositionInSpace` |

## Non-goals

- **A person's own lesson.** It already offers the group rows they may use,
  tagged with their group, without copying (`listLinkableFigures`' `theirs`,
  ruling 2). Unchanged.
- **Field pickers** (Move to…'s "Or join a figure", the Link popup's
  `+ Variation` Figure field, the routine editor's slots). Only linking
  pickers change.
- **One page for every version** (the second round, below).
- Any change to Copy to… itself, its sheet, or what a copy brings.

## The picker (option B)

Searching, the list is, top to bottom:

1. **This group's own rows**, as today, under the group's name as heading.
   When none match: "Nothing here matches “cradle”." (as today's empty line).
2. **Yours** — the person's own matching rows, with the person icon.
3. **One heading per other group** the person owns or edits, by name, with
   the group icon.
4. **One heading per group they only read**, last, in the warn colour with a
   lock: "Tuesday class · you only read it".

Inside each heading rows keep today's picker shape (a move heading with its
figures under it; routines, drills and positions flat). The row's trailing
icon is `+`. The create row at the bottom ("Not in the list? Create …") is
unchanged.

With the search empty, only the group's own rows show, as today *(my call:
the other places are for finding what you remember having; listing every
place unasked would bury the group's own rows)*.

### What shows once

- **A family already live in this group** shows only as the group's row; its
  members elsewhere are not listed. (No second copy can be made from the
  picker.)
- **A family in several other places** is one row, under the first of them in
  the heading order above (Yours first), with "also in Sreda 17:30" (all the
  other places, joined) as its second line. That row is the one copied.
- **A family whose member in this group is archived** is listed under its
  other place; the card offers **Restore and link** in place of Copy and link
  (`restoreMember`, then link).
- **Twins** *(my call)*: a row whose twin set (the `twins` table, as
  `foldVersions`/`foldNamed` read it) holds a live row of this group is left
  out: the group's row already stands for it. Other twin sets fold as pickers
  fold them today. Positions have no fold in their picker; for them only the
  family rule applies.
- **A same-named row in this group from another family** (not a clone, not
  twinned; for a figure the same move and variation name, for the other kinds
  the same name) *(user: show it, with a warning)*: the row from the other
  place still shows, with a warn-coloured second line "This group has its
  own". Its card leads with the warning ("Intenziuci poletje 2026 has its own
  Cradle entry · Basic, not a copy of yours"), its primary button is **Link
  the group's one** (links the group's row, no copy), and **Copy anyway** is
  the quieter second choice. Names compare as the pickers' search does
  (case and accents folded).

## The card (B2)

A tap on a row from another place opens a sheet over the picker (the picker
stays open under it):

- Title: "Copy Cradle entry · Basic into Intenziuci poletje 2026?"
- One line: it comes in as a clone of the one in <place>, so they can be kept
  in step, then it is linked to this lesson.
- **Comes along**: Copy to…'s `copyPlan(...).goes` (recordings and their
  sections, the figures a routine brings, the size), and its `already` lines
  (what the group has already, reused, not doubled).
- **Stays behind** (new): what links to the source from **lesson videos**
  (not its own recordings), which a copy never brings, counted: "3 sections
  from other lessons". For a figure or drill, sections (`spot_links`); for a
  position, sections and points (`spot_position_links`); for a routine,
  nothing (no section links a routine) and the line is left out *(my
  call)*. Left out when the count is 0. This answers the user's worry that the
  teacher sees more on their own figure than the class will see on the copy.
- Twin questions, when `copyPlan` asks any, as the Copy to… sheet asks them.
- A storage line when the copy would not fit the group's limit, with Copy and
  link disabled (Copy to…'s refusal text). `copyPlan` gives only the bytes;
  the group's used and limit come from `copyTargets` (or the card's endpoint
  grows them).
- **Cancel** and **Copy and link** (accent, the primary). For a read-only
  source the same; the copy is the group's to edit. For a row whose name the
  group already has (above): the warning on top, **Link the group's one** as
  the primary, **Copy anyway** and Cancel below it.

Copy and link closes the card and the picker, and the lesson page shows the
new link. A toast says it was copied and linked. Linking pickers that stay
open on `+` (link and stay) close only the card, and the row moves under the
group's heading, marked linked.

A failure (the source gone, a race that made a member meanwhile) says so in
the card; a member made meanwhile is linked instead of copied
(`copyTo` answers `made: false` with it).

## Server

- **The lists, online only** *(my call)*. The candidates come from a new
  `network` GET endpoint the picker asks while searching (debounced), not
  from the lesson page's load or the Link popup's GET: both of those are
  answered by the phone offline (`DEVICE_ENDPOINTS`), and the copy can only
  run online anyway. Offline, or when it fails, the other places' headings
  are replaced by one line: "Other places need a connection." Each candidate
  carries its place, `alsoIn`, its family's state in this group (none /
  archived member id), and the id of a same-named group row from another
  family, if any. Built from what the person reads (`access.ts` reach,
  never `.dance` alone), filtered by the rules above, only for a person who
  edits the group.
- **The card's data**: the existing `GET /api/clones/copy?kind&id&into=<group>`
  (`copyPlan`) plus the new "stays behind" count and the group's storage
  (in `copyPlan`'s view, or beside it).
- **Copy and link**: a new lesson page action, and for the Link popup a new
  route of its own (the popup's `POST /api/video-spots/[id]/links` is a
  `device` write and stays so), both `network`, taking `kind`, `id`, `use`
  (and for the popup the spot). Link the group's one needs nothing new: it
  is today's link of the group's row. Copy and link runs
  `copyTo(db, user, kind, id, groupSpace, use, …)` with the link as its
  `after` hook, so a new copy and its link are one transaction. The lesson
  link functions return `false` on a refusal rather than throwing: the hook
  throws on `false`, so a copy never lands without its link (`linkInSpace`
  already throws). `copyTo` returns early, without the hook, when the family
  already has a member in the group (`made: false`): a live one is then
  linked in its own transaction; an archived one (`archived: true`) is not
  linked but answered for Restore and link. Restore and link runs
  `restoreMember` then the link. The links go through the existing data
  functions, so `logChange`, `reconcileEntries` and, where that function
  calls it, `autoAddPending` happen as for any link.
- Only a person who **edits the group** gets any of this (the pickers already
  show only with `canEdit`); `copyTo` checks the target again.
- **Offline**: the new endpoint, action and route are `network` in
  `src/lib/offline/routes.ts` (as `copyTo` is): a copy writes many group rows
  and files.
- **i18n**: every new word in en and sl (`t()`), the refusals too
  (`refusals-guard.spec.ts`).
- No migration. No `PAGE_EPOCH` raise (nothing an open page relies on
  changes).

## Calls I made (check these)

1. Other places show only while searching.
2. A family in several places is one row, Yours first, copied from that row.
3. A row whose twin is live in this group is left out.
4. The `+ Variation` field in the Link popup does not search other places
   (it is a field picker).
5. "Stays behind" counts only what links to the source from lesson videos;
   none for a routine.
6. Other places need a connection; offline the picker says so.
7. Every Link popup on a group's video, not only a lesson's.

## Left to the builder

The exact data shapes, where the candidate lists are built (a new
`src/lib/server/` module is fine), component names, the toast's words, and
whether the card reuses parts of the Copy to… sheet. Screens to shoot after:
the board's scenes in `scripts/shots/ext_link_other.py`, light and dark.

## Second round (not here)

Brainstormed next, kept in the project's note: one page for a figure's whole
family (every version's videos, sections and notes on any version, each
marked with where it is from, other groups' content folded away until opened;
whether switching versions is still needed), adding a section on a read-only
version, copying single fields between twins without making them clones, and
twin marks kept on the family so a group shows them to everyone who reads it.
