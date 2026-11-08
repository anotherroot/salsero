# Levels: how much app a person sees, and the simple screens

Status: built 2026-11-05 (migration 0031, shared with part 3); see "Decided
while building" at the end. Part 2 of three from the "app for
people who just follow their class" brainstorm. Part 1 (Today as a number a
day, the four faces, Coming up) is built:
[`2026-11-05-today-scheduling-design.md`](2026-11-05-today-scheduling-design.md).
Part 3 (comments on lessons) has its own spec:
[`2026-11-05-lesson-comments-design.md`](2026-11-05-lesson-comments-design.md).

Mockups: drawn with the user during the brainstorm with the design kit
(`docs/superpowers/design-kit/`), salsa and bachata. They are the reference
for the look; this text is the reference for what each screen holds.

## Why

The app was built by and for someone who sets everything up: moves, figures,
positions, routines, sections in videos, links. The user's partner pointed out
that the middle-aged women in their salsa class would be lost in it. Most of
them only want to follow the class: see what was taught, watch it again, and
practise a few minutes a day. Part 1 made Today simple for everyone. This part
lets each person choose how much of the rest they see, and gives the people
who choose less a simple lesson page and a simple video player.

## The three levels

A person picks one when they first open the app, and can change it any time
in Settings. The words are the user's.

| | Follow my class | Practise and keep my own | Everything |
|---|---|---|---|
| Tabs | Today, My class | Today, Lessons, Groups, Music | Today, Moves, Lessons, Groups, Music (as now) |
| New class lessons | on Today by themselves, always | on Today by themselves if the group's toggle is on (on by default) | the group's toggle, off by default |
| Lesson page and videos | simple | simple | as now |
| Creates | nothing | own lessons (a workshop, their own performance) with videos, own songs | everything |
| Exercise page and log popup | simple | simple | as now |

Settings words (the "How much app?" choice, also on the first-run screen):

- **Follow my class** — "What my class is working on, a few things a day.
  Nothing to set up." Small line: "New class lessons come to Today by themselves."
- **Practise and keep my own** — "Also keep my own videos, like workshops or my
  performances, and my own songs." Small line: "Videos still just play."
- **Everything** — "My own figures, positions and routines. Mark and edit
  sections in videos."

Footer line under the three: "You can change this any time in Settings".

## Goals

- A person at Follow my class never sees a screen that asks them to build,
  organise, link or mark anything.
- New class lessons reach their Today without an Add.
- A lesson opened at the first two levels shows what was taught and lets it be
  watched again: notes, videos, what you are practising from it. No sections,
  no links, no figure graph, no sizes, no edit tools for the group's lesson.
- The video player at the first two levels is the real player's folded-down
  look, with repeat, speed and mirror. Nothing to mark or edit.
- Moving up a level never loses anything: the data is the same, only what is
  drawn changes.
- Phone and desktop.

## Non-goals

- Separate sign-ins per dance (the user plans it; not here).
- Writing to the teacher privately (dropped for now; comments are part 3).
- A teacher's "see it as a student would" preview.
- Changing what Everything shows, beyond the auto-add toggle on a group's page.

## Anti-goals

- **A dead end.** A page reached at a lower level (a link, the back stack, a
  bookmark) still works; nothing 404s because of a level. Levels hide entry
  points, they do not wall off routes.
- **Losing work by changing level.** Lessons, songs, figures and practice made
  at one level stay and show again when the person moves up.
- **A different Today per level.** Today is part 1's, the same for everyone.

## What is stored

- `users.level`: text, nullable. `'follow' | 'own' | 'all'`, checked in the data
  function (no CHECK: never on an existing table). **Null means the person has
  not chosen yet**; every account that exists today is backfilled to `'all'` in
  the same migration (`UPDATE users SET level = 'all'`), so nothing changes for
  anyone already using the app. A new account starts null and is asked.
- `team_members.auto_add`: integer, nullable. Null means "the level's default"
  (on at Follow my class and Practise and keep my own, off at Everything); 0 and
  1 are the person's own choice from the group's page. At Follow my class it is
  always on and the toggle is not drawn; a stored 0 is kept for when they move
  up.
