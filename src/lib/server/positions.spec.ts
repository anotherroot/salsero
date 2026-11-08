import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { eq } from 'drizzle-orm';
import { positions, spotPositionLinks, users } from './db/schema';
import type { PositionRow } from './db/schema';
import {
	addTemplates,
	archivePosition,
	createPosition,
	getPosition,
	listPositions,
	nameTaken,
	positionSummary,
	restorePosition,
	updatePosition
} from './positions';
import { positionSeen } from './clash';
import { createTeam } from './teams';
import { addLessonVideo, createLesson } from './lessons';
import { addSpot } from './spots';
import { T1_SALSA, U1_BACHATA, U1_SALSA, U2_SALSA } from './test-walls';
import { TEMPLATES } from '$lib/positions/templates';
import type { PositionInput } from '$lib/types';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'a@x.si', passwordHash: 'x', firstName: 'Ana', lastName: 'K' },
			{ id: 'u2', email: 'b@x.si', passwordHash: 'x', firstName: 'Luka', lastName: 'N' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
});

const input = (name: string, extra: Partial<PositionInput> = {}): PositionInput => ({
	name,
	styleTag: null,
	hold: { hands: null, crossed: null, facing: null, frame: null },
	notes: null,
	pictureSpotId: null,
	...extra
});
const made = (r: ReturnType<typeof createPosition>) => r as PositionRow;

describe('createPosition', () => {
	it('owns the row by the person, in the dance, with no team', () => {
		const row = made(createPosition(db, U1_SALSA, input('Cerrada'), 5));
		expect(row).toMatchObject({
			dance: 'salsa',
			userId: 'u1',
			teamId: null,
			name: 'Cerrada',
			createdAt: 5
		});
		expect(row.slug).toMatch(/^p-/);
	});

	it('owns the row by the group, with no person', () => {
		const row = made(createPosition(db, T1_SALSA, input('Cerrada'), 5));
		expect(row).toMatchObject({ userId: null, teamId: 1 });
	});

	it('keeps each space to its own list', () => {
		createPosition(db, U1_SALSA, input('A'), 1);
		createPosition(db, U2_SALSA, input('B'), 1);
		createPosition(db, U1_BACHATA, input('C'), 1);
		createPosition(db, T1_SALSA, input('D'), 1);
		expect(listPositions(db, U1_SALSA).map((p) => p.name)).toEqual(['A']);
		expect(listPositions(db, T1_SALSA).map((p) => p.name)).toEqual(['D']);
	});

	it('refuses a name that differs only in case or accents, and not an archived one', () => {
		const a = made(createPosition(db, U1_SALSA, input('Caída'), 1));
		expect(createPosition(db, U1_SALSA, input('CAIDA'), 2)).toEqual({
			field: 'name',
			message: 'You already have a position called CAIDA.'
		});
		expect(createPosition(db, U2_SALSA, input('caida'), 2)).toHaveProperty('id');
		archivePosition(db, a.id, 3);
		expect(createPosition(db, U1_SALSA, input('caída'), 4)).toHaveProperty('id');
	});

	it('names the group in its refusal', () => {
		createPosition(db, T1_SALSA, input('Cerrada'), 1);
		expect(createPosition(db, T1_SALSA, input('cerrada'), 2)).toEqual({
			field: 'name',
			message: 'Salsa nadaljevalna already has a position called cerrada.'
		});
	});

	it('refuses an empty name', () => {
		expect(createPosition(db, U1_SALSA, input('  '), 1)).toEqual({
			field: 'name',
			message: 'Give it a name.'
		});
	});

	it('keeps a style of the dance and drops one that is not', () => {
		expect(made(createPosition(db, U1_SALSA, input('A', { styleTag: 'son' }), 1)).styleTag).toBe(
			'son'
		);
		expect(
			made(createPosition(db, U1_SALSA, input('B', { styleTag: 'sensual' }), 1)).styleTag
		).toBeNull();
	});

	it('stores the hold', () => {
		const row = made(
			createPosition(
				db,
				U1_SALSA,
				input('A', { hold: { hands: 'one', crossed: true, facing: 'side', frame: 'open' } }),
				1
			)
		);
		expect(row).toMatchObject({ hands: 'one', crossed: true, facing: 'side', frame: 'open' });
	});
});

