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
exercise types (a log popup per type, links with YouTube embeds, a practice
panel in the popup, an exercise page) and figure timing (a start count and a
length in counts; routines report timing breaks) and figures as variations (a
figure is a name holding self-contained variations; Move to… another figure or a
new one; switcher at the bottom)
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
Groups, Music; one look in four themes from `tokens.ts`; the shared components in `components/ui/`;
designed error pages) and accounts (one-time invites from the admin, a person's own private app, a storage limit with What uses space and Ask for more, an admin page) and groups (a Groups tab; a class makes a group and people join by its code or
`/g/<code>`; lessons are drafts until published; Add copies a published lesson's
drills into a person's own practice, with per-person entries; a clash check on
shared edits; History; Recently deleted for 30 days; the group's own storage;
Make my own copy; names).

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
the per-type log popup, links, and the in-popup practice panel.
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
and the Today / Moves / Lessons / Groups / Music tab bar. The design board it comes from
is in `docs/superpowers/design-kit/`.
Accounts have theirs,
[`docs/superpowers/specs/2026-11-02-accounts-design.md`](docs/superpowers/specs/2026-11-02-accounts-design.md):
the owner wall, one-time invites and Join, the storage limit and what counts
against it, What uses space, Ask for more, and the admin page.
Groups have theirs,
[`docs/superpowers/specs/2026-11-02-groups-design.md`](docs/superpowers/specs/2026-11-02-groups-design.md):
the group as a wall beside the person, draft and publish, what a member
reaches, Add and entries, the clash check, the safety net (History, Recently
deleted), leaving and deleted groups, Make my own copy, the group's storage.

Toolchain comes from the nix flake — `nix develop`, or `direnv allow` once.
Sister project with the same conventions: `~/Projects/muscle_model`.

## Layout

