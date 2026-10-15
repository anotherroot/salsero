# Android app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Android APK beside the web app: a TWA shell for both dances, background
compress-and-upload of lesson videos and figure recordings, gallery share to a
lesson, and a daily "exercises due" reminder.

**Architecture:** Server first (device tokens, two JSON endpoints, pairing and share
pages, settings, the in-app links), then `android/`: a Kotlin app with no screens of
its own — `androidbrowserhelper`'s LauncherActivity for the TWA, invisible activities
for `salsa://` links and shares, WorkManager jobs for uploads and reminders.

**Tech Stack:** SvelteKit + Drizzle/SQLite (server); Kotlin, AGP 9, Gradle 9.3.1,
androidbrowserhelper, WorkManager, Media3 Transformer 1.11.1 (app).

**Spec:** `docs/superpowers/specs/2026-10-14-android-app-design.md`

## Global Constraints

- Application id `eu.anotherroot.salsa`; link scheme `salsa://`; host `https://salsa.anotherroot.eu`.
- No CHECK on an existing table; new columns by `ADD COLUMN` only; read the generated SQL.
- Every instant is epoch ms. Data functions take `db` first.
- A device token is accepted on `/api/` only (never `/api/worker/`, never a page). Only its SHA-256 is stored.
- Video size is one of `480 | 720 | 1080`, default 480. Reminder minute is `0..1439` or null.
- Urgency is never stored; `/api/device/today` calls `plan()` at request time.
- A form someone fills in uses `use:guarded`; one-tap forms use `use:enhance`.
- Lesson uploads: `PUT /api/lessons/<id>/videos/<uuid>`, 8 MiB chunks, `content-range: bytes s-e/total`, `content-type`, `x-filename` (URI-encoded). 204 + `x-received-bytes` while incomplete, 201 when done, 409 with `x-received-bytes` = resume there, 409 without it = another writer, retry later.
- Figure recordings: one raw-body `POST /api/figures/<id>/recordings`, cap 95 MiB.
- `npm run check` must pass. Android: `./gradlew test assembleDebug` inside `nix develop .#android`.

## Review Focus

1. A device token sent to a page URL (e.g. `GET /salsa` with only a bearer) — must redirect to login like no session, not render.
2. A device token on `/api/worker/*` — the worker gate must still demand the worker token.
3. The 409 "already being written" (no `x-received-bytes`) — the native uploader must back off and retry, not treat it as offset 0 and restart.
4. A reminder time at 23:59 set at 23:59:30 / across a DST change — next fire must be tomorrow's local time, not 23 or 25 h off.
5. `/api/device/today` with an archived or parked exercise — must not appear in due, and each dance only sees its own.

---

## Part A — server

### Task 1: device tokens and settings columns

**Files:**
- Modify: `src/lib/server/db/schema.ts` (users: `reminderMinute`, `videoShortSide`; new `deviceTokens`)
- Create: `drizzle/0013_*.sql` via `npm run db:generate`
- Create: `src/lib/server/devices.ts`, `src/lib/server/devices.spec.ts`
- Modify: `src/lib/types.ts` (`DeviceRow`, `VIDEO_SHORT_SIDES` lives in `src/lib/video-sizes.ts` — client-safe)

**Interfaces (produces):**
```ts
// src/lib/video-sizes.ts
export const VIDEO_SHORT_SIDES = [480, 720, 1080] as const;
export type VideoShortSide = (typeof VIDEO_SHORT_SIDES)[number];
export const DEFAULT_VIDEO_SHORT_SIDE: VideoShortSide = 480;
export function isVideoShortSide(n: unknown): n is VideoShortSide;

// src/lib/server/devices.ts
export function createDeviceToken(db, userId: string, label: string, now: number): { id: number; token: string };
export function userForDeviceToken(db, token: string, now: number): { userId; email; timezone } | null; // touches last_used_at at most once a minute
export function listDevices(db, userId: string): DeviceRow[];          // newest first
export function removeDevice(db, userId: string, id: number): boolean; // only the user's own
export function deviceSettings(db, userId: string): { reminderMinute: number | null; shortSide: VideoShortSide };
export function setReminderMinute(db, userId: string, minute: number | null): void; // throws RangeError outside 0..1439
export function setVideoShortSide(db, userId: string, side: number): void;          // throws RangeError unless 480/720/1080
export function bearerToken(header: string | null): string | null;
```

