# Hearing drills — design

2026-11-10. Branch `find-the-one`. Boards:
[results, four looks](https://claude.ai/artifact/LKHBYc9NEjWToSesUy7FoD) (dark — wrong, the
player is the band colour) and
[the rounds and where they show](https://claude.ai/artifact/WBkgBLMuE8ADXoqgLgtfou) (the
look to build from).

## Why

Hearing the music is half of dancing salsa or bachata, and the app only ever counts *for*
you. A hearing drill turns that round: the count goes quiet and you find it. "Can you find
the 1?" is also the user's favourite format for shorts.

The teacher wants the class to hear the 1, the downbeats, and when a song is son, salsa or
timba. So a teacher must be able to hand the class a hearing drill, and a person must be
able to play one on their own.

## What it is

A **hearing drill** is a fifth exercise type next to lesson, figure, drill and routine. You
listen to a song and answer, by tapping in time or by pressing a button. Afterwards you see
how close you were. It reuses the player's engine (the song's beat grid, the sound delay,
seeking, sections, the count-in) under a new screen: the **listening player**.

A round is **a kind of round** plus **what you listen for** (the target).

### Targets

A target is a set of positions in the eight, the same idea as the voice count's patterns
(`COUNT_POSITIONS` in `src/lib/scheduler/scheduler.ts`) and the clave's positions
(fractional for an "and").

| Target        | Positions         | Dances           |
| ------------- | ----------------- | ---------------- |
| Every beat    | 1 2 3 4 5 6 7 8   | all              |
| The 1         | 1                 | all              |
| 1 · 5         | 1 5               | all              |
| Downbeats     | 1 3 5 7           | all              |
| 4 · 8         | 4 8               | all (son's and bachata's tap) |
| Clave 2-3/3-2 | the clave's hits  | salsa only (`dance.clave`) |

