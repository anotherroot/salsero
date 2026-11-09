# Offline phase 3: changes made with no signal

Phase 3 of [the app on the device](2026-11-07-offline-design.md). That spec
is the authority for everything it already agrees (clashes, queued and
blocked actions, the outbox and replay, PAGE_EPOCH). This document adds what
was decided on 2026-11-09: the look, the scope, and the build's own calls.
Phase 2 (the device's copy, read only) is live since 2026-11-09.

## Why

The person practises where the signal is bad: a studio, a basement, a
train. They log what they did on Today, jot a note on a figure or a lesson,
and expect it all on the PC later without thinking about it. Today that
fails: phase 2 opens and reads offline, but every save says "Needs a
connection. Nothing was changed." A teacher editing a class lesson offline
is the rarer case.

## Goals

- **Every change the person can make offline saves on the phone at once**
  and syncs in the background: every screen listed under the main spec's
  Goals, everything you can edit, in one phase (the person chose
  "everything at once", not Today and notes first).
- **The page never waits on the network to save,** online or offline.
- **A change made offline reaches the server as the person made it,**
  dated when they made it, with the same ids, through the same action code
  and the same checks as a change made online.
- **The person sees sync only when it matters:** nothing while all is
  synced; a quiet count while changes wait; a clear pill when something
  couldn't sync, and a page to deal with it.

## Non-goals

- **Media on the device** (phase 4): recordings and lesson videos stay
  network-only in phase 3, uploads included. An upload offline says "Needs
  a connection". (The main spec lists "uploading a video" as queued; that
  needs the device's media store, so it moves to phase 4. Claude's call.)
- The home worker's jobs on the phone (song downloads, YouTube saves): they
  still run on the server after the change lands.
- Devices syncing with each other.

## Anti-goals (a failure even if it works)

Claude's guesses, which the person accepted as the failures to design
against:

- **A practice logged offline is missing, or appears twice,** once back
  online. Replay is idempotent per entry: an entry that already landed is
  never applied again (a retry, a lost answer, two tabs).
- **A change made offline quietly undoes a newer change** made on the PC
  or by the teacher. "Later wins" compares the time each change was MADE,
  never when it reached the server.
- **The app is slower online than it is now.**
- **The sync status nags:** "waiting" shows for more than a moment while
  there is signal.
- And the main spec's: nothing new is ever lost to a clash or a failed sync;
  no row reaches a device its person may not read.

## What the person sees (picked 2026-11-09 from the mockups)

The mockups: real screenshots of the screens as they are beside the options
(`phase3-sync-options.html`, made from a copy of the 2026-11-09 production
backup; not in the repo). The picks:

### The sync status: the band's subtitle (1D)

- **All synced:** the band shows what it shows today. Nothing extra.
- **Changes waiting:** the subtitle ends in "· 3 waiting" (the count of
  outbox entries not yet on the server). Only once they have waited a
  moment: an entry that drains within ~2 s never shows (anti-goal: no nag).
- **Something couldn't sync:** the subtitle becomes a pill, "1 couldn't
  sync ›", in the danger colour of the theme's tokens.
