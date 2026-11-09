# The app on the device: offline, and videos that stay on the phone

The app keeps working with no signal, and a person can keep as many videos
as they like on their phone, at any quality, without uploading them. The
server stays where everyone's data lives: groups, the home worker and the
work PC all depend on it. What changes is that every device keeps a full
working copy of what its person can see, works on that copy, and syncs
when it can.

Agreed with the user on 2026-11-07. The user handed the technical approach
to Claude ("I'll leave it to you"). Everything under "How it is built" is
Claude's call unless it says otherwise.

## Why

The user's own moments:

- **Recordings of yourself you never want uploaded.** Lots of practice
  footage, at full quality. Nobody else needs it, so it doesn't need a
  backup. It only needs to be on the phone.
- **Building a routine where the signal is bad.**
- **Practising in a basement** with no signal: Today, logging sets, the
  player with a song and the count, the videos.
- **Watching lesson videos on a train.**

Today the phone is a window onto the server. All 44 server loads and about
200 form actions run there, and with no connection the app shows "This page
needs the server" (`src/routes/+layout.svelte`). Videos are capped by the
server: a storage limit per account (1 GiB by default), 95 MiB per
recording and 1 GiB per lesson video. The Android app also re-encodes
videos to 480p by default before uploading.

## Goals

- Every screen a person uses to practise and to build their own things
  works with no connection: Today, Moves (figures, moves, routines,
  positions, the map, Coverage), Lessons, Music and the song pages, the
  Practice player, the video player with sections and points, My count, and
  Settings (except what is listed as blocked below). Their changes sync
  when signal comes back.
- Videos (recordings and lesson videos) can live only on the phone, as the
  original file, untouched, in any number and any size. That is the default
  for a person's own things.
- Server videos can be kept on the phone on request, to watch on a train.
- **Devices:** the Android app, an iPhone through the home-screen web app,
  and a desktop browser. A future desktop app should reuse the same pieces
  (out of scope now, but nothing here may make it harder).

## Non-goals

- A native iPhone app. That needs a Mac and Apple's developer account and
  comes later; until then the iPhone runs the home-screen web app, with the
  warning described below.
- A backup of phone-only videos. Losing the phone loses them; that is the
  point of phone-only.
- Devices syncing directly with each other. Everything goes through the
  server.
- Doing the home worker's jobs on the phone: song downloads, beat analysis,
  YouTube saves.
- Groups without a server. Groups are other people, so they sync through
  it.

## Anti-goals (a failure even if it works)

- A logged set, a recording or anything newly made is lost because of a
  clash or a failed sync. Every refusal stays visible with its content
  until the person deals with it.
- A phone-only video is uploaded without the person asking.
- A device receives a row its person may not read: another person's rows,
  a group draft a member doesn't edit, a group they left.
- The app opens slower than it does today, or the phone's copy makes
  everyday screens sluggish.

## What the person sees

### Working with no signal

Everything listed under Goals works the same online and offline. A change
is saved on the device at once and synced in the background. There's a
sync status somewhere quiet (to be designed, see "The look"): it says
nothing while all is synced, and shows when changes are waiting or
something couldn't sync.

The old offline screen ("This page needs the server") goes away, except for
the blocked actions below, which say "Needs a connection" where they
are.

### Clashes (agreed)

- **A person's own things:** the later edit wins, field by field, without
  asking. Edit a routine's name on the phone and its notes on the PC, and
  both changes stay. Edit the same field on both, and the one made later
  wins.
- **A group's things** (a teacher editing a class lesson offline): when the
  device syncs and someone else changed the same thing in the meantime,
  the existing clash screen shows (`src/lib/server/clash.ts`,
  `src/lib/clash/`), exactly as it does today for two editors online.
- **Never lost:** logged sets, recordings, sections, links and new rows are
  never dropped by a clash. If one can't be applied (the figure it hangs
  on was archived meanwhile, say), it goes on a "Couldn't sync" list that
  shows what it was, with a way to retry or discard it.

### Queued while offline, or blocked (agreed)