- [ ] Tests first (`devices.spec.ts`, `openDb(':memory:')`, insert a user row): a created token resolves to its user; the stored `token_hash` is not the token and is 64 hex chars; an unknown token is null; a removed token is null; `removeDevice` by another user returns false and leaves it; `last_used_at` is written on first use, not again 30 s later, again 61 s later; settings default `{ null, 480 }`; `setVideoShortSide(…, 600)` and `setReminderMinute(…, 1440)` throw and change nothing; `bearerToken('Bearer x')==='x'`, `bearerToken('Basic x')===null`, `bearerToken('Bearer ')===null`.
- [ ] Run, see them fail. Implement. Columns: `reminder_minute integer` (nullable), `video_short_side integer not null default 480`; `device_tokens(id integer pk autoincrement, user_id text not null references users(id) on delete cascade, token_hash text not null unique, label text not null, created_at integer not null, last_used_at integer)`.
- [ ] `npm run db:generate`; read the SQL: two `ALTER TABLE users ADD` + one `CREATE TABLE`, no `__new_users` rebuild.
- [ ] `npx vitest run src/lib/server/devices.spec.ts` passes. Commit.

### Task 2: the device token in hooks, and the app cookie

**Files:** Modify `src/hooks.server.ts`, `src/routes/+layout.server.ts`, `src/app.d.ts`; create `src/lib/server/request-user.ts` + `.spec.ts`; `src/lib/app-mode.ts` (client-safe constants).

**Interfaces:**
```ts
// src/lib/app-mode.ts
export const APP_COOKIE = 'salsa_app';
export const APP_PARAM = 'app'; // ?app=android
export const APP_SCHEME = 'salsa';
// src/lib/server/request-user.ts
export function apiDeviceUser(db, path: string, authorization: string | null, now: number): SessionUser | null;
// null unless path starts '/api/' and not '/api/worker/', and the bearer resolves
```
Layout data gains `app: boolean` (cookie `salsa_app === 'android'`).

- [ ] Tests: a valid token on `/api/device/config` → user; same on `/salsa` → null; same on `/api/worker/next` → null; revoked → null; no header → null.
- [ ] Implement; in `handle`, only when no session: `event.locals.user = apiDeviceUser(getDb(), path, header, Date.now())`. Before the auth gate: if `url.searchParams.get('app') === 'android'` set cookie `salsa_app=android` (path `/`, 1 year, httpOnly false is fine — not a credential; sameSite lax, secure in prod via SvelteKit default).
- [ ] Commit.

### Task 3: `/api/device/config` and `/api/device/today`

**Files:** Create `src/routes/api/device/config/+server.ts`, `src/routes/api/device/today/+server.ts`; add `dueByDance(db, now, tz)` to `devices.ts` + tests.

```ts
export function dueByDance(db, now: number, tz: string): Record<DanceSlug, { due: string[] }>;
```
- [ ] Tests: salsa exercise never done → in salsa.due, not in bachata.due; an exercise done today → absent; inactive (`active=false`) → absent; archived → absent; order follows `plan().due`.
- [ ] Implement with `listExercises`, `listSetTimes`, `plan` per `DANCE_SLUGS`. Endpoints return `json(...)`; 401 is already handled by hooks.
- [ ] Commit.

### Task 4: pairing, share and assetlinks

**Files:** Create `src/routes/device/pair/+page.server.ts` + `+page.svelte`; `src/routes/share/+page.server.ts` + `+page.svelte`; `src/routes/.well-known/assetlinks.json/+server.ts`; modify `hooks.server.ts` `PUBLIC_PATHS`; `src/lib/app-mode.ts` gains link builders.

```ts
export function uploadLink(target: { lesson: number } | { figure: number }, share?: string): string; // salsa://upload?lesson=12[&share=…]
export function pairedLink(token: string): string; // salsa://paired?token=…
export const SHARE_KEY_RE = /^[0-9a-f-]{36}$/;
```
- Pair: GET shows a button (one-tap `use:enhance`-free plain form, so the 303 is followed natively? no — action returns `{ token }`); page then renders "Open the app" link to `pairedLink(token)` and sets `location.href` to it once.
- Share: `load` validates `key` (404 otherwise), returns lessons of both dances (`listLessons`, non-archived, newest 30 each); rows link to `uploadLink({lesson}, key)`.
- assetlinks: JSON for `eu.anotherroot.salsa` with fingerprints from `env.SALSA_ANDROID_CERT_SHA256` (comma-separated); empty array when unset.
- [ ] Spec for `uploadLink`/`pairedLink` (encoding), commit.

### Task 5: Settings

**Files:** Create `src/routes/settings/+page.server.ts`; modify `src/routes/settings/+page.svelte`.
- load: `deviceSettings`, `listDevices`. Actions: `prefs` (reminder `HH:MM` or empty = off, `shortSide`), `removeDevice`.
- `prefs` form uses `use:guarded`; Remove uses `use:enhance`.
- [ ] Commit after `npm run check`.

