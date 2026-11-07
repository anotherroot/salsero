import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	appInstalls,
	countTakes,
	defaultStyles,
	deviceTokens,
	lessonAdds,
	lessonCommentHearts,
	lessonComments,
	opens,
	teamMembers,
	users
} from './db/schema';
import { createFigure } from './figures';
import { createLesson, publishLesson } from './lessons';
import { createTeam } from './teams';
import { createDeviceToken } from './devices';
import { crossRefs, danceIntegrity, ownerIntegrity } from './integrity';
import { splitAccounts } from './dance-split';
import { seedAdmin } from './admin';
import type { CloneFiles } from './clones/files';
import type { Space } from './scope';

const T = 1_800_000_000_000;
let db: Db;
let linked: string[];
let files: CloneFiles;

beforeEach(() => {
	db = openDb(':memory:');
	linked = [];
	files = {
		link: async (_kind, file) => {
			const name = `copy-${linked.length}-${file}`;
			linked.push(name);
			return name;
		},
		unlink: async () => {}
	};
});

function addUser(id: string, email = 'me@x.si') {
	db.insert(users)
		.values({ id, email, passwordHash: 'hash', firstName: 'Me', isAdmin: true })
		.run();
}

const figure = (space: Space, name = 'F') =>
	createFigure(db, space, {
		figureName: `${name}-${space.dance}`,
		name: 'Basic',
		partner: 'partner',
		style: space.dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null
	})!.figure.id;

const take = (userId: string, phrase: 'a' | 'b') =>
	db
		.insert(countTakes)
		.values({
			userId,
			pattern: 'salsa',
			bpm: 90,
			phrase,
			file: `${phrase}0000000-0000-4000-8000-000000000000.wav`,
			sampleRate: 48000,
			preRollS: 0,
			lengthS: 1,
			durationS: 2,
			sizeBytes: 100
		})
		.run();

const userRow = (id: string) => db.select().from(users).where(eq(users.id, id)).get();
const others = () => db.select().from(users).all();