describe('listPositions', () => {
	it('sorts by the dance’s type order, untyped last, then folded name', () => {
		createPosition(db, U1_SALSA, input('Zeta'), 1);
		createPosition(db, U1_SALSA, input('Ángel', { styleTag: 'son' }), 1);
		createPosition(db, U1_SALSA, input('beta', { styleTag: 'salsa' }), 1);
		createPosition(db, U1_SALSA, input('Alfa', { styleTag: 'salsa' }), 1);
		createPosition(db, U1_SALSA, input('Otra'), 1);
		expect(listPositions(db, U1_SALSA).map((p) => p.name)).toEqual([
			'Alfa',
			'beta',
			'Ángel',
			'Otra',
			'Zeta'
		]);
	});

	it('lists archived ones on request, and live ones otherwise', () => {
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		createPosition(db, U1_SALSA, input('B'), 1);
		archivePosition(db, a.id, 2);
		expect(listPositions(db, U1_SALSA).map((p) => p.name)).toEqual(['B']);
		expect(listPositions(db, U1_SALSA, { archived: true }).map((p) => p.name)).toEqual(['A']);
	});
});

describe('nameTaken', () => {
	it('folds, and leaves the named row out', () => {
		const a = made(createPosition(db, U1_SALSA, input('Caída'), 1));
		expect(nameTaken(db, U1_SALSA, 'CAIDA')).toBe(true);
		expect(nameTaken(db, U1_SALSA, 'caida', a.id)).toBe(false);
		expect(nameTaken(db, U1_BACHATA, 'Caída')).toBe(false);
		expect(nameTaken(db, U2_SALSA, 'Caída')).toBe(false);
	});

	it('a person and a group in the same dance each hold the same name', () => {
		const mine = made(createPosition(db, U1_SALSA, input('Cerrada'), 1));
		const theirs = made(createPosition(db, T1_SALSA, input('Cerrada'), 1));
		expect([mine.userId, mine.teamId, theirs.userId, theirs.teamId]).toEqual(['u1', null, null, 1]);
		expect(nameTaken(db, T1_SALSA, 'cerrada')).toBe(true);
		expect(nameTaken(db, U1_SALSA, 'cerrada')).toBe(true);
		// Each is refused only inside its own space.
		expect(createPosition(db, T1_SALSA, input('CERRADA'), 2)).toMatchObject({ field: 'name' });
		expect(createPosition(db, U1_SALSA, input('CERRADA'), 2)).toMatchObject({ field: 'name' });
		expect(listPositions(db, U1_SALSA).map((p) => p.id)).toEqual([mine.id]);
		expect(listPositions(db, T1_SALSA).map((p) => p.id)).toEqual([theirs.id]);
	});
});

describe('updatePosition', () => {
	it('keeps a name a sibling already has when the name is not what changed', () => {
		const a = made(createPosition(db, U1_SALSA, input('Cerrada'), 1));
		// A copy of the same name, made past the typed-name rule (as a clone does).
		const b = made(createPosition(db, U1_SALSA, input('Otra'), 1));
		db.update(positions).set({ name: 'Cerrada' }).where(eq(positions.id, b.id)).run();
		expect(updatePosition(db, a.id, input('Cerrada', { notes: 'n' }))).toMatchObject({
			notes: 'n'
		});
		// Typing the taken name onto a different row is still refused.
		const c = made(createPosition(db, U1_SALSA, input('Tercera'), 1));
		expect(updatePosition(db, c.id, input('cerrada'))).toMatchObject({ field: 'name' });
	});

	it('writes the fields', () => {
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		const row = updatePosition(
			db,
			a.id,
			input('B', {
				notes: 'n',
				styleTag: 'son',
				hold: { hands: 'two', crossed: null, facing: null, frame: 'closed' }
			})
		) as PositionRow;
		expect(row).toMatchObject({
			name: 'B',
			notes: 'n',
			styleTag: 'son',
			hands: 'two',
			frame: 'closed'
		});
	});

	it('is null for a missing row, and refuses a taken name but not its own', () => {
		expect(updatePosition(db, 999, input('X'))).toBeNull();
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		createPosition(db, U1_SALSA, input('B'), 1);
		expect(updatePosition(db, a.id, input('b'))).toMatchObject({ field: 'name' });
		expect(updatePosition(db, a.id, input('a'))).toHaveProperty('id');
		expect(updatePosition(db, a.id, input(' '))).toMatchObject({ message: 'Give it a name.' });
	});

	it('clears a picture spot that does not exist', () => {
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		expect(updatePosition(db, a.id, input('A', { pictureSpotId: 42 }))).toMatchObject({
			pictureSpotId: null
		});
	});

	it('keeps a picture that is a point linked to the position, not a section or another’s', () => {
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		const b = made(createPosition(db, U1_SALSA, input('B'), 1));
		const lessonId = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'L',
			notes: null
		}).lesson.id;
		const v = addLessonVideo(
			db,
			{ lessonId, file: 'a.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		);
		const point = addSpot(
			db,
			{ lessonVideoId: v.id },
			{ startMs: 1000, endMs: null, label: null },
			'u1'
		)!;
		const section = addSpot(
			db,
			{ lessonVideoId: v.id },
			{ startMs: 2000, endMs: 3000, label: null },
			'u1'
		)!;
		for (const spotId of [point.id, section.id])
			db.insert(spotPositionLinks).values({ spotId, positionId: a.id }).run();
		expect(updatePosition(db, a.id, input('A', { pictureSpotId: point.id }))).toMatchObject({
			pictureSpotId: point.id
		});
		expect(updatePosition(db, b.id, input('B', { pictureSpotId: point.id }))).toMatchObject({
			pictureSpotId: null
		});
		expect(updatePosition(db, a.id, input('A', { pictureSpotId: section.id }))).toMatchObject({
			pictureSpotId: null
		});
	});
});

