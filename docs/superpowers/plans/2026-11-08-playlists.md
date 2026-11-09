# Playlists Implementation Plan (plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A YouTube or Spotify playlist (or Spotify album) pasted in Music's Add a song box becomes a pick list, not a download: the home worker reads it, Music shows it under "To pick" with a dot on the Music tab, and the person ticks which songs to add (titles, artists and styles editable in place, option A2). Only the ticked songs are created and downloaded.

**Architecture:** One new table, `song_imports`, one row per pasted list, owned like a root row (a person or a group, exactly one), its items a JSON column written once by the worker. A third worker queue beside songs and videos (`/api/worker/imports/*`: claim, items, fail) with the songs' lease and attempts; the worker claims imports first and reads a YouTube list with `yt-dlp --flat-playlist`, a Spotify playlist or album from Spotify's public embed page (beside plan 1's `read_track`), at most 200 songs. Add creates the ticked songs through `createSongFromUrl`, one insert each, in the import's space, in one transaction. Nothing about an import is stored as unread: the Music dot is worked out per request in the `[dance]` layout beside `groupsNew`.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, vitest; the worker is Python 3 (stdlib + yt-dlp), tested with pytest through `nix build .#checks.x86_64-linux.worker`.

**Spec:** `docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md` ("A playlist", "Groups and group mode", "Song imports", "Import jobs", "The server"), with the mockups `docs/superpowers/specs/2026-11-08-spotify-mockups/screens.html` (screens 1 and 2) and `pick-list.html` (option **A2** only). Read both, and `CLAUDE.md`'s hard rules.

**Builds on plan 1** (`2026-11-08-spotify-songs.md`, same branch), which must be finished first: `classifyLink`, `songKeyOf` (`src/lib/songs/source.ts`), `resolveShortLink` (`src/lib/server/short-link.ts`), the `songs.audio_url` column (migration 0039), the words `t().songs.add.*` and `t().songs.source.*`, `BRAND` and `sourceOf` (`src/lib/songs/song-page.ts`; there is no `spotify` icon: plan 1 draws Spotify with `music` on a `bg-done-soft` tile and YouTube with `youtube`), and on the worker `spotify.py` (`read_track`), `match.py`, `media.search_youtube`, `Tools.pause`, and `process` returning `'ok' | 'permanent' | 'transient'` with `run` going on past a permanent failure. Do not redo any of it.

## Global Constraints

- Every instant is epoch ms; server code reads time through `serverNow()`. The new table's id is `mintedId('song_imports')` with a mark trigger, as migration 0038 does for every id table; `ids.spec.ts`'s `ID_TABLES` gains it.
- Migration 0040 creates one new table and its indexes, plus the trigger appended by hand. It touches no existing table and adds no CHECK (the status may grow later without a rebuild; the data functions keep the invariants). Read the generated SQL before committing.
- Nothing downloads until the person picks. A reading or ready import creates no `songs` row.
- The server runs no Python and never talks to YouTube or Spotify; it only follows a `spotify.link` redirect (plan 1).
- Owners: `user_id` or `team_id`, exactly one, set from `ownerValues(space)`; `ownerIntegrity` checks the table (`integrity.ts` `ROOTS`). A group's import is its editors' and owners' (`roleOf`): a member or a stranger gets the same 404 and no dot.
- Group mutations: Add logs one `add` line per song through `createSongFromUrl` (it already does). Creating, retrying and dismissing an import, and the worker's writes, change no content and are not logged, like `retrySong`; `changes.spec.ts` gets a test saying so, with the reason in its name.
- Words go through `t()`: new words in `src/lib/i18n/en/songs.ts` (`imports`, `pick`) and `shell.ts` (the tab's label), and in `sl/` (vikanje, plurals through `slCount`, the glossary in `sl/index.ts`). New components go in `TRANSLATED` (`src/lib/i18n/no-english.spec.ts`). `MusicList.svelte` stays untranslated; only its new words use `t()`.
- The pick list is a `use:guarded` form; one-tap row forms (Cancel, Retry, Dismiss on Music) use `use:enhance` and post to the list route by name (`action="/{dance}/songs?/dismissImport"`), and move focus with `focusAfterRemoval`. Dismiss on the pick list asks in a `Dialog`, never `confirm()`.
- Colours only through the builders (`button`, `rowButton`, `CHIP`, …); a new tick box class lives in `ui/styles.ts`.
- No `PAGE_EPOCH` raise: no form or API an older open page sends changes shape (`addUrl`'s fields are the same; the rest is new routes).
- Data functions take `db` first; specs use `openDb(':memory:')` and never touch `$DATA_DIR`.
- `npm run check` passes at the end of every task; the worker's suite through `nix build .#checks.x86_64-linux.worker`.

## Review Focus

1. **Nothing downloads by itself.** Pasting a list, the worker's read and a second paste of the same list create no song, and `claimJob` hands out nothing for them; only Add creates songs, exactly the ticked ones. Tests in Tasks 1 and 2.
2. **Add is one transaction in the import's space, once.** N picks make N songs with N distinct minted ids, each a `waiting_download` draft (`sharedAt` null) of the import's owner, N `add` lines in a group's History and none for a person; the import is marked added in the same transaction, and a second Add (a double tap, another tab) is refused with no new song. Add from Mine on a group's import files the songs in the group. Tests in Task 2.
3. **A group's import is its editors'.** A member, a person of the other dance and a stranger get a 404 on the pick list, its Add and Dismiss and the row actions, and no dot; an editor of the group gets the dot from Mine too. Tests in Tasks 5 and 7.
4. **The worker and the server deploy apart.** A new worker against an old server (404 on `imports/claim`) carries on with songs and videos; an item report after Cancel gets a 410, which the worker takes as done, not as a failure. Tests in Tasks 3 and 4.
5. **The 200 cap and bad data.** A list of 250 is cut at 200 on the worker with `truncated`, and the page says so; the server refuses a report of more than 200 items and drops items whose link is not a YouTube video or a Spotify track; picks naming an index out of range or twice are refused, and a style from the other dance falls back to Style for all. Tests in Tasks 1, 2 and 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/server/db/schema.ts`, `drizzle/0040_*.sql` | the `song_imports` table and its mark trigger |
| `src/lib/server/song-imports.ts` (new) | an import's life: create, the worker's claim, items and failure, retry, dismiss, lists, the dot, the pick items, Add |
| `src/lib/server/import-form.ts` (new) | reading the pick list's posted picks |
| `src/lib/server/scope.ts` | `requireImportAccess` |
| `src/lib/server/songs.ts` | `createSongFromUrl` takes an artist |
| `src/lib/server/integrity.ts` | `ROOTS` gains `song_imports` |
| `src/lib/types.ts` | `SongImportKind`, `SongImportRow`, `ImportItem`, `PickItem` |
| `src/routes/api/worker/imports/claim/+server.ts`, `[id]/items/+server.ts`, `[id]/fail/+server.ts` (new) | the import queue |
| `worker/salsa_worker/spotify.py`, `media.py`, `jobs.py`, `api.py`, `__main__.py` | reading lists, the queue, imports before songs |
| `src/routes/[dance]/songs/+page.server.ts`, `+layout.server.ts` | `addUrl` makes an import; `retryImport`, `dismissImport`; the imports in the list's data |
| `src/lib/songs/imports.ts` (new), `library.ts` | PURE: an import row's words; To pick and Being added counts |
| `src/lib/components/songs/ImportRow.svelte` (new), `MusicList.svelte`, `AddSongSheet.svelte` | Music's rows, the box's button |
| `src/routes/[dance]/+layout.server.ts`, `src/lib/nav/tabs.ts`, `components/shell/BottomNav.svelte`, `Side.svelte` | the Music dot |
| `src/routes/[dance]/songs/imports/[id]/+page.server.ts`, `+page.svelte` (new), `src/lib/nav/pane.ts` | the pick list page, in the Music pane |
| `src/lib/songs/pick-list.ts` (new), `components/songs/PickList.svelte`, `PickRow.svelte` (new), `ui/styles.ts` (`TICK`) | the pick list's model and screen |
| `scripts/shots/ext_playlists.py` (new), `pages.txt` | the screenshots |
| docs | main design spec, `CLAUDE.md` layout lines, `docs/deployment.md` |

---

### Task 1: The imports table and its life

**Files:**
- Modify: `src/lib/server/db/schema.ts` (after `songDrops`), `src/lib/types.ts`, `src/lib/server/db/ids.spec.ts` (`ID_TABLES`), `src/lib/server/integrity.ts` (`ROOTS`), `src/lib/server/integrity.spec.ts`
- Create: `drizzle/0040_<generated>.sql`, `src/lib/server/song-imports.ts`, `src/lib/server/song-imports.spec.ts`

**Interfaces:**
- Produces:
  - table `song_imports`: `id mintedId('song_imports')`, `userId text('user_id')`, `teamId integer('team_id').references(teams.id)`, `dance text notNull`, `url text notNull` (normalised: `https://open.spotify.com/<playlist|album>/<id>` or `https://www.youtube.com/playlist?list=<id>`), `kind text({ enum: ['youtube-playlist','spotify-playlist','spotify-album'] }) notNull`, `name text` (the list's own, from the worker), `status text({ enum: ['reading','ready','failed'] }) notNull`, `error`, `attempts notNull default 0`, `claimedAt`, `itemsJson text` (null until read), `truncated integer notNull default 0`, `createdAt createdAt()`, `addedAt`, `dismissedAt`. Indexes `song_imports_status_idx (status, created_at)`, `song_imports_user_idx (user_id, dance)`, `song_imports_team_idx (team_id, dance)`. Doc comments say the items are written once by the worker and nothing reads a row once `added_at` or `dismissed_at` is set (kept as bookkeeping; the second Add's refusal reads it).
  - `types.ts`: `SongImportKind`; `ImportItem = { title: string; artist: string | null; durationS: number | null; url: string }`; `PickItem = ImportItem & { i: number; already: boolean }`; `SongImportRow = { id: number; kind: SongImportKind; name: string | null; status: 'reading' | 'ready' | 'failed'; error: string | null; count: number; truncated: boolean; group: TeamRef | null }`.
  ```ts
  export const MAX_IMPORT_ITEMS = 200;
  export function createImport(db: Db, space: Space, input: { url: string; kind: SongImportKind }, now = serverNow()): SongImport
  export function getImport(db: Db, id: number): SongImport | null
  export function claimImportJob(db: Db, now: number): { id: number; url: string } | null
  export function storeImportItems(db: Db, id: number, input: { name: unknown; items: unknown; truncated: unknown }): 'stored' | 'gone' | 'bad'
  export function failImportJob(db: Db, id: number, error: string, permanent: boolean): void
  export function retryImport(db: Db, id: number): boolean
  export function dismissImport(db: Db, id: number, now = serverNow()): boolean
  export function listImports(db: Db, space: Space): SongImportRow[]
  export function groupImportsToPick(db: Db, userId: string, dance: DanceSlug): SongImportRow[]
  export function importsWaiting(db: Db, userId: string, dance: DanceSlug): boolean
  ```

- [ ] **Step 1: Failing specs** in `song-imports.spec.ts`:
  - `creates a reading import in the space and no song`: `createImport(db, U1_SALSA, …)` → `status 'reading'`, `userId 'u1'`, `teamId null`; in `T1_SALSA` → `teamId 1`, `userId null`; `songs` stays empty and `claimJob(db, T)` is `null` (Review Focus 1).
  - `claims the oldest reading import with the songs' lease`: two imports → the older first, `attempts 1`; claimed again within `LEASE_MS` → the other; after `LEASE_MS` → retaken; at `MAX_ATTEMPTS` with a stale lease → `failed` "Gave up after 5 attempts."; a dismissed import is never claimed.
  - `stores the items once, cleaned`: `storeImportItems(db, id, { name: 'Salsa clásica', items: [3 good, 1 with url 'https://vimeo.com/1', 1 with no title], truncated: true })` → `'stored'`, `status 'ready'`, `claimedAt null`, items the 3 good ones with titles and artists sliced to 200 and URLs normalised through `classifyLink` (`https://www.youtube.com/watch?v=<id>`, `https://open.spotify.com/track/<id>`), `truncated 1`. 201 items → `'bad'`, nothing written; `items` not an array → `'bad'`; a dismissed or already ready import → `'gone'`; every item dropped → `status 'failed'`, error "No songs found in this list." (Review Focus 5).
  - `fails, retries and dismisses like a song`: `failImportJob` transient keeps it reading with the error; permanent → `failed`; `retryImport` on failed → reading, `attempts 0`, error null; on ready → `false`. `dismissImport` on reading, ready or failed sets `dismissedAt`; twice → `false`.
  - `lists what Music shows`: `listImports(db, U1_SALSA)` holds the live imports (reading, ready, failed) newest first with `count` = items, never an added or dismissed one, never a group's; `listImports(db, T1_SALSA)` the group's.
  - `the dot: a ready import the person may pick`: `importsWaiting(db, 'u1', 'salsa')` false with none, false for reading or failed, true for a ready own one, false once dismissed; for a group's ready import true for its owner and an editor, false for a member (`joinTeam` as member), false for a deleted group and for `'bachata'`. `groupImportsToPick` returns the group's ready ones with `group: { id, name }` for the editor, `[]` for the member.
  - `integrity.spec.ts`: a `song_imports` row with both owners is reported by `ownerIntegrity`.
- [ ] **Step 2: Run, expect failure:** `npx vitest run src/lib/server/song-imports.spec.ts`.
- [ ] **Step 3: Implement.** Add the table; `npm run db:generate`; read the SQL (one `CREATE TABLE song_imports`, three `CREATE INDEX`, nothing touching another table); append `--> statement-breakpoint` and `CREATE TRIGGER song_imports_id_mark …` copied from 0038's pattern with the table name changed. Add `'song_imports'` to `ID_TABLES` and `ROOTS`. Reuse `LEASE_MS`, `MAX_ATTEMPTS` from `songs.ts`. Editors are `roleOf(...) in ('owner','editor')` of a team of this dance that is not deleted or purged; `groupImportsToPick` joins `team_members` and `teams` the way `groupChoices` does.
- [ ] **Step 4: Run, expect pass; `npm run check`** (`ids.spec.ts`'s trigger and mint scans included).
- [ ] **Step 5: Commit** `songs: song_imports, a pasted playlist read by the worker (migration 0040)`.

---

### Task 2: Add from a pick list

**Files:**
- Modify: `src/lib/server/song-imports.ts` (`pickItems`, `addFromImport`), `src/lib/server/songs.ts` (`createSongFromUrl`), `src/lib/server/changes.spec.ts` (`MUTATIONS`, the not-logged test)
- Create: `src/lib/server/import-form.ts`, `src/lib/server/import-form.spec.ts`
- Test: `src/lib/server/song-imports.spec.ts`

**Interfaces:**
- Consumes: `songKeyOf` (plan 1), `createSongFromUrl`.
- Produces:
  ```ts
  // songs.ts: input gains `artist?: string | null` (written as given; omitted = null)
  // song-imports.ts
  export type Pick = { i: number; title: string; artist: string | null; style: string };
  export function pickItems(db: Db, imp: SongImport): PickItem[]   // `already`: songKeyOf(item.url) is the key of a live song's sourceUrl or audioUrl in the import's space
  export function addFromImport(db: Db, space: Space, id: number, picks: Pick[], now = serverNow()):
    { ok: true; songIds: number[] } | { ok: false; reason: 'gone' | 'empty' }
  // import-form.ts
  export function readPicks(raw: string, items: ImportItem[], styles: readonly string[], styleForAll: string): Pick[] | null
  ```

- [ ] **Step 1: Failing specs.**
  - `song-imports.spec.ts`:
    - `marks a song already in the space by its link`: a ready import of three items, one a Spotify track whose `?si=…` form is a live song's `sourceUrl` in U1_SALSA, one a YouTube id equal to a song's `audioUrl` → those two `already: true`; the same songs in another person's space or archived → `false`.
    - `adds the picks as songs, once` (Review Focus 2): in `T1_SALSA`, three picks with edited titles, an artist and style `'son'` → `ok`, three distinct ids, each `status 'waiting_download'`, `teamId 1`, `sharedAt null`, `sourceUrl` the item's URL, title and artist as picked; `history` holds three `add` lines; the import has `addedAt`; a second `addFromImport` → `{ ok: false, reason: 'gone' }` and still three songs. Dismissed → `'gone'`; `picks: []` → `'empty'`.
    - `adds into the import's space, not the caller's mode`: a group import added with the space from `requireImportAccess` lands in the group even when the request came from Mine.
  - `import-form.spec.ts` (`readPicks`, items of 3, styles `['salsa','son','timba','other']`): a good JSON array → picks with titles trimmed and sliced to 200; an empty title → the item's title; an empty artist → null; style `'bachata'` → `styleForAll`; an index `3` or `-1`, a repeated index, non-JSON, a non-array → `null` (Review Focus 5).
  - `changes.spec.ts`: `MUTATIONS` gains `{ name: 'addFromImport', root: 'song', verb: 'add', rootId: () => 0, prep: one ready import of one item in the space, run: addFromImport with that one pick }`; and `it('logs nothing for an import itself: creating, the worker's read, retry and dismiss change no content')` runs them in `T1_SALSA` and expects `count()` 0.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** `addFromImport` is one `db.transaction`: re-read the import, refuse unless `ready` with `addedAt` and `dismissedAt` null, set `addedAt`, then `createSongFromUrl(tx, space, …)` per pick (each its own insert and its own `logChange`; drizzle nests the inner transaction as a savepoint). The space is the caller's argument; the caller passes the import's (Task 5).
- [ ] **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `songs: Add from a pick list makes the ticked songs, one insert each`.

---

### Task 3: The worker's import queue

**Files:**
- Create: `src/routes/api/worker/imports/claim/+server.ts`, `src/routes/api/worker/imports/[id]/items/+server.ts`, `src/routes/api/worker/imports/[id]/fail/+server.ts`, `src/routes/api/worker/imports/claim/server.spec.ts`

**Interfaces:**
- Consumes: `claimImportJob`, `storeImportItems`, `failImportJob` (Task 1).
- Produces: `POST /api/worker/imports/claim` → 200 `{ id, url }` or 204. `POST /api/worker/imports/[id]/items` with JSON `{ name, items: [{ title, artist, durationS, url }], truncated }` → 204 stored, 410 gone, 400 bad. `POST /api/worker/imports/[id]/fail` with `{ error, permanent }` → 204 (a gone import is ignored). The worker token is checked in `hooks.server.ts` for all of `/api/worker/`.

- [ ] **Step 1: Failing spec** (mock `$lib/server/db` as `videos/claim/server.spec.ts` does): claim hands out the import then 204; items stores and answers 204, the import is ready; items after `dismissImport` answers 410 (Review Focus 4); 201 items answer 400; fail with `permanent: true` fails it; a body that is not JSON is `'Unknown worker error'`, as the videos' fail route reads it.
- [ ] **Step 2: Run, expect failure.** **Step 3: Implement** the three routes like `videos/claim` and `videos/[id]/fail`. **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `worker api: the import queue (claim, items, fail)`.

---

### Task 4: The worker reads a list

**Files:**
- Modify: `worker/salsa_worker/spotify.py` (`read_list`), `worker/salsa_worker/media.py` (`read_youtube_list`), `worker/salsa_worker/jobs.py` (`ImportTools`, `process_import`, `run`), `worker/salsa_worker/api.py`, `worker/salsa_worker/__main__.py`
- Create: `worker/salsa_worker/lists.py`, `worker/tests/fixtures/spotify-embed-playlist.html`, `worker/tests/fixtures/spotify-embed-album.html`, `worker/tests/fixtures/yt-flat-playlist.json`
- Test: `worker/tests/test_spotify.py`, `test_media.py`, `test_jobs.py`, `test_api.py`

**Interfaces:**
- Produces (Python):
  ```python
  # lists.py
  MAX_ITEMS = 200
  @dataclass(frozen=True)
  class ListItem: title: str; artist: str | None; duration_s: float | None; url: str
  @dataclass(frozen=True)
  class TrackList: name: str | None; items: list[ListItem]; truncated: bool
  # spotify.py
  def is_spotify_list(url: str) -> bool
  def read_list(url: str, urlopen=urllib.request.urlopen) -> TrackList   # PermanentError: not a list, no such list, or the page has none
  # media.py
  def read_youtube_list(url: str, run=subprocess.run) -> TrackList
  # jobs.py
  @dataclass(frozen=True)
  class ImportTools: read_spotify: Callable[[str], TrackList]; read_youtube: Callable[[str], TrackList]
  def process_import(job: dict, api, tools: ImportTools, pause: Callable[[], None]) -> str   # 'ok' | 'permanent' | 'transient'
  def run(api, tools, video_tools=None, import_tools=None, max_jobs=20) -> int
  # api.py
  def claim_import(self) -> dict | None          # 204 and 404 are None (an older server has no queue)
  def report_import(self, job_id: int, lst: TrackList) -> None   # 410 raises JobGone
  def fail_import(self, job_id: int, error: str, permanent: bool) -> None
  ```

- [ ] **Step 1: Capture the fixtures.** From a fresh directory, `curl -sL -A 'Mozilla/5.0' https://open.spotify.com/embed/playlist/<a public salsa playlist id> > worker/tests/fixtures/spotify-embed-playlist.html`, and the same for `/embed/album/<id>`; they are data, never run. Check each holds `__NEXT_DATA__` with a track list (each entry a `spotify:track:` uri, a title, the artists, a duration in ms) and the list's name. Note whether the embed carries every track of a playlist longer than 100 or stops early; if it stops early and says the real total, `truncated` is that comparison, and the pick list's line reads the count it got. If Spotify serves no list there, stop and report, as plan 1's Step 1 does. Write `yt-flat-playlist.json` by hand in yt-dlp's shape: `{ "title": …, "entries": [{ "id", "url", "title", "duration", "channel" }] }`.
- [ ] **Step 2: Failing tests.**
  - `test_spotify.py`: `read_list` on the playlist fixture → its name, the first two items' titles, artists joined `", "`, `duration_s` = ms/1000, `url` `https://open.spotify.com/track/<id>` (read the values off the fixture once and pin them); the album fixture likewise; a page with no `__NEXT_DATA__` → `PermanentError`; an injected `urlopen` raising `HTTPError(404)` → `PermanentError`; a timeout → it propagates (transient). A track list of 250 (built in the test from the fixture's first entry) → 200 items, `truncated True` (Review Focus 5). `is_spotify_list` true for `/playlist/`, `/album/`, `/intl-de/album/`, false for a track.
  - `test_media.py`: `read_youtube_list` runs `yt-dlp --flat-playlist --dump-single-json --no-warnings --playlist-end 201 <url>`; maps the fixture to items with `artist None` and `url https://www.youtube.com/watch?v=<id>`; 201 entries → 200 and `truncated`; a stderr with "The playlist does not exist" or "This playlist is private" → `PermanentError`; another non-zero exit → `RuntimeError`.
  - `test_api.py`: `claim_import` → None on 204 and on 404; `report_import` posts `{name, items:[{title, artist, durationS, url}], truncated}`; a 410 raises `JobGone`; a 400 raises `PermanentError`.
  - `test_jobs.py`:
    - `process_import` on a Spotify list calls `read_spotify` and reports; on a YouTube list calls `read_youtube`, reports, then `pause()`; never `pause()` after Spotify.
    - `PermanentError` → `api.fail_import(id, msg, True)`, `'permanent'`; another exception → `fail_import(..., False)`, `'transient'`; `JobGone` on report → `'ok'` and no `fail_import` (Review Focus 4).
    - `run` claims imports before songs (a fake api records the order of claims); a transient import failure ends the run; a permanent one goes on; `import_tools=None` skips imports; an api whose `claim_import` returns None (an older server) still drains songs.
- [ ] **Step 3: Run, expect failure:** `nix build .#checks.x86_64-linux.worker -L 2>&1 | tail -30`.
- [ ] **Step 4: Implement.** Share plan 1's `__NEXT_DATA__` parsing as `_next_data(html) -> dict` in `spotify.py`; fetch `https://open.spotify.com/embed/<playlist|album>/<id>` with the same User-Agent and 20 s timeout. `__main__` wires `ImportTools(read_spotify=spotify.read_list, read_youtube=media.read_youtube_list)` and passes plan 1's `pause`.
- [ ] **Step 5: Run, expect pass.**
- [ ] **Step 6: Commit** `worker: read YouTube and Spotify lists, imports first`.

---

### Task 5: The box makes an import; the list route's actions

**Files:**
- Modify: `src/routes/[dance]/songs/+page.server.ts` (`addUrl`, new `retryImport`, `dismissImport`), `src/routes/[dance]/songs/+layout.server.ts` (`imports`), `src/lib/server/scope.ts` (`requireImportAccess`), the catalogs (`songs.imports` words for refusals; remove `songs.add.listsSoon` and `songs.add.helpOne` in en and sl, the box's help line becoming `songs.add.help`)
- Test: `src/routes/[dance]/songs/songs-forms.spec.ts`, `src/routes/[dance]/songs/group-songs.spec.ts`

**Interfaces:**
- Consumes: `classifyLink`, `resolveShortLink` (plan 1), Task 1's functions.
- Produces:
  ```ts
  // scope.ts: 404 'Not found' for a missing import, another dance, another person's, a group where
  // the person is not owner or editor, a deleted group, an added or dismissed import
  export function requireImportAccess(db: Db, locals: App.Locals, params: { dance: string }, id: number | string):
    { imp: SongImport; space: Space }
  ```
  The layout's data gains `imports: SongImportRow[]`: in group mode `listImports(db, teamSpace)`; otherwise `listImports(db, wall)` followed by `groupImportsToPick(db, userId, dance)` (a group's ready list shows in the editor's own Music too, named by its group, so the dot always has a row to open; reading and failed group imports show only in group mode).
  Words: `t().songs.imports.retryRefused` "Only a failed list can be read again.", `.gone` "This list was already added or dismissed."

- [ ] **Step 1: Failing specs.**
  - `songs-forms.spec.ts` (`addUrl`): a Spotify playlist link with `?si=` → `{ ok: true }`, one import (`kind 'spotify-playlist'`, the normalised URL), no song; an album → `'spotify-album'`; `https://music.youtube.com/playlist?list=PLx` → `'youtube-playlist'`; a `spotify.link` resolving to a playlist → an import of the resolved list; a typed Title is ignored for a list; an owner at the limit → 413 and no import; `spotify:playlist:<id>` and `spotify:album:<id>` URIs become their web link and an import (plan 1's `httpUrl` only turned tracks into web links: a review note). The old `listsSoon` case is replaced by these.
  - `songs-forms.spec.ts` (`retryImport`, `dismissImport`): a failed import → retried; a ready one → 409 with `retryRefused`; dismiss → `dismissedAt` set, the list's `imports` no longer holds it.
  - `group-songs.spec.ts`: in group mode `addUrl` files the import as the group's; the layout's `imports` in group mode is the group's; in Mine an editor sees the group's ready import (with `group`), a member does not; a member posting `dismissImport` with the group import's id gets a 404, and so does u2 on u1's import (Review Focus 3).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** In `addUrl`, after plan 1's short-link step, a `youtube-list` or `spotify-list` checks room as today and calls `createImport(db, space, { url: normalised, kind })`. `retryImport` and `dismissImport` read `id`, go through `requireImportAccess` (never `spaceOf`: a group's list is acted on from Mine too).
- [ ] **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `songs: a playlist link makes an import; retry and dismiss it`.

---

### Task 6: Music shows imports

**Files:**
- Create: `src/lib/songs/imports.ts`, `src/lib/songs/imports.spec.ts`, `src/lib/components/songs/ImportRow.svelte`
- Modify: `src/lib/songs/library.ts` (`libraryView`, `classLibraryView`), `src/lib/songs/library.spec.ts`, `src/lib/components/songs/MusicList.svelte`, `src/lib/components/songs/AddSongSheet.svelte`, the catalogs, `src/lib/i18n/no-english.spec.ts` (`TRANSLATED` += `ImportRow.svelte`)

**Interfaces:**
- Produces:
  ```ts
  // imports.ts (PURE, client-safe)
  export function sourceLine(kind: SongImportKind, count: number, truncated: boolean): string
    // "Spotify playlist · 32 songs", "Spotify album · 1 song", "YouTube playlist · 200 songs · the first 200"
  export function importRowView(row: SongImportRow): {
    title: string; meta: string; tone: 'danger' | null; action: 'pick' | 'cancel' | 'retry-dismiss' }
  export function importSections(rows: SongImportRow[]): { toPick: SongImportRow[]; adding: SongImportRow[] }
  // library.ts
  libraryView(songs, query, uploading, importsAdding = 0)   // the empty state is not empty while an import is there;
                                                           // "Being added · N" counts its rows, the import included
  ```
  Words (`t().songs.imports`): `toPick` "To pick", `reading` "Reading playlist…", `readingMeta(source)` "YouTube · the home PC reads it within a minute or two" (Spotify likewise), `pickSongs` "Pick songs", `cancel` "Cancel", `retry` "Retry", `dismiss` "Dismiss", `failed(error)` "Failed: <error>", the source names, `songs(n)`, `firstN(n)`; `t().songs.add.readList` "Read the playlist".

- [ ] **Step 1: Failing specs.**
  - `imports.spec.ts`: `sourceLine` for each kind, 1 and 32 songs, and truncated; `importRowView` of a reading YouTube import → title "Reading playlist…", meta the reading line, `action 'cancel'`; a ready one → its name (or "Spotify playlist" when null), the source line, plus "· <group>" when it has one, `action 'pick'`; a failed one → `tone 'danger'`, "Failed: …", `'retry-dismiss'`. `importSections` puts ready rows in `toPick` and reading and failed ones in `adding`.
  - `library.spec.ts`: `libraryView([], '', false, 1)` is a list, not empty, with "Being added · 1"; with two waiting songs and one import, "Being added · 3" (the mockup's count); the A–Z count is songs only.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** the PURE parts, then the screen to `screens.html` screen 2: in list mode (not while searching), **To pick · N** above Being added, each ready row an `ImportRow` linking to `/{dance}/songs/imports/{id}` (a Spotify or YouTube tile, the name, the source line, a "Pick songs" pill; lit when open beside the list); Being added starts with the reading and failed imports, then the upload and the songs. Cancel, Retry and Dismiss are one-tap `use:enhance` forms posting to `/{dance}/songs?/dismissImport` and `?/retryImport`, focus moving with `focusAfterRemoval`. The list's poll runs while a song waits **or an import reads**. `AddSongSheet`: a list link (`classifyLink`) makes the button "Read the playlist" and hides Title; plan 1's `listsSoon` line under the field goes, and the help line is `t().songs.add.help` again (plan 1 showed `helpOne`).
- [ ] **Step 4: Run** `npx vitest run src/lib/songs` and `npm run check` → pass.
- [ ] **Step 5: Commit** `music: To pick and a reading playlist in Music`.

---

### Task 7: The Music dot

**Files:**
- Modify: `src/routes/[dance]/+layout.server.ts`, `src/lib/nav/tabs.ts`, `src/lib/nav/tabs.spec.ts`, `src/lib/components/shell/BottomNav.svelte`, `src/lib/components/shell/Side.svelte`, `src/lib/i18n/en/shell.ts`, `src/lib/i18n/sl/shell.ts`
- Create: `src/routes/[dance]/songs/music-dot.spec.ts`

**Interfaces:**
- Produces: the `[dance]` layout's data gains `musicToPick: boolean` (`importsWaiting(db, locals.user.id, dance)`, beside `groupsNew`).
  ```ts
  // tabs.ts
  export function tabDot(id: TabId, data: { groupsNew?: boolean; musicToPick?: boolean }): boolean
  export function tabDotLabel(id: TabId, label: string): string   // groups: groupsTabLabel(true, label); music: t().shell.tabs.musicToPick(label)
  ```
  Word: `t().shell.tabs.musicToPick(label)` "Music, a playlist to pick".

- [ ] **Step 1: Failing specs.**
  - `music-dot.spec.ts` (mock `getDb` as `groups/whats-new.spec.ts` does, run the `[dance]` layout's `load`): no import → `musicToPick false`; a ready own import → true; after `addFromImport` or `dismissImport` → false; a reading one → false; a group's ready import → true for its editor, false for a member (Review Focus 3).
  - `tabs.spec.ts`: `tabDot('music', { musicToPick: true })` true, `tabDot('groups', { groupsNew: true })` true, any other pairing false; `tabDotLabel('music', 'Music')` is "Music, a playlist to pick".
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** BottomNav and Side replace their `tab.id === 'groups' && page.data.groupsNew` tests with `tabDot(tab.id, page.data)` and the label with `tabDotLabel`; the dot's look is unchanged. At Follow my class there is no Music tab, so nothing new draws.
- [ ] **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `nav: a dot on Music while a playlist waits to be picked`.

---

### Task 8: The pick list

**Files:**
- Create: `src/routes/[dance]/songs/imports/[id]/+page.server.ts`, `+page.svelte`, `src/routes/[dance]/songs/imports/[id]/pick-page.spec.ts`, `src/lib/songs/pick-list.ts`, `src/lib/songs/pick-list.spec.ts`, `src/lib/components/songs/PickList.svelte`, `src/lib/components/songs/PickRow.svelte`, `scripts/shots/ext_playlists.py`
- Modify: `src/lib/nav/pane.ts` (`ROUTES`), `src/lib/nav/pane.spec.ts`, `src/lib/components/ui/styles.ts` (`TICK`), the catalogs, `TRANSLATED` (+= `PickList.svelte`, `PickRow.svelte`), `scripts/shots/pages.txt`

**Interfaces:**
- Consumes: `requireImportAccess` (Task 5), `pickItems`, `addFromImport`, `dismissImport`, `readPicks` (Tasks 1–2).
- Produces:
  - `ROUTES['/[dance]/songs/imports/[id]'] = { list: 'songs', open: true }`: the page sits in the Music pane on the desktop.
  - The load: `{ imp: { id, kind, name, truncated }, items: PickItem[], styles }`; an import no longer ready (read, added, dismissed) → `redirect(303, '/{dance}/songs')`. Actions `add` (reads `picks` and `styleForAll`, `readPicks`, room checked once as `addUrl` does, `addFromImport(db, space, …)` with the import's space, then `redirect(303, '/{dance}/songs')`; refusals `fail(400 | 409 | 413, { message })`) and `dismiss` (then the same redirect).
  ```ts
  // pick-list.ts (PURE, client-safe)
  export type PickState = { ticked: Set<number>; edits: Map<number, { title: string; artist: string; style: string | null }>; styleForAll: string; open: number | null }
  export function initial(items: PickItem[], styles: readonly string[]): PickState   // nothing ticked, Style for all the dance's first style
  export function selectAll(items: PickItem[], s: PickState): Set<number>            // all not already added; again: none
  export function allState(items: PickItem[], s: PickState): 'all' | 'some' | 'none'
  export function styleOf(i: number, s: PickState): string                            // its own, else Style for all
  export function rowMeta(item: PickItem, s: PickState, styleLabel: Record<string, string>): string
    // "Grupo Niche · 5:11", "· Son" added when its style differs from Style for all; a YouTube item "5:11"
  export function originLine(kind: SongImportKind, item: PickItem): string           // "On Spotify: Que Locura Enamorarme De Ti · 4:58"
  export function picksOut(items: PickItem[], s: PickState): Pick[]                   // what the form posts, as JSON in `picks`
  ```
  Words (`t().songs.pick`): `styleForAll` "Style for all", `selectAll` "Select all", `picked(n, m)` "N of M picked", `already` "Already added", `onSource(kind)`, `add(n)` "Add N songs" / "Add 1 song", `dismiss` "Dismiss", `dismissTitle` "Dismiss this list?", `dismissBody` "Nothing from it is downloaded.", `edit(title)`, `done`, `open(kind)` "Open on Spotify" / "Open on YouTube", `unsaved` "A pick list", `firstN(n)`.

- [ ] **Step 1: Failing specs.**
  - `pick-list.spec.ts`: `initial` ticks nothing (the user's "the default is no"); `selectAll` ticks every item but the already added and a second call clears them; `allState` all/some/none; a song given `'son'` keeps it when `styleForAll` changes to `'timba'`, and one without its own follows; `rowMeta` adds "· Son" only when it differs; a YouTube item's meta is its length alone; `picksOut` sends only ticked items, each with its edited title, artist and `styleOf`.
  - `pick-page.spec.ts` (mock `getDb`): the load lists the items with `already`; a member of the group gets a 404 (Review Focus 3); an added import redirects to Music; `add` with two picks makes two songs and redirects; `add` with a malformed `picks` → 400; `add` at the storage limit → 413, no song; `dismiss` redirects and the import is dismissed.
  - `pane.spec.ts`: `listOf('/[dance]/songs/imports/[id]')` is `{ list: 'songs', open: true }`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** to `pick-list.html` option **A2**: `<Screen compact width="song">` with `BackButton` (fallback Music), the list's name and `sourceLine` as the band's title and subtitle. A `use:guarded` form (label `t().songs.pick.unsaved`) holding hidden `picks` (`JSON.stringify(picksOut(…))`) and `styleForAll`: the Style for all chips; Select all as a `TICK` checkbox with `indeterminate` when some, and "N of M picked"; a `PickRow` per item in a `GROUP` card. A row: tick box, title, the grey `rowMeta`, a pencil (`iconButton`) and ↗ (`target="_blank" rel="external noopener noreferrer"` — `external` is what the lint rule `svelte/no-navigation-without-resolve` takes — labelled "Open on Spotify"). The pencil turns the row into the form in place: title and artist fields without labels or a box (`aria-label`s), that song's style chips, and the `originLine`; ✓ closes it; one row open at a time. An already added row shows the "Already added" pill and ↗, no pencil, its tick box unticked but tickable. A `BottomBar` pinned at the bottom (`claimBottom`, so the tab bar steps aside) with Dismiss (`rowButton('secondary')`, the tonal look, opens a `Dialog` whose Dismiss posts `?/dismiss` with `use:enhance`) and Add N songs (`rowButton('primary')`, disabled at 0). `TICK` in `ui/styles.ts` is the accent-coloured box, covered by `styles.spec.ts`.
- [ ] **Step 4: Run** `npx vitest run src/lib/songs src/lib/nav 'src/routes/[dance]/songs'` and `npm run check` → pass (`bands.spec.ts` sees the `Screen`).
- [ ] **Step 5: Screenshots.** On a copy of the latest `~/Backups/salsa/db/` backup (never `.data`), insert one ready and one reading import for the admin with `sqlite3` (explicit ids, `items_json` from the playlist fixture, one item's URL equal to an existing song's so "Already added" shows). `ext_playlists.py` gives the placeholder `import` (the admin's first ready import) and the scenes `pick-edit` (the second row's pencil) and `pick-dismiss` (the Dialog). Add `/{dance}/songs/imports/{import}` to `pages.txt`. Shoot `/{dance}/songs`, the pick list and both scenes at 390×844 light and dark, and at 1440×900 `--viewport` (the pane beside the list), per `scripts/shots/README.md`; compare with `screens.html` screen 2 and `pick-list.html` A2, fix what differs, and send the shots to the user. Never commit the db or the shots.
- [ ] **Step 6: Commit** `music: the pick list (A2)`.

---

### Task 9: Docs and the order of deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` ("Songs & player": a playlist link, To pick, the dot, the pick list, group imports), `CLAUDE.md` (the "Live:" line gains "and playlists (a YouTube or Spotify list is read by the home worker into a pick list…)"; layout lines for `src/lib/server/song-imports.ts`, `import-form.ts`, `src/lib/songs/imports.ts`, `pick-list.ts`, `src/routes/[dance]/songs/imports/[id]`, `worker/salsa_worker/lists.py`; the hard rule on hard deletes needs nothing, as imports are kept), `docs/deployment.md` ("Home worker": the third queue, imports first, the 200 cap, Spotify's embed page for lists), the spec (mark plan 2 built, and record the calls made while planning: Select all skips the already added, a group's ready list shows in an editor's own Music, the reading row counts in "Being added · N", finished imports are kept)

- [ ] **Step 1:** Write the docs. The deploy order: the server first (`./scripts/deploy.sh`; migration 0040 applies at boot), then the worker. An old worker leaves imports reading until it is updated (Cancel works meanwhile); a new worker against an old server reads a 404 on `imports/claim` as none.
- [ ] **Step 2:** `npm run check` and `nix build .#checks.x86_64-linux.worker` → pass.
- [ ] **Step 3: Commit** `docs: playlists`.

---

## Self-review against the spec

- **Pasting:** list kinds (YouTube playlist, YouTube Music playlist, Spotify playlist and album, a `spotify.link` landing on one) become an import (Task 5); the button says "Read the playlist" and Title hides (Task 6); storage is checked as for a song (Task 5) and once for Add (Task 8).
- **Music:** "Reading playlist…" with its line and Cancel in Being added; To pick above it with the name, "Spotify playlist · N songs" and Pick songs; a failed read with its error, Retry and Dismiss (Tasks 5–6). The dot on the phone's tab bar and the desktop's side, derived per request, never stored (Task 7); it goes after Add or Dismiss (Task 7's spec).
- **The pick list (A2):** band with back, name and source; Style for all (default the dance's first, a song's own kept); Select all three states and "N of M picked"; one-line rows with artist · length (· style when it differs), pencil, ↗; the pencil's in-place fields, chips and "On Spotify: …" line, ✓, one open at a time; Already added by link, unticked, tickable, no pencil; nothing ticked at first; pinned Dismiss (asks) and Add N; `use:guarded`; the desktop pane (Task 8).
- **Data and worker:** owner, dance, URL, name, status, error, attempts, `claimed_at`, created, added and dismissed; items as JSON; `mintedId` and its trigger; no CHECK (Task 1). Claim, items and fail with the songs' lease and permanent errors; imports before songs; `--flat-playlist`; Spotify's embed page; 200 and "the first 200"; older server and older worker both handled (Tasks 3–4). Pacing between YouTube calls is plan 1's `pause`, also after a YouTube list read (Task 4).
- **Groups and levels:** a list pasted in group mode is the group's, its songs the group's drafts, logged one `add` each; editors see it and get the dot, members do not (Tasks 2, 5, 7). Follow my class has no Music tab, so nothing draws (Task 7).
- **Logging, words, epoch:** imports themselves are not logged, tested with the reason (Task 2); every word in both catalogs with the new components in `TRANSLATED` (Tasks 6–8); no `PAGE_EPOCH` raise, said in Global Constraints with why.
- Gaps found and fixed while writing: Cancel and Dismiss were one action (`dismissImport`) rather than two; a group's ready list had no row in Mine for its dot to point at, so `groupImportsToPick` adds it to the editor's own To pick (Task 5); the worker's read after a Cancel would have failed the import, so the items route answers 410 and the worker takes it as done (Tasks 3–4); the Music poll now also runs while a list is read (Task 6), since a ready list would otherwise appear only on the next navigation.
