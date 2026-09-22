# Phase 2a — Songs, home worker, beat grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a song library (YouTube URL or file upload), a home worker on `laptop` that downloads and beat-analyses songs, and a song page where the user hears the song, sees the live 1–8 count, and taps the "1" to anchor it.

**Architecture:** The SvelteKit server stores songs in SQLite and exposes a token-authenticated job queue under `/api/worker/*`. A Python worker (salsaapp flake package, systemd timer on `laptop`) claims jobs, runs yt-dlp → ffmpeg → Beat This!, and posts audio and beats back. All beat maths (gap filling, tempo factor, anchors → counts) is a pure TypeScript module shared by the song page now and the player in phase 2b.

**Tech Stack:** SvelteKit 2 / Svelte 5 / Drizzle + better-sqlite3 / Vitest; Python 3.13 + Beat This! 1.1.0 (torch 2.9.1 CPU) + yt-dlp (nixpkgs-unstable) + ffmpeg / pytest; NixOS modules in `~/.config/nixos-config`.

**Spec:** `docs/superpowers/specs/2026-09-22-salsa-app-design.md` — sections "Songs & player (phase 2)", "Decided after review", "Deployment". Read `CLAUDE.md` for the project's hard rules.

## Global Constraints

- Every instant in the DB is an integer of epoch ms; song positions/beat times are seconds (real).
- Pure modules (`src/lib/beatgrid/`) take everything as arguments: no DB, no DOM, no `Date.now()`.
- Data functions take `db: Db` first; tests use `openDb(':memory:')`.
- Components never import from `$lib/server`; shared shapes go in `src/lib/types.ts` / `src/lib/labels.ts`.
- Uploads are streamed raw-body (never `formData()`), capped at `MAX_RECORDING_BYTES` (95 MiB, `src/lib/limits.ts`), because Cloudflare's free plan rejects bodies over 100 MB.
- Internal links/`goto` go through `resolve()` from `$app/paths` (eslint `svelte/no-navigation-without-resolve`).
- Dates on screen come from `src/lib/format.ts`, never `toLocaleDateString`.
- Worker ↔ server auth: header `Authorization: Bearer <SALSA_WORKER_TOKEN>`; env var named `SALSA_WORKER_TOKEN` on both ends.
- Job lease 15 minutes; 5 attempts max; songs longer than 15 minutes are a permanent failure.
- Tap latency compensation: 80 ms (`TAP_LATENCY_S = 0.08`).
- `npm run check` must pass at the end of every TypeScript task; `nix build .#checks.x86_64-linux.worker` at the end of every worker task.
- Commit after every task, message ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never deploy or switch a host without the user's go-ahead in chat (Task 9).

## File map

```
src/lib/beatgrid/beatgrid.ts        (new)  pure: cleanBeats, scaleBeats, bpmOf, suggestOne, countsFor,
                                            beatIndexAt, nearestBeat, addAnchor, removeAnchor, buildGrid
src/lib/beatgrid/beatgrid.spec.ts   (new)
src/lib/labels.ts                   (mod)  SONG_STATUSES, TEMPO_FACTORS
src/lib/types.ts                    (mod)  SongItem
src/lib/server/files.ts             (mod)  parseRange, serveFile, saveStream, TooLargeError, audioDir
src/lib/server/files.spec.ts        (mod)  parseRange tests
src/lib/server/db/schema.ts         (mod)  songs table
drizzle/0001_*.sql                  (gen)
src/lib/server/songs.ts             (new)  song data layer + job queue
src/lib/server/songs.spec.ts        (new)
src/lib/server/analysis.ts          (new)  pure: parseAnalysis (validates worker JSON)
src/lib/server/analysis.spec.ts     (new)
src/lib/server/worker-auth.ts       (new)  workerTokenOk
src/lib/server/worker-auth.spec.ts  (new)
src/hooks.server.ts                 (mod)  /api/worker/ bypasses the session guard
src/routes/api/worker/claim/+server.ts                 (new)
src/routes/api/worker/songs/[id]/audio/+server.ts      (new)  GET + PUT
src/routes/api/worker/songs/[id]/analysis/+server.ts   (new)
src/routes/api/worker/songs/[id]/fail/+server.ts       (new)
src/routes/api/songs/+server.ts                        (new)  browser upload
src/routes/audio/[file]/+server.ts                     (new)  range-served song audio
src/routes/recordings/[file]/+server.ts                (mod)  uses serveFile
src/routes/api/figures/[id]/recordings/+server.ts      (mod)  uses saveStream
src/lib/components/ui/UploadButton.svelte              (new)  generalised from RecordingUpload
src/lib/components/figures/RecordingUpload.svelte      (del)  replaced by UploadButton
src/routes/figures/[id]/+page.svelte                   (mod)  uses UploadButton
src/lib/components/shell/BottomNav.svelte              (mod)  Songs tab
src/routes/songs/+page.server.ts, +page.svelte         (new)  library
src/routes/songs/[id]/+page.server.ts, +page.svelte    (new)  song page
src/lib/components/songs/LiveCount.svelte              (new)
worker/pyproject.toml                                  (new)
worker/salsa_worker/{__init__,__main__,api,media,jobs}.py (new)
worker/tests/test_jobs.py, test_media.py               (new)
flake.nix                                              (mod)  beat-this, checkpoint, salsa-worker, checks
~/.config/nixos-config/modules/services/salsa-worker.nix  (new)
~/.config/nixos-config/modules/services/salsa.nix         (mod)  second EnvironmentFile
~/.config/nixos-config/modules/hosts/laptop.nix           (mod)  import svc-salsa-worker
~/.config/nixos-config/secrets/secrets.nix                (mod)  salsa-worker.env.age
~/.config/nixos-config/flake.nix                          (mod)  salsaapp input
docs/deployment.md, CLAUDE.md                             (mod)
```

---

### Task 1: Shared file streaming and range serving

Refactor the two copies of "stream a raw body to disk with a size cap" and "serve a file with HTTP Range" into `src/lib/server/files.ts`, so songs can reuse them. Behaviour of the recording endpoints must not change.

**Files:**
- Modify: `src/lib/server/files.ts`
- Modify: `src/lib/server/files.spec.ts`
- Modify: `src/routes/api/figures/[id]/recordings/+server.ts`
- Modify: `src/routes/recordings/[file]/+server.ts`

**Interfaces:**
- Produces:
  - `parseRange(header: string | null, size: number): { start: number; end: number } | 'unsatisfiable' | null`
  - `serveFile(path: string, mime: string, request: Request): Promise<Response>` — 404 `Response` when the file is missing
  - `class TooLargeError extends Error`
  - `saveStream(body: ReadableStream<Uint8Array>, path: string, maxBytes: number): Promise<number>` — returns bytes written; on any error deletes the partial file and rethrows (`TooLargeError` when over the cap)
  - `audioDir(): string` — `$DATA_DIR/audio`, created on first use
  - `AUDIO_FILE_RE` — same shape as `RECORDING_FILE_RE`

- [ ] **Step 1: Write the failing tests** — append to `src/lib/server/files.spec.ts`:

```ts
import { parseRange } from './files';

describe('parseRange', () => {
	it('is null without a usable header', () => {
		expect(parseRange(null, 100)).toBeNull();
		expect(parseRange('bytes=-', 100)).toBeNull();
		expect(parseRange('items=0-1', 100)).toBeNull();
	});

	it('reads start-end, clamping the end to the file', () => {
		expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
		expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
	});

	it('reads open-ended and suffix ranges', () => {
		expect(parseRange('bytes=95-', 100)).toEqual({ start: 95, end: 99 });
		expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
		expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
	});

	it('refuses a range past the end', () => {
		expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
		expect(parseRange('bytes=50-40', 100)).toBe('unsatisfiable');
	});
});
```

Also change the existing import line at the top of the file to `import { RECORDING_FILE_RE, extensionFor, parseRange } from './files';` and delete the new duplicate import.

- [ ] **Step 2: Run to verify it fails**

Run: `nix develop --command npx vitest --run src/lib/server/files.spec.ts`
Expected: FAIL — `parseRange` is not exported.

- [ ] **Step 3: Implement** — add to `src/lib/server/files.ts` (keep existing exports):

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';

