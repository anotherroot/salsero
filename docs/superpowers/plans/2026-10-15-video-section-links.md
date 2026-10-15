# Video section links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link a saved section of a lesson video or recording to a figure version or a drill, show it as a card that loops it, and refuse to delete a linked section or its video.

**Architecture:** A new `spot_links` table, one data module (`src/lib/server/spot-links.ts`) that owns every rule and read, and the existing delete functions asking it before they delete. The pages get form actions; a new `SectionCard` opens the existing full-screen `VideoPlayer` with a new `loopSpot` prop.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Drizzle on better-sqlite3, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-15-video-section-links-design.md`

## Global Constraints

- Every data function takes `db` first; tests use `openDb(':memory:')`; a route spec mocks `$lib/server/db` (never `$DATA_DIR`).
- New table only; no CHECK on an existing table. Read the generated SQL: one `CREATE TABLE` plus indexes.
- Nothing under `$lib/server` is imported by components; shared shapes go in `src/lib/types.ts`.
- A target is always labelled through the "Figure · Variation" form, never a bare variation name.
- One-tap forms (link, unlink) use `use:enhance`; no `confirm()` for anything new.
- Dates on screen go through `src/lib/format.ts` (`dateLabel`).
- `npm run check` must pass at the end.

## Review Focus

- A section linked to two targets: unlinking one leaves the other, and the delete still refuses.
- A variation archived with its figure: its link still blocks, labelled "(archived)", and the lesson page can unlink it.
- A spot id posted to a lesson page that belongs to another lesson's video (or the other dance): 404, nothing linked.
- Renaming a linked section in the player keeps its "→ …" line (PATCH returns `linkedTo`).
- A target from the other dance posted to the lesson page: refused with the dance message.

---

### Task 1: Schema, migration, shared types

**Files:**
- Modify: `src/lib/server/db/schema.ts` (after `videoSpots`)
- Create: `drizzle/0015_*.sql` (generated)
- Modify: `src/lib/types.ts` (around `Spot`, line ~253)

**Interfaces — Produces:**
- `spotLinks` table: `id, spotId, figureId|null, exerciseId|null, createdAt`
- Types `Spot` (now with `linkedTo: string[]`), `SectionTarget`, `SectionLinkChip`, `VideoSection`, `SectionVideo`, `LinkedSection`, `SectionGroup`, `LinkableSection`

- [ ] **Step 1: Add the table**

```ts
/**
 * A section of a video linked to a figure version or a drill. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Exactly one target. The CHECK is safe because the table is NEW. "A section,
 * not a point", "same dance" and "drills only" are cross-row and live in
 * `src/lib/server/spot-links.ts`. The foreign key on `spot_id` is what makes the
 * database itself refuse to delete a linked spot. Hard-deleted on unlink.
 */
export const spotLinks = sqliteTable(
	'spot_links',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		spotId: integer('spot_id')
			.notNull()
			.references(() => videoSpots.id),
		/** A figure or one of its variations. */
		figureId: integer('figure_id').references(() => figures.id),
		/** A drill (`source = 'custom'`). */
		exerciseId: integer('exercise_id').references(() => exercises.id),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'spot_links_target_ck',
			sql`(${t.figureId} is not null) + (${t.exerciseId} is not null) = 1`
		),
		uniqueIndex('spot_links_spot_figure_idx').on(t.spotId, t.figureId),
		uniqueIndex('spot_links_spot_exercise_idx').on(t.spotId, t.exerciseId),
		index('spot_links_figure_idx').on(t.figureId),
		index('spot_links_exercise_idx').on(t.exerciseId)
	]
);
```

`exercises` is declared before `videoSpots`? If not, the arrow in `references` defers it — fine either way.

- [ ] **Step 2: Generate and read the migration**

Run: `npm run db:generate` then `cat drizzle/0015_*.sql`
Expected: one `CREATE TABLE spot_links`, its four indexes, no `__new_` table, nothing touching other tables.

- [ ] **Step 3: Types**

In `src/lib/types.ts`, replace `Spot` and add after `SpotOwner`:

```ts
export interface Spot {
	id: number;
	startMs: number;
	endMs: number | null;
	label: string | null;
	/** What this section is linked to, "Enchufla · Doble". Empty for a point. */
	linkedTo: string[];
}

/** What a section can be linked to: a figure version or a drill. */
export type SectionTarget = { figureId: number } | { exerciseId: number };

/** One link of a section, as a chip under it on the lesson page. */
export interface SectionLinkChip {
	id: number;
	label: string;
	archived: boolean;
}

/** A section of one video with its links — the lesson page's list. */
export interface VideoSection {
	id: number;
	startMs: number;
	endMs: number;
	label: string | null;
	links: SectionLinkChip[];
}

/** The video a section lives in: enough to open the player and say where it is from. */
export interface SectionVideo {
	owner: SpotOwner;
	/** `/lesson-videos/<file>` or `/recordings/<file>`. */
	src: string;
	from:
		| { kind: 'lesson'; lessonId: number; title: string; lessonDay: string }
		| { kind: 'recording'; figure: string };
}

/** A section linked to a figure version or a drill — one card. */
export interface LinkedSection {
	linkId: number;
	spot: Spot;
	video: SectionVideo;
}

/** A section the "+ Link a section" sheet offers. */
export interface LinkableSection {
	spot: Spot;
}

