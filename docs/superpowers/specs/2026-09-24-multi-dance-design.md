# Multi-dance — design

> **Status:** approved in brainstorming, 2026-09-24. Extends
> [`2026-09-22-salsa-app-design.md`](2026-09-22-salsa-app-design.md), which
> stays the overall design; this document owns the dance dimension, the dance
> registry, and the URL scheme.

## Purpose

Bachata needs the same app: figures with recordings, songs with a beat grid,
lessons with video, a Today that says what to practise. Everything the app
does applies to it unchanged. What does _not_ apply is the content — a bachata
figure has nothing to do with a salsa figure, and seeing them in one list is
noise, not convenience.

So the app grows a **dance**: a hard wall through the content, with one
codebase, one deployment, one database and one login behind it. You pick a
dance and stay in it; the other one is invisible until you switch.

### Why not a second deployment

`bachata.anotherroot.eu` as its own unit and its own database was the opening
idea, and it was rejected for reasons that are all operational:

- The Hetzner box has 3.7 GB shared with four other services and a disk at
  ~80 %. A second node process, a second SQLite and a second backup set come
  out of that budget.
- Every feature would ship twice — same code, two `deploy.sh` runs, two
  migration paths, two chances to drift.
- The home worker leases one queue today. It would need to drain two.
- Two logins, or a session cookie scoped to `.anotherroot.eu` — which is also
  Firefly's, Grafana's, muscle's and nikaudio's domain. That cookie is the only
  thing between the open internet and this data; widening it to pay for a
  feature is a bad trade.
- **The count takes would have to be re-recorded.** `count_takes` is keyed on
  `(pattern, bpm, phrase)` and holds the user's own voice counting 1-2-3 /
  5-6-7. Bachata counts those same positions. One database shares them for
  free; two databases mean recording the whole ladder again.

The separation actually wanted is separation of _data_, and a `dance` column
provides it.

### Why not a subdomain onto the same process

Considered and rejected: sharing the login across `salsa.` and `bachata.`
requires the parent-domain cookie above, and two hostnames on one process
means dropping `ORIGIN` — which SvelteKit checks for CSRF — in favour of
trusting nginx's `PROTOCOL_HEADER` / `HOST_HEADER`. Both are solvable and
neither is free. The URL prefix delivers the thing that made subdomains
attractive (two home-screen icons) without either cost.

## The dance registry

`src/lib/dances/` — client-safe pure data, no `$lib/server` import. One entry
per dance, keyed by its URL slug.

```ts
export interface Dance {
	slug: string; // 'salsa' | 'bachata' — the URL segment
	label: string; // 'Salsa'
	styles: readonly string[]; // salsa: [salsa, son, other]
	// bachata: [dominican, sensual, traditional]
	styleLabel: Record<string, string>;
	countPatterns: readonly CountPattern[]; // which the player offers
	defaultCountPattern: CountPattern;
	clave: boolean; // salsa true, bachata false
	themeColor: string; // shell accent and manifest
}
```

A dance is added by adding an entry and deploying. There is no `dances` table
and no CRUD page: the per-dance behaviour is code-shaped — count positions,
clave positions, which pickers exist — so a row in a database could never carry
it, and a new row would only ever get generic defaults until the code caught up.

**Bachata needs no new clips and no new scheduler positions.** Its
1-2-3-tap / 5-6-7-tap is `COUNT_POSITIONS.salsa` exactly — `[1, 2, 3, 5, 6, 7]`.
What the registry does is _hide_ what does not apply: no clave toggle, no `son`
pattern in the picker. `CLAVE_POSITIONS` and `clave.m4a` stay as they are,
simply unreachable from bachata.

`PARTNER` (`partner` / `solo`) stays global — it applies to both dances.

## Data model

```
figures    + dance      text not null default 'salsa'
           + style_tag  text, nullable    -- the real style column
             style      VESTIGIAL, see below

songs      + dance      text not null default 'salsa'
exercises  + dance      text not null default 'salsa'
lessons    + dance      text not null default 'salsa'
```

