# Salsa app — design

> **Status:** approved in brainstorming, 2026-09-22. Hosted at
> `salsa.anotherroot.eu`. Single user.

## Purpose

A personal practice companion for salsa and son (and other Afro-Cuban dance),
used mostly at lunchtime from a locked-down work PC (browser only) and from a
phone. It answers three needs:

1. **What should I practice today?** — an exercise list ordered by how overdue
   each exercise is, with sets logged per day and history browsable by day.
2. **Remember what I learned** — figures (dance moves) with recordings, and
   choreographies built from them, including routines for specific songs.
3. **Hear the music** — play saved songs (from YouTube or upload) with the
   count spoken aloud ("uno, dos, tres … cinco, seis, siete"), a clave click,
   slow-down, and figures called out in time ("right turn", "lateral").

## Vocabulary

| Term             | Meaning                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Figure**       | A specific dance move (_figura_): a right turn, _dile que no_, _enchufla_, a lateral. Partner or solo. Can be _callable_ — then the player can call it by voice.                    |
| **Choreography** | An ordered sequence of figures. **General** (just a sequence) or **song-bound** (each figure placed at an 8-count of one song). A song can have many choreographies.                 |
| **Exercise**     | Anything practiced and logged. Created automatically for every figure and every choreography, or created by hand (custom: "son basic 5 min", "clave clapping").                    |
| **Set**          | One logged bout of an exercise. Many per day allowed.                                                                                                                               |
| **8-count**      | Two bars of 4/4. Salsa counts 1–8 (spoken 1-2-3, 5-6-7; 4 and 8 are pauses). The musical grid is bars; the dance grid is 8-counts, so the user's correction picks which bar is "1". |

## Phases

Each phase is independently deployable and useful.

1. **Exercises & figures** — Today page, exercises, sets, frequency/priority,
   active/inactive, past-day navigation, figures with recordings (auto-creating
   an exercise), custom exercises, deploy + backups. `practice_mode` exists in
   the schema but every mode behaves as "log a set" until phase 2.
2. **Songs & player** — song library (YouTube URL via yt-dlp, or upload), beat
   and downbeat analysis, 1-correction, player with slow-down, voice count,
   clave click, random figure calls, count-only mode, TTS call clips for
   figures, song page, player runs save a set.
3. **Choreographies** — general and song-bound choreographies, auto-exercise,
   player follows a choreography, song page lists its choreographies.

