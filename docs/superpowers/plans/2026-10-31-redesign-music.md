# Redesign: Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the Music tab (today's Songs) — search, Count only, Being added,
Recent then A–Z with split sample rows, the Add a song sheet — and a song's
page (the count and the app's own transport in one card, Tap on the 1, sample,
count speed, your 1s, the waiting and failed states, Song details, Archive in a
dialog) in the new look, losing nothing either does today.

**Architecture:** The URLs stay (`/[dance]/songs`, `/[dance]/songs/[id]`). Every
rule a screen follows — which groups show, their headings, a row's meta and
badge, the steps of a song being added, when a tap is refused, the timeline's
ticks and keys, the upload's checks and words — lives in pure modules under
`src/lib/songs/` with specs; the pages lay them out with the foundation's
components. The upload moves out of `UploadButton` into a small module store
so its progress row survives the sheet closing. Server changes: `listSongs`
carries each song's recent rank (spec "Additions": Recent then A–Z), refusals
name their field or action, and the song page's load adds `durationS`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node), Playwright screenshots via the scratchpad tool.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Music",
"Patterns used across screens", "Additions" (Music: search and Recent then
A–Z). The board source is `docs/superpowers/design-kit/screens/music.py`
(exact copy, spacing and states); its rendered previews are
`$S/previews/s-music-0.png` … `s-music-3.png`, where
`S=/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.

**This is plan 8 of 13.** It follows the foundation (plan 1, built) and reuses
pieces from Moves (plan 4): `ui/SearchField.svelte`, `ui/FieldError.svelte`,
`Segmented`'s `onchange`, `src/lib/moves/plural.ts`, field-named `fail`
refusals, and `act()` from `src/lib/components/routines/act.ts`. If plan 4 has
not landed when a task needs one of these, build it exactly as plan 4's Task 1
Interfaces block says, in the file it names, and say so in the commit. Out of
scope: Practice (`/[dance]/player`, `src/lib/components/player/` — plan 9),
including `SongPicker.svelte` (the song popup); and the shared `Picker`
(plan 7). Two components this plan restyles in place are also Practice's —
`songs/SampleButton.svelte` and `songs/LiveCount.svelte` — so each task that
touches them looks at `/salsa/player` too.

## Global Constraints

From the foundation, verbatim:

- Colours come from `tokens.ts` / `layout.css` only; no hex in components.
- Small text ≥ 4.5:1 against its background, large (≥ 24 px) ≥ 3:1, in all four themes.
- Small text on the light salsa band is white `#ffffff`; band title and icons are cream `#FFF3E4`.
- Fonts: Bricolage Grotesque (titles, hero, big numbers) and Manrope (everything else), self-hosted.
- Icons: 24 px grid, 2 px round strokes; filled variants for the four tabs; tab bar icons 28 px.
- Radii: 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill. Spacing 4, 8, 12, 16, 20, 24, 32, 48.
- Focus: 2 px accent ring + 4 px halo (accent at 20 %); around a filled control, a 2 px gap first.
- No dance switch anywhere; no dance name in a header.
- Touch targets ≥ 44 px.
- Respect `prefers-reduced-motion` for every animation.
- Project rules from `CLAUDE.md` hold: `use:guarded` for filled-in forms, no browser `confirm()`, nothing from `$lib/server` in components, `npm run check` must pass.

This area's:

- Every behaviour of today's two pages survives: the 10 s poll while a song is waiting (list and song page); Retry from the list and the page; one sample at a time (`sample-player.svelte.ts` unchanged) and the song page's own audio pausing when a sample starts / stopping the sample when it plays; tap latency handled on the server (unchanged); Start the sample at the playhead, Back to automatic; Count speed ×½ ×1 ×2 (clears the taps, as now); Your 1s with Remove and Clear all; Song details (title, artist, style) with the source link; archive (archived songs 404); uploads ≤ 95 MB, audio only, carrying the chosen style in `x-style`; Practice with this song → `/[dance]/player?song=<id>`; Count only → `/[dance]/player?bpm=180`.
- Split row: the text part of a song row is the `<a>`; the sample button (or the badge + chevron) are siblings, never nested.
- Small accent text is `text-accent-text`, never bare `text-accent` (salsa light accent is 4.18:1 on the ground). Bare `text-accent` only on icons, rings and fills.
- "Failed: …" meta is `text-danger` 700; "Sample from 1:07" is `text-accent-text` 700; other meta 13/400 `text-muted`.
- `use:guarded` for Add a song and Song details; one-tap forms (Retry, Remove, Clear all, Back to automatic, Start the sample at, Tap on the 1, Archive) stay on `use:enhance`.
- A refusal about one field shows under it (`FieldError`, `aria-invalid`, `aria-describedby`); any other refusal is a `Banner kind="error"` at the top of the sheet or under the control it is about. The sheet stays open and keeps what was typed.

**Screenshots.** `$S/tools/page.sh OUTDIR /salsa/songs /bachata/songs …` (`FULL=1` for full page). States that need a tap: copy `$S/tools/sheet.py` to `$S/tools/music-states.py`, change the clicks, and run it with page.sh's wrapper (`env -u LD_LIBRARY_PATH PLAYWRIGHT_BROWSERS_PATH=… timeout 240 nix shell … -c python3 -I $S/tools/music-states.py OUTDIR $S/tools/state.json`, as `page.sh` does). The dev server on http://localhost:20000 serves this worktree; do not start another. Song states the UI cannot make (no worker runs against dev): a ready song as `CLAUDE.md`'s Commands section describes (a row with `status='ready'`, an `audio_file` under `.data/audio/`, `beats_json`, `dance`), a failed one with `status='failed', error='Video unavailable', source_url='https://www.youtube.com/watch?v=Kd3Qe0bP2sA'` — via `timeout 30 nix develop -c sqlite3 .data/salsa.db`, never from a spec. Waiting songs come from the UI (Add song with any link → Waiting to download; upload a short ffmpeg click track → Finding the beat). Give at least one salsa and one bachata song a long Spanish title ("Periódico de ayer con la orquesta de Willie Colón").

