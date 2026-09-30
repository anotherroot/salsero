# Figure variations — Implementation Plan (slice 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A figure holds named variations — each with its own directions, start/end positions, start count, length and recordings, anything unset taken from the figure — shown as version tabs on the figure page and choosable, per slot, in the routine editor.

**Architecture:** A variation is a `figures` row with `parent_id` set (spec approach A). Every existing per-figure mechanism — start-position rows, `end_position_id`, the timing columns, recordings and their upload route, `routine_step_options.figure_id` — works on it unchanged because it IS a figure id. The data layer does the rest: `buildGraph` fills a variation's unset fields from its parent before the pure layer ever sees it; every list that means "figures" excludes `parent_id is not null`; a variation never gets an exercise.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle ORM on SQLite (better-sqlite3), Vitest, Tailwind. Toolchain from the nix flake.

**Spec:** `docs/superpowers/specs/2026-09-29-figure-variations-design.md` — this plan implements its **slice 2** ("Variations"). Slice 1 is live; slice 3 (visual routine player) gets its own plan.

## Global Constraints

- Run every node command through the flake: `nix develop -c <cmd>`. `nix develop` exports `DATA_DIR`/`DATABASE_PATH` for `.data/`; to point the app elsewhere set them INSIDE the shell: `nix develop -c env DATABASE_PATH=... node build`.
- The app migrates on its FIRST REQUEST (`bootstrap` in `hooks.server.ts`), not at process start. Any check of a migration must send a request.
- Never add a CHECK to an existing table; additive `ALTER TABLE ... ADD COLUMN` only; `figures` can never be rebuilt. Read the generated SQL before committing.
- Data functions take `db` first. Specs use `openDb(':memory:')`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does. Never touch `$DATA_DIR` from a spec.
- Nothing under `$lib/server` is imported by components. Shared row shapes go in `src/lib/types.ts`.
- `src/lib/graph/` and `src/lib/routines/` stay PURE and never learn that variations exist — `buildGraph` resolves them first, exactly as it already hides dances.
- Spec rules, verbatim in effect:
  - A variation is a `figures` row with `parent_id`; **one level only**; **same dance as its parent**, set from the parent, never from a form; **never has an exercise**; names are **unique among its figure's unarchived variations**.
  - Unset on a variation means **the parent's**: no start rows, null `end_position_id`, null `start_count`, null `length_counts`. On a base figure, unset still means neutral / 1 / 8.
  - Partner, style, callable, call text, links, "Taught in" and practice are always the parent's.
  - Archiving a figure archives its variations in the same transaction; a variation can be archived alone.
  - Every list that means "figures" excludes variations: `listFigures`, `listCallableFigures` (drill pool), the lesson figure picker, the "tagged" count. The lessons `linkFigure` refuses a variation id.
  - The graph (and so the routine algebra and the positions gap report) includes variations.
  - The drill never calls a variation. A routine that holds one shows it as "Enchufla · Doble" and — until slice 3 removes routine calls — SAYS the parent's name.
- UI: version tabs under the header — **Basic**, each variation, **+**. The tab is `?v=<variationId>`; `/[dance]/figures/<variationId>` redirects to its parent with `?v=`. One Edit mode per version, one Save. "(as Basic)" marks inherited values in view mode; "Same as Basic" is the choice in edit mode.
- Commit messages: `area: what changed`, ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `nix develop -c npm run check` must pass at the end of every task that touches `src/`.

## Review Focus

