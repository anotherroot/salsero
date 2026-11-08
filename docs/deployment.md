# Deployment

One environment: production at `salsa.anotherroot.eu` (salsa) and
`bachata.anotherroot.eu` (bachata), one node process and one database behind
both (the dance split), on the Hetzner VM (`cloud`, flake attr `my-hetzner-vm`).
Same shape as muscle_model, minus Postgres.

```
browser → Cloudflare (proxied wildcard) → nginx :443 (Let's Encrypt, publicAcme)
        → 127.0.0.1:3060 node (adapter-node, systemd unit `salsa`)
        → /var/lib/salsa/{salsa.db, recordings/, audio/, lesson-videos/, uploads/}
```

## Host configuration

Lives in `~/.config/nixos-config`, not here:

- `modules/services/salsa.nix` — user, directories, vhost (`client_max_body_size
  100m`, request buffering off), the `salsa` unit, the nightly `salsa-backup`
  timer, and a NixOS VM check (`nix build .#checks.x86_64-linux.svc-salsa`).
  Two directories were added with lessons: `/var/lib/salsa/lesson-videos` and
  `/var/lib/salsa/uploads`, both in the unit's `ReadWritePaths` and its tmpfiles.
- **`BODY_SIZE_LIMIT` must be set.** adapter-node's default is **512 KB**, which
  is below a single upload chunk, so with it unset every lesson-video upload
  fails — measured, not guessed. The unit sets it to `100m`, which covers the
  8 MiB chunks with room to spare. The endpoint answers such a rejection with a
  413 that names this setting, because the symptom otherwise points nowhere near
  the cause.
- **Two vhosts, one port.** `salsa.anotherroot.eu` and `bachata.anotherroot.eu`
  are the same `publicAcme { port = salsaPort; }` vhost (each its own
  certificate). nginx's `recommendedProxySettings` (`nginx-base.nix`) sends
  `Host` and `X-Forwarded-Proto`, which the app needs to tell the hosts apart.
  DNS needs nothing: the Cloudflare wildcard already covers the new name.
- `modules/services/ports.nix` — `salsa = 3060`.
- `secrets/salsa-prod.env.age` — the unit only exists once this file does.

## Secret

```sh
cd ~/.config/nixos-config/secrets   # agenix reads ./secrets.nix from the cwd
agenix -e salsa-prod.env.age
git add salsa-prod.env.age          # flakes only see tracked files
```

```
DANCE_HOSTS=salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=host
ADMIN_EMAIL=...
ADMIN_PASSWORD=<12+ chars, three of lower/upper/digit/symbol>
```

No `ORIGIN`: it names one host, and there are two. adapter-node builds the
request's origin from `HOST_HEADER` and `PROTOCOL_HEADER` instead, so
SvelteKit's CSRF check compares a form's `Origin` with the host it was sent to.
With `ORIGIN` set it wins over both, and every form POST on the other host is a
403 while GETs work. `DANCE_HOSTS` says which host is which dance; a host not in
it (loopback, dev) takes the dance from the path. The three may sit in the
unit's `Environment` instead, being no secrets. An admin is created at boot in
each dance that has no account; changing `ADMIN_PASSWORD` later does not change
an existing account.

## Rollout

Build first, then switch — the host also runs Firefly, Grafana, muscle and nikaudio.

```sh
cd ~/.config/nixos-config
nixos-rebuild build  --flake .#my-hetzner-vm
nixos-rebuild switch --flake .#my-hetzner-vm --target-host tilen@49.13.76.224 --sudo
```

Then from this repo: `./scripts/deploy.sh prod`. It builds locally, rsyncs
`build/`, `package.json`, the lockfile and `drizzle/`, runs `npm ci --omit=dev`
on the box, restarts the unit and health-checks `/health` over loopback.
Migrations run at boot.

**The offline device** (since offline phase 2): `npm run build` also builds the
device bundle under `build/client/_device/<version>/` and checks it (one
`.wasm`, at most 1.5 MB gzipped), so `deploy.sh` needs nothing more. Two
things live outside the repo:

