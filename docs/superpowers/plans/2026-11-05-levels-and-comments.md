# Levels and Lesson Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three levels of app per person (Follow my class, Practise and keep my own, Everything) with a first run, auto-added class lessons, My class, and simple lesson, video and exercise screens; plus YouTube-style comments with hearts on a group's lessons — phone and desktop.

**Architecture:** One per-person column (`users.level`) read through a pure module (`src/lib/levels/levels.ts`) that every layout and page asks: which tabs, whether a screen is simple, whether auto-add is on. Simple screens are the same routes and loads drawn in a simple mode, never separate routes. Auto-add is `addLesson` run for members inside the transactions that publish, join and grow a lesson. Comments are two new tables hanging off a lesson, a flat API that asks `lessonAccess`, and one Sheet.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, Drizzle + better-sqlite3, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-levels-design.md` and `docs/superpowers/specs/2026-11-05-lesson-comments-design.md` (read the one(s) your task names, whole, before starting). Desktop rules: `docs/superpowers/specs/2026-11-03-desktop-design.md`. Part 1 (built): `docs/superpowers/specs/2026-11-05-today-scheduling-design.md`.

## Global Constraints

- Branch `brainstorm-for-older-users` (at `ea4e5d0` or later; master = prod has part 1). CLAUDE.md's hard rules all apply; read it first.
- Level values: `'follow' | 'own' | 'all'`, column `users.level` (text, null = not chosen; existing rows backfilled `'all'`). `team_members.auto_add` integer, null = level default (`follow` → always on, ignoring the stored value; `own` → on; `all` → off).
- Exact copy (levels): "How much app?"; "You can change this any time in Settings"; level titles "Follow my class", "Practise and keep my own", "Everything"; bodies and small lines exactly as the levels spec's "The three levels" section; slides as its "First run" step 1; "Join your class", "Your teacher has the code", "Class code", "Or open the link your teacher sent, or scan the code on the studio wall.", "Not now", "Join"; tab label "My class"; "Add new lessons to Today automatically"; "Not in your practice yet · Add"; "Added to Today · Undo"; "What you're practising"; "On Today today" / "On Today on Sunday" / "On Today next week" (from part 1's `dayWords`); exercise page button "I practised this"; log popup button "Done"; "From class Tue 3 Nov ›"; "Class · Tue 3 Nov".
- Exact copy (comments): "Comments", "Comments on the class", "N new", "Be the first to ask or say something", "Write a comment…", "Replying to Maja", "N replies", "Hide replies", "Teacher", "Comment deleted", "Comment deleted · Undo", "Everyone in <group name> sees it". Body 1–1000 characters after trim.
- Levels hide entry points, never routes: no route 404s or redirects because of a level (except the first-run gate for a null level).
- Pure modules (`src/lib/levels/`, `src/lib/comments/`) are client-safe; no `$lib/server` imports in components; `now` is an argument; dates via `src/lib/format.ts`.
- Colours only through tokens and the builders in `ui/styles.ts`, `video/styles.ts` (class-rules spec).
- One migration for the whole plan, made in Task 1: additive only (`ALTER TABLE … ADD COLUMN`, new tables); the backfill `UPDATE users SET level = 'all'` appended by hand to the generated SQL after a `--> statement-breakpoint`. Read the SQL before committing. Never a CHECK on an existing table.
- Forms someone fills use `use:guarded`; one-tap actions `use:enhance` or `act`. Forms in a list column post to the list route's explicit URL. Today layout files never post to a bare `?/`.
- PAGE_EPOCH: if a task changes the fields of an action or API an older open page still sends, raise `src/lib/page-epoch.ts` to 7 in that commit. Once for the whole plan: a task that finds it already 7 leaves it.
- Run commands inside the flake: `nix develop -c …`. Run each vitest file, each `npm run check`, each browser script ONE AT A TIME under `timeout 900 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 …`. No `script`/`expect`/`tmux attach`, no endless input, `browser.close()` in `finally`. Headless browser: puppeteer-core with nix chromium, run with `env -u LD_LIBRARY_PATH`.
- **Pitfalls checklist (check before handing back):** a button stuck busy or silent after a refused/failed request; tests that would still pass with the feature removed; behaviour that differs between vitest and the real page (load the page in a browser at 390 px and 1280 px when the task touches UI, at each level the task changes); ordering bugs (state saved before the write commits, a toast before the request succeeds); an `all`-level person seeing any change they did not before.
- Commit per task in the repo's style (`feat(levels): …`, `feat(comments): …`), ending with the session's two attribution lines.

## Review Focus

1. **Existing people see no change.** A backfilled `all` account: same five tabs, no first run, no auto-add on publish (null toggle at `all` = off), full lesson page and player. → Task 1 test `existing accounts are Everything`, Task 3 test `publish adds nothing for an Everything member with no toggle`.
2. **Auto-add twice** (publish after the person already added the lesson; joining a group twice; a growth mutation run twice): never a second `lesson_adds` row or duplicate entry, never a removed lesson re-added. → Task 3 tests `auto-add skips a lesson already added or removed`, `join twice adds once`.
3. **A teacher at a lower level** on their own group's draft: full page with Edit and Publish. → Task 1 test on `simpleLesson`, Task 7 browser check.
4. **A reply aimed at another lesson's thread, a stranger, a deleted group.** Same 404 as the lesson for a stranger; a reply into another lesson's thread refused; a deleted group's comments read-only. → Task 5 tests `reply must stay in its lesson`, `stranger gets 404`, `deleted group is read-only`.
5. **The keyboard over the composer**: in Chrome on Android (390 × 844 with a 300 px keyboard emulated through `visualViewport`) the composer stays visible; other sheets unchanged. → Task 9 browser check.

---

## Waves (what can run at once)

- **Wave 1:** Task 1.
- **Wave 2 (parallel, separate worktrees):** Task 2, Task 3, Task 4, Task 5.
- **Wave 3 (parallel):** Task 6, Task 7, Task 8, Task 9. Tasks 7, 8 and 9 touch the same two pages: Task 9 adds the comments card as ONE component line in each page (lesson page after `PaneColumns`, exercise page after the content), so merges stay small.
- **Wave 4:** Task 10 (desktop pass, docs, the whole check).

---

### Task 1: The level, the tabs, Settings, and the plan's one migration

**Files:**
- Modify: `src/lib/server/db/schema.ts` (users `level: text('level')`; team_members `autoAdd: integer('auto_add')`; new `lessonComments`, `lessonCommentHearts` per the comments spec's "What is stored"); generate `drizzle/0031_*.sql`, append the backfill.
- Create: `src/lib/levels/levels.ts`, `src/lib/levels/levels.spec.ts`, `src/lib/server/levels.ts` (+ spec), `src/lib/components/levels/LevelCards.svelte`.
- Modify: `src/lib/server/auth.ts` (`validateSession` selects level), `src/app.d.ts` (`SessionUser.level: Level | null`), `src/hooks.server.ts` (locals), `src/lib/components/shell/BottomNav.svelte`, `Side.svelte`, `src/lib/nav/tab-links.svelte.ts`, `src/lib/nav/error-view.ts`, the band's GroupModeButton call sites (drawn only when `groupModeShown`), `src/routes/[dance]/groups/+layout.svelte` (New group only when `canMakeGroup`), `src/routes/settings/+page.server.ts` and `+page.svelte`.

**Interfaces:**
- Produces (`levels/levels.ts`): `type Level = 'follow' | 'own' | 'all'`; `LEVELS: readonly Level[]` (that order); `LEVEL_WORDS: Record<Level, { title: string; body: string; small: string }>`; `parseLevel(v: unknown): Level | null`; `tabsFor(level: Level): readonly Tab[]` (the `TABS` entries, filtered; at `follow` the groups tab's label is "My class"; `Tab` is `TABS`' element type, exported from `tabs.ts` if not already); `simple(level: Level): boolean`; `simpleLesson(level: Level, access: 'read' | 'edit', isGroupLesson: boolean): boolean` (`simple(level) && !(isGroupLesson && access === 'edit')`); `autoAddOn(level: Level, stored: number | null): boolean`; `groupModeShown(level)`, `canMakeGroup(level)` (both `level === 'all'`).
- Produces (`server/levels.ts`): `levelOf(db, userId): Level | null`; `setLevel(db, userId, level: Level): void` (throws on anything else); `setAutoAdd(db, userId, teamId, on: boolean): boolean` (false when not a member).
- Produces: `LevelCards.svelte` — props `{ value: Level | null; onpick: (l: Level) => void }`, three radio cards with title, body, small line, the level's tabs drawn small; nothing preselected when `value` is null. Used by Settings and Task 2.
- Produces: Settings action `level` (field `level`) → `setLevel`; a "How much app?" row at the top of Settings opening a sheet with `LevelCards`; at `follow` Settings draws only the rows the levels spec lists.
- Layouts read `page.data.user.level` (or the root layout's data) — make `level` available to every page through the root layout's load.

- [ ] **Step 1: Failing specs.** `levels.spec.ts`: `tabsFor` for each level (ids in order: follow `today, groups`; own `today, lessons, groups, music`; all five) and the "My class" label at follow only; `simpleLesson` table (follow/own × read/edit × group/own lesson; all → false); `autoAddOn` table (follow ignores stored 0; own null → on, 0 → off; all null → off, 1 → on); `parseLevel` rejects `'x'`, `null`. `server/levels.spec.ts` (`openDb(':memory:')`): `existing accounts are Everything` (the migration's backfill: a user inserted before running it reads `'all'` — or assert the SQL file contains the UPDATE and a fresh user is null); `setLevel` refuses `'x'`; `setAutoAdd` refuses a non-member. Settings forms spec: `level` stores, rejects junk.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** schema, migration (`npm run db:generate`, then append the backfill; read the SQL: two ADD COLUMNs, two CREATE TABLEs, the index, the UPDATE), the modules, locals, tabs via `tabsFor`, group mode and New group gating, Settings.
- [ ] **Step 4: Run, expect PASS;** in a browser, set each level in Settings at 390 px and 1280 px: the tab bar and the Side change at once; a figure page opened by URL at `follow` still loads with no tab lit.
- [ ] **Step 5: Commit** `feat(levels): how much app, per person`.

---

### Task 2: The first run and the class code

**Files:**
- Create: `src/routes/welcome/start/+page.server.ts`, `+page.svelte` (slides, level, join; one route, steps in page state), `src/lib/components/teams/ClassCodeField.svelte`, `src/lib/server/join-code.ts` (+ spec).
- Modify: `src/lib/names.ts` or a new `needsLevel` beside `needsName` (same passes, plus `/welcome/start`), `src/hooks.server.ts` (gate after the name gate), `src/lib/nav/frame.ts` (`CARD` gets `/welcome/start`), `src/routes/+page.server.ts` (the `/` redirect: at `follow`, prefer a dance where the person has a class when the last dance has none), `src/routes/[dance]/groups/+layout.svelte` and `+page.server.ts` ("Join with a code" beside New group at `own`/`all`; action `joinCode`).

**Interfaces:**
- Consumes: Task 1's `LevelCards`, `setLevel`, `Level`; `joinTeam`, `teamByCode` (`teams.ts`).
- Produces (`join-code.ts`): `joinWithCode(db, userId: string, code: string, now: number): { ok: true; teamId: number; dance: DanceSlug } | { ok: false; reason: 'unknown' | 'refused' }` — normalises like `teamByCode`, calls `joinTeam`, then Task 3's `autoAddOnJoin` (import it; if Task 3 has not merged, leave a `// Task 3: autoAddOnJoin` call site stub that Task 3's merge fills — the controller resolves it).
- Produces: actions on `/welcome/start`: `level` (field `level`), `join` (field `code`; or `teamCode` from a `next=/g/<code>`), each redirecting per the spec's step 4. `ClassCodeField.svelte` — props `{ action: string; error?: string }` (a `use:guarded` form, `FieldError` under it). Reused by Task 6's empty state.

