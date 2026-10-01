# Figure coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figures stop getting an exercise automatically; a per-dance coverage page shows every figure version by how many routines use it, and a selection on it becomes a new routine.

**Architecture:** `createFigure` loses its exercise insert and `addFigureExercise` makes one on request from the figure page. A pure `src/lib/routines/coverage.ts` turns versions + routine shapes into sorted, grouped rows; `/[dance]/coverage` renders them with long-press selection and posts the selection to `createRoutineFromFigures`, one transaction in `src/lib/server/routines.ts`. The deletion of existing figure exercises is a hand-run, user-gated operation on the server after deploy.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Drizzle over better-sqlite3, Tailwind 4, Vitest. Toolchain from the nix flake: prefix commands with `nix develop -c` (there is no global `node`/`npx`).

**Spec:** [`docs/superpowers/specs/2026-10-01-figure-coverage-design.md`](../specs/2026-10-01-figure-coverage-design.md) — read it before starting. Also read `CLAUDE.md` (hard rules) once.

## Global Constraints

- Data functions take `db` as their first argument; tests use `openDb(':memory:')`. A spec never touches `$DATA_DIR`; route specs mock `$lib/server/db` as `src/routes/[dance]/dance-wall.spec.ts` does.
- Nothing under `$lib/server` is imported by components. Shared row shapes live in `src/lib/types.ts` or the pure module.
- Every page lives under `/[dance]/`; every id from a form body is checked against the URL's dance, and a cross-dance id is a 404 with nothing written.
- No schema change and no migration in this plan. Never add a CHECK.
- `source: 'figure'` and `figure_id` are written as a pair only by `src/lib/server/figures.ts`.
- A variation never has an exercise; a figure never has two.
- Default practice frequency for a new exercise is 3 days (`DEFAULT_EVERY_DAYS`).
- UI copy, verbatim: "Practise on its own"; "In no routine", "In 1 routine", "In 2+ routines"; "Routine coverage →"; "n versions in no routine →" ("1 version in no routine →" for one); bottom bar "n selected", "Cancel", "Create routine".
- `npm run check` (prettier + eslint + svelte-check + build + vitest) must pass at the end of every task: `nix develop -c npm run check`.
- Commit after every task, on the branch `figure-coverage`, with messages ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A figure created before this change still has its exercise** (until Task 7 runs) — the figure page must keep showing Practice + Log for it, and "Practise on its own" must never create a second one. Pinned by Task 1's "refuses a figure that already has one" test.
2. **A routine that embeds another** — a figure inside the child must count for both routines, once each, even when it sits in several slots. Pinned by Task 3's embedding and same-routine-twice tests.
3. **Selecting a variation and its own base figure together** — both become their own slots, in tap order, and the routine page shows them as "Enchufla" and "Enchufla · Doble". Pinned by Task 4's mixed base/variation order test.
4. **A long press must not also open the row** — on release after a long press, the click that follows is swallowed; otherwise selecting navigates away and loses the selection. Checked by hand in Task 6 (no automated UI tests in this repo).
5. **Archiving a routine drops it from every count** — a version used only by an archived routine shows under "In no routine". Pinned by Task 3's archived-routine test (the load passes `listRoutines`, which excludes archived).

---

### Task 1: A figure's exercise is opt-in (data layer)

**Files:**
- Modify: `src/lib/server/figures.ts` (`createFigure`, new `addFigureExercise`)
- Modify (tests): `src/lib/server/data.spec.ts`, `src/lib/server/lessons.spec.ts`, `src/lib/server/practice-content.spec.ts`, `src/lib/server/log-form.spec.ts`, `src/lib/server/link-form.spec.ts`, `src/lib/server/links.spec.ts`, `src/routes/[dance]/dance-wall.spec.ts`
- Modify: `src/routes/[dance]/figures/+page.server.ts`, `src/routes/[dance]/lessons/[id]/+page.server.ts` (stop passing `everyDays`)

**Interfaces:**
- Produces: `createFigure(db: Db, dance: DanceSlug, input: FigureInput): { figure: Figure } | null` — no exercise, no `everyDays` parameter.
- Produces: `addFigureExercise(db: Db, figureId: number, everyDays?: number): typeof exercises.$inferSelect | null` — null for a missing, archived or variation figure, or one that already has an exercise (archived or not).

- [ ] **Step 1: Write the failing tests** in `src/lib/server/data.spec.ts`. Find the existing test near line 56 that destructures `const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;` and asserts `exercise.source` is `'figure'`; replace that whole `it(...)` with these, and add `addFigureExercise` to the import from `./figures`:

```ts
	it('creates a figure without an exercise', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		expect(getFigure(db, figure.id)?.exercise).toBeNull();
		expect(listExercises(db, 'salsa')).toEqual([]);
	});

	it('adds a figure exercise on request, with the figure name and dance', () => {
		const { figure } = createFigure(db, 'bachata', { ...figureInput, style: 'sensual' })!;
		const exercise = addFigureExercise(db, figure.id, 7)!;
		expect(exercise).toMatchObject({
			name: figure.name,
			source: 'figure',
			figureId: figure.id,
			dance: 'bachata',
			everyDays: 7
		});
		expect(getFigure(db, figure.id)?.exercise?.id).toBe(exercise.id);
	});

	it('refuses a figure that already has one, a variation, an archived or missing figure', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		addFigureExercise(db, figure.id);
		expect(addFigureExercise(db, figure.id)).toBeNull();

		const v = createVariation(db, figure.id, { name: 'Doble', notes: null })!;
		expect(addFigureExercise(db, v.id)).toBeNull();

		const gone = createFigure(db, 'salsa', { ...figureInput, name: 'Gone' })!.figure;
		archiveFigure(db, gone.id, 1);
		expect(addFigureExercise(db, gone.id)).toBeNull();

		expect(addFigureExercise(db, 9999)).toBeNull();
		expect(listExercises(db, 'salsa')).toHaveLength(1);
	});

	it('renames and archives the exercise with its figure only when there is one', () => {
		const bare = createFigure(db, 'salsa', { ...figureInput, name: 'Bare' })!.figure;
		expect(updateFigure(db, bare.id, { ...figureInput, name: 'Bare 2' })?.name).toBe('Bare 2');
		expect(archiveFigure(db, bare.id, 1)).toBe(true);

		const owned = createFigure(db, 'salsa', { ...figureInput, name: 'Owned' })!.figure;
		const exercise = addFigureExercise(db, owned.id)!;
		updateFigure(db, owned.id, { ...figureInput, name: 'Owned 2' });
		expect(getExercise(db, exercise.id)?.name).toBe('Owned 2');
		archiveFigure(db, owned.id, 5);
		expect(getExercise(db, exercise.id)?.archivedAt).toBe(5);
	});
```