- Both through `ALTER TABLE … ADD COLUMN`. One migration (0031, or the next free
  number if part 3 lands first).

`locals.user` gains `level` (from `validateSession`), so every layout knows it
without a query.

A pure, client-safe module `src/lib/levels/levels.ts` holds the level type, the
words above, `tabsFor(level)`, `autoAddOn(level, stored)` and `simple(level)`
(true for `follow` and `own`). Components ask it; they do not compare level
strings themselves.

## First run

A new account (invite → Join, which already takes the names) has no level. The
hook sends any signed-in page request without one to `/welcome/start?next=…`,
exactly as `needsName` sends a nameless one to `/welcome` (same passes:
`/api/`, media, `/_app/`, `/logout`, `/health`, the welcome pages themselves).
The pages are drawn in `CardFrame`, like Welcome.

1. **Three slides**, swipe or Next, Skip at the top right goes straight to step 2:
   - "Practise what you learned in class" — "Your teacher puts each class here.
     You watch it again and practise at home, a few minutes at a time."
   - "A few things a day" — "Today shows just a handful. When they are done,
     you are done."
   - "You say when it comes back" — "After practising, tap how it went. The app
     remembers for you."
2. **How much app?** The three levels as large radio cards, each with its tabs
   drawn small underneath (the mockup). Nothing preselected; Continue is
   disabled until one is picked. Saving writes `users.level`.
3. **Join your class.** "Your teacher has the code." A class code field
   (normalised as `teamByCode` does: case, I/L/O, separators), "Join", and
   under it "Or open the link your teacher sent, or scan the code on the
   studio wall." A quiet "Not now" skips it. A wrong code says so under the
   field (`FieldError`). Joining runs `joinTeam`, then auto-add (below).
   - When `next` is a `/g/<code>` link (someone opened the teacher's link before
     they had chosen a level), this step shows that class instead: "Join
     Salsa Tuesdays?" with Join and Not now.
4. Then `next`, or the joined class's dance's Today, or Today.

The first run comes before anything else, including Join's landing: a browser
goes Join → first run → `/app` (Get the app). The level is per person, so the
Android app's WebView never asks again. When `next` is `/g/<code>`, the join
step handles it; `/g/[code]`'s own redirect for members never runs first
because the hook sends the request to the first run before the route loads.

The class code field is new: today a group is joined only through the
`/g/<code>` link or the QR. The same field also appears:
- in My class when the person is in no class (the empty state);
- in the Groups tab at the other levels, beside New group ("Join with a code").

## Tabs per level

`TABS` is the list of every tab (Today, Moves, Lessons, Music, Groups, You);
`tabsFor(level)` filters it for the phone's bar. Above Follow my class the Groups
tab is You (the person icon, the label "You"): the groups, then a short list of
settings (2026-11-07, so Settings is one tab away from anywhere). At Follow my class
Groups is My class (same route `/[dance]/groups`, same icon, the label "My class")
and You is a tab of its own, `/[dance]/you`, the settings alone:

| Level | Phone tabs |
|---|---|
| Everything | Today · Moves · Lessons · Music · You |
| Practise and keep my own | Today · Lessons · Music · You |
| Follow my class | Today · My class · You |

The desktop side reads `sideTabsFor(level)`: the same without You, Groups keeping
its name and icon, Settings at its foot (`/[dance]/you` lights Settings there).
`BottomNav`, `tabTargets` and `error-view.ts`'s fallback read `tabsFor`. The Groups
dot (`groupsNew`) shows on You, and on My class at Follow my class.

A page whose tab is hidden lights no tab, except a class's (group's) lesson at
Follow my class, which lights My class (`litAt`, ruling R13); a person's own
lesson lights none. Pages reachable at a lower level
that are not part of it (a figure page, a routine, Music's song page at
Follow my class) still open; the simple screens below simply do not link to
them.

Group mode (the Mine / group switch) is drawn only at Everything.

