# Hard rules, in full

Moved out of CLAUDE.md on 2026-11-08. CLAUDE.md keeps each rule in a line or two; this is the full text with the reasons and the exceptions. Read the matching rule here before touching its area, and keep both in step when a rule changes.

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
  a new screen's words go in both catalogs (en and sl, `src/lib/i18n/`); every component
  is checked for bare English (`no-english.spec.ts`; a component it must skip goes in
  `EXEMPT` with its reason), and every server refusal a person reads goes through `t()`
  inside the request, never a top-level constant (`refusals-guard.spec.ts`). Read `t()` at
  call time (in markup, a `$derived` or inside a function), never into a top-level
  constant; an object table is `lazyWords` (`lazy.ts`). Slovenian: vikanje in sentences,
  plurals through `slCount` (all four forms), a count after a verb or preposition is its
  own entry, in its case ("Dodaj 3 položaje", "v 2 kombinacijah"; `nouns` is only the
  nominative), a decimal comma, quotes » «, a person's name after a colon or a "·", the
  glossary at the top of `sl/index.ts`. Text the app writes into the database is in the
  actor's language; text composed at read time (History, refusals) in the reader's.
  Machines keep English (the worker's queue, the media servers, `/releases`,
  `/api/app-update`, the 426). What people write (names, notes, comments, song titles)
  and the count are never translated. The Android app's own words are
  `android/app/src/main/kotlin/eu/anotherroot/salsa/Words.kt` (the account's language,
  from `/api/device/config`).
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

