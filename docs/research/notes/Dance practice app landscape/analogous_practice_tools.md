# Analogous practice tools: martial arts, music, chess, motor-skill spaced repetition, skating

Scope: the closest outside analogues to the salsa/bachata app's six ideas — (a) frequency-scheduled drills with derived urgency, (b) a personal technique library with own video and variations, (c) a position graph with a gap report, (d) combos validated for connecting/looping, (e) practice to real music with a voice counting and calling the next move in time, (f) lesson videos with looped/slowed/mirrored sections linked to techniques. Research was web-only, about 18 tool calls, November 2026. App-store figures mostly come through third-party aggregators (mwm.ai, aitoolsbakery, splitmetrics), so treat them as approximate.

## Martial arts / BJJ: position-graph and game-plan apps, and combo callers

### Takeaway
BJJ already has many "positions as nodes, techniques as edges" tools: GrappleMap (open source), Matnet (2016), Jitz, Grapla, Grapple Flows, BJJCraft, BuddyTape. Almost all of them have tiny audiences: single-digit to low-hundreds of ratings or GitHub stars. Boxing and Muay Thai combo callers, on the other hand, are a crowded and commercially proven category (Heavy Bag Pro reports 1M+ Android installs). None of them was found to time its calls to the beat of real music, and none was found to check whether a combo connects or loops.