- Tapping either opens the Sync page. Every screen with a band shows it,
  on the phone and the desktop (the desktop's band row).

### The Sync page (2B)

A full page (a route, e.g. `/{dance}/sync`), reached only from the status:

- **Couldn't sync**, first: each entry says what it was in the person's
  words ("Log · Enchufla drill · Tue 10:04", "Note on Dile que no", "Name of
  Basic") and why in plain words ("the drill was archived", "Luka changed it
  meanwhile", "the app was updated since"). Each has **Retry** and
  **Discard**; Discard asks first (the danger dialog: "Discard this change?
  It was never saved on the server."). A group clash opens the existing
  clash screen from here.
- **Waiting**, below: the entries not yet on the server, oldest first.
- At the bottom: "Last synced 10:42 · Try now".
- With nothing waiting and nothing refused it says "Everything is synced."

### The waiting mark: a badge (3B)

Things whose effect is partly the server's (the queued list below) carry a
**"Waiting"** badge, drawn like the Draft badge, until their entry has
landed: a comment or a heart, a song added by link, a lesson published
offline, a YouTube save. A plain edit (a renamed figure, a log) carries no
badge: the status covers it.

### Needs a connection: once per sheet (4B)

- A sheet or menu whose blocked actions can't run offline says it **once at
  the top** ("Needs a connection for these"), and greys those items.
- A **lone** greyed button (Join with a code, a group's History) answers a
  tap with a short toast: "Needs a connection." The phase 2 toast and its
  catalog words are reused; the root layout's Offline layer stays for what
  the device cannot draw at all.

Words go in both catalogs (en, sl) through `t()`, as always.

## How it is built

The main spec's "Offline changes (push)" and "Updates and PAGE_EPOCH" hold.
The calls below are Claude's, made while writing this document; the plan
may refine how, not what.

### Writes run on the device first

- **Every write the device can do runs on the device first,** online or
  offline: the service worker sends a device-first action post or `/api/`
  write to the page's device worker, whose SvelteKit `Server` runs the same
  action against the copy. The person sees the result at once.
- **Except a group's things while online** (the person chose this,
  2026-11-09): a save on a group's row (a teacher editing a class lesson, a
  group's figure, …) goes to the server first, as today, so a clash with
  another editor shows at once in place (`ClashSheet`). Offline it runs on
  the device first like any other write, and a clash then shows from the
  Sync page. The action's target row decides (`spaceOfRow`), not the route.
- Then the device records an **outbox entry** and the outbox drains to the
  server in the background (at once when online).
- **When the device is not ready** (first load, a second tab while the
  owning tab is busy, a failed start), a write goes to the network as
  today, online, or gets "Needs a connection" offline.
- **Reads while this device has changes waiting come from the device,**
  online too: the server doesn't have them yet, so a page reloading after a
  save must not show the old state. With nothing waiting, reads go network
  first as in phase 2 (the service worker learns the outbox count from the
  device's state).
- **A pull waits for the outbox:** the device pulls only once every entry
  has landed or been refused, so a pull never overwrites a change still on
  its way. Offline there is no pull anyway; online the outbox drains in
  moments.
- **A second tab** reaches the owning tab's device through a
  BroadcastChannel relay (deferred from phase 2; needed now, since writes
  are device-first).

### Every write is classified

As phase 2 classified every GET endpoint, every action (`?/name` of each
`+page.server.ts`) and every `/api/` write is classified in
`src/lib/offline/routes.ts`, and a spec fails on an unclassified one:

- **device-first** (the default for a person's own content and their
  group's content they edit);
- **queued**: device-first, with the "Waiting" badge until its entry lands,
  because its effect is partly the server's: adding a song by link, Save
  video from YouTube, publishing a lesson, posting a comment, hearts;
- **network-only** (blocked offline, the main spec's list): joining a group
  with a code (and the first run's Join your class), Copy to…, Take, Send,
  Compare, Make it mine, Drop my copy, Detach, Move to… a group, signing in,
  Join from an invite, the admin page, pairing a phone, the app update
  check, a group's History / Recently deleted / people, leaving or deleting
  a group, making a group, a new group code, What uses space, Ask for more;
  plus every upload (phase 4).

### The outbox

A device-only table (never synced). Each entry holds:

- the request: URL, method, the headers the action reads
  (`content-type`, `x-sveltekit-action`), the body bytes;
- **made at** (the device's clock), the build's `PAGE_EPOCH`;
- the **ids it minted**, per table, in order;
- per row it wrote: the fields **before** and **after**, captured by
  triggers on the device's copy (no form changes; this is the main spec's
  `seen`);
- a state: waiting, sending, landed, refused (with the reason).

### Ids from the device's slot

- **Each device gets its own slot** the first time it pulls (a server-side
  table of slots per device, never synced); the device mints every new id
  in it (`setIdSlot`).
- **Replay inserts with the device's ids,** even after an earlier entry was
  refused: an entry carries its minted ids, and replay makes the server
  mint exactly those (it sets the slot's marks from the entry before
  running it).

### Replay on the server

- **`POST /api/sync/push`**, cookie session only (as the pull). It takes
  entries in order. Each runs in one transaction, through the hook and the
  route's own action as the person, with:
  - `serverNow()` reading the entry's made-at time;
  - the device's slot set for minting;
  - the PAGE_EPOCH check: an entry of an older epoch is refused ("the app
    was updated since");
  - access re-checked by the action itself (the device's checks were for
    show).
- **Idempotent:** a landed entry's id is recorded on the server; a resent
  one answers "landed" without running again.
- **Own rows, later edit wins per field:** after the action runs, for each
  row it wrote,
  - a field the entry did not change (before = after on the device) keeps
    the server's value, even though the form sent the whole row;
  - a field the entry changed that the server also changed since the
    entry's "before" keeps whichever change was MADE later: the entry's
    made-at against that row's last change in `change_log`.
- **The seen refusal never applies to a person's own rows on replay**
  (`seenRefusal` in `clash.ts` refuses an own row with copies kept in
  step, or a stale `seen`, with a 409 today): replay bypasses it for own
  rows and does the per-field merge above instead, then Keep in step flows
  as after any save.
- **Group rows** go through the existing clash check (`clash.ts`) with the
  entry's `seen`. A clash refuses that entry ("changed meanwhile") and
  opens the clash screen from the Sync page; later entries that don't touch
  that row carry on.
- **History** records a replayed group mutation with the real actor and the
  made-at time (`logChange` reads `serverNow()`).
- **A refused entry** goes back to the device as refused, with its reason,
  for the Sync page. It is never dropped silently. Retry resends it;
  Discard removes it, and the next pull restores the server's state.
- **What a refused change looks like** (the person chose this, 2026-11-09):
  it disappears from Today and the item pages once the device pulls, so
  they always match what is really saved, and it lives on the Sync page
  with its content until Retry or Discard. Nothing is lost.
- **Entries that depend on a refused one** (a log on a drill whose creation
  was refused, a section on a refused new lesson, a second edit to a row
  held in a clash) are held, not sent: they show under it on the Sync page,
  and Retry or Discard covers them together (Discard says how many). An
  entry depends on another when it writes a row the other minted or a row
  the other was refused on.
- **After a push the device pulls,** and the server's state replaces the
  device's guesses (an auto-add, a flow into kept-in-step copies, a song the
  worker found).
- Two offline devices making the same name (a move name unique per dance):
  the replay suffixes it (`names.ts`' `suffixed`), as the main spec says.

### Signing out and expired sessions

Claude's call, changing phase 2's ruling now that the copy can hold
unsynced changes:

- **A 401 on push or pull** (the session expired) keeps the copy and the
  outbox; the status says "Sign in to sync" and the Sync page offers Sign
  in. After signing in as the same person, the outbox drains.
- **Sign out with changes waiting** first tries to push. If anything is
  still waiting or refused, it asks: "3 changes haven't synced. Sign out and
  lose them?" Confirmed, the copy and the outbox are wiped as in phase 2.
- **The server saying nobody is signed in never wipes the copy now**
  (phase 2 wiped on it; `pagePerson` null on `/login` after an expired
  session): only the app's own Sign out does, after the question above.
- **Another person signing in** on the same browser gets an empty copy, as
  in phase 2. If the previous person still has entries waiting or refused,
  those entries are kept aside on the device, never shown to the new
  person, and pushed when the previous person signs in on that browser
  again. The copy itself is never shared between two people.

### Updates

As the main spec says: a new build waits while the outbox holds entries of
an older PAGE_EPOCH and the device is online and can still drain them
(phase 2's `skipWaiting` becomes conditional).

## What's left to the builder

- How the device worker records the outbox around `server.respond` (and
  what the device answers when its own action throws).
- The push's wire format and batching; how many entries per request.
- How replay makes the server mint the entry's ids, and how it restores
  unchanged fields after the action (the rule above is fixed).
- How the device's "before/after" triggers are written (generated like the
  change-log triggers, from `SYNCED`).
- The Sync page's route and its components, within the picked look.
- The ~2 s grace before "waiting" shows.
