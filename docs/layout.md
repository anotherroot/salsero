# Code layout

Moved out of CLAUDE.md on 2026-11-08: where each module lives and what it holds. Grep this file for a module, a component or a concept before searching the tree. Keep it current when you add or move a module.

```
src/lib/day/         PURE calendar-day maths in the user's zone. `now` is an argument
src/lib/schedule/    PURE, client-safe: the Anki-style schedule (schedule.ts: `replay` an
                     exercise's sets into a gap and a due day, one review per local day,
                     `preview` what each face would set; feel.ts: the four faces and how
                     `sets.rating` reads), Today's list (today-list.ts: `dayList`, `inLine`,
                     `workOf` — rows from the START of the day, Next N, the nothing-left
                     state), the day's picks (picks.ts), Coming up (coming-up.ts: Waiting,
                     dated groups, Paused) and the words (words.ts). `now` and `tz` are
                     arguments
src/lib/levels/      PURE, client-safe: levels.ts is the level (`'follow' | 'own' | 'all'`), its
                     words, `levelShown` (null, not chosen yet, draws as `all`), `tabsFor`,
                     `simple`, `simpleLesson` (a group's lesson the person edits stays full; their own lesson is simple),
                     `simpleClass`, `autoAddOn` and the other "is this drawn" questions.
                     Components ask it, never compare level strings. first-run.ts: the
                     first run's words, refusals and where it ends (`afterJoin`, `afterSkip`)
src/lib/i18n/        the words, client-safe: `catalog.ts` (`t()`, the current language's catalog;
                     `catalogOf(l)` for one language, as machines' English and the stale refusal
                     in every language need), `en/` the source and `sl/` typed against it, one
                     file per area (admin, clones, comments, common, entry, exercise, figure,
                     format, groups, lesson, links, map, moves, nouns, picker, player,
                     positions, refusals, routine, settings, shell, songs, today, video) with an `index.ts`
                     (the glossary heads `sl/index.ts`). `nouns` is the counted nouns in the
                     nominative, number included (`t().nouns.figures(3)`: "3 figure"); a count
                     in another case is its area's own entry. `refusals` is what no area owns
                     (missing rows, error pages, chunks, file checks). `current.ts` (the current
                     language: a `withLocale` override for specs, the server's per-request
                     source, the browser's, then English; never a server module variable),
                     `locale.ts` (`'en' | 'sl'`, the `lang` cookie, `requestLocale`), `plural.ts`
                     (`slCount`, `slForm`), `number.ts` (`readDecimal`: "1,5" or "1.5" typed),
                     `lazy.ts` (`lazyWords`: an object word table kept as a constant, each key
                     a getter read at call time). `catalog.spec.ts` checks every area: the same
                     keys, no Slovenian string equal to the English (`ALLOWED_SAME`, with a
                     reason), every function leaf drawing a string (`SAMPLE_ARGS`).
                     `no-english.spec.ts` checks the markup of EVERY `.svelte` under
                     `src/lib/components` and `src/routes` (but `src/routes/dev/`) for bare
                     English (`no-english.ts`, `englishIn`); `EXEMPT` names the few it skips,
                     each with its reason. `refusals-guard.spec.ts` fails on an English literal
                     in a server refusal (`fail`, `error(4xx)`, `failJson`, `message:`) outside
                     the machines' routes
src/lib/server/i18n-request.ts  the server's language per request (`AsyncLocalStorage`):
                     `hooks.server.ts` wraps `resolve` in `runInLocale`
src/lib/server/locale.ts  `users.locale` and `invites.locale` (`setLocale`, `localeOf`,
                     `inviteLocaleOf`), the `lang` cookie, `<html lang>` (`fillLang`)
src/lib/server/invite-code.ts  an invite code's hash: a leaf, so the hook reads an
                     invite's language without loading invites.ts
src/lib/exercises/name.ts  PURE: a lesson's own exercise is stored `Review: <title>` and
                     drawn in the reader's language (`shownExercise`, in the loads)
src/lib/comments/    PURE, client-safe: view.ts is the comments' words, the 1–1000 body rule,
                     "@Name", the card's words, and the sheet's list after a post, a heart
                     or a delete. api.ts is the fetch side of the comments API
src/lib/beatgrid/    PURE beats → the dance count: gap filling, anchors, tempo factor
src/lib/scheduler/   PURE cues: grid + plan + toggles + window → what sounds when
src/lib/dances/      PURE registry: one entry per dance (styles, count patterns,
                     whether clave exists, accent colours). Client-safe
src/lib/graph/       PURE figure graph: positions → what can follow what (`meet`: an
                     empty side fits anything), the gap report (`positionCounts`: dead
                     ends, orphans, islands, unused), No position. Client-safe
src/lib/positions/   PURE: the hold's words and chips (hold.ts), the templates per dance
                     and type (templates.ts), every positions screen's words and rows
                     (view.ts), the map's layout (map.ts: name pills (the pills are the labels),
                     a force layout from a fixed start in a portrait 7:10 frame, the mark and
                     Twins lines sized for the longest language, the tray) and how the
                     page draws it (map-view.ts: type colours, what a tap lights, the arrows).
                     map-fit.ts: the view (`wholeView`, `fitView`, `clampMapView`, `viewTransform`,
                     with a `Room` that may keep a `right` inset: `deskRight`, the desktop panel
                     only while 360 px of map stay beside it, else `aside`: fits steer clear of
                     it, the map pans under it). map-sheet.ts: a tapped
                     position's sheet and the trail of steps. map-tray.ts: the tray's chips at rest.
                     walk.ts: the walk that builds a routine, position to position (immutable
                     steps, its arrows and pills, the Unsaved save's outcome). Client-safe
src/lib/schedule/comes-back.ts  PURE: a drill's Comes back (by how it went, learning, or a fixed
                     rhythm): parsing it, the one a row follows (`effectiveComesBack`) and its
                     words. `schedule.ts` holds `scheduleOf` (the setting + the sets → a
                     `DueState`) and the slower gap steps (`STEPS`)
src/lib/exercises/comes-back-view.ts  PURE: the Edit card's notes and chips for Comes back and
                     Warm-up (drawn by components/exercises/ComesBackCard.svelte and WarmupRow.svelte);
                     the words are `t().exercise.comesBack` and `t().exercise.warmup`
src/lib/server/comes-back-form.ts  reads the Edit form's Comes back and Warm-up fields (a
                     `warmupSent` marker says the Warm-up row was on the form)
src/lib/server/warmup-order.ts  the warm-ups' own order (`exercises.warmup_order`), set by dragging
src/lib/server/schedule.ts  the schedule from the database (`doneFacesOf`: the Done sheet's four gaps,
                     from `doneFaces` in `schedule/schedule.ts`): `listScheduleSets`, `scheduleStates`
                     (every live exercise, optionally as of the start of a day), `scheduleStateOf`,
                     `scheduleForShown` (the person's own entry wins). Nothing stored
src/lib/server/today-picks.ts  the daily number (`users.daily_count`, 1–30, default 5) and
                     the day's picks (`today_picks`: next, add, skip): `addPicks`, `removePick`,
                     `dayInputOf` — what `dayList`, `inLine` and Coming up need. The Today
                     layout, its `next` action and the reminder (`dueByDance`) read the same
src/lib/server/sections.ts  a routine becomes a section (spec 2026-11-12): `demoteImpact`, `demoteRoutine`, and
                     `routinesHolding` (real routines holding one at any depth); apart from
                     routines.ts because it unlinks lessons through lessons.ts.
src/lib/server/section-views.ts  what the routine editor draws for the sections and routines its
                     slots hold, opened in place (`childViews`).
src/lib/server/positions.ts  owned positions: list (by type, then name), create, edit,
                     archive, restore, Templates (`addTemplates`), "from Week 6" (`positionsFrom`)
src/lib/server/section-names.ts  the one-time boot step: an unnamed linked section or point
                     takes its oldest link's name (`nameLinkedSpots`, an `app_flags` marker);
                     a new link names one by `nameIfUnnamed` (spot-links.ts)
src/lib/server/position-form.ts  `readNewPosition`: what a New position form posts, read and
                     checked (the positions list's `create`, the lesson page's `newPosition`)
src/lib/server/positions-move.ts  the one-time boot move: the old shared positions become
                     the admin's, every other place using one gets a copy of the same
                     gene, `end_position_id` → `figure_end_positions` (an `app_flags` marker)
src/lib/server/position-links.ts  sections and points linked to positions
                     (`spot_position_links`): link, unlink (a group's to Recently deleted),
                     and what a position's page lists (its spots, linkable spots, its lessons)
src/routes/[dance]/(moves)/positions/  the list (Moves' third segment); [id] a position's page;
                     none the figures with no position; map the map, whose `routine` action makes
                     a walk into a routine (all under the `(moves)` group, below)
                     src/routes/api/positions is the figure picker's New position (JSON)
src/lib/components/positions/  the New / Edit position sheet and its fields, Templates,
                     How positions work (`HowBody`: the sheet's and the first-run pane's body),
                     a list row, a point's still and its Recordings row (`PointRow`), the position page's
                     card of three rows and their sheets (`PositionRelations`), the map and its pane (`MapPane`:
                     `PositionMap` draws the pills; `MapPanel` is the tray, a position's sheet or the walk,
                     a bottom sheet on the phone and a 320 px card floating over the map on desk, one
                     history entry; `MapTray`, `MapSheet`, `WalkSheet`, `MapInfoSheet` behind ⓘ),
                     a position page's link picker. `PositionForm` is one form, drawn in the
                     sheet or in place on the desktop, its edit mode fixed at its start
                     (`mode`, not derived)
src/lib/moves/       PURE: what the Moves lists show — figures under their move's heading, filter
                     chips, empty states, meta words, gaps, pick order; a move's page lines
                     (move-page.ts). Client-safe
                     filter.ts is the Figures list's filter (chips, search, the entered set)
                     and `mergeGroups` (a group's figures under your move of the same name).
                     mix.ts mixes a group's rows in among yours (Routines, Positions), each
                     marked with its group (`components/moves/GroupMark`, the Lessons row's too).
                     sync.ts the out-of-sync card and a row's "N copies differ" (`differ` on a row);
                     a figure row also says "N copies" (`copies`: `copyCounts`, the Versions list's).
                     segment.ts the three segments, pane.ts the empty pane's words and keeping
                     the lit row in view, routines.ts the Routines list's shape. PURE
src/lib/positions/filter.ts  PURE: the Positions list's search, chips and gaps, from the
                     unfiltered rows. pick.ts: the map's first pick from `?pick=`. Client-safe; order.ts the list's
                     order (`positionOrder`, the server's `sortPositions` too)
src/lib/nav/moves-pane.ts  PURE: which Moves list sits beside an item (`besideOf`) and which row
                     is lit (`OpenRow`: figure, move, routine, position, Coverage, No position,
                     the Map row), from the route, the path and the opener. The Figures
                     list owns a move's page and Coverage
src/lib/server/moves-lists.ts  the three Moves lists, loaded UNFILTERED by the `(moves)` layout
                     (namespaced; `depends('app:moves')`, so a change not made by a form calls
                     `invalidate('app:moves')`); filtering happens in the client (`filter.ts`).
                     `mergedMoveFigures`: one merged move's figures, as the list shows them;
                     `mergedMoveRows`: that move for its page and its figures' switcher and tabs
                     (a copy or a twin set one row, `standIn`)
src/lib/server/positions-map.ts  the map's data: layout, tray, legend, per space; each arrow's
                     figures (`figs`; a group row whose label collides says its group,
                     `fromTags`), `anyFrom` (figures with no end, per start) and `noStart`
                     (figures with no start)
src/lib/routines/    PURE routine algebra (children at any depth: `optionSlots`, `flatten`; spec 2026-11-12;
                     `routineSize` for the list; panels.ts: a panel's colour per level, `openable`,
                     the "where am I" rows), slots, breaks, whether it
                     loops, the walk on the count (`walk`, `rowEdgesIn`: each slot starts where
                     the one before leaves off, an option's length in its slot, spec 2026-11-11),
                     a slot's end (end.ts: the ends its options share, the one chosen or decided
                     by the slot below, the Where does it end? rows; `slotEndsIn`, `rowEndsIn`;
                     spec 2026-11-11 slot end),
                     the routine as the player's plan, coverage
                     (which routines can call each version), which routines use a
                     version (`routinesUsing`, coverage.ts), the picker's fitting
                     (fit.ts), the selection's rules and shape (`selectionShape`: each row's
                     piece, the runs of neighbours), the open slot's toolbar (tools.ts), the delete
                     snapshot, and the routine
                     page's wording and where a refusal shows (page.ts).
                     Client-safe
src/lib/figures/     PURE: a figure page's lines — timing, the practice line, the
                     figure switcher's steps, Move and Archive wording, the
                     delete question, the length check; the top video (`topVideo`),
                     the Recordings heading and row metas, the three rows (`relationRows`),
                     their sheets' sort and search (`sortRoutines`, `filterRows`), the page's own ⋯
                     items (`figureMenuItems`), a link row (`linkRowView`, drawn by LinkRow).
                     Client-safe. Its pieces are components/figures/ (TopVideo,
                     SectionRow, RecordingRow, RelationsCard, AddRecordingSheet)
src/lib/lessons/     PURE: the Lessons list's month groups, date tiles and counts; a lesson
                     page's lines — via-section badges, row metas, the delete and unlink
                     questions. Client-safe
src/lib/components/routines/  the routine editor: SlotList (the drag, the lifted pieces: an open slot,
                     SectionPanel (a section or routine opened in place, recursive; spec 2026-11-12),
                     WhereBar (the "where am I" bar under the band),
                     a selection, joined runs; spec 2026-11-11 routine lift), SlotCard, Seam,
                     CardToolbar (a lifted card's toolbar: the open slot's and the selection's),
                     SelectionBar (that toolbar docked when the selection is not one run),
                     lift.ts (LIFTED, RING, the dims, `pieceRound`, `faceRound`), SlotPicker,
                     LengthSheet (How long?), EndSheet (Where does it end?, spec 2026-11-11 slot end)
src/lib/components/links/AddLinkSheet.svelte  "Add a link": one link, what it found (`linkFound`),
                     a title; the lesson page's, and the figure page's to reuse
src/lib/links.ts     PURE URL parsing (YouTube-aware) and linkified notes —
                     no {@html}. Client-safe
src/lib/exercises/   PURE: the type registry (kinds.ts), practice config and
                     where a practice opens (practice.ts), a wall-clock
                     stopwatch, the run's walk (session.ts: warm-ups first, then Practice to-do, then picked;
                     run.ts: the run's URL, `parseSkip`, place and next), the hero's estimate (estimate.ts),
                     Done for today's rows, streak and lines (done-today.ts), what Today shows (today.ts: bands,
                     meta lines, hero states, past-day groups) and the type
                     tile's icon and name (tile.ts), the exercise page (exercise-page.ts), the
                     Done sheet's words and faces (done-view.ts), a day's entry (day-entry.ts:
                     old rows merged), the toast after a save (saved.svelte.ts), the
                     counted seconds (page-clock.svelte.ts: only while visible) and the desktop
                     Today pane (today-pane.ts: what opens by default, the day so far's
                     totals). log-view.ts is `lastTimeParts` only.
                     practice-api.ts is the fetch side of remembering a practice.
                     Client-safe
src/lib/hearing/     PURE hearing rounds: targets.ts (positions in the eight), judge.ts (taps against
                     the count, per eight and per part), drops.ts (Dropped in), tap-delay.ts (the
                     finger's delay, kept in this browser), round.ts (kinds, parts, CircleState,
                     FinishedDrop), spot.ts (a spot's start-overs and Skip), score.ts (0–100), verdict.ts
                     (what to work on), stack.ts (result B's dots), replay.ts (a drop's replay cues),
                     rows.ts (a judged drop as drawn: rows, states, "you N", tap marks),
                     words.ts (`targetLabel`, `posLabel`, `posName`)
src/lib/components/hearing/  the listening player's screens: ListenShell (band stage + sheet + bar),
                     ListenSetup, ClaveCard, TapPad (answers on pointerdown), TapCheck, PatternRows
                     (the target's circles), DropRun, TapAlongRun, ResultB, ListenStack, ListenReplay,
                     fade.ts (the music fading between spots),
                     FindTheOneCard (the song page's card). Page: /[dance]/songs/[id]/listen
src/lib/player/      PURE view.ts: what the Practice page shows — the dots, the band's title
                     and subtitle (`runTitle`, `runSubtitle`), the rows' previews, whether
                     there is an About (`hasDetails`), Play's state, Built-in or Yours,
                     where Back goes, the exercise page's player link, the routine page's
                     Practise (`routinePractiseHref`). Client-safe.
                     video-sound.svelte.ts: which About video has the sound (`claimSound`,
                     `releaseSound`); the run pauses for it (`pauseForVideo`), Setup stops a sample
                     sound-delay.ts: how late the player's own sound (voice, clave) reaches the ear
                     (Bluetooth ~250 ms): what the phone reports (`reportedDelayMs`, held still by
                     `steadyDelay`) plus the person's correction, kept in this browser
                     (`sound.correctionMs`); the Voice layer's Sound delay. With a song the voice and
                     clave start early (`ctxAt`); count only, `songTime()` (the HEARD position) waits
src/lib/server/run-details.ts  what the player's About shows, read-only, through access.ts:
                     a figure's timing, positions, notes, sections, videos and links;
                     a drill's; a lesson's notes, figures (`RunDetails.figures`, each with
                     its own details), videos and links (`figureDetails`, `exerciseDetails`)
                     practice-content.ts `practiceContentOf`: what an exercise page shows of
                     its target, through the person's reach
src/lib/components/player/  the player's screens: Setup, Running (the band that fills, the
                     rows), RunLayer (a full-screen layer with a history entry), RunRows,
                     DetailsBody and RunClip (About), CountChips, SongProgress, StageCount
src/lib/exercises/clock-trip.ts  PURE: the exercise page's time across a trip to the player
src/lib/picker/      PURE picker model and builders: word search, figure
                     headings, group order (model.ts), and the rows each list
                     gives the picker (build.ts); view.ts is what a row ends in, the create
                     row's lead, the body's state and the height. Client-safe
src/lib/components/picker/  Picker.svelte (the sheet, light or dark) and
                     PickerField.svelte (a form field that opens it) and
                     PickerMultiField.svelte (a form field that takes any number: a
                     figure's Starts in) and
                     PickerOpener.svelte (the full-width tonal button that opens one).
                     components/figures/PositionTags.svelte is a figure's Starts in / Ends in
src/lib/components/ui/PlayerLayer.svelte  a Sheet or Dialog as an overlay inside the
                     full-screen player (`.theme-media`), not a second top-layer dialog
src/lib/gestures/    PURE drag and swipe arithmetic, DOM-free like longpress.ts. edges.ts is
                     where a drag's auto-scroll zones are (band row and tab bar aware)
                     Client-safe
src/lib/unsaved/     what leaving would lose: fingerprint.ts and pending.ts are PURE;
                     guard.svelte.ts is the live list, `use:guarded`, and the
                     navigation guard. ui/UnsavedDialog.svelte asks the question
src/lib/server/song-links.ts  Music (spec 2026-11-05 part B): a lesson's, drill's or routine's
                     suggested songs with notes (`song_links`): `listMusic` (what a viewer may
                     play), `addMusic` (a group's draft is shared by it), `setMusicNote`,
                     `removeMusic`, `musicChoices`, `songInPlace`/`copyMusic` (copies never copy a
                     song), and Take a recording's and Sync's `musicFits`/`takeMusic`/`dropMusic`.
                     music-form.ts is the pages' three actions; components/songs/MusicSection.svelte
                     the list, and SongPickSheet.svelte the "Pick a song" popup (SongPicker's too)
src/lib/songs/source.ts  PURE: what a pasted link is (`classifyLink`: a YouTube or Spotify song,
                     a playlist or album, a spotify.link short link), `songKeyOf` ("same song").
                     song-page.ts's `sourceOf`/`sourceRows` draw "Audio from". imports.ts: a pasted
                     playlist's row in Music (To pick, Being added); pick-list.ts: the pick list's
                     state (option A2). Client-safe
src/lib/server/short-link.ts  follows a spotify.link redirect (headers only, one hop): the
                     one outbound request the server makes for Spotify
src/lib/server/song-imports.ts  a pasted playlist (`song_imports`): create, the worker's claim,
                     items and failure, retry, dismiss, Music's list, the dot (`importsWaiting`),
                     `pickItems` and Add (`addFromImport`). import-form.ts reads the posted picks.
                     `requireImportAccess` (scope.ts) guards it; `/[dance]/songs/imports/[id]` is the
                     pick list (components/songs/PickList, PickRow, ImportRow)
src/lib/server/clones/audio-reach.ts  how many copies new audio reaches (the flow's walk, no writes)
src/lib/songs/music.ts  PURE: Music's words and "Practise to this" (`practiseHref`)
src/lib/songs/       sample.ts is PURE: where a 15 s sample starts (snapped back to a 1)
                     and its fade. search.ts is PURE: the song popup's folded
                     search, Recent then A-Z (matches marked by picker/model.ts `segments`). sample-player.svelte.ts
                     is the one impure part: the single sample `<audio>`, one
                     sample at a time. library.ts is PURE: the Music tab's groups, meta,
                     badges and upload checks. song-page.ts and timeline.ts are PURE: the
                     song page's steps, tap rule and the seek bar's maths. upload.svelte.ts
                     is the one song upload in flight, outliving the sheet. Client-safe
                     sections.ts is PURE: a song's sections (stored as seconds, `placeSections`
                     snaps them to the 1s in order), the grid's rows, what comes next
                     (`aheadOf`) and the section writes. count-in.ts: the lead before a
                     counted section (the song before its first, or a count-off section):
                     quiet, counted down in the coming tempo, 5 6 7 8 faint and spoken.
                     suggest.ts: where the downbeats say
                     the 1 moves. music-start.ts: where a song starts (`musicStart`) and
                     `playFrom`, which every player calls before its first play(). listen.ts:
                     the count card's lines. song-edit.ts: Edit's words. grid-keys.ts: the
                     grid's arrow keys and when it follows. edit-act.ts: an Edit change and
                     its Undo (over `act`). Their screens are components/songs/ CountCard,
                     SectionsList, SongEdit, GridTab, EditGrid, BeatMenu, SuggestionCard,
                     SectionSheet and SongTab
src/lib/sound/       one sound at a time: one-sound.ts is PURE (who stops when something starts,
                     `quietFor`; what another app taking the sound stops; `focusWord`); page.ts
                     wires it: the root layout's `oneSoundAtATime` watches every <audio>/<video>
                     from the document; `stopsBy` (an element whose stop is not pause(): the
                     run's song, an About clip, the detached sample), `holdSound`/`soundFrom`
                     (a YouTube embed), `data-ambient` (a muted loop that never takes part);
                     the Android app's `SalsaAudio` (audio focus, android AudioFocus.kt)
src/lib/theme/       tokens.ts is the colour source (four themes); layout.css copies it
                     and a spec checks they agree. `tokens.ts` also holds `MEDIA`, copied into
                     `.theme-media` in `layout.css` (the player's palette).
                     `BAND_TRACK` and `SCRIM` are `bg-band-track` and `bg-scrim`; the scrim is also
                     written out in one `::backdrop` rule. stylesheet.spec.ts checks each theme
                     block, and that no removed alias is still used. contrast.ts is the ratio maths.
                     scheme.ts: the Settings theme (System, Light, Dark; a cookie per browser)
src/lib/icons/       icons.ts: the icon set (24 px, 2 px round strokes, filled tab
                     variants), drawn by components/ui/Icon.svelte (`stroke` for
                     the heavier checks)
src/lib/nav/         tabs.ts: the five tabs, which one a path lights, where the bar
                     shows. band.ts: the big or slim band by scroll (the slim one pins where the sheet meets it, `pinAt`; `bandProgress` is how far the big one has folded into it, drawn by `components/shell/band-collapse.ts`). pending.ts: what a tap shows
                     while data is on the way (skeleton, leaving). error-view.ts: the error
                     pages' words and where their back goes. bands.spec.ts: every page draws
                     a band (a page without one is named in the spec with its reason).
                     trail.ts: the session's trail of pages — each page's opener, kept search
                     and scroll, each tab's last page, where back and a tab tap go. PURE.
                     trail.svelte.ts wires it to the router (`syncTrail`, in the root layout)
                     and sessionStorage; shell/BackButton.svelte is the band's back that uses it
                     (only trail.svelte.ts is not PURE; tabs, band, pending, error-view, trail are).
                     chrome.svelte.ts: `claimBottom`, an edit or selection bar takes the bottom and the
                     tab bar steps aside. The tab bar shows on every screen of a dance but Practice/share;
                     pinned bars sit at `--pin-bottom` / `--pin-safe` (set by the root layout)
src/lib/nav/frame.ts  PURE: the frame of a path (`frameOf`: side, bare, card, none), an error's frame
                     (`frameOfError`, by the path asked for), the frame drawn right now (`frameNow`:
                     the page's own until the skeleton covers it, then the destination's) and
                     `PAGE_WIDTH` (the content max widths). pane.ts: PURE,
                     `listOf` (which list column a path belongs to) and `paneBack` (whether an
                     item's ‹ shows). desk.svelte.ts: the `desk` media query (from 1024 px)
src/lib/components/shell/  Side.svelte (the band-coloured side with the tabs), SheetCorner (the
                     sheet's rounded corner), BandHeader (the band row's title, subtitle, actions; its parts marked `data-band-*` for band-collapse.ts, the phone band folding into the slim one),
                     ListPane (a list column with its band) and Pane (the item beside it;
                     `pane-context.ts` tells a page it is in one), CardFrame (the centred 480 px
                     card on the band colour: sign in, Join, Welcome, Get the app, Pair, `/g/<code>`
                     and errors outside a dance)
src/lib/components/songs/MusicList.svelte  the Music list; `src/routes/[dance]/songs/+layout.*`
                     holds its load and the list/item split
scripts/shots/       the screenshot rig: a throwaway copy of a db, a frozen clock, every page of
                     `pages.txt`, `--viewport` for desktop; `diff` against a baseline (README.md)
src/lib/settings/    view.ts: PURE, the reminder rule and the paired-phone device lines
src/app.html         a script before the first paint: the theme choice → `data-theme`
                     (light/dark, told to the Android shell), and the Android app's
                     insets → `--safe-*`. Read the safe area through `--safe-*`, never
                     `env()` (class-rules.spec.ts): the app draws the page under its bars.
                     It also wraps `fetch`: every same-origin request carries the page
                     epoch (`src/lib/page-epoch.ts`), and a stale answer fires `salsa:stale`
scripts/shots/      the screenshot rig (README.md there): shots.sh/shots.py shoot pages.txt;
                     scenes.py runs a scene (a page after some clicks), ext_*.py hold each
                     plan's scenes (ext_practice.py: Practice, the player's popups)
src/routes/dev/kit/  the kit gallery: every shared component in every state, to
                     compare with the design board. Dev only (404 in a build)
docs/superpowers/design-kit/  the design board source (kit.py) the redesign was ported from; its colours are the first, brighter ones (tokens.ts is the source since the warm palette, 2026-11-07)
src/lib/sheets/idle-refresh.ts  `refreshWhenIdle()`: a pull with changes re-reads the page once no sheet,
                     unsaved form, save on its way or the player is over it (device first)
src/lib/sheets/      `whenSettled(fn)` (history.svelte.ts) runs fn after the sheets' Back has landed; with
                     `backWhenSettled(fallback, {replace})` in `nav/trail.svelte.ts` it is how a save closes
                     its sheet and goes back. stack.ts is PURE: one history entry per open Sheet behind a
                     port, so Back closes only the top one, with holds while a
                     navigation or a link click is in flight. history.svelte.ts
                     wires it to SvelteKit shallow routing; `refreshWhenSettled()` is the one way to
                     refresh after a close; `refreshIfSent` is Sheet and Dialog's own, so a form
                     sent inside one still shows once it closes. It reads the depth from
                     `history.state['sveltekit:states']`, not `page.state`,
                     because `invalidateAll` resets `page.state`. `settled(fn)` runs fn once,
                     after history has caught up with the sheets' own Back moves.
                     `gotoWhenSettled(href, opts)` is close-then-go: the caller closes its
                     sheets, and the navigation (often a replace) goes once their Back has landed
src/lib/native-picker.ts  client-safe: a mouse click opens a date or time field's picker (layout.css
                     hides the browser's picker button; a tap opens it by itself)
src/lib/fold.ts      accent and case folding, shared by the shared picker, the
                     routine picker and the song search
src/lib/video/       PURE spots.ts: spot times, labels, ±1 s and 0.1 s steps,
                     whole-section moves, the loop rule. link-steps.ts (the Link
                     popup's levels; its screens are components/links/LinkLevel.svelte,
                     one stacked level each), trim.ts (the trim
                     strip), screens.ts (the player's stack of levels and the
                     loop it implies), keys.ts, layout.ts, player-history.ts
                     (one history entry per screen, behind a port), zoom.ts
                     (pinch maths), taps.ts (double-tap) and screen-on.ts
                     (the wake lock, injected), turning.ts (the Android app
                     stands upright; the player lets it turn), caption.ts (a recording's
                     or lesson video's caption), inline.ts (what the inline
                     video's overlay shows, its time line and bands) and chrome.ts (which parts the top
                     bar shows per layout and level, the link entry's words, the
                     delete sheet's copy, the toast's icon and place, the buffering
                     spinner) are PURE too. spots-api.ts is the player's
                     fetch side of /api/video-spots. Client-safe. The player's
                     screens are src/lib/components/video/ and draw from
                     `.theme-media` (the media palette), the shared ui/Icon and
                     the builders in video/styles.ts; no palette or icons of
                     their own
worker/              Python home worker (yt-dlp, ffmpeg, Beat This!) — runs at home, not on the server
                     spotify.py reads a Spotify track or list from its embed page; match.py scores
                     YouTube results (`best`); lists.py is a read playlist
android/             the Android apps (Kotlin): one per dance as Gradle flavors, each a WebView launcher, salsa:// links, the upload
                     and reminder workers. No screens of its own. Pure parts (Links,
                     UploadPlan, Reminder, Api parsing, Words) have JVM tests. `Words.kt` is its
                     own text in English and Slovenian, by the account's language
                     (`/api/device/config`, `Prefs.locale`), never the phone's. `nix develop .#android`
