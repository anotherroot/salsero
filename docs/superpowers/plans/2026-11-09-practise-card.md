# Practise Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Practise card (Change + ▶ Practise) on every exercise type, lesson included. Setup's changes show on the card after Back. A lesson has an About in the player. A video played with sound in About pauses the music.

**Architecture:**
- `PractiseCard` becomes the one card. The lesson joins the `PRACTICE` registry, and the routine's own button goes.
- The player flushes its practice saver before navigation and refreshes the page it lands on.
- `exerciseDetails` gains a lesson branch: `RunDetails.figures` and clip kind `'lesson'`.
- A small shared rune module, `video-sound.svelte.ts`, says which video holds the sound. `Running` and `Setup` react to it: Running pauses the run, Setup stops the song sample.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Drizzle/SQLite, Vitest (`svelte/server` render for components), the shots rig (Playwright).

**Spec:** `docs/superpowers/specs/2026-11-09-practise-card-design.md`

## Global Constraints

- Words go through `t()`, in both catalogs.
  - en: "Practise with", "Change", "Practise", "Music paused", "Resume".
  - sl: »Vadi ob«, »Spremeni«, »Vadi«, »Glasba je na premoru«, »Nadaljuj«.
  - Reuse `exercise.panel.practiseWith` and `exercise.panel.resume`.
- The type owns its page. Lesson gets `kinds/lesson/Practice.svelte` in `PRACTICE`, and no page branches on the type.
- Reach: a group lesson's About shows only what the reader reaches. Do as `contentOf` does in `practice-content.ts` (`seenBy` / `judgeLesson`, `visible.variations`).
- No migration, no new table, no `PAGE_EPOCH` bump.
- Components never import `$lib/server`. Shared shapes live in `src/lib/types.ts`.
- A built control's colour is the builder's. Use `button('primary', 'md', true)` for ▶ Practise, and never append `text-*` to a builder's class.
- The player's Pause is `player.pause()` / `player.resume()`, the same calls `togglePause` makes. There is no other path.
- After each task:
  - run its specs plus `npx eslint` and `npx prettier --check` on the changed files;
  - Vitest with `--maxWorkers=4`;
  - commit.
- The full `npm run check` runs only in Task 5.

## Review Focus

1. **A reader of a group lesson.** About lists only the figures and videos the reader reaches. A draft's are never shown (Task 3 test).
2. **Back with nothing changed.** No POST and no page refresh: `flush()` resolves `false` (Task 2 test).
3. **Two videos in one layer.** Tapping the second takes the sound from the first, and only one has sound (Task 4 test on the module).
4. **The music was already paused by the person when a video claims the sound.** Resume then resumes once and does not double-toggle. Releasing the video does not start the music (Task 4 test).
5. **A routine with no exercise.** The routine page's Practise still opens the player, and nothing is created (Task 1 test).

---

### Task 1: One card on every exercise type

**Files:**
- Modify: `src/lib/components/exercises/PractiseCard.svelte` (the layout per spec "The card")
- Modify: `src/lib/exercises/practice.ts`
  - `practiceSummary`: optional `view` part.
  - `practiseWithLine`: optional `view` parameter.
