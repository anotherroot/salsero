# Android app — design

> **Status:** approved in brainstorming, 2026-10-14; built 2026-10-14 (plan:
> `docs/superpowers/plans/2026-10-14-android-app.md`), not yet deployed or tried on a phone. Adds an Android
> APK beside the web app. Lessons' upload protocol is
> [`2026-09-23-lessons-design.md`](2026-09-23-lessons-design.md)'s and is not
> changed; this document adds a second client for it.

## Purpose

A lesson video goes up today in two steps: Shrink (`~/Projects/shrink`)
compresses it, then the lesson page uploads it — and the upload stops the
moment the phone leaves the page, because Android freezes a backgrounded tab.
The wanted flow is one step: pick the recording on the lesson, walk away, and
find it attached later. And the app should nudge: a reminder when exercises
are due.

Neither is possible from a web page. Compression could run in the page
(WebCodecs), but nothing in a page survives the phone doing something else,
and a reminder needs something that wakes on a schedule. So: an Android app.

Asked and decided:

- **Android only.** The phone is Android; the work PC keeps the plain website.
- **A TWA, not a rewrite and not a WebView.** The page keeps running in real
  Chrome, so the player — audio-clock timing, `speechSynthesis`, the mic, the
  wake lock, fullscreen — behaves exactly as it does today. A WebView shell
  would need each of those patched (Android's WebView has no
  `speechSynthesis`, which would silence the figure names) and the player's
  timing was tuned in Chrome. A native rewrite would duplicate every screen
  and still leave the website to maintain.
- **One daily nudge** for reminders, not one per exercise.
- **Shrink's compressor is copied in**, trimmed to what this needs. The two
  copies may drift; each does one fixed job.
- **Three entry points:** a lesson's Add video, a figure's Add recording, and
  sharing a video from the gallery. A share goes to a lesson only — a figure's
  recording is added from the figure page.
- **Default 480p**, with 480 / 720 / 1080 as a setting.
- Sideloaded over adb, like Shrink. No Play Store.

## Architecture: the screens stay on the web

The native side has **no screens**. Everything you look at is the web app;
the APK adds background work and notifications.

**The shell** is a TWA built on `androidbrowserhelper`: one APK, two launcher
icons — Salsa and Bachata — each opening its dance's Today. Each launcher's
start URL carries `?app=android`; the server turns that into a long-lived
`salsa_app=android` cookie, so server-rendered pages know they are inside the
app and the plain website never sees a difference.

**The page talks to native code by link.** Where the cookie is set, the file
inputs become links:

| Web control                         | In the app becomes                    |
| ----------------------------------- | ------------------------------------- |
| a lesson's Add video (chunked)      | `salsa://upload?lesson=<id>`          |
| a figure's Add recording            | `salsa://upload?figure=<id>`          |

Chrome hands `salsa://` to the APK. Its upload activity — invisible, no layout —
opens Android's photo picker (several videos for a lesson, one for a figure),
queues the jobs, and finishes, which drops back into the page. The page learns
nothing more; the videos appear on the lesson the next time it loads.

**Sharing from the gallery** borrows the web for its one question, *which
lesson?* A share's read grant is temporary — unlike the photo picker's, it
cannot be relied on once the receiving activity is gone — so the share
activity copies the file into app storage under a random key, then opens
`/share?key=<key>` in the TWA. That page lists recent lessons of both dances; each row links to
`salsa://upload?lesson=<id>&share=<key>`, and the upload activity queues the
shared file instead of opening the picker. A key nobody claims has its copy
deleted on the next launch.

**Where it lives:** `android/` in this repo, Kotlin, Gradle. Its toolchain (JDK,
Android SDK) is a second dev shell, `nix develop .#android`, so the web's
shell does not grow by a few gigabytes. Run Gradle the way Shrink does.

## The device login

A background job has no browser cookie, so the native side holds a token of
its own.

