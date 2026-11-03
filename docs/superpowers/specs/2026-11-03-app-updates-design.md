# Getting the app and keeping it current — design

Date: 2026-11-03.

## Why

Accounts are live: the admin sends a friend a one-time invite, the friend makes
an account on Join and lands on Today. There is no way for that friend to get
the Android apps (Salsa and Bachata): today they are debug builds installed over
adb from the author's laptop. Once friends have the apps, a new APK has to reach
their phones without the author, and the app must be able to say "you have to
update" for the rare release the old app cannot work with.

Separately, the site itself goes stale: a page left open (in a browser tab, or in
the app sitting in the background for days) keeps running old code after a
deploy. The author knows to close and reopen the app; a friend would just see
something break and get frustrated.

The model is the parent app's self-update
(`~/Projects/parent-workout-app/docs/superpowers/specs/2026-10-31-self-update-design.md`,
its plan in `.../plans/2026-11-01-self-update.md`, the installer in
`updater/android/src/main/kotlin/eu/anotherroot/updater/UpdaterPlugin.kt`, the
release script in `scripts/release.sh`). Copy its shape and its hard-won fixes;
the salsa apps differ in being a WebView around the site, with no screens of
their own.

The apps are not on the Play Store and won't be for now, but the setup must not
block a later move there.

## What the author decided

- **Invite → account first → get the app.** A friend opens the invite, makes the
  account in their phone's browser, and is then offered the app.
- **iPhone friends get the web app on the home screen.** No iPhone app at this
  stage.
- **Two kinds of APK update:** a reminder that stays until they update, and a
  "you can't use the app until you update" for breaking changes (rare, since
  most changes ship with the site).
- **APKs come from the author's server**, released with one command.
- **An open page must recover from a deploy by itself**, without the friend
  having to know to close and reopen anything.
- **Prepare for the Play Store** without going there yet.
- Approved in conversation as a whole, including every "my call" below
  (2026-11-03).

## Goals

### 1. Get the app page

- A page at **`/app`**, titled "Get the app". After **Create account** on Join,
  the new person lands here instead of on Today, unless they joined inside the
  Android app; then they go to `/` as now. Settings has a "Get the app" row that
  opens it again (hidden inside the app).
