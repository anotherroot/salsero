/** The log popup's songs mark the row's own Music (spec B), so the popup lists it first. */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { songs } from './db/schema';
import { createCustomExercise } from './exercises';
import { createSongFromUpload } from './songs';
import { addMusic } from './song-links';
import { pageData } from './page-data';
import { U1_SALSA } from './test-walls';

const T = 1_790_000_000_000;
let db: Db;

const song = (title: string) => {
	const s = createSongFromUpload(db, U1_SALSA, {
		file: `${title}.mp3`,
		mime: 'audio/mpeg',
		title,
		style: 'salsa'
	});
	db.update(songs)
		.set({ status: 'ready', durationS: 200, beatsJson: '[]' })
		.where(eq(songs.id, s.id))
		.run();
	return s.id;
};

beforeEach(() => {
	db = openDb(':memory:');
});

describe("pageData marks the row's Music", () => {
	it("a drill's suggested songs carry its name and their order", () => {
		const drill = createCustomExercise(db, U1_SALSA, {
			name: 'Shines',
			everyDays: 3,
			notes: null
		}).id;
		const a = song('Alma');
		const b = song('Bembe');
		song('Casa');
		addMusic(db, U1_SALSA, { exerciseId: drill }, b, null, T);
		addMusic(db, U1_SALSA, { exerciseId: drill }, a, null, T);
		const data = pageData(db, U1_SALSA, drill, 'UTC', T)!;
		expect(data.songs.filter((s) => s.music).map((s) => [s.id, s.music])).toEqual([
			[a, { label: 'Shines', rank: 1 }],
			[b, { label: 'Shines', rank: 0 }]
		]);
	});
});
