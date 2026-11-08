# salsaapp agent guide

A personal practice companion for salsa and bachata, used from a browser-only
work PC and a phone. The two are separate **dances** — a hard wall through the
content, one codebase behind it. Son is a style inside salsa, not a third
dance: the same songs, the same beat grid, a different count pattern.

**Live:** phase 1 (Today/Exercises, figures with recordings, custom exercises),
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
work, Gaps and a map; links from sections, points and lessons; see
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
and Slovenian (part 1: the app in English or Slovenian per account; the language on
the invite, Join, the cookie before sign-in, a Settings switch and the admin's per
person; the Follow my class path in Slovenian, the Practice player and pairing
included; the rest of the app and the Android app's own text are part 2; see
[`docs/superpowers/specs/2026-11-07-slovenian-design.md`](docs/superpowers/specs/2026-11-07-slovenian-design.md)).

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

Toolchain comes from the nix flake — `nix develop`, or `direnv allow` once.
Sister project with the same conventions: `~/Projects/muscle_model`.

## Layout

```
src/lib/day/         PURE calendar-day maths in the user's zone. `now` is an argument
src/lib/schedule/    PURE, client-safe: the Anki-style schedule (schedule.ts: `replay` an
                     exercise's sets into a gap and a due day, one review per local day,
                     `preview` what each face would set; feel.ts: the four faces and how
                     `sets.rating` reads), Today's list (today-list.ts: `dayList`, `inLine`,
                     `workOf` — rows from the START of the day, Next N, the nothing-left
                     state), the day's picks (picks.ts), Coming up (coming-up.ts: Waiting,
                     dated groups, Paused) and the words (words.ts). `now` and `tz` are
                     arguments
src/lib/levels/      PURE, client-safe: levels.ts is the level (`'follow' | 'own' | 'all'`), its
                     words, `levelShown` (null, not chosen yet, draws as `all`), `tabsFor`,
                     `simple`, `simpleLesson` (a group's lesson the person edits stays full; their own lesson is simple),
                     `simpleClass`, `autoAddOn` and the other "is this drawn" questions.
                     Components ask it, never compare level strings. first-run.ts: the
                     first run's words, refusals and where it ends (`afterJoin`, `afterSkip`)
src/lib/i18n/        the words, client-safe: `catalog.ts` (`t()`, the current language's catalog),
                     `en/` the source and `sl/` typed against it, one file per area with an
                     `index.ts` (the glossary heads `sl/index.ts`), `current.ts` (the current
                     language: a `withLocale` override for specs, the server's per-request
                     source, the browser's, then English; never a server module variable),
                     `locale.ts` (`'en' | 'sl'`, the `lang` cookie, `requestLocale`), `plural.ts`
                     (`slCount`, `slForm`). `i18n.spec.ts` checks both catalogs have the same
                     keys; `no-english.spec.ts` lists the translated components (`TRANSLATED`)
                     and fails on bare English in their markup (`no-english.ts`, `englishIn`)
src/lib/server/i18n-request.ts  the server's language per request (`AsyncLocalStorage`):
                     `hooks.server.ts` wraps `resolve` in `runInLocale`
src/lib/server/locale.ts  `users.locale` and `invites.locale` (`setLocale`, `localeOf`,
                     `inviteLocaleOf`), the `lang` cookie, `<html lang>` (`fillLang`)
src/lib/server/invite-code.ts  an invite code's hash: a leaf, so the hook reads an
                     invite's language without loading invites.ts
src/lib/exercises/name.ts  PURE: a lesson's own exercise is stored `Review: <title>` and
                     drawn in the reader's language (`shownExercise`, in the loads)
src/lib/comments/    PURE, client-safe: view.ts is the comments' words, the 1–1000 body rule,
                     "@Name", the card's words, and the sheet's list after a post, a heart
                     or a delete. api.ts is the fetch side of the comments API
src/lib/beatgrid/    PURE beats → the dance count: gap filling, anchors, tempo factor
src/lib/scheduler/   PURE cues: grid + plan + toggles + window → what sounds when
src/lib/dances/      PURE registry: one entry per dance (styles, count patterns,
                     whether clave exists, accent colours). Client-safe
src/lib/graph/       PURE figure graph: positions → what can follow what (`meet`: an
                     empty side fits anything), the gap report (`positionCounts`: dead
                     ends, orphans, islands, unused), No position. Client-safe
src/lib/positions/   PURE: the hold's words and chips (hold.ts), the templates per dance
                     and type (templates.ts), every positions screen's words and rows
                     (view.ts), the map's layout (map.ts: a force layout from a fixed
                     start, the label pass, the tray) and how the page draws it
                     (map-view.ts: type colours, what a tap lights, the arrows). Client-safe
src/lib/schedule/comes-back.ts  PURE: a drill's Comes back (by how it went, learning, or a fixed
                     rhythm): parsing it, the one a row follows (`effectiveComesBack`) and its
                     words. `schedule.ts` holds `scheduleOf` (the setting + the sets → a
                     `DueState`) and the slower gap steps (`STEPS`)
src/lib/exercises/comes-back-view.ts  PURE: the Edit card's notes and chips for Comes back and
                     Warm-up (drawn by components/exercises/ComesBackCard.svelte and WarmupRow.svelte);
                     the words are `t().exercise.comesBack` and `t().exercise.warmup`
src/lib/server/comes-back-form.ts  reads the Edit form's Comes back and Warm-up fields (a
                     `warmupSent` marker says the Warm-up row was on the form)
src/lib/server/warmup-order.ts  the warm-ups' own order (`exercises.warmup_order`), set by dragging
src/lib/server/schedule.ts  the schedule from the database (`doneFacesOf`: the Done sheet's four gaps,
                     from `doneFaces` in `schedule/schedule.ts`): `listScheduleSets`, `scheduleStates`
                     (every live exercise, optionally as of the start of a day), `scheduleStateOf`,
                     `scheduleForShown` (the person's own entry wins). Nothing stored
src/lib/server/today-picks.ts  the daily number (`users.daily_count`, 1–30, default 5) and
                     the day's picks (`today_picks`: next, add, skip): `addPicks`, `removePick`,
                     `dayInputOf` — what `dayList`, `inLine` and Coming up need. The Today
                     layout, its `next` action and the reminder (`dueByDance`) read the same
src/lib/server/positions.ts  owned positions: list (by type, then name), create, edit,
                     archive, restore, Templates (`addTemplates`), "from Week 6" (`positionsFrom`)
src/lib/server/section-names.ts  the one-time boot step: an unnamed linked section or point
                     takes its oldest link's name (`nameLinkedSpots`, an `app_flags` marker);
                     a new link names one by `nameIfUnnamed` (spot-links.ts)
src/lib/server/position-form.ts  `readNewPosition`: what a New position form posts, read and
                     checked (the positions list's `create`, the lesson page's `newPosition`)
src/lib/server/positions-move.ts  the one-time boot move: the old shared positions become
                     the admin's, every other place using one gets a copy of the same
                     gene, `end_position_id` → `figure_end_positions` (an `app_flags` marker)
src/lib/server/position-links.ts  sections and points linked to positions
                     (`spot_position_links`): link, unlink (a group's to Recently deleted),
                     and what a position's page lists (its spots, linkable spots, its lessons)
src/routes/[dance]/(moves)/positions/  the list (Moves' third segment); [id] a position's page;
                     none the figures with no position; map the map (all under the `(moves)` group,
                     below)
                     src/routes/api/positions is the figure picker's New position (JSON)
src/lib/components/positions/  the New / Edit position sheet and its fields, Templates,
                     How positions work (`HowBody`: the sheet's and the first-run pane's body),
                     a list row, a point's still and its Recordings row (`PointRow`), the position page's
                     card of three rows and their sheets (`PositionRelations`), the map and its pane (`MapPane`),
                     a position page's link picker. `PositionForm` is one form, drawn in the
                     sheet or in place on the desktop, its edit mode fixed at its start
                     (`mode`, not derived)
src/lib/moves/       PURE: what the Moves lists show — figures under their move's heading, filter
                     chips, empty states, meta words, gaps, pick order; a move's page lines
                     (move-page.ts). Client-safe
                     filter.ts is the Figures list's filter (chips, search, the entered set).
                     sync.ts the out-of-sync card and a row's "N copies differ" (`differ` on a row).
                     segment.ts the three segments, pane.ts the empty pane's words and keeping
                     the lit row in view, routines.ts the Routines list's shape. PURE
src/lib/positions/filter.ts  PURE: the Positions list's search, chips and gaps, from the
                     unfiltered rows. pick.ts: the map's first pick from `?pick=`. Client-safe
src/lib/nav/moves-pane.ts  PURE: which Moves list sits beside an item (`besideOf`) and which row
                     is lit (`OpenRow`: figure, move, routine, position, Coverage, No position,
                     the Map row), from the route, the path and the opener. The Figures
                     list owns a move's page and Coverage
src/lib/server/moves-lists.ts  the three Moves lists, loaded UNFILTERED by the `(moves)` layout
                     (namespaced; `depends('app:moves')`, so a change not made by a form calls
                     `invalidate('app:moves')`); filtering happens in the client (`filter.ts`)
src/lib/server/positions-map.ts  the map's data: layout, tray, legend, per space
src/lib/routines/    PURE routine algebra: slots, variants, breaks, whether it
                     loops, the routine as the player's plan, coverage
                     (which routines can call each version), which routines use a
                     version (`routinesUsing`, coverage.ts), the picker's fitting
                     (fit.ts), the selection's rules, the delete snapshot, and the routine
                     page's wording and where a refusal shows (page.ts).
                     Client-safe
src/lib/figures/     PURE: a figure page's lines — timing, the practice line, the
                     figure switcher's steps, Move and Archive wording, the
                     delete question, the length check; the top video (`topVideo`),
                     the Recordings heading and row metas, the three rows (`relationRows`),
                     their sheets' sort and search (`sortRoutines`, `filterRows`), the page's own ⋯
                     items (`figureMenuItems`), a link row (`linkRowView`, drawn by LinkRow).
                     Client-safe. Its pieces are components/figures/ (TopVideo,
                     SectionRow, RecordingRow, RelationsCard, AddRecordingSheet)
src/lib/lessons/     PURE: the Lessons list's month groups, date tiles and counts; a lesson
                     page's lines — via-section badges, row metas, the delete and unlink
                     questions. Client-safe
src/lib/components/links/AddLinkSheet.svelte  "Add a link": one link, what it found (`linkFound`),
                     a title; the lesson page's, and the figure page's to reuse
src/lib/links.ts     PURE URL parsing (YouTube-aware) and linkified notes —
                     no {@html}. Client-safe
src/lib/exercises/   PURE: the type registry (kinds.ts), practice config and
                     where a practice opens (practice.ts), a wall-clock
                     stopwatch, the Today session, what Today shows (today.ts: bands,
                     meta lines, hero states, past-day groups) and the type
                     tile's icon and name (tile.ts), the exercise page (exercise-page.ts), the
                     Done sheet's words and faces (done-view.ts), a day's entry (day-entry.ts:
                     old rows merged), the toast after a save (saved.svelte.ts), the
                     counted seconds (page-clock.svelte.ts: only while visible) and the desktop
                     Today pane (today-pane.ts: what opens by default, the day so far's
                     totals). log-view.ts is `lastTimeParts` only.
                     practice-api.ts is the fetch side of remembering a practice.
                     Client-safe
src/lib/player/      PURE view.ts: what the Practice page shows — the stage's size and dots,
                     the band's subtitles, the run summary, Play's state, Built-in
                     or Yours, where Back goes. Client-safe
src/lib/picker/      PURE picker model and builders: word search, figure
                     headings, group order (model.ts), and the rows each list
                     gives the picker (build.ts); view.ts is what a row ends in, the create
                     row's lead, the body's state and the height. Client-safe
src/lib/components/picker/  Picker.svelte (the sheet, light or dark) and
                     PickerField.svelte (a form field that opens it) and
                     PickerMultiField.svelte (a form field that takes any number: a
                     figure's Starts in) and
                     PickerOpener.svelte (the full-width tonal button that opens one).
                     components/figures/PositionTags.svelte is a figure's Starts in / Ends in
src/lib/components/ui/PlayerLayer.svelte  a Sheet or Dialog as an overlay inside the
                     full-screen player (`.theme-media`), not a second top-layer dialog
src/lib/gestures/    PURE drag and swipe arithmetic, DOM-free like longpress.ts. edges.ts is
                     where a drag's auto-scroll zones are (band row and tab bar aware)
                     Client-safe
src/lib/unsaved/     what leaving would lose: fingerprint.ts and pending.ts are PURE;
                     guard.svelte.ts is the live list, `use:guarded`, and the
                     navigation guard. ui/UnsavedDialog.svelte asks the question
src/lib/server/song-links.ts  Music (spec 2026-11-05 part B): a lesson's, drill's or routine's
                     suggested songs with notes (`song_links`): `listMusic` (what a viewer may
                     play), `addMusic` (a group's draft is shared by it), `setMusicNote`,
                     `removeMusic`, `musicChoices`, `songInPlace`/`copyMusic` (copies never copy a
                     song), and Take a recording's and Sync's `musicFits`/`takeMusic`/`dropMusic`.
                     music-form.ts is the pages' three actions; components/songs/MusicSection.svelte
                     the list, and SongPickSheet.svelte the "Pick a song" popup (SongPicker's too)
src/lib/songs/music.ts  PURE: Music's words and "Practise to this" (`practiseHref`)
src/lib/songs/       sample.ts is PURE: where a 15 s sample starts (snapped back to a 1)
                     and its fade. search.ts is PURE: the song popup's folded
                     search, Recent then A-Z (matches marked by picker/model.ts `segments`). sample-player.svelte.ts
                     is the one impure part: the single sample `<audio>`, one
                     sample at a time. library.ts is PURE: the Music tab's groups, meta,
                     badges and upload checks. song-page.ts and timeline.ts are PURE: the
                     song page's steps, tap rule and the seek bar's maths. upload.svelte.ts
                     is the one song upload in flight, outliving the sheet. Client-safe
src/lib/theme/       tokens.ts is the colour source (four themes); layout.css copies it
                     and a spec checks they agree. `tokens.ts` also holds `MEDIA`, copied into
                     `.theme-media` in `layout.css` (the player's palette).
                     `BAND_TRACK` and `SCRIM` are `bg-band-track` and `bg-scrim`; the scrim is also
                     written out in one `::backdrop` rule. stylesheet.spec.ts checks each theme
                     block, and that no removed alias is still used. contrast.ts is the ratio maths.
                     scheme.ts: the Settings theme (System, Light, Dark; a cookie per browser)
src/lib/icons/       icons.ts: the icon set (24 px, 2 px round strokes, filled tab
                     variants), drawn by components/ui/Icon.svelte (`stroke` for
                     the heavier checks)
src/lib/nav/         tabs.ts: the five tabs, which one a path lights, where the bar
                     shows. band.ts: the big or slim band by scroll. pending.ts: what a tap shows
                     while data is on the way (skeleton, leaving). error-view.ts: the error
                     pages' words and where their back goes. bands.spec.ts: every page draws
                     a band (a page without one is named in the spec with its reason).
                     trail.ts: the session's trail of pages — each page's opener, kept search
                     and scroll, each tab's last page, where back and a tab tap go. PURE.
                     trail.svelte.ts wires it to the router (`syncTrail`, in the root layout)
                     and sessionStorage; shell/BackButton.svelte is the band's back that uses it
                     (only trail.svelte.ts is not PURE; tabs, band, pending, error-view, trail are).
                     chrome.svelte.ts: `claimBottom`, an edit or selection bar takes the bottom and the
                     tab bar steps aside. The tab bar shows on every screen of a dance but Practice/share;
                     pinned bars sit at `--pin-bottom` / `--pin-safe` (set by the root layout)
src/lib/nav/frame.ts  PURE: the frame of a path (`frameOf`: side, bare, card, none), an error's frame
                     (`frameOfError`, by the path asked for), the frame drawn right now (`frameNow`:
                     the page's own until the skeleton covers it, then the destination's) and
                     `PAGE_WIDTH` (the content max widths). pane.ts: PURE,
                     `listOf` (which list column a path belongs to) and `paneBack` (whether an
                     item's ‹ shows). desk.svelte.ts: the `desk` media query (from 1024 px)
src/lib/components/shell/  Side.svelte (the band-coloured side with the tabs), SheetCorner (the
                     sheet's rounded corner), BandHeader (the band row's title, subtitle, actions),
                     ListPane (a list column with its band) and Pane (the item beside it;
                     `pane-context.ts` tells a page it is in one), CardFrame (the centred 480 px
                     card on the band colour: sign in, Join, Welcome, Get the app, Pair, `/g/<code>`
                     and errors outside a dance)
src/lib/components/songs/MusicList.svelte  the Music list; `src/routes/[dance]/songs/+layout.*`
                     holds its load and the list/item split
scripts/shots/       the screenshot rig: a throwaway copy of a db, a frozen clock, every page of
                     `pages.txt`, `--viewport` for desktop; `diff` against a baseline (README.md)
src/lib/settings/    view.ts: PURE, the reminder rule and the paired-phone device lines
src/app.html         a script before the first paint: the theme choice → `data-theme`
                     (light/dark, told to the Android shell), and the Android app's
                     insets → `--safe-*`. Read the safe area through `--safe-*`, never
                     `env()` (class-rules.spec.ts): the app draws the page under its bars.
                     It also wraps `fetch`: every same-origin request carries the page
                     epoch (`src/lib/page-epoch.ts`), and a stale answer fires `salsa:stale`
scripts/shots/      the screenshot rig (README.md there): shots.sh/shots.py shoot pages.txt;
                     scenes.py runs a scene (a page after some clicks), ext_*.py hold each
                     plan's scenes (ext_practice.py: Practice, the player's popups)
src/routes/dev/kit/  the kit gallery: every shared component in every state, to
                     compare with the design board. Dev only (404 in a build)
docs/superpowers/design-kit/  the design board source (kit.py) the redesign was ported from; its colours are the first, brighter ones (tokens.ts is the source since the warm palette, 2026-11-07)
src/lib/sheets/      `whenSettled(fn)` (history.svelte.ts) runs fn after the sheets' Back has landed; with
                     `backWhenSettled(fallback, {replace})` in `nav/trail.svelte.ts` it is how a save closes
                     its sheet and goes back. stack.ts is PURE: one history entry per open Sheet behind a
                     port, so Back closes only the top one, with holds while a
                     navigation or a link click is in flight. history.svelte.ts
                     wires it to SvelteKit shallow routing; `refreshWhenSettled()` is the one way to
                     refresh after a close; `refreshIfSent` is Sheet and Dialog's own, so a form
                     sent inside one still shows once it closes. It reads the depth from
                     `history.state['sveltekit:states']`, not `page.state`,
                     because `invalidateAll` resets `page.state`. `settled(fn)` runs fn once,
                     after history has caught up with the sheets' own Back moves.
                     `gotoWhenSettled(href, opts)` is close-then-go: the caller closes its
                     sheets, and the navigation (often a replace) goes once their Back has landed
src/lib/fold.ts      accent and case folding, shared by the shared picker, the
                     routine picker and the song search
src/lib/video/       PURE spots.ts: spot times, labels, ±1 s and 0.1 s steps,
                     whole-section moves, the loop rule. link-steps.ts (the Link
                     popup's levels; its screens are components/links/LinkLevel.svelte,
                     one stacked level each), trim.ts (the trim
                     strip), screens.ts (the player's stack of levels and the
                     loop it implies), keys.ts, layout.ts, player-history.ts
                     (one history entry per screen, behind a port), zoom.ts
                     (pinch maths), taps.ts (double-tap) and screen-on.ts
                     (the wake lock, injected), turning.ts (the Android app
                     stands upright; the player lets it turn), caption.ts (a recording's
                     or lesson video's caption), inline.ts (what the inline
                     video's overlay shows, its time line and bands) and chrome.ts (which parts the top
                     bar shows per layout and level, the link entry's words, the
                     delete sheet's copy, the toast's icon and place, the buffering
                     spinner) are PURE too. spots-api.ts is the player's
                     fetch side of /api/video-spots. Client-safe. The player's
                     screens are src/lib/components/video/ and draw from
                     `.theme-media` (the media palette), the shared ui/Icon and
                     the builders in video/styles.ts; no palette or icons of
                     their own
worker/              Python home worker (yt-dlp, ffmpeg, Beat This!) — runs at home, not on the server
android/             the Android apps (Kotlin): one per dance as Gradle flavors, each a WebView launcher, salsa:// links, the upload
                     and reminder workers. No screens of its own. Pure parts (Links,
                     UploadPlan, Reminder, Api parsing) have JVM tests. `nix develop .#android`
