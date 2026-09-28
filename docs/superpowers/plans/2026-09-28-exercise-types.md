# Exercise types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every exercise gets a type (lesson review, figure practice, drill,
routine) that owns its log popup; lessons, figures and drills gain links with
YouTube embeds; the figure and drill popups carry a slim player (count, clave,
song, call on cue) that fills in the minutes; tapping a row opens a new
exercise page and the **+** opens the popup.

**Architecture:** The type is derived from `exercises.source` by a pure
registry (`src/lib/exercises/kinds.ts`). One new table (`links`), one marker
table (`app_flags`) and one additive column (`exercises.practice_json`). Two
JSON endpoints under `/[dance]/` (the popup's content, and a song's grid),
one shared logging path (`src/lib/server/log-form.ts`), a new
`/[dance]/exercises/[id]` page, and per-type popup components that share a
`LogShell` and a `PracticePanel` built on the existing `createPlayer`.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle ORM on better-sqlite3,
Tailwind 4, vitest. Toolchain comes from the nix flake: **every** command runs
as `nix develop -c <cmd>` — `node`, `npm`, `npx` and `sqlite3` are not on PATH
outside it.

**Spec:** [`docs/superpowers/specs/2026-09-28-exercise-types-design.md`](../specs/2026-09-28-exercise-types-design.md).
Read it alongside this plan. Also read `CLAUDE.md` (hard rules) before Task 1.

---

## Global Constraints

These bind every task. Copied from `CLAUDE.md` and the spec.

- **Never add a CHECK to an existing table.** Additive `ALTER TABLE … ADD
  COLUMN` only on `exercises`. The CHECK on `links` is allowed because `links`
  is a NEW table. **Read the generated migration SQL before committing it**: it
  must contain only `CREATE TABLE`, `CREATE INDEX` and
  `ALTER TABLE \`exercises\` ADD \`practice_json\` text`. Any `DROP`, any
  `__new_` table, any re-`CREATE` of an existing table means stop and report.
- **Data functions take `db` as their first argument** so tests run against
  `openDb(':memory:')`. Routes pass `getDb()`.
- **A spec must never touch `$DATA_DIR`.** Route-level tests mock
  `$lib/server/db` exactly as `src/routes/[dance]/dance-wall.spec.ts` does
  (`vi.hoisted` handle + `vi.mock` + `openDb(':memory:')` per test).
- **Nothing under `$lib/server` is imported by components.** Shared row shapes
  live in `src/lib/types.ts`.
- **Every instant is an integer of epoch ms.** Anything a user reads as a day
  goes through `localDay`/`daysBetween` in the user's zone.
- **Dates on screen are built by hand** (`src/lib/format.ts`), never
  `toLocaleDateString`.
- **The dance wall:** every id arriving in a URL or form body is resolved
  through `src/lib/server/scope.ts` (`danceOf`, `requireExerciseInDance`,
  `requireSongInDance`, …) before it is read or written. A cross-dance id is a
  404, indistinguishable from a missing one.
- **Archive, don't delete — for entities.** A **link** is hard-deleted, like a
  recording or a lesson video.
- **No `{@html}`.** Notes are linkified with `textPieces` from `$lib/links`.
- **Only `http:`/`https:` URLs** are ever stored or rendered as links.
- **The player's timing is the audio clock's.** The panel uses `createPlayer`
  unchanged; nothing is scheduled with `setTimeout`. `start()` must be called
  synchronously inside the Play tap (iOS) — nothing may be `await`ed before it.
- **Deny-by-default auth.** New routes are private automatically; do not touch
  `PUBLIC_PATHS` in `hooks.server.ts`.
- **Browser storage** (`localStorage`) only for per-viewer conveniences, every
  access wrapped in try/catch.
- **`npm run check` must pass** (prettier + eslint + svelte-check + build +
  vitest). Run `nix develop -c npm run check` before the final commit of every
  task. Prettier formats `.ts`, `.svelte` AND `.md` — run
  `nix develop -c npx prettier --write <files>` on what you touched.
- **Prove each new test can fail.** Before committing, break the thing the test
  asserts (invert a condition, delete the guard), watch that test fail, restore.
- **Commits** end with the trailer
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Work happens on
  the `exercise-types` branch, which already exists and holds the spec.
- **Match the surrounding code:** tabs, single quotes, the repo's comment
  density — comments explain WHY, in full sentences, as the existing files do.

## Review Focus

Inputs the spec implies but no happy-path test exercises, most likely first.
Each has its pinning test in the task that owns the code.

1. **A remembered song that is later archived or fails analysis.** The popup
   must open on count with "Its song is not ready — pick another", and a POST
   naming a non-ready song must be refused, not stored. → Task 5
   (`setPracticeSettings` refuses a non-ready song) and Task 10 (`songGone`:
   the panel falls back to count), checked by hand in Task 12 Step 9 — archive
   the test song after practising with it once, then reopen the popup.
2. **Real-world YouTube URLs carry junk:** `&list=…&index=3`, `?si=…` share
   tokens, `&t=1m30s`, a trailing `)` from notes written in parentheses. The id
   and start must still parse, and the import must not store `…xyz)`. → Task 1.
3. **Pasting a malformed or `javascript:` URL, or a mix of good and bad
   lines.** Nothing is stored, the bad lines are named, and the typed text is
   kept. → Task 1 (`splitLinkLines`) and Task 8 (`addLinkFrom`'s failure payload).
4. **Back-filling a past day from a figure popup that posts `reps` and a
   `run`.** Fields the type lacks are dropped and a back-filled set gets no
   `player_json`. → Task 6.
5. **Closing the popup, or navigating away, mid-run.** The AudioContext and the
   wake lock must stop; a backdrop tap or Escape must not close it at all while
   running. → Task 2 (stopwatch maths tested) and Task 12 Step 9, items 3 and 7
   (the guard and the teardown, checked by hand — the repo has no DOM harness).

---

## File map

```
src/lib/links.ts                         NEW  pure: parseLink, extractUrls, textPieces, splitLinkLines, youtube urls
src/lib/links.spec.ts                    NEW
src/lib/exercises/kinds.ts               NEW  pure: source → type, fields, rating question
src/lib/exercises/kinds.spec.ts          NEW
src/lib/exercises/practice.ts            NEW  pure: PracticeConfig, parsePracticeConfig, parsePracticeInput, summary
src/lib/exercises/practice.spec.ts       NEW
src/lib/exercises/stopwatch.ts           NEW  pure: wall-clock accumulator
src/lib/exercises/stopwatch.spec.ts      NEW
src/lib/exercises/session.ts             NEW  pure: which exercise a session opens next
src/lib/exercises/session.spec.ts        NEW
src/lib/video-prefs.ts                   NEW  client: mirror/speed remembered in localStorage
src/lib/types.ts                         MOD  LinkRow, RecordingRow, LastSet, PracticeContent, PracticePayload,
                                              SongGrid, HistorySet, ExerciseSummary; ExerciseItem.practiceJson
src/lib/labels.ts                        MOD  drop PRACTICE_LABEL
src/lib/server/db/schema.ts              MOD  links, appFlags, exercises.practiceJson
drizzle/0008_*.sql                       NEW  generated
src/lib/server/links.ts                  NEW  listLinks, addLinks, deleteLink, importNoteLinks
src/lib/server/links.spec.ts             NEW
src/lib/server/db/bootstrap.ts           MOD  run importNoteLinks once
src/lib/server/exercises.ts              MOD  updateExercise (settings only), setPracticeSettings, exerciseHistory,
                                              exerciseSummary, lastSets, lastSet, listExercises selects practiceJson
src/lib/server/data.spec.ts              MOD  practice tests move to setPracticeSettings
src/lib/server/lessons.ts                MOD  taughtIn
src/lib/server/grid.ts                   NEW  songGrid(song) — shared by the player load and the grid endpoint
src/lib/server/practice-content.ts       NEW  practicePayload(db, exercise, tz, now)
src/lib/server/practice-content.spec.ts  NEW
src/lib/server/log-form.ts               NEW  logSetFrom, deleteSetFrom
src/lib/server/log-form.spec.ts          NEW
src/lib/server/link-form.ts              NEW  addLinkFrom, deleteLinkFrom
src/routes/[dance]/songs/[id]/grid/+server.ts          NEW  GET grid
src/routes/[dance]/exercises/[id]/practice/+server.ts  NEW  GET payload, POST practice settings
src/routes/[dance]/exercises/[id]/+page.server.ts      NEW  the exercise page
src/routes/[dance]/exercises/[id]/+page.svelte         NEW
src/routes/[dance]/+page.server.ts       MOD  shared log/deleteSet, takes, last ratings; settings actions leave
src/routes/[dance]/+page.svelte          MOD  popup registry, row link, session
src/routes/[dance]/player/+page.server.ts MOD songGrid
src/routes/[dance]/player/+page.svelte   MOD  remove the stray line
src/routes/[dance]/figures/[id]/+page.server.ts  MOD shared log, links, taughtIn
src/routes/[dance]/figures/[id]/+page.svelte     MOD Log…, Exercise →, links, Taught in, VideoFrame, LinkedText
src/routes/[dance]/lessons/[id]/+page.server.ts  MOD shared log, links
src/routes/[dance]/lessons/[id]/+page.svelte     MOD Log…, Exercise →, links, VideoFrame, LinkedText, tappable exercises
src/routes/[dance]/routines/[id]/+page.svelte    MOD Exercise →
src/routes/[dance]/dance-wall.spec.ts    MOD  moved/new refusals
src/lib/components/ui/Sheet.svelte       MOD  guard prop
src/lib/components/ui/styles.ts          NEW  FIELD, LABEL, CHIP class strings
src/lib/components/ui/VideoFrame.svelte  NEW  <video> + mirror + speed
src/lib/components/ui/LinkedText.svelte  NEW
src/lib/components/links/YouTubeCard.svelte  NEW  thumbnail → iframe, mirror, open ↗
src/lib/components/links/LinkList.svelte     NEW  read-only list
src/lib/components/links/LinksEditor.svelte  NEW  list + delete + add form
src/lib/components/player/CountChips.svelte  NEW  extracted from Setup
src/lib/components/player/ClaveChips.svelte  NEW  extracted from Setup
src/lib/components/player/Setup.svelte       MOD  uses the chips
src/lib/components/player/PracticePanel.svelte NEW
src/lib/components/exercises/RatingChips.svelte NEW
src/lib/components/exercises/SetList.svelte     NEW
src/lib/components/exercises/LastTime.svelte    NEW
src/lib/components/exercises/LogShell.svelte    NEW  the shared popup frame
src/lib/components/exercises/fetch-practice.ts  NEW  client fetch of the payload
src/lib/components/exercises/kinds/index.ts            NEW  contentFor(type), logFor(type)
src/lib/components/exercises/kinds/<type>/Content.svelte  NEW  ×4: lesson, figure, drill, routine
src/lib/components/exercises/kinds/<type>/Log.svelte      NEW  ×4
src/lib/server/popup.ts                  NEW  popupData — what a page needs to open a popup
src/lib/server/link-form.spec.ts         NEW
src/lib/video-prefs.spec.ts              NEW
src/lib/components/today/ExerciseRow.svelte  MOD  row link, + opens popup, rating dots
src/lib/components/today/LogSheet.svelte     DELETE (Task 12)
docs/…, CLAUDE.md                            MOD  Task 15
```

---

### Task 1: `$lib/links` — parsing URLs

**Files:**

- Create: `src/lib/links.ts`
- Test: `src/lib/links.spec.ts`

**Interfaces:**

- Produces:
  - `type ParsedLink = { kind: 'youtube'; id: string; start: number | null } | { kind: 'web'; host: string }`
  - `parseLink(raw: string): ParsedLink | null`
  - `parseTime(raw: string | null): number | null`
  - `extractUrls(text: string): string[]` — de-duplicated, in order
  - `type TextPiece = { text: string } | { url: string }`
  - `textPieces(text: string): TextPiece[]`
  - `splitLinkLines(text: string): { urls: string[]; bad: string[] }`
  - `youtubeThumb(id: string): string`, `youtubeEmbed(id: string, start: number | null): string`,
    `youtubeWatch(id: string, start: number | null): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/links.spec.ts
import { describe, expect, it } from 'vitest';
import {
	extractUrls,
	parseLink,
	parseTime,
	splitLinkLines,
	textPieces,
	youtubeEmbed,
	youtubeWatch
} from './links';

const ID = 'dQw4w9WgXcQ';

describe('parseLink', () => {
	it.each([
		`https://www.youtube.com/watch?v=${ID}`,
		`https://youtube.com/watch?v=${ID}`,
		`https://m.youtube.com/watch?v=${ID}`,
		`https://music.youtube.com/watch?v=${ID}`,
		`https://youtu.be/${ID}`,
		`https://www.youtube.com/shorts/${ID}`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/live/${ID}`,
		`https://www.youtube-nocookie.com/embed/${ID}`,
		`http://www.youtube.com/watch?v=${ID}`
	])('finds the video id in %s', (url) => {
		expect(parseLink(url)).toEqual({ kind: 'youtube', id: ID, start: null });
	});

	it('ignores playlist and share junk around the id', () => {
		expect(parseLink(`https://www.youtube.com/watch?v=${ID}&list=PLx&index=3`)).toEqual({
			kind: 'youtube',
			id: ID,
			start: null
		});
		expect(parseLink(`https://youtu.be/${ID}?si=abcDEF123`)).toEqual({
			kind: 'youtube',
			id: ID,
			start: null
		});
	});

	it('reads the start time in seconds or h/m/s form', () => {
		expect(parseLink(`https://youtu.be/${ID}?t=90`)).toMatchObject({ start: 90 });
		expect(parseLink(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toMatchObject({
			start: 90
		});
		expect(parseLink(`https://www.youtube.com/embed/${ID}?start=42`)).toMatchObject({
			start: 42
		});
	});

	it('treats a YouTube URL without a valid id as an ordinary link', () => {
		expect(parseLink('https://www.youtube.com/@somechannel')).toEqual({
			kind: 'web',
			host: 'youtube.com'
		});
		expect(parseLink('https://youtu.be/short')).toEqual({ kind: 'web', host: 'youtu.be' });
	});

	it('names the host of any other link, without www', () => {
		expect(parseLink('https://www.salsa-school.si/lessons?x=1')).toEqual({
			kind: 'web',
			host: 'salsa-school.si'
		});
	});

	it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.org/a', 'not a url', ''])(
		'refuses %s',
		(url) => {
			expect(parseLink(url)).toBeNull();
		}
	);
});

describe('parseTime', () => {
	it('parses plain seconds and h/m/s', () => {
		expect(parseTime('75')).toBe(75);
		expect(parseTime('2m')).toBe(120);
		expect(parseTime('1h2m3s')).toBe(3723);
		expect(parseTime('45s')).toBe(45);
	});
	it('gives null for nothing or nonsense', () => {
		expect(parseTime(null)).toBeNull();
		expect(parseTime('')).toBeNull();
		expect(parseTime('soon')).toBeNull();
	});
});

describe('extractUrls', () => {
	it('finds every URL, trims trailing punctuation, and keeps a balanced paren', () => {
		const text = `Watch this (https://youtu.be/${ID}). Also https://example.com/a, and
https://en.wikipedia.org/wiki/Salsa_(dance) — nice!`;
		expect(extractUrls(text)).toEqual([
			`https://youtu.be/${ID}`,
			'https://example.com/a',
			'https://en.wikipedia.org/wiki/Salsa_(dance)'
		]);
	});
	it('returns each URL once', () => {
		expect(extractUrls('https://a.org/x https://a.org/x')).toEqual(['https://a.org/x']);
	});
	it('finds nothing in plain text', () => {
		expect(extractUrls('no links here')).toEqual([]);
	});
});

describe('textPieces', () => {
	it('splits text around URLs and round-trips the original', () => {
		const text = 'See https://a.org/x. Then (https://b.org/y) ok';
		const pieces = textPieces(text);
		expect(pieces).toEqual([
			{ text: 'See ' },
			{ url: 'https://a.org/x' },
			{ text: '. Then (' },
			{ url: 'https://b.org/y' },
			{ text: ') ok' }
		]);
		expect(pieces.map((p) => ('url' in p ? p.url : p.text)).join('')).toBe(text);
	});
	it('is one text piece when there is no URL', () => {
		expect(textPieces('just words')).toEqual([{ text: 'just words' }]);
	});
});

describe('splitLinkLines', () => {
	it('keeps good lines, names bad ones, and skips blanks', () => {
		expect(splitLinkLines(`https://youtu.be/${ID}\n\n  javascript:x \nhttps://a.org\n`)).toEqual({
			urls: [`https://youtu.be/${ID}`, 'https://a.org'],
			bad: ['javascript:x']
		});
	});
});