**Pairing is one tap.** When the native side needs the server and holds no
token, it opens `/device/pair` in the TWA. That page — already logged in
through Chrome's cookie — mints a random token, stores only its SHA-256 in
`device_tokens`, and navigates to `salsa://paired?token=<token>`. The APK
stores it and sends `Authorization: Bearer <token>` on every request.

The token travels through a custom scheme, which another app could also
claim. On a personal phone that is accepted. A verified https App Link would
close it at the cost of routing the TWA's own links around it; not worth it
here.

**`hooks.server.ts` accepts a device token on `/api/` only.** A valid one sets
`locals.user` exactly as a session does, so the native uploader calls the
existing endpoints unchanged and `scope.ts` walls the dances as usual. Pages
never accept it. An unknown or revoked token is a 401, as an API call without
a session already is. `last_used_at` is written at most once a minute.

**Revoking:** Settings lists paired devices (label, paired, last used) with
Remove. Removing deletes the row; the device's next request is a 401.

## Server additions

All additive: one new table, new columns via `ADD COLUMN`, no CHECK on an
existing table.

- **`device_tokens`**: `id, user_id, token_hash (unique), label,
  created_at, last_used_at`. Instants as epoch ms. Hard delete on Remove —
  a token is a credential, not history.
- **`users.reminder_minute`**: minute of the day, `null` = off.
  **`users.video_short_side`**: `480 | 720 | 1080`, default 480. Validated in
  the data function, not by a CHECK.
- **`GET /api/device/config`** → `{ reminderMinute, shortSide }`.
- **`GET /api/device/today`** → per dance, the names in Today's *due* band:
  `{ salsa: { due: string[] }, bachata: { due: string[] } }`. It calls the same
  `plan()` Today does, per dance, at request time — urgency stays a pure
  function of the sets, never stored.
- **`/device/pair`** (page), **`/share`** (page), the `?app=android` cookie.
- **`/.well-known/assetlinks.json`**: ties the APK's signing key to the host so
  Chrome shows the TWA without a URL bar. Added to `PUBLIC_PATHS`. Until it
  matches the installed key the app still works — it just shows Chrome's bar.
- **Settings:** reminder time (or off), video size, paired devices.

## The upload job

**The queue is on disk, drained by one runner.** Each video is a folder in
the app's no-backup storage (`JobStore`): the job, its compressed file, the
server's upload id, the offset reached, and a stall count. One WorkManager
worker drains it oldest first, so one upload streams at a time — the
protocol's premise, and what a phone's uplink wants anyway.

One runner rather than a job per video because **Android 12+ starts a
foreground service only for an app in front**. The runner is kicked from the
link that queued the video and from every launch, so the whole batch runs as a
foreground service (`dataSync`). A retry WorkManager starts later, from the
background, may be refused one; it carries on as a plain job, keeps what it
gets done, and the next launch runs the rest in front.

Not the cache: Android evicts it under storage pressure, and a video
compressed a second time is not byte for byte the first — resumed onto the
server's partial it would splice two encodes into one broken file. **A fresh
compression always gets a fresh server upload id.** A stopped run checks
`isStopped` between buffers, so it never keeps writing beside its replacement.

A job's input is the video — a picked URI (persistable permission taken when
queued) or a shared file's copy in app storage — the target
(`lesson:<id>` or `figure:<id>`), and, from the link, the page to open when
done and a name for the notification.

1. **Compress** with the copied Media3 Transformer code to
   `video_short_side`, read from `/api/device/config` when queued. A video
   whose short side is already at or below it is not re-encoded. The output
   goes to the app's cache and stays there until the upload succeeds, so a
   retry never compresses twice.
2. **Upload.** A lesson video speaks the existing chunked protocol:
   `PUT /api/lessons/<id>/videos/<uploadId>`, 8 MiB per request with
   `content-range`. A figure recording is the existing single raw-body POST to
   `/api/figures/<id>/recordings`; at these sizes it fits the 95 MiB cap, and
   when it does not, it fails with that reason.
