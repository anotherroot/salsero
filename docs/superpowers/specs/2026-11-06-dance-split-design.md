# Two apps on one backend: the dance split

Salsa and bachata become two separate apps that share a backend and a
database. An account belongs to one dance. `salsa.anotherroot.eu` is salsa
only, `bachata.anotherroot.eu` is bachata only. Someone invited to salsa
signs in to salsa, sees salsa, and has no idea bachata exists.

Agreed with the user on 2026-11-04 and 2026-11-06. It replaces the shape in
which one account held both dances. In that shape, the content was walled by
the `dance` column but the account itself was shared: name, zone, storage,
Settings, My count and paired phones.

## Why

- **Two apps, not one app with two rooms.** The user wants the dances apart
  "completely, except for the backend". A salsa person and a bachata person
  should each see an app that is only theirs.
- **The account is where a subscription will hang later.** Today an account
  is free and has a storage limit. A shared account would hold one limit for
  both dances, or two limits on one row. The user does not want people
  making a second account to get a second free allowance. With one account
  per dance, the rule is simple: an account has one limit. Paid plans come
  later and may then join a person's accounts. That is out of scope here, but
  nothing in this design may make it harder. In particular, keep the email on
  both accounts so they can be matched later.
- **The wall moves up a level.** Today a dance is a wall through the content
  and a person is a wall inside the dance. After this change, the account is
  the outer wall: an account has a dance, and every row it owns is of that
  dance.

## Goals

1. `users.dance`: every account belongs to exactly one dance. Email is unique
   per dance, not globally. The same address may hold a salsa account and a
   bachata account, each with its own password.
2. The host decides the dance. `salsa.anotherroot.eu` serves salsa and
   `bachata.anotherroot.eu` serves bachata. Login, Join, `/g/<code>`, Get the
   app, `/`, the manifest and the error pages on a host speak only of its
   dance.
3. An account reaches only its own dance. A session or device token whose
   account is salsa gets the same 404 or login redirect on bachata pages that
   a stranger gets. This is the security wall, and it holds whatever the host.
4. Everything that was per account is now per dance with no new columns:
   name, timezone, storage limit, What uses space, Ask for more, the reminder,
   the video size, paired phones, My count, the group limit, the admin flag.
   Theme is a host-only cookie, so it splits by host.
5. The admin is an account in a dance. The salsa admin sees and invites only
   salsa people. An invite carries a dance, and Join makes an account in it.
6. Existing data is split, so the one person with both dances (the user) ends
   up with two accounts holding exactly what they had.
7. The bachata Android app 1.6 points at `bachata.anotherroot.eu`.

## Non-goals

- No second backend, database or deploy. One node process, one SQLite file,
  one `$DATA_DIR`.
- No way to move content between dances, and no shared voice. A person who
  wants My count in both dances records it in both.
- No account linking, no single sign-on across the two hosts, no "you have an
  account in the other dance" hint.
- No new screens and no new look. Where a screen shows both dances today (the
  admin's groups-made columns, Get the app's two cards), the other dance is
  removed. If building finds that something must look different rather than
  just lose a part, stop and follow the designs-first rule: real screenshots
  from a backup copy (`scripts/shots/shots.sh`, 390x844, light and dark),
  2–4 options from the redesign spec, sent to the user's phone, build after
  they pick.
- The URL paths do not change. Pages keep living under `/[dance]/`, so
  `bachata.anotherroot.eu/bachata/moves` is a real URL. Dropping the prefix
  would touch every route and every link builder for no gain to the user.

## Anti-goals

These would make the change a failure even if it technically worked:

- **Any path by which a salsa account reads or writes a bachata row.** This
  covers flat routes (`/api/*`, `/recordings`, `/audio`, `/count`,
  `/lesson-videos`, `/settings`, `/voice`) as much as `/[dance]/` pages.
- **Losing anything of the user's.** Content, practice history, groups,
  recordings, count takes, paired phones, sessions on salsa, Today's picks.
- **A login page that tells someone whether an email has an account in the
  other dance.**
- **Breaking the home worker.** Its `/api/worker/*` calls go to
  `salsa.anotherroot.eu` with a bearer token and must keep working unchanged.

## The account

