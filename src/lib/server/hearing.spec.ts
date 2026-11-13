import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, songLinks, songs, teamChanges } from './db/schema';
import { getExercise } from './exercises';
import { CLASS_ED, CLASS_T, makeClass, readyGroupSong, type Class } from './test-class';
import { createHearingDrill, hearingSongsOf, readHearingForm, setHearingSettings } from './hearing';
import { hearingOf, type HearingSettings } from '$lib/hearing/drill';
import { DANCES } from '$lib/dances/dances';

let db: Db;
let c: Class;
beforeEach(() => {
	db = openDb(':memory:');
	c = makeClass(db);
});

const MAJA = { userId: 'u3', dance: 'salsa' as const };
const COUNT = '[0]';
const counted = (id: number) =>
	db.update(songs).set({ anchorsJson: COUNT }).where(eq(songs.id, id)).run();
const song = (title: string, file: string) => readyGroupSong(db, CLASS_ED, title, file);
const SETTINGS: HearingSettings = { kind: 'dropped', target: 'one', drops: 10 };
const musicOf = (id: number) =>
	db
		.select({ songId: songLinks.songId })
		.from(songLinks)
		.where(eq(songLinks.exerciseId, id))
		.orderBy(songLinks.sortOrder)
		.all()
		.map((r) => r.songId);

describe('createHearingDrill', () => {
	it("makes a teacher's hearing drill with its settings and songs, in order", () => {
		const two = song('Casa Mía', '00000000-0000-4000-8000-0000000000d1.mp3');
		counted(c.shared);
		counted(two);
		const made = createHearingDrill(
			db,
			CLASS_ED,
			{ name: 'Kje je ena?', notes: null },
			{ settings: SETTINGS, songIds: [two, c.shared] }
		);
		if (!made.ok) throw new Error(made.message);
		const row = getExercise(db, made.drill.id)!;
		expect(row.kind).toBe('hearing');
		expect(hearingOf(row.practiceJson)).toEqual(SETTINGS);
		expect(musicOf(row.id)).toEqual([two, c.shared]);
	});

	it('refuses a song without a count of its own, and makes nothing', () => {
		const before = db.select().from(exercises).all().length;
		const made = createHearingDrill(
			db,
			CLASS_ED,
			{ name: 'Kje je ena?', notes: null },
			{ settings: SETTINGS, songIds: [c.shared] }
		);
		expect(made.ok).toBe(false);
		expect(db.select().from(exercises).all()).toHaveLength(before);
	});
});

describe('readHearingForm', () => {
	const form = (o: Record<string, string | string[]>) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
		return f;
	};
	const salsa = DANCES.salsa;

	it('is null for a plain drill', () => {
		expect(readHearingForm(form({ name: 'x' }), salsa)).toBeNull();
	});

	it('reads the fields, songs in order', () => {
		expect(
			readHearingForm(
				form({
					type: 'hearing',
					kind: 'tapAlong',
					target: 'own',
					positions: '3,6,7',
					drops: '20',
					songId: ['7', '4']
				}),
				salsa
			)
		).toEqual({
			settings: { kind: 'tapAlong', target: 'own', positions: [3, 6, 7], drops: 20 },
			songIds: [7, 4]
		});
	});

	it('refuses no song with words', () => {
		expect(typeof readHearingForm(form({ type: 'hearing', kind: 'dropped' }), salsa)).toBe(
			'string'
		);
	});
});

describe('setHearingSettings', () => {
	it("saves a group drill's settings and logs the change", () => {
		db.update(exercises).set({ kind: 'hearing' }).where(eq(exercises.id, c.drill)).run();
		const next: HearingSettings = { kind: 'dropped', target: 'odd', drops: 5 };
		expect(setHearingSettings(db, c.drill, next, 'u2', CLASS_T + 5)).toBe(true);
		expect(hearingOf(getExercise(db, c.drill)!.practiceJson)).toEqual(next);
		const line = db
			.select()
			.from(teamChanges)
			.all()
			.find((r) => r.verb === 'change' && r.rootId === c.drill);
		expect(line?.subject).toBe('hearing');
	});
});

