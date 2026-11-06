# Figure page rework, plan 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The figure page shows the video first, then the facts, then one Recordings list with `+ Add`, then Follows from / Leads to / In routines as three rows that open searchable sheets, then Taught in.

**Architecture:** Only the page and new figure components change; the load (`+page.server.ts`) and every action stay as they are. Wording, counts, sorting and filtering are pure functions in `src/lib/figures/page.ts` with specs; the components draw them. `UploadButton` gains an opt-in way to be opened from elsewhere and drawn without its button, so the upload stays owned by the page.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4 with the app's tokens, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-figure-page-rework-design.md` (read it first; "The page (phone order)" is the order, "The approved mockup" the sizes).

## Global Constraints

- Plan 1 only: no ⋯ menu, no Practice change, Links section unchanged, Move and Archive rows unchanged.
- Do not edit `LinksEditor`, `SourceTabs`, anything in `components/clones/`, `VideoPlayer.svelte`, `SectionCard.svelte`, `VideoFrame.svelte` (other slots' areas). `UploadButton.svelte` only gains opt-in props; every other caller looks and behaves as before.
- No audio uploads: the web `accept` is `video/*`; old audio recordings stay playable.
- No change to the load's data or any form field or action: no `PAGE_EPOCH` raise.
- Colours only through the builders (`button`, `iconButton`, `GROUP`, `SECTION_LABEL`); never append a `text-*` to a builder's output (`class-rules.spec.ts`).
- Words: "Recordings", "Add", "Add to Recordings" (aria-label), "Add to {figure label}" (sheet title), "Link a section" / "A part of a lesson video", "Video from the phone", "Follows from", "Leads to", "In routines", "None", "Positions", "This file is missing", "Can’t play here", "Download".
- `npm run check` must pass at the end.

## Review Focus

1. A recording whose file is gone or will not decode: its row says so (`status` text), does not open a black player, and an unplayable one offers Download. (Task 3's row probe; checked in the browser in Task 5.)
2. An upload started from the `+ Add` sheet, then the sheet closes: the progress card shows in Recordings and the new row appears when it finishes. (Task 4; browser check in Task 5.)
3. Search in a relation sheet with accents and case: "dile" finds "Dile que no · Basic", "exhibela" finds "Exhíbela". (Task 1 test `filterRows`.)
4. A reader of a group's figure with no sections and no recordings sees no Recordings heading and no `+ Add`; with no routines, In routines reads "None" and is not a button. (Task 1 tests `relationRows`, `showRecordings`.)
5. Edit mode: the top video and the three-row card are hidden with the rest of the left column; each recording row ends in its trash, each section row in Unlink, and deleting focuses the next row as today. (Browser check in Task 5.)

---

### Task 1: The page's words and lists (pure)

**Files:**
- Modify: `src/lib/figures/page.ts`
- Test: `src/lib/figures/page.spec.ts`

**Interfaces:**
- Produces (all exported from `$lib/figures/page`):
  - `type TopVideo<S, R> = { kind: 'section'; section: S } | { kind: 'recording'; recording: R } | null`
  - `topVideo<S, R extends { kind: 'video' | 'audio' }>(sections: S[], recordings: R[]): TopVideo<S, R>` — first section, else first `kind === 'video'` recording, else null.
  - `recordingsTitle(n: number): string` — `'Recordings'` at 0, else `` `Recordings · ${n}` ``.
  - `recordingMetaLine(kind: 'video' | 'audio', size: string): string` — `'Video · 24 MB'` / `'Audio · 2 MB'` (size is already `byteSize`'d).
  - `showRecordings(i: { canEdit: boolean; items: number }): boolean` — `canEdit || items > 0`.
  - `type RelationKey = 'follows' | 'leads' | 'routines'`
  - `relationRows(c: { follows: number; leads: number; routines: number }): { key: RelationKey; label: string; count: string; opens: boolean }[]` — labels "Follows from", "Leads to", "In routines"; `count` is the number as text or `'None'` at 0; `opens` is `n > 0`.
  - `relationTitle(key: RelationKey, n: number): string` — "Follows from", "Leads to", "In 1 routine" / "In 10 routines".
  - `sortRoutines<T extends { name: string; loops: boolean }>(uses: T[]): T[]` — looping first, then by name (`localeCompare`, case-insensitive), a new array.
  - `filterRows<T extends { name: string }>(rows: T[], q: string): T[]` — every space-separated word of `fold(q)` is in `fold(row.name)`; an empty or blank `q` returns `rows`.

- [ ] **Step 1: Write the failing tests** in `page.spec.ts`, one `describe` per function:

```ts
expect(topVideo([{ id: 1 }], [{ id: 9, kind: 'video' }])).toEqual({ kind: 'section', section: { id: 1 } });
expect(topVideo([], [{ id: 8, kind: 'audio' }, { id: 9, kind: 'video' }])).toEqual({ kind: 'recording', recording: { id: 9, kind: 'video' } });
expect(topVideo([], [{ id: 8, kind: 'audio' }])).toBeNull();
expect(recordingsTitle(0)).toBe('Recordings');
expect(recordingsTitle(3)).toBe('Recordings · 3');
expect(recordingMetaLine('video', '24 MB')).toBe('Video · 24 MB');
expect(recordingMetaLine('audio', '2 MB')).toBe('Audio · 2 MB');
expect(showRecordings({ canEdit: false, items: 0 })).toBe(false);
expect(showRecordings({ canEdit: true, items: 0 })).toBe(true);
expect(showRecordings({ canEdit: false, items: 1 })).toBe(true);
expect(relationRows({ follows: 22, leads: 0, routines: 10 })).toEqual([
	{ key: 'follows', label: 'Follows from', count: '22', opens: true },
	{ key: 'leads', label: 'Leads to', count: 'None', opens: false },
	{ key: 'routines', label: 'In routines', count: '10', opens: true }
]);
expect(relationTitle('routines', 1)).toBe('In 1 routine');
expect(relationTitle('routines', 10)).toBe('In 10 routines');
expect(relationTitle('follows', 22)).toBe('Follows from');
expect(sortRoutines([
	{ name: 'slow song', loops: false }, { name: 'Warm-up', loops: true },
	{ name: 'Competition', loops: true }, { name: 'Adios run', loops: false }
]).map((r) => r.name)).toEqual(['Competition', 'Warm-up', 'Adios run', 'slow song']);
const rows = [{ name: 'Dile que no · Basic' }, { name: 'Exhíbela · Basic' }, { name: 'Setenta · Basic' }];
expect(filterRows(rows, 'dile').map((r) => r.name)).toEqual(['Dile que no · Basic']);
expect(filterRows(rows, 'EXHIBELA').map((r) => r.name)).toEqual(['Exhíbela · Basic']);
expect(filterRows(rows, 'basic set').map((r) => r.name)).toEqual(['Setenta · Basic']);
expect(filterRows(rows, '  ')).toBe(rows);
```

- [ ] **Step 2: Run** `npx vitest run src/lib/figures/page.spec.ts` — expect FAIL (not exported).
- [ ] **Step 3: Implement** the functions above in `page.ts` (import `fold` from `$lib/fold`).
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(figure): the reworked page's words, counts and search`.

### Task 2: `UploadButton` can be opened from elsewhere

**Files:**
- Modify: `src/lib/components/ui/UploadButton.svelte`

**Interfaces:**
- Produces: two optional props, defaults keeping today's behaviour:
  - `bare?: boolean` (default `false`) — the trigger button is not drawn; the file input, the progress card and the failure message are.
  - `chooser = $bindable<(() => void) | undefined>()` — set on mount to a function that opens the file input (`input.click()`), for a caller that starts the choice from its own control.

- [ ] **Step 1: Implement** both props. With `bare`, render nothing at all while idle and without a message (no empty box taking a gap).
- [ ] **Step 2: Verify** `npm run check` passes and the other callers are unchanged (`grep -rn "<UploadButton" src` — none passes the new props).
- [ ] **Step 3: Commit** `feat(upload): an upload button another control can open`.

### Task 3: The figure page's new pieces

**Files:**
- Create: `src/lib/components/figures/TopVideo.svelte`
- Create: `src/lib/components/figures/SectionRow.svelte`
- Create: `src/lib/components/figures/RecordingRow.svelte`
- Create: `src/lib/components/figures/RelationsCard.svelte`
- Create: `src/lib/components/figures/AddRecordingSheet.svelte`

**Interfaces:**
- Consumes: Task 1's functions; `SectionPlayer`, `VideoPlayer` (`startAt`, `mirror`, `rate`, `muted`, `onchoose`, `onclose`, `title`, `linking`, `canEdit`), `loadVideoPrefs`/`saveVideoPrefs`, `watchMedia`, `spotLabel`, `dateLabel`, `Sheet`, `SearchField`, `Icon`, `GROUP`, `button`, `iconButton`, `gotoWhenSettled`.
- Produces:
  - `TopVideo` props: `top: TopVideo<LinkedSection, Recording>` (non-null), `title: string` (the figure label), `day: string` (for a recording's caption), `linking: boolean`, `canEdit: boolean`, `onclosed: () => void`. A 16:9 card (`rounded-2xl`, `CLIP`), the picture a `<video preload="metadata" muted playsinline src="{src}#t={start}">` without controls, a 56 px play disc in the middle, the caption strip at the foot (white 13/600 on a dark gradient): a section's `spotLabel` · where it is from · its range; a recording's "Recording · {day}". The whole card is one button ("Play {label}"); a tap opens `SectionPlayer` (section) or `VideoPlayer` at 0 (recording); `onclosed` runs after the player closes.
  - `SectionRow` props: `section: LinkedSection`, `focusKey: string`, `canEdit: boolean`, `trailing?: Snippet`. `SectionCard`'s content as a 60 px row (40 px accent play disc, label 16/700, "from · range" 13 muted) inside the parent's `GROUP`; tap opens `SectionPlayer`; `trailing` (Unlink while editing) replaces the repeat icon.
  - `RecordingRow` props: `recording: { id: number; file: string; kind: 'video' | 'audio'; sizeBytes: number; createdAt: number; sourceUrl: string | null }`, `day: string`, `title: string`, `linking: boolean`, `canEdit: boolean`, `trailing?: Snippet`, `onclosed: () => void`. A 60 px row: 40 px `bg-chip` lead with `video` or `mic`, the day as title, `recordingMetaLine` as meta. A hidden `<video preload="metadata">` (or the `<audio>` itself) carries `{@attach watchMedia(...)}`; on `missing` the meta becomes "This file is missing" in `text-status` and the row stops being a button; on `unplayable` it reads "Can’t play here" and the trailing slot (when no `trailing` is given) is a tertiary sm Download link to `/recordings/{file}`. A video row's tap opens `VideoPlayer` at 0 with `owner={{ recordingId }}`; an audio row shows a native `<audio controls>` under its title instead of opening anything.
  - `RelationsCard` props: `follows: { id: number; name: string }[]`, `leads: { id: number; name: string }[]`, `routines: RoutineUse[]`, `mine: RoutineUse[]`, `mineLabel: string | null` (the group's name when `mine` is the person's own beside a group's, else null), `figureHref: (id: number) => string`, `routineHref: (id: number) => string`. One `GROUP` of the three `relationRows`: 52 px rows, label 16/700, count 16/700 `text-muted`, chevron; a row with `opens: false` is a plain `div`. A tap opens one `Sheet` titled `relationTitle(...)` with a `SearchField` ("Search figures" / "Search routines") and the filtered rows (`filterRows`); routines sorted with `sortRoutines`, meta `routineUseMeta` plus " · loops" in `text-done`; with both groups, two `SECTION_LABEL` headings, the group's name and "Yours". A row tap closes the sheet and `gotoWhenSettled(href)`. The search clears when the sheet opens.
  - `AddRecordingSheet` props: `open: boolean`, `onclose: () => void`, `figureLabel: string`, `app: boolean`, `appHref: string`, `onsection: () => void`, `onvideo: () => void`. Title "Add to {figureLabel}"; a `GROUP` of rows (56 px, accent-text icon): "Link a section" with "A part of a lesson video" (`scissors`), then "Video from the phone" (`video`). On the web the video row is a button that calls `onclose()` then `onvideo()` in the same click; in the app (`app`) it is the `AppUploadLink`'s `href` as a plain row link.

- [ ] **Step 1: Build the five components** to the props above. Reuse `SectionCard`'s `from` and range wording by copying its two `$derived`s, not by editing `SectionCard`.
- [ ] **Step 2: Verify** `npm run check` passes (svelte-check, eslint, `class-rules.spec.ts`, `focus-clip.spec.ts`).
- [ ] **Step 3: Commit** `feat(figure): the top video, recording and section rows, the relations card, the add sheet`.

### Task 4: The page in its new order

**Files:**
- Modify: `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`

**Interfaces:**
- Consumes: Tasks 1–3.

- [ ] **Step 1: Re-lay the snippets** for `PaneColumns` (no change to `colsTop` or edit mode's form):
  - `about` (left, hidden while editing as today): `TopVideo` when `topVideo(variation.sections, variation.recordings)` is non-null, then the facts card with "Handholds" renamed "Positions", then Practice (unchanged).
  - `watched` (right): the Recordings section — a heading row (`SECTION_LABEL` with `recordingsTitle(n)`, `n` = sections + recordings, and for an editor outside edit mode the `+ Add` button: `button('tertiary', 'sm')`, `plus` icon, text "Add", `aria-label` "Add to Recordings", `aria-haspopup="dialog"`), then the `UploadButton` (`bare`, `bind:chooser`, `accept="video/*"`, today's `url`, `noun`, `bind:busy={uploading}`), kept under `{#key variation.id}` and mounted for an editor in and out of edit mode, then one `GROUP` with a `SectionRow` per section (Unlink form as `trailing` while editing, today's `unlinkSection` and its `FieldError`) and a `RecordingRow` per recording (`trailing`: the trash while editing, Take for a source's untaken recording, as today; the delete and take refusals as today's banners under the group). Hidden entirely when `!showRecordings(...)`, and while editing when there is nothing in it and nothing uploading. Then the Links section exactly as today.
  - `aboutEnd` (left, under `about`): `RelationsCard`, then Taught in, then today's Move and Archive.
  - Remove: the Follows from / Leads to lists, both In routines lists, the empty recordings card, `VideoSections` under recordings, the per-recording `VideoFrame`, "Add audio", and the `Link a section…` `PickerOpener` (its job is the add sheet's first row).
  - The add sheet's `onsection` opens today's `LinkSectionSheet`; `onvideo` calls the `chooser`.
  - The reader routines rule: `RelationsCard` gets `routines={data.routines}`, `mine={data.myRoutines}`, `mineLabel={readerTeam?.name ?? data.team?.name ?? null}` only when `data.myRoutines.length > 0`, else `null`.
- [ ] **Step 2: Verify** `npm run check` passes.
- [ ] **Step 3: Commit** `feat(figure): the video first, one Recordings list, three rows for what grows`.

### Task 5: Check it in the browser, shots, docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-31-redesign-design.md` ("A figure")
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (where it lists the figure page)
- Modify: `CLAUDE.md` (the `src/lib/figures/` line: the reworked page's words, counts and search)

- [ ] **Step 1: Shoot** with the rig on the scratchpad's `ten.db` (a copy of the 6 Nov backup with Exhibela in 10 routines): `/salsa/figures/7`, `/salsa/figures/34`, `/bachata/figures/12` at `390x4800 --viewport` light and dark, and `/salsa/figures/7` at `1440x900 --viewport`. Compare with the approved mockup (part 2, B2). Expected: the order and sizes of the mockup; no `OVERFLOW`.
- [ ] **Step 2: Drive the Review Focus in the dev server** (a slot `.data` copy, never prod): a recording row of a file deleted from disk reads "This file is missing"; start an upload from the add sheet and see the progress card and then the new row; search "dile" in Follows from; edit mode shows trash and Unlink and the left column is hidden; a group reader with nothing sees no Recordings.
- [ ] **Step 3: Update the three docs** to the new order (and note plans 2 and 3 as pending in the redesign doc's "A figure").
- [ ] **Step 4: Run** `npm run check` — expect pass.
- [ ] **Step 5: Commit** `docs(figure): the reworked page`.

### Task 6: One review of the branch

- [ ] **Step 1:** One reviewer (most capable model) reads the branch against the spec and this plan, with the pitfalls checklist: a button stuck busy after a failure; a test that would pass with the feature removed; browser and test disagreeing; state changed before the write commits. Hard limits in its prompt: read-only, no dev server, no interactive or endless input.
- [ ] **Step 2:** Fix what it finds, `npm run check`, commit.