Deferred beyond phase 3: stats/charts, ear-training quizzes (e.g. "2-3 or 3-2
clave?"), offline mode.

## Architecture

```
browser (work PC / phone, installable PWA)
  ├─ Today / Exercises   list, log sets, ‹ › day navigation
  ├─ Figures             list, detail, recordings
  ├─ Choreographies      (phase 3)
  ├─ Songs               (phase 2) library, add by URL/upload, song page
  └─ Player              (phase 2) <audio> + Web Audio scheduler
        │ HTTPS
salsa.anotherroot.eu → nginx (publicAcme, raised body size)
                     → node 127.0.0.1:3060 (SvelteKit, adapter-node)
                         ├─ SQLite   /var/lib/salsa/salsa.db (Drizzle)
                         ├─ files    /var/lib/salsa/recordings/, audio/, clips/
                         └─ /api/worker/*  job queue for the home worker
                                  ▲ outbound HTTPS only, bearer token
laptop (home, always on) — salsa-worker, systemd timer every minute
    yt-dlp → ffmpeg → Beat This! → beats/downbeats → back to the server
    piper TTS → call clips (phase 2b)
```

**Split of responsibility**

- **Server (SvelteKit):** auth, CRUD, file upload and range-served download,
  urgency computation per request, and a small job queue the home worker
  polls. The server runs no Python and no ML: it has 3.7 GB RAM shared with
  other services and an 80% full disk.
- **Home worker (`salsa-worker`, Python)** — phase 2, on the `laptop` host.
  Claims jobs over HTTPS, downloads with yt-dlp (YouTube bot-blocks the
  Hetzner IP), transcodes with ffmpeg, runs Beat This! (`final0` checkpoint,
  ~15 s and ~660 MB per song on CPU, measured) and posts beats + downbeats
  back. Phase 2b adds piper TTS call clips as another job kind. Packaged by
  the salsaapp flake; yt-dlp comes from nixpkgs-unstable because YouTube
  breaks old versions within weeks.
- **Browser:** all timing-critical work. The player must be sample-accurate
  relative to the music, so the scheduler runs where the music plays.

## Stack

SvelteKit 2 + Svelte 5, adapter-node, Tailwind 4, TypeScript, Drizzle ORM on
SQLite (`better-sqlite3`), Vitest. Same tooling conventions as
`~/Projects/muscle_model` (prettier, eslint, svelte-check, `npm run check`).
Nix flake dev shell: Node 22, sqlite, rsync/openssh/curl; phase 2 adds Python,
yt-dlp, ffmpeg, Beat This!, piper.

## Data model

All timestamps are UTC ISO strings / epoch ms; "day" is always derived through
the `day` module in the user's timezone (see Pure modules).

```
exercises
  id              integer pk
  name            text not null
  source          'figure' | 'choreography' | 'custom'
  figure_id       fk figures, nullable      -- set iff source = 'figure'
  choreography_id fk choreographies, null   -- set iff source = 'choreography'
  practice_mode   'song' | 'count' | 'none'  default 'none'
  song_id         fk songs, nullable        -- used when practice_mode = 'song'
  count_bpm       integer, nullable         -- used when practice_mode = 'count'
  every_days      real not null default 3   -- target frequency; 1 = daily
  active          boolean not null default true
  archived_at     timestamp, nullable
  notes           text, nullable
  created_at      timestamp

sets
  id              integer pk
  exercise_id     fk exercises not null
  done_at         timestamp not null
  duration_s      integer, nullable
  reps            integer, nullable
  rating          integer 1–5, nullable
  note            text, nullable
  player_json     text, nullable   -- phase 2: {speed, count, calls, clave, called:[figure_id...]}

figures
  id              integer pk
  name            text not null
  notes           text, nullable
  partner         'partner' | 'solo'
  style           'salsa' | 'son' | 'other'   default 'salsa'
  callable        boolean default true        -- used by the player, phase 2
  call_clip       text, nullable              -- clip file name, phase 2
  archived_at     timestamp, nullable
  created_at      timestamp

recordings
  id              integer pk
  figure_id       fk figures, nullable
  choreography_id fk choreographies, nullable -- phase 3; exactly one owner set
  file            text not null               -- name under recordings/
  mime            text not null
  kind            'video' | 'audio'
  size_bytes      integer
  note            text, nullable
  created_at      timestamp

songs                                          -- phase 2
  id, title, artist, source_url (nullable), style ('salsa'|'son'|'other')
  status ('pending'|'ready'|'failed'), error (nullable)
  duration_s, bpm
  beats_json, downbeats_json                   -- analysis output, replaced wholesale
  beats_json                                   -- cleaned beat times (gaps filled), seconds
  suggested_one   integer, nullable            -- beat index the model's downbeats vote for as "1"
  anchors_json    text default '[]'            -- user: beat indices tapped as "1", sorted
  tempo_factor    real default 1               -- user: 0.5 / 1 / 2 — count every other beat, as detected, or twice per beat
  created_at

choreographies                                 -- phase 3
  id, name, song_id (nullable), notes, archived_at, created_at

choreo_steps                                   -- phase 3
  choreography_id, position, figure_id,
  length_8s       integer default 1            -- how many 8-counts the figure takes
  start_8         integer, nullable            -- song-bound only: 8-count index in the song
```

**Rules**

- **Urgency is never stored.** It is a pure function of `(exercises, sets,
now)`, computed per request. No cron, no cached "last done" column.
- **Nothing is hard-deleted** except a set (a mistaken log) and a recording.
  Figures, choreographies and exercises are archived; sets keep pointing at
  them and history stays intact.
- **Creating a figure creates its exercise** in the same transaction
  (`source='figure'`, name = figure name, `practice_mode='none'`). Renaming the
  figure renames the exercise. Archiving the figure archives the exercise.
  Same for choreographies in phase 3; a song-bound choreography's exercise gets
  `practice_mode='song'` and that `song_id`.
- **Analysis output and user corrections are stored separately**, so
  re-analysing a song never loses a correction.
- `active = false` means "not practicing this right now": shown below the
  active list, dimmed, still loggable. Archived means gone from all lists.

## Today / Exercises page

The home page. One page serves both "exercises" and "today".

- **Header:** date with ‹ › arrows; › disabled on today. `?day=YYYY-MM-DD`
  in the URL so days are linkable and back-button friendly.
- **Viewing today:**
  1. **Done today** — exercises with ≥1 set today, at the top, in the "done"
     colour, showing the set count. Ordered by most recent set first.
  2. **To do** — remaining active exercises, most urgent first.
  3. **Inactive** — dimmed, collapsed by default, alphabetical.
- **Viewing a past day:** the exercises done that day with their sets (read-only
  list plus the ability to add a forgotten set to that day or delete a mistaken
  one). No urgency ordering — it answers "what did I do that day".
- **Logging:** tap an exercise → sheet with "Log set" (one tap logs a bare set
  now) plus optional duration / reps / rating / note. Multiple sets per day.
  After logging, the exercise moves into "done today" without a page reload.
- **Urgency:** `urgency = elapsed_days_since_last_set / every_days`.
  Never-done exercises sort first (by creation, oldest first). Ties break by
  name. `every_days` is set per exercise with presets (daily, every 2 days,
  3, weekly, every 2 weeks) — "priority" is expressed as frequency.
  An exercise reads as "overdue" once urgency ≥ 1.
- **Row content:** name, source badge (figure / choreo / custom), partner/solo
  icon for figures, "last done N days ago" (calendar days via `day`), and a
  subtle overdue marker.
- **Add custom exercise** button at the bottom of the list.

## Figures

- **List:** search box, filter by style and partner/solo. Archived hidden.
- **Detail:** name, partner/solo, style, notes, recordings (inline video/audio
  players), link to its exercise, "Log set" shortcut. Phase 3: "used in
  choreographies". Phase 2: callable toggle and call clip preview/record.
- **Recordings:** upload from the phone camera or mic via
  `<input type="file" accept="video/*,audio/*" capture>`, or any file from a
  desktop. Upload shows progress. Stored as-is under
  `/var/lib/salsa/recordings/<uuid>.<ext>`, served by an endpoint that supports
  HTTP range requests (seeking on phones). Max 95 MiB per file — see below.

## Songs & player (phase 2)

**Adding a song:** paste a YouTube URL (status `waiting_download`) or upload
an audio file (`waiting_analysis`). The home worker claims waiting songs with a
15-minute lease, so a job that dies mid-way is picked up again; after 5 failed
attempts, or a permanent error (video unavailable, longer than 15 minutes), the
song is `failed` with the error shown, **Retry** and **Upload a file instead**.
While laptop is off, songs simply wait; the library says so.

**Beat grid** (measured 2026-09-22 on a salsa and a son track): Beat This!'s
BEATS are good — 96–97% of inter-beat intervals within 8% of the median, tempo
stable to ±0.3 BPM across a song — but its DOWNBEATS are not reliable on salsa
(often a "bar" every 2 beats; phase votes 52/27/38/34), and a single
constant-tempo fit drifts 100+ ms at breaks. So:

- The grid IS the detected beats, with gaps (breaks, intros) filled at the
  median interval and near-duplicates dropped.
- The count comes from **anchors**: beat indices the user tapped as "1".
  Counting runs 1–8 forward from each anchor until the next one; before the
  first anchor it runs backwards from it. With no anchors, the downbeat vote
  (`suggested_one`) is used as a suggestion.
- A tap snaps to the nearest beat (minus ~80 ms for reaction time). Re-tapping
  later in the song re-anchors from there, which is how a count that slipped
  at a break is fixed. Anchors consistent with the previous one are dropped.
- `tempo_factor` fixes a half- or double-time detection (salsa measured at
  103 BPM is likely half the count rate): ×2 inserts midpoints, ×½ keeps every
  other beat. Changing it clears the anchors, since beat indices change.

**Player:**

- The song plays through an `<audio>` element (`playbackRate` 0.7–1.0 with
  `preservesPitch`) routed into an `AudioContext`. Voice and clave clips are
  decoded `AudioBuffer`s scheduled on the context clock with a look-ahead
  scheduler (≈100 ms horizon, 25 ms tick) that maps song time → context time
  from the element's current position and rate.
- **Toggles:** voice count, figure calls, clave (2-3 / 3-2), speed.
- **Calls:** every N 8-counts (1, 2 or 4; default 2) a callable figure is
  picked at random from the chosen pool (never the same twice in a row). The
  call plays over 5-6-7 so the figure starts on the next 1; the spoken count is
  suppressed on 5-6-7 when a call is playing. The first two 8-counts are count
  only.
- **Count-only mode:** no song; a synthetic grid at `count_bpm` with clave and
  voice.
- **Random drill and choreography share one scheduler:** the scheduler plays a
  _plan_ (list of `{start_8, figure_id}`); random drill generates the plan
  lazily, a choreography supplies it.
- **Ending a run** offers "Save as set" on the exercise it was opened from
  (duration, speed, toggles and figures called go into `player_json`).
- **Phone:** Screen Wake Lock while playing; audio starts on the Play tap
  (iOS unlock); hint that the iPhone silent switch mutes the voice but not the
  music.

**Voice clips:** a fixed set ships with the app (uno, dos, tres, cinco, seis,
siete, clave sounds). A figure's call clip is generated by
the home worker with a Piper voice (a `clip` job) when the figure becomes
callable, or recorded by the user from the figure page.

## Choreographies (phase 3)

- **General:** ordered steps, each a figure with a length in 8-counts.
- **Song-bound:** steps also carry `start_8`; the editor shows the song's
  8-count timeline and lets figures be placed on it while listening.
- Creating one creates its exercise. The song page lists its choreographies and
  every exercise with `song_id` = that song. The player, opened from a
  choreography, calls its figures on 5-6-7 before each step's start.

## Pure modules

No DB, no DOM, no `Date.now()` inside — `now` is always an argument.

| Module                   | Responsibility                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/day/`           | `localDay(instant, tz)`, `daysBetween(dayA, dayB)`. Anything a user reads as a day goes through here; elapsed milliseconds are only for urgency ratios. (Same rule as muscle_model.) |
| `src/lib/urgency/`       | `(exercises, sets, now, tz) → { doneToday[], todo[], inactive[] }` with urgency and "last done" per row.                                                                               |
| `src/lib/beatgrid/` (2)  | Beats + downbeats + corrections → count (1–8) and 8-count index at any song time; synthetic grid for count-only.                                                                       |
| `src/lib/scheduler/` (2) | Plan + grid + toggles + time window → list of `{at, clip}` events. The only impure part is a thin `attach.ts` that owns the `AudioContext`.                                            |

## Errors

- Form actions return validation failures that keep entered values; nothing
  fails silently.
- Upload too large → clear message before and after upload (client checks
  size first; nginx and the endpoint both enforce 300 MB).
- Analysis failures → `failed` with message, Retry, Upload instead (phase 2).
- Missing recording file on disk → recording shows "file missing", not a crash.

## Auth

Single user, email + password, carried over from muscle_model: scrypt, session
cookie, login rate-limited per IP and per account, identical copy for wrong
password and unknown user, admin seeded from env (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`). No Cloudflare Access in front, same as muscle.

