# Device first: pages read the phone's copy, online too

A follow-up to [the app on the device](2026-11-07-offline-design.md) and its
[phase 3](2026-11-09-offline-phase-3-design.md). Those specs hold for
everything this one does not change. Agreed with the user on 2026-11-10.

## Why

Today, online, a page asks the server first. The device's copy answers only
when the network fails (a rejected fetch, a 50x, or 4 s with no answer), or
while this device has changes the server does not have yet (phase 3). So
every tap waits on the network. The phone already holds a full, current copy
of everything its person can see. Reading from it online too makes the app
feel local.

The concrete reason now: **page transitions** are being designed in the
animations slot. A page should slide in with its real content, never with a
skeleton waiting on the server. That only works if opening a page never
waits on the network.

The user's call on freshness: showing data up to one pull old is fine. It
makes the app feel local, and changes made elsewhere (the work PC, a group's
teacher, the home worker) are rare.

## Goals

- **Opening a page never waits on the network.** Once the device's copy is
  ready, every page the device can draw reads from it, online and offline. A
  tap from one tab to another, online, makes no network request for the
  page's data.
- **The copy stays fresh by itself.** The background pull keeps it current,
  and when a pull brings changes, the open page re-reads and the lists
  animate them in (`flipList`, `src/lib/motion/`).
- **Saves land on the device first, online as offline.** A person's own
  things save on the phone and push in the background (as phase 3 already
  does).
- **Pull down to refresh** on the phone: the same sync as the Sync page's
  "Try now", then the page re-reads.

## Non-goals

- **A group's things still save on the server first while online** (the
  user's pick on 2026-11-09, confirmed 2026-11-10). A teacher editing a
  class lesson sees a clash with another editor at once, in place
  (`ClashSheet`). Offline they still run on the device first, as in phase 3.
- **Network pages stay network pages** (`NETWORK_PAGES` in
  `src/lib/offline/routes.ts`: a group's History, people and Recently
  deleted, What uses space, the admin, Suggestions, sign-in, …). Network-only
  writes, uploads and media are unchanged.
- **No live push from the server** (no websocket, no server-sent events).
  Freshness comes from pulls only.
- **No change to the offline strip, the Sync page, the Waiting badge or
  "Needs a connection".**
