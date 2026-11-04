# Groups: a class shares its lessons

> Step 2 of opening the app to other people. Brainstormed 2026-11-02, after
> step 1 ([accounts](2026-11-02-accounts-design.md)) went live. Clubs come
> later and will hold groups; this step has groups only, and any person can
> make one. Mockups: see "Mockups" at the end.
>
> *(My call)* marks a decision Claude made that the user has not confirmed.
> Everything else was said or agreed by the user in the brainstorm.

## Why

Friends from the same class each have their own private app now. What they
cannot do is share the one thing they all make: the lesson from class. The
user records the class, marks the parts of the video, links them to figures,
and sometimes adds a routine and a drill. A friend in the same group should
get all of that without redoing it, practise it from their own Today, and log
it as their own.

Later the teacher could run the group, and clubs could hold several groups
(začetna, nadaljevalna, …). This step builds the group and leaves room for
the club above it.

The user's own week, for scale: the first bachata group, the advanced salsa
group, and sometimes the beginner salsa group. So one person is in several
groups, across both dances, and drops into some only now and then.

## Goals

- **Anyone can make a group** and add people who already have an account,
  with a reusable QR code.
- **A group owns its own things:** lessons, their videos and sections, and
  the figures, routines and drills made for them. Your own app stays only
  yours; a group's things live only in the group.
- **Editors make lessons in the group,** as a draft only editors see, then
  publish them to the members.
- **A member adds a lesson** to their own Lessons, and its practice lands on
  their own Today. Nothing is copied, and it costs them no storage.
- **Editing together never silently loses an edit,** and nothing shared is
  gone for good the moment someone deletes it.
- **A group has its own storage,** growing with the number of people in it.
- **People have names.** First and last name at sign-up, so a group's
  people are not a list of email addresses.

## Non-goals (this step)

- Clubs, and groups inside clubs.
- A member's own layer on a group lesson: their own notes, recordings or
  sections on it. They can make their own copy instead (see below).
- Suggesting changes to a group lesson, and student lessons submitted to the
  teacher or kept as an appendix.
- Pooling storage (members giving some of theirs to a group), and the paid
  storage perk.
