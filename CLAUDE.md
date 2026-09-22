# salsaapp agent guide

A personal practice companion for salsa and son, used from a browser-only work
PC and a phone. Phase 1 (live): the Today/Exercises page, figures with
recordings, custom exercises. Phases 2–3 (songs + a player that counts and
calls figures; choreographies) are designed in
[`docs/superpowers/specs/2026-09-22-salsa-app-design.md`](docs/superpowers/specs/2026-09-22-salsa-app-design.md) —
read it before adding anything, and keep it current when the design changes.

Toolchain comes from the nix flake — `nix develop`, or `direnv allow` once.
Sister project with the same conventions: `~/Projects/muscle_model`.

## Layout

```
src/lib/day/         PURE calendar-day maths in the user's zone. `now` is an argument
src/lib/urgency/     PURE "what next": (exercises, sets, now, tz) → doneToday/todo/inactive
src/lib/beatgrid/    PURE beats → the dance count: gap filling, anchors, tempo factor
worker/              Python home worker (yt-dlp, ffmpeg, Beat This!) — runs at home, not on the server
src/lib/*.ts         client-safe: labels, frequency presets, limits, format, row types
src/lib/components/  ui/ shell/ today/ figures/
src/lib/server/      db (SQLite via Drizzle), auth, data access, form parsing, files
src/routes/          pages + actions; api/ for the raw-body recording upload
drizzle/             generated migrations — applied at boot, shipped by deploy.sh
scripts/deploy.sh    build locally, rsync, npm ci on the box, restart, health-check
```

## Hard rules

- **Urgency is never stored.** No "last done" column, no cron. It is a pure
  function of the sets, recomputed per request (`src/lib/urgency/`). Priority IS
  frequency (`every_days`).
- **Elapsed time sorts; calendar days speak.** Anything a user reads as a day
  ("yesterday", "done today", which day a set belongs to) goes through
  `localDay`/`daysBetween` in the user's zone. Elapsed ms is only for the
  urgency ratio. Never `Date.now()` inside `src/lib/day` or `src/lib/urgency`.
- **Every instant is an integer of epoch ms** in the database, never a Date.
- **Archive, don't delete.** Figures and exercises get `archived_at`; sets and
  recordings are the only hard deletes. A figure's exercise is created, renamed
  and archived WITH its figure, in one transaction (`src/lib/server/figures.ts`).
- **Data functions take `db` as their first argument** so tests run against
  `openDb(':memory:')`. Routes pass `getDb()`.
- **Nothing under `$lib/server` is imported by components.** Shared row shapes
  live in `src/lib/types.ts`.
- **Recordings are streamed, never buffered.** Raw-body POST to
  `/api/figures/[id]/recordings`; served with HTTP Range (iOS requires it). The
  size cap is `src/lib/limits.ts` — Cloudflare's 100 MB body limit is why it is
  95 MiB; nginx and `BODY_SIZE_LIMIT` in the host config sit just above it.
- **The server runs no Python and no ML.** Song downloads and beat analysis
  happen on the home worker (`worker/`, a systemd timer on backtop), which
  drains `/api/worker/*` over HTTPS with a bearer token. YouTube bot-blocks the
  server's IP, and the box has 3.7 GB shared with four other services.
- **The count is the user's, not the model's.** The grid is the detected beats
  (cleaned once on write in `storeAnalysis`); 1–8 comes from anchors the user
  tapped. Beat This!'s downbeats are only a first suggestion — measured
  unreliable on salsa.
- **Never judge the worker against `vite dev`.** The dev server skips
  SvelteKit's cross-site POST check; a worker request that passes there can
  still 403 in production. Test against `node build` or the real host.
- **Deny-by-default auth** in `hooks.server.ts`: a new route is private unless
  added to `PUBLIC_PATHS`.
- **Dates on screen are built by hand** (`src/lib/format.ts`), not with
  `toLocaleDateString` — ICU versions disagree and SSR must match hydration.

## Commands

```sh
npm run dev           # DATA_DIR/DATABASE_PATH come from the flake (.data/)
npm run check         # prettier + eslint + svelte-check + build + vitest — must pass
npm run db:generate   # after editing src/lib/server/db/schema.ts
./scripts/deploy.sh   # see docs/deployment.md
```

In dev, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first run; the admin is
created at boot when no user exists.
