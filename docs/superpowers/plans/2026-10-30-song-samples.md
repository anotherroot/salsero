# Song Samples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user hear a 15 s sample of any song wherever a song is picked or listed, pick songs from a searchable popup instead of a `<select>`, set a song's sample start on its page, and make Back close only the topmost popup in every sheet.

**Architecture:** Pure modules decide everything testable — where a sample starts (`src/lib/songs/sample.ts`), how the popup filters and groups (`src/lib/songs/search.ts`), and how open sheets map onto history entries (`src/lib/sheets/stack.ts`). One impure singleton owns the sample's `<audio>` (`src/lib/songs/sample-player.svelte.ts`); one wires the sheet stack to SvelteKit shallow routing (`src/lib/sheets/history.svelte.ts`). The server computes each ready song's snapped sample start and recent rank once per load (`songChoices` in `src/lib/server/songs.ts`), so components get plain rows.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Drizzle + SQLite, Tailwind 4, Vitest (node project only — `*.spec.ts`; no component tests).

**Spec:** `docs/superpowers/specs/2026-10-30-song-samples-design.md` (mockups: https://claude.ai/artifact/AEH5TccTqrb4zRyvspJ6FZ, version 3). Read the spec before each task.

## Global Constraints

- Sample: **15 s** (`SAMPLE_LENGTH_S = 15`), fade **1 s** in and out (`SAMPLE_FADE_S = 1`), always 1×, no count, no clave, one at a time across the page.
- Automatic start: **one third of `durationS`**, snapped back to the last beat at or before it whose count is **1** (the grid from `songGrid`, suggested or tapped). User's start stored raw in `songs.sample_start_s` (real, nullable; `null` = automatic) and snapped the same way on read.
- New column by plain `ALTER TABLE songs ADD COLUMN sample_start_s real` — **no CHECK**, no table rebuild. Read the generated SQL before committing (CLAUDE.md hard rule).
- Data functions take `db` first; specs use `openDb(':memory:')`; nothing under `$lib/server` is imported by components; shared row shapes go in `src/lib/types.ts`.
- One-tap forms use `use:enhance`; never a browser `confirm()` for new UI.
- Copy, exactly: popup title **"Pick a song"**; search placeholder **"Search songs"**; count line **"N songs"** / **"1 match"** / **"N matches"** and **"▶ hear 15 s · tap a song to pick it"**; group headings **"Recent"** and **"All songs A–Z"**; empty search **"No song matches “{query}”."** + **"Add it on the Songs page."** (link); sampling row second line **"Sample from m:ss"**; song page section heading **"Sample"**, tags **"Automatic"** / **"Yours"**, lines **"A third of the way in, on a 1"** / **"Set by you"**, button **"Start the sample at m:ss"**, link **"Back to automatic"**. Times via `clock()` from `src/lib/format.ts`.
- Recent: up to **5** songs, from `sets.player_json`'s `songId` of this dance's sets, newest first, ready songs only.
- Back closes only the top sheet; Back with unsaved work in that sheet asks the "Unsaved changes" question and keeps it open.
- `npm run check` must pass at the end of every task.

## Review Focus

1. **Back over a sheet holding unsaved work** (a finished run in the log popup) — must ask, and choosing to stay must leave the sheet open *and* its history entry restored, so a second Back asks again rather than leaving the page. Pinned in Task 7 (`stack.spec.ts`: "Back with unsaved work re-pushes and asks").
2. **A sheet closed by code, then the page navigates** (Log set closes the popup; archive redirects) — no stale history entry that makes the next Back appear to do nothing. Pinned in Task 7 ("a stale entry after the sheet is gone bounces back").
3. **Sample start beyond the song or with no grid** (custom start ≥ duration after a re-download, a song with `durationS` null, empty beats) — no throw, falls back to an unsnapped, clamped time. Pinned in Task 1.
4. **Search with accents and odd input** ("valio", "  QUIM ", a query that is all spaces, regex characters like "(") — matches folded, never throws, all-spaces behaves as empty. Pinned in Task 3.
5. **A sample still playing when the page changes or practice starts** — must stop. Pinned by the manual checks in Tasks 4 and 6 (no component tests exist in this repo); `stopSample` is called from the root layout's `beforeNavigate` and from both play paths.

---

### Task 1: Where a sample starts (pure)

**Files:**
- Create: `src/lib/songs/sample.ts`
- Test: `src/lib/songs/sample.spec.ts`

**Interfaces:**
- Produces:
  - `export const SAMPLE_LENGTH_S = 15; export const SAMPLE_FADE_S = 1;`
  - `export function sampleStart(input: { durationS: number | null; beats: number[]; counts: number[]; customS: number | null }): number`
  - `export function sampleGain(elapsedS: number, lengthS: number): number` — 0→1 over the first `SAMPLE_FADE_S`, 1 in the middle, 1→0 over the last `SAMPLE_FADE_S`, clamped to [0, 1].

- [ ] **Step 1: Write the failing tests** in `sample.spec.ts`:

```ts
const beats = Array.from({ length: 200 }, (_, i) => i * 0.5); // 120 BPM
const counts = beats.map((_, i) => (i % 8) + 1);                // a 1 every 4 s, at 0, 4, 8…
it('starts a third of the way in, snapped back to a 1', () => {
	expect(sampleStart({ durationS: 90, beats, counts, customS: null })).toBe(28); // 30 → the 1 at 28
});
it('snaps a custom start the same way', () => {
	expect(sampleStart({ durationS: 90, beats, counts, customS: 43.9 })).toBe(40);
});
it('keeps an exact 1', () => {
	expect(sampleStart({ durationS: 90, beats, counts, customS: 44 })).toBe(44);
});
it('falls back to the unsnapped time with no grid', () => {
	expect(sampleStart({ durationS: 90, beats: [], counts: [], customS: null })).toBe(30);
});
it('uses 0 when the duration is unknown and nothing is set', () => {
	expect(sampleStart({ durationS: null, beats, counts, customS: null })).toBe(0);
});
it('clamps a custom start past the end back to automatic', () => {
	expect(sampleStart({ durationS: 90, beats, counts, customS: 120 })).toBe(28);
});
it('keeps the unsnapped target when no 1 comes at or before it', () => {
	const late = counts.map((c, i) => (i < 5 ? 3 : c)); // no 1 before beat 5
	expect(sampleStart({ durationS: 9, beats, counts: late, customS: 1 })).toBe(1);
});
it('fades in and out over a second', () => {
	expect(sampleGain(0, 15)).toBe(0);
	expect(sampleGain(0.5, 15)).toBeCloseTo(0.5);
	expect(sampleGain(7, 15)).toBe(1);
	expect(sampleGain(14.5, 15)).toBeCloseTo(0.5);
	expect(sampleGain(20, 15)).toBe(0);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/songs/sample.spec.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `sampleStart` and `sampleGain` in `src/lib/songs/sample.ts`. Target = `customS` if it is finite and `0 ≤ customS < durationS` (or `durationS` is null and `customS ≥ 0`), else `durationS / 3`, else 0. Snap: the largest `i` with `beats[i] ≤ target` and `counts[i] === 1` → `beats[i]`; none → `target`. Module header comment: what a sample is and that the server computes it (`songChoices`), the client only plays it.
- [ ] **Step 4: Run** the spec — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/songs && git commit -m "Song samples: where a sample starts, and its fade"`

---

### Task 2: The column, setting it, and the picker's rows (server)

**Files:**
- Modify: `src/lib/server/db/schema.ts` (songs table: `sampleStartS: real('sample_start_s')` with a doc comment: raw seconds the user chose, null = automatic, snapped on read by `sampleStart`)
- Create: `drizzle/00NN_*.sql` via `npm run db:generate`
- Modify: `src/lib/types.ts` (add `PickerSong`, `SampleSong`; extend `SongItem`)
- Modify: `src/lib/server/songs.ts`
- Modify: `src/lib/server/popup.ts`, `src/routes/[dance]/+page.server.ts`, `src/routes/[dance]/player/+page.server.ts` (call `songChoices` instead of `listReadySongs`)
- Test: `src/lib/server/songs.spec.ts`, `src/lib/server/data.spec.ts` (the existing `listReadySongs` test moves to `songChoices`)

**Interfaces:**
- Consumes: `sampleStart` (Task 1), `songGrid` (`src/lib/server/grid.ts`).
- Produces (in `src/lib/types.ts`):
  ```ts
  /** What a ▶ needs to play a song's sample. */
  export interface SampleSong { id: number; audioFile: string; startS: number }
  /** A ready song as the song popup lists it. */
  export interface PickerSong {
  	id: number; title: string; artist: string | null; style: string;
  	/** As the Songs list shows it: bpm × tempoFactor, rounded; null when unknown. */
  	bpm: number | null;
  	durationS: number | null;
  	sample: SampleSong;
  	/** 0 = the song practised with most recently; null = not among the last five. */
  	recentRank: number | null;
  }
  ```
  `SongItem` gains `sample: SampleSong | null` (null unless `status === 'ready'` with an audio file).
- Produces (in `src/lib/server/songs.ts`):
  - `export function songChoices(db: Db, dance: DanceSlug): PickerSong[]` — replaces `listReadySongs` (delete it; same filter: unarchived, ready, this dance), ordered by title.
  - `export function recentSongIds(db: Db, dance: DanceSlug, limit = 5): number[]` — distinct `json_extract(sets.player_json, '$.songId')` over sets joined to this dance's exercises, newest `done_at` first, non-null only. Scans at most the latest 200 such sets.
  - `export function setSampleStart(db: Db, id: number, startS: number | null): boolean` — false (and no write) when `startS` is not null and not `0 ≤ startS < durationS`.
  - `export function songSample(song: Song): SampleSong | null` — `sampleStart` over `songGrid(song)`; null without an audio file.

- [ ] **Step 1: Add the column**, run `npm run db:generate`, and read the SQL. Expected: exactly `ALTER TABLE \`songs\` ADD \`sample_start_s\` real;` — anything else (a `__new_songs` table) means stop and fix the schema change.
- [ ] **Step 2: Write the failing tests** in `songs.spec.ts` (make songs ready with `storeAnalysis(db, id, { beats, downbeats: [], durationS: 90 })` using the 120 BPM grid from Task 1, and an audio file via `createSongFromUpload`):
  - `songChoices` returns ready songs of the dance only, by title, each with `sample.startS === 28` and `bpm === 120`; a song with `tempoFactor` 2 reports `bpm === 240`.
  - `setSampleStart(db, id, 43.9)` → true, and `songChoices(...)[0].sample.startS === 40`; `setSampleStart(db, id, 95)` → false and the stored value is unchanged; `setSampleStart(db, id, null)` → back to 28.
  - `recentSongIds`: log sets (via `logSet`) for this dance's exercises with `playerJson` `{"songId": A}`, then B, then A again, plus one with `songId: null` and one count-only set, plus a set of the other dance with song C → `[A, B]` (newest first, distinct, other dance excluded).
  - `songChoices` gives A `recentRank 0`, B `1`, others `null`; an archived recent song is absent.
  - `listSongs` gives a ready song `sample` and a waiting one `sample: null`.
- [ ] **Step 3: Run** `npx vitest run src/lib/server/songs.spec.ts src/lib/server/data.spec.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** the four functions and the `SongItem.sample` field. `songChoices` reads full rows (it needs the beats), computes `songSample`, and ranks by `recentSongIds` once.
- [ ] **Step 5: Switch the three callers** to `songChoices`. Change every `songs` prop typed `{ id: number; title: string }[]` to `PickerSong[]` (`grep -rn "songs: { id: number; title: string }" src` — `SourcePicker`, `Setup`, `PracticePanel`, `LogShell` and the kind Logs). The player route's `songs.some((s) => s.id === songId)` keeps working.
- [ ] **Step 6: Run** the specs, then `npm run check` — Expected: PASS.
- [ ] **Step 7: Commit** `git commit -m "Song samples: sample_start_s, and the picker's rows with their sample and recent rank"` (include the migration).

---

### Task 3: Searching and grouping the popup's list (pure)

**Files:**
- Create: `src/lib/fold.ts` (move `fold` here from `src/lib/routines/fit.ts`; `fit.ts` imports it and keeps exporting it so its callers do not change)
- Create: `src/lib/songs/search.ts`
- Test: `src/lib/songs/search.spec.ts`

**Interfaces:**
- Consumes: `PickerSong` (Task 2), `fold`.
- Produces:
  - `export function searchSongs(songs: PickerSong[], query: string): PickerSong[]` — matches folded `query.trim()` anywhere in folded title or artist; A to Z by title (`localeCompare`).
  - `export function groupSongs(songs: PickerSong[]): { recent: PickerSong[]; rest: PickerSong[] }` — `recent` by `recentRank` ascending; `rest` = the others A to Z.
  - `export function highlight(title: string, query: string): { before: string; match: string; after: string } | null` — the first folded match in the title, cut from the ORIGINAL title (accents kept); null for an empty query or no match in the title.

- [ ] **Step 1: Write the failing tests:** "valio" finds "Valió la pena"; "  QUIM " finds "Quimbara"; "anthony" finds a song by artist "Marc Anthony"; "(" returns [] without throwing; "   " returns every song A to Z; `groupSongs` puts ranks 1, 0 as [rank 0, rank 1] and leaves the rest A to Z; `highlight('Valió la pena', 'valio')` → `{ before: '', match: 'Valió', after: ' la pena' }`; `highlight('Idilio', 'x')` → null.
- [ ] **Step 2: Run** `npx vitest run src/lib/songs/search.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `highlight` folds per character so indexes line up with the original (fold each char, since `NFD` can change length).
- [ ] **Step 4: Run** the spec and `npx vitest run src/lib/routines` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Song samples: search and grouping for the song popup"`

---

### Task 4: The sample player, its button, and ▶ on the Songs list

**Files:**
- Create: `src/lib/songs/sample-player.svelte.ts`
- Create: `src/lib/components/songs/SampleButton.svelte`
- Modify: `src/routes/+layout.svelte` (`beforeNavigate(() => stopSample())`)
- Modify: `src/routes/[dance]/songs/+page.svelte`

**Interfaces:**
- Consumes: `SampleSong`, `SAMPLE_LENGTH_S`, `SAMPLE_FADE_S`, `sampleGain`.
- Produces:
  - `export const sampling: { id: number | null; startS: number; nonce: number }` (a `$state` object; `nonce` increments on every play so the ring restarts)
  - `export function playSample(song: SampleSong): void` — stops any sample, plays `/audio/${song.audioFile}` from `song.startS` on one lazily created module-level `HTMLAudioElement` (never the player's), fades with `sampleGain` on `requestAnimationFrame` (writing `volume` in a try/catch — iOS ignores it), stops at `SAMPLE_LENGTH_S` or at the song's end.
  - `export function stopSample(): void`
  - `SampleButton.svelte` props: `{ song: SampleSong; class?: string }`. Renders a 52 px wide button with a 32 px ring (`stroke-dasharray` animation over `SAMPLE_LENGTH_S`, keyed on `sampling.nonce`), ▶ or ■, `aria-label` "Play a sample" / "Stop the sample", `aria-pressed` while sampling. Left border `border-l border-line` so rows split it off. Respects `prefers-reduced-motion` (no ring animation).
  - Sampling rows show "Sample from {clock(startS)}" in the accent colour in place of their second line; any component can test `sampling.id === song.id`.

- [ ] **Step 1: Implement** the player module and the button (no spec: it is all DOM; keep the timing maths in `sample.ts`).
- [ ] **Step 2: Songs list:** each ready card becomes a flex row — the existing `<a>` (flex-1, min-w-0) and a `SampleButton` on the right edge. Waiting and failed cards unchanged.
- [ ] **Step 3: Root layout:** `beforeNavigate(() => stopSample())` beside `guardNavigation()`.
- [ ] **Step 4: Make test songs.** The dev DB has one bachata song. Insert four more bachata rows by hand (as CLAUDE.md describes: `status='ready'`, `dance='bachata'`, a copy of the existing `.data/audio` WAV under new names, `beats_json` evenly spaced, `duration_s`) with titles including one with an accent ("Obsesión") and one with an artist. Do it with `nix develop -c sqlite3 .data/salsa.db` in this slot only.
- [ ] **Step 5: Verify by hand** at `http://wt-5-play-music-sample.salsa.localhost/bachata/songs` (phone-width window): ▶ plays and the ring fills; ■ stops; a second ▶ stops the first; after 15 s it stops alone; tapping a card's title opens the song and stops the sample.
- [ ] **Step 6: Run** `npm run check` — Expected: PASS.
- [ ] **Step 7: Commit** `git commit -m "Song samples: the sample player, its button, and ▶ on the Songs list"`

---

### Task 5: Setting the sample on the song's page

**Files:**
- Modify: `src/routes/[dance]/songs/[id]/+page.server.ts`
- Modify: `src/routes/[dance]/songs/[id]/+page.svelte`

**Interfaces:**
- Consumes: `setSampleStart`, `songSample` (Task 2), `SampleButton`, `sampling` (Task 4).
- Produces: actions `sample` (form field `t`, the page `<audio>`'s `currentTime`; 400 "Play the song first." when not finite or `setSampleStart` refuses) and `sampleAuto` (sets null). `load` adds `sample: { song: SampleSong; custom: boolean } | null` (`custom` = `sample_start_s` is not null).

- [ ] **Step 1: Implement** the load field and the two actions; both go through `songOf(params)` like the other actions.
- [ ] **Step 2: Page:** a `<section>` after the hint paragraph under "Tap on the 1", before "Count speed", only inside the existing `{#if grid && song.audioFile}`. Heading styled like "Count speed". A bordered card: first row "From {clock(start)}" + tag (`Yours` in accent, `Automatic` neutral), second line per Global Constraints, `SampleButton` on the right. Under it, a full-width outlined accent button "Start the sample at {clock(now)}" where `now` follows the `<audio>` element's `timeupdate`/`seeked` (start at 0); the form sets `t` in `use:enhance` exactly as the tap form does. "Back to automatic" (`use:enhance`, small muted underlined button) only when `custom`.
- [ ] **Step 3: Verify by hand:** play to ~0:05, tap Start → tag becomes Yours and the start snaps to a 1; ▶ starts there; the same song's ▶ on the Songs list starts there too; Back to automatic restores the third. Tapping a new "1" that moves the grid moves the custom start's snap with it.
- [ ] **Step 4: Run** `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Song samples: set a song's sample start on its page"`

---

### Task 6: The song popup in place of the `<select>`

**Files:**
- Create: `src/lib/components/player/SongPicker.svelte`
- Modify: `src/lib/components/player/SourcePicker.svelte` (replace the `<select>` with `<SongPicker bind:songId {songs} />`)
- Modify: `src/lib/components/player/Setup.svelte` and `src/lib/components/player/PracticePanel.svelte` (call `stopSample()` first thing in their play/start functions)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (a paragraph under "Songs & player" pointing to the song-samples spec, `sample_start_s` in the data model) and `CLAUDE.md` (the spec in the list of specs; "song samples and the song popup" in **Live** once shipped is the user's call — add it to the spec list only)

**Interfaces:**
- Consumes: `PickerSong` (Task 2), `searchSongs`, `groupSongs`, `highlight` (Task 3), `SampleButton`, `sampling`, `stopSample` (Task 4), `ui/Sheet.svelte`.
- Produces: `SongPicker.svelte` props `{ songs: PickerSong[]; songId: number | null (bindable) }`.

- [ ] **Step 1: The field (closed).** A bordered row like the existing `FIELD` style: a button (flex-1) with the picked song's title, `Style · {bpm} BPM · {clock(durationS)}` under it (omit unknown parts), and a `⌄`; a `SampleButton` for the picked song on the right. The button opens the sheet. With no song picked, the button reads "Pick a song".
- [ ] **Step 2: The sheet.** `<Sheet title="Pick a song" {open} onclose={...}>`: a search `<input type="search">` with placeholder "Search songs", autofocused only when `matchMedia('(pointer: fine)').matches`; the count line; the list in a scroll box (`max-h` so the sheet fits inside `88dvh`). Empty query: "Recent" heading + `groupSongs().recent` (heading omitted when empty), then "All songs A–Z" + rest (heading omitted when there is no Recent group). Non-empty: `searchSongs` as one list, titles split by `highlight` with the match in `<mark class="bg-transparent font-bold text-accent">`. No match: the empty text and a link to `/{dance}/songs` (the dance slug comes from `page.params.dance`).
- [ ] **Step 3: Rows.** A radio-style row: dot (filled, row tinted `bg-accent/8` for the current pick), title, meta line (or "Sample from …" while sampling), `SampleButton` on the right. Tapping the row (not the ▶) sets `songId`, closes the sheet, stops the sample, clears the query.
- [ ] **Step 4: Closing** by ✕, backdrop or Escape stops the sample and clears the query; the pick does not change.
- [ ] **Step 5: Verify by hand** on `/bachata/player` (A song) and in a Today log popup's "Practise with" (bachata): search "obses" finds "Obsesión" with the letters highlighted; ▶ in a row does not change the pick; tapping a row picks and closes; the field's ▶ samples the pick; Play / the panel's ▶ stops a running sample; Recent shows songs you logged runs with (log one run with a song first).
- [ ] **Step 6: Update the docs** listed above.
- [ ] **Step 7: Run** `npm run check` — Expected: PASS.
- [ ] **Step 8: Commit** `git commit -m "Song samples: a searchable song popup with a sample on every song"`

---

### Task 7: Back closes the top sheet

**Files:**
- Create: `src/lib/sheets/stack.ts` (pure, behind a port)
- Test: `src/lib/sheets/stack.spec.ts`
- Create: `src/lib/sheets/history.svelte.ts` (wires the stack to `pushState` and `page.state.sheets`)
- Modify: `src/app.d.ts` (`PageState.sheets?: number`)
- Modify: `src/lib/components/ui/Sheet.svelte`
- Modify: `src/routes/+layout.svelte` (one `$effect` that feeds `page.state.sheets` to the stack's `sync`)
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (its port spreads the current `page.state` so `sheets` survives its pushes: `pushState('', { ...page.state, videoPlayer: d })`, same for `replaceState`)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` ("Unsaved changes": a sheet's Back asks like its ✕)

**Interfaces:**
- Produces (in `stack.ts`):
  ```ts
  export interface SheetPort { push(depth: number): void; go(delta: number): void }
  export interface SheetEntry {
  	/** Nothing unsaved: close now. Otherwise ask, and call `leave` if the user goes. */
  	tryLeave(leave: () => void): void;
  	/** Close the sheet for real (its owner's onclose). */
  	close(): void;
  }
  export class SheetStack {
  	constructor(port: SheetPort);
  	/** A sheet opened: push its entry. Returns its key. */
  	open(entry: SheetEntry): number;
  	/** ✕, backdrop or Escape on the top sheet: ask if needed, then go back one entry. */
  	requestClose(key: number): void;
  	/** The sheet closed by code (its `open` went false): drop it, and go back over its entry if that entry is still the top one. */
  	closedByOwner(key: number): void;
  	/** History now holds `depth` sheet entries (`page.state.sheets ?? 0`). */
  	sync(depth: number): void;
  }
  ```
  Semantics, all through the port: Back that lowers `depth` below the stack's length calls `tryLeave` on the top sheet; if it asks, the stack pushes its entry back at once (`port.push`), and the ask's `leave` goes back one entry and, on the next `sync`, closes it without asking again. A `sync` with `depth` greater than the stack's length (a stale entry, after a sheet closed while the page moved on) calls `port.go(length - depth)`. Moves already sent are counted like `PlayerHistory.#target`, so a double tap on ✕ never goes back twice.
- `history.svelte.ts` exports `sheetStack: SheetStack` (port: `pushState('', { ...page.state, sheets: d })`, `history.go`) and `syncSheets(): void` for the root layout.
- `Sheet.svelte`: on open → `key = sheetStack.open({ tryLeave: (leave) => leaveOrAsk(dialog, leave, 'Close'), close: onclose })`; ✕ / backdrop / Escape (`cancel`, always `preventDefault`) → `sheetStack.requestClose(key)`; `open` going false from outside → `sheetStack.closedByOwner(key)`.

- [ ] **Step 1: Write the failing tests** in `stack.spec.ts` with a fake port that records pushes and `go`s and a fake history depth:
  - "one sheet: ✕ goes back one entry, and the next sync closes it"
  - "two sheets: Back closes only the top one" (depth 2 → 1 closes the second, the first stays)
  - "Back with unsaved work re-pushes and asks" (top entry's `tryLeave` withholds `leave` → `port.push(2)` and the sheet stays; then calling `leave` → `go(-1)` and the next `sync(1)` closes it without asking)
  - "a double ✕ goes back once"
  - "closed by its owner: goes back over its own entry only if it is on top"
  - "a stale entry after the sheet is gone bounces back" (stack empty, `sync(1)` → `go(-1)`)
  - "Back from the page with no sheets does nothing" (`sync(0)` on an empty stack: no port calls)
- [ ] **Step 2: Run** `npx vitest run src/lib/sheets` — Expected: FAIL.
- [ ] **Step 3: Implement** `SheetStack`, then the wiring, `Sheet.svelte`, the layout effect, `app.d.ts` and the VideoPlayer spread.
- [ ] **Step 4: Run** the spec — Expected: PASS.
- [ ] **Step 5: Verify by hand in a desktop browser** (the browser's Back stands in for the phone's): on `/bachata` open a log popup, open the song popup inside it, Back ×3 → song popup closes, then the log popup, then the page goes back. Start a run in the log popup, stop it (a finished run is unsaved), Back → "Unsaved changes" asks; Keep → popup stays; Back again → asks again. Log a set (closes the popup) → Back goes to the previous page in one press. On a lesson page, open a video in the full-screen player, open the Link popup from it, Back → only the Link popup closes, the player keeps its level. Also: New exercise on Today, Move to… on a figure, the routine slot picker — each closes on Back.
- [ ] **Step 6: Ask the user to try it on the phone** in the Android app (Back button and gesture, same three steps) — the spec requires it; record the result in the commit or a follow-up.
- [ ] **Step 7: Update the docs** listed above, run `npm run check` — Expected: PASS.
- [ ] **Step 8: Commit** `git commit -m "Sheets: Back closes only the top popup"`
