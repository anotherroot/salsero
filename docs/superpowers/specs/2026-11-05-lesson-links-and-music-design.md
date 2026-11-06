# Lesson links, tidied, and music with notes — design

> **Status:** written after brainstorming, 2026-11-05, on branch `lesson-links`.
> Builds on the lessons spec
> ([`2026-09-23-lessons-design.md`](2026-09-23-lessons-design.md)), the
> unified pickers ([`2026-10-30-unified-pickers-design.md`](2026-10-30-unified-pickers-design.md)),
> the Link popup ([`2026-10-29-section-link-popup-design.md`](2026-10-29-section-link-popup-design.md)),
> groups and their follow-ups (class songs:
> [`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md))
> and clones ([`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md)).
>
> **Looks picked 2026-11-06** from mockups beside real screenshots (390×844,
> light and dark, from the 6 Nov backup): 1A "+ Add" in the heading, 2B one
> link with what it found, 3A Publish in the band's strip as a real button, 4B
> New lesson as the share list's first row, 6C compact Music rows whose note
> opens on a tap, 7A the note asked right after the pick. 5 (Routines from a
> class) is A2: the day in the accent text colour, bold, behind the Lessons
> icon. The figure page (slot 1) follows 1A and reuses the 2B popup.

Two parts, built in this order. Part A is small and touches only lesson and
linking screens. Part B is a new table that groups, copies and History must
learn about.

## Why

The lesson page grew one way of adding per kind: a "+ New" in each list's
heading, a full-width "Link an existing …" button under each list, and the
Links list's add form sitting open in the page. It takes a lot of space for
what is, in every case, "put something here". Positions have no "+ New" at
all. The user wants one small button per list.

Sections linked straight from the player stay unnamed ("0:12–0:20"), so the
lesson page and the pickers are a wall of times.

Sharing a video from the phone to a lesson that does not exist yet means
leaving the share, making the lesson, and sharing again.

The Routines list does not say which routines came from a class.

And music: groups already have class songs, all available to members. What
is missing is a teacher saying *which* song to practise *what* to: a song or
several attached to a lesson, a drill or a routine, each with a short note
("slow one, good for the cross-body lead"). Not to a figure — that makes no
sense to the user.

## Non-goals

- The figure page's Links (it shares `LinksEditor`): the figure-page slot is
  reworking that page. Only the lesson page changes here.
- The position page's link buttons and its section search ("Videos and
  lessons should be linked with a simple button", "The search to link to a
  section only shows a few sections"): those are the position page's, handed
  to the positions-rework slot.
- Showing a lesson's day on every Today row: Today is slot 6's. Today shows it
  only on a lesson not yet gone over ("New · from class Tue 3 Nov"); slot 6 is
  told it should stay.
- Comments on a lesson: being built in another slot.
- Songs on figures.

## Part A — the lesson page and linking

### A1. One "+ Add" per list

On the lesson page, Figures, Routines, Exercises, Positions and Links each
have one small `+ Add` button at the right of their heading row (the look
the "+ New" button has now: `button('tertiary', 'sm')` with the plus icon).
The full-width `PickerOpener`s ("Link an existing figure…" and the others) and
the "+ New" buttons go. A reader (no edit) sees no `+ Add`, as today they see
neither.

`+ Add` on Figures, Routines, Exercises and Positions opens the list's existing
link picker unchanged: a tap links and closes, + links and stays, Done closes,
and the create row at the bottom makes a new one:

- Figures: Move, Figure (as now, the New figure sheet).
- Routines: Routine (the New routine sheet, as now; it goes on to the routine
  page).
- Exercises: Exercise (the New exercise sheet).
- Positions: **Position, new.** The New position sheet the Positions tab uses
  (`PositionForm`: name, type, hold, notes), on top of the picker. It makes
  the position in the lesson's space and links it to the lesson, in one
  transaction, through a new lesson page action (`newPosition`), the way
  `newRoutine` makes and links a routine. A refusal shows under its field, as
  the other create sheets do. In a group it is logged like the other creates.

The create rows already exist in the shared picker (`create` prop); only
Positions gains one.

Focus: what was the fallback key of a list (`figure-add` and the others) is
now that list's `+ Add`. The "+ New" `aria-label`s ("New figure") give way
to "Add a figure", "Add a routine", "Add an exercise", "Add a position", "Add
a link".

### A2. Links in a popup