- `/service-worker.js` must not be held by Cloudflare or nginx: serve it with
  `Cache-Control: no-cache` (or a Cloudflare cache bypass rule for that path).
  Browsers check it for updates past their own cache, but not past the CDN, so
  a cached copy delays a fix by the edge TTL. Check after a deploy:
  `curl -sI https://salsa.anotherroot.eu/service-worker.js | grep -i cache`.
- **Turning it off:** deploy a `src/service-worker.ts` that clears its
  `salsa-*` caches and calls `self.registration.unregister()`. A deploy
  without any service worker leaves the old one installed on every phone.

**Before a deploy that carries a migration**, take a snapshot first — it is one
command and it is the difference between a bad migration costing a minute and
costing the history:

```sh
ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'
```

**Before the groups migrations (`0020`–`0022`)**, check the data on a fresh
backup copy (never the live database). `0021` adds unique indexes on an
entry's person and target, and fails at boot if a person already has two
exercises for the same target — archived ones included: the indexes cover
every row, so archiving a duplicate does not help. Run each query; every one
must print nothing:

```sql
select user_id, lesson_id, count(*) from exercises where lesson_id is not null group by 1,2 having count(*) > 1;
select user_id, routine_id, count(*) from exercises where routine_id is not null group by 1,2 having count(*) > 1;
select user_id, figure_id, count(*) from exercises where figure_id is not null group by 1,2 having count(*) > 1;
```

(There is no `drill_id` to check yet: `0021` adds that column, empty.)

If any prints a row, fix the live database before the deploy, after the
snapshot and with the app stopped: keep one of the duplicates, merge the others into it — move their
sets over (`update sets set exercise_id = <kept> where exercise_id = <other>`)
and delete them (and any `links`, `spot_links` or `lesson_exercises` rows that
name them: `foreign_keys` is on) — or set the others' target column
(`lesson_id`, `routine_id` or `figure_id`) to null. Then run the queries again.

**Before the groups follow-ups and clones migrations (`0023`–`0027`)**, take
the backup above, then try the migrations on a copy of it before deploying.
`0023` (opens) and `0024` (`songs.team_id`, `songs.shared_at`,
`songs_team_idx`, `song_drops`) are additive. `0025` rebuilds `team_changes`
to widen its CHECKs; that is safe only because nothing has a foreign key into
or out of that table. `0027` (clones and twins) is additive: `gene_id` and
`cloned_from` on `figures`, `routines`, `songs`, `lessons`, `exercises`,
`recordings`, `lesson_videos` and `video_spots`, their indexes (unique per
owner on the root tables, over non-null genes only, so every existing row,
whose gene is null, passes), and the new tables `clone_pairs` and `twins`. No
table may be rebuilt by it. The script boots the trial once: the boot
migrates, settles the people who left a group before Keep, and only then runs
the integrity checks, which must all report 0:

```sh
bash -eu <<'EOF'
DB=/tmp/trial.db
LOG=/tmp/trial.log
fail() { echo "FAIL: $*" >&2; exit 1; }
# the backup just taken by `systemctl start salsa-backup` (named for today)
ssh tilen@49.13.76.224 "sudo cat /var/lib/salsa/backups/salsa-$(date +%F).db" > "$DB" \
  || fail "could not copy today's backup"
[ -s "$DB" ] || fail "the copied backup is empty"
mkdir -p /tmp/trial-data
before=$(sqlite3 "$DB" 'select count(*) from team_changes;')
npm run build
PID=
trap '[ -n "$PID" ] && kill $PID 2>/dev/null || true' EXIT
DATA_DIR=/tmp/trial-data DATABASE_PATH="$DB" HOST=127.0.0.1 PORT=3999 node build > "$LOG" 2>&1 &
PID=$!
# migrations run on the first request; retry while the server boots
curl -fsS --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3999/health \
  || fail "the trial server never answered /health"
# then wait (30 s at most) for the boot's last line: the cross-refs count, which
# comes after the settled former members
for _ in $(seq 30); do grep -q '\[integrity\] cross-refs' "$LOG" && break; sleep 1; done
kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true; PID=
grep '\[clones\] settled' "$LOG" || fail "no '[clones] settled N former group members' line"
[ "$(sqlite3 "$DB" 'select count(*) from __drizzle_migrations;')" -ge 27 ] \
  || fail "migrations did not run (fewer than 27 applied)"
sqlite3 "$DB" '.schema team_changes' | grep -q "'song'" \
  || fail "team_changes was not rebuilt: its CHECK does not name 'song'"
after=$(sqlite3 "$DB" 'select count(*) from team_changes;')
[ "$after" -eq "$before" ] || fail "team_changes had $before rows, now $after"
sqlite3 "$DB" '.indexes team_changes' | grep -qw team_changes_root_idx \
  || fail "team_changes_root_idx is missing"
for t in figures routines songs lessons exercises recordings lesson_videos video_spots; do
  for c in gene_id cloned_from; do
    sqlite3 "$DB" "select $c from $t limit 0;" > /dev/null 2>&1 || fail "$t.$c is missing"
  done
done
for t in clone_pairs twins; do
  [ "$(sqlite3 "$DB" "select count(*) from sqlite_master where type = 'table' and name = '$t';")" -eq 1 ] \
    || fail "table $t is missing"
done
[ "$(sqlite3 "$DB" "select count(*) from sqlite_master where instr(name, '__new_') > 0;")" -eq 0 ] \
  || fail "a table was rebuilt: sqlite_master still names a __new_ table"
grep '\[integrity\]' "$LOG"
for c in owners families cross-refs; do
  grep -q "\[integrity\] $c: 0 found" "$LOG" || fail "integrity $c is not 0 (its lines are above)"
done
echo "OK: 27+ migrations applied, $after team_changes rows kept, clones columns and tables present, integrity clean"
EOF
```

It stops at the first thing that is wrong and says what, and prints `OK: …`
only when all of it holds. The migrations run in `openDb`, which only a
request reaches, so the `curl` is what applies them: the migration count must
be at least 27, the `team_changes` schema must mention `'song'`, the row count
must match the one before, `team_changes_root_idx` must be listed, every
`gene_id` and `cloned_from` column must exist, `clone_pairs` and `twins` must
exist, and `sqlite_master` must name no `__new_` table (what a drizzle rebuild
leaves behind, and what `0027` must never do). Delete `/tmp/trial*`
afterwards, and never point this at the live database.

