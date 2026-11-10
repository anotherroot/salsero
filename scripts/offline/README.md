# The offline walk

Proves in a real browser that every page renders from the device's copy (offline phase 2) and that
changes made offline land on the server once, dated and with their ids (phase 3), and is the gate for
shipping it. Two scripts:

    scripts/offline/serve.sh <db-copy>               # SKIP_BUILD=1 serves the build already in build/
    scripts/offline/walk.py <port> <upstream> <db>   # run under the Playwright command below

`serve.sh` copies the db (and a `<db>.data/` folder beside it, as `scripts/shots` does) to a `mktemp -d`,
never `.data/`, migrates the copy, inserts a session `walk` for the dance's first admin (`WALK_DANCE`,
default salsa), runs `npm run build` (inside `nix develop`) unless `SKIP_BUILD=1`, and starts `node build`
on a free port (`upstream`) with `DATABASE_PATH`, `DATA_DIR`, `BODY_SIZE_LIMIT=20M` and `ORIGIN` on a second
free port (`port`), where the walk puts its network. Once `/health` answers it prints `port <n>`,
`upstream <n>`, `db <path>` (the server's copy) and `log <path>`, then runs until it is killed; on exit it
kills the server's process group and deletes the temp dir. Start it in the background and hand the three
values to the walk.

`walk.py` runs one headless Chromium, one context at a time, a phone (390×844) signed in with the cookie
`salsa_session=walk`, and prints one line per check, `ok` or `FAIL <why>`; it exits 1 on any FAIL.

1. **Online.** Opens `/{dance}`, reloads, waits for `window.__device.state === 'ready'` (20 s cap). Times
   5 warm opens of `/{dance}` (load event; a second's pause before each so the last page's device worker is
   not still starting) with the service worker and 5 in a context with `service_workers='block'`, prints
   both medians, and fails when the first is more than 100 ms over the second.
   Then (device first) it taps each tab online and fails if any page data (`__data.json`) came from the
   server rather than the device (`X-Salsa-From: device`).
2. **Offline, every page.** `context.set_offline(True)`, then a full `goto` of every line of
   `scripts/shots/pages.txt`, placeholders filled by `shots.py`'s `placeholders`. A page passes with no
   `pageerror`, no console error (media files are phase 4's), no error page (`[data-error-screen]`) and a
   band title showing (a page without a band by design, `NO_BAND` in walk.py, mirrored from
   `src/lib/nav/bands.spec.ts`, shows its own proof instead: the map its title). A network page (`NETWORK_PAGES`: `/admin`, `/app`, `/settings/storage`, a group's
   History, …) must show the offline error page instead; so must `does-not-exist` (offline, `errorView`
   says offline over any status: the copy may be behind).
3. **Offline, client navigation.** From `/{dance}` with a fresh trail, taps each tab of the tab bar, then
   the first row of its list, with the same checks.
4. **Offline, a write.** Today's first exercise: its page, Done, a note typed into the Done sheet and a face
   (the face is the send). It saves on the device: the sheet closes, no `salsa:needs-connection`, the
   server's copy has no new `sets` row yet, the device answers that exercise's data with the log, one change
   waits (`window.__device.outbox`; its `oldestWaitingAt` is the made-at checked in 8), and
   the offline strip says "Offline · 1 change waiting".
5. **Offline, a network page.** A group lesson's History (`/{dance}/groups/<id>/history/lesson/<id>`: the
   app has no `/groups/<id>/history` page) shows the offline error page, not an empty History.
6. **Back online.** Renames a figure through its Edit form, waits for the device's next pull
   (`window.__device.pulls`), then offline again the figure page shows the new name. (Coming online sends
   4's log up too.)
7. **Offline, an edit.** Renames the figure again on the device: its page shows the name, and it waits.
8. **Online again.** Back online (both switches, and an `online` event): the outbox drains with nothing
   refused; the server has exactly one `sets` row with an id from the device's slot (≥ 2³²), its `done_at`
   within 1 s of 4's made-at, and the offline name; the strip says "All sent", then goes.
9. **Once.** 8's "exactly one" row is the check that nothing landed twice.
10. **Refused.** Offline, a note on the figure; the walk archives the figure in the server's db; online,
    the change is refused: the band's pill "1 couldn't sync ›" opens the Sync page, which says why ("It was
    archived or deleted meanwhile."); Discard (asked in its dialog) leaves "Everything is synced.". The
    walk then un-archives the figure.
11. **Online, no nag.** A log made online never shows "waiting" over 2 s, and lands.
12. **Needs a connection.** Offline, the figure's ⋯: with a group's Copy to, it is greyed under one note;
    without one (nothing of its own needs a connection), no note. Settings' Storage is greyed
    (`data-offline`) and a tap says so (`salsa:needs-connection`) and stays on Settings.
13. **A song with no signal** (phase 4a). Before the walk, `put_song` writes a 1-second WAV as the walk
    person's first song's audio into the server's `DATA_DIR` (a name the server would refuse gets a uuid
    one, in the copy only). Online the device keeps it (`media/audio/<file>` in OPFS, 30 s cap); a
    `Range: bytes=0-99` fetch of `/audio/<file>` answers 206 with 100 bytes and `X-Salsa-From: device`,
    online and offline; Settings' On this phone row says "Songs … · videos …".
14. **A lesson video with no signal** (phase 4b). Before the walk, `put_video` finds a lesson of the walk
    person's (or a group's they are in) with one video whose file is in `DATA_DIR`, and sets its row's size to the file's. Its
    page's phone button under the video keeps it (`data-keep` off → on); a `Range: bytes=0-99` fetch of
    `/lesson-videos/<file>` answers 206 with 100 bytes and `X-Salsa-From: device`, online and offline.

The walk writes to the server's copy (10's archive), so run it on a fresh `serve.sh` each time.
`WALK_SHOTS=<dir>` (an environment variable) saves a picture of the offline strip on the exercise and
the figure page.

**Offline is two switches.** `context.set_offline(True)` (the page's `navigator.onLine`), and the walk's own
network: a TCP relay on `port` to `upstream` that, switched off, resets every open connection and every new
one. Playwright's offline alone does not hold for a service worker (even with
`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`, it is gone after the next page load, and the service
worker's fetches reach the server again). The walk checks, before and after the full loads, that a fetch
from the service worker fails.

The db needs what `pages.txt` asks for (a lesson, a routine, a group, a song of the admin's own …): a
seeded copy (`scripts/shots/seed.sh`) does, with the admin's level set back to `all` so every tab shows.
The db holds personal data: never commit it.

## Playwright

As in `scripts/shots/README.md`:

    unset LD_LIBRARY_PATH
    export PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers)
    nix shell --impure --expr 'with (builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux; python3.withPackages (p: [p.playwright p.pillow])' -c python3 -I scripts/offline/walk.py <port> <db>

Run the browser under a memory cap on this machine, e.g.
`timeout 900 systemd-run --user --scope -q -p MemoryMax=6G -p MemorySwapMax=0 <the command above>`.