/** One video's group in the "+ Link a section" sheet. */
export interface SectionGroup {
	video: SectionVideo;
	/** A lesson the target is taught in. */
	taughtHere: boolean;
	sections: Spot[];
}
```

(`LinkableSection` is not needed — omit it.)

- [ ] **Step 4: Typecheck fails where `Spot` is built** — `npx svelte-check` reports `spots.ts` missing `linkedTo`. Task 3 fixes those; commit schema + migration + types together after Task 3 compiles, or commit now with `--no-verify` not needed (no hooks). Commit:

```bash
git add src/lib/server/db/schema.ts drizzle src/lib/types.ts
git commit -m "Section links: the spot_links table and shared shapes"
```

### Task 2: `spot-links.ts` — rules, link, unlink, labels, blockers

**Files:**
- Create: `src/lib/server/spot-links.ts`
- Test: `src/lib/server/spot-links.spec.ts`

**Interfaces — Produces:**

```ts
export class SpotLinkError extends Error { constructor(message: string, readonly status: 400 | 409 = 400) }
export class SpotLinkedError extends Error { readonly labels: string[] } // message: "Linked to A, B (archived) — unlink it first."
export function targetFrom(raw: string | undefined): SectionTarget | null   // "figure:12" | "exercise:5"
export function linkSpot(db: Db, spotId: number, target: SectionTarget): number   // link id; throws SpotLinkError
export function unlinkSpot(db: Db, id: number, target: SectionTarget): boolean
export function getSpotLink(db: Db, id: number): { id: number; spotId: number; target: SectionTarget } | null
export function videoOfSpot(db: Db, spotId: number): { owner: SpotOwner; dance: string; isSection: boolean } | null
export function linkChips(db: Db, spotIds: number[]): Map<number, SectionLinkChip[]>
export function linksBlocking(db: Db, scope: { spotId: number } | SpotOwner): string[]
export function assertUnlinked(db: Db, scope: { spotId: number } | SpotOwner): void   // throws SpotLinkedError
```

Imports only `./db`, `./db/schema`, `drizzle-orm`, `drizzle-orm/sqlite-core` (`alias`) and `$lib/types` — never `figures.ts`, `lessons.ts` or `spots.ts`, which import it.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { addRecording, archiveFigure, createFigure, createVariation } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import {
	assertUnlinked,
	getSpotLink,
	linkChips,
	linksBlocking,
	linkSpot,
	SpotLinkedError,
	SpotLinkError,
	targetFrom,
	unlinkSpot
} from './spot-links';

let db: Db;
let figureId: number;
let doble: number;
let drill: number;
let lessonVideoId: number;
let section: number;
let point: number;

const fig = (dance: 'salsa' | 'bachata', name: string) =>
	createFigure(db, dance, { name, partner: 'partner', style: null, notes: null })!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
	figureId = fig('salsa', 'Enchufla');
	doble = createVariation(db, figureId, { name: 'Doble', notes: null })!.id;
	drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null }).id;
	const { lesson } = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'Cubana', notes: null });
	lessonVideoId = addLessonVideo(db, { lessonId: lesson.id, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 }).id;
	section = addSpot(db, { lessonVideoId }, { startMs: 1000, endMs: 4000, label: 'Enchufla' })!.id;
	point = addSpot(db, { lessonVideoId }, { startMs: 500, endMs: null, label: null })!.id;
});

describe('targetFrom', () => {
	it('reads figure:<id> and exercise:<id>', () => {
		expect(targetFrom('figure:12')).toEqual({ figureId: 12 });
		expect(targetFrom('exercise:5')).toEqual({ exerciseId: 5 });
	});
	it.each([undefined, '', 'figure:', 'figure:0', 'routine:3', 'figure:1.5', 'figure:-2'])(
		'refuses %s',
		(raw) => expect(targetFrom(raw)).toBeNull()
	);
});

describe('linkSpot', () => {
	it('links a section to a figure, a variation and a drill', () => {
		linkSpot(db, section, { figureId });
		linkSpot(db, section, { figureId: doble });
		linkSpot(db, section, { exerciseId: drill });
		expect(linkChips(db, [section]).get(section)!.map((c) => c.label)).toEqual([
			'Clave',
			'Enchufla',
			'Enchufla · Doble'
		]);
	});
	it('refuses a point', () => {
		expect(() => linkSpot(db, point, { figureId })).toThrow(SpotLinkError);
	});
	it('refuses a target of the other dance', () => {
		const bachata = fig('bachata', 'Paseo');
		expect(() => linkSpot(db, section, { figureId: bachata })).toThrow(/dance/);
	});
	it('refuses an exercise that is not a drill', () => {
		const { lesson } = createLesson(db, 'salsa', { lessonDay: '2026-10-01', title: 'X', notes: null });
		const review = db.query.exercises.findFirst({ where: (e, { eq }) => eq(e.lessonId, lesson.id) });
		expect(() => linkSpot(db, section, { exerciseId: review!.id })).toThrow(/drill/);
	});
	it('refuses the same pair twice with a 409', () => {
		linkSpot(db, section, { figureId });
		try {
			linkSpot(db, section, { figureId });
			expect.unreachable();
		} catch (e) {
			expect((e as SpotLinkError).status).toBe(409);
		}
	});
	it('refuses a missing spot or target', () => {
		expect(() => linkSpot(db, 999, { figureId })).toThrow(SpotLinkError);
		expect(() => linkSpot(db, section, { figureId: 999 })).toThrow(SpotLinkError);
	});
});

describe('unlinkSpot', () => {
	it('is scoped to its target', () => {
		const id = linkSpot(db, section, { figureId });
		expect(unlinkSpot(db, id, { figureId: doble })).toBe(false);
		expect(unlinkSpot(db, id, { figureId })).toBe(true);
		expect(getSpotLink(db, id)).toBeNull();
	});
	it('leaves the section’s other links', () => {
		const a = linkSpot(db, section, { figureId });
		linkSpot(db, section, { exerciseId: drill });
		unlinkSpot(db, a, { figureId });
		expect(linksBlocking(db, { spotId: section })).toEqual(['Clave']);
	});
});

describe('linksBlocking', () => {
	it('names the targets of a spot and of a whole video, archived marked', () => {
		linkSpot(db, section, { figureId: doble });
		archiveFigure(db, figureId, Date.now());
		expect(linksBlocking(db, { spotId: section })).toEqual(['Enchufla · Doble (archived)']);
		expect(linksBlocking(db, { lessonVideoId })).toEqual(['Enchufla · Doble (archived)']);
		expect(() => assertUnlinked(db, { lessonVideoId })).toThrow(SpotLinkedError);
	});
	it('is empty when nothing links', () => {
		expect(linksBlocking(db, { lessonVideoId })).toEqual([]);
		expect(() => assertUnlinked(db, { spotId: section })).not.toThrow();
	});
	it('covers recordings too', () => {
		const rec = addRecording(db, {
			figureId, file: 'r.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: 1, note: null
		}).id;
		const s = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: null })!.id;
		linkSpot(db, s, { exerciseId: drill });
		expect(linksBlocking(db, { recordingId: rec })).toEqual(['Clave']);
	});
});
```

If `db.query` (relational API) is not set up in `openDb`, read the review exercise with `db.select().from(exercises).where(eq(exercises.lessonId, lesson.id)).get()` instead (import `exercises` from `./db/schema`, `eq` from `drizzle-orm`).

