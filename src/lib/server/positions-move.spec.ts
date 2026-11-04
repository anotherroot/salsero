/**
 * The one-time boot move: today's shared, ownerless positions become the
 * admin's, every other place that uses one gets its own copy (one family per
 * shared position: the same gene, no `cloned_from`), and the old single end
 * column is copied into `figure_end_positions`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	appFlags,
	figureEndPositions,
	figures,
	figureStartPositions,
	positions,
	users
} from './db/schema';
import { createFigure } from './figures';
import { createTeam } from './teams';
import { crossRefs, familyIntegrity, ownerIntegrity } from './integrity';
import { movePositionsToOwners } from './positions-move';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';

const T = 1_800_000_000_000;
const NOW = T + 5_000;

let db: Db;
let names = 0;

const figure = (space: Space) =>
	createFigure(db, space, {
		figureName: `F${++names}`,
		name: 'Basic',
		partner: 'partner',
		style: space.dance,
		notes: null
	})!.figure.id;

/** A shared (ownerless) position, as every position was before the move. */
const shared = (name: string, dance = 'salsa', archivedAt: number | null = null) =>
	db
		.insert(positions)
		.values({ dance, slug: name.toLowerCase(), name, archivedAt, createdAt: T })
		.returning({ id: positions.id })
		.get().id;