**The default is the backfill.** Every row that exists today is salsa, and
`DEFAULT 'salsa'` on an added `NOT NULL` column gives it exactly that. No
separate `UPDATE` is needed for the `dance` columns.

**Nothing else carries the column.** `sets` derive their dance through
`exercise_id`, `recordings` through `figure_id`, `lesson_videos`,
`lesson_figures` and `lesson_exercises` through `lesson_id`. `count_takes` is
shared across dances on purpose. Denormalising `dance` onto `sets` would save
one join in the urgency query and cost an invariant that can drift.

### `figures.style` is vestigial, and cannot be otherwise

`figures` carries `figures_style_ck`: `style in ('salsa', 'son', 'other')`.
Bachata's styles do not pass it, so the CHECK would have to change — and
changing a CHECK means a table rebuild, which is unavailable here for **two
independent reasons**:

1. drizzle-kit's generated rebuild selects the new columns from the old table
   and fails at migrate time. Already recorded for `exercises_practice_ck`.
2. `recordings.figure_id` and `lesson_figures.figure_id` reference `figures`. A
   rebuild's `DROP TABLE figures` performs an implicit delete, `openDb` sets
   `foreign_keys = ON`, and drizzle's migrator runs inside a transaction — where
   `PRAGMA foreign_keys` is a documented no-op. There is no point at which the
   pragma can be turned off.

So `style` stays where it is, keeps its CHECK, and keeps receiving its
`'salsa'` default on every insert — which always passes, so it can never block
a bachata row. Nothing reads it after the backfill. `style_tag` is the real
column: plain text, no CHECK, validated against `DANCES[dance].styles` in
`figures.ts`. The schema gets a comment saying all of this, so the next reader
does not "clean up" a column whose removal is the trap.

`songs.style` needs no equivalent — it has no CHECK, so its set of values simply
widens.

### Invariants live in the data functions

Following the `exercises.lesson_id` precedent, not a CHECK:

- A figure's exercise is created, renamed and archived with its figure, and
  carries **its figure's dance**, in the same transaction (`figures.ts`).
- A lesson's review exercise carries **its lesson's dance** (`lessons.ts`).
- An exercise in practice mode `song` must point at a song of **its own dance**
  (`exercises.ts`).
- A row in `lesson_figures` must join a lesson and a figure of the same dance
  (`lessons.ts`).
- `figures.style_tag` must be a member of `DANCES[dance].styles`.

## Routing

Everything that belongs to a dance moves under `src/routes/[dance]/`:

```
src/routes/[dance]/+layout.server.ts   validates the slug against the registry,
                                       404s otherwise, puts the Dance in data
src/routes/[dance]/+page.*             Today
src/routes/[dance]/figures/…           figures/[id]/ too
src/routes/[dance]/songs/…             songs/[id]/ too
src/routes/[dance]/lessons/…           lessons/[id]/ too
src/routes/[dance]/player/…
```

Unchanged and flat, shared by both dances:

```
/login  /logout  /settings  /voice  /health
/api/*
/recordings/[file]  /audio/[file]  /count/[file]  /lesson-videos/[file]
```

The media routes are already id-scoped — a filename identifies its row — so a
prefix would be churn with no gain. `/voice` is shared deliberately: one set of
count takes, both dances.

**`POST /api/songs` takes `?dance=…`**, validated against the registry, because
it creates a row. The rest of `/api/*` is id-scoped and unaffected. The worker
API is untouched.

**`/` redirects to the last dance, remembered in a cookie**, not a column on
`users`. Per-device is the better behaviour, not a compromise: the work PC
parked on salsa while the phone is on bachata. With two home-screen icons, `/`
is rarely reached at all.

**The switcher** is a two-way toggle in the shell header — one tap on a phone,
not a trip to settings.

### Deny-by-default is untouched