- [ ] **Step 2: Run** `npx vitest run src/lib/server/spot-links.spec.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Sections of a video linked to figure versions and drills. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Every rule the table cannot carry lives here: a section and not a point, one
 * dance, drills only. Imported BY `spots.ts`, `figures.ts` and `lessons.ts` —
 * their deletes ask `assertUnlinked` first — so it imports none of them.
 */
import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import { exercises, figures, lessons, lessonVideos, recordings, spotLinks, videoSpots } from './db/schema';
import type { SectionLinkChip, SectionTarget, SpotOwner } from '$lib/types';

export class SpotLinkError extends Error {
	constructor(message: string, readonly status: 400 | 409 = 400) {
		super(message);
	}
}

export class SpotLinkedError extends Error {
	constructor(readonly labels: string[]) {
		super(`Linked to ${labels.join(', ')} — unlink it first.`);
	}
}

export function targetFrom(raw: string | undefined): SectionTarget | null {
	const m = /^(figure|exercise):(\d+)$/.exec(raw ?? '');
	if (!m) return null;
	const id = Number(m[2]);
	if (!Number.isSafeInteger(id) || id < 1) return null;
	return m[1] === 'figure' ? { figureId: id } : { exerciseId: id };
}

/** The video a spot lives in, and that video's dance. */
export function videoOfSpot(db: Db, spotId: number) {
	const row = db
		.select({
			endMs: videoSpots.endMs,
			lessonVideoId: videoSpots.lessonVideoId,
			recordingId: videoSpots.recordingId,
			lessonDance: lessons.dance,
			figureDance: figures.dance
		})
		.from(videoSpots)
		.leftJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.leftJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.leftJoin(recordings, eq(recordings.id, videoSpots.recordingId))
		.leftJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(videoSpots.id, spotId))
		.get();
	if (!row) return null;
	const owner: SpotOwner =
		row.lessonVideoId !== null ? { lessonVideoId: row.lessonVideoId } : { recordingId: row.recordingId! };
	return { owner, dance: (row.lessonDance ?? row.figureDance)!, isSection: row.endMs !== null };
}

function targetDance(db: Db, target: SectionTarget): string {
	if ('figureId' in target) {
		const f = db.select({ dance: figures.dance }).from(figures).where(eq(figures.id, target.figureId)).get();
		if (!f) throw new SpotLinkError('No such figure.');
		return f.dance;
	}
	const e = db
		.select({ dance: exercises.dance, source: exercises.source })
		.from(exercises)
		.where(eq(exercises.id, target.exerciseId))
		.get();
	if (!e) throw new SpotLinkError('No such exercise.');
	if (e.source !== 'custom') throw new SpotLinkError('Only a drill can have sections of its own.');
	return e.dance;
}

const targetColumn = (target: SectionTarget) =>
	'figureId' in target ? eq(spotLinks.figureId, target.figureId) : eq(spotLinks.exerciseId, target.exerciseId);

/** The new link's id. Throws `SpotLinkError` for a point, another dance, a non-drill, a duplicate. */
export function linkSpot(db: Db, spotId: number, target: SectionTarget): number {
	const video = videoOfSpot(db, spotId);
	if (!video) throw new SpotLinkError('No such section.');
	if (!video.isSection) throw new SpotLinkError('Only a section can be linked, not a point.');
	if (targetDance(db, target) !== video.dance) {
		throw new SpotLinkError('That section is from the other dance.');
	}
	const taken = db
		.select({ id: spotLinks.id })
		.from(spotLinks)
		.where(and(eq(spotLinks.spotId, spotId), targetColumn(target)))
		.get();
	if (taken) throw new SpotLinkError('Already linked.', 409);
	return db.insert(spotLinks).values({ spotId, ...target }).returning({ id: spotLinks.id }).get().id;
}

export function unlinkSpot(db: Db, id: number, target: SectionTarget): boolean {
	return db.delete(spotLinks).where(and(eq(spotLinks.id, id), targetColumn(target))).run().changes > 0;
}

export function getSpotLink(db: Db, id: number) {
	const row = db.select().from(spotLinks).where(eq(spotLinks.id, id)).get();
	if (!row) return null;
	const target: SectionTarget =
		row.figureId !== null ? { figureId: row.figureId } : { exerciseId: row.exerciseId! };
	return { id: row.id, spotId: row.spotId, target };
}

/** Every link of these spots, labelled, alphabetical per spot. */
export function linkChips(db: Db, spotIds: number[]): Map<number, SectionLinkChip[]> {
	const out = new Map<number, SectionLinkChip[]>();
	if (spotIds.length === 0) return out;
	const parent = alias(figures, 'parent');
	const rows = db
		.select({
			id: spotLinks.id,
			spotId: spotLinks.spotId,
			figure: figures.name,
			figureArchived: figures.archivedAt,
			parent: parent.name,
			parentArchived: parent.archivedAt,
			drill: exercises.name,
			drillArchived: exercises.archivedAt
		})
		.from(spotLinks)
		.leftJoin(figures, eq(figures.id, spotLinks.figureId))
		.leftJoin(parent, eq(parent.id, figures.parentId))
		.leftJoin(exercises, eq(exercises.id, spotLinks.exerciseId))
		.where(inArray(spotLinks.spotId, spotIds))
		.all();
	for (const r of rows) {
		const label = r.figure !== null ? (r.parent !== null ? `${r.parent} · ${r.figure}` : r.figure) : r.drill!;
		const archived = (r.figure !== null ? (r.figureArchived ?? r.parentArchived) : r.drillArchived) !== null;
		const list = out.get(r.spotId) ?? [];
		list.push({ id: r.id, label, archived });
		out.set(r.spotId, list);
	}
	for (const list of out.values()) list.sort((a, b) => a.label.localeCompare(b.label));
	return out;
}

function spotIdsOf(db: Db, scope: { spotId: number } | SpotOwner): number[] {
	if ('spotId' in scope) return [scope.spotId];
	const where =
		'recordingId' in scope
			? eq(videoSpots.recordingId, scope.recordingId)
			: eq(videoSpots.lessonVideoId, scope.lessonVideoId);
	return db.select({ id: videoSpots.id }).from(videoSpots).where(where).all().map((r) => r.id);
}

/** What stops this spot, or this video, from being deleted. Empty when nothing does. */
export function linksBlocking(db: Db, scope: { spotId: number } | SpotOwner): string[] {
	const labels = [...linkChips(db, spotIdsOf(db, scope)).values()]
		.flat()
		.map((c) => (c.archived ? `${c.label} (archived)` : c.label));
	return [...new Set(labels)].sort((a, b) => a.localeCompare(b));
}

export function assertUnlinked(db: Db, scope: { spotId: number } | SpotOwner): void {
	const labels = linksBlocking(db, scope);
	if (labels.length > 0) throw new SpotLinkedError(labels);
}
```

Drop unused imports (`asc`, `isNotNull`, `or`) that lint flags; Task 4 adds what it needs.

- [ ] **Step 4: Run** `npx vitest run src/lib/server/spot-links.spec.ts` — PASS.

- [ ] **Step 5: Commit** `git add src/lib/server/spot-links.ts src/lib/server/spot-links.spec.ts && git commit -m "Section links: link, unlink, and what blocks a delete"`

### Task 3: Deletes refuse; spots carry `linkedTo`; the API's 409