Targets are a list in one pure module, so a new one (2 · 6 for On2, the "and" between beats,
instrument parts like the conga's open tones) is one entry. Which targets a dance offers is
the dance's (`src/lib/dances/dances.ts`), like `countPatterns`.

### Kinds of round

| Kind                      | What you do                                                                                         | Phase |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| **Tap along**             | The song from its music start (or one section), count hidden; tap the target all the way through.   | 1 |
| **Dropped in**            | Starts at a random spot, no count-in, count hidden; tap the next target beat. 10 drops a round.     | 1 |
| **Which style is this part?** | Short bits of style-marked sections from several songs, mixed; answer Salsa / Son / Timba (bachata: its styles). | 3 |
| **Follow the style**      | One whole song; keep a style button pressed on what you hear, switch when it changes.               | 3 |
| Hold the count            | The count shows for 2 or 4 eights, then fades; keep tapping.                                       | later |
| Which count?              | Music stops; which count was the last beat? (buttons 1–8)                                          | later |
| Which clave?              | Is this song 2-3 or 3-2?                                                                            | later |
| Where does it change?     | Tap when a new section starts.                                                                      | later |

## Goals

- Something to try on the phone the day after this is written: phase 1.
- One listening player for every kind of round, built on the player's engine.
- A teacher can put a hearing drill in a lesson; it reaches the class's Today like a drill.
- The score helps pick the face; the face still decides when it comes back.

## Non-goals

- Points, streaks, levels-up, leaderboards, a games tab.
- Making shorts or videos in the app.
- Live judging while you tap (no buzz, no red flash, no colour per tap). A tap only fills
  the next circle; how close it was shows when the drop ends, or at the end of a tap-along
  round (phase 1b).
- A new APK. Everything is web.

## Anti-goals (a failure even if it works)

- **Marking someone wrong because the app's grid is wrong.** Only songs whose count a person
  set (`anchors_json` not empty) can be used. Beat This!'s guess alone never grades anyone.
  Style rounds use only sections a person marked with a style; a song's untouched default
  style (`'salsa'`) never grades anyone.
- Taps that feel late or early because of the phone or headphones. Hence the tap delay check.
- Anything that feels bolted on: no new tab, no new section. It lives where exercises live.
- Copy that suggests you can learn to dance from the app alone (notes: the app is not a
  teacher replacement).

## Phases

Each phase is its own plan, built, checked and deployed before the next one is planned (my
call): the user tries phase 1 on the phone before phase 2's choices are locked in.

### Phase 1 — try it tomorrow: the listening player, from a song's page

Nothing is saved. No new type yet.

1. **Song page:** a card "Can you find the 1?" with **Try it**. Only on a song a person
   counted. On an uncounted song the card says "Set the count first to try this" and goes
   to Edit (or is absent; the builder picks whichever is simpler, as long as it never
   opens on an uncounted song).
2. **Try it** opens a small setup (a sheet, the app's `Sheet`): kind (Tap along / Dropped
   in), target (the dance's list), and for Tap along: Whole song or one section (the
   song's sections). For the clave target: 2-3 or 3-2. Then **Start**.
3. **The listening player:** its own page, e.g. `/[dance]/songs/[id]/listen?kind=…&target=…`.
   Its own page, not a mode of `/[dance]/player`, which is already busy with routines,
   exercises and Setup (my call). Look as on the board, copying the running player
   (band-colour stage, sheet below, Stop on the bottom bar):
   - the stage: the title (the round's name), the subline (song · target · drop n of 10),
     the hidden count (a dash or "?"), the song's section bar.
   - the lower half: one big tap area, "Tap on the 1" / "Tap the next 1". It reacts on
     `pointerdown` (not click), with a small press ring.
   - Stop ends the round early and shows the result for what was played.
4. **The tap delay check**, before the first tapping round on this browser (and from a
   "Check my tap delay" row in the setup): clicks on the AudioContext at ~100 BPM, tap with
   them, 16 taps; take the median of the last 12 (drop outliers beyond ±150 ms from the
   median); "you tap 70 ms after you hear it". Stored per browser like
   `sound.correctionMs` (`src/lib/player/sound-delay.ts`): every storage access wrapped.
   Skip for now = 0. Re-run any time.
5. **The result** (words on top, a strip under them; the user has not picked among the
   four looks, so this is my call and easy to swap):
   - Tap along: "N of M on the 1", average early/late, then per section of the song: on
     target / late / early / on another count (e.g. "on the 5"), and a beat strip (one row
     per eight, the counts across, each tap a dot where it landed).
   - Dropped in: "N of 10 on the 1", about how long you listened before tapping, average
     early/late; one row per drop.
   - **Again** (same settings) and **Done** (back to the song page).

### Phase 1b — a round you can see (built on phase 1, still on the song page, nothing saved)

Decided with the user on 2026-11-11 after trying phase 1, from the boards
[next look](https://claude.ai/artifact/UAj1G1fyK7gzctTioWFFF1) (a playable sketch) and
[results and replay](https://claude.ai/artifact/8mdnyjoM4p7nu2qCpmKFYr). Phase 1 is live
(deployed 2026-11-11); this changes its running screen, its drop rules, its result and adds
a replay. Phase 1's own-counts target and two-eights pattern drops (built 2026-11-11) stay.

1. **The pattern on screen.** Above the tap area, the target drawn as circles on the eight,
   to scale (the user's pick over "grouped 2 | 3"): a thin line with the counts 1–8 under
   it, one circle per target position with its name inside ("2", "3", "6&"). A drop shows
   two rows, "Eight 1" and "Eight 2". Any target looks the same (the 1 is one circle per
   row, every beat eight). A tap-along round shows one row that fills and empties every
   time all its circles are filled (my call).
2. **No feedback while tapping (the user's rule).** The next circle is larger and pulses. It
   moves only when you tap. Every tap fills the next circle in order, in the accent colour,
   with a small pop, wherever the tap really landed. No shake on a wrong tap, no circle
   marked as passed, no colours. The judging (unchanged: by time, "How a tap is judged")
   shows only when the drop ends, or on the result screen for a tap-along round.
3. **Drop rules, for every target including the 1.**
   - The music plays from the spot. No first tap within **four eights** → the same spot
     starts over.
   - From the first tap, **two eights** count (`judgeDropPattern`). The drop ends when all
     its circles are filled, or when the two eights are over, whichever is first.
   - After the first tap, **no tap for one eight plus the longest gap between two target
     beats of the pattern** (my call) while the drop is still running → the same spot
     starts over (the person stopped). The clave: 8 + 2 beats; the 1: 8 + 8, which the
     drop never reaches, so a missed second 1 is judged as missed, not restarted.
   - **↺ Reset** on the bottom bar starts the spot over any time during a drop.
   - Starting over: the pad locks, the circles slide out and come back empty, the music
     goes back to the spot's start, and the pad unlocks once it plays (as between drops,
     lighter). Each start-over is counted for the drop (its **restarts**).
   - A spot needs about **seven eights** of song after it (4 listening + 2 tapping + 1
     spare): `dropStarts`' room becomes 56 beats.
4. **Between drops.** When a drop ends: the pad locks (dimmed, a little smaller, "next spot
   coming"), the circles take their colours one after another (≈70 ms apart, each with a
   pop: green within 60 ms, amber within 150 ms, a dashed red ring missed), and the stage
   shows the drop's score for ≈1.4 s. Then the stage and the circles slide out to the left
   (≈450 ms) and the music stops; the new spot slides in from the right with empty
   circles, its music starts, and ≈1.1 s later the pad unlocks with a small bounce.
   Reduced motion: no slides or pops, the same order.
5. **The score (agreed 2026-11-11, may change later).** 0–100 per drop, averaged over the
   round (a tap-along round is one "drop" with no restarts and no listening):
   - **timing** = (spot on × 1 + close × 0.7) / target beats of the drop;
   - **restarts**: × 0.85 for each restart of that drop (Reset counts too);
   - **listening**: from the start of the drop's last attempt to its first tap (my call;
     earlier attempts are paid for by the restarts). The first two eights are free, then
     × 0.95 per further eight, counted continuously (0.95^(eights − 2)), so four eights
     keep 90 %. The band's "about 2.4 s to find each spot" is the average of the same
     number.
   The parts shown: timing (the average timing × 100) and what restarts and listening took
   off, in points, so that timing − restarts − listening = the score.
6. **The result screen: option B "All your eights on one" (the user's pick).**
   - The band: **Score N** large; one line under it: "89 of 100 on the beat · 7 restarts ·
     about 2.4 s to find each spot" (tap along: "… on the beat" only).
   - A small card: "Timing 86 · Restarts −9 · Listening −3".
   - **The stack:** one eight of the target drawn as in 1, every judged tap of the round a
     dot over its circle, moved left or right by how early or late it was (to scale),
     coloured green/amber.
   - **A verdict sentence** on the target position that went worst: the one with the
     largest average offset beyond 60 ms ("Late on the and of 6, about 74 ms"), else the
     one most often missed ("The 2 is missed most: 6 of 20"), else "All on time".
   - **The list:** one row per drop, "Drop 3 · Coro · 4 of 5 · 2 restarts ▶" (▶ opens the
     replay). A tap-along round lists the song's parts instead ("Verse · 30 of 32").
   - **Again** and **Done** as now.
   - The replay is for drops only in 1b; a tap-along part row has no ▶ (my call).
7. **Replay** (the user has not picked yet; option 1 "playhead over the pattern" is my
   call, the other two on the board can replace it): from a drop's ▶. The song plays from
   two beats before the drop's first counted eight to the end of its two eights, the count
   shown big on the band. The two rows, coloured; a playhead line sweeps them in time; your
   taps appear as small marks above the circles where they really fell, as the playhead
   reaches them. Sound: the song, a high tick at each of your taps and a low knock on each
   target beat (scheduled on the AudioContext, as the player's clave is). Controls: ▶/❚❚,
   0.75×, ‹ › to step one beat back or forward (pauses). Back returns to the result. The
   taps live only in the page (nothing saved).
8. **The clave explained.** When the clave is the target, the setup shows a card under the
   2-3 / 3-2 chips: 2-3 "Two hits, then three: on 2 and on 3, then on 5, on the and of 6
   (between 6 and 7), and on 8."; 3-2 "Three hits, then two: on 1, on the and of 2, and on
   4, then on 6 and on 7."; the eight drawn with its five circles; **Hear it** plays two
   eights at the song's tempo with the count and the clave (count-only player, the clave
   on). Words through `t()`, both catalogs.

### Phase 2 — the hearing drill as an exercise type

1. **Type.** `EXERCISE_TYPES` gains `'hearing'`. A hearing drill is a drill row
   (`source = 'custom'`) with a new nullable column `exercises.kind` (`null` = drill,
   `'hearing'`). This is what `src/lib/exercises/kinds.ts` says to do the day two
   exercises of one source need different fields. A person's entry for a group's drill
   (`source = 'added'`) takes its type from the drill it points to (`drill_id`), so the
   class's hearing drills reach Today the way drills do. `typeOf` takes what it needs to
   see the kind; nothing outside the type branches on it (`contentFor`/`practiceFor`).
2. **The song** is the exercise's own `song_id` with `practice_mode = 'song'`, as a drill's
   Practise with a song is, so `songAccess`, `song_drops`, the walls and `syncScope` cover it
   (my call; not an id inside JSON). A class's hearing drill can only pick the group's songs,
   as for any group row (`crossRefs` stays `[]`). **The rest of the settings** live in
   `exercises.practice_json` under its own key, `{ hearing: { kind, target, clave?, section?,
   drops? } }`; the practice panel's writes (`{count, clave, speed}`) must keep that key.
3. **When the song stops being usable** (unshared, deleted, its count cleared): the drill
   stays on Today, and its page says why in place of Start ("The song is no longer shared
   with the class" / "Set the song's count first"), with no fallback to count only (my
   call). The check runs when the page and the listening player load, not only when the
   drill is made, so a cleared count never grades anyone.
4. **A class member's Change** changes this one round only (another target, a shorter
   round); nothing is saved on their row, and the teacher's settings stay the drill's (my
   call). So every score in "Your rounds" is on the teacher's settings, and a teacher's edit
   reaches everyone. A round played on changed settings is still a round; its set records
   the settings it ran with.
5. **The score** of a round goes into the set's `player_json` (already free-form):
   `{ hearing: { kind, target, songId, hit, of, meanMs } }`. The set's `rating` is the face,
   as now.
6. **New hearing drill:** from Today's +, from a song page's "Make a drill", and for a
   teacher from a group lesson's + (next to New drill). Fields: name, song (only counted
   songs can be picked; others say "Only the computer's guess · count it first"), kind,
   target, length (5 / 10 / 20 drops, or whole song / a section). Description optional.
7. **Its page:** like a drill's (`kinds/drill/`): description, the Practise card ("Listen to:
   Chan Chan · Dropped in · the 1 · 10 drops", Change, ▶ Start), comments on the class for a
   class drill, "Your rounds" (last score, count of rounds, a small line of scores), Done.
8. **Start** opens the listening player with the drill's settings. At the end, the result,
   then **Done** opens the exercise's Done sheet with the score on top ("7/10 on the 1 ·
   last time 6/10") and one face lightly marked as a suggestion. The person taps the face.
   Suggestion, my call: under 50 % Still hard, 50–74 % Getting there, 75–89 % I've got it,
   90 % and up Easy.
9. **Today:** the row has an ear icon (lucide `ear`); the subline as for drills.
10. **Levels:** the entry points follow `levelShown` like drills'.

### Phase 3 — styles per section, and the style rounds

1. A song's section gains an optional `style` in `sections_json` (`{ at, name, countOff,
   style? }`; `parseSections`/`sectionsJson` keep it; missing = the song's style). No
   migration.
2. The song page's section sheet gets the dance's style chips plus "Song's (salsa)". A
   coloured bar of styles on the song page.
3. **Which style is this part?** A pool of style-marked sections: the class's songs for a
   class drill, otherwise the person's own and class songs (my call; a picked list later).
   10 bits of ~15 s from inside marked sections, mixed; buttons for the dance's styles.
4. **Follow the style:** one song with marked sections; the pressed button over time is
   your line, drawn under the marked one at the end.

## How a tap is judged

All pure, in a new client-safe folder `src/lib/hearing/` with specs beside it.

- **When a tap happened, in music time:** take `pointerdown`'s `event.timeStamp`, convert
  to the song time with the player's `songTime()` (`src/lib/scheduler/attach.ts`, which
  already accounts for Bluetooth delay with a song) at that moment, then subtract the tap
  delay. Never `setTimeout` timing.
- **The expected taps:** every position of the target in every eight of the played stretch,
  as times on the song's grid (`timeline()` beats and counts; a fractional position is
  interpolated between its two beats). Count-off sections and anything before the first 1
  hold no expected taps (`quiet.ts`).
- **Matching:** each expected tap takes the nearest unused tap within ±150 ms (my call;
  under half a beat up to ~200 BPM). Hit within ±60 ms = spot on, within ±150 ms = close,
  else missed. Taps matching nothing are extra.
- **On another count:** an extra tap is labelled with the count of its nearest beat. When
  most taps of an eight sit on one other count (the 5 instead of the 1), that eight reads
  "on the 5".
- **Drift:** average early/late per section of the song.
- **Dropped in:** a drop starts on a random beat inside a counted stretch, with seven eights
  of song after it, never in a count-off section. From the first tap, two eights are judged
  like a tap-along stretch (`judgeDropPattern`); the time from the drop's start to the
  first tap is "listened for". Phase 1b's rules decide when a spot starts over.
- **Score:** hit / of (spot on and close both count as hit), and the average offset of
  the hits; phase 1b adds the 0–100 score (timing, restarts, listening).

## Words

Everything through `t()`, in `en` and `sl` (vikanje, the glossary). The type's name: en
"Hearing", sl "Sluh" (my guess; the user decides). The round and target names are words;
the count digits and "2-3"/"3-2" are not translated.

## Rules this touches (docs/hard-rules.md)

- The type owns its page (`contentFor`/`practiceFor`); no `{#if type === …}`.
- `exercises.kind` is an additive `ADD COLUMN`, no CHECK. `exercises` is synced: follow how
  0049 added columns to synced tables, so the phone's copy carries the column.
- Every new GET page or endpoint is classified in `src/lib/offline/routes.ts`; the listening
  player is a device page (it plays a kept song from the phone). The score's set is the same
  Done write as now.
- Group mutations (a teacher's hearing drill) `logChange` and are in `MUTATIONS`; a published
  lesson that gains one calls `autoAddPending`.
- Dates by hand (`format.ts`); colours by the builders (`styles.ts`); no `confirm()`.
- No `Date.now()` in `src/lib/hearing` (times are arguments).

## Left to the builder

- Exact component split, file names, the route's shape.
- The tap area's press animation, the strip's drawing (SVG), the setup sheet's layout.
- Whether the tap delay check reuses the voice capture's click (`src/lib/voice/capture.ts`)
  or plays a clip.
- How `typeOf` learns the kind.

## Known risks

- **Touch latency on Android WebView** varies by phone. The tap delay check covers it; if the
  check's spread is wide (taps all over), say so ("Your taps were uneven; try again") rather
  than store a bad number.
- **The check is against clicks on the AudioContext; songs play through a media element.**
  If the phone misreports its output delay, the two differ. The person's Sound delay
  correction already covers that for the voice; a mismatch shows as every tap early or late
  by the same amount, and re-running the check after setting Sound delay fixes it.
- Very fast songs (250 BPM, a beat every 240 ms): ±150 ms is more than half a beat.
  Narrow the window to under half a beat at high tempos.
