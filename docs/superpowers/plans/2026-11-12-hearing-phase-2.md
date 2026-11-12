# Hearing drills, phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hearing drill as a fifth exercise type: made from Today's +, a song page or a
group lesson, with several hand-picked songs; on Today with an ear; its page starts the
listening player with the drill's settings; Done saves the round's score with the face.

**Architecture:** A hearing drill is a `custom` drill row with `exercises.kind = 'hearing'`
(migration 0052); `typeOf` reads the kind (an entry takes its group drill's). Settings live
under `practice_json.hearing`, songs are the drill's music (`song_links`). The listening
player is lifted into one component that plays one or several songs; a new device route
`/[dance]/hearing/[id]` runs it for a drill and hands the round back to the exercise page
through sessionStorage; Done appends the round to the day's set (`player_json.hearing.rounds`).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Drizzle/SQLite, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-hearing-drills-design.md`, "Phase 2" (points
1–16). Board: https://claude.ai/artifact/WruT4iPcQqcmEDTJnSK2BG.

## Global Constraints

- Words through `t()` in `en` and `sl` (vikanje; `slCount`); colours via token classes and builders, `swap()` in `.ts`; dates by `format.ts`; no `confirm()`.
- `exercises.kind`: additive `ADD COLUMN`, no CHECK (`drizzle-kit generate`, read the SQL); `exercises` is synced, nothing else changes for the phone (the device runs the same migrations).
- The type owns its page: `contentFor`/`practiceFor`, never `{#if type === …}` in a page.
- Group mutations `logChange` (in `MUTATIONS`), a save on a group row carries `seen`; a published lesson that gains a drill calls `autoAddPending` (already in `linkExercise`).
- Every new action in `ACTIONS` (`src/lib/offline/routes.ts`); the new route is a device page (not in `NETWORK_PAGES`).
- No `Date.now()` in `src/lib/hearing`; only songs with anchors a person set (`anchors_json` not empty) are ever played or graded.
- Face suggestion: under 50 `hard`, 50–74 `getting`, 75–89 `gotit`, 90+ `easy`. Lengths 5 / 10 / 20 drops.
- Building: per task specs + eslint + prettier on changed files; full `npm run check` (systemd-run MemoryMax=6G) before the review and after merging master.

## Review Focus

1. A class member's entry (`source = 'added'`) for a teacher's hearing drill: shows as hearing, plays the teacher's songs and settings, and a teacher's Shrani reaches it. Tests in Tasks 1 and 5.
2. The practice panel's write (`setPracticeSettings`) on a hearing drill keeps `practice_json.hearing`. Test in Task 2.
3. Two Dones on one day keep both rounds; Undo of the second brings back exactly the first. Test in Task 3.
4. A drill whose songs all lost their count or were unshared: the route answers with the reason, the page shows it instead of Začni; one uncounted of three: the round uses two. Tests in Tasks 3 and 5.
5. Leaving a group with Keep: a kept hearing drill keeps its songs (copied, links re-pointed). Test in Task 3.

---

### Task 1: The type

**Files:** `drizzle/0052_*.sql` (+ meta), `src/lib/server/db/schema.ts`, `src/lib/exercises/kinds.ts`(+spec), `src/lib/types.ts` (`ExerciseItem.kind`), `src/lib/server/exercises.ts` (`listExercises`), `src/routes/[dance]/(today)/exercises/[id]/+page.server.ts` (the group-drill `shown` literal), `src/lib/server/practice-content.ts`, `src/lib/components/exercises/kinds/index.ts`, `src/lib/exercises/tile.ts`(+spec), `src/lib/server/clones/clone.ts` (`copyDrill`), `src/routes/[dance]/player/+page.svelte`, both `exercise` catalogs, `src/lib/exercises/today.spec.ts` fixture.

