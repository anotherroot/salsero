# Spotify links and playlists — design

2026-11-08. Status: agreed in conversation. Plan 1 (Spotify songs) built; plan 2 (playlists) not yet.

## Why

Music's "Add a song" box takes a link and the home worker downloads it with
yt-dlp. Teachers and dancers find their music on Spotify, and a class's music
often lives in a playlist. Today a Spotify link is queued and then fails on the
worker, and a playlist link downloads only one video (`--no-playlist`).

Spotify's own audio is DRM-protected and cannot be downloaded. What works,
and what spotDL does, is reading the song's title, artist and length from
Spotify and downloading the same song from YouTube.

## Goals

1. **A Spotify song link works in the box.** It downloads right away, with no
   question first. The home worker reads the title, artist and length from
   Spotify, picks the best YouTube match by fixed rules, and downloads it.
2. **A wrong match can be fixed later.** The song page says where the audio
   came from, as a link, and lets the person paste another YouTube link to
   download the audio again.
3. **A playlist link (YouTube or Spotify) is a pick list, not a download.**
   The worker reads the playlist; the person then ticks which songs to bring
   in (Select all; a link per song to check it; titles editable in the list)
   and only those are downloaded.
4. **A reminder.** While a read playlist waits to be picked, the Music tab
   shows a dot.

## Non-goals

- No choice among several YouTube matches. The user asked for this
  explicitly: the worker takes its best match, and a wrong one is fixed by
  pasting a link.
- No Spotify account, sign-in or playback. Spotify is only read for names
  and lengths.
- No syncing with a playlist afterwards (songs added to it later do not show
  up). Pasting the link again reads it again.
- No change to uploads or to how a single YouTube link works.

## Anti-goals

- A playlist must never download everything by itself. Nothing downloads
  until the person picks.
- The server never runs Python and never talks to YouTube (it is
  bot-blocked). Spotify and YouTube are both read on the home worker.

## What the person sees

### Pasting a link

The box is the same box (`AddSongSheet`). What the link is decides what
happens, worked out by a PURE parser (`src/lib/songs/source.ts`, client-safe,
with a spec):

| Link | What happens |
|---|---|
| YouTube video (also `watch?v=…&list=…`, as today) | One song, as today |
| Spotify track (`open.spotify.com/track/…`, `/intl-xx/track/…`, `spotify:track:…`) | One song, matched on YouTube |
| YouTube playlist (`youtube.com/playlist?list=…`) | A pick list |
| Spotify playlist or album (`/playlist/…`, `/album/…`) | A pick list |
| Spotify anything else (episode, show, artist) | Refused under the field: "Paste a song, playlist or album" |
| Spotify short link (`spotify.link/…`) | The server follows its redirect (one hop, headers only, a short timeout) and classifies where it lands; if that fails, refused with "Paste the full open.spotify.com link". My call: following Spotify's redirect is not reading Spotify or touching YouTube, so it stays on the server |
| YouTube Music (`music.youtube.com`) | Classified like YouTube: `watch?v=` a song, `playlist?list=` a pick list |
| Anything else | As today (yt-dlp tries it) |

The box's label is "YouTube or Spotify link", with the helper line "A song, a
playlist or an album. From a playlist you pick which songs to add." The
button says what will happen as the link is typed: "Add song" for a song,
"Read the playlist" for a playlist or album, which also hides Title (each
song gets its own in the pick list). A Spotify icon is added to the icon set
beside YouTube's.

The mockups the user approved (2026-11-08, `2026-11-08-spotify-mockups/`:
`screens.html`, and `pick-list.html` for the pick list, option A2) are the look for every screen
below: Music's "To pick" section, the steps page, Song details' "Audio from"
card and the question before downloading again.

### A Spotify song

It appears in Being added like any pasted song, its grey line saying where it
is ("Grupo Niche · Finding it on YouTube"). Its page has one more step:
Added ("From Spotify"), **Find it on YouTube** (done: the video's title and
length), Download, Find the beat. When the search finds nothing it fails with
"No match on YouTube", offering Retry, **Use a YouTube link** and Upload a
file instead. When it lands, its title and artist are Spotify's
(cleaner than a YouTube video title), unless the person typed a title in the
box, which wins as it does today.

### Where the audio came from, and fixing it

The song page and Song details today show "From <url>" as plain text. They
become links (opening in a new tab):

- The steps page and a failed song: "From Spotify ↗ · Audio from YouTube ↗"
  (a YouTube song: "From YouTube ↗").
