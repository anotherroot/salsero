# Slovenian: the app in two languages

Status: design, 2026-11-07. Decided with the user in conversation; the
calls marked **(Claude's call)** were handed over and may be revised.

## Why

The user teaches a salsa class and wants to give the app to it next week.
Many in the class are older ladies who do not read English easily. They will
use the app at the level **Follow my class** (spec
`2026-11-05-levels-design.md`): Today, the class's lessons, the exercise
page, the log popup, comments, Settings. Success: a lady opens the user's
invite link or QR code and everything, from the first page on, is in
Slovenian, without her choosing or understanding anything in English.

## Goals

- The whole app exists in two languages, English and Slovenian, both
  dances, every screen: pages, sheets, toasts, refusals, error pages, the
  admin page, the Android app's own native text.
- Each account has its own language. English stays the default.
- The admin picks the language on the invite. The invite link and its QR
  code open Join in that language, and the account is created with it.
- Settings has a language switch, at the top, for anyone to change it.
- Slovenian is correct Slovenian, not word-for-word English: grammar,
  plurals, dates, numbers (below).

## Non-goals

- Detecting the language (browser, phone). Later, not now.
- Translating what people write: lesson, figure, routine and position
  names, notes, comments, song titles. They stay as written.
- The count. It is Spanish (uno, dos …) and stays Spanish in both languages.
  The spoken figure names (`speechSynthesis`) are left as they are.
- A third language. The design should not make one hard, but nothing is
  built for it (no language list UI beyond two choices).
- The design kit (`docs/superpowers/design-kit/`) and the dev kit gallery
  (`src/routes/dev/kit/`): dev only, English only.

## Anti-goals

- A Slovenian user meeting English on the path Follow my class walks. Any
  English there is a bug.
- Machine-translation Slovenian: wrong plurals ("5 vaje"), English date
  order, a dot for a decimal comma, mixed ti/vi.
- Slowing the app or making the server keep a per-request global: the
  server renders requests concurrently, so the language must never live in
  a module-level variable on the server.

## The language

- **Register: vikanje** in sentences ("Vnesite kodo razreda", "Ste
  prepričani?"); short imperatives on buttons as is usual ("Shrani",
  "Prekliči", "Dodaj vajo"). Decided with the user.
- **Plurals:** Slovenian has four forms: 1 vaja, 2 vaji, 3–4 vaje, 5+ vaj
  (and 101 like 1, 102 like 2 …). `Intl.PluralRules('sl')` gives the
  category (`one`, `two`, `few`, `other`). Today's `plural(n, one, many)` in
  `src/lib/format.ts` (55 call sites) cannot express it.
- **Gender:** Slovenian past tense agrees with the person ("Ana je uredila",
  "Tilen je uredil"). The app does not know anyone's gender. Phrase around
  it: "Uredila: Ana" is wrong for a man, so prefer noun forms ("Sprememba ·
  Ana · pred 10 min", "Avtor: Ana") **(Claude's call)**.
- **Cases:** a name inside a sentence would need declension ("z Ano"). Same
  rule: put names after a colon or a dot, never inside a phrase that
  declines them.
- **Dates** stay built by hand (`src/lib/format.ts`, the CLAUDE.md rule; no
  `toLocaleDateString`). Slovenian forms: "tor, 22. sep.", "22. sep. 2026",
  weekday names "ponedeljek … nedelja" where the English says "Sunday",
  "danes", "včeraj", "jutri", "pred 5 min", "čez 3 dni" **(exact
  abbreviations: Claude's call)**.
- **Numbers:** decimal comma ("0,25×", "1,5 s", "1,2 GB"). Thousands are
  rare; a space if needed. This is display only: the log popup's fields
  (minutes, reps) are whole numbers, so typing is unaffected; any field that
  does take a decimal accepts both "1,5" and "1.5" on the server
  **(Claude's call)**.
- **Glossary** **(Claude's call, to be reviewed with the user: a task is in
  the user's notes)**. One block at the top of the Slovenian catalog, so the
  review changes one place:

  | English (app) | Slovenian |
  |---|---|
  | Today | Danes |
  | Moves (tab) | Figure |
  | a move | figura |
  | a figure (a version of a move) | različica |
  | Routine | kombinacija |
  | Drill, exercise | vaja |
  | Lesson | lekcija |
  | Group | skupina |
  | class (Follow my class, My class) | tečaj |
  | Music | Glasba |
  | Song | skladba |
  | Position | položaj |
  | Hold | drža |
  | Section (of a video) | odsek |
  | Section (of a song: Intro, Mambo …) | del (Uvod, Kitica, Coro, Montuno, Mambo, Break, Zaključek) |
  | Count off (a song's section) | brez štetja |
  | Point (a saved moment) | točka |
  | Recording | posnetek |
  | Set (a logged practice) | vnos |
  | Practise | vadi |
  | Count, My count | štetje, moje štetje |
  | Copy, twins | kopija, dvojčka |
  | Levels: Follow my class / Practise and keep my own / Everything | Sledim svojemu tečaju / Vadim in imam svoje / Vse |
  | You (the tab: the settings, and above Follow my class the groups) | Jaz |
  | version (of the app) | različica aplikacije (always with the noun: a bare "različica" is a figure) |
  | Session (Start session) | vadba (Začni vadbo) |
  | Paused (an exercise) | na premoru |
  | Not today | Ne danes |
  | Done (the button, a day's entry) | Opravljeno; an entry is a vnos, never a "set" |
  | an 8-count (call every 2) | osmica (napoved na 2 osmici) |
  | Practice (the panel, practising) | vadenje (Vadi ob …); a session stays vadba |
  | Class (a lesson's day, "Class · …") | lekcija (Lekcija · tor, 3. nov.); the group is tečaj |
  | Teacher (a comment's tag) | vodja tečaja |
  | a heart (on a comment) | srček |
  | Draft (a group's lesson) | osnutek |
  | Mark point / Start section (player) | Označi točko / Začni odsek |
  | Loop, Looping (a section) | Ponavljaj, Se ponavlja |
  | Mirror, Mirrored (the picture) | Zrcali, Zrcaljeno |
  | Full video / Lesson video | Cel video / Video lekcije (the default title: Videoposnetek) |
  | a take (My count), a bar (of counts) | posnetek, takt (Takt 2 od 4) |
  | Storage (Settings), the admin | prostor, skrbnik (the admin's section: Skrbništvo) |
  | Paired phones | Povezani telefoni (lines as nouns: "Povezava: …") |
  | a count (a figure's length) | doba ("8 dob"; the spoken count stays štetje) |
  | slot (in a routine) | mesto |
  | break (a routine's) | prekinitev (a timing break: časovna prekinitev) |
  | link | povezava |
  | owner / editor / member (a group's) | Vodja / Lahko ureja / Lahko bere |
  | does not loop (a routine) | se ne sklene |
  | Notes (a figure's, a lesson's) | opombe |
  | Map (positions) | Zemljevid |
  | Walk (the map, to a routine) | sprehod (Sprehod od tu) |
  | Sync (copies) | Uskladi |
  | Keep in step | Samodejno usklajevanje |
  | Drop my copy | Opusti svojo kopijo |
  | Detach | Odklopi |
  | Unlink (a link, on a row) | Odveži (in a sentence or a label: Odstrani povezavo: …) |
  | Take (a field, a recording) | Prevzemi |
  | Update mine | Posodobi svojo |
  | Make it mine | Naredi svojo kopijo |
  | Versions (the list) / Your version | Kopije / Vaša kopija |
  | Twins (the chip) | Dvojčka |
  | the reminder (Android's channel) | Opomnik za vadenje |

  Where a word in the table reads badly in a sentence, the builder may pick
  another and add it to the table.

## Where the language lives

- **`users.locale`**, `'en' | 'sl'`, nullable, null meaning English. Added
  with `ALTER TABLE … ADD COLUMN` only (CLAUDE.md: never a CHECK on an
  existing table); checked in its setter. Carried on `locals.user` like
  `level`, so no load asks the database again.
- **`invites.locale`**, same shape. The admin page's invite form gets an
  EN / SLO choice; the made link (and its QR) is unchanged in form, the
  invite row carries the language. Join reads it and draws in it; the new
  account is created with it **(Claude's call: on the row, not in the URL, so
  a link cannot be edited into another language and the QR stays short)**.
- **A cookie** remembering the last language on this browser, set on Join,
  on sign-in and on the Settings switch. It only decides pages drawn before
  anyone is signed in: the login page, an error page, `/g/<code>` when
  signed out. Without it they follow the browser's `Accept-Language` (a
  first tag of `sl` or `en` by q order: a Slovenian phone sends `sl-SI`), then
  English (`requestLocale`, `src/lib/i18n/locale.ts`).
- **Signed-in pages** are in `locals.user.locale`, never the cookie.
- **The admin page can set a person's language** too, beside their limits
  **(Claude's call)**: an invite sent in the wrong language, or an account
  made before this, would otherwise reach Settings only through English
  screens. It ships in step 1.
- **Changing it in Settings** reloads the page (a full load), so nothing
  needs to react to a language change live **(Claude's call)**.
- **`<html lang>`** follows the language (`app.html` is `lang="en"` today).
- **A device token request** (`/api/` from the Android app) has a user, so
  it has their language.

## How the words are organised (Claude's call)

The app has no i18n today: English is inline in ~230 components and in the
PURE word modules (`words.ts`, `view.ts`, `page.ts` … about 2,700 lines),
which are called from components and from server loads and actions. The
choice:

- **Typed TypeScript catalogs, no library.** English is the source
  (`src/lib/i18n/en.ts`); Slovenian (`sl.ts`) is typed against it, so a
  missing key fails `svelte-check`. Entries may be functions, which is what
  Slovenian needs (plurals, a day that is "danes" or a date, a phrase that
  depends on a count). This fits the codebase's PURE word modules better
  than a message-format file, and adds no dependency.
- **The current language on the server** comes from per-request storage
  (`AsyncLocalStorage`, set in `hooks.server.ts` around `resolve`), never a
  module variable. In the browser it is set once by the root layout from
  the page data. One function reads it on either side.
- **PURE modules stay PURE.** They either take the words (or the language)
  as an argument, or import the catalog accessor, which is pure given the
  request. The builder picks per module; what must hold is that their specs
  still run without a request and default to English, so the existing
  specs keep passing as they are.
- **Server refusals** (`fail(400, { message })`, API error bodies the page
  shows) are words like any other: in the request user's language.
- **Text the app writes into the database** for a person (Templates' position
  names, a default name like a new copy's suffix if it has words) is
  written in that person's language at the time. Text composed at read time
  (History lines from stored verbs) is drawn in the reader's.
- **A guard against new English.** If it is cheap, a spec that fails when a
  component under the Follow my class path gains a bare English string
  (in the spirit of `class-rules.spec.ts`). The builder decides whether it
  is cheap enough.

## The Android app

Its own native text is short: the reminder ("1 exercise due"), the upload
and download notifications, toasts ("Phone paired", "Couldn't read that
video."), the update screens. It follows the **account's** language, not the
phone's **(Claude's call: the user picks it on the invite; most of the
class's phones will be in Slovenian anyway, so the two rarely disagree)**.
How the app learns it is left to the builder (a field in an `/api/` answer
it already fetches, such as the settings or Today's due list, is the
obvious place; an older app ignores the new field). This needs an app
release (`scripts/release.sh`, version 1.8); until then the native text is
English. `strings.xml` and the Kotlin literals both need the two languages.

## Order of work

The user wants to give the app to the class next week, and wants all of it
translated. So the work goes in an order that makes the class's path ready
first, deployable on its own:

1. **Foundation.** The catalogs, the language on the request and in the
   browser, `users.locale`, `invites.locale`, the invite form's choice, the
   cookie, `<html lang>`, the Settings switch, the admin page's per-person
   language, plurals, dates and numbers.
2. **The Follow my class path.** Join (from the invite), the welcome and
   first run (`/welcome`, `/welcome/start`), the login page, the tab bar and
   band, Today (list, Coming up, Not today, Next N, the log popup per type,
   the four faces), My class, the simple lesson page, the exercise page, the
   full-screen video player and the inline video, comments, Settings (and
   My count if reachable at that level), Get the app, `/g/<code>`, error
   pages, the update bars, the reload bar. **Deploy here.**
3. **Everything else.** Moves (figures, moves, routines and the editor,
   positions and the map, coverage), the full lesson page, Groups and every
   group screen (History, Recently deleted, storage, clash), clones and
   twins, Music and the player, the admin page, What uses space, the
   pickers, the Link popup.
4. **The Android app**, released as 1.8. It can go any time after 1; the
   reminder text matters to the class, so the earlier the better.

Each step is `npm run check` clean on its own. Raise `PAGE_EPOCH` in a commit
that changes a form field or an API shape older open pages would send.

## Left to the builder

- Catalog layout (one file per language, or per area with an index), key
  names, and how a PURE module receives its words.
- The exact Slovenian wording everywhere, within the register, glossary and
  grammar rules above.
- Date abbreviations and the "ago" / "in" forms.
- Whether the "no new English" guard spec is worth it.
- How the Android app learns the language.
- The design spec (`2026-09-22-salsa-app-design.md`) and CLAUDE.md get a
  short note on the two languages and where the catalogs are.

## Decided while building (part 1)

- **Catalogs per area** (`src/lib/i18n/en/<area>.ts`, `sl/<area>.ts`, an
  `index.ts` each); PURE modules call `t()` inside each function, so their
  specs run in English without a request and `withLocale('sl', …)` checks the
  Slovenian. The guard against new English exists: `no-english.spec.ts`
  (`TRANSLATED`, the markup of every translated component). Part 2 replaced
  the list: the guard reads every component, a new one included, but the dev
  pages and a short `EXEMPT` list.
- **A lesson's own exercise keeps its stored English name** (`Review: <title>`,
  kept in step with the lesson's title for every member) and is drawn in the
  reader's language (`shownExercise`, `src/lib/exercises/name.ts`, in the
  Today, exercise page and Practice loads): a stored Slovenian name would stay
  Slovenian after a switch to English, and the rename keeps it for everyone.
- **The Practice player and `/device/pair` are on the Follow my class path**: a
  class routine's log popup says "Practise in player" and a class drill's
  Music says "Practise to this", and pairing is how the class gets
  the reminder. Both are in part 1.
- **The rig shoots the class**: `scripts/shots/seed.sh` seeds a class into a db
  copy, `--locale` and `--level` set the admin's language and level, and
  `pages-follow.txt` with the `follow-*` scenes is the path (README "A class").
- **Signed out, `Accept-Language` comes after the cookie**: the Android app's
  WebView has its own cookie jar and never saw Join, so its first login page
  would otherwise be English on a Slovenian phone. Signed-in pages never read it.
- **The page follows the account after sign-in**: login and Join end in a full
  page load (`loadAgreed`), and the root layout reloads a quiet page whose data
  names another language than the one it draws in (an admin changed it
  mid-session), else loads the next page whole (`needsLocaleReload`,
  `localeStale`, `src/lib/nav/fresh.ts`), so the client never keeps the login
  page's language.

## Decided while building (part 2)

- **Everything is checked, not a list.** `no-english.spec.ts` reads the markup of every
  `.svelte` under `src/lib/components` and `src/routes` (the dev gallery aside);
  `EXEMPT` names the few it skips, each with its reason. `refusals-guard.spec.ts` fails
  on an English literal in a server refusal (`fail`, `error(4xx)`, `failJson`,
  `message:`) outside the machines' routes.
- **Cases are entries of their own.** `t().nouns` holds the counted nouns in the
  nominative, number included ("3 različice"); a count after a verb or preposition
  takes its case and is its area's own four-form entry ("Dodaj 3 položaje", "v 2
  kombinacijah"). Adjectives and verbs agree with the count, or the line is rephrased
  with a colon ("Povezano: 3").
- **Object word tables** stay constants read at call time through `lazyWords`
  (`src/lib/i18n/lazy.ts`); string constants became functions.
- **Machines keep English**: the worker's queue, the media servers, `/releases`,
  `/api/app-update`, the 426; they compose with `catalogOf('en')` or
  `runInLocale('en', …)`. The stale-page refusal (409, `x-page-stale`) is in the
  reader's language and carries `stale: true`, so a page tells it from any other
  failure by the flag (or, from an older server, by its words in any language).
- **Quotes » «** around a name in Slovenian lines (History, archive questions); the
  English keeps its own.
- **The Android app's own words** are `Words.kt` (English and Slovenian, JVM-tested),
  chosen by the account's language from `/api/device/config`; the pairing link carries
  the language too, so the first "Phone paired" toast is already in it.
- **The glossary grew** (the table above): doba, mesto, prekinitev, povezava, the copy
  words (Uskladi, Samodejno usklajevanje, Opusti svojo kopijo, Odklopi, Prevzemi,
  Posodobi svojo, Naredi svojo kopijo, Kopije, Vaša kopija, Dvojčka), the roles,
  »se ne sklene«, Zemljevid, opombe and the reminder's channel.
