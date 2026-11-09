# AI connector, plan 1: the connector and reading

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo a slot builds **natively** (CLAUDE.md "Building in a slot"): per task only its specs + eslint/prettier on changed files; the full `npm run check` before the final review and again after merging master.

**Goal:** Any AI app (Claude, ChatGPT, …) can be connected to a salsa or bachata account as an MCP connector, and reads that person's moves, figures, routines, drills, lessons, positions and groups. Nothing is written yet (plan 2 is the queue).

**Architecture:** A copy of the sister projects' connector (`~/Projects/homestash`, itself a copy of `~/Projects/muscle_model`): a hand-written stateless JSON-only MCP endpoint at `/mcp`, OAuth 2.1 + PKCE with its own tables, a consent page. Two changes from the sisters: clients from any origin (Client ID Metadata Documents fetched with an SSRF guard, plus RFC 7591 registration), and the read tools are built on `syncScope` — the same set of rows the person's phone may hold — so the connector reads exactly what the person may read, by construction.

**Tech Stack:** SvelteKit 2.70 (adapter-node), better-sqlite3 + Drizzle (synchronous), Vitest, `@modelcontextprotocol/sdk` ^1.31.0 as a **devDependency only**.

**Spec:** `docs/superpowers/specs/2026-11-09-ai-connector-design.md` (sections "The connector", "Read tools", "Phases" 1).

**Read-only references (never edit):** `~/Projects/homestash/src/lib/mcp/{protocol,http}.ts` and specs, `src/lib/mcp/sdk-compat.spec.ts`, `src/lib/server/oauth/*`, `src/lib/server/csrf.ts`, `src/routes/{mcp,oauth,.well-known}/**`, `src/lib/server/mcp/{host,modules,args}.ts`; plan `docs/superpowers/plans/2026-11-08-phase-3a-claude-connector.md` (rulings C1–C13). "Copy" below means: copy that file, then apply the listed changes; keep its comments where still true.

## Global Constraints

- Every server time is `serverNow()` (integer epoch ms); no `Date.now()`/`new Date()` in server code (`server-clock.spec.ts`). Every instant in the db is integer epoch ms.
- Every integer-id table: `mintedId('<table>')`, an `AFTER INSERT … _id_mark` trigger appended to its migration (as `drizzle/0040_dark_power_pack.sql` does), and its name in `ID_TABLES` (`src/lib/server/db/ids.spec.ts`).
- Every new table is classified in `src/lib/sync/tables.ts`: all four OAuth tables go in `NEVER_SYNCED`.
- Every new GET endpoint goes in `src/lib/offline/routes.ts` `NETWORK_ENDPOINTS`; the consent page in `NETWORK_PAGES`.
- Data functions take `db` first; specs use `openDb(':memory:')`; a spec never touches `$DATA_DIR`.
- Secrets stored only as SHA-256 hex; prefixes `sa_code_`, `sa_at_`, `sa_rt_`; 32 random bytes base64url after the prefix.
- Lifetimes: access token 1 h, refresh token 30 days, code 60 s; refresh rotates; a spent refresh token shown again within 30 s is refused, after 30 s it revokes the grant; a code used twice revokes its grant.
- One OAuth scope: `salsa` (and `offline_access` accepted and ignored).
- Words people read go through `t()` in `en` and `sl` (vikanje, » «); every server refusal too (`refusals-guard.spec.ts`). MCP `instructions`, tool titles/descriptions, tool results and OAuth JSON errors are for machines: English, no `t()`.
- User content in tool results is never translated.
- An account belongs to one dance: a connection reads that account's dance only; on a dance host, a grant whose user is of the other dance gets 401 at `/mcp`.

## Review Focus