## Review Focus

1. **A refused Add song in bachata** (a link without `https://`, or a 201-character title): the message sits under the field it is about and the link, title and the picked style all stay — never reset to the first style or salsa's. Pinned by the action tests in Task 3.
2. **Searching finds songs in every state:** a waiting or failed song matches by title or artist, accents and case aside; Count only, Being added, the worker banner and the upload row step aside; zero hits shows "No song matches “…”" with a way to add it. Pinned by `libraryView` tests in Task 1.
3. **Counts of one:** "Being added · 1", "All songs A–Z · 1", "1 match · title or artist", "Your 1s · 1" — never "1 matches". Pinned by `libraryView` tests in Task 1 and a screenshot in Task 4.
4. **Tap on the 1 before the song has ever played** must not file an anchor at 0:00: it shows "Play the song first." under the button; a tap while paused mid-song still marks that beat, as today. Pinned by `tapProblem` tests in Task 4.
5. **A 120 MB file or a video picked in Add a song** is refused before a byte is sent, with the reason under the Upload button and the sheet left open; a good file closes the sheet and its progress row stays in Being added until it lands (in-app navigation away and back keeps it). Pinned by `audioFileProblem` tests in Task 1; the progress row checked by screenshot in Task 3.

---

### Task 1: The library model and recent ranks

**Files:**
- Create: `src/lib/songs/library.ts`
- Test: `src/lib/songs/library.spec.ts`
- Modify: `src/lib/songs/search.ts` (generic signatures only), `src/lib/types.ts` (`SongItem.recentRank`)
- Modify: `src/lib/server/songs.ts` (`listSongs`), `src/lib/server/songs.spec.ts`
- Modify: `src/lib/nav/pending.ts` (`'/[dance]/songs': 'Music'`)

**Interfaces:**
- Produces (`search.ts`, behaviour unchanged, `SongPicker` keeps compiling):
  `searchSongs<S extends { title: string; artist: string | null }>(songs: S[], query: string): S[]`;
  `groupSongs<S extends { title: string; recentRank: number | null }>(songs: S[]): { recent: S[]; rest: S[] }`.
- Produces (`types.ts`): `SongItem` gains `recentRank: number | null` (0 = practised most recently; null otherwise — ready songs only, from `recentSongIds`).
- Produces (`library.ts`):
  - `songName(s: { title: string; sourceUrl: string | null }): string` — title, else the source URL (as the list shows today), else "Untitled song".
  - `type LibraryView<S> = { kind: 'empty' } | { kind: 'search'; hits: S[]; heading: string } | { kind: 'list'; adding: S[]; addingHeading: string; recent: S[]; rest: S[]; restHeading: string; worker: boolean }`.
  - `libraryView<S extends SongItem>(songs: S[], query: string, uploading: boolean): LibraryView<S>` — blank query: `empty` when no songs and not uploading; else `adding` = every non-ready song in the given order (newest first), `addingHeading` "Being added · n" counting the upload, `recent`/`rest` from `groupSongs` over ready songs, `restHeading` "All songs A–Z · n", `worker` = any `waiting_*`. Non-blank: `searchSongs` over every song, `heading` "n matches · title or artist" ("1 match · …").
  - `readyMeta(s: SongItem, styleLabel: Record<string, string>): string` — "Salsa · 192 BPM · 5:23", BPM = `Math.round(bpm * tempoFactor)`, missing parts dropped.
  - `songState(s: SongItem, styleLabel): { meta: string; tone: 'danger' | null; badge: { text: string; tone: 'neutral' | 'accent'; icon: 'clock' | 'metronome' } | null }`.
  - `countOnlyMeta(clave: boolean): string`.
  - `audioFileProblem(file: { size: number; type: string }): string | null` — size first, then type; messages as `UploadButton` words them.
  - `megabytes(bytes: number): string`; `uploadMeta(loaded: number, total: number): string`.

- [ ] **Step 1: Write the failing tests** in `library.spec.ts` (a `song(id, title, over)` builder returning a full `SongItem`, ready, `bpm: 96, tempoFactor: 2, durationS: 323`):