describe('archivePosition and restorePosition', () => {
	it('archives, then restores', () => {
		const a = made(createPosition(db, U1_SALSA, input('A'), 1));
		expect(archivePosition(db, a.id, 5)).toBe(true);
		expect(archivePosition(db, a.id, 6)).toBe(false);
		expect(getPosition(db, a.id)!.archivedAt).toBe(5);
		expect(restorePosition(db, a.id, 7)).toBe(true);
		expect(getPosition(db, a.id)!.archivedAt).toBeNull();
		expect(restorePosition(db, a.id, 8)).toBe(false);
		expect(restorePosition(db, 999, 8)).toBe(false);
	});

	it('refuses to restore when the name was taken meanwhile', () => {
		const a = made(createPosition(db, U1_SALSA, input('Caída'), 1));
		archivePosition(db, a.id, 2);
		createPosition(db, U1_SALSA, input('caida'), 3);
		expect(restorePosition(db, a.id, 4)).toBe(false);
		expect(getPosition(db, a.id)!.archivedAt).toBe(2);
	});
});

describe('addTemplates', () => {
	const names = TEMPLATES.salsa.salsa.map((t) => t.name);

	it('adds each with the type, the description as notes and the hold', () => {
		const rows = addTemplates(db, U1_SALSA, 'salsa', 'salsa', names.slice(0, 2), 5);
		expect(rows).toHaveLength(2);
		const t = TEMPLATES.salsa.salsa[0];
		expect(rows[0]).toMatchObject({
			name: t.name,
			styleTag: 'salsa',
			notes: t.description,
			hands: t.hold.hands,
			frame: t.hold.frame,
			userId: 'u1'
		});
	});

	it('skips names already taken (folded) and unknown names', () => {
		createPosition(db, U1_SALSA, input(names[0].toUpperCase()), 1);
		const rows = addTemplates(db, U1_SALSA, 'salsa', 'salsa', [names[0], names[1], 'Nope'], 5);
		expect(rows.map((r) => r.name)).toEqual([names[1]]);
	});
});

describe('positionSummary', () => {
	it('is the viewer’s own with no team id, a group’s with its id', () => {
		const mine = made(createPosition(db, U1_SALSA, input('A', { styleTag: 'son' }), 1));
		const theirs = made(createPosition(db, T1_SALSA, input('B'), 1));
		expect(positionSummary(mine, U1_SALSA)).toEqual({
			id: mine.id,
			name: 'A',
			styleTag: 'son',
			hold: { hands: null, crossed: null, facing: null, frame: null },
			teamId: null,
			archived: false
		});
		expect(positionSummary(theirs, U1_SALSA).teamId).toBe(1);
		expect(positionSummary(theirs, T1_SALSA).teamId).toBeNull();
	});
});

describe('positionSeen', () => {
	it('reads the edit form’s fields, and is null when archived or gone', () => {
		const a = made(createPosition(db, U1_SALSA, input('A', { notes: 'n' }), 1));
		expect(positionSeen(db, a.id)).toEqual({
			name: 'A',
			styleTag: null,
			hands: null,
			crossed: null,
			facing: null,
			frame: null,
			notes: 'n',
			pictureSpotId: null
		});
		archivePosition(db, a.id, 2);
		expect(positionSeen(db, a.id)).toBeNull();
		expect(positionSeen(db, 999)).toBeNull();
	});

	it('reads a populated hold and type: crossed as 1, every chip', () => {
		const a = made(
			createPosition(
				db,
				T1_SALSA,
				input('Manos cruzadas', {
					styleTag: 'son',
					hold: { hands: 'two', crossed: true, facing: 'face', frame: 'closed' }
				}),
				1
			)
		);
		expect(positionSeen(db, a.id)).toEqual({
			name: 'Manos cruzadas',
			styleTag: 'son',
			hands: 'two',
			crossed: 1,
			facing: 'face',
			frame: 'closed',
			notes: null,
			pictureSpotId: null
		});
		const b = made(
			createPosition(
				db,
				U1_SALSA,
				input('Abierta', { hold: { hands: 'one', crossed: false, facing: 'side', frame: 'open' } }),
				1
			)
		);
		expect(positionSeen(db, b.id)).toMatchObject({
			hands: 'one',
			crossed: 0,
			facing: 'side',
			frame: 'open'
		});
	});
});
