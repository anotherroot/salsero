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

1. **Seeing.** A group's Enchufla shows in your Moves because you added a
   lesson that has it. It is the group's: read-only, marked as theirs. It is
   not a copy.
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
3. **The source stays visible.** Your clone's page shows where it came from
   ("From Salsa Tuesdays") and, when the source changed since you last took
   from it, what changed: "Updated since: timing, 1 recording · Compare".
4. **Copy to…** makes a clone in another place you can edit: your app, or a
   group you own or edit. This includes group to group *(user)*: you may put
   a class's Enchufla straight into a group you teach. Only people who can
   see both places ever see that one came from the other.
5. **Sending to a group sends exactly one version** *(user)*. If what you
   picked has twins, the app asks which one ("Yours · Salsa Tuesdays' ·
   Rueda club's"); with no twins it asks nothing. The group gets a clone in
   that version's family. Twins never travel.
6. **Detach** a clone and it leaves its family *(user)*: it stops syncing
   (no "updated since", no "Take theirs" to hit by mistake). In your own app
   it becomes your twin of what it was cloned from, so it keeps being shown
   together. In a group, where there are no twins, it just becomes an
   ordinary group row *(my call)*.
7. **Copying into a place that already has a member** *(my call)* leaves
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

## Twins *(user)*

- **Same as…** on something in your app marks it a twin of another thing in
  your app: your own Enchufla and Salsa Tuesdays', or Salsa Tuesdays' and
  Rueda club's. Any number can be twins.
- Twins show as **one**: one row in Moves and in every picker, one page with
  a section per source ("Yours", "Salsa Tuesdays", "Rueda club"), counted
  once where the app counts moves.
- Twins are **personal** *(my call; the user agreed)*: your grouping is
  yours; other members don't see it.
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
  `copy-lesson.ts` does, and charged to the place that receives them).
- **Make my own copy** (built with groups) becomes "clone this lesson into
  my app", and its name matching (R22: trim and lowercase) is replaced by
  family matching. This changes built behaviour: copying the same lesson
  twice now reuses the first copy instead of making two. Copies made before
  this ships start as families of one and never show "From …"; that is
  accepted.
- **Your own lesson into a group** (the user's original ask) is Copy to… on
  a lesson.

## Data *(my call)*

- A **family id** and a **cloned-from** id on every cloneable table
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

## Open, for the user

- **Names.** A lesson links variations, not figures, and the user is
  considering calling variations "figures" and today's figures something
  else (a figure's name and its list of variations). The code already works
  that way: its `figures` table is a variation and `figure_groups` is what
  the app calls a figure. Only screen words would change. Decide before the
  clone and twin screens are drawn, since they name these things everywhere.

## Not in this design

- Schools or clubs: a shared library above groups (one Enchufla for all a
  school's classes). The user set it aside for later.
- Merge.
- A lesson naming a song.
