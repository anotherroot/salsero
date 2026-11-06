# Dance Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (the user chose native execution: one session, no subagent per task, one review at the end). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every account belongs to one dance. `salsa.anotherroot.eu` serves salsa only and `bachata.anotherroot.eu` bachata only. One backend and one database serve both.

**Architecture:** Add `users.dance` and `invites.dance`, and make email unique per dance. A boot step splits existing accounts: the user's bachata half becomes a new account. The wall is "the account's dance = the route's dance", enforced in `wallOf` and in the flat routes that take a dance from input. The host only chooses the login, the redirects and `/`, through a pure `DANCE_HOSTS` map.

**Tech Stack:** SvelteKit (adapter-node), Drizzle + better-sqlite3, vitest, Kotlin/Gradle for the app.

**Spec:** `docs/superpowers/specs/2026-11-06-dance-split-design.md`

## Global Constraints

- No CHECK on an existing table. Additive `ADD COLUMN`, and index drop/create only. Read the generated SQL before committing.
- Data functions take `db` first. Specs never touch `$DATA_DIR`. Use `openDb(':memory:')`, and fake `CloneFiles` (`NO_FILES` in `test-walls.ts`).
- A refused cross-dance request gets the same 404 a stranger gets. Login refuses with exactly `Incorrect email or password.`
- No look changes. Removing the other dance's parts is allowed. Anything that would look different needs real screenshots and 2–4 options on the user's phone first (spec, Non-goals).
- `npm run check` (inside `nix develop`) passes at the end of every task. Commit after each task, with the session's attribution lines.
- No deploy, app release, nixos-config switch or production database write without the user's explicit go (Task 9 stops at each).
- Bachata app version: **1.6 (versionCode 7)**. 1.5 (6) is already out.

## Review Focus

1. A salsa account fetches a bachata file by a flat URL (`/recordings/<file>`, `/audio/<file>`). Expect 404. Already owner-checked; pinned by a test in Task 4.
2. A salsa account POSTs `/api/songs` with `dance=bachata`. Expect 404, and no row written (Task 4).
3. The salsa admin POSTs a storage limit, group limit or request resolution for a bachata account or group id. Expect `fail(404)`, nothing changed (Task 6).
4. The boot split runs twice (a restart, or a crash mid-way). Expect no second bachata account, no duplicated takes, and `danceIntegrity` empty (Task 3).
5. A salsa-only email with the right salsa password, tried on the bachata host. Expect `Incorrect email or password.` And Join with an email that exists only in the other dance succeeds (Task 5).

---

### Task 1: Hosts, a pure map

**Files:**
- Create: `src/lib/dances/hosts.ts`
- Test: `src/lib/dances/hosts.spec.ts`

**Interfaces:**
- Produces:
  - `type DanceHosts = ReadonlyMap<string, DanceSlug>` (host → dance, lower-case host, no port).
  - `parseDanceHosts(raw: string | undefined): DanceHosts`: comma-separated `host=dance`. Entries with an unknown dance or empty host are dropped.
  - `hostDance(hosts: DanceHosts, host: string): DanceSlug | null`: strips a port, case-insensitive.
  - `hostOf(hosts: DanceHosts, dance: DanceSlug): string | null`: the first host mapped to it.
  - `requestDance(i: { userDance: DanceSlug | null; hostDance: DanceSlug | null; path: string; next: string | null; query: string | null }): DanceSlug`. Precedence: userDance → hostDance → `danceInPath(path)` → `danceInPath(next)` → `query` if a dance slug → `DEFAULT_DANCE`.

- [ ] **Step 1: Write the failing tests** in `hosts.spec.ts`:
  - `parseDanceHosts('salsa.anotherroot.eu=salsa, bachata.anotherroot.eu=bachata')`: size 2. `hostDance(m, 'Bachata.AnotherRoot.eu:443') === 'bachata'`. `hostDance(m, 'wt-1-x.salsa.localhost') === null`.
  - `parseDanceHosts('x=tango,=salsa,')`: size 0. `parseDanceHosts(undefined)`: size 0.
  - `hostOf(m, 'bachata') === 'bachata.anotherroot.eu'`. `hostOf(new Map(), 'salsa') === null`.
  - `requestDance`:
    - userDance `'bachata'` wins over hostDance `'salsa'`.
    - With no user, the host wins over a `/bachata/...` path.
    - With no user and no host: path `/bachata/moves` → bachata, `next` `/bachata` → bachata, query `bachata` → bachata, query `tango` → `'salsa'`.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/dances/hosts.spec.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `hosts.ts`. It is client-safe: no `$env`, no server imports. `danceInPath` already exists in `dances.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dances): the host map, which host serves which dance`.