**Files:**
- Modify: `src/lib/server/spots.ts` (`listSpots`, `addSpot`, `renameSpot`, `deleteSpot`)
- Modify: `src/lib/server/figures.ts:211` (`deleteRecording`)
- Modify: `src/lib/server/lessons.ts:507` (`deleteLessonVideo`)
- Modify: `src/routes/api/video-spots/[id]/+server.ts` (DELETE)
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts` (`deleteVideo`)
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (`deleteRecording`)
- Modify tests: `src/lib/server/spots.spec.ts`, `src/routes/api/video-spots/video-spots.spec.ts`

**Interfaces — Consumes:** `assertUnlinked`, `linkChips`, `SpotLinkedError` from Task 2.
**Produces:** `deleteSpot`, `deleteRecording`, `deleteLessonVideo` throw `SpotLinkedError` (and delete nothing) when linked; every `Spot` returned has `linkedTo`.

- [ ] **Step 1: Failing tests** — append to `spots.spec.ts`:

```ts
describe('linked sections', () => {
	it('refuse to delete, as do their videos, and nothing goes', () => {
		const { figure } = createFigure(db, 'salsa', { name: 'Dile que no', partner: 'partner', style: 'salsa', notes: null })!;
		for (const owner of [{ recordingId }, { lessonVideoId }]) {
			const s = addSpot(db, owner, { startMs: 0, endMs: 1000, label: null })!;
			linkSpot(db, s.id, { figureId: figure.id });
			expect(() => deleteSpot(db, s.id)).toThrow(SpotLinkedError);
			expect(listSpots(db, owner)[0].linkedTo).toEqual(['Dile que no']);
		}
		expect(() => deleteRecording(db, recordingId)).toThrow(SpotLinkedError);
		expect(() => deleteLessonVideo(db, lessonVideoId)).toThrow(SpotLinkedError);
		expect(listSpots(db, { recordingId })).toHaveLength(1);
		expect(listSpots(db, { lessonVideoId })).toHaveLength(1);
	});
	it('rename keeps linkedTo', () => {
		const { figure } = createFigure(db, 'salsa', { name: 'Setenta', partner: 'partner', style: 'salsa', notes: null })!;
		const s = addSpot(db, { lessonVideoId }, { startMs: 0, endMs: 1000, label: null })!;
		linkSpot(db, s.id, { figureId: figure.id });
		expect(renameSpot(db, s.id, 'x')!.linkedTo).toEqual(['Setenta']);
	});
});
```

Update the existing `toEqual({ id, startMs, endMs, label })` expectations to include `linkedTo: []`. In `video-spots.spec.ts` add: link a section (import `linkSpot`, `createFigure`), `DELETE` → expect a thrown SvelteKit `HttpError` with `status: 409` and a body message starting "Linked to"; `GET` returns `linkedTo`.

- [ ] **Step 2: Run** `npx vitest run src/lib/server/spots.spec.ts src/routes/api/video-spots` — FAIL.

- [ ] **Step 3: Implement**

`spots.ts`:

```ts
import { assertUnlinked, linkChips } from './spot-links';

