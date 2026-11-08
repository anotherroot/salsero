# Spotify songs Implementation Plan (plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Spotify song link in Music's Add a song box becomes a song (the home worker finds it on YouTube), every downloaded song shows where its audio came from, and a wrong audio is fixed with "Use another YouTube link", which reaches the copies kept in step.

**Architecture:** A PURE link classifier decides what a pasted link is. Three additive song columns hold the person's audio link (`audio_url`), and what the worker actually downloaded (`fetched_url`, `fetched_title`). The worker reads a Spotify track's name, artist and length from Spotify's public embed page, searches YouTube with yt-dlp, scores the results and downloads the best. Swapping audio is an ordinary song edit, so Keep in step's flow carries it through a new flat key `audio`; the count and sample stop comparing across copies whose audio differs. Playlists are plan 2 (`2026-11-08-playlists.md`); until then a playlist link is refused with a sentence.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle on SQLite, vitest; the worker is Python 3 (stdlib + yt-dlp), tested with pytest through `nix build .#checks.x86_64-linux.worker`.

**Spec:** `docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md`, with its mockups in `docs/superpowers/specs/2026-11-08-spotify-mockups/screens.html` (screens 1, 4, 5, 6 are this plan's). Read both, and `CLAUDE.md`'s hard rules.

## Global Constraints

- Every instant is epoch ms; server code reads time through `serverNow()`; every insert mints its id (`mintedId`). No new table in this plan.
- Migration: additive `ALTER TABLE songs ADD COLUMN` only, never a CHECK; read the generated SQL before committing.
- The server runs no Python and never talks to YouTube. Spotify and YouTube are read on the worker. The only outbound request the server makes is following a `spotify.link` redirect (headers only, one hop, 5 s timeout).
- Words go through `t()`: every new word in `src/lib/i18n/en/songs.ts` and `src/lib/i18n/sl/songs.ts` (vikanje, the glossary in `sl/index.ts`). A new component goes in `TRANSLATED` (`src/lib/i18n/no-english.spec.ts`). Existing untranslated song screens keep their old English; only their new words use `t()`.
- A form someone fills in uses `use:guarded`; one-tap forms `use:enhance`. No browser `confirm()`: the question is a `Dialog`.
- Colours only through the builders (`button`, `iconButton`, `FIELD`…), never appended classes.
- Data functions take `db` first; specs use `openDb(':memory:')` and never touch `$DATA_DIR`.
- The worker and server deploy separately: a new server must accept an old worker's upload (no new headers), and a new worker must work against the current server until this plan's server side is deployed (it is deployed first; see Task 8).
- `npm run check` must pass at the end of every task; the worker's suite passes through `nix build .#checks.x86_64-linux.worker`.

## Review Focus

1. **A Spotify link with tracking parameters** (`?si=…&utm_source=copy-link`, `/intl-de/track/…`, `spotify:track:…`) must classify as that track and download, as the real failed song (id 16 in the 6 Nov backup) does. Test in Task 1.
2. **No YouTube result within the length window** must still download the best one, and **no result at all** must fail for good with "No match on YouTube" and leave the song retryable. Tests in Task 3.
3. **An old worker's upload** (no `x-fetched-url`, no `x-artist`) after this deploy must still land the audio and leave the new columns null; the page then shows "From YouTube ↗" only for YouTube songs, and nothing broken for a Spotify song. Test in Task 4.
4. **Swapping audio on a song with copies not kept in step** must not change those copies, and their Sync must not offer the count afterwards; a copy kept in step re-downloads and loses its 1s. Tests in Task 6.
5. **Swapping while the song is still waiting** (status `waiting_download` or `waiting_analysis`) is refused with a sentence, so a worker mid-job never lands audio from the old link over the new one. Test in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/songs/source.ts` (new) | PURE: what a pasted link is (`classifyLink`), the song key for "same song" (`songKeyOf`), YouTube/Spotify link checks. Client-safe |
| `src/lib/server/short-link.ts` (new) | Follow a `spotify.link` redirect, fetch injected |
| `src/lib/server/db/schema.ts`, `drizzle/0039_*.sql` | `songs.audio_url`, `fetched_url`, `fetched_title` |
| `src/lib/server/songs.ts` | claim returns the audio link; `storeFetchedAudio` takes the new fields and may replace a file; `useAudioUrl` |
| `src/routes/api/worker/songs/[id]/audio/+server.ts` | reads `x-fetched-url`, `x-fetched-title`, `x-artist`; unlinks a replaced file |
| `src/lib/server/clones/clone.ts`, `trees.ts`, `apply.ts`, `src/lib/clones/flat.ts`, `diff.ts`, `merge.ts` | the `audio` key; count and sample bound to it |
| `src/routes/[dance]/songs/+page.server.ts` | `addUrl` classifies |
| `src/routes/[dance]/songs/[id]/+page.server.ts` | `audio` action; `seen` covers `audioUrl` |
| `src/lib/server/clash.ts` | `songSeen` adds `audioUrl` |
| `src/lib/songs/song-page.ts`, `library.ts` | steps and list meta for a Spotify song; the source rows |
| `src/lib/components/songs/AddSongSheet.svelte`, `SongDetailsSheet.svelte`, `AudioFrom.svelte` (new), `AudioSwap.svelte` (new), `src/routes/[dance]/songs/[id]/+page.svelte` | the screens |
| `worker/salsa_worker/spotify.py` (new), `match.py` (new), `media.py`, `jobs.py`, `api.py` | reading Spotify, searching and scoring YouTube, pacing |
| docs | main design spec's Songs section, `CLAUDE.md` layout lines, `docs/deployment.md` worker notes |

---

### Task 1: The link classifier

**Files:**
- Create: `src/lib/songs/source.ts`, `src/lib/songs/source.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LinkKind =
    | { kind: 'youtube-video'; id: string }
    | { kind: 'youtube-list'; id: string }
    | { kind: 'spotify-track'; id: string }
    | { kind: 'spotify-list'; id: string; list: 'playlist' | 'album' }
    | { kind: 'spotify-short' }
    | { kind: 'spotify-other' }
    | { kind: 'other' };
  export function classifyLink(url: string): LinkKind;
  /** 'yt:<id>' | 'sp:<id>' | null — two songs with the same key are the same song. */
  export function songKeyOf(url: string | null): string | null;
  export function isYouTubeVideo(url: string): boolean;
  ```

- [ ] **Step 1: Write the failing spec** `source.spec.ts`, a table of `[url, expected]` through `classifyLink`:
  - `https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO?si=7ijevtD4QBSS07u37hj8kw&utm_source=copy-link` → `{ kind: 'spotify-track', id: '0wDEs6WvqDHq4XJZC0dHhO' }`
  - `https://open.spotify.com/intl-de/track/0wDEs6WvqDHq4XJZC0dHhO` and `spotify:track:0wDEs6WvqDHq4XJZC0dHhO` → the same
  - `https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W?si=x` → `{ kind: 'spotify-list', id: '37i9dQZF1DX4OzrY981I1W', list: 'playlist' }`; `/album/…` → `list: 'album'`
  - `https://spotify.link/AbCdE` → `{ kind: 'spotify-short' }`; `https://open.spotify.com/episode/x` and `/artist/x` and `/show/x` → `{ kind: 'spotify-other' }`
  - `https://m.youtube.com/watch?v=QH0zo6AcP6g&list=PLo1L&index=4` → `{ kind: 'youtube-video', id: 'QH0zo6AcP6g' }` (a watch link with a list stays one song)
  - `https://youtu.be/Fd8nEwF3hHk?t=3`, `https://www.youtube.com/shorts/Fd8nEwF3hHk`, `https://music.youtube.com/watch?v=Fd8nEwF3hHk` → `youtube-video` with that id
  - `https://www.youtube.com/playlist?list=PLo1L1g` and `https://music.youtube.com/playlist?list=PLo1L1g` → `{ kind: 'youtube-list', id: 'PLo1L1g' }`
  - `https://vimeo.com/1`, `not a url` → `{ kind: 'other' }`
  - `songKeyOf` of the YouTube variants above → `'yt:Fd8nEwF3hHk'`; of the Spotify track variants → `'sp:0wDEs6WvqDHq4XJZC0dHhO'`; of `null`, a list or `other` → `null`.
  - `isYouTubeVideo` true only for `youtube-video`.

- [ ] **Step 2: Run, expect failure:** `npx vitest run src/lib/songs/source.spec.ts` → fails, module missing.
- [ ] **Step 3: Implement** with `new URL()` in a try (a throw is `other`); hosts compared lower-case without `www.`/`m.`; `spotify:` URIs split on `:`.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** `songs: classify a pasted link (YouTube, Spotify, lists)`.

---

### Task 2: The columns, the claim and the store

**Files:**
- Modify: `src/lib/server/db/schema.ts` (songs, after `sourceUrl`), `src/lib/types.ts` (`SongItem`), `src/lib/server/songs.ts` (`claimJob`, `storeFetchedAudio`, `songItem`), `src/lib/server/clones/clone.ts` (`copySong`)
- Create: `drizzle/0039_<generated>.sql` (via `npm run db:generate`)
- Test: `src/lib/server/songs.spec.ts` (extend), `src/lib/server/clones/clone.spec.ts` (extend the song case)

**Interfaces:**
- Produces:
  - columns `audioUrl: text('audio_url')` ("the person's link for the audio, set by Use another YouTube link; null = `source_url`"), `fetchedUrl: text('fetched_url')`, `fetchedTitle: text('fetched_title')` (both "what the worker downloaded, reported with the audio").
  - `SongItem` gains `audioUrl`, `fetchedUrl`, `fetchedTitle: string | null`.
  - `claimJob` → `Job.url = song.audioUrl ?? song.sourceUrl` for a download.
  - `storeFetchedAudio(db, id, input: { file; mime; title: string | null; artist?: string | null; fetchedUrl?: string | null; fetchedTitle?: string | null; durationS; sizeBytes? }): { ok: true; replaced: string | null } | { ok: false }` — `replaced` is the song's previous `audio_file` when it had one (a swap), for the route to unlink.

- [ ] **Step 1: Failing specs** in `songs.spec.ts`:
  - `claim hands out the audio link before the source`: a song with `sourceUrl` S and `audioUrl` A, `waiting_download` → `claimJob(...).url === A`; with `audioUrl` null → S.
  - `storeFetchedAudio fills the artist only when empty and records what was fetched`: artist `null` + input artist `'Grupo Niche'` → `'Grupo Niche'`; artist `'Mine'` stays; `fetchedUrl`, `fetchedTitle` written; title rule unchanged (only when empty).
  - `storeFetchedAudio replaces a swapped song's file`: a song with `audioFile 'old.m4a'`, status `waiting_download` → returns `{ ok: true, replaced: 'old.m4a' }` and the row holds the new file; a fresh song → `replaced: null`; status `ready` → `{ ok: false }`.
  - `storeFetchedAudio without the new fields leaves them null` (an old worker).
  - In `clone.spec.ts`'s song copy case: the copy carries `audioUrl`, `fetchedUrl`, `fetchedTitle`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** Add the columns; `npm run db:generate`; read the SQL: three `ALTER TABLE songs ADD COLUMN`, nothing else. Update the callers of `storeFetchedAudio` to the new return shape (the route: `if (!stored.ok)`). `songItem` maps the three fields.
- [ ] **Step 4: Run** `npx vitest run src/lib/server/songs.spec.ts src/lib/server/clones/clone.spec.ts` and `npm run check` → pass (the `ids.spec.ts` and schema specs included).
- [ ] **Step 5: Commit** `songs: audio_url, fetched_url, fetched_title (migration 0039)`.

---

### Task 3: The worker finds a Spotify song on YouTube

**Files:**
- Create: `worker/salsa_worker/spotify.py`, `worker/salsa_worker/match.py`, `worker/tests/test_spotify.py`, `worker/tests/test_match.py`, `worker/tests/fixtures/spotify-embed-track.html`
- Modify: `worker/salsa_worker/media.py` (`search_youtube`), `worker/salsa_worker/jobs.py` (`Tools`, `process`, `run`), `worker/salsa_worker/api.py` (`upload_audio`), `worker/salsa_worker/__main__.py`, `worker/tests/test_jobs.py`, `worker/tests/test_media.py`

**Interfaces:**
- Produces (Python):
  ```python
  # spotify.py
  @dataclass(frozen=True)
  class Track: title: str; artists: list[str]; duration_s: float | None; url: str
  def is_spotify_track(url: str) -> bool
  def read_track(url: str, urlopen=urllib.request.urlopen) -> Track   # PermanentError when it is not a track or the page has none
  # match.py
  @dataclass(frozen=True)
  class Candidate: url: str; title: str; channel: str; duration_s: float | None
  def score(track: Track, c: Candidate) -> float
  def best(track: Track, cands: list[Candidate]) -> Candidate | None   # None only when cands is empty
  # media.py
  def search_youtube(query: str, n: int = 8, run=subprocess.run) -> list[Candidate]
  # Fetched gains: url: str (what was downloaded)
  # jobs.Tools gains: search: Callable[[str], list[Candidate]], read_track: Callable[[str], Track], pause: Callable[[], None]
  # api.Api.upload_audio(song_id, path, mime, title, duration, *, artist=None, fetched_url=None, fetched_title=None)
  #   sends x-artist, x-fetched-url, x-fetched-title (each urllib.parse.quote'd), only when set
  ```

- [ ] **Step 1: Capture the fixture.** `curl -sL -A 'Mozilla/5.0' https://open.spotify.com/embed/track/0wDEs6WvqDHq4XJZC0dHhO > worker/tests/fixtures/spotify-embed-track.html` (from `worker/`, a fresh directory; it is data, never executed). Check it holds a `<script id="__NEXT_DATA__" type="application/json">`. If Spotify no longer serves that, stop and report: the spec's fallback is Spotify's Web API with credentials on the worker only, which needs the user.
- [ ] **Step 2: Failing tests.**
  - `test_spotify.py`: `read_track` with an injected `urlopen` returning the fixture → `Track(title=<the real title in the fixture>, artists=[…], duration_s≈<ms/1000>)`; read the expected values off the fixture once and pin them. A page with no `__NEXT_DATA__` → `PermanentError`. `is_spotify_track` true for the three track forms of Task 1, false for a playlist.
  - `test_match.py` (fixed candidate lists, no network): for a track "Cali Pachanguero" by "Grupo Niche", 312 s:
    - a "Grupo Niche - Topic" channel at 313 s beats an "Official Video" at 330 s and a "(En Vivo)" at 311 s;
    - "Cali Pachanguero (Cover)" at 312 s loses to "Cali Pachanguero" at 318 s;
    - a track whose own title holds "Remix" does not penalise "Remix" in a candidate;
    - nothing within 15 s → `best` still returns the highest score, not None;
    - `best(track, []) is None`.
    Scoring (pin these weights in `match.py` as constants): length within 3 s +40, within 15 s +25, beyond 15 s −30 (unknown length 0); channel ending " - Topic" +20; title containing "official audio" or "audio" +8; each of `live, en vivo, cover, karaoke, remix, slowed, sped up, 8d, instrumental, lyrics` in the candidate's title but not the track's −25 (case and accents folded); the track's title words found in the candidate's title +2 each; the first artist found in title or channel +10.
  - `test_media.py`: `search_youtube` runs `yt-dlp --flat-playlist --dump-single-json --no-warnings "ytsearch8:<query>"` and maps `entries[].{url|webpage_url, title, channel|uploader, duration}`; a non-zero exit is a `RuntimeError` (transient).
  - `test_jobs.py`:
    - `process` on a job whose url is a Spotify track: calls `read_track`, searches `"<artist> <title>"`, fetches the best candidate's url, uploads with `title=track.title`, `artist=', '.join(track.artists)`, `fetched_url=<candidate url>`, `fetched_title=<the downloaded title>`.
    - an empty search → `api.fail(id, "No match on YouTube", True)`.
    - a YouTube job uploads with `fetched_url` = the job url and `fetched_title` = the downloaded title, `artist=None`.
    - `run`: a permanent failure no longer stops the run (the next job is claimed); a transient one still does; `pause` is called after every job that searched or downloaded from YouTube (pacing), never after an analysis-only job.
- [ ] **Step 3: Run, expect failure:** `nix build .#checks.x86_64-linux.worker -L 2>&1 | tail -30`.
- [ ] **Step 4: Implement.** `read_track`: GET `https://open.spotify.com/embed/track/<id>` with a browser-like User-Agent and a 20 s timeout; parse `__NEXT_DATA__` as JSON; find the entity by walking for the object whose `type` is `"track"` (the fixture shows the path; prefer that exact path with the walk as fallback). `process` returns `True`/`False` as today, plus `run` needs to tell permanent from transient: make `process` return `'ok' | 'permanent' | 'transient'` and update `run` and its tests. `pause` in `__main__` is `lambda: time.sleep(4)`. The `Fetched.url` for a plain YouTube job is the job url.
- [ ] **Step 5: Run, expect pass.**
- [ ] **Step 6: Commit** `worker: a Spotify song is found on YouTube; permanent failures no longer stop a run; a pause between YouTube jobs`.

---

### Task 4: The server takes what the worker found

**Files:**
- Modify: `src/routes/api/worker/songs/[id]/audio/+server.ts`
- Test: its spec beside it (create `audio.spec.ts` if none exists; mock `$lib/server/db` with `openDb(':memory:')` as `src/routes/[dance]/dance-wall.spec.ts` does, and point `audioDir()` at a temp dir through the same mock pattern the existing worker route specs use — find them with `grep -rl "api/worker" src --include=*.spec.ts`)

**Interfaces:**
- Consumes: `storeFetchedAudio` (Task 2).

- [ ] **Step 1: Failing spec:** a PUT with `x-artist: Grupo%20Niche`, `x-fetched-url`, `x-fetched-title` lands them (decoded with `safeDecodeHeader`, each sliced to 200 / 2000 / 200 chars); a PUT with none of them lands the audio and leaves them null (Review Focus 3); a PUT on a swapped song (had `old.m4a`) unlinks `old.m4a` after the store and keeps the new file.
- [ ] **Step 2: Run, expect failure.** **Step 3: Implement.** Unlink the replaced file only after `storeFetchedAudio` succeeded, ignoring a missing file. **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `worker api: the artist and the fetched video land with the audio`.

---

### Task 5: Adding a link, and swapping a song's audio

**Files:**
- Create: `src/lib/server/short-link.ts`, `src/lib/server/short-link.spec.ts`
- Modify: `src/routes/[dance]/songs/+page.server.ts` (`addUrl`), `src/lib/server/songs.ts` (`useAudioUrl`), `src/lib/server/clash.ts` (`songSeen`), `src/routes/[dance]/songs/[id]/+page.server.ts` (`audio` action, `songSeen` call sites), `src/lib/i18n/en/songs.ts`, `src/lib/i18n/sl/songs.ts`
- Test: `src/routes/[dance]/songs/songs-forms.spec.ts` (extend), `src/lib/server/songs.spec.ts` (extend), the song page's form spec (find with `grep -l "resetAnchors" src/routes -r --include=*.spec.ts`)

**Interfaces:**
- Consumes: `classifyLink`, `isYouTubeVideo` (Task 1).
- Produces:
  ```ts
  // short-link.ts
  export async function resolveShortLink(url: string, fetchFn: typeof fetch = fetch): Promise<string | null>
  // songs.ts
  export function useAudioUrl(db: Db, id: number, url: string, space?: Space, now = serverNow()):
    { ok: true; song: Song } | { ok: false; reason: 'busy' | 'upload' | 'missing' }
  ```
  The words (en; sl in vikanje): `t().songs.add.label` "YouTube or Spotify link", `.help` "A song, a playlist or an album. From a playlist you pick which songs to add.", `.notSong` "Paste a song, playlist or album", `.listsSoon` "Playlists come in the next update. Paste one song's link for now.", `.shortFailed` "Paste the full open.spotify.com link". `t().songs.audio.notYouTube` "Paste a YouTube video link", `.busy` "Wait until this song has finished downloading.", `.upload` "An uploaded song has no link to change."

- [ ] **Step 1: Failing specs.**
  - `short-link.spec.ts`: an injected fetch answering 301 with `location: https://open.spotify.com/track/X?si=1` → that URL; called with `{ method: 'HEAD', redirect: 'manual', signal }` (a 5 s abort); a 200, a thrown fetch, or a location off `open.spotify.com` → `null`.
  - `songs-forms.spec.ts` (`addUrl`): a Spotify track link creates a `waiting_download` song with `sourceUrl` the pasted link; `spotify-other` → `fail(400)` with `field: 'url'` and `notSong`; a list (either kind) → `fail(400)` with `listsSoon`; `spotify-short` resolving to a track → a song with `sourceUrl` the resolved link; resolving to `null` → `shortFailed`. Mock `resolveShortLink` with `vi.mock('$lib/server/short-link')`.
  - `songs.spec.ts` (`useAudioUrl`): a ready song → `audioUrl` set, `status 'waiting_download'`, `anchorsJson '[]'`, `sampleStartS null`, `attempts 0`, `error null`, `claimedAt null`, `audioFile` kept; a failed song too; `waiting_download`/`waiting_analysis` → `{ ok: false, reason: 'busy' }` (Review Focus 5); a song with no `sourceUrl` → `'upload'`; a group song's swap is logged once as an `edit` with subject `'audio'`.
  - The song page's `audio` action: a non-YouTube link → `fail(400, { field: 'audioUrl', message: notYouTube })`; a group song without `seen` → refused as `update` is; room refused like `retry` (413); success → `{ ok: true }`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** `useAudioUrl` writes through `editSong` with subject `'audio'` so History and the flow see it; `songSeen` adds `audioUrl` (and every caller passes it). The `audio` action uses `editing(event, sentOf)` like `update`, reads `audioUrl`, checks `isYouTubeVideo`, checks room as `retry` does, calls `useAudioUrl`, maps `busy`/`upload` to their words with status 409. It sits inside `flowing(...)` like every action, so the flow runs after it (Task 6 makes the flow carry it).
- [ ] **Step 4: Run, expect pass; `npm run check`.**
- [ ] **Step 5: Commit** `songs: Spotify links in the box; Use another YouTube link`.

---

### Task 6: New audio reaches the copies kept in step

**Files:**
- Modify: `src/lib/server/clones/trees.ts` (`songFlat`), `src/lib/clones/flat.ts` (label, `boundToAudio`), `src/lib/server/clones/apply.ts` (`songRoots`), `src/lib/clones/diff.ts` (`diff`), `src/lib/clones/merge.ts` (`mergeRows`)
- Test: `src/lib/clones/diff.spec.ts`, `src/lib/clones/merge.spec.ts`, and the flow spec (`src/lib/server/clones/flow.spec.ts`; extend its song case)

**Interfaces:**
- Produces:
  ```ts
  // flat.ts
  /** The count and the sample index one audio: across copies whose `audio` differs they do not compare. */
  export function boundToAudio(key: string, a: Flat, b: Flat): boolean
  ```
  `songFlat` adds `b.add('audio', `${s.sourceUrl ?? ''}|${s.audioUrl ?? ''}`, <shown: the link, or "Uploaded">)` and the label `audio: 'Audio'` (en and sl catalogs, wherever `fieldLabel` reads labels).

- [ ] **Step 1: Failing specs.**
  - `diff.spec.ts`: two song flats equal but for `audio` and `count` → the diff holds `audio` and not `count`; equal `audio`, differing `count` → `count` is in it (unchanged behaviour).
  - `merge.spec.ts`: the same through `mergeRows`: no `count` or `sample` row when two members' `audio` differ.
  - `flow.spec.ts` (song family: a group's song G, member A's copy kept in step, member B's copy with the switch off): `useAudioUrl` on G then the flow → A has the same `audioUrl`, `status 'waiting_download'`, anchors `[]`; B is unchanged; `stepStatus` for B offers no `count` row (Review Focus 4).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** `boundToAudio(key, a, b)` is `(key === 'count' || key === 'sample') && (a.audio?.value ?? '') !== (b.audio?.value ?? '')`. `diff` and `mergeRows` skip such keys. `songRoots`: `has('audio')` → set `audioUrl = g.audioUrl` and the same reset `useAudioUrl` does (status, anchors, sample, attempts, error, claimedAt), and `this.changed('audioUrl', …)`; a target that is still waiting is left alone for this key. `has('count')`/`has('sample')` apply only when the target's audio equals the giver's after this landing. The `audio` key's class is `always` (no change to `classOf`).
- [ ] **Step 4: Run, expect pass; `npm run check`** (the clone and integrity specs included).
- [ ] **Step 5: Commit** `clones: a song's audio flows to copies kept in step; the count stays with its audio`.

---

### Task 7: The screens

**Files:**
- Create: `src/lib/components/songs/AudioFrom.svelte` (the "Audio from" card), `src/lib/components/songs/AudioSwap.svelte` (the field, Download this one, Cancel, and the question `Dialog`)
- Modify: `src/lib/songs/song-page.ts` (`songSteps`, new `sourceLinks`), `src/lib/songs/library.ts` (`songState`), `src/lib/components/songs/AddSongSheet.svelte`, `src/lib/components/songs/SongDetailsSheet.svelte`, `src/routes/[dance]/songs/[id]/+page.svelte`, `src/routes/[dance]/songs/[id]/+page.server.ts` (load: `audioUrl`, `fetchedUrl`, `fetchedTitle`, and `copiesInStep`), `src/lib/icons/icons.ts` (`spotify`), the catalogs, `src/lib/i18n/no-english.spec.ts` (`TRANSLATED` += the two new components)
- Test: `src/lib/songs/song-page.spec.ts`, `src/lib/songs/library.spec.ts`

**Interfaces:**
- Consumes: `classifyLink` (Task 1), the columns (Task 2), the `audio` action (Task 5).
- Produces:
  ```ts
  // song-page.ts
  export function songSteps(status: SongStatus, source: 'upload' | 'youtube' | 'spotify', fetchedTitle: string | null): SongStep[]
  export type SourceRow = { kind: 'spotify' | 'youtube'; href: string; title: string; meta: string }
  export function sourceRows(song: { sourceUrl; audioUrl; fetchedUrl; fetchedTitle; title; artist }): SourceRow[]
  ```
  `copiesInStep` in the load: how many family members a change of `audio` would reach. Use the flow's own walk without writing: if `src/lib/server/clones/flow.ts` has no dry run, add `flowTargets(db, kind, id, keys: string[]): number[]` sharing `flowFrom`'s walk (refactor `flowFrom` to call it), with a spec that it lists exactly the ids `flowFrom` lands on.

- [ ] **Step 1: Failing specs.**
  - `songSteps('waiting_download', 'spotify', null)` → `Added` (done, "From Spotify"), `Find it on YouTube` (now), `Download` (todo), `Find the beat` (todo); `('waiting_analysis', 'spotify', 'Grupo Niche - Cali Pachanguero (Audio)')` → Find it on YouTube done with that title as meta, Download done, Find the beat now. YouTube and upload steps unchanged.
  - `sourceRows`: a Spotify song with a fetched video → two rows (spotify: its `sourceUrl`, meta "title · artist"; youtube: `audioUrl ?? fetchedUrl`, meta `fetchedTitle`); a YouTube song → one youtube row; an upload → `[]`.
  - `songState` for a `waiting_download` Spotify song → meta "<artist> · Finding it on YouTube" (artist omitted when null), badge as today.
- [ ] **Step 2: Run, expect failure.** **Step 3: Implement** the PURE functions, then the screens to `screens.html` (1, 4, 5, 6): the Add sheet's label, help line and the button word by `classifyLink` as the link is typed ("Add song"; a list shows `listsSoon` under the field in this plan); the steps page and the failed page's line "From Spotify ↗ · Audio from YouTube ↗" as links (`target="_blank" rel="noopener"`); a failed Spotify song's error "No match on YouTube" offers **Use a YouTube link** (opens `AudioSwap` in Song details); Song details' **Audio from** card under Save and **Use another YouTube link**; `AudioSwap` is a `use:guarded` form posting `?/audio` with `seen`, whose Download this one opens the `Dialog` first ("Download the audio again?", the copies sentence only when `copiesInStep > 0`, Cancel / Download). Every new word through `t()`, both catalogs.
- [ ] **Step 4: Run** `npx vitest run src/lib/songs` and `npm run check` → pass.
- [ ] **Step 5: Screenshots.** Shoot `/{dance}/songs`, `/{dance}/songs?add=1`, a ready song and a failed Spotify song at 390×844, light and dark, with `scripts/shots/shots.sh` on a copy of the latest `~/Backups/salsa/db/` backup (never `.data`; see `scripts/shots/README.md`), compare with `screens.html`, fix what differs, and send the shots to the user.
- [ ] **Step 6: Commit** `songs: where the audio came from, and swapping it, on the page and in Song details`.

---

### Task 8: Docs and the order of deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` ("Songs & player": Spotify links, Audio from, Use another YouTube link), `CLAUDE.md` (layout lines for `src/lib/songs/source.ts`, `short-link.ts`, `worker/salsa_worker/spotify.py`/`match.py`; the "Live:" line gains "Spotify songs"), `docs/deployment.md` (the worker section: Spotify's embed page, the pause, the deploy order), the spec (mark plan 1 built)

- [ ] **Step 1:** Write the docs. The deploy order goes in `docs/deployment.md`: the server first (`./scripts/deploy.sh`; migration 0039 applies at boot), then the worker (`nix build .#salsa-worker` on backtop through its usual nixos-config rebuild). A new worker against an old server only loses the new headers, which the old server ignores.
- [ ] **Step 2:** `npm run check` and `nix build .#checks.x86_64-linux.worker` → pass.
- [ ] **Step 3: Commit** `docs: Spotify songs`.