```
src/lib/day/         PURE calendar-day maths in the user's zone. `now` is an argument
src/lib/urgency/     PURE "what next": (exercises, sets, now, tz) →
                     doneToday/due/upcoming/inactive
src/lib/beatgrid/    PURE beats → the dance count: gap filling, anchors, tempo factor
src/lib/scheduler/   PURE cues: grid + plan + toggles + window → what sounds when
src/lib/dances/      PURE registry: one entry per dance (styles, count patterns,
                     whether clave exists, accent colours). Client-safe
src/lib/graph/       PURE figure graph: positions → what can follow what, the
                     gap report. Client-safe
src/lib/moves/       PURE: what the Moves lists show — filter chips, headings, empty states,
                     meta words, gaps, pick order. Client-safe
src/lib/routines/    PURE routine algebra: slots, variants, breaks, whether it
                     loops, the routine as the player's plan, coverage
                     (which routines can call each version), which routines use a
                     version (`routinesUsing`, coverage.ts), the picker's fitting
                     (fit.ts), the selection's rules, the delete snapshot, and the routine
                     page's wording and where a refusal shows (page.ts).
                     Client-safe
src/lib/figures/     PURE: a figure page's lines — timing, the practice line, the
                     variation switcher's steps, Move and Archive wording, the
                     delete question, the length check. Client-safe
src/lib/lessons/     PURE: the Lessons list's month groups, date tiles and counts; a lesson
                     page's lines — via-section badges, row metas, the delete and unlink
                     questions. Client-safe
src/lib/links.ts     PURE URL parsing (YouTube-aware) and linkified notes —
                     no {@html}. Client-safe
src/lib/exercises/   PURE: the type registry (kinds.ts), practice config and
                     where a practice opens (practice.ts), a wall-clock
                     stopwatch, the Today session, what Today shows (today.ts: bands,
                     meta lines, hero states, past-day groups) and the type
                     tile's icon and name (tile.ts), what the log popup shows
                     (log-view.ts: the footer's states, range errors, the rating
                     toggle) and the exercise page (exercise-page.ts).
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
                     PickerOpener.svelte (the full-width tonal button that opens one)
src/lib/components/ui/PlayerLayer.svelte  a Sheet or Dialog as an overlay inside the
                     full-screen player (`.theme-media`), not a second top-layer dialog
src/lib/gestures/    PURE drag and swipe arithmetic, DOM-free like longpress.ts.
                     Client-safe
src/lib/unsaved/     what leaving would lose: fingerprint.ts and pending.ts are PURE;
                     guard.svelte.ts is the live list, `use:guarded`, and the
                     navigation guard. ui/UnsavedDialog.svelte asks the question
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
src/lib/settings/    view.ts: PURE, the reminder rule and the paired-phone device lines
src/app.html         a script before the first paint: the theme choice → `data-theme`
                     (light/dark, told to the Android shell), and the Android app's
                     insets → `--safe-*`. Read the safe area through `--safe-*`, never
                     `env()` (class-rules.spec.ts): the app draws the page under its bars
src/routes/dev/kit/  the kit gallery: every shared component in every state, to
                     compare with the design board. Dev only (404 in a build)
docs/superpowers/design-kit/  the design board source (kit.py) the redesign was ported from
src/lib/sheets/      stack.ts is PURE: one history entry per open Sheet behind a
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
src/lib/server/teams.ts  groups: make, code, rename, delete; `membership.ts`: join, leave,
                     remove, roles
src/lib/server/access.ts  what a person may do with a row: `reach` (what they reach
                     through published lessons, plus their added lessons after leaving),
                     `lessonAccess`/`figureAccess`/…, and `fileAccess`/`videoAccess`/`spotAccess`
                     for the flat routes
src/lib/server/entries.ts  per-person entries (Add, Remove, `reconcileEntries`)
src/lib/server/changes.ts  `logChange`: History, one line per group mutation, in its transaction
src/lib/server/clash.ts  the clash check: `seen` against the current row
src/lib/server/trash.ts  `team_trash` (30 days, files kept) and `purgeTrash`;
                     `team-purge.ts` (`purgeTeams`) finishes deleted groups
src/lib/server/copy-lesson.ts  Make my own copy: a lesson into a person's own space
src/lib/server/integrity.ts  `ownerIntegrity`: rows whose owner is not exactly one of person or group
src/lib/teams/       PURE: the Groups pages' lines (view.ts), Add (add.ts), History
                     (history.ts), Recently deleted (deleted.ts, restore-api.ts). Client-safe
src/lib/clash/       PURE: what a clash shows and how a field merges. Client-safe
src/lib/names.ts     PURE: first names and how a person is shown. Client-safe
src/lib/server/lesson-links.ts  what reaches a lesson through its videos' sections —
                     derived, never stored; lessons.ts and spot-links.ts read it
src/lib/server/link-popup.ts  the Link popup's data and create-and-link (one
                     transaction); served by /api/video-spots/[id]/links
src/lib/server/devices.ts  device tokens (hash only), the app's settings, dueByDance
src/lib/server/undo-hold.ts  what Undo needs, held 60 s in memory (a removed paired phone, a
                     deleted voice take); a take's wav is unlinked when its hold expires
src/lib/server/request-user.ts  where a device token may sign in: /api/ only
src/lib/server/storage.ts  what a person uses (computed from size columns, never stored), `roomFor`
                     (refuses at or over the limit), and `listStorageItems` for What uses space
src/lib/server/invites.ts  one-time invites and joining with one
src/routes/admin/    the admin page: people, limits, invites, requests for more space
src/routes/join/     Join: a person creates their account from an invite link (public)
src/routes/[dance]/groups/**  the Groups tab: the list, make and join, a group's page, its
                     people, storage, History and Recently deleted
src/routes/g/[code]  a group code's link: Join `<name>`? (needs an account already)
src/routes/welcome/  where a new person lands after Join
src/routes/api/trash/[id]  restore a group's trashed row; src/routes/api/archived lists
                     what Recently deleted can restore
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
src/lib/components/  ui/ shell/ today/ figures/ lessons/ songs/ player/
                     exercises/ links/ routines/ moves/ (the Moves band and its tiles) system/
                     (error, offline, choice sheet, status block, lead tile).
                     ui/styles.ts holds the class builders: `button(kind, size, full)`,
                     `iconButton(variant, tone)`, `FIELD`/`TEXTAREA`/`SELECT` and their
                     `_INVALID` twins, `CHIP`, `GROUP` and `CLIP` (`focus-inset`: a card that
                     clips), and `swap()`, which throws in dev and tests when the class token it replaces is missing
                     ui/SearchField.svelte is the search pill, ui/FieldError.svelte the
                     line under a refused field
src/lib/server/      db (SQLite via Drizzle), auth, data access, form parsing, files
src/lib/server/scope.ts  the wall at the route level: `Wall` ({ userId, dance }),
                     `wallOf(params, locals)`, `inWall(row, wall)` and the
                     `require*InWall` guards on ids, so a request only ever reaches
                     its own person's side of its own dance. `danceOf` and
                     `requirePositionInDance` are for the shared positions only
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

- **Urgency is never stored.** No "last done" column, no cron. It is a pure
  function of the sets, recomputed per request (`src/lib/urgency/`). Priority IS
  frequency (`every_days`).
- **Elapsed time sorts; calendar days speak.** Anything a user reads as a day
  ("yesterday", "done today", which day a set belongs to) goes through
  `localDay`/`daysBetween` in the user's zone. Elapsed ms is only for the
  urgency ratio. Never `Date.now()` inside `src/lib/day` or `src/lib/urgency`.
- **Every instant is an integer of epoch ms** in the database, never a Date.
- **Archive, don't delete.** Figures and exercises get `archived_at`; songs
  (only from Settings → What uses space, `deleteSong`: refused while a live
  exercise uses it, archived ones lose `song_id`), sets, recordings, links,
  spots (`video_spots`, deleted with their video), section links (`spot_links`,
  deleted on unlink) and saves in flight (`video_downloads`, deleted with their
  link, or when the link becomes a video) are the only hard deletes. A
  variation's exercise is opt-in (`addFigureExercise`); when one exists it is
  renamed and archived WITH its variation, in one transaction
  (`src/lib/server/figures.ts`). A linked spot, and the video it is on, cannot
  be deleted until it is unlinked — archived targets included (`assertUnlinked`
  in `src/lib/server/spot-links.ts`). A removed paired phone and a deleted voice
  take come back with Undo for a minute: both are deleted at once and kept in an
  in-memory hold (`src/lib/server/undo-hold.ts`); a take's file is unlinked when
  its hold expires. In a group, the hard-delete kinds (videos, sections, links,
  section links, recordings) are still deleted at once, and kept 30 days in
  `team_trash`, file included (`src/lib/server/trash.ts`): the delete returns a
  trash id and the route must not unlink the file; `purgeTrash` and `purgeTeams` do, at boot and hourly.
  Restore re-inserts the rows with their own ids. The archived kinds (lessons,
  variations, routines, drills) are restored from Recently deleted too, with
  exactly the members' entries archived at the same instant (`reviveEntries`: an entry a member had removed earlier stays removed).
- **The type owns its popup.** An exercise's type is derived from `source`
  (`src/lib/exercises/kinds.ts`); pages ask `logFor`/`contentFor` for its
  components and never branch on it.
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
  generated SQL before committing it.
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
- **A card that clips uses `GROUP` or `CLIP`.** Rows draw their focus ring inside
  it, since the card's `overflow-hidden` would cut an outside one
  (`focus-clip.spec.ts`).
- **After a one-tap removal, focus goes to the next row** (`focusAfterRemoval`,
  `src/lib/focus.ts`), else the previous, else the list's add control: the
  removed row's focus would fall to `<body>`.
- **A refresh after a sheet or the player closes goes through `refreshWhenSettled()`.**
  SvelteKit drops a reload that a popstate overtakes, and a close's Back is one.
- **Deny-by-default auth** in `hooks.server.ts`: a new route is private unless
  added to `PUBLIC_PATHS`.
- **A device token signs in on `/api/` only** — never a page, never
  `/api/worker/` (`request-user.ts`). Only its SHA-256 is stored. Anything the
  Android app needs is an `/api/` endpoint; anything it shows is a page the
  app's WebView opens with the cookie session.
- **Dates on screen are built by hand** (`src/lib/format.ts`), not with
  `toLocaleDateString` — ICU versions disagree and SSR must match hydration.
- **The player's timing is the audio clock's, not `setTimeout`'s.** Counts are
  decoded clips scheduled on an `AudioContext` with a 25 ms look-ahead;
  `src/lib/scheduler/scheduler.ts` decides WHAT sounds and WHEN in song time and
  never touches audio. Figure names go through `speechSynthesis`, which cannot be
  scheduled and does not need to be.
- **A dance is the wall through the content.** `figures`, `songs`, `exercises`
  and `lessons` carry `dance`; `sets`, `recordings`, the lesson join tables
  and `video_spots` derive it through their parent (a recording or a lesson
  video), and `count_takes` is shared by both dances on purpose. Scoping
  happens in the data-access layer — `src/lib/urgency/` and `src/lib/day/`
  never learn that dances exist. `video_spots`' own API is flat
  (`/api/video-spots`), like the media servers.
- **A person or a group is the wall inside the dance.** The root tables —
  `figure_groups`, `figures`, `songs`, `exercises`, `lessons`, `routines`,
  `count_takes` — carry `user_id` and `team_id`, exactly one set (a group's rows
  have `user_id` NULL; `ownerIntegrity` checks). Both are set on every insert
  from the request's space: `Space = Wall | TeamSpace`, a `Wall` being
  `{ userId, dance }` (`wallOf(params, locals)` in `src/lib/server/scope.ts`) and
  a `TeamSpace` `{ dance, teamId, actorId }`. `ownedBy`, `ownerValues`, `inSpace`
  and `spaceOfRow` in `scope.ts` filter, write and compare by either. Everything
  else (sets, recordings, lesson videos, spots, spot links, the lesson join
  tables, links, video downloads, routine steps) derives its owner through its
  parent, as it derives its dance. Data functions take a `Wall` or a `Space`
  where they once took a dance; a comparison of two rows is `inWall(row, wall)`
  or `inSpace`, never `.dance` alone. Another person's id and a missing one get
  the same 404, and so does a member asking to write: a member only reads a
  group's published lessons, and `access.ts` decides (`reach` is what a person
  reaches through published lessons, and through lessons they added after
  leaving; a draft reaches nobody but its editors). The `require*Access` guards
  in `scope.ts` (lesson, figure, routine, exercise) are how a route asks.
  Entries are per person: Add makes an ordinary `exercises` row of the person
  (`entries.ts`, unique per person and target), and every "my entry" lookup is
  by that person only, so another member's settings and logs never show.
  Flat routes — `/api/video-spots*`, the uploads, and the four media servers
  (`recordings`, `audio`, `count`, `lesson-videos`) — have no dance in the URL,
  so they ask `access.ts` (`fileAccess`, `videoAccess`, `spotAccess`) about
  `locals.user.id`. Positions are the one exception: one shared list per dance,
  edited only by the admin. The worker's queue (`/api/worker/*`) is global; a
  job's result lands on its own row, so it belongs to whoever owns that row;
  `video_downloads.requested_by` is who a saved video is credited to. See
  [`docs/superpowers/specs/2026-11-02-accounts-design.md`](docs/superpowers/specs/2026-11-02-accounts-design.md)
  and [`docs/superpowers/specs/2026-11-02-groups-design.md`](docs/superpowers/specs/2026-11-02-groups-design.md).
- **Every group mutation is logged, in its own transaction.** `logChange`
  (`src/lib/server/changes.ts`) with a real actor, so History is complete. A
  new group mutation is added to `MUTATIONS` in `src/lib/server/changes.spec.ts`,
  which fails otherwise.
- **A save on a group row carries `seen`.** The clash check
  (`src/lib/server/clash.ts`) compares what the editor saw with the row now;
  `seen` must cover every field the save writes, or a quiet overwrite slips
  through.
- **Reach shrinks, entries follow.** `reconcileEntries` runs in every group
  change that can shrink someone's reach (unpublish, delete, an unlinked
  section) and on membership changes, so no entry points at what its person can
  no longer reach.
- **`figures.style` is vestigial; `style_tag` is real.** Read by nothing,
  backfilled into `style_tag` by migration 0005. Do not drop it or widen
  `figures_style_ck` — see the CHECK rule above for why a rebuild here can't
  be done safely.
- **`figures.eights` is vestigial; `length_counts` is real.** Copied into
  `length_counts` (`eights * 8`) by migration 0010 and read by nothing since.
  Same reason as `style`: dropping it is a rebuild, and `figures` can never be
  rebuilt. Timing arithmetic lives in `src/lib/graph/timing.ts`.
- **A `figures` row is a variation; a `figure_groups` row is a figure.** Every
  live variation has a live group of its dance and a name unique within it;
  figure names are unique per dance; the last variation leaving archives its
  figure (`figures.ts`). Show a variation with `figureLabels`
  ("Enchufla · Doble"), always. `figures.parent_id` is vestigial, read by
  nothing, not dropped.
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

In dev, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first run; the admin is
created at boot when no user exists.