describe('youtube urls', () => {
	it('builds the nocookie embed and the watch link with a start', () => {
		expect(youtubeEmbed(ID, 90)).toBe(
			`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&start=90`
		);
		expect(youtubeEmbed(ID, null)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`);
		expect(youtubeWatch(ID, 90)).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/links.spec.ts`
Expected: FAIL — `Failed to resolve import "./links"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/links.ts
/**
 * Links attached to lessons, figures and drills. PURE and client-safe: the
 * server validates with it before storing, and the page renders with it.
 *
 * Only `http:` and `https:` survive `parseLink`. That is the whole defence
 * against a `javascript:` URL: nothing that fails here is stored, and nothing
 * rendered as a link comes from anywhere else.
 */

export type ParsedLink =
	| { kind: 'youtube'; id: string; start: number | null }
	| { kind: 'web'; host: string };

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);

/** A YouTube video id is exactly 11 of these. Anything else is not a video. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds; null for nothing or nonsense. */
export function parseTime(raw: string | null): number | null {
	if (!raw) return null;
	if (/^\d+$/.test(raw)) return Number(raw);
	const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
	if (!m || (!m[1] && !m[2] && !m[3])) return null;
	return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function parseLink(raw: string): ParsedLink | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.hostname.toLowerCase();
	let id: string | null = null;
	if (host === 'youtu.be') {
		id = url.pathname.slice(1).split('/')[0] ?? null;
	} else if (YOUTUBE_HOSTS.has(host)) {
		if (url.pathname === '/watch') id = url.searchParams.get('v');
		else id = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
	}
	if (id !== null && VIDEO_ID.test(id)) {
		return {
			kind: 'youtube',
			id,
			start: parseTime(url.searchParams.get('t') ?? url.searchParams.get('start'))
		};
	}
	return { kind: 'web', host: host.replace(/^www\./, '') };
}

/** A URL candidate in free text: up to the next space, quote or angle bracket. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/g;

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Drop what a sentence puts after a URL: `.`, `,`, `)` and friends. A closing
 * paren is only dropped while it is unbalanced, so `…/Salsa_(dance)` keeps its
 * own while `(see https://x.org/a)` loses the sentence's.
 */
function trimUrl(candidate: string): string {
	let out = candidate;
	for (;;) {
		const last = out.at(-1);
		if (last !== undefined && `.,;:!?'"`.includes(last)) out = out.slice(0, -1);
		else if (last === ')' && count(out, '(') < count(out, ')')) out = out.slice(0, -1);
		else return out;
	}
}

/** The links in free text, in order, each once. Used by the notes import. */
export function extractUrls(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(URL_IN_TEXT)) {
		const url = trimUrl(m[0]);
		if (parseLink(url) !== null && !out.includes(url)) out.push(url);
	}
	return out;
}

export type TextPiece = { text: string } | { url: string };

/**
 * Notes as runs of text and URLs, so a component can render the URLs as links
 * without `{@html}`. Joining every piece back gives the original text exactly.
 */
export function textPieces(text: string): TextPiece[] {
	const out: TextPiece[] = [];
	let at = 0;
	for (const m of text.matchAll(URL_IN_TEXT)) {
		const url = trimUrl(m[0]);
		const start = m.index ?? 0;
		if (parseLink(url) === null) continue;
		if (start > at) out.push({ text: text.slice(at, start) });
		out.push({ url });
		at = start + url.length;
	}
	if (at < text.length) out.push({ text: text.slice(at) });
	return out;
}

/** The "Add link" box: one URL per line. Blank lines are skipped, bad ones named. */
export function splitLinkLines(text: string): { urls: string[]; bad: string[] } {
	const urls: string[] = [];
	const bad: string[] = [];
	for (const line of text.split('\n').map((l) => l.trim())) {
		if (line === '') continue;
		if (parseLink(line) === null) bad.push(line);
		else urls.push(line);
	}
	return { urls, bad };
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** The nocookie host: no tracking cookie until the viewer actually presses play. */
export const youtubeEmbed = (id: string, start: number | null) =>
	`https://www.youtube-nocookie.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ''}`;

export const youtubeWatch = (id: string, start: number | null) =>
	`https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/links.spec.ts`
Expected: PASS, every test.

- [ ] **Step 5: Prove the tests bite**

Temporarily change `if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;`
to `return { kind: 'web', host: '' }` for non-http — the `refuses javascript:` cases
must fail. Temporarily remove the `)` branch of `trimUrl` — the `extractUrls`
paren test must fail. Restore both.

- [ ] **Step 6: Check and commit**

```bash
nix develop -c npx prettier --write src/lib/links.ts src/lib/links.spec.ts
nix develop -c npm run check
git add src/lib/links.ts src/lib/links.spec.ts
git commit -m "links: parse, extract and linkify URLs, YouTube-aware

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The type registry, practice config and the stopwatch (pure)

**Files:**

- Create: `src/lib/exercises/kinds.ts`, `src/lib/exercises/practice.ts`,
  `src/lib/exercises/stopwatch.ts`
- Test: `src/lib/exercises/kinds.spec.ts`, `src/lib/exercises/practice.spec.ts`,
  `src/lib/exercises/stopwatch.spec.ts`

**Interfaces:**

- Consumes: `Source`, `CountPattern`, `ClavePattern`, `Speed`, `SPEEDS`,
  `CLAVE_PATTERNS` from `$lib/labels`; `Dance` from `$lib/dances/dances`.
- Produces:
  - `kinds.ts`: `EXERCISE_TYPES`, `type ExerciseType = 'lesson' | 'figure' | 'drill' | 'routine'`,
    `type LogField = 'minutes' | 'reps' | 'rating' | 'note'`,
    `interface TypeInfo { type: ExerciseType; label: string; fields: readonly LogField[]; ratingQuestion: string }`,
    `TYPES: Record<ExerciseType, TypeInfo>`, `typeOf(source: Source): ExerciseType`,
    `typeInfo(source: Source): TypeInfo`, `hasField(source: Source, field: LogField): boolean`
  - `practice.ts`: `CUE_EVERY = [2, 4] as const`, `type CueEvery = 2 | 4`,
    `interface PracticeConfig { count: CountPattern; clave: ClavePattern | null; speed: Speed; callEvery: CueEvery | null }`,
    `interface PracticeInput { mode: 'count' | 'song'; songId: number | null; countBpm: number | null; config: PracticeConfig }`,
    `DEFAULT_PRACTICE_BPM = 180`, `defaultPracticeConfig(dance: Dance): PracticeConfig`,
    `parsePracticeConfig(raw: string | null, dance: Dance): PracticeConfig` (total),
    `parsePracticeInput(body: unknown, dance: Dance): PracticeInput | null`,
    `practiceSummary(p: { mode: 'count' | 'song'; bpm: number; songTitle: string | null; config: PracticeConfig }, dance: Dance): string`,
    `hourOfBars(bpm: number): number`, `minutesFrom(seconds: number): number`
  - `stopwatch.ts`: `interface Stopwatch { bankedMs: number; runningSince: number | null }`,
    `STOPPED: Stopwatch`, `startWatch(w, now)`, `pauseWatch(w, now)`, `elapsedMs(w, now): number`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/exercises/kinds.spec.ts
import { describe, expect, it } from 'vitest';
import { SOURCES } from '$lib/labels';
import { EXERCISE_TYPES, TYPES, hasField, typeInfo, typeOf } from './kinds';

describe('exercise types', () => {
	it('maps every source to exactly one type, and every type is reachable', () => {
		const types = SOURCES.map(typeOf);
		expect(new Set(types)).toEqual(new Set(EXERCISE_TYPES));
		expect(typeOf('custom')).toBe('drill');
		expect(typeOf('lesson')).toBe('lesson');
		expect(typeOf('figure')).toBe('figure');
		expect(typeOf('routine')).toBe('routine');
	});

	it('gives reps to a drill only', () => {
		expect(SOURCES.filter((s) => hasField(s, 'reps'))).toEqual(['custom']);
	});

	it('gives every type minutes, a rating and a note', () => {
		for (const s of SOURCES) {
			expect(hasField(s, 'minutes')).toBe(true);
			expect(hasField(s, 'rating')).toBe(true);
			expect(hasField(s, 'note')).toBe(true);
		}
	});

	it('asks a lesson review about memory, the rest about how it went', () => {
		expect(typeInfo('lesson').ratingQuestion).toBe('How well do you remember it?');
		expect(TYPES.figure.ratingQuestion).toBe('How did it go?');
		expect(TYPES.drill.ratingQuestion).toBe('How did it go?');
	});
});
```

```ts
// src/lib/exercises/practice.spec.ts
import { describe, expect, it } from 'vitest';
import { DANCES } from '$lib/dances/dances';
import {
	defaultPracticeConfig,
	hourOfBars,
	minutesFrom,
	parsePracticeConfig,
	parsePracticeInput,
	practiceSummary
} from './practice';

const salsa = DANCES.salsa;
const bachata = DANCES.bachata;

describe('parsePracticeConfig', () => {
	it('reads back what was written', () => {
		const c = { count: 'son', clave: '2-3', speed: 0.8, callEvery: 4 } as const;
		expect(parsePracticeConfig(JSON.stringify(c), salsa)).toEqual(c);
	});

	it.each([null, '', 'not json', '42', '[]', '{"count":7}', '{"speed":"fast"}'])(
		'falls back to the defaults for %s',
		(raw) => {
			expect(parsePracticeConfig(raw, salsa)).toEqual(defaultPracticeConfig(salsa));
		}
	);

	it('keeps the good fields of a half-bad value', () => {
		expect(parsePracticeConfig('{"count":"son","clave":"4-4"}', salsa)).toEqual({
			...defaultPracticeConfig(salsa),
			count: 'son'
		});
	});

	it('never gives bachata a clave, even from a salsa-shaped value', () => {
		expect(parsePracticeConfig('{"clave":"2-3"}', bachata).clave).toBeNull();
	});

	it('refuses a count pattern the dance does not offer', () => {
		const onlySalsa = { ...salsa, countPatterns: ['salsa'] as const };
		expect(parsePracticeConfig('{"count":"son"}', onlySalsa).count).toBe(salsa.defaultCountPattern);
	});

	it('refuses a call interval the panel does not offer', () => {
		expect(parsePracticeConfig('{"callEvery":1}', salsa).callEvery).toBeNull();
	});
});

describe('parsePracticeInput', () => {
	const config = defaultPracticeConfig(salsa);

	it('accepts count mode with a tempo, and clears the song', () => {
		expect(parsePracticeInput({ mode: 'count', songId: 9, countBpm: 150, config }, salsa)).toEqual(
			{ mode: 'count', songId: null, countBpm: 150, config }
		);
	});

	it('accepts song mode with a song id, and clears the tempo', () => {
		expect(parsePracticeInput({ mode: 'song', songId: 9, countBpm: 150, config }, salsa)).toEqual({
			mode: 'song',
			songId: 9,
			countBpm: null,
			config
		});
	});

	it.each([
		null,
		'x',
		{ mode: 'none', songId: null, countBpm: 150, config },
		{ mode: 'count', songId: null, countBpm: 59, config },
		{ mode: 'count', songId: null, countBpm: 301, config },
		{ mode: 'count', songId: null, countBpm: 150.5, config },
		{ mode: 'song', songId: null, countBpm: null, config },
		{ mode: 'song', songId: -1, countBpm: null, config }
	])('refuses %j', (body) => {
		expect(parsePracticeInput(body, salsa)).toBeNull();
	});

	it('makes a garbage config total rather than refusing the whole body', () => {
		expect(
			parsePracticeInput({ mode: 'count', songId: null, countBpm: 150, config: 'junk' }, salsa)
				?.config
		).toEqual(defaultPracticeConfig(salsa));
	});
});

describe('practiceSummary', () => {
	it('names the tempo, the count and the clave', () => {
		expect(
			practiceSummary(
				{
					mode: 'count',
					bpm: 180,
					songTitle: null,
					config: { count: 'son', clave: '2-3', speed: 1, callEvery: null }
				},
				salsa
			)
		).toBe('Count 180 · 2 3 4 · 6 7 8 · clave 2-3');
	});
	it('names the song and a slowed speed', () => {
		expect(
			practiceSummary(
				{
					mode: 'song',
					bpm: 180,
					songTitle: 'El Cantante',
					config: { count: 'salsa', clave: null, speed: 0.8, callEvery: 2 }
				},
				salsa
			)
		).toBe('El Cantante 0.8× · 1 2 3 · 5 6 7 · call every 2');
	});
});

describe('sizes', () => {
	it('sizes a count-only grid for an hour', () => {
		// 180 beats a minute for 60 minutes, 8 beats an 8-count.
		expect(hourOfBars(180)).toBe(1350);
	});
	it('rounds minutes, never below one', () => {
		expect(minutesFrom(0)).toBe(1);
		expect(minutesFrom(29)).toBe(1);
		expect(minutesFrom(90)).toBe(2);
		expect(minutesFrom(600)).toBe(10);
	});
});
```

```ts
// src/lib/exercises/stopwatch.spec.ts
import { describe, expect, it } from 'vitest';
import { STOPPED, elapsedMs, pauseWatch, startWatch } from './stopwatch';

describe('stopwatch', () => {
	it('counts running time and leaves pauses out', () => {
		let w = startWatch(STOPPED, 1_000);
		expect(elapsedMs(w, 4_000)).toBe(3_000);
		w = pauseWatch(w, 4_000);
		expect(elapsedMs(w, 60_000)).toBe(3_000);
		w = startWatch(w, 60_000);
		expect(elapsedMs(w, 62_000)).toBe(5_000);
	});

	it('ignores a second start or a second pause', () => {
		const running = startWatch(STOPPED, 1_000);
		expect(startWatch(running, 5_000)).toBe(running);
		const paused = pauseWatch(running, 2_000);
		expect(pauseWatch(paused, 9_000)).toBe(paused);
	});

	it('never goes negative if the clock steps backwards', () => {
		expect(elapsedMs(startWatch(STOPPED, 5_000), 4_000)).toBe(0);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/exercises`
Expected: FAIL — the three modules do not exist.

- [ ] **Step 3: Write the implementations**

```ts
// src/lib/exercises/kinds.ts
/**
 * An exercise's TYPE, and what that fixes. PURE and client-safe.
 *
 * The type is derived from `source` rather than stored: the four sources
 * already are the four types, one to one, and a `kind` column that could only
 * ever repeat `source` would be a second copy of one fact. The day two
 * exercises of one source need different fields, that is a new type — and
 * then, only then, a column.
 *
 * The rule from the guitar app: the type fixes which fields exist; instances
 * differ only in content. Two figure exercises never differ in whether they
 * have a rating.
 */
import type { Source } from '$lib/labels';

export const EXERCISE_TYPES = ['lesson', 'figure', 'drill', 'routine'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export type LogField = 'minutes' | 'reps' | 'rating' | 'note';

export interface TypeInfo {
	type: ExerciseType;
	label: string;
	/** The fields the log form shows AND the log action stores. Anything else posted is dropped. */
	fields: readonly LogField[];
	ratingQuestion: string;
}

const BY_SOURCE: Record<Source, ExerciseType> = {
	lesson: 'lesson',
	figure: 'figure',
	custom: 'drill',
	routine: 'routine'
};

export const TYPES: Record<ExerciseType, TypeInfo> = {
	lesson: {
		type: 'lesson',
		label: 'Lesson review',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How well do you remember it?'
	},
	figure: {
		type: 'figure',
		label: 'Figure practice',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	},
	// Reps stay here because a drill is where they mean something: clave
	// clapping, a hundred basics. A figure is danced, not counted.
	drill: {
		type: 'drill',
		label: 'Drill',
		fields: ['minutes', 'reps', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	},
	routine: {
		type: 'routine',
		label: 'Routine',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	}
};

export const typeOf = (source: Source): ExerciseType => BY_SOURCE[source];
export const typeInfo = (source: Source): TypeInfo => TYPES[typeOf(source)];
export const hasField = (source: Source, field: LogField): boolean =>
	typeInfo(source).fields.includes(field);
```

```ts
// src/lib/exercises/practice.ts
/**
 * What the practice panel remembers per exercise, and how it is read back.
 * PURE and client-safe: the panel parses with it, the endpoint validates with
 * it.
 *
 * `parsePracticeConfig` is TOTAL — the guitar app's rule for per-type JSON.
 * Whatever is in `exercises.practice_json` (nothing, an older shape, a
 * hand-edited value, a salsa clave on a bachata row), a popup always gets a
 * config it can play. A throw here would be a popup that cannot open.
 */
import {
	CLAVE_PATTERNS,
	COUNT_PATTERN_LABEL,
	SPEEDS,
	type ClavePattern,
	type CountPattern,
	type Speed
} from '$lib/labels';
import type { Dance } from '$lib/dances/dances';

/** How often "call on cue" names the figure, in 8-counts. */
export const CUE_EVERY = [2, 4] as const;
export type CueEvery = (typeof CUE_EVERY)[number];

export interface PracticeConfig {
	count: CountPattern;
	clave: ClavePattern | null;
	speed: Speed;
	callEvery: CueEvery | null;
}

export interface PracticeInput {
	mode: 'count' | 'song';
	songId: number | null;
	countBpm: number | null;
	config: PracticeConfig;
}

/** The count-only tempo when an exercise has never been practised: the player's own default. */
export const DEFAULT_PRACTICE_BPM = 180;

export function defaultPracticeConfig(dance: Dance): PracticeConfig {
	return { count: dance.defaultCountPattern, clave: null, speed: 1, callEvery: null };
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
	return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function configFrom(value: unknown, dance: Dance): PracticeConfig {
	const d = defaultPracticeConfig(dance);
	if (!value || typeof value !== 'object' || Array.isArray(value)) return d;
	const v = value as Record<string, unknown>;
	return {
		count: oneOf(v.count, dance.countPatterns, d.count),
		// A dance without clave never gets one back, whatever was stored.
		clave: dance.clave ? oneOf(v.clave, [...CLAVE_PATTERNS, null], null) : null,
		speed: oneOf(v.speed, SPEEDS, d.speed),
		callEvery: oneOf(v.callEvery, [...CUE_EVERY, null], null)
	};
}

export function parsePracticeConfig(raw: string | null, dance: Dance): PracticeConfig {
	if (!raw) return defaultPracticeConfig(dance);
	try {
		return configFrom(JSON.parse(raw), dance);
	} catch {
		return defaultPracticeConfig(dance);
	}
}

const isInt = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * The panel's POST body, or null. Unlike the config, the mode and its pairing
 * are NOT made total: a body that names song mode without a song is a bug to
 * refuse, not a value to guess at. The unused half of the pair is cleared, the
 * rule `updateExercise` used to enforce for the settings form.
 */
export function parsePracticeInput(body: unknown, dance: Dance): PracticeInput | null {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;
	const config = configFrom(b.config, dance);
	if (b.mode === 'count' && isInt(b.countBpm, 60, 300)) {
		return { mode: 'count', songId: null, countBpm: b.countBpm, config };
	}
	if (b.mode === 'song' && isInt(b.songId, 1, Number.MAX_SAFE_INTEGER)) {
		return { mode: 'song', songId: b.songId, countBpm: null, config };
	}
	return null;
}

/** The panel's one collapsed line: "Count 180 · 2 3 4 · 6 7 8 · clave 2-3". */
export function practiceSummary(
	p: { mode: 'count' | 'song'; bpm: number; songTitle: string | null; config: PracticeConfig },
	dance: Dance
): string {
	const parts = [
		p.mode === 'song' && p.songTitle !== null
			? `${p.songTitle}${p.config.speed === 1 ? '' : ` ${p.config.speed}×`}`
			: `Count ${p.bpm}`,
		COUNT_PATTERN_LABEL[p.config.count]
	];
	if (dance.clave && p.config.clave) parts.push(`clave ${p.config.clave}`);
	if (p.config.callEvery) parts.push(`call every ${p.config.callEvery}`);
	return parts.join(' · ');
}

/**
 * 8-counts in an hour at `bpm`. The player page's 400 bars is about eighteen
 * minutes at 180, and a count-only practice that stops by itself mid-session
 * reads as a bug.
 */
export const hourOfBars = (bpm: number) => Math.ceil((bpm * 60) / 8);

/** Seconds as the whole minutes the form shows — never 0, since you did practise. */
export const minutesFrom = (seconds: number) => Math.max(1, Math.round(seconds / 60));
```

```ts
// src/lib/exercises/stopwatch.ts
/**
 * Wall-clock time spent practising, pauses left out. PURE: `now` is always an
 * argument, so the panel can test nothing and this file can test everything.
 *
 * Wall clock, not song time, on purpose: the full player logs SONG seconds, so
 * a run at 0.7× under-reports the time actually spent (a known gap in the main
 * design). The panel's minutes are the minutes you stood there dancing.
 */
export interface Stopwatch {
	/** Time already banked by earlier runs. */
	bankedMs: number;
	/** When the current run started, or null while paused or stopped. */
	runningSince: number | null;
}

export const STOPPED: Stopwatch = { bankedMs: 0, runningSince: null };

export function startWatch(w: Stopwatch, now: number): Stopwatch {
	return w.runningSince !== null ? w : { ...w, runningSince: now };
}

export function pauseWatch(w: Stopwatch, now: number): Stopwatch {
	return w.runningSince === null ? w : { bankedMs: elapsedMs(w, now), runningSince: null };
}

export function elapsedMs(w: Stopwatch, now: number): number {
	return w.bankedMs + (w.runningSince === null ? 0 : Math.max(0, now - w.runningSince));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/exercises`
Expected: PASS.

Note: `practiceSummary`'s expected strings depend on `COUNT_PATTERN_LABEL`
(`son: '2 3 4 · 6 7 8'`, `salsa: '1 2 3 · 5 6 7'`). If a label differs, fix
the test's expectation to the label, not the label.

- [ ] **Step 5: Prove the tests bite**

Remove the `dance.clave ? … : null` guard in `configFrom` (always parse clave)
— the bachata test must fail. Change `custom: 'drill'` to `custom: 'figure'` —
the reps test must fail. Restore both.

- [ ] **Step 6: Check and commit**

```bash
nix develop -c npx prettier --write src/lib/exercises
nix develop -c npm run check
git add src/lib/exercises
git commit -m "exercises: the type registry, practice config and a wall-clock stopwatch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Schema — `links`, `app_flags`, `exercises.practice_json`

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0008_<generated>.sql`, `drizzle/meta/0008_snapshot.json`,
  `drizzle/meta/_journal.json` (all generated)

**Interfaces:**

- Produces: `links` table (`id, lessonId, figureId, exerciseId, url, title,
  createdAt`), `appFlags` table (`key, doneAt`), `exercises.practiceJson`.

- [ ] **Step 1: Add the column to `exercises`**

In `src/lib/server/db/schema.ts`, inside the `exercises` columns, directly
after `countBpm: integer('count_bpm'),` add:

```ts
		/**
		 * What the practice panel last played for this exercise, beyond the mode,
		 * song and tempo above: `{ count, clave, speed, callEvery }`. Read through
		 * `parsePracticeConfig` in `$lib/exercises/practice`, which is total — so
		 * no value here, however odd, can stop a popup from opening. Nullable and
		 * added by plain ADD COLUMN: no CHECK on this table, ever (see below).
		 */
		practiceJson: text('practice_json'),
```

- [ ] **Step 2: Add the two tables**

At the end of the `/* ── Lessons ── */` section — directly after the
`lessonExercises` table and before `/* ── The count voice ── */` — add:

```ts
/* ── Links ──────────────────────────────────────────────────────────────── */

/**
 * A URL attached to a lesson, a figure or a drill (a custom exercise). A
 * YouTube URL renders as an embed; anything else as a plain link. See
 * `src/lib/links.ts` for what is accepted — only http and https.
 *
 * Exactly one owner. The CHECK is safe here because this table is NEW: the
 * "never add a CHECK" rule is about drizzle-kit rebuilding an EXISTING table.
 * "Drills only" for `exercise_id` is not expressible as a CHECK and lives in
 * `src/lib/server/links.ts`.
 *
 * No `dance` column: a link is the dance of its owner, resolved through the
 * owner the same way sets and recordings are. Hard-deleted, like a recording.
 */
export const links = sqliteTable(
	'links',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		lessonId: integer('lesson_id').references(() => lessons.id),
		figureId: integer('figure_id').references(() => figures.id),
		exerciseId: integer('exercise_id').references(() => exercises.id),
		url: text('url').notNull(),
		/** The user's label; null shows the host. */
		title: text('title'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'links_owner_ck',
			sql`(${t.lessonId} is not null) + (${t.figureId} is not null) + (${t.exerciseId} is not null) = 1`
		),
		index('links_lesson_idx').on(t.lessonId),
		index('links_figure_idx').on(t.figureId),
		index('links_exercise_idx').on(t.exerciseId)
	]
);

/* ── One-off steps ──────────────────────────────────────────────────────── */

/**
 * Markers for boot steps that must run once EVER, not once per boot — the
 * first is copying the URLs out of lesson notes into `links`
 * (`importNoteLinks`). A migration cannot do that job (SQLite has no regex),
 * and "run when the target is empty" would re-import a link the user deleted.
 */
export const appFlags = sqliteTable('app_flags', {
	key: text('key').primaryKey(),
	doneAt: integer('done_at').notNull()
});
```

- [ ] **Step 3: Generate the migration**

Run: `nix develop -c npm run db:generate`
Expected: a new `drizzle/0008_<name>.sql` and an updated journal.

- [ ] **Step 4: Read the generated SQL**

Run: `cat drizzle/0008_*.sql`
Expected, in some order: `CREATE TABLE \`app_flags\``, `CREATE TABLE \`links\``
(with `links_owner_ck` and three foreign keys), three `CREATE INDEX`, and
`ALTER TABLE \`exercises\` ADD \`practice_json\` text;`. **If there is any
`DROP`, any `__new_exercises`, or any `PRAGMA foreign_keys`, stop — do not
commit — and report.**

- [ ] **Step 5: Apply it to a copy of the dev database**

```bash
S=/tmp/claude-1000/-home-tilen-Projects-salsaapp/migrate-check
mkdir -p "$S" && cp .data/salsa.db "$S/copy.db"
nix develop -c sqlite3 "$S/copy.db" < drizzle/0008_*.sql
nix develop -c sqlite3 "$S/copy.db" ".schema links" ".schema app_flags" \
  "select sql from sqlite_master where name='exercises';"
nix develop -c sqlite3 "$S/copy.db" \
  "insert into links (lesson_id, url, created_at) select id, 'https://a.org', 0 from lessons limit 1;" \
  "insert into links (url, created_at) values ('https://b.org', 0);"
```

Expected: the schemas print; `exercises` still carries `exercises_source_ck`
and `exercises_every_days_ck` verbatim and now ends with `practice_json`; the
first insert succeeds (if the dev DB has no lessons it inserts nothing, which
is fine); the second fails with `CHECK constraint failed: links_owner_ck`.
Then `rm -r "$S"`.

(If `.data/salsa.db` does not exist, run `nix develop -c npx vitest run src/lib/server/data.spec.ts`
instead — every spec opens `:memory:` and runs every migration — and say so in
the task report.)

- [ ] **Step 6: Check and commit**

```bash
nix develop -c npm run check
git add src/lib/server/db/schema.ts drizzle
git commit -m "schema: links, app_flags, and exercises.practice_json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Links data — add, list, delete, and the one-time notes import

**Files:**

- Create: `src/lib/server/links.ts`
- Modify: `src/lib/server/db/bootstrap.ts`, `src/lib/types.ts`
- Test: `src/lib/server/links.spec.ts`

**Interfaces:**

- Consumes: `links`, `appFlags`, `lessons`, `figures`, `exercises` from the
  schema (Task 3); `extractUrls`, `parseLink` from `$lib/links` (Task 1).
- Produces:
  - `types.ts`: `interface LinkRow { id: number; url: string; title: string | null; createdAt: number }`
  - `type LinkOwner = { lessonId: number } | { figureId: number } | { exerciseId: number }`
  - `listLinks(db: Db, owner: LinkOwner): LinkRow[]` — insertion order
  - `addLinks(db: Db, owner: LinkOwner, urls: string[], title: string | null): LinkRow[] | null`
    — `null` when the owner is an exercise that is not `source='custom'`;
    skips a URL the owner already has and any URL `parseLink` refuses; the
    title applies only when exactly one URL is added
  - `deleteLink(db: Db, owner: LinkOwner, id: number): boolean`
  - `NOTE_LINKS_FLAG = 'lesson-note-links'`
  - `importNoteLinks(db: Db, now: number): number` — links added; 0 when already run

- [ ] **Step 1: Add the row type**

In `src/lib/types.ts`, after `LessonVideoRow`, add:

```ts
/** A link on a lesson, a figure or a drill. See `src/lib/links.ts`. */
export interface LinkRow {
	id: number;
	url: string;
	/** The user's label, or null to show the host. */
	title: string | null;
	createdAt: number;
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/server/links.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { appFlags, links } from './db/schema';
import { createCustomExercise } from './exercises';
import { createFigure } from './figures';
import { createLesson, updateLesson } from './lessons';
import { addLinks, deleteLink, importNoteLinks, listLinks, NOTE_LINKS_FLAG } from './links';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	name: 'Enchufla',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null,
	callable: true,
	callText: null
};
const lessonOn = (notes: string | null) =>
	createLesson(db, 'salsa', { lessonDay: '2026-09-20', title: 'Class', notes }).lesson;

describe('links', () => {
	it('adds, lists in insertion order, and deletes on each kind of owner', () => {
		const lesson = lessonOn(null);
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const drill = createCustomExercise(db, 'salsa', { name: 'Son switch', everyDays: 2, notes: null });

		for (const owner of [{ lessonId: lesson.id }, { figureId: figure.id }, { exerciseId: drill.id }]) {
			const added = addLinks(db, owner, ['https://a.org/1', 'https://b.org/2'], null)!;
			expect(listLinks(db, owner).map((l) => l.url)).toEqual(['https://a.org/1', 'https://b.org/2']);
			expect(deleteLink(db, owner, added[0].id)).toBe(true);
			expect(listLinks(db, owner).map((l) => l.url)).toEqual(['https://b.org/2']);
		}
	});

	it('applies a title only to a single added URL', () => {
		const owner = { lessonId: lessonOn(null).id };
		expect(addLinks(db, owner, ['https://a.org'], 'Teacher demo')![0].title).toBe('Teacher demo');
		expect(addLinks(db, owner, ['https://b.org', 'https://c.org'], 'Ignored')!.map((l) => l.title)).toEqual([
			null,
			null
		]);
	});

	it('skips a URL the owner already has, and refuses a non-http one', () => {
		const owner = { lessonId: lessonOn(null).id };
		addLinks(db, owner, ['https://a.org'], null);
		expect(addLinks(db, owner, ['https://a.org', 'javascript:x', 'https://b.org'], null)!.map((l) => l.url)).toEqual(
			['https://b.org']
		);
		expect(listLinks(db, owner)).toHaveLength(2);
	});

	it('refuses links on an exercise a figure, lesson or routine owns', () => {
		const { exercise } = createFigure(db, 'salsa', figureInput)!;
		expect(addLinks(db, { exerciseId: exercise.id }, ['https://a.org'], null)).toBeNull();
		expect(db.select().from(links).all()).toHaveLength(0);
	});

	it('will not delete another owner’s link', () => {
		const a = { lessonId: lessonOn(null).id };
		const b = { lessonId: lessonOn(null).id };
		const [link] = addLinks(db, a, ['https://a.org'], null)!;
		expect(deleteLink(db, b, link.id)).toBe(false);
		expect(listLinks(db, a)).toHaveLength(1);
	});
});

describe('importNoteLinks', () => {
	it('copies the URLs out of lesson notes, once, without editing the notes', () => {
		const lesson = lessonOn('Great class (https://youtu.be/dQw4w9WgXcQ). See https://a.org/x.');
		lessonOn(null);
		expect(importNoteLinks(db, 1_000)).toBe(2);
		expect(listLinks(db, { lessonId: lesson.id }).map((l) => l.url)).toEqual([
			'https://youtu.be/dQw4w9WgXcQ',
			'https://a.org/x'
		]);
		expect(db.select().from(appFlags).all()).toEqual([{ key: NOTE_LINKS_FLAG, doneAt: 1_000 }]);
	});

	it('never runs again, so a deleted link stays deleted', () => {
		const lesson = lessonOn('https://a.org/x');
		importNoteLinks(db, 1_000);
		const [only] = listLinks(db, { lessonId: lesson.id });
		deleteLink(db, { lessonId: lesson.id }, only.id);
		updateLesson(db, lesson.id, { lessonDay: '2026-09-20', title: 'Class', notes: 'https://a.org/x https://b.org' });
		expect(importNoteLinks(db, 2_000)).toBe(0);
		expect(listLinks(db, { lessonId: lesson.id })).toEqual([]);
	});

	it('skips a URL the lesson already links', () => {
		const lesson = lessonOn('https://a.org/x');
		addLinks(db, { lessonId: lesson.id }, ['https://a.org/x'], 'Mine');
		expect(importNoteLinks(db, 1_000)).toBe(0);
		expect(listLinks(db, { lessonId: lesson.id }).map((l) => l.title)).toEqual(['Mine']);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/links.spec.ts`
Expected: FAIL — `./links` does not exist.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/server/links.ts
import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { appFlags, exercises, lessons, links } from './db/schema';
import { extractUrls, parseLink } from '$lib/links';
import type { LinkRow } from '$lib/types';

/** Who a link belongs to. Exactly one — the table's CHECK says the same. */
export type LinkOwner = { lessonId: number } | { figureId: number } | { exerciseId: number };

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const row = {
	id: links.id,
	url: links.url,
	title: links.title,
	createdAt: links.createdAt
};

function ownedBy(owner: LinkOwner): SQL {
	if ('lessonId' in owner) return eq(links.lessonId, owner.lessonId);
	if ('figureId' in owner) return eq(links.figureId, owner.figureId);
	return eq(links.exerciseId, owner.exerciseId);
}

export function listLinks(db: Db, owner: LinkOwner): LinkRow[] {
	return db
		.select(row)
		.from(links)
		.where(ownedBy(owner))
		.orderBy(asc(links.createdAt), asc(links.id))
		.all();
}

function insertLinks(tx: Tx, owner: LinkOwner, urls: string[], title: string | null): LinkRow[] {
	const have = new Set(
		tx.select({ url: links.url }).from(links).where(ownedBy(owner)).all().map((l) => l.url)
	);
	const fresh = urls
		.map((u) => u.trim())
		.filter((u, i, all) => parseLink(u) !== null && !have.has(u) && all.indexOf(u) === i);
	return fresh.map((url) =>
		tx
			.insert(links)
			.values({ ...owner, url, title: fresh.length === 1 ? title : null })
			.returning(row)
			.get()
	);
}

/**
 * Add links, skipping any the owner already has. Null when the owner is an
 * exercise that a figure, lesson or routine owns: that exercise shows its
 * OWNER's links, and a second place to attach one would make "where does this
 * link live?" unanswerable — the rule `lesson_exercises` follows for a figure's
 * exercise.
 */
export function addLinks(
	db: Db,
	owner: LinkOwner,
	urls: string[],
	title: string | null
): LinkRow[] | null {
	if ('exerciseId' in owner) {
		const ex = db.select({ source: exercises.source }).from(exercises).where(eq(exercises.id, owner.exerciseId)).get();
		if (ex?.source !== 'custom') return null;
	}
	return db.transaction((tx) => insertLinks(tx, owner, urls, title));
}

/** Delete one link, only if it belongs to `owner` — so a posted id cannot reach another page's link. */
export function deleteLink(db: Db, owner: LinkOwner, id: number): boolean {
	return db.delete(links).where(and(eq(links.id, id), ownedBy(owner))).run().changes > 0;
}

export const NOTE_LINKS_FLAG = 'lesson-note-links';

/**
 * Copy every URL typed into a lesson's notes into that lesson's links, ONCE
 * EVER. The marker row and the links go in one transaction, and the marker is
 * claimed first: if it was already there, nothing happens — so a link deleted
 * after the import stays deleted. The notes themselves are left alone; they
 * render linkified anyway.
 */
export function importNoteLinks(db: Db, now: number): number {
	return db.transaction((tx) => {
		const claimed = tx
			.insert(appFlags)
			.values({ key: NOTE_LINKS_FLAG, doneAt: now })
			.onConflictDoNothing()
			.run();
		if (claimed.changes === 0) return 0;
		let added = 0;
		for (const lesson of tx.select({ id: lessons.id, notes: lessons.notes }).from(lessons).all()) {
			if (!lesson.notes) continue;
			added += insertLinks(tx, { lessonId: lesson.id }, extractUrls(lesson.notes), null).length;
		}
		return added;
	});
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/links.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the import at boot**

In `src/lib/server/db/bootstrap.ts`, import `importNoteLinks` from `'../links'`
and extend the `seedPositions` step:

```ts
		.then(() => {
			// The handhold vocabulary, per dance, if that dance has none. Cheap and
			// idempotent, and the figure pickers are empty without it.
			seedPositions(getDb());
			// Lesson notes carried their YouTube links as plain text before links
			// existed. Copied out once EVER — `app_flags` remembers — so a link the
			// user deletes afterwards is never brought back by a restart.
			importNoteLinks(getDb(), Date.now());
		})
```

- [ ] **Step 7: Prove the tests bite, check and commit**

Delete the `if (claimed.changes === 0) return 0;` line — the "never runs again"
test must fail. Remove the `ex?.source !== 'custom'` guard — the "refuses links
on an exercise a figure owns" test must fail. Restore both.

```bash
nix develop -c npx prettier --write src/lib/server/links.ts src/lib/server/links.spec.ts src/lib/server/db/bootstrap.ts src/lib/types.ts
nix develop -c npm run check
git add src/lib/server/links.ts src/lib/server/links.spec.ts src/lib/server/db/bootstrap.ts src/lib/types.ts
git commit -m "links: data functions, and copying lesson-note URLs in once at boot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Exercise data — settings vs practice, history, last sets, "taught in"

**Files:**

- Modify: `src/lib/server/exercises.ts`, `src/lib/server/lessons.ts`,
  `src/lib/types.ts`, `src/lib/labels.ts`
- Modify (tests): `src/lib/server/data.spec.ts`, `src/lib/server/lessons.spec.ts`,
  `src/routes/[dance]/+page.server.ts` (compile fix only — see Step 7)

**Interfaces:**

- Consumes: `PracticeInput` from `$lib/exercises/practice` (Task 2);
  `exercises.practiceJson` (Task 3).
- Produces:
  - `types.ts`: `ExerciseItem.practiceJson: string | null`;
    `interface HistorySet { id: number; doneAt: number; durationS: number | null; reps: number | null; rating: number | null; note: string | null }`;
    `interface ExerciseSummary { sets: number; totalS: number; recentRating: number | null }`;
    `interface LastSet extends HistorySet { daysAgo: number }`
  - `exercises.ts`:
    - `interface SettingsInput { name: string; everyDays: number; active: boolean; notes: string | null }`
    - `updateExercise(db, id, input: SettingsInput)` — settings only now
    - `setPracticeSettings(db: Db, id: number, input: PracticeInput): boolean`
    - `exerciseHistory(db: Db, id: number, limit = 200): HistorySet[]` — newest first
    - `exerciseSummary(db: Db, id: number): ExerciseSummary` — `recentRating` is the mean of the last 5 rated sets, one decimal
    - `lastSets(db: Db, dance: DanceSlug): Map<number, HistorySet>` — latest set per exercise
    - `lastSet(db: Db, exerciseId: number): HistorySet | null`
  - `lessons.ts`: `taughtIn(db: Db, figureId: number): { id: number; title: string; lessonDay: string }[]`
    — unarchived lessons linking the figure, newest `lessonDay` first
- Removes: `ExerciseInput`, `PRACTICE_LABEL`.

- [ ] **Step 1: Update the types**

In `src/lib/types.ts`: add `practiceJson: string | null;` to `ExerciseItem`
directly after `countBpm`, with the doc comment
`/** The panel's remembered count/clave/speed/cue. Read with \`parsePracticeConfig\`. */`.
Then add after `DaySet`:

```ts
/** One set as an exercise's own history lists it. */
export interface HistorySet {
	id: number;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
}

/** The latest set, with how many calendar days ago it was in the user's zone. */
export interface LastSet extends HistorySet {
	daysAgo: number;
}

/** The line on top of an exercise's history. */
export interface ExerciseSummary {
	sets: number;
	/** Every logged duration, summed. Sets with no duration add nothing. */
	totalS: number;
	/** Mean of the latest five rated sets, to one decimal; null when none is rated. */
	recentRating: number | null;
}
```

In `src/lib/labels.ts`, delete `PRACTICE_LABEL` (the panel replaces the radio
that used it). Keep `PRACTICE_MODES` — the schema uses it.

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/server/data.spec.ts` (add `songs` is already imported;
add the new functions to the `./exercises` import and `createLesson`,
`linkFigure`, `archiveLesson`, `taughtIn` from `./lessons`):

```ts
describe('practice settings', () => {
	const config = { count: 'son' as const, clave: '2-3' as const, speed: 1 as const, callEvery: null };
	const readySong = (dance: 'salsa' | 'bachata') => {
		const s = createSongFromUpload(db, dance, {
			file: `${dance}.m4a`,
			mime: 'audio/mp4',
			title: 'Song',
			style: 'salsa'
		});
		db.update(songs).set({ status: 'ready' }).where(eq(songs.id, s.id)).run();
		return s;
	};

	it('stores count mode with its tempo and config, clearing the song', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		expect(setPracticeSettings(db, e.id, { mode: 'count', songId: null, countBpm: 150, config })).toBe(true);
		const row = getExercise(db, e.id)!;
		expect([row.practiceMode, row.countBpm, row.songId]).toEqual(['count', 150, null]);
		expect(JSON.parse(row.practiceJson!)).toEqual(config);
	});

	it('stores a ready song of the same dance, clearing the tempo', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		const song = readySong('salsa');
		expect(setPracticeSettings(db, e.id, { mode: 'song', songId: song.id, countBpm: null, config })).toBe(true);
		expect(getExercise(db, e.id)?.songId).toBe(song.id);
	});

	it('refuses a song from the other dance, or one that is not ready', () => {
		const e = createCustomExercise(db, 'bachata', { name: 'Footwork', everyDays: 2, notes: null });
		const salsaSong = readySong('salsa');
		expect(setPracticeSettings(db, e.id, { mode: 'song', songId: salsaSong.id, countBpm: null, config })).toBe(false);
		const waiting = createSongFromUpload(db, 'bachata', { file: 'w.m4a', mime: 'audio/mp4', title: 'W', style: 'sensual' });
		expect(setPracticeSettings(db, e.id, { mode: 'song', songId: waiting.id, countBpm: null, config })).toBe(false);
		expect(getExercise(db, e.id)?.practiceMode).toBe('none');
	});
});

describe('history', () => {
	const set = (exerciseId: number, doneAt: number, extra: Partial<ReturnType<typeof bareSet>> = {}) =>
		logSet(db, { ...bareSet(exerciseId, doneAt), ...extra });

	it('lists an exercise’s sets newest first, capped', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		for (let i = 1; i <= 5; i++) set(e.id, i * 1000);
		expect(exerciseHistory(db, e.id, 3).map((s) => s.doneAt)).toEqual([5000, 4000, 3000]);
	});

	it('summarises every set, and averages the latest five rated ones', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		set(e.id, 1, { rating: 1, durationS: 60 });
		for (let i = 2; i <= 6; i++) set(e.id, i, { rating: 4, durationS: 120 });
		set(e.id, 7); // unrated, no duration
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 7, totalS: 660, recentRating: 4 });
	});

	it('summarises an exercise with no sets', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 0, totalS: 0, recentRating: null });
	});

	it('finds the latest set per exercise, within one dance', () => {
		const a = createCustomExercise(db, 'salsa', { name: 'A', everyDays: 1, notes: null });
		const b = createCustomExercise(db, 'bachata', { name: 'B', everyDays: 1, notes: null });
		set(a.id, 1000, { rating: 2 });
		set(a.id, 3000, { rating: 5, note: 'clean' });
		set(b.id, 2000, { rating: 1 });
		const last = lastSets(db, 'salsa');
		expect([...last.keys()]).toEqual([a.id]);
		expect(last.get(a.id)).toMatchObject({ doneAt: 3000, rating: 5, note: 'clean' });
		expect(lastSet(db, a.id)?.doneAt).toBe(3000);
		expect(lastSet(db, createCustomExercise(db, 'salsa', { name: 'C', everyDays: 1, notes: null }).id)).toBeNull();
	});
});

