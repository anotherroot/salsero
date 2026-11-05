# Comments on a class's lessons

Status: designed 2026-11-05, not built. Part 3 of three from the "app for
people who just follow their class" brainstorm (part 1:
[`2026-11-05-today-scheduling-design.md`](2026-11-05-today-scheduling-design.md),
part 2: [`2026-11-05-levels-design.md`](2026-11-05-levels-design.md)).

Mockups: drawn with the user during the brainstorm (YouTube-style list,
option B: a card at the end of the lesson opening a tall sheet).

## Why

A class is a group of people who see each other once a week. Between classes
they practise alone, and questions ("Can you show it again on Tuesday?",
"which foot do I start on?") have nowhere to go. Comments on the class's
lesson give them one place, seen by the whole class and the teacher.

## Goals

- Anyone who can read a group's lesson can comment on it, reply, and heart a
  comment.
- It is always clear who reads it: "Everyone in Salsa Tuesdays sees it".
- Replies are one level deep, YouTube-style: "3 replies" opens one indented
  column; a reply to a reply is marked "@Maja".
- The teacher's comments are marked "Teacher".
- The lesson page ends with a "Comments · N" card showing the newest comment;
  a tap opens a tall sheet with them all and the box to write in. The bottom
  tab bar stays on the page (the sheet covers it while open).
- The exercise page opens the same sheet for the exercise's lesson.
- Phone and desktop (the sheet is a centred dialog from 1024 px, as every
  Sheet already is).

## Non-goals

- Writing to the teacher privately (dropped for now).
- Comments on a person's own lessons (nobody else reads them), on figures,
  songs or exercises.
- Notifications of replies (push, the reminder, the Groups dot). The card's
  "N new" is the only marker. A later part can add "Maja replied to you".
- Editing a comment (delete and write again), images, mentions that notify,
  reactions other than the heart, reporting.

## Who

- **Reads and writes:** anyone `lessonAccess` gives `read` or `edit` on a
  lesson whose `team_id` is set: the group's members on published lessons,
  editors and the owner on drafts too. Everyone else gets the same 404 as for
  the lesson. A person's own lesson (`team_id` null) has no comments: the
  card is not drawn and the API answers 404.
- **A deleted group** (before its purge): comments are read-only for whoever
  still reads the lesson. Nothing can be posted, hearted or deleted.
- **Someone who left** reaches nothing of the group, so not its comments.
  Their comments stay, under their name (looked up as `teamNames` does for
  people who left), without the Teacher tag.
- **Teacher tag:** the author's role in the group is owner or editor right now.
- **Delete:** the author deletes their own; an editor or the owner deletes
  any comment in their group.

## What is stored

Migration 0032 if part 2 lands first (else 0031), new tables only:

- `lesson_comments`
  - `id`, `lesson_id` → lessons (cascade not needed: lessons are archived,
    never deleted), `author_id` → users (`author_id`, not `user_id`, so it never
    reads as an owner; the owner and the dance come through the lesson, like
    `lesson_videos`).
  - `thread_id` → lesson_comments, null for a top comment; a reply's top
    comment otherwise (always a top comment, kept in the same lesson by the
    data function).
  - `reply_to_id` → lesson_comments, null for a top comment; the comment
    replied to (the top comment or a reply in the same thread). When it is a
    reply, the reply is drawn with "@<its author>".
  - `body` text, trimmed, 1–1000 characters (checked in the data function).
  - `created_at`, `deleted_at` (null while live), `deleted_by` → users.
  - Index on (`lesson_id`, `created_at`).
- `lesson_comment_hearts`: (`comment_id` → lesson_comments, `user_id` → users),
  primary key both, `created_at`.

**Delete is soft** (`deleted_at`, `deleted_by`), which keeps the "Archive,
don't delete" rule and makes Undo a clear of the column. A deleted top comment
with live replies is drawn as "Comment deleted" with its replies under it; a
deleted comment without live replies is not drawn. Counts count live comments
only.

**Hard deletes:** a group's purge (`purgeRows`) deletes its lessons' comments
and hearts (nobody can reach them after it). Hearts are bookkeeping: un-hearting
deletes the row. Both are listed in CLAUDE.md's hard-delete rule.

**History:** comments are a conversation, not the group's content, so posting,
hearting and deleting are not logged in History, and they are not in
`MUTATIONS`. This is an exception to "every group mutation is logged",
written into CLAUDE.md beside the worker's. **(My call.)**

