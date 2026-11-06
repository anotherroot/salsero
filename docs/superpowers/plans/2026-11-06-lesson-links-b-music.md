# Lesson links, part B — Music with notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lesson, a drill and a routine hold a Music list — songs, each with an optional note — that members see and practise to, and that copies, Keep, Compare/Take/Send, History and the integrity checks all know about.

**Architecture:** One new table, `song_links`, with one data module (`src/lib/server/song-links.ts`) that every page, copy path and check goes through. The parent's owner and dance come through the parent. The UI is one shared list component (option 6C) with a detail sheet, a note sheet (7A) and a pick-a-song sheet extracted from `SongPicker`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Drizzle on SQLite (migration 0031), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-lesson-links-and-music-design.md` (Part B). Read it and the repo's `CLAUDE.md` first. Plan A (`2026-11-06-lesson-links-a.md`) lands before this one: its "+ Add" heading button (`labelRow`, `ADD_LABEL`) is reused here.

## Global Constraints

- New table only; **no CHECK** (put "exactly one parent" in the data function), additive migration. Read the generated SQL before committing.
- Data functions take `db` first; specs on `openDb(':memory:')`; never `$DATA_DIR`.
- Every group mutation logs in its transaction: `logChange(tx, space, { rootKind, rootId, verb, subject: 'song', subjectId: songId, after | before: { name: songTitle } }, now)` — rootKind `'lesson' | 'routine' | 'drill'`, verbs `add` / `remove` / `change` (a note). Never subject `'note'` (History reads it as a slot's note). Each new mutation goes into `MUTATIONS` in `src/lib/server/changes.spec.ts`.
- A note save on a group's row carries `seen` covering the note (`seenRefusal`).
- A song link never copies audio. Never call `m.ref('song', …)` (it nest-clones the song).
- Song rules: a group's row takes only its group's songs (ready, live; a draft is shared by the add, in the same transaction, `shareSong`); a person's row takes their own songs or a group's shared song of a group they are a member of (`songChoices` membership). Only `status = 'ready'` songs.
- A member sees a link only while `songAccess(db, userId, song) !== null`; an editor sees an unshared or archived group song marked "Not shared" with "Practise to this" disabled.
- Note: up to 500 characters, trimmed, empty → null. Order: `sort_order` = order added.
- Words: "Music"; "Add a song" (aria); "Note", "(optional)", "What to practise to it", "Members see it under the song.", "Add to Music", "Save"; "Practise to this"; "Edit note", "Remove"; "Not shared"; "Pick a song".
- A form someone fills in (the note) is `use:guarded`; Remove is one tap, `use:enhance`, focus to the next row (`focusAfterRemoval`).
- Raise `PAGE_EPOCH` only if an existing action's fields change (none should).
- `npm run check` passes at the end of every task.

## Review Focus

1. A group song unshared after it was added: members' Music hides it, the link stays; Share again brings it back with its note. Editors see "Not shared".
2. A person leaves a group without keeping a song their own lesson's Music points at: the link is deleted with the practice songs Keep clears; a kept song's links are re-pointed to the copy.
3. The same song added twice to one row: refused ("Already in Music"), not a second row.
4. A member's drill page (their entry of a group drill): reads the drill's Music; offers no "+ Add" and no Edit/Remove.
5. Copying a group lesson into a person's app: links to the group's shared songs stay pointing at them (the person can play them); a song of a group the person is not in is dropped, not copied.

---

### Task 1: The table and its data module

**Files:**
- Modify: `src/lib/server/db/schema.ts` (new `songLinks` after `links` ~:1031); generated `drizzle/0031_*.sql` (`npm run db:generate`)
- Create: `src/lib/server/song-links.ts`
- Modify: `src/lib/types.ts` (`MusicParent`, `MusicRow`)
- Test: `src/lib/server/song-links.spec.ts`

**Interfaces:**
- Schema `song_links`: `id` pk autoIncrement; `song_id` notNull → `songs.id`; `lesson_id` → `lessons.id`, `exercise_id` → `exercises.id`, `routine_id` → `routines.id` (all nullable); `note` text; `sort_order` integer notNull; `created_at` (`createdAt()`). Indexes `song_links_song_idx (song_id)`, and unique `(lesson_id, song_id)`, `(exercise_id, song_id)`, `(routine_id, song_id)`.
- `type MusicParent = { lessonId: number } | { exerciseId: number } | { routineId: number }` (types.ts).
- `interface MusicRow { id: number; songId: number; title: string; artist: string | null; bpm: number | null; durationS: number | null; sample: SampleSong; note: string | null; shared: boolean }` (types.ts) — `shared` false for a group song now unshared or archived (only editors ever receive such a row).
- In `song-links.ts`:
  - `listMusic(db: Db, parent: MusicParent, viewerId: string): MusicRow[]` — by `sort_order`; rows whose song the viewer cannot read (`songAccess` null) left out; songs not ready left out.
  - `musicChoices(db: Db, space: Space): PickerSong[]` — a person: `songChoices(db, wall)`; a group: the group's ready, live songs, drafts included.
  - `addMusic(db: Db, space: Space, parent: MusicParent, songId: number, note: string | null, now: number): { ok: true; id: number } | { ok: false; message: string }` — checks the parent is in `space` (a drill: `source = 'custom'`, never an entry), the song is allowed (Global Constraints), not already there ("Already in Music"); shares a group draft; inserts with `sort_order = max + 1`; logs.
  - `setMusicNote(db: Db, space: Space, linkId: number, note: string | null, now: number): boolean` — logs `change`.
  - `removeMusic(db: Db, space: Space, linkId: number, now: number): boolean` — hard delete, logs `remove`, no trash.
  - `musicNote(raw: FormDataEntryValue | null): string | null | undefined` — trim, '' → null, over 500 → undefined (refused).
  - `musicSeen(link: { note: string | null }): Seen` (or added in `clash.ts` beside `routineSeen`).

- [ ] **Step 1: Write the failing tests** (`song-links.spec.ts`, `src/lib/server/test-walls.ts` walls, `createTeam`/`joinTeam`/`setRole`):
  - `it('adds a song with its note to a lesson, a drill and a routine')` — three parents, `listMusic` shows each with the note.
  - `it('keeps the order added')`.
  - `it('refuses the same song twice')` → `{ ok: false, message: 'Already in Music' }`.
  - `it('refuses another person's song')`, `it('refuses a song that is not ready')`, `it('refuses a figure's exercise and an entry as a parent')`.
  - `it('a person's row takes a shared song of their group')`; `it('a group's row takes only its group's songs')`.
  - `it('adding a group draft shares it')` — `songs.shared_at` set, a `share` History line and the `add` line.
  - `it('hides an unshared song from members, keeps the link, shows it again when shared')`; editors get it with `shared: false`.
  - `it('changes a note and removes a row, logged in a group')`.
  - `musicNote`: `'  x '` → `'x'`, `''` → null, 501 chars → undefined.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/server/song-links.spec.ts`.
- [ ] **Step 3: Implement** the schema, `npm run db:generate`, read the SQL (a `CREATE TABLE` and indexes only), then the module.
- [ ] **Step 4: Run, expect PASS.** Add `addMusic`, `setMusicNote`, `removeMusic` to `MUTATIONS` (root lesson, verb add/change/remove) and run `npx vitest run src/lib/server/changes.spec.ts`.
- [ ] **Step 5: Commit** — `feat(music): song links with notes`.

### Task 2: Integrity, and what Keep and the purge do

**Files:**
- Modify: `src/lib/server/integrity.ts` (a song arm in `crossRefs`), `src/lib/server/clones/keep.ts` (~:380-390), `src/lib/server/clones/repoint.ts` (`find` ~:311, apply ~:745), `src/lib/server/team-purge.ts` (whatever clears a purged group's songs from members' exercises)
- Test: `src/lib/server/integrity.spec.ts`, `src/lib/server/clones/keep.spec.ts`, `src/lib/server/clones/repoint.spec.ts`

**Interfaces:**
- `crossRefs` reports a song link whose parent is a group's and whose song is not that group's, or whose parent is a person's and whose song is another person's, or a group's song of a group the person is not a member of (shared or not).
- `Found.songLinks: number[]` in repoint; moved with `songPicks` (same option).

- [ ] **Step 1: Write the failing tests:**
  - integrity: a hand-inserted bad row (a group lesson → another group's song) is reported; a person's lesson → their group's unshared song is **not** reported.
  - keep: u1 leaves keeping song S, not T; u1's own lesson links both → S's link now points at the kept copy, T's link is deleted.
  - repoint: `repoint(…, 'song', from, to, …)` moves `song_links.song_id` for the person's own parents only.
  - purge: a group purged → members' own song links to its songs that nobody kept are gone; `crossRefs` is `[]` after.
- [ ] **Step 2: Run, expect FAIL; Step 3: implement; Step 4: run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(music): integrity, Keep and the purge know song links`.

### Task 3: Copies carry Music

**Files:**
- Modify: `src/lib/server/clones/clone.ts` (`copyLesson` ~:1252, `copyDrill` ~:1040, `copyRoutine` ~:1147), `src/lib/server/clones/move.ts` (snapshot ~:117 and re-insert ~:319-335)
- Test: `src/lib/server/clones/clone.spec.ts`, `src/lib/server/clones/move.spec.ts`

**Interfaces:**
- `songInPlace(db: Db, songId: number, place: Space, readerId: string | null): number | null` in `song-links.ts` — the song itself when it is in `place`; else `memberIn(db, 'song', gene, place)` when the song has a gene and a live member there; else, for a person's place, the same song when `songAccess(db, readerId, song)` reads it; else null. Never clones.
- Each copier, after inserting the new parent, inserts its source's song links (same note, same order) whose `songInPlace` is non-null.

- [ ] **Step 1: Write the failing tests:**
  - Copy to… a person's lesson into a group they edit, its song has a member in the group (Copy to… copied it before) → the copy links the group's member.
  - Make it mine on a group lesson → the person's copy links the group's shared song itself; a song of another group the person left → dropped.
  - Move to… a group → the moved lesson's links are carried as the copy rule says.
  - No new `songs` row and no new audio file in any of them.
- [ ] **Step 2–4: FAIL, implement, PASS.**
- [ ] **Step 5: Commit** — `feat(music): copies carry Music without copying songs`.

### Task 4: Compare, Take and Send

**Files:**
- Modify: `src/lib/clones/flat.ts` (`SET_PREFIXES` ~:68, `SET_LABELS` ~:71: `song: 'Song'`), `src/lib/server/clones/trees.ts` (`lessonFlat` ~:373, `drillFlat` ~:282, `routineFlat` ~:328), `src/lib/server/clones/apply.ts` (`HAND_KINDS` ~:873, `REF_TABLES` ~:964, `currentKey` ~:995, `addHandLink`/`removeHandLink` and their lesson-only guard), `src/lib/server/clones/clone.ts` (`refKey` ~:664 prefixes)
- Test: `src/lib/server/clones/apply.spec.ts`, `src/lib/clones/flat.spec.ts`

**Interfaces:**
- Flat key `song:<ref>` (`ref = gene ?? '#'+id`), value `'1'`, label the song's title — presence only. A changed note is not compared (decided while planning: the hand-link machinery has no value changes; the spec is updated to say so).
- Take/Send add a missing song through `songInPlace` (an unreachable one is left out, its key not offered) and remove one by deleting its link; for lessons, drills and routines.

- [ ] **Step 1: Write the failing tests:** a group lesson gains a song → the person's copy's Compare shows "Song · Casa Mía" as theirs-only; Take adds the link (with the group's note); Send from the copy removes one in the group; a routine and a drill the same once each.
- [ ] **Step 2–4: FAIL, implement, PASS.**
- [ ] **Step 5: Commit** — `feat(music): Compare, Take and Send know Music`.

### Task 5: The song pick sheet and the practice popup's "Music first"

**Files:**
- Create: `src/lib/components/songs/SongPickSheet.svelte`
- Modify: `src/lib/components/player/SongPicker.svelte` (uses the new sheet), `src/lib/songs/search.ts` (`songSections`), `src/lib/components/player/SourcePicker.svelte`, `src/lib/server/popup.ts` (`popupData` adds the parent's Music ids)
- Test: `src/lib/songs/search.spec.ts`, the popup's spec if one covers `popupData`

**Interfaces:**
- `SongPickSheet` props `{ open: boolean; onclose: () => void; songs: PickerSong[]; onpick: (song: PickerSong) => void; picked?: number | null; first?: { label: string; ids: number[] } | null; title?: string }` — the current "Pick a song" sheet body (search, sections, ▶ on every row, count line, empty state), moved out of `SongPicker` unchanged in look; `SongPicker` keeps its field and opens this sheet.
- `songSections(songs, first?: { label: string; ids: number[] })` — with `first`, a leading section `{ kind: 'first', label, songs }` holding those songs in the given order, the rest unchanged (a song may show in both).
- `popupData(...)` returns `music: { label: string; ids: number[] } | null` — for a drill (or an entry of one) and a routine's exercise, its Music ids in order, label the row's name; `SourcePicker` passes it to the sheet as `first`.

- [ ] **Step 1: Write the failing tests** — `songSections(songs, { label: 'Warmup', ids: [3, 1] })` starts with that section in that order; without `first`, unchanged (existing tests stay green).
- [ ] **Step 2–4: FAIL, implement, PASS.**
- [ ] **Step 5: Check by eye** — the player's song card and a drill's practice popup look exactly as before (shots `ext_practice.py` scenes, light and dark).
- [ ] **Step 6: Commit** — `refactor(songs): a pick-a-song sheet of its own; Music first in practice`.

### Task 6: The Music list on the lesson, drill and routine pages

**Files:**
- Create: `src/lib/components/songs/MusicSection.svelte` (heading, list, detail sheet, note sheet, pick sheet)
- Create: `src/lib/songs/music.ts` (PURE: hrefs and words)
- Modify: the three pages' `+page.server.ts` (load `music`, `musicChoices` for editors; actions `addSong`, `noteSong`, `removeSong`) and `+page.svelte` (place the section)
  - `src/routes/[dance]/lessons/[id]/` — in the "what it teaches" column after Positions
  - `src/routes/[dance]/(moves)/routines/[id]/` — between Slots and More (~:960)
  - `src/routes/[dance]/(today)/exercises/[id]/` — between Settings and History; an entry (`source = 'added'`) reads its drill's (`drillId`) Music, read-only
- Test: `src/lib/songs/music.spec.ts`; action specs beside each page's existing form spec (mocked `getDb`)

**Interfaces:**
- `practiseHref(dance: string, at: { routineId: number; entryId: number | null } | { drillEntryId: number } | { lesson: true }, songId: number): string` in `music.ts` → `/{dance}/player?routine=R&exercise=E&song=S`, `/{dance}/player?exercise=E&song=S`, `/{dance}/player?song=S`.
- `MUSIC = { heading: 'Music', add: 'Add a song', noteLabel: 'Note', notePlaceholder: 'What to practise to it', noteHelp: 'Members see it under the song.', addButton: 'Add to Music', save: 'Save', practise: 'Practise to this', edit: 'Edit note', remove: 'Remove', notShared: 'Not shared', pick: 'Pick a song' }`.
- Actions (all three pages): `addSong` (`songId`, `note`) → `{ action: 'addSong', ok: true }` | `fail(400, { action: 'addSong', field?: 'note', message, note })`; `noteSong` (`linkId`, `note`, `seen` on a group's row) → ok | `fail(400 …)` | the clash refusal; `removeSong` (`linkId`) → ok | `fail(404, { action: 'removeSong', message: 'That song was already removed.' })`.
- `MusicSection` props `{ heading: string; rows: MusicRow[]; canEdit: boolean; choices: PickerSong[]; practise: (songId: number) => string | null; actionBase?: string; seenOf?: (row: MusicRow) => string }`.

- [ ] **Step 1: Write the failing tests:**
  - `practiseHref` for the three cases.
  - Per page: `addSong` adds; a note over 500 → field `note`; a member's post → 404 (the page's existing access guard); `removeSong` twice → 404 the second time; a group routine's `noteSong` without `seen` → the `MISSING_SEEN` refusal.
- [ ] **Step 2–4: FAIL, implement, PASS.**
- [ ] **Step 5: The look** (6C, 7A): the heading row is Plan A's `labelRow` look ("Music · N", "+ Add" for an editor). A grouped card (`GROUP`), one row per song: title (16/700), under it — only with a note — the `note` icon 16 px and the note's first line, muted, ellipsis; at the right a `SampleButton`. The row's text is a button opening the detail sheet: title the song, the whole note (`LinkedText`), "Practise to this" (`button('primary','md',true)`, an `<a>` to `practise(songId)`; disabled with "Not shared" when `!row.shared`), and for an editor "Edit note" and "Remove" (`danger-text`). "+ Add" opens `SongPickSheet` (`songs = choices`), a pick opens the note sheet (title the song, Note textarea maxlength 500, helper, footer "Add to Music"); Edit note opens it with the note and "Save". With no rows and no edit the section is not drawn.
- [ ] **Step 6: Check by eye** — lesson 29, routine 14, drill 2 (and a member's view: `--group` on the backup copy) at 390×844 light and dark, against mockup 6C/7A; desktop `--viewport` 1440×900 once.
- [ ] **Step 7: `npm run check`, then commit** — `feat(music): Music on lessons, drills and routines`.

### Task 7: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-11-03-groups-follow-ups-design.md` (a dated note: class songs can also be suggested on lessons, drills and routines), `CLAUDE.md` (Layout: `song-links.ts`, `songs/music.ts`, `SongPickSheet`, `MusicSection`; Hard rules: `song_links` is a hard delete of bookkeeping, a song link never copies audio)

- [ ] **Step 1:** Write them. **Step 2:** `npm run check`. **Step 3: Commit** — `docs: Music with notes`.
