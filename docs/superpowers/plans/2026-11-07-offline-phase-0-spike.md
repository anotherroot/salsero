# Offline phase 0: the spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find out whether the app's own server code can run on the phone,
against an SQLite copy on OPFS, so that Today opens and logs a set with no
signal. Do it in the Android WebView and in an iPhone home-screen app, with
the numbers the go/no-go needs.

**Architecture:**
- A device Web Worker runs SvelteKit's built `Server`
  (`.svelte-kit/output/server`), bundled for the browser:
  - `better-sqlite3` is swapped for a shim over the official SQLite WASM
    build on OPFS;
  - the Node built-ins are swapped for stubs.
- A service worker sends `__data.json` requests and form-action POSTs to the
  page, which hands them, with a MessagePort, to the device worker.
- SSR is off, so every navigation is the same shell, which the service
  worker caches.
- The data is a snapshot of the dev database, fetched once from a spike-only
  endpoint.

**Tech Stack:** SvelteKit 2.63 / Svelte 5 / Vite 8, drizzle-orm 0.45
(better-sqlite3 driver), `@sqlite.org/sqlite-wasm` (`opfs-sahpool` VFS),
`$service-worker`, cloudflared (quick tunnel, from nixpkgs at run time), the
Android app (`-Psite=`).

**Spec:** `docs/superpowers/specs/2026-11-07-offline-design.md` (phase 0 and
"The local runtime").

## Global Constraints

- **Throwaway.** All code goes on a branch `offline-spike`, made from
  `offline` in this worktree. Nothing from it merges. Only the findings doc
  (Task 7) is committed to `offline`.
- **Use a copy of the database.** The spike runs on a copy,
  `.data/spike.db`, never the slot's `.data/salsa.db` or production.
- **Specs stay away from `$DATA_DIR`** (CLAUDE.md hard rule).
- **No long-running foreground commands.** Servers and the tunnel are
  started with `run_in_background`, never with `script`, `/dev/zero` or
  anything that waits on stdin.