/** `$DATA_DIR/audio`, created on first use. Song audio lives here. */
export function audioDir(): string {
	if (!env.DATA_DIR) throw new Error('DATA_DIR is not set');
	const dir = join(env.DATA_DIR, 'audio');
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Stored song audio names: the same uuid-plus-extension shape as recordings. */
export const AUDIO_FILE_RE = RECORDING_FILE_RE;

/**
 * Parse a `Range: bytes=…` header against a file size.
 * `bytes=-500` is the LAST 500 bytes; `bytes=500-` is from 500 to the end.
 */
export function parseRange(
	header: string | null,
	size: number
): { start: number; end: number } | 'unsatisfiable' | null {
	const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
	if (!m || (m[1] === '' && m[2] === '')) return null;
	const start = m[1] === '' ? Math.max(size - Number(m[2]), 0) : Number(m[1]);
	const end = Math.min(m[1] === '' || m[2] === '' ? size - 1 : Number(m[2]), size - 1);
	if (start > end || start >= size) return 'unsatisfiable';
	return { start, end };
}

/**
 * Serve a file with HTTP Range support. Range is not optional: iOS Safari
 * refuses to play media whose server answers a range request with a plain 200.
 */
export async function serveFile(path: string, mime: string, request: Request): Promise<Response> {
	const size = await stat(path).then(
		(s) => s.size,
		() => null
	);
	if (size === null) return new Response('The file is missing.', { status: 404 });

	const headers: Record<string, string> = {
		'content-type': mime,
		'accept-ranges': 'bytes',
		'cache-control': 'private, max-age=31536000, immutable'
	};
	const range = parseRange(request.headers.get('range'), size);
	if (range === 'unsatisfiable') {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	if (range === null) {
		const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
		return new Response(body, { headers: { ...headers, 'content-length': String(size) } });
	}
	const body = Readable.toWeb(
		createReadStream(path, { start: range.start, end: range.end })
	) as unknown as ReadableStream;
	return new Response(body, {
		status: 206,
		headers: {
			...headers,
			'content-range': `bytes ${range.start}-${range.end}/${size}`,
			'content-length': String(range.end - range.start + 1)
		}
	});
}

export class TooLargeError extends Error {}

/**
 * Stream a request body to `path`, counting bytes so a missing or lying
 * `content-length` cannot get past the cap. Never leaves a partial file: on
 * any failure the file is removed and the error rethrown.
 */
export async function saveStream(
	body: ReadableStream<Uint8Array>,
	path: string,
	maxBytes: number
): Promise<number> {
	let bytes = 0;
	const limit = new Transform({
		transform(chunk: Buffer, _enc, done) {
			bytes += chunk.length;
			if (bytes > maxBytes) done(new TooLargeError('too large'));
			else done(null, chunk);
		}
	});
	try {
		await pipeline(
			Readable.fromWeb(body as unknown as NodeWebReadableStream),
			limit,
			createWriteStream(path, { flags: 'wx' })
		);
	} catch (err) {
		await unlink(path).catch(() => {});
		throw bytes > maxBytes ? new TooLargeError('too large') : err;
	}
	return bytes;
}
```

Merge the `node:fs` import with the existing `mkdirSync` import (`import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';`).

- [ ] **Step 4: Rewrite the recording upload** — replace the body of `POST` in `src/routes/api/figures/[id]/recordings/+server.ts` from the `let bytes = 0;` line to the end with:

```ts
	let bytes: number;
	try {
		bytes = await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) {
			throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
		}
		console.error('recording upload failed', err);
		throw error(400, 'The upload was interrupted. Try again.');
	}

	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, 'Empty upload.');
	}

	const recording = addRecording(db, { figureId, file, mime, kind, sizeBytes: bytes, note });
	return json(recording, { status: 201 });
};
```

Update its imports: drop `createWriteStream`, `Readable`, `Transform`, `pipeline`, the `node:stream/web` type; import `TooLargeError, saveStream` from `$lib/server/files`. Keep `unlink` from `node:fs/promises`.

- [ ] **Step 5: Rewrite the recording server** — `src/routes/recordings/[file]/+server.ts` becomes:

```ts
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getRecordingByFile } from '$lib/server/figures';
import { RECORDING_FILE_RE, recordingsDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/** Serve a recording with HTTP Range. Behind the session guard in hooks.server.ts. */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!RECORDING_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const rec = getRecordingByFile(getDb(), params.file);
	if (!rec) throw error(404, 'Not found');
	return serveFile(join(recordingsDir(), rec.file), rec.mime, request);
};
```

- [ ] **Step 6: Run everything**

Run: `nix develop --command npm run check`
Expected: 0 lint/type errors; all tests pass (the 4 new `parseRange` tests included).

- [ ] **Step 7: Regression-check the endpoints by hand** — start the dev server (`ADMIN_EMAIL=dev@salsa.local ADMIN_PASSWORD='Dev-Salsa-2026!' npx vite dev --port 5190 --strictPort`, in the background), log in with curl into a cookie jar, then:

```bash
B=http://localhost:5190
head -c 200000 /dev/urandom > /tmp/x.mp4
curl -s -b cj -H "Origin: $B" -H "content-type: video/mp4" --data-binary @/tmp/x.mp4 -w " %{http_code}\n" $B/api/figures/1/recordings   # 201
F=$(sqlite3 .data/salsa.db "select file from recordings order by id desc limit 1")
curl -s -b cj -H "Range: bytes=10-19" -o /dev/null -w "%{http_code} %{size_download}\n" $B/recordings/$F   # 206 10
curl -s -b cj -H "Range: bytes=999999-" -o /dev/null -w "%{http_code}\n" $B/recordings/$F                 # 416
```

(If the local DB has no figure 1, create one first via `curl -X POST -d "name=T&partner=solo&style=salsa&notes=&everyDays=3" "$B/figures?/create"`.) Stop the dev server by its task id, not with `pkill -f` (that matches the calling shell).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "refactor: shared saveStream/serveFile for uploads and range serving

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure beat grid

**Files:**
- Create: `src/lib/beatgrid/beatgrid.ts`
- Create: `src/lib/beatgrid/beatgrid.spec.ts`
- Modify: `src/lib/labels.ts`

**Interfaces:**
- Produces (all pure, times in seconds):
  - `labels.ts`: `export const TEMPO_FACTORS = [0.5, 1, 2] as const; export type TempoFactor = (typeof TEMPO_FACTORS)[number];` and `export const TEMPO_LABEL: Record<TempoFactor, string> = { 0.5: '×½', 1: '×1', 2: '×2' };`
  - `TAP_LATENCY_S = 0.08`
  - `median(xs: number[]): number`
  - `cleanBeats(beats: number[]): number[]`
  - `scaleBeats(beats: number[], factor: TempoFactor): number[]`
  - `bpmOf(beats: number[]): number | null`
  - `suggestOne(beats: number[], downbeats: number[]): number | null` — a beat index 0–3
  - `countsFor(n: number, anchors: number[], fallback: number): number[]` — 1..8 per beat
  - `beatIndexAt(beats: number[], t: number): number` — last beat ≤ t, `-1` before the first
  - `nearestBeat(beats: number[], t: number): number` — `-1` for no beats
  - `addAnchor(anchors: number[], i: number): number[]`, `removeAnchor(anchors: number[], i: number): number[]`
  - `interface Grid { beats: number[]; counts: number[]; bpm: number | null; suggested: boolean }`
  - `buildGrid(input: { beats: number[]; downbeats: number[]; anchors: number[]; tempoFactor: TempoFactor }): Grid`

- [ ] **Step 1: Add the labels** — append to `src/lib/labels.ts`:

```ts
/** How the detected beats map to the dance count. See `src/lib/beatgrid/`. */
export const TEMPO_FACTORS = [0.5, 1, 2] as const;
export type TempoFactor = (typeof TEMPO_FACTORS)[number];
export const TEMPO_LABEL: Record<TempoFactor, string> = { 0.5: '×½', 1: '×1', 2: '×2' };

export const SONG_STATUSES = ['waiting_download', 'waiting_analysis', 'ready', 'failed'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];
```

- [ ] **Step 2: Write the failing tests** — `src/lib/beatgrid/beatgrid.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	addAnchor,
	beatIndexAt,
	bpmOf,
	buildGrid,
	cleanBeats,
	countsFor,
	nearestBeat,
	removeAnchor,
	scaleBeats,
	suggestOne
} from './beatgrid';

/** n beats every `p` seconds starting at `t0`. */
const steady = (n: number, p = 0.5, t0 = 1) => Array.from({ length: n }, (_, i) => t0 + i * p);

describe('cleanBeats', () => {
	it('keeps a steady grid as it is', () => {
		expect(cleanBeats(steady(10))).toEqual(steady(10));
	});

	it('fills a gap at the median interval', () => {
		// A 2 s break where four beats are missing.
		const beats = [...steady(5), ...steady(5, 0.5, 5)];
		const out = cleanBeats(beats);
		expect(out).toHaveLength(13);
		expect(out[5]).toBeCloseTo(3.5);
		expect(out[7]).toBeCloseTo(4.5);
	});

	it('drops near-duplicates and sorts', () => {
		expect(cleanBeats([2, 1, 1.5, 1.52, 2.5])).toEqual([1, 1.5, 2, 2.5]);
	});
});

describe('scaleBeats', () => {
	it('inserts midpoints at ×2 and keeps every other beat at ×½', () => {
		expect(scaleBeats([0, 1, 2], 2)).toEqual([0, 0.5, 1, 1.5, 2]);
		expect(scaleBeats([0, 1, 2, 3, 4], 0.5)).toEqual([0, 2, 4]);
		expect(scaleBeats([0, 1], 1)).toEqual([0, 1]);
	});
});

describe('bpmOf', () => {
	it('is 60 over the median interval', () => {
		expect(bpmOf(steady(20, 0.5))).toBeCloseTo(120);
		expect(bpmOf([1])).toBeNull();
	});
});

describe('suggestOne', () => {
	it('picks the beat phase most downbeats land on', () => {
		const beats = steady(32);
		// Downbeats on beat indices 2, 6, 10, … plus one stray on index 3.
		const downbeats = [2, 6, 10, 14, 18, 3].map((i) => beats[i] + 0.02);
		expect(suggestOne(beats, downbeats)).toBe(2);
	});

	it('ignores downbeats far from any beat, and is null with nothing to go on', () => {
		const beats = steady(8);
		expect(suggestOne(beats, [beats[1] + 0.25])).toBeNull();
		expect(suggestOne(beats, [])).toBeNull();
		expect(suggestOne([], [1])).toBeNull();
	});
});

describe('countsFor', () => {
	it('counts 1–8 from the fallback when there are no anchors', () => {
		expect(countsFor(10, [], 2)).toEqual([7, 8, 1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('counts forward from each anchor and backwards before the first', () => {
		const c = countsFor(20, [3, 13], 0);
		expect(c.slice(0, 5)).toEqual([6, 7, 8, 1, 2]);
		expect(c[11]).toBe(1); // 3 + 8, still following the first anchor
		expect(c[12]).toBe(2);
		expect(c[13]).toBe(1); // re-anchored
		expect(c[19]).toBe(7);
	});

	it('ignores anchors outside the beats', () => {
		expect(countsFor(3, [-1, 99], 0)).toEqual([1, 2, 3]);
	});
});

describe('beatIndexAt / nearestBeat', () => {
	const beats = [1, 2, 3, 4];
	it('finds the last beat at or before t', () => {
		expect(beatIndexAt(beats, 0.5)).toBe(-1);
		expect(beatIndexAt(beats, 1)).toBe(0);
		expect(beatIndexAt(beats, 2.9)).toBe(1);
		expect(beatIndexAt(beats, 10)).toBe(3);
	});
	it('finds the nearest beat', () => {
		expect(nearestBeat(beats, 2.4)).toBe(1);
		expect(nearestBeat(beats, 2.6)).toBe(2);
		expect(nearestBeat(beats, -5)).toBe(0);
		expect(nearestBeat(beats, 99)).toBe(3);
		expect(nearestBeat([], 1)).toBe(-1);
	});
});

describe('anchors', () => {
	it('adds sorted and drops anchors that agree with the one before', () => {
		expect(addAnchor([], 5)).toEqual([5]);
		expect(addAnchor([5], 21)).toEqual([5]); // 21 − 5 = 16, same count
		expect(addAnchor([5], 22)).toEqual([5, 22]);
		expect(addAnchor([5, 22], 0)).toEqual([0, 5, 22]); // 5 − 0 = 5: a different count, kept
		expect(addAnchor([5, 22], 13)).toEqual([5, 22]); // 13 − 5 = 8: agrees with 5, dropped
	});

	it('removes', () => {
		expect(removeAnchor([1, 9, 12], 9)).toEqual([1, 12]);
	});
});

describe('buildGrid', () => {
	it('uses the suggestion without anchors, and the anchors once tapped', () => {
		const beats = steady(16);
		const downbeats = [1, 5, 9, 13].map((i) => beats[i]);
		const suggested = buildGrid({ beats, downbeats, anchors: [], tempoFactor: 1 });
		expect(suggested.suggested).toBe(true);
		expect(suggested.counts[1]).toBe(1);
		const tapped = buildGrid({ beats, downbeats, anchors: [0], tempoFactor: 1 });
		expect(tapped.suggested).toBe(false);
		expect(tapped.counts[0]).toBe(1);
	});

	it('applies the tempo factor before counting', () => {
		const g = buildGrid({ beats: steady(8), downbeats: [], anchors: [], tempoFactor: 2 });
		expect(g.beats).toHaveLength(15);
		expect(g.bpm).toBeCloseTo(240);
	});
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `nix develop --command npx vitest --run src/lib/beatgrid`
Expected: FAIL — cannot find module `./beatgrid`.

- [ ] **Step 4: Implement** — `src/lib/beatgrid/beatgrid.ts`:

```ts
/**
 * Beat times → the dance count, as pure functions.
 *
 * Measured on real salsa and son (spec, "Beat grid"): Beat This!'s BEATS are
 * reliable, its DOWNBEATS are not, and one constant-tempo line drifts at
 * breaks. So the grid is the detected beats themselves (gaps filled), and the
 * count comes from anchors — beat indices the user tapped as "1" — with the
 * model's downbeats only as a starting suggestion.
 */
import type { TempoFactor } from '$lib/labels';

/** How late a human tap lands after the beat it means. Subtracted before snapping. */
export const TAP_LATENCY_S = 0.08;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function median(xs: number[]): number {
	if (xs.length === 0) return NaN;
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const intervals = (beats: number[]) => beats.slice(1).map((t, i) => t - beats[i]);

/**
 * Sort, drop beats closer than half an interval to the previous one, and fill
 * gaps (breaks, stops) with evenly spaced beats so the count runs straight
 * through them instead of losing its place.
 */
export function cleanBeats(beats: number[]): number[] {
	const sorted = [...beats].sort((a, b) => a - b);
	if (sorted.length < 3) return sorted;
	const med = median(intervals(sorted));
	const out = [sorted[0]];
	for (const t of sorted.slice(1)) {
		const prev = out[out.length - 1];
		const gap = t - prev;
		if (gap < med * 0.5) continue;
		const n = Math.round(gap / med);
		for (let k = 1; k < n; k++) out.push(prev + (gap * k) / n);
		out.push(t);
	}
	return out;
}

/** ×2 inserts a midpoint between neighbours; ×½ keeps every other beat. */
export function scaleBeats(beats: number[], factor: TempoFactor): number[] {
	if (factor === 1) return [...beats];
	if (factor === 0.5) return beats.filter((_, i) => i % 2 === 0);
	const out: number[] = [];
	beats.forEach((t, i) => {
		out.push(t);
		if (i + 1 < beats.length) out.push((t + beats[i + 1]) / 2);
	});
	return out;
}

export function bpmOf(beats: number[]): number | null {
	if (beats.length < 2) return null;
	return 60 / median(intervals(beats));
}

/** Last beat at or before `t`, or -1 before the first. Binary search. */
export function beatIndexAt(beats: number[], t: number): number {
	let lo = 0;
	let hi = beats.length - 1;
	let ans = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (beats[mid] <= t) {
			ans = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return ans;
}

export function nearestBeat(beats: number[], t: number): number {
	if (beats.length === 0) return -1;
	const i = beatIndexAt(beats, t);
	if (i < 0) return 0;
	if (i + 1 < beats.length && beats[i + 1] - t < t - beats[i]) return i + 1;
	return i;
}

/**
 * Which beat index (0–3) the model's downbeats most often land on. Only a
 * suggestion: on salsa the votes are close, and 1 vs 5 cannot be told apart.
 */
export function suggestOne(beats: number[], downbeats: number[]): number | null {
	if (beats.length < 2 || downbeats.length === 0) return null;
	const tol = median(intervals(beats)) * 0.25;
	const votes = [0, 0, 0, 0];
	for (const d of downbeats) {
		const i = nearestBeat(beats, d);
		if (Math.abs(beats[i] - d) <= tol) votes[i % 4]++;
	}
	const best = votes.indexOf(Math.max(...votes));
	return votes[best] > 0 ? best : null;
}

/**
 * The count (1–8) of every beat. Each anchor is a "1" and holds until the next
 * anchor; before the first anchor the count runs backwards from it.
 */
export function countsFor(n: number, anchors: number[], fallback: number): number[] {
	const a = anchors.filter((x) => x >= 0 && x < n).sort((x, y) => x - y);
	const out: number[] = new Array(n);
	let k = 0;
	for (let i = 0; i < n; i++) {
		while (k + 1 < a.length && a[k + 1] <= i) k++;
		const anchor = a.length > 0 ? a[k] : fallback;
		out[i] = mod(i - anchor, 8) + 1;
	}
	return out;
}

/** Add a tapped "1". An anchor that agrees with the one before it adds nothing and is dropped. */
export function addAnchor(anchors: number[], i: number): number[] {
	const sorted = [...new Set([...anchors, i])].sort((x, y) => x - y);
	const out: number[] = [];
	for (const a of sorted) {
		const prev = out[out.length - 1];
		if (prev === undefined || mod(a - prev, 8) !== 0) out.push(a);
	}
	return out;
}

export function removeAnchor(anchors: number[], i: number): number[] {
	return anchors.filter((a) => a !== i);
}

export interface Grid {
	beats: number[];
	counts: number[];
	bpm: number | null;
	/** True while the count is the model's guess rather than the user's taps. */
	suggested: boolean;
}

export function buildGrid(input: {
	beats: number[];
	downbeats: number[];
	anchors: number[];
	tempoFactor: TempoFactor;
}): Grid {
	const beats = scaleBeats(input.beats, input.tempoFactor);
	const suggested = input.anchors.length === 0;
	const fallback = suggested ? (suggestOne(beats, input.downbeats) ?? 0) : 0;
	return {
		beats,
		counts: countsFor(beats.length, input.anchors, fallback),
		bpm: bpmOf(beats),
		suggested
	};
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `nix develop --command npx vitest --run src/lib/beatgrid`
Expected: PASS, all tests.

- [ ] **Step 6: Full check and commit**

```bash
nix develop --command npm run check
git add -A && git commit -m "beatgrid: pure beats → count with anchors, gap filling, tempo factor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 3: Songs table and data layer (including the job queue)

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0001_songs.sql` (generated)
- Modify: `src/lib/types.ts`
- Create: `src/lib/server/songs.ts`
- Create: `src/lib/server/songs.spec.ts`

**Interfaces:**
- Consumes: `cleanBeats`, `bpmOf` from Task 2; `SONG_STATUSES`, `TEMPO_FACTORS`, `STYLES` from `labels.ts`.
- Produces (all take `db: Db` first):
  - `LEASE_MS = 15 * 60_000`, `MAX_ATTEMPTS = 5`
  - `createSongFromUrl(db, { url: string; title: string; style: Style }): SongRow`
  - `createSongFromUpload(db, { file: string; mime: string; title: string; style: Style }): SongRow`
  - `listSongs(db): SongItem[]` (not archived, newest first)
  - `getSong(db, id: number): SongRow | null`
  - `getSongByAudioFile(db, file: string): SongRow | null`
  - `updateSongMeta(db, id, { title: string; artist: string | null; style: Style }): SongRow | null`
  - `archiveSong(db, id, now: number): boolean`
  - `retrySong(db, id): SongRow | null` — back to waiting, attempts 0, error cleared
  - `setAnchors(db, id, anchors: number[]): void`
  - `setTempoFactor(db, id, factor: TempoFactor): void` — also clears anchors
  - `type Job = { id: number; kind: 'download' | 'analyze'; url: string | null }`
  - `claimJob(db, now: number): Job | null`
  - `storeFetchedAudio(db, id, { file: string; mime: string; title: string | null; durationS: number | null }): void`
  - `storeAnalysis(db, id, { beats: number[]; downbeats: number[]; durationS: number }): void`
  - `failJob(db, id, error: string, permanent: boolean): void`
  - `SongRow = typeof songs.$inferSelect` (exported from schema.ts as `Song`)
  - `types.ts`: `interface SongItem { id: number; title: string; artist: string | null; style: Style; sourceUrl: string | null; status: SongStatus; error: string | null; durationS: number | null; bpm: number | null; tempoFactor: TempoFactor; createdAt: number }`

- [ ] **Step 1: Add the table** — append to `src/lib/server/db/schema.ts` (and add `SONG_STATUSES` to its `../../labels` import):

```ts
/* ── Songs ──────────────────────────────────────────────────────────────── */

/**
 * A song and its beat analysis. The heavy work (download, Beat This!) happens
 * on the home worker; this row is also the job queue — `status` says what the
 * worker should do next, `claimed_at` is its lease. See `src/lib/server/songs.ts`.
 *
 * `beats_json` is already cleaned (gaps filled). The user's count lives in
 * `anchors_json` and `tempo_factor`, separate from the analysis, so re-analysing
 * never throws away a correction.
 */
export const songs = sqliteTable(
	'songs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Empty until the user or the worker (from YouTube) names it. */
		title: text('title').notNull().default(''),
		artist: text('artist'),
		style: text('style', { enum: STYLES }).notNull().default('salsa'),
		sourceUrl: text('source_url'),
		status: text('status', { enum: SONG_STATUSES }).notNull(),
		error: text('error'),
		attempts: integer('attempts').notNull().default(0),
		claimedAt: integer('claimed_at'),
		/** File name under `$DATA_DIR/audio/`. */
		audioFile: text('audio_file').unique(),
		mime: text('mime'),
		durationS: real('duration_s'),
		bpm: real('bpm'),
		beatsJson: text('beats_json'),
		downbeatsJson: text('downbeats_json'),
		anchorsJson: text('anchors_json').notNull().default('[]'),
		tempoFactor: real('tempo_factor').notNull().default(1),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		check('songs_tempo_ck', sql`${t.tempoFactor} in (0.5, 1, 2)`),
		check('songs_source_ck', sql`${t.sourceUrl} is not null or ${t.audioFile} is not null`),
		index('songs_status_idx').on(t.status, t.createdAt)
	]
);

export type Song = typeof songs.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `nix develop --command npx drizzle-kit generate --name songs`
Expected: `drizzle/0001_songs.sql` containing `CREATE TABLE \`songs\``.

- [ ] **Step 3: Add the shared type** — append to `src/lib/types.ts` (extend its import to `import type { Partner, SongStatus, Source, Style, TempoFactor } from './labels';`):

```ts
export interface SongItem {
	id: number;
	title: string;
	artist: string | null;
	style: Style;
	sourceUrl: string | null;
	status: SongStatus;
	error: string | null;
	durationS: number | null;
	bpm: number | null;
	tempoFactor: TempoFactor;
	createdAt: number;
}
```

- [ ] **Step 4: Write the failing tests** — `src/lib/server/songs.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import {
	LEASE_MS,
	MAX_ATTEMPTS,
	archiveSong,
	claimJob,
	createSongFromUpload,
	createSongFromUrl,
	failJob,
	getSong,
	listSongs,
	retrySong,
	setAnchors,
	setTempoFactor,
	storeAnalysis,
	storeFetchedAudio
} from './songs';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const URL = 'https://www.youtube.com/watch?v=YXnjy5YlDwk';
const T = 1_790_000_000_000;

describe('songs', () => {
	it('queues a URL for download and an upload for analysis, oldest first', () => {
		const a = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		const b = createSongFromUpload(db, {
			file: 'b.mp3',
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'son'
		});
		expect(a.status).toBe('waiting_download');
		expect(b.status).toBe('waiting_analysis');
		expect(claimJob(db, T)).toEqual({ id: a.id, kind: 'download', url: URL });
		expect(claimJob(db, T)).toEqual({ id: b.id, kind: 'analyze', url: null });
		expect(claimJob(db, T)).toBeNull();
	});

	it('holds a lease, then lets a stale claim be taken again', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('gives up after MAX_ATTEMPTS stale claims', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		let now = T;
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(claimJob(db, now)?.id).toBe(s.id);
			now += LEASE_MS + 1;
		}
		expect(claimJob(db, now)).toBeNull();
		const row = getSong(db, s.id);
		expect(row?.status).toBe('failed');
		expect(row?.error).toMatch(/5 attempts/);
	});

	it('moves a fetched song to analysis and names it from the source when unnamed', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		claimJob(db, T);
		storeFetchedAudio(db, s.id, {
			file: 'a.opus',
			mime: 'audio/ogg',
			title: 'Vivir Mi Vida',
			durationS: 327
		});
		const row = getSong(db, s.id);
		expect(row?.status).toBe('waiting_analysis');
		expect(row?.title).toBe('Vivir Mi Vida');
		expect(row?.claimedAt).toBeNull();
		// The same claim continues straight into analysis.
		expect(claimJob(db, T)?.kind).toBe('analyze');
	});

	it('keeps a title the user typed', () => {
		const s = createSongFromUrl(db, { url: URL, title: 'Mine', style: 'salsa' });
		storeFetchedAudio(db, s.id, { file: 'a.opus', mime: 'audio/ogg', title: 'Theirs', durationS: 1 });
		expect(getSong(db, s.id)?.title).toBe('Mine');
	});

	it('stores a cleaned analysis and marks the song ready', () => {
		const s = createSongFromUpload(db, { file: 'x.mp3', mime: 'audio/mpeg', title: 'x', style: 'salsa' });
		claimJob(db, T);
		// A gap of two missing beats at 2.0 and 2.5.
		storeAnalysis(db, s.id, { beats: [0.5, 1, 1.5, 3, 3.5, 4], downbeats: [0.5], durationS: 5 });
		const row = getSong(db, s.id);
		expect(row?.status).toBe('ready');
		expect(JSON.parse(row?.beatsJson ?? '[]')).toHaveLength(8);
		expect(row?.bpm).toBeCloseTo(120);
		expect(listSongs(db)[0]).toMatchObject({ id: s.id, status: 'ready', durationS: 5 });
	});

	it('retries a transient failure and fails a permanent one', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		claimJob(db, T);
		failJob(db, s.id, 'network down', false);
		expect(getSong(db, s.id)).toMatchObject({ status: 'waiting_download', claimedAt: null });
		claimJob(db, T);
		failJob(db, s.id, 'Video unavailable', true);
		expect(getSong(db, s.id)).toMatchObject({ status: 'failed', error: 'Video unavailable' });
		expect(retrySong(db, s.id)).toMatchObject({
			status: 'waiting_download',
			attempts: 0,
			error: null
		});
	});

	it('retries an uploaded song by analysing it again', () => {
		const s = createSongFromUpload(db, { file: 'x.mp3', mime: 'audio/mpeg', title: 'x', style: 'salsa' });
		failJob(db, s.id, 'bad audio', true);
		expect(retrySong(db, s.id)?.status).toBe('waiting_analysis');
	});

	it('clears anchors when the tempo factor changes', () => {
		const s = createSongFromUpload(db, { file: 'x.mp3', mime: 'audio/mpeg', title: 'x', style: 'salsa' });
		setAnchors(db, s.id, [3, 19]);
		expect(getSong(db, s.id)?.anchorsJson).toBe('[3,19]');
		setTempoFactor(db, s.id, 2);
		expect(getSong(db, s.id)).toMatchObject({ tempoFactor: 2, anchorsJson: '[]' });
	});

	it('archives out of the list and the queue', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(archiveSong(db, s.id, T)).toBe(true);
		expect(listSongs(db)).toHaveLength(0);
		expect(claimJob(db, T)).toBeNull();
	});
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `nix develop --command npx vitest --run src/lib/server/songs.spec.ts`
Expected: FAIL — cannot find module `./songs`.

- [ ] **Step 6: Implement** — `src/lib/server/songs.ts`:

```ts
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { songs, type Song } from './db/schema';
import { bpmOf, cleanBeats } from '$lib/beatgrid/beatgrid';
import type { Style, TempoFactor } from '$lib/labels';
import type { SongItem } from '$lib/types';

/** A claim older than this is presumed dead (laptop slept, worker crashed) and can be retaken. */
export const LEASE_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;

const WAITING = ['waiting_download', 'waiting_analysis'] as const;

export function createSongFromUrl(db: Db, input: { url: string; title: string; style: Style }): Song {
	return db
		.insert(songs)
		.values({ sourceUrl: input.url, title: input.title, style: input.style, status: 'waiting_download' })
		.returning()
		.get();
}

export function createSongFromUpload(
	db: Db,
	input: { file: string; mime: string; title: string; style: Style }
): Song {
	return db
		.insert(songs)
		.values({
			audioFile: input.file,
			mime: input.mime,
			title: input.title,
			style: input.style,
			status: 'waiting_analysis'
		})
		.returning()
		.get();
}

export function listSongs(db: Db): SongItem[] {
	return db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
			style: songs.style,
			sourceUrl: songs.sourceUrl,
			status: songs.status,
			error: songs.error,
			durationS: songs.durationS,
			bpm: songs.bpm,
			tempoFactor: songs.tempoFactor,
			createdAt: songs.createdAt
		})
		.from(songs)
		.where(isNull(songs.archivedAt))
		.orderBy(desc(songs.createdAt), desc(songs.id))
		.all() as SongItem[];
}

export function getSong(db: Db, id: number): Song | null {
	return db.select().from(songs).where(eq(songs.id, id)).get() ?? null;
}

export function getSongByAudioFile(db: Db, file: string): Song | null {
	return db.select().from(songs).where(eq(songs.audioFile, file)).get() ?? null;
}

export function updateSongMeta(
	db: Db,
	id: number,
	input: { title: string; artist: string | null; style: Style }
): Song | null {
	return db.update(songs).set(input).where(eq(songs.id, id)).returning().get() ?? null;
}

export function archiveSong(db: Db, id: number, now: number): boolean {
	return (
		db
			.update(songs)
			.set({ archivedAt: now })
			.where(and(eq(songs.id, id), isNull(songs.archivedAt)))
			.run().changes > 0
	);
}

/** Put a failed (or stuck) song back in the queue: re-download if there is no audio yet. */
export function retrySong(db: Db, id: number): Song | null {
	const song = getSong(db, id);
	if (!song) return null;
	return (
		db
			.update(songs)
			.set({
				status: song.audioFile ? 'waiting_analysis' : 'waiting_download',
				attempts: 0,
				error: null,
				claimedAt: null
			})
			.where(eq(songs.id, id))
			.returning()
			.get() ?? null
	);
}

export function setAnchors(db: Db, id: number, anchors: number[]): void {
	db.update(songs).set({ anchorsJson: JSON.stringify(anchors) }).where(eq(songs.id, id)).run();
}

/** Beat indices mean something different at another tempo factor, so the anchors go too. */
export function setTempoFactor(db: Db, id: number, factor: TempoFactor): void {
	db.update(songs).set({ tempoFactor: factor, anchorsJson: '[]' }).where(eq(songs.id, id)).run();
}

export interface Job {
	id: number;
	kind: 'download' | 'analyze';
	url: string | null;
}

/**
 * Hand the oldest waiting song to the worker and lease it. A song whose last
 * claim went stale after MAX_ATTEMPTS tries is failed here instead, so a song
 * that crashes the worker every time cannot block the queue forever.
 */
export function claimJob(db: Db, now: number): Job | null {
	return db.transaction((tx) => {
		const stale = or(isNull(songs.claimedAt), lt(songs.claimedAt, now - LEASE_MS));
		tx.update(songs)
			.set({
				status: 'failed',
				error: `Gave up after ${MAX_ATTEMPTS} attempts.`,
				claimedAt: null
			})
			.where(
				and(
					isNull(songs.archivedAt),
					inArray(songs.status, WAITING),
					stale,
					sql`${songs.attempts} >= ${MAX_ATTEMPTS}`
				)
			)
			.run();

		const next = tx
			.select()
			.from(songs)
			.where(and(isNull(songs.archivedAt), inArray(songs.status, WAITING), stale))
			.orderBy(asc(songs.createdAt), asc(songs.id))
			.limit(1)
			.get();
		if (!next) return null;

		tx.update(songs)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(songs.id, next.id))
			.run();
		return {
			id: next.id,
			kind: next.status === 'waiting_download' ? 'download' : 'analyze',
			url: next.status === 'waiting_download' ? next.sourceUrl : null
		};
	});
}

/**
 * The worker downloaded the audio. Release the lease and move on to analysis;
 * the worker claims the analysis job next, normally straight away.
 */
export function storeFetchedAudio(
	db: Db,
	id: number,
	input: { file: string; mime: string; title: string | null; durationS: number | null }
): void {
	const song = getSong(db, id);
	if (!song) return;
	db.update(songs)
		.set({
			audioFile: input.file,
			mime: input.mime,
			durationS: input.durationS,
			title: song.title === '' && input.title ? input.title.slice(0, 200) : song.title,
			status: 'waiting_analysis',
			claimedAt: null,
			error: null
		})
		.where(eq(songs.id, id))
		.run();
}

export function storeAnalysis(
	db: Db,
	id: number,
	input: { beats: number[]; downbeats: number[]; durationS: number }
): void {
	const beats = cleanBeats(input.beats);
	db.update(songs)
		.set({
			beatsJson: JSON.stringify(beats),
			downbeatsJson: JSON.stringify(input.downbeats),
			bpm: bpmOf(beats),
			durationS: input.durationS,
			status: 'ready',
			claimedAt: null,
			error: null
		})
		.where(eq(songs.id, id))
		.run();
}

/** A transient failure goes back in the queue; a permanent one (or the last attempt) fails the song. */
export function failJob(db: Db, id: number, error: string, permanent: boolean): void {
	const song = getSong(db, id);
	if (!song) return;
	const giveUp = permanent || song.attempts >= MAX_ATTEMPTS;
	db.update(songs)
		.set({
			error: error.slice(0, 500),
			claimedAt: null,
			status: giveUp ? 'failed' : song.status
		})
		.where(eq(songs.id, id))
		.run();
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `nix develop --command npx vitest --run src/lib/server/songs.spec.ts`
Expected: PASS.

- [ ] **Step 8: Full check and commit**

```bash
nix develop --command npm run check
git add -A && git commit -m "songs: table, data layer and job queue with lease and retry limits

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Worker API (token-authenticated)

**Files:**
- Create: `src/lib/server/worker-auth.ts`, `src/lib/server/worker-auth.spec.ts`
- Create: `src/lib/server/analysis.ts`, `src/lib/server/analysis.spec.ts`
- Modify: `src/hooks.server.ts`
- Create: `src/routes/api/worker/claim/+server.ts`
- Create: `src/routes/api/worker/songs/[id]/audio/+server.ts`
- Create: `src/routes/api/worker/songs/[id]/analysis/+server.ts`
- Create: `src/routes/api/worker/songs/[id]/fail/+server.ts`

**Interfaces:**
- Consumes: Task 1 `saveStream`, `serveFile`, `audioDir`, `extensionFor`, `TooLargeError`; Task 3 `claimJob`, `getSong`, `storeFetchedAudio`, `storeAnalysis`, `failJob`.
- Produces — the HTTP contract the Python worker (Task 6) implements against. All require `Authorization: Bearer $SALSA_WORKER_TOKEN`, else 401.
  - `POST /api/worker/claim` → `204` (nothing to do) or `200 {"id": number, "kind": "download"|"analyze", "url": string|null}`
  - `GET /api/worker/songs/{id}/audio` → the song's audio (Range supported); 404 if none
  - `PUT /api/worker/songs/{id}/audio` — raw body, `content-type: audio/mp4` (the worker sends AAC/m4a); optional headers `x-title` (URI-encoded), `x-duration` (seconds) → `204`
  - `POST /api/worker/songs/{id}/analysis` — JSON `{"beats": number[], "downbeats": number[], "durationS": number}` → `204`, or `400 {"message"}` if invalid
  - `POST /api/worker/songs/{id}/fail` — JSON `{"error": string, "permanent": boolean}` → `204`
  - `workerTokenOk(header: string | null, expected: string | undefined): boolean`
  - `parseAnalysis(body: unknown): { beats: number[]; downbeats: number[]; durationS: number } | string` (string = error message)

- [ ] **Step 1: Write the failing tests** — `src/lib/server/worker-auth.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { workerTokenOk } from './worker-auth';

describe('workerTokenOk', () => {
	const token = 'a'.repeat(43);
	it('accepts exactly the bearer token', () => {
		expect(workerTokenOk(`Bearer ${token}`, token)).toBe(true);
	});
	it('refuses anything else, and everything when no token is configured', () => {
		expect(workerTokenOk(`Bearer ${token}x`, token)).toBe(false);
		expect(workerTokenOk(token, token)).toBe(false);
		expect(workerTokenOk(null, token)).toBe(false);
		expect(workerTokenOk('Bearer ', '')).toBe(false);
		expect(workerTokenOk(`Bearer ${token}`, undefined)).toBe(false);
	});
});
```

`src/lib/server/analysis.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseAnalysis } from './analysis';

describe('parseAnalysis', () => {
	it('accepts ascending finite times', () => {
		expect(parseAnalysis({ beats: [0.5, 1], downbeats: [0.5], durationS: 3 })).toEqual({
			beats: [0.5, 1],
			downbeats: [0.5],
			durationS: 3
		});
	});
	it('rejects the wrong shape with a message', () => {
		expect(parseAnalysis(null)).toMatch(/object/);
		expect(parseAnalysis({ beats: 'x', downbeats: [], durationS: 1 })).toMatch(/beats/);
		expect(parseAnalysis({ beats: [1, Number.NaN], downbeats: [], durationS: 1 })).toMatch(/beats/);
		expect(parseAnalysis({ beats: [2, 1], downbeats: [], durationS: 3 })).toMatch(/ascending/);
		expect(parseAnalysis({ beats: [1, 2], downbeats: [], durationS: -1 })).toMatch(/durationS/);
		expect(parseAnalysis({ beats: [], downbeats: [], durationS: 1 })).toMatch(/no beats/);
		expect(
			parseAnalysis({ beats: Array.from({ length: 20_001 }, (_, i) => i), downbeats: [], durationS: 1 })
		).toMatch(/too many/);
	});
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `nix develop --command npx vitest --run src/lib/server/worker-auth.spec.ts src/lib/server/analysis.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement** — `src/lib/server/worker-auth.ts`:

```ts
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Check the home worker's bearer token. Hashing both sides first gives
 * timingSafeEqual equal-length inputs, so the comparison leaks neither the
 * token nor its length. No configured token means no worker access at all.
 */
export function workerTokenOk(header: string | null, expected: string | undefined): boolean {
	if (!expected || !header?.startsWith('Bearer ')) return false;
	const digest = (s: string) => createHash('sha256').update(s).digest();
	return timingSafeEqual(digest(header.slice(7)), digest(expected));
}
```

`src/lib/server/analysis.ts`:

```ts
/** Validate the worker's analysis payload before it touches the database. Pure. */

/** ~55 minutes of beats at 360 BPM — far past any song we accept (15 min). */
const MAX_TIMES = 20_000;

function times(v: unknown, name: string): number[] | string {
	if (!Array.isArray(v) || !v.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0)) {
		return `${name} must be an array of non-negative numbers`;
	}
	if (v.length > MAX_TIMES) return `too many ${name}`;
	for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) return `${name} must be ascending`;
	return v as number[];
}

export function parseAnalysis(
	body: unknown
): { beats: number[]; downbeats: number[]; durationS: number } | string {
	if (typeof body !== 'object' || body === null) return 'body must be an object';
	const b = body as Record<string, unknown>;
	const beats = times(b.beats, 'beats');
	if (typeof beats === 'string') return beats;
	if (beats.length === 0) return 'no beats found';
	const downbeats = times(b.downbeats, 'downbeats');
	if (typeof downbeats === 'string') return downbeats;
	const durationS = b.durationS;
	if (typeof durationS !== 'number' || !Number.isFinite(durationS) || durationS <= 0) {
		return 'durationS must be a positive number';
	}
	return { beats, downbeats, durationS };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `nix develop --command npx vitest --run src/lib/server/worker-auth.spec.ts src/lib/server/analysis.spec.ts`
Expected: PASS.

- [ ] **Step 5: Let worker routes past the session guard** — in `src/hooks.server.ts`, change the `isPublic` line to:

```ts
	// The home worker has no session: its routes check a bearer token themselves.
	const isPublic =
		PUBLIC_PATHS.has(path) || path.startsWith('/_app/') || path.startsWith('/api/worker/');
```

- [ ] **Step 6: Write the routes.**

`src/routes/api/worker/claim/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { claimJob } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const job = claimJob(getDb(), Date.now());
	return job ? json(job) : new Response(null, { status: 204 });
};
```

`src/routes/api/worker/songs/[id]/audio/+server.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	TooLargeError,
	audioDir,
	extensionFor,
	saveStream,
	serveFile
} from '$lib/server/files';
import { getSong, storeFetchedAudio } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

function authorize(request: Request) {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
}

function song(id: string) {
	const s = getSong(getDb(), Number(id));
	if (!s || s.archivedAt !== null) throw error(404, 'No such song');
	return s;
}

/** The worker fetches an uploaded song's audio to analyse it. */
export const GET: RequestHandler = ({ params, request }) => {
	authorize(request);
	const s = song(params.id);
	if (!s.audioFile || !s.mime) throw error(404, 'No audio yet');
	return serveFile(join(audioDir(), s.audioFile), s.mime, request);
};

/** The worker delivers downloaded audio. */
export const PUT: RequestHandler = async ({ params, request }) => {
	authorize(request);
	const s = song(params.id);
	if (!request.body) throw error(400, 'Empty upload');
	const mime = (request.headers.get('content-type') ?? 'audio/mp4').split(';')[0].trim();
	if (!mime.startsWith('audio/')) throw error(415, 'Audio only');

	const file = `${randomUUID()}.${extensionFor(mime, '')}`;
	try {
		await saveStream(request.body, join(audioDir(), file), MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) throw error(413, 'Audio too large');
		throw error(400, 'Upload interrupted');
	}
	const duration = Number(request.headers.get('x-duration'));
	storeFetchedAudio(getDb(), s.id, {
		file,
		mime,
		title: decodeURIComponent(request.headers.get('x-title') ?? '') || null,
		durationS: Number.isFinite(duration) && duration > 0 ? duration : null
	});
	return new Response(null, { status: 204 });
};
```

(If the song already had an audio file from an earlier attempt, the old file is left on disk; it is a few MB and the backup keeps audio anyway. Not worth a cleanup path.)

`src/routes/api/worker/songs/[id]/analysis/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { parseAnalysis } from '$lib/server/analysis';
import { getSong, storeAnalysis } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const parsed = parseAnalysis(await request.json().catch(() => null));
	if (typeof parsed === 'string') return json({ message: parsed }, { status: 400 });
	storeAnalysis(getDb(), s.id, parsed);
	return new Response(null, { status: 204 });
};
```

`src/routes/api/worker/songs/[id]/fail/+server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { failJob, getSong } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failJob(getDb(), s.id, String(body.error ?? 'Unknown worker error'), body.permanent === true);
	return new Response(null, { status: 204 });
};
```

- [ ] **Step 7: Check the contract by hand** — with the dev server running with `SALSA_WORKER_TOKEN=devtoken` added to its environment, and a logged-in cookie jar `cj`:

```bash
B=http://localhost:5190; H="Authorization: Bearer devtoken"
curl -s -o /dev/null -w "no token: %{http_code}\n" -X POST $B/api/worker/claim                 # 401
curl -s -o /dev/null -w "empty queue: %{http_code}\n" -H "$H" -X POST $B/api/worker/claim     # 204
sqlite3 .data/salsa.db "insert into songs (source_url, status, created_at) values ('https://example.com/x', 'waiting_download', 1)"
curl -s -H "$H" -X POST $B/api/worker/claim; echo                                               # {"id":…,"kind":"download",…}
ID=$(sqlite3 .data/salsa.db "select max(id) from songs")
nix shell nixpkgs#ffmpeg -c ffmpeg -loglevel error -f lavfi -i "sine=f=440:d=3" -c:a libopus /tmp/t.opus
curl -s -o /dev/null -w "put audio: %{http_code}\n" -H "$H" -H "content-type: audio/ogg" -H "x-title: Test" -H "x-duration: 3" -X PUT --data-binary @/tmp/t.opus $B/api/worker/songs/$ID/audio   # 204
curl -s -o /dev/null -w "get audio: %{http_code}\n" -H "$H" $B/api/worker/songs/$ID/audio      # 200
curl -s -w " bad analysis: %{http_code}\n" -H "$H" -H "content-type: application/json" -d '{"beats":[2,1],"downbeats":[],"durationS":3}' $B/api/worker/songs/$ID/analysis   # 400 ascending
curl -s -o /dev/null -w "analysis: %{http_code}\n" -H "$H" -H "content-type: application/json" -d '{"beats":[0.5,1,1.5,2],"downbeats":[0.5],"durationS":3}' $B/api/worker/songs/$ID/analysis   # 204
sqlite3 .data/salsa.db "select status, bpm from songs where id=$ID"                               # ready|120.0
```

- [ ] **Step 8: Full check and commit**

```bash
nix develop --command npm run check
git add -A && git commit -m "worker API: token-authenticated claim, audio up/down, analysis, fail

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 5: Songs UI — library, upload, song page with live count and tap-the-1

**Files:**
- Create: `src/lib/components/ui/UploadButton.svelte`; Delete: `src/lib/components/figures/RecordingUpload.svelte`
- Modify: `src/routes/figures/[id]/+page.svelte`
- Modify: `src/lib/format.ts`, `src/lib/format.spec.ts`
- Modify: `src/lib/components/shell/BottomNav.svelte`, `src/hooks.server.ts` (nothing new is public — no change needed; listed so the reviewer checks)
- Create: `src/routes/api/songs/+server.ts`, `src/routes/audio/[file]/+server.ts`
- Create: `src/routes/songs/+page.server.ts`, `src/routes/songs/+page.svelte`
- Create: `src/routes/songs/[id]/+page.server.ts`, `src/routes/songs/[id]/+page.svelte`
- Create: `src/lib/components/songs/LiveCount.svelte`

**Interfaces:**
- Consumes: Task 1 (`saveStream`, `serveFile`, `audioDir`, `AUDIO_FILE_RE`, `extensionFor`, `TooLargeError`), Task 2 (`buildGrid`, `nearestBeat`, `addAnchor`, `removeAnchor`, `beatIndexAt`, `TAP_LATENCY_S`, `TEMPO_FACTORS`, `TEMPO_LABEL`), Task 3 (song functions, `getSongByAudioFile`).
- Produces: `clock(seconds: number): string` in `format.ts` (`185.4` → `"3:05"`); `UploadButton` props `{ url: string; accept: string; label: string; headers?: (file: File) => Record<string, string> }`.

- [ ] **Step 1: `clock` — failing test first.** Append to `src/lib/format.spec.ts` inside the `describe('format', …)` block, and add `clock` to its import:

```ts
	it('prints a song position as m:ss', () => {
		expect(clock(0)).toBe('0:00');
		expect(clock(65.9)).toBe('1:05');
		expect(clock(600)).toBe('10:00');
	});
```

Run `nix develop --command npx vitest --run src/lib/format.spec.ts` → FAIL. Then append to `src/lib/format.ts`:

```ts
/** A song position in seconds as `m:ss`. */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
```

Run again → PASS.

- [ ] **Step 2: Generalise the upload button** — create `src/lib/components/ui/UploadButton.svelte` from `RecordingUpload.svelte`, with these differences: props are `{ url, accept, label, headers }`; the XHR posts to `url`; it sets `x-filename` and then every header returned by `headers?.(file)`; the idle label is `label`; the MIME check accepts `accept === 'audio/*' ? /^audio\// : /^(video|audio)\//`. Full file:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';

	interface Props {
		/** Endpoint taking the raw file as the POST body. */
		url: string;
		accept: 'audio/*' | 'video/*,audio/*';
		label: string;
		/** Extra request headers for this file (metadata rides in headers, not the body). */
		headers?: (file: File) => Record<string, string>;
	}

	let { url, accept, label, headers }: Props = $props();

	let progress = $state<number | null>(null);
	let message = $state<string | null>(null);
	let input: HTMLInputElement | undefined = $state();

	const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
	const allowed = $derived(accept === 'audio/*' ? /^audio\// : /^(video|audio)\//);

	/*
	 * XHR rather than fetch for upload progress: a phone upload over mobile data
	 * can take a minute, and a spinner with no number reads as hung.
	 */
	function upload(file: File) {
		message = null;
		if (file.size > MAX_RECORDING_BYTES) {
			message = `That file is ${mb(file.size)}; the limit is ${MAX_RECORDING_LABEL}.`;
			return;
		}
		if (!allowed.test(file.type)) {
			message = accept === 'audio/*' ? 'Only audio files can be added.' : 'Only video and audio files can be added.';
			return;
		}

		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);
		xhr.setRequestHeader('content-type', file.type);
		xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
		for (const [k, v] of Object.entries(headers?.(file) ?? {})) xhr.setRequestHeader(k, v);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) progress = e.loaded / e.total;
		};
		xhr.onload = async () => {
			progress = null;
			if (input) input.value = '';
			if (xhr.status === 201) {
				await invalidateAll();
				return;
			}
			let text = xhr.responseText;
			try {
				text = JSON.parse(text).message ?? text;
			} catch {
				/* plain-text error body */
			}
			message =
				xhr.status === 413
					? `That file is too large (limit ${MAX_RECORDING_LABEL}).`
					: text || 'Upload failed.';
		};
		xhr.onerror = () => {
			progress = null;
			message = 'Upload failed — check the connection and try again.';
		};
		progress = 0;
		xhr.send(file);
	}
</script>

<label
	class="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-rule text-[14px] font-medium text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent {progress !==
	null
		? 'pointer-events-none opacity-60'
		: ''}"