(If `createVariation`, `getExercise` or `listExercises` are not yet imported in this spec, add them: `createVariation` from `./figures`, the other two from `./exercises`.)

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/data.spec.ts`
Expected: FAIL — `addFigureExercise` is not exported, and "creates a figure without an exercise" finds an exercise.

- [ ] **Step 3: Implement.** In `src/lib/server/figures.ts`, replace `createFigure` (and its doc comment) with:

```ts
/**
 * Create a figure. It gets no exercise: the user practises routines, and a
 * figure is practised on its own only when asked for — `addFigureExercise`.
 *
 * Returns null when the style is not one of the dance's — the pairing has no
 * CHECK to enforce it (see `schema.ts`), so it is enforced here.
 */
export function createFigure(
	db: Db,
	dance: DanceSlug,
	input: FigureInput
): { figure: typeof figures.$inferSelect } | null {
	if (!isStyleOf(dance, input.style)) return null;
	const figure = db
		.insert(figures)
		.values({ ...values(input), dance, lengthCounts: DEFAULT_LENGTH_COUNTS })
		.returning()
		.get();
	return { figure };
}

/**
 * Give a figure its own exercise, so it shows on Today. Null for a missing,
 * archived or variation figure — a variation is practised through its figure —
 * and for a figure that already has one, archived or not: a figure never has
 * two. The only writer of `source: 'figure'` and `figure_id`.
 */
export function addFigureExercise(db: Db, figureId: number, everyDays = 3) {
	return db.transaction((tx) => {
		const figure = tx.select().from(figures).where(eq(figures.id, figureId)).get();
		if (!figure || figure.archivedAt !== null || figure.parentId !== null) return null;
		const existing = tx
			.select({ id: exercises.id })
			.from(exercises)
			.where(eq(exercises.figureId, figureId))
			.get();
		if (existing) return null;
		return tx
			.insert(exercises)
			.values({ name: figure.name, source: 'figure', figureId, dance: figure.dance, everyDays })
			.returning()
			.get();
	});
}
```

Update the comment on `updateFigure` to: `Edit a figure. A rename carries over to its exercise, when it has one, so the two never drift.` and on `archiveFigure` to: `Archive a figure, its variations, and its exercise if it has one. Sets and recordings are kept.`

In `src/routes/[dance]/figures/+page.server.ts` and `src/routes/[dance]/lessons/[id]/+page.server.ts` (`newFigure`), change `createFigure(db, dance, { name, partner, style, notes }, everyDays)` to `createFigure(db, dance, { name, partner, style, notes })` and delete the `everyDays` read and its `!isFrequency(everyDays)` clause from those two actions (the forms stop sending it in Task 2). Remove now-unused imports (`int`, `DEFAULT_EVERY_DAYS`, `isFrequency`) only where nothing else in the file uses them — `lessons/[id]/+page.server.ts` still uses them for `newExercise` and `newRoutine`.

- [ ] **Step 4: Fix every other spec that relied on the automatic exercise.** Run `nix develop -c npx svelte-check --threshold error` and `nix develop -c npx vitest run`; every failure is one of these three shapes. Rewrite each as shown:

```ts
// A. destructured exercise
const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
// becomes
const { figure } = createFigure(db, 'salsa', figureInput)!;
const exercise = addFigureExercise(db, figure.id)!;

// B. chained exercise id
createFigure(db, 'salsa', figureInput)!.exercise.id
// becomes
addFigureExercise(db, createFigure(db, 'salsa', figureInput)!.figure.id)!.id

// C. a kept result read later as `x.exercise`
const made = createFigure(db, 'bachata', bachataInput)!;
... made.exercise.id
// becomes
const made = createFigure(db, 'bachata', bachataInput)!;
const madeExercise = addFigureExercise(db, made.figure.id)!;
... madeExercise.id
```

Known sites: `data.spec.ts` (≈ lines 71, 218, 258–266), `lessons.spec.ts` (≈ 134, 169, 182, 206–207, 320), `practice-content.spec.ts` (59, 70), `log-form.spec.ts` (51), `link-form.spec.ts` (20), `links.spec.ts` (around 69), `src/routes/[dance]/dance-wall.spec.ts` (131 `salsaFigure.exercise.id`, 148 `bachata.exercise.id`). Import `addFigureExercise` from the figures module in each. Any `createFigure(..., everyDays)` call with a 4th argument loses it. Do NOT weaken an assertion to make it pass; if a test asserted that a figure HAS an exercise by default, it now asserts the opposite.

`lessons.spec.ts` near 177 asserts `after.figures[0].exerciseId` equals the figure's exercise: keep it (the exercise now comes from `addFigureExercise`). Add one test next to it:

```ts
	it('lists a linked figure that has no exercise, with a null exerciseId', () => {
		const { lesson } = createLesson(db, 'salsa', { lessonDay: '2026-09-22', title: 'Class', notes: null });
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		linkFigure(db, lesson.id, figure.id);
		expect(getLesson(db, lesson.id)!.figures).toMatchObject([{ id: figure.id, exerciseId: null }]);
	});