describe('taught in', () => {
	it('lists the live lessons that linked a figure, newest first', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const older = createLesson(db, 'salsa', { lessonDay: '2026-09-01', title: 'Older', notes: null }).lesson;
		const newer = createLesson(db, 'salsa', { lessonDay: '2026-09-20', title: 'Newer', notes: null }).lesson;
		const gone = createLesson(db, 'salsa', { lessonDay: '2026-09-10', title: 'Gone', notes: null }).lesson;
		for (const l of [older, newer, gone]) linkFigure(db, l.id, figure.id);
		archiveLesson(db, gone.id, 1);
		expect(taughtIn(db, figure.id).map((l) => l.title)).toEqual(['Newer', 'Older']);
	});
});
```

Also add `import { eq } from 'drizzle-orm';` at the top of `data.spec.ts`.

- [ ] **Step 3: Rewrite the three existing `updateExercise` practice tests**

In `src/lib/server/data.spec.ts`:

- Delete the `base` constant (line ~52) and its comment.
- Every remaining `updateExercise(db, id, { ...base, …})` call (line ~139):
  drop `...base`, keep `name`, `everyDays`, `active`, `notes`.
- **Delete** the test `'clears the unused practice column when the mode changes'`
  — `parsePracticeInput` (Task 2) now owns the pairing and its tests cover it.
- **Delete** the test `'refuses to point an exercise at a song from another dance'`
  — the new `'refuses a song from the other dance, or one that is not ready'`
  replaces it.

In `src/lib/server/lessons.spec.ts` (~line 117), drop `practiceMode`, `songId`
and `countBpm` from the `updateExercise` call.

- [ ] **Step 4: Run the tests to verify the new ones fail**

Run: `nix develop -c npx vitest run src/lib/server/data.spec.ts`
Expected: FAIL — `setPracticeSettings`, `exerciseHistory`, … are not exported.

- [ ] **Step 5: Write the implementation in `exercises.ts`**

Add `practiceJson: exercises.practiceJson,` to `listExercises`'s select, after
`countBpm`. Replace `ExerciseInput`, `createCustomExercise`'s parameter type
and `updateExercise` with:

```ts
/** What the exercise page's settings form edits. Practice choices are the panel's, not these. */
export interface SettingsInput {
	name: string;
	everyDays: number;
	active: boolean;
	notes: string | null;
}

export function createCustomExercise(
	db: Db,
	dance: DanceSlug,
	input: Omit<SettingsInput, 'active'>
) {
	return db
		.insert(exercises)
		.values({ ...input, source: 'custom', dance })
		.returning()
		.get();
}

/**
 * Edit an exercise's settings. An owned exercise takes its NAME from its owner
 * (figure, lesson, routine), so a name passed for one is ignored rather than
 * letting the two drift apart.
 */
export function updateExercise(db: Db, id: number, input: SettingsInput) {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return null;
	const name = current.source === 'custom' && input.name ? input.name : current.name;
	return db
		.update(exercises)
		.set({ ...input, name })
		.where(eq(exercises.id, id))
		.returning()
		.get();
}

/**
 * Remember what the practice panel played. A song must be READY and in the
 * exercise's own dance: the pairing has no CHECK to lean on (see `schema.ts`),
 * and a stored song the panel cannot open would greet the user with an error
 * the next time. `parsePracticeInput` has already cleared the unused half of
 * the mode's pair.
 */
export function setPracticeSettings(db: Db, id: number, input: PracticeInput): boolean {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return false;
	if (input.mode === 'song') {
		const song = input.songId === null ? null : db.select().from(songs).where(eq(songs.id, input.songId)).get();
		if (!song || song.dance !== current.dance || song.status !== 'ready' || song.archivedAt !== null) {
			return false;
		}
	}
	db.update(exercises)
		.set({
			practiceMode: input.mode,
			songId: input.songId,
			countBpm: input.countBpm,
			practiceJson: JSON.stringify(input.config)
		})
		.where(eq(exercises.id, id))
		.run();
	return true;
}
```

Add `import type { PracticeInput } from '$lib/exercises/practice';` and extend
the drizzle import with `count, sql, sum`. Then append:

```ts
const historyRow = {
	id: sets.id,
	doneAt: sets.doneAt,
	durationS: sets.durationS,
	reps: sets.reps,
	rating: sets.rating,
	note: sets.note
};

/** An exercise's sets, newest first. The page shows the latest `limit`; the summary counts all. */
export function exerciseHistory(db: Db, id: number, limit = 200): HistorySet[] {
	return db
		.select(historyRow)
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.orderBy(desc(sets.doneAt), desc(sets.id))
		.limit(limit)
		.all();
}

/** How many ratings "recent" means on the summary line. */
const RECENT_RATED = 5;

export function exerciseSummary(db: Db, id: number): ExerciseSummary {
	const totals = db
		.select({ sets: count(), totalS: sum(sets.durationS) })
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.get();
	const rated = db
		.select({ rating: sets.rating })
		.from(sets)
		.where(and(eq(sets.exerciseId, id), isNotNull(sets.rating)))
		.orderBy(desc(sets.doneAt))
		.limit(RECENT_RATED)
		.all();
	const mean =
		rated.length === 0 ? null : rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length;
	return {
		sets: totals?.sets ?? 0,
		totalS: Number(totals?.totalS ?? 0),
		recentRating: mean === null ? null : Math.round(mean * 10) / 10
	};
}

/**
 * The latest set of every exercise in one dance — for the rating dots on
 * Today's rows. One grouped query rather than one per row.
 *
 * Relies on SQLite's documented bare-column rule: in a query with exactly one
 * `max()` aggregate, the other selected columns come from the row holding that
 * maximum. Two sets at the same millisecond pick either, which is fine.
 */
export function lastSets(db: Db, dance: DanceSlug): Map<number, HistorySet> {
	const rows = db.all<HistorySet & { exerciseId: number }>(sql`
		select s.exercise_id as exerciseId, s.id as id, max(s.done_at) as doneAt,
		       s.duration_s as durationS, s.reps as reps, s.rating as rating, s.note as note
		from sets s join exercises e on e.id = s.exercise_id
		where e.dance = ${dance}
		group by s.exercise_id`);
	return new Map(rows.map(({ exerciseId, ...set }) => [exerciseId, set]));
}

export function lastSet(db: Db, exerciseId: number): HistorySet | null {
	return exerciseHistory(db, exerciseId, 1)[0] ?? null;
}
```

Update the imports: `isNotNull` from drizzle-orm; `ExerciseSummary`,
`HistorySet` from `$lib/types`. Remove the now-unused `PracticeMode` import.

- [ ] **Step 6: `taughtIn` in `lessons.ts`**

Append to `src/lib/server/lessons.ts` (extend imports with `desc` if missing):

```ts
/**
 * The lessons that taught a figure — the lesson→figure link read from the
 * figure's side, which until now only the lesson page could show. Archived
 * lessons are gone from every list, so they are gone from this one.
 */