describe('splitAccounts', () => {
	// Catches: an account of one dance left without a dance, so it signs in nowhere.
	it('places an account that owns only one dance in it', async () => {
		addUser('u2');
		figure({ userId: 'u2', dance: 'bachata' });
		expect(await splitAccounts(db, files, T)).toEqual({ assigned: 1, split: 0, failed: 0 });
		expect(userRow('u2')?.dance).toBe('bachata');
	});

	// Catches: an account with nothing yet left unplaced.
	it('places an account with nothing in salsa', async () => {
		addUser('u2');
		await splitAccounts(db, files, T);
		expect(userRow('u2')?.dance).toBe('salsa');
	});

	// Catches: the bachata half staying on the salsa account, or a piece of it left behind.
	it('gives the bachata half of an account that holds both to a new bachata account', async () => {
		addUser('u1');
		const salsaFigure = figure({ userId: 'u1', dance: 'salsa' });
		const bachataFigure = figure({ userId: 'u1', dance: 'bachata' });
		const made = createTeam(db, 'u1', 'bachata', 'Class', T);
		if (!made.ok) throw new Error('setup');
		const team = { dance: 'bachata' as const, teamId: made.teamId, actorId: 'u1' };
		const lesson = createLesson(db, team, { lessonDay: '2026-11-01', title: 'L', notes: null })
			.lesson.id;
		publishLesson(db, team, lesson, T);
		db.insert(lessonAdds).values({ userId: 'u1', lessonId: lesson, addedAt: T, seenAt: T }).run();
		db.insert(opens).values({ userId: 'u1', kind: 'comments', itemId: lesson, openedAt: T }).run();
		const comment = db
			.insert(lessonComments)
			.values({ lessonId: lesson, authorId: 'u1', body: 'hi' })
			.returning()
			.get().id;
		db.insert(lessonCommentHearts).values({ commentId: comment, userId: 'u1' }).run();
		createDeviceToken(db, 'u1', 'Bachata app', T);
		createDeviceToken(db, 'u1', 'Android app', T);
		db.insert(defaultStyles).values({ userId: 'u1', dance: 'bachata', style: 'sensual' }).run();
		db.insert(appInstalls)
			.values({ userId: 'u1', dance: 'bachata', versionCode: 6, channel: 'direct', seenAt: T })
			.run();
		take('u1', 'a');
		take('u1', 'b');

		expect(await splitAccounts(db, files, T)).toEqual({ assigned: 0, split: 1, failed: 0 });

		expect(userRow('u1')?.dance).toBe('salsa');
		const b = others().find((u) => u.id !== 'u1')!;
		expect(b).toMatchObject({
			dance: 'bachata',
			email: 'me@x.si',
			passwordHash: 'hash',
			firstName: 'Me',
			isAdmin: true
		});
		const ownerOf = (table: 'figures', id: number) =>
			db.all<{ user_id: string }>(`select user_id from ${table} where id = ${id}`)[0].user_id;
		expect(ownerOf('figures', salsaFigure)).toBe('u1');
		expect(ownerOf('figures', bachataFigure)).toBe(b.id);
		expect(
			db
				.select()
				.from(teamMembers)
				.all()
				.map((m) => m.userId)
		).toEqual([b.id]);
		expect(db.select().from(lessonAdds).get()?.userId).toBe(b.id);
		expect(db.select().from(opens).get()?.userId).toBe(b.id);
		expect(db.select().from(lessonComments).get()?.authorId).toBe(b.id);
		expect(db.select().from(lessonCommentHearts).get()?.userId).toBe(b.id);
		expect(db.select().from(defaultStyles).get()?.userId).toBe(b.id);
		expect(db.select().from(appInstalls).get()?.userId).toBe(b.id);
		const tokens = db.select().from(deviceTokens).all();
		expect(tokens.find((t) => t.label === 'Bachata app')?.userId).toBe(b.id);
		expect(tokens.find((t) => t.label === 'Android app')?.userId).toBe('u1');
		const takes = db.select().from(countTakes).all();
		expect(takes.filter((t) => t.userId === 'u1')).toHaveLength(2);
		expect(
			takes
				.filter((t) => t.userId === b.id)
				.map((t) => t.file)
				.sort()
		).toEqual([...linked].sort());

		expect(danceIntegrity(db)).toEqual([]);
		expect(ownerIntegrity(db)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	// Catches: a restart making a second bachata account or a second set of takes.
	it('does nothing the second time', async () => {
		addUser('u1');
		figure({ userId: 'u1', dance: 'salsa' });
		figure({ userId: 'u1', dance: 'bachata' });
		take('u1', 'a');
		await splitAccounts(db, files, T);
		const before = {
			users: others(),
			takes: db.select().from(countTakes).all(),
			figures: db.all(`select id, user_id, dance from figures order by id`)
		};
		const linkedBefore = linked.length;
		expect(await splitAccounts(db, files, T)).toEqual({ assigned: 0, split: 0, failed: 0 });
		expect(others()).toEqual(before.users);
		expect(db.select().from(countTakes).all()).toEqual(before.takes);
		expect(db.all(`select id, user_id, dance from figures order by id`)).toEqual(before.figures);
		expect(before.users).toHaveLength(2);
		expect(before.takes).toHaveLength(2);
		expect(linked).toHaveLength(linkedBefore);
		expect(danceIntegrity(db)).toEqual([]);
	});

	// Catches: copied files left on disk when the move fails.
	// Catches: a take whose file is gone on disk failing the whole split, which
	// would leave the account with no dance, unable to sign in anywhere.
	it('splits without a take whose file is missing, and says so', async () => {
		addUser('u1');
		figure({ userId: 'u1', dance: 'salsa' });
		figure({ userId: 'u1', dance: 'bachata' });
		take('u1', 'a');
		take('u1', 'b');
		const link = files.link;
		files.link = async (kind, file) => {
			if (file.startsWith('a')) throw new Error('ENOENT');
			return link(kind, file);
		};
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await splitAccounts(db, files, T)).toEqual({ assigned: 0, split: 1, failed: 0 });
		const b = others().find((u) => u.id !== 'u1')!;
		expect(db.select().from(countTakes).where(eq(countTakes.userId, b.id)).all()).toHaveLength(1);
		expect(db.select().from(countTakes).where(eq(countTakes.userId, 'u1')).all()).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
	});

	// Catches: one person's failed split taking the whole site down at boot (the
	// boot awaits it), or leaving copied files behind.
	it('unlinks the copied takes when the move throws, and goes on to the next person', async () => {
		addUser('u1');
		figure({ userId: 'u1', dance: 'salsa' });
		figure({ userId: 'u1', dance: 'bachata' });
		take('u1', 'a');
		const unlinked: string[] = [];
		files.unlink = async (_kind, file) => {
			unlinked.push(file);
		};
		// A bachata account with the same email already exists: the insert throws.
		db.insert(users)
			.values({ id: 'x', email: 'me@x.si', passwordHash: 'h', dance: 'bachata' })
			.run();
		addUser('u2', 'u2@x.si');
		figure({ userId: 'u2', dance: 'bachata' }, 'Other');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await splitAccounts(db, files, T)).toEqual({ assigned: 1, split: 0, failed: 1 });
		expect(unlinked).toEqual(linked);
		expect(userRow('u1')?.dance).toBeNull();
		expect(userRow('u2')?.dance).toBe('bachata');
		expect(warn).toHaveBeenCalled();
	});
});

describe('danceIntegrity', () => {
	// Catches: a row of one dance owned by an account of the other going unreported.
	it('reports a bachata figure on a salsa account', () => {
		addUser('u1');
		figure({ userId: 'u1', dance: 'bachata' });
		db.update(users).set({ dance: 'salsa' }).run();
		expect(danceIntegrity(db)).toHaveLength(2); // the figure and its move
	});
});

describe('seedAdmin', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	// Catches: a fresh database with an admin in one dance only.
	it('makes an admin in every dance that has no account', async () => {
		await seedAdmin(db, 'Admin@x.si', 'Correct-horse-9');
		const rows = others();
		expect(rows.map((u) => u.dance).sort()).toEqual(['bachata', 'salsa']);
		expect(rows.every((u) => u.email === 'admin@x.si' && u.isAdmin)).toBe(true);
	});

	// Catches: production getting a stray admin after the split.
	it('makes none when both dances have an account', async () => {
		addUser('u1');
		figure({ userId: 'u1', dance: 'salsa' });
		figure({ userId: 'u1', dance: 'bachata' });
		await splitAccounts(db, files, T);
		await seedAdmin(db, 'admin@x.si', 'Correct-horse-9');
		expect(others()).toHaveLength(2);
	});
});