const startsOf = (figureId: number) =>
	db
		.select({ id: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all()
		.map((r) => r.id);
const endsOf = (figureId: number) =>
	db
		.select({ id: figureEndPositions.positionId })
		.from(figureEndPositions)
		.where(eq(figureEndPositions.figureId, figureId))
		.all()
		.map((r) => r.id);
const position = (id: number) => db.select().from(positions).where(eq(positions.id, id)).get()!;
const ownedBy = (owner: { userId?: string; teamId?: number }) =>
	db
		.select()
		.from(positions)
		.all()
		.filter((p) =>
			owner.userId ? p.userId === owner.userId : p.teamId === (owner.teamId ?? null)
		);

function addUser(id: string, createdAt: number, isAdmin = false) {
	db.insert(users)
		.values({ id, email: `${id}@x.si`, passwordHash: 'x', createdAt, isAdmin })
		.run();
}

describe('movePositionsToOwners', () => {
	let p1: number, p2: number, p3: number, b1: number;
	let adminFig: number, u2Fig: number, teamFig: number, untagged: number;

	beforeEach(() => {
		db = openDb(':memory:');
		names = 0;
		addUser('u2', T); // earlier than the admin: the admin still wins
		addUser('u1', T + 1, true);
		const made = createTeam(db, 'u1', 'salsa', 'Class', T);
		if (!made.ok || made.teamId !== 1) throw new Error('setup');

		p1 = shared('Cerrada');
		p2 = shared('Abierta');
		p3 = shared('Old', 'salsa', T - 1);
		b1 = shared('Closed', 'bachata');

		adminFig = figure(U1_SALSA);
		db.insert(figureStartPositions).values({ figureId: adminFig, positionId: p1 }).run();
		db.update(figures).set({ endPositionId: p2 }).where(eq(figures.id, adminFig)).run();

		u2Fig = figure(U2_SALSA);
		db.insert(figureStartPositions).values({ figureId: u2Fig, positionId: p1 }).run();

		teamFig = figure(T1_SALSA);
		db.update(figures).set({ endPositionId: p1 }).where(eq(figures.id, teamFig)).run();

		untagged = figure(U2_SALSA);
	});

	it('gives the shared positions to the admin, each with a gene, tags kept', () => {
		const result = movePositionsToOwners(db, NOW);
		expect(result.ran).toBe(true);

		for (const id of [p1, p2, p3, b1]) {
			const p = position(id);
			expect(p.userId).toBe('u1');
			expect(p.teamId).toBeNull();
			expect(p.geneId).toEqual(expect.any(String));
		}
		expect(new Set([p1, p2, p3, b1].map((id) => position(id).geneId)).size).toBe(4);
		expect(position(p3).archivedAt).toBe(T - 1);

		expect(startsOf(adminFig)).toEqual([p1]);
		expect(endsOf(adminFig)).toEqual([p2]);
	});

	it('copies what another person or a group uses, in their place, one family each', () => {
		const result = movePositionsToOwners(db, NOW);

		const u2Own = ownedBy({ userId: 'u2' });
		expect(u2Own).toHaveLength(1);
		const [u2P1] = u2Own;
		expect(u2P1).toMatchObject({
			name: 'Cerrada',
			dance: 'salsa',
			geneId: position(p1).geneId,
			clonedFrom: null,
			styleTag: null,
			archivedAt: null,
			createdAt: NOW,
			teamId: null
		});
		expect(u2P1.slug).toMatch(/^p-[0-9a-f-]{36}$/);
		expect(startsOf(u2Fig)).toEqual([u2P1.id]);

		const teamOwn = ownedBy({ teamId: 1 });
		expect(teamOwn).toHaveLength(1);
		const [tP1] = teamOwn;
		expect(tP1).toMatchObject({ name: 'Cerrada', geneId: position(p1).geneId, userId: null });
		expect(endsOf(teamFig)).toEqual([tP1.id]);
		expect(startsOf(teamFig)).toEqual([]);

		expect(startsOf(untagged)).toEqual([]);
		expect(endsOf(untagged)).toEqual([]);

		expect(result).toEqual({ ran: true, copies: 2, figures: 2, ends: 2 });

		expect(ownerIntegrity(db)).toEqual([]);
		expect(familyIntegrity(db)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('repoints archived figures and end rows too; an archived position is copied archived', () => {
		const old = figure(U2_SALSA);
		db.insert(figureStartPositions).values({ figureId: old, positionId: p3 }).run();
		db.insert(figureEndPositions).values({ figureId: old, positionId: p2, createdAt: T }).run();
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, old)).run();

		movePositionsToOwners(db, NOW);

		const u2Old = ownedBy({ userId: 'u2' }).find((p) => p.name === 'Old')!;
		const u2Abierta = ownedBy({ userId: 'u2' }).find((p) => p.name === 'Abierta')!;
		expect(u2Old).toMatchObject({ archivedAt: T - 1, geneId: position(p3).geneId });
		expect(u2Abierta.geneId).toBe(position(p2).geneId);
		expect(startsOf(old)).toEqual([u2Old.id]);
		expect(endsOf(old)).toEqual([u2Abierta.id]);
		expect(ownedBy({ userId: 'u2' })).toHaveLength(3);
	});

	it('a figure starting and ending in the same shared position gets one copy on both sides', () => {
		const loop = figure(U2_SALSA);
		db.insert(figureStartPositions).values({ figureId: loop, positionId: p2 }).run();
		db.update(figures).set({ endPositionId: p2 }).where(eq(figures.id, loop)).run();

		movePositionsToOwners(db, NOW);

		const abiertas = ownedBy({ userId: 'u2' }).filter((p) => p.name === 'Abierta');
		expect(abiertas).toHaveLength(1);
		expect(startsOf(loop)).toEqual([abiertas[0].id]);
		expect(endsOf(loop)).toEqual([abiertas[0].id]);
		expect(familyIntegrity(db)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('does not duplicate an end already in figure_end_positions', () => {
		db.insert(figureEndPositions).values({ figureId: teamFig, positionId: p1, createdAt: T }).run();
		movePositionsToOwners(db, NOW);
		expect(endsOf(teamFig)).toHaveLength(1);
	});

	it('runs once: a second call returns ran false and changes nothing', () => {
		movePositionsToOwners(db, NOW);
		const before = {
			positions: db.select().from(positions).all(),
			starts: db.select().from(figureStartPositions).all(),
			ends: db.select().from(figureEndPositions).all()
		};
		expect(movePositionsToOwners(db, NOW + 1)).toEqual({
			ran: false,
			copies: 0,
			figures: 0,
			ends: 0
		});
		expect({
			positions: db.select().from(positions).all(),
			starts: db.select().from(figureStartPositions).all(),
			ends: db.select().from(figureEndPositions).all()
		}).toEqual(before);
		expect(db.select().from(appFlags).where(eq(appFlags.key, 'positions-owned')).get()).toEqual({
			key: 'positions-owned',
			doneAt: NOW
		});
	});
});

describe('movePositionsToOwners without an admin', () => {
	beforeEach(() => {
		db = openDb(':memory:');
		names = 0;
	});

	it('with no users at all, does nothing and writes no marker', () => {
		const p = shared('Cerrada');
		expect(movePositionsToOwners(db, NOW)).toEqual({ ran: false, copies: 0, figures: 0, ends: 0 });
		expect(position(p).userId).toBeNull();
		expect(db.select().from(appFlags).all()).toEqual([]);
	});

	it('gives them to the earliest user when nobody is an admin', () => {
		addUser('u2', T + 1);
		addUser('u1', T);
		const p = shared('Cerrada');
		movePositionsToOwners(db, NOW);
		expect(position(p).userId).toBe('u1');
	});
});
