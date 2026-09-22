# Deployment

One environment: production at `salsa.anotherroot.eu`, on the Hetzner VM
(`cloud`, flake attr `my-hetzner-vm`). Same shape as muscle_model, minus Postgres.

```
browser → Cloudflare (proxied wildcard) → nginx :443 (Let's Encrypt, publicAcme)
        → 127.0.0.1:3060 node (adapter-node, systemd unit `salsa`)
        → /var/lib/salsa/{salsa.db, recordings/}
```

## Host configuration

Lives in `~/.config/nixos-config`, not here:

- `modules/services/salsa.nix` — user, directories, vhost (`client_max_body_size
  100m`, request buffering off), the `salsa` unit, the nightly `salsa-backup`
  timer, and a NixOS VM check (`nix build .#checks.x86_64-linux.svc-salsa`).
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

`better-sqlite3` is a native addon. `npm ci` fetches a prebuilt binary, which
loads under nixpkgs node (verified locally). If it ever fails to load on the
box, the fallback is building from source there (python3, gcc, gnumake).

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
3. Syncthing folder `salsa-backup` carries that to backtop (send-only →
   receive-only, staggered versioning on backtop).

Run one now: `ssh tilen@49.13.76.224 sudo systemctl start salsa-backup`.

Restore: stop the unit, copy a snapshot over `/var/lib/salsa/salsa.db` (remove
`salsa.db-wal`/`-shm`), copy recordings back into `/var/lib/salsa/recordings/`,
`chown -R salsa:salsa`, start the unit.