### Task 2: The account has a dance (schema, session, locals)

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`users.dance`, `invites.dance`; replace `.unique()` on email with `uniqueIndex('users_dance_email_idx').on(t.dance, t.email)`, turning `users` into the `(cols, (t) => [...])` form)
- Create: `drizzle/0032_*.sql` (generated: `npm run db:generate`)
- Modify: `src/lib/server/auth.ts` (`validateSession` selects `users.dance`; returns null when it is not a dance slug)
- Modify: `src/app.d.ts` (`Locals.user.dance: DanceSlug`)
- Modify: `src/hooks.server.ts` (`locals.user.dance`), `src/lib/server/request-user.ts` (`apiDeviceUser` returns `dance` the same way)
- Test: `src/lib/server/auth.spec.ts` (or the existing session spec; find with `grep -rln validateSession src`)

**Interfaces:**
- Produces: `locals.user.dance: DanceSlug` everywhere a user is signed in. The schema `users.dance: text('dance')` is nullable. The data functions keep it whole.

- [ ] **Step 1: Write the failing test.** Insert a user with `dance: 'bachata'` and create a session. Expect `validateSession(id)?.dance === 'bachata'`. A user with `dance: null` gives `validateSession(id) === null`. Do the same for `apiDeviceUser` with a device token.
- [ ] **Step 2: Run** it. Expected: FAIL (`dance` undefined).
- [ ] **Step 3: Edit the schema.** Run `nix develop -c npm run db:generate`. **Read the SQL.** It must be only `ALTER TABLE users ADD dance`, `ALTER TABLE invites ADD dance`, `DROP INDEX users_email_unique`, `CREATE UNIQUE INDEX users_dance_email_idx`. A table rebuild means stop and rethink.
- [ ] **Step 4: Implement** the session, device user and locals changes. Run `nix develop -c npx svelte-check` and fix every spec that builds a fake `locals.user` without `dance`. Give it the dance its params use. A spec that used one user in both dances (`dance-wall.spec.ts`, `owner-wall` specs) gets a second user id for the bachata side. Those specs prove the data-layer wall, which still holds.
- [ ] **Step 5: Run** the new test and `nix develop -c npx vitest run`. Expected: PASS. (Task 4 adds the route wall.)
- [ ] **Step 6: Commit** `feat(accounts): an account belongs to a dance (migration 0032)`.

### Task 3: Splitting existing accounts at boot, and the dance integrity check

**Files:**
- Create: `src/lib/server/dance-split.ts`
- Test: `src/lib/server/dance-split.spec.ts`
- Modify: `src/lib/server/clones/files.ts` (add kind `'count'` → `countDir()` and the count take file pattern; the uploads write `<uuid>.wav`, so reuse or add a `COUNT_FILE_RE` in `files.ts`)
- Modify: `src/lib/server/integrity.ts` (`danceIntegrity`), `src/lib/server/db/bootstrap.ts` (order), `src/lib/server/admin.ts` (`seedAdmin` per dance)

**Interfaces:**
- Consumes: `CloneFiles` (`link(kind, file) → new name`, `unlink`).
- Produces:
  - `splitAccounts(db: Db, files: CloneFiles, now: number): Promise<{ assigned: number; split: number }>`
  - `danceIntegrity(db: Db): string[]`: one line per row whose owning account's dance ≠ the row's dance. It covers the seven root tables, plus `team_members`, `lesson_adds`, `count_takes` (none should exist after the split, so a take of an account with NULL dance is a line), `device_tokens`/`sessions` of an account with NULL dance, and `storage_requests` with a team of another dance.
  - `seedAdmin(db, email, password)`: the same signature. It now creates an admin with `dance` set for each dance in `DANCE_SLUGS` that has no account.

