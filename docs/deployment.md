# Deployment

One environment: production at `salsa.anotherroot.eu`, on the Hetzner VM
(`cloud`, flake attr `my-hetzner-vm`). Same shape as muscle_model, minus Postgres.

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
- `modules/services/ports.nix` — `salsa = 3060`.
- `secrets/salsa-prod.env.age` — the unit only exists once this file does.

## Secret

```sh
cd ~/.config/nixos-config/secrets   # agenix reads ./secrets.nix from the cwd
agenix -e salsa-prod.env.age
git add salsa-prod.env.age          # flakes only see tracked files
```

```
ORIGIN=https://salsa.anotherroot.eu
ADMIN_EMAIL=...
ADMIN_PASSWORD=<12+ chars, three of lower/upper/digit/symbol>
```

`ORIGIN` must be the public https URL — SvelteKit checks it for CSRF, and a
wrong value 403s every form POST while GETs work. The admin is created at first
boot only; changing `ADMIN_PASSWORD` later does not change an existing account.

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

**Before a deploy that carries a migration**, take a snapshot first — it is one
command and it is the difference between a bad migration costing a minute and
costing the history:

```sh
ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'
```

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

This deploy carries a migration (`0005`, the dance columns). Snapshot first:

```sh
ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'
```

The home worker needs no change and no redeploy — it claims songs by `status`,
dance-blind.

The per-dance icons live in `static/icons/` and ship inside `build/`, like the
count clips. `scripts/make-icons.sh` regenerates them locally, pulling librsvg
from nixpkgs at run time so the flake needs nothing; production never runs it.

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
  nothing to do exits silently; a processed song logs `song <id>: <n> beats`.
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