1. **A variation id posted at the wrong figure.** `updateVariation`, `archiveVariation` and `deleteRecording` receive a `versionId` in the form body; one belonging to ANOTHER figure (same dance or not) must 404 and write nothing. Pinned in Task 5.
2. **A duplicate variation name must refuse BEFORE anything is written.** The variation save writes shape and name; a taken name found after the shape was written would be a half-save. Pinned in Task 5 (name unchanged AND shape unchanged).
3. **A variation leaking into a figure list.** Library, drill pool, lesson picker, tagged count — each pinned in Task 3; the player's drill pool additionally via `listCallableFigures`.
4. **Archiving a figure while a routine slot holds one of its variations.** The routine must keep working without it (the slot's other alternatives remain; a slot left empty is dropped by `flatten`) and the editor must name the archived one rather than crash. Pinned in Task 4 (graph drops it) and Task 7 (label falls back).
5. **The old variation URL.** A link to `/salsa/figures/<variationId>` from a routine or a bookmark must land on the figure with that tab open, and a bachata variation id under `/salsa/` must 404, not redirect across the wall. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/server/db/schema.ts` | `figures.parent_id` + index. |
| `drizzle/0011_*.sql` (generated) | `ALTER TABLE figures ADD parent_id … REFERENCES figures(id)`, `CREATE INDEX`. |
| `src/lib/server/figures.ts` | `createVariation`, `updateVariation`, `listVariations`, `variationNameTaken`, archive cascade, `updateFigure` refusing variations, `figureLabels`, `listVersions`, list exclusions, `listFiguresForCall` labels. |
| `src/lib/server/graph.ts` | `setFigureShape` accepts null timing for variations; `buildGraph` fills variations from parents; `taggedFigures`. |
| `src/lib/server/lessons.ts` | Picker excludes variations; `linkFigure` refuses one. |
| `src/lib/server/routines.ts` | Landing read from the graph, so a variation's inherited landing counts. |
| `src/lib/server/practice-content.ts` | Routine slot names via `figureLabels`. |
| `src/lib/types.ts` | `FigureVersion`. |
| `src/lib/server/variations.spec.ts` (new) | Data-layer tests for all of the above. |
| `src/lib/components/figures/FigureTiming.svelte` | Optional "Same as Basic" for a variation. |
| `src/routes/[dance]/figures/+page.server.ts` | Tagged count via `taggedFigures`. |
| `src/routes/[dance]/figures/[id]/+page.server.ts` / `+page.svelte` | Version tabs, redirect, per-version view/edit, new-variation sheet, version-aware actions. |
| `src/routes/[dance]/routines/[id]/+page.server.ts` / `+page.svelte` | Versions with labels; pick a figure then a version; alternatives by version. |
| `src/routes/[dance]/dance-wall.spec.ts` | Route tests for Review Focus 1, 2, 5. |
| Docs | Spec status + one correction, routines spec pointer, `CLAUDE.md` rule. |

---

### Task 0: Branch

- [ ] **Step 1:** `git switch -c figure-variations`

---

### Task 1: `figures.parent_id`

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`figures`)
- Create: `drizzle/0011_*.sql` + `drizzle/meta/*` (generated)
- Test: `src/lib/server/variations.spec.ts` (new)

**Interfaces:**
- Produces: `figures.parentId: integer('parent_id')`, nullable, self-referencing; index `figures_parent_idx` on it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/variations.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { figures } from './db/schema';
import { createFigure } from './figures';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

/** A base figure of one dance, with its exercise. */
const base = (name = 'Enchufla', dance: 'salsa' | 'bachata' = 'salsa') =>
	createFigure(db, dance, {
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null,
		callable: true,
		callText: null
	})!.figure;

describe('figures.parent_id', () => {
	it('is null on a figure and points at the figure on a variation row', () => {
		const parent = base();
		expect(parent.parentId).toBeNull();
		const row = db
			.insert(figures)
			.values({ name: 'Doble', dance: 'salsa', parentId: parent.id })
			.returning()
			.get();
		expect(db.select().from(figures).where(eq(figures.id, row.id)).get()?.parentId).toBe(
			parent.id
		);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `nix develop -c npx vitest run src/lib/server/variations.spec.ts`
Expected: FAIL — TypeScript/Drizzle: `parentId` does not exist on `figures`.

- [ ] **Step 3: Add the column**

In `src/lib/server/db/schema.ts`, inside `figures`, directly after the `lengthCounts` column, add:

```ts
		/**
		 * Set on a VARIATION: a version of the figure this points at, with its own
		 * directions (`notes`), positions, timing and recordings. Anything unset —
		 * no start rows, a null end, null timing — is the parent's; `buildGraph`
		 * fills it in. One level only, same dance as the parent, never an exercise:
		 * all enforced in `figures.ts`, because this table can never gain a CHECK.
		 * See docs/superpowers/specs/2026-09-29-figure-variations-design.md.
		 */
		parentId: integer('parent_id').references((): AnySQLiteColumn => figures.id),
```

and change the table's extra-config array from

```ts
	(t) => [
		check('figures_partner_ck', sql`${t.partner} in ('partner', 'solo')`),
		check('figures_style_ck', sql`${t.style} in ('salsa', 'son', 'other')`)
	]
```

to

```ts
	(t) => [
		check('figures_partner_ck', sql`${t.partner} in ('partner', 'solo')`),
		check('figures_style_ck', sql`${t.style} in ('salsa', 'son', 'other')`),
		index('figures_parent_idx').on(t.parentId)
	]
```

(`AnySQLiteColumn` and `index` are already imported — `routineSteps` uses both.)

- [ ] **Step 4: Generate and read the migration**

Run: `nix develop -c npm run db:generate`

The new `drizzle/0011_*.sql` must contain exactly an `ALTER TABLE \`figures\` ADD \`parent_id\` integer REFERENCES figures(id);` and a `CREATE INDEX \`figures_parent_idx\` …`. If it contains `__new_figures`, `DROP TABLE` or `PRAGMA foreign_keys`, STOP — that is a rebuild and must not ship.

- [ ] **Step 5: Run it to see it pass**

Run: `nix develop -c npx vitest run src/lib/server/variations.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verify on a copy of the dev database**

```bash
S=/tmp/claude-migrate-0011 && rm -rf $S && mkdir -p $S && cp .data/salsa.db $S/salsa.db
nix develop -c npm run build >/dev/null
(nix develop -c env DATABASE_PATH=$S/salsa.db DATA_DIR=$S PORT=5198 ORIGIN=http://localhost:5198 timeout 15 node build >/dev/null 2>&1 &)
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:5198/login && break; sleep 1; done; sleep 2
nix develop -c sqlite3 $S/salsa.db "select count(*), count(parent_id) from figures; select name from sqlite_master where name='figures_parent_idx';"
nix develop -c sqlite3 $S/salsa.db "select sql from sqlite_master where name='figures';" | grep -o CHECK | wc -l
rm -rf $S
```

Expected: every figure counted with 0 non-null `parent_id`; `figures_parent_idx` listed; CHECK count 2 (unchanged — altered, not rebuilt).

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/variations.spec.ts drizzle
git commit -m "figures: parent_id, so a variation is a figure row under its figure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Creating, editing and archiving variations

**Files:**
- Modify: `src/lib/server/figures.ts`
- Modify: `src/lib/server/graph.ts` (`FigureShape`, `setFigureShape`)
- Test: `src/lib/server/variations.spec.ts`

**Interfaces:**
- Produces (all in `figures.ts`):
  - `interface VariationInput { name: string; notes: string | null }`
  - `listVariations(db: Db, parentId: number): Figure[]` — unarchived, oldest first
  - `variationNameTaken(db: Db, parentId: number, name: string, exceptId: number | null): boolean` — case-insensitive, trimmed, unarchived siblings only
  - `createVariation(db: Db, parentId: number, input: VariationInput): Figure | null`
  - `updateVariation(db: Db, id: number, input: VariationInput): Figure | null`
  - `updateFigure` returns null for a variation; `archiveFigure` archives the figure's variations too
- Produces (in `graph.ts`): `FigureShape.startCount: number | null`, `FigureShape.lengthCounts: number | null`; `setFigureShape` accepts null only for a variation.
- `Figure` is `typeof figures.$inferSelect` — import it as `type Figure` from `./db/schema` where needed.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/variations.spec.ts`, and extend its imports to:

```ts
import { exercises, figures } from './db/schema';
import {
	archiveFigure,
	createFigure,
	createVariation,
	listVariations,
	updateFigure,
	updateVariation
} from './figures';
import { setFigureShape } from './graph';
```

```ts
describe('createVariation', () => {
	it('makes a figure row under its figure, of its dance, with no exercise', () => {
		const parent = base('Basico', 'bachata');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: 'Two turns' })!;
		expect(v).toMatchObject({
			parentId: parent.id,
			dance: 'bachata',
			name: 'Doble',
			notes: 'Two turns',
			startCount: null,
			lengthCounts: null,
			endPositionId: null
		});
		expect(db.select().from(exercises).where(eq(exercises.figureId, v.id)).all()).toEqual([]);
	});

	it('refuses a variation of a variation — one level only', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(createVariation(db, v.id, { name: 'Triple', notes: null })).toBeNull();
	});

	it('refuses a figure that is archived or gone', () => {
		const parent = base();
		archiveFigure(db, parent.id, 1000);
		expect(createVariation(db, parent.id, { name: 'Doble', notes: null })).toBeNull();
		expect(createVariation(db, 9999, { name: 'Doble', notes: null })).toBeNull();
	});

	it('refuses a name a sibling already uses, ignoring case', () => {
		const parent = base();
		createVariation(db, parent.id, { name: 'Doble', notes: null });
		expect(createVariation(db, parent.id, { name: 'DOBLE', notes: null })).toBeNull();
	});

	it('allows the same name under a different figure, and again once the first is archived', () => {
		const a = base('Enchufla');
		const b = base('Setenta');
		const first = createVariation(db, a.id, { name: 'Doble', notes: null })!;
		expect(createVariation(db, b.id, { name: 'Doble', notes: null })).not.toBeNull();
		archiveFigure(db, first.id, 1000);
		expect(createVariation(db, a.id, { name: 'Doble', notes: null })).not.toBeNull();
	});
});

describe('updateVariation', () => {
	it('renames a variation and changes its directions', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(updateVariation(db, v.id, { name: 'Double', notes: 'Spot' })).toMatchObject({
			name: 'Double',
			notes: 'Spot'
		});
	});

	it('keeps its own name, and refuses a sibling’s', () => {
		const parent = base();
		const a = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		createVariation(db, parent.id, { name: 'Con giro', notes: null });
		expect(updateVariation(db, a.id, { name: 'Doble', notes: 'x' })).not.toBeNull();
		expect(updateVariation(db, a.id, { name: 'con giro', notes: null })).toBeNull();
	});

	it('refuses a base figure — that is updateFigure’s job', () => {
		expect(updateVariation(db, base().id, { name: 'X', notes: null })).toBeNull();
	});
});

describe('updateFigure', () => {
	it('refuses a variation — partner, style and call text are the figure’s', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(
			updateFigure(db, v.id, {
				name: 'X',
				partner: 'partner',
				style: 'salsa',
				notes: null,
				callable: true,
				callText: null
			})
		).toBeNull();
	});
});

describe('archiving', () => {
	it('archives a figure’s variations with it', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		archiveFigure(db, parent.id, 1000);
		expect(db.select().from(figures).where(eq(figures.id, v.id)).get()?.archivedAt).toBe(1000);
	});

	it('archives a variation alone, leaving its figure and siblings', () => {
		const parent = base();
		const a = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const b = createVariation(db, parent.id, { name: 'Con giro', notes: null })!;
		expect(archiveFigure(db, a.id, 1000)).toBe(true);
		expect(listVariations(db, parent.id).map((v) => v.id)).toEqual([b.id]);
		expect(db.select().from(figures).where(eq(figures.id, parent.id)).get()?.archivedAt).toBeNull();
	});
});

describe('setFigureShape and "same as Basic"', () => {
	const shape = (startCount: number | null, lengthCounts: number | null) => ({
		startIds: [],
		endId: null,
		startCount,
		lengthCounts
	});

	it('stores null timing on a variation — the figure’s is used', () => {
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		expect(setFigureShape(db, v.id, shape(null, 12))).toBe(true);
		const row = db.select().from(figures).where(eq(figures.id, v.id)).get()!;
		expect([row.startCount, row.lengthCounts]).toEqual([null, 12]);
	});

	it('refuses null timing on a figure, which has nothing to inherit from', () => {
		const parent = base();
		expect(setFigureShape(db, parent.id, shape(null, 8))).toBe(false);
		expect(setFigureShape(db, parent.id, shape(1, null))).toBe(false);
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/variations.spec.ts`
Expected: FAIL — `createVariation`, `updateVariation`, `listVariations` not exported; `setFigureShape` rejects null at the type level.

- [ ] **Step 3: Implement in `figures.ts`**

Change the drizzle import to include `isNotNull`:

```ts
import { and, asc, count, eq, inArray, isNotNull, isNull, like } from 'drizzle-orm';
```

and the schema import to `import { exercises, figures, recordings, type Figure } from './db/schema';` (`schema.ts` already exports `Figure`).

In `updateFigure`, after `if (!current) return null;` add:

```ts
		// A variation's partner, style and call text are its figure's; its own
		// name and directions go through `updateVariation`.
		if (current.parentId !== null) return null;
```

In `archiveFigure`, after `if (res.changes === 0) return false;` add:

```ts
		// A figure's variations go with it. Archiving a variation matches nothing
		// here, so the same function archives one alone.
		tx.update(figures)
			.set({ archivedAt: now })
			.where(and(eq(figures.parentId, id), isNull(figures.archivedAt)))
			.run();
```

Append to `figures.ts`:

```ts
/* ── Variations ─────────────────────────────────────────────────────────── */

export interface VariationInput {
	name: string;
	/** The variation's own directions. */
	notes: string | null;
}

/** A figure's unarchived variations, oldest first — the order of its version tabs. */
export function listVariations(db: Db, parentId: number): Figure[] {
	return db
		.select()
		.from(figures)
		.where(and(eq(figures.parentId, parentId), isNull(figures.archivedAt)))
		.orderBy(asc(figures.id))
		.all();
}

/**
 * Whether another unarchived variation of this figure already has the name,
 * ignoring case and surrounding space. Exported so the page can refuse a taken
 * name BEFORE it writes the variation's shape, not after.
 */
export function variationNameTaken(
	db: Db,
	parentId: number,
	name: string,
	exceptId: number | null
): boolean {
	const wanted = name.trim().toLowerCase();
	return listVariations(db, parentId).some(
		(v) => v.id !== exceptId && v.name.trim().toLowerCase() === wanted
	);
}

/**
 * A variation of a figure: a `figures` row with `parent_id` set, and deliberately
 * NO exercise — a variation is practised through its figure.
 *
 * Its dance, partner and style are copied from the figure, never taken from a
 * form. Everything that can differ starts unset, which reads as "the figure's".
 * Null when the figure is gone, archived, or itself a variation (one level
 * only), or when one of its variations already has the name.
 */
export function createVariation(db: Db, parentId: number, input: VariationInput): Figure | null {
	const parent = db.select().from(figures).where(eq(figures.id, parentId)).get();
	if (!parent || parent.archivedAt !== null || parent.parentId !== null) return null;
	if (variationNameTaken(db, parentId, input.name, null)) return null;
	return db
		.insert(figures)
		.values({
			name: input.name,
			notes: input.notes,
			parentId,
			dance: parent.dance,
			partner: parent.partner,
			styleTag: parent.styleTag,
			// Never read — the drill's pool excludes variations — but false says so.
			callable: false
		})
		.returning()
		.get();
}

/**
 * Rename a variation or change its directions. Null for a base figure, a gone
 * or archived variation, or a name a sibling already uses.
 */
export function updateVariation(db: Db, id: number, input: VariationInput): Figure | null {
	const current = db.select().from(figures).where(eq(figures.id, id)).get();
	if (!current || current.parentId === null || current.archivedAt !== null) return null;
	if (variationNameTaken(db, current.parentId, input.name, id)) return null;
	return (
		db
			.update(figures)
			.set({ name: input.name, notes: input.notes })
			.where(eq(figures.id, id))
			.returning()
			.get() ?? null
	);
}
```

(`isNotNull` is used in Task 4; if lint flags it as unused now, add it in Task 4 instead.)

- [ ] **Step 4: Nullable timing in `setFigureShape`**

In `src/lib/server/graph.ts`, change `FigureShape`:

```ts
	/** 1..8, or null on a variation for "the figure's". */
	startCount: number | null;
	/** 1..MAX_LENGTH_COUNTS counts, or null on a variation for "the figure's". */
	lengthCounts: number | null;
```

In `setFigureShape`, replace

```ts
	if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) return false;
```

with

```ts
	if (startCount !== null && !isStartCount(startCount)) return false;
	if (lengthCounts !== null && !isLengthCounts(lengthCounts)) return false;
```

change the figure select to `.select({ dance: figures.dance, parentId: figures.parentId })`, and after `if (!figure) return false;` add:

```ts
		// Null means "the figure's", which only a variation has a figure to take
		// from. A base figure always states its own timing.
		if (figure.parentId === null && (startCount === null || lengthCounts === null)) {
			return false;
		}
```

Update the doc comment's first paragraph to mention: "On a variation, null timing and no start rows mean the figure's."

- [ ] **Step 5: Run the tests**

Run: `nix develop -c npm run check`
Expected: PASS, including every new `variations.spec.ts` test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server
git commit -m "figures: create, rename and archive variations; no exercise, one level, unique names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Variations stay out of figure lists

**Files:**
- Modify: `src/lib/server/figures.ts` (`listFigures`, `listCallableFigures`)
- Modify: `src/lib/server/lessons.ts` (`linkFigure`, `listLinkableFigures`)
- Modify: `src/lib/server/graph.ts` (new `taggedFigures`)
- Modify: `src/routes/[dance]/figures/+page.server.ts` (tagged count)
- Test: `src/lib/server/variations.spec.ts`

**Interfaces:**
- Produces: `taggedFigures(db: Db, dance: DanceSlug): { done: number; total: number }` in `graph.ts` — base figures only.

- [ ] **Step 1: Write the failing tests**

Extend the imports of `variations.spec.ts` with `listCallableFigures, listFigures` from `./figures`, `createLesson, linkFigure, listLinkableFigures` from `./lessons`, `taggedFigures` from `./graph` (merge into the existing `./graph` import), and `seedPositions, listPositions` from `./positions`. Append:

```ts
describe('variations are not figures, for every list', () => {
	const setup = () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		return { parent, v };
	};

	it('leaves them out of the library', () => {
		const { parent } = setup();
		expect(listFigures(db, 'salsa').map((f) => f.id)).toEqual([parent.id]);
	});

	it('leaves them out of the drill’s pool', () => {
		const { parent } = setup();
		expect(listCallableFigures(db, 'salsa').map((f) => f.id)).toEqual([parent.id]);
	});

	it('leaves them out of the lesson picker, and refuses one posted by hand', () => {
		const { parent, v } = setup();
		const { lesson } = createLesson(db, 'salsa', {
			lessonDay: '2026-09-22',
			title: 'Class',
			notes: null
		});
		expect(listLinkableFigures(db, lesson.id).map((f) => f.id)).toEqual([parent.id]);
		expect(linkFigure(db, lesson.id, v.id)).toBe(false);
	});

	it('leaves them out of the tagged count', () => {
		seedPositions(db);
		const { v } = setup();
		const hammer = listPositions(db, 'salsa').find((p) => p.slug === 'hammerlock-r')!;
		setFigureShape(db, v.id, { startIds: [], endId: hammer.id, startCount: null, lengthCounts: null });
		expect(taggedFigures(db, 'salsa')).toEqual({ done: 0, total: 1 });
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/variations.spec.ts`
Expected: FAIL — the lists include the variation; `taggedFigures` is not exported.

- [ ] **Step 3: Implement**

`figures.ts`, `listFigures`: change

```ts
	const where = [isNull(figures.archivedAt), eq(figures.dance, dance)];
```

to

```ts
	// Variations are versions OF a figure, reached through it — never figures in
	// their own right in any list.
	const where = [isNull(figures.archivedAt), eq(figures.dance, dance), isNull(figures.parentId)];
```

`listCallableFigures`: change its `.where(and(isNull(figures.archivedAt), eq(figures.callable, true), eq(figures.dance, dance)))` to

```ts
		.where(
			and(
				isNull(figures.archivedAt),
				isNull(figures.parentId),
				eq(figures.callable, true),
				eq(figures.dance, dance)
			)
		)
```

`lessons.ts`, `linkFigure`: change the figure select to `.select({ id: figures.id, dance: figures.dance, parentId: figures.parentId })` and replace `if (!figure) return false;` with

```ts
		// A lesson teaches the figure; its variations are reached through it.
		if (!figure || figure.parentId !== null) return false;
```

`lessons.ts`, `listLinkableFigures`: change `const where = [isNull(figures.archivedAt), eq(figures.dance, lesson.dance)];` to

```ts
	const where = [
		isNull(figures.archivedAt),
		isNull(figures.parentId),
		eq(figures.dance, lesson.dance)
	];
```

`graph.ts`, append:

```ts
/**
 * How much of the repertoire carries handhold tags — figures only. A variation
 * inherits its figure's tags, so counting it would make an untagged figure with
 * three variations look four times as untagged.
 */
export function taggedFigures(db: Db, dance: DanceSlug): { done: number; total: number } {
	const rows = db
		.select({ id: figures.id, end: figures.endPositionId })
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), isNull(figures.parentId)))
		.all();
	const ids = rows.map((r) => r.id);
	const withStarts = new Set(
		ids.length === 0
			? []
			: db
					.select({ id: figureStartPositions.figureId })
					.from(figureStartPositions)
					.where(inArray(figureStartPositions.figureId, ids))
					.all()
					.map((r) => r.id)
	);
	return {
		done: rows.filter((r) => r.end !== null || withStarts.has(r.id)).length,
		total: rows.length
	};
}
```

`src/routes/[dance]/figures/+page.server.ts`: change the graph import to `import { taggedFigures } from '$lib/server/graph';`, delete `const graph = buildGraph(db, dance);`, and replace the `tagged: { … }` block with:

```ts
		// How much of the repertoire carries handhold tags. An untagged figure
		// reads as neutral, which is right for most of casino but worth surfacing:
		// the graph is only as good as this fraction.
		tagged: taggedFigures(db, dance)
```

- [ ] **Step 4: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server "src/routes/[dance]/figures/+page.server.ts"
git commit -m "figures: variations stay out of the library, the drill pool, lessons and the tagged count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The graph fills variations in; labels; routines see them

**Files:**
- Modify: `src/lib/server/graph.ts` (`buildGraph`)
- Modify: `src/lib/server/figures.ts` (`figureLabels`, `listVersions`, `listFiguresForCall`)
- Modify: `src/lib/types.ts` (`FigureVersion`)
- Modify: `src/lib/server/routines.ts` (landing from the graph)
- Modify: `src/lib/server/practice-content.ts` (routine slot names)
- Test: `src/lib/server/variations.spec.ts`

**Interfaces:**
- Consumes: Task 2's `createVariation`, nullable `setFigureShape`.
- Produces:
  - `buildGraph` — a variation node has starts/end/start/length filled from its parent where unset; a variation whose parent is not in the graph is left out.
  - `figureLabels(db: Db, dance: DanceSlug): Map<number, string>` — every figure of the dance INCLUDING archived; a variation reads `"<figure> · <variation>"`.
  - `interface FigureVersion { id: number; parentId: number | null; name: string; label: string }` in `src/lib/types.ts`. `name` is the row's own name ("Doble"); `label` is how to show it anywhere else ("Enchufla · Doble"; a base figure's label is its name).
  - `listVersions(db: Db, dance: DanceSlug): FigureVersion[]` — unarchived base figures alphabetically, each followed by its unarchived variations oldest first.
  - `listFiguresForCall` — a variation comes back with `name` = its label and `say` = its figure's `callText ?? name`.

- [ ] **Step 1: Write the failing tests**

Extend `variations.spec.ts` imports: `buildGraph` from `./graph`; `figureLabels, listFiguresForCall, listVersions` from `./figures`; `addFigureSlot, addOption, createRoutine, routineSlots` from `./routines`; `practicePayload` from `./practice-content`; `positionCounts` from `$lib/graph/graph`. Append:

```ts
describe('buildGraph fills a variation from its figure', () => {
	it('reads an untouched variation exactly as its figure', () => {
		seedPositions(db);
		const [open, cross, hammer] = ['open-two', 'cross-hand', 'hammerlock-r'].map(
			(slug) => listPositions(db, 'salsa').find((p) => p.slug === slug)!.id
		);
		const parent = base();
		setFigureShape(db, parent.id, {
			startIds: [open, cross],
			endId: hammer,
			startCount: 5,
			lengthCounts: 12
		});
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const node = buildGraph(db, 'salsa').figures.find((f) => f.id === v.id)!;
		expect({ ...node, starts: [...node.starts].sort((a, b) => a - b) }).toEqual({
			id: v.id,
			starts: [open, cross].sort((a, b) => a - b),
			end: hammer,
			start: 5,
			length: 12
		});
	});

	it('lets a variation override each field on its own', () => {
		seedPositions(db);
		const closed = listPositions(db, 'salsa').find((p) => p.slug === 'closed')!.id;
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		setFigureShape(db, v.id, { startIds: [closed], endId: null, startCount: null, lengthCounts: 16 });
		const node = buildGraph(db, 'salsa').figures.find((f) => f.id === v.id)!;
		expect(node).toMatchObject({ starts: [closed], end: null, start: 1, length: 16 });
	});

	it('leaves out a variation whose figure is archived', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		// Only the parent, as a hand-edited row would be — archiveFigure takes both.
		db.update(figures).set({ archivedAt: 1 }).where(eq(figures.id, parent.id)).run();
		expect(buildGraph(db, 'salsa').figures.map((f) => f.id)).not.toContain(v.id);
	});

	it('counts a variation in the gap report — it is a real way out of a hold', () => {
		seedPositions(db);
		const hammer = listPositions(db, 'salsa').find((p) => p.slug === 'hammerlock-r')!.id;
		const v = createVariation(db, base().id, { name: 'Doble', notes: null })!;
		setFigureShape(db, v.id, { startIds: [], endId: hammer, startCount: null, lengthCounts: null });
		const [counts] = positionCounts(buildGraph(db, 'salsa'), [hammer]);
		expect(counts.inCount).toBe(1);
	});
});

describe('labels and versions', () => {
	it('shows a variation as "figure · variation", archived ones included', () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		archiveFigure(db, v.id, 1000);
		expect(figureLabels(db, 'salsa').get(v.id)).toBe('Enchufla · Doble');
		expect(figureLabels(db, 'salsa').get(parent.id)).toBe('Enchufla');
	});

	it('lists each figure followed by its live variations', () => {
		const a = base('Setenta');
		const b = base('Enchufla');
		const d = createVariation(db, b.id, { name: 'Doble', notes: null })!;
		const gone = createVariation(db, b.id, { name: 'Old', notes: null })!;
		archiveFigure(db, gone.id, 1000);
		expect(listVersions(db, 'salsa')).toEqual([
			{ id: b.id, parentId: null, name: 'Enchufla', label: 'Enchufla' },
			{ id: d.id, parentId: b.id, name: 'Doble', label: 'Enchufla · Doble' },
			{ id: a.id, parentId: null, name: 'Setenta', label: 'Setenta' }
		]);
	});

	it('names a routine’s variation on screen and says its figure’s name', () => {
		const parent = createFigure(db, 'salsa', {
			name: 'Enchufla',
			partner: 'partner',
			style: 'salsa',
			notes: null,
			callable: true,
			callText: 'en-CHU-fla'
		})!.figure;
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		expect(listFiguresForCall(db, 'salsa', [v.id])).toMatchObject([
			{ id: v.id, name: 'Enchufla · Doble', say: 'en-CHU-fla' }
		]);
	});

	it('names a variation in a routine’s practice panel', () => {
		const parent = base('Enchufla');
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		addFigureSlot(db, routine.id, v.id);
		const content = practicePayload(db, exercise, 'Europe/Ljubljana', Date.now()).content;
		expect(content.type === 'routine' && content.slots[0].names).toEqual(['Enchufla · Doble']);
	});
});

describe('routines see a variation’s inherited landing', () => {
	it('accepts a variation that lands where its figure does as an alternative to it', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const step = addFigureSlot(db, routine.id, parent.id)!;
		expect(addOption(db, step, v.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds.sort()).toEqual([parent.id, v.id].sort());
	});

	it('refuses one whose own length leaves the next figure on another count', () => {
		const parent = base();
		const v = createVariation(db, parent.id, { name: 'Corta', notes: null })!;
		setFigureShape(db, v.id, { startIds: [], endId: null, startCount: null, lengthCounts: 4 });
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const step = addFigureSlot(db, routine.id, parent.id)!;
		expect(addOption(db, step, v.id)).toBe(false);
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/variations.spec.ts`
Expected: FAIL — the untouched variation reads as neutral/1/8 rather than its figure's; `figureLabels`/`listVersions` are not exported; the call name is "Doble"; the practice panel says "Doble". Of the two routine tests, the "accepts" one may already pass (an untouched variation's null row happens to read like an untagged 8-count figure) and the "refuses" one passes already — both must still pass after; they pin behaviour the graph-based landing must keep.

- [ ] **Step 3: `buildGraph` fills variations in**

In `src/lib/server/graph.ts`, `buildGraph`: add `parentId: figures.parentId` to the select, and replace the `return { … }` with:

```ts
	// A variation takes whatever it leaves unset from its figure. Resolved HERE,
	// so `src/lib/graph/` never learns that variations exist — the same way it
	// never learns that dances do.
	const byId = new Map(rows.map((r) => [r.id, r]));
	const nodes: Graph['figures'] = [];
	for (const r of rows) {
		const parent = r.parentId === null ? null : (byId.get(r.parentId) ?? null);
		// A variation whose figure is not in the graph — archived by hand, or gone
		// — has nothing to fill from. `archiveFigure` archives both together.
		if (r.parentId !== null && parent === null) continue;
		const own = byFigure.get(r.id) ?? [];
		nodes.push({
			id: r.id,
			starts: own.length > 0 || parent === null ? own : (byFigure.get(parent.id) ?? []),
			end: r.end ?? parent?.end ?? null,
			start: r.startCount ?? parent?.startCount ?? DEFAULT_START_COUNT,
			length: r.lengthCounts ?? parent?.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		});
	}

	return {
		neutral: neutralPosition(db, dance)?.id ?? 0,
		figures: nodes
	};
```

(`byFigure` is the existing start-positions map; the `starts` query already runs over every row's id, variations included.)

- [ ] **Step 4: Labels, versions, call names**

`src/lib/types.ts`, beside `CallableFigure`:

```ts
/** A figure or one of its variations, as a picker offers it. */
export interface FigureVersion {
	id: number;
	/** The figure this is a variation of; null for the figure itself. */
	parentId: number | null;
	/** The row's own name — "Doble". */
	name: string;
	/** How to show it anywhere else — "Enchufla · Doble". A figure's label is its name. */
	label: string;
}
```

`figures.ts` — import `FigureVersion` alongside `CallableFigure` from `$lib/types`, then append:

```ts
/**
 * Every figure of a dance by id, and how to show it: a variation reads
 * "Enchufla · Doble". Archived rows included — a routine slot can still name
 * one, and a name beats "archived figure".
 */
export function figureLabels(db: Db, dance: DanceSlug): Map<number, string> {
	const rows = db
		.select({ id: figures.id, name: figures.name, parentId: figures.parentId })
		.from(figures)
		.where(eq(figures.dance, dance))
		.all();
	const names = new Map(rows.map((r) => [r.id, r.name]));
	return new Map(
		rows.map((r) => [
			r.id,
			r.parentId === null ? r.name : `${names.get(r.parentId) ?? '?'} · ${r.name}`
		])
	);
}

/**
 * The unarchived figures of a dance, alphabetically, each followed by its
 * unarchived variations oldest first — what a picker that chooses a VERSION
 * offers.
 */
export function listVersions(db: Db, dance: DanceSlug): FigureVersion[] {
	const variations = db
		.select({ id: figures.id, parentId: figures.parentId, name: figures.name })
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), isNotNull(figures.parentId)))
		.orderBy(asc(figures.id))
		.all();
	return listFigures(db, dance).flatMap((f) => [
		{ id: f.id, parentId: null, name: f.name, label: f.name },
		...variations
			.filter((v) => v.parentId === f.id)
			.map((v) => ({ id: v.id, parentId: f.id, name: v.name, label: `${f.name} · ${v.name}` }))
	]);
}
```

Replace `listFiguresForCall`'s body (keep its doc comment, adding one sentence: "A variation is shown as "Enchufla · Doble" and SAID as its figure — the drill never calls a variation, and a spoken call has three counts to fit in.") with:

```ts
	if (ids.length === 0) return [];
	const rows = db
		.select({
			id: figures.id,
			name: figures.name,
			callText: figures.callText,
			partner: figures.partner,
			style: figures.styleTag,
			parentId: figures.parentId
		})
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), inArray(figures.id, ids)))
		.orderBy(figures.name)
		.all();
	const parentIds = [...new Set(rows.flatMap((r) => (r.parentId === null ? [] : [r.parentId])))];
	const parents = new Map(
		(parentIds.length === 0
			? []
			: db
					.select({ id: figures.id, name: figures.name, callText: figures.callText })
					.from(figures)
					.where(inArray(figures.id, parentIds))
					.all()
		).map((p) => [p.id, p])
	);
	return rows.map(({ callText, parentId, ...f }) => {
		const parent = parentId === null ? undefined : parents.get(parentId);
		return parent
			? { ...f, name: `${parent.name} · ${f.name}`, say: parent.callText ?? parent.name }
			: { ...f, say: callText ?? f.name };
	});
```

- [ ] **Step 5: Routines read landings off the graph**

In `src/lib/server/routines.ts`:
- imports: delete `import { neutralPosition } from './positions';` and `import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT, nextCount } from '$lib/graph/timing';`; add `import { buildGraph } from './graph';` and `import { endOf, figureById, nextCountOf, type Graph } from '$lib/graph/graph';` (check `Graph` is not already imported from `$lib/routines/routines` types; it is not).
- replace the whole `landingOf` function and its doc comment with:

```ts
/**
 * Where a figure — or a variation — leaves the hands and on which count it
 * leaves the next one: the two things alternatives must agree on. Read off the
 * graph, which is what fills a variation's unset fields from its figure and
 * resolves untagged to neutral; reading the row directly would see a
 * variation's nulls. Null when the figure is not in this dance's graph —
 * another dance, archived, or gone.
 */
function landingIn(g: Graph, figureId: number): { end: number; next: number } | null {
	const f = figureById(g, figureId);
	return f ? { end: endOf(g, f), next: nextCountOf(f) } : null;
}
```

- `addFigureSlot`: replace `if (landingOf(db, dance, figureId) === null) return null;` with `if (landingIn(buildGraph(db, dance), figureId) === null) return null;`
- `addOption`: replace `const landing = landingOf(db, dance, figureId);` with

```ts
	const g = buildGraph(db, dance);
	const landing = landingIn(g, figureId);
```

  and `const other = landingOf(db, dance, o.figureId);` with `const other = landingIn(g, o.figureId);`.
- If `neutralPosition` or `DanceSlug` usages remain elsewhere in the file, keep their imports; run lint to confirm.

- [ ] **Step 6: The practice panel names variations**

In `src/lib/server/practice-content.ts`, `case 'routine'`, replace

```ts
			// Every figure of the dance, archived included: a slot can still name one.
			const names = new Map(
				db
					.select({ id: figures.id, name: figures.name })
					.from(figures)
					.where(eq(figures.dance, exercise.dance))
					.all()
					.map((f) => [f.id, f.name] as [number, string])
			);
```

with

```ts
			// Every figure of the dance, archived included: a slot can still name
			// one. A variation reads "Enchufla · Doble".
			const names = figureLabels(db, exercise.dance as DanceSlug);
```

importing `figureLabels` from `./figures` and `type DanceSlug` from `$lib/dances/dances` (drop the `figures`/`eq` imports if nothing else in the file uses them).

- [ ] **Step 7: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib
git commit -m "graph: fill a variation from its figure; labels and versions; routines see variations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The figure page's server — versions, redirect, version-aware actions

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts`
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: Tasks 2 and 4.
- Produces (load data): `figure` (the base row), `exercise`, `versions: { id: number; name: string }[]` (Basic first), `version: { id; name; notes; isVariation: boolean; recordings }`, `positions`, `tags` (of the version), `own: { startCount: number | null; lengthCounts: number | null }` (the version's own columns), `basic: { startCount: number; lengthCounts: number }` (the figure's, resolved), `effective: { starts: number[]; end: number | null; startCount: number; lengthCounts: number }` (what is danced), `leadsTo`/`followsFrom: { id; parentId: number | null; name }[]`, `links`, `taughtIn`, `popup`.
- Produces (actions): `update` (the base figure, unchanged), `createVariation`, `updateVariation`, `archiveVariation`, `archive`, `deleteRecording` (now takes `versionId`), `log`, `deleteSet`, `addLink`, `deleteLink`.

- [ ] **Step 1: Write the failing tests**

In `src/routes/[dance]/dance-wall.spec.ts`: add `createVariation` to the `$lib/server/figures` import and `addRecording` too if not present; then add, after the three figure-edit tests from slice 1:

```ts
	describe('variations', () => {
		const loadWith = (dance: string, id: string, search = '') =>
			(figurePage.load as unknown as (e: unknown) => unknown)({
				params: { dance, id },
				url: new URL(`http://localhost/${search}`),
				locals: { user: USER }
			});

		it('opens a variation’s own URL on its figure, with its tab chosen', () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			expect(() => loadWith('salsa', String(v.id))).toThrow(
				expect.objectContaining({ status: 303, location: `/salsa/figures/${parent.id}?v=${v.id}` })
			);
		});

		it('will not redirect across the wall: a bachata variation under /salsa/ is a 404', () => {
			const v = createVariation(db, bachataFigureId, { name: 'Doble', notes: null })!;
			expect(() => loadWith('salsa', String(v.id))).toThrow(threw404);
		});

		it('shows the chosen tab, and falls back to Basic for a foreign ?v=', () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: 'Spot' })!;
			const other = createVariation(db, bachataFigureId, { name: 'Otra', notes: null })!;
			expect(loadWith('salsa', String(parent.id), `?v=${v.id}`)).toMatchObject({
				version: { id: v.id, name: 'Doble', notes: 'Spot', isVariation: true },
				versions: [
					{ id: parent.id, name: 'Basic' },
					{ id: v.id, name: 'Doble' }
				]
			});
			expect(loadWith('salsa', String(parent.id), `?v=${other.id}`)).toMatchObject({
				version: { id: parent.id, isVariation: false }
			});
		});

		/** A complete variation edit — each test overrides only what it is about. */
		const editV = (versionId: number, fields: Record<string, string> = {}) => ({
			versionId: String(versionId),
			name: 'Renamed',
			notes: '',
			startCount: '',
			lengthCounts: '',
			...fields
		});

		it('refuses to edit a variation of another figure, writing nothing', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			await refuses(
				figurePage.actions.updateVariation,
				post('salsa', editV(vb.id, { lengthCounts: '4' }), String(a.id))
			);
			const row = getFigure(db, vb.id)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', null]);
		});

		it('refuses a sibling’s name before writing anything', async () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			createVariation(db, parent.id, { name: 'Con giro', notes: null });
			const result = await call(
				figurePage.actions.updateVariation,
				post('salsa', editV(v.id, { name: 'con giro', lengthCounts: '4' }), String(parent.id))
			);
			expect(result).toMatchObject({ status: 400 });
			const row = getFigure(db, v.id)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', null]);
		});

		it('saves "same as Basic" as null and a stated value as itself', async () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			await call(
				figurePage.actions.updateVariation,
				post('salsa', editV(v.id, { name: 'Doble', startCount: '5' }), String(parent.id))
			);
			const row = getFigure(db, v.id)!.figure;
			expect([row.startCount, row.lengthCounts]).toEqual([5, null]);
		});

		it('refuses to archive a variation of another figure', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			await refuses(
				figurePage.actions.archiveVariation,
				post('salsa', { versionId: String(vb.id) }, String(a.id))
			);
			expect(getFigure(db, vb.id)!.figure.archivedAt).toBeNull();
		});

		it('refuses to delete a recording of another figure’s variation', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			const rec = addRecording(db, {
				figureId: vb.id,
				file: 'x.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			await refuses(
				figurePage.actions.deleteRecording,
				post('salsa', { versionId: String(vb.id), recordingId: String(rec.id) }, String(a.id))
			);
			expect(getFigure(db, vb.id)!.recordings.map((r) => r.id)).toEqual([rec.id]);
		});
	});
