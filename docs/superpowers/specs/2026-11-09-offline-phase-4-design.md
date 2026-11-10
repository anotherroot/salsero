# Offline phase 4: songs and videos on the phone

Phase 4 of [the offline design](2026-11-07-offline-design.md) (read its
"Videos", "Keep on this phone", "iPhone and browsers" and "Media on the
device" sections first: what they agreed still holds unless this document
changes it). Phases 1–3 are live: every page opens from the device's copy
and changes made with no signal sync later. What still needs the network is
every media file: song audio, count takes, lesson videos and recordings
(`NETWORK_ENDPOINTS` in `src/lib/offline/routes.ts`).

Talked through with the user on 2026-11-09. Asked what they miss most with
no signal, the user said all three: songs, lesson videos and their own
recordings.

## Why

- Practising in a basement: the player needs the song and the count.
- Watching lesson videos on a train.
- Practice footage of yourself at full quality that you never want uploaded.

## Three parts, in this order

Each part ships on its own, gets its mockups on real screenshots first (the
user's usual way: screenshots of now, 2–4 options to the phone, build the
pick), and is useful without the next one.

### 4a. Songs on the phone

- The audio of every song the person can play (their own and their groups'
  songs, as `songAccess` allows) and their count takes are kept on the
  device **automatically**, with no buttons. A new or changed song follows.
