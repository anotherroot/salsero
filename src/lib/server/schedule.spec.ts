import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { archiveExercise, createCustomExercise, logSet } from './exercises';
import { listScheduleSets, scheduleStateOf, scheduleStates } from './schedule';
import { U1_SALSA, U2_SALSA } from './test-walls';

let db: Db;
const TZ = 'Europe/Ljubljana';
const at = (day: string) => Date.parse(`${day}T12:00:00+01:00`);

function drill(wall: typeof U1_SALSA, name: string, everyDays = 10) {
	return createCustomExercise(db, wall, { name, everyDays, notes: null });
}
function set(exerciseId: number, doneAt: number, rating: number | null) {
	logSet(db, {
		exerciseId,
		doneAt,
		durationS: null,
		reps: null,
		rating,
		note: null,
		playerJson: null
	});
}

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.com`, passwordHash: 'x', timezone: TZ })
			.run();
});

describe('scheduleStates', () => {
	it('replays each live exercise of the wall, and no one else', () => {
		const a = drill(U1_SALSA, 'A');
		const b = drill(U1_SALSA, 'B');
		const gone = drill(U1_SALSA, 'Gone');
		const other = drill(U2_SALSA, 'Other');
		set(a.id, at('2026-10-01'), 4);
		set(a.id, at('2026-10-11'), 4);
		set(gone.id, at('2026-10-01'), 4);
		set(other.id, at('2026-10-01'), 4);
		archiveExercise(db, gone.id, Date.now());

		const m = scheduleStates(db, U1_SALSA, TZ);
		expect([...m.keys()].sort()).toEqual([a.id, b.id].sort());
		expect(m.get(a.id)).toEqual({ gap: 25, lastDay: '2026-10-11', dueDay: '2026-11-05' });
		expect(m.get(b.id)!.lastDay).toBeNull();
		expect(m.get(b.id)!.gap).toBe(10);
	});
	it('beforeDay ignores that day', () => {
		const a = drill(U1_SALSA, 'A');
		set(a.id, at('2026-10-01'), 4);
		set(a.id, at('2026-10-11'), 4);
		expect(scheduleStates(db, U1_SALSA, TZ, '2026-10-11').get(a.id)!.lastDay).toBe('2026-10-01');
	});
});

describe('scheduleStateOf and listScheduleSets', () => {
	it('reads one exercise, with sets in any insert order', () => {
		const a = drill(U1_SALSA, 'A');
		set(a.id, at('2026-10-11'), 4);
		set(a.id, at('2026-10-01'), 4);
		expect(scheduleStateOf(db, a.id, TZ).gap).toBe(25);
		expect(listScheduleSets(db, U1_SALSA)).toHaveLength(2);
		expect(listScheduleSets(db, U2_SALSA)).toEqual([]);
	});
});