export function taughtIn(db: Db, figureId: number) {
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessonFigures)
		.innerJoin(lessons, eq(lessons.id, lessonFigures.lessonId))
		.where(and(eq(lessonFigures.figureId, figureId), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all();
}
```

- [ ] **Step 7: Keep Today compiling**

`src/routes/[dance]/+page.server.ts`'s `updateExercise` action still passes
`practiceMode`, `songId`, `countBpm`. For THIS task only, strip those three
from the action: remove the `practiceMode`/`songId`/`countBpm` reads, their
checks, their `entered` fields and the two song/count `fail` branches, and pass
only `{ name, everyDays, notes, active }`. Remove the `PRACTICE_MODES`,
`oneOf`, `optionalInt` imports if now unused. (Task 11 moves the whole action to
the exercise page; `LogSheet.svelte` still renders its practice radio until
Task 11 strips it — it posts fields the action now ignores, which is harmless.)
In `LogSheet.svelte`, replace the `PRACTICE_LABEL` import and its use with an
inline map `{ song: 'With a song', count: 'Count only', none: 'Just log it' }`
so the build passes until Task 11 removes that block (Task 12 deletes the file).

- [ ] **Step 8: Run tests, prove they bite, check and commit**

Run: `nix develop -c npx vitest run src/lib/server`
Expected: PASS.

Remove `song.status !== 'ready' ||` from `setPracticeSettings` — the "not
ready" test must fail. Change `desc(lessons.lessonDay)` to `asc` — the taught-in
test must fail. Restore both.

```bash
nix develop -c npx prettier --write src/lib src/routes
nix develop -c npm run check
git add -A src/lib src/routes
git commit -m "exercises: split settings from practice choices; history, last sets, taught-in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: One logging path — `log-form.ts`

**Files:**

- Create: `src/lib/server/log-form.ts`
- Test: `src/lib/server/log-form.spec.ts`
- Modify: `src/routes/[dance]/+page.server.ts`,
  `src/routes/[dance]/figures/[id]/+page.server.ts`,
  `src/routes/[dance]/figures/[id]/+page.svelte` (one hidden input),
  `src/routes/[dance]/lessons/[id]/+page.server.ts`

**Interfaces:**

- Consumes: `hasField` (Task 2); `logSet`, `deleteSet` from `exercises.ts`;
  `danceOf`, `requireExerciseInDance`, `requireSetInDance` from `scope.ts`.
- Produces:
  - `type LogEvent = { params: { dance: string }; request: Request; locals: App.Locals }`
  - `logSetFrom(event: LogEvent)` → `{ action: 'log'; ok: true; setId: number }` or
    `fail(400, { action: 'log', message })`; throws 404 across the wall
  - `deleteSetFrom(event: LogEvent)` → `{ action: 'deleteSet'; ok: true }` or
    `fail(404, { action: 'deleteSet', message })`
  - Form fields `log` reads: `exerciseId`, `durationMin` (0–600), `durationS`
    (0–86400, wins over `durationMin`), `reps` (0–10000), `rating` (1–5),
    `note` (≤2000), `run` (≤4000, dropped silently if longer), `day` (back-fill)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/server/log-form.spec.ts
/**
 * The one logging path every popup posts to. Tested through the real function
 * with the app's `getDb()` mocked, for the reason `dance-wall.spec.ts` gives:
 * `$env/dynamic/private` does not see a `process.env` write from a test, so
 * mocking the module is the only way to be sure the real database is never
 * opened.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sets } from '$lib/server/db/schema';
import { createCustomExercise, getSet, logSet } from '$lib/server/exercises';
import { createFigure } from '$lib/server/figures';
import { noonOf } from '$lib/day/day';
import { deleteSetFrom, logSetFrom } from './log-form';

const TZ = 'Europe/Ljubljana';
const USER = { id: 'u1', email: 'u@example.com', timezone: TZ };

function post(dance: string, fields: Record<string, string>) {
	return {
		params: { dance },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER } as App.Locals
	};
}

let db: Db;
let figureExerciseId: number;
let drillId: number;
let bachataDrillId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	figureExerciseId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null,
		callable: true,
		callText: null
	})!.exercise.id;
	drillId = createCustomExercise(db, 'salsa', { name: 'Son switch', everyDays: 2, notes: null }).id;
	bachataDrillId = createCustomExercise(db, 'bachata', { name: 'Hips', everyDays: 2, notes: null }).id;
});

const only = () => {
	const all = db.select().from(sets).all();
	expect(all).toHaveLength(1);
	return all[0];
};

describe('logSetFrom', () => {
	it('prefers exact seconds over minutes, keeps the run, and drops fields a figure lacks', async () => {
		await logSetFrom(
			post('salsa', {
				exerciseId: String(figureExerciseId),
				durationMin: '9',
				durationS: '512',
				reps: '20',
				rating: '4',
				note: 'Clean on the 5',
				run: '{"source":"count"}'
			})
		);
		expect(only()).toMatchObject({
			durationS: 512,
			reps: null,
			rating: 4,
			note: 'Clean on the 5',
			playerJson: '{"source":"count"}'
		});
	});

	it('keeps reps on a drill, and minutes when no exact seconds came', async () => {
		await logSetFrom(post('salsa', { exerciseId: String(drillId), durationMin: '5', reps: '30' }));
		expect(only()).toMatchObject({ durationS: 300, reps: 30 });
	});

	it('back-fills a past day at noon, without a player run', async () => {
		await logSetFrom(
			post('salsa', { exerciseId: String(drillId), day: '2020-01-01', run: '{"source":"count"}' })
		);
		expect(only()).toMatchObject({ doneAt: noonOf('2020-01-01', TZ), playerJson: null });
	});

	it('drops an overlong run rather than failing the set', async () => {
		await logSetFrom(post('salsa', { exerciseId: String(drillId), run: 'x'.repeat(4001) }));
		expect(only().playerJson).toBeNull();
	});

	it('refuses a bad rating with a message, storing nothing', async () => {
		const res = (await logSetFrom(post('salsa', { exerciseId: String(drillId), rating: '9' }))) as {
			status: number;
		};
		expect(res.status).toBe(400);
		expect(db.select().from(sets).all()).toHaveLength(0);
	});

	it('refuses an exercise of the other dance with a 404, storing nothing', async () => {
		await expect(logSetFrom(post('salsa', { exerciseId: String(bachataDrillId) }))).rejects.toMatchObject({
			status: 404
		});
		expect(db.select().from(sets).all()).toHaveLength(0);
	});
});

describe('deleteSetFrom', () => {
	it('deletes its own dance’s set and refuses the other’s', async () => {
		const mine = logSet(db, { exerciseId: drillId, doneAt: 1, durationS: null, reps: null, rating: null, note: null, playerJson: null });
		const theirs = logSet(db, { exerciseId: bachataDrillId, doneAt: 1, durationS: null, reps: null, rating: null, note: null, playerJson: null });
		await deleteSetFrom(post('salsa', { setId: String(mine.id) }));
		expect(getSet(db, mine.id)).toBeNull();
		await expect(deleteSetFrom(post('salsa', { setId: String(theirs.id) }))).rejects.toMatchObject({ status: 404 });
		expect(getSet(db, theirs.id)).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/log-form.spec.ts`
Expected: FAIL — `./log-form` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/log-form.ts
/**
 * Logging a set and deleting one, shared by every page that opens a log popup:
 * Today, the exercise page, the figure page and the lesson page. One parser,
 * one set of rules — before this, three pages each carried their own bare-log
 * action, each checking the exercise a little differently.
 *
 * Only the fields the exercise's TYPE has are stored (`hasField`): a figure's
 * form posting reps is ignored, not written. And a back-filled set never gets
 * a player run — a run is something that happened now.
 */
import { error, fail } from '@sveltejs/kit';
import { getDb } from './db';
import { deleteSet, logSet } from './exercises';
import { int, optionalInt, optionalText } from './form';
import { danceOf, requireExerciseInDance, requireSetInDance } from './scope';
import { isValidDay, localDay, noonOf } from '$lib/day/day';
import { hasField } from '$lib/exercises/kinds';

export type LogEvent = { params: { dance: string }; request: Request; locals: App.Locals };

export async function logSetFrom({ params, request, locals }: LogEvent) {
	if (!locals.user) throw error(401);
	const tz = locals.user.timezone;
	const dance = danceOf(params);
	const form = await request.formData();
	const exerciseId = int(form, 'exerciseId');
	const durationMin = optionalInt(form, 'durationMin', 0, 600);
	const durationS = optionalInt(form, 'durationS', 0, 24 * 3600);
	const reps = optionalInt(form, 'reps', 0, 10_000);
	const rating = optionalInt(form, 'rating', 1, 5);
	const note = optionalText(form, 'note');
	// The summary of a run is a nicety; the set is the point. An overlong one is
	// dropped rather than costing the user the set — the player's own rule.
	const run = optionalText(form, 'run', 4000);
	const day = String(form.get('day') ?? '');

	if (
		exerciseId === undefined ||
		durationMin === undefined ||
		durationS === undefined ||
		reps === undefined ||
		rating === undefined ||
		note === undefined
	) {
		return fail(400, { action: 'log', message: 'Check the values and try again.' });
	}

	// The id arrives in a form body, so it is checked against the URL's dance
	// rather than trusted.
	const exercise = requireExerciseInDance(getDb(), dance, exerciseId);
	const has = (f: Parameters<typeof hasField>[1]) => hasField(exercise.source, f);

	const now = Date.now();
	const backfill = isValidDay(day) && day < localDay(now, tz);
	// Exact seconds come from the practice panel; typing into Minutes clears
	// them on the client, so when both arrive the panel's are the truth.
	const seconds = durationS ?? (durationMin === null ? null : durationMin * 60);
	try {
		const set = logSet(getDb(), {
			exerciseId,
			doneAt: backfill ? noonOf(day, tz) : now,
			durationS: has('minutes') ? seconds : null,
			reps: has('reps') ? reps : null,
			rating: has('rating') ? rating : null,
			note: has('note') ? note : null,
			playerJson: backfill ? null : (run ?? null)
		});
		return { action: 'log' as const, ok: true, setId: set.id };
	} catch {
		return fail(400, { action: 'log', message: 'That exercise no longer exists.' });
	}
}

export async function deleteSetFrom({ params, request }: LogEvent) {
	const id = int(await request.formData(), 'setId');
	// Before the delete, not after: `deleteSet` takes an id alone, so a set from
	// the other dance would already be gone by the time it answered.
	if (id !== undefined) requireSetInDance(getDb(), danceOf(params), id);
	if (id === undefined || !deleteSet(getDb(), id)) {
		return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
	}
	return { action: 'deleteSet' as const, ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/log-form.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the four pages**

`src/routes/[dance]/+page.server.ts`: delete the `log` and `deleteSet` actions
and replace them with

```ts
	/** Log a set: now, or at noon of a past day when back-filling. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
```

importing `logSetFrom, deleteSetFrom` from `$lib/server/log-form`, and drop the
imports that become unused (`logSet`, `deleteSet`, `requireSetInDance`,
`noonOf`, … — let eslint tell you).

`src/routes/[dance]/figures/[id]/+page.server.ts`: replace the `log` action with
`log: (event) => logSetFrom(event),` (remove the `logSet` import). The figure
page's bare-log form posts no id today, so in
`src/routes/[dance]/figures/[id]/+page.svelte`, inside the `?/log` form, add
`<input type="hidden" name="exerciseId" value={data.exercise.id} />` as its
first child. (Task 13 replaces this button with the popup.)

`src/routes/[dance]/lessons/[id]/+page.server.ts`: replace the `log` action with
`log: (event) => logSetFrom(event),` (remove the `logSet` import). Its form
already posts `exerciseId`.

- [ ] **Step 6: Run the whole suite**

Run: `nix develop -c npx vitest run`
Expected: PASS — including `dance-wall.spec.ts`'s "will not log a set on an
exercise from the other dance", which now exercises `logSetFrom` through Today.

- [ ] **Step 7: Prove the tests bite, check and commit**

Change `reps: has('reps') ? reps : null` to `reps` — the figure test must fail.
Change `playerJson: backfill ? null : (run ?? null)` to `run ?? null` — the
back-fill test must fail. Restore both.

```bash
nix develop -c npx prettier --write src/lib/server/log-form.ts src/lib/server/log-form.spec.ts src/routes
nix develop -c npm run check
git add src/lib/server/log-form.ts src/lib/server/log-form.spec.ts src/routes
git commit -m "log: one logging path for every page, storing only the type's fields

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The popup's content, and a song's grid, as JSON endpoints

**Files:**

- Create: `src/lib/server/grid.ts`, `src/lib/server/practice-content.ts`,
  `src/routes/[dance]/songs/[id]/grid/+server.ts`,
  `src/routes/[dance]/exercises/[id]/practice/+server.ts`
- Modify: `src/lib/types.ts`, `src/routes/[dance]/player/+page.server.ts`,
  `src/routes/[dance]/dance-wall.spec.ts`
- Test: `src/lib/server/practice-content.spec.ts`

**Interfaces:**

- Consumes: `getLesson`, `getFigure`, `routineSlots`, `listLinks`, `lastSet`,
  `setPracticeSettings` (Tasks 4–5); `parsePracticeInput`, `typeOf` (Task 2);
  `buildGrid` from `$lib/beatgrid/beatgrid`.
- Produces:
  - `types.ts`:
    ```ts
    export interface RecordingRow { id: number; file: string; kind: 'video' | 'audio'; sizeBytes: number; createdAt: number }
    export interface SongGrid { audioFile: string; beats: number[]; counts: number[] }
    export type PracticeContent =
      | { type: 'lesson'; lesson: { id: number; title: string; lessonDay: string; notes: string | null };
          links: LinkRow[]; videos: LessonVideoRow[]; figures: { id: number; name: string }[] }
      | { type: 'figure'; figure: { id: number; name: string; notes: string | null; say: string; eights: number };
          links: LinkRow[]; recordings: RecordingRow[] }
      | { type: 'drill'; notes: string | null; links: LinkRow[] }
      | { type: 'routine'; routine: { id: number; name: string; notes: string | null };
          slots: { note: string | null; names: string[] }[] };
    export interface PracticePayload { content: PracticeContent; last: LastSet | null }
    ```
  - `grid.ts`: `songGrid(song: Song): { beats: number[]; counts: number[] }`
  - `practice-content.ts`: `practicePayload(db: Db, exercise: Exercise, tz: string, now: number): PracticePayload`
    where `type Exercise = typeof exercises.$inferSelect`
  - `GET /[dance]/songs/[id]/grid` → `SongGrid` (404 unless ready, unarchived, this dance)
  - `GET /[dance]/exercises/[id]/practice` → `PracticePayload`
  - `POST /[dance]/exercises/[id]/practice` (JSON `PracticeInput`-shaped body) → 204, or 400

- [ ] **Step 1: Add the types** listed above to `src/lib/types.ts` (after
  `LinkRow`/`LastSet`).

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/server/practice-content.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { createCustomExercise, getExercise, logSet } from './exercises';
import { createFigure } from './figures';
import { createLesson, linkFigure } from './lessons';
import { addLinks } from './links';
import { addFigureSlot, createRoutine } from './routines';
import { practicePayload } from './practice-content';
import { noonOf } from '$lib/day/day';

const TZ = 'Europe/Ljubljana';
let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	name: 'Enchufla',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: 'Lead on 1',
	callable: true,
	callText: 'en-CHU-fla'
};
const set = (exerciseId: number, doneAt: number, rating: number | null = null) =>
	logSet(db, { exerciseId, doneAt, durationS: null, reps: null, rating, note: null, playerJson: null });

describe('practicePayload', () => {
	it('gives a lesson review its notes, links and figures', () => {
		const { lesson, exercise } = createLesson(db, 'salsa', {
			lessonDay: '2026-09-20',
			title: 'Rueda',
			notes: 'Watch the video'
		});
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		linkFigure(db, lesson.id, figure.id);
		addLinks(db, { lessonId: lesson.id }, ['https://youtu.be/dQw4w9WgXcQ'], null);
		const p = practicePayload(db, exercise, TZ, Date.now());
		expect(p.content).toMatchObject({
			type: 'lesson',
			lesson: { title: 'Rueda', notes: 'Watch the video', lessonDay: '2026-09-20' },
			figures: [{ id: figure.id, name: 'Enchufla' }],
			videos: []
		});
		expect(p.content.type === 'lesson' && p.content.links.map((l) => l.url)).toEqual([
			'https://youtu.be/dQw4w9WgXcQ'
		]);
	});

	it('gives a figure its notes, spoken name, length and links', () => {
		const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
		addLinks(db, { figureId: figure.id }, ['https://a.org'], 'Demo');
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'figure',
			figure: { id: figure.id, name: 'Enchufla', notes: 'Lead on 1', say: 'en-CHU-fla', eights: 1 },
			links: [{ url: 'https://a.org', title: 'Demo' }],
			recordings: []
		});
	});

	it('gives a drill its own notes and links', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'Son switch', everyDays: 2, notes: 'Switch every 4' });
		addLinks(db, { exerciseId: drill.id }, ['https://a.org'], null);
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, Date.now()).content).toMatchObject({
			type: 'drill',
			notes: 'Switch every 4',
			links: [{ url: 'https://a.org' }]
		});
	});

	it('gives a routine its slots as names', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Friday', notes: null });
		addFigureSlot(db, routine.id, figure.id);
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'routine',
			routine: { id: routine.id, name: 'Friday' },
			slots: [{ note: null, names: ['Enchufla'] }]
		});
	});

	it('reports the last set in calendar days, in the user’s zone', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 1, notes: null });
		// 23:30 local on the 19th, read at 08:00 on the 20th: "yesterday", though under 9 hours ago.
		set(drill.id, noonOf('2026-09-19', TZ) + 11.5 * 3_600_000, 3);
		const now = noonOf('2026-09-20', TZ) - 4 * 3_600_000;
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, now).last).toMatchObject({
			rating: 3,
			daysAgo: 1
		});
	});

	it('has no last set for a fresh exercise', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 1, notes: null });
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, Date.now()).last).toBeNull();
	});
});
```

Check the real return shapes before running: `createLesson` returns
`{ lesson, exercise }` and `createRoutine` returns `{ routine, exercise }` (see
`dance-wall.spec.ts`); `addFigureSlot(db, routineId, figureId)` exists in
`routines.ts`. Adjust the test to the real names if any differs.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/server/practice-content.spec.ts`
Expected: FAIL — `./practice-content` does not exist.

- [ ] **Step 4: Write `grid.ts` and use it in the player load**

```ts
// src/lib/server/grid.ts
import { buildGrid } from '$lib/beatgrid/beatgrid';
import type { TempoFactor } from '$lib/labels';
import type { songs } from './db/schema';

type Song = typeof songs.$inferSelect;

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

/**
 * A song's beats and its 1–8, from the stored analysis and the user's anchors.
 * Shared by the player's load and the practice panel's grid endpoint, so the
 * two can never count the same song differently.
 */
export function songGrid(song: Song): { beats: number[]; counts: number[] } {
	const grid = buildGrid({
		beats: parse(song.beatsJson),
		downbeats: parse(song.downbeatsJson),
		anchors: parse(song.anchorsJson),
		tempoFactor: song.tempoFactor as TempoFactor
	});
	return { beats: grid.beats, counts: grid.counts };
}
```

In `src/routes/[dance]/player/+page.server.ts`, replace the inline
`buildGrid({...})` with `song ? songGrid(song) : null`, delete the local
`parse` and the `buildGrid`/`TempoFactor` imports, and import `songGrid` from
`$lib/server/grid`. (The player uses only `beats` and `counts` — check with
`grep -n "grid\." src/routes/\[dance\]/player/+page.svelte src/lib/components/player/*.svelte`;
if anything reads `grid.bpm`, keep returning `buildGrid`'s full result from
`songGrid` instead, and say so in the report.)

- [ ] **Step 5: Write `practice-content.ts`**

```ts
// src/lib/server/practice-content.ts
/**
 * What a log popup shows above its form, fetched when the popup opens. Loading
 * this for every row would make Today pay for every lesson's videos and every
 * figure's recordings on each visit; fetched per popup, Today stays as light
 * as it was.
 *
 * This is the one server place that branches on the type, because each type's
 * content lives in different tables. The components never branch — they ask
 * the registry for the type's popup.
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures } from './db/schema';
import { lastSet } from './exercises';
import { getFigure } from './figures';
import { getLesson } from './lessons';
import { listLinks } from './links';
import { getRoutine, routineSlots } from './routines';
import { daysBetween, localDay } from '$lib/day/day';
import { typeOf } from '$lib/exercises/kinds';
import type { PracticeContent, PracticePayload } from '$lib/types';

type Exercise = typeof exercises.$inferSelect;

export function practicePayload(db: Db, exercise: Exercise, tz: string, now: number): PracticePayload {
	const set = lastSet(db, exercise.id);
	return {
		content: contentOf(db, exercise),
		last: set && { ...set, daysAgo: daysBetween(localDay(set.doneAt, tz), localDay(now, tz)) }
	};
}

/** What an owned exercise shows if its owner row has vanished: its own notes, like a drill. */
const bare = (exercise: Exercise): PracticeContent => ({ type: 'drill', notes: exercise.notes, links: [] });

function contentOf(db: Db, exercise: Exercise): PracticeContent {
	switch (typeOf(exercise.source)) {
		case 'lesson': {
			const found = exercise.lessonId === null ? null : getLesson(db, exercise.lessonId);
			if (!found) return bare(exercise);
			const { lesson } = found;
			return {
				type: 'lesson',
				lesson: { id: lesson.id, title: lesson.title, lessonDay: lesson.lessonDay, notes: lesson.notes },
				links: listLinks(db, { lessonId: lesson.id }),
				videos: found.videos,
				figures: found.figures.map((f) => ({ id: f.id, name: f.name }))
			};
		}
		case 'figure': {
			const found = exercise.figureId === null ? null : getFigure(db, exercise.figureId);
			if (!found) return bare(exercise);
			const { figure } = found;
			return {
				type: 'figure',
				figure: {
					id: figure.id,
					name: figure.name,
					notes: figure.notes,
					say: figure.callText ?? figure.name,
					eights: figure.eights
				},
				links: listLinks(db, { figureId: figure.id }),
				recordings: found.recordings.map((r) => ({
					id: r.id,
					file: r.file,
					kind: r.kind,
					sizeBytes: r.sizeBytes,
					createdAt: r.createdAt
				}))
			};
		}
		case 'routine': {
			if (exercise.routineId === null) return bare(exercise);
			const routine = getRoutine(db, exercise.routineId);
			if (!routine) return bare(exercise);
			// Every figure of the dance, archived included: a slot can still name one.
			const names = new Map(
				db
					.select({ id: figures.id, name: figures.name })
					.from(figures)
					.where(eq(figures.dance, exercise.dance))
					.all()
					.map((f) => [f.id, f.name] as [number, string])
			);
			return {
				type: 'routine',
				routine: { id: routine.id, name: routine.name, notes: routine.notes },
				slots: routineSlots(db, routine.id).map((s) => ({
					note: s.note,
					names:
						s.childId !== null
							? [s.childName ?? 'A routine']
							: s.figureIds.map((id) => names.get(id) ?? `#${id}`)
				}))
			};
		}
		case 'drill':
			return { type: 'drill', notes: exercise.notes, links: listLinks(db, { exerciseId: exercise.id }) };
	}
}
```

Import `getRoutine` alongside `routineSlots` from `./routines` — it returns the
routine row or null, as `scope.ts` relies on.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/server/practice-content.spec.ts`
Expected: PASS.

- [ ] **Step 7: The two endpoints**

```ts
// src/routes/[dance]/songs/[id]/grid/+server.ts
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songGrid } from '$lib/server/grid';
import { danceOf, requireSongInDance } from '$lib/server/scope';
import type { SongGrid } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * A song's grid for the practice panel, fetched when a song is picked — never
 * on the Play tap, which must reach `start()` without awaiting anything (iOS).
 * Under `/[dance]/` so the slug is in the URL and the wall applies unchanged.
 */
export const GET: RequestHandler = ({ params }) => {
	const song = requireSongInDance(getDb(), danceOf(params), Number(params.id));
	if (song.archivedAt !== null || song.status !== 'ready' || !song.audioFile) {
		throw error(404, 'No analysed song here');
	}
	const body: SongGrid = { audioFile: song.audioFile, ...songGrid(song) };
	return json(body);
};
```

```ts
// src/routes/[dance]/exercises/[id]/practice/+server.ts
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { setPracticeSettings } from '$lib/server/exercises';
import { practicePayload } from '$lib/server/practice-content';
import { danceOf, requireExerciseInDance } from '$lib/server/scope';
import { DANCES } from '$lib/dances/dances';
import { parsePracticeInput } from '$lib/exercises/practice';
import type { RequestHandler } from './$types';

function exerciseOf(params: { dance: string; id: string }) {
	const exercise = requireExerciseInDance(getDb(), danceOf(params), Number(params.id));
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

/** What the log popup shows above its form. See `practice-content.ts`. */
export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	return json(practicePayload(getDb(), exerciseOf(params), locals.user.timezone, Date.now()));
};

/**
 * Remember what the practice panel played, posted on Play. An endpoint rather
 * than a form action so the four pages that open a popup need not each
 * register one. JSON, so SvelteKit's form-CSRF check does not apply — and a
 * cross-site page cannot send a JSON body without a CORS preflight this server
 * never answers.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const exercise = exerciseOf(params);
	const input = parsePracticeInput(await request.json().catch(() => null), DANCES[danceOf(params)]);
	if (!input || !setPracticeSettings(getDb(), exercise.id, input)) {
		throw error(400, 'Those practice settings cannot be used');
	}
	return new Response(null, { status: 204 });
};
```

- [ ] **Step 8: Dance-wall tests for both endpoints**

In `src/routes/[dance]/dance-wall.spec.ts`, import
`* as gridEndpoint from './songs/[id]/grid/+server'` and
`* as practiceEndpoint from './exercises/[id]/practice/+server'`, then add:

```ts
describe('the JSON endpoints refuse the other dance', () => {
	const at = (dance: string, id: string, init?: RequestInit) => ({
		params: { dance, id },
		request: new Request('http://localhost/', init),
		locals: { user: USER }
	});
	type Handler = (e: ReturnType<typeof at>) => unknown;

	it('will not serve a bachata song’s grid under salsa', async () => {
		await expect(
			(async () => (gridEndpoint.GET as unknown as Handler)(at('salsa', String(bachataSongId))))()
		).rejects.toMatchObject({ status: 404 });
	});

	it('will not serve or change a bachata exercise under salsa', async () => {
		await expect(
			(async () => (practiceEndpoint.GET as unknown as Handler)(at('salsa', String(bachataCustomId))))()
		).rejects.toMatchObject({ status: 404 });
		await expect(
			(async () =>
				(practiceEndpoint.POST as unknown as Handler)(
					at('salsa', String(bachataCustomId), {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ mode: 'count', countBpm: 150, songId: null, config: {} })
					})
				))()
		).rejects.toMatchObject({ status: 404 });
		expect(getExercise(db, bachataCustomId)?.practiceMode).toBe('none');
	});

	it('serves its own dance', async () => {
		const res = (await (practiceEndpoint.GET as unknown as Handler)(
			at('bachata', String(bachataCustomId))
		)) as Response;
		expect(((await res.json()) as { content: { type: string } }).content.type).toBe('drill');
	});
});
```

- [ ] **Step 9: Run, prove, check and commit**

Run: `nix develop -c npx vitest run`
Expected: PASS.

Replace `requireSongInDance(...)` in the grid endpoint with a bare `getSong`
lookup — the grid wall test must fail. Restore.

```bash
nix develop -c npx prettier --write src/lib src/routes
nix develop -c npm run check
git add -A src/lib src/routes
git commit -m "practice: the popup's content and a song's grid as dance-scoped JSON

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Links, clickable notes, mirror and speed — on the lesson and figure pages

**Files:**

- Create: `src/lib/video-prefs.ts`, `src/lib/video-prefs.spec.ts`,
  `src/lib/components/ui/styles.ts`, `src/lib/components/ui/VideoFrame.svelte`,
  `src/lib/components/ui/LinkedText.svelte`,
  `src/lib/components/links/YouTubeCard.svelte`,
  `src/lib/components/links/LinkList.svelte`,
  `src/lib/components/links/LinksEditor.svelte`,
  `src/lib/server/link-form.ts`, `src/lib/server/link-form.spec.ts`
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` + `+page.svelte`,
  `src/routes/[dance]/lessons/[id]/+page.server.ts` + `+page.svelte`,
  `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**

- Consumes: `parseLink`, `textPieces`, `youtube*`, `splitLinkLines` (Task 1);
  `listLinks`, `addLinks`, `deleteLink`, `LinkOwner` (Task 4); `taughtIn`
  (Task 5); `watchMedia`, `MediaProblem` from `$lib/media`.
- Produces:
  - `video-prefs.ts`: `VIDEO_RATES = [0.5, 0.75, 1] as const`, `type VideoRate`,
    `interface VideoPrefs { mirror: boolean; rate: VideoRate }`,
    `parseVideoPrefs(raw: string | null): VideoPrefs`, `loadVideoPrefs(): VideoPrefs`,
    `saveVideoPrefs(p: VideoPrefs): void`
  - `styles.ts`: `CHIP`, `FIELD`, `LABEL` class strings
  - `<VideoFrame src kind? onproblem />`, `<LinkedText text class? />`,
    `<YouTubeCard id start title />`, `<LinkList links actions? />` (snippet
    `actions(link)`), `<LinksEditor links message entered />` (posts `?/addLink`
    with `urls` + `title`, `?/deleteLink` with `linkId`)
  - `link-form.ts`: `addLinkFrom(request, db, owner)` →
    `{ action: 'addLink'; ok: true; added: number }` or
    `fail(400, { action: 'addLink', message, urls })`;
    `deleteLinkFrom(request, db, owner)` → `{ action: 'deleteLink'; ok: true }` or
    `fail(404, { action: 'deleteLink', message })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/video-prefs.spec.ts
import { describe, expect, it } from 'vitest';
import { parseVideoPrefs } from './video-prefs';

describe('parseVideoPrefs', () => {
	it('reads back what was saved', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.5}')).toEqual({ mirror: true, rate: 0.5 });
	});
	it.each([null, '', 'junk', '{"mirror":"yes","rate":3}'])('falls back for %s', (raw) => {
		expect(parseVideoPrefs(raw)).toEqual({ mirror: false, rate: 1 });
	});
});
```

```ts
// src/lib/server/link-form.spec.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { links } from './db/schema';
import { createFigure } from './figures';
import { addLinkFrom, deleteLinkFrom } from './link-form';
import { listLinks } from './links';

let db: Db;
let figureId: number;
let figureExerciseId: number;
beforeEach(() => {
	db = openDb(':memory:');
	const made = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null,
		callable: true,
		callText: null
	})!;
	figureId = made.figure.id;
	figureExerciseId = made.exercise.id;
});

