# Phase 3a — positions and the figure graph: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag each figure with the handholds it starts and ends at, so the app can say what follows what, report the dead ends in the repertoire, and make the player's random drill call a sequence that is physically dancable.

**Architecture:** A `positions` table per dance holds the handhold vocabulary, seeded at boot. A figure gets many start positions (a join table) and one end position (a nullable column). A new pure module `src/lib/graph/` turns those rows into a graph and answers every derived question — nothing derived is stored. The player's `extendPlan` gains an injected `Flow` whose default reproduces today's uniform random exactly, and `src/lib/graph/` supplies the graph-walking implementation.

**Tech Stack:** SvelteKit 2 + Svelte 5, Drizzle ORM on SQLite (`better-sqlite3`), Vitest, Tailwind 4, TypeScript.

**Spec:** [`docs/superpowers/specs/2026-09-24-routines-design.md`](../specs/2026-09-24-routines-design.md)

## Global Constraints

Copied from the spec and `CLAUDE.md`. Every task's requirements implicitly include these.

- **Additive migrations only.** `ALTER TABLE ... ADD COLUMN` and `CREATE TABLE`. **Never add a CHECK to an existing table** — drizzle-kit rebuilds it and the rebuild fails at migrate time. Always read the generated SQL in `drizzle/` before committing it.
- **Data functions take `db` as their first argument.** Routes pass `getDb()`.
- **A spec must never touch `$DATA_DIR`.** Setting `process.env.DATABASE_PATH` does **not** work — the app reads it through `$env/dynamic/private`. Tests needing the app's `getDb()` use `vi.mock('$lib/server/db')` plus `openDb(':memory:')` per test.
- **Nothing under `$lib/server` is imported by components.** Shared row shapes live in `src/lib/types.ts`.
- **Nothing derived is stored.** No cached "follows" table, no stored validity flag.
- **A dance is the wall.** `positions` carries `dance`; `figure_start_positions` derives it through its parents. `src/lib/graph/` never learns that dances exist.
- **Pure modules take no `Date.now()` and no DB.** `src/lib/graph/` is pure and client-safe.
- **Exactly one `neutral` position per dance**, enforced in the data function — it is cross-row and cannot be a CHECK.
- **Untagged means neutral, resolved in the pure layer.** No start rows reads as `{neutral}`; a null `end_position_id` reads as neutral. No backfill migration.
- Commands: `npm run check` (prettier + eslint + svelte-check + build + vitest) must pass. `npm run db:generate` after editing `src/lib/server/db/schema.ts`. Node comes from the nix flake — run commands inside `nix develop` if `node` is not on `PATH`.
- Prettier ignores `/docs/`, so plan and spec files are not formatted.

---

### Task 1: The `positions` schema and migration

**Files:**

- Modify: `src/lib/server/db/schema.ts` (add `positions` and `figureStartPositions` after the `figures`/`recordings` block, ~line 137; add two columns to `figures`, ~line 108)
- Create: `drizzle/0006_*.sql` (generated)
- Test: `src/lib/server/positions.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: tables `positions` (`id`, `dance`, `slug`, `name`, `neutral`, `sortOrder`, `archivedAt`, `createdAt`) and `figureStartPositions` (`figureId`, `positionId`, `createdAt`); columns `figures.endPositionId` and `figures.eights`; exported types `Position`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/positions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { figures, positions } from './db/schema';

describe('positions schema', () => {
	it('stores a position and a figure tagged with start and end', () => {
		const db = openDb(':memory:');
		const open = db
			.insert(positions)
			.values({ dance: 'salsa', slug: 'open-two', name: 'Open, two hands', neutral: true })
			.returning()
			.get();
		expect(open.neutral).toBe(true);
		expect(open.sortOrder).toBe(0);

		const fig = db
			.insert(figures)
			.values({ name: 'enchufla', dance: 'salsa', endPositionId: open.id })
			.returning()
			.get();
		expect(fig.endPositionId).toBe(open.id);
		// Defaults: every existing figure keeps behaving as it does today.
		expect(fig.eights).toBe(1);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/server/positions.spec.ts`
Expected: FAIL — `positions` is not exported from `./db/schema`.

- [ ] **Step 3: Add the tables and columns**

In `src/lib/server/db/schema.ts`, add after the `recordings` table:

```ts
/* ── Positions ──────────────────────────────────────────────────────────── */

/**
 * The handhold vocabulary: where a figure's hands are before and after it.
 *
 * Rows rather than a registry entry, unlike `DANCES`. Count and clave positions
 * are code-shaped, so a database row could not carry them; a handhold
 * vocabulary is the opposite — it grows the week a new hold is learned and it
 * differs between schools. Seeded at boot per dance, idempotently.
 *
 * `neutral` is the position an UNTAGGED figure is assumed to start and end at,
 * which is why it is a column and not a constant: salsa's neutral is open with
 * two hands, bachata's is closed. "Exactly one per dance" is cross-row and so
 * cannot be a CHECK — `positions.ts` enforces it.
 *
 * No CHECK constraints at all here, deliberately: this table gains a foreign
 * key from `figures.end_position_id`, so a future drizzle-kit rebuild would
 * fail twice over. See the `figures.style` note above.
 */
export const positions = sqliteTable(
	'positions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** Stable identifier for the seed; never shown. */
		slug: text('slug').notNull(),
		/** What the user sees. Renameable without breaking the seed. */
		name: text('name').notNull(),
		/** The assumed position of an untagged figure. Exactly one per dance. */
		neutral: integer('neutral', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('positions_dance_slug_idx').on(t.dance, t.slug)]
);

/**
 * The handholds a figure can START from. Many, because entry is genuinely
 * plural — enchufla works from open or from a cross-hand hold.
 *
 * The END is a single column on `figures` instead: the walk has to know where
 * it landed, so if a figure ends differently depending on how it is finished,
 * that is two figures.
 *
 * A join table rather than a JSON column because "which figures start here" is
 * the graph's main query — unlike `anchors_json`, something reads inside it.
 */
export const figureStartPositions = sqliteTable(
	'figure_start_positions',
	{
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		positionId: integer('position_id')
			.notNull()
			.references(() => positions.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.figureId, t.positionId] }),
		index('figure_start_positions_position_idx').on(t.positionId)
	]
);

export type Position = typeof positions.$inferSelect;
```

In the `figures` table, add after `callText`:

```ts
		/**
		 * Where the figure LEAVES the hands. Null means the dance's neutral
		 * position — see `src/lib/graph/`. Null rather than a backfill so no
		 * migration has to touch existing rows.
		 */
		endPositionId: integer('end_position_id').references(() => positions.id),
		/** How many 8-counts the figure takes. The drill spaces calls by it. */
		eights: integer('eights').notNull().default(1),
```

- [ ] **Step 4: Generate the migration and read the SQL**

Run: `npm run db:generate`

Then read the generated file. It MUST be only `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE ... ADD`:

```bash
cat drizzle/0006_*.sql
```

Expected: `CREATE TABLE positions`, `CREATE TABLE figure_start_positions`, two `CREATE ... INDEX`, and `ALTER TABLE figures ADD end_position_id integer REFERENCES positions(id);` plus `ALTER TABLE figures ADD eights integer DEFAULT 1 NOT NULL;`.

**If it contains `DROP TABLE`, `__new_figures`, or any rebuild of an existing table, stop.** That is the trap in `CLAUDE.md`: delete the generated file, revert the schema edit, and re-do it without adding any CHECK.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/positions.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/ src/lib/server/positions.spec.ts
git commit -m "graph: the positions table and a figure's start/end handholds"
```

---

### Task 2: The position data layer and the boot seed

**Files:**

- Create: `src/lib/server/positions.ts`
- Modify: `src/lib/server/positions.spec.ts`
- Modify: `src/lib/server/db/bootstrap.ts:13-14`
- Modify: `src/lib/dances/dances.ts` (add `seedPositions` to the `Dance` interface and both entries)

**Interfaces:**

- Consumes: `positions`, `figureStartPositions` from Task 1.
- Produces:
  - `listPositions(db, dance): Position[]` — unarchived, `sortOrder` then `name`
  - `neutralPosition(db, dance): Position | null`
  - `createPosition(db, dance, input: PositionInput): Position | null`
  - `updatePosition(db, id, input: PositionInput): Position | null`
  - `archivePosition(db, id, now): boolean`
  - `seedPositions(db): void`
  - `PositionInput = { slug: string; name: string; neutral: boolean; sortOrder: number }`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/positions.spec.ts`:

```ts
import { createPosition, listPositions, neutralPosition, seedPositions } from './positions';

describe('seedPositions', () => {
	it('seeds each dance once and is idempotent', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const first = listPositions(db, 'salsa');
		expect(first.length).toBeGreaterThan(5);
		expect(listPositions(db, 'bachata').length).toBeGreaterThan(5);

		seedPositions(db);
		expect(listPositions(db, 'salsa')).toHaveLength(first.length);
	});

	it('gives each dance its own neutral, and they differ', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		expect(neutralPosition(db, 'salsa')?.slug).toBe('open-two');
		expect(neutralPosition(db, 'bachata')?.slug).toBe('closed');
	});

	it('leaves a dance alone once it has positions of its own', () => {
		const db = openDb(':memory:');
		createPosition(db, 'salsa', { slug: 'mine', name: 'Mine', neutral: true, sortOrder: 0 });
		seedPositions(db);
		expect(listPositions(db, 'salsa').map((p) => p.slug)).toEqual(['mine']);
		// The other dance is seeded independently.
		expect(listPositions(db, 'bachata').length).toBeGreaterThan(5);
	});
});

describe('createPosition', () => {
	it('keeps exactly one neutral per dance', () => {
		const db = openDb(':memory:');
		const a = createPosition(db, 'salsa', {
			slug: 'a',
			name: 'A',
			neutral: true,
			sortOrder: 0
		})!;
		const b = createPosition(db, 'salsa', {
			slug: 'b',
			name: 'B',
			neutral: true,
			sortOrder: 1
		})!;
		expect(neutralPosition(db, 'salsa')!.id).toBe(b.id);
		expect(listPositions(db, 'salsa').find((p) => p.id === a.id)!.neutral).toBe(false);
	});

	it('refuses a duplicate slug within a dance but allows it across dances', () => {
		const db = openDb(':memory:');
		const input = { slug: 'open-two', name: 'Open', neutral: false, sortOrder: 0 };
		expect(createPosition(db, 'salsa', input)).not.toBeNull();
		expect(createPosition(db, 'salsa', input)).toBeNull();
		expect(createPosition(db, 'bachata', input)).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/positions.spec.ts`
Expected: FAIL — cannot resolve `./positions`.

- [ ] **Step 3: Add the seed lists to the dance registry**

In `src/lib/dances/dances.ts`, add to the `Dance` interface after `clave`:

```ts
	/**
	 * The handhold vocabulary this dance starts with, seeded into `positions` at
	 * boot when the dance has none. A starting point to edit, not a fixed list —
	 * which is why the rows are the truth afterwards and this is only the seed.
	 *
	 * The FIRST entry is the neutral one: the position an untagged figure is
	 * assumed to start and end at. It differs per dance on purpose — salsa
	 * resolves to open, bachata to closed.
	 */
	seedPositions: readonly { slug: string; name: string }[];
```

In the `salsa` entry, after `clave: true`:

```ts
		seedPositions: [
			{ slug: 'open-two', name: 'Open, two hands' },
			{ slug: 'open-one', name: 'Open, one hand' },
			{ slug: 'closed', name: 'Closed' },
			{ slug: 'cross-hand', name: 'Cross-hand' },
			{ slug: 'hammerlock-r', name: "Hammerlock, follower's right" },
			{ slug: 'hammerlock-l', name: "Hammerlock, follower's left" },
			{ slug: 'shadow', name: 'Shadow' },
			{ slug: 'cuddle', name: 'Cuddle' },
			{ slug: 'back-to-back', name: 'Back to back' }
		],
```

In the `bachata` entry, after `clave: false`:

```ts
		seedPositions: [
			{ slug: 'closed', name: 'Closed' },
			{ slug: 'open-two', name: 'Open, two hands' },
			{ slug: 'open-one', name: 'Open, one hand' },
			{ slug: 'cross-hand', name: 'Cross-hand' },
			{ slug: 'hammerlock', name: 'Hammerlock' },
			{ slug: 'shadow', name: 'Shadow' },
			{ slug: 'side-by-side', name: 'Side by side' }
		],
```

- [ ] **Step 4: Write the data layer**

Create `src/lib/server/positions.ts`:

```ts
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import type { Db } from './db';
import { positions } from './db/schema';
import { DANCE_SLUGS, DANCES, type DanceSlug } from '$lib/dances/dances';

export interface PositionInput {
	slug: string;
	name: string;
	neutral: boolean;
	sortOrder: number;
}

/** Unarchived positions of one dance, in the order the pickers show them. */
export function listPositions(db: Db, dance: DanceSlug) {
	return db
		.select()
		.from(positions)
		.where(and(eq(positions.dance, dance), isNull(positions.archivedAt)))
		.orderBy(asc(positions.sortOrder), asc(positions.name))
		.all();
}

/**
 * The dance's neutral position — what an untagged figure is assumed to start
 * and end at. Null only before the seed has run, which no route can observe:
 * `bootstrap` seeds before the first request resolves.
 */
export function neutralPosition(db: Db, dance: DanceSlug) {
	return (
		db
			.select()
			.from(positions)
			.where(and(eq(positions.dance, dance), eq(positions.neutral, true)))
			.get() ?? null
	);
}

/**
 * Add a position. Returns null when the slug is already taken within the dance
 * — the unique index is per `(dance, slug)`, so the same slug in the other
 * dance is a different position and is allowed.
 */
export function createPosition(db: Db, dance: DanceSlug, input: PositionInput) {
	return db.transaction((tx) => {
		const clash = tx
			.select({ id: positions.id })
			.from(positions)
			.where(and(eq(positions.dance, dance), eq(positions.slug, input.slug)))
			.get();
		if (clash) return null;
		const row = tx
			.insert(positions)
			.values({ ...input, dance })
			.returning()
			.get();
		// Exactly one neutral per dance. Written inline rather than through a
		// helper: drizzle's transaction handle is not a `Db`, and nothing else in
		// this repo passes a `tx` to a function.
		if (row.neutral) {
			tx.update(positions)
				.set({ neutral: false })
				.where(and(eq(positions.dance, dance), ne(positions.id, row.id)))
				.run();
		}
		return row;
	});
}

/** Edit a position. Returns null when it is gone or the new slug clashes. */
export function updatePosition(db: Db, id: number, input: PositionInput) {
	return db.transaction((tx) => {
		const current = tx.select().from(positions).where(eq(positions.id, id)).get();
		if (!current) return null;
		const clash = tx
			.select({ id: positions.id })
			.from(positions)
			.where(and(eq(positions.dance, current.dance), eq(positions.slug, input.slug)))
			.get();
		if (clash && clash.id !== id) return null;
		const row = tx.update(positions).set(input).where(eq(positions.id, id)).returning().get();
		if (row.neutral) {
			tx.update(positions)
				.set({ neutral: false })
				.where(and(eq(positions.dance, current.dance), ne(positions.id, row.id)))
				.run();
		}
		return row;
	});
}

/**
 * Archive a position. The figures tagged with it keep their tags, so an
 * archived position still reads correctly in history — it just stops being
 * offered. Refuses the neutral one: removing it would silently move every
 * untagged figure.
 */
export function archivePosition(db: Db, id: number, now: number): boolean {
	const row = db.select().from(positions).where(eq(positions.id, id)).get();
	if (!row || row.archivedAt !== null || row.neutral) return false;
	db.update(positions).set({ archivedAt: now }).where(eq(positions.id, id)).run();
	return true;
}

/**
 * Seed each dance's vocabulary if it has none, at boot, idempotently — the same
 * reasoning as `seedAdmin`: a deploy that has to remember a seed step forgets.
 *
 * Per dance, not globally: adding a dance to the registry later seeds only the
 * new one and never touches an edited vocabulary.
 */
export function seedPositions(db: Db) {
	for (const dance of DANCE_SLUGS) {
		const existing = db
			.select({ id: positions.id })
			.from(positions)
			.where(eq(positions.dance, dance))
			.limit(1)
			.get();
		if (existing) continue;
		db.insert(positions)
			.values(
				DANCES[dance].seedPositions.map((p, i) => ({
					dance,
					slug: p.slug,
					name: p.name,
					// The registry's first entry is the neutral one.
					neutral: i === 0,
					sortOrder: i
				}))
			)
			.run();
	}
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/server/positions.spec.ts`
Expected: PASS, all six tests.

- [ ] **Step 6: Call the seed at boot**

In `src/lib/server/db/bootstrap.ts`, add the import and the call. Replace:

```ts
	ready ??= seedAdmin(getDb(), env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
		.then(() => {
```

with:

```ts
	ready ??= seedAdmin(getDb(), env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
		.then(() => {
			// The handhold vocabulary, per dance, if that dance has none. Cheap and
			// idempotent, and the figure pickers are empty without it.
			seedPositions(getDb());
		})
		.then(() => {
```

and add to the imports at the top:

```ts
import { seedPositions } from '../positions';
```

- [ ] **Step 7: Verify the whole suite still passes**

Run: `npx vitest run`
Expected: PASS — no existing test touches `bootstrap`, so nothing else moves.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/positions.ts src/lib/server/positions.spec.ts \
        src/lib/server/db/bootstrap.ts src/lib/dances/dances.ts
git commit -m "graph: the position data layer, seeded per dance at boot"
```

---

### Task 3: `src/lib/graph/` — the pure graph

**Files:**

- Create: `src/lib/graph/graph.ts`
- Create: `src/lib/graph/graph.spec.ts`

**Interfaces:**

- Consumes: nothing. Pure, client-safe, no DB and no dance.
- Produces:
  - `GraphFigure = { id: number; starts: number[]; end: number | null; eights: number }`
  - `Graph = { neutral: number; figures: GraphFigure[] }`
  - `startsOf(g, f): number[]`, `endOf(g, f): number`
  - `figureById(g, id): GraphFigure | null`
  - `figuresFrom(g, positionId): number[]`, `figuresTo(g, positionId): number[]`
  - `follows(g, figureId): number[]`, `precedes(g, figureId): number[]`
  - `positionCounts(g, positionIds): PositionCount[]` where `PositionCount = { id: number; inCount: number; outCount: number; deadEnd: boolean; orphan: boolean; unused: boolean }`
  - `deadEnds(g, positionIds): number[]`, `orphans(g, positionIds): number[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/graph/graph.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	endOf,
	figuresFrom,
	figuresTo,
	follows,
	positionCounts,
	precedes,
	startsOf,
	type Graph
} from './graph';

/** OPEN is the neutral position; the ids are arbitrary and deliberately not 1-2-3. */
const OPEN = 10;
const CROSS = 11;
const HAMMER = 12;
const SHADOW = 13;

const g = (figures: Graph['figures']): Graph => ({ neutral: OPEN, figures });

const fig = (
	id: number,
	starts: number[] = [],
	end: number | null = null,
	eights = 1
): Graph['figures'][number] => ({ id, starts, end, eights });

describe('untagged figures read as neutral', () => {
	it('treats no start rows as the neutral position', () => {
		const graph = g([fig(1)]);
		expect(startsOf(graph, graph.figures[0])).toEqual([OPEN]);
	});

	it('treats a null end as the neutral position', () => {
		const graph = g([fig(1)]);
		expect(endOf(graph, graph.figures[0])).toBe(OPEN);
	});

	it('makes an untagged repertoire one hub: everything follows everything', () => {
		const graph = g([fig(1), fig(2), fig(3)]);
		expect(follows(graph, 1)).toEqual([1, 2, 3]);
	});
});

describe('figuresFrom / figuresTo', () => {
	const graph = g([
		fig(1, [OPEN], CROSS), // open  → cross
		fig(2, [CROSS], HAMMER), // cross → hammerlock
		fig(3, [HAMMER, CROSS], OPEN), // either → open
		fig(4) // untagged: open → open
	]);

	it('lists what can be danced from a position', () => {
		expect(figuresFrom(graph, OPEN)).toEqual([1, 4]);
		expect(figuresFrom(graph, CROSS)).toEqual([2, 3]);
	});

	it('lists what ends at a position', () => {
		expect(figuresTo(graph, OPEN)).toEqual([3, 4]);
		expect(figuresTo(graph, HAMMER)).toEqual([2]);
	});

	it('returns nothing for a position no figure touches', () => {
		expect(figuresFrom(graph, SHADOW)).toEqual([]);
		expect(figuresTo(graph, SHADOW)).toEqual([]);
	});
});

describe('follows / precedes', () => {
	const graph = g([
		fig(1, [OPEN], CROSS),
		fig(2, [CROSS], HAMMER),
		fig(3, [HAMMER, CROSS], OPEN)
	]);

	it('follows is what starts where this figure ended', () => {
		expect(follows(graph, 1)).toEqual([2, 3]);
		expect(follows(graph, 2)).toEqual([3]);
	});

	it('precedes is what ends where this figure can start', () => {
		expect(precedes(graph, 3)).toEqual([1, 2]);
	});

	it('is empty for an unknown figure rather than throwing', () => {
		expect(follows(graph, 99)).toEqual([]);
		expect(precedes(graph, 99)).toEqual([]);
	});
});

describe('positionCounts', () => {
	it('flags a dead end, an orphan and an unused position', () => {
		const graph = g([
			fig(1, [OPEN], HAMMER), // enters hammerlock
			fig(2, [SHADOW], OPEN) // leaves shadow, nothing enters it
		]);
		const counts = positionCounts(graph, [OPEN, HAMMER, SHADOW, CROSS]);
		const by = (id: number) => counts.find((c) => c.id === id)!;

		expect(by(HAMMER)).toMatchObject({ inCount: 1, outCount: 0, deadEnd: true, orphan: false });
		expect(by(SHADOW)).toMatchObject({ inCount: 0, outCount: 1, deadEnd: false, orphan: true });
		expect(by(CROSS)).toMatchObject({ inCount: 0, outCount: 0, unused: true });
		// Neutral has one in and one out, so it is none of the three.
		expect(by(OPEN)).toMatchObject({ deadEnd: false, orphan: false, unused: false });
	});

	it('names the dead ends and orphans on their own', () => {
		const graph = g([fig(1, [OPEN], HAMMER), fig(2, [SHADOW], OPEN)]);
		const ids = [OPEN, HAMMER, SHADOW, CROSS];
		expect(deadEnds(graph, ids)).toEqual([HAMMER]);
		expect(orphans(graph, ids)).toEqual([SHADOW]);
	});
});
```

Add `deadEnds` and `orphans` to this file's import list from `./graph`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/graph/`
Expected: FAIL — cannot resolve `./graph`.

- [ ] **Step 3: Write the module**

Create `src/lib/graph/graph.ts`:

```ts
/**
 * The figure graph: which figures can follow which, derived from the handholds
 * each one starts and ends at.
 *
 * PURE and client-safe. No database, no DOM, no `Date.now()`, and — like
 * `day/` and `urgency/` — no idea that dances exist: the data-access layer
 * scopes to one dance before building a `Graph`.
 *
 * Nothing here is stored. "What follows this figure" is recomputed per request
 * for the same reason urgency is: a cached answer is a second source of truth
 * that goes stale the moment a tag is edited.
 *
 * An UNTAGGED figure reads as neutral on both sides. That is what lets the
 * feature ship without a backfill: a repertoire nobody has tagged is one big
 * hub, which is honest for casino — most figures really do run open → open —
 * and it means the drill behaves exactly as it did before any tagging began.
 */

export interface GraphFigure {
	id: number;
	/** Position ids the figure can start from. Empty means the neutral one. */
	starts: number[];
	/** Where it leaves the hands. Null means the neutral one. */
	end: number | null;
	/** How many 8-counts it takes. */
	eights: number;
}

export interface Graph {
	/** The dance's neutral position id: what an untagged figure resolves to. */
	neutral: number;
	figures: GraphFigure[];
}

export function startsOf(g: Graph, f: GraphFigure): number[] {
	return f.starts.length > 0 ? f.starts : [g.neutral];
}

export function endOf(g: Graph, f: GraphFigure): number {
	return f.end ?? g.neutral;
}

export function figureById(g: Graph, id: number): GraphFigure | null {
	return g.figures.find((f) => f.id === id) ?? null;
}

/** Figures that can be danced from this position, in `g.figures` order. */
export function figuresFrom(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => startsOf(g, f).includes(positionId)).map((f) => f.id);
}

/** Figures that leave the hands at this position. */
export function figuresTo(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => endOf(g, f) === positionId).map((f) => f.id);
}

/** What can come after this figure. The figure page's "Leads to". */
export function follows(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	return f ? figuresFrom(g, endOf(g, f)) : [];
}

/** What can come before it. The figure page's "Follows from". */
export function precedes(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	if (!f) return [];
	const entries = new Set(startsOf(g, f));
	return g.figures.filter((o) => entries.has(endOf(g, o))).map((o) => o.id);
}

export interface PositionCount {
	id: number;
	/** Figures ending here. */
	inCount: number;
	/** Figures startable here. */
	outCount: number;
	/** Reachable but not leaveable — the walk has to reset out of it. */
	deadEnd: boolean;
	/** Leaveable but unreachable — nothing you know gets you here. */
	orphan: boolean;
	/** Neither side. Not a fault, just a position nothing uses yet. */
	unused: boolean;
}

/**
 * The gap report: how many figures enter and leave each position.
 *
 * This is the "what should I learn next" answer, which is why a dead end and an
 * orphan are named separately — one is a corner you get stuck in, the other is
 * a corner you can never reach.
 */
export function positionCounts(g: Graph, positionIds: number[]): PositionCount[] {
	return positionIds.map((id) => {
		const inCount = figuresTo(g, id).length;
		const outCount = figuresFrom(g, id).length;
		return {
			id,
			inCount,
			outCount,
			deadEnd: inCount > 0 && outCount === 0,
			orphan: outCount > 0 && inCount === 0,
			unused: inCount === 0 && outCount === 0
		};
	});
}

/** Positions you can get into but not out of. */
export function deadEnds(g: Graph, positionIds: number[]): number[] {
	return positionCounts(g, positionIds)
		.filter((c) => c.deadEnd)
		.map((c) => c.id);
}

/** Positions you could leave, if anything you knew got you there. */
export function orphans(g: Graph, positionIds: number[]): number[] {
	return positionCounts(g, positionIds)
		.filter((c) => c.orphan)
		.map((c) => c.id);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/graph/`