Rules: the spec, "Splitting existing accounts". The bachata account copies every `users` column except `id`, `dance` and `created_at`. The move table is in the spec. Re-check `schema.ts` for person columns while writing it. As of this plan that includes `lesson_comments.author_id`/`deleted_by` and `lesson_comment_hearts.user_id`, which move where the lesson is bachata's. One synchronous transaction per person. Link the takes' files first, outside the transaction. If it throws, unlink them.

- [ ] **Step 1: Write the failing tests** in `dance-split.spec.ts`, with `openDb(':memory:')` and a fake `CloneFiles` that records links:
  - `one dance`: u2 owns only bachata figures, so `users.dance` becomes `'bachata'`. `{ assigned: 1, split: 0 }`.
  - `nothing`: an account with no rows becomes `'salsa'`.
  - `both`: u1 owns a salsa figure and a bachata figure. It also has a bachata team membership with a lesson add, an open and a comment, a `Bachata app` and an `Android app` device token, two count takes and a bachata `default_styles` row. Afterwards:
    - u1 is salsa and keeps the salsa figure, the `Android app` token and its takes.
    - A new user with the same email, `password_hash`, names and `is_admin` is bachata. It has the bachata figure, the membership, the add, the open, the comment, the `Bachata app` token, the bachata style, and two takes whose `file` is the fake's linked names.
    - `danceIntegrity(db)`, `ownerIntegrity(db)` and `crossRefs(db)` are all `[]`.
  - `idempotent`: running `splitAccounts` a second time gives `{ assigned: 0, split: 0 }`, two users, and the take count unchanged.
  - `seedAdmin`: on an empty db it makes two admins (salsa, bachata) with the same email. After a split that left both dances with accounts, it makes none.
- [ ] **Step 2: Run** `nix develop -c npx vitest run src/lib/server/dance-split.spec.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `splitAccounts`, `danceIntegrity`, the `'count'` kind and `seedAdmin` per dance.
- [ ] **Step 4: Wire the boot.** In `bootstrap()`, run `splitAccounts(getDb(), realCloneFiles(), Date.now())` first, then `seedAdmin`, then the rest as now. Log `[accounts] dances assigned: N, split: M`. Add `dances: danceIntegrity` to `checkIntegrity`'s checks.
- [ ] **Step 5: Run** the spec and the full `nix develop -c npx vitest run`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(accounts): split accounts that hold both dances, at boot`.

### Task 4: The wall: the account's dance is the route's dance