```

- [ ] **Step 5: Run the whole check**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git switch -c figure-coverage
git add -A
git commit -m "figures: no exercise on create; addFigureExercise makes one on request

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Opt-in UI — "Practise on its own", no frequency on new figures

**Files:**
- Modify: `src/routes/[dance]/figures/[id]/+page.server.ts` (new `practise` action)
- Modify: `src/routes/[dance]/figures/[id]/+page.svelte` (Practice section)
- Modify: `src/routes/[dance]/figures/+page.svelte` (drop "Practise it" select)
- Modify: `src/routes/[dance]/lessons/[id]/+page.svelte` (drop "How often" in the newFigure sheet only)
- Modify: `src/lib/components/today/NewExerciseSheet.svelte` (copy)
- Modify: `src/routes/[dance]/+page.svelte` (empty Today copy)
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: `addFigureExercise(db, figureId, everyDays?)` from Task 1.
- Produces: figure page action `practise` (no fields); returns `{ action: 'practise', ok: true }` or `fail(400, { action: 'practise', message })`.

- [ ] **Step 1: Write the failing dance-wall tests.** In `src/routes/[dance]/dance-wall.spec.ts`, inside `describe("the detail pages refuse the other dance's rows", …)`, add:

```ts
	it('will not give a bachata figure an exercise from a salsa URL', async () => {
		const bare = createFigure(db, 'bachata', { ...figureInput, name: 'Bare', style: 'sensual' })!;
		await refuses(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id)?.exercise).toBeNull();
	});

	it('gives a figure its exercise from its own dance', async () => {
		const bare = createFigure(db, 'salsa', { ...figureInput, name: 'Bare', style: 'salsa' })!;
		await call(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id)?.exercise?.source).toBe('figure');
	});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run 'src/routes/[dance]/dance-wall.spec.ts'`
Expected: FAIL — `figurePage.actions.practise` is undefined.

- [ ] **Step 3: Add the action.** In `src/routes/[dance]/figures/[id]/+page.server.ts`, import `addFigureExercise` from `$lib/server/figures` and add next to `archive`:

```ts
	/** Give the figure its own exercise, so it shows on Today. */
	practise: ({ params }) => {
		const found = figureOf(params);
		if (!addFigureExercise(getDb(), found.figure.id)) {
			return fail(400, { action: 'practise', message: 'This figure is already practised on its own.' });
		}
		return { action: 'practise', ok: true };
	},