Expected: PASS, all nine tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/
git commit -m "graph: the pure figure graph, with untagged reading as neutral"
```

---

### Task 4: `Flow` — the drill walks the graph

**Files:**

- Modify: `src/lib/scheduler/scheduler.ts:245-275` (`pickFigure`, `extendPlan`)
- Modify: `src/lib/scheduler/scheduler.spec.ts:245-273` (the `extendPlan` describe block)
- Create: `src/lib/graph/flow.ts`
- Create: `src/lib/graph/flow.spec.ts`

**Interfaces:**

- Consumes: `Graph`, `figureById`, `endOf`, `figuresFrom` from Task 3.
- Produces:
  - in `src/lib/scheduler/scheduler.ts`: `interface Flow { pick(pool, last, r): number | null; eights(figureId): number }`, `UNIFORM_FLOW: Flow`, and `extendPlan(plan, pool, every, throughEight, rand, flow?)`
  - in `src/lib/graph/flow.ts`: `graphFlow(g: Graph): Flow`

**The direction of the dependency matters:** the scheduler declares `Flow`, the graph implements it. `src/lib/scheduler/` must not import `src/lib/graph/`.

- [ ] **Step 1: Write the failing scheduler tests**

In `src/lib/scheduler/scheduler.spec.ts`, add to the existing `describe('extendPlan', ...)` block, after the `'returns the plan unchanged for an empty pool'` test:

```ts
	it('spaces calls by the figure length when it exceeds the interval', () => {
		// Figure 1 takes three 8-counts, figure 2 takes one.
		const flow = {
			pick: (pool: number[], last: number | null) => (last === 1 ? 2 : 1),
			eights: (id: number) => (id === 1 ? 3 : 1)
		};
		const steps = extendPlan([], [1, 2], 1, 9, rand([0]), flow);
		// 1 at eight 2 takes 3 → next at 5; 2 at 5 takes 1, but the interval is 1 → 6.
		expect(steps.map((s) => [s.eight, s.figureId])).toEqual([
			[2, 1],
			[5, 2],
			[6, 1],
			[9, 2]
		]);
	});

	it('defaults to the uniform flow, so today’s behaviour is unchanged', () => {
		const withDefault = extendPlan([], [1, 2, 3], 2, 8, rand([0, 0.5, 0.9]));
		const explicit = extendPlan([], [1, 2, 3], 2, 8, rand([0, 0.5, 0.9]), UNIFORM_FLOW);
		expect(withDefault).toEqual(explicit);
		expect(UNIFORM_FLOW.eights(1)).toBe(1);
	});
```

and add `UNIFORM_FLOW` to the import list at the top of the file (it already imports `LEAD_IN_8S`, `extendPlan`, `pickFigure`, `syntheticGrid`, `timeAt`, `timeline` from `./scheduler`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/scheduler/`
Expected: FAIL — `UNIFORM_FLOW` is not exported; the spacing test fails because `extendPlan` takes no sixth argument.

- [ ] **Step 3: Add `Flow` to the scheduler**

In `src/lib/scheduler/scheduler.ts`, replace the `extendPlan` function and add `Flow` above it. The existing `pickFigure` is unchanged — `UNIFORM_FLOW` wraps it.

```ts
/**
 * How the drill chooses its next figure and how long that figure takes.
 *
 * An interface rather than a flag because there are two real implementations:
 * the uniform pick this player shipped with, and the position-graph walk in
 * `src/lib/graph/flow.ts`. The scheduler DECLARES this and the graph implements
 * it — `src/lib/scheduler/` must not import `src/lib/graph/`, so that the
 * module deciding what sounds and when never learns what a handhold is.
 */
export interface Flow {
	/** `last` is the figure just called, or null at the start of a run. */
	pick(pool: number[], last: number | null, r: number): number | null;
	eights(figureId: number): number;
}

/**
 * The pre-graph behaviour: any figure but the last one, every figure one
 * 8-count long. The default, so an untagged repertoire plays exactly as it did
 * before positions existed.
 */
export const UNIFORM_FLOW: Flow = {
	pick: pickFigure,
	eights: () => 1
};

/**
 * Grow a plan so it reaches `throughEight`, deciding only the new steps —
 * a figure already announced never changes under the player's feet.
 *
 * Spacing is `max(every, eights)`: calling the next figure one 8-count after a
 * figure that takes three would be undanceable, and with the uniform flow's
 * length of 1 this is the interval exactly, as before.
 */
export function extendPlan(
	plan: PlanStep[],
	pool: number[],
	every: CallEvery,
	throughEight: number,
	rand: () => number,
	flow: Flow = UNIFORM_FLOW
): PlanStep[] {
	const out = [...plan];
	let eight =
		out.length === 0
			? LEAD_IN_8S
			: out[out.length - 1].eight + Math.max(every, flow.eights(out[out.length - 1].figureId));
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = flow.pick(pool, last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += Math.max(every, flow.eights(figureId));
	}
	return out;
}
```

- [ ] **Step 4: Run the scheduler tests**

Run: `npx vitest run src/lib/scheduler/`
Expected: PASS — the four pre-existing `extendPlan` tests included, unchanged.

- [ ] **Step 5: Write the failing `graphFlow` tests**

Create `src/lib/graph/flow.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extendPlan } from '$lib/scheduler/scheduler';
import { graphFlow } from './flow';
import type { Graph } from './graph';

const OPEN = 10;
const CROSS = 11;
const HAMMER = 12;

const rand = (seq: number[]) => {
	let i = 0;
	return () => seq[i++ % seq.length];
};

const graph: Graph = {
	neutral: OPEN,
	figures: [
		{ id: 1, starts: [OPEN], end: CROSS, eights: 1 }, // open  → cross
		{ id: 2, starts: [CROSS], end: HAMMER, eights: 2 }, // cross → hammerlock, 2×8
		{ id: 3, starts: [HAMMER], end: OPEN, eights: 1 }, // hammer → open
		{ id: 4, starts: [OPEN], end: OPEN, eights: 1 } // open  → open
	]
};

describe('graphFlow', () => {
	it('only ever picks a figure that starts where the last one ended', () => {
		const flow = graphFlow(graph);
		// After figure 1 the hands are in cross-hand, where only figure 2 starts.
		expect(flow.pick([1, 2, 3, 4], 1, 0)).toBe(2);
		expect(flow.pick([1, 2, 3, 4], 2, 0)).toBe(3);
	});

	it('starts a run from the neutral position', () => {
		const flow = graphFlow(graph);
		// From open: figures 1 and 4. r = 0 takes the first.
		expect(flow.pick([1, 2, 3, 4], null, 0)).toBe(1);
		expect(flow.pick([1, 2, 3, 4], null, 0.99)).toBe(4);
	});

	it('only ever returns a figure from the pool', () => {
		const flow = graphFlow(graph);
		// Figure 2 is the only exit from cross-hand, but it is not on offer. The
		// walk resets to neutral rather than going silent — so the answer is one of
		// the pool's own, never the unoffered 2.
		expect([1, 4]).toContain(flow.pick([1, 3, 4], 1, 0));
	});

	it('returns null for an empty pool, and when the pool reaches nothing', () => {
		const flow = graphFlow(graph);
		expect(flow.pick([], null, 0)).toBeNull();
		// Figure 3 starts at hammerlock only, and the run begins at neutral. The
		// reset lands on neutral too, where 3 still does not start.
		expect(flow.pick([3], null, 0)).toBeNull();
	});

	it('resets to neutral out of a dead end rather than going silent', () => {
		// Nothing starts at HAMMER, so after figure 2 the walk is stuck.
		const stuck: Graph = { neutral: OPEN, figures: graph.figures.filter((f) => f.id !== 3) };
		const flow = graphFlow(stuck);
		expect(flow.pick([1, 2, 4], 2, 0)).toBe(1);
	});

	it('does not repeat a figure, unless it is the only way out', () => {
		const flow = graphFlow(graph);
		// From open there are two choices, so 4 does not repeat itself.
		expect(flow.pick([1, 4], 4, 0.99)).toBe(1);
		// Pool of one: repeating beats falling silent.
		expect(flow.pick([4], 4, 0)).toBe(4);
	});

	it('reports each figure’s length, defaulting to 1 for an unknown id', () => {
		const flow = graphFlow(graph);
		expect(flow.eights(2)).toBe(2);
		expect(flow.eights(99)).toBe(1);
	});

	it('produces a dancable plan through extendPlan', () => {
		const steps = extendPlan([], [1, 2, 3, 4], 1, 8, rand([0]), graphFlow(graph));
		const by = (id: number) => graph.figures.find((f) => f.id === id)!;
		expect(steps.length).toBeGreaterThan(2);
		// Every consecutive pair connects: the previous figure's end is one of the
		// next figure's start positions. That is the whole point of the walk.
		for (let i = 1; i < steps.length; i++) {
			expect(by(steps[i].figureId).starts).toContain(by(steps[i - 1].figureId).end);
		}
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/graph/flow.spec.ts`
Expected: FAIL — cannot resolve `./flow`.

