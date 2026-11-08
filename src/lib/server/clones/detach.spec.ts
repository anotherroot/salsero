/**
 * Detach (board C8): u2's copy of a class's figure stops following it and
 * becomes its twin; a group's row just becomes an ordinary group figure
 * (one `change` in History). And reconnecting: u2 leaves keeping their copy,
 * rejoins, and the source says the group changed while they were away.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, teamChanges, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { leaveTeam } from '../membership';
import { createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, listMyLessons, publishLesson } from '../lessons';
import { twinsOf } from '../twins';
import type { Space, TeamSpace } from '../scope';
import { NO_FILES, T1_SALSA, U2_SALSA } from '../test-walls';
import { crossRefs } from '../integrity';
import { makeMine } from './edit';
import { stepStatus } from './step';
import { syncView } from './sync';
import { detach, detachOffer } from './detach';
import { geneOf } from './genes';
import { pairBase } from './pairs';
import { sourcesOf, sourcesView } from './sources';
import { mineIdsFor, shadowedIds } from './shadow';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const LATER = NOW + 1000;
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
});

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const history = () => db.select().from(teamChanges).all();

/** T1's Setenta · Básico in a published Week 1, which u2 reads. */
function published(space: TeamSpace = T1_SALSA) {
	const F = figure(space, 'Setenta');
	const L = createLesson(db, space, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
		.lesson.id;
	linkFigure(db, L, F, 'u1');
	expect(publishLesson(db, space, L, T)).toBe(true);
	return F;
}

async function mine(id: number, now = NOW) {
	const res = await makeMine(db, U2_SALSA, 'figure', id, NO_FILES, now, ROOMY);
	if (!res.ok) throw new Error(`make it mine refused: ${res.reason}`);
	return res.id;
}

describe('detach on a person’s own copy', () => {
	it('leaves the family, forgets the pair and keeps the content', async () => {
		const F = published();
		const C = await mine(F);
		updateVariation(db, C, { name: 'Básico', ...shape, notes: 'Hips first' });
		expect(sourcesOf(db, 'u2', 'figure', C)).toHaveLength(2);
		expect(detach(db, 'u2', 'figure', C, LATER)).toBe(true);
		expect(row(C)).toMatchObject({ geneId: null, clonedFrom: null, notes: 'Hips first' });
		expect(pairBase(db, 'figure', C, F)).toBeNull();
		expect(geneOf(db, 'figure', F)).not.toBeNull();
	});

	it('shows the class’s as a twin tab with no status, and offers no Sync', async () => {
		const F = published();
		const C = await mine(F);
		expect(detach(db, 'u2', 'figure', C, LATER)).toBe(true);
		const tabs = sourcesOf(db, 'u2', 'figure', C);
		expect(tabs.map((s) => [s.id, s.relation, s.status])).toEqual([
			[C, 'self', null],
			[F, 'twin', null]
		]);
		expect(twinsOf(db, 'u2', 'figure', C)).toEqual([F]);
		expect(syncView(db, 'u2', 'figure', C)).toBeNull();
		// No notice: nothing was copied from anything any more.
		expect(stepStatus(db, 'u2', 'figure', C)).toEqual({ lines: [] });
		expect(crossRefs(db)).toEqual([]);
	});

	it('is offered only while there is something to leave, and refused otherwise', async () => {
		const F = published();
		const C = await mine(F);
		expect(detachOffer(db, 'u2', 'figure', C)).toEqual({ place: 'Salsa Tuesdays', group: false });
		// The class's row u2 only reads: not theirs to detach.
		expect(detachOffer(db, 'u2', 'figure', F)).toBeNull();
		expect(detach(db, 'u2', 'figure', F, LATER)).toBe(false);
		expect(row(F).geneId).not.toBeNull();
		// Another person's row.
		expect(detach(db, 'u1', 'figure', C, LATER)).toBe(false);
		expect(detach(db, 'u2', 'figure', C, LATER)).toBe(true);
		// Out of its family: a second Detach has nothing to do.
		expect(detachOffer(db, 'u2', 'figure', C)).toBeNull();
		expect(detach(db, 'u2', 'figure', C, LATER)).toBe(false);
	});

	it('writes no History for a person’s own row', async () => {
		const F = published();
		const C = await mine(F);
		const before = history().length;
		detach(db, 'u2', 'figure', C, LATER);
		expect(history()).toHaveLength(before);
	});
});

describe('detach on a group’s row', () => {
	it('logs one change and makes no twin', async () => {
		const F = published();
		await mine(F);
		const before = history().length;
		expect(detach(db, 'u1', 'figure', F, LATER)).toBe(true);
		const added = history().slice(before);
		expect(added).toHaveLength(1);
		expect(added[0]).toMatchObject({
			teamId: 1,
			rootKind: 'figure',
			verb: 'change',
			actorId: 'u1',
			subject: 'variation',
			subjectId: F
		});
		expect(row(F)).toMatchObject({ geneId: null, clonedFrom: null });
		expect(twinsOf(db, 'u1', 'figure', F)).toEqual([]);
	});

	it('stops a copy of a detached group lesson saying whose copy it is (Task 28’s review)', async () => {
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
			.lesson.id;
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		const res = await makeMine(db, U2_SALSA, 'lesson', L, NO_FILES, NOW, ROOMY);
		if (!res.ok) throw new Error('make it mine refused');
		const copyOf = () => listMyLessons(db, U2_SALSA).find((l) => l.id === res.id)?.copyOf;
		expect(copyOf()).toBe('Salsa Tuesdays');
		expect(detach(db, 'u1', 'lesson', L, LATER)).toBe(true);
		expect(copyOf()).toBeNull();
	});
});

describe('reconnecting after rejoining (Review Focus 4)', () => {
	it('says the class changed while you were away, and Keep reuses the copies', async () => {
		const F = published();
		const C = await mine(F);
		expect(sourcesView(db, 'u2', 'figure', C).sources.find((s) => s.id === F)?.rejoined).toBe(
			undefined
		);

		const keep = { mode: 'all' } as const;
		expect(await leaveTeam(db, 1, 'u2', keep, NO_FILES, LATER)).toBe('left');
		const REJOIN = LATER + 1000;
		expect(joinTeam(db, 'u2', 1, REJOIN)).toBe('joined');
		updateVariation(db, F, { name: 'Básico', ...shape, notes: 'New notes' }, 'u1', REJOIN + 1000);

		const view = sourcesView(db, 'u2', 'figure', C);
		const src = view.sources.find((s) => s.id === F)!;
		expect(src).toMatchObject({ rejoined: true, status: 'newer' });
		expect(src.changed).toHaveLength(1);
		// Yours replaces theirs again where both are listed.
		expect([...shadowedIds(db, U2_SALSA, 'figure', [F])]).toEqual([F]);
		expect(mineIdsFor(db, U2_SALSA, 'figure', [F]).get(F)).toBe(C);

		// Leaving again keeps the same copies: one member each.
		expect(await leaveTeam(db, 1, 'u2', keep, NO_FILES, REJOIN + 5000)).toBe('left');
		const mineNow = db.select().from(figures).where(eq(figures.userId, 'u2')).all();
		expect(mineNow.map((r) => r.id)).toEqual([C]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('is not said of a copy made after joining', async () => {
		const F = published();
		const C = await mine(F, NOW);
		updateVariation(db, F, { name: 'Básico', ...shape, notes: 'New notes' }, 'u1', LATER);
		const src = sourcesView(db, 'u2', 'figure', C).sources.find((s) => s.id === F)!;
		expect(src.status).toBe('newer');
		expect(src.rejoined).toBeUndefined();
	});
});
