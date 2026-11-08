# What the app does, and which spec to read

Moved out of CLAUDE.md on 2026-11-08. When a feature ships, add it to "What is live" and its spec to "Specs" here, not to CLAUDE.md.

## What is live

Live: phase 1 (Today/Exercises, figures with recordings, custom exercises),
phase 2a (song library, the home worker, the beat grid), phase 2b (the
player: voice count, clave, count-only runs, and a finished run logged as a
set), phase 3a (positions, the figure graph, the gap report), phase 3b
(routines: slots, variants, one-level embedding, and the player walking one),
phase 4 (lessons: videos, notes, figure, routine and exercise links, and a
four-band Today), multi-dance (bachata beside salsa: the
registry, the `dance` column, `/[dance]/` routes, two home-screen apps) and
exercise types (links with YouTube embeds, a practice panel on the exercise
page, an exercise page) and figure timing (a start count and a
length in counts; routines report timing breaks) and figures and moves (a
move is a name holding self-contained figures; Move to… another move or a new
one; switcher at the bottom; a move's page)
and figure coverage (figures have no exercise by default; a page of figure
versions by how many routines use them, and a routine made from a selection),
a full-screen video player (three levels — full video, a section's own
looping view, an editor — with 0.1 s steps, a drag-and-nudge trim strip,
delete that asks and undoes, Back up one level, pinch zoom, double-tap jumps,
the screen kept on, and portrait (built for upright videos: Hide, a row of
sections), landscape and desktop layouts; 0.25–1×, mirror, saved points and
sections), and the inline video with our own controls: play, the time, a seek
bar with the sections, and the routine editor
(drag to reorder, swipe to delete, seams that build where a routine does not connect, a picker that offers
what fits, a long-press selection with Make routine) and saved YouTube videos
(Save video on a figure's or lesson's YouTube link: the home worker downloads
it at 480p and the link becomes a recording or lesson video, spots and all)
and section links (a section of a lesson video or recording linked to a figure
version or a drill, shown as a card that loops it; a linked section and its
video refuse to delete) and one picker for every list (search, figure headings, tap to pick, + to
keep going) and the Link popup (link a section, or create the
variation, figure or drill it shows, from the lesson page or the player; a
lesson includes what its videos' sections link to) and the redesign (the band and five tabs: Today, Moves, Lessons,
Music, You (since 2026-11-07 the Groups tab, with a short list of settings; at Follow my class Today, My class, You); one look in four themes from `tokens.ts`; the shared components in `components/ui/`;
designed error pages) and accounts (one-time invites from the admin, a person's own private app, a storage limit with What uses space and Ask for more, an admin page) and groups (a Groups tab; a class makes a group and people join by its code or
`/g/<code>`; lessons are drafts until published; Add copies a published lesson's
drills into a person's own practice, with per-person entries; a clash check on
shared edits; History; Recently deleted for 30 days; the group's own storage;
Make my own copy, since Make it mine; names) and group follow-ups (group mode: a Mine / group switch that
shows only that side's Moves, Lessons and Music and makes new rows there, in the
group's own navy look; notifications: a dot on Groups, "N new" pills and "New"
markers, cleared by opening; class songs: a teacher shares a song with the group,
members practise to it, a section per group in Music) and app updates (a Get the app page for friends, release-signed apps that update themselves, open pages that reload when the site changes)
and clones and twins (a gene id and cloned-from on every copyable row; Copy
to…, Edit makes your copy, Drop my copy, Detach, Move to…
a group; your own routines, lessons and sections use a group's things without
copying; leaving keeps copies; Same as… shows twins as one; see
[`docs/superpowers/specs/2026-11-03-clones-and-twins-design.md`](docs/superpowers/specs/2026-11-03-clones-and-twins-design.md)) and keeping copies in step (Keep in step: a per-copy switch with four options, so a save goes through the club's copy to the others by itself; one Sync sheet in place of Compare, Take and Send mine; a notice on the page, an out-of-sync card on the Moves lists, "Basic · Sreda 17:30" for same-named copies; see
[`docs/superpowers/specs/2026-11-07-clone-sync-design.md`](docs/superpowers/specs/2026-11-07-clone-sync-design.md)) and the dance split (two apps on one backend: an account belongs to one dance,
`salsa.anotherroot.eu` and `bachata.anotherroot.eu`, each with its own login,
invites, admin, storage, settings and My count; see
[`docs/superpowers/specs/2026-11-06-dance-split-design.md`](docs/superpowers/specs/2026-11-06-dance-split-design.md))
and positions as their own things (owned like figures, with copies and twins;
optional: nobody starts with any and a figure without one fits anywhere; any
number of starts and ends; a type and a hold; a page, Templates, How positions
work, Gaps and a map you tap and walk to make a routine; links from sections, points and lessons; see
[`docs/superpowers/specs/2026-11-04-positions-design.md`](docs/superpowers/specs/2026-11-04-positions-design.md))
and Today as a number a day (four faces on every logged set, an Anki-style gap
replayed from the sets, "Exercises a day", Next N, Coming up, Not today with Undo;
see
[`docs/superpowers/specs/2026-11-05-today-scheduling-design.md`](docs/superpowers/specs/2026-11-05-today-scheduling-design.md))
and run the day, plan 1 (slower gaps; Comes back on a drill, by how it went or on
a fixed rhythm; Warm-up, its own list first on Today and outside the daily
number; Today's lists "Warm-up · N" and "Practice · N"; no lateness anywhere)
and run the day, plan 2 (one exercise page per type, with Practise with, a drill's
Recordings and a pinned Done; the Done sheet with four faces and their gaps; one
entry per exercise per day (`saveDay`) with a toast and Undo; the log popup gone;
an interim session, `?session=1`; plan 3, the run, is not built; see
[`docs/superpowers/specs/2026-11-07-run-the-day-design.md`](docs/superpowers/specs/2026-11-07-run-the-day-design.md))
and levels (how much app a person sees: Follow my class, Practise and keep my
own, Everything; a first run that asks, with a class code; class lessons that
come to Today by themselves; My class; a simple lesson page, video player,
the one exercise page; see
[`docs/superpowers/specs/2026-11-05-levels-design.md`](docs/superpowers/specs/2026-11-05-levels-design.md))
and comments on a class's lessons (a card at the end of the lesson and the
exercise page, a tall sheet with replies one level deep, hearts, Teacher, delete
with Undo, "N new"; see
[`docs/superpowers/specs/2026-11-05-lesson-comments-design.md`](docs/superpowers/specs/2026-11-05-lesson-comments-design.md))
and Slovenian (the whole app in English or Slovenian per account: every page, sheet,
toast, refusal and error page, the admin and the Android app's own text (version 1.8);
the language on the invite, Join, the cookie before sign-in, a Settings switch and the
admin's per person; machines keep English (the worker's queue, the media servers,
`/releases`, `/api/app-update`, the 426); see
[`docs/superpowers/specs/2026-11-07-slovenian-design.md`](docs/superpowers/specs/2026-11-07-slovenian-design.md))
and the song page (a minimal listening view: the section playing and what comes next;
Edit, saving as you go with Undo: the whole song's count as a grid, hold a beat for its
menu, suggestions from the downbeats, sections counted or not, the Song tab; a song starts
where its music starts, measured by the worker; see
[`docs/superpowers/specs/2026-11-08-song-page-design.md`](docs/superpowers/specs/2026-11-08-song-page-design.md))
and a group's + and one figure form (a group page's lessons by month; the band's + opens
Add to the group: Lesson and Drill made there, Music, Figure, Routine and Position by
switching into the group; every New figure takes its move from one Move field that can
also make a new move (`PickerField`'s create, `moveFromQuery`); see
[`docs/superpowers/specs/2026-11-08-group-add-and-one-figure-form-design.md`](docs/superpowers/specs/2026-11-08-group-add-and-one-figure-form-design.md)).