Links' `+ Add` opens a sheet, "Add a link" (picked: 2B): one Link field, and
under it, as soon as what is pasted parses (`parseLink` in `src/lib/links.ts`),
a card saying what it found — a YouTube video ("You can save it at 480p after
adding"), or a web page with its host. Then Title (optional) and "Add link"
as the footer button. One link per add; pasting several lines is no longer
offered here. A success closes the sheet; a refusal keeps it open with the
message under the field and what was typed kept. It is a `use:guarded` form,
so closing with text in it asks. It posts the page's existing `addLink`
action (one URL in `urls`), so no action changes.

The link cards stay as they are (Save video, Retry, Remove).

**The popup is shared.** It is its own component (for example
`components/links/AddLinkSheet.svelte`, taking `open`, `onclose`, the action
URL and the last refusal), so the figure page (slot 1) opens the same one from
its own `+ Add`. The lesson page drops `LinksEditor`'s in-page form; the
figure and drill pages keep theirs until their own work moves them.

### A3. A section takes the name of what it is linked to

When a section or a point that has no name (`video_spots.label` null) is
linked, it takes the name of what it was linked to, stored in `label`:

- a figure version: `figureLabels` ("Enchufla · Doble"),
- a drill: its name,
- a position: its name.

Only when the label is null at that moment, so a named section keeps its name
and only the first link names it. Unlinking leaves the name. It is renamed in
the player as any section is.

It happens in the data functions that make a link from a person's action —
`linkInSpace` (`src/lib/server/spot-links.ts`) and the position link insert in
`src/lib/server/position-links.ts` — in the same transaction, so the player,
the Link popup's create-and-link, the figure page's and the drill page's
"Link a section", and the position page all get it. Never in the copy paths
(clone, Take, Move to…): those carry the label they find. In a group the
rename is part of the link's own History line (no second line).

**The ones already linked are named once (the user's answer).** A one-time
step at boot, run once and marked done in `app_flags` as `positions-move.ts`
does, gives every unnamed section or point that already has a link the same
name: of its oldest link (by the link's id), figure versions before drills
before positions when two were made together. It writes no History line (it
is no one's edit, like the boot move).

### A4. A new lesson from a shared video

The phone's Share → "Add to a lesson" page (`src/routes/[dance]/share/`) gets
a first row in the Recent lessons card (picked: 4B): a solid accent tile with
a plus, "New lesson" in the accent text colour, "Make one for this video"
under it, a chevron. It opens a sheet: Day (today by default,
no later than today, as everywhere), Title, and — only for someone who edits a
group — Where: Mine, or one of the groups they edit (a group's lesson starts
as a draft, as always). Save makes the lesson and then goes on exactly as
tapping a lesson row does: the app link with the share key and the new lesson
(`uploadLink`), so the video uploads into it.

The sheet: "New lesson", Day (a date field), Title, Where (a select field,
"Mine" first, with the helper "A group's lesson starts as a draft"), and
"Make it and add the video" as the footer button.

With no lessons yet the card holds only that row, in place of the empty state
"Make one in Lessons first, then share the video again."

It uses the new-lesson data function the Lessons tab uses (and its checks);
the form is `use:guarded`.

### A5. Routines from a class are marked

On Moves → Routines, a routine linked to a live lesson shows that lesson's day
in its meta line: "16 slots · ", then the Lessons icon (15 px) and the day
("Tue 3 Nov") in `accent-text`, bold (picked: A2); with several, the latest.
Only lessons the person sees: their own space's lessons, plus for a group's
routine the published lessons they reach. Same date form as Today's "from
class …" (`classDayLabel`). The icon and day carry an accessible name, "From
class Tue 3 Nov". Not a link: the whole row opens the routine.

### A6. Publish

A group's draft lesson (picked: 3A). The strip on the band stays where it is
but reads as one block: a tinted bar (black at 15 % on the band, rounded 18)
with "Draft" in bold over "Members don't see it yet", and a solid cream pill
button with the upload icon, "Publish" (cream fill, band-coloured text, like
the selected segment on the band). On the desktop, where the strip is a soft
warn bar under the title, the button is the accent-filled one it is now with
the same icon and words.

Publish also goes into the lesson's ⋯ menu, as its first row (upload icon,
"Publish", "Members of <group> see it" under it), once slot 3's shared ⋯ menu
is in master. Until then the band's button is the only one. It posts the same
`publish` action.

## Part B — music with notes

### What it is

A lesson, a drill (`exercises` with `source = 'custom'`) or a routine holds a
**Music** list: songs, in an order, each with an optional note (up to 500
characters, linkified like notes elsewhere). The same song once per row it is
on.

On the page:

- **Lesson page:** a "Music" list beside the others in the "what it teaches"
  column, after Links' column order is the builder's; same look, same
  `+ Add`.
- **Routine page:** between Slots and More.
- **Drill page:** between Settings and History.

The list (picked: 6C) is compact: a grouped card, one row per song with its
title, the note's first line under it (the note icon, muted, cut with an
ellipsis; no line when there is no note), and ▶ to play the sample (the
one-sample-at-a-time player the Music tab has) at the right. A tap on the row
opens a small sheet titled with the song: the whole note (linkified) and
"Practise to this" as its primary button; an editor's sheet also has Edit
note and Remove. "Practise to this" opens the player with that song:

- on a routine: `/{dance}/player?routine=<id>&song=<songId>` (plus the
  person's entry, `&exercise=`, as the routine page's Practise does);
- on a drill: the person's own entry of it, `&exercise=<id>&song=<songId>`;
- on a lesson: `/{dance}/player?song=<songId>`.

Editing (an editor of the row, or the person on their own): `+ Add` opens the
song search (`SongPicker`'s list and search, sample ▶ included); picking a
song (picked: 7A) opens a sheet titled with the song: Note (optional, "What
to practise to it", helper "Members see it under the song") and "Add to
Music"; it adds the song with that note. Edit note opens the same sheet with
"Save". Remove takes the row off at once. Order is the order added (my call;
no reordering until asked for).

### Suggestions, not the practice song

Every exercise already has one practice song, `exercises.song_id`, the song
the player opens; a group's drill never has one ("it would play to everyone"),
and each member's entry keeps its own. That does not change. The Music list
is the teacher's suggestions: "Practise to this" opens the player with the
song for that run. When the person's practice popup offers songs
(`SongPicker` in `SourcePicker`), the row's Music songs come first, under the
row's name, so the suggestion can become their practice song by picking it.

### Which songs

- A person's own lesson, drill or routine: their own songs, and a group's
  songs they can play (`songAccess` read: shared, live, while a member).
- A group's: only that group's songs. An editor sees the group's drafts in the
  search too; adding a draft shares it in the same transaction (logged as the
  song's share), so members can always play what a row points at.

Reading: a member sees a row's Music entry only while they can play the song
(`songAccess`). A song unshared or archived disappears from members' lists and
comes back when shared or restored; the row (the link) is kept all along —
it is never dropped — so no `song_drops` bookkeeping is needed. An editor sees
an unshared one marked "Not shared".

### Storage

A new table, `song_links` (the builder may name it):

- `id`, `song_id` → songs, and exactly one of `lesson_id`, `exercise_id`,
  `routine_id` (checked in the data function — **no CHECK**, see CLAUDE.md),
- `note` text nullable, `sort_order` integer, `created_at`.
- Unique per (parent, song).

Owner and dance come through the parent, like the lesson join tables. A hard
delete on Remove (bookkeeping, like a lesson's hand link; not trashed, as a
plain unlink is not). A parent archived keeps its rows.

### Groups, copies, History

- **History:** add, remove and a note change on a group's row are logged
  (`logChange`, root lesson / routine / drill, subject `song`), in their
  transaction, and added to `MUTATIONS` in `changes.spec.ts`. A note save
  carries `seen` (the clash check) for that note.
- **Copies** (Copy to…, Make it mine, Keep, the rescue, Move to…): a parent's
  Music rows go with it. A row's song in the new place is that place's member
  of the song's family if there is one; else, if the new place is a person who
  can play the song, the same song; else the row is dropped. A song link never
  copies audio on its own.
- **Leaving / Keep:** Keep already copies a group's shared songs and
  re-points the person's practice songs onto the copies (`repoint`); song
  links on the person's own rows are re-pointed the same way.
- **Compare, Take, Send:** a parent's Music is part of what is compared — one
  field per song (key `song:<ref>`, value its note), so a teacher's new song or
  changed note can be taken. Order is not compared.
- **Losing a group song for good:** when a person leaves or is removed and
  does not keep a song (Keep), or the group is purged, their own rows' Music
  links to it are deleted, in the step that clears that song from their
  exercises' `song_id` today.
- **Integrity:** `crossRefs` learns the table: a group's row points only at its
  group's songs; a person's at their own, or at a song of a group they are
  still a member of — shared or not, since an unshared song's link is kept on
  purpose.
- **Entries:** Music lives on the row itself — a lesson, a routine, or a drill
  that is not an entry (`song_links.exercise_id` never names an entry). A
  member's entry page, its "Practise to this" and its practice popup read the
  Music of the row the entry practises. A member adds no Music to their entry.
- **Only ready songs** can be added (the player refuses one that is not).

### Not now

- A song on a figure.
- A start time inside the song ("from the second chorus").
- Members adding their own songs to a group's lesson.

## Calls made while writing (not asked)

- A3 also names points and covers drills and positions, not only figures.
- A4's Where field appears only for someone who edits a group.
- A5's words "From class Tue 3 Nov", and only the latest lesson.
- B: note length 500; Remove not trashed; a draft group song added to Music
  is shared; a member's list hides what they cannot play rather than dropping
  the link; the practice popup lists the row's Music songs first; Compare
  ignores order; no song file is ever copied for a link; a lost group song's
  links are deleted with the practice songs Keep clears; Music sits on the
  drill, never on a member's entry; only ready songs.

## Where it touches other slots

- The drill page lives under `(today)` (slot 6's area): Part B adds one list
  there; keep the change to one section.
- The routine page and the Routines list are Moves; no slot owns them.
- `LinksEditor` is the figure page's too: split, not changed in place.
- `PAGE_EPOCH`: Part A removes no action; raise it only if an action's fields
  change.