- [ ] **Step 7: Write `graphFlow`**

Create `src/lib/graph/flow.ts`:

```ts
/**
 * The drill's walk over the figure graph.
 *
 * Before this, the player picked uniformly from the pool and the only rule was
 * "not the same as last" — so it would call a figure that starts in hammerlock
 * while the hands were in open position. Nonsense, mid-song. Here the next
 * figure is one that starts where the last one ended, which turns the random
 * drill into guided improvisation.
 *
 * The walk holds NO state. The current position is derivable from the last
 * plan step — the last figure's end IS where the hands are — which is why
 * `extendPlan` stays pure and re-entrant, and it must, because it is called
 * again on every tick to grow a plan whose already-announced calls may never
 * change.
 */
import type { Flow } from '$lib/scheduler/scheduler';
import { endOf, figureById, figuresFrom, type Graph } from './graph';

export function graphFlow(g: Graph): Flow {
	return {
		pick(pool, last, r) {
			const previous = last === null ? null : figureById(g, last);
			// Start of a run, or an unknown last figure: the hands are neutral.
			const at = previous ? endOf(g, previous) : g.neutral;

			// The POOL is filtered by the graph, not the other way round, so the
			// order of the choices is the pool's. That is what makes an untagged
			// repertoire byte-identical to `pickFigure`: one neutral hub allows
			// everything, so `here` comes back as the pool itself, unreordered.
			const startable = (position: number) => {
				const allowed = new Set(figuresFrom(g, position));
				return pool.filter((id) => allowed.has(id));
			};

			const here = startable(at);
			// A dead end resets to neutral rather than falling silent, which is what
			// a dancer does anyway — resolve back to open. It covers the case where
			// the graph has no exit AND the case where the chosen pool has none;
			// both would otherwise end the calls mid-song. `positionCounts` is what
			// keeps the first from being invisible.
			const choices = here.length > 0 ? here : startable(g.neutral);
			if (choices.length === 0) return null;

			// Hearing the same name twice running reads as a bug, so it is avoided —
			// unless it is the only way out, where repeating beats silence.
			const usable =
				last === null || choices.length === 1 ? choices : choices.filter((id) => id !== last);
			const from = usable.length > 0 ? usable : choices;
			return from[Math.min(from.length - 1, Math.floor(r * from.length))];
		},
		eights(figureId) {
			return figureById(g, figureId)?.eights ?? 1;
		}
	};
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/lib/graph/ src/lib/scheduler/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/scheduler/scheduler.ts src/lib/scheduler/scheduler.spec.ts src/lib/graph/
git commit -m "graph: the drill walks the position graph, uniform stays the default"
```

---

### Task 5: Reading the graph out of the database

**Files:**

- Create: `src/lib/server/graph.ts`
- Create: `src/lib/server/graph.spec.ts`
(Nothing in `src/lib/types.ts` changes: the figure page's shapes reach the component through SvelteKit's inferred `PageData`, so declaring them again would be dead code.)

**Interfaces:**

- Consumes: `Graph` from Task 3; `positions`, `figureStartPositions`, `figures` from Task 1; `neutralPosition`, `listPositions` from Task 2.
- Produces:
  - `buildGraph(db, dance): Graph` — unarchived figures of that dance
  - `setFigurePositions(db, figureId, startIds, endId, eights): boolean` — validates every position belongs to the figure's dance
  - `figurePositions(db, figureId): { startIds: number[]; endId: number | null }`
  - `MAX_EIGHTS = 8`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/graph.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { follows, startsOf } from '$lib/graph/graph';
import { openDb, type Db } from './db';
import { archiveFigure, createFigure } from './figures';
import { buildGraph, figurePositions, setFigurePositions } from './graph';
import { listPositions, seedPositions } from './positions';

const figureInput = (name: string) => ({
	name,
	partner: 'partner' as const,
	style: 'salsa',
	notes: null,
	callable: true,
	callText: null
});

function setup(): { db: Db; pos: (slug: string) => number } {
	const db = openDb(':memory:');
	seedPositions(db);
	const all = listPositions(db, 'salsa');
	return {
		db,
		pos: (slug) => {
			const found = all.find((p) => p.slug === slug);
			if (!found) throw new Error(`no seeded position ${slug}`);
			return found.id;
		}
	};
}

describe('buildGraph', () => {
	it('uses the dance neutral, so an untagged figure connects to everything', () => {
		const { db, pos } = setup();
		createFigure(db, 'salsa', figureInput('enchufla'));
		createFigure(db, 'salsa', figureInput('dile que no'));
		const g = buildGraph(db, 'salsa');

		expect(g.neutral).toBe(pos('open-two'));
		expect(g.figures).toHaveLength(2);
		expect(startsOf(g, g.figures[0])).toEqual([pos('open-two')]);
		expect(follows(g, g.figures[0].id)).toHaveLength(2);
	});

	it('is walled by dance', () => {
		const { db } = setup();
		createFigure(db, 'salsa', figureInput('enchufla'));
		createFigure(db, 'bachata', { ...figureInput('basico'), style: 'dominican' });
		expect(buildGraph(db, 'salsa').figures).toHaveLength(1);
		expect(buildGraph(db, 'bachata').figures).toHaveLength(1);
	});

	it('leaves out archived figures', () => {
		const { db } = setup();
		const made = createFigure(db, 'salsa', figureInput('enchufla'))!;
		archiveFigure(db, made.figure.id, Date.now());
		expect(buildGraph(db, 'salsa').figures).toEqual([]);
	});
});

describe('setFigurePositions', () => {
	it('stores many starts, one end and a length, and reads them back', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(
			setFigurePositions(
				db,
				made.figure.id,
				[pos('open-two'), pos('cross-hand')],
				pos('hammerlock-r'),
				2
			)
		).toBe(true);

		expect(figurePositions(db, made.figure.id)).toEqual({
			startIds: [pos('open-two'), pos('cross-hand')].sort((a, b) => a - b),
			endId: pos('hammerlock-r')
		});
		const g = buildGraph(db, 'salsa');
		expect(g.figures[0].eights).toBe(2);
		expect(g.figures[0].end).toBe(pos('hammerlock-r'));
	});

	it('replaces the starts rather than adding to them', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		setFigurePositions(db, made.figure.id, [pos('open-two'), pos('cross-hand')], null, 1);
		setFigurePositions(db, made.figure.id, [pos('closed')], null, 1);
		expect(figurePositions(db, made.figure.id).startIds).toEqual([pos('closed')]);
	});

	it('refuses a position from the other dance, writing nothing', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;

		expect(setFigurePositions(db, made.figure.id, [bachataShadow.id], null, 1)).toBe(false);
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], bachataShadow.id, 1)).toBe(
			false
		);
		expect(figurePositions(db, made.figure.id)).toEqual({ startIds: [], endId: null });
	});

	it('refuses a length outside 1-8 and a missing figure', () => {
		const { db, pos } = setup();
		const made = createFigure(db, 'salsa', figureInput('sombrero'))!;
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], null, 0)).toBe(false);
		expect(setFigurePositions(db, made.figure.id, [pos('open-two')], null, 9)).toBe(false);
		expect(setFigurePositions(db, 9999, [pos('open-two')], null, 1)).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/graph.spec.ts`
Expected: FAIL — cannot resolve `./graph`.

- [ ] **Step 3: Write the server-side graph module**

Create `src/lib/server/graph.ts`:

```ts
/**
 * Turning rows into a `Graph`, and writing a figure's tags.
 *
 * The dance wall lives here, not in `src/lib/graph/`: that module is pure and
 * never learns what a dance is, so this one scopes first and hands it a graph
 * of one dance only.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { figures, figureStartPositions, positions } from './db/schema';
import { neutralPosition } from './positions';
import type { Graph } from '$lib/graph/graph';
import type { DanceSlug } from '$lib/dances/dances';

/** How many 8-counts a figure may be tagged as taking. */
export const MAX_EIGHTS = 8;

