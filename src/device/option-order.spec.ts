/**
 * A slot's main figure is the same on the phone as on the server (2026-11-11).
 *
 * Options copied at once used to tie on `created_at`, and the server's rowid
 * picked the main figure. A phone's copy holds the rows in key order instead,
 * so a group's copy whose main figure has the higher id showed its
 * alternative first: the routine page (drawn from the phone) said "your
 * copies differ" while Sync (on the server) found nothing to do.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc, eq, sql } from 'drizzle-orm';

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => undefined };
});

import { openDb, type Db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { figures, routineStepOptions, users } from '$lib/server/db/schema';
import { pull as rawPull } from '$lib/server/sync/pull';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { createTeam } from '$lib/server/teams';
import { createFigure } from '$lib/server/figures';
import { addFigureSlot, addOption, createRoutine, setOptionLength } from '$lib/server/routines';
import { cloneInto } from '$lib/server/clones/clone';
import { flowFrom } from '$lib/server/clones/flow';
import { stepStatus } from '$lib/server/clones/step';
import { syncView } from '$lib/server/clones/sync';
import { flatOf } from '$lib/server/clones/trees';
import type { CloneFiles } from '$lib/server/clones/files';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import { migrateDevice } from './migrate';
import { applyPull } from './apply';
import { repoMigrations } from './test-migrations';

const T0 = Date.UTC(2026, 10, 11, 12);
const files: CloneFiles = {
	async link(_k, f) {
		return `c-${f}`;
	},
	async unlink() {}
};

function world(): Db {
	const db = openDb(':memory:');
	db.insert(users)
		.values([{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' }])
		.run();
	createTeam(db, 'u1', 'salsa', 'Sreda 17:30', T0);
	return db;
}

const figure = (db: Db, name: string) =>
	createFigure(db, U1_SALSA, {
		figureName: name,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;

/** A phone's copy of the server, after a full pull. */
function phone(server: Db): Db {
	const dev = new Database(':memory:');
	migrateDevice(dev, repoMigrations());
	dev.pragma('foreign_keys = ON');
	const out = rawPull(server, 'u1', { cursor: 0, schema: SCHEMA_TAG });
	if ('refused' in out) throw new Error('refused');
	applyPull(dev, out);
	return drizzle(dev, { schema }) as unknown as Db;
}

/**
 * Your routine, its first slot main B with alternative A, copied into the
 * group AFTER A was: the group's A has the lower id, so key order puts it first.
 */
async function copied(db: Db) {
	const a = figure(db, 'Alpha');
	const b = figure(db, 'Beta');
	db.update(figures).set({ lengthFree: 1 }).where(eq(figures.id, b)).run();
	const early = await cloneInto(
		db,
		{ kind: 'figure', id: a, into: T1_SALSA, recordings: false } as never,
		files,
		T0
	);
	if (!early.ok) throw new Error(early.reason);
	const r = createRoutine(db, U1_SALSA, { name: 'Corner step', notes: null } as never).routine.id;
	const slot = addFigureSlot(db, r, b)!;
	expect(addOption(db, slot, a)).toBe(true);
	addFigureSlot(db, r, a);
	const c = await cloneInto(db, { kind: 'routine', id: r, into: T1_SALSA } as never, files, T0);
	if (!c.ok) throw new Error(c.reason);
	return { r, g: c.id, slot, b };
}

describe('a copied slot keeps its main figure on the phone', () => {
	it('the copy matches on the phone as on the server, and Sync agrees', async () => {
		const db = world();
		const { r, g } = await copied(db);
		const dev = phone(db);
		expect(flatOf(dev, 'routine', g).slots?.value).toEqual(flatOf(db, 'routine', g).slots?.value);
		expect(stepStatus(db, 'u1', 'routine', r).lines).toEqual([]);
		expect(stepStatus(dev, 'u1', 'routine', r).lines).toEqual([]);
		expect(syncView(db, 'u1', 'routine', r)!.rows).toEqual([]);
	});

	it('and after a length flows to the copy (it rewrites every option)', async () => {
		const db = world();
		const { r, g, slot, b } = await copied(db);
		expect(setOptionLength(db, slot, b, 8, 'u1')).toBe(true);
		await flowFrom(db, 'u1', 'routine', r, files, T0 + 1000, async () => 1e12);
		const dev = phone(db);
		expect(flatOf(dev, 'routine', g).slots?.value).toEqual(flatOf(db, 'routine', g).slots?.value);
		expect(stepStatus(dev, 'u1', 'routine', r).lines).toEqual([]);
	});

	it('no two options of one slot share an instant', async () => {
		const db = world();
		await copied(db);
		const ties = db
			.select({ n: sql<number>`count(*)` })
			.from(routineStepOptions)
			.groupBy(routineStepOptions.stepId, routineStepOptions.createdAt)
			.having(sql`count(*) > 1`)
			.all();
		expect(ties).toEqual([]);
	});
});

describe('migration 0051', () => {
	const sqlOf = readFileSync('drizzle/0051_option-order.sql', 'utf8').split(
		'--> statement-breakpoint'
	);

	it('spreads a tie a millisecond apart and keeps the order rowid gave it', async () => {
		const db = world();
		const { slot } = await copied(db);
		const order = () =>
			db
				.select({ figureId: routineStepOptions.figureId, at: routineStepOptions.createdAt })
				.from(routineStepOptions)
				.where(eq(routineStepOptions.stepId, slot))
				.orderBy(asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`)
				.all();
		// Undo the fix on one slot: both options at one instant, as production has them.
		db.update(routineStepOptions)
			.set({ createdAt: T0 })
			.where(eq(routineStepOptions.stepId, slot))
			.run();
		const before = order().map((o) => o.figureId);
		for (const part of sqlOf) db.run(sql.raw(part));
		const after = order();
		expect(after.map((o) => o.figureId)).toEqual(before);
		expect(after.map((o) => o.at)).toEqual([T0, T0 + 1]);
	});
});