```

(`refuses` treats a thrown 404 as the refusal; `call` returns an `ActionFailure` whose `status` `toMatchObject` checks; `redirect()` throws an object with `status` and `location`.)

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run "src/routes/[dance]/dance-wall.spec.ts"`
Expected: FAIL — no redirect, no `version`/`versions` in the load, `updateVariation`/`archiveVariation` are not actions, `deleteRecording` finds the variation's recording absent from the base figure's list (that one may already pass for the wrong reason; it must still pass after).

- [ ] **Step 3: Rewrite the load**

Imports to add/adjust in `src/routes/[dance]/figures/[id]/+page.server.ts`:

```ts
import {
	archiveFigure,
	createVariation,
	deleteRecording,
	figureLabels,
	getFigure,
	listVariations,
	listVersions,
	updateFigure,
	updateVariation,
	variationNameTaken
} from '$lib/server/figures';
import { endOf, figureById, follows, precedes, startsOf } from '$lib/graph/graph';
import { checkbox, int, ints, oneOf, optionalInt, optionalText, text } from '$lib/server/form';
```

(`listFigures` is no longer used here; drop it.)

Replace `figureOf` with:

```ts
/**
 * The FIGURE this URL names, or a 404.
 *
 * `getFigure` is id-scoped, so nothing but this stops `/salsa/figures/7` from
 * rendering a bachata figure — a hole straight through the dance wall. A
 * variation's own id is not a figure page: `load` redirects it to its figure
 * first, and every action posts to the figure's URL, so here it is a 404.
 */
function figureOf(params: { dance: string; id: string }) {
	const dance = danceOf(params);
	const found = getFigure(getDb(), figureId(params.id));
	if (
		!found ||
		found.figure.archivedAt !== null ||
		found.figure.dance !== dance ||
		found.figure.parentId !== null
	) {
		throw error(404, 'Figure not found');
	}
	return found;
}

/**
 * One of THIS figure's versions, by the id posted with a form: the figure
 * itself, or one of its unarchived variations. Anything else — a variation of
 * another figure, of another dance, archived — is a 404, because the id in a
 * form body is just a number.
 */
function versionOf(found: NonNullable<ReturnType<typeof getFigure>>, raw: number | undefined) {
	if (raw === undefined || raw === found.figure.id) return found;
	const v = getFigure(getDb(), raw);
	if (!v || v.figure.parentId !== found.figure.id || v.figure.archivedAt !== null) {
		throw error(404, 'Figure not found');
	}
	return v;
}

/** `versionOf`, for actions that only make sense on a variation. */
function variationOf(found: NonNullable<ReturnType<typeof getFigure>>, raw: number | undefined) {
	const v = versionOf(found, raw);
	if (v.figure.parentId === null) throw error(404, 'Figure not found');
	return v;
}
```