`PUBLIC_PATHS` in `hooks.server.ts` is an exact-match `Set`, and every public
path stays flat. No predicate, no prefix matching, no new way to expose a page
by accident. This is why the manifests are served flat as
`/manifest-salsa.webmanifest` and `/manifest-bachata.webmanifest` rather than
under the prefix: four exact new entries in the `Set` instead of a pattern. A
manifest's own location need not sit inside its `scope`.

## The two home-screen icons

Each dance gets a manifest built from its registry entry:

```json
{
	"name": "Bachata practice",
	"short_name": "Bachata",
	"start_url": "/bachata/",
	"scope": "/bachata/",
	"theme_color": "<registry themeColor>"
}
```

Different names come free. Different _looks_ need per-dance PNGs, since iOS
will not take the SVG for a home-screen icon. `scripts/make-icons.sh` — a
committed one-off in the mould of `scripts/make-clips.sh` — tints `icon.svg`
with each dance's `themeColor` and rasterises 192 and 512. **Output is
committed; it never runs at build time.**

Per-dance PWA install behaviour is well-defined in Chrome/Android and looser on
iOS. It is verified on the real phone, not assumed. The worst case is two
bookmarks that open the right place with the same icon, which is still usable.

## What does not change

- `src/lib/urgency/` and `src/lib/day/` stay **pure and untouched**. Scoping
  happens in the data-access layer: exercises are filtered by dance before they
  reach the urgency function, which never learns that dances exist.
- `src/lib/scheduler/`, `src/lib/beatgrid/`, `src/lib/voice/`, `static/clips/`
  and `static/worklets/` — no changes.
- The home worker. It claims any song by `status`, dance-blind, and needs no
  code change, no config change and no redeploy.
- The player's random figure calls draw from callable figures **of the current
  dance**; that is a filter in the page load, not a scheduler change.

## Migration

One migration, additive only:

```sql
ALTER TABLE figures   ADD COLUMN dance TEXT NOT NULL DEFAULT 'salsa';
ALTER TABLE songs     ADD COLUMN dance TEXT NOT NULL DEFAULT 'salsa';
ALTER TABLE exercises ADD COLUMN dance TEXT NOT NULL DEFAULT 'salsa';
ALTER TABLE lessons   ADD COLUMN dance TEXT NOT NULL DEFAULT 'salsa';

ALTER TABLE figures   ADD COLUMN style_tag TEXT;
UPDATE figures SET style_tag = style;
```

**Read the generated SQL before committing it** — the standing rule, and here
it is load-bearing. drizzle-kit sometimes chooses a table rebuild even for an
added column when the table carries CHECKs, and all four of `figures`, `songs`,
`exercises` and `lessons` do. If it emits a rebuild for any of these, the migration file is
hand-edited down to plain `ALTER TABLE … ADD COLUMN` while drizzle's snapshot is
kept. That is the plan, not an improvisation.

**Snapshot before deploying it:**

```sh
ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'
```

## Testing

`npm run check` must pass. Beyond it:

- **A migration test.** Build a database at the pre-change migration with
  representative rows, run the new migrations, assert every row came out
  `dance = 'salsa'` and every figure's `style_tag` matches its old `style`.
  This is the one that protects the existing history.
- **The isolation guarantee, as its own test.** With both dances populated,
  Today for bachata never returns a salsa exercise. Likewise the figures list,
  the song list, the lessons list and the player's callable pool.
- **The registry**, as pure tests: an unknown slug 404s; `styles` validation
  rejects a bachata style on a salsa figure and vice versa.
- **Data functions** against `openDb(':memory:')`, the existing pattern, for
  each invariant listed above.
- **Manual:** both home-screen installs, on the real phone.

## Deliberately not included

- A `dances` table or a UI to create one. See the registry section.
- A cross-dance Today. Asked and declined: strictly one dance at a time.
- Son as a third top-level dance. It is a style inside salsa — the same song
  library, the same beat grid, a different count pattern.
- Moving a figure, song or lesson between dances. One column if it is ever
  wanted.
- A bachata-specific count pattern or accent on the tap. Its positions are
  salsa's; if the tap ever wants emphasis, that is a new clip and a new
  pattern, not a schema change.
