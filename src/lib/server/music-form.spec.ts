/** The three pages' Music actions (spec B): add, a note, remove. */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { songs, users } from './db/schema';
import { createLesson } from './lessons';
import { createSongFromUpload } from './songs';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { shareSong } from './song-share';
import { listMusic, musicSeen } from './song-links';
import { addSongFrom, noteSongFrom, removeSongFrom } from './music-form';
import type { TeamSpace, Wall } from './scope';

const U1: Wall = { userId: 'u1', dance: 'salsa' };
const ED: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };
let db: Db;

const req = (fields: Record<string, string>) =>
	new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
const song = (space: Wall | TeamSpace, title: string) => {
	const s = createSongFromUpload(db, space, {
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
	db.insert(users)
		.values(
			['Ana', 'Luka'].map((firstName, i) => ({
				id: `u${i + 1}`,
				email: `${i}@x.si`,
				passwordHash: 'x',
				firstName
			}))
		)
		.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
});

describe('addSongFrom', () => {
	it('adds the song with its note', async () => {
		const lesson = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'C', notes: null }).lesson.id
		};
		const s = song(U1, 'Casa');
		expect(
			await addSongFrom(req({ songId: String(s), note: ' Slow one ' }), db, U1, lesson)
		).toEqual({
			action: 'addSong',
			ok: true
		});
		expect(listMusic(db, lesson, 'u1')[0].note).toBe('Slow one');
	});
	it('puts a note over 500 characters under Note, keeping it', async () => {
		const lesson = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'C', notes: null }).lesson.id
		};
		const long = 'x'.repeat(501);
		expect(
			await addSongFrom(req({ songId: String(song(U1, 'Casa')), note: long }), db, U1, lesson)
		).toMatchObject({
			status: 400,
			data: { action: 'addSong', field: 'note', note: long }
		});
		expect(listMusic(db, lesson, 'u1')).toEqual([]);
	});
	it('says why a song cannot go, as addMusic does', async () => {
		const lesson = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'C', notes: null }).lesson.id
		};
		const s = song(U1, 'Casa');
		await addSongFrom(req({ songId: String(s), note: '' }), db, U1, lesson);
		expect(await addSongFrom(req({ songId: String(s), note: '' }), db, U1, lesson)).toMatchObject({
			status: 400,
			data: { action: 'addSong', message: 'Already in Music' }
		});
	});
});

describe('noteSongFrom and removeSongFrom', () => {
	async function groupLink() {
		const lesson = {
			lessonId: createLesson(db, ED, { lessonDay: '2026-11-03', title: 'C', notes: null }).lesson.id
		};
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, 1);
		await addSongFrom(req({ songId: String(s), note: '' }), db, ED, lesson);
		return { lesson, link: listMusic(db, lesson, 'u2')[0] };
	}

	it("refuses a group's note without seen, saves one with it", async () => {
		const { lesson, link } = await groupLink();
		expect(
			await noteSongFrom(req({ linkId: String(link.id), note: 'Count it' }), db, ED, lesson)
		).toMatchObject({
			status: 400
		});
		const seen = JSON.stringify(musicSeen({ note: null }));
		expect(
			await noteSongFrom(req({ linkId: String(link.id), note: 'Count it', seen }), db, ED, lesson)
		).toEqual({
			action: 'noteSong',
			ok: true
		});
		expect(listMusic(db, lesson, 'u2')[0].note).toBe('Count it');
	});

	it('removes once, then says it is gone', async () => {
		const { lesson, link } = await groupLink();
		expect(await removeSongFrom(req({ linkId: String(link.id) }), db, ED, lesson)).toEqual({
			action: 'removeSong',
			ok: true
		});
		expect(await removeSongFrom(req({ linkId: String(link.id) }), db, ED, lesson)).toMatchObject({
			status: 404,
			data: { action: 'removeSong', message: 'That song was already removed.' }
		});
	});
});

describe("a link that is not the page's", () => {
	it("refuses another person's link with the missing one's 404, never their note", async () => {
		const theirs = {
			lessonId: createLesson(
				db,
				{ userId: 'u2', dance: 'salsa' },
				{ lessonDay: '2026-11-03', title: 'C', notes: null }
			).lesson.id
		};
		const s = song({ userId: 'u2', dance: 'salsa' }, 'Secret');
		await addSongFrom(
			req({ songId: String(s), note: 'private note' }),
			db,
			{ userId: 'u2', dance: 'salsa' },
			theirs
		);
		const link = listMusic(db, theirs, 'u2')[0];
		const mine = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'Mine', notes: null }).lesson
				.id
		};
		const res = await noteSongFrom(
			req({ linkId: String(link.id), note: 'x', seen: JSON.stringify({ note: 'x' }) }),
			db,
			U1,
			mine
		);
		expect(res).toMatchObject({ status: 404 });
		expect(JSON.stringify(res)).not.toContain('private note');
		expect(await removeSongFrom(req({ linkId: String(link.id) }), db, U1, mine)).toMatchObject({
			status: 404
		});
		expect(listMusic(db, theirs, 'u2')).toHaveLength(1);
	});

	it('refuses a link of another lesson of the same person', async () => {
		const a = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'A', notes: null }).lesson.id
		};
		const b = {
			lessonId: createLesson(db, U1, { lessonDay: '2026-11-03', title: 'B', notes: null }).lesson.id
		};
		await addSongFrom(req({ songId: String(song(U1, 'Casa')), note: '' }), db, U1, a);
		const link = listMusic(db, a, 'u1')[0];
		expect(await removeSongFrom(req({ linkId: String(link.id) }), db, U1, b)).toMatchObject({
			status: 404
		});
		expect(
			await noteSongFrom(req({ linkId: String(link.id), note: 'x' }), db, U1, b)
		).toMatchObject({ status: 404 });
		expect(listMusic(db, a, 'u1')).toHaveLength(1);
	});
});
