# Link from other places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Here: **native** (the user's choice), per CLAUDE.md "Building in a slot".

**Goal:** On a group's lesson, the linking pickers and the Link popup also find, while searching, the person's own rows and other groups' rows; picking one opens a card and Copy and link copies it into the group as a clone and links it.

**Architecture:** A new server module finds the candidates (`elsewhere.ts`) behind a new network GET endpoint the picker asks while searching. The card reads the existing Copy to… plan endpoint, grown by a "stays behind" count and the group's storage. Copy and link is `copyTo` with the link as its `after` hook (`link-elsewhere.ts`), behind a new lesson action and a new popup route, both network. The shared `Picker` grows an `elsewhere` part; a new `CopyHereCard` draws the card.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle/SQLite (better-sqlite3), vitest, Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-11-10-link-from-other-places-design.md`

## Global Constraints

- Words through `t()`, en **and** sl catalogs (vikanje, `slCount`, » «); `no-english.spec.ts`, `refusals-guard.spec.ts` pass.
- Reads ask `access.ts` (`teamReader`, roles); never filter by `.dance` alone. Another's id and a missing one: the same 404.
- Every group mutation logs in its transaction (`logChange` through the link and copy functions, never bypassed).
- New GET endpoint, new lesson action and new popup route are `network` in `src/lib/offline/routes.ts`; `/api/video-spots/[id]/links` POST stays `device`.
- No migration, no `PAGE_EPOCH` raise. Server time via `serverNow()`.
- Components never import `$lib/server`; shared shapes in `src/lib/types.ts`.
- A built control's colour is the builder's (`class-rules.spec.ts`): no `text-*` appended to a built class.
- After each task: `npx vitest run <its specs> --maxWorkers=4`, `npx eslint` + `npx prettier --check` on changed files, commit. Full `npm run check` only before the final review.

## Review Focus