### Cited Findings
**Position graphs (idea c/d)**
- GrappleMap: "A database of interconnected grappling positions and transitions, animated with stick figures." It is a directed graph: each vertex is a concrete two-person pose and each edge a transition. Nodes carry tags for domain (e.g. side_control), pose details and grips. Tools include search, per-position pages, a Composer, an Explorer, a web editor, a Linux VR interface, and utilities that make videos of scripted or random matches. The repo has 214 stars, 50 forks and 752 commits. It presents itself as a source of "concrete ideas for drills to practice" but has no drill scheduling. — [GitHub Eelis/GrappleMap](https://github.com/Eelis/GrappleMap)
- Matnet Jiu-Jitsu Database (iOS, Maxwell Timmons, released 15 Nov 2016, v1.2). It has a "Big Picture" interactive node map of 50+ positions and their transitions, and a "Match Planner" that plots a sequence of positions across a whole match and saves it. It has 5.0★ from only 5 ratings. — [mwm.ai Matnet listing](https://mwm.ai/apps/matnet-jiu-jitsu-database/1175062894)
- Jitz (Jiu Jitsu Journal, iOS, free): a game-plan builder that connects positions, sweeps and submissions and steps through them like a flowchart, plus a position dictionary and a training journal. — [App Store](https://apps.apple.com/us/app/-/id6752256113) (via search summary)
- Grapla: "an interactive knowledge graph of hundreds of positions and thousands of validated transitions". It adds a training journal (sessions, coaches, partners, gyms; audio or typed notes from which it extracts techniques) and lets users build their own flows and "study them and recall them". On Product Hunt about 8 months ago it had 0 reviews and 3 followers. — [Product Hunt: Grapla](https://www.producthunt.com/p/grapla)
- Grapple Flows: a flowchart canvas that can also auto-generate a chart from a voice note or a YouTube video. Free, with a paid Pro tier. — [AlternativeTo](https://alternativeto.net/software/grapple-flows/about/)
- "Jiu Jitsu Game Plan" (iOS) is pitched as a way to stop "just rolling" and build a cohesive system, and has 4 ratings. BJJCraft ("Make Your BJJ System") has too few ratings to show. BuddyTape launched on r/bjj in 2022 as a free flowchart builder to a small, positive reception. — [Jiu Jitsu Game Plan](https://apps.apple.com/app/id6760214751), [BJJCraft](https://apps.apple.com/app/id6756968071) (via search summary)
- Coaches endorse the underlying method. TNBJJ says beginners progress faster with a game plan and that "You can create flowcharts to help you remember your game plan." Paper and PDF flowchart products, such as Bouhey's "Ultimate Flowchart", get positive mentions. — [TNBJJ Game Plan Based Training](https://tnbjj.com/linkedpages/gameplan.html), [bjjmore review (promotional)](https://bjjmore.com/ultimate-flowchart-bouhey/)
- Grapplearts publishes game plans and mind maps (e.g. a spider guard mind map) as instructional content rather than as an app. — [Grapplearts](https://www.grapplearts.com/spider-guard-gameplan-and-mindmap/)

**Combo callers (idea e)**
- Heavy Bag Pro: a combo caller for bag work and shadow boxing. 4.9★ from 744 US ratings, 1M+ Google Play installs. $9.99/month, $59.99/year or $129.99 lifetime; the only one-time purchase in that comparison. — [aitoolsbakery comparison 2026](https://aitoolsbakery.com/?p=18596)
- Shadow Boxing Workout App: calls combinations; the user picks duration, exercises and intensity or uses prebuilt sessions. 4.9★ from 2,958 US ratings, 10K+ Android installs, $14.99/month or $79.99/year. BRAWLER has a callout mode, 4.8★ from 1,615 ratings, $59.99/year. — [aitoolsbakery](https://aitoolsbakery.com/?p=18596)
- PunchLab (coach-led classes, phone-based punch tracking): 4.7★ from 804 ratings, 500K+ Android installs. An investor article reports "over 350,000 users in 70 different countries" and an €840K round. — [aitoolsbakery](https://aitoolsbakery.com/?p=18596), [LVenture Group](https://lventuregroup.com/en/the-home-fitness-startup-punchlab-closes-a-new-e-840k-investment-round/)
- FightCamp (wrist sensors, bag, instructor-led classes) is the biggest by ratings: 4.9★ from 23,508. It is also the most expensive, at $299–$899 of hardware plus $39.99/month. — [aitoolsbakery](https://aitoolsbakery.com/?p=18596)
- New small callers keep appearing with "personal combo library + real-time audio callouts": Bagwork, Boxing Combo Timer (too few ratings to show), Boxing Combo Trainer (€1.99/month), and Bout (5.0★ from 2 reviews). — [Bagwork](https://mwm.ai/apps/bagwork-boxing-combos-timer/6782470936), [Boxing Combo Timer](https://apps.apple.com/lb/app/boxing-combo-timer/id6755162811), [Boxing Combo Trainer](https://mwm.ai/apps/boxing-combo-trainer/6779302687), [Bout](https://appshunter.io/ios/app/bout-boxing-and-muay-thai-timer/id6790204379)

### Inferences
- The graph idea (c) is well trodden in BJJ, and the graph alone has never drawn an audience. The commercial winners in martial arts sell structured workouts with audio guidance (callers, classes) or hardware. Every graph-first app stays tiny. A graph works best as a backbone under something people use daily.
- The combo callers are the closest analogue to idea (e), but they call on a timer interval, not on a musical beat, and no evidence was found of any that sync calls to a song's detected beat or count. Boxing has no musical count to follow, so dance's "call the next figure on the right count of real music" has no direct precedent in these fields.
- No BJJ tool found reports a gap ("which positions have no exit / no entry in YOUR repertoire") in the way the salsa app's gap report does. Grapla's "validated transitions" is a curated global graph, not the user's own. Combining a personal graph with gap finding looks rare. This is not verified exhaustively.
- Paper flowcharts and PDF products are well received in BJJ. A drawn map of one's own game seems to be valued as a thinking tool even when apps for it don't take off.

### Gaps
- No real r/bjj discussion thread on whether flowchart apps help was retrieved. The Reddit sentiment here is secondhand.
- Marcelotv, Roll Tracker, BJJ Notes, and Obsidian/Notion BJJ templates were not checked individually for lack of budget.
- Revenue for any BJJ app was not found. Corner Boxing was not covered.
- GrappleMap's last-commit date and node/edge counts were not visible on the fetched page.

## Music practice: practice journals, spaced repetition of pieces, loop/slow trainers with beat detection

### Takeaway
Music has two separate, mature categories. Practice organisers (Modacity, Andante and many small journals) offer plans, timers, recording and stats, but no spaced repetition was confirmed. Loop/slow-down trainers (Amazing Slow Downer, Anytune, Transcribe!, Moises) do looping and tempo, and Moises/Transcribe! add AI beat, chord and tempo detection. Moises is by far the largest, with tens of millions of users, and the only one to put beat detection, a click/count-in and practice in one product.

### Cited Findings
- Modacity (co-founder and CEO Marc Gelfo, a French horn player): built around "deliberate practice". It covers practice planning, recording, a metronome, a drone, a timer, notes and statistics. A review page with entries dated March 2026 still lists it live at $8.99/month, with only 13 user reviews there. — [justuseapp Modacity reviews](https://justuseapp.com/de/app/1351617981/modacity-pro-music-practice/reviews), [Midnight Music podcast](https://midnightmusic.com.au/2018/10/mtt71-supercharge-your-practice-sessions-with-modacity/), [Contrabass Conversations](https://contrabassconversations.com/2018/08/23/modacity-marc-gelfo/)
- Andante (Music Practice Journal): about 4.86★ from roughly 1.3K ratings. Reviewers praise the simple layout and logging mood, concentration and notes per session. It has a timer, metronome, drone, tuner and recorder. SplitMetrics shows the last update about a year earlier. — [SplitMetrics Andante](https://splitmetrics.com/apps/andante-practice-journal/id1530262372), [App Store](https://apps.apple.com/us/app/-/id1530262372)
- Many small practice journals keep launching: Only Practice, MusoLink, Praxis, BeatsNotes, Practice Log, PracticeMind, Riffday (Android). — [App Store / hunted.space listings via search](https://www.hunted.space/dashboard/riffday)
- MemoRep: a spaced-repetition app aimed at physical/musical skills (guitar techniques, piano sight-reading). It schedules what to practise rather than showing flashcards. — [Product Hunt MemoRep](https://www.producthunt.com/p/memorep)
- Moises: AI stem separation that also "detects songs' beat and chords". It has a metronome click track, BPM detection, setlists and a count-in (up to 4 beats free, up to 16 on premium). Claimed users vary by date and source: 30M registered ([Fox Business](https://foxbusiness.com/technology/ai-music-app-moises-tops-30-million-registered-users)), "more than 60 million" ([Apple developer article](https://developer-mdn.apple.com/articles/moises/)), and "75 million" as a company claim ([tooldirectory](https://tooldirectory.ai/tools/moises)). It raised an $8.65M round ([TechBuzz](https://www.techbuzznews.com/moises-lands-8-65-million-funding-round/)).
- Transcribe!: several loops per file, each with its own key, tempo or EQ, plus automatic key, tempo and chord detection. — [AlternativeTo / search summary](https://alternativeto.net/software/amazing-slow-downer)
- Anytune Pro+ ($14.99): a Loop Interval Trainer, ReTune for scripted tempo/pitch changes, unlimited audio marks, a Transcribe mode, and pause-repeat for working phrase by phrase. — [Anytune App Store](https://apps.apple.com/us/app/anytune-practice-perfected/id722444976?mt=12&uo=4), [MacTech](https://www.mactech.com/2014/01/02/kool-tools-anytune-for-mac/amp/)
- Amazing Slow Downer ($39.99 Mac): A-B loops set with "Set" buttons during playback. Its listing names dancers explicitly: "the ideal tool for any musician, transcriber or dancer". — [App Store](https://apps.apple.com/us/app/id910469258)

### Inferences
- Idea (f) (loop, slow, mirror sections of a video and link them to a technique) has strong precedent in its loop/slow half. Music tools sell well for exactly this and some target dancers. Linking a looped section to a technique in a personal library was not found in any of them: they are per-file tools with marks, not knowledge bases.
- Idea (e)'s ingredient, beat detection on a real song, is mainstream in music (Moises, Transcribe!). The dance app's step beyond it is mapping beats to a user-owned 1–8 count and speaking calls in time. Moises's count-in is a click before the song, not a count through it.
- Practice journals are a crowded, low-revenue space. Many clones launch, few have more than about 1K ratings, and the best-rated (Andante) appears lightly maintained. Planning and logging alone does not seem to sustain a business. Moises, built on a hard technical capability, scaled.

### Gaps
- Tonic, Practice Room, Instrumentive and Soundbrenner were not individually verified (budget). Whether Modacity is still actively developed is unconfirmed: one review page is the only recent signal.
- No music practice app was confirmed to schedule pieces or exercises by spaced repetition, apart from the small MemoRep.
- Whether Moises's beat grid snaps loops to beats was not confirmed.

## Spaced repetition for motor skills / physical drills, and the research on distributed practice

### Takeaway
Distributed (spaced) practice has a solid, if older, research base for motor skills: a meta-analytic effect size of about 0.46, and over 80% of motor studies show a benefit. Purpose-built spaced-repetition apps for physical skills, however, are nearly absent. The only ones found are MemoRep, a CLI "pattern lock tutor", and informal Anki use for mental rehearsal. No juggling-specific tool was found.

### Cited Findings
- Donovan & Radosevich (1999): a meta-analysis of 63 studies and 112 effect sizes. Spaced practice beat massed practice with a mean weighted effect size of 0.46. — [Donovan & Radosevich 1999 (PDF)](https://www.gwern.net/docs/spaced-repetition/1999-donovan.pdf)
- Lee & Genovese (1988): a review of 47 articles. Distributed practice improved both acquisition and retention of motor skills. Massed practice clearly depresses performance, but its effect on learning "has no firm consensus". An earlier review by Adams had found little or no effect on acquisition. — [via gwern-hosted review / search summary](https://www.gwern.net/docs/www/uweb.cas.usf.edu/f1052ecdd92f0ecc3f57bdd890a4a6558483ec45.pdf)
- Cepeda et al. (2006) cite Moss: for verbal and motor skills, "over 80% of studies showed a distributed practice benefit", against only about a third of intellectual-skill studies. — [Cepeda, Pashler, Vul, Wixted, Rohrer 2006](https://www.evullab.org/pdf/CepedaPashlerVulWixtedRohrer-PB-2006.pdf)
- Caveats: Carron (1969) found massed practice better for a discrete task, and Ammons (1988) warned that meta-analyses give "a false sense of security about the generality of the effects". — [Ammons 1988](https://Www.Gwern.net/doc/psychology/spaced-repetition/1988-ammons.pdf)
- Dunlosky's 2019 Cambridge Handbook chapter is described as the first comprehensive review covering verbal, motor, intellectual, social and emotional skills; only the abstract was seen. — [Cambridge](https://cambridge.org/core/books/cambridge-handbook-of-cognition-and-education/enhancing-the-quality-of-student-learning-using-distributed-practice/88D92B0BC94535226DB7B39C8026EF31)
- Informal practice: a LessWrong-type thread reports SRS working "reasonably well for simple motor skills, less for complex ones". It suggests using Anki for mental rehearsal, noting that cards lack the physical context. — [greaterwrong thread](https://www.greaterwrong.com/posts/QxyusBcoWbvHrksoq/ryan_b-s-shortform/comment/y9h4euARafJJivpg3)
- MemoRep (spaced repetition that schedules physical skill practice) and "pattern lock tutor" (spaced repetition over motor sequences such as piano riffs, CLI) are the only purpose-built examples found. — [MemoRep](https://www.producthunt.com/p/memorep), [ClawHub](https://clawhub.ai/voronindenis5/skills/pattern-lock-tutor)
- Speed Stacks (sport stacking) publishes "distribution of practice" as instructor guidance, i.e. the principle reaches coaches as advice, not software. — [Speed Stacks](https://www.speedstacks.com/instructors/resources/benefits/distribution-of-practice/)

### Inferences
- The app's urgency-from-frequency model (idea a) is a recall scheduler with the "recall" replaced by a logged set. It is closer to a habit tracker with per-item intervals than to Anki's SM-2, which grades each review. The research supports spacing physical practice, but no evidence was found for an optimal interval scheme for motor skills, so user-set frequency is a defensible choice over algorithmic intervals.
- That almost no physical-skill SRS products exist suggests either an unserved niche or that the "grade" step is awkward without a clear right or wrong answer. The salsa app sidesteps the grade by using frequency.

### Gaps
- No modern (post-2010) motor-specific meta-analysis was retrieved. Contextual interference (random vs. blocked practice) is relevant to idea (d) but was not searched.
- No juggling apps were found (Juggling Lab, siteswap tools and skill trackers were not checked).
- No numbers were found on how many people use Anki for physical skills.

## Chess opening repertoire trainers as "move graph + spaced repetition"

### Takeaway
Chessable's MoveTrainer is the strongest commercial proof that "a graph of moves you own plus spaced repetition" sells. It was one of the two most valuable assets in Chess.com's ~$82M purchase of Play Magnus Group (Aug–Nov 2022). Chess.com has since rebuilt MoveTrainer into its own Courses feature and claims users improve 4.6× faster. That figure is the company's own, not independent.

### Cited Findings
- Chess.com (via Chess Growthco LLC) offered NOK 13.00/share for 100% of Play Magnus Group on 24 Aug 2022, about NOK 799M (about $82M; also reported as $82.9M and $80M). Acceptances passed 90% in November 2022. — [Play Magnus Group announcement](https://playmagnusgroup.com/the-board-unanimously-recommends-an-offer-from-chess-com-to-acquire-all-shares-of-play-magnus-group), [SportBusiness](https://www.sportbusiness.com/news/chess-com-to-acquire-play-magnus-group-in-82m-deal/), [Front Office Sports](https://frontofficesports.com/article/top-chess-player-platform-join-forces-in-82-9m-deal/)
- PMG's brands were chess24, the Play Magnus app, the Champions Chess Tour and Chessable. A commentator: "The two most valuable properties acquired … are Chessable and Magnus." — [Perpetual Chess Link-Fest](https://benjohnson.substack.com/p/perpetual-chess-link-fest-2-august)
- Chess.com's Courses brings over "Chessable's core features … including its signature MoveTrainer technology". Chess.com claims MoveTrainer users improve 4.6× faster on average within six months. Chessable continues separately, and courses import one way. — [Chess.com announcement](https://www.chess.com/news/view/announcing-courses?page=2)
- Andy Matuschak keeps notes on Chessable MoveTrainer as a model of spaced repetition applied to a procedural skill. — [Matuschak notes](https://notes.andymatuschak.org/z8MgFD7B7QRqqGZXsJqeGpm5PJhroPwb6BW2V)

### Inferences
- Chessable's model maps closely onto the dance app. A course is a tree of moves (positions → moves → positions), the user drills lines (sequences) through it, and SRS decides which line is due. What made it succeed was content: courses by Carlsen, Giri, Polgar and other authors on a marketplace. The algorithm was the engine, not the product. A personal dance app has no content marketplace, and this is the main structural difference.
- Chess positions are objectively checkable (the move is right or wrong). Dance figures are not, which is why chess can grade reviews and the dance app logs sets instead.

### Gaps
- Chessable's user count and revenue were not found. ChessTempo and Listudy (free repertoire trainers) were not researched.

## Figure skating / gymnastics / cheer: element libraries and rule-checked routine builders

### Takeaway
Skating has a niche of IJS calculators and program builders (Clean Skate, Skate Plan, Skates: Technical Specialist, Scale of Values, IJSEdge, Sweet Ice). They let a skater assemble a program from a library of elements and check its predicted base value against the current ISU rules: "validate a sequence against rules", like idea (d), but the rules are scoring rules, not physical connectivity.

### Cited Findings
- Clean Skate: IJS Calculator plans programs on the 2026–27 Scale of Values, including Choreo Spin and GOE estimates for jumps, spins and sequences. — [App Store](https://apps.apple.com/cd/app/id6755794407)
- Skate Plan: "a complete choreography and program-building tool" with a real-time predicted base score for the whole routine and a jump-combination builder. Its listing still cites the 2024–25 element set. — [mwm.ai Skate Plan](https://mwm.ai/de/apps/skate-plan/6759615058)
- Skates: Technical Specialist, a subscription that keeps "all the relevant rules, permitted elements and abbreviations provided by the ISU" current. — [App Store](https://apps.apple.com/app/id1447634428)
- Scale of Values: an element lookup by name or IJS ID showing base value under GOE. — [App Store](https://apps.apple.com/app/id718380506)

### Inferences
- A rule-checked routine builder exists only where a governing body publishes machine-checkable rules (ISU). Social partner dance has no such rulebook, so the dance app's checks are physical (does the end position meet the next start, does it loop), like GrappleMap's pose continuity rather than skating's scoring.
- Keeping rules current every season is the recurring cost and the subscription justification in skating apps. Stale listings (Skate Plan's 2024–25 set) show how this fails.

### Gaps
- Gymnastics (FIG Code of Points) and cheer routine tools were not researched. Download counts for skating apps were not found.

## Lessons: which analogous products succeeded, and what drove it

### Takeaway
The large analogues won on one hard, daily-useful capability or on content: Moises (AI stems and beat detection, tens of millions of users), Chessable (author courses on a move-tree + SRS engine, central to an ~$82M exit), Heavy Bag Pro and FightCamp (structured audio-guided or hardware workouts). The products closest to the dance app's own core — the position graph and the practice journal — exist in numbers but stay tiny everywhere they were found.

### Cited Findings
- Moises: 30M → "60M+" → "75M" claimed users over time — [Fox Business](https://foxbusiness.com/technology/ai-music-app-moises-tops-30-million-registered-users), [Apple](https://developer-mdn.apple.com/articles/moises/), [tooldirectory](https://tooldirectory.ai/tools/moises)
- Chessable: one of the two most valuable assets in an ~$82M deal — [SportBusiness](https://www.sportbusiness.com/news/chess-com-to-acquire-play-magnus-group-in-82m-deal/), [Perpetual Chess](https://benjohnson.substack.com/p/perpetual-chess-link-fest-2-august)
- Heavy Bag Pro: 1M+ installs. FightCamp: 23.5K ratings at $39.99/month plus hardware — [aitoolsbakery](https://aitoolsbakery.com/?p=18596)
- The graph tools stay tiny: Matnet has 5 ratings after nine years, Jiu Jitsu Game Plan 4 ratings, Grapla 3 followers, GrappleMap 214 stars — [Matnet](https://mwm.ai/apps/matnet-jiu-jitsu-database/1175062894), [Jiu Jitsu Game Plan](https://apps.apple.com/app/id6760214751), [Grapla](https://www.producthunt.com/p/grapla), [GrappleMap](https://github.com/Eelis/GrappleMap)
- Practice journals: the best found (Andante) has about 1.3K ratings and is lightly updated — [SplitMetrics](https://splitmetrics.com/apps/andante-practice-journal/id1530262372)

### Inferences
- Per idea:
  - (a) Frequency-scheduled drills: validated by research and by Chessable's SRS, but almost unbuilt for physical skills. A real gap.
  - (b) Personal library with own videos: common as journals (Jitz, Grapla, music journals), low traction on its own.
  - (c) Position graph and gap report: many BJJ attempts, low traction. A personal gap report was not seen elsewhere.
  - (d) Sequences validated for connecting and looping: GrappleMap's Composer and Matnet's Match Planner come nearest. Skating validates against scoring rules instead.
  - (e) Calls on the beat of real music: combo callers prove that calls during practice are wanted and paid for, but none sync to music. Moises proves beat detection is mainstream. The combination appears novel.
  - (f) Looped/slowed sections: proven demand (Amazing Slow Downer even names dancers), but no tool found ties sections to a technique library.
- For a personal tool the lesson is less about market and more about where engagement comes from. In the analogues, the daily-use hook (a caller session, a due-today queue, a looping player) drives use. The graph/library is valued as structure but rarely as the thing people open the app for. The salsa app's Today band and player-with-calls already play the hook role.

### Gaps
- No revenue figures for Moises, Chessable or any BJJ app were found. No failure post-mortems (shut-down practice apps) were found. Modacity's status is uncertain, not confirmed shut down.
