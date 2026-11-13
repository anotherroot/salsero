/**
 * A hearing drill's round (phase 2): the drill's settings, with a link's
 * changes for this once, and only the songs a person counted. The db is mocked
 * as in `dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { exercises, songLinks, songs } from '$lib/server/db/schema';
import { CLASS_T, makeClass, type Class } from '$lib/server/test-class';
import { createCustomExercise } from '$lib/server/exercises';
import { withHearing } from '$lib/hearing/drill';
import { load } from './+page.server';

const MAJA = { id: 'u3', email: 'maja@x.si', timezone: 'Europe/Ljubljana', isAdmin: false };
const threw404 = expect.objectContaining({ status: 404 });

function open(id: number, query = '') {
	return (load as unknown as (e: unknown) => Record<string, unknown>)({
		params: { dance: 'salsa', id: String(id) },
		url: new URL(`http://localhost/salsa/hearing/${id}${query}`),
		locals: { user: { ...MAJA, dance: 'salsa' } }
	});
}

let db: Db;
let c: Class;
const teacher = { kind: 'dropped', target: 'odd', drops: 5 } as const;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	c = makeClass(db);
	db.update(exercises)
		.set({ kind: 'hearing', practiceJson: withHearing(null, teacher) })
		.where(eq(exercises.id, c.drill))
		.run();
	db.insert(songLinks)
		.values({ songId: c.shared, exerciseId: c.drill, sortOrder: 1, createdAt: CLASS_T })
		.run();
	db.update(songs).set({ anchorsJson: '[0]' }).where(eq(songs.id, c.shared)).run();
});

describe('the hearing route', () => {
	it("plays a member's entry with the teacher's settings and songs", () => {
		const data = open(c.entry);
		expect(data.settings).toEqual(teacher);
		expect(data.changed).toBe(false);
		expect((data.songs as { id: number }[]).map((s) => s.id)).toEqual([c.shared]);
	});

	it("takes a link's changes for this round, and says so", () => {
		const data = open(c.entry, '?target=every');
		expect(data.changed).toBe(true);
		expect((data.settings as { target: string }).target).toBe('every');
	});

	it('refuses with the reason when no song can be played', () => {
		db.update(songs).set({ anchorsJson: '[]' }).where(eq(songs.id, c.shared)).run();
		expect(() => open(c.entry)).toThrow(threw404);
	});

	it('is no page for a plain drill', () => {
		const plain = createCustomExercise(
			db,
			{ userId: 'u3', dance: 'salsa' },
			{ name: 'X', notes: null }
		);
		expect(() => open(plain.id)).toThrow(threw404);
	});
});
