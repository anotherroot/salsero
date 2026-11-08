# Slovenian, part 2 (everything else, and the Android app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen of both dances, every refusal and the Android app's own text exist in Slovenian, drawn in the account's language, with English byte-identical to master.

**Architecture:** Part 1's typed catalogs (`src/lib/i18n/en/<area>.ts`, `sl/<area>.ts` typed `Catalog['<area>']`), read through `t()` at call time; the server's language from `runInLocale` around `resolve`, the browser's from `setClientLocale`. Part 2 adds one area per task, a shared `nouns` area for counted words, and a pure Kotlin word table in the app that follows a `locale` field on `/api/device/config`.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Drizzle + SQLite, Vitest; Kotlin, JUnit (JVM tests) for the app.

**Spec:** `docs/superpowers/specs/2026-11-07-slovenian-design.md` (read it first: register, glossary, grammar rules). This plan covers its steps 3 and 4. It starts after part 1 (`docs/superpowers/plans/2026-11-07-slovenian-part-1.md`, 12 tasks) is done. Areas part 1 created (`common`, `format`, `shell`, `entry`, `today`, `exercise`, `lesson`, `comments`, `video`, `settings`, `admin`, `groups`, `songs`, `player`) are **extended, not recreated** (a task below that says "Create" an area part 1 already has extends it instead); a component or module part 1 already translated is left alone (check `TRANSLATED` in `src/lib/i18n/no-english.spec.ts` and `git log --stat` of part 1 before touching a file).

## Global Constraints