- The player prefers the device's file, then the server.
- The only look: a line in Settings' space on this device (see 4b) saying
  how much the songs take. Mockup with 4b's Settings, or alone if 4a ships
  first (Claude's call: 4a ships first with a plain line).
- Songs download on any connection (they are small), unlike videos.

### 4b. Lesson videos kept on the phone

**Settings → On this phone** (a section; the existing Storage page is the
server's, this one is the device's):

- **One switch per space:** "My lessons" and one for each group the person
  is in. On: every lesson video of that space is kept on the phone, all
  lessons, old ones too, and each new one as it appears. Off by default.
- **"Only on Wi-Fi"**, on by default. Off: kept videos also download on
  mobile data. Songs ignore it.
- **The space taken:** kept copies apart from originals (4c) and songs, and
  **Clear kept copies**, which never touches an original.

**On a lesson** whose space is not switched on: a **Keep on this phone**
button keeps that lesson's videos, and new videos added to it. The same on a
single video, and on a figure (its recordings that are on the server).

**Playback** prefers the original on the phone (4c), then a kept copy, then
the server stream. A video on the phone has a small mark.

**Low space:** when the phone runs short of space the app says so and
suggests videos to remove from the phone, never removing anything itself:

- kept copies first (they are on the server and can come back);
- a video that is **only on this phone** is marked as such, removing it is
  permanent and the question says so, with "Upload first" offered beside it.

**Where the phone doesn't say whether it is on Wi-Fi** (the iPhone, most
browsers; the user's answer, 2026-11-09): the switches per space still work,
and in place of "Only on Wi-Fi" a short note says the app can't tell Wi-Fi
from mobile data here, so switching a space on may use mobile data. Nothing
else changes.

**The iPhone is built in phase 4** (the user: someone will surely use one).
The user can't test on an iPhone now; they will in the coming weeks, so the
iPhone path (OPFS originals, the popup and its mark, this note) ships tested
in a desktop browser and on Android's WebView, and gets its phone test then.

Downloads run while the app is open (Claude's call; Android could run them
in the background, and that can come later; the iPhone can't).

### 4c. Your videos only on the phone

As agreed in the main design's "Videos" section, unchanged:

- A new video of the person's own (a recording on a figure, a video on their
  own lesson) stays on the phone as the untouched original, by default.
  Every place a video can be added gets this; a place added later (a video
  on an exercise, say) gets it the same way.
- **Upload** sends the 480/720/1080 copy from Settings' video size;
  **Remove the server copy** makes it phone-only again (only the device
  holding the original may). A group's videos always upload.
- On another device it reads **On <device name>**: its sections and links
  list, it can't play.
- On Android the original stays in the gallery (the app points at it,
  never copies it; filmed in the app → its own gallery folder; deleted from
  the gallery → shown as missing). On an iPhone or a browser the app holds
  the file (OPFS) and the iPhone popup explains the risk once.
- Recording uploads become chunked like lesson videos (1 GiB cap).
- Phone-only videos don't count against the storage limit.

4c needs a new Android app release (the gallery access and the native file
server), so the APK goes out with it.

## Not in phase 4

The user's new idea (noted in their notes, 2026-11-09): recording yourself
from inside the player while the music plays, importing a video, and maybe
a new kind of thing beside lessons ("an event", "a practice") to hold
progress recordings. Its own project after phase 4, which lays the ground
(phone-only originals, chunked uploads). Also not here: Android downloads
in the background, compressing on the iPhone (WebCodecs).

## Anti-goals

- Anything removed from the phone without the person asking, above all a
  phone-only original.
- A phone-only video uploaded without the person asking (from the main
  design).
- Videos downloading on mobile data while "Only on Wi-Fi" is on, where the
  phone says which it is on.
- Media on the device making everyday screens or the app's open slower.
- A device holding media its person may not read (the same wall as rows:
  `syncScope`, `songAccess`, the group's reach); leaving a group drops its
  kept copies.

## The looks to design (before each part)

- 4a: none beyond the songs line in Settings.
- 4b: Settings → On this phone (switches per space, Only on Wi-Fi or the
  can't-tell note, space, Clear); Keep on this phone on a lesson, a figure and a video; the mark on
  a video on the phone; the low-space notice and its list.
- 4c: where a video lives (phone only, on the server, both, kept copy, On
  <device>) with Upload and Remove server copy; the iPhone popup and its
  mark; a missing gallery file.

## Claude's calls (after the builder check, 2026-11-09)

- **One store for songs and kept copies on every device, Android too:** the
  browser's own storage (OPFS) inside the WebView, served with Range by the
  service worker. So 4a and 4b need no new APK, and nothing moves later.
  Native storage on Android is only for 4c's gallery originals (and the
  phone's free space, below), and ships with 4c's APK. This changes the main
  design's "kept copies live in the app's own storage" on Android.
- **Low space:** `navigator.storage.estimate()` until 4c's APK; from then
  the Android app also tells the page the phone's free space. The low-space
  list holds only what frees space when removed: kept copies, and originals
  the app holds itself (iPhone, browser). An Android gallery original is the
  person's own file in Photos: removing it from the app frees nothing, so it
  is not on the list; deleting it still asks whether to delete it from the
  gallery too (main design). Settings counts gallery originals on a line of
  their own ("in your gallery").
- **No filming inside the app in 4c:** a video comes from the gallery
  (Android's picker) or a file, as today. Filming from the player goes with
  the separate recording project. The main design's "filmed in the app → its
  own gallery folder" waits for it.
- **The switches are per device:** they are about this phone's space.
- **A phone-only video and the AI connector:** `video_timeline` and the
  other video tools say the video is on a device and can't be read.
- **Older Android apps** keep the single-request recording upload until
  they update; the server accepts both.
- **Plans:** one per part. 4a is planned and built first; 4b and 4c are
  planned after their mockups are picked.

## Left to the builder

Everything under the main design's "Media on the device" is the builder's
(Claude's) call, as are: how the device learns a phone is short of space
(`navigator.storage.estimate()`, Android's free space), how downloads are
queued, resumed and limited, how Android tells the web page it is on Wi-Fi
(the browser's Network Information API where there is one), and the
order 4b's downloads run in (newest lesson first is the obvious one).

## Decided while building 4a (2026-11-10)

- The service worker answers `/audio/<file>` and `/count/<file>` from the
  phone even online (no data, no wait); the player is unchanged. An answer
  from the phone carries `X-Salsa-From: device`.
- The device brings the store to the copy after its start, after every sync
  that reached the server and after a person change. A person change empties
  the store before the new copy serves; a download in flight then stops
  between files, and one more pass removes a file that landed after.
- Settings → On this phone shows only where the browser has the store.

## 4b's looks, picked by the user (2026-11-10)

From the mockups on real screenshots (Settings A/B, lesson A/B, mark 1/2,
low space A/B), the user picked **Settings B, mark 1, low space B**, and
dropped the lesson question: "2 is covered by 3.1".

- **Settings B:** Settings keeps one row, "On this phone" (songs · videos ·
  free), which opens its own page: a bar of the space taken (songs and
  count, kept videos) with what is free, the switch per space ("My lessons",
  each group), "Only on Wi-Fi" or the can't-tell note, a note on what a
  space keeps, and "Clear kept videos".
- **Mark 1, the button under the video:** a phone button left of Full
  screen on every video (a lesson's, a figure's top video, a recording's
  row). One tap keeps that video on the phone, another removes it; while it
  comes it shows how far. The line under the video's name says "on this
  phone" (or how far it is, or what it waits for). A lesson whose videos
  are all on the phone says so in the Lessons list.
- **No lesson-wide button.** This changes "On a lesson … a Keep on this
  phone button keeps that lesson's videos, and new videos added to it"
  above: a video is kept one at a time, a whole space by its switch.
  A video its space keeps shows the button lit; it opens the page, since
  the switch is what keeps it.
- **Low space B:** the first time space runs short, a sheet opens once
  with the suggestions (largest first: switch a space off, remove a video)
  and "Later"; then only a dot on You and the same warning and suggestions
  at the top of the On this phone page, until there is space again.
- "Upload first" for a phone-only video comes with 4c.

## Decided while building 4b (2026-11-10)

- Lesson videos and recordings live in the same store as songs
  (`media/lesson-videos/`, `media/recordings/`), answered by the service
  worker with Range, online too. A video's `.part` stays when a download is
  cut off and the next pass asks for the rest with `Range`; a 200 starts
  over. Chrome's `createWritable` commits only on close, so a long download
  commits every 8 MiB: an app closed half way keeps what came.
- The settings are this device's (`device_meta` `keep`) and go with the copy:
  another person, or Forget, starts from none.
- Free space is `navigator.storage.estimate()` (quota − usage) until 4c's
  APK. Below 500 MiB the phone is short of space; no download starts that
  would leave less, and a video that doesn't fit is skipped while smaller
  ones still come.
- Only on Wi-Fi reads `navigator.connection.type` (Android's WebView says
  it); where the browser says nothing (iPhone, desktop) the note shows and
  videos download on any connection. A switch to mobile data stops the
  file in flight.
- Clear kept videos asks nothing (they stay on the server) and switches
  every space and kept video off; a toast says it is done.
- The button and the page show wherever the store is, a computer's browser
  too, as 4a's songs do.

## 4c's looks, picked by the user (2026-11-10)

From the mockups on real screenshots (your video A/B, on another device A/B,
iPhone A/B), the user picked **1B, 2A, 3B**.

- **1B, one "Where is it" button:** on a person's own video the 4b phone
  button's place holds one button that opens a sheet, "Where is this video":
  this phone (the original, its size, plays from here) and the server (not
  uploaded, with Upload; or the 720p copy and its size, with Remove). A line
  under the sheet says Upload sends a smaller copy (the size from Settings →
  Video) and the original always stays on the phone. The line under the
  video's name says where it is ("only on this phone", "uploading 40 %", "on
  this phone and the server"); while it uploads, the button shows how far.
  A recording's row has the same button before its chevron.
- **2A, a grey frame:** on another device a phone-only video keeps a frame
  the video's size, dark, with a phone icon, "On <device name>" and a line
  saying it plays there, or here once uploaded there. Its name line says
  "on <device name>"; its sections list below as today. A recording's row
  shows a dimmed phone disc and "on <device name>".
- **3B, a card under the video, once:** the first time a video stays only on
  an iPhone, a warm card under it explains (iOS may delete it when short of
  space or when the app isn't opened for long; a video only here would be
  lost; it is safe once uploaded) with Upload and Got it, until closed. After
  that, an ⓘ after "only on this iPhone" opens the same words.
- **The same in every option** (shown, not asked): after adding, a toast
  "Saved on this phone" with Upload; deleting a phone-only video says it is
  permanent, and on Android asks "Delete from the gallery too"; a video
  deleted from the gallery reads "no longer in the gallery" with Remove; the
  On this phone page adds "Your videos in the gallery" to its bar and line.