- **Time box.** Path A (SvelteKit's `Server` in the worker, Task 3) gets
  one working session. If Today's `__data.json` isn't answered by then, do
  Task 3b (the dispatcher) instead, and record why A failed.
- **Pass bar** (spec, phase 0), measured on the user's Android phone:
  - **Warm open:** about as quick as today's warm open of the master build.
  - **Cold open after an update:** a few seconds at most.
- **What gets measured:**
  - warm-open time;
  - cold-open time;
  - the size of the shipped device code (worker bundle plus `.wasm`);
  - snapshot download and import time;
  - the size of the snapshot.
- **Record every shortcut** in the findings doc (Task 7) under "Shortcuts
  phase 2 must replace": every stubbed module that got called, every
  `$lib/server` path that misbehaved on the device, every hack.

## Review Focus

1. **The app opened twice** (two tabs, or the WebView recreated): the
   second open can't take the `opfs-sahpool` lock. Expected: it falls back
   to the network rather than showing a blank page. Covered in Task 3,
   Step 6.
2. **The device worker fails to start** (the WASM fetch fails, a stub
   throws in `Server.init`). Expected: requests go to the network, with a
   console error. The app must not hang on the loading period forever.
   Covered in Task 3, Step 6.
3. **Signed out, or no snapshot yet, while offline.** Expected: the cached
   shell shows the login page or a clear "needs a connection" error. Never
   an empty Today. Covered in Task 4, Step 3.
4. **A logged set survives a full restart offline** (the app killed, the
   phone in airplane mode). Expected: the set is still on Today when the
   app is reopened. Covered in Task 5, Step 4 and Task 6, Step 3.
5. **Boot steps run on the device.** `bootstrap()` runs in the hook,
   including `splitAccounts`, the hourly `purgeTrash` and the upload sweep.
   Expected: on a snapshot they change nothing. Covered in Task 3, Step 5
   (compare the row counts before and after).

---

### Task 1: SQLite WASM behaves like better-sqlite3 under Drizzle

The deciding question for "run the server code unchanged": does every data
function work on SQLite WASM? Answer it by running the whole existing
vitest suite on the shim, in Node, in memory.

**Files:**
- Create: `src/device/sqlite-shim.ts`
- Create: `src/device/vitest-setup.ts`
- Create: `vitest.device.config.ts`
- Create: `src/device/sqlite-shim.spec.ts`
- Modify: `package.json` (add `@sqlite.org/sqlite-wasm`, the newest
  release at least two weeks old, exact version)

**Interfaces:**
- Produces:
  - `initDeviceSqlite(opts?: { locateFile?: (f: string) => string }): Promise<void>`
    loads the WASM module once. It must have resolved before any
    `new Database()`.
  - `openPool(name: string): Promise<PoolUtil>` installs the
    `opfs-sahpool` VFS (browser only).
  - `default class Database`, with the slice of better-sqlite3 that Drizzle
    and `openDb` use:
    - `constructor(path: string)`: `':memory:'`, or a name in the pool;
    - `prepare(sql)` returns a statement with `run(...p)` (giving
      `{ changes, lastInsertRowid }`), `get(...p)`, `all(...p)`, `raw(on?)`
      and `iterate(...p)`;
    - `exec(sql)`, `pragma(src, opts?)`, `transaction(fn)` (the returned
      function also has `.deferred`, `.immediate` and `.exclusive`, and
      nests as savepoints the way better-sqlite3's does);
    - `serialize()`, `close()`, and `open`/`inTransaction` getters.

- [ ] **Step 1: Branch and dependency**

```bash
git switch -c offline-spike
npm install --save-exact @sqlite.org/sqlite-wasm@<version>
```

- [ ] **Step 2: Write the failing spec** `src/device/sqlite-shim.spec.ts`

```ts
// Runs under the device config only (better-sqlite3 aliased to the shim).
it('drizzle round-trips through the shim', () => {
  const db = openDb(':memory:'); // the app's own openDb: migrations included
  const wall = { userId: 'u1', dance: 'salsa' } as const;
  // insert a user and an exercise with the existing helpers the suite's specs use,
  // log a set with logSet, then:
  expect(listSetsBetween(db, 0, Date.now() + 1, wall)).toHaveLength(1);
});
it('a throwing transaction rolls back', () => {
  /* insert inside db.transaction(() => { insert; throw }) → count unchanged */
});
it('nested transactions are savepoints', () => {
  /* the inner one throws and is caught; the outer one commits its own insert only */
});
```

- [ ] **Step 3: `vitest.device.config.ts`.** It extends `vite.config.ts`
  and sets:
  - `resolve.alias: { 'better-sqlite3': '/src/device/sqlite-shim.ts' }`;
  - `test.setupFiles: ['src/device/vitest-setup.ts']` (which awaits
    `initDeviceSqlite()`);
  - the same `server` project.

  Run `npx vitest run -c vitest.device.config.ts src/device`. Expected:
  FAIL, because `sqlite-shim.ts` doesn't exist yet.

- [ ] **Step 4: Implement `sqlite-shim.ts`** over the oo1 API
  (`sqlite3.oo1.DB`, `db.prepare`, `stmt.bind`/`step`/`get`, `db.changes()`,
  `sqlite3.capi.sqlite3_last_insert_rowid`; `sqlite3_js_db_export` for
  `serialize`).
  - Bind `undefined` as null. `Buffer`s pass as `Uint8Array`.
  - Integers above 2⁵³ come back as `bigint`; leave them alone.

  Run the Step 3 command. Expected: PASS.

- [ ] **Step 5: Run the whole suite on the shim**

Run: `npx vitest run -c vitest.device.config.ts 2>&1 | tail -40`

Expected: a pass/fail count. Compare it with
`npx vitest run 2>&1 | tail -5` on the same tree.

- Fix a failure in the shim when it's the shim's fault.
- Otherwise, write the spec file and the cause down for the findings,
  grouped by cause.
- Done when every remaining failure has a written cause.

- [ ] **Step 6: Commit**

```bash
git add -A src/device vitest.device.config.ts package.json package-lock.json
git commit -m "spike: better-sqlite3 shim over SQLite WASM; the suite on it"
```

---

### Task 2: The shell and the snapshot

**Files:**
- Create: `src/routes/+layout.ts`, with `export const ssr = false;` and a
  comment saying it's spike only
- Create: `src/routes/api/spike/snapshot/+server.ts`
- Create: `src/service-worker.ts`
- Create: `scripts/spike/serve.sh`

**Interfaces:**
- Produces:
  - `GET /api/spike/snapshot` returns the database as SQLite bytes
    (`application/vnd.sqlite3`), with the headers `x-spike-session` (the
    requester's `salsa_session` cookie value) and `x-spike-user` (their
    user id). It answers 404 unless `env.SALSA_SPIKE === '1'`, and 401
    when nobody is signed in.
  - The service worker's cache `shell-<version>` holds the last HTML
    navigation response under the key `/__shell`, plus every file in
    `build` and `files`.

- [ ] **Step 1: The snapshot route.** Use
  `getDb().$client.serialize()`. If drizzle's client isn't reachable as
  `$client` in 0.45, call `openDb`'s `Database` through `getDb().session`.
  It's a spike; note whichever worked.
- [ ] **Step 2: The service worker,** written with `$service-worker`
  (`build`, `files`, `version`):
  - **install:** precache `build` and `files`;
  - **activate:** delete the other caches, then `clients.claim()`;
  - **fetch, navigations:** network first; cache a 200 HTML response as
    `/__shell`; offline, serve `/__shell`;
  - **fetch, `/_app/`:** cache first;
  - **fetch, everything else:** the network for now (Task 3 adds the
    device routing).
- [ ] **Step 3: `scripts/spike/serve.sh`**
  1. Copy `.data/salsa.db` to `.data/spike.db` (with `sqlite3 .backup`).
  2. Run `npm run build`, then
     `npx vite build -c vite.device.config.ts` (once Task 3 has created
     that config; skip it until then).
  3. Start `node build` with `PORT=3300`, `DATABASE_PATH=.data/spike.db`,
     `DATA_DIR=.data`, `SALSA_SPIKE=1`, `BODY_SIZE_LIMIT=20M` and
     `ORIGIN=$1`.

  It takes the public origin as `$1` and runs in the foreground (the
  caller backgrounds it).
- [ ] **Step 4: Check it in desktop Chrome.**
  1. Start `scripts/spike/serve.sh http://localhost:3300` in the
     background.
  2. Sign in at `http://localhost:3300/login` with the dev admin
     (`ADMIN_EMAIL`/`ADMIN_PASSWORD` from the dev environment).
  3. Open `/salsa`. Expected: Today renders client-side, and
     `/salsa/__data.json` shows in the network tab.
  4. Open `/api/spike/snapshot`. Expected: a file whose first bytes are
     `SQLite format 3`.
  5. Turn on DevTools → Network → Offline and reload. Expected: the shell
     loads, and Today fails at its `__data.json` (the device answers it in
     Task 3).
- [ ] **Step 5: Commit**

```bash
git add -A src/routes/+layout.ts src/routes/api/spike src/service-worker.ts scripts/spike
git commit -m "spike: CSR shell cached by a service worker; snapshot endpoint"
```

---

### Task 3: Path A — SvelteKit's `Server` in a device worker

**Files:**
- Create: `vite.device.config.ts`
- Create: `src/device/node-stubs/fs.ts`
- Create: `src/device/node-stubs/path.ts`
- Create: `src/device/node-stubs/crypto.ts`
- Create: `src/device/node-stubs/os.ts`
- Create: `src/device/node-stubs/stream.ts`
- Create: `src/device/node-stubs/migrator.ts`
- Create: `src/device/worker.ts`
- Create: `src/device/client.ts`
- Create: `src/device/protocol.ts`
- Create: `src/hooks.client.ts`
- Modify: `src/service-worker.ts` (device routing)

**Interfaces:**
- Consumes: Task 1's `initDeviceSqlite`, `openPool` and `Database`; Task
  2's snapshot route and service worker.
- Produces (`src/device/protocol.ts`):

```ts
export type WireRequest = { url: string; method: string; headers: [string, string][]; body: ArrayBuffer | null };
export type WireResponse = { status: number; headers: [string, string][]; body: ArrayBuffer };
export type Mark = { name: string; ms: number }; // ms since the worker started
// service worker → page:  { type: 'device-fetch', request: WireRequest }, transferring a MessagePort
// page → worker:          the same message, the port passed on (the worker answers the service worker directly)
// worker → page:          { type: 'ready', marks: Mark[] } | { type: 'failed', message: string }
// worker → port:          WireResponse
export function isDeviceRequest(url: URL, method: string, headers: Headers): boolean;
```

`isDeviceRequest` is true for:
- a same-origin GET whose path ends in `/__data.json`;
- a POST carrying the `x-sveltekit-action` header.

It is false under `/api/`, `/login`, `/logout`, `/join`, `/admin`,
`/recordings/`, `/audio/`, `/count/`, `/lesson-videos/` and `/releases/`.
- `startDevice(): Promise<{ ok: boolean; marks: Mark[] }>` in `client.ts`
  never rejects. It resolves `ok: false` after 10 s or on `failed`.

- [ ] **Step 1: `vite.device.config.ts`.** It builds
  `src/device/worker.ts` as an ES library into `build/client/_device/`
  (`fileName: 'worker'`, code splitting kept, `target: 'es2022'`), with
  these aliases:
  - `better-sqlite3`: the shim;
  - `node:fs`, `fs`, `node:fs/promises`: `node-stubs/fs.ts`;
  - `node:path`, `path`: `path.ts`;
  - `node:crypto`, `crypto`: `crypto.ts`;
  - `node:os`: `os.ts`;
  - `node:stream`, `node:stream/promises`: `stream.ts`;
  - `drizzle-orm/better-sqlite3/migrator`: `migrator.ts`, whose `migrate`
    does nothing, because the snapshot is already current.

  It also sets `define: { 'process.env.NODE_ENV': '"production"' }`. A
  build step copies `node_modules/@sqlite.org/sqlite-wasm/**/sqlite3.wasm`
  to `build/client/_device/`.
- [ ] **Step 2: The stubs.**
  - **fs:** `existsSync` returns false, `readdirSync` returns `[]`, and
    `mkdirSync` does nothing. Every other function throws
    `Object.assign(new Error('device: fs.<name>'), { code: 'ENOENT' })`.
  - **path:** a minimal POSIX `join`, `resolve`, `dirname`, `basename` and
    `extname`.
  - **crypto:** `randomUUID` and `randomBytes` from `crypto.getRandomValues`.
    `createHash` and `timingSafeEqual` throw `device: crypto.<name>`.
  - **os, stream:** exports that throw `device: <module>.<name>` when
    called.
  - **Every stub** calls `console.warn('[device] <module>.<name>')` the
    first time it's called, so the findings can list what Today needed.
- [ ] **Step 3: `worker.ts`**, in this order, posting a `Mark` after each
  step:
  1. `globalThis.process ??= { env: {} }`, then
     `initDeviceSqlite({ locateFile: f => '/_device/' + f })`, then
     `openPool('salsa-spike')`. Mark `sqlite`.
  2. If the pool has no `/spike.db`, fetch `/api/spike/snapshot` and
     `importDb('/spike.db', bytes)`. Keep the session and user ids in the
     pool as `/spike-meta.json`. Mark `snapshot`, plus its byte size.
  3. Import `Server` and `manifest` from `.svelte-kit/output/server`, and
     run `server.init({ env: { DATABASE_PATH: '/spike.db', DATA_DIR: '/device' } })`.
     Mark `server`.
  4. Post `ready`.

  On `device-fetch`:
  1. Build `new Request(url, { method, body })`.
  2. Override its `headers` property with
     `Object.defineProperty(req, 'headers', { value: h })`. `h` is a
     standalone `Headers` holding the wire headers, plus
     `cookie: salsa_session=<id>; salsa_app=android` (the app cookie only
     when the wire `user-agent` has the app suffix) and
     `origin: <self.location.origin>`. A standalone `Headers` keeps the
     forbidden names, which is what gets the session past the hook and the
     action past SvelteKit's origin check.
  3. Run `server.respond(req, { getClientAddress: () => '127.0.0.1' })`.
  4. Reply on the port with a `WireResponse`. Mark the first one as
     `first-response`.
- [ ] **Step 4: `client.ts` and `hooks.client.ts`.**
  - `export const init = async () => { await startDevice(); }`, so
    SvelteKit's first `__data.json` waits for the worker.
  - `startDevice` makes `new Worker('/_device/worker.js', { type: 'module' })`.
  - It listens on `navigator.serviceWorker` for `device-fetch` and
    forwards it with the port, then calls
    `navigator.serviceWorker.startMessages()`.
  - It keeps the marks on `window.__deviceMarks` for Task 4.
- [ ] **Step 5: Service worker routing.**
  1. For `isDeviceRequest`, get `clients.get(event.clientId)`.
  2. Post `device-fetch` with a fresh `MessageChannel`'s `port2`.
  3. Await `port1`'s reply, with a 15 s timeout.
  4. Build the `Response`.

  When there's no client, no reply or a timeout, fall back to `fetch`.

  Check in desktop Chrome, offline:
  1. Run `serve.sh`, sign in online, and open `/salsa` once (the snapshot
     arrives).
  2. Turn DevTools Offline on and reload. Expected: Today renders from the
     device.
  3. Log a set from the log popup. Expected: it shows as done on the list.
  4. Reload offline. Expected: it's still there.
  5. Online, compare `select count(*) from sets` in `.data/spike.db` with
     before. Expected: unchanged, since nothing syncs.

  Review Focus 5: run
  `select name, (select count(*) from pragma_table_info(name)) from sqlite_master`
  and the row counts of `users`, `positions` and `figures` on the device DB
  (from the worker's console) before and after the first request. Expected:
  equal.
- [ ] **Step 6: Failure paths** (Review Focus 1 and 2).
  - Open a second tab on `/salsa` while the first holds the pool.
    Expected: its `startDevice` resolves `ok: false` and the tab works
    through the network, online.
  - Rename `/_device/sqlite3.wasm` on disk and reload. Expected: the app
    loads from the network within 10 s, with a console error.
- [ ] **Step 7: Commit**

```bash
git add -A vite.device.config.ts src/device src/hooks.client.ts src/service-worker.ts scripts/spike
git commit -m "spike: the server in a device worker, answering through the service worker"
```

### Task 3b (only if the Task 3 time box runs out): Path B — the dispatcher

Same files, but `worker.ts` doesn't import `.svelte-kit/output/server`.

- It collects `import.meta.glob('/src/routes/**/+{layout,page}.server.ts')`
  and matches the URL to the route chain through SvelteKit's generated
  `.svelte-kit/generated/client/nodes`, or a hand-written table for the
  Today routes alone.
- It calls each `load` with a hand-built event: `params`, `url`, `locals`
  from the device user, `depends`, `parent`, `cookies` a small Map.
- It serialises the result in `__data.json`'s
  `{ type: 'data', nodes: [...] }` shape with `devalue`, and actions as
  `{ type: 'success' | 'failure', status, data }`.
- `$lib/server` imports resolve normally here, because this bundle is
  separate from the client graph.

The check and the commit are Task 3's Steps 5 to 7. In the findings,
record what broke in A and how much of SvelteKit's internal format B had
to copy.

---

### Task 4: Timings on screen, measured on the desktop first

**Files:**
- Create: `src/device/Timings.svelte`
- Modify: `src/routes/+layout.svelte` (mount it, spike only)

**Interfaces:**
- Consumes: `window.__deviceMarks: Mark[]` (Task 3).

- [ ] **Step 1: The overlay.** A small fixed box in a corner, which a tap
  hides. It shows:
  - the device marks (`sqlite`, `snapshot` with its MB, `server`,
    `first-response`);
  - `first-contentful-paint` from `performance.getEntriesByType('paint')`;
  - `device: on|off` (whether `startDevice` was ok).
- [ ] **Step 2: Desktop numbers.** Record each of these three times, in
  Chrome with 4× CPU throttling:
  - **warm offline:** reload with DevTools Offline on;
  - **cold:** right after `serve.sh` rebuilds (a new service worker
    version), online;
  - **baseline:** the master build, from a second worktree
    (`git worktree add ../salsaapp-wt/spike-base master`, removed after
    Task 6), served the same way with SSR, warm.

  Also record `du -b build/client/_device/*`. These go in the findings
  table.
- [ ] **Step 3: Review Focus 3.** In a fresh Chrome profile, offline,
  having never signed in, open the origin. Expected: the login page or the
  offline screen. Never an empty Today. If it shows an empty Today, record
  it.
- [ ] **Step 4: Commit**

```bash
git add -A src/device/Timings.svelte src/routes/+layout.svelte
git commit -m "spike: timings overlay"
```

---

### Task 5: On the Android phone

**Files:** none new. This task runs commands and records numbers.

- [ ] **Step 1: Tunnel.**
  1. Run `nix run nixpkgs#cloudflared -- tunnel --url http://localhost:3300`
     in the background and read the `https://….trycloudflare.com` URL from
     its output.
  2. Restart `serve.sh <that URL>` in the background.
  3. Tell the user the tunnel serves a copy of the dev database, needs
     sign-in, and is stopped at the end of Task 6.
- [ ] **Step 2: APK.**
  1. Run `nix develop .#android -c ./android/gradlew -p android assembleSalsaDirectDebug -Psite=<URL>`.
  2. If the phone is on `adb devices`, `adb install -r` the APK;
     otherwise send it to the user with SendUserFile.
  3. Tell the user that this debug build replaces the installed Salsa app
     until they reinstall the real one, because it has the same id.

  If they'd rather not replace it, stop and ask.
- [ ] **Step 3: The user's run, guided by message.**
  1. Sign in, open Today, and note the overlay (cold).
  2. Close the app fully, switch to airplane mode, and reopen. Note the
     overlay (warm, offline). Do this three times.
  3. Log a set.
- [ ] **Step 4: Review Focus 4.** Still in airplane mode: kill the app
  from recents, reopen it, and check that the set is still on Today.
  Then, online, reopen the real production app (or the master build
  through the tunnel) and note its warm open, as the baseline.

  If the overlay can't be read, use `chrome://inspect` with the phone on
  USB.

---

### Task 6: On an iPhone home-screen app

- [ ] **Step 1: Ask the user whether an iPhone is at hand.** If not,
  record "iPhone: not tested", skip to Task 7, and say so in the go/no-go.
- [ ] **Step 2: Add to Home Screen.** In Safari, open the tunnel URL, sign
  in, open `/salsa`, then Share → Add to Home Screen. Open it from the home
  screen once while online.
- [ ] **Step 3: Offline.** Turn on airplane mode, open it from the home
  screen, and note the overlay. Log a set, close the app from the switcher,
  and reopen it. Expected: the set is still there. If OPFS is missing or
  the pool fails, record the console error. Safari's Web Inspector needs a
  Mac; without one, record what the overlay shows.
- [ ] **Step 4: Stop the tunnel and the server** (the background tasks).

---

### Task 7: Findings and go/no-go

**Files:**
- Create, on branch `offline`:
  `docs/superpowers/specs/2026-11-07-offline-spike-findings.md`

- [ ] **Step 1: Write the findings:**
  - path A or B, and why;
  - a table of the numbers: warm and cold opens on desktop, Android and
    iPhone, against the baseline; the bundle size; the snapshot's size and
    time;
  - the vitest-on-the-shim result and the causes of its failures;
  - every stub that got called, and "Shortcuts phase 2 must replace":
    - the forbidden-header override;
    - the session id held on the device;
    - `bootstrap()` running on the device;
    - SSR off everywhere;
    - the whole-database snapshot;
    - the no-op migrator;
  - the Review Focus results;
  - anything that changes the spec.
- [ ] **Step 2: Commit the findings on `offline`, not on the spike branch**

```bash
git switch offline
git add docs/superpowers/specs/2026-11-07-offline-spike-findings.md
git commit -m "docs: offline phase 0 spike findings"
```

- [ ] **Step 3: Go/no-go with the user.** Give the numbers against the
  pass bar and a recommendation: go with A, go with B, or rethink. The
  phase 1 plan is written only after a go.