- Two locales: `'en' | 'sl'`. `users.locale` / `invites.locale` null means `'en'`.
- Slovenian register: vikanje in sentences ("Vnesite kodo", "Ste prepričani?"); short imperatives on buttons ("Shrani", "Prekliči").
- Never put a person's name inside a phrase that declines it or a past-tense verb that agrees with it: names go after a colon or a "·" ("Sprememba · Ana · pred 10 min").
- Slovenian plurals by `slCount` (part 1 Task 1), never `n === 1 ? a : b`.
- Decimal comma in Slovenian ("0,25×", "1,5 s", "1,2 GB").
- Dates stay hand-built (no `toLocaleDateString`, CLAUDE.md).
- Glossary: the spec's table, kept as a comment block at the top of `src/lib/i18n/sl/index.ts`; use exactly those words.
- What people write (names, notes, comments, song titles) is never translated. The count stays Spanish.
- No module-level variable may hold the language on the server. `setClientLocale` must do nothing when `!browser`.
- A word table that is a top-level constant today (`THEME_LABEL`, `FEEL_WORD`, a tab's label …) becomes a function or is read inside a function, so it is looked up at call time, not at import time.
- Existing specs must keep passing unchanged in English. A spec that changes is a spec whose module's signature changed, nothing else.
- English text in English must not change (the phone screenshots in English stay identical).
- CLAUDE.md hard rules apply: additive `ALTER TABLE … ADD COLUMN` only, data functions take `db` first, nothing under `$lib/server` imported by components, a filled-in form uses `use:guarded`, `PAGE_EPOCH` raised in a commit that breaks what older open pages send.
- `npm run check` passes at the end of every task.

Part 2 adds:

- **Cases are words of their own.** A count after a verb or preposition takes that case, not the nominative: "Dodaj 3 položaje" (accusative), "V 2 kombinacijah" (locative), "Nalaganje 5 videov" (genitive). Such a phrase gets its own four-form entry in its area; never reuse a `nouns` nominative there.
- **Adjectives and verbs agree with the count:** "1 različica ustreza", "2 različici ustrezata", "3 različice ustrezajo", "5 različic ustreza"; "2 klicani različici", "5 klicanih različic". Where agreement gets awkward, rephrase with a colon ("Povezano: 3").
- **A word beside a person's name reads right for a woman and a man** (roles, badges, "by" lines): "Vodja", "Lahko ureja", or a noun phrase with the name after "·".
- **Text the app writes into the database** (a template's notes, a copy's "(kopija)") is written in the acting person's language at the time (`t()` inside the request). **Text composed at read time** (History, Recently deleted, refusals) is in the reader's.
- **Refusals are composed when thrown or returned, inside the request**, never kept in a top-level constant. An action spec asserting a Slovenian refusal runs it inside `runInLocale('sl', …)` (`src/lib/server/i18n-request.ts`); a pure function's spec uses `withLocale('sl', …)`.
- **Machines keep English:** the worker's queue (`/api/worker/*`), the media servers' bodies (`recordings`, `audio`, `count`, `lesson-videos`), `/releases`, `/api/app-update`, and the 426 body. Text a person never reads is not translated; a programmer error (`RangeError`, "unreachable") stays English.
- **Every translated component is appended to `TRANSLATED`** in `src/lib/i18n/no-english.spec.ts` in the task that translates it. Task 17 turns the list round (every component except a named few).
- `PAGE_EPOCH`: no task here is expected to change a form field, an action name or an API shape; a task that does raises it in that commit.

## Review Focus

1. **Plural and case forms for 1, 2, 3, 5 (and 101, 102)** in every counted phrase, including accusative/locative/genitive and agreeing adjectives. Pinned in Task 1 (`nouns`) and in each area's spec.
2. **History and Recently deleted read in the reader's language** from stored verbs: the same stored row reads English to one person and Slovenian to another. Pinned in Task 10.
3. **Text written into the database** (Templates' notes, "(kopija)") follows the acting person's language, and names a person picked (template names, place names) are never translated. Pinned in Tasks 4, 5, 12.
4. **The Android app falls back to English** with no `locale` from an older server, and an older app ignores the new field (`parseConfig` reads named keys). `/api/device/today` must NOT gain a key: `parseToday` reads every key as a dance. Pinned in Task 18.
5. **English byte-identical:** the en screenshot diff against master in Task 19 shows only part 1's allowed differences (the Settings Language row, the admin's invite language and per-person select).

---

### Task 1: Counted nouns, decimals typed in, and a catalog parity spec

**Files:**
- Create: `src/lib/i18n/{en,sl}/nouns.ts`, `src/lib/i18n/number.ts`, `src/lib/i18n/catalog.spec.ts`
- Modify: `src/lib/i18n/en/index.ts`, `src/lib/i18n/sl/index.ts` (add `nouns`; extend the glossary comment with the words below)

**Interfaces:**
- Consumes: part 1 Task 1 (`slCount`, `Catalog`, `withLocale`).
- Produces:
  - `t().nouns`: one `(n: number) => string` per counted noun, nominative, the number included: `figures` (različica), `moves` (figura), `routines` (kombinacija), `drills` (vaja), `lessons` (lekcija), `videos` (video), `recordings` (posnetek), `sections` (odsek), `points` (točka), `positions` (položaj), `songs` (skladba), `people` (oseba), `groups` (skupina), `counts` (doba — a figure's length), `slots` (mesto), `breaks` (prekinitev), `timingBreaks` (časovna prekinitev), `changes` (sprememba), `differences` (razlika), `links` (povezava), `copies` (kopija), `matches` (zadetek). English entries call `plural` exactly as the modules do today (`'figure'/'figures'` …), so moving a call site to `t().nouns.x(n)` keeps English identical.
  - Glossary additions (comment block): count as a length → **doba** ("8 dob"); slot → **mesto**; break → **prekinitev**; link → **povezava**; owner / editor / member → **Vodja / Lahko ureja / Lahko bere**.
  - `number.ts`: `readDecimal(raw: string): number | null` — accepts "1,5" and "1.5" (one separator, digits around it), trims; anything else null. Used by every server field that takes a decimal (Task 16's GB limit; any other found on the way).
  - `catalog.spec.ts`: for every area of `en`, `sl` has the same keys recursively; every string leaf differs from English except paths in an `ALLOWED_SAME` list (e.g. `common.more`, words like "Video", "BPM", "GB"); every function leaf returns a string in both for a sample argument (`1`, `'x'`). Generalises part 1's `common`-only check in `i18n.spec.ts`.
- [ ] **Step 1: Write the failing tests** (sl via `withLocale`), in `catalog.spec.ts` or a `nouns` block of `i18n.spec.ts`:
  - `nouns.figures`: 1 → `'1 različica'`, 2 → `'2 različici'`, 3 → `'3 različice'`, 5 → `'5 različic'`, 101 → `'101 različica'`, 102 → `'102 različici'`.
  - `nouns.routines`: `'1 kombinacija'`, `'2 kombinaciji'`, `'3 kombinacije'`, `'5 kombinacij'`.
  - `nouns.recordings`: `'1 posnetek'`, `'2 posnetka'`, `'3 posnetki'`, `'5 posnetkov'`.
  - `nouns.videos`: `'1 video'`, `'2 videa'`, `'3 videi'`, `'5 videov'`.
  - `nouns.positions`: `'1 položaj'`, `'2 položaja'`, `'3 položaji'`, `'5 položajev'`.
  - `nouns.people`: `'1 oseba'`, `'2 osebi'`, `'3 osebe'`, `'5 oseb'`.
  - `nouns.counts`: `'1 doba'`, `'2 dobi'`, `'3 dobe'`, `'8 dob'`.
  - `nouns.slots`: `'1 mesto'`, `'2 mesti'`, `'3 mesta'`, `'5 mest'`.
  - `nouns.timingBreaks`: `'1 časovna prekinitev'`, `'2 časovni prekinitvi'`, `'3 časovne prekinitve'`, `'5 časovnih prekinitev'`.
  - English: `nouns.figures(1)` → `'1 figure'`, `(2)` → `'2 figures'` (as `plural` gives today).
  - `readDecimal('1,5')` → 1.5; `'1.5'` → 1.5; `' 2 '` → 2; `'1,5,2'` → null; `''` → null; `'abc'` → null.
  - The parity spec passes for `common` and `nouns` and fails if a key is removed from `sl`.
- [ ] **Step 2: Run** `timeout 300 npx vitest run src/lib/i18n` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same, then `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): counted nouns, decimals typed either way, catalog parity`.

### Task 2: Moves — the lists, a move's page, Coverage

**Files:**
- Create: `src/lib/i18n/{en,sl}/moves.ts`
- Modify: `src/lib/moves/figures.ts`, `filter.ts` (if it has words), `list.ts`, `members.ts`, `move-page.ts`, `pane.ts`, `picks.ts`, `routines.ts`, `segment.ts`; `src/lib/routines/coverage.ts` (its one line); `src/lib/components/moves/FiguresList.svelte`, `NavTile.svelte`, `RoutinesList.svelte`; `src/routes/[dance]/(moves)/+layout.svelte`, `+layout.server.ts`; `src/routes/[dance]/(moves)/figures/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/(moves)/moves/[id]/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/(moves)/coverage/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/(moves)/routines/+page.svelte`, `+page.server.ts`
- Test: `src/lib/moves/list.spec.ts`, `move-page.spec.ts`, `segment.spec.ts`, `figures.spec.ts`, `routines.spec.ts` (extend each with sl cases), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`nouns`), part 1 `format`.
- Produces: `t().moves` (segment labels, headings, empty states, chips, meta words, the pane's words). `MOVES_SEGMENTS`' labels and `EMPTY_PANE` read at call time (a function or a lookup by key in the component).
- [ ] **Step 1: Write the failing tests** (sl):
  - `movesHeading({ moves: 1, figures: 1 }, true)` → `'1 različica ustreza'`; figures 2 → `'2 različici ustrezata'`; 3 → `'3 različice ustrezajo'`; 5 → `'5 različic ustreza'`.
  - `movesHeading({ moves: 5, figures: 14 }, false)` → `'Vaše · 14 različic'`.
  - `moveSubtitle(1)` → `'Figura · 1 različica'`; `(3)` → `'Figura · 3 različice'`; `(5)` → `'Figura · 5 različic'`.
  - `usedInMeta('routine', ['A', 'B', 'C'])` → `'Kombinacija · A, B in C'`; `usedInMeta('lesson', [])` → `'Lekcija'`.
  - `figureRowMeta` with `lengthCounts: 2, recordings: 2` contains `'2 dobi'` and `'2 posnetka'`; with `16` and `5`: `'16 dob'`, `'5 posnetkov'`.
  - The three segment labels in sl are `['Figure', 'Kombinacije', 'Položaji']` (the tab is Figure, a move is figura).
  - `routineBadges` with `breaks: 2` → a badge `'2 prekinitvi'`.
  - The components above are in `TRANSLATED` and pass.
- [ ] **Step 2: Run** `timeout 300 npx vitest run src/lib/moves src/lib/i18n` — Expected: FAIL.
- [ ] **Step 3: Implement.** The lists' forms post to the list route's explicit action URL already; keep it.
- [ ] **Step 4: Run** the same, then `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): the Moves lists, a move's page and Coverage in Slovenian`.

### Task 3: The figure page

**Files:**
- Create: `src/lib/i18n/{en,sl}/figure.ts`
- Modify: `src/lib/figures/page.ts`; `src/lib/components/figures/AddRecordingSheet.svelte`, `FigureFields.svelte`, `FigureTabs.svelte`, `FigureTiming.svelte`, `LinkRow.svelte`, `MoveSheet.svelte`, `RecordingRow.svelte`, `RelationsCard.svelte`, `RemoveWarning.svelte`, `SectionRow.svelte`, `TopVideo.svelte`, `VariationBar.svelte` (`PositionTags.svelte` is Task 5's); `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`, `+page.server.ts`; `src/routes/api/figures/[id]/recordings/+server.ts` (refusals the page shows); `src/lib/server/figures.ts` (refusals)
- Test: `src/lib/figures/page.spec.ts` (extend), `src/routes/[dance]/(moves)/figures/[id]/` existing action spec if present (else a small `figure-actions.spec.ts` beside it, mocking `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1, part 1 `format` and `video`.
- Produces: `t().figure`. `RELATION_LABEL` read at call time.
- [ ] **Step 1: Write the failing tests** (sl):
  - `relationTitle('routines', 1)` → `'V 1 kombinaciji'`; `(…, 2)` → `'V 2 kombinacijah'`; `3` → `'V 3 kombinacijah'`; `5` → `'V 5 kombinacijah'` (locative: its own four-form entry).
  - `lengthError('0')` → `'Od 1 do 64 dob. Ena osmica je 8.'`; `lengthError('8')` → null.
  - `recordingsTitle`/`recordingMetaLine` draw counts through `nouns` (`'2 posnetka'`).
  - A rename refusal from the page's action (name taken in the move), run in `runInLocale('sl', …)`, is Slovenian and has the move's name after a colon, not declined.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** run (FAIL), implement, run and `npm run check` (PASS).
- [ ] **Step 5: Commit** `feat(i18n): the figure page in Slovenian`.

### Task 4: Routines and the routine editor

**Files:**
- Create: `src/lib/i18n/{en,sl}/routine.ts`
- Modify: `src/lib/routines/page.ts`, `selection.ts` (its words); `src/lib/components/routines/Seam.svelte`, `SelectionBar.svelte`, `SlotCard.svelte`, `SlotList.svelte`, `SlotPicker.svelte`, `Swipeable.svelte`; `src/routes/[dance]/(moves)/routines/[id]/+page.svelte`, `+page.server.ts`; `src/lib/server/routines.ts` (refusals; `duplicateRoutine`'s `" (copy)"`, written in the acting person's language)
- Test: `src/lib/routines/page.spec.ts`, `selection.spec.ts`, `src/lib/server/routines.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`breaks`, `timingBreaks`, `slots`).
- Produces: `t().routine`. `ENDS_DIFFER` read at call time.
- [ ] **Step 1: Write the failing tests** (sl):
  - `factBadges` with `breaks` 1/2/3/5 → `'1 prekinitev'`, `'2 prekinitvi'`, `'3 prekinitve'`, `'5 prekinitev'`; `timingBreaks: 2` → `'2 časovni prekinitvi'`.
  - `slotMeta(…, childSlots = 2)` starts `'Kombinacija · 2 mesti'`; `5` → `'Kombinacija · 5 mest'`.
  - `selectionTitle` for 1, 2, 3, 5 selected in sl (exact forms of the builder's phrase, e.g. `'Izbrano: 3'`).
  - `withLocale('sl', () => duplicateRoutine(db, id))` names the copy `'<name> (kopija)'`; in en still `'<name> (copy)'`.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): routines and the routine editor in Slovenian`.

### Task 5: Positions — list, page, the sheet, the hold, Templates

**Files:**
- Create: `src/lib/i18n/{en,sl}/positions.ts`
- Modify: `src/lib/positions/view.ts` (the list's, sheet's, page's, tags' and templates' lines; the map, How and link lines are Task 6's), `hold.ts` (`HANDS_LABEL`, `HANDS_SHORT`, `FACING_LABEL`, `FRAME_LABEL`, `CROSSED_LABEL`, `NOT_CROSSED`, `EMPTY_HOLD` → read at call time), `templates.ts` (each template's `description` read at call time by key; `name` stays as is — it is a dance term and the key `addTemplates` matches); `src/lib/components/positions/PositionRow.svelte`, `PositionFields.svelte`, `PositionForm.svelte`, `PositionSheet.svelte`, `TemplatesSheet.svelte`; `src/lib/components/moves/PositionsList.svelte`; `src/lib/components/figures/PositionTags.svelte`; `src/routes/[dance]/(moves)/positions/+page.svelte`, `+page.server.ts`, `positions/[id]/+page.svelte`, `+page.server.ts`, `positions/none/+page.svelte`, `+page.server.ts`; `src/routes/api/positions/+server.ts`; `src/lib/server/positions.ts` (`addTemplates` writes notes in `t()`'s language; refusals), `src/lib/server/position-form.ts`
- Test: `src/lib/positions/view.spec.ts`, `hold.spec.ts`, `templates.spec.ts`, `src/lib/server/positions.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`positions`, `figures`, `counts`, `recordings`).
- Produces: `t().positions`; `templateDescription(dance, type, name): string` (or the same through `TEMPLATES` turned into a function) — the builder picks, `addTemplates` and `TemplatesSheet` both read it.
- [ ] **Step 1: Write the failing tests** (sl):
  - `listHeading(n, true)`: 1 → `'1 položaj'`, 2 → `'2 položaja'`, 3 → `'3 položaji'`, 5 → `'5 položajev'`; `listHeading(4, false)` → `'Vaši · 4'`.
  - `addLabel` (accusative): 1 → `'Dodaj 1 položaj'`, 2 → `'Dodaj 2 položaja'`, 3 → `'Dodaj 3 položaje'`, 5 → `'Dodaj 5 položajev'`.
  - `noPositionRow(2).meta` → `'2 različici · ustrezata kjer koli'` (or the builder's agreeing phrase; it must agree for 1, 2, 3, 5).
  - `holdChips({ hands: 'two', crossed: null, facing: 'face', frame: 'open' })[0]` → `'Dve roki'`; `HANDS_LABEL` none → `'Brez rok'`.
  - `withLocale('sl', () => addTemplates(db, space, 'salsa', 'salsa', ['Cerrada'], …))` writes a position named `'Cerrada'` whose notes are `'Zaprta, osnovna drža'`; in en the notes stay `'Closed, the basic frame'`.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): positions, the hold and Templates in Slovenian`.

### Task 6: Positions — How positions work, the map, links to sections and lessons

**Files:**
- Modify: `src/lib/i18n/{en,sl}/positions.ts` (extend); `src/lib/positions/view.ts` (HOW, `HOW_EXAMPLE_LABEL`, `HOW_PANE_SUBTITLE`, MAP, `mapLabelFor`, `mapSummary`, `mapNodeName`, `mapTwinsLine`, `noPositionChip`, `unusedChip`, `mapLitLine`, the link/point/spot/lesson-pick lines, `ARCHIVED_LINKS`), `map-view.ts` (`legendTypes`' labels), `pick.ts` if it has words; `src/lib/components/positions/HowBody.svelte`, `HowSheet.svelte`, `MapPane.svelte`, `PositionMap.svelte`, `PointCard.svelte`, `PointStill.svelte`, `PositionLinkPicker.svelte`; `src/routes/[dance]/(moves)/positions/map/+page.svelte`, `+page.server.ts`; `src/lib/server/position-links.ts` (refusals)
- Test: `src/lib/positions/view.spec.ts`, `map-view.spec.ts`, `src/lib/server/position-links.spec.ts`, `no-english.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 5.
- [ ] **Step 1: Write the failing tests** (sl):
  - `mapSummary({ positions: 3, between: 2, … })` starts `'3 položaji · 2 različici med njimi'`; positions 5, between 5 → `'5 položajev · 5 različic med njimi'`.
  - The "No position · N figures" chip: 1 → `'Brez položaja · 1 različica'`, 5 → `'Brez položaja · 5 različic'`.
  - `legendTypes` labels in sl are not the English ones (each type has a Slovenian word).
  - A link refusal (`LINK_REFUSED`) in sl; components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`. Check the map's label box maths still fit (`LABEL_CHAR`, `LABEL_MAX`): labels are people's names, not catalog words, so nothing should move; say so in the report if something did.
- [ ] **Step 5: Commit** `feat(i18n): How positions work and the map in Slovenian`.

### Task 7: The full lesson page, New lesson, and the share target

**Files:**
- Modify: `src/lib/i18n/{en,sl}/lesson.ts` (extend part 1's); `src/lib/lessons/page.ts` (every line part 1 left), `list.ts` (`videoMeta`, `diskSubtitle`, `groupVideosSubtitle`, `emptyLessonsBody`, `PICK_LESSON` if left); `src/lib/components/lessons/LessonFields.svelte`, `NewLessonSheet.svelte`, `UnlinkVia.svelte`, `VideoSections.svelte`; `src/routes/[dance]/lessons/+layout.svelte`, `+layout.server.ts`, `+page.svelte`, `+page.server.ts` (what part 1 left), `src/routes/[dance]/lessons/[id]/+page.svelte`, `+page.server.ts` (the full page at Practise and Everything); `src/lib/server/lesson-form.ts`; `src/routes/api/lessons/[id]/videos/[uploadId]/+server.ts` (refusals shown by the upload card); `src/routes/[dance]/share/+page.svelte`, `+page.server.ts` (the Android app's "share a video to a lesson" page)
- Test: `src/lib/lessons/page.spec.ts`, `list.spec.ts` (extend), the lesson page's action spec if present (else `lesson-actions.spec.ts`, db mocked), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1, part 1 `lesson` and `video`.
- [ ] **Step 1: Write the failing tests** (sl):
  - `videoMeta({ videos: n, videoBytes: 0 }, false)`: 1 → `'1 video'`, 2 → `'2 videa'`, 3 → `'3 videi'`, 5 → `'5 videov'`; sized with 1,5 GiB → contains `'1,5 GB'`.
  - `lessonCounts`/`practiceRows` counted words for drills (`'2 vaji'`, `'5 vaj'`) and routines.
  - `deleteVideoBody`/`unlinkViaBody` in sl, vikanje ("Ste prepričani …" or an imperative sentence ending in "-te").
  - Saving a lesson with an empty title, run in `runInLocale('sl', …)`, fails with a Slovenian message.
  - Components and the two route pages in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the full lesson page in Slovenian`.

### Task 8: The Link popup and the pickers

**Files:**
- Create: `src/lib/i18n/{en,sl}/picker.ts`, `src/lib/i18n/{en,sl}/links.ts`
- Modify: `src/lib/picker/view.ts`, `build.ts` (its words), `link-submit.ts` (messages); `src/lib/video/link-steps.ts` (`linkHeading`, `linkWords`, `linkTitles`, `loadFailed`, `MOMENT_LABEL`, `momentAt`, `refusalAt`); `src/lib/links.ts` (`linkFound`'s words); `src/lib/components/picker/Picker.svelte`, `PickerField.svelte`, `PickerMultiField.svelte`, `PickerOpener.svelte`; `src/lib/components/links/AddLinkSheet.svelte`, `LinkLevel.svelte`, `LinkList.svelte`, `LinkPopup.svelte`, `LinksEditor.svelte`, `YouTubeCard.svelte`; `src/lib/components/ui/LinkSectionSheet.svelte` (if part 1 left words); `src/lib/server/link-popup.ts`, `link-form.ts`, `spot-links.ts` (`SpotLinkError`, `SpotLinkedError` messages), `spots.ts` (`SpotError`), `video-downloads.ts`; `src/routes/api/video-spots/+server.ts`, `[id]/+server.ts`, `[id]/links/+server.ts`, `[id]/links/[linkId]/+server.ts`; `src/routes/api/archived/+server.ts`
- Test: `src/lib/picker/view.spec.ts`, `build.spec.ts`, `src/lib/video/link-steps.spec.ts`, `src/lib/links.spec.ts`, `src/lib/server/link-form.spec.ts`, `spot-links.spec.ts` (extend), `src/lib/components/links/add-link-sheet.spec.ts` (unchanged in en), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`matches`, `links`).
- [ ] **Step 1: Write the failing tests** (sl):
  - `emptyText('xy', '…')` → `'Nič ne ustreza »xy«.'` (Slovenian quotes » «); `createLead('xy')` → `'Ni na seznamu? Ustvari »xy« kot'`; `createLead('')` → `'Ni na seznamu?'`.
  - `doneLabel(3)` → `'Končano · povezano: 3'`; `doneLabel(3, 'field')` → `'Končano · 3'`.
  - `linkRefusal` and a `SpotLinkedError` thrown inside `withLocale('sl', …)` carry Slovenian messages.
  - A link-form refusal (bad URL), run in `runInLocale('sl', …)`, is Slovenian.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the Link popup and the pickers in Slovenian`.

### Task 9: Groups — the list, a group's page, people, Add, the code, Leave and Keep

**Files:**
- Modify: `src/lib/i18n/{en,sl}/groups.ts` (part 1's; extend)
- Modify: `src/lib/teams/view.ts` (every line part 1 left: `deletingLine`/`lessonNotice`'s `MAKE_MINE` (from `clones/view.ts`: move it to the catalog here, Task 11 reads it from there), `limitLine`, `NAME_REFUSAL`, `groupUsesLine`, `PICK_GROUP`, `codeAction`, `COPY_FAILED`; `roleLabel`, `peopleLine`, `youLine`, `newPill`, `groupsTabLabel` are part 1's — check their sl against the tests below and fix only what differs), `add.ts`, `leave-view.ts`, `mode.ts` (labels and meta); `src/lib/components/teams/AddSheet.svelte`, `CodeSheet.svelte`, `GroupList.svelte`, `LeaveSheet.svelte`; `src/routes/[dance]/groups/+layout.svelte`, `+layout.server.ts`, `+page.svelte`, `+page.server.ts`, `[id]/+page.svelte`, `[id]/+page.server.ts`, `[id]/people/+page.svelte`, `[id]/people/+page.server.ts`; `src/routes/[dance]/group-mode/+page.server.ts`; `src/lib/server/teams.ts`, `membership.ts`, `add-form.ts`, `keep-form.ts` (refusals); `src/routes/api/teams/[id]/keep/+server.ts`
- Test: `src/lib/teams/view.spec.ts`, `add.spec.ts`, `leave-view.spec.ts`, `mode.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`people`, `groups`, `videos`, …).
- [ ] **Step 1: Write the failing tests** (sl):
  - `peopleLine`: `'1 oseba'`, `'2 osebi'`, `'3 osebe'`, `'5 oseb'`.
  - `limitLine` (accusative): 1 → `'Ustvarite lahko 1 skupino. Za več vprašajte skrbnika.'`, 2 → `'Ustvarite lahko 2 skupini. …'`, 3 → `'… 3 skupine. …'`, 5 → `'… 5 skupin. …'`.
  - `roleLabel`: owner → `'Vodja'`, editor → `'Lahko ureja'`, member → `'Lahko bere'` (they sit beside a name; glossary, Task 1).
  - `groupUsesLine(1.2 GiB, 2 GiB)` → `'Porabljeno 1,2 GB od 2,0 GB'`.
  - `holdsLine` (Add) and `leaveSub`'s counts through four forms (`'2 vaji'`, `'5 kombinacij'`).
  - A group-name refusal (`NAME_REFUSAL`) in sl; a join refusal from `membership.ts` run in `runInLocale('sl', …)`.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): Groups in Slovenian`.

### Task 10: Groups — History, Recently deleted, the group's storage, the clash sheet

**Files:**
- Modify: `src/lib/i18n/{en,sl}/groups.ts` (extend: `history`, `deleted`, `clash` blocks); `src/lib/teams/history.ts` (`A_THING`, `FIELD`, the verb phrases, `historySubject`, `historyLine`, `editedByLine`, `archivedByLine`, `seconds` with the decimal comma), `deleted.ts` (`KIND_NAME`, `deletedByLine`, `purgeLine`, `takenLine`, `trashRefusalLine`), `restore-api.ts` (messages); `src/lib/clash/clash.ts` (`clashTitle`, `goneTitle`, `fieldLabel`, `clashView`'s words); `src/lib/components/ui/ClashSheet.svelte` (what part 1 left); `src/routes/[dance]/groups/[id]/history/[kind]/[rootId]/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/groups/[id]/deleted/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/groups/[id]/storage/+page.svelte`, `+page.server.ts`; `src/lib/server/trash.ts` (`'Untitled song'`), `changes.ts` (its refusal); `src/routes/api/trash/[id]/+server.ts`
- Test: `src/lib/teams/history.spec.ts`, `deleted.spec.ts`, `src/lib/clash/clash.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 9; part 1 `format` (`agoText`).
- Produces: History lines composed at read time from stored `verb`/`subject`/values — nothing stored changes, no migration.
- [ ] **Step 1: Write the failing tests** (sl), using the existing spec's rows:
  - A notes change → `'Ana · Spremenjeno: zapiski'`.
  - A section moved 1.2 s → `"Ana · Premaknjeno: 'Enchufla doble' za 1,2 s"`; 2 s → `'Ana · Premaknjeno: odsek za 2 s'`; the end 0.3 s → `'Ana · Premaknjeno: konec odseka za 0,3 s'`.
  - Add a section → `'Luka · Dodano: odsek'`; archive a figure → `"Ana · Arhivirano: različica 'Doble'"`; make the move → `'Ana · Ustvarjeno: figura'`.
  - The same row read in en is the existing English line (existing assertions unchanged), and read in sl after it, Slovenian: one row, two readers.
  - `deletedByLine({ by: 'Ana', at }, now)` → `'Izbrisano · Ana · pred 5 min'`; `purgeLine` for 1, 2, 3, 5 days left: `'Še 1 dan'`, `'Še 2 dneva'`, `'Še 3 dni'`, `'Še 5 dni'`.
  - `clashTitle` in sl puts the name after `·` (`'Sprememba · Ana · med vašim urejanjem'` or the builder's equivalent; assert it ends with or follows `'· Ana'` and contains no declined form).
  - Components and pages in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): History, Recently deleted and the clash sheet in Slovenian`.

### Task 11: Clones — Make it mine, Keep in step and Sync, Drop my copy, Detach

Since the clone-sync merge (spec `2026-11-07-clone-sync-design.md`), Compare, Take and Send are gone: one Sync sheet, Keep in step, a notice on the page, "Basic · Sreda 17:30" tags.

**Files:**
- Create: `src/lib/i18n/{en,sl}/clones.ts`
- Modify: `src/lib/clones/view.ts` (from `possessive` through Make it mine, You get, Drop, Detach — everything before `copyTitle`), `step-view.ts` (every constant and line: the notice, the Sync sheet, Keep in step and `KEEP_OPTIONS`, `syncButton`, `syncSub`, `holdersLine`, `changedBy`, `removeChoice`, `addBox`, `removeBox`, `changeText`, `updateSub`, `staysLine` — constants become getters or functions read at call time), `from-tag.ts` (its words only; the tag is people's names and a day/time, drawn with part 1's `format`), `flat.ts` (`fieldLabel`'s labels), `pages.ts` if it has words; `src/lib/components/clones/MakeMineSheet.svelte`, `SyncNotice.svelte`, `SyncSheet.svelte`, `KeepInStep.svelte`, `DropSheet.svelte`, `DetachSheet.svelte`, `dropped.svelte.ts` (its toast); `src/lib/server/take-form.ts`, `make-mine-form.ts`, `keep-form.ts`, `src/lib/server/clones/apply.ts`, `edit.ts`, `drop.ts`, `detach.ts`, `sync.ts`, `sync-settings.ts`, `step.ts` (refusal messages); the clone API routes under `src/routes/api/clones/**` that answer a person
- Test: `src/lib/clones/view.spec.ts`, `step-view.spec.ts`, `from-tag.spec.ts`, `flat.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`changes`, `differences`, `copies`, `figures` …).
- Produces: `t().clones`. `possessive` is not used in Slovenian phrases: a sentence that says "Ana's" in English says "· Ana" or ": Ana" in Slovenian.
- [ ] **Step 1: Write the failing tests** (sl):
  - `syncSub(differences, copies)` agrees for 1, 2, 3, 5 of each (`'1 razlika'`, `'2 razliki'`, `'3 razlike'`, `'5 razlik'`; copies in the case the phrase needs, its own four-form entry).
  - `syncButton(n)` and `updateSub(n)` agree for 1, 2, 3, 5.
  - `holdersLine(['Ana', 'Sreda 17:30'])` keeps the names as written, joined with `' in '` for the last.
  - `noticeLine` for each `StepLine` kind is Slovenian, vikanje where it is a sentence.
  - `KEEP_OPTIONS`' labels read in sl are not the English ones.
  - A Sync or Keep refusal from its route or form, run in `runInLocale('sl', …)`, is Slovenian.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): Make it mine, Keep in step, Sync, Drop and Detach in Slovenian`.

### Task 12: Clones — Copy to…, Move to…, twins, Versions and the ⋯ menu

**Files:**
- Modify: `src/lib/i18n/{en,sl}/clones.ts` (extend); `src/lib/clones/view.ts` (from `copyTitle` to the end: Copy to, Move to, `whatGoes`, `placeLabel`, `placeMeta`, `alreadyLine`, `copyButton`, `existingNote`, `copiedToast`, the "Used by" lines), `versions.ts` (`ROW_WORDS`), `twins.ts` (`TWINS_CHIP`, `twinUseMeta`, `twinPickMeta`), `menu.ts`; `src/lib/menu.ts` (`menuLabel`, the items' words); `src/lib/components/clones/CopyToSheet.svelte`, `MoveToSheet.svelte`, `SameAsSheet.svelte`, `VersionsSheet.svelte`, `Versions.svelte`, `ItemMenu.svelte`, `copied.svelte.ts`; `src/lib/components/ui/MenuSheet.svelte` (if part 1 left words); `src/lib/server/clones/clone.ts` (`placeName`'s `'copy'` fallback in the acting person's language; `freeName`'s refusal), `move.ts`, `copy-to.ts` (refusals), `src/lib/server/twins.ts` (words, if any); `src/routes/api/clones/copy/+server.ts`, `move/+server.ts`
- Test: `src/lib/clones/view.spec.ts`, `versions.spec.ts`, `twins.spec.ts`, `menu.spec.ts`, `src/lib/menu.spec.ts`, `src/lib/server/clones/clone.spec.ts` (extend), `src/lib/components/clones/item-menu-placement.spec.ts` (unchanged), `no-english.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 11.
- [ ] **Step 1: Write the failing tests** (sl):
  - `whatGoes({ figures: 2, positions: 5, … })` → starts `'2 različici · 5 položajev'`; with bytes into a team → contains `'1,2 GB'` and the group as the payer.
  - `copiedToast` and `existingNote` in sl.
  - `twinUseMeta` "Used by N routines": 2 → `'Uporabljata 2 kombinaciji'`, 5 → `'Uporablja 5 kombinacij'` (or a colon form `'Uporabljeno v: 2 kombinaciji'` — must agree for 1, 2, 3, 5).
  - The ⋯ menu's labels in sl (`menuLabel` for each item).
  - `freeName`'s refusal in `withLocale('sl', …)` has the move's name after a colon; the copy-name fallback written under sl is `'(kopija)'`, under en `'(copy)'`.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): Copy to, Move to, twins, Versions and the menu in Slovenian`.

### Task 13: Music — the list, adding a song, sharing with a group

**Files:**
- Modify: `src/lib/i18n/{en,sl}/songs.ts` (part 1's area; the plan's `t().music` below is `t().songs`)
- Modify: `src/lib/songs/library.ts` (`songName`'s "Untitled song", `readyMeta`, `songState`, `countOnlyMeta`, `audioFileProblem`, `megabytes` with the decimal comma, `uploadMeta`, `sharedMeta`, `groupSectionHeading`, `classSongNote`, `songUseWarning`, `songDeleteWarning`, `stopSharingTitle`, `deleteSongTitle`, `stopSharingBody`, `deleteSongBody`), `upload.svelte.ts` (messages); `src/lib/components/songs/MusicList.svelte`, `SongRow.svelte`, `AddSongSheet.svelte`, `UploadRow.svelte`, `SampleButton.svelte`; `src/routes/[dance]/songs/+layout.svelte`, `+layout.server.ts`, `+page.svelte`, `+page.server.ts`; `src/routes/api/songs/+server.ts` (refusals the upload shows); `src/lib/server/songs.ts`, `song-share.ts` (refusals)
- Test: `src/lib/songs/library.spec.ts` (extend), `src/lib/components/songs/music-list-forms.spec.ts` (unchanged), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`songs`), part 1 `format`.
- [ ] **Step 1: Write the failing tests** (sl):
  - `songName({ title: '', sourceUrl: null })` → `'Skladba brez naslova'`.
  - `megabytes(1.5 * 1024 * 1024)` → `'1,5'`; `uploadMeta` contains `'1,5 MB'`.
  - `stopSharingBody`/`deleteSongBody` in vikanje; counts of entries through four forms (`'2 vaji'`).
  - A song-upload refusal from `api/songs` (too large), run in `runInLocale('sl', …)`, is Slovenian.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the Music list in Slovenian`.

### Task 14: Music — a song's page, Music on lessons and drills, the song popup

**Files:**
- Modify: `src/lib/i18n/{en,sl}/songs.ts` (extend); `src/lib/songs/song-page.ts` (`songSubtitle`, `tapProblem`, `sampleLabels`, `songSteps`), `timeline.ts` (its words), `search.ts` (`pickerCount`, `songMeta`, section headings), `music.ts` (`MUSIC` read at call time); `src/lib/components/songs/SongDetailsSheet.svelte`, `LiveCount.svelte`, `MusicSection.svelte`, `SongPickSheet.svelte`; `src/routes/[dance]/songs/[id]/+page.svelte`, `+page.server.ts`; `src/routes/[dance]/songs/[id]/grid/+server.ts` (its message, if a person reads it); `src/lib/server/song-links.ts`, `music-form.ts` (refusals)
- Test: `src/lib/songs/song-page.spec.ts`, `search.spec.ts`, `music.spec.ts`, `timeline.spec.ts`, `src/lib/server/music-form.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 13.
- [ ] **Step 1: Write the failing tests** (sl):
  - `pickerCount(n, false)`: `'1 skladba'`, `'2 skladbi'`, `'3 skladbe'`, `'5 skladb'`; `pickerCount(n, true)`: `'1 zadetek'`, `'2 zadetka'`, `'3 zadetki'`, `'5 zadetkov'`.
  - `songSubtitle` with a tempo factor shows a decimal comma where it shows a decimal (e.g. `'0,5×'`).
  - `tapProblem` in vikanje.
  - A Music note over the limit, posted through `music-form.ts` in `runInLocale('sl', …)`, fails in Slovenian.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): a song's page and the song popup in Slovenian`.

### Task 15: The practice player

**Files:**
- Modify: `src/lib/i18n/{en,sl}/player.ts` (part 1's; extend)
- Modify: `src/lib/player/view.ts` (`routineHeading`, `setupSubtitle`, `runSubtitle`, `RUN_SOURCES` → a function, `runSummary`, `playState`, `voiceKind`, `exerciseLine`, `practiceBack`); `src/lib/labels.ts` (every label table part 1 did not move: `PARTNER_LABEL`, `TEMPO_LABEL` is symbols, `COUNT_PATTERN_LABEL`, `SOURCES`' and `STYLES`' labels if drawn — each read at call time); `src/lib/components/player/Setup.svelte`, `Running.svelte`, `SaveSetSheet.svelte`, `SongPicker.svelte`, `SongProgress.svelte`, `SourcePicker.svelte`, `StageCount.svelte` (not `PracticePanel`, `SpeedChips`, `CountChips`, `ClaveChips`: part 1 Task 8); `src/routes/[dance]/player/+page.svelte`, `+page.server.ts`
- Test: `src/lib/player/view.spec.ts` (extend), `src/lib/components/player/setup-desk.spec.ts`, `styles.spec.ts` (unchanged), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`slots`, `figures`), part 1 `exercise` (the set's words) and `format`.
- Produces: `playState(…).label` widens from `'Play' | 'Starting…'` to `string`; `voiceKind` from `'Built-in' | 'Yours'` to a key the component draws (`'builtin' | 'yours'`) or `string` — the builder picks, callers follow.
- [ ] **Step 1: Write the failing tests** (sl):
  - `routineHeading(null, n)`: `'Kombinacija · 1 mesto'`, `'… 2 mesti'`, `'… 3 mesta'`, `'… 5 mest'`.
  - `runSummary(90, n)` contains: 1 → `'1 klicana različica'`, 2 → `'2 klicani različici'`, 3 → `'3 klicane različice'`, 5 → `'5 klicanih različic'`.
  - `playState({ song mode, no song })` → `why` `'Najprej izberite skladbo.'`; `label` `'Predvajaj'`; starting → `'Zaganjanje …'` (U+00A0 before …).
  - `practiceBack` labels `'Nazaj na Danes'`, `'Nazaj na Glasbo'`.
  - Components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the practice player in Slovenian`.

### Task 16: The admin page and What uses space

**Files:**
- Modify: `src/lib/i18n/{en,sl}/admin.ts` (extend part 1's two controls to the whole page), `src/lib/i18n/{en,sl}/settings.ts` (What uses space); `src/lib/admin-view.ts` (`presetLabel` with the decimal comma, `usesLine`, `requestUsesLine`, `personMeta`, `limitsLine`, `groupMeta`, `groupsMadeLine`, `appsLines`); `src/lib/storage-view.ts` (`itemMeta`, `askedLine`; `usageLine` is part 1's); `src/routes/admin/+page.svelte`, `+page.server.ts` (refusals; the GB field read with `readDecimal`, so "1,5" and "1.5" both work); `src/lib/components/admin/InviteQr.svelte`; `src/routes/settings/storage/+page.svelte`, `+page.server.ts`; `src/lib/server/storage.ts` (`roomFor`'s "Not enough room" with sizes, `listStorageItems`' context words and "Untitled song"), `src/lib/server/admin.ts` (its message)
- Test: `src/lib/admin-view.spec.ts`, `src/lib/storage-view.spec.ts`, `src/routes/admin/admin-page.spec.ts`, `src/lib/server/storage.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`people`, `readDecimal`), part 1 `format` (`byteSize`, `dateLabel`).
- [ ] **Step 1: Write the failing tests** (sl):
  - `presetLabel(0.5)` → `'0,5 GB'`; `usesLine(840 MB, 1 GiB)` → `'840 MB od 1,0 GB'`; `usesLine(840 MB, null)` → `'840 MB, brez omejitve'`; `requestUsesLine(840 MB, 1 GiB)` → `'Porabljeno 840 MB od 1,0 GB'`.
  - `groupMeta({ owner: 'Ana Kranjc', people: n, … })` contains `'1 oseba'` / `'2 osebi'` / `'3 osebe'` / `'5 oseb'`.
  - `askedLine('2026-11-02')` → `'Zaprošeno 2. nov. 2026 · čaka'`.
  - The admin's `setLimit` with `gb = '1,5'` stores 1.5 GiB, with `'1.5'` the same, with `'1,5,0'` fails 400.
  - `roomFor`'s refusal in `withLocale('sl', …)` contains `'1,2 GB'` and is vikanje.
  - The admin page and What uses space in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the admin page and What uses space in Slovenian`.

### Task 17: Every remaining refusal, the last pages, and the guard turned round

**Files:**
- Modify: `src/lib/server/scope.ts` (the `error(404, …)` messages: "No such lesson", "Figure not found" …), `files.ts` (`failJson`'s chunk messages a person can see on an upload card; "The file is missing." stays, a media server's), `form.ts` (`refusalText`), any `src/routes/**/+page.server.ts` and `src/routes/api/**/+server.ts` still holding an English `message` (from `grep`; the worker's routes, the media servers, `/releases` and `/api/app-update` excepted), `src/routes/[dance]/+layout.server.ts`, `src/routes/device/pair/+page.svelte`, `+page.server.ts` (the pairing page the app opens), `src/routes/api/count-takes/+server.ts`, `src/routes/api/opens/+server.ts`; `src/lib/i18n/no-english.spec.ts` (turned round)
- Create: `src/lib/i18n/{en,sl}/refusals.ts` (the ones no area owns: not found, too large, offline, a chunk in the wrong place), `src/lib/i18n/refusals-guard.spec.ts`
- Test: `refusals-guard.spec.ts`, `no-english.spec.ts`, `src/lib/server/files.spec.ts`

**Interfaces:**
- Consumes: everything before.
- Produces:
  - `no-english.spec.ts`: `TRANSLATED` becomes every `.svelte` under `src/lib/components` and `src/routes` except `src/routes/dev/**` and an `EXEMPT` list, each entry with a one-line reason (e.g. a component of only icons). A new component is checked by default.
  - `refusals-guard.spec.ts`: scans `src/routes/**/{+page.server.ts,+server.ts,+layout.server.ts}` and `src/lib/server/**/*.ts` (not specs, not `api/worker/**`, `recordings|audio|count|lesson-videos/[file]`, `releases/**`, `api/app-update/**`, `test-*.ts`) for a literal English message: `message: '<Capital>…'`, `fail(\d+, { … '<Capital> …' })`, `error(4\d\d, '<Capital> …')`, `failJson(\d+, '<Capital> …')`. Expected none.
- [ ] **Step 1: Write the failing tests:** `refusals-guard.spec.ts` (fails, listing what is left); `no-english.spec.ts` turned round (fails on anything missed); in `runInLocale('sl', …)`, `requireLessonInWall` on a missing id throws 404 with `'Lekcija ne obstaja.'`; a chunk starting in the wrong place answers 409 `{ message: 'Ta kos se ne začne tam, kjer se datoteka konča.' }` (or the builder's wording) with `x-received-bytes` unchanged.
- [ ] **Step 2: Run** — FAIL (both guards list files).
- [ ] **Step 3: Implement:** translate each listed file; add an `EXEMPT` entry only with a reason.
- [ ] **Step 4: Run**, then `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat(i18n): every refusal in Slovenian; every component checked for English`.

### Task 18: The Android app follows the account's language (1.8)

**Files:**
- Modify (server): `src/lib/server/devices.ts` (`deviceSettings` returns `locale: Locale` too, `users.locale ?? 'en'`), `src/routes/api/device/config/+server.ts` (unchanged body shape plus the field); `src/lib/server/devices.spec.ts` (extend)
- Create (app): `android/app/src/main/kotlin/eu/anotherroot/salsa/Words.kt` (pure: `Words` with `en` and `sl`, `fun wordsOf(locale: String?): Words`), `Plural.kt` (pure: `slForm(n: Int)`, `slCount(n, one, two, few, other)`), `android/app/src/test/kotlin/eu/anotherroot/salsa/WordsTest.kt`, `PluralTest.kt`, `android/app/src/salsa/res/values-sl/strings.xml`, `android/app/src/bachata/res/values-sl/strings.xml` (`share_label` only: Android's share sheet draws it in the phone's language, the one native word the app cannot choose)
- Modify (app): `Api.kt` (`Config.locale: String?`, `parseConfig` reads it with `optString`/`isNull`, null when absent), `Prefs.kt` (`locale`, `setLocale`), `Reminders.kt` (`ConfigWorker` stores the locale and re-creates the channels when it changed; `ReminderWorker` fetches `Api.config` before `Api.today`, so a change in Settings reaches the next reminder without a relaunch; its foreground text from `Words`), `Reminder.kt` (`reminderText(due, words)`), `Notify.kt` (channel names, `unpaired`, `updateNeeded` from `Words`), `UploadWorker.kt` (every literal), `LinkActivity.kt` ("Phone paired", the background-upload toast), `ShareActivity.kt` (the dialog and toast), `WebShell.kt` (`no_app_for_link`, `downloading` from `Words`), `Links.kt` (`Upload.name` nullable; the "the lesson" fallback moves to `Words`), `AppStart.kt` (channels from the stored locale), `res/values/strings.xml` (drop the two moved strings), `app/build.gradle.kts` (`versionCode = 9`, `versionName = "1.8"`; today 8 / 1.7); tests `ApiTest.kt`, `ReminderTest.kt`, `LinksTest.kt` (the fallback assertion changes: the signature changed)
- Modify (docs): `docs/superpowers/specs/2026-10-14-android-app-design.md` (a short note: the account's language from `/api/device/config`, `Words.kt`, `share_label` the exception)

**Interfaces:**
- Consumes: part 1 Task 2 (`users.locale`).
- Produces: `/api/device/config` → `{ reminderMinute, shortSide, locale: 'en' | 'sl' }`. `/api/device/today` is NOT changed (older apps read every key of it as a dance). `Words`: `reminderTitle(n)`, `channelUploading`, `channelResults`, `channelReminder`, `checkingDue`, `preparing`, `compressing`, `uploading`, `pairAgainTitle`, `pairAgainBody`, `updateAppTitle(app)`, `updateAppBody(app, video)`, `couldNotAdd(video, lesson)`, `keptFailing`, `notAVideo`, `couldNotKeep`, `emptyVideo`, `phonePaired`, `uploadingInBackground(n, lesson)`, `gettingReady`, `couldNotRead`, `noAppForLink`, `downloading(name)`, `theLesson`.
- [ ] **Step 1: Write the failing tests:**
  - Server: after `setLocale(db, id, 'sl')`, `deviceSettings(db, id).locale` is `'sl'`; a user with null → `'en'`.
  - `PluralTest`: `slForm` 1 one, 2 two, 3 few, 4 few, 5 other, 11 other, 101 one, 102 two.
  - `WordsTest` (sl): `reminderTitle(1)` → `"1 vaja na vrsti"`, 2 → `"2 vaji na vrsti"`, 3 → `"3 vaje na vrsti"`, 5 → `"5 vaj na vrsti"`; `uploadingInBackground(1, "Torek")` → `"Nalaganje v ozadju: Torek"`, `(2, "Torek")` → `"Nalaganje 2 videov v ozadju: Torek"`, `(5, …)` → `"Nalaganje 5 videov v ozadju: Torek"` (genitive); `phonePaired` → `"Telefon je povezan"`; `pairAgainTitle` → `"Znova povežite telefon"`. `wordsOf(null)`, `wordsOf("xx")` are English: `reminderTitle(1)` → `"1 exercise due"`, 2 → `"2 exercises due"` (today's text, unchanged).
  - `ApiTest`: `parseConfig("""{"reminderMinute":null,"shortSide":480,"locale":"sl"}""").locale` is `"sl"`; without the key it is null.
  - `ReminderTest`: `reminderText(listOf("A","B"), wordsOf("sl"))` → `("2 vaji na vrsti", "A, B")`; the "+N" rule unchanged.
- [ ] **Step 2: Run** `timeout 300 npx vitest run src/lib/server/devices.spec.ts` and `nix develop .#android -c ./android/gradlew -p android test` — Expected: FAIL.
- [ ] **Step 3: Implement.** No new permission, no new endpoint. Notification channels are renamed by creating them again with the same id.
- [ ] **Step 4: Run** both, then `nix develop .#android -c ./android/gradlew -p android test assembleDebug` and `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(android): the app's own words in the account's language; version 1.8 (9)`. The release (`scripts/release.sh`) is the user's to run; say so in the report.

### Task 19: Look at it, fix what is left, write it down

**Files:**
- Modify: any file where English or a cut-off line is found; `CLAUDE.md` (Layout: the part-2 areas in `src/lib/i18n/`, `nouns`, `number.ts`, `refusals-guard.spec.ts`, `android/.../Words.kt`; the hard rule from part 1 gains "a count after a verb or preposition is its own entry, in its case"), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the two-languages section: everything is translated; machines keep English), `scripts/shots/README.md` if a flag was added

- [ ] **Step 1:** In a db copy, set the admin's level to `all` (`--level all`, part 1 Task 12's flag) and shoot `pages.txt`, `pages-4.txt`, `pages-card.txt`, `pages-signed-out.txt` at 390×844 and at desktop (`--viewport`, 1280×800), `--locale sl`, plus `--scenes all` and the same with `--group <id>` (group mode). Expected: every page `ok`, no `OVERFLOW`.
- [ ] **Step 2:** Read every screenshot. List every English word left (people's own text and the count's Spanish excepted) and every Slovenian line that is cut, wraps badly or pushes a button off (Slovenian runs ~20 % longer: the band's subtitle, chips, the tab bar, the ⋯ menu, Segmented controls).
- [ ] **Step 3:** Fix each, re-shoot those pages; Expected: none left.
- [ ] **Step 4:** Shoot the same with `--locale en` and `diff` against shots of `master` (a worktree of master, the same db copy). Expected: only part 1's allowed differences (the Settings Language row, the admin's invite language and per-person select).
- [ ] **Step 5:** Update CLAUDE.md and the design spec; `npm run check` — PASS.
- [ ] **Step 6: Commit** `docs(i18n): the whole app in two languages; fixes from the screenshots`.
