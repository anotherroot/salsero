# An AI connector with a queue of actions

Status: design, 2026-11-09. Not built.

## Intent

The user wants an AI to help organise the app: check how things are written,
write them more nicely when asked, mark sections on lesson videos, create new
things, publish lessons. The user wants to allow it everything, but nothing
may happen without their confirmation, and the confirming happens in the app.

So the app gets an MCP connector any AI can add (Claude, ChatGPT, Gemini …).
The AI reads freely. Every change it wants becomes an **action in a queue**;
the database does not change until the user runs the action in the app. The
user runs **all**, **up to here**, **just this one**, or **drops** actions.

Two sister projects already have connectors with the same conventions, and
this one copies them: `~/Projects/muscle_model` (`src/lib/mcp/`,
`src/lib/server/oauth/`, docs/008 §114–118) and `~/Projects/homestash`
(`docs/superpowers/plans/2026-11-08-phase-3a-claude-connector.md`, rulings
C1–C13; itself a near-verbatim copy of muscle_model). Neither has a queue:
their AI writes at once. The queue is new here.

## Goals

- A connector at `/mcp` on each dance's host (`salsa.anotherroot.eu/mcp`,
  `bachata.anotherroot.eu/mcp`), OAuth 2.1, added in the AI app as a custom
  connector. An account belongs to one dance, so a connection does too.
- Read tools covering what the person can read, own and group.
- Write tools that only manage the pending queue (add, change, delete,
  group, order). The AI may propose creating,
  editing, linking, archiving and publishing, on the person's own things and
  on group things the person may edit.
- A queue page in the app that fills while the AI works (desktop tab beside
  the chat) and waits for later (phone).
- An experiment: the AI proposes sections on lesson videos from the picture
  and, where the AI can hear, the sound.

## Anti-goals (the user's own, 2026-11-09)

Each of these makes it a failure even if it technically works:

1. **Too many small proposals.** Reviewing must not take longer than doing it
   by hand. Related changes are one action ("Typos in 12 figure names") that
   opens into its lines, each of which can be left out. The AI is told to
   propose only what is worth the user's time. Drop all is one tap.
2. **Losing the user's voice.** By default the AI fixes spelling and typos
   only; it rewrites more nicely only when asked in the chat. It uses the
   words already in the app. Text changes are shown word by word.
3. **Anything slipping past the queue.** Enforced by the server, not by the
   AI's goodwill: no MCP tool can write a content row. A spec walks every
   write tool and checks it touched nothing but the queue.
4. **Not seeing exactly what will happen.** Every action shows, field by
   field, now → after, rendered by the app from the action's data (never
   only the AI's own sentence about it). A group action says who will see it
   ("Salsa Ljubljana will see this").

## Non-goals

- No "via Claude" or "by AI" mark anywhere others see. A run action is the
  person's own change: a group's History shows the person, as for a form.
  (User's ruling, 2026-11-09.)
- No deleting the person's things through the queue: moves, figures,
  routines, drills, lessons, positions are archived and restored, never
  deleted. What the app's own forms already remove for good (unlinking a
  section link, removing a routine slot, deleting a video section, a group's
  going to `team_trash`) the queue may do the same way, and only that way.
- Not in reach of the queue, v1: group membership, roles, codes, invites;
  account, settings, storage; uploading or deleting media files; comments
  (they speak as the person to others); Today's entries and faces (they
  record real practice); a song's count grid.
- No AI inside the app itself. The app hosts the queue; the thinking happens
  in whatever AI the user connects.