```

- [ ] **Step 4: Add the button.** In `src/routes/[dance]/figures/[id]/+page.svelte`, the block `{#if data.exercise && data.popup} <section …Practice…> {/if}` gets an `{:else if !data.exercise}` branch:

```svelte
		{:else if !data.exercise}
			<form
				method="POST"
				action="?/practise"
				use:enhance
				class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3"
			>
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<p class="text-[12px] text-muted">Practised through its routines.</p>
					{#if failed('practise')}
						<p class="text-[12px] text-danger" role="alert">{failed('practise')}</p>
					{/if}
				</div>
				<button
					type="submit"
					class="h-11 rounded-xl border border-rule px-4 text-[14px] font-semibold text-ink-2"
					>Practise on its own</button
				>
			</form>
```

- [ ] **Step 5: Drop the frequency pickers from figure creation.** In `src/routes/[dance]/figures/+page.svelte`, delete the `<label class="block">…Practise it…<select name="everyDays">…</select></label>` right after `<FigureFields …/>`, and the now-unused `DEFAULT_EVERY_DAYS, FREQUENCIES` import. In `src/routes/[dance]/lessons/[id]/+page.svelte`, delete only the `<label class="block"><span class={label}>How often</span>…</label>` inside the `action="?/newFigure"` form (the other two `everyDays` selects, for new exercise and new routine, stay).

- [ ] **Step 6: Copy.** In `src/lib/components/today/NewExerciseSheet.svelte`, replace `Figures get an exercise automatically — add those from the Figures tab.` with `To practise a figure on its own, open it and tap Practise on its own.` In `src/routes/[dance]/+page.svelte` (empty Today), replace `Add a figure you learned, or a custom exercise below.` with `Build a routine from your figures, or add a custom exercise below.`, and the button's `href={resolve(`/${data.dance.slug}/figures?new=1`)}` / text `Add a figure` with `href={resolve('/[dance]/routines', { dance: data.dance.slug })}` / `Build a routine`.

- [ ] **Step 7: Check and verify by hand**

Run: `nix develop -c npm run check` → PASS.
Then `nix develop -c npm run dev`, log in, create a figure: no "Practise it" select; the new figure page shows "Practised through its routines." and "Practise on its own"; tapping it shows the usual Practice row with "every 3 days · Exercise →" and Log…; Today now lists the figure.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "figure page: Practise on its own; new figures ask no frequency

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pure coverage

**Files:**
- Create: `src/lib/routines/coverage.ts`
- Test: `src/lib/routines/coverage.spec.ts`

**Interfaces:**
- Consumes: `RoutineShape`, `Slot` from `src/lib/routines/routines.ts` (`{ kind: 'options', figureIds: number[] } | { kind: 'child', routineId, slots: OptionsSlot[] }`).
- Produces:

```ts
export interface CoverageRow {
	id: number;
	label: string;
	routines: { id: number; name: string }[]; // alphabetical by name
}
export interface CoverageGroup {
	key: 'none' | 'one' | 'many';
	title: string; // 'In no routine' | 'In 1 routine' | 'In 2+ routines'
	rows: CoverageRow[];
}
export function coverage(
	versions: { id: number; label: string }[],
	shapes: Map<number, RoutineShape>,
	routines: { id: number; name: string }[]
): CoverageRow[]; // fewest routines first, then label
export function coverageGroups(rows: CoverageRow[]): CoverageGroup[]; // empty groups omitted
```

- [ ] **Step 1: Write the failing tests** in `src/lib/routines/coverage.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { coverage, coverageGroups } from './coverage';
import type { RoutineShape } from './routines';

const opts = (...ids: number[][]): RoutineShape => ({
	slots: ids.map((figureIds) => ({ kind: 'options', figureIds }))
});

const versions = [
	{ id: 1, label: 'Enchufla' },
	{ id: 2, label: 'Enchufla · Doble' },
	{ id: 3, label: 'Dile que no' },
	{ id: 4, label: 'Setenta' }
];

describe('coverage', () => {
	it('counts a base figure and its variation apart', () => {
		const shapes = new Map([[10, opts([1])]]);
		const rows = coverage(versions, shapes, [{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 1)?.routines).toEqual([{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 2)?.routines).toEqual([]);
	});

	it('counts every option of a slot', () => {
		const rows = coverage(versions, new Map([[10, opts([1, 2])]]), [{ id: 10, name: 'A' }]);
		expect(rows.filter((r) => r.routines.length === 1).map((r) => r.id)).toEqual([1, 2]);
	});

	it('lists a routine once even when the version fills several of its slots', () => {
		const rows = coverage(versions, new Map([[10, opts([3], [3], [3])]]), [{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 3)?.routines).toEqual([{ id: 10, name: 'A' }]);
	});

	it('counts a figure inside an embedded routine for both routines', () => {
		const childSlots = [{ kind: 'options' as const, figureIds: [4] }];
		const child: RoutineShape = { slots: childSlots };
		const parent: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [3] },
				{ kind: 'child', routineId: 11, slots: childSlots }
			]
		};
		const rows = coverage(
			versions,
			new Map([
				[10, parent],
				[11, child]
			]),
			[
				{ id: 10, name: 'Friday' },
				{ id: 11, name: 'Combo A' }
			]
		);
		expect(rows.find((r) => r.id === 4)?.routines).toEqual([
			{ id: 11, name: 'Combo A' },
			{ id: 10, name: 'Friday' }
		]);
	});

	it('ignores a shape whose routine is not in the list (archived)', () => {
		const rows = coverage(versions, new Map([[10, opts([1])]]), []);
		expect(rows.every((r) => r.routines.length === 0)).toBe(true);
	});

	it('sorts fewest routines first, then by label', () => {
		const shapes = new Map([
			[10, opts([1], [4])],
			[11, opts([4])]
		]);
		const rows = coverage(versions, shapes, [
			{ id: 10, name: 'A' },
			{ id: 11, name: 'B' }
		]);
		expect(rows.map((r) => r.label)).toEqual([
			'Dile que no',
			'Enchufla · Doble',
			'Enchufla',
			'Setenta'
		]);
	});
});

describe('coverageGroups', () => {
	it('groups none, one, many and leaves empty groups out', () => {
		const row = (id: number, n: number) => ({
			id,
			label: String(id),
			routines: Array.from({ length: n }, (_, i) => ({ id: i, name: String(i) }))
		});
		const groups = coverageGroups([row(1, 0), row(2, 2), row(3, 5)]);
		expect(groups.map((g) => [g.key, g.title, g.rows.map((r) => r.id)])).toEqual([
			['none', 'In no routine', [1]],
			['many', 'In 2+ routines', [2, 3]]
		]);
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/routines/coverage.spec.ts`
Expected: FAIL — cannot find module `./coverage`.

- [ ] **Step 3: Implement** `src/lib/routines/coverage.ts`:

```ts
/**
 * Which routines can call each figure version — the coverage page.
 *
 * PURE and client-safe. A version is covered by a routine when it is an option
 * in any of that routine's slots, its embedded routine's slots included, so a
 * figure in an embedded "Combo A" counts for Combo A and for every routine
 * that embeds it. Base figure and variation are counted apart: each is the
 * exact id in a slot.
 *
 * Only the routines passed in count. The caller passes the live ones
 * (`listRoutines` excludes archived), so `shapes` may safely hold more.
 */
import type { RoutineShape } from './routines';

export interface CoverageRow {
	id: number;
	label: string;
	/** Alphabetical by name. */
	routines: { id: number; name: string }[];
}

export interface CoverageGroup {
	key: 'none' | 'one' | 'many';
	title: string;
	rows: CoverageRow[];
}

function idsIn(shape: RoutineShape): Set<number> {
	const ids = new Set<number>();
	for (const slot of shape.slots) {
		const options = slot.kind === 'options' ? [slot] : slot.slots;
		for (const o of options) for (const id of o.figureIds) ids.add(id);
	}
	return ids;
}

export function coverage(
	versions: { id: number; label: string }[],
	shapes: Map<number, RoutineShape>,
	routines: { id: number; name: string }[]
): CoverageRow[] {
	const byVersion = new Map<number, { id: number; name: string }[]>();
	for (const r of [...routines].sort((a, b) => a.name.localeCompare(b.name))) {
		const shape = shapes.get(r.id);
		if (!shape) continue;
		for (const id of idsIn(shape)) {
			const list = byVersion.get(id) ?? [];
			list.push({ id: r.id, name: r.name });
			byVersion.set(id, list);
		}
	}
	return versions
		.map((v) => ({ id: v.id, label: v.label, routines: byVersion.get(v.id) ?? [] }))
		.sort((a, b) => a.routines.length - b.routines.length || a.label.localeCompare(b.label));
}

export function coverageGroups(rows: CoverageRow[]): CoverageGroup[] {
	const groups: CoverageGroup[] = [
		{ key: 'none', title: 'In no routine', rows: rows.filter((r) => r.routines.length === 0) },
		{ key: 'one', title: 'In 1 routine', rows: rows.filter((r) => r.routines.length === 1) },
		{ key: 'many', title: 'In 2+ routines', rows: rows.filter((r) => r.routines.length >= 2) }
	];
	return groups.filter((g) => g.rows.length > 0);
}
```

(This runs on the server only — the page's `load` — so `localeCompare` cannot disagree between SSR and hydration.)

- [ ] **Step 4: Run the tests**

Run: `nix develop -c npx vitest run src/lib/routines/coverage.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routines/coverage.ts src/lib/routines/coverage.spec.ts
git commit -m "routines: pure coverage — which routines can call each figure version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `createRoutineFromFigures`

**Files:**
- Modify: `src/lib/server/routines.ts`
- Test: `src/lib/server/routines.spec.ts`

**Interfaces:**
- Consumes: the private `landingIn(g, figureId)` and `Tx` in `routines.ts`; `buildGraph(db, dance)`.
- Produces: `createRoutineFromFigures(db: Db, dance: DanceSlug, input: RoutineInput, figureIds: number[], everyDays?: number): { routine, exercise } | null` — null for an empty list or any id not an unarchived figure/variation of `dance`; nothing written then.

- [ ] **Step 1: Write the failing tests** in `src/lib/server/routines.spec.ts` (import `createRoutineFromFigures`, and `createVariation` from `./figures`):

```ts
describe('createRoutineFromFigures', () => {
	it('makes the routine, its exercise, and one slot per id in the given order', () => {
		const db = openDb(':memory:');
		const a = figure(db, 'Enchufla');
		const v = createVariation(db, a.id, { name: 'Doble', notes: null })!;
		const b = figure(db, 'Setenta');
		const made = createRoutineFromFigures(db, 'salsa', { name: 'New', notes: null }, [b.id, v.id, a.id])!;
		expect(made.exercise).toMatchObject({ source: 'routine', routineId: made.routine.id, dance: 'salsa' });
		expect(routineSlots(db, made.routine.id).map((s) => s.figureIds)).toEqual([
			[b.id],
			[v.id],
			[a.id]
		]);
	});

	it('writes nothing when any id is of the other dance, archived, or missing', () => {
		const db = openDb(':memory:');
		const a = figure(db, 'Enchufla');
		const other = figure(db, 'Basico', 'bachata');
		const gone = figure(db, 'Gone');
		archiveFigure(db, gone.id, 1);
		for (const bad of [other.id, gone.id, 9999]) {
			expect(createRoutineFromFigures(db, 'salsa', { name: 'X', notes: null }, [a.id, bad])).toBeNull();
		}
		expect(createRoutineFromFigures(db, 'salsa', { name: 'X', notes: null }, [])).toBeNull();
		expect(listRoutines(db, 'salsa')).toEqual([]);
		expect(db.select().from(exercises).all()).toEqual([]);
	});
});
```

`routineSlots` returns `SlotRow[]` (`src/lib/types.ts`), whose `figureIds` is the slot's options.

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: FAIL — `createRoutineFromFigures` is not exported.

- [ ] **Step 3: Implement.** In `src/lib/server/routines.ts`, pull `createRoutine`'s body into a helper both use, and add the new function after `addFigureSlot`:

```ts
/** The routine row and its exercise, inside a caller's transaction. */
function insertRoutine(tx: Tx, dance: DanceSlug, input: RoutineInput, everyDays: number) {
	const routine = tx
		.insert(routines)
		.values({ ...input, dance })
		.returning()
		.get();
	const exercise = tx
		.insert(exercises)
		.values({ name: routine.name, source: 'routine', routineId: routine.id, dance, everyDays })
		.returning()
		.get();
	return { routine, exercise };
}

export function createRoutine(db: Db, dance: DanceSlug, input: RoutineInput, everyDays = 3) {
	return db.transaction((tx) => insertRoutine(tx, dance, input, everyDays));
}
```

(keep `createRoutine`'s existing doc comment above it), and:

```ts
/**
 * A new routine with one slot per figure or variation, in the given order —
 * the coverage page's "Create routine". The user puts the slots in order on
 * the routine page afterwards.
 *
 * All or nothing: null, with nothing written, for an empty list or any id
 * that is not an unarchived figure or variation of this dance.
 */
export function createRoutineFromFigures(
	db: Db,
	dance: DanceSlug,
	input: RoutineInput,
	figureIds: number[],
	everyDays = 3
) {
	if (figureIds.length === 0) return null;
	const graph = buildGraph(db, dance);
	if (figureIds.some((id) => landingIn(graph, id) === null)) return null;
	return db.transaction((tx) => {
		const made = insertRoutine(tx, dance, input, everyDays);
		figureIds.forEach((figureId, position) => {
			const step = tx
				.insert(routineSteps)
				.values({ routineId: made.routine.id, position })
				.returning({ id: routineSteps.id })
				.get();
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
		});
		return made;
	});
}
```

- [ ] **Step 4: Run the tests**

Run: `nix develop -c npx vitest run src/lib/server/routines.spec.ts`
Expected: PASS, including the existing `createRoutine` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/routines.ts src/lib/server/routines.spec.ts
git commit -m "routines: createRoutineFromFigures — one slot per picked version, all or nothing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The coverage route (load + create action) and the Figures link

**Files:**
- Create: `src/routes/[dance]/coverage/+page.server.ts`
- Modify: `src/routes/[dance]/figures/+page.server.ts` (`unrouted` count), `src/routes/[dance]/figures/+page.svelte` (link)
- Test: `src/routes/[dance]/dance-wall.spec.ts`

**Interfaces:**
- Consumes: `coverage`, `coverageGroups`, `CoverageGroup` (Task 3); `createRoutineFromFigures` (Task 4); `listVersions` (`src/lib/server/figures.ts`, returns `{ id, parentId, name, label }[]`); `routineShapes`, `listRoutines` (`src/lib/server/routines.ts`); `text`, `ints` (`src/lib/server/form.ts`).
- Produces: `load` → `{ groups: CoverageGroup[] }`; action `create` with fields `name` and repeated `figureIds` (tap order); redirect 303 to `/${dance}/routines/${id}`; `fail(400, { message, name })` for a missing name or no ids; `error(404)` for any foreign/archived/missing id.
- Produces: figures page `data.unrouted: number`.

- [ ] **Step 1: Write the failing tests** in `src/routes/[dance]/dance-wall.spec.ts`. Add `import * as coveragePage from './coverage/+page.server';` with the other page imports, and:

```ts
describe('the coverage page stays inside its dance', () => {
	it('lists only its own dance versions', () => {
		const data = loadAt(coveragePage.load, 'salsa', '') as {
			groups: { rows: { id: number }[] }[];
		};
		const ids = data.groups.flatMap((g) => g.rows.map((r) => r.id));
		expect(ids).toContain(salsaFigureId);
		expect(ids).not.toContain(bachataFigureId);
	});

	it('will not build a salsa routine from a bachata figure', async () => {
		const event = post('salsa', { name: 'Mixed' });
		const body = new URLSearchParams({ name: 'Mixed' });
		body.append('figureIds', String(salsaFigureId));
		body.append('figureIds', String(bachataFigureId));
		await refuses(coveragePage.actions.create, {
			...event,
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body
			})
		});
		expect(db.select().from(exercises).all().filter((e) => e.source === 'routine')).toHaveLength(3);
	});

	it('builds the routine in tap order and redirects to it', async () => {
		const body = new URLSearchParams({ name: 'Picked' });
		body.append('figureIds', String(salsaFigureId2));
		body.append('figureIds', String(salsaFigureId));
		try {
			await call(coveragePage.actions.create, {
				...post('salsa', {}),
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body
				})
			});
			expect.unreachable('a created routine redirects');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 303 });
		}
	});
});
```

(`3` = the two salsa routines and the bachata routine `beforeEach` creates.)

- [ ] **Step 2: Run them to see them fail**

Run: `nix develop -c npx vitest run 'src/routes/[dance]/dance-wall.spec.ts'`
Expected: FAIL — cannot resolve `./coverage/+page.server`.

- [ ] **Step 3: Implement** `src/routes/[dance]/coverage/+page.server.ts`:

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listVersions } from '$lib/server/figures';
import { createRoutineFromFigures, listRoutines, routineShapes } from '$lib/server/routines';
import { ints, text } from '$lib/server/form';
import { coverage, coverageGroups } from '$lib/routines/coverage';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	// Derived per request, never stored: a slot edited on a routine page
	// changes these answers with nothing else touched.
	return {
		groups: coverageGroups(
			coverage(listVersions(db, dance), routineShapes(db, dance), listRoutines(db, dance))
		)
	};
};

export const actions: Actions = {
	/** A new routine from the picked versions, in the order they were picked. */
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		// `ints` keeps first-seen order and drops duplicates.
		const figureIds = ints(form, 'figureIds');
		if (!name) {
			return fail(400, {
				message: 'Give the routine a name (up to 200 characters).',
				name: String(form.get('name') ?? '')
			});
		}
		if (figureIds.length === 0) {
			return fail(400, { message: 'Pick at least one figure.', name });
		}
		const made = createRoutineFromFigures(getDb(), dance, { name, notes: null }, figureIds);
		// Every id from the page is a live version of this dance; anything else
		// is a tampered body or a stale page, answered like every other
		// cross-dance id.
		if (!made) throw error(404, 'Figure not found');
		throw redirect(303, `/${dance}/routines/${made.routine.id}`);
	}
};
```