**Queued.** These are ordinary changes that sync later, each showing a
small "waiting for connection" mark until it's done:

- adding a song by link;
- Save video from YouTube;
- uploading a video;
- publishing a lesson;
- posting a comment, and hearts.

The home worker then does its part once the change reaches the server, as
it does today.

**Blocked offline, greyed with "Needs a connection".** These change several
people's things at once on the server, or need an answer right away:

- joining a group with a code (also the first run's Join your class);
- Copy to…, Take, Send, Compare, Make it mine, Drop my copy, Detach, Move
  to… a group;
- signing in;
- Join from an invite;
- the admin page;
- pairing a phone;
- the app update check.

**Blocked offline too (Claude's call).** These are left out of the device
copy because they are server bookkeeping:

- a group's History, Recently deleted and its people page (roles, remove);
- leaving or deleting a group, making a group, and a new group code;
- What uses space, and Ask for more.

Online, every blocked action works as it does today.

### Signing in

The first sign-in on a device needs signal and downloads the person's copy.
After that the device stays signed in offline indefinitely. If the session
has expired by the time signal comes back, the person signs in again and
nothing waiting to sync is lost.

### Videos (agreed)

- **A new video stays on the phone by default:** recordings and lesson
  videos, as the original file, untouched. This applies to a person's own
  figures and lessons.
- **Upload** is a button on the video. It sends a smaller copy (480, 720 or
  1080, from Settings → video size, as today) to the server. Then the work
  PC can play it and it's backed up, and that copy counts against the
  storage limit as today. The full-quality original stays on the phone and
  is what the phone plays.
- **Download** brings a server video onto the phone (see Keep on this
  phone). **Remove the server copy** turns an uploaded video back into
  phone-only and frees the server space.
- **A group's videos always upload,** because the members need them. Adding
  a video to a group's lesson or figure queues its upload. A phone-only
  video can't be moved or copied into a group without uploading.
- Sections, points and section links work the same on a phone-only video.
  They are ordinary rows, so they sync. On another device the video shows
  as "On <device name>": its sections and links are listed but it can't
  play.
- Deleting a phone-only video is permanent, and the question says so.
- Phone-only videos don't count against the storage limit. Only server
  copies do.
- **On Android, phone-only videos stay in the phone's gallery (agreed).**
  The app points at the gallery file and never copies it, so camera
  footage doesn't take double the space. The videos are still in Photos,
  and they survive reinstalling the app (Android deletes an app's own
  storage on uninstall).
  - Videos filmed from inside the app are saved to a gallery folder of
    their own.
  - A video deleted from the gallery shows in the app as missing, with a
    way to remove it.
  - Deleting a video in the app asks whether to delete it from the gallery
    too.
  - iPhones and browsers can only keep their own copy (OPFS), so there
    the app holds the file.
- **Only the device holding the original can remove the server copy**
  (Claude's call). A device that only has a downloaded copy can't turn
  that copy into the only one.
- **A phone-only video held by another device** (Claude's call):
  - Copy to… or Move to… a group, done from the device holding the
    originals, uploads them as part of it.
  - Done from any other device, it asks "Go ahead without the N videos on
    <device>?"
  - Any device may delete an "On <device>" video, for a lost or reset
    phone. The usual rule holds: a linked section blocks the delete until
    it is unlinked.
- **On a desktop browser, a new video uploads as it does today** (Claude's
  call). The PC can't film, and phone-only is about the phone. Its offline
  copy and kept copies work as on an iPhone. There's no "upload new videos
  automatically" setting on phones for now; the Upload button is enough,
  and a setting can come later.

### Keep on this phone (agreed)

- **Always on the device, automatically:** all of a person's data, their
  songs' audio and their count takes. These are small, and they make the
  player work anywhere.
- **On request:** server videos (lesson videos and uploaded recordings). A
  "Keep on this phone" toggle on a lesson (all its videos), on a figure (its
  recordings) and on a single video downloads them, and keeps new ones
  under that lesson or figure in step.
- **Settings shows the space taken,** with originals (phone-only and
  uploaded originals) apart from kept copies, and a way to clear the kept
  copies. Clearing never touches originals.
- Group content a person has added follows the same rules.

### iPhone and browsers (agreed)

The iPhone runs the home-screen web app, and phone-only videos are allowed
on it. The first time someone keeps a video only on an iPhone, a small,
unintrusive popup explains:

- iOS may delete stored files when the phone is short of space, or when the
  app hasn't been opened for a long while;
- a phone-only video exists nowhere else, so losing it is permanent;
- this lasts until there's a proper iPhone app.

After that, a small mark on such videos opens the same explanation, and
nothing nags. On the iPhone, syncing and downloads only run while the app
is open.

A desktop browser shares the iPhone's storage path, for its offline copy
and kept copies. New videos there upload (see Videos).

### Opening the app (agreed)

The device starts its own database before the first screen. A normal open
should feel like today's. The first open after installing or after an
update may take a second or two longer, and the user accepts that in
return for working offline. A loading screen covers it, designed with the
other new pieces.

## How it is built (Claude's calls)

### The local runtime

The device runs the app's own server code against its own copy of the
database. That keeps one copy of every rule. The data functions already
take `db` as their first argument and use Drizzle's synchronous API, so
they run unchanged once they're given a synchronous SQLite on the device.

- **SQLite on the device** is the official SQLite WASM build in a dedicated
  Web Worker, on OPFS (the `opfs-sahpool` VFS, which needs no
  cross-origin isolation headers). Inside the worker it is synchronous.
  Drizzle runs on it through a thin adapter with better-sqlite3's API, or
  through whatever driver the spike finds works with the existing
  `.get()`/`.all()`/`transaction()` calls unchanged. Same schema, same
  migrations, applied on the device at start.
- **The worker runs the app's loads and actions.** The first choice is
  SvelteKit's own built `Server` (`respond(request)`) bundled for the
  worker, with the Node-only modules swapped for device versions:
  - `db`: the device SQLite;
  - `files`: the device media store;
  - `crypto`: WebCrypto;
  - `$env`: build constants.

  If that proves impractical, the fallback is a dispatcher built from
  `import.meta.glob` over the `+page.server.ts` / `+layout.server.ts`
  modules, calling `load` and `actions` by route id with a built
  RequestEvent. Either way the 37 page servers, 7 layout servers and
  their actions are not rewritten.
- **A service worker routes requests:**
  - **Navigations:** answered with the client-rendered app shell (SSR is
    off on the device).
  - **Data and actions:** `__data.json`, `?/action` posts and `/api/*`
    requests the device can answer go to the local runtime, through the
    page that owns the worker.
  - **Online-only and media:** online-only `/api/*` and media streams go to
    the network.

  So `use:enhance`, `use:guarded`, `invalidate`, `goto` and every
  component stay as they are. Several tabs in a desktop browser elect one
  owner of the database (Web Locks), and the others reach it through a
  BroadcastChannel.
- **The Android app** keeps loading the site's origin in its WebView
  (Android WebView runs service workers), so the same shell opens it
  offline. Bundling the build into the APK was rejected: every web deploy
  would then need an app release.
- **Time:** the local runtime reads the device's clock. The person's zone
  stays `users.timezone`.
- **Access on the device is for show, not for safety.** The local runtime
  runs the same `access.ts` checks, so screens behave the same, but the
  server is the authority: it re-checks everything on replay (below).

### Ids the device can make

Today 26 tables use integer autoincrement ids made by the server, and two
offline devices would hand out the same ones. Changing the column type
would rebuild tables, and `figures` can never be rebuilt (CLAUDE.md, the
CHECK rule). So ids stay integers, and every runtime mints them from its
own block:

- `id = slot × 2³² + n`. Slot 0 is every existing row, and the server
  keeps minting there (a call made while building phase 1: device blocks
  start at slot 1, so they never overlap it, and existing ids, URLs and
  test fixtures stay as they were). Each device gets a slot the first time
  it syncs. All of it stays under 2⁵³, so JavaScript numbers hold it
  exactly.
- `id_marks (tbl, slot, hi)` holds the highest id used per table and slot.
  An `AFTER INSERT` trigger on each id table keeps it, so ids that arrive
  with a row (a device's, a restore's) count too. It was seeded from
  `sqlite_sequence`, so an id deleted before phase 1 is never handed out
  again (migrations 0037, 0038).
- Every id column defaults to `mintedId('<table>')`
  (`src/lib/server/db/ids.ts`): an app-side `$defaultFn` returning SQL,
  "this table's mark in my slot, plus one". SQLite works that out once per
  statement, so an insert carries one new row, or rows that carry their own
  ids. Several new rows in one insert collide loudly (a UNIQUE error).
- `ids.spec.ts` scans that every id column mints for its own table, that no
  server code inserts into an id table with raw SQL, and that no migration
  after 0038 inserts into one without its id.
- `users` and `sessions` keep their text ids.

### The device's copy (pull)

- **The server logs every change** to the synced tables with triggers:
  `CREATE TRIGGER`, which is additive and rebuilds nothing. Each row in
  the log holds a sequence number, the table, the key (JSON for composite
  keys), insert/update/delete, and the time.
- **A device pulls changes since its cursor,** filtered to what its person
  may read, through `access.ts` (own rows, and group rows through `reach`,
  editors' drafts, `usableOf`). When someone's reach changes (membership,
  publish, an archived lesson, an unlink, leaving), the device's next pull
  drops what it may no longer read (built as digests, below: nothing is
  marked).
- **Synced:** the content tables and the person's own bookkeeping
  (`today_picks`, `twins`, `opens`, `lesson_adds`, `count_takes`, the
  person's `users` row, member names in their groups, `song_links`,
  comments and hearts on lessons they read).
- **Never synced:** `sessions`, `login_attempts`, `invites`,
  `device_tokens`, `app_installs`, `storage_requests`, `team_trash`,
  `team_changes`, `clone_pairs`, `app_flags`, `id_marks` (each database
  keeps its own), and the worker's queue state beyond what a row's status
  shows.
- **First sign-in** downloads a full snapshot.

**Decided while building phase 2** (2026-11-08):

- **Digests in place of marking reach changes.** Each pull sends, per table,
  the sha256 of the sorted keys the device holds; the server compares it with
  the keys of the person's scope and resends a table whole when they differ.
  That catches a shrunk or grown reach, a deleted row and a pruned log with no
  bookkeeping; the change log (`change_log`, four triggers per synced table,
  pruned after 30 days) carries only the rows that changed. A changed
  `team_members` row also resends its team's row (its code depends on the role).
- **Scope** is `syncScope`, row by row as `access.ts` decides. Redacted:
  `password_hash` is always empty; another person's users row keeps only id,
  dance, names and created_at (email `<id>@hidden.invalid`); a group's code
  reaches only the owner and editors of a live group (`hidden-<id>` otherwise);
  a deleted comment goes only while a live reply holds it, with no body, author
  or deleter. The scope is not closed over foreign keys: the device applies
  with them off and never checks them.
- **Synced and not:** `clone_sync` is synced (Keep in step shows on pages);
  `clone_marks` and `change_log` are never synced, like `id_marks`.
- **Network first in phase 2.** Online, every request reaches the server as
  without a service worker. The device answers only when the network fails (a
  rejected fetch, 502/503/504/520–530, or 4 s with no answer while the device is
  ready); after a save, a page's reads wait for the network until the device has
  pulled it. Writes always go to the network; offline they get "Needs a
  connection" and change nothing.
- **One tab owns the copy** (a Web Lock); a second tab uses the network and
  takes over when the first closes. The BroadcastChannel relay waits for phase 3.
- **Signing out wipes the copy** (a 401 on pull empties the tables, never the
  file). Another person signing in on the same browser starts from empty.
  The page tells its device who the server says is signed in (`pagePerson`,
  `src/lib/offline/person.ts`: only from the server's own answer, never the
  copy's or the shell's): null wipes the copy, anyone else than the copy's
  person wipes it and pulls theirs, and the copy answers nothing meanwhile.
  Every relayed read carries the page's person; the copy answers only its own
  person's page (and a page that cannot know yet, the offline shell). A pull
  says whose copy it is (`userId`), and the server starts over for anyone
  else; the device never takes a pull for anyone but the page's person.
  Built 2026-11-08 (the final review's fixes).
- **A migration on the device means one full pull;** so does any pull that
  fails to apply. A device on an older schema is refused (409) and keeps its
  copy until its update.

### Offline changes (push)

- **Each action run on the device goes into an outbox** with:
  - the route, the params, the action or API call, and its body;
  - the time it was made;
  - the build's `PAGE_EPOCH`;
  - the ids it minted, in order;
  - `seen`: the values the rows and fields it wrote held before. Triggers
    on the device database capture these, so no form changes.
- **The server replays the outbox in order,** as the person, through the
  same action code, one transaction per entry:
  - it uses the device's minted ids;
  - its clock reads the entry's made-at time, so a set logged offline at
    10:00 is dated 10:00. So all server code reads the time through one
    clock, `serverNow()` (`src/lib/server/server-clock.ts`, since phase 1;
    `server-clock.spec.ts` enforces it), which replay sets.
- **Own rows: later edit wins, per field.** A field the entry changed that
  the server also changed since `seen` keeps whichever change was made
  later. The entry's made-at time is compared with the log's time for that
  row.
- **Group rows go through the existing clash check,** with the `seen` from
  the outbox. A clash stops that entry and records it for the clash screen.
  Entries that don't depend on it carry on.
- **A refused entry goes on "Couldn't sync"** with its content shown. It is
  never silently dropped.
- **After the push the device pulls.** The server's state then replaces
  the device's guesses.
- **Online, the outbox simply drains at once.**
- **Blocked actions skip the outbox.** They go straight to the server and
  are refused on the device when offline.
- **Two offline devices making the same name** (a move name unique per
  dance) is not a refusal: the replay suffixes it (`names.ts`'s
  `suffixed`).
- **History records group mutations** on replay with the real actor and the
  made-at time.

### Updates and PAGE_EPOCH

The service worker caches the build. A new build installs in the
background and takes over at a safe moment (the existing `mayReloadNow` /
`holdReload`), and never while the outbox holds entries of an older
`PAGE_EPOCH` and the device is online and could still drain them.

If a device was offline across a deploy that raised `PAGE_EPOCH`, the
server refuses its older entries, and they go on "Couldn't sync" with their
content shown. Raising `PAGE_EPOCH` therefore becomes rarer and more
deliberate. A commit that raises it should keep accepting the previous
shape when that is cheap.

### Media on the device

- **New columns** on `recordings` and `lesson_videos`, additive:
  - whether a server copy exists;
  - which device holds the original;
  - the original's size.

  `file` stays NOT NULL and unique, so a phone-only video still gets a
  unique name, with no file on the server. Storage accounting
  (`src/lib/server/storage.ts`) counts only server copies.
- **A device-only table** records what this device holds: the row, where
  the file is, its size, and whether it is an original or a kept copy.
- **Storage:**
  - **Android:** originals are gallery files (MediaStore). The app holds
    lasting access to them: a picker that grants it, its own gallery
    folder for videos filmed in the app, and the video read permission
    where Android needs it. A gallery share copies the video only when no
    lasting access can be had. Kept copies live in the app's own storage.
    Native code serves both to the WebView on a reserved path with HTTP
    Range (`shouldInterceptRequest`).
    The upload queue (`UploadWorker`, `Compressor.kt`) makes the server copy
    from the original.
  - **iPhone and browser:** OPFS, with `navigator.storage.persist()`
    requested. Played as file-backed blob URLs, or served with Range by
    the service worker.
- **Playback** prefers the local original, then a kept copy, then the
  server stream.
- **Recording uploads become chunked,** like lesson videos (`writeChunk`).
  An uncompressed iPhone upload would hit the 95 MiB single-request cap in
  about a minute of 4K. Recordings then take the lesson videos' 1 GiB cap,
  and the storage limit applies as today. The iPhone and the browser upload
  the original uncompressed, as browsers do today. Compressing in the browser
  (WebCodecs) is later work.
- **Server-side file effects stay on the server.** On replay, the server
  does its own file work (unlinking, `CloneFiles`' hard links). On the
  device, the same code paths hit the device media store through the
  existing injection points (`CloneFiles` already is one; `files.ts` gets
  the same treatment).

## The look

The new pieces get designed the user's usual way before they're built: real
screenshots of the screens as they are, then 2–4 options on the phone, then
build the pick. The pieces:

- the sync status (synced, waiting, couldn't sync) and the "Couldn't sync"
  list;
- the "waiting for connection" mark on queued things;
- where a video lives (phone only, on the server, both, kept copy, "On
  <device>"), with the Upload, Download and Remove server copy actions;
- Keep on this phone on a lesson, a figure and a video;
- Settings' space on this device, and Clear kept copies;
- the iPhone popup and its mark;
- "Needs a connection" on blocked actions;
- the loading screen while the device's database starts.

## Phases

0. **Spike** (throwaway): Today's list and its log action running in the
   device worker on OPFS SQLite through the service worker. It must open
   with no signal in the Android WebView and in an iPhone home-screen app.
   Measure on the user's Android phone:
   - a warm open, which goes if it is about as quick as today's;
   - a cold open after an update, which goes at a few seconds at most;
   - the size of the shipped code (the server code plus about 1 MB of
     WASM);
   - the first snapshot's time.

   Decide between SvelteKit's `Server` in the worker and the dispatcher
   fallback. Go/no-go with the user.

Each phase ships to production when it's done (Claude's call). Phase 1
is invisible. Phase 2 is already better than today: reading works offline,
and a change made offline gets "Needs a connection" in place of today's
whole-page offline screen.
1. **Ids and the clock:** explicit ids from slots on every insert; one clock
   for the server code; specs that scan for both.
2. **The device's copy, read only:** the server's change log, pull, the
   local runtime and the service worker. The app opens and reads offline;
   changes still need signal.
   Built 2026-11-08 (migrations 0041–0042, plan
   `docs/superpowers/plans/2026-11-08-offline-phase-2-read-only-copy.md`):
   every page opens offline from the device in the walk
   (`scripts/offline/`), and pages open no slower online. Song audio and
   videos wait for phase 4; "Needs a connection" is the existing toast
   until phase 3's design.
3. **Offline changes:** the outbox, replay, the clash rules, queued and
   blocked actions, sync status and "Couldn't sync" (designed first).
   Built 2026-11-09 (migration 0044: `device_slots`, `sync_landed`; spec
   `docs/superpowers/specs/2026-11-09-offline-phase-3-design.md`, plan
   `docs/superpowers/plans/2026-11-09-offline-phase-3-changes-offline.md`):
   writes run on the device first and replay through `/api/sync/push`, and
   the walk proves a change made offline lands once, dated, with its ids.
4. **Videos on the device:** phone-only by default, Upload, Download,
   Remove server copy, Keep on this phone, the space in Settings, the iPhone
   popup, Android's native store and the chunked recording upload (designed
   first).
5. **Cleanup:** the old offline screen goes, and CLAUDE.md, the design spec
   and the affected specs are brought up to date.

## Left to the builder

- The exact Drizzle driver or adapter on the device, and how SvelteKit's
  `Server` is bundled for the worker.
- The pull's wire format and batching, and how a reach change is marked.
- How the outbox stores bodies (form data, JSON) and how files queued for
  upload relate to it.
- How kept copies follow a lesson or figure as videos are added to it.
- The device's database migrations when a new build's schema is newer than
  its copy.
- Where the device's database lives per signed-in account, if one browser
  signs in to both dances.
