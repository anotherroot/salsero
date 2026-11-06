# Merge sheets and update bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Compare's "all yours" and Send's missing name, give Compare the two-column merge look, and restyle the two update bubbles, as picked on 2026-11-06.

**Architecture:** The rules are PURE and tested (`src/lib/clones/diff.ts`, `view.ts`, a new `rename.ts`; `src/lib/app-update/view.ts`; `src/lib/nav/fresh.ts`); the one server change is Keep mine's snapshot in `syncFrom`. Components only draw what those return.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind 4, Drizzle on SQLite, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-merge-sheets-and-update-bubbles-design.md`

## Global Constraints

- Nothing under `$lib/server` is imported by components; shared shapes in `src/lib/types.ts`.
- A colour on a built control is the builder's (`button()`, `iconButton()`); never append `text-*` to their output (`class-rules.spec.ts`).
- One-tap forms stay on `use:enhance` (Take, Send are one-tap).
- No migration, no PAGE_EPOCH raise: the Take and Send forms post the same fields as now.
- Slot 3 owns the banner, version tabs and ⋯ menu: touch only `CompareSheet.svelte`, `SendSheet.svelte` and their pure modules among the clone components.
- Words exactly as the spec gives them.
- `npm run check` must pass.

## Review Focus

1. A comparison that is never in step (no snapshot): every field open; "All yours" then Keep mine must write a snapshot so the next compare is no longer all-open.
2. A read-only Compare (`canTake` false): headers and tiles do nothing, no Keep mine.
3. Send with `only` (Drop's "Send mine first"): the rename box covers that one copy.
4. A rename refused for a clash in one group while the other lands: the refusal line names the group, the other group's rename stays.
5. A suffix check on a truncated name (`suffixed` shortens the base for long names): still read as a copy's suffix.

---

### Task 1: The name rule in Take's preselection

**Files:** Modify `src/lib/clones/diff.ts`; Test `src/lib/clones/diff.spec.ts`

**Interfaces — Produces:** `export const NAME_KEYS: ReadonlySet<string>` (`name`, `title`); `export function isCopySuffix(mine: string, theirs: string): boolean`; `defaultPicks(diffs, 'take')` with the new name rule; `'send'` unchanged.

- [ ] Tests (replace the `take` name expectations at diff.spec.ts ~253–268):
  - `isCopySuffix('Doble', 'Doble (Salsa Tuesdays)')` true; `('Doble', 'Doble (Salsa Tuesdays 2)')` true; `('Doble', 'Doble con giro')` false; `('Doble', 'Doble (x) y')` false; a 60-char base vs its `suffixed()` form (base cut) true; `('', ' (x)')` false.
  - take, theirs renamed `Básico`→`Básico largo`: `{ name: 'theirs' }`.
  - take, theirs is `Básico (Salsa Tuesdays)`: `{ name: 'mine' }`.
  - take, both renamed: no pick (`unpicked` lists `name`).
  - take, only mine renamed: `{ name: 'mine' }`.
  - send expectations unchanged (`{ name: 'theirs' }`, `{ title: 'theirs' }`).
- [ ] Run `npx vitest run src/lib/clones/diff.spec.ts` → fails.
- [ ] Implement: `isCopySuffix` strips one trailing ` (…)` (no parentheses inside) from theirs and is true when the rest is non-empty and `mine.trim()` starts with it. In `defaultPicks`, `'take'` names: `side === 'theirs'` → `isCopySuffix(mine.value, theirs.value) ? 'mine' : 'theirs'` (a null side → `'mine'`, as a removal); `'mine'` → `'mine'`; `'both'` → no pick unless `isCopySuffix` either way → `'mine'`. Update the doc comment.
- [ ] Run → passes. Commit `fix(clones): Take picks a name they changed, unless it is a copy's suffix`.

### Task 2: Keep mine writes the snapshot

**Files:** Modify `src/lib/server/clones/apply.ts:1063-1065`; Test `src/lib/server/clones/compare.spec.ts:313` (the "nothing picked theirs" test).

- [ ] Rewrite that test as `'Keep mine: nothing taken, no History line, the snapshot now reads theirs as behind'`: same setup; after the take, rows unchanged, team_changes count unchanged, `pairAt(...)` is `NOW`, and the next `compareWith(db,'u1','figure',F,mine)!.diffs.map(d => d.side)` is `['mine']`. Add a case never in step (copy then edit both sides so the pair has no snapshot? — use `db.delete(clonePairs)` to drop it): all picks `'mine'` → afterwards `synced` is true and every diff side is `'mine'`.
- [ ] Run `npx vitest run src/lib/server/clones/compare.spec.ts` → fails.
- [ ] Implement: when `keys.length === 0`, in a transaction re-check `digest(flatOf(tx, kind, intoId)) !== seen` → stale; else `writePair(tx, kind, intoId, fromId, nextBase(intoFlat, fromFlat, base?.skip ?? [], hashValue), now)`; return `{ ok: true }`. No `logChange`. Update the comment.
- [ ] Run compare, apply, send, story and changes specs → pass. Commit `fix(clones): Keep mine records that you chose yours`.

### Task 3: The words

**Files:** Modify `src/lib/clones/view.ts`; Test `src/lib/clones/view.spec.ts`

**Interfaces — Produces:**
- `compareTitle(place)` → `'Merge with Sreda 17:30'`, `'Merge with yours'` for `'Yours'`.
- `diffWhy(d: FieldDiff, picked: boolean): { text: string; tone: 'mine' | 'theirs' | 'both' }`: theirs side: `'they added it'` (mine null), `'they removed it'` (theirs null), `'they renamed it'` (name key), else `'they changed it'`; mine side the same with `you`; both: `'you both changed it, pick one'` until picked, then `'you both changed it'`.
- `mergeButton(n: number): string` → `'Keep mine'` (0), `'Merge · 1 from theirs'`.
- `pickFirst(labels: string[]): string` → `'Pick a side for the timing first.'`, two: `'… the timing and the notes first.'` (lower-cased, `listed`).
- `KEEP_HINT = 'Nothing changes in yours. Theirs will show as behind yours.'`
- `isLong(show: string): boolean` → more than 3 lines or over 90 characters.
- `ALL_YOURS = 'tap: all yours'`, `ALL_THEIRS = 'tap: all theirs'`, `SHOW_ALL = 'Show all'`, `SHOW_LESS = 'Show less'`.
- Send: `renameLabel(name) → 'Rename their copies to “Basic with hips”'`; `renameMeta(names: string[])` → `'Both are called “Basic”'` (2 same), `'All 3 are called “Basic”'`, `'Called “Basic”'` (1), `'Called “Basic” and “Basic 2”'` (differ, `listed`); `NAME_ONLY = 'Only the name differs'`; `sendTargetMeta(diffs, bytes, team, renamed = false)` appends `' · the name'` when `renamed`, and returns `NAME_ONLY` (not `NOTHING_TO_SEND`) when the only diff is a name key and `renamed` is false. Remove `diffTag`, `TAKE_BUTTON` if nothing else uses them (compare.spec uses `diffTag`: switch it to `diffWhy`).
- [ ] Tests for each, exact strings above. Run → fail. Implement. Run → pass. Commit `feat(clones): the merge sheet's and the rename box's words`.

### Task 4: The rename box's state

**Files:** Create `src/lib/clones/rename.ts`; Test `src/lib/clones/rename.spec.ts`

**Interfaces — Produces:**
- `nameDiffOf(t: SendTarget): FieldDiff | null` — the target's diff on a `NAME_KEYS` key.
- `renameOffer(targets: SendTarget[]): { name: string; names: string[]; ids: number[] } | null` — your name (`d.theirs.show`), the targets' names (`d.mine.show`), ids with a name diff; null when none.
- `withRename(picks: Picks, t: SendTarget, on: boolean): Picks` — adds `{ [key]: 'theirs' }` when `on` and the target has a name diff.
- `sendsOnlyName(t: SendTarget): boolean`.
- [ ] Tests: two targets both `Basic` → names `['Basic','Basic']`, ids both; a target without a name diff is not in `ids`; `withRename` leaves picks untouched when off or no diff; `sendsOnlyName` true for a target whose diffs are just `name`, false with timing too. Run → fail. Implement. Pass. Commit with Task 5.

### Task 5: SendSheet's rename box

**Files:** Modify `src/lib/components/clones/SendSheet.svelte`

- [ ] State: `rename = $state(false)`, `renameOut = $state<Record<number, boolean>>({})`; reset both in `load()`. Below the targets' group, when `renameOffer(targets)`: a `GROUP` card with the box row (`renameLabel`, `renameMeta`) and, when ticked, a child row per id (indented like the mock, `pl-12`), ticked unless in `renameOut`. Ticking the rename (or a child) ticks the target; unticking unticks a target that `sendsOnlyName` and is not otherwise sending.
- [ ] `payload`: `withRename(picks, t, rename && !renameOut[t.target.id])`. Target meta: `sendTargetMeta(..., renamed)`.
- [ ] `npm run check` passes. Commit `fix(clones): Send can send the name, once for every copy`.

### Task 6: CompareSheet as a merge tool

**Files:** Modify `src/lib/components/clones/CompareSheet.svelte`

- [ ] Layout per the spec: under the sheet head, two header buttons (`grid grid-cols-2 gap-2`): "Yours"/`ALL_YOURS` and `place`/`ALL_THEIRS`; outlined accent when every pick is that side; disabled when `!canTake`. Each diff: label row (`SECTION_LABEL`-like caps label + `diffWhy` text, tone: theirs `text-accent-text`, mine `text-muted`, both `text-warn`), then two tiles (radios as now, `name` per row) without the caption words; picked: `border-accent` + a 20 px tick (`Icon name="check"`); other: `opacity-50`; both-and-unpicked: dashed `border-warn`. `line-clamp-3` on values when `isLong` and the row is not expanded; a `SHOW_ALL`/`SHOW_LESS` text button under the row.
- [ ] Footer: Cancel + primary `mergeButton(n)`; disabled while `waiting` or `!canTake`; a hint line under the buttons: `pickFirst(labels of unpicked)` while waiting, `KEEP_HINT` when n is 0. Submit allowed with n = 0.
- [ ] Remove the Badge import if unused. `npm run check` passes. Commit `feat(clones): Compare as a merge tool, with Keep mine`.

### Task 7: "Update available" as one row

**Files:** Modify `src/lib/components/system/AppUpdateBar.svelte`, `UpdateButton.svelte`, `src/lib/app-update/view.ts`; Test `src/lib/app-update/view.spec.ts`

**Interfaces — Produces:** `updateRowLine(update: AppUpdate, statusLine: string | null): string` → status line when present, else `'Version 1.9 is ready'` (latest.versionName), else `'Ready to install'`; `hiddenUntil(stored: string | null, day: string, versionCode: number): boolean` (stored is `"<day>|<versionCode>"`); `UPDATE_ROW_TITLE = 'New version of the app'`; `HIDE_UPDATE = 'Hide until tomorrow'`.

- [ ] Tests for both functions (same day same version hidden; next day shown; newer version shown; garbage shown). Run → fail; implement; pass.
- [ ] `UpdateButton`: props `size?: 'md' | 'sm'` (button size) and `line = $bindable<string | null>(null)` set from `view.line`; when `size === 'sm'` it renders only the button (no line span). Settings and UpdateNeeded unchanged.
- [ ] `AppUpdateBar`: a `bg-surface rounded-2xl p-3.5 flex items-center gap-3` row: `<img src="/icons/{dance}-192.png" alt="" class="size-11 rounded-xl">`, title + `updateRowLine`, `<UpdateButton size="sm" bind:line>`, a bare × (`iconButton('bare')`, aria-label `HIDE_UPDATE`). Hidden state from `localStorage` key `salsa:update-hidden:<dance>` read in `onMount` (try/catch), today from `localDay(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone)`. Renders nothing while hidden.
- [ ] `npm run check`. Commit `feat(app-update): Update available as one row with the app's icon`.

### Task 8: "New version" as a toast that says why

**Files:** Modify `src/lib/nav/fresh.ts`, `src/lib/components/shell/ReloadBar.svelte`, `src/routes/+layout.svelte`; Test `src/lib/nav/fresh.spec.ts`

**Interfaces — Produces:** `reloadWhy(q: Quiet): string` → unsaved > 0 `'Kept so nothing unsaved is lost.'`; held > 0 `'Kept while this runs.'`; playerOpen or sheetsOpen `'Kept while this is open.'`; else `'Your next page loads it.'` (checked in that order). `RELOAD_TITLE = 'The app was updated'`; `STALE_TITLE = 'This page is out of date'`, `STALE_LINE = 'Reload to continue.'`.

- [ ] Tests for `reloadWhy` (each case and the order). Run → fail; implement; pass.
- [ ] `ReloadBar`: props `stale`, `why: string`. Same wrapper placement as `ui/Toast.svelte` (fixed, `inset-x-0 mx-auto max-w-[560px] px-4 desk:left-(--pane-left)`, bottom `calc(1rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))`), z as the bar's (`z-30 desk:z-[32]`); the card as Toast's (`rounded-2xl bg-inverse-bg text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.28)]`): title 15/700, line 13 opacity-75, a Reload text button `text-inverse-accent` 15/800 calling `reloadOrAsk`. Stale: `STALE_TITLE` / `STALE_LINE`.
- [ ] Layout: `let why = $state('')`; an `$effect` while `reloadBar` is true sets `why = reloadWhy(quietNow())` now and every 1.5 s; pass `{why}`.
- [ ] `npm run check`. Commit `feat(nav): the new-version bar becomes a toast that says why`.

### Task 9: Specs, scenes, screenshots

**Files:** Modify `docs/superpowers/specs/2026-11-03-clones-and-twins-design.md` (point "Names never travel by default" and the Compare rules at the new spec), `docs/superpowers/specs/2026-11-03-app-updates-design.md` (the two bubbles), `CLAUDE.md` (`src/lib/clones/` gains `rename.ts`); Create `scripts/shots/ext_merge.py` scenes `merge-compare`, `merge-compare-all-yours`, `merge-send`, `merge-send-rename` (ticks the rename box), `update-available`, `update-reload`, `update-stale`.

- [ ] Edit the specs and CLAUDE.md. Shoot the scenes from the backup copy (light and dark, 390x844, `--viewport`), check each by eye against the mockups. Commit `docs: the merge sheets and update bubbles` and `chore(shots): merge and update scenes`.
- [ ] One review of the whole branch (fresh reviewer), fix what it finds, `npm run check`, then send the screenshots to the user before merging.