**Teachers.** New group is drawn only at Everything. A group's lesson the
person can edit (`lessonAccess` is `edit`: an editor or the owner) is drawn as
the full page at every level, with Edit and Publish, so a teacher who picked a
lower level is never stuck on their own draft. Simple screens are for reading
other people's lessons and for a person's own lessons at Practise and keep my
own. `simple(level)` therefore takes the access too: `simpleLesson(level,
access, isGroupLesson)`. **(My call.)**

**Dances.** The level is per person; classes, Today and My class stay per
dance, as now. At Follow my class:
- `/` (the last-dance redirect) prefers a dance where the person has a class
  when the last dance has none.
- My class with no class in this dance but one in the other shows "Your
  bachata class ›" (going to that dance's My class) above the code field.
- Joining from the first run or the code field goes to the class's dance.
- "In one class" counts classes in the current dance only. **(My call.)**

## Auto-add

"Add runs by itself." When it runs for a person and a lesson, it is exactly
`addLesson(tx, userId, lessonId, defaultPicks, now)` with the default picks of
`addOffer` (the lesson, its routines and drills ticked, figures not), in the
same transaction as what triggered it. It never runs for a lesson the person
already has a `lesson_adds` row for.

It runs:

- **On publish**, for every member of the lesson's group whose `autoAddOn`
  is true, in `publishLesson`'s transaction. Editors and the owner are
  members too and follow their own toggle. There is no unpublish, so this
  happens once per lesson.
- **When a class is joined** (the welcome step, the code field, `/g/<code>`),
  for the person, if auto-add is on for them in that group: see "Which
  lessons on join" below.
- **When a published lesson gains something to practise**: anything that makes
  `newInLesson` non-empty for a member. `newInLesson` returns only a lesson's
  own routines and drills, so that is a routine linked to the lesson
  (`linkRoutine`), a drill linked by hand (`linkExercise`), a drill linked to a
  section of one of its videos (`linkInSpace`, which the Link popup's
  create-and-link also goes through), and a lesson Take or Send into the
  group's lesson (`syncFrom`). Figure links and routine edits are not growth:
  Add never adds a figure, and a routine holds no drills. For each member who
  has the lesson added and auto-add on, the new items are added as Add would.
  One function, `autoAddPending(tx, teamId, lessonIds, now)`, run for the
  lessons that grew at the end of each of those mutations, in its
  transaction; `GROWTH` in `auto-add.spec.ts` lists them (like `MUTATIONS` in
  `changes.spec.ts`), and its scan of the insert sites into `lesson_routines`,
  `lesson_exercises` and `spot_links` fails when a new one is not placed.
  **(My call.)**

Turning the toggle on, or moving to a lower level, adds nothing by itself: it
applies from the next publish on.

Removing a lesson (`removeLesson`) stays possible at the two upper levels and
is never undone by auto-add for an existing lesson. At Follow my class there is
no Remove; "Not today" on Today is the way to set something aside.

A new entry is due on the day it is made (part 1), and Today takes them in
part 1's order. Nothing here forces a new lesson onto today's list.

### Which lessons on join

**Only the newest** published lesson of the class is added (the user's
answer). Older ones are not added, but each can be added by hand with one tap
(below), at every level.

## My class (Follow my class)

The Groups route drawn in a simple mode. One set of data, two looks.

