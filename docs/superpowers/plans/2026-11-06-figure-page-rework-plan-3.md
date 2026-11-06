# Figure page rework, plan 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** draft, waiting for the user's pick between option A (this plan) and option B (see the end).

**Goal:** The figure page's links join Recordings: the Links section and its in-page paste box go, the links show under the Recordings rows as the lesson page shows them, and Recordings' `+ Add` gains "Link", opening slot 5's "Add a link" popup.

**Architecture:** Reuse slot 5's pieces unchanged: `LinksEditor` with `compact` and `adding={false}` (the lesson page's link cards: thumbnail, Save video, Retry, Remove) for an editor, `LinkList compact` for a reader, and `AddLinkSheet` posting the figure page's existing `?/addLink`. The page's count and visibility rules take links into account. No server change.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-figure-page-rework-design.md` ("Plans", plan 3). Slot 5's: `docs/superpowers/specs/2026-11-05-lesson-links-and-music-design.md` (A1, A2).

## Global Constraints

- Do not edit `LinksEditor.svelte`, `AddLinkSheet.svelte`, `LinkList.svelte` or `YouTubeCard.svelte` (slot 5's); pass props only.
- Words: the add sheet's third row "Link" / "YouTube or any web page"; the popup's own words are slot 5's.
- Links stay hidden while editing, as the Links section is today.
- No form field or action changes: `?/addLink`, `?/saveVideo`, `?/retryVideo`, `?/removeLink` are posted as now. No `PAGE_EPOCH` raise.
- `npm run check` must pass at the end.

## Review Focus

1. A refused link (not a URL, a duplicate): the popup stays open with the message under the field and what was typed kept (slot 5's behaviour, fed by the page's `form`). (Task 2; scene in Task 3.)
2. Removing the last link: focus goes to Recordings' `+ Add` (`LinksEditor`'s fallback key `link-add` must exist on the page). (Task 2.)
3. A reader with only links (no sections, no recordings): Recordings shows, with the links and no `+ Add`. (Task 1 test.)
4. A failed Save video or Retry: its message still shows (today it rides on `LinksEditor`'s `message`, which the lesson page sets to null; the figure page must keep showing it). (Task 2.)
5. The top video never becomes a link: links are not recordings until saved. (Task 1 test.)

---

### Task 1: Count links in Recordings (pure)

**Files:** Modify `src/lib/figures/page.ts`; test `src/lib/figures/page.spec.ts`.

- Produces: `recordingsCount(i: { sections: number; recordings: number; links: number }): number`, the sum.
- [ ] Failing tests: `recordingsCount({ sections: 1, recordings: 0, links: 2 })` is 3; `showRecordings({ canEdit: false, items: recordingsCount({ sections: 0, recordings: 0, links: 1 }) })` is true; `topVideo([], [])` stays null whatever the links.
- [ ] Implement, run `npx vitest run src/lib/figures/page.spec.ts`, commit `feat(figure): links count in Recordings`.

### Task 2: Links in Recordings, Link in + Add

**Files:** Modify `src/routes/[dance]/(moves)/figures/[id]/+page.svelte`, `src/lib/components/figures/AddRecordingSheet.svelte`.

- [ ] `AddRecordingSheet` gains `onlink: () => void` and a third row "Link" / "YouTube or any web page" (icon `link`), closing the sheet then calling `onlink`.
- [ ] The page: `items` becomes `recordingsCount(...)` with `data.links.length`; the Recordings card is drawn when sections or recordings exist; under it, outside edit mode, `LinksEditor compact adding={false} canSave links={data.links} message={saveFailure} entered=""` for an editor (`saveFailure` = `failed('saveVideo') ?? failed('retryVideo')`), `LinkList compact links={data.links}` for a reader. The `+ Add` button's `data-focus` becomes `link-add`. The Links section goes.
- [ ] `AddLinkSheet` mounted once for an editor: `open={addingLink}`, `action="?/addLink"`, `canSave`, `message={failed('addLink')}`, `entered` from `form.urls` when that refusal is shown; `onlink` sets `addingLink = true`. A refused `addLink` reopens it (an effect on `failed('addLink')`, as `failed('move')` reopens Move).
- [ ] `npm run check`; commit `feat(figure): links join Recordings; + Add offers a link`.

### Task 3: Check it, docs

- [ ] Scenes in `scripts/shots/ext_figure.py`: `figure-link` (+ Add → Link → paste a YouTube URL → Add link → the card shows, "Recordings · N" counts it) and `figure-link-refused` (paste "not a link" → the message under the field, the sheet still open). Run all figure scenes on the scratchpad's `ten.db`.
- [ ] Docs: the rework spec (plan 3 built), the redesign's "A figure" (links in Recordings, no pending), the app design spec's figure detail (no Links section). `npm run check`; commit `docs(figure): plan 3 built`.

### Task 4: One review, fixes, then ask before merging.

---

## If the user picks option B (links as rows in the same card)

Task 2 changes: a new `components/figures/LinkRow.svelte` in the Recordings `GROUP` (56×40 band-coloured thumbnail for YouTube, the `link` chip for a web link; title; meta "youtube.com", "Saving at 480p…" or the failure in `danger`; trailing: a tonal "Save" (`?/saveVideo`), Retry when failed, else the external icon; while editing, the trash posting `?/removeLink` that focuses the next row). `LinksEditor` is then not used on the figure page; a reader's rows have no Save. Tasks 1, 3 and 4 stand.