- Song details: an **Audio from** card under Save, a row per source: Spotify
  (its title · artist, ↗) and "YouTube · the audio" (the video's title, ↗),
  the second being the video the worker actually downloaded. A YouTube song
  has only the YouTube row.

Song details gets **Use another YouTube link** (a tonal button under the
card). It opens an "Another YouTube link" field in the sheet, with the help
line "The song downloads again and its beat is found again. The 1s you tapped
are cleared.", **Download this one** and Cancel. Download this one asks first
(a dialog, not `confirm()`: "Download the audio again?", saying how many
copies kept in step get it too): the song downloads
again, its beat grid is found again, and **the 1s tapped for the count are
cleared**, so the count needs tapping again; the sample start goes back to
automatic. The song goes back to Being added with the usual steps, then is
ready again. Drills and routines using the song keep using it.

**Copies (user's answer).** A song's copies share one audio file (hard
links) and, kept in step, their count 1s (`apply.ts` `songRoots`, compared as
`count` by `songFlat`). New audio goes to **every copy kept in step** with the
one changed, through the flow (`flowFrom`, as a save travels today): each gets
the same `audio_url`, its count and sample start cleared, and is downloaded
again (or, the builder's call, takes the first one's new file as a hard link
once it lands, rather than downloading N times). So a teacher fixing a wrong
match fixes it for the class. **Copies not kept in step keep the old audio**,
and from then on are not offered the count across the different audio: Sync
and the flow treat the count as not comparable between copies whose
`source_url|audio_url` differ (and, for an upload, whose audio differs).
The dialog says how many copies the new audio goes to. This touches the
clone code (`apply.ts`, `flow.ts`, `step.ts`, `clone_pairs`).

My call: this is offered for any song that was downloaded from a link (a
YouTube one too, since a YouTube link can also turn out to be the wrong
version), not for an uploaded file.

### A playlist

1. Pasting a playlist link closes the box and puts a row in Music's Being
   added: "Reading playlist…", "YouTube · the home PC reads it within a
   minute or two", with Cancel. It does not count as a song.
2. When the worker has read it, it moves to a **To pick** section at the top
   of Music, above Being added: a row with the playlist's name, "Spotify
   playlist · N songs" and a "Pick songs" pill, and **the Music tab shows a
   dot** (phone tab bar and the desktop side). Tapping the row opens the pick
   list.
3. If reading fails (private playlist, a bad link), the row shows the error
   with Retry and Dismiss, like a failed song.

**The pick list** is a page in the Music area (on desktop, in the item pane
beside the Music list). Its look was picked from mockups (option A2,
2026-11-08):

- The band: back, the playlist's name, "Spotify playlist · N songs" (or
  YouTube).
- **Style for all**: the dance's style chips (default: the dance's first
  style). A song given its own style keeps it when Style for all changes
  later.
- **Select all** (a tick box that shows all, some or none) and "N of M
  picked".
- A row per song, one line: a tick box, the title, a grey line "artist ·
  length" (plus "· Son" when its style differs from Style for all), a pencil,
  and ↗ that opens the song on YouTube or Spotify in a new tab so the teacher
  can listen first. A YouTube playlist has no artist; the line shows only the
  length.
- **The pencil opens the row as a form (A2):** the title and the artist become
  fields where their text was, with no labels and no box around them; the
  style chips for that one song sit under them; a small line under those
  keeps the original "On Spotify: <name> · <length>" (or "On YouTube").
  ✓ in place of the pencil closes it. One row open at a time.
- A song already in the same space's library (same YouTube video or same
  Spotify track as a song's link) shows "Already added" and starts unticked.
  It can still be ticked. My call: matched by link, not by title.
- Nothing starts ticked except by Select all. My call: the user said the
  teacher decides yes and no, so the default is no.
- Songs carry a style per song, as today. Whether styles should grow, be the
  person's own, or go from songs is an open question in the notes, outside
  this work: the pick list draws whatever list the dance has.
- A song already added has no pencil; its row shows the "Already added" pill
  and ↗.
- A bar pinned at the bottom: **Dismiss** (tonal) and **Add N songs**
  (primary). Add queues the ticked songs with their edited titles, artists
  and styles, closes the
  list, and the songs show in Being added. Dismiss asks, then throws the list
  away with nothing downloaded.
- The form uses `use:guarded`, so leaving with ticks or edits asks "Unsaved
  changes".

After Add or Dismiss the row and the dot go. Titles can still be changed
after download in Song details, as today.

### Groups and group mode

A playlist pasted in group mode belongs to that group, like a song pasted
there; the songs it adds are the group's drafts (`shared_at` null), shared
later as today. My call: a group's pick list shows in the group's Music
section and its dot shows to that group's editors (whoever may add songs
there), not to members.

### Levels

Nothing new is drawn at Follow my class, which has no Music tab.

## How it works

### Data

- **`songs.audio_url`, `fetched_url`, `fetched_title`** (new, nullable,
  additive `ADD COLUMN`; settled while planning). `audio_url` is the person's
  link for the audio, set by Use another YouTube link (null: `source_url`);
  the claim hands the worker `audio_url ?? source_url`. `fetched_url` and
  `fetched_title` are what the worker actually downloaded, reported with the
  audio, for the "Audio from" card. Two columns rather than one because the
  copies compare by the person's choice (`source_url|audio_url`, the flat key
  `audio`), and the worker's own report must never look like an edit.
  `source_url` stays what the person pasted.