const form = (fields: Record<string, string>) =>
	new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});

describe('addLinkFrom', () => {
	it('adds every pasted line', async () => {
		const res = await addLinkFrom(form({ urls: 'https://a.org\nhttps://b.org', title: '' }), db, { figureId });
		expect(res).toMatchObject({ ok: true, added: 2 });
		expect(listLinks(db, { figureId })).toHaveLength(2);
	});

	it('stores nothing when any line is bad, names it, and hands the text back', async () => {
		const typed = 'https://a.org\njavascript:alert(1)';
		const res = (await addLinkFrom(form({ urls: typed }), db, { figureId })) as {
			status: number;
			data: { message: string; urls: string };
		};
		expect(res.status).toBe(400);
		expect(res.data.message).toContain('javascript:alert(1)');
		expect(res.data.urls).toBe(typed);
		expect(db.select().from(links).all()).toHaveLength(0);
	});

	it('asks for a link when the box is empty', async () => {
		const res = (await addLinkFrom(form({ urls: '  \n ' }), db, { figureId })) as { status: number };
		expect(res.status).toBe(400);
	});

	it('refuses links on an exercise its figure owns', async () => {
		const res = (await addLinkFrom(form({ urls: 'https://a.org' }), db, { exerciseId: figureExerciseId })) as {
			status: number;
		};
		expect(res.status).toBe(400);
	});
});