## Testing

- **Vitest, pure modules first and thoroughly:** `day` (timezone edges,
  late-evening sets read next morning), `urgency` (ordering, never-done,
  done-today, inactive, ties), later `beatgrid` and `scheduler` (which clip on
  which count, suppression on calls, speed changes, no repeats).
- **Server actions** against a temporary SQLite file: log set, delete set,
  create figure → exercise exists, rename propagates, archive propagates,
  upload size rejection.
- **Phone layout** checked at phone width in a browser during development;
  real-device checks (wake lock, iOS audio) by the user after deploy.
- `npm run check` = lint + types + build + tests, must pass before deploy.

## Deployment

Mirrors muscle_model's `docs/007-deployment.md`, minus Postgres.

- **NixOS repo** (`~/.config/nixos-config`):
  - `modules/services/ports.nix`: `salsa = 3060`.
  - `modules/services/salsa.nix`, modelled on `muscle.nix`: system user
    `salsa`, tmpfiles for `/var/lib/salsa{,/app,/recordings,/audio,/clips,/backups}`,
    `services.nginx.virtualHosts."salsa.anotherroot.eu" = publicAcme { port = …; }`
    plus `client_max_body_size 300m`, systemd unit (node 22,
    `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`, hardening as muscle,
    `ReadWritePaths=/var/lib/salsa`), agenix secret gated on
    `my.secrets.bootstrap`, a NixOS VM check.
  - Backup timer: nightly `sqlite3 salsa.db ".backup backups/salsa-<date>.db"`,
    keep 14.
  - `secrets/salsa-prod.env.age`: `DATABASE_PATH=/var/lib/salsa/salsa.db`,
    `DATA_DIR=/var/lib/salsa`, `ORIGIN=https://salsa.anotherroot.eu` (must be
    the public URL — CSRF), `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
    `TZ_USER=Europe/Ljubljana`.
  - Phase 2: `modules/services/salsa-worker.nix` on `laptop` (oneshot +
    1-minute timer, DynamicUser, MemoryMax 2G), secret `salsa-worker.env.age`
    (`SALSA_WORKER_TOKEN`) readable by cloud and laptop, and salsaapp as a
    private GitHub flake input (`git+ssh://git@github.com/anotherroot/salsaapp`).
