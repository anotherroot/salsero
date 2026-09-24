# salsaapp agent guide

A personal practice companion for salsa and son, used from a browser-only work
PC and a phone.

**Live:** phase 1 (Today/Exercises, figures with recordings, custom exercises),
phase 2a (song library, the home worker, the beat grid), phase 2b (the
player: voice count, clave, random figure calls, count-only drills, and a
finished run logged as a set) and phase 4 (lessons: videos, notes, figure and
exercise links, and a four-band Today). **Not built:** phase 3, choreographies.

The design lives in
[`docs/superpowers/specs/2026-09-22-salsa-app-design.md`](docs/superpowers/specs/2026-09-22-salsa-app-design.md) —
read it before adding anything, and keep it current when the design changes.
It carries a "Known gaps" list for the player; check it before hunting a bug
that is already known. The count voice has its own spec,
[`docs/superpowers/specs/2026-09-23-count-voice-design.md`](docs/superpowers/specs/2026-09-23-count-voice-design.md):
count patterns, and the user's own voice recorded as half-bar phrases. Lessons
have theirs,
[`docs/superpowers/specs/2026-09-23-lessons-design.md`](docs/superpowers/specs/2026-09-23-lessons-design.md):
the chunked upload protocol, the link rules, and the four Today bands.

Toolchain comes from the nix flake — `nix develop`, or `direnv allow` once.
Sister project with the same conventions: `~/Projects/muscle_model`.

## Layout