- **No pull-to-refresh on the desktop** (Claude's call). There's no pull
  gesture there; the desktop keeps the 5-minute pull and the pull on focus.

## Anti-goals (a failure even if it works)

- **A save seems to vanish.** After a save the page must show it, whether the
  save ran on the device (own things) or on the server (a group's things,
  until the next pull brings it in).
- **A pull wipes what the person is typing,** or closes a sheet or the player
  under them.
- **The app opens slower than today**, on the user's Android phone, cold or
  warm.
- **A page that waits on the home worker freezes** (a song downloading or
  getting its beats): it must still move on within seconds of the worker
  finishing, as it does today.
- **A list jumps** when a pull changes it: rows fold in and out as
  `flipList` does for the person's own changes.
- And the earlier specs' anti-goals: nothing new is lost to a clash or a
  failed sync; no row reaches a device its person may not read.

## What the person sees

### Reading

- **Once the device is ready, a page the device can draw reads from it.**
  The network is never asked first, and there is no 4-second race.
- **The network still draws a page** when:
  - the device is not ready yet (first sign-in, a failed start, a second tab
    whose owner is busy, as phase 3 relays);
  - this page saved a group's thing on the server, until a pull has brought
    that save into the copy (today's `dirtyAt` / `unpulledSince` rule, so the
    save never seems to vanish);
  - the device fails on that request (it errors or does not answer):
    network as the fallback, as phase 2 had the device as the fallback.
- **Network pages** stay as they are.

### Keeping the copy fresh

- **The pull runs** every 5 minutes while the page is visible, when the app
  comes to the front, when the connection comes back, and after a save
  reaches the server. All of these exist today (`PULL_EVERY_MS`,
  `startDevice` in `src/lib/offline/device.svelte.ts`); the user asked for
  exactly these.
- **When a pull brings changes, the open page re-reads** (`refreshWhenSettled`),
  and the lists animate the changes in through `flipList` (`TodayList`,
  `SlotList`, `FlipList`). A pull that changed nothing re-reads nothing.
- **A re-read never runs over the person** (Claude's call): while a sheet, a
  half-filled `use:guarded` form or the player is open, it waits until they
  settle, as `refreshWhenSettled` already waits.

### Saving

- **A person's own things** save on the device and push in the background,
  online and offline (phase 3, unchanged).
- **A group's things online** go to the server first (unchanged), then the
  page reads from the network until the pull 1 s later brings the save into
  the copy.

### Pages waiting on the home worker (Claude's call)

The song page re-reads every 10 s while a song is `waiting_download` or
`waiting_analysis` (`src/routes/[dance]/songs/[id]/+page.svelte`). From the
device that would show the same state until the next 5-minute pull. In its
place, while it waits on the worker, the page **asks the device for a pull
every 10 s**, and the pull's changes re-read it as above. Any other page that
polls the server for a result the worker writes into synced rows does the
same (the builder checks for others). Suggestions polls too, but it is a
network page and stays as it is.

### Opening the app (Claude's call)

- **The device starts at once on every open,** online too. Today it waits
  for an idle moment (up to 2 s) when online.
- **With a copy on the phone, the very first page also comes from the
  device:** the service worker answers the navigation with the cached shell
  and the shell draws the page from the copy. The spike measured a warm open
  from the device at about 420 ms for Today on the user's phone, the same as
  today's server render (`2026-11-07-offline-spike-findings.md`).
- **Without a copy** (first sign-in on this device, after Sign out), or if
  the device cannot start within its limit, the network draws the page as
  today.
- This must be measured on the phone before shipping (see Done when). If a
  cold open from the device is slower than today's, the first page goes back
  to the network and only the pages after it come from the device: the
  goal is that tapping around never waits, and the first open must not get
  worse.

### Pull down to refresh (phone only)

- **What it does:** pulling down from the top of a page runs the same sync
  as the Sync page's "Try now" (`syncNow`: push what waits, then pull). When
  it is done the page re-reads, and the lists animate what changed. The
  indicator stays until the sync is done (or fails), then springs back.
- **Offline,** it says "Offline" (the existing words) and springs back at
  once. Nothing waits.
- **On a network page** it just re-reads the page from the server.
- **Where:** pages that scroll under a band (Today, the Moves lists and item
  pages, Lessons, Music, the song page, You, Settings). Not inside a sheet,
  the player, the Positions map or the video player, where a downward drag
  already means something.
- **It works with the band fold:** a pull starts only when the page is
  already at the top with the band fully open, so it never fights the fold
  (`band-collapse.ts`, the `data-fold` scroll timelines).
- Android's WebView has no pull-to-refresh of its own today (no
  `SwipeRefreshLayout`), and the web page must not trigger the browser's
  own (`overscroll-behavior-y` on the page). The gesture is the web page's.
- **The look is designed the user's usual way before it is built:** real
  screenshots of the pages as they are, 2–4 options on the phone, and the
  build follows the pick. This spec fixes only what it does. Words go
  through `t()` in both catalogs (en, sl).

## How it is built (Claude's calls; the plan may refine how, not what)

- **Reads:** `swRoute`'s `device-read` (`src/lib/offline/sw-route.ts`,
  `src/service-worker.ts` `deviceRead`) asks the page's device first when
  `DeviceClients` says it is ready and the page is not dirty. Otherwise it
  goes to the network as today. The network becomes the device's fallback:
  a device that answers nothing (or an error the device itself raised, not
  the page's own 404 or 403) falls through to the network. Today's
  `readsFromDevice` (changes waiting) stays as a reason to read the device
  even while dirty.
- **Navigations:** `navigate` answers with the cached shell when a copy
  exists for this browser. The service worker cannot see a page's device on
  a cold open, so it needs a durable mark that a copy exists, set by the
  device when a pull lands and cleared by Sign out and by the person
  changing. Keep it beside `OUTBOX_STATE_CACHE` (the builder picks the
  shape). The shell's data requests then wait for the device to start
  (relayed reads already wait up to `DEVICE_START_LIMIT_MS`, 10 s), and fall
  to the network past that.
- **What only the server knows** (found by the builder check; Claude's call).
  The root layout (`src/routes/+layout.server.ts`) and the dance layout
  (`src/routes/[dance]/+layout.server.ts`) run on every tap, and some of what
  they return is not in the copy. Offline these already go missing; device
  first must not lose them online:
  - **Server-only facts travel with the pull.** The pull's answer
    (`src/lib/server/sync/pull.ts`, which sends `cookies: {}` today) gains a
    small `extras` record that the device keeps in its meta and its layouts
    read when they run on the device: the Music dot (`musicToPick`, from
    `song_imports`), the AI suggestions count (`aiPending`, from `ai_*`), whether an
    AI app is connected (`aiConnected`, from `oauth_*`), and the app update
    gate (`appUpdate`, which reads `currentRelease` from the server's disk).
    Each is up to a pull old, like everything else (the user's rule). The
    Music page's "To pick" list (`song_imports`) comes along the same way, or
    that one list reads from the network; the builder picks.
  - **The page's own cookies travel with each device request.** The theme
    (`THEME_COOKIE`), the Android app mark (`APP_COOKIE`) and the language
    are cookies the browser keeps. A service worker cannot read a request's
    `Cookie` header, so the page sends its readable cookies along with each
    `device-fetch`, and the device's `deviceHeaders` uses them in place of the
    copy's empty jar. Any of them that is `httpOnly` today either stops being
    so (it is not a secret) or travels in the pull's extras; the builder
    checks which.
  - **A new server-only field in either layout** must be added to the extras,
    or it will silently go missing on the device. A spec pins this: every key
    the two layouts return is either computed from synced tables, a cookie,
    or listed in the extras.
- **Who is signed in:** phase 2's `pagePerson` learns who the server says is
  signed in from the server's own answers. With every read from the device,
  the pull's answer (it carries `userId`, and a 401 says nobody) becomes the
  way the page learns it. The rules stay: the copy answers only its own
  person, and another person signing in gets an empty copy.
- **An expired session, online** (phase 3's rule, now the common case): the
  person keeps using the copy, saves keep landing on the device and queue,
  and the band shows "Sign in to sync". Nothing redirects to the sign-in page
  on its own. A 401 on the pull must therefore keep the device `ready`
  (not move it to `empty` as `setPerson(null)` would), and only the app's own
  Sign out, or another person signing in, empties the copy. Network pages and
  network-only actions still meet the server's redirect as today.
- **A pull says whether it changed anything:** the device's `pulled`
  message (`src/device/core.ts`, `DeviceOut` in `protocol.ts`) gains the
  number of rows it applied or removed. The page re-reads when that is above
  zero (today it re-reads only when outbox entries landed).
- **Starting at once:** `startDevice` starts the worker immediately online
  too, not on `requestIdleCallback`.
- **Song page polling:** a `pullNow()` from the device module, with the page
  asking every 10 s while it waits on the worker. A pull costs the server a
  digest comparison per table; at one page and 10 s that is fine.
- **Pull to refresh:** one shared component or action used by the page
  shell (`Screen`), touch only, gated on scroll position 0 and the band
  open. It calls `syncNow()` (push then pull), then `invalidateAll` through
  `refreshWhenSettled`. Offline it shows the offline word and does nothing.
- **Docs:** the main offline spec's "Network first in phase 2" and phase 3's
  "With nothing waiting, reads go network first" are superseded; update
  them to point here. Update `docs/hard-rules.md`'s offline rule if it says
  reads go network first, `docs/features.md` and `docs/layout.md`.
- **PAGE_EPOCH:** no change expected; the requests and their answers keep
  their shape.

## Done when

- The offline walk (`scripts/offline/`) still opens every page offline.
- Online, with the device ready, a tab tap and an item tap make no network
  request for page data (a walk that counts the requests per tap).
- A save on an own thing shows at once; a save on a group's thing shows at
  once and is still there after the next pull.
- A change made on another device appears on the phone after a pull, the
  pull to refresh, or bringing the app to the front, with lists animating.
- A song added by link moves from waiting to ready on its page within
  ~10 s of the worker finishing.
- A pull landing while a form is half-filled or a sheet is open changes
  nothing until it closes.
- Measured on the user's Android phone, before deploy: a cold and a warm
  open are no slower than today's. The spike never timed a cold open on the
  phone, so the builder first measures today's master on the phone (adb and
  `chrome://inspect`, as the spike did; if the phone is not reachable, ask
  the user to plug it in) and that is the bar.
- The settings that come from the server only (the Music dot, the AI count,
  the theme row, the Android app's video hand-off, the update screen) still
  show online on a page the device drew.

## Order of the build (Claude's call)

Two steps, each deployable on its own:

1. **Taps read the device:** device-first reads, the server-only facts in the
   pull and the cookies with each device request, the re-read on a pull with
   changes, the song page's pulls, the expired-session rule, and pull down
   to refresh (after the look is picked). The first page of an open still
   comes from the network, as today.
2. **The first page from the device:** the device starting at once, the "a
   copy exists" mark, and the shell on navigate. Kept apart so it can be
   taken back alone if the phone shows a cold open slower than today's.

## Left to the builder

- The shape of the "a copy exists" mark the service worker reads on a cold
  open.
- How the device's own failure is told apart from a page's real 404 or 403,
  for falling back to the network.
- Which other pages poll for the worker.
- The pull gesture's thresholds and resistance, within the picked look.