- **Build first, then switch** on the shared host.
- **App repo:** `scripts/deploy.sh prod` — build locally, rsync `build/`,
  `package.json`, lockfile and `drizzle/`, `npm ci --omit=dev` on the box
  (`better-sqlite3` builds natively there), restart, health-check
  `http://127.0.0.1:3060/health` over loopback. Migrations run at app boot.
- DNS: nothing to do if the zone's wildcard reaches the box; otherwise a
  grey-clouded A record so ACME HTTP-01 works.

## Decided after review

- **Off-box backup:** the nightly backup job also copies recordings and the
  newest DB snapshot into `/home/tilen/Backups/salsa` on the server, shared by
  Syncthing as a send-only folder to `backtop` (receive-only). No `--delete`,
  so a deleted recording survives in the backup.
- **Timezone:** `Europe/Ljubljana` (stored on the user row, as muscle_model).

- **Recording size cap is 95 MiB, not 300 MB.** The hostname is behind
  Cloudflare's proxy, whose free plan rejects request bodies over 100 MB at the
  edge. nginx and `BODY_SIZE_LIMIT` sit at 100m, just above the app's own check.

- **YouTube downloads run at home, not on the server (phase 2).** Tested
  2026-09-22 with yt-dlp 2026.08.19: from the Hetzner IP every video, even a
  plain upload, fails with "Sign in to confirm you're not a bot"; from the home
  connection the same version downloads both a plain upload and an official
  label video. Design: pasting a URL creates a song with status
  `waiting_download`. A fetcher on the always-on `laptop` host (a systemd
  timer declared in nixos-config, running every minute or so) asks the server
  for waiting songs over HTTPS, downloads audio with yt-dlp, and uploads it back
  with a per-device token (agenix secret on both ends). The server then runs
  the beat analysis as for an uploaded file. Outbound-only from home: no
  tailnet membership, nothing exposed. Songs wait while laptop is off; the
  library shows "waiting for the home fetcher". Uploading a file stays the
  fallback. Cookies on the server were rejected (expiry, account-flag risk).

## Open items

- `better-sqlite3` is a native addon; its prebuilt binary may not load on
  NixOS. Verify on the server early in phase 1. Fallbacks: build it on the box
  with the toolchain in the unit's environment, or switch the Drizzle driver to
  `@libsql/client` (file mode).