**Interfaces — Produces:**
- `exercises.kind: text('kind')` nullable; `ExerciseKind = 'hearing'`; `ExerciseItem.kind: 'hearing' | null` (an entry: its drill's, `coalesce(drills.kind, exercises.kind)` in `listExercises`).
- `EXERCISE_TYPES = ['lesson','figure','drill','routine','hearing']`; `typeOf(e: { source: Source; kind?: string | null }): ExerciseType` (`kind === 'hearing'` → `'hearing'`, else by source); `typeInfo` the same argument. Every caller passes the row/item.
- `CONTENT.hearing = DrillContent`, `PRACTICE.hearing = DrillPractice` for now (Task 6 replaces Practice). `practiceContentOf` treats `'hearing'` as `'drill'` until Task 6.
- `exerciseTile({source, partner, kind})`: `kind === 'hearing'` → `{ icon: 'ear', label: t().exercise.types.hearing }`. Words: `types.hearing` en "Hearing", sl "Sluh".
- `copyDrill` copies `kind`. The player's `runKind` maps `'hearing'` to null.

- [ ] Tests: `typeOf({source:'custom', kind:'hearing'})` → `'hearing'`; `({source:'added', kind:'hearing'})` → `'hearing'`; `({source:'custom', kind:null})` → `'drill'`; tile of a hearing row has icon `ear`; `listExercises` gives an entry of a hearing group drill `kind: 'hearing'` (Review Focus 1); `copyDrill` of a hearing drill keeps `kind`. Run: FAIL.
- [ ] Add the column, `npm run db:generate`, read the SQL (one `ALTER TABLE \`exercises\` ADD \`kind\` text;`). Implement the rest. `npx svelte-check` must be clean (every `typeOf` caller updated).
- [ ] `npx vitest run src/lib/exercises src/lib/server/exercises.spec.ts src/lib/server/clones` PASS; commit `feat(hearing): the hearing drill type (exercises.kind)`.

### Task 2: Settings and rounds (pure)

**Files:** Create `src/lib/hearing/drill.ts` + `drill.spec.ts`; modify `src/lib/server/exercises.ts` (`setPracticeSettings`) + spec.

**Interfaces — Produces** (all in `drill.ts`):
- `interface HearingSettings { kind: RoundKind; target: TargetId; clave?: ClavePattern; positions?: number[]; drops: 5 | 10 | 20 }`; `HEARING_DEFAULT: HearingSettings = { kind: 'dropped', target: 'one', drops: 10 }`.
- `hearingOf(practiceJson: string | null): HearingSettings` (missing/bad → default; bad fields → their default); `withHearing(practiceJson: string | null, s: HearingSettings): string` (keeps every other key).
- `interface HearingRound { kind; target; clave?; positions?; drops: number; songIds: number[]; score: number; timing: number; count: number; restarts: number; listening: number; changed: boolean }` (`count`/`restarts`/`listening` = the losses, as `DropScore`).
- `parseRound(raw: unknown): HearingRound | null` (validates numbers 0–100, `songIds` ints, known kind/target); `appendRound(playerJson: string | null, round: HearingRound): string` (→ `{..., hearing: { rounds: [...old, round] }}`); `roundsOf(playerJson: string | null): HearingRound[]`.
- `roundsLine(rounds: HearingRound[]): { count: number; last: number | null; before: number | null; scores: number[] }` over rounds with `changed === false`, oldest first.
- `suggestFeel(score: number): Feel` (the Global ladder).
- `settingsQuery(s: HearingSettings): string` and `settingsFrom(params: URLSearchParams, base: HearingSettings): { settings: HearingSettings; changed: boolean }`.

- [ ] Tests: `hearingOf(null)` = default; `withHearing('{"count":"on","speed":1}', s)` keeps `count` and `speed`; `appendRound` twice keeps both, in order; `parseRound` refuses score 120 and a string `songIds`; `roundsLine` leaves out `changed` rounds, `last` the newest, `before` the one before; `suggestFeel` 49→hard, 50→getting, 74→getting, 75→gotit, 89→gotit, 90→easy; `settingsFrom` of `settingsQuery(x)` is `{x, changed:false}`, a different target → `changed:true`; `setPracticeSettings` on a row with a `hearing` key keeps it (Review Focus 2). Run: FAIL.
- [ ] Implement; `setPracticeSettings` writes through `withHearing(old, hearingOf(old))` only when the old had `hearing` (else as now).
- [ ] `npx vitest run src/lib/hearing/drill.spec.ts src/lib/server/exercises.spec.ts` PASS; commit `feat(hearing): a hearing drill's settings and rounds`.

### Task 3: The server — making, saving, Done, Keep

**Files:** `src/lib/server/exercises.ts` (`createCustomExercise`, `saveDay`, new `setHearingSettings`), create `src/lib/server/hearing.ts` (+spec), `src/lib/server/log-form.ts` (`saveDoneFrom`), `src/lib/server/song-links.ts` (`listMusic` → `counted`), `src/lib/server/songs.ts` (`songChoices` → `counted`), `src/lib/types.ts` (`MusicRow.counted`, `PickerSong.counted`), `src/lib/server/clones/keep.ts`, `src/routes/[dance]/(today)/+page.server.ts` (`createExercise`), `src/routes/[dance]/lessons/[id]/+page.server.ts` (`newExercise`), `src/routes/[dance]/(today)/exercises/[id]/+page.server.ts` (new `hearing` action), `src/lib/offline/routes.ts`, `src/lib/server/changes.ts` (`MUTATIONS`, if a new verb), refusal words in both catalogs.

**Interfaces:**
- Consumes Task 2's `HearingSettings`, `withHearing`, `appendRound`, `parseRound`.
- `counted(song: { anchorsJson: string | null }): boolean` in `src/lib/songs/counted.ts` (PURE; the listen route and song page switch to it).
- `createCustomExercise(db, space, input & { hearing?: { settings: HearingSettings; songIds: number[] } })`: sets `kind: 'hearing'`, `practiceJson: withHearing(null, settings)`, then `addMusic` per song in order inside the transaction; refuses (throws the `addMusic` refusal) a song that is not `counted`.
- `readHearingForm(form: FormData, dance: Dance): { settings: HearingSettings; songIds: number[] } | string | null` in `src/lib/server/hearing.ts` (null: `type` is not `hearing`; string: the refusal — no song, uncounted song). Fields: `type=hearing`, `kind`, `target`, `clave`, `positions` (comma list), `drops`, `songId` (repeated).
- `setHearingSettings(db, id: number, s: HearingSettings, by?: Actor, seen?: Record<string, string|null>)`: writes `practice_json` via `withHearing`; a group row `fieldChange` + `logChange(subject 'drill', verb 'change')` with the field `hearing`.
- `hearingSongsOf(db, viewerId: string, drillId: number): { usable: { id: number; title: string; grid: SongGrid }[]; blocked: { id: number; title: string; why: 'count' | 'shared' }[] }` in `hearing.ts`, from `listMusic`'s order.
- `SetInput.hearingRound?: HearingRound`; `saveDay` → `playerJson: appendRound(old?.playerJson ?? null, round)` when given. `saveDoneFrom` reads form `hearing` (JSON) through `parseRound`; a bad one is ignored (the face still saves).
- Exercise page action `hearing` (`ACTIONS …exercises/[id]: hearing: 'device'`): `requireExerciseAccess(…,'edit')`, the `seen` clash check, `setHearingSettings`.
- Keep: `practised` gains `select 'song', t.id from song_links l join exercises x on x.id = l.exercise_id join songs t on t.id = l.song_id where x.user_id = ? and x.team_id is null and x.kind = 'hearing' and t.team_id = ? and ready and audio_file not null`.

- [ ] Tests (`hearing.spec.ts`, `exercises.spec.ts`, `keep.spec.ts`, `log-form` spec): a person's hearing drill is made with kind, settings and two music rows in order; an uncounted song is refused and nothing is made; a teacher's lesson `newExercise` with `type=hearing` makes a group hearing drill linked to the lesson; `readHearingForm` with no song → refusal string; `setHearingSettings` on a group row logs a change; two `saveDay`s with rounds keep both, `undoSave` of the second leaves exactly the first (Review Focus 3); `hearingSongsOf` with one uncounted of three → usable 2, blocked 1 `count`; all uncounted → usable 0 (Review Focus 4); Keep on leaving keeps a hearing drill's group songs and its music points at the copies (Review Focus 5). Run: FAIL.
- [ ] Implement. `listMusic` and `songChoices` add `counted`.
- [ ] `npx vitest related` on the changed files, `npx vitest run src/lib/offline` PASS; commit `feat(hearing): make, save and keep a hearing drill`.

### Task 4: Several songs in one round

**Files:** `src/lib/hearing/drops.ts` (+spec), `src/lib/hearing/round.ts` (`FinishedDrop.song`), `src/lib/components/hearing/DropRun.svelte`, `ResultB.svelte`, create `src/lib/components/hearing/ListenPage.svelte`, `src/routes/[dance]/songs/[id]/listen/+page.svelte` (now a thin wrapper).

**Interfaces — Produces:**
- `mixStarts(songs: { grid: Grid; quiet: QuietRange[]; from: number }[], opts: { count: number; rand: () => number }): { song: number; at: number }[]`: each spot's song uniformly at random, then that song's spots from `dropStarts` (distinct within a song), the list shuffled; a song with no room drops out; `[]` when none has room.
- `interface ListenSong { id: number; title: string; grid: SongGrid }`. `ListenPage.svelte` props: `{ dance; songs: ListenSong[]; settings: HearingSettings | null; title: string; backHref: string; backLabel: string; ondone?: (round: HearingRound) => void }` — `settings` null: the setup as now (song page); given: the setup is skipped, Start runs with them (Spremeni lives on the exercise page). One hidden `<audio>` per song, mounted from the first render; the PlayerHandle of every song is made inside the Start tap; Tap along takes one random song per round.
- `DropRun` props: `rigs: { player: PlayerHandle; audio: HTMLAudioElement; grid: Grid; sections: Placed[]; beatS: number }[]` and `starts: { song: number; at: number }[]` in place of `player/audio/grid/sections/beatS/starts`; a spot uses `rigs[starts[i].song]`; the fade and pause act on the leaving spot's rig.
- `FinishedDrop.song: number` (index into `songs`); `ResultB` gets `songTitles: string[]` and a drop row reads "Mesto 3 · Casa Mía · Verse" when there is more than one song. Replay uses the drop's rig. `ListenPage` turns the result into a `HearingRound` (`roundScore`, `songIds` of the drops, `changed` from its caller) for `ondone`.

- [ ] Tests: `mixStarts` with two songs and a seeded rand gives `count` spots, each `at` inside its song, no repeat within a song; one song without room → all spots from the other; none → `[]`. Run: FAIL; implement `mixStarts`; PASS.
- [ ] Lift the page into `ListenPage`, then rigs and song titles. Scenes `listen-setup`, `listen-drop-tapping`, `listen-reveal`, `listen-result`, `listen-replay` all `ok` (one song: nothing looks different); look at `listen-result`.
- [ ] `npx vitest run src/lib/hearing`, svelte-check, eslint PASS; commit `feat(hearing): a round over several songs`.

### Task 5: The drill's listening route and the hand-back

**Files:** create `src/routes/[dance]/hearing/[id]/+page.server.ts`, `+page.svelte`, `hearing-route.spec.ts`; create `src/lib/hearing/handoff.ts` (+spec); `src/lib/exercises/clock-trip.ts` callers (the exercise page's `afterNavigate` route check).

**Interfaces:**
- Load: `requireExerciseAccess(db, locals, params, id, 'read')`; the drill = `getExercise(row.drillId)` for an entry, else the row; `settings = hearingOf(drill.practiceJson)` then `settingsFrom(url.searchParams, settings)`; songs `hearingSongsOf(db, user, drill.id)`; no usable song → `error(404, t().refusals.noHearingSongs)` (en "None of the drill's songs can be played: set their count first", sl the same in vikanje). Not a hearing drill → 404.
- Returns `{ exercise: { id, name }, settings, changed, songs: ListenSong[] }`; the page is `ListenPage` with `settings`; `ondone` → `leaveRound(sessionStorage, id, round)` then back to `/{dance}/exercises/{id}` (goBack, replace).
- `handoff.ts`: `leaveRound(store: Storage, exerciseId: number, round: HearingRound): void` and `takeRound(store: Storage, exerciseId: number): HearingRound | null` (key `salsa:hearing-round:<id>`, read once, `parseRound` on the way out).
- The exercise page counts the trip like the player's: its `afterNavigate` treats `from.route.id === '/[dance]/hearing/[id]'` as it does `'/[dance]/player'`.
- Offline (spec 16): the phone already keeps every song of the person's copy (`src/device/media.ts` `wantedMedia`), so nothing new is downloaded; no "Ni na telefonu" mark is built (ruling: every song is kept after a sync; cost if wrong: a round that will not load offline before the first media sync).

- [ ] Tests: the load for an entry of a teacher's hearing drill uses the teacher's settings and songs (Review Focus 1); `?target=every` → `changed: true`; all songs uncounted → 404 with the reason (Review Focus 4); a plain drill → 404; `takeRound` after `leaveRound` returns the round once, then null; a corrupt stored value → null. Run: FAIL; implement; PASS.
- [ ] Commit `feat(hearing): a drill's round, handed back to its page`.

### Task 6: The exercise page

**Files:** create `src/lib/components/exercises/kinds/hearing/Practice.svelte`, `src/lib/components/hearing/HearingSettingsSheet.svelte`; `kinds/index.ts` (`PRACTICE.hearing`); `src/lib/types.ts` (`PracticeContent` variant `type: 'hearing'` = the drill's fields + `hearing: { settings: HearingSettings; rounds: HearingRound[]; songs: { id: number; title: string; usable: boolean; why?: 'count' | 'shared' }[]; canSave: boolean }`); `src/lib/server/practice-content.ts`; `src/lib/components/exercises/DoneSheet.svelte`; `src/routes/[dance]/(today)/exercises/[id]/+page.svelte`; `MusicSection.svelte` (an uncounted row says `w.countFirst`); both `hearing` catalogs.

**Interfaces:**
- Practice card (board 2): ear tile, "Poslušate", `kindLine(settings)` ("Sredi skladbe · Ena · 10 mest"), the usable song titles; Spremeni opens `HearingSettingsSheet` (kind, target incl. own/clave as `ListenSetup` does, drops; ▶ Začni → `/{dance}/hearing/{id}?{settingsQuery}`; Shrani posts `?/hearing` with `seen` when `canSave`); ▶ Začni → `/{dance}/hearing/{id}`, calling `onleave` first. No usable song: the reason in place of Začni. Under it **Vaši krogi · N**: `last`, its date, and an inline SVG line of `scores` (`roundsLine`).
- Rounds for the card: from the exercise's sets' `player_json` (`roundsOf`), oldest first.
- `DoneSheet` prop `hearing?: { score: number; before: number | null; line: string; suggest: Feel } | null`: the score card on top (board 3: "Ocena 78", a `+14`/`−6` chip against `before`, the line), the suggested face ringed with a "predlog" tag, the line under the faces names it; a hidden input `hearing` carries the round JSON. Nothing is preselected.
- The page: on `afterNavigate` from the hearing route, `takeRound` → open Done with `hearing` set; the round goes in the form.

- [ ] Tests: `practiceContentOf` of a hearing drill gives settings, rounds and songs with an uncounted one `usable: false, why: 'count'`; `kindLine` words in both languages. Run: FAIL; implement; PASS.
- [ ] Scenes in `scripts/shots/ext_hearing.py`: `hearing-page` (the scene makes a hearing drill by posting Task 3.s `?/createExercise` fields with the page.s own fetch, two counted songs of the rig db), `hearing-done` (a round run, Done open). Look at both at 410×889, `--locale sl`.
- [ ] svelte-check, eslint, related specs PASS; commit `feat(hearing): the hearing drill's page and Done with the score`.

### Task 7: Making one (Today, a song page, a lesson)

**Files:** create `src/lib/components/hearing/HearingFields.svelte`; `src/lib/components/today/NewExerciseSheet.svelte`; `src/routes/[dance]/(today)/+layout.server.ts` (`songs: musicChoices(db, wall)`) and `+layout.svelte` (`?new=hearing&song=<id>` opens the sheet in Za sluh with that song); `src/routes/[dance]/lessons/[id]/+page.svelte` (the New drill sheet gets the switch; choices = the group's `musicChoices`); `src/lib/components/hearing/FindTheOneCard.svelte` (+ `Naredi vajo`, + "V vajah: <name>" link); `src/routes/[dance]/songs/[id]/+page.server.ts` (`hearingDrillsWith(db, wall, songId): { id: number; name: string }[]`, in `hearing.ts`); both catalogs.

**Interfaces:**
- `HearingFields` props `{ songs: PickerSong[]; picked: number[]; dance: Dance }`: Pesmi (picked rows with ×, "+ Dodaj pesem" → `SongPickSheet` listing `counted` songs first, uncounted greyed and not pickable with `w.countFirst`), Način, Poslušajte za (`targetsFor(dance)`), Dolžina (Dropped in only); posts the `readHearingForm` fields.
- The sheet's switch `Vaja | Za sluh` (a two-button segmented control from the kit) sets the hidden `type`; Comes back stays under both. The switch, Naredi vajo and the lesson's switch show where New drill shows (`levelShown`, spec 10).

- [ ] Scenes: `hearing-new` (Today's + → Za sluh → two songs → Dodaj vajo → lands on the page), `hearing-from-song` (song page card → Naredi vajo → the sheet with the song picked). Both `ok`; look at them in sl.
- [ ] svelte-check, eslint, `no-english.spec.ts`, related specs PASS; commit `feat(hearing): make a hearing drill from Today, a song or a lesson`.

### Task 8: Today's row and the AI connector

**Files:** `src/lib/server/exercises.ts` (`listExercises` adds `hearing: { last: number | null; songs: number } | null` from the newest set's `player_json` and the drill's music count), `src/lib/types.ts`, `src/lib/exercises/today.ts` (`rowMeta`) + spec, `src/lib/server/mcp/read.ts` (a drill's view gains `kind` and `hearing` settings when hearing), its spec; `docs/features.md`, `docs/layout.md`.

- [ ] Tests: `rowMeta` of a hearing row with a round → parts "Zadnjič 64", "3 pesmi"; without → "Nova" as now; `get_drill` of a hearing drill shows `kind: 'hearing'` and its settings; `propose` leaves `practice_json.hearing` alone. Run: FAIL; implement; PASS.
- [ ] Docs: features.md (hearing drill live), layout.md (new modules: `hearing/drill.ts`, `handoff.ts`, `songs/counted.ts`, `server/hearing.ts`, the route).
- [ ] Commit `feat(hearing): Today's row, the connector, docs`.

### Task 9: Check, review, merge, deploy

- [ ] Full `npm run check` (MemoryMax=6G); fresh review of the whole branch with this plan's Review Focus; one fix pass; merge master in, full check again; ff-merge; `nix develop -c ./scripts/deploy.sh --skip-build` after the build; report "live now".
