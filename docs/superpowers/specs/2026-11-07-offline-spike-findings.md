# Offline phase 0: what the spike found

The spike lives on branch `offline-spike` (throwaway, never merged). It ran the
plan `docs/superpowers/plans/2026-11-07-offline-phase-0-spike.md` against the
design `2026-11-07-offline-design.md`. This page is what it taught; the code
is not kept.

## Path A works

The app's own server code runs on the device unchanged. The built SvelteKit
`Server` (`.svelte-kit/output/server`) bundles for a browser worker with Vite
lib mode in about 2.5 s:

- `better-sqlite3` is aliased to a shim over the official SQLite WASM build;
- `node:*` is aliased to small stubs;
- drizzle's migrator is a no-op.

A dedicated worker holds the database in OPFS (the `opfs-sahpool` VFS). The
service worker sends two kinds of request to the page, which hands them to
the worker over a `MessagePort`:

- page data (`GET …/__data.json`);
- form actions (a POST with `x-sveltekit-action`).

The worker answers with `server.respond()`. Every data function, guard and
action ran as written. Path B (a hand-written dispatcher over the routes)
was not needed.

## The numbers

"Today" is the time until Today's list shows. FCP is first contentful paint.

| Where | Open | Result |
|---|---|---|
| Android phone (the user's) | warm, online, on the device | FCP 328–548 ms, Today ~420 ms |
| Android phone | warm, airplane mode | Today 418–434 ms |
| Android phone | device marks | sqlite 27–41 ms, server 69–97 ms, first answer 118–193 ms |
| Android phone | first open after install (signed out, no copy yet) | FCP 2.8 s (sign-in page) |
| Desktop, headless, 4× CPU throttle, phone viewport | master (SSR) warm | 375–689 ms (first 1054) |
| Same | device warm | 1141–1397 ms (first after start 1720–2745) |
| Same | offline | 1222–1270 ms (first 2152) |
| Same | first visit, with snapshot | 3054 ms; snapshot 0.72 MB in ~80 ms |
| Same | after an update (new service worker) | 1716–2565 ms |
| Same | steady-state request | device 10–12 ms, server 7–15 ms |
| iPhone | — | not tested (no iPhone at hand) |

The throttled desktop runs were far more pessimistic than the phone. On the
phone, a warm open from the device is in the same range as today's server
render. The whole cost is startup, not the requests:

- booting the worker;
- the first request, which ran `bootstrap()`;
- the CSR shell.

Once running, the device answers as fast as the server.

**Bundle:** `_device/` is 4.9 MB on disk and 1.37 MB of JS and WASM
gzipped. The 4.9 MB includes two things that can go:

- an unused `assets/sqlite3-worker1` (1.39 MB);
- a second copy of the WASM (lib mode inlines it as a `data:` URL beside
  `sqlite3.wasm`).

## The test suite on the shim

The whole vitest suite ran with `better-sqlite3` aliased to the shim. 4661
of 4666 pass. The five failures come from the harness, not the app:

- `migrate.spec` ×4 reopens a database file, and in Node the shim maps every
  path to `:memory:`;
- `timeout.spec` ×1 trips on the device config's 30 s test timeout.

WASM is slower: `lessons.spec` (90 tests) takes 19 s. Runs with three or
more parallel workers were killed by an unexplained SIGTERM on this machine,
so the suite ran in 8 shards.

## Stubs that got called

The only stubs hit were `fs.mkdirSync` and `fs.promises.readdir`. Both came
from `bootstrap()` (the upload sweep and the data dirs). No crypto hash and
no stream stub was reached on the paths tried: Today, Moves, a figure,
Lessons, Music, Settings and logging a set.

## Shortcuts phase 2 must replace

- **The forbidden-header override.** The Request is built with the wire
  headers, then its `headers` property is overridden with a standalone
  `Headers` carrying `cookie` and `origin`.
- **The session id held on the device**, in OPFS `spike-meta.json`.
- **`bootstrap()` running on the device.** It changed nothing on a snapshot
  (row counts equal before and after), but the device must run no boot
  steps.
- **SSR off everywhere** (`ssr = false` in the root layout). See the finding
  below.
- **The whole-database snapshot** (`/api/spike/snapshot`, the server's
  `serialize()`, other people's rows included).
- **The no-op migrator.**
- **The precache list `_device/files.json`.** The service worker precaches
  it; without it, an offline reload could not load the worker itself. Phase
  2 keeps the idea, built properly.
- **The device sets no `salsa_app` cookie.**
- **The duplicate WASM** and the unused `sqlite3-worker1`.
- **The device starts only with a session.** On a fresh install the copy
  appears on the next open after signing in. Phase 2 starts it right after
  sign-in.

## Found on the phone

**The router never started on a client-only page.** With `ssr = false`, the
first navigation's `from` exists but its `url` is null. Two places read
`from.url.pathname` and threw:

- Today's `(today)/+layout.svelte`;
- the trail, `nav/trail.svelte.ts`.

That throw stopped SvelteKit's router from starting. Every tap became a full
page load: slow online, a black screen offline, and the log popup could not
close.

Its asset paths are relative, so a full load at `/salsa/figures` asked for
`/salsa/_app/…`, which the cache doesn't hold. This was the console error
"Cannot read properties of null (reading 'pathname')" that Tasks 2–4 saw and
left untraced.

The spike fixed it with optional chaining, and after the fix the user saw
no black screen. Phase 2 must:

- check every navigation hook for the first, client-only navigation;
- make each route's code safe to render in the client alone;
- precache the shell, so a full load offline still works.

The precached shell must also not depend on the path it was cached from: it
is cached at `/` and served at any path, while its asset URLs are relative.

**The existing Offline layer cancels every navigation while
`navigator.onLine` is false.** That is right for today's app and wrong once
the device answers. The spike skipped it while the device was running. In
phase 2 it becomes "Needs a connection", only for the blocked list in the
design.

**Some reads aren't page data:**

- the log popup's details (`GET /[dance]/exercises/[id]/practice`, a
  `+server` route), which offline shows "Could not load this exercise's
  details", though logging still works;
- the `/api/` JSON reads (comments, pickers, the Link popup);
- the media servers.

Phase 2's routing must cover the `+server` GET routes and the `/api/` reads
the device can answer. Phase 4 owns the media.

**A set logged offline survived killing the app** and reopening it in
airplane mode. The server's copy did not change: nothing syncs yet, as
expected.

## Review Focus results

1. **Opened twice.** A second tab can't take the sahpool
   (`NoModificationAllowedError`). It falls back to the network after 2.5 s
   and works online. The failed install logs "removeVfs() failed". Phase 2
   must prove that a failed install can never delete the database, and
   offline the second open needs a real answer (one tab, or a lock and a
   message).
2. **The worker fails to start** (blocked WASM). The worker reports an
   error, requests go to the network, and nothing hangs. A 10 s start limit
   holds.
3. **Signed out, or no copy yet, while offline.**
   - Never visited: the browser's own error page.
   - Visited only the sign-in page: a plain "Offline, and no shell cached
     yet" (the shell was cached only after a successful navigation).
   - Never an empty Today.
   - Phase 2 precaches the shell when it installs.
4. **A set survives a restart offline:** yes, on the phone.
5. **Boot steps on the device:** they ran and changed no rows. Phase 2 runs
   none.

## What changes the design

- **Routing.** The device answers page data, actions, the `+server` GET
  routes and the `/api/` reads it can, not only `__data.json`. The design's
  "queued" and "blocked" lists still decide the rest.
- **Client-only rendering is a phase 2 task of its own.** The spike found
  one crash that killed the router. The others are found by walking every
  route with SSR off, which the shots rig can do.
- **The old Offline screen goes.** Its job passes to "Needs a connection" on
  the blocked actions.
- **iPhone.** Tested live, with the first iPhone user the app is shared
  with. The storage warning popup stays as designed.
- **The pass bar is met on Android:** a warm open about as quick as today.
  A cold open after an update was not timed on the phone; on the throttled
  desktop it was 1.7–2.6 s.

## Go / no-go

Go, with path A.
