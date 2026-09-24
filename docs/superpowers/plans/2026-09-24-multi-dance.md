# Multi-dance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bachata to the app as a second top-level "dance" — a hard wall through figures, songs, exercises and lessons — with one codebase, one deployment, one database and one login.

**Architecture:** A `dance` column scopes four tables; a code-level registry in `src/lib/dances/` carries each dance's per-dance behaviour (styles, count patterns, whether clave exists, accent colours); every page route moves under `src/routes/[dance]/` so the URL names the dance. The pure modules (`day`, `urgency`, `beatgrid`, `scheduler`) never learn that dances exist — scoping happens in the data-access layer before rows reach them.

**Tech Stack:** SvelteKit 2.63 (adapter-node, typed `resolve()` routes), Svelte 5 runes, Drizzle ORM 0.45 + drizzle-kit 0.31 over better-sqlite3, Tailwind 4, Vitest 4.

**Spec:** [`docs/superpowers/specs/2026-09-24-multi-dance-design.md`](../specs/2026-09-24-multi-dance-design.md)

## Global Constraints

- **Every instant is an integer of epoch ms** in the database, never a `Date`.
- **Urgency is never stored.** It stays a pure function of the sets. `src/lib/urgency/` and `src/lib/day/` must not change in this plan.
- **Data functions take `db` as their first argument.** `dance` goes second where it is needed.
- **Nothing under `$lib/server` is imported by components.** `src/lib/dances/` is client-safe and must not import from `$lib/server`.
- **Never add or change a CHECK on an existing table.** Additive `ALTER TABLE ... ADD COLUMN` only. Always read the generated SQL before committing it.
- **Deny-by-default auth.** A new route is private unless added to `PUBLIC_PATHS` in `src/hooks.server.ts`.
- **`npm run check` must pass** (prettier + eslint + svelte-check + build + vitest) before every commit. Run it inside the flake: `nix develop --command npm run check`.
- The dance slugs are exactly `salsa` and `bachata`. The default dance is `salsa`.
- Salsa's accent stays `#c2410c` light / `#f06a2e` dark — the values already in `src/routes/layout.css`.

---

### Task 1: The dance registry

Pure, client-safe data. Nothing consumes it yet, so this task is self-contained and green on its own.

**Files:**

- Create: `src/lib/dances/dances.ts`
- Test: `src/lib/dances/dances.spec.ts`

**Interfaces:**

- Consumes: `CountPattern` from `$lib/labels`.
- Produces: `Dance`, `DanceSlug`, `DANCE_SLUGS`, `DANCES`, `DEFAULT_DANCE`, `isDanceSlug(v: string): v is DanceSlug`, `getDance(slug: string): Dance`, `isStyleOf(slug: DanceSlug, style: string): boolean`. Every later task uses these names.

- [ ] **Step 1: Write the failing test**

Create `src/lib/dances/dances.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DANCES, DANCE_SLUGS, DEFAULT_DANCE, getDance, isDanceSlug, isStyleOf } from './dances';

describe('the dance registry', () => {
	it('knows its two slugs and no others', () => {
		expect(DANCE_SLUGS).toEqual(['salsa', 'bachata']);
		expect(isDanceSlug('salsa')).toBe(true);
		expect(isDanceSlug('bachata')).toBe(true);
		expect(isDanceSlug('kizomba')).toBe(false);
		expect(isDanceSlug('')).toBe(false);
	});

	it('defaults to salsa', () => {
		expect(DEFAULT_DANCE).toBe('salsa');
	});

	it('keeps salsa looking exactly as it does today', () => {
		const salsa = getDance('salsa');
		expect(salsa.accent).toBe('#c2410c');
		expect(salsa.accentDark).toBe('#f06a2e');
		expect(salsa.clave).toBe(true);
		expect(salsa.styles).toEqual(['salsa', 'son', 'other']);
	});

	it('gives bachata no clave and no son pattern', () => {
		const bachata = getDance('bachata');
		expect(bachata.clave).toBe(false);
		expect(bachata.countPatterns).not.toContain('son');
		expect(bachata.styles).toEqual(['dominican', 'sensual', 'traditional']);
	});

	it('offers the same count positions to both, under salsa key', () => {
		// Bachata's 1-2-3-tap / 5-6-7-tap IS salsa's [1,2,3,5,6,7]. Both dances
		// therefore use the 'salsa' CountPattern key; only the LABEL is shown.
		expect(getDance('bachata').defaultCountPattern).toBe('salsa');
		expect(getDance('salsa').defaultCountPattern).toBe('salsa');
	});

	it('labels every style it lists', () => {
		for (const slug of DANCE_SLUGS) {
			const dance = DANCES[slug];
			for (const style of dance.styles) {
				expect(dance.styleLabel[style]).toBeTruthy();
			}
		}
	});

	it('validates a style against its own dance only', () => {
		expect(isStyleOf('salsa', 'son')).toBe(true);
		expect(isStyleOf('salsa', 'sensual')).toBe(false);
		expect(isStyleOf('bachata', 'sensual')).toBe(true);
		expect(isStyleOf('bachata', 'son')).toBe(false);
	});

	it('throws on an unknown slug rather than returning a default', () => {
		expect(() => getDance('kizomba')).toThrow();
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `nix develop --command npx vitest run src/lib/dances/dances.spec.ts`
Expected: FAIL — `Failed to resolve import "./dances"`.

- [ ] **Step 3: Write the registry**

Create `src/lib/dances/dances.ts`:

```ts
/**
 * The dances the app knows, as pure client-safe data.
 *
 * A dance is the wall through the content: a figure, song, exercise or lesson
 * belongs to exactly one, and you never see the other one's rows. It also
 * carries the behaviour that differs — which styles a figure may be tagged
 * with, which count patterns the player offers, whether clave exists at all.
 *
 * There is deliberately no `dances` table. The differences above are
 * code-shaped (count positions, clave positions, which pickers render), so a
 * row in a database could not carry them: a new row would only ever get
 * generic defaults until the code caught up. Adding a dance is an entry here
 * and a deploy.
 */
import type { CountPattern } from '$lib/labels';

export interface Dance {
	/** The URL segment, and the value stored in the `dance` column. */
	slug: DanceSlug;
	label: string;
	/** Style tags a figure of this dance may carry. Validated in `figures.ts`. */
	styles: readonly string[];
	styleLabel: Record<string, string>;
	/** Which count patterns the player's picker offers. */
	countPatterns: readonly CountPattern[];
	defaultCountPattern: CountPattern;
	/** Whether the clave toggle exists. Salsa only. */
	clave: boolean;
	/** `--color-accent` in light mode, and the manifest's `theme_color`. */
	accent: string;
	/** `--color-accent` under `prefers-color-scheme: dark`. */
	accentDark: string;
}

export const DANCE_SLUGS = ['salsa', 'bachata'] as const;
export type DanceSlug = (typeof DANCE_SLUGS)[number];

export const DEFAULT_DANCE: DanceSlug = 'salsa';