/**
 * The unarchived figures of one dance as a graph.
 *
 * `neutral` falls back to 0 only before the seed has run, which no route can
 * observe — `bootstrap` seeds before the first request resolves. A 0 there
 * would make every untagged figure share one position anyway, which is the
 * same answer, so it degrades rather than throwing.
 */
export function buildGraph(db: Db, dance: DanceSlug): Graph {
	const rows = db
		.select({
			id: figures.id,
			end: figures.endPositionId,
			eights: figures.eights
		})
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt)))
		.orderBy(figures.name)
		.all();

	const ids = rows.map((r) => r.id);
	const starts =
		ids.length === 0
			? []
			: db
					.select({
						figureId: figureStartPositions.figureId,
						positionId: figureStartPositions.positionId
					})
					.from(figureStartPositions)
					.where(inArray(figureStartPositions.figureId, ids))
					.all();

	const byFigure = new Map<number, number[]>();
	for (const row of starts) {
		const list = byFigure.get(row.figureId);
		if (list) list.push(row.positionId);
		else byFigure.set(row.figureId, [row.positionId]);
	}

	return {
		neutral: neutralPosition(db, dance)?.id ?? 0,
		figures: rows.map((r) => ({
			id: r.id,
			starts: byFigure.get(r.id) ?? [],
			end: r.end,
			eights: r.eights
		}))
	};
}

