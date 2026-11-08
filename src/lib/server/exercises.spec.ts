import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, songDrops, teamChanges } from './db/schema';
import { checkSeen, exerciseSeen } from './clash';
import {
	archiveExercise,
	createCustomExercise,
	listExercises,
	listPickExercises,
	setPracticeSettings,
	updateExercise
} from './exercises';
import { createSongFromUpload, storeAnalysis } from './songs';
import { shareSong, unshareSong } from './song-share';
import { CLASS_ED, CLASS_T, makeClass, readyGroupSong, type Class } from './test-class';
import { addFigureExercise, createFigure } from './figures';
import { createRoutine } from './routines';
import { FACES, parseComesBack } from '$lib/schedule/comes-back';
import { U1_SALSA, U1_BACHATA } from '$lib/server/test-walls';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

describe('listPickExercises', () => {
	it('returns every live exercise of the dance with source, everyDays, figure and variation', () => {
		const { figure } = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		const own = addFigureExercise(db, 'u1', figure.id, 5)!;
		const custom = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 2, notes: null });
		const { exercise: routineEx } = createRoutine(db, U1_SALSA, { name: 'Zeta', notes: null });

		const rows = listPickExercises(db, U1_SALSA);
		expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort());
		expect(rows).toHaveLength(3);
		expect(rows.find((r) => r.id === own.id)).toEqual({
			id: own.id,
			name: own.name,
			source: 'figure',
			everyDays: 5,
			figure: 'Enchufla',
			variation: 'Doble',
			linked: false
		});
		expect(rows.find((r) => r.id === custom.id)).toEqual({
			id: custom.id,
			name: 'Clave',
			source: 'custom',
			everyDays: 2,
			figure: null,
			variation: null,
			linked: false
		});
		expect(rows.find((r) => r.id === routineEx.id)).toMatchObject({
			source: 'routine',
			figure: null,
			variation: null
		});
	});

	it("leaves out archived exercises and the other dance's", () => {
		const gone = createCustomExercise(db, U1_SALSA, { name: 'Gone', everyDays: 2, notes: null });
		const kept = createCustomExercise(db, U1_SALSA, { name: 'Kept', everyDays: 2, notes: null });
		createCustomExercise(db, U1_BACHATA, { name: 'Other', everyDays: 2, notes: null });
		archiveExercise(db, gone.id, 1000);
		expect(listPickExercises(db, U1_SALSA).map((r) => r.id)).toEqual([kept.id]);
	});
});

describe("a member's entry and the group's songs", () => {
	let c: Class;
	const config = {
		count: 'son' as const,
		clave: '2-3' as const,
		speed: 1 as const,
		callEvery: null
	};
	const song = (songId: number) =>
		setPracticeSettings(db, c.entry, { mode: 'song', songId, countBpm: null, config });
	const row = () => db.select().from(exercises).where(eq(exercises.id, c.entry)).get()!;
	const drops = () => db.select().from(songDrops).where(eq(songDrops.exerciseId, c.entry)).all();

	beforeEach(() => {
		c = makeClass(db);
	});

	it('takes a shared song of a group the person is in', () => {
		expect(song(c.shared)).toBe(true);
		expect(row().songId).toBe(c.shared);
	});

	it("refuses a draft, and another group's shared song", () => {
		expect(song(c.draft)).toBe(false);
		expect(song(c.other)).toBe(false);
		expect(row().songId).toBeNull();
	});

	it('refuses a song of the group that is not ready', () => {
		const waiting = createSongFromUpload(db, CLASS_ED, {
			file: 'w.mp3',
			mime: 'audio/mpeg',
			title: 'Waiting',
			style: 'salsa'
		}).id;
		expect(song(waiting)).toBe(false);
	});

	it("an editor's own entry never holds the group's draft", () => {
		const own = createCustomExercise(
			db,
			{ userId: 'u2', dance: 'salsa' },
			{ name: 'Mine', everyDays: 1, notes: null }
		);
		const put = (songId: number) =>
			setPracticeSettings(db, own.id, { mode: 'song', songId, countBpm: null, config });
		expect(put(c.draft)).toBe(false);
		expect(put(c.shared)).toBe(true);
	});

	it('practising on count after a drop keeps the class song coming back', () => {
		expect(song(c.shared)).toBe(true);
		unshareSong(db, CLASS_ED, c.shared, CLASS_T + 1);
		expect(row().songId).toBeNull();
		expect(drops()).toHaveLength(1);
		expect(
			setPracticeSettings(db, c.entry, { mode: 'count', songId: null, countBpm: 150, config })
		).toBe(true);
		// The app fell back to the count: not the person's choice, so the drop stays.
		expect(drops()).toHaveLength(1);
		shareSong(db, CLASS_ED, c.shared, CLASS_T + 2);
		expect([row().practiceMode, row().songId]).toEqual(['song', c.shared]);
		expect(drops()).toHaveLength(0);
	});

	it('another song, picked after a drop, stays when the first is shared again', () => {
		const second = readyGroupSong(db, CLASS_ED, 'Second', 'second.mp3');
		shareSong(db, CLASS_ED, second, CLASS_T);
		expect(song(c.shared)).toBe(true);
		unshareSong(db, CLASS_ED, c.shared, CLASS_T + 1);
		expect(song(second)).toBe(true);
		expect(
			db
				.select()
				.from(songDrops)
				.where(and(eq(songDrops.exerciseId, c.entry), eq(songDrops.songId, c.shared)))
				.all()
		).toHaveLength(0);
		// Even once the second one is dropped too, the first does not come back.
		unshareSong(db, CLASS_ED, second, CLASS_T + 2);
		shareSong(db, CLASS_ED, c.shared, CLASS_T + 3);
		expect(row().songId).toBeNull();
		shareSong(db, CLASS_ED, second, CLASS_T + 4);
		expect(row().songId).toBe(second);
	});
});