Replace the whole `load` with:

```ts
export const load: PageServerLoad = ({ params, url, locals }) => {
	const dance = danceOf(params);
	const db = getDb();

	// A variation's own URL — from a routine, a "Leads to" list, an old link —
	// lands on its figure with its tab chosen. Only within the dance: a bachata
	// variation under /salsa/ falls through to `figureOf`'s 404.
	const direct = getFigure(db, figureId(params.id));
	if (
		direct &&
		direct.figure.parentId !== null &&
		direct.figure.dance === dance &&
		direct.figure.archivedAt === null
	) {
		throw redirect(303, `/${dance}/figures/${direct.figure.parentId}?v=${direct.figure.id}`);
	}

	const found = figureOf(params);
	const variations = listVariations(db, found.figure.id);
	// A ?v= that is not one of THIS figure's live variations shows Basic.
	const chosen = variations.find((v) => v.id === Number(url.searchParams.get('v'))) ?? null;
	const version = chosen ? getFigure(db, chosen.id)! : found;
	const versionId = version.figure.id;

	const graph = buildGraph(db, dance);
	const node = figureById(graph, versionId);
	const labels = figureLabels(db, dance);
	const parentOf = new Map(listVersions(db, dance).map((v) => [v.id, v.parentId]));
	// Live figures and variations only, never the version itself.
	const link = (ids: number[]) =>
		ids
			.filter((id) => id !== versionId && parentOf.has(id))
			.map((id) => ({ id, parentId: parentOf.get(id) ?? null, name: labels.get(id)! }));

	const tags = figurePositions(db, versionId);
	const live = listPositions(db, dance);
	const liveIds = new Set(live.map((p) => p.id));
	// An archived position stays referenced by the figures tagged with it (the
	// routines design doc's rule): if THIS version points at one, splice it back
	// into the list the pickers render — after the live rows, flagged — so a Save
	// that touches nothing else does not silently drop it. `setFigureShape`
	// accepts an archived id back; this is what lets the page resubmit it.
	const taggedIds = [...tags.startIds, ...(tags.endId === null ? [] : [tags.endId])];
	const archivedTagged = [...new Set(taggedIds)]
		.filter((id) => !liveIds.has(id))
		.map((id) => getPosition(db, id))
		.filter((p): p is NonNullable<typeof p> => p !== null && p.dance === dance);

	const basic = {
		startCount: found.figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: found.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};

	return {
		figure: found.figure,
		exercise: found.exercise,
		versions: [
			{ id: found.figure.id, name: 'Basic' },
			...variations.map((v) => ({ id: v.id, name: v.name }))
		],
		version: {
			id: versionId,
			name: version.figure.name,
			notes: version.figure.notes,
			isVariation: chosen !== null,
			recordings: version.recordings
		},
		positions: [
			...live.map((p) => ({ id: p.id, name: p.name, neutral: p.neutral, archived: false })),
			...archivedTagged.map((p) => ({
				id: p.id,
				name: p.name,
				neutral: p.neutral,
				archived: true
			}))
		],
		tags,
		// What the edit form shows: the version's OWN columns. On a variation a
		// null means "same as Basic"; on Basic the resolved values stand in.
		own: chosen
			? { startCount: version.figure.startCount, lengthCounts: version.figure.lengthCounts }
			: basic,
		basic,
		// What is actually danced, filled from Basic and with neutral resolved.
		effective: {
			starts: node ? startsOf(graph, node) : [],
			end: node ? endOf(graph, node) : null,
			startCount: node?.start ?? basic.startCount,
			lengthCounts: node?.length ?? basic.lengthCounts
		},
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, versionId)),
		followsFrom: link(precedes(graph, versionId)),
		links: listLinks(db, { figureId: found.figure.id }),
		taughtIn: taughtIn(db, found.figure.id),
		popup: found.exercise
			? popupData(db, dance, found.exercise.id, zoneOf(locals), Date.now())
			: null
	};
};
```