### Task 6: in-app links on lesson and figure pages

- Lesson page: when `data.app`, replace `ChunkedUploadButton` with an `<a href={uploadLink({lesson})}>+ Add videos</a>` styled the same.
- Figure page: when `data.app`, show `+ Add video` link (`uploadLink({figure: version.id})`) and keep `UploadButton` with `accept="audio/*"`, label `+ Add audio`.
- [ ] `npm run check`; commit.

## Part B — Android (`android/`)

### Task 7: scaffold + TWA shell

**Files:** `flake.nix` (devShells.android: jdk21, androidenv sdk 36 / build-tools 36, `GRADLE_OPTS` aapt2 override, `ANDROID_HOME`); `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`, `android/gradle/wrapper/*`, `android/gradlew` (copied from Shrink, Gradle 9.3.1); `android/app/build.gradle.kts`; `AndroidManifest.xml`; `SalsaLauncher.kt`, `BachataLauncher.kt` (subclass `LauncherActivity`, refresh on create); mipmaps from `static/icons/*-512.png`; `res/values/strings.xml` with `asset_statements`.
- Start URLs: `https://salsa.anotherroot.eu/<dance>/?app=android`.
- [ ] `nix develop .#android -c ./android/gradlew -p android assembleDebug` builds. Commit.

### Task 8: links, pairing, API client

**Files:** `Links.kt` (pure: `parseLink(uri: String): Link?` — `Upload(target, share)`, `Paired(token)`), `Prefs.kt`, `Api.kt` (HttpURLConnection, bearer, `config()`, `today()`), `LinkActivity.kt` (handles `salsa://`; Paired → save, finish; Upload → picker or share file), `Web.kt` (`openWeb(context, path)` starts SalsaLauncher with the URL as data).
- Tests (`LinksTest.kt`): lesson / figure / share / paired parse; missing or non-numeric id → null; unknown host → null; both lesson and figure → null.
- [ ] Commit.

### Task 9: compress + upload worker, share intake

**Files:** `Compressor.kt` (Shrink's VideoCompressor trimmed: `suspend fun compress(uri, shortSide, out: File, onProgress): Result`), `VideoProbe.kt`, `Encoding.kt` (`outputSize`, bitrates per side 480→1.0 Mbps, 720→1.5, 1080→3.0; audio AAC 128k), `UploadPlan.kt` (pure), `UploadWorker.kt` (CoroutineWorker, foreground), `UploadQueue.kt` (enqueue unique chain `uploads`, APPEND_OR_REPLACE), `ShareActivity.kt`, notifications in `Notify.kt`.

```kotlin
sealed interface Step { data class Send(val start: Long, val end: Long) : Step; data object Done : Step; data class Retry(val afterMs: Long) : Step; data class Fail(val reason: String) : Step; data object Unpaired : Step }
fun nextStep(status: Int, receivedHeader: Long?, sent: LongRange, total: Long, chunk: Long, attempt: Int): Step
fun firstChunk(total: Long, chunk: Long): Step.Send
```
- Tests: 204 + received=8 MiB → Send(8 MiB, 16 MiB-1); 201 → Done; 409 + received=3 → Send(3, …); 409 without header → Retry; 500 → Retry with backoff growing; 401 → Unpaired; 404/413/415 → Fail; last chunk ends at total-1.
- [ ] Commit.

### Task 10: reminders

**Files:** `ReminderTime.kt` (pure `nextFire(now: ZonedDateTime, minute: Int): ZonedDateTime`), `ReminderText.kt` (pure `reminderText(due: Map<String, List<String>>): Pair<String,String>?` and `danceToOpen`), `Reminders.kt` (AlarmManager `setWindow` 10 min; `reschedule(context, minute)`), `ReminderReceiver.kt`, `BootReceiver.kt`, `ReminderWorker.kt`, `ConfigWorker.kt` (fetch config → reschedule; enqueued on launcher create).
- Tests: 17:59 with minute 18:00 → today 18:00; 18:00:30 → tomorrow; DST spring-forward day 02:30 → 03:30 that day (Java's resolution) and fall-back; text: empty → null; 2 salsa + 1 bachata → "3 exercises due", body "Salsa: A, B · Bachata: C"; more than 3 per dance cut with "+N"; dance to open = more due, tie → salsa.
- [ ] Commit.

### Task 11: docs

- CLAUDE.md layout (`android/`, `src/lib/server/devices.ts`, device token rule), spec status, `docs/deployment.md` (`SALSA_ANDROID_CERT_SHA256`, building/installing the APK).
- [ ] `npm run check`, `./gradlew test assembleDebug`. Commit.