>
	{progress === null ? label : `Uploading… ${Math.round(progress * 100)}%`}
	<input
		bind:this={input}
		type="file"
		{accept}
		class="sr-only"
		disabled={progress !== null}
		onchange={(e) => {
			const file = e.currentTarget.files?.[0];
			if (file) upload(file);
		}}
	/>
</label>
{#if progress !== null}
	<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
		<div class="h-full bg-accent transition-[width]" style="width: {progress * 100}%"></div>
	</div>
{/if}
{#if message}
	<p class="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{message}</p>
{/if}
```

In `src/routes/figures/[id]/+page.svelte` replace the `RecordingUpload` import with `import UploadButton from '$lib/components/ui/UploadButton.svelte';` and the usage with:

```svelte
<UploadButton
	url="/api/figures/{figure.id}/recordings"
	accept="video/*,audio/*"
	label="+ Add video or audio"
/>
```

Then `git rm src/lib/components/figures/RecordingUpload.svelte`.

- [ ] **Step 3: Song audio endpoints.** `src/routes/api/songs/+server.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	MAX_RECORDING_LABEL,
	TooLargeError,
	audioDir,
	extensionFor,
	saveStream
} from '$lib/server/files';
import { createSongFromUpload } from '$lib/server/songs';
import { STYLES, type Style } from '$lib/labels';
import type { RequestHandler } from './$types';

/** Upload a song file from the browser. Raw body, streamed — see the recordings endpoint. */
export const POST: RequestHandler = async ({ request }) => {
	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!mime.startsWith('audio/')) throw error(415, 'Only audio files can be added.');
	if (Number(request.headers.get('content-length') ?? 0) > MAX_RECORDING_BYTES) {
		throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
	}
	if (!request.body) throw error(400, 'Empty upload.');

	const name = decodeURIComponent(request.headers.get('x-filename') ?? '');
	const styleHeader = request.headers.get('x-style') ?? 'salsa';
	const style: Style = (STYLES as readonly string[]).includes(styleHeader)
		? (styleHeader as Style)
		: 'salsa';
	const file = `${randomUUID()}.${extensionFor(mime, name)}`;
	const path = join(audioDir(), file);

	let bytes: number;
	try {
		bytes = await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
		throw error(400, 'The upload was interrupted. Try again.');
	}
	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, 'Empty upload.');
	}

	const title = name.replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, 200);
	const song = createSongFromUpload(getDb(), { file, mime, title, style });
	return json({ id: song.id }, { status: 201 });
};
```

`src/routes/audio/[file]/+server.ts`:

```ts
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { AUDIO_FILE_RE, audioDir, serveFile } from '$lib/server/files';
import { getSongByAudioFile } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/** Song audio for the browser, with Range. Session-guarded like every non-public path. */
export const GET: RequestHandler = ({ params, request }) => {
	if (!AUDIO_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const song = getSongByAudioFile(getDb(), params.file);
	if (!song?.mime) throw error(404, 'Not found');
	return serveFile(join(audioDir(), params.file), song.mime, request);
};
```

- [ ] **Step 4: Nav tab** — in `src/lib/components/shell/BottomNav.svelte` add a third entry to `TABS`:

```ts
		{ href: '/songs' as const, label: 'Songs', match: (p: string) => p.startsWith('/songs') }
```

- [ ] **Step 5: Library page.** `src/routes/songs/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText } from '$lib/server/form';
import { createSongFromUrl, listSongs, retrySong } from '$lib/server/songs';
import { STYLES } from '$lib/labels';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ songs: listSongs(getDb()) });

