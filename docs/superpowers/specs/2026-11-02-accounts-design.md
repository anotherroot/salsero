# Accounts: friends get their own app

> **Since 2026-11-06 an account belongs to one dance** (the dance split,
> [`2026-11-06-dance-split-design.md`](2026-11-06-dance-split-design.md)):
> salsa and bachata are two apps on two hosts with their own accounts, invites,
> admin, storage and settings. Where this spec says an account holds both
> dances, the dance split replaces it.

> Step 1 of opening the app to other people. Brainstormed 2026-11-01/02.
> Steps 2 (clubs and groups) and 3 (republishing, suggestions, sub-positions,
> student lessons) are ideas in the salsa note, not designed here. The mockups
> for all three are at <https://claude.ai/artifact/PdediJ1FUxEgiDMmM3hDau>
> (private; "Salsero for clubs").

## Why

The app is used by one person. The goal is to slowly hand it to friends from
the same salsa and bachata classes, then to shared group content, and maybe
one day to the teacher. Everything after this step needs one thing first:
every row in the database knowing whose it is. This step builds that, plus
the minimum around it to let a friend in safely: an invite only the app's
admin can make, and a storage limit, because videos are the one thing that
costs anything.

A friend who gets in at this step has their own private copy of the app:
their own figures, lessons, practice and recordings, starting empty. Nobody
sees anyone else's things. Sharing comes in step 2.

## Goals

- **One way in: the admin's invite.** The app admin (the owner of the app,
  today the only user) makes a one-time invite in the app and shows it as a
  QR code or a link. The person who opens it picks an email and a password
  and has an account. There is no other way to get one; no public sign-up.
- **Every row has an owner.** Figures, lessons, routines, exercises, sets,
  songs, recordings, videos, spots, links and the count voice all belong to
  one person, and every request only reaches its own person's rows.
- **Storage is limited per person.** Each person has a limit; uploads that
  would cross it are refused before they start. A person sees what they use
  and can ask for more.
- **An admin page in the app.** The app admin sees each person's storage use
  and limit, the requests for more, and makes invites there.
- **The existing data stays exactly as it is,** now owned by the existing
  user.

## Non-goals (this step)

- Anything shared between people: clubs, groups, shared lessons, group QR
  codes. That is step 2; this step only has to leave room for it.
- Email: no verification, no password reset by mail. The app has no mail
  client. A forgotten password is the admin's problem for now (see "Left to
  the builder").
- Deleting or disabling accounts from the admin page.
- Per-person positions. See "Positions".
- Limits on anything but storage (songs per day, worker time).

## Anti-goals

- **The admin must not see other people's content.** The admin page shows
  numbers (storage, limits, requests), never anyone's figures, lessons,
  videos or logs. Being the admin of the app is not a back door into a
  friend's practice.
- **No leak between people, ever,** including the ways the dance wall
  already guards against: an id in a form body, a file name in a media URL,
  an id in an `/api/` call. Another person's row and a missing row get the
  same 404, as the dance wall does today.
- **Never lose data over a limit.** Going over (or having the limit lowered)
  refuses new uploads; it never deletes or hides what is there.

## Decided

### The invite

- Made on the admin page: **Invite someone** shows a QR code and the same
  link as text, with Share. *(My call: it expires 24 hours after it is made;
  the user asked only that it work once.)*
- It works **once**. The first account made with it uses it up; the code is
  then dead, even if it is shared further.
- Only the app admin can make one. Step 2's group QR adds people who already
  have an account and must never create one; keep the two separate.
- Store only a hash of the code, as `device_tokens` does. So a code is
  **shown once**: the sheet says so, and opening Invite someone again makes
  a new code and kills the previous unused one. There is no "current invite"
  to come back to. *(My call: the invite is shown to a friend standing next
  to you, so re-showing it is not worth storing it readably.)*

### Joining

- The invite link opens a public **Join** page: email, password, Create
  account. Same look as Sign in. A used, expired or unknown code shows a
  plain "This invite no longer works. Ask for a new one." and no form.
- Sign in's "Registration is closed." becomes a hint: "Got an invite? Open
  its link, or scan its code with your camera."
- The new account is signed in straight away and lands on Today.
- New accounts start with **both dances** and **nothing in them** but the
  shared positions. *(Since the dance split: one dance, the invite's.)* *(My call: the time zone comes from the browser at
  sign-up, falling back to the current default.)*
- Password rules as Sign in's today; the rate limits on login apply to Join
  too.

### The owner wall

- The wall works like the dance wall (`src/lib/server/scope.ts`): scoping in
  the data-access layer and route guards on params and ids. `src/lib/day`
  and `src/lib/urgency` never learn that users exist, as they never learned
  that dances exist.
- The root content tables get the owner: `figure_groups`, `figures`,
  `songs`, `exercises`, `lessons`, `routines`, `count_takes`. Everything
  else (sets, recordings, lesson videos, spots, spot links, the lesson join
  tables, links, video downloads, figure start positions, routine steps)
  derives its owner through its parent, as it derives its dance today.
  *(My call, following the dance pattern; the builder may put a column on a
  child table where a query needs it.)*
- The media servers (`recordings/[file]`, `audio/[file]`, `count/[file]`,
  `lesson-videos/[file]`) check that the file belongs to the signed-in
  person. Unguessable names are not the guard.
- `/api/` endpoints reached with a device token act as that token's person,
  as they already do.
- The worker queue (`/api/worker/*`) stays global: the home worker drains
  everyone's song and video jobs. A job's result lands on its owner's row.