describe('a song of their own, picked after a drop', () => {
	it('stays when the class song is shared again', () => {
		const c = makeClass(db);
		const config = {
			count: 'son' as const,
			clave: '2-3' as const,
			speed: 1 as const,
			callEvery: null
		};
		const put = (mode: 'song' | 'count', songId: number | null) =>
			setPracticeSettings(db, c.entry, {
				mode,
				songId,
				countBpm: mode === 'count' ? 150 : null,
				config
			});
		const own = createSongFromUpload(
			db,
			{ userId: 'u3', dance: 'salsa' },
			{
				file: 'own.mp3',
				mime: 'audio/mpeg',
				title: 'Own',
				style: 'salsa'
			}
		).id;
		storeAnalysis(db, own, { beats: [0.5, 1, 1.5], downbeats: [], durationS: 90 });
		expect(put('song', c.shared)).toBe(true);
		unshareSong(db, CLASS_ED, c.shared, CLASS_T + 1);
		expect(put('count', null)).toBe(true);
		expect(put('song', own)).toBe(true);
		expect(db.select().from(songDrops).where(eq(songDrops.exerciseId, c.entry)).all()).toEqual([]);
		shareSong(db, CLASS_ED, c.shared, CLASS_T + 2);
		const row = db.select().from(exercises).where(eq(exercises.id, c.entry)).get()!;
		expect([row.practiceMode, row.songId]).toEqual(['song', own]);
	});
});

describe('listExercises: comes back and warm-up', () => {
	const MAJA = { userId: 'u3', dance: 'salsa' as const };
	const EVERY_2 = JSON.stringify({ kind: 'every', days: 2 });
	const EVERY_7 = JSON.stringify({ kind: 'every', days: 7 });

	it("gives an entry its class drill's setting, and its own when it has one", () => {
		const c = makeClass(db);
		db.update(exercises).set({ comesBack: EVERY_2 }).where(eq(exercises.id, c.drill)).run();
		const entry = () => listExercises(db, MAJA).find((e) => e.id === c.entry)!;
		expect(entry().comesBack).toEqual({ kind: 'every', days: 2 });
		expect(entry().comesBackOwn).toBeNull();
		expect(entry().comesBackTeacher).toEqual({ kind: 'every', days: 2 });

		db.update(exercises).set({ comesBack: EVERY_7 }).where(eq(exercises.id, c.entry)).run();
		expect(entry().comesBack).toEqual({ kind: 'every', days: 7 });
		expect(entry().comesBackOwn).toEqual({ kind: 'every', days: 7 });
		expect(entry().comesBackTeacher).toEqual({ kind: 'every', days: 2 });
	});

	it('reads a lesson review as faces whatever the column holds, and junk as faces', () => {
		const c = makeClass(db);
		const reviewId = db
			.insert(exercises)
			.values({
				name: 'Review',
				source: 'lesson',
				lessonId: c.lesson,
				userId: 'u3',
				dance: 'salsa',
				comesBack: EVERY_2
			})
			.returning({ id: exercises.id })
			.get().id;
		expect(listExercises(db, MAJA).find((e) => e.id === reviewId)!.comesBack).toEqual(FACES);

		const own = createCustomExercise(db, U1_SALSA, { name: 'Junk', everyDays: 2, notes: null });
		db.update(exercises).set({ comesBack: 'junk' }).where(eq(exercises.id, own.id)).run();
		const row = listExercises(db, U1_SALSA).find((e) => e.id === own.id)!;
		expect(row.comesBack).toEqual(FACES);
		expect(row.comesBackOwn).toBeNull();
	});

	it('has no warm-up by default', () => {
		createCustomExercise(db, U1_SALSA, { name: 'A', everyDays: 2, notes: null });
		const [row] = listExercises(db, U1_SALSA);
		expect(row.warmup).toBe(false);
		expect(row.warmupOrder).toBeNull();
	});
});

