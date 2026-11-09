import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { archiveVariation, createFigure } from './figures';
import { createLesson } from './lessons';
import { cloneInto } from './clones/clone';
import { markTwins } from './twins';
import { mineTarget } from './mine-target';
import { NO_FILES, T1_SALSA, U2_SALSA } from './test-walls';

/*
 * Where Mine lands from a group's row (group view spec, rule 6): your own copy of
 * it, else your twin, else (a figure) your own figure in the same merged move,
 * else nothing (the tab's own list). Catches: Mine opening an archived copy, a
 * group's row, or someone else's row.
 */
const T = Date.UTC(2026, 10, 9, 12);
const FIG = { partner: 'partner', style: 'salsa', notes: null };
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	setRole(db, 1, 'u2', 'editor');
});

const groupFigure = (move: string, name: string) =>
	createFigure(db, T1_SALSA, { ...FIG, figureName: move, name } as never)!.figure.id;
const ownFigure = (move: string, name: string) =>
	createFigure(db, U2_SALSA, { ...FIG, figureName: move, name } as never)!.figure.id;

describe('mineTarget', () => {
	it('opens your live copy of the group’s figure', async () => {
		const F = groupFigure('Setenta', 'Basic');
		const made = await cloneInto(
			db,
			{ kind: 'figure', id: F, into: U2_SALSA, recordings: false },
			NO_FILES,
			T
		);
		const copy = (made as { id: number }).id;
		expect(mineTarget(db, U2_SALSA, 'figure', F)).toBe(`/salsa/figures/${copy}`);
	});

	it('skips an archived copy for your twin', async () => {
		const F = groupFigure('Setenta', 'Basic');
		const made = await cloneInto(
			db,
			{ kind: 'figure', id: F, into: U2_SALSA, recordings: false },
			NO_FILES,
			T
		);
		archiveVariation(db, (made as { id: number }).id, T);
		const twin = ownFigure('Dile que no', 'Mine');
		expect(markTwins(db, U2_SALSA, 'figure', [twin, F])).toBe(true);
		expect(mineTarget(db, U2_SALSA, 'figure', F)).toBe(`/salsa/figures/${twin}`);
	});

	it('else your first own figure in the same merged move', () => {
		const F = groupFigure('enchufla ', 'Doble');
		const first = ownFigure('Enchufla', 'Basic');
		expect(mineTarget(db, U2_SALSA, 'figure', F)).toBe(`/salsa/figures/${first}`);
	});

	it('else nothing: the tab’s own list', () => {
		const F = groupFigure('Setenta', 'Basic');
		expect(mineTarget(db, U2_SALSA, 'figure', F)).toBeNull();
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		expect(mineTarget(db, U2_SALSA, 'lesson', L)).toBeNull();
	});

	it('a group’s own page: your Groups', () => {
		expect(mineTarget(db, U2_SALSA, 'group', 1)).toBe('/salsa/groups');
	});
});
