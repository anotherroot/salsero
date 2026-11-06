# Groups follow-ups — design

**Status:** design, 2026-11-03. Follows groups
([`2026-11-02-groups-design.md`](2026-11-02-groups-design.md)), deployed the
same day from branch `groups`. Mockups: the "Salsero group mode" canvas
(https://claude.ai/artifact/Pqdc9XEXQHjS8poJd6asr8), boards B and E.

**Added 2026-11-06**
([`2026-11-05-lesson-links-and-music-design.md`](2026-11-05-lesson-links-and-music-design.md),
part B): a teacher can also suggest class songs on a lesson, a drill or a
routine, each with a note ("Music"). Adding a draft shares it; unsharing hides
it from members' Music, and sharing again brings it back.

Four things the user found after using groups on the live site: one bug and
three gaps. Copying your own lessons, figures and routines into a group is
**not** here: it needs clones and twins, which have their own design
([`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md)).

Marks: *(user)* the user decided it; *(my call)* decided while designing,
open to change; everything else follows from those or from the code.

## Why

A teacher prepares a class the way they practise: open Moves, sketch a
routine, tidy figures, and only later attach them to a lesson. Groups today
reach group content only through a lesson (Groups → group → lesson →
routine), so a group routine cannot be built first, and there is no place to
see everything a group owns. Members, for their part, cannot tell that a
teacher published something, a class has no songs, and a routine Added from a
lesson is missing from the Routines list.

## 1. The bug: added routines are missing from Routines

**What happens:** a member Adds a group lesson that links a routine. The
routine opens from the lesson, but Moves → Routines does not list it.

**Cause (found):** Moves → Figures has a section per group
(`listAddedFigures` in `src/lib/server/figures.ts`: for each group whose
lessons the person added, the variations `addedReach` returns). Moves →
Routines loads only `listRoutines(db, wall)` (the person's own) and has no
counterpart. The groups spec named only figures ("Figures from the lesson
show in the member's Moves"), so this is a gap in the spec, not a slip in
the code.

**Fix:** Routines gets the same shape as Figures: the person's own routines,
then a section per group with the routines `addedReach(...).routines` holds,
under the same slight group heading, read-only, opening the routine's page
as the lesson does. Archived ones are left out, as in the person's own list.
A spec that Adds a lesson with a routine and checks the Routines list must
fail on today's code.

## 2. Group mode, for owners and editors

**What it is** *(user)*: an owner or editor flips the app into one group.
Moves, Lessons and Music then show only that group's things, and + makes
things that belong to the group. Members never get it: they edit nothing.

**Getting in** *(user, board E)*: a round group icon beside + in the band of
Moves, Lessons and Music, shown only to someone who owns or edits at least
one live group of this dance. One such group: the icon goes straight in.
Several: a sheet, "Work in", lists Mine and each group (name, role, people),
like the app's other pickers.

**Inside a group** *(user, board B)*:

- The band is navy instead of the dance's colour, with a thin striped top
  edge, and a small line above the title: the group icon and
  "Salsa Tuesdays · group". The tab bar is tinted to match.
- The Today tab becomes a plain **Mine** button *(user)*: a back-arrow icon
  and the word, in the group colour, with no fill, so it does not shout. Today is practice, and
  practice is personal; Mine leaves group mode and stays on the same tab, now
  yours: Lessons opens your Lessons; from a group's lesson, figure or song, that
  tab's list (*user*, 2026-11-04; it opened Today before). Mine is a
  one-tap form to the switch, not a link: reaching a Today page any other way
  shows it without group mode but leaves the choice alone, because no load
  ever changes group mode (SvelteKit runs loads on hover and touch preload,
  so brushing a tab would switch modes).
- The group icon in the band stays: it opens the same sheet, to switch to
  another group or back to Mine.
- The Groups tab stays the usual list of all your groups *(user)*, in every
  group; the one you are working in is marked "Working in". Opening a group
  opens its page as today (people, History, storage); it does not switch
  group mode.
- Moves (Figures and Routines), Lessons and Music list the group's rows, and
  their create actions make group rows. Editing a group row works as it does
  today from a lesson: the clash check, History and Recently deleted all
  apply, since these are the same rows and the same data functions.
- **What members see** *(user)*: a figure or routine made in group mode and
  linked by no published lesson stays with the editors. The group's Moves
  marks it: "Members don't see it yet" (with an eye-off icon), and a short
  note at the top of the list says why. This is how reach already works;
  only the marker is new. It is computed from the published lessons
  (`reachFrom` over published lesson ids), never stored.
- Lessons in group mode: drafts first, then published lessons by month, as
  the group page lists them now. + makes a group lesson (a draft).
- Music in group mode: the group's songs (part 4).

**Where the choice lives** *(my call)*: a cookie per browser, one per dance,
holding the group's id, like the theme cookie. It sticks until Mine or a
switch, including across a reload, and each device keeps its own (the user
agreed to "per device"). Every request re-checks it: a group that is
deleted, of another dance, or where the person is no longer owner or
editor is ignored and the cookie cleared, so a removed editor drops back to
Mine on their next tap. The cookie only chooses which space the lists and
create actions use; access to any row is still decided by `access.ts` and
the `require*Access` guards, exactly as today. A URL-based group mode
(`/salsa/g/<id>/moves`) was weighed and set aside: it would double every
content route for the same pages.

**What stays out of group mode** *(my call)*:

- Coverage and the gap report: hidden in group mode in this step (their
  tiles do not show). They read one person's wall today.
- Positions: one shared list per dance, as before; its tile stays.
- The player and Practise: personal. A group routine's Practise button in
  group mode opens the player as it does for a member today.
- Settings, the admin page: unchanged.

## 3. Notifications: what's new in your groups

**What counts as new, per person** *(user)*:

- a **published lesson** of a group you belong to that you have not opened
  yet, published after you joined the group (lessons already there when you
  joined do not greet you with "12 new"; *(my call)*, the user agreed);
- a **lesson you added** that got something new (what `newInLesson` returns)
  since you last opened it;
- a **shared group song** you have not opened yet (part 4).

Drafts never count. Your own publishing never counts for you; another
editor's does. Membership must be current: a former member's added lessons
do not light anything *(my call)*.

**What clears it** *(user)*: opening the lesson (or the song). Add and Not
now keep their meaning on the lesson page and are not needed to clear the
bubble.

**Where it shows** *(user)*:

- **Groups tab:** a small dot on the icon while any group of this dance has
  something new for you. A dot, not a number. It shows in group mode too: it
  is about you as a member.
- **Groups list:** a larger "1 new" / "3 new" pill on each group's card,
  counting that group's new lessons and songs.
- **Group page:** a "New" marker on each lesson (and song) that counts.

**The exact tests** *(my call)*:

- A published lesson is new for you when you have **not opened it since it
  was published** (`opened_at < published_at`, or never opened), and it was
  published after you joined. An editor who opened a draft before it was
  published still sees it as new once it is. Your own Publish clears itself:
  the lesson page reloads after the action and records the open. No
  "published by" column is needed.
- An added lesson is new for you when **something came into it after you
  last opened it**: a link row (`lesson_routines`, `lesson_exercises`,
  `spot_links` reaching it) created after `opened_at`. This is the bubble's
  test, not `newInLesson`'s: it is one indexed query, and it can light for an
  item you already practise. That is accepted: the lesson did change, and
  opening it clears the bubble. The lesson page's own Add / Not now offer
  keeps using `newInLesson` and `seen_at`, unchanged.
- A shared song is new for you when you have not opened its page since it
  was shared.

**Data** *(my call)*: one new table of when a person last opened a lesson
or a group song, `(user_id, kind, item_id, opened_at)`, unique per person
and item; written from the page once it is shown (`POST /api/opens`), never in
the load, because SvelteKit preloads a page's data on hover and touch. The page
records again after its data reloads (an editor's own Publish clears itself:
`opened_at` ends up at or after `published_at`). "New"
is derived per request from it, `published_at`, `shared_at`, `joined_at`
and the link rows' creation times, never stored as a flag (the urgency
rule). The count for the tab dot runs on every page of a dance, so it must
stay a few indexed queries per request, never one per lesson; the builder
measures it on a person in two groups with fifty lessons each.

**Not now** *(user)*: no phone push. The Android app's daily reminder could
mention it later.

## 4. Group songs: a class playlist

**What it is** *(user)*: the teacher adds the class's songs and sets the
count, which they hear better than the students; members practise to them.
Members keep adding their own private songs as now.

**The teacher (owner or editor), in group mode's Music:**

- Adds a song the usual ways (YouTube through the home worker, or a file).
  The worker finds the beats; the teacher taps the count. Same pages, same
  flow as a person's own song.
- A new song is a **draft** *(user)*: only editors see it. **Share with the
  class** makes it visible to every member; **Stop sharing** takes it back.
- Its audio counts against the **group's** storage *(my call)*, like every
  other group file, and the 2 GB disk floor applies.
- Edits (name, count anchors, sample start), share and unshare, and delete
  are group mutations: logged in History with the actor, checked for
  clashes (`seen` covers the fields a save writes), and a delete goes to
  Recently deleted for 30 days with its file; then `purgeTrash` deletes the
  row and the file for good (entries that still picked it drop to count only).

**Members (and editors outside group mode):**

- **Music** lists their own songs, then a section per group ("Salsa
  Tuesdays · 6") with every **shared** song. All shared songs, not only ones
  a lesson names: a class playlist *(user)*. Drafts show only in group mode,
  to editors *(my call)*; outside it an editor sees the same shared list as
  a member, and only a shared song can be used in a person's practice entry
  or the player. So a draft never ends up in anyone's practice.
- Tapping a group song opens a **read-only song page** *(my call)*: play,
  the sample, the count as the teacher set it (no taps, no grid editing),
  and Make my own copy. Loading it records the open that clears "New". The
  guards on `/songs/[id]` and its grid page grow a read path for a reachable
  group song; writing stays editor-only.
- They use it in the player and in a practice entry like their own. The
  count is the teacher's; they cannot change it. A group song carries no
  member's own data.
- **Make my own copy** on a group song puts a private copy in their songs
  (the audio hard-linked under a new name, charged to them; since the clones
  work it is Edit's Make it mine), to
  re-tap the count their way.
- A newly shared song shows "New" and counts in the notifications until
  opened.

**When a member loses a song** (unshared, deleted, or they leave the group):
it leaves their Music, and any practice entry of theirs that used it falls
back to count-only (its song set to none), in the same transaction, as
`reconcileEntries` does for what reach shrinks. Copies they made stay.

**And when it comes back** *(my call)*: the safety net promises that Restore
brings back exactly what one change took. So the change that drops a song
from entries records which entries lost which song, and when (a small table
of `(exercise_id, song_id, dropped_at)`). Share again, or Restore from
Recently deleted, puts the song back on exactly those entries, unless the
person has picked another song since. Leaving the group is not undone this
way (rejoining starts fresh, as for lessons).

**Stop sharing and Delete warn** *(my call)*: when members' entries use the
song, the sheet says so ("Used in 4 people's practice. They'll switch to
count only."). It warns, it does not refuse: unlike a person's own song
(`deleteSong`, refused while a live exercise uses it), a group song is the
teacher's to withdraw. CLAUDE.md's rule on songs gains this exception when
it is built.

**This changes one rule of the groups spec:** "songs are personal, they pick
their own" for a drill's practice. A member's entry may now use a shared
song of a group they belong to. The song check on an entry and the player's
`?song=` accept such a song; the media route for audio (`/audio/[file]`)
asks `access.ts` as the other media routes do.

**Data** *(my call)*: `songs` gets `team_id` (nullable, exactly one of
`user_id` and `team_id`, as on the other root tables, and `songs` joins
`ownerIntegrity`'s list) and `shared_at` (null for a draft). Both are
additive columns: never a CHECK, never a rebuild (the hard rule).

**The server side of songs assumes a person owner today**, and must learn
groups (the Python worker itself needs no change):

- `api/worker/songs/[id]/audio` fails a job for good when `user_id` is null
  and charges only the person. It must find the owner with `ownerOfRow` and
  charge it with `roomForOwner`, as the video worker route already does.
- The song page's add-by-URL and retry actions, and the raw-body upload
  (`api/songs`), check room with the person's id; they must check the
  owner the song will have.
- `/audio/[file]` serves only the person's own songs; it asks `access.ts`
  instead, so a member can play a shared song and nobody can play a draft
  they don't edit.

**Uploads name their space** *(my call)*: the flat upload endpoints have no
dance in the URL, so they never read the group-mode cookie. A song or
recording upload made in group mode sends the group's id with the request,
and the endpoint checks with `access.ts` that the person edits that group
before writing anything. A file can never land in a space by guessing.

**Not in this step** *(user)*: a lesson naming a song ("this week we dance
to this one"). Count takes (the voice recordings) stay personal.

## Order

The bug first (small, and it is on the live site), then group mode, then
notifications, then group songs (it uses group mode's Music and the
notifications' "New"). Each ships on its own.

## Anti-goals

- Group mode must never show a member's or another person's private rows,
  and never let a member write: it changes which space a list reads, not
  who may do what.
- No stored "unread" flags or counters that can drift from the data.
- No second way into the same group page: the band icon and the Groups tab
  lead to the same group.

## Left to the builder

- The exact copy of the "Work in" sheet, the note in group Moves, and the
  marker wording, within the mockups' tone.
- How the band and tab bar take the navy: new tokens in `tokens.ts` (all
  four themes, with the contrast spec), not hard-coded colours.
- Query shape for the new-items count, within the cost bound above.