- Uniqueness that is per dance today becomes per person and dance: figure
  names, a variation's name within its figure, and the rest that
  `figures.ts`, `routines.ts` and friends enforce in code. `count_takes`'
  unique slot (pattern, bpm, phrase) becomes per person.
- Per-user settings that exist (`users.timezone`, `default_styles`, the
  reminder, video size, device tokens) are already per person.

### Positions

Positions stay **one shared list per dance**, as they are today, used by
everyone. Only the app admin can add, rename or archive one. Positions are
what connect figures into routines; in step 2 figures get shared, and a
shared figure only connects if both people use the same positions. Per-club
lists and personal finer versions come later. *(My call; the user did not
object.)*

A figure's start and end positions are still the figure owner's choice;
only the list of positions is shared.

### Songs

Songs belong to the person who added them. *(My call for this step: shared
song libraries are an open question for step 2.)* Two friends adding the same
song download it twice; that is fine at this size.

### Storage

- **What counts:** the bytes of everything a person has on disk: lesson
  videos, recordings, song audio, count takes, **archived things included**,
  because archiving keeps the files. A saved YouTube video counts once it
  becomes a recording or a lesson video. Everything counts against the
  person who owns it. (Decided by the user, 2026-11-02: what is on disk is
  what counts, and people can see and clean up their biggest things.)
- **The limit** is per person, in bytes, set by the admin. *(My call: new
  accounts start at 1 GiB; the admin's own account has no limit.)*
- **Enforcement** happens where the size is known up front, so nothing is
  uploaded only to be refused:
  - a recording (one raw-body request): its `content-length`;
  - a lesson video (chunked): the total in the first chunk's
    `content-range`, checked when the upload starts;
  - a song upload: its size; a song download or a YouTube save, whose size
    is unknown until the worker has it: refused when queued if the person
    is already at or over the limit, and accepted when it lands even if it
    goes over *(my call: they asked while under)*;
  - a count take: refused if it would cross the limit.
- Refusals say how much is used, the limit, and point at Ask for more.
- **Used** is computed from the size columns, never stored as a running
  total. `songs` has no size column today: add one (nullable `ALTER TABLE
  ADD COLUMN`) and fill it once at boot for existing files, behind an
  `app_flags` marker, the way `importNoteLinks` runs once.

### What uses space

- Settings' Storage row opens a **What uses space** page: everything the
  person has on disk, biggest first, one row each (a lesson video, a
  recording, a song, the count voice as one row), with its size, what it
  belongs to ("Lesson · 15 salsa cubana moves", "Enchufla · Basic"), and
  "archived" where its parent is archived.
- Each row offers **Delete** where the app already allows a delete, through
  the same function and the same refusals: a lesson video or recording with
  a linked section refuses (`assertUnlinked`), a count take goes through its
  Undo hold. Tapping the row's text opens the thing itself.
- **Songs get a delete** (they can only be archived today). *(My call:)*
  deleting a song removes its row and its audio file in one go; it is
  refused while a live exercise uses the song ("Used by: …"), and archived
  exercises that point at it lose the link (`song_id` set to null) in the
  same transaction. Add songs to the hard-delete list in `CLAUDE.md`.
- No restore for archived things in this step; deleting is the way to free
  space.

### Asking for more

- **Settings** gets a Storage row: "Using 820 MB of 1 GB", a bar, **What
  uses space**, and **Ask for more** with an optional note. One open request per person; asking
  again while one is open shows that it is waiting.
- The admin page lists open requests: who, how much they use, their limit,
  the note. **Give more** sets a new limit (a few presets plus a number) and
  closes the request; **Decline** closes it. The person sees the new limit
  in Settings; no notification beyond that.

### The admin page

- Reached from Settings, visible only to the app admin.
- Sections, top to bottom: requests waiting; **Invite someone**; people,
  each with storage used, limit, and joined date, tapping one to change the
  limit.
- The app admin is a flag on the user. The existing user (created by
  `seedAdmin` from `ADMIN_EMAIL`) is the admin; there is exactly one for now.

## Constraints from the project

- `CLAUDE.md` hard rules apply. The ones this step leans on:
  - Never add a CHECK to an existing table; additive `ADD COLUMN` only, and
    read the generated SQL. Owner columns on existing tables are added
    nullable or with a default, backfilled to the existing user in the
    migration; "not null" lives in the data functions, like
    `exercises.lesson_id`. Dropping and recreating an index is not a table
    rebuild and is fine.
  - Data functions take `db` first; specs use `openDb(':memory:')` and never
    touch `$DATA_DIR`.
  - Deny-by-default auth: the Join page is added to `PUBLIC_PATHS` by exact
    path (the code goes in the query string, so the path stays exact).
  - A device token signs in on `/api/` only.
  - Nothing under `$lib/server` is imported by components.
- The server has 3.7 GB of RAM shared with other services and limited disk;
  lesson videos are not backed up (`docs/deployment.md`). The default limit
  is small for that reason.
- The design spec's "Single user" line and its Auth section change with this
  step.

## Left to the builder

- Table and column names, the invite code's format and length, how the QR is
  drawn (a small client-side library or an SVG built on the server).
- Whether "owner" is `user_id` on each root table or something shaped to
  accept a club later; step 2 will add group ownership beside it, so a
  column that only ever means "the person" is fine.
- How a forgotten password is handled before email exists (the admin making
  a reset link like an invite is one way); not needed for the first friend.
- The exact Settings and admin page layouts, from the shared components in
  `components/ui/` and the mockups.
- How the wall is tested. It deserves the same kind of spec as
  `dance-wall.spec.ts`: two users, every route, the other person's ids.