describe('updateExercise: warm-up and comes back', () => {
	const EVERY_2 = { kind: 'every', days: 2 } as const;
	const stored = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;

	it('saves them on a person drill, and keeps them when left out', () => {
		const d = createCustomExercise(db, U1_SALSA, { name: 'A', notes: null });
		updateExercise(db, d.id, {
			name: 'A',
			notes: null,
			active: true,
			warmup: true,
			comesBack: EVERY_2
		});
		expect(stored(d.id).warmup).toBe(true);
		expect(parseComesBack(stored(d.id).comesBack)).toEqual(EVERY_2);
		updateExercise(db, d.id, { name: 'A', notes: 'n', active: true });
		expect(stored(d.id).warmup).toBe(true);
		expect(parseComesBack(stored(d.id).comesBack)).toEqual(EVERY_2);
	});

	it('creates with them', () => {
		const d = createCustomExercise(db, U1_SALSA, {
			name: 'B',
			notes: null,
			warmup: true,
			comesBack: { kind: 'until', good: 3, since: 7 }
		});
		expect(d.warmup).toBe(true);
		expect(parseComesBack(d.comesBack)).toEqual({ kind: 'until', good: 3, since: 7 });
	});

	it('leaves a lesson review on faces (the column stays null)', () => {
		const c = makeClass(db);
		const id = db
			.insert(exercises)
			.values({ name: 'R', source: 'lesson', lessonId: c.lesson, userId: 'u3', dance: 'salsa' })
			.returning({ id: exercises.id })
			.get().id;
		updateExercise(db, id, { name: 'R', notes: null, active: true, comesBack: EVERY_2 });
		expect(stored(id).comesBack).toBeNull();
	});

	it("clears a member's entry with 'teacher'", () => {
		const c = makeClass(db);
		db.update(exercises)
			.set({ comesBack: JSON.stringify(EVERY_2) })
			.where(eq(exercises.id, c.entry))
			.run();
		updateExercise(db, c.entry, {
			name: 'Shines',
			notes: null,
			active: true,
			comesBack: 'teacher'
		});
		expect(stored(c.entry).comesBack).toBeNull();
	});

	it("takes a member's entry warm-up (the person's own row)", () => {
		const c = makeClass(db);
		expect(stored(c.entry).teamId).toBeNull();
		updateExercise(db, c.entry, { name: 'Shines', notes: null, active: true, warmup: true });
		expect(stored(c.entry).warmup).toBe(true);
	});

	it("never writes a group drill's warm-up, and names a Comes back change in History", () => {
		const c = makeClass(db);
		updateExercise(
			db,
			c.drill,
			{ name: 'Shines', notes: null, active: true, warmup: true, comesBack: EVERY_2 },
			'u2'
		);
		expect(stored(c.drill).warmup).toBe(false);
		expect(parseComesBack(stored(c.drill).comesBack)).toEqual(EVERY_2);
		const line = db
			.select()
			.from(teamChanges)
			.all()
			.find((r) => r.verb === 'change' && r.rootId === c.drill)!;
		expect(line.subject).toBe('comesBack');
		expect(line.afterJson).toContain('Every 2 days');
	});
});

describe('the clash check on a drill', () => {
	it("refuses a stale form that saw another Comes back on a group's drill", () => {
		const c = makeClass(db);
		const seen = exerciseSeen(col(db, c.drill));
		updateExercise(
			db,
			c.drill,
			{ name: 'Shines', notes: null, active: true, comesBack: { kind: 'every', days: 7 } },
			'u2'
		);
		const check = checkSeen(exerciseSeen(col(db, c.drill)), seen);
		expect(check).toMatchObject({ ok: false, changed: ['comesBack'] });
	});
});

function col(db: Db, id: number) {
	return db.select().from(exercises).where(eq(exercises.id, id)).get()!;
}