describe('deleteLinkFrom', () => {
	it('deletes its own link and 404s on a stranger’s', async () => {
		await addLinkFrom(form({ urls: 'https://a.org' }), db, { figureId });
		const [link] = listLinks(db, { figureId });
		expect(await deleteLinkFrom(form({ linkId: String(link.id) }), db, { lessonId: 999 })).toMatchObject({
			status: 404
		});
		expect(await deleteLinkFrom(form({ linkId: String(link.id) }), db, { figureId })).toMatchObject({ ok: true });
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nix develop -c npx vitest run src/lib/video-prefs.spec.ts src/lib/server/link-form.spec.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `video-prefs.ts` and `link-form.ts`**

```ts
// src/lib/video-prefs.ts
/**
 * Mirror and speed for videos, remembered per browser. A per-viewer
 * convenience, so `localStorage` is the right place — and every access is
 * wrapped, because private-mode Safari throws on any touch of it. Nothing here
 * ever reaches the database.
 */
export const VIDEO_RATES = [0.5, 0.75, 1] as const;
export type VideoRate = (typeof VIDEO_RATES)[number];

export interface VideoPrefs {
	mirror: boolean;
	rate: VideoRate;
}

const KEY = 'video.prefs';
const DEFAULTS: VideoPrefs = { mirror: false, rate: 1 };

export function parseVideoPrefs(raw: string | null): VideoPrefs {
	try {
		const v: unknown = raw ? JSON.parse(raw) : null;
		if (!v || typeof v !== 'object') return DEFAULTS;
		const o = v as Record<string, unknown>;
		return {
			mirror: o.mirror === true,
			rate: (VIDEO_RATES as readonly unknown[]).includes(o.rate) ? (o.rate as VideoRate) : 1
		};
	} catch {
		return DEFAULTS;
	}
}

export function loadVideoPrefs(): VideoPrefs {
	try {
		return parseVideoPrefs(localStorage.getItem(KEY));
	} catch {
		return DEFAULTS;
	}
}

export function saveVideoPrefs(p: VideoPrefs): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		// Private mode or storage full: the choice just is not remembered.
	}
}
```

```ts
// src/lib/server/link-form.ts
/**
 * The "Links" editor's two actions, shared by the lesson, figure and exercise
 * pages. Each page resolves its owner through its own dance-guarded lookup
 * (`figureOf`, `lessonOf`, `requireExerciseInDance`) and hands it in — so a
 * link can only ever be added to, or removed from, the page it was posted on.
 */
import { fail } from '@sveltejs/kit';
import type { Db } from './db';
import { int, optionalText } from './form';
import { addLinks, deleteLink, type LinkOwner } from './links';
import { splitLinkLines } from '$lib/links';

/** A URL longer than this is not a link someone pasted on purpose. */
const MAX_URL = 2000;

export async function addLinkFrom(request: Request, db: Db, owner: LinkOwner) {
	const form = await request.formData();
	const typed = String(form.get('urls') ?? '');
	const title = optionalText(form, 'title', 200);
	const { urls, bad } = splitLinkLines(typed);
	const refuse = (message: string) => fail(400, { action: 'addLink' as const, message, urls: typed });

	// All or nothing: storing the good half of a paste and dropping the rest
	// would leave the user guessing which half made it.
	if (bad.length > 0) return refuse(`Not a web link: ${bad.join(', ')}`);
	if (urls.length === 0) return refuse('Paste a link first.');
	if (urls.some((u) => u.length > MAX_URL)) return refuse('That link is too long.');
	if (title === undefined) return refuse('Keep the title under 200 characters.');

	const added = addLinks(db, owner, urls, title);
	if (added === null) return refuse('Links live on the figure or lesson this exercise belongs to.');
	return { action: 'addLink' as const, ok: true, added: added.length };
}

export async function deleteLinkFrom(request: Request, db: Db, owner: LinkOwner) {
	const id = int(await request.formData(), 'linkId');
	if (id === undefined || !deleteLink(db, owner, id)) {
		return fail(404, { action: 'deleteLink' as const, message: 'That link was already removed.' });
	}
	return { action: 'deleteLink' as const, ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nix develop -c npx vitest run src/lib/video-prefs.spec.ts src/lib/server/link-form.spec.ts`
Expected: PASS.

- [ ] **Step 5: The shared class strings**

```ts
// src/lib/components/ui/styles.ts
/**
 * Class strings repeated across forms. Components used to each declare these
 * as local constants; the new popups use them from several files, and copies
 * drift.
 */
export const FIELD =
	'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
export const LABEL = 'mb-1 block text-[12px] font-medium text-ink-2';
/** A radio styled as a chip: wrap the input (`sr-only`) and its text in a <label> with this. */
export const CHIP =
	'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[14px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';
```

- [ ] **Step 6: `VideoFrame.svelte`**

```svelte
<!-- src/lib/components/ui/VideoFrame.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import { VIDEO_RATES, loadVideoPrefs, saveVideoPrefs, type VideoRate } from '$lib/video-prefs';

	interface Props {
		src: string;
		kind?: 'video' | 'audio';
		onproblem: (problem: MediaProblem) => void;
	}

	let { src, kind = 'video', onproblem }: Props = $props();

	// Defaults on the server and the first client render, then the stored
	// choice on mount: reading localStorage during SSR is impossible, and
	// reading it before hydration would render a different page than the
	// server sent.
	let mirror = $state(false);
	let rate = $state<VideoRate>(1);
	onMount(() => {
		({ mirror, rate } = loadVideoPrefs());
	});

	function choose(next: { mirror?: boolean; rate?: VideoRate }) {
		mirror = next.mirror ?? mirror;
		rate = next.rate ?? rate;
		saveVideoPrefs({ mirror, rate });
	}

	/** A slowed teacher should sound slowed, not like a cartoon. */
	const keepPitch = (el: HTMLMediaElement) => {
		el.preservesPitch = true;
	};
</script>

{#if kind === 'video'}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		{src}
		controls
		playsinline
		preload="metadata"
		class="aspect-video w-full bg-black"
		class:mirror
		bind:playbackRate={rate}
		{@attach watchMedia(src, onproblem)}
		{@attach keepPitch}
	></video>
{:else}
	<audio
		{src}
		controls
		preload="metadata"
		class="w-full p-2"
		bind:playbackRate={rate}
		{@attach watchMedia(src, onproblem)}
		{@attach keepPitch}
	></audio>
{/if}
<div class="flex items-center gap-2 px-3 pt-2 text-[12px]">
	{#if kind === 'video'}
		<button
			type="button"
			aria-pressed={mirror}
			onclick={() => choose({ mirror: !mirror })}
			class="h-8 rounded-lg border px-2.5 {mirror
				? 'border-accent text-accent'
				: 'border-rule text-ink-2'}">Mirror</button
		>
	{/if}
	<span class="ml-auto flex gap-1" role="group" aria-label="Speed">
		{#each VIDEO_RATES as r (r)}
			<button
				type="button"
				aria-pressed={rate === r}
				onclick={() => choose({ rate: r })}
				class="h-8 min-w-11 rounded-lg border px-2 {rate === r
					? 'border-accent bg-accent text-accent-ink'
					: 'border-rule text-ink-2'}">{r}×</button
			>
		{/each}
	</span>
</div>

<style>
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
```

- [ ] **Step 7: `LinkedText.svelte`, `YouTubeCard.svelte`, `LinkList.svelte`, `LinksEditor.svelte`**

```svelte
<!-- src/lib/components/ui/LinkedText.svelte -->
<script lang="ts">
	import { textPieces } from '$lib/links';

	interface Props {
		text: string;
		class?: string;
	}

	// Pieces, not {@html}: the URLs become <a> elements Svelte builds, so there
	// is no string of markup anywhere for a note to inject into.
	let { text, class: klass = '' }: Props = $props();
</script>

<p class={klass}>
	{#each textPieces(text) as piece, i (i)}{#if 'url' in piece}<a
				href={piece.url}
				target="_blank"
				rel="noopener noreferrer"
				class="break-all text-accent underline">{piece.url}</a
			>{:else}{piece.text}{/if}{/each}
</p>
```

```svelte
<!-- src/lib/components/links/YouTubeCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { youtubeEmbed, youtubeThumb, youtubeWatch } from '$lib/links';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';

	interface Props {
		id: string;
		start: number | null;
		title: string | null;
	}

	let { id, start, title }: Props = $props();

	/*
	 * A thumbnail until tapped. Five iframes on a lesson would load five players
	 * on mobile data before anyone pressed play; one image each costs almost
	 * nothing, and the tap that swaps in the iframe also starts it (autoplay=1).
	 */
	let playing = $state(false);
	let mirror = $state(false);
	onMount(() => {
		mirror = loadVideoPrefs().mirror;
	});

	function toggleMirror() {
		mirror = !mirror;
		saveVideoPrefs({ ...loadVideoPrefs(), mirror });
	}
</script>

{#if playing}
	<iframe
		src={youtubeEmbed(id, start)}
		title={title ?? 'YouTube video'}
		class="aspect-video w-full bg-black"
		class:mirror
		allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
		allowfullscreen
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
{:else}
	<button
		type="button"
		class="relative block aspect-video w-full bg-black"
		aria-label="Play {title ?? 'the video'}"
		onclick={() => (playing = true)}
	>
		<img src={youtubeThumb(id)} alt="" loading="lazy" class="size-full object-cover" class:mirror />
		<span class="absolute inset-0 grid place-items-center">
			<span class="grid size-14 place-items-center rounded-full bg-black/70 text-[22px] text-white"
				>▶</span
			>
		</span>
	</button>
{/if}
<div class="flex items-center gap-2 px-3 py-2 text-[12px]">
	<span class="min-w-0 flex-1 truncate text-ink-2">{title ?? 'YouTube'}</span>
	<button
		type="button"
		aria-pressed={mirror}
		onclick={toggleMirror}
		class="h-8 rounded-lg border px-2.5 {mirror ? 'border-accent text-accent' : 'border-rule text-ink-2'}"
		>Mirror</button
	>
	<!-- Always offered: the work PC's browser may block the embed outright. -->
	<a href={youtubeWatch(id, start)} target="_blank" rel="noopener noreferrer" class="text-accent"
		>Open on YouTube ↗</a
	>
</div>

<style>
	/* The embed's own controls mirror with it — the accepted cost of doing this from outside. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
```

```svelte
<!-- src/lib/components/links/LinkList.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import YouTubeCard from './YouTubeCard.svelte';
	import { parseLink } from '$lib/links';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** Per-link controls under each row — the editor's Remove button. */
		actions?: Snippet<[LinkRow]>;
	}

	let { links, actions }: Props = $props();
</script>

{#if links.length > 0}
	<ul class="space-y-3">
		{#each links as link (link.id)}
			{@const parsed = parseLink(link.url)}
			<li class="overflow-hidden rounded-xl border border-line bg-raised">
				{#if parsed?.kind === 'youtube'}
					<YouTubeCard id={parsed.id} start={parsed.start} title={link.title} />
				{:else if parsed}
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 px-3 py-3"
					>
						<span class="min-w-0 flex-1 truncate text-[15px]">{link.title ?? parsed.host}</span>
						<span class="text-muted" aria-hidden="true">↗</span>
					</a>
				{:else}
					<!-- Unreachable for a stored row; if it ever happens it is text, never a link. -->
					<p class="px-3 py-3 text-[13px] break-all text-muted">{link.url}</p>
				{/if}
				{#if actions}
					<div class="flex justify-end border-t border-line px-2">{@render actions(link)}</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
```

```svelte
<!-- src/lib/components/links/LinksEditor.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import LinkList from './LinkList.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** The last addLink failure, if any. */
		message: string | null;
		/** What was typed, handed back by a failed addLink. */
		entered: string;
	}

	let { links, message, entered }: Props = $props();
</script>

<LinkList {links}>
	{#snippet actions(link)}
		<form method="POST" action="?/deleteLink" use:enhance>
			<input type="hidden" name="linkId" value={link.id} />
			<button type="submit" class="h-9 px-2 text-[13px] text-danger">Remove</button>
		</form>
	{/snippet}
</LinkList>

<form
	method="POST"
	action="?/addLink"
	class="mt-3 space-y-2"
	use:enhance={() =>
		async ({ update, result }) => {
			// Keep the typed text on a failure so the bad line can be fixed in place.
			await update({ reset: result.type === 'success' });
		}}
>
	<textarea
		name="urls"
		rows="2"
		placeholder="Paste YouTube or other links, one per line"
		class={FIELD}>{entered}</textarea
	>
	<input name="title" maxlength="200" placeholder="Title (optional, for one link)" class={FIELD} />
	{#if message}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{message}</p>
	{/if}
	<button type="submit" class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium"
		>Add link</button
	>
</form>
```

- [ ] **Step 8: The figure page**

`src/routes/[dance]/figures/[id]/+page.server.ts`:

- `load` returns, in addition, `links: listLinks(db, { figureId: found.figure.id })`
  and `taughtIn: taughtIn(db, found.figure.id)`.
- Two new actions:

```ts
	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { figureId: figureOf(params).figure.id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { figureId: figureOf(params).figure.id }),
```

`src/routes/[dance]/figures/[id]/+page.svelte`:

- Delete the local `broken`/`diagnose`/`watchMedia` block (the duplicate of
  `$lib/media`) and use `let broken = $state<Record<number, MediaProblem>>({});`
  with `import type { MediaProblem } from '$lib/media';`.
- Notes: replace `<p class="mt-2 text-[15px] whitespace-pre-line">{figure.notes}</p>`
  with `<LinkedText text={figure.notes} class="mt-2 text-[15px] whitespace-pre-line" />`.
- Recordings: replace the `<video …>` and `<audio …>` branches with one
  `<VideoFrame src="/recordings/{rec.file}" kind={rec.kind} onproblem={(p) => (broken = { ...broken, [rec.id]: p })} />`
  (the missing/unplayable branches above it stay).
- After the Recordings section add:

```svelte
	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Links</h2>
		<LinksEditor links={data.links} message={linkFailure} entered={linkEntered} />
	</section>

	{#if data.taughtIn.length > 0}
		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Taught in</h2>
			<ul class="space-y-1">
				{#each data.taughtIn as lesson (lesson.id)}
					<li>
						<a
							class="text-[15px] text-accent"
							href={resolve('/[dance]/lessons/[id]', { dance: data.dance.slug, id: String(lesson.id) })}
							>{lesson.title}</a
						>
						<span class="text-[12px] text-muted">· {dateLabel(lesson.lessonDay)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
```

with, in the script:

```ts
	const linkFailure = $derived(
		form && 'action' in form && form.action === 'addLink' && 'message' in form
			? String(form.message)
			: null
	);
	const linkEntered = $derived(form && 'urls' in form ? String(form.urls) : '');
```

and the imports `LinkedText`, `VideoFrame`, `LinksEditor`.

- [ ] **Step 9: The lesson page**

`src/routes/[dance]/lessons/[id]/+page.server.ts`: `load` adds
`links: listLinks(db, { lessonId: found.lesson.id })`; add `addLink`/`deleteLink`
actions exactly as the figure page's, with `{ lessonId: lessonOf(params).lesson.id }`.

`src/routes/[dance]/lessons/[id]/+page.svelte`:

- Notes → `<LinkedText text={lesson.notes} class="mt-2 text-[15px] whitespace-pre-line" />`.
- The `<video …>` → `<VideoFrame src="/lesson-videos/{video.file}" onproblem={(p) => (broken = { ...broken, [video.id]: p })} />`.
- A Links section **above** Videos: `<h2 class={heading}>Links</h2>` +
  `<LinksEditor links={data.links} message={failure('addLink')} entered={form && 'urls' in form ? String(form.urls) : ''} />`.
  (`failure` on this page is already `form?.action === action ? form.message : null`.)

- [ ] **Step 10: Dance-wall tests for the link actions**

In `dance-wall.spec.ts` add (import `links` from the schema):

```ts
describe('links stay on their own side of the wall', () => {
	it('will not add a link to a bachata figure or lesson under salsa', async () => {
		await refuses(figurePage.actions.addLink, post('salsa', { urls: 'https://a.org' }, String(bachataFigureId)));
		await refuses(lessonPage.actions.addLink, post('salsa', { urls: 'https://a.org' }, String(bachataLessonId)));
		expect(db.select().from(links).all()).toHaveLength(0);
	});
});
```

- [ ] **Step 11: Look at it**

Run `nix develop -c npm run dev`, sign in (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, see
CLAUDE.md), and on a figure and a lesson: paste two links (one YouTube, one
not) at once; paste `javascript:x` (refused, text kept); tap a YouTube card
(the iframe plays), toggle Mirror (flips, and stays flipped after a reload);
set a recording to 0.5×. Check the dev DB's lessons got their note URLs
(`nix develop -c sqlite3 .data/salsa.db "select count(*) from links"` after the
first boot). Check at 375 px wide: no horizontal scroll.

- [ ] **Step 12: Prove, check and commit**

In `addLinkFrom`, move the `bad.length > 0` check below `addLinks` — the "stores
nothing when any line is bad" test must fail. Restore.

```bash
nix develop -c npx prettier --write src/lib src/routes
nix develop -c npm run check
git add -A src/lib src/routes
git commit -m "links: an editor on lessons and figures, embeds, mirror and speed, clickable notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Count and clave chips out of `Setup`; the stray player line

**Files:**

- Create: `src/lib/components/player/CountChips.svelte`,
  `src/lib/components/player/ClaveChips.svelte`
- Modify: `src/lib/components/player/Setup.svelte`,
  `src/routes/[dance]/player/+page.svelte`

**Interfaces:**

- Consumes: `CHIP` (Task 8).
- Produces: `<CountChips patterns value onchange name? />`,
  `<ClaveChips value onchange name? />` — `onchange(CountPattern)` /
  `onchange(ClavePattern | null)`.

- [ ] **Step 1: The two components**

```svelte
<!-- src/lib/components/player/CountChips.svelte -->
<script lang="ts">
	import { COUNT_PATTERN_LABEL, type CountPattern } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';

	interface Props {
		patterns: readonly CountPattern[];
		value: CountPattern;
		onchange: (pattern: CountPattern) => void;
		name?: string;
	}

	let { patterns, value, onchange, name = 'count' }: Props = $props();
</script>

<!--
	Wraps rather than sharing one row: seven options do not fit at 375 px, and a
	fast song needs the sparse ones to be as reachable as salsa.
-->
<div class="flex flex-wrap gap-2">
	{#each patterns as p (p)}
		<label class="{CHIP} min-w-[5.5rem] grow-0 basis-auto px-3">
			<input type="radio" {name} checked={value === p} onchange={() => onchange(p)} class="sr-only" />
			{COUNT_PATTERN_LABEL[p]}
		</label>
	{/each}
</div>
```

```svelte
<!-- src/lib/components/player/ClaveChips.svelte -->
<script lang="ts">
	import { CLAVE_PATTERNS, type ClavePattern } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';

	interface Props {
		value: ClavePattern | null;
		onchange: (clave: ClavePattern | null) => void;
		name?: string;
	}

	let { value, onchange, name = 'clave' }: Props = $props();
</script>

<div class="flex gap-2">
	<label class={CHIP}>
		<input type="radio" {name} checked={value === null} onchange={() => onchange(null)} class="sr-only" />
		Off
	</label>
	{#each CLAVE_PATTERNS as c (c)}
		<label class={CHIP}>
			<input type="radio" {name} checked={value === c} onchange={() => onchange(c)} class="sr-only" />
			{c}
		</label>
	{/each}
</div>
```

- [ ] **Step 2: Use them in `Setup.svelte`**

Replace the `<div class="flex flex-wrap gap-2">…{#each dance.countPatterns…}…</div>`
inside the "Voice count" fieldset with
`<CountChips patterns={dance.countPatterns} value={count} onchange={(p) => (countOverride = p)} />`,
and the `<div class="flex gap-2">…</div>` inside the "Clave" fieldset with
`<ClaveChips value={clave} onchange={(c) => (claveOverride = c)} />`. Keep the
fieldsets, legends and the "Use my own voice" link. Remove `CLAVE_PATTERNS` and
`COUNT_PATTERN_LABEL` from Setup's imports if now unused. Move the "Wraps
rather than sharing one row" comment out (it now lives in CountChips).

- [ ] **Step 3: Remove the stray line**

In `src/routes/[dance]/player/+page.svelte`, delete the line
`const activeSlot = $derived(slotAt(calledIndex, dancedSlots.length));` that sits
**after** `</script>` (around line 183). The real declaration inside the script
(around line 40) stays.

- [ ] **Step 4: Look at it, check and commit**

`nix develop -c npm run dev`: open `/salsa/player` — the setup looks and
behaves exactly as before (count chips wrap, clave chips, choices persist
across a reload), and no `const activeSlot` text appears on the page. Open
`/bachata/player` — no clave row.

```bash
nix develop -c npx prettier --write src/lib/components/player src/routes/\[dance\]/player
nix develop -c npm run check
git add src/lib/components/player src/routes/\[dance\]/player
git commit -m "player: count and clave chips as components; drop a line printed as text

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The practice panel, and a guarded Sheet

**Files:**

- Create: `src/lib/components/player/PracticePanel.svelte`
- Modify: `src/lib/components/ui/Sheet.svelte`

**Interfaces:**

- Consumes: `createPlayer`, `PlayerHandle` (`$lib/scheduler/attach`);
  `syntheticGrid`, `UNIFORM_FLOW`, `Flow` (`$lib/scheduler/scheduler`);
  `parsePracticeConfig`, `practiceSummary`, `hourOfBars`, `DEFAULT_PRACTICE_BPM`,
  `CUE_EVERY`, `CueEvery` (Task 2); `STOPPED`, `startWatch`, `pauseWatch`,
  `elapsedMs` (Task 2); `CountChips`, `ClaveChips` (Task 9); `CHIP`, `LABEL`
  (Task 8); `LiveCount`; `clock` from `$lib/format`; `SongGrid`, `CountTakeRow`,
  `ExerciseItem` from `$lib/types`; `GET /[dance]/songs/[id]/grid` and
  `POST /[dance]/exercises/[id]/practice` (Task 7).
- Produces:
  - `Sheet` props gain `guard?: boolean` and `onguarded?: () => void`. While
    `guard` is true, the backdrop tap, Escape and ✕ call `onguarded` instead of
    `onclose`.
  - `<PracticePanel dance exercise songs takes cue onrun onactive />`:
    - `cue: { figureId: number; say: string; eights: number } | null` — only the figure popup passes one
    - `onrun(run: { durationS: number; playerJson: string })` — after every stop, with the running total
    - `onactive(active: boolean)` — true while a run is playing or paused

- [ ] **Step 1: Guard the Sheet**

In `src/lib/components/ui/Sheet.svelte` add to `Props`:

```ts
		/**
		 * While true, nothing closes the sheet by accident: the backdrop tap,
		 * Escape and ✕ call `onguarded` instead, and the caller decides (the log
		 * popup asks "Discard 4 min of practice?"). A stray tap must never throw
		 * away a run — the player's own save sheet has exactly that known gap.
		 */
		guard?: boolean;
		onguarded?: () => void;
```

destructure `guard = false, onguarded`, and change the three close paths:

```svelte
<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	oncancel={(e) => {
		// Escape. Cancelling it keeps the dialog open; Chrome lets a SECOND
		// Escape through regardless (its anti-trap rule), which then closes
		// normally — see Known gaps.
		if (guard) {
			e.preventDefault();
			onguarded?.();
		}
	}}
	onclick={(e) => {
		// A click on the backdrop lands on the dialog element itself.
		if (e.target !== dialog) return;
		if (guard) onguarded?.();
		else onclose();
	}}
>
```

and the ✕ button's `onclick={() => (guard ? onguarded?.() : onclose())}`.

- [ ] **Step 2: Write `PracticePanel.svelte`**

```svelte
<!-- src/lib/components/player/PracticePanel.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { CHIP, FIELD, LABEL } from '$lib/components/ui/styles';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { syntheticGrid, UNIFORM_FLOW, type Flow } from '$lib/scheduler/scheduler';
	import { SPEEDS, type ClavePattern, type CountPattern, type Speed } from '$lib/labels';
	import {
		CUE_EVERY,
		DEFAULT_PRACTICE_BPM,
		hourOfBars,
		parsePracticeConfig,
		practiceSummary,
		type CueEvery
	} from '$lib/exercises/practice';
	import { STOPPED, elapsedMs, pauseWatch, startWatch } from '$lib/exercises/stopwatch';
	import { clock } from '$lib/format';
	import type { Dance } from '$lib/dances/dances';
	import type { CountTakeRow, ExerciseItem, SongGrid } from '$lib/types';

	interface Props {
		dance: Dance;
		exercise: ExerciseItem;
		/** This dance's ready songs. */
		songs: { id: number; title: string }[];
		takes: CountTakeRow[];
		/** The figure to call on cue — the figure popup only. */
		cue: { figureId: number; say: string; eights: number } | null;
		/** After every stop, with the total so far: fills Minutes and the set's run. */
		onrun: (run: { durationS: number; playerJson: string }) => void;
		/** True while a run is playing or paused, so the popup guards against closing. */
		onactive: (active: boolean) => void;
	}

	let { dance, exercise, songs, takes, cue, onrun, onactive }: Props = $props();

	// Seeded once from what the exercise remembers. The popup remounts this
	// component after every logged set, so "once" is per set, which is right.
	const remembered = parsePracticeConfig(exercise.practiceJson, dance);
	const songReady = songs.some((s) => s.id === exercise.songId);
	/**
	 * A remembered song can stop being playable — archived, or re-analysed and
	 * failed — between one practice and the next. Then the panel opens on count
	 * and says so, rather than failing at Play.
	 */
	const songGone = exercise.practiceMode === 'song' && !songReady;

	let source = $state<'count' | 'song'>(
		exercise.practiceMode === 'song' && songReady ? 'song' : 'count'
	);
	let songId = $state<number | null>(songReady ? exercise.songId : (songs[0]?.id ?? null));
	let bpm = $state(exercise.countBpm ?? DEFAULT_PRACTICE_BPM);
	let count = $state<CountPattern>(remembered.count);
	let clave = $state<ClavePattern | null>(remembered.clave);
	let speed = $state<Speed>(remembered.speed);
	let callEvery = $state<CueEvery | null>(cue ? remembered.callEvery : null);
	let voiceVolume = $state(1);
	let expanded = $state(songGone);

	let grid = $state<SongGrid | null>(null);
	let gridError = $state<string | null>(null);
	let audio: HTMLAudioElement | undefined = $state();

	let player = $state<PlayerHandle | null>(null);
	let runGrid = $state<{ beats: number[]; counts: number[] } | null>(null);
	let paused = $state(false);
	let starting = $state(false);
	let startError = $state<string | null>(null);
	let watch = $state(STOPPED);
	let now = $state(Date.now());
	let calls = 0;

	const songTitle = $derived(songs.find((s) => s.id === songId)?.title ?? null);
	const summary = $derived(
		practiceSummary({ mode: source, bpm, songTitle, config: { count, clave, speed, callEvery } }, dance)
	);
	const canPlay = $derived(source === 'count' ? bpm >= 60 && bpm <= 300 : grid !== null);

	// The grid is fetched when a song is chosen — never on the Play tap, which
	// must reach `start()` without awaiting anything or iOS keeps the audio locked.
	$effect(() => {
		if (source !== 'song' || songId === null) {
			grid = null;
			return;
		}
		const id = songId;
		let cancelled = false;
		gridError = null;
		grid = null;
		fetch(`/${dance.slug}/songs/${id}/grid`)
			.then((r) => (r.ok ? (r.json() as Promise<SongGrid>) : Promise.reject(new Error(String(r.status)))))
			.then((g) => {
				if (!cancelled) grid = g;
			})
			.catch(() => {
				if (!cancelled) gridError = 'That song could not be loaded. Pick another, or use the count.';
			});
		return () => {
			cancelled = true;
		};
	});

	// The elapsed clock on screen; the stopwatch itself needs no timer.
	$effect(() => {
		if (!player || paused) return;
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});

	$effect(() => onactive(player !== null));

	/** Remember these choices for next time. A convenience: a failure changes nothing. */
	function remember() {
		void fetch(`/${dance.slug}/exercises/${exercise.id}/practice`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				mode: source,
				songId: source === 'song' ? songId : null,
				countBpm: source === 'count' ? bpm : null,
				config: { count, clave, speed, callEvery }
			})
		}).catch(() => {});
	}

	/**
	 * Runs inside the Play tap. Everything up to `handle.start()` is synchronous
	 * on purpose: iOS unlocks audio only from a real gesture, and an `await`
	 * before it would forfeit that. `starting` stops a second impatient tap from
	 * building a second, unreachable player (the player page's own lesson).
	 */
	async function play() {
		if (starting || player || !canPlay) return;
		starting = true;
		startError = null;
		const useSong = source === 'song' && grid !== null && audio !== undefined;
		const g = useSong ? { beats: grid!.beats, counts: grid!.counts } : syntheticGrid(bpm, hourOfBars(bpm));
		if (useSong && audio) {
			// Set before start: the scheduler reads the element's rate to map song
			// time onto the audio clock from its very first tick.
			audio.playbackRate = speed;
			audio.preservesPitch = true;
		}
		// One figure, spaced by its own length, so a two-eight figure is never
		// called over itself. `pickFigure` returns the only id of a one-figure pool.
		const flow: Flow = cue ? { pick: UNIFORM_FLOW.pick, eights: () => cue.eights } : UNIFORM_FLOW;
		const handle = createPlayer({
			audio: useSong ? audio! : null,
			grid: g,
			toggles: {
				count,
				clave: dance.clave ? clave : null,
				callEvery: cue && callEvery ? callEvery : null
			},
			pool: cue && callEvery ? [cue.figureId] : [],
			flow,
			sayOf: () => cue?.say ?? '',
			voiceVolume,
			// Only the chosen pattern's takes: a salsa recording must never stand in
			// for a son count, whose words fall on different beats.
			takes: takes.filter((t) => t.pattern === count),
			onCall: () => {
				calls += 1;
			},
			onEnd: () => stop()
		});
		try {
			await handle.start();
		} catch (e) {
			startError = e instanceof Error ? e.message : 'Could not start the count.';
			starting = false;
			return;
		}
		player = handle;
		runGrid = g;
		paused = false;
		watch = startWatch(watch, Date.now());
		starting = false;
		remember();
	}

	function pause() {
		player?.pause();
		paused = true;
		watch = pauseWatch(watch, Date.now());
	}

	async function resume() {
		await player?.resume();
		paused = false;
		watch = startWatch(watch, Date.now());
	}

	function stop() {
		if (!player) return;
		player.stop();
		player = null;
		runGrid = null;
		paused = false;
		watch = pauseWatch(watch, Date.now());
		onrun({
			durationS: Math.round(elapsedMs(watch, Date.now()) / 1000),
			playerJson: JSON.stringify({
				source,
				songId: source === 'song' ? songId : null,
				bpm: source === 'count' ? bpm : null,
				speed: source === 'song' ? speed : 1,
				count,
				clave: dance.clave ? clave : null,
				callEvery: cue ? callEvery : null,
				calls
			})
		});
	}

	// Closing the popup, or leaving the page, must never leave an AudioContext
	// or a screen wake lock running.
	onDestroy(() => player?.stop());
	$effect(() => {
		const onUnload = () => player?.stop();
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
</script>

<section class="rounded-xl border border-line bg-raised p-3">
	{#if player && runGrid}
		<LiveCount time={() => player?.songTime() ?? null} beats={runGrid.beats} counts={runGrid.counts} />
		<p class="mt-1 text-center text-[13px] text-muted tabular-nums">
			{clock(elapsedMs(watch, now) / 1000)} · {summary}
		</p>
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				class="h-12 flex-1 rounded-xl border border-rule text-[15px] font-medium"
				onclick={() => (paused ? resume() : pause())}>{paused ? 'Resume' : 'Pause'}</button
			>
			<button
				type="button"
				class="h-12 flex-1 rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				onclick={stop}>Stop</button
			>
		</div>
		<label class="mt-3 block">
			<span class={LABEL}>Voice volume</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				bind:value={voiceVolume}
				oninput={() => player?.setVoiceVolume(voiceVolume)}
				class="w-full"
			/>
		</label>
	{:else}
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="min-w-0 flex-1 text-left"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				<span class="block text-[12px] text-muted">Practise with</span>
				<span class="block truncate text-[14px] font-medium">{summary}</span>
			</button>
			<button
				type="button"
				disabled={starting || !canPlay}
				aria-label="Play"
				class="grid size-12 place-items-center rounded-full bg-accent text-[20px] text-accent-ink disabled:opacity-50"
				onclick={play}>{starting ? '…' : '▶'}</button
			>
		</div>
		{#if watch.bankedMs > 0}
			<p class="mt-2 text-[12px] text-muted">
				{clock(elapsedMs(watch, Date.now()) / 1000)} practised — ▶ carries on.
			</p>
		{/if}
		{#if songGone}
			<p class="mt-2 rounded-lg bg-plane px-3 py-2 text-[13px] text-muted">
				Its song is not ready — pick another, or use the count.
			</p>
		{/if}
		{#if startError}
			<p class="mt-2 text-[13px] text-danger" role="alert">{startError}</p>
		{/if}

		{#if expanded}
			<div class="mt-3 space-y-4">
				{#if songs.length > 0}
					<fieldset>
						<legend class={LABEL}>Source</legend>
						<div class="flex gap-2">
							<label class={CHIP}>
								<input type="radio" name="panel-source" checked={source === 'count'} onchange={() => (source = 'count')} class="sr-only" />
								Count only
							</label>
							<label class={CHIP}>
								<input type="radio" name="panel-source" checked={source === 'song'} onchange={() => (source = 'song')} class="sr-only" />
								A song
							</label>
						</div>
					</fieldset>
				{/if}

				{#if source === 'song'}
					<label class="block">
						<span class={LABEL}>Song</span>
						<select bind:value={songId} class={FIELD}>
							{#each songs as s (s.id)}
								<option value={s.id}>{s.title}</option>
							{/each}
						</select>
					</label>
					{#if gridError}<p class="text-[13px] text-danger">{gridError}</p>{/if}
					<fieldset>
						<legend class={LABEL}>Speed</legend>
						<div class="flex gap-2">
							{#each SPEEDS as s (s)}
								<label class={CHIP}>
									<input type="radio" name="panel-speed" checked={speed === s} onchange={() => (speed = s)} class="sr-only" />
									{s}×
								</label>
							{/each}
						</div>
					</fieldset>
				{:else}
					<label class="block">
						<span class={LABEL}>Tempo (BPM)</span>
						<input type="number" inputmode="numeric" min="60" max="300" bind:value={bpm} class={FIELD} />
					</label>
				{/if}

				<fieldset>
					<legend class={LABEL}>Voice count</legend>
					<CountChips name="panel-count" patterns={dance.countPatterns} value={count} onchange={(p) => (count = p)} />
				</fieldset>

				{#if dance.clave}
					<fieldset>
						<legend class={LABEL}>Clave</legend>
						<ClaveChips name="panel-clave" value={clave} onchange={(c) => (clave = c)} />
					</fieldset>
				{/if}

				{#if cue}
					<fieldset>
						<legend class={LABEL}>Call it on cue</legend>
						<div class="flex gap-2">
							<label class={CHIP}>
								<input type="radio" name="panel-cue" checked={callEvery === null} onchange={() => (callEvery = null)} class="sr-only" />
								Off
							</label>
							{#each CUE_EVERY as n (n)}
								<label class={CHIP}>
									<input type="radio" name="panel-cue" checked={callEvery === n} onchange={() => (callEvery = n)} class="sr-only" />
									Every {n}
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}
			</div>
		{/if}
	{/if}

	{#if source === 'song' && grid}
		<!-- Mounted before Play, with its src, so the tap only has to call start(). -->
		<audio bind:this={audio} src="/audio/{grid.audioFile}" preload="auto"></audio>
	{/if}
</section>
```

Notes for the implementer:

- `onactive` reports `player !== null` only. The popup adds "or a run is
  banked but not logged" itself (Task 12) — it knows when a set was saved.
- The `<audio>` sits outside the `{#if player}` branch so it is never
  unmounted mid-run.
- If svelte-check objects to the non-null assertions (`grid!`, `audio!`),
  narrow into local constants instead; do not add `// @ts-ignore`.

- [ ] **Step 3: Check it builds**

Run: `nix develop -c npm run check:types`
Expected: no errors. (The panel is mounted by the popups in Task 12; its
manual test is Task 12's Step 9.)

- [ ] **Step 4: Commit**

```bash
nix develop -c npx prettier --write src/lib/components/player/PracticePanel.svelte src/lib/components/ui/Sheet.svelte
nix develop -c npm run check
git add src/lib/components/player/PracticePanel.svelte src/lib/components/ui/Sheet.svelte
git commit -m "practice: a slim count/clave/song panel, and a Sheet that can refuse to close

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: The exercise page, and each type's content

**Files:**

- Create: `src/routes/[dance]/exercises/[id]/+page.server.ts`,
  `src/routes/[dance]/exercises/[id]/+page.svelte`,
  `src/lib/server/popup.ts`,
  `src/lib/components/exercises/kinds/index.ts`,
  `src/lib/components/exercises/kinds/lesson/Content.svelte`,
  `src/lib/components/exercises/kinds/figure/Content.svelte`,
  `src/lib/components/exercises/kinds/drill/Content.svelte`,
  `src/lib/components/exercises/kinds/routine/Content.svelte`,
  `src/lib/components/exercises/SetList.svelte`
- Modify: `src/routes/[dance]/+page.server.ts`, `src/routes/[dance]/+page.svelte`,
  `src/lib/components/today/LogSheet.svelte`,
  `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**

- Consumes: `practicePayload` (Task 7); `exerciseHistory`, `exerciseSummary`,
  `updateExercise`, `archiveExercise`, `listExercises` (Task 5);
  `logSetFrom`, `deleteSetFrom` (Task 6); `addLinkFrom`, `deleteLinkFrom`,
  `LinksEditor`, `LinkList`, `LinkedText`, `VideoFrame` (Task 8); `TYPES`,
  `typeOf` (Task 2).
- Produces:
  - `popup.ts`: `popupData(db: Db, dance: DanceSlug, exerciseId: number, tz: string, now: number)`
    → `{ exercise: ExerciseItem; sets: HistorySet[] /* today's */; songs: { id: number; title: string }[]; takes: CountTakeRow[] } | null`
  - `kinds/index.ts`: `contentFor(type: ExerciseType): Component<ContentProps>`,
    `interface ContentProps { dance: Dance; content: PracticeContent; editLinks?: { message: string | null; entered: string } }`
  - `<SetList sets timezone />` — rows with time, `setSummary`, note, Delete
    (posts `?/deleteSet`)
  - Exercise page actions: `log`, `deleteSet`, `update`, `archive`, `addLink`, `deleteLink`
  - Today no longer has `updateExercise` or `archiveExercise`.

- [ ] **Step 1: `popup.ts`**

```ts
// src/lib/server/popup.ts
/**
 * What a page needs to open a log popup for one exercise: the exercise as the
 * popup reads it, today's sets, and what the practice panel offers. Shared by
 * the exercise, figure and lesson pages; Today builds the same from the
 * lists it already loads.
 */
import { PHRASE_PATTERNS } from '$lib/labels';
import { localDay } from '$lib/day/day';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from './db';
import { listCountTakesFor } from './countTakes';
import { exerciseHistory, listExercises } from './exercises';
import { listReadySongs } from './songs';

export function popupData(db: Db, dance: DanceSlug, exerciseId: number, tz: string, now: number) {
	const exercise = listExercises(db, dance).find((e) => e.id === exerciseId);
	if (!exercise) return null;
	const today = localDay(now, tz);
	return {
		exercise,
		// Fifty is far more sets than one day holds; the filter decides "today".
		sets: exerciseHistory(db, exerciseId, 50).filter((s) => localDay(s.doneAt, tz) === today),
		songs: listReadySongs(db, dance),
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, p))
	};
}
```

- [ ] **Step 2: The exercise page's server**

```ts
// src/routes/[dance]/exercises/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { archiveExercise, exerciseHistory, exerciseSummary, updateExercise } from '$lib/server/exercises';
import { checkbox, int, optionalText, text } from '$lib/server/form';
import { addLinkFrom, deleteLinkFrom } from '$lib/server/link-form';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { practicePayload } from '$lib/server/practice-content';
import { danceOf, requireExerciseInDance } from '$lib/server/scope';
import { isFrequency } from '$lib/frequency';
import type { Actions, PageServerLoad } from './$types';

/**
 * The exercise this URL names, or a 404. An archived exercise is gone from
 * every list, so it is gone from its own URL too — the figure page's rule.
 */
function exerciseOf(params: { dance: string; id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) throw error(404, 'No such exercise');
	const exercise = requireExerciseInDance(getDb(), danceOf(params), id);
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	const row = exerciseOf(params);
	const now = Date.now();
	const popup = popupData(db, danceOf(params), row.id, locals.user.timezone, now);
	if (!popup) throw error(404, 'No such exercise');
	return {
		...popup,
		practice: practicePayload(db, row, locals.user.timezone, now),
		history: exerciseHistory(db, row.id),
		summary: exerciseSummary(db, row.id)
	};
};

export const actions: Actions = {
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	update: async ({ params, request }) => {
		const id = exerciseOf(params).id;
		const form = await request.formData();
		const name = text(form, 'name') ?? '';
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		if (everyDays === undefined || !isFrequency(everyDays) || notes === undefined) {
			return fail(400, { action: 'update', message: 'Check the values and try again.' });
		}
		if (!updateExercise(getDb(), id, { name, everyDays, notes, active: checkbox(form, 'active') })) {
			throw error(404, 'No such exercise');
		}
		return { action: 'update', ok: true };
	},

	archive: ({ params }) => {
		if (!archiveExercise(getDb(), exerciseOf(params).id, Date.now())) {
			return fail(400, {
				action: 'archive',
				message: 'Only custom exercises are archived here. Archive a figure from its page.'
			});
		}
		throw redirect(303, `/${params.dance}`);
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { exerciseId: exerciseOf(params).id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { exerciseId: exerciseOf(params).id })
};
```

- [ ] **Step 3: `SetList.svelte`**

```svelte
<!-- src/lib/components/exercises/SetList.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { setSummary } from '$lib/format';
	import { timeOfDay } from '$lib/day/day';
	import type { HistorySet } from '$lib/types';

	interface Props {
		sets: HistorySet[];
		timezone: string;
	}

	let { sets, timezone }: Props = $props();
</script>

<ul class="divide-y divide-line rounded-xl border border-line">
	{#each sets as s (s.id)}
		<li class="flex items-center gap-3 px-3 py-2">
			<span class="text-[13px] text-muted tabular-nums">{timeOfDay(s.doneAt, timezone)}</span>
			<span class="min-w-0 flex-1 text-[14px]">
				{setSummary(s) || 'Set'}
				{#if s.note}<span class="block truncate text-[12px] text-muted">{s.note}</span>{/if}
			</span>
			<form method="POST" action="?/deleteSet" use:enhance>
				<input type="hidden" name="setId" value={s.id} />
				<button
					type="submit"
					class="h-9 rounded-lg px-3 text-[13px] text-danger"
					aria-label="Delete set logged at {timeOfDay(s.doneAt, timezone)}">Delete</button
				>
			</form>
		</li>
	{/each}
</ul>
```

- [ ] **Step 4: The four Content components and the registry**

Each renders one type's content and narrows `content` to its own arm first; a
mismatch renders nothing (it cannot happen — the registry picks by the same
type the server built the content for).

```svelte
<!-- src/lib/components/exercises/kinds/lesson/Content.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import { dateLabel } from '$lib/format';
	import type { MediaProblem } from '$lib/media';
	import type { ContentProps } from '../index';

	let { dance, content }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'lesson'}
	<div class="space-y-3">
		<p class="text-[13px] text-muted">
			<a class="text-accent" href={resolve('/[dance]/lessons/[id]', { dance: dance.slug, id: String(content.lesson.id) })}
				>{content.lesson.title}</a
			>
			· {dateLabel(content.lesson.lessonDay)}
		</p>
		{#if content.lesson.notes}
			<LinkedText text={content.lesson.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		<LinkList links={content.links} />
		{#each content.videos as video (video.id)}
			<div class="overflow-hidden rounded-xl border border-line bg-raised pb-2">
				{#if broken[video.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[video.id] === 'missing' ? 'The file for this video is missing.' : "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/lesson-videos/{video.file}"
						onproblem={(p) => (broken = { ...broken, [video.id]: p })}
					/>
				{/if}
			</div>
		{/each}
		{#if content.figures.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each content.figures as f (f.id)}
					<li>
						<a
							href={resolve('/[dance]/figures/[id]', { dance: dance.slug, id: String(f.id) })}
							class="inline-block rounded-full border border-rule px-3 py-1.5 text-[13px]">{f.name}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
```

```svelte
<!-- src/lib/components/exercises/kinds/figure/Content.svelte -->
<script lang="ts">
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import type { MediaProblem } from '$lib/media';
	import type { ContentProps } from '../index';

	let { content }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'figure'}
	<div class="space-y-3">
		{#if content.figure.notes}
			<LinkedText text={content.figure.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		{#each content.recordings as rec (rec.id)}
			<div class="overflow-hidden rounded-xl border border-line bg-raised pb-2">
				{#if broken[rec.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[rec.id] === 'missing' ? 'The file for this recording is missing.' : "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/recordings/{rec.file}"
						kind={rec.kind}
						onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
					/>
				{/if}
			</div>
		{/each}
		<LinkList links={content.links} />
		{#if !content.figure.notes && content.recordings.length === 0 && content.links.length === 0}
			<p class="text-[13px] text-muted">No notes, recordings or links yet — add them on the figure page.</p>
		{/if}
	</div>
{/if}
```

```svelte
<!-- src/lib/components/exercises/kinds/drill/Content.svelte -->
<script lang="ts">
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import type { ContentProps } from '../index';

	// `editLinks` is honoured here only: a drill is the one type whose links are
	// its own. The other types' links are edited on their owner's page.
	let { content, editLinks }: ContentProps = $props();
</script>

{#if content.type === 'drill'}
	<div class="space-y-3">
		{#if content.notes}
			<LinkedText text={content.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		{#if editLinks}
			<LinksEditor links={content.links} message={editLinks.message} entered={editLinks.entered} />
		{:else}
			<LinkList links={content.links} />
		{/if}
	</div>
{/if}
```

```svelte
<!-- src/lib/components/exercises/kinds/routine/Content.svelte -->
<script lang="ts">
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import type { ContentProps } from '../index';

	let { content }: ContentProps = $props();
</script>

{#if content.type === 'routine'}
	<div class="space-y-3">
		{#if content.routine.notes}
			<LinkedText text={content.routine.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		<ol class="space-y-1.5">
			{#each content.slots as slot, i (i)}
				<li class="flex gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-[14px]">
					<span class="text-muted tabular-nums">{i + 1}</span>
					<span class="min-w-0 flex-1">
						{slot.names.join(' / ')}
						{#if slot.note}<span class="block text-[12px] text-muted">{slot.note}</span>{/if}
					</span>
				</li>
			{/each}
		</ol>
	</div>
{/if}
```

```ts
// src/lib/components/exercises/kinds/index.ts
/**
 * Each type's components. The pages ask here and never branch on the type
 * themselves — the guitar app's rule: the shell asks the registry for a
 * component; the type owns its experience.
 */
import type { Component } from 'svelte';
import type { Dance } from '$lib/dances/dances';
import type { ExerciseType } from '$lib/exercises/kinds';
import type { PracticeContent } from '$lib/types';
import LessonContent from './lesson/Content.svelte';
import FigureContent from './figure/Content.svelte';
import DrillContent from './drill/Content.svelte';
import RoutineContent from './routine/Content.svelte';

export interface ContentProps {
	dance: Dance;
	content: PracticeContent;
	/** Offer the links editor — only the drill's content, whose links are its own, honours it. */
	editLinks?: { message: string | null; entered: string };
}

const CONTENT: Record<ExerciseType, Component<ContentProps>> = {
	lesson: LessonContent,
	figure: FigureContent,
	drill: DrillContent,
	routine: RoutineContent
};

export const contentFor = (type: ExerciseType) => CONTENT[type];
```

- [ ] **Step 5: The exercise page**

```svelte
<!-- src/routes/[dance]/exercises/[id]/+page.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import SetList from '$lib/components/exercises/SetList.svelte';
	import { contentFor } from '$lib/components/exercises/kinds';
	import { FIELD, LABEL } from '$lib/components/ui/styles';
	import { FREQUENCIES } from '$lib/frequency';
	import { dayLabel, dateLabel } from '$lib/format';
	import { localDay } from '$lib/day/day';
	import { TYPES, typeOf } from '$lib/exercises/kinds';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const exercise = $derived(data.exercise);
	const type = $derived(typeOf(exercise.source));
	const Content = $derived(contentFor(type));
	/** A drill is the only type this page may rename or archive: the others belong to their owner. */
	const ownsItself = $derived(type === 'drill');
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failure = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form ? String(form.message) : null;

	/** The owner this exercise belongs to, named from the content the server already sent. */
	const owner = $derived.by(() => {
		const c = data.practice.content;
		const dance = data.dance.slug;
		if (c.type === 'figure')
			return { label: `Figure · ${c.figure.name}`, href: resolve('/[dance]/figures/[id]', { dance, id: String(c.figure.id) }) };
		if (c.type === 'lesson')
			return {
				label: `Lesson · ${dateLabel(c.lesson.lessonDay)}`,
				href: resolve('/[dance]/lessons/[id]', { dance, id: String(c.lesson.id) })
			};
		if (c.type === 'routine')
			return { label: `Routine · ${c.routine.name}`, href: resolve('/[dance]/routines/[id]', { dance, id: String(c.routine.id) }) };
		return null;
	});

	/** History grouped by calendar day in the user's zone, newest day first. */
	const days = $derived.by(() => {
		const groups: { day: string; sets: typeof data.history }[] = [];
		for (const s of data.history) {
			const day = localDay(s.doneAt, timezone);
			const last = groups.at(-1);
			if (last && last.day === day) last.sets.push(s);
			else groups.push({ day, sets: [s] });
		}
		return groups;
	});

	const hours = (s: number) => {
		const m = Math.round(s / 60);
		return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
	};
</script>

<svelte:head><title>{exercise.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]', { dance: data.dance.slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to Today">‹</a
	>
	<div class="min-w-0 flex-1">
		<h1 class="truncate text-[17px] font-semibold">{exercise.name}</h1>
		<p class="text-[12px] text-muted">{TYPES[type].label}</p>
	</div>
</header>

<main class="space-y-6 px-4 pt-4 pb-6">
	{#if owner}
		<a href={owner.href} class="block text-[14px] font-medium text-accent">{owner.label} →</a>
	{/if}

	<Content
		dance={data.dance}
		content={data.practice.content}
		editLinks={{ message: failure('addLink'), entered: form && 'urls' in form ? String(form.urls) : '' }}
	/>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">History</h2>
		{#if data.summary.sets === 0}
			<p class="text-[13px] text-muted">Nothing logged yet.</p>
		{:else}
			<p class="mb-3 text-[13px] text-ink-2">
				{data.summary.sets}
				{data.summary.sets === 1 ? 'set' : 'sets'}{data.summary.totalS > 0 ? ` · ${hours(data.summary.totalS)}` : ''}{data.summary.recentRating !== null
					? ` · recent ★ ${data.summary.recentRating}`
					: ''}
			</p>
			<div class="space-y-3">
				{#each days as g (g.day)}
					<div>
						<h3 class="mb-1 text-[12px] text-muted">{dayLabel(g.day)}</h3>
						<SetList sets={g.sets} {timezone} />
					</div>
				{/each}
			</div>
			{#if data.history.length < data.summary.sets}
				<p class="mt-2 text-[12px] text-muted">Showing the latest {data.history.length}.</p>
			{/if}
		{/if}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Settings</h2>
		<form method="POST" action="?/update" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-3">
			{#if ownsItself}
				<label class="block">
					<span class={LABEL}>Name</span>
					<input name="name" required maxlength="200" value={exercise.name} class={FIELD} />
				</label>
			{/if}
			<label class="block">
				<span class={LABEL}>How often</span>
				<select name="everyDays" class={FIELD} value={exercise.everyDays}>
					{#each FREQUENCIES as f (f.days)}
						<option value={f.days}>{f.label}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-3 text-[14px]">
				<input type="checkbox" name="active" checked={exercise.active} class="size-5" />
				Active — show it in the to-do list
			</label>
			<label class="block">
				<span class={LABEL}>{ownsItself ? 'Description' : 'Practice notes'}</span>
				<textarea name="notes" rows="3" maxlength="2000" class={FIELD}>{exercise.notes ?? ''}</textarea>
			</label>
			{#if failure('update')}
				<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{failure('update')}</p>
			{/if}
			<button type="submit" class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium">Save settings</button>
		</form>
		{#if ownsItself}
			<form method="POST" action="?/archive" class="mt-3">
				<button type="submit" class="h-10 text-[14px] text-danger">Archive exercise</button>
			</form>
			{#if failure('archive')}<p class="text-[13px] text-danger">{failure('archive')}</p>{/if}
		{/if}
	</section>
</main>
```

(`data.user` comes from the root layout as on the other pages — check with
`grep -rn "data.user" src/routes | head -3`.)

- [ ] **Step 6: Take the settings out of Today**

`src/routes/[dance]/+page.server.ts`: delete the `updateExercise` and
`archiveExercise` actions and every import only they used. Keep
`createExercise`.

`src/lib/components/today/LogSheet.svelte` (deleted in Task 12 — this keeps it
working until then): delete the whole `<details>…Exercise settings…</details>`
block, the `values` prop and everything that only served it (`practiceMode`,
`songId`, `countBpm`, `initialMode`, `songGone`, `practiceHref`, the "Practice"
link and the "Its song is not ready" paragraph, `FREQUENCIES`, the practice
label map). Add under the sets list:

```svelte
	<a
		href={resolve('/[dance]/exercises/[id]', { dance, id: String(exercise.id) })}
		class="mt-6 block text-[14px] font-medium text-accent">Details and settings →</a
	>
```

`src/routes/[dance]/+page.svelte`: stop passing `values`; remove
`updateExerciseValues`; the sheet's `message` becomes `failure('log')`.

- [ ] **Step 7: Move the dance-wall tests**

In `dance-wall.spec.ts`, import `* as exercisePage from './exercises/[id]/+page.server'`, and:

- "will not archive an exercise from the other dance" →
  `refuses(exercisePage.actions.archive, post('salsa', {}, String(bachataCustomId)))`.
- "will not edit an exercise from the other dance" →
  `refuses(exercisePage.actions.update, post('salsa', { name: 'Renamed by the wrong dance', everyDays: '7', notes: '', active: 'on' }, String(bachataCustomId)))`.
- "still refuses to archive a figure exercise, with the message that explains why" →
  call `exercisePage.actions.archive` with `post('bachata', {}, String(bachataExerciseId))`
  and assert `res.data.message` contains `'Archive a figure from its page'`.
- New: `it('will not open a bachata exercise under salsa', () => expect(() => loadAt(exercisePage.load, 'salsa', String(bachataCustomId))).toThrow(threw404))`
  — use the file's `loadAt`/`threw404` helpers; if `load` is async in the end,
  use `await expect(async () => …).rejects` like the other async cases.

- [ ] **Step 8: Look at it**

`nix develop -c npm run dev`. Open `/salsa/exercises/<id>` for a figure, a
lesson review, a routine and a custom exercise (ids from
`nix develop -c sqlite3 .data/salsa.db "select id, source, name from exercises where archived_at is null"`):
the owner link, the content, the history grouped by day, settings save, a
drill's links editor, Archive only on the drill. Today's log sheet ends with
"Details and settings →" and still logs.

- [ ] **Step 9: Check and commit**

```bash
nix develop -c npx prettier --write src/lib src/routes
nix develop -c npm run check
git add -A src/lib src/routes
git commit -m "exercises: a page per exercise with its content, history and settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: The per-type log popups on Today

**Files:**

- Create: `src/lib/components/exercises/LogShell.svelte`,
  `src/lib/components/exercises/RatingChips.svelte`,
  `src/lib/components/exercises/LastTime.svelte`,
  `src/lib/components/exercises/fetch-practice.ts`,
  `src/lib/components/exercises/kinds/lesson/Log.svelte`,
  `src/lib/components/exercises/kinds/figure/Log.svelte`,
  `src/lib/components/exercises/kinds/drill/Log.svelte`,
  `src/lib/components/exercises/kinds/routine/Log.svelte`
- Modify: `src/lib/components/exercises/kinds/index.ts`,
  `src/routes/[dance]/+page.server.ts`, `src/routes/[dance]/+page.svelte`,
  `src/lib/components/today/ExerciseRow.svelte`
- Delete: `src/lib/components/today/LogSheet.svelte`

**Interfaces:**

- Consumes: everything above; `lastSets` (Task 5); `PracticePanel`, `Sheet`
  guard (Task 10); `contentFor` (Task 11); `typeInfo`, `minutesFrom` (Task 2).
- Produces:
  - `fetchPractice(dance: DanceSlug, id: number): Promise<PracticePayload>`
  - `interface SessionControls { next: { name: string } | null; summary: string; onnext: () => void; onskip: () => void; onfinish: () => void }`
  - `interface LogProps { dance: Dance; exercise: ExerciseItem; sets: HistorySet[]; songs: { id: number; title: string }[]; takes: CountTakeRow[]; backfillDay: string | null; timezone: string; message: string | null; initial?: PracticePayload | null; session?: SessionControls | null; onlogged?: (durationS: number | null) => void; onclose: () => void }`
  - `logFor(type: ExerciseType): Component<LogProps>` (added to `kinds/index.ts`)
  - `<LogShell {...LogProps} run playing body />` where
    `run: { durationS: number; playerJson: string } | null`,
    `playing: boolean` (the panel is running), `body: Snippet<[PracticePayload]>`.
    The shell guards the Sheet while `playing` or while a run is not yet logged.
  - Today's load gains `takes` and `lastRatings: Record<number, number | null>`
  - `<ExerciseRow row variant dance lastRating onlog />`

- [ ] **Step 1: `fetch-practice.ts`, `RatingChips`, `LastTime`**

```ts
// src/lib/components/exercises/fetch-practice.ts
import type { DanceSlug } from '$lib/dances/dances';
import type { PracticePayload } from '$lib/types';

/** The popup's content. Client-side only — see `practice-content.ts` for why it is not in Today's load. */
export async function fetchPractice(dance: DanceSlug, id: number): Promise<PracticePayload> {
	const res = await fetch(`/${dance}/exercises/${id}/practice`);
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) as PracticePayload;
}
```

```svelte
<!-- src/lib/components/exercises/RatingChips.svelte -->
<script lang="ts">
	import { LABEL } from '$lib/components/ui/styles';

	interface Props {
		question: string;
		value: number | null;
		onchange: (rating: number | null) => void;
	}

	let { question, value, onchange }: Props = $props();
</script>

<fieldset>
	<legend class={LABEL}>{question}</legend>
	<input type="hidden" name="rating" value={value ?? ''} />
	<div class="flex gap-2">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<!-- Tapping the chosen one again clears it: a rating is optional. -->
			<button
				type="button"
				aria-pressed={value === n}
				onclick={() => onchange(value === n ? null : n)}
				class="h-11 flex-1 rounded-lg border text-[15px] {value !== null && n <= value
					? 'border-accent bg-accent text-accent-ink'
					: 'border-rule bg-raised text-ink-2'}">{n}</button
			>
		{/each}
	</div>
</fieldset>
```

```svelte
<!-- src/lib/components/exercises/LastTime.svelte -->
<script lang="ts">
	import { lastDoneLabel } from '$lib/format';
	import type { LastSet } from '$lib/types';

	interface Props {
		last: LastSet | null;
	}

	let { last }: Props = $props();
</script>

<p class="text-[13px] text-muted">
	{#if last}
		Last time: {lastDoneLabel(last.daysAgo)}{#if last.rating !== null}
			· {'★'.repeat(last.rating)}{/if}{#if last.note}
			· “{last.note}”{/if}
	{:else}
		First time.
	{/if}
</p>
```

- [ ] **Step 2: `LogShell.svelte`**

```svelte
<!-- src/lib/components/exercises/LogShell.svelte -->
<script lang="ts" module>
	import type { Dance } from '$lib/dances/dances';
	import type { CountTakeRow, ExerciseItem, HistorySet, PracticePayload } from '$lib/types';

	/** A session walking Today's list, as the popup sees it. See `$lib/exercises/session`. */
	export interface SessionControls {
		next: { name: string } | null;
		summary: string;
		onnext: () => void;
		onskip: () => void;
		onfinish: () => void;
	}

	/** What every type's popup takes. */
	export interface LogProps {
		dance: Dance;
		exercise: ExerciseItem;
		/** This exercise's sets on the day being viewed. */
		sets: HistorySet[];
		songs: { id: number; title: string }[];
		takes: CountTakeRow[];
		/** A past day to back-fill onto, or null for "now". */
		backfillDay: string | null;
		timezone: string;
		/** A failure message from the last log action. */
		message: string | null;
		/** Already-loaded content (the exercise page has it); otherwise it is fetched. */
		initial?: PracticePayload | null;
		session?: SessionControls | null;
		/** A set was saved. `durationS` is what it logged, for the session's tally. */
		onlogged?: (durationS: number | null) => void;
		onclose: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SetList from './SetList.svelte';
	import LastTime from './LastTime.svelte';
	import RatingChips from './RatingChips.svelte';
	import { fetchPractice } from './fetch-practice';
	import { FIELD, LABEL } from '$lib/components/ui/styles';
	import { typeInfo } from '$lib/exercises/kinds';
	import { minutesFrom } from '$lib/exercises/practice';

	interface Props extends LogProps {
		/** The practice panel's latest run, or null. Fills Minutes and the set's `player_json`. */
		run: { durationS: number; playerJson: string } | null;
		/** The panel is playing: nothing may close the popup by accident. */
		playing: boolean;
		/** The type's own content (and panel), given the loaded payload. */
		body: Snippet<[PracticePayload]>;
	}

	let {
		dance,
		exercise,
		sets,
		backfillDay,
		timezone,
		message,
		initial = null,
		session = null,
		onlogged,
		onclose,
		run,
		playing,
		body
	}: Props = $props();

	const info = $derived(typeInfo(exercise.source));
	const has = (f: 'minutes' | 'reps' | 'rating' | 'note') => info.fields.includes(f);

	let payload = $state<PracticePayload | null>(initial);
	let loadError = $state<string | null>(null);
	let busy = $state(false);
	let justLogged = $state(false);
	let confirming = $state(false);
	let rating = $state<number | null>(null);
	let minutes = $state('');
	/** Exact seconds from the panel. Typing into Minutes clears it, so a hand-entered value wins. */
	let exactS = $state<number | null>(null);
	/** The panel's run belongs to the NEXT set until one is saved, then it is spent. */
	let spent = $state<string | null>(null);

	function load() {
		fetchPractice(dance.slug, exercise.id)
			.then((p) => (payload = p))
			.catch(() => (loadError = 'Could not load this exercise’s details.'));
	}
	$effect(() => {
		if (!initial) load();
	});

	const liveRun = $derived(run && run.playerJson !== spent ? run : null);
	$effect(() => {
		if (!liveRun) return;
		minutes = String(minutesFrom(liveRun.durationS));
		exactS = liveRun.durationS;
	});

	/** Practice time that a close would throw away. */
	const unsaved = $derived(playing || liveRun !== null);
</script>

<Sheet
	title={exercise.name}
	open={true}
	{onclose}
	guard={unsaved}
	onguarded={() => (confirming = true)}
>
	{#if confirming}
		<div class="mb-3 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px]" role="alert">
			<span class="min-w-0 flex-1">
				Discard {liveRun ? `${minutesFrom(liveRun.durationS)} min of ` : ''}practice?
			</span>
			<button type="button" class="h-9 px-2 font-medium" onclick={() => (confirming = false)}>Keep</button>
			<button type="button" class="h-9 px-2 font-medium text-danger" onclick={onclose}>Discard</button>
		</div>
	{/if}

	{#if session && !justLogged}
		<div class="mb-2 flex justify-end">
			<button type="button" class="text-[13px] text-accent" onclick={session.onskip}>Skip →</button>
		</div>
	{/if}

	{#if payload}
		<LastTime last={payload.last} />
		<div class="mt-3">{@render body(payload)}</div>
	{:else if loadError}
		<p class="text-[13px] text-danger">{loadError}</p>
	{:else}
		<p class="text-[13px] text-muted">Loading…</p>
	{/if}

	<form
		method="POST"
		action="?/log"
		class="mt-4"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update();
				busy = false;
				if (result.type !== 'success') return;
				const logged = exactS ?? (minutes === '' ? null : Number(minutes) * 60);
				rating = null;
				minutes = '';
				exactS = null;
				spent = run?.playerJson ?? null;
				justLogged = true;
				// In a session "Logged ✓" stays until Next, Skip or Finish — the Next
				// button hangs off it. Outside one it fades back to "Log set".
				if (!session) setTimeout(() => (justLogged = false), 2500);
				onlogged?.(logged);
				load();
			};
		}}
	>
		<input type="hidden" name="exerciseId" value={exercise.id} />
		{#if backfillDay}<input type="hidden" name="day" value={backfillDay} />{/if}
		<input type="hidden" name="durationS" value={exactS ?? ''} />
		{#if liveRun && !backfillDay}<input type="hidden" name="run" value={liveRun.playerJson} />{/if}

		<div class="grid grid-cols-2 gap-3">
			{#if has('minutes')}
				<label>
					<span class={LABEL}>Minutes</span>
					<input
						name="durationMin"
						type="number"
						inputmode="numeric"
						min="0"
						max="600"
						bind:value={minutes}
						oninput={() => (exactS = null)}
						class={FIELD}
					/>
				</label>
			{/if}
			{#if has('reps')}
				<label>
					<span class={LABEL}>Reps</span>
					<input name="reps" type="number" inputmode="numeric" min="0" max="10000" class={FIELD} />
				</label>
			{/if}
		</div>

		{#if has('rating')}
			<div class="mt-3">
				<RatingChips question={info.ratingQuestion} value={rating} onchange={(r) => (rating = r)} />
			</div>
		{/if}

		{#if has('note')}
			<label class="mt-3 block">
				<span class={LABEL}>Note</span>
				<textarea name="note" rows="2" maxlength="2000" class={FIELD}></textarea>
			</label>
		{/if}

		{#if message}
			<p class="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{message}</p>
		{/if}

		<button
			type="submit"
			disabled={busy}
			class="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60 {justLogged
				? 'bg-done-bg text-done'
				: 'bg-accent text-accent-ink'}"
		>
			{justLogged ? 'Logged ✓' : backfillDay ? 'Add set to this day' : 'Log set'}
		</button>
	</form>

	{#if session && justLogged}
		{#if session.next}
			<button
				type="button"
				class="mt-3 h-12 w-full rounded-xl border border-accent text-[15px] font-semibold text-accent"
				onclick={session.onnext}>Next: {session.next.name} →</button
			>
		{:else}
			<p class="mt-3 text-center text-[14px] font-medium">{session.summary}</p>
			<button type="button" class="mt-2 h-11 w-full rounded-xl border border-rule text-[14px]" onclick={session.onfinish}
				>Finish</button
			>
		{/if}
	{/if}

	{#if sets.length > 0}
		<h3 class="mt-6 mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
			{backfillDay ? 'Sets that day' : 'Sets today'}
		</h3>
		<SetList {sets} {timezone} />
	{/if}

	<a
		href={resolve('/[dance]/exercises/[id]', { dance: dance.slug, id: String(exercise.id) })}
		class="mt-6 block text-[14px] font-medium text-accent">Details and settings →</a
	>
</Sheet>
```

- [ ] **Step 3: The four Log components**

```svelte
<!-- src/lib/components/exercises/kinds/lesson/Log.svelte -->
<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!-- A review is watching and remembering, not dancing along: no practice panel. -->
<LogShell {...props} run={null} playing={false}>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
	{/snippet}
</LogShell>
```

```svelte
<!-- src/lib/components/exercises/kinds/routine/Log.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!--
	A routine is practised in the full player — calls and slots live there, and
	that run saves through the player's own save sheet. This form is for a
	routine practised away from the app.
-->
<LogShell {...props} run={null} playing={false}>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
		{#if payload.content.type === 'routine' && !props.backfillDay}
			<a
				href={resolve(
					`/${props.dance.slug}/player?routine=${payload.content.routine.id}&exercise=${props.exercise.id}`
				)}
				class="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-accent text-[15px] font-semibold text-accent"
				>Practise in player →</a
			>
		{/if}
	{/snippet}
</LogShell>
```

```svelte
<!-- src/lib/components/exercises/kinds/drill/Log.svelte -->
<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	let playing = $state(false);
	/**
	 * Sets logged in this popup. The panel is keyed on it, so after a set is
	 * saved the panel starts fresh — banked time belongs to exactly one set.
	 */
	let logged = $state(0);
</script>

<LogShell
	{...props}
	{run}
	{playing}
	onlogged={(d) => {
		logged += 1;
		run = null;
		props.onlogged?.(d);
	}}
>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
		{#if !props.backfillDay}
			<div class="mt-3">
				{#key logged}
					<PracticePanel
						dance={props.dance}
						exercise={props.exercise}
						songs={props.songs}
						takes={props.takes}
						cue={null}
						onrun={(r) => (run = r)}
						onactive={(a) => (playing = a)}
					/>
				{/key}
			</div>
		{/if}
	{/snippet}
</LogShell>
```

```svelte
<!-- src/lib/components/exercises/kinds/figure/Log.svelte -->
<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	let playing = $state(false);
	/** See drill/Log.svelte: the panel starts fresh after each saved set. */
	let logged = $state(0);
	/** The reference folds away so the panel is one tap from the top on a phone. */
	let showReference = $state(true);
</script>

<LogShell
	{...props}
	{run}
	{playing}
	onlogged={(d) => {
		logged += 1;
		run = null;
		props.onlogged?.(d);
	}}
>
	{#snippet body(payload)}
		<button
			type="button"
			class="mb-2 text-[13px] text-accent"
			aria-expanded={showReference}
			onclick={() => (showReference = !showReference)}
			>{showReference ? 'Hide reference' : 'Show reference'}</button
		>
		{#if showReference}
			<Content dance={props.dance} content={payload.content} />
		{/if}
		{#if !props.backfillDay}
			<div class="mt-3">
				{#key logged}
					<PracticePanel
						dance={props.dance}
						exercise={props.exercise}
						songs={props.songs}
						takes={props.takes}
						cue={payload.content.type === 'figure'
							? {
									figureId: payload.content.figure.id,
									say: payload.content.figure.say,
									eights: payload.content.figure.eights
								}
							: null}
						onrun={(r) => (run = r)}
						onactive={(a) => (playing = a)}
					/>
				{/key}
			</div>
		{/if}
	{/snippet}
</LogShell>
```

`onlogged` comes after the `{...props}` spread so it wins over the page's; it
calls the page's own `onlogged` (the session tally) itself. The lesson and
routine popups have no panel, so they pass the page's `onlogged` straight
through with the spread.

In `kinds/index.ts`, add:

```ts
import type { LogProps } from '../LogShell.svelte';
import LessonLog from './lesson/Log.svelte';
import FigureLog from './figure/Log.svelte';
import DrillLog from './drill/Log.svelte';
import RoutineLog from './routine/Log.svelte';

const LOG: Record<ExerciseType, Component<LogProps>> = {
	lesson: LessonLog,
	figure: FigureLog,
	drill: DrillLog,
	routine: RoutineLog
};

export const logFor = (type: ExerciseType) => LOG[type];
export type { LogProps };
```

- [ ] **Step 4: Today's load**

In `src/routes/[dance]/+page.server.ts` `load`, add (imports: `lastSets`,
`listCountTakesFor`, `PHRASE_PATTERNS`):

```ts
		// The latest set's rating per exercise, for the dots on each row.
		lastRatings: Object.fromEntries(
			[...lastSets(db, dance)].map(([id, s]) => [id, s.rating] as [number, number | null])
		),
		// The practice panel's voice: the user's recorded count, a few dozen rows.
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, p)),
```

and update the `songs` comment to "For the practice panel's song picker."

- [ ] **Step 5: The row**

Rewrite `src/lib/components/today/ExerciseRow.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PlanRow } from '$lib/urgency/urgency';
	import type { ExerciseItem } from '$lib/types';
	import type { DanceSlug } from '$lib/dances/dances';
	import { lastDoneLabel } from '$lib/format';
	import { frequencyLabel } from '$lib/frequency';

	interface Props {
		row: PlanRow<ExerciseItem>;
		variant: 'done' | 'due' | 'upcoming' | 'inactive';
		dance: DanceSlug;
		/** The latest set's rating, or null when it was unrated or there is none. */
		lastRating: number | null;
		/** Open this exercise's log popup. */
		onlog: () => void;
	}

	let { row, variant, dance, lastRating, onlog }: Props = $props();

	const ex = $derived(row.exercise);
	const BADGE: Record<Exclude<ExerciseItem['source'], 'figure'>, string> = {
		routine: 'Routine',
		lesson: 'Lesson',
		custom: 'Drill'
	};
	const badge = $derived(
		ex.source === 'figure'
			? ex.partner === 'solo'
				? 'Figure · solo'
				: 'Figure · partner'
			: BADGE[ex.source]
	);
</script>

<li
	class="flex items-stretch overflow-hidden rounded-xl border {variant === 'done'
		? 'border-done/30 bg-done-bg'
		: 'border-line bg-raised'} {variant === 'inactive'
		? 'opacity-60'
		: variant === 'upcoming'
			? 'opacity-75'
			: ''}"
>
	<!-- The row opens the exercise; the + logs. Logging is the thing done most, so it gets its own target. -->
	<a
		href={resolve('/[dance]/exercises/[id]', { dance, id: String(ex.id) })}
		class="min-w-0 flex-1 px-4 py-3 text-left"
	>
		<span class="block truncate text-[15px] font-medium">{ex.name}</span>
		<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
			<span>{badge}</span>
			<span aria-hidden="true">·</span>
			{#if variant === 'done'}
				<span class="font-medium text-done"
					>{row.setsToday} {row.setsToday === 1 ? 'set' : 'sets'} today</span
				>
			{:else}
				<!-- In the due band `overdue` is true by construction. -->
				<span class={variant === 'due' ? 'font-medium text-overdue' : ''}
					>{lastDoneLabel(row.lastDoneDaysAgo)}</span
				>
				<span aria-hidden="true">·</span>
				<span>{frequencyLabel(ex.everyDays)}</span>
			{/if}
			{#if lastRating !== null}
				<span class="flex items-center gap-0.5" role="img" aria-label="Last rated {lastRating} of 5">
					{#each [1, 2, 3, 4, 5] as n (n)}
						<span class="size-1.5 rounded-full {n <= lastRating ? 'bg-accent' : 'bg-rule'}"></span>
					{/each}
				</span>
			{/if}
		</span>
	</a>

	<button
		type="button"
		onclick={onlog}
		aria-label="Log a set of {ex.name}"
		class="grid w-14 place-items-center border-l text-[22px] font-light {variant === 'done'
			? 'border-done/30 text-done'
			: 'border-line text-accent'}">+</button
	>
</li>
```

(The badge now reads "Drill" for a custom exercise, matching the type's name.)

- [ ] **Step 6: Today's page**

In `src/routes/[dance]/+page.svelte`:

- Replace the `LogSheet` import with
  `import { logFor } from '$lib/components/exercises/kinds';` and
  `import { typeOf } from '$lib/exercises/kinds';`.
- Every `<ExerciseRow {row} variant="…" onopen={…} />` becomes
  `<ExerciseRow {row} variant="…" dance={data.dance.slug} lastRating={data.lastRatings[row.exercise.id] ?? null} onlog={() => (openId = row.exercise.id)} />`.
- Keep `open` as `rows.find(…)`: every unarchived exercise has a row in some
  band, and the back-fill picker only offers unarchived ones.
- Add `const Log = $derived(open ? logFor(typeOf(open.source)) : null);`
- `openSets` must be `HistorySet[]`: `data.daySets` items already carry
  `id, doneAt, durationS, reps, rating, note` — `DaySet` is a structural
  superset, so the filter can stay as is.
- Replace the `{#if open}<LogSheet …/>{/if}` block with:

```svelte
{#if open && Log}
	{#key open.id}
		<Log
			dance={data.dance}
			exercise={open}
			sets={openSets}
			songs={data.songs}
			takes={data.takes}
			backfillDay={data.isToday ? null : data.day}
			{timezone}
			message={failure('log')}
			onclose={() => (openId = null)}
		/>
	{/key}
{/if}
```

The `{#key}` matters: moving from one exercise to the next (the session does
this) must remount the popup, or the old exercise's panel and fields carry over.

- Delete `src/lib/components/today/LogSheet.svelte`.

- [ ] **Step 7: Run the suite and the checks**

Run: `nix develop -c npm run check`
Expected: PASS. Fix any type errors at their source; do not loosen types.

- [ ] **Step 8: Put a playable song in the dev database**

Follow CLAUDE.md's recipe. For example:

```bash
nix develop -c ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.05" -af apad=pad_dur=0.283 -t 0.333 /tmp/claude-1000/click.wav
nix develop -c ffmpeg -stream_loop 359 -i /tmp/claude-1000/click.wav -c:a aac .data/audio/click-180.m4a
nix develop -c sqlite3 .data/salsa.db "insert into songs (title, dance, style, status, audio_file, mime, duration_s, bpm, beats_json, anchors_json, tempo_factor, attempts, created_at) values ('Click 180', 'salsa', 'salsa', 'ready', 'click-180.m4a', 'audio/mp4', 120, 180, (with recursive b(i) as (select 0 union all select i+1 from b where i < 359) select json_group_array(round(i*0.3333, 4)) from b), '[0]', 1, 0, 0);"
```

(Check the `songs` columns first with `.schema songs` and adjust names.)

- [ ] **Step 9: Walk every popup**

`nix develop -c npm run dev`, then at 375 px wide:

1. Tap a row body → the exercise page opens. Back.
2. **+** on a lesson review → its notes, links (embed plays on tap), videos,
   figure chips; rating asks "How well do you remember it?"; no panel; log a
   set with a rating → "Logged ✓", "Last time" updates, the row moves to Done
   today with dots.
3. **+** on a figure → reference, panel reading "Count 180 · 1 2 3 · 5 6 7".
   ▶ → the count sounds, the big 1–8 runs; tap the backdrop → the popup stays
   and "Discard … practice?" appears; Keep; Pause 10 s, Resume, Stop after
   ~70 s → Minutes shows 1; set call on cue to Every 2 → the figure's name is
   spoken over 5-6-7 every two eights; log → the set stores `duration_s` near
   70 and a `player_json` (check in sqlite).
4. Reopen that figure's popup → the panel remembers the pattern and cue.
5. **+** on a drill → Reps shown; switch Source to "A song", pick "Click 180",
   ▶ → the song and count play together; 0.8× slows both.
6. **+** on a routine → its slots and "Practise in player →" (opens the
   player on that routine).
7. Close a popup mid-run with Discard → the sound stops at once.
8. A past day → "Forgot to log something that day?" → the popup has no panel
   and "Add set to this day" back-fills.
9. `/bachata` → no clave anywhere in the panel.
10. The drill from item 5 now remembers "Click 180". Archive the song
    (`nix develop -c sqlite3 .data/salsa.db "update songs set archived_at = 1 where title = 'Click 180'"`)
    and reopen the drill's popup → the panel opens expanded, on count, reading
    "Its song is not ready — pick another, or use the count", and ▶ plays the
    count. Un-archive it afterwards (`archived_at = null`).

- [ ] **Step 10: Commit**

```bash
nix develop -c npx prettier --write src/lib src/routes
nix develop -c npm run check
git add -A src/lib src/routes
git commit -m "today: a log popup per exercise type; the row opens the exercise, + logs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: The popups on the exercise, figure, lesson and routine pages

**Files:**

- Modify: `src/routes/[dance]/exercises/[id]/+page.svelte`,
  `src/routes/[dance]/figures/[id]/+page.server.ts` + `+page.svelte`,
  `src/routes/[dance]/lessons/[id]/+page.server.ts` + `+page.svelte`,
  `src/routes/[dance]/routines/[id]/+page.svelte`

**Interfaces:**

- Consumes: `popupData` (Task 11), `logFor` (Task 12).
- Produces: `?log=1` on the exercise page opens its popup on arrival.

- [ ] **Step 1: The exercise page**

In `src/routes/[dance]/exercises/[id]/+page.svelte`, import `page` from
`$app/state` and `logFor` from `$lib/components/exercises/kinds`, then:

```ts
	const Log = $derived(logFor(type));
	// `?log=1` (a lesson's linked-exercise +) opens the popup straight away.
	let logging = $state(page.url.searchParams.get('log') === '1');
```

Under the owner link, add:

```svelte
	<button
		type="button"
		class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
		onclick={() => (logging = true)}>Log a set</button
	>
```

and at the end of the file:

```svelte
{#if logging}
	<Log
		dance={data.dance}
		exercise={data.exercise}
		sets={data.sets}
		songs={data.songs}
		takes={data.takes}
		backfillDay={null}
		{timezone}
		message={failure('log')}
		initial={data.practice}
		onclose={() => (logging = false)}
	/>
{/if}
```

- [ ] **Step 2: The figure page**

`+page.server.ts` `load`: add
`popup: found.exercise ? popupData(db, dance, found.exercise.id, zoneOf(locals), Date.now()) : null`
— `load` needs `locals`: change its signature to `({ params, locals })` and add
a local `zoneOf(locals)` that throws 401 without a user, the way
`src/routes/[dance]/+page.server.ts`'s `zone` does. Also add
`deleteSet: (event) => deleteSetFrom(event),` to the actions (the popup's set
list posts it).

`+page.svelte`: replace the whole "Practice" `<section>` (the bare-log form
and its `logged` state) with:

```svelte
		{#if data.exercise && data.popup}
			<section class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<a
						href={resolve('/[dance]/exercises/[id]', { dance: data.dance.slug, id: String(data.exercise.id) })}
						class="text-[12px] text-accent">{frequencyLabel(data.exercise.everyDays)}{data.exercise.active ? '' : ' · inactive'} · Exercise →</a
					>
				</div>
				<button
					type="button"
					class="h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
					onclick={() => (logging = true)}>Log…</button
				>
			</section>
		{/if}
```

with `let logging = $state(false);`, `const FigureLog = logFor('figure');` and,
at the end of the file:

```svelte
{#if logging && data.popup}
	<FigureLog
		dance={data.dance}
		exercise={data.popup.exercise}
		sets={data.popup.sets}
		songs={data.popup.songs}
		takes={data.popup.takes}
		backfillDay={null}
		{timezone}
		message={form && 'action' in form && form.action === 'log' && 'message' in form ? String(form.message) : null}
		onclose={() => (logging = false)}
	/>
{/if}
```

(`logFor('figure')` is the figure page knowing it shows a figure — not a branch
on an exercise's type.)

- [ ] **Step 3: The lesson page**

Same shape as the figure page: `load` gains `popup` for `found.exercise`
(`zone(locals)` already exists here), actions gain `deleteSet`, the "Go over
this lesson" card's bare-log form becomes a **Log…** button plus an
**Exercise →** link, and `logFor('lesson')` renders at the end.

The hand-linked exercises list: each row's `<span>` name becomes

```svelte
							<a
								href={resolve('/[dance]/exercises/[id]', { dance: data.dance.slug, id: String(exercise.id) })}
								class="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</a
							>
							<a
								href={resolve(`/${data.dance.slug}/exercises/${exercise.id}?log=1`)}
								class="grid size-9 place-items-center text-[20px] text-accent"
								aria-label="Log a set of {exercise.name}">+</a
							>
```

keeping the Unlink form after them.

- [ ] **Step 4: The routine page**

In `src/routes/[dance]/routines/[id]/+page.svelte`, next to the Practise
link, add (only when `data.exerciseId !== null`):

```svelte
<a
	href={resolve('/[dance]/exercises/[id]', { dance: data.dance.slug, id: String(data.exerciseId) })}
	class="text-[14px] font-medium text-accent">Exercise →</a
>
```

Place it where the page's header actions or the Practise button sit — read the
markup around line 230 and match its spacing.

- [ ] **Step 5: Look at it**

`nix develop -c npm run dev`: on a figure page **Log…** opens the figure popup
(panel included) and logs; **Exercise →** opens the exercise page; the exercise
page's **Log a set** opens its popup with the content already there (no
"Loading…"); on a lesson, a linked exercise's **+** lands on its page with the
popup open; the routine page links to its exercise.

- [ ] **Step 6: Check and commit**

```bash
nix develop -c npx prettier --write src/routes
nix develop -c npm run check
git add -A src/routes
git commit -m "figures, lessons, routines: log through the type's popup; link to the exercise

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Session — walking Today's list

**Files:**

- Create: `src/lib/exercises/session.ts`, `src/lib/exercises/session.spec.ts`
- Modify: `src/routes/[dance]/+page.svelte`

**Interfaces:**

- Consumes: `SessionControls` (Task 12); the plan's `due`/`upcoming` bands.
- Produces:
  - `nextInSession<R extends { exercise: { id: number } }>(due: R[], upcoming: R[], skipped: ReadonlySet<number>, current: number | null): R | null`
  - `sessionSummary(count: number, seconds: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/exercises/session.spec.ts
import { describe, expect, it } from 'vitest';
import { nextInSession, sessionSummary } from './session';

const row = (id: number) => ({ exercise: { id } });

describe('nextInSession', () => {
	it('takes due first, then not-yet-due', () => {
		expect(nextInSession([row(1), row(2)], [row(3)], new Set(), null)).toEqual(row(1));
		expect(nextInSession([], [row(3)], new Set(), null)).toEqual(row(3));
	});
	it('skips the one open and the ones skipped', () => {
		expect(nextInSession([row(1), row(2)], [row(3)], new Set([2]), 1)).toEqual(row(3));
	});
	it('is null when nothing is left', () => {
		expect(nextInSession([row(1)], [], new Set(), 1)).toBeNull();
	});
});

describe('sessionSummary', () => {
	it('counts exercises and minutes', () => {
		expect(sessionSummary(3, 1500)).toBe('Session done — 3 exercises, 25 min');
		expect(sessionSummary(1, 0)).toBe('Session done — 1 exercise');
		expect(sessionSummary(0, 0)).toBe('Session done');
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop -c npx vitest run src/lib/exercises/session.spec.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/exercises/session.ts
/**
 * A session walks Today's to-do list popup by popup. PURE: no state lives on
 * the server — the session is a URL flag plus the page's own bands, so "next"
 * is recomputed from them after every refresh. The logged exercise has moved
 * to Done today by then, which is why the first remaining row is the answer.
 */
export function nextInSession<R extends { exercise: { id: number } }>(
	due: R[],
	upcoming: R[],
	skipped: ReadonlySet<number>,
	current: number | null
): R | null {
	return (
		[...due, ...upcoming].find((r) => r.exercise.id !== current && !skipped.has(r.exercise.id)) ??
		null
	);
}

export function sessionSummary(count: number, seconds: number): string {
	if (count === 0) return 'Session done';
	const minutes = Math.round(seconds / 60);
	return `Session done — ${count} ${count === 1 ? 'exercise' : 'exercises'}${minutes > 0 ? `, ${minutes} min` : ''}`;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop -c npx vitest run src/lib/exercises/session.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into Today**

In `src/routes/[dance]/+page.svelte` (imports: `onMount`, `goto` from
`$app/navigation`, `page` from `$app/state`, `nextInSession`, `sessionSummary`,
`type SessionControls` from the LogShell module):

```ts
	const sessionOn = $derived(page.url.searchParams.get('session') === '1');
	let skipped = $state(new Set<number>());
	let tally = $state({ count: 0, seconds: 0 });
	const firstUp = $derived(nextInSession(data.plan.due, data.plan.upcoming, skipped, null));
	const nextUp = $derived(nextInSession(data.plan.due, data.plan.upcoming, skipped, openId));

	function startSession() {
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		void goto(`?session=1`, { keepFocus: true, noScroll: true });
		openId = firstUp?.exercise.id ?? null;
	}

	function endSession() {
		openId = null;
		void goto(resolve('/[dance]', { dance: data.dance.slug }), { keepFocus: true, noScroll: true });
	}

	// A reload keeps the flag; pick up at the current first row.
	onMount(() => {
		if (sessionOn && openId === null) openId = firstUp?.exercise.id ?? null;
	});

	const session = $derived<SessionControls | null>(
		sessionOn && data.isToday
			? {
					next: nextUp ? { name: nextUp.exercise.name } : null,
					summary: sessionSummary(tally.count, tally.seconds),
					onnext: () => (openId = nextUp?.exercise.id ?? null),
					onskip: () => {
						if (openId !== null) skipped = new Set([...skipped, openId]);
						openId = nextUp?.exercise.id ?? null;
						if (openId === null) endSession();
					},
					onfinish: endSession
				}
			: null
	);
```

Pass `{session}` and
`onlogged={(d) => { if (sessionOn) tally = { count: tally.count + 1, seconds: tally.seconds + (d ?? 0) }; }}`
to `<Log …/>`. Above the Due section (inside `{#if data.isToday}`, after the
empty state), add:

```svelte
		{#if firstUp}
			<button
				type="button"
				class="mb-4 h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				onclick={() => (sessionOn ? (openId = firstUp?.exercise.id ?? null) : startSession())}
				>{sessionOn ? 'Resume session' : 'Start session'}</button
			>
		{/if}
```

- [ ] **Step 6: Walk a session**

With at least three due exercises: Start session → the most urgent popup
opens; log it → "Next: <name> →"; Next → the next popup; Skip → the one after;
log the last → "Session done — N exercises, X min"; Finish → the popup closes
and the URL loses `?session=1`. Reload mid-session → it resumes.

- [ ] **Step 7: Prove, check and commit**

Swap `[...due, ...upcoming]` to `[...upcoming, ...due]` — the first test must
fail. Restore.

```bash
nix develop -c npx prettier --write src/lib/exercises src/routes/\[dance\]/+page.svelte
nix develop -c npm run check
git add src/lib/exercises src/routes/\[dance\]/+page.svelte
git commit -m "today: a session walks the to-do list, Next after each log

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Docs, and the whole-branch check

**Files:**

- Modify: `docs/superpowers/specs/2026-09-28-exercise-types-design.md`,
  `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `CLAUDE.md`

- [ ] **Step 1: The spec's status and known gaps**

In the exercise-types spec: set the status line to
`**Status:** approved 2026-09-28; built <date>.` and replace
"To be filled in as the work finds them." under **Known gaps** with what the
work found. At least:

- **Chrome lets a second Escape close a guarded popup** (its anti-trap rule for
  `<dialog>`); the run is stopped and its unsaved time is lost. The backdrop
  and ✕ are fully guarded.
- **The popup's content is one request after opening**; on a slow connection
  the form shows before the reference does.
- **Mirroring a YouTube embed mirrors its own controls too.**
- **The full player still logs song seconds**, not wall clock (unchanged).
- Anything else a task report flagged and left.

- [ ] **Step 2: The main design doc**

In `2026-09-22-salsa-app-design.md`:

- Data model: add `exercises.practice_json`, the `links` and `app_flags`
  tables (short, pointing at the exercise-types spec).
- "Today / Exercises page" → **Logging**: replace "tap an exercise → sheet…"
  with: the row opens the exercise page, **+** opens the type's popup; point at
  the exercise-types spec.
- Rules: "Nothing is hard-deleted except a set, a recording, a lesson video"
  gains "and a link".
- Known gaps (phase 2b): mark "A stray tap on the save sheet's backdrop" as
  still true for the player's save sheet, fixed for the log popups.

- [ ] **Step 3: CLAUDE.md**

- Opening "Live:" paragraph: add "exercise types (a log popup per type, links
  with YouTube embeds, a practice panel in the popup, an exercise page)".
- Point at the new spec next to the lessons spec, one sentence.
- Layout: add `src/lib/links.ts` (PURE: URL parsing, linkified notes) and
  `src/lib/exercises/` (PURE: the type registry, practice config, stopwatch,
  session). Under `src/lib/components/` add `exercises/ links/`.
- Hard rules: "**Archive, don't delete.**" — sets, recordings **and links** are
  the only hard deletes. Add: "**The type owns its popup.** An exercise's type
  is derived from `source` (`src/lib/exercises/kinds.ts`); pages ask
  `logFor`/`contentFor` for its components and never branch on it."

- [ ] **Step 4: The whole-branch check**

```bash
nix develop -c npm run check
nix develop -c npm run build && PORT=3999 DATABASE_PATH=.data/salsa.db DATA_DIR=.data ORIGIN=http://localhost:3999 nix develop -c node build &
```

Against `node build` (not `vite dev` — CLAUDE.md: the dev server skips
SvelteKit's cross-site POST check): sign in, log from a figure popup, add a
link on a lesson, save practice settings (press ▶ once), confirm each
persisted. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
nix develop -c npx prettier --write docs CLAUDE.md
git add docs CLAUDE.md
git commit -m "docs: exercise types are built

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