- **In one class:** the tab opens that class's page directly.
- **In two or more** (in this dance): a short list of your classes, each with
  its name, the latest class's date and the New dot; a tap opens that class's
  simple page. On desktop the list is the list column beside the class (the
  user's answer).
- **In none:** "Join your class" with the code field (as in the first run).

A class's simple page, top to bottom:

- The band: the class name, "Class menu" (People and Leave only).
- **The latest class** as a big card: the date tile, title, "2 videos · 4 to
  practise", a New badge while unopened (the existing what's new).
- **Earlier classes:** the rest of the published lessons as rows (date tile,
  title, the same meta), newest first.
- **Class songs · N:** the group's shared ready songs, each with a play button
  that plays its sample (the existing sample player), and tapping the row
  opens the song page.

A class the person has not added (an older one, from before they joined)
shows a small **Add** on its row: one tap adds the default picks at once, with
"Added to Today · Undo" (Undo is `removeLesson`). An added class shows nothing
extra. The simple lesson page of a class not added has the same Add as a band
under its title ("Not in your practice yet · Add"). No other Add buttons, no code, no Rename, no Recently
deleted, no storage. A lesson row opens the simple lesson page.

As built (Task 6): "4 to practise" is what Add puts on Today (the lesson, its
routines and drills: `addOffer`'s ticked items), a zero part left out. In one
class the page has no ‹ (it is the tab's own page); with two or more it goes
back to the list. **A teacher at Follow my class** (an editor or the owner of
the group) keeps the full group page (drafts, New lesson, the code), as their
lessons stay full (`simpleClass(level, role)`); the tab's landing and the list
of classes are the same for them. Undo posts the lesson page's own Remove
with `stay=1`, which answers instead of redirecting to Lessons (the simple
lesson page's Undo posts the same).

At Practise and keep my own and Everything, Groups is the standard Groups tab.
A group's page gains one row for every member: **"Add new lessons to Today
automatically"**, a switch, writing `team_members.auto_add`. At Practise and
keep my own the per-lesson Add stays (the toggle can be off), and it adds the
default picks at once, without the Add sheet.

## The simple lesson page (Follow my class, Practise and keep my own)

The same route and load as the lesson page, drawn differently when
`simple(level)`. Top to bottom (the mockup "A class"):

- The band: "Class · Tue 3 Nov" over the title, back to My class (or the list
  it came from).
- The teacher's notes, linkified.
- **Videos · N:** each video as an inline video with its caption ("The whole
  move, slow"), tap to play, its row of Mirror, Full screen and speed. No
  section bands on its timeline, no sections list under it.
- **What you're practising:** the person's own entries from this lesson
  (drills, routines, the lesson entry), each a row with its name and when it
  is next on Today in part 1's words ("On Today today", "On Today on Sunday",
  "On Today next week"). A row opens the exercise page.
- The Comments card (part 3), for a group's lesson.

Hidden: SourceTabs, Make it mine, Edit (for a group's lesson), the Add sheet,
the "N new" banner at Follow my class (auto-add covers it), VideoSections, the link groups
(Figures, Routines, Exercises, Positions), file sizes, upload buttons, the
Link popup, "Go over this lesson" with its + (the practice list replaces it).

**Own lessons** (Practise and keep my own): the Lessons tab's New lesson, and
the person's own lesson page, keep title, date, notes, videos (upload, rename,
delete) and links (YouTube links as rows). Nothing about sections, figures,
routines or positions. The existing edit mode, with those parts not drawn.

## The simple video player (Follow my class, Practise and keep my own)

`VideoPlayer` with a `simple` mode, for inline-to-full-screen from any video at
these levels (lesson videos, recordings on a figure page if one is reached,
an exercise's video):

- **Always the folded bar** (the real player's Hide look, `slimBar`): a thin
  timeline, then one row with **−5 s**, a small play, **+5 s**, and the time on
  the right. No Show / Hide toggle, no big time.
- **Top bar:** close, the title, **repeat**, mirror, the speed pill
  (0.25–1×, the existing menu). Repeat is an icon button beside mirror, like
  it; lit in the dance colour when on. It loops the whole video (on `ended`,
  back to 0 and play). It is remembered with mirror and speed in
  `video-prefs`. Mute (from the player polish, merged later) stays too: a
  plain playback control, remembered beside them.
- Never drawn: Mark point, Start section, the section row, the Sections pill,
  Edit, the link entry, ±0.1 s and ±1 s steps, the M/S/L keys.
- Pinch zoom, double-tap jumps (as now: 1 s per tap), landscape and the screen kept
  on stay. The ±5 s buttons are new (the real slim bar steps ±1 s and ±0.1 s).

A video that is a section (an exercise linked to a section of a lesson video)
opens on that section looping, as now, with the same simple chrome; repeat is
lit and cannot be turned off there.

## The simple exercise page and log popup

At the first two levels, the exercise page (`(today)/exercises/[id]`) is the
"I practised this" page:

- What it is, in the type's words (the type's `Content`), its video in the
  simple player.
- "From class Tue 3 Nov ›" opening the simple lesson page, when it has one.
- The Comments card (part 3).
- The pinned button says **"I practised this"** and opens the log popup.
- At the very end, part 1's quiet "Not today".

Hidden: Edit settings, Active, archive, SourceTabs, Make it mine, the owner row
linking to a figure or routine page, the Add block, History tiles and the set
list (the last time stays as the popup's "Last time 4 days ago").

The log popup at the first two levels keeps the four faces and drops the rest:
minutes, reps and the note are not drawn, and the practice panel (count,
clave, song) stays only for a type whose practice needs it. "Log set" becomes
"Done". **(My call: the note is gone at both levels; easy to bring back at
Practise and keep my own.)**

## Settings

A "How much app?" row at the top of Settings opens the three cards (the same
component as the first run, the current one ticked). Saving writes
`users.level` and goes back to Settings; the tabs change at once.

At Follow my class, Settings shows only: How much app?, Exercises a day, the
daily reminder, theme, name, paired phones, sign out, and for the admin the
Admin row (their only way to `/admin`, kept at every level). (Storage, the
count voice, Get the app and the app's version row are not drawn.)

You (`YouSettings.svelte`) carries the rows changed most: How much app?, Exercises
a day, My count (not at Follow my class, as above), Theme and the daily reminder,
each posting to Settings' own actions, then All settings. Settings' ‹ goes back
to You (`youPath`), and so does My count's when opened from You.

## Desktop

Everything above applies from 1024 px with the desktop frame:

- The Side draws `tabsFor(level)`.
- My class with one class: the class page with no list column. With several:
  the list of classes as the list column beside the open class.
- The simple lesson page uses the existing two columns: notes and the practice
  list in one, videos in the other. The simple player's desktop layout is the
  real desktop layout with the same simple chrome.
- A class's lesson at Follow my class sits where its class does: beside the
  list of classes (its class lit) with two or more, alone with one. It is the
  Lessons route, so the Lessons layout draws My class's list there
  (`server/my-class.ts`, shared with the Groups layout), never the Lessons list
  with New lesson and sizes. Beside a list column the pane is narrower than
  the two-column breakpoint, so the lesson is one column there, as every
  lesson beside a list is.
- At Practise and keep my own the Lessons list column stays; its rows show the
  date, the title, the group and "2 videos", without the size or the section,
  routine and figure counts, and the band has no "Videos on disk" line.
- The welcome pages are `CardFrame`, as on the phone.

## Calls made (mine, check them)

- The level is per person, not per dance.
- Existing accounts become Everything; only new accounts see the first run.
- Auto-add's default: on for the two lower levels, off at Everything, so
  nothing changes for the people already using the app.
- Auto-add adds the default picks (lesson, routines, drills; not figures).
- At Practise and keep my own, Add adds the default picks at once (no Add sheet).
- Group mode only at Everything.
- The log popup at the two lower levels is faces only, button "Done".
- A class code field (first run, My class, Groups) is new; the code is
  normalised like `teamByCode`.
- Levels hide links, never routes.

## Decided by the user (2026-11-05)

1. **Two classes at Follow my class:** a list of classes, then the class.
2. **On joining:** only the newest lesson goes to Today; the older ones can be
   added by hand.

## Decided while building

The plan's rulings and the builders' calls, kept here so the text above reads
as built.

1. **Null is drawn as Everything.** `levelShown(null)` is `'all'`: a person who
   has not chosen yet (only ever seen by the first-run gate) and a page with no
   user draw today's app, so no component writes `?? 'all'` itself.
2. **Group mode is dropped below Everything.** `groupModeOf` refuses and
   deletes the group-mode cookie at Follow my class and Practise and keep my
   own, so someone who moves down while in group mode does not keep writing new
   lessons and songs into the group. Callers that have `locals.user.level`
   (the dance layout, `spaceOf`) pass it in; the rest read it.
3. **Settings at Follow my class** also leaves out Get the app and the app's
   version row (Today's "Update available" and the full-screen Update needed
   still cover updates). The Admin row stays for the admin at every level: it
   is their only way to `/admin`.
4. **Joining a class is `joinClass`** (`server/auto-add.ts`): `joinTeam` and,
   on a new join, auto-add's newest lesson, in one transaction. The code field
   (`joinWithCode`), the first run's join and `/g/<code>` all go through it.
   Leaving and joining again is a new join, so it runs again.
5. **Growth is what `newInLesson` can return** (ruling R7): `linkRoutine`,
   `linkExercise`, `linkInSpace` (a drill linked to a section of a lesson
   video) and `syncFrom` (a lesson Take or Send). Figure links and routine
   slot or embed edits never feed it. `autoAddPending` runs only for the
   lessons that grew. A member who turns the switch on gets that lesson's
   earlier unseen items the next time it grows (`newInLesson` reads since
   `seen_at`). Restoring a trashed drill link on a class lesson's section runs
   `autoAddPending` for that lesson (`restoreTrash`), as `linkInSpace` does;
   `reviveEntries` also brings back the entries archived with it.
6. **My class's landing is the tab's, not a wall** (ruling R3): at Follow my
   class with one class the groups index redirects to it; every group page
   still opens by URL at every level.
7. **A teacher keeps full pages.** `simpleLesson` is false for a lesson the
   person edits, and `simpleClass(level, role)` false for an editor or the
   owner: a teacher at Follow my class keeps the full group page (drafts, New
   lesson, the code); the tab's landing and the list of classes are the same
   for them. Whoever is in one class at Follow my class, whatever their role,
   gets no ‹ on its page (its fallback, the tab, would open it again).
8. **An own lesson is read-only at Follow my class** (it creates nothing): no
   Edit, upload or links, and no lesson menu.
9. **Undo stays on the page.** The lesson page's Remove takes an optional
   `stay=1` and then answers instead of redirecting to Lessons; the simple
   lesson page's and My class's "Added to Today · Undo" both post it. Older
   pages never send it.
10. **When it is next on Today**, beyond the ruled words: one day is "On Today
    tomorrow", two to six "On Today on Sunday", seven to thirteen "On Today next
    week", later "On Today on 19 Nov" (with the year when it differs), and a
    paused entry "Paused". An empty practice list draws no section.
11. **"4 to practise"** is what Add puts on Today (`addOffer`'s ticked items:
    the lesson, its routines and drills), a zero part left out. The Class menu
    says "Leave class".
12. **Add below Everything is one tap** (`addsAtOnce`, follow and own). At
    Practise and keep my own the group page's Add flips the row to "Added ✓"
    without a toast, and the lesson's "N new" banner adds at once (no sheet).
13. **The first run.** A join with a plain `next` lands on `next`, not the
    class's dance (step 4's order). The swipe reuses `gestures/swipe.ts`.
14. **The simple exercise page.** "From class" is `fromClassOf`: a lesson
    review's lesson, an added drill entry's or a group drill's add-route
    lesson. Each type keeps its own practice panel; the popup keeps Details.
15. **The simple player.** In a section the repeat is lit and locked. The
    portrait body falls back as it always did when no section is open
    (`portraitBody`'s `spot`), so the full player's Hide is unchanged.
16. **The desktop** is as in "Desktop" above: a class's lesson beside My
    class's list, and no sizes or counts in the Lessons rows below Everything.
17. **Rejoining re-adds the newest lesson** even if the person had removed it
    (`removeLesson`): leaving and joining again is a new join (item 4), and a
    join adds the newest published lesson. Publish and growth never re-add a
    removed lesson, since both only touch lessons with a `lesson_adds` row.
18. **A class's lesson lights My class at Follow my class** (ruling R13,
    `litAt`): every route to it comes from My class or Today, and on the
    desktop it sits beside My class's list. A person's own lesson still lights
    none.