## Specs

The design lives in
[`docs/superpowers/specs/2026-09-22-salsa-app-design.md`](docs/superpowers/specs/2026-09-22-salsa-app-design.md) —
read it before adding anything, and keep it current when the design changes.
It carries a "Known gaps" list for the player; check it before hunting a bug
that is already known. The count voice has its own spec,
[`docs/superpowers/specs/2026-09-23-count-voice-design.md`](docs/superpowers/specs/2026-09-23-count-voice-design.md):
count patterns, and the user's own voice recorded as half-bar phrases. Lessons
have theirs,
[`docs/superpowers/specs/2026-09-23-lessons-design.md`](docs/superpowers/specs/2026-09-23-lessons-design.md):
the chunked upload protocol, the link rules, and the four Today bands.
Exercise types have theirs,
[`docs/superpowers/specs/2026-09-28-exercise-types-design.md`](docs/superpowers/specs/2026-09-28-exercise-types-design.md):
the per-type exercise page content, links, and the practice panel (since 2026-11-08 the log popup is gone; the page and its Done sheet replace it).
The routine editor has its own,
[`docs/superpowers/specs/2026-10-01-routine-editor-design.md`](docs/superpowers/specs/2026-10-01-routine-editor-design.md):
the main figure, the start rule for alternatives, the picker's anchors, and the
gestures.
The full-screen video player has its own,
[`docs/superpowers/specs/2026-10-01-video-player-design.md`](docs/superpowers/specs/2026-10-01-video-player-design.md):
spots, the loop, and why it is not the browser's fullscreen.
The Android app has its own,
[`docs/superpowers/specs/2026-10-14-android-app-design.md`](docs/superpowers/specs/2026-10-14-android-app-design.md):
one app per dance (flavors, since 2026-10-30), the site in a WebView (not a TWA since 2026-10-29), background
compress-and-upload, the daily reminder,
and device tokens. Built, not yet deployed or tried on the phone.
Saved YouTube videos have theirs,
[`docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`](docs/superpowers/specs/2026-10-15-youtube-video-save-design.md):
the second worker queue, why it is not a kind of song job, and the chunked
upload the worker shares with lesson videos (`writeChunk` in `files.ts`).
Section links have theirs,
[`docs/superpowers/specs/2026-10-15-video-section-links-design.md`](docs/superpowers/specs/2026-10-15-video-section-links-design.md):
why a link points at a saved spot, per version, and why a linked section blocks
its video's delete.
One picker for every list has its own,
[`docs/superpowers/specs/2026-10-30-unified-pickers-design.md`](docs/superpowers/specs/2026-10-30-unified-pickers-design.md):
the rules every picker follows, linking pickers and field pickers, the near
group, and the Link popup as levels.
The Link popup has its own,
[`docs/superpowers/specs/2026-10-29-section-link-popup-design.md`](docs/superpowers/specs/2026-10-29-section-link-popup-design.md):
why a lesson's figures are derived from its sections rather than copied, and
create-and-link in one transaction.
Figures as variations have theirs,
[`docs/superpowers/specs/2026-10-29-figures-are-variations-design.md`](docs/superpowers/specs/2026-10-29-figures-are-variations-design.md):
the `figure_groups` table, self-contained variations, Move to…, and the figure
page's one-variation-per-URL layout.
The song page has its own,
[`docs/superpowers/specs/2026-11-08-song-page-design.md`](docs/superpowers/specs/2026-11-08-song-page-design.md):
listening and Edit, saving as you go (the redesign's one exception), sections as
seconds snapped to the 1s, suggestions, where the music starts, and what was decided
while building.
Song samples and the song popup have theirs,
[`docs/superpowers/specs/2026-10-30-song-samples-design.md`](docs/superpowers/specs/2026-10-30-song-samples-design.md):
where a 15 s sample starts (stored raw, snapped to a 1 on read), one sample at
a time, the searchable popup in place of the song `<select>`, and Back closing
the top sheet.
The look and the five tabs have theirs,
[`docs/superpowers/specs/2026-10-31-redesign-design.md`](docs/superpowers/specs/2026-10-31-redesign-design.md):
the colour tokens in four themes, type, icons, the shared components, the band,
and the Today / Moves / Lessons / Music / You tab bar. The design board it comes from
is in `docs/superpowers/design-kit/`.
Accounts have theirs,
[`docs/superpowers/specs/2026-11-02-accounts-design.md`](docs/superpowers/specs/2026-11-02-accounts-design.md):
the owner wall, one-time invites and Join, the storage limit and what counts
against it, What uses space, Ask for more, and the admin page. Since the dance
split an account belongs to one dance; that spec says so first.
The dance split has its own,
[`docs/superpowers/specs/2026-11-06-dance-split-design.md`](docs/superpowers/specs/2026-11-06-dance-split-design.md):
why each dance is its own app with its own accounts, the host map, the wall,
splitting the accounts that held both dances at boot, invites and the admin per
dance, and the two hosts.
Groups have theirs,
[`docs/superpowers/specs/2026-11-02-groups-design.md`](docs/superpowers/specs/2026-11-02-groups-design.md):
the group as a wall beside the person, draft and publish, what a member
reaches, Add and entries, the clash check, the safety net (History, Recently
deleted), leaving and deleted groups, Make my own copy (now Make it mine), the group's storage.
Clones and twins have theirs,
[`docs/superpowers/specs/2026-11-03-clones-and-twins-design.md`](docs/superpowers/specs/2026-11-03-clones-and-twins-design.md):
families of copies (one member per place), Compare, Take and Send with pair
snapshots (replaced by Sync, below), Drop my copy, Detach, Copy to… and Move to…, using a group's things
from your own rows, leaving and Keep, the rescue, twins, and what was decided
while planning and building. It replaces the groups spec's reading after
leaving and its Make my own copy.
Keeping copies in step has its own,
[`docs/superpowers/specs/2026-11-07-clone-sync-design.md`](docs/superpowers/specs/2026-11-07-clone-sync-design.md):
Keep in step (the switch and its four options), the flow after a save, one Sync
sheet and Update from a club, the notice, the Moves card, same names, two people
at once, and what was decided while building. It replaces the clones spec's
Compare, Take and Send and its names rule.
Positions have theirs,
[`docs/superpowers/specs/2026-11-04-positions-design.md`](docs/superpowers/specs/2026-11-04-positions-design.md):
owned positions, no position fits anywhere, any number of ends, comparing by
family (and twins as one in the graph), the hold, templates, the links, the
screens and the map, the one-time move at boot, and what was decided while
planning and building. It replaces the routines spec's neutral position and
single end.
The desktop has its own (built: the frame and the area pages),
[`docs/superpowers/specs/2026-11-03-desktop-design.md`](docs/superpowers/specs/2026-11-03-desktop-design.md):
from 1024 px, one short band row and a band-coloured side with the tabs, a
list and the opened item side by side, two-column figure and lesson pages, and
every bottom sheet as a centred dialog.
Whose version and the ⋯ menu have theirs,
[`docs/superpowers/specs/2026-11-06-versions-and-menu-design.md`](docs/superpowers/specs/2026-11-06-versions-and-menu-design.md):
the row at the top of a family page (option D), the Versions list, and one shared
⋯ in the band holding a page's own items and the copy actions
(`src/lib/clones/versions.ts` and `menu.ts` are its PURE words and order).
Today as a number a day has its own,
[`docs/superpowers/specs/2026-11-05-today-scheduling-design.md`](docs/superpowers/specs/2026-11-05-today-scheduling-design.md):
the four faces, the replayed gap and its numbers, the day's list from the start
of the day, Next N, Not today and Undo, Coming up, the reminder, and what was
decided while building.
Run the day has its own,
[`docs/superpowers/specs/2026-11-07-run-the-day-design.md`](docs/superpowers/specs/2026-11-07-run-the-day-design.md):
the slower gaps, Comes back (by how it went, every day until it feels good, a
fixed rhythm; a teacher's for the class), Warm-up, Today's two lists, no
lateness, and the exercise page, Done sheet and run still to come.
Levels have theirs,
[`docs/superpowers/specs/2026-11-05-levels-design.md`](docs/superpowers/specs/2026-11-05-levels-design.md):
the three levels and what each draws, the first run, tabs per level, auto-add
(on publish, on join, on growth), My class, the simple lesson page, player,
exercise page, Settings, the desktop, and what was decided while
building. Levels hide entry points, never routes.
Comments have theirs,
[`docs/superpowers/specs/2026-11-05-lesson-comments-design.md`](docs/superpowers/specs/2026-11-05-lesson-comments-design.md):
who reads and writes, the soft delete, hearts, "N new" from an `opens` row, the
card, the sheet, the keyboard, the API, and what was decided while building.
Slovenian has its own,
[`docs/superpowers/specs/2026-11-07-slovenian-design.md`](docs/superpowers/specs/2026-11-07-slovenian-design.md):
the register (vikanje), the glossary, plurals, dates and numbers, where the language
lives (account, invite, cookie), how the words are organised, and the order of work.