**What the boot logs, and what to look at.** Every boot first logs
`[clones] settled N former group members`: the people who left a group before
Keep shipped get Keep everything, once (`settleFormerMembers`); N is 0 from
the second boot on. A failed settling logs
`[clones] settling former members failed` instead, and the checks still run.
Then one count per integrity check: `[integrity] owners: N found`
(`ownerIntegrity`: a root row whose owner is not exactly one person or group),
`[integrity] families: N found` (`familyIntegrity`: a recording, lesson video
or section parent holding two pieces of one family) and
`[integrity] cross-refs: N found` (`crossRefs`: a group's row pointing outside
its group, or a person's routine slot, embed, section link, lesson link or
live practice entry pointing at a group row they do not read, or at another
person's row), each finding on its own `[integrity]` line above its count.
The checks run after the settling, so even the first boot after `0027` must
report 0 for each. Any finding is a bug: look at it before using the app. The
app still serves (the checks only log), but a person's row is pointing where
it must not, and the next change of reach may act on it.

**Before the positions deploy (`0028`, `0029`), back up the database**
(`/var/lib/salsa/salsa.db`: `sudo systemctl start salsa-backup`, above) **before the first boot.** That
boot runs the one-time positions move (`src/lib/server/positions-move.ts`, in
one transaction): the old shared positions become the admin's, every other
person or group whose figures used one gets a copy of the same gene with
their figures re-tagged, and `figures.end_position_id` is copied into
`figure_end_positions`. It runs once ever (the `app_flags` key
`positions-owned`), so the backup is the only way back to before it. `0028`
is additive: the tables `figure_end_positions`, `lesson_positions` and
`spot_position_links`, the owner, family, type, hold, notes and picture
columns on `positions`, their indexes, and a `DROP INDEX` of
`positions_dance_slug_idx` (an index, not a rebuild). `0029` rebuilds
`team_changes`, `twins`, `clone_pairs` and `team_trash` to widen their CHECKs
(`'position'`, and `'position-link'` in the trash), with unchanged columns and
no foreign key in or out, as `0025` did. The trial script above serves for it
with `-ge 29` in place of `-ge 27`. The first boot logs, once,
`[positions] moved: N copies, N figures, N ends` (copies made for other
places, their figures now tagged with one, end rows written); later boots log
no such line. The `[integrity]` counts that follow now cover positions too
(an owner per position, families, and the cross-refs of figure tags, lesson
hand links and section and point links) and must all be 0. `PAGE_EPOCH` is
raised, so open pages reload instead of posting the old figure form.

The player's voice clips need no deploy step of their own: they live in
`static/clips/`, so SvelteKit copies them into `build/client/clips/` and the
existing `build/` rsync carries them. `scripts/make-clips.sh` regenerates them
locally and its output is committed — production never runs Piper. The same is
true of `static/worklets/recorder.js`, which has to be served rather than
bundled because `addModule()` takes a URL.

**`$DATA_DIR/count/` is new** and holds the count takes the user records in the
app — their own voice, recorded once and not reproducible by rebuilding. The
backup unit copies whole directories under `/var/lib/salsa`, so it is already
covered; check that it is, because nothing else in the system can recreate it.

`better-sqlite3` is a native addon. `npm ci` fetches a prebuilt binary, which
loads under nixpkgs node (verified locally). If it ever fails to load on the
box, the fallback is building from source there (python3, gcc, gnumake).

This deploy carries a migration (`0005`, the dance columns), so the snapshot
above is not optional.

The home worker needs no change and no redeploy — it claims songs by `status`,
dance-blind.

The per-dance icons live in `static/icons/` and ship inside `build/`, like the
count clips. `scripts/make-icons.sh` regenerates them locally, pulling librsvg
from nixpkgs at run time so the flake needs nothing; production never runs it.

**The multi-dance deploy broke the existing home-screen install, once.**
`static/manifest.webmanifest` was deleted in favour of one manifest per dance,
so the icon already on the phone pointed at a path that now redirects to
`/login`. The fix is to add both to the home screen again — `/salsa/` and
`/bachata/`, which install as two apps with their own names and colours. That
is the feature, not a regression, but it is invisible until you re-add them.

## The dance split's rollout (once, 2026-11)

The deploy that carries migration `0033` splits every account that holds both
dances at boot (`splitAccounts`: the boot log says `[accounts] dances assigned:
N, split: M`, and `[integrity] dances: 0 found`). In this order, each step with
the user's go:

1. A fresh backup (`sudo systemctl start salsa-backup`), and the rehearsal on a
   copy of it: `node build` with `DATABASE_PATH` on the copy, a `DATA_DIR` holding
   the real `count/` files (a missing take fails that person's split), and
   `DANCE_HOSTS`, `PROTOCOL_HEADER` and `HOST_HEADER` set; check the boot log and
   the accounts.
2. nixos-config, **one switch**: the second vhost, the three variables, and
   `ORIGIN` removed from the secret. Never `DANCE_HOSTS` with `ORIGIN` still set:
   `ORIGIN` makes every request look like salsa's host, and the new code then
   redirects `/bachata/…` to the bachata host forever (a loop). The old code
   ignores `DANCE_HOSTS` and builds its CSRF origin from `Host`, so salsa keeps
   working until the deploy. Diff the closures first.
3. `./scripts/deploy.sh prod`; watch the boot log (`failed: 0`). Check
   `https://bachata.anotherroot.eu/login`.
4. Release the bachata app 1.6 (its own host). 1.5 and older go to the browser
   on the new host and cannot tell their user to update; install 1.6 by hand
   from `bachata.anotherroot.eu/app`.

## Home worker

Songs are downloaded and beat-analysed at home, never on the server: YouTube
answers every yt-dlp request from the Hetzner IP with "Sign in to confirm
you're not a bot", while the same version works from a home connection
(measured 2026-09-22). The beat model also wants ~660 MB, which this 3.7 GB box
shares with Firefly, Grafana, muscle and nikaudio.

- **Where:** `modules/services/salsa-worker.nix` in the NixOS repo, enabled per
  host with `my.salsa.worker.enable`. It runs on **backtop** today; laptop is a
  two-line change (enable there, disable here) plus adding `hosts.laptop` to
  `secrets/salsa-worker.env.age` in `secrets/secrets.nix` and running
  `agenix --rekey`.
- **When:** a oneshot unit on a timer, one minute after the previous run ends
  (`OnUnitInactiveSec`), so runs never overlap. `MemoryMax=2G`, `Nice=10`.
- **Pause it** without a rebuild: `sudo systemctl stop salsa-worker.timer`
  (the next `nixos-rebuild switch` starts it again). Turn it off for good by
  setting `my.salsa.worker.enable = false;` in the host file.
- **Watch it:** `journalctl -u salsa-worker -f` on the worker host. A run with
  nothing to do exits silently; a processed song logs `song <id>: <n> beats`,
  a saved YouTube video `video <id>: saved`.
- **Saved videos** (Save video on a figure's or lesson's YouTube link) come
  from a second queue, `/api/worker/videos/*`, drained after the songs: yt-dlp
  at most 480p and 60 minutes, ffmpeg to H.264 (`veryfast`, CRF 28), then an
  8 MiB chunked upload — so the server's `BODY_SIZE_LIMIT` must stay above one
  chunk, as lesson videos already need. An hour of video is minutes of encoding
  on the worker's two cores; a song queued meanwhile waits for the next run.
  A worker older than this never asks for video jobs, so deploying the server
  first is safe; the links just stay "Saving" until the worker is updated.
- **Auth:** `secrets/salsa-worker.env.age` holds `SALSA_WORKER_TOKEN`,
  readable by cloud (which checks it, as a second `EnvironmentFile` on the
  salsa unit) and by the worker host (which sends it as a bearer token). It is
  the only credential; everything the worker does is outbound HTTPS. Rotate by
  re-running the create command below and switching both hosts.

  ```sh
  cd ~/.config/nixos-config/secrets
  nix shell nixpkgs#openssl -c bash -c 'printf "SALSA_WORKER_TOKEN=%s\n" "$(openssl rand -base64 48 | tr -d "/+=\n" | cut -c1-48)"' | agenix -e salsa-worker.env.age
  ```

  (agenix replaces `$EDITOR` with `cp /dev/stdin` when stdin is not a terminal,
  which is why the token is piped in rather than written by an editor script.)
- **Updating the worker:** push salsaapp to `git@github.com:anotherroot/salsero`,
  then in the NixOS repo `nix flake update salsaapp` and switch the worker host.
  When YouTube breaks yt-dlp, update salsaapp's own `nixpkgs-unstable` input and
  do the same.
- **Never test the worker against `vite dev`:** the dev server skips SvelteKit's
  cross-site POST check, so a request that works there can still be refused with
  403 in production. Test against `npm run build && node build`, or the real host.

## Android app

`android/` builds one app per dance (Salsa and Bachata), each in two channels:
`direct` (the one that ships: it updates itself from the site) and `play`
(no updater, for the Play Store later; built so it keeps compiling). The site
in a WebView plus background uploads and the daily reminder (design:
`docs/superpowers/specs/2026-10-14-android-app-design.md`). Sideloaded, no Play
Store: friends get the direct build from the site's `/app` page (see
"Releasing app updates").

```sh
nix develop .#android -c ./android/gradlew -p android test assembleDebug
adb install -r android/app/build/outputs/apk/salsaDirect/debug/app-salsa-direct-debug.apk
adb install -r android/app/build/outputs/apk/bachataDirect/debug/app-bachata-direct-debug.apk
```

Salsa keeps the original package (`eu.anotherroot.salsa`), so it installs over
the old two-icon app and keeps its login, pairing and queue. Bachata
(`eu.anotherroot.bachata`) is a new app: it logs in and pairs once by itself.

Add `-Psite=https://…` to point a build at another host (https only: the app
allows no cleartext).

- **The site half ships with the server.** Migration 0013 (`device_tokens`, two
  `users` columns) applies at boot like any other; take the backup first.
- **`SALSA_ANDROID_CERT_SHA256`** (optional, in `salsa-prod.env`): the release
  key's SHA-256 fingerprint (see "Releasing app updates"), served at
  `/.well-known/assetlinks.json`; since the WebView (2026-10-29) the app does
  not read it:
  `38:F4:7B:2E:FD:A2:6D:32:70:EF:C6:F3:37:ED:75:86:5E:A0:E7:AD:FB:E1:95:13:52:E6:81:CD:4F:E9:B8:3A`.

- **Pairing:** the first upload (or reminder) sends the app to `/device/pair`;
  one tap there hands it a token. Each dance's app pairs separately. Settings
  lists paired devices ("Salsa app", "Bachata app") and removes them.
- **Test uploads against `node build` or the host**, never `vite dev`: the same
  CSRF caveat as the worker.

## Releasing app updates

The apps are release-signed and update themselves from the site (design:
`docs/superpowers/specs/2026-11-03-app-updates-design.md`). From a clean git
tree:

```sh
nix develop .#android -c ./scripts/release.sh salsa|bachata|both [--required]
```

It builds `assemble<Dance>DirectRelease`, checks the APK is signed with the
release key and that its version code is above the published one, uploads it to
`/var/lib/salsa/releases/<dance>/<code>.apk` over ssh, and only then replaces
`current.json` (the server caches it by mtime). `--required` raises the minimum
version to this one, so older apps must update before they go on; the minimum
stays for later releases.

- **Bump `versionCode` and `versionName`** in `android/app/build.gradle.kts`
  first (both dances share them). The script refuses a code that is not above
  the published one.
- **The key** is `~/.config/salsa/release.jks` with
  `~/.config/salsa/key.properties` (`storeFile`, `storePassword`, `keyAlias`,
  `keyPassword`). Neither is in the repo, and neither is ever overwritten.
  **Back both up off the laptop**: lose the key and no installed app can be
  updated again. Its SHA-256 is in `release.sh` (`CERT_RE`). Debug builds are
  signed with it too, so `adb install -r` of a debug build keeps working.
- Set **`SALSA_ANDROID_CERT_SHA256`** in `salsa-prod.env` to the key's
  fingerprint:
  `38:F4:7B:2E:FD:A2:6D:32:70:EF:C6:F3:37:ED:75:86:5E:A0:E7:AD:FB:E1:95:13:52:E6:81:CD:4F:E9:B8:3A`.
- **The one-time reinstall.** Apps installed from debug builds carry another
  key, so a release build cannot update them: uninstall Salsa and Bachata,
  install the release-signed builds (from `/app` on the phone), sign in and
  pair again. Nothing on the server is lost.
- Migration 0026 (`app_installs`; numbered after the groups migrations) ships with the site; take the backup before deploying it. 0027 (clones and twins) has its dry run with the groups follow-ups above.

### Moving to the Play Store

Not done. When it is: enrol in Play App Signing with this key ("use my own
key"), ship the `play` variants (they carry no updater; Play updates them), and
add Play's in-app update API then.

## Backups

`salsa-backup.service`, nightly at 03:30 (catches up after downtime):

1. `sqlite3 .backup` → `/var/lib/salsa/backups/salsa-YYYY-MM-DD.db`, 14 kept.
2. Recordings, song audio and the snapshots are copied to
   `/home/tilen/Backups/salsa` on the server (recordings and audio without
   `--delete`, so deleted clips and songs survive).
   **Lesson videos are deliberately NOT in the backup set.** They are up to 1 GiB
   each on a disk that is already ~80% full, and copying them nightly — without
   `--delete`, so nothing ever leaves — would fill both the server and backtop
   within a few classes. The database row survives, so a lost video shows as
   "the file for this video is missing" rather than a broken page. If a lesson
   ever deserves keeping, copy it off by hand. `/var/lib/salsa/uploads` is
   excluded too: it only ever holds partial uploads, swept after 24 hours.
3. Syncthing folder `salsa-backup` carries that to backtop (send-only →
   receive-only, staggered versioning on backtop).

Run one now: `ssh tilen@49.13.76.224 sudo systemctl start salsa-backup`.

Restore: stop the unit, copy a snapshot over `/var/lib/salsa/salsa.db` (remove
`salsa.db-wal`/`-shm`), copy recordings back into `/var/lib/salsa/recordings/`,
`chown -R salsa:salsa`, start the unit.
