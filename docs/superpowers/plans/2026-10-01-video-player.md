# Full-screen Video Player and Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen player for figure recordings and lesson videos with ±1 s steps, 0.25–1× speed, mirror, and saved spots — points to jump to and sections that loop.

**Architecture:** A new `video_spots` table owned by exactly one recording or lesson video, reached through four data functions in `src/lib/server/spots.ts` and a flat JSON API at `/api/video-spots`. A pure client module `src/lib/video/spots.ts` holds time formatting, clamping and the loop rule; `ui/VideoPlayer.svelte` is a full-viewport `<dialog>` that uses it, opened from a new **Full screen** button in `ui/VideoFrame.svelte`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind 4, Drizzle ORM on better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-video-player-design.md` — read it first.

## Global Constraints

- Run every command inside the flake: prefix with `nix develop -c` (e.g. `nix develop -c npx vitest run …`). Plain `npx` is not on PATH.
- Data functions take `db` as their first argument; tests use `openDb(':memory:')`. A spec that reaches `getDb()` mocks `$lib/server/db` exactly as `src/routes/[dance]/dance-wall.spec.ts` does. Never set `process.env.DATABASE_PATH`.
- Nothing under `$lib/server` is imported by a component. Row shapes crossing to the client go in `src/lib/types.ts`.
- Spot times are integer milliseconds into the video (`start_ms`, `end_ms`); the media element works in seconds — convert with `msOf` (Task 1).
- The new table may carry CHECKs because it is new. The generated migration must contain only `CREATE TABLE video_spots` and its two `CREATE INDEX` statements — read it before committing.
- A spot label is trimmed, empty becomes null, at most `MAX_SPOT_LABEL = 80` characters.
- A failed load or save shows a short note ("Couldn't load spots" / "Couldn't save") and leaves the list as it was. No optimistic rows.
- Comments and naming match the surrounding code: block comments explain _why_, in full sentences.
- `npm run check` must pass before the last commit.

## Review Focus

1. **Deleting a video that has spots** — must succeed and take its spots; today's blind `DELETE` would hit the foreign key. Pinned in Task 2.
2. **A section ending past the video's end** (marked at the last frame, rounding up) — the rAF check never sees `currentTime >= end`; the `ended` handler must restart the loop. Pinned by `loopTarget` tests in Task 1 and the `onended` handler in Task 5.
3. **Space on a focused button** in the player — must toggle play once, not twice (keydown handler plus the button's own activation). Checked in the browser in Task 6.
4. **Bad ids in the API** (`?recording=abc`, both owners, neither, `/api/video-spots/0`) — 400 or 404, never a 500. Pinned in Task 3.
5. **Full screen inside the Today popup** (a `Sheet` `<dialog>`) — the player must sit above the sheet and close back into it. Checked in the browser in Task 6.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/types.ts` (modify) | `Spot`, `SpotOwner` row shapes |
| `src/lib/limits.ts` (modify) | `MAX_SPOT_LABEL` |
| `src/lib/video/spots.ts` (create) | PURE: `msOf`, `spotTime`, `spotLabel`, `step`, `sortSpots`, `loopTarget` |
| `src/lib/video/spots.spec.ts` (create) | its tests |
| `src/lib/server/db/schema.ts` (modify) | `videoSpots` table |
| `drizzle/0012_*.sql` (generated) | the migration |
| `src/lib/server/spots.ts` (create) | `SpotError`, `ownerFrom`, `ownerExists`, `listSpots`, `addSpot`, `renameSpot`, `deleteSpot` |
| `src/lib/server/spots.spec.ts` (create) | its tests |
| `src/lib/server/figures.ts` / `lessons.ts` (modify) | delete a video's spots with the video |
| `src/routes/api/video-spots/+server.ts` (create) | GET list, POST create |
| `src/routes/api/video-spots/[id]/+server.ts` (create) | PATCH rename, DELETE |
| `src/routes/api/video-spots/video-spots.spec.ts` (create) | API tests |
| `src/lib/video/spots-api.ts` (create) | client fetch wrappers for the API |
| `src/lib/components/ui/VideoPlayer.svelte` (create) | the full-screen player |
| `src/lib/components/ui/VideoFrame.svelte` (modify) | `owner` prop, **Full screen** button |
| 4 call sites (modify) | pass `owner` |
| docs + `CLAUDE.md` (modify) | mark the feature live |

---

### Task 1: Pure spot module

**Files:**
- Modify: `src/lib/types.ts` (append)
- Modify: `src/lib/limits.ts` (append)
- Create: `src/lib/video/spots.ts`
- Test: `src/lib/video/spots.spec.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `interface Spot { id: number; startMs: number; endMs: number | null; label: string | null }`, `type SpotOwner = { recordingId: number } | { lessonVideoId: number }`
  - `limits.ts`: `MAX_SPOT_LABEL = 80`
  - `spots.ts`: `msOf(s: number): number`, `spotTime(ms: number): string`, `spotLabel(spot: Pick<Spot, 'startMs' | 'endMs' | 'label'>): string`, `step(currentS: number, deltaS: number, durationS: number): number`, `sortSpots<T extends Pick<Spot, 'id' | 'startMs'>>(spots: T[]): T[]`, `loopTarget(currentS: number, loop: Pick<Spot, 'startMs' | 'endMs'> | null): number | null`

- [ ] **Step 1: Add the row shapes and the limit**

Append to `src/lib/types.ts`:

```ts
/**
 * A saved moment of a video: a point when `endMs` is null, else a section the
 * full-screen player loops. Milliseconds into the file, not instants.
 */
export interface Spot {
	id: number;
	startMs: number;
	endMs: number | null;
	label: string | null;
}

/** The one video a spot belongs to — a figure recording or a lesson video. */
export type SpotOwner = { recordingId: number } | { lessonVideoId: number };
```

Append to `src/lib/limits.ts`:

```ts
/** Longest spot label, in characters — a name like "Cross-body, the hand change", not a note. */
export const MAX_SPOT_LABEL = 80;
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/video/spots.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loopTarget, msOf, sortSpots, spotLabel, spotTime, step } from './spots';

describe('spotTime', () => {
	it.each([
		[0, '0:00.0'],
		[134_500, '2:14.5'],
		[59_999, '0:59.9'],
		[60_000, '1:00.0'],
		[3_725_300, '62:05.3']
	])('%i ms is %s', (ms, text) => {
		expect(spotTime(ms)).toBe(text);
	});
});

describe('spotLabel', () => {
	it('is the label when there is one', () => {
		expect(spotLabel({ startMs: 1000, endMs: null, label: 'Hand change' })).toBe('Hand change');
	});
	it('is the time of a point, and the range of a section', () => {
		expect(spotLabel({ startMs: 134_500, endMs: null, label: null })).toBe('2:14.5');
		expect(spotLabel({ startMs: 134_500, endMs: 142_000, label: null })).toBe('2:14.5–2:22.0');
	});
});

describe('msOf', () => {
	it('rounds seconds to whole milliseconds', () => {
		expect(msOf(2.0004)).toBe(2000);
		expect(msOf(2.0006)).toBe(2001);
	});
});

describe('step', () => {
	it('moves by the delta', () => {
		expect(step(10, -1, 60)).toBe(9);
		expect(step(10, 1, 60)).toBe(11);
	});
	it('clamps at the start and at the end', () => {
		expect(step(0.4, -1, 60)).toBe(0);
		expect(step(59.5, 1, 60)).toBe(60);
	});
	it('only clamps at the start while the duration is unknown', () => {
		expect(step(10, 1, NaN)).toBe(11);
		expect(step(10, 1, Infinity)).toBe(11);
	});
});