describe('hearingSongsOf', () => {
	it('plays the counted songs, and names why the others cannot', () => {
		const two = song('Casa Mía', '00000000-0000-4000-8000-0000000000d1.mp3');
		const three = song('Lágrimas', '00000000-0000-4000-8000-0000000000d2.mp3');
		counted(c.shared);
		counted(three);
		for (const id of [c.shared, two, three])
			db.insert(songLinks)
				.values({ songId: id, exerciseId: c.drill, sortOrder: id, createdAt: CLASS_T })
				.run();
		db.update(songs).set({ sharedAt: CLASS_T }).where(eq(songs.id, three)).run();
		db.update(songs).set({ sharedAt: CLASS_T }).where(eq(songs.id, two)).run();
		const out = hearingSongsOf(db, MAJA.userId, c.drill);
		expect(out.usable.map((s) => s.id)).toEqual([c.shared, three]);
		expect(out.usable[0].grid.beats.length).toBeGreaterThan(0);
		expect(out.blocked).toEqual([{ id: two, title: 'Casa Mía', why: 'count' }]);
	});

	it('none counted: nothing to play', () => {
		db.insert(songLinks)
			.values({ songId: c.shared, exerciseId: c.drill, sortOrder: 1, createdAt: CLASS_T })
			.run();
		expect(hearingSongsOf(db, MAJA.userId, c.drill).usable).toEqual([]);
	});

	it('an unshared class song is blocked as no longer shared', () => {
		counted(c.draft);
		db.insert(songLinks)
			.values({ songId: c.draft, exerciseId: c.drill, sortOrder: 1, createdAt: CLASS_T })
			.run();
		expect(hearingSongsOf(db, MAJA.userId, c.drill)).toMatchObject({
			usable: [],
			blocked: [{ id: c.draft, title: 'Draft', why: 'shared' }]
		});
	});
});

describe("a hearing drill's page content", () => {
	it("gives a member's entry the drill's settings, its own rounds and every song, marked", async () => {
		const { practiceContentOf } = await import('./practice-content');
		const { saveDay } = await import('./exercises');
		const two = song('Casa Mía', '00000000-0000-4000-8000-0000000000d1.mp3');
		db.update(songs).set({ sharedAt: CLASS_T }).where(eq(songs.id, two)).run();
		counted(c.shared);
		db.update(exercises)
			.set({ kind: 'hearing', practiceJson: JSON.stringify({ hearing: SETTINGS }) })
			.where(eq(exercises.id, c.drill))
			.run();
		for (const [i, id] of [c.shared, two].entries())
			db.insert(songLinks)
				.values({ songId: id, exerciseId: c.drill, sortOrder: i, createdAt: CLASS_T })
				.run();
		const round = {
			kind: 'dropped' as const,
			target: 'one' as const,
			drops: 10,
			songIds: [c.shared],
			score: 64,
			timing: 70,
			count: 0,
			restarts: 3,
			listening: 3,
			changed: false
		};
		saveDay(
			db,
			{
				exerciseId: c.entry,
				doneAt: CLASS_T,
				durationS: 60,
				reps: null,
				rating: 3,
				playerJson: null,
				hearingRound: round
			},
			'Europe/Ljubljana'
		);
		const content = practiceContentOf(db, getExercise(db, c.entry)!);
		if (content.type !== 'drill' || !content.hearing) throw new Error('expected a hearing drill');
		expect(content.hearing.settings).toEqual(SETTINGS);
		expect(content.hearing.rounds).toEqual([round]);
		expect(content.hearing.songs).toEqual([
			{ id: c.shared, title: 'Chan Chan', usable: true },
			{ id: two, title: 'Casa Mía', usable: false, why: 'count' }
		]);
	});
});

describe('hearingDrillsWith', () => {
	it("names the person's own hearing drills that play the song", async () => {
		const { hearingDrillsWith } = await import('./hearing');
		counted(c.shared);
		const made = createHearingDrill(
			db,
			MAJA,
			{ name: 'Kje je ena?', notes: null },
			{ settings: SETTINGS, songIds: [c.shared] }
		);
		if (!made.ok) throw new Error(made.message);
		expect(hearingDrillsWith(db, MAJA, c.shared)).toEqual([
			{ id: made.drill.id, name: 'Kje je ena?' }
		]);
		expect(hearingDrillsWith(db, MAJA, c.draft)).toEqual([]);
	});
});