src/lib/app-mode.ts  client-safe: the ?app=android cookie and the salsa:// link builders
src/lib/server/group-mode.ts  group mode: `groupModeOf` (the cookie's group), `groupChoices`, and
                     `spaceOf`, which every create action calls itself (the layout's copy may be old)
src/lib/teams/mode.ts  PURE: the cookie name, which paths show no group mode (Today), return path, labels. Client-safe
src/lib/teams/opens-api.ts  the fetch side of POST /api/opens (`reportOpen`)
src/routes/[dance]/group-mode  the switch: a page action (default) between Mine and a group, the only
                     thing that switches the cookie (never a load: preload runs loads; `groupModeOf`
                     only drops an invalid one). Its GET goes to Moves
src/routes/api/opens  POST: record that a lesson or song was opened (never in a load)
src/lib/server/whats-new.ts  what is new to a person in their groups, against their opens
src/lib/server/song-share.ts  share, stop sharing and restore a group song; `song_drops`
src/lib/theme/tokens.ts  also `GROUP`, the group look's dance tokens; `layout.css` copies it
                     in `[data-dance][data-group]`
src/lib/server/teams.ts  groups: make, code, join (`joinTeam`), rename, delete;
                     `membership.ts`: leave, remove, roles
src/lib/server/you.ts  `youSettingsOf`: the You tab's settings rows (`components/settings/YouSettings.svelte`,
                     saving through Settings' own actions); `/[dance]/you` is You at Follow my class
src/lib/server/levels.ts  `users.level` and `team_members.auto_add`: `levelOf`, `setLevel`,
                     `setAutoAdd`. `locals.user.level` carries the level, so a load never asks
src/lib/server/auto-add.ts  Add running by itself: `autoAddOnPublish` (in `publishLesson`),
                     `joinClass` (`joinTeam` + `autoAddOnJoin`: the newest lesson), and
                     `autoAddPending` (a published lesson that grew: run by the `GROWTH`
                     mutations listed in `auto-add.spec.ts`)
src/lib/server/join-code.ts  `joinWithCode` (a typed class code, through `joinClass`) and
                     `danceWithClass` (`/` at Follow my class prefers a dance with a class)
src/lib/server/my-class.ts  My class's list: the groups with what is new, each class's last
                     day; read by the Groups layout and, at Follow my class, the Lessons layout
src/lib/server/from-class.ts  an exercise's "From class" lesson (`fromClassOf`)
src/lib/server/comments.ts  comments on a group's lessons: list, post, heart, delete (soft),
                     restore, the card (`commentsOn`) and an exercise's lesson (`classLessonOf`).
                     Served flat: api/lessons/[id]/comments, api/comments/[id] (+ heart, restore)
src/lib/components/comments/  CommentsCard (opens the sheet), CommentsSheet, CommentItem, Composer
src/lib/sheets/keyboard.ts  PURE `keyboardInsets` and `followKeyboard`: an open Sheet sits above
                     the on-screen keyboard (`visualViewport`), not in the Android app
src/lib/server/access.ts  what a person may do with a row: `reach` (what they reach
                     through published lessons; a deleted group's members, until its purge,
                     through the lessons they added; someone who left, nothing),
                     `lessonAccess`/`figureAccess`/…, and `fileAccess`/`videoAccess`/`spotAccess`
                     for the flat routes
src/lib/server/entries.ts  per-person entries (Add, Remove, `reconcileEntries`, which runs the
                     rescue: `clones/rescue.ts`)
src/lib/server/changes.ts  `logChange`: History, one line per group mutation, in its transaction
src/lib/server/clash.ts  the clash check: `seen` against the current row
src/lib/server/trash.ts  `team_trash` (30 days, files kept) and `purgeTrash`;
                     `team-purge.ts` (`purgeTeams`) finishes deleted groups
src/lib/clones/      PURE, client-safe: a member as fields (flat.ts: keys and labels per kind),
                     the three-way compare, default picks and the next snapshot (diff.ts),
                     yours in place of theirs in a view (shadow.ts), twins folded into one
                     row (twins.ts), every clone and twin screen's words (view.ts), and Keep in
                     step: sync.ts (which changed keys may flow, by the copy's options),
                     merge.ts (Sync's N-way merge of every copy a person reads: rows, picks,
                     `mergeTargets`), step-view.ts (the notice's, the sheet's and the Versions
                     line's words) and from-tag.ts ("Basic · Sreda 17:30": where a same-named
                     copy came from, drawn, never stored)
src/lib/server/clones/  families: genes.ts (stamping, `memberIn`, `familyRows`, `accessTo`,
                     `visibleMembers`), trees.ts (`flatOf`), pairs.ts (pair snapshots, `digest`
                     for `seen`), clone.ts (the copy engine: `planClone`, `cloneInto`/`cloneTx`,
                     files linked before the write, unlinked when it throws), files.ts
                     (`CloneFiles`: hard links under new names, injected; specs pass fakes),
                     names.ts (`suffixed`), repoint.ts (a person's rows and practice from one
                     row to another). Using and leaving: rescue.ts (`rescueUsed`: what an
                     editor's change takes from a person's own rows is copied to them),
                     keep.ts (`keepFromTeam`, `keepPreview`), settle.ts (`settleFormerMembers`,
                     at boot). The actions: edit.ts (Make it mine: a reader's Edit copies the
                     group's row into their app and moves their rows and practice onto it;
                     editors' Edit edits the group's row, ruling 1), sources.ts (the source
                     tabs, Take a recording), apply.ts (`landKeys`: land chosen keys on a copy;
                     `syncFrom`), send.ts (the Versions list's members), drop.ts, detach.ts,
                     copy-to.ts, move.ts (Move to… a group), shadow.ts (the person's members
                     for views).
                     Keeping in step: sync-settings.ts (`clone_sync`, the switch and
                     options per copy; not logged), marks.ts (`clone_marks`: a hash per field of
                     what a copy held after its last save or flow; `markNow`), flow.ts (`flowFrom`:
                     what a save changed travels hop by hop through the copies that pair, visited
                     set, marks updated per hop), flow-hook.ts (`flowing` wraps a page's actions,
                     `flowAfter` for flat routes; runs after the commit and never fails the save;
                     its spec lists every save path), sync.ts (`syncView`, `syncAll`: the sheet's
                     rows and the landing on every ticked copy, then the flow onward) and step.ts
                     (`stepStatus`, `outOfStep`: the notice's lines and the Moves counts, from the
                     same merge rows). The routes' side: `take-form.ts`, `make-mine-form.ts`,
                     `keep-form.ts`, the page action `keep` (each item page); the sheets (SyncNotice, SyncSheet, KeepInStep) are components/clones/
src/lib/server/usable.ts  what of the groups a person may USE from their own rows (slots,
                     embeds, lesson and section links): `usableOf` (their added lessons'
                     reach, plus what their rows already point at and still read, in groups
                     they are still a member of), `ownedOrUsable`, `usableVersions`. The
                     graph a person's routines walk is `graphFor` (graph.ts)
src/lib/server/twins.ts  a person's twins: `markTwins`, `separate`, `setTwins`, `twinCandidates`,
                     `twinSets`, and the folds for pickers (`foldNamed`, `foldVersions`)
src/lib/server/integrity.ts  `ownerIntegrity` (rows whose owner is not exactly one of person or
                     group), `familyIntegrity` (a parent holding two pieces of one family) and
                     `crossRefs` (a row pointing where its owner may not: outside its group, or
                     at a group row the person does not read). Boot logs a count of each
src/lib/teams/       PURE: the Groups pages' lines (view.ts), Add (add.ts), History
                     (history.ts), Recently deleted (deleted.ts, restore-api.ts), the leave
                     sheet's and Keep's words (leave-view.ts). Client-safe
src/lib/clash/       PURE: what a clash shows and how a field merges. Client-safe
src/lib/names.ts     PURE: first names and how a person is shown. Client-safe
src/lib/server/lesson-links.ts  what reaches a lesson through its videos' sections —
                     derived, never stored; lessons.ts and spot-links.ts read it
src/lib/server/link-popup.ts  the Link popup's data and create-and-link (one
                     transaction); served by /api/video-spots/[id]/links
src/lib/app-update/  agent.ts (user agent / `x-app-version` parsing, `current.json`, none /
                     available / required (`updateState`), the device from the user agent
                     (`deviceOf`)), view.ts (the bridge's messages, the Update button's words,
                     when Update needed takes the page: `updateNeededNow`), get-app.ts (the
                     /app page's cards, where a new account lands). All PURE, client-safe.
                     Drawn by components/system/AppUpdateBar.svelte (Today's "Update
                     available"), UpdateButton.svelte (the `salsaUpdate` bridge, or a link to
                     the file or Google Play) and UpdateNeeded.svelte (the full-screen block)
src/lib/page-epoch.ts  PAGE_EPOCH: raised when older open pages would send what the server no
                     longer takes; they reload instead of failing
src/lib/nav/fresh.ts  PURE: whether a navigation may become a full load after a deploy, and
                     whether the page may reload by itself (`mayReloadNow`). fresh.svelte.ts is
                     the reload-hold counter (`holdReload`, `holdReloadWhile`: an upload, a
                     run). shell/ReloadBar.svelte is "New version · Reload" and "This page is
                     out of date"
src/lib/server/releases.ts  reads $DATA_DIR/releases/<dance>/current.json (cached by mtime) and
                     the APKs; app-seen.ts which app version each device last showed (table
                     `app_installs`); app-gate.ts which native API requests (`x-app-version`, never the
                     WebView's own calls) from a too-old app get a 426;
                     public-paths.ts PUBLIC_PATHS plus the update check and published APKs
src/routes/app/      the Get the app page; src/routes/releases/[dance]/ serves APKs;
                     src/routes/api/app-update/[dance]/ is the check (404 until published)
src/lib/server/devices.ts  device tokens (hash only), the app's settings, dueByDance
src/lib/server/undo-hold.ts  what Undo needs, held 60 s in memory (a removed paired phone, a
                     deleted voice take); a take's wav is unlinked when its hold expires
src/lib/server/request-user.ts  where a device token may sign in: /api/ only
src/lib/server/storage.ts  what a person uses (computed from size columns, never stored), `roomFor`
                     (refuses at or over the limit), and `listStorageItems` for What uses space
src/lib/server/invites.ts  one-time invites into one dance, and joining with one
src/lib/dances/hosts.ts  PURE: which host serves which dance (`parseDanceHosts`, `hostDance`, `hostOf`),
                     the request's dance (`requestDance`), the hook's host redirects
                     (`hostRedirect`, `/logout` always passes) and an invite's link (`inviteLink`). Client-safe. `src/lib/server/hosts.ts` reads `DANCE_HOSTS`
                     (`danceHosts`, `requestDanceOf`)
src/lib/server/dance-split.ts  `splitAccounts`, at boot before the admin: places every account in
                     one dance; one that held both keeps salsa and its bachata half moves to a
                     new account. `danceIntegrity` (integrity.ts) reports what is on the wrong side
src/routes/admin/    the admin page of one dance: its people, limits, invites, requests for more
                     space (`adminReaches` before every change)
src/routes/join/     Join: a person creates their account from an invite link (public)
src/routes/[dance]/(moves)/  one route group, one layout: the band with the Figures / Routines /
                     Positions switch, the three lists in a 360 column beside the open item,
                     `(moves)/+layout.svelte` and `+layout.server.ts`; routes figures, moves/[id]
                     (a move's page: its figures, rename, New figure), coverage, routines and
                     positions (above) live in it. `components/ui/PaneColumns.svelte` is a
                     pane's two columns (`two:` on its `cols` container, not on the pane),
                     `components/figures/FigureTabs.svelte` the figure's tabs on desk, `components/shell/PaneHeading.svelte`
                     a pane's heading row; there is
                     no MovesScreen (the layout and the lists replace it)
src/routes/[dance]/(today)/  one route group, one layout: the list (Start session, Due, Done today,
                     Not yet due, Inactive; `components/today/TodayList.svelte`) beside the open
                     exercise, `(today)/+layout.svelte` and `+layout.server.ts` (list data under a
                     namespace); the list route `+page.*` and `exercises/[id]` (+ `practice`) live in
                     it. On desk, arriving at Today `replaceState`s to the first due exercise's URL
                     (R11); the phone keeps the list and the exercise page. `components/today/today-context.ts` shares the
                     layout's pane state with its pages (`setTodayPane`/`todayPane`),
                     `components/today/TodayPaneSkeleton.svelte` is the pane while data is on the
                     way. `lib/exercises/today-pane.ts` is PURE: what opens by default (`defaultOpen`),
                     and the day's totals. The pane is the exercise page's own two columns with
                     the pinned `DoneBar`; there is no log popup, `LogShell` or `frame`. The interim
                     session is `?session=1` (`SessionControls` in the layout; `TodayPane
                     { session, canSkip, notToday }` in `today-context.ts`), which plan 3 replaces.
                     `rowButton(kind)` in `ui/styles.ts`
                     is the pinned bar's two equal buttons
src/routes/[dance]/groups/**  the Groups tab: `+layout.svelte` and `+layout.server.ts` hold the list
                     (`components/teams/GroupList.svelte`, in a 360 column on desk; no groups,
                     no column) beside the open group; make and join, a group's page (two
                     columns, `PaneColumns` `'7:5'` with `lead`: the group's space), its people,
                     storage, History and Recently deleted. `teams/view.ts` also has `PICK_GROUP`
                     and `codeAction` (Copy link on desk, Share on the phone; `COPY_FAILED`)
src/routes/[dance]/lessons/  the same for Lessons: `+layout.svelte` and `+layout.server.ts` hold
                     `components/lessons/LessonList.svelte` beside the open lesson (a lesson
                     page is two columns; no lessons, no column; `lessons/list.ts` has
                     `pickLesson()`, `isOpenLesson`, `groupVideosSubtitle`). The New lesson sheet
                     stays mounted in the layout. `components/shell/reveal.ts`: `revealLit` and
                     `revealPicked`, scroll the lit or the new row into view in a list column
src/routes/g/[code]  a group code's link: Join `<name>`? (needs an account already)
src/routes/welcome/  asks once for a name: a person whose account was made before names
                     (hooks.server.ts sends anyone signed in without one here)
src/routes/welcome/start  the first run: three slides, How much app?, Join your class
                     (`?step=join`). hooks.server.ts sends anyone signed in with no level here
                     (`needsLevel`, after the name). Drawn in `CardFrame`
src/lib/components/levels/LevelCards.svelte  the three levels as radio cards (first run, Settings).
                     components/teams/ClassList, MyClass, ClassCodeField are My class;
                     components/lessons/SimpleLesson the simple lesson page
src/routes/api/trash/[id]  restore a group's trashed row; src/routes/api/archived is the
                     POST behind a picker's "Archived by … · Restore" (a group's figure,
                     routine or drill); it lists nothing
src/routes/settings/storage/  What uses space: the person's files biggest first, Delete, Ask for more
src/lib/admin-view.ts  PURE: the admin page's wording and limit presets. Client-safe
src/lib/storage-view.ts  PURE: the storage lines and the usage bar. Client-safe
src/lib/upload-error.ts  PURE: the message in a failed upload's body, or a fallback. Client-safe
src/lib/scheduler/attach.ts  the impure player: AudioContext, clips, the
                     25 ms look-ahead loop, speechSynthesis, the wake lock
src/lib/voice/       wav.ts and slice.ts are PURE (WAV bytes, where a recorded
                     half-bar starts); capture.ts owns the mic and the click.
                     grid.ts (tempo states, takes, the Settings summary), recording.ts
                     (the count dots and bar progress), back.ts (where My count goes
                     back to: `voiceBack`/`myCountHref`) are PURE too
static/worklets/     recorder.js — the AudioWorklet that captures the mic.
                     Served, not bundled: addModule() takes a URL
src/lib/*.ts         client-safe: labels, frequency presets, limits, format (dates, `plural`), row types.
                     act.ts posts a page action without a form (`act`); act-toast.ts is the refusal
                     message and the "removed · Undo" toast Settings and My count share.
                     focus.ts: where focus goes after a one-tap removal (`focusAfterRemoval`)
src/lib/components/exercises/  the exercise page's parts: `DoneSheet` (+ `done-submit.ts`), `SavedToast`, `DoneBar`,
                     `HistoryDaySheet`, `DrillRecordings`, `kinds/<type>/Content.svelte` and `Practice.svelte`
                     (`contentFor`/`practiceFor`)
src/lib/components/  ui/ shell/ today/ figures/ lessons/ songs/ player/
                     exercises/ links/ routines/ moves/ (the three Moves lists, `moves-context.ts`, the tiles) system/
                     (error, offline, choice sheet, status block, lead tile) clones/ (`Versions`:
                     the whose-version row and its list; `ItemMenu`: a family page's ⋯ with the
                     copy actions; the clone and twin sheets) teams/ (Add, the code, Leave).
                     ui/MenuSheet.svelte is a page's ⋯ and its small sheet (`MenuItem`,
                     `orderMenu`, `menuLabel` in `src/lib/menu.ts`, PURE)
                     ui/styles.ts holds the class builders: `button(kind, size, full)`,
                     `iconButton(variant, tone)`, `FIELD`/`TEXTAREA`/`SELECT` and their
                     `_INVALID` twins, `CHIP`, `GROUP` and `CLIP` (`focus-inset`: a card that
                     clips), and `swap()`, which throws in dev and tests when the class token it replaces is missing
                     ui/SearchField.svelte is the search pill, ui/FieldError.svelte the
                     line under a refused field
src/lib/server/      db (SQLite via Drizzle), auth, data access, form parsing, files
src/lib/server/db/ids.ts  ids from slots: `mintedId`, `mintId`, `setIdSlot` (`id_marks`, its
                     triggers in migration 0038)
src/lib/server/server-clock.ts  `serverNow()`: the one clock server code reads.
                     server-sources.ts is the specs' view of the server code (scans)
src/lib/server/scope.ts  the wall at the route level: `Wall` ({ userId, dance }),
                     `wallOf(params, locals)`, `inWall(row, wall)` and the
                     `require*InWall` guards on ids, so a request only ever reaches
                     its own person's side of its own dance. `requirePositionAccess`
                     guards a position as `requireFigureAccess` guards a figure
src/lib/server/test-walls.ts  specs only: `U1_SALSA`, `U1_BACHATA`, `U2_SALSA`.
                     `[dance]/owner-wall.spec.ts` and `api/owner-wall.spec.ts`
                     act as u2 on u1's rows, area by area
src/routes/[dance]/  every page lives under its dance. Flat routes — login,
                     settings, voice, api, the media servers — are shared
src/routes/          pages + actions. api/figures/[id]/recordings and api/songs
                     take raw-body uploads; api/lessons/[id]/videos/[uploadId]
                     takes ONE CHUNK per request, as does api/worker/videos/[id]/file;
                     api/worker/* is the worker's queue (songs, then videos)
                     recordings/[file], audio/[file], count/[file] and
                     lesson-videos/[file] serve with HTTP Range
src/lib/media.ts     shared: telling a missing media file from an undecodable one
$DATA_DIR/           recordings/ audio/ count/ lesson-videos/ uploads/ — not in
                     the repo. uploads/ holds partial chunked uploads only, swept
                     at boot after 24 h. lesson-videos/ is NOT backed up: see
                     docs/deployment.md for why
static/clips/        the seven committed count/clave clips — regenerate with
                     scripts/make-clips.sh, never at build time
static/icons/        per-dance home-screen icons, committed. The manifests are
                     served FLAT (/manifest-<dance>.webmanifest) so PUBLIC_PATHS
                     stays an exact-match Set
drizzle/             generated migrations — applied at boot, shipped by deploy.sh
android/app/src/     main (shared), direct (the updater: Updater.kt, UpdateBridge.kt; downloads,
                     checks, installs) and play (no updater) — the two channels
scripts/release.sh   build, sign-check and publish an app update (see docs/deployment.md)
scripts/deploy.sh    build locally, rsync, npm ci on the box, restart, health-check
.tmux-project/       tmux_project (nixos-config): C-1…C-9 in tmux make a slot — a worktree
                     ../salsaapp-wt/<name> on its own branch, vite on a devports port at
                     wt-N-<name>.salsa.localhost, .data cloned from main's by hooks/up
scripts/make-clips.sh  one-off: Piper + ffmpeg → static/clips/. Output is committed
scripts/make-icons.sh  one-off: librsvg rasterises static/icon-salsa.svg and
                     static/icon-bachata.svg → static/icons/. Output is committed.
                     Both scripts pull their tooling from nixpkgs at run time, so the
                     flake carries neither
```

## Hard rules

- **What is due is never stored.** No "last done" or "due" column, no cron. It is
  a pure function of the sets' days and faces (`sets.rating`), replayed per
  request (`src/lib/schedule/`); `today_picks` keeps only the person's choices
  for one day (Next N, add, skip), never what is due. There is no frequency
  to set: the gap is earned from the faces. The one exception is a drill's
  **Comes back** (`exercises.comes_back`): "every day until it feels good" or a
  fixed rhythm of 1, 2, 3 or 7 days, the person's choice. Even then what is due
  is worked out from the sets, never stored. A **warm-up** (`exercises.warmup`)
  sits outside the daily number.
- **Elapsed time sorts; calendar days speak.** Anything a user reads as a day
  ("yesterday", "done today", which day a set belongs to) goes through
  `localDay`/`daysBetween` in the user's zone. Elapsed ms is only for
  sorting. Never `Date.now()` inside `src/lib/day` or `src/lib/schedule`.
- **Every instant is an integer of epoch ms** in the database, never a Date.
- **Every insert mints its id.** An integer id comes from `mintedId('<table>')`
  (`src/lib/server/db/ids.ts`): this runtime's slot in `id_marks`, plus one
  (`id = slot × 2³² + n`; the server is slot 0, devices get their own). An
  insert carries ONE new row, or rows that carry their own ids: SQLite works
  the default out once per statement, so several new rows collide. No raw SQL
  insert into an id table, and no migration insert without `id`. A new
  integer-id table gets `mintedId` and a mark trigger (as in migration 0038).
  `ids.spec.ts` checks all of it.
- **Server code reads the time through `serverNow()`**
  (`src/lib/server/server-clock.ts`), never `Date.now()` or `new Date()`:
  offline replay will set it to when a change was made.
  `server-clock.spec.ts` scans for it. Pure modules still take `now` as an
  argument.
- **Archive, don't delete.** Figures and exercises get `archived_at`; songs
  (a person's own, only from Settings → What uses space, `deleteSong`: refused
  while a live exercise uses it, archived ones lose `song_id`; a group song's
  delete is an archive, restored from Recently deleted, see "Songs" below), a day's rows
  (`deleteDay`, with Undo), sets, recordings, links,
  spots (`video_spots`, deleted with their video), section links (`spot_links`,
  deleted on unlink), position links on sections and points
  (`spot_position_links`, deleted on unlink, and with their video when a
  group is purged) and saves in flight (`video_downloads`, deleted with their
  link, or when the link becomes a video) are the only hard deletes of content;
  `twins` rows (Separate), `clone_pairs` (Detach), `today_picks` (Undo of a
  pick, and an add or next taking the day's skip away), `song_links` (a
  Music row's Remove, and every link to a song deleted for good, first) and
  `lesson_comment_hearts` (un-hearting) are bookkeeping, deleted too. A song
  link never copies a song: a copy keeps it only where the new place can play
  it (`songInPlace`). A comment (`lesson_comments`) is deleted softly
  (`deleted_at`, `deleted_by`; Undo clears them); only a group's purge
  hard-deletes its lessons' comments and hearts (`purgeRows`, `team-purge.ts`),
  as nobody reaches them after it. Drop my copy and Move to… archive the copy, never delete it. A
  figure's exercise is opt-in (`addFigureExercise`); when one exists it is
  renamed and archived WITH its figure, in one transaction
  (`src/lib/server/figures.ts`). A linked spot (to a figure, a drill or a
  position), and the video it is on, cannot
  be deleted until it is unlinked — archived targets included (`assertUnlinked`
  in `src/lib/server/spot-links.ts`). A removed paired phone and a deleted voice
  take come back with Undo for a minute: both are deleted at once and kept in an
  in-memory hold (`src/lib/server/undo-hold.ts`); a take's file is unlinked when
  its hold expires. In a group, the hard-delete kinds (videos, sections, links,
  section links, position links, recordings) are still deleted at once, and kept 30 days in
  `team_trash`, file included (`src/lib/server/trash.ts`): the delete returns a
  trash id and the route must not unlink the file; `purgeTrash` and `purgeTeams` do, at boot and hourly.
  A position link is kind `'position-link'`, its entry holding the
  `spot_position_links` row and, when the unlink also took the lesson's hand
  link to the same position, that `lesson_positions` row
  (`unlinkSpotFromPosition` in `position-links.ts`). One unlink is not
  trashed, for figures and positions alike: a lesson's Unlink that also takes
  its sections' links (`alsoSections`); whether it should be is the user's call.
  Restore re-inserts the rows with their own ids. Positions are archived,
  never deleted (their tags and links stay; an archived one stops showing, and
  a figure left with none has no position), and a group's purge archives its
  positions with its other root rows. The archived kinds (lessons,
  variations, routines, drills, positions) are restored from Recently deleted too, with
  exactly the members' entries archived at the same instant (`reviveEntries`: an entry a member had removed earlier stays removed).
- **The type owns its page's content.** An exercise's type is derived from `source`
  (`src/lib/exercises/kinds.ts`); the exercise page asks `contentFor` and
  `practiceFor` (`components/exercises/kinds/index.ts`) for its components and
  never branches on the type.
- **One entry per exercise per local day.** `saveDay` (`src/lib/server/exercises.ts`)
  writes the day's row: a second save that day adds the time and replaces the face
  and note. The UI never says "set" (the `sets` table and `HistorySet` keep the name).
- **Data functions take `db` as their first argument** so tests run against
  `openDb(':memory:')`. Routes pass `getDb()`.
- **A spec must never touch `$DATA_DIR`.** Setting `process.env.DATABASE_PATH`
  does NOT work — the app reads it through `$env/dynamic/private`, which does
  not see a runtime mutation, so the spec silently runs against the real
  database. Tests that need the app's `getDb()` mock it:
  `vi.mock('$lib/server/db')` plus `openDb(':memory:')` per test, as
  `src/routes/[dance]/dance-wall.spec.ts` does. Data functions take `db` as
  their first argument precisely so most tests need no mock at all.
- **Nothing under `$lib/server` is imported by components.** Shared row shapes
  live in `src/lib/types.ts`.
- **Recordings are streamed, never buffered.** Raw-body POST to
  `/api/figures/[id]/recordings`; served with HTTP Range (iOS requires it). The
  size cap is `src/lib/limits.ts` — Cloudflare's 100 MB body limit is why it is
  95 MiB; nginx and `BODY_SIZE_LIMIT` in the host config sit just above it.
- **Lesson videos are chunked, recordings are not.** A recording is one request,
  so Cloudflare's 100 MB edge limit IS its cap. A lesson video is sliced into
  8 MiB chunks (`PUT .../videos/[uploadId]` with `content-range`), so its cap is
  the disk instead: 1 GiB, in `src/lib/limits.ts`. The partial file on disk is
  the only state — its size is the resume offset, a chunk must start exactly
  where the file ends, and anything else is a 409 carrying `x-received-bytes`.
  `BODY_SIZE_LIMIT` must be set on the host; adapter-node's 512 KB default is
  below one chunk and fails every upload.
- **Never add a CHECK to an existing table.** drizzle-kit rebuilds the table and
  the rebuild selects the new columns from the old one, failing at migrate time.
  A table with an incoming foreign key fails a second, independent way: the
  rebuild's `DROP TABLE` is an implicit delete, and while `openDb` sets
  `foreign_keys = ON`, drizzle's migrator runs the whole migration inside a
  transaction, where `PRAGMA foreign_keys` is a documented no-op — there is no
  point in the process where it can be turned off. Additive
  `ALTER TABLE ... ADD COLUMN` only; put the invariant in the data function, as
  `exercises.lesson_id` and the song/count pairing both do. Always read the
  generated SQL before committing it. The deliberate exceptions are migration
  `0025`, which rebuilds `team_changes` to widen its `root_kind` and `verb`
  CHECKs (root `song`; verbs share, unshare, delete, edit). It was safe because
  the columns are identical (no new column to select) and nothing has a foreign
  key into or out of `team_changes`, so neither failure mode applies. Migration
  `0029` did the same for four more tables, adding positions: `team_changes`
  (`root_kind`), `twins`, `clone_pairs` (`kind`) and `team_trash` (`position-link`),
  all with unchanged columns and no foreign key in or out. Do not
  copy it for a table with an incoming foreign key or a new column.
- **The server runs no Python and no ML.** Song downloads and beat analysis
  happen on the home worker (`worker/`, a systemd timer on backtop), which
  drains `/api/worker/*` over HTTPS with a bearer token. YouTube bot-blocks the
  server's IP, and the box has 3.7 GB shared with four other services.
- **The count is the user's, not the model's.** The grid is the detected beats
  (cleaned once on write in `storeAnalysis`); 1–8 comes from anchors the user
  tapped. Beat This!'s downbeats are only a first suggestion — measured
  unreliable on salsa.
- **Never judge the worker against `vite dev`.** The dev server skips
  SvelteKit's cross-site POST check; a worker request that passes there can
  still 403 in production. Test against `node build` or the real host.
- **A form someone fills in uses `use:guarded`, not `use:enhance`.** Same
  callback, passed as `submit`, plus a `label`. That is what makes leaving,
  or closing its sheet, ask "Unsaved changes" and lets the dialog's Save send
  it. One-tap forms (delete, move, a picker's Add) stay on `use:enhance`.
  Never a browser `confirm()` for unsaved work. See "Unsaved changes" in the
  design spec.
- **A colour on a built control is the builder's.** `iconButton(variant, tone)`,
  `FIELD_INVALID`: never append a `text-*` after the output or `.replace()` it (use
  `swap()`). Tailwind 4 orders by property, not by class order, so an appended
  class loses or wins by luck. `class-rules.spec.ts` enforces it.
  `swap()` is called in a `.ts` module, never a `.svelte` file: no spec runs a
  component's script, so its dev guard would never see a token gone from the
  builder. Variants live in `ui/styles.ts`, `video/styles.ts` and
  `player/styles.ts`, each imported by a spec (also enforced by `class-rules.spec.ts`).
- **Forms in a list column post to the list route's explicit action URL**
  (`action="/{dance}/songs?/addUrl"`), never a bare `?/x`: on desktop the column sits
  beside an item route, and a bare action would post to the item.
- **A card that clips uses `GROUP` or `CLIP`.** Rows draw their focus ring inside
  it, since the card's `overflow-hidden` would cut an outside one
  (`focus-clip.spec.ts`).
- **After a one-tap removal, focus goes to the next row** (`focusAfterRemoval`,
  `src/lib/focus.ts`), else the previous, else the list's add control: the
  removed row's focus would fall to `<body>`.
- **A refresh after a sheet or the player closes goes through `refreshWhenSettled()`.**
  SvelteKit drops a reload that a popstate overtakes, and a close's Back is one.
- **Raise PAGE_EPOCH (src/lib/page-epoch.ts) in the commit that breaks older open pages** — a changed form field, action or API shape they would still send. Open pages then reload instead of failing.
- **Deny-by-default auth** in `hooks.server.ts`: a new route is private unless
  added to `PUBLIC_PATHS`.
- **A device token signs in on `/api/` only** — never a page, never
  `/api/worker/` (`request-user.ts`). Only its SHA-256 is stored. Anything the
  Android app needs is an `/api/` endpoint; anything it shows is a page the
  app's WebView opens with the cookie session.
- **Words go through `t()`.** A screen's words live in the catalogs, never inline:
  a new screen's words go in both catalogs (en and sl, `src/lib/i18n/`), and its
  component goes in `TRANSLATED` (`src/lib/i18n/no-english.spec.ts`). Read `t()` at call
  time (in markup, a `$derived` or inside a function), never into a top-level constant.
  Slovenian: vikanje in sentences, plurals through `slCount`, a decimal comma, a person's
  name after a colon or a "·", the glossary at the top of `sl/index.ts`. What people
  write (names, notes, comments, song titles) and the count are never translated.
- **Dates on screen are built by hand** (`src/lib/format.ts`), not with
  `toLocaleDateString` — ICU versions disagree and SSR must match hydration.
- **The player's timing is the audio clock's, not `setTimeout`'s.** Counts are
  decoded clips scheduled on an `AudioContext` with a 25 ms look-ahead;
  `src/lib/scheduler/scheduler.ts` decides WHAT sounds and WHEN in song time and
  never touches audio. Figure names go through `speechSynthesis`, which cannot be
  scheduled and does not need to be.
- **Levels hide entry points, never routes.** No route 404s or redirects
  because of a level (the first-run gate for a null level, and My class's tab
  landing on the one class, are the exceptions). Components ask
  `src/lib/levels/levels.ts`, never compare level strings, and read the level
  through `levelShown` (null draws as Everything). A lesson or group the person
  edits stays the full page at every level (a group's lesson or group; a person's own lesson is read-only at Follow my class).
- **An account belongs to one dance** (the dance split). `users.dance`; email is
  unique per dance; each dance is its own app on its own host (`DANCE_HOSTS`,
  `src/lib/dances/hosts.ts`). The wall is the account's dance, never the host:
  `wallOf` 404s a route whose dance is not `locals.user.dance`, the `[dance]`
  layout does too, and a flat route takes the account's dance or a row it owns,
  never a dance from the request. Login, Join, invites, `/g/<code>`, joining a
  group (`sameDance`), pairing, Get the app and the admin are per dance. The host
  only picks the login, the redirects (`hostRedirect` in the hook) and `/`.
  `appDance` (root layout) is the request's dance. Accounts that held both
  dances were split at boot (`dance-split.ts`), and `danceIntegrity` reports
  rows on the wrong side.
- **A dance is the wall through the content.** `figures`, `songs`, `exercises`,
  `lessons` and `positions` carry `dance`; `sets`, `recordings`, the lesson join tables,
  a figure's position tags and `video_spots` derive it through their parent (a
  figure, a recording or a lesson video), and `count_takes` belongs to its account, so to one dance. Scoping
  happens in the data-access layer — `src/lib/schedule/` and `src/lib/day/`
  never learn that dances exist. `video_spots`' own API is flat
  (`/api/video-spots`), like the media servers.
- **A person or a group is the wall inside the dance.** The root tables —
  `figure_groups`, `figures`, `songs`, `exercises`, `lessons`, `routines`,
  `positions` — carry `user_id` and `team_id`, exactly one set (a group's rows
  have `user_id` NULL; `ownerIntegrity` checks). `count_takes` carries
  `user_id` only: a take is a person's own voice. Both are set on every insert
  from the request's space: `Space = Wall | TeamSpace`, a `Wall` being
  `{ userId, dance }` (`wallOf(params, locals)` in `src/lib/server/scope.ts`) and
  a `TeamSpace` `{ dance, teamId, actorId }`. `ownedBy`, `ownerValues`, `inSpace`
  and `spaceOfRow` in `scope.ts` filter, write and compare by either. Everything
  else (sets, recordings, lesson videos, spots, spot links and spot position
  links, the lesson join tables, a figure's start and end position tags, links,
  video downloads, routine steps) derives its owner through its
  parent, as it derives its dance. Data functions take a `Wall` or a `Space`
  where they once took a dance; a comparison of two rows is `inWall(row, wall)`
  or `inSpace`, never `.dance` alone. Another person's id and a missing one get
  the same 404, and so does a member asking to write: a member only reads a
  group's published lessons, and `access.ts` decides (`reach` is what a person
  reaches through published lessons, and a member of a deleted group, until
  its purge, through the lessons they added; someone who left or was removed
  reaches nothing of the group, their kept copies are their own; a draft
  reaches nobody but its editors). The `require*Access` guards
  in `scope.ts` (lesson, figure, routine, exercise, position) are how a route asks.
  What a member reads of a group's positions is what a reached figure is
  tagged with, a reached lesson links by hand, or a spot on a reached lesson's
  video or figure's recording links.
  Entries are per person: Add makes an ordinary `exercises` row of the person
  (`entries.ts`, unique per person and target), and every "my entry" lookup is
  by that person only, so another member's settings and logs never show.
  A person's own rows may point at a group row they may use, not only at
  their own: their routines' slots and embeds, their lessons' hand links,
  their section links and their figures' position tags take a group's figure,
  routine, drill or position from `usableOf`
  (`src/lib/server/usable.ts`: what their added lessons reach, and what their
  rows already use and still read, in a group they are still a member of),
  and reading such a link always goes through `access.ts`. A group's row
  only ever points at rows of its own group. `crossRefs`
  (`src/lib/server/integrity.ts`) checks both, archived routines and lessons
  included; every spec that changes reach asserts it is `[]`, and boot logs it.
  Flat routes — `/api/video-spots*`, the uploads, and the four media servers
  (`recordings`, `audio`, `count`, `lesson-videos`) — have no dance in the URL,
  so they ask `access.ts` (`fileAccess`, `videoAccess`, `spotAccess`) about
  `locals.user.id`. The worker's queue (`/api/worker/*`) is global; a
  job's result lands on its own row, so it belongs to whoever owns that row;
  `video_downloads.requested_by` is who a saved video is credited to. See
  [`docs/superpowers/specs/2026-11-02-accounts-design.md`](docs/superpowers/specs/2026-11-02-accounts-design.md),
  [`docs/superpowers/specs/2026-11-02-groups-design.md`](docs/superpowers/specs/2026-11-02-groups-design.md),
  [`docs/superpowers/specs/2026-11-03-clones-and-twins-design.md`](docs/superpowers/specs/2026-11-03-clones-and-twins-design.md),
  and [`docs/superpowers/specs/2026-11-04-positions-design.md`](docs/superpowers/specs/2026-11-04-positions-design.md).
- **Songs: a person's own and a group's differ.** A person's own song keeps
  the `deleteSong` refusal. A group song (`songs.team_id`, `shared_at` null
  while a draft) is the teacher's to withdraw: Stop sharing or Delete (an
  archive, in Recently deleted) asks with a warning, members' entries drop to
  count only, and `song_drops` remembers them so Share or Restore brings the
  song back on those entries. Only picking a different song ends that
  comeback. The clash check (`seen`) applies to group songs only. Every place
  that serves a song (audio, grid, player, practice settings, the picker) asks
  `songAccess`. See
  [`docs/superpowers/specs/2026-11-03-groups-follow-ups-design.md`](docs/superpowers/specs/2026-11-03-groups-follow-ups-design.md).
- **Opens are recorded from the page, never in a load.** What's new clears by
  opening a lesson or song, written by `POST /api/opens` (kind `lesson` or
  `song`; `comments`, item the lesson, when the comments sheet opens, for the
  card's "N new"). SvelteKit preloads data on hover and touch, so a load that recorded
  would clear the dot for a page nobody opened.
- **Every group mutation is logged, in its own transaction.** `logChange`
  (`src/lib/server/changes.ts`) with a real actor, so History is complete. A
  new group mutation is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`,
  which fails otherwise. Worker state is exempt: the worker's own writes
  (status, audio, beats) and a song's Retry (`retrySong`, which only re-queues
  a failed download) change no field a person edits, so they are not logged.
  Comments are exempt too: posting, hearting, deleting and restoring a comment
  are a conversation, not the group's content, so they are not in History or
  in `MUTATIONS`.
- **What grows a published lesson runs auto-add.** A group mutation that can
  give a lesson something new to practise (`newInLesson`: its routines and
  drills) calls `autoAddPending` for that lesson in its transaction, and is
  listed in `GROWTH` in `src/lib/server/auto-add.spec.ts` beside the reason;
  the spec's insert-site scan fails when a new insert into `lesson_routines`,
  `lesson_exercises` or `spot_links` is not placed. Figure links and routine
  edits are not growth: Add never adds a figure, and a routine holds no drills.
- **A save on a group row carries `seen`.** The clash check
  (`src/lib/server/clash.ts`) compares what the editor saw with the row now;
  `seen` must cover every field the save writes, or a quiet overwrite slips
  through.
- **Reach shrinks, entries follow.** `reconcileEntries` runs in every group
  change that can shrink someone's reach (an archived lesson, an unlinked
  section or link; a lesson is never unpublished) and on membership changes, so no entry points at what its person can
  no longer reach. It also runs the rescue (`rescueUsed`,
  `src/lib/server/clones/rescue.ts`): what a person's own rows use (a slot, an
  embed, a lesson or section link) and they can no longer read is copied into
  their app, no recordings, inside the same transaction, and their rows and
  practice are re-pointed onto the copy, which starts paused unless a live
  entry carries it. Leaving and removal run Keep (`keepFromTeam`) BEFORE the
  membership goes, so the rescue never copies first without recordings; the
  purge keeps for every member (the deleter: only what their own rows use).
- **Clones: links are row ids, genes only match.** A family (`gene_id`, with
  `cloned_from` for "From …" and Detach) has at most one member per place: a
  person's app or a group for the root tables (unique indexes per owner; an
  archived member holds its place, and a copy there offers to restore it), the
  parent row for recordings, lesson videos and sections (checked in the data
  function and in `restoreTrash`; `familyIntegrity` reports a breach). Every
  link (slots, section links, lesson links, entries, lesson adds, a figure's
  position tags) stays a concrete row id: a gene is read only to find a member (`memberIn`,
  `familyRows`), and every re-point is an explicit update in the same
  transaction (`repoint`). A figure copied into a place (Copy to…, Make it
  mine, the rescue, Keep) is tagged with that place's member of each
  position's family, the position copied there when the place has none.
  `clone_pairs` (a hash per field of what two members
  held when last in step) is written by a copy, a Sync and a flow (Take a
  recording too), never by a save itself; `clone_marks` (what a copy held after
  its last save) by every save on a copy, through `flowing`/`flowAfter`, which
  is how a save learns what it changed. `clone_sync` holds Keep in step per copy. A clone's file is a
  hard link under a new name (`CloneFiles`), linked before the write and
  unlinked when the write throws.
- **Twins are views.** The `twins` table is a person's own "same move", read
  only by the lists, pickers and pages that fold or tab them
  (`src/lib/clones/twins.ts`, `src/lib/server/twins.ts`); `repoint` keeps a
  person's sets on the row that replaces one. Nothing else learns of it:
  twins never sync, never travel, and plans, coverage and Today read rows as
  they are. Groups have none. The one exception is a person's graph: twinned
  POSITIONS are one hold in it. `buildGraph` (`src/lib/server/graph.ts`)
  reads the `twins` table itself and folds each of the person's twin sets of
  positions, families and all, into one canonical id (their own member, else
  the lowest id), so every reader of that graph reads them as one: the
  routine picker's fit, breaks and seams, whether a routine loops, coverage,
  the player's plan, the figure page's Leads to / Follows from, the gap
  report and the list's counts, and the map (one node, marked Twins).
  Everything else — the lists, pickers and pages that fold or tab twins
  aside — reads position rows as they are. A group's space reads no twins.
- **Positions are optional: an empty side fits anything** (`meet` in
  `src/lib/graph/graph.ts`, the one rule for "can these hands meet"). A
  figure with no start can follow anything, one with no end can be followed
  by anything, and a slot's starts are anywhere when one of its options has
  none. A person who never adds a position sees no break, no gap and no nag.
  Nobody starts with any (no seeding); Templates add them on request. The
  graph compares positions by family (`gene_id`, else the row id), never by
  row id, so a person's figure ending in their Cerrada meets a group figure
  starting in the group's copy of it; a slot's alternatives must share the
  same set of ends, compared by family. A figure is tagged only with its
  owner's positions or, a person's, a group's they may use; a group's
  figure only with its group's (`writeFigureShape`).
- **`figures.style` is vestigial; `style_tag` is real.** Read by nothing,
  backfilled into `style_tag` by migration 0005. Do not drop it or widen
  `figures_style_ck` — see the CHECK rule above for why a rebuild here can't
  be done safely.
- **`positions.neutral`, `positions.slug`, `positions.sort_order` and
  `figures.end_position_id` are vestigial.** The neutral position went
  (an untagged side fits anything), lists sort by type then name, and a
  figure's ends are `figure_end_positions` (filled from `end_position_id` by
  the boot move, `positions-move.ts`, its one reader). Otherwise read by
  nothing, not dropped, for the same reason as `style`. New positions get `slug = 'p-' + uuid`; slugs are no
  longer unique (`positions_dance_slug_idx` was dropped, an index, not a rebuild).
- **`figures.eights` is vestigial; `length_counts` is real.** Copied into
  `length_counts` (`eights * 8`) by migration 0010 and read by nothing since.
  Same reason as `style`: dropping it is a rebuild, and `figures` can never be
  rebuilt. Timing arithmetic lives in `src/lib/graph/timing.ts`.
- **A `figures` row is a figure; a `figure_groups` row is a move.** Every
  live figure has a live move of its dance and a name unique within it;
  move names are unique per dance; the last figure leaving archives its
  move (`figures.ts`). Show a figure with `figureLabels`
  ("Enchufla · Doble"), always. `figures.parent_id` is vestigial, read by
  nothing, not dropped.
- **`exercises.every_days` is vestigial as a setting.** Nobody sets it any more; it is
  read only as an exercise's FIRST gap (and by old rows), then the faces take over.
  Not dropped, for the same reason as `style`.
- **`figures.callable` and `figures.call_text` are vestigial.** They were the
  random drill's pool and a spoken override for the name; the drill was
  removed and both are read by nothing. Only a routine calls figures, and the
  voice says the name. Not dropped, for the same reason as `style`.

## Commands

```sh
npm run dev           # DATA_DIR/DATABASE_PATH come from the flake (.data/)
npm run check         # prettier + eslint + svelte-check + build + vitest — must pass
npm run db:generate   # after editing src/lib/server/db/schema.ts
./scripts/deploy.sh   # see docs/deployment.md
# slots: C-1…C-9 in tmux; prefix C-a for reset-db and close slot (tmux_project)
./scripts/make-clips.sh   # regenerate static/clips/ — only when the voice changes
./scripts/make-icons.sh   # regenerate static/icons/ — only when an icon SVG changes
nix develop .#android -c ./android/gradlew -p android test assembleDebug   # the APK; see docs/deployment.md
```

The dev database has no songs and the home worker does not run against it, so
the player's song mode has nothing to open. To exercise it locally, insert a
song row by hand with `status='ready'`, an `audio_file` under `.data/audio/`,
and a `beats_json` array — a click track from ffmpeg plus evenly spaced beats is
enough to check the count, the clave and the calls. Set `dance` too: it defaults
to `'salsa'`, so a row inserted without it is invisible from `/bachata/player`.

In dev, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first run; an admin is
created at boot in each dance that has no account. `DANCE_HOSTS` is unset in dev,
so the path decides the dance; sign in to bachata at `/login?dance=bachata`.
