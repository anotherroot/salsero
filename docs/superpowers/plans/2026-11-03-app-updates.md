# Getting the app and keeping it current — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friends get the Android apps from a Get the app page after Join; the
apps update themselves from the server (a reminder, or a forced update), and
open pages recover from a deploy by themselves.

**Architecture:** The server keeps the current APK per dance under
`$DATA_DIR/releases/` and answers a public check. The WebView tells the site
its version in its user agent, so the site draws the reminder and the Update
needed screen; pressing Update goes to native code through a web-message
bridge that downloads, checks the hash and installs with `PackageInstaller`.
Updater code lives only in a new `direct` channel flavor; a `play` flavor
leaves it out. On the web side, SvelteKit's version polling turns the next
page change into a full load, and a hand-raised `PAGE_EPOCH` refuses requests
from pages a deploy has broken.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), Drizzle + SQLite, Vitest;
Kotlin Android app (AGP 9.1, compileSdk 36, minSdk 29), JUnit 4; bash.

**Spec:** `docs/superpowers/specs/2026-11-03-app-updates-design.md`. Read it
first; this plan argues from it. Reference implementation for the native
installer and the release script: `~/Projects/parent-workout-app`
(`updater/android/src/main/kotlin/eu/anotherroot/updater/UpdaterPlugin.kt`,
`scripts/release.sh`).

## Global Constraints