/** A figure's tags as the edit form needs them. */
export function figurePositions(db: Db, figureId: number) {
	const figure = db
		.select({ end: figures.endPositionId })
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	const startIds = db
		.select({ positionId: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all()
		.map((r) => r.positionId)
		.sort((a, b) => a - b);
	return { startIds, endId: figure?.end ?? null };
}

/**
 * Replace a figure's start positions, its end position and its length.
 *
 * Returns false — writing nothing — when the figure is gone, when the length is
 * out of range, or when any position belongs to another dance. That last one is
 * the wall: `positions.dance` has no CHECK pairing it to `figures.dance` (a new
 * CHECK on `figures` would force a rebuild and fail at migrate time), so it is
 * enforced here, the same way the figure's style already is.
 */
export function setFigurePositions(
	db: Db,
	figureId: number,
	startIds: number[],
	endId: number | null,
	eights: number
): boolean {
	if (!Number.isInteger(eights) || eights < 1 || eights > MAX_EIGHTS) return false;

	return db.transaction((tx) => {
		const figure = tx
			.select({ dance: figures.dance })
			.from(figures)
			.where(eq(figures.id, figureId))
			.get();
		if (!figure) return false;

		const wanted = [...new Set(endId === null ? startIds : [...startIds, endId])];
		if (wanted.length > 0) {
			const ours = tx
				.select({ id: positions.id })
				.from(positions)
				.where(and(inArray(positions.id, wanted), eq(positions.dance, figure.dance)))
				.all();
			// Every id must exist AND be of this figure's dance. A count comparison
			// covers both, since the ids were de-duplicated above.
			if (ours.length !== wanted.length) return false;
		}

		tx.delete(figureStartPositions).where(eq(figureStartPositions.figureId, figureId)).run();
		if (startIds.length > 0) {
			tx.insert(figureStartPositions)
				.values([...new Set(startIds)].map((positionId) => ({ figureId, positionId })))
				.run();
		}
		tx.update(figures).set({ endPositionId: endId, eights }).where(eq(figures.id, figureId)).run();
		return true;
	});
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/server/graph.spec.ts`
Expected: PASS, all eight tests.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — `buildGraph` is new and nothing else reads these columns yet.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/graph.ts src/lib/server/graph.spec.ts
git commit -m "graph: build a dance's graph from rows, and write a figure's tags"
```

---

### Task 6: Tagging on the figure page, and the derived lists

**Files:**

- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (extend `load`, add a `positions` action)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (the pickers and the two derived lists)
- Modify: `src/routes/[dance]/dance-wall.spec.ts` (a case for the new action)
- Modify: `src/lib/server/form.ts` (add `ints`)

**Interfaces:**

- Consumes: `buildGraph`, `figurePositions`, `setFigurePositions`, `MAX_EIGHTS` from Task 5; `listPositions` from Task 2; `follows`, `precedes` from Task 3.
- Produces: the `positions` form action on the figure page; `ints(form, key): number[]` in `src/lib/server/form.ts`.

- [ ] **Step 1: Write the failing dance-wall test**

This file already has every helper needed: `post(dance, fields, id)` builds the event, `refuses(action, event)` asserts the 404 however it is thrown, `figurePage` is the namespace import, and `beforeEach` already creates `bachataFigureId`. Add to the imports at the top:

```ts
import { figurePositions } from '$lib/server/graph';
import { listPositions, seedPositions } from '$lib/server/positions';
```

Add `seedPositions(db);` to the existing `beforeEach`, right after `handle.db = db;` — the positions page and this action both need a vocabulary, and `bootstrap()` never runs in a test.

Then add this test beside the other figure-page cases (near line 232):

```ts
	it('refuses positions for a figure from the other dance, writing nothing', async () => {
		const salsaOpen = listPositions(db, 'salsa').find((p) => p.slug === 'open-two')!;
		await refuses(
			figurePage.actions.positions,
			post('salsa', { startIds: String(salsaOpen.id), eights: '1' }, String(bachataFigureId))
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endId: null });
	});
```

And one that proves the guard is not simply refusing everything — the data layer's own cross-dance check, reached through the action on a figure of the *right* dance:

```ts
	it('refuses a position from the other dance on a figure of this one', async () => {
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.positions,
			post('salsa', { startIds: String(bachataShadow.id), eights: '1' }, String(salsaFigureId))
		);
	});
```

If `beforeEach` does not already expose a salsa figure id, use `createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id` inside the test instead of `salsaFigureId` — the file's existing `figureInput` constant is the one to spread.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "src/routes/[dance]/dance-wall.spec.ts"`
Expected: FAIL — `figurePage.actions.positions` is undefined, so `refuses` reports that nothing was thrown.

- [ ] **Step 3: Add the `ints` form reader**

In `src/lib/server/form.ts`, append:

```ts
/**
 * Every value under one key, as integers, de-duplicated. Anything unparseable
 * is dropped rather than failing the whole form: these come from a multi-select
 * the user cannot type into, so a bad entry means a tampered body, and the
 * scoping check downstream is what rejects it.
 */
export function ints(form: FormData, key: string): number[] {
	const out = new Set<number>();
	for (const raw of form.getAll(key)) {
		const v = Number(raw);
		if (Number.isInteger(v)) out.add(v);
	}
	return [...out];
}
```

- [ ] **Step 4: Extend the figure page's load and add the action**

In `src/routes/[dance]/figures/[id]/+page.server.ts`:

Add to the imports:

```ts
import { buildGraph, figurePositions, MAX_EIGHTS, setFigurePositions } from '$lib/server/graph';
import { listPositions } from '$lib/server/positions';
import { follows, precedes } from '$lib/graph/graph';
import { ints } from '$lib/server/form';
```

Replace `export const load: PageServerLoad = ({ params }) => figureOf(params);` with:

```ts
export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const found = figureOf(params);
	const db = getDb();
	const graph = buildGraph(db, dance);
	const names = new Map(
		listFigures(db, dance).map((f) => [f.id, f.name] as [number, string])
	);
	const link = (ids: number[]) =>
		ids
			.filter((id) => id !== found.figure.id && names.has(id))
			.map((id) => ({ id, name: names.get(id)! }));

	return {
		...found,
		positions: listPositions(db, dance).map((p) => ({
			id: p.id,
			name: p.name,
			neutral: p.neutral
		})),
		tags: figurePositions(db, found.figure.id),
		maxEights: MAX_EIGHTS,
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, found.figure.id)),
		followsFrom: link(precedes(graph, found.figure.id))
	};
};
```

and add `listFigures` to the existing `$lib/server/figures` import.

Add this action to the `actions` object, after `update`:

```ts
	/** The handholds this figure starts and ends at, plus how long it takes. */
	positions: async ({ params, request }) => {
		const figure = figureOf(params);
		const form = await request.formData();
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const eights = int(form, 'eights');

		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'positions', message: 'Pick an end position.' });
		}
		if (eights === undefined || eights < 1 || eights > MAX_EIGHTS) {
			return fail(400, {
				action: 'positions',
				message: `A figure takes between 1 and ${MAX_EIGHTS} eight-counts.`
			});
		}
		// A posted position id is just a number: `setFigurePositions` rejects one
		// from the other dance, and that is a 404 rather than a message, the same
		// answer every other cross-dance id gets here.
		if (!setFigurePositions(getDb(), figure.figure.id, startIds, endId, eights)) {
			throw error(404, 'Figure not found');
		}
		return { action: 'positions', ok: true };
	},
```

- [ ] **Step 5: Run the dance-wall test**

Run: `npx vitest run "src/routes/[dance]/dance-wall.spec.ts"`
Expected: PASS.

- [ ] **Step 6: Add the UI**

In `src/routes/[dance]/figures/[id]/+page.svelte`, add two derived values next to the existing `failure` and `styleLabel` (line ~47):

```ts
	const neutralName = $derived(data.positions.find((p) => p.neutral)?.name ?? 'the neutral hold');
	const positionsFailure = $derived(
		form && 'action' in form && form.action === 'positions' && 'message' in form
			? form.message
			: null
	);
```

Then add this section inside `<main>`, after the `{/if}` that closes the editing block:

```svelte
<section>
	<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Positions</h2>
	<form method="POST" action="?/positions" class="space-y-3" use:enhance>
		<fieldset class="rounded-xl border border-line bg-raised p-3">
			<legend class="px-1 text-[13px] font-medium">Starts from</legend>
			<p class="mb-2 text-[12px] text-muted">
				Leave every box clear for {neutralName}.
			</p>
			<div class="space-y-1">
				{#each data.positions as position (position.id)}
					<label class="flex items-center gap-2 text-[15px]">
						<input
							type="checkbox"
							name="startIds"
							value={position.id}
							checked={data.tags.startIds.includes(position.id)}
							class="size-5 accent-accent"
						/>
						{position.name}
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="block">
			<span class="text-[13px] font-medium">Ends at</span>
			<select
				name="endId"
				class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
			>
				<option value="" selected={data.tags.endId === null}>{neutralName}</option>
				{#each data.positions as position (position.id)}
					<option value={position.id} selected={data.tags.endId === position.id}>
						{position.name}
					</option>
				{/each}
			</select>
		</label>

		<label class="block">
			<span class="text-[13px] font-medium">Eight-counts</span>
			<input
				type="number"
				name="eights"
				min="1"
				max={data.maxEights}
				value={figure.eights}
				class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
			/>
			<span class="text-[12px] text-muted">How long the figure takes. The drill spaces its calls by it.</span>
		</label>

		{#if positionsFailure}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{positionsFailure}
			</p>
		{/if}
		<button
			type="submit"
			class="h-11 w-full rounded-xl border border-line text-[14px] font-semibold"
			>Save positions</button
		>
	</form>
</section>

<section class="grid grid-cols-2 gap-3">
	{#each [{ title: 'Follows from', items: data.followsFrom }, { title: 'Leads to', items: data.leadsTo }] as list (list.title)}
		<div>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
				{list.title}
			</h2>
			{#if list.items.length === 0}
				<p class="text-[13px] text-muted">Nothing yet.</p>
			{:else}
				<ul class="space-y-1">
					{#each list.items as item (item.id)}
						<li>
							<a
								class="text-[15px] text-accent"
								href={resolve('/[dance]/figures/[id]', {
									dance: data.dance.slug,
									id: String(item.id)
								})}>{item.name}</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/each}
</section>
```

`resolve` and `enhance` are already imported at the top of this file.

- [ ] **Step 7: Verify it builds and the suite passes**

Run: `npm run check`
Expected: PASS — prettier, eslint, svelte-check, build and vitest.

- [ ] **Step 8: Commit**

```bash
git add "src/routes/[dance]/figures/[id]/" "src/routes/[dance]/dance-wall.spec.ts" src/lib/server/form.ts
git commit -m "graph: tag a figure's handholds, and show what it follows and leads to"
```

---

### Task 7: The gap report, the player wiring, and the docs

**Files:**

- Create: `src/routes/[dance]/positions/+page.server.ts`
- Create: `src/routes/[dance]/positions/+page.svelte`
- Modify: `src/lib/server/scope.ts` (add `requirePositionInDance`)
- Modify: `src/lib/server/positions.ts` (add `getPosition`)
- Modify: `src/routes/[dance]/player/+page.server.ts` (pass the graph)
- Modify: `src/routes/[dance]/player/+page.svelte:94-112` (build the flow)
- Modify: `src/lib/scheduler/attach.ts:123-142` (a `flow` option) and `:287-291` (pass it)
- Modify: `src/routes/[dance]/figures/+page.server.ts` and `+page.svelte` (the tagged count)
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`

**Interfaces:**

- Consumes: everything from Tasks 2–6.
- Produces: the `/[dance]/positions` page; `PlayerOptions.flow?: Flow`; `getPosition(db, id)` in `positions.ts`; `requirePositionInDance(db, dance, id)` in `scope.ts`.

- [ ] **Step 1: Write the failing test for the player passing a graph flow**

Add to `src/lib/graph/flow.spec.ts`:

```ts
describe('an untagged repertoire is indistinguishable from uniform', () => {
	it('walks a neutral-only graph exactly as the uniform flow does', () => {
		const flat: Graph = {
			neutral: OPEN,
			figures: [1, 2, 3].map((id) => ({ id, starts: [], end: null, eights: 1 }))
		};
		const viaGraph = extendPlan([], [1, 2, 3], 2, 10, rand([0, 0.5, 0.9]), graphFlow(flat));
		const viaUniform = extendPlan([], [1, 2, 3], 2, 10, rand([0, 0.5, 0.9]));
		expect(viaGraph).toEqual(viaUniform);
	});
});
```

This is the test that justifies Task 4's "filter the pool, not the graph" comment: `extendPlan`'s default is the uniform flow, so the two calls must agree step for step, including the order the choices were offered in.

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/graph/flow.spec.ts`
Expected: PASS.

If it FAILS on the figure ids rather than the 8-counts, the cause is choice ordering: `graphFlow` must filter the **pool** by the graph (`pool.filter((id) => allowed.has(id))`), never the graph by the pool, or a neutral-only graph hands back figures in `buildGraph`'s name order instead of the pool's. Task 4's implementation already does this — check it was copied intact.

- [ ] **Step 3: Add `flow` to the player**

In `src/lib/scheduler/attach.ts`, add to `PlayerOptions` after `pool`:

```ts
	/**
	 * How the drill chooses its next figure. Defaults to the uniform pick this
	 * player shipped with; the page passes a graph walk when the figures carry
	 * position tags. An untagged repertoire is one neutral hub, so the two are
	 * indistinguishable until tagging begins.
	 */
	flow?: Flow;
```

add `type Flow` to the existing import from `./scheduler`, and in `createPlayer` change the `extendPlan` call:

```ts
			plan = extendPlan(
				plan,
				pool,
				toggles.callEvery as CallEvery,
				through,
				Math.random,
				opts.flow
			);
```

`extendPlan` already defaults the parameter, so passing `undefined` is the old behaviour exactly.

- [ ] **Step 4: Pass the graph from the player page**

In `src/routes/[dance]/player/+page.server.ts`, add to the imports:

```ts
import { buildGraph } from '$lib/server/graph';
```

and add to the returned object, after `figures`:

```ts
		// The position graph, so the drill calls a sequence that can be danced.
		// Client-safe: `Graph` is plain data from a pure module.
		graph: buildGraph(db, dance),
```

In `src/routes/[dance]/player/+page.svelte`, add the import:

```ts
	import { graphFlow } from '$lib/graph/flow';
```

and in `start()`, add to the `createPlayer({...})` call after `pool: settings.figureIds,`:

```ts
			flow: graphFlow(data.graph),
```

- [ ] **Step 5: Verify the build**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit the player wiring**

```bash
git add src/lib/scheduler/attach.ts "src/routes/[dance]/player/" src/lib/graph/flow.spec.ts
git commit -m "graph: the player's drill walks the graph"
```

- [ ] **Step 7: Add the position guard to `scope.ts`**

In `src/lib/server/scope.ts`, add the import and the guard, following the shape of `requireSongInDance` at the bottom of the file:

```ts
import { getPosition } from './positions';

/**
 * The position, or a 404.
 *
 * A position id in a form body is just a number, and the vocabulary page acts
 * on one from three different actions — so the dance rule lives here and is
 * called from each. An archived position is still a position: the page's own
 * list is what stops it being offered, and refusing it here would make renaming
 * one impossible.
 */
export function requirePositionInDance(db: Db, dance: DanceSlug, id: number) {
	const position = getPosition(db, id);
	if (!position || position.dance !== dance) throw error(404, 'No such position');
	return position;
}
```

and in `src/lib/server/positions.ts`, add the getter it needs:

```ts
/** One position by id, whatever its dance — callers scope it. */
export function getPosition(db: Db, id: number) {
	return db.select().from(positions).where(eq(positions.id, id)).get() ?? null;
}
```

- [ ] **Step 8: Build the gap report page**

Create `src/routes/[dance]/positions/+page.server.ts`:

```ts
import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { buildGraph } from '$lib/server/graph';
import { checkbox, int, text } from '$lib/server/form';
import {
	archivePosition,
	createPosition,
	listPositions,
	updatePosition
} from '$lib/server/positions';
import { positionCounts } from '$lib/graph/graph';
import { danceOf, requirePositionInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

/** A slug from a name: stable, lowercase, no spaces. */
const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'position';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const rows = listPositions(db, dance);
	const counts = positionCounts(
		buildGraph(db, dance),
		rows.map((p) => p.id)
	);
	const byId = new Map(counts.map((c) => [c.id, c]));

	return {
		positions: rows.map((p) => ({
			id: p.id,
			name: p.name,
			neutral: p.neutral,
			...byId.get(p.id)!
		}))
	};
};

/** A position id from this dance, or a 404 — the wall, for every action below. */
function positionOf(params: { dance: string }, id: number | undefined) {
	const dance = danceOf(params);
	if (id === undefined) throw error(404, 'No such position');
	return requirePositionInDance(getDb(), dance, id);
}

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name', 80);
		if (!name) return fail(400, { action: 'create', message: 'Give the position a name.' });
		const made = createPosition(getDb(), dance, {
			slug: slugify(name),
			name,
			neutral: false,
			sortOrder: listPositions(getDb(), dance).length
		});
		if (!made) return fail(400, { action: 'create', message: 'That position already exists.' });
		return { action: 'create', ok: true };
	},

	rename: async ({ params, request }) => {
		const form = await request.formData();
		const found = positionOf(params, int(form, 'id'));
		const name = text(form, 'name', 80);
		if (!name) return fail(400, { action: 'rename', message: 'Give the position a name.' });
		// The slug is left alone: it is the seed's identity, not the label.
		const row = updatePosition(getDb(), found.id, {
			slug: found.slug,
			name,
			neutral: checkbox(form, 'neutral') || found.neutral,
			sortOrder: found.sortOrder
		});
		if (!row) return fail(400, { action: 'rename', message: 'That name is taken.' });
		return { action: 'rename', ok: true };
	},

	archive: async ({ params, request }) => {
		const found = positionOf(params, int(await request.formData(), 'id'));
		if (!archivePosition(getDb(), found.id, Date.now())) {
			return fail(400, {
				action: 'archive',
				message: 'The neutral position cannot be removed — make another one neutral first.'
			});
		}
		return { action: 'archive', ok: true };
	}
};
```

Then create `src/routes/[dance]/positions/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const failure = $derived(form && 'message' in form ? form.message : null);
</script>

<header class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 py-3 backdrop-blur">
	<h1 class="text-[17px] font-semibold">Positions</h1>
	<p class="text-[12px] text-muted">
		Where a figure's hands are before and after it. A figure with none tagged is assumed to
		start and end at the neutral hold.
	</p>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if failure}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
			{failure}
		</p>
	{/if}

	<ul class="space-y-2">
		{#each data.positions as position (position.id)}
			<li
				class="rounded-xl border border-line bg-raised p-3 {position.unused ? 'opacity-60' : ''}"
			>
				<form method="POST" action="?/rename" class="flex items-center gap-2" use:enhance>
					<input type="hidden" name="id" value={position.id} />
					<input
						name="name"
						value={position.name}
						maxlength="80"
						class="min-w-0 flex-1 rounded-lg border border-line bg-plane px-2 py-1 text-[15px]"
					/>
					<button type="submit" class="h-9 px-2 text-[13px] font-medium text-accent">Save</button>
				</form>

				<div class="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
					<span>{position.inCount} in · {position.outCount} out</span>
					{#if position.neutral}
						<span class="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">neutral</span>
					{/if}
					{#if position.deadEnd}
						<span class="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger"
							>dead end — nothing you know leaves here</span
						>
					{/if}
					{#if position.orphan}
						<span class="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger"
							>orphan — nothing you know gets you here</span
						>
					{/if}
					{#if !position.neutral}
						<form method="POST" action="?/archive" class="ml-auto" use:enhance>
							<input type="hidden" name="id" value={position.id} />
							<button type="submit" class="h-8 px-2 text-danger">Remove</button>
						</form>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	<form method="POST" action="?/create" class="flex items-center gap-2" use:enhance>
		<input
			name="name"
			placeholder="Add a position"
			maxlength="80"
			class="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-[15px]"
		/>
		<button type="submit" class="h-11 rounded-xl border border-line px-4 text-[14px] font-semibold"
			>Add</button
		>
	</form>
</main>
```

A `use:enhance` with no argument is the default progressive enhancement; the figures list uses the same form.

- [ ] **Step 9: Add the tagged count to the figures list**

In `src/routes/[dance]/figures/+page.server.ts`, add the import:

```ts
import { buildGraph } from '$lib/server/graph';
```

and replace the `return` at the end of `load`:

```ts
	const db = getDb();
	const graph = buildGraph(db, dance);
	return {
		figures: listFigures(db, dance, filter),
		filter: { ...filter, q },
		// How much of the repertoire carries handhold tags. An untagged figure
		// reads as neutral, which is right for most of casino but worth surfacing:
		// the graph is only as good as this fraction.
		tagged: {
			done: graph.figures.filter((f) => f.starts.length > 0 || f.end !== null).length,
			total: graph.figures.length
		}
	};
```

In `src/routes/[dance]/figures/+page.svelte`, add this beneath the page's heading:

```svelte
<a
	class="text-[12px] text-muted underline"
	href={resolve('/[dance]/positions', { dance: data.dance.slug })}
	>Tagged {data.tagged.done} / {data.tagged.total} positions</a
>
```

`resolve` is already imported in that file.

- [ ] **Step 10: Verify everything**

Run: `npm run check`
Expected: PASS.

Then exercise it by hand, since the graph's payoff is audible rather than assertable:

```bash
npm run dev
```

- create two figures, tag one `open-two → hammerlock-r` and the other `hammerlock-r → open-two`
- open `/salsa/positions` and confirm neither is a dead end, and that a third untouched position reads as unused
- open `/salsa/player`, pick both figures, start a count-only run and confirm the calls alternate rather than repeating a figure that cannot be entered

- [ ] **Step 11: Update the docs**

In `CLAUDE.md`, add to the Layout block after the `src/lib/dances/` entry:

```
src/lib/graph/       PURE figure graph: positions → what can follow what, the
                     drill's walk, the gap report. Client-safe
```

and change the "Live" paragraph to include phase 3a: *"phase 3a (positions, the figure graph, the walking drill)"*, leaving routines under "Not built".

In `docs/superpowers/specs/2026-09-22-salsa-app-design.md`:

- the vocabulary table's **Choreography** row becomes **Routine**: *"An ordered sequence of figures, built from the position graph. See the routines design."*
- replace the `## Choreographies (phase 3)` section body with a pointer to `2026-09-24-routines-design.md` and a note that 3a is live and 3b is not
- in the data model, replace the `choreographies` / `choreo_steps` sketch with `positions` and `figure_start_positions` as built, and add `figures.end_position_id` and `figures.eights` to the `figures` block
- add `src/lib/graph/` to the Pure modules table

- [ ] **Step 12: Final check and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add "src/routes/[dance]/positions/" "src/routes/[dance]/figures/" \
        src/lib/server/scope.ts src/lib/server/positions.ts \
        CLAUDE.md docs/superpowers/specs/2026-09-22-salsa-app-design.md
git commit -m "graph: the gap report, the tagged count, and the docs"
```

---

## Deployment note

`./scripts/deploy.sh` ships `drizzle/` beside `build/` and migrations run at boot, so the new tables and columns apply themselves. `seedPositions` runs in the same `bootstrap()` as the admin seed, so the vocabulary appears on the first request after the deploy. Nothing needs a backfill: every existing figure keeps `end_position_id = null` and `eights = 1`, which reads as neutral and behaves exactly as it does today.

Check `/salsa/positions` and `/bachata/positions` after deploying — the two seeds are independent, and each dance's neutral differs.
