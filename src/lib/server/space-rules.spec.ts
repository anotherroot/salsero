/**
 * A content query filters by `ownedBy(cols, space)`, never by `wall.userId`.
 *
 * Why: a row of a content table (figures, figure groups, lessons, routines,
 * drills) belongs to a person OR a group. `eq(lessons.userId, wall.userId)`
 * reads only the person's half of that rule: it can never find a group's row,
 * and it would show a group row that somehow carried the person's id. The
 * compiler catches most of these (a `Space` has no `userId`), but a function
 * that kept taking a `Wall` would compile and be wrong, so this spec reads the
 * source.
 *
 * Allowed by name: queries that are personal on purpose. Today, its sets and
 * the pickers fed from it list the person's own exercises (`exercises.ts`), and
 * a song's recent use is the person's own practice (`songs.ts`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = 'src/lib/server';

/** `eq(<content table>.userId, wall.userId)` — the filter `ownedBy` replaces. */
const PATTERN =
	/eq\(\s*(figures|figureGroups|lessons|routines|exercises)\.userId\s*,\s*wall\.userId\s*\)/g;

const ALLOWED: Record<string, string[]> = {
	'exercises.ts': ['listExercises', 'listPickExercises', 'listSetTimes', 'listSetsBetween'],
	'songs.ts': ['recentSongIds']
};

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return files(path);
		if (!e.name.endsWith('.ts') || e.name.endsWith('.spec.ts')) return [];
		if (path === join(DIR, 'scope.ts')) return [];
		return [path];
	});
}

/** The name of the last `function` declared before `at`. */
function enclosing(source: string, at: number): string | null {
	const names = [...source.slice(0, at).matchAll(/function\s+(\w+)/g)];
	return names.at(-1)?.[1] ?? null;
}

function offences(path: string, source: string): string[] {
	const name = path.slice(DIR.length + 1);
	return [...source.matchAll(PATTERN)]
		.map((m) => ({ fn: enclosing(source, m.index), text: m[0] }))
		.filter(({ fn }) => !(fn !== null && ALLOWED[name]?.includes(fn)))
		.map(({ fn, text }) => `${name} ${fn ?? '(top level)'}: ${text}`);
}

describe('content queries filter by space', () => {
	it('finds the pattern it is looking for', () => {
		const bad = 'function listX() { return and(eq(lessons.userId, wall.userId)); }';
		expect(offences(`${DIR}/x.ts`, bad)).toEqual(['x.ts listX: eq(lessons.userId, wall.userId)']);
		const ok = 'function listExercises() { return eq(exercises.userId, wall.userId); }';
		expect(offences(`${DIR}/exercises.ts`, ok)).toEqual([]);
	});

	it('no server module filters a content table by wall.userId', () => {
		const found = files(DIR).flatMap((f) => offences(f, readFileSync(f, 'utf8')));
		expect(found).toEqual([]);
	});
});
