# Desktop plan 5 — Practice, Settings and the rest Implementation Plan

**Runs after:** plan 1. Lane B, first: it runs alongside plan 3 (lane A); afterwards lane B merges lane A's branch (with plan 3) and runs plan 4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 1024 px wide, Practice (setup and running), Settings, What uses space, My count, the admin page, share, the inline videos, the full-screen player's sheets and Music's leftovers look like the boards, and the phone stays pixel-for-pixel as it is.

**Architecture:** Layout only, on top of plan 1's frame: `desk:` classes and `@media (width >= 1024px)` blocks in component styles, `Screen`'s `width`, and three small pure helpers in `src/lib/player/view.ts`. Running restyles its own fixed column into a full-window split (stage on the band, 520 px sheet on the right). **The player's timing code is not touched:** nothing in `src/lib/scheduler/`, `createPlayer`, `start()`/`finish()` or the 25 ms loop changes; `StageCount`'s animation-frame loop and `Running`'s polling stay as they are.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest; plan 1's Playwright rig (`scripts/shots/`).

**Spec:** `docs/superpowers/specs/2026-11-03-desktop-design.md` ("Page by page" → Practice, the full-screen video player, Settings, Share, Music; "Two columns" → inline videos; "Popups are dialogs" → inside the full-screen player). Boards: `docs/superpowers/design-kit/desktop/` — render with `cd docs/superpowers/design-kit/desktop/gen/desk/pages && nix shell nixpkgs#python3 -c python3 -I book.py boards practice settings music system --theme salsa-light`, compare with `out/boards/salsa-light/<area>--<id>.html` at 1440×900.

Plan 5 of 5. It runs after plan 1 and consumes its Interfaces by name: the `desk:` variant, `--side-w`, `--band-row-h`, `--pane-left`, `--pane-max`, `frameOf` (`'bare'` for Practice and share), `sideLit` (`'settings'`), `desk` (`src/lib/nav/desk.svelte.ts`), `Screen`'s `width` (`'one' | 'two' | 'song' | 'narrow'`), `ListPane`, `inPane`, `BandHeader`, `Sheet`'s `size`, `scripts/shots/`. It does not redo the frame, dialogs, card pages, errors, loading, or Music's list and song pane.

## Global Constraints