1. **A link refusal after a fresh copy** (the lesson's group changed, the row went) must leave no copy behind — the hook throws, the copy rolls back. Test in Task 3.
2. **A read-only group's rows outside the person's reach** must never be listed (drafts, unpublished lessons' figures). Test in Task 1.
3. **A family already live in the group via a twin choice** — `copyTo` answers `made: false` for the chosen twin's member; it is linked, not copied. Test in Task 3.
4. **Same name, different case or accents** ("Cradle Entry · básic") counts as the same name for the warning. Test in Task 1.
5. **A person who only reads the target group** (a member, not editor) gets a 404 from the endpoint, the action and the route. Tests in Task 4.

---

### Task 1: The candidates (`elsewhere.ts`)

**Files:**
- Create: `src/lib/server/elsewhere.ts`, `src/lib/server/elsewhere.spec.ts`
- Modify: `src/lib/types.ts` (new shapes)

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type ElsewhereKind = 'figure' | 'routine' | 'drill' | 'position';
  export type ElsewhereRow = {
    kind: ElsewhereKind; id: number;
    label: string;            // "Cradle entry · Basic", a routine/drill/position name
    heading: string | null;   // a figure's move name ("Cradle entry"), else null
    short: string | null;     // a figure's variation name ("Basic"), else null
    alsoIn: string[];         // the other places' names, in place order ("Yours" never: mine is first)
    restore: number | null;   // the family's archived member in the group
    sameName: number | null;  // a live same-named group row of another family
  };
  export type ElsewherePlace = {
    place: { kind: 'mine' } | { kind: 'team'; teamId: number; name: string };
    readOnly: boolean;
    rows: ElsewhereRow[];
  };
  ```
- Produces (elsewhere.ts):
  `findElsewhere(db: Db, group: TeamSpace, kinds: ElsewhereKind[], query: string): ElsewherePlace[]`
  `staysBehind(db: Db, kind: ElsewhereKind, id: number): number`

Rules (`findElsewhere`), from the spec's "What shows once":
- Places in order: mine; then live groups of `group.dance` from `listMyTeams` where role is owner/editor, by name; then those where the person is a member, by name. Skip `group.teamId` and any `deletedAt !== null`.
- Rows per place: live rows of each kind (figures: `listVersions(db, space)` then `foldVersions`; routines: `listPickRoutines` then `foldNamed(…, 'routine', …)`; drills: live `exercises` with `source = 'custom'` owned by the space; positions: `listPositions`). In a member's group keep only what `teamReader(db, userId, teamId)` reads (`'figure'`, `'routine'`, `'drill'`, `'position'`).
- Match: every word of `fold(query)` in `fold(heading + label)`; an empty query returns `[]`.
- Hide a row whose family (`geneOf`) has a **live** `memberIn(…, group)`; an archived member sets `restore`.
- Same family in several places: one row, in the first place; the others' names go in `alsoIn` (team names; mine never appears in `alsoIn` because it is always first).
- Twins (figure, routine only): hide a row when `twinsOf(db, userId, kind, id)` holds a live row of `group`.
- `sameName`: a live row of the group of the same kind, of another family (gene differs or null), whose `fold(label)` equals the row's `fold(label)`.
- At most 50 rows overall (cut the last places' tails); places left with no rows are dropped.

`staysBehind`: figure → `spot_links` rows with `figure_id = id` whose spot has a `lesson_video_id`; drill → same with `exercise_id`; position → `spot_position_links` rows whose spot has a `lesson_video_id`; routine → 0.

- [ ] **Step 1: Write the failing tests** in `elsewhere.spec.ts`, fixtures as `clones/copy-to.spec.ts` (u1 owns T1 and edits T2; u2 a member of T1; add a group T3 where u1 is a member). Tests:
  - `finds my own and my other groups' rows, mine first` — u1's figure "Cradle entry · Basic" and T2's "Cradle exit · With turn"; `findElsewhere(db, T1, ['figure'], 'cradle')` → places `[mine, T2]`, labels as made.
  - `an empty query finds nothing` → `[]`.
  - `a read-only group lists only what the person reads` — T3 draft lesson's figure absent; after publishing a lesson linking it, present with `readOnly: true`.
  - `a family live in the group is left out; an archived one carries restore` — copy into T1 via `copyTo`, row gone; `archiveVariation` the copy → row back with `restore` = copy id.
  - `one row per family, in the first place, alsoIn the rest` — u1's figure copied to T2; one row under mine, `alsoIn: ['Rueda club']`.
  - `a row whose twin is live in the group is left out` — `markTwins` u1's row with a T1 row.
  - `sameName folds case and accents` — T1 has unrelated "Cradle Entry · básic"; u1's "Cradle entry · Basic" carries its id.
  - `drills and positions` — one of each found by name.
  - `staysBehind counts lesson-video links only` — a figure linked from a lesson video section (counts) and from its own recording's section (not).
- [ ] **Step 2:** `npx vitest run src/lib/server/elsewhere.spec.ts --maxWorkers=4` → FAIL (module missing).
- [ ] **Step 3:** Implement the types and `elsewhere.ts` as above.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** eslint/prettier on the files; commit `elsewhere: find a group's candidates in your app and other groups`.

### Task 2: The card's data

**Files:**
- Modify: `src/routes/api/clones/copy/+server.ts`, `src/lib/types.ts`
- Test: `src/routes/api/clones/copy/copy-plan.spec.ts` (create; mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does)

**Interfaces:**
- Consumes: `staysBehind` (Task 1), `copyTargets` (copy-to.ts).
- Produces: `export type CopyHereView = CopyPlanView & { staysBehind: number; usedBytes: number; limitBytes: number }` — the GET's answer (extra fields; the Copy to… sheet ignores them). `staysBehind` is 0 for song/lesson; `usedBytes`/`limitBytes` from the `copyTargets` entry `into` names.

- [ ] **Step 1:** Test `the plan carries stays-behind and the group's storage`: GET for a figure into T1 → `staysBehind` 1, `limitBytes` equals `copyTargets(...)`'s for T1.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `clones: the copy plan says what stays behind and the place's room`.

### Task 3: Copy and link (`link-elsewhere.ts`)

**Files:**
- Create: `src/lib/server/link-elsewhere.ts`, `src/lib/server/link-elsewhere.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Linker = (tx: Db, id: number) => boolean;   // a lesson link function, or a spot link
  export type CopyLinkResult =
    | { ok: true; id: number; made: boolean }
    | { ok: false; restore: number }                       // the family's archived member: offer Restore and link
    | { ok: false; reason: 'room' | 'name' | 'denied' | 'refused'; message?: string };
  export async function copyAndLink(db, actorId, kind: ElsewhereKind, id, group: TeamSpace,
    use: Record<string, number>, link: Linker, files: CloneFiles, now: number, freeDisk: number): Promise<CopyLinkResult>
  export function restoreAndLink(db, actorId, kind, id, group, memberId: number,
    use: Record<string, number>, link: Linker, now: number): CopyLinkResult
  export function lessonLinker(kind: ElsewhereKind, lessonId: number, by: string): Linker   // linkFigure / linkRoutine / linkExercise / linkPosition
  export function spotLinker(kind: ElsewhereKind, space: TeamSpace, spotId: number): Linker // linkInSpace / linkPositionInSpace, true on success
  ```
- `copyAndLink`: `copyTo(…, kind === 'drill' ? 'drill' : kind, …, { after: (tx, r) => { if (!link(tx, r.id)) throw new LinkRefused() } })`; catch `LinkRefused` → `refused`. `made: false`, live → `link(db, id)` (false → `refused`); archived → `{ ok: false, restore }`. `room` → its refusal text (`message`), `name` → its message.
- `restoreAndLink`: `restoreMember` (null → `denied`, `!ok` → `refused` with its message), then link.
- `spotLinker` catches `SpotLinkError` and answers false.

- [ ] **Step 1: Tests** (fixtures as Task 1, a T1 draft lesson):
  - `copies into the group and links, one family` — lesson links the new copy; `geneOf(copy) === geneOf(source)`.
  - `a refused link leaves no copy` — linker returns false → `refused`, no new figure row in T1 (Review Focus 1).
  - `a live member is linked, not copied` — and via a twin `use` choice (Review Focus 3).
  - `an archived member answers restore; restoreAndLink restores and links`.
  - `a reader of the group is denied` — u2 (member of T1) → `denied`.
  - `spotLinker links a section of a group's lesson video` (figure) and a point (position).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `link-elsewhere: copy into the group and link, in one transaction`.

### Task 4: Endpoint, lesson action, popup route

**Files:**
- Create: `src/routes/api/elsewhere/+server.ts`, `src/routes/api/video-spots/[id]/copy-link/+server.ts`, `src/routes/api/elsewhere/elsewhere.spec.ts`
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (action `copyLink`), `src/lib/offline/routes.ts`, `src/lib/server/link-popup.ts` + `src/lib/types.ts` (`LinkOptions.teamId: number | null`, the spot's group, null for a person's), i18n `refusals` (en, sl)

**Interfaces:**
- `GET /api/elsewhere?into=<teamId>&kinds=figure,drill&q=<text>` → `ElsewherePlace[]`. 404 unless `roleOf` is owner/editor of a live group of the account's dance. Kinds outside `ElsewhereKind` → 404.
- Lesson action `?/copyLink`: form `kind`, `id`, `use` (JSON, `useFrom`), optional `restore`. Lesson must be a group's and editable (as the other link actions check). Answers `{ action: 'copyLink', ok: true, id, made }`, `{ action: 'copyLink', restore }`, or `fail(400|409, { action: 'copyLink', message })`. Words: `t().lesson.refused.copyLink` for `refused`/`denied`.
- `POST /api/video-spots/[id]/copy-link` JSON `{ kind, id, use, restore? }`: the spot's space must be a group the person edits (`linkOptionsFor` non-null and `teamId` set), else 404; on success `flowAfter` as the links POST does and answers `linkOptionsFor`; `{ restore }` with 409; refusals `{ message }` 4xx.
- routes.ts: `'/api/elsewhere'` GET `network`; `'/[dance]/lessons/[id]'` `copyLink: 'network'`; `'/api/video-spots/[id]/copy-link': { POST: 'network' }` (and the GET list if every route must be listed).

- [ ] **Step 1: Tests:** `a member of the group gets a 404` (endpoint, Review Focus 5); `an editor gets places`; the routes classification spec (`src/lib/offline/*.spec.ts`) covers the new entries. Action/route: one test each through the module functions they call is enough (Task 3 covers behaviour); add a 404 test for the popup route with a person's own spot.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run those specs plus `src/lib/offline` specs and `refusals-guard.spec.ts` → PASS. **Step 5:** Commit `link from other places: the list endpoint, Copy and link action and route`.

### Task 5: The picker's other places

**Files:**
- Create: `src/lib/picker/elsewhere.ts`, `src/lib/picker/elsewhere.spec.ts`, `src/lib/picker/elsewhere-api.ts`
- Modify: `src/lib/picker/model.ts` (`PickGroup.icon?: IconName`, `PickGroup.tone?: 'warn'`, `PickRow.warn?: boolean`), `src/lib/components/picker/Picker.svelte`, i18n `picker` (en, sl)

**Interfaces:**
- `elsewhereGroups(places: ElsewherePlace[]): PickGroup[]` — one group per place: title "Yours" (icon `person`), a group's name (icon of groups), a read-only one "Tuesday class · you only read it" (icon `lock`, `tone: 'warn'`). Figures under their move heading (`PickHeading`, `collapse: true`); others flat. Row `key` `elsewhere:<kind>:<id>`, `value` id, `meta` "also in A, B" — or, with `sameName`, "This group has its own" and `warn: true`.
- `elsewhereRow(key): { kind, id } | null`.
- `fetchElsewhere(into: number, kinds: ElsewhereKind[], q: string, signal): Promise<ElsewherePlace[]>`.
- Picker prop `elsewhere?: { here: string; state: 'loading' | 'offline' | 'ready'; groups: PickGroup[] }` and callback `onelsewhere?: (row: PickRow, keep: boolean) => void`. While the query is typed and `elsewhere` is set: the own rows sit under `here` as heading; no own match → the one-line "Nothing here matches “…”." (`emptyText`), not the full empty box; then the other places' groups (prefiltered, the server matched) with `+` trails whose tap and `+` both call `onelsewhere`; `offline` → one muted line "Other places need a connection."; `loading` → a small spinner line. Empty query: no change from today.
- Group title with `icon`/`tone`: icon before the title; `warn` draws title and icon in the warn token.

- [ ] **Step 1:** Tests for `elsewhereGroups`: titles and order, read-only tone, figure heading/short, `also in` meta, sameName meta + warn, keys round-trip through `elsewhereRow`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (model, helper, api, Picker). **Step 4:** Run the new spec + `src/lib/picker` specs + `no-english.spec.ts` → PASS. **Step 5:** Commit `picker: other places while searching`.

### Task 6: The card

**Files:**
- Create: `src/lib/components/links/CopyHereCard.svelte`, `src/lib/clones/copy-here.ts` (+ spec)
- Modify: i18n `clones` (en, sl)

**Interfaces:**
- `copyHereLines(view: CopyHereView, from: string /* place name or "yours" */, into: string): { title; lead; comes: string[]; already: string[]; behind: string | null; room: string | null }` — pure. `behind` null when 0 or routine; `room` the Copy to… refusal text when `usedBytes + bytes > limitBytes`.
- Component props: `open`, `theme: 'light' | 'dark'`, `kind`, `id`, `label`, `from`, `into: { teamId; name }`, `sameName: number | null`, `restore: number | null`, `busy`, `message`, `oncopy(use)`, `onrestore(use)`, `onlinkgroups()`, `onclose()`. Loads `/api/clones/copy?kind&id&into=<teamId>` on open (spinner, failure banner). Twin questions as the Copy to… sheet asks them (reuse its question markup if it is a component; else radios per `twins[]`). Buttons: Cancel + **Copy and link** (primary; disabled with `room`); with `restore`: **Restore and link**; with `sameName`: warning banner on top, **Link the group's one** primary, **Copy anyway** tertiary, Cancel.
- Light: `Sheet`; dark: `PlayerLayer` (`z` above the picker level).

- [ ] **Step 1:** Tests for `copyHereLines` (behind for figure/position, none for routine, room line, title words).
- [ ] **Step 2–4:** FAIL → implement → PASS (+ `no-english.spec.ts`, `class-rules.spec.ts`).
- [ ] **Step 5:** Commit `clones: the Copy and link card`.

### Task 7: The lesson page

**Files:** Modify `src/routes/[dance]/lessons/[id]/+page.svelte` (and `+page.server.ts` load: `group: { teamId, name } | null` when the lesson is a group's and `canEdit`).

- Each of the four pickers gets `elsewhere` when `data.group`: a debounced (300 ms) `fetchElsewhere(group.teamId, [kind], query)` on the bound query, aborting the last; offline (`navigator.onLine === false` or a failed fetch) → `state: 'offline'`. Kind map: exercise picker → `'drill'`.
- `onelsewhere` opens `CopyHereCard`; Copy and link / Restore and link post `?/copyLink` through a hidden form (`use:enhance`, as the link forms). Success: card closes; a tap closes the picker, a `+` keeps it (added += 1, re-fetch so the row leaves the other places). A toast "Copied and linked" (the page's toast). `restore` answer → the card switches to Restore and link. Refusal → the card's message.
- Link the group's one → the existing `link(kind, row)` with the group row's id.

- [ ] Steps: wire it; `npx svelte-check --threshold error` on the page; shoot `lo-figures-cradle` light (Task 9 shoots the rest); commit `lessons: link from other places in a group's pickers`.

### Task 8: The Link popup

**Files:** Modify `src/lib/components/links/LinkPopup.svelte`, `src/lib/video/links-api.ts` (`copyLink(spotId, body)` → `LinkOptions`, a `restore` 409 surfaced on `SpotsApiError`).

- When `options.teamId` is set: `elsewhere` on the picker with kinds `['position']` for a point, else `['figure','drill','position']`, same debounce/offline rule. The card in `theme`; Copy and link → `copyLink`, then `changed(...)`; tap closes the popup (`onclose`), `+` keeps it. Link the group's one → `addLink(spotId, target)`.
- `+ Variation`'s figure field is not touched.

- [ ] Steps: wire it; svelte-check; shoot `lo-popup-cradle`; commit `links: the Link popup finds other places on a group's video`.

### Task 9: Screens, docs, full check

- [ ] Shoot every scene of `scripts/shots/ext_link_other.py` light and dark (the README's command, bachata db copy); look at each; fix what is off.
- [ ] `docs/features.md`: the feature, linked to the spec; `docs/layout.md`: `elsewhere.ts`, `link-elsewhere.ts`, `picker/elsewhere.ts`, `clones/copy-here.ts`, `CopyHereCard.svelte`; spec status "built".
- [ ] `npm run check` → passes. Commit.
- [ ] One review of the whole branch (fresh reviewer, the spec beside it), then fixes.