**Files:**
- Modify: `src/lib/server/scope.ts` (`wallOf`: `404 'Not found'` when `danceOf(params) !== locals.user.dance`. Also check every other `require*` that builds a wall from `params` and goes through `wallOf`/`danceOf`; any that does not must get the same check.)
- Modify: `src/routes/api/songs/+server.ts` (the upload's `dance` must be `locals.user.dance`, else 404)
- Modify: `src/routes/settings/+page.server.ts` (the `style` action uses `locals.user.dance` and ignores the form's `dance`)
- Audit: every flat route and action that reads a dance from a param, form, query or body: `grep -rn "isDanceSlug\|get('dance')\|\.dance\b" src/routes --include=*.ts | grep -v "\[dance\]"`. Each takes `locals.user.dance` or a row it owns.
- Test: `src/routes/[dance]/dance-wall.spec.ts` (extend), `src/routes/api/owner-wall.spec.ts` (extend)

**Interfaces:**
- Consumes: `locals.user.dance` (Task 2).

- [ ] **Step 1: Write the failing tests.**
  - `dance-wall.spec.ts`: a salsa user loading any `/[dance]` page load with `params.dance = 'bachata'` gets status 404. Use the existing load helper, and cover Today and Moves at least.
  - `owner-wall.spec.ts`: a salsa user POSTing to `/api/songs` with `dance=bachata` gets 404 and no `songs` row. A salsa user GETting `/recordings/<a bachata account's file>` gets 404 (Review Focus 1, 2).
  - `settings-forms.spec.ts`: the `style` action with form `dance=bachata` by a salsa user sets salsa's default style or fails. It never writes a bachata row.
- [ ] **Step 2: Run** those three specs. Expected: the new cases FAIL.
- [ ] **Step 3: Implement** `wallOf`, the songs check, the settings action and anything the audit finds.
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(accounts): an account reaches only its own dance`.

### Task 5: The host: redirects, `/`, login, Join, group links, pairing, Get the app

**Files:**
- Create: `src/lib/server/hosts.ts`: `danceHosts(): DanceHosts`. It parses `env.DANCE_HOSTS` once (`$env/dynamic/private`).
- Modify: `src/hooks.server.ts`. On a mapped host (`hostDance(...) !== null`), after the user is resolved and before the auth redirect, for paths outside `/api/worker/`, `/api/app-update/`, `/releases/`, `/health`, `/_app/`:
  - (a) If the path's dance (`danceInPath`) is not the host's, a GET or HEAD gets a 303 to `https://${hostOf(other)}${path}${search}`. Anything else, or no host mapped for that dance, gets a 404.
  - (b) If the user is signed in and `user.dance` is not the host's dance, the same: 303 to the account's host, else 404.
- Modify: `src/routes/+layout.server.ts`. Replace `lastDance` with `appDance = requestDance({ userDance: locals.user?.dance ?? null, hostDance, path: url.pathname, next: url.searchParams.get('next'), query: url.searchParams.get('dance') })`. Rename every reader (`grep -rn lastDance src`: `+error.svelte`, `+layout.svelte`, `admin`, `settings`, `device/pair`, `login`, `welcome`, `welcome/start`, `join`).
- Delete the `DANCE_COOKIE` writes and reads: `[dance]/+layout.server.ts`, `+page.server.ts`, `+layout.server.ts`, and the constant in `dances.ts` if nothing else uses it. `/` redirects to `/${appDance}`.
- Modify: `src/lib/server/auth.ts` (rate-limit keys `user:<dance>:<email>`; the three functions take `dance`), `src/routes/login/+page.server.ts` (look up by `(appDance, email)`; `adminFirstName(db, dance)`)
- Modify: `src/lib/server/invites.ts` (`createInvite(db, …, dance)`; `inviteValid` and `redeemInvite` take the request's dance and treat an invite of another dance as dead; the email-taken check is per dance; the new user gets `dance`), `src/routes/join/+page.server.ts`
- Modify: `src/lib/server/teams.ts` (`adminFirstName(db, dance)`), `src/routes/g/[code]/+page.server.ts` (a team whose dance is not `locals.user.dance` is the same 404 `STALE`)
- Modify: `src/routes/device/pair/+page.server.ts` (the label comes from `locals.user.dance`)
- Modify: `src/routes/app/+page.server.ts` (only `appDance`'s release; `getAppCards` gets a one-entry record, or a `dance` argument, whichever keeps `get-app.ts` simplest)
- Test: `src/lib/server/hosts-hook.spec.ts` (new, with the hook's decision as a pure function, below), `src/routes/login/login.spec.ts`, `src/routes/join/join.spec.ts`, `src/lib/server/invites.spec.ts`, `src/routes/app/get-app.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`DanceHosts`, `hostDance`, `hostOf`, `requestDance`), Task 2.
- Produces: `hostRedirect(i: { hosts: DanceHosts; host: string; path: string; search: string; method: string; userDance: DanceSlug | null }): { kind: 'pass' } | { kind: 'redirect'; to: string } | { kind: 'missing' }`, in `src/lib/dances/hosts.ts` (pure). The hook calls it. `appDance` in the root layout data.

- [ ] **Step 1: Write the failing tests.**
  - `hostRedirect`:
    - On `bachata.anotherroot.eu`: GET `/salsa/moves?x=1` → redirect to `https://salsa.anotherroot.eu/salsa/moves?x=1`. POST to it → missing.
    - GET `/bachata/moves` with userDance `'salsa'` → redirect to `https://salsa.anotherroot.eu/bachata/moves`. The salsa host then 404s it through the wall, which is right.
    - `/api/worker/songs` → pass. `/releases/bachata/7.apk` on the salsa host → pass.
    - An unmapped host → pass, always.
  - login: two accounts with the same email (salsa `pw-salsa`, bachata `pw-bachata`). With `appDance` bachata, `pw-salsa` fails with `Incorrect email or password.` and `pw-bachata` signs in to the bachata account (Review Focus 5).
  - Join: a bachata invite on a salsa request is dead (`INVITE_REFUSAL`). An email that exists only in salsa redeems a bachata invite into a new bachata account.
  - `/g/<code>` of a bachata team for a salsa user gives 404.
  - Get the app on bachata shows one card, bachata's.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, in this order: `hostRedirect`, the hook, `appDance` and the rename, the cookie removal, auth/login, invites/Join, `/g`, pair, Get the app. The admin's invite creation passes `locals.user.dance` (the admin page action).
- [ ] **Step 4: Dev check.** `DANCE_HOSTS` is unset in dev, so `/login?dance=bachata` signs in to bachata, and `/` goes to the signed-in account's dance. Run `npm run dev` and load `/login?dance=bachata` and `/login` (both 200).
- [ ] **Step 5: Run** the full suite. Expected: PASS.
- [ ] **Step 6: Commit** `feat(accounts): the host decides the dance; login, Join and links per dance`.

### Task 6: The admin per dance

**Files:**
- Modify: `src/lib/server/storage.ts`. `listPeople(db, dance)`, `listOpenRequests(db, dance)` (a request's dance is its team's if `team_id` is set, else its user's) and `listTeamsForAdmin(db, dance)` filter by dance. `setStorageLimit`, `setGroupLimit`, `resolveRequest` and `setTeamLimit` take `dance` and change nothing, returning false, when the target is of another dance. `limitsTotal` stays global. *Plan's call:* it sits beside `freeDisk`, which is the one shared disk.
- Modify: `src/routes/admin/+page.server.ts` and `+page.svelte` (`dance = locals.user.dance`; drop the per-dance `groupsMade` record for one `groupsMade: teamsMade(db, p.id, dance)` number; the actions pass the dance and `fail(404)` on false)
- Test: `src/routes/admin/admin-page.spec.ts`, `src/routes/admin/admin-columns.spec.ts`, `src/lib/server/storage.spec.ts`

- [ ] **Step 1: Write the failing tests.** The salsa admin's load lists salsa people only. The salsa admin's `limit` action on a bachata user id is `fail(404)` and the limit is unchanged. The same holds for `groupLimit`, `teamLimit` and `resolve` (Review Focus 3).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The groups-made cell shows one number. That is a removal, so no designs are needed. If it would need a new layout, stop: designs first.
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): the admin sees and changes only their dance`.

### Task 7: Bachata app 1.6 on its own host

**Files:**
- Modify: `android/app/build.gradle.kts`. `versionCode = 7`, `versionName = "1.6"`. Move `SITE` from `defaultConfig` into each dance flavor: salsa defaults to `https://salsa.anotherroot.eu`, bachata to `https://bachata.anotherroot.eu`. `-Psite=` still overrides both.
- Check: Kotlin that builds URLs from `BuildConfig.SITE` and `BuildConfig.DANCE`: `grep -rn "SITE" android/app/src`. `WebShell.navigationFor` must treat its own `SITE` host as inside. Nothing else should need a change. If a JVM test pins a host, update it.

- [ ] **Step 1:** Edit Gradle.
- [ ] **Step 2: Run** `nix develop .#android -c ./android/gradlew -p android test assembleDebug`. Expected: BUILD SUCCESSFUL. `BuildConfig.SITE` in `android/app/build/generated/source/buildConfig/bachataDirect/debug/**/BuildConfig.java` is the bachata host.
- [ ] **Step 3: Commit** `chore(android): version 1.6 (7), bachata on bachata.anotherroot.eu`.

### Task 8: Docs and the whole check

**Files:**
- Modify: `CLAUDE.md`:
  - The wall paragraph: the account has a dance, and the route wall is `wallOf`.
  - The host map (`src/lib/dances/hosts.ts`, `DANCE_HOSTS`).
  - The layout lines for `lastDance` → `appDance`.
  - The admin and invites lines.
  - `dance-split.ts` and `danceIntegrity` in the layout list.
- Modify: `docs/superpowers/specs/2026-11-02-accounts-design.md` (a short pointer at the top to the dance-split spec), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (where it says one account holds both dances, if it does: `grep -n "both dances" `)
- Modify: `docs/deployment.md`:
  - Two hosts.
  - The env: no `ORIGIN`; `DANCE_HOSTS`, `PROTOCOL_HEADER=x-forwarded-proto`, `HOST_HEADER=host`.
  - The nixos-config vhost.
  - The rollout from Task 9.
- Decide `PAGE_EPOCH`:
  - Raise it if any form or API an old open page sends is now refused.
  - Login and Join now send a dance, from the page rather than the form, so old pages still work.
  - The settings `style` form's `dance` is ignored rather than refused.
  - Write the decision in the commit message.

- [ ] **Step 1:** Edit the docs.
- [ ] **Step 2: Run** `nix develop -c npm run check`. Expected: exit 0.
- [ ] **Step 3: Commit** `docs: the dance split`.

### Task 9: Production rehearsal and rollout (stops for the user at every write)

**Files:**
- Create: `scripts/dance-split/delete-1d8846.sql` (the one account's delete, every person column from Task 3's list, inside `BEGIN; … COMMIT;`)
- Create: the nixos-config change as a diff in the scratchpad. It is not committed there or switched.

- [ ] **Step 1: Rehearse the delete.** Copy `~/Backups/salsa/db/salsa-2026-11-06.db` (or newer) to the scratchpad. Record per-table row counts of every other user. Run the delete SQL with `nix shell nixpkgs#sqlite -c sqlite3`. Then check:
  - The user is gone, and so are all their rows.
  - Every other user's counts are identical.
  - `PRAGMA foreign_key_check` is empty.
- [ ] **Step 2: Rehearse the split on that copy.**
  - Build with `npm run build`.
  - Run `node build` with `DATABASE_PATH` set to the copy, `DATA_DIR` set to a scratch dir holding the count takes (empty files with the right names are enough), `DANCE_HOSTS=salsa.localtest=salsa,bachata.localtest=bachata`, `PROTOCOL_HEADER=x-forwarded-proto`, `HOST_HEADER=host`, and `PORT`.
  - Check the boot log: `split: 1`, and every integrity count `0`.
  - Query: the user has two accounts, the bachata one holds all the bachata rows, and `a0a732…`/`24dd98…` have their single dance.
  - CSRF: `curl -X POST -H 'Host: bachata.localtest' -H 'X-Forwarded-Proto: https' -H 'Origin: https://bachata.localtest'` on `/login` gives a 400 form failure, not a 403. With `Origin: https://salsa.localtest` it gives 403.
- [ ] **Step 3: Prepare nixos-config.** Draft the change from the spec ("Outside this repo"): the second vhost via a shared `let` value, the env lines, the `svc-salsa` VM check. Run `nixos-rebuild build --flake .#my-hetzner-vm`, plus the VM check. Leave the change uncommitted and show the diff.
- [ ] **Step 4: STOP and ask the user** for each, in this order, showing what will run:
  1. Merge `dance-split` to master (local merge; no PR).
  2. Delete `1d8846…`: `ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'`, stop `salsa`, run the SQL with the box's `sqlite3`, start `salsa`.
  3. The nixos-config switch: the vhost plus the env with `ORIGIN` still set. Diff the closures first (memory: the box may run another branch).
  4. `./scripts/deploy.sh prod`. Watch the boot log for `split: 1` and integrity `0`.
  5. Remove `ORIGIN` from the secret and switch again.
  6. Check that `https://bachata.anotherroot.eu/login` loads and the user can sign in to bachata.
  7. Release bachata 1.6 (`scripts/release.sh`, direct channel). The user installs it from `bachata.anotherroot.eu/app`.
- [ ] **Step 5:** Tell the user to send `a0a732…` the new address, and that `1d8846…` needs a new bachata invite.
