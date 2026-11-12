# What the app does, and which spec to read

Moved out of CLAUDE.md on 2026-11-08. When a feature ships, add it to "What is live" and its spec to "Specs" here, not to CLAUDE.md.

## What is live

Live: phase 1 (Today/Exercises, figures with recordings, custom exercises),
phase 2a (song library, the home worker, the beat grid), phase 2b (the
player: voice count, clave, count-only runs; since 2026-11-08 a run logs
nothing, Done on the exercise page does; since 2026-11-10 the voice and clave allow for
Bluetooth headphones: Sound delay in Voice), phase 3a (positions, the figure graph, the gap report), phase 3b
(routines: slots, variants, one-level embedding, and the player walking one),
phase 4 (lessons: videos, notes, figure, routine and exercise links, and a
four-band Today), multi-dance (bachata beside salsa: the
registry, the `dance` column, `/[dance]/` routes, two home-screen apps) and
exercise types (links with YouTube embeds, a practice panel on the exercise
page, an exercise page) and figure timing (a start count and a
length in counts; routines report timing breaks) and flexible figures (a figure can start on
several counts and have its length set per routine slot: tap the counts on the figure, How long?
when adding it to a routine, a length chip on the slot; each slot starts where the one before leaves
off; spec
[`docs/superpowers/specs/2026-11-11-flexible-figures-design.md`](docs/superpowers/specs/2026-11-11-flexible-figures-design.md)) and a slot's end (a figure with several
ends gets one chosen per routine slot, like its length: a chip on the slot, Where does it end? after
adding it, decided by the slot below when that starts in one of them; the slot's line shows only where
it ends; Back closes an open slot or a selection first; spec
[`docs/superpowers/specs/2026-11-11-slot-end-design.md`](docs/superpowers/specs/2026-11-11-slot-end-design.md)) and figures and moves (a
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
shows only that side's Moves, Lessons and Music and makes new rows there, since 2026-11-09 the
group view below; notifications: a dot on Groups, "N new" pills and "New"
markers, cleared by opening; class songs: a teacher shares a song with the group,
members practise to it, a section per group in Music) and app updates (a Get the app page for friends, release-signed apps that update themselves, open pages that reload when the site changes)
and clones and twins (a gene id and cloned-from on every copyable row; Copy
to…, Edit makes your copy, Drop my copy, Detach, Move to…
a group; your own routines, lessons and sections use a group's things without
copying; leaving keeps copies; Same as… shows twins as one; see
[`docs/superpowers/specs/2026-11-03-clones-and-twins-design.md`](docs/superpowers/specs/2026-11-03-clones-and-twins-design.md)) and keeping copies in step (Keep in step: a per-copy switch with four options, so a save goes through the club's copy to the others by itself; one Sync sheet in place of Compare, Take and Send mine; a notice on the page (while a phone's change is on its way, only a quiet "Sending to 2 copies…" on the version row), an out-of-sync card on the Moves lists, "Basic · Sreda 17:30" for same-named copies; see
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
and run the day, plan 1 (slower gaps; Comes back on any exercise since 2026-11-09, a drill only before; by how it went or on
a fixed rhythm; Warm-up, its own list first on Today and outside the daily
number; Today's lists "Warm-up · N" and "Practice · N"; no lateness anywhere)
and run the day, plan 2 (one exercise page per type, with Practise with, a drill's
Recordings and a pinned Done; the Done sheet with four faces and their gaps; one
entry per exercise per day (`saveDay`) with a toast and Undo; the log popup gone;
an interim session, `?session=1`; see
[`docs/superpowers/specs/2026-11-07-run-the-day-design.md`](docs/superpowers/specs/2026-11-07-run-the-day-design.md))
and run the day, plan 3 (the run: Start on Today walks the day's exercises page by
page, `?run=1&skip=…`, warm-ups first, with Skip | Done, "3 of 7" and "Next: …"
in the Done sheet; Done for today at `/[dance]/done`; the hero's time estimate;
the player's Back keeps the run; on the desktop the exercise Today opens by itself
waits for a tap before its clock counts; plans 1, 2 and 3 are all built)
and past days (a day reads like Done for today: tiles, one row per exercise that opens its
Done sheet, Add an exercise to this day; a day strip ‹ day › with Today, and a calendar of
months with each day's count; see
[`docs/superpowers/specs/2026-11-09-past-days-design.md`](docs/superpowers/specs/2026-11-09-past-days-design.md))
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
where its music starts, measured by the worker; the part before the main beat counts in
5 6 7 8 on the coming tempo; see
[`docs/superpowers/specs/2026-11-08-song-page-design.md`](docs/superpowers/specs/2026-11-08-song-page-design.md))
and a group's + and one figure form (a group page's lessons by month; the band's + opens
Add to the group: Lesson and Drill made there, Music, Figure, Routine and Position by
switching into the group; every New figure takes its move from one Move field that can
also make a new move (`PickerField`'s create, `moveFromQuery`); Edit asks no move name; the
groups' figures, routines and positions mixed in among yours on the Moves lists, a group's
figures under your move of the same name, each marked with its group as on Lessons
(`GroupMark`, 2026-11-09); thin scrollbars in the app's colours; the page never pinch- or double-tap-zooms, as a native screen (`app.html` viewport, `touch-action` on html; a video and the map zoom inside themselves, 2026-11-09); see
[`docs/superpowers/specs/2026-11-08-group-add-and-one-figure-form-design.md`](docs/superpowers/specs/2026-11-08-group-add-and-one-figure-form-design.md))
and Spotify links and playlists (a Spotify song link in Add a song is found on YouTube by the
home worker; "Audio from" and Use another YouTube link on a song, reaching its copies kept in
step; a YouTube or Spotify playlist or album is read by the worker into a pick list under
"To pick", a dot on Music, and only the ticked songs download; see
[`docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md`](docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md))
and the app offline (offline phases 1–3: ids from slots and one server clock;
the server logs every change, a device pulls its person's copy into SQLite on the phone, and
SvelteKit's own server code answers from it, online too (device first, 2026-11-10: opening a
page never waits on the network; the pull every 5 min, on focus, on reconnect and after a save
keeps the copy fresh and re-reads the open page when it brought changes; pull down to refresh
on the phone says "Pull to sync" in the band; when it last synced and Sync now sit in the
phone's Settings (with the tip that a pull does the same) and above Settings on the desktop's
side (last-synced, 2026-11-10, looks A and E); Settings reads the network first; see
[`docs/superpowers/specs/2026-11-10-device-first-design.md`](docs/superpowers/specs/2026-11-10-device-first-design.md)); a change made with no
signal saves on the phone and syncs later, dated when it was made: an amber strip above the
bottom bars says "Offline · 5 changes waiting" (then "Sending 5 …", "All sent"), the band
"1 couldn't sync ›", a Sync page with Retry and Discard, a Waiting badge on
queued group things, and what needs a connection greyed; songs and the count play with no signal
(the phone keeps every song's audio by itself); lesson videos and recordings kept on the phone
(Settings → On this phone, its own page: a switch per space, My lessons and each group, keeps all
its lessons' videos, Only on Wi-Fi where the phone says which, Clear kept videos; a phone button
under any video keeps that one; downloads resume where they were cut off; short of space, a sheet
once and a dot on You; see the phase 4 spec's 4b); your own videos only on the phone (4c part 1,
on an iPhone or a phone's browser: a new video on your own figure or lesson stays there as the
original, Where is this video offers Upload and Remove the server copy, another device shows a
dark frame "On Pixel 8", an iPhone warns once with a card; copies leave them behind, but Move to… uploads the ones on
this phone first and then moves the lesson with them (look B, 2026-11-11); recordings
upload in chunks up to 1 GB; in the Android app 1.10 the original stays in the gallery and the app
serves and uploads it); phase 5 (2026-11-10) took the old Offline screen away: with no signal
and no copy on the phone yet, a link stays on its page and a toast says the page needs a
connection; see
[`docs/superpowers/specs/2026-11-07-offline-design.md`](docs/superpowers/specs/2026-11-07-offline-design.md)
and [`docs/superpowers/specs/2026-11-09-offline-phase-3-design.md`](docs/superpowers/specs/2026-11-09-offline-phase-3-design.md)).
and the group view (2026-11-09: the group's look follows where you are, not a switch: a page
of one thing of a group you own or edit is in that group's view however you reach it, a list
carries `?in=<team>` and every forward step keeps it, Back gives back the view; Mine opens
your own copy of what is open; the dance's colours with the group's row at the top of the
band, the badge in the slim band, the tab bar filled with the band's colour and the desktop
side's cream card; navy and the group cookie are gone; a group drill shows the view while
edited; see
[`docs/superpowers/specs/2026-11-09-group-view-design.md`](docs/superpowers/specs/2026-11-09-group-view-design.md)).
and Send feedback (2026-11-10: a row on You and on Settings opens a sheet with one text box; the
message goes to the dance's admin with the page before the one it was written from, the last few pages
and script errors of the tab, the site's build, the window, and the Android app's version and the
browser from the request; the admin page lists them first, each with Done (and Open again under
"Done (N)"), and Settings' Admin row says "N new messages"; table `feedback`, migration 0047, never
synced, network-only: offline the Send button says it needs a connection; since 2026-11-10 also a
screenshot: a tile at the top of the sheet (option S1 of the board
https://claude.ai/artifact/LDr9EG7QwBJx6damw4eg4x) takes a picked picture, redrawn as a JPEG of at most
1280 px, and after a screenshot in the Android app (1.9, Android 14+: `SalsaShot`) a card over the
bottom bars, "Something wrong here?" (option C), opens the sheet over that page with the screenshot on
it; kept in `$DATA_DIR/feedback`, migration 0048, shown on the admin card and whole on a tap).

Which build runs (2026-11-10): Settings ends in an About section (option A of the board
https://claude.ai/artifact/4gDJQQef4aJuydeujgEUoy) with the website's version, the commits behind its
build (`$lib/build-info`, `__SITE_VERSION__` from vite.config.ts), and its build time in the person's
zone, from the page's own bundle, so a phone still on an older build shows it; inside the Android app a
second row, the installed version (`1.9 (10)` when it is the current release) and the day its APK went
up (`releasedAt`, the APK's time on disk). The Android section keeps its version row only while an
update waits. `/health` says the version too, and `deploy.sh` ends by printing what is live.

Can you find the 1? (2026-11-11, hearing drills phase 1): a card on a song's page opens the listening
player (`/[dance]/songs/[id]/listen`) on a song a person counted (anchors set; the computer's guess alone
never grades anyone). Tap along (the whole song or one part, the count hidden) or Dropped in (up to ten
random spots, tap the next one), listening for the 1, every beat, 1 · 5, 1 3 5 7, 4 · 8, the clave or your own counts (any of 1–8, kept in
this browser); a target of several beats is tapped for two eights per drop; a
one-time tap delay check per browser (`hearing.tapDelayMs`). Phase 1b (2026-11-11): the target drawn as circles on
the eight that taps fill in order with no hint of how close; a drop is the first tap's eight and the next; a spot
starts over after four eights without a tap, after a long gap, or on Reset, and Skip shows after three
start-overs; colours only when a drop ends, then the next spot slides in; result B with a 0–100 score (timing,
less restarts and listening), every tap stacked under its circle, one sentence on what to work on, and ▶
replay per drop; the clave card with Hear it in the setup. Phase 1c (2026-11-11): a drop is two full
eights from the first tap, judged in the person's own count (the shift from the first tap keeps 100 / 50 / 25 / 10 %
for right / 4 / 2 / 1 off; a reversed clave is 4 off), ends right after its last beat, shows blue circles with "you
N" for a wrong count and a mark where each tap fell (look A), Count on the score card; the music fades between
spots. Nothing is saved yet: the hearing drill as an exercise type is phase 2. Spec
[`docs/superpowers/specs/2026-11-10-hearing-drills-design.md`](docs/superpowers/specs/2026-11-10-hearing-drills-design.md),
boards https://claude.ai/artifact/WBkgBLMuE8ADXoqgLgtfou and https://claude.ai/artifact/Wdspg2ZuajQvwVgAfvdB9N (1b).


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
gestures; an open slot and the selection lift out of the list since 2026-11-11,
[`docs/superpowers/specs/2026-11-11-routine-lift-design.md`](docs/superpowers/specs/2026-11-11-routine-lift-design.md).
Sections, nesting at any depth and the calmer editor (2026-11-12) — a slot holds one
figure, section or routine (alternatives are gone); select slots and tap Section;
Unpack, Detach here, Make routine and Turn into a section; panels opened in place
with a "where am I" bar; selection that never moves a card; Duplicate that glows;
the Routines list as start → end · figures · eights —
[`docs/superpowers/specs/2026-11-12-routine-sections-design.md`](docs/superpowers/specs/2026-11-12-routine-sections-design.md).
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
Linking from other places has its own,
[`docs/superpowers/specs/2026-11-10-link-from-other-places-design.md`](docs/superpowers/specs/2026-11-10-link-from-other-places-design.md):
a group lesson's pickers and the Link popup on a group's video find, while
searching, your own rows and your other groups' (read-only ones marked); a
tap opens a card (what comes along, what stays behind) and Copy and link
copies the row into the group as a clone and links it, in one transaction.
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
lateness, the exercise page, the Done sheet and the run (Start, Skip, Done for today,
the estimate): all three plans are built.
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
Spotify links and playlists have theirs,
[`docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md`](docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md):
a Spotify song found on YouTube (the match rules, no list of matches), where the audio came
from and swapping it (copies kept in step follow; the count, sample, sections and start stay
with their audio), the pick list (option A2), the imports queue and the Music dot. Its mockups
are in `2026-11-08-spotify-mockups/`.
The AI connector has its own,
[`docs/superpowers/specs/2026-11-09-ai-connector-design.md`](docs/superpowers/specs/2026-11-09-ai-connector-design.md):
an MCP connector any AI app can add (OAuth with Client ID Metadata Documents or
registration), reading what the person may read; every change the AI wants as an action
in a queue the person runs in the app (groups, dependencies, the AI edits its pending
queue), the queue's look (option A of its board), and the video sections experiment.
Plans 1 (the connector and reading), 2 (the queue and the Suggestions page) and 3 (the video
sections experiment: `videos` and `video_timeline`, frames every 2 s and the sound prepared by
the home worker, `scripts/ai-sections/measure.ts` to compare the AI's sections with the
person's) are built.
Slovenian has its own,
[`docs/superpowers/specs/2026-11-07-slovenian-design.md`](docs/superpowers/specs/2026-11-07-slovenian-design.md):
the register (vikanje), the glossary, plurals, dates and numbers, where the language
lives (account, invite, cookie), how the words are organised, and the order of work.
One player has its own,
[`docs/superpowers/specs/2026-11-08-one-player-design.md`](docs/superpowers/specs/2026-11-08-one-player-design.md):
one practice player (the full page) that logs nothing; Practise with on the exercise
page opens it; the band that fills the phone; Routine, About and Voice as rows that
open full-screen layers; a routine run without calls (Follow or Still, the
full-screen list, a figure's details from it); the time across the trip to the
player; and what was decided while building.
The Practise card has its own,
[`docs/superpowers/specs/2026-11-09-practise-card-design.md`](docs/superpowers/specs/2026-11-09-practise-card-design.md):
one card on every exercise, lesson included (Practise with, Change to Setup, ▶ Practise
playing at once); a Setup change shows on the card after Back; a lesson's About in the
player; a video played with sound in About pauses the music until Resume.
The app on the device has its own,
[`docs/superpowers/specs/2026-11-07-offline-design.md`](docs/superpowers/specs/2026-11-07-offline-design.md):
why offline, the local runtime (SvelteKit's `Server` in a worker on SQLite WASM), ids from
slots, the device's copy (pull: the change log, scope, digests), offline changes (push,
phase 3), media on the device (phase 4) and the phases. The spike's findings are in
[`docs/superpowers/specs/2026-11-07-offline-spike-findings.md`](docs/superpowers/specs/2026-11-07-offline-spike-findings.md).
Motion, round 1, has its own,
[`docs/superpowers/specs/2026-11-10-motion-round-1-design.md`](docs/superpowers/specs/2026-11-10-motion-round-1-design.md):
taps dip under the finger (buttons 94 %, rows 98.5 %); lists fold and open (a row leaving
slides off, the rows under it close the gap, Undo opens it) on Today, a routine's slots,
links, sections, recordings, Music's To pick, comments, Suggestions and a past day; sheets
slide away and toasts rise; Done lands on Today (the row lifts into its done place, its
check pops, the bar fills, the words swap); the player's count pushes on the beat (every count
alike, the 1 is drawn like the rest), the lit dot grows, and Next rises into the call on a new figure. Nothing waits
on motion, and reduced motion turns it all off. Changing pages (round 2,
[`docs/superpowers/specs/2026-11-10-page-transitions-design.md`](docs/superpowers/specs/2026-11-10-page-transitions-design.md)):
on the phone the page's card lifts on the tap and its words fade, holds empty while the page
loads (three dots after half a second, "Still trying… Go back" after 8 s), and lands where the
new page's band ends as its words fade in; scrolled down it holds square under the slim band; a
figure's switcher steps change only the words; Practice and the map fade in and out; Done's
landing plays once the card has settled. The phone has no skeleton or progress bar now; the
desktop keeps both and offers Go back after 8 s. (The Offline layer that left the tab bar showing
is gone since offline phase 5.) Not found no longer says "ERROR 404".