function httpUrl(raw: string): string | null {
	try {
		const u = new URL(raw.trim());
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	addUrl: async ({ request }) => {
		const form = await request.formData();
		const url = httpUrl(String(form.get('url') ?? ''));
		const title = optionalText(form, 'title', 200);
		const style = oneOf(form, 'style', STYLES) ?? 'salsa';
		if (!url || title === undefined) {
			return fail(400, {
				message: 'Paste a full link, starting with https://',
				url: String(form.get('url') ?? '')
			});
		}
		createSongFromUrl(getDb(), { url, title: title ?? '', style });
		return { ok: true };
	},

	retry: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!retrySong(getDb(), id)) return fail(404, { message: 'That song no longer exists.' });
		return { ok: true };
	}
};
```

`src/routes/songs/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import { clock } from '$lib/format';
	import { STYLES, STYLE_LABEL } from '$lib/labels';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);

	const STATUS: Record<string, string> = {
		waiting_download: 'Waiting for the home fetcher',
		waiting_analysis: 'Waiting for beat analysis',
		ready: '',
		failed: 'Failed'
	};

	/*
	 * The worker runs at home once a minute, so a waiting song changes state on
	 * its own. Poll only while something is waiting.
	 */
	const waiting = $derived(data.songs.some((s) => s.status.startsWith('waiting')));
	$effect(() => {
		if (!waiting) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});
