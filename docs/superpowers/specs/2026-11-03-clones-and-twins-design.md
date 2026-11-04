# Clones and twins — design

**Status:** design, 2026-11-03. Comes after the groups follow-ups
([`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md))
and builds on groups
([`2026-11-02-groups-design.md`](2026-11-02-groups-design.md)). It replaces the
"your moves across groups" step that spec named as next.

Marks: *(user)* the user decided it; *(my call)* decided while designing,
open to change; everything else follows from those or from the code.

## Why

Two needs that turned out to be one problem.

- **A teacher's material moves between places.** They have lessons, figures
  and routines in their own app and want them in a group; they teach the
  same Enchufla in several groups; a co-teacher improves it in one group and
  the others should be able to take the fix. Copies that forget where they
  came from end in five unrelated Enchuflas that drift apart.
- **The same move arrives from several places.** A dancer in three groups
  sees three Enchuflas in Moves, plus their own, and every picker offers all
  four. They are the same move but not the same material, and nobody wants
  them merged.

## The two relations *(user)*

**Clone: the same thing, in different places.** Made by copying. Clones of
one thing form a family. A family has **at most one member per place** (a
person's app, or a group): copying into a place that already holds a member
reuses that member instead of making a second. Clones can be compared and
updated from each other.

**Twin: different things you see together, marked "same move".** Made by
hand, between things that show in your app. Any number. Twins never sync
and never merge; it is only how they are shown.

Who meets what: someone with no group meets neither. A member meets twins
(to tidy Moves when several groups teach Enchufla) and clones (when they
edit a class figure into their own). A teacher uses both.

## Seeing, editing, cloning *(user)*

1. **Seeing and using.** A group's Enchufla shows in your Moves because you
   added a lesson that has it. It is the group's: read-only, marked as
   theirs. It is not a copy. **You can use it without copying it** *(user)*:
   your own routines can call it and your own sections can link to it, while
   it stays the group's. Nothing is copied until you edit it or lose access
   to it (Leaving, below). This changes the wall: a person's own row may now
   point at a group row the person reaches. `addOption`, `restoreOption`,
   `canEmbed` (routines) and `linkInSpace` (section links) accept a target
   the person reaches instead of only their own; reading such a link always
   goes through `access.ts`.
   **Lessons stay live** *(user)*: Add does not clone a lesson. While you
   are a member you read the group's lesson as it is, and an editor's fix
   shows at once.
2. **Editing makes a clone.** Edit on the group's Enchufla makes your own
   clone of it. From then on your app shows yours in its place: in Moves, in
   pickers, and in that group's lessons where they link the group's version.
   - **Where yours replaces theirs** *(my call)*: only in what is shown to
     you (Moves, pickers, a lesson page's link cards). A group routine still
     plays and reports breaks with the group's own rows; coverage, the gap
     report and Today read rows as today. This keeps the change a few view
     helpers, not a per-person mapping through the whole app.
   - **Practice** *(my call)*: your practice entry on the group's variation,
     if you had one, moves to your clone with its sets. If your clone already
     has an entry, the two merge (sets moved, one entry kept), since one
     person has at most one entry per target.
   - **Your own rows follow** *(my call)*: your routines' slots and your
     section links that used the group's version are re-pointed to your
     clone, in the same transaction.
   - **Editors** *(my call)*: inside group mode, Edit changes the group's row
     as today. Outside group mode, an editor sees the group's things like a
     member does, and Edit makes their own clone. Group mode is where you
     work on the group.
   - **Recordings** *(my call)*: a clone made in your own app does not copy
     the source's recordings (the groups spec's rule for Make my own copy);
     the source's recordings show inside your clone's page, under "From
     Salsa Tuesdays", and you can take one into yours (then charged to you).
     A clone made into a group brings its recordings, charged to the group,
     since members need them.
3. **The source stays visible** *(user agreed)*. Your clone's page has a
   switcher at the top, one tab per source ("Yours", "Salsa Tuesdays"): the
   same switcher a twin's page has, so there is one way of showing "theirs"
   beside "yours". "Yours" is yours to edit; the source's tab is its version
   as it is now, read-only, with Take on a recording. When the source changed
   since you last took from it, a line above says what: "Salsa Tuesdays
   changed it since you took it: timing, 1 recording · Compare". A twin's tab
   is the same, without Take or Compare.
4. **Copy to…** makes a clone in another place you can edit: your app, or a
   group you own or edit. A lesson copied into a group lands there as a
   **draft** *(user)*, like any new group lesson. This includes group to group *(user)*: you may put
   a class's Enchufla straight into a group you teach. Only people who can
   see both places ever see that one came from the other.
   *(Built, Task 29:)* `clones/copy-to.ts`. The targets are your app (unless
   the row is yours) and every live group of the dance you own or edit, never
   the row's own place. Into a group the copy brings recordings; a song lands
   as a draft too. A reader's copy into their own app is Make it mine itself
   (their routines and practice follow it); an editor's is a plain copy, with
   no recordings. Twins are asked about only for a group target, one question
   per family in what goes, and a twin already in that group is no choice. A
   "Last changed" day is the newest of the row's creation, its History lines,
   its pair snapshots and its recordings or videos: a person's own edits are
   not stamped. "Has your copy" needs a copy (`cloned_from`) the person added;
   otherwise "has it already". The trigger sits under the source tabs, beside
   Detach and Drop my copy.
5. **Sending to a group sends exactly one version** *(user)*. If what you
   picked has twins, the app asks which one ("Yours · Salsa Tuesdays' ·
   Rueda club's"); with no twins it asks nothing. The group gets a clone in
   that version's family. Twins never travel.
6. **Detach** a clone and it leaves its family *(user)*: it stops syncing
   (no "updated since", no "Take theirs" to hit by mistake). In your own app
   it becomes your twin of what it was cloned from, so it keeps being shown
   together. In a group, where there are no twins, it just becomes an
   ordinary group row *(my call)*.
7. **Drop my copy** *(user)* removes your clone and puts you back on a
   version you can still read. Your example: you start editing a class
   lesson (which makes your clone), change your mind, Drop my copy, and you
   are on the class's read-only lesson again.
   - **Which version** *(user)*: with one other version you can read, the
     sheet just names it ("Your routines and practice will use Salsa
     Tuesdays' Enchufla"). With several, you pick; the one you cloned from is
     preselected while you can still read it. Never random, never "most
     recent": two groups' Enchuflas can differ for real.
   - **What moves**: everything of yours that pointed at your clone (your
     routines' slots, your section links, your practice entries with their
     sets, your lesson adds) is re-pointed to the chosen version in the same
     transaction, found through the gene id. Nothing is left pointing at a
     dropped copy.
   - **Practice may not be able to follow** *(my call)*: practice on a
     group's variation needs a lesson you added that holds it (R8 of the
     groups build). If the chosen version is in no lesson you added, the
     sheet says so and offers to Add that lesson; otherwise your practice
     stays with your archived copy, history intact.
   - **What would be lost**: the sheet lists what exists only in yours
     ("Your notes and 1 recording aren't in Salsa Tuesdays' version") and,
     if you edit that group, offers Send mine first.
   - Your copy is **archived**, not deleted (the archive rule).
   - **Not offered** when no other version is readable (say you left the
     group): Archive is the only way out, as for anything of yours.
   - *(Built, Task 27:)* `clones/drop.ts`. The versions offered are the
     family's live group members you read, in a group that is not deleted;
     the one you copied from first, then by group name. Practice follows a
     group's figure, routine or drill only when an added lesson's reach holds
     it; otherwise the choice offers that group's newest published lesson
     holding it ("Add Week 2 too", ticked), which Drop adds in its
     transaction. A group lesson is always added by the drop, so a published
     one always takes the practice; a song takes your picks while you may
     practise to it. An entry merged into your practice on the version is
     archived one instant before the copy, so restoring the copy never brings
     a second practice. A song copy is archived with the song page's Archive:
     a person's song has no restore, so Edit on the class's song afterwards
     is refused with what to do. The trigger sits under the tabs (the item
     pages have no ⋯), and the toast shows on the version's page.
8. **Move to…** a group *(user)* is Copy to… plus Drop my copy in one step:
   the lesson lives in the group and you use it there as its editor. Its
   figures, routines and drills are listed in the Move sheet, each with
   "Use the group's from now on" (your copy dropped, your other lessons and
   routines re-pointed) or "Keep mine as well". Default *(my call, the user
   agreed)*: "Keep mine" for anything your other lessons or routines use,
   "Use the group's" for anything only this lesson used.
9. **Copying into a place that already has a member** *(my call)* leaves
   that member as it is and opens the comparison, so you choose what to
   take. An archived member still holds its place: the copy offers to
   restore it rather than make a second. A restore (Recently deleted, or
   un-archiving) into a place that has meanwhile got another member of the
   family is refused with the reason, as a name clash on restore is today.

## Comparing and updating clones *(user)*

From any clone you open, you see the other members of its family **that you
can access**, with what differs. You can:

- **Take theirs** into the one you are looking at, if you can edit it.
- **Send mine** to any member you can edit (your app, groups you own or
  edit). The update lists every such member with what differs in each, and
  you tick which.

So a teacher's own Enchufla can act as the hub: take a co-teacher's fix from
one group, send it to the other two. A co-teacher who edits a group's copy
just makes it drift until someone compares.

Rules:

- **Field by field, in place.** An update changes the target's existing rows
  (name, timing, positions, notes, and so on); it never replaces a row with a
  new one, so members' practice entries, logs and section links that point
  at it survive.
- **Every piece has a family, not only the top.** A lesson links variations,
  not figures, and a variation holds recordings, which hold sections. Each
  copied piece (variation, recording, section, lesson video, routine, drill,
  song, lesson) carries its own family, so an update can match the target's
  piece even after a rename or a Move to….
- **Adds and changes travel; deletes only if ticked.** A delete is refused,
  as today, while the target still links it (a linked section and its video
  cannot be deleted).
- **Both changed → you pick.** When two members are compared, the app needs
  to know what they looked like the last time those two were in step. Every
  copy, Take and Send records that, per pair of members, as a snapshot of the
  fields (a hash per field) *(my call)*. Against it: a field only one side
  changed is newer on that side; a field both changed shows both and you
  pick, like the clash sheet. Two members that were never in step with each
  other directly (no snapshot for the pair) show every difference as a pick.
  Snapshots are written only by copy, Take and Send, never by ordinary saves,
  so no existing save path changes.
- **Name is a field like the others** *(my call)*: it can be taken, but a
  name that would clash with a sibling in the receiving figure is refused
  with the reason (variation names are unique within their figure). A copy
  renamed on arrival ("Doble (Salsa nadaljevalna)") simply shows its name as
  a difference.
- **A routine's slots are one field** *(my call)*: slots have no identity of
  their own (the slot operations delete and re-insert rows), and nothing
  outside the routine points at them, so Take on a routine replaces its whole
  slot list, each slot mapped to the receiving place's family members.
- **Take and Send into a group are group mutations**: they carry `seen` for
  the clash check, log in History with the actor, and run `reconcileEntries`
  when a ticked delete shrinks what members reach.
- **Never asked on save** *(my call)*: a quiet line on the page when members
  differ. Ignoring it is letting them drift.
- **Local to each place, never synced:** which figure a variation is filed
  under, archived or not, and every person's practice settings and logs.
- **What you can't see stays invisible.** Another teacher's private clone is
  in the family, but you never learn it exists. You can take from a member
  you can only read; you can send only to members you can edit.

*(Built, Task 25:)* Compare and Take theirs (`clones/compare.ts`, the write in
`clones/apply.ts`, shared with Send). A name or title never travels by
default, in either direction: it is the receiver's until ticked. A reference
taken in (a lesson's hand link, a section's link, a slot's option or
embedded routine) becomes the receiving place's member of its family, copied
there when missing, without recordings (they stay in the pair's skip, for
Take). A take into a group logs one `change` (deletes keep their own
`remove` lines, with Recently deleted); a person's deleted piece's file goes
once the take has landed. The banner shows on a row you edit whose group
source (the row it was copied from) is `newer` or `differs`.

*(Built, Task 26:)* Copies you can see and Send mine (`clones/send.ts`). The
list shows on a member page when you edit some other live member of its
family: this one first, then the rest (Yours, then groups by name), each with
your role there and its tab's status as a chip. Send mine… is offered from a
row you edit, and only to members you edit; a member you only read is never
a target. Each target is `syncFrom` with the roles swapped (the target
receives), in its own transaction, so one refusal leaves the others landed.
A target is ticked when something would land; your deletes are boxes of
their own, unticked, ticking one deletes it in each chosen target that still
has it. A field both changed is asked on a second level, a target at a time.
A pick names a piece by its gene, or `#<id>` before it has one; a copy into
an earlier target stamps it, so the write reads `#<id>` as the row's gene
now, and the pick lands rather than being dropped. Other copies that moved
since they were in step with the page get a "… copy differs" banner with
Compare (not the group source, which has Take's own banner).

## Leaving, and losing access *(user)*

This replaces the groups spec's rule that a former member keeps reading the
lessons they added (`reach` through `lesson_adds` after leaving): after
leaving you read nothing of the group; you have your own copies instead. A
cleaner wall. CLAUDE.md's wall rule and `access.ts` change with it.

- **Leaving asks what to keep**: Keep everything, choose item by item, or
  keep only what your own routines use ("Keep only what my routines use"
  *(user)*: never "Keep nothing", since those are kept regardless). What you keep becomes clones in your app: lessons with
  their videos and sections, figures, routines, drills, songs. The files are
  hard-linked under new names (no extra disk) and charged to you; keeping
  may take you over your limit, which is allowed, and uploads are refused
  until you are under it again *(my call)*.
- **Your own rows follow**: your routines and section links that used the
  group's things now point at your new clones; your practice entries move
  to them with their sets.
- **Rejoining reconnects**: your clones keep the gene id, so after rejoining
  they show "From Salsa Tuesdays" again, with what changed while you were
  away, and the group's lessons show yours in their place.
- **Removed by the owner** *(my call)*: as Keep everything, with no
  question; you can delete what you don't want afterwards.
- **The group is deleted** *(my call)*: nothing changes for members during
  the 30 days it can be restored; when the delete becomes final
  (`purgeTeams`), every member, and every former member who still has an
  added lesson, gets Keep everything, before the group's files are
  deleted. The person who deleted the group keeps only what their own rows
  use, so nothing of theirs dangles. A file already missing on disk is
  skipped (logged): its recording or video stays behind, and a class song
  without its audio is not kept (its picks drop to the count). If a
  member's Keep fails, the group's purge waits for the next hourly run,
  files and all.
- **An editor unpublishes or deletes something your own rows use**
  *(my call)*: just that thing is cloned into your app, so your routine or
  link does not break. Things you only read (not used by your own rows)
  simply leave your view, as today.

## Twins *(user)*

- **Same as…** on something in your app marks it a twin of another thing in
  your app: your own Enchufla and Salsa Tuesdays', or Salsa Tuesdays' and
  Rueda club's. Any number can be twins.
- Twins show as **one**: one row in Moves and in every picker, one page with
  a tab per source ("Yours", "Salsa Tuesdays", "Rueda club"), the same
  switcher as a clone's page, counted
  once where the app counts moves.
- Twins are **personal** *(my call; the user agreed)*: your grouping is
  yours; other members don't see it.
- **Per variation** *(user)* (a figure, in the new names below), not per
  move: your Enchufla · Doble can be the twin of Tuesdays' Enchufla ·
  Basic. In Moves *(my call)*, a group's move whose figures are all twinned
  with yours folds into your move's row ("also in Salsa Tuesdays");
  otherwise it stays under the group's heading. Pickers list figures, so
  twins are one row there.
- **Groups have no twins** *(my call)*. A group that ends up with two
  Enchuflas is for its editors to tidy.
- **Not twin-able across kinds.** A variation twins with variations, a
  routine with routines, a lesson with lessons (your notes from a class
  beside the group's lesson), a song with songs.
- **Merge** (take one twin, move your links and notes onto it, archive the
  other) is the one-way trip the other way. Not in this design.

## What it covers

Variations, routines, drills, songs and lessons, plus the pieces inside them
(recordings, sections, lesson videos).

- **A routine** cloned into a place points its slots at that place's member
  of each variation's family; a variation the place lacks is cloned with it.
  "Routines using this figure" stays derived from what is visible, so a
  group's Enchufla shows a routine once that routine is cloned into the
  group, with no hidden link waiting to appear.
- **A lesson** cloned into a place brings its links' targets the same way,
  and its videos and sections (files hard-linked under new names, as
  Make my own copy did, and charged to the place that receives them).
- **Make my own copy** (built with groups) becomes "clone this lesson into
  my app", and its name matching (R22: trim and lowercase) is replaced by
  family matching. This changes built behaviour: copying the same lesson
  twice now reuses the first copy instead of making two. Copies made before
  this ships start as families of one and never show "From …"; that is
  accepted.
  *(Built, Task 23:)* it is Edit's "Make it mine" (`clones/edit.ts`): the
  menu item and the `copy` actions are gone, and the person's practice moves
  onto the copy (the live practice wins); what a copy brings that they did
  not practise starts paused.
- **Your own lesson into a group** (the user's original ask) is Copy to… on
  a lesson.

## Data *(my call)*

- **Links stay concrete** *(user agreed)*. Each row keeps its own id (the
  id of that one clone), and every link (routine slots, section links,
  lesson links, practice entries, lesson adds) points at a row id, never at
  a gene. A gene can have two members in one person's view (theirs and
  yours), so a link to the gene could not say which; practice history needs
  one fixed target; History and Recently deleted restore rows by id. The
  gene id only matches: on copy, Drop my copy, Move, leaving and rejoining
  it finds the right member, and links are re-pointed on purpose, in the
  same transaction.
- A **gene id** (the family's id) and a **cloned-from** id on every cloneable table
  (figures, routines, songs, lessons, recordings, lesson videos, video
  spots; on `exercises` for drills only, never on entries, whose own
  uniqueness index would collide). Cloned-from is what "From Salsa
  Tuesdays" and Detach read. Every existing row starts as a family of one.
  Additive columns only: never a CHECK, never a rebuild (the hard rule).
- **At most one member per place**: for root tables (figures, routines,
  drills, songs, lessons) a unique index per owner column on (family,
  owner); for the pieces without an owner column (recordings, lesson
  videos, sections) the place is the parent row, and the rule lives in the
  data function. Group trash restore, which re-inserts old ids, checks it
  too.
- **Pair snapshots**: per pair of family members, a hash per field of what
  both held when last in step. Written by copy, Take and Send only.
- **A twins table**, per person: which items they marked as one.

## Known risk

Knowing who changed what across many clones is the subtle part. Pair
snapshots answer it for any two members that were ever in step directly, and
fall back to "pick" for the rest. The plan must test three members of one
family, edits on two of them, and Take and Send in every order, including a
member taking from one sibling and sending to another.

## Order

After the groups follow-ups: song families need group songs (`songs.team_id`)
to exist.

## Names *(user)*

A lesson links variations, not figures, so the words change before the
clone and twin screens are drawn: what the app calls a **variation** becomes
a **figure** ("Enchufla · Doble" is a figure), and what it calls a figure
(a name holding variations) becomes a **move** *(my call for the word;
"figure group" was avoided because "group" already means a class)*. The
Moves tab keeps its two sub-tabs, **Figures | Routines** *(user)*: Figures
lists figures under each move's name as a heading (as the pickers already
do), and tapping the name opens the move's page. The code already works this way (`figures` is a
variation, `figure_groups` the named set), so only screen words, specs and
CLAUDE.md change. It ships first, on its own.

## Not in this design

- Schools or clubs: a shared library above groups (one Enchufla for all a
  school's classes). The user set it aside for later.
- Merge.
- A lesson naming a song.