- Moving an existing personal lesson into a group.
- Using a group's figures, variations or routines in your own routines,
  figures or lessons: that is "your moves across groups", the next step.
  *(Both built as clones and twins: Copy to… and Move to… a group; your own
  routines, lessons and sections use a group's things without copying.)*
- Shared songs. Songs stay personal.
- Live updates while two people have the same page open. A change shows on
  the next open or refresh.
- Notifications beyond what the app shows when it is opened.
- Slovenian. It is its own project, right before or right after this one.

## Anti-goals

- **A group never reaches into someone's own app.** Nobody, editor or not,
  can change a person's own figures, lessons or practice through a group.
- **No silent loss.** Two editors saving the same thing never overwrites one
  of them without showing it. A delete in a group is undoable for 30 days.
- **A group code never creates an account.** Only the admin's invite does
  (accounts spec). A person without an account who opens a group code is told
  to ask for an invite.
- **No leak past membership.** A person who is not in a group sees nothing of
  it, beyond the lessons they had added before they left. Another group's id
  and a missing one get the same 404, as the owner wall does today.
- **The admin still sees no one's content,** group content included. The
  admin page shows numbers and names.
- **Never lose data over a limit.** A group over its limit refuses new
  uploads and never deletes anything.

## Decided

### A group

- A group has a **name** and belongs to **one dance**. Salsa groups show in
  the salsa app, bachata groups in the bachata app.
- **Owner:** the person who made it. Picks editors, removes people, renames
  the group, makes a new code, deletes the group, and can **hand the group
  over** to another member (who becomes owner; the old owner becomes an
  editor).
- **Editors:** chosen by the owner. Make, edit and publish the group's
  lessons and the things in them, and can show the group's code.
- **Members:** see the published lessons and add them.
- *(My call)* An owner who wants to leave hands the group over first, or
  deletes it.
- *(My call)* A person can **make 2 groups in each dance** (salsa and bachata share
  nothing, the limit included; per dance since 2026-11-04). The admin can raise that per
  person on the admin page. There is no limit on groups joined.

### Joining with the group code

- Each group has **one code**, shown as a QR and a link, **reusable** by any
  number of people. Editors and the owner can show it. **Make a new code**
  (owner) stops the old one working at once.
- *(My call)* The code is stored readable, unlike the admin's invite, because
  it is shown again and again; it can only add existing people to one group.
- Opening the code signed in: "Join Salsa nadaljevalna?" with the group's
  dance and the number of people, and **Join**. The person is a member at
  once; no approval.
- Signed out: sign in first, then back to the Join question (the login's
  existing `next`).
- No account: "This code only adds people who already have an account. Ask
  [admin's first name] for an invite." No sign-up form.
- Opening the code of a group you are already in opens the group.

### What a group owns

- A group owns rows the way a person does: **lessons** (with their videos,
  sections, links, notes), and the **figures, variations, routines and
  drills** made inside its lessons. The owner wall becomes: a row belongs to a
  person *or* a group.
- **+ New lesson** on the group page makes a group lesson. Everything made
  from inside it (the Link popup's create, a new routine from its sections, a
  drill) belongs to the group.
- The Link popup and the pickers in a group lesson offer **the group's**
  figures, routines and drills, never anyone's own.
- **Positions stay one shared list per dance,** as in step 1. That is what
  lets a group's figures connect like anyone's.
- Every row records **who made it**, for History and "Edited by".
- *(My call)* Editors can also add **recordings** to a group's figures and
  **Save video** on a group lesson's or figure's YouTube link. Those are the
  group's: charged to the group, in its What uses space, its History and its
  Recently deleted.
- *(My call)* **From the phone:** the Android app's share page lists the
  group lessons the person edits beside their own (headed by group), so a
  class video recorded on the phone can go straight into a group lesson. The
  upload is refused over the group's limit like any other.

### Draft and publish

- A new group lesson is a **draft**: only the group's editors see it, with a
  clear Draft mark.
- **Publish** makes it visible to members. After publishing, edits show up
  for members quietly (decided: no second publish step).
- *(My call)* No unpublish. Taking a lesson away from members is archiving it
  (any editor), which goes through Recently deleted like the rest.
- *(My call)* Drafts never reach anyone's Today, nor the Android reminder's
  count. Making a group lesson does not add it to the editor's own Lessons;
  after **Publish** the editor is offered Add like anyone else.

### What a member sees

- The **group page** (reached from the Groups tab) lists the group's
  published lessons, newest first, each marked **Added** or with **Add**.
- A group lesson's page shows everything it holds: the videos, notes,
  sections with their links, its figures, routines and drills. Read-only for
  members.
- A member sees a group's figure, variation, routine or drill **through a
  published lesson**: what a lesson includes is what its member sees
  (`lesson-links.ts` already derives this for a lesson). Nothing else of the
  group's.

### Add

- **Add** opens a sheet listing what the lesson holds ("1 video · 6 sections
  · 5 figures · 1 routine · 2 drills") and what goes on Today: the lesson
  itself, the routine, the drills. All ticked; the member can untick any.
- The lesson then shows in the member's own **Lessons** list, marked with the
  group. Before Add it shows only on the group page (decided).
- Adding **copies nothing.** The member gets their own **practice entries**
  (how often, paused or not, their song and tempo, their logs) that point at
  the group's lesson, routine and drills. When an editor fixes a section or
  renames a drill, the member sees the fix.
- Adding **costs no storage.** The files are the group's and count against
  the group.
- Figures from the lesson show in the member's **Moves**, under the group's
  heading after their own figures (no filter; see "Decided from the
  mockups" 5), and get no practice entry unless the member turns one on, as
  with their own figures today.
- A drill whose practice plays a song: the member's entry starts with the
  same practice mode but no song. They pick one: their own, or a song a
  group they belong to shares (the class playlist rule in
  [`2026-11-03-groups-follow-ups-design.md`](2026-11-03-groups-follow-ups-design.md);
  it replaces "songs are personal").
- *(My call)* Something added to a lesson after the member added it (a new
  drill, a routine) does not land on Today by itself. The lesson shows
  "1 new drill · Add".
- **Remove from my lessons** takes its entries off Today; the logs stay
  (archived entries, as an archived exercise keeps its sets).

### Editing together

- Any editor can edit any of the group's things, the linked figures,
  routines and drills included.
- **Additions never collide:** a new video, section, link or drill is its own
  row.
- **Edits to the same thing are checked.** A save carries what the editor
  saw; if someone else saved that thing since, nothing is overwritten. The
  editor sees who changed it and when, their version and the other, and picks
  one or merges by hand. Their typed text is never thrown away. This covers a
  lesson's notes, a section's name and times, a figure's or variation's
  fields, a routine (as a whole), a drill.
- **Deleted under you:** a save on something that was deleted says who
  deleted it; the text stays on screen to copy.
- A group lesson shows **"Edited by Ana · 10 min ago".**
- *(My call)* The same check applies to a person's own things, because the
  same person on the phone and the work PC can overwrite themselves today.

### The safety net

- **Recently deleted** lists, for **any editor to Restore**, with who did it
  and when *(my call on the two kinds, following the app's own rules)*:
  - things the app **archives** (a lesson, a figure or variation, a routine,
    a drill): they stay archived until restored, never purged, as archiving
    works today;
  - things the app **hard-deletes** (a video, a section, a link, a
    recording): kept for **30 days**, then deleted for real, files included.
    Until then they still count against the group's storage.
- This matters most for videos: lesson videos are not in the server's
  backups (`docs/deployment.md`).
- Members' practice entries follow the existing rule: archiving a group
  figure, routine, drill or lesson archives the entries that point at it,
  logs kept; restoring it brings them back. Rows that entries and logs point
  at are never purged, so names never go missing.
- **History** *(my call: editors only)*: each group lesson has a History
  page: who changed, added or removed what, when ("Ana · changed the notes",
  "Ana · moved 'Enchufla doble' 1.2 s", "Luka · added a section", "Ana ·
  removed a link"). Changes to text and times keep the previous value, with
  **Restore**; additions and removals show with a link to Recently deleted
  where one applies. The group's figures, routines and drills have the same
  history, reached from their pages.
- **The biggest steps stay narrow:** only the owner deletes the whole group
  or hands it over.
- The existing guards stay: archive rather than delete for lessons, figures,
  routines and drills, a linked section refuses to delete, deletes ask first.

### Leaving, being removed, a deleted group

> **Replaced by clones and twins**
> ([`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md),
> "Leaving, and losing access"): after leaving or being removed a person reads
> nothing of the group. Leaving asks what to keep (Keep everything, choose,
> or Keep only what my routines use); removal keeps everything; what is kept
> becomes their own copies, files hard-linked and charged to them, with their
> routines, sections and practice moved onto them. Members of a deleted group
> keep what they have for the 30 days and get Keep everything at the purge.
> The read-only, still-current lessons below are how it was first built.

- **Logs are always the member's own** and are never touched.
- After **leaving**, the lessons the person had added stay in their Lessons,
  **read-only and still current**, at no storage cost. They lose the group
  page, new lessons, and editing (even of lessons they made: those are the
  group's).
- If the group later deletes a lesson someone had added, their entries and
  logs keep its name: "Tue 3 Nov · Salsa nadaljevalna (deleted)".
- **Deleting a group** (owner only) keeps it restorable for 30 days; the
  owner still sees it in the Groups tab, marked, with Restore. Members see a notice on the group's lessons for
  those 30 days ("Salsa nadaljevalna is being deleted on 2 Dec · Make my own
  copy"). Then the group's files are deleted and its rows stay, archived and
  unreachable, so members' logs keep their names: "Tue 3 Nov · Salsa
  nadaljevalna (deleted)".

### Make my own copy

> **Replaced by clones and twins**: Make it mine (clones and twins spec,
> ruling 12). A reader's Edit on a group lesson or song makes it theirs, and moves their
> practice onto the copy; the menu item, the `copy` actions and
> `copy-lesson.ts`/`copy-song.ts` are gone. What follows is how it was built.

- A group lesson's menu offers **Make my own copy · uses 380 MB of your
  space**: the lesson, its videos, sections, notes, and the figures, routines
  and drills it holds become the person's own, to edit freely.
- It counts against the person's storage at full size and is independent: if
  the group deletes its lesson, the copy stays. It works for members, former
  members, and editors alike. Refused, like any upload, if it would not fit.
- The person's practice entries for the group lesson stay pointed at the
  group's lesson. *(My call: moving them onto the copy is left out.)*
- *(Built:)* the videos are hard links under new names (a byte copy where a
  link cannot be made), so the group's purge never takes them; the copy gets
  its own review exercise, and its routines theirs, as any lesson and routine
  of a person's do. Routines and drills keep their names (neither has a name
  rule). An exercise the copy makes starts paused when the person already
  practises its source through an entry, so Today is not doubled. Copying
  twice makes two copies. `src/lib/server/copy-lesson.ts`.

### Storage

- A group's files count against the **group**, never against the person who
  uploaded them.
- A group's limit is **200 MB per person in it**, the owner included,
  computed from the current number of people, never stored. A group of one
  has 200 MB; a class of 15 has 3 GB. *(Numbers are my call; the user asked
  for the limit to depend on the number of people, and 7 GB of possible
  ceiling per person was too much.)*
- The admin can set a group's limit by hand; that replaces the computed one.
- The owner can **Ask for more** for the group, as a person can.
- Over the limit (people left): new uploads into the group are refused;
  nothing is deleted. Refusals say how much the group uses, its limit, and
  point the owner at Ask for more.
- **What uses space** for a group (owner and editors): the group's files,
  biggest first, as the person's page lists theirs.

### Names

- **Join** (the admin's invite) asks for **first and last name** too.
- Existing people without a name are asked once, the next time they open the
  app, before anything else; also editable in Settings.
- Names show in a group's people, History, "Edited by", Recently deleted, and
  on the admin page. *(My call)* People lists show the full name; History and
  "Edited by" show the first name, adding the last name's initial when two
  people in the group share a first name.

### The admin page

- A **Groups** section: each group's name, dance, owner, number of people,
  storage used and limit; tap to set its limit.
- Group requests for more storage join the people's requests.
- Each person's row gains how many groups they made in each dance and their group limit (per dance).
- A line at the top: **"Limits add up to 14 GB · 22 GB free"**, the sum of
  every person's and group's limit (the admin's own unlimited one aside)
  next to the free disk, so the admin sees it coming before raising anyone.

## Decided from the mockups (2026-11-02)

1. **Where groups live:** the user leans to a **Groups tab**, a fifth tab,
   because a group has many pages (its lessons, people, code, History,
   Recently deleted, storage). Drawn on the canvas; the fallback is one
   "Groups" row at the top of the Lessons tab that opens the list of groups
   (option C, the user's favourite of the three). A fifth tab fits: about
   75 px each on the narrowest phone, and the app had five tabs before the
   redesign.
2. **Add sheet:** ticks per item, all on (option A). The figures are listed
   too, **unticked**: a tick only decides what goes on Today, never what is
   visible. An unticked figure and its sections still show in the lesson.
3. **A clash:** *(my call; the user found all three fine)* the other
   version above, yours below in an editable box (option B). Also: a link
   to a figure renamed meanwhile shows the new name (links point at the
   row); a link to one archived meanwhile is refused, "Archived by Ana",
   with Restore or pick another.
4. **A removed member:** *(my call)* keeps their added lessons read-only,
   like one who left (option A). *(Replaced by clones and twins: a removed
   member gets Keep everything and reads nothing of the group.)*
5. **Moves:** no Group / Mine toggle. Your figures, then each group's
   figures from the lessons you added, under a slight group heading
   (option A's content, the user's wish for no toggle). In this step group
   figures are viewed and practised only; using them in your own routines
   comes with "your moves across groups" (below). *(Built as clones and twins.)*
6. **Today:** a heading per group (option B).

## Settled while planning (2026-11-02)

*(My calls, from the plan's loophole review; see
`docs/superpowers/plans/2026-11-02-groups.md`, "Structural risks".)*

- **Added is its own thing.** A lesson is in your Lessons because you added
  it, even if you unticked everything that goes on Today.
- **Remove from my lessons** keeps on Today what another lesson you still
  have also holds.
- **"1 new drill · Add"** has a **Not now** that dismisses it until
  something else is added.
- **Handing a group over** is refused when the new owner already owns as
  many groups as they may make.
- **A disk floor:** any upload, a person's or a group's, is refused when it
  would leave the server under 2 GB free, whatever the limits say. Group
  limits can add up past the disk (15 people in each other's 30 groups would
  be 90 GB); the admin line shows that, and the floor makes sure the disk
  never fills.
- **Make my own copy** puts the copied variations under your figure of the
  same name, if you have one; a variation name you already use there gets
  the group's name added ("Doble (Salsa nadaljevalna)"). Figure recordings
  are not copied. *(Replaced by clones and twins: a copy is matched by
  its family, not its name; copying again reuses the first copy.)*
- **A group drill never holds a song;** a member picks their own.
- **Taken out means off Today.** When an editor unlinks a drill, routine or
  figure from a lesson (or archives it), members whose added lessons no
  longer hold it get it off Today, logs kept. If it comes back, it shows as
  "1 new … · Add".
- **What a member opens shows only what they can reach.** A figure or
  routine page lists its lessons, routines, sections and neighbours from the
  published lessons only, never a draft's.
- **Restore** brings back members' entries only if they went with the thing
  being restored; one a member had removed earlier stays removed. Restoring
  something whose name is now taken is refused, naming it.
- **The group link** is private: someone signed out is sent to Sign in,
  which shows the "only adds people who already have an account" sentence.
  The group's name is never shown to someone not signed in.
- In the code a group is a **team** (`team_id`), because "group" already
  means a figure there (`figure_groups`). People only ever read "group".

## Next step: your moves across groups

> **Replaced by clones and twins**
> ([`2026-11-03-clones-and-twins-design.md`](2026-11-03-clones-and-twins-design.md)):
> Same as… became personal twins per figure, shown as one; copies became
> families with Compare, Take and Send; leaving keeps copies instead of
> freezing. What follows is the brainstorm it came from.

Not in this step; its own design right after. Agreed in the brainstorm:

- **"Same as…"** on any figure or variation a person can see, their own or a
  group's, links it to another: figure with figure (one school's "Setenta"
  is another's "Sombrero"), variation with variation. Moves then shows the
  set as one row under the name the person picks, each school's variations
  side by side; routines, the gap report and coverage count it as one move.
- It is **personal first**: it changes nothing in the group, and two people
  can see it differently. Later, a group's editors can **suggest** it to
  their members.
- Leaving a group freezes that group's members of a person's sets into
  their own copies (no videos, no storage), so nothing breaks.
- **Positions** get "same as" too, plus **"a finer version of"** (the
  sub-position idea: connects as its parent). The shared base list per
  dance stays, so groups connect without everyone mapping everything.
- The figures table is not remodelled: "same as" is a new link on top
  (the table cannot be rebuilt; `CLAUDE.md`).

## Constraints from the project

- `CLAUDE.md` hard rules apply. Most relevant:
  - **Never add a CHECK to an existing table;** additive `ADD COLUMN` only,
    nullable, with the invariant in the data functions. Read the generated
    SQL.
  - **A person is the wall inside the dance** becomes "a person or a group".
    The root tables (`figure_groups`, `figures`, `exercises`, `lessons`,
    `routines`) need a group owner beside `user_id`; children still derive
    theirs. `songs` and `count_takes` stay personal.
  - The owner-wall specs (`[dance]/owner-wall.spec.ts`,
    `api/owner-wall.spec.ts`) gain a member, an editor, an outsider and a
    former member, area by area: the outsider gets 404 everywhere, the member
    reads published lessons only, never drafts, and never writes.
  - The four media servers and the flat `/api/` routes check access through
    the owning group's membership, or the person's added lessons after
    leaving.
  - **Archive, don't delete** stays; the hard-delete kinds (videos, sections,
    links, recordings) become 30-day soft deletes for group rows. Update the
    rule in `CLAUDE.md`. No existing foreign key is dropped (that would be a
    rebuild): rows that others point at are archived, never removed.
  - Urgency is never stored; `src/lib/urgency` and `src/lib/day` never learn
    that groups exist. A member's practice entry is an ordinary exercise row
    of theirs.
  - A form someone fills in uses `use:guarded`; the clash check plugs into
    that save path.
  - Data functions take `db` first; specs never touch `$DATA_DIR`.
- The look follows the redesign
  ([`2026-10-31-redesign-design.md`](2026-10-31-redesign-design.md)): the
  tokens, the band, the four tabs, the shared components in
  `components/ui/`, plus the fifth tab, Groups ("Decided from the
  mockups" 1); the redesign spec's tab bar is updated to five.
- The server has 22 GB free and 3.7 GB of RAM shared with other services
  (2026-11-02). The whole app used 395 MB after two months of one person's
  heavy use.

## Left to the builder

- How a row names its owning group (a `group_id` beside `user_id`, or an
  owner shape that a club can later fit), and how a member's practice entry
  points at a group's drill (a drill is `source = 'custom'` today, and its
  name, notes and links are the drill's own).
- How the clash check is stored (a version number or the last change's
  time per row).
- How History and Recently deleted are stored (a change log, `deleted_at`
  columns, a trash table), and when the 30-day purge runs (at boot like the
  partial-upload sweep, a timer, or both).
- The group code's format and URL.
- How Make my own copy duplicates video files (a copy or a hard link), as
  long as the copy survives the group's file being deleted and is charged in
  full to the person.
- The split into plans. *(Suggested order: names; groups, joining and the
  group page; group ownership with draft and publish; Add and practice
  entries; clash check; History and Recently deleted; storage and the admin
  page; Make my own copy.)*

## Mockups

Every new screen and every changed one, in the redesign's look, with the
"Not sure yet" choices side by side:
<https://claude.ai/artifact/MKVZbXFexBrUVvPPUHg1Xj> (private; "Salsero groups").
The names and surnames and the small invented controls on it (a Mine | Group
switch, the person sheet's actions) are the drawing's, not decisions.
