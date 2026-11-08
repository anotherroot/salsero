# Keeping copies in step

Copies of one thing (a family: your copy, a club's copy, another club's)
stay the same by themselves, and when they cannot, one Sync puts them all
back in step. Brainstormed with the user on 2026-11-07, from their note of
2026-11-06 ("Rework how clones update"). Amends
[clones and twins](2026-11-03-clones-and-twins-design.md) ("Comparing and
updating clones", "Names never travel by default"),
[the merge sheets](2026-11-06-merge-sheets-and-update-bubbles-design.md)
(Compare and Take, Send mine, the name rule) and
[versions and the ⋯ menu](2026-11-06-versions-and-menu-design.md) (the row's
meta, the Versions list, the menu's copy items).

Marks: *(user)* the user said it; *(my call)* decided while writing this, for
the user to check; *(builder)* left to whoever builds it.

## Why *(user)*

On 2026-11-07 the user had their own copy of a figure and a club's copy they
edit. Both had changed. They opened Compare, picked theirs on every field
(Keep mine), and that felt like a git merge: they had just decided what the
shared version is. Then nothing offered to send that decision to the club's
copy, and the two still disagreed. Before that, when the club's copy was
only behind theirs, nothing on the page said so at all.

What the code does today (read 2026-11-07, master 8ed0848):

- A pair of copies keeps a snapshot of what both held when last in step,
  written only by a copy, Take, Send or Keep mine (`clones/pairs.ts`). Each
  page load compares the two against it (`$lib/clones/diff.ts`, `standing`):
  `same`, `behind` (only this one changed), `newer` (only the other), or
  `differs`.
- "X changed it since you took it · Compare" shows only when the page's row
  was copied *from* that club's row (`cloned_from`) and that row is `newer` or
  `differs` (`sourcesView` in `clones/sources.ts`).
- "X's copy differs · Compare" shows only for other copies the person *edits*
  that changed (`familyView` in `clones/send.ts`).
- So a copy that is merely **behind** yours shows nothing but a grey "Behind"
  chip inside the Versions list, and Send hides in the ⋯ menu. A copy whose
  `cloned_from` points the other way (you made it, Copy to… the club) never
  gets the first banner.
- Two members never in step directly (both copied from a third) have no
  snapshot: every difference reads as "both changed".
- Nothing syncs by itself, nothing acts on the whole family, and two people
  editing two copies at once are not checked against each other (the clash
  check covers one group row only).

## Goals

- **Say it whenever copies disagree**, whichever side is behind, on the
  copy's page and on the Moves list *(user)*.
- **One Sync** that merges and pushes: pick once, the result lands on every
  copy you edit *(user)*.
- **Keep in step**: a switch per copy that carries changes across by itself,
  on by default, with options for what it carries *(user)*.
- **Never lose work silently**: a field both sides changed waits for a
  person; big removals and big additions wait unless switched on.
- **Same names are fine**: a copy keeps the real name; where two share one,
  the screen adds where each came from *(user)*.

## Non-goals

- Twins stay views and never sync (unchanged).
- Detach, Drop my copy, Copy to…, Move to… and Take a recording keep their
  meaning.
- Nothing about who may edit what changes: every write still goes through
  `access.ts` and the person's own rights.

## Anti-goals

- A section, point, recording or video removed from a person's own copy
  without them having switched that on. A person's own deletes of those are
  permanent (only a group's go to Recently deleted). Small removals (a link,
  a tag) do flow by default: the user agreed to that split.
- A save quietly undoing a change that synced in while the form was open.
- A flood: one save must not loop changes around the family.
- Anything you cannot see learning about you: another person's own copy is
  never shown, and still is not.

## How it flows *(user)*

The club's copy is the meeting point. A person never sees another person's
own copy, so two people's own copies never sync directly; every change
travels through a group's copy they both read:

```
  your copy  ⇄  club's copy  ⇄  their copy
     (your switch)    (their switch)
```

A copy's switch says what may flow **into** it, and whether its own changes
flow **out**. A change flows from copy X into copy Y by itself when:

- X's switch is on (its own changes go out), and Y's switch is on, and Y's
  options allow that kind of change (below);
- **this save** changed that field on X (its value before the save against
  after it), and Y has not changed it since X and Y were last in step
  (three-way, against the pair's snapshot, as Compare reads it today).
  Only what the save itself changed travels *(user, 2026-11-07, option A)*:
  an older difference between the two (a field X changed last week, a Keep
  mine) never rides along with an unrelated save; it stays in the notice
  until someone syncs it. A hop onward from Y carries exactly what landed on
  Y;
- and the write is allowed: into a **group's** copy only when the person
  whose save started it edits that group's copy; into a **person's own**
  copy only when that person still reads X (as if they had pulled it
  themselves). A member who only reads the club's copy therefore only ever
  pulls *(user)*.

A field both changed since the snapshot does not flow. It stays as it is on
both sides, and the Sync notice shows on both *(user)*.

Changes travel hop by hop right after the save that started them, each hop
in its own transaction (as each target of Send is now; a recording's file
is linked before its write, which a save's own synchronous transaction
cannot do): your save reaches the club's copy, the club's copy then reaches
every other copy whose switch is on. *(Changed while planning: first
written as "in the save's transaction".)* What "this save changed" is comes
from a **mark** per copy: the hash per field of what it held after its last
save or flow (`clone_marks`), so the hook needs only the row, not its
before-values. Marks are written for every copy in a family once at boot,
by every copy made, and after every flow and Sync; a copy with no mark
gets one and flows nothing. Each copy is written at most once per save
*(my call: a visited set, so nothing loops)*. Every hop writes that pair's
snapshot for the fields it carried, and only those, so a field still
disputed keeps reading as disputed.

A hop that is refused (a removal meeting a linked section, no room for a
recording, a name typed by hand that is taken) is skipped alone: the save
and every other hop land, that copy keeps its value, and the difference
shows in its notice *(my call)*. A recording flowing into a person's own
copy is charged to them, as any clone's file is *(my call)*.

Who it is in History: a write into a group's copy is logged as the person
whose save started it, with a normal `change` line *(user: "as if that
person manually updated it")*. Writes into a person's own copy log nothing,
as their own saves do not.

### What the switch carries *(user)*

Each copy has its own **Keep in step**, in its Versions list, with four
options under it:

| Option | Default | Covers |
|---|---|---|
| Names | on | name, title |
| Small removals | on | a link, a Starts in / Ends in, a lesson's hand link, a suggested song, a section's links |
| Sections and points | off | adding or removing a section or a point on a video |
| Recordings and videos | off | adding or removing a recording or a lesson video (files) |

Every other field (notes, timing, partner, style, slots, a position's hold,
practice settings of a drill, a song's count and sample, a lesson's day…)
and every **addition** of a small thing (a link, a position, a hand link, a
song) always flows while the switch is on *(my call: additions lose
nothing, so they need no option)*. Anything an option keeps from flowing
shows in the Sync notice instead.

Switched on, "Recordings and videos" warns once in its line that a removal
in your own copy is permanent *(my call)*. Adding a recording or video to a
group's copy is charged to the group's storage and refused when it has no
room; a refused piece shows in the notice *(my call)*.

Defaults *(user: on by default)*:

- Every new copy (Copy to…, Make it mine, the rescue, Keep, Move to…) starts
  with the switch on and the defaults above.
- Existing copies start on too. Nothing flows backwards in time: a switch
  carries changes from the next save on. What already differs shows in the
  notice and on the Moves list until someone syncs it *(my call: no boot step
  that writes old differences across, too risky on the live data)*.
- A group's copy has one switch, shared by the group's editors *(my call)*.
  A plain member sees it, cannot change it.
- Leaving a group stops every flow with that group's copies (the person no
  longer reads them). The copy they keep stays as it is.

## Same names *(user)*

Two figures of one move, or two positions in one place, may share
a name when at least one of them is a copy from another place. Where two rows
of one list share a name, each copy is drawn with where it came from:
**Doble · Salsa Tuesdays**. That part is drawn, never stored. A name typed by
hand (New figure, a rename) is still refused when it is taken *(my call: the
rule protects a person from two of their own; copies are what the user
wanted freed)*.

So the engine stops renaming on arrival ("Doble (Salsa Tuesdays)",
`freeName` and `freePositionName` in `clones/clone.ts`), and a synced name
lands as it is. A name that differs from its source's only by a copy's
" (place)" suffix (`isCopySuffix`, kept) counts as **no difference** to the
flow, the notice and the Moves mark, so an old suffixed copy never pushes
its suffix back. In Sync it shows as a row of its own that starts on the
plain name, so syncing once drops the suffix *(my call: no rename at
boot)*.

Moves stay as they are *(my call)*: a move is not a copyable thing, a copy
still joins the same-named move of its place (`moveFor`), and a move's
rename does not travel. Freed are figures (in one move) and positions.

Where "from" comes from: the place of the row's `cloned_from` when the person
reads it, else the place the row lives in *(builder: pick the clearer one for
the two-copies-of-one-place case)*. The voice in the player still says only
the name.

## Sync *(user)*

One sheet replaces Compare, Take and Send mine. Take a recording stays.

- Opened from the notice or from the ⋯ menu, from any copy. The copy it is
  opened from is "yours" in the sheet: the left column, and the one Keep
  mine keeps. To push from another copy after a mistake, open that
  copy and sync from there *(user: "still possible to push from another
  one")*.
- It lists every difference between this copy and the other copies the
  person reads, field by field, merged like a git merge (the merge sheets'
  rules, kept). Each copy is read against a copy it has a snapshot with:
  directly when it has one with the page's row, else through the copy that
  links them (usually the person's own, the one they copied from) *(my
  call: a teacher who copied one figure into two clubs then sees only real
  changes, not a wall of picks)*; a copy with no path at all shows its
  differences as picks. A pick names a copy, not only mine or theirs
  *(builder: the `Picks` type grows)*.
  - a field only one copy changed starts on that copy's value;
  - a field two copies changed is open until picked, and the Sync button
    waits;
  - a removal starts as *not* removing ("remove here too?"), additions of
    sections, points, recordings and videos as boxes ("add here too?"),
    each ticked as the copy's options say *(my call: the options set the
    boxes' defaults here too)*.
- At the bottom: **Sync to** — every copy the person edits, ticked, the
  current one first. Copies they only read are not listed: from those they
  can only pull into their own *(user)*. A member who reads only sees the
  sheet as **Update mine**: what changed in the club's copy, and one button.
- One button: **Sync** (or **Update mine**). Afterwards every ticked copy
  holds the same values for every field shown, and every pair among them
  gets a fresh snapshot, so later changes flow by themselves.
- Each target lands in its own transaction, as Send does now: one refusal
  (a name clash typed by hand, no room) leaves the others landed and says
  which one did not.
- Picking yours everywhere is the merge the user made on 2026-11-07, and
  Sync then sends it: every ticked copy takes your values and every pair
  among them is in step *(user: "the decision to choose felt like a git
  merge… that decision is the oldest joint decision")*. To merge without
  sending, untick the other copies. *(Changed while planning: the old Keep
  mine only wrote the snapshots; in a sheet that always pushes to what is
  ticked, a separate Keep mine is not needed.)*

## The notice *(user)*

On a copy's page, one notice for every case where the person's copies
disagree, whichever side is behind:

- "Salsa Tuesdays' copy is behind yours · Sync"
- "Salsa Tuesdays changed notes, timing · Sync" (a copy they only read:
  "· Update")
- "You and Salsa Tuesdays both changed notes · Sync"
- "Salsa Tuesdays removed a recording · Sync" (an option kept it from
  flowing)

With Keep in step on, the notice mostly shows only for a field both changed
and for what an option holds back. The version row's meta takes the same
words (it already shows the first banner).

On the Moves list *(user: "something on the moves page")*: a mark for the
rows whose copies disagree, and a way to reach them. **The look is picked
from mockups** (below).

## Two people at once *(user)*

- Two people saving two copies: SQLite takes one save at a time. The first
  save's changes reach the club's copy and, through its switch, the second
  person's copy (fields they did not change only). The second save is then
  checked:
- **Every save on a row in a family carries `seen`**, own copies included,
  not only a group's (`clash.ts`, as group saves do today). A field that
  changed underneath since the form opened is a clash, and the clash sheet
  asks, as it does for a group row. That is what stops a form from writing
  back an old value that synced in while it was open. *(my call: reuse the
  clash check rather than inventing a second one; a form gains a field, so
  PAGE_EPOCH goes up.)*
- A field both changed between snapshots does not flow; both sides see the
  notice; whoever syncs first decides, and that flows on to every copy whose
  switch is on.

## What stays

- Detach, Drop my copy, Copy to…, Move to…, Take a recording, twins.
- Group writes stay group mutations: `seen`, `logChange` with the actor,
  `reconcileEntries` when a removal shrinks reach, `autoAddPending` when a
  synced lesson gains a drill or routine (`GROWTH`), all in the transaction
  the sync runs in. `crossRefs` and `familyIntegrity` stay empty.
- A synced reference (a lesson's hand link, a section's link, a slot) becomes
  the receiving place's member of its family, copied there when missing, as
  `syncFrom` maps it now.
- Ordinary saves still write no snapshot themselves; the flow that follows
  a save does, for the pair and fields it carried.

## Data *(my call)*

- A switch per copy: a new small table (`clone_sync`: kind, row id, on,
  and the four options), a missing row meaning the defaults. Additive only,
  no CHECK on an existing table.
- Snapshots stay per pair (`clone_pairs`); the flow updates only the keys it
  carried (a partial `nextBase`).
- Nothing new about "out of sync" is stored: it is computed from snapshots
  and rows, as the status is today. The Moves list asks only for rows with
  more than one visible member *(builder: keep that list's load cheap)*.

## The look *(user, 2026-11-07)*

Picked from mockups beside real screenshots of the 6 Nov backup
(https://claude.ai/artifact/TWB4xPndeGFrxvov2Boxh3, private):

1. **Moves list: a card at the top** (1A), under Coverage and drawn like
   it: "3 figures out of sync", "Your copies and the clubs' don't agree";
   tapping it filters the list to them. Each such row's meta ends in "2
   copies differ" (warn tone).
2. **The page: one notice, one Sync** (2A): a warn-soft card under the
   version row, "Your copies don't agree" with a Sync button, and a line
   per copy that is off ("Intenziuci poletje 2026 changed timing", "Sreda
   17:30 is behind yours: notes, 1 recording"). The version row's meta goes
   back to "Also: …". Replaces both of today's banners.
3. **Sync sheet: a row per difference, then Sync to** (3A): the merge
   sheet's tiles, one tile per distinct value, naming the copies that hold
   it ("Yours · Sreda 17:30"); a label per field saying who changed it;
   add/remove boxes for pieces; "Sync to" with a box per copy the person
   edits; the button "Sync N copies". A reader's version is "Update from
   <club>": what changed, "Your own change to … stays", **Update mine**.
4. **Keep in step: one quiet line under the Versions list** (4A + 4b A).
   Versions is for switching (the user's comment), so the list stays on
   top and under it is one muted row: the sync icon, "Keeps in step ·
   names, small removals" (or "Not kept in step"), a chevron. Tapping it
   opens a level of its own in the sheet, Back returning to the list: the
   switch, "Your edits go to the clubs, theirs come here", and the four
   options indented beneath (4A's look).
5. **Same names: quiet text after the name** (5A): "Basic · Sreda 17:30",
   the suffix in the muted tone.

## Left to the builder

- The exact words, after the mockups are picked.
- Where the flow hooks in: each save path of the copyable kinds calls one
  `flowFrom(tx, kind, id, actor)` at the end of its transaction, built on
  `syncFrom` (`clones/apply.ts`) with a field filter.
- Tests: three copies and two people in every order (as `story.spec.ts`), a
  form open across a flow (the clash), a loop-free flow over two groups, and
  every option off and on.

## Decided while building *(built)*

What the builder decided, and what the code does that the text above does
not say. Each line: what, and why.

### In the merge and Sync

- **The agreed value is read per pair.** A copy's change is judged against
  every pair snapshot it has, not against "the most recent pair's base". The
  literal rule preselected a behind copy's stale value and undid a newer
  change. Two copies never in step that differ are open.
- **An unticked add or remove box lands nothing.** Nothing is removed
  without asking: "no pick" on an add row is not "delete the page's piece".
- **The boxes' defaults come from the page's options**, even when its
  switch is off. Sync is manual; the options are the person's preference
  for big pieces (sections, recordings, videos).
- **A key present on some copies and absent on others, with two or more
  different values elsewhere, is no box.** A section one copy renamed and
  another never got is left alone, not offered as an add.
- **Sync results flow on.** After the landings, the flow runs onward from
  each landed copy with the keys that landed, so copies the person cannot
  see whose switch is on (a member's own copy of the club's) also get them.
- **Every member's `seen` is checked**, the read-only ones too: the sheet
  posts a digest per member, and any difference in a copy that is not ticked
  refuses the Sync as stale. A pick naming a value the row does not have is
  stale too, not a "pick" refusal.
- **Access is asked again right before each copy lands**, since landings
  await one another.
- **A group copy the person only reads is never a target.** What a person
  who edits only their own copy gets is "Update from <club>"; their own
  deliberate change stays. A person's pick against a group copy they only
  read marks that copy's change as behind for its editors: a resolved
  conflict is recorded for the copy decided on, or it would be asked again
  for ever.
- **The notice keeps one "Sync" button** in every case (mockup 2A); only
  the sheet says "Update from …" for a reader.
- **A Sync with a name that differs only by a copy suffix** ("Basic (Sreda
  17:30)" against "Basic") sees no difference; the sheet offers the plain
  name.

### In the flow

- **Marks, not snapshots, say what a save changed.** `clone_marks` holds a
  hash per field of what a copy held after its last save or flow. A save
  with no mark flows nothing and is marked; the first save after deploy
  therefore flows only what that save changed, and an older difference
  stays in the notice.
- **A save marks first, in its own small transaction**, so the next save
  sees only its own change even when this flow is refused or throws.
- **The flow runs after the save has committed and never reaches the
  response.** A flow that throws is logged; the save answers as it would
  have. What landed or was refused is not sent anywhere, since ids would be
  other people's copies.
- **A reader's save never reaches the club.** A member who only reads the
  club's copy only ever pulls, on the fields they did not change.
- **A person's own copy is written as that person** when they still read
  the saver's copy; a group's copy when the saver edits it, filed in
  History under the saver. A group hop that carries a person's change the
  saver cannot read is allowed by the rule and leaks nothing.
- **A hop that links files passes `seen`**, so a save made while files are
  being linked is refused rather than overwritten. For the same reason an
  open form across a flow is refused as a clash, never writes the old value
  back.
- **A saved YouTube video that becomes a recording keeps its link.** Where
  recordings and videos are off the recording does not flow, so the link's
  removal is held back for that copy too, or the club would lose the link.
- **Play posts only a change.** Practice settings flow as content (a
  drill's mode and BPM); the page posts them only when they differ from what
  it loaded, so a Play never writes a stale config over a flowed-in one.
  A teacher's casual change of a drill's Play settings does reach the clubs'
  copies they edit.
- **Keep in step is a page action** of each item page (and a small POST for
  the Versions level), not a flat API; the kind is validated, and only
  someone who edits the copy changes it. A setting, not logged in History.
- **Not hooked, flows on the next save:** History's restore, a saved-video
  job with no requester, deleting a person's own song. Rare, and the notice
  still shows the difference.
- **An own song tapped twice** gets a clash (`seen` is required on songs
  with copies), as group songs already do.

### In the notice and the lists

- **The notice is derived from the same merge rows Sync shows**, so it is
  there exactly when Sync has rows.
- **One copy can give several lines**, one per state (both changed, changed,
  held, behind), most urgent first; the notice must not hide a difference
  Sync will act on. A "held" line is the copy's own change that the page's
  options hold back, per way it went (added, removed).
- **A page-side add or remove that the receiver's options hold back reads as
  "behind"**, not "held".
- **A reader sees no "behind" line.** They cannot Sync to that copy, and
  their own deliberate change would nag for ever.
- **No notice where the person edits no copy** and has nothing to update
  from (no Sync to open).
- **A suffixed old copy** is no difference, no notice, no Moves mark.
- **The Moves cards filter in place** on Figures, Routines and Positions
  (also on desktop beside an open item); the filter can always be cleared,
  and `differ` stays optional on list rows (a list that forgets it shows
  nothing).
- **The same-name display is one thing:** a row's `from` (the place of its
  `cloned_from`) and `from-tag.ts`, applied in the Moves lists, the pickers
  and the Link popup. Drawn, never stored.

### Gone, and left

- Compare, Take (of fields) and Send mine are removed with their sheets,
  actions and API routes; `PAGE_EPOCH` went to 7. `apply.ts` stays: it
  lands the keys (`landKeys`) and Take a recording uses it. `send.ts` is
  now only the Versions list's members.
- Deferred, small: a refused target can be half-landed across two givers
  (wording only); `outOfStep` runs a merge per copied id of a list;
  `markFamilies` at boot fails the step for a row whose `flatOf` throws;
  Move to… a lesson leaves the archived source's mark stale (inert until a
  restore); the practice panel's local state can post stale locals after a
  reload while open.