- Add a `dance` column to `users` (text, nullable in the schema, kept whole
  by the data functions, with no CHECK; see CLAUDE.md on CHECKs).
- Drop the unique index `users_email_unique` and add a unique index on
  `(dance, email)`. Both are separate indexes in the SQL, so no table rebuild
  is needed. Read the generated SQL before committing it.
- `locals.user` carries `dance`. Every lookup by email (login, Join, the boot
  admin, the rate limiter's `user:<email>` key, invites) also takes a dance.
  The rate limiter key becomes `user:<dance>:<email>`.
- Every data function that today takes `userId` and a dance keeps working,
  but the dance must equal the account's. `wallOf(params, locals)` refuses (404)
  when `params.dance` is not `locals.user.dance`. That one rule is the wall
  for every `/[dance]/` route.
- Flat routes have no dance in the URL. They take the account's dance where
  they need one. `/settings` and `/voice` stop reading `lastDance`.
- `access.ts`, `fileAccess` and the rest already check ownership by user id.
  Because an account's rows are all of its dance, they need no change beyond
  tests proving that a salsa account is refused on a bachata file.

## Hosts

- `DANCE_HOSTS` (env) maps hosts to dances, e.g.
  `salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata`. `hostDance(url)`
  reads it. It is pure, with the map passed in, and tested.
- **On a mapped host:**
  - A page under the other dance's prefix redirects (303, GET only) to the
    same path on that dance's host. A POST to it gets a 404.
  - `/` goes to the host's dance.
  - A signed-in account of the other dance (an old session from before the
    split, e.g. a bachata person who used `salsa.anotherroot.eu/bachata`) is
    sent to the same path on its own dance's host (303, GET; a POST gets a
    404). There it signs in once. *My call:* this only tells the person
    something they already know, so it leaks nothing. A stranger gets the
    plain login.
  - Login and Join look the email up in the host's dance only.
  - `/g/<code>` for a group of the other dance is a 404, the same as a bad
    code.