```
src/lib/day/         PURE calendar-day maths in the user's zone. `now` is an argument
src/lib/urgency/     PURE "what next": (exercises, sets, now, tz) →
                     doneToday/due/upcoming/inactive
src/lib/beatgrid/    PURE beats → the dance count: gap filling, anchors, tempo factor
src/lib/scheduler/   PURE cues: grid + plan + toggles + window → what sounds when
src/lib/dances/      PURE registry: one entry per dance (styles, count patterns,
                     whether clave exists, accent colours). Client-safe
worker/              Python home worker (yt-dlp, ffmpeg, Beat This!) — runs at home, not on the server
src/lib/scheduler/attach.ts  the impure player: AudioContext, clips, the
                     25 ms look-ahead loop, speechSynthesis, the wake lock
src/lib/voice/       wav.ts and slice.ts are PURE (WAV bytes, where a recorded
                     half-bar starts); capture.ts owns the mic and the click
static/worklets/     recorder.js — the AudioWorklet that captures the mic.
                     Served, not bundled: addModule() takes a URL
src/lib/*.ts         client-safe: labels, frequency presets, limits, format, row types
src/lib/components/  ui/ shell/ today/ figures/ lessons/ songs/ player/
src/lib/server/      db (SQLite via Drizzle), auth, data access, form parsing, files
src/lib/server/scope.ts  the dance wall at the route level: guards on params
                     and ids, so a request only ever reaches its own dance
src/routes/[dance]/  every page lives under its dance. Flat routes — login,
                     settings, voice, api, the media servers — are shared
src/routes/          pages + actions. api/figures/[id]/recordings and api/songs
                     take raw-body uploads; api/lessons/[id]/videos/[uploadId]
                     takes ONE CHUNK per request; api/worker/* is the worker's queue
                     recordings/[file], audio/[file], count/[file] and
                     lesson-videos/[file] serve with HTTP Range
src/lib/media.ts     shared: telling a missing media file from an undecodable one
$DATA_DIR/           recordings/ audio/ count/ lesson-videos/ uploads/ — not in
                     the repo. uploads/ holds partial chunked uploads only, swept
                     at boot after 24 h. lesson-videos/ is NOT backed up: see
                     docs/deployment.md for why
static/clips/        the seven committed count/clave clips — regenerate with
                     scripts/make-clips.sh, never at build time
drizzle/             generated migrations — applied at boot, shipped by deploy.sh
scripts/deploy.sh    build locally, rsync, npm ci on the box, restart, health-check
scripts/make-clips.sh  one-off: Piper + ffmpeg → static/clips/. Output is committed
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
- **A spec must never touch `$DATA_DIR`.** Setting `process.env.DATABASE_PATH`
  does NOT work — the app reads it through `$env/dynamic/private`, which does
  not see a runtime mutation, so the spec silently runs against the real
  database. Tests that need the app's `getDb()` mock it:
  `vi.mock('$lib/server/db')` plus `openDb(':memory:')` per test, as
  `src/routes/[dance]/dance-wall.spec.ts` does. Data functions take `db` as
  their first argument precisely so most tests need no mock at all.
- **Nothing under `$lib/server` is imported by components.** Shared row shapes
  live in `src/lib/types.ts`.
- **Recordings are streamed, never buffered.** Raw-body POST to
  `/api/figures/[id]/recordings`; served with HTTP Range (iOS requires it). The
  size cap is `src/lib/limits.ts` — Cloudflare's 100 MB body limit is why it is
  95 MiB; nginx and `BODY_SIZE_LIMIT` in the host config sit just above it.
- **Lesson videos are chunked, recordings are not.** A recording is one request,
  so Cloudflare's 100 MB edge limit IS its cap. A lesson video is sliced into
  8 MiB chunks (`PUT .../videos/[uploadId]` with `content-range`), so its cap is
  the disk instead: 1 GiB, in `src/lib/limits.ts`. The partial file on disk is
  the only state — its size is the resume offset, a chunk must start exactly
  where the file ends, and anything else is a 409 carrying `x-received-bytes`.
  `BODY_SIZE_LIMIT` must be set on the host; adapter-node's 512 KB default is
  below one chunk and fails every upload.
- **Never add a CHECK to an existing table.** drizzle-kit rebuilds the table and
  the rebuild selects the new columns from the old one, failing at migrate time.
  A table with an incoming foreign key fails a second, independent way: the
  rebuild's `DROP TABLE` is an implicit delete, and while `openDb` sets
  `foreign_keys = ON`, drizzle's migrator runs the whole migration inside a
  transaction, where `PRAGMA foreign_keys` is a documented no-op — there is no
  point in the process where it can be turned off. Additive
  `ALTER TABLE ... ADD COLUMN` only; put the invariant in the data function, as
  `exercises.lesson_id` and the song/count pairing both do. Always read the
  generated SQL before committing it.
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
- **The player's timing is the audio clock's, not `setTimeout`'s.** Counts are
  decoded clips scheduled on an `AudioContext` with a 25 ms look-ahead;
  `src/lib/scheduler/scheduler.ts` decides WHAT sounds and WHEN in song time and
  never touches audio. Figure names go through `speechSynthesis`, which cannot be
  scheduled and does not need to be.
- **A dance is the wall through the content.** `figures`, `songs`, `exercises`
  and `lessons` carry `dance`; `sets`, `recordings` and the lesson join tables
  derive it through their parent, and `count_takes` is shared by both dances on
  purpose. Scoping happens in the data-access layer — `src/lib/urgency/` and
  `src/lib/day/` never learn that dances exist.
- **`figures.style` is vestigial; `style_tag` is real.** Read by nothing,
  backfilled into `style_tag` by migration 0005. Do not drop it or widen
  `figures_style_ck` — see the CHECK rule above for why a rebuild here can't
  be done safely.

## Commands

```sh
npm run dev           # DATA_DIR/DATABASE_PATH come from the flake (.data/)
npm run check         # prettier + eslint + svelte-check + build + vitest — must pass
npm run db:generate   # after editing src/lib/server/db/schema.ts
./scripts/deploy.sh   # see docs/deployment.md
./scripts/make-clips.sh   # regenerate static/clips/ — only when the voice changes
```

The dev database has no songs and the home worker does not run against it, so
the player's song mode has nothing to open. To exercise it locally, insert a
song row by hand with `status='ready'`, an `audio_file` under `.data/audio/`,
and a `beats_json` array — a click track from ffmpeg plus evenly spaced beats is
enough to check the count, the clave and the calls.

In dev, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first run; the admin is
created at boot when no user exists.