src/lib/app-mode.ts  client-safe: the ?app=android cookie and the salsa:// link builders
src/lib/server/group-mode.ts  the group view: `viewOf` (a load's view: a row page by its row, a list by
                     `?in=`), `groupModeFor` (the re-check, with the group's people and faces),
                     `rowTeam`, `listInViewOf`, `groupChoices`, and `spaceOf` (a create action's
                     space, from its URL's `in`)
src/lib/server/mine-target.ts  where Mine lands from a group's row: your clone, twin, or own figure in the move
src/lib/teams/mode.ts  PURE: which paths show no group view (Today), return path, Mine's list, Work in rows. Client-safe
src/lib/teams/group-view.ts  PURE: the view's address: `VIEW_PARAM` (`in`), `viewParam`, `withView`,
                     `rowKindOf` (row routes), `viewedList`, `tabHrefIn`. Client-safe
src/lib/teams/frame-view.svelte.ts  a view the frame shows without the address: a group drill being edited
src/lib/components/shell/GroupBadge.svelte, GroupFaces.svelte, GroupCard.svelte  the group view's
                     badge, the others' faces and count, the desktop side's card
src/lib/teams/opens-api.ts  the fetch side of POST /api/opens (`reportOpen`)
src/lib/teams/open-once.ts  PURE: `openOnce`, an open reported once per item and stamp, not per data load
src/routes/[dance]/group-mode  the old switch, kept for pages opened before the group view: it lands
                     on the address with or without `in` and writes nothing. Its GET goes to Moves
src/routes/api/opens  POST: record that a lesson or song was opened (never in a load)
src/lib/server/whats-new.ts  what is new to a person in their groups, against their opens
src/lib/server/song-share.ts  share, stop sharing and restore a group song; `song_drops`
src/lib/theme/tokens.ts  also `GROUP`, the group look's dance tokens; `layout.css` copies it
                     in `[data-dance][data-group]`
src/lib/server/teams.ts  groups: make, code, join (`joinTeam`), rename, delete;
                     `membership.ts`: leave, remove, roles
src/lib/server/you.ts  `youSettingsOf`: the You tab's settings rows (`components/settings/YouSettings.svelte`,
                     saving through Settings' own actions); `/[dance]/you` is You at Follow my class
src/lib/server/levels.ts  `users.level` and `team_members.auto_add`: `levelOf`, `setLevel`,
                     `setAutoAdd`. `locals.user.level` carries the level, so a load never asks
src/lib/server/auto-add.ts  Add running by itself: `autoAddOnPublish` (in `publishLesson`),
                     `joinClass` (`joinTeam` + `autoAddOnJoin`: the newest lesson), and
                     `autoAddPending` (a published lesson that grew: run by the `GROWTH`
                     mutations listed in `auto-add.spec.ts`)
src/lib/server/join-code.ts  `joinWithCode` (a typed class code, through `joinClass`) and
                     `danceWithClass` (`/` at Follow my class prefers a dance with a class)
src/lib/server/my-class.ts  My class's list: the groups with what is new, each class's last
                     day; read by the Groups layout and, at Follow my class, the Lessons layout
src/lib/server/from-class.ts  an exercise's "From class" lesson (`fromClassOf`)
src/lib/server/comments.ts  comments on a group's lessons: list, post, heart, delete (soft),
                     restore, the card (`commentsOn`) and an exercise's lesson (`classLessonOf`).
                     Served flat: api/lessons/[id]/comments, api/comments/[id] (+ heart, restore)
src/lib/components/comments/  CommentsCard (opens the sheet), CommentsSheet, CommentItem, Composer
src/lib/sheets/keyboard.ts  PURE `keyboardInsets` and `followKeyboard`: an open Sheet sits above
                     the on-screen keyboard (`visualViewport`), not in the Android app
src/lib/server/access.ts  what a person may do with a row: `reach` (what they reach
                     through published lessons; a deleted group's members, until its purge,
                     through the lessons they added; someone who left, nothing),
                     `lessonAccess`/`figureAccess`/…, and `fileAccess`/`videoAccess`/`spotAccess`
                     for the flat routes
src/lib/server/entries.ts  per-person entries (Add, Remove, `reconcileEntries`, which runs the
                     rescue: `clones/rescue.ts`)
src/lib/server/changes.ts  `logChange`: History, one line per group mutation, in its transaction
src/lib/server/clash.ts  the clash check: `seen` against the current row
src/lib/server/trash.ts  `team_trash` (30 days, files kept) and `purgeTrash`;
                     `team-purge.ts` (`purgeTeams`) finishes deleted groups
src/lib/clones/      PURE, client-safe: a member as fields (flat.ts: keys and labels per kind),
                     the three-way compare, default picks and the next snapshot (diff.ts),
                     yours in place of theirs in a view (shadow.ts), twins folded into one
                     row (twins.ts), every clone and twin screen's words (view.ts), and Keep in
                     step: sync.ts (which changed keys may flow, by the copy's options),
                     merge.ts (Sync's N-way merge of every copy a person reads: rows, picks,
                     `mergeTargets`), step-view.ts (the notice's, the sheet's and the Versions
                     line's words) and from-tag.ts ("Basic · Sreda 17:30": where a same-named
                     copy came from, drawn, never stored)
src/lib/server/clones/  families: genes.ts (stamping, `memberIn`, `familyRows`, `accessTo`,
                     `visibleMembers`), trees.ts (`flatOf`), pairs.ts (pair snapshots, `digest`
                     for `seen`), clone.ts (the copy engine: `planClone`, `cloneInto`/`cloneTx`,
                     files linked before the write, unlinked when it throws), files.ts
                     (`CloneFiles`: hard links under new names, injected; specs pass fakes),
                     names.ts (`suffixed`), repoint.ts (a person's rows and practice from one
                     row to another). Using and leaving: rescue.ts (`rescueUsed`: what an
                     editor's change takes from a person's own rows is copied to them),
                     keep.ts (`keepFromTeam`, `keepPreview`), settle.ts (`settleFormerMembers`,
                     at boot). The actions: edit.ts (Make it mine: a reader's Edit copies the
                     group's row into their app and moves their rows and practice onto it;
                     editors' Edit edits the group's row, ruling 1), sources.ts (the source
                     tabs, Take a recording), apply.ts (`landKeys`: land chosen keys on a copy;
                     `syncFrom`), send.ts (the Versions list's members), drop.ts, detach.ts,
                     copy-to.ts, move.ts (Move to… a group), shadow.ts (the person's members
                     for views).
                     Keeping in step: sync-settings.ts (`clone_sync`, the switch and
                     options per copy; not logged), marks.ts (`clone_marks`: a hash per field of
                     what a copy held after its last save or flow; `markNow`), flow.ts (`flowFrom`:
                     what a save changed travels hop by hop through the copies that pair, visited
                     set, marks updated per hop), flow-hook.ts (`flowing` wraps a page's actions,
                     `flowAfter` for flat routes; runs after the commit and never fails the save;
                     its spec lists every save path), sync.ts (`syncView`, `syncAll`: the sheet's
                     rows and the landing on every ticked copy, then the flow onward) and step.ts
                     (`stepStatus`, `outOfStep`: the notice's lines and the Moves counts, less what is on its way (`sending`), from the
                     same merge rows; `copyCounts`, a figure row's "N copies"). The routes' side: `take-form.ts`, `make-mine-form.ts`,
                     `keep-form.ts`, the page action `keep` (each item page); the sheets (SyncNotice, SyncSheet, KeepInStep) are components/clones/
src/lib/server/usable.ts  what of the groups a person may USE from their own rows (slots,
                     embeds, lesson and section links): `usableOf` (their added lessons'
                     reach, plus what their rows already point at and still read, in groups
                     they are still a member of), `ownedOrUsable`, `usableVersions`. The
                     graph a person's routines walk is `graphFor` (graph.ts)
src/lib/server/twins.ts  a person's twins: `markTwins`, `separate`, `setTwins`, `twinCandidates`,
                     `twinSets`, and the folds for pickers (`foldNamed`, `foldVersions`)
src/lib/server/integrity.ts  `ownerIntegrity` (rows whose owner is not exactly one of person or
                     group), `familyIntegrity` (a parent holding two pieces of one family) and
                     `crossRefs` (a row pointing where its owner may not: outside its group, or
                     at a group row the person does not read). Boot logs a count of each
src/lib/teams/       PURE: the Groups pages' lines (view.ts), Add (add.ts), History
                     (history.ts), Recently deleted (deleted.ts, restore-api.ts), the leave
                     sheet's and Keep's words (leave-view.ts). Client-safe
src/lib/clash/       PURE: what a clash shows and how a field merges. Client-safe
src/lib/names.ts     PURE: first names and how a person is shown. Client-safe
src/lib/server/lesson-links.ts  what reaches a lesson through its videos' sections —
                     derived, never stored; lessons.ts and spot-links.ts read it
src/lib/server/link-popup.ts  the Link popup's data and create-and-link (one
                     transaction); served by /api/video-spots/[id]/links
src/lib/server/elsewhere.ts  link from other places: what a group's pickers find in your
                     own app and other groups (`findElsewhere`, GET /api/elsewhere; `move`: names
                     only, for New figure's Move field), who may (`elsewhereGroup`), what stays
                     behind (`staysBehind`)
src/lib/server/link-elsewhere.ts  Copy and link: `copyTo` with the link as its `after`
                     hook (`copyAndLink`, `restoreAndLink`, lesson and spot linkers, `useOnly`
                     for the field pickers' Copy and use, the request parser); copy-link-form.ts
                     runs it with real files (?/copyLink, /api/video-spots/[id]/copy-link,
                     POST /api/elsewhere/copy)
src/lib/picker/elsewhere.ts  PURE: the places found as picker groups (`elsewhereGroups`);
                     elsewhere-search.svelte.ts the debounced search; elsewhere-api.ts its fetch
                     and Copy and use (`copyToUse`)
src/lib/clones/copy-here.ts  PURE: the Copy and link card's words (components/links/CopyHereCard)
src/lib/app-update/  agent.ts (user agent / `x-app-version` parsing; `APP_HEADER` x-salsa-app, the page's own
                     word for its app, sent by app.html's fetch wrapper because the Android service
                     worker's requests carry no app in their user agent; `current.json`, none /
                     available / required (`updateState`), the device from the user agent
                     (`deviceOf`)), view.ts (the bridge's messages, the Update button's words,
                     when Update needed takes the page: `updateNeededNow`), get-app.ts (the
                     /app page's cards, where a new account lands). All PURE, client-safe.
                     Drawn by components/system/AppUpdateBar.svelte (Today's "Update
                     available"), UpdateButton.svelte (the `salsaUpdate` bridge, or a link to
                     the file or Google Play) and UpdateNeeded.svelte (the full-screen block)
src/lib/build-info.ts  SITE_VERSION (commits behind the build, `__SITE_VERSION__` from
                     vite.config.ts) and SITE_BUILT_AT (SvelteKit's version name): Settings → About,
                     `/health`, the end of deploy.sh (`scripts/live-versions.mjs`)
src/lib/page-epoch.ts  PAGE_EPOCH: raised when older open pages would send what the server no
                     longer takes; they reload instead of failing
src/lib/nav/fresh.ts  PURE: whether a navigation may become a full load after a deploy, and
                     whether the page may reload by itself (`mayReloadNow`). fresh.svelte.ts is
                     the reload-hold counter (`holdReload`, `holdReloadWhile`: an upload, a
                     run). shell/ReloadBar.svelte is "New version · Reload" and "This page is
                     out of date"
src/lib/nav/dropped.ts  PURE: a navigation SvelteKit dropped for a refresh that started while it
                     loaded (it stays under way for good, the skeleton over the old page); the
                     root layout watches `navigating`, goes again, and loads whole after 2 tries
src/lib/motion/anchor.ts  `keepInPlace`: the card under the finger stays put on screen across a
                     layout change (routine lift, spec 2026-11-11: open, select, ×)
src/lib/motion/pull-refresh.ts  PURE: pull down to refresh (device first, look C): `pullDistance`,
                     `mayStart`, `doneWord`, the numbers; `components/ui/PullRefresh.svelte` draws
                     it under `Screen` (prop `pull`)
src/lib/sync/sync-button.ts  PURE: Sync now pressed (last-synced): `runSyncButton` (phases idle,
                     syncing, done, offline); `offline/sync-button.svelte.ts` holds the shared
                     state; `components/sync/SyncNowRow.svelte` (phone Settings, look A) and
                     `components/shell/SideSync.svelte` (desktop side, look E) draw it
src/lib/motion/       page changes (round 2, spec 2026-11-10-page-transitions): page-move.ts PURE
                     (where the card's edge is, where it waits, which move a navigation gets,
                     PAGE_MOVE's values) and page-move.svelte.ts (the runtime, wired once by the
                     root layout: lifts the Screen's <main>, holds it, lands it in afterNavigate;
                     `settledIn`, `goBack`, `stepInPage`). components/shell/PageWait.svelte (the
                     dots, phone), DeskWait.svelte (the desktop's Go back), StillTrying.svelte (the
                     line both draw).
                     motion round 1 (spec 2026-11-10-motion-round-1). motion.ts: the vocabulary (MS
                     150/260/380, ARRIVE, SETTLE, LEAVE; layout.css has the same as --motion-*
                     and --ease-*) and `play()`, still under reduced motion. flip.ts PURE: a
                     keyed list's change as moves (`flipPlan`), and `kept`, what a list with an
                     id last showed. flip.svelte.ts `flipList`: rows (`data-flip`) slide into
                     place, leave as ghosts, fade in; components/ui/FlipList.svelte wraps a
                     list inside an {#each}. ghost.ts: a copy on <body> that outlives its
                     component (`ghost`), a sheet leaving (`sheetLeave`). landing.ts PURE: when
                     Today plays what changed while hidden (the Done landing). beat-pulse.ts:
                     the count's push on the beat (StageCount, RunLayer); the rules are
                     src/lib/player/beat-motion.ts (PURE)
src/lib/server/releases.ts  reads $DATA_DIR/releases/<dance>/current.json (cached by mtime) and
                     the APKs; app-seen.ts which app version each device last showed (table
                     `app_installs`); app-gate.ts which native API requests (`x-app-version`, never the
                     WebView's own calls) from a too-old app get a 426;
                     public-paths.ts PUBLIC_PATHS plus the update check and published APKs
src/routes/app/      the Get the app page; src/routes/releases/[dance]/ serves APKs;
                     src/routes/api/app-update/[dance]/ is the check (404 until published)
src/lib/server/devices.ts  device tokens (hash only), the app's settings, dueByDance
src/lib/server/undo-hold.ts  what Undo needs, held 60 s in memory (a removed paired phone, a
                     deleted voice take); a take's wav is unlinked when its hold expires
src/lib/server/request-user.ts  where a device token may sign in: /api/ only
src/lib/server/csrf.ts  PURE: the hook's form check (kit's own is off, vite.config.ts), `routedPath`
                     (the path kit routes on) and SELF_AUTHED_PATHS (the AI connector's endpoints:
                     no session, no login or host redirect)
src/lib/mcp/         PURE: the MCP protocol by hand (protocol.ts, http.ts: stateless, JSON only);
                     sdk-compat.spec.ts drives it with the official client (a devDependency)
src/lib/server/oauth/  the AI connector's sign-in: discovery (metadata.ts), clients from any origin
                     (client.ts, fetch-client.ts through safe-fetch.ts, the SSRF guard; register.ts,
                     RFC 7591), PKCE, the consent checks (authorize.ts), the token store (store.ts,
                     hashes only), in-memory rate limits (limits.ts)
src/lib/server/mcp/  the connector's tools: view.ts (what the person may read = `syncScope`),
                     read.ts (search, list, get_*, list_groups, vocabulary), args.ts, host.ts, modules.ts
src/routes/mcp/, src/routes/oauth/{authorize,token,register}/, src/routes/.well-known/oauth-*/
                     the connector's endpoints; /oauth/authorize is the consent page
src/lib/server/ai-queue/  the AI's queue of actions (plan 2): store.ts (propose, change, withdraw,
                     move, groups, queueOf, pendingCount), kinds/ (one object per kind of change:
                     parse, prepare, run, undo through the form's own data function; all.ts registers
                     them), reach.ts (what the person may edit: `editable`, `teamSpaceFor`), refs.ts
                     ({"ref": action}), run.ts (runActions, drop, toggle, undo), view.ts (the page's cards)
src/lib/ai-queue/diff.ts  PURE: the word diff a card shows
src/lib/server/mcp/queue.ts  the AI's tools for its queue (they write only ai_* tables)
src/lib/server/mcp/video.ts  the video sections experiment (plan 3): videos, video_timeline (frames as
                     images, the sound as audio; the only write is the video's ai_timelines row)
src/lib/server/ai-timelines/  a video made ready for the AI: store.ts (ask, claim, fail, finish, the
                     30-day sweep run by the hourly purge), piece.ts (a minute: frames + sound, checked),
                     files.ts ($DATA_DIR/timelines/<id>/<k>.json, never counted as storage)
src/lib/server/worker-seen.ts  when the home worker last called (in memory: online, offline, unknown)
src/routes/api/worker/timelines/  the worker's side: claim, source (the video), pieces/[k], done, fail
src/lib/ai-queue/measure.ts  PURE: the AI's sections against the person's (pairs, missed, extra);
                     scripts/ai-sections/measure.ts runs it on a backup copy
src/routes/[dance]/suggestions/  the Suggestions page; components/suggestions/ its card, diff,
                     section preview and the row on You
src/lib/server/storage.ts  what a person uses (computed from size columns, never stored), `roomFor`
                     (refuses at or over the limit), and `listStorageItems` for What uses space
src/lib/server/invites.ts  one-time invites into one dance, and joining with one
src/lib/dances/hosts.ts  PURE: which host serves which dance (`parseDanceHosts`, `hostDance`, `hostOf`),
                     the request's dance (`requestDance`), the hook's host redirects
                     (`hostRedirect`, `/logout` always passes) and an invite's link (`inviteLink`). Client-safe. `src/lib/server/hosts.ts` reads `DANCE_HOSTS`
                     (`danceHosts`, `requestDanceOf`)
src/lib/server/dance-split.ts  `splitAccounts`, at boot before the admin: places every account in
                     one dance; one that held both keeps salsa and its bachata half moves to a
                     new account. `danceIntegrity` (integrity.ts) reports what is on the wrong side
src/routes/admin/    the admin page of one dance: testers' feedback (Done / Open again), its people,
                     limits, invites, requests for more space (`adminReaches` before every change)
src/routes/join/     Join: a person creates their account from an invite link (public)
src/routes/[dance]/(moves)/  one route group, one layout: the band with the Figures / Routines /
                     Positions switch, the three lists in a 360 column beside the open item,
                     `(moves)/+layout.svelte` and `+layout.server.ts`; routes figures, moves/[id]
                     (a move's page: its figures, rename, New figure), coverage, routines and
                     positions (above) live in it. `components/ui/PaneColumns.svelte` is a
                     pane's two columns (`two:` on its `cols` container, not on the pane),
                     `components/figures/FigureTabs.svelte` the figure's tabs on desk, `components/shell/PaneHeading.svelte`
                     a pane's heading row; there is
                     no MovesScreen (the layout and the lists replace it)
src/routes/[dance]/(today)/  one route group, one layout: the list (Start, the run (`?run=1&skip=`), Done for today (`(today)/done`), Due, Done today,
                     Not yet due, Inactive; `components/today/TodayList.svelte`) beside the open
                     exercise, `(today)/+layout.svelte` and `+layout.server.ts` (list data under a
                     namespace); the list route `+page.*` and `exercises/[id]` (+ `practice`) live in
                     it. On desk, arriving at Today `replaceState`s to the first due exercise's URL
                     (R11); the phone keeps the list and the exercise page. `components/today/today-context.ts` shares the
                     layout's pane state with its pages (`setTodayPane`/`todayPane`),
                     `components/today/TodayPaneSkeleton.svelte` is the pane while data is on the
                     way. `lib/exercises/today-pane.ts` is PURE: what opens by default (`defaultOpen`),
                     and the day's totals. The pane is the exercise page's own two columns with
                     the pinned `DoneBar`; there is no log popup, `LogShell` or `frame`. The run is
                     `?run=1&skip=` on an exercise page, nothing stored (`TodayPane.run`: place, next,
                     Skip, the player's `from`; `TodayPane.autoOpened`: on the desktop the
                     exercise Today opened by itself, whose clock waits for a tap: `page-clock.svelte.ts`
                     takes `{ idle: true }` and `start()`); the Done sheet and band take `place`/`next`
                     from `done-view.ts`. A past day (`?day=`) is the list route's own page:
                     `components/today/PastDay.svelte` (one row per exercise, also the desktop's day so
                     far), `DayTiles.svelte` (its tiles and Done for today's), `DayStrip.svelte` (‹ the day ›
                     and Today under the title; the slim band's buttons are `Screen`'s `slimRight`) and
                     `CalendarSheet.svelte`; `lib/exercises/calendar.ts` is PURE: exercises per day
                     (`dayCounts`) and the months (`calendarMonths`).
                     `rowButton(kind)` in `ui/styles.ts`
                     is the pinned bar's two equal buttons
src/routes/[dance]/groups/**  the Groups tab: `+layout.svelte` and `+layout.server.ts` hold the list
                     (`components/teams/GroupList.svelte`, in a 360 column on desk; no groups,
                     no column) beside the open group; make and join, a group's page (two
                     columns, `PaneColumns` `'7:5'` with `lead`: the group's space), its people,
                     storage, History and Recently deleted. `teams/view.ts` also has `PICK_GROUP`
                     and `codeAction` (Copy link on desk, Share on the phone; `COPY_FAILED`)
src/routes/[dance]/lessons/  the same for Lessons: `+layout.svelte` and `+layout.server.ts` hold
                     `components/lessons/LessonList.svelte` beside the open lesson (a lesson
                     page is two columns; no lessons, no column; `lessons/list.ts` has
                     `pickLesson()`, `isOpenLesson`, `groupVideosSubtitle`). The New lesson sheet
                     stays mounted in the layout. `components/shell/reveal.ts`: `revealLit` and
                     `revealPicked`, scroll the lit or the new row into view in a list column
src/routes/g/[code]  a group code's link: Join `<name>`? (needs an account already)
src/routes/welcome/  asks once for a name: a person whose account was made before names
                     (hooks.server.ts sends anyone signed in without one here)
src/routes/welcome/start  the first run: three slides, How much app?, Join your class
                     (`?step=join`). hooks.server.ts sends anyone signed in with no level here
                     (`needsLevel`, after the name). Drawn in `CardFrame`
src/lib/components/levels/LevelCards.svelte  the three levels as radio cards (first run, Settings).
                     components/teams/ClassList, MyClass, ClassCodeField are My class;
                     components/lessons/SimpleLesson the simple lesson page
src/routes/api/trash/[id]  restore a group's trashed row; src/routes/api/archived is the
                     POST behind a picker's "Archived by … · Restore" (a group's figure,
                     routine or drill); it lists nothing
src/routes/settings/storage/  What uses space: the person's files biggest first, Delete, Ask for more
src/lib/admin-view.ts  PURE: the admin page's wording and limit presets. Client-safe;
                     `feedbackView`: one feedback message as the admin's lines
src/lib/feedback/    PURE, client-safe: device.ts reads a user agent as "Android 14 · Chrome 131";
                     trail.ts keeps this tab's last pages and script errors (the root layout
                     records them) for Send feedback
src/lib/server/feedback.ts  Send feedback: `readFeedback` (the form; what the page adds is cut,
                     never refused), `sendFeedback`, `feedbackFor` (the admin's open and last done),
                     `markFeedback`, `openFeedbackCount` (the Admin row on Settings). Table
                     `feedback`, never synced, never deleted; posted to `/settings?/feedback` (network)
src/lib/components/feedback/  FeedbackRow (the row on You and Settings), FeedbackSheet (the sheet: the
                     screenshot tile, the text box, Send), ShotOffer (the card after an Android
                     screenshot, mounted in the root layout)
src/lib/feedback/shot.ts, shrink.ts, offer.svelte.ts  the screenshot: JPEG data URLs, a picked
                     picture redrawn (canvas), the app's `SalsaShot` bridge; android/…/Shot.kt and
                     WebShell `captureShot` take it (PixelCopy) after Android 14's screenshot callback
src/routes/admin/feedback/[id]/shot/  a feedback screenshot, the admin of its dance only
src/lib/storage-view.ts  PURE: the storage lines and the usage bar. Client-safe
src/lib/upload-error.ts  PURE: the message in a failed upload's body, or a fallback. Client-safe
src/lib/scheduler/attach.ts  the impure player: AudioContext, clips, the
                     25 ms look-ahead loop, a routine's steps (`onStep`, `jumpTo`), the wake lock
src/lib/voice/       wav.ts and slice.ts are PURE (WAV bytes, where a recorded
                     half-bar starts); capture.ts owns the mic and the click.
                     grid.ts (tempo states, takes, the Settings summary), recording.ts
                     (the count dots and bar progress), back.ts (where My count goes
                     back to: `voiceBack`/`myCountHref`) are PURE too
static/worklets/     recorder.js — the AudioWorklet that captures the mic.
                     Served, not bundled: addModule() takes a URL
src/lib/*.ts         client-safe: labels, frequency presets, limits, format (dates, `plural`), row types.
                     act.ts posts a page action without a form (`act`; `sendAt` only posts, a redirect not followed); act-toast.ts is the refusal
                     message and the "removed · Undo" toast Settings and My count share.
                     focus.ts: where focus goes after a one-tap removal (`focusAfterRemoval`)
src/lib/components/exercises/  the exercise page's parts: `DoneSheet` (+ `done-submit.ts`), `SavedToast`, `DoneBar`,
                     `HistoryDaySheet`, `DrillRecordings`, `kinds/<type>/Content.svelte` and `Practice.svelte`
                     (`contentFor`/`practiceFor`)
src/lib/components/  ui/ shell/ today/ figures/ lessons/ songs/ player/
                     exercises/ links/ routines/ (the slot cards, the picker, `LengthSheet`: How long?) moves/ (the three Moves lists, `moves-context.ts`, the tiles) system/
                     (error, offline, choice sheet, status block, lead tile) clones/ (`Versions`:
                     the whose-version row and its list; `ItemMenu`: a family page's ⋯ with the
                     copy actions; the clone and twin sheets) teams/ (Add, the code, Leave).
                     ui/MenuSheet.svelte is a page's ⋯ and its small sheet (`MenuItem`,
                     `orderMenu`, `menuLabel` in `src/lib/menu.ts`, PURE)
                     ui/styles.ts holds the class builders: `button(kind, size, full)`,
                     `iconButton(variant, tone)`, `FIELD`/`TEXTAREA`/`SELECT` and their
                     `_INVALID` twins, `CHIP`, `GROUP` and `CLIP` (`focus-inset`: a card that
                     clips), and `swap()`, which throws in dev and tests when the class token it replaces is missing
                     ui/SearchField.svelte is the search pill, ui/FieldError.svelte the
                     line under a refused field
src/lib/server/      db (SQLite via Drizzle), auth, data access, form parsing, files
src/lib/server/db/ids.ts  ids from slots: `mintedId`, `mintId`, `setIdSlot` (`id_marks`, its
                     triggers in migration 0038)
src/lib/server/server-clock.ts  `serverNow()`: the one clock server code reads.
                     server-sources.ts is the specs' view of the server code (scans)
src/lib/sync/        PURE, client-safe, shared by the server, the device and the service worker:
                     tables.ts (`SYNCED`: table → key columns; `NEVER_SYNCED`; every schema table
                     in exactly one), triggers.ts (`triggerSql`: the change-log triggers;
                     `scripts/sync-triggers.ts <table>…` writes them for a NEW custom migration
                     when a table is newly synced; 0042 is frozen), digest.ts (`keyString`,
                     `digestInput`), wire.ts (the pull's request and answer), schema-tag.ts (`SCHEMA_TAG`).
                     Phase 3: owners.ts (`OWNERS`, `ownerOf`: a captured row's person or group),
                     outbox.ts (the push's wire types, `foldCaptured`, `mintedIn`, `dependsOn`/`heldBy`,
                     `queuedMarks`, `entryLabel`, `bodyFields`; PUSH_BATCH, PUSH_RETRY_MS, OUTBOX_HEADER),
                     status.ts (`syncStatus`, `bandStatus`, the 2 s grace, `waitingMark`), strip.ts
                     (`stripState`, `nextMarks`: the offline strip's words by the clock), view.ts (the status's,
                     a label's and a reason's words; Discard's and Sign out's questions), resolve.ts
                     (`resendFields`: a clash's Mine sent again)
src/lib/server/sync/  log.ts (`change_log`: head, oldest, `changedSince`, the 30-day prune in
                     `startTrashPurge`), extras.ts (`serverExtras`: what only the server knows, sent
                     with every pull for the layouts the device draws: the Music dot, the AI count,
                     a connected AI app, the APK release, To pick, a group's trash bytes, lessons'
                     last edits; device first), scope.ts (`syncScope`: every row a person may read,
                     redacted — other people's users rows, a group's code, deleted comments),
                     pull.ts (`pull`: changes since the cursor, whole tables when a key-set digest
                     differs), test-world.ts (specs only). Served by POST /api/sync/pull (cookie
                     session only). Phase 3: slots.ts (`slotFor`: a device's id slot, `device_slots`),
                     landed.ts (`sync_landed`: a resent entry is a no-op), gate.ts (`writeGate`:
                     writes shared, a replay alone; `gatedRequest`), merge.ts (per-field later-wins
                     on own rows, child sets restored), outcome.ts (a replayed response → landed,
                     refused and why), replay.ts (`replayRequest`, `replayEntry`, `push`: one
                     transaction per entry), test-replay.ts (specs). Served by POST /api/sync/push
src/lib/server/replay-context.ts  the replay's AsyncLocalStorage: `replaying()` (made-at for
                     `serverNow()`, the device's minted ids for `mintId`, deferred flows),
                     `runReplaying`, `replayName` (a taken name gets a suffix on replay)
src/lib/server/device-runtime.ts  `deviceRuntime()`: set only inside the device worker; the hook
                     then takes the user from the copy (`deviceUser`) and bootstrap does nothing;
                     `changesOnWay()`: the device has changes waiting or not yet pulled back
src/lib/offline/     client-safe: routes.ts (which GETs the device answers: page data but
                     `NETWORK_PAGES`, `DEVICE_ENDPOINTS`; every GET endpoint classified),
                     sw-route.ts (PURE: what the service worker does with a request, the 4 s
                     timeout, which caches go, a page's unpulled save), needs-connection.ts (the
                     offline answers), sw-update.ts (`newBuildReady`: a new build's service worker
                     fetched once the page sees the build, and a reload for it waits until that
                     worker took over, so one reload gets it), protocol.ts (the messages), device.svelte.ts (the page side:
                     registers the SW, starts the device worker, relays, pulls; `noteSaved` after
                     an upload; `setPerson`), person.ts (PURE: `pagePerson`, who the server says
                     is signed in, from the root layout's `drawnBy`; the device wipes for anyone
                     else), background-write.ts (opens and practice memory: never offline).
                     Phase 3: routes.ts also classifies every write (`ACTIONS`, `ENDPOINT_WRITES`,
                     `writeClass`, `matchRoute`); device.svelte.ts holds `sync` (the outbox summary)
                     and `syncNow`, `outboxList`, `retryEntry`, `discardEntry`,
                     `unsyncedBeforeSignOut`, `forgetCopy`; relay.ts (`createRelay`: a second tab
                     reaches the device over a BroadcastChannel), connection.svelte.ts (online or
                     not), needs-connection-action.ts (`use:needsConnection`: greyed offline, a tap
                     toasts); `src/lib/epoch.ts` holds PAGE_EPOCH for the SW and the device.
                     Phase 4a: media-store.ts (`MediaStore`, OPFS `media/<kind>/`, whole files only;
                     `memoryMediaStore` for specs; `mediaOf`/`mediaPath`), media-range.ts
                     (`rangeResponse`, PURE: a file answered with Range; `FROM_HEADER`);
                     routes.ts `MEDIA_ENDPOINTS` (/audio, /count: the phone's file first)
                     Device first (2026-11-10): routes.ts `NETWORK_FIRST_PAGES` (Settings) and
                     `isNetworkFirstPage`; sw-route.ts `readPlan`, `deviceFailed`,
                     `DeviceClients.readsDeviceFirst`; poll.ts (`pollStep`: a page waiting on the
                     worker pulls, `pullNow`); server-only.spec.ts (a device-drawn load reads no
                     server-only table)
                     Phase 4b: the store also holds `lesson-videos` and `recordings` (`VIDEO_KINDS`;
                     a video's `.part` stays to resume, committed every 8 MiB), both MEDIA_ENDPOINTS;
                     network.ts (PURE: `linkOf` Wi-Fi or mobile data, `canTellWifi`, `freeOf`,
                     `isLow`, `fits`, `LOW_SPACE_BYTES`); kept-view.ts (PURE: `videoKeep`,
                     `keepWord`, `spaceLine`, `suggestions`, `lessonOnPhone`, `phoneRowLine`);
                     kept.svelte.ts (`kept`, the worker's `KeepStatus`; `changeKeep`); low-space.ts
                     (the sheet once); protocol.ts `KeepSettings`/`KeepChange`/`KeepStatus`.
                     The look: routes/settings/phone (On this phone), components/ui/KeepButton,
                     components/settings/LowSpaceCard, components/shell/LowSpaceSheet
                     Phase 4c: the store's `originals` (`ORIGINALS`, owner in the meta; never
                     listed, cleared or counted unless named; `readMedia`: a video URL reads it
                     first); where.ts (PURE: `placeOf`, `Place`), where-view.ts (`placeWord`),
                     places.svelte.ts (`livePlace`, `PhoneVideo`, `appOriginals`), uploads.svelte.ts
                     (`startUpload`, `uploadOf`), upload-original.ts (`uploadOriginal`, `fileRoute`,
                     `landOriginal`: Upload answered once on the server, Move to waits on it),
                     move-videos.ts (PURE: `splitMoveVideos`, which upload first on Move to),
                     phone-first.ts (`phoneFirst`, `isIphone`), add-phone.ts (`addMode`, `addOnPhone`,
                     `phoneFileName`), add-mode.svelte.ts (`currentAddMode`), iphone-warned.ts and
                     iphone-card.svelte.ts (the card once), delete-words.ts; $lib/upload-chunks.ts
                     (`putChunks`); $lib/devices/label.ts (`deviceLabelOf`). Server:
                     server/phone-videos.ts (phone-only rows, `attachServerCopy`, `removeServerCopy`),
                     server/chunked-upload.ts (`receiveChunk`), server/clones/phone-only.ts
                     (`leftBehind`, `deviceLabelFor`). The look: components/ui/WhereButton,
                     WhereSheet, ElsewhereFrame, PhoneAddButton, IphoneCard, IphoneWhy
                     Phase 4c part 2: app-videos.ts (`appVideosOn`/`appVideos`: the app's
                     `SalsaVideos` bridge, answers by id), app-originals.svelte.ts (`readAppOriginals`,
                     `addFromApp`, `uploadFromApp`, `letOriginalGo`). Android: VideosBridge.kt,
                     OriginalStore.kt, MediaServe.kt (`spanOf`, `sliceOf`), UploadEvents.kt
src/device/          bundled for the device worker only (vite.device.config.ts → build/client/
                     _device/<version>/, checked by scripts/check-device-build.mjs): sqlite-shim.ts
                     (better-sqlite3 over SQLite WASM, opfs-sahpool), migrate.ts (`migrateDevice`,
                     `readMeta`), apply.ts (`applyPull`, `wipeCopy`, `deviceDigests`,
                     `pullRequestOf`), pool.ts (taking over from a closing tab), core.ts (the
                     worker's logic, tested in node: `write()` device-first in one lane, `sync()`
                     pushes then pulls, a 401 keeps the copy), worker.ts (the browser wiring: a
                     push 300 ms after a write, on `online`, and every 30 s while entries wait),
                     request.ts, capture.ts (`installCapture`: the capture triggers into
                     `capture_rows`; the device-only `outbox`, `outbox_capture`), outbox.ts
                     (`recordEntry`, `toSend`, `applyResults`, `outboxSummary`, `outboxItems`,
                     `retryEntry`, `discardEntry`, `forgetPerson`), media.ts (phase 4a:
                     `wantedMedia`, the copy's songs and count takes; `syncMedia`, the store
                     brought to them after each sync; 4b: videos on Wi-Fi, while there is space,
                     resumed with Range; `mediaKeeper.restart`), keep.ts (phase 4b: `device_meta`
                     `keep`, `wantedVideos`, `spaceRows`, `keptVideos`, `keptBySpace`), node-stubs/
src/service-worker.ts  network first for reads; on a failure: navigations → the cached /shell,
                     reads → the device, writes → "Needs a connection". Phase 3: device/queued
                     writes go to the device first; reads come from the device while entries
                     wait; an update holds while older-epoch entries wait (`holdsUpdate`); the
                     outbox state survives in the `outbox-state` cache. src/routes/shell is the client-rendered
                     shell (ssr = false)
src/routes/[dance]/sync/  the Sync page (2B): Couldn't sync first (Retry or Compare, Discard),
                     then Waiting; components/sync/SyncEntry.svelte one change. The band's status:
                     components/system/SyncStatus.svelte (in BandHeader: the pills, every phone
                     header, the desktop's band row); system/OfflineStrip.svelte (offline and what
                     waits, above the bottom bars: `pinned.height` from BottomBar and VariationBar,
                     `--strip-h` lifts toasts); ui/WaitingBadge.svelte (lesson, song, link and comment
                     rows); system/NeedsConnectionNote.svelte (a menu's one note, `offlineMenu`)
scripts/offline/     serve.sh + walk.py: every page offline in a real browser, the timing, and changes made
                     offline landing once, dated, with their ids (phase 3)
src/lib/server/scope.ts  the wall at the route level: `Wall` ({ userId, dance }),
                     `wallOf(params, locals)`, `inWall(row, wall)` and the
                     `require*InWall` guards on ids, so a request only ever reaches
                     its own person's side of its own dance. `requirePositionAccess`
                     guards a position as `requireFigureAccess` guards a figure
src/lib/server/test-walls.ts  specs only: `U1_SALSA`, `U1_BACHATA`, `U2_SALSA`.
                     `[dance]/owner-wall.spec.ts` and `api/owner-wall.spec.ts`
                     act as u2 on u1's rows, area by area
src/routes/[dance]/  every page lives under its dance. Flat routes — login,
                     settings, voice, api, the media servers — are shared
src/routes/          pages + actions. api/figures/[id]/recordings and api/songs
                     take raw-body uploads; api/lessons/[id]/videos/[uploadId]
                     takes ONE CHUNK per request, as does api/worker/videos/[id]/file;
                     api/worker/* is the worker's queue (imports, then songs, then videos)
                     recordings/[file], audio/[file], count/[file] and
                     lesson-videos/[file] serve with HTTP Range
src/lib/media.ts     shared: telling a missing media file from an undecodable one
$DATA_DIR/           recordings/ audio/ count/ lesson-videos/ uploads/ — not in
                     the repo. uploads/ holds partial chunked uploads only, swept
                     at boot after 24 h. lesson-videos/ is NOT backed up: see
                     docs/deployment.md for why
static/clips/        the seven committed count/clave clips — regenerate with
                     scripts/make-clips.sh, never at build time
static/icons/        per-dance home-screen icons, committed. The manifests are
                     served FLAT (/manifest-<dance>.webmanifest) so PUBLIC_PATHS
                     stays an exact-match Set
drizzle/             generated migrations — applied at boot, shipped by deploy.sh
android/app/src/     main (shared), direct (the updater: Updater.kt, UpdateBridge.kt; downloads,
                     checks, installs) and play (no updater) — the two channels
scripts/release.sh   build, sign-check and publish an app update (see docs/deployment.md)
scripts/deploy.sh    build locally, rsync, npm ci on the box, restart, health-check
.tmux-project/       tmux_project (nixos-config): C-1…C-9 in tmux make a slot — a worktree
                     ../salsaapp-wt/<name> on its own branch, vite on a devports port at
                     wt-N-<name>.salsa.localhost, .data cloned from main's by hooks/up
scripts/make-clips.sh  one-off: Piper + ffmpeg → static/clips/. Output is committed
scripts/make-icons.sh  one-off: librsvg rasterises static/icon-salsa.svg and
                     static/icon-bachata.svg → static/icons/. Output is committed.
                     Both scripts pull their tooling from nixpkgs at run time, so the
                     flake carries neither
```