- Modify: `src/lib/components/exercises/kinds/routine/Practice.svelte` (renders `PractiseCard` with the view)
- Create: `src/lib/components/exercises/kinds/lesson/Practice.svelte` (as drill's)
- Modify: `src/lib/components/exercises/kinds/index.ts` (`lesson: LessonPractice`; update the doc comments that say a lesson has none)
- Modify: `src/lib/components/exercises/kinds/lesson/Content.svelte` (destructure `practice`; `{@render practice?.()}` after the notes, before the figures)
- Modify: `src/routes/[dance]/(moves)/routines/[id]/+page.svelte:353-357` (`practiseHref`)
- Modify: `src/lib/i18n/en/exercise.ts`, `src/lib/i18n/sl/exercise.ts`
  - Add `panel.change` and `panel.practise`.
  - Remove `content.practiseInPlayer` and `content.routineNote` once nothing reads them.
- Test: `src/lib/exercises/practice.spec.ts`, new `src/lib/components/exercises/practise-card.spec.ts`

**Interfaces:**
- Produces:
  - `practiceSummary(p: { mode; bpm; songTitle; config; view?: string | null }, dance): string`. The view comes after the song or count part: "BAILE · Follow · no count".
  - `practiseWithLine(row, songs, phone, dance, view?: string | null): string`.
  - `PractiseCard` props gain `view?: 'follow' | 'still' | null`. The routine passes `loadRoutineView(dance.slug, content.routine.id)`, read in `onMount` like the phone memory. The card turns it into `t().player.follow` / `t().player.still`.

- [ ] **Step 1: Write failing tests.**
  - In `practice.spec.ts`:
    - `practiceSummary` with `view: 'Follow'`, a song "BAILE" and count off gives `'BAILE · Follow · no count'`, using the en catalog's `summaryNoCount` text.
    - Without `view`, the output is unchanged.
  - `practise-card.spec.ts`, rendered with `svelte/server`:
    - the HTML holds one link whose href ends `&from=exercise` (the Change link, `play` false) with the text "Change";
    - it holds one link whose href ends `&play=1` with the text "Practise";
    - it has no element with the class from `PLAY_ROUND`.
- [ ] **Step 2: Run** `npx vitest run src/lib/exercises/practice.spec.ts src/lib/components/exercises/practise-card.spec.ts --maxWorkers=4`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - The card's markup, per the spec:
    - the row: round music icon tile, "Practise with" label, the line, and the Change pill at the right (a link, `sliders` icon if the kit has one, else `settings`);
    - below the row, the full-width primary ▶ Practise link.
  - Both links keep `onclick={onleave}`.
  - Routine `Practice.svelte`: drop the button and the note, and render `PractiseCard`.
  - Routine page `practiseHref`:
    - `data.exerciseId === null`: the player as today;
    - otherwise `resolve('/[dance]/(today)/exercises/[id]', { dance, id })`.
- [ ] **Step 4: Run the Step 2 command.** Expect PASS. Also run `npx vitest run src/lib/i18n src/lib/components/exercises src/routes/[dance]/no-english.spec.ts --maxWorkers=4` (or wherever `no-english.spec.ts` lives: `grep -rl no-english src`).
- [ ] **Step 5: Commit:** `feat(exercise): one Practise card on every exercise, lesson included`.

### Task 2: A Setup change shows on the card after Back

**Files:**
- Modify: `src/lib/offline/background-write.ts`. `backgroundWrite(url, init): Promise<void>` resolves when the fetch settles and never rejects. Offline, it resolves at once.
- Modify: `src/lib/exercises/practice-api.ts`
  - `Post` returns `Promise<void>`.
  - `flush(): Promise<boolean>`: true when something was posted, resolving after the POST settles; false at once when nothing waited.
- Modify: `src/routes/[dance]/player/+page.svelte` (the saver effect, about lines 59-68)
- Test: `src/lib/exercises/practice-api.spec.ts`

**Interfaces:**
- Produces: `PracticeSaver.flush(): Promise<boolean>`. Callers that ignore the result stay as they are (`void`).

- [ ] **Step 1: Write failing tests** in `practice-api.spec.ts`, with a fake `post` that returns a deferred promise:
  - `flush()` after `change(...)` resolves `true` only after the post's promise resolves;
  - `flush()` with nothing waiting resolves `false` and calls `post` zero times.
- [ ] **Step 2: Run** `npx vitest run src/lib/exercises/practice-api.spec.ts --maxWorkers=4`. Expect FAIL.
- [ ] **Step 3: Implement.** In the player page, add `beforeNavigate(() => { const s = saver; if (s) void s.flush().then((posted) => { if (posted) void invalidateAll(); }); })`.
  - `invalidateAll` runs after the POST lands, so the exercise page loads the new practice.
  - Keep the `pagehide` and teardown flushes.
- [ ] **Step 4: Run the Step 2 command, plus** `npx vitest related src/lib/offline/background-write.ts --run --maxWorkers=4`. Expect PASS.
- [ ] **Step 5: Commit:** `fix(player): a change made in Setup shows on the card after Back`.

### Task 3: A lesson's About

**Files:**
- Modify: `src/lib/types.ts`
  - `RunClip.kind` adds `'lesson'`.
  - `RunDetails` adds `figures: { name: string; details: RunDetails | null }[]` (required; `[]` for all others).
  - Update the doc comments.
- Modify: `src/lib/server/practice-content.ts`. Export `contentOf` as `practiceContentOf(db, exercise): PracticeContent` (rename at its call site).
- Modify: `src/lib/server/run-details.ts`
  - `exerciseDetails` gets a lesson branch built from `practiceContentOf`:
    - notes: `content.lesson.notes` trimmed;
    - clips: each video as `{ kind: 'lesson', src: '/lesson-videos/' + file, startMs: 0, endMs: null, caption: lessonVideoCaption(i, video) }`;
    - links: the lesson's links;
    - figures: `content.figures` mapped to `{ name, details: figureDetails(db, wall.userId, ids)[id] ?? null }`, keeping only details that `hasDetails`;
    - heading: the exercise's name.
  - Every other branch and `slotDetails` set `figures: []`.
- Modify: `src/lib/player/view.ts`
  - `hasDetails` also counts `figures.length`.
  - `aboutPreview` adds `aboutFigures(n)` and `aboutVideos(n)` parts, after notes and before sections.
- Modify: `src/lib/i18n/en/player.ts`, `sl/player.ts`: `aboutFigures(n)` and `aboutVideos(n)`. sl uses `slCount` like `aboutLinks`: »3 figure«, »2 videa«.
- Modify: `src/lib/components/player/DetailsBody.svelte`
  - Figures as chips (`button`s) after the notes. A chip with `details: null` is a plain `span`.
  - A tapped chip shows that figure's `DetailsBody` in place, with a back row at the top naming the lesson (`back` icon + the lesson heading). Local `$state` index.
- Modify: `src/lib/components/player/RunClip.svelte`. A `'lesson'` clip does not autoplay or loop. It shows a dark tile with a ▶ button and the caption (sound behaviour comes in Task 4).
- Test: `src/lib/server/run-details.spec.ts` (create it if missing; db setup like other server specs, `openDb(':memory:')`), `src/lib/player/view.spec.ts`

**Interfaces:**
- Consumes: `figureDetails(db, userId, ids)`, `practiceContentOf`, `lessonVideoCaption` from `$lib/video/caption`.
- Produces: `RunDetails.figures`, `RunClip.kind === 'lesson'`. Task 4 relies on these.

- [ ] **Step 1: Write failing tests.**
  - `run-details.spec.ts`:
    - an own lesson exercise with notes, two figures (one with notes) and a link gives `details.figures.length === 2`, the noted one with non-null `details`, and `links.length === 1`;
    - Review Focus 1: a reader of a group lesson whose second figure is in a draft lesson only gets `figures` without it.
  - `view.spec.ts`:
    - `hasDetails` is true for a details with only `figures`;
    - `aboutPreview` of notes + 3 figures + 2 lesson clips gives `'Notes · 3 figures · 2 videos'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/run-details.spec.ts src/lib/player/view.spec.ts --maxWorkers=4`. Expect FAIL.
- [ ] **Step 3: Implement as listed above.** Then `npx svelte-check --threshold error` limited to the touched files, or `npx tsc --noEmit -p .` if quicker: every `RunDetails` literal now needs `figures`.
- [ ] **Step 4: Run the Step 2 command, plus** `npx vitest related src/lib/server/run-details.ts src/lib/player/view.ts --run --maxWorkers=4`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(player): a lesson's About: its notes, figures, videos and links`.

### Task 4: A video with sound pauses the music

**Files:**
- Create: `src/lib/player/video-sound.svelte.ts`
- Modify: `RunClip.svelte`, `DetailsBody.svelte`, `Running.svelte`, `Setup.svelte` (all in `src/lib/components/player/`)
- Modify: `src/lib/components/links/YouTubeCard.svelte`
  - `playing = $bindable(false)`;
  - `onplay?: () => void`, called when the thumbnail is tapped.
- Modify: catalogs, `player.musicPaused` (en "Music paused", sl »Glasba je na premoru«)
- Test: `src/lib/player/video-sound.spec.ts`

**Interfaces:**
- Produces, in `video-sound.svelte.ts`:
  - `export const videoSound = $state<{ key: string | null }>({ key: null })`;
  - `claimSound(key: string): void` sets the key; the previous holder sees it is no longer theirs;
  - `releaseSound(key: string): void` clears it only if `key` holds it.
- `DetailsBody` gains `resume?: () => void`. When it is given and the music is paused for a video, the strip shows at the top: "Music paused" with a Resume button.
  - `Running` passes `musicPausedForVideo` and `resume`.
  - `Setup` passes neither.
- Each clip's key: `${src}#${startMs}`. A YouTube card's key: `yt:${id}`.

- [ ] **Step 1: Write failing tests** in `video-sound.spec.ts`:
  - claim `a`, then claim `b`: key is `b`;
  - `releaseSound('a')` while `b` holds: key stays `b`;
  - `releaseSound('b')`: key is `null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/player/video-sound.spec.ts --maxWorkers=4`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - **RunClip**
    - A tap (the figure becomes a `button`-wrapped video, or a button over it) claims the sound, sets `muted = false`, `currentTime = startS` and plays.
    - When `videoSound.key !== own key`, it returns to `muted` and loops (section or recording) or pauses back to the poster (lesson).
    - `onended` on a sounding clip releases the sound. A section or recording goes back to its muted loop; a lesson clip goes back to its poster.
    - On destroy it releases.
  - **DetailsBody**
    - YouTube links render as `YouTubeCard` with `bind:playing` and `onplay` → `claimSound('yt:'+id)`. Use `parseLink`; other links stay rows.
    - When the key moves away from a card, set `playing = false`.
  - **Running**
    - `$effect`: when `videoSound.key` turns non-null and the run is not paused, call `player.pause()` and set `paused = true` and `pausedForVideo = true`.
    - `togglePause` when paused: `releaseSound(videoSound.key ?? '')`, then resume, as today; it also clears `pausedForVideo`.
    - A release alone never resumes (Review Focus 4).
    - Pass `resume={togglePause}` and `pausedForVideo` to each `DetailsBody`, in the About layer and the routine slot layer.
  - **Setup**
    - `$effect`: a non-null `videoSound.key` calls `stopSample()`.
    - `$effect` on `sampling.id`: when it turns non-null, `releaseSound(videoSound.key ?? '')`.
- [ ] **Step 4: Run the Step 2 command, plus** `npx vitest run src/lib/components/player src/lib/components/links --maxWorkers=4`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(player): a video with sound in About pauses the music`.

### Task 5: Docs, shots, full check

**Files:**
- Modify: `docs/layout.md`
  - `video-sound.svelte.ts`;
  - `practiceContentOf`;
  - `RunDetails.figures`.
- Modify: `docs/features.md`: the Practise card and the lesson's About, with a link to the spec.
- Modify: `docs/superpowers/specs/2026-11-08-one-player-design.md`
  - "Getting there": the card is the same on every type, lesson included.
  - "What the details hold": a lesson.
- Create: `scripts/shots/ext_practise_card.py`. Scenes, on a db copy (never `.data`):
  - `card-drill`, `card-figure`, `card-routine`, `card-lesson`: the exercise page of each type's first live exercise, with placeholders that query `exercises.source` and `lesson_id` / `routine_id`;
  - `about-lesson`: the player for a lesson exercise, About opened from Setup;
  - `about-paused`: a figure exercise with a count, Play, About, tap the first clip.
- [ ] **Step 1: Shoot.**
  - Copy the latest `~/Backups/salsa/db/salsa-*.db` to the scratchpad.
  - Run `scripts/shots/shots.sh <copy> <out> 390x844 --locale sl --scenes card-drill,card-figure,card-routine,card-lesson,about-lesson,about-paused`.
  - Look at every shot. Each must match the mockup's option A and the spec.
- [ ] **Step 2: Run** `nix develop -c npm run check`. Expected: exit 0.
- [ ] **Step 3: Commit:** `docs+shots: the Practise card`.
- [ ] **Step 4: Run one review of the whole branch** (`superpowers:requesting-code-review`). Fix what it finds.
- [ ] **Step 5: Merge.**
  - Merge master in and run `npm run check` again.
  - Then `git merge --no-ff practise-card` into master in `/home/tilen/Projects/salsaapp`.
  - Deploy only when the user asks.