- [ ] **Step 1: Failing specs.** `join-code.spec.ts`: lowercase and `I/L/O` variants join; unknown → `unknown`; a deleted group → `refused`; joining twice → ok, one membership. A hooks spec (as the existing name-gate spec does): null level → 303 to `/welcome/start?next=…`; `/api/…`, `/logout`, `/welcome/start` pass; an `all` user passes.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Slides: three cards with Next, swipe (the existing gesture helpers in `src/lib/gestures/`), Skip. Level step: `LevelCards`, Continue disabled until picked. Join step: `ClassCodeField`, Not now; with `next=/g/<code>`, "Join <name>?" instead.
- [ ] **Step 4: Run, expect PASS;** in a browser: a fresh account (insert a user with `level` null) walks slides → Follow my class → a code → lands on that class's dance Today; `next=/g/<code>` shows "Join <name>?"; at 1280 px the steps sit in `CardFrame`.
- [ ] **Step 5: Commit** `feat(levels): the first run and joining with a code`.

---

### Task 3: Auto-add

**Files:**
- Create: `src/lib/server/auto-add.ts`, `src/lib/server/auto-add.spec.ts`.
- Modify: `src/lib/server/entries.ts` (export `defaultPicks(offer: AddOffer): AddPicks` — the offer's ticked items), `src/lib/server/lessons.ts` (`publishLesson` calls `autoAddOnPublish` in its transaction), `src/routes/g/[code]/+page.server.ts` (after `joinTeam`, `autoAddOnJoin`), every group mutation that can grow a published lesson's reach (hand links, section links, the Link popup's create-and-link, routine slot/embed edits, drill links), `src/routes/[dance]/groups/[id]/+page.server.ts` + `+page.svelte` (the toggle row, action `autoAdd`; at `own` the row's Add posts a new action `addNow` that adds `defaultPicks` without the sheet).

**Interfaces:**
- Consumes: Task 1's `autoAddOn`, `levelOf`, `team_members.auto_add`; `addOffer`, `addLesson`, `newInLesson`.
- Produces (`auto-add.ts`), all taking `tx` and running inside the caller's transaction: `autoAddOnPublish(tx, lessonId: number, now: number): string[]` (user ids added: every member of the lesson's group with `autoAddOn` true and no `lesson_adds` row); `autoAddOnJoin(tx, userId, teamId, now): number | null` (the newest published lesson's id when added, if auto-add is on for them); `autoAddPending(tx, teamId, now): void` (for each member with auto-add on and each published lesson they have added, `newInLesson` items added with `touch: false`); `GROWTH: readonly string[]` exported from the spec file listing the mutation functions that call `autoAddPending` (like `MUTATIONS`).
- A removed lesson is never re-added: `autoAddOnPublish` only runs once per lesson (no unpublish), and `autoAddOnJoin` adds only the newest, so removal survives; `autoAddPending` only touches lessons with a `lesson_adds` row.

- [ ] **Step 1: Failing specs** (`openDb(':memory:')`, the groups fixtures): `publish adds for follow and own members, not all` (`publish adds nothing for an Everything member with no toggle`; `all` with toggle 1 → added; `own` with toggle 0 → not); the added entries equal what Add with default picks makes; `join adds the newest only`; `join twice adds once`; `auto-add skips a lesson already added or removed`; `autoAddPending` adds a drill linked after publish for a follow member, not for an `all` member without the toggle; each `GROWTH` mutation, run on a fixture, leaves a follow member with the new item (one test per entry, table-driven); `crossRefs` is `[]` after each.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, then the group page: the switch row for every member at `own`/`all` (`toggle` look from `ui/`), `addNow` at `own`.
- [ ] **Step 4: Run, expect PASS;** in a browser as two users: the teacher publishes, the follow member's Today shows the new class's rows (within the daily number) and Coming up lists the rest.
- [ ] **Step 5: Commit** `feat(levels): class lessons come to Today by themselves`.

---

### Task 4: The simple video player

**Files:**
- Modify: `src/lib/components/ui/VideoPlayer.svelte` (prop `simple?: boolean`), `src/lib/components/video/TopBar.svelte` (repeat button, prop `repeat?: boolean` + `onrepeat`), `src/lib/components/video/Transport.svelte` (prop `steps?: 'fine' | 'five'`), `src/lib/video/chrome.ts` (`topBar` and the body parts honour `simple`), `src/lib/video-prefs.ts` (`repeat: boolean`, default false), `src/lib/components/ui/VideoFrame.svelte` (prop `simple`: no section bands, passes `simple` on).
- Test: `src/lib/video/chrome.spec.ts`, `src/lib/video-prefs.spec.ts` (or the existing spec files for these modules).

**Interfaces:**
- Produces: `VideoPlayer` / `VideoFrame` prop `simple?: boolean` (default false, so every current caller is unchanged). In simple mode: always `slimBar`, no Show/Hide, Transport with −5 s / play / +5 s, TopBar with close, title, repeat, mirror, speed; never Mark, Start section, section row, Sections pill, Edit, the link entry, M/S/L keys. Repeat loops the whole video (`ended` → 0 and play); a section opened as such loops as now with repeat lit and disabled.
- Pages pass `simple` in Tasks 7 and 8; this task adds it to `/dev/kit` for both states.

- [ ] **Step 1: Failing specs:** `chrome.spec.ts` — `topBar(mode, level, { simple: true })` has no edit, no sections, has repeat; the portrait body parts for simple are slim only. `video-prefs.spec.ts` — `repeat` parses, defaults false, junk → false.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Icon: add `repeat` to `icons.ts` if missing (24 px, 2 px round strokes, like `mirror`).
- [ ] **Step 4: Run, expect PASS;** in a browser (`/dev/kit` or a lesson video with `simple` forced): portrait 390 px, landscape, 1280 px; repeat lights and loops; ±5 s step; speed and mirror kept after reopening.
- [ ] **Step 5: Commit** `feat(video): the simple player`.

---

### Task 5: Comments — storage, rules and the API

**Files:**
- Create: `src/lib/server/comments.ts` (+ spec), `src/lib/comments/view.ts` (+ spec), `src/routes/api/lessons/[id]/comments/+server.ts`, `src/routes/api/comments/[id]/+server.ts` (DELETE), `src/routes/api/comments/[id]/heart/+server.ts`, `src/routes/api/comments/[id]/restore/+server.ts`, client fetch side `src/lib/comments/api.ts`.
- Modify: `src/routes/api/opens/+server.ts` and `src/lib/server/whats-new.ts` (`OpenKind` gains `'comments'`), `src/lib/server/team-purge.ts` (`purgeRows` hard-deletes the group's lessons' comments and hearts), `src/lib/types.ts` (comment row shapes), `src/routes/api/owner-wall.spec.ts`.

**Interfaces:**
- Consumes: Task 1's tables; `lessonAccess`/`judgeLesson`, `roleOf`, `teamNames`.
- Produces (`server/comments.ts`, `db` first): `listComments(db, userId, lessonId): CommentList | null` (null = 404); `postComment(db, userId, lessonId, body: string, replyTo: number | null, now): Comment | CommentRefusal`; `toggleHeart(db, userId, commentId, now): { hearted: boolean; count: number } | null`; `deleteComment(db, userId, commentId, now): boolean`; `restoreComment(db, userId, commentId): boolean`; `commentCard(db, userId, lessonId): CommentCard | null` (`{ count, newCount, newest: { name, teacher, text, at } | null }`, for the page loads in Task 9).
- Produces (`types.ts`): `CommentRow { id; authorName; teacher: boolean; mine: boolean; body: string | null /* null when deleted */; at: number; hearts: number; hearted: boolean; canDelete: boolean; replyToName: string | null }`, `CommentThread { top: CommentRow; replies: CommentRow[] }`, `CommentList { threads: CommentThread[]; open: boolean /* posting allowed */; groupName: string }`, `CommentCard`.
- Produces (`comments/view.ts`): `shapeThreads(...)` if not done server-side, `atReply(row): string | null` ("@Maja" when `replyToName` and the reply is to a reply), `cardWords(card)`, `whoSees(groupName)`, `repliesLabel(n)`, the composer's length check `bodyError(body): string | null`.
- API shapes as the comments spec's "The API"; every handler asks access about `locals.user.id`; posting refused (403-shaped `fail` JSON with a message) in a deleted group; same 404 for a stranger and a missing id.

- [ ] **Step 1: Failing specs:** member posts, reads, hearts (toggle twice → 0); editor deletes another's comment, a member cannot; author deletes own, restore brings it back; deleted top with live replies listed as deleted, without replies not listed; counts count live only; `reply must stay in its lesson`; a reply to a reply sets `replyToName`; `stranger gets 404` (u2 not in the group, and a draft for a member); `deleted group is read-only`; a person's own lesson → null; someone who left keeps their name, no Teacher tag; 0 and 1001 characters refused, whitespace-only refused; `commentCard.newCount` uses the `'comments'` open; purge deletes comments and hearts. `owner-wall.spec.ts` cases for the four endpoints. `view.spec.ts` for the words.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat(comments): comments and hearts on a class's lessons`.

---

### Task 6: My class

**Files:**
- Modify: `src/routes/[dance]/groups/+layout.server.ts`, `+layout.svelte`, `+page.server.ts`, `+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte` (draw the simple mode at `follow`), `src/lib/teams/view.ts` (+ spec: the simple page's words and the latest/earlier split).
- Create: `src/lib/components/teams/MyClass.svelte` (the simple class page body), `src/lib/components/teams/ClassList.svelte` if the list differs from `GroupList`.

**Interfaces:**
- Consumes: Task 1's level; Task 2's `ClassCodeField` and `joinCode` action (empty state); Task 3's `addNow` (the one-tap Add on a not-added class, with "Added to Today · Undo" whose Undo posts the existing remove action).
- Rules: at `follow`, one class in this dance → `/[dance]/groups` goes to that class's page (a `replaceState`-free server redirect in the groups index load is allowed only at `follow`); two or more → the list (phone) / list column (desktop); none → "Join your class" + `ClassCodeField`, and "Your bachata class ›" when the other dance has one. The class page: latest class big card, earlier classes rows, Class songs with sample play, Class menu with People and Leave only, no code, no Rename, no Recently deleted, no storage.

- [ ] **Step 1: Failing specs** for `view.ts` (latest/earlier split, metas "2 videos · 4 to practise", the menu items at follow).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS;** browser at follow: one class, two classes, none (with a class in the other dance), at 390 px and 1280 px; the New dot shows on the My class tab; Add on an older class adds and Undo removes.
- [ ] **Step 5: Commit** `feat(levels): My class`.

---

### Task 7: The simple lesson page

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (load the practising rows when simple), `+page.svelte` (simple branch), `src/routes/[dance]/lessons/+layout.svelte` (New lesson sheet at `own` without sections/links fields), `src/lib/lessons/page.ts` (+ spec: `practiceRows`, the band words "Class · Tue 3 Nov").
- Create: `src/lib/components/lessons/SimpleLesson.svelte` (the simple page body; keeps the big page file from growing further).

**Interfaces:**
- Consumes: Task 1's `simpleLesson`; Task 4's `VideoFrame simple`; part 1's `scheduleForShown`, `dayWords`; Task 3's `addNow` for "Not in your practice yet · Add".
- Produces: `practiceRows(entries, states, today): { id: number; name: string; when: string }[]` in `lessons/page.ts` ("On Today today" etc.). When `simpleLesson(...)` is true the page draws `SimpleLesson`; otherwise the page is unchanged. Own lessons at `own`: the existing edit mode with sections, link groups, figures, routines, positions not drawn.

- [ ] **Step 1: Failing specs** for `practiceRows` and the band words.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS;** browser: a follow member on a class lesson (no SourceTabs, sections, links, Edit); an editor at `follow` on their own group's draft sees the full page and can Publish; an `own` person's own lesson edits title, notes, videos; 390 px and 1280 px.
- [ ] **Step 5: Commit** `feat(levels): the simple lesson page`.

---

### Task 8: The simple exercise page and log popup

**Files:**
- Modify: `src/routes/[dance]/(today)/exercises/[id]/+page.svelte` (+ server if needed), `src/lib/exercises/exercise-page.ts` (+ spec: what the simple page shows, "From class Tue 3 Nov ›"), `src/lib/components/exercises/LogShell.svelte` (prop `simple`), `src/lib/exercises/log-view.ts` (+ spec: the simple footer, "Done").

**Interfaces:**
- Consumes: Task 1's `simple`; Task 4's `simple` player.
- Produces: at `follow`/`own` the page draws: the type's `Content` with its video in the simple player, "From class … ›" to the lesson when it has one, a slot after the content for Task 9's card, the pinned "I practised this", part 1's Not today at the end. Hidden: Edit settings, Active, archive, SourceTabs, Make it mine, owner row to figure/routine pages, the Add block, History tiles, the set list. `LogShell simple`: faces only (no minutes, reps, note), practice panel only when the type's practice needs it, button "Done". Same posted fields as now minus the empty ones (the server already takes them as optional — no PAGE_EPOCH change).

- [ ] **Step 1: Failing specs** for `exercise-page.ts` and `log-view.ts` simple states.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS;** browser at `follow`: open a class drill from Today, log with a face, the row ticks, Undo works; at `all` nothing changed; 390 px and 1280 px (the desktop Today pane draws the same simple body).
- [ ] **Step 5: Commit** `feat(levels): the simple exercise page`.

---

### Task 9: Comments — the card and the sheet

**Files:**
- Create: `src/lib/components/comments/CommentsCard.svelte`, `CommentsSheet.svelte`, `CommentItem.svelte`, `Composer.svelte`.
- Modify: lesson page load + ONE line in `+page.svelte` after `PaneColumns` (card, group lessons only, hidden while editing; also in Task 7's `SimpleLesson`, which renders a `{@render}` slot or the same one line — coordinate through the controller's merge); exercise page load (the comments spec's lesson rule) + ONE line after the content; `src/lib/components/ui/Sheet.svelte` or `src/app.html` for the keyboard (builder's choice per the spec).

**Interfaces:**
- Consumes: Task 5's API (`comments/api.ts`), `CommentCard`, `CommentList`, `view.ts`; `reportOpen` with kind `'comments'` on sheet open; `Sheet` (`tall`, `footer`, `toast`); `undoToast`; `focusAfterRemoval`; `refreshWhenSettled` on close.
- Behaviour exactly as the comments spec's "The card" and "The sheet": newest top first, replies oldest first under "N replies", "@Name" on a reply to a reply, hearts toggle optimistically and roll back on failure, composer `use:guarded` with "Replying to … ×", delete with Undo in the sheet's toast, "Everyone in <group> sees it" at the end, read-only (no composer) when `open` is false.

- [ ] **Step 1: Failing specs** for any new pure helpers (keep logic in `comments/view.ts`; components stay thin).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS;** browser as two members and a teacher: post, reply, reply to a reply (@Name), heart, delete + Undo, Teacher tag, "N new" clears after opening; Review Focus 5 (keyboard emulation) and an existing rename sheet still fine; desktop dialog at 1280 px; closing with text asks Unsaved changes.
- [ ] **Step 5: Commit** `feat(comments): the card and the sheet`.

---

### Task 10: Desktop pass, docs, the whole check

**Files:**
- Modify: whatever the desktop pass finds; `CLAUDE.md` (live list: levels and comments with their spec links; Layout: `src/lib/levels/`, `src/lib/comments/`, `server/levels.ts`, `server/auto-add.ts`, `server/comments.ts`, `join-code.ts`, `welcome/start`; hard rules: comments' soft delete and the purge's hard delete in "Archive, don't delete", hearts as bookkeeping, comments exempt from History beside the worker's exemption, auto-add's `GROWTH` list beside `MUTATIONS`; fix "unpublish" in "Reach shrinks, entries follow" — there is none), both specs (Status: built, a "Decided while building" section), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` if it lists tabs.
- Screens: `scripts/shots/pages.txt` gains the first run, My class, a simple lesson, the comments sheet.

- [ ] **Step 1:** Walk every changed screen at 1280 px at each level (Side tabs, My class list column, simple lesson two columns, simple player desktop layout, comments dialog, welcome in `CardFrame`); fix what is off.
- [ ] **Step 2:** Docs as listed.
- [ ] **Step 3:** `npm run check` green (one run, under the memory scope).
- [ ] **Step 4: Commit** `docs: levels and comments built`.