- [ ] **Step 4: Version-aware actions**

`update` — unchanged (it already goes through `figureOf`, which now also refuses a variation id).

`archive` — unchanged; its confirm text changes in Task 6.

Add after `update`:

```ts
	createVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				action: 'createVariation',
				message: 'Give the variation a name (up to 200 characters).'
			});
		}
		const made = createVariation(getDb(), found.figure.id, { name, notes });
		if (!made) {
			return fail(400, {
				action: 'createVariation',
				message: 'This figure already has a variation with that name.'
			});
		}
		throw redirect(303, `/${params.dance}/figures/${found.figure.id}?v=${made.id}`);
	},

	/**
	 * A variation's one Save: name, directions, positions and timing. An empty
	 * start count, length or end is "same as Basic" and saves as null.
	 *
	 * The name is checked against its siblings FIRST, then the shape is written,
	 * then the name: every refusal comes before any write, so a refused save
	 * leaves nothing half-done.
	 */
	updateVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const v = variationOf(found, int(form, 'versionId'));
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = optionalInt(form, 'startCount', 1, 8);
		const lengthCounts = optionalInt(form, 'lengthCounts', 1, MAX_LENGTH_COUNTS);

		if (!name || notes === undefined) {
			return fail(400, {
				action: 'updateVariation',
				message: 'Give the variation a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'updateVariation', message: 'Pick an end position.' });
		}
		if (startCount === undefined || lengthCounts === undefined) {
			return fail(400, {
				action: 'updateVariation',
				message: `A variation starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts — or leaves either as Basic.`
			});
		}
		const db = getDb();
		if (variationNameTaken(db, found.figure.id, name, v.figure.id)) {
			return fail(400, {
				action: 'updateVariation',
				message: 'This figure already has a variation with that name.'
			});
		}
		if (!setFigureShape(db, v.figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		updateVariation(db, v.figure.id, { name, notes });
		return { action: 'updateVariation', ok: true };
	},

	archiveVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const v = variationOf(found, int(await request.formData(), 'versionId'));
		archiveFigure(getDb(), v.figure.id, Date.now());
		throw redirect(303, `/${params.dance}/figures/${found.figure.id}`);
	},
```