describe('sortSpots', () => {
	it('orders by start, then by id, without touching the input', () => {
		const input = [
			{ id: 3, startMs: 500 },
			{ id: 1, startMs: 900 },
			{ id: 2, startMs: 500 }
		];
		expect(sortSpots(input).map((s) => s.id)).toEqual([2, 3, 1]);
		expect(input.map((s) => s.id)).toEqual([3, 1, 2]);
	});
});

describe('loopTarget', () => {
	const loop = { startMs: 2000, endMs: 4000 };
	it('keeps playing inside the section and before it', () => {
		expect(loopTarget(3.9, loop)).toBeNull();
		expect(loopTarget(1, loop)).toBeNull();
	});
	it('goes back to the start at and past the end', () => {
		expect(loopTarget(4, loop)).toBe(2);
		expect(loopTarget(30, loop)).toBe(2);
	});
	it('does nothing without a loop, or for a point', () => {
		expect(loopTarget(30, null)).toBeNull();
		expect(loopTarget(30, { startMs: 2000, endMs: null })).toBeNull();
	});
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/video/spots.spec.ts`
Expected: FAIL — cannot resolve `./spots`.

- [ ] **Step 4: Implement**

Create `src/lib/video/spots.ts`:

```ts
/**
 * Spots — saved moments and sections of a video — as the full-screen player
 * needs them. PURE and client-safe: the media element speaks seconds, a spot
 * is stored in milliseconds, and every conversion between the two is here.
 */
import type { Spot } from '$lib/types';

/** Seconds of media time to the integer milliseconds a spot stores. */
export function msOf(s: number): number {
	return Math.round(s * 1000);
}

/**
 * `2:14.5` — minutes, seconds, tenths. Floored, not rounded, so 59.99 s reads
 * `0:59.9` rather than an impossible `0:60.0`. No hours: a class video is not
 * that long, and `62:05.3` still reads fine.
 */
export function spotTime(ms: number): string {
	const tenths = Math.floor(ms / 100);
	const minutes = Math.floor(tenths / 600);
	const rest = tenths % 600;
	const seconds = Math.floor(rest / 10);
	return `${minutes}:${String(seconds).padStart(2, '0')}.${rest % 10}`;
}

/** What a spot is called on screen: its label, else its time or time range. */
export function spotLabel(spot: Pick<Spot, 'startMs' | 'endMs' | 'label'>): string {
	if (spot.label) return spot.label;
	const start = spotTime(spot.startMs);
	return spot.endMs === null ? start : `${start}–${spotTime(spot.endMs)}`;
}

/**
 * The time after a ±step, kept inside the video. Before metadata arrives the
 * duration is NaN (and Infinity for some streams), so only the start is a
 * bound then.
 */
export function step(currentS: number, deltaS: number, durationS: number): number {
	const next = Math.max(0, currentS + deltaS);
	return Number.isFinite(durationS) ? Math.min(durationS, next) : next;
}

/** By start time, then by id so two spots at the same moment keep a stable order. */
export function sortSpots<T extends Pick<Spot, 'id' | 'startMs'>>(spots: T[]): T[] {
	return [...spots].sort((a, b) => a.startMs - b.startMs || a.id - b.id);
}

/**
 * Where to seek while a section loops, or null to keep playing. Anything at or
 * past the end goes back to the start — so a scrub past the section lands in
 * it again, which is the point: only ending the loop lets playback leave.
 * Before the start, playback runs on into the section.
 */
export function loopTarget(
	currentS: number,
	loop: Pick<Spot, 'startMs' | 'endMs'> | null
): number | null {
	if (!loop || loop.endMs === null) return null;
	return msOf(currentS) >= loop.endMs ? loop.startMs / 1000 : null;
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `nix develop -c npx vitest run src/lib/video/spots.spec.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/limits.ts src/lib/video/spots.ts src/lib/video/spots.spec.ts
git commit -m "video: spot times, labels and the loop rule — pure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The table and its data functions

**Files:**
- Modify: `src/lib/server/db/schema.ts` (after `lessonVideos`, ~line 521; and the type exports at the end)
- Generated: `drizzle/0012_*.sql`, `drizzle/meta/*`
- Create: `src/lib/server/spots.ts`
- Modify: `src/lib/server/figures.ts:206-209` (`deleteRecording`)
- Modify: `src/lib/server/lessons.ts:500-503` (`deleteLessonVideo`)
- Test: `src/lib/server/spots.spec.ts`

**Interfaces:**
- Consumes: `Spot`, `SpotOwner` (`$lib/types`), `MAX_SPOT_LABEL` (`$lib/limits`)
- Produces (`src/lib/server/spots.ts`):
  - `class SpotError extends Error` — a bad value; the route answers 400 with its message
  - `ownerFrom(raw: { recordingId?: unknown; lessonVideoId?: unknown }): SpotOwner | null` — exactly one positive integer id (number or digit string), else null
  - `ownerExists(db: Db, owner: SpotOwner): boolean`
  - `listSpots(db: Db, owner: SpotOwner): Spot[]`
  - `addSpot(db: Db, owner: SpotOwner, input: { startMs: unknown; endMs: unknown; label: unknown }): Spot | null` — null when the owner does not exist; throws `SpotError` on a bad value
  - `renameSpot(db: Db, id: number, label: unknown): Spot | null` — throws `SpotError` on a bad label
  - `deleteSpot(db: Db, id: number): boolean`
  - `schema.ts`: `videoSpots`, `type VideoSpot`

- [ ] **Step 1: Add the table**

In `src/lib/server/db/schema.ts`, directly after the `lessonVideos` table:

```ts
/**
 * A saved moment of a video — a point, or a section the full-screen player
 * loops. See `docs/superpowers/specs/2026-10-01-video-player-design.md`.
 *
 * Exactly one owner, a recording or a lesson video. The CHECKs are safe
 * because this table is NEW: the "never add a CHECK" rule is about drizzle-kit
 * rebuilding an EXISTING table.
 *
 * `start_ms` and `end_ms` are positions inside the media file, not instants,
 * so they are not epoch ms — but integers for the same reason. No `dance`
 * column: a spot is the dance of its video, resolved through the owner like a
 * link. Hard-deleted, and deleted with its video (`deleteRecording`,
 * `deleteLessonVideo`).
 */
export const videoSpots = sqliteTable(
	'video_spots',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		recordingId: integer('recording_id').references(() => recordings.id),
		lessonVideoId: integer('lesson_video_id').references(() => lessonVideos.id),
		startMs: integer('start_ms').notNull(),
		/** Null for a point; else after `start_ms`. */
		endMs: integer('end_ms'),
		/** The user's name for it; null shows the time. */
		label: text('label'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'video_spots_owner_ck',
			sql`(${t.recordingId} is not null) + (${t.lessonVideoId} is not null) = 1`
		),
		check(
			'video_spots_span_ck',
			sql`${t.startMs} >= 0 and (${t.endMs} is null or ${t.endMs} > ${t.startMs})`
		),
		index('video_spots_recording_idx').on(t.recordingId),
		index('video_spots_lesson_video_idx').on(t.lessonVideoId)
	]
);
```

And with the type exports at the end of the file:

```ts
export type VideoSpot = typeof videoSpots.$inferSelect;
```

- [ ] **Step 2: Generate the migration and read it**

Run: `nix develop -c npm run db:generate`
Then: `cat drizzle/0012_*.sql`
Expected: exactly one `CREATE TABLE \`video_spots\`` with both CHECKs and the two foreign keys, and two `CREATE INDEX` lines. If it mentions `recordings`, `lesson_videos` or any `__new_` table, stop — the schema edit touched an existing table.

- [ ] **Step 3: Write the failing tests**

Create `src/lib/server/spots.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { videoSpots } from './db/schema';
import { addRecording, createFigure, deleteRecording } from './figures';
import { addLessonVideo, createLesson, deleteLessonVideo } from './lessons';
import {
	addSpot,
	deleteSpot,
	listSpots,
	ownerExists,
	ownerFrom,
	renameSpot,
	SpotError
} from './spots';

let db: Db;
let recordingId: number;
let lessonVideoId: number;

beforeEach(() => {
	db = openDb(':memory:');
	const { figure } = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	recordingId = addRecording(db, {
		figureId: figure.id,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
	const { lesson } = createLesson(db, 'salsa', {
		lessonDay: '2026-09-20',
		title: 'Class',
		notes: null
	});
	lessonVideoId = addLessonVideo(db, {
		lessonId: lesson.id,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 10
	}).id;
});

const point = (startMs: number, label: string | null = null) => ({
	startMs,
	endMs: null,
	label
});

describe('ownerFrom', () => {
	it('takes exactly one positive integer id, as a number or digits', () => {
		expect(ownerFrom({ recordingId: 3 })).toEqual({ recordingId: 3 });
		expect(ownerFrom({ lessonVideoId: '7' })).toEqual({ lessonVideoId: 7 });
	});
	it.each([
		{},
		{ recordingId: 1, lessonVideoId: 2 },
		{ recordingId: 0 },
		{ recordingId: -1 },
		{ recordingId: 1.5 },
		{ recordingId: 'abc' },
		{ recordingId: '1e3' },
		{ lessonVideoId: null }
	])('refuses %o', (raw) => {
		expect(ownerFrom(raw)).toBeNull();
	});
});

describe('spots', () => {
	it('adds, lists by start time, renames and deletes on both kinds of owner', () => {
		for (const owner of [{ recordingId }, { lessonVideoId }]) {
			const late = addSpot(db, owner, point(9000))!;
			const early = addSpot(db, owner, { startMs: 1000, endMs: 2500, label: '  Turn  ' })!;
			expect(early).toEqual({ id: early.id, startMs: 1000, endMs: 2500, label: 'Turn' });
			expect(listSpots(db, owner).map((s) => s.id)).toEqual([early.id, late.id]);

			expect(renameSpot(db, late.id, 'Dip')?.label).toBe('Dip');
			expect(renameSpot(db, late.id, '   ')?.label).toBeNull();

			expect(deleteSpot(db, early.id)).toBe(true);
			expect(deleteSpot(db, early.id)).toBe(false);
			expect(listSpots(db, owner).map((s) => s.id)).toEqual([late.id]);
		}
	});

	it('keeps each video’s spots to itself', () => {
		addSpot(db, { recordingId }, point(1000));
		expect(listSpots(db, { lessonVideoId })).toEqual([]);
	});

	it('answers null for a video that does not exist', () => {
		expect(ownerExists(db, { recordingId: 999 })).toBe(false);
		expect(ownerExists(db, { recordingId })).toBe(true);
		expect(addSpot(db, { lessonVideoId: 999 }, point(0))).toBeNull();
		expect(renameSpot(db, 999, 'x')).toBeNull();
	});

	it.each([
		['a negative start', { startMs: -1, endMs: null, label: null }],
		['a fractional start', { startMs: 1.5, endMs: null, label: null }],
		['a string start', { startMs: '100', endMs: null, label: null }],
		['an end at the start', { startMs: 100, endMs: 100, label: null }],
		['an end before the start', { startMs: 100, endMs: 50, label: null }],
		['a non-string label', { startMs: 100, endMs: null, label: 5 }],
		['an 81-character label', { startMs: 100, endMs: null, label: 'x'.repeat(81) }]
	])('refuses %s', (_, input) => {
		expect(() => addSpot(db, { recordingId }, input)).toThrow(SpotError);
	});

	it('accepts an 80-character label and refuses a longer rename', () => {
		const spot = addSpot(db, { recordingId }, point(0, 'x'.repeat(80)))!;
		expect(spot.label).toHaveLength(80);
		expect(() => renameSpot(db, spot.id, 'y'.repeat(81))).toThrow(SpotError);
	});

	it('has a CHECK for exactly one owner', () => {
		expect(() =>
			db.insert(videoSpots).values({ recordingId, lessonVideoId, startMs: 0 }).run()
		).toThrow(/CHECK/);
		expect(() => db.insert(videoSpots).values({ startMs: 0 }).run()).toThrow(/CHECK/);
	});

	it('goes with its video when the video is deleted', () => {
		addSpot(db, { recordingId }, point(1000));
		addSpot(db, { lessonVideoId }, point(1000));
		expect(deleteRecording(db, recordingId)?.file).toBe('r.mp4');
		expect(deleteLessonVideo(db, lessonVideoId)?.file).toBe('l.mp4');
		expect(db.select().from(videoSpots).all()).toEqual([]);
	});
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/spots.spec.ts`
Expected: FAIL — cannot resolve `./spots`.

- [ ] **Step 5: Implement the data functions**

Create `src/lib/server/spots.ts`:

```ts
/**
 * Spots: saved moments and sections of a figure recording or a lesson video.
 *
 * Every value is validated here rather than in the route, because the route is
 * a JSON API and its body is whatever was sent: a bad time would sit in the
 * table until the player drew it off the end of the bar.
 */
import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { lessonVideos, recordings, videoSpots } from './db/schema';
import { MAX_SPOT_LABEL } from '$lib/limits';
import type { Spot, SpotOwner } from '$lib/types';

/** A value the user (or a bad client) sent that a spot cannot hold. */
export class SpotError extends Error {}

const COLUMNS = {
	id: videoSpots.id,
	startMs: videoSpots.startMs,
	endMs: videoSpots.endMs,
	label: videoSpots.label
};

/** A positive integer id from a JSON number or a query-string digit run, else null. */
function toId(v: unknown): number | null {
	const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
	return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Exactly one owner id, or null — both, neither, or a bad id. */
export function ownerFrom(raw: { recordingId?: unknown; lessonVideoId?: unknown }): SpotOwner | null {
	const hasRecording = raw.recordingId !== undefined;
	const hasLessonVideo = raw.lessonVideoId !== undefined;
	if (hasRecording === hasLessonVideo) return null;
	const id = toId(hasRecording ? raw.recordingId : raw.lessonVideoId);
	if (id === null) return null;
	return hasRecording ? { recordingId: id } : { lessonVideoId: id };
}

function ownerColumn(owner: SpotOwner) {
	return 'recordingId' in owner
		? eq(videoSpots.recordingId, owner.recordingId)
		: eq(videoSpots.lessonVideoId, owner.lessonVideoId);
}

export function ownerExists(db: Db, owner: SpotOwner): boolean {
	const row =
		'recordingId' in owner
			? db.select({ id: recordings.id }).from(recordings).where(eq(recordings.id, owner.recordingId)).get()
			: db
					.select({ id: lessonVideos.id })
					.from(lessonVideos)
					.where(eq(lessonVideos.id, owner.lessonVideoId))
					.get();
	return row !== undefined;
}

/** Trimmed; empty is null. */
function cleanLabel(raw: unknown): string | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string') throw new SpotError('A label must be text.');
	const label = raw.trim();
	if (label.length > MAX_SPOT_LABEL) {
		throw new SpotError(`A label can be at most ${MAX_SPOT_LABEL} characters.`);
	}
	return label || null;
}

function cleanTimes(startMs: unknown, endMs: unknown): { startMs: number; endMs: number | null } {
	if (typeof startMs !== 'number' || !Number.isSafeInteger(startMs) || startMs < 0) {
		throw new SpotError('A spot needs a start time.');
	}
	if (endMs === null || endMs === undefined) return { startMs, endMs: null };
	if (typeof endMs !== 'number' || !Number.isSafeInteger(endMs) || endMs <= startMs) {
		throw new SpotError('A section has to end after it starts.');
	}
	return { startMs, endMs };
}

export function listSpots(db: Db, owner: SpotOwner): Spot[] {
	return db
		.select(COLUMNS)
		.from(videoSpots)
		.where(ownerColumn(owner))
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
}

/** The new spot, or null when its video does not exist. Throws `SpotError` on a bad value. */
export function addSpot(
	db: Db,
	owner: SpotOwner,
	input: { startMs: unknown; endMs: unknown; label: unknown }
): Spot | null {
	const times = cleanTimes(input.startMs, input.endMs);
	const label = cleanLabel(input.label);
	if (!ownerExists(db, owner)) return null;
	return db
		.insert(videoSpots)
		.values({ ...owner, ...times, label })
		.returning(COLUMNS)
		.get();
}

/** The renamed spot, or null when there is none. Throws `SpotError` on a bad label. */
export function renameSpot(db: Db, id: number, label: unknown): Spot | null {
	const clean = cleanLabel(label);
	return (
		db
			.update(videoSpots)
			.set({ label: clean })
			.where(eq(videoSpots.id, id))
			.returning(COLUMNS)
			.get() ?? null
	);
}

export function deleteSpot(db: Db, id: number): boolean {
	return db.delete(videoSpots).where(eq(videoSpots.id, id)).returning().get() !== undefined;
}
```

- [ ] **Step 6: Delete a video's spots with the video**

In `src/lib/server/figures.ts`, add `videoSpots` to the schema import, and replace `deleteRecording`:

```ts
/**
 * Delete a recording row and return it, so the caller can remove the file.
 * Its spots go first, in the same transaction — the foreign key would refuse
 * the recording otherwise.
 */
export function deleteRecording(db: Db, id: number) {
	return db.transaction((tx) => {
		tx.delete(videoSpots).where(eq(videoSpots.recordingId, id)).run();
		return tx.delete(recordings).where(eq(recordings.id, id)).returning().get() ?? null;
	});
}
```

In `src/lib/server/lessons.ts`, add `videoSpots` to the schema import, and replace `deleteLessonVideo`:

```ts
/**
 * Delete a video row and return it, so the caller can remove the file. Its
 * spots go first, in the same transaction — the foreign key would refuse the
 * video otherwise.
 */
export function deleteLessonVideo(db: Db, id: number) {
	return db.transaction((tx) => {
		tx.delete(videoSpots).where(eq(videoSpots.lessonVideoId, id)).run();
		return tx.delete(lessonVideos).where(eq(lessonVideos.id, id)).returning().get() ?? null;
	});
}
```

- [ ] **Step 7: Run the new and the touched specs**

Run: `nix develop -c npx vitest run src/lib/server/spots.spec.ts src/lib/server/data.spec.ts src/lib/server/lessons.spec.ts src/lib/server/db/migrate.spec.ts`
Expected: PASS, all.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle src/lib/server/spots.ts src/lib/server/spots.spec.ts src/lib/server/figures.ts src/lib/server/lessons.ts
git commit -m "spots: the video_spots table and its data functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The JSON API

**Files:**
- Create: `src/routes/api/video-spots/+server.ts`
- Create: `src/routes/api/video-spots/[id]/+server.ts`
- Test: `src/routes/api/video-spots/video-spots.spec.ts`

**Interfaces:**
- Consumes: everything `src/lib/server/spots.ts` produces (Task 2)
- Produces (HTTP, used by Task 5's `spots-api.ts`):
  - `GET /api/video-spots?recording=<id>` or `?lessonVideo=<id>` → 200 `Spot[]`; 400 bad/both/neither owner; 404 no such video
  - `POST /api/video-spots` body `{ recordingId | lessonVideoId, startMs, endMs, label }` → 201 `Spot`; 400; 404
  - `PATCH /api/video-spots/<id>` body `{ label }` → 200 `Spot`; 400; 404
  - `DELETE /api/video-spots/<id>` → 204; 404

The hook in `src/hooks.server.ts` already answers every unauthenticated `/api/` request with a 401; these routes add nothing for auth. JSON bodies are not subject to SvelteKit's cross-site form check, which only looks at form content types.

- [ ] **Step 1: Write the failing tests**

Create `src/routes/api/video-spots/video-spots.spec.ts`:

```ts
/**
 * The spots API, called as SvelteKit would call it. `getDb()` is mocked so no
 * test ever opens the real database — see `src/routes/[dance]/dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { addRecording, createFigure } from '$lib/server/figures';
import { addSpot, listSpots } from '$lib/server/spots';
import * as list from './+server';
import * as one from './[id]/+server';

let db: Db;
let recordingId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	const { figure } = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	recordingId = addRecording(db, {
		figureId: figure.id,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
});

type Handler = (event: unknown) => Promise<Response> | Response;
const run = (h: unknown, event: unknown) => (h as Handler)(event);

const get = (query: string) =>
	run(list.GET, { url: new URL(`http://localhost/api/video-spots?${query}`) });
const send = (method: string, body: unknown, id = '') =>
	new Request(`http://localhost/api/video-spots/${id}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

/** Run a handler and return the HTTP status it answered or threw. */
async function status(p: () => Promise<Response> | Response): Promise<number> {
	try {
		return (await p()).status;
	} catch (thrown) {
		return (thrown as { status: number }).status;
	}
}

describe('GET /api/video-spots', () => {
	it('lists a recording’s spots by start time', async () => {
		addSpot(db, { recordingId }, { startMs: 5000, endMs: null, label: null });
		addSpot(db, { recordingId }, { startMs: 1000, endMs: 2000, label: 'Turn' });
		const res = await get(`recording=${recordingId}`);
		expect(res.status).toBe(200);
		expect((await res.json()).map((s: { startMs: number }) => s.startMs)).toEqual([1000, 5000]);
	});

	it.each(['', 'recording=abc', 'recording=0', `recording=1&lessonVideo=1`])(
		'is a 400 for "%s"',
		async (query) => {
			expect(await status(() => get(query))).toBe(400);
		}
	);

	it('is a 404 for a video that does not exist', async () => {
		expect(await status(() => get('lessonVideo=999'))).toBe(404);
	});
});

describe('POST /api/video-spots', () => {
	it('creates a spot and answers 201 with it', async () => {
		const res = await run(list.POST, {
			request: send('POST', { recordingId, startMs: 1000, endMs: 3000, label: 'Turn' })
		});
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ startMs: 1000, endMs: 3000, label: 'Turn' });
		expect(listSpots(db, { recordingId })).toHaveLength(1);
	});

	it.each([
		['bad JSON', '{'],
		['a non-object', '[1]'],
		['no owner', { startMs: 0 }],
		['an end before the start', { recordingId: 0, startMs: 10, endMs: 5 }]
	])('is a 400 for %s', async (_, body) => {
		const b = typeof body === 'object' && 'recordingId' in body ? { ...body, recordingId } : body;
		expect(await status(() => run(list.POST, { request: send('POST', b) }))).toBe(400);
		expect(listSpots(db, { recordingId })).toEqual([]);
	});

	it('is a 404 for a video that does not exist', async () => {
		const req = send('POST', { recordingId: 999, startMs: 0, endMs: null, label: null });
		expect(await status(() => run(list.POST, { request: req }))).toBe(404);
	});
});

describe('PATCH and DELETE /api/video-spots/[id]', () => {
	it('renames, then deletes', async () => {
		const spot = addSpot(db, { recordingId }, { startMs: 0, endMs: null, label: null })!;
		const id = String(spot.id);

		const renamed = await run(one.PATCH, { params: { id }, request: send('PATCH', { label: 'Dip' }, id) });
		expect(await renamed.json()).toMatchObject({ id: spot.id, label: 'Dip' });

		const gone = await run(one.DELETE, { params: { id } });
		expect(gone.status).toBe(204);
		expect(listSpots(db, { recordingId })).toEqual([]);
	});

	it.each(['0', 'abc', '999'])('is a 404 for spot "%s"', async (id) => {
		expect(await status(() => run(one.DELETE, { params: { id } }))).toBe(404);
		expect(
			await status(() => run(one.PATCH, { params: { id }, request: send('PATCH', { label: 'x' }, id) }))
		).toBe(404);
	});

	it('is a 400 for a bad label', async () => {
		const spot = addSpot(db, { recordingId }, { startMs: 0, endMs: null, label: null })!;
		const id = String(spot.id);
		const req = send('PATCH', { label: 'x'.repeat(81) }, id);
		expect(await status(() => run(one.PATCH, { params: { id }, request: req }))).toBe(400);
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/routes/api/video-spots`
Expected: FAIL — cannot resolve `./+server`.

- [ ] **Step 3: Implement the list route**

Create `src/routes/api/video-spots/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addSpot, listSpots, ownerExists, ownerFrom, SpotError } from '$lib/server/spots';
import type { RequestHandler } from './$types';

/**
 * Spots of one video, for the full-screen player.
 *
 * Flat, like the media servers that stream the same videos: there is no dance
 * in the URL to contradict, and a spot is reached only through its video's id.
 */
export const GET: RequestHandler = ({ url }) => {
	const q = url.searchParams;
	const owner = ownerFrom({
		recordingId: q.get('recording') ?? undefined,
		lessonVideoId: q.get('lessonVideo') ?? undefined
	});
	if (!owner) throw error(400, 'Name one video: ?recording= or ?lessonVideo=.');
	const db = getDb();
	if (!ownerExists(db, owner)) throw error(404, 'No such video');
	return json(listSpots(db, owner));
};

export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Bad JSON.');
	const b = body as Record<string, unknown>;
	const owner = ownerFrom({ recordingId: b.recordingId, lessonVideoId: b.lessonVideoId });
	if (!owner) throw error(400, 'Name one video: recordingId or lessonVideoId.');
	try {
		const spot = addSpot(getDb(), owner, { startMs: b.startMs, endMs: b.endMs, label: b.label });
		if (!spot) throw error(404, 'No such video');
		return json(spot, { status: 201 });
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};
```

- [ ] **Step 4: Implement the single-spot route**

Create `src/routes/api/video-spots/[id]/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteSpot, renameSpot, SpotError } from '$lib/server/spots';
import type { RequestHandler } from './$types';

/** The spot id from the path, or a 404 — a bad id and a missing spot get the same answer. */
function spotId(raw: string): number {
	const id = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(id) || id <= 0) throw error(404, 'No such spot');
	return id;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = spotId(params.id);
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Bad JSON.');
	try {
		const spot = renameSpot(getDb(), id, (body as Record<string, unknown>).label);
		if (!spot) throw error(404, 'No such spot');
		return json(spot);
	} catch (e) {
		if (e instanceof SpotError) throw error(400, e.message);
		throw e;
	}
};

export const DELETE: RequestHandler = ({ params }) => {
	if (!deleteSpot(getDb(), spotId(params.id))) throw error(404, 'No such spot');
	return new Response(null, { status: 204 });
};
```

- [ ] **Step 5: Run them to see them pass**

Run: `nix develop -c npx vitest run src/routes/api/video-spots`
Expected: PASS, all.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/video-spots
git commit -m "spots: the JSON API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The full-screen player, without spots

The player with its picture, controls, speed, mirror, ±1 s and keyboard — everything but spots, so it can be checked on its own. Task 5 adds spots to it.

**Files:**
- Create: `src/lib/components/ui/VideoPlayer.svelte`
- Modify: `src/lib/components/ui/VideoFrame.svelte`
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte:179-182`
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte:411-415`
- Modify: `src/lib/components/exercises/kinds/lesson/Content.svelte:40-43`
- Modify: `src/lib/components/exercises/kinds/figure/Content.svelte:27-31`

**Interfaces:**
- Consumes: `step`, `spotTime` (Task 1); `SpotOwner` (Task 1); `VIDEO_RATES`, `VideoRate` (`$lib/video-prefs`)
- Produces:
  - `VideoFrame` gains an optional prop `owner?: SpotOwner`; the **Full screen** button shows when `kind === 'video' && owner`.
  - `VideoPlayer` props: `{ src: string; owner: SpotOwner; startAt: number; mirror: boolean; rate: VideoRate; onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void; onclose: (at: number) => void }` — `startAt`/`at` in seconds.

**Why a `<dialog>`:** the Today popup is itself a modal `<dialog>` (`ui/Sheet.svelte`) and the page behind it is inert. A `showModal()` dialog goes into the top layer above it, which a `position: fixed` div inside the sheet cannot guarantee. Browser fullscreen is requested on an inner `<div>` (the "stage"), not on the dialog.

- [ ] **Step 1: Write the player**

Create `src/lib/components/ui/VideoPlayer.svelte`:

```svelte
<!-- src/lib/components/ui/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { VIDEO_RATES, type VideoRate } from '$lib/video-prefs';
	import { spotTime, step } from '$lib/video/spots';
	import type { SpotOwner } from '$lib/types';

	interface Props {
		src: string;
		owner: SpotOwner;
		/** Seconds: where the inline player was. */
		startAt: number;
		mirror: boolean;
		rate: VideoRate;
		onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void;
		/** Seconds: where to leave the inline player. */
		onclose: (at: number) => void;
	}

	// `owner` is read from Task 5 on, for its spots.
	let { src, startAt, mirror, rate, onchoose, onclose }: Props = $props();

	let dialog: HTMLDialogElement = $state()!;
	let stage: HTMLDivElement = $state()!;
	let video: HTMLVideoElement = $state()!;

	let current = $state(0);
	let duration = $state(NaN);
	let paused = $state(true);
	let shown = $state(true);

	/*
	 * Our own fullscreen. The browser's — and on an iPhone, iOS's player — would
	 * hide every control below. Where `requestFullscreen` exists (Android,
	 * desktop) the stage asks for it; where it does not, the dialog filling the
	 * viewport IS the fullscreen, and from the home-screen app there is no
	 * browser chrome around it.
	 */
	let wentFullscreen = false;
	onMount(() => {
		dialog.showModal();
		stage.requestFullscreen?.().then(
			() => (wentFullscreen = true),
			() => {
				// Refused (no user activation left, or an iframe): the dialog still fills the screen.
			}
		);
		const left = () => {
			if (wentFullscreen && !document.fullscreenElement) close();
		};
		document.addEventListener('fullscreenchange', left);
		return () => document.removeEventListener('fullscreenchange', left);
	});

	let closed = false;
	function close() {
		if (closed) return;
		closed = true;
		const at = video.currentTime;
		video.pause();
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		dialog.close();
		onclose(at);
	}

	$effect(() => {
		video.playbackRate = rate;
	});

	function toggle() {
		if (video.paused) void video.play();
		else video.pause();
	}

	function nudge(deltaS: number) {
		video.currentTime = step(video.currentTime, deltaS, video.duration);
	}

	/* Controls fade while playing and come back on a tap or a mouse move. */
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function wake() {
		shown = true;
		clearTimeout(hideTimer);
		if (!paused) hideTimer = setTimeout(() => (shown = false), 3000);
	}
	$effect(() => {
		void paused;
		wake();
		return () => clearTimeout(hideTimer);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
		const handled: Record<string, () => void> = {
			' ': toggle,
			ArrowLeft: () => nudge(-1),
			ArrowRight: () => nudge(1)
		};
		const act = handled[e.key];
		if (!act) return;
		// Also stops a focused button's own Space activation, which would toggle twice.
		e.preventDefault();
		act();
		wake();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Video"
	class="player"
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	{onkeydown}
>
	<div bind:this={stage} class="relative h-full w-full bg-black text-white">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={video}
			{src}
			playsinline
			preload="auto"
			class="absolute inset-0 h-full w-full object-contain"
			class:mirror
			bind:currentTime={current}
			bind:duration
			bind:paused
			onloadedmetadata={() => {
				video.preservesPitch = true;
				video.currentTime = startAt;
			}}
			onclick={wake}
			onpointermove={wake}
		></video>

		<div class="controls" class:hidden-controls={!shown}>
			<div class="top flex items-center gap-2 p-3">
				<button type="button" class="btn" aria-label="Close" onclick={close}>✕</button>
				<button
					type="button"
					class="btn ml-auto"
					aria-pressed={mirror}
					class:on={mirror}
					onclick={() => onchoose({ mirror: !mirror })}>Mirror</button
				>
				<span class="flex gap-1" role="group" aria-label="Speed">
					{#each VIDEO_RATES as r (r)}
						<button
							type="button"
							class="btn"
							aria-pressed={rate === r}
							class:on={rate === r}
							onclick={() => onchoose({ rate: r })}>{r}×</button
						>
					{/each}
				</span>
			</div>

			<div class="bottom p-3">
				<div class="flex items-center gap-2 text-[12px] tabular-nums">
					<span>{spotTime(current * 1000)}</span>
					<div class="relative flex-1">
						<input
							type="range"
							class="w-full"
							aria-label="Position"
							min="0"
							max={Number.isFinite(duration) ? duration : 0}
							step="0.01"
							value={current}
							oninput={(e) => (video.currentTime = Number(e.currentTarget.value))}
						/>
					</div>
					<span>{Number.isFinite(duration) ? spotTime(duration * 1000) : '–'}</span>
				</div>
				<div class="mt-2 flex items-center justify-center gap-2">
					<button type="button" class="btn" onclick={() => nudge(-1)}>−1s</button>
					<button type="button" class="btn big" onclick={toggle}>{paused ? 'Play' : 'Pause'}</button>
					<button type="button" class="btn" onclick={() => nudge(1)}>+1s</button>
				</div>
			</div>
		</div>
	</div>
</dialog>

<style>
	.player {
		margin: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		background: black;
	}
	.player::backdrop {
		background: black;
	}
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
	.controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
		transition: opacity 200ms;
	}
	.controls > * {
		pointer-events: auto;
	}
	.hidden-controls {
		opacity: 0;
	}
	.hidden-controls > * {
		pointer-events: none;
	}
	.top {
		padding-top: max(env(safe-area-inset-top), 12px);
		background: linear-gradient(rgb(0 0 0 / 0.6), transparent);
	}
	.bottom {
		padding-bottom: max(env(safe-area-inset-bottom), 12px);
		background: linear-gradient(transparent, rgb(0 0 0 / 0.7));
	}
	.btn {
		height: 2.5rem;
		min-width: 2.75rem;
		padding: 0 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(255 255 255 / 0.35);
		font-size: 13px;
	}
	.btn.on {
		background: white;
		color: black;
	}
	.btn.big {
		min-width: 5rem;
		font-weight: 600;
	}
</style>
```

Note: `owner` is in `Props` but not destructured yet — Task 5 adds it, so nothing here is unused.

- [ ] **Step 2: Open it from `VideoFrame`**

In `src/lib/components/ui/VideoFrame.svelte`:

Add to the imports:

```ts
	import VideoPlayer from './VideoPlayer.svelte';
	import type { SpotOwner } from '$lib/types';
```

Add `owner?: SpotOwner;` to `Props` with a doc comment, and destructure it:

```ts
		/** The recording or lesson video this is, for full screen and its spots. */
		owner?: SpotOwner;
```

```ts
	let { src, kind = 'video', owner, onproblem }: Props = $props();
```

Below `keepPitch`, add:

```ts
	let inline: HTMLVideoElement | undefined = $state();
	let fullAt = $state<number | null>(null);

	function openFull() {
		if (!inline) return;
		inline.pause();
		fullAt = inline.currentTime;
	}
```

Add `bind:this={inline}` to the `<video>` element. In the controls row, after the Mirror button and still inside `{#if kind === 'video'}`:

```svelte
		{#if owner}
			<button
				type="button"
				onclick={openFull}
				class="h-8 rounded-lg border border-rule px-2.5 text-ink-2">Full screen</button
			>
		{/if}
```

After the controls row `</div>` and before `<style>`:

```svelte
{#if owner && fullAt !== null}
	<VideoPlayer
		{src}
		{owner}
		startAt={fullAt}
		{mirror}
		{rate}
		onchoose={choose}
		onclose={(at) => {
			if (inline) inline.currentTime = at;
			fullAt = null;
		}}
	/>
{/if}
```

- [ ] **Step 3: Pass `owner` at the four call sites**

`src/routes/[dance]/lessons/[id]/+page.svelte` and `src/lib/components/exercises/kinds/lesson/Content.svelte` — on the `<VideoFrame` for `video`:

```svelte
								owner={{ lessonVideoId: video.id }}
```

`src/routes/[dance]/figures/[id]/+page.svelte` and `src/lib/components/exercises/kinds/figure/Content.svelte` — on the `<VideoFrame` for `rec`:

```svelte
							owner={{ recordingId: rec.id }}
```

(`VideoFrame` hides the button for an audio recording on its own, via `kind`.)

- [ ] **Step 4: Type-check and lint**

Run: `nix develop -c npm run check:types && nix develop -c npm run lint`
Expected: no errors. Fix any reported against the new files.

- [ ] **Step 5: Look at it in the browser**

Start the dev server if it is not running: `nix develop -c npm run dev` (in the background). It needs a lesson with a video in `.data/` — if the dev database has none, upload a short mp4 through the lesson page first.

Check, at desktop width and at 390×844:
- **Full screen** opens the player at the inline video's time; the picture fills the screen; on desktop Chrome the browser goes fullscreen.
- 0.25× / 0.5× / 0.75× / 1× change speed and stay chosen in the inline player after closing; Mirror flips the picture and stays too.
- −1s / +1s move by a second and stop at 0.
- Space toggles play (once, also with a button focused), ← / → step, Esc closes and the inline video sits where the player stopped.
- While playing, controls fade after 3 s and come back on a tap or mouse move.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ui/VideoPlayer.svelte src/lib/components/ui/VideoFrame.svelte "src/routes/[dance]/lessons/[id]/+page.svelte" "src/routes/[dance]/figures/[id]/+page.svelte" src/lib/components/exercises/kinds/lesson/Content.svelte src/lib/components/exercises/kinds/figure/Content.svelte
git commit -m "video: a full-screen player with ±1 s, speed and mirror

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Spots in the player

**Files:**
- Create: `src/lib/video/spots-api.ts`
- Modify: `src/lib/components/ui/VideoPlayer.svelte`

**Interfaces:**
- Consumes: the API (Task 3); `msOf`, `spotLabel`, `spotTime`, `sortSpots`, `loopTarget` (Task 1); `Spot`, `SpotOwner`, `MAX_SPOT_LABEL` (Task 1)
- Produces (`spots-api.ts`, client-only):
  - `fetchSpots(owner: SpotOwner): Promise<Spot[]>`
  - `postSpot(owner: SpotOwner, input: { startMs: number; endMs: number | null; label: string | null }): Promise<Spot>`
  - `patchSpot(id: number, label: string | null): Promise<Spot>`
  - `removeSpot(id: number): Promise<void>`
  - each rejects on a network error or a non-2xx answer

- [ ] **Step 1: Write the fetch wrappers**

Create `src/lib/video/spots-api.ts`:

```ts
/**
 * The full-screen player's side of `/api/video-spots`. Every call rejects on a
 * network failure or a non-2xx answer, so the player has exactly one thing to
 * catch and never shows a spot the server did not keep.
 */
import type { Spot, SpotOwner } from '$lib/types';

async function ok(res: Response): Promise<Response> {
	if (!res.ok) throw new Error(`video-spots: ${res.status}`);
	return res;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export async function fetchSpots(owner: SpotOwner): Promise<Spot[]> {
	const q =
		'recordingId' in owner ? `recording=${owner.recordingId}` : `lessonVideo=${owner.lessonVideoId}`;
	return (await ok(await fetch(`/api/video-spots?${q}`))).json();
}

export async function postSpot(
	owner: SpotOwner,
	input: { startMs: number; endMs: number | null; label: string | null }
): Promise<Spot> {
	const res = await fetch('/api/video-spots', {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify({ ...owner, ...input })
	});
	return (await ok(res)).json();
}

export async function patchSpot(id: number, label: string | null): Promise<Spot> {
	const res = await fetch(`/api/video-spots/${id}`, {
		method: 'PATCH',
		headers: JSON_HEADERS,
		body: JSON.stringify({ label })
	});
	return (await ok(res)).json();
}

export async function removeSpot(id: number): Promise<void> {
	await ok(await fetch(`/api/video-spots/${id}`, { method: 'DELETE' }));
}
```

- [ ] **Step 2: Load spots, mark, make sections, loop**

In `VideoPlayer.svelte`, destructure `owner` from props now (`let { src, owner, startAt, mirror, rate, onchoose, onclose }: Props = $props();`, dropping the comment above it), and update the imports:

```ts
	import { MAX_SPOT_LABEL } from '$lib/limits';
	import { loopTarget, msOf, sortSpots, spotLabel, spotTime, step } from '$lib/video/spots';
	import { fetchSpots, patchSpot, postSpot, removeSpot } from '$lib/video/spots-api';
	import type { Spot, SpotOwner } from '$lib/types';
```

Add state and functions after `nudge`:

```ts
	let spots = $state<Spot[]>([]);
	let loop = $state<Spot | null>(null);
	/** Milliseconds: the start of a section whose end has not been tapped yet. */
	let pendingStart = $state<number | null>(null);
	let panel = $state(false);
	let renaming = $state<number | null>(null);
	let note = $state<string | null>(null);

	let noteTimer: ReturnType<typeof setTimeout> | undefined;
	function flash(text: string) {
		note = text;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (note = null), 2500);
	}

	onMount(() => {
		fetchSpots(owner).then(
			(s) => (spots = sortSpots(s)),
			() => flash("Couldn't load spots")
		);
	});

	async function save(input: { startMs: number; endMs: number | null; label: string | null }) {
		try {
			const spot = await postSpot(owner, input);
			spots = sortSpots([...spots, spot]);
			flash(`Saved ${spotLabel(spot)}`);
			return true;
		} catch {
			flash("Couldn't save");
			return false;
		}
	}

	function mark() {
		void save({ startMs: msOf(video.currentTime), endMs: null, label: null });
	}

	/** First tap remembers the start; the second saves the section. */
	async function section() {
		const now = msOf(video.currentTime);
		if (pendingStart === null) {
			pendingStart = now;
			flash(`Section from ${spotTime(now)}…`);
			return;
		}
		if (now <= pendingStart) {
			flash('Play past the start, then end the section');
			return;
		}
		if (await save({ startMs: pendingStart, endMs: now, label: null })) pendingStart = null;
	}

	function go(spot: Spot) {
		video.currentTime = spot.startMs / 1000;
		if (spot.endMs !== null) loop = spot;
		panel = false;
	}

	async function rename(spot: Spot, label: string) {
		renaming = null;
		const clean = label.trim() || null;
		if (clean === spot.label) return;
		try {
			const next = await patchSpot(spot.id, clean);
			spots = spots.map((s) => (s.id === next.id ? next : s));
			if (loop?.id === next.id) loop = next;
		} catch {
			flash("Couldn't save");
		}
	}

	async function remove(spot: Spot) {
		try {
			await removeSpot(spot.id);
			spots = spots.filter((s) => s.id !== spot.id);
			if (loop?.id === spot.id) loop = null;
		} catch {
			flash("Couldn't save");
		}
	}

	/*
	 * The loop is checked every animation frame, not on `timeupdate`: that fires
	 * about four times a second, which overshoots a section's end by up to a
	 * quarter-second at 1×. A frame is the finest a seek can be noticed at.
	 */
	$effect(() => {
		if (paused || !loop) return;
		const l = loop;
		let frame = requestAnimationFrame(function tick() {
			const to = loopTarget(video.currentTime, l);
			if (to !== null) video.currentTime = to;
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	/** A section that ends at (or rounds past) the last frame: the frame check never sees it. */
	function onended() {
		if (!loop) return;
		video.currentTime = loop.startMs / 1000;
		void video.play();
	}
```

Change the auto-hide effect so an open panel keeps the controls up:

```ts
	function wake() {
		shown = true;
		clearTimeout(hideTimer);
		if (!paused && !panel) hideTimer = setTimeout(() => (shown = false), 3000);
	}
	$effect(() => {
		void paused;
		void panel;
		wake();
		return () => clearTimeout(hideTimer);
	});
```

Extend `onkeydown`'s table:

```ts
		const handled: Record<string, () => void> = {
			' ': toggle,
			ArrowLeft: () => nudge(-1),
			ArrowRight: () => nudge(1),
			m: mark,
			M: mark,
			s: () => void section(),
			S: () => void section(),
			l: () => (loop = null),
			L: () => (loop = null)
		};
```

- [ ] **Step 3: Draw spots on the bar, the main row, the chip, the panel and the note**

On the `<video>` element add `{onended}`.

Inside the `relative flex-1` wrapper around the range input, before the `<input>`:

```svelte
						{#if Number.isFinite(duration) && duration > 0}
							{#each spots as s (s.id)}
								{@const left = (s.startMs / 1000 / duration) * 100}
								{#if s.endMs === null}
									<span class="tick" style:left="{left}%"></span>
								{:else}
									<span
										class="band"
										class:active={loop?.id === s.id}
										style:left="{left}%"
										style:width="{Math.min(100 - left, ((s.endMs - s.startMs) / 1000 / duration) * 100)}%"
									></span>
								{/if}
							{/each}
						{/if}
```

Replace the main button row with:

```svelte
				<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
					<button type="button" class="btn" onclick={() => nudge(-1)}>−1s</button>
					<button type="button" class="btn big" onclick={toggle}>{paused ? 'Play' : 'Pause'}</button>
					<button type="button" class="btn" onclick={() => nudge(1)}>+1s</button>
					<button type="button" class="btn" onclick={mark}>Mark</button>
					<button type="button" class="btn" class:on={pendingStart !== null} onclick={section}
						>{pendingStart === null ? 'Section' : 'End section'}</button
					>
					<button type="button" class="btn" aria-expanded={panel} onclick={() => (panel = !panel)}
						>Spots ({spots.length})</button
					>
				</div>
```

Directly above the time/range row (inside `.bottom`, first child):

```svelte
				{#if loop}
					<div class="mb-2 flex justify-center">
						<span class="chip">
							Looping {spotLabel(loop)}
							<button type="button" aria-label="Stop looping" onclick={() => (loop = null)}>✕</button>
						</span>
					</div>
				{/if}
```

After `.controls`' closing `</div>`, still inside the stage:

```svelte
		{#if note}
			<p class="note" role="status">{note}</p>
		{/if}

		{#if panel}
			<div class="panel" aria-label="Spots">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-[15px] font-semibold">Spots</h2>
					<button type="button" class="btn" aria-label="Close spots" onclick={() => (panel = false)}
						>✕</button
					>
				</div>
				{#if spots.length === 0}
					<p class="text-[13px] opacity-70">
						Nothing marked yet. Mark saves this moment; Section saves a stretch to loop.
					</p>
				{/if}
				<ul class="flex flex-col gap-1">
					{#each spots as s (s.id)}
						<li class="flex items-center gap-2">
							{#if renaming === s.id}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									class="flex-1 rounded-md bg-white/10 px-2 py-1.5 text-[14px]"
									maxlength={MAX_SPOT_LABEL}
									value={s.label ?? ''}
									placeholder={spotLabel({ ...s, label: null })}
									autofocus
									onkeydown={(e) => {
										if (e.key === 'Enter') void rename(s, e.currentTarget.value);
										if (e.key === 'Escape') {
											e.preventDefault();
											e.stopPropagation();
											renaming = null;
										}
									}}
									onblur={(e) => void rename(s, e.currentTarget.value)}
								/>
							{:else}
								<button
									type="button"
									class="flex-1 rounded-md px-2 py-2 text-left text-[14px] hover:bg-white/10"
									class:font-semibold={loop?.id === s.id}
									onclick={() => go(s)}
								>
									{s.endMs === null ? '•' : '⟲'}
									{spotLabel(s)}
									{#if s.label}<span class="ml-1 text-[12px] opacity-60"
											>{spotLabel({ ...s, label: null })}</span
										>{/if}
								</button>
								<button type="button" class="btn" onclick={() => (renaming = s.id)}>Rename</button>
								<button type="button" class="btn" aria-label="Delete {spotLabel(s)}" onclick={() => remove(s)}
									>✕</button
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
```

Add to `<style>`:

```css
	.tick,
	.band {
		position: absolute;
		top: 50%;
		pointer-events: none;
		transform: translateY(-50%);
	}
	.tick {
		width: 2px;
		height: 14px;
		margin-left: -1px;
		background: white;
	}
	.band {
		height: 10px;
		border-radius: 3px;
		background: rgb(255 255 255 / 0.3);
	}
	.band.active {
		background: rgb(255 255 255 / 0.6);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem 0.25rem 0.75rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.9);
		color: black;
		font-size: 13px;
	}
	.note {
		position: absolute;
		top: 4.5rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.8);
		font-size: 13px;
	}
	.panel {
		position: absolute;
		inset: auto 0 0 0;
		max-height: 60%;
		overflow-y: auto;
		padding: 1rem;
		padding-bottom: max(env(safe-area-inset-bottom), 1rem);
		background: rgb(0 0 0 / 0.92);
	}
	@media (min-width: 640px) {
		.panel {
			inset: 0 0 0 auto;
			width: 20rem;
			max-height: none;
		}
	}
```

The rename input's `onkeydown` stops Escape from reaching the dialog, so Escape cancels the rename without closing the player; `onkeydown` on the dialog already ignores text inputs for the other keys.

- [ ] **Step 4: Type-check and lint**

Run: `nix develop -c npm run check:types && nix develop -c npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video/spots-api.ts src/lib/components/ui/VideoPlayer.svelte
git commit -m "video: spots in the full-screen player — mark, sections that loop, rename, delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify in the browser, mark it live

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-video-player-design.md` (status line)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (the phase-4 paragraph that says "designed 2026-10-01")
- Modify: `CLAUDE.md` (the **Live:** paragraph, the spec list, the `src/lib/video/` layout line)

- [ ] **Step 1: Walk the whole feature in the browser**

Against `npm run dev`, at desktop width and at 390×844, on a lesson video:
1. Full screen → Mark at two moments → Spots (2) lists them by time; ticks show on the bar.
2. Section → play 3 s → End section → the band shows; tap it in Spots → it loops; the chip reads `Looping …`; +1s past the end lands back at the start; ✕ on the chip stops it.
3. End section before the start → the note, and the pending start is kept.
4. Mark a section that ends on the last frame → it loops via `ended`.
5. Rename a spot (Enter saves; Escape cancels without closing the player); delete the looping spot → the loop stops.
6. Keyboard: Space (with a button focused — must toggle once), ←, →, M, S twice, L, Esc.
7. Close and reopen → spots are still there (they came from the server). Reload the page → still there.
8. Stop the dev server, Mark → "Couldn't save" and no new row; restart it.
9. Open a figure that has a recording via Today → its popup → Full screen: the player sits above the popup, and closing returns to the popup.
10. An audio recording on a figure page has no Full screen button.
11. Delete a lesson video that has spots → it deletes.

Fix anything that fails before going on, with a test where the failure was in a pure or data function.

- [ ] **Step 2: Mark it live in the docs**

In `docs/superpowers/specs/2026-10-01-video-player-design.md`, the status line becomes:

```markdown
> **Status:** approved in brainstorming, 2026-10-01; live since 2026-10-01. Extends
```

In `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `designed 2026-10-01, see` becomes `live since 2026-10-01, see`.

In `CLAUDE.md`:
- the **Live:** paragraph ends `… and a routine made from a selection) and a full-screen video player (±1 s, 0.25–1×, mirror, and saved spots: points to jump to, sections that loop).`
- after the exercise-types spec sentence, add: `The full-screen video player has its own, [`docs/superpowers/specs/2026-10-01-video-player-design.md`](docs/superpowers/specs/2026-10-01-video-player-design.md): spots, the loop, and why it is not the browser's fullscreen.`
- in the layout block, after the `src/lib/exercises/` entry:

```
src/lib/video/       PURE spots.ts: spot times, labels, ±1 s clamping, the loop
                     rule. spots-api.ts is the player's fetch side of
                     /api/video-spots. Client-safe
```

- [ ] **Step 3: Run the full check**

Run: `nix develop -c npm run check`
Expected: prettier, eslint, svelte-check, build and vitest all pass. Run `nix develop -c npx prettier --write` on any file it names, then re-run.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: the full-screen video player is live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