```ts
it('puts Being added first, then Recent by rank, then the rest A–Z', () => {
  const v = libraryView([song(5, 'Juliana', { status: 'waiting_analysis' }), song(4, 'Pedro Navaja', { status: 'failed' }),
    song(3, 'Quimbara', { recentRank: 1 }), song(2, 'Aguanile'), song(1, 'Valió la pena', { recentRank: 0 })], '', false);
  expect(v).toMatchObject({ kind: 'list', addingHeading: 'Being added · 2', restHeading: 'All songs A–Z · 1', worker: true });
  // adding ids [5, 4]; recent ids [1, 3]; rest ids [2]
});
it('counts the upload in Being added and is not empty while uploading', ...)
  // libraryView([], '', true) → kind 'list', addingHeading 'Being added · 1'; libraryView([], '', false) → kind 'empty'
it('shows the worker note only while a song waits', ...)   // only a failed song → worker false
it('searches every state by title or artist, A–Z', ...)
  // 'navaja' finds the failed song; 'MARC' finds by artist; heading '1 match · title or artist'; 'zz' → hits [], heading '0 matches · title or artist'
it('words the meta and badge of each state', () => {
  expect(readyMeta(song(1, 'x'), { salsa: 'Salsa' })).toBe('Salsa · 192 BPM · 5:23');
  expect(readyMeta(song(1, 'x', { bpm: null, durationS: null }), { salsa: 'Salsa' })).toBe('Salsa');
  expect(songState(song(1, 'x', { status: 'waiting_download' }), L).badge).toEqual({ text: 'Waiting to download', tone: 'neutral', icon: 'clock' });
  expect(songState(song(1, 'x', { status: 'waiting_analysis' }), L).badge).toEqual({ text: 'Finding the beat', tone: 'accent', icon: 'metronome' });
  expect(songState(song(1, 'x', { status: 'failed', error: 'Video unavailable' }), L)).toMatchObject({ meta: 'Failed: Video unavailable', tone: 'danger', badge: null });
  expect(songState(song(1, 'x', { status: 'failed', error: null }), L).meta).toBe('Failed');
  // a waiting song's meta is its style label alone: 'Salsa'
});
it('names a song before it has a title', ...)  // songName({ title: '', sourceUrl: 'https://youtu.be/x' }) → the URL; both empty → 'Untitled song'
it('says clave only where it exists', ...)     // countOnlyMeta(true) 'The count and clave, no song'; false 'The count, no song'
it('refuses a file before uploading it', () => {
  const MiB = 1024 * 1024;
  expect(audioFileProblem({ size: 120 * MiB, type: 'audio/mpeg' })).toBe('That file is 120 MB; the limit is 95 MB.');
  expect(audioFileProblem({ size: 120 * MiB, type: 'video/mp4' })).toBe('That file is 120 MB; the limit is 95 MB.');
  expect(audioFileProblem({ size: MiB, type: 'video/mp4' })).toBe('Only audio files can be added.');
  expect(audioFileProblem({ size: 95 * MiB, type: 'audio/mp4' })).toBeNull();
});
it('words upload progress', ...)
  // megabytes: 6 MiB '6', 9.7 MiB '9.7', 62.4 MiB '62', 0.4 MiB '0.4' (one decimal under 10, ".0" dropped)
  // uploadMeta(6 * MiB, 9.7 * MiB) → 'Uploading · 6 of 9.7 MB · keep the app open'
```

  In `songs.spec.ts`: after logging a set whose `playerJson` names song A, `listSongs(db, 'salsa')` gives A `recentRank: 0` and a waiting song `recentRank: null` (follow the file's existing `recentSongIds` setup).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/songs src/lib/server/songs.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `listSongs` calls `recentSongIds(db, dance)` once and maps `indexOf`. `search.ts` signatures only (its spec must pass untouched). `library.ts` takes `MAX_RECORDING_BYTES` / `MAX_RECORDING_LABEL` from `$lib/limits` and `clock` from `$lib/format`; it imports nothing from `$lib/server`.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `timeout 600 nix develop -c npx vitest run src/lib/nav` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): the library model — groups, meta, badges, upload checks — and recent ranks`.

### Task 2: The Music tab

**Files:**
- Create: `src/lib/components/songs/SongRow.svelte`
- Modify: `src/lib/components/songs/SampleButton.svelte` (look; optional `name`)
- Modify: `src/routes/[dance]/songs/+page.svelte`

**Interfaces:**
- Consumes: `libraryView`, `songState`, `songName`, `countOnlyMeta` (Task 1); `highlight` (`search.ts`); `SearchField` (plan 4); `Screen`, `BandButton`, `Badge`, `Banner`, `EmptyState`, `Icon`, `button`, `GROUP`, `SECTION_LABEL`; `sampling` (`sample-player.svelte.ts`).
- Produces:
  - `SampleButton` props `{ song: SampleSong; name?: string; class?: string }` — the board's `sample_btn`: a 48 px button, a 34 px `bg-accent-soft` disc holding a filled `play` 15 px (2 px right nudge) or filled `stop` 13 px in `text-accent`; while on, a 42 px ring (r 19, 2.5 px stroke) around the disc: track `stroke-hairline`, progress `stroke-accent` round-capped, filling over `SAMPLE_LENGTH_S` (keep the `{#key sampling.nonce}` restart and the reduced-motion still arc). No ring while off; no left border. `aria-label`: "Stop the sample" / `Play a sample of ${name}` ("Play a sample" without a name); `aria-pressed`.
  - `<SongRow href: string name: string query?: string meta: string tone?: 'danger' | null sample?: SampleSong | null trailing?: Snippet />` — an `<li>` (`pl-4`, `min-h-16`, `flex items-center gap-1`, `pr-1` with a sample else `pr-3.5`): the `<a>` (`flex-1 min-w-0 py-[9px]`) holds the name (16/700, one line, ellipsis; the `highlight` match in a `<mark>` `bg-accent-soft text-accent-text font-extrabold rounded`) and the meta (13, one line, ellipsis; `tone="danger"` → `text-danger font-bold`); while `sampling.id === sample?.id` the meta reads `Sample from ${clock(sample.startS)}` in `text-accent-text font-bold`. Then, as siblings: `SampleButton` when `sample`, else `trailing` (if given) and a 20 px `chevron-right` in `text-chevron`.

- [ ] **Step 1: `SampleButton` and `SongRow`** as above.
- [ ] **Step 2: The page.** `<Screen title="Music">`, `right` = `BandButton icon="plus" label="Add a song"` (opens the sheet of Task 3; until then a no-op state `adding = true`). `let query = $state('')`; `const view = $derived(libraryView(data.songs, query, upload.current !== null))` (`upload` from Task 3; until then pass `false`). Top to bottom, 8 px apart (Screen's gap), 2 px spacer first:
  - `SearchField name="q" placeholder="Search songs" label="Search songs" bind:value={query} onclear={() => (query = '')}` — client-side, no URL, inside a `<form role="search" onsubmit={preventDefault}>`. Hidden when `view.kind === 'empty'`.
  - Count only (not while searching): a `GROUP` `aria-label="Practice"` with one link row to `/[dance]/player?bpm=180`: a 40 px `bg-accent-soft` disc with `metronome` 22 px `text-accent-text`, "Count only" 16/700, `countOnlyMeta(data.dance.clave)` 13 muted, chevron.
  - `list`: when `adding.length` or an upload — `SECTION_LABEL` `addingHeading` (10 px above) and a `GROUP`: the upload row (Task 3) first, then each song as `SongRow` with `meta`/`tone` from `songState`, `trailing` = the badge (`Badge tone` with a 14 px `Icon` before the text) for waiting songs; a failed song's `<li>` is followed by a strip (`border-t border-hairline px-2 pt-1 pb-2`) holding a `use:enhance` form `?/retry` (hidden `id`) with `button('tertiary', 'sm')` + `refresh` icon "Retry" (`aria-label="Retry {name}"`). When `worker`: `Banner kind="info" title="Runs on the laptop at home"` "Downloads and beat analysis happen about once a minute while it is on." Then, if `recent.length`, `SECTION_LABEL` "Recent" + `GROUP` of `SongRow`s with `readyMeta` and `sample`; then if `rest.length`, `SECTION_LABEL` `restHeading` + `GROUP`.
  - `search`: `SECTION_LABEL` `heading` (6 px above) and one flat `GROUP` of `SongRow`s (`query` set; ready rows with `sample`, others as in Being added, without the Retry strip); zero hits → `EmptyState icon="search" title={`No song matches “${query.trim()}”`} body="Add it with the + above."` with a `button('secondary', 'sm')` "Add a song" that opens the sheet.
  - `empty`: `EmptyState icon="music" title="No songs yet" body="Add one from YouTube or upload an audio file. The laptop at home downloads it and finds the beat."` with `button('primary', 'md')` + `plus` "Add a song", 40 px above.
  - `SongRow` `name={songName(s)}`, `href` = `resolve('/[dance]/songs/[id]', …)`; `SampleButton name={songName(s)}`.
  - Keep the 10 s poll while `worker` (it was `waiting`). `<svelte:head><title>Music · {data.dance.label}</title>`. Delete the old header, inline form, upload row, "Count-only drill" button and card list (the add form moves to Task 3's sheet; until Task 3 lands the page has no add form — commit both tasks before any merge).
- [ ] **Step 3: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 4: Look.** Make the states (Screenshots, above): two ready songs with recents (practise one via `/salsa/player?song=<id>` and save the run), one waiting, one failed, in salsa; nothing in a fresh bachata until the empty shot is taken. `FULL=1 $S/tools/page.sh $S/shots/music-2 /salsa/songs /bachata/songs`, then `music-states.py`: type "pe" in the search (marked match, failed row present, Count only gone), type "zz" (no match), clear; tap a row's ▶ (ring fills, meta "Sample from …"), tap another's ▶ (the first stops). Compare with `s-music-0.png` (Music, songs being added, search) and `s-music-1.png` (Music · empty) in light and dark. Open `/salsa/player`, pick a song: the popup's sample buttons are the new ones and still play.
- [ ] **Step 5: Commit** `feat(music): the Music tab — search, Count only, Being added, Recent then A–Z`.

### Task 3: Add a song — the sheet and the upload

**Files:**
- Create: `src/lib/songs/upload.svelte.ts`
- Create: `src/lib/components/songs/AddSongSheet.svelte`, `src/lib/components/songs/UploadRow.svelte`
- Modify: `src/routes/[dance]/songs/+page.server.ts` (`addUrl` refusals), `src/routes/[dance]/songs/+page.svelte`
- Test: `src/routes/[dance]/songs/songs-forms.spec.ts` (new; the `vi.mock('$lib/server/db')` + `openDb(':memory:')` pattern of `dance-wall.spec.ts`, with local `post(dance, fields, id?)` / `call(action, event)` helpers that return `fail` data and catch thrown `error`/`redirect`)

**Interfaces:**
- Consumes: `audioFileProblem`, `uploadMeta` (Task 1); `FieldError` (plan 4); `Sheet`, `Banner`, `Spinner`, `Icon`, `FIELD`, `LABEL`, `CHIP`, `button`; `track` (`$lib/unsaved/guard.svelte`).
- Produces:
  - `addUrl` refusals: `fail(400, { field: 'url' | 'title', message, url, title, style })` — bad link → `url`, "Paste a full link, starting with https://"; title over 200 → `title`, "Keep the title to 200 characters.". A style not of the dance still falls back to the first style (unchanged). Success unchanged (`{ ok: true }`).
  - `upload.svelte.ts`: `type SongUpload = { name: string; loaded: number; total: number; error: string | null }`; `export const upload = $state<{ current: SongUpload | null }>({ current: null })`; `startSongUpload(file: File, dance: DanceSlug, style: string): void` (XHR POST `/api/songs?dance=…` with `content-type`, `x-filename` (encoded), `x-style`; progress from `xhr.upload.onprogress`; 201 → `await invalidateAll()` then `current = null`; failure → `error` = the server's message, "That file is too large (limit 95 MB)." on 413, "Upload failed — check the connection and try again." on a network error — the words `UploadButton` uses); `dismissUpload(): void`. While bytes are moving it registers `track({ label: 'An upload', dirty: () => true, unloadOnly: true })` and releases it when done or failed. One upload at a time: `startSongUpload` is a no-op while one is moving.
  - `<UploadRow />` — reads `upload.current`; the board's `uploading_row` as an `<li>` (`pl-4`; inner `min-h-[76px] py-3 pr-4 gap-3`): `upload` 24 px `text-accent-text`; name 16/700 ellipsis with the percent (`Math.floor`) 15/800 tabular on the right; a 6 px `role="progressbar"` (`aria-label="Uploading {name}"`, `aria-valuenow`) `bg-hairline` track with `bg-accent` fill; `uploadMeta` 13 muted. Failed: meta "Upload failed: {error}" in `text-danger font-bold`, no bar, and a `button('tertiary', 'sm')` "Dismiss" → `dismissUpload`.
  - `<AddSongSheet open: boolean onclose: () => void dance: Dance form: ActionData />`.
  - `/[dance]/songs?add=1` opens the sheet on arrival (Task 5's "Upload a file instead" and plan 9's "Add it in Music" link here).

- [ ] **Step 1: Write the failing tests** in `songs-forms.spec.ts`

```ts
it('puts a bad link under the link field in bachata, keeping every field', async () => {
  expect(await call(songList.actions.addUrl, post('bachata', { url: 'youtube.com/watch?v=7hdQ', title: 'Obsesión', style: 'sensual' })))
    .toMatchObject({ status: 400, data: { field: 'url', message: 'Paste a full link, starting with https://',
      url: 'youtube.com/watch?v=7hdQ', title: 'Obsesión', style: 'sensual' } });
  expect(listSongs(db, 'bachata')).toHaveLength(0);
});
it('puts a long title under Title', ...)          // title 'x'.repeat(201) → field 'title', 'Keep the title to 200 characters.', url kept
it('adds a good link waiting to download, in its dance', ...) // → { ok: true }; listSongs(db, 'bachata')[0] status 'waiting_download', style 'sensual'
```
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run 'src/routes/[dance]/songs'` — Expected: FAIL.
- [ ] **Step 3: Implement the refusals** (check the link first, then the title).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: `upload.svelte.ts` and `UploadRow`** as in Interfaces. `UploadButton.svelte` stays for the figure and lesson pages.
- [ ] **Step 6: `AddSongSheet`**, the board's `add_sheet`: `Sheet title="Add a song"`; a `use:guarded` form (label "Add a song", `action="?/addUrl"`, `novalidate`, `id="add-song"`), fields 14 px apart on `bg-sheet` (fields `bg-surface`):
  - "YouTube link" (`LABEL`): `FIELD` with `pl-11`, a 20 px `youtube` icon `text-muted` inside on the left, `name="url" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…"`, `autofocus` (with the `svelte-ignore` comment), value from `form?.url`; `field === 'url'` → `aria-invalid`, `aria-describedby`, `FieldError`.
  - "Title" + " (optional)" (400 `text-muted`): `FIELD name="title" maxlength="200" placeholder="Song title"`, value from `form?.title`, its own `FieldError`.
  - Style: `<fieldset>` with `<legend class={LABEL}>Style</legend>`, `CHIP` radios `name="style"` in a wrapping row (gap 8), `bind:group={style}`, `style` = `form?.style` when it is one of `dance.styles`, else the first.
  - A `Banner kind="error"` at the top when `form?.message` has no `field`.
  - "Add song": `button('primary', 'md', true)` submit, `Spinner` while sending, width kept. Success (`result.type === 'success'`) → `onclose()` (the form resets on update).
  - The "or" rule: two `h-px bg-hairline` lines around "or" (13/700 `text-muted`), `aria-hidden`.
  - "Upload an audio file": a `<label class={button('secondary', 'md', true)}>` with `upload` icon wrapping an `sr-only` `<input type="file" accept="audio/*">`; `has-focus-visible` ring; disabled (with the helper "One upload at a time — wait for the one in Music.") while `upload.current` has no error. On change: `audioFileProblem(file)` → `Banner kind="error"` with the message under the button, input cleared, sheet open; otherwise `startSongUpload(file, dance.slug, style)` and `onclose()`.
  - Under it, unless that banner shows: "Up to 95 MB. It gets the style above." (13 `text-muted`, centred, `px-3 pt-1`).
- [ ] **Step 7: Wire the page:** the band "+" and the empty states' buttons set `adding = true`; `onMount` opens it when `page.url.searchParams.get('add') === '1'`; `UploadRow` heads the Being added group while `upload.current` is set; `libraryView(…, upload.current !== null)`.
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Look** with `music-states.py`: `/salsa/songs?add=1` (focused link field, chips, Add song, or, Upload) and `/bachata/songs?add=1`; type `youtube.com/watch?v=7hdQ`, pick the second style, submit (message under the link, red outline, text and style kept); type a link and press Escape ("Unsaved changes"); pick a 120 MB file via `set_input_files` with a generated buffer (`{ name, mimeType: 'audio/mpeg', buffer }`) — the banner under Upload, sheet open; pick a 2 MB audio buffer with the network throttled (`page.route('**/api/songs*', …)` delaying the response) — sheet closes, the progress row heads Being added; go to `/salsa` and back — the row is still there. Compare with `s-music-0.png` (Add a song, bad link, file too large; Music · songs being added) in light and dark.
- [ ] **Step 10: Commit** `feat(music): the Add a song sheet, the upload's progress row, refusals under their field`.

### Task 4: A song — the count, the transport, sample, count speed, your 1s

**Files:**
- Create: `src/lib/songs/song-page.ts`, `src/lib/songs/timeline.ts`
- Test: `src/lib/songs/song-page.spec.ts`, `src/lib/songs/timeline.spec.ts`
- Create: `src/lib/components/ui/SeekBar.svelte`
- Modify: `src/lib/components/songs/LiveCount.svelte` (look only)
- Modify: `src/routes/[dance]/songs/[id]/+page.server.ts` (load `durationS`; `tap`/`sample` refusals carry `action`), `src/routes/[dance]/songs/[id]/+page.svelte`
- Test: `src/routes/[dance]/songs/songs-forms.spec.ts`

**Interfaces:**
- Consumes: `SampleButton` (Task 2); `Segmented` `onchange` (plan 4); `act` (`components/routines/act.ts`); `Screen`, `BandButton`, `Badge`, `Banner`, `Icon`, `button`, `iconButton`, `GROUP`, `SECTION_LABEL`; `clock`; `TEMPO_FACTORS`, `TEMPO_LABEL`.
- Produces:
  - `song-page.ts`: `songSubtitle(p: { artist: string | null; style: string; bpm: number | null }): string`; `tapProblem(audio: { paused: boolean; currentTime: number } | null): string | null` → "Play the song first." when there is no element or it is paused at 0; `sampleLabels(custom: boolean): { badge: string; tone: 'accent' | 'neutral'; meta: string }`.
  - `timeline.ts`: `tickPercents(times: number[], duration: number): number[]` (times in `[0, duration]` as percents, others dropped; `[]` when `duration <= 0`); `seekFraction(x: number, left: number, width: number): number` (clamped 0–1; 0 when `width <= 0`); `seekKey(key: string, value: number, duration: number): number | null` (←/↓ −5 s, →/↑ +5 s, PageDown −30, PageUp +30, Home 0, End `duration`, clamped; null for any other key).
  - `<SeekBar value: number duration: number ticks?: number[] label: string onseek: (s: number) => void />` — shared (Practice's seek bar, plan 9, uses it): a 44 px-tall pointer area around a 6 px `bg-hairline` track with a `bg-accent` fill to `value`, ticks as 2 × 20 px `bg-accent-text` bars at 55 % opacity, a 20 px round `bg-white` thumb with the board's shadow, `role="slider"` on the thumb (`aria-label={label}`, `aria-valuemin=0`, `aria-valuemax={Math.round(duration)}`, `aria-valuenow`, `aria-valuetext={clock(value)}`, `tabindex=0`, keys via `seekKey`); pointer down/move with capture → `onseek(seekFraction(…) * duration)`; under it `clock(value)` and `clock(duration)` 13/600 `text-muted` tabular, spread.
  - `LiveCount` (same props): number in `font-display` 88/800, `-0.02em`, tabular — 1 `text-accent-text`, 5 `text-ink`, others `text-ink-2`, none "–" in `text-chevron`; dots 12 px, 8 px apart — current `bg-accent` (on 1) / `bg-ink`, idle 4 and 8 `bg-hairline`, others `bg-field-line`. Number and dots 12 px apart.
  - Load: `song.durationS`. `tap` and `sample` refusals: `fail(400, { action: 'tap' | 'sample', message })` (messages unchanged).

- [ ] **Step 1: Write the failing tests**

```ts
// song-page.spec.ts
expect(tapProblem(null)).toBe('Play the song first.');
expect(tapProblem({ paused: true, currentTime: 0 })).toBe('Play the song first.');
expect(tapProblem({ paused: true, currentTime: 42.5 })).toBeNull();   // a pause mid-song still taps, as today
expect(tapProblem({ paused: false, currentTime: 0 })).toBeNull();
expect(songSubtitle({ artist: 'Marc Anthony', style: 'Salsa', bpm: 191.6 })).toBe('Marc Anthony · Salsa · 192 BPM');
expect(songSubtitle({ artist: null, style: 'Son', bpm: null })).toBe('Son');
expect(sampleLabels(true)).toEqual({ badge: 'Yours', tone: 'accent', meta: 'Set by you' });
expect(sampleLabels(false)).toEqual({ badge: 'Automatic', tone: 'neutral', meta: 'A third of the way in, on a 1' });
// timeline.spec.ts
expect(tickPercents([0, 30, 60, 400], 120)).toEqual([0, 25, 50]);
expect(tickPercents([10], 0)).toEqual([]);
expect(seekFraction(150, 100, 200)).toBe(0.25); expect(seekFraction(50, 100, 200)).toBe(0);
expect(seekFraction(400, 100, 200)).toBe(1);   expect(seekFraction(150, 100, 0)).toBe(0);
expect(seekKey('ArrowRight', 10, 100)).toBe(15); expect(seekKey('ArrowLeft', 2, 100)).toBe(0);
expect(seekKey('PageUp', 90, 100)).toBe(100);    expect(seekKey('Home', 50, 100)).toBe(0);
expect(seekKey('End', 50, 100)).toBe(100);       expect(seekKey('a', 50, 100)).toBeNull();
```

  In `songs-forms.spec.ts`: a tap on a waiting song → `{ status: 400, data: { action: 'tap', message: 'Play the song first.' } }`; a sample with `t=abc` → `action: 'sample'`; a tap from `/bachata/songs/<salsa id>` → 404 and no anchor written.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/songs 'src/routes/[dance]/songs'` — Expected: FAIL.
- [ ] **Step 3: Implement** `song-page.ts`, `timeline.ts`, the load and refusal changes.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: `SeekBar` and `LiveCount`** as in Interfaces.
- [ ] **Step 6: The page band:** `<Screen compact title={songName(song)} subtitle={songSubtitle({ artist, style: styleLabel, bpm: grid?.bpm ?? null })}>`, `left` = `BandButton icon="back" label="Back to Music"` → `/[dance]/songs`, `right` = `BandButton icon="edit" label="Song details"` (opens Task 5's sheet; until then a state flag). Delete the old sticky header.
- [ ] **Step 7: The ready state**, the board's `song_page` and `song_page_lower`, 8 px apart, top to bottom:
  - "Practice with this song": `<a class={button('secondary', 'md', true)}>` with a filled `play` 18 px → `/[dance]/player?song=<id>`.
  - The card (`bg-surface rounded-[22px] px-4 pt-3.5 pb-4 flex flex-col gap-3`): `LiveCount`; then a row (gap 14): a 52 px filled round play/pause button (`iconButton('filled')` sized `size-[52px]`, filled `play`/`pause` icon, label "Play the song" / "Pause the song") and `SeekBar` (`pt-3.5`, `label="Position in the song"`, `value={now}`, `duration` = `audio.duration` once known else `song.durationS ?? 0`, `ticks` = `data.anchors.map((i) => grid.beats[i])` defined ones, `onseek` sets `audio.currentTime`). The `<audio>` stays (`preload="auto"`, `onplay={stopSample}`, `bind:paused`, time updates) without `controls`, hidden. `now` also updates every animation frame while playing so the thumb does not jump 4 times a second.
  - The tap form (`use:enhance`, `?/tap`): before sending, `tapProblem(audio)` — a problem cancels the submit and shows it; the button is `button('primary', 'lg', true)` "Tap on the 1", or for 600 ms after a success the board's "Got it" (`h-16 w-full rounded-full bg-done-soft text-done font-display text-[22px] font-extrabold`, `check` 24 px, `aria-live="polite"`). The tap problem, or a refusal with `action: 'tap'`, is a `Banner kind="error" title="Play the song first."` with the line "A tap marks the beat that is playing." (other tap refusals: the message as the title, no line).
  - The note (13 muted, centred, `px-3 pt-1`): `grid.suggested` → "The count is a guess. Play the song and tap on every “1” you hear until it lines up." else "If the count slips after a break, tap the 1 again there."; then " · {Math.round(grid.bpm)} BPM" when known.
  - When `data.sample`: `SECTION_LABEL` "Sample" (14 px above) and a `GROUP` with one row (`pl-4 pr-1 min-h-16`, not a link): "From {clock(startS)}" 16/700 tabular + `Badge` (`sampleLabels`), the meta under it, `SampleButton name={songName(song)}`. Then the `?/sample` form: `button('secondary', 'md', true)` "Start the sample at {clock(now)}"; when `custom`, a centred `?/sampleAuto` form with `button('tertiary', 'sm')` "Back to automatic" (−4 px above). A refusal with `action: 'sample'` → `Banner kind="error"` under these.
  - `SECTION_LABEL` "Count speed" (8 px above), `Segmented name="factor" label="Count speed"` (on the sheet: neutral) with `TEMPO_FACTORS` / `TEMPO_LABEL`, `value={String(song.tempoFactor)}`, `onchange={(v) => act('tempo', { factor: v })}`; note (left-aligned) "If the count runs at half or double your steps, switch it. This clears your taps."
  - When anchors exist: a section-label row "Your 1s · n" (13/700 muted) with `button('tertiary', 'sm')` "Clear all" on the right (`?/resetAnchors`, `use:enhance`), then a `GROUP` `aria-label="Your 1s"`: per anchor a row (`min-h-14 pl-4 pr-1`) with `clock(grid.beats[beat])` 16/700 tabular and `button('danger-text', 'sm')` "Remove" (`aria-label="Remove the 1 at {time}"`, `?/removeAnchor`).
- [ ] **Step 8: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 9: Look** with a ready salsa song and a ready bachata one (long Spanish title): `FULL=1 $S/tools/page.sh $S/shots/music-4 /salsa/songs/<id> /bachata/songs/<id>`; in `music-states.py`: tap "Tap on the 1" before playing (banner, count "–"); play, wait 3 s, tap (Got it, a tick appears on the timeline, "Your 1s · 1"); press → on the focused thumb (5 s on); play a sample (the song pauses) and press play (the sample stops); switch Count speed to ×2 (taps cleared). Compare with `s-music-1.png` (Song, Song · lower down) and `s-music-2.png` (Song · tap registered, tapped before playing) in light and dark. Open `/salsa/player` with a song and run it a few seconds: the restyled `LiveCount` reads right there.
- [ ] **Step 10: Commit** `feat(music): the song page — count and transport in one card, the app's own timeline, sample, count speed, your 1s`.

### Task 5: A song being added or failed, Song details, Archive; docs

**Files:**
- Modify: `src/lib/songs/song-page.ts`, `src/lib/songs/song-page.spec.ts` (`songSteps`)
- Modify: `src/routes/[dance]/songs/[id]/+page.server.ts` (`update` refusals), `src/routes/[dance]/songs/[id]/+page.svelte`
- Create: `src/lib/components/songs/SongDetailsSheet.svelte`
- Test: `src/routes/[dance]/songs/songs-forms.spec.ts`
- Modify: `CLAUDE.md` (Layout's `src/lib/songs/` line), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the Songs page's description: now Music, the song page's own timeline)

**Interfaces:**
- Consumes: `songName` (Task 1), `FieldError`, `Sheet`, `Dialog`, `Banner`, `Spinner`, `FIELD`, `LABEL`, `CHIP`, `button`, `GROUP`, `Icon`.
- Produces:
  - `songSteps(status: SongStatus, fromUpload: boolean): { state: 'done' | 'now' | 'todo'; title: string; meta: string }[]`.
  - `update` refusals: `fail(400, { field?: 'title' | 'artist', message, title, artist, style })` — no title or over 200 → `title`, "Give the song a title (up to 200 characters)."; artist over 200 → `artist`, "Keep the artist to 200 characters."; a style not of the dance → no field, "Pick a style.".
  - `<SongDetailsSheet open onclose song: { title; artist; style; sourceUrl } dance: Dance form: ActionData onarchive: () => void />`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(songSteps('waiting_download', false)).toEqual([
  { state: 'done', title: 'Added', meta: 'From YouTube' },
  { state: 'now', title: 'Download', meta: 'Waiting for the home fetcher' },
  { state: 'todo', title: 'Find the beat', meta: 'Beat analysis on the laptop' }]);
expect(songSteps('waiting_analysis', false)).toEqual([
  { state: 'done', title: 'Added', meta: 'From YouTube' },
  { state: 'done', title: 'Download', meta: 'Downloaded' },
  { state: 'now', title: 'Find the beat', meta: 'Waiting for beat analysis' }]);
expect(songSteps('waiting_analysis', true)).toEqual([      // an upload skips Download
  { state: 'done', title: 'Added', meta: 'Uploaded' },
  { state: 'now', title: 'Find the beat', meta: 'Waiting for beat analysis' }]);
expect(songSteps('ready', false)).toEqual([]); expect(songSteps('failed', true)).toEqual([]);
```

  In `songs-forms.spec.ts`: `update` with `title: ''` → `field: 'title'`, artist and style kept; `artist: 'x'.repeat(201)` → `field: 'artist'`; `style: 'son'` on a bachata song → no `field`, "Pick a style."; `archive` → a 303 to `/bachata/songs` and the song's load then 404s.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/songs 'src/routes/[dance]/songs'` — Expected: FAIL.
- [ ] **Step 3: Implement** `songSteps` and the refusals (title, then artist, then style).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Waiting and failed**, the board's `song_waiting` / `song_failed`. Waiting: a `GROUP` `aria-label="Progress"` of `songSteps(song.status, song.sourceUrl === null)` rows (`min-h-14 pl-4 gap-3`): leading 24 px — done: filled `check-circle` `text-done`; now: `Spinner size={24}`; todo: `circle` `text-field-line` — title 16/700 (`text-muted` when todo), meta 13 muted; then the note "It runs on the laptop about once a minute while it is on. This page updates by itself." (the 10 s poll stays). Failed: `Banner kind="error" title="This song failed"` with `song.error ?? 'Unknown error'`; a `?/retry` `use:enhance` form with `button('primary', 'md', true)` + `refresh` "Retry"; `<a class={button('secondary', 'md', true)}>` + `upload` "Upload a file instead" → `/[dance]/songs?add=1`; when `sourceUrl`, the note "From {sourceUrl}" (`break-all`). A retry refusal shows its message in a `Banner kind="error"` under Retry.
- [ ] **Step 6: `SongDetailsSheet`**, the board's `details_sheet`: `Sheet title="Song details"`; a `use:guarded` form (label "Song details", `?/update`, `novalidate`): Title (`FIELD`, `required maxlength="200"`, `autofocus`), Artist (`FIELD maxlength="200"`), Style (`fieldset` of `CHIP` radios, current style checked), each with `FieldError` when `form.field` names it, a `Banner kind="error"` at the top for a refusal without a field; values from `form` after a refusal, else `song`; `button('primary', 'md', true)` "Save" (`Spinner` while sending); success → `onclose()`. Then "From {sourceUrl}" (13 muted, centred, `break-all`) when set; then, above a hairline, `button('danger-text', 'sm')` + `trash` "Archive song" → `onarchive()`.
- [ ] **Step 7: Archive dialog** on the page: `Dialog open={archiving} icon="trash" tone="danger" title="Archive this song?" body={`${songName(song)} leaves Music and the song popup. Sets you logged with it stay.`}` stacked over the sheet (the sheet stays open under it); actions: `button('tertiary', 'sm')` "Cancel" and a `use:enhance` form `?/archive` with `button('danger', 'sm')` "Archive". Remove the old `<details>` and its `confirm()`. The pencil opens the sheet in every state (ready, waiting, failed).
- [ ] **Step 8: Docs.** `CLAUDE.md` Layout, `src/lib/songs/` entry: add `library.ts` (PURE: the Music tab's groups, meta, badges, upload checks), `song-page.ts` and `timeline.ts` (PURE: the song page's steps, tap rule, the seek bar's maths), `upload.svelte.ts` (the one song upload in flight, outliving the sheet). The main design spec's Songs paragraph: the tab is Music; the song page has the app's own timeline with the user's 1s as ticks; archive asks in a dialog.
- [ ] **Step 9: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 10: Look** with `music-states.py`: a song added from a link (waiting: three steps, Download spinning), an uploaded one before the worker (two steps), the failed one (banner, Retry, Upload a file instead → the Add a song sheet opens over Music); on a ready song tap the pencil (sheet, Title focused), clear Title and Save (message under Title, artist kept), press Escape with an edit (Unsaved changes), Archive song → the dialog over the sheet, Cancel (back to the sheet), Archive → Music without the song. Compare with `s-music-2.png` (Song · waiting, Song · failed, Song details, Archive song) in light and dark, salsa and bachata.
- [ ] **Step 11: Commit** `feat(music): songs being added or failed, Song details in a sheet, archive in a dialog`.

---

## Calls made in this plan

- **Search is client-side and not in the URL.** The whole library is already loaded (as the song popup does it); a query string would add a round trip per letter for nothing. Cost if wrong: a reload loses the typed search.
- **Recent in Music is the song popup's Recent** — `recentSongIds`, the last five songs practised in this dance — added to `listSongs` as `recentRank`. Why: the spec's Additions say "the same as the song popup already has". Cost: one extra small query per Music load.
- **Being added holds waiting and failed songs** (newest first) plus the upload in progress; failed songs stay there with Retry rather than dropping into A–Z, as the board draws it. Archiving a failed song (Song details) is how it leaves.
- **Searching lists every state** (the board's search shows a failed song) in one flat A–Z list; Count only, the worker banner and the upload row step aside. The board's "Accents and case aside: “valio” finds Valió la pena." line is left out — it explains the board, not the screen.
- **No match in Music** is "No song matches “…”" with "Add it with the + above." and an Add a song button; the board draws the no-match state only for the popup.
- **A titleless song** (a link before the worker names it) shows its link as the name, as today (`songName`), and "Untitled song" if it has neither.
- **The upload lives in a module store** (`upload.svelte.ts`), not inside a button: the sheet closes when an upload starts and the progress row sits in Being added, surviving in-app navigation; leaving the site mid-upload asks (`track`, `unloadOnly`), as `UploadButton` did. One upload at a time (as today). A failed upload shows in its row with Dismiss. `UploadButton` stays for the figure and lesson pages.
- **The Add form is `novalidate`**, so a link without `https://` reaches the server and its message shows under the field (the board's bad-link state) instead of the browser's bubble.
- **Refusals name their place:** `field` for the two sheets' forms, `action` for the song page's tap and sample, so each message sits under what it is about. Messages are unchanged except Song details' split per field and "Pick a style." for a style from the other dance (today it said "Give the song a title").
- **A tap before the song has ever played is refused in the browser** (paused at 0:00 → "Play the song first."). A tap while paused mid-song still marks that beat, as today; the server's own check is unchanged.
- **Your 1s rows show the time only.** The board's labels ("First 1", "After the break", "Coro") are not data the app has; inventing them is a feature.
- **Remove, Clear all and Count speed stay one-tap, without Undo or a dialog** — as today; the spec's Undo list and its confirm()-to-dialog rule do not name them.
- **Count only's meta drops "clave" in bachata** ("The count, no song"); bachata has no clave.
- **The Archive dialog stacks over the Song details sheet** (the sheet stack supports it) rather than closing the sheet first, so Cancel returns to the sheet and no two history changes race. The board draws the dialog over the page alone.
- **"Upload a file instead" opens Music's Add a song sheet** via `/[dance]/songs?add=1` (today it was a link to the Songs page); plan 9's "Add it in Music" can use the same URL.
- **`SeekBar` is a shared `ui/` component** because Practice (plan 9) needs the same seek bar; its maths is in `src/lib/songs/timeline.ts`. Its thumb is `bg-white` with a shadow in every theme, as the board draws it (a token thumb would vanish on the dark card). Cost if wrong: one class.
- **`SampleButton` and `LiveCount` are restyled in place**, and both are also Practice's. `SampleButton` gains an optional `name` for its label; the picked-row disc tone of the popup is left to plan 9. Running Practice's stage on the band (cream count) is plan 9's call; this plan only checks `/salsa/player` still reads.
- **The song page's load adds `durationS`** so the timeline shows the total before the audio's metadata arrives.
- **`searchSongs` / `groupSongs` become generic** so Music and the popup share them; their behaviour and spec are unchanged.
- **The worker banner shows while any song waits**, not for a failed one alone (as today's note).
- **The tab's skeleton and head title say "Music"** (`pending.ts`; `<title>Music · Salsa</title>` — the browser tab, not a header).
