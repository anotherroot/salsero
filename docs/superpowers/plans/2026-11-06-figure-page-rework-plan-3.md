# Figure page rework, plan 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The figure page's links become rows in the Recordings card (option B, the user's pick on 2026-11-06): the Links section and its paste box go, and Recordings' `+ Add` gains "Link", opening slot 5's "Add a link" popup.

**Architecture:** A new `components/figures/LinkRow.svelte` draws one link as a 60 px row in the Recordings `GROUP`, beside `SectionRow` and `RecordingRow`. What a row shows (title, meta and its tone, where a tap goes, which action ends it) is one pure function, `linkRowView`, in `src/lib/figures/page.ts`. The row posts the page's existing `?/saveVideo`, `?/retryVideo` and `?/deleteLink`; the popup is slot 5's `AddLinkSheet` posting `?/addLink`. No server change. `LinksEditor` is no longer used on the figure page.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-figure-page-rework-design.md` ("Plans", plan 3). The approved look: `links-into-recordings.html` (option B) in this session's scratchpad.

## Global Constraints

- Do not edit `LinksEditor.svelte`, `AddLinkSheet.svelte`, `LinkList.svelte` or `YouTubeCard.svelte` (slot 5's); `AddLinkSheet` is used through its props.
- Option B's look: a 56×40 band-coloured tile with a filled play for a YouTube link, the 40 px chip-coloured `link` disc for a web link; title 16/700; meta 13 muted (danger when a save failed); trailing: a tonal "Save" (`button('secondary', 'sm')`, `download` icon) for a YouTube link an editor can save, Retry (`button('tertiary', 'sm')`) when its save failed, else the `external` icon; while editing, the trash (`iconButton('bare', 'danger')`) in place of all of them. A tap on the row opens the link in a new tab (a YouTube link at its watch URL with its start).
- Words: YouTube title "YouTube" when the link has no title; web title its host; meta "youtube.com" / the host; "Saving at 480p…"; "Couldn’t save: {error}"; the add sheet's row "Link" / "YouTube or any web page"; Remove's label "Remove {title}".
- Remove is one tap (as today), only while editing, and focus goes to the next row's trash (`focusAfterRemoval`, keys `link-{id}`), else `stop-editing`.
- No form field or action changes: no `PAGE_EPOCH` raise. `npm run check` passes.

## Review Focus

1. A refused link (not a URL, a duplicate): the popup stays open with the message and what was typed. (Task 2; scene `figure-link-refused`.)
2. A failed Save video or Retry: the row's meta says why (from `link.saving`), and a refusal of the post itself still shows (the action's `form` message under the card). (Tasks 1, 2.)
3. A reader: link rows with no Save, no Retry, no trash; a reader with only links still sees Recordings. (Task 1 tests.)
4. A `saving` link that finishes becomes a recording on the next load and its row goes (the server deletes the link): nothing on the page holds a stale row id. (Task 2, keyed each.)
5. The top video never becomes a link. (Task 1 test.)

---

### Task 1: What a link row shows (pure)

**Files:** Modify `src/lib/figures/page.ts`; test `src/lib/figures/page.spec.ts`.

**Interfaces — produces:**
- `recordingsCount(i: { sections: number; recordings: number; links: number }): number`
- `linkRowView(link: Pick<LinkRow, 'url' | 'title' | 'saving'>, canSave: boolean): { youtube: boolean; title: string; meta: string; failed: boolean; href: string; end: 'save' | 'retry' | 'open' }`

- [ ] **Step 1: Failing tests:** a YouTube link with no title → `{ youtube: true, title: 'YouTube', meta: 'youtube.com', end: 'save' }` when `canSave`, `end: 'open'` when not; `href` is `youtubeWatch(id, start)`; with `saving: { status: 'queued' }` → meta `Saving at 480p…`, `end: 'open'`; with `saving: { status: 'failed', error: 'blocked' }` → meta `Couldn’t save: blocked`, `failed: true`, `end: 'retry'` (and `'open'` without `canSave`); a web link `https://www.facebook.com/x` → `{ youtube: false, title: 'facebook.com', meta: 'facebook.com', end: 'open', href: the url }`; a title wins over both defaults; `recordingsCount({ sections: 1, recordings: 0, links: 2 })` is 3 and a reader with one link sees Recordings (`showRecordings`).
- [ ] **Step 2–4:** run `npx vitest run src/lib/figures/page.spec.ts` (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `feat(figure): what a link row shows`.

### Task 2: Link rows in Recordings; Link in + Add

**Files:** Create `src/lib/components/figures/LinkRow.svelte`; modify `src/lib/components/figures/AddRecordingSheet.svelte`, `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`.

- [ ] **Step 1: `LinkRow`** props `link: LinkRow`, `canSave: boolean`, `editing: boolean`, `onremoved: (id: number) => SubmitFunction` (the page's removal handler, for focus). The row's text part is an `<a href target="_blank" rel="external noopener noreferrer">`; the trailing control is a sibling (split row). Save and Retry post `?/saveVideo` / `?/retryVideo` with `linkId`, busy while out (spinner, disabled); Remove posts `?/deleteLink`.
- [ ] **Step 2: `AddRecordingSheet`** gains `onlink: () => void` and a third row "Link" / "YouTube or any web page" (`link` icon), closing the sheet then calling `onlink`.
- [ ] **Step 3: The page:** `items = recordingsCount(...)` with `data.links.length`; `LinkRow`s after the recordings in the Recordings `GROUP` (keyed by id), `canSave={data.canEdit}`; the Links section goes; `AddLinkSheet` mounted for an editor (`action="?/addLink"`, `canSave`, `message={failed('addLink')}`, `entered` from `form.urls` on that refusal), opened by `onlink`, and reopened by an effect on `failed('addLink')` as `failed('move')` reopens Move. `failed('saveVideo') ?? failed('retryVideo') ?? failed('deleteLink')` shows as a `FieldError` under the card.
- [ ] **Step 4:** `npm run check`; commit `feat(figure): links as rows in Recordings; + Add offers a link`.

### Task 3: Check it, shots, docs

- [ ] Scenes in `scripts/shots/ext_figure.py`: `figure-link` (+ Add → Link → paste a YouTube URL → Add link → a row shows, the heading counts it), `figure-link-refused` ("not a link" → the message, the sheet open), and `figure-links-edit` (edit mode: trash on the link rows). Run every figure scene on the scratchpad's `ten.db`.
- [ ] Shoot `/salsa/figures/7` at 390×2400 light and dark and 1440×900; send the user the finished rows (real screenshots) before any merge.
- [ ] Docs: the rework spec (plan 3 built, option B), the redesign's "A figure" (links in Recordings, nothing pending), the app design spec's figure detail (no Links section), `CLAUDE.md`'s figures line (`linkRowView`, `LinkRow`). `npm run check`; commit `docs(figure): plan 3 built`.

### Task 4: One review of plan 3's commits, fixes; then wait for the orchestrator before merging.
