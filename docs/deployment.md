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
cd ~/.config/nixos-config
agenix -e secrets/salsa-prod.env.age
git add secrets/salsa-prod.env.age   # flakes only see tracked files
```

```
ORIGIN=https://salsa.anotherroot.eu
SESSION_SECRET=<openssl rand -base64 32>
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

## Backups

`salsa-backup.service`, nightly at 03:30 (catches up after downtime):

1. `sqlite3 .backup` → `/var/lib/salsa/backups/salsa-YYYY-MM-DD.db`, 14 kept.
2. Recordings and the snapshots are copied to `/home/tilen/Backups/salsa` on
   the server (recordings without `--delete`, so deleted clips survive).
3. Syncthing folder `salsa-backup` carries that to backtop (send-only →
   receive-only, staggered versioning on backtop).

Run one now: `ssh tilen@49.13.76.224 sudo systemctl start salsa-backup`.

Restore: stop the unit, copy a snapshot over `/var/lib/salsa/salsa.db` (remove
`salsa.db-wal`/`-shm`), copy recordings back into `/var/lib/salsa/recordings/`,
`chown -R salsa:salsa`, start the unit.