- It recognises the device from the user agent:
  - **Android:** one card per dance (Salsa, Bachata), each with **Download** →
    the current APK for that dance. Under the buttons, three short steps in
    plain words, with a small picture: your browser asks to allow installing
    apps from it → allow → Install; Play Protect may say it doesn't know the
    app → Install anyway; open the app and sign in with the account you just
    made. *(My call: a friend can't ask the author halfway through.)*
  - **iPhone / iPad:** per dance, "Open Salsa" (opens `/salsa` in Safari) and the
    Add to Home Screen steps (Share → Add to Home Screen). One line on what
    works differently: lesson videos upload only while the page is open, and
    there is no daily reminder. *(My call.)*
  - **Anything else (a computer):** "Open this page on your phone" with a QR
    code of the page's URL. *(My call.)*
  - **"Skip, use it in the browser"** → `/`, on every device.
- A dance with nothing published yet shows "The Android app isn't ready yet"
  in place of its Download button.
- `/app` itself needs a signed-in session, like every page; the APK downloads it
  links to are public (goal 3).

### 2. An open page keeps up with deploys

Four layers, all on the web side, so they work in a browser tab and in the app.

1. **Know a new version is out.** Set SvelteKit's `kit.version.name` to a
   per-build id and `kit.version.pollInterval` to a few minutes, and call
   `updated.check()` when the page becomes visible again (`visibilitychange`),
   which is also when the app comes back from the background.
2. **Reload at a safe moment, without asking.** Once `updated.current` is true,
   the next navigation **to a different page** becomes a full page load
   (`beforeNavigate` → cancel → `location.href`). It looks like an ordinary page
   change. It must not fire for a sheet's shallow-routing Back
   (`src/lib/sheets/`), for the full-screen player's own history entries
   (`src/lib/video/player-history.ts`), or before the unsaved-changes guard has
   had its say (`src/lib/unsaved/guard.svelte.ts`): the guard asks first, and
   only a navigation that goes ahead becomes a full load.
3. **If they stay on one page:** a small bar "New version · Reload" appears
   (shared `ui/` look, above the tab bar). And when the page becomes visible
   again with a new version out, it reloads by itself if nothing is unsaved and
   no practice run, recording or player is open; otherwise it only shows the
   bar.
4. **A safety net for breaking changes: the page epoch.** A client-safe
   constant `PAGE_EPOCH` (an integer, starting at 1) is raised by hand in the
   commit that makes the server incompatible with older pages. Every `fetch`
   the page makes (form actions, `__data.json`, `/api/` calls) carries it in a
   header, e.g. `x-page-epoch`. `hooks.server.ts` answers a request whose epoch
   is **lower** than the server's with **409** and a marker header; requests
   with no epoch (full page loads, the native app's own calls, the worker) are
   never refused by this. The page, on that answer: reloads if nothing is
   unsaved; otherwise shows "This page is out of date. Reload to continue."
   with Reload, and never silently throws away what was typed. *(My call: an
   integer in code instead of a server setting, so raising it is reviewed with
   the change that needs it and no deploy can forget it.)*

The epoch is how a breaking deploy is handled; layers 1–3 make it almost never
fire.

### 3. Published APKs on the server

- Files under **`$DATA_DIR/releases/<dance>/`**: `<versionCode>.apk` and
  `current.json` = `{ versionCode, versionName, minVersionCode, sha256, size,
  commit }`. They survive deploys. Not in the backup: they are rebuilt from git
  and the key. *(My call.)*
- **`GET /api/app-update/<dance>`** → current.json plus `url`, or **404** when
  nothing is published. **Public**, no session or token, so an app that is
  signed out or unpaired can still update.
- **`GET /releases/<dance>/<versionCode>.apk`**: public, served as
  `application/vnd.android.package-archive`, cacheable forever (the version is
  in the URL, so Cloudflare can never hand out an old file).
- `PUBLIC_PATHS` is an exact-match Set; these two need a prefix rule beside
  `/_app/`, scoped as tightly as the paths allow (a known dance, digits, `.apk`).
- The server reads `current.json` on request (or caches it and re-reads on
  change); a release must not need a server restart.

### 4. Releasing

`nix develop .#android -c ./scripts/release.sh salsa|bachata|both [--required]`,
modelled on the parent app's `scripts/release.sh`:

- refuses a dirty git tree, and records the commit in `current.json`;
- builds the **direct-channel release** APK for each named dance (goal 8);
- checks the signing certificate is the release key's (`apksigner verify
  --print-certs`) and refuses otherwise;
- reads the version code and name from the APK (`aapt2 dump badging`, reading
  the whole output: cutting it with `head` kills aapt2 under `pipefail`) and
  refuses unless the code is higher than the published one;
- uploads over ssh/rsync to the box (the target from `scripts/deploy.sh`'s
  config) as `<code>.apk.part`, renames it into place, and only then replaces
  `current.json` the same way, so a phone never sees metadata pointing at a
  half-uploaded file;
- `--required` sets `minVersionCode` to this release's code. Later releases
  without it keep the old minimum; the minimum never goes down;
- checks the public check URL and the APK URL answer as expected, and prints
  what is now published.

The version code and name live in one place in `android/` and are bumped by
hand in a commit; both dances share them. The first release is **versionCode
2**. *(My calls.)*

### 5. The app knows its version, the site draws the reminder

- The WebView appends to its user agent ` SalsaApp/<versionCode>
  (<dance>; <channel>)`. A pure parser (beside `src/lib/app-mode.ts`) turns that
  into `{ versionCode, dance, channel }`; `hooks.server.ts` puts it on
  `locals`. Plain browsers have none.
- The root layout's data says `appUpdate: 'none' | 'available' | 'required'`
  for a direct-channel app, by comparing against that dance's `current.json`.
- **Available:** a slim bar at the top of **Today**: "Update available ·
  Update". It cannot be closed but blocks nothing, and disappears once the
  installed version is current. Settings shows the app's version with the same
  button. No other screen shows it. *(My call; the author left the choice to
  me.)*
- **Required** (installed code below `minVersionCode`): every page of the app is
  replaced by an "Update needed" screen with Update, and nothing else. It
  appears at the next page load or navigation, so a practice run already on
  screen is not cut short.
- If the server is unreachable, the WebView shows its usual offline page; the
  update screens are never remembered on the phone.
- **Native requests carry `X-App-Version: <versionCode>; <dance>; <channel>`**
  (the dance from `BuildConfig.DANCE`: device tokens are not tied to a dance).
  An `/api/` request from an app below **its own dance's** minimum is refused
  with **426** (the API changed under it), whatever the channel: a breaking API
  change breaks a Play build too. *(My call, after review.)* The upload worker treats 426 like a pause, not a failure: the job stays
  queued and its notification says to update the app; it carries on after the
  update. *(My call: a breaking change is most likely in the native API, which
  the page epoch does not cover.)*

### 6. Pressing Update

- Update hands the job to the native side, through the existing WebView bridge
  pattern (`WebViewCompat.addWebMessageListener` in `WebShell.kt`, as the speech
  bridge does with its replies), so progress can come back to the page:
  "Downloading… 40%", then Android's install screen.
- Native: fetch `/api/app-update/<dance>`; download the APK into the app's cache
  (a complete download for the same version is not repeated); verify size and
  **SHA-256**, and refuse to install on mismatch; install through a
  `PackageInstaller` session. On Android 12+ request
  `USER_ACTION_NOT_REQUIRED` (with `UPDATE_PACKAGES_WITHOUT_USER_ACTION`) and
  fall back to Android's confirm screen where it is not granted; both paths must
  work.
- First time only: if this app may not install apps yet, open
  `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` for the package and resume the
  install when the person comes back.
- **Not while an upload is running:** the button says "Updating after your
  upload finishes" and starts by itself when the queue is idle. *(My call,
  copied from the parent app: installing kills the process, and a compression
  in progress would start over.)*
- Failures show one plain line with Try again: no connection, download broke,
  file didn't check out.
- Reuse the parent app's installer code where it fits; it already handles the
  session callbacks and waiting for Android's answer after its Update screen.

### 7. Seeing it arrive

- The server remembers, per person and dance, the last app version and channel
  it saw (from page loads' user agent) and when. New table, written at most
  once a minute per person and dance.
- The **admin page** shows each person's apps: "Salsa app 2 · today",
  "Bachata: no app", so the author can see who is behind before raising the
  minimum.

### 8. Ready for the Play Store, later

- **A real release key now.** Debug keys can't be used for friends: the key
  must never change, or no update installs. The plan creates it (`keytool`,
  a generated password) as `~/.config/salsa/release.jks` with its
  `~/.config/salsa/key.properties` beside it. Gradle reads that **fixed path**,
  so every worktree and tmux slot finds it; nothing about the key is in the
  repo. A release build without it **fails** rather than falling back to the
  debug key. The author backs up both files off the laptop (a task for the
  author at the end of the plan). *(My call, after review.)*
- **Debug builds are signed with the release key too** (the author's choice,
  2026-11-03), so `adb install -r` of a debug build keeps working over the
  release-signed apps and the dev loop stays as it is. Where the key files are
  missing (another machine), a debug build falls back to the debug key and
  `docs/deployment.md` says it won't install over the phone's apps. The fingerprint goes in `release.sh` and in
  `SALSA_ANDROID_CERT_SHA256`.
- **One-time cost for the author:** the installed debug-signed apps can't be
  updated by a release-signed APK, so Salsa and Bachata get uninstalled and
  reinstalled once. Sign-in and pairing are redone; nothing on the server is
  lost. The steps go in `docs/deployment.md`.
- **A `channel` flavor dimension** next to `dance`: `direct` (the self-updater,
  the `REQUEST_INSTALL_PACKAGES` and `UPDATE_PACKAGES_WITHOUT_USER_ACTION`
  permissions, channel "direct" in the user agent) and `play` (none of those).
  Play's policy forbids an app from updating itself outside Play, and
  restricts that permission, so all updater code and permissions live only in
  `direct`'s source set and manifest. The `play` variants are built by the
  Android test command so they keep compiling; nothing ships them yet.
- For a `play` install the site shows no update bar; "Update needed" says
  "Update from Google Play" and opens the store listing. Play's own in-app
  update API is for when the move happens, not now.
- When moving to Play: enrol in Play App Signing **with this same key** ("use
  my own key"), so phones that installed from the server can take Play's
  updates without reinstalling. Written in `docs/deployment.md` as a note for
  later.

### 9. Docs

- `docs/deployment.md`: "Releasing app updates" (the command, `--required`, the
  key and where it is backed up, the one-time reinstall), and "Moving to the
  Play Store" (goal 8's notes).
- `docs/superpowers/specs/2026-10-14-android-app-design.md`: a dated section
  pointing here (channels, the updater, the user agent).
- The main design spec: the Get the app page and the page epoch. `CLAUDE.md`:
  layout entries for the new modules and routes, and a hard rule for the page
  epoch ("raise `PAGE_EPOCH` in the commit that breaks older pages").

## Non-goals

- An iPhone app, TestFlight, or web push notifications on iPhone (worth a task
  in the notes, separately).
- Release notes in the app, staged rollouts, downgrades, delta updates.
- Updating while the app is closed or in the background.
- Play's in-app update API, or actually publishing on Play.
- Building or uploading the APK from the admin page.

## Anti-goals

- A friend left with a broken or uninstalled app: a wrong key, a corrupt or
  partial download, metadata pointing at a missing file.
- A reload that throws away typed work, or interrupts a practice run, a
  recording or the player.
- Technical words on a friend's screen ("APK", "version code", "epoch",
  "409").
- Nagging: the optional reminder lives on Today and in Settings only.

## Constraints

- The project's hard rules in `CLAUDE.md` hold: additive migrations only (new
  table is fine; no CHECK on an existing table), data functions take `db`
  first, nothing under `$lib/server` imported by components, specs never touch
  `$DATA_DIR` (the releases folder is read through a function that tests can
  point at a temp dir or mock), deny-by-default auth, device tokens on `/api/`
  only, forms with `use:guarded`, colours through the builders.
- Pure parts get pure modules and specs: the user-agent parser, "none /
  available / required", "may this navigation become a full load", the epoch
  check, the device sort on `/app`. Android pure parts (version compare, hash
  check, user agent string) get JVM tests.
- `npm run check` and `nix develop .#android -c ./android/gradlew -p android
  test assembleDebug` must pass, and the play and release variants must
  compile (their Kotlin and manifest tasks). A signed `assemble*Release` needs
  the key and is run by `release.sh` on the author's machine only.
- APKs are ~16 MB; Cloudflare's 100 MB limit is not a concern for downloads,
  and `release.sh` uploads over ssh anyway.
- The WebView's cookie jar is its own: after installing, a friend signs in once
  inside the app. The page says so.

## Left to the builder

- The table's name and columns for goal 7; how `current.json` is cached.
- The build id for `kit.version.name`; the poll interval (a few minutes).
- How the page attaches the epoch header (wrapping `window.fetch` early, before
  SvelteKit's first request, is one way).
- The bridge's message shapes for Update and its progress.
- Exact copy and layout of `/app`, the bars and the Update needed screen, in
  the redesign's components and tokens.
- Whether old APKs on the server are pruned (keep at least the current one).

## What was built, and known gaps

- **Where the bars show.** The "New version · Reload" bar is hidden on
  Practice and My count, and while an edit's or selection's bar claims the
  bottom: leaving those pages is already a full load. The "This page is out of
  date" bar shows everywhere.
- A `goto(…, { replaceState: true })` that becomes a full load pushes a history
  entry instead of replacing.
- The reload when the page becomes visible protects only work the unsaved
  guard tracks (for example a half-typed login while the password is fetched
  elsewhere).
- Once a stale navigation is held, the address bar may show the target URL
  until Reload.
- The first self-update always ends on Android's own "Update?" screen: silent
  installs only work once this app is its own installer of record.
- If Android kills the app while that confirm screen is waiting, pressing
  Update again reuses the downloaded file.
- Releasing: `scripts/release.sh`; see `docs/deployment.md`.
- **The 426 is for the native side only:** requests carrying `x-app-version`.
  A page's own `/api/` calls inside an old app's WebView (a take saved on My
  count, a song upload) are never refused by it; a page out of date is the
  page epoch's job.
- **Update needed never lands on a page mid-edit** (`updateNeededNow`): it
  comes with a page load or a finished navigation (every navigation in the app
  asks the server again); when the answer turns required on an open page, at
  once only if nothing is unsaved, open or held, otherwise at the next
  navigation. Once up it stays while the update is required.
- **"Not while an upload is running" means running:** a job only queued (paused
  by a 426, backing off, unpaired) does not hold Update back; it survives the
  reinstall and the next launch carries on with it.
- Settings shows the installed version number (what the user agent carries),
  not the release's name.