**What's new:** the person's last look at a lesson's comments is an `opens`
row of a new kind `'comments'` (item = the lesson id; `opens.kind` has no
CHECK). It is recorded from the page when the sheet opens, never in a load,
through `POST /api/opens`, which learns the kind. The card shows "N new" for
live comments by others created after that open (or after the person
joined the group, if never opened). Nothing else changes: the Groups dot and
the "N new" pills ignore comments.

## The card

At the end of the lesson page (both the full page and part 2's simple page),
full width, after everything else, hidden while editing:

- Title "Comments" with the count, "N new" pill when there are new ones.
- The newest live comment: author's first name (and Teacher tag), two lines
  of its text, "2 days ago".
- With none yet: "Be the first to ask or say something", and the count is not
  drawn.
- The whole card is one button that opens the sheet.

On the exercise page, the same card (titled "Comments on the class") after
the content, for the exercise's lesson:
- a lesson entry (`exercises.lesson_id`);
- a group drill (`drill_id`): the lesson `drillAddRoute` names for it (the
  person's added lesson holding it);
- a routine or figure entry: the newest lesson the person has added that
  links it;
- none of these, or the lesson has no group: no card.

## The sheet

`Sheet` with `tall`, titled "Comments", subtitle the lesson's title, the
composer as its `footer`, its `toast` slot for Undo.

**The list**, newest top comment first:

- Each comment: a round avatar with the initial in the group's colour, the
  name line ("Maja · Teacher · 2 d"), the text (linkified by `links.ts`, no
  `{@html}`), and an actions row: the heart with its count (yours filled red,
  a tap toggles it; hearting your own is allowed), Reply, and for whoever may
  delete, a "⋯" with Delete.
- Under a top comment with replies: "N replies ▾". It opens the thread in one
  column, indented once, oldest reply first; "Hide replies ▴" closes it. A
  reply whose `reply_to_id` is another reply starts with "@Maja" in the
  accent colour.
- At the end of the list: "Everyone in Salsa Tuesdays sees it".

**The composer** (the footer): a text field "Write a comment…", growing to
four lines, and a send button (disabled while empty). Over it, while
replying: "Replying to Maja ×" (the × goes back to a top comment). Reply on a
top comment or a reply opens that thread and fills this line. The composer is
a form someone types into, so it uses `use:guarded` (closing the sheet with
text in it asks "Unsaved changes").

After sending: the box clears, the new comment appears at the top (or at the
end of its open thread) and scrolls into view; the card behind updates on
close (`refreshWhenSettled`).

**Delete:** "⋯ → Delete" deletes at once and shows "Comment deleted · Undo"
in the sheet's toast for the toast's life. Focus goes to the next comment
(`focusAfterRemoval`).

**The keyboard:** the composer must stay visible above the on-screen keyboard
in the Android app (which pads the WebView already) and in Chrome on Android.
Nothing in the web code handles the keyboard yet; the builder picks the
mechanism (`interactive-widget=resizes-content` in the viewport meta, or a
`visualViewport` offset on the sheet) and checks that it does not break the
other sheets. A small rename sheet hiding under the keyboard is an open task
in the user's notes; if the fix is in `Sheet` it covers both.

## The API

Flat, like `/api/video-spots`: the lesson's access is asked about
`locals.user.id`, the same 404 for a stranger and a missing id.

- `GET /api/lessons/[id]/comments` → the list (comments, threads, hearts,
  names, roles, what this person may delete), and whether posting is open.
- `POST /api/lessons/[id]/comments` `{ body, replyTo? }` → the new comment.
- `POST /api/comments/[id]/heart` → toggles; returns the count and whether
  hearted.
- `DELETE /api/comments/[id]`, `POST /api/comments/[id]/restore` (Undo).

The card's data (count, newest, new count) comes with the lesson page's and
the exercise page's own loads. A pure module `src/lib/comments/view.ts` holds
the words, the thread shaping and the "@Name" rule; the data functions live
in `src/lib/server/comments.ts` and take `db` first.

`/api/opens` taking `'comments'` is additive; older pages never send it.

## Owner wall and integrity

- Every route goes through `lessonAccess` / `requireLessonAccess`; the owner
  wall specs (`api/owner-wall.spec.ts`) get cases for u2 on u1's group
  lessons they do not reach.
- `thread_id` and `reply_to_id` must be in the same lesson: the data function
  checks, and a spec proves a reply cannot be posted into another lesson's
  thread.

## Calls made (mine, check them)

- Comments only on a group's lessons; drafts are commentable by editors.
- Soft delete with Undo; editors can delete anyone's comment.
- No editing of a comment.
- Not in History.
- "N new" only on the card, no dot elsewhere.
- Top comments newest first; replies oldest first.
- 1000 characters at most.
- The exercise page's card for a routine or figure entry uses the newest
  added lesson that links it.