- **Song imports** (new table, e.g. `song_imports`): one row per pasted
  playlist. Owner (`user_id` or `team_id`, exactly one, as the root tables),
  `dance`, the URL, the playlist's name, status (reading, ready, failed),
  error, attempts, `claimed_at`, created, and when it was added or dismissed.
  Its items (title, artist, length, the song's own link, position) are
  written by the worker when read. Whether items are a child table or a JSON
  column is the builder's call. It follows the id rule (`mintedId`, a mark
  trigger) and gets a migration with no CHECK on an existing table.
- My call: a done or dismissed import is kept (bookkeeping) or deleted; the
  builder picks. Nothing reads it afterwards.

### The worker

- **Song jobs:** the claim returns `audio_url ?? source_url`. When that is
  a Spotify track, the worker reads the track's title, artist and length from
  Spotify, searches YouTube for "<artist> <title>", picks the best result,
  and downloads it as today. It reports the YouTube URL it used and Spotify's
  title and artist with the audio. The server stores `fetched_url`, fills
  the title only when empty (as today) and the artist only when empty.
- **The match rules** (the builder tunes them, with tests on fixed search
  results): look at the first handful of YouTube results; strongly prefer a
  length within ~10–15 s of Spotify's; prefer YouTube Music "… - Topic"
  channels and "official audio"; penalise words like live, en vivo, cover,
  karaoke, remix, slowed, sped up, 8D, instrumental, unless Spotify's title
  has them too. If nothing fits the length, still take the best one: the
  person fixes it.
- **Import jobs:** a third queue beside songs and videos (`/api/worker/imports/…`:
  claim, report the items, fail), same lease, attempts and permanent errors
  as songs. Imports are claimed before songs: a person is waiting on them, and
  reading a list takes seconds. A YouTube playlist is read with
  `yt-dlp --flat-playlist`; a Spotify playlist or album from Spotify. My call:
  read at most the first 200 songs, and the list says so when it stopped there.
- **Pacing** (my call; the home IP is the one YouTube may treat as a bot):
  no cap on how many songs one Add queues beyond the 200 read. The worker
  waits a few seconds between YouTube searches and downloads, and a song that
  fails for good (no match, unavailable) no longer stops the run; only a
  transient failure (network, the bot check) does, as today. A 60-song pick
  then lands over a few timer runs, not hours.
- **Reading Spotify:** builder's call. Prefer a way that needs no Spotify
  developer account (the public embed page carries a track list). If only
  Spotify's Web API works, its client id and secret live on the home worker
  only, never on the server. Either way it runs on the worker, not the server.
- The worker and the server deploy separately: an older worker that knows no
  import queue just leaves imports reading; a newer worker must cope with an
  older server (a 404 on the import claim means "none").

### The server

- `addUrl` classifies the link: a song as today (Spotify tracks included), a
  playlist into an import, refused kinds refused. Storage is checked as today
  (refused only at or over the limit, since sizes are unknown). Adding N songs
  from a pick list runs the same check once.
- Add from a pick list creates the songs in one transaction, each with its
  own `mintedId` insert (one row per insert), in the import's space.
- The Music dot is worked out per request in the `[dance]` layout beside
  `groupsNew`: any ready, not added, not dismissed import the person may pick
  in this dance. Nothing stored as unread.
- Use another YouTube link: an action on the song page, checked for access as
  Song details is; it sets `audio_url`, clears the audio (the old file goes
  once the new one lands, or at once; builder's call, minding that a clone's
  file is a hard link and unlinking one name is safe), beats, anchors and
  sample start, and sets `waiting_download`. On a group song it carries `seen`
  and is logged in History as an edit, like Song details.
- Group mutations: adding a group's songs from a pick list is logged as song
  adds, one line each, as adding a song is today. Creating, cancelling and
  dismissing an import changes no content; the builder decides whether it is
  logged or listed as exempt in `changes.spec.ts`, with the reason.
- Every new word goes in both catalogs (en, sl), with new components in
  `TRANSLATED`. Raise `PAGE_EPOCH` if a form an open page sends changes shape.

## Left to the builder

- How Spotify is read (above), the exact match scoring, the item storage.
- The pick list's layout on phone and desktop, within the shared components
  and the existing Music look.
- Whether the import row's progress line says how many songs were found.
- Keeping or deleting finished imports.

## The calls made in conversation, for the record

- Both single songs and playlists; both YouTube and Spotify playlists. (user)
- A playlist is picked song by song, yes or no. (user)
- A dot on Music while a playlist waits. (user)
- A link per song to check it, Select all, titles editable in the list and
  after download. (user)
- A Spotify song downloads right away with the best match; no list of
  matches; fix later by pasting a YouTube link; show where the audio came
  from. (user)
- New audio goes to every copy kept in step; the others keep the old audio
  and stop sharing the count. (user)
- The mockups for every screen, and the pick list as A2 with a style per
  song. (user, 2026-11-08)
- Everything marked "My call" above is the designer's, for the user to check.