/** Rows straight from the table, plus what each is linked to. */
function withLinks(db: Db, rows: Omit<Spot, 'linkedTo'>[]): Spot[] {
	const chips = linkChips(db, rows.map((r) => r.id));
	return rows.map((r) => ({ ...r, linkedTo: (chips.get(r.id) ?? []).map((c) => c.label) }));
}
```

`listSpots` returns `withLinks(db, rows)`; `addSpot` returns `{ ...row, linkedTo: [] }`; `renameSpot` returns `row ? withLinks(db, [row])[0] : null`; `deleteSpot`:

```ts
/** Whether a row went. Throws `SpotLinkedError` while the section is linked. */
export function deleteSpot(db: Db, id: number): boolean {
	return db.transaction((tx) => {
		assertUnlinked(tx, { spotId: id });
		return tx.delete(videoSpots).where(eq(videoSpots.id, id)).returning().get() !== undefined;
	});
}
```

(`tx` is assignable to `Db` here, as elsewhere in the codebase; if not, call `assertUnlinked(db, …)` just before the transaction.)

`deleteRecording` / `deleteLessonVideo`: first line inside the transaction `assertUnlinked(tx, { recordingId: id })` / `assertUnlinked(tx, { lessonVideoId: id })`; doc comments add "Throws `SpotLinkedError`, deleting nothing, while one of its sections is linked."

API `[id]/+server.ts` DELETE:

```ts
export const DELETE: RequestHandler = ({ params }) => {
	try {
		if (!deleteSpot(getDb(), spotId(params.id))) throw error(404, 'No such spot');
	} catch (e) {
		if (e instanceof SpotLinkedError) throw error(409, e.message);
		throw e;
	}
	return new Response(null, { status: 204 });
};
```

Lesson `deleteVideo` and figure `deleteRecording` actions wrap the data call:

```ts
let row;
try {
	row = deleteLessonVideo(getDb(), id);
} catch (e) {
	if (e instanceof SpotLinkedError) {
		return fail(409, { action: 'deleteVideo', videoId: id, message: e.message });
	}
	throw e;
}
```

(figure: `action: 'deleteRecording', recordingId: id`).

- [ ] **Step 4: Run** the two specs plus `src/lib/server/data.spec.ts src/lib/server/lessons.spec.ts` — PASS.

- [ ] **Step 5: Show the refusals** — lesson page: under each video's footer, `{#if form?.action === 'deleteVideo' && form.videoId === video.id}<p class="px-3 pb-2 text-[13px] text-danger" role="alert">{form.message}</p>{/if}`; figure page the same under a recording with `recordingId`.

- [ ] **Step 6: Commit** `git commit -am "Section links: a linked section or its video refuses to delete"` (plus the spec files).

### Task 4: Reads — cards, the link sheet, a video's sections

**Files:**
- Modify: `src/lib/server/spot-links.ts`
- Test: `src/lib/server/spot-links.spec.ts`

**Interfaces — Produces:**

```ts
export function sectionsFor(db: Db, target: SectionTarget): LinkedSection[]
export function linkableSections(db: Db, target: SectionTarget): SectionGroup[]
export function videoSections(db: Db, owner: SpotOwner): VideoSection[]
```

- [ ] **Step 1: Failing tests**

```ts
describe('reads', () => {
	it('sectionsFor is per version, with its video', () => {
		linkSpot(db, section, { figureId: doble });
		expect(sectionsFor(db, { figureId })).toEqual([]);
		const [card] = sectionsFor(db, { figureId: doble });
		expect(card.spot).toMatchObject({ id: section, startMs: 1000, endMs: 4000, label: 'Enchufla' });
		expect(card.video).toEqual({
			owner: { lessonVideoId },
			src: '/lesson-videos/l.mp4',
			from: { kind: 'lesson', lessonId: expect.any(Number), title: 'Cubana', lessonDay: '2026-10-12' }
		});
	});
	it('linkableSections puts taught-here first, leaves out points and what is linked', () => {
		const { lesson: other } = createLesson(db, 'salsa', { lessonDay: '2026-10-14', title: 'Later', notes: null });
		const v2 = addLessonVideo(db, { lessonId: other.id, file: 'm.mp4', mime: 'video/mp4', sizeBytes: 1 }).id;
		const s2 = addSpot(db, { lessonVideoId: v2 }, { startMs: 0, endMs: 500, label: null })!.id;
		// Cubana teaches Enchufla: the variation counts it as taught here too.
		const cubana = sectionsLesson(); // helper: the beforeEach lesson's id
		linkFigure(db, cubana, figureId);
		const groups = linkableSections(db, { figureId: doble });
		expect(groups.map((g) => [g.video.src, g.taughtHere])).toEqual([
			['/lesson-videos/l.mp4', true],
			['/lesson-videos/m.mp4', false]
		]);
		expect(groups[0].sections.map((s) => s.id)).toEqual([section]);
		linkSpot(db, s2, { figureId: doble });
		expect(linkableSections(db, { figureId: doble }).map((g) => g.video.src)).toEqual(['/lesson-videos/l.mp4']);
	});
	it('videoSections lists sections with chips, archived flagged', () => {
		linkSpot(db, section, { exerciseId: drill });
		expect(videoSections(db, { lessonVideoId })).toEqual([
			{ id: section, startMs: 1000, endMs: 4000, label: 'Enchufla', links: [{ id: expect.any(Number), label: 'Clave', archived: false }] }
		]);
	});
});
```

Keep the beforeEach lesson's id in a `let lessonId` (assigned in `beforeEach`) and use it instead of the `sectionsLesson()` placeholder name above; import `linkFigure` from `./lessons`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** (add `asc`, `desc`, `isNull`, `isNotNull`, `notInArray` imports as used)

```ts
const SPOT = { id: videoSpots.id, startMs: videoSpots.startMs, endMs: videoSpots.endMs, label: videoSpots.label };

/** Every video of a dance with sections, in sheet order: lessons newest first, then recordings by figure. */
function videosOf(db: Db, dance: string): SectionVideo[] {
	const lessonRows = db
		.select({ id: lessonVideos.id, file: lessonVideos.file, lessonId: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(eq(lessons.dance, dance), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id), asc(lessonVideos.id))
		.all();
	const parent = alias(figures, 'parent');
	const recRows = db
		.select({ id: recordings.id, file: recordings.file, name: figures.name, parent: parent.name })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.leftJoin(parent, eq(parent.id, figures.parentId))
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), eq(recordings.kind, 'video')))
		.orderBy(asc(figures.name), asc(recordings.id))
		.all();
	return [
		...lessonRows.map((r) => ({
			owner: { lessonVideoId: r.id },
			src: `/lesson-videos/${r.file}`,
			from: { kind: 'lesson' as const, lessonId: r.lessonId, title: r.title, lessonDay: r.lessonDay }
		})),
		...recRows.map((r) => ({
			owner: { recordingId: r.id },
			src: `/recordings/${r.file}`,
			from: { kind: 'recording' as const, figure: r.parent ? `${r.parent} · ${r.name}` : r.name }
		}))
	];
}

/** The dance of a target and the lessons it is taught in (a version counts its figure's). */
function targetContext(db: Db, target: SectionTarget): { dance: string; taught: Set<number> } {
	if ('figureId' in target) {
		const f = db.select({ dance: figures.dance, parentId: figures.parentId }).from(figures).where(eq(figures.id, target.figureId)).get();
		if (!f) return { dance: '', taught: new Set() };
		const ids = [target.figureId, ...(f.parentId === null ? [] : [f.parentId])];
		const rows = db.select({ id: lessonFigures.lessonId }).from(lessonFigures).where(inArray(lessonFigures.figureId, ids)).all();
		return { dance: f.dance, taught: new Set(rows.map((r) => r.id)) };
	}
	const e = db.select({ dance: exercises.dance }).from(exercises).where(eq(exercises.id, target.exerciseId)).get();
	if (!e) return { dance: '', taught: new Set() };
	const rows = db.select({ id: lessonExercises.lessonId }).from(lessonExercises).where(eq(lessonExercises.exerciseId, target.exerciseId)).all();
	return { dance: e.dance, taught: new Set(rows.map((r) => r.id)) };
}

const ownerKey = (o: SpotOwner) => ('recordingId' in o ? `r${o.recordingId}` : `l${o.lessonVideoId}`);

/** Sections (never points) of the given videos, by video then start. */
function sectionsByVideo(db: Db): Map<string, Omit<Spot, 'linkedTo'>[]> {
	const rows = db
		.select({ ...SPOT, recordingId: videoSpots.recordingId, lessonVideoId: videoSpots.lessonVideoId })
		.from(videoSpots)
		.where(isNotNull(videoSpots.endMs))
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
	const out = new Map<string, Omit<Spot, 'linkedTo'>[]>();
	for (const { recordingId, lessonVideoId, ...spot } of rows) {
		const key = recordingId !== null ? `r${recordingId}` : `l${lessonVideoId}`;
		out.set(key, [...(out.get(key) ?? []), spot]);
	}
	return out;
}

function labelled(db: Db, spots: Omit<Spot, 'linkedTo'>[]): Spot[] {
	const chips = linkChips(db, spots.map((s) => s.id));
	return spots.map((s) => ({ ...s, linkedTo: (chips.get(s.id) ?? []).map((c) => c.label) }));
}

export function linkableSections(db: Db, target: SectionTarget): SectionGroup[] {
	const { dance, taught } = targetContext(db, target);
	if (!dance) return [];
	const linked = new Set(
		db.select({ id: spotLinks.spotId }).from(spotLinks).where(targetColumn(target)).all().map((r) => r.id)
	);
	const byVideo = sectionsByVideo(db);
	const groups = videosOf(db, dance)
		.map((video) => ({
			video,
			taughtHere: video.from.kind === 'lesson' && taught.has(video.from.lessonId),
			sections: labelled(db, (byVideo.get(ownerKey(video.owner)) ?? []).filter((s) => !linked.has(s.id)))
		}))
		.filter((g) => g.sections.length > 0);
	// Stable: taught-here lessons keep their newest-first order ahead of the rest.
	return [...groups.filter((g) => g.taughtHere), ...groups.filter((g) => !g.taughtHere)];
}

export function sectionsFor(db: Db, target: SectionTarget): LinkedSection[] {
	const { dance } = targetContext(db, target);
	if (!dance) return [];
	const links = db
		.select({ linkId: spotLinks.id, spotId: spotLinks.spotId })
		.from(spotLinks)
		.where(targetColumn(target))
		.all();
	const linkOf = new Map(links.map((l) => [l.spotId, l.linkId]));
	const byVideo = sectionsByVideo(db);
	// The target's dance: a link can only be made within one, so its videos are all here.
	return videosOf(db, dance).flatMap((video) =>
		labelled(db, (byVideo.get(ownerKey(video.owner)) ?? []).filter((s) => linkOf.has(s.id))).map((spot) => ({
			linkId: linkOf.get(spot.id)!,
			spot,
			video
		}))
	);
}

export function videoSections(db: Db, owner: SpotOwner): VideoSection[] {
	const spots = (sectionsByVideo(db).get(ownerKey(owner)) ?? []) as (Omit<Spot, 'linkedTo'> & { endMs: number })[];
	const chips = linkChips(db, spots.map((s) => s.id));
	return spots.map((s) => ({ ...s, links: chips.get(s.id) ?? [] }));
}
```

`sectionsByVideo` reads every section of every video: fine at this app's size (one user, dozens of videos). `videoSections` may instead filter by owner in SQL if preferred — same result.

A link to a section whose video's lesson is archived drops out of `sectionsFor` (the lesson is gone from every list); it still blocks deletes and shows in no chip list. Accepted; the lesson is archived, not deleted, and comes back with it.

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `"Section links: cards, the link sheet, a video's sections"`.

### Task 5: Player `loopSpot`, `linkedTo`, the 409 note; `SectionCard`; API error text

**Files:**
- Modify: `src/lib/video/spots-api.ts` (`ok` reads the server's message)
- Modify: `src/lib/components/ui/VideoPlayer.svelte`
- Modify: `src/lib/components/ui/VideoFrame.svelte` (optional `onclosed`)
- Create: `src/lib/components/ui/SectionCard.svelte`
- Test: `src/lib/video/spots-api.spec.ts` if one exists; else none (component)

**Interfaces — Produces:**
- `VideoPlayer` prop `loopSpot?: Spot` — opens at its start, looping, playing.
- `VideoFrame` prop `onclosed?: () => void` — called after the player closes.
- `SectionCard` props `{ section: LinkedSection; onunlink?: () => void }` → renders the card; tap opens `VideoPlayer` with `loopSpot`. When `onunlink` is absent, no ×. The unlink form is the page's business: the card takes a `children` snippet slot `unlink?: Snippet` instead of a callback — the page passes its `<form>`.

- [ ] **Step 1: `spots-api.ts`**

```ts
/** A non-2xx answer, carrying the server's message — the player shows a 409's. */
export class SpotsApiError extends Error {
	constructor(readonly status: number, message: string) {
		super(message);
	}
}

async function ok(res: Response): Promise<Response> {
	if (res.ok) return res;
	const body = await res.json().catch(() => null);
	const message = body && typeof body.message === 'string' ? body.message : `video-spots: ${res.status}`;
	throw new SpotsApiError(res.status, message);
}
```

- [ ] **Step 2: `VideoPlayer.svelte`**
  - Props: add `/** A section to open on, looping. */ loopSpot?: Spot;` and destructure it.
  - `let loop = $state<Spot | null>(loopSpot ?? null);` (svelte may warn about capturing a prop's initial value — wrap as `untrack(() => loopSpot ?? null)` per existing style, or add the `// svelte-ignore state_referenced_locally` the codebase uses).
  - `onloadedmetadata`: `video.currentTime = loopSpot ? loopSpot.startMs / 1000 : startAt; if (loopSpot) void video.play().catch(() => {});`
  - `remove(spot)` catch: `flash(e instanceof SpotsApiError && e.status === 409 ? e.message : "Couldn't save")`.
  - In the panel row button, after the label: `{#if s.linkedTo.length > 0}<span class="block text-[12px] opacity-60">→ {s.linkedTo.join(', ')}</span>{/if}`.

- [ ] **Step 3: `VideoFrame.svelte`** — prop `onclosed?: () => void`; in the player's `onclose` call `onclosed?.()` after `fullAt = null`.

- [ ] **Step 4: `SectionCard.svelte`**

```svelte
<!-- src/lib/components/ui/SectionCard.svelte -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { dateLabel } from '$lib/format';
	import { loadVideoPrefs, saveVideoPrefs, type VideoRate } from '$lib/video-prefs';
	import { spotLabel } from '$lib/video/spots';
	import VideoPlayer from './VideoPlayer.svelte';
	import type { LinkedSection } from '$lib/types';

	/** A linked section: where it is from and what it is. A tap plays it, looping. */
	let { section, unlink }: { section: LinkedSection; unlink?: Snippet } = $props();

	let mirror = $state(false);
	let rate = $state<VideoRate>(1);
	onMount(() => ({ mirror, rate } = loadVideoPrefs()));
	let open = $state(false);

	const from = $derived(
		section.video.from.kind === 'lesson'
			? `${section.video.from.title} · ${dateLabel(section.video.from.lessonDay)}`
			: `Recording · ${section.video.from.figure}`
	);
</script>

<div class="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2">
	<button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => (open = true)}>
		<span class="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden="true">▶</span>
		<span class="min-w-0">
			<span class="block truncate text-[12px] text-muted">{from}</span>
			<span class="block truncate text-[15px]">{spotLabel(section.spot)}</span>
			{#if section.spot.label}<span class="text-[12px] text-muted">{spotLabel({ ...section.spot, label: null })}</span>{/if}
		</span>
	</button>
	{@render unlink?.()}
</div>

{#if open}
	<VideoPlayer
		src={section.video.src}
		owner={section.video.owner}
		startAt={section.spot.startMs / 1000}
		loopSpot={section.spot}
		{mirror}
		{rate}
		onchoose={(next) => {
			mirror = next.mirror ?? mirror;
			rate = next.rate ?? rate;
			saveVideoPrefs({ mirror, rate });
		}}
		onclose={() => (open = false)}
	/>
{/if}
```

- [ ] **Step 5:** `npx svelte-check` clean for these files. **Commit** `"Section links: the player opens on a section, shows its links, explains a refused delete"`.

### Task 6: Lesson page — sections under each video

**Files:**
- Modify: `src/routes/[dance]/lessons/[id]/+page.server.ts`
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte`
- Create: `src/lib/components/lessons/VideoSections.svelte`
- Test: `src/routes/[dance]/lessons/[id]/sections.spec.ts` (mocked db, like `dance-wall.spec.ts`)

**Interfaces — Consumes:** `videoSections`, `linkSpot`, `unlinkSpot`, `getSpotLink`, `videoOfSpot`, `targetFrom`, `SpotLinkError`; `listVersions` (figures.ts), `listExercises` or a drills query.
**Produces:** load adds `sections: Record<number, VideoSection[]>` (by lesson video id) and `sectionTargets: { thisLesson: Option[]; figures: Option[]; drills: Option[] }` with `Option = { value: string; label: string }`; actions `linkSection` (`spotId`, `target`) and `unlinkSection` (`linkId`).

- [ ] **Step 1: Failing route test** — with the mocked db: a lesson with a video and a section; posting `linkSection` with `target=figure:<id>` links it; a `spotId` from another lesson's video → 404 `fail`; a bachata figure → 400 with the dance message; `unlinkSection` with a link whose spot is on another lesson → 404 and the link survives. Call the action as `dance-wall.spec.ts` calls actions (copy its request/params helper).

- [ ] **Step 2: Implement the server side**

```ts
/** The spot, if it is on one of THIS lesson's videos; else a 404 — a posted id is just a number. */
function spotOfLesson(found: ReturnType<typeof lessonOf>, spotId: number | undefined) {
	if (spotId === undefined) return null;
	const video = videoOfSpot(getDb(), spotId);
	if (!video || !('lessonVideoId' in video.owner)) return null;
	const lessonVideoId = video.owner.lessonVideoId;
	return found.videos.some((v) => v.id === lessonVideoId) ? spotId : null;
}
```

load:

```ts
const versions = listVersions(db, found.lesson.dance as DanceSlug);
const taughtFigureIds = new Set(found.figures.map((f) => f.id));
const drills = listExercises(db, found.lesson.dance as DanceSlug).filter((e) => e.source === 'custom');
const lessonDrillIds = new Set(found.exercises.filter((e) => e.source === 'custom').map((e) => e.id));
const opt = (kind: 'figure' | 'exercise', id: number, label: string) => ({ value: `${kind}:${id}`, label });
// ... sectionTargets:
{
	thisLesson: [
		...versions.filter((v) => taughtFigureIds.has(v.parentId ?? v.id)).map((v) => opt('figure', v.id, v.label)),
		...drills.filter((d) => lessonDrillIds.has(d.id)).map((d) => opt('exercise', d.id, d.name))
	],
	figures: versions.filter((v) => !taughtFigureIds.has(v.parentId ?? v.id)).map((v) => opt('figure', v.id, v.label)),
	drills: drills.filter((d) => !lessonDrillIds.has(d.id)).map((d) => opt('exercise', d.id, d.name))
},
sections: Object.fromEntries(found.videos.map((v) => [v.id, videoSections(db, { lessonVideoId: v.id })]))
```

(Check `listExercises`'s row shape for `source` and `name`; if it lacks `source`, add a small `listDrills(db, dance)` to `exercises.ts`: unarchived `source = 'custom'` of the dance, by name.)

actions:

```ts
linkSection: async ({ params, request }) => {
	const found = lessonOf(params);
	const form = await request.formData();
	const spotId = spotOfLesson(found, int(form, 'spotId'));
	if (spotId === null) return fail(404, { action: 'linkSection', message: 'That section is gone.' });
	const target = targetFrom(text(form, 'target'));
	if (!target) return fail(400, { action: 'linkSection', spotId, message: 'Pick a figure or a drill.' });
	try {
		linkSpot(getDb(), spotId, target);
	} catch (e) {
		if (e instanceof SpotLinkError) return fail(e.status, { action: 'linkSection', spotId, message: e.message });
		throw e;
	}
	return { action: 'linkSection', ok: true };
},

unlinkSection: async ({ params, request }) => {
	const found = lessonOf(params);
	const id = int(await request.formData(), 'linkId');
	const link = id === undefined ? null : getSpotLink(getDb(), id);
	// The link's section must be on this lesson's videos; then unlink by its own target.
	if (!link || spotOfLesson(found, link.spotId) === null) {
		return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
	}
	unlinkSpot(getDb(), link.id, link.target);
	return { action: 'unlinkSection', ok: true };
}
```

- [ ] **Step 3: `VideoSections.svelte`** — props `{ sections: VideoSection[]; video: { src: string; owner: SpotOwner }; targets: SectionTargets; failure: { spotId: number; message: string } | null }`. For each section: a row with ▶ (opens `VideoPlayer` with `loopSpot` — build a `Spot` from the row: `{ id, startMs, endMs, label, linkedTo: links.map(l => l.label) }`), its `spotLabel`, the range when labelled; chips `→ {label}{archived ? ' (archived)' : ''}` each with a `use:enhance` form posting `linkId` to `?/unlinkSection` and an `×` button (`aria-label="Unlink {label}"`); a **Link…** toggle revealing a `use:enhance` form with `<select name="target">` (`<optgroup label="This lesson">`, `"Other figures"`, `"Drills"`, each option omitted when already in the section's chips by label — compare by `value` is impossible client-side, so the server also refuses duplicates with 409 "Already linked.") and a hidden `spotId`. Empty list: "No sections yet. Open the video full screen and tap Section to mark one."  `SectionTargets` and its `Option` go in `src/lib/types.ts`.

- [ ] **Step 4: Wire into the lesson page** — inside each video `<li>`, after the size/delete footer: `<VideoSections sections={data.sections[video.id] ?? []} video={{ src: '/lesson-videos/' + video.file, owner: { lessonVideoId: video.id } }} targets={data.sectionTargets} failure={…} />`; pass `onclosed={() => invalidateAll()}` to that video's `VideoFrame` (import from `$app/navigation`); VideoSections' own player closing also calls `invalidateAll()`.

- [ ] **Step 5: Run** the route spec and `npx svelte-check` — PASS. **Commit** `"Section links: the lesson page lists each video's sections and links them"`.

### Task 7: Figure page — Sections per version

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts`
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte`
- Create: `src/lib/components/ui/LinkSectionSheet.svelte`

**Interfaces — Consumes:** `sectionsFor`, `linkableSections`, `linkSpot`, `unlinkSpot`, `SectionCard` (Task 5).
**Produces:** load adds `version.sections: LinkedSection[]` and `linkable: SectionGroup[]`; actions `linkSection` (`versionId`, `spotId`) and `unlinkSection` (`versionId`, `linkId`).

- [ ] **Step 1: Server**

load (beside `recordings: version.recordings`): `sections: sectionsFor(db, { figureId: versionId })`, and top-level `linkable: linkableSections(db, { figureId: versionId })`.

actions:

```ts
linkSection: async ({ params, request }) => {
	const form = await request.formData();
	const found = versionOf(figureOf(params), int(form, 'versionId'));
	const spotId = int(form, 'spotId');
	if (spotId === undefined) return fail(400, { action: 'linkSection', message: 'Pick a section.' });
	try {
		linkSpot(getDb(), spotId, { figureId: found.figure.id });
	} catch (e) {
		if (e instanceof SpotLinkError) return fail(e.status, { action: 'linkSection', message: e.message });
		throw e;
	}
	return { action: 'linkSection', ok: true };
},
unlinkSection: async ({ params, request }) => {
	const form = await request.formData();
	const found = versionOf(figureOf(params), int(form, 'versionId'));
	const id = int(form, 'linkId');
	if (id === undefined || !unlinkSpot(getDb(), id, { figureId: found.figure.id })) {
		return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
	}
	return { action: 'unlinkSection', ok: true };
}
```

`linkSpot` already refuses a section from the other dance, so a posted spot id cannot cross the wall.

- [ ] **Step 2: `LinkSectionSheet.svelte`** — props `{ open: boolean; onclose: () => void; groups: SectionGroup[]; hidden: Record<string, string | number>; message: string | null }`. Inside the existing `Sheet` (title "Link a section"): for each group a heading (`{title} · {dateLabel(day)}` or `Recording · {figure}`, plus a small "taught here" tag), then each section: ▶ preview (a `VideoPlayer` with `loopSpot`, as in `SectionCard`), `spotLabel`, `→ linkedTo` muted, and a `use:enhance` form posting the `hidden` fields plus `spotId` to `?/linkSection` with a **Link** button. Empty: "No sections to link. Mark one: open a lesson video full screen and tap Section."

- [ ] **Step 3: Page** — after the Recordings `<section>`:

```svelte
<section>
	<div class="flex items-center justify-between">
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Sections</h2>
		<button type="button" class="mb-2 text-[13px] font-medium text-accent" onclick={() => (linkingSection = true)}>+ Link a section</button>
	</div>
	{#if version.sections.length === 0}
		<p class="text-[13px] text-muted">Point at the part of a lesson video that shows this.</p>
	{:else}
		<ul class="space-y-2">
			{#each version.sections as s (s.linkId)}
				<li>
					<SectionCard section={s}>
						{#snippet unlink()}
							{#if editing}
								<form method="POST" action="?/unlinkSection" use:enhance>
									<input type="hidden" name="versionId" value={version.id} />
									<input type="hidden" name="linkId" value={s.linkId} />
									<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
								</form>
							{/if}
						{/snippet}
					</SectionCard>
				</li>
			{/each}
		</ul>
	{/if}
	{#if failed('unlinkSection')}<p class="mt-2 text-[13px] text-danger" role="alert">{failed('unlinkSection')}</p>{/if}
</section>
<LinkSectionSheet open={linkingSection} onclose={() => (linkingSection = false)} groups={data.linkable} hidden={{ versionId: version.id }} message={failed('linkSection')} />
```

`let linkingSection = $state(false);` and the sheet stays open on a failure (`$effect` as the page does for other sheets). Snippet props passed by name require `SectionCard` to accept `unlink` as a snippet — done in Task 5.

- [ ] **Step 4:** `npx svelte-check` — clean. **Commit** `"Section links: a figure version's sections, and linking one"`.

### Task 8: Drill page and practice content (Today popup)

**Files:**
- Modify: `src/lib/types.ts` (`PracticeContent` figure and drill get `sections: LinkedSection[]`)
- Modify: `src/lib/server/practice-content.ts`
- Modify: `src/lib/components/exercises/kinds/figure/Content.svelte`, `.../drill/Content.svelte`, `.../index.ts` (`ContentProps.editLinks` grows `linkable?: SectionGroup[]` and `sectionMessage?: string | null`)
- Modify: `src/routes/[dance]/exercises/[id]/+page.server.ts` and `+page.svelte`
- Test: `src/lib/server/practice-content.spec.ts`

- [ ] **Step 1: Failing test** — a figure exercise whose figure has a linked section: `practicePayload(...).content.sections` has one card; a drill's too. A variation's link does not show in its figure's exercise (per version).

- [ ] **Step 2:** `practice-content.ts` — figure case: `sections: sectionsFor(db, { figureId: figure.id })`; drill case: `sections: sectionsFor(db, { exerciseId: exercise.id })`; `bare()`: `sections: []`.

- [ ] **Step 3:** figure `Content.svelte`: after the recordings loop, `{#each content.sections as s (s.linkId)}<SectionCard section={s} />{/each}` and include `content.sections.length === 0` in the "nothing yet" test. drill `Content.svelte`: a "Sections" list of `SectionCard`s; when `editLinks` is set, each card gets an unlink form (`?/unlinkSection`, `linkId`) and a "+ Link a section" button opening `LinkSectionSheet` with `groups={editLinks.linkable ?? []}`, `hidden={{}}`.

- [ ] **Step 4:** exercise page server: load adds `linkable: row.source === 'custom' ? linkableSections(db, { exerciseId: row.id }) : []`; actions `linkSection` (`spotId`) / `unlinkSection` (`linkId`) scoped to `{ exerciseId: exerciseOf(params).id }`, refusing a non-drill through `linkSpot`'s own rule and a foreign link through `unlinkSpot`'s scope, same `fail` shapes as Task 7. Page passes `linkable: data.linkable, sectionMessage: failure('linkSection') ?? failure('unlinkSection')` in `editLinks`.

- [ ] **Step 5: Run** `npx vitest run src/lib/server/practice-content.spec.ts` and `npx svelte-check` — PASS. **Commit** `"Section links: in a figure's and a drill's practice content, and linked from a drill"`.

### Task 9: Docs, full check, browser

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-10-01-video-player-design.md`, `docs/superpowers/specs/2026-10-15-video-section-links-design.md`

- [ ] **Step 1:** CLAUDE.md — the "Live" paragraph gains "and section links (a section of a lesson video or recording linked to a figure version or a drill; a linked section and its video refuse to delete)"; a spec pointer paragraph like the others; in "Archive, don't delete" add `spot_links` (deleted on unlink) to the hard-delete list and "a linked spot, and its video, cannot be deleted (`assertUnlinked` in `src/lib/server/spot-links.ts`)".
- [ ] **Step 2:** video-player spec, "Deleting a video deletes its spots": add "unless one is linked to a figure or drill — then the delete is refused (409 from the API); see the section-links spec." Section-links spec: record that the lesson page posts `target` as `figure:<id>` / `exercise:<id>`, and that a link whose lesson is archived drops out of the cards but still blocks.
- [ ] **Step 3:** `npm run check` — must pass. Fix anything it reports.
- [ ] **Step 4:** Browser against `npm run dev` (this slot's URL): lesson with a saved video; mark two sections in the player; link one to a figure's variation from the lesson page, the other from the figure's Basic tab; a card loops; the figure exercise's popup shows Basic's card; Delete video shows the refusal; unlink both; delete succeeds; repeat at 390 px width.
- [ ] **Step 5: Commit** `"Section links: docs"`.