Replace the `deleteRecording` action's first two lines

```ts
		const found = figureOf(params);
		const id = int(await request.formData(), 'recordingId');
```

with

```ts
		const form = await request.formData();
		// The recording must belong to the version posted, and that version to
		// this figure — `versionOf` 404s a variation of any other figure.
		const found = versionOf(figureOf(params), int(form, 'versionId'));
		const id = int(form, 'recordingId');
```

(The rest of `deleteRecording` already checks `found.recordings`, which is now the version's.)

- [ ] **Step 5: Run everything**

Run: `nix develop -c npm run check`
Expected: FAIL only in `svelte-check` for `+page.svelte` (it still reads `data.recordings` and `data.timing`), and every dance-wall test PASSES. If svelte-check is the only failure, proceed to Task 6 before committing; otherwise fix first.

- [ ] **Step 6: Commit (together with Task 6)**

This task's commit is made at the end of Task 6, because the page cannot type-check between the two. Do NOT commit a red `npm run check`.

---

### Task 6: The figure page — version tabs, per-version view and edit

**Files:**
- Modify: `src/lib/components/figures/FigureTiming.svelte`
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte`

**Interfaces:**
- Consumes: Task 5's load data and actions.
- Produces: `FigureTiming` props `{ startCount: number | null; lengthCounts: number | null; inherited?: { startCount: number; lengthCounts: number } | null }` — with `inherited`, an empty choice posts `''` ("same as Basic").

- [ ] **Step 1: `FigureTiming` learns "Same as Basic"**

Replace `src/lib/components/figures/FigureTiming.svelte` with:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';

	/**
	 * Which count a figure begins on, and how many counts it takes.
	 *
	 * With `inherited` — on a variation — either can be left as Basic's: the
	 * chip "Basic (5)" and an empty length both post "", which the page saves
	 * as null. Seeds its own state once, like `StartPositions`, so key it on the
	 * version id wherever it is rendered.
	 */
	let {
		startCount,
		lengthCounts,
		inherited = null
	}: {
		startCount: number | null;
		lengthCounts: number | null;
		inherited?: { startCount: number; lengthCounts: number } | null;
	} = $props();

	// Strings, so "" can mean "as Basic" and still bind to a radio group.
	let start = $state(untrack(() => (startCount === null ? '' : String(startCount))));
	let length = $state(untrack(() => (lengthCounts === null ? '' : String(lengthCounts))));

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => String(i + 1));
	const shortcuts = ['4', '8', '16'];
	const chip = (on: boolean) =>
		`grid h-10 place-items-center rounded-lg border text-[15px] font-medium ${
			on ? 'border-accent bg-accent/15 text-accent' : 'border-line'
		}`;
</script>

<fieldset>
	<legend class="text-[13px] font-medium">Starts on</legend>
	{#if inherited}
		<label class="mt-1 {chip(start === '')} w-full">
			<input type="radio" name="startCount" value="" bind:group={start} class="sr-only" />
			Same as Basic ({inherited.startCount})
		</label>
	{/if}
	<div class="mt-1 grid grid-cols-8 gap-1">
		{#each counts as n (n)}
			<label class={chip(start === n)}>
				<input type="radio" name="startCount" value={n} bind:group={start} class="sr-only" />
				{n}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class="text-[13px] font-medium" for="figure-length">Counts</label>
	<div class="mt-1 flex flex-wrap items-center gap-2">
		<input
			id="figure-length"
			type="text"
			inputmode="numeric"
			pattern="[0-9]*"
			name="lengthCounts"
			required={!inherited}
			placeholder={inherited ? `Basic: ${inherited.lengthCounts}` : undefined}
			bind:value={length}
			class="h-11 w-24 rounded-xl border border-line bg-raised px-3 text-[15px]"
		/>
		{#each shortcuts as n (n)}
			<button
				type="button"
				onclick={() => (length = n)}
				class="h-11 rounded-xl border px-3 text-[14px] {length === n
					? 'border-accent text-accent'
					: 'border-line'}">{n}</button
			>
		{/each}
		{#if inherited}
			<button
				type="button"
				onclick={() => (length = '')}
				class="h-11 rounded-xl border px-3 text-[14px] {length === ''
					? 'border-accent text-accent'
					: 'border-line'}">As Basic</button
			>
		{/if}
	</div>
	<p class="mt-1 text-[12px] text-muted">
		How long it takes, 1 to {MAX_LENGTH_COUNTS}. One 8-count is 8.
	</p>
</div>
```

- [ ] **Step 2: Rewrite the page**

Replace `src/routes/[dance]/figures/[id]/+page.svelte` with:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import StartPositions from '$lib/components/figures/StartPositions.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import { logFor } from '$lib/components/exercises/kinds';
	import { PARTNER_LABEL } from '$lib/labels';
	import { frequencyLabel } from '$lib/frequency';
	import { dateLabel } from '$lib/format';
	import { localDay } from '$lib/day/day';
	import type { MediaProblem } from '$lib/media';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let logging = $state(false);
	let addingVariation = $state(false);
	const FigureLog = logFor('figure');
	/**
	 * Recordings whose player failed, and why. "missing" means the server has no
	 * file; "unplayable" means the file is there but this browser cannot decode
	 * it — typically an iPhone HEVC .mov opened in desktop Chrome — so it is
	 * offered as a download instead of being reported as lost.
	 */
	let broken = $state<Record<number, MediaProblem>>({});

	const figure = $derived(data.figure);
	const version = $derived(data.version);
	const slug = $derived(data.dance.slug);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failed = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;
	// The figure's real style tag, not the vestigial `figure.style` column.
	const styleLabel = $derived(figure.styleTag ? data.dance.styleLabel[figure.styleTag] : undefined);
	const neutralName = $derived(data.positions.find((p) => p.neutral)?.name ?? 'the neutral hold');
	const positionName = (id: number) =>
		data.positions.find((p) => p.id === id)?.name ?? 'an untagged position';

	/** On a variation, what it leaves to Basic — marked "(as Basic)" in view mode. */
	const asBasic = $derived({
		starts: version.isVariation && data.tags.startIds.length === 0,
		end: version.isVariation && data.tags.endId === null,
		startCount: version.isVariation && data.own.startCount === null,
		lengthCounts: version.isVariation && data.own.lengthCounts === null
	});
	const mark = (inherited: boolean) => (inherited ? ' (as Basic)' : '');

	/** "Open two hands / Cross-hand → Hammerlock", neutral already resolved by the graph. */
	const handholds = $derived(
		`${data.effective.starts.map(positionName).join(' / ') || neutralName}${mark(asBasic.starts)} → ${
			data.effective.end === null ? neutralName : positionName(data.effective.end)
		}${mark(asBasic.end)}`
	);
	const notes = $derived(version.isVariation ? version.notes : figure.notes);

	const tabHref = (id: number) =>
		id === figure.id
			? resolve('/[dance]/figures/[id]', { dance: slug, id: String(figure.id) })
			: resolve(`/${slug}/figures/${figure.id}?v=${id}`);
	const itemHref = (item: { id: number; parentId: number | null }) =>
		item.parentId === null
			? resolve('/[dance]/figures/[id]', { dance: slug, id: String(item.id) })
			: resolve(`/${slug}/figures/${item.parentId}?v=${item.id}`);

	const linkFailure = $derived(failed('addLink'));
	const linkEntered = $derived(form && 'urls' in form ? String(form.urls) : '');

	$effect(() => {
		if (failed('createVariation')) addingVariation = true;
	});

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
	const closeOnSuccess: SubmitFunction = () => async ({ update, result }) => {
		await update({ reset: false });
		if (result.type === 'success') editing = false;
	};
</script>

<svelte:head><title>{figure.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/figures', { dance: slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to figures">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{figure.name}</h1>
	<button
		type="button"
		class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
		onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button
	>
</header>

<!--
	Version tabs: Basic is the figure itself, then each variation, then + to add
	one. A tab is a link (?v=), so a reload or a shared link lands on it.
-->
<nav
	class="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2"
	aria-label="Versions of {figure.name}"
>
	{#each data.versions as v (v.id)}
		<a
			href={tabHref(v.id)}
			aria-current={v.id === version.id ? 'page' : undefined}
			class="h-9 shrink-0 rounded-full px-3.5 text-[14px] leading-9 font-medium {v.id === version.id
				? 'bg-accent text-accent-ink'
				: 'border border-line text-ink-2'}">{v.name}</a
		>
	{/each}
	<button
		type="button"
		onclick={() => (addingVariation = true)}
		class="grid size-9 shrink-0 place-items-center rounded-full border border-line text-[18px] text-accent"
		aria-label="New variation">+</button
	>
</nav>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if editing}
		{#if version.isVariation}
			<form
				method="POST"
				action="?/updateVariation"
				class="space-y-3"
				use:enhance={closeOnSuccess}
			>
				<input type="hidden" name="versionId" value={version.id} />
				<label class="block">
					<span class={label}>Name</span>
					<input name="name" required maxlength="200" value={version.name} class={field} />
				</label>
				<label class="block">
					<span class={label}>Directions</span>
					<textarea name="notes" rows="4" maxlength="2000" class={field}
						>{version.notes ?? ''}</textarea
					>
				</label>
				{#key version.id}
					<StartPositions
						positions={data.positions}
						initial={data.tags.startIds}
						neutralName="Same as Basic"
					/>
				{/key}
				<label class="block">
					<span class="text-[13px] font-medium">Ends at</span>
					<select
						name="endId"
						class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
					>
						<option value="" selected={data.tags.endId === null}>Same as Basic</option>
						{#each data.positions as position (position.id)}
							<option value={position.id} selected={data.tags.endId === position.id}>
								{position.name}{position.archived ? ' (archived)' : ''}
							</option>
						{/each}
					</select>
				</label>
				{#key version.id}
					<FigureTiming
						startCount={data.own.startCount}
						lengthCounts={data.own.lengthCounts}
						inherited={data.basic}
					/>
				{/key}
				{#if failed('updateVariation')}
					<p class={errorBox} role="alert">{failed('updateVariation')}</p>
				{/if}
				<button
					type="submit"
					class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
					>Save</button
				>
			</form>
			<form
				method="POST"
				action="?/archiveVariation"
				onsubmit={(e) => {
					if (!confirm(`Archive the variation “${version.name}”? Its recordings are kept.`)) {
						e.preventDefault();
					}
				}}
			>
				<input type="hidden" name="versionId" value={version.id} />
				<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
					>Archive variation</button
				>
			</form>
		{:else}
			<form method="POST" action="?/update" class="space-y-3" use:enhance={closeOnSuccess}>
				<FigureFields
					dance={data.dance}
					name={figure.name}
					partner={figure.partner}
					style={figure.styleTag ?? undefined}
					notes={figure.notes}
					callable={figure.callable}
					callText={figure.callText}
				/>
				<!--
					Keyed on the version: both pickers seed their own state once, and
					SvelteKit reuses them across a same-route navigation — a tab change
					included — so without the key the next version would open showing the
					previous one's values.
				-->
				{#key version.id}
					<StartPositions positions={data.positions} initial={data.tags.startIds} {neutralName} />
				{/key}
				<label class="block">
					<span class="text-[13px] font-medium">Ends at</span>
					<select
						name="endId"
						class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
					>
						<option value="" selected={data.tags.endId === null}>{neutralName}</option>
						{#each data.positions as position (position.id)}
							<option value={position.id} selected={data.tags.endId === position.id}>
								{position.name}{position.archived ? ' (archived)' : ''}
							</option>
						{/each}
					</select>
				</label>
				{#key version.id}
					<FigureTiming startCount={data.basic.startCount} lengthCounts={data.basic.lengthCounts} />
				{/key}
				{#if failed('update')}
					<p class={errorBox} role="alert">{failed('update')}</p>
				{/if}
				<button
					type="submit"
					class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
					>Save</button
				>
			</form>
			<form
				method="POST"
				action="?/archive"
				onsubmit={(e) => {
					if (
						!confirm(
							`Archive “${figure.name}” and its variations? Practice history and recordings are kept.`
						)
					) {
						e.preventDefault();
					}
				}}
			>
				<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
					>Archive figure</button
				>
			</form>
		{/if}
	{:else}
		<section>
			<p class="text-[13px] text-muted">
				{#if styleLabel}{styleLabel} ·
				{/if}{PARTNER_LABEL[figure.partner]}
			</p>
			<p class="text-[13px] text-muted">
				Starts on {data.effective.startCount}{mark(asBasic.startCount)} · {data.effective
					.lengthCounts} counts{mark(asBasic.lengthCounts)}
			</p>
			<p class="text-[13px] text-muted">{handholds}</p>
			{#if notes}
				<LinkedText text={notes} class="mt-2 text-[15px] whitespace-pre-line" />
			{/if}
		</section>

		{#if data.exercise && data.popup}
			<section class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<a
						href={resolve('/[dance]/exercises/[id]', {
							dance: slug,
							id: String(data.exercise.id)
						})}
						class="text-[12px] text-accent"
						>{frequencyLabel(data.exercise.everyDays)}{data.exercise.active ? '' : ' · inactive'} · Exercise
						→</a
					>
				</div>
				<button
					type="button"
					class="h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
					onclick={() => (logging = true)}>Log…</button
				>
			</section>
		{/if}
	{/if}

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
							<li><a class="text-[15px] text-accent" href={itemHref(item)}>{item.name}</a></li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Recordings</h2>
		<ul class="space-y-3">
			{#each version.recordings as rec (rec.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised">
					{#if broken[rec.id] === 'missing'}
						<p class="p-4 text-[13px] text-muted">The file for this recording is missing.</p>
					{:else if broken[rec.id] === 'unplayable'}
						<p class="p-4 text-[13px] text-muted">
							This browser can't play this file.
							<a
								href={resolve('/recordings/[file]', { file: rec.file })}
								download
								class="font-medium text-accent">Download it</a
							>
							or open it on your phone.
						</p>
					{:else}
						<VideoFrame
							src="/recordings/{rec.file}"
							kind={rec.kind}
							onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
						/>
					{/if}
					<div class="flex items-center justify-between px-3 py-2 text-[12px] text-muted">
						<span
							>{dateLabel(localDay(rec.createdAt, timezone))} · {Math.max(
								1,
								Math.round(rec.sizeBytes / 1024 / 1024)
							)} MB</span
						>
						<!-- Deleting is an edit; adding a recording stays one tap away in view mode. -->
						{#if editing}
							<form
								method="POST"
								action="?/deleteRecording"
								use:enhance
								onsubmit={(e) => {
									if (!confirm('Delete this recording?')) e.preventDefault();
								}}
							>
								<input type="hidden" name="versionId" value={version.id} />
								<input type="hidden" name="recordingId" value={rec.id} />
								<button type="submit" class="h-9 px-2 text-danger">Delete</button>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		<div class="mt-3">
			<!-- Keyed: the button holds upload state, and a tab change must not carry it over. -->
			{#key version.id}
				<UploadButton
					url="/api/figures/{version.id}/recordings"
					accept="video/*,audio/*"
					label="+ Add video or audio"
				/>
			{/key}
		</div>
	</section>

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
							href={resolve('/[dance]/lessons/[id]', { dance: slug, id: String(lesson.id) })}
							>{lesson.title}</a
						>
						<span class="text-[12px] text-muted">· {dateLabel(lesson.lessonDay)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<Sheet
	title="New variation of {figure.name}"
	open={addingVariation}
	onclose={() => (addingVariation = false)}
>
	<!-- A success redirects to the new variation's tab. Its positions and timing
	     start as Basic's; Edit there to change them. -->
	<form method="POST" action="?/createVariation" class="space-y-3" use:enhance>
		{#if failed('createVariation')}
			<p class={errorBox} role="alert">{failed('createVariation')}</p>
		{/if}
		<label class="block">
			<span class={label}>Name</span>
			<input name="name" required maxlength="200" placeholder="e.g. Doble, From cross" class={field} />
		</label>
		<label class="block">
			<span class={label}>Directions</span>
			<textarea name="notes" rows="3" maxlength="2000" class={field}></textarea>
		</label>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add variation</button
		>
	</form>
</Sheet>

{#if logging && data.popup}
	<FigureLog
		dance={data.dance}
		exercise={data.popup.exercise}
		sets={data.popup.sets}
		songs={data.popup.songs}
		takes={data.popup.takes}
		backfillDay={null}
		{timezone}
		message={failed('log')}
		onclose={() => (logging = false)}
	/>
{/if}
```

- [ ] **Step 3: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS (0 svelte-check errors; warnings only in files this plan does not touch).

- [ ] **Step 4: Commit Tasks 5 and 6 together**

```bash
git add "src/routes/[dance]/figures" "src/routes/[dance]/dance-wall.spec.ts" src/lib/components/figures
git commit -m "figure page: version tabs — Basic and each variation, with their own view, edit and recordings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The routine editor chooses versions

**Files:**
- Modify: `src/routes/[dance]/routines/[id]/+page.server.ts`
- Modify: `src/routes/[dance]/routines/[id]/+page.svelte`

**Interfaces:**
- Consumes: `listVersions`, `figureLabels` (Task 4); the graph's variation nodes.
- Produces (load data): `figures: (FigureVersion & { end: number | null; next: number | null })[]` (replacing the plain figure list), and `labels: Record<number, string>` — every figure of the dance, archived included.

- [ ] **Step 1: The load offers versions**

In `+page.server.ts`: replace `import { listFigures } from '$lib/server/figures';` with `import { figureLabels, listVersions } from '$lib/server/figures';` and the `figures` block (from the slice-1 comment "Each figure's landing…" through `});`) with:

```ts
	// Every figure AND variation, each with its landing — where it leaves the
	// hands and on which count — so the pickers can offer the ones that fit. The
	// server's `addOption` still decides; this only stops offering the refusals.
	const figures = listVersions(db, dance).map((v) => {
		const node = figureById(graph, v.id);
		return {
			...v,
			end: node ? endOf(graph, node) : null,
			next: node ? nextCountOf(node) : null
		};
	});
```

and add to the returned object, after `figures,`:

```ts
		// Names for every figure a slot can hold, archived ones included, so a slot
		// whose variation was archived still says what it was.
		labels: Object.fromEntries(figureLabels(db, dance)),
```

- [ ] **Step 2: The page labels versions and picks in two steps**

In `+page.svelte`:

Replace

```ts
	const figureName = $derived(new Map(data.figures.map((f) => [f.id, f.name])));
```

with

```ts
	/** Live figures and variations by id, for the pickers. */
	const live = $derived(new Set(data.figures.map((f) => f.id)));
```

Replace `optionName`'s body (keep its doc comment) with:

```ts
	function optionName(id: number): string {
		const name = data.labels[id] ?? 'a figure';
		return live.has(id) ? name : `${name} (archived)`;
	}
```

In `addable`, nothing changes except that it now compares versions; update its doc comment's first line to "Figures and variations that could stand in for this slot's: …".

Add, after `addable`:

```ts
	/**
	 * The add-slot picker in two steps: a figure, then — only when it has
	 * variations — which version. `pickedFigure` starts undefined so the select
	 * binds to its first option.
	 */
	let pickedFigure = $state<number | undefined>(undefined);
	const baseFigures = $derived(data.figures.filter((f) => f.parentId === null));
	const pickedVersions = $derived(
		data.figures.filter((f) => f.id === pickedFigure || f.parentId === pickedFigure)
	);
```

Replace the add-slot form in the "Add to this routine" sheet:

```svelte
		<form method="POST" action="?/addFigure" class="space-y-2" use:enhance={closeAdd}>
			<span class="text-[13px] font-medium">A figure</span>
			<select name="figureId" class="{select} w-full" aria-label="Figure to add">
				{#each data.figures as figure (figure.id)}
					<option value={figure.id}>{figure.name}</option>
				{/each}
			</select>
			<button type="submit" class="{step} w-full">Add slot</button>
		</form>
```

with

```svelte
		<form method="POST" action="?/addFigure" class="space-y-2" use:enhance={closeAdd}>
			<span class="text-[13px] font-medium">A figure</span>
			<select bind:value={pickedFigure} class="{select} w-full" aria-label="Figure to add">
				{#each baseFigures as figure (figure.id)}
					<option value={figure.id}>{figure.name}</option>
				{/each}
			</select>
			{#if pickedVersions.length > 1}
				<select name="figureId" class="{select} w-full" aria-label="Which version">
					{#each pickedVersions as v (v.id)}
						<option value={v.id}>{v.parentId === null ? 'Basic' : v.name}</option>
					{/each}
				</select>
			{:else}
				<input type="hidden" name="figureId" value={pickedFigure ?? ''} />
			{/if}
			<button type="submit" class="{step} w-full">Add slot</button>
		</form>
```

In the Alternatives picker, change `<option value={figure.id}>{figure.name}</option>` to `<option value={figure.id}>{figure.label}</option>`.

The `{#if data.figures.length === 0}` guard stays as it is.

- [ ] **Step 3: Run everything**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/[dance]/routines"
git commit -m "routine editor: pick a figure, then which version; slots name their variations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Smoke run, docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-figure-variations-design.md`
- Modify: `docs/superpowers/specs/2026-09-24-routines-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Smoke-test the built app against a copy of the dev database**

```bash
S=/tmp/claude-smoke-variations && rm -rf $S && mkdir -p $S/data && cp .data/salsa.db $S/data/salsa.db
nix develop -c sqlite3 $S/data/salsa.db "delete from sessions; delete from users;"
nix develop -c npm run build >/dev/null
(nix develop -c env DATA_DIR=$S/data DATABASE_PATH=$S/data/salsa.db ADMIN_EMAIL=smoke@example.test ADMIN_PASSWORD=smoke-pass-123 PORT=5199 ORIGIN=http://localhost:5199 node build > $S/server.log 2>&1 &)
B=http://localhost:5199; J=$S/jar
for i in $(seq 1 30); do curl -s -o /dev/null $B/login && break; sleep 1; done
post() { curl -s -c $J -b $J -H "Origin: $B" -H "x-sveltekit-action: true" -X POST "$1" -d "$2"; echo; }
curl -s -c $J -b $J -H "Origin: $B" -o /dev/null -w "login %{http_code}\n" -X POST $B/login -d "email=smoke@example.test&password=smoke-pass-123"
F=$(nix develop -c sqlite3 $S/data/salsa.db "select id from figures where dance='salsa' and parent_id is null and archived_at is null order by id limit 1;" | tail -1)
post "$B/salsa/figures/$F?/createVariation" "name=Doble&notes=Two turns"
V=$(nix develop -c sqlite3 $S/data/salsa.db "select id from figures where parent_id=$F and name='Doble';" | tail -1)
curl -s -b $J "$B/salsa/figures/$F?v=$V" | grep -o 'aria-current="page"[^>]*>[^<]*\|Starts on [0-9][^<]*\|Two turns' | head
curl -s -b $J -o /dev/null -w "variation URL → %{http_code} %{redirect_url}\n" "$B/salsa/figures/$V"
post "$B/salsa/figures/$F?/updateVariation" "versionId=$V&name=Doble&notes=&startCount=5&lengthCounts=4&endId="
curl -s -b $J "$B/salsa/figures/$F?v=$V" | grep -o 'Starts on [0-9][^<]*' | head -1
curl -s -b $J "$B/salsa/figures" | grep -c ">Doble<"
kill $(pgrep -fx "node build"); rm -rf $S
```

Expected:
- `createVariation` answers `{"type":"redirect","status":303,"location":"/salsa/figures/$F?v=$V"}` (an enhanced action reports its redirect as JSON);
- the tab page shows the `Doble` tab as current, "Starts on 1 (as Basic) · 8 counts (as Basic)" (or the figure's own values, marked), and "Two turns";
- the variation URL answers `303` to `/salsa/figures/$F?v=$V`;
- after the update, "Starts on 5 · 4 counts" with no "(as Basic)" marks;
- the figures library count of `>Doble<` is `0`.

Then open the routine editor in a browser if one is available (optional): the add sheet's figure select, then the version select for the figure with a variation; a slot holding it reads "Enchufla · Doble".

- [ ] **Step 2: The spec**

In `docs/superpowers/specs/2026-09-29-figure-variations-design.md`:
- under the status block, change the slice line to: `> **Slices 1 (timing and one edit mode) and 2 (variations) are live.** Slice 3 is not built yet.`
- in **Rules**, the bullet "Variations are not figures, for every list" lists "the positions page's per-figure counts" among the exclusions, which contradicts the next bullet ("The graph includes variations … the gap report … count it"). Delete "and the positions page's per-figure counts" from the first bullet, and add to the second: "The positions page IS the gap report, so its in/out counts include variations — a variation that leaves hammerlock is a real way out."

- [ ] **Step 3: The routines spec and `CLAUDE.md`**

In `docs/superpowers/specs/2026-09-24-routines-design.md`, extend the "Updated 2026-09-29" note with: "A slot's alternative can be a figure's **variation** (a `figures` row with `parent_id`); the options table is unchanged because a variation is a figure id."

In `CLAUDE.md`, **Live** paragraph: after "routines report timing breaks)" add ", figure variations (versions of a figure with their own positions, timing and videos; chosen per routine slot)". In **Hard rules**, after the `eights` rule, add:

```markdown
- **A variation is a `figures` row with `parent_id`.** One level, same dance as
  its figure, never an exercise. Every list of figures excludes it
  (`listFigures`, the drill pool, lesson pickers, the tagged count); the graph
  includes it, filled from its figure by `buildGraph`. Show one with
  `figureLabels` ("Enchufla · Doble"), never its bare name.
```

- [ ] **Step 4: Check and commit**

Run: `nix develop -c npx prettier --write docs CLAUDE.md && nix develop -c npm run check`
Expected: PASS.

```bash
git add docs CLAUDE.md
git commit -m "docs: figure variations are live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand back**

Do not merge, push or deploy. Report the branch (`figure-variations`), the commits, the smoke results and the `npm run check` result.