export const DANCES: Record<DanceSlug, Dance> = {
	salsa: {
		slug: 'salsa',
		label: 'Salsa',
		styles: ['salsa', 'son', 'other'],
		styleLabel: { salsa: 'Salsa', son: 'Son', other: 'Other' },
		countPatterns: ['salsa', 'son', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: true,
		accent: '#c2410c',
		accentDark: '#f06a2e'
	},
	bachata: {
		slug: 'bachata',
		label: 'Bachata',
		styles: ['dominican', 'sensual', 'traditional'],
		styleLabel: {
			dominican: 'Dominican',
			sensual: 'Sensual',
			traditional: 'Traditional'
		},
		// No 'son': that pattern is a salsa-family count. Bachata's own
		// 1-2-3-tap / 5-6-7-tap is COUNT_POSITIONS.salsa exactly, so it reuses
		// the 'salsa' key — the user only ever sees COUNT_PATTERN_LABEL, which
		// reads '1 2 3 · 5 6 7' and names no dance.
		countPatterns: ['salsa', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: false,
		accent: '#0f766e',
		accentDark: '#2dd4bf'
	}
};

export function isDanceSlug(v: string): v is DanceSlug {
	return (DANCE_SLUGS as readonly string[]).includes(v);
}

/** The dance for a slug. Throws on an unknown one — callers validate first. */
export function getDance(slug: string): Dance {
	if (!isDanceSlug(slug)) throw new Error(`Unknown dance: ${slug}`);
	return DANCES[slug];
}

export function isStyleOf(slug: DanceSlug, style: string): boolean {
	return DANCES[slug].styles.includes(style);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `nix develop --command npx vitest run src/lib/dances/dances.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dances/
git commit -m "dances: the registry, and what each dance carries"
```

---

### Task 2: The `dance` column, and a migration test that protects the history

Schema and migration only. Nothing reads the new columns yet.

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0005_*.sql` (generated, then reviewed)
- Create: `src/lib/server/db/migrate.spec.ts`

**Interfaces:**

- Produces: `figures.dance`, `figures.styleTag`, `songs.dance`, `exercises.dance`, `lessons.dance` on the Drizzle table objects. Later tasks select and filter on these.

- [ ] **Step 1: Write the failing migration test**

Create `src/lib/server/db/migrate.spec.ts`:

```ts
/**
 * The migration is the one thing in this change that can destroy data rather
 * than merely misbehave. This test builds a database at the LAST PRE-DANCE
 * migration, fills it with rows shaped like the real ones, then runs the new
 * migrations over it and checks what came out.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDb } from './index';
import { exercises, figures, lessons, songs } from './schema';

/** The last migration before the dance column. */
const LAST_OLD = '0004_absent_captain_midlands';

let temps: string[] = [];
beforeEach(() => {
	temps = [];
});
afterEach(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

/** A copy of `drizzle/` with the journal truncated after `tag`. */
function migrationsThrough(tag: string): string {
	const dir = temp('salsa-migrations-');
	cpSync('drizzle', dir, { recursive: true });
	const journalPath = join(dir, 'meta', '_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
	const cut = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
	expect(cut, `${tag} is not in the journal`).toBeGreaterThanOrEqual(0);
	journal.entries = journal.entries.slice(0, cut + 1);
	writeFileSync(journalPath, JSON.stringify(journal));
	return dir;
}

it('backfills every existing row to salsa, and figures keep their style', () => {
	const file = join(temp('salsa-db-'), 'old.db');

	// 1. A database at the old schema, with rows that predate `dance`.
	const old = new Database(file);
	old.pragma('foreign_keys = ON');
	migrate(drizzle(old), { migrationsFolder: migrationsThrough(LAST_OLD) });
	old.prepare(
		`insert into figures (name, partner, style, callable, created_at) values (?, ?, ?, 1, 1)`
	).run('Dile que no', 'partner', 'son');
	old
		.prepare(
			`insert into exercises (name, source, figure_id, every_days, active, created_at)
			 values (?, 'figure', 1, 3, 1, 1)`
		)
		.run('Dile que no');
	old
		.prepare(`insert into songs (title, style, status, audio_file, created_at) values (?, ?, ?, ?, 1)`)
		.run('El Cantante', 'salsa', 'ready', 'a.m4a');
	old
		.prepare(`insert into lessons (lesson_day, title, created_at) values (?, ?, 1)`)
		.run('2026-09-01', 'Tuesday class');
	old.close();

	// 2. The new migrations run over it.
	const db = openDb(file);

	expect(db.select().from(figures).get()).toMatchObject({ dance: 'salsa', styleTag: 'son' });
	expect(db.select().from(exercises).get()).toMatchObject({ dance: 'salsa' });
	expect(db.select().from(songs).get()).toMatchObject({ dance: 'salsa' });
	expect(db.select().from(lessons).get()).toMatchObject({ dance: 'salsa' });
});

it('lets a bachata figure through the vestigial style CHECK', () => {
	// `figures_style_ck` still exists and still only allows salsa/son/other.
	// A bachata row must never touch it: `style` takes its default.
	const db = openDb(':memory:');
	const row = db
		.insert(figures)
		.values({ name: 'Basico', partner: 'partner', dance: 'bachata', styleTag: 'sensual' })
		.returning()
		.get();
	expect(row.dance).toBe('bachata');
	expect(row.styleTag).toBe('sensual');
	expect(row.style).toBe('salsa'); // the vestigial column's default
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `nix develop --command npx vitest run src/lib/server/db/migrate.spec.ts`
Expected: FAIL — `dance` does not exist on the figures table type.

- [ ] **Step 3: Add the columns to the schema**

In `src/lib/server/db/schema.ts`, add to the `figures` table definition, after `partner`:

```ts
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/**
		 * The figure's style tag, validated against `DANCES[dance].styles` in
		 * `figures.ts`. Plain text with no CHECK, on purpose.
		 */
		styleTag: text('style_tag'),
```

Replace the doc comment on the existing `style` column with:

```ts
		/**
		 * VESTIGIAL — read by nothing, backfilled into `style_tag` by migration
		 * 0005. It cannot be dropped and `figures_style_ck` cannot be widened,
		 * because either means a table rebuild, and a rebuild is impossible here
		 * for two independent reasons: drizzle-kit's generated rebuild selects
		 * the new columns from the old table and fails at migrate time, AND
		 * `recordings.figure_id` / `lesson_figures.figure_id` reference this
		 * table, so the rebuild's `DROP TABLE` trips `foreign_keys = ON` — which
		 * `openDb` sets and which cannot be turned off inside the migrator's
		 * transaction.
		 *
		 * Leaving it alone is safe: its default is 'salsa', which always passes
		 * its own CHECK, so it can never block a bachata row. Do not "clean this
		 * up" — removing it is the trap.
		 */
		style: text('style', { enum: STYLES }).notNull().default('salsa'),
```

Add the same `dance` column line (the two-line version, comment plus column) to `songs`, `exercises` and `lessons`, each after their first text column.

- [ ] **Step 4: Generate the migration**

Run: `nix develop --command npm run db:generate`

- [ ] **Step 5: READ THE GENERATED SQL — this step is load-bearing**

Run: `cat drizzle/0005_*.sql`

Expected — five plain statements and nothing else:

```sql
ALTER TABLE `figures` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `figures` ADD `style_tag` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `dance` text DEFAULT 'salsa' NOT NULL;
```

**If the file contains `CREATE TABLE __new_` or `DROP TABLE`, drizzle-kit has chosen a rebuild.** Do not run it. Hand-edit the file down to exactly the `ALTER TABLE ... ADD COLUMN` statements above, leave `drizzle/meta/` as generated, and note it in the commit message. All four tables carry CHECK constraints, which is what provokes the rebuild.

- [ ] **Step 6: Append the backfill**

The `dance` columns backfill themselves via `DEFAULT`. `style_tag` does not — add this as the final statement of `drizzle/0005_*.sql`, after a `--> statement-breakpoint`:

```sql
UPDATE `figures` SET `style_tag` = `style`;
```

- [ ] **Step 7: Run the migration test and watch it pass**

Run: `nix develop --command npx vitest run src/lib/server/db/migrate.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS. Existing tests are unaffected — nothing reads the new columns yet.

- [ ] **Step 9: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/migrate.spec.ts drizzle/
git commit -m "db: a dance on every scoped table, and style_tag beside it"
```

---

### Task 3: Figures become dance-scoped

Data functions only. Callers pass a literal `'salsa'` for now; Task 6 replaces every one of them with `params.dance`. This keeps each commit green without a half-migrated route tree.

**Files:**

- Modify: `src/lib/server/figures.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/labels.ts`
- Modify: `src/lib/server/data.spec.ts`
- Modify (callers, temporary literal): `src/routes/figures/+page.server.ts`, `src/routes/figures/[id]/+page.server.ts`, `src/routes/player/+page.server.ts`, `src/routes/lessons/[id]/+page.server.ts`

**Interfaces:**

- Consumes: `DanceSlug`, `DANCES`, `isStyleOf` from `$lib/dances/dances`.
- Produces:
  - `FigureInput` with `style: string` (was `Style`)
  - `createFigure(db: Db, dance: DanceSlug, input: FigureInput, everyDays?: number)` — returns `{ figure, exercise } | null`; `null` when the style is not one of the dance's
  - `updateFigure(db: Db, id: number, input: FigureInput)` — unchanged signature, reads the figure's own dance to validate
  - `listFigures(db: Db, dance: DanceSlug, filter?: FigureFilter)`
  - `listCallableFigures(db: Db, dance: DanceSlug): CallableFigure[]`
  - `FigureFilter.style?: string`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/server/data.spec.ts`, inside the existing top-level scope (it already has `db`, `figureInput` and `beforeEach`):

```ts
describe('figures are walled off by dance', () => {
	const bachataInput = { ...figureInput, name: 'Basico', style: 'sensual' };

	it('lists only its own dance', () => {
		createFigure(db, 'salsa', figureInput);
		createFigure(db, 'bachata', bachataInput);

		expect(listFigures(db, 'salsa').map((f) => f.name)).toEqual(['Dile que no']);
		expect(listFigures(db, 'bachata').map((f) => f.name)).toEqual(['Basico']);
	});

	it('gives the figure exercise its figure dance', () => {
		const made = createFigure(db, 'bachata', bachataInput);
		expect(made).not.toBeNull();
		expect(getExercise(db, made!.exercise.id)?.dance).toBe('bachata');
	});

	it('refuses a style that belongs to another dance', () => {
		expect(createFigure(db, 'bachata', { ...bachataInput, style: 'son' })).toBeNull();
		expect(createFigure(db, 'salsa', { ...figureInput, style: 'sensual' })).toBeNull();
		expect(listFigures(db, 'salsa')).toEqual([]);
		expect(listFigures(db, 'bachata')).toEqual([]);
	});

	it('refuses an edit that moves a figure outside its dance styles', () => {
		const made = createFigure(db, 'salsa', figureInput)!;
		expect(updateFigure(db, made.figure.id, { ...figureInput, style: 'sensual' })).toBeNull();
		expect(listFigures(db, 'salsa')[0].style).toBe('salsa');
	});

	it('calls only its own dance figures', () => {
		createFigure(db, 'salsa', figureInput);
		createFigure(db, 'bachata', bachataInput);
		expect(listCallableFigures(db, 'bachata').map((f) => f.name)).toEqual(['Basico']);
	});
});
```

Add `describe` to the `vitest` import at the top of the file if it is not already there, and add `getExercise` to the `./exercises` import if missing.

- [ ] **Step 2: Run it and watch it fail**

Run: `nix develop --command npx vitest run src/lib/server/data.spec.ts`
Expected: FAIL — `createFigure` expects 2-3 arguments but got 3-4 / `'salsa'` is not assignable to `FigureInput`.

- [ ] **Step 3: Widen the client types**

In `src/lib/types.ts`, change these three fields (the client-facing name stays `style`; only the DB column is called `style_tag`):

```ts
export interface SongItem {
	// …
	style: string;
	// …
}

export interface LessonFigureRow {
	// …
	style: string | null;
	// …
}

export interface CallableFigure {
	// …
	style: string | null;
}
```

Remove `Style` from the `./labels` import in that file if nothing else uses it.

In `src/lib/labels.ts`, delete `STYLE_LABEL` (it moves into the registry's `styleLabel`) and replace the `STYLES` comment:

```ts
/**
 * The legacy domain of the vestigial `figures.style` column, and nothing else.
 * A figure's real style tag is `style_tag`, validated per dance against
 * `DANCES[dance].styles` — see `src/lib/dances/dances.ts`.
 */
export const STYLES = ['salsa', 'son', 'other'] as const;
export type Style = (typeof STYLES)[number];
```

- [ ] **Step 4: Rewrite the figure data functions**

In `src/lib/server/figures.ts`, replace the imports and the first four exports:

```ts
import { and, asc, count, eq, isNull, like } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, recordings } from './db/schema';
import { DANCES, isStyleOf, type DanceSlug } from '$lib/dances/dances';
import type { Partner } from '$lib/labels';
import type { CallableFigure } from '$lib/types';

export interface FigureInput {
	name: string;
	partner: Partner;
	/** Validated against `DANCES[dance].styles`; stored in `style_tag`. */
	style: string;
	notes: string | null;
	callable: boolean;
	callText: string | null;
}

/** The columns a `FigureInput` writes. `style` is vestigial and never set. */
function values(input: FigureInput) {
	const { style, ...rest } = input;
	return { ...rest, styleTag: style };
}

/**
 * Create a figure AND its exercise, in one transaction. A figure without an
 * exercise would never show up on the Today page, which is the whole point of
 * adding it. The exercise carries the figure's dance, so Today stays walled.
 *
 * Returns null when the style is not one of the dance's — the pairing has no
 * CHECK to enforce it (see `schema.ts`), so it is enforced here.
 */
export function createFigure(
	db: Db,
	dance: DanceSlug,
	input: FigureInput,
	everyDays = 3
): { figure: typeof figures.$inferSelect; exercise: typeof exercises.$inferSelect } | null {
	if (!isStyleOf(dance, input.style)) return null;
	return db.transaction((tx) => {
		const figure = tx
			.insert(figures)
			.values({ ...values(input), dance })
			.returning()
			.get();
		const exercise = tx
			.insert(exercises)
			.values({ name: figure.name, source: 'figure', figureId: figure.id, dance, everyDays })
			.returning()
			.get();
		return { figure, exercise };
	});
}

/**
 * Edit a figure. A rename carries over to its exercise so the two never drift.
 * Returns null when the figure is gone, or when the style does not belong to
 * the figure's own dance — a figure never changes dance.
 */
export function updateFigure(db: Db, id: number, input: FigureInput) {
	return db.transaction((tx) => {
		const current = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!current) return null;
		if (!isStyleOf(current.dance as DanceSlug, input.style)) return null;
		const figure = tx.update(figures).set(values(input)).where(eq(figures.id, id)).returning().get();
		tx.update(exercises).set({ name: figure.name }).where(eq(exercises.figureId, id)).run();
		return figure;
	});
}
```

Then scope the two list functions. In `listFigures`, change the signature and the first `where` entry:

```ts
export interface FigureFilter {
	q?: string;
	style?: string;
	partner?: Partner;
}

export function listFigures(db: Db, dance: DanceSlug, filter: FigureFilter = {}) {
	const where = [isNull(figures.archivedAt), eq(figures.dance, dance)];
	if (filter.q) where.push(like(figures.name, `%${filter.q.replace(/[%_]/g, '')}%`));
	if (filter.style) where.push(eq(figures.styleTag, filter.style));
	if (filter.partner) where.push(eq(figures.partner, filter.partner));

	return db
		.select({
			id: figures.id,
			name: figures.name,
			partner: figures.partner,
			style: figures.styleTag,
			recordings: count(recordings.id)
		})
		.from(figures)
		.leftJoin(recordings, eq(recordings.figureId, figures.id))
		.where(and(...where))
		.groupBy(figures.id)
		.orderBy(asc(figures.name))
		.all();
}
```

In `listCallableFigures`, take the dance, select `styleTag` as `style`, and add it to the `where`:

```ts
export function listCallableFigures(db: Db, dance: DanceSlug): CallableFigure[] {
	return db
		.select({
			id: figures.id,
			name: figures.name,
			callText: figures.callText,
			partner: figures.partner,
			style: figures.styleTag
		})
		.from(figures)
		.where(
			and(isNull(figures.archivedAt), eq(figures.callable, true), eq(figures.dance, dance))
		)
		.orderBy(figures.name)
		.all()
		.map(({ callText, ...f }) => ({ ...f, say: callText ?? f.name }));
}
```

Note `DANCES` is imported for use by the callers' form parsing in the next step; if eslint flags it as unused here, drop it from this file's import.

- [ ] **Step 5: Update the four callers with a temporary literal**

In each of `src/routes/figures/+page.server.ts`, `src/routes/figures/[id]/+page.server.ts`, `src/routes/player/+page.server.ts` and `src/routes/lessons/[id]/+page.server.ts`, pass `'salsa'` as the new second argument to `createFigure`, `listFigures` and `listCallableFigures`, and change any `oneOf(form, 'style', STYLES)` to `oneOf(form, 'style', DANCES.salsa.styles)`.

Mark every one with the same comment so Task 6 can find them all with a single grep:

```ts
// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `nix develop --command npx vitest run src/lib/server/data.spec.ts`
Expected: PASS, including the five new tests.

- [ ] **Step 7: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/figures.ts src/lib/types.ts src/lib/labels.ts src/lib/server/data.spec.ts src/routes/
git commit -m "figures: scoped to a dance, styles validated against it"
```

---

### Task 4: Exercises, sets and Today become dance-scoped

The isolation guarantee lands here. `src/lib/urgency/` must not be touched — the filtering happens before rows reach `plan()`.

**Files:**

- Modify: `src/lib/server/exercises.ts`
- Modify: `src/lib/server/songs.ts` (`listReadySongs` only)
- Modify: `src/lib/server/data.spec.ts`
- Modify (temporary literal): `src/routes/+page.server.ts`

**Interfaces:**

- Produces:
  - `listExercises(db: Db, dance: DanceSlug): ExerciseItem[]`
  - `listSetTimes(db: Db, dance: DanceSlug): { exerciseId: number; doneAt: number }[]`
  - `listSetsBetween(db: Db, from: number, to: number, dance: DanceSlug): DaySet[]`
  - `createCustomExercise(db: Db, dance: DanceSlug, input): typeof exercises.$inferSelect`
  - `listReadySongs(db: Db, dance: DanceSlug): { id: number; title: string }[]`
  - `updateExercise(db, id, input)` — unchanged signature; now also refuses a `songId` from another dance

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/server/data.spec.ts`:

```ts
describe('Today is walled off by dance', () => {
	it('never shows another dance exercise, set or song', () => {
		const salsa = createFigure(db, 'salsa', figureInput)!;
		const bachata = createFigure(db, 'bachata', { ...figureInput, name: 'Basico', style: 'sensual' })!;
		logSet(db, bareSet(salsa.exercise.id, 1_000));
		logSet(db, bareSet(bachata.exercise.id, 2_000));

		expect(listExercises(db, 'salsa').map((e) => e.name)).toEqual(['Dile que no']);
		expect(listExercises(db, 'bachata').map((e) => e.name)).toEqual(['Basico']);

		expect(listSetTimes(db, 'salsa')).toEqual([{ exerciseId: salsa.exercise.id, doneAt: 1_000 }]);
		expect(listSetTimes(db, 'bachata')).toEqual([
			{ exerciseId: bachata.exercise.id, doneAt: 2_000 }
		]);

		expect(listSetsBetween(db, 0, 10_000, 'bachata').map((s) => s.exerciseName)).toEqual([
			'Basico'
		]);
	});

	it('creates a custom exercise into the dance it was asked for', () => {
		const made = createCustomExercise(db, 'bachata', {
			name: 'Footwork',
			everyDays: 2,
			notes: null
		});
		expect(made.dance).toBe('bachata');
		expect(listExercises(db, 'salsa')).toEqual([]);
		expect(listExercises(db, 'bachata').map((e) => e.name)).toEqual(['Footwork']);
	});

	it('refuses to point an exercise at a song from another dance', () => {
		const song = createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		const ex = createCustomExercise(db, 'bachata', { name: 'Footwork', everyDays: 2, notes: null });

		const updated = updateExercise(db, ex.id, {
			name: 'Footwork',
			practiceMode: 'song',
			songId: song.id,
			countBpm: null,
			everyDays: 2,
			active: true,
			notes: null
		});
		expect(updated?.songId).toBeNull();
	});

	it('offers only its own dance ready songs to the picker', () => {
		createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, 'bachata', {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'sensual'
		});
		// createSongFromUpload leaves status 'waiting_analysis'; mark both ready.
		db.update(songs).set({ status: 'ready' }).run();

		expect(listReadySongs(db, 'bachata').map((s) => s.title)).toEqual(['Obsesion']);
	});
});
```

Add `createSongFromUpload` and `listReadySongs` to the `./songs` imports, and `songs` to the `./db/schema` imports, at the top of the spec file.

- [ ] **Step 2: Run it and watch it fail**

Run: `nix develop --command npx vitest run src/lib/server/data.spec.ts`
Expected: FAIL — `listExercises` expects 1 argument but got 2.

- [ ] **Step 3: Scope the exercise functions**

In `src/lib/server/exercises.ts`, add the registry import and change four functions:

```ts
import type { DanceSlug } from '$lib/dances/dances';
```

`listExercises` — take the dance and add it to the `where`:

```ts
export function listExercises(db: Db, dance: DanceSlug): ExerciseItem[] {
	return db
		.select({
			/* …unchanged column list… */
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.where(and(isNull(exercises.archivedAt), eq(exercises.dance, dance)))
		.all()
		.map((r) => ({ ...r, archived: false }));
}
```

`listSetTimes` — join through the exercise, because `sets` deliberately has no `dance` column:

```ts
/**
 * The (exercise, time) pairs urgency is computed from, for ONE dance. The join
 * is how a set knows its dance: `sets` carries no `dance` column on purpose —
 * it would be a second copy of a fact that can drift.
 */
export function listSetTimes(
	db: Db,
	dance: DanceSlug
): { exerciseId: number; doneAt: number }[] {
	return db
		.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(eq(exercises.dance, dance))
		.all();
}
```

`createCustomExercise`:

```ts
export function createCustomExercise(
	db: Db,
	dance: DanceSlug,
	input: Omit<ExerciseInput, 'active' | 'practiceMode' | 'songId' | 'countBpm'>
) {
	return db
		.insert(exercises)
		.values({ ...input, source: 'custom', dance })
		.returning()
		.get();
}
```

`updateExercise` — add the cross-dance song guard after the existing `songId` line:

```ts
	const songId = input.practiceMode === 'song' ? input.songId : null;
	// A song from another dance is refused rather than stored: the pairing has
	// no CHECK to lean on (see `schema.ts`), so this is the enforcement.
	const song =
		songId === null ? null : db.select().from(songs).where(eq(songs.id, songId)).get();
	const ownSongId = song && song.dance === current.dance ? songId : null;
```

and use `ownSongId` in the `.set({ ... })` call in place of `songId`. Add `songs` to the `./db/schema` import in this file.

`listSetsBetween` — take the dance as its fourth argument and join:

```ts
export function listSetsBetween(db: Db, from: number, to: number, dance: DanceSlug): DaySet[] {
```

adding `eq(exercises.dance, dance)` to its existing `and(...)` (it already joins `exercises` for `exerciseName`).

- [ ] **Step 4: Scope `listReadySongs`**

In `src/lib/server/songs.ts`:

```ts
/** Ready, unarchived songs of one dance, for the practice-mode song picker. */
export function listReadySongs(db: Db, dance: DanceSlug): { id: number; title: string }[] {
	return db
		.select({ id: songs.id, title: songs.title })
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.status, 'ready'), eq(songs.dance, dance)))
		.orderBy(songs.title)
		.all();
}
```

Add `import type { DanceSlug } from '$lib/dances/dances';` to the file.

- [ ] **Step 5: Update the Today caller with the temporary literal**

In `src/routes/+page.server.ts`, pass `'salsa'` to `listExercises`, `listSetTimes`, `listSetsBetween`, `createCustomExercise` and `listReadySongs`, each marked:

```ts
// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `nix develop --command npx vitest run src/lib/server/data.spec.ts`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS. `src/lib/urgency/urgency.spec.ts` must pass untouched — if it needed changing, the filtering leaked into the pure layer and the change is wrong.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/exercises.ts src/lib/server/songs.ts src/lib/server/data.spec.ts src/routes/+page.server.ts
git commit -m "exercises: Today sees one dance, and only its own songs"
```

---

### Task 5: Songs and lessons become dance-scoped

**Files:**

- Modify: `src/lib/server/songs.ts`
- Modify: `src/lib/server/lessons.ts`
- Modify: `src/lib/server/songs.spec.ts`
- Modify: `src/lib/server/lessons.spec.ts`
- Modify (temporary literal): `src/routes/songs/+page.server.ts`, `src/routes/lessons/+page.server.ts`, `src/routes/lessons/[id]/+page.server.ts`, `src/routes/api/songs/+server.ts`

**Interfaces:**

- Produces:
  - `createSongFromUrl(db: Db, dance: DanceSlug, input)` and `createSongFromUpload(db: Db, dance: DanceSlug, input)` — `input.style` widens to `string`
  - `listSongs(db: Db, dance: DanceSlug): SongItem[]`
  - `createLesson(db: Db, dance: DanceSlug, input: LessonInput, everyDays?: number)`
  - `listLessons(db: Db, dance: DanceSlug): LessonItem[]`
  - `listLinkableFigures(db: Db, lessonId: number)` and `listLinkableExercises(db: Db, lessonId: number)` — unchanged signatures, now scoped to the lesson's own dance
  - `linkFigure(db, lessonId, figureId)` / `linkExercise(db, lessonId, exerciseId)` — return `false` across dances
- `claimJob`, `storeFetchedAudio`, `storeAnalysis` and `failJob` are **unchanged**. The worker is dance-blind.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/server/songs.spec.ts`:

```ts
describe('songs are walled off by dance', () => {
	it('lists only its own dance', () => {
		createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, 'bachata', {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'sensual'
		});

		expect(listSongs(db, 'salsa').map((s) => s.title)).toEqual(['El Cantante']);
		expect(listSongs(db, 'bachata').map((s) => s.title)).toEqual(['Obsesion']);
	});

	it('still lets the dance-blind worker claim either', () => {
		createSongFromUrl(db, 'bachata', {
			url: 'https://example.test/x',
			title: '',
			style: 'sensual'
		});
		expect(claimJob(db, 1_000)).not.toBeNull();
	});
});
```

Add to `src/lib/server/lessons.spec.ts`:

```ts
describe('lessons are walled off by dance', () => {
	const lessonInput = { lessonDay: '2026-09-01', title: 'Tuesday class', notes: null };

	it('lists only its own dance and gives the review exercise that dance', () => {
		createLesson(db, 'salsa', lessonInput);
		const b = createLesson(db, 'bachata', { ...lessonInput, title: 'Bachata class' });

		expect(listLessons(db, 'salsa').map((l) => l.title)).toEqual(['Tuesday class']);
		expect(listLessons(db, 'bachata').map((l) => l.title)).toEqual(['Bachata class']);
		expect(getExercise(db, b.exercise.id)?.dance).toBe('bachata');
	});

	it('refuses to link a figure from another dance', () => {
		const lesson = createLesson(db, 'bachata', lessonInput);
		const salsaFigure = createFigure(db, 'salsa', {
			name: 'Dile que no',
			partner: 'partner',
			style: 'salsa',
			notes: null,
			callable: true,
			callText: null
		})!;

		expect(linkFigure(db, lesson.lesson.id, salsaFigure.figure.id)).toBe(false);
		expect(listLinkableFigures(db, lesson.lesson.id)).toEqual([]);
	});

	it('offers only its own dance exercises to link', () => {
		const lesson = createLesson(db, 'bachata', lessonInput);
		createCustomExercise(db, 'salsa', { name: 'Salsa footwork', everyDays: 2, notes: null });
		const own = createCustomExercise(db, 'bachata', {
			name: 'Bachata footwork',
			everyDays: 2,
			notes: null
		});

		expect(listLinkableExercises(db, lesson.lesson.id).map((e) => e.id)).toEqual([own.id]);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `nix develop --command npx vitest run src/lib/server/songs.spec.ts src/lib/server/lessons.spec.ts`
Expected: FAIL — argument count mismatches.

- [ ] **Step 3: Scope the song functions**

In `src/lib/server/songs.ts`, take `dance: DanceSlug` as the second parameter of `createSongFromUrl` and `createSongFromUpload`, add `dance` to each `.values({ ... })`, and widen each input's `style` field to `string`. Then:

```ts
export function listSongs(db: Db, dance: DanceSlug): SongItem[] {
	return db
		.select({
			/* …unchanged column list… */
		})
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.dance, dance)))
		.orderBy(desc(songs.createdAt), desc(songs.id))
		.all() as SongItem[];
}
```

Leave `claimJob`, `storeFetchedAudio`, `storeAnalysis`, `failJob`, `getSong`, `getSongByAudioFile`, `archiveSong`, `retrySong`, `setAnchors`, `setTempoFactor` and `updateSongMeta` alone — they are id-scoped or deliberately dance-blind.

- [ ] **Step 4: Scope the lesson functions**

In `src/lib/server/lessons.ts`:

- `createLesson(db: Db, dance: DanceSlug, input: LessonInput, everyDays = 3)` — put `dance` on both the `lessons` insert and the review-exercise insert, inside the existing transaction.
- `listLessons(db: Db, dance: DanceSlug)` — add `eq(lessons.dance, dance)` to its `where`.
- `linkFigure` — after the existing `figure` lookup, fetch the lesson and compare:

```ts
		const lesson = tx
			.select({ dance: lessons.dance })
			.from(lessons)
			.where(eq(lessons.id, lessonId))
			.get();
		// A lesson and a figure from different dances must never join: the wall
		// is the point, and no CHECK can express it (see `schema.ts`).
		if (!lesson || lesson.dance !== figure.dance) return false;
```

Change the `figure` select in that function to include `dance`:

```ts
		const figure = tx
			.select({ id: figures.id, dance: figures.dance })
			.from(figures)
			.where(and(eq(figures.id, figureId), isNull(figures.archivedAt)))
			.get();
```

- `linkExercise` — the same guard, comparing the lesson's dance to the exercise's.
- `listLinkableFigures` and `listLinkableExercises` — look up the lesson's dance first and add `eq(figures.dance, lesson.dance)` / `eq(exercises.dance, lesson.dance)` to the `where`. Return `[]` when the lesson does not exist.
- `getLesson` — add `styleTag` in place of `style` wherever it selects a figure's style for `LessonFigureRow`.

- [ ] **Step 5: Update the callers with the temporary literal**

Pass `'salsa'` to `listSongs`, `createSongFromUrl`, `createSongFromUpload`, `listLessons` and `createLesson` in the four route files listed above, each marked with the same `// TEMPORARY(dance):` comment.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `nix develop --command npx vitest run src/lib/server/`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/ src/routes/
git commit -m "songs, lessons: scoped, and links that refuse to cross dances"
```

---

### Task 6: Move the page routes under `[dance]`

The big, mechanical one. `svelte-check` finds every missed link for you, because `resolve()` is typed against the route tree — a stale `resolve('/figures')` is a compile error, not a runtime 404.

**Files:**

- Create: `src/routes/[dance]/+layout.server.ts`
- Modify: `src/routes/+page.server.ts` → becomes the redirect (its old body moves to `src/routes/[dance]/+page.server.ts`)
- Delete: `src/routes/+page.svelte` (moves)
- Move (with `git mv`): `figures/`, `songs/`, `lessons/`, `player/` and the Today pair into `src/routes/[dance]/`
- Modify: `src/lib/components/shell/BottomNav.svelte`
- Modify: `src/routes/api/songs/+server.ts`
- Modify: every `.svelte` under `src/routes/[dance]/` that calls `resolve()`

**Interfaces:**

- Produces: `DANCE_COOKIE` (exported from `src/routes/+page.server.ts`), and `data.dance: Dance` available to every page under `[dance]` via the layout.

- [ ] **Step 1: Move the route files**

```bash
mkdir -p src/routes/\[dance\]
git mv src/routes/+page.server.ts src/routes/\[dance\]/+page.server.ts
git mv src/routes/+page.svelte    src/routes/\[dance\]/+page.svelte
git mv src/routes/figures         src/routes/\[dance\]/figures
git mv src/routes/songs           src/routes/\[dance\]/songs
git mv src/routes/lessons         src/routes/\[dance\]/lessons
git mv src/routes/player          src/routes/\[dance\]/player
```

`login/`, `logout/`, `settings/`, `voice/`, `health/`, `api/`, `recordings/`, `audio/`, `count/` and `lesson-videos/` stay where they are.

- [ ] **Step 2: Add the layout guard**

Create `src/routes/[dance]/+layout.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import { DANCE_COOKIE } from '../+page.server';
import type { LayoutServerLoad } from './$types';

/**
 * The gate for every dance-scoped page: an unknown slug is a 404, not a
 * silent fall back to salsa, so a typo can never quietly show the wrong
 * dance's data. Visiting a dance also remembers it, which is what `/`
 * redirects to next time.
 */
export const load: LayoutServerLoad = ({ params, cookies, url }) => {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	cookies.set(DANCE_COOKIE, params.dance, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 365
	});
	return { dance: getDance(params.dance) };
};
```

- [ ] **Step 3: Make `/` the redirect**

Create `src/routes/+page.server.ts` (the old one is now under `[dance]/`):

```ts
import { redirect } from '@sveltejs/kit';
import { DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import type { PageServerLoad } from './$types';

/**
 * Which dance you were last in. A cookie rather than a column on `users`,
 * deliberately: per-device is the behaviour wanted — the work PC parked on
 * salsa while the phone is on bachata.
 */
export const DANCE_COOKIE = 'dance';

export const load: PageServerLoad = ({ cookies }) => {
	const last = cookies.get(DANCE_COOKIE);
	throw redirect(303, `/${last && isDanceSlug(last) ? last : DEFAULT_DANCE}`);
};
```

- [ ] **Step 4: Replace every temporary literal**

Run: `grep -rn "TEMPORARY(dance)" src/`

For each hit, delete the comment and replace `'salsa'` with `params.dance as DanceSlug` (load functions and actions both receive `params`). Add `import type { DanceSlug } from '$lib/dances/dances';` where needed. `grep` must come back empty when this step is done.

In `src/routes/[dance]/+page.server.ts` the two `throw redirect(303, '/')` calls for a bad `?day=` must become `` throw redirect(303, `/${params.dance}`) `` — `/` now redirects to the last dance, which would bounce to the same page and lose the correction.

- [ ] **Step 5: Close the detail-page leak**

`getFigure`, `getSong` and `getLesson` are id-scoped, so `/salsa/figures/7` would happily render figure 7 even when it is a bachata figure. That is a hole straight through the wall, and the URL would claim otherwise. Each detail loader must 404 when the row's dance does not match `params.dance`.

First the test. Add to `src/lib/server/data.spec.ts`:

```ts
it('a figure knows the dance it belongs to, so a loader can refuse it', () => {
	const made = createFigure(db, 'bachata', {
		...figureInput,
		name: 'Basico',
		style: 'sensual'
	})!;
	expect(getFigure(db, made.figure.id)?.figure.dance).toBe('bachata');
});
```

Then in each of `src/routes/[dance]/figures/[id]/+page.server.ts`, `src/routes/[dance]/songs/[id]/+page.server.ts` and `src/routes/[dance]/lessons/[id]/+page.server.ts`, guard right after the row is fetched and before anything else uses it:

```ts
	// An id from another dance is a 404, not a render: the URL says which dance
	// this is, and it must not be able to lie.
	if (!found || found.dance !== params.dance) throw error(404);
```

using the loader's own variable name (`figure.figure.dance` for `getFigure`, `song.dance` for `getSong`, `lesson.lesson.dance` for `getLesson`). Every action in those files that mutates a row by id needs the same check — `archiveFigure`, `archiveSong`, `archiveLesson`, `updateFigure`, `updateLesson`, `setAnchors`, `setTempoFactor`, `linkFigure`, `linkExercise` and the recording/video handlers are all reachable by id from either dance's URL.

- [ ] **Step 6: Fix the links**

Run: `nix develop --command npm run check`

`svelte-check` now lists every stale `resolve()`. Fix each one to the `[dance]` form, taking the slug from `data.dance.slug`:

```svelte
<script lang="ts">
	let { data } = $props();
</script>

<a href={resolve('/[dance]/figures', { dance: data.dance.slug })}>Figures</a>
<a href={resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(f.id) })}>…</a>
```

Query strings keep their existing template form with the prefix added, e.g.
`` resolve(`/${data.dance.slug}/player?song=${song.id}`) ``.

`resolve('/recordings/[file]', …)` and `resolve('/lesson-videos/[file]', …)` do **not** change — those routes did not move.

- [ ] **Step 7: Make the nav dance-aware and add the switcher**

Replace `src/lib/components/shell/BottomNav.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';

	let { dance }: { dance: DanceSlug } = $props();

	const TABS = [
		{ path: '/[dance]' as const, label: 'Today', seg: '' },
		{ path: '/[dance]/figures' as const, label: 'Figures', seg: 'figures' },
		{ path: '/[dance]/lessons' as const, label: 'Lessons', seg: 'lessons' },
		{ path: '/[dance]/songs' as const, label: 'Songs', seg: 'songs' }
	];

	function current(seg: string): boolean {
		const rest = page.url.pathname.slice(`/${dance}`.length).replace(/^\//, '');
		return seg === '' ? rest === '' : rest.startsWith(seg);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom)"
	aria-label="Main"
>
	<ul class="mx-auto flex max-w-[560px]">
		{#each TABS as tab (tab.seg)}
			{@const here = current(tab.seg)}
			<li class="flex-1">
				<a
					href={resolve(tab.path, { dance })}
					aria-current={here ? 'page' : undefined}
					class="flex h-14 items-center justify-center text-[14px] font-medium {here
						? 'text-accent'
						: 'text-muted'}">{tab.label}</a
				>
			</li>
		{/each}
		<li class="flex-1">
			{@const here =
				page.url.pathname.startsWith('/settings') || page.url.pathname.startsWith('/voice')}
			<a
				href={resolve('/settings')}
				aria-current={here ? 'page' : undefined}
				class="flex h-14 items-center justify-center text-[14px] font-medium {here
					? 'text-accent'
					: 'text-muted'}">Settings</a
			>
		</li>
	</ul>
</nav>
```

In `src/routes/+layout.svelte`, pass the dance down and render the switcher. The root layout does not know the dance (it sits above `[dance]`), so read it from the URL:

```svelte
<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { DANCE_SLUGS, DANCES, isDanceSlug } from '$lib/dances/dances';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';

	let { data, children } = $props();
	const slug = $derived(page.url.pathname.split('/')[1] ?? '');
	const dance = $derived(isDanceSlug(slug) ? DANCES[slug] : null);
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');
</script>

{#if nav}
	<div class="mx-auto min-h-dvh max-w-[560px] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
		{#if dance}
			<div class="flex justify-center gap-1 px-4 pt-2">
				{#each DANCE_SLUGS as s (s)}
					<a
						href={resolve('/[dance]', { dance: s })}
						aria-current={s === dance.slug ? 'page' : undefined}
						class="rounded-full px-3 py-1 text-[13px] font-medium {s === dance.slug
							? 'bg-accent text-accent-ink'
							: 'text-muted'}">{DANCES[s].label}</a
					>
				{/each}
			</div>
		{/if}
		{@render children()}
	</div>
	{#if dance}<BottomNav dance={dance.slug} />{/if}
{:else}
	{@render children()}
{/if}
```

- [ ] **Step 8: Give `/api/songs` its dance**

In `src/routes/api/songs/+server.ts`, read and validate the dance before creating the row:

```ts
	const dance = url.searchParams.get('dance') ?? '';
	if (!isDanceSlug(dance)) return new Response('Unknown dance', { status: 400 });
```

and pass `dance` to `createSongFromUpload`. Update the client that calls it (the upload button on the songs page) to append `?dance=${data.dance.slug}`.

- [ ] **Step 9: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS, with `grep -rn "TEMPORARY(dance)" src/` empty.

- [ ] **Step 10: Verify by hand**

Run: `nix develop --command npm run dev`, then check:

- `/` redirects to `/salsa`
- `/salsa/figures` lists your existing figures; `/bachata/figures` is empty
- `/kizomba` is a 404
- the switcher moves between them and the tabs stay inside the current dance
- reloading `/` after visiting `/bachata` lands on `/bachata`

- [ ] **Step 11: Commit**

```bash
git add -A src/routes src/lib/components
git commit -m "routes: every page under its dance, and a switcher"
```

---

### Task 7: Per-dance colour, manifests and icons

**Files:**

- Create: `src/routes/manifest-[dance].webmanifest/+server.ts`
- Create: `scripts/make-icons.sh`
- Create: `static/icons/salsa-192.png`, `salsa-512.png`, `bachata-192.png`, `bachata-512.png` (generated, committed)
- Modify: `src/app.html`
- Modify: `src/routes/[dance]/+layout.svelte` (create it if the move did not)
- Modify: `src/hooks.server.ts`
- Delete: `static/manifest.webmanifest`

- [ ] **Step 1: Serve the two manifests**

Create `src/routes/manifest-[dance].webmanifest/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import type { RequestHandler } from './$types';

/**
 * One manifest per dance, so each installs as its own home-screen app.
 *
 * Served FLAT rather than under `/[dance]/`, on purpose: `PUBLIC_PATHS` in
 * `hooks.server.ts` is an exact-match Set, and keeping these paths literal
 * means the auth gate needs no prefix matching — the one place where a
 * pattern would be a new way to expose a page by accident. A manifest's own
 * location does not have to sit inside its `scope`.
 */
export const GET: RequestHandler = ({ params }) => {
	if (!isDanceSlug(params.dance)) throw error(404);
	const dance = getDance(params.dance);
	return json(
		{
			name: `${dance.label} practice`,
			short_name: dance.label,
			start_url: `/${dance.slug}/`,
			scope: `/${dance.slug}/`,
			display: 'standalone',
			background_color: '#f5f3ef',
			theme_color: dance.accent,
			icons: [
				{ src: `/icons/${dance.slug}-192.png`, sizes: '192x192', type: 'image/png' },
				{ src: `/icons/${dance.slug}-512.png`, sizes: '512x512', type: 'image/png' }
			]
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);
};
```

- [ ] **Step 2: Open the two paths in the auth gate**

In `src/hooks.server.ts`, add to `PUBLIC_PATHS`:

```ts
	'/manifest-salsa.webmanifest',
	'/manifest-bachata.webmanifest',
```

and remove `'/manifest.webmanifest'`. Leave `'/icon.svg'`, `'/icon-192.png'` and `'/icon-512.png'`, and add:

```ts
	'/icons/salsa-192.png',
	'/icons/salsa-512.png',
	'/icons/bachata-192.png',
	'/icons/bachata-512.png',
```

Every entry is a literal. Do not replace the `Set` with a prefix test.

- [ ] **Step 3: Move the head tags out of `app.html`**

In `src/app.html`, delete these four lines:

```html
<meta name="theme-color" content="#c2410c" />
<meta name="apple-mobile-web-app-title" content="Salsa" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

Delete `static/manifest.webmanifest`.

- [ ] **Step 4: Put them back, per dance**

Create `src/routes/[dance]/+layout.svelte`:

```svelte
<script lang="ts">
	let { data, children } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content={data.dance.accent} />
	<meta name="apple-mobile-web-app-title" content={data.dance.label} />
	<link rel="manifest" href="/manifest-{data.dance.slug}.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/{data.dance.slug}-192.png" />
</svelte:head>

<!--
  The accent is a CSS variable so every `text-accent` and `bg-accent` in the
  tree follows it. Both modes are set here; `layout.css` keeps the fallbacks
  for pages outside a dance, such as /login and /settings.
-->
<div
	style="--color-accent: light-dark({data.dance.accent}, {data.dance.accentDark})"
	style:display="contents"
>
	{@render children()}
</div>
```

If `light-dark()` is unavailable in the browsers you care about, use two rules in `layout.css` keyed on a `data-dance` attribute instead — put the attribute on the same wrapper and verify in dark mode before moving on.

- [ ] **Step 5: Generate the icons**

Create `scripts/make-icons.sh`, matching the shape of `scripts/make-clips.sh` (a committed one-off whose OUTPUT is committed; it never runs at build time):

```sh
#!/usr/bin/env bash
# Per-dance home-screen icons. Tints static/icon.svg with each dance's accent
# and rasterises it. Output is committed — production never runs this.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p static/icons

tint() {  # slug, hex
	sed "s/#c2410c/$2/gI" static/icon.svg >"/tmp/icon-$1.svg"
	for size in 192 512; do
		rsvg-convert -w "$size" -h "$size" "/tmp/icon-$1.svg" -o "static/icons/$1-$size.png"
	done
	rm "/tmp/icon-$1.svg"
}

tint salsa '#c2410c'
tint bachata '#0f766e'
echo "wrote static/icons/"
```

Run: `chmod +x scripts/make-icons.sh && nix develop --command ./scripts/make-icons.sh`

If `rsvg-convert` is missing from the flake, add `librsvg` to it, or substitute `magick` / `inkscape` — whichever the flake already provides. Confirm the four PNGs exist and differ in colour before continuing.

- [ ] **Step 6: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS.

- [ ] **Step 7: Verify by hand**

With `npm run dev`: `/manifest-salsa.webmanifest` and `/manifest-bachata.webmanifest` both return JSON while logged out; `/salsa` and `/bachata` show visibly different accents in both light and dark mode; `/manifest.webmanifest` is now a 404.

- [ ] **Step 8: Commit**

```bash
git add -A src static scripts
git commit -m "shell: a colour, a manifest and an icon per dance"
```

---

### Task 8: The player asks the registry what to offer

**Files:**

- Modify: `src/lib/components/player/Setup.svelte`
- Modify: `src/routes/[dance]/player/+page.server.ts`
- Modify: `src/lib/components/player/Running.svelte` (only if it reads the clave toggle directly)

- [ ] **Step 1: Take the dance as a prop**

In `src/lib/components/player/Setup.svelte`, add `dance` to the `Props` interface and to the destructure at line 37:

```ts
	import type { Dance } from '$lib/dances/dances';

	// …in Props:
	dance: Dance;

	let { song, defaultBpm, figures, dance, onplay, starting }: Props = $props();
```

Pass it from `src/routes/[dance]/player/+page.svelte`, which renders `<Setup>` around line 181:

```svelte
		<Setup
			song={data.song}
			defaultBpm={data.bpm ?? 180}
			figures={data.figures}
			dance={data.dance}
```

- [ ] **Step 2: Default the pattern and the clave from the registry**

Still in `Setup.svelte`. Line 82 currently restores the stored count pattern with a salsa fallback:

```ts
				: pick(stored.count, COUNT_PATTERNS, 'salsa')
```

Change the domain and the fallback to the dance's, so a pattern belonging to the other dance is discarded exactly the way an unrecognised one already is:

```ts
				: pick(stored.count, dance.countPatterns, dance.defaultCountPattern)
```

Line 87 restores the clave:

```ts
	let clave = $state<ClavePattern | null>(pick(stored.clave, [...CLAVE_PATTERNS, null], null));
```

becomes — a dance without clave can never restore one from a store written in the other dance:

```ts
	let clave = $state<ClavePattern | null>(
		dance.clave ? pick(stored.clave, [...CLAVE_PATTERNS, null], null) : null
	);
```

Line 167, the pattern picker, iterates every pattern:

```svelte
			{#each COUNT_PATTERNS as p (p)}
```

becomes:

```svelte
			{#each dance.countPatterns as p (p)}
```

`COUNT_PATTERN_LABEL[p]` at line 176 stays as it is — the labels name counts, not dances.

Finally, wrap the whole clave fieldset (the block containing the `name="clave"` inputs, roughly lines 188–210) in:

```svelte
	{#if dance.clave}
		<!-- the existing clave fieldset, unchanged -->
	{/if}
```

Drop `COUNT_PATTERNS` from the `$lib/labels` import if nothing else in the file uses it; keep `CLAVE_PATTERNS` and `COUNT_PATTERN_LABEL`.

- [ ] **Step 3: Confirm the callable pool is scoped**

`src/routes/[dance]/player/+page.server.ts` already passes `params.dance` to `listCallableFigures` from Task 6, Step 4. Verify with `grep -n "listCallableFigures" src/routes/[dance]/player/+page.server.ts`.

- [ ] **Step 4: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS. `src/lib/scheduler/scheduler.spec.ts` and `attach.spec.ts` must pass untouched — no scheduler change belongs in this plan.

- [ ] **Step 5: Verify by hand**

Following the CLAUDE.md recipe, insert a bachata song row by hand (`status='ready'`, an `audio_file` under `.data/audio/`, an evenly spaced `beats_json`, `dance='bachata'`), then open `/bachata/player` and confirm: no clave toggle, no `2 3 4 · 6 7 8` pattern, and the figure calls name only bachata figures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/player src/routes
git commit -m "player: the registry decides what the setup screen offers"
```

---

### Task 9: Documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the Layout block, add:

```
src/lib/dances/      PURE registry: one entry per dance (styles, count patterns,
                     whether clave exists, accent colours). Client-safe
src/routes/[dance]/  every page lives under its dance. Flat routes — login,
                     settings, voice, api, the media servers — are shared
```

Add to Hard rules:

```
- **A dance is the wall through the content.** `figures`, `songs`, `exercises`
  and `lessons` carry `dance`; `sets`, `recordings` and the lesson join tables
  derive it through their parent, and `count_takes` is shared by both dances on
  purpose. Scoping happens in the data-access layer — `src/lib/urgency/` and
  `src/lib/day/` never learn that dances exist.
- **`figures.style` is vestigial; `style_tag` is real.** Dropping it or widening
  `figures_style_ck` means a table rebuild, which fails twice over: drizzle-kit's
  generated rebuild selects the new columns from the old table, AND the rebuild's
  `DROP TABLE` trips `foreign_keys = ON`, which `openDb` sets and which cannot be
  turned off inside the migrator's transaction.
```

Extend the existing CHECK rule with that second reason — it is new information and it generalises beyond this change.

- [ ] **Step 2: Update the main design doc**

In `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, note in the status header that the app is multi-dance and link to
`2026-09-24-multi-dance-design.md`.

- [ ] **Step 3: Update `docs/deployment.md`**

Add under Rollout:

```
This deploy carries a migration (`0005`, the dance columns). Snapshot first:

    ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'

The home worker needs no change and no redeploy — it claims songs by `status`,
dance-blind.

The per-dance icons live in `static/icons/` and ship inside `build/`, like the
count clips. `scripts/make-icons.sh` regenerates them locally; production never
runs it.
```

- [ ] **Step 4: Run the full check**

Run: `nix develop --command npm run check`
Expected: PASS (prettier formats the markdown).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: the dance dimension, and the rebuild trap's second reason"
```

---

## Deploying

Not a task — the steps to run once the branch is merged, in order:

1. `ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup'` — snapshot before a migration.
2. `./scripts/deploy.sh prod`.
3. Check `/` redirects to `/salsa` and that every existing figure, song and lesson is still there.
4. Re-add the home-screen icons on the phone: the old `/manifest.webmanifest` is gone, so the existing install points at a 404. Install `/salsa/` and `/bachata/` separately and confirm they open as two apps.