</script>

<svelte:head><title>Songs · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<h1 class="text-[17px] font-semibold">Songs</h1>
</header>

<main class="space-y-5 px-4 pt-4 pb-4">
	<form
		method="POST"
		action="?/addUrl"
		class="space-y-2 rounded-xl border border-line bg-raised p-3"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<label for="url" class="block text-[12px] font-medium text-ink-2">Add from YouTube</label>
		<input
			id="url"
			name="url"
			type="url"
			inputmode="url"
			required
			placeholder="https://www.youtube.com/watch?v=…"
			value={form?.url ?? ''}
			class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
		/>
		<div class="flex gap-2">
			<input
				name="title"
				maxlength="200"
				placeholder="Title (optional)"
				aria-label="Title (optional)"
				class="min-w-0 flex-1 rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
			/>
			<select
				name="style"
				aria-label="Style"
				class="rounded-lg border border-rule bg-raised px-2 text-[15px]"
			>
				{#each STYLES as s (s)}<option value={s}>{STYLE_LABEL[s]}</option>{/each}
			</select>
		</div>
		{#if form?.message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{form.message}
			</p>
		{/if}
		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
			>Add song</button
		>
	</form>

	<UploadButton url="/api/songs" accept="audio/*" label="+ Upload an audio file" />

	{#if data.songs.length === 0}
		<p class="text-center text-[14px] text-muted">No songs yet.</p>
	{/if}
	<ul class="space-y-2">
		{#each data.songs as s (s.id)}
			<li class="rounded-xl border border-line bg-raised">
				<a href={resolve('/songs/[id]', { id: String(s.id) })} class="block px-4 py-3">
					<span class="block truncate text-[15px] font-medium">{s.title || s.sourceUrl}</span>
					<span class="text-[12px] {s.status === 'failed' ? 'text-danger' : 'text-muted'}">
						{STYLE_LABEL[s.style]}
						{#if s.status === 'ready'}
							· {s.bpm ? `${Math.round(s.bpm * s.tempoFactor)} BPM` : ''}
							{s.durationS ? `· ${clock(s.durationS)}` : ''}
						{:else}
							· {STATUS[s.status]}{s.error ? `: ${s.error}` : ''}
						{/if}
					</span>
				</a>
				{#if s.status === 'failed'}
					<form method="POST" action="?/retry" use:enhance class="border-t border-line px-4 py-2">
						<input type="hidden" name="id" value={s.id} />
						<button type="submit" class="text-[14px] font-medium text-accent">Retry</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
	{#if waiting}
		<p class="text-center text-[12px] text-muted">
			Downloads and beat analysis run on the laptop at home, about once a minute while it is on.
		</p>
	{/if}
</main>
```

- [ ] **Step 6: Live count component** — `src/lib/components/songs/LiveCount.svelte`:

```svelte
<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';

	interface Props {
		audio: HTMLAudioElement | undefined;
		beats: number[];
		counts: number[];
	}

	let { audio, beats, counts }: Props = $props();
	let index = $state(-1);

	/*
	 * Read the playhead every animation frame. `timeupdate` fires only ~4 times
	 * a second, far too coarse to show a count that changes 3 times a second.
	 */
	$effect(() => {
		const el = audio;
		if (!el) return;
		let frame = 0;
		const tick = () => {
			index = beatIndexAt(beats, el.currentTime);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	const count = $derived(index >= 0 ? counts[index] : null);
</script>

<div class="text-center" aria-live="off">
	<div
		class="text-[88px] leading-none font-bold tabular-nums {count === 1
			? 'text-accent'
			: count === 5
				? 'text-ink'
				: 'text-ink-2'}"
	>
		{count ?? '–'}
	</div>
	<div class="mt-3 flex justify-center gap-1.5" aria-hidden="true">
		{#each [1, 2, 3, 4, 5, 6, 7, 8] as n (n)}
			<span
				class="size-3 rounded-full {n === count
					? n === 1
						? 'bg-accent'
						: 'bg-ink'
					: n === 4 || n === 8
						? 'bg-line'
						: 'bg-rule'}"
			></span>
		{/each}
	</div>
</div>
```

- [ ] **Step 7: Song page server** — `src/routes/songs/[id]/+page.server.ts`:

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText, text } from '$lib/server/form';
import {
	archiveSong,
	getSong,
	retrySong,
	setAnchors,
	setTempoFactor,
	updateSongMeta
} from '$lib/server/songs';
import {
	TAP_LATENCY_S,
	addAnchor,
	buildGrid,
	nearestBeat,
	removeAnchor,
	scaleBeats
} from '$lib/beatgrid/beatgrid';
import { STYLES, TEMPO_FACTORS, type TempoFactor } from '$lib/labels';
import type { Actions, PageServerLoad } from './$types';

function load_(id: string) {
	const song = getSong(getDb(), Number(id));
	if (!song || song.archivedAt !== null) throw error(404, 'Song not found');
	return song;
}

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ params }) => {
	const song = load_(params.id);
	const anchors = parse(song.anchorsJson);
	const grid =
		song.status === 'ready'
			? buildGrid({
					beats: parse(song.beatsJson),
					downbeats: parse(song.downbeatsJson),
					anchors,
					tempoFactor: song.tempoFactor as TempoFactor
				})
			: null;
	return { song, anchors, grid };
};

export const actions: Actions = {
	/** A tap on "the 1" at playhead time `t`, snapped to the nearest beat after reaction-time compensation. */
	tap: async ({ params, request }) => {
		const song = load_(params.id);
		const t = Number((await request.formData()).get('t'));
		if (!Number.isFinite(t) || song.status !== 'ready') return fail(400, { message: 'Play the song first.' });
		const beats = scaleBeats(parse(song.beatsJson), song.tempoFactor as TempoFactor);
		const i = nearestBeat(beats, t - TAP_LATENCY_S);
		if (i < 0) return fail(400, { message: 'No beats to snap to.' });
		setAnchors(getDb(), song.id, addAnchor(parse(song.anchorsJson), i));
		return { ok: true };
	},

	removeAnchor: async ({ params, request }) => {
		const song = load_(params.id);
		const i = Number((await request.formData()).get('beat'));
		setAnchors(getDb(), song.id, removeAnchor(parse(song.anchorsJson), i));
		return { ok: true };
	},

	resetAnchors: ({ params }) => {
		setAnchors(getDb(), load_(params.id).id, []);
		return { ok: true };
	},

	tempo: async ({ params, request }) => {
		const song = load_(params.id);
		const f = Number((await request.formData()).get('factor'));
		if (!(TEMPO_FACTORS as readonly number[]).includes(f)) return fail(400, { message: 'Bad tempo.' });
		setTempoFactor(getDb(), song.id, f as TempoFactor);
		return { ok: true };
	},

	update: async ({ params, request }) => {
		const song = load_(params.id);
		const form = await request.formData();
		const title = text(form, 'title');
		const artist = optionalText(form, 'artist', 200);
		const style = oneOf(form, 'style', STYLES);
		if (!title || artist === undefined || !style) {
			return fail(400, { message: 'Give the song a title (up to 200 characters).' });
		}
		updateSongMeta(getDb(), song.id, { title, artist, style });
		return { ok: true };
	},

	retry: ({ params }) => {
		retrySong(getDb(), load_(params.id).id);
		return { ok: true };
	},

	archive: ({ params }) => {
		archiveSong(getDb(), load_(params.id).id, Date.now());
		throw redirect(303, '/songs');
	}
};
```

- [ ] **Step 8: Song page** — `src/routes/songs/[id]/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { clock } from '$lib/format';
	import { STYLES, STYLE_LABEL, TEMPO_FACTORS, TEMPO_LABEL } from '$lib/labels';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let tapped = $state(false);

	const song = $derived(data.song);
	const grid = $derived(data.grid);

	$effect(() => {
		if (!song.status.startsWith('waiting')) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>{song.title || 'Song'} · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/songs')}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to songs">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">
		{song.title || song.sourceUrl}
	</h1>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if grid && song.audioFile}
		<!-- preload=auto: the count needs the playhead to be accurate from the first tap. -->
		<audio bind:this={audio} src="/audio/{song.audioFile}" controls preload="auto" class="w-full"
		></audio>

		<LiveCount {audio} beats={grid.beats} counts={grid.counts} />

		<form
			method="POST"
			action="?/tap"
			use:enhance={({ formData }) => {
				formData.set('t', String(audio?.currentTime ?? 0));
				return async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						tapped = true;
						setTimeout(() => (tapped = false), 600);
					}
				};
			}}
		>
			<button
				type="submit"
				class="h-20 w-full rounded-2xl text-[20px] font-bold {tapped
					? 'bg-done-bg text-done'
					: 'bg-accent text-accent-ink'}">{tapped ? 'Got it' : 'Tap on the 1'}</button
			>
		</form>

		<p class="text-center text-[13px] text-muted">
			{#if grid.suggested}
				The count is a guess. Play the song and tap on every "1" you hear until it lines up.
			{:else}
				If the count slips after a break, tap the 1 again there.
			{/if}
			{#if grid.bpm}· {Math.round(grid.bpm)} BPM{/if}
		</p>

		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Count speed</h2>
			<div class="flex gap-2">
				{#each TEMPO_FACTORS as f (f)}
					<form method="POST" action="?/tempo" use:enhance class="flex-1">
						<input type="hidden" name="factor" value={f} />
						<button
							type="submit"
							aria-pressed={song.tempoFactor === f}
							class="h-11 w-full rounded-lg border text-[15px] {song.tempoFactor === f
								? 'border-accent bg-accent text-accent-ink'
								: 'border-rule bg-raised text-ink-2'}">{TEMPO_LABEL[f]}</button
						>
					</form>
				{/each}
			</div>
			<p class="mt-1 text-[12px] text-muted">
				If the count runs at half or double your steps, switch it. This clears your taps.
			</p>
		</section>

		{#if data.anchors.length > 0}
			<section>
				<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Your 1s</h2>
				<ul class="divide-y divide-line rounded-xl border border-line bg-raised">
					{#each data.anchors as beat (beat)}
						<li class="flex items-center justify-between px-3 py-2 text-[14px]">
							<span class="tabular-nums">{clock(grid.beats[beat] ?? 0)}</span>
							<form method="POST" action="?/removeAnchor" use:enhance>
								<input type="hidden" name="beat" value={beat} />
								<button type="submit" class="h-9 px-2 text-[13px] text-danger">Remove</button>
							</form>
						</li>
					{/each}
				</ul>
				<form method="POST" action="?/resetAnchors" use:enhance class="mt-2">
					<button type="submit" class="text-[13px] text-muted underline">Clear all</button>
				</form>
			</section>
		{/if}
	{:else}
		<section class="rounded-xl border border-line bg-raised p-4 text-[14px]">
			{#if song.status === 'waiting_download'}
				<p>Waiting for the home fetcher to download this song.</p>
				<p class="mt-1 text-[12px] text-muted">It runs on the laptop about once a minute while it is on.</p>
			{:else if song.status === 'waiting_analysis'}
				<p>Waiting for beat analysis on the laptop.</p>
			{:else}
				<p class="text-danger">This song failed: {song.error ?? 'unknown error'}</p>
				<form method="POST" action="?/retry" use:enhance class="mt-3">
					<button type="submit" class="h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
						>Retry</button
					>
				</form>
				<p class="mt-2 text-[12px] text-muted">
					Or upload the audio file from the <a href={resolve('/songs')} class="text-accent">Songs</a> page.
				</p>
			{/if}
		</section>
	{/if}

	{#if form?.message}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{form.message}</p>
	{/if}

	<details class="rounded-xl border border-line">
		<summary class="cursor-pointer px-3 py-3 text-[14px] font-medium">Song details</summary>
		<form method="POST" action="?/update" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-3 px-3 pb-3">
			<input name="title" required maxlength="200" value={song.title} aria-label="Title" placeholder="Title" class={field} />
			<input name="artist" maxlength="200" value={song.artist ?? ''} aria-label="Artist" placeholder="Artist" class={field} />
			<select name="style" value={song.style} aria-label="Style" class={field}>
				{#each STYLES as s (s)}<option value={s}>{STYLE_LABEL[s]}</option>{/each}
			</select>
			<button type="submit" class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium">Save</button>
		</form>
		{#if song.sourceUrl}
			<p class="truncate px-3 pb-3 text-[12px] text-muted">From {song.sourceUrl}</p>
		{/if}
		<form
			method="POST"
			action="?/archive"
			class="border-t border-line px-3 py-3"
			onsubmit={(e) => {
				if (!confirm('Archive this song?')) e.preventDefault();
			}}
		>
			<button type="submit" class="text-[14px] text-danger">Archive song</button>
		</form>
	</details>
</main>
```

- [ ] **Step 9: Check** — `nix develop --command bash -c "npx prettier --write src && npm run check"`. Expected: clean. (Prettier will reflow the long lines above.)

- [ ] **Step 10: End-to-end by hand, local.** Dev server with `SALSA_WORKER_TOKEN=devtoken`. In the browser at phone width (iframe trick: on any app page run `document.documentElement.innerHTML = '<iframe src="/songs" style="width:390px;height:780px;border:0">'` via the Chrome tool, since the window manager ignores resizes):
  1. Upload a short audio file on /songs → a row "Waiting for beat analysis".
  2. Play the worker by hand with curl (Task 4 Step 7 commands: claim, then POST an analysis of `beats` every 0.5 s for the clip length). The list flips to ready within 10 s without a reload.
  3. Open the song: the count runs with the audio; tap on a beat → "Got it", an entry appears under "Your 1s", and the count shows 1 on that beat; ×2 doubles the BPM and clears the taps.
  4. Paste a YouTube URL → "Waiting for the home fetcher".

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "songs UI: library, uploads, song page with live count and tap-the-1

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 6: The home worker (Python) and its Nix package

**Files:**
- Create: `worker/pyproject.toml`
- Create: `worker/salsa_worker/__init__.py` (empty), `api.py`, `media.py`, `jobs.py`, `__main__.py`
- Create: `worker/tests/test_jobs.py`, `worker/tests/test_media.py`
- Modify: `flake.nix`, `flake.lock`

**Interfaces:**
- Consumes: the HTTP contract from Task 4 (exact paths, headers and bodies listed there).
- Produces:
  - Nix: `packages.x86_64-linux.salsa-worker` (binary `salsa-worker`), `packages.x86_64-linux.beat-this`, `packages.x86_64-linux.beat-this-checkpoint`, `checks.x86_64-linux.worker`.
  - Runtime env: `SALSA_URL` (e.g. `https://salsa.anotherroot.eu`), `SALSA_WORKER_TOKEN`, `BEAT_THIS_CHECKPOINT` (defaulted by the Nix wrapper to the pinned `final0.ckpt`).
  - Python: `media.PermanentError`, `media.Fetched(path, title, duration)`, `media.fetch(url, workdir, run=subprocess.run)`, `media.to_wav(src, dest, run=…)`, `media.duration_of(path, run=…)`, `media.Analyzer(checkpoint)`, `jobs.process(job, api, tools, workdir)`, `jobs.run(api, tools, max_jobs=20) -> int`, `jobs.Tools(fetch, to_wav, duration_of, analyze)`.

- [ ] **Step 1: Package metadata** — `worker/pyproject.toml`:

```toml
[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"

[project]
name = "salsa-worker"
version = "0.1.0"
description = "salsaapp home worker: fetch songs, find their beats"
requires-python = ">=3.11"

[project.scripts]
salsa-worker = "salsa_worker.__main__:main"

[tool.setuptools.packages.find]
include = ["salsa_worker*"]
```

Create `worker/salsa_worker/__init__.py` as an empty file.

- [ ] **Step 2: Write the failing tests** — `worker/tests/test_media.py`:

```python
import subprocess
from pathlib import Path

import pytest

from salsa_worker import media


def fake_run(returncode=0, stdout="", stderr="", make=None):
    calls = []

    def run(cmd, **kwargs):
        calls.append(cmd)
        if make:
            make.write_bytes(b"m4a")
        return subprocess.CompletedProcess(cmd, returncode, stdout, stderr)

    run.calls = calls
    return run


def test_fetch_reads_title_and_duration(tmp_path: Path):
    run = fake_run(stdout="Vivir Mi Vida\t327\n", make=tmp_path / "audio.m4a")
    got = media.fetch("https://youtu.be/x", tmp_path, run=run)
    assert got == media.Fetched(tmp_path / "audio.m4a", "Vivir Mi Vida", 327.0)
    cmd = run.calls[0]
    # --print implies --simulate unless told otherwise: without this nothing downloads.
    assert "--no-simulate" in cmd
    assert "duration <= 900" in cmd


def test_fetch_filtered_out_is_permanent(tmp_path: Path):
    with pytest.raises(media.PermanentError, match="15 minutes"):
        media.fetch("https://youtu.be/x", tmp_path, run=fake_run(stdout=""))


@pytest.mark.parametrize(
    "stderr, permanent",
    [
        ("ERROR: [youtube] x: Video unavailable", True),
        ("ERROR: [youtube] x: Private video. Sign in", True),
        ("ERROR: Unsupported URL: https://example.com", True),
        ("ERROR: Unable to download webpage: <urlopen error timed out>", False),
        ("ERROR: [youtube] x: Sign in to confirm you're not a bot", False),
    ],
)
def test_fetch_classifies_errors(tmp_path: Path, stderr, permanent):
    kind = media.PermanentError if permanent else RuntimeError
    with pytest.raises(kind) as e:
        media.fetch("https://youtu.be/x", tmp_path, run=fake_run(returncode=1, stderr=stderr))
    assert type(e.value) is kind
    assert stderr.splitlines()[-1] in str(e.value)


def test_duration_of_parses_ffprobe(tmp_path: Path):
    assert media.duration_of(tmp_path / "a.wav", run=fake_run(stdout="12.5\n")) == 12.5
```

`worker/tests/test_jobs.py`:

```python
from pathlib import Path

from salsa_worker import jobs, media


class FakeApi:
    def __init__(self, queue):
        self.queue = list(queue)
        self.calls = []

    def claim(self):
        return self.queue.pop(0) if self.queue else None

    def download_audio(self, song_id, dest: Path):
        self.calls.append(("download_audio", song_id))
        dest.write_bytes(b"mp3")

    def upload_audio(self, song_id, path, mime, title, duration):
        self.calls.append(("upload_audio", song_id, mime, title, duration))

    def post_analysis(self, song_id, beats, downbeats, duration):
        self.calls.append(("post_analysis", song_id, beats, downbeats, duration))

    def fail(self, song_id, error, permanent):
        self.calls.append(("fail", song_id, error, permanent))


def tools(fetch=None, analyze=None):
    def default_fetch(url, workdir):
        p = workdir / "audio.m4a"
        p.write_bytes(b"m4a")
        return media.Fetched(p, "Title", 200.0)

    return jobs.Tools(
        fetch=fetch or default_fetch,
        to_wav=lambda src, dest: dest.write_bytes(b"wav"),
        duration_of=lambda path: 42.0,
        analyze=analyze or (lambda wav: ([0.5, 1.0], [0.5])),
    )


def test_download_job_uploads_then_analyses(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 7, "kind": "download", "url": "https://y"}, api, tools(), tmp_path)
    assert api.calls == [
        ("upload_audio", 7, "audio/mp4", "Title", 200.0),
        ("post_analysis", 7, [0.5, 1.0], [0.5], 200.0),
    ]


def test_analyze_job_fetches_audio_from_the_server(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 3, "kind": "analyze", "url": None}, api, tools(), tmp_path)
    assert api.calls == [("download_audio", 3), ("post_analysis", 3, [0.5, 1.0], [0.5], 42.0)]


def test_permanent_error_fails_the_song_for_good(tmp_path):
    def fetch(url, workdir):
        raise media.PermanentError("Video unavailable")

    api = FakeApi([])
    jobs.process({"id": 1, "kind": "download", "url": "u"}, api, tools(fetch=fetch), tmp_path)
    assert api.calls == [("fail", 1, "Video unavailable", True)]


def test_other_errors_are_retried(tmp_path):
    def analyze(wav):
        raise MemoryError("out of memory")

    api = FakeApi([])
    jobs.process({"id": 1, "kind": "analyze", "url": None}, api, tools(analyze=analyze), tmp_path)
    assert api.calls[-1] == ("fail", 1, "MemoryError: out of memory", False)


def test_run_drains_the_queue_and_counts(tmp_path):
    api = FakeApi([{"id": 1, "kind": "analyze", "url": None}, {"id": 2, "kind": "analyze", "url": None}])
    assert jobs.run(api, tools()) == 2
    assert jobs.run(api, tools()) == 0


def test_run_stops_at_max_jobs():
    api = FakeApi([{"id": i, "kind": "analyze", "url": None} for i in range(5)])
    assert jobs.run(api, tools(), max_jobs=3) == 3
```

- [ ] **Step 3: Add the Nix packaging (so the tests can run)** — edit `flake.nix`:

1. Add the input: `nixpkgs-unstable.url = "github:nixos/nixpkgs?ref=nixos-unstable";` and add `nixpkgs-unstable` to the `outputs` argument set.
2. In the `let` block, after `pkgs = …`, add:

```nix
        # yt-dlp only: YouTube breaks old releases within weeks, and the stable
        # channel lags by months. Used as a binary, so its Python never meets
        # the worker's (torch) Python.
        unstable = import nixpkgs-unstable { inherit system; };
        py = pkgs.python3Packages;

        beat-this = py.buildPythonPackage {
          pname = "beat-this";
          version = "1.1.0";
          pyproject = true;
          src = pkgs.fetchFromGitHub {
            owner = "CPJKU";
            repo = "beat_this";
            rev = "b95c8ab0c58c2d9fcfd40508ae8dffbc05ac4f5c";
            hash = "sha256-bya9HP7oCq4AnTSKOkMfPnzVLlHnFhwH24AkgtlaB8Y=";
          };
          build-system = [ py.setuptools ];
          dependencies = with py; [
            numpy
            torch
            torchaudio
            einops
            rotary-embedding-torch
            soxr
            # Its audio loader falls back through madmom and torchcodec; soundfile
            # is the one that reads the WAV the worker hands it.
            soundfile
          ];
          doCheck = false;
          pythonImportsCheck = [ "beat_this.inference" ];
        };

        # Pinned model weights, so the worker never downloads at runtime (and a
        # DynamicUser service has nowhere sensible to cache them anyway).
        beat-this-checkpoint = pkgs.fetchurl {
          url = "https://cloud.cp.jku.at/public.php/dav/files/7ik4RrBKTS273gp/final0.ckpt";
          hash = "sha256-jDKLRfWdjdPf8hklP/ao1kgr5X0BM6KRQOL+u/jrgzE=";
        };

        salsa-worker = py.buildPythonApplication {
          pname = "salsa-worker";
          version = "0.1.0";
          pyproject = true;
          src = ./worker;
          build-system = [ py.setuptools ];
          dependencies = [ beat-this ];
          nativeCheckInputs = [ py.pytestCheckHook ];
          makeWrapperArgs = [
            "--prefix" "PATH" ":" (pkgs.lib.makeBinPath [ pkgs.ffmpeg-headless unstable.yt-dlp ])
            "--set-default" "BEAT_THIS_CHECKPOINT" "${beat-this-checkpoint}"
          ];
        };
```

3. Next to `devShells.default`, add:

```nix
        packages = {
          inherit beat-this beat-this-checkpoint salsa-worker;
          default = salsa-worker;
        };
        # Building the package runs the worker's pytest suite.
        checks.worker = salsa-worker;
```

- [ ] **Step 4: Run to verify the tests fail**

Run: `git add -A worker flake.nix && nix flake lock && nix build .#checks.x86_64-linux.worker -L 2>&1 | tail -20`
Expected: FAIL in `pytestCheckPhase` — `ImportError: cannot import name 'media'` (modules not written yet). (Torch comes from the binary cache; first build downloads ~2 GB.)

- [ ] **Step 5: Implement** — `worker/salsa_worker/media.py`:

```python
"""Everything that touches media: yt-dlp, ffmpeg, Beat This!. Subprocess runners are injectable for tests."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

# Matches the server's rule: longer songs are refused rather than stored.
MAX_DURATION_S = 900

# yt-dlp messages that no retry will fix. Everything else (network, the bot
# check, a YouTube change fixed by the next yt-dlp) is treated as transient.
PERMANENT_MARKERS = (
    "Video unavailable",
    "Private video",
    "Unsupported URL",
    "is not a valid URL",
    "This video is not available",
    "members-only",
    "Sign in to confirm your age",
)


class PermanentError(Exception):
    """A failure that retrying will not fix; the song is marked failed."""


@dataclass(frozen=True)
class Fetched:
    path: Path
    title: str | None
    duration: float | None


def _last_line(text: str) -> str:
    lines = [line for line in text.strip().splitlines() if line.strip()]
    return lines[-1] if lines else "unknown error"


def fetch(url: str, workdir: Path, run=subprocess.run) -> Fetched:
    """Download the best audio as AAC in workdir/audio.m4a (~128 kbit/s, ~5 MB a song).

    AAC rather than Opus: Ogg Opus does not play in Safari on older iPhones,
    and every browser plays AAC. The re-encode from YouTube's Opus is inaudible
    for dancing to.
    """
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "m4a", "--audio-quality", "128K",
        "--match-filter", f"duration <= {MAX_DURATION_S}",
        "-o", str(workdir / "audio.%(ext)s"),
        # --print implies --simulate; without --no-simulate nothing is downloaded.
        "--no-simulate",
        "--print", "after_move:%(title)s\t%(duration)s",
        url,
    ]
    p = run(cmd, capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        msg = _last_line(p.stderr)
        if any(m in p.stderr for m in PERMANENT_MARKERS):
            raise PermanentError(msg)
        raise RuntimeError(msg)

    path = workdir / "audio.m4a"
    if not path.exists():
        # The duration filter skips silently, with exit code 0 and no output.
        raise PermanentError("Longer than 15 minutes, or nothing to download.")
    title, _, duration = _last_line(p.stdout).partition("\t") if p.stdout.strip() else ("", "", "")
    try:
        seconds = float(duration)
    except ValueError:
        seconds = None
    return Fetched(path, title or None, seconds)


def to_wav(src: Path, dest: Path, run=subprocess.run) -> None:
    """Mono 22.05 kHz WAV: what Beat This! resamples to anyway, and what its loader can read."""
    p = run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "22050", str(dest)],
        capture_output=True,
        text=True,
        timeout=300,
    )
    if p.returncode != 0:
        raise PermanentError(f"Could not decode the audio: {_last_line(p.stderr)}")


def duration_of(path: Path, run=subprocess.run) -> float:
    p = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return float(p.stdout.strip())


class Analyzer:
    """Beat This! on CPU. The model loads on first use, so a run with no jobs never imports torch."""

    def __init__(self, checkpoint: str):
        self.checkpoint = checkpoint
        self._model = None

    def __call__(self, wav: Path) -> tuple[list[float], list[float]]:
        if self._model is None:
            import torch

            # Two of laptop's cores: it also runs Immich.
            torch.set_num_threads(2)
            from beat_this.inference import File2Beats

            self._model = File2Beats(checkpoint_path=self.checkpoint, device="cpu", dbn=False)
        beats, downbeats = self._model(str(wav))
        return [float(b) for b in beats], [float(d) for d in downbeats]
```

`worker/salsa_worker/api.py`:

```python
"""The server's /api/worker contract (see src/routes/api/worker in the app). stdlib only."""

from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class ApiError(Exception):
    pass


class Api:
    def __init__(self, base_url: str, token: str, urlopen=urllib.request.urlopen):
        self.base = base_url.rstrip("/")
        self.token = token
        self._urlopen = urlopen

    def _request(self, method: str, path: str, data=None, headers=None, timeout: int = 60):
        req = urllib.request.Request(
            self.base + path,
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", **(headers or {})},
        )
        try:
            return self._urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            raise ApiError(f"{method} {path}: HTTP {e.code} {e.read()[:200]!r}") from e

    def claim(self) -> dict | None:
        with self._request("POST", "/api/worker/claim", data=b"") as r:
            return None if r.status == 204 else json.load(r)

    def download_audio(self, song_id: int, dest: Path) -> None:
        with self._request("GET", f"/api/worker/songs/{song_id}/audio", timeout=300) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f)

    def upload_audio(self, song_id: int, path: Path, mime: str, title: str | None, duration: float | None) -> None:
        headers = {"Content-Type": mime, "Content-Length": str(path.stat().st_size)}
        if title:
            headers["x-title"] = urllib.parse.quote(title)
        if duration:
            headers["x-duration"] = str(duration)
        with open(path, "rb") as f:
            self._request("PUT", f"/api/worker/songs/{song_id}/audio", data=f, headers=headers, timeout=600).close()

    def _json(self, path: str, body: dict) -> None:
        data = json.dumps(body).encode()
        self._request("POST", path, data=data, headers={"Content-Type": "application/json"}).close()

    def post_analysis(self, song_id: int, beats: list[float], downbeats: list[float], duration: float) -> None:
        self._json(
            f"/api/worker/songs/{song_id}/analysis",
            {"beats": beats, "downbeats": downbeats, "durationS": duration},
        )

    def fail(self, song_id: int, error: str, permanent: bool) -> None:
        self._json(f"/api/worker/songs/{song_id}/fail", {"error": error[:500], "permanent": permanent})
```

`worker/salsa_worker/jobs.py`:

```python
"""One job end to end, and the drain loop. All I/O is passed in, so this is testable without torch or a network."""

from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .media import Fetched, PermanentError

log = logging.getLogger("salsa_worker")


@dataclass(frozen=True)
class Tools:
    fetch: Callable[[str, Path], Fetched]
    to_wav: Callable[[Path, Path], None]
    duration_of: Callable[[Path], float]
    analyze: Callable[[Path], tuple[list[float], list[float]]]


def process(job: dict, api, tools: Tools, workdir: Path) -> None:
    """Download (if needed), analyse, report. Failures are reported, never raised."""
    song_id = job["id"]
    try:
        duration: float | None = None
        if job["kind"] == "download":
            fetched = tools.fetch(job["url"], workdir)
            # Upload first: once the server has the audio, a crash during
            # analysis only costs a re-analysis, not a re-download.
            api.upload_audio(song_id, fetched.path, "audio/mp4", fetched.title, fetched.duration)
            audio, duration = fetched.path, fetched.duration
        else:
            audio = workdir / "source"
            api.download_audio(song_id, audio)

        wav = workdir / "analysis.wav"
        tools.to_wav(audio, wav)
        if duration is None:
            duration = tools.duration_of(wav)
        beats, downbeats = tools.analyze(wav)
        api.post_analysis(song_id, beats, downbeats, duration)
        log.info("song %s: %d beats", song_id, len(beats))
    except PermanentError as e:
        log.warning("song %s failed for good: %s", song_id, e)
        api.fail(song_id, str(e), True)
    except Exception as e:  # noqa: BLE001 — anything else is worth another try
        log.exception("song %s failed, will retry", song_id)
        api.fail(song_id, f"{type(e).__name__}: {e}", False)


def run(api, tools: Tools, max_jobs: int = 20) -> int:
    """Claim and process jobs until the queue is empty. Returns how many were processed."""
    done = 0
    while done < max_jobs:
        job = api.claim()
        if job is None:
            break
        with tempfile.TemporaryDirectory(prefix="salsa-") as tmp:
            process(job, api, tools, Path(tmp))
        done += 1
    return done
```

`worker/salsa_worker/__main__.py`:

```python
"""Entry point for the systemd timer: drain the queue once, then exit."""

import logging
import os
import sys

from . import jobs, media
from .api import Api


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", stream=sys.stdout)
    try:
        api = Api(os.environ["SALSA_URL"], os.environ["SALSA_WORKER_TOKEN"])
        checkpoint = os.environ["BEAT_THIS_CHECKPOINT"]
    except KeyError as e:
        logging.error("missing environment variable %s", e)
        return 2

    tools = jobs.Tools(
        fetch=media.fetch,
        to_wav=media.to_wav,
        duration_of=media.duration_of,
        analyze=media.Analyzer(checkpoint),
    )
    try:
        n = jobs.run(api, tools)
    except Exception:  # server unreachable, laptop offline: the next tick tries again
        logging.exception("could not reach the server")
        return 1
    if n:
        logging.info("processed %d job(s)", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run to verify the tests pass**

Run: `git add -A worker && nix build .#checks.x86_64-linux.worker -L 2>&1 | grep -E "passed|failed|error" | tail -5`
Expected: `13 passed`.

- [ ] **Step 7: Smoke-test the real thing on backtop** (home IP, real yt-dlp and model) against the local dev server from Task 5 (running with `SALSA_WORKER_TOKEN=devtoken`):

```bash
nix build .#salsa-worker
# queue a real song through the UI or:
sqlite3 .data/salsa.db "insert into songs (source_url, status, created_at) values ('https://www.youtube.com/watch?v=YXnjy5YlDwk', 'waiting_download', 1)"
SALSA_URL=http://localhost:5190 SALSA_WORKER_TOKEN=devtoken ./result/bin/salsa-worker
sqlite3 .data/salsa.db "select id, title, status, round(bpm,1), json_array_length(beats_json) from songs order by id desc limit 1"
```

Expected: log line `song N: ~450 beats`, then the row shows `Marc Anthony - Vivir Mi Vida (Official Video)|ready|103.x|~560`. Open the song page and check the count moves with the music. Delete `result` afterwards.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "worker: home fetcher/analyser (yt-dlp, ffmpeg, Beat This!) packaged by the flake

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Publish salsaapp to a private GitHub repo

nixos-config consumes the worker as a flake input over SSH, like `tilenkoren`.

- [ ] **Step 1: Ask the user** to create an empty **private** repository `anotherroot/salsaapp` on github.com (no README, no licence, no .gitignore), and wait for confirmation. There is no `gh` CLI on backtop.

- [ ] **Step 2: Push**

```bash
git remote add origin git@github.com:anotherroot/salsaapp.git
git push -u origin master
git ls-remote origin HEAD
```

Expected: the pushed commit hash printed by `ls-remote` equals `git rev-parse HEAD`.

---

### Task 8: Host configuration — worker on laptop, token secret, audio backups

**Files (all in `~/.config/nixos-config`):**
- Modify: `flake.nix` (input), `flake.lock`
- Modify: `secrets/secrets.nix`; Create: `secrets/salsa-worker.env.age`
- Create: `modules/services/salsa-worker.nix`
- Modify: `modules/services/salsa.nix`
- Modify: `modules/hosts/laptop.nix`

**Interfaces:**
- Consumes: `inputs.salsaapp.packages.<system>.salsa-worker` (Task 6), the pushed repo (Task 7).
- Produces: NixOS module `flake.modules.nixos.svc-salsa-worker`; the salsa unit gains `SALSA_WORKER_TOKEN`; `/var/lib/salsa/audio` exists and is backed up off-box.

- [ ] **Step 1: Flake input** — in `flake.nix` inputs, below `tilenkoren.url`:

```nix
    # salsaapp's home worker (salsa-worker package). Private repo, so git+ssh,
    # same reasoning as tilenkoren. Deliberately NOT following our nixpkgs: the
    # worker's torch/Beat This! set is tested against salsaapp's own pin.
    salsaapp.url = "git+ssh://git@github.com/anotherroot/salsaapp";
```

Run: `nix flake update salsaapp` (only that input — do NOT run a bare `nix flake update`, and leave the user's uncommitted `tilenkoren` lock bump alone: `git diff flake.lock` must show only the added `salsaapp` node plus that pre-existing hunk).

- [ ] **Step 2: The token secret** — add to `secrets/secrets.nix` after the salsa-prod line:

```nix
  # salsaapp home worker: SALSA_WORKER_TOKEN, shared by the server (checks it)
  # and laptop (sends it). Machine-to-machine; rotate by re-running the create
  # step in salsaapp's docs/deployment.md.
  "salsa-worker.env.age".publicKeys = admins ++ [
    hosts.cloud
    hosts.laptop
  ];
```

Create it without the token ever being printed:

```bash
cd ~/.config/nixos-config/secrets
umask 077; SRC=$(mktemp)
printf 'SALSA_WORKER_TOKEN=%s\n' "$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48)" > "$SRC"
EDITOR="cp $SRC" agenix -e salsa-worker.env.age
shred -u "$SRC"
agenix -d salsa-worker.env.age | sed 's/=.*/=<hidden>/'   # expect: SALSA_WORKER_TOKEN=<hidden>
git add salsa-worker.env.age
```

- [ ] **Step 3: Server side** — in `modules/services/salsa.nix`:

1. In the top `let`, add:

```nix
  workerSecretFile = ../../secrets/salsa-worker.env.age;
  workerSecretReady = builtins.pathExists workerSecretFile;
```

2. `age.secrets = lib.optionalAttrs secretReady { … }` becomes:

```nix
        age.secrets =
          lib.optionalAttrs secretReady { "salsa-prod-env".file = secretFile; }
          // lib.optionalAttrs workerSecretReady { "salsa-worker-env".file = workerSecretFile; };
```

3. `EnvironmentFile = config.age.secrets."salsa-prod-env".path;` becomes:

```nix
            # The second file carries SALSA_WORKER_TOKEN, which the home worker
            # on laptop presents; without it the worker API refuses everyone.
            EnvironmentFile = [
              config.age.secrets."salsa-prod-env".path
            ] ++ lib.optional workerSecretReady config.age.secrets."salsa-worker-env".path;
```

4. tmpfiles: add `"d /var/lib/salsa/audio 0750 salsa salsa -"`.

5. In the backup script's off-box part, add after the recordings rsync:

```nix
            # Song audio too: an uploaded song exists nowhere else, and a YouTube
            # one may vanish. No --delete, same as recordings.
            install -d -o ${cfg.offsite.owner} -g ${cfg.offsite.group} "$out/audio"
            if [ -d audio ]; then
              rsync -a --chown=${cfg.offsite.owner}:${cfg.offsite.group} audio/ "$out/audio/"
            fi
```

6. In the VM test script, after the recordings assertions add:

```python
          machine.succeed("test -d /var/lib/salsa/audio")
          machine.succeed("echo song > /var/lib/salsa/audio/s.opus")
          machine.succeed("systemctl start salsa-backup.service")
          machine.succeed("test -f /home/alice/Backups/salsa/audio/s.opus")
```

- [ ] **Step 4: The worker module** — `modules/services/salsa-worker.nix`:

```nix
# salsaapp home worker -- runs on laptop (always on, home IP).
#
# YouTube bot-blocks the Hetzner box, so songs are downloaded here and beat
# analysis (PyTorch, ~660 MB peak) runs here too, keeping the server a plain
# Node app. The worker only makes outbound HTTPS calls to salsa.anotherroot.eu
# with a bearer token: nothing at home is exposed. See salsaapp's
# docs/deployment.md.
{ inputs, ... }:
{
  flake.modules.nixos.svc-salsa-worker =
    { config, pkgs, ... }:
    {
      age.secrets."salsa-worker-env".file = ../../secrets/salsa-worker.env.age;

      systemd.services.salsa-worker = {
        description = "salsaapp home worker: download and beat-analyse songs";
        after = [ "network-online.target" ];
        wants = [ "network-online.target" ];
        serviceConfig = {
          Type = "oneshot";
          ExecStart = "${
            inputs.salsaapp.packages.${pkgs.stdenv.hostPlatform.system}.salsa-worker
          }/bin/salsa-worker";
          EnvironmentFile = config.age.secrets."salsa-worker-env".path;
          Environment = [
            "SALSA_URL=https://salsa.anotherroot.eu"
            # yt-dlp's JS runtime and torch want a writable home and cache.
            "HOME=/var/cache/salsa-worker"
            "XDG_CACHE_HOME=/var/cache/salsa-worker"
          ];
          DynamicUser = true;
          CacheDirectory = "salsa-worker";
          PrivateTmp = true;
          NoNewPrivileges = true;
          ProtectSystem = "strict";
          ProtectHome = true;
          # Immich shares this box: stay small and polite.
          MemoryMax = "2G";
          Nice = 10;
          TimeoutStartSec = "30min";
        };
      };

      # OnUnitInactiveSec, not OnUnitActiveSec: the next run starts a minute
      # after the previous one FINISHED, so a long analysis never overlaps itself.
      systemd.timers.salsa-worker = {
        wantedBy = [ "timers.target" ];
        timerConfig = {
          OnBootSec = "2min";
          OnUnitInactiveSec = "1min";
        };
      };
    };
}
```

- [ ] **Step 5: Enable on laptop** — in `modules/hosts/laptop.nix`, add `config.flake.modules.nixos.svc-salsa-worker` to the `modules` list after `config.flake.modules.nixos.workstation`.

- [ ] **Step 6: Build and test**

```bash
cd ~/.config/nixos-config
git add -N modules/services/salsa-worker.nix
nix build .#checks.x86_64-linux.svc-salsa --no-link -L 2>&1 | tail -3        # VM test passes
nix build .#nixosConfigurations.my-hetzner-vm.config.system.build.toplevel --no-link
nix build .#nixosConfigurations.laptop.config.system.build.toplevel --no-link
nix eval --json .#nixosConfigurations.my-hetzner-vm.config.systemd.services.salsa.serviceConfig.EnvironmentFile
```

Expected: VM test passes; both hosts build; the eval shows two paths (`/run/agenix/salsa-prod-env`, `/run/agenix/salsa-worker-env`).

- [ ] **Step 7: Commit** (the module, lock, secret, host and salsa.nix changes — not the user's unrelated `tilenkoren` lock bump if it is still uncommitted; if both hunks are in `flake.lock`, tell the user and ask whether to include theirs):

```bash
git add modules/services/salsa-worker.nix modules/services/salsa.nix modules/hosts/laptop.nix secrets/secrets.nix secrets/salsa-worker.env.age flake.nix
git commit -m "salsa: home worker on laptop, worker token, audio in backups

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Docs, rollout and end-to-end check

- [ ] **Step 1: Docs** — in salsaapp:
  - `CLAUDE.md` layout block: add `src/lib/beatgrid/  PURE beats → dance count (anchors, gaps, tempo factor)` and `worker/  Python home worker (yt-dlp, Beat This!) — runs on laptop, not the server`; add a hard rule: "**The server runs no Python.** Downloads and beat analysis happen on the home worker via `/api/worker/*` (bearer token). The beat grid is the detected beats plus user anchors — never trust the model's downbeats as the count."
  - `docs/deployment.md`: add a "Home worker" section: where it runs (laptop, `salsa-worker.timer`, every minute after the last run), the secret (`salsa-worker.env.age`, readable by cloud and laptop, created with the Task 8 Step 2 commands), how to update it (push salsaapp, then in nixos-config `nix flake update salsaapp`, switch laptop), how to watch it (`journalctl -u salsa-worker -f` on laptop), and that `yt-dlp` breaking means `nix flake update nixpkgs-unstable` in salsaapp. Add `/var/lib/salsa/audio` to the backup description.
  - Commit and push both repos' doc changes (`git push` in salsaapp; nixos-config is committed only).

- [ ] **Step 2: Ask the user for the go-ahead** to (a) switch cloud, (b) deploy the app, (c) switch laptop — and how laptop is normally switched (remotely with `--target-host`, or by the user on laptop). Do not proceed without a yes.

- [ ] **Step 3: Roll out in this order** (the server must know the token before the worker calls it):

```bash
cd ~/.config/nixos-config && REV=$(git rev-parse HEAD)
nixos-rebuild switch --flake "git+file://$PWD?rev=$REV#my-hetzner-vm" --target-host tilen@49.13.76.224 --sudo
cd ~/Projects/salsaapp && nix develop --command ./scripts/deploy.sh prod
# laptop — as agreed in Step 2, e.g.:
# nixos-rebuild switch --flake "git+file://$HOME/.config/nixos-config?rev=$REV#laptop" --target-host tilen@laptop --sudo
```

- [ ] **Step 4: End-to-end in production**
  1. `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://salsa.anotherroot.eu/api/worker/claim` → `401`.
  2. On the site, add `https://www.youtube.com/watch?v=YXnjy5YlDwk` (salsa) and a son song.
  3. On laptop: `systemctl list-timers salsa-worker` shows it scheduled; within ~2 minutes `journalctl -u salsa-worker` shows `song N: … beats`.
  4. The library flips both songs to ready without a reload; the song page plays, the count moves, a tap adds a "1".
  5. `ssh tilen@49.13.76.224 sudo systemctl start salsa-backup` → `/home/tilen/Backups/salsa/audio/` on the server has the m4a files; Syncthing brings them to backtop.
  6. Ask the user to try the song page on the phone and report whether ×1 or ×2 matches their steps on the salsa track (feeds phase 2b defaults).

- [ ] **Step 5: Update the memory file** `~/.claude/projects/-home-tilen-Projects-salsaapp/memory/salsa-app-project.md`: phase 2a deployed, worker on laptop, and which tempo factor the user chose for salsa.