1. **SSRF through `client_id`.** A client id like `https://127.0.0.1/x`, `https://[::1]/`, `https://10.0.0.5/`, `https://169.254.169.254/`, or a public name that resolves to a private address, or a URL that redirects → refused before any byte is sent to that address (Task 3).
2. **Encoded paths.** `/m%63p`, `/oauth%2Ftoken`, `/%2Emcp` → routed and judged by the decoded path: no session cookie ever reaches `/mcp`, and the CSRF exemption holds only for the real `/oauth/token` (Task 5).
3. **The other dance.** A bachata session approving on the salsa host, or a bachata user's token used on the salsa host → refused, never a connection that reads the wrong dance (Tasks 6, 7).
4. **Consent tampering.** Parameters changed between the consent page's GET and its POST, a POST signed in as someone else, or the page framed → re-validated on POST, `as` must equal the session user, frame-deny headers (Task 6).
5. **Reading past the wall.** An id of another person's figure, of a group draft a plain member cannot see, of another dance's row, or a missing id → the same "not found" text (Task 9).

---

### Task 1: The OAuth tables

**Files:**
- Modify: `src/lib/server/db/schema.ts` (append four tables after `deviceTokens`' neighbours, with a doc comment pointing at the spec)
- Create: `drizzle/0043_*.sql` (generated) + appended triggers
- Modify: `src/lib/sync/tables.ts` (`NEVER_SYNCED`), `src/lib/server/db/ids.spec.ts` (`ID_TABLES`)

**Interfaces — Produces** (Drizzle names → SQL names):
- `oauthClients` / `oauth_clients`: `id mintedId`, `clientId text unique not null` (`client_id`), `clientName text` (nullable), `redirectUris text not null` (JSON array), `createdAt`. Rows made by registration only.
- `oauthGrants` / `oauth_grants`: `id mintedId`, `userId text not null → users.id on delete cascade`, `clientId text not null`, `clientName text`, `redirectUri text not null`, `createdAt`, `lastUsedAt integer`, `revokedAt integer`; index on `user_id`.
- `oauthCodes` / `oauth_codes`: `hash text primary key`, `grantId integer not null → oauth_grants.id on delete cascade`, `codeChallenge text not null`, `redirectUri text not null`, `expiresAt integer not null`, `usedAt integer`.
- `oauthTokens` / `oauth_tokens`: `hash text primary key`, `grantId integer not null → oauth_grants.id on delete cascade`, `kind text not null` with CHECK `kind in ('access','refresh')` (a NEW table may have a CHECK), `expiresAt integer not null`, `replacedAt integer`; index on `grant_id`.

- [ ] **Step 1:** Add `'oauth_clients', 'oauth_grants'` to `ID_TABLES` and the four names to `NEVER_SYNCED`. Run `npx vitest run src/lib/server/db/ids.spec.ts src/lib/sync/tables.spec.ts` — Expected: FAIL (tables missing).
- [ ] **Step 2:** Add the tables to `schema.ts`; `npm run db:generate`; append to the generated SQL, after a `--> statement-breakpoint`, the two `oauth_clients_id_mark` / `oauth_grants_id_mark` triggers in the 0040 shape. Read the generated SQL: only `CREATE TABLE`/`CREATE INDEX` for the new tables.
- [ ] **Step 3:** Run the two specs plus `npx vitest run src/lib/server/sync src/lib/server/db` — Expected: PASS.
- [ ] **Step 4:** Commit `feat(ai-connector): OAuth tables`.

### Task 2: The pure OAuth pieces

**Files:**
- Create (copy from homestash `src/lib/server/oauth/`): `src/lib/server/oauth/pkce.ts`, `secrets.ts`, `redirect.ts`, `metadata.ts`, each with its spec.

**Interfaces — Produces:**
- `verifyS256(verifier: string, challenge: string): boolean`
- `newSecret(prefix: 'sa_code_' | 'sa_at_' | 'sa_rt_'): string`, `hashSecret(s: string): string`
- `isLoopback(u: URL): boolean`, `redirectAllowed(asked: string, registered: readonly string[]): boolean` (exact match; a loopback URI may differ in port only)
- `SCOPE = 'salsa'`; `authorizationServerMetadata(origin: string)`, `protectedResourceMetadata(origin: string)`, `wwwAuthenticate(origin: string): string`

Changes from homestash: prefixes; `metadata.ts` also advertises `registration_endpoint: <origin>/oauth/register` and keeps `client_id_metadata_document_supported: true`, `token_endpoint_auth_methods_supported: ['none']`, `code_challenge_methods_supported: ['S256']`, `grant_types_supported: ['authorization_code','refresh_token']`, `scopes_supported: ['salsa','offline_access']`, `authorization_response_iss_parameter_supported: true`, `resource: <origin>/mcp`.

- [ ] **Step 1:** Copy the four specs, renaming prefixes/scope; add to `metadata.spec.ts`: `expect(authorizationServerMetadata('https://salsa.anotherroot.eu').registration_endpoint).toBe('https://salsa.anotherroot.eu/oauth/register')`. Run `npx vitest run src/lib/server/oauth` — FAIL.
- [ ] **Step 2:** Copy the four modules with the changes. Use `node:crypto` only.
- [ ] **Step 3:** Run — PASS. eslint + prettier on the files. Commit `feat(ai-connector): PKCE, secrets, redirects, discovery`.

### Task 3: Which clients: any origin, fetched safely, or registered

**Files:**
- Create: `src/lib/server/oauth/client.ts` (+spec) — copy homestash, widen
- Create: `src/lib/server/oauth/safe-fetch.ts` (+spec) — new
- Create: `src/lib/server/oauth/fetch-client.ts` — copy homestash, fetch through `safe-fetch`
- Create: `src/lib/server/oauth/register.ts` (+spec) — new, RFC 7591

**Interfaces — Produces:**
- `clientIdIsUrl(clientId: string, devLoopback: boolean): boolean` — an `https:` URL with a path, no userinfo, no fragment; `http:` only when `devLoopback` and the URL is loopback.
- `parseClientDocument(clientId, json)` — homestash's, unchanged (client_name ≤ 100, `token_endpoint_auth_method` absent or `none`).
- `isPublicAddress(ip: string): boolean` — false for IPv4 `0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4` and IPv6 `::, ::1, fc00::/7, fe80::/10, ff00::/8, ::ffff:<private v4>, 64:ff9b::/96 <private v4>`.
- `safeFetchJson(url: string, opts: { timeoutMs: 3000; maxBytes: 65536; allowLoopback: boolean }): Promise<{ ok: true; json: unknown } | { ok: false; reason: string }>` — `node:https` request whose `lookup` resolves with `dns.lookup(host, { all: true })` and refuses unless **every** address passes `isPublicAddress` (so the address checked is the one connected to); no redirects (a 3xx is a refusal); body capped; `accept: application/json`.
- `fetchClientDocument(clientId, allowLoopback)` — cached 1 h per client id (homestash's cache), via `safeFetchJson`.
- `registerClient(db: Db, body: unknown, now: number): { ok: true; response: object } | { ok: false; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string }` — `redirect_uris` 1–10 strings, each `https:` (or loopback `http:`), no fragment, ≤ 2000 chars; `token_endpoint_auth_method` absent or `none`; `grant_types` ⊆ the two supported; `client_name` trimmed ≤ 100 else null. Mints `client_id = 'sa_client_' + 32 hex`. Response per RFC 7591: `client_id`, `client_id_issued_at` (seconds), `client_name`, `redirect_uris`, `token_endpoint_auth_method: 'none'`, `grant_types`, `response_types: ['code']`.
- `resolveClient(db: Db, clientId: string, allowLoopback: boolean): Promise<{ ok: true; doc: ClientDocument; host: string } | { ok: false; reason: string }>` — a `sa_client_` id reads `oauth_clients`; otherwise `clientIdIsUrl` → `fetchClientDocument`. `host` is what the consent page shows first: the client id's host, or for a registered client the host of its first redirect URI.

- [ ] **Step 1: tests.** `client.spec.ts`: `clientIdIsUrl('https://chatgpt.com/client.json', false)` true; `'https://claude.ai/oauth/claude-code-client-metadata'` true; `'http://example.com/x'` false; `'https://u:p@example.com/x'` false; `'https://example.com/x#a'` false; `'http://127.0.0.1:5173/c'` true only with `devLoopback`. `safe-fetch.spec.ts`: `isPublicAddress` table for every range above (both sides of each edge, e.g. `172.15.255.255` true, `172.16.0.1` false, `::ffff:10.0.0.1` false, `2606:4700::1` true); `safeFetchJson('https://localhost/x', …)` resolves `{ ok: false }` without a request (inject `lookup` to assert it was asked and refused). `register.spec.ts`: a valid body stores one row and returns `client_id` starting `sa_client_`; 11 URIs, a `http://example.com` URI, a fragment URI, `token_endpoint_auth_method: 'client_secret_basic'` each refused with the named error; `resolveClient(db, <minted id>)` returns its redirect URIs and host.
- [ ] **Step 2:** Run `npx vitest run src/lib/server/oauth` — FAIL.
- [ ] **Step 3:** Implement the four modules (`safe-fetch.ts` takes an optional `lookup` for the spec).
- [ ] **Step 4:** Run — PASS; eslint/prettier; commit `feat(ai-connector): clients from any origin, SSRF-guarded, and registration`.

### Task 4: The token store

**Files:**
- Create: `src/lib/server/oauth/store.ts` (+spec) — homestash's `store.ts` rewritten synchronous

**Interfaces — Consumes:** Task 1 tables, Task 2 `newSecret`/`hashSecret`/`verifyS256`/`SCOPE`.
**Produces** (all synchronous, `db` first, `now: number`):
- `approve(db, { userId, clientId, clientName, redirectUri, codeChallenge }, now): string` (the code; revokes an earlier live grant of that user to that client)
- `exchangeCode(db, { code, verifier, redirectUri, clientId }, now): TokenPair | OAuthFail`
- `refresh(db, { refreshToken, clientId }, now): TokenPair | OAuthFail`
- `verifyAccessToken(db, token: string | null, now): { grantId: number; userId: string } | null` (touches `last_used_at` at most once a minute)
- `revokeGrant(db, userId, grantId, now): boolean`, `restoreGrant(db, userId, grantId, now): boolean` (only a grant this user revoked within the last 60 s: the Settings toast's Undo)
- `listGrants(db, userId, now): GrantRow[]` with `GrantRow = { id: number; clientId: string; clientName: string | null; host: string; createdAt: number; lastUsedAt: number | null }` — add `GrantRow` to `src/lib/types.ts`. `host` is the client id's host when it is a URL, else the host of the grant's `redirect_uri` (a registered client), the same rule as `resolveClient`.
- `TokenPair`, `OAuthFail` as homestash. Each write is one `db.transaction`; a read that decides a write is inside it (better-sqlite3 transactions are serial).

- [ ] **Step 1:** Port homestash `store.spec.ts` case by case to synchronous calls on `openDb(':memory:')` with a user from `src/lib/server/test-walls.ts`; add: `restoreGrant` after 61 s returns false; `listGrants` hides a revoked grant and one whose refresh tokens are all spent or expired.
- [ ] **Step 2:** Run `npx vitest run src/lib/server/oauth/store.spec.ts` — FAIL.
- [ ] **Step 3:** Implement. Prune expired codes/tokens on each refresh (homestash's `pruneExpired`).
- [ ] **Step 4:** Run — PASS; eslint/prettier; commit `feat(ai-connector): the token store`.

### Task 5: The hook, CSRF, discovery, registration and token routes

**Files:**
- Create: `src/lib/server/self-authed.ts` (+spec): `decodedPath(raw: string): string | null` (null when `decodeURIComponent` throws), `isSelfAuthed(path: string): boolean` — `/mcp`, `/oauth/token`, `/oauth/register`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`.
- Create: `src/lib/server/csrf.ts` (+spec): copy homestash `csrf.ts`; the only exemptions `/oauth/token` and `/oauth/register`, judged on the decoded path.
- Modify: `vite.config.ts` — `sveltekit({ …, csrf: { trustedOrigins: ['*'] } })` with a comment: Kit's own check refuses the AI's token POST (no `Origin`); `csrf.ts` in the hook does it instead.
- Modify: `src/hooks.server.ts` — before anything reads a session: a decoded path that fails to decode → 400; `isSelfAuthed(path)` → `locals.user = null`, `locals.locale = 'en'`, skip `hostRedirect`, the epoch check and the login redirect, `return resolve(event)` (after the CSRF check). Every other request: the CSRF check from `csrf.ts`, then as today.
- Create: `src/routes/.well-known/oauth-authorization-server/+server.ts`, `.well-known/oauth-protected-resource/+server.ts`, `.well-known/oauth-protected-resource/mcp/+server.ts` (GET, JSON, `cache-control: no-store`, origin = `event.url.origin`).
- Create: `src/routes/oauth/register/+server.ts` (POST JSON → `registerClient`; 201; per-IP limit 20 registrations / hour → 429).
- Create: `src/routes/oauth/token/+server.ts` — copy homestash; form body; `grant_type` `authorization_code` | `refresh_token`; `Cache-Control: no-store`; failures limited per `getClientAddress()` 30 / 15 min → 429 (in-memory, `src/lib/server/oauth/limits.ts`).
- Modify: `src/lib/offline/routes.ts` — the three `/.well-known/oauth-*` paths in `NETWORK_ENDPOINTS`.
- Modify: `src/lib/offline/sw-route.ts` — `/mcp` and anything under `/oauth/` or `/.well-known/oauth-` → `'pass'` (+ case in `sw-route.spec.ts`).
- Create: `src/routes/oauth/oauth.spec.ts` (routes through their handlers, as `src/routes/[dance]/dance-wall.spec.ts` mocks `$lib/server/db`).

- [ ] **Step 1: tests.** `self-authed.spec.ts`: `isSelfAuthed(decodedPath('/m%63p')!)` true; `decodedPath('/%E0%A4%A')` null. `csrf.spec.ts` (homestash's, plus): a form POST to `/oauth/token` with no Origin passes; to `/oauth%2Ftoken` decoded → passes only if it decodes to `/oauth/token`; a form POST to `/salsa/figures` with Origin `https://evil.example` → 403; same-origin → passes. `oauth.spec.ts`: discovery JSON names `<origin>/oauth/register`; register → 201 then token exchange with a code from `approve` → 200 with `token_type: 'Bearer'`; a wrong verifier → 400 `invalid_grant` and the code is burnt; 31 failures from one IP → 429. `sw-route.spec.ts`: `/mcp` POST and `/oauth/authorize` GET navigate → `'pass'`.
- [ ] **Step 2:** Run those specs — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them plus `npx vitest run src/lib/offline src/routes/login src/hooks` — PASS (the login and other existing route specs prove the hook still guards everything else). eslint/prettier; commit `feat(ai-connector): discovery, registration, tokens; CSRF in the hook`.

### Task 6: The consent page

**Files:**
- Create: `src/routes/oauth/authorize/+page.server.ts`, `+page.svelte`, `authorize.spec.ts`
- Create: `src/lib/server/oauth/authorize.ts` (+spec) — copy homestash `authorize.ts` (parameter checks), async only for `resolveClient`
- Modify: `src/lib/i18n/en/settings.ts` and `sl/settings.ts` — a `connector` block (words below); `src/lib/offline/routes.ts` — `'/oauth/authorize'` in `NETWORK_PAGES`.

**Interfaces — Consumes:** `resolveClient` (Task 3), `approve` (Task 4), `redirectAllowed` (Task 2).
**Produces:** `checkAuthorize(params: URLSearchParams, client): AuthorizeOk | AuthorizeFail` — `response_type=code`, `code_challenge_method=S256`, a 43–128 char challenge, `redirect_uri` allowed for the client, `resource` (when sent) equal to `<origin>/mcp`, `state` passed through. Errors before the redirect URI is trusted render on the page; errors after it redirect with `error=` per RFC 6749 §4.1.2.1.

Behaviour: signed out → the hook's login redirect brings the person back (`next`). Signed in as the other dance's account on a dance host → the page says so (`t().settings.connector.otherDance`) with a Sign out link, no form. The page shows the client's host first, large, then its self-given name small ("calls itself …"), what it may do (read now; propose changes for your approval later — plan 2), and Approve / Cancel. Approve is a plain `<form method="POST" action="?/approve">` (one tap, no `use:enhance`, so the 303 to the external `redirect_uri` is a real navigation), with hidden fields for every parameter and `as=<user id>`. `load` and both actions set `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`. The POST re-runs `checkAuthorize` and `resolveClient` and refuses when `as` ≠ the session user. Approve → `approve(…)` → 303 `redirect_uri?code=…&state=…&iss=<origin>`. Cancel → 303 with `error=access_denied`.

Words (en / sl): title "Connect {host}?" / »Povežem {host}?«; `calls` "It calls itself {name}." / »Sama se imenuje {name}.«; `can` "It will read your moves, figures, routines, drills, lessons, positions and groups. Later it can suggest changes; nothing changes until you run them in the app." / »Brala bo vaše gibe, figure, kombinacije, drille, lekcije, položaje in skupine. Kasneje bo lahko predlagala spremembe; nič se ne spremeni, dokler jih ne izvedete v aplikaciji.«; `approve` "Connect" / »Poveži«; `cancel` "Cancel" / »Prekliči«; `otherDance` "This connector is for the {dance} app. Sign in there with your {dance} account." / »Ta povezava je za aplikacijo {dance}. Tam se prijavite s svojim računom za {dance}.«; `badRequest` "This link to connect an app is not valid. Start again from the app." / »Ta povezava za povezovanje aplikacije ni veljavna. Začnite znova v aplikaciji.« (Check the Slovenian words against the glossary in `sl/index.ts`: move = gib, figure = figura.)

- [ ] **Step 1: tests.** `authorize.spec.ts` (server): a valid GET loads `{ host, name }`; a POST with `as` of another user → 403; a POST whose `redirect_uri` differs from the GET's but is not registered → page error, no redirect; approve → 303 whose `Location` starts with the registered `redirect_uri` and carries `code`, the same `state`, `iss`; cancel → `error=access_denied`; frame headers on load and on both actions; a bachata user on the salsa host (`DANCE_HOSTS` set in the spec) gets `otherDance` and no form. `authorize.ts` spec: homestash's cases.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (shared components from `components/ui/`, the band and sheet like the login card). **Step 4:** Run, plus `no-english.spec.ts` and `refusals-guard.spec.ts` — PASS. eslint/prettier; commit `feat(ai-connector): the consent page`.

### Task 7: MCP over HTTP

**Files:**
- Create (copy homestash): `src/lib/mcp/protocol.ts`, `http.ts`, `protocol.spec.ts`, `http.spec.ts`, `sdk-compat.spec.ts`
- Modify: `package.json` — devDependency `@modelcontextprotocol/sdk` `^1.31.0` (`npm i -D`)
- Create: `src/lib/server/mcp/modules.ts`, `host.ts` (+spec) — copy homestash, `ToolCtx = { db: Db; userId: string; dance: DanceSlug; grantId: number; now: number }`
- Create: `src/routes/mcp/+server.ts` (+`mcp.spec.ts`) — copy homestash

Changes: `serverInfo.name` `'salsaapp'`; `INSTRUCTIONS`:

> "A dance practice app: one person's salsa or bachata (one dance per account). A move (figure_groups) holds figures (variations); a figure has a start count, a length in counts, start and end positions, notes and recordings with sections. Routines are ordered slots of figures. Drills (exercises) are practice items. Lessons hold notes, videos with sections, and links to figures, routines, drills and positions; a group's lessons are drafts until published. Positions are holds and places a figure starts or ends in. Every id comes from search or a list tool; never invent one. Names and notes are the person's own words, often Slovenian or Spanish: never translate them. This version reads only; it cannot change anything."

`/mcp` POST: foreign `Origin` → 403; `verifyAccessToken`; no user, or the user's `dance` is not this host's dance (`hostDance(danceHosts(), url.host)`; null in dev = any) → 401 with `WWW-Authenticate` from `wwwAuthenticate(url.origin)`. GET/DELETE → 405.

- [ ] **Step 1:** Copy the specs (adapt names); `mcp.spec.ts` adds: a salsa user's token on the bachata host → 401; `/mcp` with a session cookie and no bearer → 401 (the cookie is ignored). Run — FAIL.
- [ ] **Step 2:** Implement; `TOOL_MODULES = []` for now.
- [ ] **Step 3:** Run, including `sdk-compat.spec.ts` — PASS. eslint/prettier; commit `feat(ai-connector): /mcp`.

### Task 8: The person's view

**Files:**
- Create: `src/lib/server/mcp/view.ts` (+spec)

**Interfaces — Consumes:** `syncScope(db, userId): Scope` (`src/lib/server/sync/scope.ts`).
**Produces:** `viewOf(db: Db, userId: string): View` — built once per tool call from `syncScope`, never a query of its own on the content tables (so the connector cannot read past what the phone may hold). `View` holds typed, camelCased arrays of the rows the tools need: `moves`, `figures`, `recordings`, `spots` (video sections), `spotLinks`, `positions`, `figureStarts`, `figureEnds`, `routines`, `steps`, `stepOptions`, `exercises`, `lessons`, `lessonVideos`, `lessonFigures`, `lessonRoutines`, `lessonExercises`, `lessonPositions`, `teams`, `teamMembers`; plus `owner(row): { kind: 'mine' } | { kind: 'group'; teamId: number; name: string }` and `label(figureId): string` ("Move · Figure", as `figureLabels` writes it). Archived rows stay in `View` with `archivedAt`.

- [ ] **Step 1:** Spec on `makeWorld(openDb(':memory:'))` (`src/lib/server/sync/test-world.ts`): for `u1`, `viewOf` holds `world.own.u1.figure` and the group's published figure, not `world.group.draftFigure` (u1 a plain member there — check `test-world.ts` for who edits), not `world.otherGroup.figure`, not `world.own.u4.figure`; `label(world.own.u1.figure)` contains its move's name. Run — FAIL.
- [ ] **Step 2:** Implement. **Step 3:** PASS; eslint/prettier; commit `feat(ai-connector): the person's view for the connector`.

### Task 9: The read tools

**Files:**
- Create: `src/lib/server/mcp/args.ts` (+spec) — copy homestash's argument checks (unknown keys refused, ids are positive integers, strings length-capped, no coercion)
- Create: `src/lib/server/mcp/read.ts` (+spec); register `readTools` in `modules.ts`

**Interfaces — Consumes:** `viewOf` (Task 8), `ToolCtx` (Task 7).
**Produces:** `readTools: ToolModule`, every def `readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false`, `additionalProperties: false`. Each result is compact JSON in `text`; every item carries `id`, `kind`, `name`, `owner` (`"mine"` or `{ group }`) and `archived` only when true.

| tool | args | returns |
|---|---|---|
| `search` | `query` (1–100 chars), `kinds?` (subset of `move, figure, routine, drill, lesson, position, section`), `include_archived?` | up to 50 matches by name/label/notes, case- and accent-insensitive, names first |
| `list` | `kind` (one of the seven but `section`), `group_id?`, `include_archived?` | every item of that kind (name, id, owner), newest first |
| `get_move` | `id` | the move and its figures (each: label, start count, length in counts, positions, notes, recordings with sections) |
| `get_figure` | `id` | one figure as in `get_move`, plus routines and lessons using it |
| `get_routine` | `id` | slots in order (figure labels, alternatives, slot notes), notes |
| `get_drill` | `id` | type, notes, link(s), comes-back setting, lessons using it |
| `get_lesson` | `id` | title, date, notes, group and published state, videos with sections (start/end ms, label, linked figure or drill), linked figures/routines/drills/positions |
| `get_position` | `id` | name, type, hold, notes, figures starting and ending there |
| `list_groups` | — | groups the person is in, with role (owner/editor/member) |
| `vocabulary` | — | the person's own words: names of moves, figures, positions, routines, section labels, distinct, for keeping their vocabulary when fixing text |

A missing id, another person's id, another dance's id and a group row out of reach all answer `isError: true` with `"No <kind> with id <n>. Ids come from search or list."`.

- [ ] **Step 1: tests** on `makeWorld`, as u1: `search` "<the own move's name>" finds it and not u4's; `get_figure(world.own.u4.figure)` and `get_figure(world.otherGroup.figure)` and `get_figure(999999)` give the same error text; `get_lesson(world.group.published)` lists its video sections with ms; `list` `kind:'lesson'` hides `world.group.archived` unless `include_archived`; `args` refuses `{ id: "5" }` and `{ id: 5, extra: 1 }` with a one-line correction; every def has the four annotations and `additionalProperties: false`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS; eslint/prettier; commit `feat(ai-connector): read tools`.

### Task 10: Settings → Connected AI apps

**Files:**
- Modify: `src/routes/settings/+page.server.ts` (load `listGrants`; actions `disconnectApp`, `reconnectApp`), `+page.svelte` (a section like "devices", after it), `settings-forms.spec.ts`
- Modify: `src/lib/i18n/{en,sl}/settings.ts` (`connector.apps` words)

Behaviour: section label "Connected AI apps" / »Povezane aplikacije AI«; each row: host (and `calls itself` name when it differs), "Connected {date} · last used {date}" built with `format.ts`; the row's button "Disconnect" / »Prekini povezavo« (one tap) → `revokeGrant`, toast "{host} disconnected" / »{host} ni več povezana« with Undo → `restoreGrant`; `focusAfterRemoval` as the devices list does. Empty: the section shows one line, "Add this app in your AI app as a connector: {origin}/mcp" / »V svoji aplikaciji AI dodajte to kot povezavo: {origin}/mcp«, the address selectable.

- [ ] **Step 1:** `settings-forms.spec.ts`: the load lists a live grant; `disconnectApp` with another user's grant id → 404 (`refusals.notFound`); disconnect then reconnect within 60 s → listed again. Run — FAIL.
- [ ] **Step 2:** Implement. **Step 3:** PASS plus `no-english.spec.ts`; eslint/prettier; commit `feat(ai-connector): Connected AI apps in Settings`.

### Task 11: Docs, the full check, review

- [ ] **Step 1:** `docs/layout.md`: `src/lib/mcp/`, `src/lib/server/mcp/`, `src/lib/server/oauth/`, `src/lib/server/self-authed.ts`, `src/lib/server/csrf.ts`, the routes. `docs/hard-rules.md` + the CLAUDE.md auth rule: self-authed paths (`/mcp`, `/oauth/token`, `/oauth/register`, `/.well-known/oauth-*`) never see the session; CSRF lives in the hook; the connector reads only through `viewOf`/`syncScope`. `docs/features.md`: "the AI connector, plan 1" under What is live once deployed, and the spec under Specs. `docs/deployment.md`: a "The AI connector" section — nothing new on the host (nginx already proxies every path; `ORIGIN` per host is not used: the origin is the request's), how to add it in claude.ai (Settings → Connectors → Add custom connector → `https://salsa.anotherroot.eu/mcp`) and in ChatGPT (developer mode connector, same URL).
- [ ] **Step 2:** `npm run check` (Vitest `--maxWorkers=4`) — PASS. A build killed with 143: the `systemd-run` line in CLAUDE.md.
- [ ] **Step 3:** One review of the whole branch (fresh reviewer, most capable model), with the Review Focus list. Fix, re-run the touched specs, commit.
- [ ] **Step 4:** Merge master in, `npm run check` again, then hand back for the merge and deploy (backup first, `./scripts/deploy.sh`), and after deploy connect claude.ai to `https://salsa.anotherroot.eu/mcp` and ask it to search a move.