- **On an unmapped host** (dev's `*.localhost`, loopback `/health`, specs),
  the dance comes from the path, as today. Login and Join get it from a
  `?dance=` query, or from the `next` path's prefix, falling back to
  `DEFAULT_DANCE`. *Builder's call:* how dev offers both. A `dance` query on
  the login page is enough. Security does not rest on the host: rule 3 above
  (account dance = route dance) does.
- `ORIGIN` cannot name two hosts. Drop it from the env and set
  `PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=host` (adapter-node).
  Then `url.origin` is the host the request came to, and SvelteKit's CSRF
  check compares against that host. nginx already forwards `Host`, and it
  must set `X-Forwarded-Proto` (see "Outside this repo"). Check the CSRF
  behaviour against `node build` with both host headers. `vite dev` skips
  the check (see CLAUDE.md on the worker).
- **Public paths answer on both hosts:** the app-update check
  (`/api/app-update/[dance]`) and the APKs (`/releases/[dance]/…`), so an old
  bachata app on `salsa.anotherroot.eu` can still update itself. Also
  `/health`, and the worker's `/api/worker/*`, which never consults the host.
- Cookies are host-only already (no `domain` attribute). The session, theme,
  group mode, the `?app=android` cookie and the last-dance cookie separate by
  host by themselves. The last-dance cookie and `lastDance` go away: the
  account or the host now says which dance.

## Invites, Join, admin, boot

- `invites.dance`, a new nullable column. Existing unused invites get
  `'salsa'`. *My call:* they were all made from salsa.
- Creating an invite uses the admin's dance. Join uses the invite's dance, and
  refuses (as a bad invite) an invite of the other dance than the host's.
- The admin page lists only accounts, groups, requests and limits of its
  dance. Remove the per-dance groups-made columns: there is one dance now.
- Boot admin: `ADMIN_EMAIL`/`ADMIN_PASSWORD` create an admin in every dance
  that has no account yet. So a fresh dev database gets both, and production,
  where both dances will have accounts after the split, gets none.
- Get the app (`/app`) shows only the host's dance's app.

## My count

`count_takes` is a person's, so it splits with the account. A bachata account
starts with no takes unless the split copies them (below). Nothing else
changes. The patterns a dance offers are already per dance.

## Splitting existing accounts

A boot step, `splitAccounts(db, files)`, idempotent, run at boot before the
integrity checks, like `settleFormerMembers`. It also runs **before the boot
admin**. While every `dance` is NULL, "a dance with no account" is true of
both dances, and an admin made then would clash with the split's bachata
account on `(dance, email)`. It is a data function, not SQL,
because it makes new ids and hard-links files.

For every user with `dance` NULL:

1. **Find the dances the account touches:** rows it owns in any root table
   (`figure_groups`, `figures`, `positions`, `routines`, `songs`,
   `exercises`, `lessons`), its `team_members`, `app_installs` and
   `default_styles`.
2. **None or one** (salsa if none): set `users.dance` to it. Done.
3. **Both:** the account keeps salsa (`users.dance = 'salsa'`). A new account
   is made for bachata with a new id. It copies `email`, `password_hash`,
   `first_name`, `last_name`, `timezone`, `reminder_minute`,
   `video_short_side`, `daily_count`, `is_admin`, `storage_limit_bytes` and
   `group_limit` (every `users` column but `id`, `dance` and `created_at`).
   A column added since 2026-11-06 is copied too, unless it is clearly
   per-dance.
   Every row of the person that is bachata's is then moved to it:

   | table | what moves |
   |---|---|
   | `figure_groups`, `figures`, `positions`, `routines`, `songs`, `exercises`, `lessons` | `user_id` where `dance = 'bachata'` |
   | `today_picks` | where the exercise is bachata's |
   | `default_styles`, `app_installs` | where `dance = 'bachata'` |
   | `team_members` | where the team is bachata's |
   | `teams.created_by`, `teams.deleted_by` | where the team is bachata's |
   | `team_changes.actor_id`, `team_trash.deleted_by` | where the team is bachata's |
   | `lesson_adds` | where the lesson is bachata's |
   | `opens` | where the lesson or song is bachata's |
   | `twins` | where the item is bachata's |
   | `video_downloads.requested_by` | where the link's owner row is bachata's |
   | `device_tokens` | where `label` is `Bachata app`. Every other label stays with salsa: the generic `Android app` was paired before the flavors (2026-10-30), when the only app was salsa's. In the backup, the user's two `Android app` tokens date from October and their two `Bachata app` ones from 2026-11-04/05 |
   | `storage_requests` | with a `team_id`: where the team is bachata's. Personal ones stay (all are resolved in the backup) |
   | `invites.created_by`, `invites.used_by` | stay (history) |
   | `sessions` | stay (bachata will be on a new host; sign in there once) |

   `count_takes` are copied, not moved. Each take gets a hard link under a new
   name for the bachata account (`CloneFiles`-style: link before the write,
   unlink if it throws), so both accounts have the voice and each counts its
   own bytes.

   Check every table in `schema.ts` against this list while building. The
   table above was made from the schema on 2026-11-06. A table added since,
   or a JSON snapshot holding a user id (`team_trash`, `team_changes`), may
   need a line. Keep any `seen`/snapshot JSON as is: it records who did what
   at the time.
4. All of this happens in one transaction per person.

After the split, a new integrity check `danceIntegrity` lists rows whose
owning account's dance differs from the row's dance. Boot logs it like the
others. Every spec of the split asserts it is `[]`, together with `crossRefs`
and `ownerIntegrity`.

Production as of the 2026-11-06 backup has four accounts. One (the user,
admin) has both dances, so it splits. Two have one dance. The fourth,
`1d8846…`, joined a bachata group and has the salsa app installed. The user
said to delete that account and invite them again. That deletion is a plan
step, not a code path (below).

## Deleting the one account (a production step)

Done by the plan, before the deploy that carries the split, with a fresh
backup taken first (`sudo systemctl start salsa-backup`):

1. Write the delete as SQL for exactly that user id, covering every table
   above.
2. Run it against a copy of the fresh backup in the scratchpad, never the
   live file. Check that `ownerIntegrity`-style queries come back empty and
   that nothing else changed. Row counts of other users must be identical
   before and after.
3. Show the user the SQL and the dry-run result. Run it on the box with the
   `sqlite3` already installed there, inside `BEGIN … COMMIT`, with the unit
   stopped.

The person's membership goes with them. A group they were in loses one
member. Their `team_changes` lines, if any, keep their id as actor. History
then shows an unknown name, which is acceptable.

## The Android app

- The `site` Gradle property becomes per flavor: salsa
  `https://salsa.anotherroot.eu`, bachata `https://bachata.anotherroot.eu`.
  The paths stay `/salsa` and `/bachata`.
- **1.5 and older cannot be told "Update needed" after the deploy.** Its WebView opens
  `salsa.anotherroot.eu/bachata/…`, the new rule redirects that to
  `bachata.anotherroot.eu`, and `WebShell.kt` sends any host other than
  `BuildConfig.SITE` to the outside browser. The Update needed block is drawn
  by the page, so the old app never sees it. *My call:* accept that. In the backup,
  the only bachata app install is the user's own. So the rollout is: deploy,
  release bachata 1.6 (direct channel), and the user installs it by hand from
  `bachata.anotherroot.eu/app` in the phone's browser. The minimum is not
  raised, and no compatibility path for older apps is built. A Play release of 1.6
  follows whenever the user wants. The salsa app needs no release.
  Releasing is the user's to approve, like a deploy (`scripts/release.sh`,
  docs/deployment.md).