- Every rule in `CLAUDE.md` holds. In particular: additive migrations only, and read the generated SQL; data functions take `db` first; specs never touch `$DATA_DIR` (point release reads at a temp dir); nothing under `$lib/server` imported by components; deny-by-default auth; a device token signs in on `/api/` only; colours through the builders (`ui/styles.ts`), no appended `text-*`.
- `npm run check` must pass after every web task. `nix develop .#android -c ./android/gradlew -p android test assembleDebug` must pass after every Android task (it builds every debug variant, `play` included, and runs every variant's unit tests).
- User agent suffix, exact: `` SalsaApp/<versionCode> (<dance>; <channel>)`` (a leading space), matched by `/SalsaApp\/(\d+) \((salsa|bachata); (direct|play)\)/`.
- Native header, exact: `x-app-version: <versionCode>; <dance>; <channel>`.
- `current.json`, exact keys: `{ versionCode, versionName, minVersionCode, sha256, size, commit }`. The check adds `url: "/releases/<dance>/<versionCode>.apk"`.
- Bridge object name `salsaUpdate`. Page → native: `start`. Native → page: `progress:<0-100>`, `confirming`, `permission`, `busy`, `current`, `failed:offline`, `failed:download`, `failed:check`, `failed:install`, `cancelled`.
- First release `versionCode = 2`, `versionName = "1.1"`; both dances share them, in `android/app/build.gradle.kts`.
- Release key: `~/.config/salsa/release.jks` and `~/.config/salsa/key.properties` (keys `storeFile`, `storePassword`, `keyAlias`, `keyPassword`). Never in the repo; never overwritten if present.
- No technical words on a friend's screen: no "APK", "version code", "epoch", status numbers.

## Review Focus

1. An app below the minimum must still reach `/api/app-update/<dance>` and `/releases/…`: the 426 gate must skip them, or the forced update can never download. (Task 3 test.)
2. A reload must never drop typed work or an upload in flight: auto-reload is refused while anything is unsaved, a sheet or the player is open, the Practice or voice page is shown, or an in-page upload holds it. (Task 7 tests, one per input.)
3. A broken or partial release: `current.json` missing, unreadable, or naming a file that is not there → the check answers 404 and the site shows no bar, never a 500. (Task 2 tests.)
4. Back, and the sheets' and player's shallow history, must never become a full load (it would push a new entry and break Back). (Task 7 test with `type: 'popstate'`.)
5. A tampered or truncated download must not install: size or SHA-256 mismatch → `failed:check`, file deleted. (Task 10 test.)

---

### Task 1: The shared formats (pure)

**Files:**
- Create: `src/lib/app-update/agent.ts`, `src/lib/app-update/agent.spec.ts`

**Interfaces:**
- Produces:
  - `type Channel = 'direct' | 'play'`
  - `interface AppAgent { versionCode: number; dance: DanceSlug; channel: Channel }`
  - `parseAppAgent(ua: string | null): AppAgent | null` (the user agent suffix)
  - `parseAppVersion(header: string | null): AppAgent | null` (the `x-app-version` header)
  - `interface Release { versionCode: number; versionName: string; minVersionCode: number; sha256: string; size: number; commit: string }`
  - `parseRelease(json: unknown): Release | null` (null on any missing or wrong-typed key, or negative numbers)
  - `type UpdateState = 'none' | 'available' | 'required'`
  - `updateState(agent: AppAgent, release: Release | null): UpdateState`
  - `type Device = 'android' | 'ios' | 'other'`
  - `deviceOf(ua: string | null): Device`

- [ ] **Step 1: Write the failing tests** in `agent.spec.ts`:
  - `parseAppAgent('Mozilla/5.0 (Linux; Android 16) … Chrome/140 Mobile Safari/537.36 SalsaApp/7 (bachata; direct)')` → `{ versionCode: 7, dance: 'bachata', channel: 'direct' }`; a plain Chrome UA → `null`; `SalsaApp/7 (tango; direct)` → `null`; `SalsaApp/x (salsa; play)` → `null`.
  - `parseAppVersion('3; salsa; play')` → `{ versionCode: 3, dance: 'salsa', channel: 'play' }`; `'3'` → `null`; `null` → `null`.
  - `parseRelease` accepts the exact `current.json` shape; returns `null` for `{}`, for `versionCode: '2'`, and for `minVersionCode: -1`.
  - `updateState`: release `null` → `'none'`; direct at 2, release 3 min 1 → `'available'`; direct at 2, release 3 min 3 → `'required'`; direct at 3, release 3 → `'none'`; play at 2, release 3 min 1 → `'none'` (Play updates it); play at 2, release 3 min 3 → `'required'`.
  - `deviceOf`: an Android Chrome UA → `'android'`; the app's own UA → `'android'`; an iPhone Safari UA → `'ios'`; an iPad UA containing `iPad` → `'ios'`; desktop Firefox → `'other'`; `null` → `'other'`.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/app-update/agent.spec.ts` (inside `nix develop`): module not found.

- [ ] **Step 3: Implement `agent.ts`.** Client-safe, no imports beyond `$lib/dances/dances` (`isDanceSlug`, `DanceSlug`).

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `feat(app-update): the user agent, header and release formats`.

---

### Task 2: Published releases on the server

**Files:**
- Modify: `src/lib/server/files.ts` (add `releasesDir()`)
- Create: `src/lib/server/releases.ts`, `src/lib/server/releases.spec.ts`
- Create: `src/routes/api/app-update/[dance]/+server.ts`, `src/routes/releases/[dance]/[file]/+server.ts`, `src/routes/api/app-update/app-update.spec.ts`
- Modify: `src/hooks.server.ts` (public patterns)

**Interfaces:**
- Consumes: `parseRelease`, `Release` (Task 1).
- Produces:
  - `releasesDir(): string` — `$DATA_DIR/releases`, created on first use, like `audioDir()`.
  - `readRelease(dir: string, dance: DanceSlug): Release | null` — reads `<dir>/<dance>/current.json`; null when the file is missing, unparseable, fails `parseRelease`, or `<dir>/<dance>/<versionCode>.apk` does not exist.
  - `currentRelease(dance: DanceSlug): Release | null` — `readRelease(releasesDir(), dance)`, cached per dance and re-read when `current.json`'s mtime changes.
  - `apkPath(dir: string, dance: DanceSlug, versionCode: number): string`
  - `isPublicPath(path: string): boolean` exported from `src/lib/server/public-paths.ts` (move `PUBLIC_PATHS` there from the hook, plus two patterns: `/^\/api\/app-update\/(salsa|bachata)$/` and `/^\/releases\/(salsa|bachata)\/\d+\.apk$/`).

- [ ] **Step 1: Write the failing tests.**
  - `releases.spec.ts` (temp dir from `mkdtempSync`, never `$DATA_DIR`): a valid `current.json` plus `2.apk` → the release; no folder → null; invalid JSON → null; valid JSON but `2.apk` missing → null.
  - `app-update.spec.ts`: mock `$lib/server/releases` (`currentRelease`) as `dance-wall.spec.ts` mocks the db. `GET /api/app-update/salsa` with a release → 200 and the JSON with `url: '/releases/salsa/2.apk'`; with null → 404; `GET /api/app-update/tango` → 404. The APK route: `/releases/salsa/2.apk` serves with `content-type: application/vnd.android.package-archive` and `cache-control: public, max-age=31536000, immutable`; `/releases/salsa/3.apk` when 3 is not on disk → 404; `/releases/salsa/..%2Fx.apk` → 404.
  - `public-paths` cases (in the same spec or `public-paths.spec.ts`): `/api/app-update/salsa` and `/releases/bachata/12.apk` → true; `/api/app-update/salsa/x`, `/releases/salsa/12.apk.part`, `/releases/salsa/current.json` → false; `/login` still true.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** The APK route checks the dance with `isDanceSlug` and the file against `/^(\d+)\.apk$/`, then streams with `serveFile` (`src/lib/server/files.ts:275`) and sets the cache header. The hook uses `isPublicPath(path) || path.startsWith('/_app/')`.

- [ ] **Step 4: Run, expect PASS**, then `npm run check`.

- [ ] **Step 5: Commit** — `feat(app-update): the server keeps each dance's current APK and answers the check`.

---

### Task 3: The server knows which app asks — seen versions and the 426

**Files:**
- Modify: `src/lib/server/db/schema.ts` (new table), generate `drizzle/0020_*.sql`
- Create: `src/lib/server/app-seen.ts`, `src/lib/server/app-seen.spec.ts`
- Create: `src/lib/server/app-gate.ts`, `src/lib/server/app-gate.spec.ts`
- Modify: `src/hooks.server.ts`, `src/app.d.ts` (`Locals.appAgent: AppAgent | null`)

**Interfaces:**
- Consumes: `parseAppAgent`, `parseAppVersion`, `AppAgent`, `Release` (Task 1); `currentRelease` (Task 2).
- Produces:
  - Table `app_installs`: `user_id` (text, FK users, cascade), `dance` (text), `version_code` (int), `channel` (text), `seen_at` (int, epoch ms); primary key `(user_id, dance)`. No CHECK.
  - `noteAppSeen(db: Db, userId: string, agent: AppAgent, now: number): void` — upsert; skips the write when the row has the same code and channel and `seen_at` is under 60 000 ms old.
  - `listAppsSeen(db: Db): { userId: string; dance: DanceSlug; versionCode: number; channel: Channel; seenAt: number }[]`
  - `refusesOldApp(path: string, agent: AppAgent | null, release: Release | null): boolean` — true only when `path` starts with `/api/`, is not under `/api/app-update/` or `/api/worker/`, the agent is present, and `agent.versionCode < release.minVersionCode`.
  - `locals.appAgent`: from the user agent on any request, else from `x-app-version`.

- [ ] **Step 1: Write the failing tests.**
  - `app-seen.spec.ts` on `openDb(':memory:')` with a seeded user: first call inserts; a second call 10 s later with the same agent leaves `seen_at` unchanged; one 61 s later updates it; a different `versionCode` 1 s later updates at once; salsa and bachata rows are separate; deleting the user deletes the rows.
  - `app-gate.spec.ts`: below minimum on `/api/device/today` → true; same agent on `/api/app-update/salsa` → false (Review Focus 1); on `/api/worker/next` → false; on `/salsa` (a page) → false; agent null → false; release null → false; at the minimum → false.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** Schema in Drizzle style beside `deviceTokens`; `npm run db:generate`; **read the SQL**: it must be one `CREATE TABLE` and nothing that touches another table. In the hook, after `locals.user` is set: compute `appAgent`; if `refusesOldApp(...)` with `currentRelease(agent.dance)`, return `new Response(JSON.stringify({ message: 'Update the app to keep using it.' }), { status: 426, headers: { 'content-type': 'application/json' } })`; if `locals.user && appAgent`, call `noteAppSeen(getDb(), …, Date.now())`.

- [ ] **Step 4: Run, expect PASS**; `npm run check`; run `src/lib/server/db/migrate.spec.ts`.

- [ ] **Step 5: Commit** — `feat(app-update): remember each person's app version; refuse an app below the minimum`.

---

### Task 4: The reminder, Update needed, and the Update button (web side)

**Files:**
- Create: `src/lib/app-update/view.ts`, `src/lib/app-update/view.spec.ts`
- Create: `src/lib/components/system/UpdateButton.svelte`, `src/lib/components/system/AppUpdateBar.svelte`, `src/lib/components/system/UpdateNeeded.svelte`
- Modify: `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`, `src/routes/[dance]/+page.svelte` (Today), `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `updateState`, `AppAgent`, `UpdateState` (Task 1); `currentRelease` (Task 2); `locals.appAgent` (Task 3).
- Produces:
  - Root layout data `appUpdate: AppUpdate | null`, with `interface AppUpdate { state: UpdateState; channel: Channel; dance: DanceSlug; installed: number; latest: { versionCode: number; versionName: string; url: string } | null }`; the load calls `depends('app:update')`.
  - `type BridgeStatus = 'idle' | { progress: number } | 'confirming' | 'permission' | 'busy' | 'current' | 'cancelled' | 'failed:offline' | 'failed:download' | 'failed:check' | 'failed:install'`
  - `parseBridge(message: string): BridgeStatus | null`
  - `updateView(status: BridgeStatus): { label: string; working: boolean; line: string | null }`
  - `showsUpdateNeeded(update: AppUpdate | null, routeId: string | null): boolean`

- [ ] **Step 1: Write the failing tests** in `view.spec.ts`. Exact copy:

| status | label | working | line |
|---|---|---|---|
| `'idle'` | `Update` | false | null |
| `{ progress: 40 }` | `Downloading… 40%` | true | null |
| `'confirming'` | `Installing…` | true | null |
| `'permission'` | `Update` | false | `Allow this app to install updates, then come back.` |
| `'busy'` | `Update` | true | `Updating after your upload finishes.` |
| `'current'` | `Update` | false | `You have the latest version.` |
| `'cancelled'` | `Update` | false | null |
| `'failed:offline'` | `Try again` | false | `No connection.` |
| `'failed:download'` | `Try again` | false | `The download broke.` |
| `'failed:check'` | `Try again` | false | `The download didn't check out.` |
| `'failed:install'` | `Try again` | false | `It didn't install.` |

  Also: `parseBridge('progress:40')` → `{ progress: 40 }`, `parseBridge('progress:140')` → null, `parseBridge('nonsense')` → null. `showsUpdateNeeded`: required on `/[dance]` → true; required on `/[dance]/player` → false; required on `/voice` → false; available → false; null → false.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.**
  - Layout load: `appUpdate` from `locals.appAgent` and `currentRelease(agent.dance)`; null outside the app.
  - `UpdateButton.svelte` (props: `update: AppUpdate`): with `window.salsaUpdate` present, posts `start` and listens on its `onmessage`, rendering `updateView`. While the status is `busy`, posts `start` again every 30 s while mounted. Without the bridge (an app from before the updater), it is a plain link to `update.latest.url`, which the WebView's download listener saves. On `play`, it opens `market://details?id=eu.anotherroot.<dance>` labelled `Update from Google Play`. Uses `button('primary', …)`.
  - `AppUpdateBar.svelte`: a `Banner kind="info"` titled `Update available` with `UpdateButton` as its action; no `ondismiss`. Shown at the top of Today's content when `appUpdate?.state === 'available'`.
  - `UpdateNeeded.svelte`: full screen, title `Update needed`, one line `This version of the app no longer works. Update to keep going.`, and `UpdateButton`. In the root layout, `showsUpdateNeeded(data.appUpdate, page.route.id)` renders it **instead of** `children()`.
  - Root layout: on `visibilitychange` to visible and `data.appUpdate` set → `invalidate('app:update')`.
  - Settings, "Android app" section (only when `data.appUpdate`): a row `Version <versionName or installed>` with `UpdateButton` when the state is not `none`.

- [ ] **Step 4: Run, expect PASS**; `npm run check`. Check by hand in `npm run dev`: in the browser's devtools, set a user-agent override ending in ` SalsaApp/1 (salsa; direct)`, then put a `current.json` with `versionCode: 2` and an empty `2.apk` under `.data/releases/salsa/`. Today shows the bar. Raising `minVersionCode` to 2 shows Update needed; the Practice page does not.

- [ ] **Step 5: Commit** — `feat(app-update): the update bar on Today, Update needed, and the Update button`.

---

### Task 5: Get the app

**Files:**
- Create: `src/lib/app-update/get-app.ts`, `src/lib/app-update/get-app.spec.ts`
- Create: `src/routes/app/+page.server.ts`, `src/routes/app/+page.svelte`, `src/routes/app/get-app.spec.ts`
- Modify: `src/routes/join/+page.server.ts` (redirect), `src/routes/join/join.spec.ts`, `src/routes/settings/+page.svelte` (a "Get the app" row, hidden in the app)

**Interfaces:**
- Consumes: `deviceOf`, `Device` (Task 1); `currentRelease` (Task 2); `inviteQr` (`src/lib/server/invites.ts`) and `components/admin/InviteQr.svelte` (its `label` prop) for the QR.
- Produces:
  - `getAppCards(device: Device, releases: Record<DanceSlug, Release | null>): { dance: DanceSlug; label: string; download: { url: string; size: string } | null; open: string }[]` — salsa first; `open` is `/<dance>`; `download` null when not Android or nothing is published; `size` via `byteSize` from `src/lib/format.ts`.
  - `joinLanding(inApp: boolean): '/' | '/app'`

- [ ] **Step 1: Write the failing tests.**
  - `get-app.spec.ts`: Android with both released → two cards, both with a download URL `/releases/<dance>/<code>.apk`; Android with bachata missing → bachata `download: null`; iOS → both `download: null`; `joinLanding(true)` → `/`, `joinLanding(false)` → `/app`.
  - `routes/app/get-app.spec.ts`: the load returns `device` and cards for an iPhone UA; for a desktop UA it also returns a `qr` of the page's own URL (`<origin>/app`).
  - `join.spec.ts`: change the existing "redirects to /" case to expect `/app`; add a case with the `salsa_app=android` cookie expecting `/`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** Copy for the page, exact:
  - Title `Get the app`. Lead line: `Practise from your phone's home screen.`
  - Android steps under the cards: `1. Your browser asks to allow installing apps from it: allow it, then tap Install.` `2. If Play Protect says it doesn't know the app, tap Install anyway.` `3. Open the app and sign in with the account you just made.` Plus a small picture of the allow screen (an inline SVG sketch, no screenshot file).
  - A card with nothing published: `The Android app isn't ready yet.`
  - iOS: per card a button `Open <Salsa>`; then `In Safari, tap Share, then Add to Home Screen.` and `On iPhone, lesson videos upload only while the page is open, and there is no daily reminder.`
  - Other: `Open this page on your phone.` and the QR.
  - Footer link on every device: `Skip, use it in the browser` → `/`.
  - Join's action redirects to `joinLanding(cookies.get(APP_COOKIE) === APP_VALUE)`. In Settings, the row `Get the app` → `/app`, rendered only when `!data.app`.

- [ ] **Step 4: Run, expect PASS**; `npm run check`; add `/app` to `src/lib/nav/bands.spec.ts` if that spec asks for it (every page draws a band).

- [ ] **Step 5: Commit** — `feat(app-update): Get the app, after Join and from Settings`.

---

### Task 6: The admin sees who is behind

**Files:**
- Modify: `src/lib/admin-view.ts`, its spec (`src/lib/admin-view.spec.ts`), `src/routes/admin/+page.server.ts`, `src/routes/admin/+page.svelte`, `src/routes/admin/admin-page.spec.ts`

**Interfaces:**
- Consumes: `listAppsSeen` (Task 3).
- Produces: `appsLines(seen: { dance: DanceSlug; versionCode: number; channel: Channel; day: string }[], today: string): string[]` — one line per dance in `DANCES` order. Exact: `Salsa app 2 · today`, `Salsa app 2 · yesterday`, `Salsa app 2 · Tue 28 Oct` (older, via `dayLabel`), `Salsa app 2 (Play) · today`, and `Bachata: no app`.

- [ ] **Step 1: Write the failing tests** for each of the five shapes above, and an admin load test where one person has a salsa row: `people[i].apps` equals `['Salsa app 2 · today', 'Bachata: no app']`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** The load groups `listAppsSeen(db)` by user and maps `seenAt` through `localDay(…, tz)`; each person row shows its lines under `personMeta` in `text-muted`.
- [ ] **Step 4: Run, expect PASS**; `npm run check`.
- [ ] **Step 5: Commit** — `feat(admin): each person's app versions`.

---

### Task 7: Open pages keep up with deploys (layers 1–3)

**Files:**
- Modify: `vite.config.ts` (the `sveltekit({...})` options: `version: { pollInterval: 300_000 }`; the default `name` is the build time, keep it)
- Create: `src/lib/nav/fresh.ts`, `src/lib/nav/fresh.spec.ts`, `src/lib/nav/fresh.svelte.ts`
- Create: `src/lib/components/shell/ReloadBar.svelte`
- Modify: `src/routes/+layout.svelte`; `src/lib/components/ui/ChunkedUploadButton.svelte`, `src/lib/components/ui/UploadButton.svelte`, `src/lib/songs/upload.svelte.ts`, `src/lib/components/player/PracticePanel.svelte` (hold while busy)

**Interfaces:**
- Produces:
  - `fullLoadFor(nav: { type: string; willUnload: boolean; fromPath: string; toPath: string | null }, s: { updated: boolean; asking: boolean }): boolean` — true only when `updated`, not `asking`, not `willUnload`, `type` is `link`, `goto` or `form`, and `toPath` is set and differs from `fromPath`.
  - `mayReloadNow(s: { routeId: string | null; playerOpen: boolean; sheetsOpen: boolean; unsaved: number; held: number }): boolean` — false on route `/[dance]/player` or `/voice`, or when the player or a sheet is open, or `unsaved > 0`, or `held > 0`.
  - `holdReload(): () => void` and `held(): number` in `fresh.svelte.ts` (a counter; the returned function releases once).

- [ ] **Step 1: Write the failing tests** in `fresh.spec.ts`:
  - `fullLoadFor`: link `/salsa` → `/salsa/moves` with updated → true; not updated → false; `asking: true` → false; `type: 'popstate'` → false (Review Focus 4); same path with another query → false; `willUnload: true` → false.
  - `mayReloadNow`: all clear on `/[dance]` → true; then one test per blocker, each set alone: route `/[dance]/player`, route `/voice`, `playerOpen`, `sheetsOpen`, `unsaved: 1`, `held: 1` → false (Review Focus 2).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - Root layout: one `beforeNavigate`, registered after `guardNavigation()` and the offline handler. When `fullLoadFor({ type: nav.type, willUnload: nav.willUnload, fromPath: page.url.pathname, toPath: nav.to?.url.pathname ?? null }, { updated: updated.current, asking: prompt.ask !== null })` is true: `nav.cancel()` and `location.href = nav.to.url.href`.
  - On `visibilitychange` to visible: `await updated.check()`. If that finds a new version and `mayReloadNow({ routeId: page.route.id, playerOpen: (entryState().videoPlayer ?? 0) > 0, sheetsOpen: (entryState().sheets ?? 0) > 0, unsaved: unsaved().length, held: held() })` is true, call `location.reload()`.
  - `ReloadBar.svelte`: when `updated.current` (and no reload happened), a slim pinned bar above the tab bar (`bottom: var(--pin-bottom)`) reading `New version` with a `Reload` button (`button('secondary','sm')`). Reload goes through `leaveOrAsk(null, () => location.reload(), 'Reload')` so unsaved work still gets asked about.
  - Holds: `ChunkedUploadButton` and `UploadButton` while uploading, `startSongUpload` until the upload ends, `PracticePanel` while its stopwatch runs.
- [ ] **Step 4: Run, expect PASS**; `npm run check`. Check by hand: `npm run build && node build`, open a page, rebuild and restart, then switch tabs away and back. The page reloads by itself, or shows the bar while a sheet is open.
- [ ] **Step 5: Commit** — `feat(nav): a page notices a deploy and reloads at a safe moment`.

---

### Task 8: The page epoch (layer 4)

**Files:**
- Create: `src/lib/page-epoch.ts` (`export const PAGE_EPOCH = 1;` and the pure `staleEpoch(header: string | null, current: number): boolean`), `src/lib/page-epoch.spec.ts`
- Modify: `src/app.html` (a fetch wrapper in the existing pre-paint `<script>`), `src/hooks.server.ts` (fill the placeholder; refuse stale requests), `src/routes/+layout.svelte` (listen), `src/lib/components/shell/ReloadBar.svelte` (the stale wording)

**Interfaces:**
- Consumes: `ReloadBar`, `mayReloadNow`, `held` (Task 7).
- Produces: header `x-page-epoch`; refusal = status **409** with header `x-page-stale: 1`; window event `salsa:stale`.

- [ ] **Step 1: Write the failing tests** in `page-epoch.spec.ts`: `staleEpoch(null, 2)` → false (a request without the header is never refused); `'1'`, 2 → true; `'2'`, 2 → false; `'3'`, 2 → false; `'x'`, 2 → false.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - `app.html`: `<html … data-page-epoch="%salsa.epoch%">`. The script, before any module loads, wraps `window.fetch`. For same-origin requests it adds `x-page-epoch` from that attribute. A response carrying `x-page-stale` dispatches `salsa:stale` on `window` and is returned unchanged.
  - Hook: `transformPageChunk` also replaces `%salsa.epoch%` with `PAGE_EPOCH`. Before `resolve`, for non-worker requests, `staleEpoch(request.headers.get('x-page-epoch'), PAGE_EPOCH)` → `new Response('Reload', { status: 409, headers: { 'x-page-stale': '1' } })`. Full page loads carry no header, so they are never refused.
  - Layout: on `salsa:stale`, if `mayReloadNow(...)` → `location.reload()`. Otherwise `ReloadBar` shows `This page is out of date. Reload to continue.` with Reload, through `leaveOrAsk` as in Task 7.
  - Add to `CLAUDE.md` Hard rules: `- **Raise PAGE_EPOCH (src/lib/page-epoch.ts) in the commit that breaks older open pages** — a changed form field, action or API shape they would still send. Open pages then reload instead of failing.`
- [ ] **Step 4: Run, expect PASS**; `npm run check`. Check by hand against `node build`: open a page, set `PAGE_EPOCH = 2`, rebuild and restart, press a one-tap action. The page reloads.
- [ ] **Step 5: Commit** — `feat(nav): the page epoch refuses requests from pages a deploy broke`.

---

### Task 9: Android — release key, channels, version, the app says who it is

**Files:**
- Modify: `android/app/build.gradle.kts`, `android/app/src/main/kotlin/eu/anotherroot/salsa/WebShell.kt`, `.../Api.kt`, `.../UploadPlan.kt`, `.../UploadWorker.kt`, `.../Reminders.kt` (where it calls `Api.today`)
- Create: `android/app/src/main/kotlin/eu/anotherroot/salsa/AppAgent.kt`, `android/app/src/test/kotlin/eu/anotherroot/salsa/AppAgentTest.kt`
- Modify: `android/app/src/test/kotlin/eu/anotherroot/salsa/UploadPlanTest.kt`

**Interfaces:**
- Produces:
  - `BuildConfig.CHANNEL` (`"direct"` / `"play"`), flavors `direct` and `play` in dimension `channel`, after `dance`. Variants become e.g. `salsaDirectDebug`, and the APK is `app/build/outputs/apk/salsaDirect/debug/app-salsa-direct-debug.apk`.
  - `fun appUserAgent(base: String, versionCode: Int, dance: String, channel: String): String` = base + `" SalsaApp/$versionCode ($dance; $channel)"`, unchanged when base already contains `SalsaApp/`.
  - `fun appVersionHeader(versionCode: Int, dance: String, channel: String): String` = `"$versionCode; $dance; $channel"`.
  - `Step.UpdateNeeded` in `UploadPlan.kt`; `nextStep` maps status 426 to it.
  - `class UpdateNeeded : Exception` in `Api.kt`, thrown by `Api.get` on 426.

- [ ] **Step 1: Make the key, once, on this machine.** If `~/.config/salsa/release.jks` exists, skip. Otherwise: `mkdir -p ~/.config/salsa && chmod 700 ~/.config/salsa`. Generate a password with `openssl rand -base64 24`. Run `keytool -genkeypair -v -keystore ~/.config/salsa/release.jks -alias salsa -keyalg RSA -keysize 4096 -validity 36500 -storepass "$PW" -keypass "$PW" -dname "CN=salsa.anotherroot.eu"` (inside `nix develop .#android`). Write `key.properties` with `storeFile=/home/…/.config/salsa/release.jks`, `storePassword`, `keyAlias=salsa` and `keyPassword`, then `chmod 600` both files. Print the SHA-256 (`keytool -list -v … | grep SHA256`) and note it for Task 11. Never print the password into a commit or the repo.
- [ ] **Step 2: Write the failing tests.** `AppAgentTest`: `appUserAgent("Mozilla/5.0 X", 2, "salsa", "direct")` → `"Mozilla/5.0 X SalsaApp/2 (salsa; direct)"`; applied twice it does not double; `appVersionHeader(2, "bachata", "play")` → `"2; bachata; play"`. `UploadPlanTest`: `nextStep(426, null, Step.Send(0, 9), 10, "")` → `Step.UpdateNeeded`.
- [ ] **Step 3: Run, expect FAIL** — `nix develop .#android -c ./android/gradlew -p android testSalsaDirectDebugUnitTest`.
- [ ] **Step 4: Implement.**
  - Gradle: `versionCode = 2`, `versionName = "1.1"`. Add `flavorDimensions += listOf("dance", "channel")` (replace the single `+= "dance"`). `direct` and `play` each get `dimension = "channel"` and `buildConfigField("String", "CHANNEL", …)`. Read `File(System.getProperty("user.home"), ".config/salsa/key.properties")`; when present, make signing config `release` and use it for **both** `release` and `debug`. When absent, debug keeps the debug key, and requesting any `assemble*Release`, `package*Release` or `bundle*Release` task fails with a message naming the file (the parent app's `app/android/app/build.gradle.kts:10-30` pattern). Keep minify off.
  - `WebShell.setUp`: `settings.userAgentString = appUserAgent(settings.userAgentString, BuildConfig.VERSION_CODE, BuildConfig.DANCE, BuildConfig.CHANNEL)`.
  - `Api.open`: `setRequestProperty("x-app-version", appVersionHeader(...))`. `Api.get`: 426 → `throw UpdateNeeded()`. The reminder treats it like an offline failure (skip quietly).
  - `UploadWorker`: on `Step.UpdateNeeded`, keep the job and return `Result.retry()`. Post (or update) its notification to say `Update the Salsa app to finish uploading <name>.` (the app's label from `R.string.app_name`). Do not count it as a stall.
- [ ] **Step 5: Run** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`, expect PASS (all eight unit-test variants; four debug APKs). Check `apksigner verify --print-certs app/build/outputs/apk/salsaDirect/debug/app-salsa-direct-debug.apk` shows the new key's SHA-256.
- [ ] **Step 6: Commit** — `feat(android): release key for every build, direct and play channels, version 2, the app names itself to the server` (the key files are outside the repo; `git status` must show none).

---

### Task 10: Android — the updater (direct channel only)

**Files:**
- Create: `android/app/src/main/kotlin/eu/anotherroot/salsa/UpdatePlan.kt`, `android/app/src/test/kotlin/eu/anotherroot/salsa/UpdatePlanTest.kt` (pure, in main so every variant tests it)
- Create: `android/app/src/direct/AndroidManifest.xml` (the two permissions), `android/app/src/direct/kotlin/eu/anotherroot/salsa/Updater.kt`, `android/app/src/direct/kotlin/eu/anotherroot/salsa/UpdateBridge.kt`
- Create: `android/app/src/play/kotlin/eu/anotherroot/salsa/UpdateBridge.kt` (no-op)
- Modify: `WebShell.kt` (call the bridge; resume hook)

**Interfaces:**
- Consumes: the bridge protocol and `current.json` shape (Global Constraints); `UploadQueue.store(context).isEmpty()`.
- Produces:
  - `data class Published(val versionCode: Int, val versionName: String, val sha256: String, val size: Long, val url: String)`; `fun parsePublished(json: String): Published?`
  - `fun isNewer(published: Published, installed: Int): Boolean`
  - `fun matches(file: File, size: Long, sha256: String): Boolean` (size first, then streamed SHA-256, lower-case hex)
  - `fun progressMessage(done: Long, total: Long): String` → `"progress:<0-100>"`
  - In both channels: `fun installUpdateBridge(shell: WebShell, web: WebView)` and `fun resumeUpdate(shell: WebShell)`. Play's do nothing.

- [ ] **Step 1: Write the failing tests** in `UpdatePlanTest`: `parsePublished` on a full check answer → the fields; missing `sha256` → null. `isNewer` 3 vs 2 → true, 2 vs 2 → false. `matches`: a temp file with known bytes and its real hash → true; the right size with a wrong hash → false; a truncated file → false (Review Focus 5). `progressMessage(0, 0)` → `"progress:0"`, `(50, 200)` → `"progress:25"`, `(200, 200)` → `"progress:100"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - `UpdateBridge` (direct): `WebViewCompat.addWebMessageListener(web, "salsaUpdate", setOf(BuildConfig.SITE))`, main frame only, keeping the reply proxy like the speech bridge. On `start`:
    - if `!UploadQueue.store(ctx).isEmpty()`, reply `busy`;
    - otherwise, on one background executor, GET `/api/app-update/<dance>` (no token needed). A network error replies `failed:offline`; a 404 or not `isNewer` replies `current`.
    - Download to `cacheDir/updates/<code>.apk.part` with `progressMessage` replies at most once per percent, then rename it to `<code>.apk`. Skip the download when `<code>.apk` exists and `matches`. A broken download replies `failed:download`.
    - `matches` false → delete the file and reply `failed:check`.
    - Not `canRequestPackageInstalls()` → remember the pending file, open `ACTION_MANAGE_UNKNOWN_APP_SOURCES` for the package, and reply `permission`.
    - Otherwise call `Updater.install`.
  - `resumeUpdate` (called from `WebShell.onResume`): if a pending file exists and installs are now allowed, run `Updater.install`.
  - `Updater.install(context, file, reply)`: port `install` and `listen` from the parent app's `UpdaterPlugin.kt` (session with `setAppPackageName`, `USER_ACTION_NOT_REQUIRED` on SDK ≥ 31, the per-session broadcast with `RECEIVER_NOT_EXPORTED`). Map statuses: pending user action → start the confirm intent and reply `confirming`; aborted → `cancelled`; any failure → `failed:install`. Replies are posted on the UI thread.
  - Direct manifest: `REQUEST_INSTALL_PACKAGES` and `UPDATE_PACKAGES_WITHOUT_USER_ACTION`, exactly as the parent app's `updater/android/src/main/AndroidManifest.xml`.
- [ ] **Step 4: Run** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`, expect PASS. Then `aapt2 dump permissions` on the salsaPlay debug APK: neither install permission is listed. On the salsaDirect debug APK, both are.
- [ ] **Step 5: Commit** — `feat(android): the direct build downloads, checks and installs its own update`.

---

### Task 11: release.sh and the docs

**Files:**
- Create: `scripts/release.sh`
- Modify: `docs/deployment.md`, `docs/superpowers/specs/2026-10-14-android-app-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `CLAUDE.md` (Layout entries: `src/lib/app-update/`, `src/lib/server/releases.ts`, `app-seen.ts`, `app-gate.ts`, `public-paths.ts`, `src/lib/nav/fresh*.ts`, `src/lib/page-epoch.ts`, `src/routes/app/`, `src/routes/releases/`, `scripts/release.sh`; the "Live" paragraph)

**Interfaces:**
- Consumes: `config/deploy/prod.config` (`SERVER_USER`, `SERVER_HOST`, `SERVICE_USER`, `PUBLIC_HOST`); the check and APK routes (Task 2); the key's SHA-256 (Task 9 Step 1).

- [ ] **Step 1: Write `scripts/release.sh`**, a port of `~/Projects/parent-workout-app/scripts/release.sh` with these differences:
  - usage `salsa|bachata|both [--required]`; `both` runs the per-dance steps for salsa, then bachata;
  - refuses unless `git status --porcelain` is empty; `commit` = `git rev-parse --short HEAD`;
  - builds with `./android/gradlew -p android assemble<Dance>DirectRelease`; the APK is at `android/app/build/outputs/apk/<dance>Direct/release/app-<dance>-direct-release.apk`;
  - `BT="$ANDROID_HOME/build-tools/36.0.0"`; `CERT_RE` is anchored to the full SHA-256 from Task 9, in lower case;
  - releases go to `/var/lib/salsa/releases/<dance>/` owned by `$SERVICE_USER`; the public base is `https://$PUBLIC_HOST`;
  - `current.json` gets `commit`;
  - keeps the parent app's order: `.part` upload → `mv` → `current.json.new` → `mv` → verify both URLs.
  Run `bash -n scripts/release.sh` and `shellcheck scripts/release.sh` (via `nix shell nixpkgs#shellcheck` if not in the shell). Both must be clean.
- [ ] **Step 2: Dry check without publishing.** Run `./scripts/release.sh tango` and expect usage, exit 2. Run it with a dirty tree and expect a refusal. Do **not** run a real release: publishing is the author's step.
- [ ] **Step 3: Docs.**
  - `docs/deployment.md`:
    - "Android app" gets the new APK paths for the adb installs.
    - A new "Releasing app updates" section: the command, `--required`, bumping `versionCode` and `versionName`, where the key lives, and that the author must back up both files off the laptop.
    - The one-time reinstall: uninstall Salsa and Bachata, install the release-signed builds, sign in and pair again.
    - Set `SALSA_ANDROID_CERT_SHA256` to the new fingerprint.
    - A "Moving to the Play Store" note: enrol in Play App Signing with this key ("use my own key"), ship the `play` variants, and add Play's in-app update API then.
  - Android spec: a dated "Updates and channels (2026-11-03)" section that points to the new spec.
  - Main design spec: a short "Get the app and fresh pages" section that points to the new spec.
  - `CLAUDE.md`: the Layout entries and the "Live" mention.
- [ ] **Step 4: Run** `npm run check` and the Android command, expect PASS.
- [ ] **Step 5: Commit** — `feat(release): release.sh publishes an app update; docs for releasing and the Play Store`.

### After the plan: the author's steps (not for an agent)

1. Back up `~/.config/salsa/release.jks` and `key.properties` off the laptop.
2. Deploy the site (`./scripts/deploy.sh`; migration 0020, so take the backup first).
3. Uninstall both apps on the phone, then `./scripts/release.sh both` and install from `/app` on the phone, which tests the friend's path end to end.
4. Later, bump the version, release again, and watch the bar and Update do the rest.