- No Whisper or other speech model on the home worker (user's ruling): the
  connected AI makes out the speech itself if it can.

## The connector

Copy muscle_model / homestash file by file, with these differences:

- **Any AI client** (user's ruling). The sisters accept only
  `https://claude.ai` / `https://claude.com` client ids. Here: Client ID
  Metadata Documents from any https origin, **and** dynamic client
  registration (RFC 7591, `/oauth/register`) for clients that only do that.
  Registration is rate limited and stores only the client's name and redirect
  URIs. The consent page names the client *and* shows the redirect host in
  plain sight, since a client can call itself anything. The damage a rogue
  connection can do is reading (privacy) and filling the queue, never a change.
- **Scope of one connection:** the account (and so its dance). One scope, as
  in the sisters.
- **Auth plumbing as in the sisters:** `/mcp`, `/oauth/*` and the
  `.well-known/oauth-*` documents are self-authed paths: they skip the login
  redirect and never see the session cookie; matched on the decoded path
  (`/m%63p`). Kit's CSRF check would refuse the token POST (no Origin), so do
  what the sisters did: own check in the hook, `/oauth/token` (and
  `/oauth/register`) the only exemptions. `/mcp` rejects a foreign `Origin`.
  Tokens and codes stored as SHA-256 only, rotation and reuse rules as in
  the sisters. Rate limits read the client address the way this app already
  does behind Cloudflare.
- **This app's rules apply:** every new table gets `mintedId` and its mark
  trigger; is classified in `src/lib/sync/tables.ts` (the OAuth tables and
  the queue: never synced); every new GET endpoint is classified in
  `src/lib/offline/routes.ts` (all network-only); the service worker never
  answers `/mcp`, `/oauth/`, `/.well-known/oauth-*`; `serverNow()`; words
  through `t()` in en and sl (the consent page, the queue, Settings);
  refusals through the refusals guard. Server instructions and tool
  descriptions are for machines: English.
- **Settings → Connected AI apps:** each connection (client name, since, last
  used) with Disconnect. Disconnecting keeps the queue's actions; pending
  ones from that connection stay runnable (they are the user's to judge).

## Read tools

What the person can read, through `access.ts` and the scope helpers, never
`.dance` alone. Enough for the jobs above: search; a figure / move / routine /
drill / lesson / position with its text, links and sections; a group's
things; the app's glossary of the person's own words (their names for moves,
positions, the terms in their notes) so text fixes keep their vocabulary; the
queue itself (so the AI sees what it already proposed and what was dropped).
The exact tool list is the builder's, with the sisters' habits: few tools,
`readOnlyHint`, hand-written argument checks, an `isError` that tells the AI
how to correct itself.

Content written by group members reaches the AI (lesson notes, names). It can
carry instructions aimed at the AI. The queue is the defence: nothing it
reads can make a change without the user.

## The queue

### An action

One row per action, owned by the person (`user_id`, `dance`), with:

- the connection it came from,
- its place in the queue (order of arrival; the AI cannot reorder),
- a **kind** from a fixed list (below) and its **lines**: for an edit, the
  target row and field → new value; for a create, the new thing's fields;
  several lines for a batched action ("Typos in 12 names"),
- the **before** of every field it would change, taken when proposed: shown
  on screen and used to notice a change since,
- the AI's one-line title (shown, but never the only thing shown),
- a status: pending, done, dropped, failed (with the refusal), and when.

A line can be left out of a batched action before running it.

### What can be proposed (v1)

Anything a person can do through the app's own forms on content, within the
non-goals: edit text fields (names, notes, titles, labels) of moves, figures,
routines, drills, lessons, positions and video sections; create a move,
figure, drill, routine (with its slots), position, lesson draft, or a section
on a video; add and remove links (section links, lesson links, routine
slots); archive and restore; publish a lesson draft.

Each kind runs through the **same server function the form uses**, so
everything the app already enforces holds without a second copy: `scope.ts`,
`access.ts`, `logChange` and `seen` on group rows, `autoAddPending`,
`flowing`/`flowAfter` on copies kept in step, `usableOf`, `figureLabels`.
The exact kind list is the builder's to settle against those functions.

### Groups (user's ruling, 2026-11-09)

The AI puts actions into **groups** it names ("Spelling", "Sections: 15
salsa cubana moves", "Publish"). A group is a heading in the queue with its
own Run group and Drop group; inside it the actions keep their order. An
action belongs to exactly one group. Groups are ordered like actions; Run all
goes group by group.

### Actions that depend on each other (user's ruling, 2026-11-09)

Two kinds of order, both shown on the page:

- **Independent:** actions that only happen to be listed in order. Each can
  be run or dropped on its own.
- **Dependent:** an action says which earlier actions it needs (`needs`).
  It cannot be run until they are done: its Run is off and it says "Waits
  for 3". Dropping an action the others need offers to drop them too. A
  create returns a reference (`@4`) that later actions use ("add @4 to
  routine Basic"); using a reference makes the dependency by itself.

A dependency always points to an earlier action (no cycles), possibly in
another group.

### The AI edits its own queue (user's ruling, 2026-11-09)

Reviewing is a conversation: the user sees something wrong, says so in the
chat, and the AI fixes its proposals. So the AI has full create / read /
update / delete over the **pending** part of the queue: add, change, delete
and reorder actions and lines, move them between groups, make, rename,
reorder and delete groups, set and clear `needs`. It cannot touch what is
done, dropped or failed (that is the user's record; to reverse a done action
it proposes a new one), and it never runs anything.

Every AI edit of an action is visible: "Changed by Claude 10 s ago", with
the earlier version one tap away. A run sends the version the user saw; if
the AI changed the action since, the run refuses ("Claude changed this just
now, have a look") instead of running something the user did not see.

### Running

- **Run all**, **Run up to here**, **Run this one**, **Drop**, **Drop all**.
- Each line of an action is its own transaction (a create with its parts,
  such as a routine with its slots, is one line). Runs go in queue order and
  **never stop at a refusal**: a refused line stays pending with its reason,
  everything else runs, and what depends on a refused line refuses in turn.
  A batched action is done when all its lines are; the page shows "11 of 12
  done, 1 refused". So a line has its own status, not only the action.
- **Changed since proposed:** if a field's current value differs from the
  action's *before* (someone in the group edited it, or the user did), the
  action refuses with "Changed since it was proposed" and shows the three
  values. The AI can be asked for a new one; nothing is run blind.
- **Undo:** a toast with Undo after a run, as elsewhere. Done actions stay in
  the queue's done list for 30 days with Undo while the values still match
  what the run wrote. Undo does what the app's own undo for that thing does:
  an edit puts the old values back, a created move/figure/routine/drill/
  lesson/position is archived, a created section or link is removed the way
  the form removes it. **Publish has no Undo** (the app has no unpublish, and
  members' Today already got its drills); in the queue it says so before it
  runs: "Can't be undone: the group sees it at once."
- Group History shows the person (non-goals). The queue's done list is the
  person's own record that an AI proposed it.

### The page

The queue is reachable from the app with a count when something is pending,
and refreshes by itself while open, so a desktop tab fills as the AI works
(polling while visible is enough; the builder's call). Same queue on every
device.

**The look (user's pick, 2026-11-09: option A of the board
https://claude.ai/artifact/FX91ZKLGWgo7cg9YWQUHCi):** its own page,
"Predlogi" / "Suggestions", reached from a row at the top of the You tab
("Predlogi AI · 7", "2 new") and a dot on the You tab. A long list of cards
under group headings, each card the change itself (struck through → new,
word by word), with Drop · Up to here · Run; a batched card lists its lines
with ticks; a video section card plays the stretch; a publish card carries
the can't-undo warning; a refused card says why. A dependent card hangs
under what it needs and says "Waits for 3". A fixed bar at the bottom: Drop
all · Run all. Done today below, with Undo. The board's A2 artboard is the
reference; the dark theme is drawn when building.

## The video sections experiment

Built last, after the connector and queue are in use.

- A **timeline tool** for a lesson video (and a recording) returns, for a
  stretch of time: small frames (about one every 2 s) as images, and the
  stretch's sound as MCP audio content. An AI that can hear uses the sound;
  one that cannot (as far as known on 2026-11-09, Claude reads images, not
  audio) works from the frames. Not known yet which AIs consume MCP audio;
  finding out is part of the experiment.
- Frames and sound pieces are prepared by the **home worker** (it has
  ffmpeg) and stored beside the video; the server runs no media processing
  beyond what it does today. Sizes are the builder's call, sized so one call
  fits an AI's limits.
- **Not ready yet:** the worker polls and may be off. The first call on a
  video queues the job and answers "being prepared, ask again in a minute or
  two" (or "the home worker is offline" when it has not polled lately); the
  AI tells the user. A tool to list which videos are ready lets the AI pick
  those first. No preparing ahead of time in v1.
- The pieces are derived and do not count toward anyone's storage; they are
  removed 30 days after last use and with their video.
- The tool also returns the person's own sections on other videos (start,
  end, label, linked figure), so the AI learns their habit: a section starts
  a little before the figure and ends a little after; sometimes earlier, with
  the explanation.
- Proposed sections go into the queue like anything else; the queue plays
  each one looped before it is run.
- **Measuring it:** on a few videos the user has already marked, compare the
  AI's sections to the user's (starts and ends within a second or two, missed
  and extra sections). The result decides whether this stays, and whether
  frames-only is good enough.

## Phases

1. The connector and the read tools; Connected AI apps in Settings.
2. The queue: the write tools, the page (after the user picks a look), Run /
   Drop / Undo, references between actions, changed-since.
3. The video sections experiment.

Each phase deployable on its own. Phase 1 alone is useful: the AI can answer
questions about the user's moves and lessons.

## Left to the builder

- The exact read tools and action kinds, against the existing data functions.
- Table and column names, the reference syntax, the queue's size caps (a cap
  on pending actions and on an action's size is needed; the number is yours).
- How the page refreshes, how the worker's frame and sound pieces are cut and
  stored.
- Server instructions to the AI: they carry anti-goals 1 and 2 (batch related
  changes, propose only what is worth the time, spelling only unless asked,
  the user's own words).

## Decided by Claude, not by the user

- DCR alongside CIMD (needed for "any AI").
- Archive and restore are in reach (reversible); deletes only where the
  app's forms already delete (links, slots, sections), the same way.
- A run never stops at a refusal; a line has its own status.
- Publish has no Undo and says so in the queue.
- The video timeline answers "being prepared" instead of waiting; its pieces
  do not count toward storage.
- The queue's tables are never synced to the phone; the queue page needs the
  network.
- Pending actions from a disconnected connection stay.
- The list of things out of reach in v1 (non-goals).