- [ ] **Step 4: Figures header link.** In `src/routes/[dance]/figures/+page.server.ts`, import `listVersions` (figures), `listRoutines, routineShapes` (routines) and `coverage` (`$lib/routines/coverage`), and add to the returned object:

```ts
		// Versions no routine can call: the Figures header's way into coverage.
		unrouted: coverage(listVersions(db, dance), routineShapes(db, dance), listRoutines(db, dance))
			.filter((r) => r.routines.length === 0).length
```

In `src/routes/[dance]/figures/+page.svelte`, wrap the existing "Tagged … positions" link and a new link in one row:

```svelte
	<div class="flex flex-wrap gap-x-4">
		<a
			class="text-[12px] text-muted underline"
			href={resolve('/[dance]/positions', { dance: data.dance.slug })}
			>Tagged {data.tagged.done} / {data.tagged.total} positions</a
		>
		<a
			class="text-[12px] text-muted underline"
			href={resolve('/[dance]/coverage', { dance: data.dance.slug })}
			>{data.unrouted === 0
				? 'Routine coverage →'
				: `${data.unrouted} ${data.unrouted === 1 ? 'version' : 'versions'} in no routine →`}</a
		>
	</div>
```

- [ ] **Step 5: Run the tests and the check**

Run: `nix develop -c npm run check`
Expected: PASS. (svelte-check may complain that `/[dance]/coverage` has no `+page.svelte` yet; if so, create a placeholder `src/routes/[dance]/coverage/+page.svelte` containing only `<script lang="ts">let { data } = $props();</script><pre>{JSON.stringify(data.groups.length)}</pre>` — Task 6 replaces it entirely.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "coverage: the route's load and create action; Figures links to it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The coverage page UI — groups, long-press selection, Create routine

**Files:**
- Create/replace: `src/routes/[dance]/coverage/+page.svelte`

**Interfaces:**
- Consumes: `data.groups: CoverageGroup[]`, `data.dance` (from the `[dance]` layout: `slug`, `label`), `form?.message`, `form?.name` from Task 5; `Sheet` (`$lib/components/ui/Sheet.svelte`, props `title`, `open`, `onclose`).

- [ ] **Step 1: Write the page.** Full content of `src/routes/[dance]/coverage/+page.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Picked version ids, in tap order — the new routine's slot order. */
	let picked = $state<number[]>([]);
	let selecting = $state(false);
	let naming = $state(false);
	let busy = $state(false);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) naming = true;
	});

	const LONG_PRESS_MS = 500;
	const MOVE_TOLERANCE_PX = 10;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let origin: { x: number; y: number } | null = null;
	/** Set when a long press fired, so the click that follows the release is swallowed. */
	let swallowClick = false;

	function toggle(id: number) {
		picked = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
		if (picked.length === 0) selecting = false;
	}

	function cancelPress() {
		if (timer) clearTimeout(timer);
		timer = null;
		origin = null;
	}

	function pressStart(e: PointerEvent, id: number) {
		if (selecting) return;
		origin = { x: e.clientX, y: e.clientY };
		timer = setTimeout(() => {
			timer = null;
			swallowClick = true;
			selecting = true;
			picked = [id];
		}, LONG_PRESS_MS);
	}

	function pressMove(e: PointerEvent) {
		if (!origin) return;
		if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE_PX) cancelPress();
	}

	function rowClick(e: MouseEvent, id: number) {
		if (swallowClick) {
			swallowClick = false;
			e.preventDefault();
			return;
		}
		if (selecting) {
			e.preventDefault();
			toggle(id);
		}
	}

	function stopSelecting() {
		selecting = false;
		picked = [];
	}

	const href = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(id) });

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>Coverage · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/figures', { dance: data.dance.slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to Figures">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">Routine coverage</h1>
	{#if !selecting}
		<button
			type="button"
			class="h-10 rounded-xl px-3 text-[14px] text-accent"
			onclick={() => (selecting = true)}>Select</button
		>
	{/if}
</header>

<main class="space-y-5 px-4 pt-4 {selecting ? 'pb-20' : 'pb-4'}">
	{#if data.groups.length === 0}
		<p class="mt-10 text-center text-[14px] text-muted">No figures yet.</p>
	{/if}
	{#each data.groups as group (group.key)}
		<section aria-labelledby="g-{group.key}">
			<h2 id="g-{group.key}" class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
				{group.title} ({group.rows.length})
			</h2>
			<ul class="space-y-2">
				{#each group.rows as row (row.id)}
					{@const on = picked.includes(row.id)}
					<li>
						<a
							href={href(row.id)}
							aria-pressed={selecting ? on : undefined}
							class="flex items-center gap-3 rounded-xl border bg-raised px-4 py-3 select-none [-webkit-touch-callout:none] {on
								? 'border-accent'
								: 'border-line'}"
							onpointerdown={(e) => pressStart(e, row.id)}
							onpointermove={pressMove}
							onpointerup={cancelPress}
							onpointercancel={cancelPress}
							oncontextmenu={(e) => e.preventDefault()}
							onclick={(e) => rowClick(e, row.id)}
						>
							{#if selecting}
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full border text-[13px] {on
										? 'border-accent bg-accent text-accent-ink'
										: 'border-rule'}"
									aria-hidden="true">{on ? picked.indexOf(row.id) + 1 : ''}</span
								>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[15px] font-medium">{row.label}</span>
								{#if row.routines.length > 0}
									<span class="block truncate text-[12px] text-muted">
										{row.routines.map((r) => r.name).join(', ')}
									</span>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

{#if selecting}
	<div
		class="fixed inset-x-0 z-30 mx-auto flex max-w-[560px] items-center gap-3 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur"
		style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
	>
		<span class="flex-1 text-[14px] text-ink-2">{picked.length} selected</span>
		<button type="button" class="h-10 px-3 text-[14px] text-ink-2" onclick={stopSelecting}
			>Cancel</button
		>
		<button
			type="button"
			disabled={picked.length === 0}
			class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink disabled:opacity-50"
			onclick={() => (naming = true)}>Create routine</button
		>
	</div>
{/if}

<Sheet title="New routine" open={naming} onclose={() => (naming = false)}>
	<form
		method="POST"
		action="?/create"
		class="space-y-3"
		use:enhance={() => {
			busy = true;
			// `update` follows the redirect to the new routine page.
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		{#if form?.message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{form.message}
			</p>
		{/if}
		{#each picked as id (id)}
			<input type="hidden" name="figureIds" value={id} />
		{/each}
		<label class="block">
			<span class="mb-1 block text-[12px] font-medium text-ink-2">Name</span>
			<input
				name="name"
				required
				maxlength="200"
				value={form?.name ?? ''}
				placeholder="Basic combo"
				class={field}
			/>
		</label>
		<p class="text-[12px] text-muted">
			{picked.length}
			{picked.length === 1 ? 'figure' : 'figures'}, in the order you picked them. Put them in order on
			the routine page.
		</p>
		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
			>Create routine</button
		>
	</form>
</Sheet>
```

- [ ] **Step 2: Check**

Run: `nix develop -c npm run check`
Expected: PASS.

- [ ] **Step 3: Verify by hand** (`nix develop -c npm run dev`; in the dev DB create two figures, one variation, and one routine using one figure):
  - Figures header shows "n versions in no routine →"; the page lists "In no routine" first, the used figure under "In 1 routine" with the routine's name beneath.
  - Desktop: **Select** → click two rows → numbers 1, 2 appear → **Create routine** → name → lands on the routine page with the slots in click order.
  - Phone-width (devtools touch emulation, or a phone on the LAN): long-press a row → it is selected and the page does NOT navigate; tap another → selected; tap a selected one → deselected; deselect all → mode ends.
  - A plain tap outside selection mode opens the figure page (a variation lands on its tab).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "coverage page: versions by routine count, long-press selection, Create routine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `docs/superpowers/specs/2026-10-01-figure-coverage-design.md`

- [ ] **Step 1: CLAUDE.md.**
  - In "**Live:**", append after the figure-variations clause: ` and figure coverage (figures have no exercise by default; a page of figure versions by how many routines use them, and a routine made from a selection)`.
  - Under the Layout block's `src/lib/routines/` line, extend to: `PURE routine algebra: slots, variants, breaks, whether it loops, the routine as the player's plan, and coverage (which routines can call each version). Client-safe`.
  - Replace the hard rule's sentence `A figure's exercise is created, renamed and archived WITH its figure, in one transaction (\`src/lib/server/figures.ts\`).` with `A figure's exercise is opt-in (\`addFigureExercise\`); when one exists it is renamed and archived WITH its figure, in one transaction (\`src/lib/server/figures.ts\`).`
  - In "Commands"-adjacent docs nothing changes.
- [ ] **Step 2: Main design spec.** In `2026-09-22-salsa-app-design.md`, the glossary row for **Exercise** ("Created automatically for every figure and every routine…") becomes "Created automatically for every routine; for a figure only on request ("Practise on its own"); or by hand (custom: …)". Add one line at the end of the Figures section: "**Coverage:** `/[dance]/coverage` — see [`2026-10-01-figure-coverage-design.md`](2026-10-01-figure-coverage-design.md)."
- [ ] **Step 3: This feature's spec.** Change its Status line to `> **Status:** live (2026-10-01), except §4, which is run by hand on the server — see the plan's Task 8.`
- [ ] **Step 4: Check and commit**

```bash
nix develop -c npm run check
git add -A
git commit -m "docs: figure coverage is live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Merge, deploy, and delete the old figure exercises (USER-GATED)

Only the controller (the main session), never a subagent. Every step that writes needs the user's explicit go-ahead in chat at that moment.

- [ ] **Step 1: Merge and deploy (ask first).** On approval:

```bash
git switch master
git merge --no-ff figure-coverage -m "Merge: figure coverage — figures have no exercise by default; a coverage page; routines from a selection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
nix develop -c ./scripts/deploy.sh
```

Expected: ends with `ok  deployed. https://salsa.anotherroot.eu`.

- [ ] **Step 2: Back up** (read `config/deploy/prod.config` for the SSH target; the host in `docs/deployment.md` is `tilen@49.13.76.224`):

```bash
ssh tilen@49.13.76.224 'sudo systemctl start salsa-backup && sudo sqlite3 /var/lib/salsa/salsa.db ".backup /var/lib/salsa/backups/pre-figure-exercise-delete.db" && sudo ls -l /var/lib/salsa/backups/'
```

Expected: `pre-figure-exercise-delete.db` listed with a size close to today's nightly file. If `sqlite3` is not on the box's PATH, run it as `nix-shell -p sqlite --run '…'` or ask the user.

- [ ] **Step 3: Preview, read-only, and show the user the output verbatim:**

```bash
ssh tilen@49.13.76.224 "sudo sqlite3 -header -column /var/lib/salsa/salsa.db \"
SELECT e.id, e.dance, e.name, e.archived_at IS NOT NULL AS archived,
       (SELECT count(*) FROM sets s WHERE s.exercise_id = e.id) AS sets
  FROM exercises e WHERE e.source = 'figure' ORDER BY e.dance, e.name;
SELECT (SELECT count(*) FROM sets WHERE exercise_id IN (SELECT id FROM exercises WHERE source='figure')) AS sets_to_delete,
       (SELECT count(*) FROM lesson_exercises WHERE exercise_id IN (SELECT id FROM exercises WHERE source='figure')) AS lesson_links_to_delete,
       (SELECT count(*) FROM links WHERE exercise_id IN (SELECT id FROM exercises WHERE source='figure')) AS links_to_delete;
SELECT e.source, count(DISTINCT e.id) AS exercises, count(s.id) AS sets
  FROM exercises e LEFT JOIN sets s ON s.exercise_id = e.id GROUP BY e.source;
\""
```

- [ ] **Step 4: STOP. Ask the user to confirm the deletion with those numbers in front of them.** Do nothing further without a clear yes.

- [ ] **Step 5: Delete, in one transaction:**

```bash
ssh tilen@49.13.76.224 "sudo sqlite3 /var/lib/salsa/salsa.db \"
PRAGMA foreign_keys = ON;
BEGIN;
DELETE FROM lesson_exercises WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
DELETE FROM links            WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
DELETE FROM sets             WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'figure');
DELETE FROM exercises        WHERE source = 'figure';
COMMIT;
\""
```

- [ ] **Step 6: Verify.** Re-run the last query of Step 3: the `custom`, `lesson` and `routine` rows must equal the baseline exactly, and there is no `figure` row. Then `ssh tilen@49.13.76.224 'sudo sqlite3 /var/lib/salsa/salsa.db "PRAGMA foreign_key_check;"'` must print nothing. Ask the user to open Today and one lesson page on the live site. Report the before/after numbers.