- The bachata app's paired phones move to the new bachata account, so a
  re-pair is not expected. If the app pairs on login anyway, that is fine.

## Outside this repo (for the user to approve)

In `~/.config/nixos-config`, `modules/services/salsa.nix`:

- A second nginx vhost `bachata.anotherroot.eu`, identical to salsa's: the
  same `lib.recursiveUpdate (publicAcme { port = salsaPort; }) { … }` with
  `client_max_body_size 100m` and the proxy buffer lines. Best done as one
  `let` value used for both names. `publicAcme`
  (`modules/services/exposure/public-acme.nix`) is `enableACME` + `forceSSL`
  + a proxy to the port, so the new name gets its own certificate.
- No header work is needed: `modules/features/nginx-base.nix` turns on
  `recommendedProxySettings`, which already sends `Host` and
  `X-Forwarded-Proto` (checked 2026-11-06).
- In `secrets/salsa-prod.env.age`: remove `ORIGIN`, and add
  `DANCE_HOSTS=salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata`,
  `PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=host`. The three
  non-secret ones may go in the unit's `Environment` instead.
- The VM check (`svc-salsa`) gains the second vhost.
- **DNS:** nothing to add. `bachata.anotherroot.eu` already resolves to
  Cloudflare's proxy (the wildcard), the same addresses as salsa (`dig`,
  2026-11-06). Let's Encrypt issues for it on the first switch, the same way
  it did for salsa.

Order (corrected by the final review): one nixos-config switch carries the
second host, the three variables and `ORIGIN`'s removal, then the app deploy.
Never `DANCE_HOSTS` with `ORIGIN` still set: `ORIGIN` makes every request look
like salsa's host, and the new code would redirect `/bachata/…` to the bachata
host forever. The old code ignores `DANCE_HOSTS` and builds its CSRF origin
from `Host` once `ORIGIN` is gone, so it keeps working until the deploy.

## Docs to update in the same work

- CLAUDE.md: the wall paragraph (the account has a dance; the host),
  `lastDance` mentions, the flat routes, the admin, `PUBLIC_PATHS` notes.
- `docs/superpowers/specs/2026-11-02-accounts-design.md`: a pointer to this
  spec where it describes one account for both dances.
- `docs/deployment.md`: two hosts, the env, the rollout.
- `PAGE_EPOCH`: raise it if an older open page would send something the server
  now refuses (a removed `dance` field, a moved action).

## Left to the builder

- How dev reaches both dances (a query, two `*.localhost` names in
  `DANCE_HOSTS`, or both).
- The exact helper names and where `hostDance` lives (pure, client-safe if a
  component needs it).
- Whether `splitAccounts` takes a `CloneFiles` or its own link function.
- The order of plan steps, keeping `npm run check` green after each.

## Execution

The user asked for this to be built natively: one session works the plan
itself, task by task (superpowers:executing-plans), not a fresh subagent per
task. No deploy, release or nixos-config switch without the user's go.