- The desktop applies from **1024 px** window width; below it nothing changes, ever. The phone at 390 px must match plan 1's baseline (`shots.py diff` exits 0) and this plan's scene baseline (Task 1).
- Measures (spec and boards): band row **88 px**; Practice setup **640**; Practice running: stage = the band from x 0 to `100vw − 520`, y 88 to the bottom; the sheet a **520 px** column at the right, y 88 to the bottom, **28 px radius top-left only**, padded 24 top / 28 sides / 20 bottom, 8 px gaps; the count **up to 240 px**, the 1 a cream disc, dots **22 px** (now) and **14 px** (others) **16 px** apart, **26 px** between digit and dots, **22 px** between stage parts, 40 px padding below; the call **44 px** Bricolage 800, min height 52; the time **20/700** `band-small`, 36 tall; paused pill 36 tall, 16/800, pause icon 18, 1.5 px cream ring, "Paused · 1:42". Settings, What uses space, My count **720**; admin **1140**, two columns, 32 px gap; share **560**; My count's pattern toggle **480** wide; inline videos at most **70 % of the window's height**; dialogs in the player **560** (small **480**), radius 28, shadow `0 24px 70px rgb(0 0 0 / 0.32)`, max height `min(780px, 100% − 64px)`, no grabber, sides 28.
- Colours only from tokens and the builders (`ui/styles.ts`, `video/styles.ts`, `player/styles.ts`); never append a colour to a builder's output; `swap()` only in `.ts`.
- No new feature, no data-model change, no migration, no URL change, no form or API shape change: PAGE_EPOCH stays.
- **Where a board's words differ from the built app, the built app wins** (spec). Running's band keeps the built title (the song's title, or "Practice") and `runSubtitle`; the song popup keeps "tap a song to pick it". The one new string is Running's desk-only heading "Routine · slot N of M" (Task 3), which the board draws.
- `MediaQuery` (`desk`) is for behaviour, not layout. The one exception here is Running's `CountChips` `scroll` (Task 3): Running is mounted only after Play, never server-rendered, so there is no hydration flash.
- `npm run check` passes at the end of every task (`nix develop --command npm run check`).
- **Builder checklist (read before every task; reviewers keep finding these):**
  - Error paths: a button that goes busy must come back on failure; a refused action shows its message.
  - Tests must fail without the change. For each new test, name the mutation that would make it fail (remove the class, swap the branch) and check it does.
  - The browser and the tests can disagree: CSS, media queries and layout are not in vitest. Every task that changes what is drawn ends with a screenshot check (Task 1's rig) at 1440 and at 390.
  - Order: nothing is marked done/open/saved before the work it stands for has happened.
  - Forms in a layout's list column post to the list route's explicit action URL (`action="/{dance}/songs?/retry"`), never a bare `?/x`: on an item route a bare `?/x` posts to the item's actions.
  - (In this plan, "Task 1's rig" is plan 1's `scripts/shots/` plus this plan's Task 1 scenes.)

## Review Focus

1. **A window resized across 1024 mid-run:** the run goes on (same clock, same count, Pause/Resume state kept, nothing remounts); only the layout switches. (Task 3, Step 6.)
2. **A routine longer than the 520 column holds:** the seek bar and the Voice card stay in view, the list scrolls inside itself and the active slot stays visible. (Task 3, Step 6: shot at 1024×600.)
3. **A short desktop window** (1280×500 matches the phone-landscape query `(orientation: landscape) and (max-height: 520px)` too): the phone-landscape rules never apply at ≥ 1024; the stage shrinks and nothing overlaps. (Task 3, Steps 4 and 6.)
4. **A long song title on Running's band row:** compact 30 px past the phone's rule, one line, ellipsis; it never wraps over the stage. (Task 3, Step 1 tests and Step 6.)
5. **The admin page with no waiting requests:** the left column holds only Invite (and its error banner), both columns top-aligned, nothing jumps to the left column from the right. (Task 5, Step 2.)

---

### Task 1: Scenes for the rig, and their phone baseline

Static pages are not enough: Running, paused, Save this run, the song popup, the player's sheets, a recording take and the admin dialog only exist after clicks.

**Files:**
- Create if missing, else keep: `scripts/shots/scenes.py` (with the `shots.py`, `shots.sh` and README changes below: the rig's scene machinery, shared with plan 2)
- Create: `scripts/shots/ext_practice.py` (this plan's scenes and placeholders). `pages.txt` is not touched (plan 3 adds lines to it on the other lane); the share page is a scene.

**Interfaces:**
- Consumes: plan 1's `shots.py` (`placeholders(db)`, the session cookie, `STYLE`, `MASK_JS`, `--group`).
- Produces — **the rig's scenes, one shape shared with plan 2 Task 1 (word for word the same there):**
  - `scenes.py`: `class Scene(NamedTuple): path: str; act: Callable[[Page], None] = lambda p: None; masks: Callable[[Page], list[Locator]] = lambda p: []; desk: bool = False` (`desk`: shot only at widths ≥ 1024, never part of a phone baseline). `load_ext() -> tuple[dict[str, Scene], list[Callable]]` imports every `scripts/shots/ext_*.py` by file path (`importlib.util`; `python3 -I` puts no script directory on `sys.path`), merges their `SCENES: dict[str, Scene]` (a name twice is an error) and collects their optional `placeholders(db, admin: str, dance: str) -> dict[str, object]`.
  - `shots.py`: `placeholders(db)` also merges every extension's placeholders (a name already taken is an error), so page lines can use them too; a new subcommand `scene --db --base --out --size [--theme] [--group ID] --scenes NAMES`, NAMES a comma list or `all` (every scene, less the `desk` ones under 1024 wide). Chromium is launched with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required` and the context granted `microphone`. Per scene: open its path (filled as page lines are), `act(page)`, network idle + 300 ms, `STYLE` and `MASK_JS` as for pages, `screenshot(path=<out>/scene-<name>.png, full_page=True, mask=masks(page))`. A placeholder that is `None` prints `skip <name>` and is not a failure; an exception in `act` is.
  - `shots.sh <db> <out> <W>x<H> [--theme light|dark] [--group ID] [--scenes NAMES]`: with `--scenes` it runs `shots.py scene` in place of `shoot`. README: a short "Scenes" paragraph.
  - **Who builds it:** first run `git log --all --oneline --grep='the rig shoots scenes'`. If that commit exists (plan 2 on lane A built it), `git cherry-pick` it and go on to this plan's scenes; otherwise build the machinery exactly as above (no scenes in it) and commit it alone as `chore(desktop): the rig shoots scenes`, so plan 2 can cherry-pick it and the lanes' merge sees one change.
  - Each plan's scenes and placeholders live in its own `ext_<name>.py`, so the lanes never edit one scene list.
- This plan's `ext_practice.py`: placeholders `sharekey` (a fixed UUID `00000000-0000-4000-8000-000000000000`), `longroutine` (the admin's live routine with the most `routine_steps`), `classsong` (a shared, live song of a group where the admin's `team_members.role = 'member'`), `draftsong` (a live song of a group the admin owns or edits, `shared_at is null`, `status = 'ready'`); the scenes below.

- [ ] **Step 1: Write the scenes** (each waits for network idle + 300 ms after `act`):
  - `share` `/{dance}/share?key={sharekey}`: no act (a page, kept out of `pages.txt`).
  - `practice-setup-song` `/{dance}/player?routine={routine}`: click the "A song" segment.
  - `practice-song-picker`: as above, then open the song field.
  - `practice-running` `/{dance}/player?routine={routine}`: click Play, wait 2.5 s.
  - `practice-running-long` `/{dance}/player?routine={longroutine}`: as running.
  - `practice-paused`: running, then click Pause.
  - `practice-save`: running, then click Stop (Save this run open).
  - `player-keys` `/{dance}/figures/{figure}`: open the first recording's Full screen, press `?`.
  - `my-count-recording` `/voice`: start a take on the first tempo, wait until "Recording" shows.
  - `admin-person` `/admin`: click the first People row.
  - `song-class` `/{dance}/songs/{classsong}`; `song-make-mine`: then click Edit song.
  - `song-draft` `/{dance}/songs/{draftsong}` (with `--group` of that song's group).
  - Masks for every Practice running scene: the count (`role=img` named `/^Count/`), the call (`.run-call`), the time line, `ol[aria-label="Routine"]`, the seek bar. Masks are Playwright's `screenshot(mask=…)`; no attribute is added to the app.
- [ ] **Step 2: Check stability:** shoot all scenes twice at 390×844; `shots.py diff` of the two runs exits 0.
- [ ] **Step 3: Take the scene baseline before any change in this plan:** `--scenes all` at 390×844, light and dark, into `<scratch>/scenes-390`. Expected: one PNG per scene or a `skip` line.
- [ ] **Step 4: Commit** `scripts/shots/ext_practice.py` (`chore(desktop): Practice's scenes for the screenshot rig`), after the machinery's own commit.

### Task 2: Practice setup, Save this run, and pinned bars at their page's width

**Files:**
- Modify: `src/lib/components/player/Setup.svelte`, `src/lib/components/ui/BottomBar.svelte`, `src/lib/nav/frame.ts` (+ `frame.spec.ts`), `src/routes/layout.css`

**Interfaces:**
- Consumes: `Screen`'s `width`; plan 1's pinned-bar rule (`left: var(--pane-left)`, inner max `var(--pane-max, 720px)`); the root wrapper's `data-frame`.
- Produces: `export const PAGE_WIDTH = { one: 720, two: 1140, song: 640, narrow: 560 } as const` and `export type PageWidth = keyof typeof PAGE_WIDTH` in `frame.ts` (if plan 1 already exports such a map from `Screen` or `frame.ts`, reuse it under its name and skip this). `BottomBar` gains `width?: PageWidth`: when set, the bar's root sets `--pane-max: <px>px` from `PAGE_WIDTH` (it overrides the inherited value; a bar rendered outside its `Screen` cannot inherit Screen's, and nearly every page renders its bar after `</Screen>`). This is the one way a bar gets its page's width; plan 4 (after this plan, on this lane) uses it for a lesson's edit Save. Plans 2 and 3 (lane A) leave their bars at plan 1's 720 fallback. CSS: `[data-frame='bare'] { --side-w: 0px; --pane-left: 0px; }` so a bare frame's pinned bars start at x 0 (both: `--pane-left: var(--side-w)` is resolved on `:root`, so zeroing `--side-w` alone does not reach it; skip if plan 1 already does this, check Play at 1440 first).

- [ ] **Step 1: Failing test** in `frame.spec.ts`: `PAGE_WIDTH.song === 640`, `PAGE_WIDTH.narrow === 560`, `PAGE_WIDTH.one === 720`, `PAGE_WIDTH.two === 1140`. Run `nix develop --command npx vitest run src/lib/nav/frame.spec.ts` — FAIL.
- [ ] **Step 2: Implement** `PAGE_WIDTH`, `BottomBar`'s `width`, the bare rule; `Setup`: `<Screen width="song">` and `<BottomBar fade width="song">`. Nothing else in Setup changes (‹, title, `setupSubtitle`, the Count only | A song segment are already where plan 1's band row puts them).
- [ ] **Step 3: Run** the spec — PASS; `npm run check` passes.
- [ ] **Step 4: Screenshot check** at 1440×900 against `practice--setup-count` (`/salsa/player`), `practice--setup-song` (scene `practice-setup-song`), `practice--save-run` (scene `practice-save`: a 560 dialog over the setup, Don't save | Save in the footer), `practice--song-picker` (scene `practice-song-picker`: a dialog, its search focused) and `practice--song-picker-class` if a group song exists: no side, the sheet rounded at both top corners, content 640 centred, Play pinned at the sheet's bottom and 640 wide, starting at x 0 of the window (not 188). 390: page diff and scene diff 0.
- [ ] **Step 5: Commit** (`feat(desktop): Practice setup at 640, Play pinned under it`).

### Task 3: Practice running on desktop

**Files:**
- Modify: `src/lib/player/view.ts` (+ `view.spec.ts`), `src/lib/components/player/Running.svelte`, `src/lib/components/player/StageCount.svelte`

**Interfaces:**
- Consumes: `desk` (`$lib/nav/desk.svelte`), `BottomBar`'s desk rule.
- Produces (PURE, `view.ts`):
  - `slotTone(i: number, active: number | null): 'now' | 'past' | 'next'` — `'now'` when `i === active`, `'past'` when `active !== null && i < active`, else `'next'`.
  - `routineHeading(active: number | null, total: number): string` — `Routine · slot ${active + 1} of ${total}`, or `Routine · ${plural(total, 'slot', 'slots')}` before the first call.
  - `runTitleCompact(title: string): boolean` — the band's compact rule: true past 18 characters or with a word over 10.

- [ ] **Step 1: Failing tests** in `view.spec.ts`:
  ```ts
  expect(slotTone(1, 1)).toBe('now');
  expect(slotTone(0, 1)).toBe('past');
  expect(slotTone(2, 1)).toBe('next');
  expect(slotTone(0, null)).toBe('next');
  expect(slotTone(0, 0)).toBe('now'); // a looping routine back at its first slot: nothing is past
  expect(routineHeading(1, 6)).toBe('Routine · slot 2 of 6');
  expect(routineHeading(null, 6)).toBe('Routine · 6 slots');
  expect(routineHeading(null, 1)).toBe('Routine · 1 slot');
  expect(runTitleCompact('Practice')).toBe(false);
  expect(runTitleCompact('Vivir mi vida')).toBe(false);          // 13
  expect(runTitleCompact('Valió la pena ahora')).toBe(true);     // 19
  expect(runTitleCompact('Desesperadamente')).toBe(true);        // one word of 16
  expect(runTitleCompact('Ritmo, ritmo y más')).toBe(false);     // exactly 18
  ```
  Run `nix develop --command npx vitest run src/lib/player/view.spec.ts` — FAIL.
- [ ] **Step 2: Implement** the three functions — PASS.
- [ ] **Step 3: Running's layout on desk** (`desk:` classes and a `@media (width >= 1024px)` block in its `<style>`; the phone's classes and DOM order stay):
  - The run column covers the window: `desk:left-0 desk:translate-x-0 desk:max-w-none desk:bg-band`. It stays a containing block (its `translate` is not `none`), so the fixed `BottomBar` is placed in window coordinates. It sits above plan 1's `SheetCorner`; if the corners show through at x 0 / y 88, raise the column's z on desk (never lower `SheetCorner`'s).
  - The header: the ‹ and the title sit where Setup's band row puts them (switching from setup to running must not move them), the title `desk:text-[46px]`, or 30 when `runTitleCompact(title)`, one line, ellipsis; the subtitle on the title's line, 14 px after it, 15/600 `band-small`. One element each, no desk copies. Move the header's inline `padding` style into the `<style>` block (same phone values) so the desk block can override it.
  - The stage: on desk the area from y 88 to the bottom, x 0 to `100% − 520px`, its parts centred with the gaps of Global Constraints. Call `desk:text-[44px] desk:min-h-[52px]`; time `desk:text-[20px] desk:h-9`; paused pill `desk:h-9 desk:text-[16px]`, its icon 18 on desk.
  - The sheet: `desk:fixed desk:top-[var(--band-row-h)] desk:right-0 desk:bottom-0 desk:w-[520px] desk:mt-0 desk:rounded-tl-[28px] desk:rounded-tr-none`; the scroller padded 24/28/20 with 8 px gaps on desk (bottom padding still clears the bar).
  - The routine list: on desk the whole routine, no height cap, no mask, no `slots-pad`; `flex: 0 1 auto; min-height: 0` so a long routine shrinks the list (which then scrolls itself) and never pushes the Voice card out. The existing scroll effect (`slotList.scrollTo` to the active row) is left exactly as it is: it is a no-op while the list fits. Above the list, `<h2 class="{SECTION_LABEL} hidden desk:block">{routineHeading(activeSlot, slots.length)}</h2>`. A row whose `slotTone` is `'past'` adds `desk:text-muted` to its number and name (the phone keeps `text-ink-2`).
  - The run bar: on the run column under desk, `--pane-left: calc(100% - 520px)` and `--pane-max: 520px`.
  - `CountChips` in the Voice card: `scroll={(!!song || slots.length > 0) && !desk.current}`, so the seven chips wrap in the 520 column (exception noted in Global Constraints).
  - The two phone-landscape blocks (`@media (orientation: landscape) and (max-height: 520px)`) in Running and StageCount gain `and (width < 1024px)`; no phone is that wide, so the phone is unchanged. Update Running's comment that "a desktop keeps the portrait 560 px column".
- [ ] **Step 4: StageCount on desk:** `.stage { --stage: min(240px, 34dvh); }` under `@media (width >= 1024px)` (the `size` prop is ignored there: the stage has the whole left side); dots `desk:size-[22px]` / `desk:size-3.5`, their row `desk:gap-4 desk:h-[22px]`, the outer gap `desk:gap-[26px]`. `stageDigit` and `stageDots` unchanged (paused already dims the digit and drops the disc).
- [ ] **Step 5: Run** `view.spec.ts` and `npm run check` — PASS. Confirm `git diff --stat` shows no file under `src/lib/scheduler/` and no change to `+page.svelte`'s script.
- [ ] **Step 6: Screenshot check** at 1440×900 against `practice--running` (scene `practice-running`) and `practice--paused` (scene `practice-paused`); at 1024×600 scene `practice-running-long` (Review Focus 2: seek bar and Voice visible, the active row visible); at 1280×500 `practice-running` (Review Focus 3: no landscape-phone layout, nothing overlaps); a song with a long title (pick one in the setup scene's picker, or edit the copy db's song title to 30 characters) — Review Focus 4. Resize by hand 1440 → 800 → 1440 mid-run (Playwright `set_viewport_size`): the clock keeps counting, Pause/Resume as before (Review Focus 1). 390: scene diff 0 for every Practice scene.
- [ ] **Step 7: Commit** (`feat(desktop): Practice running, the stage on the band and the sheet beside it`).

### Task 4: Settings, What uses space, My count, share

**Files:**
- Modify: `src/routes/settings/+page.svelte`, `src/routes/voice/+page.svelte`, `src/routes/[dance]/share/+page.svelte`

**Interfaces:**
- Consumes: `Screen`'s `width`, `sideLit` (Settings lit on all three; plan 1).

- [ ] **Step 1: Settings:** the band's ‹ (Back to Today) wrapped in `<span class="contents desk:hidden">`; on desk Settings is reached from the side. Width stays the default (`'one'`, 720). Check the title then starts where every band title does (x 30), with no empty gap for the hidden button.
- [ ] **Step 2: What uses space:** no code change (its ‹ to Settings stays, 720). Screenshot only.
- [ ] **Step 3: My count:** the `patterns` Segmented wrapped in `<div class="desk:w-[480px]">` (full-width segments, as the phone's). Recording stage, desk only: the card `desk:px-8 desk:py-10 desk:gap-6 desk:mt-12`; the heading (`view.heading`) `desk:text-[56px]`; the say line `desk:text-[18px] desk:mt-2.5`; the dots `desk:size-11 desk:text-[18px]`, their row `desk:gap-3.5`; the progress bar `desk:max-w-[480px]` centred. Redo and Stop stay in the `BottomBar` (inside `Screen`: it inherits 720).
- [ ] **Step 4: Share:** `<Screen width="narrow" …>` (560; `frameOf` already gives it no side).
- [ ] **Step 5: `npm run check`** passes (settings, storage and voice specs untouched).
- [ ] **Step 6: Screenshot check** at 1440 against `settings--settings` (no ‹, Settings lit), `settings--new-figures-style` (open it: a dialog as tall as its content), `settings--name`, `settings--storage` (‹ to Settings), `settings--my-count` (the toggle 480, centred over the sheet), `settings--my-count-recording` (scene `my-count-recording`; skip with a note if the fake mic is refused), `system--share` (scene `share`). 390: diff 0 for `/settings`, `/settings/storage`, `/voice` and scenes `share` and `my-count-recording`.
- [ ] **Step 7: Commit** (`feat(desktop): Settings, My count and share`).

### Task 5: The admin page in two columns

**Files:**
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: Implement.** `<Screen title="Admin" width="two">`. The limits line stays first, above both columns. Then a wrapper `contents desk:grid desk:grid-cols-2 desk:gap-8 desk:items-start` holding two columns, each `contents desk:flex desk:flex-col desk:gap-2` (the gap of `Screen`'s content column; check it and match): left = Waiting (when there are requests) then Invite someone and its error banner; right = Groups then People. `display: contents` keeps the phone's layout identical. The person, group and invite sheets are untouched (dialogs through plan 1); the forms' actions do not change.
- [ ] **Step 2: Screenshot check** at 1440 against `settings--admin` and `settings--admin-person` (scene `admin-person`); with the copy db's `storage_requests` emptied (Review Focus 5): left holds only Invite, both columns top-aligned; at 1024 both columns still fit (emails break, nothing overflows). 390: `/admin` diff 0. `admin-page.spec.ts` passes.
- [ ] **Step 3: Commit** (`feat(desktop): the admin page in two columns`).

### Task 6: Inline videos and the full-screen player's sheets

**Files:**
- Create: `src/lib/components/ui/inline-video.spec.ts`
- Modify: `src/lib/components/ui/VideoFrame.svelte`, `src/lib/components/links/YouTubeCard.svelte`, `src/lib/components/ui/PlayerLayer.svelte`, `src/lib/components/video/PlayerSheet.svelte` (Rename: `size="small"`), `src/lib/components/links/LinkLevel.svelte` and `LinkPopup.svelte` (dark branch: the same `size` their light `Sheet` got from plan 1)

**Interfaces:**
- Produces: `PlayerLayer` gains `size?: 'small'` (480 on desk), mirroring `Sheet`. If plan 1's Task 5 already gave `PlayerLayer` the desk dialog look (check `git log -p -- src/lib/components/ui/PlayerLayer.svelte`), keep it and only add what is missing below.

- [ ] **Step 1: Failing test** `inline-video.spec.ts` (reads files as text, as `class-rules.spec.ts` does): every `class="…aspect-video…"` in a `.svelte` file under `src/lib/components` also contains `desk:max-h-[70dvh]`, except `shell/PageSkeleton.svelte`; and `PlayerLayer.svelte`'s grabber line contains `desk:hidden`. Run — FAIL.
- [ ] **Step 2: Implement.** `VideoFrame`'s frame box and `YouTubeCard`'s iframe and play button get `desk:max-h-[70dvh]` (the width stays the column's; the `<video>` already letterboxes in the black box); the YouTube thumbnail gets `desk:object-contain`. `PlayerLayer`'s sheet panel on desk: width 560 (`size === 'small'`: 480), centred, radius 28 on all corners, no grabber, `max-height: min(780px, 100% - 64px)` (and that as its height when `tall`), header, body and footer padded 28 at the sides, the shadow `0 24px 70px rgb(0 0 0 / 0.32)` in its `<style>` under `@media (width >= 1024px)` (the shadow must stay in the style block: see its comment). Keep `overflow-clip` on the `sheet-panel` line (`sheet-scroll.spec.ts`). The question dialog shape is unchanged. Still `.theme-media`.
- [ ] **Step 3: Run** the new spec, `sheet-scroll.spec.ts`, `focus-clip.spec.ts` — PASS; `npm run check` passes.
- [ ] **Step 4: Screenshot check** at 1440: a figure with a recording and a lesson with a video (the inline frame no taller than 630 at 900; at 1440×600 no taller than 420, letterboxed); scene `player-keys` (the Keys sheet a 560 dialog in the media palette, no grabber; the player covers the whole window, side and band row included); open Rename on a section in the player (480) and the Link popup with a stacked level (same place and size, one scrim). 390: diff 0 for the figure and lesson pages and scene `player-keys`.
- [ ] **Step 5: Commit** (`feat(desktop): inline videos capped, the player's sheets as dialogs`).

### Task 7: Music's leftovers — a class song, a draft's Share bar, Make it mine

**Files:**
- Modify: `src/routes/[dance]/songs/[id]/+page.svelte` (the Share bar only)

**Interfaces:**
- Consumes: `BottomBar`'s `width` (Task 2); plan 1's song pane (`ListPane`, `inPane`).

- [ ] **Step 1: Implement.** The draft's `<BottomBar>` gets `width="song"`, so Share with the class is 640 wide, centred in the pane, starting at the pane's left (`--pane-left` from `ListPane`), not the window's. Nothing else: a class song is already read-only for a member (no taps, no count speed, the pencil is Edit song offering Make it mine), and the menu, Stop sharing and Make it mine are sheets that plan 1 made dialogs.
- [ ] **Step 2: Screenshot check** at 1440 against `music--class-song` (scene `song-class`), `music--make-it-mine` (scene `song-make-mine`), `music--group-music` (scene `song-draft` with `--group`: navy, Share with the class pinned at the pane's foot), `music--stop-sharing` (open ⋯ → Stop sharing), `music--song-yours` (a song with a group source, if the db has one: the source tabs under the pane title). A scene that prints `skip` is listed in the task report. 390: diff 0 for the same scenes.
- [ ] **Step 3: Commit** (`feat(desktop): a group draft's Share bar in the song pane`).

### Task 8: The whole of plan 5, checked, and the docs

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-03-desktop-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (line ~512: Practice's desktop column)

- [ ] **Step 1:** Shoot `pages.txt` and every scene at 1440×900, 1280×800 and 1024×768, light and dark, salsa and bachata, and at 390 light and dark. 390 diffs against both baselines are 0. No page overflows horizontally; nothing sits under the band row or the side.
- [ ] **Step 2: Docs.** Main spec: Practice's "a desktop keeps the 560 px column (until …)" now says the desktop splits the running screen, pointing at the desktop spec. Desktop spec: under `## Decided while building` (create it at the end if no plan has), its own `### Plan 5 — Practice, Settings and the rest` subsection (each plan writes only its own, so the lanes merge cleanly), listing what was settled here (Running keeps the built title; the "Routine · slot N of M" heading; Settings' ‹ hidden on desk; `PAGE_WIDTH`). `CLAUDE.md`: `scripts/shots/scenes.py` in the Layout block. If plans 1–4 are all merged into this branch, also: the spec's status line and CLAUDE.md's "The desktop has its own (agreed, not built yet)" become built, and "desktop" joins the Live list; otherwise leave that to whichever plan lands last.
- [ ] **Step 3:** `npm run check` passes.
- [ ] **Step 4: Commit** (`docs(desktop): Practice, Settings and the rest`).