3. **Done:** the cache file is deleted and a notification says
   *Added to Wednesday class*; tapping it opens that lesson or figure.

**Failures, by response:**

| What happened              | What the job does                                                 |
| -------------------------- | ----------------------------------------------------------------- |
| network error, 5xx         | stop the run, retry (WorkManager, linear backoff, network needed) |
| 409 + `x-received-bytes`   | not an error: continue from that offset                           |
| 401                        | stop; notification *Pair again* → opens `/device/pair`            |
| 404 (target gone), 413     | fail this video for good, say why, delete the cache file          |
| compression fails          | fail with *Couldn't compress <name>* — never uploaded uncompressed |

Retries are budgeted per video as **runs in a row without progress** (12);
any progress clears the count, so a long upload over a patchy connection is
not failed for drops it recovered from. A 401 keeps the whole queue: the token
is cleared, "Pair again" is posted, and pairing resumes it.

**A lost 201 on the last chunk.** The server finalises, the answer never
arrives, the retry probes an upload whose partial is gone. So the endpoint
keeps a `uploads/<uploadId>.done` marker holding the row for a day (swept with
the partials) and answers any later chunk for that id with the same 201 —
without it, the client would upload the whole video again as a second one.

Offline for more than a day: the server's boot sweep has removed the partial,
the next chunk gets a 409 at offset 0, and the upload starts over. Correct,
just slower. The app's cache is swept on launch of any file no queued job
owns.

**Notifications:** one ongoing for the queue (*Compressing 1/3 · 40%*,
*Uploading 1/3 · 62%*) and one result per video. `POST_NOTIFICATIONS` is asked
for the first time something is queued.

## Reminders

At `reminder_minute`, phone-local, an inexact alarm allowed while idle
(`setAndAllowWhileIdle`: no exact-alarm permission, and Doze does not hold it
back) starts an expedited job that calls `/api/device/today`. It
posts one notification only if something is due:

> **3 exercises due** · Salsa: Shines, Cross-body lead · Bachata: Basics

Names are cut after a few per dance. Tapping opens Today in the dance with
more due, or the only one with any. It stays silent when nothing is due, when
reminders are off, and when offline — no list is better than a stale one.

The next alarm is set after each one fires, after boot (`BOOT_COMPLETED`), and
on every app launch after re-reading `/api/device/config`. So a time changed
in web Settings takes effect the next time the app opens, or after the next
reminder at the latest.

Nothing new is stored server-side about reminders except the time. Practising
at lunch empties the evening's list because `plan()` reads the sets when asked.

## Testing

- **Server specs** (`openDb(':memory:')`, `getDb()` mocked as
  `dance-wall.spec.ts` does): a device token authenticates on `/api/` and is
  refused on a page; a removed token is a 401; pairing stores only a hash;
  `/api/device/today` gives each dance its own due list and never the other
  dance's; the settings reject a size outside 480/720/1080.
- **Kotlin JVM unit tests** for the pure parts: parsing `salsa://` links, the
  chunk plan and offset reconciliation, the job's decision per status code,
  the next alarm time (later today or tomorrow, across a DST change), and the
  notification text.
- **On the phone**, by hand, because nothing else can: queue three videos on a
  lesson, swipe the app away, toggle airplane mode mid-upload, and see all
  three arrive; share one from the gallery; add a figure recording; set a
  reminder two minutes ahead with something due, then with nothing due.
- Worker lesson applies here too: judge the native uploader against
  `node build` or the real host, never `vite dev`.

## Deliberately not included

- **iOS.** No TWA, and the phone is Android.
- **Upload progress inside the page.** The notification carries it; the page
  shows the video once it exists.
- **Compressing in the browser** for the work PC. Uploads from there stay as
  they are.
- **Per-exercise reminder times** and push from the server — the phone asks,
  so there is no server timer and no Firebase.
- **Sharing to a figure.** Figure recordings are added from the figure page.
